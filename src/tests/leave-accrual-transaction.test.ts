import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

let db: PGlite;
const company = "00000000-0000-4000-8000-000000000001";
const employee = "00000000-0000-4000-8000-000000000002";
const leaveType = "00000000-0000-4000-8000-000000000003";
const run = (month = 1) => db.query<{ result: { total_processed: number } }>(
  `SELECT run_leave_accrual(2026, $1, NULL, $2::uuid) result`, [month, company],
);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;
    CREATE FUNCTION current_company_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '${company}'::uuid $$;
    CREATE FUNCTION current_user_can_manage_company(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT NULLIF(current_setting('test.allowed', true), '')::boolean $$;
    CREATE FUNCTION current_user_has_any_role(text[]) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE companies(id uuid PRIMARY KEY, timezone text);
    CREATE TABLE leave_types(id uuid PRIMARY KEY, company_id uuid, status text, accrual_method text, max_days_per_year numeric);
    CREATE TYPE employee_status AS ENUM ('active', 'on_leave');
    CREATE TABLE employees(id uuid PRIMARY KEY, company_id uuid, status employee_status, hire_date date);
    CREATE TABLE leave_balances(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid, leave_type_id uuid, company_id uuid, year integer, annual_entitlement numeric, accrued_days numeric DEFAULT 0, used_days numeric DEFAULT 0, reserved_days numeric DEFAULT 0, carried_over_days numeric DEFAULT 0, carried_over_used_days numeric DEFAULT 0, updated_at timestamptz, UNIQUE(employee_id, leave_type_id, year));
    CREATE TABLE leave_balance_transactions(company_id uuid, employee_id uuid, leave_type_id uuid, year integer, transaction_type text, days numeric, reason text, created_by uuid);
    CREATE TABLE leave_accrual_runs(company_id uuid, leave_type_id uuid, period_year integer, period_month integer, employees_processed integer, total_days_accrued numeric, executed_by uuid, UNIQUE(company_id, leave_type_id, period_year, period_month));
    INSERT INTO companies VALUES ('${company}', 'Asia/Riyadh');
    INSERT INTO leave_types VALUES ('${leaveType}', '${company}', 'active', 'monthly_accrual', 24);
    INSERT INTO employees VALUES ('${employee}', '${company}', 'active', '2025-01-01');
  `);
  await db.exec(readFileSync("supabase/migrations/20261110040000_serialize_leave_accrual.sql", "utf8"));
});
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec(`TRUNCATE leave_balances, leave_balance_transactions, leave_accrual_runs;
    SET test.uid = '${employee}'; SET test.allowed = 'true';
    ALTER TABLE leave_balance_transactions DROP CONSTRAINT IF EXISTS reject_ledger;
    ALTER TABLE leave_accrual_runs DROP CONSTRAINT IF EXISTS reject_run;
  `);
});
describe("transactional database accrual", () => {
  it("credits once per period and preserves a zero processed count on replay", async () => {
    expect((await run()).rows[0].result.total_processed).toBe(1);
    expect((await run()).rows[0].result.total_processed).toBe(0);
    expect((await db.query("SELECT accrued_days::float8 AS accrued_days FROM leave_balances")).rows).toEqual([{ accrued_days: 2 }]);
    expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM leave_balance_transactions")).rows[0].n).toBe(1);
    expect((await run(2)).rows[0].result.total_processed).toBe(1);
  });
  it.each(["leave_balance_transactions", "leave_accrual_runs"])("rolls back balances and ledger if %s fails", async (table) => {
    const constraint = table === "leave_accrual_runs" ? "reject_run" : "reject_ledger";
    await db.exec(`ALTER TABLE ${table} ADD CONSTRAINT ${constraint} CHECK (false)`);
    await expect(run()).rejects.toThrow();
    for (const name of ["leave_balances", "leave_balance_transactions", "leave_accrual_runs"]) {
      expect((await db.query<{ n: number }>(`SELECT count(*)::int n FROM ${name}`)).rows[0].n).toBe(0);
    }
    await db.exec(`ALTER TABLE ${table} DROP CONSTRAINT ${constraint}`);
    expect((await run()).rows[0].result.total_processed).toBe(1);
  });
  it.each(["false", ""])("denies false or null authorization (%s)", async (allowed) => {
    await db.exec(`SET test.allowed = '${allowed}'`);
    await expect(run()).rejects.toThrow("غير مصرح");
  });
  it("denies an absent authenticated identity", async () => {
    await db.exec("SET test.uid = ''");
    await expect(run()).rejects.toThrow("غير مصرح");
  });
  it.each([0, 13])("rejects invalid month %s without writes", async (month) => {
    await expect(run(month)).rejects.toThrow("فترة الاستحقاق");
    expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM leave_balances")).rows[0].n).toBe(0);
  });
});
