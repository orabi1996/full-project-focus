import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import {
  createBiometricPunchIdempotencyKey,
  recomputeBiometricAttendanceDay,
} from "../lib/business/biometric-punch-idempotency";

const migration = fs.readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20261127090000_biometric_punch_idempotency.sql"),
  "utf8",
);
const recomputeMigration = fs.readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20261127110000_serialize_biometric_attendance_recompute.sql"),
  "utf8",
);

describe.sequential("Public biometric punch retry safety", () => {
  const db = new PGlite();

  beforeAll(async () => {
    await db.exec(`
      CREATE TABLE public.punches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL,
        employee_id uuid NOT NULL,
        device_id text NOT NULL,
        punch_time timestamptz NOT NULL,
        punch_type text NOT NULL,
        source text NOT NULL DEFAULT 'biometric'
      );
      INSERT INTO public.punches (company_id, employee_id, device_id, punch_time, punch_type)
      VALUES
        ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'legacy', '2026-11-27T08:00:00Z', 'in'),
        ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'legacy', '2026-11-27T08:00:00Z', 'in');
    `);
    await db.exec(migration);
  });

  it("creates a stable key that distinguishes a different event", async () => {
    const input = {
      companyId: "company-1",
      deviceId: "terminal-1",
      employeeId: "employee-1",
      punchTime: "2026-11-27T08:00:00.000Z",
      punchType: "in" as const,
    };
    const first = await createBiometricPunchIdempotencyKey(input);
    expect(await createBiometricPunchIdempotencyKey(input)).toBe(first);
    expect(await createBiometricPunchIdempotencyKey({ ...input, punchType: "out" })).not.toBe(first);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("deduplicates concurrent retries without deleting historical duplicate rows", async () => {
    const key = await createBiometricPunchIdempotencyKey({
      companyId: "11111111-1111-4111-8111-111111111111",
      deviceId: "terminal-new",
      employeeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      punchTime: "2026-11-27T09:00:00.000Z",
      punchType: "in",
    });
    const insert = () => db.query(
      `INSERT INTO public.punches (company_id, employee_id, device_id, punch_time, punch_type, idempotency_key)
       VALUES ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'terminal-new',
         '2026-11-27T09:00:00Z', 'in', $1) ON CONFLICT (company_id, idempotency_key) WHERE idempotency_key IS NOT NULL
       DO NOTHING RETURNING id`,
      [key],
    );
    const inserts = await Promise.all([insert(), insert()]);
    expect(inserts.reduce((count, result) => count + result.rows.length, 0)).toBe(1);
    const legacy = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.punches WHERE device_id = 'legacy'`,
    );
    expect(legacy.rows[0].count).toBe("2");
  });

  it("keeps a recorded punch retryable when attendance recomputation fails", async () => {
    let attempts = 0;
    const supabase = {
      rpc: async () => {
        attempts += 1;
        return attempts === 1
          ? { data: null, error: { message: "temporary database error" } }
          : { data: { ok: true }, error: null };
      },
    };
    const input = { employeeId: "employee-1", punchTime: "2026-11-27T09:00:00Z", punchType: "in" as const };
    const firstResult = await recomputeBiometricAttendanceDay(supabase, input);
    expect(firstResult).toBe(false);
    const retryResult = await recomputeBiometricAttendanceDay(supabase, input);
    expect(retryResult).toBe(true);
    expect(attempts).toBe(2);
  });

  it("maps a UTC event after midnight in Riyadh to the local business date", async () => {
    const { rows } = await db.query<{ business_date: string }>(
      `SELECT ('2026-11-26T21:30:00Z'::timestamptz AT TIME ZONE 'Asia/Riyadh')::date::text AS business_date`,
    );
    expect(rows[0].business_date).toBe("2026-11-27");
  });

  it("fails closed when a raw draft assignment collides with the single published view row", async () => {
    await db.exec(`
      CREATE TABLE public.schedule_assignment_collision_fixture (
        assignment_id uuid PRIMARY KEY,
        employee_id uuid NOT NULL,
        work_date date NOT NULL,
        status text NOT NULL
      );
      CREATE VIEW public.effective_schedule_collision_fixture AS
        SELECT * FROM public.schedule_assignment_collision_fixture WHERE status = 'published';
      INSERT INTO public.schedule_assignment_collision_fixture VALUES
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-11-27', 'published'),
        ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-11-27', 'draft');
    `);
    const { rows } = await db.query<{ raw_count: number; effective_count: number }>(`
      SELECT
        (SELECT count(*)::int FROM public.schedule_assignment_collision_fixture) AS raw_count,
        (SELECT count(*)::int FROM public.effective_schedule_collision_fixture) AS effective_count
    `);
    expect(rows[0]).toEqual({ raw_count: 2, effective_count: 1 });
    expect(recomputeMigration).toContain("v_assignment_count <> 1");
    expect(recomputeMigration).toContain("v_raw_assignment_id IS DISTINCT FROM v_effective_assignment_id");
    expect(recomputeMigration).toContain("FROM public.schedule_assignments sa");
  });

  it("keeps an unsuccessful database recomputation retryable", async () => {
    const result = await recomputeBiometricAttendanceDay(
      { rpc: async () => ({ data: { ok: false }, error: null }) },
      { employeeId: "employee-1", punchTime: "2026-11-27T09:00:00Z", punchType: "in" },
    );
    expect(result).toBe(false);
  });

  it("uses the unique idempotency key after the read-before-insert race", () => {
    const route = fs.readFileSync(path.resolve(__dirname, "../routes/api/public/biometric/punch.ts"), "utf8");
    const attendance = fs.readFileSync(path.resolve(__dirname, "../lib/business/attendance.functions.ts"), "utf8");
    expect(route).toContain('.eq("idempotency_key", idempotencyKey)');
    expect(route).toContain('.eq("punch_type", punchType)');
    expect(route).toContain('error.code === "23505"');
    expect(route).toContain("recomputeBiometricAttendanceDay");
    expect(route).toContain("punchTime,");
    expect(route).not.toContain("punchTime.slice(0, 10)");
    const helper = fs.readFileSync(path.resolve(__dirname, "../lib/business/biometric-punch-idempotency.ts"), "utf8");
    expect(helper).toContain('supabase.rpc("recompute_biometric_attendance_day"');
    expect(route).toContain("retryable: true");
    expect(attendance).toContain("if (punchesError) throw new Error");
    expect(attendance).toContain("if (upsertError) throw new Error(`تعذر تحديث سجل الحضور اليومي:");
    expect(recomputeMigration).toContain("pg_advisory_xact_lock");
    expect(recomputeMigration).toContain("public.process_attendance_day(p_employee_id, v_business_date)");
    expect(recomputeMigration).toContain("p_punch_time AT TIME ZONE v_timezone");
    expect(recomputeMigration).toContain("public.vw_effective_published_schedules");
    expect(recomputeMigration).toContain("v_result ->> 'ok'");
    expect(recomputeMigration).toContain("other direct process_attendance_day or");
  });
});
