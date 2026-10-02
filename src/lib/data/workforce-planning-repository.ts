import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "../query/query-keys";
import { useAuth } from "../auth/AuthContext";
import { AppMutationError, type MutationDataMode } from "./reliable-mutation";

// Suppress unused import warning â€” MutationDataMode is used by domain index
type _MDE = MutationDataMode;

// Typecast client to access RPCs & custom tables safely
const db = supabase as any;

// ============================================================================
// 1. DOMAIN INTERFACES & TYPES
// ============================================================================

export type WorkforcePlanStatus = "draft" | "pending_approval" | "approved";
export type WorkforcePlanType = "annual" | "quarterly" | "project";
export type HeadcountRequestStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "fulfilled"
  | "cancelled";
export type HeadcountRequestPriority = "low" | "normal" | "high" | "critical";

export interface WorkforcePlanEnriched {
  id: string;
  companyId?: string;
  titleAr: string;
  titleEn?: string;
  planYear: number;
  fiscalYear: number;
  planCode?: string;
  planType: WorkforcePlanType;
  versionNumber: number;
  parentPlanId?: string;
  isBaseline: boolean;
  scenarioLabel?: string;
  departmentId?: string;
  departmentName?: string;
  currentHeadcount: number;
  plannedHires: number;
  plannedExits: number;
  targetHeadcount: number;
  currentBudget: number;
  projectedCost: number;
  fteBudget: number;
  totalCompensationBudget: number;
  benefitsBudget: number;
  trainingBudget: number;
  recruitmentBudget: number;
  saudizationTargetPct: number;
  status: WorkforcePlanStatus;
  approvedBy?: string;
  approvedAt?: string;
  submittedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkforcePlanLine {
  id: string;
  companyId: string;
  planId: string;
  jobPositionId?: string;
  departmentId?: string;
  departmentName?: string;
  costCenterId?: string;
  workLocationId?: string;
  positionTitleAr: string;
  positionTitleEn?: string;
  positionGrade?: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  plannedHeadcount: number;
  currentActualHeadcount: number;
  targetHeadcount: number;
  hiresPlanned: number;
  exitsPlanned: number;
  internalTransfersIn: number;
  internalTransfersOut: number;
  ftePerHead: number;
  avgMonthlyCompensation: number;
  lineStatus: "draft" | "active" | "approved" | "cancelled";
  lineNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkforcePlanMonthlyForecast {
  id: string;
  companyId: string;
  planId: string;
  planLineId?: string;
  departmentId?: string;
  forecastYear: number;
  forecastMonth: number;
  forecastHeadcount: number;
  forecastHires: number;
  forecastExits: number;
  forecastFte: number;
  forecastTotalCost: number;
  forecastBaseSalary: number;
  forecastAllowances: number;
  forecastBenefits: number;
  actualHeadcount?: number;
  actualCost?: number;
  varianceHeadcount?: number;
  varianceCost?: number;
}

export interface HeadcountRequest {
  id: string;
  companyId: string;
  requestNo: string;
  planId?: string;
  planLineId?: string;
  departmentId?: string;
  departmentName?: string;
  costCenterId?: string;
  jobPositionId?: string;
  positionTitleAr: string;
  positionTitleEn?: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  requestedHeadcount: number;
  approvedHeadcount?: number;
  justificationAr?: string;
  priority: HeadcountRequestPriority;
  targetStartDate?: string;
  minMonthlySalary?: number;
  maxMonthlySalary?: number;
  status: HeadcountRequestStatus;
  requestedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  linkedJobOpeningId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkforceKPIs {
  ok: boolean;
  success: boolean;
  fiscalYear: number;
  // Headcount
  totalEmployed: number;
  totalActive: number;
  saudiCount: number;
  expatCount: number;
  fteTotal: number;
  saudizationPct: number;
  // Plans
  plansCount: number;
  approvedPlans: number;
  pendingPlans: number;
  totalPlannedHires: number;
  // Requests
  totalHeadcountRequests: number;
  approvedHcRequests: number;
  // Gaps & budget
  openVacancies: number;
  totalCompensationBudget: number;
  avgMonthlyPayroll: number;
}

export interface ActualHeadcountResult {
  ok: boolean;
  success: boolean;
  asOfDate: string;
  totalActive: number;
  totalProbation: number;
  totalOnLeave: number;
  totalEmployed: number;
  saudiCount: number;
  expatCount: number;
  fteTotal: number;
  saudizationPct: number;
  deptBreakdown: {
    department_id: string;
    department_name: string;
    active: number;
    probation: number;
    on_leave: number;
    total_employed: number;
  }[];
}

export interface PlanVsActualResult {
  ok: boolean;
  success: boolean;
  planId: string;
  planCode?: string;
  planStatus: string;
  fiscalYear: number;
  plannedTargetHeadcount: number;
  plannedFteBudget: number;
  actualEmployed: number;
  actualFte: number;
  headcountGap: number;
  fteGap: number;
  plannedTotalCompensationBudget: number;
  planLines: {
    line_id: string;
    position_title_ar: string;
    department_id?: string;
    employment_type: string;
    planned_headcount: number;
    target_headcount: number;
    hires_planned: number;
    exits_planned: number;
    avg_monthly_compensation: number;
    fte_per_head: number;
    actual_in_dept: number;
  }[];
}

// ============================================================================
// 2. MAPPER FUNCTIONS
// ============================================================================

function mapPlan(row: Record<string, unknown>): WorkforcePlanEnriched {
  return {
    id: row.id as string,
    companyId: row.company_id as string | undefined,
    titleAr: row.title_ar as string,
    titleEn: row.title_en as string | undefined,
    planYear: Number(row.plan_year),
    fiscalYear: Number(row.fiscal_year ?? row.plan_year),
    planCode: row.plan_code as string | undefined,
    planType: (row.plan_type ?? "annual") as WorkforcePlanType,
    versionNumber: Number(row.version_number ?? 1),
    parentPlanId: row.parent_plan_id as string | undefined,
    isBaseline: Boolean(row.is_baseline ?? true),
    scenarioLabel: row.scenario_label as string | undefined,
    departmentId: row.department_id as string | undefined,
    departmentName: row.department_name as string | undefined,
    currentHeadcount: Number(row.current_headcount ?? 0),
    plannedHires: Number(row.planned_hires ?? 0),
    plannedExits: Number(row.planned_exits ?? 0),
    targetHeadcount: Number(row.target_headcount ?? 0),
    currentBudget: Number(row.current_budget ?? 0),
    projectedCost: Number(row.projected_cost ?? 0),
    fteBudget: Number(row.fte_budget ?? 0),
    totalCompensationBudget: Number(row.total_compensation_budget ?? 0),
    benefitsBudget: Number(row.benefits_budget ?? 0),
    trainingBudget: Number(row.training_budget ?? 0),
    recruitmentBudget: Number(row.recruitment_budget ?? 0),
    saudizationTargetPct: Number(row.saudization_target_pct ?? 0),
    status: (row.status ?? "draft") as WorkforcePlanStatus,
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as string | undefined,
    submittedAt: row.submitted_at as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  };
}

function mapLine(row: Record<string, unknown>): WorkforcePlanLine {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    planId: row.plan_id as string,
    jobPositionId: row.job_position_id as string | undefined,
    departmentId: row.department_id as string | undefined,
    departmentName: row.department_name as string | undefined,
    costCenterId: row.cost_center_id as string | undefined,
    workLocationId: row.work_location_id as string | undefined,
    positionTitleAr: row.position_title_ar as string,
    positionTitleEn: row.position_title_en as string | undefined,
    positionGrade: row.position_grade as string | undefined,
    employmentType: (row.employment_type ?? "full_time") as WorkforcePlanLine["employmentType"],
    plannedHeadcount: Number(row.planned_headcount ?? 0),
    currentActualHeadcount: Number(row.current_actual_headcount ?? 0),
    targetHeadcount: Number(row.target_headcount ?? 0),
    hiresPlanned: Number(row.hires_planned ?? 0),
    exitsPlanned: Number(row.exits_planned ?? 0),
    internalTransfersIn: Number(row.internal_transfers_in ?? 0),
    internalTransfersOut: Number(row.internal_transfers_out ?? 0),
    ftePerHead: Number(row.fte_per_head ?? 1),
    avgMonthlyCompensation: Number(row.avg_monthly_compensation ?? 0),
    lineStatus: (row.line_status ?? "draft") as WorkforcePlanLine["lineStatus"],
    lineNotes: row.line_notes as string | undefined,
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  };
}

function mapForecast(row: Record<string, unknown>): WorkforcePlanMonthlyForecast {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    planId: row.plan_id as string,
    planLineId: row.plan_line_id as string | undefined,
    departmentId: row.department_id as string | undefined,
    forecastYear: Number(row.forecast_year),
    forecastMonth: Number(row.forecast_month),
    forecastHeadcount: Number(row.forecast_headcount ?? 0),
    forecastHires: Number(row.forecast_hires ?? 0),
    forecastExits: Number(row.forecast_exits ?? 0),
    forecastFte: Number(row.forecast_fte ?? 0),
    forecastTotalCost: Number(row.forecast_total_cost ?? 0),
    forecastBaseSalary: Number(row.forecast_base_salary ?? 0),
    forecastAllowances: Number(row.forecast_allowances ?? 0),
    forecastBenefits: Number(row.forecast_benefits ?? 0),
    actualHeadcount: row.actual_headcount != null ? Number(row.actual_headcount) : undefined,
    actualCost: row.actual_cost != null ? Number(row.actual_cost) : undefined,
    varianceHeadcount: row.variance_headcount != null ? Number(row.variance_headcount) : undefined,
    varianceCost: row.variance_cost != null ? Number(row.variance_cost) : undefined,
  };
}

function mapHeadcountRequest(row: Record<string, unknown>): HeadcountRequest {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    requestNo: row.request_no as string,
    planId: row.plan_id as string | undefined,
    planLineId: row.plan_line_id as string | undefined,
    departmentId: row.department_id as string | undefined,
    departmentName: row.department_name as string | undefined,
    costCenterId: row.cost_center_id as string | undefined,
    jobPositionId: row.job_position_id as string | undefined,
    positionTitleAr: row.position_title_ar as string,
    positionTitleEn: row.position_title_en as string | undefined,
    employmentType: (row.employment_type ?? "full_time") as HeadcountRequest["employmentType"],
    requestedHeadcount: Number(row.requested_headcount ?? 1),
    approvedHeadcount: row.approved_headcount != null ? Number(row.approved_headcount) : undefined,
    justificationAr: row.justification_ar as string | undefined,
    priority: (row.priority ?? "normal") as HeadcountRequestPriority,
    targetStartDate: row.target_start_date as string | undefined,
    minMonthlySalary: row.min_monthly_salary != null ? Number(row.min_monthly_salary) : undefined,
    maxMonthlySalary: row.max_monthly_salary != null ? Number(row.max_monthly_salary) : undefined,
    status: (row.status ?? "draft") as HeadcountRequestStatus,
    requestedBy: row.requested_by as string | undefined,
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as string | undefined,
    linkedJobOpeningId: row.linked_job_opening_id as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  };
}

// ============================================================================
// 3. QUERY HOOKS
// ============================================================================

export function useWorkforcePlans(filters?: { fiscalYear?: number; status?: string }) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.workforce.plans(filters),
    enabled: Boolean(session),
    queryFn: async () => {
      let query = db
        .from("workforce_plans")
        .select(`
          *,
          departments!workforce_plans_department_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (filters?.fiscalYear) {
        query = query.eq("fiscal_year", filters.fiscalYear);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });

      return (data ?? []).map((row: Record<string, unknown>) =>
        mapPlan({
          ...row,
          department_name: (row.departments as { name?: string } | null)?.name,
        })
      ) as WorkforcePlanEnriched[];
    },
    staleTime: 30_000,
  });
}

export function useWorkforcePlan(planId: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.workforce.plan(planId ?? ""),
    enabled: Boolean(session && planId),
    queryFn: async () => {
      const { data, error } = await db
        .from("workforce_plans")
        .select(`
          *,
          departments!workforce_plans_department_id_fkey(name)
        `)
        .eq("id", planId)
        .maybeSingle();

      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      if (!data) return null;

      return mapPlan({
        ...data,
        department_name: (data.departments as { name?: string } | null)?.name,
      }) as WorkforcePlanEnriched;
    },
    staleTime: 30_000,
  });
}

export function useWorkforcePlanLines(planId: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.workforce.planLines(planId ?? ""),
    enabled: Boolean(session && planId),
    queryFn: async () => {
      const { data, error } = await db
        .from("workforce_plan_lines")
        .select(`
          *,
          departments!workforce_plan_lines_department_id_fkey(name)
        `)
        .eq("plan_id", planId)
        .order("created_at", { ascending: true });

      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });

      return (data ?? []).map((row: Record<string, unknown>) =>
        mapLine({
          ...row,
          department_name: (row.departments as { name?: string } | null)?.name,
        })
      ) as WorkforcePlanLine[];
    },
    staleTime: 30_000,
  });
}

export function useWorkforcePlanForecasts(planId: string | null, fiscalYear?: number) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.workforce.forecasts(planId ?? "", fiscalYear),
    enabled: Boolean(session && planId),
    queryFn: async () => {
      let query = db
        .from("workforce_plan_monthly_forecasts")
        .select("*")
        .eq("plan_id", planId)
        .order("forecast_year", { ascending: true })
        .order("forecast_month", { ascending: true });

      if (fiscalYear) {
        query = query.eq("forecast_year", fiscalYear);
      }

      const { data, error } = await query;
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });

      return (data ?? []).map(mapForecast) as WorkforcePlanMonthlyForecast[];
    },
    staleTime: 30_000,
  });
}

export function useHeadcountRequests(filters?: { status?: string; planId?: string }) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.workforce.headcountRequests(filters),
    enabled: Boolean(session),
    queryFn: async () => {
      let query = db
        .from("headcount_requests")
        .select(`
          *,
          departments!headcount_requests_department_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.planId) {
        query = query.eq("plan_id", filters.planId);
      }

      const { data, error } = await query;
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });

      return (data ?? []).map((row: Record<string, unknown>) =>
        mapHeadcountRequest({
          ...row,
          department_name: (row.departments as { name?: string } | null)?.name,
        })
      ) as HeadcountRequest[];
    },
    staleTime: 30_000,
  });
}

export function useWorkforceKPIs(companyId: string | null, fiscalYear?: number) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.workforce.kpis(companyId ?? "current", fiscalYear),
    enabled: Boolean(session && companyId),
    queryFn: async () => {
      const { data, error } = await db.rpc("get_workforce_kpis_atomic", {
        p_company_id: companyId,
        p_fiscal_year: fiscalYear ?? null,
      });

      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });

      const d = data as Record<string, unknown>;
      return {
        ok: Boolean(d.ok),
        success: Boolean(d.success),
        fiscalYear: Number(d.fiscal_year),
        totalEmployed: Number(d.total_employed ?? 0),
        totalActive: Number(d.total_active ?? 0),
        saudiCount: Number(d.saudi_count ?? 0),
        expatCount: Number(d.expat_count ?? 0),
        fteTotal: Number(d.fte_total ?? 0),
        saudizationPct: Number(d.saudization_pct ?? 0),
        plansCount: Number(d.plans_count ?? 0),
        approvedPlans: Number(d.approved_plans ?? 0),
        pendingPlans: Number(d.pending_plans ?? 0),
        totalPlannedHires: Number(d.total_planned_hires ?? 0),
        totalHeadcountRequests: Number(d.total_headcount_requests ?? 0),
        approvedHcRequests: Number(d.approved_hc_requests ?? 0),
        openVacancies: Number(d.open_vacancies ?? 0),
        totalCompensationBudget: Number(d.total_compensation_budget ?? 0),
        avgMonthlyPayroll: Number(d.avg_monthly_payroll ?? 0),
      } as WorkforceKPIs;
    },
    staleTime: 60_000,
  });
}

export function useActualHeadcount(
  companyId: string | null,
  departmentId?: string | null,
  asOfDate?: string
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.workforce.actualHeadcount(companyId ?? "current", departmentId, asOfDate),
    enabled: Boolean(session && companyId),
    queryFn: async () => {
      const { data, error } = await db.rpc("calculate_actual_headcount_atomic", {
        p_company_id: companyId,
        p_department_id: departmentId ?? null,
        p_as_of_date: asOfDate ?? null,
      });

      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });

      const d = data as Record<string, unknown>;
      return {
        ok: Boolean(d.ok),
        success: Boolean(d.success),
        asOfDate: d.as_of_date as string,
        totalActive: Number(d.total_active ?? 0),
        totalProbation: Number(d.total_probation ?? 0),
        totalOnLeave: Number(d.total_on_leave ?? 0),
        totalEmployed: Number(d.total_employed ?? 0),
        saudiCount: Number(d.saudi_count ?? 0),
        expatCount: Number(d.expat_count ?? 0),
        fteTotal: Number(d.fte_total ?? 0),
        saudizationPct: Number(d.saudization_pct ?? 0),
        deptBreakdown: (d.dept_breakdown as ActualHeadcountResult["deptBreakdown"]) ?? [],
      } as ActualHeadcountResult;
    },
    staleTime: 30_000,
  });
}

export function usePlanVsActual(planId: string | null, companyId: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.workforce.planVsActual(planId ?? ""),
    enabled: Boolean(session && planId && companyId),
    queryFn: async () => {
      const { data, error } = await db.rpc("get_plan_vs_actual_atomic", {
        p_plan_id: planId,
        p_company_id: companyId,
      });

      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });

      const d = data as Record<string, unknown>;
      if (!d.ok) throw new AppMutationError(d.error as string ?? "rpc_failed", "backend");

      return {
        ok: true,
        success: true,
        planId: d.plan_id as string,
        planCode: d.plan_code as string | undefined,
        planStatus: d.plan_status as string,
        fiscalYear: Number(d.fiscal_year),
        plannedTargetHeadcount: Number(d.planned_target_headcount ?? 0),
        plannedFteBudget: Number(d.planned_fte_budget ?? 0),
        actualEmployed: Number(d.actual_employed ?? 0),
        actualFte: Number(d.actual_fte ?? 0),
        headcountGap: Number(d.headcount_gap ?? 0),
        fteGap: Number(d.fte_gap ?? 0),
        plannedTotalCompensationBudget: Number(d.planned_total_compensation_budget ?? 0),
        planLines: (d.plan_lines ?? []) as PlanVsActualResult["planLines"],
      } as PlanVsActualResult;
    },
    staleTime: 30_000,
  });
}

// ============================================================================
// 4. MUTATION HOOKS
// ============================================================================

export function useWorkforcePlanningMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workforce.all });
  }, [queryClient]);

  // Create plan
  const createPlan = useMutation({
    mutationFn: async (params: {
      companyId: string;
      titleAr: string;
      titleEn?: string;
      fiscalYear?: number;
      planType?: string;
      departmentId?: string;
      notes?: string;
      parentPlanId?: string;
      scenarioLabel?: string;
      fteBudget?: number;
      totalCompensationBudget?: number;
      saudizationTargetPct?: number;
    }) => {
      const { data, error } = await db.rpc("create_workforce_plan_atomic", {
        p_company_id: params.companyId,
        p_title_ar: params.titleAr,
        p_title_en: params.titleEn ?? null,
        p_fiscal_year: params.fiscalYear ?? null,
        p_plan_type: params.planType ?? "annual",
        p_department_id: params.departmentId ?? null,
        p_notes: params.notes ?? null,
        p_parent_plan_id: params.parentPlanId ?? null,
        p_scenario_label: params.scenarioLabel ?? null,
        p_fte_budget: params.fteBudget ?? 0,
        p_total_compensation_budget: params.totalCompensationBudget ?? 0,
        p_saudization_target_pct: params.saudizationTargetPct ?? 0,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const result = data as Record<string, unknown>;
      if (!result.ok) throw new AppMutationError(result.error as string ?? "create_plan_failed", "backend");
      return result;
    },
    onSuccess: () => invalidateAll(),
  });

  // Submit plan
  const submitPlan = useMutation({
    mutationFn: async (params: { planId: string; companyId: string }) => {
      const { data, error } = await db.rpc("submit_workforce_plan_atomic", {
        p_plan_id: params.planId,
        p_company_id: params.companyId,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const result = data as Record<string, unknown>;
      if (!result.ok) throw new AppMutationError(result.error as string ?? "submit_failed", "backend");
      return result;
    },
    onSuccess: () => invalidateAll(),
  });

  // Approve / reject plan
  const approvePlan = useMutation({
    mutationFn: async (params: {
      planId: string;
      companyId: string;
      action: "approve" | "reject";
      notes?: string;
    }) => {
      const { data, error } = await db.rpc("approve_workforce_plan_atomic", {
        p_plan_id: params.planId,
        p_company_id: params.companyId,
        p_action: params.action,
        p_notes: params.notes ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const result = data as Record<string, unknown>;
      if (!result.ok) throw new AppMutationError(result.error as string ?? "approve_failed", "backend");
      return result;
    },
    onSuccess: () => invalidateAll(),
  });

  // Upsert plan line
  const upsertPlanLine = useMutation({
    mutationFn: async (params: {
      companyId: string;
      planId: string;
      positionTitleAr: string;
      plannedHeadcount?: number;
      targetHeadcount?: number;
      hiresPlanned?: number;
      exitsPlanned?: number;
      employmentType?: string;
      avgMonthlyCompensation?: number;
      ftePerHead?: number;
      departmentId?: string;
      costCenterId?: string;
      jobPositionId?: string;
      positionTitleEn?: string;
      positionGrade?: string;
      lineNotes?: string;
      lineId?: string;
    }) => {
      const { data, error } = await db.rpc("upsert_plan_line_atomic", {
        p_company_id: params.companyId,
        p_plan_id: params.planId,
        p_position_title_ar: params.positionTitleAr,
        p_planned_headcount: params.plannedHeadcount ?? 1,
        p_target_headcount: params.targetHeadcount ?? 1,
        p_hires_planned: params.hiresPlanned ?? 0,
        p_exits_planned: params.exitsPlanned ?? 0,
        p_employment_type: params.employmentType ?? "full_time",
        p_avg_monthly_compensation: params.avgMonthlyCompensation ?? 0,
        p_fte_per_head: params.ftePerHead ?? 1.0,
        p_department_id: params.departmentId ?? null,
        p_cost_center_id: params.costCenterId ?? null,
        p_job_position_id: params.jobPositionId ?? null,
        p_position_title_en: params.positionTitleEn ?? null,
        p_position_grade: params.positionGrade ?? null,
        p_line_notes: params.lineNotes ?? null,
        p_line_id: params.lineId ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const result = data as Record<string, unknown>;
      if (!result.ok) throw new AppMutationError(result.error as string ?? "upsert_line_failed", "backend");
      return result;
    },
    onSuccess: () => invalidateAll(),
  });

  // Generate monthly forecast
  const generateForecast = useMutation({
    mutationFn: async (params: { companyId: string; planId: string; fiscalYear?: number }) => {
      const { data, error } = await db.rpc("generate_monthly_forecast_atomic", {
        p_company_id: params.companyId,
        p_plan_id: params.planId,
        p_forecast_year: params.fiscalYear ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const result = data as Record<string, unknown>;
      if (!result.ok) throw new AppMutationError(result.error as string ?? "forecast_failed", "backend");
      return result;
    },
    onSuccess: () => invalidateAll(),
  });

  // Create headcount request
  const createHeadcountRequest = useMutation({
    mutationFn: async (params: {
      companyId: string;
      positionTitleAr: string;
      requestedHeadcount?: number;
      employmentType?: string;
      priority?: string;
      planId?: string;
      planLineId?: string;
      departmentId?: string;
      costCenterId?: string;
      jobPositionId?: string;
      positionTitleEn?: string;
      justificationAr?: string;
      targetStartDate?: string;
      minMonthlySalary?: number;
      maxMonthlySalary?: number;
      notes?: string;
    }) => {
      const { data, error } = await db.rpc("create_headcount_request_atomic", {
        p_company_id: params.companyId,
        p_position_title_ar: params.positionTitleAr,
        p_requested_headcount: params.requestedHeadcount ?? 1,
        p_employment_type: params.employmentType ?? "full_time",
        p_priority: params.priority ?? "normal",
        p_plan_id: params.planId ?? null,
        p_plan_line_id: params.planLineId ?? null,
        p_department_id: params.departmentId ?? null,
        p_cost_center_id: params.costCenterId ?? null,
        p_job_position_id: params.jobPositionId ?? null,
        p_position_title_en: params.positionTitleEn ?? null,
        p_justification_ar: params.justificationAr ?? null,
        p_target_start_date: params.targetStartDate ?? null,
        p_min_monthly_salary: params.minMonthlySalary ?? null,
        p_max_monthly_salary: params.maxMonthlySalary ?? null,
        p_notes: params.notes ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const result = data as Record<string, unknown>;
      if (!result.ok) throw new AppMutationError(result.error as string ?? "create_request_failed", "backend");
      return result;
    },
    onSuccess: () => invalidateAll(),
  });

  // Approve / reject headcount request
  const approveHeadcountRequest = useMutation({
    mutationFn: async (params: {
      requestId: string;
      companyId: string;
      action: "approve" | "reject";
      approvedHeadcount?: number;
      notes?: string;
    }) => {
      const { data, error } = await db.rpc("approve_headcount_request_atomic", {
        p_request_id: params.requestId,
        p_company_id: params.companyId,
        p_action: params.action,
        p_approved_headcount: params.approvedHeadcount ?? null,
        p_notes: params.notes ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const result = data as Record<string, unknown>;
      if (!result.ok) throw new AppMutationError(result.error as string ?? "approve_request_failed", "backend");
      return result;
    },
    onSuccess: () => invalidateAll(),
  });

  return {
    createPlan,
    submitPlan,
    approvePlan,
    upsertPlanLine,
    generateForecast,
    createHeadcountRequest,
    approveHeadcountRequest,
  };
}

