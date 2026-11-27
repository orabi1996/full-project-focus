-- Preserve unknown attendance as NULL when the selected period has no records.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_executive_kpis(
  p_company_id uuid,
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headcount integer := 0;
  v_active_count integer := 0;
  v_saudi_count integer := 0;
  v_expat_count integer := 0;
  v_saudization_rate numeric(6,2) := 0.00;
  v_nitaqat_band text := 'red';
  v_new_hires integer := 0;
  v_turnover_count integer := 0;
  v_turnover_rate numeric(6,2) := 0.00;
  v_attendance_rate numeric(6,2) := NULL;
  v_absence_count integer := 0;
  v_absence_rate numeric(6,2) := 0.00;
  v_lateness_count integer := 0;
  v_overtime_hours numeric(10,2) := 0.00;
  v_leave_utilization_days integer := 0;
  v_payroll_cost numeric(14,2) := 0.00;
  v_average_employee_cost numeric(14,2) := 0.00;
  v_open_positions integer := 0;
  v_open_vacancies integer := 0;
  v_candidates_count integer := 0;
  v_offers_count integer := 0;
  v_hires_count integer := 0;
  v_time_to_fill_days numeric(6,1) := 0.0;
  v_review_completion numeric(6,2) := 0.00;
  v_average_rating numeric(3,2) := 0.00;
  v_workforce_plan_variance numeric(6,2) := 0.00;
  v_expense_cost numeric(14,2) := 0.00;
  v_outstanding_assets integer := 0;
  v_expiring_docs integer := 0;
  v_pending_approvals integer := 0;
  v_total_att_records integer := 0;
  v_present_att_records integer := 0;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  -- 1. Employee Headcount & Active Counts
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (
      WHERE status = 'active'
        AND upper(coalesce(nationality, '')) IN ('SA', 'SAUDI', 'SAUDI ARABIA', 'سعودي', 'سعودية')
    ),
    COUNT(*) FILTER (
      WHERE status = 'active'
        AND upper(coalesce(nationality, '')) NOT IN ('SA', 'SAUDI', 'SAUDI ARABIA', 'سعودي', 'سعودية')
    ),
    COUNT(*) FILTER (WHERE hire_date BETWEEN p_start_date AND p_end_date),
    COUNT(*) FILTER (WHERE status = 'terminated' AND updated_at::date BETWEEN p_start_date AND p_end_date)
  INTO
    v_headcount,
    v_active_count,
    v_saudi_count,
    v_expat_count,
    v_new_hires,
    v_turnover_count
  FROM public.employees
  WHERE company_id = p_company_id;

  -- Saudization Rate & Nitaqat Band
  IF (v_saudi_count + v_expat_count) > 0 THEN
    v_saudization_rate := ROUND((v_saudi_count::numeric / (v_saudi_count + v_expat_count)::numeric) * 100, 2);
  ELSE
    v_saudization_rate := 0.00;
  END IF;

  IF v_saudization_rate >= 40.00 THEN
    v_nitaqat_band := 'platinum';
  ELSIF v_saudization_rate >= 30.00 THEN
    v_nitaqat_band := 'high_green';
  ELSIF v_saudization_rate >= 20.00 THEN
    v_nitaqat_band := 'mid_green';
  ELSIF v_saudization_rate >= 10.00 THEN
    v_nitaqat_band := 'low_green';
  ELSE
    v_nitaqat_band := 'red';
  END IF;

  -- Governed Turnover Rate Formula: (Turnover Count / Total Headcount) * 100
  IF v_headcount > 0 THEN
    v_turnover_rate := ROUND((v_turnover_count::numeric / v_headcount::numeric) * 100, 2);
  END IF;

  -- 2. Attendance & Overtime Aggregations
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'present' OR actual_in IS NOT NULL),
    COUNT(*) FILTER (WHERE status = 'absent'),
    COUNT(*) FILTER (WHERE status = 'late' OR (actual_in IS NOT NULL AND scheduled_in IS NOT NULL AND actual_in > scheduled_in)),
    COALESCE(SUM(GREATEST(0, coalesce(worked_hours, 0) - 8)), 0)
  INTO
    v_total_att_records,
    v_present_att_records,
    v_absence_count,
    v_lateness_count,
    v_overtime_hours
  FROM public.attendance_records
  WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = p_company_id)
    AND work_date BETWEEN p_start_date AND p_end_date;

  IF v_total_att_records > 0 THEN
    v_attendance_rate := ROUND((v_present_att_records::numeric / v_total_att_records::numeric) * 100, 2);
    v_absence_rate := ROUND((v_absence_count::numeric / v_total_att_records::numeric) * 100, 2);
  ELSE
    v_attendance_rate := NULL;
    v_absence_rate := 0.00;
  END IF;

  -- 3. Leave Utilization (Approved leave requests within window)
  SELECT COALESCE(SUM(days), 0)
  INTO v_leave_utilization_days
  FROM public.requests
  WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = p_company_id)
    AND type = 'leave'
    AND status = 'approved'
    AND start_date <= p_end_date
    AND end_date >= p_start_date;

  -- 4. Authoritative Payroll Cost (Locked, Approved, or Paid Payroll Runs)
  SELECT COALESCE(SUM(total_net_salary + total_employer_gosi), 0)
  INTO v_payroll_cost
  FROM public.payroll_runs
  WHERE company_id = p_company_id
    AND status IN ('locked', 'approved', 'paid');

  IF v_active_count > 0 AND v_payroll_cost > 0 THEN
    v_average_employee_cost := ROUND(v_payroll_cost / v_active_count, 2);
  END IF;

  -- 5. Expense Reimbursement Cost
  SELECT COALESCE(SUM(amount), 0)
  INTO v_expense_cost
  FROM public.expense_claims
  WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = p_company_id)
    AND status = 'approved'
    AND spent_at BETWEEN p_start_date AND p_end_date;

  -- 6. Recruitment & Vacancies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_openings') THEN
    SELECT
      COUNT(*),
      COALESCE(SUM(openings_count), 0)
    INTO
      v_open_positions,
      v_open_vacancies
    FROM public.job_openings
    WHERE company_id = p_company_id AND status = 'open';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidates') THEN
    SELECT
      COUNT(*) FILTER (WHERE stage NOT IN ('rejected', 'hired')),
      COUNT(*) FILTER (WHERE stage = 'offer'),
      COUNT(*) FILTER (WHERE stage = 'hired')
    INTO
      v_candidates_count,
      v_offers_count,
      v_hires_count
    FROM public.candidates
    WHERE company_id = p_company_id;
  END IF;

  -- 7. Outstanding Assets
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets') THEN
    SELECT COUNT(*)
    INTO v_outstanding_assets
    FROM public.assets
    WHERE company_id = p_company_id AND status = 'assigned';
  END IF;

  -- 8. Expiring Documents (next 60 days)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_documents') THEN
    SELECT COUNT(*)
    INTO v_expiring_docs
    FROM public.employee_documents
    WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = p_company_id)
      AND expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '60 days');
  END IF;

  -- 9. Pending Workflow Approvals
  SELECT COUNT(*)
  INTO v_pending_approvals
  FROM public.requests
  WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = p_company_id)
    AND status = 'pending';

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'total_headcount', v_headcount,
    'active_employees', v_active_count,
    'saudi_count', v_saudi_count,
    'expat_count', v_expat_count,
    'saudization_rate', v_saudization_rate,
    'nitaqat_band', v_nitaqat_band,
    'new_hires', v_new_hires,
    'turnover_count', v_turnover_count,
    'turnover_rate', v_turnover_rate,
    'attendance_rate', v_attendance_rate,
    'absence_count', v_absence_count,
    'absence_rate', v_absence_rate,
    'lateness_count', v_lateness_count,
    'overtime_hours', v_overtime_hours,
    'leave_utilization_days', v_leave_utilization_days,
    'payroll_cost', v_payroll_cost,
    'average_employee_cost', v_average_employee_cost,
    'open_positions', v_open_positions,
    'open_vacancies', v_open_vacancies,
    'recruitment_candidates', v_candidates_count,
    'offers_count', v_offers_count,
    'hires_count', v_hires_count,
    'time_to_fill_days', v_time_to_fill_days,
    'performance_review_completion', v_review_completion,
    'average_rating', v_average_rating,
    'workforce_plan_variance', v_workforce_plan_variance,
    'expense_cost', v_expense_cost,
    'outstanding_assets', v_outstanding_assets,
    'expiring_documents', v_expiring_docs,
    'pending_approvals', v_pending_approvals,
    'generated_at', now()
  );
END;
$$;

COMMIT;
