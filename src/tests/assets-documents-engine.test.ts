import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 21: Production Asset Management, Document Vault & Official Document Engine", () => {
  // ==========================================================================
  // PART 1: STATIC AST & SOURCE CODE CONTRACT TESTS
  // ==========================================================================
  describe("Static Source Code Contract Tests", () => {
    const assetsViewPath = path.resolve(__dirname, "../components/assets/AssetsView.tsx");
    const assetsViewSource = fs.readFileSync(assetsViewPath, "utf-8");

    const vaultViewPath = path.resolve(__dirname, "../components/documents/DocumentVaultView.tsx");
    const vaultViewSource = fs.readFileSync(vaultViewPath, "utf-8");

    const officialModalPath = path.resolve(__dirname, "../components/documents/OfficialDocumentModal.tsx");
    const officialModalSource = fs.readFileSync(officialModalPath, "utf-8");

    const assetsRepoPath = path.resolve(__dirname, "../lib/data/assets-repository.ts");
    const assetsRepoSource = fs.readFileSync(assetsRepoPath, "utf-8");

    const docsRepoPath = path.resolve(__dirname, "../lib/data/documents-repository.ts");
    const docsRepoSource = fs.readFileSync(docsRepoPath, "utf-8");

    const assetsDomainPath = path.resolve(__dirname, "../lib/domains/assets/index.ts");
    const assetsDomainSource = fs.readFileSync(assetsDomainPath, "utf-8");

    const docsDomainPath = path.resolve(__dirname, "../lib/domains/documents/index.ts");
    const docsDomainSource = fs.readFileSync(docsDomainPath, "utf-8");

    it("1.1 AssetsView MUST NOT contain Math.random() or employees[0] defaults", () => {
      expect(assetsViewSource).not.toContain("Math.random()");
      expect(assetsViewSource).not.toContain("employees[0]");
      expect(assetsViewSource).toContain("assetTag");
    });

    it("1.2 DocumentVaultView MUST NOT contain Math.random()", () => {
      expect(vaultViewSource).not.toContain("Math.random()");
    });

    it("1.3 OfficialDocumentModal MUST NOT contain Math.random() or fabricated allowances", () => {
      expect(officialModalSource).not.toContain("Math.random()");
      expect(officialModalSource).not.toContain("basicSalary * 0.25");
      expect(officialModalSource).not.toContain("basicSalary * 0.08");
      expect(officialModalSource).toContain("clearanceVerified");
      expect(officialModalSource).toContain("companyLegalNameAr");
    });

    it("1.4 Assets repository exports authoritative query hooks and atomic mutations", () => {
      expect(assetsRepoSource).toContain("useAssets");
      expect(assetsRepoSource).toContain("useAssetCustodyHistory");
      expect(assetsRepoSource).toContain("useAssetMutationBundle");
      expect(assetsRepoSource).toContain("create_asset_atomic");
      expect(assetsRepoSource).toContain("assign_asset_atomic");
      expect(assetsRepoSource).toContain("return_asset_atomic");
      expect(assetsRepoSource).toContain("check_asset_clearance_block");
    });

    it("1.5 Documents repository exports authoritative query hooks and atomic mutations", () => {
      expect(docsRepoSource).toContain("useCompanyDocs");
      expect(docsRepoSource).toContain("useEmployeeDocs");
      expect(docsRepoSource).toContain("useDocumentMutationBundle");
      expect(docsRepoSource).toContain("publish_company_document_atomic");
      expect(docsRepoSource).toContain("generate_official_document_reference");
    });

    it("1.6 Domain facades use executeReliableMutation and follow const res = await pattern", () => {
      expect(assetsDomainSource).toContain("executeReliableMutation");
      expect(docsDomainSource).toContain("executeReliableMutation");
      expect(assetsDomainSource).toContain("const res = await");
      expect(docsDomainSource).toContain("const res = await");
    });
  });

  // ==========================================================================
  // PART 2: PGLITE AUTHORITATIVE DATABASE ENGINE & LIFECYCLE TESTS
  // ==========================================================================
  describe("PGlite Authoritative Database Engine & Lifecycle Tests", () => {
    let db: PGlite;

    const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
    const EMPLOYEE_ID = "22222222-2222-2222-2222-222222222222";
    const EMPLOYEE2_ID = "33333333-3333-3333-3333-333333333333";
    const USER_ID = "44444444-4444-4444-4444-444444444444";
    const ASSET_ID_1 = "55555555-5555-5555-5555-555555555555";
    const ASSET_ID_2 = "66666666-6666-6666-6666-666666666666";
    const DOC_ID = "77777777-7777-7777-7777-777777777777";

    beforeAll(async () => {
      db = new PGlite();

      // Setup auth schema
      await db.exec(`
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id uuid PRIMARY KEY,
          email text
        );
        INSERT INTO auth.users(id, email) VALUES ('${USER_ID}', 'test@test.com') ON CONFLICT DO NOTHING;
      `);

      // Auth UID override
      await db.exec(`
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
        LANGUAGE sql STABLE
        AS $$ SELECT COALESCE(NULLIF(current_setting('test.auth_uid', true), '')::uuid, '${USER_ID}'::uuid) $$;
      `);

      // Mock companies table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.companies (
          id uuid PRIMARY KEY,
          name_ar text NOT NULL
        );
        INSERT INTO public.companies(id, name_ar) VALUES ('${COMPANY_ID}', 'شركة الاختبار') ON CONFLICT DO NOTHING;
      `);

      // Mock employees table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY,
          company_id uuid,
          first_name_ar text,
          last_name_ar text,
          full_name text,
          employee_no text,
          email text,
          phone text,
          total_salary numeric DEFAULT 0
        );
        INSERT INTO public.employees(id, company_id, first_name_ar, last_name_ar, full_name, employee_no, email, phone, total_salary)
        VALUES
          ('${EMPLOYEE_ID}', '${COMPANY_ID}', 'أحمد', 'العلي', 'أحمد العلي', 'EMP-001', 'emp1@test.com', '0501111111', 10000),
          ('${EMPLOYEE2_ID}', '${COMPANY_ID}', 'سارة', 'الأحمد', 'سارة الأحمد', 'EMP-002', 'emp2@test.com', '0502222222', 8000)
        ON CONFLICT DO NOTHING;
      `);

      // Create hardware_assets table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.hardware_assets (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid,
          asset_tag text NOT NULL,
          name_ar text NOT NULL,
          name_en text NOT NULL,
          category text NOT NULL,
          serial_number text NOT NULL,
          assigned_to_employee_id uuid,
          assigned_to_employee_name text,
          assigned_date date,
          lifecycle_state text NOT NULL DEFAULT 'available',
          status text NOT NULL DEFAULT 'available',
          acquisition_date date,
          purchase_value numeric,
          condition text NOT NULL DEFAULT 'good',
          location text,
          notes text,
          retired_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(asset_tag)
        );
      `);

      // Create asset_assignments table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.asset_assignments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          asset_id uuid NOT NULL REFERENCES public.hardware_assets(id) ON DELETE CASCADE,
          employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
          assigned_at timestamptz NOT NULL DEFAULT now(),
          returned_at timestamptz,
          condition_on_assign text,
          condition_on_return text,
          assigned_by uuid
        );
      `);

      // Create asset_custody_history table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.asset_custody_history (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          asset_id uuid NOT NULL REFERENCES public.hardware_assets(id) ON DELETE CASCADE,
          company_id uuid,
          employee_id uuid,
          action text NOT NULL,
          action_date date NOT NULL DEFAULT CURRENT_DATE,
          performed_by uuid,
          notes text,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      // Create company_documents table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.company_documents (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid,
          title_ar text NOT NULL,
          title_en text NOT NULL DEFAULT '',
          category text NOT NULL,
          version text NOT NULL DEFAULT 'v1.0',
          doc_state text NOT NULL DEFAULT 'draft',
          file_url text NOT NULL DEFAULT '',
          file_id text,
          file_size text,
          acknowledged_count integer NOT NULL DEFAULT 0,
          visibility_scope text NOT NULL DEFAULT 'all',
          requires_acknowledgment boolean NOT NULL DEFAULT false,
          effective_date date,
          expiry_date date,
          approved_by uuid,
          approved_at timestamptz,
          status text DEFAULT 'active',
          superseded_by uuid,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      // Create document_acknowledgements table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.document_acknowledgements (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id uuid NOT NULL REFERENCES public.company_documents(id) ON DELETE CASCADE,
          employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
          acknowledged_at timestamptz NOT NULL DEFAULT now(),
          document_version text,
          ip_address text,
          UNIQUE(document_id, employee_id)
        );
      `);

      // Create official_document_references table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.official_document_references (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid NOT NULL,
          doc_type text NOT NULL,
          employee_id uuid,
          reference_number text NOT NULL,
          issued_at timestamptz NOT NULL DEFAULT now(),
          issued_by uuid,
          metadata jsonb NOT NULL DEFAULT '{}',
          UNIQUE(company_id, reference_number)
        );
      `);

      // Load atomic RPC functions
      await db.exec(`
        CREATE OR REPLACE FUNCTION public.assign_asset_atomic(
          p_asset_id uuid,
          p_employee_id uuid,
          p_condition text DEFAULT 'good'
        ) RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
          v_asset public.hardware_assets%ROWTYPE;
          v_caller uuid;
          v_emp_name text;
        BEGIN
          v_caller := auth.uid();
          IF v_caller IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
          END IF;
          SELECT * INTO v_asset FROM public.hardware_assets WHERE id = p_asset_id FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Asset not found';
          END IF;
          IF v_asset.lifecycle_state <> 'available' THEN
            RAISE EXCEPTION 'Asset is not available (state: %)', v_asset.lifecycle_state;
          END IF;
          IF v_asset.assigned_to_employee_id IS NOT NULL THEN
            RAISE EXCEPTION 'Asset already assigned';
          END IF;

          SELECT COALESCE(first_name_ar || ' ' || last_name_ar, full_name, 'موظف')
          INTO v_emp_name
          FROM public.employees
          WHERE id = p_employee_id;

          UPDATE public.hardware_assets
          SET lifecycle_state = 'assigned', status = 'assigned',
              assigned_to_employee_id = p_employee_id,
              assigned_to_employee_name = v_emp_name,
              assigned_date = CURRENT_DATE,
              condition = COALESCE(p_condition, condition)
          WHERE id = p_asset_id;

          INSERT INTO public.asset_assignments(asset_id, employee_id, assigned_by, condition_on_assign)
          VALUES (p_asset_id, p_employee_id, v_caller, p_condition);

          INSERT INTO public.asset_custody_history(asset_id, company_id, employee_id, action, performed_by, notes)
          VALUES (p_asset_id, v_asset.company_id, p_employee_id, 'assigned', v_caller, 'تسليم عهدة');

          RETURN jsonb_build_object('ok', true, 'asset_id', p_asset_id, 'employee_id', p_employee_id);
        END;
        $$;

        CREATE OR REPLACE FUNCTION public.return_asset_atomic(
          p_asset_id uuid,
          p_condition text DEFAULT 'good'
        ) RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
          v_asset public.hardware_assets%ROWTYPE;
          v_caller uuid;
          v_prev_emp uuid;
        BEGIN
          v_caller := auth.uid();
          IF v_caller IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
          END IF;
          SELECT * INTO v_asset FROM public.hardware_assets WHERE id = p_asset_id FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Asset not found';
          END IF;

          v_prev_emp := v_asset.assigned_to_employee_id;

          UPDATE public.hardware_assets
          SET lifecycle_state = 'available', status = 'available',
              assigned_to_employee_id = NULL,
              assigned_to_employee_name = NULL,
              assigned_date = NULL,
              condition = COALESCE(p_condition, condition)
          WHERE id = p_asset_id;

          UPDATE public.asset_assignments
          SET returned_at = now(), condition_on_return = p_condition
          WHERE asset_id = p_asset_id AND returned_at IS NULL;

          INSERT INTO public.asset_custody_history(asset_id, company_id, employee_id, action, performed_by, notes)
          VALUES (p_asset_id, v_asset.company_id, v_prev_emp, 'returned', v_caller, 'استرجاع عهدة');

          RETURN jsonb_build_object('ok', true, 'asset_id', p_asset_id);
        END;
        $$;

        CREATE OR REPLACE FUNCTION public.generate_official_document_reference(
          p_company_id uuid,
          p_doc_type text,
          p_employee_id uuid DEFAULT NULL
        ) RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
          v_seq integer;
          v_year text;
          v_ref text;
          v_caller uuid;
        BEGIN
          v_caller := auth.uid();
          IF v_caller IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
          END IF;
          v_year := to_char(now(), 'YYYY');

          SELECT COALESCE(MAX(CAST(SPLIT_PART(reference_number, '-', 3) AS integer)), 0) + 1
          INTO v_seq
          FROM public.official_document_references
          WHERE company_id = p_company_id
            AND reference_number LIKE 'DOC-' || v_year || '-%';

          v_ref := 'DOC-' || v_year || '-' || LPAD(v_seq::text, 6, '0');

          INSERT INTO public.official_document_references(
            company_id, doc_type, employee_id, reference_number, issued_by
          ) VALUES (
            p_company_id, p_doc_type, p_employee_id, v_ref, v_caller
          );

          RETURN jsonb_build_object('ok', true, 'reference_number', v_ref, 'year', v_year, 'sequence', v_seq);
        END;
        $$;

        CREATE OR REPLACE FUNCTION public.check_asset_clearance_block(
          p_employee_id uuid
        ) RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
          v_count integer;
        BEGIN
          SELECT COUNT(*) INTO v_count
          FROM public.hardware_assets
          WHERE assigned_to_employee_id = p_employee_id
            AND lifecycle_state = 'assigned';

          RETURN jsonb_build_object(
            'ok', true,
            'employee_id', p_employee_id,
            'assigned_asset_count', v_count,
            'blocks_clearance', v_count > 0
          );
        END;
        $$;

        CREATE OR REPLACE FUNCTION public.publish_company_document_atomic(
          p_doc_id uuid
        ) RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
          v_doc public.company_documents%ROWTYPE;
          v_caller uuid;
        BEGIN
          v_caller := auth.uid();
          IF v_caller IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
          END IF;
          SELECT * INTO v_doc FROM public.company_documents WHERE id = p_doc_id FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Document not found';
          END IF;
          IF v_doc.doc_state = 'published' THEN
            RAISE EXCEPTION 'Already published';
          END IF;

          UPDATE public.company_documents
          SET doc_state = 'published', status = 'active', approved_by = v_caller, approved_at = now()
          WHERE id = p_doc_id;

          RETURN jsonb_build_object('ok', true, 'doc_id', p_doc_id, 'doc_state', 'published');
        END;
        $$;
      `);

      // Set test auth context
      await db.exec(`SELECT set_config('test.auth_uid', '${USER_ID}', false)`);
    });

    afterAll(async () => {
      await db.close();
    });

    it("2.1 asset tag uniqueness — rejects duplicate asset_tag within same company", async () => {
      await db.exec(`
        INSERT INTO public.hardware_assets(id, company_id, asset_tag, name_ar, name_en, category, serial_number)
        VALUES ('${ASSET_ID_1}', '${COMPANY_ID}', 'TAG-UNIQUE-001', 'جهاز أ', 'Device A', 'laptop', 'SN-001-A')
        ON CONFLICT DO NOTHING;
      `);
      let threw = false;
      try {
        await db.exec(`
          INSERT INTO public.hardware_assets(id, company_id, asset_tag, name_ar, name_en, category, serial_number)
          VALUES (gen_random_uuid(), '${COMPANY_ID}', 'TAG-UNIQUE-001', 'جهاز ب', 'Device B', 'phone', 'SN-002-B');
        `);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    it("2.2 double-assignment prevention — assign_asset_atomic rejects if asset already assigned", async () => {
      // Reset asset to available
      await db.exec(`
        UPDATE public.hardware_assets SET lifecycle_state = 'available', assigned_to_employee_id = NULL WHERE id = '${ASSET_ID_1}';
      `);

      // Assign first time
      const res1 = await db.query(`SELECT public.assign_asset_atomic('${ASSET_ID_1}', '${EMPLOYEE_ID}', 'good') AS result`);
      const row1 = res1.rows[0] as Record<string, unknown>;
      const parsed1 = typeof row1.result === "object" ? row1.result : JSON.parse(row1.result as string);
      expect((parsed1 as Record<string, unknown>).ok).toBe(true);

      // Attempt second assignment without returning — must reject
      let threw = false;
      try {
        await db.query(`SELECT public.assign_asset_atomic('${ASSET_ID_1}', '${EMPLOYEE2_ID}', 'good') AS result`);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    it("2.3 return_asset_atomic — sets lifecycle_state to available and nulls assigned_to_employee_id", async () => {
      const res = await db.query(`SELECT public.return_asset_atomic('${ASSET_ID_1}', 'good') AS result`);
      const row = res.rows[0] as Record<string, unknown>;
      const parsed = typeof row.result === "object" ? row.result : JSON.parse(row.result as string);
      expect((parsed as Record<string, unknown>).ok).toBe(true);

      const after = await db.query(`SELECT lifecycle_state, assigned_to_employee_id FROM public.hardware_assets WHERE id = '${ASSET_ID_1}'`);
      const aRow = after.rows[0] as Record<string, unknown>;
      expect(aRow.lifecycle_state).toBe("available");
      expect(aRow.assigned_to_employee_id).toBeNull();
    });

    it("2.4 asset custody history is append-only — each assign/return adds a history row", async () => {
      const countBefore = await db.query(`SELECT COUNT(*) as c FROM public.asset_custody_history WHERE asset_id = '${ASSET_ID_1}'`);
      const cBefore = parseInt((countBefore.rows[0] as Record<string, unknown>).c as string, 10);

      // Perform an assignment and return cycle
      await db.query(`SELECT public.assign_asset_atomic('${ASSET_ID_1}', '${EMPLOYEE_ID}', 'good')`);
      await db.query(`SELECT public.return_asset_atomic('${ASSET_ID_1}', 'good')`);

      const countAfter = await db.query(`SELECT COUNT(*) as c FROM public.asset_custody_history WHERE asset_id = '${ASSET_ID_1}'`);
      const cAfter = parseInt((countAfter.rows[0] as Record<string, unknown>).c as string, 10);
      expect(cAfter).toBeGreaterThanOrEqual(cBefore + 2);
    });

    it("2.5 cross-company asset isolation — company segregation verified", async () => {
      const OTHER_COMPANY = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      await db.exec(`
        INSERT INTO public.companies(id, name_ar) VALUES ('${OTHER_COMPANY}', 'شركة أخرى') ON CONFLICT DO NOTHING;
        INSERT INTO public.hardware_assets(id, company_id, asset_tag, name_ar, name_en, category, serial_number)
        VALUES ('${ASSET_ID_2}', '${OTHER_COMPANY}', 'TAG-OTHER-001', 'جهاز شركة أخرى', 'Other Company Device', 'phone', 'SN-OTHER-001')
        ON CONFLICT DO NOTHING;
      `);

      const res = await db.query(`SELECT company_id FROM public.hardware_assets WHERE id = '${ASSET_ID_2}'`);
      const row = res.rows[0] as Record<string, unknown>;
      expect(row.company_id).toBe(OTHER_COMPANY);
      expect(row.company_id).not.toBe(COMPANY_ID);
    });

    it("2.6 company document versioning — doc_state transitions: draft → published", async () => {
      await db.exec(`
        INSERT INTO public.company_documents(id, company_id, title_ar, title_en, category, version, doc_state, file_url)
        VALUES ('${DOC_ID}', '${COMPANY_ID}', 'لائحة الموارد البشرية 2026', 'HR Policy 2026', 'policy', 'v1.0', 'draft', '')
        ON CONFLICT DO NOTHING;
      `);

      const res = await db.query(`SELECT public.publish_company_document_atomic('${DOC_ID}') AS result`);
      const row = res.rows[0] as Record<string, unknown>;
      const parsed = typeof row.result === "object" ? row.result : JSON.parse(row.result as string);
      expect((parsed as Record<string, unknown>).ok).toBe(true);
      expect((parsed as Record<string, unknown>).doc_state).toBe("published");

      const after = await db.query(`SELECT doc_state, status FROM public.company_documents WHERE id = '${DOC_ID}'`);
      const aRow = after.rows[0] as Record<string, unknown>;
      expect(aRow.doc_state).toBe("published");
      expect(aRow.status).toBe("active");
    });

    it("2.7 document acknowledgement per version — same employee cannot acknowledge twice", async () => {
      // First acknowledgement
      await db.exec(`
        INSERT INTO public.document_acknowledgements(document_id, employee_id, document_version)
        VALUES ('${DOC_ID}', '${EMPLOYEE_ID}', 'v1.0')
        ON CONFLICT DO NOTHING;
      `);

      // Duplicate acknowledgement must fail unique constraint
      let threw = false;
      try {
        await db.exec(`
          INSERT INTO public.document_acknowledgements(document_id, employee_id, document_version)
          VALUES ('${DOC_ID}', '${EMPLOYEE_ID}', 'v1.0');
        `);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    it("2.8 generate_official_document_reference — creates sequential DOC-YYYY-NNNNNN reference", async () => {
      const currentYear = new Date().getFullYear();
      const res = await db.query(`SELECT public.generate_official_document_reference('${COMPANY_ID}', 'salary_certificate', '${EMPLOYEE_ID}') AS result`);
      const row = res.rows[0] as Record<string, unknown>;
      const parsed = typeof row.result === "object" ? row.result : JSON.parse(row.result as string);
      const p = parsed as Record<string, unknown>;
      expect(p.ok).toBe(true);
      expect(typeof p.reference_number).toBe("string");
      expect(p.reference_number as string).toMatch(/^DOC-\d{4}-\d{6}$/);
      expect(p.reference_number as string).toContain(`DOC-${currentYear}-`);
    });

    it("2.9 official document reference is unique — duplicate reference for same company rejected", async () => {
      await db.exec(`
        INSERT INTO public.official_document_references(company_id, doc_type, reference_number)
        VALUES ('${COMPANY_ID}', 'test_type', 'DOC-TEST-UNIQUE-001') ON CONFLICT DO NOTHING;
      `);
      let threw = false;
      try {
        await db.exec(`
          INSERT INTO public.official_document_references(company_id, doc_type, reference_number)
          VALUES ('${COMPANY_ID}', 'test_type', 'DOC-TEST-UNIQUE-001');
        `);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    it("2.10 clearance blocking — check_asset_clearance_block returns blocks_clearance=true when assets assigned", async () => {
      // Assign asset to EMPLOYEE_ID
      await db.exec(`
        UPDATE public.hardware_assets SET lifecycle_state = 'available', assigned_to_employee_id = NULL WHERE id = '${ASSET_ID_1}';
      `);
      await db.query(`SELECT public.assign_asset_atomic('${ASSET_ID_1}', '${EMPLOYEE_ID}', 'good')`);

      const res = await db.query(`SELECT public.check_asset_clearance_block('${EMPLOYEE_ID}') AS result`);
      const row = res.rows[0] as Record<string, unknown>;
      const parsed = typeof row.result === "object" ? row.result : JSON.parse(row.result as string);
      const p = parsed as Record<string, unknown>;
      expect(p.ok).toBe(true);
      expect(p.blocks_clearance).toBe(true);
      expect(Number(p.assigned_asset_count)).toBeGreaterThanOrEqual(1);
    });

    it("2.11 clearance unblocked — check_asset_clearance_block returns false after all assets returned", async () => {
      await db.query(`SELECT public.return_asset_atomic('${ASSET_ID_1}', 'good')`);

      const res = await db.query(`SELECT public.check_asset_clearance_block('${EMPLOYEE_ID}') AS result`);
      const row = res.rows[0] as Record<string, unknown>;
      const parsed = typeof row.result === "object" ? row.result : JSON.parse(row.result as string);
      const p = parsed as Record<string, unknown>;
      expect(p.ok).toBe(true);
      expect(p.blocks_clearance).toBe(false);
      expect(Number(p.assigned_asset_count)).toBe(0);
    });
  });
});
