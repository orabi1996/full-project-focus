import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 18: Production Performance Management, OKR, Competency & 360° Review Engine", () => {
  // ==========================================================================
  // PART 1: STATIC AST & SOURCE CODE CONTRACT TESTS
  // ==========================================================================
  describe("Static Source Code Contract Tests", () => {
    const performanceViewPath = path.resolve(__dirname, "../components/performance/PerformanceView.tsx");
    const performanceViewSource = fs.readFileSync(performanceViewPath, "utf-8");

    const performanceRepoPath = path.resolve(__dirname, "../lib/data/performance-repository.ts");
    const performanceRepoSource = fs.readFileSync(performanceRepoPath, "utf-8");

    const performanceDomainPath = path.resolve(__dirname, "../lib/domains/performance/index.ts");
    const performanceDomainSource = fs.readFileSync(performanceDomainPath, "utf-8");

    const queryKeysPath = path.resolve(__dirname, "../lib/query/query-keys.ts");
    const queryKeysSource = fs.readFileSync(queryKeysPath, "utf-8");

    it("1.1 PerformanceView MUST contain all 8 operational enterprise tabs", () => {
      expect(performanceViewSource).toContain('value="cycles"');
      expect(performanceViewSource).toContain('value="goals"');
      expect(performanceViewSource).toContain('value="my-reviews"');
      expect(performanceViewSource).toContain('value="team-reviews"');
      expect(performanceViewSource).toContain('value="360"');
      expect(performanceViewSource).toContain('value="calibration"');
      expect(performanceViewSource).toContain('value="ninebox"');
      expect(performanceViewSource).toContain('value="development"');
    });

    it("1.2 PerformanceView MUST NOT contain hardcoded 9-Box counts (4, 7, 12, 28) or workforce total 78", () => {
      expect(performanceViewSource).not.toContain("count: 4,");
      expect(performanceViewSource).not.toContain("count: 7,");
      expect(performanceViewSource).not.toContain("count: 12,");
      expect(performanceViewSource).not.toContain("count: 28,");
      expect(performanceViewSource).not.toContain("/ 78) * 100");
    });

    it("1.3 PerformanceView MUST NOT contain fabricated feedback or default rating fallbacks", () => {
      expect(performanceViewSource).not.toContain("أداء متميز ومطابق للتوقعات مع التوصية بمواصلة التميز");
      expect(performanceViewSource).not.toContain("employees[0]?.id");
      expect(performanceViewSource).not.toContain('Date.now()');
    });

    it("1.4 Performance repository exports authoritative query hooks and atomic mutation wrappers", () => {
      expect(performanceRepoSource).toContain("usePerformanceCycles");
      expect(performanceRepoSource).toContain("useCycleParticipants");
      expect(performanceRepoSource).toContain("usePerformanceGoals");
      expect(performanceRepoSource).toContain("useReviewAssignments");
      expect(performanceRepoSource).toContain("useMyReviews");
      expect(performanceRepoSource).toContain("useTeamReviews");
      expect(performanceRepoSource).toContain("useCalibrationSessions");
      expect(performanceRepoSource).toContain("useNineBoxData");
      expect(performanceRepoSource).toContain("useDevelopmentPlans");
      expect(performanceRepoSource).toContain("usePIPs");
      expect(performanceRepoSource).toContain("usePerformanceKPIs");
      expect(performanceRepoSource).toContain("usePerformanceRepositoryMutations");
      expect(performanceRepoSource).toContain("launch_performance_cycle_atomic");
      expect(performanceRepoSource).toContain("assign_peer_reviewers_atomic");
      expect(performanceRepoSource).toContain("submit_performance_goal_atomic");
      expect(performanceRepoSource).toContain("update_goal_progress_atomic");
      expect(performanceRepoSource).toContain("submit_performance_review_atomic");
      expect(performanceRepoSource).toContain("adjust_calibration_atomic");
      expect(performanceRepoSource).toContain("assess_potential_atomic");
      expect(performanceRepoSource).toContain("finalize_performance_cycle_atomic");
      expect(performanceRepoSource).toContain("get_performance_kpis_atomic");
    });

    it("1.5 Performance domain index uses executeReliableMutation and does not trigger premature toasts inside operations", () => {
      expect(performanceDomainSource).toContain("executeReliableMutation");
      expect(performanceDomainSource).toContain("launchCycle");
      expect(performanceDomainSource).toContain("assignPeerReviewers");
      expect(performanceDomainSource).toContain("submitGoal");
      expect(performanceDomainSource).toContain("submitReview");
      expect(performanceDomainSource).toContain("adjustCalibration");
      expect(performanceDomainSource).toContain("assessPotential");
      expect(performanceDomainSource).toContain("finalizeCycle");

      // Verify no premature toasts inside operation: async () => { ... }
      const operationMatches = performanceDomainSource.match(/operation:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\},/g);
      if (operationMatches) {
        for (const opBlock of operationMatches) {
          expect(opBlock).not.toContain("toast.success(");
        }
      }
    });

    it("1.6 Centralized query keys provide full hierarchy for performance management", () => {
      expect(queryKeysSource).toContain("cycles: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("cycle: (id: string)");
      expect(queryKeysSource).toContain("participants: (cycleId: string, filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("goals: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("goal: (id: string)");
      expect(queryKeysSource).toContain("assignments: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("myReviews: (cycleId?: string)");
      expect(queryKeysSource).toContain("teamReviews: (cycleId?: string)");
      expect(queryKeysSource).toContain("calibrationSessions: (cycleId?: string)");
      expect(queryKeysSource).toContain("nineBox: (cycleId: string, departmentId?: string)");
      expect(queryKeysSource).toContain("potential: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("kpis: (cycleId?: string, companyId?: string)");
    });
  });

  // ==========================================================================
  // PART 2: PGLITE AUTHORITATIVE DATABASE ENGINE & LIFECYCLE TESTS
  // ==========================================================================
  describe("PGlite Authoritative Performance 360° Engine Tests", () => {
    const db = new PGlite();

    const companyA = "a0000000-0000-0000-0000-000000000001";
    const companyB = "b0000000-0000-0000-0000-000000000002";

    const userHrAdminA = "11111111-aaaa-aaaa-aaaa-111111111111";
    const userManagerA = "22222222-aaaa-aaaa-aaaa-222222222222";
    const userEmp1A = "33333333-aaaa-aaaa-aaaa-333333333333";
    const userEmp2A = "44444444-aaaa-aaaa-aaaa-444444444444";
    const userEmpB = "55555555-bbbb-bbbb-bbbb-555555555555";

    let deptAId: string;
    let empManagerId: string;
    let emp1Id: string;
    let emp2Id: string;
    let empBId: string;
    let cycleId: string;

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
          manager_id uuid REFERENCES public.employees(id),
          manager_employee_id uuid REFERENCES public.employees(id),
          job_title text DEFAULT 'مهندس برمجيات',
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          employee_id uuid REFERENCES public.employees(id),
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.user_roles (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES auth.users(id),
          company_id uuid NOT NULL REFERENCES public.companies(id),
          role text NOT NULL,
          created_at timestamptz DEFAULT now()
        );

        CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid AS $$
          SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
        $$ LANGUAGE sql STABLE;

        CREATE OR REPLACE FUNCTION public.current_user_has_role(p_role text) RETURNS boolean AS $$
          SELECT EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND (role = p_role OR role = 'admin' OR role = 'superadmin')
          );
        $$ LANGUAGE sql STABLE;

        CREATE OR REPLACE FUNCTION public.current_user_has_any_role(allowed_roles text[])
        RETURNS boolean
        LANGUAGE sql
        STABLE
        AS $$
          SELECT EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_id = auth.uid()
              AND (
                role = ANY(allowed_roles)
                OR (role = 'admin' AND ('org_admin' = ANY(allowed_roles) OR 'super_admin' = ANY(allowed_roles) OR 'admin' = ANY(allowed_roles) OR 'hr_manager' = ANY(allowed_roles)))
                OR (role = 'superadmin' AND ('super_admin' = ANY(allowed_roles) OR 'org_admin' = ANY(allowed_roles) OR 'hr_manager' = ANY(allowed_roles)))
              )
          )
        $$;

        CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
          SELECT public.current_user_has_role('admin');
        $$ LANGUAGE sql STABLE;

        -- Minimal base performance_cycles from original baseline
        CREATE TABLE IF NOT EXISTS public.performance_cycles (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          title_ar text NOT NULL,
          title_en text NOT NULL,
          period_type text NOT NULL DEFAULT 'annual',
          start_date date NOT NULL,
          end_date date NOT NULL,
          status text NOT NULL DEFAULT 'draft',
          participants_count integer DEFAULT 0,
          completion_rate numeric(5,2) DEFAULT 0,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.evaluation_records (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          cycle_id uuid REFERENCES public.performance_cycles(id),
          employee_id uuid REFERENCES public.employees(id),
          evaluator_employee_id uuid REFERENCES public.employees(id),
          evaluation_type text NOT NULL,
          overall_score numeric(3,2) NOT NULL,
          competency_scores jsonb DEFAULT '{}'::jsonb,
          notes text,
          status text NOT NULL DEFAULT 'pending',
          submitted_at timestamptz,
          created_at timestamptz DEFAULT now()
        );
      `);

      // 2. Load and execute the new migration 20261001000000_production_performance_360_engine.sql
      const migrationPath = path.resolve(
        __dirname,
        "../../supabase/migrations/20261001000000_production_performance_360_engine.sql",
      );
      const migrationSql = fs.readFileSync(migrationPath, "utf-8");
      await db.exec(migrationSql);

      // 3. Seed Auth Users and Companies
      await db.exec(`
        INSERT INTO public.companies (id, name_ar, name_en) VALUES
          ('${companyA}', 'شركة التركيز المتكاملة', 'Integrated Focus Co'),
          ('${companyB}', 'شركة المنافس', 'Competitor Co');

        INSERT INTO auth.users (id, email) VALUES
          ('${userHrAdminA}', 'hr.admin@company-a.com'),
          ('${userManagerA}', 'manager@company-a.com'),
          ('${userEmp1A}', 'emp1@company-a.com'),
          ('${userEmp2A}', 'emp2@company-a.com'),
          ('${userEmpB}', 'emp@company-b.com');

        INSERT INTO public.user_roles (user_id, company_id, role) VALUES
          ('${userHrAdminA}', '${companyA}', 'admin'),
          ('${userManagerA}', '${companyA}', 'manager'),
          ('${userEmp1A}', '${companyA}', 'employee'),
          ('${userEmp2A}', '${companyA}', 'employee'),
          ('${userEmpB}', '${companyB}', 'employee');
      `);

      // 4. Seed Departments and Employees
      const deptRes = await db.query<{ id: string }>(`
        INSERT INTO public.departments (company_id, name_ar, name_en, code)
        VALUES ('${companyA}', 'تقنية المعلومات', 'Information Technology', 'IT-01')
        RETURNING id;
      `);
      deptAId = deptRes.rows[0].id;

      const mgrRes = await db.query<{ id: string }>(`
        INSERT INTO public.employees (company_id, user_id, employee_no, first_name_ar, last_name_ar, department_id, job_title)
        VALUES ('${companyA}', '${userManagerA}', 'EMP-MGR', 'خالد', 'الغامدي', '${deptAId}', 'مدير تقنية المعلومات')
        RETURNING id;
      `);
      empManagerId = mgrRes.rows[0].id;

      const emp1Res = await db.query<{ id: string }>(`
        INSERT INTO public.employees (company_id, user_id, employee_no, first_name_ar, last_name_ar, department_id, manager_id, manager_employee_id, job_title)
        VALUES ('${companyA}', '${userEmp1A}', 'EMP-001', 'سارة', 'العتيبي', '${deptAId}', '${empManagerId}', '${empManagerId}', 'مطور واجهات أول')
        RETURNING id;
      `);
      emp1Id = emp1Res.rows[0].id;

      const emp2Res = await db.query<{ id: string }>(`
        INSERT INTO public.employees (company_id, user_id, employee_no, first_name_ar, last_name_ar, department_id, manager_id, manager_employee_id, job_title)
        VALUES ('${companyA}', '${userEmp2A}', 'EMP-002', 'أحمد', 'الشهري', '${deptAId}', '${empManagerId}', '${empManagerId}', 'مطور خوادم أول')
        RETURNING id;
      `);
      emp2Id = emp2Res.rows[0].id;

      const empBRes = await db.query<{ id: string }>(`
        INSERT INTO public.employees (company_id, user_id, employee_no, first_name_ar, last_name_ar, job_title)
        VALUES ('${companyB}', '${userEmpB}', 'EMP-B01', 'سامي', 'المنافس', 'مطور')
        RETURNING id;
      `);
      empBId = empBRes.rows[0].id;
    });

    it("2.1 Creates performance cycle with valid rules and weights", async () => {
      await asUser(userHrAdminA);

      const cycleRes = await db.query<{ id: string; status: string; code: string }>(`
        INSERT INTO public.performance_cycles (
          company_id, code, title_ar, title_en, period_type, start_date, end_date,
          status, goals_weight_pct, competencies_weight_pct, allow_peer_reviews
        ) VALUES (
          '${companyA}', 'CYC-2026-Q4', 'دورة تقييم الربع الرابع 2026', 'Q4 2026 Review Cycle',
          'quarterly', '2026-10-01', '2026-12-31', 'draft', 60, 40, true
        ) RETURNING id, status, code;
      `);

      expect(cycleRes.rows.length).toBe(1);
      cycleId = cycleRes.rows[0].id;
      expect(cycleRes.rows[0].status).toBe("draft");
      expect(cycleRes.rows[0].code).toBe("CYC-2026-Q4");
    });

    it("2.2 launch_performance_cycle_atomic freezes participant snapshot and auto-generates self and manager review assignments", async () => {
      await asUser(userHrAdminA);

      const launchRes = await db.query<{ launch_performance_cycle_atomic: any }>(`
        SELECT public.launch_performance_cycle_atomic(
          '${cycleId}'::uuid,
          NULL
        );
      `);

      const result = launchRes.rows[0].launch_performance_cycle_atomic;
      expect(result.success).toBe(true);
      expect(result.participants_enrolled).toBeGreaterThanOrEqual(3); // Manager + Emp1 + Emp2
      expect(result.assignments_generated).toBeGreaterThanOrEqual(5);

      // Verify participant snapshot is frozen in performance_cycle_participants
      const participants = await db.query<{ employee_id: string; employee_name_ar: string; status: string }>(`
        SELECT employee_id, employee_name_ar, status
        FROM public.performance_cycle_participants
        WHERE cycle_id = '${cycleId}'::uuid
        ORDER BY employee_name_ar;
      `);

      expect(participants.rows.length).toBeGreaterThanOrEqual(3);
      const participantIds = participants.rows.map((p) => p.employee_id);
      expect(participantIds).toContain(emp1Id);
      expect(participantIds).toContain(emp2Id);
      expect(participantIds).toContain(empManagerId);

      // Verify self review assignment for Emp1
      const selfAssignment = await db.query<{ id: string; review_type: string; status: string }>(`
        SELECT id, review_type, status
        FROM public.performance_review_assignments
        WHERE cycle_id = '${cycleId}'::uuid
          AND employee_id = '${emp1Id}'::uuid
          AND reviewer_employee_id = '${emp1Id}'::uuid
          AND review_type = 'self';
      `);
      expect(selfAssignment.rows.length).toBe(1);
      expect(selfAssignment.rows[0].review_type).toBe("self");

      // Verify manager review assignment for Emp1 assigned to empManagerId
      const managerAssignment = await db.query<{ id: string; review_type: string; reviewer_employee_id: string }>(`
        SELECT id, review_type, reviewer_employee_id
        FROM public.performance_review_assignments
        WHERE cycle_id = '${cycleId}'::uuid
          AND employee_id = '${emp1Id}'::uuid
          AND reviewer_employee_id = '${empManagerId}'::uuid
          AND review_type = 'manager';
      `);
      expect(managerAssignment.rows.length).toBe(1);
      expect(managerAssignment.rows[0].reviewer_employee_id).toBe(empManagerId);
    });

    it("2.3 submit_performance_goal_atomic validates individual weights and rejects weights > 100%", async () => {
      await asUser(userEmp1A);

      // Valid goal with weight 30%
      const goalRes = await db.query<{ submit_performance_goal_atomic: any }>(`
        SELECT public.submit_performance_goal_atomic(
          '${cycleId}'::uuid,
          '${emp1Id}'::uuid,
          NULL::uuid,
          'individual'::text,
          'individual'::text,
          'تحسين سرعة تحميل الواجهة بنسبة 35%'::text,
          'Improve frontend performance by 35%'::text,
          'تحسين مؤشرات Core Web Vitals في المنصة'::text,
          'percentage'::text,
          0::numeric,
          100::numeric,
          30::numeric
        );
      `);
      const goalResult = goalRes.rows[0].submit_performance_goal_atomic;
      expect(goalResult.success).toBe(true);
      const goal1Id = goalResult.goal_id;

      // Second valid goal with weight 40%
      await db.query(`
        SELECT public.submit_performance_goal_atomic(
          '${cycleId}'::uuid,
          '${emp1Id}'::uuid,
          NULL::uuid,
          'individual'::text,
          'individual'::text,
          'إعادة هيكلة مكتبة المكونات المشتركة'::text,
          'Refactor shared component library'::text,
          'توحيد التصميم والأنماط'::text,
          'percentage'::text,
          0::numeric,
          100::numeric,
          40::numeric
        );
      `);

      // Goal with invalid weight > 100% must be rejected
      const invalidWeightRes = await db.query<{ submit_performance_goal_atomic: any }>(`
        SELECT public.submit_performance_goal_atomic(
          '${cycleId}'::uuid,
          '${emp1Id}'::uuid,
          NULL::uuid,
          'individual'::text,
          'individual'::text,
          'هدف غير صالح بوزن ضخم'::text,
          NULL::text,
          NULL::text,
          'percentage'::text,
          0::numeric,
          100::numeric,
          105::numeric
        );
      `);
      expect(invalidWeightRes.rows[0].submit_performance_goal_atomic.success).toBe(false);
      expect(invalidWeightRes.rows[0].submit_performance_goal_atomic.error).toContain("100");

      // Verify updating goal progress and appending non-destructive history
      const progressRes = await db.query<{ update_goal_progress_atomic: any }>(`
        SELECT public.update_goal_progress_atomic(
          '${goal1Id}'::uuid,
          75,
          75,
          'تم الانتهاء من ضغط الحزم البرمجية والتحسينات الأولية'
        );
      `);
      expect(progressRes.rows[0].update_goal_progress_atomic.success).toBe(true);
      expect(progressRes.rows[0].update_goal_progress_atomic.new_percentage).toBe(75);

      // Verify history row
      const history = await db.query<{ previous_value: number; new_value: number; percentage: number; note: string }>(`
        SELECT previous_value, new_value, percentage, note
        FROM public.goal_progress_history
        WHERE goal_id = '${goal1Id}'::uuid;
      `);
      expect(history.rows.length).toBe(1);
      expect(Number(history.rows[0].new_value)).toBe(75);
      expect(Number(history.rows[0].percentage)).toBe(75);
      expect(history.rows[0].note).toContain("ضغط الحزم");
    });

    it("2.4 assign_peer_reviewers_atomic enforces cross-tenant boundary and creates peer review assignments", async () => {
      await asUser(userHrAdminA);

      // Attempt to assign employee from Company B as peer for Emp1 (Company A) -> Must be rejected
      const crossTenantRes = await db.query<{ assign_peer_reviewers_atomic: any }>(`
        SELECT public.assign_peer_reviewers_atomic(
          '${cycleId}'::uuid,
          '${emp1Id}'::uuid,
          ARRAY['${empBId}'::uuid],
          true
        );
      `);
      expect(crossTenantRes.rows[0].assign_peer_reviewers_atomic.success).toBe(false);
      expect(crossTenantRes.rows[0].assign_peer_reviewers_atomic.error).toContain("غير صالح");

      // Assign valid peer from same company (Emp2)
      const validPeerRes = await db.query<{ assign_peer_reviewers_atomic: any }>(`
        SELECT public.assign_peer_reviewers_atomic(
          '${cycleId}'::uuid,
          '${emp1Id}'::uuid,
          ARRAY['${emp2Id}'::uuid],
          true
        );
      `);
      expect(validPeerRes.rows[0].assign_peer_reviewers_atomic.success).toBe(true);
      expect(validPeerRes.rows[0].assign_peer_reviewers_atomic.assignments_count).toBe(1);

      // Verify peer assignment exists with anonymity flag
      const peerAssignment = await db.query<{ reviewer_employee_id: string; is_anonymous: boolean; review_type: string }>(`
        SELECT reviewer_employee_id, is_anonymous, review_type
        FROM public.performance_review_assignments
        WHERE cycle_id = '${cycleId}'::uuid
          AND employee_id = '${emp1Id}'::uuid
          AND reviewer_employee_id = '${emp2Id}'::uuid;
      `);
      expect(peerAssignment.rows.length).toBe(1);
      expect(peerAssignment.rows[0].is_anonymous).toBe(true);
      expect(peerAssignment.rows[0].review_type).toBe("peer");
    });

    it("2.5 submit_performance_review_atomic enforces evaluator authorization and computes scores server-side", async () => {
      // Find manager assignment for Emp1
      const managerAssignment = await db.query<{ id: string }>(`
        SELECT id FROM public.performance_review_assignments
        WHERE cycle_id = '${cycleId}'::uuid
          AND employee_id = '${emp1Id}'::uuid
          AND reviewer_employee_id = '${empManagerId}'::uuid;
      `);
      const assignmentId = managerAssignment.rows[0].id;

      // Unauthorized user (Emp2) attempting to submit Manager's review -> Must be denied
      await asUser(userEmp2A);
      const unauthorizedSubmit = await db.query<{ submit_performance_review_atomic: any }>(`
        SELECT public.submit_performance_review_atomic(
          '${assignmentId}'::uuid,
          '[{"item_type": "goal", "item_id": "g-1", "score": 5.0, "weight_pct": 60}]'::jsonb,
          'نقاط قوة',
          'فرص تطوير',
          'ملاحظات عامة'
        );
      `);
      expect(unauthorizedSubmit.rows[0].submit_performance_review_atomic.success).toBe(false);
      expect(unauthorizedSubmit.rows[0].submit_performance_review_atomic.error).toContain("غير مصرح");

      // Authorized manager submits review
      await asUser(userManagerA);
      const authorizedSubmit = await db.query<{ submit_performance_review_atomic: any }>(`
        SELECT public.submit_performance_review_atomic(
          '${assignmentId}'::uuid,
          '[
            {"item_type": "goal", "item_id": "g-1", "score": 4.5, "weight_pct": 60, "comment": "تحقيق ممتاز للمستهدفات"},
            {"item_type": "competency", "item_id": "c-1", "score": 4.0, "weight_pct": 40, "comment": "عمل جماعي وتعاون متميز"}
          ]'::jsonb,
          'سرعة الإنجاز والابتكار التقني',
          'التوجيه والقيادة لأعضاء الفريق الجدد',
          'أداء متميز ويتجاوز التوقعات في هذا الربع'
        );
      `);

      const submitResult = authorizedSubmit.rows[0].submit_performance_review_atomic;
      expect(submitResult.success).toBe(true);
      // Weighted score: 4.5 * 0.6 + 4.0 * 0.4 = 2.7 + 1.6 = 4.30
      expect(submitResult.overall_score).toBe(4.3);
      expect(submitResult.goal_score).toBe(4.5);
      expect(submitResult.competency_score).toBe(4.0);

      // Verify review record stored in database
      const reviewRow = await db.query<{ overall_score: number; strengths_summary: string; is_locked: boolean }>(`
        SELECT overall_score, strengths_summary, is_locked
        FROM public.performance_reviews
        WHERE assignment_id = '${assignmentId}'::uuid;
      `);
      expect(reviewRow.rows.length).toBe(1);
      expect(Number(reviewRow.rows[0].overall_score)).toBe(4.3);
      expect(reviewRow.rows[0].strengths_summary).toContain("سرعة الإنجاز");
    });

    it("2.6 adjust_calibration_atomic adjusts participant scores with auditable justification", async () => {
      await asUser(userHrAdminA);

      // Create a calibration session
      const sessionRes = await db.query<{ id: string }>(`
        INSERT INTO public.calibration_sessions (
          company_id, cycle_id, department_id, title_ar, title_en, status, session_date
        ) VALUES (
          '${companyA}', '${cycleId}', '${deptAId}', 'جلسة معايرة قسم تقنية المعلومات', 'IT Calibration Session',
          'in_progress', CURRENT_DATE
        ) RETURNING id;
      `);
      const sessionId = sessionRes.rows[0].id;

      // Get participant id for Emp1
      const participantRes = await db.query<{ id: string }>(`
        SELECT id FROM public.performance_cycle_participants
        WHERE cycle_id = '${cycleId}'::uuid AND employee_id = '${emp1Id}'::uuid;
      `);
      const participantId = participantRes.rows[0].id;

      // Adjust calibration
      const adjustRes = await db.query<{ adjust_calibration_atomic: any }>(`
        SELECT public.adjust_calibration_atomic(
          '${sessionId}'::uuid,
          '${emp1Id}'::uuid,
          '${cycleId}'::uuid,
          4.5,
          'موازنة النتيجة ومطابقتها مع التوزيع المعياري المعتمد لإدارة تقنية المعلومات'
        );
      `);

      const adjustResult = adjustRes.rows[0].adjust_calibration_atomic;
      expect(adjustResult.success).toBe(true);
      expect(adjustResult.adjustment_id).toBeDefined();

      // Verify participant updated
      const participantCheck = await db.query<{ calibrated_score: number; final_rating_label: string }>(`
        SELECT calibrated_score, final_rating_label
        FROM public.performance_cycle_participants
        WHERE id = '${participantId}'::uuid;
      `);
      expect(Number(participantCheck.rows[0].calibrated_score)).toBe(4.5);
      expect(participantCheck.rows[0].final_rating_label).toContain("Exceeds");
    });

    it("2.7 assess_potential_atomic evaluates potential independently and maps accurately to 9-box cell", async () => {
      await asUser(userHrAdminA);

      const participantRes = await db.query<{ id: string }>(`
        SELECT id FROM public.performance_cycle_participants
        WHERE cycle_id = '${cycleId}'::uuid AND employee_id = '${emp1Id}'::uuid;
      `);
      const participantId = participantRes.rows[0].id;

      // High Performance (4.5) + High Potential (5.0) -> Cell '1A' (Superstars)
      const assessRes = await db.query<{ assess_potential_atomic: any }>(`
        SELECT public.assess_potential_atomic(
          '${cycleId}'::uuid,
          '${emp1Id}'::uuid,
          5.0,
          'مرشحة متميزة للقيادة وسرعة التعلم الاستثنائية'
        );
      `);

      const assessResult = assessRes.rows[0].assess_potential_atomic;
      expect(assessResult.success).toBe(true);
      expect(assessResult.nine_box_cell).toBe("1A");

      // Verify participant 9-box fields updated
      const checkPart = await db.query<{ nine_box_performance: string; nine_box_potential: string; nine_box_cell: string }>(`
        SELECT nine_box_performance, nine_box_potential, nine_box_cell
        FROM public.performance_cycle_participants
        WHERE id = '${participantId}'::uuid;
      `);
      expect(checkPart.rows[0].nine_box_performance).toBe("high");
      expect(checkPart.rows[0].nine_box_potential).toBe("high");
      expect(checkPart.rows[0].nine_box_cell).toBe("1A");
    });

    it("2.8 finalize_performance_cycle_atomic sets immutable lock on participants and finalizes cycle", async () => {
      await asUser(userHrAdminA);

      // Transition cycle to calibration first
      await db.query(`
        UPDATE public.performance_cycles
        SET status = 'calibration'
        WHERE id = '${cycleId}'::uuid;
      `);

      const finalizeRes = await db.query<{ finalize_performance_cycle_atomic: any }>(`
        SELECT public.finalize_performance_cycle_atomic('${cycleId}'::uuid);
      `);

      const finResult = finalizeRes.rows[0].finalize_performance_cycle_atomic;
      expect(finResult.success).toBe(true);
      expect(finResult.finalized_count).toBeGreaterThanOrEqual(1);

      // Verify cycle status is finalized and locked
      const cycleRow = await db.query<{ status: string; is_locked: boolean }>(`
        SELECT status, is_locked FROM public.performance_cycles WHERE id = '${cycleId}'::uuid;
      `);
      expect(cycleRow.rows[0].status).toBe("finalized");
      expect(cycleRow.rows[0].is_locked).toBe(true);

      // Verify all participants are locked
      const participantsLocked = await db.query<{ is_locked: boolean; locked_at: string }>(`
        SELECT is_locked, locked_at
        FROM public.performance_cycle_participants
        WHERE cycle_id = '${cycleId}'::uuid;
      `);
      expect(participantsLocked.rows.every((p) => p.is_locked)).toBe(true);
      expect(participantsLocked.rows.every((p) => p.locked_at !== null)).toBe(true);
    });

    it("2.9 get_performance_kpis_atomic returns real server metrics and 9-Box distribution counts", async () => {
      await asUser(userHrAdminA);

      const kpiRes = await db.query<{ get_performance_kpis_atomic: any }>(`
        SELECT public.get_performance_kpis_atomic('${cycleId}'::uuid);
      `);

      const kpis = kpiRes.rows[0].get_performance_kpis_atomic;
      expect(kpis.total_participants).toBeGreaterThanOrEqual(3);
      expect(kpis.nine_box_distribution).toBeDefined();
      expect(kpis.nine_box_distribution["1A"]).toBe(1); // Emp1 was mapped to 1A
      expect(kpis.rating_distribution).toBeDefined();
    });
  });
});
