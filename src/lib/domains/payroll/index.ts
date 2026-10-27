import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type {
  EmployeePayrollDetail,
  FinalSettlementRecord,
  LoanRecord,
  PayrollRun,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  createLoanRecord,
  createSettlementRecord,
  updatePayrollRunStatusRecord,
} from "../../data/operational-repository";
import {
  usePayrollRuns,
  usePayrollGroups,
  usePayrollKpis,
  usePayrollRun as usePayrollRunRepo,
  usePayrollEmployees,
  usePayrollExceptions,
  usePayrollLoans,
  usePayrollSettlements,
  useCompanyBankAccounts,
} from "../../data/payroll-repository";
import { runPayrollServer, updatePayrollRunStatusServer } from "../../business/payroll.functions";
import {
  calculateSettlementServer,
  createSettlementServer,
  type SettlementInput,
  type SettlementCalculationPreview,
} from "../../business/settlement.functions";
import { calculateEOSB } from "../../utils/eosb-calculator";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { toast } from "sonner";

export function usePayroll(filters?: Record<string, unknown>) {
  const runsQuery = usePayrollRuns(filters);
  const groupsQuery = usePayrollGroups();
  const kpisQuery = usePayrollKpis();
  const loansQuery = usePayrollLoans();
  const settlementsQuery = usePayrollSettlements();

  return {
    payrollGroups: groupsQuery.data ?? [],
    payrollRuns: runsQuery.data ?? [],
    payrollDetails: [] as EmployeePayrollDetail[],
    loans: loansQuery.data ?? [],
    settlements: settlementsQuery.data ?? [],
    kpis: kpisQuery.data ?? null,
    isLoading: runsQuery.isLoading || groupsQuery.isLoading || loansQuery.isLoading || settlementsQuery.isLoading,
    isError: runsQuery.isError || groupsQuery.isError || loansQuery.isError || settlementsQuery.isError,
    error: runsQuery.error || groupsQuery.error || loansQuery.error || settlementsQuery.error,
    refetch: () => {
      runsQuery.refetch();
      groupsQuery.refetch();
      kpisQuery.refetch();
      loansQuery.refetch();
      settlementsQuery.refetch();
    },
  };
}

export function usePayrollRun(id?: string | null) {
  const { payrollRuns, payrollDetails, isLoading, isError, error, refetch } = usePayroll();

  const run = useMemo(() => {
    if (!id) return null;
    return payrollRuns.find((r) => r.id === id) ?? null;
  }, [payrollRuns, id]);

  const details = useMemo(() => {
    if (!id) return [];
    return payrollDetails.filter((d) => d.payrollRunId === id);
  }, [payrollDetails, id]);

  return {
    run,
    data: run,
    details,
    isLoading,
    isError,
    error,
    refetch,
  };
}

export function usePayrollMutations() {
  const mode: MutationDataMode = "live";
  const queryClient = useQueryClient();

  const processPayrollRun = useCallback(
    async (groupId: string, year: number, month: number): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `payroll-run-${groupId}-${year}-${month}`,
        operation: async () => {
          const runRes = await runPayrollServer({ data: { payrollGroupId: groupId, year, month } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return Boolean(runRes);
        },
        onCommitted: () => {
          toast.success(`تم تشغيل واحتساب مسير الرواتب بنجاح لشهر ${month}/${year}`);
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تشغيل مسير الرواتب");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const approvePayrollRun = useCallback(
    async (runId: string, note: string = ""): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `payroll-approve-${runId}`,
        operation: async () => {
          const res = await updatePayrollRunStatusServer({ data: { runId, status: "approved" as any, note } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.kpis() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return Boolean(res);
        },
        onCommitted: () => {
          toast.success("تم اعتماد مسير الرواتب بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر اعتماد مسير الرواتب");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const lockAndConfirmPayrollRun = useCallback(
    async (runId: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `payroll-lock-${runId}`,
        operation: async () => {
          const res = await updatePayrollRunStatusServer({ data: { runId, status: "locked" } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.kpis() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.loans() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return Boolean(res);
        },
        onCommitted: () => {
          toast.success("تم إقفال واعتماد مسير الرواتب بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إقفال مسير الرواتب");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const reopenPayrollRun = useCallback(
    async (runId: string, reason: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `payroll-reopen-${runId}`,
        operation: async () => {
          const res = await updatePayrollRunStatusServer({ data: { runId, status: "draft", reason } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.kpis() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return Boolean(res);
        },
        onCommitted: () => {
          toast.success("تم إعادة فتح مسير الرواتب للتعديل بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إعادة فتح مسير الرواتب");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const markPayrollAsPaid = useCallback(
    async (runId: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `payroll-paid-${runId}`,
        operation: async () => {
          const res = await updatePayrollRunStatusRecord(runId, "paid");
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.kpis() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return Boolean(res ?? true);
        },
        onCommitted: () => {
          toast.success("تم صرف رواتب المسير وتحديث حالة الصرف بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث حالة صرف المسير");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const createLoan = useCallback(
    async (payload: {
      principalAmount: number;
      monthlyInstallment: number;
      totalInstallments: number;
      reason: string;
      employeeId?: string;
    }): Promise<boolean> => {
      const empId = payload.employeeId || "";
      if (!empId) {
        toast.error("يرجى تحديد الموظف المطلوب");
        return false;
      }

      const result = await executeReliableMutation({
        mode,
        mutationKey: `payroll-loan-${empId}-${payload.principalAmount}-${payload.totalInstallments}`,
        operation: async () => {
          const res = await createLoanRecord({
            employeeId: empId,
            principalAmount: payload.principalAmount,
            monthlyInstallment: payload.monthlyInstallment,
            totalInstallments: payload.totalInstallments,
            reason: payload.reason,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.loans() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return Boolean(res ?? true);
        },
        onCommitted: () => {
          toast.success("تم تسجيل السلفة بنجاح في النظام");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسجيل السلفة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const calculateSettlement = useCallback(
    async (input: SettlementInput): Promise<SettlementCalculationPreview> => {
      return (await calculateSettlementServer({ data: input })) as unknown as SettlementCalculationPreview;
    },
    [],
  );

  const createSettlement = useCallback(
    async (payload: SettlementInput | Omit<FinalSettlementRecord, "id">): Promise<boolean> => {
      const empId = payload.employeeId;
      const termDate = payload.terminationDate;
      const sepType = ((payload as any).separationType || "contract_expiration") as SettlementInput["separationType"];

      const result = await executeReliableMutation({
        mode,
        mutationKey: `payroll-settle-${empId}-${termDate}`,
        operation: async () => {
          const res = await createSettlementServer({
            data: {
              employeeId: empId,
              terminationDate: termDate,
              separationType: sepType,
              unpaidLeaveDays: (payload as any).unpaidLeaveDays ?? 0,
              notes: (payload as any).notes || (payload as any).eosbNotes,
              noticePeriodServed: (payload as any).noticePeriodServed ?? true,
              assetClearanceComplete: (payload as any).assetClearanceComplete ?? false,
            },
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.settlements() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.loans() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return Boolean(res);
        },
        onCommitted: () => {
          toast.success("تم اعتماد وإنشاء تسوية نهاية الخدمة بنجاح في النظام");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ تسوية نهاية الخدمة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return {
    processPayrollRun,
    approvePayrollRun,
    lockAndConfirmPayrollRun,
    reopenPayrollRun,
    markPayrollAsPaid,
    createLoan,
    calculateSettlement,
    createSettlement,
  };
}
