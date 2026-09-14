-- Single authorization source: private_sec helpers (not exposed via the API schema)
CREATE OR REPLACE FUNCTION private_sec.current_user_has_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private_sec.current_user_has_role(app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private_sec.current_user_has_role(app_role) TO authenticated, service_role;

-- biometric_devices
DROP POLICY IF EXISTS hr_read_devices ON public.biometric_devices;
DROP POLICY IF EXISTS hr_manage_devices ON public.biometric_devices;

CREATE POLICY hr_read_devices ON public.biometric_devices
FOR SELECT TO authenticated
USING (
  private_sec.current_user_is_hr()
  OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('attendance_officer')
);

CREATE POLICY hr_manage_devices ON public.biometric_devices
FOR ALL TO authenticated
USING (private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin'))
WITH CHECK (private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin'));

-- company_bank_accounts
DROP POLICY IF EXISTS finance_read_accounts ON public.company_bank_accounts;
DROP POLICY IF EXISTS finance_manage_accounts ON public.company_bank_accounts;

CREATE POLICY finance_read_accounts ON public.company_bank_accounts
FOR SELECT TO authenticated
USING (
  private_sec.current_user_is_hr()
  OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('finance_officer')
  OR private_sec.current_user_has_role('payroll_officer')
);

CREATE POLICY finance_manage_accounts ON public.company_bank_accounts
FOR ALL TO authenticated
USING (
  private_sec.current_user_is_hr()
  OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('finance_officer')
)
WITH CHECK (
  private_sec.current_user_is_hr()
  OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('finance_officer')
);

-- payroll_payments: explicit per-command write restrictions (no employee self-writes)
DROP POLICY IF EXISTS finance_read_payments ON public.payroll_payments;
DROP POLICY IF EXISTS finance_manage_payments ON public.payroll_payments;

CREATE POLICY finance_read_payments ON public.payroll_payments
FOR SELECT TO authenticated
USING (
  private_sec.current_user_is_hr()
  OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('finance_officer')
  OR private_sec.current_user_has_role('payroll_officer')
);

CREATE POLICY finance_insert_payments ON public.payroll_payments
FOR INSERT TO authenticated
WITH CHECK (
  private_sec.current_user_is_hr()
  OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('finance_officer')
  OR private_sec.current_user_has_role('payroll_officer')
);

CREATE POLICY finance_update_payments ON public.payroll_payments
FOR UPDATE TO authenticated
USING (
  private_sec.current_user_is_hr()
  OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('finance_officer')
  OR private_sec.current_user_has_role('payroll_officer')
)
WITH CHECK (
  private_sec.current_user_is_hr()
  OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('finance_officer')
  OR private_sec.current_user_has_role('payroll_officer')
);

CREATE POLICY finance_delete_payments ON public.payroll_payments
FOR DELETE TO authenticated
USING (
  private_sec.current_user_is_hr()
  OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('finance_officer')
);

-- No RLS policy depends on the API-exposed SECURITY DEFINER helpers anymore.
REVOKE EXECUTE ON FUNCTION public.is_hr(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;