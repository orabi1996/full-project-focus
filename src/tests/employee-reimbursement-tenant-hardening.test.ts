import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261127120000_harden_employee_creation_and_reimbursement_scope.sql",
  "utf8",
);

describe.sequential("employee creation and reimbursement tenant hardening", () => {
  const db = new PGlite();
  const companyA = "10000000-0000-4000-8000-000000000001";
  const companyB = "20000000-0000-4000-8000-000000000002";
  const userA = "a0000000-0000-4000-8000-000000000001";
  const employeeA = "a1000000-0000-4000-8000-000000000001";
  const claimA = "ca000000-0000-4000-8000-000000000001";
  const claimB = "cb000000-0000-4000-8000-000000000002";

  async function setContext(userId: string | null, companyId?: string, role = "authenticated") {
    await db.exec(`RESET ROLE; SET ROLE ${role};`);
    await db.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({
      ...(userId ? { sub: userId } : {}),
      role,
      ...(companyId ? { company_id: companyId } : {}),
    })]);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    await db.query("SELECT set_config('request.jwt.claim.role', $1, false)", [role]);
  }

  async function createEmployee(targetCompanyId?: string) {
    const targetArg = targetCompanyId ? `, p_target_company_id => '${targetCompanyId}'` : "";
    return db.query<{ result: { company_id: string } }>(`SELECT public.create_employee(
      p_first_name_ar => 'فاطمة',
      p_last_name_ar => 'علي',
      p_hire_date => DATE '2026-01-01',
      p_contract_type => 'full_time',
      p_work_type => 'on_site'${targetArg}
    ) AS result`);
  }

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
      CREATE TYPE public.app_role AS ENUM ('super_admin', 'org_admin', 'hr_manager', 'finance_officer');
      CREATE TABLE public.companies (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now());
      CREATE TABLE public.employees (id uuid, user_id uuid, company_id uuid, status text);
      CREATE TABLE public.user_company_access (user_id uuid, company_id uuid, status text);
      CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
      CREATE TABLE public.expense_claims (
        id uuid PRIMARY KEY, company_id uuid, employee_id uuid,
        amount numeric, converted_amount numeric, status text,
        payment_method text, reimbursement_status text
      );
      CREATE TABLE public.reimbursement_batches (
        id uuid DEFAULT gen_random_uuid(), company_id uuid, idempotency_key text
      );
      CREATE FUNCTION public.current_user_has_any_role(p_roles text[])
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role::text = ANY(p_roles)
        )
      $$;
      CREATE FUNCTION public.current_company_id()
      RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_uid uuid := auth.uid(); v_claims jsonb; v_claim uuid; v_count integer; v_company uuid;
      BEGIN
        v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
        IF auth.role() = 'service_role' THEN
          IF v_claims ? 'company_id' THEN
            v_claim := (v_claims ->> 'company_id')::uuid;
            IF EXISTS (SELECT 1 FROM public.companies WHERE id = v_claim) THEN RETURN v_claim; END IF;
          END IF;
          RETURN NULL;
        END IF;
        IF v_uid IS NULL THEN RETURN NULL; END IF;
        IF v_claims ? 'company_id' THEN
          v_claim := (v_claims ->> 'company_id')::uuid;
          IF EXISTS (SELECT 1 FROM public.companies c WHERE c.id = v_claim)
            AND (EXISTS (SELECT 1 FROM public.employees e WHERE e.user_id=v_uid AND e.company_id=v_claim AND e.status NOT IN ('terminated','suspended'))
              OR EXISTS (SELECT 1 FROM public.user_company_access u WHERE u.user_id=v_uid AND u.company_id=v_claim AND u.status='active'))
          THEN RETURN v_claim; END IF;
          RETURN NULL;
        END IF;
        WITH memberships AS (
          SELECT company_id FROM public.employees WHERE user_id=v_uid AND status NOT IN ('terminated','suspended')
          UNION SELECT company_id FROM public.user_company_access WHERE user_id=v_uid AND status='active'
        ) SELECT count(*), min(company_id::text)::uuid INTO v_count, v_company FROM memberships;
        IF v_count = 1 THEN RETURN v_company; END IF;
        RETURN NULL;
      END $$;

      CREATE FUNCTION public.create_employee(
        p_first_name_ar text, p_last_name_ar text, p_first_name_en text DEFAULT NULL,
        p_last_name_en text DEFAULT NULL, p_email text DEFAULT NULL, p_phone text DEFAULT NULL,
        p_national_id_or_iqama text DEFAULT NULL, p_nationality text DEFAULT NULL,
        p_gender text DEFAULT NULL, p_birth_date date DEFAULT NULL,
        p_marital_status text DEFAULT NULL, p_hire_date date DEFAULT NULL,
        p_contract_type text DEFAULT NULL, p_job_title text DEFAULT NULL,
        p_department_id uuid DEFAULT NULL, p_subsidiary_id uuid DEFAULT NULL,
        p_work_location_id uuid DEFAULT NULL, p_job_position_id uuid DEFAULT NULL,
        p_cost_center_id uuid DEFAULT NULL, p_manager_id uuid DEFAULT NULL,
        p_work_type text DEFAULT NULL, p_basic_salary numeric DEFAULT 0,
        p_housing_allowance numeric DEFAULT 0, p_transport_allowance numeric DEFAULT 0,
        p_other_allowances numeric DEFAULT 0, p_bank_name text DEFAULT NULL,
        p_iban text DEFAULT NULL, p_job_grade text DEFAULT NULL, p_target_company_id uuid DEFAULT NULL
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_company uuid;
      BEGIN
        v_company := COALESCE(p_target_company_id, public.current_company_id());
        IF v_company IS NULL THEN SELECT id INTO v_company FROM public.companies ORDER BY created_at LIMIT 1; END IF;
        RETURN jsonb_build_object('company_id', v_company, 'first_name_ar', p_first_name_ar);
      END $$;

      CREATE FUNCTION public.prepare_reimbursement_batch_atomic(
        p_period_key text, p_claim_ids uuid[], p_payment_method text DEFAULT 'direct_bank_transfer',
        p_bank_account_id uuid DEFAULT NULL, p_notes text DEFAULT NULL, p_idempotency_key text DEFAULT NULL
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_company uuid := public.current_company_id(); v_claim record;
      BEGIN
        IF v_company IS NULL THEN SELECT id INTO v_company FROM public.companies LIMIT 1; END IF;
        FOR v_claim IN SELECT company_id FROM public.expense_claims WHERE id = ANY(p_claim_ids) LOOP
          IF v_company IS NOT NULL AND v_claim.company_id IS NOT NULL AND v_company <> v_claim.company_id THEN
            RAISE EXCEPTION 'cross company claim';
          END IF;
        END LOOP;
        INSERT INTO public.reimbursement_batches(company_id,idempotency_key) VALUES(v_company,p_idempotency_key);
        RETURN jsonb_build_object('company_id',v_company);
      END $$;

      INSERT INTO public.companies(id, created_at) VALUES
        ('${companyA}', '2026-01-01'), ('${companyB}', '2026-02-01');
      INSERT INTO public.employees VALUES ('${employeeA}', '${userA}', '${companyA}', 'active');
      INSERT INTO public.user_roles VALUES ('${userA}', 'hr_manager'), ('${userA}', 'finance_officer');
      INSERT INTO public.expense_claims VALUES
        ('${claimA}', '${companyA}', '${employeeA}', 100, 100, 'approved', 'employee_paid', 'unreimbursed'),
        ('${claimB}', '${companyB}', '${employeeA}', 200, 200, 'approved', 'employee_paid', 'unreimbursed');
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    `);
    await db.exec(migration);
  });

  afterAll(async () => {
    await db.close();
  });

  it("creates under an inferred active company and preserves an authorized explicit target", async () => {
    await setContext(userA);
    expect((await createEmployee()).rows[0].result.company_id).toBe(companyA);

    await db.exec(`INSERT INTO public.user_company_access VALUES ('${userA}', '${companyB}', 'active')`);
    await expect(createEmployee()).rejects.toThrow(/معرف المنشأة غير محدد/);
    expect((await createEmployee(companyB)).rows[0].result.company_id).toBe(companyB);
  });

  it("denies unauthenticated, unauthorized, invalid-company, and anon create calls", async () => {
    await setContext(null, undefined, "service_role");
    await expect(createEmployee(companyA)).rejects.toThrow(/permission denied/);

    await setContext(userA, companyA);
    await db.exec(`DELETE FROM public.user_roles WHERE user_id = '${userA}'`);
    await expect(createEmployee()).rejects.toThrow(/غير مصرح لك بإنشاء موظف/);

    await db.exec(`INSERT INTO public.user_roles VALUES ('${userA}', 'hr_manager')`);
    await expect(createEmployee('30000000-0000-4000-8000-000000000003')).rejects.toThrow(/غير محدد أو غير صالح/);

    await db.exec("RESET ROLE; SET ROLE anon;");
    await expect(createEmployee(companyA)).rejects.toThrow(/permission denied/);
  });

  it("requires reimbursement company scope and rejects cross-company claims", async () => {
    await setContext(null, undefined, "service_role");
    await expect(db.query(
      "SELECT public.prepare_reimbursement_batch_atomic('2026-09', ARRAY[$1::uuid])",
      [claimA],
    )).rejects.toThrow(/معرف الشركة غير محدد/);

    await setContext(userA, companyA);
    await expect(db.query(
      "SELECT public.prepare_reimbursement_batch_atomic('2026-09', ARRAY[$1::uuid])",
      [claimB],
    )).rejects.toThrow(/كل المطالبات/);
    expect((await db.query<{ result: { company_id: string } }>(
      "SELECT public.prepare_reimbursement_batch_atomic('2026-09', ARRAY[$1::uuid]) AS result",
      [claimA],
    )).rows[0].result.company_id).toBe(companyA);

    await setContext(null, companyB, "service_role");
    expect((await db.query<{ result: { company_id: string } }>(
      "SELECT public.prepare_reimbursement_batch_atomic('2026-09', ARRAY[$1::uuid]) AS result",
      [claimB],
    )).rows[0].result.company_id).toBe(companyB);
  });
});
