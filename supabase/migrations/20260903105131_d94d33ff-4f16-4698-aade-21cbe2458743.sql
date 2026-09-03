GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_payments TO authenticated;
GRANT ALL ON public.payroll_payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_bank_accounts TO authenticated;
GRANT ALL ON public.company_bank_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_devices TO authenticated;
GRANT ALL ON public.biometric_devices TO service_role;