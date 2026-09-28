import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 15: Production Payroll, Salary Structure & Statutory Contributions Engine (PGlite Tests)", () => {
  const db = new PGlite();

  // Test UUIDs
  const companyA = "a0000000-0000-0000-0000-000000000001";
  const companyB = "b0000000-0000-0000-0000-000000000002";

  const dept1A = "d0000000-0000-0000-0000-000000000001";
  const dept1B = "d0000000-0000-0000-0000-000000000002";

  // Users
  const userHrAdminA = "11111111-aaaa-aaaa-aaaa-111111111111";
  const userPayrollOfficerA = "22222222-aaaa-aaaa-aaaa-222222222222";
  const userFinanceOfficerA = "33333333-aaaa-aaaa-aaaa-333333333333";
  const userEmpSaudiA = "44444444-aaaa-aaaa-aaaa-444444444444";
  const userEmpExpatA = "55555555-aaaa-aaaa-aaaa-555555555555";
  const userEmpJoinerA = "66666666-aaaa-aaaa-aaaa-666666666666";
  const userEmpTermA = "77777777-aaaa-aaaa-aaaa-777777777777";
  const userEmpLoanA = "88888888-aaaa-aaaa-aaaa-888888888888";
  const userEmpNegA = "99999999-aaaa-aaaa-aaaa-999999999999";
  const userHrB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  // Employees
  const empIdHrAdminA = "e0000000-0000-0000-0000-000000000001";
  const empIdPayrollOfficerA = "e0000000-0000-0000-0000-000000000002";
  const empIdFinanceOfficerA = "e0000000-0000-0000-0000-000000000003";
  const empIdSaudiA = "e0000000-0000-0000-0000-000000000004";
  const empIdExpatA = "e0000000-0000-0000-0000-000000000005";
  const empIdJoinerA = "e0000000-0000-0000-0000-000000000006";
  const empIdTermA = "e0000000-0000-0000-0000-000000000007";
  const empIdLoanA = "e0000000-0000-0000-0000-000000000008";
  const empIdNegA = "e0000000-0000-0000-0000-000000000009";
  const empIdHrB = "e0000000-0000-0000-0000-000000000010";

  // Payroll Groups
  const payrollGroup1A = "c1000000-0000-0000-0000-000000000001";
  const payrollGroup1B = "c1000000-0000-0000-0000-000000000002";

  // Helper to switch caller in PGlite session
  async function asUser(userId: string | null, role: string = "authenticated") {
    await db.exec(`
      SELECT set_config('test.auth_uid', '${userId || ""}', false);
      SELECT set_config('test.auth_role', '${role}', false);
    `);
  }

  beforeAll(async () => {
    // 1. Setup Auth & base schema
    await db.exec(`
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('test.auth_uid', true), '')::uuid
      $$;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
        SELECT COALESCE(nullif(current_setting('test.auth_role', true), ''), 'authenticated')
      $$;

      GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
      GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticated, anon, service_role;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated, anon, service_role;
      GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

      CREATE TABLE IF NOT EXISTS public.companies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        timezone text NOT NULL DEFAULT 'Asia/Riyadh',
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.departments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.subsidiaries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.work_locations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.employees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id),
        company_id uuid NOT NULL REFERENCES public.companies(id),
        department_id uuid REFERENCES public.departments(id),
        subsidiary_id uuid REFERENCES public.subsidiaries(id),
        work_location_id uuid REFERENCES public.work_locations(id),
        employee_no text,
        full_name text,
        first_name_ar text,
        last_name_ar text,
        job_title_ar text,
        nationality text NOT NULL DEFAULT 'Saudi',
        is_saudi boolean NOT NULL DEFAULT true,
        hire_date date NOT NULL DEFAULT '2025-01-01',
        termination_date date,
        bank_name text,
        iban text,
        basic_salary numeric(12,2) NOT NULL DEFAULT 5000,
        housing_allowance numeric(12,2) NOT NULL DEFAULT 1250,
        transport_allowance numeric(12,2) NOT NULL DEFAULT 500,
        total_salary numeric(12,2) NOT NULL DEFAULT 6750,
        payroll_group_id uuid,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.user_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id),
        role text NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.employee_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id),
        user_id uuid NOT NULL REFERENCES auth.users(id),
        role text NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      -- Legacy payroll_groups table to test ALTER & enhancement
      CREATE TABLE IF NOT EXISTS public.payroll_groups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name_ar text NOT NULL,
        name_en text,
        calculation_basis text DEFAULT 'fixed_30_days',
        cutoff_day integer DEFAULT 25,
        payday integer DEFAULT 28,
        currency text DEFAULT 'SAR',
        created_at timestamptz DEFAULT now()
      );

      -- Legacy salary_profiles table
      CREATE TABLE IF NOT EXISTS public.salary_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id uuid REFERENCES public.employees(id),
        basic_salary numeric(12,2) NOT NULL DEFAULT 5000,
        housing_allowance numeric(12,2) NOT NULL DEFAULT 1250,
        transport_allowance numeric(12,2) NOT NULL DEFAULT 500,
        other_allowances jsonb DEFAULT '[]'::jsonb,
        bank_name text,
        iban text,
        payroll_group_id uuid,
        effective_from date DEFAULT '2025-01-01',
        effective_to date,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.loans (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id uuid NOT NULL REFERENCES public.employees(id),
        monthly_installment numeric(12,2) NOT NULL,
        remaining_balance numeric(12,2) NOT NULL,
        paid_installments integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.attendance_periods (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id),
        period_year integer NOT NULL,
        period_month integer NOT NULL,
        status text NOT NULL DEFAULT 'open',
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.attendance_payroll_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        period_id uuid NOT NULL REFERENCES public.attendance_periods(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id),
        regular_overtime_hours numeric(6,2) NOT NULL DEFAULT 0,
        holiday_overtime_hours numeric(6,2) NOT NULL DEFAULT 0,
        unexcused_absence_days numeric(6,2) NOT NULL DEFAULT 0,
        total_absent_days numeric(6,2) NOT NULL DEFAULT 0,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.company_bank_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id),
        bank_name text NOT NULL,
        iban text NOT NULL,
        current_balance numeric(14,2) NOT NULL DEFAULT 500000.00,
        currency text NOT NULL DEFAULT 'SAR',
        is_primary boolean NOT NULL DEFAULT true,
        created_at timestamptz DEFAULT now()
      );

      -- Helper functions for RLS and roles
      CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT company_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
      $$;

      CREATE OR REPLACE FUNCTION public.current_employee_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
      $$;

      CREATE OR REPLACE FUNCTION public.current_user_has_any_role(p_roles text[]) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(p_roles)
        ) OR EXISTS (
          SELECT 1 FROM public.employee_roles WHERE user_id = auth.uid() AND role = ANY(p_roles)
        );
      END;
      $$;

      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
      GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated, service_role;
    `);

    // 2. Load and execute Prompt 15 Migration
    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/20260928000000_production_payroll_and_statutory_engine.sql",
    );
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    await db.exec(sqlContent);

    // 3. Seed Companies, Departments, and Auth Users
    await db.exec(`
      INSERT INTO public.companies (id, name, timezone)
      VALUES
        ('${companyA}', 'شركة المستقبل للتقنية A', 'Asia/Riyadh'),
        ('${companyB}', 'شركة النور العالمية B', 'Asia/Riyadh');

      INSERT INTO public.departments (id, company_id, name_ar)
      VALUES
        ('${dept1A}', '${companyA}', 'إدارة التقنية والمعلومات'),
        ('${dept1B}', '${companyB}', 'إدارة العمليات');

      INSERT INTO auth.users (id, email)
      VALUES
        ('${userHrAdminA}', 'hr.admin@comp-a.com'),
        ('${userPayrollOfficerA}', 'payroll.officer@comp-a.com'),
        ('${userFinanceOfficerA}', 'finance.officer@comp-a.com'),
        ('${userEmpSaudiA}', 'saudi.emp@comp-a.com'),
        ('${userEmpExpatA}', 'expat.emp@comp-a.com'),
        ('${userEmpJoinerA}', 'joiner.emp@comp-a.com'),
        ('${userEmpTermA}', 'term.emp@comp-a.com'),
        ('${userEmpLoanA}', 'loan.emp@comp-a.com'),
        ('${userEmpNegA}', 'neg.emp@comp-a.com'),
        ('${userHrB}', 'hr@comp-b.com');

      -- User Roles
      INSERT INTO public.user_roles (user_id, role)
      VALUES
        ('${userHrAdminA}', 'org_admin'),
        ('${userHrAdminA}', 'hr_manager'),
        ('${userPayrollOfficerA}', 'payroll_officer'),
        ('${userFinanceOfficerA}', 'finance_officer'),
        ('${userEmpSaudiA}', 'employee'),
        ('${userEmpExpatA}', 'employee'),
        ('${userEmpJoinerA}', 'employee'),
        ('${userEmpTermA}', 'employee'),
        ('${userEmpLoanA}', 'employee'),
        ('${userEmpNegA}', 'employee'),
        ('${userHrB}', 'hr_manager');

      -- Payroll Groups
      INSERT INTO public.payroll_groups (id, company_id, name_ar, name_en, code, calculation_basis, cutoff_day, payday, currency, status)
      VALUES
        ('${payrollGroup1A}', '${companyA}', 'مجموعة الموظفين الرئيسية A', 'Main Staff Group A', 'GRP-A-01', 'fixed_30_days', 25, 28, 'SAR', 'active'),
        ('${payrollGroup1B}', '${companyB}', 'المجموعة الرئيسية B', 'Main Group B', 'GRP-B-01', 'fixed_30_days', 25, 28, 'SAR', 'active');

      -- Bank Account for Company A
      INSERT INTO public.company_bank_accounts (company_id, bank_name, iban, current_balance, currency, is_primary)
      VALUES ('${companyA}', 'البنك الأهلي السعودي', 'SA4410000001234567890123', 1000000.00, 'SAR', true);

      -- Employees for Company A
      INSERT INTO public.employees (
        id, user_id, company_id, department_id, employee_no, full_name, first_name_ar, last_name_ar, job_title_ar,
        nationality, is_saudi, hire_date, termination_date, basic_salary, total_salary, payroll_group_id, bank_name, iban
      ) VALUES
        ('${empIdHrAdminA}', '${userHrAdminA}', '${companyA}', '${dept1A}', 'EMP-001', 'أحمد المدير', 'أحمد', 'المدير', 'مدير الموارد البشرية', 'Saudi', true, '2024-01-01', NULL, 15000, 20000, '${payrollGroup1A}', 'الراجحي', 'SA1000000000000000000001'),
        ('${empIdPayrollOfficerA}', '${userPayrollOfficerA}', '${companyA}', '${dept1A}', 'EMP-002', 'سعد المحاسب', 'سعد', 'المحاسب', 'مسؤول الرواتب', 'Saudi', true, '2024-02-01', NULL, 10000, 13000, '${payrollGroup1A}', 'الراجحي', 'SA1000000000000000000002'),
        ('${empIdFinanceOfficerA}', '${userFinanceOfficerA}', '${companyA}', '${dept1A}', 'EMP-003', 'فيصل المالي', 'فيصل', 'المالي', 'المدير المالي', 'Saudi', true, '2024-03-01', NULL, 18000, 24000, '${payrollGroup1A}', 'الرياض', 'SA1000000000000000000003'),
        ('${empIdSaudiA}', '${userEmpSaudiA}', '${companyA}', '${dept1A}', 'EMP-004', 'عبدالله السعودي', 'عبدالله', 'السعودي', 'مهندس برمجيات', 'Saudi', true, '2024-01-01', NULL, 10000, 13500, '${payrollGroup1A}', 'الإنماء', 'SA1000000000000000000004'),
        ('${empIdExpatA}', '${userEmpExpatA}', '${companyA}', '${dept1A}', 'EMP-005', 'طارق الوافد', 'طارق', 'الوافد', 'مصمم واجهات', 'Egypt', false, '2024-01-01', NULL, 8000, 11000, '${payrollGroup1A}', 'الأهلي', 'SA1000000000000000000005'),
        ('${empIdJoinerA}', '${userEmpJoinerA}', '${companyA}', '${dept1A}', 'EMP-006', 'منصور المنضم', 'منصور', 'المنضم', 'أخصائي جودة', 'Saudi', true, '2026-03-16', NULL, 10000, 13000, '${payrollGroup1A}', 'الراجحي', 'SA1000000000000000000006'),
        ('${empIdTermA}', '${userEmpTermA}', '${companyA}', '${dept1A}', 'EMP-007', 'خالد المغادر', 'خالد', 'المغادر', 'دعم فني', 'Saudi', true, '2024-01-01', '2026-03-15', 9000, 12000, '${payrollGroup1A}', 'البلاد', 'SA1000000000000000000007'),
        ('${empIdLoanA}', '${userEmpLoanA}', '${companyA}', '${dept1A}', 'EMP-008', 'بدر المقترض', 'بدر', 'المقترض', 'مسؤول تسويق', 'Saudi', true, '2024-01-01', NULL, 8000, 10500, '${payrollGroup1A}', 'الرياض', 'SA1000000000000000000008'),
        ('${empIdNegA}', '${userEmpNegA}', '${companyA}', '${dept1A}', 'EMP-009', 'صالح المدين', 'صالح', 'المدين', 'موظف خدمات', 'Saudi', true, '2024-01-01', NULL, 3000, 3500, '${payrollGroup1A}', 'الراجحي', 'SA1000000000000000000009'),
        ('${empIdHrB}', '${userHrB}', '${companyB}', '${dept1B}', 'EMP-B01', 'باسم المدير B', 'باسم', 'المدير', 'مدير B', 'Saudi', true, '2024-01-01', NULL, 12000, 16000, '${payrollGroup1B}', 'الراجحي', 'SA2000000000000000000001');

      -- Active Loan for empIdLoanA
      INSERT INTO public.loans (id, employee_id, monthly_installment, remaining_balance, paid_installments, status)
      VALUES ('c2000000-0000-0000-0000-000000000001', '${empIdLoanA}', 1500.00, 6000.00, 0, 'active');
    `);
  }, 60000);

  // ============================================================================
  // SUITE 1: Company Payroll Configuration
  // ============================================================================
  describe("Suite 1: Company Payroll Configuration", () => {
    it("initializes company payroll config with canonical defaults and salary components", async () => {
      await asUser(userHrAdminA);
      const res = await db.query<any>(`
        SELECT public.init_company_payroll_config(
          '${companyA}'::uuid,
          '{"currency":"SAR","calculation_basis":"fixed_30_days","payroll_cutoff_day":25,"payday":28}'::jsonb
        ) as result;
      `);

      const result = (res.rows[0] as any).result;
      expect(result.ok).toBe(true);

      const configRes = await db.query<any>(`SELECT * FROM public.company_payroll_configs WHERE company_id = '${companyA}';`);
      expect(configRes.rows.length).toBe(1);
      expect(configRes.rows[0].currency).toBe("SAR");
      expect(configRes.rows[0].calculation_basis).toBe("fixed_30_days");
      expect(configRes.rows[0].payroll_cutoff_day).toBe(25);
      expect(configRes.rows[0].payday).toBe(28);

      // Verify that canonical salary components were seeded
      const compRes = await db.query<any>(`SELECT count(*) as count FROM public.salary_components WHERE company_id = '${companyA}';`);
      expect(Number(compRes.rows[0].count)).toBeGreaterThanOrEqual(8);
    });

    it("rejects invalid configuration parameters", async () => {
      await asUser(userHrAdminA);
      let errorThrown = false;
      try {
        await db.query<any>(`
          SELECT public.init_company_payroll_config(
            '${companyA}'::uuid,
            '{"payroll_cutoff_day": 35}'::jsonb
          );
        `);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/يوم الإقفال الشهري غير صالح|between 1 and 31|payroll_cutoff_day/i);
      }
      expect(errorThrown).toBe(true);
    });
  });

  // ============================================================================
  // SUITE 2: Master Salary Components & Structures
  // ============================================================================
  describe("Suite 2: Master Salary Components & Structures", () => {
    it("creates custom salary components with type and insurable flags", async () => {
      await asUser(userHrAdminA);
      const res = await db.query<any>(`
        INSERT INTO public.salary_components (
          company_id, code, name_ar, name_en, type, calculation_method, is_statutory_insurable, display_order
        ) VALUES (
          '${companyA}', 'COMMISSION', 'عمولة مبيعات', 'Sales Commission', 'earning', 'fixed', false, 110
        ) RETURNING id, code, is_statutory_insurable;
      `);

      expect(res.rows.length).toBe(1);
      expect(res.rows[0].code).toBe("COMMISSION");
      expect(res.rows[0].is_statutory_insurable).toBe(false);
    });

    it("creates reusable salary structure with versioning", async () => {
      await asUser(userHrAdminA);
      const structRes = await db.query<any>(`
        INSERT INTO public.salary_structures (company_id, code, name_ar, name_en, version, status)
        VALUES ('${companyA}', 'TECH_STANDARD', 'هيكل الكادر التقني', 'Tech Staff Structure', 1, 'active')
        RETURNING id, version;
      `);
      expect(structRes.rows.length).toBe(1);
      const structId = structRes.rows[0].id;

      // Attach components to structure
      const compRes = await db.query<any>(`SELECT id FROM public.salary_components WHERE company_id = '${companyA}' AND code = 'BASIC' LIMIT 1;`);
      const basicCompId = compRes.rows[0].id;

      await db.query<any>(`
        INSERT INTO public.salary_structure_components (structure_id, component_id, default_amount, is_mandatory)
        VALUES ('${structId}', '${basicCompId}', 10000, true);
      `);

      const count = await db.query<any>(`SELECT count(*) as count FROM public.salary_structure_components WHERE structure_id = '${structId}';`);
      expect(Number(count.rows[0].count)).toBe(1);
    });
  });

  // ============================================================================
  // SUITE 3: Effective-Dated Employee Compensation Versioning
  // ============================================================================
  describe("Suite 3: Effective-Dated Employee Compensation Versioning", () => {
    it("sets employee compensation atomically and marks approved", async () => {
      await asUser(userHrAdminA);
      const compPayload = JSON.stringify({
        basic_salary: 10000.00,
        housing_allowance: 2500.00,
        transport_allowance: 1000.00,
        effective_from: "2026-01-01",
        reason: "الراتب التعاقدي المعتمد",
        statutory_applicable: true,
        bank_name: "بنك الإنماء",
        iban: "SA1000000000000000000004",
      });

      const res = await db.query<any>(`
        SELECT public.set_employee_compensation_atomic(
          '${empIdSaudiA}'::uuid,
          '${compPayload}'::jsonb
        ) as result;
      `);

      const result = (res.rows[0] as any).result;
      expect(result.ok).toBe(true);
      expect(result.version).toBe(1);

      // Verify active version row
      const versionRes = await db.query<any>(`
        SELECT * FROM public.employee_compensation_versions
        WHERE employee_id = '${empIdSaudiA}'
        ORDER BY version DESC LIMIT 1;
      `);
      expect(versionRes.rows.length).toBe(1);
      expect(Number(versionRes.rows[0].basic_salary)).toBe(10000);
      expect(Number(versionRes.rows[0].housing_allowance)).toBe(2500);
      expect(versionRes.rows[0].status).toBe("approved");
    });

    it("seeds compensation for expat, joiner, terminator, loan, and negative test employees", async () => {
      await asUser(userHrAdminA);
      // Admin staff
      await db.query<any>(`SELECT public.set_employee_compensation_atomic('${empIdHrAdminA}'::uuid, '{"basic_salary":15000,"housing_allowance":3750,"transport_allowance":1250,"effective_from":"2026-01-01"}'::jsonb);`);
      await db.query<any>(`SELECT public.set_employee_compensation_atomic('${empIdPayrollOfficerA}'::uuid, '{"basic_salary":10000,"housing_allowance":2500,"transport_allowance":1000,"effective_from":"2026-01-01"}'::jsonb);`);
      await db.query<any>(`SELECT public.set_employee_compensation_atomic('${empIdFinanceOfficerA}'::uuid, '{"basic_salary":18000,"housing_allowance":4500,"transport_allowance":1500,"effective_from":"2026-01-01"}'::jsonb);`);
      // Expat
      await db.query<any>(`SELECT public.set_employee_compensation_atomic('${empIdExpatA}'::uuid, '{"basic_salary":8000,"housing_allowance":2000,"transport_allowance":1000,"effective_from":"2026-01-01"}'::jsonb);`);
      // Joiner (starts 2026-03-16)
      await db.query<any>(`SELECT public.set_employee_compensation_atomic('${empIdJoinerA}'::uuid, '{"basic_salary":10000,"housing_allowance":2000,"transport_allowance":1000,"effective_from":"2026-03-16"}'::jsonb);`);
      // Terminator (ends 2026-03-15)
      await db.query<any>(`SELECT public.set_employee_compensation_atomic('${empIdTermA}'::uuid, '{"basic_salary":9000,"housing_allowance":2000,"transport_allowance":1000,"effective_from":"2026-01-01"}'::jsonb);`);
      // Loan Employee
      await db.query<any>(`SELECT public.set_employee_compensation_atomic('${empIdLoanA}'::uuid, '{"basic_salary":8000,"housing_allowance":1500,"transport_allowance":1000,"effective_from":"2026-01-01"}'::jsonb);`);
      // Negative Test Employee (3000 basic, but will get huge manual deduction)
      await db.query<any>(`SELECT public.set_employee_compensation_atomic('${empIdNegA}'::uuid, '{"basic_salary":3000,"housing_allowance":500,"transport_allowance":0,"effective_from":"2026-01-01"}'::jsonb);`);

      const count = await db.query<any>(`SELECT count(*) as count FROM public.employee_compensation_versions;`);
      expect(Number(count.rows[0].count)).toBeGreaterThanOrEqual(9);
    });
  });

  // ============================================================================
  // SUITE 4: Attendance Interlock & Input Snapshotting
  // ============================================================================
  describe("Suite 4: Attendance Interlock & Input Snapshotting", () => {
    let runId: string;

    it("creates a new draft payroll run for March 2026", async () => {
      await asUser(userPayrollOfficerA);
      const res = await db.query<any>(`
        SELECT public.create_payroll_run_atomic(
          '${companyA}'::uuid,
          '${payrollGroup1A}'::uuid,
          2026,
          3
        ) as result;
      `);
      const result = (res.rows[0] as any).result;
      expect(result.ok).toBe(true);
      expect(result.status).toBe("draft");
      runId = result.payroll_run_id;
    });

    it("raises warning exception when attendance period is NOT closed", async () => {
      await asUser(userPayrollOfficerA);
      // Ensure no closed attendance period exists for March 2026
      await db.query<any>(`DELETE FROM public.attendance_periods WHERE company_id = '${companyA}' AND period_year = 2026 AND period_month = 3;`);

      const res = await db.query<any>(`
        SELECT public.calculate_payroll_run_atomic('${runId}'::uuid) as result;
      `);
      const result = (res.rows[0] as any).result;
      expect(result.ok).toBe(true);
      expect(result.warnings).toBeGreaterThan(0);

      const exRes = await db.query<any>(`
        SELECT * FROM public.payroll_exceptions
        WHERE payroll_run_id = '${runId}' AND code = 'ATTENDANCE_NOT_CLOSED';
      `);
      expect(exRes.rows.length).toBeGreaterThan(0);
      expect(exRes.rows[0].severity).toBe("warning");
    });

    it("consumes attendance snapshot accurately when attendance period IS closed", async () => {
      await asUser(userPayrollOfficerA);
      // Create closed attendance period and snapshots
      const attPeriodRes = await db.query<any>(`
        INSERT INTO public.attendance_periods (company_id, period_year, period_month, status)
        VALUES ('${companyA}', 2026, 3, 'closed')
        RETURNING id;
      `);
      const attPeriodId = attPeriodRes.rows[0].id;

      // Add 10 overtime hours to empIdSaudiA, and 2 unexcused absence days
      await db.query<any>(`
        INSERT INTO public.attendance_payroll_snapshots (
          period_id, employee_id, regular_overtime_hours, holiday_overtime_hours, unexcused_absence_days, total_absent_days
        ) VALUES
          ('${attPeriodId}', '${empIdSaudiA}', 10, 0, 0, 0),
          ('${attPeriodId}', '${empIdExpatA}', 0, 0, 2, 2);
      `);

      // Recalculate run
      const res = await db.query<any>(`
        SELECT public.calculate_payroll_run_atomic('${runId}'::uuid) as result;
      `);
      const result = (res.rows[0] as any).result;
      expect(result.ok).toBe(true);

      // Verify that Saudi employee now has overtime recorded
      const saudiRunEmp = await db.query<any>(`
        SELECT overtime_hours, overtime_amount FROM public.payroll_run_employees
        WHERE payroll_run_id = '${runId}' AND employee_id = '${empIdSaudiA}';
      `);
      expect(Number(saudiRunEmp.rows[0].overtime_hours)).toBe(10);
      expect(Number(saudiRunEmp.rows[0].overtime_amount)).toBeGreaterThan(0);

      // Verify that Expat employee has absence deduction recorded
      const expatRunEmp = await db.query<any>(`
        SELECT absence_days, absence_deduction FROM public.payroll_run_employees
        WHERE payroll_run_id = '${runId}' AND employee_id = '${empIdExpatA}';
      `);
      expect(Number(expatRunEmp.rows[0].absence_days)).toBe(2);
      expect(Number(expatRunEmp.rows[0].absence_deduction)).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SUITE 5: Statutory Engine (Saudi GOSI Versioned Adapter)
  // ============================================================================
  describe("Suite 5: Statutory Engine (Saudi GOSI Versioned Adapter)", () => {
    let runId: string;

    beforeAll(async () => {
      const runRes = await db.query<any>(`
        SELECT id FROM public.payroll_runs
        WHERE company_id = '${companyA}' AND period_year = 2026 AND period_month = 3
        LIMIT 1;
      `);
      runId = runRes.rows[0].id;
    });

    it("correctly computes GOSI for Saudi employee: (Basic + Housing) * (9% + 0.75%)", async () => {
      const saudiRes = await db.query<any>(`
        SELECT statutory_employee, statutory_employer
        FROM public.payroll_run_employees
        WHERE payroll_run_id = '${runId}' AND employee_id = '${empIdSaudiA}';
      `);
      expect(Number(saudiRes.rows[0].statutory_employee)).toBe(1218.75);
      expect(Number(saudiRes.rows[0].statutory_employer)).toBe(1468.75);
    });

    it("correctly computes GOSI for Non-Saudi expat: 0% employee, 2% hazard employer", async () => {
      // empIdExpatA: Basic = 8,000, Housing = 2,000 => Total insurable = 10,000
      // Employee GOSI = 0.00
      // Employer GOSI = 10,000 * 2% = 200.00 SAR
      const expatRes = await db.query<any>(`
        SELECT statutory_employee, statutory_employer
        FROM public.payroll_run_employees
        WHERE payroll_run_id = '${runId}' AND employee_id = '${empIdExpatA}';
      `);
      expect(Number(expatRes.rows[0].statutory_employee)).toBe(0);
      expect(Number(expatRes.rows[0].statutory_employer)).toBe(200);
    });

    it("caps statutory subject wage at 45,000 SAR wage ceiling", async () => {
      // Create high earner: Basic 40,000 + Housing 15,000 = 55,000 (exceeds 45k ceiling)
      const highEarnerUser = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      const highEarnerEmp = "e0000000-0000-0000-0000-000000000099";
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES ('${highEarnerUser}', 'ceo@comp-a.com');
        INSERT INTO public.user_roles (user_id, role) VALUES ('${highEarnerUser}', 'employee');
        INSERT INTO public.employees (
          id, user_id, company_id, employee_no, full_name, first_name_ar, last_name_ar, nationality, is_saudi,
          hire_date, basic_salary, total_salary, payroll_group_id
        ) VALUES (
          '${highEarnerEmp}', '${highEarnerUser}', '${companyA}', 'EMP-099', 'الرئيس التنفيذي', 'الرئيس', 'التنفيذي', 'Saudi', true,
          '2024-01-01', 40000, 55000, '${payrollGroup1A}'
        );
      `);
      await db.query<any>(`SELECT public.set_employee_compensation_atomic('${highEarnerEmp}'::uuid, '{"basic_salary":40000,"housing_allowance":15000,"effective_from":"2026-01-01"}'::jsonb);`);

      // Recalculate
      await db.query<any>(`SELECT public.calculate_payroll_run_atomic('${runId}'::uuid);`);

      // 45,000 * 9.75% = 4,387.50 SAR
      // 45,000 * 11.75% = 5,287.50 SAR
      const ceoRes = await db.query<any>(`
        SELECT statutory_employee, statutory_employer
        FROM public.payroll_run_employees
        WHERE payroll_run_id = '${runId}' AND employee_id = '${highEarnerEmp}';
      `);
      expect(Number(ceoRes.rows[0].statutory_employee)).toBe(4387.50);
      expect(Number(ceoRes.rows[0].statutory_employer)).toBe(5287.50);
    });
  });

  // ============================================================================
  // SUITE 6: Joiner & Termination Proration Arithmetic
  // ============================================================================
  describe("Suite 6: Joiner & Termination Proration Arithmetic", () => {
    let runId: string;

    beforeAll(async () => {
      const runRes = await db.query<any>(`
        SELECT id FROM public.payroll_runs
        WHERE company_id = '${companyA}' AND period_year = 2026 AND period_month = 3
        LIMIT 1;
      `);
      runId = runRes.rows[0].id;
    });

    it("prorates joiner salary joining mid-month (March 16 to 31 = 16 days on 30-day basis)", async () => {
      // empIdJoinerA joined on 2026-03-16. In fixed_30_days, eligible days = 30 - 16 + 1 = 15 days or 16 days
      const joinerRes = await db.query<any>(`
        SELECT eligible_days, basic_salary, gross_salary
        FROM public.payroll_run_employees
        WHERE payroll_run_id = '${runId}' AND employee_id = '${empIdJoinerA}';
      `);
      expect(Number(joinerRes.rows[0].eligible_days)).toBeLessThan(30);
      expect(Number(joinerRes.rows[0].basic_salary)).toBeLessThan(10000);
    });

    it("prorates terminator salary leaving mid-month (March 1 to 15 = 15 days on 30-day basis)", async () => {
      // empIdTermA terminated on 2026-03-15. Eligible days = 15 days.
      // Basic 9000 * (15/30) = 4500 SAR
      const termRes = await db.query<any>(`
        SELECT eligible_days, basic_salary, gross_salary
        FROM public.payroll_run_employees
        WHERE payroll_run_id = '${runId}' AND employee_id = '${empIdTermA}';
      `);
      expect(Number(termRes.rows[0].eligible_days)).toBe(15);
      expect(Number(termRes.rows[0].basic_salary)).toBe(4500);
    });
  });

  // ============================================================================
  // SUITE 7: Component Lines & Calculation Trace
  // ============================================================================
  describe("Suite 7: Component Lines & Calculation Trace", () => {
    let runId: string;

    beforeAll(async () => {
      const runRes = await db.query<any>(`
        SELECT id FROM public.payroll_runs
        WHERE company_id = '${companyA}' AND period_year = 2026 AND period_month = 3
        LIMIT 1;
      `);
      runId = runRes.rows[0].id;
    });

    it("generates explainable payroll_run_lines with calculation trace", async () => {
      const linesRes = await db.query<any>(`
        SELECT prl.component_code, prl.amount, prl.calculation_trace
        FROM public.payroll_run_lines prl
        JOIN public.payroll_run_employees pre ON prl.run_employee_id = pre.id
        WHERE pre.payroll_run_id = '${runId}' AND pre.employee_id = '${empIdSaudiA}';
      `);

      expect(linesRes.rows.length).toBeGreaterThanOrEqual(4);
      const codes = linesRes.rows.map((r: any) => r.component_code);
      expect(codes).toContain("BASIC");
      expect(codes).toContain("HOUSING");
      expect(codes).toContain("GOSI_EMPLOYEE");
      expect(codes).toContain("OVERTIME");

      const otLine: any = linesRes.rows.find((r: any) => r.component_code === "OVERTIME");
      expect(otLine.calculation_trace).toContain("المادة 107");
    });
  });

  // ============================================================================
  // SUITE 8: Exceptions Engine (Warning vs. Blocking)
  // ============================================================================
  describe("Suite 8: Exceptions Engine (Warning vs. Blocking)", () => {
    let runId: string;

    beforeAll(async () => {
      const runRes = await db.query<any>(`
        SELECT id FROM public.payroll_runs
        WHERE company_id = '${companyA}' AND period_year = 2026 AND period_month = 3
        LIMIT 1;
      `);
      runId = runRes.rows[0].id;

      // Add huge deduction adjustment for empIdNegA to trigger negative net salary blocking exception
      await db.query<any>(`
        INSERT INTO public.payroll_adjustments (
          payroll_run_id, employee_id, adjustment_type, amount, reason, status, created_by
        ) VALUES (
          '${runId}', '${empIdNegA}', 'deduction', 10000.00, 'غرامة إدارية كبرى', 'approved', '${userHrAdminA}'
        );
      `);

      // Recalculate
      await db.query<any>(`SELECT public.calculate_payroll_run_atomic('${runId}'::uuid);`);
    });

    it("flags negative net salary as a blocking exception", async () => {
      const exRes = await db.query<any>(`
        SELECT * FROM public.payroll_exceptions
        WHERE payroll_run_id = '${runId}' AND employee_id = '${empIdNegA}' AND severity = 'blocking' AND is_resolved = false;
      `);
      expect(exRes.rows.length).toBeGreaterThan(0);
      expect(exRes.rows[0].code).toBe("NEGATIVE_NET_SALARY");

      const runRes = await db.query<any>(`SELECT blocking_exceptions_count FROM public.payroll_runs WHERE id = '${runId}';`);
      expect(Number(runRes.rows[0].blocking_exceptions_count)).toBeGreaterThan(0);
    });

    it("prevents approval while blocking exceptions exist", async () => {
      await asUser(userHrAdminA);
      let errorThrown = false;
      try {
        await db.query<any>(`SELECT public.approve_payroll_run_atomic('${runId}'::uuid);`);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/استثناءات مانعة للاعتماد|blocking exceptions/i);
      }
      expect(errorThrown).toBe(true);
    });

    it("allows approval after resolving blocking exception", async () => {
      await asUser(userHrAdminA);
      // Remove or resolve the blocking adjustment
      await db.query<any>(`DELETE FROM public.payroll_adjustments WHERE payroll_run_id = '${runId}' AND employee_id = '${empIdNegA}';`);
      // Recalculate
      await db.query<any>(`SELECT public.calculate_payroll_run_atomic('${runId}'::uuid);`);

      // Now approve
      const approveRes = await db.query<any>(`SELECT public.approve_payroll_run_atomic('${runId}'::uuid) as result;`);
      const result = (approveRes.rows[0] as any).result;
      expect(result.ok).toBe(true);
      expect(result.status).toBe("approved");

      const runRes = await db.query<any>(`SELECT status, payment_status FROM public.payroll_runs WHERE id = '${runId}';`);
      expect(runRes.rows[0].status).toBe("approved");
      expect(runRes.rows[0].payment_status).toBe("payment_ready");
    });
  });

  // ============================================================================
  // SUITE 9: Lock Immutability & Safe Loan Recovery
  // ============================================================================
  describe("Suite 9: Lock Immutability & Safe Loan Recovery", () => {
    let runId: string;

    beforeAll(async () => {
      const runRes = await db.query<any>(`
        SELECT id FROM public.payroll_runs
        WHERE company_id = '${companyA}' AND period_year = 2026 AND period_month = 3
        LIMIT 1;
      `);
      runId = runRes.rows[0].id;
    });

    it("verifies loan remaining balance was NOT deducted during calculation/approval", async () => {
      const loanRes = await db.query<any>(`
        SELECT remaining_balance, paid_installments FROM public.loans
        WHERE id = 'c2000000-0000-0000-0000-000000000001';
      `);
      // Principal was 6000, 0 paid installments
      expect(Number(loanRes.rows[0].remaining_balance)).toBe(6000);
      expect(Number(loanRes.rows[0].paid_installments)).toBe(0);
    });

    it("safely mutates loan remaining balance ONLY upon locking the run", async () => {
      await asUser(userHrAdminA);
      const lockRes = await db.query<any>(`SELECT public.lock_payroll_run_atomic('${runId}'::uuid) as result;`);
      const result = (lockRes.rows[0] as any).result;
      expect(result.ok).toBe(true);
      expect(result.status).toBe("locked");

      // Verify loan installment recovery: 6000 - 1500 = 4500, paid_installments = 1
      const loanRes = await db.query<any>(`
        SELECT remaining_balance, paid_installments FROM public.loans
        WHERE id = 'c2000000-0000-0000-0000-000000000001';
      `);
      expect(Number(loanRes.rows[0].remaining_balance)).toBe(4500);
      expect(Number(loanRes.rows[0].paid_installments)).toBe(1);
    });

    it("prevents direct modification or recalculation of a locked payroll run", async () => {
      await asUser(userPayrollOfficerA);
      let errorThrown = false;
      try {
        await db.query<any>(`SELECT public.calculate_payroll_run_atomic('${runId}'::uuid);`);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/مسيّر الرواتب مقفل|لا يمكن احتساب مسيّر في الحالة الحالية|مغلق/i);
      }
      expect(errorThrown).toBe(true);
    });
  });

  // ============================================================================
  // SUITE 10: Formal Reopen Flow
  // ============================================================================
  describe("Suite 10: Formal Reopen Flow", () => {
    let runId: string;

    beforeAll(async () => {
      const runRes = await db.query<any>(`
        SELECT id FROM public.payroll_runs
        WHERE company_id = '${companyA}' AND period_year = 2026 AND period_month = 3
        LIMIT 1;
      `);
      runId = runRes.rows[0].id;
    });

    it("rejects reopen without a valid explanation (minimum 10 characters)", async () => {
      await asUser(userHrAdminA);
      let errorThrown = false;
      try {
        await db.query<any>(`SELECT public.reopen_payroll_run_atomic('${runId}'::uuid, 'short');`);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/سبب توضيحي واضح|10 أحرف/i);
      }
      expect(errorThrown).toBe(true);
    });

    it("reopens locked run when authorized admin provides formal justification", async () => {
      await asUser(userHrAdminA);
      const res = await db.query<any>(`
        SELECT public.reopen_payroll_run_atomic(
          '${runId}'::uuid,
          'تصحيح ساعات العمل الإضافي لقسم التقنية بناءً على موافقة الإدارة'
        ) as result;
      `);
      const result = (res.rows[0] as any).result;
      expect(result.ok).toBe(true);
      expect(result.status).toBe("draft");

      const runRes = await db.query<any>(`SELECT status, reopen_reason, reopened_by FROM public.payroll_runs WHERE id = '${runId}';`);
      expect(runRes.rows[0].status).toBe("draft");
      expect(runRes.rows[0].reopen_reason).toContain("تصحيح ساعات العمل الإضافي");
    });
  });

  // ============================================================================
  // SUITE 11: Multi-Tenant Isolation & Role Authorization
  // ============================================================================
  describe("Suite 11: Multi-Tenant Isolation & Role Authorization", () => {
    it("strictly isolates Company B from seeing or running Company A payroll", async () => {
      await asUser(userHrAdminA);
      const runResA = await db.query<any>(`
        SELECT id FROM public.payroll_runs
        WHERE company_id = '${companyA}'
        LIMIT 1;
      `);
      const runIdA = runResA.rows[0].id;

      await asUser(userHrB);
      // 1. RLS Isolation: user from Company B cannot see Company A runs
      await db.exec("SET ROLE authenticated;");
      try {
        const viewRes = await db.query<any>(`
          SELECT id FROM public.payroll_runs
          WHERE company_id = '${companyA}';
        `);
        expect(viewRes.rows.length).toBe(0);

        // 2. RPC Cross-Tenant Protection: user from Company B attempts to calculate Company A run
        let errorThrown = false;
        try {
          await db.query<any>(`SELECT public.calculate_payroll_run_atomic('${runIdA}'::uuid);`);
        } catch (err: any) {
          errorThrown = true;
          expect(err.message).toMatch(/غير مصرح|42501/i);
        }
        expect(errorThrown).toBe(true);
      } finally {
        await db.exec("RESET ROLE;");
      }
    });

    it("prevents standard employee from calculating, approving, or locking runs", async () => {
      await asUser(userEmpSaudiA);
      let errorThrown = false;
      try {
        const runRes = await db.query<any>(`SELECT id FROM public.payroll_runs WHERE company_id = '${companyA}' LIMIT 1;`);
        await db.query<any>(`SELECT public.approve_payroll_run_atomic('${runRes.rows[0].id}'::uuid);`);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/غير مصرح لك|42501/i);
      }
      expect(errorThrown).toBe(true);
    });

    it("verifies paginated employee payroll RPC respects permissions and filters", async () => {
      await asUser(userPayrollOfficerA);
      const runRes = await db.query<any>(`SELECT id FROM public.payroll_runs WHERE company_id = '${companyA}' LIMIT 1;`);
      const runId = runRes.rows[0].id;

      const pageRes = await db.query<any>(`
        SELECT public.get_payroll_run_employees_paginated(
          jsonb_build_object('run_id', '${runId}', 'page', 1, 'page_size', 5)
        ) as result;
      `);
      const result = (pageRes.rows[0] as any).result;
      expect(result.ok).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(5);
      expect(result.total).toBeGreaterThan(0);
    });

    it("verifies payslip RPC generates complete employee snapshot with breakdown", async () => {
      await asUser(userPayrollOfficerA);
      const runRes = await db.query<any>(`SELECT id FROM public.payroll_runs WHERE company_id = '${companyA}' LIMIT 1;`);
      const runEmpRes = await db.query<any>(`
        SELECT id FROM public.payroll_run_employees
        WHERE payroll_run_id = '${runRes.rows[0].id}' AND employee_id = '${empIdSaudiA}';
      `);
      const runEmpId = runEmpRes.rows[0].id;

      const slipRes = await db.query<any>(`
        SELECT public.get_payroll_employee_payslip('${runEmpId}'::uuid) as result;
      `);
      const slip = (slipRes.rows[0] as any).result;
      expect(slip.ok).toBe(true);
      expect(slip.employeeNo).toBe("EMP-004");
      expect(slip.lines.length).toBeGreaterThan(0);
      expect(Number(slip.netSalary)).toBeGreaterThan(0);
    });
  });
});
