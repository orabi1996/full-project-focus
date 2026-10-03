-- ============================================================================
-- PROMPT 21: PRODUCTION ASSET MANAGEMENT, DOCUMENT VAULT & OFFICIAL DOCUMENT ENGINE
-- ============================================================================
-- Extends hardware_assets, company_documents, employee_documents, document_acknowledgements
-- Creates official_document_references and asset_custody_history tables
-- Defines atomic RPCs: assign_asset_atomic, return_asset_atomic, create_asset_atomic,
-- generate_official_document_reference, publish_company_document_atomic, check_asset_clearance_block
-- Enforces strict RLS and audit trails.
-- ============================================================================

-- 1. Extend hardware_assets with enterprise asset lifecycle columns
ALTER TABLE public.hardware_assets
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS acquisition_date date,
  ADD COLUMN IF NOT EXISTS purchase_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS assigned_to_employee_name text;

-- 2. Extend company_documents with publishing and version control columns
ALTER TABLE public.company_documents
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS doc_state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS description_ar text,
  ADD COLUMN IF NOT EXISTS file_id text,
  ADD COLUMN IF NOT EXISTS file_size text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.company_documents(id) ON DELETE SET NULL;

-- 3. Extend employee_documents with metadata and verification columns
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS doc_type text,
  ADD COLUMN IF NOT EXISTS doc_number text,
  ADD COLUMN IF NOT EXISTS issued_at date,
  ADD COLUMN IF NOT EXISTS expires_at date,
  ADD COLUMN IF NOT EXISTS file_id text,
  ADD COLUMN IF NOT EXISTS file_size text,
  ADD COLUMN IF NOT EXISTS confidentiality text NOT NULL DEFAULT 'confidential',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'employee_visible',
  ADD COLUMN IF NOT EXISTS issuing_authority text,
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS notes text;

-- 4. Extend document_acknowledgements with version and audit columns
ALTER TABLE public.document_acknowledgements
  ADD COLUMN IF NOT EXISTS document_version text,
  ADD COLUMN IF NOT EXISTS ip_address text;

-- 5. Create official_document_references table
CREATE TABLE IF NOT EXISTS public.official_document_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reference_number text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS official_doc_refs_reference_unique 
  ON public.official_document_references(company_id, reference_number);

-- 6. Create asset_custody_history table (append-only custody ledger)
CREATE TABLE IF NOT EXISTS public.asset_custody_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.hardware_assets(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'registered', 'assigned', 'returned', 'maintenance', 'retired'
  action_date date NOT NULL DEFAULT CURRENT_DATE,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Constraints for state integrity
ALTER TABLE public.hardware_assets
  DROP CONSTRAINT IF EXISTS hardware_assets_lifecycle_check;
ALTER TABLE public.hardware_assets
  ADD CONSTRAINT hardware_assets_lifecycle_check
    CHECK (lifecycle_state IN ('available', 'assigned', 'under_maintenance', 'retired', 'lost'));

ALTER TABLE public.company_documents
  DROP CONSTRAINT IF EXISTS company_docs_state_check;
ALTER TABLE public.company_documents
  ADD CONSTRAINT company_docs_state_check
    CHECK (doc_state IN ('draft', 'published', 'superseded', 'archived'));

-- 8. Enable Row Level Security on new tables
ALTER TABLE public.official_document_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_custody_history ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
DROP POLICY IF EXISTS "official_doc_refs_company" ON public.official_document_references;
CREATE POLICY "official_doc_refs_company" ON public.official_document_references
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT e.company_id FROM public.employees e 
      WHERE e.id = public.current_employee_id()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT e.company_id FROM public.employees e 
      WHERE e.id = public.current_employee_id()
    )
  );

DROP POLICY IF EXISTS "asset_custody_history_read" ON public.asset_custody_history;
CREATE POLICY "asset_custody_history_read" ON public.asset_custody_history
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT e.company_id FROM public.employees e 
      WHERE e.id = public.current_employee_id()
    )
  );

DROP POLICY IF EXISTS "asset_custody_history_write" ON public.asset_custody_history;
CREATE POLICY "asset_custody_history_write" ON public.asset_custody_history
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT e.company_id FROM public.employees e 
      WHERE e.id = public.current_employee_id()
    )
  );

-- 10. Atomic RPC: assign_asset_atomic
CREATE OR REPLACE FUNCTION public.assign_asset_atomic(
  p_asset_id uuid,
  p_employee_id uuid,
  p_condition text DEFAULT 'good'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset public.hardware_assets%ROWTYPE;
  v_caller uuid;
  v_emp_name text;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_asset FROM public.hardware_assets WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_asset.lifecycle_state NOT IN ('available') THEN
    RAISE EXCEPTION 'Asset is not available for assignment (current state: %)', v_asset.lifecycle_state USING ERRCODE = '22023';
  END IF;
  IF v_asset.assigned_to_employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'Asset is already assigned to another employee' USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(first_name_ar || ' ' || last_name_ar, full_name, 'موظف')
  INTO v_emp_name
  FROM public.employees
  WHERE id = p_employee_id;

  UPDATE public.hardware_assets
  SET lifecycle_state = 'assigned',
      status = 'assigned',
      assigned_to_employee_id = p_employee_id,
      assigned_to_employee_name = v_emp_name,
      assigned_date = CURRENT_DATE,
      condition = COALESCE(p_condition, condition)
  WHERE id = p_asset_id;

  INSERT INTO public.asset_assignments(asset_id, employee_id, assigned_by, condition_on_assign)
  VALUES (p_asset_id, p_employee_id, v_caller, p_condition);

  INSERT INTO public.asset_custody_history(asset_id, company_id, employee_id, action, performed_by, notes)
  VALUES (p_asset_id, v_asset.company_id, p_employee_id, 'assigned', v_caller, 'حالة التسليم: ' || COALESCE(p_condition, 'good'));

  RETURN jsonb_build_object(
    'ok', true,
    'asset_id', p_asset_id,
    'employee_id', p_employee_id,
    'employee_name', v_emp_name,
    'assigned_date', CURRENT_DATE
  );
END;
$$;
REVOKE ALL ON FUNCTION public.assign_asset_atomic(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_asset_atomic(uuid, uuid, text) TO authenticated, service_role;

-- 11. Atomic RPC: return_asset_atomic
CREATE OR REPLACE FUNCTION public.return_asset_atomic(
  p_asset_id uuid,
  p_condition text DEFAULT 'good'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset public.hardware_assets%ROWTYPE;
  v_caller uuid;
  v_prev_emp uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_asset FROM public.hardware_assets WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset not found' USING ERRCODE = 'P0002';
  END IF;

  v_prev_emp := v_asset.assigned_to_employee_id;

  UPDATE public.hardware_assets
  SET lifecycle_state = 'available',
      status = 'available',
      assigned_to_employee_id = NULL,
      assigned_to_employee_name = NULL,
      assigned_date = NULL,
      condition = COALESCE(p_condition, condition)
  WHERE id = p_asset_id;

  UPDATE public.asset_assignments
  SET returned_at = now(),
      condition_on_return = p_condition
  WHERE asset_id = p_asset_id AND returned_at IS NULL;

  INSERT INTO public.asset_custody_history(asset_id, company_id, employee_id, action, performed_by, notes)
  VALUES (p_asset_id, v_asset.company_id, v_prev_emp, 'returned', v_caller, 'حالة الإرجاع: ' || COALESCE(p_condition, 'good'));

  RETURN jsonb_build_object(
    'ok', true,
    'asset_id', p_asset_id,
    'previous_employee_id', v_prev_emp
  );
END;
$$;
REVOKE ALL ON FUNCTION public.return_asset_atomic(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.return_asset_atomic(uuid, text) TO authenticated, service_role;

-- 12. Atomic RPC: create_asset_atomic
CREATE OR REPLACE FUNCTION public.create_asset_atomic(
  p_company_id uuid,
  p_name_ar text,
  p_name_en text,
  p_category text,
  p_serial_number text,
  p_asset_tag text,
  p_acquisition_date date DEFAULT NULL,
  p_purchase_value numeric DEFAULT NULL,
  p_condition text DEFAULT 'good',
  p_location text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_serial_number IS NULL OR trim(p_serial_number) = '' THEN
    RAISE EXCEPTION 'Serial number is required' USING ERRCODE = '22023';
  END IF;
  IF p_asset_tag IS NULL OR trim(p_asset_tag) = '' THEN
    RAISE EXCEPTION 'Asset tag is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.hardware_assets(
    company_id, name_ar, name_en, category, serial_number, asset_tag,
    acquisition_date, purchase_value, condition, location, notes,
    lifecycle_state, status
  ) VALUES (
    p_company_id, p_name_ar, p_name_en, p_category, trim(p_serial_number), trim(p_asset_tag),
    p_acquisition_date, p_purchase_value, COALESCE(p_condition, 'good'), p_location, p_notes,
    'available', 'available'
  )
  RETURNING id INTO v_id;

  INSERT INTO public.asset_custody_history(asset_id, company_id, action, performed_by, notes)
  VALUES (v_id, p_company_id, 'registered', v_caller, 'تسجيل أصل جديد في النظام');

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'asset_tag', trim(p_asset_tag));
END;
$$;
REVOKE ALL ON FUNCTION public.create_asset_atomic(uuid, text, text, text, text, text, date, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_asset_atomic(uuid, text, text, text, text, text, date, numeric, text, text, text) TO authenticated, service_role;

-- 13. Atomic RPC: generate_official_document_reference
CREATE OR REPLACE FUNCTION public.generate_official_document_reference(
  p_company_id uuid,
  p_doc_type text,
  p_employee_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
  v_year text;
  v_ref text;
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_year := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(CAST(SPLIT_PART(reference_number, '-', 3) AS integer)), 0) + 1
  INTO v_seq
  FROM public.official_document_references
  WHERE company_id = p_company_id
    AND reference_number LIKE 'DOC-' || v_year || '-%';

  v_ref := 'DOC-' || v_year || '-' || LPAD(v_seq::text, 6, '0');

  INSERT INTO public.official_document_references(
    company_id, doc_type, employee_id, reference_number, issued_by
  ) VALUES (
    p_company_id, p_doc_type, p_employee_id, v_ref, v_caller
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reference_number', v_ref,
    'year', v_year,
    'sequence', v_seq
  );
END;
$$;
REVOKE ALL ON FUNCTION public.generate_official_document_reference(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_official_document_reference(uuid, text, uuid) TO authenticated, service_role;

-- 14. Atomic RPC: publish_company_document_atomic
CREATE OR REPLACE FUNCTION public.publish_company_document_atomic(
  p_doc_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc public.company_documents%ROWTYPE;
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_doc FROM public.company_documents WHERE id = p_doc_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_doc.doc_state = 'published' THEN
    RAISE EXCEPTION 'Document is already published' USING ERRCODE = '22023';
  END IF;

  UPDATE public.company_documents
  SET doc_state = 'published',
      status = 'active',
      approved_by = v_caller,
      approved_at = now()
  WHERE id = p_doc_id;

  RETURN jsonb_build_object('ok', true, 'doc_id', p_doc_id, 'doc_state', 'published');
END;
$$;
REVOKE ALL ON FUNCTION public.publish_company_document_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_company_document_atomic(uuid) TO authenticated, service_role;

-- 15. Atomic RPC: check_asset_clearance_block
CREATE OR REPLACE FUNCTION public.check_asset_clearance_block(
  p_employee_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.hardware_assets
  WHERE assigned_to_employee_id = p_employee_id
    AND lifecycle_state = 'assigned';

  RETURN jsonb_build_object(
    'ok', true,
    'employee_id', p_employee_id,
    'assigned_asset_count', v_count,
    'blocks_clearance', v_count > 0
  );
END;
$$;
REVOKE ALL ON FUNCTION public.check_asset_clearance_block(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_asset_clearance_block(uuid) TO authenticated, service_role;

-- 16. Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_document_references TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_custody_history TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hardware_assets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_acknowledgements TO authenticated, service_role;
