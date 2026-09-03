CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_name text;

CREATE TABLE public.biometric_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  work_location_id uuid REFERENCES public.work_locations(id),
  device_token text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  auto_approve boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  total_punches integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id, device_id, name_ar, work_location_id, status, auto_approve, last_seen_at, total_punches, created_at, updated_at) ON public.biometric_devices TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.biometric_devices TO authenticated;
GRANT ALL ON public.biometric_devices TO service_role;
ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_read_devices" ON public.biometric_devices FOR SELECT TO authenticated
  USING (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'attendance_officer'));
CREATE POLICY "hr_manage_devices" ON public.biometric_devices FOR ALL TO authenticated
  USING (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.company_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  iban text NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  current_balance numeric NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_bank_accounts TO authenticated;
GRANT ALL ON public.company_bank_accounts TO service_role;
ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_read_accounts" ON public.company_bank_accounts FOR SELECT TO authenticated
  USING (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_officer') OR public.has_role(auth.uid(), 'payroll_officer'));
CREATE POLICY "finance_manage_accounts" ON public.company_bank_accounts FOR ALL TO authenticated
  USING (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_officer'))
  WITH CHECK (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_officer'));

CREATE TABLE public.payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.company_bank_accounts(id),
  batch_no text,
  net_amount numeric NOT NULL DEFAULT 0,
  iban text,
  bank_name text,
  status text NOT NULL DEFAULT 'pending',
  reference text,
  failure_reason text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_payments TO authenticated;
GRANT ALL ON public.payroll_payments TO service_role;
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_read_own_payments" ON public.payroll_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = payroll_payments.employee_id AND e.user_id = auth.uid()));
CREATE POLICY "finance_read_payments" ON public.payroll_payments FOR SELECT TO authenticated
  USING (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_officer') OR public.has_role(auth.uid(), 'payroll_officer'));
CREATE POLICY "finance_manage_payments" ON public.payroll_payments FOR ALL TO authenticated
  USING (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_officer') OR public.has_role(auth.uid(), 'payroll_officer'))
  WITH CHECK (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_officer') OR public.has_role(auth.uid(), 'payroll_officer'));

CREATE INDEX idx_payroll_payments_run ON public.payroll_payments(payroll_run_id);
CREATE INDEX idx_payroll_payments_employee ON public.payroll_payments(employee_id);

CREATE TRIGGER trg_payroll_payments_updated BEFORE UPDATE ON public.payroll_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.company_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_biometric_devices_updated BEFORE UPDATE ON public.biometric_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();