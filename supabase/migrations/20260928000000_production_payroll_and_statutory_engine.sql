-- ============================================================================
-- PROMPT 15: PRODUCTION PAYROLL, SALARY STRUCTURE & STATUTORY ENGINE
-- Migration: 20260928000000_production_payroll_and_statutory_engine.sql
-- Description:
-- 1. Company Payroll Configuration (currency, timezone, cutoff, calculation basis, proration)
-- 2. Payroll Groups with company scoping and eligibility rules
-- 3. Canonical Salary Components Master (earnings, deductions, contributions, informational)
-- 4. Reusable Versioned Salary Structures (Executive, Management, Staff, Hourly)
-- 5. Effective-Dated Employee Compensation History & Approval
-- 6. Configurable Statutory Contribution Engine & Versioned Saudi GOSI Adapter
-- 7. Controlled Payroll Period & Payroll Run State Machine
-- 8. Server-Side Employee Population Snapshotting
-- 9. Authoritative Closed-Attendance Interlock & Input Snapshotting
-- 10. Article 107 Overtime, Unpaid Leave Proration, Joiner/Term Proration
-- 11. Safe Loan Installment Recovery at Lock/Payment (no premature balance mutation)
-- 12. Manual Payroll Adjustments with Reason & Actor Audit
-- 13. Component Breakdown & Explainable Calculation Trace in Postgres Numeric
-- 14. Payroll Exceptions Engine (Warning vs. Blocking)
-- 15. Clean Recalculation, Approval, Lock Immutability & Formal Reopen
-- 16. Separation of Calculation Status from Payment Status & Bank WPS Preparation
-- 17. Multi-Tenant RLS Security & Field-Level Salary Privacy
-- 18. Prompt 13.7 Strict Privilege Whitelist & Allowlist
-- ============================================================================

-- ============================================================================
-- STEP 1: COMPANY PAYROLL CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_payroll_configs (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'SAR',
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  pay_frequency text NOT NULL DEFAULT 'monthly' CHECK (pay_frequency IN ('monthly', 'bi_weekly', 'weekly')),
  payroll_cutoff_day integer NOT NULL DEFAULT 25 CHECK (payroll_cutoff_day BETWEEN 1 AND 31),
  payday integer NOT NULL DEFAULT 28 CHECK (payday BETWEEN 1 AND 31),
  calculation_basis text NOT NULL DEFAULT 'fixed_30_days' CHECK (calculation_basis IN ('fixed_30_days', 'calendar_days', 'working_days')),
  working_days_per_month integer NOT NULL DEFAULT 22 CHECK (working_days_per_month BETWEEN 15 AND 31),
  rounding_rule text NOT NULL DEFAULT 'round_2' CHECK (rounding_rule IN ('round_2', 'round_0', 'ceil_2', 'floor_2')),
  proration_policy text NOT NULL DEFAULT 'fixed_30' CHECK (proration_policy IN ('fixed_30', 'calendar_days', 'working_days')),
  overtime_treatment text NOT NULL DEFAULT 'statutory_article_107' CHECK (overtime_treatment IN ('statutory_article_107', 'basic_only', 'gross_based', 'fixed_multiplier')),
  overtime_custom_multiplier numeric(5,2) DEFAULT 1.5,
  unpaid_leave_treatment text NOT NULL DEFAULT 'fixed_30_basis' CHECK (unpaid_leave_treatment IN ('fixed_30_basis', 'calendar_day_basis', 'working_day_basis')),
  statutory_regime text NOT NULL DEFAULT 'saudi_gosi' CHECK (statutory_regime IN ('saudi_gosi', 'egypt_social_insurance', 'generic_statutory', 'none')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_payroll_configs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: ENHANCE PAYROLL GROUPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payroll_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  calculation_basis text DEFAULT 'fixed_30_days',
  cutoff_day integer DEFAULT 25,
  payday integer DEFAULT 28,
  currency text DEFAULT 'SAR',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payroll_groups
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  ADD COLUMN IF NOT EXISTS employee_eligibility_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure company_id is populated from employees where possible
UPDATE public.payroll_groups pg
SET company_id = (SELECT e.company_id FROM public.employees e WHERE e.payroll_group_id = pg.id LIMIT 1)
WHERE pg.company_id IS NULL;

-- Backfill company_id with first company if still null
UPDATE public.payroll_groups pg
SET company_id = (SELECT c.id FROM public.companies c ORDER BY c.created_at ASC LIMIT 1)
WHERE pg.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_groups_company
  ON public.payroll_groups(company_id, status);

-- ============================================================================
-- STEP 3: SALARY COMPONENTS MASTER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.salary_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  type text NOT NULL CHECK (type IN ('earning', 'deduction', 'employer_contribution', 'employee_contribution', 'informational')),
  calculation_method text NOT NULL DEFAULT 'fixed' CHECK (calculation_method IN ('fixed', 'percentage', 'formula')),
  formula_expression text,
  is_taxable boolean NOT NULL DEFAULT false,
  is_statutory_insurable boolean NOT NULL DEFAULT false,
  is_recurring boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  rounding text NOT NULL DEFAULT 'round_2',
  display_order integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_salary_components_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_salary_components_company
  ON public.salary_components(company_id, type, status);

-- ============================================================================
-- STEP 4: SALARY STRUCTURES & STRUCTURE COMPONENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.salary_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_salary_structures_company_code_version UNIQUE (company_id, code, version)
);

ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.salary_structure_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.salary_structures(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.salary_components(id) ON DELETE CASCADE,
  default_amount numeric(12,2) DEFAULT 0,
  percentage_of_basic numeric(6,2),
  is_mandatory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_structure_component UNIQUE (structure_id, component_id)
);

ALTER TABLE public.salary_structure_components ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: EFFECTIVE-DATED EMPLOYEE COMPENSATION VERSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employee_compensation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  salary_structure_id uuid REFERENCES public.salary_structures(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  effective_from date NOT NULL,
  effective_to date,
  basic_salary numeric(12,2) NOT NULL CHECK (basic_salary >= 0),
  housing_allowance numeric(12,2) NOT NULL DEFAULT 0 CHECK (housing_allowance >= 0),
  transport_allowance numeric(12,2) NOT NULL DEFAULT 0 CHECK (transport_allowance >= 0),
  other_allowances jsonb NOT NULL DEFAULT '[]'::jsonb,
  currency text NOT NULL DEFAULT 'SAR',
  bank_name text,
  iban text,
  payroll_group_id uuid REFERENCES public.payroll_groups(id) ON DELETE SET NULL,
  statutory_applicable boolean NOT NULL DEFAULT true,
  statutory_scheme text NOT NULL DEFAULT 'saudi_gosi' CHECK (statutory_scheme IN ('saudi_gosi', 'egypt_social_insurance', 'generic_statutory', 'none')),
  gosi_scheme_tier text NOT NULL DEFAULT 'legacy' CHECK (gosi_scheme_tier IN ('legacy', 'new_1445')),
  reason text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft', 'pending_approval', 'approved', 'superseded', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_compensation_versions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_emp_comp_lookup
  ON public.employee_compensation_versions(employee_id, effective_from, status);

CREATE INDEX IF NOT EXISTS idx_emp_comp_company
  ON public.employee_compensation_versions(company_id, status);

-- Migrate existing salary_profiles into compensation versions if not already migrated
DO $$
BEGIN
  IF to_regclass('public.salary_profiles') IS NOT NULL THEN
    EXECUTE '
      INSERT INTO public.employee_compensation_versions (
        employee_id, company_id, version, effective_from, effective_to,
        basic_salary, housing_allowance, transport_allowance, other_allowances,
        bank_name, iban, payroll_group_id, status
      )
      SELECT
        sp.employee_id,
        e.company_id,
        1,
        sp.effective_from,
        sp.effective_to,
        sp.basic_salary,
        sp.housing_allowance,
        sp.transport_allowance,
        sp.other_allowances,
        sp.bank_name,
        sp.iban,
        sp.payroll_group_id,
        ''approved''
      FROM public.salary_profiles sp
      JOIN public.employees e ON e.id = sp.employee_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.employee_compensation_versions ecv WHERE ecv.employee_id = sp.employee_id
      )
    ';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: STATUTORY RULES & SAUDI GOSI ADAPTER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.statutory_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_code text NOT NULL, -- e.g. SA, EG, QA, OM, BH
  name_ar text NOT NULL,
  name_en text NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.statutory_rule_sets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.statutory_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES public.statutory_rule_sets(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  wage_ceiling numeric(12,2) NOT NULL DEFAULT 45000.00,
  wage_floor numeric(12,2) NOT NULL DEFAULT 0.00,
  wage_basis text NOT NULL DEFAULT 'basic_plus_housing' CHECK (wage_basis IN ('basic_plus_housing', 'basic_only', 'gross_salary')),
  -- Saudi GOSI Parameters:
  national_pension_employee_rate numeric(6,4) NOT NULL DEFAULT 0.0900,
  national_pension_employer_rate numeric(6,4) NOT NULL DEFAULT 0.0900,
  saned_employee_rate numeric(6,4) NOT NULL DEFAULT 0.0075,
  saned_employer_rate numeric(6,4) NOT NULL DEFAULT 0.0075,
  hazards_employer_rate numeric(6,4) NOT NULL DEFAULT 0.0200,
  expat_hazards_rate numeric(6,4) NOT NULL DEFAULT 0.0200,
  -- Dynamic JSON rules for multi-jurisdiction extensions:
  rules_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_statutory_rule_version UNIQUE (rule_set_id, version)
);

ALTER TABLE public.statutory_rule_versions ENABLE ROW LEVEL SECURITY;

-- Seed Saudi GOSI canonical rule set and version
INSERT INTO public.statutory_rule_sets (id, jurisdiction_code, name_ar, name_en, currency)
VALUES ('00000000-0000-0000-0000-000000000091', 'SA', 'التأمينات الاجتماعية السعودية (GOSI)', 'Saudi Social Insurance (GOSI)', 'SAR')
ON CONFLICT DO NOTHING;

INSERT INTO public.statutory_rule_versions (
  id, rule_set_id, version, name_ar, name_en, effective_from, wage_ceiling, wage_basis,
  national_pension_employee_rate, national_pension_employer_rate,
  saned_employee_rate, saned_employer_rate, hazards_employer_rate, expat_hazards_rate
) VALUES (
  '00000000-0000-0000-0000-000000000092',
  '00000000-0000-0000-0000-000000000091',
  1,
  'نظام التأمينات الاجتماعية وساند المعياري 2026',
  'Standard GOSI & SANED 2026',
  '2024-01-01',
  45000.00,
  'basic_plus_housing',
  0.0900, 0.0900,
  0.0075, 0.0075,
  0.0200, 0.0200
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 7: ENHANCE PAYROLL RUNS & PERIODS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_year integer NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_period_company_month UNIQUE (company_id, period_year, period_month)
);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

-- Enhance payroll_runs table
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  payroll_group_id uuid REFERENCES public.payroll_groups(id) ON DELETE SET NULL,
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'SAR',
  total_employees integer NOT NULL DEFAULT 0,
  total_basic_salary numeric(14,2) NOT NULL DEFAULT 0,
  total_allowances numeric(14,2) NOT NULL DEFAULT 0,
  total_overtime_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_net_salary numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_gosi numeric(14,2) NOT NULL DEFAULT 0,
  locked_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_group_id, period_year, period_month)
);

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS statutory_rule_version_id uuid REFERENCES public.statutory_rule_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_snapshot_id uuid REFERENCES public.attendance_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calculation_basis text NOT NULL DEFAULT 'fixed_30_days',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_processed'
    CHECK (payment_status IN ('not_processed', 'payment_ready', 'file_generated', 'sent_to_bank', 'partially_paid', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reopened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_reason text,
  ADD COLUMN IF NOT EXISTS blocking_exceptions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warnings_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs FORCE ROW LEVEL SECURITY;

-- Update company_id on payroll_runs from payroll_groups where missing
UPDATE public.payroll_runs pr
SET company_id = pg.company_id
FROM public.payroll_groups pg
WHERE pr.payroll_group_id = pg.id AND pr.company_id IS NULL;

-- Backfill company_id with first company if still null
UPDATE public.payroll_runs pr
SET company_id = (SELECT c.id FROM public.companies c ORDER BY c.created_at ASC LIMIT 1)
WHERE pr.company_id IS NULL;

-- ============================================================================
-- STEP 8: EMPLOYEE RUN SNAPSHOTS & COMPONENT-LEVEL LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payroll_run_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  compensation_version_id uuid REFERENCES public.employee_compensation_versions(id) ON DELETE SET NULL,
  employee_no text NOT NULL,
  employee_name_ar text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  department_name_ar text,
  subsidiary_id uuid REFERENCES public.subsidiaries(id) ON DELETE SET NULL,
  work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  nationality text NOT NULL DEFAULT 'Saudi',
  is_saudi boolean NOT NULL DEFAULT true,
  bank_name text,
  iban text,
  hire_date date,
  termination_date date,
  eligible_days integer NOT NULL DEFAULT 30,
  days_in_period integer NOT NULL DEFAULT 30,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
  transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
  other_allowances numeric(12,2) NOT NULL DEFAULT 0,
  overtime_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_amount numeric(12,2) NOT NULL DEFAULT 0,
  bonus_amount numeric(12,2) NOT NULL DEFAULT 0,
  unpaid_leave_days integer NOT NULL DEFAULT 0,
  unpaid_leave_deduction numeric(12,2) NOT NULL DEFAULT 0,
  absence_days integer NOT NULL DEFAULT 0,
  absence_deduction numeric(12,2) NOT NULL DEFAULT 0,
  loan_installment numeric(12,2) NOT NULL DEFAULT 0,
  statutory_employee numeric(12,2) NOT NULL DEFAULT 0,
  statutory_employer numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  has_blocking_exception boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'calculated' CHECK (status IN ('calculated', 'under_review', 'approved', 'locked', 'excluded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_run_employee UNIQUE (payroll_run_id, employee_id)
);

ALTER TABLE public.payroll_run_employees ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_run_emp_lookup
  ON public.payroll_run_employees(payroll_run_id, employee_id, status);

CREATE INDEX IF NOT EXISTS idx_run_emp_dept
  ON public.payroll_run_employees(payroll_run_id, department_id);

-- Component-level explainable breakdown lines
CREATE TABLE IF NOT EXISTS public.payroll_run_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  run_employee_id uuid NOT NULL REFERENCES public.payroll_run_employees(id) ON DELETE CASCADE,
  component_id uuid REFERENCES public.salary_components(id) ON DELETE SET NULL,
  component_code text NOT NULL,
  component_name_ar text NOT NULL,
  component_type text NOT NULL CHECK (component_type IN ('earning', 'deduction', 'employer_contribution', 'employee_contribution', 'informational')),
  quantity numeric(10,2) NOT NULL DEFAULT 1.0,
  rate numeric(12,4) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  is_statutory_insurable boolean NOT NULL DEFAULT false,
  calculation_trace text NOT NULL DEFAULT '',
  source_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_run_lines ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_run_lines_emp
  ON public.payroll_run_lines(run_employee_id, component_type);

-- ============================================================================
-- STEP 9: MANUAL PAYROLL ADJUSTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  component_id uuid REFERENCES public.salary_components(id) ON DELETE SET NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('earning', 'deduction', 'bonus', 'commission', 'correction', 'retroactive')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_run
  ON public.payroll_adjustments(payroll_run_id, employee_id);

-- Safe Loan Allocations
CREATE TABLE IF NOT EXISTS public.payroll_loan_allocations (
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  recovered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (payroll_run_id, loan_id)
);

ALTER TABLE public.payroll_loan_allocations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 10: PAYROLL EXCEPTIONS ENGINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payroll_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  code text NOT NULL,
  title_ar text NOT NULL,
  message_ar text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning', 'blocking')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_exceptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payroll_exceptions_run
  ON public.payroll_exceptions(payroll_run_id, severity, is_resolved);

-- ============================================================================
-- STEP 11: PAYMENT BATCHES & AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payroll_payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  bank_account_id uuid REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL,
  total_count integer NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  wps_file_name text,
  wps_file_content text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'file_generated', 'submitted', 'reconciled', 'failed')),
  bank_reference text,
  disbursed_at timestamptz,
  disbursed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_payment_batches ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.payroll_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_role text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payroll_audit_run
  ON public.payroll_audit_logs(payroll_run_id, created_at DESC);

-- ============================================================================
-- STEP 12: CORE AUTHORITATIVE PAYROLL RPCS
-- ============================================================================

-- 12.1 Initialize or Seed Company Payroll Configuration
CREATE OR REPLACE FUNCTION public.init_company_payroll_config(
  p_company_id uuid,
  p_config jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة إعدادات الرواتب (42501)';
  END IF;

  INSERT INTO public.company_payroll_configs (
    company_id,
    currency,
    timezone,
    pay_frequency,
    payroll_cutoff_day,
    payday,
    calculation_basis,
    working_days_per_month,
    rounding_rule,
    proration_policy,
    overtime_treatment,
    unpaid_leave_treatment,
    statutory_regime
  ) VALUES (
    p_company_id,
    COALESCE(p_config->>'currency', 'SAR'),
    COALESCE(p_config->>'timezone', 'Asia/Riyadh'),
    COALESCE(p_config->>'pay_frequency', 'monthly'),
    COALESCE((p_config->>'payroll_cutoff_day')::integer, 25),
    COALESCE((p_config->>'payday')::integer, 28),
    COALESCE(p_config->>'calculation_basis', 'fixed_30_days'),
    COALESCE((p_config->>'working_days_per_month')::integer, 22),
    COALESCE(p_config->>'rounding_rule', 'round_2'),
    COALESCE(p_config->>'proration_policy', 'fixed_30'),
    COALESCE(p_config->>'overtime_treatment', 'statutory_article_107'),
    COALESCE(p_config->>'unpaid_leave_treatment', 'fixed_30_basis'),
    COALESCE(p_config->>'statutory_regime', 'saudi_gosi')
  )
  ON CONFLICT (company_id) DO UPDATE SET
    currency = EXCLUDED.currency,
    timezone = EXCLUDED.timezone,
    pay_frequency = EXCLUDED.pay_frequency,
    payroll_cutoff_day = EXCLUDED.payroll_cutoff_day,
    payday = EXCLUDED.payday,
    calculation_basis = EXCLUDED.calculation_basis,
    working_days_per_month = EXCLUDED.working_days_per_month,
    rounding_rule = EXCLUDED.rounding_rule,
    proration_policy = EXCLUDED.proration_policy,
    overtime_treatment = EXCLUDED.overtime_treatment,
    unpaid_leave_treatment = EXCLUDED.unpaid_leave_treatment,
    statutory_regime = EXCLUDED.statutory_regime,
    updated_at = now();

  -- Seed Default Canonical Salary Components for Company if missing
  INSERT INTO public.salary_components (company_id, code, name_ar, name_en, type, calculation_method, is_statutory_insurable, display_order)
  VALUES
    (p_company_id, 'BASIC', 'الراتب الأساسي', 'Basic Salary', 'earning', 'fixed', true, 10),
    (p_company_id, 'HOUSING', 'بدل السكن', 'Housing Allowance', 'earning', 'fixed', true, 20),
    (p_company_id, 'TRANSPORT', 'بدل النقل', 'Transport Allowance', 'earning', 'fixed', false, 30),
    (p_company_id, 'OVERTIME', 'أجر العمل الإضافي', 'Overtime Pay', 'earning', 'formula', false, 40),
    (p_company_id, 'BONUS', 'مكافآت وحوافز', 'Bonus & Commission', 'earning', 'fixed', false, 50),
    (p_company_id, 'ABSENCE', 'خصم الغياب والتأخير', 'Absence & Lateness', 'deduction', 'formula', false, 60),
    (p_company_id, 'UNPAID_LEAVE', 'خصم الإجازة غير مدفوعة الأجر', 'Unpaid Leave Deduction', 'deduction', 'formula', false, 70),
    (p_company_id, 'LOAN', 'قسط سلفة / قرض شخصي', 'Loan Installment', 'deduction', 'fixed', false, 80),
    (p_company_id, 'GOSI_EMPLOYEE', 'حصة الموظف في التأمينات (GOSI)', 'GOSI Employee Contribution', 'employee_contribution', 'formula', true, 90),
    (p_company_id, 'GOSI_EMPLOYER', 'حصة صاحب العمل في التأمينات (GOSI)', 'GOSI Employer Contribution', 'employer_contribution', 'formula', true, 100)
  ON CONFLICT (company_id, code) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'company_id', p_company_id);
END;
$$;

-- 12.2 Create or Register a Compensation Package for an Employee (Versioned)
CREATE OR REPLACE FUNCTION public.set_employee_compensation_atomic(
  p_employee_id uuid,
  p_compensation jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_emp public.employees%ROWTYPE;
  v_next_version integer;
  v_effective_from date := (p_compensation->>'effective_from')::date;
  v_basic numeric(12,2) := (p_compensation->>'basic_salary')::numeric;
  v_housing numeric(12,2) := COALESCE((p_compensation->>'housing_allowance')::numeric, 0);
  v_transport numeric(12,2) := COALESCE((p_compensation->>'transport_allowance')::numeric, 0);
  v_other jsonb := COALESCE(p_compensation->'other_allowances', '[]'::jsonb);
  v_comp_id uuid;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل حزمة الراتب والبدلات للموظف (42501)';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود';
  END IF;

  IF v_effective_from IS NULL THEN
    RAISE EXCEPTION 'تاريخ سريان الراتب إلزامي';
  END IF;

  IF v_basic IS NULL OR v_basic < 0 THEN
    RAISE EXCEPTION 'الراتب الأساسي غير صالح أو سالب';
  END IF;

  -- Close previous approved compensation package
  UPDATE public.employee_compensation_versions
  SET effective_to = v_effective_from - 1,
      status = 'superseded',
      updated_at = now()
  WHERE employee_id = p_employee_id
    AND status = 'approved'
    AND effective_to IS NULL;

  -- Determine next version
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.employee_compensation_versions
  WHERE employee_id = p_employee_id;

  INSERT INTO public.employee_compensation_versions (
    employee_id,
    company_id,
    salary_structure_id,
    version,
    effective_from,
    effective_to,
    basic_salary,
    housing_allowance,
    transport_allowance,
    other_allowances,
    currency,
    bank_name,
    iban,
    payroll_group_id,
    statutory_applicable,
    statutory_scheme,
    reason,
    approved_by,
    approved_at,
    created_by,
    status
  ) VALUES (
    p_employee_id,
    v_emp.company_id,
    (p_compensation->>'salary_structure_id')::uuid,
    v_next_version,
    v_effective_from,
    NULL,
    v_basic,
    v_housing,
    v_transport,
    v_other,
    COALESCE(p_compensation->>'currency', 'SAR'),
    COALESCE(p_compensation->>'bank_name', v_emp.bank_name),
    COALESCE(p_compensation->>'iban', v_emp.iban),
    COALESCE((p_compensation->>'payroll_group_id')::uuid, v_emp.payroll_group_id),
    COALESCE((p_compensation->>'statutory_applicable')::boolean, true),
    COALESCE(p_compensation->>'statutory_scheme', 'saudi_gosi'),
    COALESCE(p_compensation->>'reason', 'تحديث حزمة الراتب'),
    v_caller_uid,
    now(),
    v_caller_uid,
    'approved'
  ) RETURNING id INTO v_comp_id;

  -- Update employee master caches truthfully
  UPDATE public.employees
  SET basic_salary = v_basic,
      housing_allowance = v_housing,
      transport_allowance = v_transport,
      total_salary = v_basic + v_housing + v_transport,
      bank_name = COALESCE(p_compensation->>'bank_name', bank_name),
      iban = COALESCE(p_compensation->>'iban', iban),
      payroll_group_id = COALESCE((p_compensation->>'payroll_group_id')::uuid, payroll_group_id),
      updated_at = now()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object(
    'ok', true,
    'compensation_version_id', v_comp_id,
    'version', v_next_version,
    'employee_id', p_employee_id
  );
END;
$$;

-- 12.3 Create a Production Payroll Run
CREATE OR REPLACE FUNCTION public.create_payroll_run_atomic(
  p_company_id uuid,
  p_payroll_group_id uuid,
  p_year integer,
  p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_group public.payroll_groups%ROWTYPE;
  v_config public.company_payroll_configs%ROWTYPE;
  v_period public.payroll_periods%ROWTYPE;
  v_existing public.payroll_runs%ROWTYPE;
  v_run_id uuid;
  v_period_start date;
  v_period_end date;
  v_days_in_month integer;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بإنشاء مسيّر الرواتب (42501)';
  END IF;

  IF p_year < 2000 OR p_year > 2100 OR p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'فترة الرواتب المحددة غير صالحة (%-%)', p_year, p_month;
  END IF;

  -- Check company configuration exists
  SELECT * INTO v_config FROM public.company_payroll_configs WHERE company_id = p_company_id;
  IF v_config.company_id IS NULL THEN
    -- Try initializing defaults
    PERFORM public.init_company_payroll_config(p_company_id);
    SELECT * INTO v_config FROM public.company_payroll_configs WHERE company_id = p_company_id;
  END IF;

  -- Check group exists and belongs to company
  SELECT * INTO v_group FROM public.payroll_groups WHERE id = p_payroll_group_id AND company_id = p_company_id;
  IF v_group.id IS NULL THEN
    RAISE EXCEPTION 'مجموعة الرواتب المحددة غير موجودة أو لا تتبع لهذه المنشأة';
  END IF;

  -- Calculate period dates
  v_period_start := make_date(p_year, p_month, 1);
  v_days_in_month := EXTRACT(DAY FROM (v_period_start + interval '1 month' - interval '1 day'))::integer;
  v_period_end := make_date(p_year, p_month, v_days_in_month);

  -- Get or Create Payroll Period
  INSERT INTO public.payroll_periods (company_id, period_year, period_month, start_date, end_date)
  VALUES (p_company_id, p_year, p_month, v_period_start, v_period_end)
  ON CONFLICT (company_id, period_year, period_month) DO UPDATE SET updated_at = now()
  RETURNING * INTO v_period;

  -- Advisory lock on company/year/month
  PERFORM pg_advisory_xact_lock(hashtextextended('payroll_run:' || p_company_id || ':' || p_year || ':' || p_month, 0));

  SELECT * INTO v_existing FROM public.payroll_runs
  WHERE period_year = p_year AND period_month = p_month
    AND payroll_group_id = p_payroll_group_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.status IN ('locked', 'paid') THEN
      RAISE EXCEPTION 'مسيّر الرواتب لهذا الشهر مقفل بالفعل ولا يمكن إعادة إنشائه';
    END IF;
    RETURN jsonb_build_object('ok', true, 'payroll_run_id', v_existing.id, 'status', v_existing.status, 'already_exists', true);
  END IF;

  INSERT INTO public.payroll_runs (
    company_id,
    payroll_group_id,
    period_id,
    period_year,
    period_month,
    calculation_basis,
    status,
    payment_status,
    currency
  ) VALUES (
    p_company_id,
    p_payroll_group_id,
    v_period.id,
    p_year,
    p_month,
    v_config.calculation_basis,
    'draft',
    'not_processed',
    v_config.currency
  ) RETURNING id INTO v_run_id;

  INSERT INTO public.payroll_audit_logs (company_id, payroll_run_id, action, actor_id, details)
  VALUES (p_company_id, v_run_id, 'created', v_caller_uid, jsonb_build_object('year', p_year, 'month', p_month, 'group', v_group.name_ar));

  RETURN jsonb_build_object('ok', true, 'payroll_run_id', v_run_id, 'status', 'draft', 'already_exists', false);
END;
$$;

-- 12.4 Authoritative Calculation Engine
CREATE OR REPLACE FUNCTION public.calculate_payroll_run_atomic(
  p_payroll_run_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_run public.payroll_runs%ROWTYPE;
  v_config public.company_payroll_configs%ROWTYPE;
  v_statutory_rule public.statutory_rule_versions%ROWTYPE;
  v_att_period public.attendance_periods%ROWTYPE;
  v_att_snapshot public.attendance_payroll_snapshots%ROWTYPE;
  v_emp record;
  v_comp public.employee_compensation_versions%ROWTYPE;
  v_period_start date;
  v_period_end date;
  v_days_in_month integer;
  v_divisor numeric(5,2);
  v_daily_rate numeric(12,4);
  v_hourly_rate numeric(12,4);
  v_eligible_days integer;
  v_joiner_proration numeric(12,2) := 0;
  v_term_proration numeric(12,2) := 0;
  
  -- Line amounts
  v_basic numeric(12,2);
  v_housing numeric(12,2);
  v_transport numeric(12,2);
  v_other numeric(12,2);
  v_overtime_hours numeric(8,2);
  v_overtime_amount numeric(12,2);
  v_unpaid_days integer;
  v_unpaid_deduction numeric(12,2);
  v_absence_days integer;
  v_absence_deduction numeric(12,2);
  v_loan_installment numeric(12,2);
  v_statutory_subject numeric(12,2);
  v_statutory_emp numeric(12,2);
  v_statutory_empr numeric(12,2);
  v_adj_earnings numeric(12,2);
  v_adj_deductions numeric(12,2);
  v_gross numeric(12,2);
  v_total_deductions numeric(12,2);
  v_net numeric(12,2);

  v_run_emp_id uuid;
  v_has_blocking boolean;
  v_total_emp_count integer := 0;
  v_total_basic numeric(14,2) := 0;
  v_total_allowances numeric(14,2) := 0;
  v_total_overtime numeric(14,2) := 0;
  v_total_deductions_all numeric(14,2) := 0;
  v_total_net numeric(14,2) := 0;
  v_total_gosi_employer numeric(14,2) := 0;
  v_blocking_count integer := 0;
  v_warnings_count integer := 0;

  v_calc_trace text;
  v_basic_comp_id uuid;
  v_housing_comp_id uuid;
  v_transport_comp_id uuid;
  v_overtime_comp_id uuid;
  v_unpaid_comp_id uuid;
  v_absence_comp_id uuid;
  v_loan_comp_id uuid;
  v_gosi_emp_comp_id uuid;
  v_gosi_empr_comp_id uuid;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك باحتساب مسيّر الرواتب (42501)';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  IF public.current_company_id() IS NOT NULL AND v_run.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة مسيّر رواتب يتبع لمنشأة أخرى (42501)';
  END IF;

  IF v_run.status IN ('locked', 'paid') THEN
    RAISE EXCEPTION 'مسيّر الرواتب مقفل أو مدفوع بالفعل؛ لا يمكن إعادة الاحتساب دون فتح رسمي';
  END IF;

  SELECT * INTO v_config FROM public.company_payroll_configs WHERE company_id = v_run.company_id;
  IF v_config.company_id IS NULL THEN
    PERFORM public.init_company_payroll_config(v_run.company_id);
    SELECT * INTO v_config FROM public.company_payroll_configs WHERE company_id = v_run.company_id;
  END IF;

  -- Load latest active statutory rule version
  SELECT srv.* INTO v_statutory_rule
  FROM public.statutory_rule_versions srv
  JOIN public.statutory_rule_sets srs ON srs.id = srv.rule_set_id
  WHERE srv.is_active = true
  ORDER BY srv.version DESC
  LIMIT 1;

  -- Dates calculation
  v_period_start := make_date(v_run.period_year, v_run.period_month, 1);
  v_days_in_month := EXTRACT(DAY FROM (v_period_start + interval '1 month' - interval '1 day'))::integer;
  v_period_end := make_date(v_run.period_year, v_run.period_month, v_days_in_month);

  IF v_config.calculation_basis = 'fixed_30_days' THEN
    v_divisor := 30.0;
  ELSIF v_config.calculation_basis = 'working_days' THEN
    v_divisor := v_config.working_days_per_month::numeric;
  ELSE
    v_divisor := v_days_in_month::numeric;
  END IF;

  -- Check authoritative Attendance Close Interlock (Item 13, 14)
  SELECT * INTO v_att_period
  FROM public.attendance_periods
  WHERE company_id = v_run.company_id
    AND period_year = v_run.period_year
    AND period_month = v_run.period_month;

  -- Cache standard salary components
  SELECT id INTO v_basic_comp_id FROM public.salary_components WHERE company_id = v_run.company_id AND code = 'BASIC' LIMIT 1;
  SELECT id INTO v_housing_comp_id FROM public.salary_components WHERE company_id = v_run.company_id AND code = 'HOUSING' LIMIT 1;
  SELECT id INTO v_transport_comp_id FROM public.salary_components WHERE company_id = v_run.company_id AND code = 'TRANSPORT' LIMIT 1;
  SELECT id INTO v_overtime_comp_id FROM public.salary_components WHERE company_id = v_run.company_id AND code = 'OVERTIME' LIMIT 1;
  SELECT id INTO v_unpaid_comp_id FROM public.salary_components WHERE company_id = v_run.company_id AND code = 'UNPAID_LEAVE' LIMIT 1;
  SELECT id INTO v_absence_comp_id FROM public.salary_components WHERE company_id = v_run.company_id AND code = 'ABSENCE' LIMIT 1;
  SELECT id INTO v_loan_comp_id FROM public.salary_components WHERE company_id = v_run.company_id AND code = 'LOAN' LIMIT 1;
  SELECT id INTO v_gosi_emp_comp_id FROM public.salary_components WHERE company_id = v_run.company_id AND code = 'GOSI_EMPLOYEE' LIMIT 1;
  SELECT id INTO v_gosi_empr_comp_id FROM public.salary_components WHERE company_id = v_run.company_id AND code = 'GOSI_EMPLOYER' LIMIT 1;

  -- Clean previous calculation records for this run (Idempotency)
  DELETE FROM public.payroll_exceptions WHERE payroll_run_id = p_payroll_run_id;
  DELETE FROM public.payroll_run_lines WHERE payroll_run_id = p_payroll_run_id;
  DELETE FROM public.payroll_run_employees WHERE payroll_run_id = p_payroll_run_id;

  -- Iterate through eligible employees
  FOR v_emp IN
    SELECT
      e.id,
      e.employee_no,
      COALESCE(e.first_name_ar || ' ' || e.last_name_ar, e.full_name) as full_name_ar,
      e.department_id,
      d.name_ar as dept_name_ar,
      e.subsidiary_id,
      e.work_location_id,
      e.nationality,
      e.is_saudi,
      e.hire_date,
      e.termination_date,
      e.bank_name,
      e.iban,
      e.status as emp_status
    FROM public.employees e
    LEFT JOIN public.departments d ON d.id = e.department_id
    WHERE e.company_id = v_run.company_id
      AND (e.payroll_group_id IS NULL OR e.payroll_group_id = v_run.payroll_group_id)
      AND e.hire_date <= v_period_end
      AND (e.termination_date IS NULL OR e.termination_date >= v_period_start)
      AND e.status NOT IN ('draft', 'preboarding', 'terminated')
    ORDER BY e.employee_no ASC
  LOOP
    v_has_blocking := false;

    -- 1. Fetch effective compensation package
    SELECT * INTO v_comp
    FROM public.employee_compensation_versions
    WHERE employee_id = v_emp.id
      AND status = 'approved'
      AND effective_from <= v_period_end
      AND (effective_to IS NULL OR effective_to >= v_period_start)
    ORDER BY effective_from DESC, version DESC
    LIMIT 1;

    -- Exception: Missing Compensation
    IF v_comp.id IS NULL THEN
      INSERT INTO public.payroll_exceptions (payroll_run_id, employee_id, code, title_ar, message_ar, severity)
      VALUES (p_payroll_run_id, v_emp.id, 'MISSING_COMPENSATION', 'غياب حزمة الراتب', 'لا توجد حزمة راتب معتمدة وسارية للموظف في هذه الفترة', 'blocking');
      v_has_blocking := true;
      v_blocking_count := v_blocking_count + 1;
      v_basic := 0;
      v_housing := 0;
      v_transport := 0;
    ELSE
      v_basic := v_comp.basic_salary;
      v_housing := v_comp.housing_allowance;
      v_transport := v_comp.transport_allowance;
    END IF;

    -- Exception: Missing Bank Account (Warning)
    IF COALESCE(v_comp.iban, v_emp.iban) IS NULL OR LENGTH(TRIM(COALESCE(v_comp.iban, v_emp.iban))) < 15 THEN
      INSERT INTO public.payroll_exceptions (payroll_run_id, employee_id, code, title_ar, message_ar, severity)
      VALUES (p_payroll_run_id, v_emp.id, 'MISSING_IBAN', 'بيانات الحساب البنكي غير مكتملة', 'لا يوجد رقم آيبان صالح مسجل للموظف', 'warning');
      v_warnings_count := v_warnings_count + 1;
    END IF;

    -- 2. Daily & Hourly rates calculation
    v_daily_rate := round((v_basic + v_housing + v_transport) / v_divisor, 4);
    v_hourly_rate := round((v_basic + v_housing + v_transport) / 240.0, 4);

    -- 3. Proration Calculation (Joiner / Term)
    v_eligible_days := v_days_in_month;
    IF v_emp.hire_date > v_period_start THEN
      v_eligible_days := v_days_in_month - EXTRACT(DAY FROM v_emp.hire_date)::integer + 1;
    END IF;
    IF v_emp.termination_date IS NOT NULL AND v_emp.termination_date < v_period_end THEN
      v_eligible_days := LEAST(v_eligible_days, EXTRACT(DAY FROM v_emp.termination_date)::integer);
    END IF;

    IF v_eligible_days < v_days_in_month THEN
      -- Prorate Basic and Allowances
      v_basic := round(v_basic * (v_eligible_days::numeric / v_divisor), 2);
      v_housing := round(v_housing * (v_eligible_days::numeric / v_divisor), 2);
      v_transport := round(v_transport * (v_eligible_days::numeric / v_divisor), 2);
    END IF;

    -- 4. Attendance Snapshot Consumption (Overtime & Unpaid Leave)
    v_overtime_hours := 0;
    v_overtime_amount := 0;
    v_unpaid_days := 0;
    v_unpaid_deduction := 0;
    v_absence_days := 0;
    v_absence_deduction := 0;

    IF v_att_period.id IS NOT NULL AND v_att_period.status = 'closed' THEN
      SELECT * INTO v_att_snapshot
      FROM public.attendance_payroll_snapshots
      WHERE period_id = v_att_period.id AND employee_id = v_emp.id;

      IF v_att_snapshot.id IS NOT NULL THEN
        v_overtime_hours := v_att_snapshot.regular_overtime_hours + v_att_snapshot.holiday_overtime_hours;
        v_absence_days := v_att_snapshot.total_absent_days;
        v_unpaid_days := v_att_snapshot.unexcused_absence_days;
      END IF;
    ELSE
      -- If attendance period is not closed, record a warning or blocking exception
      INSERT INTO public.payroll_exceptions (payroll_run_id, employee_id, code, title_ar, message_ar, severity)
      VALUES (p_payroll_run_id, v_emp.id, 'ATTENDANCE_NOT_CLOSED', 'فترة الحضور غير مقفلة', 'لم يتم إقفال واعتماد فترة الحضور والانصراف المطابقة', 'warning');
      v_warnings_count := v_warnings_count + 1;
    END IF;

    -- Overtime Calculation Article 107: actual hourly wage + 50% of basic hourly wage
    IF v_overtime_hours > 0 THEN
      IF v_config.overtime_treatment = 'statutory_article_107' THEN
        v_overtime_amount := round(((v_hourly_rate + round((v_basic / 240.0) * 0.5, 4)) * v_overtime_hours), 2);
      ELSE
        v_overtime_amount := round(v_hourly_rate * v_config.overtime_custom_multiplier * v_overtime_hours, 2);
      END IF;
    END IF;

    -- Unpaid & Absence Deductions
    IF v_unpaid_days > 0 THEN
      v_unpaid_deduction := round(v_daily_rate * v_unpaid_days, 2);
    END IF;
    IF v_absence_days > 0 THEN
      v_absence_deduction := round(v_daily_rate * v_absence_days, 2);
    END IF;

    -- 5. Loan Installment Consumption (Item 19 Safe recovery)
    v_loan_installment := 0;
    SELECT COALESCE(SUM(round(least(l.monthly_installment, l.remaining_balance), 2)), 0)
    INTO v_loan_installment
    FROM public.loans l
    WHERE l.employee_id = v_emp.id
      AND l.status = 'active'
      AND l.remaining_balance > 0;

    -- 6. Manual Adjustments Aggregation
    v_adj_earnings := 0;
    v_adj_deductions := 0;
    SELECT
      COALESCE(SUM(CASE WHEN adjustment_type IN ('earning', 'bonus', 'commission') THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN adjustment_type IN ('deduction', 'correction') THEN amount ELSE 0 END), 0)
    INTO v_adj_earnings, v_adj_deductions
    FROM public.payroll_adjustments
    WHERE payroll_run_id = p_payroll_run_id AND employee_id = v_emp.id AND status = 'approved';

    -- 7. Statutory Contributions Calculation (Saudi GOSI Adapter)
    v_statutory_emp := 0;
    v_statutory_empr := 0;
    IF COALESCE(v_comp.statutory_applicable, true) AND v_statutory_rule.id IS NOT NULL THEN
      -- Insurable wage = Basic + Housing capped at wage_ceiling
      v_statutory_subject := LEAST(v_basic + v_housing, v_statutory_rule.wage_ceiling);

      IF COALESCE(v_emp.is_saudi, false) OR v_emp.nationality IN ('Saudi', 'SA', 'سعودي') THEN
        -- Saudi: Pension + SANED
        v_statutory_emp := round(v_statutory_subject * (v_statutory_rule.national_pension_employee_rate + v_statutory_rule.saned_employee_rate), 2);
        v_statutory_empr := round(v_statutory_subject * (v_statutory_rule.national_pension_employer_rate + v_statutory_rule.saned_employer_rate + v_statutory_rule.hazards_employer_rate), 2);
      ELSE
        -- Non-Saudi: Hazards only borne by employer
        v_statutory_emp := 0;
        v_statutory_empr := round(v_statutory_subject * v_statutory_rule.expat_hazards_rate, 2);
      END IF;
    END IF;

    -- 8. Totals Calculation
    v_gross := round(v_basic + v_housing + v_transport + v_overtime_amount + v_adj_earnings, 2);
    v_total_deductions := round(v_unpaid_deduction + v_absence_deduction + v_loan_installment + v_statutory_emp + v_adj_deductions, 2);
    v_net := v_gross - v_total_deductions;

    -- Exception: Negative Net Salary (Blocking)
    IF v_net < 0 THEN
      INSERT INTO public.payroll_exceptions (payroll_run_id, employee_id, code, title_ar, message_ar, severity, details)
      VALUES (
        p_payroll_run_id, v_emp.id, 'NEGATIVE_NET_SALARY', 'صافي الراتب سالب',
        'مجموع الاستقطاعات يتجاوز إجمالي المستحقات (' || v_net || ' ' || v_config.currency || ')',
        'blocking',
        jsonb_build_object('gross', v_gross, 'deductions', v_total_deductions, 'net', v_net)
      );
      v_has_blocking := true;
      v_blocking_count := v_blocking_count + 1;
    END IF;

    -- Insert Snapshot Row into payroll_run_employees
    INSERT INTO public.payroll_run_employees (
      payroll_run_id,
      employee_id,
      company_id,
      compensation_version_id,
      employee_no,
      employee_name_ar,
      department_id,
      department_name_ar,
      subsidiary_id,
      work_location_id,
      nationality,
      is_saudi,
      bank_name,
      iban,
      hire_date,
      termination_date,
      eligible_days,
      days_in_period,
      basic_salary,
      housing_allowance,
      transport_allowance,
      overtime_hours,
      overtime_amount,
      bonus_amount,
      unpaid_leave_days,
      unpaid_leave_deduction,
      absence_days,
      absence_deduction,
      loan_installment,
      statutory_employee,
      statutory_employer,
      other_deductions,
      gross_salary,
      total_deductions,
      net_salary,
      has_blocking_exception,
      status
    ) VALUES (
      p_payroll_run_id,
      v_emp.id,
      v_run.company_id,
      v_comp.id,
      v_emp.employee_no,
      v_emp.full_name_ar,
      v_emp.department_id,
      v_emp.dept_name_ar,
      v_emp.subsidiary_id,
      v_emp.work_location_id,
      v_emp.nationality,
      COALESCE(v_emp.is_saudi, false),
      COALESCE(v_comp.bank_name, v_emp.bank_name),
      COALESCE(v_comp.iban, v_emp.iban),
      v_emp.hire_date,
      v_emp.termination_date,
      v_eligible_days,
      v_days_in_month,
      v_basic,
      v_housing,
      v_transport,
      v_overtime_hours,
      v_overtime_amount,
      v_adj_earnings,
      v_unpaid_days,
      v_unpaid_deduction,
      v_absence_days,
      v_absence_deduction,
      v_loan_installment,
      v_statutory_emp,
      v_statutory_empr,
      v_adj_deductions,
      v_gross,
      v_total_deductions,
      v_net,
      v_has_blocking,
      'calculated'
    ) RETURNING id INTO v_run_emp_id;

    -- Record Explainable Component Breakdown Lines
    IF v_basic > 0 THEN
      INSERT INTO public.payroll_run_lines (payroll_run_id, run_employee_id, component_id, component_code, component_name_ar, component_type, quantity, rate, amount, is_statutory_insurable, calculation_trace)
      VALUES (p_payroll_run_id, v_run_emp_id, v_basic_comp_id, 'BASIC', 'الراتب الأساسي', 'earning', v_eligible_days, v_daily_rate, v_basic, true, 'حزمة الراتب المعتمدة v' || COALESCE(v_comp.version::text, '1'));
    END IF;

    IF v_housing > 0 THEN
      INSERT INTO public.payroll_run_lines (payroll_run_id, run_employee_id, component_id, component_code, component_name_ar, component_type, quantity, rate, amount, is_statutory_insurable, calculation_trace)
      VALUES (p_payroll_run_id, v_run_emp_id, v_housing_comp_id, 'HOUSING', 'بدل السكن', 'earning', 1, v_housing, v_housing, true, 'بدل سكن شهري معتمد');
    END IF;

    IF v_transport > 0 THEN
      INSERT INTO public.payroll_run_lines (payroll_run_id, run_employee_id, component_id, component_code, component_name_ar, component_type, quantity, rate, amount, is_statutory_insurable, calculation_trace)
      VALUES (p_payroll_run_id, v_run_emp_id, v_transport_comp_id, 'TRANSPORT', 'بدل النقل', 'earning', 1, v_transport, v_transport, false, 'بدل نقل شهري معتمد');
    END IF;

    IF v_overtime_amount > 0 THEN
      INSERT INTO public.payroll_run_lines (payroll_run_id, run_employee_id, component_id, component_code, component_name_ar, component_type, quantity, rate, amount, is_statutory_insurable, calculation_trace)
      VALUES (p_payroll_run_id, v_run_emp_id, v_overtime_comp_id, 'OVERTIME', 'أجر ساعات إضافية', 'earning', v_overtime_hours, v_hourly_rate, v_overtime_amount, false, 'المادة 107 من نظام العمل: أجر الساعة + 50% من الأساسي');
    END IF;

    IF v_unpaid_deduction > 0 THEN
      INSERT INTO public.payroll_run_lines (payroll_run_id, run_employee_id, component_id, component_code, component_name_ar, component_type, quantity, rate, amount, is_statutory_insurable, calculation_trace)
      VALUES (p_payroll_run_id, v_run_emp_id, v_unpaid_comp_id, 'UNPAID_LEAVE', 'خصم إجازة بدون أجر', 'deduction', v_unpaid_days, v_daily_rate, v_unpaid_deduction, false, 'خصم أيام إجازة غير مدفوعة وفق سجلات الإجازات');
    END IF;

    IF v_absence_deduction > 0 THEN
      INSERT INTO public.payroll_run_lines (payroll_run_id, run_employee_id, component_id, component_code, component_name_ar, component_type, quantity, rate, amount, is_statutory_insurable, calculation_trace)
      VALUES (p_payroll_run_id, v_run_emp_id, v_absence_comp_id, 'ABSENCE', 'خصم غياب', 'deduction', v_absence_days, v_daily_rate, v_absence_deduction, false, 'خصم أيام غياب غير مبررة مسجلة في الحضور');
    END IF;

    IF v_loan_installment > 0 THEN
      INSERT INTO public.payroll_run_lines (payroll_run_id, run_employee_id, component_id, component_code, component_name_ar, component_type, quantity, rate, amount, is_statutory_insurable, calculation_trace)
      VALUES (p_payroll_run_id, v_run_emp_id, v_loan_comp_id, 'LOAN', 'قسط سلفة معتمدة', 'deduction', 1, v_loan_installment, v_loan_installment, false, 'استقطاع القسط المستحق من السلف القائمة');
    END IF;

    IF v_statutory_emp > 0 THEN
      INSERT INTO public.payroll_run_lines (payroll_run_id, run_employee_id, component_id, component_code, component_name_ar, component_type, quantity, rate, amount, is_statutory_insurable, calculation_trace)
      VALUES (p_payroll_run_id, v_run_emp_id, v_gosi_emp_comp_id, 'GOSI_EMPLOYEE', 'اشتراك التأمينات (موظف)', 'employee_contribution', 1, v_statutory_emp, v_statutory_emp, true, 'حصة الموظف: معاشات 9% + ساند 0.75% من الخاضع للتقاعد');
    END IF;

    IF v_statutory_empr > 0 THEN
      INSERT INTO public.payroll_run_lines (payroll_run_id, run_employee_id, component_id, component_code, component_name_ar, component_type, quantity, rate, amount, is_statutory_insurable, calculation_trace)
      VALUES (p_payroll_run_id, v_run_emp_id, v_gosi_empr_comp_id, 'GOSI_EMPLOYER', 'اشتراك التأمينات (منشأة)', 'employer_contribution', 1, v_statutory_empr, v_statutory_empr, true, 'حصة صاحب العمل وفق لائحة التأمينات');
    END IF;

    -- Accumulate totals
    v_total_emp_count := v_total_emp_count + 1;
    v_total_basic := v_total_basic + v_basic;
    v_total_allowances := v_total_allowances + v_housing + v_transport;
    v_total_overtime := v_total_overtime + v_overtime_amount;
    v_total_deductions_all := v_total_deductions_all + v_total_deductions;
    v_total_net := v_total_net + v_net;
    v_total_gosi_employer := v_total_gosi_employer + v_statutory_empr;
  END LOOP;

  -- Update payroll_runs summary
  UPDATE public.payroll_runs
  SET
    status = 'calculated',
    statutory_rule_version_id = v_statutory_rule.id,
    total_employees = v_total_emp_count,
    total_basic_salary = v_total_basic,
    total_allowances = v_total_allowances,
    total_overtime_amount = v_total_overtime,
    total_deductions = v_total_deductions_all,
    total_net_salary = v_total_net,
    total_employer_gosi = v_total_gosi_employer,
    blocking_exceptions_count = v_blocking_count,
    warnings_count = v_warnings_count,
    updated_at = now()
  WHERE id = p_payroll_run_id;

  INSERT INTO public.payroll_audit_logs (company_id, payroll_run_id, action, actor_id, details)
  VALUES (
    v_run.company_id, p_payroll_run_id, 'calculated', v_caller_uid,
    jsonb_build_object('total_employees', v_total_emp_count, 'net_salary', v_total_net, 'blocking_count', v_blocking_count)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payroll_run_id', p_payroll_run_id,
    'total_employees', v_total_emp_count,
    'total_net_salary', v_total_net,
    'blocking_exceptions', v_blocking_count,
    'warnings', v_warnings_count
  );
END;
$$;

-- 12.5 Approve Payroll Run (Guarded by Blocking Exceptions)
CREATE OR REPLACE FUNCTION public.approve_payroll_run_atomic(
  p_payroll_run_id uuid,
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_run public.payroll_runs%ROWTYPE;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك باعتماد مسيّر الرواتب (42501)';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  IF public.current_company_id() IS NOT NULL AND v_run.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة مسيّر رواتب يتبع لمنشأة أخرى (42501)';
  END IF;

  IF v_run.status NOT IN ('calculated', 'under_review') THEN
    RAISE EXCEPTION 'لا يمكن اعتماد مسيّر في الحالة الحالية (%)', v_run.status;
  END IF;

  -- Blocking Exceptions Guard
  IF EXISTS (
    SELECT 1 FROM public.payroll_exceptions
    WHERE payroll_run_id = p_payroll_run_id AND severity = 'blocking' AND is_resolved = false
  ) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد مسيّر الرواتب لوجود استثناءات مانعة للاعتماد (Blocking Exceptions) يجب تصحيحها أولاً';
  END IF;

  UPDATE public.payroll_runs
  SET status = 'approved',
      approved_by = v_caller_uid,
      approved_at = now(),
      payment_status = 'payment_ready',
      updated_at = now()
  WHERE id = p_payroll_run_id;

  UPDATE public.payroll_run_employees
  SET status = 'approved', updated_at = now()
  WHERE payroll_run_id = p_payroll_run_id;

  INSERT INTO public.payroll_audit_logs (company_id, payroll_run_id, action, actor_id, details)
  VALUES (v_run.company_id, p_payroll_run_id, 'approved', v_caller_uid, jsonb_build_object('note', p_note));

  RETURN jsonb_build_object('ok', true, 'payroll_run_id', p_payroll_run_id, 'status', 'approved');
END;
$$;

-- 12.6 Lock Payroll Run (Makes all calculation rows immutable & confirms loan allocations)
CREATE OR REPLACE FUNCTION public.lock_payroll_run_atomic(
  p_payroll_run_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_run public.payroll_runs%ROWTYPE;
  v_rec record;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بقفل مسيّر الرواتب (42501)';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  IF public.current_company_id() IS NOT NULL AND v_run.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة مسيّر رواتب يتبع لمنشأة أخرى (42501)';
  END IF;

  IF v_run.status != 'approved' THEN
    RAISE EXCEPTION 'لا يمكن قفل مسيّر الرواتب إلا بعد اعتماده رسمياً (الحالة الحالية: %)', v_run.status;
  END IF;

  -- Lock loan installments safely: record allocation and deduct from loans table
  FOR v_rec IN
    SELECT pre.employee_id, pre.loan_installment
    FROM public.payroll_run_employees pre
    WHERE pre.payroll_run_id = p_payroll_run_id AND pre.loan_installment > 0
  LOOP
    -- Recover loan installment
    UPDATE public.loans
    SET paid_installments = paid_installments + 1,
        remaining_balance = greatest(0, remaining_balance - v_rec.loan_installment),
        status = CASE WHEN remaining_balance - v_rec.loan_installment <= 0 THEN 'closed' ELSE status END
    WHERE employee_id = v_rec.employee_id AND status = 'active';

    -- Insert into legacy allocation table for compatibility
    INSERT INTO public.payroll_loan_allocations (payroll_run_id, loan_id, employee_id, amount, recovered_at)
    SELECT p_payroll_run_id, l.id, v_rec.employee_id, v_rec.loan_installment, now()
    FROM public.loans l
    WHERE l.employee_id = v_rec.employee_id
    LIMIT 1
    ON CONFLICT (payroll_run_id, loan_id) DO NOTHING;
  END LOOP;

  UPDATE public.payroll_runs
  SET status = 'locked',
      locked_by = v_caller_uid,
      locked_at = now(),
      updated_at = now()
  WHERE id = p_payroll_run_id;

  UPDATE public.payroll_run_employees
  SET status = 'locked', updated_at = now()
  WHERE payroll_run_id = p_payroll_run_id;

  INSERT INTO public.payroll_audit_logs (company_id, payroll_run_id, action, actor_id, details)
  VALUES (v_run.company_id, p_payroll_run_id, 'locked', v_caller_uid, jsonb_build_object('locked_at', now()));

  RETURN jsonb_build_object('ok', true, 'payroll_run_id', p_payroll_run_id, 'status', 'locked');
END;
$$;

-- 12.7 Formal Reopen of a Locked Payroll Run
CREATE OR REPLACE FUNCTION public.reopen_payroll_run_atomic(
  p_payroll_run_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_run public.payroll_runs%ROWTYPE;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
    RAISE EXCEPTION 'إعادة فتح مسيّر الرواتب المقفل تتطلب صلاحية مسؤول المنشأة أو مدير النظام الأعلى (42501)';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RAISE EXCEPTION 'يرجى تقديم سبب توضيحي واضح لإعادة فتح المسيّر المقفل (10 أحرف على الأقل)';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  IF public.current_company_id() IS NOT NULL AND v_run.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة مسيّر رواتب يتبع لمنشأة أخرى (42501)';
  END IF;

  IF v_run.status = 'paid' THEN
    RAISE EXCEPTION 'لا يمكن إعادة فتح مسيّر تم صرفه بنكياً وتسويته بالكامل';
  END IF;

  UPDATE public.payroll_runs
  SET status = 'draft',
      reopened_by = v_caller_uid,
      reopened_at = now(),
      reopen_reason = p_reason,
      locked_at = NULL,
      locked_by = NULL,
      approved_at = NULL,
      approved_by = NULL,
      updated_at = now()
  WHERE id = p_payroll_run_id;

  INSERT INTO public.payroll_audit_logs (company_id, payroll_run_id, action, actor_id, details)
  VALUES (v_run.company_id, p_payroll_run_id, 'reopened', v_caller_uid, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('ok', true, 'payroll_run_id', p_payroll_run_id, 'status', 'draft');
END;
$$;

-- 12.8 Prepare Bank Transfer Batch (WPS file preparation)
CREATE OR REPLACE FUNCTION public.prepare_bank_transfer_batch_atomic(
  p_payroll_run_id uuid,
  p_bank_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_run public.payroll_runs%ROWTYPE;
  v_batch_id uuid;
  v_batch_no text;
  v_count integer := 0;
  v_total numeric(14,2) := 0;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'finance_officer', 'payroll_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بإعداد ملفات الصرف والتحويل البنكي (42501)';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  IF v_run.status NOT IN ('approved', 'locked') THEN
    RAISE EXCEPTION 'لا يمكن إعداد ملف التحويل البنكي إلا بعد اعتماد المسيّر أو قفله رسمياً (الحالة الحالية: %)', v_run.status;
  END IF;

  v_batch_no := 'WPS-' || v_run.period_year || '-' || LPAD(v_run.period_month::text, 2, '0') || '-' || SUBSTRING(gen_random_uuid()::text, 1, 6);

  SELECT count(*), COALESCE(sum(net_salary), 0)
  INTO v_count, v_total
  FROM public.payroll_run_employees
  WHERE payroll_run_id = p_payroll_run_id AND net_salary > 0;

  INSERT INTO public.payroll_payment_batches (
    company_id,
    payroll_run_id,
    batch_number,
    bank_account_id,
    total_count,
    total_amount,
    currency,
    status
  ) VALUES (
    v_run.company_id,
    p_payroll_run_id,
    v_batch_no,
    p_bank_account_id,
    v_count,
    v_total,
    v_run.currency,
    'file_generated'
  ) RETURNING id INTO v_batch_id;

  UPDATE public.payroll_runs
  SET payment_status = 'file_generated', updated_at = now()
  WHERE id = p_payroll_run_id;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'batch_number', v_batch_no,
    'total_count', v_count,
    'total_amount', v_total
  );
END;
$$;

-- 12.9 Confirm Payroll Disbursement (Bank Reference Record)
CREATE OR REPLACE FUNCTION public.confirm_payroll_disbursement_atomic(
  p_payroll_run_id uuid,
  p_bank_reference text,
  p_bank_account_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_run public.payroll_runs%ROWTYPE;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بتأكيد الصرف البنكي (42501)';
  END IF;

  IF p_bank_reference IS NULL OR LENGTH(TRIM(p_bank_reference)) < 3 THEN
    RAISE EXCEPTION 'يرجى إدخال مرجع التحويل البنكي الصحيح للعملية';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  UPDATE public.payroll_runs
  SET payment_status = 'paid',
      status = 'paid',
      payment_bank_reference = p_bank_reference,
      payment_account_id = COALESCE(p_bank_account_id, payment_account_id),
      payment_confirmed_by = v_caller_uid,
      paid_at = now(),
      updated_at = now()
  WHERE id = p_payroll_run_id;

  UPDATE public.payroll_payment_batches
  SET status = 'reconciled',
      bank_reference = p_bank_reference,
      disbursed_at = now(),
      disbursed_by = v_caller_uid,
      updated_at = now()
  WHERE payroll_run_id = p_payroll_run_id;

  INSERT INTO public.payroll_audit_logs (company_id, payroll_run_id, action, actor_id, details)
  VALUES (v_run.company_id, p_payroll_run_id, 'disbursed', v_caller_uid, jsonb_build_object('bank_reference', p_bank_reference));

  RETURN jsonb_build_object('ok', true, 'payroll_run_id', p_payroll_run_id, 'payment_status', 'paid');
END;
$$;

-- 12.10 Paginated Employee Payroll Results for UI Grid
CREATE OR REPLACE FUNCTION public.get_payroll_run_employees_paginated(
  p_params jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_caller_emp public.employees%ROWTYPE;
  v_run_id uuid := (p_params->>'run_id')::uuid;
  v_search text := TRIM(COALESCE(p_params->>'search', ''));
  v_dept_id uuid := (p_params->>'department_id')::uuid;
  v_status text := TRIM(COALESCE(p_params->>'status', ''));
  v_page integer := GREATEST(1, COALESCE((p_params->>'page')::integer, 1));
  v_page_size integer := LEAST(100, GREATEST(1, COALESCE((p_params->>'page_size')::integer, 25)));
  v_offset integer;
  v_total_count integer;
  v_data jsonb;
  v_run public.payroll_runs%ROWTYPE;
BEGIN
  IF v_run_id IS NULL THEN
    RAISE EXCEPTION 'معرف مسيّر الرواتب إلزامي';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = v_run_id;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  -- Privacy & Authorization Check (Item 42)
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer']) THEN
    -- Normal employees cannot browse employee payroll grids
    RAISE EXCEPTION 'غير مصرح لك بالاطلاع على تفاصيل رواتب الموظفين (42501)';
  END IF;

  v_offset := (v_page - 1) * v_page_size;

  SELECT count(*) INTO v_total_count
  FROM public.payroll_run_employees pre
  WHERE pre.payroll_run_id = v_run_id
    AND (v_dept_id IS NULL OR pre.department_id = v_dept_id)
    AND (v_status = '' OR pre.status = v_status)
    AND (
      v_search = ''
      OR pre.employee_no ILIKE '%' || v_search || '%'
      OR pre.employee_name_ar ILIKE '%' || v_search || '%'
      OR pre.iban ILIKE '%' || v_search || '%'
    );

  SELECT COALESCE(jsonb_agg(sub.row_data), '[]'::jsonb) INTO v_data
  FROM (
    SELECT jsonb_build_object(
      'id', pre.id,
      'employeeId', pre.employee_id,
      'employeeNo', pre.employee_no,
      'employeeName', pre.employee_name_ar,
      'departmentName', pre.department_name_ar,
      'nationality', pre.nationality,
      'isSaudi', pre.is_saudi,
      'bankName', pre.bank_name,
      'iban', pre.iban,
      'basicSalary', pre.basic_salary,
      'housingAllowance', pre.housing_allowance,
      'transportAllowance', pre.transport_allowance,
      'overtimeHours', pre.overtime_hours,
      'overtimeAmount', pre.overtime_amount,
      'bonusAmount', pre.bonus_amount,
      'unpaidLeaveDays', pre.unpaid_leave_days,
      'unpaidLeaveDeduction', pre.unpaid_leave_deduction,
      'absenceDays', pre.absence_days,
      'absenceDeduction', pre.absence_deduction,
      'loanDeduction', pre.loan_installment,
      'gosiEmployee', pre.statutory_employee,
      'gosiEmployer', pre.statutory_employer,
      'otherDeductions', pre.other_deductions,
      'grossSalary', pre.gross_salary,
      'totalDeductions', pre.total_deductions,
      'netSalary', pre.net_salary,
      'hasBlockingException', pre.has_blocking_exception,
      'status', pre.status
    ) AS row_data
    FROM public.payroll_run_employees pre
    WHERE pre.payroll_run_id = v_run_id
      AND (v_dept_id IS NULL OR pre.department_id = v_dept_id)
      AND (v_status = '' OR pre.status = v_status)
      AND (
        v_search = ''
        OR pre.employee_no ILIKE '%' || v_search || '%'
        OR pre.employee_name_ar ILIKE '%' || v_search || '%'
        OR pre.iban ILIKE '%' || v_search || '%'
      )
    ORDER BY pre.employee_no ASC
    LIMIT v_page_size OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'ok', true,
    'data', v_data,
    'total', v_total_count,
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', CEIL(v_total_count::numeric / v_page_size::numeric)
  );
END;
$$;

-- 12.11 Secure Employee Payslip Model
CREATE OR REPLACE FUNCTION public.get_payroll_employee_payslip(
  p_run_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_run_emp public.payroll_run_employees%ROWTYPE;
  v_run public.payroll_runs%ROWTYPE;
  v_emp public.employees%ROWTYPE;
  v_lines jsonb;
BEGIN
  SELECT * INTO v_run_emp FROM public.payroll_run_employees WHERE id = p_run_employee_id;
  IF v_run_emp.id IS NULL THEN
    RAISE EXCEPTION 'قسيمة الراتب غير موجودة';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = v_run_emp.payroll_run_id;
  SELECT * INTO v_emp FROM public.employees WHERE id = v_run_emp.employee_id;

  -- Field-Level Salary Privacy: Employee sees own only, unless privileged role
  IF v_emp.user_id != v_caller_uid AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بالاطلاع على قسيمة راتب موظف آخر (42501)';
  END IF;

  SELECT COALESCE(jsonb_agg(sub.line_data), '[]'::jsonb) INTO v_lines
  FROM (
    SELECT jsonb_build_object(
      'code', prl.component_code,
      'nameAr', prl.component_name_ar,
      'type', prl.component_type,
      'quantity', prl.quantity,
      'rate', prl.rate,
      'amount', prl.amount,
      'trace', prl.calculation_trace
    ) AS line_data
    FROM public.payroll_run_lines prl
    WHERE prl.run_employee_id = p_run_employee_id
    ORDER BY prl.component_type ASC, prl.amount DESC
  ) sub;

  RETURN jsonb_build_object(
    'ok', true,
    'payslipId', v_run_emp.id,
    'employeeId', v_run_emp.employee_id,
    'employeeNo', v_run_emp.employee_no,
    'employeeName', v_run_emp.employee_name_ar,
    'department', v_run_emp.department_name_ar,
    'period', v_run.period_year || '-' || LPAD(v_run.period_month::text, 2, '0'),
    'currency', v_run.currency,
    'bankName', v_run_emp.bank_name,
    'iban', v_run_emp.iban,
    'eligibleDays', v_run_emp.eligible_days,
    'grossSalary', v_run_emp.gross_salary,
    'totalDeductions', v_run_emp.total_deductions,
    'netSalary', v_run_emp.net_salary,
    'employerGosi', v_run_emp.statutory_employer,
    'lines', v_lines
  );
END;
$$;

-- 12.12 Production Payroll KPIs
CREATE OR REPLACE FUNCTION public.get_payroll_kpis(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp_id uuid := COALESCE(p_company_id, public.current_company_id());
  v_latest_run public.payroll_runs%ROWTYPE;
  v_total_monthly_net numeric(14,2) := 0;
  v_total_monthly_gosi numeric(14,2) := 0;
  v_active_loans_count integer := 0;
  v_active_loans_balance numeric(14,2) := 0;
  v_pending_approval_runs integer := 0;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح بالاطلاع على مؤشرات الرواتب (42501)';
  END IF;

  SELECT * INTO v_latest_run
  FROM public.payroll_runs
  WHERE company_id = v_comp_id
  ORDER BY period_year DESC, period_month DESC, created_at DESC
  LIMIT 1;

  IF v_latest_run.id IS NOT NULL THEN
    v_total_monthly_net := v_latest_run.total_net_salary;
    v_total_monthly_gosi := v_latest_run.total_employer_gosi;
  END IF;

  SELECT count(*), COALESCE(sum(remaining_balance), 0)
  INTO v_active_loans_count, v_active_loans_balance
  FROM public.loans l
  JOIN public.employees e ON e.id = l.employee_id
  WHERE e.company_id = v_comp_id AND l.status = 'active';

  SELECT count(*) INTO v_pending_approval_runs
  FROM public.payroll_runs
  WHERE company_id = v_comp_id AND status = 'calculated';

  RETURN jsonb_build_object(
    'latestRunId', v_latest_run.id,
    'latestPeriod', CASE WHEN v_latest_run.id IS NOT NULL THEN (v_latest_run.period_year || '-' || LPAD(v_latest_run.period_month::text, 2, '0')) ELSE '' END,
    'latestRunStatus', COALESCE(v_latest_run.status, 'draft'),
    'latestPaymentStatus', COALESCE(v_latest_run.payment_status, 'not_processed'),
    'totalMonthlyNet', v_total_monthly_net,
    'totalMonthlyEmployerGosi', v_total_monthly_gosi,
    'activeLoansCount', v_active_loans_count,
    'activeLoansBalance', v_active_loans_balance,
    'pendingApprovalRunsCount', v_pending_approval_runs,
    'blockingExceptionsCount', COALESCE(v_latest_run.blocking_exceptions_count, 0)
  );
END;
$$;

-- ============================================================================
-- STEP 13: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- company_payroll_configs
DROP POLICY IF EXISTS "company_payroll_configs_select" ON public.company_payroll_configs;
CREATE POLICY "company_payroll_configs_select"
  ON public.company_payroll_configs FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

-- salary_components
DROP POLICY IF EXISTS "salary_components_select" ON public.salary_components;
CREATE POLICY "salary_components_select"
  ON public.salary_components FOR SELECT
  TO authenticated
  USING (company_id IS NULL OR company_id = public.current_company_id());

-- salary_structures
DROP POLICY IF EXISTS "salary_structures_select" ON public.salary_structures;
CREATE POLICY "salary_structures_select"
  ON public.salary_structures FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

-- employee_compensation_versions (Strict privacy)
DROP POLICY IF EXISTS "emp_comp_select_policy" ON public.employee_compensation_versions;
CREATE POLICY "emp_comp_select_policy"
  ON public.employee_compensation_versions FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (company_id = public.current_company_id() AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer']))
  );

-- payroll_runs
DROP POLICY IF EXISTS "payroll_runs_select_policy" ON public.payroll_runs;
CREATE POLICY "payroll_runs_select_policy"
  ON public.payroll_runs FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer'])
  );

-- payroll_run_employees (Employee sees own, staff sees company)
DROP POLICY IF EXISTS "run_emp_select_policy" ON public.payroll_run_employees;
CREATE POLICY "run_emp_select_policy"
  ON public.payroll_run_employees FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (company_id = public.current_company_id() AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer']))
  );

-- payroll_run_lines
DROP POLICY IF EXISTS "run_lines_select_policy" ON public.payroll_run_lines;
CREATE POLICY "run_lines_select_policy"
  ON public.payroll_run_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_run_employees pre
      WHERE pre.id = payroll_run_lines.run_employee_id
        AND (
          pre.employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
          OR (pre.company_id = public.current_company_id() AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer']))
        )
    )
  );

-- statutory_rule_sets & versions (public read to authenticated)
DROP POLICY IF EXISTS "statutory_sets_read" ON public.statutory_rule_sets;
CREATE POLICY "statutory_sets_read" ON public.statutory_rule_sets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "statutory_versions_read" ON public.statutory_rule_versions;
CREATE POLICY "statutory_versions_read" ON public.statutory_rule_versions FOR SELECT TO authenticated USING (true);

-- payroll_exceptions
DROP POLICY IF EXISTS "payroll_exceptions_select" ON public.payroll_exceptions;
CREATE POLICY "payroll_exceptions_select" ON public.payroll_exceptions FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer']));

-- Direct mutation denial on core tables
DROP POLICY IF EXISTS "deny_direct_mutation_payroll_runs" ON public.payroll_runs;
CREATE POLICY "deny_direct_mutation_payroll_runs" ON public.payroll_runs FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny_direct_mutation_run_employees" ON public.payroll_run_employees;
CREATE POLICY "deny_direct_mutation_run_employees" ON public.payroll_run_employees FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny_direct_mutation_run_lines" ON public.payroll_run_lines;
CREATE POLICY "deny_direct_mutation_run_lines" ON public.payroll_run_lines FOR INSERT TO authenticated WITH CHECK (false);

-- ============================================================================
-- STEP 14: PROMPT 13.7 STRICT FUNCTION PRIVILEGES WHITELIST
-- ============================================================================

REVOKE ALL ON FUNCTION public.init_company_payroll_config(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_employee_compensation_atomic(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_payroll_run_atomic(uuid, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_payroll_run_atomic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_payroll_run_atomic(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lock_payroll_run_atomic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_payroll_run_atomic(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_bank_transfer_batch_atomic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_payroll_disbursement_atomic(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_run_employees_paginated(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_employee_payslip(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payroll_kpis(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.init_company_payroll_config(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_employee_compensation_atomic(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_payroll_run_atomic(uuid, uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_payroll_run_atomic(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_payroll_run_atomic(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lock_payroll_run_atomic(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_payroll_run_atomic(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prepare_bank_transfer_batch_atomic(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_payroll_disbursement_atomic(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_run_employees_paginated(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_employee_payslip(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_kpis(uuid) TO authenticated, service_role;

GRANT SELECT ON public.company_payroll_configs TO authenticated, service_role;
GRANT SELECT ON public.salary_components TO authenticated, service_role;
GRANT SELECT ON public.salary_structures TO authenticated, service_role;
GRANT SELECT ON public.salary_structure_components TO authenticated, service_role;
GRANT SELECT ON public.employee_compensation_versions TO authenticated, service_role;
GRANT SELECT ON public.statutory_rule_sets TO authenticated, service_role;
GRANT SELECT ON public.statutory_rule_versions TO authenticated, service_role;
GRANT SELECT ON public.payroll_periods TO authenticated, service_role;
GRANT SELECT ON public.payroll_runs TO authenticated, service_role;
GRANT SELECT ON public.payroll_run_employees TO authenticated, service_role;
GRANT SELECT ON public.payroll_run_lines TO authenticated, service_role;
GRANT SELECT ON public.payroll_exceptions TO authenticated, service_role;
GRANT SELECT ON public.payroll_payment_batches TO authenticated, service_role;
GRANT SELECT ON public.payroll_audit_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_adjustments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_loan_allocations TO authenticated, service_role;
