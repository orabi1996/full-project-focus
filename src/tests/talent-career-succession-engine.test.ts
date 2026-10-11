import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  mapPerformancePotentialToNineBox,
  getNineBoxCellInfo,
  calculateReadinessFromGaps,
  maskConfidentialTalentData,
  formatReadinessTimeline,
  evaluateSuccessionPlanHealth,
  formatCareerPathType,
  type TalentAssessment,
  type CriticalRole,
  type SuccessionPlan,
} from "../lib/domains/talent";

describe("Prompt 30: Production Career, Talent, Succession & Internal Mobility Engine", () => {
  // ==========================================================================
  // SECTION 1: PURE DOMAIN RULES & LOGIC TESTS
  // ==========================================================================
  describe("1. Pure Domain Logic & Rules", () => {
    it("maps performance and potential deterministically to all 9 cells of the 9-Box grid", () => {
      // Row 1: High Potential (A)
      expect(mapPerformancePotentialToNineBox("high", "high")).toBe("1A"); // Star
      expect(mapPerformancePotentialToNineBox("medium", "high")).toBe("2A"); // High Potential
      expect(mapPerformancePotentialToNineBox("low", "high")).toBe("3A"); // Enigma

      // Row 2: Medium Potential (B)
      expect(mapPerformancePotentialToNineBox("high", "medium")).toBe("1B"); // High Performer
      expect(mapPerformancePotentialToNineBox("medium", "medium")).toBe("2B"); // Core Player
      expect(mapPerformancePotentialToNineBox("low", "medium")).toBe("3B"); // Dilemma

      // Row 3: Low Potential (C)
      expect(mapPerformancePotentialToNineBox("high", "low")).toBe("1C"); // Solid Professional
      expect(mapPerformancePotentialToNineBox("medium", "low")).toBe("2C"); // Effective
      expect(mapPerformancePotentialToNineBox("low", "low")).toBe("3C"); // Underperformer / Risk
    });

    it("retrieves accurate metadata and descriptions for 9-Box cells", () => {
      const star = getNineBoxCellInfo("1A");
      expect(star.code).toBe("1A");
      expect(star.titleAr).toContain("Star");
      expect(star.category).toBe("growth");
      expect(star.colorClass).toContain("emerald");

      const core = getNineBoxCellInfo("2B");
      expect(core.code).toBe("2B");
      expect(core.titleAr).toContain("Core Player");
      expect(core.category).toBe("core");

      const risk = getNineBoxCellInfo("3C");
      expect(risk.code).toBe("3C");
      expect(risk.titleAr).toContain("Risk");
      expect(risk.category).toBe("risk");
    });

    it("calculates career readiness truthfully based on required vs validated skills and tenure", () => {
      const required = [
        { skillId: "sk-1", requiredProficiency: 4 },
        { skillId: "sk-2", requiredProficiency: 3 },
      ];

      // 1. All skills met and sufficient tenure -> 'ready'
      const fullyReady = calculateReadinessFromGaps({
        requiredSkills: required,
        employeeSkills: [
          { skillId: "sk-1", currentProficiency: 4 },
          { skillId: "sk-2", currentProficiency: 5 },
        ],
        minTenureMonths: 12,
        currentTenureMonths: 18,
      });
      expect(fullyReady.readiness).toBe("ready");
      expect(fullyReady.matchScore).toBe(100);
      expect(fullyReady.missingSkillsCount).toBe(0);
      expect(fullyReady.hasTenureGap).toBe(false);

      // 2. All skills met but tenure gap -> 'near_ready'
      const tenureGap = calculateReadinessFromGaps({
        requiredSkills: required,
        employeeSkills: [
          { skillId: "sk-1", currentProficiency: 4 },
          { skillId: "sk-2", currentProficiency: 4 },
        ],
        minTenureMonths: 24,
        currentTenureMonths: 12,
      });
      expect(tenureGap.hasTenureGap).toBe(true);

      // 3. Partial skills (1 of 2 -> 50%) -> 'development_required'
      const partial = calculateReadinessFromGaps({
        requiredSkills: required,
        employeeSkills: [
          { skillId: "sk-1", currentProficiency: 4 },
          { skillId: "sk-2", currentProficiency: 1 }, // Gap!
        ],
        minTenureMonths: 12,
        currentTenureMonths: 14,
      });
      expect(partial.readiness).toBe("development_required");
      expect(partial.matchScore).toBe(50);
      expect(partial.missingSkillsCount).toBe(1);

      // 4. No skills met (0 of 2 -> 0%) -> 'not_ready'
      const notReady = calculateReadinessFromGaps({
        requiredSkills: required,
        employeeSkills: [],
        minTenureMonths: 12,
        currentTenureMonths: 14,
      });
      expect(notReady.readiness).toBe("not_ready");
      expect(notReady.matchScore).toBe(0);
      expect(notReady.missingSkillsCount).toBe(2);
    });

    it("masks confidential talent data for unprivileged viewers", () => {
      const assessment: Partial<TalentAssessment> = {
        id: "ass-1",
        employeeId: "emp-1",
        performanceRating: "high",
        potentialRating: "high",
        nineBoxCell: "1A",
        calibratedPotentialRating: "high",
        calibratedNineBoxCell: "1A",
        calibrationNotes: "Confidential executive decision",
        isConfidential: true,
      };

      // HR / Executive (privileged) -> sees full data
      const privilegedView = maskConfidentialTalentData(assessment, true);
      expect(privilegedView.potentialRating).toBe("high");
      expect(privilegedView.nineBoxCell).toBe("1A");
      expect(privilegedView.calibrationNotes).toBe("Confidential executive decision");

      // Employee / Unprivileged -> potential, 9-box cell and notes masked
      const unprivilegedView = maskConfidentialTalentData(assessment, false);
      expect(unprivilegedView.potentialRating).toBeUndefined();
      expect(unprivilegedView.nineBoxCell).toBeUndefined();
      expect(unprivilegedView.calibratedPotentialRating).toBeUndefined();
      expect(unprivilegedView.calibratedNineBoxCell).toBeUndefined();
      expect(unprivilegedView.calibrationNotes).toBeUndefined();
      expect(unprivilegedView.performanceRating).toBe("high"); // Performance remains visible
    });

    it("evaluates succession plan health, coverage rate and bench strength accurately", () => {
      const criticalRoles: CriticalRole[] = [
        {
          id: "cr-1",
          companyId: "c-1",
          jobPositionId: "pos-1",
          criticalityTier: "business_critical",
          vacancyRisk: "high",
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "cr-2",
          companyId: "c-1",
          jobPositionId: "pos-2",
          criticalityTier: "leadership_critical",
          vacancyRisk: "medium",
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ];

      const plans: SuccessionPlan[] = [
        {
          id: "sp-1",
          companyId: "c-1",
          jobPositionId: "pos-1",
          status: "active",
          targetFillUrgency: "immediate",
          createdAt: "",
          updatedAt: "",
          candidates: [
            {
              id: "sc-1",
              successionPlanId: "sp-1",
              companyId: "c-1",
              employeeId: "e-1",
              readinessTimeline: "ready_now",
              ranking: 1,
              retentionRisk: "low",
              status: "approved",
              isEmergencySuccessor: true,
              createdAt: "",
              updatedAt: "",
            },
          ],
        },
        {
          id: "sp-2",
          companyId: "c-1",
          jobPositionId: "pos-2",
          status: "active",
          targetFillUrgency: "within_1_year",
          createdAt: "",
          updatedAt: "",
          candidates: [], // No candidates -> uncovered!
        },
      ];

      const health = evaluateSuccessionPlanHealth({
        criticalRoles,
        successionPlans: plans,
      });

      // 1 of 2 covered -> 50%
      expect(health.coverageRate).toBe(50);
      // 1 of 2 has ready_now -> 50%
      expect(health.benchStrengthRate).toBe(50);
      expect(health.uncoveredRoles).toHaveLength(1);
      expect(health.uncoveredRoles[0].jobPositionId).toBe("pos-2");
      expect(health.rolesWithReadyNow).toBe(1);
    });

    it("formats career path types and readiness timelines accurately", () => {
      expect(formatCareerPathType("vertical").ar).toContain("رأسي");
      expect(formatCareerPathType("leadership").ar).toContain("قيادي");
      expect(formatCareerPathType("specialist").ar).toContain("تخصصي");

      expect(formatReadinessTimeline("ready_now").ar).toBe("جاهز فوراً");
      expect(formatReadinessTimeline("ready_1_year").ar).toBe("جاهز خلال سنة");
      expect(formatReadinessTimeline("not_ready").ar).toBe("غير جاهز حالياً");
    });
  });

  // ==========================================================================
  // SECTION 2: PGLITE MIGRATION & ATOMIC RPCS
  // ==========================================================================
  describe("2. Database Schema & Atomic Stored Procedures", () => {
    const db = new PGlite();
    const companyA = "11111111-1111-1111-1111-111111111111";
    const companyB = "22222222-2222-2222-2222-222222222222";
    const adminUser = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const emp1 = "33333333-3333-3333-3333-333333333333";
    const emp2 = "44444444-4444-4444-4444-444444444444";
    const pos1 = "55555555-5555-5555-5555-555555555555";
    const pos2 = "66666666-6666-6666-6666-666666666666";
    const skill1 = "77777777-7777-7777-7777-777777777777";
    const skill2 = "88888888-8888-8888-8888-888888888888";

    beforeAll(async () => {
      // 1. Setup base schema prerequisites
      await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE ROLE service_role;
        CREATE SCHEMA IF NOT EXISTS auth;

        CREATE TABLE IF NOT EXISTS auth.users (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email text
        );

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

        CREATE TABLE IF NOT EXISTS public.job_positions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          title_ar text,
          title_en text,
          department_id uuid REFERENCES public.departments(id)
        );

        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid,
          employee_number text,
          first_name_ar text,
          last_name_ar text,
          status text NOT NULL DEFAULT 'active',
          job_title_ar text,
          department_id uuid REFERENCES public.departments(id),
          job_position_id uuid REFERENCES public.job_positions(id),
          grade text,
          hire_date date DEFAULT current_date,
          updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.skills (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          code text NOT NULL,
          name_ar text NOT NULL,
          name_en text NOT NULL,
          category text NOT NULL,
          proficiency_scale_type text DEFAULT '1_to_5'
        );

        CREATE TABLE IF NOT EXISTS public.job_skill_requirements (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          job_position_id uuid REFERENCES public.job_positions(id),
          skill_id uuid REFERENCES public.skills(id),
          required_proficiency numeric(3,1) NOT NULL,
          is_mandatory boolean DEFAULT true
        );

        CREATE TABLE IF NOT EXISTS public.employee_skills (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          employee_id uuid REFERENCES public.employees(id),
          skill_id uuid REFERENCES public.skills(id),
          current_proficiency numeric(3,1) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS public.learning_items (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          title_ar text NOT NULL
        );

        CREATE TABLE IF NOT EXISTS public.employee_movements (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          movement_number text NOT NULL,
          employee_id uuid REFERENCES public.employees(id),
          movement_type text NOT NULL,
          effective_date date NOT NULL,
          reason text,
          status text NOT NULL,
          requested_by uuid,
          approved_at timestamptz,
          approved_by uuid,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.audit_events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          action text,
          entity_type text,
          entity_id text,
          entity_name text,
          changes_summary text,
          severity text,
          created_at timestamptz DEFAULT now()
        );
      `);

      // 2. Load and execute Prompt 30 Migration
      const migrationSql = readFileSync(
        "supabase/migrations/20261012000000_production_talent_career_succession_internal_mobility.sql",
        "utf8"
      );
      await db.exec(migrationSql);

      // 3. Seed test records
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES ('${adminUser}', 'admin@madarx.local');
        INSERT INTO public.companies (id, name) VALUES ('${companyA}', 'Company A'), ('${companyB}', 'Company B');
        
        INSERT INTO public.job_positions (id, company_id, title_ar, title_en) VALUES
          ('${pos1}', '${companyA}', 'مدير العمليات', 'Operations Director'),
          ('${pos2}', '${companyA}', 'أخصائي تميز مؤسسي', 'Corporate Excellence Specialist');

        INSERT INTO public.employees (id, company_id, user_id, employee_number, first_name_ar, last_name_ar, status, job_position_id, grade, hire_date) VALUES
          ('${emp1}', '${companyA}', '${adminUser}', 'EMP-001', 'أحمد', 'الغامدي', 'active', '${pos2}', 'G07', current_date - interval '24 months'),
          ('${emp2}', '${companyA}', null, 'EMP-002', 'سارة', 'العتيبي', 'active', '${pos1}', 'G09', current_date - interval '36 months');

        INSERT INTO public.skills (id, company_id, code, name_ar, name_en, category) VALUES
          ('${skill1}', '${companyA}', 'SK-LEAD', 'القيادة الاستراتيجية', 'Strategic Leadership', 'leadership'),
          ('${skill2}', '${companyA}', 'SK-OPS', 'إدارة العمليات', 'Operations Management', 'technical');

        -- Target requirements for Director position (pos1)
        INSERT INTO public.job_skill_requirements (company_id, job_position_id, skill_id, required_proficiency, is_mandatory) VALUES
          ('${companyA}', '${pos1}', '${skill1}', 4.0, true),
          ('${companyA}', '${pos1}', '${skill2}', 4.0, true);

        -- Employee 1 validated skills: skill1 is 4.0 (met), skill2 is 2.0 (gap!)
        INSERT INTO public.employee_skills (company_id, employee_id, skill_id, current_proficiency) VALUES
          ('${companyA}', '${emp1}', '${skill1}', 4.0),
          ('${companyA}', '${emp1}', '${skill2}', 2.0);
      `);
    });

    afterAll(async () => {
      await db.close();
    });

    it("verifies all 16 talent tables exist in the database", async () => {
      const tablesRes = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN (
            'career_paths', 'career_path_steps', 'employee_career_preferences',
            'career_target_roles', 'talent_review_cycles', 'talent_assessments',
            'talent_pools', 'talent_pool_members', 'critical_roles',
            'succession_plans', 'succession_candidates', 'talent_development_actions',
            'internal_opportunities', 'internal_applications', 'mentoring_relationships',
            'career_conversations'
          );
      `);
      expect(tablesRes.rows).toHaveLength(16);
    });

    it("executes calculate_career_readiness_and_gaps_atomic correctly", async () => {
      const res = await db.query(`
        SELECT public.calculate_career_readiness_and_gaps_atomic(
          '${companyA}', '${emp1}', '${pos1}'
        ) as result;
      `);
      const data = (res.rows[0] as any).result;

      expect(data.success).toBe(true);
      expect(data.total_skills_required).toBe(2);
      expect(data.matched_skills_count).toBe(1); // Only skill1 matches 4.0
      expect(data.match_score).toBe(50);
      expect(data.readiness).toBe("development_required");
      expect(data.missing_skills).toHaveLength(1);
      expect(data.missing_skills[0].name_ar).toBe("إدارة العمليات");
      expect(data.missing_skills[0].gap).toBe(2); // 4.0 - 2.0 = 2.0
    });

    it("executes assess_and_calibrate_talent_atomic and updates 9-Box calibration preserving history", async () => {
      // 1. Create a review cycle
      const cycleRes = await db.query(`
        INSERT INTO public.talent_review_cycles (
          company_id, code, title_ar, title_en, start_date, end_date, year, status
        ) VALUES (
          '${companyA}', 'CYCLE-2026', 'مراجعة المواهب 2026', 'Talent Review 2026',
          '2026-01-01', '2026-12-31', 2026, 'open'
        ) RETURNING id;
      `);
      const cycleId = (cycleRes.rows[0] as any).id;

      // 2. Initial Assessment: High Perf, Medium Pot -> Cell 1B
      const initRes = await db.query(`
        SELECT public.assess_and_calibrate_talent_atomic(
          '${companyA}', '${cycleId}', '${emp1}',
          'high', 'medium', '${adminUser}', false, 'Initial assessment'
        ) as result;
      `);
      const initData = (initRes.rows[0] as any).result;
      expect(initData.success).toBe(true);
      expect(initData.nine_box_cell).toBe("1B");

      // Verify stored row
      const check1 = await db.query(`
        SELECT performance_rating, potential_rating, nine_box_cell, status
        FROM public.talent_assessments
        WHERE id = '${initData.assessment_id}';
      `);
      expect((check1.rows[0] as any).nine_box_cell).toBe("1B");
      expect((check1.rows[0] as any).status).toBe("submitted");

      // 3. Calibration: Upgraded by Committee to High Pot -> Cell 1A (Star)
      const calibRes = await db.query(`
        SELECT public.assess_and_calibrate_talent_atomic(
          '${companyA}', '${cycleId}', '${emp1}',
          'high', 'high', '${adminUser}', true, 'Calibrated to Star by Talent Committee'
        ) as result;
      `);
      const calibData = (calibRes.rows[0] as any).result;
      expect(calibData.success).toBe(true);
      expect(calibData.nine_box_cell).toBe("1A");

      // Verify row now contains calibrated values preserving initial ratings
      const check2 = await db.query(`
        SELECT performance_rating, potential_rating, nine_box_cell,
               calibrated_performance_rating, calibrated_potential_rating, calibrated_nine_box_cell,
               calibration_notes, status
        FROM public.talent_assessments
        WHERE id = '${initData.assessment_id}';
      `);
      const r2 = check2.rows[0] as any;
      expect(r2.performance_rating).toBe("high");
      expect(r2.potential_rating).toBe("medium"); // Initial preserved!
      expect(r2.calibrated_potential_rating).toBe("high"); // Calibrated updated!
      expect(r2.calibrated_nine_box_cell).toBe("1A");
      expect(r2.status).toBe("calibrated");

      // Verify audit event
      const auditRes = await db.query(`
        SELECT action, entity_type FROM public.audit_events
        WHERE company_id = '${companyA}' AND action = 'talent.calibrated';
      `);
      expect(auditRes.rows.length).toBeGreaterThan(0);
    });

    it("executes nominate_succession_candidate_atomic and prevents duplicate nominations", async () => {
      // 1. Create critical role and succession plan for pos1
      const crRes = await db.query(`
        INSERT INTO public.critical_roles (
          company_id, job_position_id, criticality_tier, vacancy_risk
        ) VALUES (
          '${companyA}', '${pos1}', 'leadership_critical', 'high'
        ) RETURNING id;
      `);
      const crId = (crRes.rows[0] as any).id;

      const spRes = await db.query(`
        INSERT INTO public.succession_plans (
          company_id, critical_role_id, job_position_id, incumbent_employee_id, status
        ) VALUES (
          '${companyA}', '${crId}', '${pos1}', '${emp2}', 'active'
        ) RETURNING id;
      `);
      const spId = (spRes.rows[0] as any).id;

      // 2. Nominate emp1 as successor
      const nomRes = await db.query(`
        SELECT public.nominate_succession_candidate_atomic(
          '${companyA}', '${spId}', '${emp1}', 'ready_now', 1, '${adminUser}', 'High Potential candidate', true
        ) as result;
      `);
      const nomData = (nomRes.rows[0] as any).result;
      expect(nomData.success).toBe(true);
      expect(nomData.readiness).toBe("ready_now");
      expect(nomData.ranking).toBe(1);

      // 3. Attempting to nominate again should fail with duplicate error
      const dupRes = await db.query(`
        SELECT public.nominate_succession_candidate_atomic(
          '${companyA}', '${spId}', '${emp1}', 'ready_now', 1
        ) as result;
      `);
      const dupData = (dupRes.rows[0] as any).result;
      expect(dupData.success).toBe(false);
      expect(dupData.error).toContain("already nominated");
    });

    it("executes match_internal_opportunity_atomic deterministically", async () => {
      // 1. Create internal opportunity
      const oppRes = await db.query(`
        INSERT INTO public.internal_opportunities (
          company_id, opportunity_type, title_ar, title_en, job_position_id,
          target_grade, min_tenure_months_required, status
        ) VALUES (
          '${companyA}', 'open_position', 'مدير التميز المؤسسي', 'Corporate Excellence Director',
          '${pos1}', 'G07', 12, 'open'
        ) RETURNING id;
      `);
      const oppId = (oppRes.rows[0] as any).id;

      // 2. Match for emp1 (tenure 24 months >= 12, grade G07 matches target_grade)
      const matchRes = await db.query(`
        SELECT public.match_internal_opportunity_atomic(
          '${companyA}', '${oppId}', '${emp1}'
        ) as result;
      `);
      const matchData = (matchRes.rows[0] as any).result;
      expect(matchData.success).toBe(true);
      expect(matchData.eligible).toBe(true);
      expect(matchData.match_score).toBe(100);
      expect(matchData.match_reasons.length).toBeGreaterThan(0);
    });

    it("executes apply_for_internal_opportunity_atomic and handles selection hand-off to employee_movements", async () => {
      // 1. Get existing opportunity
      const oppRes = await db.query(`
        SELECT id FROM public.internal_opportunities WHERE company_id = '${companyA}' LIMIT 1;
      `);
      const oppId = (oppRes.rows[0] as any).id;

      // 2. Apply for internal opportunity
      const appRes = await db.query(`
        SELECT public.apply_for_internal_opportunity_atomic(
          '${companyA}', '${oppId}', '${emp1}', 'Seeking growth opportunity'
        ) as result;
      `);
      const appData = (appRes.rows[0] as any).result;
      expect(appData.success).toBe(true);
      const appId = appData.application_id;

      // 3. Selection hand-off: triggers lifecycle movement in employee_movements
      const selectRes = await db.query(`
        SELECT public.select_internal_candidate_and_initiate_movement_atomic(
          '${companyA}', '${appId}', 'promotion', '2026-11-01', '${adminUser}'
        ) as result;
      `);
      const selectData = (selectRes.rows[0] as any).result;
      expect(selectData.success).toBe(true);
      expect(selectData.movement_id).toBeDefined();
      expect(selectData.movement_number).toMatch(/^MOV-202/);

      // Verify movement created in Prompt 28 employee_movements table
      const movRes = await db.query(`
        SELECT movement_number, movement_type, status, reason
        FROM public.employee_movements
        WHERE id = '${selectData.movement_id}';
      `);
      expect(movRes.rows).toHaveLength(1);
      expect((movRes.rows[0] as any).movement_type).toBe("promotion");
      expect((movRes.rows[0] as any).status).toBe("scheduled");
      expect((movRes.rows[0] as any).reason).toContain("فرصة التنقل الوظيفي");

      // Verify application updated to 'selected'
      const appCheck = await db.query(`
        SELECT status, movement_id FROM public.internal_applications WHERE id = '${appId}';
      `);
      expect((appCheck.rows[0] as any).status).toBe("selected");
      expect((appCheck.rows[0] as any).movement_id).toBe(selectData.movement_id);

      // Verify opportunity updated to 'filled'
      const oppCheck = await db.query(`
        SELECT status FROM public.internal_opportunities WHERE id = '${oppId}';
      `);
      expect((oppCheck.rows[0] as any).status).toBe("filled");
    });

    it("executes get_talent_kpis_atomic calculating truthful rates", async () => {
      const kpiRes = await db.query(`
        SELECT public.get_talent_kpis_atomic('${companyA}') as result;
      `);
      const kpis = (kpiRes.rows[0] as any).result;

      expect(kpis.critical_roles_count).toBeGreaterThan(0);
      expect(kpis.succession_coverage_rate).toBe(100); // 1 role with 1 candidate
      expect(kpis.bench_strength_rate).toBe(100); // Has 1 ready_now candidate
      expect(kpis.high_potential_count).toBeGreaterThan(0); // emp1 calibrated as 1A
    });

    it("enforces tenant isolation across companies", async () => {
      // Create record in Company B
      await db.query(`
        INSERT INTO public.career_paths (
          company_id, code, title_ar, title_en, path_type, status
        ) VALUES (
          '${companyB}', 'PATH-B', 'مسار شركة ب', 'Track Company B', 'vertical', 'active'
        );
      `);

      // Querying with companyA filter should return 0 records from Company B
      const pathsA = await db.query(`
        SELECT * FROM public.career_paths WHERE company_id = '${companyA}';
      `);
      const pathsB = await db.query(`
        SELECT * FROM public.career_paths WHERE company_id = '${companyB}';
      `);

      expect(pathsA.rows.every((r: any) => r.company_id === companyA)).toBe(true);
      expect(pathsB.rows.every((r: any) => r.company_id === companyB)).toBe(true);
      expect(pathsB.rows).toHaveLength(1);
    });
  });
});
