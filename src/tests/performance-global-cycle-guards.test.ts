import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261127150000_scope_global_performance_cycles.sql", import.meta.url),
  "utf8",
);

describe.sequential("global performance cycle guards", () => {
  const db = new PGlite();
  const companyA = "10000000-0000-4000-8000-000000000001";
  const companyB = "20000000-0000-4000-8000-000000000002";
  const employeeA = "30000000-0000-4000-8000-000000000001";
  const employeeB = "40000000-0000-4000-8000-000000000002";
  const cycleA = "50000000-0000-4000-8000-000000000001";
  const cycleB = "60000000-0000-4000-8000-000000000002";
  const globalCycle = "70000000-0000-4000-8000-000000000003";
  const hrUser = "80000000-0000-4000-8000-000000000001";
  const otherUser = "90000000-0000-4000-8000-000000000002";
  const superAdmin = "a0000000-0000-4000-8000-000000000003";

  async function context(userId: string | null, companyId: string | null, role = "authenticated") {
    await db.exec(`RESET ROLE; SET ROLE ${role};`);
    await db.query("SELECT set_config('test.user', $1, false)", [userId ?? ""]);
    await db.query("SELECT set_config('test.company', $1, false)", [companyId ?? ""]);
    await db.query("SELECT set_config('request.jwt.claim.role', $1, false)", [role]);
  }

  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('test.user', true), '')::uuid
      $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
      $$;
      CREATE TYPE public.app_role AS ENUM ('employee', 'hr_manager', 'super_admin');
      CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL);
      CREATE FUNCTION public.current_user_has_any_role(allowed_roles text[])
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text = ANY(allowed_roles)
        )
      $$;
      CREATE FUNCTION public.current_company_id()
      RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT NULLIF(current_setting('test.company', true), '')::uuid
      $$;
      CREATE FUNCTION public.can_access_core_company(p_company_id uuid)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT auth.uid() IS NOT NULL AND p_company_id IS NOT NULL AND (
          public.current_user_has_any_role(ARRAY['super_admin'])
          OR p_company_id = public.current_company_id()
        )
      $$;
      CREATE TABLE public.employees (id uuid PRIMARY KEY, company_id uuid NOT NULL, status text NOT NULL);
      CREATE TABLE public.performance_cycles (
        id uuid PRIMARY KEY, company_id uuid, status text NOT NULL DEFAULT 'draft'
      );
      CREATE TABLE public.performance_snapshot_events (cycle_id uuid, participant_count integer);
      GRANT SELECT ON public.performance_snapshot_events TO authenticated;
      ALTER TABLE public.performance_cycles ENABLE ROW LEVEL SECURITY;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_cycles TO authenticated;
      CREATE POLICY "performance_cycles_read_policy" ON public.performance_cycles
        FOR SELECT TO authenticated USING (company_id = public.current_company_id() OR company_id IS NULL);
      CREATE POLICY "performance_cycles_admin_policy" ON public.performance_cycles
        FOR ALL TO authenticated
        USING (
          (company_id = public.current_company_id() OR company_id IS NULL)
          AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
        )
        WITH CHECK (
          (company_id = public.current_company_id() OR company_id IS NULL)
          AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
        );
      CREATE POLICY guard_performance_company ON public.performance_cycles AS RESTRICTIVE
        FOR ALL TO authenticated USING (public.can_access_core_company(company_id))
        WITH CHECK (public.can_access_core_company(company_id));
      INSERT INTO public.user_roles VALUES ('${hrUser}', 'hr_manager'), ('${otherUser}', 'employee'), ('${superAdmin}', 'super_admin');
      INSERT INTO public.employees VALUES
        ('${employeeA}', '${companyA}', 'active'),
        ('${employeeB}', '${companyB}', 'active');
      INSERT INTO public.performance_cycles VALUES
        ('${cycleA}', '${companyA}', 'draft'),
        ('${cycleB}', '${companyB}', 'draft'),
        ('${globalCycle}', NULL, 'draft');
      CREATE FUNCTION public.launch_performance_cycle_atomic(
        p_cycle_id uuid, p_department_ids uuid[] DEFAULT NULL
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_company_id uuid; v_participant_count integer;
      BEGIN
        SELECT company_id INTO v_company_id FROM public.performance_cycles WHERE id = p_cycle_id;
        SELECT count(*) INTO v_participant_count FROM public.employees
        WHERE status = 'active' AND (v_company_id IS NULL OR company_id = v_company_id);
        INSERT INTO public.performance_snapshot_events VALUES (p_cycle_id, v_participant_count);
        UPDATE public.performance_cycles SET status = 'open' WHERE id = p_cycle_id;
        RETURN jsonb_build_object('participant_count', v_participant_count);
      END $$;
    `);
    await db.exec(migration);
  }, 30_000);

  afterAll(async () => { await db.close(); });

  it("shows NULL-company global cycles only to an explicit super admin", async () => {
    await context(hrUser, companyA);
    expect((await db.query("SELECT id FROM public.performance_cycles ORDER BY id")).rows).toEqual([{ id: cycleA }]);
    await expect(db.exec(`INSERT INTO public.performance_cycles VALUES ('b0000000-0000-4000-8000-000000000001', NULL, 'draft')`))
      .rejects.toThrow(/row-level security/);
    const hiddenUpdate = await db.query(
      `UPDATE public.performance_cycles SET status = 'open' WHERE id = $1 RETURNING id`, [globalCycle],
    );
    expect(hiddenUpdate.rows).toEqual([]);

    await context(superAdmin, null);
    expect((await db.query("SELECT id FROM public.performance_cycles ORDER BY id")).rows).toEqual([{ id: globalCycle }]);
    await expect(db.query(`UPDATE public.performance_cycles SET status = 'open' WHERE id = $1`, [globalCycle]))
      .rejects.toThrow(/يجب إسناد دورة التقييم إلى منشأة/);
  });

  it("requires a tenant-bound cycle and matching active tenant before snapshot launch", async () => {
    await context(hrUser, companyA);
    await expect(db.query("SELECT public.launch_performance_cycle_atomic($1, NULL)", [globalCycle]))
      .rejects.toThrow(/إسناد دورة التقييم إلى منشأة/);
    await expect(db.query("SELECT public.launch_performance_cycle_atomic($1, NULL)", [cycleB]))
      .rejects.toThrow(/نطاق المنشأة النشط لا يطابق دورة التقييم/);
    expect((await db.query("SELECT * FROM public.performance_snapshot_events")).rows).toEqual([]);

    const result = await db.query<{ launch_performance_cycle_atomic: { participant_count: number } }>(
      "SELECT public.launch_performance_cycle_atomic($1, NULL)", [cycleA],
    );
    expect(result.rows[0]?.launch_performance_cycle_atomic.participant_count).toBe(1);
    expect((await db.query("SELECT cycle_id, participant_count FROM public.performance_snapshot_events")).rows)
      .toEqual([{ cycle_id: cycleA, participant_count: 1 }]);
  });

  it("requires explicit company scope for service role and a privileged role for authenticated launch", async () => {
    await context(null, null, "service_role");
    const result = await db.query<{ launch_performance_cycle_atomic: { participant_count: number } }>(
      "SELECT public.launch_performance_cycle_atomic($1, NULL)", [cycleA],
    );
    expect(result.rows[0]?.launch_performance_cycle_atomic.participant_count).toBe(1);
    await expect(db.query("SELECT public.launch_performance_cycle_atomic($1, NULL)", [globalCycle]))
      .rejects.toThrow(/إسناد دورة التقييم إلى منشأة/);

    await context(null, companyA, "service_role");
    await expect(db.query("SELECT public.launch_performance_cycle_atomic($1, NULL)", [cycleB]))
      .rejects.toThrow(/نطاق المنشأة النشط لا يطابق دورة التقييم/);

    await context(otherUser, companyA);
    await expect(db.query("SELECT public.launch_performance_cycle_atomic($1, NULL)", [cycleA]))
      .rejects.toThrow(/غير مصرح للمستخدم بإطلاق دورة تقييم الأداء/);
  });
});
