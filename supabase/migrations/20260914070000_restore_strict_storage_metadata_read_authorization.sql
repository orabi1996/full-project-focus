-- ============================================================================
-- Migration: 20260914070000_restore_strict_storage_metadata_read_authorization.sql
-- Description: Restore strict metadata-first storage read authorization and enforce
--              authoritative business entity linking across all business buckets.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Replace can_access_storage_object with Strict Metadata-First Validator
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
  v_expense_claim public.expense_claims%ROWTYPE;
  v_candidate public.candidates%ROWTYPE;
  v_job_offer public.job_offers%ROWTYPE;
  v_emp_dept_id uuid;
  v_emp_sub_id uuid;
BEGIN
  -- 1. Service role bypass (system maintenance, asynchronous workers)
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;
  
  -- 2. Unauthenticated callers are strictly denied
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  v_current_emp_id := public.current_employee_id();
  v_is_hr := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']);
  v_is_finance := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'auditor']);
  v_is_recruiter := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'recruiter']);

  -- 3. Query authoritative metadata catalog (TASK 1: STRICT METADATA-FIRST REQUIREMENT)
  SELECT * INTO v_file
  FROM public.file_objects
  WHERE bucket_id = p_bucket_id AND object_path = p_object_name
  LIMIT 1;

  -- If NO matching public.file_objects row exists: STRICTLY DENY READ ACCESS!
  -- Path-based fallbacks or unauthenticated bypasses are prohibited.
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 4. Status Enforcement on file_objects (TASK 4)
  -- Quarantined, deleted, orphaned, or cleanup_failed files are NEVER downloadable
  IF v_file.status IN ('deleted', 'quarantined', 'orphaned', 'cleanup_failed') THEN
    RETURN false;
  END IF;

  -- Archived files: only HR/admins retain audit/historical access
  IF v_file.status = 'archived' AND NOT v_is_hr THEN
    RETURN false;
  END IF;

  -- 5. Bucket-specific authoritative business entity verification (TASKS 3, 5, 6, 7)

  -- -------------------------------------------------------------------------
  -- BUCKET 1: company-documents (TASKS 3 & 5)
  -- -------------------------------------------------------------------------
  IF p_bucket_id = 'company-documents' THEN
    -- Authoritative company document entity MUST exist
    SELECT * INTO v_comp_doc
    FROM public.company_documents
    WHERE file_id = v_file.id OR id::text = v_file.entity_id
    LIMIT 1;

    -- Transient/unattached file without business entity is denied
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    -- Archived or inactive documents: only HR retains audit access
    IF v_comp_doc.status IN ('archived', 'inactive') THEN
      RETURN v_is_hr;
    END IF;

    -- HR and system admins have full access to active company documents
    IF v_is_hr THEN
      RETURN true;
    END IF;

    -- Enforce visibility scope for non-HR employees
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
      RETURN false;
    END IF;

    RETURN false;

  -- -------------------------------------------------------------------------
  -- BUCKET 2: employee-documents (TASKS 3 & 6)
  -- -------------------------------------------------------------------------
  ELSIF p_bucket_id = 'employee-documents' THEN
    -- Authoritative employee document entity MUST exist
    SELECT * INTO v_emp_doc
    FROM public.employee_documents
    WHERE file_id = v_file.id OR id::text = v_file.entity_id
    LIMIT 1;

    -- Transient/unattached file without business entity is denied
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    -- HR and system admins have access to active documents
    IF v_is_hr THEN
      RETURN true;
    END IF;

    -- Regular employee: must be the owner employee
    IF (v_file.employee_id = v_current_emp_id OR v_emp_doc.employee_id = v_current_emp_id) THEN
      -- Archived or inactive documents cannot be self-downloaded by regular employees
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

    RETURN false;

  -- -------------------------------------------------------------------------
  -- BUCKET 3: expense-receipts (TASKS 3 & 7)
  -- -------------------------------------------------------------------------
  ELSIF p_bucket_id = 'expense-receipts' THEN
    -- Authoritative expense claim entity MUST exist
    SELECT * INTO v_expense_claim
    FROM public.expense_claims
    WHERE receipt_file_id = v_file.id OR id::text = v_file.entity_id
    LIMIT 1;

    -- Transient/unattached receipt without business entity is denied
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    -- Finance officers, auditors, and HR managers have access to valid claim receipts
    IF v_is_finance THEN
      RETURN true;
    END IF;

    -- Claimant employee has access to their own expense receipt
    IF (v_expense_claim.employee_id = v_current_emp_id OR v_file.employee_id = v_current_emp_id) THEN
      RETURN true;
    END IF;

    RETURN false;

  -- -------------------------------------------------------------------------
  -- BUCKET 4: candidate-cvs (TASKS 3 & 7)
  -- -------------------------------------------------------------------------
  ELSIF p_bucket_id = 'candidate-cvs' THEN
    -- Authoritative candidate entity MUST exist
    SELECT * INTO v_candidate
    FROM public.candidates
    WHERE cv_file_id = v_file.id OR id::text = v_file.entity_id
    LIMIT 1;

    -- Transient/unattached CV without candidate entity is denied
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    -- Only authorized recruiter / HR can read candidate CVs
    RETURN v_is_recruiter;

  -- -------------------------------------------------------------------------
  -- BUCKET 5: job-offers (TASKS 3 & 7)
  -- -------------------------------------------------------------------------
  ELSIF p_bucket_id = 'job-offers' THEN
    -- Authoritative job offer entity MUST exist
    SELECT * INTO v_job_offer
    FROM public.job_offers
    WHERE offer_file_id = v_file.id OR id::text = v_file.entity_id
    LIMIT 1;

    -- Transient/unattached offer document without job offer entity is denied
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    -- Only authorized recruiter / HR can read job offer documents
    RETURN v_is_recruiter;

  END IF;

  -- Default deny for unrecognized buckets
  RETURN false;
END;
$$;

-- Explicitly revoke from PUBLIC and grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.can_access_storage_object(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_storage_object(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_storage_object(text, text) TO service_role;
