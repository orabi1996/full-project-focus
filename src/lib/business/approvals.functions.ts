import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RequestType =
  | "leave"
  | "attendance_correction"
  | "attendance_fix"
  | "overtime"
  | "advance"
  | "loan_advance"
  | "expense"
  | "expense_claim"
  | "salary_certificate"
  | "resignation"
  | "asset_request"
  | "shift_swap"
  | "general";

type Decision = "approved" | "rejected" | "returned";

/**
 * Creates a service request using the authoritative database RPC:
 * - Scoped chain resolution (fails truthfully if no valid chain exists)
 * - Atomic reference generation (REQ-YYYY-XXXXXX)
 * - Materialization of actual approvers at submission
 * - No silent fallbacks to line_manager
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
      payload?: Record<string, unknown>;
      onBehalfOfEmployeeId?: string | null;
      idempotencyKey?: string | null;
    }) => {
      if (!input.type) {
        throw new Error("نوع الطلب مطلوب");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    // Normalize type string
    const normalizedType =
      data.type === "attendance_fix"
        ? "attendance_correction"
        : data.type === "advance"
          ? "loan_advance"
          : data.type === "expense"
            ? "expense_claim"
            : data.type;

    const payload = {
      ...(data.payload || {}),
      startDate: data.startDate ?? (data.payload?.startDate as string) ?? null,
      endDate: data.endDate ?? (data.payload?.endDate as string) ?? null,
      days: data.days ?? (data.payload?.days as number) ?? null,
      amount: data.amount ?? (data.payload?.amount as number) ?? null,
      reason: data.reason ?? (data.payload?.reason as string) ?? null,
    };

    const { data: result, error } = await supabase.rpc("submit_workflow_request", {
      p_request_type: normalizedType,
      p_payload: payload,
      p_on_behalf_of_employee_id: data.onBehalfOfEmployeeId ?? null,
      p_idempotency_key: data.idempotencyKey ?? null,
    });

    if (error) {
      throw new Error(`تعذر إنشاء الطلب: ${error.message}`);
    }

    return {
      requestId: result.request_id,
      reference: result.reference,
      totalSteps: result.total_steps,
    };
  });

/**
 * Records an approval decision using authoritative atomic RPC:
 * - Locks request row
 * - Strict approver authorization (materialized approver OR valid active delegate)
 * - Self-approval prevention
 * - Fail-closed domain finalization (Leave, Attendance, Swaps)
 * - Timeline and notifications in single transaction
 */
export const actOnRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      requestId: string;
      decision: Decision;
      note?: string;
      internalNote?: string;
      idempotencyKey?: string;
    }) => {
      if (!input.requestId) throw new Error("معرّف الطلب مطلوب");
      if (!["approved", "rejected", "returned"].includes(input.decision)) {
        throw new Error("قرار غير صالح");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    const { data: result, error } = await supabase.rpc("decide_workflow_request", {
      p_request_id: data.requestId,
      p_decision: data.decision,
      p_note: data.note || "تم اتخاذ القرار",
      p_internal_note: data.internalNote || null,
      p_idempotency_key: data.idempotencyKey || null,
    });

    if (error) {
      throw new Error(`تعذر معالجة الطلب: ${error.message}`);
    }

    return {
      status: result.status,
      step: result.step,
      isFinal: result.is_final,
    };
  });

/**
 * Resubmits a returned request:
 * - Retains original request ID and reference
 * - Increments revision number
 * - Restarts approval path
 */
export const resubmitRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      requestId: string;
      payload: Record<string, unknown>;
      note?: string;
    }) => {
      if (!input.requestId) throw new Error("معرّف الطلب مطلوب");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    const { data: result, error } = await supabase.rpc("resubmit_workflow_request", {
      p_request_id: data.requestId,
      p_payload: data.payload,
      p_note: data.note || null,
    });

    if (error) {
      throw new Error(`تعذر إعادة تقديم الطلب: ${error.message}`);
    }

    return result;
  });

/**
 * Withdraws a pending request by the requester:
 */
export const withdrawRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; reason: string }) => {
    if (!input.requestId) throw new Error("معرّف الطلب مطلوب");
    if (!input.reason?.trim()) throw new Error("سبب سحب الطلب مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    const { data: result, error } = await supabase.rpc("withdraw_workflow_request", {
      p_request_id: data.requestId,
      p_reason: data.reason,
    });

    if (error) {
      throw new Error(`تعذر سحب الطلب: ${error.message}`);
    }

    return result;
  });
