import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateEmployeePayroll } from "../utils/payroll-calculator";
import { assertRole, daysInMonth, round2 } from "./guards";
import { allocatePayrollLoans } from "./payroll-loans";

interface RunPayrollInput {
  year: number;
  month: number; // 1-12
  payrollGroupId?: string | null;
}

/**
 * Computes and persists a full payroll run from live database records.
 * Sensitive: role-checked server-side; the browser never decides eligibility.
 */
export const runPayrollServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RunPayrollInput) => {
    if (!input || !Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
      throw new Error("سنة غير صالحة");
    }
    if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
      throw new Error("شهر غير صالح");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "payroll_officer",
      "finance_officer",
    ]);
    return computePayrollRun(supabase, data);
  });

/**
 * Shared payroll computation, reused by the manual run and by attendance settlement.
 * Re-running a draft period replaces the previous draft instead of duplicating it.
 */
export async function computePayrollRun(supabase: any, data: RunPayrollInput) {
  const { year, month } = data;
  const periodDays = daysInMonth(year, month);
  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(periodDays).padStart(2, "0")}`;

  let employeeQuery = supabase
    .from("employees")
    .select("id, basic_salary, total_salary, nationality, hire_date, status, payroll_group_id")
    .in("status", ["active", "on_leave"]);
  if (data.payrollGroupId) {
    employeeQuery = employeeQuery.eq("payroll_group_id", data.payrollGroupId);
  }
  const { data: employees, error: employeesError } = await employeeQuery;
  if (employeesError) throw new Error(`تعذر قراءة الموظفين: ${employeesError.message}`);
  if (!employees?.length) throw new Error("لا يوجد موظفون مؤهلون لهذا المسيّر");

  const employeeIds = employees.map((e: any) => e.id);

  const [salaryRes, attendanceRes, loanRes, policyRes, advanceRes] = await Promise.all([
    supabase
      .from("salary_profiles")
      .select("*")
      .in("employee_id", employeeIds)
      .lte("effective_from", periodEnd)
      .order("effective_from", { ascending: false }),
    supabase
      .from("attendance_records")
      .select("employee_id, status, late_minutes, early_departure_minutes, overtime_minutes")
      .in("employee_id", employeeIds)
      .gte("work_date", periodStart)
      .lte("work_date", periodEnd),
    supabase
      .from("loans")
      .select("id, employee_id, monthly_installment, remaining_balance")
      .in("employee_id", employeeIds)
      .eq("status", "active"),
    (supabase as any).from("attendance_policies").select("late_grace_minutes, early_departure_grace_minutes, rounding_minutes, rounding_mode, deduction_cap_percent").eq("scope_key", "global").maybeSingle(),
    (supabase as any).from("salary_advances").select("employee_id, approved_amount, requested_amount, status").eq("period_year", year).eq("period_month", month).in("status", ["approved", "paid"]),
  ]);

  for (const result of [salaryRes, attendanceRes, loanRes, policyRes, advanceRes]) {
    if (result.error) throw new Error(`تعذر قراءة مدخلات الرواتب: ${result.error.message}`);
  }
  const allocations = allocatePayrollLoans(loanRes.data ?? []);
  const policy = policyRes.data ?? {};
  const salaryAdvances = new Map<string, number>();
  for (const advance of advanceRes.data ?? []) {
    salaryAdvances.set(advance.employee_id, round2(Number(advance.approved_amount ?? advance.requested_amount ?? 0)));
  }

  const latestSalary = new Map<string, any>();
  for (const row of salaryRes.data ?? []) {
    if (!latestSalary.has(row.employee_id)) latestSalary.set(row.employee_id, row);
  }

  const attendanceAgg = new Map<
    string,
    { absentDays: number; leaveDays: number; lateMinutes: number; earlyDepartureMinutes: number; overtimeMinutes: number }
  >();
  for (const row of attendanceRes.data ?? []) {
    const agg = attendanceAgg.get(row.employee_id) ?? {
      absentDays: 0,
      leaveDays: 0,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      overtimeMinutes: 0,
    };
    if (row.status === "absent") agg.absentDays += 1;
    if (row.status === "leave") agg.leaveDays += 1;
    agg.lateMinutes += row.late_minutes ?? 0;
    agg.earlyDepartureMinutes += row.early_departure_minutes ?? 0;
    agg.overtimeMinutes += row.overtime_minutes ?? 0;
    attendanceAgg.set(row.employee_id, agg);
  }

  const runId = crypto.randomUUID();
  const details: Record<string, unknown>[] = [];
  const totals = {
    basic: 0,
    allowances: 0,
    overtime: 0,
    deductions: 0,
    net: 0,
    employerGosi: 0,
  };

  for (const employee of employees) {
    const profile = latestSalary.get(employee.id);
    const basicSalary = Number(profile?.basic_salary ?? employee.basic_salary ?? 0);
    const housing = Number(profile?.housing_allowance ?? 0);
    const transport = Number(profile?.transport_allowance ?? 0);
    const other = Array.isArray(profile?.other_allowances)
      ? profile.other_allowances.reduce(
          (sum: number, item: { amount?: number }) => sum + Number(item.amount ?? 0),
          0,
        )
      : Number(profile?.other_allowances ?? 0);
    const agg = attendanceAgg.get(employee.id) ?? {
      absentDays: 0,
      leaveDays: 0,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      overtimeMinutes: 0,
    };
    const loanInstallment = round2(
      allocations
        .filter((allocation) => allocation.employee_id === employee.id)
        .reduce((sum, allocation) => sum + allocation.amount, 0),
    );
    const salaryAdvanceDeduction = salaryAdvances.get(employee.id) ?? 0;
    const overtimeHours = round2(agg.overtimeMinutes / 60);
    const isSaudi = (employee.nationality ?? "SA").toUpperCase().startsWith("SA");

    const result = calculateEmployeePayroll({
      basicSalary,
      housingAllowance: housing,
      transportAllowance: transport,
      otherAllowances: other,
      calculationBasis: "fixed_30_days",
      daysInMonth: periodDays,
      absenceDays: agg.absentDays,
      lateMinutes: agg.lateMinutes,
      earlyDepartureMinutes: agg.earlyDepartureMinutes,
      lateGraceMinutes: Number(policy.late_grace_minutes ?? 15),
      earlyDepartureGraceMinutes: Number(policy.early_departure_grace_minutes ?? 15),
      deductionRoundingMinutes: Number(policy.rounding_minutes ?? 1),
      deductionRoundingMode: (policy.rounding_mode ?? "exact") as "exact" | "up" | "nearest",
      deductionCapPercent: Number(policy.deduction_cap_percent ?? 100),
      overtimeHours,
      loanInstallment,
      salaryAdvanceDeduction,
      isSaudiNational: isSaudi,
      payrollDate: periodEnd,
    });

    if (!Number.isFinite(result.netSalary) || !Number.isFinite(result.totalDeductions)) {
      throw new Error("قيم راتب غير صالحة؛ راجع ملف راتب الموظف");
    }
    if (result.totalDeductions > result.totalEarnings) {
      throw new Error("الاستقطاعات تتجاوز المستحقات؛ راجع توزيع الخصومات قبل احتساب المسيّر");
    }
    totals.basic += basicSalary;
    totals.allowances += housing + transport + other;
    totals.overtime += result.overtimeAmount;
    totals.deductions += result.totalDeductions;
    totals.net += result.netSalary;
    totals.employerGosi += result.gosiEmployer;

    details.push({
      payroll_run_id: runId,
      employee_id: employee.id,
      basic_salary: basicSalary,
      housing_allowance: housing,
      transport_allowance: transport,
      other_allowances: other,
      overtime_amount: result.overtimeAmount,
      overtime_hours: overtimeHours,
      bonus_amount: 0,
      gosi_employee_deduction: result.gosiEmployee,
      loan_deduction: result.loanDeduction,
      salary_advance_deduction: result.salaryAdvanceDeduction,
      absence_late_deduction: round2(
        result.absenceDeduction + result.lateDeduction + result.earlyDepartureDeduction,
      ),
      unpaid_leave_deduction: result.unpaidLeaveDeduction,
      other_deductions: 0,
      total_deductions: result.totalDeductions,
      gross_salary: result.totalEarnings,
      net_salary: result.netSalary,
      working_days: periodDays - agg.absentDays,
      absent_days: agg.absentDays,
    });
  }

  const run = {
    id: runId,
    payroll_group_id: data.payrollGroupId ?? null,
    period_year: year,
    period_month: month,
    status: "draft",
    total_employees: details.length,
    total_basic_salary: round2(totals.basic),
    total_allowances: round2(totals.allowances),
    total_overtime_amount: round2(totals.overtime),
    total_deductions: round2(totals.deductions),
    total_net_salary: round2(totals.net),
    total_employer_gosi: round2(totals.employerGosi),
  };
  const { data: savedRunId, error: saveError } = await supabase.rpc("save_payroll_run_atomic", {
    p_run: run,
    p_details: details,
    p_allocations: allocations,
  });
  if (saveError) throw new Error(`تعذر حفظ المسيّر بالكامل: ${saveError.message}`);

  return {
    runId: savedRunId as string,
    employees: details.length,
    totalNet: round2(totals.net),
    totalDeductions: round2(totals.deductions),
    totalEmployerGosi: round2(totals.employerGosi),
  };
}

/**
 * Locks a payroll run. Payment requires a separate external-transfer confirmation.
 */
export const updatePayrollRunStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string; status: "draft" | "locked" | "paid" }) => {
    if (!input.runId) throw new Error("معرّف المسيّر مطلوب");
    if (!["draft", "locked", "paid"].includes(input.status)) throw new Error("حالة غير صالحة");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId;
    await assertRole(supabase, userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "payroll_officer",
      "finance_officer",
    ]);

    if (data.status === "paid") {
      throw new Error("سجّل تأكيد التحويل ومرجع البنك من شاشة دفعات الرواتب");
    }
    const { error } = await supabase.rpc("set_payroll_run_status_atomic", {
      p_run_id: data.runId,
      p_status: data.status,
    });
    if (error) throw new Error(`تعذر تحديث حالة المسيّر: ${error.message}`);
    return { ok: true };
  });
