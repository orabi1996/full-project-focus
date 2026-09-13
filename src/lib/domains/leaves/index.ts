import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { EmployeeLeaveBalance, LeaveTypePolicy } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  adjustLeaveBalanceRecord,
  createLeaveTypeRecord,
} from "../../data/operational-repository";
import { createRequestRecord } from "../../data/hrms-repository";
import { accrueLeaveBalancesServer } from "../../business/leave.functions";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
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
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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

      const result = await executeReliableMutation({
        mode,
        mutationKey: `apply-leave-${empId}-${payload.startDate}-${payload.leaveTypeId}`,
        operation: async () => {
          await createRequestRecord(empId, "leave", {
            leaveTypeId: payload.leaveTypeId,
            startDate: payload.startDate,
            endDate: payload.endDate,
            totalDays: payload.totalDays,
            reason: payload.reason,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success(`تم تقديم طلب الإجازة بنجاح ومدتها (${payload.totalDays}) أيام`);
          return true;
        },
        demoOperation: () => {
          if (targetBalanceIndex >= 0) {
            demoStore.leaveBalances[targetBalanceIndex].usedDays += payload.totalDays;
            demoStore.leaveBalances[targetBalanceIndex].availableBalance -= payload.totalDays;
          }
          demoStore.notify();
          toast.success(`تم تقديم طلب الإجازة بنجاح ومدتها (${payload.totalDays}) أيام`);
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تقديم طلب الإجازة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
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

      const result = await executeReliableMutation({
        mode,
        mutationKey: `add-leave-type-${input.nameAr}`,
        operation: async () => {
          await createLeaveTypeRecord(newType);
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.types() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم إضافة نوع الإجازة بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.leaveTypes = [...demoStore.leaveTypes, newType];
          demoStore.notify();
          toast.success("تم إضافة نوع الإجازة الجديد بنجاح");
          return true;
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
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `adjust-leave-${employeeId}-${leaveTypeId}`,
        operation: async () => {
          await adjustLeaveBalanceRecord(employeeId, leaveTypeId, days);
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم تسوية وتعديل رصيد الإجازة بنجاح");
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
          toast.success("تم تسوية وتعديل رصيد الإجازة بنجاح");
          return true;
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
    async (year: number): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `accrue-leaves-${year}`,
        operation: async () => {
          await accrueLeaveBalancesServer({ data: { year } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success(`تم استحقاق وترحيل أرصدة الإجازات بنجاح لسنة ${year}`);
          return true;
        },
        demoOperation: () => {
          toast.success(`تم احتساب وترحيل استحقاقات الإجازات لسنة ${year} بنجاح`);
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر استحقاق أرصدة الإجازات");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return {
    applyLeave,
    addLeaveType,
    adjustLeaveBalance,
    accrueLeaveBalances,
  };
}
