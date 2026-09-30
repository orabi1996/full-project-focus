import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, round2 } from "./guards";

const FINANCE_ROLES = [
  "super_admin",
  "org_admin",
  "hr_manager",
  "payroll_officer",
  "finance_officer",
] as const;

/**
 * Server function to prepare a reimbursement batch atomically
 */
export const prepareReimbursementBatchServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    periodKey: string;
    claimIds: string[];
    paymentMethod?: "direct_bank_transfer" | "payroll" | "cash";
    bankAccountId?: string;
    notes?: string;
    idempotencyKey?: string;
  }) => {
    if (!input?.periodKey) throw new Error("فترة الصرف مطلوبة");
    if (!input?.claimIds?.length) throw new Error("اختر مطالبة واحدة على الأقل لإدراجها في الدفعة");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...FINANCE_ROLES]);

    const { data: result, error } = await supabase.rpc("prepare_reimbursement_batch_atomic", {
      p_period_key: data.periodKey,
      p_claim_ids: data.claimIds,
      p_payment_method: data.paymentMethod || "direct_bank_transfer",
      p_bank_account_id: data.bankAccountId || null,
      p_notes: data.notes || null,
      p_idempotency_key: data.idempotencyKey || null,
    });

    if (error) throw new Error(`فشل تجهيز دفعة الصرف: ${error.message}`);
    return result;
  });

/**
 * Server function to confirm reimbursement payment atomically
 */
export const confirmReimbursementPaymentServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { batchId: string; bankReference: string; notes?: string }) => {
    if (!input?.batchId) throw new Error("معرف دفعة الصرف مطلوب");
    if (!input?.bankReference) throw new Error("الرقم المرجعي البنكي مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "finance_officer",
    ]);

    const { data: result, error } = await supabase.rpc("confirm_reimbursement_payment_atomic", {
      p_batch_id: data.batchId,
      p_bank_reference: data.bankReference,
      p_notes: data.notes || null,
    });

    if (error) throw new Error(`فشل تأكيد سداد دفعة المصروفات: ${error.message}`);
    return result;
  });

/**
 * Server function to reverse a reimbursement batch atomically
 */
export const reverseReimbursementBatchServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { batchId: string; reason: string }) => {
    if (!input?.batchId) throw new Error("معرف دفعة الصرف مطلوب");
    if (!input?.reason) throw new Error("سبب إلغاء أو عكس الدفعة مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "finance_officer",
    ]);

    const { data: result, error } = await supabase.rpc("reverse_reimbursement_batch_atomic", {
      p_batch_id: data.batchId,
      p_reason: data.reason,
    });

    if (error) throw new Error(`فشل عكس دفعة المصروفات: ${error.message}`);
    return result;
  });

/**
 * Server function to transfer reimbursement to payroll atomically
 */
export const transferReimbursementToPayrollServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { batchId: string; payrollRunId: string }) => {
    if (!input?.batchId) throw new Error("معرف دفعة الصرف مطلوب");
    if (!input?.payrollRunId) throw new Error("معرف مسير الرواتب مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "payroll_officer",
      "finance_officer",
    ]);

    const { data: result, error } = await supabase.rpc("transfer_reimbursement_to_payroll_atomic", {
      p_batch_id: data.batchId,
      p_payroll_run_id: data.payrollRunId,
    });

    if (error) throw new Error(`فشل ترحيل التعويضات لمسير الرواتب: ${error.message}`);
    return result;
  });
