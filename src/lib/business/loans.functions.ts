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

    const loans: PendingLoanRow[] = ((data ?? []) as any[]).map(mapLoan);
    const pending = loans.filter((l) => l.status === "approved" || l.status === "pending_approval" || l.status === "disbursement_pending");
    const active = loans.filter((l) => l.status === "active");

    return {
      loans,
      pending,
      active,
      totals: {
        pendingCount: pending.length,
        pendingAmount: round2(pending.reduce((sum, l) => sum + l.amount, 0)),
        approvedAmount: round2(
          pending.filter((l) => l.status === "approved" || l.status === "disbursement_pending").reduce((sum, l) => sum + l.amount, 0),
        ),
        activeOutstanding: round2(active.reduce((sum, l) => sum + l.outstanding, 0)),
        monthlyRecovery: round2(active.reduce((sum, l) => sum + l.installment, 0)),
      },
    };
  });

/**
 * Disburses approved loans atomically using database RPC:
 * validates authorization, locks loan and bank account, creates disbursement
 * record, activates loan, generates authoritative installment plan, and writes audit event.
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
      .select("id, principal_amount, approved_amount")
      .in("status", ["approved", "disbursement_pending"]);
    if (data.loanIds?.length) query = query.in("id", data.loanIds);

    const { data: loans, error } = await query;
    if (error) throw new Error(`تعذر قراءة السلف: ${error.message}`);
    if (!loans?.length) throw new Error("لا توجد سلف معتمدة بانتظار الصرف");

    let totalDisbursed = 0;
    let lastRemainingBalance = 0;

    for (const loan of loans) {
      const { data: result, error: rpcError } = await supabase.rpc("disburse_loan_atomic", {
        p_loan_id: loan.id,
        p_bank_account_id: data.bankAccountId,
        p_external_ref: null,
        p_notes: "صرف مالي معتمد عبر لوحة إدارة السلف",
      });

      if (rpcError) {
        throw new Error(`فشل صرف السلفة ${loan.id}: ${rpcError.message}`);
      }

      totalDisbursed += Number(result?.disbursed_amount || 0);
      lastRemainingBalance = Number(result?.new_bank_balance || 0);
    }

    return {
      disbursed: loans.length,
      totalDisbursed: round2(totalDisbursed),
      remainingBalance: round2(lastRemainingBalance),
    };
  });

/**
 * Early loan payoff server action using authoritative database transaction.
 */
export const settleLoanEarlyServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { loanId: string; paymentMethod?: string; receiptRef?: string; notes?: string }) => {
    if (!input?.loanId) throw new Error("معرف السلفة مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "payroll_officer",
      "finance_officer",
      "hr_manager",
    ]);

    const { data: result, error } = await supabase.rpc("settle_loan_early_atomic", {
      p_loan_id: data.loanId,
      p_payment_method: data.paymentMethod || "bank_transfer",
      p_receipt_ref: data.receiptRef || null,
      p_notes: data.notes || null,
    });

    if (error) throw new Error(`تعذر السداد المبكر: ${error.message}`);
    return result;
  });
