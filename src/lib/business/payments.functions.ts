import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, round2 } from "./guards";
import { advanceLoansForRun } from "./payroll.functions";

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

    const { data: details, error } = await supabase
      .from("payroll_details")
      .select("employee_id, net_salary, employees(iban, bank_name)")
      .eq("payroll_run_id", data.runId);
    if (error) throw new Error(`تعذر قراءة تفاصيل المسيّر: ${error.message}`);
    if (!details?.length) throw new Error("لا توجد تفاصيل رواتب لهذا المسيّر");

    const { data: existing } = await supabase
      .from("payroll_payments")
      .select("employee_id, status")
      .eq("payroll_run_id", data.runId);
    const settled = new Set(
      (existing ?? [])
        .filter((row: any) => row.status === "paid")
        .map((row: any) => row.employee_id),
    );

    // Zero-net rows (system accounts, unpaid month) are not bank transfers.
    const rows = details
      .filter((detail: any) => !settled.has(detail.employee_id) && Number(detail.net_salary ?? 0) > 0)
      .map((detail: any) => ({
        payroll_run_id: data.runId,
        employee_id: detail.employee_id,
        net_amount: round2(Number(detail.net_salary ?? 0)),
        iban: detail.employees?.iban ?? null,
        bank_name: detail.employees?.bank_name ?? null,
        status: "pending",
        failure_reason: detail.employees?.iban ? null : "لا يوجد آيبان مسجل للموظف",
      }));

    const { error: upsertError } = await supabase
      .from("payroll_payments")
      .upsert(rows, { onConflict: "payroll_run_id,employee_id" });
    if (upsertError) throw new Error(`تعذر تجهيز الدفعات: ${upsertError.message}`);

    return {
      prepared: rows.length,
      missingIban: rows.filter((row: any) => !row.iban).length,
      totalNet: round2(rows.reduce((sum: number, row: any) => sum + row.net_amount, 0)),
    };
  });

/**
 * Disburses the run: debits the company bank account, marks each payment paid
 * with a bank reference, marks the run as paid and advances loan installments.
 */
export const disburseRunPaymentsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string; bankAccountId: string }) => {
    if (!input?.runId) throw new Error("معرّف المسيّر مطلوب");
    if (!input?.bankAccountId) throw new Error("اختر حساب المنشأة البنكي");
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

    const { data: account, error: accountError } = await supabase
      .from("company_bank_accounts")
      .select("id, bank_name, iban, current_balance, currency")
      .eq("id", data.bankAccountId)
      .maybeSingle();
    if (accountError || !account) throw new Error("حساب المنشأة غير موجود");

    const { data: payments, error } = await supabase
      .from("payroll_payments")
      .select("id, net_amount, iban, status")
      .eq("payroll_run_id", data.runId)
      .neq("status", "paid");
    if (error) throw new Error(`تعذر قراءة الدفعات: ${error.message}`);
    if (!payments?.length) throw new Error("لا توجد دفعات معلقة للصرف");

    const payable = payments.filter((p: any) => !!p.iban);
    const blocked = payments.filter((p: any) => !p.iban);
    if (!payable.length) throw new Error("لا يوجد موظف لديه آيبان صالح للتحويل");

    const total = round2(payable.reduce((sum: number, p: any) => sum + Number(p.net_amount), 0));
    const balance = Number(account.current_balance ?? 0);
    if (total > balance) {
      throw new Error(
        `رصيد حساب المنشأة غير كافٍ: المطلوب ${total.toLocaleString("ar-EG")} والمتاح ${balance.toLocaleString("ar-EG")}`,
      );
    }

    const now = new Date().toISOString();
    const batchNo = `WPS-${now.slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;

    for (const payment of payable) {
      await supabase
        .from("payroll_payments")
        .update({
          status: "paid",
          batch_no: batchNo,
          bank_account_id: account.id,
          bank_name: account.bank_name,
          reference: `${batchNo}-${String(payment.id).slice(0, 8)}`,
          sent_at: now,
          paid_at: now,
          failure_reason: null,
        })
        .eq("id", payment.id);
    }

    if (blocked.length) {
      await supabase
        .from("payroll_payments")
        .update({ status: "failed", failure_reason: "لا يوجد آيبان مسجل للموظف" })
        .in(
          "id",
          blocked.map((p: any) => p.id),
        );
    }

    await supabase
      .from("company_bank_accounts")
      .update({ current_balance: round2(balance - total) })
      .eq("id", account.id);

    const { data: stillPending } = await supabase
      .from("payroll_payments")
      .select("id")
      .eq("payroll_run_id", data.runId)
      .neq("status", "paid");

    if (!stillPending?.length) {
      await supabase
        .from("payroll_runs")
        .update({ status: "paid", paid_at: now })
        .eq("id", data.runId);
      await advanceLoansForRun(supabase, data.runId);
    }

    return {
      batchNo,
      paid: payable.length,
      failed: blocked.length,
      totalPaid: total,
      remainingBalance: round2(balance - total),
      runClosed: !stillPending?.length,
    };
  });
