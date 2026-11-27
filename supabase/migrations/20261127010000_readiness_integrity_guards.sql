BEGIN;

-- Atomic, tenant-scoped decision path for biometric attendance approvals.
CREATE OR REPLACE FUNCTION public.decide_attendance_punch_atomic(
  p_punch_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_employee_id uuid;
  v_punch_time timestamptz;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'قرار البصمة غير صالح';
  END IF;
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'attendance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك باتخاذ قرار على البصمة';
  END IF;

  SELECT e.company_id, p.employee_id, p.punch_time
    INTO v_company_id, v_employee_id, v_punch_time
  FROM public.punches p
  JOIN public.employees e ON e.id = p.employee_id
  WHERE p.id = p_punch_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'البصمة غير موجودة';
  END IF;
  IF NOT public.has_role(auth.uid(), 'super_admin')
     AND NOT public.can_access_core_company(v_company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة بصمة تتبع منشأة أخرى';
  END IF;

  UPDATE public.punches
  SET approval_status = p_decision
  WHERE id = p_punch_id AND approval_status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'تم اتخاذ قرار على هذه البصمة مسبقاً';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'employee_id', v_employee_id,
    'punch_time', v_punch_time,
    'decision', p_decision
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decide_attendance_punch_atomic(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_attendance_punch_atomic(uuid, text) TO authenticated;

-- Do not allow the payment RPC to bypass the explicit reimbursement approval step.
CREATE OR REPLACE FUNCTION public.guard_reimbursement_batch_payment_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payment_status = 'confirmed_paid' AND OLD.payment_status IS DISTINCT FROM 'confirmed_paid' THEN
    IF auth.uid() IS NOT NULL AND (
      NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'finance_officer'])
      OR (NOT public.has_role(auth.uid(), 'super_admin') AND NOT public.can_access_core_company(NEW.company_id))
    ) THEN
      RAISE EXCEPTION 'غير مصرح لك بتأكيد سداد دفعة تخص هذه المنشأة';
    END IF;
    IF OLD.payment_status NOT IN ('approved_for_payment', 'submitted') THEN
      RAISE EXCEPTION 'يجب اعتماد دفعة التعويض للصرف قبل تأكيد السداد';
    END IF;
    IF NEW.bank_account_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.company_bank_accounts WHERE id = NEW.bank_account_id
    ) THEN
      RAISE EXCEPTION 'الحساب البنكي المحدد لدفعة التعويض غير موجود';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_reimbursement_batch_payment_approval ON public.reimbursement_batches;
CREATE TRIGGER trg_guard_reimbursement_batch_payment_approval
BEFORE UPDATE OF payment_status ON public.reimbursement_batches
FOR EACH ROW EXECUTE FUNCTION public.guard_reimbursement_batch_payment_approval();

COMMIT;
