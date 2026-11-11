/**
 * Bulk employee import from Excel — HR-only.
 * Rows are parsed in the browser; validation and insert happen here.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "../../integrations/supabase/auth-middleware";
import { assertRole } from "./guards";
import { validateImportRows, type ImportRowInput } from "./employee-import-rules";

export const importEmployeesFromExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: ImportRowInput[] }) => {
    if (!Array.isArray(input?.rows) || input.rows.length === 0) throw new Error("الملف لا يحتوي على صفوف");
    if (input.rows.length > 2000) throw new Error("الحد الأقصى 2000 موظف في الملف الواحد");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["super_admin", "org_admin", "hr_manager"]);

    const [{ data: existing }, { data: depts }] = await Promise.all([
      supabase.from("employees").select("employee_no, national_id_or_iqama").limit(10000),
      supabase.from("departments").select("id, name"),
    ]);
    const deptMap = new Map<string, string>();
    for (const d of (depts ?? []) as { id: string; name: string }[]) deptMap.set(d.name.trim().toLowerCase(), d.id);

    const { valid, errors } = validateImportRows(data.rows, {
      existingNos: new Set((existing ?? []).map((e: any) => String(e.employee_no))),
      existingIds: new Set((existing ?? []).map((e: any) => e.national_id_or_iqama).filter(Boolean)),
    });

    const records = valid.map((r) => ({
      ...r.record,
      department_id: r.department ? deptMap.get(r.department.toLowerCase()) ?? null : null,
      created_by: userId,
    }));

    let inserted = 0;
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const { error } = await supabase.from("employees").insert(chunk as any);
      if (error) {
        errors.push({ row: 0, message: `تعذر حفظ دفعة (${i + 1}-${i + chunk.length}): ${error.message}` });
      } else inserted += chunk.length;
    }
    return { inserted, failed: data.rows.length - inserted, errors: errors.slice(0, 200) };
  });
