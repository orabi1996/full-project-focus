import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const A = "20000000-0000-4000-8000-000000000001";
const B = "20000000-0000-4000-8000-000000000002";
const USER_A = "10000000-0000-4000-8000-000000000001";
const USER_B = "10000000-0000-4000-8000-000000000002";
let db: PGlite;

type QueryPort = Pick<PGlite, "query" | "exec">;
function asUser<T>(
  userId: string,
  operation: (tx: QueryPort) => Promise<T>,
  role: "authenticated" | "anon" | "service_role" = "authenticated",
) {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${role}`);
    await tx.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return operation(tx);
  });
}
const read = (table: string, userId = USER_A) =>
  asUser(userId, (tx) => tx.query<Record<string, unknown>>(`SELECT * FROM public.${table}`));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    -- Simulate permissive Supabase defaults; the migration must revoke them.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  `);
  await db.exec(
    readFileSync(
      new URL(
        "../../supabase/migrations/20260908223000_tenant_registry_foundation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30_000);

beforeEach(async () => {
  await db.exec(`
    TRUNCATE public.tenant_settings, public.tenant_memberships, public.tenants, auth.users CASCADE;
    INSERT INTO auth.users(id) VALUES ('${USER_A}'), ('${USER_B}');
    INSERT INTO public.tenants(id,slug,legal_name,status) VALUES
      ('${A}', 'alpha', 'منشأة اختبار ألف', 'active'), ('${B}', 'bravo', 'Test Bravo', 'active');
    INSERT INTO public.tenant_settings(tenant_id,locale,timezone,currency_code) VALUES
      ('${A}', 'ar', 'Asia/Riyadh', 'SAR'), ('${B}', 'en', 'Africa/Cairo', 'EGP');
    INSERT INTO public.tenant_memberships(tenant_id,user_id,starts_at) VALUES
      ('${A}', '${USER_A}', '2020-01-01T00:00:00Z'), ('${B}', '${USER_B}', '2020-01-01T00:00:00Z');
  `);
});
afterAll(async () => {
  await db?.close();
});

describe("tenant registry SQL isolation (real PostgreSQL roles via PGlite)", () => {
  it("isolates both companies, their settings and member identities", async () => {
    expect((await read("tenants")).rows.map((r) => r.id)).toEqual([A]);
    expect((await read("tenants", USER_B)).rows.map((r) => r.id)).toEqual([B]);
    expect((await read("tenant_settings")).rows.map((r) => r.tenant_id)).toEqual([A]);
    expect((await read("tenant_memberships")).rows.map((r) => r.user_id)).toEqual([USER_A]);
    const other = await asUser(USER_A, (tx) =>
      tx.query("SELECT id FROM public.tenants WHERE id=$1", [B]),
    );
    expect(other.rows).toEqual([]);
  });

  it.each(["tenants", "tenant_settings", "tenant_memberships"])(
    "denies anonymous reads of %s",
    async (table) => {
      await expect(
        asUser("", (tx) => tx.query(`SELECT * FROM public.${table}`), "anon"),
      ).rejects.toMatchObject({ code: "42501" });
    },
  );

  const tables = ["tenants", "tenant_settings", "tenant_memberships"];
  const roles = ["anon", "authenticated"] as const;
  const operations = ["INSERT", "UPDATE", "DELETE"] as const;
  it.each(
    tables.flatMap((table) =>
      roles.flatMap((role) => operations.map((operation) => ({ table, role, operation }))),
    ),
  )(
    "denies $role $operation on $table even with permissive default grants",
    async ({ table, role, operation }) => {
      const insert = {
        tenants: "INSERT INTO public.tenants(slug,legal_name) VALUES ('owned', 'Unapproved')",
        tenant_settings: `INSERT INTO public.tenant_settings(tenant_id,locale,timezone,currency_code) VALUES ('${B}','ar','UTC','SAR')`,
        tenant_memberships: `INSERT INTO public.tenant_memberships(tenant_id,user_id) VALUES ('${B}','${USER_A}')`,
      };
      const sql =
        operation === "INSERT"
          ? insert[table as keyof typeof insert]
          : operation === "UPDATE"
            ? `UPDATE public.${table} SET id = id`
            : `DELETE FROM public.${table}`;
      await expect(asUser(USER_A, (tx) => tx.exec(sql), role)).rejects.toMatchObject({
        code: "42501",
      });
      expect((await db.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows).toEqual([
        { n: 2 },
      ]);
    },
  );

  it("exposes no rows with a missing authenticated user claim", async () => {
    expect((await read("tenants", "")).rows).toEqual([]);
    expect((await read("tenant_memberships", "")).rows).toEqual([]);
  });

  it.each(["suspended", "revoked"])("withdraws access for a %s membership", async (status) => {
    await db.query("UPDATE public.tenant_memberships SET status=$1 WHERE user_id=$2", [
      status,
      USER_A,
    ]);
    expect((await read("tenants")).rows).toEqual([]);
    expect((await read("tenant_settings")).rows).toEqual([]);
  });

  it.each([
    "starts_at = now() + interval '1 day'",
    "ends_at = now() - interval '1 second'",
    "archived_at = now()",
  ])("withdraws inactive membership access: %s", async (change) => {
    await db.exec(`UPDATE public.tenant_memberships SET ${change} WHERE user_id='${USER_A}'`);
    expect((await read("tenants")).rows).toEqual([]);
  });

  it("uses a start-inclusive and end-exclusive membership window", async () => {
    await db.transaction(async (tx) => {
      await tx.query(
        "UPDATE public.tenant_memberships SET starts_at=now(), ends_at=now()+interval '1 second' WHERE user_id=$1",
        [USER_A],
      );
      await tx.exec("SET LOCAL ROLE authenticated");
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [USER_A]);
      expect((await tx.query("SELECT id FROM public.tenants")).rows).toEqual([{ id: A }]);
    });
    await db.transaction(async (tx) => {
      await tx.query(
        "UPDATE public.tenant_memberships SET starts_at=now()-interval '1 day', ends_at=now() WHERE user_id=$1",
        [USER_A],
      );
      await tx.exec("SET LOCAL ROLE authenticated");
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [USER_A]);
      expect((await tx.query("SELECT id FROM public.tenants")).rows).toEqual([]);
    });
  });

  it("withdraws tenant and settings visibility immediately when the tenant is suspended", async () => {
    await db.query("UPDATE public.tenants SET status='suspended' WHERE id=$1", [A]);
    expect((await read("tenants")).rows).toEqual([]);
    expect((await read("tenant_settings")).rows).toEqual([]);
    // No recursion or SECURITY DEFINER bypass is needed. Own membership metadata
    // can still be read, but the API's tenant inner join has no row.
    const result = await asUser(USER_A, (tx) =>
      tx.query(
        "SELECT m.id FROM public.tenant_memberships m JOIN public.tenants t ON t.id=m.tenant_id",
      ),
    );
    expect(result.rows).toEqual([]);
  });

  it("allows two independently provisioned memberships without showing other members", async () => {
    await db.query("INSERT INTO public.tenant_memberships(tenant_id,user_id) VALUES ($1,$2)", [
      B,
      USER_A,
    ]);
    expect((await read("tenants")).rows.map((r) => r.id).sort()).toEqual([A, B]);
    expect((await read("tenant_memberships")).rows.every((r) => r.user_id === USER_A)).toBe(true);
  });

  it("enforces unique membership, valid windows, settings and foreign keys", async () => {
    await expect(
      db.query("INSERT INTO public.tenant_memberships(tenant_id,user_id) VALUES ($1,$2)", [
        A,
        USER_A,
      ]),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      db.query("UPDATE public.tenant_memberships SET ends_at=starts_at WHERE user_id=$1", [USER_A]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query("UPDATE public.tenant_settings SET timezone='Mars/Nowhere' WHERE tenant_id=$1", [A]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query("UPDATE public.tenant_settings SET currency_code='usd' WHERE tenant_id=$1", [A]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(db.query("DELETE FROM auth.users WHERE id=$1", [USER_A])).rejects.toMatchObject({
      code: "23001",
    });
    await expect(db.query("DELETE FROM public.tenants WHERE id=$1", [A])).rejects.toMatchObject({
      code: "23001",
    });
    await expect(
      db.query("INSERT INTO public.tenant_memberships(tenant_id,user_id) VALUES ($1,$2)", [
        A,
        "10000000-0000-4000-8000-000000000099",
      ]),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("allows trusted provisioning and increments the version on updates", async () => {
    const result = await asUser(
      "",
      (tx) =>
        tx.query(
          "UPDATE public.tenant_settings SET locale='en', version=99 WHERE tenant_id=$1 RETURNING version",
          [A],
        ),
      "service_role",
    );
    expect(result.rows).toEqual([{ version: 2 }]);
    expect((await read("tenant_settings")).rows[0].locale).toBe("en");
  });
});
