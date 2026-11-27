-- Keep payroll loan balances and installment ledger in sync; fail closed on mismatches.
BEGIN;

CREATE OR REPLACE FUNCTION public.recover_loan_installments_for_payroll_run(
  p_payroll_run_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.payroll_runs%ROWTYPE;
  v_period text;
  v_rec record;
  v_recovered_count integer := 0;
  v_recovered_amount numeric(12,2) := 0;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك باسترداد أقساط مسير الرواتب (42501)';
  END IF;
  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;
  IF NOT public.has_role(auth.uid(), 'super_admin') AND NOT public.can_access_core_company(v_run.company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك باسترداد أقساط مسير منشأة أخرى (42501)';
  END IF;
  IF v_run.status NOT IN ('approved', 'locked', 'confirmed_locked') THEN
    RAISE EXCEPTION 'لا يمكن استرداد أقساط مسير غير معتمد أو مقفل';
  END IF;

  v_period := to_char(make_date(v_run.period_year, v_run.period_month, 1), 'YYYY-MM');

  -- Process active loans having pending installments for this period
  FOR v_rec IN
    SELECT li.id AS installment_id, li.loan_id, li.employee_id, li.principal_amount, l.company_id
    FROM public.loan_installments li
    JOIN public.loans l ON l.id = li.loan_id
    JOIN public.payroll_run_employees pre ON pre.payroll_run_id = p_payroll_run_id AND pre.employee_id = li.employee_id
    WHERE l.company_id = v_run.company_id
      AND li.due_payroll_period = v_period
      AND li.status = 'pending'
      AND l.status = 'active'
    FOR UPDATE OF li, l
  LOOP
    -- Mark installment deducted
    UPDATE public.loan_installments
    SET status = 'deducted',
        deducted_amount = v_rec.principal_amount,
        remaining_balance = 0,
        payroll_run_id = p_payroll_run_id,
        recovered_at = now(),
        updated_at = now()
    WHERE id = v_rec.installment_id;

    -- Update loan master balance
    UPDATE public.loans
    SET paid_installments = paid_installments + 1,
        installments_paid = installments_paid + 1,
        remaining_balance = greatest(0, remaining_balance - v_rec.principal_amount),
        outstanding_amount = greatest(0, outstanding_amount - v_rec.principal_amount),
        status = CASE WHEN remaining_balance - v_rec.principal_amount <= 0 THEN 'closed' ELSE status END,
        updated_at = now()
    WHERE id = v_rec.loan_id;

    -- Insert legacy allocation row idempotently
    INSERT INTO public.payroll_loan_allocations (payroll_run_id, loan_id, employee_id, amount, recovered_at)
    VALUES (p_payroll_run_id, v_rec.loan_id, v_rec.employee_id, v_rec.principal_amount, now())
    ON CONFLICT (payroll_run_id, loan_id) DO NOTHING;

    v_recovered_count := v_recovered_count + 1;
    v_recovered_amount := v_recovered_amount + v_rec.principal_amount;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'recovered_count', v_recovered_count,
    'recovered_amount', v_recovered_amount,
    'period', v_period
  );
END;
$$;

-- ============================================================================

CREATE OR REPLACE FUNCTION public.lock_payroll_run_atomic(
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
  v_rec record;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بقفل مسيّر الرواتب (42501)';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin') AND NOT public.can_access_core_company(v_run.company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة مسيّر رواتب يتبع لمنشأة أخرى (42501)';
  END IF;

  IF v_run.status != 'approved' THEN
    RAISE EXCEPTION 'لا يمكن قفل مسيّر الرواتب إلا بعد اعتماده رسمياً (الحالة الحالية: %)', v_run.status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payroll_run_employees pre
    WHERE pre.payroll_run_id = p_payroll_run_id
      AND COALESCE(pre.loan_installment, 0) <> COALESCE((
        SELECT SUM(li.principal_amount)
        FROM public.loan_installments li JOIN public.loans l ON l.id = li.loan_id
        WHERE li.employee_id = pre.employee_id
          AND li.due_payroll_period = to_char(make_date(v_run.period_year, v_run.period_month, 1), 'YYYY-MM')
          AND li.status = 'pending' AND l.company_id = v_run.company_id AND l.status = 'active'
      ), 0)
  ) THEN
    RAISE EXCEPTION 'لا تتطابق استقطاعات السلف مع الأقساط المجدولة؛ راجع جدول الأقساط قبل قفل المسير.';
  END IF;
  PERFORM public.recover_loan_installments_for_payroll_run(p_payroll_run_id);

  UPDATE public.payroll_runs
  SET status = 'locked',
      locked_by = v_caller_uid,
      locked_at = now(),
      updated_at = now()
  WHERE id = p_payroll_run_id;

  UPDATE public.payroll_run_employees
  SET status = 'locked', updated_at = now()
  WHERE payroll_run_id = p_payroll_run_id;

  INSERT INTO public.payroll_audit_logs (company_id, payroll_run_id, action, actor_id, details)
  VALUES (v_run.company_id, p_payroll_run_id, 'locked', v_caller_uid, jsonb_build_object('locked_at', now()));

  RETURN jsonb_build_object('ok', true, 'payroll_run_id', p_payroll_run_id, 'status', 'locked');
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_payroll_run_atomic(
  p_payroll_run_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_run public.payroll_runs%ROWTYPE;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
    RAISE EXCEPTION 'إعادة فتح مسيّر الرواتب المقفل تتطلب صلاحية مسؤول المنشأة أو مدير النظام الأعلى (42501)';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RAISE EXCEPTION 'يرجى تقديم سبب توضيحي واضح لإعادة فتح المسيّر المقفل (10 أحرف على الأقل)';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin') AND NOT public.can_access_core_company(v_run.company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة مسيّر رواتب يتبع لمنشأة أخرى (42501)';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payroll_loan_allocations WHERE payroll_run_id = p_payroll_run_id) THEN
    RAISE EXCEPTION 'لا يمكن إعادة فتح هذا المسير قبل توفر إجراء عكسي موثق لاسترداد أقساط السلف.';
  END IF;

  IF v_run.status = 'paid' THEN
    RAISE EXCEPTION 'لا يمكن إعادة فتح مسيّر تم صرفه بنكياً وتسويته بالكامل';
  END IF;

  UPDATE public.payroll_runs
  SET status = 'draft',
      reopened_by = v_caller_uid,
      reopened_at = now(),
      reopen_reason = p_reason,
      locked_at = NULL,
      locked_by = NULL,
      approved_at = NULL,
      approved_by = NULL,
      updated_at = now()
  WHERE id = p_payroll_run_id;

  INSERT INTO public.payroll_audit_logs (company_id, payroll_run_id, action, actor_id, details)
  VALUES (v_run.company_id, p_payroll_run_id, 'reopened', v_caller_uid, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('ok', true, 'payroll_run_id', p_payroll_run_id, 'status', 'draft');
END;
$$;

REVOKE ALL ON FUNCTION public.recover_loan_installments_for_payroll_run(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recover_loan_installments_for_payroll_run(uuid) TO authenticated, service_role;

COMMIT;
