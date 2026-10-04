import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  REPORT_CATALOG,
  canUserAccessReport,
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

    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/20261004000000_production_reporting_analytics_engine.sql",
    );
    const migrationSource = fs.readFileSync(migrationPath, "utf-8");

    it("1.1 ReportsView MUST NOT contain fake mock constants (|| 38 or || 78)", () => {
      expect(reportsViewSource).not.toContain("|| 38");
      expect(reportsViewSource).not.toContain("|| 78");
      expect(reportsViewSource).not.toContain("Math.random()");
    });

    it("1.2 ReportsView MUST use dedicated enterprise hooks (useExecutiveKpis & useReportData)", () => {
      expect(reportsViewSource).toContain("useExecutiveKpis");
      expect(reportsViewSource).toContain("useReportData");
      expect(reportsViewSource).toContain("useReportingEngine");
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
      expect(REPORT_CATALOG.length).toBeGreaterThanOrEqual(25);
    });

    it("1.4 Sensitive financial reports MUST have isSensitive = true", () => {
      const sensitiveCodes = ["PAY_REGISTER", "PAY_SUMMARY", "PAY_COMPONENTS", "PAY_GOSI", "EMP_MASTER"];
      for (const code of sensitiveCodes) {
        const item = REPORT_CATALOG.find((r) => r.code === code);
        expect(item, `Report ${code} should exist`).toBeDefined();
        expect(item?.isSensitive, `Report ${code} must be flagged sensitive`).toBe(true);
      }
    });

    it("1.5 Migration file must contain get_executive_kpis and query_report_data_atomic", () => {
      expect(migrationSource).toContain("FUNCTION public.get_executive_kpis");
      expect(migrationSource).toContain("FUNCTION public.query_report_data_atomic");
      expect(migrationSource).toContain("FUNCTION public.save_report_filter_atomic");
      expect(migrationSource).toContain("FUNCTION public.delete_saved_filter_atomic");
      expect(migrationSource).toContain("FUNCTION public.log_report_generation_atomic");
      expect(migrationSource).toContain("SECURITY DEFINER");
    });
  });

  // ==========================================================================
  // PART 2: DOMAIN BUSINESS LOGIC TESTS
  // ==========================================================================
  describe("Domain Security & Preset Business Logic", () => {
    it("2.1 canUserAccessReport enforces strict RBAC for sensitive payroll reports", () => {
      // General employees or recruiters should NOT access payroll register
      expect(canUserAccessReport("employee", "PAY_REGISTER")).toBe(false);
      expect(canUserAccessReport("recruiter", "PAY_REGISTER")).toBe(false);
      expect(canUserAccessReport("line_manager", "PAY_REGISTER")).toBe(false);

      // Financial & HR leaders must have access
      expect(canUserAccessReport("super_admin", "PAY_REGISTER")).toBe(true);
      expect(canUserAccessReport("hr_manager", "PAY_REGISTER")).toBe(true);
      expect(canUserAccessReport("payroll_officer", "PAY_REGISTER")).toBe(true);
      expect(canUserAccessReport("finance_officer", "PAY_REGISTER")).toBe(true);
    });

    it("2.2 canUserAccessReport allows operational officers access to their functional domains", () => {
      expect(canUserAccessReport("attendance_officer", "ATT_SUMMARY")).toBe(true);
      expect(canUserAccessReport("attendance_officer", "ATT_LATENESS")).toBe(true);
      expect(canUserAccessReport("attendance_officer", "EMP_DIR")).toBe(true);
      expect(canUserAccessReport("line_manager", "ATT_SUMMARY")).toBe(true);
    });

    it("2.3 resolveDatePreset correctly computes ISO date boundaries", () => {
      const today = resolveDatePreset("today");
      expect(today.startDate).toBe(today.endDate);

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
          check_in time,
          check_out time,
          worked_hours numeric(5,2) DEFAULT 8.00,
          status text DEFAULT 'present',
          note text
        );

        INSERT INTO public.attendance_records (employee_id, work_date, check_in, check_out, worked_hours, status)
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
          period_year integer NOT NULL,
          period_month integer NOT NULL,
          status text NOT NULL DEFAULT 'locked',
          total_employees integer DEFAULT 2,
          total_net_salary numeric(14,2) DEFAULT 30000.00,
          total_employer_gosi numeric(14,2) DEFAULT 3500.00,
          created_at timestamptz DEFAULT now()
        );

        INSERT INTO public.payroll_runs (company_id, period_year, period_month, status, total_net_salary, total_employer_gosi)
        VALUES ('${COMPANY_A}', 2026, 3, 'locked', 30000.00, 3500.00)
        ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS public.payroll_run_employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id uuid REFERENCES public.payroll_runs(id),
          employee_id uuid REFERENCES public.employees(id),
          department_id uuid REFERENCES public.departments(id),
          employee_no text NOT NULL,
          employee_name_ar text NOT NULL,
          department_name_ar text,
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
          net_salary numeric(12,2) DEFAULT 17921.88,
          status text DEFAULT 'approved'
        );

        INSERT INTO public.payroll_run_employees (
          payroll_run_id, employee_id, department_id, employee_no, employee_name_ar, department_name_ar, is_saudi, iban, basic_salary, net_salary
        )
        SELECT id, '${EMP_1}', '${DEPT_1}', 'EMP-001', 'سلطان العتيبي', 'تقنية المعلومات', true, 'SA4420000001234567890123', 15000, 17921.88
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
          job_opening_id uuid REFERENCES public.job_openings(id),
          first_name_ar text NOT NULL,
          last_name_ar text NOT NULL,
          email text,
          phone text,
          stage text DEFAULT 'screening',
          rating integer DEFAULT 4,
          created_at timestamptz DEFAULT now()
        );

        INSERT INTO public.candidates (job_opening_id, first_name_ar, last_name_ar, stage)
        SELECT id, 'عبدالله', 'الشهري', 'interview'
        FROM public.job_openings WHERE company_id = '${COMPANY_A}' LIMIT 1;

        CREATE TABLE IF NOT EXISTS public.expense_claims (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          employee_id uuid REFERENCES public.employees(id),
          category_id uuid,
          claim_number text DEFAULT 'EXP-001',
          merchant_name text DEFAULT 'فندق الريتز',
          amount numeric(12,2) DEFAULT 1500.00,
          vat_amount numeric(12,2) DEFAULT 225.00,
          total_amount numeric(12,2) DEFAULT 1725.00,
          currency text DEFAULT 'SAR',
          spent_at date DEFAULT CURRENT_DATE,
          status text DEFAULT 'approved',
          description text
        );

        INSERT INTO public.expense_claims (company_id, employee_id, amount, status)
        VALUES ('${COMPANY_A}', '${EMP_1}', 1500.00, 'approved')
        ON CONFLICT DO NOTHING;
      `);

      // Apply migration SQL
      const migrationFile = path.resolve(
        __dirname,
        "../../supabase/migrations/20261004000000_production_reporting_analytics_engine.sql",
      );
      const sqlContent = fs.readFileSync(migrationFile, "utf-8");
      await db.exec(sqlContent);
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
      expect(p1.data[0].employee_no).toBe("EMP-001");

      const page2 = await db.query<{ query_report_data_atomic: any }>(
        `SELECT public.query_report_data_atomic('EMP_DIR', '${COMPANY_A}'::uuid, '{}'::jsonb, 2, 1, 'employee_no', 'asc', true) AS query_report_data_atomic;`,
      );
      const p2 = page2.rows[0].query_report_data_atomic;
      expect(p2.data.length).toBe(1);
      expect(p2.data[0].employee_no).toBe("EMP-002");
    });

    it("3.5 query_report_data_atomic correctly filters attendance lateness and overtime", async () => {
      const resLateness = await db.query<{ query_report_data_atomic: any }>(
        `SELECT public.query_report_data_atomic('ATT_LATENESS', '${COMPANY_A}'::uuid, '{}'::jsonb, 1, 25, 'work_date', 'desc', true) AS query_report_data_atomic;`,
      );
      const lateData = resLateness.rows[0].query_report_data_atomic;
      expect(lateData.total_count).toBe(1);
      expect(lateData.data[0].employee_no).toBe("EMP-002");
    });

    it("3.6 save_report_filter_atomic and delete_saved_filter_atomic work atomically", async () => {
      const saveRes = await db.query<{ save_report_filter_atomic: any }>(
        `SELECT public.save_report_filter_atomic(
          '${COMPANY_A}'::uuid,
          'EMP_DIR',
          'فلتر تقنية المعلومات',
          'IT Department Filter',
          '{"department_id": "${DEPT_1}"}'::jsonb,
          ARRAY['employee_no', 'full_name_ar'],
          'employee_no',
          'asc',
          true
        ) AS save_report_filter_atomic;`,
      );

      const saved = saveRes.rows[0].save_report_filter_atomic;
      expect(saved.ok).toBe(true);
      expect(saved.filter_id).toBeDefined();

      // Verify row in table
      const rows = await db.query(
        `SELECT * FROM public.saved_report_filters WHERE id = '${saved.filter_id}'::uuid;`,
      );
      expect(rows.rows.length).toBe(1);
      expect((rows.rows[0] as any).name_ar).toBe("فلتر تقنية المعلومات");

      // Delete filter
      const delRes = await db.query<{ delete_saved_filter_atomic: any }>(
        `SELECT public.delete_saved_filter_atomic('${saved.filter_id}'::uuid) AS delete_saved_filter_atomic;`,
      );
      expect(delRes.rows[0].delete_saved_filter_atomic.ok).toBe(true);

      const rowsAfter = await db.query(
        `SELECT * FROM public.saved_report_filters WHERE id = '${saved.filter_id}'::uuid;`,
      );
      expect(rowsAfter.rows.length).toBe(0);
    });

    it("3.7 log_report_generation_atomic records audit trail without leaking row payloads", async () => {
      const logRes = await db.query<{ log_report_generation_atomic: any }>(
        `SELECT public.log_report_generation_atomic(
          '${COMPANY_A}'::uuid,
          'PAY_REGISTER',
          '{"period_year": 2026}'::jsonb,
          45,
          'csv',
          true
        ) AS log_report_generation_atomic;`,
      );

      const log = logRes.rows[0].log_report_generation_atomic;
      expect(log.ok).toBe(true);
      expect(log.log_id).toBeDefined();

      const logRows = await db.query(
        `SELECT * FROM public.report_generation_logs WHERE id = '${log.log_id}'::uuid;`,
      );
      expect(logRows.rows.length).toBe(1);
      const row = logRows.rows[0] as any;
      expect(row.report_code).toBe("PAY_REGISTER");
      expect(row.row_count).toBe(45);
      expect(row.export_format).toBe("csv");
      expect(row.sensitive_data_accessed).toBe(true);
    });
  });
});
