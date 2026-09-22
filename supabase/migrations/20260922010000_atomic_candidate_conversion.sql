-- The ledger is writable only by the conversion RPC, never by API table writes.
CREATE TABLE public.candidate_employee_conversions (
  candidate_id uuid PRIMARY KEY REFERENCES public.candidates(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  converted_by uuid NOT NULL,
  converted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.candidate_employee_conversions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidate_employee_conversions FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.convert_candidate_to_employee(
  p_candidate_id uuid, p_first_name_ar text, p_last_name_ar text,
  p_department_id uuid, p_work_location_id uuid, p_hire_date date,
  p_contract_type text, p_work_type text,
  p_basic_salary numeric DEFAULT 0, p_housing_allowance numeric DEFAULT 0,
  p_transport_allowance numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidate public.candidates%ROWTYPE;
  v_job public.job_openings%ROWTYPE;
  v_company_id uuid;
  v_employee_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لتحويل المرشح' USING ERRCODE = '42501';
  END IF;
  -- Serializes competing requests and retries for the same candidate.
  SELECT * INTO v_candidate FROM public.candidates WHERE id = p_candidate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المرشح غير موجود'; END IF;
  SELECT * INTO v_job FROM public.job_openings WHERE id = v_candidate.job_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'يلزم ربط المرشح بوظيفة وقسم تابعين لمنشأة معتمدة'; END IF;
  -- ATS has no company_id: derive the tenant from the persisted opening's department.
  SELECT company_id INTO v_company_id FROM public.departments WHERE id = v_job.department_id FOR SHARE;
  IF v_company_id IS NULL OR NOT COALESCE(public.current_user_can_manage_company(v_company_id), false)
     OR (NOT COALESCE(public.current_user_has_any_role(ARRAY['super_admin']), false)
         AND v_company_id IS DISTINCT FROM auth.current_company_id()) THEN
    RAISE EXCEPTION 'غير مصرح بتحويل المرشح في هذه المنشأة' USING ERRCODE = '42501';
  END IF;

  SELECT employee_id INTO v_employee_id FROM public.candidate_employee_conversions
    WHERE candidate_id = p_candidate_id AND company_id = v_company_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'id', v_employee_id, 'already_converted', true);
  END IF;
  IF v_candidate.stage = 'hired' THEN
    RAISE EXCEPTION 'المرشح معين سابقاً دون سجل ربط؛ يلزم مراجعة الموظف الموجود قبل التحويل';
  END IF;
  IF v_candidate.stage <> 'job_offer' THEN
    RAISE EXCEPTION 'التحويل متاح للمرشحين في مرحلة العرض الوظيفي فقط';
  END IF;
  IF p_department_id IS NULL OR p_work_location_id IS NULL THEN
    RAISE EXCEPTION 'القسم ومقر العمل إلزاميان';
  END IF;
  IF p_basic_salary IS NULL OR p_housing_allowance IS NULL OR p_transport_allowance IS NULL
    OR p_basic_salary < 0 OR p_housing_allowance < 0 OR p_transport_allowance < 0
    OR p_basic_salary::text IN ('NaN', 'Infinity', '-Infinity')
    OR p_housing_allowance::text IN ('NaN', 'Infinity', '-Infinity')
    OR p_transport_allowance::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'قيم الراتب يجب أن تكون أرقاماً غير سالبة';
  END IF;
  -- Reuse employee authorization, organization checks, financial gate, numbering and audit.
  v_result := public.create_employee(
    p_first_name_ar => btrim(p_first_name_ar), p_last_name_ar => btrim(p_last_name_ar),
    p_email => v_candidate.email, p_phone => v_candidate.phone,
    p_hire_date => p_hire_date, p_contract_type => p_contract_type,
    p_job_title => v_job.title_ar, p_department_id => p_department_id,
    p_work_location_id => p_work_location_id, p_work_type => p_work_type,
    p_basic_salary => p_basic_salary, p_housing_allowance => p_housing_allowance,
    p_transport_allowance => p_transport_allowance, p_target_company_id => v_company_id
  );
  v_employee_id := (v_result->>'id')::uuid;
  INSERT INTO public.candidate_employee_conversions(candidate_id, employee_id, company_id, converted_by)
    VALUES (p_candidate_id, v_employee_id, v_company_id, auth.uid());
  UPDATE public.candidates SET stage = 'hired' WHERE id = p_candidate_id;
  RETURN v_result || jsonb_build_object('already_converted', false);
  -- Any error rolls back employee, sequence allocation, audit, ledger and stage together.
END;
$$;
REVOKE ALL ON FUNCTION public.convert_candidate_to_employee FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_candidate_to_employee TO authenticated;

CREATE FUNCTION public.guard_candidate_conversion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (SELECT 1 FROM public.candidate_employee_conversions WHERE candidate_id = OLD.id)
       AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.stage <> 'hired') THEN
      RAISE EXCEPTION 'لا يمكن تغيير ربط أو مرحلة مرشح تم تحويله إلى موظف';
    END IF;
    IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN RETURN NEW; END IF;
  END IF;
  IF NEW.stage = 'hired' AND NOT EXISTS (
    SELECT 1 FROM public.candidate_employee_conversions WHERE candidate_id = NEW.id
  ) THEN RAISE EXCEPTION 'استخدم إجراء تحويل المرشح لإنشاء الموظف وتحديث المرحلة معاً'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_candidate_conversion FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_candidate_conversion BEFORE INSERT OR UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.guard_candidate_conversion();
