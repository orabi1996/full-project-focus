-- ===========================================================================
-- Migration: 20260915010000_finalize_employee_directory_detail_and_avatar_security.sql
-- Description:
-- 1. Fix generate_company_employee_no authorization (remove role bypass)
-- 2. Authoritative create_employee RPC with trusted DB company context
-- 3. Field-minimized, server-paginated get_employee_directory RPC with enhanced filters
-- 4. Aggregate get_employee_directory_kpis RPC for company-level metrics
-- 5. Hardened get_employee_detail RPC (block colleague enumeration, decouple payroll)
-- 6. Strict financial authorization for update_employee_bank_details and update_employee_compensation
-- 7. Metadata-first storage RLS policies for employee-avatars
-- ===========================================================================

-- 1. Fix generate_company_employee_no Authorization
-- Remove the second OR role bypass so only current_user_can_manage_company authorizes generation
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
  -- 1. Authentication check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتوليد رقم وظيفي.';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد معرف الشركة (company_id إلزامي).';
  END IF;

  -- 2. Strict company management authorization (no broad role bypass)
  IF NOT public.current_user_can_manage_company(p_company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بتوليد رقم وظيفي لمنشأة لا تملك صلاحية إدارتها.';
  END IF;

  -- 3. Concurrency-safe atomic sequence increment with row lock
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

    -- Safeguard against collisions with pre-existing legacy rows
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

-- 2. Authoritative create_employee RPC with Trusted DB Company Resolution
CREATE OR REPLACE FUNCTION public.create_employee(
  p_first_name_ar text,
  p_last_name_ar text,
  p_first_name_en text DEFAULT NULL,
  p_last_name_en text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_national_id_or_iqama text DEFAULT NULL,
  p_nationality text DEFAULT NULL,
  p_gender text DEFAULT 'male',
  p_birth_date date DEFAULT NULL,
  p_marital_status text DEFAULT 'single',
  p_hire_date date DEFAULT current_date,
  p_contract_type text DEFAULT 'full_time',
  p_job_title text DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_subsidiary_id uuid DEFAULT NULL,
  p_work_location_id uuid DEFAULT NULL,
  p_job_position_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL,
  p_work_type text DEFAULT 'on_site',
  p_basic_salary numeric DEFAULT 0,
  p_housing_allowance numeric DEFAULT 0,
  p_transport_allowance numeric DEFAULT 0,
  p_other_allowances numeric DEFAULT 0,
  p_bank_name text DEFAULT NULL,
  p_iban text DEFAULT NULL,
  p_job_grade text DEFAULT NULL,
  p_target_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_is_super boolean;
  v_employee_no text;
  v_new_id uuid;
  v_full_name text;
BEGIN
  -- 1. Require authenticated user
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لإنشاء موظف.';
  END IF;

  v_is_super := public.current_user_has_any_role(ARRAY['super_admin']);

  -- 2. Resolve authoritative company from trusted DB functions (never browser user_metadata)
  IF p_target_company_id IS NOT NULL THEN
    IF NOT (v_is_super OR p_target_company_id = auth.current_company_id()) THEN
      RAISE EXCEPTION 'غير مصرح لك بإنشاء موظف في منشأة أخرى.';
    END IF;
    v_company_id := p_target_company_id;
  ELSE
    v_company_id := auth.current_company_id();
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد منشأة الموظف المعتمدة بصورة موثوقة. لا يوجد سياق منشأة معتمد للمستخدم.';
  END IF;

  -- 3. Authorization check
  IF NOT public.current_user_can_manage_company(v_company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بإنشاء موظف في هذه المنشأة.';
  END IF;

  -- 4. Validation
  IF btrim(COALESCE(p_first_name_ar, '')) = '' OR btrim(COALESCE(p_last_name_ar, '')) = '' THEN
    RAISE EXCEPTION 'الاسم الأول واسم العائلة باللغة العربية إلزاميان للتوثيق المالي والقانوني ولإنشاء الموظف.';
  END IF;

  v_full_name := btrim(p_first_name_ar || ' ' || p_last_name_ar);

  -- 5. Validate organization references belong to target company
  IF p_department_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.departments WHERE id = p_department_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'القسم المحدد غير تابع لهذه المنشأة.';
  END IF;

  IF p_subsidiary_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subsidiaries WHERE id = p_subsidiary_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'الشركة التابعة المحددة غير تابعة لهذه المنشأة.';
  END IF;

  IF p_work_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.work_locations WHERE id = p_work_location_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'مقر العمل المحدد غير تابع لهذه المنشأة.';
  END IF;

  -- 6. Allocate employee number transactionally
  v_employee_no := public.generate_company_employee_no(v_company_id);

  -- 7. Insert employee row (status starts as draft)
  INSERT INTO public.employees (
    company_id,
    employee_no,
    full_name,
    first_name_ar,
    last_name_ar,
    first_name_en,
    last_name_en,
    email,
    phone,
    national_id_or_iqama,
    nationality,
    gender,
    birth_date,
    marital_status,
    hire_date,
    contract_type,
    job_title,
    department_id,
    subsidiary_id,
    work_location_id,
    job_position_id,
    cost_center_id,
    manager_id,
    work_type,
    basic_salary,
    total_salary,
    housing_allowance,
    transport_allowance,
    other_allowances,
    bank_name,
    iban,
    job_grade,
    status
  ) VALUES (
    v_company_id,
    v_employee_no,
    v_full_name,
    p_first_name_ar,
    p_last_name_ar,
    p_first_name_en,
    p_last_name_en,
    p_email,
    p_phone,
    p_national_id_or_iqama,
    p_nationality,
    COALESCE(p_gender, 'male')::public.employee_gender,
    p_birth_date,
    COALESCE(p_marital_status, 'single')::public.employee_marital_status,
    COALESCE(p_hire_date, current_date),
    COALESCE(p_contract_type, 'full_time')::public.employee_contract_type,
    p_job_title,
    p_department_id,
    p_subsidiary_id,
    p_work_location_id,
    p_job_position_id,
    p_cost_center_id,
    p_manager_id,
    COALESCE(p_work_type, 'on_site'),
    COALESCE(p_basic_salary, 0),
    COALESCE(p_basic_salary, 0) + COALESCE(p_housing_allowance, 0) + COALESCE(p_transport_allowance, 0) + COALESCE(p_other_allowances, 0),
    COALESCE(p_housing_allowance, 0),
    COALESCE(p_transport_allowance, 0),
    COALESCE(p_other_allowances, 0),
    p_bank_name,
    p_iban,
    p_job_grade,
    'draft'::public.employee_status
  )
  RETURNING id INTO v_new_id;

  -- 8. Write audit event (masking sensitive fields)
  INSERT INTO public.audit_events (
    action,
    action_type,
    actor_user_id,
    entity_type,
    entity_id,
    changes_summary
  ) VALUES (
    'create_employee',
    'employee_creation',
    v_user_id,
    'employee',
    v_new_id,
    format('إنشاء موظف جديد رقم %s بالاسم %s في المنشأة %s', v_employee_no, v_full_name, v_company_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'employee_no', v_employee_no,
    'company_id', v_company_id,
    'status', 'draft',
    'message', 'تم إنشاء الموظف بنجاح وتخصيص الرقم الوظيفي.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_employee FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee TO authenticated;

-- 3. Field-Minimized, Server-Paginated Employee Directory RPC
CREATE OR REPLACE FUNCTION public.get_employee_directory(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_subsidiary_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25,
  p_sort text DEFAULT 'name_asc',
  p_contract_type text DEFAULT NULL,
  p_nationality text DEFAULT NULL,
  p_quick_preset text DEFAULT NULL,
  p_min_salary numeric DEFAULT NULL,
  p_max_salary numeric DEFAULT NULL
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
  v_is_hr boolean;
  v_can_view_payroll boolean;
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
  v_is_hr := v_is_super OR public.current_user_has_any_role(ARRAY['hr_manager', 'org_admin']);
  v_can_view_payroll := v_is_super OR public.current_user_has_any_role(ARRAY['payroll_officer', 'finance_officer']);
  v_can_search_sensitive := v_is_hr;

  -- Tenant scope enforcement
  IF NOT v_is_super AND v_company_id IS NULL THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'total_count', 0, 'page', p_page, 'page_size', p_page_size);
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_page_size, 25), 100));
  v_offset := GREATEST(0, (COALESCE(p_page, 1) - 1) * v_limit);

  -- Count total matching rows
  SELECT count(*) INTO v_total
  FROM public.employees e
  WHERE (v_is_super OR e.company_id = v_company_id)
    AND (p_status IS NULL OR p_status = 'all' OR e.status::text = p_status)
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (p_subsidiary_id IS NULL OR e.subsidiary_id = p_subsidiary_id)
    AND (p_location_id IS NULL OR e.work_location_id = p_location_id)
    AND (p_contract_type IS NULL OR p_contract_type = 'all' OR e.contract_type::text = p_contract_type)
    AND (
      p_nationality IS NULL OR p_nationality = 'all'
      OR (p_nationality = 'saudi' AND e.nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
      OR (p_nationality = 'expat' AND (e.nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia') OR e.nationality IS NULL))
      OR e.nationality = p_nationality
    )
    AND (
      p_quick_preset IS NULL OR p_quick_preset = 'all'
      OR (p_quick_preset = 'saudi' AND e.nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
      OR (p_quick_preset = 'expat' AND (e.nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia') OR e.nationality IS NULL))
      OR (p_quick_preset = 'probation' AND e.status = 'probation')
      OR (p_quick_preset = 'on_leave' AND e.status = 'on_leave')
      OR (p_quick_preset = 'remote_hybrid' AND e.work_type IN ('remote', 'hybrid'))
      OR (p_quick_preset = 'complete_profile' AND e.completion_score >= 95)
    )
    -- Financial filter only applied if caller is authorized
    AND (
      NOT v_can_view_payroll
      OR (
        (p_min_salary IS NULL OR e.basic_salary >= p_min_salary)
        AND (p_max_salary IS NULL OR e.basic_salary <= p_max_salary)
      )
    )
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

  -- Fetch projected rows
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
      'phone', CASE WHEN v_is_hr THEN e.phone ELSE NULL END,
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
      'nationality', CASE WHEN v_is_hr THEN e.nationality ELSE NULL END,
      'qiwa_contract_no', CASE WHEN v_is_hr THEN e.qiwa_contract_no ELSE NULL END
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
      AND (p_contract_type IS NULL OR p_contract_type = 'all' OR e.contract_type::text = p_contract_type)
      AND (
        p_nationality IS NULL OR p_nationality = 'all'
        OR (p_nationality = 'saudi' AND e.nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
        OR (p_nationality = 'expat' AND (e.nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia') OR e.nationality IS NULL))
        OR e.nationality = p_nationality
      )
      AND (
        p_quick_preset IS NULL OR p_quick_preset = 'all'
        OR (p_quick_preset = 'saudi' AND e.nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
        OR (p_quick_preset = 'expat' AND (e.nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia') OR e.nationality IS NULL))
        OR (p_quick_preset = 'probation' AND e.status = 'probation')
        OR (p_quick_preset = 'on_leave' AND e.status = 'on_leave')
        OR (p_quick_preset = 'remote_hybrid' AND e.work_type IN ('remote', 'hybrid'))
        OR (p_quick_preset = 'complete_profile' AND e.completion_score >= 95)
      )
      AND (
        NOT v_can_view_payroll
        OR (
          (p_min_salary IS NULL OR e.basic_salary >= p_min_salary)
          AND (p_max_salary IS NULL OR e.basic_salary <= p_max_salary)
        )
      )
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

-- 4. Aggregate get_employee_directory_kpis RPC for Truthful Company-Wide Metrics
CREATE OR REPLACE FUNCTION public.get_employee_directory_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := auth.current_company_id();
  v_is_super boolean;
  v_total_employees integer := 0;
  v_saudi_employees integer := 0;
  v_expat_employees integer := 0;
  v_saudization_rate numeric := 0;
  v_probation_count integer := 0;
  v_on_leave_count integer := 0;
  v_expiring_docs_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يرجى تسجيل الدخول.';
  END IF;

  v_is_super := public.current_user_has_any_role(ARRAY['super_admin']);
  IF NOT v_is_super AND v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'لا يوجد معرف منشأة معتمد'
    );
  END IF;

  -- Aggregate employee status and headcount
  SELECT
    count(*),
    count(*) FILTER (WHERE nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia')),
    count(*) FILTER (WHERE nationality IS NOT NULL AND nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia') AND btrim(nationality) <> ''),
    count(*) FILTER (WHERE status = 'probation'),
    count(*) FILTER (WHERE status = 'on_leave')
  INTO
    v_total_employees,
    v_saudi_employees,
    v_expat_employees,
    v_probation_count,
    v_on_leave_count
  FROM public.employees
  WHERE (v_is_super OR company_id = v_company_id)
    AND status <> 'terminated';

  IF v_total_employees > 0 THEN
    v_saudization_rate := round((v_saudi_employees::numeric / v_total_employees::numeric) * 100);
  ELSE
    v_saudization_rate := 0;
  END IF;

  -- Aggregate expiring documents count
  SELECT count(DISTINCT employee_id)
  INTO v_expiring_docs_count
  FROM public.employee_documents
  WHERE (v_is_super OR company_id = v_company_id)
    AND expiry_date IS NOT NULL
    AND expiry_date <= (current_date + interval '60 days');

  RETURN jsonb_build_object(
    'available', true,
    'total_employees', v_total_employees,
    'saudi_employees', v_saudi_employees,
    'expat_employees', v_expat_employees,
    'saudization_rate', v_saudization_rate,
    'probation_count', v_probation_count,
    'on_leave_count', v_on_leave_count,
    'expiring_docs_count', v_expiring_docs_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_directory_kpis FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_directory_kpis TO authenticated;

-- 5. Hardened get_employee_detail RPC: Block Colleague Enumeration & Decouple Payroll
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
  v_caller_emp_id uuid;
  v_is_self boolean;
  v_is_hr boolean;
  v_is_manager boolean;
  v_is_auditor boolean;
  v_is_payroll boolean;
  v_can_view_hr boolean;
  v_can_view_payroll boolean;
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

  v_is_super := public.current_user_has_any_role(ARRAY['super_admin']);
  v_caller_emp_id := public.current_employee_id();

  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود.';
  END IF;

  -- Tenant isolation: super_admin or same company
  IF NOT v_is_super AND v_emp.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود أو لا تملك صلاحية الوصول إليه.';
  END IF;

  -- Relationships and role evaluation
  v_is_self := (v_emp.user_id = v_user_id OR v_emp.id = v_caller_emp_id);
  v_is_hr := v_is_super OR (
    public.current_user_has_any_role(ARRAY['hr_manager', 'org_admin'])
    AND public.current_user_can_manage_company(v_emp.company_id)
  );
  v_is_manager := (v_caller_emp_id IS NOT NULL AND v_emp.manager_id = v_caller_emp_id);
  v_is_auditor := public.current_user_has_any_role(ARRAY['auditor']);
  v_is_payroll := v_is_super OR public.current_user_has_any_role(ARRAY['payroll_officer', 'finance_officer']);

  -- ACCESS CHECK: Block ordinary colleague enumeration
  -- An ordinary colleague must NOT access another employee's 360 profile merely because both are in the same company
  IF NOT (v_is_self OR v_is_super OR v_is_hr OR v_is_manager OR v_is_auditor OR v_is_payroll) THEN
    RAISE EXCEPTION 'غير مصرح لك باستعراض الملف الشخصي الكامل لهذا الموظف.';
  END IF;

  -- HR projection permission
  v_can_view_hr := v_is_super OR v_is_hr OR v_is_self OR v_is_auditor;

  -- Payroll projection permission:
  -- Decoupled from current_user_can_manage_company!
  -- Only super_admin, payroll_officer, finance_officer, or self receive financial data
  v_can_view_payroll := v_is_super OR v_is_payroll OR v_is_self;

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
    -- Payroll & Banking fields: Strictly projected ONLY for payroll-authorized callers or self
    'basic_salary', CASE WHEN v_can_view_payroll THEN v_emp.basic_salary ELSE NULL END,
    'total_salary', CASE WHEN v_can_view_payroll THEN v_emp.total_salary ELSE NULL END,
    'housing_allowance', CASE WHEN v_can_view_payroll THEN v_emp.housing_allowance ELSE NULL END,
    'transport_allowance', CASE WHEN v_can_view_payroll THEN v_emp.transport_allowance ELSE NULL END,
    'other_allowances', CASE WHEN v_can_view_payroll THEN v_emp.other_allowances ELSE NULL END,
    'bank_name', CASE WHEN v_can_view_payroll THEN v_emp.bank_name ELSE NULL END,
    'iban', CASE WHEN v_can_view_payroll THEN v_emp.iban ELSE NULL END,
    'gosi_number', CASE WHEN v_can_view_payroll THEN v_emp.gosi_number ELSE NULL END
  );

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_detail FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_detail TO authenticated;

-- 6. Strict Financial Authorization for update_employee_bank_details and update_employee_compensation
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
  v_is_super boolean;
  v_is_financial boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود.';
  END IF;

  v_is_super := public.current_user_has_any_role(ARRAY['super_admin']);
  v_is_financial := public.current_user_has_any_role(ARRAY['payroll_officer', 'finance_officer']);

  -- Strictly require explicit financial permissions (super_admin or payroll/finance officer for company)
  IF NOT (
    v_is_super
    OR (v_is_financial AND v_emp.company_id = auth.current_company_id())
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل الحساب البنكي للموظف. يتطلب هذا الإجراء صلاحيات مالية معتمدة.';
  END IF;

  UPDATE public.employees
  SET
    bank_name = p_bank_name,
    iban = p_iban,
    updated_at = now()
  WHERE id = p_employee_id;

  INSERT INTO public.audit_events (
    action,
    action_type,
    actor_user_id,
    entity_type,
    entity_id,
    changes_summary
  ) VALUES (
    'update_bank_details',
    'financial_update',
    v_user_id,
    'employee',
    p_employee_id,
    format('تحديث بيانات الحساب البنكي للموظف %s (تم حجب الآيبان لأغراض الأمان)', v_emp.employee_no)
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم تحديث الحساب البنكي بنجاح.');
END;
$$;

REVOKE ALL ON FUNCTION public.update_employee_bank_details FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_employee_bank_details TO authenticated;

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
  v_is_super boolean;
  v_is_financial boolean;
  v_total numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المطلوب غير موجود.';
  END IF;

  v_is_super := public.current_user_has_any_role(ARRAY['super_admin']);
  v_is_financial := public.current_user_has_any_role(ARRAY['payroll_officer', 'finance_officer']);

  -- Strictly require explicit financial permissions (super_admin or payroll/finance officer for company)
  IF NOT (
    v_is_super
    OR (v_is_financial AND v_emp.company_id = auth.current_company_id())
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل بيانات الراتب والبدلات للموظف. يتطلب هذا الإجراء صلاحيات مالية معتمدة.';
  END IF;

  v_total := COALESCE(p_basic_salary, 0) + COALESCE(p_housing_allowance, 0) + COALESCE(p_transport_allowance, 0) + COALESCE(p_other_allowances, 0);

  UPDATE public.employees
  SET
    basic_salary = COALESCE(p_basic_salary, 0),
    housing_allowance = COALESCE(p_housing_allowance, 0),
    transport_allowance = COALESCE(p_transport_allowance, 0),
    other_allowances = COALESCE(p_other_allowances, 0),
    total_salary = v_total,
    updated_at = now()
  WHERE id = p_employee_id;

  INSERT INTO public.audit_events (
    action,
    action_type,
    actor_user_id,
    entity_type,
    entity_id,
    changes_summary
  ) VALUES (
    'update_compensation',
    'financial_update',
    v_user_id,
    'employee',
    p_employee_id,
    format('تحديث بيانات الراتب والبدلات للموظف %s', v_emp.employee_no)
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم تحديث بيانات الراتب والبدلات بنجاح.');
END;
$$;

REVOKE ALL ON FUNCTION public.update_employee_compensation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_employee_compensation TO authenticated;

-- 7. Metadata-First Storage RLS Policies for employee-avatars
DROP POLICY IF EXISTS "employee_avatars_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_tenant_insert" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_tenant_update" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_tenant_delete" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_metadata_read" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_controlled_insert" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_metadata_update" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_metadata_delete" ON storage.objects;

-- Controlled upload: HR of company or employee uploading in own folder
CREATE POLICY "employee_avatars_controlled_insert" ON storage.objects
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

-- Metadata-First Read: super_admin or active file_objects record matching tenant
CREATE POLICY "employee_avatars_metadata_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR EXISTS (
        SELECT 1 FROM public.file_objects fo
        WHERE fo.bucket_id = 'employee-avatars'
          AND fo.object_path = storage.objects.name
          AND fo.status = 'active'
          AND (fo.company_id = auth.current_company_id() OR fo.company_id IS NULL)
      )
      -- Allow immediate read during upload phase within user's own tenant folder
      OR (
        (storage.foldername(name))[1] = auth.current_company_id()::text
        AND (
          public.current_user_can_manage_company(auth.current_company_id())
          OR (storage.foldername(name))[2] = public.current_employee_id()::text
        )
      )
    )
  );

-- Metadata-First Modify: Authorized HR or employee owning the registered file object
CREATE POLICY "employee_avatars_metadata_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR EXISTS (
        SELECT 1 FROM public.file_objects fo
        WHERE fo.bucket_id = 'employee-avatars'
          AND fo.object_path = storage.objects.name
          AND fo.status = 'active'
          AND fo.company_id = auth.current_company_id()
          AND (
            public.current_user_can_manage_company(fo.company_id)
            OR fo.employee_id = public.current_employee_id()
          )
      )
    )
  );

-- Metadata-First Delete: Authorized HR or employee owning the registered file object
CREATE POLICY "employee_avatars_metadata_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR EXISTS (
        SELECT 1 FROM public.file_objects fo
        WHERE fo.bucket_id = 'employee-avatars'
          AND fo.object_path = storage.objects.name
          AND fo.company_id = auth.current_company_id()
          AND (
            public.current_user_can_manage_company(fo.company_id)
            OR fo.employee_id = public.current_employee_id()
          )
      )
      -- Allow deletion of orphan during upload error handling
      OR (
        (storage.foldername(name))[1] = auth.current_company_id()::text
        AND (
          public.current_user_can_manage_company(auth.current_company_id())
          OR (storage.foldername(name))[2] = public.current_employee_id()::text
        )
      )
    )
  );
