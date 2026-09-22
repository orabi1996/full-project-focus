import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the real creation and conversion functions in embedded PostgreSQL.
// Auth helpers and prerequisite tables are isolated fixtures, not a full Supabase deployment.
const db = new PGlite();
const company = "10000000-0000-0000-0000-000000000001";
const department = "20000000-0000-0000-0000-000000000001";
const location = "30000000-0000-0000-0000-000000000001";
const job = "40000000-0000-0000-0000-000000000001";
const candidate = "50000000-0000-0000-0000-000000000001";
const migration = (name: string) =>
  readFileSync(`supabase/migrations/${name}.sql`, "utf8").replace(/^\uFEFF/, "");
const convert = (id = candidate, salary = 0, dept = department) =>
  db.query<{ result: { id: string; already_converted: boolean } }>(
    `SELECT public.convert_candidate_to_employee($1, 'أحمد', 'محمد', $2, $3, '2026-10-01', 'full_time', 'on_site', $4) AS result`,
    [id, dept, location, salary],
  );
const counts = async () =>
  (
    await db.query(`SELECT
  (SELECT count(*)::int FROM employees) employees,
  (SELECT count(*)::int FROM audit_events) audits,
  (SELECT count(*)::int FROM candidate_employee_conversions) links,
  (SELECT n FROM numbering) number`)
  ).rows[0];

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
    CREATE FUNCTION auth.current_company_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '${company}'::uuid $$;
    CREATE FUNCTION public.current_user_has_any_role(text[]) RETURNS boolean LANGUAGE sql AS $$
      SELECT current_setting('test.role', true) = ANY($1) $$;
    CREATE FUNCTION public.current_user_can_manage_company(uuid) RETURNS boolean LANGUAGE sql AS $$
      SELECT auth.uid() IS NOT NULL AND $1 = auth.current_company_id() AND current_setting('test.role', true) IN ('hr_manager', 'super_admin') $$;
    CREATE TYPE employee_contract_type AS ENUM ('full_time');
    CREATE TYPE employee_work_type AS ENUM ('on_site');
    CREATE TYPE employee_status AS ENUM ('draft');
    CREATE TYPE employee_gender AS ENUM ('male', 'female');
    CREATE TYPE employee_marital_status AS ENUM ('single', 'married');
    CREATE TABLE companies(id uuid PRIMARY KEY);
    CREATE TABLE departments(id uuid PRIMARY KEY, company_id uuid);
    CREATE TABLE subsidiaries(id uuid PRIMARY KEY, company_id uuid);
    CREATE TABLE work_locations(id uuid PRIMARY KEY, company_id uuid);
    CREATE TABLE job_openings(id uuid PRIMARY KEY, department_id uuid, title_ar text);
    CREATE TABLE candidates(id uuid PRIMARY KEY, job_id uuid, full_name text, email text, phone text, stage text NOT NULL);
    CREATE TABLE employees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid, employee_no text, full_name text,
      first_name_ar text, last_name_ar text, first_name_en text, last_name_en text,
      email text, phone text, national_id_or_iqama text, nationality text, gender employee_gender,
      birth_date date, marital_status employee_marital_status, hire_date date, contract_type employee_contract_type,
      job_title text, department_id uuid, subsidiary_id uuid, work_location_id uuid, job_position_id uuid,
      cost_center_id uuid, manager_id uuid, work_type employee_work_type, basic_salary numeric,
      total_salary numeric, housing_allowance numeric, transport_allowance numeric, other_allowances numeric,
      bank_name text, iban text, job_grade text, status employee_status
    );
    CREATE TABLE audit_events(action text, action_type text, actor_user_id uuid, entity_type text, entity_id uuid, changes_summary text);
    CREATE TABLE numbering(n int); INSERT INTO numbering VALUES (0);
    CREATE FUNCTION generate_company_employee_no(uuid) RETURNS text LANGUAGE sql AS $$ UPDATE numbering SET n=n+1 RETURNING n::text $$;
    INSERT INTO companies VALUES ('${company}');
    INSERT INTO departments VALUES ('${department}', '${company}');
    INSERT INTO work_locations VALUES ('${location}', '${company}');
    INSERT INTO job_openings VALUES ('${job}', '${department}', 'مهندس');
    INSERT INTO candidates VALUES ('${candidate}', '${job}', 'أحمد محمد', 'candidate@example.com', NULL, 'job_offer');
    SET test.uid = '60000000-0000-0000-0000-000000000001'; SET test.role = 'hr_manager';
  `);
  await db.exec(migration("20260915030000_remove_employee_master_implicit_defaults"));
  await db.exec(migration("20260922010000_atomic_candidate_conversion"));
}, 30000);
afterAll(async () => {
  await db.close();
});

describe.sequential("atomic candidate conversion in PostgreSQL", () => {
  it("rejects direct hired stage and direct ledger writes", async () => {
    await expect(
      db.exec(`UPDATE candidates SET stage='hired' WHERE id='${candidate}'`),
    ).rejects.toThrow();
    await db.exec("SET ROLE authenticated");
    try {
      await expect(
        db.exec("INSERT INTO candidate_employee_conversions DEFAULT VALUES"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  it("rejects unauthenticated, unauthorized, cross-company placement and unauthorized salary", async () => {
    await db.exec("SET test.uid = ''");
    await expect(convert()).rejects.toThrow();
    await db.exec(
      "SET test.uid = '60000000-0000-0000-0000-000000000001'; SET test.role = 'employee'",
    );
    await expect(convert()).rejects.toThrow();
    await db.exec("SET test.role = 'hr_manager'");
    await expect(convert(candidate, 100)).rejects.toThrow();
    await expect(convert(candidate, 0, "20000000-0000-0000-0000-000000000002")).rejects.toThrow();
    expect(await counts()).toEqual({ employees: 0, audits: 0, links: 0, number: 0 });
  });
  it("rolls back employee, number, audit and ledger when the final stage update fails", async () => {
    await db.exec(`CREATE FUNCTION fail_stage() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected stage failure'; END; $$;
      CREATE TRIGGER z_fail_stage BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION fail_stage();`);
    await expect(convert()).rejects.toThrow(/injected stage failure/);
    expect(await counts()).toEqual({ employees: 0, audits: 0, links: 0, number: 0 });
    expect((await db.query("SELECT stage FROM candidates")).rows[0]).toEqual({
      stage: "job_offer",
    });
    await db.exec("DROP TRIGGER z_fail_stage ON candidates");
  });
  it("rejects another tenant's candidate and invalid salary without creating a draft", async () => {
    const otherCandidate = "50000000-0000-0000-0000-000000000002";
    await db.exec(`INSERT INTO departments VALUES ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');
      INSERT INTO job_openings VALUES ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Other tenant');
      INSERT INTO candidates VALUES ('${otherCandidate}', '40000000-0000-0000-0000-000000000002', 'Other', 'other@example.com', NULL, 'job_offer');`);
    await expect(convert(otherCandidate)).rejects.toThrow();
    await expect(convert(candidate, -1)).rejects.toThrow();
    expect(await counts()).toEqual({ employees: 0, audits: 0, links: 0, number: 0 });
    await db.exec(`DELETE FROM candidates WHERE id='${otherCandidate}'`);
  });
  it("commits a draft and retries without duplication or invented identity data", async () => {
    await db.exec("SET ROLE authenticated");
    let first;
    try {
      first = (await convert()).rows[0].result;
    } finally {
      await db.exec("RESET ROLE");
    }
    const retry = (await convert()).rows[0].result;
    expect(retry).toMatchObject({ id: first.id, already_converted: true });
    expect(await counts()).toEqual({ employees: 1, audits: 1, links: 1, number: 1 });
    expect((await db.query("SELECT stage FROM candidates")).rows[0]).toEqual({ stage: "hired" });
    expect(
      (
        await db.query(
          "SELECT status, gender, marital_status, first_name_en, subsidiary_id FROM employees",
        )
      ).rows[0],
    ).toEqual({
      status: "draft",
      gender: null,
      marital_status: null,
      first_name_en: null,
      subsidiary_id: null,
    });
  });
  it("checks authorization even on retry and protects a converted candidate", async () => {
    await db.exec("SET test.role = 'employee'");
    await expect(convert()).rejects.toThrow();
    await db.exec("SET test.role = 'hr_manager'");
    await expect(db.exec("UPDATE candidates SET stage='job_offer'")).rejects.toThrow();
    await expect(db.exec("UPDATE candidates SET job_id=NULL")).rejects.toThrow();
    await expect(db.exec("DELETE FROM employees")).rejects.toThrow();
  });
});
