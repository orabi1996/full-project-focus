import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  PROFILE_CHANGE_FIELDS_CATALOG,
} from "../lib/domains/ess";
import { essQueryKeys } from "../lib/query/ess-query-keys";
import { queryKeys } from "../lib/query/query-keys";

describe.sequential("Prompt 25: Employee Self-Service, Manager Self-Service & Mobile Experience", () => {
  // ==========================================================================
  // PART 1: STATIC SOURCE CODE CONTRACT TESTS
  // ==========================================================================
  describe("Static Source Code Contract Tests", () => {
    const essViewPath = path.resolve(__dirname, "../components/ess/EssMobileView.tsx");
    const essViewSource = fs.readFileSync(essViewPath, "utf-8");

    const appContextPath = path.resolve(__dirname, "../lib/context/AppContext.tsx");
    const appContextSource = fs.readFileSync(appContextPath, "utf-8");

    const essRepoPath = path.resolve(__dirname, "../lib/data/ess-repository.ts");
    const essRepoSource = fs.readFileSync(essRepoPath, "utf-8");

    const essDomainPath = path.resolve(__dirname, "../lib/domains/ess/index.ts");
    const essDomainSource = fs.readFileSync(essDomainPath, "utf-8");

    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/20261008000000_production_employee_manager_self_service_mobile.sql"
    );
    const migrationSource = fs.readFileSync(migrationPath, "utf-8");

    it("1.1 EssMobileView MUST NOT contain fake phone mockup wrappers or notch simulations", () => {
      expect(essViewSource).not.toContain("sm:rounded-[44px]");
      expect(essViewSource).not.toContain("sm:border-[6px]");
      expect(essViewSource).not.toContain("Phone Speaker & Dynamic Island Notch");
    });

    it("1.2 EssMobileView MUST NOT fall back to arbitrary employees[0]", () => {
      expect(essViewSource).not.toContain("employees[0]");
      expect(essViewSource).not.toContain("emps[0]");
    });

    it("1.3 AppContext currentUser resolution MUST NOT fall back to arbitrary emps[0]", () => {
      expect(appContextSource).not.toContain('bootstrap.dataMode === "demo" && emps[0]');
    });

    it("1.4 EssMobileView MUST support both ESS and MSS (Manager Self-Service) view modes", () => {
      expect(essViewSource).toContain('viewMode === "ess"');
      expect(essViewSource).toContain('viewMode === "mss"');
      expect(essViewSource).toContain("isManagerUser");
      expect(essViewSource).toContain("teamSummary");
      expect(essViewSource).toContain("teamMembers");
    });

    it("1.5 EssMobileView MUST provide Mobile Bottom Navigation with safe-area spacing", () => {
      expect(essViewSource).toContain("fixed bottom-0 inset-x-0");
      expect(essViewSource).toContain("safe-area-pb");
      expect(essViewSource).toContain("setActiveTab");
    });

    it("1.6 EssMobileView MUST support Official Profile Change Requests and Sensitive Data Masking", () => {
      expect(essViewSource).toContain("showSensitiveData");
      expect(essViewSource).toContain("PROFILE_CHANGE_FIELDS_CATALOG");
      expect(essViewSource).toContain("isProfileChangeModalOpen");
      expect(essViewSource).toContain("handleSubmitProfileChange");
      expect(essViewSource).toContain("handleReviewPcr");
    });

    it("1.7 Migration MUST declare employee_profile_change_requests and RPC functions", () => {
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.employee_profile_change_requests");
      expect(migrationSource).toContain("get_authenticated_employee_context");
      expect(migrationSource).toContain("get_my_employee_profile");
      expect(migrationSource).toContain("update_my_direct_profile_fields");
      expect(migrationSource).toContain("submit_profile_change_request");
      expect(migrationSource).toContain("review_profile_change_request");
      expect(migrationSource).toContain("get_manager_team_summary");
      expect(migrationSource).toContain("get_manager_team_members");
    });

    it("1.8 queryKeys factory MUST integrate ess query keys", () => {
      expect(queryKeys).toHaveProperty("ess");
      expect(queryKeys.ess).toBe(essQueryKeys);
      expect(typeof queryKeys.ess.profile).toBe("function");
      expect(typeof queryKeys.ess.team.summary).toBe("function");
    });
  });

  // ==========================================================================
  // PART 2: DOMAIN CATALOG & LOGIC TESTS
  // ==========================================================================
  describe("Domain Catalog & Logic Tests", () => {
    it("2.1 PROFILE_CHANGE_FIELDS_CATALOG defines supported change fields and risk tiers", () => {
      expect(PROFILE_CHANGE_FIELDS_CATALOG).toHaveProperty("phone");
      expect(PROFILE_CHANGE_FIELDS_CATALOG).toHaveProperty("bank_iban");
      expect(PROFILE_CHANGE_FIELDS_CATALOG).toHaveProperty("marital_status");
      expect(PROFILE_CHANGE_FIELDS_CATALOG).toHaveProperty("personal_email");

      expect(PROFILE_CHANGE_FIELDS_CATALOG.phone.risk_level).toBe("low");
      expect(PROFILE_CHANGE_FIELDS_CATALOG.bank_iban.risk_level).toBe("high");
      expect(PROFILE_CHANGE_FIELDS_CATALOG.bank_iban.input_type).toBe("iban");
    });

    it("2.2 essQueryKeys generates predictable hierarchical keys", () => {
      const pKey = essQueryKeys.profile("comp-1");
      expect(pKey).toEqual(["ess", "profile", "comp-1"]);

      const teamSumKey = essQueryKeys.team.summary("comp-1");
      expect(teamSumKey).toEqual(["ess", "team", "summary", "comp-1"]);

      const teamMembersKey = essQueryKeys.team.members("comp-1");
      expect(teamMembersKey).toEqual(["ess", "team", "members", "comp-1"]);

      const pcrKey = essQueryKeys.myProfileChangeRequests("comp-1");
      expect(pcrKey).toEqual(["ess", "my-profile-change-requests", "comp-1"]);
    });
  });

  // ==========================================================================
  // PART 3: PGLITE IN-MEMORY DATABASE TESTS
  // ==========================================================================
  describe("PGlite In-Memory Database Tests", () => {
    let db: PGlite;
    const COMPANY_ID = "11111111-1111-4111-a111-111111111111";
    const USER_EMPLOYEE = "22222222-2222-4222-a222-222222222222";
    const USER_MANAGER = "33333333-3333-4333-a333-333333333333";
    const EMP_MANAGER_ID = "44444444-4444-4444-a444-444444444444";
    const EMP_EMPLOYEE_ID = "55555555-5555-4555-a555-555555555555";

    beforeAll(async () => {
      db = new PGlite();

      // Setup roles and auth schema
      await db.exec(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role;
          END IF;
        END $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id uuid PRIMARY KEY,
          email text,
          created_at timestamptz DEFAULT now()
        );

        INSERT INTO auth.users (id, email) VALUES
          ('${USER_EMPLOYEE}', 'abdullah@madarx.sa'),
          ('${USER_MANAGER}', 'sarah@madarx.sa')
        ON CONFLICT DO NOTHING;

        -- Context mock function
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
          SELECT '${USER_EMPLOYEE}'::uuid;
        $$ LANGUAGE sql STABLE;

        -- Companies table
        CREATE TABLE IF NOT EXISTS public.companies (
          id uuid PRIMARY KEY,
          legal_name_ar text,
          legal_name_en text,
          created_at timestamptz DEFAULT now()
        );
        INSERT INTO public.companies (id, legal_name_ar, legal_name_en) VALUES
          ('${COMPANY_ID}', 'شركة مدار الرقمية', 'Madar Digital Co.')
        ON CONFLICT DO NOTHING;

        CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid AS $$
          SELECT '${COMPANY_ID}'::uuid;
        $$ LANGUAGE sql STABLE;

        -- Departments table
        CREATE TABLE IF NOT EXISTS public.departments (
          id uuid PRIMARY KEY,
          company_id uuid REFERENCES public.companies(id),
          name text NOT NULL,
          created_at timestamptz DEFAULT now()
        );
        INSERT INTO public.departments (id, company_id, name) VALUES
          ('66666666-6666-4666-a666-666666666666', '${COMPANY_ID}', 'تقنية المعلومات')
        ON CONFLICT DO NOTHING;

        -- User roles table
        CREATE TABLE IF NOT EXISTS public.user_roles (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid REFERENCES auth.users(id),
          role_id text NOT NULL
        );
        INSERT INTO public.user_roles (user_id, role_id) VALUES
          ('${USER_EMPLOYEE}', 'employee'),
          ('${USER_MANAGER}', 'line_manager')
        ON CONFLICT DO NOTHING;

        -- Enums
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_status') THEN
            CREATE TYPE public.employee_status AS ENUM ('active', 'on_leave', 'probation', 'suspended', 'terminated', 'draft');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marital_status') THEN
            CREATE TYPE public.marital_status AS ENUM ('single', 'married', 'divorced', 'widowed');
          END IF;
        END $$;

        -- Employees table
        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid REFERENCES auth.users(id),
          employee_no text NOT NULL,
          full_name text NOT NULL,
          first_name_ar text,
          last_name_ar text,
          first_name_en text,
          last_name_en text,
          email text,
          phone text,
          job_title text DEFAULT '',
          job_title_ar text DEFAULT '',
          job_title_en text DEFAULT '',
          department_id uuid REFERENCES public.departments(id),
          manager_id uuid REFERENCES public.employees(id),
          manager_employee_id uuid REFERENCES public.employees(id),
          status public.employee_status DEFAULT 'active',
          hire_date date DEFAULT current_date,
          contract_type text DEFAULT 'full_time',
          national_id_or_iqama text DEFAULT '1089234567',
          nationality text DEFAULT 'سعودي',
          gender text DEFAULT 'male',
          marital_status public.marital_status DEFAULT 'married',
          avatar_url text,
          basic_salary numeric DEFAULT 15000,
          housing_allowance numeric DEFAULT 3750,
          transportation_allowance numeric DEFAULT 1000,
          total_salary numeric DEFAULT 19750,
          bank_iban text DEFAULT 'SA0380000000608010167519',
          bank_name text DEFAULT 'مصرف الراجحي',
          emergency_contact jsonb,
          custom_fields jsonb DEFAULT '{}'::jsonb,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        -- Audit events table
        CREATE TABLE IF NOT EXISTS public.audit_events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid,
          actor_id uuid,
          actor_name text,
          actor_role text,
          action text,
          entity_type text,
          entity_id text,
          entity_name text,
          changes_summary text,
          before_state jsonb,
          after_state jsonb,
          is_sensitive boolean DEFAULT false,
          created_at timestamptz DEFAULT now()
        );

        -- Attendance records table
        CREATE TABLE IF NOT EXISTS public.attendance_records (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid REFERENCES public.employees(id),
          work_date date DEFAULT current_date,
          check_in text,
          check_out text,
          status text DEFAULT 'present'
        );

        -- Leave requests table
        CREATE TABLE IF NOT EXISTS public.leave_requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid REFERENCES public.employees(id),
          start_date date,
          end_date date,
          status text DEFAULT 'pending'
        );

        -- Seed Manager
        INSERT INTO public.employees (
          id, company_id, user_id, employee_no, full_name, first_name_ar, last_name_ar, email, phone, job_title_ar, department_id, basic_salary, status
        ) VALUES (
          '${EMP_MANAGER_ID}', '${COMPANY_ID}', '${USER_MANAGER}', 'EMP-001', 'سارة المنصور', 'سارة', 'المنصور', 'sarah@madarx.sa', '0501112233', 'مدير تقنية المعلومات', '66666666-6666-4666-a666-666666666666', 30000, 'active'
        ) ON CONFLICT DO NOTHING;

        -- Seed Employee reporting to Manager
        INSERT INTO public.employees (
          id, company_id, user_id, employee_no, full_name, first_name_ar, last_name_ar, email, phone, job_title_ar, department_id, manager_id, basic_salary, status
        ) VALUES (
          '${EMP_EMPLOYEE_ID}', '${COMPANY_ID}', '${USER_EMPLOYEE}', 'EMP-005', 'عبدالله العتيبي', 'عبدالله', 'العتيبي', 'abdullah@madarx.sa', '0551234567', 'مهندس برمجيات أول', '66666666-6666-4666-a666-666666666666', '${EMP_MANAGER_ID}', 18500, 'active'
        ) ON CONFLICT DO NOTHING;

        -- resolve_my_employee_id function
        CREATE OR REPLACE FUNCTION public.resolve_my_employee_id()
        RETURNS uuid LANGUAGE plpgsql STABLE AS $$
        DECLARE
          v_emp_id uuid;
        BEGIN
          SELECT id INTO v_emp_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
          RETURN v_emp_id;
        END;
        $$;
      `);

      // Apply Prompt 25 Migration
      const migrationFile = path.resolve(
        __dirname,
        "../../supabase/migrations/20261008000000_production_employee_manager_self_service_mobile.sql"
      );
      const sqlContent = fs.readFileSync(migrationFile, "utf-8");
      await db.exec(sqlContent);
    });

    it("3.1 get_authenticated_employee_context resolves employee data and detects non-manager", async () => {
      // Caller is USER_EMPLOYEE
      const res = await db.query(`SELECT public.get_authenticated_employee_context('${COMPANY_ID}') AS ctx`);
      const ctx = (res.rows[0] as any).ctx;

      expect(ctx.found).toBe(true);
      expect(ctx.employee.employee_no).toBe("EMP-005");
      expect(ctx.employee.first_name_ar).toBe("عبدالله");
      expect(ctx.is_manager).toBe(false);
      expect(ctx.direct_reports_count).toBe(0);
    });

    it("3.2 submit_profile_change_request creates a pending request with sequence number", async () => {
      const res = await db.query(`
        SELECT public.submit_profile_change_request(
          '${COMPANY_ID}',
          'bank_iban',
          'رقم الحساب البنكي (IBAN)',
          'Bank IBAN',
          'SA0380000000608010167519',
          'SA5510000001234567890123',
          'تحديث حساب الراتب لمصرف الراجحي فرع الشركات'
        ) AS result
      `);
      const result = (res.rows[0] as any).result;

      expect(result.success).toBe(true);
      expect(result.request_number).toMatch(/^PCR-\d{4}-\d{4}$/);

      // Verify record in table
      const rows = await db.query(
        `SELECT * FROM public.employee_profile_change_requests WHERE id = '${result.id}'`
      );
      expect(rows.rows.length).toBe(1);
      const row = rows.rows[0] as any;
      expect(row.status).toBe("pending");
      expect(row.requested_value).toBe("SA5510000001234567890123");
    });

    it("3.3 update_my_direct_profile_fields updates direct contact fields immediately", async () => {
      const res = await db.query(`
        SELECT public.update_my_direct_profile_fields(
          '${COMPANY_ID}',
          '0599988877',
          'new.personal@example.com',
          '{"name": "فهد العتيبي", "relation": "أب", "phone": "0501112222"}'::jsonb
        ) AS result
      `);
      const result = (res.rows[0] as any).result;
      expect(result.success).toBe(true);

      const emp = await db.query(`SELECT phone, emergency_contact FROM public.employees WHERE id = '${EMP_EMPLOYEE_ID}'`);
      expect((emp.rows[0] as any).phone).toBe("0599988877");
      expect((emp.rows[0] as any).emergency_contact.name).toBe("فهد العتيبي");
    });

    it("3.4 get_manager_team_summary and get_manager_team_members work when authenticated as Manager", async () => {
      // Switch auth to USER_MANAGER
      await db.exec(`
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
          SELECT '${USER_MANAGER}'::uuid;
        $$ LANGUAGE sql STABLE;
      `);

      // 1. Verify manager context
      const ctxRes = await db.query(`SELECT public.get_authenticated_employee_context('${COMPANY_ID}') AS ctx`);
      const ctx = (ctxRes.rows[0] as any).ctx;
      expect(ctx.is_manager).toBe(true);
      expect(ctx.direct_reports_count).toBe(1);

      // 2. Team summary
      const sumRes = await db.query(`SELECT public.get_manager_team_summary('${COMPANY_ID}') AS summary`);
      const sum = (sumRes.rows[0] as any).summary;
      expect(sum.is_manager).toBe(true);
      expect(sum.total_team_members).toBe(1);
      expect(sum.pending_profile_changes_count).toBeGreaterThanOrEqual(1);

      // 3. Team members
      const membersRes = await db.query(`SELECT public.get_manager_team_members('${COMPANY_ID}') AS members`);
      const members = (membersRes.rows[0] as any).members;
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBe(1);
      expect(members[0].employee_no).toBe("EMP-005");
      expect(members[0].full_name).toBe("عبدالله العتيبي");
    });

    it("3.5 review_profile_change_request approves request and updates employee bank_iban", async () => {
      // Find pending request
      const reqRes = await db.query(
        `SELECT id FROM public.employee_profile_change_requests WHERE employee_id = '${EMP_EMPLOYEE_ID}' LIMIT 1`
      );
      const reqId = (reqRes.rows[0] as any).id;

      // Manager reviews and approves
      const reviewRes = await db.query(`
        SELECT public.review_profile_change_request(
          '${reqId}',
          'approved',
          'تم التحقق من خطاب الآيبان البنكي والموافقة عليه'
        ) AS result
      `);
      const result = (reviewRes.rows[0] as any).result;
      expect(result.success).toBe(true);
      expect(result.status).toBe("approved");

      // Verify that employee record was automatically updated
      const empRes = await db.query(`SELECT bank_iban FROM public.employees WHERE id = '${EMP_EMPLOYEE_ID}'`);
      expect((empRes.rows[0] as any).bank_iban).toBe("SA5510000001234567890123");
    });
  });
});
