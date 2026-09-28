import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "../query/query-keys";
import { useAuth } from "../auth/AuthContext";
import type {
  CompanyPayrollConfig,
  EmployeeCompensationVersion,
  PayrollException,
  PayrollGroup,
  PayrollKpis,
  PayrollPaymentBatch,
  PayrollRun,
  PayrollRunEmployee,
  PayrollRunLine,
  SalaryComponent,
  SalaryStructure,
} from "../../types";

// ============================================================================
// 1. COMPANY CONFIG HOOK
// ============================================================================

export function usePayrollConfig() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.payroll.config(),
    queryFn: async (): Promise<CompanyPayrollConfig | null> => {
      if (!isLive) return null;
      const { data, error } = await (supabase as any)
        .from("company_payroll_configs")
        .select("*")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      return {
        companyId: data.company_id,
        currency: data.currency,
        timezone: data.timezone,
        payFrequency: data.pay_frequency,
        payrollCutoffDay: data.payroll_cutoff_day,
        payday: data.payday,
        calculationBasis: data.calculation_basis,
        workingDaysPerMonth: data.working_days_per_month,
        roundingRule: data.rounding_rule,
        prorationPolicy: data.proration_policy,
        overtimeTreatment: data.overtime_treatment,
        overtimeCustomMultiplier: data.overtime_custom_multiplier,
        unpaidLeaveTreatment: data.unpaid_leave_treatment,
        statutoryRegime: data.statutory_regime,
        status: data.status,
      };
    },
    enabled: isLive,
    staleTime: 60_000,
  });
}

// ============================================================================
// 2. PAYROLL GROUPS HOOK
// ============================================================================

export function usePayrollGroups() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.payroll.groups(),
    queryFn: async (): Promise<PayrollGroup[]> => {
      if (!isLive) return [];
      const { data, error } = await (supabase as any)
        .from("payroll_groups")
        .select("*")
        .order("name_ar", { ascending: true });

      if (error) throw new Error(error.message);
      return (data || []).map((g: any) => ({
        id: g.id,
        companyId: g.company_id,
        nameAr: g.name_ar,
        nameEn: g.name_en,
        code: g.code,
        calculationBasis: g.calculation_basis,
        cutoffDay: g.cutoff_day,
        payday: g.payday,
        currency: g.currency,
        status: g.status,
      }));
    },
    enabled: isLive,
    staleTime: 30_000,
  });
}

// ============================================================================
// 3. SALARY COMPONENTS MASTER HOOK
// ============================================================================

export function useSalaryComponents() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.payroll.components(),
    queryFn: async (): Promise<SalaryComponent[]> => {
      if (!isLive) return [];
      const { data, error } = await (supabase as any)
        .from("salary_components")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw new Error(error.message);
      return (data || []).map((c: any) => ({
        id: c.id,
        companyId: c.company_id,
        code: c.code,
        nameAr: c.name_ar,
        nameEn: c.name_en,
        type: c.type,
        calculationMethod: c.calculation_method,
        formulaExpression: c.formula_expression,
        isTaxable: c.is_taxable,
        isStatutoryInsurable: c.is_statutory_insurable,
        isRecurring: c.is_recurring,
        effectiveFrom: c.effective_from,
        effectiveTo: c.effective_to,
        rounding: c.rounding,
        displayOrder: c.display_order,
        status: c.status,
      }));
    },
    enabled: isLive,
    staleTime: 30_000,
  });
}

// ============================================================================
// 4. SALARY STRUCTURES HOOK
// ============================================================================

export function useSalaryStructures() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.payroll.structures(),
    queryFn: async (): Promise<SalaryStructure[]> => {
      if (!isLive) return [];
      const { data, error } = await (supabase as any)
        .from("salary_structures")
        .select(`
          *,
          salary_structure_components (
            id,
            structure_id,
            component_id,
            default_amount,
            percentage_of_basic,
            is_mandatory
          )
        `)
        .order("version", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []).map((s: any) => ({
        id: s.id,
        companyId: s.company_id,
        code: s.code,
        nameAr: s.name_ar,
        nameEn: s.name_en,
        description: s.description,
        version: s.version,
        effectiveFrom: s.effective_from,
        effectiveTo: s.effective_to,
        status: s.status,
        components: (s.salary_structure_components || []).map((sc: any) => ({
          id: sc.id,
          structureId: sc.structure_id,
          componentId: sc.component_id,
          defaultAmount: sc.default_amount,
          percentageOfBasic: sc.percentage_of_basic,
          isMandatory: sc.is_mandatory,
        })),
      }));
    },
    enabled: isLive,
    staleTime: 30_000,
  });
}

// ============================================================================
// 5. EMPLOYEE COMPENSATION VERSION HOOK
// ============================================================================

export function useEmployeeCompensation(employeeId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo && employeeId);

  return useQuery({
    queryKey: queryKeys.payroll.compensation(employeeId),
    queryFn: async (): Promise<EmployeeCompensationVersion[]> => {
      if (!isLive || !employeeId) return [];
      const { data, error } = await (supabase as any)
        .from("employee_compensation_versions")
        .select("*")
        .eq("employee_id", employeeId)
        .order("effective_from", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []).map((v: any) => ({
        id: v.id,
        employeeId: v.employee_id,
        companyId: v.company_id,
        salaryStructureId: v.salary_structure_id,
        version: v.version,
        effectiveFrom: v.effective_from,
        effectiveTo: v.effective_to,
        basicSalary: Number(v.basic_salary),
        housingAllowance: Number(v.housing_allowance),
        transportAllowance: Number(v.transport_allowance),
        otherAllowances: v.other_allowances || [],
        currency: v.currency,
        bankName: v.bank_name,
        iban: v.iban,
        payrollGroupId: v.payroll_group_id,
        statutoryApplicable: v.statutory_applicable,
        statutoryScheme: v.statutory_scheme,
        gosiSchemeTier: v.gosi_scheme_tier,
        reason: v.reason,
        approvedBy: v.approved_by,
        approvedAt: v.approved_at,
        status: v.status,
      }));
    },
    enabled: isLive,
    staleTime: 15_000,
  });
}

// ============================================================================
// 6. PAYROLL RUNS HOOK
// ============================================================================

export function usePayrollRuns(filters?: Record<string, unknown>) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.payroll.runs(filters),
    queryFn: async (): Promise<PayrollRun[]> => {
      if (!isLive) return [];
      let query = (supabase as any)
        .from("payroll_runs")
        .select(`
          *,
          payroll_groups ( name_ar )
        `)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });

      if (filters?.year) {
        query = query.eq("period_year", filters.year);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map((r: any) => ({
        id: r.id,
        companyId: r.company_id,
        payrollGroupId: r.payroll_group_id,
        payrollGroupName: r.payroll_groups?.name_ar || "المجموعة الرئيسية",
        periodYear: r.period_year,
        periodMonth: r.period_month,
        periodId: r.period_id,
        calculationBasis: r.calculation_basis,
        status: r.status,
        paymentStatus: r.payment_status,
        currency: r.currency || "SAR",
        totalEmployees: r.total_employees || 0,
        totalBasicSalary: Number(r.total_basic_salary || 0),
        totalAllowances: Number(r.total_allowances || 0),
        totalOvertimeAmount: Number(r.total_overtime_amount || 0),
        totalDeductions: Number(r.total_deductions || 0),
        totalNetSalary: Number(r.total_net_salary || 0),
        totalEmployerGosi: Number(r.total_employer_gosi || 0),
        blockingExceptionsCount: r.blocking_exceptions_count || 0,
        warningsCount: r.warnings_count || 0,
        lockedAt: r.locked_at,
        lockedBy: r.locked_by,
        approvedAt: r.approved_at,
        approvedBy: r.approved_by,
        reopenedAt: r.reopened_at,
        reopenReason: r.reopen_reason,
        paidAt: r.paid_at,
      }));
    },
    enabled: isLive,
    staleTime: 10_000,
  });
}

// ============================================================================
// 7. SINGLE PAYROLL RUN HOOK
// ============================================================================

export function usePayrollRun(id?: string | null) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo && id);

  return useQuery({
    queryKey: queryKeys.payroll.run(id || ""),
    queryFn: async (): Promise<PayrollRun | null> => {
      if (!isLive || !id) return null;
      const { data, error } = await (supabase as any)
        .from("payroll_runs")
        .select(`
          *,
          payroll_groups ( name_ar )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      return {
        id: data.id,
        companyId: data.company_id,
        payrollGroupId: data.payroll_group_id,
        payrollGroupName: data.payroll_groups?.name_ar || "المجموعة الرئيسية",
        periodYear: data.period_year,
        periodMonth: data.period_month,
        periodId: data.period_id,
        calculationBasis: data.calculation_basis,
        status: data.status,
        paymentStatus: data.payment_status,
        currency: data.currency || "SAR",
        totalEmployees: data.total_employees || 0,
        totalBasicSalary: Number(data.total_basic_salary || 0),
        totalAllowances: Number(data.total_allowances || 0),
        totalOvertimeAmount: Number(data.total_overtime_amount || 0),
        totalDeductions: Number(data.total_deductions || 0),
        totalNetSalary: Number(data.total_net_salary || 0),
        totalEmployerGosi: Number(data.total_employer_gosi || 0),
        blockingExceptionsCount: data.blocking_exceptions_count || 0,
        warningsCount: data.warnings_count || 0,
        lockedAt: data.locked_at,
        lockedBy: data.locked_by,
        approvedAt: data.approved_at,
        approvedBy: data.approved_by,
        reopenedAt: data.reopened_at,
        reopenReason: data.reopen_reason,
        paidAt: data.paid_at,
      };
    },
    enabled: isLive,
    staleTime: 5_000,
  });
}

// ============================================================================
// 8. PAGINATED RUN EMPLOYEES HOOK
// ============================================================================

export function usePayrollEmployees(
  runId?: string | null,
  filters: {
    page?: number;
    pageSize?: number;
    search?: string;
    departmentId?: string;
    status?: string;
  } = {}
) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo && runId);

  return useQuery({
    queryKey: queryKeys.payroll.employees(runId || "", filters),
    queryFn: async () => {
      if (!isLive || !runId) return { data: [], total: 0, page: 1, pageSize: 25, totalPages: 0 };

      const { data, error } = await (supabase as any).rpc("get_payroll_run_employees_paginated", {
        p_params: {
          run_id: runId,
          search: filters.search || "",
          department_id: filters.departmentId || null,
          status: filters.status || "",
          page: filters.page || 1,
          page_size: filters.pageSize || 25,
        },
      });

      if (error) throw new Error(error.message);
      return data as {
        data: PayrollRunEmployee[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    },
    enabled: isLive,
    staleTime: 10_000,
  });
}

// ============================================================================
// 9. PAYROLL EXCEPTIONS HOOK
// ============================================================================

export function usePayrollExceptions(runId?: string | null) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo && runId);

  return useQuery({
    queryKey: queryKeys.payroll.exceptions(runId || ""),
    queryFn: async (): Promise<PayrollException[]> => {
      if (!isLive || !runId) return [];
      const { data, error } = await (supabase as any)
        .from("payroll_exceptions")
        .select(`
          *,
          employees (
            full_name,
            first_name_ar,
            last_name_ar
          )
        `)
        .eq("payroll_run_id", runId)
        .order("severity", { ascending: true }) // blocking first
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []).map((ex: any) => ({
        id: ex.id,
        payrollRunId: ex.payroll_run_id,
        employeeId: ex.employee_id,
        employeeName: ex.employees ? (ex.employees.first_name_ar + " " + ex.employees.last_name_ar) : "النظام العام",
        code: ex.code,
        titleAr: ex.title_ar,
        messageAr: ex.message_ar,
        severity: ex.severity,
        details: ex.details,
        isResolved: ex.is_resolved,
        resolvedAt: ex.resolved_at,
      }));
    },
    enabled: isLive,
    staleTime: 5_000,
  });
}

// ============================================================================
// 10. PAYROLL KPIS HOOK
// ============================================================================

export function usePayrollKpis() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.payroll.kpis(),
    queryFn: async (): Promise<PayrollKpis | null> => {
      if (!isLive) return null;
      const { data, error } = await (supabase as any).rpc("get_payroll_kpis");
      if (error) throw new Error(error.message);
      return data as PayrollKpis;
    },
    enabled: isLive,
    staleTime: 15_000,
  });
}

// ============================================================================
// 11. EMPLOYEE PAYSLIP HOOK
// ============================================================================

export function useEmployeePayslip(runEmployeeId?: string | null) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo && runEmployeeId);

  return useQuery({
    queryKey: queryKeys.payroll.payslip(runEmployeeId || ""),
    queryFn: async () => {
      if (!isLive || !runEmployeeId) return null;
      const { data, error } = await (supabase as any).rpc("get_payroll_employee_payslip", {
        p_run_employee_id: runEmployeeId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: isLive,
    staleTime: 60_000,
  });
}

// ============================================================================
// 12. AUTHORITATIVE PAYROLL MUTATIONS HOOK
// ============================================================================

export function usePayrollEngineMutations() {
  const queryClient = useQueryClient();

  const initConfig = useCallback(
    async (companyId: string, config: Partial<CompanyPayrollConfig>) => {
      const { data, error } = await (supabase as any).rpc("init_company_payroll_config", {
        p_company_id: companyId,
        p_config: config,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.config() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.components() });
      return data;
    },
    [queryClient]
  );

  const setEmployeeCompensation = useCallback(
    async (employeeId: string, compensation: Record<string, unknown>) => {
      const { data, error } = await (supabase as any).rpc("set_employee_compensation_atomic", {
        p_employee_id: employeeId,
        p_compensation: compensation,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.compensation(employeeId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(employeeId) });
      return data;
    },
    [queryClient]
  );

  const createRun = useCallback(
    async (companyId: string, payrollGroupId: string, year: number, month: number) => {
      const { data, error } = await (supabase as any).rpc("create_payroll_run_atomic", {
        p_company_id: companyId,
        p_payroll_group_id: payrollGroupId,
        p_year: year,
        p_month: month,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.kpis() });
      return data;
    },
    [queryClient]
  );

  const calculateRun = useCallback(
    async (runId: string) => {
      const { data, error } = await (supabase as any).rpc("calculate_payroll_run_atomic", {
        p_payroll_run_id: runId,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.employees(runId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.exceptions(runId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.kpis() });
      return data;
    },
    [queryClient]
  );

  const approveRun = useCallback(
    async (runId: string, note: string = "") => {
      const { data, error } = await (supabase as any).rpc("approve_payroll_run_atomic", {
        p_payroll_run_id: runId,
        p_note: note,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.kpis() });
      return data;
    },
    [queryClient]
  );

  const lockRun = useCallback(
    async (runId: string) => {
      const { data, error } = await (supabase as any).rpc("lock_payroll_run_atomic", {
        p_payroll_run_id: runId,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.kpis() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.loans() });
      return data;
    },
    [queryClient]
  );

  const reopenRun = useCallback(
    async (runId: string, reason: string) => {
      const { data, error } = await (supabase as any).rpc("reopen_payroll_run_atomic", {
        p_payroll_run_id: runId,
        p_reason: reason,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.kpis() });
      return data;
    },
    [queryClient]
  );

  const prepareBankBatch = useCallback(
    async (runId: string, bankAccountId: string) => {
      const { data, error } = await (supabase as any).rpc("prepare_bank_transfer_batch_atomic", {
        p_payroll_run_id: runId,
        p_bank_account_id: bankAccountId,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.batches() });
      return data;
    },
    [queryClient]
  );

  const confirmDisbursement = useCallback(
    async (runId: string, bankReference: string, bankAccountId?: string) => {
      const { data, error } = await (supabase as any).rpc("confirm_payroll_disbursement_atomic", {
        p_payroll_run_id: runId,
        p_bank_reference: bankReference,
        p_bank_account_id: bankAccountId || null,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.kpis() });
      return data;
    },
    [queryClient]
  );

  return {
    initConfig,
    setEmployeeCompensation,
    createRun,
    calculateRun,
    approveRun,
    lockRun,
    reopenRun,
    prepareBankBatch,
    confirmDisbursement,
  };
}
