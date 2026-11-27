-- Close remaining implicit-company fallbacks in employee creation and
-- reimbursement batch preparation while preserving the public RPC signatures.
BEGIN;

-- Keep the latest implementation behind a private name. The public wrapper
-- below validates caller/company authorization and always supplies a concrete
-- company to this implementation.
ALTER FUNCTION public.create_employee(
  text, text, text, text, text, text, text, text, text, date, text, date, text, text,
  uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, text, text, text, uuid
) RENAME TO create_employee_unscoped;
REVOKE ALL ON FUNCTION public.create_employee_unscoped(
  text, text, text, text, text, text, text, text, text, date, text, date, text, text,
  uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, text, text, text, uuid
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.create_employee(
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
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_is_super_admin boolean;
  v_has_management_role boolean;
  v_has_active_membership boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لإنشاء موظف.' USING ERRCODE = '42501';
  END IF;

  v_company_id := COALESCE(p_target_company_id, public.current_company_id());
  IF v_company_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = v_company_id
  ) THEN
    RAISE EXCEPTION 'معرف المنشأة غير محدد أو غير صالح.' USING ERRCODE = '22023';
  END IF;

  v_is_super_admin := public.current_user_has_any_role(ARRAY['super_admin']);
  v_has_management_role := public.current_user_has_any_role(ARRAY['org_admin', 'hr_manager']);
  v_has_active_membership := EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.user_id = v_user_id
      AND e.company_id = v_company_id
      AND e.status::text NOT IN ('terminated', 'suspended')
  ) OR EXISTS (
    SELECT 1 FROM public.user_company_access uca
    WHERE uca.user_id = v_user_id
      AND uca.company_id = v_company_id
      AND uca.status = 'active'
  );

  IF NOT v_is_super_admin AND NOT (v_has_management_role AND v_has_active_membership) THEN
    RAISE EXCEPTION 'غير مصرح لك بإنشاء موظف في هذه المنشأة.' USING ERRCODE = '42501';
  END IF;

  RETURN public.create_employee_unscoped(
    p_first_name_ar => p_first_name_ar,
    p_last_name_ar => p_last_name_ar,
    p_first_name_en => p_first_name_en,
    p_last_name_en => p_last_name_en,
    p_email => p_email,
    p_phone => p_phone,
    p_national_id_or_iqama => p_national_id_or_iqama,
    p_nationality => p_nationality,
    p_gender => p_gender,
    p_birth_date => p_birth_date,
    p_marital_status => p_marital_status,
    p_hire_date => p_hire_date,
    p_contract_type => p_contract_type,
    p_job_title => p_job_title,
    p_department_id => p_department_id,
    p_subsidiary_id => p_subsidiary_id,
    p_work_location_id => p_work_location_id,
    p_job_position_id => p_job_position_id,
    p_cost_center_id => p_cost_center_id,
    p_manager_id => p_manager_id,
    p_work_type => p_work_type,
    p_basic_salary => p_basic_salary,
    p_housing_allowance => p_housing_allowance,
    p_transport_allowance => p_transport_allowance,
    p_other_allowances => p_other_allowances,
    p_bank_name => p_bank_name,
    p_iban => p_iban,
    p_job_grade => p_job_grade,
    p_target_company_id => v_company_id
  );
END;
$$;

-- Reimbursement batching has no company argument in its public signature; its
-- explicit scope is the verified company in the caller context. Keep the old
-- atomic implementation private and fence every call before it runs.
ALTER FUNCTION public.prepare_reimbursement_batch_atomic(text, uuid[], text, uuid, text, text)
  RENAME TO prepare_reimbursement_batch_atomic_unscoped;
REVOKE ALL ON FUNCTION public.prepare_reimbursement_batch_atomic_unscoped(text, uuid[], text, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.prepare_reimbursement_batch_atomic(
  p_period_key text,
  p_claim_ids uuid[],
  p_payment_method text DEFAULT 'direct_bank_transfer',
  p_bank_account_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_role text := auth.role();
  v_allowed_count integer := 0;
  v_distinct_claim_count integer := 0;
  v_existing_company_id uuid;
BEGIN
  IF v_company_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = v_company_id
  ) THEN
    RAISE EXCEPTION 'معرف الشركة غير محدد أو غير صالح.' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'service_role' THEN
    -- current_company_id only resolves service_role from an explicit valid
    -- company claim, so this is a tenant-scoped internal invocation.
    NULL;
  ELSE
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتجهيز دفعة الصرف.' USING ERRCODE = '42501';
    END IF;
    IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer']) THEN
      RAISE EXCEPTION 'غير مصرح للمستخدم بتجهيز دفعات الصرف المالي' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = v_user_id
        AND e.company_id = v_company_id
        AND e.status::text NOT IN ('terminated', 'suspended')
    ) AND NOT EXISTS (
      SELECT 1 FROM public.user_company_access uca
      WHERE uca.user_id = v_user_id
        AND uca.company_id = v_company_id
        AND uca.status = 'active'
    ) THEN
      RAISE EXCEPTION 'غير مصرح للمستخدم بهذه المنشأة.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_claim_ids IS NULL OR cardinality(p_claim_ids) = 0 THEN
    RAISE EXCEPTION 'يجب تحديد مطالبة واحدة على الأقل لإدراجها في دفعة الصرف' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT ec.id), count(DISTINCT ec.id) FILTER (WHERE ec.company_id = v_company_id)
  INTO v_distinct_claim_count, v_allowed_count
  FROM public.expense_claims ec
  WHERE ec.id = ANY(p_claim_ids);

  IF v_distinct_claim_count <> cardinality(ARRAY(SELECT DISTINCT unnest(p_claim_ids)))
     OR v_allowed_count <> v_distinct_claim_count
     OR EXISTS (
       SELECT 1 FROM public.expense_claims ec
       WHERE ec.id = ANY(p_claim_ids) AND ec.company_id IS DISTINCT FROM v_company_id
     ) THEN
    RAISE EXCEPTION 'كل المطالبات يجب أن تكون موجودة وتتبع المنشأة المحددة.' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT rb.company_id INTO v_existing_company_id
    FROM public.reimbursement_batches rb
    WHERE rb.idempotency_key = p_idempotency_key;
    IF FOUND AND v_existing_company_id IS DISTINCT FROM v_company_id THEN
      RAISE EXCEPTION 'مفتاح التكرار مستخدم في منشأة أخرى.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN public.prepare_reimbursement_batch_atomic_unscoped(
    p_period_key,
    p_claim_ids,
    p_payment_method,
    p_bank_account_id,
    p_notes,
    p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_employee(
  text, text, text, text, text, text, text, text, text, date, text, date, text, text,
  uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, text, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_employee(
  text, text, text, text, text, text, text, text, text, date, text, date, text, text,
  uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, text, text, text, uuid
) TO authenticated;

REVOKE ALL ON FUNCTION public.prepare_reimbursement_batch_atomic(text, uuid[], text, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_reimbursement_batch_atomic(text, uuid[], text, uuid, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
