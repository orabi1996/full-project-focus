-- ============================================================================
-- Migration: 20260914060000_finalize_document_archive_and_live_data_integrity.sql
-- Description: Authoritative atomic business document archiving RPC and
--              hardened storage access preventing self-download of archived employee documents.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Authoritative Atomic Business Document Archiving RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.archive_business_document(
  p_document_id uuid,
  p_document_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_hr boolean;
  v_current_emp_id uuid;
  v_comp_doc public.company_documents%ROWTYPE;
  v_emp_doc public.employee_documents%ROWTYPE;
BEGIN
  -- 1. Ensure caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  v_is_hr := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']);
  v_current_emp_id := public.current_employee_id();

  -- 2. Process Company Document Archival
  IF p_document_type = 'company' THEN
    -- Strictly require HR or administrator role
    IF NOT v_is_hr THEN
      RAISE EXCEPTION 'Not authorized to archive company documents' USING ERRCODE = '42501';
    END IF;

    -- Lock row and verify existence
    SELECT * INTO v_comp_doc
    FROM public.company_documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Company document not found' USING ERRCODE = 'P0002';
    END IF;

    -- Update company document status to archived
    UPDATE public.company_documents
    SET
      status = 'archived'
    WHERE id = p_document_id;

    -- Atomically archive linked file_objects metadata if present
    IF v_comp_doc.file_id IS NOT NULL THEN
      UPDATE public.file_objects
      SET
        status = 'archived',
        archived_at = now(),
        updated_at = now()
      WHERE id = v_comp_doc.file_id;
    END IF;

  -- 3. Process Employee Document Archival
  ELSIF p_document_type = 'employee' THEN
    -- Lock row and verify existence
    SELECT * INTO v_emp_doc
    FROM public.employee_documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Employee document not found' USING ERRCODE = 'P0002';
    END IF;

    -- Enforce ownership or HR authorization
    IF NOT v_is_hr AND (v_emp_doc.employee_id IS NULL OR v_emp_doc.employee_id != v_current_emp_id) THEN
      RAISE EXCEPTION 'Not authorized to archive this employee document' USING ERRCODE = '42501';
    END IF;

    -- Update employee document status to archived
    UPDATE public.employee_documents
    SET
      status = 'archived'
    WHERE id = p_document_id;

    -- Atomically archive linked file_objects metadata if present
    IF v_emp_doc.file_id IS NOT NULL THEN
      UPDATE public.file_objects
      SET
        status = 'archived',
        archived_at = now(),
        updated_at = now()
      WHERE id = v_emp_doc.file_id;
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid document type. Must be "company" or "employee"' USING ERRCODE = '22023';
  END IF;

END;
$$;

REVOKE ALL ON FUNCTION public.archive_business_document(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_business_document(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_business_document(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- STEP 2: Harden can_access_storage_object for Employee Document Access
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_storage_object(
  p_bucket_id text,
  p_object_name text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_emp_id uuid;
  v_is_hr boolean;
  v_is_finance boolean;
  v_is_recruiter boolean;
  v_file public.file_objects%ROWTYPE;
  v_comp_doc public.company_documents%ROWTYPE;
  v_emp_doc public.employee_documents%ROWTYPE;
  v_emp_dept_id uuid;
  v_emp_sub_id uuid;
BEGIN
  -- 1. Service role bypass
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;
  
  -- 2. Unauthenticated callers are denied
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  v_current_emp_id := public.current_employee_id();
  v_is_hr := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']);
  v_is_finance := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'auditor']);
  v_is_recruiter := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'recruiter']);

  -- 3. Query authoritative metadata catalog
  SELECT * INTO v_file
  FROM public.file_objects
  WHERE bucket_id = p_bucket_id AND object_path = p_object_name
  LIMIT 1;

  -- If file exists in catalog, enforce status checks
  IF FOUND THEN
    -- Quarantined, deleted, or corrupted files cannot be downloaded by anyone
    IF v_file.status IN ('deleted', 'quarantined', 'orphaned', 'cleanup_failed') THEN
      RETURN false;
    END IF;

    -- Archived files: only HR/admins retain audit/historical access
    IF v_file.status = 'archived' AND NOT v_is_hr THEN
      RETURN false;
    END IF;

    -- Bucket-specific metadata authorization
    IF p_bucket_id = 'company-documents' THEN
      IF v_is_hr THEN
        RETURN true;
      END IF;

      -- Check company document business scope
      SELECT * INTO v_comp_doc
      FROM public.company_documents
      WHERE file_id = v_file.id OR id::text = v_file.entity_id
      LIMIT 1;

      IF FOUND THEN
        -- Check archived/inactive status
        IF v_comp_doc.status IN ('archived', 'inactive') THEN
          RETURN false;
        END IF;

        IF v_comp_doc.visibility_scope = 'all' THEN
          RETURN true;
        ELSIF v_comp_doc.visibility_scope = 'department' THEN
          IF v_current_emp_id IS NOT NULL THEN
            SELECT department_id INTO v_emp_dept_id FROM public.employees WHERE id = v_current_emp_id;
            RETURN (v_emp_dept_id IS NOT NULL AND v_comp_doc.department_id = v_emp_dept_id);
          END IF;
          RETURN false;
        ELSIF v_comp_doc.visibility_scope = 'subsidiary' THEN
          IF v_current_emp_id IS NOT NULL THEN
            SELECT subsidiary_id INTO v_emp_sub_id FROM public.employees WHERE id = v_current_emp_id;
            RETURN (v_emp_sub_id IS NOT NULL AND v_comp_doc.subsidiary_id = v_emp_sub_id);
          END IF;
          RETURN false;
        ELSIF v_comp_doc.visibility_scope IN ('hr_only', 'confidential', 'restricted') THEN
          RETURN v_is_hr;
        END IF;
      ELSE
        -- Fallback: uploader may access if active
        RETURN (v_file.uploaded_by = auth.uid());
      END IF;

      RETURN false;

    ELSIF p_bucket_id = 'employee-documents' THEN
      IF v_is_hr THEN
        RETURN true;
      END IF;

      -- Check if caller is owner employee or uploader
      IF (v_file.employee_id = v_current_emp_id OR v_file.uploaded_by = auth.uid()) THEN
        -- Check authoritative business entity visibility and lifecycle status
        SELECT * INTO v_emp_doc
        FROM public.employee_documents
        WHERE file_id = v_file.id OR id::text = v_file.entity_id
        LIMIT 1;

        IF FOUND THEN
          -- Archived or inactive documents cannot be self-downloaded by normal employees
          IF v_emp_doc.status IN ('archived', 'inactive') THEN
            RETURN false;
          END IF;

          -- Strictly confidential or HR-only documents cannot be self-downloaded
          IF v_emp_doc.visibility IN ('hr_only', 'restricted')
             OR v_emp_doc.confidentiality IN ('strictly_confidential')
          THEN
            RETURN false;
          END IF;
          RETURN true;
        END IF;

        -- Check metadata fallback if document record not yet inserted
        IF (v_file.metadata->>'visibility') IN ('hr_only', 'restricted') THEN
          RETURN false;
        END IF;

        RETURN true;
      END IF;

      RETURN false;

    ELSIF p_bucket_id = 'expense-receipts' THEN
      IF v_is_finance THEN
        RETURN true;
      END IF;
      -- Claimant employee or uploader can access
      RETURN (v_file.employee_id = v_current_emp_id OR v_file.uploaded_by = auth.uid());

    ELSIF p_bucket_id = 'candidate-cvs' THEN
      RETURN v_is_recruiter;

    ELSIF p_bucket_id = 'job-offers' THEN
      RETURN v_is_recruiter;
    END IF;

  ELSE
    -- Object path pattern fallback when file_objects row is not yet registered
    IF p_bucket_id = 'employee-documents' THEN
      IF v_is_hr THEN
        RETURN true;
      END IF;
      IF v_current_emp_id IS NOT NULL AND p_object_name LIKE 'employees/' || v_current_emp_id::text || '/%' THEN
        RETURN true;
      END IF;
      RETURN false;

    ELSIF p_bucket_id = 'company-documents' THEN
      RETURN true;

    ELSIF p_bucket_id = 'expense-receipts' THEN
      IF v_is_finance THEN
        RETURN true;
      END IF;
      IF v_current_emp_id IS NOT NULL AND p_object_name LIKE 'expenses/' || v_current_emp_id::text || '/%' THEN
        RETURN true;
      END IF;
      RETURN false;

    ELSIF p_bucket_id = 'candidate-cvs' OR p_bucket_id = 'job-offers' THEN
      RETURN v_is_recruiter;
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_storage_object(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_storage_object(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_storage_object(text, text) TO service_role;
