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

/** Payment sheet for a payroll run + the company accounts money is sent from. */
export const listRunPaymentsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => {
    if (!input?.runId) throw new Error("معرّف المسيّر مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...FINANCE_ROLES]);

    const [paymentsRes, accountsRes, runRes] = await Promise.all([
      supabase
        .from("payroll_payments")
        .select(
          "id, employee_id, net_amount, iban, bank_name, status, batch_no, reference, sent_at, paid_at, failure_reason, employees(full_name, employee_no)",
        )
        .eq("payroll_run_id", data.runId)
        .order("created_at"),
      supabase
        .from("company_bank_accounts")
        .select("id, bank_name, account_name, iban, currency, current_balance, is_primary")
        .order("is_primary", { ascending: false }),
      supabase
        .from("payroll_runs")
        .select("id, status, period_year, period_month, total_net_salary")
        .eq("id", data.runId)
        .maybeSingle(),
    ]);

    if (paymentsRes.error) throw new Error(`تعذر قراءة الدفعات: ${paymentsRes.error.message}`);

    return {
      run: runRes.data ?? null,
      accounts: (accountsRes.data ?? []).map((a: any) => ({
        id: a.id,
        bankName: a.bank_name,
        accountName: a.account_name,
        iban: a.iban,
        currency: a.currency,
        balance: Number(a.current_balance ?? 0),
        isPrimary: a.is_primary,
      })),
      payments: (paymentsRes.data ?? []).map((p: any) => ({
        id: p.id,
        employeeId: p.employee_id,
        employeeName: p.employees?.full_name ?? "—",
        employeeNo: p.employees?.employee_no ?? "—",
        netAmount: Number(p.net_amount ?? 0),
        iban: p.iban,
        bankName: p.bank_name,
        status: p.status,
        batchNo: p.batch_no,
        reference: p.reference,
        sentAt: p.sent_at,
        paidAt: p.paid_at,
        failureReason: p.failure_reason,
      })),
    };
  });

/** Builds (or refreshes) the pending payment sheet from the run's net salaries. */
export const prepareRunPaymentsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => {
    if (!input?.runId) throw new Error("معرّف المسيّر مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...FINANCE_ROLES]);

    const { data: result, error } = await supabase.rpc("prepare_payroll_payments_atomic", {
      p_run_id: data.runId,
    });
    if (error) throw new Error(`تعذر تجهيز الدفعات: ${error.message}`);
    return result;
  });

/** Records a transfer completed outside this application; it does not contact a bank. */
export const disburseRunPaymentsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      runId: string;
      bankAccountId: string;
      bankReference: string;
      confirmed: boolean;
    }) => {
      if (!input?.runId || !input?.bankAccountId) throw new Error("اختر المسيّر وحساب المنشأة");
      if (
        input.confirmed !== true ||
        !input.bankReference?.trim() ||
        input.bankReference.trim().length > 120
      ) {
        throw new Error(
          "أكّد تنفيذ جميع دفعات المسيّر خارج النظام وأدخل مرجع البنك (حتى 120 حرفًا)",
        );
      }
      return { ...input, bankReference: input.bankReference.trim() };
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, ["super_admin", "org_admin", "finance_officer"]);
    const { data: result, error } = await supabase.rpc("confirm_payroll_payment_atomic", {
      p_run_id: data.runId,
      p_account_id: data.bankAccountId,
      p_bank_reference: data.bankReference,
    });
    if (error) throw new Error(`تعذر تسجيل تأكيد التحويل: ${error.message}`);
    return result;
  });

/** Settlement notifications (net, loan recovery, bank reference) for the signed-in user. */
export const listPayrollNotificationsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const { data, error } = await supabase
      .from("notifications_inbox")
      .select("id, title_ar, message_ar, body_ar, type, is_read, created_at, link_path")
      .eq("recipient_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(`تعذر قراءة الإشعارات: ${error.message}`);
    return (data ?? []).map((n: any) => ({
      id: n.id,
      title: n.title_ar,
      message: n.message_ar ?? n.body_ar ?? "",
      type: n.type,
      isRead: !!n.is_read,
      createdAt: n.created_at,
      linkPath: n.link_path,
    }));
  });

/** Marks one notification (or all) as read. */
export const markNotificationReadServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; all?: boolean }) => input ?? {})
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    let query = supabase
      .from("notifications_inbox")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", context.userId);
    if (!data.all && data.id) query = query.eq("id", data.id);
    const { error } = await query;
    if (error) throw new Error(`تعذر تحديث الإشعار: ${error.message}`);
    return { ok: true };
  });

/** Bank transfer instruction file (WPS/SARIE style) for a payroll run. */
export const getBankTransferFileServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => {
    if (!input?.runId) throw new Error("معرّف المسيّر مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...FINANCE_ROLES]);

    const [{ data: payments, error }, { data: account }] = await Promise.all([
      supabase
        .from("payroll_payments")
        .select(
          "net_amount, iban, bank_name, status, batch_no, reference, paid_at, employees(full_name, employee_no)",
        )
        .eq("payroll_run_id", data.runId),
      supabase
        .from("company_bank_accounts")
        .select("bank_name, account_name, iban, current_balance")
        .eq("is_primary", true)
        .maybeSingle(),
    ]);
    if (error) throw new Error(`تعذر قراءة الدفعات: ${error.message}`);

    const rows = (payments ?? []).map((p: any) => ({
      employeeNo: p.employees?.employee_no ?? "—",
      employeeName: p.employees?.full_name ?? "—",
      iban: p.iban ?? "",
      bankName: p.bank_name ?? "",
      amount: round2(Number(p.net_amount ?? 0)),
      status: p.status,
      reference: p.reference ?? "",
      batchNo: p.batch_no ?? "",
      paidAt: p.paid_at,
    }));

    return {
      debitAccount: account ?? null,
      rows,
      total: round2(rows.reduce((sum: number, r: any) => sum + r.amount, 0)),
      batchNo: rows.find((r: any) => r.batchNo)?.batchNo ?? null,
    };
  });
