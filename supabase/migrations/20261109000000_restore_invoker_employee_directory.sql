-- Restore missing directory RPCs on the deployed legacy schema.
-- SECURITY INVOKER preserves table grants and RLS; this migration does not widen them.
-- Optional presentation columns are read as JSON keys so both schema generations work.
BEGIN;
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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := (SELECT CASE WHEN count(DISTINCT company_id) = 1 THEN min(company_id::text)::uuid END FROM public.employees WHERE user_id = auth.uid());
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

  v_is_super := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'super_admin');
  v_is_hr := v_is_super OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('org_admin', 'hr_manager'));
  v_can_view_payroll := v_is_super OR (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('payroll_officer', 'finance_officer'))
    AND v_company_id IS NOT NULL
  );
  v_can_search_sensitive := v_is_hr;
  IF NOT v_can_view_payroll AND (p_min_salary IS NOT NULL OR p_max_salary IS NOT NULL) THEN
    RAISE EXCEPTION 'Salary filtering is not permitted' USING ERRCODE = '42501';
  END IF;

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
      OR (p_quick_preset = 'probation' AND e.status::text = 'probation')
      OR (p_quick_preset = 'on_leave' AND e.status::text = 'on_leave')
      OR (p_quick_preset = 'remote_hybrid' AND (to_jsonb(e)->>'work_type') IN ('remote', 'hybrid'))
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
      'work_type', (to_jsonb(e)->>'work_type'),
      'gender', e.gender,
      'department_id', e.department_id,
      'department_name', d.name,
      'subsidiary_id', e.subsidiary_id,
      'subsidiary_name', s.name_ar,
      'work_location_id', e.work_location_id,
      'work_location_name', w.name_ar,
      'avatar_url', (to_jsonb(e)->>'avatar_url'),
      'avatar_storage_path', (to_jsonb(e)->>'avatar_storage_path'),
      'completion_score', e.completion_score,
      'nationality', CASE WHEN v_is_hr THEN e.nationality ELSE NULL END,
      'qiwa_contract_no', CASE WHEN v_is_hr THEN (to_jsonb(e)->>'qiwa_contract_no') ELSE NULL END,
      'job_grade', (to_jsonb(e)->>'job_grade')
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
        OR (p_quick_preset = 'probation' AND e.status::text = 'probation')
        OR (p_quick_preset = 'on_leave' AND e.status::text = 'on_leave')
        OR (p_quick_preset = 'remote_hybrid' AND (to_jsonb(e)->>'work_type') IN ('remote', 'hybrid'))
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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := (SELECT CASE WHEN count(DISTINCT company_id) = 1 THEN min(company_id::text)::uuid END FROM public.employees WHERE user_id = auth.uid());
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

  v_is_super := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'super_admin');
  v_is_hr := v_is_super OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('org_admin', 'hr_manager'));

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
    count(*) FILTER (WHERE status::text IN ('active', 'probation', 'on_leave')),
    count(*) FILTER (WHERE status::text = 'active'),
    count(*) FILTER (WHERE nationality IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia')),
    count(*) FILTER (WHERE nationality IS NOT NULL AND btrim(nationality) <> '' AND nationality NOT IN ('سعودي', 'سعودية', 'Saudi', 'Saudi Arabia')),
    count(*) FILTER (WHERE nationality IS NULL OR btrim(nationality) = ''),
    count(*) FILTER (WHERE status::text = 'probation'),
    count(*) FILTER (WHERE status::text = 'on_leave')
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
    AND status::text <> 'terminated';

  -- Saudization calculation: known Saudi / (known Saudi + known Non-Saudi)
  v_known_nationality_total := v_saudi_employees + v_non_saudi_employees;
  IF v_known_nationality_total > 0 THEN
    v_saudization_rate := round((v_saudi_employees::numeric / v_known_nationality_total::numeric) * 100);
  ELSE
    v_saudization_rate := 0;
  END IF;

  -- Aggregate expiring documents count (HR authorized only)
  IF v_is_hr THEN
    SELECT count(DISTINCT ed.employee_id)
    INTO v_expiring_docs_count
    FROM public.employee_documents ed
    JOIN public.employees e ON e.id = ed.employee_id
    WHERE (v_is_super OR e.company_id = v_company_id)
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


NOTIFY pgrst, 'reload schema';
COMMIT;
