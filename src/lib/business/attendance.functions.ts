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
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = Math.round(normalized % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function localPunchParts(iso: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(iso))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return { date, minutes };
}

function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
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
    ]);

    const { data: companyId, error: companyIdError } = await supabase.rpc(
      "current_user_company_id",
    );
    if (companyIdError || !companyId) {
      throw new Error("لا توجد منشأة نشطة مرتبطة بالحساب الحالي");
    }

    const [{ data: company, error: companyError }, { data: policy, error: policyError }] =
      await Promise.all([
        supabase.from("companies").select("id, timezone").eq("id", companyId).single(),
        supabase
          .from("attendance_policies")
          .select(
            "require_published_schedule, missing_punch_behavior, early_departure_grace_minutes",
          )
          .eq("company_id", companyId)
          .maybeSingle(),
      ]);

    if (companyError) throw new Error(`تعذر قراءة إعدادات المنشأة: ${companyError.message}`);
    if (policyError) throw new Error(`تعذر قراءة سياسة الحضور: ${policyError.message}`);
    if (!policy) throw new Error("لم يتم إعداد سياسة الحضور للمنشأة");
    if (!company?.timezone) throw new Error("لم يتم إعداد المنطقة الزمنية للمنشأة");

    try {
      new Intl.DateTimeFormat("en", { timeZone: company.timezone }).format(new Date());
    } catch {
      throw new Error("المنطقة الزمنية للمنشأة غير صالحة");
    }

    const timezone = company.timezone as string;

    const { data: closedPeriods, error: closedError } = await supabase
      .from("attendance_periods")
      .select("period_year, period_month")
      .eq("company_id", companyId)
      .eq("status", "closed");
    if (closedError) throw new Error(`تعذر قراءة حالة فترات الحضور: ${closedError.message}`);

    const closedKeys = new Set(
      (closedPeriods ?? []).map(
        (period: any) =>
          `${period.period_year}-${String(period.period_month).padStart(2, "0")}`,
      ),
    );
    for (
      let cursor = data.fromDate;
      cursor <= data.toDate;
      cursor = addCalendarDays(cursor, 1)
    ) {
      if (closedKeys.has(cursor.slice(0, 7))) {
        throw new Error(`فترة الحضور ${cursor.slice(0, 7)} مغلقة ولا يمكن إعادة معالجتها`);
      }
    }

    let employeeQuery = supabase
      .from("employees")
      .select("id, company_id, status")
      .eq("company_id", companyId)
      .neq("status", "terminated");
    if (data.employeeId) employeeQuery = employeeQuery.eq("id", data.employeeId);

    const { data: employees, error: employeeError } = await employeeQuery;
    if (employeeError) throw new Error(`تعذر قراءة الموظفين: ${employeeError.message}`);

    const employeeIds = (employees ?? []).map((employee: any) => employee.id);
    if (!employeeIds.length) return { processed: 0, skipped: 0 };

    const widenedFrom = addCalendarDays(data.fromDate, -1);
    const widenedToExclusive = addCalendarDays(data.toDate, 2);

    const [
      punchRes,
      scheduleRes,
      shiftRes,
      leaveRes,
      holidayRes,
    ] = await Promise.all([
      supabase
        .from("punches")
        .select(
          "employee_id, punch_time, punch_type, source, geofence_valid, approval_status",
        )
        .eq("company_id", companyId)
        .eq("approval_status", "approved")
        .in("employee_id", employeeIds)
        .gte("punch_time", `${widenedFrom}T00:00:00Z`)
        .lt("punch_time", `${widenedToExclusive}T00:00:00Z`)
        .order("punch_time"),
      supabase
        .from("schedule_assignments")
        .select("employee_id, shift_id, work_date, is_rest_day, status")
        .in("employee_id", employeeIds)
        .gte("work_date", data.fromDate)
        .lte("work_date", data.toDate)
        .eq("status", "published"),
      supabase
        .from("shifts")
        .select(
          "id, start_time, end_time, grace_minutes_arrival, grace_minutes_departure, overtime_eligible",
        ),
      supabase
        .from("requests")
        .select("employee_id, start_date, end_date")
        .eq("company_id", companyId)
        .eq("type", "leave")
        .eq("status", "approved")
        .in("employee_id", employeeIds)
        .lte("start_date", data.toDate)
        .gte("end_date", data.fromDate),
      supabase
        .from("company_holidays")
        .select("start_date, end_date")
        .eq("company_id", companyId)
        .lte("start_date", data.toDate)
        .gte("end_date", data.fromDate),
    ]);

    if (punchRes.error) throw new Error(`تعذر قراءة البصمات: ${punchRes.error.message}`);
    if (scheduleRes.error) throw new Error(`تعذر قراءة جداول الدوام: ${scheduleRes.error.message}`);
    if (shiftRes.error) throw new Error(`تعذر قراءة الورديات: ${shiftRes.error.message}`);
    if (leaveRes.error) throw new Error(`تعذر قراءة الإجازات المعتمدة: ${leaveRes.error.message}`);
    if (holidayRes.error) throw new Error(`تعذر قراءة العطلات: ${holidayRes.error.message}`);

    const shifts = new Map<string, any>((shiftRes.data ?? []).map((shift: any) => [shift.id, shift]));
    const schedules = new Map<string, any>(
      (scheduleRes.data ?? []).map((schedule: any) => [
        `${schedule.employee_id}|${schedule.work_date}`,
        schedule,
      ]),
    );

    const punchesByEmployee = new Map<string, any[]>();
    for (const punch of punchRes.data ?? []) {
      const local = localPunchParts(punch.punch_time, timezone);
      const enriched = { ...punch, localDate: local.date, localMinutes: local.minutes };
      const list = punchesByEmployee.get(punch.employee_id) ?? [];
      list.push(enriched);
      punchesByEmployee.set(punch.employee_id, list);
    }

    if (policy.require_published_schedule) {
      const unscheduled = (punchRes.data ?? []).filter((punch: any) => {
        const local = localPunchParts(punch.punch_time, timezone);
        if (local.date < data.fromDate || local.date > addCalendarDays(data.toDate, 1)) return false;
        const directKey = `${punch.employee_id}|${local.date}`;
        if (schedules.has(directKey)) return false;
        const previousDate = addCalendarDays(local.date, -1);
        const previousSchedule = schedules.get(`${punch.employee_id}|${previousDate}`);
        if (!previousSchedule?.shift_id) return true;
        const previousShift = shifts.get(previousSchedule.shift_id);
        if (!previousShift) return true;
        const previousStart = toMinutes(previousShift.start_time);
        const previousEnd = toMinutes(previousShift.end_time);
        const overnight = previousEnd <= previousStart;
        return !(overnight && local.minutes < previousStart);
      });

      if (unscheduled.length) {
        throw new Error(
          `تعذر معالجة الحضور: توجد ${unscheduled.length} بصمة معتمدة بدون جدول دوام منشور.`,
        );
      }
    }

    const isHoliday = (date: string) =>
      (holidayRes.data ?? []).some(
        (holiday: any) => holiday.start_date <= date && holiday.end_date >= date,
      );
    const isOnLeave = (employeeId: string, date: string) =>
      (leaveRes.data ?? []).some(
        (leave: any) =>
          leave.employee_id === employeeId &&
          leave.start_date <= date &&
          leave.end_date >= date,
      );

    const rows: Record<string, unknown>[] = [];
    const scheduleEntries = [...schedules.entries()];

    if (!policy.require_published_schedule) {
      for (const employeeId of employeeIds) {
        for (const punch of punchesByEmployee.get(employeeId) ?? []) {
          if (punch.localDate < data.fromDate || punch.localDate > data.toDate) continue;
          const key = `${employeeId}|${punch.localDate}`;
          if (!schedules.has(key)) {
            schedules.set(key, {
              employee_id: employeeId,
              shift_id: null,
              work_date: punch.localDate,
              is_rest_day: false,
              status: "published",
            });
            scheduleEntries.push([key, schedules.get(key)]);
          }
        }
      }
    }

    for (const [key, schedule] of scheduleEntries) {
      const [employeeId, workDate] = key.split("|");
      if (!employeeId || !workDate || workDate < data.fromDate || workDate > data.toDate) continue;

      const shift = schedule.shift_id ? shifts.get(schedule.shift_id) : null;
      if (!schedule.is_rest_day && schedule.shift_id && !shift) {
        throw new Error(`الوردية المرتبطة بجدول ${workDate} غير موجودة أو غير متاحة`);
      }
      if (!schedule.is_rest_day && policy.require_published_schedule && !shift) {
        throw new Error(`جدول ${workDate} لا يحتوي وردية صالحة`);
      }

      const baseRow: Record<string, unknown> = {
        employee_id: employeeId,
        company_id: companyId,
        work_date: workDate,
        shift_id: schedule.shift_id ?? null,
        scheduled_in: shift?.start_time ?? null,
        scheduled_out: shift?.end_time ?? null,
        worked_hours: 0,
        worked_minutes: 0,
        late_minutes: 0,
        early_departure_minutes: 0,
        overtime_minutes: 0,
        overtime_hours: 0,
        is_manual: false,
        geofence_valid: null,
        violations_count: 0,
        reviewed_by_payroll: false,
        processed_at: new Date().toISOString(),
      };

      if (schedule.is_rest_day) {
        rows.push({
          ...baseRow,
          status: "rest_day",
          check_in: null,
          check_out: null,
          punch_source: null,
          note: "يوم راحة حسب جدول الدوام المنشور",
        });
        continue;
      }

      if (isHoliday(workDate)) {
        rows.push({
          ...baseRow,
          status: "holiday",
          check_in: null,
          check_out: null,
          punch_source: null,
          note: "عطلة مسجلة للمنشأة",
        });
        continue;
      }

      if (isOnLeave(employeeId, workDate)) {
        rows.push({
          ...baseRow,
          status: "leave",
          check_in: null,
          check_out: null,
          punch_source: null,
          note: "إجازة معتمدة",
        });
        continue;
      }

      const employeePunches = punchesByEmployee.get(employeeId) ?? [];
      const shiftStart = shift ? toMinutes(shift.start_time) : 0;
      const shiftEnd = shift ? toMinutes(shift.end_time) : 0;
      const overnight = Boolean(shift && shiftEnd <= shiftStart);
      const nextDate = addCalendarDays(workDate, 1);

      const relevantPunches = employeePunches
        .filter((punch) => {
          if (!shift) return punch.localDate === workDate;
          if (!overnight) return punch.localDate === workDate;
          return (
            (punch.localDate === workDate && punch.localMinutes >= shiftStart) ||
            (punch.localDate === nextDate && punch.localMinutes < shiftStart)
          );
        })
        .sort(
          (a, b) =>
            new Date(a.punch_time).getTime() - new Date(b.punch_time).getTime(),
        );

      const firstIn = relevantPunches.find((punch) => punch.punch_type === "in");
      const lastOut = [...relevantPunches].reverse().find((punch) => punch.punch_type === "out");

      if (!firstIn) {
        if (policy.missing_punch_behavior === "ignore") continue;
        rows.push({
          ...baseRow,
          status: policy.missing_punch_behavior === "absent" ? "absent" : "missing_punch",
          check_in: null,
          check_out: lastOut ? formatTime(lastOut.localMinutes) : null,
          punch_source: lastOut?.source ?? null,
          geofence_valid: lastOut?.geofence_valid ?? null,
          violations_count: 1,
          note:
            policy.missing_punch_behavior === "absent"
              ? "غياب وفق سياسة البصمة الناقصة"
              : "بصمة دخول مفقودة وتحتاج للمراجعة",
        });
        continue;
      }

      const checkInRelative = firstIn.localMinutes;
      let checkOutRelative: number | null = null;
      if (lastOut) {
        checkOutRelative =
          overnight && lastOut.localDate === nextDate
            ? 1440 + lastOut.localMinutes
            : lastOut.localMinutes;
      }

      const shiftEndRelative = shift
        ? overnight
          ? 1440 + shiftEnd
          : shiftEnd
        : null;
      const arrivalGrace = Number(shift?.grace_minutes_arrival ?? 0);
      const departureGrace = Number(
        shift?.grace_minutes_departure ?? policy.early_departure_grace_minutes ?? 0,
      );

      const lateMinutes = shift
        ? Math.max(0, checkInRelative - shiftStart - arrivalGrace)
        : 0;
      const earlyDepartureMinutes =
        shift && checkOutRelative !== null && shiftEndRelative !== null
          ? Math.max(0, shiftEndRelative - checkOutRelative - departureGrace)
          : 0;
      const overtimeMinutes =
        shift &&
        checkOutRelative !== null &&
        shiftEndRelative !== null &&
        shift.overtime_eligible !== false
          ? Math.max(0, checkOutRelative - shiftEndRelative)
          : 0;

      const workedMinutes = lastOut
        ? Math.max(
            0,
            Math.round(
              (new Date(lastOut.punch_time).getTime() -
                new Date(firstIn.punch_time).getTime()) /
                60000,
            ),
          )
        : 0;

      const geofenceValues = relevantPunches
        .map((punch) => punch.geofence_valid)
        .filter((value) => value !== null && value !== undefined);
      const geofenceValid =
        geofenceValues.length === 0
          ? null
          : geofenceValues.every((value) => value === true);

      const sourceSet = new Set(relevantPunches.map((punch) => punch.source).filter(Boolean));
      const punchSource =
        sourceSet.size === 0 ? null : sourceSet.size === 1 ? [...sourceSet][0] : "mixed";

      const missingOut = !lastOut;
      const violationsCount =
        (lateMinutes > 0 ? 1 : 0) +
        (earlyDepartureMinutes > 0 ? 1 : 0) +
        (missingOut ? 1 : 0);

      const status = missingOut
        ? "missing_punch"
        : lateMinutes > 0
          ? "late"
          : earlyDepartureMinutes > 0
            ? "early_departure"
            : "present";

      rows.push({
        ...baseRow,
        check_in: formatTime(firstIn.localMinutes),
        check_out: lastOut ? formatTime(lastOut.localMinutes) : null,
        status,
        worked_hours: round2(workedMinutes / 60),
        worked_minutes: workedMinutes,
        late_minutes: lateMinutes,
        early_departure_minutes: earlyDepartureMinutes,
        overtime_minutes: overtimeMinutes,
        overtime_hours: round2(overtimeMinutes / 60),
        punch_source: punchSource,
        geofence_valid: geofenceValid,
        violations_count: violationsCount,
        note: missingOut ? "بصمة خروج مفقودة وتحتاج للمراجعة" : "احتُسب آليًا من البصمات المعتمدة",
      });
    }

    if (!rows.length) return { processed: 0, skipped: 0 };

    const { error: saveError } = await supabase
      .from("attendance_records")
      .upsert(rows, { onConflict: "employee_id,work_date" });
    if (saveError) throw new Error(`تعذر حفظ سجلات الحضور: ${saveError.message}`);

    return {
      processed: rows.length,
      period: { from: data.fromDate, to: data.toDate },
      companyId,
      timezone,
    };
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
  .inputValidator(
    (input: {
      deviceId: string;
      nameAr: string;
      autoApprove?: boolean;
      vendor?: string | null;
      workLocationId?: string | null;
    }) => {
      if (!input.deviceId?.trim()) throw new Error("معرّف الجهاز مطلوب");
      if (!input.nameAr?.trim()) throw new Error("اسم الجهاز مطلوب");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "attendance_officer",
    ]);
    const { data: result, error } = await supabase.rpc("register_biometric_device", {
      p_device_id: data.deviceId.trim(),
      p_name_ar: data.nameAr.trim(),
      p_vendor: data.vendor?.trim() || null,
      p_work_location_id: data.workLocationId || null,
      p_auto_approve: data.autoApprove ?? false,
    });
    if (error) throw new Error(`تعذر تسجيل الجهاز: ${error.message}`);
    return {
      deviceId: result?.device_id ?? data.deviceId.trim(),
      token: result?.token ?? "",
      tokenLast4: result?.token_last4 ?? "",
    };
  });

/** Records an authorized supervisor/manual punch with server-resolved tenant scope. */
export const recordPunchServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      employeeRef: string;
      punchType: "in" | "out";
      deviceId?: string;
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

    const { data: result, error } = await supabase.rpc("record_staff_attendance_punch", {
      p_employee_ref: data.employeeRef.trim(),
      p_punch_type: data.punchType,
      p_device_id: data.deviceId?.trim() || null,
    });
    if (error) throw new Error(`تعذر تسجيل البصمة: ${error.message}`);

    return {
      employeeName: result?.employee_name ?? "",
      employeeNo: result?.employee_no ?? "",
      punchId: result?.punch_id ?? "",
    };
  });

/** Lists tenant-scoped punches for one company-local calendar day. */
export const listPunchesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("تاريخ غير صالح");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...HR_ATTENDANCE_ROLES, "line_manager"]);

    const { data: companyId, error: companyIdError } = await supabase.rpc(
      "current_user_company_id",
    );
    if (companyIdError || !companyId) {
      throw new Error("لا توجد منشأة نشطة مرتبطة بالحساب الحالي");
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("timezone")
      .eq("id", companyId)
      .single();
    if (companyError) throw new Error(`تعذر قراءة إعدادات المنشأة: ${companyError.message}`);
    if (!company?.timezone) throw new Error("لم يتم إعداد المنطقة الزمنية للمنشأة");

    try {
      new Intl.DateTimeFormat("en", { timeZone: company.timezone }).format(new Date());
    } catch {
      throw new Error("المنطقة الزمنية للمنشأة غير صالحة");
    }

    const fromUtc = `${addCalendarDays(data.date, -1)}T00:00:00Z`;
    const toUtc = `${addCalendarDays(data.date, 2)}T00:00:00Z`;

    const { data: rows, error } = await supabase
      .from("punches")
      .select(
        "id, employee_id, punch_time, punch_type, source, device_id, approval_status, geofence_valid, employees(full_name, employee_no)",
      )
      .eq("company_id", companyId)
      .gte("punch_time", fromUtc)
      .lt("punch_time", toUtc)
      .order("punch_time", { ascending: false });
    if (error) throw new Error(`تعذر قراءة البصمات: ${error.message}`);

    return (rows ?? [])
      .filter((row: any) => localPunchParts(row.punch_time, company.timezone).date === data.date)
      .map((row: any) => ({
        id: row.id,
        employeeId: row.employee_id,
        employeeName: row.employees?.full_name ?? "—",
        employeeNo: row.employees?.employee_no ?? "—",
        punchTime: row.punch_time,
        punchType: row.punch_type,
        source: row.source,
        deviceId: row.device_id,
        approvalStatus: row.approval_status,
        geofenceValid: row.geofence_valid,
      }));
  });

/**
 * Approves or rejects a raw punch.
 *
 * The decision intentionally does not run the legacy single-day UTC/8-hour calculator.
 * The authoritative company-timezone/schedule engine is run explicitly through
 * processAttendanceServer after exception review.
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
    await assertRole(supabase, context.userId, [...HR_ATTENDANCE_ROLES, "line_manager"]);

    const { data: companyId, error: companyIdError } = await supabase.rpc(
      "current_user_company_id",
    );
    if (companyIdError || !companyId) {
      throw new Error("لا توجد منشأة نشطة مرتبطة بالحساب الحالي");
    }

    const { data: punch, error } = await supabase
      .from("punches")
      .update({ approval_status: data.decision })
      .eq("company_id", companyId)
      .eq("id", data.punchId)
      .select("employee_id, punch_time")
      .maybeSingle();
    if (error) throw new Error(`تعذر تحديث البصمة: ${error.message}`);
    if (!punch) throw new Error("البصمة غير موجودة أو خارج نطاق المنشأة الحالية");

    const { data: company } = await supabase
      .from("companies")
      .select("timezone")
      .eq("id", companyId)
      .maybeSingle();
    const workDate =
      company?.timezone
        ? localPunchParts(punch.punch_time, company.timezone).date
        : null;

    return {
      ok: true,
      requiresReprocess: true,
      employeeId: punch.employee_id,
      workDate,
    };
  });

/**
 * Closes one attendance month after all attendance exceptions are resolved.
 * This operation deliberately DOES NOT calculate, approve, lock, or pay payroll.
 */
export const closeAttendancePeriodServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year: number; month: number; note?: string | null }) => {
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
      "attendance_officer",
    ]);

    const { data: result, error } = await supabase.rpc("close_attendance_period", {
      p_year: data.year,
      p_month: data.month,
      p_note: data.note ?? null,
    });
    if (error) throw new Error(`تعذر إغلاق فترة الحضور: ${error.message}`);

    return result;
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
    await assertRole(supabase, context.userId, ["super_admin", "org_admin", "hr_manager", "attendance_officer"]);

    const payload: Record<string, unknown> = {};
    if (data.nameAr?.trim()) payload["name_ar"] = data.nameAr.trim();
    if (data.status) payload["status"] = data.status;
    if (typeof data.autoApprove === "boolean") payload["auto_approve"] = data.autoApprove;
    let token: string | null = null;

    if (Object.keys(payload).length) {
      const { error } = await supabase.from("biometric_devices").update(payload).eq("id", data.id);
      if (error) throw new Error(`تعذر تحديث الجهاز: ${error.message}`);
    }

    if (data.rotateToken) {
      const { data: rotated, error: rotateError } = await supabase.rpc(
        "rotate_biometric_device_token",
        { p_device_id: data.id },
      );
      if (rotateError) throw new Error(`تعذر تدوير رمز الجهاز: ${rotateError.message}`);
      token = rotated?.token ?? null;
    }

    if (!Object.keys(payload).length && !data.rotateToken) throw new Error("لا يوجد تغيير للحفظ");
    return { id: data.id, token };
  });

/** Removes a device registration while preserving historical punch records. */
export const deleteBiometricDeviceServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("معرّف الجهاز مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, ["super_admin", "org_admin", "hr_manager", "attendance_officer"]);
    const { error } = await supabase.from("biometric_devices").delete().eq("id", data.id);
    if (error) throw new Error(`تعذر حذف الجهاز: ${error.message}`);
    return { ok: true };
  });
