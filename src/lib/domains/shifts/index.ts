import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type {
  ShiftDefinition,
  RosterPeriod,
  ScheduleAssignment,
  RosterException,
  ShiftSwapRequest,
  WorkweekConfig,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  fetchShiftDefinitions,
  fetchShiftDefinitionById,
  generateShiftCode,
  createShiftDefinition,
  updateShiftDefinition,
  archiveShiftDefinition,
  fetchRosterPeriods,
  fetchRosterPeriodById,
  createRosterPeriod,
  updateRosterPeriod,
  fetchScheduleAssignments,
  upsertScheduleAssignment,
  batchUpsertScheduleAssignments,
  deleteScheduleAssignment,
  detectRosterConflicts,
  publishRosterPeriod,
  copyRosterPeriod,
  fetchRosterExceptions,
  resolveRosterException,
  fetchShiftSwapRequests,
  createShiftSwapRequest,
  approveShiftSwap,
  rejectShiftSwap,
  fetchCompanyWorkweek,
  updateCompanyWorkweek,
  DEFAULT_WORKWEEK_CONFIG,
} from "../../data/shifts-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

// ----------------------------------------------------------------------------
// Shift Master Queries & Mutations
// ----------------------------------------------------------------------------

export function useShiftDefinitions(companyId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoShifts = useDemoStore((s) => s.shifts);

  const query = useQuery({
    queryKey: queryKeys.shifts.definitions({ companyId }),
    queryFn: () => fetchShiftDefinitions(companyId),
    enabled: isLive,
    staleTime: 1000 * 60 * 5, // 5 mins
  });

  const shifts: ShiftDefinition[] = isLive ? query.data ?? [] : demoShifts;

  return {
    shifts,
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: isLive ? query.error : null,
    refetch: query.refetch,
  };
}

// Backward compatible alias
export const useShifts = useShiftDefinitions;

export function useShiftDefinition(id: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoShifts = useDemoStore((s) => s.shifts);

  return useQuery({
    queryKey: queryKeys.shifts.definition(id),
    queryFn: () => fetchShiftDefinitionById(id),
    enabled: isLive && Boolean(id),
    initialData: !isLive ? demoShifts.find((s) => s.id === id) : undefined,
  });
}

export function useShiftMutations(companyId?: string) {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const getNewShiftCode = useCallback(async (): Promise<string> => {
    if (mode === "live") {
      try {
        return await generateShiftCode(companyId);
      } catch {
        return `SH-${Math.floor(100 + Math.random() * 900)}`;
      }
    }
    return `SH-${Math.floor(100 + Math.random() * 900)}`;
  }, [mode, companyId]);

  const addShift = useCallback(
    async (shift: Partial<ShiftDefinition>): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-shift-${shift.nameAr || Date.now()}`,
        operation: async () => {
          const created = await createShiftDefinition({
            ...shift,
            companyId: shift.companyId || companyId,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return created;
        },
        demoOperation: () => {
          const newShift: ShiftDefinition = {
            id: `sh-${Date.now()}`,
            code: shift.code || `SH-${Math.floor(100 + Math.random() * 900)}`,
            nameAr: shift.nameAr || "",
            nameEn: shift.nameEn || shift.nameAr || "",
            color: shift.color || "#0284c7",
            type: shift.type || "fixed",
            startTime: shift.startTime || "08:00",
            endTime: shift.endTime || "17:00",
            flexibleHours: shift.flexibleHours,
            splitSecondStartTime: shift.splitSecondStartTime,
            splitSecondEndTime: shift.splitSecondEndTime,
            graceMinutesArrival: shift.graceMinutesArrival ?? 15,
            graceMinutesDeparture: shift.graceMinutesDeparture ?? 15,
            allowSinglePunch: Boolean(shift.allowSinglePunch),
            overtimeEligible: Boolean(shift.overtimeEligible),
            version: 1,
            status: "active",
            effectiveFrom: shift.effectiveFrom,
            effectiveTo: shift.effectiveTo,
            breakType: shift.breakType || "none",
            autoDeductBreaks: Boolean(shift.autoDeductBreaks),
            minRestHoursAfter: shift.minRestHoursAfter ?? 11,
            segments: shift.segments,
          };
          demoStore.shifts = [...demoStore.shifts, newShift];
          demoStore.notify();
          return newShift;
        },
        onCommitted: () => {
          toast.success("تم إنشاء وحفظ وردية العمل بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ وردية العمل");
        },
      });

      return result.ok;
    },
    [mode, companyId, queryClient],
  );

  const updateShift = useCallback(
    async (shiftId: string, shift: Partial<ShiftDefinition>): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-shift-${shiftId}`,
        operation: async () => {
          await updateShiftDefinition(shiftId, shift);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.shifts = demoStore.shifts.map((s) =>
            s.id === shiftId ? { ...s, ...shift, version: (s.version || 1) + 1 } : s,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث سياسة الوردية وإصدار النسخة الجديدة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث الوردية");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const archiveShift = useCallback(
    async (shiftId: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `archive-shift-${shiftId}`,
        operation: async () => {
          const archived = await archiveShiftDefinition(shiftId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return archived;
        },
        demoOperation: () => {
          demoStore.shifts = demoStore.shifts.map((s) =>
            s.id === shiftId ? { ...s, status: "archived" } : s,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم أرشفة الوردية بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر أرشفة الوردية");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return {
    addShift,
    updateShift,
    archiveShift,
    getNewShiftCode,
  };
}

// ----------------------------------------------------------------------------
// Roster Periods Queries & Mutations
// ----------------------------------------------------------------------------

export function useRosterPeriods(filters?: { companyId?: string; status?: string }) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: queryKeys.shifts.rosters(filters),
    queryFn: () => fetchRosterPeriods(filters?.companyId, filters?.status),
    enabled: isLive,
    staleTime: 1000 * 60 * 2,
  });

  return {
    periods: query.data ?? [],
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useRosterPeriod(id: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.shifts.roster(id),
    queryFn: () => fetchRosterPeriodById(id),
    enabled: isLive && Boolean(id),
  });
}

// ----------------------------------------------------------------------------
// Schedule Assignments Queries
// ----------------------------------------------------------------------------

export function useRosterAssignments(
  rosterPeriodId?: string,
  filters?: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    companyId?: string;
    status?: "draft" | "published";
  },
) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: queryKeys.shifts.assignments(rosterPeriodId, filters),
    queryFn: () => fetchScheduleAssignments(rosterPeriodId, filters),
    enabled: isLive && (Boolean(rosterPeriodId) || Boolean(filters?.startDate)),
    staleTime: 1000 * 60 * 2,
  });

  return {
    assignments: query.data ?? [],
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// Roster Exceptions Queries
// ----------------------------------------------------------------------------

export function useRosterExceptions(rosterPeriodId?: string, unresolvedOnly: boolean = false) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: queryKeys.shifts.exceptions(rosterPeriodId),
    queryFn: () => fetchRosterExceptions(rosterPeriodId, unresolvedOnly),
    enabled: isLive && Boolean(rosterPeriodId),
    staleTime: 1000 * 30, // 30s
  });

  return {
    exceptions: query.data ?? [],
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// Shift Swap Requests Queries
// ----------------------------------------------------------------------------

export function useShiftSwapRequests(filters?: { companyId?: string; status?: string; employeeId?: string }) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: queryKeys.shifts.swapRequests(filters),
    queryFn: () => fetchShiftSwapRequests(filters?.companyId, filters),
    enabled: isLive,
    staleTime: 1000 * 60,
  });

  return {
    swapRequests: query.data ?? [],
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// Company Workweek Query
// ----------------------------------------------------------------------------

export function useCompanyWorkweek(companyId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: queryKeys.shifts.workweek(),
    queryFn: () => fetchCompanyWorkweek(companyId),
    enabled: isLive && Boolean(companyId),
    staleTime: 1000 * 60 * 10, // 10 mins
  });

  return {
    workweek: query.data ?? DEFAULT_WORKWEEK_CONFIG,
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// Roster Mutations Hook (Full Engine Operations)
// ----------------------------------------------------------------------------

export function useRosterMutations(companyId?: string) {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const createPeriod = useCallback(
    async (period: Partial<RosterPeriod>): Promise<RosterPeriod | null> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-roster-period-${period.name}`,
        operation: async () => {
          const created = await createRosterPeriod({
            ...period,
            companyId: period.companyId || companyId,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
          return created;
        },
        demoOperation: () => {
          return {
            id: `roster-${Date.now()}`,
            companyId: companyId || "demo-co",
            name: period.name || "فترة جديدة",
            startDate: period.startDate || new Date().toISOString().substring(0, 10),
            endDate: period.endDate || new Date().toISOString().substring(0, 10),
            timezone: period.timezone || "Asia/Riyadh",
            status: "draft",
            version: 1,
            publishedAt: null,
            publishedBy: null,
            lockedAt: null,
            createdBy: null,
            notes: period.notes || null,
          } as RosterPeriod;
        },
        onCommitted: () => {
          toast.success("تم إنشاء فترة الجدولة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إنشاء فترة الجدولة");
        },
      });

      return result.data ?? null;
    },
    [mode, companyId, queryClient],
  );

  const updatePeriod = useCallback(
    async (id: string, updates: Partial<RosterPeriod>): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-roster-period-${id}`,
        operation: async () => {
          await updateRosterPeriod(id, updates);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success("تم تحديث بيانات فترة الجدولة");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث فترة الجدولة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const saveAssignment = useCallback(
    async (assignment: Partial<ScheduleAssignment>): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `save-assignment-${assignment.employeeId}-${assignment.date}`,
        operation: async () => {
          await upsertScheduleAssignment({
            ...assignment,
            companyId: assignment.companyId || companyId,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.assignments() });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success("تم حفظ إسناد الوردية بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ إسناد الوردية");
        },
      });

      return result.ok;
    },
    [mode, companyId, queryClient],
  );

  const batchSaveAssignments = useCallback(
    async (assignments: Partial<ScheduleAssignment>[]): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `batch-save-assignments-${Date.now()}`,
        operation: async () => {
          await batchUpsertScheduleAssignments(
            assignments.map((a) => ({
              ...a,
              companyId: a.companyId || companyId,
            })),
          );
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.assignments() });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success(`تم حفظ ${assignments.length} إسناد بنجاح`);
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ إسنادات الورديات");
        },
      });

      return result.ok;
    },
    [mode, companyId, queryClient],
  );

  const removeAssignment = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `remove-assignment-${id}`,
        operation: async () => {
          await deleteScheduleAssignment(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.assignments() });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success("تم حذف إسناد الوردية بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حذف إسناد الوردية");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const checkConflicts = useCallback(
    async (rosterPeriodId: string) => {
      if (mode === "live") {
        try {
          const res = await detectRosterConflicts(rosterPeriodId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.exceptions(rosterPeriodId) });
          if (res.conflictCount === 0) {
            toast.success("جدول الورديات متوافق بالكامل ولا توجد أي تعارضات أو مخالفات");
          } else if (res.errorsCount > 0) {
            toast.error(`تم رصد ${res.errorsCount} تعارض حرج يمنع النشر و${res.warningsCount} تنبيه`);
          } else {
            toast.warning(`الجدول صالح للنشر مع وجود ${res.warningsCount} تنبيه/توجيه`);
          }
          return res;
        } catch (err: any) {
          toast.error(err.message || "تعذر فحص التعارضات");
          return null;
        }
      }
      toast.success("الجدول متوافق (وضع تجريبي)");
      return { ok: true, conflictCount: 0, errorsCount: 0, warningsCount: 0, exceptions: [] };
    },
    [mode, queryClient],
  );

  const publish = useCallback(
    async (rosterPeriodId: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `publish-roster-${rosterPeriodId}`,
        operation: async () => {
          const res = await publishRosterPeriod(rosterPeriodId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          return res;
        },
        demoOperation: () => ({ ok: true, publishedAssignments: 10, rosterVersion: 1, message: "تم النشر تجريبياً" }),
        onCommitted: (data) => {
          toast.success(data?.message || "تم نشر جدول الورديات واعتماده كجدول رسمي لوحدة الحضور والانصراف");
        },
        onRejected: (err) => {
          toast.error(err.message || "فشل نشر الجدول لوجود تعارضات حرجة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const copyPeriod = useCallback(
    async (
      sourcePeriodId: string,
      newStartDate: string,
      newEndDate: string,
      newName?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `copy-roster-${sourcePeriodId}`,
        operation: async () => {
          const res = await copyRosterPeriod(sourcePeriodId, newStartDate, newEndDate, newName);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
          return res;
        },
        demoOperation: () => ({ ok: true, newRosterPeriodId: `roster-${Date.now()}`, copiedAssignmentsCount: 15 }),
        onCommitted: (data) => {
          toast.success(`تم نسخ الفترة بنجاح مع تكرار ${data?.copiedAssignmentsCount ?? 0} إسناد عمل`);
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر نسخ فترة الجدولة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const resolveException = useCallback(
    async (exceptionId: string, rosterPeriodId?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `resolve-exception-${exceptionId}`,
        operation: async () => {
          await resolveRosterException(exceptionId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.exceptions(rosterPeriodId) });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success("تم تسوية وتجاهل التعارض بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسوية التعارض");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const createSwap = useCallback(
    async (payload: Partial<ShiftSwapRequest>): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `swap-request-${payload.requesterId}-${Date.now()}`,
        operation: async () => {
          await createShiftSwapRequest({
            ...payload,
            companyId: payload.companyId || companyId,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.swapRequests() });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success("تم إرسال طلب تبديل الوردية بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إرسال طلب التبديل");
        },
      });

      return result.ok;
    },
    [mode, companyId, queryClient],
  );

  const approveSwap = useCallback(
    async (swapRequestId: string, notes?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `approve-swap-${swapRequestId}`,
        operation: async () => {
          const res = await approveShiftSwap(swapRequestId, notes);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          return res;
        },
        demoOperation: () => ({ ok: true, message: "تمت الموافقة تجريبياً" }),
        onCommitted: () => {
          toast.success("تمت الموافقة على تبديل الورديتين وتحديث جدول العمل فوراً");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر اعتماد طلب التبديل");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const rejectSwap = useCallback(
    async (swapRequestId: string, notes?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `reject-swap-${swapRequestId}`,
        operation: async () => {
          await rejectShiftSwap(swapRequestId, notes);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.swapRequests() });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success("تم رفض طلب تبديل الوردية");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر رفض طلب التبديل");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const saveWorkweek = useCallback(
    async (config: WorkweekConfig): Promise<boolean> => {
      if (!companyId) {
        toast.error("لم يتم العثور على معرّف المنشأة");
        return false;
      }
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-workweek-${companyId}`,
        operation: async () => {
          await updateCompanyWorkweek(companyId, config);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.workweek() });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success("تم حفظ إعدادات أسبوع العمل للمنشأة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ إعدادات أسبوع العمل");
        },
      });

      return result.ok;
    },
    [mode, companyId, queryClient],
  );

  return {
    createPeriod,
    updatePeriod,
    saveAssignment,
    batchSaveAssignments,
    removeAssignment,
    checkConflicts,
    publish,
    copyPeriod,
    resolveException,
    createSwap,
    approveSwap,
    rejectSwap,
    saveWorkweek,
  };
}
