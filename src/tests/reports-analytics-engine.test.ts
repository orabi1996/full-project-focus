import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  REPORT_CATALOG,
  METRIC_CATALOG,
  REPORT_SEMANTIC_DOMAINS,
  canUserAccessReport,
  canUserAccessField,
  resolveDatePreset,
} from "../lib/domains/reports";

describe.sequential("Prompt 22: Production Enterprise Reporting, Analytics & Export Engine", () => {
  // ==========================================================================
  // PART 1: STATIC AST & SOURCE CODE CONTRACT TESTS
  // ==========================================================================
  describe("Static Source Code Contract Tests", () => {
    const reportsViewPath = path.resolve(__dirname, "../components/reports/ReportsView.tsx");
    const reportsViewSource = fs.readFileSync(reportsViewPath, "utf-8");

    const reportsRepoPath = path.resolve(__dirname, "../lib/data/reports-repository.ts");
    const reportsRepoSource = fs.readFileSync(reportsRepoPath, "utf-8");

    const reportsDomainPath = path.resolve(__dirname, "../lib/domains/reports/index.ts");
    const reportsDomainSource = fs.readFileSync(reportsDomainPath, "utf-8");

    const migrationPath1 = path.resolve(
      __dirname,
      "../../supabase/migrations/20261004000000_production_reporting_analytics_engine.sql",
    );
    const migrationSource1 = fs.readFileSync(migrationPath1, "utf-8");

    const migrationPath2 = path.resolve(
      __dirname,
      "../../supabase/migrations/20261005000000_production_enterprise_reporting_analytics_engine.sql",
    );
    const migrationSource2 = fs.readFileSync(migrationPath2, "utf-8");

    it("1.1 ReportsView MUST NOT contain fake mock constants (|| 38 or || 78)", () => {
      expect(reportsViewSource).not.toContain("|| 38");
      expect(reportsViewSource).not.toContain("|| 78");
      expect(reportsViewSource).not.toContain("Math.random()");
    });

    it("1.2 ReportsView MUST use dedicated enterprise hooks (useExecutiveKpis & useReportData)", () => {
      expect(reportsViewSource).toContain("useExecutiveKpis");
      expect(reportsViewSource).toContain("useReportData");
      expect(reportsViewSource).toContain("useReportingEngine");
      expect(reportsViewSource).toContain("useReportFavorites");
      expect(reportsViewSource).toContain("useRecentReports");
    });

    it("1.3 Report Catalog must cover all 11 core enterprise domains", () => {
      const modules = new Set(REPORT_CATALOG.map((r) => r.module));
      expect(modules.has("employees")).toBe(true);
      expect(modules.has("attendance")).toBe(true);
      expect(modules.has("leaves")).toBe(true);
      expect(modules.has("payroll")).toBe(true);
      expect(modules.has("performance")).toBe(true);
      expect(modules.has("recruitment")).toBe(true);
      expect(modules.has("workforce")).toBe(true);
      expect(modules.has("expenses")).toBe(true);
      expect(modules.has("assets")).toBe(true);
      expect(modules.has("documents")).toBe(true);
      expect(modules.has("workflow")).toBe(true);
      expect(REPORT_CATALOG.length).toBeGreaterThanOrEqual(20);
    });

    it("1.4 Attendance reports must include Statistical, Detailed, Comprehensive, Lateness", () => {
      const attCodes = REPORT_CATALOG.filter((r) => r.module === "attendance").map((r) => r.code);
      expect(attCodes).toContain("ATT_SUMMARY"); // Statistical Summary
      expect(attCodes).toContain("ATT_DETAILED");
      expect(attCodes).toContain("ATT_COMPREHENSIVE");
      expect(attCodes).toContain("ATT_LATENESS");
      expect(attCodes).toContain("ATT_ABSENCE");
      expect(attCodes).toContain("ATT_OVERTIME");
    });

    it("1.5 Sensitive financial reports MUST have isSensitive = true", () => {
      const sensitiveCodes = ["PAY_REGISTER", "PAY_SUMMARY", "PAY_COMPONENTS", "PAY_GOSI", "EMP_MASTER"];
      for (const code of sensitiveCodes) {
        const item = REPORT_CATALOG.find((r) => r.code === code);
        expect(item, `Report ${code} should exist`).toBeDefined();
        expect(item?.isSensitive, `Report ${code} must be flagged sensitive`).toBe(true);
      }
    });

    it("1.6 Metric Catalog must define governed KPIs with formulas, owners and sources", () => {
      expect(METRIC_CATALOG.length).toBeGreaterThanOrEqual(15);
      const kpiCodes = METRIC_CATALOG.map((m) => m.metricCode);
      expect(kpiCodes).toContain("HEADCOUNT_ACTIVE");
      expect(kpiCodes).toContain("SAUDIZATION_RATE");
      expect(kpiCodes).toContain("NEW_HIRES");
      expect(kpiCodes).toContain("TURNOVER_RATE");
      expect(kpiCodes).toContain("ATTENDANCE_RATE");
      expect(kpiCodes).toContain("ABSENCE_RATE");
      expect(kpiCodes).toContain("OVERTIME_HOURS");
      expect(kpiCodes).toContain("PAYROLL_COST");
      expect(kpiCodes).toContain("EMPLOYEE_COST_AVG");

      for (const m of METRIC_CATALOG) {
        expect(m.formula).toBeDefined();
        expect(m.owner).toBeDefined();
        expect(m.sourceDomain).toBeDefined();
        expect(m.sourceTables.length).toBeGreaterThan(0);
      }
    });

    it("1.7 Ad-Hoc Report Builder semantic models must be allowlisted", () => {
      expect(REPORT_SEMANTIC_DOMAINS.length).toBeGreaterThanOrEqual(5);
      const domains = REPORT_SEMANTIC_DOMAINS.map((d) => d.key);
      expect(domains).toContain("employees");
      expect(domains).toContain("attendance");
      expect(domains).toContain("payroll");
      expect(domains).toContain("expenses");
      expect(domains).toContain("assets");
    });

    it("1.8 Migrations must contain tables and atomic RPCs", () => {
      expect(migrationSource2).toContain("CREATE TABLE IF NOT EXISTS public.report_catalog");
      expect(migrationSource2).toContain("CREATE TABLE IF NOT EXISTS public.metric_catalog");
      expect(migrationSource2).toContain("CREATE TABLE IF NOT EXISTS public.report_favorites");
      expect(migrationSource2).toContain("CREATE TABLE IF NOT EXISTS public.report_recents");
      expect(migrationSource2).toContain("CREATE TABLE IF NOT EXISTS public.scheduled_report_definitions");
      expect(migrationSource2).toContain("FUNCTION public.toggle_report_favorite");
      expect(migrationSource2).toContain("FUNCTION public.log_recent_report_access");
      expect(migrationSource2).toContain("FUNCTION public.get_executive_kpis");
      expect(migrationSource2).toContain("FUNCTION public.query_report_data_atomic");
      expect(migrationSource2).toContain("SECURITY DEFINER");
    });
  });

  // ==========================================================================
  // PART 2: DOMAIN SECURITY & PRESET BUSINESS LOGIC
  // ==========================================================================
  describe("Domain Security & Preset Business Logic", () => {
    it("2.1 canUserAccessReport enforces strict RBAC for sensitive payroll reports", () => {
      expect(canUserAccessReport("employee", "PAY_REGISTER")).toBe(false);
      expect(canUserAccessReport("recruiter", "PAY_REGISTER")).toBe(false);
      expect(canUserAccessReport("line_manager", "PAY_REGISTER")).toBe(false);

      expect(canUserAccessReport("super_admin", "PAY_REGISTER")).toBe(true);
      expect(canUserAccessReport("hr_manager", "PAY_REGISTER")).toBe(true);
      expect(canUserAccessReport("payroll_officer", "PAY_REGISTER")).toBe(true);
      expect(canUserAccessReport("finance_officer", "PAY_REGISTER")).toBe(true);
    });

    it("2.2 canUserAccessField protects sensitive field access", () => {
      expect(canUserAccessField("employee", true)).toBe(false);
      expect(canUserAccessField("employee", false)).toBe(true);
      expect(canUserAccessField("super_admin", true)).toBe(true);
      expect(canUserAccessField("payroll_officer", true)).toBe(true);
    });

    it("2.3 canUserAccessReport allows operational officers access to their functional domains", () => {
      expect(canUserAccessReport("attendance_officer", "ATT_SUMMARY")).toBe(true);
      expect(canUserAccessReport("attendance_officer", "ATT_LATENESS")).toBe(true);
      expect(canUserAccessReport("attendance_officer", "EMP_DIR")).toBe(true);
      expect(canUserAccessReport("line_manager", "ATT_SUMMARY")).toBe(true);
    });

    it("2.4 resolveDatePreset correctly computes ISO date boundaries", () => {
      const today = resolveDatePreset("today");
      expect(today.startDate).toBe(today.endDate);

      const yesterday = resolveDatePreset("yesterday");
      expect(yesterday.startDate).toBe(yesterday.endDate);
      expect(yesterday.startDate <= today.startDate).toBe(true);

      const month = resolveDatePreset("current_month");
      expect(month.startDate).toMatch(/^\d{4}-\d{2}-01$/);
      expect(month.endDate >= month.startDate).toBe(true);

      const year = resolveDatePreset("year");
      expect(year.startDate).toMatch(/^\d{4}-01-01$/);
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
    const DEPT_1 = "44444444-4444-4444-4444-444444444444";
    const DEPT_2 = "55555555-5555-5555-5555-555555555555";
    const EMP_1 = "66666666-6666-6666-6666-666666666666";
    const EMP_2 = "77777777-7777-7777-7777-777777777777";
    const EMP_B = "88888888-8888-8888-8888-888888888888";

    beforeAll(async () => {
      db = new PGlite();

      // Auth schema & roles setup
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
          email text
        );
        INSERT INTO auth.users(id, email) VALUES ('${USER_A}', 'admin@company-a.com') ON CONFLICT DO NOTHING;

        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
        LANGUAGE sql STABLE
        AS $$ SELECT '${USER_A}'::uuid $$;
      `);

      // Mock domain tables
      await db.exec(`
        CREATE TABLE IF NOT EXISTS public.companies (
          id uuid PRIMARY KEY,
          name_ar text NOT NULL
        );
        INSERT INTO public.companies(id, name_ar) VALUES
          ('${COMPANY_A}', 'شركة أ'),
          ('${COMPANY_B}', 'شركة ب')
        ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS public.departments (
          id uuid PRIMARY KEY,
          company_id uuid REFERENCES public.companies(id),
          name_ar text NOT NULL
        );
        INSERT INTO public.departments(id, company_id, name_ar) VALUES
          ('${DEPT_1}', '${COMPANY_A}', 'تقنية المعلومات'),
          ('${DEPT_2}', '${COMPANY_A}', 'الموارد البشرية')
        ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY,
          company_id uuid NOT NULL REFERENCES public.companies(id),
          department_id uuid REFERENCES public.departments(id),
          user_id uuid,
          auth_user_id uuid,
          employee_no text NOT NULL,
          first_name_ar text NOT NULL,
          last_name_ar text NOT NULL,
          first_name_en text,
          last_name_en text,
          email text,
          job_title_ar text,
          status text NOT NULL DEFAULT 'active',
          hire_date date DEFAULT CURRENT_DATE,
          nationality text DEFAULT 'SA',
          contract_type text DEFAULT 'full_time',
          work_type text DEFAULT 'on_site',
          national_id_or_iqama text DEFAULT '1099887766',
          basic_salary numeric(12,2) DEFAULT 12000.00,
          housing_allowance numeric(12,2) DEFAULT 3000.00,
          transportation_allowance numeric(12,2) DEFAULT 1000.00,
          total_salary numeric(12,2) DEFAULT 16000.00,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        INSERT INTO public.employees (
          id, company_id, department_id, employee_no, first_name_ar, last_name_ar, nationality, status, hire_date, basic_salary, housing_allowance, total_salary
        ) VALUES
          ('${EMP_1}', '${COMPANY_A}', '${DEPT_1}', 'EMP-001', 'سلطان', 'العتيبي', 'SA', 'active', '2024-01-15', 15000, 3750, 18750),
          ('${EMP_2}', '${COMPANY_A}', '${DEPT_2}', 'EMP-002', 'جون', 'دو', 'US', 'active', '2024-02-01', 12000, 3000, 15000),
          ('${EMP_B}', '${COMPANY_B}', NULL, 'EMP-999', 'فيصل', 'الغامدي', 'SA', 'active', '2024-03-01', 10000, 2500, 12500)
        ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS public.attendance_records (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid REFERENCES public.employees(id),
          work_date date NOT NULL,
          actual_in time,
          actual_out time,
          scheduled_in time,
          scheduled_out time,
          worked_hours numeric(5,2) DEFAULT 8.00,
          status text DEFAULT 'present',
          created_at timestamptz DEFAULT now()
        );

        INSERT INTO public.attendance_records (employee_id, work_date, actual_in, actual_out, worked_hours, status)
        VALUES
          ('${EMP_1}', CURRENT_DATE, '08:00:00', '16:00:00', 8.00, 'present'),
          ('${EMP_2}', CURRENT_DATE, '09:15:00', '17:15:00', 8.00, 'late')
        ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS public.requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          reference text,
          employee_id uuid REFERENCES public.employees(id),
          type text NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          start_date date,
          end_date date,
          days integer,
          amount numeric(12,2),
          reason text,
          created_at timestamptz DEFAULT now()
        );

        INSERT INTO public.requests (employee_id, type, status, days, reason)
        VALUES
          ('${EMP_1}', 'leave', 'pending', 3, 'إجازة اعتيادية')
        ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS public.payroll_runs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          year integer NOT NULL,
          month integer NOT NULL,
          status text NOT NULL DEFAULT 'locked',
          total_employees integer DEFAULT 2,
          total_net_salary numeric(14,2) DEFAULT 30000.00,
          total_employer_gosi numeric(14,2) DEFAULT 3500.00,
          created_at timestamptz DEFAULT now()
        );

        INSERT INTO public.payroll_runs (company_id, year, month, status, total_net_salary, total_employer_gosi)
        VALUES ('${COMPANY_A}', 2026, 3, 'locked', 30000.00, 3500.00)
        ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS public.payroll_details (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id uuid REFERENCES public.payroll_runs(id),
          employee_id uuid REFERENCES public.employees(id),
          employee_no text NOT NULL,
          employee_name text NOT NULL,
          is_saudi boolean DEFAULT true,
          iban text DEFAULT 'SA4420000001234567890123',
          basic_salary numeric(12,2) DEFAULT 15000.00,
          housing_allowance numeric(12,2) DEFAULT 3750.00,
          transport_allowance numeric(12,2) DEFAULT 1000.00,
          other_allowances numeric(12,2) DEFAULT 0.00,
          overtime_amount numeric(12,2) DEFAULT 0.00,
          gross_salary numeric(12,2) DEFAULT 19750.00,
          statutory_employee numeric(12,2) DEFAULT 1828.12,
          statutory_employer numeric(12,2) DEFAULT 2203.12,
          total_deductions numeric(12,2) DEFAULT 1828.12,
          net_salary numeric(12,2) DEFAULT 17921.88
        );

        INSERT INTO public.payroll_details (
          payroll_run_id, employee_id, employee_no, employee_name, is_saudi, iban, basic_salary, net_salary
        )
        SELECT id, '${EMP_1}', 'EMP-001', 'سلطان العتيبي', true, 'SA4420000001234567890123', 15000, 17921.88
        FROM public.payroll_runs WHERE company_id = '${COMPANY_A}' LIMIT 1;

        CREATE TABLE IF NOT EXISTS public.job_openings (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          department_id uuid REFERENCES public.departments(id),
          title_ar text NOT NULL,
          openings_count integer DEFAULT 2,
          hired_count integer DEFAULT 0,
          status text DEFAULT 'open',
          created_at timestamptz DEFAULT now()
        );

        INSERT INTO public.job_openings (company_id, department_id, title_ar, openings_count, status)
        VALUES ('${COMPANY_A}', '${DEPT_1}', 'مطور واجهات أمامية', 3, 'open')
        ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS public.candidates (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          job_opening_id uuid REFERENCES public.job_openings(id),
          first_name_ar text NOT NULL,
          last_name_ar text NOT NULL,
          email text,
          phone text,
          stage text DEFAULT 'screening',
          rating integer DEFAULT 4,
          created_at timestamptz DEFAULT now()
        );

        INSERT INTO public.candidates (company_id, job_opening_id, first_name_ar, last_name_ar, stage)
        SELECT '${COMPANY_A}', id, 'عبدالله', 'الشهري', 'screening'
        FROM public.job_openings WHERE company_id = '${COMPANY_A}' LIMIT 1;

        CREATE TABLE IF NOT EXISTS public.expense_claims (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid REFERENCES public.employees(id),
          claim_number text DEFAULT 'EXP-001',
          category_name_ar text DEFAULT 'سفر وانتقال',
          merchant_name text DEFAULT 'فندق الريتز',
          amount numeric(12,2) DEFAULT 1500.00,
          vat_amount numeric(12,2) DEFAULT 225.00,
          total_amount numeric(12,2) DEFAULT 1725.00,
          currency text DEFAULT 'SAR',
          spent_at date DEFAULT CURRENT_DATE,
          status text DEFAULT 'approved',
          description text
        );

        INSERT INTO public.expense_claims (employee_id, amount, status)
        VALUES ('${EMP_1}', 1500.00, 'approved')
        ON CONFLICT DO NOTHING;
      `);

      // Apply initial migration SQL
      const migrationFile1 = path.resolve(
        __dirname,
        "../../supabase/migrations/20261004000000_production_reporting_analytics_engine.sql",
      );
      const sqlContent1 = fs.readFileSync(migrationFile1, "utf-8");
      await db.exec(sqlContent1);

      // Apply enterprise append-only migration SQL
      const migrationFile2 = path.resolve(
        __dirname,
        "../../supabase/migrations/20261005000000_production_enterprise_reporting_analytics_engine.sql",
      );
      const sqlContent2 = fs.readFileSync(migrationFile2, "utf-8");
      await db.exec(sqlContent2);
    });

    afterAll(async () => {
      await db.close();
    });

    it("3.1 get_executive_kpis calculates exact headcount, Saudization rate and costs", async () => {
      const res = await db.query<{ get_executive_kpis: any }>(
        `SELECT public.get_executive_kpis('${COMPANY_A}'::uuid) AS get_executive_kpis;`,
      );

      const kpi = res.rows[0].get_executive_kpis;
      expect(kpi.total_headcount).toBe(2);
      expect(kpi.active_employees).toBe(2);
      expect(kpi.saudi_count).toBe(1);
      expect(kpi.expat_count).toBe(1);
      expect(Number(kpi.saudization_rate)).toBe(50.0);
      expect(kpi.nitaqat_band).toBe("platinum");
      expect(kpi.open_vacancies).toBe(3);
      expect(kpi.recruitment_candidates).toBe(1);
      expect(kpi.pending_approvals).toBe(1);
      expect(Number(kpi.payroll_cost)).toBe(33500.0); // 30000 net + 3500 gosi
      expect(Number(kpi.average_employee_cost)).toBe(16750.0); // 33500 / 2
      expect(Number(kpi.expense_cost)).toBe(1500.0);
    });

    it("3.2 query_report_data_atomic enforces cross-tenant isolation", async () => {
      // Query Company A
      const resA = await db.query<{ query_report_data_atomic: any }>(
        `SELECT public.query_report_data_atomic('EMP_DIR', '${COMPANY_A}'::uuid, '{}'::jsonb, 1, 25, 'employee_no', 'asc', true) AS query_report_data_atomic;`,
      );
      const dataA = resA.rows[0].query_report_data_atomic;
      expect(dataA.total_count).toBe(2);
      expect(dataA.data.map((r: any) => r.employee_no)).toContain("EMP-001");
      expect(dataA.data.map((r: any) => r.employee_no)).toContain("EMP-002");
      expect(dataA.data.map((r: any) => r.employee_no)).not.toContain("EMP-999"); // Company B record

      // Query Company B
      const resB = await db.query<{ query_report_data_atomic: any }>(
        `SELECT public.query_report_data_atomic('EMP_DIR', '${COMPANY_B}'::uuid, '{}'::jsonb, 1, 25, 'employee_no', 'asc', true) AS query_report_data_atomic;`,
      );
      const dataB = resB.rows[0].query_report_data_atomic;
      expect(dataB.total_count).toBe(1);
      expect(dataB.data[0].employee_no).toBe("EMP-999");
    });

    it("3.3 query_report_data_atomic masks sensitive salary and national ID when unauthorized", async () => {
      // Query with p_can_view_sensitive = false
      const resMasked = await db.query<{ query_report_data_atomic: any }>(
        `SELECT public.query_report_data_atomic('EMP_DIR', '${COMPANY_A}'::uuid, '{}'::jsonb, 1, 25, 'employee_no', 'asc', false) AS query_report_data_atomic;`,
      );
      const dataMasked = resMasked.rows[0].query_report_data_atomic;
      expect(dataMasked.sensitive_data_masked).toBe(true);

      const emp1Masked = dataMasked.data.find((r: any) => r.employee_no === "EMP-001");
      expect(emp1Masked.national_id_or_iqama).toBe("********");
      expect(emp1Masked.basic_salary).toBeNull();
      expect(emp1Masked.total_salary).toBeNull();

      // Query with p_can_view_sensitive = true
      const resUnmasked = await db.query<{ query_report_data_atomic: any }>(
        `SELECT public.query_report_data_atomic('EMP_DIR', '${COMPANY_A}'::uuid, '{}'::jsonb, 1, 25, 'employee_no', 'asc', true) AS query_report_data_atomic;`,
      );
      const dataUnmasked = resUnmasked.rows[0].query_report_data_atomic;
      expect(dataUnmasked.sensitive_data_masked).toBe(false);

      const emp1Unmasked = dataUnmasked.data.find((r: any) => r.employee_no === "EMP-001");
      expect(emp1Unmasked.national_id_or_iqama).toBe("1099887766");
      expect(Number(emp1Unmasked.basic_salary)).toBe(15000.0);
    });

    it("3.4 query_report_data_atomic supports server-side pagination", async () => {
      const page1 = await db.query<{ query_report_data_atomic: any }>(
        `SELECT public.query_report_data_atomic('EMP_DIR', '${COMPANY_A}'::uuid, '{}'::jsonb, 1, 1, 'employee_no', 'asc', true) AS query_report_data_atomic;`,
      );
      const p1 = page1.rows[0].query_report_data_atomic;
      expect(p1.data.length).toBe(1);
      expect(p1.total_count).toBe(2);
      expect(p1.total_pages).toBe(2);

      const page2 = await db.query<{ query_report_data_atomic: any }>(
        `SELECT public.query_report_data_atomic('EMP_DIR', '${COMPANY_A}'::uuid, '{}'::jsonb, 2, 1, 'employee_no', 'asc', true) AS query_report_data_atomic;`,
      );
      const p2 = page2.rows[0].query_report_data_atomic;
      expect(p2.data.length).toBe(1);
    });

    it("3.5 query_report_data_atomic correctly filters attendance lateness", async () => {
      const resLateness = await db.query<{ query_report_data_atomic: any }>(
        `SELECT public.query_report_data_atomic('ATT_LATENESS', '${COMPANY_A}'::uuid, '{}'::jsonb, 1, 25, 'work_date', 'desc', true) AS query_report_data_atomic;`,
      );
      const lateData = resLateness.rows[0].query_report_data_atomic;
      expect(lateData.total_count).toBe(1);
      expect(lateData.data[0].employee_no).toBe("EMP-002");
    });

    it("3.6 toggle_report_favorite toggles favorite status atomically", async () => {
      const favRes = await db.query<{ toggle_report_favorite: any }>(
        `SELECT public.toggle_report_favorite('${COMPANY_A}'::uuid, 'EMP_DIR') AS toggle_report_favorite;`,
      );
      const fav = favRes.rows[0].toggle_report_favorite;
      expect(fav.ok).toBe(true);
      expect(fav.is_favorite).toBe(true);

      // Verify row exists
      const rows = await db.query(
        `SELECT * FROM public.report_favorites WHERE company_id = '${COMPANY_A}' AND report_code = 'EMP_DIR';`,
      );
      expect(rows.rows.length).toBe(1);

      // Toggle again to remove
      const favRes2 = await db.query<{ toggle_report_favorite: any }>(
        `SELECT public.toggle_report_favorite('${COMPANY_A}'::uuid, 'EMP_DIR') AS toggle_report_favorite;`,
      );
      expect(favRes2.rows[0].toggle_report_favorite.is_favorite).toBe(false);
    });

    it("3.7 log_recent_report_access records user recent access", async () => {
      const recRes = await db.query<{ log_recent_report_access: any }>(
        `SELECT public.log_recent_report_access('${COMPANY_A}'::uuid, 'ATT_SUMMARY') AS log_recent_report_access;`,
      );
      expect(recRes.rows[0].log_recent_report_access.ok).toBe(true);

      const rows = await db.query(
        `SELECT * FROM public.report_recents WHERE company_id = '${COMPANY_A}' AND report_code = 'ATT_SUMMARY';`,
      );
      expect(rows.rows.length).toBe(1);
    });
  });
});
