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

export interface SalaryProfileRowInput {
  employeeRef: string; // employee_no or uuid
  effectiveFrom: string; // YYYY-MM-DD
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  gosiRegistered?: boolean;
  notes?: string | null;
}

/** Latest salary profile per employee — the real salary basis used by payroll. */
export const listSalaryProfilesServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...PAYROLL_ROLES]);

    const { data, error } = await supabase
      .from("salary_profiles")
      .select(
        "id, employee_id, effective_from, basic_salary, housing_allowance, transport_allowance, other_allowances, gosi_registered, notes, employees(full_name, employee_no, department_id)",
      )
      .order("effective_from", { ascending: false });
    if (error) throw new Error(`تعذر قراءة ملفات الرواتب: ${error.message}`);

    const latest = new Map<string, any>();
    for (const row of data ?? []) {
      if (!latest.has(row.employee_id)) latest.set(row.employee_id, row);
    }

    return Array.from(latest.values()).map((row: any) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employees?.full_name ?? "—",
      employeeNo: row.employees?.employee_no ?? "—",
      departmentId: row.employees?.department_id ?? null,
      effectiveFrom: row.effective_from,
      basicSalary: Number(row.basic_salary ?? 0),
      housingAllowance: Number(row.housing_allowance ?? 0),
      transportAllowance: Number(row.transport_allowance ?? 0),
      otherAllowances: Number(row.other_allowances ?? 0),
      gosiRegistered: row.gosi_registered !== false,
      notes: row.notes ?? null,
    }));
  });

/**
 * Bulk-imports real salary files (uploaded CSV/manual rows) into salary_profiles
 * and syncs the employee card totals so payroll stops using default salaries.
 */
export const upsertSalaryProfilesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: SalaryProfileRowInput[] }) => {
    if (!Array.isArray(input?.rows) || input.rows.length === 0) {
      throw new Error("لا توجد صفوف رواتب للرفع");
    }
    if (input.rows.length > 2000) throw new Error("عدد الصفوف كبير جدًا");
    for (const row of input.rows) {
      if (!row.employeeRef?.trim()) throw new Error("الرقم الوظيفي مطلوب في كل صف");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveFrom)) {
        throw new Error(`تاريخ سريان غير صالح للموظف ${row.employeeRef}`);
      }
      if (!Number.isFinite(row.basicSalary) || row.basicSalary <= 0) {
        throw new Error(`الراتب الأساسي غير صالح للموظف ${row.employeeRef}`);
      }
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...PAYROLL_ROLES]);

    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, employee_no");
    if (empError) throw new Error(`تعذر قراءة الموظفين: ${empError.message}`);

    const byNo = new Map<string, string>();
    const byId = new Set<string>();
    for (const employee of employees ?? []) {
      byNo.set(String(employee.employee_no).trim(), employee.id);
      byId.add(employee.id);
    }

    const inserts: Record<string, unknown>[] = [];
    const skipped: string[] = [];

    for (const row of data.rows) {
      const ref = row.employeeRef.trim();
      const employeeId = byId.has(ref) ? ref : byNo.get(ref);
      if (!employeeId) {
        skipped.push(ref);
        continue;
      }
      inserts.push({
        employee_id: employeeId,
        effective_from: row.effectiveFrom,
        basic_salary: round2(Number(row.basicSalary)),
        housing_allowance: round2(Number(row.housingAllowance ?? 0)),
        transport_allowance: round2(Number(row.transportAllowance ?? 0)),
        other_allowances: round2(Number(row.otherAllowances ?? 0)),
        gosi_registered: row.gosiRegistered !== false,
        notes: row.notes ?? "مرفوع من ملف الرواتب",
        created_by: context.userId,
      });
    }

    if (!inserts.length) throw new Error("لم يتم مطابقة أي موظف مع الصفوف المرفوعة");

    const { error } = await supabase.from("salary_profiles").insert(inserts);
    if (error) throw new Error(`تعذر حفظ ملفات الرواتب: ${error.message}`);

    for (const row of inserts) {
      const basic = Number(row['basic_salary']);
      const total = round2(
        basic +
          Number(row['housing_allowance']) +
          Number(row['transport_allowance']) +
          Number(row['other_allowances']),
      );
      await supabase
        .from("employees")
        .update({ basic_salary: basic, total_salary: total })
        .eq("id", row['employee_id'] as string);
    }

    return { imported: inserts.length, skipped };
  });
