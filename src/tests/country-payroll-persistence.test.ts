import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";

const db = new PGlite();
const company = "10000000-0000-0000-0000-000000000001";
const employee = "20000000-0000-0000-0000-000000000001";
const runId = "40000000-0000-0000-0000-000000000001";
const policy = { name: "Synthetic company policy", effectiveFrom: "2026-01-01", effectiveTo: null,
  sourceUrl: "https://example.com/test", monthlyHours: 240, overtimeWageMultiplier: 1, overtimeBasicPremium: 0,
  schemes: [{ code: "national", name: "Synthetic national", citizenship: "national", contributions: [
    { name: "Fund", basis: "gross", minimum: 0, maximum: null, employeeRate: 0.1, employerRate: 0.2 },
  ] }], tax: { enabled: false, annualExemption: 0, brackets: [] } };
let policyId: string;
const detail = { employee_id: employee, basic_salary: 100.125, housing_allowance: 0, transport_allowance: 0,
  other_allowances: 0, overtime_amount: 0, overtime_hours: 0, bonus_amount: 0, gosi_employee_deduction: 0,
  gosi_employer: 0, loan_deduction: 0, absence_late_deduction: 0, unpaid_leave_deduction: 0,
  other_deductions: 0, gross_salary: 100.125, total_deductions: 0, net_salary: 100.125,
  working_days: 30, absent_days: 0, income_tax: 0 };
const run = () => ({ id: runId, company_id: company, payroll_group_id: null, period_year: 2026, period_month: 4,
  period_end: "2026-04-30", calculation_basis: "fixed_30_days", currency: "AED", country_code: "AE",
  country_policy_id: policyId, country_policy_snapshot: policy, replace_all: true });
const save = (input = run()) => db.query("select save_payroll_run_atomic($1,$2,'[]'::jsonb)", [JSON.stringify(input), JSON.stringify([detail])]);
const savePolicy = (input = policy, activate = true, code = "AE") => db.query<{id:string}>(
  "select save_country_payroll_policy($1,$2,$3,$4) id", [company, code, JSON.stringify(input), activate]);

describe.sequential("country-policy database lifecycle and persistence", () => {
  beforeAll(async () => {
    await db.exec(fs.readFileSync("src/tests/fixtures/payroll-db.sql", "utf8"));
    await db.exec(`CREATE ROLE anon; CREATE SCHEMA private_sec;
      CREATE TABLE companies(id uuid PRIMARY KEY,country text,currency text);
      CREATE TABLE user_roles(user_id uuid,role text);
      CREATE TABLE payroll_groups(id uuid PRIMARY KEY);
      CREATE TABLE salary_profiles(employee_id uuid,basic_salary numeric(12,2));
      CREATE TABLE attendance_records(employee_id uuid);
      ALTER TABLE employees ADD COLUMN company_id uuid, ADD COLUMN payroll_group_id uuid, ADD COLUMN basic_salary numeric(12,2);
      CREATE FUNCTION can_access_core_company(id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT id='${company}'::uuid $$;
      INSERT INTO companies VALUES('${company}','الإمارات العربية المتحدة','AED');
      INSERT INTO employees(id,company_id) VALUES('${employee}','${company}');
      INSERT INTO user_roles VALUES('00000000-0000-0000-0000-000000000001','org_admin');`);
    await db.exec(fs.readFileSync("drizzle/migrations/0011_restore_scoped_payroll_persistence.sql", "utf8"));
    await db.exec(fs.readFileSync("drizzle/migrations/0012_country_payroll_policies.sql", "utf8"));
  });
  afterAll(() => db.close());
  it("requires a country policy and rejects a forged Saudi fallback", async () => {
    await expect(save({ ...run(), country_policy_id: null as any, country_policy_snapshot: null as any })).rejects.toThrow();
    await expect(save({ ...run(), country_code: "SA", currency: "SAR" })).rejects.toThrow();
  });
  it("records draft and approved versions with a protected approver", async () => {
    await savePolicy(policy, false);
    policyId = (await savePolicy()).rows[0].id;
    const result = await db.query<{approved_by:string}>("select approved_by from payroll_country_policies where id=$1", [policyId]);
    expect(result.rows[0].approved_by).toBe("00000000-0000-0000-0000-000000000001");
    await expect(savePolicy()).rejects.toThrow();
  });
  it("widens stored money and preserves currency precision through the atomic save", async () => {
    // AED is two decimals. Use exact cents here, then test the three-decimal currency below.
    const rounded = { ...detail, basic_salary: 100.12, gross_salary: 100.12, net_salary: 100.12 };
    await db.query("select save_payroll_run_atomic($1,$2,'[]'::jsonb)", [JSON.stringify(run()), JSON.stringify([rounded])]);
    const scale = await db.query<{numeric_scale:number}>("select numeric_scale from information_schema.columns where table_name='salary_profiles' and column_name='basic_salary'");
    expect(scale.rows[0].numeric_scale).toBe(3);
  });
  it("rejects mismatched rule snapshots", async () => {
    await expect(save({ ...run(), country_policy_snapshot: { ...policy, monthlyHours: 100 } })).rejects.toThrow();
  });
  it("closes the previous interval while retaining the saved payroll snapshot", async () => {
    await savePolicy({ ...policy, name: "Next version", effectiveFrom: "2026-05-01" });
    const old = await db.query<{policy:any}>("select policy from payroll_country_policies where id=$1", [policyId]);
    expect(old.rows[0].policy.effectiveTo).toBe("2026-04-30");
    const saved = await db.query<{country_policy_snapshot:any}>("select country_policy_snapshot from payroll_runs where id=$1", [runId]);
    expect(saved.rows[0].country_policy_snapshot.name).toBe(policy.name);
    expect(saved.rows[0].country_policy_snapshot.effectiveTo).toBeNull();
  });
  it("applies three-decimal arithmetic for OMR without Saudi calculations", async () => {
    await db.exec(`UPDATE companies SET country='OM',currency='OMR' WHERE id='${company}'`);
    const omId = (await savePolicy(policy, true, "OM")).rows[0].id;
    const input = { ...run(), id: "40000000-0000-0000-0000-000000000002", period_month: 6,
      period_end: "2026-06-30", country_code: "OM", currency: "OMR", country_policy_id: omId };
    await db.query("select save_payroll_run_atomic($1,$2,'[]'::jsonb)", [JSON.stringify(input), JSON.stringify([detail])]);
    const saved = await db.query<{net_salary:string}>("select net_salary from payroll_details where payroll_run_id=$1", [input.id]);
    expect(Number(saved.rows[0].net_salary)).toBe(100.125);
  });
  it("protects the country snapshot after locking the run", async () => {
    const id = "40000000-0000-0000-0000-000000000002";
    await db.query("select set_payroll_run_status_atomic($1,'locked')", [id]);
    await expect(db.query("update payroll_runs set currency='SAR' where id=$1", [id])).rejects.toThrow();
  });
  it("rejects invalid rates, unauthorized callers and direct access to the private core", async () => {
    const invalid = structuredClone(policy); invalid.schemes[0].contributions[0].employeeRate = -0.1;
    await expect(savePolicy(invalid, false, "OM")).rejects.toThrow();
    await db.exec("UPDATE user_roles SET role='employee'");
    await expect(savePolicy(policy, false, "OM")).rejects.toThrow();
    const permissions = await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','private_sec.save_payroll_run_core_v1(jsonb,jsonb,jsonb)','EXECUTE') allowed");
    expect(permissions.rows[0].allowed).toBe(false);
  });
});
