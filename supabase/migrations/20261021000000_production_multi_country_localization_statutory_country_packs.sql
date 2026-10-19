-- ============================================================================
-- MADARX ENTERPRISE WORKFORCE PLATFORM
-- PROMPT 34: PRODUCTION MULTI-COUNTRY HR / PAYROLL LOCALIZATION,
-- STATUTORY COMPLIANCE & COUNTRY PACK ENGINE (GOVERNANCE, SNAPSHOTS, RLS & LIFECYCLE)
-- supabase/migrations/20261021000000_production_multi_country_localization_statutory_country_packs.sql
-- ============================================================================

-- 1. ENHANCE COUNTRY PACKS REGISTRY WITH CURRENCY PRECISION, TIMEZONE & VERIFICATION STATUS
ALTER TABLE country_packs
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(40) NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('architecture_ready', 'configuration_required', 'verified', 'production_active')),
  ADD COLUMN IF NOT EXISTS timezone_default VARCHAR(60) NOT NULL DEFAULT 'Asia/Riyadh',
  ADD COLUMN IF NOT EXISTS working_week_days TEXT[] NOT NULL DEFAULT ARRAY['sun','mon','tue','wed','thu'],
  ADD COLUMN IF NOT EXISTS decimal_precision INT NOT NULL DEFAULT 2
    CHECK (decimal_precision IN (2, 3)),
  ADD COLUMN IF NOT EXISTS rounding_policy VARCHAR(30) NOT NULL DEFAULT 'HALF_UP';

UPDATE country_packs SET
  timezone_default = 'Africa/Cairo',
  decimal_precision = 2,
  rounding_policy = 'HALF_UP',
  verification_status = 'production_active',
  updated_at = clock_timestamp()
WHERE country_code = 'EG';

UPDATE country_packs SET
  timezone_default = 'Asia/Riyadh',
  decimal_precision = 2,
  rounding_policy = 'HALF_UP',
  verification_status = 'production_active',
  updated_at = clock_timestamp()
WHERE country_code = 'SA';

UPDATE country_packs SET
  timezone_default = 'Asia/Qatar',
  decimal_precision = 2,
  rounding_policy = 'HALF_UP',
  verification_status = 'production_active',
  updated_at = clock_timestamp()
WHERE country_code = 'QA';

UPDATE country_packs SET
  timezone_default = 'Asia/Muscat',
  decimal_precision = 3,
  rounding_policy = 'HALF_UP',
  verification_status = 'production_active',
  updated_at = clock_timestamp()
WHERE country_code = 'OM';

UPDATE country_packs SET
  timezone_default = 'Asia/Bahrain',
  decimal_precision = 3,
  rounding_policy = 'HALF_UP',
  verification_status = 'production_active',
  updated_at = clock_timestamp()
WHERE country_code = 'BH';

-- 2. LEGAL ENTITY LOCALIZATION EXTENSIONS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'legal_entities'
  ) THEN
    ALTER TABLE public.legal_entities
      ADD COLUMN IF NOT EXISTS country_pack_code VARCHAR(2) REFERENCES public.country_packs(country_code),
      ADD COLUMN IF NOT EXISTS localization_pack_version VARCHAR(50) DEFAULT 'SA-2024-V1',
      ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'SAR',
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(60) DEFAULT 'Asia/Riyadh',
      ADD COLUMN IF NOT EXISTS default_language VARCHAR(5) DEFAULT 'ar',
      ADD COLUMN IF NOT EXISTS statutory_employer_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS tax_registration_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS social_insurance_employer_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS wps_employer_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS working_week_policy JSONB DEFAULT '["sun","mon","tue","wed","thu"]'::jsonb,
      ADD COLUMN IF NOT EXISTS holiday_calendar_country_code VARCHAR(2),
      ADD COLUMN IF NOT EXISTS payroll_statutory_profile JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 3. WPS BATCH VERSIONING & REGENERATION EXTENSIONS
ALTER TABLE wps_batches
  ADD COLUMN IF NOT EXISTS file_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_batch_id UUID REFERENCES wps_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regeneration_reason TEXT,
  ADD COLUMN IF NOT EXISTS adapter_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(128);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wps_batches_status_check'
  ) THEN
    ALTER TABLE wps_batches DROP CONSTRAINT wps_batches_status_check;
  END IF;
  ALTER TABLE wps_batches
    ADD CONSTRAINT wps_batches_status_check
    CHECK (status IN ('draft', 'validated', 'exported', 'submitted', 'rejected', 'superseded'));
END $$;

-- 4. CROSS-COUNTRY EMPLOYEE LOCALIZATION HISTORY
CREATE TABLE IF NOT EXISTS employee_localization_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  legal_entity_id UUID,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE RESTRICT,
  currency_code VARCHAR(3) NOT NULL,
  country_pack_version VARCHAR(50) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  transfer_movement_id UUID,
  transfer_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_employee_localization_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_employee_localization_history_lookup
  ON employee_localization_history(company_id, employee_id, effective_from DESC);

-- 5. IMMUTABLE PAYROLL STATUTORY SNAPSHOTS (HISTORICAL PAYROLL IMMUTABILITY & TRACEABILITY)
CREATE TABLE IF NOT EXISTS payroll_statutory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE RESTRICT,
  currency_code VARCHAR(3) NOT NULL,
  decimal_precision INT NOT NULL DEFAULT 2,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  country_pack_version VARCHAR(50) NOT NULL,
  tax_rule_version VARCHAR(50),
  social_insurance_rule_version VARCHAR(50),
  eos_rule_version VARCHAR(50),
  gross_wage NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  insurable_wage NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  employee_social_insurance NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  employer_social_insurance NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  monthly_income_tax NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  eos_accrual_amount NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  calculation_trace JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_locked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_payroll_statutory_snapshot UNIQUE (payroll_run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_statutory_snapshots_run
  ON payroll_statutory_snapshots(company_id, payroll_run_id);

CREATE OR REPLACE FUNCTION prevent_locked_statutory_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_locked = true THEN
    RAISE EXCEPTION 'Cannot mutate or delete a locked historical payroll statutory snapshot (snapshot_id=%)', OLD.id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_statutory_snapshot_mutation ON payroll_statutory_snapshots;
CREATE TRIGGER trg_prevent_locked_statutory_snapshot_mutation
  BEFORE UPDATE OR DELETE ON payroll_statutory_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_statutory_snapshot_mutation();

-- 6. STATUTORY RULE SIMULATIONS (CURRENT VERSION VS CANDIDATE VERSION)
CREATE TABLE IF NOT EXISTS statutory_rule_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  baseline_version_code VARCHAR(50) NOT NULL,
  candidate_version_code VARCHAR(50) NOT NULL,
  affected_employees_count INT NOT NULL DEFAULT 0,
  baseline_employer_cost NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  candidate_employer_cost NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  employer_cost_delta NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  baseline_employee_deduction NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  candidate_employee_deduction NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  employee_deduction_delta NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  net_pay_delta NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  simulation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  simulated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_statutory_rule_simulations_company
  ON statutory_rule_simulations(company_id, country_code, created_at DESC);

-- 7. RETROACTIVE STATUTORY ADJUSTMENTS (NON-DESTRUCTIVE DELTA PROPOSALS)
CREATE TABLE IF NOT EXISTS retroactive_statutory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE RESTRICT,
  source_closed_payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  target_open_payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  prior_rule_version VARCHAR(50) NOT NULL,
  retroactive_rule_version VARCHAR(50) NOT NULL,
  retroactive_effective_from DATE NOT NULL,
  employee_deduction_delta NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  employer_contribution_delta NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  tax_delta NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  net_adjustment_amount NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
  status VARCHAR(20) NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'applied', 'rejected')),
  calculation_trace JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_retroactive_statutory_adjustments_company
  ON retroactive_statutory_adjustments(company_id, status, country_code);

-- 8. STATUTORY REPORTS & FILINGS REGISTER
CREATE TABLE IF NOT EXISTS statutory_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE RESTRICT,
  report_code VARCHAR(80) NOT NULL,
  report_title_ar VARCHAR(255) NOT NULL,
  report_title_en VARCHAR(255) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rule_version VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generated', 'validated', 'submitted', 'accepted', 'rejected')),
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_reference VARCHAR(120),
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_statutory_reports_company
  ON statutory_reports(company_id, country_code, period_start DESC);

-- 9. LOCALIZATION COMPLIANCE EXCEPTION CENTER
CREATE TABLE IF NOT EXISTS localization_compliance_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE RESTRICT,
  exception_category VARCHAR(60) NOT NULL
    CHECK (exception_category IN (
      'missing_national_id',
      'expired_residency_id',
      'missing_iban',
      'invalid_iban',
      'missing_social_insurance_enrollment',
      'wage_below_minimum_basis',
      'wage_above_ceiling_unhandled',
      'contract_probation_violation',
      'working_hours_violation',
      'leave_below_statutory_minimum',
      'wps_blocked_employee'
    )),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('BLOCK', 'WARNING', 'INFO')),
  title_ar VARCHAR(255) NOT NULL,
  description_ar TEXT NOT NULL,
  resolution_status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (resolution_status IN ('open', 'resolved', 'overridden')),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_localization_compliance_exceptions_company
  ON localization_compliance_exceptions(company_id, country_code, resolution_status, severity);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) FOR ALL COUNTRY PACK & STATUTORY TABLES
-- ============================================================================

ALTER TABLE country_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_rule_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_insurance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_tax_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holiday_calendars ENABLE ROW LEVEL SECURITY;

ALTER TABLE employee_statutory_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wps_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE wps_batch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_localization_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_statutory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_rule_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE retroactive_statutory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE localization_compliance_exceptions ENABLE ROW LEVEL SECURITY;

-- Reference catalogs readable by authenticated users
DROP POLICY IF EXISTS p_country_packs_read ON country_packs;
CREATE POLICY p_country_packs_read ON country_packs FOR SELECT USING (true);

DROP POLICY IF EXISTS p_statutory_rule_sources_read ON statutory_rule_sources;
CREATE POLICY p_statutory_rule_sources_read ON statutory_rule_sources FOR SELECT USING (true);

DROP POLICY IF EXISTS p_statutory_rule_sets_read ON statutory_rule_sets;
CREATE POLICY p_statutory_rule_sets_read ON statutory_rule_sets FOR SELECT USING (true);

DROP POLICY IF EXISTS p_statutory_rules_read ON statutory_rules;
CREATE POLICY p_statutory_rules_read ON statutory_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS p_social_insurance_profiles_read ON social_insurance_profiles;
CREATE POLICY p_social_insurance_profiles_read ON social_insurance_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS p_statutory_tax_brackets_read ON statutory_tax_brackets;
CREATE POLICY p_statutory_tax_brackets_read ON statutory_tax_brackets FOR SELECT USING (true);

DROP POLICY IF EXISTS p_public_holiday_calendars_read ON public_holiday_calendars;
CREATE POLICY p_public_holiday_calendars_read ON public_holiday_calendars FOR SELECT USING (true);

-- Tenant-isolated tables
DROP POLICY IF EXISTS p_employee_statutory_profiles_tenant ON employee_statutory_profiles;
CREATE POLICY p_employee_statutory_profiles_tenant ON employee_statutory_profiles
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS p_wps_batches_tenant ON wps_batches;
CREATE POLICY p_wps_batches_tenant ON wps_batches
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS p_wps_batch_records_tenant ON wps_batch_records;
CREATE POLICY p_wps_batch_records_tenant ON wps_batch_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM wps_batches b
      WHERE b.id = wps_batch_records.batch_id
        AND b.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wps_batches b
      WHERE b.id = wps_batch_records.batch_id
        AND b.company_id = public.current_company_id()
    )
  );

DROP POLICY IF EXISTS p_statutory_compliance_checks_tenant ON statutory_compliance_checks;
CREATE POLICY p_statutory_compliance_checks_tenant ON statutory_compliance_checks
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS p_statutory_overrides_tenant ON statutory_overrides;
CREATE POLICY p_statutory_overrides_tenant ON statutory_overrides
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS p_employee_localization_history_tenant ON employee_localization_history;
CREATE POLICY p_employee_localization_history_tenant ON employee_localization_history
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS p_payroll_statutory_snapshots_tenant ON payroll_statutory_snapshots;
CREATE POLICY p_payroll_statutory_snapshots_tenant ON payroll_statutory_snapshots
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS p_statutory_rule_simulations_tenant ON statutory_rule_simulations;
CREATE POLICY p_statutory_rule_simulations_tenant ON statutory_rule_simulations
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS p_retroactive_statutory_adjustments_tenant ON retroactive_statutory_adjustments;
CREATE POLICY p_retroactive_statutory_adjustments_tenant ON retroactive_statutory_adjustments
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS p_statutory_reports_tenant ON statutory_reports;
CREATE POLICY p_statutory_reports_tenant ON statutory_reports
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS p_localization_compliance_exceptions_tenant ON localization_compliance_exceptions;
CREATE POLICY p_localization_compliance_exceptions_tenant ON localization_compliance_exceptions
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ============================================================================
-- 11. FOUR-EYES RULE SET ACTIVATION, TRANSFER & WPS REGENERATION RPCS
-- ============================================================================

-- A. FOUR-EYES STATUTORY RULE SET ACTIVATION
CREATE OR REPLACE FUNCTION activate_statutory_rule_set_four_eyes_atomic(
  p_rule_set_id UUID,
  p_approver_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule_set statutory_rule_sets%ROWTYPE;
BEGIN
  SELECT * INTO v_rule_set
  FROM statutory_rule_sets
  WHERE id = p_rule_set_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statutory rule set not found';
  END IF;

  IF v_rule_set.proposed_by IS NOT NULL AND v_rule_set.proposed_by = p_approver_id THEN
    RAISE EXCEPTION 'Four-eyes governance violation: proposer cannot approve and activate the same statutory rule set';
  END IF;

  -- Mark prior active rule sets with overlapping effective_from as superseded if older
  UPDATE statutory_rule_sets
  SET
    effective_to = COALESCE(effective_to, v_rule_set.effective_from - INTERVAL '1 day')::DATE,
    status = CASE WHEN effective_from < v_rule_set.effective_from THEN 'superseded' ELSE status END,
    updated_at = clock_timestamp()
  WHERE country_code = v_rule_set.country_code
    AND id != v_rule_set.id
    AND status = 'active'
    AND effective_from < v_rule_set.effective_from;

  UPDATE statutory_rule_sets
  SET
    status = 'active',
    approved_by = p_approver_id,
    approved_at = clock_timestamp(),
    notes = COALESCE(p_notes, notes),
    updated_at = clock_timestamp()
  WHERE id = p_rule_set_id;

  RETURN jsonb_build_object(
    'ok', true,
    'rule_set_id', p_rule_set_id,
    'country_code', v_rule_set.country_code,
    'version_code', v_rule_set.version_code,
    'status', 'active',
    'approved_by', p_approver_id
  );
END;
$$;

-- B. CROSS-COUNTRY EMPLOYEE LOCALIZATION TRANSFER
CREATE OR REPLACE FUNCTION transfer_employee_country_pack_atomic(
  p_company_id UUID,
  p_employee_id UUID,
  p_new_country_code VARCHAR(2),
  p_effective_date DATE,
  p_reason TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack country_packs%ROWTYPE;
  v_rule_set statutory_rule_sets%ROWTYPE;
  v_new_history_id UUID;
BEGIN
  SELECT * INTO v_pack FROM country_packs WHERE country_code = p_new_country_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target country pack % is not registered', p_new_country_code;
  END IF;

  SELECT * INTO v_rule_set
  FROM statutory_rule_sets
  WHERE country_code = p_new_country_code
    AND status = 'active'
    AND effective_from <= p_effective_date
    AND (effective_to IS NULL OR effective_to >= p_effective_date)
  ORDER BY effective_from DESC
  LIMIT 1;

  -- Close open localization slice without mutating historical slices
  UPDATE employee_localization_history
  SET effective_to = (p_effective_date - INTERVAL '1 day')::DATE
  WHERE company_id = p_company_id
    AND employee_id = p_employee_id
    AND effective_to IS NULL
    AND effective_from < p_effective_date;

  INSERT INTO employee_localization_history (
    company_id, employee_id, country_code, currency_code,
    country_pack_version, effective_from, transfer_reason, created_by
  )
  VALUES (
    p_company_id, p_employee_id, p_new_country_code, v_pack.currency_code,
    COALESCE(v_rule_set.version_code, p_new_country_code || '-2024-V1'),
    p_effective_date, p_reason, p_user_id
  )
  RETURNING id INTO v_new_history_id;

  RETURN jsonb_build_object(
    'ok', true,
    'history_id', v_new_history_id,
    'employee_id', p_employee_id,
    'new_country_code', p_new_country_code,
    'currency_code', v_pack.currency_code,
    'country_pack_version', COALESCE(v_rule_set.version_code, p_new_country_code || '-2024-V1'),
    'effective_from', p_effective_date
  );
END;
$$;

-- C. WPS BATCH REGENERATION ENGINE (PRESERVING SUPERSEDED BATCH HISTORY)
CREATE OR REPLACE FUNCTION regenerate_wps_batch_atomic(
  p_company_id UUID,
  p_prior_batch_id UUID,
  p_reason TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior wps_batches%ROWTYPE;
  v_new_result JSONB;
  v_new_batch_id UUID;
BEGIN
  SELECT * INTO v_prior
  FROM wps_batches
  WHERE id = p_prior_batch_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prior WPS batch not found for company';
  END IF;

  -- Mark prior batch as superseded (preserving its records and audit trail)
  UPDATE wps_batches
  SET
    status = 'superseded',
    updated_at = clock_timestamp()
  WHERE id = p_prior_batch_id;

  -- Generate new batch from payroll run
  v_new_result := generate_wps_batch_atomic(
    p_company_id,
    v_prior.payroll_run_id,
    v_prior.country_code,
    v_prior.file_format,
    p_user_id
  );

  v_new_batch_id := (v_new_result->>'batch_id')::UUID;

  UPDATE wps_batches
  SET
    file_version = v_prior.file_version + 1,
    supersedes_batch_id = p_prior_batch_id,
    regeneration_reason = p_reason,
    updated_at = clock_timestamp()
  WHERE id = v_new_batch_id;

  RETURN v_new_result || jsonb_build_object(
    'file_version', v_prior.file_version + 1,
    'supersedes_batch_id', p_prior_batch_id,
    'prior_status', 'superseded',
    'regeneration_reason', p_reason
  );
END;
$$;
