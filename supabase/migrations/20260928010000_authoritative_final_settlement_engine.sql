-- ============================================================================
-- PROMPT 15 FINAL CLOSURE: AUTHORITATIVE FINAL SETTLEMENT & WPS ENGINE
-- Migration: 20260928010000_authoritative_final_settlement_engine.sql
-- ============================================================================

-- STEP 1: ENHANCE SETTLEMENTS TABLE WITH AUDITABLE SNAPSHOTS & DOMAIN METRICS
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS separation_type text NOT NULL DEFAULT 'contract_expiration',
  ADD COLUMN IF NOT EXISTS service_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_service_years_decimal numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resignation_multiplier numeric(6,3) NOT NULL DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS leave_balance_payout_days numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_salary_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_deduction_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deductions_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notice_period_served boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS asset_clearance_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calculation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill company_id from employees table if missing
UPDATE public.settlements s
SET company_id = e.company_id
FROM public.employees e
WHERE s.employee_id = e.id AND s.company_id IS NULL;

-- Enable and Force RLS on settlements
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements FORCE ROW LEVEL SECURITY;

-- STEP 2: ENHANCE COMPANY & BANK ACCOUNTS WITH CANONICAL WPS FIELDS
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cr_number text,
  ADD COLUMN IF NOT EXISTS establishment_number text,
  ADD COLUMN IF NOT EXISTS tax_number text;

ALTER TABLE public.company_bank_accounts
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS swift_code text;

-- STEP 3: RLS POLICIES FOR SETTLEMENTS
DROP POLICY IF EXISTS "settlements_select_policy" ON public.settlements;
CREATE POLICY "settlements_select_policy"
  ON public.settlements FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (
      company_id = public.current_company_id()
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer'])
    )
  );

DROP POLICY IF EXISTS "deny_direct_mutation_settlements" ON public.settlements;
CREATE POLICY "deny_direct_mutation_settlements"
  ON public.settlements FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- ============================================================================
-- STEP 4: AUTHORITATIVE SERVER-SIDE FINAL SETTLEMENT CALCULATION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_final_settlement_atomic(
  p_employee_id uuid,
  p_termination_date date,
  p_separation_type text DEFAULT 'contract_expiration',
  p_unpaid_leave_days integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_emp public.employees%ROWTYPE;
  v_comp public.employee_compensation_versions%ROWTYPE;
  v_config public.company_payroll_configs%ROWTYPE;
  v_hire_date date;
  v_term_date date := p_termination_date;
  v_total_days integer;
  v_effective_service_days integer;
  v_service_years integer;
  v_service_months integer;
  v_service_days integer;
  v_years_decimal numeric(6,3);
  
  v_basic numeric(12,2) := 0;
  v_housing numeric(12,2) := 0;
  v_transport numeric(12,2) := 0;
  v_total_wage numeric(12,2) := 0;
  v_daily_rate numeric(12,4) := 0;
  v_calc_basis text := 'fixed_30_days';
  
  v_unused_leave_days numeric(6,2) := 0;
  v_leave_payout numeric(12,2) := 0;
  v_has_leave_record boolean := false;
  
  v_loan_balance numeric(12,2) := 0;
  v_loans_count integer := 0;
  
  v_gross_eosb numeric(12,2) := 0;
  v_multiplier numeric(6,3) := 100.00;
  v_eosb_amount numeric(12,2) := 0;
  v_net_settlement numeric(12,2) := 0;
  
  v_trace jsonb := '[]'::jsonb;
  v_snapshot jsonb;
BEGIN
  -- 1. Authorization & Role Guard
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك باحتساب مخالصة نهاية الخدمة (42501)';
  END IF;

  -- 2. Employee Lookup & Cross-Tenant Guard
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'الموظف المحدد غير موجود في النظام';
  END IF;

  IF public.current_company_id() IS NOT NULL AND v_emp.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة تسوية موظف يتبع لمنشأة أخرى (42501)';
  END IF;

  v_hire_date := v_emp.hire_date;
  IF v_term_date < v_hire_date THEN
    RAISE EXCEPTION 'تاريخ نهاية الخدمة (%) لا يمكن أن يسبق تاريخ التعيين (%)', v_term_date, v_hire_date;
  END IF;

  -- 3. Service Duration Calculation (Server Date Semantics)
  v_total_days := (v_term_date - v_hire_date) + 1;
  v_effective_service_days := GREATEST(1, v_total_days - COALESCE(p_unpaid_leave_days, 0));
  v_service_years := v_effective_service_days / 365;
  v_service_months := (v_effective_service_days % 365) / 30;
  v_service_days := (v_effective_service_days % 365) % 30;
  v_years_decimal := ROUND(v_effective_service_days::numeric / 365.0, 3);

  -- 4. Effective Compensation Package Lookup
  SELECT * INTO v_comp
  FROM public.employee_compensation_versions
  WHERE employee_id = p_employee_id
    AND status = 'approved'
    AND effective_from <= v_term_date
    AND (effective_to IS NULL OR effective_to >= v_term_date)
  ORDER BY effective_from DESC, version DESC
  LIMIT 1;

  IF v_comp.id IS NOT NULL THEN
    v_basic := v_comp.basic_salary;
    v_housing := v_comp.housing_allowance;
    v_transport := v_comp.transport_allowance;
  ELSE
    v_basic := COALESCE(v_emp.basic_salary, 0);
    v_housing := COALESCE(v_emp.housing_allowance, 0);
    v_transport := COALESCE(v_emp.transport_allowance, 0);
  END IF;

  v_total_wage := v_basic + v_housing + v_transport;
  IF v_total_wage <= 0 THEN
    RAISE EXCEPTION 'تعذر احتساب مكافأة نهاية الخدمة: لا توجد حزمة راتب معتمدة أو أجر تعاقدي للموظف';
  END IF;

  -- 5. Company Policy & Daily Rate (No Universal /30)
  SELECT * INTO v_config
  FROM public.company_payroll_configs
  WHERE company_id = v_emp.company_id;

  IF v_config.calculation_basis IS NOT NULL THEN
    v_calc_basis := v_config.calculation_basis;
  END IF;

  IF v_calc_basis = 'actual_days' THEN
    -- Days in termination month
    v_daily_rate := ROUND(v_total_wage / EXTRACT(DAY FROM (date_trunc('month', v_term_date) + interval '1 month - 1 day'))::numeric, 4);
  ELSIF v_calc_basis = 'working_days_22' THEN
    v_daily_rate := ROUND(v_total_wage / 22.0, 4);
  ELSE
    -- Standard Saudi fixed 30 days basis
    v_daily_rate := ROUND(v_total_wage / 30.0, 4);
  END IF;

  -- 6. Authoritative Leave Balance Payout (No Hardcoded 15 Days)
  SELECT EXISTS (
    SELECT 1 FROM public.leave_balances WHERE employee_id = p_employee_id
  ) INTO v_has_leave_record;

  IF NOT v_has_leave_record THEN
    RAISE EXCEPTION 'تعذر احتساب مخالصة نهاية الخدمة: سجل رصيد الإجازات غير متوفر في النظام للموظف (Blocking Exception)';
  END IF;

  SELECT COALESCE(SUM(GREATEST(0, accrued_days + carried_over_days - used_days - reserved_days)), 0)
  INTO v_unused_leave_days
  FROM public.leave_balances
  WHERE employee_id = p_employee_id;

  v_leave_payout := ROUND(v_unused_leave_days * v_daily_rate, 2);

  -- 7. Outstanding Active Loans
  SELECT COALESCE(SUM(remaining_balance), 0), COUNT(*)
  INTO v_loan_balance, v_loans_count
  FROM public.loans
  WHERE employee_id = p_employee_id AND status = 'active';

  -- 8. Saudi Labor Law EOSB Calculation (Articles 84 & 85)
  IF v_years_decimal <= 5.0 THEN
    v_gross_eosb := ROUND(v_years_decimal * (v_total_wage / 2.0), 2);
  ELSE
    v_gross_eosb := ROUND((5.0 * (v_total_wage / 2.0)) + ((v_years_decimal - 5.0) * v_total_wage), 2);
  END IF;

  -- Separation Type Multiplier
  IF p_separation_type = 'resignation' THEN
    IF v_years_decimal < 2.0 THEN
      v_multiplier := 0.0;
    ELSIF v_years_decimal >= 2.0 AND v_years_decimal < 5.0 THEN
      v_multiplier := 33.333;
    ELSIF v_years_decimal >= 5.0 AND v_years_decimal < 10.0 THEN
      v_multiplier := 66.667;
    ELSE
      v_multiplier := 100.00;
    END IF;
  ELSIF p_separation_type = 'termination_with_cause' THEN
    -- Article 80: 0%
    v_multiplier := 0.0;
  ELSE
    -- Contract expiration / termination by employer / Article 81: 100%
    v_multiplier := 100.00;
  END IF;

  v_eosb_amount := ROUND(v_gross_eosb * (v_multiplier / 100.0), 2);

  -- 9. Net Settlement Calculation
  v_net_settlement := ROUND(GREATEST(0, v_eosb_amount + v_leave_payout - v_loan_balance), 2);

  -- 10. Auditable Snapshot Generation
  v_snapshot := jsonb_build_object(
    'employee_id', p_employee_id,
    'employee_no', v_emp.employee_no,
    'employee_name', COALESCE(v_emp.first_name_ar || ' ' || v_emp.last_name_ar, v_emp.full_name),
    'company_id', v_emp.company_id,
    'hire_date', v_hire_date,
    'termination_date', v_term_date,
    'separation_type', p_separation_type,
    'service_days', v_total_days,
    'service_years', v_service_years,
    'service_months', v_service_months,
    'total_service_years_decimal', v_years_decimal,
    'basic_salary', v_basic,
    'housing_allowance', v_housing,
    'transport_allowance', v_transport,
    'total_monthly_wage', v_total_wage,
    'daily_rate', v_daily_rate,
    'calculation_basis', v_calc_basis,
    'gross_eosb', v_gross_eosb,
    'resignation_multiplier', v_multiplier,
    'eosb_amount', v_eosb_amount,
    'unused_leave_days', v_unused_leave_days,
    'leave_payout_amount', v_leave_payout,
    'outstanding_loans_count', v_loans_count,
    'loan_deduction_amount', v_loan_balance,
    'net_settlement_amount', v_net_settlement,
    'compensation_version_id', v_comp.id,
    'statutory_policy', 'SA_LABOR_LAW_ARTICLES_84_85',
    'calculated_at', now(),
    'calculated_by', v_caller_uid
  );

  RETURN jsonb_build_object(
    'ok', true,
    'employee_id', p_employee_id,
    'employee_no', v_emp.employee_no,
    'employee_name', COALESCE(v_emp.first_name_ar || ' ' || v_emp.last_name_ar, v_emp.full_name),
    'hire_date', v_hire_date,
    'termination_date', v_term_date,
    'separation_type', p_separation_type,
    'service_years', v_service_years,
    'service_months', v_service_months,
    'service_days', v_service_days,
    'total_service_years_decimal', v_years_decimal,
    'total_monthly_wage', v_total_wage,
    'daily_rate', v_daily_rate,
    'calculation_basis', v_calc_basis,
    'gross_eosb', v_gross_eosb,
    'resignation_multiplier', v_multiplier,
    'eosb_amount', v_eosb_amount,
    'leave_balance_payout_days', v_unused_leave_days,
    'leave_payout_amount', v_leave_payout,
    'pending_salary_amount', 0,
    'loan_deduction_amount', v_loan_balance,
    'net_settlement_amount', v_net_settlement,
    'calculation_snapshot', v_snapshot
  );
END;
$$;

-- ============================================================================
-- STEP 5: AUTHORITATIVE FINAL SETTLEMENT CREATION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_final_settlement_atomic(
  p_params jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_emp_id uuid := (p_params->>'employee_id')::uuid;
  v_term_date date := (p_params->>'termination_date')::date;
  v_sep_type text := COALESCE(p_params->>'separation_type', 'contract_expiration');
  v_notes text := p_params->>'notes';
  v_notice_served boolean := COALESCE((p_params->>'notice_period_served')::boolean, true);
  v_asset_cleared boolean := COALESCE((p_params->>'asset_clearance_complete')::boolean, false);
  
  v_calc jsonb;
  v_settlement_id uuid;
  v_emp public.employees%ROWTYPE;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بإنشاء تسوية نهاية الخدمة (42501)';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = v_emp_id;
  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'الموظف المحدد غير موجود';
  END IF;

  IF public.current_company_id() IS NOT NULL AND v_emp.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح لك بإنشاء تسوية لموظف يتبع لمنشأة أخرى (42501)';
  END IF;

  -- Compute authoritative calculation server-side (Client never decides money values)
  v_calc := public.calculate_final_settlement_atomic(v_emp_id, v_term_date, v_sep_type);

  -- Insert settlement record with auditable snapshot
  INSERT INTO public.settlements (
    employee_id,
    company_id,
    termination_date,
    separation_type,
    service_years,
    service_months,
    service_days,
    total_service_years_decimal,
    resignation_multiplier,
    eosb_amount,
    leave_balance_payout_days,
    leave_payout_amount,
    pending_salary_amount,
    loan_deduction_amount,
    net_settlement_amount,
    notice_period_served,
    asset_clearance_complete,
    calculation_snapshot,
    notes,
    created_by,
    status
  ) VALUES (
    v_emp_id,
    v_emp.company_id,
    v_term_date,
    v_sep_type,
    (v_calc->>'service_years')::integer,
    (v_calc->>'service_months')::integer,
    (v_calc->>'service_days')::integer,
    (v_calc->>'total_service_years_decimal')::numeric,
    (v_calc->>'resignation_multiplier')::numeric,
    (v_calc->>'eosb_amount')::numeric,
    (v_calc->>'leave_balance_payout_days')::numeric,
    (v_calc->>'leave_payout_amount')::numeric,
    COALESCE((v_calc->>'pending_salary_amount')::numeric, 0),
    (v_calc->>'loan_deduction_amount')::numeric,
    (v_calc->>'net_settlement_amount')::numeric,
    v_notice_served,
    v_asset_cleared,
    v_calc->'calculation_snapshot',
    v_notes,
    v_caller_uid,
    'draft'
  ) RETURNING id INTO v_settlement_id;

  -- Record audit log
  INSERT INTO public.payroll_audit_logs (
    company_id,
    action,
    actor_id,
    details
  ) VALUES (
    v_emp.company_id,
    'settlement_created',
    v_caller_uid,
    jsonb_build_object(
      'settlement_id', v_settlement_id,
      'employee_id', v_emp_id,
      'net_settlement_amount', (v_calc->>'net_settlement_amount')::numeric
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'settlement_id', v_settlement_id,
    'net_settlement_amount', (v_calc->>'net_settlement_amount')::numeric,
    'status', 'draft'
  );
END;
$$;

-- ============================================================================
-- STEP 6: AUTHORITATIVE WPS EXPORT VALIDATION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_payroll_wps_export(
  p_payroll_run_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_run public.payroll_runs%ROWTYPE;
  v_comp public.companies%ROWTYPE;
  v_primary_account public.company_bank_accounts%ROWTYPE;
  v_establishment_id text;
  v_bank_code text;
  v_invalid_count integer := 0;
  v_total_count integer := 0;
  v_total_net numeric(14,2) := 0;
  v_invalid_emp record;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'payroll_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بالتحقق من وتصدير ملف حماية الأجور (42501)';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  IF public.current_company_id() IS NOT NULL AND v_run.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة مسيّر رواتب يتبع لمنشأة أخرى (42501)';
  END IF;

  IF v_run.status NOT IN ('approved', 'locked', 'paid') THEN
    RAISE EXCEPTION 'لا يمكن تصدير ملف حماية الأجور (WPS) إلا بعد اعتماد المسيّر أو قفله رسمياً (الحالة الحالية: %)', v_run.status;
  END IF;

  -- 1. Validate Company Establishment ID
  SELECT * INTO v_comp FROM public.companies WHERE id = v_run.company_id;
  v_establishment_id := TRIM(COALESCE(v_comp.cr_number, v_comp.establishment_number, v_comp.tax_number, ''));
  IF v_establishment_id = '' OR v_establishment_id = '1010892341' THEN
    RAISE EXCEPTION 'رقم المنشأة / السجل التجاري غير محدد في إعدادات المنشأة. يرجى ضبط السجل التجاري المعتمد أولاً.';
  END IF;

  -- 2. Validate Company Bank Account & Bank Code
  SELECT * INTO v_primary_account
  FROM public.company_bank_accounts
  WHERE company_id = v_run.company_id AND is_primary = true
  LIMIT 1;

  IF v_primary_account.id IS NULL THEN
    SELECT * INTO v_primary_account
    FROM public.company_bank_accounts
    WHERE company_id = v_run.company_id
    LIMIT 1;
  END IF;

  IF v_primary_account.id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد حساب بنكي مسجل للمنشأة. يرجى تهيئة الحساب البنكي الرئيسي قبل تصدير ملف WPS.';
  END IF;

  v_bank_code := TRIM(COALESCE(v_primary_account.bank_code, v_primary_account.swift_code, ''));
  IF v_bank_code = '' OR v_bank_code = 'NCBKSA' THEN
    RAISE EXCEPTION 'رمز البنك للمنشأة غير محدد في الحساب البنكي المعتمد. يرجى تهيئة رمز البنك للحساب البنكي الرئيسي.';
  END IF;

  -- 3. Validate All Employee IBANs in Run
  SELECT COUNT(*), COALESCE(SUM(net_salary), 0)
  INTO v_total_count, v_total_net
  FROM public.payroll_run_employees
  WHERE payroll_run_id = p_payroll_run_id AND net_salary > 0;

  IF v_total_count = 0 THEN
    RAISE EXCEPTION 'لا توجد سجلات رواتب موظفين جاهزة للدفع في هذا المسيّر';
  END IF;

  SELECT pre.employee_no, pre.employee_name_ar, pre.iban
  INTO v_invalid_emp
  FROM public.payroll_run_employees pre
  WHERE pre.payroll_run_id = p_payroll_run_id
    AND pre.net_salary > 0
    AND (pre.iban IS NULL OR LENGTH(TRIM(pre.iban)) < 15 OR pre.iban LIKE '%SA0000000000000000000000%')
  LIMIT 1;

  IF v_invalid_emp.employee_no IS NOT NULL THEN
    RAISE EXCEPTION 'بيانات الآيبان البنكي غير مكتملة أو غير صالحة للموظف: % (%). يُمنع تصدير ملف WPS بآيبان وهمي أو مفقود.',
      v_invalid_emp.employee_name_ar, v_invalid_emp.employee_no;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'can_export', true,
    'establishment_id', v_establishment_id,
    'employer_bank_code', v_bank_code,
    'total_employees', v_total_count,
    'total_net_amount', v_total_net,
    'currency', v_run.currency,
    'payroll_period', v_run.period_year || LPAD(v_run.period_month::text, 2, '0')
  );
END;
$$;

-- ============================================================================
-- STEP 7: STRICT PROMPT 13.7 PRIVILEGES & WHITELIST
-- ============================================================================

REVOKE ALL ON FUNCTION public.calculate_final_settlement_atomic(uuid, date, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_final_settlement_atomic(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_payroll_wps_export(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.calculate_final_settlement_atomic(uuid, date, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_final_settlement_atomic(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_payroll_wps_export(uuid) TO authenticated, service_role;

GRANT SELECT ON public.settlements TO authenticated, service_role;
