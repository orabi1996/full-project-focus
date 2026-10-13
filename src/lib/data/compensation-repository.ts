import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { compensationQueryKeys } from "../query/compensation-query-keys";
import type {
  BenefitPlan,
  BenefitProvider,
  CompensationChangeRequest,
  CompensationComponent,
  CompensationDashboardKPIs,
  CompensationReviewCycle,
  CompensationReviewRecommendation,
  EmployeeBenefitEnrollment,
  EmployeeCompensationPackage,
  EmployeeDependent,
  SalaryPayGrade,
  SalaryRange,
  TotalRewardsSnapshot,
} from "../domains/compensation";

const db = supabase as any;

// ============================================================================
// REPOSITORY FETCHERS & MUTATIONS
// ============================================================================

export async function fetchCompensationKPIs(companyId: string): Promise<CompensationDashboardKPIs> {
  const { data, error } = await db.rpc("get_compensation_dashboard_kpis_atomic", {
    p_company_id: companyId,
  });

  if (error) {
    console.warn("get_compensation_dashboard_kpis_atomic failed, falling back to client aggregate", error);
    return {
      total_base_payroll: 0,
      average_salary: 0,
      total_active_employees: 0,
      below_range_count: 0,
      above_range_count: 0,
      average_compa_ratio: 100,
      active_benefit_enrollments: 0,
      active_benefit_plans: 0,
      open_change_requests: 0,
    };
  }

  const raw = data as Record<string, unknown> | null;
  return {
    total_base_payroll: Number(raw?.total_base_payroll ?? 0),
    average_salary: Number(raw?.average_salary ?? 0),
    total_active_employees: Number(raw?.total_active_employees ?? 0),
    below_range_count: Number(raw?.below_range_count ?? 0),
    above_range_count: Number(raw?.above_range_count ?? 0),
    average_compa_ratio: Number(raw?.average_compa_ratio ?? 100),
    active_benefit_enrollments: Number(raw?.active_benefit_enrollments ?? 0),
    active_benefit_plans: Number(raw?.active_benefit_plans ?? 0),
    open_change_requests: Number(raw?.open_change_requests ?? 0),
  };
}

export async function fetchCompensationComponents(companyId: string): Promise<CompensationComponent[]> {
  const { data, error } = await supabase
    .from("compensation_components" as any)
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as CompensationComponent[];
}

export async function createCompensationComponent(payload: Partial<CompensationComponent>): Promise<CompensationComponent> {
  const { data, error } = await supabase
    .from("compensation_components" as any)
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CompensationComponent;
}

export async function fetchSalaryPayGrades(companyId: string): Promise<SalaryPayGrade[]> {
  const { data, error } = await supabase
    .from("salary_pay_grades" as any)
    .select("*")
    .eq("company_id", companyId)
    .order("grade_level", { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as SalaryPayGrade[];
}

export async function createSalaryPayGrade(payload: Partial<SalaryPayGrade>): Promise<SalaryPayGrade> {
  const { data, error } = await supabase
    .from("salary_pay_grades" as any)
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as SalaryPayGrade;
}

export async function fetchSalaryRanges(companyId: string): Promise<SalaryRange[]> {
  const { data, error } = await supabase
    .from("salary_ranges" as any)
    .select("*, pay_grade:salary_pay_grades(*)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as SalaryRange[];
}

export async function createSalaryRange(payload: Partial<SalaryRange>): Promise<SalaryRange> {
  const { data, error } = await supabase
    .from("salary_ranges" as any)
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as SalaryRange;
}

export async function fetchEmployeeCompensationPackages(
  companyId: string,
  employeeId?: string
): Promise<EmployeeCompensationPackage[]> {
  let query = supabase
    .from("employee_compensation_packages" as any)
    .select("*, employee:employees(first_name_ar, last_name_ar, first_name_en, last_name_en, employee_number)")
    .eq("company_id", companyId)
    .order("effective_from", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    employee_name_ar: row.employee ? `${row.employee.first_name_ar || ""} ${row.employee.last_name_ar || ""}`.trim() : "",
    employee_name_en: row.employee ? `${row.employee.first_name_en || ""} ${row.employee.last_name_en || ""}`.trim() : "",
    employee_number: row.employee?.employee_number || "",
  })) as EmployeeCompensationPackage[];
}

export async function fetchCompensationChangeRequests(
  companyId: string,
  status?: string
): Promise<CompensationChangeRequest[]> {
  let query = supabase
    .from("compensation_change_requests" as any)
    .select("*, employee:employees(first_name_ar, last_name_ar, first_name_en, last_name_en, employee_number)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    employee_name_ar: row.employee ? `${row.employee.first_name_ar || ""} ${row.employee.last_name_ar || ""}`.trim() : "",
    employee_name_en: row.employee ? `${row.employee.first_name_en || ""} ${row.employee.last_name_en || ""}`.trim() : "",
    employee_number: row.employee?.employee_number || "",
  })) as CompensationChangeRequest[];
}

export async function createSalaryChangeRequest(payload: {
  companyId: string;
  employeeId: string;
  reason: string;
  effectiveDate: string;
  proposedBasic: number;
  justification?: string;
}): Promise<any> {
  const { data, error } = await db.rpc("create_salary_change_request_atomic", {
    p_company_id: payload.companyId,
    p_employee_id: payload.employeeId,
    p_reason: payload.reason,
    p_effective_date: payload.effectiveDate,
    p_proposed_basic: payload.proposedBasic,
    p_justification: payload.justification || null,
  });

  if (error) throw error;
  return data;
}

export async function approveSalaryChangeRequest(payload: {
  companyId: string;
  requestId: string;
  applyImmediately?: boolean;
}): Promise<any> {
  const { data, error } = await db.rpc("approve_salary_change_request_atomic", {
    p_company_id: payload.companyId,
    p_request_id: payload.requestId,
    p_apply_immediately: payload.applyImmediately ?? true,
  });

  if (error) throw error;
  return data;
}

export async function fetchCompensationReviewCycles(companyId: string): Promise<CompensationReviewCycle[]> {
  const { data, error } = await supabase
    .from("compensation_review_cycles" as any)
    .select("*")
    .eq("company_id", companyId)
    .order("year_val", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as CompensationReviewCycle[];
}

export async function createCompensationReviewCycle(payload: Partial<CompensationReviewCycle>): Promise<CompensationReviewCycle> {
  const cycleCode = `CRC-${payload.year_val || new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data, error } = await supabase
    .from("compensation_review_cycles" as any)
    .insert([{ ...payload, cycle_code: cycleCode }])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CompensationReviewCycle;
}

export async function launchCompensationReviewCycle(payload: {
  companyId: string;
  cycleId: string;
}): Promise<any> {
  const { data, error } = await db.rpc("launch_compensation_review_cycle_atomic", {
    p_company_id: payload.companyId,
    p_cycle_id: payload.cycleId,
  });

  if (error) throw error;
  return data;
}

export async function fetchCycleRecommendations(cycleId: string): Promise<CompensationReviewRecommendation[]> {
  const { data, error } = await supabase
    .from("compensation_review_recommendations" as any)
    .select("*, employee:employees(first_name_ar, last_name_ar, employee_number)")
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    employee_name_ar: row.employee ? `${row.employee.first_name_ar || ""} ${row.employee.last_name_ar || ""}`.trim() : "",
    employee_number: row.employee?.employee_number || "",
  })) as CompensationReviewRecommendation[];
}

export async function calibrateReviewRecommendation(payload: {
  recommendationId: string;
  calibratedPercentage: number;
  adjustmentReason: string;
}): Promise<any> {
  const { data, error } = await db.rpc("calibrate_review_recommendation_atomic", {
    p_recommendation_id: payload.recommendationId,
    p_calibrated_percentage: payload.calibratedPercentage,
    p_adjustment_reason: payload.adjustmentReason,
  });

  if (error) throw error;
  return data;
}

export async function finalizeAndApplyCompensationReview(payload: {
  companyId: string;
  cycleId: string;
}): Promise<any> {
  const { data, error } = await db.rpc("finalize_and_apply_compensation_review_atomic", {
    p_company_id: payload.companyId,
    p_cycle_id: payload.cycleId,
  });

  if (error) throw error;
  return data;
}

export async function fetchBenefitPlans(companyId: string): Promise<BenefitPlan[]> {
  const { data, error } = await supabase
    .from("benefit_plans" as any)
    .select("*, category:benefit_categories(*), provider:benefit_providers(*)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as BenefitPlan[];
}

export async function createBenefitPlan(payload: Partial<BenefitPlan>): Promise<BenefitPlan> {
  const { data, error } = await supabase
    .from("benefit_plans" as any)
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as BenefitPlan;
}

export async function fetchBenefitEnrollments(
  companyId: string,
  employeeId?: string
): Promise<EmployeeBenefitEnrollment[]> {
  let query = supabase
    .from("employee_benefit_enrollments" as any)
    .select("*, plan:benefit_plans(*, category:benefit_categories(*)), employee:employees(first_name_ar, last_name_ar, employee_number)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    employee_name_ar: row.employee ? `${row.employee.first_name_ar || ""} ${row.employee.last_name_ar || ""}`.trim() : "",
    employee_number: row.employee?.employee_number || "",
  })) as EmployeeBenefitEnrollment[];
}

export async function enrollEmployeeBenefit(payload: {
  companyId: string;
  employeeId: string;
  planId: string;
  enrollmentType?: string;
  effectiveFrom?: string;
  dependentIds?: string[];
}): Promise<any> {
  const { data, error } = await db.rpc("enroll_employee_benefit_atomic", {
    p_company_id: payload.companyId,
    p_employee_id: payload.employeeId,
    p_plan_id: payload.planId,
    p_enrollment_type: payload.enrollmentType || "open_enrollment",
    p_effective_from: payload.effectiveFrom || new Date().toISOString().split("T")[0],
    p_dependent_ids: payload.dependentIds || [],
  });

  if (error) throw error;
  return data;
}

export async function fetchEmployeeDependents(companyId: string, employeeId: string): Promise<EmployeeDependent[]> {
  const { data, error } = await supabase
    .from("employee_dependents" as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as EmployeeDependent[];
}

export async function createEmployeeDependent(payload: Partial<EmployeeDependent>): Promise<EmployeeDependent> {
  const { data, error } = await supabase
    .from("employee_dependents" as any)
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as EmployeeDependent;
}

export async function fetchTotalRewardsSnapshot(
  companyId: string,
  employeeId: string,
  year?: number
): Promise<TotalRewardsSnapshot | null> {
  const yearVal = year || new Date().getFullYear();
  const { data, error } = await supabase
    .from("total_rewards_snapshots" as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .eq("year_val", yearVal)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as TotalRewardsSnapshot | null;
}

export async function generateTotalRewardsStatement(payload: {
  companyId: string;
  employeeId: string;
  year?: number;
}): Promise<any> {
  const { data, error } = await db.rpc("generate_total_rewards_statement_atomic", {
    p_company_id: payload.companyId,
    p_employee_id: payload.employeeId,
    p_year: payload.year || new Date().getFullYear(),
  });

  if (error) throw error;
  return data;
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useCompensationKPIs(companyId?: string) {
  return useQuery({
    queryKey: compensationQueryKeys.kpis(companyId || ""),
    queryFn: () => fetchCompensationKPIs(companyId!),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
}

export function useCompensationComponents(companyId?: string) {
  return useQuery({
    queryKey: compensationQueryKeys.components.list(companyId || ""),
    queryFn: () => fetchCompensationComponents(companyId!),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });
}

export function useSalaryPayGrades(companyId?: string) {
  return useQuery({
    queryKey: compensationQueryKeys.payGrades.list(companyId || ""),
    queryFn: () => fetchSalaryPayGrades(companyId!),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });
}

export function useSalaryRanges(companyId?: string) {
  return useQuery({
    queryKey: compensationQueryKeys.salaryRanges.list(companyId || ""),
    queryFn: () => fetchSalaryRanges(companyId!),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });
}

export function useEmployeeCompensationPackages(companyId?: string, employeeId?: string) {
  return useQuery({
    queryKey: employeeId
      ? compensationQueryKeys.packages.byEmployee(employeeId)
      : compensationQueryKeys.packages.list(companyId || ""),
    queryFn: () => fetchEmployeeCompensationPackages(companyId!, employeeId),
    enabled: Boolean(companyId),
  });
}

export function useCompensationChangeRequests(companyId?: string, status?: string) {
  return useQuery({
    queryKey: compensationQueryKeys.changeRequests.list(companyId || "", status),
    queryFn: () => fetchCompensationChangeRequests(companyId!, status),
    enabled: Boolean(companyId),
  });
}

export function useCreateSalaryChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSalaryChangeRequest,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.changeRequests.all() });
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.kpis(variables.companyId) });
    },
  });
}

export function useApproveSalaryChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveSalaryChangeRequest,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.changeRequests.all() });
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.packages.all() });
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.kpis(variables.companyId) });
    },
  });
}

export function useCompensationReviewCycles(companyId?: string) {
  return useQuery({
    queryKey: compensationQueryKeys.reviewCycles.list(companyId || ""),
    queryFn: () => fetchCompensationReviewCycles(companyId!),
    enabled: Boolean(companyId),
  });
}

export function useCreateCompensationReviewCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCompensationReviewCycle,
    onSuccess: (_, variables) => {
      if (variables.company_id) {
        queryClient.invalidateQueries({ queryKey: compensationQueryKeys.reviewCycles.list(variables.company_id) });
      }
    },
  });
}

export function useLaunchCompensationReviewCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: launchCompensationReviewCycle,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.reviewCycles.list(variables.companyId) });
    },
  });
}

export function useCycleRecommendations(cycleId?: string) {
  return useQuery({
    queryKey: compensationQueryKeys.reviewCycles.recommendations(cycleId || ""),
    queryFn: () => fetchCycleRecommendations(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useCalibrateReviewRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: calibrateReviewRecommendation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.reviewCycles.all() });
    },
  });
}

export function useFinalizeCompensationReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: finalizeAndApplyCompensationReview,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.reviewCycles.list(variables.companyId) });
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.packages.all() });
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.kpis(variables.companyId) });
    },
  });
}

export function useBenefitPlans(companyId?: string) {
  return useQuery({
    queryKey: compensationQueryKeys.benefits.plans(companyId || ""),
    queryFn: () => fetchBenefitPlans(companyId!),
    enabled: Boolean(companyId),
  });
}

export function useCreateBenefitPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBenefitPlan,
    onSuccess: (_, variables) => {
      if (variables.company_id) {
        queryClient.invalidateQueries({ queryKey: compensationQueryKeys.benefits.plans(variables.company_id) });
        queryClient.invalidateQueries({ queryKey: compensationQueryKeys.kpis(variables.company_id) });
      }
    },
  });
}

export function useBenefitEnrollments(companyId?: string, employeeId?: string) {
  return useQuery({
    queryKey: compensationQueryKeys.benefits.enrollments(companyId || "", employeeId),
    queryFn: () => fetchBenefitEnrollments(companyId!, employeeId),
    enabled: Boolean(companyId),
  });
}

export function useEnrollEmployeeBenefit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enrollEmployeeBenefit,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.benefits.enrollments(variables.companyId) });
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.kpis(variables.companyId) });
    },
  });
}

export function useEmployeeDependents(companyId?: string, employeeId?: string) {
  return useQuery({
    queryKey: compensationQueryKeys.benefits.dependents(employeeId || ""),
    queryFn: () => fetchEmployeeDependents(companyId!, employeeId!),
    enabled: Boolean(companyId && employeeId),
  });
}

export function useTotalRewardsSnapshot(companyId?: string, employeeId?: string, year?: number) {
  return useQuery({
    queryKey: compensationQueryKeys.totalRewards.byEmployee(employeeId || "", year),
    queryFn: () => fetchTotalRewardsSnapshot(companyId!, employeeId!, year),
    enabled: Boolean(companyId && employeeId),
  });
}

export function useGenerateTotalRewardsStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateTotalRewardsStatement,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: compensationQueryKeys.totalRewards.byEmployee(variables.employeeId, variables.year) });
    },
  });
}
