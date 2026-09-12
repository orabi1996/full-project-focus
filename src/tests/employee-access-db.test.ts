import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationDir = new URL("../../supabase/migrations/", import.meta.url);
const readMigration = (name: string) => readFileSync(new URL(name, migrationDir), "utf8");
const staffId = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";
let db: PGlite;

async function asUser<T>(id: string, action: () => Promise<T>): Promise<T> {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("SET ROLE authenticated");
  try {
    return await action();
  } finally {
    await db.exec("RESET ROLE");
  }
}

describe("employee access in PostgreSQL (targeted migration regression)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
    `);
    // Replay actual core migrations, including their permissive policies. The
    // full chain has pre-existing missing schema (documented in the audit);
    // this fixture does not claim to validate Supabase/PostgREST or that chain.
    for (const file of readdirSync(migrationDir)
      .sort()
      .filter((f) => f < "20260901")) {
      await db.exec(readMigration(file));
    }
    await db.exec(readMigration("20260903110500_fix_admin_roles_and_employee_update_policy.sql"));
    await db.query("INSERT INTO auth.users(id,email) VALUES ($1,'approved-owner@example.test')", [
      ownerId,
    ]);
    await db.query("INSERT INTO public.user_roles(user_id,role) VALUES ($1,'org_admin')", [
      ownerId,
    ]);
    await db.exec(readMigration("20260910100000_restore_employee_access.sql"));
    await db.query(
      "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,'hr.admin@example.test',$2)",
      [staffId, { full_name: "Actual Employee", role: "super_admin" }],
    );
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  it("ignores administrator-like email and user-controlled role metadata", async () => {
    const result = await db.query<{ role: string }>(
      "SELECT role FROM public.user_roles WHERE user_id=$1",
      [staffId],
    );
    expect(result.rows.map((r) => r.role)).toEqual(["employee"]);
    const record = await db.query<{
      full_name: string;
      basic_salary: string;
      national_id_or_iqama: string | null;
    }>(
      "SELECT full_name,basic_salary,national_id_or_iqama FROM public.employees WHERE user_id=$1",
      [staffId],
    );
    expect(record.rows[0].full_name).toBe("Actual Employee");
    expect(Number(record.rows[0].basic_salary)).toBe(0);
    expect(record.rows[0].national_id_or_iqama).toBeNull();
  });

  it("preserves existing explicitly assigned administrator roles", async () => {
    const result = await db.query<{ role: string }>(
      "SELECT role FROM public.user_roles WHERE user_id=$1",
      [ownerId],
    );
    expect(result.rows.map((r) => r.role)).toContain("org_admin");
  });

  it("keeps own employee data readable without exposing another employee", async () => {
    await asUser(staffId, async () => {
      const result = await db.query<{ user_id: string }>("SELECT user_id FROM public.employees");
      expect(result.rows.map((r) => r.user_id)).toEqual([staffId]);
    });
  });

  it.each(["basic_salary=999999", "total_salary=999999", "status='terminated'", "user_id=null"])(
    "blocks self update of %s",
    async (assignment) => {
      await asUser(staffId, async () => {
        const result = await db.query(
          `UPDATE public.employees SET ${assignment} WHERE user_id=$1 RETURNING id`,
          [staffId],
        );
        expect(result.rows).toEqual([]);
      });
    },
  );

  it("blocks self deletion and insertion", async () => {
    await asUser(staffId, async () => {
      expect(
        (await db.query("DELETE FROM public.employees WHERE user_id=$1 RETURNING id", [staffId]))
          .rows,
      ).toEqual([]);
      await expect(
        db.query(
          "INSERT INTO public.employees(employee_no,full_name,user_id) VALUES ('FORGED','Forged',$1)",
          [staffId],
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("blocks granting oneself an administrator role", async () => {
    await asUser(staffId, async () => {
      await expect(
        db.query("INSERT INTO public.user_roles(user_id,role) VALUES ($1,'super_admin')", [
          staffId,
        ]),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("allows an authorized HR administrator to edit employees", async () => {
    await asUser(ownerId, async () => {
      const result = await db.query<{ basic_salary: string }>(
        "UPDATE public.employees SET basic_salary=12000 WHERE user_id=$1 RETURNING basic_salary",
        [staffId],
      );
      expect(Number(result.rows[0].basic_salary)).toBe(12000);
    });
  });

  it("does not let another permissive policy reopen self salary updates", async () => {
    await db.exec(
      "CREATE POLICY accidental_owner_write ON public.employees FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid())",
    );
    try {
      await asUser(staffId, async () => {
        expect(
          (
            await db.query(
              "UPDATE public.employees SET basic_salary=999999 WHERE user_id=$1 RETURNING id",
              [staffId],
            )
          ).rows,
        ).toEqual([]);
      });
    } finally {
      await db.exec("DROP POLICY accidental_owner_write ON public.employees");
    }
  });

  it("never links an unverified signup to an existing employee by email", async () => {
    const unlinkedId = "00000000-0000-4000-8000-000000000003";
    await db.exec(
      "INSERT INTO public.employees(employee_no,full_name,email) VALUES ('EXISTING','Existing Employee','unlinked@example.test')",
    );
    await db.query("INSERT INTO auth.users(id,email) VALUES ($1,'unlinked@example.test')", [
      unlinkedId,
    ]);
    const rows = await db.query<{ user_id: string | null }>(
      "SELECT user_id FROM public.employees WHERE email='unlinked@example.test'",
    );
    expect(rows.rows).toEqual([{ user_id: null }]);
  });
});
