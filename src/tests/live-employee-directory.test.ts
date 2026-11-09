import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const migration = readFileSync("supabase/migrations/20261109000000_restore_invoker_employee_directory.sql", "utf8");
const uid = "10000000-0000-0000-0000-000000000001";
const company = "20000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE user_roles(user_id uuid, role text);
    CREATE TYPE employee_status AS ENUM ('active', 'terminated');
    CREATE TABLE employees (
      id uuid, user_id uuid, company_id uuid, employee_no text, full_name text,
      first_name_ar text, last_name_ar text, first_name_en text, last_name_en text,
      email text, phone text, job_title text, status employee_status, hire_date date, contract_type text,
      gender text, department_id uuid, subsidiary_id uuid, work_location_id uuid,
      completion_score int, nationality text, national_id_or_iqama text, basic_salary numeric
    );
    CREATE TABLE departments(id uuid, name text);
    CREATE TABLE subsidiaries(id uuid, name_ar text);
    CREATE TABLE work_locations(id uuid, name_ar text);
    CREATE TABLE employee_documents(employee_id uuid, expiry_date date);
    INSERT INTO employees(id,user_id,company_id,employee_no,full_name,status,nationality,basic_salary,phone)
    VALUES ('30000000-0000-0000-0000-000000000001','${uid}','${company}','A1','Visible employee','active','Saudi',5000,'private'),
      ('30000000-0000-0000-0000-000000000002',null,'${company}','A2','Hidden same company','active','Saudi',7000,'private'),
      ('30000000-0000-0000-0000-000000000003',null,'20000000-0000-0000-0000-000000000002','B1','Other tenant','active','Saudi',9000,'private');
    INSERT INTO user_roles VALUES ('${uid}', 'employee');
    ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_rows ON employees FOR SELECT TO authenticated USING (user_id = auth.uid());
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
  `);
  await db.exec(migration);
  await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${uid}',false);`);
});
afterAll(async () => { await db.close(); });

it("preserves RLS and excludes salary and identity fields on the legacy schema", async () => {
  const { rows } = await db.query<{ result: { total_count: number; items: Record<string, unknown>[] } }>("SELECT get_employee_directory() AS result");
  expect(rows[0]!.result.total_count).toBe(1);
  const item = rows[0]!.result.items[0]!;
  expect(item.full_name).toBe("Visible employee");
  expect(item.phone).toBeNull();
  expect(item).not.toHaveProperty("basic_salary");
  expect(item).not.toHaveProperty("national_id_or_iqama");
  expect(item.avatar_storage_path).toBeNull();
});
it("filters and clamps pagination without leaking hidden rows", async () => {
  const { rows } = await db.query<{ result: { total_count: number; page_size: number } }>("SELECT get_employee_directory(p_search => 'Hidden', p_page_size => 10000) AS result");
  expect(rows[0]!.result).toMatchObject({ total_count: 0, page_size: 100 });
});
it("rejects unauthorized salary inference", async () => {
  await expect(db.query("SELECT get_employee_directory(p_min_salary => 6000)")).rejects.toThrow("Salary filtering is not permitted");
});
it("computes KPIs only from RLS-visible records without document company_id", async () => {
  const { rows } = await db.query<{ result: Record<string, unknown> }>("SELECT get_employee_directory_kpis() AS result");
  expect(rows[0]!.result).toMatchObject({ available: true, hr_restricted: true, total_employees: 1 });
  await db.exec("RESET ROLE; UPDATE user_roles SET role='super_admin'; SET ROLE authenticated;");
  const hr = await db.query<{ result: Record<string, unknown> }>("SELECT get_employee_directory_kpis() AS result");
  expect(hr.rows[0]!.result).toMatchObject({ total_employees: 1, expiring_docs_count: 0 });
});
it("denies anonymous execution and requires a user even for authenticated DB role", async () => {
  await db.exec("RESET ROLE; SET ROLE anon;");
  await expect(db.query("SELECT public.get_employee_directory()" )).rejects.toThrow(/permission denied/);
  await db.exec("RESET ROLE; SET ROLE authenticated; SELECT set_config('test.uid','',false);");
  await expect(db.query("SELECT public.get_employee_directory()" )).rejects.toThrow(/تسجيل الدخول/);
});
