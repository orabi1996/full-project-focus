import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20261127180000_serialize_all_attendance_day_recomputes.sql",
  "utf8",
);

describe.sequential("shared attendance day lock migration", () => {
  const db = new PGlite();
  const employeeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const workDate = "2026-11-27";

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
      CREATE TABLE public.attendance_recompute_calls (
        employee_id uuid NOT NULL,
        business_date date NOT NULL,
        caller_id uuid,
        caller_role text
      );
      GRANT SELECT ON public.attendance_recompute_calls TO authenticated;
      CREATE FUNCTION public.process_attendance_day(p_employee_id uuid, p_business_date date)
      RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      BEGIN
        INSERT INTO public.attendance_recompute_calls VALUES (p_employee_id, p_business_date, auth.uid(), auth.role());
        RETURN jsonb_build_object('ok', true, 'employee_id', p_employee_id, 'work_date', p_business_date);
      END $$;
      GRANT EXECUTE ON FUNCTION public.process_attendance_day(uuid, date) TO authenticated, service_role;
    `);
    await db.exec(migration);
  });

  afterAll(async () => {
    await db.close();
  });

  it("keeps the public signature and serializes by employee and business date", async () => {
    const definition = await db.query<{ definition: string }>(
      "SELECT pg_get_functiondef('public.process_attendance_day(uuid,date)'::regprocedure) AS definition",
    );
    expect(definition.rows[0]?.definition).toContain("pg_advisory_xact_lock");
    expect(definition.rows[0]?.definition).toContain("p_employee_id::text || ':' || p_business_date::text");

    await db.exec(`SET request.jwt.claim.sub = '${employeeId}'; SET request.jwt.claim.role = 'authenticated'; SET ROLE authenticated;`);
    const result = await db.query<{ result: { ok: boolean; work_date: string } }>(
      "SELECT public.process_attendance_day($1, $2) AS result",
      [employeeId, workDate],
    );
    expect(result.rows[0]?.result.ok).toBe(true);
    expect(result.rows[0]?.result.work_date).toBe(workDate);
    await db.exec("RESET ROLE;");
  });

  it("preserves the original authorization checks behind the lock wrapper", async () => {
    await db.exec(`SET request.jwt.claim.sub = '${employeeId}'; SET request.jwt.claim.role = 'authenticated'; SET ROLE authenticated;`);
    await db.query("SELECT public.process_attendance_day($1, $2)", [employeeId, workDate]);
    const logged = await db.query<{ caller_id: string; caller_role: string }>(
      "SELECT caller_id, caller_role FROM public.attendance_recompute_calls ORDER BY ctid DESC LIMIT 1",
    );
    expect(logged.rows[0]?.caller_id).toBe(employeeId);
    expect(logged.rows[0]?.caller_role).toBe("authenticated");
    await db.exec("RESET ROLE;");
  });

  it("does not expose the renamed implementation or public wrapper to anonymous callers", async () => {
    await db.exec("SET ROLE anon;");
    await expect(db.query("SELECT public.process_attendance_day($1, $2)", [employeeId, workDate])).rejects.toThrow(/permission denied/i);
    await expect(
      db.query("SELECT public.process_attendance_day_unlocked_20261127180000($1, $2)", [employeeId, workDate]),
    ).rejects.toThrow(/permission denied/i);
    await db.exec("RESET ROLE;");
  });
});
