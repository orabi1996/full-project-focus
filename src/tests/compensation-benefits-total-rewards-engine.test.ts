// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 33: PRODUCTION COMPENSATION & BENEFITS, SALARY STRUCTURES,
//            ALLOWANCES, TOTAL REWARDS & BENEFITS ENGINE TEST SUITE
// src/tests/compensation-benefits-total-rewards-engine.test.ts
// ============================================================================

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  calculateCompaRatio,
  calculateRangePenetration,
  evaluateSalaryRangePosition,
  calculateMeritIncrease,
  calculateAnnualTotalRewards,
} from "../lib/domains/compensation";

describe("Prompt 33: Production Compensation, Benefits & Total Rewards Engine", () => {
  // ==========================================================================
  // SECTION 1: PURE DOMAIN RULES & CALCULATIONS
  // ==========================================================================
  describe("1. Pure Domain Logic & Financial Calculators", () => {
    it("calculates compa-ratio accurately and safely handles zero/null midpoint", () => {
      // 8,000 basic / 10,000 midpoint = 80.00%
      expect(calculateCompaRatio(8000, 10000)).toBe(80.00);

      // 12,500 basic / 10,000 midpoint = 125.00%
      expect(calculateCompaRatio(12500, 10000)).toBe(125.00);

      // Zero or negative midpoint -> returns null
      expect(calculateCompaRatio(5000, 0)).toBeNull();
      expect(calculateCompaRatio(5000, -1000)).toBeNull();

      // Negative salary -> returns null
      expect(calculateCompaRatio(-5000, 10000)).toBeNull();
    });

    it("calculates salary range penetration percentage correctly", () => {
      // Min: 6000, Max: 10000. Salary: 8000 -> Penetration: (8000-6000)/(10000-6000) = 50.00%
      expect(calculateRangePenetration(8000, 6000, 10000)).toBe(50.00);

      // Salary at min -> 0%
      expect(calculateRangePenetration(6000, 6000, 10000)).toBe(0.00);

      // Salary at max -> 100%
      expect(calculateRangePenetration(10000, 6000, 10000)).toBe(100.00);

      // Invalid range (max <= min) -> returns null
      expect(calculateRangePenetration(7000, 8000, 6000)).toBeNull();
    });

    it("evaluates salary range position (below, within, above)", () => {
      const min = 5000;
      const max = 10000;

      expect(evaluateSalaryRangePosition(4500, min, max)).toBe("below_minimum");
      expect(evaluateSalaryRangePosition(5000, min, max)).toBe("within_range");
      expect(evaluateSalaryRangePosition(7500, min, max)).toBe("within_range");
      expect(evaluateSalaryRangePosition(10000, min, max)).toBe("within_range");
      expect(evaluateSalaryRangePosition(11000, min, max)).toBe("above_maximum");
    });

    it("calculates merit increase based on performance and compa-ratio matrix", () => {
      // High Performer (rating 4.8), low compa-ratio (85%) -> High increase (8.5%)
      const res1 = calculateMeritIncrease(10000, 4.8, 85);
      expect(res1.percentage).toBe(8.5);
      expect(res1.amount).toBe(850);

      // High Performer (rating 4.8), high compa-ratio (115%) -> Moderate increase (4.5%)
      const res2 = calculateMeritIncrease(10000, 4.8, 115);
      expect(res2.percentage).toBe(4.5);
      expect(res2.amount).toBe(450);

      // Meets expectations (rating 3.0), balanced compa (100%) -> Standard increase (3.0%)
      const res3 = calculateMeritIncrease(10000, 3.0, 100);
      expect(res3.percentage).toBe(3.0);
      expect(res3.amount).toBe(300);

      // Below expectations (rating 2.0) -> Zero increase
      const res4 = calculateMeritIncrease(10000, 2.0, 95);
      expect(res4.percentage).toBe(0);
      expect(res4.amount).toBe(0);
    });

    it("computes comprehensive annual total employer value breakdown", () => {
      const total = calculateAnnualTotalRewards(
        10000, // base monthly
        3000,  // allowances monthly (housing + transport)
        20000, // annual variable bonus
        1000,  // employer benefits monthly (medical insurance)
        10     // GOSI rate (10%)
      );

      expect(total.baseAnnual).toBe(120000);
      expect(total.allowancesAnnual).toBe(36000);
      expect(total.variableAnnual).toBe(20000);
      expect(total.benefitsAnnual).toBe(12000);
      // Statutory: 10% of (120000 + 36000) = 15600
      expect(total.statutoryAnnual).toBe(15600);
      // Total: 120000 + 36000 + 20000 + 12000 + 15600 = 203600
      expect(total.totalEmployerValue).toBe(203600);
    });
  });

  // ==========================================================================
  // SECTION 2 & 3: PGLITE DATABASE MIGRATION & ATOMIC RPCS
  // ==========================================================================
  describe("2 & 3. Database Migration & Atomic Stored Procedures (PGlite)", () => {
    let db: PGlite;
    let companyId: string;
    let employeeId: string;
    let gradeId: string;
    let planId: string;

    beforeAll(async () => {
      db = new PGlite();

      // 1. Setup baseline roles and schemas
      await db.exec(`
        CREATE ROLE authenticated;
        CREATE ROLE service_role;
        CREATE SCHEMA IF NOT EXISTS auth;

        CREATE TABLE IF NOT EXISTS auth.users (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email text
        );

        INSERT INTO auth.users (id, email)
        VALUES ('00000000-0000-0000-0000-000000000001', 'system.admin@madarx.io')
        ON CONFLICT (id) DO NOTHING;

        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
        BEGIN
          RETURN '00000000-0000-0000-0000-000000000001'::uuid;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TABLE IF NOT EXISTS public.companies (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text
        );

        CREATE TABLE IF NOT EXISTS public.departments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          name_ar text,
          name_en text
        );

        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          auth_user_id uuid,
          employee_number text,
          first_name_ar text,
          last_name_ar text,
          status text NOT NULL DEFAULT 'active',
          department_id uuid REFERENCES public.departments(id),
          manager_id uuid,
          basic_salary numeric NOT NULL DEFAULT 8000,
          housing_allowance numeric NOT NULL DEFAULT 2000,
          transport_allowance numeric NOT NULL DEFAULT 1000,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
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
          basic_salary numeric DEFAULT 8000,
          housing_allowance numeric DEFAULT 2000,
          transport_allowance numeric DEFAULT 1000,
          reason text,
          status text DEFAULT 'approved',
          approved_by uuid,
          approved_at timestamptz
        );

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
      `);

      // 2. Read and apply Prompt 33 Migration SQL
      const migrationSql = readFileSync(
        "supabase/migrations/20261015000000_production_compensation_benefits_total_rewards_engine.sql",
        "utf-8"
      );
      await db.exec(migrationSql);

      // 3. Seed test data
      const compRes = await db.query<{ id: string }>(
        "INSERT INTO public.companies (name) VALUES ('MadarX Holdings') RETURNING id"
      );
      companyId = compRes.rows[0].id;

      const userRes = await db.query<{ id: string }>(
        "INSERT INTO auth.users (email) VALUES ('hr.admin@madarx.io') RETURNING id"
      );
      const userId = userRes.rows[0].id;

      const empRes = await db.query<{ id: string }>(
        `INSERT INTO public.employees (company_id, auth_user_id, employee_number, first_name_ar, last_name_ar, basic_salary)
         VALUES ($1, $2, 'EMP-1001', 'عبدالله', 'الغامدي', 10000) RETURNING id`,
        [companyId, userId]
      );
      employeeId = empRes.rows[0].id;

      // Seed a Pay Grade & Range
      const gradeRes = await db.query<{ id: string }>(
        `INSERT INTO public.salary_pay_grades (company_id, code, name_ar, name_en, grade_level)
         VALUES ($1, 'G-05', 'الدرجة الخامسة - مهني أول', 'Grade 5 - Senior', 5) RETURNING id`,
        [companyId]
      );
      gradeId = gradeRes.rows[0].id;

      await db.query(
        `INSERT INTO public.salary_ranges (company_id, pay_grade_id, minimum_salary, midpoint_salary, maximum_salary)
         VALUES ($1, $2, 8000, 11000, 14000)`,
        [companyId, gradeId]
      );

      // Seed a Benefit Plan
      const catRes = await db.query<{ id: string }>(
        "SELECT id FROM public.benefit_categories WHERE code = 'medical' LIMIT 1"
      );
      const catId = catRes.rows[0].id;

      const planRes = await db.query<{ id: string }>(
        `INSERT INTO public.benefit_plans (company_id, category_id, code, name_ar, name_en, tier_level, employee_monthly_cost, employer_monthly_cost)
         VALUES ($1, $2, 'MED-VIP', 'التأمين الطبي الفئة الماسية', 'Medical VIP Diamond', 'vip', 150, 850) RETURNING id`,
        [companyId, catId]
      );
      planId = planRes.rows[0].id;
    });

    afterAll(async () => {
      await db.close();
    });

    it("generates stable monotonic business sequence numbers", async () => {
      const res1 = await db.query<{ generate_comp_reference_number: string }>(
        "SELECT public.generate_comp_reference_number($1, 'SALARY_CHANGE') AS generate_comp_reference_number",
        [companyId]
      );
      const ref1 = res1.rows[0].generate_comp_reference_number;
      expect(ref1).toMatch(/^SCR-\d{4}-000001$/);

      const res2 = await db.query<{ generate_comp_reference_number: string }>(
        "SELECT public.generate_comp_reference_number($1, 'SALARY_CHANGE') AS generate_comp_reference_number",
        [companyId]
      );
      const ref2 = res2.rows[0].generate_comp_reference_number;
      expect(ref2).toMatch(/^SCR-\d{4}-000002$/);

      const resReview = await db.query<{ generate_comp_reference_number: string }>(
        "SELECT public.generate_comp_reference_number($1, 'REVIEW_CYCLE') AS generate_comp_reference_number",
        [companyId]
      );
      expect(resReview.rows[0].generate_comp_reference_number).toMatch(/^CRC-\d{4}-000001$/);
    });

    it("creates salary change request atomically and validates against salary range", async () => {
      const res = await db.query<{ create_salary_change_request_atomic: any }>(
        `SELECT public.create_salary_change_request_atomic(
          $1, $2, 'merit', CURRENT_DATE, 12000, 'استحقاق لتميز الأداء السنوي'
        ) AS create_salary_change_request_atomic`,
        [companyId, employeeId]
      );

      const data = res.rows[0].create_salary_change_request_atomic;
      expect(data.request_id).toBeDefined();
      expect(data.increase_amount).toBe(2000);
      expect(data.increase_percentage).toBe(20.0);
      expect(data.request_number).toMatch(/^SCR-\d{4}-\d{6}$/);
    });

    it("approves and applies salary change request atomically, creating versioned package", async () => {
      // First get latest request
      const reqRes = await db.query<{ id: string }>(
        "SELECT id FROM public.compensation_change_requests WHERE employee_id = $1 LIMIT 1",
        [employeeId]
      );
      const requestId = reqRes.rows[0].id;

      const appRes = await db.query<{ approve_salary_change_request_atomic: any }>(
        `SELECT public.approve_salary_change_request_atomic($1, $2, true) AS approve_salary_change_request_atomic`,
        [companyId, requestId]
      );

      const appData = appRes.rows[0].approve_salary_change_request_atomic;
      expect(appData.status).toBe("success");
      expect(appData.package_status).toBe("active");
      expect(appData.package_id).toBeDefined();

      // Verify employee basic_salary was updated in employees master
      const empCheck = await db.query<{ basic_salary: number }>(
        "SELECT basic_salary FROM public.employees WHERE id = $1",
        [employeeId]
      );
      expect(Number(empCheck.rows[0].basic_salary)).toBe(12000);
    });

    it("launches annual review cycle and freezes eligible population snapshot", async () => {
      const cycleRes = await db.query<{ id: string }>(
        `INSERT INTO public.compensation_review_cycles (
          company_id, cycle_code, name_ar, name_en, year_val, allocated_budget, effective_date, review_start_date, review_end_date
        ) VALUES ($1, 'CRC-2026-TEST', 'دورة مراجعة 2026', 'Review 2026', 2026, 100000, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + interval '30 days')
        RETURNING id`,
        [companyId]
      );
      const cycleId = cycleRes.rows[0].id;

      const launchRes = await db.query<{ launch_compensation_review_cycle_atomic: any }>(
        "SELECT public.launch_compensation_review_cycle_atomic($1, $2) AS launch_compensation_review_cycle_atomic",
        [companyId, cycleId]
      );

      const launchData = launchRes.rows[0].launch_compensation_review_cycle_atomic;
      expect(launchData.status).toBe("open");
      expect(launchData.eligible_count).toBeGreaterThanOrEqual(1);

      // Verify population snapshot
      const popCheck = await db.query(
        "SELECT * FROM public.compensation_review_populations WHERE cycle_id = $1",
        [cycleId]
      );
      expect(popCheck.rows.length).toBeGreaterThanOrEqual(1);
    });

    it("enrolls employee into benefit plan atomically", async () => {
      const res = await db.query<{ enroll_employee_benefit_atomic: any }>(
        `SELECT public.enroll_employee_benefit_atomic(
          $1, $2, $3, 'open_enrollment', CURRENT_DATE, ARRAY[]::uuid[]
        ) AS enroll_employee_benefit_atomic`,
        [companyId, employeeId, planId]
      );

      const data = res.rows[0].enroll_employee_benefit_atomic;
      expect(data.status).toBe("enrolled");
      expect(data.enrollment_id).toBeDefined();
    });

    it("generates total rewards statement snapshot atomically", async () => {
      const res = await db.query<{ generate_total_rewards_statement_atomic: any }>(
        "SELECT public.generate_total_rewards_statement_atomic($1, $2, 2026) AS generate_total_rewards_statement_atomic",
        [companyId, employeeId]
      );

      const data = res.rows[0].generate_total_rewards_statement_atomic;
      expect(data.snapshot_id).toBeDefined();
      expect(Number(data.base_salary_annual)).toBe(144000); // 12,000 * 12
      expect(Number(data.total_employer_value_annual)).toBeGreaterThan(144000);
    });

    it("calibrates and finalizes annual review cycle recommendations atomically", async () => {
      // 1. Create a cycle and launch it
      const cycleRes = await db.query<{ id: string }>(
        `INSERT INTO public.compensation_review_cycles (
          company_id, cycle_code, name_ar, name_en, year_val, allocated_budget, effective_date, review_start_date, review_end_date
        ) VALUES ($1, 'CRC-2026-CALIB', 'دورة معايرة 2026', 'Calibration Cycle 2026', 2026, 50000, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + interval '30 days')
        RETURNING id`,
        [companyId]
      );
      const cycleId = cycleRes.rows[0].id;
      await db.query("SELECT public.launch_compensation_review_cycle_atomic($1, $2)", [companyId, cycleId]);

      // 2. Fetch the population row
      const popRes = await db.query<{ id: string }>(
        "SELECT id FROM public.compensation_review_populations WHERE cycle_id = $1 AND employee_id = $2 LIMIT 1",
        [cycleId, employeeId]
      );
      const popId = popRes.rows[0].id;

      // 3. Insert recommendation
      const recRes = await db.query<{ id: string }>(
        `INSERT INTO public.compensation_review_recommendations (
          cycle_id, population_id, employee_id, original_increase_percentage, original_increase_amount, final_basic_salary, status
        ) VALUES ($1, $2, $3, 5.0, 600, 12600, 'submitted') RETURNING id`,
        [cycleId, popId, employeeId]
      );
      const recId = recRes.rows[0].id;

      // 4. Calibrate recommendation to 7.5%
      const calRes = await db.query<{ calibrate_review_recommendation_atomic: any }>(
        `SELECT public.calibrate_review_recommendation_atomic($1, 7.5, 'معايرة لتميز الأداء الاستثنائي') AS calibrate_review_recommendation_atomic`,
        [recId]
      );
      const calData = calRes.rows[0].calibrate_review_recommendation_atomic;
      expect(Number(calData.calibrated_percentage)).toBe(7.5);
      expect(Number(calData.final_basic_salary)).toBe(12900); // 12000 + 7.5% = 12900

      // 5. Finalize and apply review cycle
      const finRes = await db.query<{ finalize_and_apply_compensation_review_atomic: any }>(
        "SELECT public.finalize_and_apply_compensation_review_atomic($1, $2) AS finalize_and_apply_compensation_review_atomic",
        [companyId, cycleId]
      );
      const finData = finRes.rows[0].finalize_and_apply_compensation_review_atomic;
      expect(finData.status).toBe("applied");
      expect(finData.applied_employees_count).toBe(1);

      // Verify that employee basic salary was updated to 12,900
      const empCheck = await db.query<{ basic_salary: number }>(
        "SELECT basic_salary FROM public.employees WHERE id = $1",
        [employeeId]
      );
      expect(Number(empCheck.rows[0].basic_salary)).toBe(12900);
    });

    it("calculates live dashboard KPIs accurately", async () => {
      const res = await db.query<{ get_compensation_dashboard_kpis_atomic: any }>(
        "SELECT public.get_compensation_dashboard_kpis_atomic($1) AS get_compensation_dashboard_kpis_atomic",
        [companyId]
      );

      const kpis = res.rows[0].get_compensation_dashboard_kpis_atomic;
      expect(kpis.total_active_employees).toBeGreaterThanOrEqual(1);
      expect(Number(kpis.total_base_payroll)).toBe(12900);
      expect(kpis.active_benefit_enrollments).toBeGreaterThanOrEqual(1);
      expect(kpis.active_benefit_plans).toBeGreaterThanOrEqual(1);
    });
  });
});
