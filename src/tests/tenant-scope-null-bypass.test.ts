import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("RPC tenant scope when current_company_id is NULL", () => {
  const db = new PGlite();
  const companyA = "a0000000-0000-0000-0000-000000000001";
  const companyB = "b0000000-0000-0000-0000-000000000002";
  const userA = "11111111-aaaa-aaaa-aaaa-111111111111";
  const userOther = "22222222-bbbb-bbbb-bbbb-222222222222";
  const userUnauthorized = "33333333-cccc-cccc-cccc-333333333333";
  const runA = "c0000000-0000-0000-0000-000000000001";
  const employeeA = "e0000000-0000-0000-0000-000000000001";

  async function setCaller(userId: string | null, role = "authenticated") {
    await db.exec(`
      SELECT set_config('test.auth_uid', '${userId ?? ""}', false);
      SELECT set_config('test.auth_role', '${role}', false);
    `);
  }

  beforeAll(async () => {
    await db.exec(`
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      CREATE TYPE public.app_role AS ENUM ('super_admin', 'hr_manager');
      CREATE SCHEMA auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('test.auth_uid', true), '')::uuid
      $$;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
        SELECT COALESCE(nullif(current_setting('test.auth_role', true), ''), 'authenticated')
      $$;
      CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL);
      CREATE TABLE public.company_access (user_id uuid NOT NULL, company_id uuid NOT NULL);
      CREATE TABLE public.employees (id uuid PRIMARY KEY, company_id uuid NOT NULL);
      CREATE TABLE public.payroll_runs (id uuid PRIMARY KEY, company_id uuid NOT NULL);

      CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role public.app_role)
      RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = p_role)
      $$;
      CREATE OR REPLACE FUNCTION public.can_access_core_company(p_company_id uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT auth.uid() IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.company_access
          WHERE user_id = auth.uid() AND company_id = p_company_id
        )
      $$;
      -- Simulate users with no employee profile; this was the NULL bypass condition.
      CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULL::uuid
      $$;

      CREATE FUNCTION public.calculate_payroll_run_atomic(p_payroll_run_id uuid) RETURNS jsonb
      LANGUAGE sql SECURITY DEFINER AS $$ SELECT jsonb_build_object('ok', true, 'id', p_payroll_run_id) $$;
      CREATE FUNCTION public.approve_payroll_run_atomic(p_payroll_run_id uuid, p_note text DEFAULT '') RETURNS jsonb
      LANGUAGE sql SECURITY DEFINER AS $$ SELECT jsonb_build_object('ok', true, 'id', p_payroll_run_id) $$;
      CREATE FUNCTION public.validate_payroll_wps_export(p_payroll_run_id uuid) RETURNS jsonb
      LANGUAGE sql SECURITY DEFINER AS $$ SELECT jsonb_build_object('ok', true, 'id', p_payroll_run_id) $$;
      CREATE FUNCTION public.calculate_final_settlement_atomic(
        p_employee_id uuid, p_termination_date date,
        p_separation_type text DEFAULT 'contract_expiration', p_unpaid_leave_days integer DEFAULT 0
      ) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
        SELECT jsonb_build_object('ok', true, 'id', p_employee_id)
      $$;
      CREATE FUNCTION public.create_final_settlement_atomic(p_params jsonb) RETURNS jsonb
      LANGUAGE sql SECURITY DEFINER AS $$ SELECT jsonb_build_object('ok', true) $$;

      INSERT INTO public.employees VALUES ('${employeeA}', '${companyA}');
      INSERT INTO public.payroll_runs VALUES ('${runA}', '${companyA}');
      INSERT INTO public.company_access VALUES ('${userA}', '${companyA}');
      INSERT INTO public.user_roles VALUES ('${userA}', 'hr_manager');
      INSERT INTO public.user_roles VALUES ('${userOther}', 'super_admin');
    `);

    const migration = fs.readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/20261127130000_require_explicit_rpc_company_scope.sql"),
      "utf8",
    );
    await db.exec(migration);
  });

  it("rejects cross-company payroll and settlement calls even when current_company_id is NULL", async () => {
    await setCaller(userUnauthorized);
    const calls = [
      `SELECT public.calculate_payroll_run_atomic('${runA}')`,
      `SELECT public.approve_payroll_run_atomic('${runA}')`,
      `SELECT public.validate_payroll_wps_export('${runA}')`,
      `SELECT public.calculate_final_settlement_atomic('${employeeA}', CURRENT_DATE)`,
      `SELECT public.create_final_settlement_atomic(jsonb_build_object('employee_id', '${employeeA}'))`,
    ];
    for (const call of calls) {
      await expect(db.query(call)).rejects.toThrow(/42501|غير مصرح/);
    }
  });

  it("allows a scoped company user, super admin, or explicit service role", async () => {
    await setCaller(userA);
    const scoped = await db.query<any>(`SELECT public.calculate_payroll_run_atomic('${runA}') AS result`);
    expect(scoped.rows[0].result.ok).toBe(true);

    await setCaller(userOther);
    const superAdmin = await db.query<any>(`SELECT public.validate_payroll_wps_export('${runA}') AS result`);
    expect(superAdmin.rows[0].result.ok).toBe(true);

    await setCaller(null, "service_role");
    const service = await db.query<any>(`SELECT public.create_final_settlement_atomic(jsonb_build_object('employee_id', '${employeeA}')) AS result`);
    expect(service.rows[0].result.ok).toBe(true);
  });

  it("does not expose renamed unscoped implementations to authenticated callers", async () => {
    const privileges = await db.query<any>(`
      SELECT has_function_privilege('authenticated',
        'public.calculate_payroll_run_atomic_unscoped_20261127130000(uuid)', 'EXECUTE') AS can_execute;
    `);
    expect(privileges.rows[0].can_execute).toBe(false);
  });
});
