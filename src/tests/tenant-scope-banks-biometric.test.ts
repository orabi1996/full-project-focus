import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20261127080000_tenant_scope_banks_and_biometric_devices.sql"),
  "utf8",
);

describe.sequential("Tenant scope for bank accounts and biometric devices", () => {
  const db = new PGlite();
  const companyA = "11111111-1111-4111-8111-111111111111";
  const companyB = "22222222-2222-4222-8222-222222222222";
  const locationA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const locationB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const bankA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
  const bankB = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      CREATE TABLE public.work_locations (id uuid PRIMARY KEY, company_id uuid NOT NULL);
      CREATE TABLE public.company_bank_accounts (id uuid PRIMARY KEY, company_id uuid, current_balance numeric NOT NULL DEFAULT 0);
      CREATE TABLE public.biometric_devices (
        id uuid PRIMARY KEY, device_id text NOT NULL UNIQUE, name_ar text NOT NULL,
        work_location_id uuid, device_token text NOT NULL, status text NOT NULL DEFAULT 'active',
        auto_approve boolean NOT NULL DEFAULT false, last_seen_at timestamptz,
        total_punches integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE public.reimbursement_batches (
        id uuid PRIMARY KEY, company_id uuid NOT NULL, bank_account_id uuid, payment_status text NOT NULL DEFAULT 'prepared'
      );
      CREATE TABLE public.payroll_runs (id uuid PRIMARY KEY, company_id uuid, payment_account_id uuid);
      CREATE TABLE public.payroll_payments (id uuid PRIMARY KEY, payroll_run_id uuid, bank_account_id uuid);
      CREATE TABLE public.loans (id uuid PRIMARY KEY, company_id uuid, disbursement_account_id uuid);
      CREATE TABLE public.loan_disbursements (id uuid PRIMARY KEY, company_id uuid, bank_account_id uuid);
      CREATE TABLE public.settlements (id uuid PRIMARY KEY, company_id uuid, payment_bank_account_id uuid);
      CREATE FUNCTION public.can_access_core_company(p_company_id uuid)
        RETURNS boolean LANGUAGE sql STABLE AS $$
          SELECT p_company_id = nullif(current_setting('test.company', true), '')::uuid
        $$;
      CREATE FUNCTION public.has_role(p_user_id uuid, p_role text)
        RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
      ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;
      CREATE POLICY finance_accounts_all ON public.company_bank_accounts
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
      CREATE POLICY devices_all ON public.biometric_devices
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_bank_accounts, public.biometric_devices TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.reimbursement_batches TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
      GRANT SELECT ON public.work_locations TO authenticated;
    `);
    await db.exec(migration);
    await db.query(
      `INSERT INTO public.work_locations (id, company_id) VALUES ($1, $2), ($3, $4)`,
      [locationA, companyA, locationB, companyB],
    );
    await db.query(
      `INSERT INTO public.company_bank_accounts (id, company_id) VALUES ($1, $2), ($3, $4)`,
      [bankA, companyA, bankB, companyB],
    );
    await db.query(
      `INSERT INTO public.biometric_devices (id, device_id, name_ar, work_location_id, device_token) VALUES
        ('aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa', 'DEVICE-A', 'A', $1, 'token-a'),
        ('bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb', 'DEVICE-B', 'B', $2, 'token-b')`,
      [locationA, locationB],
    );
  });

  it("only exposes the caller company's bank accounts and biometric devices", async () => {
    await db.exec(`SET test.company = '${companyA}'; SET ROLE authenticated;`);
    const banks = await db.query<{ id: string }>("SELECT id FROM public.company_bank_accounts ORDER BY id");
    const devices = await db.query<{ device_id: string }>("SELECT device_id FROM public.biometric_devices ORDER BY device_id");
    expect(banks.rows.map((row) => row.id)).toEqual([bankA]);
    expect(devices.rows.map((row) => row.device_id)).toEqual(["DEVICE-A"]);
    await expect(db.query("SELECT device_token FROM public.biometric_devices")).rejects.toThrow(/permission denied/i);
    await db.exec("RESET ROLE;");
  });

  it("rejects a reimbursement batch linked to another company's bank account", async () => {
    await db.exec(`SET test.company = '${companyA}'; SET ROLE authenticated;`);
    await expect(
      db.query(
        `INSERT INTO public.reimbursement_batches (id, company_id, bank_account_id) VALUES
          ('cccccccc-1111-4111-8111-cccccccccccc', $1, $2)`,
        [companyA, bankB],
      ),
    ).rejects.toThrow(/لا يتبع المنشأة المالكة|does not belong/i);
    await db.exec("RESET ROLE;");
  });

  it("rejects a payroll run linked to another company's bank account", async () => {
    await db.exec(`SET test.company = '${companyA}'; SET ROLE authenticated;`);
    await expect(
      db.query(
        `INSERT INTO public.payroll_runs (id, company_id, payment_account_id) VALUES
          ('eeeeeeee-1111-4111-8111-eeeeeeeeeeee', $1, $2)`,
        [companyA, bankB],
      ),
    ).rejects.toThrow(/لا يتبع المنشأة المالكة|does not belong/i);
    await db.exec("RESET ROLE;");
  });

  it("rejects cross-company device registration even when the old permissive policy allows it", async () => {
    await db.exec(`SET test.company = '${companyA}'; SET ROLE authenticated;`);
    await expect(
      db.query(
        `INSERT INTO public.biometric_devices (id, device_id, name_ar, work_location_id, device_token) VALUES
          ('dddddddd-0000-4000-8000-dddddddddddd', 'DEVICE-C', 'C', $1, 'token-c')`,
        [locationB],
      ),
    ).rejects.toThrow();
    await db.exec("RESET ROLE;");
  });
});
