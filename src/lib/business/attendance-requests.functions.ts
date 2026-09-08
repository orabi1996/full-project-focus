import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, round2 } from "./guards";

const REVIEW_ROLES = ["super_admin", "org_admin", "hr_manager", "attendance_officer", "line_manager"] as const;

export const getAttendancePolicyServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const { data, error } = await supabase.from("attendance_policies").select("late_grace_minutes, early_departure_grace_minutes, rounding_minutes, rounding_mode, deduction_cap_percent").eq("scope_key", "global").maybeSingle();
    if (error) throw new Error(`تعذر قراءة سياسة الخصم: ${error.message}`);
    return data ?? { late_grace_minutes: 15, early_departure_grace_minutes: 15, rounding_minutes: 1, rounding_mode: "exact", deduction_cap_percent: 100 };
  });

export const updateAttendancePolicyServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lateGraceMinutes: number; earlyDepartureGraceMinutes: number; roundingMinutes: number; roundingMode: "exact" | "up" | "nearest"; deductionCapPercent: number }) => {
    if (input.lateGraceMinutes < 0 || input.earlyDepartureGraceMinutes < 0) throw new Error("فترة السماح لا يمكن أن تكون سالبة");
    if (![1, 5, 10, 15, 30, 60].includes(input.roundingMinutes)) throw new Error("قيمة التقريب غير صالحة");
    if (input.deductionCapPercent < 0 || input.deductionCapPercent > 100) throw new Error("سقف الخصم يجب أن يكون بين 0 و100%");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, ["super_admin", "org_admin", "hr_manager"]);
    const { error } = await supabase.from("attendance_policies").upsert({
      scope_key: "global", late_grace_minutes: data.lateGraceMinutes,
      early_departure_grace_minutes: data.earlyDepartureGraceMinutes,
      rounding_minutes: data.roundingMinutes, rounding_mode: data.roundingMode,
      deduction_cap_percent: data.deductionCapPercent, updated_by: context.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "scope_key" });
    if (error) throw new Error(`تعذر حفظ سياسة الخصم: ${error.message}`);
    return { ok: true };
  });

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const submitAttendanceCorrectionServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { employeeId: string; workDate: string; correctIn?: string; correctOut?: string; reason: string }) => {
    if (!input.employeeId || !validDate(input.workDate) || !input.reason?.trim()) throw new Error("بيانات تصحيح البصمة غير مكتملة");
    if (!input.correctIn && !input.correctOut) throw new Error("أدخل وقت حضور أو انصراف مصححًا");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: row, error } = await supabase.from("attendance_corrections").insert({
      employee_id: data.employeeId,
      work_date: data.workDate,
      correct_in: data.correctIn ?? null,
      correct_out: data.correctOut ?? null,
      reason: data.reason.trim(),
      requested_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(`تعذر حفظ تصحيح البصمة: ${error.message}`);
    return { id: row.id };
  });

export const decideAttendanceCorrectionServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: "approved" | "rejected" | "returned"; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...REVIEW_ROLES]);
    const { data: correction, error: readError } = await supabase.from("attendance_corrections")
      .select("id, employee_id, work_date, correct_in, correct_out, status")
      .eq("id", data.id).maybeSingle();
    if (readError || !correction) throw new Error("تصحيح البصمة غير موجود");
    if (correction.status !== "pending") throw new Error("تمت معالجة التصحيح مسبقًا");
    const { error } = await supabase.from("attendance_corrections").update({
      status: data.decision, reviewed_by: context.userId, reviewed_at: new Date().toISOString(), review_note: data.note ?? null,
    }).eq("id", data.id).eq("status", "pending");
    if (error) throw new Error(`تعذر تحديث قرار التصحيح: ${error.message}`);
    if (data.decision === "approved") {
      const { error: attendanceError } = await supabase.from("attendance_records").upsert({
        employee_id: correction.employee_id, work_date: correction.work_date,
        check_in: correction.correct_in, check_out: correction.correct_out,
        status: "present", is_manual: true, note: correction.reason ?? "تصحيح معتمد",
      }, { onConflict: "employee_id,work_date" });
      if (attendanceError) throw new Error(`تعذر تحديث سجل الحضور: ${attendanceError.message}`);
    }
    return { ok: true };
  });

export const submitOvertimeRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { employeeId: string; workDate: string; hours: number; hourlyRate: number; rateMultiplier?: number; reason: string }) => {
    if (!input.employeeId || !validDate(input.workDate) || !(input.hours > 0) || !input.reason?.trim()) throw new Error("بيانات العمل الإضافي غير مكتملة");
    const multiplier = input.rateMultiplier ?? 1.5;
    return { ...input, rateMultiplier: multiplier, totalAmount: round2(input.hours * input.hourlyRate * multiplier) };
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: row, error } = await supabase.from("overtime_requests").insert({
      employee_id: data.employeeId, work_date: data.workDate, hours: data.hours,
      hourly_rate: data.hourlyRate, rate_multiplier: data.rateMultiplier, total_amount: data.totalAmount,
      reason: data.reason.trim(), requested_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(`تعذر حفظ طلب العمل الإضافي: ${error.message}`);
    return { id: row.id, totalAmount: data.totalAmount };
  });

export const decideOvertimeRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: "approved" | "rejected" | "returned"; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...REVIEW_ROLES]);
    const { data: request, error: readError } = await supabase.from("overtime_requests")
      .select("id, employee_id, work_date, hours, status")
      .eq("id", data.id).maybeSingle();
    if (readError || !request) throw new Error("طلب العمل الإضافي غير موجود");
    if (request.status !== "pending") throw new Error("تمت معالجة طلب العمل الإضافي مسبقًا");

    const { error } = await supabase.from("overtime_requests").update({
      status: data.decision, reviewed_by: context.userId, reviewed_at: new Date().toISOString(), review_note: data.note ?? null,
    }).eq("id", data.id).eq("status", "pending");
    if (error) throw new Error(`تعذر تحديث قرار العمل الإضافي: ${error.message}`);

    if (data.decision === "approved") {
      const { data: attendance } = await supabase.from("attendance_records")
        .select("overtime_minutes").eq("employee_id", request.employee_id).eq("work_date", request.work_date).maybeSingle();
      const overtimeMinutes = Number(attendance?.overtime_minutes ?? 0) + Math.round(Number(request.hours) * 60);
      const { error: attendanceError } = await supabase.from("attendance_records").upsert({
        employee_id: request.employee_id, work_date: request.work_date, overtime_minutes: overtimeMinutes,
        note: "إضافي معتمد",
      }, { onConflict: "employee_id,work_date" });
      if (attendanceError) throw new Error(`تعذر إدخال الإضافي في الحضور: ${attendanceError.message}`);
    }
    return { ok: true };
  });
