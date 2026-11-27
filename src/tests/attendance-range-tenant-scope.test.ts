import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261127160000_require_tenant_scope_for_attendance_range.sql",
  "utf8",
);

describe.sequential("attendance range tenant scope migration", () => {
  const db = new PGlite();
  const companyA = "10000000-0000-4000-8000-000000000001";
  const companyB = "20000000-0000-4000-8000-000000000002";
  const userA = "a0000000-0000-4000-8000-000000000001";

  async function setContext(userId: string | null, companyId: string | null, role = "authenticated") {
    await db.exec(`RESET ROLE; SET ROLE ${role};`);
    const claims = JSON.stringify({
      ...(userId ? { sub: userId } : {}),
      role,
      ...(companyId ? { company_id: companyId } : {}),
    });
    await db.query("SELECT set_config('request.jwt.claims', $1, false)", [claims]);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    await db.query("SELECT set_config('request.jwt.claim.role', $1, false)", [role]);
    await db.query("SELECT set_config('test.company_id', $1, false)", [companyId ?? ""]);
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
      CREATE TABLE public.companies (id uuid PRIMARY KEY);
      CREATE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('test.company_id', true), '')::uuid
      $$;
      CREATE FUNCTION public.can_access_core_company(p_company_id uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$
        SELECT p_company_id IS NOT NULL AND (
          public.current_company_id() = p_company_id OR
          EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(
              COALESCE(NULLIF(current_setting('test.roles', true), '')::jsonb, '[]'::jsonb)
            ) AS r(role) WHERE r.role = 'super_admin'
          )
        )
      $$;
      CREATE FUNCTION public.process_company_attendance_range(
        p_from_date date, p_to_date date, p_company_id uuid DEFAULT NULL
      ) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
        SELECT jsonb_build_object('ok', true, 'company_id', p_company_id)
      $$;
      INSERT INTO public.companies VALUES ('${companyA}'), ('${companyB}');
      GRANT EXECUTE ON FUNCTION public.process_company_attendance_range(date, date, uuid) TO authenticated, service_role;
      GRANT SELECT ON public.companies TO authenticated, service_role;
    `);
    await db.exec(migration);
  });

  afterAll(async () => {
    await db.close();
  });

  it("rejects an explicit foreign company even if the legacy role check would allow it", async () => {
    await setContext(userA, companyA);
    await expect(
      db.query(`SELECT public.process_company_attendance_range('2026-11-01', '2026-11-02', '${companyB}')`),
    ).rejects.toThrow(/Active membership/);
  });

  it("uses the verified company when the caller omits the optional company", async () => {
    await setContext(userA, companyA);
    const result = await db.query<{ result: { company_id: string } }>(
      "SELECT public.process_company_attendance_range('2026-11-01', '2026-11-02', NULL) AS result",
    );
    expect(result.rows[0]?.result.company_id).toBe(companyA);
  });

  it("requires service callers to provide a concrete company", async () => {
    await setContext(null, null, "service_role");
    await expect(
      db.query("SELECT public.process_company_attendance_range('2026-11-01', '2026-11-02', NULL)"),
    ).rejects.toThrow(/explicit valid company scope/i);
    const result = await db.query<{ result: { company_id: string } }>(
      `SELECT public.process_company_attendance_range('2026-11-01', '2026-11-02', '${companyB}') AS result`,
    );
    expect(result.rows[0]?.result.company_id).toBe(companyB);
  });

  it("rejects inverted date ranges before invoking the underlying processor", async () => {
    await setContext(userA, companyA);
    await expect(
      db.query(`SELECT public.process_company_attendance_range('2026-11-03', '2026-11-02', '${companyA}')`),
    ).rejects.toThrow(/valid attendance date range/i);
  });
});
