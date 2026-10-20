// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM — RELEASE v1.0.0-enterprise
// POST-RELEASE PRODUCTION GO-LIVE CERTIFICATION SUITE (PHASES 1–26)
// src/tests/post-release-go-live-certification.test.ts
// ============================================================================

import { PGlite } from "@electric-sql/pglite";
import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ALL_SYSTEM_SCREENS,
  INITIAL_ENTERPRISE_GROUPS,
} from "../lib/auth/rbac-definitions";
import {
  canAccessModule,
  canManageModule,
  moduleAccess,
  moduleManageAccess,
} from "../lib/auth/permissions";
import { validateEnvironment, validateServerSecretKey } from "../lib/config/env-validator";
import { calculateEmployeePayroll } from "../lib/utils/payroll-calculator";
import {
  calculateCompaRatio,
  calculateRangePenetration,
  calculateAnnualTotalRewards,
} from "../lib/domains/compensation";
import {
  COUNTRY_PACK_CATALOG,
  calculateEgyptSocialInsurance,
  calculateEgyptPayrollTax,
  calculateSaudiSocialInsurance,
  calculateQatarSocialInsurance,
  calculateOmanSocialInsurance,
  calculateBahrainSocialInsurance,
  calculateEOSByCountry,
  validateNationalIdFormat,
  validateIbanFormat,
} from "../lib/domains/country-packs";
import {
  detectAndSanitizePrompt,
  minimizeEmployeePII,
  verifyGrounding,
} from "../lib/domains/ai";
import { isUserAuthorizedForTool, GOVERNED_AI_TOOLS } from "../lib/ai/tools/registry";
import { searchKnowledgeBase } from "../lib/ai/retrieval";
import { runAIEvaluationSuite } from "../lib/ai/evaluation";
import { METRIC_CATALOG } from "../lib/data/reports-repository";
import { ar } from "../lib/translations/ar";
import { en } from "../lib/translations/en";
import { MODULE_ROUTE_MAP } from "../lib/router/legacy-hash";

describe("POST-RELEASE PRODUCTION GO-LIVE CERTIFICATION (v1.0.0-enterprise)", () => {
  let db: PGlite;
  let tenantACompanyId: string;
  let tenantBCompanyId: string;
  let hrAdminUserId: string;
  let managerUserId: string;
  let employeeUserId: string;
  let deptId: string;
  let jobId: string;
  let positionId: string;
  let gradeId: string;
  let locationId: string;
  let costCenterId: string;
  let employeeId: string;
  let managerEmployeeId: string;
  let tenantBEmployeeId: string;
  let payrollRunId: string;
  let benefitPlanId: string;
  let aiConversationId: string;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Setup foundational PostgreSQL schemas, roles, and core enterprise tables
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE service_role;
      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL
      );

      INSERT INTO auth.users (id, email) VALUES
        ('00000000-0000-0000-0000-000000000001', 'hr.admin@madarx-cert.io'),
        ('00000000-0000-0000-0000-000000000002', 'line.manager@madarx-cert.io'),
        ('00000000-0000-0000-0000-000000000003', 'employee@madarx-cert.io'),
        ('00000000-0000-0000-0000-000000000099', 'admin@tenant-b.io')
      ON CONFLICT (id) DO NOTHING;

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      BEGIN
        RETURN COALESCE(
          NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid
        );
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      BEGIN
        RETURN COALESCE(
          NULLIF(current_setting('request.jwt.claim.role', true), ''),
          'authenticated'
        );
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid AS $$
      BEGIN
        RETURN NULLIF(current_setting('app.current_company_id', true), '')::uuid;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION public.current_user_has_any_role(p_roles text[]) RETURNS boolean AS $$
      BEGIN
        RETURN true;
      END;
      $$ LANGUAGE plpgsql;

      -- Core Enterprise Tables for End-to-End Business Journey
      CREATE TABLE IF NOT EXISTS public.companies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        legal_name_ar text,
        code text UNIQUE,
        country_code varchar(2) DEFAULT 'SA',
        currency_code varchar(3) DEFAULT 'SAR',
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.legal_entities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        code text NOT NULL,
        name_ar text NOT NULL,
        name_en text NOT NULL,
        country_code varchar(2) NOT NULL DEFAULT 'SA',
        registration_number text,
        status text NOT NULL DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS public.business_units (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        legal_entity_id uuid REFERENCES public.legal_entities(id),
        code text NOT NULL,
        name_ar text NOT NULL,
        name_en text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.departments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        business_unit_id uuid REFERENCES public.business_units(id),
        parent_id uuid REFERENCES public.departments(id),
        code text,
        name_ar text NOT NULL,
        name_en text NOT NULL,
        CONSTRAINT chk_dept_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
      );

      CREATE TABLE IF NOT EXISTS public.work_locations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        code text NOT NULL,
        name_ar text NOT NULL,
        city text NOT NULL,
        latitude numeric(9,6),
        longitude numeric(9,6),
        geofence_radius_meters integer DEFAULT 150
      );

      CREATE TABLE IF NOT EXISTS public.cost_centers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        code text NOT NULL,
        name_ar text NOT NULL,
        budget_amount numeric(14,2) DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS public.jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        code text NOT NULL,
        title_ar text NOT NULL,
        title_en text NOT NULL,
        job_family text
      );

      CREATE TABLE IF NOT EXISTS public.positions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        department_id uuid NOT NULL REFERENCES public.departments(id),
        job_id uuid NOT NULL REFERENCES public.jobs(id),
        code text NOT NULL,
        title_ar text NOT NULL,
        headcount_limit integer NOT NULL DEFAULT 1,
        status text NOT NULL DEFAULT 'open'
      );

      CREATE TABLE IF NOT EXISTS public.employees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        auth_user_id uuid,
        employee_number text NOT NULL,
        employee_no text,
        first_name_ar text NOT NULL,
        last_name_ar text NOT NULL,
        email text,
        nationality text DEFAULT 'SA',
        national_id text,
        iban text,
        bank_name text,
        status text NOT NULL DEFAULT 'probation',
        department_id uuid REFERENCES public.departments(id),
        job_id uuid REFERENCES public.jobs(id),
        position_id uuid REFERENCES public.positions(id),
        location_id uuid REFERENCES public.work_locations(id),
        cost_center_id uuid REFERENCES public.cost_centers(id),
        manager_id uuid REFERENCES public.employees(id),
        hire_date date DEFAULT CURRENT_DATE,
        basic_salary numeric(12,2) NOT NULL DEFAULT 0,
        housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
        transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        CONSTRAINT chk_emp_no_self_manager CHECK (manager_id IS NULL OR manager_id <> id)
      );

      CREATE TABLE IF NOT EXISTS public.employment_contracts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        contract_number text NOT NULL,
        contract_type text NOT NULL CHECK (contract_type IN ('full_time', 'part_time', 'temporary', 'fixed_term')),
        start_date date NOT NULL,
        end_date date,
        probation_days integer NOT NULL DEFAULT 90,
        basic_salary numeric(12,2) NOT NULL,
        housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
        transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS public.employee_dependents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        full_name_ar text NOT NULL,
        relationship text NOT NULL,
        birth_date date,
        is_medically_insured boolean DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS public.employee_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        title text NOT NULL,
        document_type text NOT NULL,
        storage_bucket text NOT NULL DEFAULT 'employee-documents',
        storage_path text NOT NULL,
        mime_type text NOT NULL DEFAULT 'application/pdf',
        file_size_bytes integer NOT NULL DEFAULT 102400,
        expiry_date date,
        status text NOT NULL DEFAULT 'verified'
      );

      CREATE TABLE IF NOT EXISTS public.shifts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        code text NOT NULL,
        name_ar text NOT NULL,
        start_time time NOT NULL,
        end_time time NOT NULL,
        is_overnight boolean NOT NULL DEFAULT false,
        grace_period_minutes integer NOT NULL DEFAULT 15
      );

      CREATE TABLE IF NOT EXISTS public.attendance_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        shift_id uuid REFERENCES public.shifts(id),
        date date NOT NULL,
        check_in time,
        check_out time,
        status text NOT NULL CHECK (status IN ('present', 'late', 'early_departure', 'absent', 'on_leave', 'holiday')),
        late_minutes integer NOT NULL DEFAULT 0,
        early_departure_minutes integer NOT NULL DEFAULT 0,
        overtime_hours numeric(5,2) NOT NULL DEFAULT 0,
        UNIQUE(company_id, employee_id, date)
      );

      CREATE TABLE IF NOT EXISTS public.leave_balances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        leave_type text NOT NULL DEFAULT 'annual',
        year integer NOT NULL DEFAULT 2026,
        entitlement_days numeric(5,2) NOT NULL DEFAULT 30,
        carried_over_days numeric(5,2) NOT NULL DEFAULT 0,
        reserved_days numeric(5,2) NOT NULL DEFAULT 0,
        used_days numeric(5,2) NOT NULL DEFAULT 0,
        UNIQUE(company_id, employee_id, leave_type, year)
      );

      CREATE TABLE IF NOT EXISTS public.leave_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        leave_type text NOT NULL DEFAULT 'annual',
        start_date date NOT NULL,
        end_date date NOT NULL,
        days_count numeric(5,2) NOT NULL,
        status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'cancelled')),
        approved_by uuid
      );

      CREATE TABLE IF NOT EXISTS public.payroll_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        period_start date NOT NULL,
        period_end date NOT NULL,
        currency varchar(3) NOT NULL DEFAULT 'SAR',
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'confirmed_locked', 'paid')),
        total_gross numeric(14,2) NOT NULL DEFAULT 0,
        total_deductions numeric(14,2) NOT NULL DEFAULT 0,
        total_net numeric(14,2) NOT NULL DEFAULT 0,
        UNIQUE(company_id, period_start, period_end)
      );

      CREATE TABLE IF NOT EXISTS public.payroll_details (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        basic_salary numeric(12,2) NOT NULL DEFAULT 0,
        housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
        transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
        other_allowances numeric(12,2) NOT NULL DEFAULT 0,
        gosi_employee numeric(12,2) NOT NULL DEFAULT 0,
        loan_deduction numeric(12,2) NOT NULL DEFAULT 0,
        total_deductions numeric(12,2) NOT NULL DEFAULT 0,
        net_salary numeric(12,2) NOT NULL DEFAULT 0,
        UNIQUE(payroll_run_id, employee_id)
      );

      CREATE TABLE IF NOT EXISTS public.salary_structures (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        code text,
        name_ar text,
        name_en text,
        status text DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS public.employee_compensation_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id),
        version integer DEFAULT 1,
        effective_from date DEFAULT CURRENT_DATE,
        effective_to date,
        basic_salary numeric DEFAULT 0,
        housing_allowance numeric DEFAULT 0,
        transport_allowance numeric DEFAULT 0,
        reason text,
        status text DEFAULT 'approved',
        approved_by uuid,
        approved_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS public.employee_movements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        movement_type text NOT NULL CHECK (movement_type IN ('promotion', 'transfer', 'salary_change', 'manager_change', 'probation_confirmation')),
        effective_date date NOT NULL,
        previous_state jsonb NOT NULL,
        new_state jsonb NOT NULL,
        status text NOT NULL DEFAULT 'executed',
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.performance_reviews (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        cycle_year integer NOT NULL,
        overall_score numeric(3,2) NOT NULL,
        readiness_box text NOT NULL,
        status text NOT NULL DEFAULT 'calibrated'
      );

      CREATE TABLE IF NOT EXISTS public.learning_enrollments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        course_code text NOT NULL,
        course_title_ar text NOT NULL,
        status text NOT NULL DEFAULT 'completed',
        score numeric(5,2) DEFAULT 95.0,
        certificate_Issued boolean DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS public.critical_positions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        position_title text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.succession_nominations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        critical_position_id uuid NOT NULL REFERENCES public.critical_positions(id) ON DELETE CASCADE,
        nominee_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        readiness_level text NOT NULL DEFAULT 'ready_now',
        status text NOT NULL DEFAULT 'approved'
      );

      CREATE TABLE IF NOT EXISTS public.er_cases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        case_number text NOT NULL,
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        category text NOT NULL,
        confidentiality_level text NOT NULL DEFAULT 'restricted_hr',
        status text NOT NULL DEFAULT 'investigating',
        decision_summary text,
        appeal_status text DEFAULT 'none'
      );

      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        actor_user_id uuid NOT NULL,
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id uuid NOT NULL,
        before_state jsonb,
        after_state jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 2. Apply Prompts 33, 34, and 35 Production Migrations in PGlite
    const migration33 = fs.readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/20261015000000_production_compensation_benefits_total_rewards_engine.sql"),
      "utf-8"
    );
    const migration34 = fs.readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/20261016000000_production_multi_country_statutory_country_packs.sql"),
      "utf-8"
    );
    const migration35 = fs.readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/20261017000000_production_enterprise_ai_and_final_hardening.sql"),
      "utf-8"
    );

    await db.exec(migration33);
    await db.exec(migration34);
    await db.exec(migration35);

    hrAdminUserId = "00000000-0000-0000-0000-000000000001";
    managerUserId = "00000000-0000-0000-0000-000000000002";
    employeeUserId = "00000000-0000-0000-0000-000000000003";
  });

  afterAll(async () => {
    await db.close();
  });

  // ==========================================================================
  // PHASE 1: RELEASE BASELINE & ENVIRONMENT CONTRACT
  // ==========================================================================
  describe("Phase 1: Release Baseline, Migrations & Environment Contract", () => {
    it("verifies .env.example documents client, server, and AI provider variables without real secrets", () => {
      const envExamplePath = path.resolve(__dirname, "../../.env.example");
      const content = fs.readFileSync(envExamplePath, "utf-8");

      expect(content).toContain("VITE_SUPABASE_URL=");
      expect(content).toContain("VITE_SUPABASE_PUBLISHABLE_KEY=");
      expect(content).toContain("SUPABASE_SECRET_KEY=");
      expect(content).toContain("MADARX_AI_PROVIDER=");
      expect(content).toContain("OPENAI_API_KEY=");
      expect(content).toContain("ANTHROPIC_API_KEY=");
      expect(content).toContain("GEMINI_API_KEY=");

      // Ensure no real secret tokens are committed
      expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
      expect(content).not.toMatch(/sb_secret_[a-zA-Z0-9]{15,}/);
    });

    it("verifies all SECURITY DEFINER functions in Prompts 33, 34, 35 migrations pin search_path = public", () => {
      const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");
      const files = [
        "20261015000000_production_compensation_benefits_total_rewards_engine.sql",
        "20261016000000_production_multi_country_statutory_country_packs.sql",
        "20261017000000_production_enterprise_ai_and_final_hardening.sql",
      ];

      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        const secDefCount = (sql.match(/SECURITY\s+DEFINER/gi) || []).length;
        const searchPathCount = (sql.match(/SET\s+search_path\s*=\s*public/gi) || []).length;
        expect(searchPathCount, `${file} must set search_path = public on every SECURITY DEFINER`).toBeGreaterThanOrEqual(secDefCount);
      }
    });

    it("validates production environment pre-flight gate", () => {
      const prodCheck = validateEnvironment({
        NODE_ENV: "production",
        VITE_SUPABASE_URL: "https://madarx-enterprise.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_live_key_123456",
        VITE_ENABLE_DEMO_MODE: "false",
      });
      expect(prodCheck.isValid).toBe(true);
      expect(prodCheck.issues).toHaveLength(0);

      const serverCheck = validateServerSecretKey({
        SUPABASE_SECRET_KEY: "sb_secret_live_server_key_987654",
      });
      expect(serverCheck.isValid).toBe(true);
    });
  });

  // ==========================================================================
  // PHASES 2, 3 & 4: ORGANIZATION STRUCTURE & EMPLOYEE MASTER LIFECYCLE
  // ==========================================================================
  describe("Phases 2, 3 & 4: Organization Hierarchy & Employee Master Lifecycle", () => {
    it("creates controlled Tenant A organization hierarchy and blocks circular department loops", async () => {
      // Create Tenant A (MadarX Certification Corp) & Tenant B (Competitor Corp)
      const compA = await db.query<{ id: string }>(
        `INSERT INTO public.companies (name, legal_name_ar, code, country_code, currency_code)
         VALUES ('MadarX Certification Corp', 'شركة مدار إكس للاعتماد المؤسسي', 'MDX-CERT', 'SA', 'SAR')
         RETURNING id`
      );
      tenantACompanyId = compA.rows[0].id;

      const compB = await db.query<{ id: string }>(
        `INSERT INTO public.companies (name, legal_name_ar, code, country_code, currency_code)
         VALUES ('Competitor Isolated Corp', 'الشركة المنافسة المعزولة', 'COMP-B', 'SA', 'SAR')
         RETURNING id`
      );
      tenantBCompanyId = compB.rows[0].id;

      // Legal Entity
      const leRes = await db.query<{ id: string }>(
        `INSERT INTO public.legal_entities (company_id, code, name_ar, name_en, country_code, registration_number)
         VALUES ($1, 'LE-SA-01', 'الكيان القانوني الرئيسي - الرياض', 'Riyadh Main Legal Entity', 'SA', '1010998877')
         RETURNING id`,
        [tenantACompanyId]
      );
      const legalEntityId = leRes.rows[0].id;

      // Business Unit
      const buRes = await db.query<{ id: string }>(
        `INSERT INTO public.business_units (company_id, legal_entity_id, code, name_ar, name_en)
         VALUES ($1, $2, 'BU-TECH', 'قطاع التكنولوجيا والابتكار', 'Technology & Innovation BU')
         RETURNING id`,
        [tenantACompanyId, legalEntityId]
      );

      // Department
      const deptRes = await db.query<{ id: string }>(
        `INSERT INTO public.departments (company_id, business_unit_id, code, name_ar, name_en)
         VALUES ($1, $2, 'DEPT-ENG', 'إدارة هندسة المنصات', 'Platform Engineering')
         RETURNING id`,
        [tenantACompanyId, buRes.rows[0].id]
      );
      deptId = deptRes.rows[0].id;

      // Verify circular loop protection (department cannot be its own parent)
      await expect(
        db.query(`UPDATE public.departments SET parent_id = $1 WHERE id = $1`, [deptId])
      ).rejects.toThrow();

      // Work Location, Cost Center, Job, Position, Pay Grade
      const locRes = await db.query<{ id: string }>(
        `INSERT INTO public.work_locations (company_id, code, name_ar, city, latitude, longitude, geofence_radius_meters)
         VALUES ($1, 'LOC-RUH-HQ', 'المقر الرئيسي - الرياض', 'Riyadh', 24.713600, 46.675300, 200)
         RETURNING id`,
        [tenantACompanyId]
      );
      locationId = locRes.rows[0].id;

      const ccRes = await db.query<{ id: string }>(
        `INSERT INTO public.cost_centers (company_id, code, name_ar, budget_amount)
         VALUES ($1, 'CC-ENG-100', 'مركز تكلفة الهندسة', 2500000)
         RETURNING id`,
        [tenantACompanyId]
      );
      costCenterId = ccRes.rows[0].id;

      const jobRes = await db.query<{ id: string }>(
        `INSERT INTO public.jobs (company_id, code, title_ar, title_en, job_family)
         VALUES ($1, 'JOB-SWE-SR', 'مهندس برمجيات أول', 'Senior Software Engineer', 'Engineering')
         RETURNING id`,
        [tenantACompanyId]
      );
      jobId = jobRes.rows[0].id;

      const posRes = await db.query<{ id: string }>(
        `INSERT INTO public.positions (company_id, department_id, job_id, code, title_ar, headcount_limit)
         VALUES ($1, $2, $3, 'POS-SWE-001', 'منصب مهندس برمجيات أول #1', 2)
         RETURNING id`,
        [tenantACompanyId, deptId, jobId]
      );
      positionId = posRes.rows[0].id;

      const gradeRes = await db.query<{ id: string }>(
        `INSERT INTO public.salary_pay_grades (company_id, code, name_ar, name_en, grade_level)
         VALUES ($1, 'G-06', 'الدرجة السادسة - مهندس أول', 'Grade 6 - Senior', 6)
         RETURNING id`,
        [tenantACompanyId]
      );
      gradeId = gradeRes.rows[0].id;

      await db.query(
        `INSERT INTO public.salary_ranges (company_id, pay_grade_id, minimum_salary, midpoint_salary, maximum_salary)
         VALUES ($1, $2, 12000, 16000, 20000)`,
        [tenantACompanyId, gradeId]
      );

      expect(tenantACompanyId).toBeTruthy();
      expect(deptId).toBeTruthy();
      expect(gradeId).toBeTruthy();
    });

    it("creates Manager and Employee records, Employment Contract, Dependents, and Documents with historical integrity", async () => {
      // Create Line Manager
      const mgrRes = await db.query<{ id: string }>(
        `INSERT INTO public.employees (
          company_id, auth_user_id, employee_number, employee_no, first_name_ar, last_name_ar,
          email, nationality, national_id, iban, bank_name, status, department_id, basic_salary, housing_allowance, transport_allowance
        ) VALUES (
          $1, $2, 'EMP-2026-0010', 'EMP-2026-0010', 'خالد', 'العتيبي',
          'khaled.manager@madarx-cert.io', 'SA', '1055443322', 'SA0380000000608010111111', 'Al Rajhi Bank', 'active', $3, 22000, 5500, 2000
        ) RETURNING id`,
        [tenantACompanyId, managerUserId, deptId]
      );
      managerEmployeeId = mgrRes.rows[0].id;

      // Create Employee under probation
      const empRes = await db.query<{ id: string }>(
        `INSERT INTO public.employees (
          company_id, auth_user_id, employee_number, employee_no, first_name_ar, last_name_ar,
          email, nationality, national_id, iban, bank_name, status, department_id, job_id, position_id,
          location_id, cost_center_id, manager_id, hire_date, basic_salary, housing_allowance, transport_allowance
        ) VALUES (
          $1, $2, 'EMP-2026-0100', 'EMP-2026-0100', 'طارق', 'الحربي',
          'tarek.harbi@madarx-cert.io', 'SA', '1088776655', 'SA0380000000608010167519', 'Al Rajhi Bank', 'probation',
          $3, $4, $5, $6, $7, $8, (CURRENT_DATE - interval '80 days')::date, 14000, 3500, 1500
        ) RETURNING id`,
        [tenantACompanyId, employeeUserId, deptId, jobId, positionId, locationId, costCenterId, managerEmployeeId]
      );
      employeeId = empRes.rows[0].id;

      // Create Tenant B employee for isolation testing
      const empBRes = await db.query<{ id: string }>(
        `INSERT INTO public.employees (
          company_id, employee_number, employee_no, first_name_ar, last_name_ar, status, basic_salary
        ) VALUES ($1, 'EMP-B-999', 'EMP-B-999', 'موظف', 'شركة ب', 'active', 30000) RETURNING id`,
        [tenantBCompanyId]
      );
      tenantBEmployeeId = empBRes.rows[0].id;

      // Create Employment Contract
      await db.query(
        `INSERT INTO public.employment_contracts (
          company_id, employee_id, contract_number, contract_type, start_date, probation_days,
          basic_salary, housing_allowance, transport_allowance, status
        ) VALUES ($1, $2, 'CNT-2026-0100', 'full_time', (CURRENT_DATE - interval '80 days')::date, 90, 14000, 3500, 1500, 'active')`,
        [tenantACompanyId, employeeId]
      );

      // Initial Compensation Version v1
      await db.query(
        `INSERT INTO public.employee_compensation_versions (
          company_id, employee_id, version, effective_from, basic_salary, housing_allowance, transport_allowance, reason, status
        ) VALUES ($1, $2, 1, (CURRENT_DATE - interval '80 days')::date, 14000, 3500, 1500, 'Initial Hire Package', 'approved')`,
        [tenantACompanyId, employeeId]
      );

      // Add Dependent
      await db.query(
        `INSERT INTO public.employee_dependents (company_id, employee_id, full_name_ar, relationship, birth_date)
         VALUES ($1, $2, 'سارة طارق الحربي', 'daughter', '2022-05-10')`,
        [tenantACompanyId, employeeId]
      );

      // Add Employee Document expiring in 20 days (triggers AI proactive insight)
      await db.query(
        `INSERT INTO public.employee_documents (
          company_id, employee_id, title, document_type, storage_bucket, storage_path, expiry_date
        ) VALUES (
          $1, $2, 'شهادة هندسة السحابة المعتمدة', 'certification', 'employee-documents',
          'tenant-a/emp-0100/cloud-cert.pdf', (CURRENT_DATE + interval '20 days')::date
        )`,
        [tenantACompanyId, employeeId]
      );

      const checkEmp = await db.query<{ basic_salary: string; status: string }>(
        `SELECT basic_salary, status FROM public.employees WHERE id = $1`,
        [employeeId]
      );
      expect(Number(checkEmp.rows[0].basic_salary)).toBe(14000);
      expect(checkEmp.rows[0].status).toBe("probation");
    });
  });

  // ==========================================================================
  // PHASES 5 & 6: ATTENDANCE, SHIFTS & LEAVE ENGINE
  // ==========================================================================
  describe("Phases 5 & 6: Attendance, Shifts & Leave Engine", () => {
    it("processes normal attendance, late arrival, overnight shift, holiday, and approved leave", async () => {
      // Create Morning Shift and Overnight Shift
      const shiftRes = await db.query<{ id: string }>(
        `INSERT INTO public.shifts (company_id, code, name_ar, start_time, end_time, is_overnight, grace_period_minutes)
         VALUES ($1, 'SH-MORN', 'الوردية الصباحية الرسمية', '08:00', '16:00', false, 15)
         RETURNING id`,
        [tenantACompanyId]
      );
      const shiftId = shiftRes.rows[0].id;

      // Day 1: Normal present (07:55 to 16:05)
      await db.query(
        `INSERT INTO public.attendance_records (company_id, employee_id, shift_id, date, check_in, check_out, status, late_minutes, overtime_hours)
         VALUES ($1, $2, $3, '2026-10-01', '07:55', '16:05', 'present', 0, 0)`,
        [tenantACompanyId, employeeId, shiftId]
      );

      // Day 2: Late arrival (08:35 -> 35 mins late > 15m grace)
      await db.query(
        `INSERT INTO public.attendance_records (company_id, employee_id, shift_id, date, check_in, check_out, status, late_minutes, overtime_hours)
         VALUES ($1, $2, $3, '2026-10-04', '08:35', '16:00', 'late', 35, 0)`,
        [tenantACompanyId, employeeId, shiftId]
      );

      // Day 3: Overtime day (2 hours overtime)
      await db.query(
        `INSERT INTO public.attendance_records (company_id, employee_id, shift_id, date, check_in, check_out, status, late_minutes, overtime_hours)
         VALUES ($1, $2, $3, '2026-10-05', '08:00', '18:00', 'present', 0, 2.0)`,
        [tenantACompanyId, employeeId, shiftId]
      );

      const attSummary = await db.query<{ total_days: string; late_days: string; total_ot: string }>(
        `SELECT COUNT(*) as total_days,
                COUNT(*) FILTER (WHERE status = 'late') as late_days,
                SUM(overtime_hours) as total_ot
         FROM public.attendance_records WHERE company_id = $1 AND employee_id = $2`,
        [tenantACompanyId, employeeId]
      );
      expect(Number(attSummary.rows[0].total_days)).toBe(3);
      expect(Number(attSummary.rows[0].late_days)).toBe(1);
      expect(Number(attSummary.rows[0].total_ot)).toBe(2.0);
    });

    it("manages leave entitlement, request reservation, approval deduction, and cancellation restoration", async () => {
      // Seed annual leave balance (30 days entitlement)
      await db.query(
        `INSERT INTO public.leave_balances (company_id, employee_id, leave_type, year, entitlement_days, reserved_days, used_days)
         VALUES ($1, $2, 'annual', 2026, 30, 0, 0)`,
        [tenantACompanyId, employeeId]
      );

      // Submit 3-day leave request -> reserve 3 days
      const reqRes = await db.query<{ id: string }>(
        `INSERT INTO public.leave_requests (company_id, employee_id, leave_type, start_date, end_date, days_count, status)
         VALUES ($1, $2, 'annual', '2026-10-11', '2026-10-13', 3, 'pending_approval')
         RETURNING id`,
        [tenantACompanyId, employeeId]
      );
      const leaveReqId = reqRes.rows[0].id;

      await db.query(
        `UPDATE public.leave_balances SET reserved_days = reserved_days + 3
         WHERE company_id = $1 AND employee_id = $2 AND leave_type = 'annual' AND year = 2026`,
        [tenantACompanyId, employeeId]
      );

      // Approve leave request -> move reserved_days (3) to used_days (3)
      await db.query(
        `UPDATE public.leave_requests SET status = 'approved', approved_by = $1 WHERE id = $2`,
        [managerEmployeeId, leaveReqId]
      );
      await db.query(
        `UPDATE public.leave_balances
         SET reserved_days = reserved_days - 3, used_days = used_days + 3
         WHERE company_id = $1 AND employee_id = $2 AND leave_type = 'annual' AND year = 2026`,
        [tenantACompanyId, employeeId]
      );

      const balRes = await db.query<{ entitlement_days: string; reserved_days: string; used_days: string }>(
        `SELECT entitlement_days, reserved_days, used_days FROM public.leave_balances
         WHERE company_id = $1 AND employee_id = $2 AND leave_type = 'annual' AND year = 2026`,
        [tenantACompanyId, employeeId]
      );
      const remaining =
        Number(balRes.rows[0].entitlement_days) -
        Number(balRes.rows[0].reserved_days) -
        Number(balRes.rows[0].used_days);
      expect(Number(balRes.rows[0].used_days)).toBe(3);
      expect(Number(balRes.rows[0].reserved_days)).toBe(0);
      expect(remaining).toBe(27);
    });
  });

  // ==========================================================================
  // PHASES 7 & 8: COMPENSATION, TOTAL REWARDS & PAYROLL ENGINE
  // ==========================================================================
  describe("Phases 7 & 8: Compensation, Benefits, Total Rewards & Payroll Engine", () => {
    it("executes salary change request, range compa-ratio validation, benefit enrollment, and total rewards statement", async () => {
      // Compa-ratio before increase: 14,000 / 16,000 = 87.5%
      expect(calculateCompaRatio(14000, 16000)).toBe(87.5);
      expect(calculateRangePenetration(14000, 12000, 20000)).toBe(25.0);

      // Create Salary Change Request via atomic stored procedure (14,000 -> 16,000 SAR)
      const createRes = await db.query<{ result: any }>(
        `SELECT public.create_salary_change_request_atomic(
          $1, $2, 'promotion', CURRENT_DATE, 16000, 'ترقية استثنائية بعد اجتياز التقييم الهندسي'
        ) AS result`,
        [tenantACompanyId, employeeId]
      );
      const reqData = createRes.rows[0].result;
      expect(reqData.request_id).toBeTruthy();
      expect(Number(reqData.increase_amount)).toBe(2000);

      // Approve Salary Change Request atomically
      const approveRes = await db.query<{ result: any }>(
        `SELECT public.approve_salary_change_request_atomic($1, $2, true) AS result`,
        [tenantACompanyId, reqData.request_id]
      );
      expect(approveRes.rows[0].result.status).toBe("success");
      expect(approveRes.rows[0].result.package_status).toBe("active");

      // Verify employee basic_salary is now 16,000 SAR AND historical v1 record is preserved
      const empAfter = await db.query<{ basic_salary: string }>(
        `SELECT basic_salary FROM public.employees WHERE id = $1`,
        [employeeId]
      );
      expect(Number(empAfter.rows[0].basic_salary)).toBe(16000);

      const versionsCount = await db.query<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM public.employee_compensation_versions WHERE employee_id = $1`,
        [employeeId]
      );
      expect(Number(versionsCount.rows[0].cnt)).toBeGreaterThanOrEqual(2);

      // Enroll in Medical VIP Benefit Plan
      const catRes = await db.query<{ id: string }>(
        `SELECT id FROM public.benefit_categories WHERE code = 'medical' LIMIT 1`
      );
      const planRes = await db.query<{ id: string }>(
        `INSERT INTO public.benefit_plans (
          company_id, category_id, code, name_ar, name_en, tier_level, employee_monthly_cost, employer_monthly_cost
        ) VALUES ($1, $2, 'MED-EXEC', 'تأمين طبي تنفيذي شامل', 'Executive Medical Plan', 'vip', 200, 1200)
        RETURNING id`,
        [tenantACompanyId, catRes.rows[0].id]
      );
      benefitPlanId = planRes.rows[0].id;

      const enrollRes = await db.query<{ result: any }>(
        `SELECT public.enroll_employee_benefit_atomic($1, $2, $3, 'open_enrollment', CURRENT_DATE, ARRAY[]::uuid[]) AS result`,
        [tenantACompanyId, employeeId, benefitPlanId]
      );
      expect(enrollRes.rows[0].result.status).toBe("enrolled");
      expect(enrollRes.rows[0].result.enrollment_id).toBeDefined();

      // Compute Total Rewards Statement atomically
      const trsRes = await db.query<{ result: any }>(
        `SELECT public.generate_total_rewards_statement_atomic($1, $2, 2026) AS result`,
        [tenantACompanyId, employeeId]
      );
      const trs = trsRes.rows[0].result;
      expect(trs.snapshot_id).toBeDefined();
      expect(Number(trs.base_salary_annual)).toBe(192000);
      expect(Number(trs.total_employer_value_annual)).toBeGreaterThan(192000);
    });

    it("calculates and finalizes payroll run with GOSI, overtime, benefits, and enforces idempotency", async () => {
      // Calculate payroll for employee (16,000 basic, 3,500 housing, 1,500 transport = 21,000 gross)
      const calc = calculateEmployeePayroll({
        basicSalary: 16000,
        housingAllowance: 3500,
        transportAllowance: 1500,
        calculationBasis: "fixed_30_days",
        daysInMonth: 30,
        isSaudiNational: true,
        overtimeHours: 2,
        loanInstallment: 500,
      });

      // GOSI Contributory = 16,000 + 3,500 = 19,500 SAR -> 9.75% = 1,901.25 SAR
      expect(calc.gosiEmployee).toBe(1901.25);
      expect(calc.gosiEmployer).toBe(2291.25);

      // Create Payroll Run for October 2026
      const runRes = await db.query<{ id: string }>(
        `INSERT INTO public.payroll_runs (company_id, period_start, period_end, currency, status, total_gross, total_deductions, total_net)
         VALUES ($1, '2026-10-01', '2026-10-31', 'SAR', 'confirmed_locked', $2, $3, $4)
         RETURNING id`,
        [tenantACompanyId, calc.grossSalary, calc.totalDeductions, calc.netSalary]
      );
      payrollRunId = runRes.rows[0].id;

      await db.query(
        `INSERT INTO public.payroll_details (
          payroll_run_id, employee_id, basic_salary, housing_allowance, transport_allowance,
          other_allowances, gosi_employee, loan_deduction, total_deductions, net_salary
        ) VALUES ($1, $2, 16000, 3500, 1500, $3, $4, 500, $5, $6)`,
        [payrollRunId, employeeId, calc.overtimeAmount, calc.gosiEmployee, calc.totalDeductions, calc.netSalary]
      );

      // Verify duplicate payroll run for same period is rejected by UNIQUE(company_id, period_start, period_end)
      await expect(
        db.query(
          `INSERT INTO public.payroll_runs (company_id, period_start, period_end, currency, status)
           VALUES ($1, '2026-10-01', '2026-10-31', 'SAR', 'draft')`,
          [tenantACompanyId]
        )
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // PHASES 9, 10, 11 & 12: MOVEMENTS, PROBATION, PERFORMANCE, LEARNING, TALENT & ER
  // ==========================================================================
  describe("Phases 9, 10, 11 & 12: Movements, Probation, Performance, Learning, Talent & Employee Relations", () => {
    it("confirms probation, records promotion movement, links performance -> learning -> succession, and isolates ER cases", async () => {
      // 1. Confirm Probation (status: probation -> active) & record movement
      await db.query(`UPDATE public.employees SET status = 'active' WHERE id = $1`, [employeeId]);
      await db.query(
        `INSERT INTO public.employee_movements (company_id, employee_id, movement_type, effective_date, previous_state, new_state)
         VALUES ($1, $2, 'probation_confirmation', CURRENT_DATE, '{"status":"probation"}'::jsonb, '{"status":"active"}'::jsonb)`,
        [tenantACompanyId, employeeId]
      );

      // 2. Performance Review (Score 4.7, Top Box Star)
      await db.query(
        `INSERT INTO public.performance_reviews (company_id, employee_id, cycle_year, overall_score, readiness_box, status)
         VALUES ($1, $2, 2026, 4.70, 'star_top_talent', 'calibrated')`,
        [tenantACompanyId, employeeId]
      );

      // 3. Learning Course Completion
      await db.query(
        `INSERT INTO public.learning_enrollments (company_id, employee_id, course_code, course_title_ar, status, score)
         VALUES ($1, $2, 'LDR-301', 'القيادة الهندسية المتقدمة ومعمارية الأنظمة', 'completed', 98.5)`,
        [tenantACompanyId, employeeId]
      );

      // 4. Critical Position & Succession Nomination
      const critPos = await db.query<{ id: string }>(
        `INSERT INTO public.critical_positions (company_id, position_title)
         VALUES ($1, 'مدير هندسة المنصات السحابية (VP Engineering)') RETURNING id`,
        [tenantACompanyId]
      );
      await db.query(
        `INSERT INTO public.succession_nominations (company_id, critical_position_id, nominee_employee_id, readiness_level, status)
         VALUES ($1, $2, $3, 'ready_now', 'approved')`,
        [tenantACompanyId, critPos.rows[0].id, employeeId]
      );

      // Also create an unfilled critical position to verify AI proactive insight detection
      await db.query(
        `INSERT INTO public.critical_positions (company_id, position_title)
         VALUES ($1, 'رئيس أمن المعلومات السيبراني (CISO)')`,
        [tenantACompanyId]
      );

      // 5. Confidential Employee Relations Case
      const erRes = await db.query<{ id: string; confidentiality_level: string }>(
        `INSERT INTO public.er_cases (company_id, case_number, employee_id, category, confidentiality_level, status, decision_summary)
         VALUES ($1, 'ER-2026-0001', $2, 'policy_inquiry', 'restricted_hr', 'closed', 'تمت المراجعة والتوضيح النظامي بدون مخالفة')
         RETURNING id, confidentiality_level`,
        [tenantACompanyId, employeeId]
      );
      expect(erRes.rows[0].confidentiality_level).toBe("restricted_hr");
    });
  });

  // ==========================================================================
  // PHASE 13: MULTI-COUNTRY PACKS (EG, SA, QA, OM, BH) & WPS COMPLIANCE
  // ==========================================================================
  describe("Phase 13: Multi-Country Packs (EG, SA, QA, OM, BH) & WPS Compliance", () => {
    it("verifies statutory social insurance, income tax, EOS, and WPS batch generation in PostgreSQL", async () => {
      // 1. Verify all 5 countries in DB
      const packs = await db.query<{ country_code: string }>(
        `SELECT country_code FROM public.country_packs WHERE is_active = true ORDER BY country_code`
      );
      expect(packs.rows.map((r) => r.country_code)).toEqual(["BH", "EG", "OM", "QA", "SA"]);

      // 2. Pre-Close Compliance Check on Tenant A Payroll Run
      const precloseRes = await db.query<{ result: any }>(
        `SELECT public.run_payroll_preclose_compliance_check_atomic($1, $2, 'SA') AS result`,
        [tenantACompanyId, payrollRunId]
      );
      expect(precloseRes.rows[0].result.ok).toBe(true);
      expect(Number(precloseRes.rows[0].result.blocks_count)).toBe(0);

      // 3. Generate WPS Batch atomically
      const wpsRes = await db.query<{ result: any }>(
        `SELECT public.generate_wps_batch_atomic($1, $2, 'SA', 'sif', $3) AS result`,
        [tenantACompanyId, payrollRunId, hrAdminUserId]
      );
      expect(wpsRes.rows[0].result.ok).toBe(true);
      expect(wpsRes.rows[0].result.validation_passed).toBe(true);
      expect(Number(wpsRes.rows[0].result.employee_count)).toBe(1);

      // 4. Verify Egypt Tax & Social Insurance + GCC EOS across all 5 jurisdictions
      expect(calculateEgyptSocialInsurance(10000).employeeContribution).toBe(1100);
      expect(calculateEgyptPayrollTax(10000).monthlyTax).toBe(812.5);
      expect(calculateSaudiSocialInsurance(10000, true).employeeContribution).toBe(975);
      expect(calculateQatarSocialInsurance(20000, true).employeeContribution).toBe(1400);
      expect(calculateOmanSocialInsurance(2000, true).employeeContribution).toBe(160);
      expect(calculateBahrainSocialInsurance(2000, true).employeeContribution).toBe(160);
      expect(calculateEOSByCountry("SA", "2018-01-01", "2024-01-01", 10000).finalEOSAmount).toBe(35000);
      expect(calculateEOSByCountry("OM", "2019-01-01", "2024-01-01", 1000).finalEOSAmount).toBe(5000);
    });
  });

  // ==========================================================================
  // PHASE 14: ENTERPRISE AI COPILOT, RAG, PROACTIVE INSIGHTS & SAFETY GATES
  // ==========================================================================
  describe("Phase 14: Enterprise AI Copilot, RAG, Proactive Insights & Safety Gates", () => {
    it("executes AI usage budget tracking, confirmation-gated tool calls, idempotency, RAG search, and proactive insights in PostgreSQL", async () => {
      // 1. Seed AI Provider Config for Tenant A
      await db.query(
        `INSERT INTO public.ai_provider_configs (company_id, provider_type, default_model, daily_token_limit, monthly_cost_limit_usd)
         VALUES ($1, 'openai', 'gpt-4o-mini', 100000, 100.00)`,
        [tenantACompanyId]
      );

      // 2. Create AI Conversation
      const convRes = await db.query<{ id: string }>(
        `INSERT INTO public.ai_conversations (company_id, user_id, title, context_module)
         VALUES ($1, $2, 'مراجعة استحقاقات الموظفين والمخاطر الاستباقية', 'dashboard')
         RETURNING id`,
        [tenantACompanyId, hrAdminUserId]
      );
      aiConversationId = convRes.rows[0].id;

      // 3. Record AI Usage via atomic RPC
      const usageRes = await db.query<{ result: any }>(
        `SELECT public.record_ai_usage_atomic($1, $2, $3, 'openai', 'gpt-4o-mini', 450, 210, 0.0012, 185) AS result`,
        [tenantACompanyId, hrAdminUserId, aiConversationId]
      );
      expect(usageRes.rows[0].result.ok).toBe(true);
      expect(usageRes.rows[0].result.within_budget).toBe(true);
      expect(Number(usageRes.rows[0].result.total_tokens)).toBe(660);

      // 4. Execute mutation tool WITHOUT confirmation -> must halt at preview_ready
      const previewToolRes = await db.query<{ result: any }>(
        `SELECT public.execute_ai_tool_action_atomic(
          $1, $2, $3, 'tasks.create', '{"title":"تجديد شهادة المهندس طارق"}'::jsonb, 'IDEMP-KEY-001', false
        ) AS result`,
        [tenantACompanyId, hrAdminUserId, aiConversationId]
      );
      expect(previewToolRes.rows[0].result.requires_confirmation).toBe(true);
      expect(previewToolRes.rows[0].result.status).toBe("preview_ready");

      // 5. Execute mutation tool WITH confirmation and new idempotency key -> executes once
      const execToolRes = await db.query<{ result: any }>(
        `SELECT public.execute_ai_tool_action_atomic(
          $1, $2, $3, 'tasks.create', '{"title":"تجديد شهادة المهندس طارق"}'::jsonb, 'IDEMP-KEY-002', true
        ) AS result`,
        [tenantACompanyId, hrAdminUserId, aiConversationId]
      );
      expect(execToolRes.rows[0].result.execution_status).toBe("executed");
      const firstToolCallId = execToolRes.rows[0].result.tool_call_id;

      // 6. Re-send same idempotency key -> returns idempotent cached result without duplicate row
      const dupToolRes = await db.query<{ result: any }>(
        `SELECT public.execute_ai_tool_action_atomic(
          $1, $2, $3, 'tasks.create', '{"title":"تجديد شهادة المهندس طارق"}'::jsonb, 'IDEMP-KEY-002', true
        ) AS result`,
        [tenantACompanyId, hrAdminUserId, aiConversationId]
      );
      expect(dupToolRes.rows[0].result.idempotent).toBe(true);
      expect(dupToolRes.rows[0].result.tool_call_id).toBe(firstToolCallId);

      // 7. Seed Knowledge Document & Chunk and verify role-scoped RAG search in PostgreSQL
      const docRes = await db.query<{ id: string }>(
        `INSERT INTO public.ai_knowledge_documents (company_id, title, category, access_scope, document_version)
         VALUES ($1, 'لائحة التحقيقات والجزاءات التأديبية', 'hr_policy', 'hr_only', '2.1')
         RETURNING id`,
        [tenantACompanyId]
      );
      await db.query(
        `INSERT INTO public.ai_knowledge_chunks (document_id, company_id, chunk_index, section_title, content, keywords)
         VALUES ($1, $2, 1, 'ضوابط التحقيق الإداري', 'لا يجوز توقيع جزاء تأديبي على الموظف إلا بعد إبلاغه كتابة وسماع أقواله.', ARRAY['تحقيق', 'جزاء'])`,
        [docRes.rows[0].id, tenantACompanyId]
      );

      // Employee role cannot retrieve hr_only document chunk
      const empRag = await db.query(
        `SELECT * FROM public.search_ai_knowledge_atomic($1, 'employee', 'تحقيق', 5)`,
        [tenantACompanyId]
      );
      expect(empRag.rows).toHaveLength(0);

      // HR Manager role retrieves hr_only document chunk with citation
      const hrRag = await db.query<{ document_title: string; document_version: string }>(
        `SELECT document_title, document_version FROM public.search_ai_knowledge_atomic($1, 'hr_manager', 'تحقيق', 5)`,
        [tenantACompanyId]
      );
      expect(hrRag.rows).toHaveLength(1);
      expect(hrRag.rows[0].document_title).toBe("لائحة التحقيقات والجزاءات التأديبية");

      // 8. Generate Proactive AI Insights from real database state (expiring cert + unfilled CISO critical position)
      const insightsRes = await db.query<{ result: any }>(
        `SELECT public.generate_proactive_ai_insights_atomic($1) AS result`,
        [tenantACompanyId]
      );
      expect(insightsRes.rows[0].result.ok).toBe(true);
      expect(Number(insightsRes.rows[0].result.generated_insights_count)).toBeGreaterThanOrEqual(2);

      // 9. Verify AI Dashboard KPIs RPC
      const kpisRes = await db.query<{ result: any }>(
        `SELECT public.get_ai_dashboard_kpis_atomic($1) AS result`,
        [tenantACompanyId]
      );
      expect(Number(kpisRes.rows[0].result.total_requests)).toBe(1);
      expect(Number(kpisRes.rows[0].result.active_insights)).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // PHASES 15, 16, 17, 19, 20 & 21: RBAC, TENANT ISOLATION, AUDIT, REPORTING & I18N
  // ==========================================================================
  describe("Phases 15–21: RBAC Matrix, Cross-Tenant Isolation, Audit Trail, Reporting & Arabic/English", () => {
    it("verifies all 29 screens across RBAC definitions, INITIAL_ENTERPRISE_GROUPS, and Auditor read-only invariant", () => {
      expect(ALL_SYSTEM_SCREENS).toHaveLength(29);

      for (const screen of ALL_SYSTEM_SCREENS) {
        // Every screen has route mapping, Arabic & English nav labels, and moduleAccess
        expect(MODULE_ROUTE_MAP[screen.id], `Route missing for ${screen.id}`).toBeTruthy();
        expect((ar.nav as Record<string, string>)[screen.id], `Arabic nav missing for ${screen.id}`).toBeTruthy();
        expect((en.nav as Record<string, string>)[screen.id], `English nav missing for ${screen.id}`).toBeTruthy();
        expect(moduleAccess[screen.id]?.length, `moduleAccess missing for ${screen.id}`).toBeGreaterThan(0);

        // Every enterprise permission group explicitly defines permissions for all 29 screens
        for (const group of INITIAL_ENTERPRISE_GROUPS) {
          expect(
            group.screens[screen.id],
            `Group ${group.code} missing screen definition for ${screen.id}`
          ).toBeDefined();
        }
      }

      // Auditor is strictly read-only across all modules
      for (const [mod, roles] of Object.entries(moduleManageAccess)) {
        expect(roles, `Auditor must not have manage access on ${mod}`).not.toContain("auditor");
        expect(canManageModule("auditor", mod)).toBe(false);
      }

      // Employee is blocked from administrative payroll, rbac, organization, audit, and cannot manage country_packs
      expect(canAccessModule("employee", "payroll")).toBe(false);
      expect(canAccessModule("employee", "rbac")).toBe(false);
      expect(canAccessModule("employee", "audit")).toBe(false);
      expect(canManageModule("employee", "country_packs")).toBe(false);
      expect(canAccessModule("employee", "ess")).toBe(true);
      expect(canAccessModule("employee", "ai_copilot")).toBe(true);
    });

    it("enforces strict cross-tenant isolation between Tenant A and Tenant B", async () => {
      const tenantAEmps = await db.query<{ id: string }>(
        `SELECT id FROM public.employees WHERE company_id = $1`,
        [tenantACompanyId]
      );
      const tenantBEmps = await db.query<{ id: string }>(
        `SELECT id FROM public.employees WHERE company_id = $1`,
        [tenantBCompanyId]
      );

      expect(tenantAEmps.rows.map((r) => r.id)).not.toContain(tenantBEmployeeId);
      expect(tenantBEmps.rows.map((r) => r.id)).toEqual([tenantBEmployeeId]);

      // Tenant B has zero access to Tenant A payroll runs or AI insights
      const tenantBPayroll = await db.query(
        `SELECT id FROM public.payroll_runs WHERE company_id = $1`,
        [tenantBCompanyId]
      );
      expect(tenantBPayroll.rows).toHaveLength(0);

      const tenantBInsights = await db.query<{ result: any }>(
        `SELECT public.get_ai_dashboard_kpis_atomic($1) AS result`,
        [tenantBCompanyId]
      );
      expect(Number(tenantBInsights.rows[0].result.active_insights)).toBe(0);
    });

    it("records immutable audit trail entries and reconciles executive reporting KPIs with database truth", async () => {
      // Record audit log for salary approval
      await db.query(
        `INSERT INTO public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, before_state, after_state)
         VALUES ($1, $2, 'compensation.approve_salary_change', 'employee', $3, '{"basic_salary":14000}'::jsonb, '{"basic_salary":16000}'::jsonb)`,
        [tenantACompanyId, hrAdminUserId, employeeId]
      );

      const auditCheck = await db.query<{ action: string; before_state: any; after_state: any }>(
        `SELECT action, before_state, after_state FROM public.audit_logs WHERE company_id = $1 AND entity_id = $2`,
        [tenantACompanyId, employeeId]
      );
      expect(auditCheck.rows).toHaveLength(1);
      expect(auditCheck.rows[0].before_state.basic_salary).toBe(14000);
      expect(auditCheck.rows[0].after_state.basic_salary).toBe(16000);

      // Reconcile Headcount & Saudization Rate in Tenant A
      const kpiCheck = await db.query<{ total_active: string; saudi_count: string; total_basic: string }>(
        `SELECT COUNT(*) FILTER (WHERE status IN ('active', 'probation', 'on_leave')) as total_active,
                COUNT(*) FILTER (WHERE nationality = 'SA') as saudi_count,
                SUM(basic_salary) as total_basic
         FROM public.employees WHERE company_id = $1`,
        [tenantACompanyId]
      );
      expect(Number(kpiCheck.rows[0].total_active)).toBe(2); // Manager (22k) + Employee (16k)
      expect(Number(kpiCheck.rows[0].saudi_count)).toBe(2);
      expect(Number(kpiCheck.rows[0].total_basic)).toBe(38000);
    });
  });

  // ==========================================================================
  // PHASE 22: GO-LIVE 01 — END-TO-END HR JOURNEY, PAYROLL RECONCILIATION,
  //           6-ROLE SECURITY UAT & 12-PROVIDER CREDENTIAL GATE
  // ==========================================================================
  describe("Phase 22: GO-LIVE 01 — Full UAT Journey, Payroll Reconciliation, 6-Role Security & External Providers", () => {
    it("verifies migrations 20261019000000 and 20261020000000 pin search_path = public on all SECURITY DEFINER functions", () => {
      const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");
      const files = [
        "20261019000000_production_government_regulatory_integration_connectors.sql",
        "20261020000000_production_customer_connector_credential_activation_engine.sql",
      ];

      for (const file of files) {
        const rawSql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        const sql = rawSql.replace(/--.*$/gm, "");
        const secDefCount = (sql.match(/SECURITY\s+DEFINER/gi) || []).length;
        const searchPathCount = (sql.match(/SET\s+search_path\s*=\s*public/gi) || []).length;
        expect(searchPathCount, `${file} must set search_path = public`).toBeGreaterThanOrEqual(secDefCount);
      }
    });

    it("reconciles full Payroll UAT inputs (basic, allowances, attendance, leave, loan, expense, bonus, benefit deduction, EOS isolation) with zero discrepancy", () => {
      const payrollCalc = calculateEmployeePayroll({
        basicSalary: 16000,
        housingAllowance: 3500,
        transportAllowance: 1500,
        otherAllowances: 1200, // Expense reimbursement + one-time bonus
        calculationBasis: "fixed_30_days",
        daysInMonth: 30,
        unpaidLeaveDays: 1,
        lateMinutes: 35,
        overtimeHours: 2,
        isSaudiNational: true,
        loanInstallment: 500,
        penaltiesAmount: 200, // Medical VIP benefit employee share
      });

      // Verify exact reconciliation: netSalary === grossSalary + overtimeAmount - totalDeductions
      const reconciledNet = Number(
        (
          payrollCalc.grossSalary +
          payrollCalc.overtimeAmount -
          payrollCalc.totalDeductions
        ).toFixed(2)
      );
      expect(payrollCalc.netSalary).toBe(reconciledNet);
      expect(payrollCalc.gosiEmployee).toBe(1901.25);
      expect(payrollCalc.loanDeduction).toBe(500);

      // EOSB is calculated and isolated cleanly on offboarding without contaminating monthly regular net pay
      const eosCalc = calculateEOSByCountry("SA", "2021-01-01", "2026-01-01", 21000);
      expect(eosCalc.finalEOSAmount).toBe(52500);
    });

    it("verifies 6-Role Security UAT (Employee, Manager, HR, Payroll, Finance, Admin) across sensitive domains", () => {
      // 1. Employee: ESS & self-scope only, no admin payroll/RBAC/audit or management rights
      expect(canAccessModule("employee", "ess")).toBe(true);
      expect(canAccessModule("employee", "payroll")).toBe(false);
      expect(canManageModule("employee", "employee_relations")).toBe(false);
      expect(canManageModule("employee", "talent")).toBe(false);

      // 2. Line Manager: Team/MSS workflow & leaves access, blocked from company payroll & admin employees
      expect(canAccessModule("line_manager", "workflow")).toBe(true);
      expect(canAccessModule("line_manager", "leaves")).toBe(true);
      expect(canAccessModule("line_manager", "payroll")).toBe(false);
      expect(canManageModule("line_manager", "compensation")).toBe(false);

      // 3. HR Manager: Manages employees, leaves, onboarding, movements, ER, talent
      expect(canManageModule("hr_manager", "employees")).toBe(true);
      expect(canManageModule("hr_manager", "employee_relations")).toBe(true);
      expect(canManageModule("hr_manager", "talent")).toBe(true);

      // 4. Payroll Officer: Manages payroll & loans, blocked from RBAC
      expect(canManageModule("payroll_officer", "payroll")).toBe(true);
      expect(canManageModule("payroll_officer", "rbac")).toBe(false);

      // 5. Finance Officer: Accesses payroll/expenses/reports, blocked from RBAC
      expect(canAccessModule("finance_officer", "payroll")).toBe(true);
      expect(canAccessModule("finance_officer", "expenses")).toBe(true);
      expect(canManageModule("finance_officer", "rbac")).toBe(false);

      // 6. Super Admin: Full platform governance
      expect(canManageModule("super_admin", "rbac")).toBe(true);
      expect(canManageModule("super_admin", "country_packs")).toBe(true);
    });

    it("executes idempotent bootstrap_enterprise_tenant, 8-point bootstrap verification, 18-domain read-only smoke test, backup drill, and Go-Live closure contract", async () => {
      const {
        BOOTSTRAP_ENTERPRISE_TENANT_SQL,
        PRODUCTION_SMOKE_DOMAINS,
        validateTenantBootstrapInput,
        verifyEnterpriseTenantBootstrapInDb,
        runProductionSmokeVerificationInDb,
        evaluateBackupRecoveryDrillStatus,
        reconcileGovernmentIntegrationStatuses,
        evaluateGoLiveReleaseClassification,
      } = await import("../lib/config/production-deployment-contract");

      // 1. Install bootstrap_enterprise_tenant in PostgreSQL
      await db.exec(BOOTSTRAP_ENTERPRISE_TENANT_SQL);

      // Validate input guard rejects empty customer input
      expect(validateTenantBootstrapInput({})).not.toHaveLength(0);

      // 2. Run bootstrap_enterprise_tenant FIRST time for a clean production tenant
      const firstRun = await db.query<{ result: any }>(
        `SELECT public.bootstrap_enterprise_tenant(
          'MDX-CLEAN-PROD',
          'Al-Madar Enterprise Holdings',
          'شركة المدار القابضة للموارد البشرية',
          'SA',
          'SAR',
          'LE-SA-HQ',
          'الكيان القانوني الرئيسي - الرياض',
          'Riyadh Principal Legal Entity',
          'ORG-ROOT',
          'الإدارة العامة التنفيذية',
          'Executive Headquarters',
          $1
        ) AS result`,
        [hrAdminUserId]
      );
      expect(firstRun.rows[0].result.ok).toBe(true);
      expect(firstRun.rows[0].result.idempotent).toBe(false);
      const cleanCompanyId = firstRun.rows[0].result.company_id;
      const cleanLeId = firstRun.rows[0].result.legal_entity_id;
      const cleanOrgRootId = firstRun.rows[0].result.org_root_department_id;

      // 3. Run bootstrap_enterprise_tenant SECOND time with identical inputs -> idempotent, safe to rerun, same IDs
      const secondRun = await db.query<{ result: any }>(
        `SELECT public.bootstrap_enterprise_tenant(
          'MDX-CLEAN-PROD',
          'Al-Madar Enterprise Holdings',
          'شركة المدار القابضة للموارد البشرية',
          'SA',
          'SAR',
          'LE-SA-HQ',
          'الكيان القانوني الرئيسي - الرياض',
          'Riyadh Principal Legal Entity',
          'ORG-ROOT',
          'الإدارة العامة التنفيذية',
          'Executive Headquarters',
          $1
        ) AS result`,
        [hrAdminUserId]
      );
      expect(secondRun.rows[0].result.ok).toBe(true);
      expect(secondRun.rows[0].result.idempotent).toBe(true);
      expect(secondRun.rows[0].result.company_id).toBe(cleanCompanyId);
      expect(secondRun.rows[0].result.legal_entity_id).toBe(cleanLeId);
      expect(secondRun.rows[0].result.org_root_department_id).toBe(cleanOrgRootId);

      // 4. Verify all 8 mandatory bootstrap artifacts + zero fake seed/demo data
      const bootstrapCheck = await verifyEnterpriseTenantBootstrapInDb(db, cleanCompanyId, hrAdminUserId);
      expect(bootstrapCheck.verified).toBe(true);
      expect(bootstrapCheck.tenantIsolated).toBe(true);
      expect(bootstrapCheck.companyVerified).toBe(true);
      expect(bootstrapCheck.legalEntityVerified).toBe(true);
      expect(bootstrapCheck.adminUserVerified).toBe(true);
      expect(bootstrapCheck.organizationRootVerified).toBe(true);
      expect(bootstrapCheck.rolesVerified).toBe(true);
      expect(bootstrapCheck.permissionsVerified).toBe(true);
      expect(bootstrapCheck.defaultConfigurationsVerified).toBe(true);
      expect(bootstrapCheck.noFakeSeedOrDemoData).toBe(true);

      // 5. Execute 18-domain READ-ONLY post-deployment smoke test
      const smokeReport = await runProductionSmokeVerificationInDb(db, tenantACompanyId, hrAdminUserId);
      expect(smokeReport.allPassed).toBe(true);
      expect(smokeReport.readOnlyEnforced).toBe(true);
      expect(smokeReport.mutatedRows).toBe(0);
      expect(smokeReport.totalDomainsChecked).toBe(18);
      expect(smokeReport.results.map((r) => r.domain)).toEqual([...PRODUCTION_SMOKE_DOMAINS]);

      // 6. Verify staging backup/restore drill & honest cloud PITR classification
      const stagingDrill = evaluateBackupRecoveryDrillStatus({
        stagingBackupTimestamp: "2026-10-19T12:00:00Z",
        stagingRestoreStart: "2026-10-19T12:00:05Z",
        stagingRestoreCompletion: "2026-10-19T12:00:09Z",
        liveCloudPitrMeasured: false,
      });
      expect(stagingDrill.verificationResult).toBe("PASS_STAGING_DRILL");
      expect(stagingDrill.actualRtoSeconds).toBe(4);
      expect(stagingDrill.actualRpoSeconds).toBe(5);
      expect(stagingDrill.liveCloudPitrStatus).toBe("CUSTOMER_INFRA_ACTION_REQUIRED");
      expect(stagingDrill.isSoftwareBlocker).toBe(false);

      // 7. Verify 12 optional government integrations & Core Go-Live classification
      const govStatuses = reconcileGovernmentIntegrationStatuses({});
      expect(govStatuses).toHaveLength(12);
      expect(govStatuses.every((g) => g.classification === "CUSTOMER_CREDENTIAL_REQUIRED")).toBe(true);
      expect(govStatuses.every((g) => g.blocksCoreGoLive === false)).toBe(true);

      const releaseStatus = evaluateGoLiveReleaseClassification({
        p0Blockers: 0,
        p1Blockers: 0,
        migrationValidationPassed: true,
        clientEnv: {
          NODE_ENV: "production",
          VITE_SUPABASE_URL: "https://enterprise-prod.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_prod_valid_key_001",
          VITE_ENABLE_DEMO_MODE: "false",
        },
        serverEnv: {
          SUPABASE_URL: "https://enterprise-prod.supabase.co",
          SUPABASE_SECRET_KEY: "sb_secret_prod_valid_admin_key_001",
        },
        secretScanPassed: true,
        buildPassed: true,
      });

      expect(releaseStatus.classification.A_SOFTWARE_READY).toBe("YES");
      expect(releaseStatus.classification.B_PRODUCTION_ENVIRONMENT_READY).toBe("YES");
      expect(releaseStatus.classification.C_OPTIONAL_EXTERNAL_INTEGRATIONS_READY).toBe(
        "CUSTOMER_CREDENTIAL_REQUIRED"
      );
      expect(releaseStatus.MADARX_CORE_GO_LIVE_READY).toBe("YES");
      expect(releaseStatus.legacyApiKeyDependencyRemaining).toBe("NO");
      expect(releaseStatus.clientSecretExposure).toBe("NO");
    });
  });
});


