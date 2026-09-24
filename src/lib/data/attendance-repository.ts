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
  AttendanceDevice,
  AttendanceDeviceEmployeeMapping,
  AttendanceRecordFilters,
  PaginatedAttendanceRecords,
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
    version: Number(row.version ?? 1),
    effectiveFrom: row.effective_from || new Date().toISOString().slice(0, 10),
    effectiveTo: row.effective_to ?? null,
    status: row.status || "active",
    jurisdiction: row.jurisdiction ?? null,
    maxGpsAccuracyMeters: row.max_gps_accuracy_meters != null ? Number(row.max_gps_accuracy_meters) : null,
    gracePeriodInMinutes: row.grace_period_in_minutes != null ? Number(row.grace_period_in_minutes) : null,
    gracePeriodOutMinutes: row.grace_period_out_minutes != null ? Number(row.grace_period_out_minutes) : null,
    overtimeRegularMultiplier: row.overtime_regular_multiplier != null ? Number(row.overtime_regular_multiplier) : null,
    overtimeHolidayMultiplier: row.overtime_holiday_multiplier != null ? Number(row.overtime_holiday_multiplier) : null,
    defaultWorkHoursPerDay: row.default_work_hours_per_day != null ? Number(row.default_work_hours_per_day) : null,
    ramadanWorkHoursPerDay: row.ramadan_work_hours_per_day != null ? Number(row.ramadan_work_hours_per_day) : null,
    maxWorkHoursPerWeek: row.max_work_hours_per_week != null ? Number(row.max_work_hours_per_week) : null,
    ramadanMaxWorkHoursPerWeek: row.ramadan_max_work_hours_per_week != null ? Number(row.ramadan_max_work_hours_per_week) : null,
    geofenceEnforced: Boolean(row.geofence_enforced),
    geofenceRadiusMeters: row.geofence_radius_meters != null ? Number(row.geofence_radius_meters) : null,
    autoDeductBreaks: Boolean(row.auto_deduct_breaks),
    breakDurationMinutes: row.break_duration_minutes != null ? Number(row.break_duration_minutes) : null,
    maxConsecutiveHoursWithoutBreak: row.max_consecutive_hours_without_break != null ? Number(row.max_consecutive_hours_without_break) : null,
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
    version: Number(row.version ?? 1),
    closingNotes: row.closing_notes ?? null,
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
    periodVersion: Number(row.period_version ?? 1),
    snapshotVersion: Number(row.snapshot_version ?? 1),
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
    approvedOvertimeMinutes: Number(row.approved_overtime_minutes ?? 0),
    payableOvertimeMinutes: Number(row.payable_overtime_minutes ?? 0),
    overtimeCategory: row.overtime_category || "standard",
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
    clientEventId: row.client_event_id ?? null,
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

export function mapAttendanceDevice(row: any): AttendanceDevice {
  return {
    id: row.id,
    companyId: row.company_id,
    locationId: row.location_id,
    deviceName: row.device_name || "جهاز بصمة",
    vendor: row.vendor || "generic",
    model: row.model,
    serialNumber: row.serial_number,
    deviceCode: row.device_code,
    timezone: row.timezone,
    status: row.status || "active",
    lastSeenAt: row.last_seen_at,
    lastSyncAt: row.last_sync_at,
    healthStatus: row.health_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  clientEventId?: string,
): Promise<{ ok: boolean; punchId: string; geofenceValid: boolean; message: string }> {
  const generatedEventId =
    clientEventId ||
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `punch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  const { data, error } = await db.rpc("record_self_punch", {
    p_punch_type: type,
    p_latitude: coords?.lat ?? null,
    p_longitude: coords?.lng ?? null,
    p_accuracy: accuracy ?? null,
    p_client_event_id: generatedEventId,
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
  searchTerm?: string;
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

  let records = (data ?? []).map((row) => mapDailyAttendanceRecord(row));
  if (filters?.searchTerm && filters.searchTerm.trim() !== "") {
    const s = filters.searchTerm.trim().toLowerCase();
    records = records.filter(
      (r) =>
        r.employeeName.toLowerCase().includes(s) ||
        r.employeeNo.toLowerCase().includes(s) ||
        r.departmentName.toLowerCase().includes(s),
    );
  }
  return records;
}

export async function fetchPaginatedAttendanceRecordsRecord(
  filters?: AttendanceRecordFilters,
): Promise<PaginatedAttendanceRecords> {
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filters?.pageSize ?? 20));
  const fromIndex = (page - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

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
      employees(id, employee_no, full_name, department_id, work_location_id, departments(name_ar)),
      shifts(id, name_ar)
    `, { count: "exact" })
    .order("work_date", { ascending: false });

  if (filters?.fromDate) query = query.gte("work_date", filters.fromDate);
  if (filters?.toDate) query = query.lte("work_date", filters.toDate);
  if (filters?.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters?.shiftId) query = (query as any).eq("shift_id", filters.shiftId);
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status as any);
  }

  query = query.range(fromIndex, toIndex);

  const { data, error, count } = await query;
  if (error) throw mapError(error, "تعذر قراءة سجلات الحضور المصفاة");

  let records = (data ?? []).map((row) => mapDailyAttendanceRecord(row));
  if (filters?.searchTerm && filters.searchTerm.trim() !== "") {
    const s = filters.searchTerm.trim().toLowerCase();
    records = records.filter(
      (r) =>
        r.employeeName.toLowerCase().includes(s) ||
        r.employeeNo.toLowerCase().includes(s) ||
        r.departmentName.toLowerCase().includes(s),
    );
  }

  const totalCount = count ?? records.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    records,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

export async function fetchAttendancePoliciesRecord(): Promise<AttendancePolicy | null> {
  const { data, error } = await db
    .from("attendance_policies")
    .select("*")
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw mapError(error, "تعذر قراءة سياسات الحضور");
  return data ? mapAttendancePolicy(data) : null;
}

export async function fetchAttendancePolicyVersionsRecord(): Promise<AttendancePolicy[]> {
  const { data, error } = await db
    .from("attendance_policies")
    .select("*")
    .order("version", { ascending: false });

  if (error) throw mapError(error, "تعذر قراءة سجل نسخ سياسات الحضور");
  return (data ?? []).map(mapAttendancePolicy);
}

export async function updateAttendancePolicyRecord(
  policy: Partial<AttendancePolicy>,
): Promise<AttendancePolicy> {
  const payload: Record<string, unknown> = {};

  if (policy.companyId) payload.company_id = policy.companyId;
  if (policy.nameAr !== undefined) payload.name_ar = policy.nameAr;
  if (policy.jurisdiction !== undefined) payload.jurisdiction = policy.jurisdiction;
  if (policy.effectiveFrom !== undefined) payload.effective_from = policy.effectiveFrom;
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
  if (policy.maxGpsAccuracyMeters !== undefined) payload.max_gps_accuracy_meters = policy.maxGpsAccuracyMeters;
  if (policy.autoDeductBreaks !== undefined) payload.auto_deduct_breaks = policy.autoDeductBreaks;
  if (policy.breakDurationMinutes !== undefined) payload.break_duration_minutes = policy.breakDurationMinutes;
  if (policy.maxConsecutiveHoursWithoutBreak !== undefined) payload.max_consecutive_hours_without_break = policy.maxConsecutiveHoursWithoutBreak;
  if (policy.requireBiometricOrGps !== undefined) payload.require_biometric_or_gps = policy.requireBiometricOrGps;
  if (policy.allowMobilePunch !== undefined) payload.allow_mobile_punch = policy.allowMobilePunch;
  if (policy.overtimePreApprovalRequired !== undefined) payload.overtime_pre_approval_required = policy.overtimePreApprovalRequired;

  const { data, error } = await db.rpc("save_attendance_policy", {
    p_policy: payload,
  });

  if (error) throw mapError(error, "تعذر حفظ سياسة الدوام");

  const saved = await fetchAttendancePoliciesRecord();
  if (!saved) {
    throw new AppMutationError("تعذر قراءة سياسة الحضور بعد الحفظ", "backend");
  }
  return saved;
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

  const { data, error } = await db.rpc("get_attendance_summary_kpis", {
    p_target_date: targetDate,
  });

  if (error) throw mapError(error, "تعذر استرجاع مؤشرات الحضور من الخادم");

  const res = data as any;
  return {
    totalEmployees: Number(res?.total_employees ?? 0),
    presentCount: Number(res?.present_count ?? 0),
    lateCount: Number(res?.late_count ?? 0),
    absentCount: Number(res?.absent_count ?? 0),
    leaveCount: Number(res?.leave_count ?? 0),
    attendanceRate: Number(res?.attendance_rate ?? 0),
    totalOvertimeHours: Number(res?.total_overtime_hours ?? 0),
    openExceptionsCount: Number(res?.open_exceptions_count ?? 0),
    isPolicyConfigured: Boolean(res?.is_policy_configured),
  };
}

export async function fetchAttendanceDevicesRecord(): Promise<AttendanceDevice[]> {
  const { data, error } = await db
    .from("attendance_devices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw mapError(error, "تعذر قراءة أجهزة البصمة");
  return (data ?? []).map(mapAttendanceDevice);
}

export async function createAttendanceDeviceRecord(device: Partial<AttendanceDevice>): Promise<AttendanceDevice> {
  const { data, error } = await db
    .from("attendance_devices")
    .insert({
      device_name: device.deviceName,
      vendor: device.vendor || "generic",
      model: device.model,
      serial_number: device.serialNumber,
      device_code: device.deviceCode,
      location_id: device.locationId,
      timezone: device.timezone,
      status: device.status || "active",
    })
    .select()
    .single();

  if (error) throw mapError(error, "تعذر إضافة جهاز البصمة");
  return mapAttendanceDevice(data);
}

export async function fetchAttendanceDeviceEmployeeMappingsRecord(deviceId?: string): Promise<AttendanceDeviceEmployeeMapping[]> {
  let query = db.from("attendance_device_employee_mappings").select("*");
  if (deviceId) query = query.eq("device_id", deviceId);

  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر قراءة ربط موظفي أجهزة البصمة");
  return (data ?? []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    deviceId: row.device_id,
    externalUserId: row.external_user_id,
    employeeId: row.employee_id,
    createdAt: row.created_at,
  }));
}

export async function createAttendanceDeviceEmployeeMappingRecord(
  deviceId: string,
  externalUserId: string,
  employeeId: string,
): Promise<AttendanceDeviceEmployeeMapping> {
  const { data, error } = await db
    .from("attendance_device_employee_mappings")
    .insert({
      device_id: deviceId,
      external_user_id: externalUserId,
      employee_id: employeeId,
    })
    .select()
    .single();

  if (error) throw mapError(error, "تعذر ربط الموظف بجهاز البصمة");
  return {
    id: data.id,
    companyId: data.company_id,
    deviceId: data.device_id,
    externalUserId: data.external_user_id,
    employeeId: data.employee_id,
    createdAt: data.created_at,
  };
}

export async function processAttendanceDayRecord(employeeId: string, businessDate: string): Promise<any> {
  const { data, error } = await db.rpc("process_attendance_day", {
    p_employee_id: employeeId,
    p_business_date: businessDate,
  });

  if (error) throw mapError(error, "تعذر معالجة حضور اليوم للموظف");
  return data;
}

export async function processAttendanceRangeRecord(
  fromDate: string,
  toDate: string,
  companyId?: string,
): Promise<{ ok: boolean; processedDays: number }> {
  const { data, error } = await db.rpc("process_company_attendance_range", {
    p_from_date: fromDate,
    p_to_date: toDate,
    p_company_id: companyId || null,
  });

  if (error) throw mapError(error, "تعذر معالجة سجلات الحضور للفترة");
  const res = data as any;
  return { ok: Boolean(res?.ok), processedDays: Number(res?.processed_days ?? 0) };
}

export async function fetchEffectiveCompanyTimezoneRecord(companyId?: string): Promise<string> {
  const { data, error } = await db.rpc("get_effective_company_timezone", {
    p_company_id: companyId || null,
  });

  if (error) {
    return "Asia/Riyadh";
  }
  return (data as string) || "Asia/Riyadh";
}
