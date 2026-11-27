import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("payroll and workflow KPI tenant scope", () => {
  const db = new PGlite();
  const companyA = "a0000000-0000-0000-0000-000000000001";
  const companyB = "b0000000-0000-0000-0000-000000000002";
  const userA = "11111111-aaaa-aaaa-aaaa-111111111111";
  const otherUser = "22222222-bbbb-bbbb-bbbb-222222222222";

  async function setCaller(userId: string | null, role = "authenticated") {
    await db.exec(`
      SELECT set_config('test.auth_uid', '${userId ?? ""}', false);
      SELECT set_config('test.auth_role', '${role}', false);
      SELECT set_config('test.company_id', '', false);
    `);
  }

  beforeAll(async () => {
    await db.exec(`
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      CREATE SCHEMA auth;
      CREATE TABLE public.company_access (user_id uuid NOT NULL, company_id uuid NOT NULL);
      CREATE TABLE public.user_roles (user_id uuid NOT NULL, role text NOT NULL);

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.auth_uid', true), '')::uuid
      $$;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT COALESCE(nullif(current_setting('test.auth_role', true), ''), 'authenticated')
      $$;
      CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.company_id', true), '')::uuid
      $$;
      CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
      RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = p_role)
      $$;
      CREATE OR REPLACE FUNCTION public.can_access_core_company(p_company_id uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT auth.uid() IS NOT NULL AND (
          public.has_role(auth.uid(), 'super_admin') OR EXISTS (
            SELECT 1 FROM public.company_access
            WHERE user_id = auth.uid() AND company_id = p_company_id
          )
        )
      $$;
      CREATE OR REPLACE FUNCTION public.require_rpc_company_scope(p_company_id uuid, p_action text)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN
        IF p_company_id IS NULL THEN
          RAISE EXCEPTION 'company required' USING ERRCODE = '42501';
        END IF;
        IF auth.role() = 'service_role' THEN RETURN; END IF;
        IF NOT public.can_access_core_company(p_company_id) THEN
          RAISE EXCEPTION 'company denied' USING ERRCODE = '42501';
        END IF;
      END;
      $$;

      CREATE FUNCTION public.get_payroll_kpis(p_company_id uuid DEFAULT NULL)
      RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
        SELECT jsonb_build_object('companyId', p_company_id)
      $$;
      CREATE FUNCTION public.get_workflow_kpis(p_company_id uuid DEFAULT NULL)
      RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
        SELECT jsonb_build_object('companyId', p_company_id)
      $$;

      INSERT INTO public.company_access VALUES ('${userA}', '${companyA}');
      INSERT INTO public.user_roles VALUES ('${userA}', 'hr_manager');
      INSERT INTO public.user_roles VALUES ('${otherUser}', 'super_admin');
    `);

    const migration = fs.readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/20261127170000_scope_payroll_and_workflow_kpis.sql"),
      "utf8",
    );
    await db.exec(migration);
  });

  it("rejects missing or cross-company scope for authenticated users", async () => {
    await setCaller(userA);
    await expect(db.query("SELECT public.get_payroll_kpis()"))
      .rejects.toThrow(/42501|company required/);
    await expect(db.query(`SELECT public.get_workflow_kpis('${companyB}')`))
      .rejects.toThrow(/42501|company denied/);
  });

  it("passes only a company the authenticated caller can access", async () => {
    await setCaller(userA);
    const payroll = await db.query<{ result: { companyId: string } }>(
      `SELECT public.get_payroll_kpis('${companyA}') AS result`,
    );
    const workflow = await db.query<{ result: { companyId: string } }>(
      `SELECT public.get_workflow_kpis('${companyA}') AS result`,
    );
    expect(payroll.rows[0].result.companyId).toBe(companyA);
    expect(workflow.rows[0].result.companyId).toBe(companyA);
  });

  it("preserves explicit service access and hides renamed implementations", async () => {
    await setCaller(null, "service_role");
    const service = await db.query<{ result: { companyId: string } }>(
      `SELECT public.get_payroll_kpis('${companyB}') AS result`,
    );
    expect(service.rows[0].result.companyId).toBe(companyB);
    const privileges = await db.query<{ can_execute: boolean }>(`
      SELECT has_function_privilege('authenticated',
        'public.get_workflow_kpis_unscoped_20261127170000(uuid)', 'EXECUTE') AS can_execute
    `);
    expect(privileges.rows[0].can_execute).toBe(false);
  });
});
