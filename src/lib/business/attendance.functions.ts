import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, round2 } from "./guards";

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
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "attendance_officer",
      "line_manager",
    ]);

    let punchQuery = supabase
      .from("punches")
      .select("employee_id, punch_time, punch_type")
      .gte("punch_time", `${data.fromDate}T00:00:00Z`)
      .lte("punch_time", `${data.toDate}T23:59:59Z`)
      .neq("approval_status", "rejected")
      .order("punch_time");
    if (data.employeeId) punchQuery = punchQuery.eq("employee_id", data.employeeId);


    const [punchRes, scheduleRes, shiftRes] = await Promise.all([
      punchQuery,
      supabase
        .from("schedule_assignments")
        .select("employee_id, shift_id, work_date, is_rest_day")
        .gte("work_date", data.fromDate)
        .lte("work_date", data.toDate),
      supabase
        .from("shifts")
        .select(
          "id, start_time, end_time, grace_minutes_arrival, grace_minutes_departure, overtime_eligible",
        ),
    ]);

    if (punchRes.error) throw new Error(`تعذر قراءة البصمات: ${punchRes.error.message}`);

    const shifts = new Map<string, any>((shiftRes.data ?? []).map((s: any) => [s.id, s]));
    const schedules = new Map<string, any>(
      (scheduleRes.data ?? []).map((s: any) => [`${s.employee_id}|${s.work_date}`, s]),
    );

    const grouped = new Map<string, { in?: string; out?: string }>();
    for (const punch of punchRes.data ?? []) {
      const day = String(punch.punch_time).slice(0, 10);
      const key = `${punch.employee_id}|${day}`;
      const entry = grouped.get(key) ?? {};
      if (punch.punch_type === "in") {
        if (!entry.in) entry.in = punch.punch_time;
      } else {
        entry.out = punch.punch_time;
      }
      grouped.set(key, entry);
    }

    const rows: Record<string, unknown>[] = [];
    for (const [key, entry] of grouped) {
      const [employeeId, workDate] = key.split("|");
      const schedule = schedules.get(key);
      if (schedule?.is_rest_day) continue;
      const shift = schedule?.shift_id ? shifts.get(schedule.shift_id) : undefined;

      if (!entry.in) continue;
      const checkInMin = timeOfDay(entry.in);
      const checkOutMin = entry.out ? timeOfDay(entry.out) : null;

      let lateMinutes = 0;
      let overtimeMinutes = 0;
      let expectedMinutes = 8 * 60;

      if (shift) {
        const shiftStart = toMinutes(shift.start_time);
        const shiftEnd = toMinutes(shift.end_time);
        expectedMinutes = (shiftEnd >= shiftStart ? shiftEnd : shiftEnd + 1440) - shiftStart;
        const grace = shift.grace_minutes_arrival ?? 0;
        lateMinutes = Math.max(0, checkInMin - shiftStart - grace);
      }

      let workedMinutes = 0;
      if (checkOutMin !== null) {
        workedMinutes = checkOutMin >= checkInMin ? checkOutMin - checkInMin : checkOutMin + 1440 - checkInMin;
        if (!shift || shift.overtime_eligible !== false) {
          overtimeMinutes = Math.max(0, workedMinutes - expectedMinutes);
        }
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
        is_manual: false,
        note: "احتُسب آليًا من البصمات",
      });
    }

    if (!rows.length) return { processed: 0 };

    const { error } = await supabase
      .from("attendance_records")
      .upsert(rows, { onConflict: "employee_id,work_date" });
    if (error) throw new Error(`تعذر حفظ سجلات الحضور: ${error.message}`);

    return { processed: rows.length };
  });

// ---------------------------------------------------------------------------
// Biometric terminal: real punches -> attendance records -> payroll
// ---------------------------------------------------------------------------

interface PunchInput {
  employeeCode: string; // employee number or employee id
  punchType: "in" | "out";
  source?: "biometric_device" | "mobile_gps" | "manual_admin";
  deviceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Registers a raw biometric punch for an employee (pending approval). */
export const recordPunchServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PunchInput) => {
    if (!input.employeeCode?.trim()) throw new Error("رقم الموظف مطلوب");
    if (!["in", "out"].includes(input.punchType)) throw new Error("نوع البصمة غير صالح");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "attendance_officer",
      "line_manager",
    ]);

    const code = data.employeeCode.trim();
    const isUuid = /^[0-9a-f-]{36}$/i.test(code);
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, employee_no, full_name, status")
      .eq(isUuid ? "id" : "employee_no", code)
      .maybeSingle();
    if (empError) throw new Error(`تعذر قراءة بيانات الموظف: ${empError.message}`);
    if (!employee) throw new Error("لا يوجد موظف بهذا الرقم الوظيفي");
    if (employee.status === "terminated") throw new Error("الموظف غير نشط ولا يمكن تسجيل بصمته");

    const punchTime = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from("punches")
      .insert({
        employee_id: employee.id,
        punch_time: punchTime,
        punch_type: data.punchType,
        source: data.source ?? "biometric_device",
        device_id: data.deviceId ?? "FP-TERMINAL-01",
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        geofence_valid: data.latitude != null && data.longitude != null ? true : null,
        approval_status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(`تعذر تسجيل البصمة: ${error.message}`);

    return {
      punchId: inserted.id,
      employeeId: employee.id,
      employeeName: employee.full_name,
      employeeNo: employee.employee_no,
      punchTime,
    };
  });

/** Lists punches for a given day with employee identity, newest first. */
export const listPunchesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("تاريخ غير صالح");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: rows, error } = await supabase
      .from("punches")
      .select(
        "id, employee_id, punch_time, punch_type, source, device_id, approval_status, employees(employee_no, full_name)",
      )
      .gte("punch_time", `${data.date}T00:00:00Z`)
      .lte("punch_time", `${data.date}T23:59:59Z`)
      .order("punch_time", { ascending: false });
    if (error) throw new Error(`تعذر قراءة البصمات: ${error.message}`);

    return (rows ?? []).map((row: any) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeNo: row.employees?.employee_no ?? "",
      employeeName: row.employees?.full_name ?? "",
      punchTime: row.punch_time,
      punchType: row.punch_type as "in" | "out",
      source: row.source as string,
      deviceId: row.device_id as string | null,
      approvalStatus: row.approval_status as "pending" | "approved" | "rejected",
    }));
  });

/**
 * Approves or rejects a punch. Rejected punches are excluded from attendance,
 * so the affected day is re-processed and payroll changes on the next run.
 */
export const decidePunchServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { punchId: string; decision: "approved" | "rejected" }) => {
    if (!input.punchId) throw new Error("معرّف البصمة مطلوب");
    if (!["approved", "rejected"].includes(input.decision)) throw new Error("قرار غير صالح");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "attendance_officer",
      "line_manager",
    ]);

    const { data: punch, error: readError } = await supabase
      .from("punches")
      .select("id, employee_id, punch_time")
      .eq("id", data.punchId)
      .maybeSingle();
    if (readError) throw new Error(`تعذر قراءة البصمة: ${readError.message}`);
    if (!punch) throw new Error("البصمة غير موجودة");

    const { error } = await supabase
      .from("punches")
      .update({ approval_status: data.decision })
      .eq("id", data.punchId);
    if (error) throw new Error(`تعذر تحديث حالة البصمة: ${error.message}`);

    const day = String(punch.punch_time).slice(0, 10);
    const recomputed = await recomputeDay(supabase, punch.employee_id, day);
    return { ok: true, day, employeeId: punch.employee_id, ...recomputed };
  });

/** Rebuilds one employee's attendance record for a single day from approved punches. */
async function recomputeDay(supabase: any, employeeId: string, day: string) {
  const [{ data: punches }, { data: schedule }, { data: shiftRows }] = await Promise.all([
    supabase
      .from("punches")
      .select("punch_time, punch_type")
      .eq("employee_id", employeeId)
      .neq("approval_status", "rejected")
      .gte("punch_time", `${day}T00:00:00Z`)
      .lte("punch_time", `${day}T23:59:59Z`)
      .order("punch_time"),
    supabase
      .from("schedule_assignments")
      .select("shift_id, is_rest_day")
      .eq("employee_id", employeeId)
      .eq("work_date", day)
      .maybeSingle(),
    supabase
      .from("shifts")
      .select("id, start_time, end_time, grace_minutes_arrival, overtime_eligible"),
  ]);

  const first = (punches ?? []).find((p: any) => p.punch_type === "in");
  const last = [...(punches ?? [])].reverse().find((p: any) => p.punch_type === "out");

  if (!first) {
    await supabase
      .from("attendance_records")
      .delete()
      .eq("employee_id", employeeId)
      .eq("work_date", day);
    return { attendanceRemoved: true };
  }

  const shift = schedule?.shift_id
    ? (shiftRows ?? []).find((s: any) => s.id === schedule.shift_id)
    : undefined;

  const checkInMin = timeOfDay(first.punch_time);
  const checkOutMin = last ? timeOfDay(last.punch_time) : null;
  let expectedMinutes = 8 * 60;
  let lateMinutes = 0;
  if (shift) {
    const shiftStart = toMinutes(shift.start_time);
    const shiftEnd = toMinutes(shift.end_time);
    expectedMinutes = (shiftEnd >= shiftStart ? shiftEnd : shiftEnd + 1440) - shiftStart;
    lateMinutes = Math.max(0, checkInMin - shiftStart - (shift.grace_minutes_arrival ?? 0));
  }
  let workedMinutes = 0;
  let overtimeMinutes = 0;
  if (checkOutMin !== null) {
    workedMinutes =
      checkOutMin >= checkInMin ? checkOutMin - checkInMin : checkOutMin + 1440 - checkInMin;
    if (!shift || shift.overtime_eligible !== false) {
      overtimeMinutes = Math.max(0, workedMinutes - expectedMinutes);
    }
  }

  const { error } = await supabase.from("attendance_records").upsert(
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
      is_manual: false,
      note: "احتُسب آليًا من البصمات المعتمدة",
    },
    { onConflict: "employee_id,work_date" },
  );
  if (error) throw new Error(`تعذر تحديث سجل الحضور: ${error.message}`);
  return { attendanceRemoved: false, workedMinutes, lateMinutes, overtimeMinutes };
}

/**
 * Settles an attendance period: approves all pending punches, converts them
 * into attendance records, recomputes payroll on actual worked days, and
 * locks the payroll run for the month.
 */
export const settleAttendancePeriodServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year: number; month: number }) => {
    if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
      throw new Error("سنة غير صالحة");
    }
    if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
      throw new Error("شهر غير صالح");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "payroll_officer",
      "attendance_officer",
    ]);

    const { year, month } = data;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const toDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data: run } = await supabase
      .from("payroll_runs")
      .select("id, status")
      .eq("period_year", year)
      .eq("period_month", month)
      .maybeSingle();
    if (run && run.status !== "draft") {
      throw new Error("مسيّر هذا الشهر مُقفل بالفعل");
    }

    // 1) auto-approve remaining pending punches for the period
    await supabase
      .from("punches")
      .update({ approval_status: "approved" })
      .eq("approval_status", "pending")
      .gte("punch_time", `${fromDate}T00:00:00Z`)
      .lte("punch_time", `${toDate}T23:59:59Z`);

    // 2) rebuild attendance from approved punches
    await processAttendanceServer({ data: { fromDate, toDate } });

    // 3) recompute payroll on actual worked days, then lock it
    const payroll = await computePayrollRun(supabase, { year, month });
    const { error: lockError } = await supabase
      .from("payroll_runs")
      .update({ status: "locked", locked_at: new Date().toISOString() })
      .eq("id", payroll.runId);
    if (lockError) throw new Error(`تعذر قفل المسيّر: ${lockError.message}`);

    return { ...payroll, period: { year, month }, locked: true };
  });
