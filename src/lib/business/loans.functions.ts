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

export const requestLoanServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { employeeId: string; principalAmount: number; monthlyInstallment: number; totalInstallments: number; reason: string; loanType?: "personal_advance" | "salary_advance" }) => {
    if (!input.employeeId || !(input.principalAmount > 0) || !(input.monthlyInstallment > 0) || !(input.totalInstallments >= 1) || !input.reason?.trim()) throw new Error("بيانات السلفة غير مكتملة");
    if (input.monthlyInstallment * input.totalInstallments < input.principalAmount) throw new Error("إجمالي الأقساط أقل من قيمة السلفة");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: employee } = await supabase.from("employees").select("id, total_salary, basic_salary").eq("id", data.employeeId).maybeSingle();
    if (!employee) throw new Error("الموظف غير موجود");
    const { data: activeLoans } = await supabase.from("loans").select("remaining_balance").eq("employee_id", data.employeeId).in("status", ["pending", "approved", "active"]);
    const outstanding = (activeLoans ?? []).reduce((sum: number, row: any) => sum + Number(row.remaining_balance ?? 0), 0);
    const salary = Number(employee.total_salary ?? employee.basic_salary ?? 0);
    if (data.loanType === "salary_advance" && data.principalAmount > salary * 0.5) throw new Error("السلفة المبكرة لا تتجاوز 50% من راتب الموظف");
    if (outstanding + data.principalAmount > salary * 3) throw new Error("تجاوز الحد الأقصى للمديونية المسموح بها");
    const { data: loan, error } = await supabase.from("loans").insert({
      employee_id: data.employeeId, loan_type: data.loanType ?? "personal_advance", principal_amount: round2(data.principalAmount),
      monthly_installment: round2(data.monthlyInstallment), total_installments: data.totalInstallments,
      remaining_balance: round2(data.principalAmount), status: "pending",
    }).select("id").single();
    if (error) throw new Error(`تعذر حفظ طلب السلفة: ${error.message}`);
    return { id: loan.id };
  });

export const requestSalaryAdvanceServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { employeeId: string; periodYear: number; periodMonth: number; amount: number; reason: string }) => {
    if (!input.employeeId || input.periodMonth < 1 || input.periodMonth > 12 || !(input.amount > 0) || !input.reason?.trim()) throw new Error("بيانات الصرف المبكر غير مكتملة");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: employee } = await supabase.from("employees").select("total_salary, basic_salary").eq("id", data.employeeId).maybeSingle();
    if (!employee) throw new Error("الموظف غير موجود");
    const salary = Number(employee.total_salary ?? employee.basic_salary ?? 0);
    if (data.amount > salary * 0.5) throw new Error("الصرف المبكر لا يتجاوز 50% من الراتب");
    const { data: advance, error } = await supabase.from("salary_advances").insert({
      employee_id: data.employeeId, period_year: data.periodYear, period_month: data.periodMonth,
      requested_amount: round2(data.amount), reason: data.reason.trim(), requested_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(`تعذر حفظ طلب الصرف المبكر: ${error.message}`);
    return { id: advance.id };
  });

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

    const { data: result, error } = await supabase.rpc("disburse_loans_atomic", {
      p_bank_account_id: data.bankAccountId,
      p_loan_ids: data.loanIds?.length ? data.loanIds : null,
    });
    if (error) throw new Error(`تعذر صرف السلف: ${error.message}`);
    return result;
  });
