import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: () => vi.fn() };
  return { createServerFn: () => chain };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { computePayrollRun } from "../lib/business/payroll.functions";

const employeeId = "20000000-0000-0000-0000-000000000001";
const companyId = "10000000-0000-0000-0000-000000000001";
function database(employeeError = false) {
  const snapshots: any[] = [];
  const tables: Record<string, unknown> = {
    companies: { country: "SA", currency: "SAR" }, payroll_country_policies: [],
    employees: [{ id: employeeId, company_id: companyId, hire_date: "2026-04-16", basic_salary: 3000, nationality: "EG", status: "active" }],
    salary_profiles: [{ employee_id: employeeId, effective_from: "2026-04-16", basic_salary: 3000 }],
    attendance_records: [], loans: [],
    payroll_runs: { total_employees: 1, total_net_salary: 1500, total_deductions: 0, total_employer_gosi: 60 },
  };
  const from = vi.fn((table: string) => {
    const response = { data: tables[table], error: employeeError && table === "employees" ? { message: "read failed" } : null };
    const query: any = { then: (resolve: any) => Promise.resolve(response).then(resolve) };
    for (const method of ["select", "in", "lte", "gte", "eq", "or", "order", "range", "single"]) query[method] = () => query;
    return query;
  });
  const rpc = vi.fn(async (name: string, args: any) => {
    expect(name).toBe("save_payroll_run_atomic");
    snapshots.push(args);
    return { data: "40000000-0000-0000-0000-000000000001", error: null };
  });
  return { from, rpc, snapshots };
}

describe("payroll normal server entry", () => {
  it("uses identical calculation and persistence for filtered and unfiltered runs", async () => {
    const full = database();
    const filtered = database();
    await computePayrollRun(full, { year: 2026, month: 4 });
    await computePayrollRun(filtered, { year: 2026, month: 4, selectedEmployeeIds: [employeeId],
      branchId: "30000000-0000-0000-0000-000000000001" });
    const detail = (db: ReturnType<typeof database>) => {
      const { payroll_run_id, ...values } = db.snapshots[0].p_details[0];
      return values;
    };
    expect(detail(full)).toEqual(detail(filtered));
    expect(detail(full).basic_salary).toBe(1500);
    expect(full.snapshots[0].p_run.replace_all).toBe(true);
    expect(filtered.snapshots[0].p_run.replace_all).toBe(false);
  });
  it("previews the authoritative calculation without persisting a payroll run", async () => {
    const db = database();
    const result = await computePayrollRun(db, { year: 2026, month: 4 }, true);
    expect(result.totalNet).toBe(1500);
    expect(result.currency).toBe("SAR");
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid periods before querying or writing", async () => {
    const db = database();
    await expect(computePayrollRun(db, { year: 2026, month: 4, periodCalculationMode: "custom_days", customDaysCount: 31 })).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("propagates database failures without switching engines or saving", async () => {
    const db = database(true);
    await expect(computePayrollRun(db, { year: 2026, month: 4 })).rejects.toThrow("read failed");
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
