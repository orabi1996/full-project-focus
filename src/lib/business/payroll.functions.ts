import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateEmployeePayroll } from "../utils/payroll-calculator";
import { assertRole, round2 } from "./guards";
import { allocatePayrollLoans } from "./payroll-loans";
import { payrollPeriod, employeePeriodSalary } from "./payroll-period";
import type { PayrollCalculationBasis } from "../../types";

export interface RunPayrollInput {
  year: number;
  month: number; // 1-12
  payrollGroupId?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  departmentId?: string | null;
  jobCategory?: string | null;
  periodEndDate?: string | null;
  customDaysCount?: number | null;
  periodCalculationMode?: "full_month" | "custom_end_date" | "custom_days";
  selectedEmployeeIds?: string[] | null;
  runNotes?: string | null;
}

/**
 * Computes and persists a full payroll run from live database records.
 * Sensitive: role-checked server-side; the browser never decides eligibility.
 */
export const runPayrollServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RunPayrollInput) => {
    payrollPeriod(input);
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
  const period = payrollPeriod(data);
  const { year, month } = data;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of [data.payrollGroupId, data.branchId, data.departmentId, ...(data.selectedEmployeeIds ?? [])]) {
    if (id && id !== "all" && !uuid.test(id)) throw new Error("معرّف نطاق المسير غير صالح");
  }
  if (data.selectedEmployeeIds && data.selectedEmployeeIds.length === 0) {
    throw new Error("يجب اختيار موظف واحد على الأقل");
  }
  const groupId = data.payrollGroupId && data.payrollGroupId !== "all" ? data.payrollGroupId : null;
  let basis: PayrollCalculationBasis = "fixed_30_days";
  if (groupId) {
    const { data: group, error } = await supabase.from("payroll_groups")
      .select("calculation_basis").eq("id", groupId).single();
    if (error || !group) throw new Error(`تعذر قراءة مجموعة الرواتب: ${error?.message ?? "المجموعة غير موجودة"}`);
    basis = group.calculation_basis;
  }
  if (!["fixed_30_days", "calendar_days"].includes(basis)) {
    throw new Error("احتساب أيام العمل يتطلب جدول دوام معتمد؛ اختر سياسة مدعومة للمجموعة");
  }

  let query = supabase.from("employees")
    .select("id, company_id, basic_salary, nationality, hire_date, exit_date, status, payroll_group_id, metadata")
    .in("status", ["active", "on_leave", "terminated"])
    .lte("hire_date", period.end);
  if (groupId) query = query.eq("payroll_group_id", groupId);
  if (data.branchId && data.branchId !== "all") {
    query = query.or(`work_location_id.eq.${data.branchId},location_id.eq.${data.branchId}`);
  }
  if (data.departmentId && data.departmentId !== "all") query = query.eq("department_id", data.departmentId);
  if (data.selectedEmployeeIds) query = query.in("id", data.selectedEmployeeIds);
  if (data.jobCategory && data.jobCategory !== "all") query = query.eq("metadata->>jobCategory", data.jobCategory);
  const { data: rows, error: employeesError } = await query;
  if (employeesError) throw new Error(`تعذر قراءة الموظفين: ${employeesError.message}`);
  if ((rows ?? []).some((employee: any) => employee.status === "terminated" && !employee.exit_date)) {
    throw new Error("يجب تحديد تاريخ انتهاء الخدمة للموظف المنتهية خدمته قبل الاحتساب");
  }
  const employees = (rows ?? []).filter((employee: any) => !employee.exit_date || employee.exit_date >= period.start);
  if (!employees.length) throw new Error("لا يوجد موظفون مؤهلون لهذا المسير ضمن الفترة والنطاق المختارين");
  const companies = new Set(employees.map((employee: any) => employee.company_id));
  if (companies.size !== 1 || !employees[0].company_id) throw new Error("يجب أن يتبع موظفو المسير منشأة واحدة محددة");
  const companyId = employees[0].company_id;
  const employeeIds = employees.map((employee: any) => employee.id);
  const [salaryRes, attendanceRes, loanRes] = await Promise.all([
    supabase.from("salary_profiles").select("*").in("employee_id", employeeIds)
      .lte("effective_from", period.end).order("effective_from", { ascending: true }),
    supabase.from("attendance_records").select("employee_id, work_date, status, late_minutes, overtime_minutes")
      .in("employee_id", employeeIds).gte("work_date", period.start).lte("work_date", period.end),
    supabase.from("loans").select("id, employee_id, monthly_installment, remaining_balance")
      .in("employee_id", employeeIds).eq("status", "active"),
  ]);
  for (const result of [salaryRes, attendanceRes, loanRes]) {
    if (result.error) throw new Error(`تعذر قراءة مدخلات الرواتب: ${result.error.message}`);
  }
  const allocations = allocatePayrollLoans(loanRes.data ?? []);
  const runId = crypto.randomUUID();
  const details: Record<string, unknown>[] = [];
  for (const employee of employees) {
    const salary = employeePeriodSalary(period, employee,
      (salaryRes.data ?? []).filter((profile: any) => profile.employee_id === employee.id), basis);
    if (!salary) continue;
    const [basicSalary, housing, transport, other] = salary.nominal;
    const nationality = String(employee.nationality ?? "").trim().toUpperCase();
    if (!nationality) throw new Error("جنسية الموظف مطلوبة لتحديد استقطاع التأمينات");
    const isSaudi = ["SA", "SAU", "SAUDI", "SAUDI ARABIA", "السعودية", "سعودي", "سعودية"].includes(nationality);
    const scheme = employee.metadata?.gosi_scheme ?? "legacy";
    if (!["legacy", "new_1445"].includes(scheme)) throw new Error("نظام التأمينات المسجل للموظف غير صالح");
    const loanInstallment = round2(allocations.filter(item => item.employee_id === employee.id)
      .reduce((sum, item) => sum + item.amount, 0));
    const calculationInput = {
      basicSalary, housingAllowance: housing, transportAllowance: transport, otherAllowances: other,
      calculationBasis: basis, daysInMonth: period.days, isSaudiNational: isSaudi,
      gosiScheme: scheme as "legacy" | "new_1445", payrollDate: period.end,
    };
    const statutory = calculateEmployeePayroll(calculationInput);
    let absenceLate = 0;
    let overtime = 0;
    let overtimeHours = 0;
    let absentDays = 0;
    const seenDays = new Set<string>();
    for (const row of (attendanceRes.data ?? []).filter((item: any) => item.employee_id === employee.id)) {
      const amounts = salary.daily.get(row.work_date);
      if (!amounts) continue;
      if (seenDays.has(row.work_date)) throw new Error("توجد سجلات حضور مكررة للموظف في نفس اليوم");
      seenDays.add(row.work_date);
      const dayResult = calculateEmployeePayroll({ ...calculationInput,
        basicSalary: amounts[0], housingAllowance: amounts[1], transportAllowance: amounts[2], otherAllowances: amounts[3],
        absenceDays: row.status === "absent" ? 1 : 0,
        lateMinutes: Number(row.late_minutes ?? 0), overtimeHours: Number(row.overtime_minutes ?? 0) / 60,
      });
      absenceLate += dayResult.absenceDeduction + dayResult.lateDeduction;
      overtime += dayResult.overtimeAmount;
      overtimeHours += Number(row.overtime_minutes ?? 0) / 60;
      if (row.status === "absent") absentDays++;
    }
    const gross = round2(salary.earned.reduce((sum, amount) => sum + amount, 0) + overtime);
    const deductions = round2(absenceLate + statutory.gosiEmployee + loanInstallment);
    if (!Number.isFinite(gross) || !Number.isFinite(deductions) || deductions > gross) {
      throw new Error("الاستقطاعات تتجاوز المستحقات أو توجد قيم غير صالحة؛ راجع الموظف قبل الاحتساب");
    }
    details.push({
      payroll_run_id: runId, employee_id: employee.id,
      basic_salary: salary.earned[0], housing_allowance: salary.earned[1],
      transport_allowance: salary.earned[2], other_allowances: salary.earned[3],
      overtime_amount: round2(overtime), overtime_hours: round2(overtimeHours), bonus_amount: 0,
      gosi_employee_deduction: statutory.gosiEmployee, gosi_employer: statutory.gosiEmployer,
      loan_deduction: loanInstallment, absence_late_deduction: round2(absenceLate),
      unpaid_leave_deduction: 0, other_deductions: 0, total_deductions: deductions,
      gross_salary: gross, net_salary: round2(gross - deductions),
      working_days: salary.eligibleDays - absentDays, absent_days: absentDays,
      notes: JSON.stringify({ calculationBasis: basis, periodStart: period.start, periodEnd: period.end,
        eligibleDays: salary.eligibleDays, gosiScheme: scheme,
        salaryVersions: (salaryRes.data ?? []).filter((profile: any) => profile.employee_id === employee.id) }),
    });
  }
  const replaceAll = !data.selectedEmployeeIds && (!data.branchId || data.branchId === "all") &&
    (!data.departmentId || data.departmentId === "all") && (!data.jobCategory || data.jobCategory === "all");
  const { data: saved, error } = await supabase.rpc("save_payroll_run_atomic", {
    p_run: { id: runId, company_id: companyId, payroll_group_id: groupId,
      period_year: year, period_month: month, period_end: period.end, calculation_basis: basis,
      replace_all: replaceAll },
    p_details: details, p_allocations: allocations,
  });
  if (error) throw new Error(`تعذر حفظ المسير بالكامل: ${error.message}`);
  // Read the complete run totals after an atomic scope merge, including retained employees.
  const { data: run, error: readError } = await supabase.from("payroll_runs")
    .select("total_employees,total_net_salary,total_deductions,total_employer_gosi").eq("id", saved).single();
  if (readError) throw new Error(`تم حفظ المسير؛ تعذر قراءة الإجماليات: ${readError.message}`);
  return { runId: saved as string, employees: run.total_employees,
    totalNet: Number(run.total_net_salary), totalDeductions: Number(run.total_deductions),
    totalEmployerGosi: Number(run.total_employer_gosi) };
}

/**
 * Locks a payroll run. Payment requires a separate external-transfer confirmation.
 */
export const updatePayrollRunStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      runId: string;
      status: "draft" | "locked" | "paid" | "approved";
      note?: string;
      reason?: string;
    }) => {
      if (!input.runId) throw new Error("معرّف المسيّر مطلوب");
      if (!["draft", "locked", "paid", "approved"].includes(input.status)) {
        throw new Error("حالة غير صالحة");
      }
      return input;
    },
  )
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

    if (data.status === "draft") {
      throw new Error("إعادة فتح المسير تتطلب إجراء مراجعة موثق؛ لا يمكن تجاوز الإقفال");
    }
    const { error } = await supabase.rpc("set_payroll_run_status_atomic", {
      p_run_id: data.runId,
      p_status: data.status,
    });
    if (error) throw new Error(`تعذر تحديث حالة المسيّر: ${error.message}`);
    return { ok: true };
  });
