import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { EmployeeLeaveBalance, LeaveTypePolicy, TeamLeaveCalendarItem } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  submitLeaveRequestRecord,
  resubmitLeaveRequestRecord,
  decideLeaveRequestRecord,
  fetchMyLeaveBalancesRecord,
  fetchCompanyLeaveBalancesRecord,
  fetchTeamLeaveCalendarRecord,
  createLeaveTypeRecord,
  adjustLeaveBalanceRecord,
  runLeaveAccrualRecord,
  runLeaveCarryoverRecord,
  runLeaveCarryoverExpiryRecord,
  uploadLeaveAttachmentRecord,
  cleanupStagedLeaveAttachmentRecord,
} from "../../data/operational-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function useMyLeaveBalances(year?: number, employeeId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const targetYear = year || new Date().getFullYear();

  const demoBalances = useDemoStore((s) => s.leaveBalances);

  const query = useQuery({
    queryKey: queryKeys.leaves.myBalances(targetYear),
    queryFn: () => fetchMyLeaveBalancesRecord(targetYear, employeeId),
    enabled: isLive,
    staleTime: 60 * 1000,
  });

  if (!isLive) {
    const filtered = employeeId
      ? demoBalances.filter((b) => b.employeeId === employeeId)
      : demoBalances;
    return {
      balances: filtered,
      isLoading: false,
      isError: false,
      error: null,
      refetch: async () => ({ data: filtered }),
    };
  }

  return {
    balances: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCompanyLeaveBalances(year?: number, departmentId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const targetYear = year || new Date().getFullYear();

  const demoBalances = useDemoStore((s) => s.leaveBalances);

  const query = useQuery({
    queryKey: queryKeys.leaves.adminBalances({ year: targetYear, departmentId }),
    queryFn: () => fetchCompanyLeaveBalancesRecord(targetYear, departmentId),
    enabled: isLive,
    staleTime: 60 * 1000,
  });

  if (!isLive) {
    return {
      balances: demoBalances,
      isLoading: false,
      isError: false,
      error: null,
      refetch: async () => ({ data: demoBalances }),
    };
  }

  return {
    balances: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLeaveTypes() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoTypes = useDemoStore((s) => s.leaveTypes);

  const leaveTypes = isLive ? (bootstrap.leaveTypes as LeaveTypePolicy[]) : demoTypes;

  return {
    leaveTypes,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: queryError(bootstrap),
    refetch: bootstrap.refreshCoreData,
  };
}

function queryError(bootstrap: { isError: boolean; error: unknown }) {
  return bootstrap.isError ? bootstrap.error : null;
}

export function useLeaveTeamCalendar(
  startDate: string,
  endDate: string,
  departmentId?: string,
) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: queryKeys.leaves.teamCalendar({ startDate, endDate, departmentId }),
    queryFn: () => fetchTeamLeaveCalendarRecord(startDate, endDate, departmentId),
    enabled: isLive && Boolean(startDate && endDate),
    staleTime: 60 * 1000,
  });

  if (!isLive) {
    const demoItems: TeamLeaveCalendarItem[] = [];
    return {
      calendarItems: demoItems,
      isLoading: false,
      isError: false,
      error: null,
      refetch: async () => ({ data: demoItems }),
    };
  }

  return {
    calendarItems: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLeaves() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoData = useDemoStore((s) => ({
    leaveTypes: s.leaveTypes,
    leaveBalances: s.leaveBalances,
  }));

  const leaveTypes = isLive ? (bootstrap.leaveTypes as LeaveTypePolicy[]) : demoData.leaveTypes;
  const leaveBalances = isLive ? bootstrap.leaveBalances : demoData.leaveBalances;

  return {
    leaveTypes,
    leaveBalances,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useLeaveMutations() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const applyLeave = useCallback(
    async (
      payload: {
        leaveTypeId: string;
        startDate: string;
        endDate: string;
        isHalfDay?: boolean;
        halfDayPeriod?: "first_half" | "second_half";
        reason: string;
        replacementEmployeeId?: string;
        emergencyPhone?: string;
        attachmentFileId?: string;
        totalDays?: number;
      },
      employeeId?: string,
    ): Promise<boolean> => {
      const empId = employeeId || demoStore.employees[0]?.id || "emp-01";
      const targetBalanceIndex = demoStore.leaveBalances.findIndex(
        (b) => b.employeeId === empId && b.leaveTypeId === payload.leaveTypeId,
      );

      const result = await executeReliableMutation({
        mode,
        mutationKey: `apply-leave-${empId}-${payload.startDate}-${payload.leaveTypeId}`,
        operation: async () => {
          await submitLeaveRequestRecord({
            leaveTypeId: payload.leaveTypeId,
            startDate: payload.startDate,
            endDate: payload.endDate,
            isHalfDay: payload.isHalfDay,
            halfDayPeriod: payload.halfDayPeriod,
            reason: payload.reason,
            replacementEmployeeId: payload.replacementEmployeeId,
            emergencyPhone: payload.emergencyPhone,
            attachmentFileId: payload.attachmentFileId,
            targetEmployeeId: employeeId,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          return true;
        },
        demoOperation: () => {
          const days = payload.totalDays || 1;
          if (targetBalanceIndex >= 0) {
            demoStore.leaveBalances[targetBalanceIndex].reservedDays += days;
            demoStore.leaveBalances[targetBalanceIndex].availableBalance -= days;
          }
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم تقديم طلب الإجازة وحجز الرصيد بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تقديم طلب الإجازة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const resubmitLeave = useCallback(
    async (payload: {
      requestId: string;
      startDate: string;
      endDate: string;
      isHalfDay?: boolean;
      halfDayPeriod?: "first_half" | "second_half";
      reason: string;
      replacementEmployeeId?: string;
      emergencyPhone?: string;
      attachmentFileId?: string;
    }): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `resubmit-leave-${payload.requestId}`,
        operation: async () => {
          await resubmitLeaveRequestRecord(payload);
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم إعادة تقديم طلب الإجازة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إعادة تقديم طلب الإجازة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const decideLeave = useCallback(
    async (
      requestId: string,
      decision: "approved" | "rejected" | "returned" | "withdrawn",
      note?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `decide-leave-${requestId}-${decision}`,
        operation: async () => {
          await decideLeaveRequestRecord(requestId, decision, note);
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          const label =
            decision === "approved"
              ? "تمت الموافقة على الإجازة وتسوية الرصيد بنجاح"
              : decision === "rejected"
              ? "تم رفض الإجازة وإلغاء حجز الرصيد"
              : "تم تحديث حالة طلب الإجازة بنجاح";
          toast.success(label);
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر معالجة قرار الإجازة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const addLeaveType = useCallback(
    async (input: {
      nameAr: string;
      nameEn?: string;
      code?: string;
      maxDaysPerYear: number;
      isPaid: boolean;
      deductFromWorkingDaysOnly?: boolean;
      allowHalfDay?: boolean;
      allowNegativeBalance?: boolean;
      requiresAttachment?: boolean;
      accrualMethod?: "yearly_frontloaded" | "monthly_accrual" | "contract_anniversary";
      carryoverLimitDays?: number;
      carryoverExpiryMonths?: number;
      jurisdiction?: string;
      companyId?: string;
    }): Promise<boolean> => {
      const newType: LeaveTypePolicy = {
        id: `lt-${Date.now()}`,
        code: input.code || `LT-${Math.floor(10 + Math.random() * 90)}`,
        nameAr: input.nameAr,
        nameEn: input.nameEn || input.nameAr,
        color: "#059669",
        isPaid: input.isPaid,
        deductFromWorkingDaysOnly: input.deductFromWorkingDaysOnly ?? true,
        maxDaysPerYear: input.maxDaysPerYear,
        allowHalfDay: input.allowHalfDay ?? true,
        allowNegativeBalance: input.allowNegativeBalance ?? false,
        requiresAttachment: input.requiresAttachment ?? false,
        accrualMethod: input.accrualMethod || "yearly_frontloaded",
        carryoverLimitDays: input.carryoverLimitDays ?? 0,
        carryoverExpiryMonths: input.carryoverExpiryMonths ?? 3,
        jurisdiction: input.jurisdiction || "",
        status: "active",
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `add-leave-type-${input.nameAr}`,
        operation: async () => {
          await createLeaveTypeRecord(input);
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.types() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
          return true;
        },
        demoOperation: () => {
          demoStore.leaveTypes = [...demoStore.leaveTypes, newType];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إضافة نوع وسياسة الإجازة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة نوع الإجازة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const adjustLeaveBalance = useCallback(
    async (
      employeeId: string,
      leaveTypeId: string,
      days: number,
      reason: string,
      year?: number,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `adjust-leave-${employeeId}-${leaveTypeId}`,
        operation: async () => {
          await adjustLeaveBalanceRecord(employeeId, leaveTypeId, days, reason, year);
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
          return true;
        },
        demoOperation: () => {
          demoStore.leaveBalances = demoStore.leaveBalances.map((b) => {
            if (b.employeeId === employeeId && b.leaveTypeId === leaveTypeId) {
              return {
                ...b,
                accruedDays: b.accruedDays + days,
                availableBalance: b.availableBalance + days,
              };
            }
            return b;
          });
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم تعديل وتسوية رصيد الإجازة وتوثيق الحركة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسوية رصيد الإجازة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const accrueLeaveBalances = useCallback(
    async (
      year: number,
      month?: number,
      leaveTypeId?: string,
      companyId?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `accrue-leaves-${year}-${month || "all"}`,
        operation: async () => {
          await runLeaveAccrualRecord(year, month, leaveTypeId, companyId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success(`تم استحقاق وترحيل أرصدة الإجازات بنجاح لسنة ${year}`);
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر استحقاق أرصدة الإجازات");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const carryoverLeaveBalances = useCallback(
    async (
      sourceYear: number,
      targetYear: number,
      leaveTypeId?: string,
      companyId?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `carryover-leaves-${sourceYear}-${targetYear}`,
        operation: async () => {
          await runLeaveCarryoverRecord(sourceYear, targetYear, leaveTypeId, companyId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success(`تم ترحيل أرصدة الإجازات بنجاح من ${sourceYear} إلى ${targetYear}`);
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر ترحيل أرصدة الإجازات");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const expireCarryoverBalances = useCallback(
    async (companyId?: string, referenceDate?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `expire-carryover-${companyId || "all"}`,
        operation: async () => {
          await runLeaveCarryoverExpiryRecord(companyId, referenceDate);
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم إنهاء صلاحية الأرصدة المرحلة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إنهاء صلاحية الأرصدة المرحلة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return {
    applyLeave,
    resubmitLeave,
    decideLeave,
    addLeaveType,
    adjustLeaveBalance,
    accrueLeaveBalances,
    carryoverLeaveBalances,
    expireCarryoverBalances,
  };
}
