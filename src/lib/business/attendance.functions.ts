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
