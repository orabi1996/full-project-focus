-- Durable attendance corrections and overtime approvals.
-- Requests remain auditable and are not folded into payroll until approved.
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS early_departure_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_details
  ADD COLUMN IF NOT EXISTS salary_advance_deduction numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.attendance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL UNIQUE DEFAULT 'global',
  late_grace_minutes integer NOT NULL DEFAULT 15 CHECK (late_grace_minutes >= 0),
  early_departure_grace_minutes integer NOT NULL DEFAULT 15 CHECK (early_departure_grace_minutes >= 0),
  rounding_minutes integer NOT NULL DEFAULT 1 CHECK (rounding_minutes IN (1, 5, 10, 15, 30, 60)),
  rounding_mode text NOT NULL DEFAULT 'up' CHECK (rounding_mode IN ('exact', 'up', 'nearest')),
  deduction_cap_percent numeric(5,2) NOT NULL DEFAULT 100 CHECK (deduction_cap_percent >= 0 AND deduction_cap_percent <= 100),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salary_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_year integer NOT NULL CHECK (period_year BETWEEN 2000 AND 2200),
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  requested_amount numeric(14,2) NOT NULL CHECK (requested_amount > 0),
  approved_amount numeric(14,2),
  deducted_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (deducted_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid','deducted','cancelled')),
  reason text NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (employee_id, period_year, period_month)
);

ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY salary_advances_self_read ON public.salary_advances FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY salary_advances_self_insert ON public.salary_advances FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY salary_advances_hr_update ON public.salary_advances FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

INSERT INTO public.attendance_policies (scope_key)
VALUES ('global') ON CONFLICT (scope_key) DO NOTHING;

ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_policies_authenticated_read ON public.attendance_policies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY attendance_policies_hr_write ON public.attendance_policies
  FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

CREATE OR REPLACE FUNCTION public.disburse_loans_atomic(p_bank_account_id uuid, p_loan_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric(14,2);
  v_balance numeric(14,2);
  v_count integer;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin','org_admin','payroll_officer','finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح بصرف السلف';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('loan-disbursement'));
  SELECT current_balance INTO v_balance FROM public.company_bank_accounts WHERE id = p_bank_account_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'حساب المنشأة غير موجود'; END IF;
  SELECT COALESCE(sum(amount),0), count(*) INTO v_total, v_count
    FROM (SELECT COALESCE(approved_amount, principal_amount) AS amount FROM public.loans
           WHERE status = 'approved' AND (p_loan_ids IS NULL OR id = ANY(p_loan_ids)) FOR UPDATE) locked_loans;
  IF v_count = 0 THEN RAISE EXCEPTION 'لا توجد سلف معتمدة بانتظار الصرف'; END IF;
  IF v_total > v_balance THEN RAISE EXCEPTION 'رصيد حساب المنشأة لا يكفي لصرف السلف المعتمدة'; END IF;
  UPDATE public.loans SET status='active', approved_amount=round(COALESCE(approved_amount, principal_amount),2),
    outstanding_amount=round(COALESCE(approved_amount, principal_amount),2),
    remaining_balance=round(COALESCE(approved_amount, principal_amount),2), decided_at=now()
   WHERE status='approved' AND (p_loan_ids IS NULL OR id = ANY(p_loan_ids));
  UPDATE public.company_bank_accounts SET current_balance=round(v_balance-v_total,2) WHERE id=p_bank_account_id;
  RETURN jsonb_build_object('disbursed',v_count,'totalDisbursed',round(v_total,2),'remainingBalance',round(v_balance-v_total,2));
END; $$;

CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  correct_in time,
  correct_out time,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','returned')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  review_note text,
  UNIQUE (employee_id, work_date, status)
);

CREATE TABLE IF NOT EXISTS public.overtime_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  hours numeric(8,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  hourly_rate numeric(12,2) NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  rate_multiplier numeric(5,2) NOT NULL DEFAULT 1.5 CHECK (rate_multiplier > 0),
  total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','returned')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  review_note text
);

CREATE INDEX IF NOT EXISTS attendance_corrections_employee_date_idx
  ON public.attendance_corrections(employee_id, work_date);
CREATE INDEX IF NOT EXISTS overtime_requests_employee_date_idx
  ON public.overtime_requests(employee_id, work_date);

ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_corrections_self_read ON public.attendance_corrections
  FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY attendance_corrections_self_insert ON public.attendance_corrections
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY attendance_corrections_hr_update ON public.attendance_corrections
  FOR UPDATE TO authenticated
  USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());

CREATE POLICY overtime_requests_self_read ON public.overtime_requests
  FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY overtime_requests_self_insert ON public.overtime_requests
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY overtime_requests_hr_update ON public.overtime_requests
  FOR UPDATE TO authenticated
  USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
