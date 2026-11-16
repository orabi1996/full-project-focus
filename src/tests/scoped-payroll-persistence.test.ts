import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const company = "10000000-0000-0000-0000-000000000001";
const employee = "20000000-0000-0000-0000-000000000001";
const secondEmployee = "20000000-0000-0000-0000-000000000002";
const user = "00000000-0000-0000-0000-000000000001";
const group = "30000000-0000-0000-0000-000000000001";
const otherGroup = "30000000-0000-0000-0000-000000000002";
const runId = "40000000-0000-0000-0000-000000000001";
const db = new PGlite();
const run = { id: runId, company_id: company, payroll_group_id: group, period_year: 2026, period_month: 4,
  period_end: "2026-04-30", calculation_basis: "fixed_30_days", replace_all: false };
const detail = (id = employee, amount = 3000) => ({ employee_id: id, basic_salary: amount,
  housing_allowance: 0, transport_allowance: 0, other_allowances: 0, overtime_hours: 0,
  overtime_amount: 0, bonus_amount: 0, unpaid_leave_deduction: 0, absence_late_deduction: 0,
  loan_deduction: 0, gosi_employee_deduction: 0, gosi_employer: 0, other_deductions: 0,
  gross_salary: amount, total_deductions: 0, net_salary: amount, working_days: 30, absent_days: 0 });
const save = (details: unknown[], input = run) => db.query("select save_payroll_run_atomic($1,$2,'[]'::jsonb) id", [JSON.stringify(input), JSON.stringify(details)]);

describe.sequential("atomic scoped payroll persistence on the production legacy schema", () => {
  beforeAll(async () => {
    await db.exec(fs.readFileSync(path.resolve("src/tests/fixtures/payroll-db.sql"), "utf8"));
    await db.exec(`CREATE ROLE anon; CREATE SCHEMA private_sec;
      CREATE TABLE companies(id uuid PRIMARY KEY);
      CREATE TABLE user_roles(user_id uuid,role text);
      CREATE TABLE payroll_groups(id uuid PRIMARY KEY);
      CREATE TABLE salary_profiles(employee_id uuid);
      CREATE TABLE attendance_records(employee_id uuid);
      ALTER TABLE employees ADD COLUMN company_id uuid, ADD COLUMN payroll_group_id uuid;
      ALTER TABLE payroll_details ADD COLUMN notes text;
      CREATE FUNCTION can_access_core_company(id uuid) RETURNS boolean LANGUAGE sql AS $$
        SELECT coalesce(current_setting('test.company',true),'${company}')=id::text $$;
      INSERT INTO companies VALUES('${company}');
      INSERT INTO user_roles VALUES('${user}','org_admin');
      INSERT INTO payroll_groups VALUES('${group}'),('${otherGroup}');
      INSERT INTO employees(id,company_id,payroll_group_id) VALUES
        ('${employee}','${company}','${group}'),('${secondEmployee}','${company}','${group}');`);
    await db.exec(fs.readFileSync(path.resolve("drizzle/migrations/0011_restore_scoped_payroll_persistence.sql"), "utf8"));
  });
  afterAll(() => db.close());

  it("merges filtered employees, preserves prior employees, and retries without duplication", async () => {
    await save([detail()]);
    await save([detail(secondEmployee)]);
    await save([detail(employee, 3500)]);
    const result = await db.query<{total_employees:number;total_net_salary:string}>("SELECT total_employees,total_net_salary FROM payroll_runs");
    expect(result.rows[0].total_employees).toBe(2);
    expect(Number(result.rows[0].total_net_salary)).toBe(6500);
    expect((await db.query("select * from payroll_runs")).rows).toHaveLength(1);
  });
  it("rolls back the whole replacement when a later detail is invalid", async () => {
    await expect(save([detail(employee, 1000), { ...detail(secondEmployee), net_salary: -1 }])).rejects.toThrow();
    expect(Number((await db.query<{net_salary:string}>("select net_salary from payroll_details where employee_id=$1", [employee])).rows[0].net_salary)).toBe(3500);
  });
  it("rejects duplicate employees and cross-company input", async () => {
    await expect(save([detail(), detail()])).rejects.toThrow();
    await expect(save([detail()], { ...run, company_id: "10000000-0000-0000-0000-000000000002" })).rejects.toThrow();
  });
  it("requires a full recalculation when changing the run period", async () => {
    await expect(save([detail()], { ...run, period_end: "2026-04-20" })).rejects.toThrow();
  });
  it("prevents double pay across overlapping groups", async () => {
    await db.exec(`UPDATE employees SET payroll_group_id='${otherGroup}' WHERE id='${employee}'`);
    await expect(save([detail()], { ...run, id: "40000000-0000-0000-0000-000000000002", payroll_group_id: otherGroup })).rejects.toThrow();
    await db.exec(`UPDATE employees SET payroll_group_id='${group}' WHERE id='${employee}'`);
  });
  it("denies callers without payroll roles", async () => {
    await db.exec("UPDATE user_roles SET role='employee'");
    await expect(save([detail()])).rejects.toThrow();
    await db.exec("UPDATE user_roles SET role='org_admin'");
  });
  it("exposes no payroll write API to anonymous users", async () => {
    const result = await db.query<{ allowed: boolean }>(
      "SELECT has_function_privilege('anon','public.save_payroll_run_atomic(jsonb,jsonb,jsonb)','EXECUTE') allowed");
    expect(result.rows[0].allowed).toBe(false);
  });
  it("locks through the atomic API and rejects subsequent recalculation", async () => {
    await db.query("select set_payroll_run_status_atomic($1,'locked')", [runId]);
    await expect(save([detail()])).rejects.toThrow();
    await db.query("select set_payroll_run_status_atomic($1,'locked')", [runId]);
    await expect(db.query("update payroll_details set net_salary=1 where payroll_run_id=$1", [runId])).rejects.toThrow();
    await expect(db.query("delete from payroll_details where payroll_run_id=$1", [runId])).rejects.toThrow();
  });
});
