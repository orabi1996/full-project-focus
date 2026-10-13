-- ============================================================================
-- PROMPT 33: PRODUCTION COMPENSATION & BENEFITS, SALARY STRUCTURES,
-- ALLOWANCES, TOTAL REWARDS & BENEFITS ENGINE
-- Migration Sequence: 20261015000000
-- ============================================================================

-- 1. REFERENCE NUMBER COUNTERS TABLE
CREATE TABLE IF NOT EXISTS public.comp_reference_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ref_type text NOT NULL CHECK (ref_type IN ('SALARY_CHANGE', 'REVIEW_CYCLE', 'VARIABLE_PAY', 'BENEFIT_PLAN')),
  year_val integer NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_comp_ref_counter UNIQUE (company_id, ref_type, year_val)
);

ALTER TABLE public.comp_reference_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_counters_company_isolation" ON public.comp_reference_counters
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- 2. COMPENSATION COMPONENT CATALOG
CREATE TABLE IF NOT EXISTS public.compensation_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  component_type text NOT NULL CHECK (component_type IN (
    'basic_salary',
    'fixed_allowance',
    'variable_allowance',
    'recurring_earning',
    'non_recurring_earning',
    'bonus',
    'commission',
    'benefit',
    'employer_contribution',
    'employee_deduction_reference',
    'non_cash_benefit'
  )),
  calculation_method text NOT NULL DEFAULT 'fixed' CHECK (calculation_method IN (
    'fixed',
    'percentage_of_basic',
    'percentage_of_component',
    'configured_formula'
  )),
  base_component_id uuid REFERENCES public.compensation_components(id) ON DELETE SET NULL,
  default_amount numeric(14,2) NOT NULL DEFAULT 0,
  default_percentage numeric(6,2),
  currency text NOT NULL DEFAULT 'SAR',
  is_taxable boolean NOT NULL DEFAULT false,
  is_statutory_insurable boolean NOT NULL DEFAULT false,
  is_recurring boolean NOT NULL DEFAULT true,
  payroll_mapping_code text,
  proration_rule text NOT NULL DEFAULT 'calendar_days' CHECK (proration_rule IN ('calendar_days', 'working_days', 'none')),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_comp_components_code UNIQUE (company_id, code)
);

ALTER TABLE public.compensation_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_components_company_isolation" ON public.compensation_components
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- 3. SALARY PAY GRADES & CAREER LEVELS
CREATE TABLE IF NOT EXISTS public.salary_pay_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  grade_level integer NOT NULL DEFAULT 1,
  career_track text NOT NULL DEFAULT 'professional' CHECK (career_track IN ('executive', 'management', 'professional', 'technical', 'operational')),
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_comp_pay_grades_code UNIQUE (company_id, code)
);

ALTER TABLE public.salary_pay_grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_pay_grades_company_isolation" ON public.salary_pay_grades
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- 4. SALARY RANGES (EFFECTIVE-DATED PAY BANDS)
CREATE TABLE IF NOT EXISTS public.salary_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  salary_structure_id uuid REFERENCES public.salary_structures(id) ON DELETE CASCADE,
  pay_grade_id uuid NOT NULL REFERENCES public.salary_pay_grades(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'SAR',
  minimum_salary numeric(14,2) NOT NULL CHECK (minimum_salary >= 0),
  midpoint_salary numeric(14,2) NOT NULL CHECK (midpoint_salary >= minimum_salary),
  maximum_salary numeric(14,2) NOT NULL CHECK (maximum_salary >= midpoint_salary),
  spread_percentage numeric(6,2) GENERATED ALWAYS AS (
    CASE WHEN minimum_salary > 0 THEN ROUND(((maximum_salary - minimum_salary) / minimum_salary) * 100, 2) ELSE 0 END
  ) STORED,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_ranges_company_isolation" ON public.salary_ranges
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_comp_ranges_lookup
  ON public.salary_ranges(company_id, pay_grade_id, effective_from, status);

-- 5. EMPLOYEE COMPENSATION PACKAGES (VERSIONED HISTORICAL RECORD)
CREATE TABLE IF NOT EXISTS public.employee_compensation_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_structure_id uuid REFERENCES public.salary_structures(id) ON DELETE SET NULL,
  pay_grade_id uuid REFERENCES public.salary_pay_grades(id) ON DELETE SET NULL,
  package_version integer NOT NULL DEFAULT 1,
  effective_from date NOT NULL,
  effective_to date,
  currency text NOT NULL DEFAULT 'SAR',
  basic_salary numeric(14,2) NOT NULL CHECK (basic_salary >= 0),
  total_fixed_allowances numeric(14,2) NOT NULL DEFAULT 0,
  total_gross_salary numeric(14,2) NOT NULL DEFAULT 0,
  annual_target_variable numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_cost numeric(14,2) NOT NULL DEFAULT 0,
  compa_ratio numeric(6,2),
  range_penetration numeric(6,2),
  range_status text NOT NULL DEFAULT 'within_range' CHECK (range_status IN ('below_minimum', 'within_range', 'above_maximum', 'not_applicable')),
  source_event text NOT NULL DEFAULT 'initial_hire' CHECK (source_event IN (
    'initial_hire',
    'promotion',
    'merit',
    'merit_increase',
    'annual_review',
    'market_adjustment',
    'transfer',
    'probation_confirmation',
    'retention_adjustment',
    'correction',
    'contract_renewal',
    'restructure',
    'offer_conversion',
    'other'
  )),
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft',
    'pending_approval',
    'approved',
    'scheduled',
    'active',
    'superseded',
    'cancelled'
  )),
  notes text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_package_version UNIQUE (company_id, employee_id, package_version)
);

ALTER TABLE public.employee_compensation_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_packages_company_isolation" ON public.employee_compensation_packages
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_comp_packages_emp_date
  ON public.employee_compensation_packages(employee_id, effective_from, status);

-- 6. EMPLOYEE PACKAGE COMPONENTS BREAKDOWN
CREATE TABLE IF NOT EXISTS public.employee_package_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.employee_compensation_packages(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.compensation_components(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  percentage numeric(6,2),
  calculation_basis text NOT NULL DEFAULT 'fixed',
  is_employer_contribution boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_package_component UNIQUE (package_id, component_id)
);

ALTER TABLE public.employee_package_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_package_components_isolation" ON public.employee_package_components
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employee_compensation_packages p
    WHERE p.id = package_id
    AND p.company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

-- 7. SALARY CHANGE REQUESTS (GOVERNED WORKFLOW TRANSACTIONS)
CREATE TABLE IF NOT EXISTS public.compensation_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_number text NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'promotion',
    'merit',
    'market_adjustment',
    'annual_review',
    'probation_confirmation',
    'retention_adjustment',
    'transfer',
    'correction',
    'contract_renewal',
    'other'
  )),
  effective_date date NOT NULL,
  current_package_id uuid REFERENCES public.employee_compensation_packages(id) ON DELETE SET NULL,
  proposed_package_id uuid REFERENCES public.employee_compensation_packages(id) ON DELETE SET NULL,
  current_basic numeric(14,2) NOT NULL DEFAULT 0,
  proposed_basic numeric(14,2) NOT NULL DEFAULT 0,
  increase_amount numeric(14,2) NOT NULL DEFAULT 0,
  increase_percentage numeric(6,2) NOT NULL DEFAULT 0,
  current_compa_ratio numeric(6,2),
  proposed_compa_ratio numeric(6,2),
  current_range_penetration numeric(6,2),
  proposed_range_penetration numeric(6,2),
  range_validation text NOT NULL DEFAULT 'within_range' CHECK (range_validation IN ('below_minimum', 'within_range', 'above_maximum', 'not_applicable')),
  requires_exception_approval boolean NOT NULL DEFAULT false,
  justification text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'draft',
    'submitted',
    'in_review',
    'approved',
    'rejected',
    'applied',
    'cancelled'
  )),
  workflow_instance_id uuid,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_comp_change_req_number UNIQUE (company_id, request_number)
);

ALTER TABLE public.compensation_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_change_requests_company_isolation" ON public.compensation_change_requests
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- 8. MERIT MATRICES (PERFORMANCE X RANGE POSITION GUIDELINES)
CREATE TABLE IF NOT EXISTS public.compensation_merit_matrices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  year_val integer NOT NULL,
  matrix_grid jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_merit_matrix_code UNIQUE (company_id, code)
);

ALTER TABLE public.compensation_merit_matrices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_merit_matrices_isolation" ON public.compensation_merit_matrices
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- 9. COMPENSATION REVIEW CYCLES (ANNUAL / PERIODIC SALARY REVIEWS)
CREATE TABLE IF NOT EXISTS public.compensation_review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle_code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  year_val integer NOT NULL,
  effective_date date NOT NULL,
  review_start_date date NOT NULL,
  review_end_date date NOT NULL,
  merit_matrix_id uuid REFERENCES public.compensation_merit_matrices(id) ON DELETE SET NULL,
  allocated_budget numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  budget_enforcement text NOT NULL DEFAULT 'warn' CHECK (budget_enforcement IN ('warn', 'hard_block', 'none')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'planning',
    'open',
    'manager_review',
    'hr_review',
    'calibration',
    'approved',
    'finalized',
    'applied',
    'closed'
  )),
  total_eligible_employees integer NOT NULL DEFAULT 0,
  total_proposed_increase numeric(14,2) NOT NULL DEFAULT 0,
  total_approved_increase numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  finalized_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_comp_review_cycles_code UNIQUE (company_id, cycle_code)
);

ALTER TABLE public.compensation_review_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_review_cycles_isolation" ON public.compensation_review_cycles
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- 10. REVIEW POPULATION SNAPSHOT (FROZEN AT CYCLE LAUNCH)
CREATE TABLE IF NOT EXISTS public.compensation_review_populations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.compensation_review_cycles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  pay_grade_id uuid REFERENCES public.salary_pay_grades(id) ON DELETE SET NULL,
  current_basic_salary numeric(14,2) NOT NULL DEFAULT 0,
  current_compa_ratio numeric(6,2),
  performance_rating numeric(4,2),
  frozen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cycle_population_emp UNIQUE (cycle_id, employee_id)
);

ALTER TABLE public.compensation_review_populations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_review_populations_isolation" ON public.compensation_review_populations
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- 11. REVIEW RECOMMENDATIONS & CALIBRATION
CREATE TABLE IF NOT EXISTS public.compensation_review_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.compensation_review_cycles(id) ON DELETE CASCADE,
  population_id uuid NOT NULL REFERENCES public.compensation_review_populations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  original_increase_percentage numeric(6,2) NOT NULL DEFAULT 0,
  original_increase_amount numeric(14,2) NOT NULL DEFAULT 0,
  calibrated_increase_percentage numeric(6,2),
  calibrated_increase_amount numeric(14,2),
  adjustment_reason text,
  calibrated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  calibrated_at timestamptz,
  final_basic_salary numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'draft',
    'submitted',
    'calibrated',
    'approved',
    'rejected'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cycle_recommendation_emp UNIQUE (cycle_id, employee_id)
);

ALTER TABLE public.compensation_review_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_review_recommendations_isolation" ON public.compensation_review_recommendations
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.compensation_review_cycles c
    WHERE c.id = cycle_id
    AND c.company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

-- 12. VARIABLE PAY PLANS & INCENTIVE CYCLES
CREATE TABLE IF NOT EXISTS public.variable_pay_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN (
    'annual_bonus',
    'performance_bonus',
    'sales_commission',
    'project_incentive',
    'company_bonus',
    'retention_bonus'
  )),
  target_type text NOT NULL DEFAULT 'percentage_of_basic' CHECK (target_type IN ('percentage_of_basic', 'fixed_amount')),
  target_value numeric(14,2) NOT NULL DEFAULT 0,
  cap_percentage numeric(6,2),
  floor_percentage numeric(6,2),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_variable_pay_plans_code UNIQUE (company_id, code)
);

ALTER TABLE public.variable_pay_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variable_pay_plans_isolation" ON public.variable_pay_plans
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

CREATE TABLE IF NOT EXISTS public.variable_pay_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.variable_pay_plans(id) ON DELETE CASCADE,
  cycle_code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  year_val integer NOT NULL,
  company_factor numeric(6,4) NOT NULL DEFAULT 1.0000,
  budget_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'approved', 'finalized', 'transferred_to_payroll')),
  payroll_period_id uuid,
  transferred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_variable_pay_cycles_code UNIQUE (company_id, cycle_code)
);

ALTER TABLE public.variable_pay_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variable_pay_cycles_isolation" ON public.variable_pay_cycles
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

CREATE TABLE IF NOT EXISTS public.variable_pay_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.variable_pay_cycles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  target_amount numeric(14,2) NOT NULL DEFAULT 0,
  individual_factor numeric(6,4) NOT NULL DEFAULT 1.0000,
  calculated_amount numeric(14,2) NOT NULL DEFAULT 0,
  final_award_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft', 'proposed', 'approved', 'paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_variable_pay_award_emp UNIQUE (cycle_id, employee_id)
);

ALTER TABLE public.variable_pay_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variable_pay_awards_isolation" ON public.variable_pay_awards
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- 13. BENEFITS PROVIDERS & PLANS CATALOG
CREATE TABLE IF NOT EXISTS public.benefit_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  icon_name text NOT NULL DEFAULT 'shield',
  is_taxable boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 10
);

ALTER TABLE public.benefit_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benefit_categories_public_read" ON public.benefit_categories
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.benefit_categories (code, name_ar, name_en, icon_name, is_taxable, display_order)
VALUES
  ('medical', 'التأمين الطبي والصحي', 'Medical & Health Insurance', 'favorite', false, 1),
  ('life_insurance', 'التأمين على الحياة والحوادث', 'Life & Disability Insurance', 'shield', false, 2),
  ('transport', 'المواصلات والنقل المؤسسي', 'Company Transport & Fleet', 'directions_car', false, 3),
  ('meal', 'الوجبات وبدلات الإعاشة', 'Meals & Food Allowance', 'restaurant', false, 4),
  ('mobile', 'الاتصالات والأجهزة الذكية', 'Mobile & Device Subsidy', 'smartphone', false, 5),
  ('vehicle', 'السيارات المخصصة والمحروقات', 'Executive Company Vehicle', 'commute', false, 6),
  ('housing', 'الإسكان العيني والسكن الوظيفي', 'Housing Facilities & Compounds', 'home', false, 7),
  ('education', 'تعليم الأبناء والدعم الدراسي', 'Children Education Allowance', 'school', false, 8),
  ('wellness', 'الصحة النفسية واللياقة البدنية', 'Corporate Wellness & Gym', 'fitness_center', false, 9),
  ('retirement_pension', 'الادخار التكميلي ونهاية الخدمة', 'Supplementary Pension & Savings', 'savings', false, 10),
  ('other', 'مزايا عينية أخرى', 'Other Corporate Benefits', 'card_giftcard', false, 11)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en;

CREATE TABLE IF NOT EXISTS public.benefit_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  contact_person text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_benefit_providers_code UNIQUE (company_id, code)
);

ALTER TABLE public.benefit_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benefit_providers_isolation" ON public.benefit_providers
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

CREATE TABLE IF NOT EXISTS public.benefit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.benefit_categories(id) ON DELETE RESTRICT,
  provider_id uuid REFERENCES public.benefit_providers(id) ON DELETE SET NULL,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  coverage_description text,
  tier_level text NOT NULL DEFAULT 'standard' CHECK (tier_level IN ('vip', 'executive', 'gold', 'silver', 'standard', 'basic')),
  employee_monthly_cost numeric(14,2) NOT NULL DEFAULT 0,
  employer_monthly_cost numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  dependent_coverage_allowed boolean NOT NULL DEFAULT true,
  max_dependents integer NOT NULL DEFAULT 5,
  eligibility_rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_benefit_plans_code UNIQUE (company_id, code)
);

ALTER TABLE public.benefit_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benefit_plans_isolation" ON public.benefit_plans
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- 14. EMPLOYEE DEPENDENTS (BENEFITS MASTER DATA)
CREATE TABLE IF NOT EXISTS public.employee_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  full_name_ar text NOT NULL,
  full_name_en text,
  relationship text NOT NULL CHECK (relationship IN ('spouse', 'child', 'parent', 'other')),
  national_id_or_iqama text,
  birth_date date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  is_eligible_for_benefits boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_dependents_isolation" ON public.employee_dependents
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- 15. EMPLOYEE BENEFIT ENROLLMENTS & DEPENDENTS ENROLLED
CREATE TABLE IF NOT EXISTS public.employee_benefit_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.benefit_plans(id) ON DELETE RESTRICT,
  enrollment_type text NOT NULL DEFAULT 'new_hire' CHECK (enrollment_type IN (
    'open_enrollment',
    'new_hire',
    'life_event',
    'administrative_addition'
  )),
  effective_from date NOT NULL,
  effective_to date,
  employee_cost_monthly numeric(14,2) NOT NULL DEFAULT 0,
  employer_cost_monthly numeric(14,2) NOT NULL DEFAULT 0,
  payroll_deduction_code text,
  status text NOT NULL DEFAULT 'enrolled' CHECK (status IN (
    'eligible',
    'pending',
    'enrolled',
    'waived',
    'rejected',
    'terminated',
    'expired'
  )),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_benefit_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_benefit_enrollments_isolation" ON public.employee_benefit_enrollments
  FOR ALL TO authenticated
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

CREATE TABLE IF NOT EXISTS public.benefit_enrollment_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.employee_benefit_enrollments(id) ON DELETE CASCADE,
  dependent_id uuid NOT NULL REFERENCES public.employee_dependents(id) ON DELETE CASCADE,
  additional_cost numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_enrollment_dependent UNIQUE (enrollment_id, dependent_id)
);

ALTER TABLE public.benefit_enrollment_dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benefit_enrollment_dependents_isolation" ON public.benefit_enrollment_dependents
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employee_benefit_enrollments e
    WHERE e.id = enrollment_id
    AND e.company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
  ));

-- 16. TOTAL REWARDS STATEMENTS (GOVERNED EMPLOYER VALUE SNAPSHOT)
CREATE TABLE IF NOT EXISTS public.total_rewards_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year_val integer NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  currency text NOT NULL DEFAULT 'SAR',
  base_salary_annual numeric(14,2) NOT NULL DEFAULT 0,
  fixed_allowances_annual numeric(14,2) NOT NULL DEFAULT 0,
  variable_pay_annual numeric(14,2) NOT NULL DEFAULT 0,
  employer_benefits_annual numeric(14,2) NOT NULL DEFAULT 0,
  employer_statutory_annual numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_value_annual numeric(14,2) NOT NULL DEFAULT 0,
  breakdown_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_total_rewards_emp_year UNIQUE (company_id, employee_id, year_val)
);

ALTER TABLE public.total_rewards_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "total_rewards_snapshots_isolation" ON public.total_rewards_snapshots
  FOR ALL TO authenticated
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    AND (
      -- Employee can view own statement
      employee_id = (SELECT id FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1)
      OR public.current_user_has_any_role(ARRAY['super_admin', 'hr_manager', 'finance_officer', 'payroll_officer', 'auditor'])
    )
  );

-- ============================================================================
-- ATOMIC BUSINESS PROCEDURES & RPC FUNCTIONS
-- ============================================================================

-- Function 1: Stable Business Sequence Generator
CREATE OR REPLACE FUNCTION public.generate_comp_reference_number(
  p_company_id uuid,
  p_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_prefix text;
  v_seq integer;
BEGIN
  IF p_type = 'SALARY_CHANGE' THEN
    v_prefix := 'SCR';
  ELSIF p_type = 'REVIEW_CYCLE' THEN
    v_prefix := 'CRC';
  ELSIF p_type = 'VARIABLE_PAY' THEN
    v_prefix := 'VPA';
  ELSIF p_type = 'BENEFIT_PLAN' THEN
    v_prefix := 'BEN';
  ELSE
    v_prefix := 'CMP';
  END IF;

  INSERT INTO public.comp_reference_counters (company_id, ref_type, year_val, last_seq, updated_at)
  VALUES (p_company_id, p_type, v_year, 1, now())
  ON CONFLICT (company_id, ref_type, year_val)
  DO UPDATE SET last_seq = public.comp_reference_counters.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO v_seq;

  RETURN v_prefix || '-' || v_year::text || '-' || LPAD(v_seq::text, 6, '0');
END;
$$;

-- Function 2: Create Salary Change Request Atomic
CREATE OR REPLACE FUNCTION public.create_salary_change_request_atomic(
  p_company_id uuid,
  p_employee_id uuid,
  p_reason text,
  p_effective_date date,
  p_proposed_basic numeric,
  p_justification text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp RECORD;
  v_cur_pkg RECORD;
  v_range RECORD;
  v_cur_basic numeric := 0;
  v_inc_amount numeric := 0;
  v_inc_pct numeric := 0;
  v_cur_compa numeric := NULL;
  v_prop_compa numeric := NULL;
  v_cur_pen numeric := NULL;
  v_prop_pen numeric := NULL;
  v_validation text := 'within_range';
  v_requires_exception boolean := false;
  v_req_num text;
  v_new_req_id uuid;
BEGIN
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المحدد غير موجود في هذه المنشأة.';
  END IF;

  -- Get latest active package or employee table basic salary
  SELECT * INTO v_cur_pkg
  FROM public.employee_compensation_packages
  WHERE employee_id = p_employee_id AND status = 'active'
  ORDER BY effective_from DESC LIMIT 1;

  IF FOUND THEN
    v_cur_basic := v_cur_pkg.basic_salary;
  ELSE
    v_cur_basic := COALESCE(v_emp.basic_salary, 0);
  END IF;

  v_inc_amount := p_proposed_basic - v_cur_basic;
  IF v_cur_basic > 0 THEN
    v_inc_pct := ROUND(((v_inc_amount / v_cur_basic) * 100), 2);
  ELSE
    v_inc_pct := 100.00;
  END IF;

  -- Validate against applicable salary range
  IF v_cur_pkg.pay_grade_id IS NOT NULL THEN
    SELECT * INTO v_range
    FROM public.salary_ranges
    WHERE company_id = p_company_id AND pay_grade_id = v_cur_pkg.pay_grade_id AND status = 'active'
    AND effective_from <= p_effective_date
    AND (effective_to IS NULL OR effective_to >= p_effective_date)
    ORDER BY effective_from DESC LIMIT 1;

    IF FOUND AND v_range.midpoint_salary > 0 THEN
      v_cur_compa := ROUND((v_cur_basic / v_range.midpoint_salary) * 100, 2);
      v_prop_compa := ROUND((p_proposed_basic / v_range.midpoint_salary) * 100, 2);
      
      IF v_range.maximum_salary > v_range.minimum_salary THEN
        v_cur_pen := ROUND(((v_cur_basic - v_range.minimum_salary) / (v_range.maximum_salary - v_range.minimum_salary)) * 100, 2);
        v_prop_pen := ROUND(((p_proposed_basic - v_range.minimum_salary) / (v_range.maximum_salary - v_range.minimum_salary)) * 100, 2);
      END IF;

      IF p_proposed_basic < v_range.minimum_salary THEN
        v_validation := 'below_minimum';
        v_requires_exception := true;
      ELSIF p_proposed_basic > v_range.maximum_salary THEN
        v_validation := 'above_maximum';
        v_requires_exception := true;
      ELSE
        v_validation := 'within_range';
      END IF;
    END IF;
  END IF;

  v_req_num := public.generate_comp_reference_number(p_company_id, 'SALARY_CHANGE');

  INSERT INTO public.compensation_change_requests (
    company_id,
    request_number,
    employee_id,
    reason,
    effective_date,
    current_package_id,
    current_basic,
    proposed_basic,
    increase_amount,
    increase_percentage,
    current_compa_ratio,
    proposed_compa_ratio,
    current_range_penetration,
    proposed_range_penetration,
    range_validation,
    requires_exception_approval,
    justification,
    status,
    requested_by
  ) VALUES (
    p_company_id,
    v_req_num,
    p_employee_id,
    p_reason,
    p_effective_date,
    v_cur_pkg.id,
    v_cur_basic,
    p_proposed_basic,
    v_inc_amount,
    v_inc_pct,
    v_cur_compa,
    v_prop_compa,
    v_cur_pen,
    v_prop_pen,
    v_validation,
    v_requires_exception,
    p_justification,
    'submitted',
    auth.uid()
  ) RETURNING id INTO v_new_req_id;

  RETURN jsonb_build_object(
    'request_id', v_new_req_id,
    'request_number', v_req_num,
    'increase_amount', v_inc_amount,
    'increase_percentage', v_inc_pct,
    'range_validation', v_validation,
    'requires_exception', v_requires_exception
  );
END;
$$;

-- Function 3: Approve & Apply Salary Change Request Atomic
CREATE OR REPLACE FUNCTION public.approve_salary_change_request_atomic(
  p_company_id uuid,
  p_request_id uuid,
  p_apply_immediately boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_cur_pkg RECORD;
  v_new_version integer := 1;
  v_new_pkg_id uuid;
  v_pkg_status text;
BEGIN
  SELECT * INTO v_req
  FROM public.compensation_change_requests
  WHERE id = p_request_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب تعديل الراتب غير موجود.';
  END IF;

  IF v_req.status = 'applied' THEN
    RAISE EXCEPTION 'تم تطبيق هذا الطلب مسبقاً.';
  END IF;

  -- Determine target package status: active if immediate or effective today/past, else scheduled
  IF p_apply_immediately OR v_req.effective_date <= CURRENT_DATE THEN
    v_pkg_status := 'active';
  ELSE
    v_pkg_status := 'scheduled';
  END IF;

  -- Mark existing active package as superseded if new package becomes active immediately
  IF v_pkg_status = 'active' THEN
    UPDATE public.employee_compensation_packages
    SET status = 'superseded', effective_to = v_req.effective_date - interval '1 day', updated_at = now()
    WHERE employee_id = v_req.employee_id AND status = 'active';

    -- Also keep employee master basic salary synchronized
    UPDATE public.employees
    SET basic_salary = v_req.proposed_basic, updated_at = now()
    WHERE id = v_req.employee_id AND company_id = p_company_id;

    -- Synchronize with prompt 14 employee_compensation_versions
    UPDATE public.employee_compensation_versions
    SET status = 'superseded', effective_to = v_req.effective_date
    WHERE employee_id = v_req.employee_id AND company_id = p_company_id AND status = 'approved';

    INSERT INTO public.employee_compensation_versions (
      company_id,
      employee_id,
      version,
      effective_from,
      effective_to,
      basic_salary,
      housing_allowance,
      transport_allowance,
      reason,
      status,
      approved_by,
      approved_at
    ) VALUES (
      p_company_id,
      v_req.employee_id,
      (SELECT COALESCE(MAX(version), 0) + 1 FROM public.employee_compensation_versions WHERE employee_id = v_req.employee_id),
      v_req.effective_date,
      NULL,
      v_req.proposed_basic,
      COALESCE((SELECT housing_allowance FROM public.employees WHERE id = v_req.employee_id), 0),
      COALESCE((SELECT transport_allowance FROM public.employees WHERE id = v_req.employee_id), 0),
      v_req.reason,
      'approved',
      auth.uid(),
      now()
    );
  END IF;

  SELECT COALESCE(MAX(package_version), 0) + 1 INTO v_new_version
  FROM public.employee_compensation_packages
  WHERE employee_id = v_req.employee_id;

  INSERT INTO public.employee_compensation_packages (
    company_id,
    employee_id,
    package_version,
    effective_from,
    currency,
    basic_salary,
    total_gross_salary,
    compa_ratio,
    range_penetration,
    range_status,
    source_event,
    status,
    notes,
    approved_by,
    approved_at,
    created_by
  ) VALUES (
    p_company_id,
    v_req.employee_id,
    v_new_version,
    v_req.effective_date,
    'SAR',
    v_req.proposed_basic,
    v_req.proposed_basic,
    v_req.proposed_compa_ratio,
    v_req.proposed_range_penetration,
    v_req.range_validation,
    v_req.reason,
    v_pkg_status,
    v_req.justification,
    auth.uid(),
    now(),
    auth.uid()
  ) RETURNING id INTO v_new_pkg_id;

  UPDATE public.compensation_change_requests
  SET
    proposed_package_id = v_new_pkg_id,
    status = CASE WHEN v_pkg_status = 'active' THEN 'applied' ELSE 'approved' END,
    approved_by = auth.uid(),
    approved_at = now(),
    applied_at = CASE WHEN v_pkg_status = 'active' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'package_id', v_new_pkg_id,
    'package_status', v_pkg_status,
    'version', v_new_version
  );
END;
$$;

-- Function 4: Launch Compensation Review Cycle Atomic
CREATE OR REPLACE FUNCTION public.launch_compensation_review_cycle_atomic(
  p_company_id uuid,
  p_cycle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cycle RECORD;
  v_emp RECORD;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_cycle FROM public.compensation_review_cycles WHERE id = p_cycle_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'دورة مراجعة الرواتب غير موجودة.';
  END IF;

  -- Freeze population from active employees
  FOR v_emp IN (
    SELECT e.id, e.department_id, e.manager_id, e.basic_salary
    FROM public.employees e
    WHERE e.company_id = p_company_id AND e.status = 'active'
  ) LOOP
    INSERT INTO public.compensation_review_populations (
      cycle_id,
      company_id,
      employee_id,
      department_id,
      manager_id,
      current_basic_salary,
      frozen_at
    ) VALUES (
      p_cycle_id,
      p_company_id,
      v_emp.id,
      v_emp.department_id,
      v_emp.manager_id,
      COALESCE(v_emp.basic_salary, 0),
      now()
    ) ON CONFLICT (cycle_id, employee_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.compensation_review_cycles
  SET
    status = 'open',
    total_eligible_employees = v_count,
    updated_at = now()
  WHERE id = p_cycle_id;

  RETURN jsonb_build_object(
    'cycle_id', p_cycle_id,
    'status', 'open',
    'eligible_count', v_count
  );
END;
$$;

-- Function 5: Calibrate Review Recommendation Atomic
CREATE OR REPLACE FUNCTION public.calibrate_review_recommendation_atomic(
  p_recommendation_id uuid,
  p_calibrated_percentage numeric,
  p_adjustment_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec RECORD;
  v_pop RECORD;
  v_cal_amount numeric;
  v_final_basic numeric;
BEGIN
  SELECT * INTO v_rec FROM public.compensation_review_recommendations WHERE id = p_recommendation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'توصية المراجعة غير موجودة.';
  END IF;

  SELECT * INTO v_pop FROM public.compensation_review_populations WHERE id = v_rec.population_id;
  
  v_cal_amount := ROUND((v_pop.current_basic_salary * (p_calibrated_percentage / 100.0)), 2);
  v_final_basic := v_pop.current_basic_salary + v_cal_amount;

  UPDATE public.compensation_review_recommendations
  SET
    calibrated_increase_percentage = p_calibrated_percentage,
    calibrated_increase_amount = v_cal_amount,
    final_basic_salary = v_final_basic,
    adjustment_reason = p_adjustment_reason,
    calibrated_by = auth.uid(),
    calibrated_at = now(),
    status = 'calibrated',
    updated_at = now()
  WHERE id = p_recommendation_id;

  RETURN jsonb_build_object(
    'recommendation_id', p_recommendation_id,
    'calibrated_percentage', p_calibrated_percentage,
    'calibrated_amount', v_cal_amount,
    'final_basic_salary', v_final_basic
  );
END;
$$;

-- Function 6: Finalize & Apply Compensation Review Cycle Atomic
CREATE OR REPLACE FUNCTION public.finalize_and_apply_compensation_review_atomic(
  p_company_id uuid,
  p_cycle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cycle RECORD;
  v_rec RECORD;
  v_applied_count integer := 0;
  v_total_applied numeric := 0;
  v_new_pkg_id uuid;
  v_ver integer;
BEGIN
  SELECT * INTO v_cycle FROM public.compensation_review_cycles WHERE id = p_cycle_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'دورة المراجعة غير موجودة.';
  END IF;

  IF v_cycle.status = 'applied' THEN
    RAISE EXCEPTION 'تم تطبيق هذه الدورة مسبقاً.';
  END IF;

  FOR v_rec IN (
    SELECT r.*, p.current_basic_salary
    FROM public.compensation_review_recommendations r
    JOIN public.compensation_review_populations p ON p.id = r.population_id
    WHERE r.cycle_id = p_cycle_id AND r.status IN ('approved', 'calibrated')
  ) LOOP
    -- Supersede existing active package
    UPDATE public.employee_compensation_packages
    SET status = 'superseded', effective_to = v_cycle.effective_date - interval '1 day', updated_at = now()
    WHERE employee_id = v_rec.employee_id AND status = 'active';

    SELECT COALESCE(MAX(package_version), 0) + 1 INTO v_ver
    FROM public.employee_compensation_packages
    WHERE employee_id = v_rec.employee_id;

    -- Create new active package version
    INSERT INTO public.employee_compensation_packages (
      company_id,
      employee_id,
      package_version,
      effective_from,
      currency,
      basic_salary,
      total_gross_salary,
      source_event,
      status,
      notes,
      approved_by,
      approved_at,
      created_by
    ) VALUES (
      p_company_id,
      v_rec.employee_id,
      v_ver,
      v_cycle.effective_date,
      v_cycle.currency,
      v_rec.final_basic_salary,
      v_rec.final_basic_salary,
      'annual_review',
      'active',
      'Applied from Annual Compensation Review Cycle ' || v_cycle.cycle_code,
      auth.uid(),
      now(),
      auth.uid()
    );

    -- Update Employee Master
    UPDATE public.employees
    SET basic_salary = v_rec.final_basic_salary, updated_at = now()
    WHERE id = v_rec.employee_id AND company_id = p_company_id;

    v_applied_count := v_applied_count + 1;
    v_total_applied := v_total_applied + (v_rec.final_basic_salary - v_rec.current_basic_salary);
  END LOOP;

  UPDATE public.compensation_review_cycles
  SET
    status = 'applied',
    total_approved_increase = v_total_applied,
    applied_at = now(),
    finalized_at = now(),
    updated_at = now()
  WHERE id = p_cycle_id;

  RETURN jsonb_build_object(
    'cycle_id', p_cycle_id,
    'status', 'applied',
    'applied_employees_count', v_applied_count,
    'total_increase_applied', v_total_applied
  );
END;
$$;

-- Function 7: Enroll Employee Benefit Atomic
CREATE OR REPLACE FUNCTION public.enroll_employee_benefit_atomic(
  p_company_id uuid,
  p_employee_id uuid,
  p_plan_id uuid,
  p_enrollment_type text DEFAULT 'open_enrollment',
  p_effective_from date DEFAULT CURRENT_DATE,
  p_dependent_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan RECORD;
  v_enrollment_id uuid;
  v_dep_id uuid;
BEGIN
  SELECT * INTO v_plan FROM public.benefit_plans WHERE id = p_plan_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'خطة المزايا المحددة غير موجودة.';
  END IF;

  INSERT INTO public.employee_benefit_enrollments (
    company_id,
    employee_id,
    plan_id,
    enrollment_type,
    effective_from,
    employee_cost_monthly,
    employer_cost_monthly,
    status
  ) VALUES (
    p_company_id,
    p_employee_id,
    p_plan_id,
    p_enrollment_type,
    p_effective_from,
    v_plan.employee_monthly_cost,
    v_plan.employer_monthly_cost,
    'enrolled'
  ) RETURNING id INTO v_enrollment_id;

  IF array_length(p_dependent_ids, 1) > 0 THEN
    FOREACH v_dep_id IN ARRAY p_dependent_ids LOOP
      INSERT INTO public.benefit_enrollment_dependents (
        enrollment_id,
        dependent_id,
        additional_cost
      ) VALUES (
        v_enrollment_id,
        v_dep_id,
        0
      ) ON CONFLICT (enrollment_id, dependent_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'enrollment_id', v_enrollment_id,
    'status', 'enrolled',
    'dependents_enrolled', COALESCE(array_length(p_dependent_ids, 1), 0)
  );
END;
$$;

-- Function 8: Generate Total Rewards Statement Snapshot Atomic
CREATE OR REPLACE FUNCTION public.generate_total_rewards_statement_atomic(
  p_company_id uuid,
  p_employee_id uuid,
  p_year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp RECORD;
  v_base_annual numeric := 0;
  v_allow_annual numeric := 0;
  v_var_annual numeric := 0;
  v_benefits_annual numeric := 0;
  v_statutory_annual numeric := 0;
  v_total_employer_val numeric := 0;
  v_snapshot_id uuid;
BEGIN
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف غير موجود.';
  END IF;

  v_base_annual := COALESCE(v_emp.basic_salary, 0) * 12;
  v_allow_annual := (COALESCE(v_emp.housing_allowance, 0) + COALESCE(v_emp.transport_allowance, 0)) * 12;

  -- Variable pay awards for year
  SELECT COALESCE(SUM(final_award_amount), 0) INTO v_var_annual
  FROM public.variable_pay_awards a
  JOIN public.variable_pay_cycles c ON c.id = a.cycle_id
  WHERE a.employee_id = p_employee_id AND c.year_val = p_year AND a.status = 'approved';

  -- Employer benefit costs for year
  SELECT COALESCE(SUM(employer_cost_monthly), 0) * 12 INTO v_benefits_annual
  FROM public.employee_benefit_enrollments
  WHERE employee_id = p_employee_id AND status = 'enrolled';

  -- Estimated GOSI / statutory contribution (approx 10-12% employer side)
  v_statutory_annual := ROUND((v_base_annual + v_allow_annual) * 0.10, 2);

  v_total_employer_val := v_base_annual + v_allow_annual + v_var_annual + v_benefits_annual + v_statutory_annual;

  INSERT INTO public.total_rewards_snapshots (
    company_id,
    employee_id,
    year_val,
    currency,
    base_salary_annual,
    fixed_allowances_annual,
    variable_pay_annual,
    employer_benefits_annual,
    employer_statutory_annual,
    total_employer_value_annual,
    breakdown_json
  ) VALUES (
    p_company_id,
    p_employee_id,
    p_year,
    'SAR',
    v_base_annual,
    v_allow_annual,
    v_var_annual,
    v_benefits_annual,
    v_statutory_annual,
    v_total_employer_val,
    jsonb_build_object(
      'base_salary_monthly', COALESCE(v_emp.basic_salary, 0),
      'housing_monthly', COALESCE(v_emp.housing_allowance, 0),
      'transport_monthly', COALESCE(v_emp.transport_allowance, 0),
      'statutory_rate_pct', 10.0
    )
  )
  ON CONFLICT (company_id, employee_id, year_val)
  DO UPDATE SET
    base_salary_annual = EXCLUDED.base_salary_annual,
    fixed_allowances_annual = EXCLUDED.fixed_allowances_annual,
    variable_pay_annual = EXCLUDED.variable_pay_annual,
    employer_benefits_annual = EXCLUDED.employer_benefits_annual,
    employer_statutory_annual = EXCLUDED.employer_statutory_annual,
    total_employer_value_annual = EXCLUDED.total_employer_value_annual,
    breakdown_json = EXCLUDED.breakdown_json
  RETURNING id INTO v_snapshot_id;

  RETURN jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'total_employer_value_annual', v_total_employer_val,
    'base_salary_annual', v_base_annual,
    'benefits_annual', v_benefits_annual
  );
END;
$$;

-- Function 9: Compensation Dashboard Live KPIs Atomic
CREATE OR REPLACE FUNCTION public.get_compensation_dashboard_kpis_atomic(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_base numeric := 0;
  v_avg_salary numeric := 0;
  v_total_employees integer := 0;
  v_below_range integer := 0;
  v_above_range integer := 0;
  v_avg_compa numeric := 100.00;
  v_active_enrollments integer := 0;
  v_active_plans integer := 0;
  v_open_requests integer := 0;
BEGIN
  SELECT
    COALESCE(SUM(basic_salary), 0),
    COALESCE(AVG(basic_salary), 0),
    COUNT(*)
  INTO v_total_base, v_avg_salary, v_total_employees
  FROM public.employees
  WHERE company_id = p_company_id AND status = 'active';

  SELECT
    COUNT(*) FILTER (WHERE range_status = 'below_minimum'),
    COUNT(*) FILTER (WHERE range_status = 'above_maximum'),
    COALESCE(AVG(compa_ratio) FILTER (WHERE compa_ratio IS NOT NULL), 100.00)
  INTO v_below_range, v_above_range, v_avg_compa
  FROM public.employee_compensation_packages
  WHERE company_id = p_company_id AND status = 'active';

  SELECT COUNT(*) INTO v_active_enrollments
  FROM public.employee_benefit_enrollments
  WHERE company_id = p_company_id AND status = 'enrolled';

  SELECT COUNT(*) INTO v_active_plans
  FROM public.benefit_plans
  WHERE company_id = p_company_id AND status = 'active';

  SELECT COUNT(*) INTO v_open_requests
  FROM public.compensation_change_requests
  WHERE company_id = p_company_id AND status IN ('submitted', 'in_review');

  RETURN jsonb_build_object(
    'total_base_payroll', ROUND(v_total_base, 2),
    'average_salary', ROUND(v_avg_salary, 2),
    'total_active_employees', v_total_employees,
    'below_range_count', v_below_range,
    'above_range_count', v_above_range,
    'average_compa_ratio', ROUND(v_avg_compa, 2),
    'active_benefit_enrollments', v_active_enrollments,
    'active_benefit_plans', v_active_plans,
    'open_change_requests', v_open_requests
  );
END;
$$;

-- Grant EXECUTE to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_comp_reference_number(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_salary_change_request_atomic(uuid, uuid, text, date, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_salary_change_request_atomic(uuid, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.launch_compensation_review_cycle_atomic(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calibrate_review_recommendation_atomic(uuid, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_and_apply_compensation_review_atomic(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enroll_employee_benefit_atomic(uuid, uuid, uuid, text, date, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_total_rewards_statement_atomic(uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_compensation_dashboard_kpis_atomic(uuid) TO authenticated, service_role;
