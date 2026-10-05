import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  WEBHOOK_EVENT_CATALOG,
  API_SCOPES_CATALOG,
  validateConnectorConfig,
  generateHmacSha256Signature,
  generateCorrelationId,
  generateIdempotencyKey,
} from "../lib/domains/integrations";

describe.sequential("Prompt 23: Production Integration Hub, Public API & Webhooks Platform", () => {
  // ==========================================================================
  // PART 1: STATIC AST & SOURCE CODE CONTRACT TESTS
  // ==========================================================================
  describe("Static Source Code Contract Tests", () => {
    const integrationsViewPath = path.resolve(__dirname, "../components/integrations/IntegrationsView.tsx");
    const integrationsViewSource = fs.readFileSync(integrationsViewPath, "utf-8");

    const integrationsRepoPath = path.resolve(__dirname, "../lib/data/integrations-repository.ts");
    const integrationsRepoSource = fs.readFileSync(integrationsRepoPath, "utf-8");

    const integrationsDomainPath = path.resolve(__dirname, "../lib/domains/integrations/index.ts");
    const integrationsDomainSource = fs.readFileSync(integrationsDomainPath, "utf-8");

    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/20261006000000_production_integration_hub_api_webhooks_engine.sql"
    );
    const migrationSource = fs.readFileSync(migrationPath, "utf-8");

    it("1.1 IntegrationsView MUST NOT contain fake static 'connected' status for Qiwa/GOSI/Muqeem", () => {
      // Must not have hardcoded static array claiming Qiwa is connected without server verification
      expect(integrationsViewSource).not.toMatch(/id:\s*"qiwa",\s*name:[^,]+,\s*status:\s*"connected"/);
      expect(integrationsViewSource).not.toMatch(/id:\s*"muqeem",\s*name:[^,]+,\s*status:\s*"connected"/);
      expect(integrationsViewSource).not.toMatch(/id:\s*"gosi",\s*name:[^,]+,\s*status:\s*"connected"/);
    });

    it("1.2 IntegrationsView MUST use dedicated enterprise integration hooks", () => {
      expect(integrationsViewSource).toContain("useIntegrationOverview");
      expect(integrationsViewSource).toContain("useIntegrationConnectors");
      expect(integrationsViewSource).toContain("useIntegrationRuns");
      expect(integrationsViewSource).toContain("useApiClients");
      expect(integrationsViewSource).toContain("useWebhookSubscriptions");
      expect(integrationsViewSource).toContain("useIntegrationMappings");
      expect(integrationsViewSource).toContain("useIntegrationFiles");
    });

    it("1.3 Migration MUST define authoritative tables for connectors, runs, secrets, api clients, webhooks, and biometric punches", () => {
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.integration_connectors");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.integration_secrets_metadata");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.integration_runs");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.integration_run_items");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.api_clients");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.api_client_scopes");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.webhook_subscriptions");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.webhook_deliveries");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.integration_mappings");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.integration_files");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.biometric_raw_punches");
    });

    it("1.4 Biometric raw punches table MUST have unique deduplication constraint", () => {
      expect(migrationSource).toContain("uq_biometric_punch_dedup UNIQUE (company_id, device_id, external_user_id, punch_time)");
    });

    it("1.5 Migration MUST define core integration RPCs", () => {
      expect(migrationSource).toContain("FUNCTION public.ensure_canonical_connectors");
      expect(migrationSource).toContain("FUNCTION public.get_integration_hub_overview");
      expect(migrationSource).toContain("FUNCTION public.test_connector_connection");
      expect(migrationSource).toContain("FUNCTION public.execute_integration_run");
      expect(migrationSource).toContain("FUNCTION public.replay_integration_run");
      expect(migrationSource).toContain("FUNCTION public.register_api_client");
      expect(migrationSource).toContain("FUNCTION public.ingest_biometric_punches_atomic");
      expect(migrationSource).toContain("FUNCTION public.get_dashboard_integration_health");
    });

    it("1.6 Webhook Event Catalog must cover core lifecycle events", () => {
      const eventCodes = WEBHOOK_EVENT_CATALOG.map((e) => e.code);
      expect(eventCodes).toContain("employee.created");
      expect(eventCodes).toContain("employee.terminated");
      expect(eventCodes).toContain("attendance.punch_created");
      expect(eventCodes).toContain("leave.approved");
      expect(eventCodes).toContain("payroll.finalized");
      expect(eventCodes).toContain("expense.approved");
      expect(eventCodes).toContain("integration.run_failed");
    });

    it("1.7 Public API Scopes Catalog must enforce granular least-privilege permissions", () => {
      const scopes = API_SCOPES_CATALOG.map((s) => s.scope);
      expect(scopes).toContain("employees.read");
      expect(scopes).toContain("employees.write");
      expect(scopes).toContain("attendance.read");
      expect(scopes).toContain("attendance.write");
      expect(scopes).toContain("payroll.read");
      expect(scopes).toContain("payroll.export");
      expect(scopes).toContain("leaves.read");
      expect(scopes).toContain("leaves.write");
      expect(scopes).toContain("organization.read");
      expect(scopes).toContain("integrations.read");
      expect(scopes).toContain("integrations.write");
      expect(scopes).toContain("webhooks.manage");
    });
  });

  // ==========================================================================
  // PART 2: CRYPTO, IDEMPOTENCY & VALIDATION TESTS
  // ==========================================================================
  describe("Crypto, Correlation & Validation Tests", () => {
    it("2.1 validateConnectorConfig truthfully blocks unconfigured government platforms", () => {
      const res = validateConnectorConfig("qiwa", {});
      expect(res.isValid).toBe(false);
      expect(res.message).toContain("BLOCKED — CREDENTIALS NOT CONFIGURED");
      expect(res.missingFields.length).toBeGreaterThan(0);
    });

    it("2.2 validateConnectorConfig truthfully blocks unconfigured ERP platforms", () => {
      const res = validateConnectorConfig("odoo", {});
      expect(res.isValid).toBe(false);
      expect(res.message).toContain("BLOCKED — CREDENTIALS NOT CONFIGURED");
    });

    it("2.3 validateConnectorConfig approves properly credentialed configs", () => {
      const validQiwa = validateConnectorConfig("qiwa", {
        establishment_id: "7001234567",
        api_key: "qiwa_sec_live_98a72b",
      });
      expect(validQiwa.isValid).toBe(true);

      const validOdoo = validateConnectorConfig("odoo", {
        server_url: "https://odoo.enterprise.com",
        api_key: "odoo_token_123",
      });
      expect(validOdoo.isValid).toBe(true);
    });

    it("2.4 generateCorrelationId creates formatted unique IDs", () => {
      const id1 = generateCorrelationId("corr_test");
      const id2 = generateCorrelationId("corr_test");
      expect(id1).toMatch(/^corr_test_\d{14}_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it("2.5 generateIdempotencyKey builds deterministic keys", () => {
      const key1 = generateIdempotencyKey("sync_journals", "11111111-1111", "seed-99");
      const key2 = generateIdempotencyKey("sync_journals", "11111111-1111", "seed-99");
      expect(key1).toBe(key2);
      expect(key1).toContain("sync_journals");
      expect(key1).toContain("seed-99");
    });

    it("2.6 generateHmacSha256Signature produces reproducible signatures", async () => {
      const secret = "test_webhook_signing_secret_998";
      const timestamp = 1791234567;
      const payload = JSON.stringify({ event: "payroll.finalized", id: "pr-01" });

      const sig1 = await generateHmacSha256Signature(secret, timestamp, payload);
      const sig2 = await generateHmacSha256Signature(secret, timestamp, payload);

      expect(sig1).toBeDefined();
      expect(sig1).toBe(sig2);
      expect(typeof sig1).toBe("string");
    });
  });

  // ==========================================================================
  // PART 3: PGLITE DATABASE INTEGRATION TESTS
  // ==========================================================================
  describe("PGlite Authoritative RPC & Multi-Tenant Tests", () => {
    let db: PGlite;

    const COMPANY_A = "11111111-1111-1111-1111-111111111111";
    const COMPANY_B = "22222222-2222-2222-2222-222222222222";
    const USER_A = "33333333-3333-3333-3333-333333333333";
    const EMP_A = "44444444-4444-4444-4444-444444444444";

    beforeAll(async () => {
      db = new PGlite();

      // Auth schema & roles setup
      await db.exec(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated;
          END IF;
        END $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id uuid PRIMARY KEY,
          email text
        );
        INSERT INTO auth.users(id, email) VALUES ('${USER_A}', 'admin@company-a.com') ON CONFLICT DO NOTHING;

        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
        LANGUAGE sql STABLE
        AS $$ SELECT '${USER_A}'::uuid $$;
      `);

      // Mock companies, employees, user_roles
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.companies (
          id uuid PRIMARY KEY,
          name_ar text NOT NULL
        );
        INSERT INTO public.companies(id, name_ar) VALUES
          ('${COMPANY_A}', 'شركة الأندلس القابضة'),
          ('${COMPANY_B}', 'شركة اليمامة العالمية')
        ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS public.user_roles (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid REFERENCES auth.users(id),
          company_id uuid REFERENCES public.companies(id),
          role text NOT NULL DEFAULT 'super_admin'
        );
        INSERT INTO public.user_roles (user_id, company_id, role)
        VALUES ('${USER_A}', '${COMPANY_A}', 'super_admin')
        ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY,
          company_id uuid NOT NULL REFERENCES public.companies(id),
          employee_no text NOT NULL,
          first_name_ar text NOT NULL,
          last_name_ar text NOT NULL,
          national_id text,
          status text NOT NULL DEFAULT 'active'
        );
        INSERT INTO public.employees (id, company_id, employee_no, first_name_ar, last_name_ar, national_id)
        VALUES ('${EMP_A}', '${COMPANY_A}', 'E-1001', 'أحمد', 'السعيد', '1088776655')
        ON CONFLICT DO NOTHING;
      `);

      // Apply Prompt 23 Migration
      const migrationFile = path.resolve(
        __dirname,
        "../../supabase/migrations/20261006000000_production_integration_hub_api_webhooks_engine.sql"
      );
      const sql = fs.readFileSync(migrationFile, "utf-8");
      await db.exec(sql);
    });

    afterAll(async () => {
      await db.close();
    });

    it("3.1 ensure_canonical_connectors initializes canonical catalog with truthful statuses", async () => {
      await db.query(`SELECT public.ensure_canonical_connectors('${COMPANY_A}');`);

      const res = await db.query<{ connector_type: string; status: string; category: string }>(
        `SELECT connector_type, status, category FROM public.integration_connectors WHERE company_id = '${COMPANY_A}' ORDER BY connector_type;`
      );

      expect(res.rows.length).toBeGreaterThanOrEqual(10);

      const qiwa = res.rows.find((r) => r.connector_type === "qiwa");
      expect(qiwa).toBeDefined();
      expect(qiwa?.status).toBe("not_configured"); // Truthful status!

      const odoo = res.rows.find((r) => r.connector_type === "odoo");
      expect(odoo).toBeDefined();
      expect(odoo?.status).toBe("not_configured");

      const wps = res.rows.find((r) => r.connector_type === "wps_sif");
      expect(wps).toBeDefined();
      expect(wps?.status).toBe("configured");
    });

    it("3.2 test_connector_connection fails truthfully when external credentials are missing", async () => {
      const getQiwa = await db.query<{ id: string }>(
        `SELECT id FROM public.integration_connectors WHERE company_id = '${COMPANY_A}' AND connector_type = 'qiwa' LIMIT 1;`
      );
      const qiwaId = getQiwa.rows[0].id;

      const testRes = await db.query<{ test_connector_connection: any }>(
        `SELECT public.test_connector_connection('${qiwaId}', '${COMPANY_A}');`
      );

      const result = testRes.rows[0].test_connector_connection;
      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.error_message).toContain("BLOCKED — CREDENTIALS NOT CONFIGURED");

      // Verify authoritative integration run was recorded
      const runs = await db.query<{ status: string; error_code: string }>(
        `SELECT status, error_code FROM public.integration_runs WHERE connector_id = '${qiwaId}';`
      );
      expect(runs.rows.length).toBeGreaterThan(0);
      expect(runs.rows[0].status).toBe("failed");
      expect(runs.rows[0].error_code).toBe("CREDENTIALS_MISSING");
    });

    it("3.3 register_api_client generates client_id, hashes secret, and creates secrets metadata", async () => {
      const scopes = ["employees.read", "attendance.write", "payroll.export"];
      const res = await db.query<{ register_api_client: any }>(
        `SELECT public.register_api_client('${COMPANY_A}', 'SAP Connector App', 'Corporate ERP Sync', ARRAY['employees.read', 'attendance.write', 'payroll.export']);`
      );

      const client = res.rows[0].register_api_client;
      expect(client.client_id).toMatch(/^mdx_live_[a-z0-9]+/);
      expect(client.client_secret_plaintext).toMatch(/^mdx_sec_[a-z0-9]+/);
      expect(client.scopes).toEqual(scopes);

      // Verify database does NOT store plaintext secret
      const clientRow = await db.query<{ client_secret_hash: string }>(
        `SELECT client_secret_hash FROM public.api_clients WHERE client_id = '${client.client_id}';`
      );
      expect(clientRow.rows[0].client_secret_hash).not.toBe(client.client_secret_plaintext);
      expect(clientRow.rows[0].client_secret_hash.length).toBe(64); // SHA-256 hex length

      // Verify secrets metadata was created
      const secMeta = await db.query<{ secret_type: string; masked_preview: string }>(
        `SELECT secret_type, masked_preview FROM public.integration_secrets_metadata WHERE company_id = '${COMPANY_A}';`
      );
      expect(secMeta.rows.length).toBeGreaterThan(0);
      expect(secMeta.rows[0].masked_preview).toMatch(/^\*\*\*\*/);
    });

    it("3.4 execute_integration_run records run items and enforces idempotency", async () => {
      const getWps = await db.query<{ id: string }>(
        `SELECT id FROM public.integration_connectors WHERE company_id = '${COMPANY_A}' AND connector_type = 'wps_sif' LIMIT 1;`
      );
      const wpsId = getWps.rows[0].id;

      const idempotencyKey = "idemp_test_batch_101";
      const payload = JSON.stringify({ items: [{ employee: "E-1001", amount: 15000 }] });

      // First execution
      const exec1 = await db.query<{ execute_integration_run: any }>(
        `SELECT public.execute_integration_run('${wpsId}', '${COMPANY_A}', 'generate_wps_sif', 'outbound', '${idempotencyKey}', '${payload}'::jsonb);`
      );
      expect(exec1.rows[0].execute_integration_run.success).toBe(true);

      // Duplicate execution with same idempotency key
      const exec2 = await db.query<{ execute_integration_run: any }>(
        `SELECT public.execute_integration_run('${wpsId}', '${COMPANY_A}', 'generate_wps_sif', 'outbound', '${idempotencyKey}', '${payload}'::jsonb);`
      );
      expect(exec2.rows[0].execute_integration_run.idempotent_duplicate).toBe(true);
    });

    it("3.5 replay_integration_run preserves original run and links replay via parent_run_id", async () => {
      const getRuns = await db.query<{ id: string }>(
        `SELECT id FROM public.integration_runs WHERE company_id = '${COMPANY_A}' LIMIT 1;`
      );
      const origRunId = getRuns.rows[0].id;

      const replayRes = await db.query<{ replay_integration_run: any }>(
        `SELECT public.replay_integration_run('${origRunId}', '${COMPANY_A}');`
      );

      const res = replayRes.rows[0].replay_integration_run;
      expect(res.success).toBe(true);
      expect(res.original_run_id).toBe(origRunId);
      expect(res.new_run_id).toBeDefined();

      // Check database parent_run_id link
      const newRunRow = await db.query<{ parent_run_id: string }>(
        `SELECT parent_run_id FROM public.integration_runs WHERE id = '${res.new_run_id}';`
      );
      expect(newRunRow.rows[0].parent_run_id).toBe(origRunId);
    });

    it("3.6 ingest_biometric_punches_atomic deduplicates punches gracefully", async () => {
      const punches = JSON.stringify([
        {
          external_user_id: "E-1001",
          punch_time: "2026-10-06T08:00:00Z",
          punch_type: "check_in",
          verification_mode: "fingerprint",
        },
        {
          external_user_id: "E-1001",
          punch_time: "2026-10-06T17:00:00Z",
          punch_type: "check_out",
          verification_mode: "fingerprint",
        },
      ]);

      // Batch 1: 2 new punches
      const res1 = await db.query<{ ingest_biometric_punches_atomic: any }>(
        `SELECT public.ingest_biometric_punches_atomic('${COMPANY_A}', 'ZK-HQ-01', '${punches}'::jsonb);`
      );
      expect(res1.rows[0].ingest_biometric_punches_atomic.received).toBe(2);
      expect(res1.rows[0].ingest_biometric_punches_atomic.inserted).toBe(2);
      expect(res1.rows[0].ingest_biometric_punches_atomic.deduplicated).toBe(0);

      // Batch 2: Exact same punches repeated (network retry / device reconnect)
      const res2 = await db.query<{ ingest_biometric_punches_atomic: any }>(
        `SELECT public.ingest_biometric_punches_atomic('${COMPANY_A}', 'ZK-HQ-01', '${punches}'::jsonb);`
      );
      expect(res2.rows[0].ingest_biometric_punches_atomic.received).toBe(2);
      expect(res2.rows[0].ingest_biometric_punches_atomic.inserted).toBe(0);
      expect(res2.rows[0].ingest_biometric_punches_atomic.deduplicated).toBe(2); // Perfectly deduplicated!
    });

    it("3.7 Multi-tenant isolation: Company A connectors are isolated from Company B", async () => {
      await db.query(`SELECT public.ensure_canonical_connectors('${COMPANY_B}');`);

      const resA = await db.query<{ count: string }>(
        `SELECT count(*) FROM public.integration_connectors WHERE company_id = '${COMPANY_A}';`
      );
      const resB = await db.query<{ count: string }>(
        `SELECT count(*) FROM public.integration_connectors WHERE company_id = '${COMPANY_B}';`
      );

      expect(Number(resA.rows[0].count)).toBeGreaterThan(0);
      expect(Number(resB.rows[0].count)).toBeGreaterThan(0);

      const crossCheck = await db.query<{ count: string }>(
        `SELECT count(*) FROM public.integration_runs WHERE company_id = '${COMPANY_B}';`
      );
      expect(Number(crossCheck.rows[0].count)).toBe(0); // Company B has 0 runs while Company A has runs
    });
  });
});
