-- ===========================================================================
-- MIGRATION: 20260914050000_harden_storage_integrity_visibility_and_orphan_cleanup.sql
-- Module: Supabase Storage & Secure File Management (Hotfix 2)
--
-- Objectives:
-- 1. Truthful malware status: replace default 'clean' with 'unscanned'.
-- 2. Expand file_objects status: add 'orphaned' and 'cleanup_failed'.
-- 3. Immutability protection: trigger preventing direct mutation of identity/security metadata.
-- 4. Company document visibility: support department, subsidiary, and hr_only scopes.
-- 5. Employee document visibility: support employee_visible vs hr_only / restricted.
-- 6. Verification columns on employee_documents: status, verified_by, verified_at, rejection_reason.
-- 7. Storage UPDATE hardening: read access no longer implies overwrite access.
-- 8. Atomic replacement RPC: finalize_file_replacement().
-- 9. Orphan and archive RPCs: mark_file_orphaned(), archive_file_object().
-- 10. Audit RPC hardening: log_file_download_access() verifies caller authorization.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Update public.file_objects Constraints and Defaults
-- ---------------------------------------------------------------------------

ALTER TABLE public.file_objects
  DROP CONSTRAINT IF EXISTS file_objects_malware_status_check;

ALTER TABLE public.file_objects
  ADD CONSTRAINT file_objects_malware_status_check
  CHECK (malware_status IN ('unscanned', 'pending_scan', 'clean', 'quarantined', 'scan_failed'));

ALTER TABLE public.file_objects
  ALTER COLUMN malware_status SET DEFAULT 'unscanned';

ALTER TABLE public.file_objects
  DROP CONSTRAINT IF EXISTS file_objects_status_check;

ALTER TABLE public.file_objects
  ADD CONSTRAINT file_objects_status_check
  CHECK (status IN ('active', 'archived', 'deleted', 'quarantined', 'orphaned', 'cleanup_failed'));

-- ---------------------------------------------------------------------------
-- STEP 2: Extend Business Tables with Verification & Visibility Columns
-- ---------------------------------------------------------------------------

-- 2.1 employee_documents
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS confidentiality text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'employee_visible',
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS issuing_authority text;

-- 2.2 company_documents
ALTER TABLE public.company_documents
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subsidiary_id uuid REFERENCES public.subsidiaries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_documents_file_id ON public.employee_documents(file_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_file_id ON public.company_documents(file_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_scope ON public.company_documents(visibility_scope, department_id, subsidiary_id);

-- ---------------------------------------------------------------------------
-- STEP 3: Immutability Trigger on public.file_objects
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_protect_file_objects_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypasses trigger for system maintenance
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block mutation of immutable identity fields
  IF NEW.id != OLD.id
     OR NEW.bucket_id != OLD.bucket_id
     OR NEW.object_path != OLD.object_path
     OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
  THEN
    RAISE EXCEPTION 'Modification of file_objects identity fields (id, bucket_id, object_path, uploaded_by, employee_id, company_id) is strictly forbidden' USING ERRCODE = '42501';
  END IF;

  -- Prevent non-HR users from falsely marking files as clean
  IF NEW.malware_status != OLD.malware_status
     AND NEW.malware_status = 'clean'
     AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  THEN
    RAISE EXCEPTION 'Only authorized administrators may attest malware clearance' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_file_objects_identity_protection ON public.file_objects;
CREATE TRIGGER trg_file_objects_identity_protection
  BEFORE UPDATE ON public.file_objects
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_file_objects_identity();

-- ---------------------------------------------------------------------------
-- STEP 4: Metadata-First Authorization Function: can_access_storage_object
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
    -- Inactive, quarantined, or deleted files cannot be downloaded
    IF v_file.status IN ('deleted', 'quarantined', 'orphaned', 'cleanup_failed') THEN
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
        -- Fallback: uploader may access
        RETURN (v_file.uploaded_by = auth.uid());
      END IF;

      RETURN false;

    ELSIF p_bucket_id = 'employee-documents' THEN
      IF v_is_hr THEN
        RETURN true;
      END IF;

      -- Check if caller is owner employee or uploader
      IF (v_file.employee_id = v_current_emp_id OR v_file.uploaded_by = auth.uid()) THEN
        -- Check business entity visibility restriction
        SELECT * INTO v_emp_doc
        FROM public.employee_documents
        WHERE file_id = v_file.id OR id::text = v_file.entity_id
        LIMIT 1;

        IF FOUND THEN
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

    RETURN false;
  END IF;

  -- 4. If metadata is NOT in file_objects:
  -- Read access is strictly denied to prevent accessing uncataloged or orphaned storage objects.
  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 5: Hardened Storage RLS Policies
-- ---------------------------------------------------------------------------

-- 5.1 company-documents SELECT: Enforce business visibility scope
DROP POLICY IF EXISTS "storage_company_docs_select" ON storage.objects;
CREATE POLICY "storage_company_docs_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND public.can_access_storage_object('company-documents', name)
  );

-- 5.2 employee-documents UPDATE: Restrict to HR administrators only
DROP POLICY IF EXISTS "storage_employee_docs_update" ON storage.objects;
CREATE POLICY "storage_employee_docs_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  );

-- 5.3 expense-receipts UPDATE: Restrict to Finance & HR officers only
DROP POLICY IF EXISTS "storage_expense_receipts_update" ON storage.objects;
CREATE POLICY "storage_expense_receipts_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
  );

-- ---------------------------------------------------------------------------
-- STEP 6: Atomic Replacement Saga RPC: finalize_file_replacement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finalize_file_replacement(
  p_previous_file_id uuid,
  p_new_file_id uuid
)
RETURNS public.file_objects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev public.file_objects%ROWTYPE;
  v_new public.file_objects%ROWTYPE;
  v_is_hr boolean;
  v_current_emp_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  v_is_hr := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']);
  v_current_emp_id := public.current_employee_id();

  -- Lock both rows FOR UPDATE
  SELECT * INTO v_prev FROM public.file_objects WHERE id = p_previous_file_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Previous file record not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_new FROM public.file_objects WHERE id = p_new_file_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'New file record not found' USING ERRCODE = 'P0002';
  END IF;

  -- Authorization check
  IF NOT v_is_hr AND v_prev.uploaded_by != auth.uid() AND (v_prev.employee_id IS NULL OR v_prev.employee_id != v_current_emp_id) THEN
    RAISE EXCEPTION 'Not authorized to replace this file' USING ERRCODE = '42501';
  END IF;

  -- Domain integrity check: same bucket and entity type
  IF v_prev.bucket_id != v_new.bucket_id THEN
    RAISE EXCEPTION 'Bucket mismatch during file replacement' USING ERRCODE = '22023';
  END IF;

  IF v_prev.entity_type != v_new.entity_type THEN
    RAISE EXCEPTION 'Entity type mismatch during file replacement' USING ERRCODE = '22023';
  END IF;

  -- 1. Archive previous file
  UPDATE public.file_objects
  SET
    status = 'archived',
    archived_at = now(),
    updated_at = now()
  WHERE id = p_previous_file_id;

  -- 2. Confirm new version active and linked
  UPDATE public.file_objects
  SET
    status = 'active',
    replaces_file_id = p_previous_file_id,
    version = v_prev.version + 1,
    updated_at = now()
  WHERE id = p_new_file_id
  RETURNING * INTO v_new;

  -- 3. Update foreign key references on business tables
  IF v_new.entity_type = 'company_document' THEN
    UPDATE public.company_documents
    SET file_id = v_new.id, file_url = v_new.object_path
    WHERE file_id = p_previous_file_id OR id::text = v_prev.entity_id;
  ELSIF v_new.entity_type = 'employee_document' THEN
    UPDATE public.employee_documents
    SET file_id = v_new.id, file_url = v_new.object_path
    WHERE file_id = p_previous_file_id OR id::text = v_prev.entity_id;
  END IF;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_file_replacement(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_file_replacement(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_file_replacement(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- STEP 7: Archive and Orphan Management RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.archive_file_object(p_file_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file public.file_objects%ROWTYPE;
  v_is_hr boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  v_is_hr := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']);

  SELECT * INTO v_file FROM public.file_objects WHERE id = p_file_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'File not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_is_hr AND v_file.uploaded_by != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to archive this file' USING ERRCODE = '42501';
  END IF;

  UPDATE public.file_objects
  SET status = 'archived', archived_at = now(), updated_at = now()
  WHERE id = p_file_id;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_file_object(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_file_object(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_file_object(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_file_orphaned(
  p_file_id uuid,
  p_reason text DEFAULT 'orphan_rollback'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file public.file_objects%ROWTYPE;
  v_is_hr boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  v_is_hr := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']);

  SELECT * INTO v_file FROM public.file_objects WHERE id = p_file_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_is_hr AND v_file.uploaded_by != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to mark file orphaned' USING ERRCODE = '42501';
  END IF;

  UPDATE public.file_objects
  SET
    status = 'orphaned',
    metadata = jsonb_set(metadata, '{orphan_reason}', to_jsonb(p_reason)),
    updated_at = now()
  WHERE id = p_file_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_file_orphaned(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_file_orphaned(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_file_orphaned(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- STEP 8: Hardened Download Audit Logging RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_file_download_access(
  p_file_id uuid,
  p_access_type text DEFAULT 'download'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file public.file_objects%ROWTYPE;
  v_can_access boolean;
BEGIN
  -- 1. Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- 2. Load file record
  SELECT * INTO v_file FROM public.file_objects WHERE id = p_file_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'File object not found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Authoritative access check before writing audit entry
  v_can_access := public.can_access_storage_object(v_file.bucket_id, v_file.object_path);
  IF NOT v_can_access THEN
    RAISE EXCEPTION 'Access denied to file object' USING ERRCODE = '42501';
  END IF;

  -- 4. Insert audit log event
  INSERT INTO public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    changes_summary
  ) VALUES (
    auth.uid(),
    'FILE_ACCESS_' || UPPER(p_access_type),
    'file_objects',
    p_file_id::text,
    jsonb_build_object(
      'bucket_id', v_file.bucket_id,
      'object_path', v_file.object_path,
      'filename', v_file.original_filename
    )::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_file_download_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_file_download_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_file_download_access(uuid, text) TO service_role;
