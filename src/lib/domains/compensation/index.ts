/**
 * ============================================================================
 * PROMPT 33: COMPENSATION & BENEFITS, SALARY STRUCTURES,
 * ALLOWANCES, TOTAL REWARDS & BENEFITS DOMAIN
 * ============================================================================
 */

export type CompensationComponentType =
  | "basic_salary"
  | "fixed_allowance"
  | "variable_allowance"
  | "recurring_earning"
  | "non_recurring_earning"
  | "bonus"
  | "commission"
  | "benefit"
  | "employer_contribution"
  | "employee_deduction_reference"
  | "non_cash_benefit";

export type CalculationMethod =
  | "fixed"
  | "percentage_of_basic"
  | "percentage_of_component"
  | "configured_formula";

export type SalaryChangeReason =
  | "promotion"
  | "merit"
  | "market_adjustment"
  | "annual_review"
  | "probation_confirmation"
  | "retention_adjustment"
  | "transfer"
  | "correction"
  | "contract_renewal"
  | "other";

export type SalaryRangeStatus =
  | "below_minimum"
  | "within_range"
  | "above_maximum"
  | "not_applicable";

export type PackageStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "active"
  | "superseded"
  | "cancelled";

export type ReviewCycleStatus =
  | "draft"
  | "planning"
  | "open"
  | "manager_review"
  | "hr_review"
  | "calibration"
  | "approved"
  | "finalized"
  | "applied"
  | "closed";

export type BenefitCategoryCode =
  | "medical"
  | "life_insurance"
  | "transport"
  | "meal"
  | "mobile"
  | "vehicle"
  | "housing"
  | "education"
  | "wellness"
  | "retirement_pension"
  | "other";

export type EnrollmentStatus =
  | "eligible"
  | "pending"
  | "enrolled"
  | "waived"
  | "rejected"
  | "terminated"
  | "expired";

export type VariablePlanType =
  | "annual_bonus"
  | "performance_bonus"
  | "sales_commission"
  | "project_incentive"
  | "company_bonus"
  | "retention_bonus";

// ============================================================================
// DOMAIN INTERFACES
// ============================================================================

export interface CompensationComponent {
  id: string;
  company_id: string;
  code: string;
  name_ar: string;
  name_en: string;
  component_type: CompensationComponentType;
  calculation_method: CalculationMethod;
  base_component_id?: string | null;
  default_amount: number;
  default_percentage?: number | null;
  currency: string;
  is_taxable: boolean;
  is_statutory_insurable: boolean;
  is_recurring: boolean;
  payroll_mapping_code?: string | null;
  proration_rule: "calendar_days" | "working_days" | "none";
  effective_from: string;
  effective_to?: string | null;
  status: "active" | "inactive" | "archived";
}

export interface SalaryPayGrade {
  id: string;
  company_id: string;
  code: string;
  name_ar: string;
  name_en: string;
  grade_level: number;
  career_track: "executive" | "management" | "professional" | "technical" | "operational";
  description?: string | null;
  status: "active" | "inactive";
}

export interface SalaryRange {
  id: string;
  company_id: string;
  salary_structure_id?: string | null;
  pay_grade_id: string;
  currency: string;
  minimum_salary: number;
  midpoint_salary: number;
  maximum_salary: number;
  spread_percentage?: number;
  effective_from: string;
  effective_to?: string | null;
  status: "active" | "archived";
  pay_grade?: SalaryPayGrade;
}

export interface EmployeeCompensationPackage {
  id: string;
  company_id: string;
  employee_id: string;
  salary_structure_id?: string | null;
  pay_grade_id?: string | null;
  package_version: number;
  effective_from: string;
  effective_to?: string | null;
  currency: string;
  basic_salary: number;
  total_fixed_allowances: number;
  total_gross_salary: number;
  annual_target_variable: number;
  total_employer_cost: number;
  compa_ratio?: number | null;
  range_penetration?: number | null;
  range_status: SalaryRangeStatus;
  source_event: string;
  status: PackageStatus;
  notes?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  employee_name_ar?: string;
  employee_name_en?: string;
  employee_number?: string;
}

export interface CompensationChangeRequest {
  id: string;
  company_id: string;
  request_number: string;
  employee_id: string;
  reason: SalaryChangeReason;
  effective_date: string;
  current_package_id?: string | null;
  proposed_package_id?: string | null;
  current_basic: number;
  proposed_basic: number;
  increase_amount: number;
  increase_percentage: number;
  current_compa_ratio?: number | null;
  proposed_compa_ratio?: number | null;
  current_range_penetration?: number | null;
  proposed_range_penetration?: number | null;
  range_validation: SalaryRangeStatus;
  requires_exception_approval: boolean;
  justification?: string | null;
  status: "draft" | "submitted" | "in_review" | "approved" | "rejected" | "applied" | "cancelled";
  requested_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  applied_at?: string | null;
  created_at: string;
  employee_name_ar?: string;
  employee_name_en?: string;
  employee_number?: string;
}

export interface CompensationReviewCycle {
  id: string;
  company_id: string;
  cycle_code: string;
  name_ar: string;
  name_en: string;
  year_val: number;
  effective_date: string;
  review_start_date: string;
  review_end_date: string;
  merit_matrix_id?: string | null;
  allocated_budget: number;
  currency: string;
  budget_enforcement: "warn" | "hard_block" | "none";
  status: ReviewCycleStatus;
  total_eligible_employees: number;
  total_proposed_increase: number;
  total_approved_increase: number;
  created_at: string;
}

export interface CompensationReviewPopulation {
  id: string;
  cycle_id: string;
  company_id: string;
  employee_id: string;
  department_id?: string | null;
  manager_id?: string | null;
  pay_grade_id?: string | null;
  current_basic_salary: number;
  current_compa_ratio?: number | null;
  performance_rating?: number | null;
  frozen_at: string;
  employee_name_ar?: string;
  employee_number?: string;
  department_name?: string;
}

export interface CompensationReviewRecommendation {
  id: string;
  cycle_id: string;
  population_id: string;
  employee_id: string;
  manager_id?: string | null;
  original_increase_percentage: number;
  original_increase_amount: number;
  calibrated_increase_percentage?: number | null;
  calibrated_increase_amount?: number | null;
  adjustment_reason?: string | null;
  final_basic_salary: number;
  status: "draft" | "submitted" | "calibrated" | "approved" | "rejected";
  created_at: string;
  employee_name_ar?: string;
  employee_number?: string;
}

export interface BenefitCategory {
  id: string;
  code: BenefitCategoryCode;
  name_ar: string;
  name_en: string;
  icon_name: string;
  is_taxable: boolean;
  display_order: number;
}

export interface BenefitProvider {
  id: string;
  company_id: string;
  code: string;
  name_ar: string;
  name_en: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "active" | "inactive";
}

export interface BenefitPlan {
  id: string;
  company_id: string;
  category_id: string;
  provider_id?: string | null;
  code: string;
  name_ar: string;
  name_en: string;
  coverage_description?: string | null;
  tier_level: "vip" | "executive" | "gold" | "silver" | "standard" | "basic";
  employee_monthly_cost: number;
  employer_monthly_cost: number;
  currency: string;
  dependent_coverage_allowed: boolean;
  max_dependents: number;
  status: "active" | "inactive" | "archived";
  category?: BenefitCategory;
  provider?: BenefitProvider;
}

export interface EmployeeDependent {
  id: string;
  company_id: string;
  employee_id: string;
  full_name_ar: string;
  full_name_en?: string | null;
  relationship: "spouse" | "child" | "parent" | "other";
  national_id_or_iqama?: string | null;
  birth_date: string;
  gender: "male" | "female";
  is_eligible_for_benefits: boolean;
}

export interface EmployeeBenefitEnrollment {
  id: string;
  company_id: string;
  employee_id: string;
  plan_id: string;
  enrollment_type: "open_enrollment" | "new_hire" | "life_event" | "administrative_addition";
  effective_from: string;
  effective_to?: string | null;
  employee_cost_monthly: number;
  employer_cost_monthly: number;
  status: EnrollmentStatus;
  notes?: string | null;
  plan?: BenefitPlan;
  employee_name_ar?: string;
  employee_number?: string;
}

export interface TotalRewardsSnapshot {
  id: string;
  company_id: string;
  employee_id: string;
  year_val: number;
  snapshot_date: string;
  currency: string;
  base_salary_annual: number;
  fixed_allowances_annual: number;
  variable_pay_annual: number;
  employer_benefits_annual: number;
  employer_statutory_annual: number;
  total_employer_value_annual: number;
  breakdown_json?: {
    base_salary_monthly?: number;
    housing_monthly?: number;
    transport_monthly?: number;
    statutory_rate_pct?: number;
  };
}

export interface CompensationDashboardKPIs {
  total_base_payroll: number;
  average_salary: number;
  total_active_employees: number;
  below_range_count: number;
  above_range_count: number;
  average_compa_ratio: number;
  active_benefit_enrollments: number;
  active_benefit_plans: number;
  open_change_requests: number;
}

// ============================================================================
// PURE DOMAIN LOGIC & FINANCIAL CALCULATORS
// ============================================================================

/**
 * Calculates Compa-Ratio = (Basic Salary / Midpoint) * 100
 */
export function calculateCompaRatio(salary: number, midpoint: number): number | null {
  if (!midpoint || midpoint <= 0 || !salary || salary < 0) return null;
  return Math.round((salary / midpoint) * 10000) / 100;
}

/**
 * Calculates Range Penetration = ((Salary - Min) / (Max - Min)) * 100
 */
export function calculateRangePenetration(salary: number, min: number, max: number): number | null {
  if (min == null || max == null || max <= min || salary == null) return null;
  const penetration = ((salary - min) / (max - min)) * 100;
  return Math.round(penetration * 100) / 100;
}

/**
 * Evaluates position against a salary range
 */
export function evaluateSalaryRangePosition(salary: number, min: number, max: number): SalaryRangeStatus {
  if (min == null || max == null || salary == null) return "not_applicable";
  if (salary < min) return "below_minimum";
  if (salary > max) return "above_maximum";
  return "within_range";
}

/**
 * Merit Matrix Guideline Recommendation
 * Looks up recommended increase % based on performance score (1-5) and compa-ratio %
 */
export function calculateMeritIncrease(
  currentSalary: number,
  performanceRating: number,
  compaRatio: number
): { percentage: number; amount: number } {
  if (!currentSalary || currentSalary <= 0) {
    return { percentage: 0, amount: 0 };
  }

  // Base guidelines matrix
  let basePct = 0;
  if (performanceRating >= 4.5) {
    // Top Performer
    basePct = compaRatio < 90 ? 8.5 : compaRatio <= 110 ? 6.5 : 4.5;
  } else if (performanceRating >= 3.5) {
    // Exceeds / Solid Performer
    basePct = compaRatio < 90 ? 6.0 : compaRatio <= 110 ? 4.5 : 3.0;
  } else if (performanceRating >= 2.5) {
    // Meets Expectations
    basePct = compaRatio < 90 ? 4.0 : compaRatio <= 110 ? 3.0 : 1.5;
  } else {
    // Needs Improvement
    basePct = 0;
  }

  const amount = Math.round(((currentSalary * basePct) / 100) * 100) / 100;
  return { percentage: basePct, amount };
}

/**
 * Computes Annual Total Employer Value
 */
export function calculateAnnualTotalRewards(
  baseMonthly: number,
  fixedAllowancesMonthly: number,
  annualVariable: number,
  employerBenefitsMonthly: number,
  statutoryRatePct: number = 10
): {
  baseAnnual: number;
  allowancesAnnual: number;
  variableAnnual: number;
  benefitsAnnual: number;
  statutoryAnnual: number;
  totalEmployerValue: number;
} {
  const baseAnnual = (baseMonthly || 0) * 12;
  const allowancesAnnual = (fixedAllowancesMonthly || 0) * 12;
  const variableAnnual = annualVariable || 0;
  const benefitsAnnual = (employerBenefitsMonthly || 0) * 12;
  const statutoryAnnual = Math.round(((baseAnnual + allowancesAnnual) * (statutoryRatePct / 100)) * 100) / 100;
  const totalEmployerValue =
    baseAnnual + allowancesAnnual + variableAnnual + benefitsAnnual + statutoryAnnual;

  return {
    baseAnnual,
    allowancesAnnual,
    variableAnnual,
    benefitsAnnual,
    statutoryAnnual,
    totalEmployerValue,
  };
}

// ============================================================================
// LOCALIZATION & DISPLAY LABELS
// ============================================================================

export const REASON_LABELS_AR: Record<SalaryChangeReason, string> = {
  promotion: "ترقية وظيفية",
  merit: "زيادة استحقاق وجدارة",
  market_adjustment: "تعديل سوقي وتنافسي",
  annual_review: "مراجعة دورية سنوية",
  probation_confirmation: "تثبيت بعد فترة التجربة",
  retention_adjustment: "مكافأة استبقاء كفاءة",
  transfer: "نقل وظيفي داخلي",
  correction: "تصحيح خطأ إداري",
  contract_renewal: "تجديد وتعديل عقد",
  other: "سبب إداري آخر",
};

export const RANGE_STATUS_LABELS_AR: Record<SalaryRangeStatus, { label: string; color: string }> = {
  below_minimum: { label: "أقل من الحد الأدنى", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  within_range: { label: "ضمن النطاق المعتمد", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  above_maximum: { label: "يتجاوز الحد الأقصى", color: "text-rose-600 bg-rose-500/10 border-rose-500/20" },
  not_applicable: { label: "غير محدد بنطاق", color: "text-slate-600 bg-slate-500/10 border-slate-500/20" },
};

export const REVIEW_CYCLE_STATUS_LABELS_AR: Record<ReviewCycleStatus, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "text-slate-600 bg-slate-500/10" },
  planning: { label: "تخطيط الميزانية", color: "text-indigo-600 bg-indigo-500/10" },
  open: { label: "مفتوحة للمراجعة", color: "text-blue-600 bg-blue-500/10" },
  manager_review: { label: "مراجعة المدراء", color: "text-cyan-600 bg-cyan-500/10" },
  hr_review: { label: "مراجعة الموارد البشرية", color: "text-amber-600 bg-amber-500/10" },
  calibration: { label: "معايرة الزيادات", color: "text-purple-600 bg-purple-500/10" },
  approved: { label: "معتمدة", color: "text-emerald-600 bg-emerald-500/10" },
  finalized: { label: "نهائية ومغلقة", color: "text-teal-600 bg-teal-500/10" },
  applied: { label: "مطبقة في الرواتب", color: "text-green-700 bg-green-500/20" },
  closed: { label: "مؤرشفة", color: "text-muted-foreground bg-muted" },
};
