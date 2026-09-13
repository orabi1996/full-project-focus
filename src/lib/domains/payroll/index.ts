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
import { runPayrollServer, updatePayrollRunStatusServer } from "../../business/payroll.functions";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function usePayroll() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoData = useDemoStore((s) => ({
    payrollGroups: s.payrollGroups,
    payrollRuns: s.payrollRuns,
    payrollDetails: s.payrollDetails,
    loans: s.loans,
    settlements: s.settlements,
  }));

  const payrollGroups = isLive ? bootstrap.payrollGroups : demoData.payrollGroups;
  const payrollRuns = isLive ? bootstrap.payrollRuns : demoData.payrollRuns;
  const payrollDetails = isLive ? bootstrap.payrollDetails : demoData.payrollDetails;
  const loans = isLive ? bootstrap.loans : demoData.loans;
  const settlements = isLive ? bootstrap.settlements : demoData.settlements;

  return {
    payrollGroups,
    payrollRuns,
    payrollDetails,
    loans,
    settlements,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
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
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const processPayrollRun = useCallback(
    async (groupId: string, year: number, month: number): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `payroll-run-${groupId}-${year}-${month}`,
        operation: async () => {
          await runPayrollServer({ data: { payrollGroupId: groupId, year, month } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success(`تم تشغيل واحتساب مسير الرواتب بنجاح لشهر ${month}/${year}`);
          return true;
        },
        demoOperation: () => {
          const group = demoStore.payrollGroups.find((g) => g.id === groupId);
          const employees = demoStore.employees;
          const newRun: PayrollRun = {
            id: `pr-${year}-${String(month).padStart(2, "0")}`,
            payrollGroupId: groupId,
            payrollGroupName: group?.nameAr || "المجموعة الرئيسية",
            periodYear: year,
            periodMonth: month,
            status: "ready_for_review",
            totalEmployees: employees.length,
            totalBasicSalary: employees.reduce((sum, e) => sum + e.basicSalary, 0),
            totalAllowances: employees.reduce((sum, e) => sum + (e.totalSalary - e.basicSalary), 0),
            totalOvertimeAmount: 12500,
            totalDeductions: 18400,
            totalNetSalary: employees.reduce((sum, e) => sum + e.totalSalary, 0) + 12500 - 18400,
            totalEmployerGosi: 21500,
          };

          demoStore.payrollRuns = [newRun, ...demoStore.payrollRuns.filter((r) => r.id !== newRun.id)];
          demoStore.notify();
          toast.success(`تم احتساب مسير رواتب شهر ${month}/${year} بنجاح`);
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تشغيل مسير الرواتب");
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
          await updatePayrollRunStatusServer({ data: { runId, status: "locked" } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم إقفال واعتماد مسير الرواتب بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.payrollRuns = demoStore.payrollRuns.map((r) =>
            r.id === runId
              ? { ...r, status: "confirmed_locked" as const, lockedAt: new Date().toISOString() }
              : r,
          );
          demoStore.notify();
          toast.success("تم إقفال واعتماد مسير الرواتب رسمياً");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إقفال مسير الرواتب");
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
          await updatePayrollRunStatusRecord(runId, "paid");
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(runId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم تسجيل صرف مسير الرواتب بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.payrollRuns = demoStore.payrollRuns.map((r) =>
            r.id === runId
              ? { ...r, status: "paid" as const, paidAt: new Date().toISOString() }
              : r,
          );
          demoStore.payrollDetails = demoStore.payrollDetails.map((d) =>
            d.payrollRunId === runId ? { ...d, paymentStatus: "paid" as const } : d,
          );
          demoStore.notify();
          toast.success("تم صرف رواتب المسير وتحديث حالة الصرف");
          return true;
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
      const empId = payload.employeeId || demoStore.employees[0]?.id || "emp-01";
      const newLoan: LoanRecord = {
        id: `loan-${Date.now()}`,
        employeeId: empId,
        employeeName: "موظف",
        loanType: "personal_advance",
        principalAmount: payload.principalAmount,
        monthlyInstallment: payload.monthlyInstallment,
        totalInstallments: payload.totalInstallments,
        paidInstallments: 0,
        remainingBalance: payload.principalAmount,
        startDate: new Date().toISOString().split("T")[0],
        reason: payload.reason,
        status: "active",
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `payroll-loan-${empId}-${payload.principalAmount}-${payload.totalInstallments}`,
        operation: async () => {
          await createLoanRecord({
            employeeId: empId,
            principalAmount: payload.principalAmount,
            monthlyInstallment: payload.monthlyInstallment,
            totalInstallments: payload.totalInstallments,
            reason: payload.reason,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.loans() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم تسجيل السلفة بنجاح في النظام");
          return true;
        },
        demoOperation: () => {
          demoStore.loans = [newLoan, ...demoStore.loans];
          demoStore.notify();
          toast.success("تم تسجيل السلفة بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسجيل السلفة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const createSettlement = useCallback(
    async (settlement: Omit<FinalSettlementRecord, "id">): Promise<boolean> => {
      const newSettlement: FinalSettlementRecord = {
        ...settlement,
        id: `settle-${Date.now()}`,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `payroll-settle-${settlement.employeeId}-${settlement.terminationDate}`,
        operation: async () => {
          await createSettlementRecord(settlement);
          await queryClient.invalidateQueries({ queryKey: queryKeys.payroll.settlements() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم إنشاء وحفظ تسوية نهاية الخدمة بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.settlements = [newSettlement, ...demoStore.settlements];
          demoStore.notify();
          toast.success("تم حفظ مخالصة نهاية الخدمة بنجاح");
          return true;
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
    lockAndConfirmPayrollRun,
    markPayrollAsPaid,
    createLoan,
    createSettlement,
  };
}
