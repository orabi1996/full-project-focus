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
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function usePayroll(filters?: Record<string, unknown>) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const runsQuery = usePayrollRuns(filters);
  const groupsQuery = usePayrollGroups();
  const kpisQuery = usePayrollKpis();
  const loansQuery = usePayrollLoans();
  const settlementsQuery = usePayrollSettlements();

  const demoData = useDemoStore((s) => ({
    payrollGroups: s.payrollGroups,
    payrollRuns: s.payrollRuns,
    payrollDetails: s.payrollDetails,
    loans: s.loans,
    settlements: s.settlements,
  }));

  const payrollGroups = isLive
    ? (groupsQuery.data ?? [])
    : demoData.payrollGroups;
  const payrollRuns = isLive
    ? (runsQuery.data ?? [])
    : demoData.payrollRuns;
  const payrollDetails = isLive ? [] : demoData.payrollDetails;
  const loans = isLive ? (loansQuery.data ?? []) : demoData.loans;
  const settlements = isLive ? (settlementsQuery.data ?? []) : demoData.settlements;
  const kpis = isLive ? kpisQuery.data : null;

  return {
    payrollGroups,
    payrollRuns,
    payrollDetails,
    loans,
    settlements,
    kpis,
    isLoading: isLive
      ? (runsQuery.isLoading || groupsQuery.isLoading || loansQuery.isLoading || settlementsQuery.isLoading)
      : false,
    isError: isLive
      ? (runsQuery.isError || groupsQuery.isError || loansQuery.isError || settlementsQuery.isError)
      : false,
    error: isLive
      ? (runsQuery.error || groupsQuery.error || loansQuery.error || settlementsQuery.error)
      : null,
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
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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
          return true;
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
        demoOperation: () => {
          demoStore.payrollRuns = demoStore.payrollRuns.map((r) =>
            r.id === runId
              ? { ...r, status: "approved" as any, approvedAt: new Date().toISOString() }
              : r,
          );
          demoStore.notify();
          return true;
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
        demoOperation: () => {
          demoStore.payrollRuns = demoStore.payrollRuns.map((r) =>
            r.id === runId
              ? { ...r, status: "confirmed_locked" as const, lockedAt: new Date().toISOString() }
              : r,
          );
          demoStore.notify();
          return true;
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
        demoOperation: () => {
          demoStore.payrollRuns = demoStore.payrollRuns.map((r) =>
            r.id === runId
              ? { ...r, status: "draft" as const, lockedAt: undefined, approvedAt: undefined }
              : r,
          );
          demoStore.notify();
          return true;
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
          return true;
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
        demoOperation: () => {
          demoStore.loans = [newLoan, ...demoStore.loans];
          demoStore.notify();
          return true;
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
      if (mode === "live") {
        return (await calculateSettlementServer({ data: input })) as unknown as SettlementCalculationPreview;
      } else {
        const emp = demoStore.employees.find((e) => e.id === input.employeeId);
        if (!emp) throw new Error("الموظف غير موجود في بيانات التجربة");
        const eosb = calculateEOSB({
          totalMonthlyWage: emp.totalSalary,
          startDate: emp.hireDate,
          endDate: input.terminationDate,
          separationType: input.separationType,
          unpaidLeaveDays: input.unpaidLeaveDays ?? 0,
        });
        const dailyRate = Math.round((emp.totalSalary / 30.0) * 100) / 100;
        const leaveDays = 15;
        const leavePayout = Math.round(leaveDays * dailyRate);
        const openLoan = demoStore.loans.find((l) => l.employeeId === input.employeeId && l.status === "active");
        const loanDeduction = openLoan ? openLoan.remainingBalance : 0;
        const net = Math.max(0, eosb.finalEOSBAmount + leavePayout - loanDeduction);

        return {
          ok: true,
          employeeId: emp.id,
          employeeNo: emp.employeeNo,
          employeeName: `${emp.firstNameAr} ${emp.lastNameAr}`,
          hireDate: emp.hireDate,
          terminationDate: input.terminationDate,
          separationType: input.separationType,
          serviceYears: eosb.serviceYears,
          serviceMonths: eosb.serviceMonths,
          serviceDays: 0,
          totalServiceYearsDecimal: eosb.totalServiceYearsDecimal,
          totalMonthlyWage: emp.totalSalary,
          dailyRate,
          calculationBasis: "fixed_30_days",
          grossEosb: eosb.finalEOSBAmount,
          resignationMultiplier: eosb.resignationMultiplier,
          eosbAmount: eosb.finalEOSBAmount,
          leaveBalancePayoutDays: leaveDays,
          leavePayoutAmount: leavePayout,
          pendingSalaryAmount: 0,
          loanDeductionAmount: loanDeduction,
          netSettlementAmount: net,
          calculationSnapshot: {
            mode: "demo",
            statutory_policy: "SA_LABOR_LAW_ARTICLES_84_85",
          },
        };
      }
    },
    [mode],
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
        demoOperation: () => {
          const emp = demoStore.employees.find((e) => e.id === empId);
          const newSettlement: FinalSettlementRecord = {
            id: `settle-${Date.now()}`,
            employeeId: empId,
            employeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "موظف",
            terminationDate: termDate,
            noticePeriodServed: (payload as any).noticePeriodServed ?? true,
            serviceYears: (payload as any).serviceYears ?? 3,
            serviceMonths: (payload as any).serviceMonths ?? 0,
            eosbAmount: (payload as any).eosbAmount ?? 15000,
            leaveBalancePayoutDays: (payload as any).leaveBalancePayoutDays ?? 15,
            leaveBalancePayoutAmount: (payload as any).leaveBalancePayoutAmount ?? 5000,
            pendingSalaryAmount: (payload as any).pendingSalaryAmount ?? 0,
            loanDeductionAmount: (payload as any).loanDeductionAmount ?? 0,
            assetClearanceComplete: (payload as any).assetClearanceComplete ?? false,
            netSettlementAmount: (payload as any).netSettlementAmount ?? 20000,
            eosbNotes: (payload as any).notes || (payload as any).eosbNotes || "تسوية تجريبية معتمدة",
            status: "draft",
          };
          demoStore.settlements = [newSettlement, ...demoStore.settlements];
          demoStore.notify();
          return true;
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
