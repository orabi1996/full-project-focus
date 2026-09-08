-- Complete the final-settlement lifecycle (EOSB, leave payout, outstanding loans).
-- The payment reference is recorded only after the external transfer succeeds.

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS notice_period_served boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leave_payout_days numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_salary_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_deduction_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asset_clearance_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eosb_notes text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'settlements_amounts_nonnegative'
      AND conrelid = 'public.settlements'::regclass
  ) THEN
    ALTER TABLE public.settlements
      ADD CONSTRAINT settlements_amounts_nonnegative CHECK (
        eosb_amount >= 0
        AND leave_payout_amount >= 0
        AND leave_payout_days >= 0
        AND pending_salary_amount >= 0
        AND loan_deduction_amount >= 0
        AND net_settlement_amount >= 0
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS settlements_employee_status_idx
  ON public.settlements (employee_id, status, termination_date DESC);

CREATE OR REPLACE FUNCTION public.set_settlement_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS settlements_set_updated_at ON public.settlements;
CREATE TRIGGER settlements_set_updated_at
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.set_settlement_updated_at();

CREATE OR REPLACE FUNCTION public.set_settlement_status_atomic(
  p_settlement_id uuid,
  p_status text,
  p_payment_reference text DEFAULT NULL,
  p_asset_clearance_complete boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settlement public.settlements%ROWTYPE;
  v_clearance boolean;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('draft', 'pending_approval', 'approved', 'paid') THEN
    RAISE EXCEPTION 'حالة المخالصة غير صالحة';
  END IF;

  SELECT * INTO v_settlement
  FROM public.settlements
  WHERE id = p_settlement_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المخالصة غير موجودة'; END IF;

  IF p_status = v_settlement.status THEN
    IF p_status = 'paid' AND v_settlement.payment_reference IS DISTINCT FROM nullif(trim(p_payment_reference), '') THEN
      RAISE EXCEPTION 'سبق صرف المخالصة بمرجع مختلف';
    END IF;
    RETURN jsonb_build_object('id', v_settlement.id, 'status', v_settlement.status, 'alreadyApplied', true);
  END IF;

  IF p_status = 'pending_approval' THEN
    IF NOT public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','payroll_officer','finance_officer']) THEN
      RAISE EXCEPTION 'غير مصرح بإرسال المخالصة للاعتماد';
    END IF;
    IF v_settlement.status <> 'draft' THEN RAISE EXCEPTION 'لا يمكن إرسال هذه المخالصة للاعتماد'; END IF;
  ELSIF p_status = 'approved' THEN
    IF NOT public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','finance_officer']) THEN
      RAISE EXCEPTION 'غير مصرح باعتماد المخالصة';
    END IF;
    IF v_settlement.status <> 'pending_approval' THEN RAISE EXCEPTION 'المخالصة ليست بانتظار الاعتماد'; END IF;
  ELSIF p_status = 'paid' THEN
    IF NOT public.current_user_has_any_role(ARRAY['super_admin','org_admin','finance_officer']) THEN
      RAISE EXCEPTION 'صرف المخالصة متاح للمسؤول المالي أو مسؤول المنشأة';
    END IF;
    IF v_settlement.status <> 'approved' THEN RAISE EXCEPTION 'اعتمد المخالصة قبل تسجيل صرفها'; END IF;
    v_clearance := coalesce(p_asset_clearance_complete, v_settlement.asset_clearance_complete, false);
    IF NOT v_clearance THEN RAISE EXCEPTION 'أكمل إخلاء طرف الأصول قبل صرف المخالصة'; END IF;
    IF nullif(trim(p_payment_reference), '') IS NULL OR length(trim(p_payment_reference)) > 120 THEN
      RAISE EXCEPTION 'مرجع صرف المخالصة مطلوب (حتى 120 حرفًا)';
    END IF;
  END IF;

  UPDATE public.settlements
  SET status = p_status,
      asset_clearance_complete = coalesce(p_asset_clearance_complete, asset_clearance_complete),
      approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE approved_by END,
      approved_at = CASE WHEN p_status = 'approved' THEN coalesce(approved_at, now()) ELSE approved_at END,
      paid_at = CASE WHEN p_status = 'paid' THEN coalesce(paid_at, now()) ELSE paid_at END,
      payment_reference = CASE WHEN p_status = 'paid' THEN trim(p_payment_reference) ELSE payment_reference END
  WHERE id = p_settlement_id;

  RETURN jsonb_build_object(
    'id', p_settlement_id,
    'status', p_status,
    'alreadyApplied', false,
    'paymentReference', CASE WHEN p_status = 'paid' THEN trim(p_payment_reference) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_settlement_status_atomic(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_settlement_status_atomic(uuid, text, text, boolean) TO authenticated;
