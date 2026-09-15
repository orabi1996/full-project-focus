-- ===========================================================================
-- Migration: 20260915000000_finalize_employee_security_queries_and_avatar_integrity.sql
-- Description:
-- 1. Concurrency-safe, authorized employee number sequence counter table & generator
-- 2. Database protection trigger against unauthorized direct status updates
-- 3. Controlled profile mutation RPCs (HR profile, assignment, banking, compensation)
-- 4. Field-minimized, paginated, tenant-scoped get_employee_directory RPC
-- 5. Field-minimized, permission-aware get_employee_detail RPC
-- 6. Avatar stable storage reference column & hardened tenant-scoped storage RLS
-- ===========================================================================

-- 1. Stable Avatar Storage Reference Column
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS avatar_storage_path text;

-- 2. Company-Scoped Concurrency-Safe Employee Number Counter Table
CREATE TABLE IF NOT EXISTS public.company_employee_number_counters (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  next_value bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed counter table from existing max numeric employee numbers per company
INSERT INTO public.company_employee_number_counters (company_id, next_value)
SELECT
  company_id,
  COALESCE(MAX(NULLIF(regexp_replace(employee_no, '\D', '', 'g'), '')::bigint), 0) + 1
FROM public.employees
WHERE company_id IS NOT NULL
GROUP BY company_id
ON CONFLICT (company_id) DO UPDATE
SET next_value = GREATEST(
  public.company_employee_number_counters.next_value,
  EXCLUDED.next_value
);

ALTER TABLE public.company_employee_number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "counters_company_isolation" ON public.company_employee_number_counters;
CREATE POLICY "counters_company_isolation" ON public.company_employee_number_counters
  FOR ALL TO authenticated
  USING (public.current_user_can_manage_company(company_id))
  WITH CHECK (public.current_user_can_manage_company(company_id));

GRANT ALL ON public.company_employee_number_counters TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.company_employee_number_counters TO authenticated;

-- 3. Concurrency-Safe & Authorized Employee Number Generator RPC
CREATE OR REPLACE FUNCTION public.generate_company_employee_no(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_next_val bigint;
  v_allocated_no text;
  v_collision boolean := true;
  v_attempts integer := 0;
BEGIN
  -- 1. Authorization check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتوليد رقم وظيفي.';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد معرف الشركة (company_id إلزامي).';
  END IF;

  IF NOT (
    public.current_user_can_manage_company(p_company_id)
    OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بتوليد رقم وظيفي لمنشأة لا تملك صلاحية إدارتها.';
  END IF;

  -- 2. Concurrency-safe atomic sequence increment
  WHILE v_collision AND v_attempts < 100 LOOP
    v_attempts := v_attempts + 1;

    INSERT INTO public.company_employee_number_counters (company_id, next_value, updated_at)
    VALUES (p_company_id, 2, now())
    ON CONFLICT (company_id)
    DO UPDATE SET
      next_value = public.company_employee_number_counters.next_value + 1,
      updated_at = now()
    RETURNING public.company_employee_number_counters.next_value - 1 INTO v_next_val;

    v_allocated_no := 'EMP-' || lpad(v_next_val::text, 6, '0');

    -- Safeguard against collisions with pre-existing legacy manual rows
    SELECT EXISTS(
      SELECT 1 FROM public.employees
      WHERE company_id = p_company_id AND employee_no = v_allocated_no
    ) INTO v_collision;
  END LOOP;

  IF v_collision THEN
    RAISE EXCEPTION 'تعذر تخصيص رقم وظيفي فريد بعد عدة محاولات متتالية.';
  END IF;

  RETURN v_allocated_no;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_company_employee_no(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_company_employee_no(uuid) TO authenticated;

-- 4. Direct Status Mutation Safeguard Trigger
CREATE OR REPLACE FUNCTION public.prevent_direct_employee_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF current_setting('app.in_lifecycle_rpc', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'لا يمكن تغيير حالة الموظف التعاقدية مباشرة عبر التحديث العام. يرجى استخدام إجراءات دورة الحياة المعتمدة (change_employee_status أو rehire_employee).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_employee_status_update ON public.employees;
CREATE TRIGGER trg_prevent_direct_employee_status_update
  BEFORE UPDATE OF status ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_employee_status_update();

-- 5. Re-declare Lifecycle Status Transition RPCs with Transaction Context Flag
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

  -- Set session authorization context to allow status trigger
  PERFORM set_config('app.in_lifecycle_rpc', 'true', true);

  -- 4. Apply status update
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

  -- 5. Record Assignment History
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
    'change_employee_status',
    'status_change',
    v_user_id,
    'employee',
    p_employee_id,
    format('تغيير حالة الموظف %s من %s إلى %s', v_emp.employee_no, v_emp.status, p_new_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تحديث حالة الموظف بنجاح.',
    'previous_status', v_emp.status,
    'new_status', p_new_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_change_employee_status(
  p_employee_ids uuid[],
  p_new_status text,
  p_effective_date date DEFAULT current_date,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_updated_count integer := 0;
  v_res jsonb;
BEGIN
  FOREACH v_id IN ARRAY p_employee_ids LOOP
    BEGIN
      v_res := public.change_employee_status(
        p_employee_id => v_id,
        p_new_status => p_new_status,
        p_effective_date => p_effective_date,
        p_reason => p_reason
      );
      v_updated_count := v_updated_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'فشل تحديث حالة الموظف (%): %', v_id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'message', format('تم تحديث حالة %s موظفين بنجاح.', v_updated_count)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rehire_employee(
  p_employee_id uuid,
  p_rehire_date date DEFAULT current_date,
  p_new_status text DEFAULT 'probation',
  p_new_department_id uuid DEFAULT NULL,
  p_new_position_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
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
    RAISE EXCEPTION 'إجراء إعادة التعيين متاح فقط للموظفين المنتهية خدمتهم (الحالة الحالية: %s).', v_emp.status;
  END IF;

  IF p_new_status NOT IN ('draft', 'preboarding', 'probation', 'active') THEN
    RAISE EXCEPTION 'حالة إعادة التعيين (%s) غير صالحة.', p_new_status;
  END IF;

  -- Set session authorization context to allow status trigger
  PERFORM set_config('app.in_lifecycle_rpc', 'true', true);

  UPDATE public.employees
  SET
    status = p_new_status::public.employee_status,
    rehire_date = COALESCE(p_rehire_date, current_date),
    department_id = COALESCE(p_new_department_id, department_id),
    job_position_id = COALESCE(p_new_position_id, job_position_id),
    termination_date = NULL,
    last_working_date = NULL,
    termination_reason = NULL,
    termination_type = NULL,
    updated_at = now()
  WHERE id = p_employee_id;

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
    format('إعادة تعيين الموظف: %s', COALESCE(p_reason, 'قرار إداري معتمد')),
    v_user_id
  );

  INSERT INTO public.audit_events (
    action,
    action_type,
    actor_user_id,
    entity_type,
    entity_id,
    changes_summary
  ) VALUES (
    'rehire_employee',
    'status_change',
    v_user_id,
    'employee',
    p_employee_id,
    format('إعادة تعيين الموظف %s بحالة %s', v_emp.employee_no, p_new_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تمت إعادة تعيين الموظف بنجاح.',
    'rehire_date', COALESCE(p_rehire_date, current_date),
    'new_status', p_new_status
  );
END;
$$;

-- 6. Field-Minimized, Paginated, Tenant-Scoped Employee Directory RPC
CREATE OR REPLACE FUNCTION public.get_employee_directory(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_subsidiary_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25,
  p_sort text DEFAULT 'name_asc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := auth.current_company_id();
  v_is_super boolean;
  v_can_search_sensitive boolean;
  v_offset integer;
  v_limit integer;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يرجى تسجيل الدخول.';
  END IF;

  v_is_super := public.current_user_has_any_role(ARRAY['super_admin']);
  v_can_search_sensitive := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']);

  -- Tenant scope enforcement
  IF NOT v_is_super AND v_company_id IS NULL THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'total_count', 0, 'page', p_page, 'page_size', p_page_size);
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_page_size, 25), 100));
  v_offset := GREATEST(0, (COALESCE(p_page, 1) - 1) * v_limit);

  -- Count total matching
  SELECT count(*) INTO v_total
  FROM public.employees e
  WHERE (v_is_super OR e.company_id = v_company_id)
    AND (p_status IS NULL OR p_status = 'all' OR e.status::text = p_status)
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (p_subsidiary_id IS NULL OR e.subsidiary_id = p_subsidiary_id)
    AND (p_location_id IS NULL OR e.work_location_id = p_location_id)
    AND (
      p_search IS NULL OR btrim(p_search) = ''
      OR e.employee_no ILIKE ('%' || btrim(p_search) || '%')
      OR e.first_name_ar ILIKE ('%' || btrim(p_search) || '%')
      OR e.last_name_ar ILIKE ('%' || btrim(p_search) || '%')
      OR e.first_name_en ILIKE ('%' || btrim(p_search) || '%')
      OR e.last_name_en ILIKE ('%' || btrim(p_search) || '%')
      OR e.full_name ILIKE ('%' || btrim(p_search) || '%')
      OR e.job_title ILIKE ('%' || btrim(p_search) || '%')
      OR e.email ILIKE ('%' || btrim(p_search) || '%')
      OR (v_can_search_sensitive AND e.national_id_or_iqama ILIKE ('%' || btrim(p_search) || '%'))
    );

  -- Fetch projected rows (excluding salary, iban, national ID, passport, etc.)
  SELECT COALESCE(jsonb_agg(sub.item), '[]'::jsonb) INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'id', e.id,
      'employee_no', e.employee_no,
      'first_name_ar', e.first_name_ar,
      'last_name_ar', e.last_name_ar,
      'first_name_en', e.first_name_en,
      'last_name_en', e.last_name_en,
      'full_name', e.full_name,
      'email', e.email,
      'phone', e.phone,
      'job_title', e.job_title,
      'status', e.status,
      'hire_date', e.hire_date,
      'contract_type', e.contract_type,
      'work_type', e.work_type,
      'department_id', e.department_id,
      'department_name', d.name,
      'subsidiary_id', e.subsidiary_id,
      'subsidiary_name', s.name_ar,
      'work_location_id', e.work_location_id,
      'work_location_name', w.name_ar,
      'avatar_url', e.avatar_url,
      'avatar_storage_path', e.avatar_storage_path,
      'completion_score', e.completion_score,
      'nationality', e.nationality,
      'qiwa_contract_no', e.qiwa_contract_no
    ) AS item
    FROM public.employees e
    LEFT JOIN public.departments d ON d.id = e.department_id
    LEFT JOIN public.subsidiaries s ON s.id = e.subsidiary_id
    LEFT JOIN public.work_locations w ON w.id = e.work_location_id
    WHERE (v_is_super OR e.company_id = v_company_id)
      AND (p_status IS NULL OR p_status = 'all' OR e.status::text = p_status)
      AND (p_department_id IS NULL OR e.department_id = p_department_id)
      AND (p_subsidiary_id IS NULL OR e.subsidiary_id = p_subsidiary_id)
      AND (p_location_id IS NULL OR e.work_location_id = p_location_id)
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR e.employee_no ILIKE ('%' || btrim(p_search) || '%')
        OR e.first_name_ar ILIKE ('%' || btrim(p_search) || '%')
        OR e.last_name_ar ILIKE ('%' || btrim(p_search) || '%')
        OR e.first_name_en ILIKE ('%' || btrim(p_search) || '%')
        OR e.last_name_en ILIKE ('%' || btrim(p_search) || '%')
        OR e.full_name ILIKE ('%' || btrim(p_search) || '%')
        OR e.job_title ILIKE ('%' || btrim(p_search) || '%')
        OR e.email ILIKE ('%' || btrim(p_search) || '%')
        OR (v_can_search_sensitive AND e.national_id_or_iqama ILIKE ('%' || btrim(p_search) || '%'))
      )
    ORDER BY
      CASE WHEN p_sort = 'name_desc' THEN e.full_name END DESC,
      CASE WHEN p_sort = 'date_desc' THEN e.hire_date END DESC,
      CASE WHEN p_sort = 'date_asc' THEN e.hire_date END ASC,
      e.full_name ASC
    LIMIT v_limit
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', v_items,
    'total_count', v_total,
    'page', COALESCE(p_page, 1),
    'page_size', v_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_directory FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_directory TO authenticated;

-- 7. Field-Minimized, Permission-Aware Employee Detail RPC
CREATE OR REPLACE FUNCTION public.get_employee_detail(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := auth.current_company_id();
  v_is_super boolean;
  v_can_view_hr boolean;
  v_can_view_payroll boolean;
  v_is_self boolean;
  v_emp RECORD;
  v_mgr RECORD;
  v_dept_name text;
  v_sub_name text;
  v_loc_name text;
  v_res jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يرجى تسجيل الدخول.';
  END IF;

  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود.';
  END IF;

  v_is_super := public.current_user_has_any_role(ARRAY['super_admin']);
  v_is_self := (v_emp.user_id = v_user_id OR v_emp.id = public.current_employee_id());
  v_can_view_hr := v_is_super OR public.current_user_can_manage_company(v_emp.company_id)
    OR public.current_user_has_any_role(ARRAY['hr_manager', 'org_admin', 'auditor']);
  v_can_view_payroll := v_is_super OR public.current_user_can_manage_company(v_emp.company_id)
    OR public.current_user_has_any_role(ARRAY['payroll_officer', 'finance_officer']);

  -- Tenant authorization
  IF NOT v_is_super AND v_emp.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'غير مصرح لك بالوصول لبيانات موظف خارج نطاق منشأتك.';
  END IF;

  -- Associated metadata
  SELECT name INTO v_dept_name FROM public.departments WHERE id = v_emp.department_id;
  SELECT name_ar INTO v_sub_name FROM public.subsidiaries WHERE id = v_emp.subsidiary_id;
  SELECT name_ar INTO v_loc_name FROM public.work_locations WHERE id = v_emp.work_location_id;
  IF v_emp.manager_id IS NOT NULL THEN
    SELECT first_name_ar, last_name_ar INTO v_mgr FROM public.employees WHERE id = v_emp.manager_id;
  END IF;

  v_res := jsonb_build_object(
    'id', v_emp.id,
    'employee_no', v_emp.employee_no,
    'first_name_ar', v_emp.first_name_ar,
    'last_name_ar', v_emp.last_name_ar,
    'first_name_en', v_emp.first_name_en,
    'last_name_en', v_emp.last_name_en,
    'full_name', v_emp.full_name,
    'email', v_emp.email,
    'personal_email', CASE WHEN v_can_view_hr OR v_is_self THEN v_emp.personal_email ELSE NULL END,
    'phone', v_emp.phone,
    'job_title', v_emp.job_title,
    'status', v_emp.status,
    'gender', v_emp.gender,
    'birth_date', CASE WHEN v_can_view_hr OR v_is_self THEN v_emp.birth_date ELSE NULL END,
    'marital_status', CASE WHEN v_can_view_hr OR v_is_self THEN v_emp.marital_status ELSE NULL END,
    'nationality', v_emp.nationality,
    'national_id_or_iqama', CASE WHEN v_can_view_hr OR v_is_self THEN v_emp.national_id_or_iqama ELSE NULL END,
    'national_id_expiry', CASE WHEN v_can_view_hr OR v_is_self THEN v_emp.national_id_expiry ELSE NULL END,
    'passport_no', CASE WHEN v_can_view_hr OR v_is_self THEN v_emp.passport_no ELSE NULL END,
    'passport_expiry', CASE WHEN v_can_view_hr OR v_is_self THEN v_emp.passport_expiry ELSE NULL END,
    'blood_type', v_emp.blood_type,
    'dependents_count', v_emp.dependents_count,
    'company_id', v_emp.company_id,
    'subsidiary_id', v_emp.subsidiary_id,
    'subsidiary_name', v_sub_name,
    'department_id', v_emp.department_id,
    'department_name', v_dept_name,
    'work_location_id', v_emp.work_location_id,
    'work_location_name', v_loc_name,
    'job_position_id', v_emp.job_position_id,
    'cost_center_id', v_emp.cost_center_id,
    'manager_id', v_emp.manager_id,
    'manager_name', CASE WHEN v_mgr.first_name_ar IS NOT NULL THEN (v_mgr.first_name_ar || ' ' || COALESCE(v_mgr.last_name_ar, '')) ELSE NULL END,
    'job_grade', v_emp.job_grade,
    'work_type', v_emp.work_type,
    'hire_date', v_emp.hire_date,
    'contract_type', v_emp.contract_type,
    'contract_start_date', v_emp.contract_start_date,
    'contract_end_date', v_emp.contract_end_date,
    'qiwa_contract_no', v_emp.qiwa_contract_no,
    'termination_date', v_emp.termination_date,
    'last_working_date', v_emp.last_working_date,
    'termination_reason', CASE WHEN v_can_view_hr THEN v_emp.termination_reason ELSE NULL END,
    'termination_type', CASE WHEN v_can_view_hr THEN v_emp.termination_type ELSE NULL END,
    'rehire_date', v_emp.rehire_date,
    'avatar_url', v_emp.avatar_url,
    'avatar_storage_path', v_emp.avatar_storage_path,
    'completion_score', v_emp.completion_score,
    'gosi_number', CASE WHEN v_can_view_hr OR v_can_view_payroll OR v_is_self THEN v_emp.gosi_number ELSE NULL END,
    'created_at', v_emp.created_at,
    'updated_at', v_emp.updated_at
  );

  -- Only include compensation / bank if caller has payroll permission or is self
  IF v_can_view_payroll OR v_is_self THEN
    v_res := v_res || jsonb_build_object(
      'basic_salary', v_emp.basic_salary,
      'total_salary', v_emp.total_salary,
      'housing_allowance', v_emp.housing_allowance,
      'transport_allowance', v_emp.transport_allowance,
      'other_allowances', v_emp.other_allowances,
      'bank_name', v_emp.bank_name,
      'iban', v_emp.iban
    );
  END IF;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_detail FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_detail TO authenticated;

-- 8. Hardened Avatar Storage Policies
DROP POLICY IF EXISTS "employee_avatars_read" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_tenant_insert" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_tenant_update" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_tenant_delete" ON storage.objects;

-- Directory read: same-company authenticated users or super_admin
CREATE POLICY "employee_avatars_tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR (storage.foldername(name))[1] = auth.current_company_id()::text
    )
  );

-- Upload: HR of same company, or employee uploading own avatar in company folder
CREATE POLICY "employee_avatars_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR (
        (storage.foldername(name))[1] = auth.current_company_id()::text
        AND (
          public.current_user_can_manage_company(auth.current_company_id())
          OR (storage.foldername(name))[2] = public.current_employee_id()::text
        )
      )
    )
  );

-- Update: HR of same company or employee own avatar
CREATE POLICY "employee_avatars_tenant_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR (
        (storage.foldername(name))[1] = auth.current_company_id()::text
        AND (
          public.current_user_can_manage_company(auth.current_company_id())
          OR (storage.foldername(name))[2] = public.current_employee_id()::text
        )
      )
    )
  );

-- Delete: HR of same company or employee own avatar
CREATE POLICY "employee_avatars_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR (
        (storage.foldername(name))[1] = auth.current_company_id()::text
        AND (
          public.current_user_can_manage_company(auth.current_company_id())
          OR (storage.foldername(name))[2] = public.current_employee_id()::text
        )
      )
    )
  );

-- 9. Controlled Profile Mutation RPCs
CREATE OR REPLACE FUNCTION public.update_employee_hr_profile(
  p_employee_id uuid,
  p_first_name_ar text,
  p_last_name_ar text,
  p_first_name_en text DEFAULT NULL,
  p_last_name_en text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_nationality text DEFAULT NULL,
  p_gender text DEFAULT 'male',
  p_birth_date date DEFAULT NULL,
  p_marital_status text DEFAULT 'single',
  p_job_title text DEFAULT NULL
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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود.';
  END IF;

  IF NOT (
    public.current_user_can_manage_company(v_emp.company_id)
    OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل الملف الشخصي لهذا الموظف.';
  END IF;

  IF btrim(p_first_name_ar) = '' OR btrim(p_last_name_ar) = '' THEN
    RAISE EXCEPTION 'الاسم الأول واسم العائلة باللغة العربية إلزاميان.';
  END IF;

  UPDATE public.employees
  SET
    first_name_ar = p_first_name_ar,
    last_name_ar = p_last_name_ar,
    first_name_en = p_first_name_en,
    last_name_en = p_last_name_en,
    full_name = btrim(p_first_name_ar || ' ' || p_last_name_ar),
    email = p_email,
    phone = p_phone,
    national_id_or_iqama = COALESCE(p_national_id, national_id_or_iqama),
    nationality = COALESCE(p_nationality, nationality),
    gender = COALESCE(p_gender, gender),
    birth_date = p_birth_date,
    marital_status = COALESCE(p_marital_status, marital_status),
    job_title = COALESCE(p_job_title, job_title),
    updated_at = now()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم تحديث البيانات الشخصية بنجاح.');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_employee_assignment(
  p_employee_id uuid,
  p_department_id uuid DEFAULT NULL,
  p_subsidiary_id uuid DEFAULT NULL,
  p_work_location_id uuid DEFAULT NULL,
  p_job_position_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL,
  p_work_type text DEFAULT 'on_site'
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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود.';
  END IF;

  IF NOT (
    public.current_user_can_manage_company(v_emp.company_id)
    OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل التعيينات الإدارية لهذا الموظف.';
  END IF;

  UPDATE public.employees
  SET
    department_id = p_department_id,
    subsidiary_id = p_subsidiary_id,
    work_location_id = p_work_location_id,
    job_position_id = p_job_position_id,
    cost_center_id = p_cost_center_id,
    manager_id = p_manager_id,
    work_type = COALESCE(p_work_type, work_type),
    updated_at = now()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم تحديث التعيين الإداري بنجاح.');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_employee_bank_details(
  p_employee_id uuid,
  p_bank_name text,
  p_iban text
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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود.';
  END IF;

  IF NOT (
    public.current_user_can_manage_company(v_emp.company_id)
    OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'payroll_officer', 'finance_officer'])
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل الحساب البنكي للموظف.';
  END IF;

  UPDATE public.employees
  SET
    bank_name = p_bank_name,
    iban = p_iban,
    updated_at = now()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم تحديث الحساب البنكي بنجاح.');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_employee_compensation(
  p_employee_id uuid,
  p_basic_salary numeric,
  p_housing_allowance numeric DEFAULT 0,
  p_transport_allowance numeric DEFAULT 0,
  p_other_allowances numeric DEFAULT 0
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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود.';
  END IF;

  IF NOT (
    public.current_user_can_manage_company(v_emp.company_id)
    OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'payroll_officer'])
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل سلم الرواتب والبدلات لهذا الموظف.';
  END IF;

  IF p_basic_salary < 0 THEN
    RAISE EXCEPTION 'الراتب الأساسي لا يمكن أن يكون سالباً.';
  END IF;

  UPDATE public.employees
  SET
    basic_salary = p_basic_salary,
    housing_allowance = COALESCE(p_housing_allowance, 0),
    transport_allowance = COALESCE(p_transport_allowance, 0),
    other_allowances = COALESCE(p_other_allowances, 0),
    total_salary = p_basic_salary + COALESCE(p_housing_allowance, 0) + COALESCE(p_transport_allowance, 0) + COALESCE(p_other_allowances, 0),
    updated_at = now()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم تحديث البيانات المالية بنجاح.');
END;
$$;

REVOKE ALL ON FUNCTION public.update_employee_hr_profile FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_employee_assignment FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_employee_bank_details FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_employee_compensation FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_employee_hr_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee_assignment TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee_bank_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee_compensation TO authenticated;

