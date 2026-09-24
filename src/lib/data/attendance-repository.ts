import { supabase } from "@/integrations/supabase/client";
const db = supabase as any;
import type {
  AttendancePolicy,
  AttendancePeriod,
  AttendancePayrollSnapshot,
  AttendanceException,
  PunchRecord,
  DailyAttendanceRecord,
  AttendanceSummaryKPIs,
} from "../../types";
import { AppMutationError } from "./reliable-mutation";

function mapError(error: any, defaultMsg: string): AppMutationError {
  const code = (error as { code?: string })?.code ?? "";
  const msg = error?.message || defaultMsg;
  if (code === "23505" || code === "P0002") {
    return new AppMutationError(msg, "conflict", { details: error });
  }
  if (code === "42501") {
    return new AppMutationError(msg, "authorization", { details: error });
  }
  if (code === "22023") {
    return new AppMutationError(msg, "validation", { details: error });
  }
  return new AppMutationError(msg, "backend", { details: error });
}

export function mapAttendancePolicy(row: any): AttendancePolicy {
  return {
    id: row.id,
    companyId: row.company_id,
    nameAr: row.name_ar,
    gracePeriodInMinutes: Number(row.grace_period_in_minutes ?? 15),
    gracePeriodOutMinutes: Number(row.grace_period_out_minutes ?? 15),
    overtimeRegularMultiplier: Number(row.overtime_regular_multiplier ?? 1.5),
    overtimeHolidayMultiplier: Number(row.overtime_holiday_multiplier ?? 2.0),
    defaultWorkHoursPerDay: Number(row.default_work_hours_per_day ?? 8.0),
    ramadanWorkHoursPerDay: Number(row.ramadan_work_hours_per_day ?? 6.0),
    maxWorkHoursPerWeek: Number(row.max_work_hours_per_week ?? 48.0),
    ramadanMaxWorkHoursPerWeek: Number(row.ramadan_max_work_hours_per_week ?? 36.0),
    geofenceEnforced: Boolean(row.geofence_enforced),
    geofenceRadiusMeters: Number(row.geofence_radius_meters ?? 200),
    autoDeductBreaks: Boolean(row.auto_deduct_breaks),
    breakDurationMinutes: Number(row.break_duration_minutes ?? 60),
    maxConsecutiveHoursWithoutBreak: Number(row.max_consecutive_hours_without_break ?? 5.0),
    requireBiometricOrGps: Boolean(row.require_biometric_or_gps),
    allowMobilePunch: Boolean(row.allow_mobile_punch),
    overtimePreApprovalRequired: Boolean(row.overtime_pre_approval_required),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAttendancePeriod(row: any): AttendancePeriod {
  return {
    id: row.id,
    companyId: row.company_id,
    periodYear: Number(row.period_year),
    periodMonth: Number(row.period_month),
    fromDate: row.from_date,
    toDate: row.to_date,
    status: row.status,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
    reopenedBy: row.reopened_by,
    reopenedAt: row.reopened_at,
    reopenReason: row.reopen_reason,
    createdAt: row.created_at,
  };
}

export function mapAttendanceException(row: any, employeeMap?: Map<string, any>): AttendanceException {
  const emp = employeeMap?.get(row.employee_id) || row.employees;
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    employeeNo: emp?.employee_no || "",
    employeeName: emp?.full_name || "موظف",
    departmentName: emp?.department_name || "عام",
    workDate: row.work_date,
    exceptionType: row.exception_type,
    severity: row.severity,
    minutes: Number(row.minutes ?? 0),
    description: row.description || "",
    resolved: Boolean(row.resolved),
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
  };
}

export function mapAttendancePayrollSnapshot(row: any, employeeMap?: Map<string, any>): AttendancePayrollSnapshot {
  const emp = employeeMap?.get(row.employee_id) || row.employees;
  return {
    id: row.id,
    companyId: row.company_id,
    periodId: row.period_id,
    employeeId: row.employee_id,
    employeeNo: emp?.employee_no || "",
    employeeName: emp?.full_name || "موظف",
    departmentName: emp?.department_name || "عام",
    totalExpectedDays: Number(row.total_expected_days ?? 0),
    totalPresentDays: Number(row.total_present_days ?? 0),
    totalAbsentDays: Number(row.total_absent_days ?? 0),
    totalRestDays: Number(row.total_rest_days ?? 0),
    totalLeaveDays: Number(row.total_leave_days ?? 0),
    totalLateMinutes: Number(row.total_late_minutes ?? 0),
    totalEarlyDepartureMinutes: Number(row.total_early_departure_minutes ?? 0),
    totalWorkedHours: Number(row.total_worked_hours ?? 0),
    regularOvertimeHours: Number(row.regular_overtime_hours ?? 0),
    holidayOvertimeHours: Number(row.holiday_overtime_hours ?? 0),
    unexcusedAbsenceDays: Number(row.unexcused_absence_days ?? 0),
    violationsCount: Number(row.violations_count ?? 0),
    snapshotHash: row.snapshot_hash || "",
    createdAt: row.created_at,
  };
}

export function mapPunchRecord(row: any, employeeMap?: Map<string, any>): PunchRecord {
  const emp = employeeMap?.get(row.employee_id) || row.employees;
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    employeeNo: emp?.employee_no || "",
    employeeName: emp?.full_name || "موظف",
    punchTime: row.punch_time,
    punchType: row.punch_type,
    source: row.source,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracy_meters,
    distanceFromLocationMeters: row.distance_from_location_meters,
    geofenceValid: Boolean(row.geofence_valid),
    deviceId: row.device_id,
    approvalStatus: row.approval_status || "approved",
    batchId: row.batch_id,
    createdAt: row.created_at,
  };
}

export function mapDailyAttendanceRecord(row: any, employeeMap?: Map<string, any>): DailyAttendanceRecord {
  const emp = employeeMap?.get(row.employee_id) || row.employees;
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeNo: emp?.employee_no || "",
    employeeName: emp?.full_name || "موظف",
    departmentName: emp?.departments?.name_ar || "عام",
    workDate: row.work_date,
    scheduledShift: row.shifts?.name_ar,
    scheduledIn: row.scheduled_in ? String(row.scheduled_in).slice(0, 5) : undefined,
    scheduledOut: row.scheduled_out ? String(row.scheduled_out).slice(0, 5) : undefined,
    actualIn: row.check_in ? String(row.check_in).slice(0, 5) : undefined,
    actualOut: row.check_out ? String(row.check_out).slice(0, 5) : undefined,
    status: row.status,
    lateMinutes: Number(row.late_minutes ?? 0),
    earlyDepartureMinutes: Number(row.early_departure_minutes ?? 0),
    workedHours: Number(row.worked_hours ?? 0),
    overtimeHours: Number(row.overtime_hours ?? 0),
    punchSource: row.punch_source || "mobile_gps",
    geofenceValid: row.geofence_valid ?? true,
    violationsCount: Number(row.violations_count ?? 0),
    reviewedByPayroll: Boolean(row.reviewed_by_payroll),
  };
}

// ----------------------------------------------------------------------------
// API CALLS
// ----------------------------------------------------------------------------

export async function recordSelfPunchRecord(
  type: "in" | "out",
  coords?: { lat: number; lng: number },
  accuracy?: number,
): Promise<{ ok: boolean; punchId: string; geofenceValid: boolean; message: string }> {
  const { data, error } = await db.rpc("record_self_punch", {
    p_punch_type: type,
    p_latitude: coords?.lat ?? null,
    p_longitude: coords?.lng ?? null,
    p_accuracy: accuracy ?? null,
  });

  if (error) {
    throw mapError(error, "تعذر تسجيل البصمة على الخادم");
  }

  const res = data as any;
  return {
    ok: Boolean(res?.ok),
    punchId: res?.punch_id,
    geofenceValid: Boolean(res?.geofence_valid),
    message: res?.geofence_valid
      ? `تم تسجيل ${type === "in" ? "الحضور" : "الانصراف"} بنجاح داخل النطاق المحدد`
      : `تم تسجيل ${type === "in" ? "الحضور" : "الانصراف"} مع تنبيه: خارج النطاق الجغرافي المحدد`,
  };
}

export async function fetchAttendanceRecordsRecord(filters?: {
  fromDate?: string;
  toDate?: string;
  employeeId?: string;
  status?: string;
}): Promise<DailyAttendanceRecord[]> {
  let query = supabase
    .from("attendance_records")
    .select(`
      id,
      employee_id,
      work_date,
      check_in,
      check_out,
      status,
      worked_hours,
      overtime_hours,
      late_minutes,
      early_departure_minutes,
      punch_source,
      geofence_valid,
      violations_count,
      reviewed_by_payroll,
      scheduled_in,
      scheduled_out,
      employees(id, employee_no, full_name, departments(name_ar)),
      shifts(id, name_ar)
    `)
    .order("work_date", { ascending: false });

  if (filters?.fromDate) query = query.gte("work_date", filters.fromDate);
  if (filters?.toDate) query = query.lte("work_date", filters.toDate);
  if (filters?.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status as any);

  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر قراءة سجلات الحضور والانصراف");

  return (data ?? []).map((row) => mapDailyAttendanceRecord(row));
}

export async function fetchAttendancePoliciesRecord(): Promise<AttendancePolicy | null> {
  const { data, error } = await db
    .from("attendance_policies")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw mapError(error, "تعذر قراءة سياسات الحضور");
  return data ? mapAttendancePolicy(data) : null;
}

export async function updateAttendancePolicyRecord(
  policy: Partial<AttendancePolicy>,
): Promise<AttendancePolicy> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (policy.nameAr !== undefined) payload.name_ar = policy.nameAr;
  if (policy.gracePeriodInMinutes !== undefined) payload.grace_period_in_minutes = policy.gracePeriodInMinutes;
  if (policy.gracePeriodOutMinutes !== undefined) payload.grace_period_out_minutes = policy.gracePeriodOutMinutes;
  if (policy.overtimeRegularMultiplier !== undefined) payload.overtime_regular_multiplier = policy.overtimeRegularMultiplier;
  if (policy.overtimeHolidayMultiplier !== undefined) payload.overtime_holiday_multiplier = policy.overtimeHolidayMultiplier;
  if (policy.defaultWorkHoursPerDay !== undefined) payload.default_work_hours_per_day = policy.defaultWorkHoursPerDay;
  if (policy.ramadanWorkHoursPerDay !== undefined) payload.ramadan_work_hours_per_day = policy.ramadanWorkHoursPerDay;
  if (policy.maxWorkHoursPerWeek !== undefined) payload.max_work_hours_per_week = policy.maxWorkHoursPerWeek;
  if (policy.ramadanMaxWorkHoursPerWeek !== undefined) payload.ramadan_max_work_hours_per_week = policy.ramadanMaxWorkHoursPerWeek;
  if (policy.geofenceEnforced !== undefined) payload.geofence_enforced = policy.geofenceEnforced;
  if (policy.geofenceRadiusMeters !== undefined) payload.geofence_radius_meters = policy.geofenceRadiusMeters;
  if (policy.autoDeductBreaks !== undefined) payload.auto_deduct_breaks = policy.autoDeductBreaks;
  if (policy.breakDurationMinutes !== undefined) payload.break_duration_minutes = policy.breakDurationMinutes;
  if (policy.maxConsecutiveHoursWithoutBreak !== undefined) payload.max_consecutive_hours_without_break = policy.maxConsecutiveHoursWithoutBreak;
  if (policy.requireBiometricOrGps !== undefined) payload.require_biometric_or_gps = policy.requireBiometricOrGps;
  if (policy.allowMobilePunch !== undefined) payload.allow_mobile_punch = policy.allowMobilePunch;
  if (policy.overtimePreApprovalRequired !== undefined) payload.overtime_pre_approval_required = policy.overtimePreApprovalRequired;

  let query = db.from("attendance_policies");
  let res;
  if (policy.id) {
    res = await query.update(payload).eq("id", policy.id).select().single();
  } else {
    res = await query.upsert({ ...payload, company_id: policy.companyId }).select().single();
  }

  if (res.error) throw mapError(res.error, "تعذر حفظ سياسة الدوام");
  return mapAttendancePolicy(res.data);
}

export async function fetchAttendancePeriodsRecord(): Promise<AttendancePeriod[]> {
  const { data, error } = await db
    .from("attendance_periods")
    .select("*")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });

  if (error) throw mapError(error, "تعذر قراءة فترات الحضور");
  return (data ?? []).map(mapAttendancePeriod);
}

export async function createAttendancePeriodRecord(
  year: number,
  month: number,
  fromDate: string,
  toDate: string,
): Promise<AttendancePeriod> {
  const { data, error } = await db
    .from("attendance_periods")
    .insert({
      period_year: year,
      period_month: month,
      from_date: fromDate,
      to_date: toDate,
      status: "open",
    })
    .select()
    .single();

  if (error) throw mapError(error, "تعذر إنشاء فترة الحضور الشهرية");
  return mapAttendancePeriod(data);
}

export async function closeAttendancePeriodRecord(periodId: string): Promise<{ ok: boolean; snapshotsCount: number }> {
  const { data, error } = await db.rpc("close_attendance_period", {
    p_period_id: periodId,
  });

  if (error) throw mapError(error, "تعذر إغلاق فترة الحضور واعتماد اللقطة");
  const res = data as any;
  return { ok: Boolean(res?.ok), snapshotsCount: Number(res?.snapshots_count ?? 0) };
}

export async function reopenAttendancePeriodRecord(periodId: string, reason: string): Promise<boolean> {
  const { data, error } = await db.rpc("reopen_attendance_period", {
    p_period_id: periodId,
    p_reason: reason,
  });

  if (error) throw mapError(error, "تعذر إعادة فتح فترة الحضور");
  return Boolean((data as any)?.ok);
}

export async function fetchAttendancePayrollSnapshotsRecord(periodId: string): Promise<AttendancePayrollSnapshot[]> {
  const { data, error } = await db
    .from("attendance_payroll_snapshots")
    .select(`
      *,
      employees(id, employee_no, full_name, departments(name_ar))
    `)
    .eq("period_id", periodId);

  if (error) throw mapError(error, "تعذر قراءة لقطات مسير الرواتب للحضور");
  return (data ?? []).map((row: any) => mapAttendancePayrollSnapshot(row));
}

export async function fetchAttendanceExceptionsRecord(filters?: {
  employeeId?: string;
  resolved?: boolean;
  workDate?: string;
}): Promise<AttendanceException[]> {
  let query = db
    .from("attendance_exceptions")
    .select(`
      *,
      employees(id, employee_no, full_name, departments(name_ar))
    `)
    .order("work_date", { ascending: false });

  if (filters?.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (typeof filters?.resolved === "boolean") query = query.eq("resolved", filters.resolved);
  if (filters?.workDate) query = query.eq("work_date", filters.workDate);

  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر قراءة استثناءات ومخالفات الدوام");
  return (data ?? []).map((row: any) => mapAttendanceException(row));
}

export async function resolveAttendanceExceptionRecord(
  exceptionId: string,
  note: string,
): Promise<boolean> {
  const { data, error } = await db.rpc("resolve_attendance_exception", {
    p_exception_id: exceptionId,
    p_resolution_note: note,
  });

  if (error) throw mapError(error, "تعذر معالجة استثناء الدوام");
  return Boolean((data as any)?.ok);
}

export async function fetchPunchesRecord(filters?: {
  date?: string;
  employeeId?: string;
  status?: string;
}): Promise<PunchRecord[]> {
  let query = db
    .from("punches")
    .select(`
      *,
      employees(id, employee_no, full_name)
    `)
    .order("punch_time", { ascending: false })
    .limit(100);

  if (filters?.date) {
    query = query
      .gte("punch_time", `${filters.date}T00:00:00Z`)
      .lte("punch_time", `${filters.date}T23:59:59Z`);
  }
  if (filters?.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters?.status && filters.status !== "all") query = query.eq("approval_status", filters.status);

  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر قراءة البصمات الخام");
  return (data ?? []).map((row: any) => mapPunchRecord(row));
}

export async function importBiometricPunchesRecord(
  deviceId: string,
  punches: Array<{ employee_no: string; punch_time: string; punch_type: "in" | "out" }>,
): Promise<{ ok: boolean; total: number; successful: number; duplicates: number; failed: number }> {
  const { data, error } = await db.rpc("import_biometric_punches", {
    p_device_id: deviceId,
    p_punches: punches,
  });

  if (error) throw mapError(error, "تعذر استيراد بصمات الجهاز");
  const res = data as any;
  return {
    ok: Boolean(res?.ok),
    total: Number(res?.total ?? 0),
    successful: Number(res?.successful ?? 0),
    duplicates: Number(res?.duplicates ?? 0),
    failed: Number(res?.failed ?? 0),
  };
}

export async function fetchAttendanceSummaryKPIsRecord(dateStr?: string): Promise<AttendanceSummaryKPIs> {
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);

  const [recordsRes, empsRes, otRes, excRes] = await Promise.all([
    db.from("attendance_records").select("status, late_minutes").eq("work_date", targetDate),
    db.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("overtime_records").select("hours").eq("work_date", targetDate).eq("status", "approved"),
    db.from("attendance_exceptions").select("id", { count: "exact", head: true }).eq("work_date", targetDate).eq("resolved", false),
  ]);

  const totalEmployees = empsRes.count ?? 0;
  const records = recordsRes.data ?? [];
  const presentCount = records.filter((r: any) => r.status === "present").length;
  const lateCount = records.filter((r: any) => r.status === "late" || (r.late_minutes && r.late_minutes > 0)).length;
  const leaveCount = records.filter((r: any) => r.status === "leave").length;
  const absentCount = records.filter((r: any) => r.status === "absent").length;
  const attendanceRate = totalEmployees > 0 ? Math.round(((presentCount + lateCount) / totalEmployees) * 100) : 0;
  const totalOvertimeHours = (otRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.hours || 0), 0);
  const openExceptionsCount = excRes.count ?? 0;

  return {
    totalEmployees,
    presentCount,
    lateCount,
    absentCount,
    leaveCount,
    attendanceRate,
    totalOvertimeHours,
    openExceptionsCount,
  };
}
