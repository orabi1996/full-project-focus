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
  fetchMyLeaveRequestsRecord,
  createLeaveTypeRecord,
  type CreateLeaveTypeInput,
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
import { toast } from "sonner";

export function useMyLeaveBalances(year?: number, employeeId?: string) {
  const { session } = useAuth();
  const targetYear = year || new Date().getFullYear();

  const query = useQuery({
    queryKey: queryKeys.leaves.myBalances(targetYear),
    queryFn: () => fetchMyLeaveBalancesRecord(targetYear, employeeId),
    enabled: Boolean(session),
    staleTime: 60 * 1000,
  });

  return {
    balances: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCompanyLeaveBalances(
  year?: number,
  departmentId?: string,
  options?: { enabled?: boolean },
) {
  const { session } = useAuth();
  const targetYear = year || new Date().getFullYear();

  const query = useQuery({
    queryKey: queryKeys.leaves.adminBalances({ year: targetYear, departmentId }),
    queryFn: () => fetchCompanyLeaveBalancesRecord(targetYear, departmentId),
    enabled: Boolean(session) && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });

  return {
    balances: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useMyLeaveRequests(year?: number) {
  const { session } = useAuth();
  const targetYear = year || new Date().getFullYear();

  const query = useQuery({
    queryKey: ["my-leave-requests", targetYear],
    queryFn: () => fetchMyLeaveRequestsRecord(targetYear),
    enabled: Boolean(session),
    staleTime: 60 * 1000,
  });

  return {
    requests: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLeaveTypes() {
  const bootstrap = useBootstrapData();

  const leaveTypes = (bootstrap.leaveTypes as LeaveTypePolicy[]) ?? [];

  return {
    leaveTypes,
    isLoading: bootstrap.isLoading,
    isError: bootstrap.isError,
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
  const { session } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.leaves.teamCalendar({ startDate, endDate, departmentId }),
    queryFn: () => fetchTeamLeaveCalendarRecord(startDate, endDate, departmentId),
    enabled: Boolean(session && startDate && endDate),
    staleTime: 60 * 1000,
  });

  return {
    calendarItems: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLeaves() {
  const bootstrap = useBootstrapData();

  return {
    leaveTypes: (bootstrap.leaveTypes as LeaveTypePolicy[]) ?? [],
    leaveBalances: bootstrap.leaveBalances ?? [],
    isLoading: bootstrap.isLoading,
    isError: bootstrap.isError,
    error: bootstrap.error,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useLeaveMutations() {
  const mode: MutationDataMode = "live";
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
      const empId = employeeId || "";

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
    async (input: CreateLeaveTypeInput): Promise<boolean> => {
      const newType: LeaveTypePolicy = {
        id: `lt-${Date.now()}`,
        code: input.code || `LT-${Math.floor(10 + Math.random() * 90)}`,
        nameAr: input.nameAr,
        nameEn: input.nameEn || "",
        color: input.color || "#059669",
        isPaid: input.isPaid,
        deductFromWorkingDaysOnly: input.deductFromWorkingDaysOnly,
        maxDaysPerYear: input.maxDaysPerYear,
        allowHalfDay: input.allowHalfDay,
        allowNegativeBalance: input.allowNegativeBalance,
        requiresAttachment: input.requiresAttachment,
        accrualMethod: input.accrualMethod,
        carryoverLimitDays: input.carryoverLimitDays,
        carryoverExpiryMonths: input.carryoverExpiryMonths,
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
      periodMonth?: number,
      leaveTypeId?: string,
      companyId?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `accrue-leaves-${year}-${periodMonth || "all"}`,
        operation: async () => {
          await runLeaveAccrualRecord(year, periodMonth, leaveTypeId, companyId);
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
    async (year: number, companyId?: string, asOfDate?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `expire-carryover-${year}-${companyId || "all"}`,
        operation: async () => {
          await runLeaveCarryoverExpiryRecord(year, asOfDate, companyId);
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
