-- Keep payroll snapshots, payment confirmation and installment recovery atomic.
-- No bank API is called here. A finance user records an externally completed transfer.
ALTER TABLE public.payroll_details
  ADD COLUMN IF NOT EXISTS working_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS payment_bank_reference text,
  ADD COLUMN IF NOT EXISTS payment_account_id uuid REFERENCES public.company_bank_accounts(id),
  ADD COLUMN IF NOT EXISTS payment_confirmed_by uuid REFERENCES auth.users(id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_external_reference_unique
  ON public.payroll_runs(payment_account_id, payment_bank_reference)
  WHERE payment_bank_reference IS NOT NULL;

CREATE TABLE public.payroll_loan_allocations (
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  recovered_at timestamptz,
  PRIMARY KEY (payroll_run_id, loan_id)
);
ALTER TABLE public.payroll_loan_allocations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_loan_allocations TO authenticated;
CREATE POLICY payroll_allocation_staff ON public.payroll_loan_allocations
  FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','payroll_officer','finance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','payroll_officer','finance_officer']));

CREATE OR REPLACE FUNCTION public.save_payroll_run_atomic(p_run jsonb, p_details jsonb, p_allocations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_existing public.payroll_runs%ROWTYPE;
  v_year integer := (p_run->>'period_year')::integer;
  v_month integer := (p_run->>'period_month')::integer;
  v_group uuid := (p_run->>'payroll_group_id')::uuid;
  v_detail jsonb;
  v_allocation jsonb;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','payroll_officer','finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح بإعداد الرواتب';
  END IF;
  IF v_year IS NULL OR v_year NOT BETWEEN 2000 AND 2100 OR v_month IS NULL OR v_month NOT BETWEEN 1 AND 12
     OR jsonb_typeof(p_details) IS DISTINCT FROM 'array' OR jsonb_array_length(p_details) = 0
     OR jsonb_typeof(p_allocations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'مدخلات المسيّر غير صالحة';
  END IF;
  -- Serializes saves even when a group's first run has no row to lock yet.
  PERFORM pg_advisory_xact_lock(hashtextextended('payroll:' || v_year || ':' || v_month, 0));
  SELECT * INTO v_existing FROM public.payroll_runs
    WHERE period_year = v_year AND period_month = v_month
      AND payroll_group_id IS NOT DISTINCT FROM v_group FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status <> 'draft' THEN RAISE EXCEPTION 'المسيّر مقفل ولا يمكن إعادة احتسابه'; END IF;
    IF EXISTS (SELECT 1 FROM public.payroll_payments WHERE payroll_run_id = v_existing.id AND status = 'paid') THEN
      RAISE EXCEPTION 'توجد دفعات مدفوعة لهذا المسيّر';
    END IF;
    v_id := v_existing.id;
    DELETE FROM public.payroll_payments WHERE payroll_run_id = v_id;
    DELETE FROM public.payroll_loan_allocations WHERE payroll_run_id = v_id;
    DELETE FROM public.payroll_details WHERE payroll_run_id = v_id;
  ELSE
    v_id := (p_run->>'id')::uuid;
    INSERT INTO public.payroll_runs(id, payroll_group_id, period_year, period_month)
      VALUES (v_id, v_group, v_year, v_month);
  END IF;

  FOR v_detail IN SELECT value FROM jsonb_array_elements(p_details) LOOP
    IF (v_detail->>'net_salary')::numeric < 0 OR (v_detail->>'loan_deduction')::numeric < 0 THEN
      RAISE EXCEPTION 'قيم راتب غير صالحة';
    END IF;
    -- Do not pay an employee twice through overlapping groups in the same month.
    IF EXISTS (SELECT 1 FROM public.payroll_details d JOIN public.payroll_runs r ON r.id=d.payroll_run_id
      WHERE r.period_year=v_year AND r.period_month=v_month AND r.id<>v_id
        AND d.employee_id=(v_detail->>'employee_id')::uuid) THEN
      RAISE EXCEPTION 'الموظف موجود بالفعل في مسيّر آخر لنفس الشهر';
    END IF;
    INSERT INTO public.payroll_details (
      payroll_run_id, employee_id, basic_salary, housing_allowance, transport_allowance,
      other_allowances, overtime_hours, overtime_amount, bonus_amount, unpaid_leave_deduction,
      absence_late_deduction, loan_deduction, gosi_employee_deduction, other_deductions,
      gross_salary, total_deductions, net_salary, working_days, absent_days
    ) SELECT v_id, d.employee_id, d.basic_salary, d.housing_allowance, d.transport_allowance,
      d.other_allowances, d.overtime_hours, d.overtime_amount, d.bonus_amount, d.unpaid_leave_deduction,
      d.absence_late_deduction, d.loan_deduction, d.gosi_employee_deduction, d.other_deductions,
      d.gross_salary, d.total_deductions, d.net_salary, d.working_days, d.absent_days
      FROM jsonb_populate_record(NULL::public.payroll_details, v_detail) d;
  END LOOP;
  -- Lock loans in stable order; snapshot each individual installment at calculation time.
  PERFORM l.id FROM public.loans l WHERE l.id IN
    (SELECT (value->>'loan_id')::uuid FROM jsonb_array_elements(p_allocations)) ORDER BY l.id FOR UPDATE;
  FOR v_allocation IN SELECT value FROM jsonb_array_elements(p_allocations) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.loans l JOIN public.payroll_details d ON d.employee_id=l.employee_id
      WHERE l.id=(v_allocation->>'loan_id')::uuid AND l.employee_id=(v_allocation->>'employee_id')::uuid
        AND d.payroll_run_id=v_id AND l.status='active'
        AND (v_allocation->>'amount')::numeric = round(least(l.monthly_installment,l.remaining_balance),2)) THEN
      RAISE EXCEPTION 'تغيرت بيانات السلفة، أعد احتساب المسيّر';
    END IF;
    INSERT INTO public.payroll_loan_allocations(payroll_run_id,loan_id,employee_id,amount)
      VALUES(v_id,(v_allocation->>'loan_id')::uuid,(v_allocation->>'employee_id')::uuid,(v_allocation->>'amount')::numeric);
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.payroll_details d WHERE d.payroll_run_id=v_id
    AND d.loan_deduction <> coalesce((SELECT sum(a.amount) FROM public.payroll_loan_allocations a
      WHERE a.payroll_run_id=v_id AND a.employee_id=d.employee_id),0)) THEN
    RAISE EXCEPTION 'إجمالي أقساط السلف غير مطابق لتفاصيل الرواتب';
  END IF;
  UPDATE public.payroll_runs SET total_employees=jsonb_array_length(p_details),
    total_basic_salary=(SELECT sum(basic_salary) FROM public.payroll_details WHERE payroll_run_id=v_id),
    total_allowances=(SELECT sum(housing_allowance+transport_allowance+other_allowances) FROM public.payroll_details WHERE payroll_run_id=v_id),
    total_overtime_amount=(SELECT sum(overtime_amount) FROM public.payroll_details WHERE payroll_run_id=v_id),
    total_deductions=(SELECT sum(total_deductions) FROM public.payroll_details WHERE payroll_run_id=v_id),
    total_net_salary=(SELECT sum(net_salary) FROM public.payroll_details WHERE payroll_run_id=v_id),
    total_employer_gosi=(p_run->>'total_employer_gosi')::numeric
    WHERE id=v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_payroll_run_status_atomic(p_run_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_run public.payroll_runs%ROWTYPE;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','payroll_officer','finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح بتعديل المسيّر';
  END IF;
  SELECT * INTO v_run FROM public.payroll_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المسيّر غير موجود'; END IF;
  IF v_run.status='paid' OR p_status IS NULL OR p_status NOT IN ('draft','locked') THEN
    RAISE EXCEPTION 'انتقال غير مسموح لحالة المسيّر';
  END IF;
  IF p_status='draft' AND v_run.status<>'draft' THEN RAISE EXCEPTION 'لا يمكن إعادة فتح مسيّر مقفل'; END IF;
  IF p_status='locked' AND v_run.status NOT IN ('draft','ready_for_review','locked','confirmed_locked') THEN
    RAISE EXCEPTION 'المسيّر غير جاهز للاعتماد';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payroll_details WHERE payroll_run_id=p_run_id) THEN
    RAISE EXCEPTION 'المسيّر لا يحتوي تفاصيل';
  END IF;
  UPDATE public.payroll_runs SET status=p_status,
    locked_at=CASE WHEN p_status='locked' THEN coalesce(locked_at,now()) ELSE locked_at END WHERE id=p_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_payroll_payments_atomic(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_run public.payroll_runs%ROWTYPE;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','payroll_officer','finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح بتجهيز الدفعات';
  END IF;
  SELECT * INTO v_run FROM public.payroll_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المسيّر غير موجود'; END IF;
  IF v_run.status NOT IN ('locked','confirmed_locked') THEN RAISE EXCEPTION 'اعتمد واقفل المسيّر قبل تجهيز دفعاته'; END IF;
  INSERT INTO public.payroll_payments(payroll_run_id,employee_id,net_amount,iban,bank_name)
    SELECT p_run_id,d.employee_id,d.net_salary,e.iban,e.bank_name FROM public.payroll_details d
      JOIN public.employees e ON e.id=d.employee_id WHERE d.payroll_run_id=p_run_id AND d.net_salary>0
    ON CONFLICT (payroll_run_id,employee_id) DO UPDATE SET
      net_amount=EXCLUDED.net_amount,iban=EXCLUDED.iban,bank_name=EXCLUDED.bank_name
      WHERE payroll_payments.status<>'paid';
  RETURN (SELECT jsonb_build_object('prepared',count(*),'missingIban',count(*) FILTER (WHERE nullif(trim(iban),'') IS NULL),
    'totalNet',coalesce(sum(net_amount),0)) FROM public.payroll_payments WHERE payroll_run_id=p_run_id AND status<>'paid');
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_payroll_payment_atomic(p_run_id uuid,p_account_id uuid,p_bank_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_run public.payroll_runs%ROWTYPE;
  v_account public.company_bank_accounts%ROWTYPE;
  v_amount numeric;
  v_count integer;
  v_allocation record;
  v_loan public.loans%ROWTYPE;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin','org_admin','finance_officer']) THEN
    RAISE EXCEPTION 'تأكيد التحويل متاح للمسؤول المالي أو مسؤول المنشأة';
  END IF;
  IF p_bank_reference IS NULL OR length(trim(p_bank_reference)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'مرجع البنك مطلوب';
  END IF;
  p_bank_reference := trim(p_bank_reference);
  SELECT * INTO v_run FROM public.payroll_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المسيّر غير موجود'; END IF;
  IF v_run.status='paid' THEN
    IF v_run.payment_bank_reference IS DISTINCT FROM p_bank_reference OR v_run.payment_account_id IS DISTINCT FROM p_account_id THEN
      RAISE EXCEPTION 'سبق تأكيد المسيّر بمرجع آخر';
    END IF;
    RETURN jsonb_build_object('alreadyConfirmed',true,'paid',0,'failed',0,'totalPaid',0,'batchNo',p_bank_reference,'runClosed',true);
  END IF;
  IF v_run.status NOT IN ('locked','confirmed_locked') THEN RAISE EXCEPTION 'المسيّر غير مقفل'; END IF;
  SELECT * INTO v_account FROM public.company_bank_accounts WHERE id=p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الحساب غير موجود أو غير مصرح به'; END IF;
  IF v_account.currency <> 'SAR' THEN RAISE EXCEPTION 'عملة الحساب غير مطابقة للمسيّر'; END IF;
  -- Require a complete prepared sheet and explicit confirmation of the whole batch.
  PERFORM id FROM public.payroll_payments WHERE payroll_run_id=p_run_id ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.payroll_details d WHERE d.payroll_run_id=p_run_id AND d.net_salary>0 AND NOT EXISTS (
      SELECT 1 FROM public.payroll_payments p WHERE p.payroll_run_id=p_run_id AND p.employee_id=d.employee_id AND p.net_amount=d.net_salary))
    OR EXISTS (SELECT 1 FROM public.payroll_payments p WHERE p.payroll_run_id=p_run_id AND (
      p.status='paid' OR nullif(trim(p.iban),'') IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.payroll_details d WHERE d.payroll_run_id=p_run_id AND d.employee_id=p.employee_id AND d.net_salary=p.net_amount AND d.net_salary>0))) THEN
    RAISE EXCEPTION 'راجع اكتمال دفعات المسيّر وبيانات الآيبان قبل التأكيد';
  END IF;
  SELECT count(*),coalesce(sum(net_amount),0) INTO v_count,v_amount FROM public.payroll_payments WHERE payroll_run_id=p_run_id;
  IF v_count=0 OR v_amount<>v_run.total_net_salary THEN RAISE EXCEPTION 'مجموع الدفعات غير مطابق للمسيّر'; END IF;
  IF v_account.current_balance<v_amount THEN RAISE EXCEPTION 'الرصيد الدفتري لا يغطي التحويل'; END IF;
  IF EXISTS (SELECT 1 FROM public.payroll_details d WHERE d.payroll_run_id=p_run_id AND d.loan_deduction<>
    coalesce((SELECT sum(a.amount) FROM public.payroll_loan_allocations a WHERE a.payroll_run_id=p_run_id AND a.employee_id=d.employee_id),0)) THEN
    RAISE EXCEPTION 'المسيّر لا يحتوي توزيع أقساط مطابق؛ راجع السلف قبل التأكيد';
  END IF;
  FOR v_allocation IN SELECT * FROM public.payroll_loan_allocations WHERE payroll_run_id=p_run_id ORDER BY loan_id FOR UPDATE LOOP
    IF v_allocation.recovered_at IS NOT NULL THEN RAISE EXCEPTION 'القسط مسترد بالفعل'; END IF;
    SELECT * INTO v_loan FROM public.loans WHERE id=v_allocation.loan_id FOR UPDATE;
    IF NOT FOUND OR v_loan.employee_id<>v_allocation.employee_id OR v_loan.status<>'active' OR v_loan.remaining_balance<v_allocation.amount THEN
      RAISE EXCEPTION 'تغير رصيد السلفة؛ راجع الأقساط قبل تأكيد التحويل';
    END IF;
    UPDATE public.loans SET remaining_balance=remaining_balance-v_allocation.amount,
      paid_installments=paid_installments+1,
      status=CASE WHEN remaining_balance=v_allocation.amount THEN 'closed' ELSE status END WHERE id=v_loan.id;
    UPDATE public.payroll_loan_allocations SET recovered_at=now() WHERE payroll_run_id=p_run_id AND loan_id=v_loan.id;
  END LOOP;
  UPDATE public.company_bank_accounts SET current_balance=current_balance-v_amount WHERE id=p_account_id;
  UPDATE public.payroll_payments SET status='paid',bank_account_id=p_account_id,
    batch_no=p_bank_reference,reference=p_bank_reference,paid_at=now(),failure_reason=NULL WHERE payroll_run_id=p_run_id;
  UPDATE public.payroll_runs SET status='paid',paid_at=now(),payment_bank_reference=p_bank_reference,
    payment_account_id=p_account_id,payment_confirmed_by=auth.uid() WHERE id=p_run_id;
  RETURN jsonb_build_object('alreadyConfirmed',false,'paid',v_count,'failed',0,'totalPaid',v_amount,
    'remainingBalance',v_account.current_balance-v_amount,'batchNo',p_bank_reference,'runClosed',true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_payroll_run_atomic(jsonb,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_payroll_run_status_atomic(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_payroll_payments_atomic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_payroll_payment_atomic(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_payroll_run_atomic(jsonb,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_payroll_run_status_atomic(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_payroll_payments_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payroll_payment_atomic(uuid,uuid,text) TO authenticated;
