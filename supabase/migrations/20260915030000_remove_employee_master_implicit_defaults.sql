-- ============================================================================
-- Migration: Remove Implicit Employee Master Data Fabrication
-- Prompt 09 Final Micro-Hotfix
-- ============================================================================
-- This migration replaces create_employee with a version that:
--   1. Persists NULL for gender and marital_status instead of fabricating 'male'/'single'
--   2. Requires hire_date (rejects NULL with explicit exception)
--   3. Requires contract_type (rejects NULL/empty with explicit exception)
--   4. Requires work_type (rejects NULL/empty with explicit exception)
--
-- Preserved:
--   - SECURITY DEFINER + search_path
--   - Tenant authorization (auth.current_company_id + current_user_can_manage_company)
--   - Financial permission gate
--   - Atomic employee-number allocation (generate_company_employee_no)
--   - Audit logging to audit_events
--   - status always set to 'draft' on creation
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- Replace create_employee: remove all implicit default fabrication
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_employee(
  p_first_name_ar  text,
  p_last_name_ar   text,
  p_first_name_en  text    DEFAULT NULL,
  p_last_name_en   text    DEFAULT NULL,
  p_email          text    DEFAULT NULL,
  p_phone          text    DEFAULT NULL,
  p_national_id_or_iqama text DEFAULT NULL,
  p_nationality    text    DEFAULT NULL,
  p_gender         text    DEFAULT NULL,
  p_birth_date     date    DEFAULT NULL,
  p_marital_status text    DEFAULT NULL,
  p_hire_date      date    DEFAULT NULL,
  p_contract_type  text    DEFAULT NULL,
  p_job_title      text    DEFAULT NULL,
  p_department_id  uuid    DEFAULT NULL,
  p_subsidiary_id  uuid    DEFAULT NULL,
  p_work_location_id uuid  DEFAULT NULL,
  p_job_position_id  uuid  DEFAULT NULL,
  p_cost_center_id   uuid  DEFAULT NULL,
  p_manager_id       uuid  DEFAULT NULL,
  p_work_type      text    DEFAULT NULL,
  p_basic_salary   numeric DEFAULT 0,
  p_housing_allowance numeric DEFAULT 0,
  p_transport_allowance numeric DEFAULT 0,
  p_other_allowances  numeric DEFAULT 0,
  p_bank_name      text    DEFAULT NULL,
  p_iban           text    DEFAULT NULL,
  p_job_grade      text    DEFAULT NULL,
  p_target_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_company_id       uuid;
  v_is_super         boolean;
  v_is_financial     boolean;
  v_employee_no      text;
  v_new_id           uuid;
  v_full_name        text;
  v_has_financial_input boolean;
  v_contract_type    public.employee_contract_type;
  v_work_type        public.employee_work_type;
BEGIN
  -- 1. Require authenticated user
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لإنشاء موظف.';
  END IF;

  v_is_super := public.current_user_has_any_role(ARRAY['super_admin']);

  -- 2. Resolve authoritative company from trusted DB functions
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

  -- 4. Financial Data Permission Gate
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
    AND v_company_id = auth.current_company_id()
  );

  IF v_has_financial_input AND NOT v_is_financial THEN
    RAISE EXCEPTION 'غير مصرح لك بتسجيل بيانات الراتب أو الحساب البنكي للموظف. يتطلب هذا الإجراء صلاحيات مالية معتمدة.';
  END IF;

  -- 5. Required field validation: Arabic name
  IF btrim(COALESCE(p_first_name_ar, '')) = '' OR btrim(COALESCE(p_last_name_ar, '')) = '' THEN
    RAISE EXCEPTION 'الاسم الأول واسم العائلة باللغة العربية إلزاميان للتوثيق المالي والقانوني ولإنشاء الموظف.';
  END IF;

  -- 6. Required field validation: hire_date (removed implicit current_date fallback)
  IF p_hire_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ التعيين إلزامي ولا يمكن ترك هذا الحقل فارغاً.';
  END IF;

  -- 7. Required field validation: contract_type (removed implicit full_time fallback)
  IF p_contract_type IS NULL OR btrim(p_contract_type) = '' THEN
    RAISE EXCEPTION 'نوع العقد إلزامي ولا يمكن ترك هذا الحقل فارغاً.';
  END IF;
  BEGIN
    v_contract_type := p_contract_type::public.employee_contract_type;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'قيمة نوع العقد غير صحيحة: %.', p_contract_type;
  END;

  -- 8. Required field validation: work_type (removed implicit on_site fallback)
  IF p_work_type IS NULL OR btrim(p_work_type) = '' THEN
    RAISE EXCEPTION 'نمط العمل إلزامي ولا يمكن ترك هذا الحقل فارغاً.';
  END IF;
  BEGIN
    v_work_type := p_work_type::public.employee_work_type;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'قيمة نمط العمل غير صحيحة: %.', p_work_type;
  END;

  v_full_name := btrim(p_first_name_ar || ' ' || p_last_name_ar);

  -- 9. Validate organization references belong to target company
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

  -- 10. Allocate employee number transactionally
  v_employee_no := public.generate_company_employee_no(v_company_id);

  -- 11. Insert employee row
  --     gender/marital_status: NULL persisted as-is (no fabrication)
  --     hire_date/contract_type/work_type: required and validated above
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
    NULLIF(btrim(COALESCE(p_gender, '')), '')::public.employee_gender,
    p_birth_date,
    NULLIF(btrim(COALESCE(p_marital_status, '')), '')::public.employee_marital_status,
    p_hire_date,
    v_contract_type,
    p_job_title,
    p_department_id,
    p_subsidiary_id,
    p_work_location_id,
    p_job_position_id,
    p_cost_center_id,
    p_manager_id,
    v_work_type,
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

  -- 12. Write audit event
  INSERT INTO public.audit_events (
    action, action_type, actor_user_id, entity_type, entity_id, changes_summary
  ) VALUES (
    'create_employee', 'employee_creation', v_user_id, 'employee', v_new_id,
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

-- ============================================================================
-- Preserve grants
-- ============================================================================
REVOKE ALL ON FUNCTION public.create_employee FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee TO authenticated;

COMMENT ON FUNCTION public.create_employee IS
  'Creates a new employee record with strict truthfulness policy:
   - gender, marital_status: optional, persisted as NULL when not provided (no fabrication)
   - hire_date: required, raises exception if NULL
   - contract_type: required, raises exception if NULL or empty
   - work_type: required, raises exception if NULL or empty
   - status: always draft on creation
   - financial fields: guarded by payroll/finance permission gate
   - employee_no: allocated atomically via generate_company_employee_no';
