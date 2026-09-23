-- ===========================================================================
-- Migration: 20260914120000_production_employee_master_and_lifecycle.sql
-- Production Employee Master Data, Lifecycle Transitions, Contract History,
-- Multi-Tenant Relationship Enforcement, and Secure Avatar Storage
-- ===========================================================================

-- Helper function for tenant resolution
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- 1. Try JWT claim if present
  BEGIN
    v_company_id := (COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'company_id', ''))::uuid;
    IF v_company_id IS NOT NULL THEN
      RETURN v_company_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 2. Try employee record for authenticated user
  IF auth.uid() IS NOT NULL THEN
    SELECT company_id INTO v_company_id
    FROM public.employees
    WHERE user_id = auth.uid() AND company_id IS NOT NULL
    LIMIT 1;

    IF v_company_id IS NOT NULL THEN
      RETURN v_company_id;
    END IF;
  END IF;

  -- 3. Fallback to first company in database
  SELECT id INTO v_company_id FROM public.companies ORDER BY created_at ASC LIMIT 1;
  RETURN v_company_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated, anon, service_role;

-- 1. Extend employee_status ENUM with application lifecycle states
ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'preboarding';
ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'probation';

-- 2. Extend public.employees with Authoritative Lifecycle, Termination, and Compensation Fields
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS termination_date date,
  ADD COLUMN IF NOT EXISTS last_working_date date,
  ADD COLUMN IF NOT EXISTS termination_reason text,
  ADD COLUMN IF NOT EXISTS termination_type text,
  ADD COLUMN IF NOT EXISTS rehire_date date,
  ADD COLUMN IF NOT EXISTS national_id_expiry date,
  ADD COLUMN IF NOT EXISTS passport_no text,
  ADD COLUMN IF NOT EXISTS passport_expiry date,
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS dependents_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_grade text,
  ADD COLUMN IF NOT EXISTS work_type text NOT NULL DEFAULT 'on_site',
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS qiwa_contract_no text,
  ADD COLUMN IF NOT EXISTS housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowances numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS gosi_number text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3. Company-Scoped Unique Employee Number Index
-- Drop old global constraint if it exists and replace with company-scoped uniqueness
DO $$
BEGIN
  ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_employee_no_key;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS employees_company_employee_no_idx
  ON public.employees(company_id, employee_no)
  WHERE company_id IS NOT NULL;

-- Sequence generator helper for company-scoped employee numbers
CREATE OR REPLACE FUNCTION public.generate_company_employee_no(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_new_no text;
  v_exists boolean;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.employees
  WHERE company_id = p_company_id;

  LOOP
    v_count := v_count + 1;
    v_new_no := 'EMP-' || lpad(v_count::text, 6, '0');
    SELECT EXISTS(
      SELECT 1 FROM public.employees
      WHERE company_id = p_company_id AND employee_no = v_new_no
    ) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_new_no;
    END IF;
  END LOOP;
END;
$$;

-- 4. Employee Contracts Master Data Table
CREATE TABLE IF NOT EXISTS public.employee_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_number text,
  contract_type text NOT NULL DEFAULT 'full_time',
  contract_status text NOT NULL DEFAULT 'active',
  start_date date NOT NULL,
  end_date date,
  probation_end_date date,
  document_id uuid REFERENCES public.file_objects(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emp_contracts_emp_idx ON public.employee_contracts(employee_id);
CREATE INDEX IF NOT EXISTS emp_contracts_company_idx ON public.employee_contracts(company_id);
CREATE INDEX IF NOT EXISTS emp_contracts_status_idx ON public.employee_contracts(contract_status);

ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_company_read" ON public.employee_contracts;
CREATE POLICY "contracts_company_read" ON public.employee_contracts
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      employee_id = public.current_employee_id()
      OR public.current_user_can_manage_company(company_id)
      OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'auditor'])
    )
  );

DROP POLICY IF EXISTS "contracts_manage_write" ON public.employee_contracts;
CREATE POLICY "contracts_manage_write" ON public.employee_contracts
  FOR ALL TO authenticated
  USING (public.current_user_can_manage_company(company_id))
  WITH CHECK (public.current_user_can_manage_company(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_contracts TO authenticated;
GRANT ALL ON public.employee_contracts TO service_role;

-- 5. Extend employee_assignment_history from Prompt 08
ALTER TABLE public.employee_assignment_history
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS contract_type text;

-- 6. Trigger: Strict Cross-Company and Manager Relationship Validation
CREATE OR REPLACE FUNCTION public.validate_employee_relationships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dept_company_id uuid;
  v_sub_company_id uuid;
  v_loc_company_id uuid;
  v_pos_company_id uuid;
  v_cc_company_id uuid;
  v_mgr RECORD;
  v_curr_mgr_id uuid;
  v_depth integer := 0;
BEGIN
  -- 1. Company ID must be set
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد الشركة التابع لها الموظف (company_id إلزامي).';
  END IF;

  -- 2. Validate Department
  IF NEW.department_id IS NOT NULL THEN
    SELECT company_id INTO v_dept_company_id
    FROM public.departments
    WHERE id = NEW.department_id AND status <> 'archived';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الإدارة المحددة غير موجودة أو مؤرشفة.';
    END IF;
    IF v_dept_company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'لا يمكن ربط موظف بإدارة تابعة لشركة أخرى.';
    END IF;
  END IF;

  -- 3. Validate Subsidiary
  IF NEW.subsidiary_id IS NOT NULL THEN
    SELECT company_id INTO v_sub_company_id
    FROM public.subsidiaries
    WHERE id = NEW.subsidiary_id AND status <> 'archived';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الشركة التابعة المحددة غير موجودة أو مؤرشفة.';
    END IF;
    IF v_sub_company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'الشركة التابعة لا تنتمي لنفس شركة الموظف.';
    END IF;
  END IF;

  -- 4. Validate Work Location
  IF NEW.work_location_id IS NOT NULL THEN
    SELECT company_id INTO v_loc_company_id
    FROM public.work_locations
    WHERE id = NEW.work_location_id AND status <> 'archived';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'موقع العمل المحدد غير موجود أو مؤرشف.';
    END IF;
    IF v_loc_company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'موقع العمل لا ينتمي لنفس شركة الموظف.';
    END IF;
  END IF;

  -- 5. Validate Job Position
  IF NEW.job_position_id IS NOT NULL THEN
    SELECT company_id INTO v_pos_company_id
    FROM public.job_positions
    WHERE id = NEW.job_position_id AND status <> 'archived';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'المسمى الوظيفي المحدد غير موجود أو مؤرشف.';
    END IF;
    IF v_pos_company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'المسمى الوظيفي لا ينتمي لنفس شركة الموظف.';
    END IF;
  END IF;

  -- 6. Validate Cost Center
  IF NEW.cost_center_id IS NOT NULL THEN
    SELECT company_id INTO v_cc_company_id
    FROM public.cost_centers
    WHERE id = NEW.cost_center_id AND status <> 'archived';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'مركز التكلفة المحدد غير موجود أو مؤرشف.';
    END IF;
    IF v_cc_company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'مركز التكلفة لا ينتمي لنفس شركة الموظف.';
    END IF;
  END IF;

  -- 7. Validate Manager
  IF NEW.manager_id IS NOT NULL THEN
    IF NEW.id IS NOT NULL AND NEW.manager_id = NEW.id THEN
      RAISE EXCEPTION 'لا يمكن للموظف أن يكون مديراً مباشراً لنفسه.';
    END IF;

    SELECT id, company_id, status INTO v_mgr
    FROM public.employees
    WHERE id = NEW.manager_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'المدير المباشر المحدد غير موجود.';
    END IF;
    IF v_mgr.company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'المدير المباشر يجب أن يتبع نفس الشركة.';
    END IF;
    IF v_mgr.status = 'terminated' THEN
      RAISE EXCEPTION 'لا يمكن تعيين موظف منتهية خدمته كمدير مباشر.';
    END IF;

    -- Cycle Prevention (traverse up to 20 levels)
    IF NEW.id IS NOT NULL THEN
      v_curr_mgr_id := NEW.manager_id;
      WHILE v_curr_mgr_id IS NOT NULL AND v_depth < 20 LOOP
        v_depth := v_depth + 1;
        IF v_curr_mgr_id = NEW.id THEN
          RAISE EXCEPTION 'تعذر تعيين المدير: تم اكتشاف حلقة تبعية إدارية دائرية.';
        END IF;

        SELECT manager_id INTO v_curr_mgr_id
        FROM public.employees
        WHERE id = v_curr_mgr_id;
      END LOOP;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_employee_relationships ON public.employees;
CREATE TRIGGER trg_validate_employee_relationships
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_employee_relationships();

-- 7. Lifecycle Status Transition RPC
CREATE OR REPLACE FUNCTION public.change_employee_status(
  p_employee_id uuid,
  p_new_status text,
  p_effective_date date DEFAULT current_date,
  p_reason text DEFAULT NULL,
  p_termination_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp RECORD;
  v_user_id uuid := auth.uid();
  v_allowed boolean := false;
BEGIN
  -- 1. Fetch employee
  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود.';
  END IF;

  -- 2. Tenant Authorization
  IF NOT public.current_user_can_manage_company(v_emp.company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل حالة موظف خارج نطاق شركتك.';
  END IF;

  -- 3. Validate Transition Matrix
  -- draft -> preboarding, probation, active, terminated
  -- preboarding -> probation, active, draft, terminated
  -- probation -> active, suspended, on_leave, terminated
  -- active -> on_leave, suspended, probation, terminated
  -- on_leave -> active, suspended, terminated
  -- suspended -> active, probation, terminated
  -- terminated -> REHIRE ONLY (blocked in this RPC)
  IF v_emp.status::text = 'terminated' THEN
    RAISE EXCEPTION 'الموظف منتهية خدمته مسبقاً. لإعادته للعمل، يرجى استخدام إجراء إعادة التعيين (Rehire).';
  END IF;

  IF v_emp.status::text = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'message', 'الحالة الحالية مطابقة للحالة المطلوبة.', 'status', p_new_status);
  END IF;

  IF v_emp.status::text = 'draft' AND p_new_status IN ('preboarding', 'probation', 'active', 'terminated') THEN
    v_allowed := true;
  ELSIF v_emp.status::text = 'preboarding' AND p_new_status IN ('probation', 'active', 'draft', 'terminated') THEN
    v_allowed := true;
  ELSIF v_emp.status::text = 'probation' AND p_new_status IN ('active', 'suspended', 'on_leave', 'terminated') THEN
    v_allowed := true;
  ELSIF v_emp.status::text = 'active' AND p_new_status IN ('on_leave', 'suspended', 'probation', 'terminated') THEN
    v_allowed := true;
  ELSIF v_emp.status::text = 'on_leave' AND p_new_status IN ('active', 'suspended', 'terminated') THEN
    v_allowed := true;
  ELSIF v_emp.status::text = 'suspended' AND p_new_status IN ('active', 'probation', 'terminated') THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'الانتقال من حالة (%s) إلى حالة (%s) غير مسموح به في دورة حياة الموظف.', v_emp.status, p_new_status;
  END IF;

  -- 4. Apply status update and termination fields if terminating
  IF p_new_status = 'terminated' THEN
    UPDATE public.employees
    SET
      status = 'terminated'::public.employee_status,
      termination_date = COALESCE(p_effective_date, current_date),
      last_working_date = COALESCE(p_effective_date, current_date),
      termination_reason = p_reason,
      termination_type = COALESCE(p_termination_type, 'resignation'),
      updated_at = now()
    WHERE id = p_employee_id;
  ELSE
    UPDATE public.employees
    SET
      status = p_new_status::public.employee_status,
      updated_at = now()
    WHERE id = p_employee_id;
  END IF;

  -- 5. Record Assignment / Lifecycle History
  INSERT INTO public.employee_assignment_history (
    company_id,
    employee_id,
    department_id,
    subsidiary_id,
    work_location_id,
    job_position_id,
    cost_center_id,
    manager_id,
    status,
    contract_type,
    effective_from,
    change_reason,
    changed_by
  ) VALUES (
    v_emp.company_id,
    v_emp.id,
    v_emp.department_id,
    v_emp.subsidiary_id,
    v_emp.work_location_id,
    v_emp.job_position_id,
    v_emp.cost_center_id,
    v_emp.manager_id,
    p_new_status,
    v_emp.contract_type,
    COALESCE(p_effective_date, current_date),
    format('تغيير الحالة من %s إلى %s: %s', v_emp.status, p_new_status, COALESCE(p_reason, 'إجراء إداري')),
    v_user_id
  );

  -- 6. Log Audit Event
  INSERT INTO public.audit_events (
    action,
    action_type,
    actor_user_id,
    entity_type,
    entity_id,
    changes_summary
  ) VALUES (
    'CHANGE_EMPLOYEE_STATUS',
    'UPDATE',
    v_user_id,
    'employees',
    p_employee_id::text,
    format('Changed employee %s status from %s to %s on %s. Reason: %s',
      v_emp.employee_no, v_emp.status, p_new_status, COALESCE(p_effective_date, current_date), COALESCE(p_reason, 'none'))
  );

  RETURN jsonb_build_object(
    'success', true,
    'employee_id', p_employee_id,
    'previous_status', v_emp.status,
    'new_status', p_new_status,
    'effective_date', COALESCE(p_effective_date, current_date)
  );
END;
$$;

-- 8. Rehire Employee RPC
CREATE OR REPLACE FUNCTION public.rehire_employee(
  p_employee_id uuid,
  p_rehire_date date DEFAULT current_date,
  p_new_status text DEFAULT 'probation',
  p_new_department_id uuid DEFAULT NULL,
  p_new_position_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'إعادة تعيين موظف سابق'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp RECORD;
  v_user_id uuid := auth.uid();
BEGIN
  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود.';
  END IF;

  IF NOT public.current_user_can_manage_company(v_emp.company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بإعادة تعيين موظف خارج نطاق شركتك.';
  END IF;

  IF v_emp.status::text <> 'terminated' THEN
    RAISE EXCEPTION 'الموظف ليس في حالة منتهية خدمته (الحالة الحالية: %s).', v_emp.status;
  END IF;

  IF p_new_status NOT IN ('active', 'probation') THEN
    RAISE EXCEPTION 'الحالة الجديدة عند إعادة التعيين يجب أن تكون active أو probation.';
  END IF;

  -- Apply Rehire
  UPDATE public.employees
  SET
    status = p_new_status::public.employee_status,
    rehire_date = COALESCE(p_rehire_date, current_date),
    department_id = COALESCE(p_new_department_id, department_id),
    job_position_id = COALESCE(p_new_position_id, job_position_id),
    updated_at = now()
  WHERE id = p_employee_id;

  -- Record History
  INSERT INTO public.employee_assignment_history (
    company_id,
    employee_id,
    department_id,
    subsidiary_id,
    work_location_id,
    job_position_id,
    cost_center_id,
    manager_id,
    status,
    contract_type,
    effective_from,
    change_reason,
    changed_by
  ) VALUES (
    v_emp.company_id,
    v_emp.id,
    COALESCE(p_new_department_id, v_emp.department_id),
    v_emp.subsidiary_id,
    v_emp.work_location_id,
    COALESCE(p_new_position_id, v_emp.job_position_id),
    v_emp.cost_center_id,
    v_emp.manager_id,
    p_new_status,
    v_emp.contract_type,
    COALESCE(p_rehire_date, current_date),
    p_reason,
    v_user_id
  );

  -- Log Audit Event
  INSERT INTO public.audit_events (
    action,
    action_type,
    actor_user_id,
    entity_type,
    entity_id,
    changes_summary
  ) VALUES (
    'REHIRE_EMPLOYEE',
    'UPDATE',
    v_user_id,
    'employees',
    p_employee_id::text,
    format('Rehired employee %s as %s on %s.', v_emp.employee_no, p_new_status, COALESCE(p_rehire_date, current_date))
  );

  RETURN jsonb_build_object(
    'success', true,
    'employee_id', p_employee_id,
    'new_status', p_new_status,
    'rehire_date', COALESCE(p_rehire_date, current_date)
  );
END;
$$;

-- 9. Atomic Bulk Status Change RPC
CREATE OR REPLACE FUNCTION public.bulk_change_employee_status(
  p_employee_ids uuid[],
  p_new_status text,
  p_effective_date date DEFAULT current_date,
  p_reason text DEFAULT 'تحديث حالة جماعي'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_res jsonb;
  v_count integer := 0;
BEGIN
  IF p_employee_ids IS NULL OR array_length(p_employee_ids, 1) = 0 THEN
    RAISE EXCEPTION 'قائمة الموظفين فارغة.';
  END IF;

  FOREACH v_id IN ARRAY p_employee_ids LOOP
    v_res := public.change_employee_status(
      v_id,
      p_new_status,
      p_effective_date,
      p_reason
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_count,
    'new_status', p_new_status
  );
END;
$$;

-- 10. Provision Secure Storage Bucket for Employee Avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-avatars',
  'employee-avatars',
  false,
  5242880, -- 5 MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- Storage RLS Policies for employee-avatars
DROP POLICY IF EXISTS "avatars_authenticated_read" ON storage.objects;
CREATE POLICY "avatars_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'employee-avatars');

DROP POLICY IF EXISTS "avatars_manage_upload" ON storage.objects;
CREATE POLICY "avatars_manage_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
      OR auth.uid() IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "avatars_manage_update" ON storage.objects;
CREATE POLICY "avatars_manage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'employee-avatars');

-- 11. RPC Grants
GRANT EXECUTE ON FUNCTION public.generate_company_employee_no(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_employee_status(uuid, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rehire_employee(uuid, date, text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_change_employee_status(uuid[], text, date, text) TO authenticated;
