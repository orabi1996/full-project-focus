import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { DashboardAnalytics, DashboardAttendanceTrend, DashboardIntegrations } from "../lib/domains/dashboard/dashboard-types";

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
  await db.exec(`CREATE TABLE requests(id uuid, reference text, employee_id uuid, type text, status text, created_at timestamptz, reason text, start_date date, end_date date);
    CREATE TABLE attendance_records(employee_id uuid, work_date date, status text);
    INSERT INTO attendance_records VALUES ('30000000-0000-0000-0000-000000000001','2026-01-01','present'), ('30000000-0000-0000-0000-000000000003','2026-01-01','absent');
    GRANT SELECT ON requests, attendance_records TO authenticated;`);
  await db.exec(readFileSync('supabase/migrations/20261109010000_restore_dashboard_contract.sql','utf8'));
  await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${uid}',false);`);
});
afterAll(async () => { await db.close(); });


it("returns the nested contract and only RLS-visible headcount", async () => {
  const {rows} = await db.query<{result: DashboardAnalytics}>("SELECT get_dashboard_summary('2026-01-01','2026-01-07') AS result");
  expect(rows[0]!.result).toMatchObject({scope:'self',headcount:{available:true,activeCount:1,saudiCount:1,turnoverRate:null},attendance:{available:false},payroll:{available:false},documents:{available:false},pendingApprovals:{count:0,items:[]},leaveRoster:[]});
});
it("uses RLS-visible attendance, without fabricating missing days", async () => {
  const {rows} = await db.query<{result: DashboardAttendanceTrend}>("SELECT get_dashboard_attendance_trend('2026-01-07',7) AS result");
  expect(rows[0]!.result).toMatchObject({available:true,days:7,trend:[{date:'2026-01-01',present:1,absent:0,late:0}]});
  const empty = await db.query<{result: DashboardAttendanceTrend}>("SELECT get_dashboard_attendance_trend('2026-02-07',7) AS result");
  expect(empty.rows[0]!.result).toMatchObject({available:false,trend:[]});
});
it("does not report unverified integrations as healthy", async () => {
  const {rows} = await db.query<{result: DashboardIntegrations}>("SELECT get_dashboard_integration_health() AS result");
  expect(rows[0]!.result).toMatchObject({available:false,platforms:[]});
});
it("rejects invalid date ranges", async () => {
  await expect(db.query("SELECT get_dashboard_summary('2026-02-01','2026-01-01')")).rejects.toThrow('Invalid date range');
});
it("does not advertise zero organization headcount when tenant context is missing", async () => {
  await db.exec("RESET ROLE; UPDATE user_roles SET role='hr_manager'; UPDATE employees SET company_id=null WHERE user_id IS NOT NULL; SET ROLE authenticated;");
  const {rows} = await db.query<{result: DashboardAnalytics}>("SELECT get_dashboard_summary(null,null) AS result");
  expect(rows[0]!.result.headcount.available).toBe(false);
});
it("requires authentication and denies anonymous execution", async () => {
  await db.exec("RESET ROLE; SET ROLE anon;");
  await expect(db.query("SELECT get_dashboard_summary(null,null)")).rejects.toThrow(/permission denied/);
  await db.exec("RESET ROLE; SET ROLE authenticated; SELECT set_config('test.uid','',false);");
  await expect(db.query("SELECT get_dashboard_summary(null,null)")).rejects.toThrow('Authentication required');
  await expect(db.query("SELECT get_dashboard_attendance_trend(null,null)")).rejects.toThrow('Authentication required');
  await expect(db.query("SELECT get_dashboard_integration_health()")).rejects.toThrow('Authentication required');
});
