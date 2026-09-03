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
      .neq("approval_status", "rejected")
      .gte("punch_time", `${data.fromDate}T00:00:00Z`)
      .lte("punch_time", `${data.toDate}T23:59:59Z`)
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

  const { data: schedule } = await supabase
    .from("schedule_assignments")
    .select("shift_id, is_rest_day")
    .eq("employee_id", employeeId)
    .eq("work_date", day)
    .maybeSingle();
  let shift: any = null;
  if (schedule?.shift_id) {
    const { data } = await supabase
      .from("shifts")
      .select("start_time, end_time, grace_minutes_arrival, overtime_eligible")
      .eq("id", schedule.shift_id)
      .maybeSingle();
    shift = data;
  }

  const checkInMin = timeOfDay(firstIn.punch_time);
  const checkOutMin = lastOut ? timeOfDay(lastOut.punch_time) : null;
  let expectedMinutes = 8 * 60;
  let lateMinutes = 0;
  if (shift) {
    const start = toMinutes(shift.start_time);
    const end = toMinutes(shift.end_time);
    expectedMinutes = (end >= start ? end : end + 1440) - start;
    lateMinutes = Math.max(0, checkInMin - start - (shift.grace_minutes_arrival ?? 0));
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
      is_manual: false,
      note: "احتُسب آليًا من بصمات الجهاز",
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
