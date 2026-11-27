BEGIN;

-- Restrict bank account visibility to the company that owns each account.
CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_company_id
  ON public.company_bank_accounts(company_id);

DROP POLICY IF EXISTS company_bank_accounts_tenant_guard ON public.company_bank_accounts;
CREATE POLICY company_bank_accounts_tenant_guard
  ON public.company_bank_accounts
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (company_id IS NOT NULL AND public.can_access_core_company(company_id))
  WITH CHECK (company_id IS NOT NULL AND public.can_access_core_company(company_id));

-- Devices inherit tenant ownership from their assigned work location. Null or
-- inaccessible locations are visible/manageable only to an existing
-- super-admin permissive policy, and cannot be created by ordinary HR users.
-- An earlier migration granted table-wide SELECT and overrode the original
-- column-level grant, exposing the device_token. Restore an explicit safe list.
REVOKE SELECT ON public.biometric_devices FROM authenticated;
GRANT SELECT (
  id, device_id, name_ar, work_location_id, status, auto_approve,
  last_seen_at, total_punches, created_at, updated_at
) ON public.biometric_devices TO authenticated;

DROP POLICY IF EXISTS biometric_devices_tenant_guard ON public.biometric_devices;
CREATE POLICY biometric_devices_tenant_guard
  ON public.biometric_devices
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
       SELECT 1
       FROM public.work_locations wl
       WHERE wl.id = biometric_devices.work_location_id
         AND public.can_access_core_company(wl.company_id)
     )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
       SELECT 1
       FROM public.work_locations wl
       WHERE wl.id = biometric_devices.work_location_id
         AND public.can_access_core_company(wl.company_id)
     )
  );

-- Enforce company matching for every persisted bank-account reference. This
-- also protects RPCs that update the parent status after debiting an account.
CREATE OR REPLACE FUNCTION public.guard_bank_account_company_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_bank_account_id uuid;
  v_bank_company_id uuid;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'reimbursement_batches' THEN
      v_company_id := NEW.company_id;
      v_bank_account_id := NEW.bank_account_id;
    WHEN 'payroll_runs' THEN
      v_company_id := NEW.company_id;
      v_bank_account_id := NEW.payment_account_id;
    WHEN 'payroll_payments' THEN
      v_bank_account_id := NEW.bank_account_id;
      SELECT pr.company_id INTO v_company_id
      FROM public.payroll_runs pr
      WHERE pr.id = NEW.payroll_run_id;
    WHEN 'loans' THEN
      v_company_id := NEW.company_id;
      v_bank_account_id := NEW.disbursement_account_id;
    WHEN 'loan_disbursements' THEN
      v_company_id := NEW.company_id;
      v_bank_account_id := NEW.bank_account_id;
    WHEN 'settlements' THEN
      v_company_id := NEW.company_id;
      v_bank_account_id := NEW.payment_bank_account_id;
    ELSE
      RAISE EXCEPTION 'Unsupported bank-account link table: %', TG_TABLE_NAME;
  END CASE;

  IF v_bank_account_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا يمكن ربط حساب بنكي بسجل لا يملك منشأة محددة';
  END IF;

  SELECT cba.company_id INTO v_bank_company_id
  FROM public.company_bank_accounts cba
  WHERE cba.id = v_bank_account_id;

  IF NOT FOUND OR v_bank_company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'الحساب البنكي المحدد لا يتبع المنشأة المالكة للسجل';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_bank_account_company_link() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reimbursement_batch_bank_company ON public.reimbursement_batches;
CREATE TRIGGER trg_reimbursement_batch_bank_company
  BEFORE INSERT OR UPDATE OF company_id, bank_account_id, payment_status
  ON public.reimbursement_batches
  FOR EACH ROW EXECUTE FUNCTION public.guard_bank_account_company_link();

DROP TRIGGER IF EXISTS trg_payroll_run_bank_company ON public.payroll_runs;
CREATE TRIGGER trg_payroll_run_bank_company
  BEFORE INSERT OR UPDATE OF company_id, payment_account_id
  ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.guard_bank_account_company_link();

DROP TRIGGER IF EXISTS trg_payroll_payment_bank_company ON public.payroll_payments;
CREATE TRIGGER trg_payroll_payment_bank_company
  BEFORE INSERT OR UPDATE OF payroll_run_id, bank_account_id
  ON public.payroll_payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_bank_account_company_link();

DROP TRIGGER IF EXISTS trg_loan_bank_company ON public.loans;
CREATE TRIGGER trg_loan_bank_company
  BEFORE INSERT OR UPDATE OF company_id, disbursement_account_id
  ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.guard_bank_account_company_link();

DROP TRIGGER IF EXISTS trg_loan_disbursement_bank_company ON public.loan_disbursements;
CREATE TRIGGER trg_loan_disbursement_bank_company
  BEFORE INSERT OR UPDATE OF company_id, bank_account_id
  ON public.loan_disbursements
  FOR EACH ROW EXECUTE FUNCTION public.guard_bank_account_company_link();

DROP TRIGGER IF EXISTS trg_settlement_bank_company ON public.settlements;
CREATE TRIGGER trg_settlement_bank_company
  BEFORE INSERT OR UPDATE OF company_id, payment_bank_account_id
  ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.guard_bank_account_company_link();

COMMIT;
