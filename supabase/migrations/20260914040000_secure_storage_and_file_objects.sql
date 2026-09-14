-- =============================================================================
-- Migration: 20260914040000_secure_storage_and_file_objects.sql
-- Purpose:   Production Supabase Storage & Secure File Management Architecture.
--
-- WHAT THIS MIGRATION DOES:
-- 1. Provisions 5 private buckets in storage.buckets with strict MIME and size limits.
-- 2. Creates the authoritative public.file_objects metadata table with full RLS.
-- 3. Links domain tables (employee_documents, company_documents, expense_claims,
--    candidates, job_offers) to public.file_objects via file_id foreign keys.
-- 4. Creates security definer access validator public.can_access_storage_object.
-- 5. Configures strict, fine-grained RLS policies on storage.objects for each bucket.
-- 6. Creates file download audit logging RPC public.log_file_download_access.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Provision 5 Strictly Private Storage Buckets
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'employee-documents',
    'employee-documents',
    false,
    15728640, -- 15 MB
    ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]
  ),
  (
    'company-documents',
    'company-documents',
    false,
    26214400, -- 25 MB
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'expense-receipts',
    'expense-receipts',
    false,
    10485760, -- 10 MB
    ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]
  ),
  (
    'candidate-cvs',
    'candidate-cvs',
    false,
    15728640, -- 15 MB
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'job-offers',
    'job-offers',
    false,
    10485760, -- 10 MB
    ARRAY[
      'application/pdf'
    ]
  )
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- STEP 2: Create Authoritative public.file_objects Metadata Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.file_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  original_filename text NOT NULL,
  safe_filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256 text,
  entity_type text NOT NULL,
  entity_id text,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted', 'quarantined')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  replaces_file_id uuid REFERENCES public.file_objects(id) ON DELETE SET NULL,
  archived_at timestamptz,
  deleted_at timestamptz,
  malware_status text NOT NULL DEFAULT 'clean' CHECK (malware_status IN ('clean', 'pending_scan', 'quarantined', 'scan_failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_bucket_path UNIQUE (bucket_id, object_path)
);

-- Indexes for lookup and filtering
CREATE INDEX IF NOT EXISTS idx_file_objects_bucket_path ON public.file_objects (bucket_id, object_path);
CREATE INDEX IF NOT EXISTS idx_file_objects_entity ON public.file_objects (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_objects_employee ON public.file_objects (employee_id);
CREATE INDEX IF NOT EXISTS idx_file_objects_status ON public.file_objects (status);
CREATE INDEX IF NOT EXISTS idx_file_objects_uploaded_by ON public.file_objects (uploaded_by);

-- Enable RLS
ALTER TABLE public.file_objects ENABLE ROW LEVEL SECURITY;

-- Grants
REVOKE ALL ON public.file_objects FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_objects TO authenticated;
GRANT ALL ON public.file_objects TO service_role;

-- ---------------------------------------------------------------------------
-- STEP 3: Link Domain Tables to public.file_objects
-- ---------------------------------------------------------------------------

-- Employee Documents
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES public.file_objects(id) ON DELETE SET NULL;
ALTER TABLE public.employee_documents
  ALTER COLUMN file_url DROP NOT NULL;

-- Company Documents
ALTER TABLE public.company_documents
  ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES public.file_objects(id) ON DELETE SET NULL;
ALTER TABLE public.company_documents
  ALTER COLUMN file_url DROP NOT NULL;

-- Expense Claims
ALTER TABLE public.expense_claims
  ADD COLUMN IF NOT EXISTS receipt_file_id uuid REFERENCES public.file_objects(id) ON DELETE SET NULL;

-- Candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS cv_file_id uuid REFERENCES public.file_objects(id) ON DELETE SET NULL;

-- Job Offers
ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS offer_file_id uuid REFERENCES public.file_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_file_url text;

-- ---------------------------------------------------------------------------
-- STEP 4: Access Validator Function public.can_access_storage_object
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
BEGIN
  -- Service role bypasses RLS
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;
  
  -- Unauthenticated callers are denied
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  v_current_emp_id := public.current_employee_id();
  v_is_hr := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']);
  v_is_finance := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'auditor']);
  v_is_recruiter := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'recruiter']);

  IF p_bucket_id = 'company-documents' THEN
    -- All authenticated users can read company documents
    RETURN true;

  ELSIF p_bucket_id = 'employee-documents' THEN
    IF v_is_hr THEN
      RETURN true;
    END IF;
    -- Path prefix match for the logged in employee
    IF v_current_emp_id IS NOT NULL AND p_object_name LIKE ('employees/' || v_current_emp_id::text || '/%') THEN
      RETURN true;
    END IF;
    -- Metadata catalog check
    SELECT * INTO v_file FROM public.file_objects WHERE bucket_id = p_bucket_id AND object_path = p_object_name LIMIT 1;
    IF FOUND AND (v_file.employee_id = v_current_emp_id OR v_file.uploaded_by = auth.uid()) THEN
      RETURN true;
    END IF;
    RETURN false;

  ELSIF p_bucket_id = 'expense-receipts' THEN
    IF v_is_finance THEN
      RETURN true;
    END IF;
    -- Path prefix match for the logged in employee
    IF v_current_emp_id IS NOT NULL AND p_object_name LIKE ('expenses/' || v_current_emp_id::text || '/%') THEN
      RETURN true;
    END IF;
    -- Metadata catalog check
    SELECT * INTO v_file FROM public.file_objects WHERE bucket_id = p_bucket_id AND object_path = p_object_name LIMIT 1;
    IF FOUND AND (v_file.employee_id = v_current_emp_id OR v_file.uploaded_by = auth.uid()) THEN
      RETURN true;
    END IF;
    RETURN false;

  ELSIF p_bucket_id = 'candidate-cvs' THEN
    RETURN v_is_recruiter;

  ELSIF p_bucket_id = 'job-offers' THEN
    RETURN v_is_recruiter;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_storage_object(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_storage_object(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- STEP 5: RLS Policies for public.file_objects
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "file_objects_select" ON public.file_objects;
CREATE POLICY "file_objects_select"
  ON public.file_objects FOR SELECT TO authenticated
  USING (
    public.can_access_storage_object(bucket_id, object_path)
  );

DROP POLICY IF EXISTS "file_objects_insert" ON public.file_objects;
CREATE POLICY "file_objects_insert"
  ON public.file_objects FOR INSERT TO authenticated
  WITH CHECK (
    -- employee-documents: owner employee or HR
    (
      bucket_id = 'employee-documents'
      AND (
        employee_id = public.current_employee_id()
        OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
      )
    )
    OR
    -- expense-receipts: claimant employee or Finance/HR
    (
      bucket_id = 'expense-receipts'
      AND (
        employee_id = public.current_employee_id()
        OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
      )
    )
    OR
    -- candidate-cvs & job-offers: recruitment staff only
    (
      bucket_id IN ('candidate-cvs', 'job-offers')
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'recruiter'])
    )
    OR
    -- company-documents: HR management only
    (
      bucket_id = 'company-documents'
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    )
  );

DROP POLICY IF EXISTS "file_objects_update" ON public.file_objects;
CREATE POLICY "file_objects_update"
  ON public.file_objects FOR UPDATE TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    OR (uploaded_by = auth.uid() AND employee_id = public.current_employee_id())
  )
  WITH CHECK (
    public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    OR (uploaded_by = auth.uid() AND employee_id = public.current_employee_id())
  );

DROP POLICY IF EXISTS "file_objects_delete" ON public.file_objects;
CREATE POLICY "file_objects_delete"
  ON public.file_objects FOR DELETE TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  );

-- ---------------------------------------------------------------------------
-- STEP 6: Fine-Grained Storage RLS Policies on storage.objects
-- ---------------------------------------------------------------------------

-- Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 6.1 employee-documents
DROP POLICY IF EXISTS "storage_employee_docs_select" ON storage.objects;
CREATE POLICY "storage_employee_docs_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND public.can_access_storage_object('employee-documents', name)
  );

DROP POLICY IF EXISTS "storage_employee_docs_insert" ON storage.objects;
CREATE POLICY "storage_employee_docs_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
      OR (public.current_employee_id() IS NOT NULL AND name LIKE ('employees/' || public.current_employee_id()::text || '/%'))
    )
  );

DROP POLICY IF EXISTS "storage_employee_docs_update" ON storage.objects;
CREATE POLICY "storage_employee_docs_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND public.can_access_storage_object('employee-documents', name)
  );

DROP POLICY IF EXISTS "storage_employee_docs_delete" ON storage.objects;
CREATE POLICY "storage_employee_docs_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
      OR (public.current_employee_id() IS NOT NULL AND name LIKE ('employees/' || public.current_employee_id()::text || '/%'))
    )
  );

-- 6.2 company-documents
DROP POLICY IF EXISTS "storage_company_docs_select" ON storage.objects;
CREATE POLICY "storage_company_docs_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "storage_company_docs_insert" ON storage.objects;
CREATE POLICY "storage_company_docs_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-documents'
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  );

DROP POLICY IF EXISTS "storage_company_docs_update" ON storage.objects;
CREATE POLICY "storage_company_docs_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  );

DROP POLICY IF EXISTS "storage_company_docs_delete" ON storage.objects;
CREATE POLICY "storage_company_docs_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  );

-- 6.3 expense-receipts
DROP POLICY IF EXISTS "storage_expense_receipts_select" ON storage.objects;
CREATE POLICY "storage_expense_receipts_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND public.can_access_storage_object('expense-receipts', name)
  );

DROP POLICY IF EXISTS "storage_expense_receipts_insert" ON storage.objects;
CREATE POLICY "storage_expense_receipts_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
      OR (public.current_employee_id() IS NOT NULL AND name LIKE ('expenses/' || public.current_employee_id()::text || '/%'))
    )
  );

DROP POLICY IF EXISTS "storage_expense_receipts_update" ON storage.objects;
CREATE POLICY "storage_expense_receipts_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND public.can_access_storage_object('expense-receipts', name)
  );

DROP POLICY IF EXISTS "storage_expense_receipts_delete" ON storage.objects;
CREATE POLICY "storage_expense_receipts_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
      OR (public.current_employee_id() IS NOT NULL AND name LIKE ('expenses/' || public.current_employee_id()::text || '/%'))
    )
  );

-- 6.4 candidate-cvs
DROP POLICY IF EXISTS "storage_candidate_cvs_select" ON storage.objects;
CREATE POLICY "storage_candidate_cvs_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'candidate-cvs'
    AND public.can_access_storage_object('candidate-cvs', name)
  );

DROP POLICY IF EXISTS "storage_candidate_cvs_insert" ON storage.objects;
CREATE POLICY "storage_candidate_cvs_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'candidate-cvs'
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'recruiter'])
  );

DROP POLICY IF EXISTS "storage_candidate_cvs_delete" ON storage.objects;
CREATE POLICY "storage_candidate_cvs_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'candidate-cvs'
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'recruiter'])
  );

-- 6.5 job-offers
DROP POLICY IF EXISTS "storage_job_offers_select" ON storage.objects;
CREATE POLICY "storage_job_offers_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-offers'
    AND public.can_access_storage_object('job-offers', name)
  );

DROP POLICY IF EXISTS "storage_job_offers_insert" ON storage.objects;
CREATE POLICY "storage_job_offers_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job-offers'
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'recruiter'])
  );

DROP POLICY IF EXISTS "storage_job_offers_delete" ON storage.objects;
CREATE POLICY "storage_job_offers_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'job-offers'
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'recruiter'])
  );

-- ---------------------------------------------------------------------------
-- STEP 7: Audit Logging RPC for File Download/Access
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
BEGIN
  SELECT * INTO v_file FROM public.file_objects WHERE id = p_file_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.log_file_download_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_file_download_access(uuid, text) TO service_role;
