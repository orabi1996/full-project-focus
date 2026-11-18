import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateEmployeePayroll } from "../utils/payroll-calculator";
import { assertRole, round2 as roundMoney } from "./guards";
import { readPayrollRows, readPayrollEmployeeRows } from "./payroll-data";
import { allocatePayrollLoans } from "./payroll-loans";
import { payrollPeriod, employeePeriodSalary } from "./payroll-period";
import { payrollCountry, isNationalOf, requiresGccRegime, resolveCountryPayrollPolicy, countryPayrollCharges, COUNTRY_PACK_CATALOG } from "./payroll-country";
import type { PayrollCalculationBasis } from "../../types";

export interface RunPayrollInput {
  companyId?: string;
  replaceAll?: boolean;
  calculationBasis?: PayrollCalculationBasis;
  schemeOverrides?: Record<string, string>;
  registeredWages?: Record<string, number>;
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
export async function computePayrollRun(supabase: any, data: RunPayrollInput, previewOnly = false) {
  const period = payrollPeriod(data);
  const { year, month } = data;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of [data.companyId, data.payrollGroupId, data.branchId, data.departmentId, ...(data.selectedEmployeeIds ?? [])]) {
    if (id && id !== "all" && !uuid.test(id)) throw new Error("معرّف نطاق المسير غير صالح");
  }
  if (data.selectedEmployeeIds && data.selectedEmployeeIds.length === 0) {
    throw new Error("يجب اختيار موظف واحد على الأقل");
  }
  for (const overrides of [data.schemeOverrides, data.registeredWages]) {
    if (overrides !== undefined && (!overrides || typeof overrides !== "object" || Array.isArray(overrides) || Object.keys(overrides).length > 10000)) {
      throw new Error("اختيارات أنظمة الموظفين غير صالحة");
    }
    for (const id of Object.keys(overrides ?? {})) if (!uuid.test(id)) throw new Error("معرّف الموظف في الاختيارات غير صالح");
  }
  for (const value of Object.values(data.registeredWages ?? {})) if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("أجر اشتراك غير صالح");
  for (const value of Object.values(data.schemeOverrides ?? {})) if (typeof value !== "string" || value.length > 50) throw new Error("رمز اشتراك غير صالح");
  if (data.replaceAll !== undefined && typeof data.replaceAll !== "boolean") throw new Error("طريقة حفظ المسير غير صالحة");
  const groupId = data.payrollGroupId && data.payrollGroupId !== "all" ? data.payrollGroupId : null;
  let groupCurrency: string | undefined;
  let basis: PayrollCalculationBasis = data.calculationBasis ?? "fixed_30_days";
  if (groupId) {
    const { data: group, error } = await supabase.from("payroll_groups")
      .select("calculation_basis,currency").eq("id", groupId).single();
    if (error || !group) throw new Error(`تعذر قراءة مجموعة الرواتب: ${error?.message ?? "المجموعة غير موجودة"}`);
    if (data.calculationBasis && data.calculationBasis !== group.calculation_basis) throw new Error("أساس الحساب لا يطابق مجموعة الرواتب");
    basis = group.calculation_basis;
    groupCurrency = group.currency;
  }
  if (!["fixed_30_days", "calendar_days"].includes(basis)) {
    throw new Error("احتساب أيام العمل يتطلب جدول دوام معتمد؛ اختر سياسة مدعومة للمجموعة");
  }

  const buildEmployeeQuery = (ids?: string[]) => {
  let query = supabase.from("employees")
    .select("id, employee_no, full_name, company_id, basic_salary, nationality, hire_date, exit_date, status, payroll_group_id, metadata")
    .in("status", ["active", "on_leave", "terminated"])
    .lte("hire_date", period.end);
  if (data.companyId) query = query.eq("company_id", data.companyId);
  if (groupId) query = query.eq("payroll_group_id", groupId);
  if (data.branchId && data.branchId !== "all") {
    query = query.or(`work_location_id.eq.${data.branchId},location_id.eq.${data.branchId}`);
  }
  if (data.departmentId && data.departmentId !== "all") query = query.eq("department_id", data.departmentId);
  if (ids) query = query.in("id", ids);
  if (data.jobCategory && data.jobCategory !== "all") query = query.eq("metadata->>jobCategory", data.jobCategory);
  return query;
  };
  if (data.selectedEmployeeIds && new Set(data.selectedEmployeeIds).size !== data.selectedEmployeeIds.length) throw new Error("الموظف مكرر في الاختيارات");
  const rows = data.selectedEmployeeIds
    ? await readPayrollEmployeeRows<any>(data.selectedEmployeeIds, buildEmployeeQuery, "تعذر قراءة الموظفين")
    : await readPayrollRows<any>(() => buildEmployeeQuery(), "تعذر قراءة الموظفين");
  if ((rows ?? []).some((employee: any) => employee.status === "terminated" && !employee.exit_date)) {
    throw new Error("يجب تحديد تاريخ انتهاء الخدمة للموظف المنتهية خدمته قبل الاحتساب");
  }
  const employees = (rows ?? []).filter((employee: any) => !employee.exit_date || employee.exit_date >= period.start);
  if (!employees.length) throw new Error("لا يوجد موظفون مؤهلون لهذا المسير ضمن الفترة والنطاق المختارين");
  const companies = new Set(employees.map((employee: any) => employee.company_id));
  if (companies.size !== 1 || !employees[0].company_id) throw new Error("يجب أن يتبع موظفو المسير منشأة واحدة محددة");
  const companyId = employees[0].company_id;
  const { data: company, error: companyError } = await supabase.from("companies")
    .select("country,currency").eq("id", companyId).single();
  if (companyError || !company) throw new Error("تعذر قراءة دولة المنشأة وعملتها");
  const country = payrollCountry(company.country);
  const pack = COUNTRY_PACK_CATALOG[country];
  if (company.currency !== pack.currencyCode) throw new Error("عملة المنشأة لا تطابق عملة حزمة الدولة؛ راجع إعدادات المنشأة");
  if (groupCurrency && groupCurrency !== pack.currencyCode) throw new Error("عملة مجموعة الرواتب لا تطابق دولة المنشأة؛ حدّث المجموعة أولًا");
  const policies = await readPayrollRows<any>(() => supabase.from("payroll_country_policies")
    .select("*").eq("company_id", companyId).eq("country_code", country), "تعذر قراءة سياسة الدولة");
  const policyRecord = resolveCountryPayrollPolicy(policies ?? [], country, period.start, period.end);
  const policy = policyRecord?.policy;
  const round2 = (value: number) => roundMoney(value, pack.decimalPrecision);
  const replaceAll = data.replaceAll ?? (!data.selectedEmployeeIds && (!data.branchId || data.branchId === "all") &&
    (!data.departmentId || data.departmentId === "all") && (!data.jobCategory || data.jobCategory === "all"));
  let existingQuery = supabase.from("payroll_runs")
    .select("id,status,period_end,calculation_basis,currency,country_policy_id")
    .eq("company_id", companyId).eq("period_year", year).eq("period_month", month);
  existingQuery = groupId ? existingQuery.eq("payroll_group_id", groupId) : existingQuery.is("payroll_group_id", null);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw new Error(`تعذر التحقق من المسير السابق: ${existingError.message}`);
  if (existing?.id) {
    if (existing.status !== "draft") throw new Error("المسير مقفل أو معتمد؛ لا يمكن إعادة احتسابه");
    if (!replaceAll && (existing.period_end !== period.end || existing.calculation_basis !== basis ||
        (existing.currency && existing.currency !== pack.currencyCode) ||
        (existing.country_policy_id ?? null) !== (policyRecord?.id ?? null))) {
      throw new Error("اختر إعادة بناء مسودة المسير عند تغيير الفترة أو سياسة الحساب");
    }
  }
  const employeeIds = employees.map((employee: any) => employee.id);
  const [salaryRows, attendanceRows, loanRows] = await Promise.all([
    readPayrollEmployeeRows<any>(employeeIds, ids => supabase.from("salary_profiles").select("*").in("employee_id", ids)
      .lte("effective_from", period.end), "تعذر قراءة الرواتب"),
    readPayrollEmployeeRows<any>(employeeIds, ids => supabase.from("attendance_records").select("id,employee_id,work_date,status,late_minutes,overtime_minutes")
      .in("employee_id", ids).gte("work_date", period.start).lte("work_date", period.end), "تعذر قراءة الحضور"),
    readPayrollEmployeeRows<any>(employeeIds, ids => supabase.from("loans").select("id,employee_id,monthly_installment,remaining_balance")
      .in("employee_id", ids).eq("status", "active"), "تعذر قراءة السلف"),
  ]);
  const salaryByEmployee = new Map<string, any[]>();
  const attendanceByEmployee = new Map<string, any[]>();
  for (const row of salaryRows) {
    const values = salaryByEmployee.get(row.employee_id) ?? [];
    values.push(row); salaryByEmployee.set(row.employee_id, values);
  }
  for (const row of attendanceRows) {
    const values = attendanceByEmployee.get(row.employee_id) ?? [];
    values.push(row); attendanceByEmployee.set(row.employee_id, values);
  }
  const allocations = allocatePayrollLoans(loanRows, pack.decimalPrecision);
  const runId = crypto.randomUUID();
  const details: Record<string, unknown>[] = [];
  for (const employee of employees) {
    try {
      const salary = employeePeriodSalary(period, employee,
        (salaryByEmployee.get(employee.id) ?? []), basis, pack.decimalPrecision);
      if (!salary) continue;
      const [basicSalary, housing, transport, other] = salary.nominal;
      const nationality = String(employee.nationality ?? "").trim().toUpperCase();
      if (!nationality) throw new Error("جنسية الموظف مطلوبة لتحديد استقطاع التأمينات");
      const isSaudi = isNationalOf(nationality, "SA");
      if (!policy && requiresGccRegime(nationality, country)) throw new Error("يلزم اعتماد سياسة مد الحماية التأمينية للموظف الخليجي قبل الاحتساب");
      const scheme = data.schemeOverrides?.[employee.id] || employee.metadata?.gosi_scheme || "legacy";
      if (!policy && !["legacy", "new_1445"].includes(scheme)) throw new Error("نظام التأمينات المسجل للموظف غير صالح");
      const loanInstallment = round2(allocations.filter(item => item.employee_id === employee.id)
        .reduce((sum, item) => sum + item.amount, 0));
      const calculationInput = {
        basicSalary, housingAllowance: housing, transportAllowance: transport, otherAllowances: other,
        calculationBasis: basis, daysInMonth: period.days, isSaudiNational: isSaudi,
        gosiScheme: scheme as "legacy" | "new_1445", payrollDate: period.end,
      };
      const statutory = policy ? null : calculateEmployeePayroll(calculationInput);
      let absenceLate = 0;
      let overtime = 0;
      let overtimeHours = 0;
      let absentDays = 0;
      const seenDays = new Set<string>();
      for (const row of (attendanceByEmployee.get(employee.id) ?? [])) {
        const amounts = salary.daily.get(row.work_date);
        if (!amounts) continue;
        if (seenDays.has(row.work_date)) throw new Error("توجد سجلات حضور مكررة للموظف في نفس اليوم");
        seenDays.add(row.work_date);
        if (policy) {
          const dayWage = amounts.reduce((sum, amount) => sum + amount, 0);
          const hours = Number(row.overtime_minutes ?? 0) / 60;
          const late = Number(row.late_minutes ?? 0);
          if (![hours, late].every(value => Number.isFinite(value) && value >= 0)) throw new Error("قيم حضور غير صالحة");
          absenceLate += round2((row.status === "absent" ? dayWage / (basis === "fixed_30_days" ? 30 : period.days) : 0) +
            dayWage / policy.monthlyHours / 60 * late);
          overtime += round2((dayWage / policy.monthlyHours * policy.overtimeWageMultiplier +
            amounts[0] / policy.monthlyHours * policy.overtimeBasicPremium) * hours);
        } else {
        const dayResult = calculateEmployeePayroll({ ...calculationInput,
          basicSalary: amounts[0], housingAllowance: amounts[1], transportAllowance: amounts[2], otherAllowances: amounts[3],
          absenceDays: row.status === "absent" ? 1 : 0,
          lateMinutes: Number(row.late_minutes ?? 0), overtimeHours: Number(row.overtime_minutes ?? 0) / 60,
        });
          absenceLate += dayResult.absenceDeduction + dayResult.lateDeduction;
          overtime += dayResult.overtimeAmount;
        }
        overtimeHours += Number(row.overtime_minutes ?? 0) / 60;
        if (row.status === "absent") absentDays++;
      }
      const gross = round2(salary.earned.reduce((sum, amount) => sum + amount, 0) + overtime);
      const charges = policy ? countryPayrollCharges(policy, country, {
        nationality, schemeCode: data.schemeOverrides?.[employee.id] || employee.metadata?.payroll_scheme, nominal: salary.nominal,
        registeredWage: data.registeredWages?.[employee.id] ?? (employee.metadata?.registered_insurance_wage == null ? undefined : Number(employee.metadata.registered_insurance_wage)),
        taxableGross: Math.max(0, gross - absenceLate),
      }) : { employee: statutory!.gosiEmployee, employer: statutory!.gosiEmployer, tax: 0, scheme, breakdown: [] };
      const deductions = round2(absenceLate + charges.employee + charges.tax + loanInstallment);
      if (!Number.isFinite(gross) || !Number.isFinite(deductions) || deductions > gross) {
        throw new Error("الاستقطاعات تتجاوز المستحقات أو توجد قيم غير صالحة؛ راجع الموظف قبل الاحتساب");
      }
      details.push({
        payroll_run_id: runId, employee_id: employee.id,
        basic_salary: salary.earned[0], housing_allowance: salary.earned[1],
        transport_allowance: salary.earned[2], other_allowances: salary.earned[3],
        overtime_amount: round2(overtime), overtime_hours: round2(overtimeHours), bonus_amount: 0,
        gosi_employee_deduction: charges.employee, gosi_employer: charges.employer,
        loan_deduction: loanInstallment, absence_late_deduction: round2(absenceLate),
        unpaid_leave_deduction: 0, other_deductions: charges.tax, income_tax: charges.tax, total_deductions: deductions,
        gross_salary: gross, net_salary: round2(gross - deductions),
        working_days: salary.eligibleDays - absentDays, absent_days: absentDays,
        notes: JSON.stringify({ calculationBasis: basis, periodStart: period.start, periodEnd: period.end,
          eligibleDays: salary.eligibleDays, gosiScheme: charges.scheme, country, currency: pack.currencyCode,
          policyId: policyRecord?.id ?? "SA-legacy", policy: policy ?? null, statutoryBreakdown: charges.breakdown,
          salaryVersions: (salaryByEmployee.get(employee.id) ?? []) }),
      });
    } catch (cause) {
      throw new Error(`الموظف ${employee.employee_no || employee.id} — ${cause instanceof Error ? cause.message : "تعذر الاحتساب"}`);
    }
  }

  const summary = { excludedEmployees: Math.max(0, (data.selectedEmployeeIds?.length ?? rows.length) - details.length), country, currency: pack.currencyCode, policyVersion: policy?.name ?? "السعودية — الإعداد الحالي",
    employees: details.length,
    totalNet: round2(details.reduce((sum, row) => sum + Number(row.net_salary), 0)),
    totalDeductions: round2(details.reduce((sum, row) => sum + Number(row.total_deductions), 0)),
    totalEmployerGosi: round2(details.reduce((sum, row) => sum + Number(row.gosi_employer), 0)),
    totalTax: round2(details.reduce((sum, row) => sum + Number(row.income_tax), 0)) };
  if (previewOnly) return { runId: "", ...summary };
  const { data: saved, error } = await supabase.rpc("save_payroll_run_atomic", {
    p_run: { id: runId, company_id: companyId, payroll_group_id: groupId,
      period_year: year, period_month: month, period_end: period.end, calculation_basis: basis,
      replace_all: replaceAll, country_code: country, currency: pack.currencyCode,
      country_policy_id: policyRecord?.id ?? null, country_policy_snapshot: policy ?? null },
    p_details: details, p_allocations: allocations,
  });
  if (error) throw new Error(`تعذر حفظ المسير بالكامل: ${error.message}`);
  // Read the complete run totals after an atomic scope merge, including retained employees.
  const { data: run, error: readError } = await supabase.from("payroll_runs")
    .select("total_employees,total_net_salary,total_deductions,total_employer_gosi").eq("id", saved).single();
  if (readError) throw new Error(`تم حفظ المسير؛ تعذر قراءة الإجماليات: ${readError.message}`);
  return { ...summary, runId: saved as string, employees: run.total_employees,
    totalNet: Number(run.total_net_salary), totalDeductions: Number(run.total_deductions),
    totalEmployerGosi: Number(run.total_employer_gosi) };
}

export const previewPayrollServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RunPayrollInput) => { payrollPeriod(input); return input; })
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase as any, context.userId, ["super_admin", "org_admin", "hr_manager", "payroll_officer", "finance_officer"]);
    return computePayrollRun(context.supabase as any, data, true);
  });

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
