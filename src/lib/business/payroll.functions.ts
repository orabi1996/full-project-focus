import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateEmployeePayroll } from "../utils/payroll-calculator";
import { assertRole, daysInMonth, round2 } from "./guards";

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
    if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
      throw new Error("سنة غير صالحة");
    }
    if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
      throw new Error("شهر غير صالح");
    }
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

    const { year, month } = data;
    const periodDays = daysInMonth(year, month);
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(periodDays).padStart(2, "0")}`;

    const { data: existing } = await supabase
      .from("payroll_runs")
      .select("id, status")
      .eq("period_year", year)
      .eq("period_month", month)
      .maybeSingle();
    if (existing && existing.status !== "draft") {
      throw new Error("مسيّر هذا الشهر مُقفل بالفعل ولا يمكن إعادة تشغيله");
    }

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

    const employeeIds = employees.map((e) => e.id);

    const [salaryRes, attendanceRes, loanRes] = await Promise.all([
      supabase
        .from("salary_profiles")
        .select(
          "employee_id, effective_from, basic_salary, housing_allowance, transport_allowance, other_allowances, gosi_registered",
        )
        .in("employee_id", employeeIds)
        .lte("effective_from", periodEnd)
        .order("effective_from", { ascending: false }),
      supabase
        .from("attendance_records")
        .select("employee_id, status, late_minutes, overtime_minutes")
        .in("employee_id", employeeIds)
        .gte("work_date", periodStart)
        .lte("work_date", periodEnd),
      supabase
        .from("loans")
        .select(
          "id, employee_id, monthly_installment, installment_amount, remaining_balance, outstanding_amount, installments_paid, paid_installments, total_installments, installments_total, total_paid, status",
        )
        .in("employee_id", employeeIds)
        .eq("status", "active"),
    ]);

    const latestSalary = new Map<string, any>();
    for (const row of salaryRes.data ?? []) {
      if (!latestSalary.has(row.employee_id)) latestSalary.set(row.employee_id, row);
    }

    const attendanceAgg = new Map<
      string,
      { absentDays: number; leaveDays: number; lateMinutes: number; overtimeMinutes: number }
    >();
    for (const row of attendanceRes.data ?? []) {
      const agg = attendanceAgg.get(row.employee_id) ?? {
        absentDays: 0,
        leaveDays: 0,
        lateMinutes: 0,
        overtimeMinutes: 0,
      };
      if (row.status === "absent") agg.absentDays += 1;
      if (row.status === "leave") agg.leaveDays += 1;
      agg.lateMinutes += row.late_minutes ?? 0;
      agg.overtimeMinutes += row.overtime_minutes ?? 0;
      attendanceAgg.set(row.employee_id, agg);
    }

    const loansByEmployee = new Map<string, any[]>();
    for (const loan of loanRes.data ?? []) {
      const list = loansByEmployee.get(loan.employee_id) ?? [];
      list.push(loan);
      loansByEmployee.set(loan.employee_id, list);
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
      const other = Number(profile?.other_allowances ?? 0);
      const agg = attendanceAgg.get(employee.id) ?? {
        absentDays: 0,
        leaveDays: 0,
        lateMinutes: 0,
        overtimeMinutes: 0,
      };
      const loans = loansByEmployee.get(employee.id) ?? [];
      const loanInstallment = round2(
        loans.reduce(
          (sum, loan) =>
            sum + Number(loan.installment_amount ?? loan.monthly_installment ?? 0),
          0,
        ),
      );
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
        overtimeHours,
        loanInstallment,
        isSaudiNational: isSaudi,
        payrollDate: periodEnd,
      });

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
        gosi_employee: result.gosiEmployee,
        gosi_employee_deduction: result.gosiEmployee,
        gosi_employer: result.gosiEmployer,
        loan_deductions: result.loanDeduction,
        loan_deduction: result.loanDeduction,
        absence_deductions: result.absenceDeduction,
        absence_late_deduction: round2(result.absenceDeduction + result.lateDeduction),
        unpaid_leave_deduction: result.unpaidLeaveDeduction,
        other_deductions: 0,
        total_deductions: result.totalDeductions,
        gross_salary: result.totalEarnings,
        net_salary: result.netSalary,
        working_days: periodDays - agg.absentDays,
        absent_days: agg.absentDays,
      });
    }

    const { error: runError } = await supabase.from("payroll_runs").insert({
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
    });
    if (runError) throw new Error(`تعذر إنشاء المسيّر: ${runError.message}`);

    const { error: detailError } = await supabase.from("payroll_details").insert(details);
    if (detailError) {
      await supabase.from("payroll_runs").delete().eq("id", runId);
      throw new Error(`تعذر حفظ تفاصيل الرواتب: ${detailError.message}`);
    }

    return {
      runId,
      employees: details.length,
      totalNet: round2(totals.net),
      totalDeductions: round2(totals.deductions),
      totalEmployerGosi: round2(totals.employerGosi),
    };
  });

/**
 * Locks or pays a payroll run and advances loan installments on payment.
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

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "locked") patch['locked_at'] = new Date().toISOString();
    if (data.status === "paid") patch['paid_at'] = new Date().toISOString();

    const { error } = await supabase.from("payroll_runs").update(patch).eq("id", data.runId);
    if (error) throw new Error(`تعذر تحديث حالة المسيّر: ${error.message}`);

    if (data.status === "paid") {
      const { data: rows } = await supabase
        .from("payroll_details")
        .select("employee_id, loan_deduction")
        .eq("payroll_run_id", data.runId);

      for (const row of rows ?? []) {
        const deduction = Number(row.loan_deduction ?? 0);
        if (deduction <= 0) continue;
        const { data: loans } = await supabase
          .from("loans")
          .select(
            "id, remaining_balance, outstanding_amount, installments_paid, paid_installments, total_paid, installments_total, total_installments",
          )
          .eq("employee_id", row.employee_id)
          .eq("status", "active");

        for (const loan of loans ?? []) {
          const remaining = Math.max(
            0,
            round2(Number(loan.outstanding_amount ?? loan.remaining_balance ?? 0) - deduction),
          );
          const paid = Number(loan.installments_paid ?? loan.paid_installments ?? 0) + 1;
          await supabase
            .from("loans")
            .update({
              remaining_balance: remaining,
              outstanding_amount: remaining,
              installments_paid: paid,
              paid_installments: paid,
              total_paid: round2(Number(loan.total_paid ?? 0) + deduction),
              status: remaining <= 0 ? "closed" : "active",
            })
            .eq("id", loan.id);
        }
      }
    }

    return { ok: true };
  });
