import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 19: Production Workforce Planning, Headcount & Manpower Budget Engine", () => {
  // ==========================================================================
  // PART 1: STATIC AST & SOURCE CODE CONTRACT TESTS
  // ==========================================================================
  describe("Static Source Code Contract Tests", () => {
    const workforceViewPath = path.resolve(__dirname, "../components/workforce/WorkforcePlanningView.tsx");
    const workforceViewSource = fs.readFileSync(workforceViewPath, "utf-8");

    const workforceRepoPath = path.resolve(__dirname, "../lib/data/workforce-planning-repository.ts");
    const workforceRepoSource = fs.readFileSync(workforceRepoPath, "utf-8");

    const workforceDomainPath = path.resolve(__dirname, "../lib/domains/workforce-planning/index.ts");
    const workforceDomainSource = fs.readFileSync(workforceDomainPath, "utf-8");

    const queryKeysPath = path.resolve(__dirname, "../lib/query/query-keys.ts");
    const queryKeysSource = fs.readFileSync(queryKeysPath, "utf-8");

    const orgViewPath = path.resolve(__dirname, "../components/organization/OrganizationView.tsx");
    const orgViewSource = fs.readFileSync(orgViewPath, "utf-8");

    it("1.1 WorkforcePlanningView MUST contain all 6 operational views/tabs", () => {
      expect(workforceViewSource).toContain('value="overview"');
      expect(workforceViewSource).toContain('value="plans"');
      expect(workforceViewSource).toContain('value="headcount-gap"');
      expect(workforceViewSource).toContain('value="cost-budget"');
      expect(workforceViewSource).toContain('value="requests"');
      expect(workforceViewSource).toContain('value="scenarios"');
    });

    it("1.2 WorkforcePlanningView plan detail panel MUST contain 5 analytical sub-tabs", () => {
      expect(workforceViewSource).toContain('val: "overview"');
      expect(workforceViewSource).toContain('val: "lines"');
      expect(workforceViewSource).toContain('val: "gap"');
      expect(workforceViewSource).toContain('val: "cost"');
      expect(workforceViewSource).toContain('val: "forecast"');
    });

    it("1.3 WorkforcePlanningView MUST NOT contain hardcoded fake headcount/cost values", () => {
      expect(workforceViewSource).not.toContain("currentHeadcount: 42");
      expect(workforceViewSource).not.toContain("projectedCost: 500000");
      expect(workforceViewSource).not.toContain("Math.random()");
    });

    it("1.4 Workforce planning repository exports authoritative query hooks and atomic mutation wrappers", () => {
      expect(workforceRepoSource).toContain("useWorkforcePlans");
      expect(workforceRepoSource).toContain("useWorkforcePlan");
      expect(workforceRepoSource).toContain("useWorkforcePlanLines");
      expect(workforceRepoSource).toContain("useWorkforcePlanForecasts");
      expect(workforceRepoSource).toContain("useHeadcountRequests");
      expect(workforceRepoSource).toContain("useWorkforceKPIs");
      expect(workforceRepoSource).toContain("useActualHeadcount");
      expect(workforceRepoSource).toContain("usePlanVsActual");
      expect(workforceRepoSource).toContain("useWorkforcePlanningMutations");

      // Verify RPC calls
      expect(workforceRepoSource).toContain("calculate_actual_headcount_atomic");
      expect(workforceRepoSource).toContain("create_workforce_plan_atomic");
      expect(workforceRepoSource).toContain("submit_workforce_plan_atomic");
      expect(workforceRepoSource).toContain("approve_workforce_plan_atomic");
      expect(workforceRepoSource).toContain("upsert_plan_line_atomic");
      expect(workforceRepoSource).toContain("generate_monthly_forecast_atomic");
      expect(workforceRepoSource).toContain("create_headcount_request_atomic");
      expect(workforceRepoSource).toContain("approve_headcount_request_atomic");
      expect(workforceRepoSource).toContain("get_plan_vs_actual_atomic");
      expect(workforceRepoSource).toContain("get_workforce_kpis_atomic");
    });

    it("1.5 Workforce planning domain index uses executeReliableMutation and provides proper facades", () => {
      expect(workforceDomainSource).toContain("executeReliableMutation");
      expect(workforceDomainSource).toContain("useWorkforcePlanningDomain");
      expect(workforceDomainSource).toContain("createPlan");
      expect(workforceDomainSource).toContain("submitPlan");
      expect(workforceDomainSource).toContain("approvePlan");
      expect(workforceDomainSource).toContain("upsertPlanLine");
      expect(workforceDomainSource).toContain("generateForecast");
      expect(workforceDomainSource).toContain("createHeadcountRequest");
      expect(workforceDomainSource).toContain("approveHeadcountRequest");

      // Verify no premature toasts inside operation: async () => { ... }
      const operationMatches = workforceDomainSource.match(/operation:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\},/g);
      if (operationMatches) {
        for (const opBlock of operationMatches) {
          expect(opBlock).not.toContain("toast.success(");
        }
      }
    });

    it("1.6 Centralized query keys provide full hierarchy for workforce planning", () => {
      expect(queryKeysSource).toContain("workforce: {");
      expect(queryKeysSource).toContain("plans: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("plan: (id: string)");
      expect(queryKeysSource).toContain("planLines: (planId: string)");
      expect(queryKeysSource).toContain("forecasts: (planId: string, fiscalYear?: number)");
      expect(queryKeysSource).toContain("headcountRequests: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("kpis: (companyId: string, fiscalYear?: number)");
      expect(queryKeysSource).toContain("actualHeadcount: (companyId: string, departmentId?: string | null, asOfDate?: string)");
      expect(queryKeysSource).toContain("planVsActual: (planId: string) =>");
    });

    it("1.7 OrganizationView integrates WorkforcePlanningView", () => {
      expect(orgViewSource).toContain("WorkforcePlanningView");
      expect(orgViewSource).toContain('value="workforce-planning"');
    });
  });

  // ==========================================================================
  // PART 2: PGLITE AUTHORITATIVE DATABASE ENGINE & LIFECYCLE TESTS
  // ==========================================================================
  describe("PGlite Authoritative Workforce Planning Engine Tests", () => {
    const db = new PGlite();

    const companyA = "a0000000-0000-0000-0000-000000000001";
    const companyB = "b0000000-0000-0000-0000-000000000002";

    const userHrAdminA = "11111111-aaaa-aaaa-aaaa-111111111111";
    const userManagerA = "22222222-aaaa-aaaa-aaaa-222222222222";
    const userEmp1A = "33333333-aaaa-aaaa-aaaa-333333333333";
    const userEmpB = "44444444-bbbb-bbbb-bbbb-444444444444";

    let deptAId: string;
    let jobPositionAId: string;
    let costCenterAId: string;
    let createdPlanId: string;
    let createdPlanCode: string;
    let createdRequestId: string;

    async function asUser(userId: string | null) {
      await db.exec(`SELECT set_config('test.auth_uid', '${userId || ""}', false);`);
    }

    beforeAll(async () => {
      // 1. Setup Roles, Auth and Core Schemas in PGlite
      await db.exec(`
        DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id uuid PRIMARY KEY,
          email text UNIQUE,
          raw_user_meta_data jsonb DEFAULT '{}'::jsonb
        );

        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
          SELECT COALESCE(
            NULLIF(current_setting('test.auth_uid', true), ''),
            NULLIF(current_setting('request.jwt.claim.sub', true), '')
          )::uuid;
        $$ LANGUAGE sql STABLE;

        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
          SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
        $$ LANGUAGE sql STABLE;

        -- Core base tables
        CREATE TABLE IF NOT EXISTS public.companies (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name_ar text NOT NULL,
          name_en text NOT NULL,
          owner_user_id uuid,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.departments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          name_ar text NOT NULL,
          name_en text NOT NULL,
          code text,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.cost_centers (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          name_ar text NOT NULL,
          name_en text NOT NULL,
          code text,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.job_positions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          department_id uuid REFERENCES public.departments(id),
          title_ar text NOT NULL,
          title_en text NOT NULL,
          code text,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.work_locations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          name_ar text NOT NULL,
          name_en text NOT NULL,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid REFERENCES auth.users(id),
          employee_no text NOT NULL,
          first_name_ar text NOT NULL,
          last_name_ar text NOT NULL,
          first_name_en text,
          last_name_en text,
          department_id uuid REFERENCES public.departments(id),
          job_position_id uuid REFERENCES public.job_positions(id),
          job_title text DEFAULT 'مهندس برمجيات',
          status text NOT NULL DEFAULT 'active',
          role text NOT NULL DEFAULT 'employee',
          nationality text DEFAULT 'SA',
          work_type text DEFAULT 'full_time',
          contract_type text DEFAULT 'full_time',
          hire_date date DEFAULT CURRENT_DATE,
          termination_date date,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.workforce_plans (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          title_ar text NOT NULL,
          title_en text NOT NULL,
          plan_year integer NOT NULL,
          department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
          current_headcount integer NOT NULL DEFAULT 0,
          planned_hires integer NOT NULL DEFAULT 0,
          planned_exits integer NOT NULL DEFAULT 0,
          target_headcount integer NOT NULL DEFAULT 0,
          current_budget numeric(14,2) NOT NULL DEFAULT 0,
          projected_cost numeric(14,2) NOT NULL DEFAULT 0,
          status text NOT NULL DEFAULT 'draft',
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          employee_id uuid REFERENCES public.employees(id),
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.payroll_runs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          status text NOT NULL DEFAULT 'draft',
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.payroll_run_employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id uuid REFERENCES public.payroll_runs(id),
          employee_id uuid REFERENCES public.employees(id),
          net_salary numeric(12,2) NOT NULL DEFAULT 0,
          created_at timestamptz DEFAULT now()
        );
      `);

      // 2. Load Prompt 19 migration
      const migrationPath = path.resolve(__dirname, "../../supabase/migrations/20261002000000_production_workforce_planning_engine.sql");
      const migrationSql = fs.readFileSync(migrationPath, "utf-8");
      await db.exec(migrationSql);

      // 3. Seed Companies, Users & Employees
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES
          ('${userHrAdminA}', 'hr.admin@company-a.com'),
          ('${userManagerA}', 'manager@company-a.com'),
          ('${userEmp1A}', 'emp1@company-a.com'),
          ('${userEmpB}', 'emp@company-b.com')
        ON CONFLICT DO NOTHING;

        INSERT INTO public.companies (id, name_ar, name_en, owner_user_id) VALUES
          ('${companyA}', 'شركة أ المتقدمة', 'Company A Advanced', '${userHrAdminA}'),
          ('${companyB}', 'شركة ب المنافسة', 'Company B Rival', '${userEmpB}')
        ON CONFLICT DO NOTHING;

        INSERT INTO public.departments (id, company_id, name_ar, name_en, code) VALUES
          (gen_random_uuid(), '${companyA}', 'إدارة التقنية', 'Technology Dept', 'TECH')
        RETURNING id;
      `);

      const deptRes = await db.query<{ id: string }>(`SELECT id FROM public.departments WHERE company_id = '${companyA}' LIMIT 1;`);
      deptAId = deptRes.rows[0].id;

      const jobPosRes = await db.query<{ id: string }>(`
        INSERT INTO public.job_positions (company_id, department_id, title_ar, title_en, code)
        VALUES ('${companyA}', '${deptAId}', 'مهندس نظم رئيسي', 'Lead Systems Engineer', 'ENG-01')
        RETURNING id;
      `);
      jobPositionAId = jobPosRes.rows[0].id;

      const ccRes = await db.query<{ id: string }>(`
        INSERT INTO public.cost_centers (company_id, name_ar, name_en, code)
        VALUES ('${companyA}', 'مركز تكلفة البحث والتطوير', 'R&D Cost Center', 'CC-101')
        RETURNING id;
      `);
      costCenterAId = ccRes.rows[0].id;

      // Seed Employees in Company A:
      // 1. HR Admin (active, Saudi, full_time)
      // 2. Manager (active, Saudi, full_time)
      // 3. Emp 1 (probation, expat, part_time -> fte = 0.5)
      // 4. Emp 2 (on_leave, Saudi, full_time)
      // 5. Emp 3 (terminated -> MUST BE EXCLUDED from employed workforce)
      await db.exec(`
        INSERT INTO public.employees (user_id, company_id, employee_no, first_name_ar, last_name_ar, department_id, status, role, nationality, work_type, contract_type, hire_date) VALUES
          ('${userHrAdminA}', '${companyA}', 'EMP-001', 'فهد', 'العتيبي', '${deptAId}', 'active', 'hr_admin', 'SA', 'full_time', 'full_time', '2024-01-01'),
          ('${userManagerA}', '${companyA}', 'EMP-002', 'سارة', 'الغامدي', '${deptAId}', 'active', 'manager', 'SA', 'full_time', 'full_time', '2024-02-01'),
          ('${userEmp1A}', '${companyA}', 'EMP-003', 'جون', 'دو', '${deptAId}', 'probation', 'employee', 'EG', 'part_time', 'part_time', '2025-01-01'),
          (NULL, '${companyA}', 'EMP-004', 'عبدالله', 'القحطاني', '${deptAId}', 'on_leave', 'employee', 'Saudi Arabia', 'full_time', 'full_time', '2024-03-01'),
          (NULL, '${companyA}', 'EMP-005', 'خالد', 'المنصور', '${deptAId}', 'terminated', 'employee', 'SA', 'full_time', 'full_time', '2023-01-01');

        -- Seed Employee in Company B (cross-tenant test)
        INSERT INTO public.employees (user_id, company_id, employee_no, first_name_ar, last_name_ar, status, role, nationality) VALUES
          ('${userEmpB}', '${companyB}', 'EMP-B01', 'روبرت', 'سميث', 'active', 'hr_admin', 'US');
      `);
    });

    // ------------------------------------------------------------------------
    // TEST 2.1: Server-Authoritative Actual Headcount
    // ------------------------------------------------------------------------
    it("2.1 calculate_actual_headcount_atomic computes truthful counts from employees table", async () => {
      await asUser(userHrAdminA);

      const res = await db.query<{ calculate_actual_headcount_atomic: any }>(`
        SELECT public.calculate_actual_headcount_atomic('${companyA}'::uuid) as calculate_actual_headcount_atomic;
      `);

      const data = res.rows[0].calculate_actual_headcount_atomic;
      expect(data.ok).toBe(true);

      // Total employed MUST be 4: EMP-001 (active), EMP-002 (active), EMP-003 (probation), EMP-004 (on_leave)
      // EMP-005 (terminated) MUST be excluded!
      expect(Number(data.total_employed)).toBe(4);
      expect(Number(data.total_active)).toBe(2);
      expect(Number(data.total_probation)).toBe(1);
      expect(Number(data.total_on_leave)).toBe(1);

      // Saudi vs Expat:
      // Saudis: EMP-001 (SA), EMP-002 (SA), EMP-004 (Saudi Arabia) = 3
      // Expats: EMP-003 (EG) = 1
      expect(Number(data.saudi_count)).toBe(3);
      expect(Number(data.expat_count)).toBe(1);

      // Saudization = 3 / 4 * 100 = 75.0%
      expect(Number(data.saudization_pct)).toBe(75);

      // FTE Total:
      // full_time: 1.0 + 1.0 + 1.0 = 3.0
      // part_time: 0.5 = 0.5
      // Total FTE = 3.5
      expect(Number(data.fte_total)).toBe(3.5);

      // Dept breakdown must include deptAId
      expect(Array.isArray(data.dept_breakdown)).toBe(true);
      expect(data.dept_breakdown.length).toBeGreaterThan(0);
      const deptA = data.dept_breakdown.find((d: any) => d.department_id === deptAId);
      expect(deptA).toBeDefined();
      expect(Number(deptA.total_employed)).toBe(4);
    });

    // ------------------------------------------------------------------------
    // TEST 2.2: Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    it("2.2 calculate_actual_headcount_atomic rejects cross-tenant access", async () => {
      // User from Company B attempts to inspect Company A
      await asUser(userEmpB);

      const res = await db.query<{ calculate_actual_headcount_atomic: any }>(`
        SELECT public.calculate_actual_headcount_atomic('${companyA}'::uuid) as calculate_actual_headcount_atomic;
      `);

      const data = res.rows[0].calculate_actual_headcount_atomic;
      expect(data.ok).toBe(false);
      expect(data.error).toBe("access_denied");
    });

    // ------------------------------------------------------------------------
    // TEST 2.3: Create Workforce Plan Atomic
    // ------------------------------------------------------------------------
    it("2.3 create_workforce_plan_atomic creates plan with auto-generated code and baseline flag", async () => {
      await asUser(userHrAdminA);

      const res = await db.query<{ create_workforce_plan_atomic: any }>(`
        SELECT public.create_workforce_plan_atomic(
          p_company_id := '${companyA}'::uuid,
          p_title_ar := 'خطة القوى العاملة 2026',
          p_title_en := 'Workforce Plan 2026',
          p_fiscal_year := 2026,
          p_plan_type := 'annual',
          p_department_id := NULL,
          p_notes := 'الخطة الاستراتيجية للعام القادم',
          p_parent_plan_id := NULL,
          p_scenario_label := 'الأساس',
          p_fte_budget := 10.0,
          p_total_compensation_budget := 1200000.00,
          p_saudization_target_pct := 70.0
        ) as create_workforce_plan_atomic;
      `);

      const data = res.rows[0].create_workforce_plan_atomic;
      expect(data.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.plan_id).toBeDefined();
      expect(data.plan_code).toMatch(/^WFP-2026-\d{4}$/);
      expect(Number(data.version_number)).toBe(1);

      createdPlanId = data.plan_id;
      createdPlanCode = data.plan_code;

      // Verify stored row in database
      const planRow = await db.query<any>(`SELECT * FROM public.workforce_plans WHERE id = '${createdPlanId}'`);
      expect(planRow.rows.length).toBe(1);
      expect(planRow.rows[0].status).toBe("draft");
      expect(planRow.rows[0].is_baseline).toBe(true);
      expect(Number(planRow.rows[0].total_compensation_budget)).toBe(1200000);
    });

    // ------------------------------------------------------------------------
    // TEST 2.4: Upsert Plan Lines on Draft Plan
    // ------------------------------------------------------------------------
    it("2.4 upsert_plan_line_atomic adds positions to draft plan and updates target totals", async () => {
      await asUser(userHrAdminA);

      const lineRes = await db.query<{ upsert_plan_line_atomic: any }>(`
        SELECT public.upsert_plan_line_atomic(
          p_company_id := '${companyA}'::uuid,
          p_plan_id := '${createdPlanId}'::uuid,
          p_position_title_ar := 'مهندس برمجيات أول',
          p_job_position_id := '${jobPositionAId}'::uuid,
          p_department_id := '${deptAId}'::uuid,
          p_cost_center_id := '${costCenterAId}'::uuid,
          p_planned_headcount := 5,
          p_target_headcount := 6,
          p_hires_planned := 2,
          p_exits_planned := 0,
          p_avg_monthly_compensation := 25000.00,
          p_fte_per_head := 1.0,
          p_employment_type := 'full_time'
        ) as upsert_plan_line_atomic;
      `);

      const data = lineRes.rows[0].upsert_plan_line_atomic;
      expect(data.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.line_id).toBeDefined();

      // Check plan aggregates were recomputed
      const planRow = await db.query<any>(`SELECT * FROM public.workforce_plans WHERE id = '${createdPlanId}'`);
      expect(Number(planRow.rows[0].target_headcount)).toBe(6);
      expect(Number(planRow.rows[0].planned_hires)).toBe(2);
    });

    // ------------------------------------------------------------------------
    // TEST 2.5: Submit Workforce Plan
    // ------------------------------------------------------------------------
    it("2.5 submit_workforce_plan_atomic transitions status from draft to pending_approval", async () => {
      await asUser(userHrAdminA);

      const submitRes = await db.query<{ submit_workforce_plan_atomic: any }>(`
        SELECT public.submit_workforce_plan_atomic(
          p_plan_id := '${createdPlanId}'::uuid,
          p_company_id := '${companyA}'::uuid
        ) as submit_workforce_plan_atomic;
      `);

      const data = submitRes.rows[0].submit_workforce_plan_atomic;
      expect(data.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.status).toBe("pending_approval");

      // Verify cannot resubmit an already submitted plan
      const reSubmitRes = await db.query<{ submit_workforce_plan_atomic: any }>(`
        SELECT public.submit_workforce_plan_atomic(
          p_plan_id := '${createdPlanId}'::uuid,
          p_company_id := '${companyA}'::uuid
        ) as submit_workforce_plan_atomic;
      `);
      expect(reSubmitRes.rows[0].submit_workforce_plan_atomic.ok).toBe(false);
      expect(reSubmitRes.rows[0].submit_workforce_plan_atomic.error).toBe("plan_not_in_draft");
    });

    // ------------------------------------------------------------------------
    // TEST 2.6: Approve Workforce Plan
    // ------------------------------------------------------------------------
    it("2.6 approve_workforce_plan_atomic approves plan and records approver metadata", async () => {
      await asUser(userHrAdminA);

      const approveRes = await db.query<{ approve_workforce_plan_atomic: any }>(`
        SELECT public.approve_workforce_plan_atomic(
          p_plan_id := '${createdPlanId}'::uuid,
          p_company_id := '${companyA}'::uuid,
          p_action := 'approve',
          p_notes := 'معتمد بموجب موافقة الإدارة التنفيذية'
        ) as approve_workforce_plan_atomic;
      `);

      const data = approveRes.rows[0].approve_workforce_plan_atomic;
      expect(data.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.status).toBe("approved");

      // Verify row state
      const planRow = await db.query<any>(`SELECT * FROM public.workforce_plans WHERE id = '${createdPlanId}'`);
      expect(planRow.rows[0].status).toBe("approved");
      expect(planRow.rows[0].approved_by).toBe(userHrAdminA);
      expect(planRow.rows[0].approved_at).not.toBeNull();
    });

    // ------------------------------------------------------------------------
    // TEST 2.7: Immutability Enforcement on Approved Plans
    // ------------------------------------------------------------------------
    it("2.7 approved plans are immutable: modifications to plan lines are strictly rejected", async () => {
      await asUser(userHrAdminA);

      const res = await db.query<{ upsert_plan_line_atomic: any }>(`
        SELECT public.upsert_plan_line_atomic(
          p_company_id := '${companyA}'::uuid,
          p_plan_id := '${createdPlanId}'::uuid,
          p_position_title_ar := 'محاولة تعديل غير مسموحة',
          p_planned_headcount := 10,
          p_target_headcount := 10
        ) as upsert_plan_line_atomic;
      `);

      const data = res.rows[0].upsert_plan_line_atomic;
      expect(data.ok).toBe(false);
      expect(data.error).toBe("plan_approved_immutable");
    });

    // ------------------------------------------------------------------------
    // TEST 2.8: Generate Monthly Forecast
    // ------------------------------------------------------------------------
    it("2.8 generate_monthly_forecast_atomic builds 12 monthly distribution rows", async () => {
      await asUser(userHrAdminA);

      const res = await db.query<{ generate_monthly_forecast_atomic: any }>(`
        SELECT public.generate_monthly_forecast_atomic(
          p_company_id := '${companyA}'::uuid,
          p_plan_id := '${createdPlanId}'::uuid,
          p_forecast_year := 2026
        ) as generate_monthly_forecast_atomic;
      `);

      const data = res.rows[0].generate_monthly_forecast_atomic;
      expect(data.ok).toBe(true);
      expect(Number(data.months_generated)).toBe(12);

      // Verify all 12 rows are stored
      const forecastRows = await db.query<any>(`
        SELECT forecast_month, forecast_headcount, forecast_fte
        FROM public.workforce_plan_monthly_forecasts
        WHERE plan_id = '${createdPlanId}'
        ORDER BY forecast_month;
      `);
      expect(forecastRows.rows.length).toBe(12);
      expect(forecastRows.rows[0].forecast_month).toBe(1);
      expect(forecastRows.rows[11].forecast_month).toBe(12);
    });

    // ------------------------------------------------------------------------
    // TEST 2.9: Create Headcount Request Atomic
    // ------------------------------------------------------------------------
    it("2.9 create_headcount_request_atomic generates official request with HCR number", async () => {
      await asUser(userHrAdminA);

      const res = await db.query<{ create_headcount_request_atomic: any }>(`
        SELECT public.create_headcount_request_atomic(
          p_company_id := '${companyA}'::uuid,
          p_position_title_ar := 'أخصائي موارد بشرية',
          p_requested_headcount := 1,
          p_priority := 'high',
          p_justification_ar := 'توسع العمليات التشغيلية وزيادة عدد الموظفين',
          p_plan_id := '${createdPlanId}'::uuid
        ) as create_headcount_request_atomic;
      `);

      const data = res.rows[0].create_headcount_request_atomic;
      expect(data.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.request_id).toBeDefined();
      expect(data.request_no).toMatch(/^HCR-2026-\d{4}$/);

      createdRequestId = data.request_id;
    });

    // ------------------------------------------------------------------------
    // TEST 2.10: Approve Headcount Request Atomic
    // ------------------------------------------------------------------------
    it("2.10 approve_headcount_request_atomic approves request without auto-publishing job openings", async () => {
      await asUser(userHrAdminA);

      const res = await db.query<{ approve_headcount_request_atomic: any }>(`
        SELECT public.approve_headcount_request_atomic(
          p_request_id := '${createdRequestId}'::uuid,
          p_company_id := '${companyA}'::uuid,
          p_action := 'approve',
          p_approved_headcount := 1,
          p_notes := 'موافقة على فتح مسار الاستقطاب الداخلي/الخارجي'
        ) as approve_headcount_request_atomic;
      `);

      const data = res.rows[0].approve_headcount_request_atomic;
      expect(data.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.status).toBe("approved");

      // Verify database row
      const reqRow = await db.query<any>(`SELECT * FROM public.headcount_requests WHERE id = '${createdRequestId}'`);
      expect(reqRow.rows[0].status).toBe("approved");
      expect(Number(reqRow.rows[0].approved_headcount)).toBe(1);
      expect(reqRow.rows[0].approved_by).toBe(userHrAdminA);
    });

    // ------------------------------------------------------------------------
    // TEST 2.11: Plan vs Actual Gap Analysis
    // ------------------------------------------------------------------------
    it("2.11 get_plan_vs_actual_atomic calculates headcount and FTE gaps authoritatively", async () => {
      await asUser(userHrAdminA);

      const res = await db.query<{ get_plan_vs_actual_atomic: any }>(`
        SELECT public.get_plan_vs_actual_atomic(
          p_plan_id := '${createdPlanId}'::uuid,
          p_company_id := '${companyA}'::uuid
        ) as get_plan_vs_actual_atomic;
      `);

      const data = res.rows[0].get_plan_vs_actual_atomic;
      expect(data.ok).toBe(true);

      // Planned target was 6
      expect(Number(data.planned_target_headcount)).toBe(6);

      // Actual employed in Company A is 4
      expect(Number(data.actual_employed)).toBe(4);

      // Headcount gap = 6 - 4 = 2 vacancies
      expect(Number(data.headcount_gap)).toBe(2);

      // Actual FTE is 3.5, planned FTE recomputed from lines is 6.0 -> fte_gap = 2.5
      expect(Number(data.planned_fte_budget)).toBe(6);
      expect(Number(data.actual_fte)).toBe(3.5);
      expect(Number(data.fte_gap)).toBe(2.5);
    });

    // ------------------------------------------------------------------------
    // TEST 2.12: Comprehensive Workforce KPIs
    // ------------------------------------------------------------------------
    it("2.12 get_workforce_kpis_atomic provides consolidated executive analytics", async () => {
      await asUser(userHrAdminA);

      const res = await db.query<{ get_workforce_kpis_atomic: any }>(`
        SELECT public.get_workforce_kpis_atomic(
          p_company_id := '${companyA}'::uuid,
          p_fiscal_year := 2026
        ) as get_workforce_kpis_atomic;
      `);

      const data = res.rows[0].get_workforce_kpis_atomic;
      expect(data.ok).toBe(true);
      expect(data.success).toBe(true);

      expect(Number(data.total_employed)).toBe(4);
      expect(Number(data.saudi_count)).toBe(3);
      expect(Number(data.expat_count)).toBe(1);
      expect(Number(data.saudization_pct)).toBe(75);
      expect(Number(data.approved_plans)).toBe(1);
      expect(Number(data.approved_hc_requests)).toBe(1);
      expect(Number(data.total_compensation_budget)).toBe(1200000);
      expect(Number(data.open_vacancies)).toBe(2); // 6 target - 4 employed
    });
  });
});
