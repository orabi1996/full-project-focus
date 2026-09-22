import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type {
  AttendanceCorrectionRequest,
  DailyAttendanceRecord,
  OvertimeRecord,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  approveAttendanceCorrectionRecord,
  rejectAttendanceCorrectionRecord,
  createOvertimeRecord,
  approveOvertimeRecord,
  rejectOvertimeRecord,
  fetchAttendancePolicyRecord,
  fetchAttendanceSummaryRecord,
  fetchMyAttendanceRecordsRecord,
  fetchCompanyAttendanceRecordsRecord,
  recordMobileAttendancePunchRecord,
  submitAttendanceCorrectionRecord,
  type AttendanceRecordItem,
} from "../../data/operational-repository";
import { processAttendanceServer } from "../../business/attendance.functions";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export interface AttendanceQueryFilters {
  fromDate?: string;
  toDate?: string;
  departmentId?: string | null;
  status?: string | null;
  employeeId?: string | null;
  page?: number;
  pageSize?: number;
}

function toDailyAttendanceRecord(item: AttendanceRecordItem): DailyAttendanceRecord {
  const rawStatus = item.status === "leave" ? "on_leave" : item.status;
  const allowedStatuses = new Set([
    "present",
    "late",
    "early_departure",
    "absent",
    "on_leave",
    "holiday",
    "rest_day",
    "missing_punch",
  ]);
  const status = (allowedStatuses.has(rawStatus) ? rawStatus : "present") as DailyAttendanceRecord["status"];

  const source =
    item.punchSource === "biometric_device" || item.punchSource === "mobile_gps" ||
    item.punchSource === "manual_admin" || item.punchSource === "correction_request"
      ? item.punchSource
      : item.punchSource === "biometric"
        ? "biometric_device"
        : "manual_admin";

  return {
    id: item.id,
    employeeId: item.employeeId,
    employeeNo: item.employeeNo ?? "",
    employeeName: item.employeeName ?? "",
    departmentName: item.departmentName ?? "",
    workDate: item.workDate,
    scheduledIn: item.scheduledIn ?? undefined,
    scheduledOut: item.scheduledOut ?? undefined,
    actualIn: item.checkIn ?? undefined,
    actualOut: item.checkOut ?? undefined,
    status,
    lateMinutes: item.lateMinutes,
    earlyDepartureMinutes: item.earlyDepartureMinutes,
    workedHours: item.workedHours,
    overtimeHours: item.overtimeHours,
    punchSource: source,
    geofenceValid: item.geofenceValid ?? false,
    violationsCount: item.violationsCount,
    reviewedByPayroll: item.reviewedByPayroll,
  };
}

export function useAttendance(filters: AttendanceQueryFilters = {}) {
  const { session, isDemo, role } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoData = useDemoStore((s) => ({
    attendanceRecords: s.attendanceRecords,
    overtimeRecords: s.overtimeRecords,
    attendanceCorrections: s.attendanceCorrections,
  }));

  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = `${defaultTo.slice(0, 7)}-01`;
  const fromDate = filters.fromDate ?? defaultFrom;
  const toDate = filters.toDate ?? defaultTo;

  const canReadCompany = [
    "super_admin",
    "org_admin",
    "hr_manager",
    "attendance_officer",
    "auditor",
    "line_manager",
  ].includes(role);

  const recordsQuery = useQuery({
    queryKey: canReadCompany
      ? queryKeys.attendance.adminRecords({
          fromDate,
          toDate,
          departmentId: filters.departmentId ?? null,
          status: filters.status ?? null,
          employeeId: filters.employeeId ?? null,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 100,
        })
      : queryKeys.attendance.myRecords({ fromDate, toDate }),
    queryFn: async () => {
      if (canReadCompany) {
        return fetchCompanyAttendanceRecordsRecord({
          fromDate,
          toDate,
          departmentId: filters.departmentId ?? null,
          status: filters.status ?? null,
          employeeId: filters.employeeId ?? null,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 100,
        });
      }
      const items = await fetchMyAttendanceRecordsRecord(fromDate, toDate);
      return { items, totalCount: items.length, page: 1, pageSize: items.length };
    },
    enabled: isLive,
    staleTime: 30_000,
  });

  const policyQuery = useQuery({
    queryKey: queryKeys.attendance.policy(),
    queryFn: fetchAttendancePolicyRecord,
    enabled: isLive,
    staleTime: 60_000,
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.attendance.summary(null),
    queryFn: () => fetchAttendanceSummaryRecord(null),
    enabled: isLive && canReadCompany,
    staleTime: 30_000,
  });

  const liveRecords = (recordsQuery.data?.items ?? []).map(toDailyAttendanceRecord);

  return {
    attendanceRecords: isLive ? liveRecords : demoData.attendanceRecords,
    overtimeRecords: isLive ? bootstrap.overtimeRecords : demoData.overtimeRecords,
    attendanceCorrections: isLive
      ? bootstrap.attendanceCorrections
      : demoData.attendanceCorrections,
    attendancePolicy: isLive ? policyQuery.data ?? null : null,
    attendanceSummary: isLive ? summaryQuery.data ?? null : null,
    totalCount: isLive ? recordsQuery.data?.totalCount ?? 0 : demoData.attendanceRecords.length,
    isLoading: isLive
      ? recordsQuery.isLoading || policyQuery.isLoading || (canReadCompany && summaryQuery.isLoading)
      : false,
    isError: isLive
      ? recordsQuery.isError || policyQuery.isError || (canReadCompany && summaryQuery.isError)
      : false,
    error: isLive
      ? recordsQuery.error ?? policyQuery.error ?? summaryQuery.error ?? null
      : null,
    refetch: async () => {
      if (!isLive) return;
      await Promise.all([
        recordsQuery.refetch(),
        policyQuery.refetch(),
        canReadCompany ? summaryQuery.refetch() : Promise.resolve(),
      ]);
    },
  };
}

export function useAttendanceMutations() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const punchInOut = useCallback(
    async (
      type: "in" | "out",
      coords?: { lat: number; lng: number; accuracy?: number },
      employeeId?: string,
    ): Promise<{ success: boolean; message: string; geofenceValid: boolean }> => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const today = now.toISOString().split("T")[0];
      const demoEmployeeId = employeeId || demoStore.employees[0]?.id || "emp-01";
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `mobile-${Date.now()}-${type}`;

      const mutationRes = await executeReliableMutation<{
        success: boolean;
        message: string;
        geofenceValid: boolean;
      }>({
        mode,
        mutationKey: `punch-${idempotencyKey}`,
        operation: async () => {
          const result = await recordMobileAttendancePunchRecord({
            punchType: type,
            latitude: coords?.lat ?? null,
            longitude: coords?.lng ?? null,
            accuracyMeters: coords?.accuracy ?? null,
            idempotencyKey,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          return {
            success: result.success,
            message:
              result.approvalStatus === "approved"
                ? `تم تسجيل ${type === "in" ? "الحضور" : "الانصراف"} بنجاح`
                : `تم تسجيل ${type === "in" ? "الحضور" : "الانصراف"} وبانتظار المراجعة`,
            geofenceValid: result.geofenceValid ?? true,
          };
        },
        demoOperation: () => {
          const emp = demoStore.employees.find((e) => e.id === demoEmployeeId);
          const existingIndex = demoStore.attendanceRecords.findIndex(
            (r) => r.workDate === today && r.employeeId === demoEmployeeId,
          );

          if (type === "in") {
            if (existingIndex >= 0) {
              demoStore.attendanceRecords[existingIndex].actualIn = timeStr;
            } else {
              demoStore.attendanceRecords = [
                {
                  id: `att-${Date.now()}`,
                  employeeId: demoEmployeeId,
                  employeeNo: emp?.employeeNo || "EMP-001",
                  employeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "الموظف",
                  departmentName: emp?.departmentName || "عام",
                  workDate: today,
                  actualIn: timeStr,
                  status: "present",
                  lateMinutes: 0,
                  earlyDepartureMinutes: 0,
                  workedHours: 0,
                  overtimeHours: 0,
                  punchSource: "mobile_gps",
                  geofenceValid: true,
                  violationsCount: 0,
                  reviewedByPayroll: false,
                },
                ...demoStore.attendanceRecords,
              ];
            }
            demoStore.notify();
            return {
              success: true,
              message: `تم تسجيل الدخول بنجاح الساعة ${timeStr}`,
              geofenceValid: true,
            };
          }

          if (existingIndex >= 0) {
            demoStore.attendanceRecords[existingIndex].actualOut = timeStr;
            demoStore.notify();
            return {
              success: true,
              message: `تم تسجيل الانصراف بنجاح الساعة ${timeStr}`,
              geofenceValid: true,
            };
          }

          return {
            success: false,
            message: "لم يتم العثور على حركة حضور سابقة لهذا اليوم",
            geofenceValid: true,
          };
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسجيل البصمة");
        },
      });

      if (!mutationRes.ok) {
        return {
          success: false,
          message: mutationRes.error?.message || "تعذر تسجيل البصمة",
          geofenceValid: false,
        };
      }

      return mutationRes.data ?? {
        success: true,
        message: "تم تسجيل البصمة",
        geofenceValid: true,
      };
    },
    [mode, queryClient],
  );

  const submitAttendanceCorrection = useCallback(
    async (payload: {
      workDate: string;
      correctIn?: string;
      correctOut?: string;
      reason: string;
      employeeId?: string;
    }): Promise<boolean> => {
      const empId = mode === "demo" ? payload.employeeId || demoStore.employees[0]?.id || "emp-01" : "";
      const emp = demoStore.employees.find((e) => e.id === empId);

      const newCorrection: AttendanceCorrectionRequest = {
        id: `corr-${Date.now()}`,
        employeeId: empId,
        employeeNo: emp?.employeeNo || "EMP-001",
        employeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "موظف",
        departmentName: emp?.departmentName || "عام",
        workDate: payload.workDate,
        originalIn: "08:00",
        originalOut: "17:00",
        correctInTime: payload.correctIn || "08:00",
        correctOutTime: payload.correctOut || "17:00",
        reason: payload.reason,
        status: "pending",
        submittedAt: new Date().toISOString(),
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `corr-${empId}-${payload.workDate}`,
        operation: async () => {
          await submitAttendanceCorrectionRecord({
            workDate: payload.workDate,
            correctIn: payload.correctIn,
            correctOut: payload.correctOut,
            reason: payload.reason,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.corrections() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          return true;
        },
        demoOperation: () => {
          demoStore.attendanceCorrections = [newCorrection, ...demoStore.attendanceCorrections];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إرسال طلب تصحيح البصمة للمراجعة والاعتماد");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إرسال طلب التصحيح");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const approveAttendanceCorrection = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `approve-corr-${id}`,
        operation: async () => {
          await approveAttendanceCorrectionRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.corrections() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          return true;
        },
        demoOperation: () => {
          demoStore.attendanceCorrections = demoStore.attendanceCorrections.map((c) =>
            c.id === id ? { ...c, status: "approved" as const } : c,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم اعتماد تصحيح البصمة وتحديث السجلات");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر اعتماد طلب التصحيح");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const rejectAttendanceCorrection = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `reject-corr-${id}`,
        operation: async () => {
          await rejectAttendanceCorrectionRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.corrections() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          return true;
        },
        demoOperation: () => {
          demoStore.attendanceCorrections = demoStore.attendanceCorrections.map((c) =>
            c.id === id ? { ...c, status: "rejected" as const } : c,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم رفض طلب تصحيح البصمة");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر رفض طلب التصحيح");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const submitOvertimeRequest = useCallback(
    async (record: Omit<OvertimeRecord, "id" | "status" | "createdAt">): Promise<boolean> => {
      const newOT: OvertimeRecord = {
        ...record,
        id: `ot-${Date.now()}`,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `ot-${record.employeeId}-${record.workDate}-${record.hours}`,
        operation: async () => {
          await createOvertimeRecord(record);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.overtime() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          return true;
        },
        demoOperation: () => {
          demoStore.overtimeRecords = [newOT, ...demoStore.overtimeRecords];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إرسال طلب العمل الإضافي بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر رفع طلب العمل الإضافي");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const approveOvertimeRequest = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `approve-ot-${id}`,
        operation: async () => {
          await approveOvertimeRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.overtime() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          return true;
        },
        demoOperation: () => {
          demoStore.overtimeRecords = demoStore.overtimeRecords.map((o) =>
            o.id === id ? { ...o, status: "approved" as const } : o,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم اعتماد طلب العمل الإضافي وتحديث السجلات");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر اعتماد العمل الإضافي");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const rejectOvertimeRequest = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `reject-ot-${id}`,
        operation: async () => {
          await rejectOvertimeRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.overtime() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          return true;
        },
        demoOperation: () => {
          demoStore.overtimeRecords = demoStore.overtimeRecords.map((o) =>
            o.id === id ? { ...o, status: "rejected" as const } : o,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم رفض طلب العمل الإضافي");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر رفض العمل الإضافي");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const processAttendance = useCallback(
    async (fromDate: string, toDate: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `process-attendance-${fromDate}-${toDate}`,
        operation: async () => {
          await processAttendanceServer({ data: { fromDate, toDate } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success(`تمت معالجة سجلات الحضور للفترة من ${fromDate} إلى ${toDate} بنجاح`);
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر معالجة سجلات الحضور");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return {
    punchInOut,
    submitAttendanceCorrection,
    approveAttendanceCorrection,
    rejectAttendanceCorrection,
    submitOvertimeRequest,
    approveOvertimeRequest,
    rejectOvertimeRequest,
    processAttendance,
  };
}
