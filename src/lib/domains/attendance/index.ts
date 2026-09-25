import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AttendanceCorrectionRequest,
  AttendanceException,
  AttendancePayrollSnapshot,
  AttendancePeriod,
  AttendancePolicy,
  AttendanceSummaryKPIs,
  DailyAttendanceRecord,
  OvertimeRecord,
  PunchRecord,
  AttendanceDevice,
  AttendanceDeviceEmployeeMapping,
  AttendanceRecordFilters,
  PaginatedAttendanceRecords,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  fetchAttendanceExceptionsRecord,
  fetchAttendancePayrollSnapshotsRecord,
  fetchAttendancePeriodsRecord,
  fetchAttendancePoliciesRecord,
  fetchAttendancePolicyVersionsRecord,
  fetchAttendanceRecordsRecord,
  fetchPaginatedAttendanceRecordsRecord,
  fetchAttendanceSummaryKPIsRecord,
  fetchAttendanceDevicesRecord,
  fetchAttendanceDeviceEmployeeMappingsRecord,
  createAttendanceDeviceRecord,
  createAttendanceDeviceEmployeeMappingRecord,
  fetchPunchesRecord,
  recordSelfPunchRecord,
  resolveAttendanceExceptionRecord,
  updateAttendancePolicyRecord,
  closeAttendancePeriodRecord,
  reopenAttendancePeriodRecord,
  importBiometricPunchesRecord,
  processAttendanceRangeRecord,
  processAttendanceDayRecord,
  fetchEffectiveCompanyTimezoneRecord,
} from "../../data/attendance-repository";
import { createRequestRecord } from "../../data/hrms-repository";
import {
  approveAttendanceCorrectionRecord,
  rejectAttendanceCorrectionRecord,
  createOvertimeRecord,
  approveOvertimeRecord,
  rejectOvertimeRecord,
} from "../../data/operational-repository";
import { processAttendanceServer } from "../../business/attendance.functions";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

// ----------------------------------------------------------------------------
// HOOK: Dedicated Attendance Records Query (Replacing Live Bootstrap Authority)
// ----------------------------------------------------------------------------
export function useAttendanceRecords(filters?: {
  fromDate?: string;
  toDate?: string;
  employeeId?: string;
  status?: string;
  searchTerm?: string;
}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoRecords = useDemoStore((s) => s.attendanceRecords);

  const query = useQuery({
    queryKey: queryKeys.attendance.records(filters),
    queryFn: () => fetchAttendanceRecordsRecord(filters),
    enabled: isLive,
    staleTime: 30 * 1000,
  });

  if (!isLive) {
    let filtered = demoRecords;
    if (filters?.employeeId) {
      filtered = filtered.filter((r) => r.employeeId === filters.employeeId);
    }
    if (filters?.status && filters.status !== "all") {
      filtered = filtered.filter((r) => r.status === filters.status);
    }
    if (filters?.fromDate) {
      filtered = filtered.filter((r) => r.workDate >= filters.fromDate!);
    }
    if (filters?.toDate) {
      filtered = filtered.filter((r) => r.workDate <= filters.toDate!);
    }
    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(term) ||
          r.employeeNo.toLowerCase().includes(term) ||
          r.departmentName.toLowerCase().includes(term),
      );
    }
    return {
      records: filtered,
      isLoading: false,
      isError: false,
      error: null,
      refetch: async () => ({ data: filtered }),
    };
  }

  return {
    records: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Server-Paginated Attendance Records
// ----------------------------------------------------------------------------
export function usePaginatedAttendanceRecords(filters?: AttendanceRecordFilters) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoRecords = useDemoStore((s) => s.attendanceRecords);

  const query = useQuery({
    queryKey: [...queryKeys.attendance.records(filters as any), "paginated", filters?.page, filters?.pageSize],
    queryFn: () => fetchPaginatedAttendanceRecordsRecord(filters),
    enabled: isLive,
    staleTime: 30 * 1000,
  });

  if (!isLive) {
    let filtered = demoRecords;
    if (filters?.employeeId) {
      filtered = filtered.filter((r) => r.employeeId === filters.employeeId);
    }
    if (filters?.status && filters.status !== "all") {
      filtered = filtered.filter((r) => r.status === filters.status);
    }
    if (filters?.fromDate) {
      filtered = filtered.filter((r) => r.workDate >= filters.fromDate!);
    }
    if (filters?.toDate) {
      filtered = filtered.filter((r) => r.workDate <= filters.toDate!);
    }
    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(term) ||
          r.employeeNo.toLowerCase().includes(term) ||
          r.departmentName.toLowerCase().includes(term),
      );
    }

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 20;
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const paginatedRecords = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      records: paginatedRecords,
      totalCount,
      page,
      pageSize,
      totalPages,
      isLoading: false,
      isError: false,
      error: null,
      refetch: async () => ({ data: { records: paginatedRecords, totalCount, page, pageSize, totalPages } }),
    };
  }

  return {
    records: query.data?.records ?? [],
    totalCount: query.data?.totalCount ?? 0,
    page: query.data?.page ?? (filters?.page || 1),
    pageSize: query.data?.pageSize ?? (filters?.pageSize || 20),
    totalPages: query.data?.totalPages ?? 1,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Attendance Summary KPIs
// ----------------------------------------------------------------------------
export function useAttendanceSummary(dateStr?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoRecords = useDemoStore((s) => s.attendanceRecords);
  const demoEmployees = useDemoStore((s) => s.employees);
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);

  const query = useQuery({
    queryKey: queryKeys.attendance.summary(targetDate),
    queryFn: () => fetchAttendanceSummaryKPIsRecord(targetDate),
    enabled: isLive,
    staleTime: 30 * 1000,
  });

  if (!isLive) {
    const dayRecords = demoRecords.filter((r) => r.workDate === targetDate);
    const totalEmployees = demoEmployees.length || 10;
    const presentCount = dayRecords.filter((r) => r.status === "present").length;
    const lateCount = dayRecords.filter((r) => r.status === "late").length;
    const leaveCount = dayRecords.filter((r) => r.status === "leave").length;
    const absentCount = Math.max(0, totalEmployees - presentCount - lateCount - leaveCount);
    const attendanceRate = totalEmployees > 0 ? Math.round(((presentCount + lateCount) / totalEmployees) * 100) : 0;

    const summary: AttendanceSummaryKPIs = {
      totalEmployees,
      presentCount,
      lateCount,
      absentCount,
      leaveCount,
      attendanceRate,
      totalOvertimeHours: 6.5,
      openExceptionsCount: lateCount + absentCount,
      isPolicyConfigured: true,
    };

    return {
      summary,
      isLoading: false,
      isError: false,
      error: null,
      refetch: async () => ({ data: summary }),
    };
  }

  const defaultSummary: AttendanceSummaryKPIs = {
    totalEmployees: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    leaveCount: 0,
    attendanceRate: 0,
    totalOvertimeHours: 0,
    openExceptionsCount: 0,
    isPolicyConfigured: false,
  };

  return {
    summary: query.data ?? defaultSummary,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Attendance Policies (Setup & Rules)
// ----------------------------------------------------------------------------
export function useAttendancePolicies() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const demoPolicy: AttendancePolicy = {
    id: "pol-demo-01",
    companyId: "demo-company",
    nameAr: "سياسة الدوام الافتراضية",
    version: 1,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    status: "active",
    jurisdiction: "SA",
    maxGpsAccuracyMeters: 100,
    gracePeriodInMinutes: 15,
    gracePeriodOutMinutes: 15,
    overtimeRegularMultiplier: 1.5,
    overtimeHolidayMultiplier: 2.0,
    defaultWorkHoursPerDay: 8.0,
    ramadanWorkHoursPerDay: 6.0,
    maxWorkHoursPerWeek: 48.0,
    ramadanMaxWorkHoursPerWeek: 36.0,
    geofenceEnforced: true,
    geofenceRadiusMeters: 200,
    autoDeductBreaks: true,
    breakDurationMinutes: 60,
    maxConsecutiveHoursWithoutBreak: 5.0,
    requireBiometricOrGps: true,
    allowMobilePunch: true,
    overtimePreApprovalRequired: true,
  };

  const query = useQuery({
    queryKey: queryKeys.attendance.policies(),
    queryFn: fetchAttendancePoliciesRecord,
    enabled: isLive,
    staleTime: 60 * 1000,
  });

  return {
    policy: isLive ? (query.data ?? null) : demoPolicy,
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: isLive ? query.error : null,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Attendance Policy Versions (Auditing / History)
// ----------------------------------------------------------------------------
export function useAttendancePolicyVersions() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: [...queryKeys.attendance.policies(), "versions"],
    queryFn: fetchAttendancePolicyVersionsRecord,
    enabled: isLive,
    staleTime: 60 * 1000,
  });

  return {
    versions: isLive ? (query.data ?? []) : [],
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: isLive ? query.error : null,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Attendance Devices
// ----------------------------------------------------------------------------
export function useAttendanceDevices() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: [...queryKeys.attendance.all, "devices"],
    queryFn: fetchAttendanceDevicesRecord,
    enabled: isLive,
    staleTime: 60 * 1000,
  });

  return {
    devices: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Attendance Device Employee Mappings
// ----------------------------------------------------------------------------
export function useAttendanceDeviceEmployeeMappings(deviceId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: [...queryKeys.attendance.all, "device-mappings", deviceId],
    queryFn: () => fetchAttendanceDeviceEmployeeMappingsRecord(deviceId),
    enabled: isLive,
    staleTime: 60 * 1000,
  });

  return {
    mappings: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Attendance Periods
// ----------------------------------------------------------------------------
export function useAttendancePeriods() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const demoPeriods: AttendancePeriod[] = [
    {
      id: "period-2026-09",
      companyId: "demo-company",
      periodYear: 2026,
      periodMonth: 9,
      fromDate: "2026-09-01",
      toDate: "2026-09-30",
      status: "open",
      version: 1,
      createdAt: new Date().toISOString(),
    },
  ];

  const query = useQuery({
    queryKey: queryKeys.attendance.periods(),
    queryFn: fetchAttendancePeriodsRecord,
    enabled: isLive,
    staleTime: 60 * 1000,
  });

  return {
    periods: isLive ? query.data ?? [] : demoPeriods,
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: isLive ? query.error : null,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Attendance Payroll Snapshots
// ----------------------------------------------------------------------------
export function useAttendancePayrollSnapshots(periodId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: queryKeys.attendance.snapshots(periodId),
    queryFn: () => (periodId ? fetchAttendancePayrollSnapshotsRecord(periodId) : Promise.resolve([])),
    enabled: isLive && Boolean(periodId),
    staleTime: 60 * 1000,
  });

  return {
    snapshots: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Attendance Exceptions
// ----------------------------------------------------------------------------
export function useAttendanceExceptions(filters?: {
  employeeId?: string;
  resolved?: boolean;
  workDate?: string;
}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: queryKeys.attendance.exceptions(filters),
    queryFn: () => fetchAttendanceExceptionsRecord(filters),
    enabled: isLive,
    staleTime: 30 * 1000,
  });

  return {
    exceptions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Punches
// ----------------------------------------------------------------------------
export function usePunches(filters?: {
  date?: string;
  employeeId?: string;
  status?: string;
}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: queryKeys.attendance.punches(filters),
    queryFn: () => fetchPunchesRecord(filters),
    enabled: isLive,
    staleTime: 30 * 1000,
  });

  return {
    punches: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Overtime Records
// ----------------------------------------------------------------------------
export function useOvertimeRecords(filters?: { employeeId?: string; status?: string }) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoOvertime = useDemoStore((s) => s.overtimeRecords);

  const query = useQuery({
    queryKey: queryKeys.attendance.overtime(filters),
    queryFn: async () => {
      let q = supabase
        .from("overtime_records")
        .select(`
          *,
          employees(id, employee_no, full_name, departments(name_ar))
        `)
        .order("created_at", { ascending: false });

      if (filters?.employeeId) q = q.eq("employee_id", filters.employeeId);
      if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row: any): OvertimeRecord => ({
        id: row.id,
        employeeId: row.employee_id,
        employeeNo: row.employees?.employee_no || "",
        employeeName: row.employees?.full_name || "موظف",
        departmentName: row.employees?.departments?.name_ar || "عام",
        workDate: row.work_date,
        startTime: row.start_time,
        endTime: row.end_time,
        hours: Number(row.hours ?? 0),
        rateMultiplier: Number(row.rate_multiplier ?? 1.5),
        rateType: row.rate_type || "regular_150",
        reason: row.reason || "",
        hourlyRate: Number(row.hourly_rate ?? 0),
        totalAmount: Number(row.total_amount ?? 0),
        status: row.status,
        createdAt: row.created_at,
      }));
    },
    enabled: isLive,
    staleTime: 30 * 1000,
  });

  return {
    overtimeRecords: isLive ? (query.data ?? []) : demoOvertime,
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: isLive ? query.error : null,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Attendance Corrections
// ----------------------------------------------------------------------------
export function useAttendanceCorrections(filters?: { employeeId?: string; status?: string }) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoCorrections = useDemoStore((s) => s.attendanceCorrections);

  const query = useQuery({
    queryKey: queryKeys.attendance.corrections(filters),
    queryFn: async () => {
      let q = supabase
        .from("requests")
        .select(`
          *,
          employees(id, employee_no, full_name, departments(name_ar))
        `)
        .in("type", ["attendance_correction", "attendance_fix"] as any)
        .order("created_at", { ascending: false });

      if (filters?.employeeId) q = q.eq("employee_id", filters.employeeId);
      if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status as any);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row: any): AttendanceCorrectionRequest => {
        const payload = (row.payload ?? {}) as any;
        return {
          id: row.id,
          employeeId: row.employee_id,
          employeeNo: row.employees?.employee_no || "",
          employeeName: row.employees?.full_name || "موظف",
          departmentName: row.employees?.departments?.name_ar || "عام",
          workDate: payload.workDate || row.created_at.slice(0, 10),
          originalIn: payload.originalIn || "",
          originalOut: payload.originalOut || "",
          correctInTime: payload.correctInTime || payload.correctIn || "",
          correctOutTime: payload.correctOutTime || payload.correctOut || "",
          reason: payload.reason || "",
          status: row.status,
          submittedAt: row.created_at,
          reviewedBy: row.reviewed_by,
          reviewedAt: row.reviewed_at,
        };
      });
    },
    enabled: isLive,
    staleTime: 30 * 1000,
  });

  return {
    attendanceCorrections: isLive ? (query.data ?? []) : demoCorrections,
    isLoading: isLive ? query.isLoading : false,
    isError: isLive ? query.isError : false,
    error: isLive ? query.error : null,
    refetch: query.refetch,
  };
}

// ----------------------------------------------------------------------------
// LEGACY COMPATIBILITY HOOK: useAttendance
// ----------------------------------------------------------------------------
export function useAttendance() {
  const { records, isLoading, isError, error, refetch } = useAttendanceRecords();
  const demoData = useDemoStore((s) => ({
    overtimeRecords: s.overtimeRecords,
    attendanceCorrections: s.attendanceCorrections,
  }));

  return {
    attendanceRecords: records,
    overtimeRecords: demoData.overtimeRecords,
    attendanceCorrections: demoData.attendanceCorrections,
    isLoading,
    isError,
    error,
    refetch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: useAttendanceMutations
// ----------------------------------------------------------------------------
export function useAttendanceMutations() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const punchInOut = useCallback(
    async (
      type: "in" | "out",
      coords?: { lat: number; lng: number },
      accuracy?: number,
      clientEventId?: string,
    ): Promise<{ success: boolean; message: string; geofenceValid: boolean }> => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const today = now.toISOString().split("T")[0];
      const eventId =
        clientEventId ||
        (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `punch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

      const mutationRes = await executeReliableMutation<{ success: boolean; message: string; geofenceValid: boolean }>({
        mode,
        mutationKey: `punch-self-${today}-${type}-${eventId}`,
        operation: async () => {
          // Live mode executes server-authoritative punch with server-resolved employee identity and client event idempotency
          const res = await recordSelfPunchRecord(type, coords, accuracy, eventId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return {
            success: res.ok,
            message: res.message,
            geofenceValid: res.geofenceValid,
          };
        },
        demoOperation: () => {
          const emp = demoStore.employees[0];
          const empId = emp?.id || "emp-01";
          const existingIndex = demoStore.attendanceRecords.findIndex(
            (r) => r.workDate === today && r.employeeId === empId,
          );

          if (type === "in") {
            if (existingIndex >= 0) {
              demoStore.attendanceRecords[existingIndex].actualIn = timeStr;
            } else {
              demoStore.attendanceRecords = [
                {
                  id: `att-${Date.now()}`,
                  employeeId: empId,
                  employeeNo: emp?.employeeNo || "EMP-001",
                  employeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "الموظف",
                  departmentName: emp?.departmentName || "عام",
                  workDate: today,
                  actualIn: timeStr,
                  status: "present",
                  lateMinutes: 0,
                  earlyDepartureMinutes: 0,
                  workedHours: 8,
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
          } else {
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
          }
        },
        onCommitted: (res) => {
          if (res?.geofenceValid) {
            toast.success(res.message);
          } else if (res?.message) {
            toast.warning(res.message);
          }
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
        message: "تم تسجيل البصمة بنجاح",
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
      const empId = payload.employeeId || (mode === "demo" ? demoStore.employees[0]?.id || "emp-01" : "");
      if (!empId) {
        toast.error("يرجى تحديد الموظف المطلوب لتقديم طلب التصحيح");
        return false;
      }
      const emp = demoStore.employees.find((e) => e.id === empId);

      const newCorrection: AttendanceCorrectionRequest = {
        id: `corr-${Date.now()}`,
        employeeId: empId,
        employeeNo: emp?.employeeNo || "EMP-001",
        employeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "موظف",
        departmentName: emp?.departmentName || "عام",
        workDate: payload.workDate,
        originalIn: "",
        originalOut: "",
        correctInTime: payload.correctIn || "",
        correctOutTime: payload.correctOut || "",
        reason: payload.reason,
        status: "pending",
        submittedAt: new Date().toISOString(),
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `corr-${empId}-${payload.workDate}`,
        operation: async () => {
          await createRequestRecord(empId, "attendance_correction", {
            workDate: payload.workDate,
            correctInTime: payload.correctIn,
            correctOutTime: payload.correctOut,
            reason: payload.reason,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.corrections() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
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
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
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
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
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
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
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
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
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
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
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
          await processAttendanceRangeRecord(fromDate, toDate);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
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

  const updatePolicy = useCallback(
    async (policy: Partial<AttendancePolicy>): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-attendance-policy`,
        operation: async () => {
          await updateAttendancePolicyRecord(policy);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.policies() });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم حفظ إعدادات وسياسات الحضور بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ سياسة الدوام");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const closePeriod = useCallback(
    async (periodId: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `close-attendance-period-${periodId}`,
        operation: async () => {
          const res = await closeAttendancePeriodRecord(periodId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.periods() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.snapshots(periodId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          return res.ok;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم إغلاق فترة الحضور واعتماد اللقطة الثابتة لمسير الرواتب بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إغلاق فترة الحضور");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const reopenPeriod = useCallback(
    async (periodId: string, reason: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `reopen-attendance-period-${periodId}`,
        operation: async () => {
          await reopenAttendancePeriodRecord(periodId, reason);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.periods() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تمت إعادة فتح فترة الحضور بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إعادة فتح فترة الحضور");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const resolveException = useCallback(
    async (exceptionId: string, note: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `resolve-attendance-exception-${exceptionId}`,
        operation: async () => {
          await resolveAttendanceExceptionRecord(exceptionId, note);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.exceptions() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.summary() });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تمت معالجة استثناء الدوام بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر معالجة الاستثناء");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const importBiometricBatch = useCallback(
    async (
      deviceId: string,
      punches: Array<{ employee_no: string; punch_time: string; punch_type: "in" | "out" }>,
    ): Promise<boolean> => {
      const result = await executeReliableMutation<{ message: string }>({
        mode,
        mutationKey: `import-biometric-${deviceId}-${Date.now()}`,
        operation: async () => {
          const res = await importBiometricPunchesRecord(deviceId, punches);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          return {
            message: `تم استيراد ${res.successful} بصمة بنجاح (${res.duplicates} مكررة، ${res.failed} غير مطابقة)`,
          };
        },
        demoOperation: () => {
          return {
            message: `تم استيراد ${punches.length} بصمة بنجاح`,
          };
        },
        onCommitted: (data) => {
          toast.success(data?.message || "تم استيراد البصمات بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر استيراد البصمات");
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
    updatePolicy,
    closePeriod,
    reopenPeriod,
    resolveException,
    importBiometricBatch,
  };
}

// ----------------------------------------------------------------------------
// HOOK: Company Timezone Resolution
// ----------------------------------------------------------------------------
export function useEffectiveCompanyTimezone(companyId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const query = useQuery({
    queryKey: [...queryKeys.attendance.all, "effective-timezone", companyId],
    queryFn: () => fetchEffectiveCompanyTimezoneRecord(companyId),
    enabled: isLive,
    staleTime: 5 * 60 * 1000,
  });

  return {
    timezone: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
