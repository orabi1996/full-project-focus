-- ============================================================================
-- Migration: 20260915020000_finalize_employee_field_security_and_directory_truthfulness.sql
-- Description:
-- 1. Eliminates cross-tenant role bypass in update_employee_hr_profile and update_employee_assignment.
-- 2. Enforces strict financial authorization during employee creation in create_employee.
-- 3. Extends update_employee_hr_profile to manage sensitive compliance and identity fields.
-- 4. Enforces row-affected verification across all update RPCs.
-- 5. Restores strict metadata-first storage RLS on employee-avatars (no path-based read fallback).
-- 6. Aligns get_employee_directory with canonical sorting, server-side gender filter, and expiring docs.
-- 7. Fixes get_employee_directory_kpis contract (active_employees, employed workforce, Saudization denominator, HR restriction).
-- ============================================================================

-- Ensure employee domain ENUMs exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_gender') THEN
    CREATE TYPE public.employee_gender AS ENUM ('male', 'female');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_marital_status') THEN
    CREATE TYPE public.employee_marital_status AS ENUM ('single', 'married', 'divorced', 'widowed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_contract_type') THEN
    CREATE TYPE public.employee_contract_type AS ENUM ('full_time', 'part_time', 'contractor', 'contract', 'seasonal', 'internship');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_work_type') THEN
    CREATE TYPE public.employee_work_type AS ENUM ('on_site', 'remote', 'hybrid');
  END IF;
END $$;

-- 1. Hardened update_employee_hr_profile RPC (Eliminating Cross-Tenant Role Bypass & Adding Compliance Fields)
DROP FUNCTION IF EXISTS public.update_employee_hr_profile(uuid, text, text, text, text, text, text, text, text, text, date, text, text);
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
  p_gender text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_marital_status text DEFAULT NULL,
  p_job_title text DEFAULT NULL,
  p_national_id_expiry date DEFAULT NULL,
  p_passport_no text DEFAULT NULL,
  p_passport_expiry date DEFAULT NULL,
  p_blood_type text DEFAULT NULL,
  p_dependents_count integer DEFAULT NULL,
  p_job_grade text DEFAULT NULL
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

  -- Strictly require company management permission on the employee's company
  -- Eliminates independent role bypass (OR public.current_user_has_any_role)
  IF NOT public.current_user_can_manage_company(v_emp.company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل الملف الشخصي لهذا الموظف خارج نطاق شركتك.';
  END IF;

  IF btrim(COALESCE(p_first_name_ar, '')) = '' OR btrim(COALESCE(p_last_name_ar, '')) = '' THEN
    RAISE EXCEPTION 'الاسم الأول واسم العائلة باللغة العربية إلزاميان.';
  END IF;

  UPDATE public.employees
  SET
    first_name_ar = btrim(p_first_name_ar),
    last_name_ar = btrim(p_last_name_ar),
    first_name_en = p_first_name_en,
    last_name_en = p_last_name_en,
    full_name = btrim(p_first_name_ar || ' ' || p_last_name_ar),
    email = p_email,
    phone = p_phone,
    national_id_or_iqama = COALESCE(p_national_id, national_id_or_iqama),
    nationality = COALESCE(p_nationality, nationality),
    gender = CASE WHEN p_gender IS NOT NULL AND p_gender <> '' THEN p_gender::public.employee_gender ELSE gender END,
    birth_date = COALESCE(p_birth_date, birth_date),
    marital_status = CASE WHEN p_marital_status IS NOT NULL AND p_marital_status <> '' THEN p_marital_status::public.employee_marital_status ELSE marital_status END,
    job_title = COALESCE(p_job_title, job_title),
    national_id_expiry = COALESCE(p_national_id_expiry, national_id_expiry),
    passport_no = COALESCE(p_passport_no, passport_no),
    passport_expiry = COALESCE(p_passport_expiry, passport_expiry),
    blood_type = COALESCE(p_blood_type, blood_type),
    dependents_count = COALESCE(p_dependents_count, dependents_count),
    job_grade = COALESCE(p_job_grade, job_grade),
    updated_at = now()
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'فشل التحديث: لم يتم العثور على سجل الموظف أو لم يتأثر أي صف.';
  END IF;

  INSERT INTO public.audit_events (
    action,
    action_type,
    actor_user_id,
    entity_type,
    entity_id,
    changes_summary
  ) VALUES (
    'update_hr_profile',
    'profile_update',
    v_user_id,
    'employee',
    p_employee_id,
    format('تحديث البيانات الشخصية والامتثال للموظف %s', v_emp.employee_no)
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم تحديث البيانات الشخصية والامتثال بنجاح.');
END;
$$;

REVOKE ALL ON FUNCTION public.update_employee_hr_profile FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_employee_hr_profile TO authenticated;

-- 2. Hardened update_employee_assignment RPC (Eliminating Cross-Tenant Role Bypass & Validating Organization Boundaries)
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

  -- Strictly require company management permission on the employee's company
  -- Eliminates independent role bypass (OR public.current_user_has_any_role)
  IF NOT public.current_user_can_manage_company(v_emp.company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل التعيينات الإدارية لهذا الموظف خارج نطاق شركتك.';
  END IF;

  -- Validate organization references belong to employee company
  IF p_department_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.departments WHERE id = p_department_id AND company_id = v_emp.company_id
  ) THEN
    RAISE EXCEPTION 'القسم المحدد غير تابع لمنشأة الموظف.';
  END IF;

  IF p_subsidiary_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subsidiaries WHERE id = p_subsidiary_id AND company_id = v_emp.company_id
  ) THEN
    RAISE EXCEPTION 'الشركة التابعة المحددة غير تابعة لمنشأة الموظف.';
  END IF;

  IF p_work_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.work_locations WHERE id = p_work_location_id AND company_id = v_emp.company_id
  ) THEN
    RAISE EXCEPTION 'مقر العمل المحدد غير تابع لمنشأة الموظف.';
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'فشل التحديث: لم يتم العثور على سجل الموظف أو لم يتأثر أي صف.';
  END IF;

  INSERT INTO public.audit_events (
    action,
    action_type,
    actor_user_id,
    entity_type,
    entity_id,
    changes_summary
  ) VALUES (
    'update_assignment',
    'assignment_update',
    v_user_id,
    'employee',
    p_employee_id,
    format('تحديث التعيين الإداري للموظف %s', v_emp.employee_no)
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم تحديث التعيين الإداري بنجاح.');
END;
$$;

REVOKE ALL ON FUNCTION public.update_employee_assignment FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_employee_assignment TO authenticated;

-- 3. Hardened create_employee RPC with Financial Permission Enforcement
CREATE OR REPLACE FUNCTION public.create_employee(
  p_first_name_ar text,
  p_last_name_ar text,
  p_first_name_en text DEFAULT NULL,
  p_last_name_en text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_national_id_or_iqama text DEFAULT NULL,
  p_nationality text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_marital_status text DEFAULT NULL,
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
  v_is_financial boolean;
  v_employee_no text;
  v_new_id uuid;
  v_full_name text;
  v_has_financial_input boolean;
  v_effective_gender public.employee_gender;
  v_effective_marital public.employee_marital_status;
  v_effective_contract public.employee_contract_type;
BEGIN
  -- 1. Require authenticated user
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لإنشاء موظف.';
  END IF;

  v_is_super := public.current_user_has_any_role(ARRAY['super_admin']);

  -- 2. Resolve authoritative company from trusted DB functions
  IF p_target_company_id IS NOT NULL THEN
    IF NOT (v_is_super OR p_target_company_id = public.current_company_id()) THEN
      RAISE EXCEPTION 'غير مصرح لك بإنشاء موظف في منشأة أخرى.';
    END IF;
    v_company_id := p_target_company_id;
  ELSE
    v_company_id := public.current_company_id();
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد منشأة الموظف المعتمدة بصورة موثوقة. لا يوجد سياق منشأة معتمد للمستخدم.';
  END IF;

  -- 3. Authorization check
  IF NOT public.current_user_can_manage_company(v_company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بإنشاء موظف في هذه المنشأة.';
  END IF;

  -- 4. Financial Data Permission Gate
  -- Check if client attempted to set financial values
  v_has_financial_input := (
    COALESCE(p_basic_salary, 0) > 0
    OR COALESCE(p_housing_allowance, 0) > 0
    OR COALESCE(p_transport_allowance, 0) > 0
    OR COALESCE(p_other_allowances, 0) > 0
    OR (p_bank_name IS NOT NULL AND btrim(p_bank_name) <> '')
    OR (p_iban IS NOT NULL AND btrim(p_iban) <> '')
  );

  v_is_financial := v_is_super OR (
    public.current_user_has_any_role(ARRAY['payroll_officer', 'finance_officer'])
    AND v_company_id = public.current_company_id()
  );

  IF v_has_financial_input AND NOT v_is_financial THEN
    RAISE EXCEPTION 'غير مصرح لك بتسجيل بيانات الراتب أو الحساب البنكي للموظف. يتطلب هذا الإجراء صلاحيات مالية معتمدة.';
  END IF;

  -- 5. Validation
  IF btrim(COALESCE(p_first_name_ar, '')) = '' OR btrim(COALESCE(p_last_name_ar, '')) = '' THEN
    RAISE EXCEPTION 'الاسم الأول واسم العائلة باللغة العربية إلزاميان للتوثيق المالي والقانوني ولإنشاء الموظف.';
  END IF;

  v_full_name := btrim(p_first_name_ar || ' ' || p_last_name_ar);

  -- 6. Validate organization references belong to target company
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

  -- 7. Allocate employee number transactionally
  v_employee_no := public.generate_company_employee_no(v_company_id);

  v_effective_gender := COALESCE(NULLIF(p_gender, '')::public.employee_gender, 'male'::public.employee_gender);
  v_effective_marital := COALESCE(NULLIF(p_marital_status, '')::public.employee_marital_status, 'single'::public.employee_marital_status);
  v_effective_contract := COALESCE(NULLIF(p_contract_type, '')::public.employee_contract_type, 'full_time'::public.employee_contract_type);

  -- 8. Insert employee row (status starts as draft)
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
    v_effective_gender,
    p_birth_date,
    v_effective_marital,
    COALESCE(p_hire_date, current_date),
    v_effective_contract,
    p_job_title,
    p_department_id,
    p_subsidiary_id,
    p_work_location_id,
    p_job_position_id,
    p_cost_center_id,
    p_manager_id,
    COALESCE(p_work_type, 'on_site'),
    CASE WHEN v_is_financial THEN COALESCE(p_basic_salary, 0) ELSE 0 END,
    CASE WHEN v_is_financial THEN (COALESCE(p_basic_salary, 0) + COALESCE(p_housing_allowance, 0) + COALESCE(p_transport_allowance, 0) + COALESCE(p_other_allowances, 0)) ELSE 0 END,
    CASE WHEN v_is_financial THEN COALESCE(p_housing_allowance, 0) ELSE 0 END,
    CASE WHEN v_is_financial THEN COALESCE(p_transport_allowance, 0) ELSE 0 END,
    CASE WHEN v_is_financial THEN COALESCE(p_other_allowances, 0) ELSE 0 END,
    CASE WHEN v_is_financial THEN p_bank_name ELSE NULL END,
    CASE WHEN v_is_financial THEN p_iban ELSE NULL END,
    p_job_grade,
    'draft'::public.employee_status
  )
  RETURNING id INTO v_new_id;

  -- 9. Write audit event
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

-- 4. Enhanced get_employee_directory RPC (Server-Side Gender, Canonical Sorts, and Expiring Docs Quick Filter)
DROP FUNCTION IF EXISTS public.get_employee_directory(text, text, uuid, uuid, uuid, integer, integer, text);
DROP FUNCTION IF EXISTS public.get_employee_directory(text, text, uuid, uuid, uuid, integer, integer, text, text, text, text, numeric, numeric);
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
  p_max_salary numeric DEFAULT NULL,
  p_gender text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
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
  v_is_hr := v_is_super OR public.current_user_can_manage_company(v_company_id);
  v_can_view_payroll := v_is_super OR (
    public.current_user_has_any_role(ARRAY['payroll_officer', 'finance_officer'])
    AND v_company_id = public.current_company_id()
  );
  v_can_search_sensitive := v_is_hr;

  -- Tenant scope enforcement
  IF NOT v_is_super AND v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'items', '[]'::jsonb,
      'total_count', 0,
      'page', COALESCE(p_page, 1),
      'page_size', COALESCE(p_page_size, 25),
      'message', 'لا يوجد سياق منشأة معتمد'
    );
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_page_size, 25), 100));
  v_offset := (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_limit;

  -- Count total matching records
  SELECT count(*) INTO v_total
  FROM public.employees e
  WHERE (v_is_super OR e.company_id = v_company_id)
    AND (p_status IS NULL OR p_status = 'all' OR e.status::text = p_status)
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (p_subsidiary_id IS NULL OR e.subsidiary_id = p_subsidiary_id)
    AND (p_location_id IS NULL OR e.work_location_id = p_location_id)
    AND (p_contract_type IS NULL OR p_contract_type = 'all' OR e.contract_type::text = p_contract_type)
    AND (p_gender IS NULL OR p_gender = 'all' OR e.gender::text = p_gender)
    AND (
      p_nationality IS NULL OR p_nationality = 'all'
      OR (p_nationality = 'saudi' AND e.nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
      OR (p_nationality = 'expat' AND e.nationality IS NOT NULL AND btrim(e.nationality) <> '' AND e.nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
      OR (p_nationality = 'unknown' AND (e.nationality IS NULL OR btrim(e.nationality) = ''))
      OR e.nationality = p_nationality
    )
    AND (
      p_quick_preset IS NULL OR p_quick_preset = 'all'
      OR (p_quick_preset = 'saudi' AND e.nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
      OR (p_quick_preset = 'expat' AND e.nationality IS NOT NULL AND btrim(e.nationality) <> '' AND e.nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
      OR (p_quick_preset = 'probation' AND e.status = 'probation')
      OR (p_quick_preset = 'on_leave' AND e.status = 'on_leave')
      OR (p_quick_preset = 'remote_hybrid' AND e.work_type IN ('remote', 'hybrid'))
      OR (p_quick_preset = 'complete_profile' AND e.completion_score >= 95)
      OR (p_quick_preset = 'expiring_docs' AND EXISTS (
        SELECT 1 FROM public.employee_documents ed
        WHERE ed.employee_id = e.id
          AND ed.expiry_date IS NOT NULL
          AND ed.expiry_date <= (current_date + interval '60 days')
      ))
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
      'job_title_ar', e.job_title,
      'status', e.status,
      'hire_date', e.hire_date,
      'contract_type', e.contract_type,
      'work_type', e.work_type,
      'gender', e.gender,
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
      'qiwa_contract_no', CASE WHEN v_is_hr THEN e.qiwa_contract_no ELSE NULL END,
      'job_grade', e.job_grade
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
      AND (p_gender IS NULL OR p_gender = 'all' OR e.gender::text = p_gender)
      AND (
        p_nationality IS NULL OR p_nationality = 'all'
        OR (p_nationality = 'saudi' AND e.nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
        OR (p_nationality = 'expat' AND e.nationality IS NOT NULL AND btrim(e.nationality) <> '' AND e.nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
        OR (p_nationality = 'unknown' AND (e.nationality IS NULL OR btrim(e.nationality) = ''))
        OR e.nationality = p_nationality
      )
      AND (
        p_quick_preset IS NULL OR p_quick_preset = 'all'
        OR (p_quick_preset = 'saudi' AND e.nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
        OR (p_quick_preset = 'expat' AND e.nationality IS NOT NULL AND btrim(e.nationality) <> '' AND e.nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia'))
        OR (p_quick_preset = 'probation' AND e.status = 'probation')
        OR (p_quick_preset = 'on_leave' AND e.status = 'on_leave')
        OR (p_quick_preset = 'remote_hybrid' AND e.work_type IN ('remote', 'hybrid'))
        OR (p_quick_preset = 'complete_profile' AND e.completion_score >= 95)
        OR (p_quick_preset = 'expiring_docs' AND EXISTS (
          SELECT 1 FROM public.employee_documents ed
          WHERE ed.employee_id = e.id
            AND ed.expiry_date IS NOT NULL
            AND ed.expiry_date <= (current_date + interval '60 days')
        ))
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
      CASE WHEN p_sort = 'hire_date_desc' OR p_sort = 'date_desc' THEN e.hire_date END DESC,
      CASE WHEN p_sort = 'hire_date_asc' OR p_sort = 'date_asc' THEN e.hire_date END ASC,
      CASE WHEN p_sort = 'employee_no_asc' THEN e.employee_no END ASC,
      CASE WHEN p_sort = 'employee_no_desc' THEN e.employee_no END DESC,
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

-- 5. Hardened get_employee_directory_kpis RPC (Truthful Metrics, Active Employees & HR Authorization Guard)
CREATE OR REPLACE FUNCTION public.get_employee_directory_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_is_super boolean;
  v_is_hr boolean;
  v_total_employees integer := 0;
  v_total_employed integer := 0;
  v_active_employees integer := 0;
  v_saudi_employees integer := 0;
  v_non_saudi_employees integer := 0;
  v_unknown_nationality integer := 0;
  v_saudization_rate numeric := 0;
  v_probation_count integer := 0;
  v_on_leave_count integer := 0;
  v_expiring_docs_count integer := 0;
  v_known_nationality_total integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يرجى تسجيل الدخول.';
  END IF;

  v_is_super := public.current_user_has_any_role(ARRAY['super_admin']);
  v_is_hr := v_is_super OR public.current_user_can_manage_company(v_company_id);

  IF NOT v_is_super AND v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'لا يوجد معرف منشأة معتمد'
    );
  END IF;

  -- 1. General workforce counts:
  -- total_employed: active workforce (active, probation, on_leave)
  -- active_employees: active at work (active)
  -- Exclude draft, preboarding, suspended, terminated from employed workforce
  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('active', 'probation', 'on_leave')),
    count(*) FILTER (WHERE status = 'active'),
    count(*) FILTER (WHERE nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia')),
    count(*) FILTER (WHERE nationality IS NOT NULL AND btrim(nationality) <> '' AND nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia')),
    count(*) FILTER (WHERE nationality IS NULL OR btrim(nationality) = ''),
    count(*) FILTER (WHERE status = 'probation'),
    count(*) FILTER (WHERE status = 'on_leave')
  INTO
    v_total_employees,
    v_total_employed,
    v_active_employees,
    v_saudi_employees,
    v_non_saudi_employees,
    v_unknown_nationality,
    v_probation_count,
    v_on_leave_count
  FROM public.employees
  WHERE (v_is_super OR company_id = v_company_id)
    AND status <> 'terminated';

  -- Saudization calculation: known Saudi / (known Saudi + known Non-Saudi)
  v_known_nationality_total := v_saudi_employees + v_non_saudi_employees;
  IF v_known_nationality_total > 0 THEN
    v_saudization_rate := round((v_saudi_employees::numeric / v_known_nationality_total::numeric) * 100);
  ELSE
    v_saudization_rate := 0;
  END IF;

  -- Aggregate expiring documents count (HR authorized only)
  IF v_is_hr THEN
    SELECT count(DISTINCT employee_id)
    INTO v_expiring_docs_count
    FROM public.employee_documents
    WHERE (v_is_super OR company_id = v_company_id)
      AND expiry_date IS NOT NULL
      AND expiry_date <= (current_date + interval '60 days');
  ELSE
    v_expiring_docs_count := 0;
  END IF;

  -- If caller is not HR, restrict sensitive compliance/lifecycle metrics
  IF NOT v_is_hr THEN
    RETURN jsonb_build_object(
      'available', true,
      'hr_restricted', true,
      'total_employees', v_total_employees,
      'total_employed', v_total_employed,
      'active_employees', v_active_employees,
      'saudi_employees', v_saudi_employees,
      'non_saudi_employees', v_non_saudi_employees,
      'unknown_nationality_count', v_unknown_nationality,
      'expat_employees', v_non_saudi_employees,
      'saudization_rate', v_saudization_rate,
      'probation_count', 0,
      'on_leave_count', 0,
      'expiring_docs_count', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'available', true,
    'hr_restricted', false,
    'total_employees', v_total_employees,
    'total_employed', v_total_employed,
    'active_employees', v_active_employees,
    'saudi_employees', v_saudi_employees,
    'non_saudi_employees', v_non_saudi_employees,
    'unknown_nationality_count', v_unknown_nationality,
    'expat_employees', v_non_saudi_employees,
    'saudization_rate', v_saudization_rate,
    'probation_count', v_probation_count,
    'on_leave_count', v_on_leave_count,
    'expiring_docs_count', v_expiring_docs_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_directory_kpis FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_directory_kpis TO authenticated;

-- 6. Strict Metadata-First Storage RLS for employee-avatars (Eliminating Path Fallback on SELECT)
DROP POLICY IF EXISTS "employee_avatars_path_read_fallback" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_metadata_read" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_controlled_insert" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_metadata_update" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatars_metadata_delete" ON storage.objects;

-- Controlled Upload: Authorized HR or employee uploading in own tenant path
CREATE POLICY "employee_avatars_controlled_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR (
        (storage.foldername(name))[1] = public.current_company_id()::text
        AND (
          public.current_user_can_manage_company(public.current_company_id())
          OR (storage.foldername(name))[2] = public.current_employee_id()::text
        )
      )
    )
  );

-- Strict Metadata-First Read: Caller must be super_admin OR active file_objects record matching tenant employee entity
CREATE POLICY "employee_avatars_metadata_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR EXISTS (
        SELECT 1 FROM public.file_objects fo
        JOIN public.employees e ON e.id = fo.employee_id
        WHERE fo.bucket_id = 'employee-avatars'
          AND fo.object_path = storage.objects.name
          AND fo.status = 'active'
          AND fo.entity_type = 'employee_avatar'
          AND fo.entity_id = e.id::text
          AND fo.company_id = public.current_company_id()
          AND e.company_id = public.current_company_id()
      )
    )
  );

-- Strict Metadata-First Update: Authorized HR or employee owning the registered file object
CREATE POLICY "employee_avatars_metadata_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR EXISTS (
        SELECT 1 FROM public.file_objects fo
        JOIN public.employees e ON e.id = fo.employee_id
        WHERE fo.bucket_id = 'employee-avatars'
          AND fo.object_path = storage.objects.name
          AND fo.status = 'active'
          AND fo.entity_type = 'employee_avatar'
          AND fo.entity_id = e.id::text
          AND fo.company_id = public.current_company_id()
          AND (
            public.current_user_can_manage_company(fo.company_id)
            OR fo.employee_id = public.current_employee_id()
          )
      )
    )
  );

-- Strict Metadata-First Delete: Authorized HR or employee owning the registered file object
CREATE POLICY "employee_avatars_metadata_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (
      public.current_user_has_any_role(ARRAY['super_admin'])
      OR EXISTS (
        SELECT 1 FROM public.file_objects fo
        JOIN public.employees e ON e.id = fo.employee_id
        WHERE fo.bucket_id = 'employee-avatars'
          AND fo.object_path = storage.objects.name
          AND fo.company_id = public.current_company_id()
          AND (
            public.current_user_can_manage_company(fo.company_id)
            OR fo.employee_id = public.current_employee_id()
          )
      )
      -- Allow deletion of orphan during upload error handling in user's tenant folder
      OR (
        (storage.foldername(name))[1] = public.current_company_id()::text
        AND (
          public.current_user_can_manage_company(public.current_company_id())
          OR (storage.foldername(name))[2] = public.current_employee_id()::text
        )
      )
    )
  );
