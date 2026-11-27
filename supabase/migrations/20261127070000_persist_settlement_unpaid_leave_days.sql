-- Persist the unpaid-leave days used for settlement preview in the authoritative create flow.
BEGIN;

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
  v_unpaid_leave_days integer := GREATEST(0, COALESCE((p_params->>'unpaid_leave_days')::integer, 0));
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
  v_calc := public.calculate_final_settlement_atomic(v_emp_id, v_term_date, v_sep_type, v_unpaid_leave_days);

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

COMMIT;
