import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "../../integrations/supabase/client";
import type { Database } from "../../integrations/supabase/types";

type EnterpriseTable<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface CompanyRow extends Record<string, unknown> {
  id: string;
  legal_name_ar: string;
  legal_name_en: string;
  cr_number: string | null;
  tax_number: string | null;
  currency: string;
  timezone: string;
  headquarters_address: string | null;
  created_at: string;
}
export interface SubsidiaryRow extends Record<string, unknown> {
  id: string;
  company_id: string | null;
  name_ar: string;
  name_en: string;
  code: string;
  cr_number: string | null;
  manager_employee_id: string | null;
  status: string;
  created_at: string;
}
export interface WorkLocationRow extends Record<string, unknown> {
  id: string;
  company_id: string | null;
  name_ar: string;
  name_en: string;
  code: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  default_shift_id: string | null;
  status: string;
  created_at: string;
}
export interface RoleDefinitionRow extends Record<string, unknown> {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  is_system: boolean;
  data_scope: string;
  created_at: string;
}
export interface ApprovalChainRow extends Record<string, unknown> {
  id: string;
  request_type: string;
  name_ar: string;
  name_en: string;
  scope_type: string;
  scope_values: unknown;
  steps: unknown;
  is_default: boolean;
  status: string;
  created_at: string;
}
export interface DepartmentRow extends Record<string, unknown> {
  id: string;
  company_id: string | null;
  parent_id: string | null;
  name: string;
  name_en: string | null;
  code: string;
  unit_type: string;
  manager_employee_id: string | null;
  status: string;
  created_at: string;
}
export interface EmployeeExtendedRow extends Record<string, unknown> {
  id: string;
  user_id: string | null;
  employee_no: string;
  full_name: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  first_name_en: string | null;
  last_name_en: string | null;
  email: string | null;
  personal_email: string | null;
  phone: string | null;
  national_id_or_iqama: string | null;
  nationality: string | null;
  gender: string | null;
  birth_date: string | null;
  marital_status: string | null;
  company_id: string | null;
  subsidiary_id: string | null;
  department_id: string | null;
  job_title: string;
  manager_id: string | null;
  work_location_id: string | null;
  hire_date: string;
  contract_type: string;
  probation_end_date: string | null;
  status: string;
  basic_salary: number;
  total_salary: number;
  completion_score: number;
  metadata: unknown;
  created_at: string;
}
export interface RequestExtendedRow extends Record<string, unknown> {
  id: string;
  reference: string;
  employee_id: string;
  type: "leave" | "attendance_fix" | "advance" | "expense";
  status: "draft" | "pending" | "approved" | "rejected" | "returned";
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  amount: number | null;
  reason: string | null;
  created_by: string | null;
  decided_by: string | null;
  decision_note: string | null;
  decided_at: string | null;
  current_step_index: number;
  total_steps: number;
  current_approver_role: string | null;
  created_at: string;
}

export interface LeaveTypeRow extends Record<string, unknown> {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  color: string | null;
  is_paid: boolean | null;
  deduct_working_days_only: boolean | null;
  max_days_per_year: number | null;
  allow_half_day: boolean | null;
  accrual_method: string | null;
  status: string | null;
  created_at: string;
}
export interface LeaveBalanceRow extends Record<string, unknown> {
  id: string;
  employee_id: string;
  leave_type_id: string;
  annual_entitlement: number;
  accrued_days: number;
  used_days: number;
  reserved_days: number;
  carried_over_days: number;
  updated_at: string;
}
export interface ShiftRow extends Record<string, unknown> {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  color: string | null;
  type: string;
  start_time: string;
  end_time: string;
  grace_minutes_arrival: number | null;
  grace_minutes_departure: number | null;
  overtime_eligible: boolean | null;
  flexible_hours: number | null;
  split_second_start_time: string | null;
  split_second_end_time: string | null;
  allow_single_punch: boolean;
  created_at: string;
}
export interface PayrollGroupRow extends Record<string, unknown> {
  id: string;
  name_ar: string;
  name_en: string;
  calculation_basis: string;
  cutoff_day: number;
  payday: number;
  currency: string;
  created_at: string;
}
export interface PayrollRunRow extends Record<string, unknown> {
  id: string;
  payroll_group_id: string | null;
  period_year: number;
  period_month: number;
  status: string;
  total_employees: number;
  total_basic_salary: number;
  total_allowances: number;
  total_overtime_amount: number;
  total_deductions: number;
  total_net_salary: number;
  total_employer_gosi: number;
  locked_at: string | null;
  paid_at: string | null;
  created_at: string;
}
export interface PayrollDetailRow extends Record<string, unknown> {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  overtime_hours: number;
  overtime_amount: number;
  bonus_amount: number;
  unpaid_leave_deduction: number;
  absence_late_deduction: number;
  loan_deduction: number;
  gosi_employee_deduction: number;
  other_deductions: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  notes: string | null;
}
export interface LoanRow extends Record<string, unknown> {
  id: string;
  employee_id: string;
  loan_type: string;
  principal_amount: number;
  monthly_installment: number;
  total_installments: number;
  paid_installments: number;
  remaining_balance: number;
  status: string;
  created_at: string;
}
export interface SettlementRow extends Record<string, unknown> {
  id: string;
  employee_id: string;
  termination_date: string;
  service_years: number;
  service_months: number;
  eosb_amount: number;
  leave_payout_amount: number;
  net_settlement_amount: number;
  status: string;
  created_at: string;
}
export interface ExpenseCategoryRow extends Record<string, unknown> {
  id: string;
  name_ar: string;
  name_en: string;
  max_limit_warning: number;
  max_limit_block: number;
  requires_receipt: boolean | null;
  created_at: string;
}
export interface ExpenseClaimRow extends Record<string, unknown> {
  id: string;
  report_id: string | null;
  employee_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  spent_at: string;
  merchant_name: string;
  receipt_url: string | null;
  description: string | null;
  status: string;
  policy_warning_triggered: boolean;
  created_at: string;
}
export interface PerformanceCycleRow extends Record<string, unknown> {
  id: string;
  title_ar: string;
  title_en: string;
  period_type: string;
  start_date: string;
  end_date: string;
  status: string;
  participants_count: number;
  completion_rate: number;
  created_at: string;
}
export interface EvaluationRow extends Record<string, unknown> {
  id: string;
  cycle_id: string;
  employee_id: string;
  evaluator_employee_id: string | null;
  evaluation_type: string;
  competency_scores: unknown;
  overall_score: number | null;
  notes: string | null;
  status: string;
  submitted_at: string | null;
}
export interface WorkforcePlanRow extends Record<string, unknown> {
  id: string;
  title_ar: string;
  title_en: string;
  plan_year: number;
  department_id: string | null;
  current_headcount: number;
  planned_hires: number;
  planned_exits: number;
  target_headcount: number;
  current_budget: number;
  projected_cost: number;
  status: string;
  created_at: string;
}
export interface JobOpeningRow extends Record<string, unknown> {
  id: string;
  title_ar: string;
  title_en: string;
  department_id: string | null;
  openings_count: number;
  filled_count: number;
  salary_min: number | null;
  salary_max: number | null;
  description_ar: string | null;
  location_id: string | null;
  employment_type: string;
  description_en: string | null;
  requirements_ar: string | null;
  requirements_en: string | null;
  published_at: string | null;
  published_status: string;
  created_at: string;
}
export interface CandidateRow extends Record<string, unknown> {
  id: string;
  job_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  stage: string;
  rating_score: number | null;
  source: string | null;
  cv_url: string | null;
  notes_count: number;
  created_at: string;
}
export interface JobOfferRow extends Record<string, unknown> {
  id: string;
  candidate_id: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  proposed_start_date: string;
  status: string;
  created_at: string;
}
export interface HardwareAssetRow extends Record<string, unknown> {
  id: string;
  asset_tag: string;
  name_ar: string;
  name_en: string;
  category: string;
  serial_number: string;
  assigned_to_employee_id: string | null;
  assigned_date: string | null;
  status: string;
  created_at: string;
}
export interface CompanyDocumentRow extends Record<string, unknown> {
  id: string;
  title_ar: string;
  title_en: string;
  category: string;
  version: string;
  file_url: string;
  expiry_date: string | null;
  visibility_scope: string;
  requires_acknowledgment: boolean;
  acknowledged_count: number;
  created_at: string;
}
export interface AssetAssignmentRow extends Record<string, unknown> {
  id: string;
  asset_id: string;
  employee_id: string;
  assigned_at: string;
  returned_at: string | null;
  condition_on_assign: string | null;
  condition_on_return: string | null;
  assigned_by: string | null;
}
export interface DocumentAcknowledgementRow extends Record<string, unknown> {
  id: string;
  document_id: string;
  employee_id: string;
  acknowledged_at: string;
}
export interface RequestTimelineRow extends Record<string, unknown> {
  id: string;
  request_id: string;
  step_number: number;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  note: string | null;
  created_at: string;
}
export interface AuditEventRow extends Record<string, unknown> {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  changes_summary: string | null;
  created_at: string;
}
export interface NotificationRow extends Record<string, unknown> {
  id: string;
  recipient_id: string;
  title_ar: string;
  title_en: string;
  message_ar: string;
  message_en: string;
  type: string;
  is_read: boolean;
  created_at: string;
}
export interface AccountingJournalRow extends Record<string, unknown> {
  id: string;
  journal_no: string;
  source_type: string;
  source_reference: string;
  journal_date: string;
  total_debit: number;
  total_credit: number;
  status: string;
  erp_integration_type: string | null;
  created_at: string;
}

type EnterpriseDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "departments" | "employees" | "requests"> & {
      departments: EnterpriseTable<DepartmentRow>;
      employees: EnterpriseTable<EmployeeExtendedRow>;
      requests: EnterpriseTable<RequestExtendedRow>;
      companies: EnterpriseTable<CompanyRow>;
      subsidiaries: EnterpriseTable<SubsidiaryRow>;
      work_locations: EnterpriseTable<WorkLocationRow>;
      role_definitions: EnterpriseTable<RoleDefinitionRow>;
      approval_chains: EnterpriseTable<ApprovalChainRow>;
      request_timeline: EnterpriseTable<RequestTimelineRow>;
      leave_types: EnterpriseTable<LeaveTypeRow>;
      leave_balances: EnterpriseTable<LeaveBalanceRow>;
      shifts: EnterpriseTable<ShiftRow>;
      payroll_groups: EnterpriseTable<PayrollGroupRow>;
      payroll_runs: EnterpriseTable<PayrollRunRow>;
      payroll_details: EnterpriseTable<PayrollDetailRow>;
      loans: EnterpriseTable<LoanRow>;
      settlements: EnterpriseTable<SettlementRow>;
      expense_categories: EnterpriseTable<ExpenseCategoryRow>;
      expense_claims: EnterpriseTable<ExpenseClaimRow>;
      performance_cycles: EnterpriseTable<PerformanceCycleRow>;
      evaluation_records: EnterpriseTable<EvaluationRow>;
      workforce_plans: EnterpriseTable<WorkforcePlanRow>;
      job_openings: EnterpriseTable<JobOpeningRow>;
      candidates: EnterpriseTable<CandidateRow>;
      job_offers: EnterpriseTable<JobOfferRow>;
      hardware_assets: EnterpriseTable<HardwareAssetRow>;
      company_documents: EnterpriseTable<CompanyDocumentRow>;
      asset_assignments: EnterpriseTable<AssetAssignmentRow>;
      document_acknowledgements: EnterpriseTable<DocumentAcknowledgementRow>;
      audit_events: EnterpriseTable<AuditEventRow>;
      notifications_inbox: EnterpriseTable<NotificationRow>;
      accounting_journals: EnterpriseTable<AccountingJournalRow>;
    };
  };
};

export const enterpriseSupabase = supabase as unknown as SupabaseClient<EnterpriseDatabase>;
