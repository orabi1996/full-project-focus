import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  calculateEnps,
  classifyEnpsScore,
  calculateFavorability,
  evaluateAnonymityThreshold,
  sanitizeAnonymousComment,
  formatSurveyStatus,
  formatSurveyType,
  formatDimensionName,
  formatActionPlanStatus,
  formatCampaignType,
} from "../lib/domains/engagement";

describe("Prompt 31: Production Employee Engagement, Surveys, Pulse & Recognition Engine", () => {
  // ==========================================================================
  // SECTION 1: PURE DOMAIN RULES & LOGIC TESTS
  // ==========================================================================
  describe("1. Pure Domain Logic & Rules", () => {
    it("calculates eNPS accurately according to the enterprise standard formula (% Promoters - % Detractors)", () => {
      // 100% Promoters (9-10) -> +100
      expect(calculateEnps(10, 0, 0)).toBe(100);

      // 100% Detractors (0-6) -> -100
      expect(calculateEnps(0, 0, 10)).toBe(-100);

      // 100% Passives (7-8) -> 0
      expect(calculateEnps(0, 10, 0)).toBe(0);

      // Mixed: 5 Promoters (50%), 2 Passives (20%), 3 Detractors (30%) -> 50 - 30 = +20.00
      expect(calculateEnps(5, 2, 3)).toBe(20);

      // Mixed: 3 Promoters (30%), 1 Passive (10%), 6 Detractors (60%) -> 30 - 60 = -30.00
      expect(calculateEnps(3, 1, 6)).toBe(-30);

      // 0 total responses -> 0
      expect(calculateEnps(0, 0, 0)).toBe(0);
    });

    it("classifies individual eNPS scores truthfully into promoter, passive, or detractor", () => {
      expect(classifyEnpsScore(10)).toBe("promoter");
      expect(classifyEnpsScore(9)).toBe("promoter");
      expect(classifyEnpsScore(8)).toBe("passive");
      expect(classifyEnpsScore(7)).toBe("passive");
      expect(classifyEnpsScore(6)).toBe("detractor");
      expect(classifyEnpsScore(3)).toBe("detractor");
      expect(classifyEnpsScore(0)).toBe("detractor");
    });

    it("calculates favorability rate accurately across Likert and numeric scales", () => {
      const answers: any[] = [
        { valueNumeric: 5, questionType: "likert_scale" }, // Favorable (5)
        { valueNumeric: 4, questionType: "likert_scale" }, // Favorable (4)
        { valueNumeric: 3, questionType: "likert_scale" }, // Neutral (3)
        { valueNumeric: 2, questionType: "likert_scale" }, // Unfavorable (2)
        { valueNumeric: 9, questionType: "enps_0_10" },    // Favorable (>=8)
      ];

      // 3 favorable out of 5 = 60.00%
      expect(calculateFavorability(answers)).toBe(60);

      // Empty answers -> 0
      expect(calculateFavorability([])).toBe(0);
    });

    it("enforces anonymity suppression threshold for cohorts smaller than minimum size", () => {
      // 4 responses with threshold 5 -> Suppressed!
      const suppressed = evaluateAnonymityThreshold(4, 5);
      expect(suppressed.isSuppressed).toBe(true);
      expect(suppressed.reason).toContain("أقل من حد حماية الخصوصية الأدنى");

      // 5 responses with threshold 5 -> Safe to report
      const safe = evaluateAnonymityThreshold(5, 5);
      expect(safe.isSuppressed).toBe(false);
      expect(safe.reason).toBeUndefined();

      // 12 responses -> Safe
      expect(evaluateAnonymityThreshold(12, 5).isSuppressed).toBe(false);
    });

    it("sanitizes free-text comments in anonymous mode to prevent accidental re-identification", () => {
      const textWithEmailAndPhone =
        "أشكر فريق العمل، للتواصل معي عبر ahmed.hr@madarx.com أو الاتصال على 0501234567 للاستيضاح.";

      // In anonymous mode, contact identifiers are sanitized
      const sanitized = sanitizeAnonymousComment(textWithEmailAndPhone, true);
      expect(sanitized).not.toContain("ahmed.hr@madarx.com");
      expect(sanitized).toContain("[تم حجب البريد للسرية]");
      expect(sanitized).toContain("[تم حجب الرقم للسرية]");

      // In identified mode, contact details are kept
      const raw = sanitizeAnonymousComment(textWithEmailAndPhone, false);
      expect(raw).toBe(textWithEmailAndPhone);
    });

    it("formats status, types and dimension presentations correctly", () => {
      expect(formatSurveyStatus("open").labelAr).toBe("مفتوح ومستمر");
      expect(formatSurveyStatus("draft").labelAr).toBe("مسودة");
      expect(formatSurveyType("enps").labelAr).toContain("مؤشر ولاء الموظفين");
      expect(formatSurveyType("pulse").labelAr).toContain("نبض السريع");
      expect(formatDimensionName("culture").labelAr).toContain("الثقافة");
      expect(formatActionPlanStatus("completed").labelAr).toBe("مكتملة");
      expect(formatCampaignType("employee_of_month").labelAr).toContain("موظف الشهر");
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
    const deptEngineering = "33333333-3333-3333-3333-333333333333";
    const deptHR = "44444444-4444-4444-4444-444444444444";
    const emp1 = "55555555-5555-5555-5555-555555555555";
    const emp2 = "66666666-6666-6666-6666-666666666666";
    const emp3 = "77777777-7777-7777-7777-777777777777";
    const emp4 = "88888888-8888-8888-8888-888888888888";
    const emp5 = "99999999-9999-9999-9999-999999999999";
    const emp6 = "00000000-0000-0000-0000-000000000001";

    beforeAll(async () => {
      // 1. Base prerequisites schema
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

        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid,
          employee_number text,
          first_name_ar text,
          last_name_ar text,
          status text NOT NULL DEFAULT 'active',
          department_id uuid REFERENCES public.departments(id),
          job_title_ar text,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.audit_events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          action text NOT NULL,
          entity_type text NOT NULL,
          entity_id text NOT NULL,
          entity_name text,
          changes_summary text,
          severity text NOT NULL DEFAULT 'info',
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      // 2. Load and run Prompt 31 Migration SQL
      const migrationSql = readFileSync(
        "supabase/migrations/20261013000000_production_engagement_surveys_recognition_engine.sql",
        "utf8"
      );
      await db.exec(migrationSql);

      // 3. Seed Companies, Departments, and Employees
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES
          ('${adminUser}', 'admin@madarx.local');

        INSERT INTO public.companies (id, name) VALUES
          ('${companyA}', 'شركة مدار إكس للتقنية'),
          ('${companyB}', 'شركة أخرى منافسة');

        INSERT INTO public.departments (id, company_id, name_ar, name_en) VALUES
          ('${deptEngineering}', '${companyA}', 'إدارة الهندسة والبرمجيات', 'Engineering'),
          ('${deptHR}', '${companyA}', 'إدارة الموارد البشرية', 'Human Resources');

        -- 5 active employees in Engineering, 1 in HR
        INSERT INTO public.employees (id, company_id, employee_number, first_name_ar, last_name_ar, status, department_id, job_title_ar) VALUES
          ('${emp1}', '${companyA}', 'EMP-001', 'أحمد', 'المنصور', 'active', '${deptEngineering}', 'مهندس برمجيات'),
          ('${emp2}', '${companyA}', 'EMP-002', 'سارة', 'العتيبي', 'active', '${deptEngineering}', 'مهندسة جودة'),
          ('${emp3}', '${companyA}', 'EMP-003', 'خالد', 'الغامدي', 'active', '${deptEngineering}', 'مهندس بنية تحتية'),
          ('${emp4}', '${companyA}', 'EMP-004', 'نورة', 'القحطاني', 'active', '${deptEngineering}', 'مصممة واجهات'),
          ('${emp5}', '${companyA}', 'EMP-005', 'فهد', 'السبيعي', 'active', '${deptEngineering}', 'مطور واجهات'),
          ('${emp6}', '${companyA}', 'EMP-006', 'ريم', 'الشهري', 'active', '${deptHR}', 'أخصائية موارد بشرية');
      `);
    });

    afterAll(async () => {
      await db.close();
    });

    it("launches a survey instance atomically, snapshots active participants, and blinds anonymity tokens", async () => {
      // 1. Create a survey template and instance
      const tplRes = await db.query(`
        INSERT INTO public.survey_templates (
          company_id, code, title_ar, title_en, survey_type, default_anonymity_mode
        ) VALUES (
          '${companyA}', 'TPL-ENG-01', 'استبيان الارتباط السنوي', 'Annual Engagement Survey', 'engagement', 'anonymous'
        ) RETURNING id;
      `);
      const templateId = (tplRes.rows[0] as any).id;

      const instRes = await db.query(`
        INSERT INTO public.survey_instances (
          company_id, code, title_ar, title_en, survey_type, anonymity_mode, minimum_reporting_group_size, status
        ) VALUES (
          '${companyA}', 'SRV-ENG-2026', 'نبض المنشأة السنوي 2026', '2026 Engagement Pulse', 'engagement', 'anonymous', 5, 'draft'
        ) RETURNING id;
      `);
      const surveyId = (instRes.rows[0] as any).id;

      // 2. Launch survey via RPC
      const launchRes = await db.query(`
        SELECT public.launch_survey_instance_atomic(
          '${companyA}'::uuid,
          '${surveyId}'::uuid,
          '${adminUser}'::uuid
        ) AS result;
      `);

      const resObj = (launchRes.rows[0] as any).result;
      expect(resObj.success).toBe(true);
      expect(resObj.eligible_count).toBe(6); // 6 active employees

      // Verify survey instance is now open
      const surveyCheck = await db.query(`
        SELECT status, published_at FROM public.survey_instances WHERE id = '${surveyId}';
      `);
      expect((surveyCheck.rows[0] as any).status).toBe("open");
      expect((surveyCheck.rows[0] as any).published_at).not.toBeNull();

      // Verify participants were created with unique blinded tokens
      const parts = await db.query(`
        SELECT id, employee_id, anonymity_token, participation_status, department_snapshot_id
        FROM public.survey_participants WHERE survey_id = '${surveyId}';
      `);
      expect(parts.rows).toHaveLength(6);
      for (const p of parts.rows as any[]) {
        expect(p.participation_status).toBe("eligible");
        expect(p.anonymity_token).toBeTruthy();
        expect(p.department_snapshot_id).toBeTruthy();
      }

      // Verify audit event was logged
      const audit = await db.query(`
        SELECT action, entity_type FROM public.audit_events
        WHERE company_id = '${companyA}' AND action = 'engagement.survey_launched';
      `);
      expect(audit.rows.length).toBeGreaterThanOrEqual(1);
    });

    it("submits responses anonymously with NULL employee_id and prevents duplicate submission", async () => {
      // Find open survey
      const srv = await db.query(`
        SELECT id FROM public.survey_instances WHERE code = 'SRV-ENG-2026' LIMIT 1;
      `);
      const surveyId = (srv.rows[0] as any).id;

      // Get participant token for emp1
      const part = await db.query(`
        SELECT anonymity_token FROM public.survey_participants
        WHERE survey_id = '${surveyId}' AND employee_id = '${emp1}' LIMIT 1;
      `);
      const token = (part.rows[0] as any).anonymity_token;

      // Submit response with Likert scale answers & eNPS score
      const answersJson = JSON.stringify([
        { question_code: "Q1", category: "culture", question_type: "likert_scale", value_numeric: 5 },
        { question_code: "Q2", category: "manager", question_type: "likert_scale", value_numeric: 4 },
        { question_code: "Q3", category: "trust", question_type: "enps_0_10", value_numeric: 10 },
      ]);

      const submitRes = await db.query(`
        SELECT public.submit_survey_response_atomic(
          '${companyA}'::uuid,
          '${surveyId}'::uuid,
          '${token}',
          '${answersJson}'::jsonb,
          false
        ) AS result;
      `);

      const subObj = (submitRes.rows[0] as any).result;
      expect(subObj.success).toBe(true);

      // Verify response record: employee_id MUST BE NULL in anonymous mode!
      const respRecord = await db.query(`
        SELECT id, employee_id, status, department_id FROM public.survey_responses
        WHERE id = '${subObj.response_id}';
      `);
      expect((respRecord.rows[0] as any).employee_id).toBeNull();
      expect((respRecord.rows[0] as any).status).toBe("submitted");
      expect((respRecord.rows[0] as any).department_id).toBe(deptEngineering);

      // Verify participant record marked completed
      const partUpdated = await db.query(`
        SELECT participation_status, completed_at FROM public.survey_participants
        WHERE survey_id = '${surveyId}' AND employee_id = '${emp1}';
      `);
      expect((partUpdated.rows[0] as any).participation_status).toBe("completed");

      // Verify second submission with same token is rejected
      const dupSubmit = await db.query(`
        SELECT public.submit_survey_response_atomic(
          '${companyA}'::uuid,
          '${surveyId}'::uuid,
          '${token}',
          '${answersJson}'::jsonb,
          false
        ) AS result;
      `);
      expect((dupSubmit.rows[0] as any).result.success).toBe(false);
      expect((dupSubmit.rows[0] as any).result.error).toContain("already been submitted");
    });

    it("calculates survey analytics, eNPS, and suppresses small departmental groups below threshold", async () => {
      const srv = await db.query(`
        SELECT id FROM public.survey_instances WHERE code = 'SRV-ENG-2026' LIMIT 1;
      `);
      const surveyId = (srv.rows[0] as any).id;

      // Submit responses for emp2, emp3, emp4, emp5 (all in Engineering -> total 5 responses)
      // And emp6 (in HR -> only 1 response)
      const empIds = [emp2, emp3, emp4, emp5, emp6];
      const enpsScores = [9, 8, 4, 10, 7]; // 9 (promoter), 8 (passive), 4 (detractor), 10 (promoter), 7 (passive)
      // Including emp1's 10 (promoter), total eNPS scores across 6 responses:
      // Promoters: emp1(10), emp2(9), emp5(10) = 3
      // Passives: emp3(8), emp6(7) = 2
      // Detractors: emp4(4) = 1
      // Total = 6. Promoters % = 50%, Detractors % = 16.67% -> eNPS = 33.33%

      for (let i = 0; i < empIds.length; i++) {
        const eId = empIds[i];
        const token = (
          await db.query(`
            SELECT anonymity_token FROM public.survey_participants
            WHERE survey_id = '${surveyId}' AND employee_id = '${eId}';
          `)
        ).rows[0] as any;

        const answersJson = JSON.stringify([
          { question_code: "Q1", category: "culture", question_type: "likert_scale", value_numeric: 4 },
          { question_code: "Q2", category: "manager", question_type: "likert_scale", value_numeric: 4 },
          { question_code: "Q3", category: "trust", question_type: "enps_0_10", value_numeric: enpsScores[i] },
        ]);

        await db.query(`
          SELECT public.submit_survey_response_atomic(
            '${companyA}'::uuid,
            '${surveyId}'::uuid,
            '${token.anonymity_token}',
            '${answersJson}'::jsonb,
            false
          );
        `);
      }

      // Trigger analytics calculation via RPC
      const analyticsRes = await db.query(`
        SELECT public.calculate_survey_analytics_atomic(
          '${companyA}'::uuid,
          '${surveyId}'::uuid
        ) AS result;
      `);

      const calc = (analyticsRes.rows[0] as any).result;
      expect(calc.success).toBe(true);
      expect(calc.eligible_count).toBe(6);
      expect(calc.completed_count).toBe(6);
      expect(calc.participation_rate).toBe(100.0);
      expect(calc.promoters).toBe(3);
      expect(calc.passives).toBe(2);
      expect(calc.detractors).toBe(1);
      expect(calc.enps).toBe(33.33);

      // Verify Department Privacy Suppression Threshold!
      // Engineering has 5 responses >= threshold (5) -> suppressed: false
      // HR has 1 response < threshold (5) -> suppressed: true!
      const depts = calc.department_scores;
      const engScore = depts.find((d: any) => d.department_id === deptEngineering);
      const hrScore = depts.find((d: any) => d.department_id === deptHR);

      expect(engScore).toBeDefined();
      expect(engScore.response_count).toBe(5);
      expect(engScore.suppressed).toBe(false);
      expect(engScore.score).not.toBeNull();

      expect(hrScore).toBeDefined();
      expect(hrScore.response_count).toBe(1);
      expect(hrScore.suppressed).toBe(true); // Small-group suppression enforced!
      expect(hrScore.score).toBeNull();
      expect(hrScore.suppression_reason).toContain("أقل من حد السرية الأدنى");
    });

    it("sends employee recognition, validates distinct sender/recipient, and creates recognition records", async () => {
      // 1. Create a recognition category and badge
      const catRes = await db.query(`
        INSERT INTO public.recognition_categories (
          company_id, code, name_ar, name_en, icon_name, color
        ) VALUES (
          '${companyA}', 'VAL_CHAMP', 'سفير قيم المنشأة', 'Values Champion', 'star', '#10B981'
        ) RETURNING id;
      `);
      const catId = (catRes.rows[0] as any).id;

      const badgeRes = await db.query(`
        INSERT INTO public.recognition_badges (
          company_id, code, name_ar, name_en, category_id, icon_name
        ) VALUES (
          '${companyA}', 'BDG_INNOVATE', 'وسام الابتكار التقني', 'Innovation Badge', '${catId}', 'award'
        ) RETURNING id;
      `);
      const badgeId = (badgeRes.rows[0] as any).id;

      // 2. Self-recognition must be rejected
      const selfRes = await db.query(`
        SELECT public.send_employee_recognition_atomic(
          '${companyA}'::uuid,
          '${emp1}'::uuid,
          '${emp1}'::uuid,
          '${catId}'::uuid,
          '${badgeId}'::uuid,
          'أشكر نفسي'
        ) AS result;
      `);
      expect((selfRes.rows[0] as any).result.success).toBe(false);
      expect((selfRes.rows[0] as any).result.error).toContain("cannot recognize themselves");

      // 3. Valid peer recognition from emp1 to emp2
      const validRes = await db.query(`
        SELECT public.send_employee_recognition_atomic(
          '${companyA}'::uuid,
          '${emp1}'::uuid,
          '${emp2}'::uuid,
          '${catId}'::uuid,
          '${badgeId}'::uuid,
          'شكراً سارة على جهودك الاستثنائية في إطلاق نظام الجودة في الوقت المحدد!',
          'company'
        ) AS result;
      `);
      expect((validRes.rows[0] as any).result.success).toBe(true);

      const recogId = (validRes.rows[0] as any).result.recognition_id;
      const checkRecog = await db.query(`
        SELECT message, visibility, status FROM public.employee_recognitions
        WHERE id = '${recogId}';
      `);
      expect((checkRecog.rows[0] as any).status).toBe("published");
      expect((checkRecog.rows[0] as any).visibility).toBe("company");
    });

    it("creates campaigns, nominates candidates, and prevents duplicate nominations", async () => {
      // 1. Create a recognition campaign (Employee of the Month)
      const campRes = await db.query(`
        INSERT INTO public.recognition_campaigns (
          company_id, code, title_ar, title_en, campaign_type, start_date, end_date, status
        ) VALUES (
          '${companyA}', 'EOM-OCT-2026', 'موظف الشهر - أكتوبر 2026', 'Employee of the Month',
          'employee_of_month', '2026-10-01', '2026-10-31', 'active'
        ) RETURNING id;
      `);
      const campaignId = (campRes.rows[0] as any).id;

      // 2. Nominate emp3 by emp1
      const nomRes1 = await db.query(`
        SELECT public.nominate_campaign_candidate_atomic(
          '${companyA}'::uuid,
          '${campaignId}'::uuid,
          '${emp3}'::uuid,
          '${emp1}'::uuid,
          'أرشح خالد لتميزه في حل انقطاع الخوادم وتفانيه العالي'
        ) AS result;
      `);
      expect((nomRes1.rows[0] as any).result.success).toBe(true);

      // 3. Duplicate nomination by emp1 for emp3 in same campaign rejected
      const nomRes2 = await db.query(`
        SELECT public.nominate_campaign_candidate_atomic(
          '${companyA}'::uuid,
          '${campaignId}'::uuid,
          '${emp3}'::uuid,
          '${emp1}'::uuid,
          'محاولة ترشيح مكررة'
        ) AS result;
      `);
      expect((nomRes2.rows[0] as any).result.success).toBe(false);
      expect((nomRes2.rows[0] as any).result.error).toContain("already nominated");
    });

    it("evaluates executive engagement KPIs accurately via get_engagement_kpis_atomic", async () => {
      const kpisRes = await db.query(`
        SELECT public.get_engagement_kpis_atomic('${companyA}'::uuid) AS result;
      `);

      const kpis = (kpisRes.rows[0] as any).result;
      expect(kpis.active_surveys).toBe(1); // 1 open survey
      expect(kpis.avg_participation).toBe(100.0);
      expect(kpis.latest_enps).toBe(33.33);
      expect(kpis.recognitions_month).toBe(1);
      expect(kpis.recognized_employees_count).toBe(1);
    });

    it("enforces multi-tenant isolation between different companies", async () => {
      // Company B has 0 surveys, 0 recognitions
      const kpisB = await db.query(`
        SELECT public.get_engagement_kpis_atomic('${companyB}'::uuid) AS result;
      `);
      const resultB = (kpisB.rows[0] as any).result;
      expect(resultB.active_surveys).toBe(0);
      expect(resultB.recognitions_month).toBe(0);

      // Surveys of Company A must not be visible to Company B
      const surveysB = await db.query(`
        SELECT * FROM public.survey_instances WHERE company_id = '${companyB}';
      `);
      expect(surveysB.rows).toHaveLength(0);
    });
  });
});
