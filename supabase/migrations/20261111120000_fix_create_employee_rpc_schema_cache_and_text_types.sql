-- ============================================================================
-- Migration: Fix public.create_employee RPC & Reload PostgREST Schema Cache
-- Ensures all extended columns exist on public.employees and replaces
-- non-existent enum casts (employee_gender, employee_marital_status,
-- employee_contract_type, employee_work_type) with standard text types.
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS job_position_id uuid,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid,
  ADD COLUMN IF NOT EXISTS work_type text,
  ADD COLUMN IF NOT EXISTS housing_allowance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowances numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_grade text,
  ADD COLUMN IF NOT EXISTS qiwa_contract_no text,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS national_id_expiry date,
  ADD COLUMN IF NOT EXISTS passport_no text,
  ADD COLUMN IF NOT EXISTS passport_expiry date,
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS dependents_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gosi_number text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_storage_path text;

CREATE OR REPLACE FUNCTION public.create_employee(
  p_first_name_ar        text,
  p_last_name_ar         text,
  p_first_name_en        text    DEFAULT NULL,
  p_last_name_en         text    DEFAULT NULL,
  p_email                text    DEFAULT NULL,
  p_phone                text    DEFAULT NULL,
  p_national_id_or_iqama text    DEFAULT NULL,
  p_nationality          text    DEFAULT NULL,
  p_gender               text    DEFAULT NULL,
  p_birth_date           date    DEFAULT NULL,
  p_marital_status       text    DEFAULT NULL,
  p_hire_date            date    DEFAULT NULL,
  p_contract_type        text    DEFAULT NULL,
  p_job_title            text    DEFAULT NULL,
  p_department_id        uuid    DEFAULT NULL,
  p_subsidiary_id        uuid    DEFAULT NULL,
  p_work_location_id     uuid    DEFAULT NULL,
  p_job_position_id      uuid    DEFAULT NULL,
  p_cost_center_id       uuid    DEFAULT NULL,
  p_manager_id           uuid    DEFAULT NULL,
  p_work_type            text    DEFAULT NULL,
  p_basic_salary         numeric DEFAULT 0,
  p_housing_allowance    numeric DEFAULT 0,
  p_transport_allowance  numeric DEFAULT 0,
  p_other_allowances     numeric DEFAULT 0,
  p_bank_name            text    DEFAULT NULL,
  p_iban                 text    DEFAULT NULL,
  p_job_grade            text    DEFAULT NULL,
  p_target_company_id    uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_company_id    uuid;
  v_employee_no   text;
  v_new_id        uuid;
  v_full_name     text;
  v_total_salary  numeric;
BEGIN
  IF btrim(COALESCE(p_first_name_ar, '')) = '' OR btrim(COALESCE(p_last_name_ar, '')) = '' THEN
    RAISE EXCEPTION 'الاسم الأول واسم العائلة باللغة العربية إلزاميان للتوثيق المالي والقانوني ولإنشاء الموظف.';
  END IF;

  IF p_hire_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ التعيين إلزامي ولا يمكن ترك هذا الحقل فارغاً.';
  END IF;

  IF p_contract_type IS NULL OR btrim(p_contract_type) = '' THEN
    RAISE EXCEPTION 'نوع العقد إلزامي ولا يمكن ترك هذا الحقل فارغاً.';
  END IF;

  IF p_work_type IS NULL OR btrim(p_work_type) = '' THEN
    RAISE EXCEPTION 'نمط العمل إلزامي ولا يمكن ترك هذا الحقل فارغاً.';
  END IF;

  v_company_id := COALESCE(p_target_company_id, public.current_company_id());
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id FROM public.companies ORDER BY created_at ASC LIMIT 1;
  END IF;

  BEGIN
    v_employee_no := public.generate_company_employee_no(v_company_id);
  EXCEPTION WHEN OTHERS THEN
    v_employee_no := 'MX-' || floor(100000 + random() * 900000)::int::text;
  END;

  v_full_name := btrim(p_first_name_ar || ' ' || p_last_name_ar);
  v_total_salary := COALESCE(p_basic_salary, 0) + COALESCE(p_housing_allowance, 0) + COALESCE(p_transport_allowance, 0) + COALESCE(p_other_allowances, 0);

  INSERT INTO public.employees (
    company_id, employee_no, full_name, first_name_ar, last_name_ar,
    first_name_en, last_name_en, email, phone, national_id_or_iqama,
    nationality, gender, birth_date, marital_status, hire_date,
    contract_type, job_title, department_id, subsidiary_id, work_location_id,
    job_position_id, cost_center_id, manager_id, work_type,
    basic_salary, total_salary, housing_allowance, transport_allowance, other_allowances,
    bank_name, iban, job_grade, status
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
    NULLIF(btrim(COALESCE(p_gender, '')), ''),
    p_birth_date,
    NULLIF(btrim(COALESCE(p_marital_status, '')), ''),
    p_hire_date,
    btrim(p_contract_type),
    p_job_title,
    p_department_id,
    p_subsidiary_id,
    p_work_location_id,
    p_job_position_id,
    p_cost_center_id,
    p_manager_id,
    btrim(p_work_type),
    COALESCE(p_basic_salary, 0),
    v_total_salary,
    COALESCE(p_housing_allowance, 0),
    COALESCE(p_transport_allowance, 0),
    COALESCE(p_other_allowances, 0),
    p_bank_name,
    p_iban,
    p_job_grade,
    'draft'::public.employee_status
  )
  RETURNING id INTO v_new_id;

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
GRANT EXECUTE ON FUNCTION public.create_employee TO anon;

NOTIFY pgrst, 'reload schema';
