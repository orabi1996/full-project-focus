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

export interface PendingLoanRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  loanType: string;
  amount: number;
  installment: number;
  installmentsTotal: number;
  installmentsPaid: number;
  outstanding: number;
  status: string;
  requestedAt: string | null;
}

function mapLoan(row: any): PendingLoanRow {
  const amount = Number(row.approved_amount ?? row.principal_amount ?? 0);
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? "—",
    employeeNo: row.employees?.employee_no ?? "—",
    loanType: row.loan_type ?? "advance",
    amount: round2(amount),
    installment: round2(Number(row.installment_amount ?? row.monthly_installment ?? 0)),
    installmentsTotal: Number(row.installments_total ?? row.total_installments ?? 0),
    installmentsPaid: Number(row.installments_paid ?? row.paid_installments ?? 0),
    outstanding: round2(Number(row.outstanding_amount ?? row.remaining_balance ?? amount)),
    status: row.status,
    requestedAt: row.requested_at ?? row.created_at ?? null,
  };
}

/** Loans awaiting disbursement plus loans still being repaid through payroll. */
export const listLoansOverviewServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...FINANCE_ROLES]);

    const { data, error } = await supabase
      .from("loans")
      .select(
        "id, employee_id, loan_type, principal_amount, approved_amount, monthly_installment, installment_amount, total_installments, installments_total, paid_installments, installments_paid, remaining_balance, outstanding_amount, status, requested_at, created_at, employees(full_name, employee_no)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر قراءة السلف: ${error.message}`);

    const loans = (data ?? []).map(mapLoan);
    const pending = loans.filter((l) => l.status === "approved" || l.status === "pending");
    const active = loans.filter((l) => l.status === "active");

    return {
      loans,
      pending,
      active,
      totals: {
        pendingCount: pending.length,
        pendingAmount: round2(pending.reduce((sum, l) => sum + l.amount, 0)),
        approvedAmount: round2(
          pending.filter((l) => l.status === "approved").reduce((sum, l) => sum + l.amount, 0),
        ),
        activeOutstanding: round2(active.reduce((sum, l) => sum + l.outstanding, 0)),
        monthlyRecovery: round2(active.reduce((sum, l) => sum + l.installment, 0)),
      },
    };
  });

/**
 * Disburses approved loans from the company bank account: debits the balance,
 * activates each loan and sets the outstanding amount recovered by payroll.
 */
export const disburseApprovedLoansServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bankAccountId: string; loanIds?: string[] }) => {
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

    let query = supabase
      .from("loans")
      .select(
        "id, employee_id, principal_amount, approved_amount, installment_amount, monthly_installment, installments_total, total_installments",
      )
      .eq("status", "approved");
    if (data.loanIds?.length) query = query.in("id", data.loanIds);

    const { data: loans, error } = await query;
    if (error) throw new Error(`تعذر قراءة السلف: ${error.message}`);
    if (!loans?.length) throw new Error("لا توجد سلف معتمدة بانتظار الصرف");

    const { data: account, error: accountError } = await supabase
      .from("company_bank_accounts")
      .select("id, current_balance")
      .eq("id", data.bankAccountId)
      .maybeSingle();
    if (accountError || !account) throw new Error("حساب المنشأة غير موجود");

    const total = round2(
      loans.reduce(
        (sum: number, l: any) => sum + Number(l.approved_amount ?? l.principal_amount ?? 0),
        0,
      ),
    );
    const balance = Number(account.current_balance ?? 0);
    if (total > balance) throw new Error("رصيد حساب المنشأة لا يكفي لصرف السلف المعتمدة");

    const now = new Date().toISOString();
    for (const loan of loans) {
      const amount = round2(Number(loan.approved_amount ?? loan.principal_amount ?? 0));
      const installments = Number(loan.installments_total ?? loan.total_installments ?? 1) || 1;
      await supabase
        .from("loans")
        .update({
          status: "active",
          approved_amount: amount,
          outstanding_amount: amount,
          remaining_balance: amount,
          installment_amount: round2(
            Number(loan.installment_amount ?? loan.monthly_installment ?? amount / installments),
          ),
          decided_at: now,
        })
        .eq("id", loan.id);
    }

    await supabase
      .from("company_bank_accounts")
      .update({ current_balance: round2(balance - total) })
      .eq("id", account.id);

    return {
      disbursed: loans.length,
      totalDisbursed: total,
      remainingBalance: round2(balance - total),
    };
  });
