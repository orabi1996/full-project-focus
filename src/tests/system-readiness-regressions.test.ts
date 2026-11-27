import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (relativePath: string) => fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

describe("System readiness regressions", () => {
  it("scopes public biometric punches to device location and bounds their timestamp", () => {
    const route = read("../routes/api/public/biometric/punch.ts");
    expect(route).toContain("employee.work_location_id !== device.work_location_id");
    expect(route).toContain("location.company_id !== employee.company_id");
    expect(route).toContain("24 * 60 * 60 * 1000");
    expect(route).toContain("punchType !== \"in\" && punchType !== \"out\"");
    expect(route).toContain(".eq(\"punch_time\", punchTime)");
    expect(route).not.toContain("employee: employee.full_name");
  });

  it("routes attendance decisions through the scoped atomic RPC and removes bulk payroll locking", () => {
    const service = read("../lib/business/attendance.functions.ts");
    expect(service).toContain('rpc("decide_attendance_punch_atomic"');
    expect(service).not.toContain("settleAttendancePeriodServer");
    expect(service).not.toContain('p_status: "locked"');
  });

  it("guards reimbursement payment, payroll loan ledgers, and settlement amounts in SQL", () => {
    const guards = read("../../supabase/migrations/20261127010000_readiness_integrity_guards.sql");
    const payroll = read("../../supabase/migrations/20261127050000_payroll_loan_ledger_integrity.sql");
    const settlement = read("../../supabase/migrations/20261127060000_prevent_negative_final_settlement.sql");
    const settlementCreate = read("../../supabase/migrations/20261127070000_persist_settlement_unpaid_leave_days.sql");

    expect(guards).toContain("OLD.payment_status NOT IN ('approved_for_payment', 'submitted')");
    expect(payroll).toContain("PERFORM public.recover_loan_installments_for_payroll_run");
    expect(payroll).toContain("COALESCE(pre.loan_installment, 0) <> COALESCE");
    expect(payroll).toContain("payroll_loan_allocations WHERE payroll_run_id = p_payroll_run_id");
    expect(settlement).toContain("v_loan_deduction := LEAST");
    expect(settlement).toContain("v_net_settlement := GREATEST(0");
    expect(settlementCreate).toContain("unpaid_leave_days");
  });

  it("does not fabricate dashboard trends or report an empty attendance period as 100%", () => {
    const reports = read("../components/reports/ReportsView.tsx");
    const kpiMigration = read("../../supabase/migrations/20261127020000_truthful_attendance_kpi.sql");
    expect(reports).not.toContain('"الأحد", rate:');
    expect(reports).not.toContain('"يناير", saudi:');
    expect(kpiMigration).toContain("v_attendance_rate := NULL");
  });

  it("validates employee onboarding before moving through steps or saving", () => {
    const employees = read("../components/employees/EmployeesView.tsx");
    const repository = read("../lib/data/hrms-repository.ts");
    expect(employees).toContain("validateWizardStep(wizardStep)");
    expect(employees).toContain("jobTitleAr?.trim()");
    expect(employees).toContain("حُفظت المسودة على هذا الجهاز فقط");
    expect(repository).toContain("الجنسية ورقم الهوية أو الإقامة إلزاميان");
  });

  it("runs monthly leave accrual daily so an outage on month start is caught up idempotently", () => {
    const server = read("../server.ts");
    const cron = read("../lib/business/cron.functions.ts");
    const accrual = read("../../supabase/migrations/20261127030000_enable_scoped_leave_accrual_cron.sql");
    expect(server).toContain("await executeAutomatedMonthlyLeaveAccrual(supabaseAdmin);");
    expect(server).not.toContain("onlyOnLocalMonthStart: true");
    expect(accrual).toContain("FROM public.leave_accrual_runs");
    expect(cron).toContain("p_period_month: options?.month ?? null");
  });
});
