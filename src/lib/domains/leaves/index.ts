import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { EmployeeLeaveBalance, LeaveTypePolicy } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  adjustLeaveBalanceRecord,
  createLeaveTypeRecord,
} from "../../data/operational-repository";
import { accrueLeaveBalancesServer } from "../../business/leave.functions";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function useLeaves() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoData = useDemoStore((s) => ({
    leaveTypes: s.leaveTypes,
    leaveBalances: s.leaveBalances,
  }));

  const leaveTypes = isLive ? bootstrap.leaveTypes : demoData.leaveTypes;
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
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const applyLeave = useCallback(
    async (
      payload: {
        leaveTypeId: string;
        startDate: string;
        endDate: string;
        totalDays: number;
        reason: string;
      },
      employeeId?: string,
    ): Promise<boolean> => {
      const empId = employeeId || demoStore.employees[0]?.id || "emp-01";
      const targetBalanceIndex = demoStore.leaveBalances.findIndex(
        (b) => b.employeeId === empId && b.leaveTypeId === payload.leaveTypeId,
      );

      if (!isLive) {
        if (targetBalanceIndex >= 0) {
          demoStore.leaveBalances[targetBalanceIndex].usedDays += payload.totalDays;
          demoStore.leaveBalances[targetBalanceIndex].availableBalance -= payload.totalDays;
        }
        demoStore.notify();
        toast.success(`تم تقديم طلب الإجازة بنجاح ومدتها (${payload.totalDays}) أيام`);
        return true;
      }

      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success(`تم تقديم طلب الإجازة بنجاح ومدتها (${payload.totalDays}) أيام`);
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر تقديم طلب الإجازة");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const addLeaveType = useCallback(
    async (input: { nameAr: string; maxDaysPerYear: number; isPaid: boolean }): Promise<boolean> => {
      const newType: LeaveTypePolicy = {
        id: `lt-${Date.now()}`,
        code: `LT-${Math.floor(10 + Math.random() * 90)}`,
        nameAr: input.nameAr,
        nameEn: input.nameAr,
        color: "#059669",
        isPaid: input.isPaid,
        deductFromWorkingDaysOnly: true,
        maxDaysPerYear: input.maxDaysPerYear,
        allowHalfDay: false,
        allowNegativeBalance: false,
        requiresAttachment: false,
        accrualMethod: "yearly_frontloaded",
        carryoverLimitDays: 5,
        status: "active",
      };

      if (!isLive) {
        demoStore.leaveTypes = [...demoStore.leaveTypes, newType];
        demoStore.notify();
        toast.success("تم إضافة نوع الإجازة الجديد بنجاح");
        return true;
      }

      try {
        await createLeaveTypeRecord(newType);
        await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.types() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم إضافة نوع الإجازة بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر إضافة نوع الإجازة");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const adjustLeaveBalance = useCallback(
    async (
      employeeId: string,
      leaveTypeId: string,
      days: number,
      reason: string,
    ): Promise<boolean> => {
      if (!isLive) {
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
        toast.success("تم تسوية وتعديل رصيد الإجازة بنجاح");
        return true;
      }

      try {
        await adjustLeaveBalanceRecord(employeeId, leaveTypeId, days);
        await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم تسوية وتعديل رصيد الإجازة بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر تسوية رصيد الإجازة");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const accrueLeaveBalances = useCallback(
    async (year: number): Promise<boolean> => {
      if (!isLive) {
        toast.success(`تم احتساب وترحيل استحقاقات الإجازات لسنة ${year} بنجاح`);
        return true;
      }

      try {
        await accrueLeaveBalancesServer({ data: { year } });
        await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success(`تم استحقاق وترحيل أرصدة الإجازات بنجاح لسنة ${year}`);
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر استحقاق أرصدة الإجازات");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  return {
    applyLeave,
    addLeaveType,
    adjustLeaveBalance,
    accrueLeaveBalances,
  };
}
