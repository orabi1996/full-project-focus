import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, round2 } from "./guards";
import { computePayrollRun } from "./payroll.functions";

interface ProcessInput {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  employeeId?: string | null;
}

function toMinutes(time: string) {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

function timeOfDay(iso: string) {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/**
 * Converts raw punches into daily attendance records:
 * worked minutes, late minutes and overtime, based on the assigned shift.
 */
export const processAttendanceServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProcessInput) => {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(input.fromDate) || !re.test(input.toDate)) throw new Error("تاريخ غير صالح");
    if (input.toDate < input.fromDate) throw new Error("نطاق التاريخ غير صحيح");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const callerRoles = await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "attendance_officer",
      "line_manager",
    ]);

    const isSuperAdmin = callerRoles.includes("super_admin");

    // 1. Resolve caller employee record to find their company and employee id
    const { data: callerEmp } = await supabase
      .from("employees")
      .select("id, company_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    let callerCompanyId = callerEmp?.company_id;
    if (!callerCompanyId && !isSuperAdmin) {
      const { data: empRole } = await supabase
        .from("employee_roles")
        .select("company_id")
        .eq("user_id", context.userId)
        .limit(1)
        .maybeSingle();
      callerCompanyId = empRole?.company_id;
    }

    if (!isSuperAdmin && !callerCompanyId) {
      throw new Error("غير مصرح: لم يتم العثور على منشأة تابعة للمستخدم");
    }

    const isLineManagerOnly =
      !isSuperAdmin &&
      !callerRoles.some((r: string) => ["org_admin", "hr_manager", "attendance_officer"].includes(r)) &&
      callerRoles.includes("line_manager");

    // 2. Query employees strictly scoped to caller's company (and line manager team if line manager)
    let empQuery = supabase.from("employees").select("id, company_id, manager_id").eq("status", "active");
    if (!isSuperAdmin && callerCompanyId) {
      empQuery = empQuery.eq("company_id", callerCompanyId);
    }
    if (isLineManagerOnly) {
      if (callerEmp?.id) {
        empQuery = empQuery.or(`manager_id.eq.${callerEmp.id},id.eq.${callerEmp.id}`);
      } else {
        throw new Error("غير مصرح: لم يتم العثور على سجل موظف للمدير المباشر");
      }
    }

    const { data: activeEmployees, error: empErr } = await empQuery;
    if (empErr) throw new Error(`تعذر استرجاع بيانات الموظفين: ${empErr.message}`);

    const allowedEmpIds = new Set((activeEmployees ?? []).map((e: any) => e.id));
    const empCompanyMap = new Map((activeEmployees ?? []).map((e: any) => [e.id, e.company_id]));

    // If data.employeeId was requested, enforce that it belongs to the allowed scope!
    if (data.employeeId) {
      if (!allowedEmpIds.has(data.employeeId)) {
        throw new Error("غير مصرح: لا يمكنك معالجة سجلات موظف خارج نطاق صلاحيتك");
      }
    }

    const targetEmpIds = data.employeeId ? [data.employeeId] : Array.from(allowedEmpIds);
    if (targetEmpIds.length === 0) {
      return { processed: 0, exceptions: 0 };
    }

    // 3. Query punches strictly for authorized employees
    let punchQuery = supabase
      .from("punches")
      .select("employee_id, punch_time, punch_type, geofence_valid")
      .neq("approval_status", "rejected")
      .gte("punch_time", `${data.fromDate}T00:00:00Z`)
      .lte("punch_time", `${data.toDate}T23:59:59Z`)
      .order("punch_time");

    if (data.employeeId) {
      punchQuery = punchQuery.eq("employee_id", data.employeeId);
    } else {
      punchQuery = punchQuery.in("employee_id", targetEmpIds);
    }

    // 4. Query authoritative published schedules via security-invoker view (FAIL CLOSED)
    let scheduleQuery = supabase
      .from("vw_effective_published_schedules")
      .select(
        "employee_id, shift_id, shift_version, work_date, is_rest_day, work_location_id, roster_version, roster_period_id, start_time, end_time, grace_minutes_arrival, grace_minutes_departure, overtime_eligible, is_overnight, break_minutes",
      )
      .gte("work_date", data.fromDate)
      .lte("work_date", data.toDate);

    if (data.employeeId) {
      scheduleQuery = scheduleQuery.eq("employee_id", data.employeeId);
    } else {
      scheduleQuery = scheduleQuery.in("employee_id", targetEmpIds);
    }

    const scheduleRes = await scheduleQuery;
    if (scheduleRes.error) {
      // Prompt 13.3 requirement: FAIL CLOSED! No fallback to raw schedule_assignments ORDER BY roster_version DESC
      throw new Error(`تعذر استرجاع جداول العمل المعتمدة من العرض الإحصائي: ${scheduleRes.error.message}`);
    }

    // 5. Query shifts and approved leaves
    let shiftQuery = supabase
      .from("shifts")
      .select(
        "id, start_time, end_time, grace_minutes_arrival, grace_minutes_departure, overtime_eligible, is_overnight, break_minutes",
      );
    if (!isSuperAdmin && callerCompanyId) {
      shiftQuery = shiftQuery.eq("company_id", callerCompanyId);
    }

    let leaveQuery = supabase
      .from("leave_requests")
      .select("employee_id, start_date, end_date, status")
      .eq("status", "approved")
      .lte("start_date", data.toDate)
      .gte("end_date", data.fromDate);

    if (data.employeeId) {
      leaveQuery = leaveQuery.eq("employee_id", data.employeeId);
    } else {
      leaveQuery = leaveQuery.in("employee_id", targetEmpIds);
    }

    const [punchRes, shiftRes, leavesRes] = await Promise.all([
      punchQuery,
      shiftQuery,
      leaveQuery,
    ]);

    if (punchRes.error) throw new Error(`تعذر قراءة البصمات: ${punchRes.error.message}`);

    const shifts = new Map<string, any>((shiftRes.data ?? []).map((s: any) => [s.id, s]));

    // Deterministic single current published schedule resolution with Cardinality Guard
    const schedules = new Map<string, any>();
    const conflictingScheduleKeys = new Set<string>();

    for (const s of scheduleRes.data ?? []) {
      const key = `${s.employee_id}|${s.work_date}`;
      if (schedules.has(key)) {
        conflictingScheduleKeys.add(key);
      } else {
        schedules.set(key, s);
      }
    }

    // Build leave set: "employeeId|YYYY-MM-DD"
    const leaveDays = new Set<string>();
    for (const lr of leavesRes.data ?? []) {
      const cur = new Date(lr.start_date);
      const end = new Date(lr.end_date);
      while (cur <= end) {
        leaveDays.add(`${lr.employee_id}|${cur.toISOString().slice(0, 10)}`);
        cur.setDate(cur.getDate() + 1);
      }
    }

    const grouped = new Map<string, { in?: string; out?: string; geofenceValid?: boolean }>();
    for (const punch of punchRes.data ?? []) {
      const day = String(punch.punch_time).slice(0, 10);
      const key = `${punch.employee_id}|${day}`;
      const entry = grouped.get(key) ?? { geofenceValid: true };
      if (punch.punch_type === "in") {
        if (!entry.in) entry.in = punch.punch_time;
      } else {
        entry.out = punch.punch_time;
      }
      if (punch.geofence_valid === false) entry.geofenceValid = false;
      grouped.set(key, entry);
    }

    const rows: Record<string, unknown>[] = [];
    const exceptions: Record<string, unknown>[] = [];
    const processedDays = new Set<string>();

    for (const [key, entry] of grouped) {
      processedDays.add(key);
      const [employeeId, workDate] = key.split("|");

      // CARDINALITY GUARD: Detect conflicting schedules
      if (conflictingScheduleKeys.has(key)) {
        exceptions.push({
          employee_id: employeeId,
          work_date: workDate,
          exception_type: "authoritative_schedule_integrity_error",
          severity: "error",
          minutes: 0,
          description: "تعارض حرج في قاعدة البيانات: يوجد أكثر من جدول معتمد ومنشور لنفس الموظف في هذا التاريخ",
        });

        rows.push({
          employee_id: employeeId,
          work_date: workDate,
          check_in: entry.in ? formatTime(timeOfDay(entry.in)) : null,
          check_out: entry.out ? formatTime(timeOfDay(entry.out)) : null,
          status: "authoritative_schedule_integrity_error",
          worked_hours: 0,
          worked_minutes: 0,
          late_minutes: 0,
          overtime_minutes: 0,
          overtime_hours: 0,
          geofence_valid: entry.geofenceValid ?? true,
          work_location_id: null,
          shift_id: null,
          shift_version: null,
          roster_version: null,
          roster_period_id: null,
          is_manual: false,
          note: "تعارض حرج: وجود أكثر من جدول عمل معتمد لنفس اليوم (authoritative_schedule_integrity_error)",
        });
        continue;
      }

      const schedule = schedules.get(key);
      const isLeave = leaveDays.has(key);
      const isRest = schedule?.is_rest_day ?? false;
      const shift = schedule?.shift_id ? (shifts.get(schedule.shift_id) || schedule) : undefined;

      if (isLeave) {
        rows.push({
          employee_id: employeeId,
          work_date: workDate,
          status: "leave",
          worked_hours: 0,
          worked_minutes: 0,
          late_minutes: 0,
          overtime_minutes: 0,
          overtime_hours: 0,
          work_location_id: schedule?.work_location_id ?? null,
          shift_id: schedule?.shift_id ?? null,
          shift_version: schedule?.shift_version ?? null,
          roster_version: schedule?.roster_version ?? null,
          roster_period_id: schedule?.roster_period_id ?? null,
          note: "إجازة معتمدة",
          is_manual: false,
        });
        continue;
      }

      // TRUTHFULNESS: If no valid authoritative schedule/shift exists (and not a rest day):
      // Do NOT invent 8 hours or calculate overtime! Emit schedule_not_configured exception and keep punches unfinalized.
      if (!schedule || (!shift && !isRest)) {
        exceptions.push({
          employee_id: employeeId,
          work_date: workDate,
          exception_type: "schedule_not_configured",
          severity: "error",
          description: "لا يوجد جدول عمل منشور أو وردية معتمدة لهذا اليوم، لا يمكن احتساب ساعات العمل أو الإضافي",
        });

        rows.push({
          employee_id: employeeId,
          work_date: workDate,
          check_in: entry.in ? formatTime(timeOfDay(entry.in)) : null,
          check_out: entry.out ? formatTime(timeOfDay(entry.out)) : null,
          status: "schedule_not_configured",
          worked_hours: 0,
          worked_minutes: 0,
          late_minutes: 0,
          overtime_minutes: 0,
          overtime_hours: 0,
          geofence_valid: entry.geofenceValid ?? true,
          work_location_id: null,
          shift_id: null,
          shift_version: null,
          roster_version: null,
          roster_period_id: null,
          is_manual: false,
          note: "تم تسجيل البصمات دون وجود جدول عمل منشور معتمد (قيد المراجعة الإدارية)",
        });
        continue;
      }

      if (!entry.in) {
        if (entry.out) {
          exceptions.push({
            employee_id: employeeId,
            work_date: workDate,
            exception_type: "missing_in",
            severity: "warning",
            description: "بصمة انصراف مسجلة دون بصمة حضور",
          });
        }
        continue;
      }

      const checkInMin = timeOfDay(entry.in);
      const checkOutMin = entry.out ? timeOfDay(entry.out) : null;

      let lateMinutes = 0;
      let overtimeMinutes = 0;
      let expectedMinutes = 0;
      const isOvernight = shift?.is_overnight || (shift && toMinutes(shift.end_time) < toMinutes(shift.start_time));

      if (shift && !isRest) {
        const shiftStart = toMinutes(shift.start_time);
        const shiftEnd = toMinutes(shift.end_time);
        expectedMinutes = (shiftEnd >= shiftStart ? shiftEnd : shiftEnd + 1440) - shiftStart;
        if (shift.break_minutes) {
          expectedMinutes = Math.max(0, expectedMinutes - shift.break_minutes);
        }
        const grace = shift.grace_minutes_arrival ?? 0;
        lateMinutes = Math.max(0, checkInMin - shiftStart - grace);
      }

      let workedMinutes = 0;
      if (checkOutMin !== null) {
        if (checkOutMin >= checkInMin) {
          workedMinutes = checkOutMin - checkInMin;
        } else if (isOvernight) {
          workedMinutes = checkOutMin + 1440 - checkInMin;
        } else {
          workedMinutes = checkOutMin + 1440 - checkInMin;
        }

        if (shift?.break_minutes && workedMinutes > 5 * 60) {
          workedMinutes = Math.max(0, workedMinutes - shift.break_minutes);
        }

        if (isRest) {
          // Working on a rest day is 100% overtime
          overtimeMinutes = workedMinutes;
        } else if (shift && shift.overtime_eligible !== false) {
          overtimeMinutes = Math.max(0, workedMinutes - expectedMinutes);
        }
      } else {
        exceptions.push({
          employee_id: employeeId,
          work_date: workDate,
          exception_type: "missing_out",
          severity: "warning",
          description: "لم يتم تسجيل بصمة انصراف للوردية",
        });
      }

      if (lateMinutes > 0) {
        exceptions.push({
          employee_id: employeeId,
          work_date: workDate,
          exception_type: "late_arrival",
          severity: lateMinutes > 60 ? "violation" : "warning",
          minutes: lateMinutes,
          description: `تأخر عن موعد الحضور بـ ${lateMinutes} دقيقة`,
        });
      }

      rows.push({
        employee_id: employeeId,
        work_date: workDate,
        check_in: formatTime(checkInMin),
        check_out: checkOutMin !== null ? formatTime(checkOutMin) : null,
        status: lateMinutes > 0 ? "late" : "present",
        worked_hours: round2(workedMinutes / 60),
        worked_minutes: workedMinutes,
        late_minutes: lateMinutes,
        overtime_minutes: overtimeMinutes,
        overtime_hours: round2(overtimeMinutes / 60),
        geofence_valid: entry.geofenceValid ?? true,
        work_location_id: schedule.work_location_id || null,
        shift_id: schedule.shift_id || null,
        shift_version: schedule.shift_version || 1,
        roster_version: schedule.roster_version || 1,
        roster_period_id: schedule.roster_period_id || null,
        is_manual: false,
        note: isRest ? "حضور في يوم راحة أسبوعية (عمل إضافي)" : "احتُسب آليًا من البصمات والجدول المعتمد",
      });
    }

    // Process any unpunched days that have conflicting schedules
    for (const key of conflictingScheduleKeys) {
      if (!processedDays.has(key)) {
        processedDays.add(key);
        const [employeeId, workDate] = key.split("|");
        exceptions.push({
          employee_id: employeeId,
          work_date: workDate,
          exception_type: "authoritative_schedule_integrity_error",
          severity: "error",
          minutes: 0,
          description: "تعارض حرج في قاعدة البيانات: يوجد أكثر من جدول معتمد ومنشور لنفس الموظف في هذا التاريخ",
        });

        rows.push({
          employee_id: employeeId,
          work_date: workDate,
          check_in: null,
          check_out: null,
          status: "authoritative_schedule_integrity_error",
          worked_hours: 0,
          worked_minutes: 0,
          late_minutes: 0,
          overtime_minutes: 0,
          overtime_hours: 0,
          geofence_valid: true,
          work_location_id: null,
          shift_id: null,
          shift_version: null,
          roster_version: null,
          roster_period_id: null,
          is_manual: false,
          note: "تعارض حرج: وجود أكثر من جدول عمل معتمد لنفس اليوم (authoritative_schedule_integrity_error)",
        });
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from("attendance_records")
        .upsert(rows, { onConflict: "employee_id,work_date" });
      if (error) throw new Error(`تعذر حفظ سجلات الحضور: ${error.message}`);
    }

    if (exceptions.length > 0) {
      const excRows = exceptions.map((exc) => ({
        ...exc,
        company_id: (exc as any).company_id || empCompanyMap.get(exc.employee_id as string) || callerCompanyId,
      }));
      try {
        await supabase.from("attendance_exceptions").insert(excRows);
      } catch {
        // Attendance exceptions table might have optional foreign key or specific RLS
      }
    }

    return { processed: rows.length, exceptions: exceptions.length };
  });

// ============================================================
// Biometric devices, live punches and attendance settlement
// ============================================================

const HR_ATTENDANCE_ROLES = [
  "super_admin",
  "org_admin",
  "hr_manager",
  "attendance_officer",
] as const;

async function resolveEmployeeId(supabase: any, ref: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(ref);
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, employee_no")
    .eq(isUuid ? "id" : "employee_no", ref)
    .maybeSingle();
  if (error) throw new Error(`تعذر البحث عن الموظف: ${error.message}`);
  if (!data) throw new Error("لا يوجد موظف بهذا الرقم الوظيفي");
  return data;
}

/** Lists registered biometric devices (tokens are never exposed). */
export const listBiometricDevicesServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...HR_ATTENDANCE_ROLES]);
    const { data, error } = await supabase
      .from("biometric_devices")
      .select(
        "id, device_id, name_ar, status, auto_approve, last_seen_at, total_punches, created_at",
      )
      .order("created_at");
    if (error) throw new Error(`تعذر قراءة الأجهزة: ${error.message}`);
    return data ?? [];
  });

/** Registers a physical device and returns its connection token exactly once. */
export const registerBiometricDeviceServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { deviceId: string; nameAr: string; autoApprove?: boolean }) => {
    if (!input.deviceId?.trim()) throw new Error("معرّف الجهاز مطلوب");
    if (!input.nameAr?.trim()) throw new Error("اسم الجهاز مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, ["super_admin", "org_admin", "hr_manager"]);
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("biometric_devices").upsert(
      {
        device_id: data.deviceId.trim(),
        name_ar: data.nameAr.trim(),
        device_token: token,
        auto_approve: data.autoApprove ?? false,
        status: "active",
      },
      { onConflict: "device_id" },
    );
    if (error) throw new Error(`تعذر تسجيل الجهاز: ${error.message}`);
    return { deviceId: data.deviceId.trim(), token };
  });

/** Records a real punch (device terminal or supervisor entry) into the punches table. */
export const recordPunchServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      employeeRef: string;
      punchType: "in" | "out";
      deviceId?: string;
      latitude?: number | null;
      longitude?: number | null;
    }) => {
      if (!input.employeeRef?.trim()) throw new Error("الرقم الوظيفي مطلوب");
      if (input.punchType !== "in" && input.punchType !== "out")
        throw new Error("نوع البصمة غير صالح");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...HR_ATTENDANCE_ROLES, "line_manager"]);
    const employee = await resolveEmployeeId(supabase, data.employeeRef.trim());

    const deviceId = data.deviceId?.trim() || "FP-TERMINAL-01";
    const { data: device } = await supabase
      .from("biometric_devices")
      .select("device_id, auto_approve, total_punches")
      .eq("device_id", deviceId)
      .maybeSingle();

    const { error } = await supabase.from("punches").insert({
      employee_id: employee.id,
      punch_time: new Date().toISOString(),
      punch_type: data.punchType,
      source: "biometric",
      device_id: deviceId,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      approval_status: device?.auto_approve ? "approved" : "pending",
    });
    if (error) throw new Error(`تعذر تسجيل البصمة: ${error.message}`);

    if (device) {
      await supabase
        .from("biometric_devices")
        .update({
          last_seen_at: new Date().toISOString(),
          total_punches: Number(device.total_punches ?? 0) + 1,
        })
        .eq("device_id", deviceId);
    }

    return { employeeName: employee.full_name, employeeNo: employee.employee_no };
  });

/** Lists punches for a day with employee identity and approval state. */
export const listPunchesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("تاريخ غير صالح");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...HR_ATTENDANCE_ROLES, "line_manager"]);
    const { data: rows, error } = await supabase
      .from("punches")
      .select(
        "id, employee_id, punch_time, punch_type, source, device_id, approval_status, employees(full_name, employee_no)",
      )
      .gte("punch_time", `${data.date}T00:00:00Z`)
      .lte("punch_time", `${data.date}T23:59:59Z`)
      .order("punch_time", { ascending: false });
    if (error) throw new Error(`تعذر قراءة البصمات: ${error.message}`);
    return (rows ?? []).map((row: any) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employees?.full_name ?? "—",
      employeeNo: row.employees?.employee_no ?? "—",
      punchTime: row.punch_time,
      punchType: row.punch_type,
      source: row.source,
      deviceId: row.device_id,
      approvalStatus: row.approval_status,
    }));
  });

/** Rebuilds one employee's attendance record for a single day from approved punches. */
export async function recomputeDay(supabase: any, employeeId: string, day: string) {
  const { data: punches } = await supabase
    .from("punches")
    .select("punch_time, punch_type")
    .eq("employee_id", employeeId)
    .neq("approval_status", "rejected")
    .gte("punch_time", `${day}T00:00:00Z`)
    .lte("punch_time", `${day}T23:59:59Z`)
    .order("punch_time");

  const list = punches ?? [];
  const firstIn = list.find((p: any) => p.punch_type === "in");
  if (!firstIn) {
    await supabase
      .from("attendance_records")
      .delete()
      .eq("employee_id", employeeId)
      .eq("work_date", day)
      .eq("is_manual", false);
    return;
  }
  const lastOut = [...list].reverse().find((p: any) => p.punch_type === "out");
  const checkInMin = timeOfDay(firstIn.punch_time);
  const checkOutMin = lastOut ? timeOfDay(lastOut.punch_time) : null;

  // 1. Resolve authoritative effective published schedule
  const { data: scheduleList, error: schedError } = await supabase
    .from("vw_effective_published_schedules")
    .select(
      "shift_id, shift_version, work_date, is_rest_day, work_location_id, roster_version, roster_period_id, start_time, end_time, grace_minutes_arrival, overtime_eligible, break_minutes, is_overnight, company_id",
    )
    .eq("employee_id", employeeId)
    .eq("work_date", day);

  if (schedError) {
    throw new Error(`تعذر استرجاع جدول العمل المعتمد للموظف: ${schedError.message}`);
  }

  // Cardinality Guard: if more than 1 authoritative schedule exists, record integrity error
  if (scheduleList && scheduleList.length > 1) {
    await supabase.from("attendance_records").upsert(
      {
        employee_id: employeeId,
        work_date: day,
        check_in: formatTime(checkInMin),
        check_out: checkOutMin !== null ? formatTime(checkOutMin) : null,
        status: "authoritative_schedule_integrity_error",
        worked_hours: 0,
        worked_minutes: 0,
        late_minutes: 0,
        overtime_minutes: 0,
        overtime_hours: 0,
        work_location_id: null,
        shift_id: null,
        shift_version: null,
        roster_version: null,
        roster_period_id: null,
        is_manual: false,
        note: "تعارض حرج: وجود أكثر من جدول عمل معتمد لنفس اليوم (authoritative_schedule_integrity_error)",
      },
      { onConflict: "employee_id,work_date" },
    );

    try {
      await supabase.from("attendance_exceptions").insert({
        company_id: (scheduleList[0] as any)?.company_id || null,
        employee_id: employeeId,
        work_date: day,
        exception_type: "authoritative_schedule_integrity_error",
        severity: "error",
        minutes: 0,
        description: "تعارض حرج في قاعدة البيانات: يوجد أكثر من جدول معتمد ومنشور لنفس الموظف في هذا التاريخ",
        resolved: false,
      });
    } catch {
      // ignore
    }
    return;
  }

  const schedule = scheduleList && scheduleList.length === 1 ? scheduleList[0] : null;

  let shift: any = null;
  if (schedule?.shift_id) {
    if (schedule.start_time && schedule.end_time) {
      shift = schedule;
    } else {
      const { data } = await supabase
        .from("shifts")
        .select("start_time, end_time, grace_minutes_arrival, overtime_eligible, break_minutes, is_overnight")
        .eq("id", schedule.shift_id)
        .maybeSingle();
      shift = data;
    }
  }

  const isRest = schedule?.is_rest_day ?? false;

  // TRUTHFULNESS: If no valid published schedule/shift is resolved:
  // do NOT assume eight hours. Return truthful schedule_not_configured exception and do not calculate late or overtime.
  if (!schedule || (!shift && !isRest)) {
    await supabase.from("attendance_records").upsert(
      {
        employee_id: employeeId,
        work_date: day,
        check_in: formatTime(checkInMin),
        check_out: checkOutMin !== null ? formatTime(checkOutMin) : null,
        status: "schedule_not_configured",
        worked_hours: 0,
        worked_minutes: 0,
        late_minutes: 0,
        overtime_minutes: 0,
        overtime_hours: 0,
        work_location_id: null,
        shift_id: null,
        shift_version: null,
        roster_version: null,
        roster_period_id: null,
        is_manual: false,
        note: "تم تسجيل البصمات دون وجود جدول عمل منشور معتمد (قيد المراجعة الإدارية)",
      },
      { onConflict: "employee_id,work_date" },
    );
    return;
  }

  let expectedMinutes = 0;
  let lateMinutes = 0;
  const isOvernight = shift?.is_overnight || (shift && toMinutes(shift.end_time) < toMinutes(shift.start_time));

  if (shift && !isRest) {
    const start = toMinutes(shift.start_time);
    const end = toMinutes(shift.end_time);
    expectedMinutes = (end >= start ? end : end + 1440) - start;
    if (shift.break_minutes) {
      expectedMinutes = Math.max(0, expectedMinutes - shift.break_minutes);
    }
    lateMinutes = Math.max(0, checkInMin - start - (shift.grace_minutes_arrival ?? 0));
  }

  let workedMinutes = 0;
  let overtimeMinutes = 0;
  if (checkOutMin !== null) {
    workedMinutes =
      checkOutMin >= checkInMin ? checkOutMin - checkInMin : checkOutMin + 1440 - checkInMin;

    if (shift?.break_minutes && workedMinutes > 5 * 60) {
      workedMinutes = Math.max(0, workedMinutes - shift.break_minutes);
    }

    if (isRest) {
      overtimeMinutes = workedMinutes;
    } else if (shift && shift.overtime_eligible !== false) {
      overtimeMinutes = Math.max(0, workedMinutes - expectedMinutes);
    }
  }

  await supabase.from("attendance_records").upsert(
    {
      employee_id: employeeId,
      work_date: day,
      check_in: formatTime(checkInMin),
      check_out: checkOutMin !== null ? formatTime(checkOutMin) : null,
      status: lateMinutes > 0 ? "late" : "present",
      worked_hours: round2(workedMinutes / 60),
      worked_minutes: workedMinutes,
      late_minutes: lateMinutes,
      overtime_minutes: overtimeMinutes,
      overtime_hours: round2(overtimeMinutes / 60),
      work_location_id: schedule.work_location_id || null,
      shift_id: schedule.shift_id || null,
      shift_version: schedule.shift_version || 1,
      roster_version: schedule.roster_version || 1,
      roster_period_id: schedule.roster_period_id || null,
      is_manual: false,
      note: isRest ? "حضور في يوم راحة أسبوعية (عمل إضافي)" : "احتُسب آليًا من بصمات الجهاز والجدول المعتمد",
    },
    { onConflict: "employee_id,work_date" },
  );
}

/** Approves or rejects a punch, then rebuilds the affected attendance day. */
export const decidePunchServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { punchId: string; decision: "approved" | "rejected" }) => {
    if (!input.punchId) throw new Error("معرّف البصمة مطلوب");
    if (!["approved", "rejected"].includes(input.decision)) throw new Error("قرار غير صالح");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...HR_ATTENDANCE_ROLES, "line_manager"]);

    const { data: punch, error } = await supabase
      .from("punches")
      .update({ approval_status: data.decision })
      .eq("id", data.punchId)
      .select("employee_id, punch_time")
      .maybeSingle();
    if (error) throw new Error(`تعذر تحديث البصمة: ${error.message}`);
    if (!punch) throw new Error("البصمة غير موجودة");

    await recomputeDay(supabase, punch.employee_id, String(punch.punch_time).slice(0, 10));
    return { ok: true };
  });

/**
 * Settles one payroll month: approves pending punches, rebuilds attendance,
 * recomputes payroll from the settled attendance and locks the run.
 */
export const settleAttendancePeriodServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year: number; month: number }) => {
    if (!Number.isInteger(input.year) || !Number.isInteger(input.month)) {
      throw new Error("فترة غير صالحة");
    }
    if (input.month < 1 || input.month > 12) throw new Error("شهر غير صالح");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "payroll_officer",
    ]);

    const days = new Date(Date.UTC(data.year, data.month, 0)).getUTCDate();
    const from = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const to = `${data.year}-${String(data.month).padStart(2, "0")}-${String(days).padStart(2, "0")}`;

    const { data: pending } = await supabase
      .from("punches")
      .select("id, employee_id, punch_time")
      .eq("approval_status", "pending")
      .gte("punch_time", `${from}T00:00:00Z`)
      .lte("punch_time", `${to}T23:59:59Z`);

    if (pending?.length) {
      await supabase
        .from("punches")
        .update({ approval_status: "approved" })
        .in(
          "id",
          pending.map((p: any) => p.id),
        );
      const uniqueDays = new Set(
        pending.map((p: any) => `${p.employee_id}|${String(p.punch_time).slice(0, 10)}`),
      );
      for (const key of Array.from(uniqueDays) as string[]) {
        const [employeeId, day] = key.split("|");
        await recomputeDay(supabase, employeeId!, day!);
      }
    }

    const payroll = await computePayrollRun(supabase, { year: data.year, month: data.month });
    await supabase
      .from("payroll_runs")
      .update({ status: "locked", locked_at: new Date().toISOString() })
      .eq("id", payroll.runId);

    return {
      approvedPunches: pending?.length ?? 0,
      runId: payroll.runId,
      totalNet: payroll.totalNet,
      employees: payroll.employees,
    };
  });

/** Updates a registered biometric device (name, status, auto-approve). */
export const updateBiometricDeviceServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      nameAr?: string;
      status?: string;
      autoApprove?: boolean;
      rotateToken?: boolean;
    }) => {
      if (!input?.id) throw new Error("معرّف الجهاز مطلوب");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, ["super_admin", "org_admin", "hr_manager"]);

    const payload: Record<string, unknown> = {};
    if (data.nameAr?.trim()) payload["name_ar"] = data.nameAr.trim();
    if (data.status) payload["status"] = data.status;
    if (typeof data.autoApprove === "boolean") payload["auto_approve"] = data.autoApprove;
    let token: string | null = null;
    if (data.rotateToken) {
      token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      payload["device_token"] = token;
    }
    if (!Object.keys(payload).length) throw new Error("لا يوجد تغيير للحفظ");

    const { error } = await supabase.from("biometric_devices").update(payload).eq("id", data.id);
    if (error) throw new Error(`تعذر تحديث الجهاز: ${error.message}`);
    return { id: data.id, token };
  });

/** Removes a device; its historical punches (and payroll effect) stay intact. */
export const deleteBiometricDeviceServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("معرّف الجهاز مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, ["super_admin", "org_admin", "hr_manager"]);
    const { error } = await supabase.from("biometric_devices").delete().eq("id", data.id);
    if (error) throw new Error(`تعذر حذف الجهاز: ${error.message}`);
    return { ok: true };
  });
