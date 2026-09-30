import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole } from "./guards";

const HR_ROLES = ["super_admin", "org_admin", "hr_manager"] as const;

export const submitResignationServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lastWorkingDay: string; reason: string; noticeServed?: boolean }) => {
    if (!input?.lastWorkingDay) throw new Error("تاريخ آخر يوم عمل مطلوب");
    if (!input?.reason) throw new Error("سبب الاستقالة مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: res, error } = await supabase.rpc("submit_resignation_atomic", {
      p_last_working_day: data.lastWorkingDay,
      p_reason: data.reason,
      p_notice_served: data.noticeServed ?? true,
    });
    if (error) throw new Error(`تعذر تقديم الاستقالة: ${error.message}`);
    return res;
  });

export const initiateSeparationServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    employeeId: string;
    separationType: string;
    lastWorkingDay: string;
    reason: string;
    noticeServed?: boolean;
  }) => {
    if (!input?.employeeId) throw new Error("معرف الموظف مطلوب");
    if (!input?.lastWorkingDay) throw new Error("تاريخ انتهاء الخدمة مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...HR_ROLES]);

    const { data: res, error } = await supabase.rpc("initiate_separation_hr_atomic", {
      p_employee_id: data.employeeId,
      p_separation_type: data.separationType,
      p_last_working_day: data.lastWorkingDay,
      p_reason: data.reason,
      p_notice_served: data.noticeServed ?? true,
    });
    if (error) throw new Error(`تعذر بدء إنهاء الخدمة: ${error.message}`);
    return res;
  });

export const updateClearanceItemServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    itemId: string;
    status: "pending" | "cleared" | "waived" | "blocked";
    notes?: string;
    evidenceUrl?: string;
  }) => {
    if (!input?.itemId) throw new Error("معرف البند مطلوب");
    if (!input?.status) throw new Error("حالة البند مطلوبة");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: res, error } = await supabase.rpc("update_clearance_item_atomic", {
      p_item_id: data.itemId,
      p_status: data.status,
      p_notes: data.notes || null,
      p_evidence_url: data.evidenceUrl || null,
    });
    if (error) throw new Error(`تعذر تحديث بند إخلاء الطرف: ${error.message}`);
    return res;
  });

export const finalizeOffboardingServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { separationId: string }) => {
    if (!input?.separationId) throw new Error("معرف إجراء إنهاء الخدمة مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...HR_ROLES]);

    const { data: res, error } = await supabase.rpc("finalize_employee_offboarding_atomic", {
      p_separation_id: data.separationId,
    });
    if (error) throw new Error(`تعذر إنهاء الخدمة: ${error.message}`);
    return res;
  });
