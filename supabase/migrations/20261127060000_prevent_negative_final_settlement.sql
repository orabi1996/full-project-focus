-- Cap loan recovery at the available positive settlement amount.
BEGIN;

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
  v_leave_balance public.leave_balances%ROWTYPE;
  v_separation public.employee_separations%ROWTYPE;
  v_unreturned_assets integer := 0;
  v_open_runs integer := 0;
  v_service_days integer;
  v_service_days_total integer;
  v_service_years integer;
  v_service_months integer;
  v_service_years_decimal numeric(6,3);
  v_total_monthly_wage numeric(12,2);
  v_daily_rate numeric(12,2);
  v_gross_eosb numeric(12,2) := 0;
  v_resignation_multiplier numeric(6,3) := 100.00;
  v_eosb_amount numeric(12,2) := 0;
  v_leave_payout_amount numeric(12,2) := 0;
  v_loan_deduction numeric(12,2) := 0;
  v_pending_salary numeric(12,2) := 0;
  v_net_settlement numeric(12,2) := 0;
  v_unconsumed_leave numeric(6,2) := 0;
  v_snapshot jsonb;
BEGIN
  -- RBAC check
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك باحتساب مخالصة نهاية الخدمة (42501)';
  END IF;

  -- 1. Fetch Employee
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود بالنظام';
  END IF;

  IF public.current_company_id() IS NOT NULL AND v_emp.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة تسوية موظف يتبع لمنشأة أخرى';
  END IF;

  IF p_termination_date < v_emp.hire_date THEN
    RAISE EXCEPTION 'تاريخ انتهاء الخدمة (%) لا يمكن أن يسبق تاريخ التعيين (%)', p_termination_date, v_emp.hire_date;
  END IF;

  -- 2. BLOCKING EXCEPTION: Unreturned Assets
  SELECT count(*) INTO v_unreturned_assets
  FROM public.hardware_assets
  WHERE assigned_to_employee_id = p_employee_id AND status <> 'available';

  IF v_unreturned_assets > 0 THEN
    RAISE EXCEPTION 'لا يمكن احتساب المخالصة لوجود عهد / أصول غير مستلمة (% أصل). يرجى استكمال تسليم العهد أولاً.', v_unreturned_assets;
  END IF;

  -- 3. BLOCKING EXCEPTION: Open unapproved payroll runs
  SELECT count(*) INTO v_open_runs
  FROM public.payroll_runs pr
  JOIN public.payroll_run_employees pre ON pre.payroll_run_id = pr.id
  WHERE pre.employee_id = p_employee_id AND pr.status = 'draft';

  IF v_open_runs > 0 THEN
    RAISE EXCEPTION 'يوجد مسيّر رواتب معلق لم يعتمد بعد يشمل الموظف. يرجى اعتماد أو تسوية مسير الرواتب المعلق أولاً.';
  END IF;

  -- 4. Check for existing separation
  SELECT * INTO v_separation
  FROM public.employee_separations
  WHERE employee_id = p_employee_id AND status NOT IN ('finalized', 'cancelled')
  ORDER BY created_at DESC
  LIMIT 1;

  -- 5. Fetch effective compensation version
  SELECT * INTO v_comp
  FROM public.employee_compensation_versions
  WHERE employee_id = p_employee_id
    AND status = 'approved'
    AND effective_from <= p_termination_date
    AND (effective_to IS NULL OR effective_to >= p_termination_date)
  ORDER BY effective_from DESC, version DESC
  LIMIT 1;

  IF v_comp.id IS NOT NULL THEN
    v_total_monthly_wage := v_comp.basic_salary + COALESCE(v_comp.housing_allowance, 0) + COALESCE(v_comp.transport_allowance, 0);
  ELSE
    v_total_monthly_wage := v_emp.total_salary;
  END IF;

  IF v_total_monthly_wage <= 0 THEN
    RAISE EXCEPTION 'سجل الراتب والتعويضات غير متوفر أو غير مكتمل للموظف (% - %)', v_emp.employee_no, v_emp.first_name_ar;
  END IF;

  -- 6. Fetch company payroll configuration for daily rate
  SELECT * INTO v_config
  FROM public.company_payroll_configs
  WHERE company_id = v_emp.company_id AND status = 'active'
  LIMIT 1;

  IF v_config.calculation_basis = 'actual_days' THEN
    v_daily_rate := ROUND(v_total_monthly_wage / EXTRACT(DAY FROM (date_trunc('month', p_termination_date) + interval '1 month - 1 day')), 2);
  ELSIF v_config.calculation_basis = 'working_days_22' THEN
    v_daily_rate := ROUND(v_total_monthly_wage / 22.0, 2);
  ELSE
    v_daily_rate := ROUND(v_total_monthly_wage / 30.0, 2);
  END IF;

  -- 7. Service Period Calculation
  v_service_days_total := (p_termination_date - v_emp.hire_date) + 1 - GREATEST(0, p_unpaid_leave_days);
  IF v_service_days_total < 0 THEN
    v_service_days_total := 0;
  END IF;
  v_service_years := v_service_days_total / 365;
  v_service_months := (v_service_days_total % 365) / 30;
  v_service_days := (v_service_days_total % 365) % 30;
  v_service_years_decimal := ROUND(v_service_days_total / 365.0, 3);

  -- 8. Statutory EOSB Under Saudi Labor Law
  IF p_separation_type = 'termination_with_cause' THEN
    v_gross_eosb := 0;
    v_resignation_multiplier := 0;
  ELSE
    IF v_service_years_decimal <= 5.0 THEN
      v_gross_eosb := ROUND(v_service_years_decimal * (v_total_monthly_wage / 2.0), 2);
    ELSE
      v_gross_eosb := ROUND(
        (5.0 * (v_total_monthly_wage / 2.0)) +
        ((v_service_years_decimal - 5.0) * v_total_monthly_wage),
        2
      );
    END IF;

    IF p_separation_type = 'resignation' THEN
      IF v_service_years_decimal < 2.0 THEN
        v_resignation_multiplier := 0.0;
      ELSIF v_service_years_decimal >= 2.0 AND v_service_years_decimal < 5.0 THEN
        v_resignation_multiplier := 33.333;
      ELSIF v_service_years_decimal >= 5.0 AND v_service_years_decimal < 10.0 THEN
        v_resignation_multiplier := 66.667;
      ELSE
        v_resignation_multiplier := 100.0;
      END IF;
    ELSE
      v_resignation_multiplier := 100.0;
    END IF;
  END IF;

  v_eosb_amount := ROUND((v_gross_eosb * (v_resignation_multiplier / 100.0)), 2);

  -- 9. Authoritative Leave Balance Payout
  SELECT * INTO v_leave_balance
  FROM public.leave_balances
  WHERE employee_id = p_employee_id
  LIMIT 1;

  IF v_leave_balance.id IS NULL THEN
    RAISE EXCEPTION 'سجل رصيد الإجازات غير متوفر في النظام للموظف (رقم %)', v_emp.employee_no;
  END IF;

  v_unconsumed_leave := (v_leave_balance.accrued_days + v_leave_balance.carried_over_days) - (v_leave_balance.used_days + v_leave_balance.reserved_days);
  IF v_unconsumed_leave > 0 THEN
    v_leave_payout_amount := ROUND(v_unconsumed_leave * v_daily_rate, 2);
  ELSE
    v_leave_payout_amount := 0;
    v_unconsumed_leave := 0;
  END IF;

  -- 10. Authoritative Active Loans Balance Deduction
  SELECT COALESCE(SUM(remaining_balance), 0) INTO v_loan_deduction
  FROM public.loans
  WHERE employee_id = p_employee_id AND status = 'active';

  -- 11. Net Settlement
  -- Recover no more than the employee's positive settlement; any remaining loan balance stays due.
  v_loan_deduction := LEAST(v_loan_deduction, v_eosb_amount + v_leave_payout_amount + v_pending_salary);
  v_net_settlement := GREATEST(0, (v_eosb_amount + v_leave_payout_amount + v_pending_salary) - v_loan_deduction);

  -- 12. Auditable Snapshot
  v_snapshot := jsonb_build_object(
    'employee_id', v_emp.id,
    'employee_no', v_emp.employee_no,
    'employee_name', COALESCE(v_emp.first_name_ar || ' ' || v_emp.last_name_ar, v_emp.full_name),
    'hire_date', v_emp.hire_date,
    'termination_date', p_termination_date,
    'separation_type', p_separation_type,
    'service_days', v_service_days_total,
    'service_years', v_service_years,
    'service_months', v_service_months,
    'service_years_decimal', v_service_years_decimal,
    'total_monthly_wage', v_total_monthly_wage,
    'daily_rate', v_daily_rate,
    'calculation_basis', COALESCE(v_config.calculation_basis, 'fixed_30_days'),
    'gross_eosb', v_gross_eosb,
    'resignation_multiplier', v_resignation_multiplier,
    'eosb_amount', v_eosb_amount,
    'leave_balance_payout_days', v_unconsumed_leave,
    'leave_payout_amount', v_leave_payout_amount,
    'loan_deduction_amount', v_loan_deduction,
    'pending_salary_amount', v_pending_salary,
    'net_settlement_amount', v_net_settlement,
    'statutory_policy', 'SA_LABOR_LAW_ARTICLES_84_85',
    'compensation_version_id', v_comp.id,
    'calculated_at', now(),
    'calculated_by', v_caller_uid
  );

  RETURN jsonb_build_object(
    'ok', true,
    'employee_id', v_emp.id,
    'employee_no', v_emp.employee_no,
    'employee_name', COALESCE(v_emp.first_name_ar || ' ' || v_emp.last_name_ar, v_emp.full_name),
    'hire_date', v_emp.hire_date,
    'termination_date', p_termination_date,
    'separation_type', p_separation_type,
    'service_years', v_service_years,
    'service_months', v_service_months,
    'service_days', v_service_days,
    'total_service_years_decimal', v_service_years_decimal,
    'total_monthly_wage', v_total_monthly_wage,
    'daily_rate', v_daily_rate,
    'calculation_basis', COALESCE(v_config.calculation_basis, 'fixed_30_days'),
    'gross_eosb', v_gross_eosb,
    'resignation_multiplier', v_resignation_multiplier,
    'eosb_amount', v_eosb_amount,
    'leave_balance_payout_days', v_unconsumed_leave,
    'leave_payout_amount', v_leave_payout_amount,
    'loan_deduction_amount', v_loan_deduction,
    'pending_salary_amount', v_pending_salary,
    'net_settlement_amount', v_net_settlement,
    'calculation_snapshot', v_snapshot,
    'separation_id', v_separation.id
  );
END;
$$;

-- ============================================================================

COMMIT;
