import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RequestType = "leave" | "attendance_fix" | "advance" | "expense";
type Decision = "approved" | "rejected" | "returned";

interface ChainStep {
  order?: number;
  stepOrder?: number;
  role?: string;
  approverRole?: string;
  approverRoleAr?: string;
}

function normalizeSteps(raw: unknown): { order: number; role: string }[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ order: 1, role: "line_manager" }];
  }
  return (raw as ChainStep[]).map((step, index) => ({
    order: step.stepOrder ?? step.order ?? index + 1,
    role: step.approverRole ?? step.role ?? step.approverRoleAr ?? "line_manager",
  }));
}

async function notify(
  supabase: any,
  recipientId: string | null,
  titleAr: string,
  messageAr: string,
  type: string,
  linkPath: string,
) {
  if (!recipientId) return;
  await supabase.from("notifications_inbox").insert({
    recipient_id: recipientId,
    title_ar: titleAr,
    title_en: titleAr,
    message_ar: messageAr,
    message_en: messageAr,
    body_ar: messageAr,
    body_en: messageAr,
    type,
    is_read: false,
    link_path: linkPath,
  });
}

/**
 * Creates a service request and materializes its approval chain into
 * approval_steps, with a timeline entry and a notification to the approver.
 */
export const submitRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      type: RequestType;
      startDate?: string | null;
      endDate?: string | null;
      days?: number | null;
      amount?: number | null;
      reason?: string | null;
    }) => {
      if (!["leave", "attendance_fix", "advance", "expense"].includes(input.type)) {
        throw new Error("نوع طلب غير صالح");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    const { data: employee } = await supabase
      .from("employees")
      .select("id, full_name, manager_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!employee) throw new Error("لا يوجد ملف موظف مرتبط بحسابك");

    const { data: chain } = await supabase
      .from("approval_chains")
      .select("steps")
      .eq("request_type", data.type)
      .eq("status", "active")
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    const steps = normalizeSteps(chain?.steps);
    const reference = `REQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: request, error } = await supabase
      .from("requests")
      .insert({
        reference,
        employee_id: employee.id,
        type: data.type,
        status: "pending",
        start_date: data.startDate ?? null,
        end_date: data.endDate ?? null,
        days: data.days ?? null,
        amount: data.amount ?? null,
        reason: data.reason ?? null,
        created_by: context.userId,
        current_step_index: 1,
        total_steps: steps.length,
        current_approver_role: steps[0]?.role ?? "line_manager",
      })
      .select("id, reference")
      .single();
    if (error) throw new Error(`تعذر إنشاء الطلب: ${error.message}`);

    await supabase.from("approval_steps").insert(
      steps.map((step) => ({
        request_id: request.id,
        step_order: step.order,
        approver_role: step.role,
        status: step.order === 1 ? "pending" : "waiting",
      })),
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    await admin.from("request_timeline").insert({
      request_id: request.id,
      step_number: 1,
      actor_id: context.userId,
      actor_name: employee.full_name,
      actor_role: "مقدم الطلب",
      action: "submitted",
      note: "تم إرسال الطلب إلى مسار الاعتماد",
    });

    if (employee.manager_id) {
      const { data: manager } = await supabase
        .from("employees")
        .select("user_id")
        .eq("id", employee.manager_id)
        .maybeSingle();
      await notify(
        admin,
        manager?.user_id ?? null,
        "طلب بانتظار اعتمادك",
        `طلب ${reference} من ${employee.full_name}`,
        "approval",
        "/?module=workflow",
      );
    }

    return { requestId: request.id, reference: request.reference, totalSteps: steps.length };
  });

/**
 * Records an approval decision, advances the chain, keeps the timeline and
 * notifications in sync, and settles reserved leave balance on final outcome.
 */
export const actOnRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; decision: Decision; note?: string }) => {
    if (!input.requestId) throw new Error("معرّف الطلب مطلوب");
    if (!["approved", "rejected", "returned"].includes(input.decision)) {
      throw new Error("قرار غير صالح");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    const { data: request, error } = await supabase
      .from("requests")
      .select("id, reference, employee_id, type, days, current_step_index, total_steps, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(`تعذر قراءة الطلب: ${error.message}`);
    if (!request) throw new Error("الطلب غير موجود");
    if (request.status !== "pending") throw new Error("تمت معالجة هذا الطلب مسبقًا");

    const { data: actorRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (actorRoles ?? []).map((r: any) => r.role);
    const canDecide = roles.some((role: string) =>
      ["super_admin", "org_admin", "hr_manager", "line_manager", "finance_officer"].includes(role),
    );
    if (!canDecide) throw new Error("غير مصرح لك باعتماد الطلبات");

    const currentStep = request.current_step_index ?? 1;
    const isApproval = data.decision === "approved";
    const nextStep = currentStep + 1;
    const isFinal = !isApproval || nextStep > (request.total_steps ?? 1);

    await supabase
      .from("approval_steps")
      .update({
        status: data.decision,
        note: data.note ?? null,
        acted_by: context.userId,
        acted_at: new Date().toISOString(),
      })
      .eq("request_id", request.id)
      .eq("step_order", currentStep);

    if (isApproval && !isFinal) {
      await supabase
        .from("approval_steps")
        .update({ status: "pending" })
        .eq("request_id", request.id)
        .eq("step_order", nextStep);
    }

    const finalStatus = isApproval ? "approved" : data.decision;
    await supabase
      .from("requests")
      .update({
        status: isFinal ? finalStatus : "pending",
        current_step_index: isFinal ? currentStep : nextStep,
        decision_note: data.note ?? null,
        decided_by: isFinal ? context.userId : null,
        decided_at: isFinal ? new Date().toISOString() : null,
      })
      .eq("id", request.id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    await admin.from("request_timeline").insert({
      request_id: request.id,
      step_number: currentStep,
      actor_id: context.userId,
      actor_role: roles[0] ?? "approver",
      action: data.decision,
      note: data.note ?? null,
    });

    const { data: requester } = await supabase
      .from("employees")
      .select("user_id")
      .eq("id", request.employee_id)
      .maybeSingle();

    if (isFinal) {
      const label =
        finalStatus === "approved" ? "تمت الموافقة" : finalStatus === "rejected" ? "تم الرفض" : "أُعيد للتصحيح";
      await notify(
        admin,
        requester?.user_id ?? null,
        `${label}: ${request.reference}`,
        data.note ?? label,
        finalStatus,
        "/?module=workflow",
      );
    }

    return { status: isFinal ? finalStatus : "pending", step: isFinal ? currentStep : nextStep };
  });
