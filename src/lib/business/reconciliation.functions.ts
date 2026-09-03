import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, round2 } from "./guards";

const PAYROLL_ROLES = [
  "super_admin",
  "org_admin",
  "hr_manager",
  "payroll_officer",
  "finance_officer",
] as const;

export interface MonthlyReconciliationRow {
  runId: string;
  year: number;
  month: number;
  label: string;
  status: string;
  employees: number;
  workedDays: number;
  absentDays: number;
  gross: number;
  net: number;
  loansPaid: number;
  deductions: number;
  paidOut: number;
  pendingOut: number;
  lockedAt: string | null;
  paidAt: string | null;
}

export interface EmployeeReconciliationRow {
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  departmentName: string;
  workingDays: number;
  absentDays: number;
  gross: number;
  net: number;
  loanPaid: number;
  deductions: number;
  gap: number;
  paymentStatus: string;
}

/**
 * Monthly payroll reconciliation: working days, net pay, loan installments
 * repaid, disbursed amounts, and the remaining company bank balance.
 */
export const listPayrollReconciliationServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...PAYROLL_ROLES]);

    const [runsRes, detailsRes, paymentsRes, accountsRes] = await Promise.all([
      supabase
        .from("payroll_runs")
        .select(
          "id, period_year, period_month, status, total_employees, total_net_salary, total_deductions, locked_at, paid_at",
        )
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false }),
      supabase
        .from("payroll_details")
        .select(
          "payroll_run_id, working_days, absent_days, gross_salary, net_salary, loan_deduction, total_deductions",
        ),
      supabase.from("payroll_payments").select("payroll_run_id, net_amount, status"),
      supabase.from("company_bank_accounts").select("bank_name, current_balance, is_primary"),
    ]);

    if (runsRes.error) throw new Error(`تعذر قراءة المسيّرات: ${runsRes.error.message}`);

    const byRun = new Map<string, any>();
    for (const detail of detailsRes.data ?? []) {
      const bucket = byRun.get(detail.payroll_run_id) ?? {
        employees: 0,
        workedDays: 0,
        absentDays: 0,
        gross: 0,
        net: 0,
        loansPaid: 0,
        deductions: 0,
      };
      bucket.employees += 1;
      bucket.workedDays += Number(detail.working_days ?? 0);
      bucket.absentDays += Number(detail.absent_days ?? 0);
      bucket.gross += Number(detail.gross_salary ?? 0);
      bucket.net += Number(detail.net_salary ?? 0);
      bucket.loansPaid += Number(detail.loan_deduction ?? 0);
      bucket.deductions += Number(detail.total_deductions ?? 0);
      byRun.set(detail.payroll_run_id, bucket);
    }

    const payByRun = new Map<string, { paid: number; pending: number }>();
    for (const payment of paymentsRes.data ?? []) {
      const bucket = payByRun.get(payment.payroll_run_id) ?? { paid: 0, pending: 0 };
      const amount = Number(payment.net_amount ?? 0);
      if (payment.status === "paid") bucket.paid += amount;
      else bucket.pending += amount;
      payByRun.set(payment.payroll_run_id, bucket);
    }

    const accounts = accountsRes.data ?? [];
    const companyBalance = accounts.reduce(
      (sum: number, account: any) => sum + Number(account.current_balance ?? 0),
      0,
    );

    const months: MonthlyReconciliationRow[] = (runsRes.data ?? []).map((run: any) => {
      const agg = byRun.get(run.id) ?? {
        employees: run.total_employees ?? 0,
        workedDays: 0,
        absentDays: 0,
        gross: 0,
        net: Number(run.total_net_salary ?? 0),
        loansPaid: 0,
        deductions: Number(run.total_deductions ?? 0),
      };
      const pay = payByRun.get(run.id) ?? { paid: 0, pending: 0 };
      return {
        runId: run.id,
        year: run.period_year,
        month: run.period_month,
        label: `${String(run.period_month).padStart(2, "0")}/${run.period_year}`,
        status: run.status,
        employees: agg.employees,
        workedDays: agg.workedDays,
        absentDays: agg.absentDays,
        gross: round2(agg.gross),
        net: round2(agg.net),
        loansPaid: round2(agg.loansPaid),
        deductions: round2(agg.deductions),
        paidOut: round2(pay.paid),
        pendingOut: round2(pay.pending),
        lockedAt: run.locked_at,
        paidAt: run.paid_at,
      };
    });

    return {
      months,
      companyBalance: round2(companyBalance),
      accounts: accounts.map((account: any) => ({
        bankName: account.bank_name,
        balance: Number(account.current_balance ?? 0),
        isPrimary: account.is_primary,
      })),
    };
  });

/** Per-employee reconciliation points for a single payroll run. */
export const listEmployeeReconciliationServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => {
    if (!input?.runId) throw new Error("معرّف المسيّر مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...PAYROLL_ROLES]);

    const [detailsRes, paymentsRes, deptRes] = await Promise.all([
      supabase
        .from("payroll_details")
        .select(
          "employee_id, working_days, absent_days, gross_salary, net_salary, loan_deduction, total_deductions, employees(full_name, employee_no, department_id)",
        )
        .eq("payroll_run_id", data.runId),
      supabase.from("payroll_payments").select("employee_id, status").eq("payroll_run_id", data.runId),
      supabase.from("departments").select("id, name"),
    ]);

    if (detailsRes.error) throw new Error(`تعذر قراءة تفاصيل المسيّر: ${detailsRes.error.message}`);

    const deptName = new Map<string, string>(
      (deptRes.data ?? []).map((dept: any) => [dept.id, dept.name]),
    );
    const paymentStatus = new Map<string, string>(
      (paymentsRes.data ?? []).map((payment: any) => [payment.employee_id, payment.status]),
    );

    const rows: EmployeeReconciliationRow[] = (detailsRes.data ?? []).map((detail: any) => {
      const gross = Number(detail.gross_salary ?? 0);
      const net = Number(detail.net_salary ?? 0);
      return {
        employeeId: detail.employee_id,
        employeeName: detail.employees?.full_name ?? "—",
        employeeNo: detail.employees?.employee_no ?? "—",
        departmentName: deptName.get(detail.employees?.department_id) ?? "غير محدد",
        workingDays: Number(detail.working_days ?? 0),
        absentDays: Number(detail.absent_days ?? 0),
        gross: round2(gross),
        net: round2(net),
        loanPaid: round2(Number(detail.loan_deduction ?? 0)),
        deductions: round2(Number(detail.total_deductions ?? 0)),
        gap: round2(gross - net),
        paymentStatus: paymentStatus.get(detail.employee_id) ?? "غير مجهّزة",
      };
    });

    rows.sort((a, b) => b.net - a.net);
    return rows;
  });
