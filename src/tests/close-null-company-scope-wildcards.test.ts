import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20261127140000_close_null_company_scope_wildcards.sql"),
  "utf8",
);

describe.sequential("Verified company scope for employee and attendance RPCs", () => {
  const db = new PGlite();
  const companyA = "11111111-1111-4111-8111-111111111111";
  const companyB = "22222222-2222-4222-8222-222222222222";
  const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const managerA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
  const reportA = "aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa";
  const reportB = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      CREATE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.company', true), '')::uuid
      $$;
      CREATE TABLE public.user_roles (user_id uuid NOT NULL, role text NOT NULL);
      CREATE FUNCTION public.current_user_has_any_role(p_roles text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY(p_roles))
      $$;
      CREATE FUNCTION public.has_role(p_user_id uuid, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user_id AND ur.role = p_role)
      $$;
      CREATE FUNCTION public.can_access_core_company(p_company_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT p_company_id IS NOT NULL AND (
          public.has_role(auth.uid(), 'super_admin')
          OR p_company_id = nullif(current_setting('test.company', true), '')::uuid
        )
      $$;
      CREATE TABLE public.employees (
        id uuid PRIMARY KEY, user_id uuid, company_id uuid, custom_fields jsonb DEFAULT '{}'::jsonb,
        email text, status text NOT NULL DEFAULT 'active', manager_id uuid, manager_employee_id uuid
      );
      CREATE TABLE public.employee_profile_change_requests (
        id uuid PRIMARY KEY, employee_id uuid NOT NULL, company_id uuid, status text NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE public.punches (id uuid PRIMARY KEY, employee_id uuid NOT NULL, company_id uuid, punch_time timestamptz);
      CREATE TABLE public.attendance_records (id uuid PRIMARY KEY, employee_id uuid NOT NULL, company_id uuid, status text);
      ALTER TABLE public.employee_profile_change_requests ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.punches ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
      CREATE POLICY attendance_scoped_read ON public.attendance_records FOR SELECT TO authenticated USING (true);
      CREATE POLICY attendance_staff_write ON public.attendance_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
      CREATE POLICY punches_self_or_hr_read ON public.punches FOR SELECT TO authenticated USING (true);
      CREATE POLICY punches_self_insert ON public.punches FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY old_pcr_insert ON public.employee_profile_change_requests FOR INSERT TO authenticated WITH CHECK (true);
      CREATE FUNCTION public.get_authenticated_employee_context(p_company_id uuid DEFAULT NULL)
        RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT jsonb_build_object('scope', p_company_id) $$;
      CREATE FUNCTION public.get_manager_team_summary(p_company_id uuid DEFAULT NULL)
        RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT jsonb_build_object('scope', p_company_id) $$;
      CREATE FUNCTION public.get_manager_team_members(p_company_id uuid DEFAULT NULL)
        RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT jsonb_build_object('scope', p_company_id) $$;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_profile_change_requests, public.punches, public.attendance_records TO authenticated;
      GRANT SELECT ON public.employees, public.user_roles TO authenticated;
    `);
    await db.exec(migration);
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, 'manager@example.test')", [userA]);
    await db.query(
      `INSERT INTO public.employees (id, user_id, company_id, email, manager_id) VALUES
        ($1, $2, $3, 'manager@example.test', NULL),
        ($4, NULL, $3, 'report-a@example.test', $1),
        ($5, NULL, $6, 'report-b@example.test', $1),
        ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', $2, $6, 'manager@example.test', NULL)`,
      [managerA, userA, companyA, reportA, reportB, companyB],
    );
    await db.query(
      `INSERT INTO public.attendance_records (id, employee_id, company_id, status) VALUES
        ('cccccccc-1111-4111-8111-cccccccccccc', $1, $2, 'present'),
        ('cccccccc-2222-4222-8222-cccccccccccc', $3, $4, 'present'),
        ('cccccccc-3333-4333-8333-cccccccccccc', $3, NULL, 'present')`,
      [reportA, companyA, reportB, companyB],
    );
    await db.query(
      `INSERT INTO public.punches (id, employee_id, company_id, punch_time) VALUES
        ('dddddddd-1111-4111-8111-dddddddddddd', $1, $2, now()),
        ('dddddddd-2222-4222-8222-dddddddddddd', $3, $4, now()),
        ('dddddddd-3333-4333-8333-dddddddddddd', $3, NULL, now())`,
      [reportA, companyA, reportB, companyB],
    );
    await db.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'line_manager')", [userA]);
  });

  it("does not resolve an employee or manager across companies without verified scope", async () => {
    await db.exec(`SET request.jwt.claim.sub = '${userA}'; SET ROLE authenticated;`);
    const unresolved = await db.query<{ employee_id: string | null }>("SELECT public.resolve_my_employee_id() AS employee_id");
    expect(unresolved.rows[0]?.employee_id).toBeNull();
    await expect(db.query("SELECT public.get_authenticated_employee_context(NULL)")).rejects.toThrow(/company membership/i);
    await expect(db.query("SELECT public.get_manager_team_summary(NULL)")).rejects.toThrow(/company membership/i);
    await db.exec("RESET ROLE;");
  });

  it("does not resolve an employee through an unconfirmed email match", async () => {
    const unconfirmedUser = "aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa";
    const emailLinkedEmployee = "aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa";
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, 'unconfirmed@example.test')", [unconfirmedUser]);
    await db.query(
      "INSERT INTO public.employees (id, user_id, company_id, email) VALUES ($1, NULL, $2, 'unconfirmed@example.test')",
      [emailLinkedEmployee, companyA],
    );
    await db.exec(`SET request.jwt.claim.sub = '${unconfirmedUser}'; SET test.company = '${companyA}'; SET ROLE authenticated;`);
    const result = await db.query<{ employee_id: string | null }>("SELECT public.resolve_my_employee_id() AS employee_id");
    expect(result.rows[0]?.employee_id).toBeNull();
    await db.exec("RESET ROLE;");

    await db.query("UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1", [unconfirmedUser]);
    await db.exec(`SET request.jwt.claim.sub = '${unconfirmedUser}'; SET test.company = '${companyA}'; SET ROLE authenticated;`);
    const confirmed = await db.query<{ employee_id: string | null }>("SELECT public.resolve_my_employee_id() AS employee_id");
    expect(confirmed.rows[0]?.employee_id).toBe(emailLinkedEmployee);
    await db.exec("RESET ROLE;");
  });

  it("requires a verified company and binds manager RPCs to the selected company", async () => {
    await db.exec(`SET request.jwt.claim.sub = '${userA}'; SET test.company = '${companyA}'; SET ROLE authenticated;`);
    const resolved = await db.query<{ employee_id: string | null }>("SELECT public.resolve_my_employee_id() AS employee_id");
    expect(resolved.rows[0]?.employee_id).toBe(managerA);
    const context = await db.query<{ result: { scope: string } }>("SELECT public.get_authenticated_employee_context($1) AS result", [companyA]);
    expect(context.rows[0]?.result).toEqual({ scope: companyA });
    const team = await db.query<{ result: { scope: string } }>("SELECT public.get_manager_team_members($1) AS result", [companyA]);
    expect(team.rows[0]?.result).toEqual({ scope: companyA });
    await expect(db.query("SELECT public.get_manager_team_members($1)", [companyB])).rejects.toThrow(/outside the caller tenant scope/i);
    await db.exec("RESET ROLE;");
  });

  it("hides company-null and other-company attendance/punch rows even with legacy broad policies present", async () => {
    await db.exec(`SET request.jwt.claim.sub = '${userA}'; SET test.company = '${companyA}'; SET ROLE authenticated;`);
    const attendance = await db.query<{ id: string }>("SELECT id FROM public.attendance_records ORDER BY id");
    const punches = await db.query<{ id: string }>("SELECT id FROM public.punches ORDER BY id");
    expect(attendance.rows.map((row) => row.id)).toEqual(["cccccccc-1111-4111-8111-cccccccccccc"]);
    expect(punches.rows.map((row) => row.id)).toEqual(["dddddddd-1111-4111-8111-dddddddddddd"]);
    await db.exec("RESET ROLE;");
  });

  it("rejects cross-company and unresolved profile/punch writes", async () => {
    await db.exec(`SET request.jwt.claim.sub = '${userA}'; SET test.company = '${companyA}'; SET ROLE authenticated;`);
    await expect(
      db.query(
        `INSERT INTO public.employee_profile_change_requests (id, employee_id, company_id) VALUES
          ('eeeeeeee-1111-4111-8111-eeeeeeeeeeee', $1, $2)`,
        [reportA, companyB],
      ),
    ).rejects.toThrow(/Employee company|violates row-level security|match its employee/i);
    await expect(
      db.query(
        `INSERT INTO public.punches (id, employee_id, company_id) VALUES
          ('ffffffff-1111-4111-8111-ffffffffffff', $1, $2)`,
        [reportA, companyB],
      ),
    ).rejects.toThrow(/Record company|violates row-level security|match its employee/i);
    await expect(
      db.query(
        `INSERT INTO public.punches (id, employee_id, company_id) VALUES
          ('ffffffff-2222-4222-8222-ffffffffffff', $1, $2)`,
        [reportB, companyB],
      ),
    ).rejects.toThrow(/violates row-level security/i);
    await db.exec("RESET ROLE;");
  });
});
