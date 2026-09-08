CREATE OR REPLACE FUNCTION public.set_payroll_run_status_atomic(p_run_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_run public.payroll_runs%ROWTYPE;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','payroll_officer','finance_officer']) THEN RAISE EXCEPTION 'غير مصرح بتعديل المسيّر'; END IF;
  SELECT * INTO v_run FROM public.payroll_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المسيّر غير موجود'; END IF;
  IF v_run.status='paid' OR p_status IS NULL OR p_status NOT IN ('draft','locked') THEN RAISE EXCEPTION 'انتقال غير مسموح لحالة المسيّر'; END IF;
  IF p_status='draft' AND v_run.status<>'draft' THEN RAISE EXCEPTION 'لا يمكن إعادة فتح مسيّر مقفل'; END IF;
  IF p_status='locked' AND v_run.status NOT IN ('draft','ready_for_review','locked','confirmed_locked') THEN RAISE EXCEPTION 'المسيّر غير جاهز للاعتماد'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payroll_details WHERE payroll_run_id=p_run_id) THEN RAISE EXCEPTION 'المسيّر لا يحتوي تفاصيل'; END IF;
  UPDATE public.payroll_runs SET status=p_status, locked_at=CASE WHEN p_status='locked' THEN coalesce(locked_at,now()) ELSE locked_at END WHERE id=p_run_id;
  IF p_status='locked' THEN
    UPDATE public.salary_advances SET status='deducted', deducted_amount=coalesce(approved_amount,requested_amount), reviewed_at=coalesce(reviewed_at,now())
      WHERE period_year=v_run.period_year AND period_month=v_run.period_month AND status IN ('approved','paid');
  END IF;
END; $$;
