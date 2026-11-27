import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261127100000_harden_company_context_resolution.sql",
  "utf8",
);

describe.sequential("verified tenant context resolution migration", () => {
  const db = new PGlite();
  const companyA = "10000000-0000-4000-8000-000000000001";
  const companyB = "20000000-0000-4000-8000-000000000002";
  const companyC = "30000000-0000-4000-8000-000000000003";
  const userA = "a0000000-0000-4000-8000-000000000001";
  const userB = "b0000000-0000-4000-8000-000000000002";

  async function firstRow<T extends object>(sql: string, params?: Array<string | null>): Promise<T> {
    const result = await db.query<T>(sql, params);
    const row = result.rows[0];
    if (!row) throw new Error("Expected the query to return one row");
    return row;
  }

  async function setContext(userId: string | null, companyId?: string, role = "authenticated") {
    await db.exec(`RESET ROLE; SET ROLE ${role};`);
    const claims = JSON.stringify({
      ...(userId ? { sub: userId } : {}),
      role,
      ...(companyId ? { company_id: companyId } : {}),
    });
    await db.query("SELECT set_config('request.jwt.claims', $1, false)", [claims]);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    await db.query("SELECT set_config('request.jwt.claim.role', $1, false)", [role]);
  }

  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
      $$;
      CREATE TYPE public.app_role AS ENUM ('employee', 'super_admin');
      CREATE TABLE public.companies (id uuid PRIMARY KEY);
      CREATE TABLE public.employees (
        user_id uuid NOT NULL, company_id uuid NOT NULL, status text NOT NULL
      );
      CREATE TABLE public.user_company_access (
        user_id uuid NOT NULL, company_id uuid NOT NULL, status text NOT NULL
      );
      CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL);
      CREATE TABLE public.expense_claims (company_id uuid NOT NULL);
      CREATE TABLE public.performance_cycles (id uuid PRIMARY KEY, company_id uuid NOT NULL);
      CREATE TABLE public.performance_cycle_participants (cycle_id uuid NOT NULL, company_id uuid NOT NULL);
      CREATE FUNCTION public.has_role(p_user_id uuid, p_role public.app_role)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = p_role)
      $$;
      CREATE FUNCTION public.get_expense_kpis_atomic(p_company_id uuid DEFAULT NULL)
      RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_company_id uuid; v_count integer;
      BEGIN
        v_company_id := COALESCE(p_company_id, public.current_company_id());
        SELECT count(*) INTO v_count FROM public.expense_claims
        WHERE v_company_id IS NULL OR company_id = v_company_id;
        RETURN jsonb_build_object('count', v_count);
      END $$;
      CREATE FUNCTION public.get_performance_kpis_atomic(
        p_cycle_id uuid DEFAULT NULL, p_company_id uuid DEFAULT NULL
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_company_id uuid; v_cycle_id uuid; v_count integer;
      BEGIN
        v_company_id := COALESCE(p_company_id, public.current_company_id());
        v_cycle_id := p_cycle_id;
        IF v_cycle_id IS NULL THEN
          SELECT id INTO v_cycle_id FROM public.performance_cycles
          WHERE v_company_id IS NULL OR company_id = v_company_id LIMIT 1;
        END IF;
        SELECT count(*) INTO v_count FROM public.performance_cycle_participants
        WHERE v_cycle_id IS NULL OR cycle_id = v_cycle_id;
        RETURN jsonb_build_object('count', v_count);
      END $$;
      INSERT INTO public.companies VALUES
        ('${companyA}'), ('${companyB}'), ('${companyC}');
      INSERT INTO public.employees VALUES ('${userA}', '${companyA}', 'active');
      INSERT INTO public.expense_claims VALUES ('${companyA}'), ('${companyB}');
      INSERT INTO public.performance_cycles VALUES
        ('c0000000-0000-4000-8000-000000000001', '${companyA}'),
        ('c0000000-0000-4000-8000-000000000002', '${companyB}');
      INSERT INTO public.performance_cycle_participants VALUES
        ('c0000000-0000-4000-8000-000000000001', '${companyA}'),
        ('c0000000-0000-4000-8000-000000000002', '${companyB}');
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    `);
    await db.exec(migration);
  });

  afterAll(async () => {
    await db.close();
  });

  it("infers the sole active employee membership and aligns the legacy helper", async () => {
    await setContext(userA);
    expect((await firstRow<{ id: string | null }>("SELECT public.current_company_id() AS id")).id).toBe(companyA);
    expect((await firstRow<{ id: string | null }>("SELECT public.current_user_company_id() AS id")).id).toBe(companyA);
  });

  it("accepts an active explicit membership without an employee row", async () => {
    await db.exec(`INSERT INTO public.user_company_access VALUES ('${userB}', '${companyB}', 'active')`);
    await setContext(userB);
    expect((await firstRow<{ id: string | null }>("SELECT public.current_company_id() AS id")).id).toBe(companyB);
  });

  it("returns NULL for multiple active memberships without a verified claim", async () => {
    await db.exec(`INSERT INTO public.user_company_access VALUES ('${userA}', '${companyB}', 'active')`);
    await setContext(userA);
    expect((await firstRow<{ id: string | null }>("SELECT public.current_company_id() AS id")).id).toBeNull();
  });

  it("uses a verified claim to select one of multiple memberships", async () => {
    await setContext(userA, companyB);
    expect((await firstRow<{ id: string | null }>("SELECT public.current_company_id() AS id")).id).toBe(companyB);
  });

  it("rejects a foreign claim without falling back to another membership", async () => {
    await setContext(userA, companyC);
    expect((await firstRow<{ id: string | null }>("SELECT public.current_company_id() AS id")).id).toBeNull();
  });

  it("returns NULL when the only relationship is pending or revoked", async () => {
    await db.exec(`DELETE FROM public.user_company_access WHERE user_id = '${userB}'`);
    await db.exec(`
      INSERT INTO public.user_company_access VALUES
        ('${userB}', '${companyA}', 'pending'), ('${userB}', '${companyC}', 'revoked');
    `);
    await setContext(userB);
    expect((await db.query("SELECT status FROM public.user_company_access WHERE user_id = $1", [userB])).rows).toEqual([
      { status: "pending" },
      { status: "revoked" },
    ]);
    expect((await firstRow<{ id: string | null }>("SELECT public.current_company_id() AS id")).id).toBeNull();
  });

  it("returns NULL for service_role without an explicit company scope", async () => {
    await setContext(null, undefined, "service_role");
    expect((await firstRow<{ id: string | null }>("SELECT public.current_company_id() AS id")).id).toBeNull();
  });

  it("allows service_role only the explicitly scoped existing company", async () => {
    await setContext(null, companyB, "service_role");
    expect((await firstRow<{ id: string | null }>("SELECT public.current_company_id() AS id")).id).toBe(companyB);
  });

  it("preserves global super_admin core access while regular company access requires context", async () => {
    await db.exec(`RESET ROLE; INSERT INTO public.user_roles VALUES ('${userB}', 'super_admin')`);
    await setContext(userB, companyC);
    expect((await firstRow<{ id: string | null }>("SELECT public.current_company_id() AS id")).id).toBeNull();
    expect((await firstRow<{ allowed: boolean }>("SELECT public.can_access_core_company($1) AS allowed", [companyC])).allowed).toBe(true);
    await setContext(userB);
    expect((await firstRow<{ allowed: boolean }>("SELECT public.can_access_core_company($1) AS allowed", [companyC])).allowed).toBe(true);
    await setContext(userA, companyC);
    expect((await firstRow<{ allowed: boolean }>("SELECT public.can_access_core_company($1) AS allowed", [companyC])).allowed).toBe(false);
  });

  it("prevents expense KPI null scope from expanding to every company", async () => {
    await db.exec(`RESET ROLE; DELETE FROM public.user_company_access WHERE user_id = '${userA}'`);
    await setContext(userA);
    expect((await firstRow<{ result: { count: number } }>("SELECT public.get_expense_kpis_atomic() AS result")).result.count).toBe(1);

    await setContext(null, undefined, "service_role");
    await expect(db.query("SELECT public.get_expense_kpis_atomic() AS result")).rejects.toThrow(/Explicit valid company scope/);
    await expect(db.query("SELECT public.get_expense_kpis_atomic($1) AS result", ["not-a-uuid"]))
      .rejects.toThrow();
    expect((await firstRow<{ result: { count: number } }>("SELECT public.get_expense_kpis_atomic($1) AS result", [companyB])).result.count).toBe(1);
  });

  it("prevents performance KPI null cycle or company scope from expanding across tenants", async () => {
    await db.exec(`RESET ROLE; DELETE FROM public.user_company_access WHERE user_id = '${userA}'`);
    await setContext(userA);
    expect((await firstRow<{ result: { count: number } }>("SELECT public.get_performance_kpis_atomic() AS result")).result.count).toBe(1);
    await expect(db.query(
      "SELECT public.get_performance_kpis_atomic($1, $2) AS result",
      ["c0000000-0000-4000-8000-000000000002", companyA],
    )).rejects.toThrow(/outside the requested company scope/);

    await setContext(null, undefined, "service_role");
    await expect(db.query("SELECT public.get_performance_kpis_atomic() AS result")).rejects.toThrow(/Explicit valid company scope/);
    expect((await firstRow<{ result: { count: number } }>(
      "SELECT public.get_performance_kpis_atomic($1, $2) AS result",
      [null, companyB],
    )).result.count).toBe(1);
  });
});
