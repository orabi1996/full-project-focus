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
    const firstResult = await recomputeBiometricAttendanceDay(async () => {
      attempts += 1;
      throw new Error("temporary database error");
    });
    expect(firstResult).toBe(false);
    const retryResult = await recomputeBiometricAttendanceDay(async () => {
      attempts += 1;
    });
    expect(retryResult).toBe(true);
    expect(attempts).toBe(2);
  });

  it("uses the unique idempotency key after the read-before-insert race", () => {
    const route = fs.readFileSync(path.resolve(__dirname, "../routes/api/public/biometric/punch.ts"), "utf8");
    const attendance = fs.readFileSync(path.resolve(__dirname, "../lib/business/attendance.functions.ts"), "utf8");
    expect(route).toContain('.eq("idempotency_key", idempotencyKey)');
    expect(route).toContain('.eq("punch_type", punchType)');
    expect(route).toContain('error.code === "23505"');
    expect(route).toContain("recomputeBiometricAttendanceDay");
    expect(route).toContain("retryable: true");
    expect(attendance).toContain("if (punchesError) throw new Error");
    expect(attendance).toContain("if (upsertError) throw new Error(`تعذر تحديث سجل الحضور اليومي:");
  });
});
