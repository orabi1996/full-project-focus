import { describe, it, expect } from "vitest";
import { validateImportRows, normalizeRowKeys } from "../lib/business/employee-import-rules";

const base = { employee_no: "A1", full_name: "علي", job_title: "محاسب", hire_date: "2026-01-01", basic_salary: 5000 };

describe("employee excel import rules", () => {
  it("accepts a complete row with Arabic headers", () => {
    const r = validateImportRows([normalizeRowKeys({ "الرقم الوظيفي *": "A1", "الاسم الكامل": "علي", "المسمى الوظيفي": "محاسب", "تاريخ التعيين": "01/02/2026", "الراتب الأساسي": "٥٠٠٠" })]);
    expect(r.valid[0].record.hire_date).toBe("2026-02-01");
    expect(r.valid[0].record.basic_salary).toBe(5000);
  });
  it("rejects duplicate employee numbers in file and in system", () => {
    const r = validateImportRows([base, base, { ...base, employee_no: "OLD" }], { existingNos: new Set(["OLD"]) });
    expect(r.valid).toHaveLength(1);
    expect(r.errors).toHaveLength(2);
  });
  it("rejects invalid national id and IBAN", () => {
    const r = validateImportRows([{ ...base, national_id_or_iqama: "3123", iban: "SA12" }]);
    expect(r.valid).toHaveLength(0);
  });
});
