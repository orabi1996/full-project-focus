import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 20: Production Recruitment, ATS, Offers & Hiring Engine", () => {
  // ==========================================================================
  // PART 1: STATIC AST & SOURCE CODE CONTRACT TESTS
  // ==========================================================================
  describe("Static Source Code Contract Tests", () => {
    const recruitmentViewPath = path.resolve(__dirname, "../components/recruitment/RecruitmentView.tsx");
    const recruitmentViewSource = fs.readFileSync(recruitmentViewPath, "utf-8");

    const recruitmentRepoPath = path.resolve(__dirname, "../lib/data/recruitment-repository.ts");
    const recruitmentRepoSource = fs.readFileSync(recruitmentRepoPath, "utf-8");

    const recruitmentDomainPath = path.resolve(__dirname, "../lib/domains/recruitment/index.ts");
    const recruitmentDomainSource = fs.readFileSync(recruitmentDomainPath, "utf-8");

    const queryKeysPath = path.resolve(__dirname, "../lib/query/query-keys.ts");
    const queryKeysSource = fs.readFileSync(queryKeysPath, "utf-8");

    it("1.1 RecruitmentView MUST contain all 7 core ATS operational tabs", () => {
      expect(recruitmentViewSource).toContain('value="dashboard"');
      expect(recruitmentViewSource).toContain('value="requisitions"');
      expect(recruitmentViewSource).toContain('value="jobs"');
      expect(recruitmentViewSource).toContain('value="pipeline"');
      expect(recruitmentViewSource).toContain('value="interviews"');
      expect(recruitmentViewSource).toContain('value="offers"');
      expect(recruitmentViewSource).toContain('value="talent_pool"');
    });

    it("1.2 RecruitmentView MUST NOT contain old workforce tab or fake salary defaults", () => {
      expect(recruitmentViewSource).not.toContain('value="workforce"');
      expect(recruitmentViewSource).not.toContain("salaryMin: 12000");
      expect(recruitmentViewSource).not.toContain("salaryMax: 18000");
      expect(recruitmentViewSource).not.toContain("offerBasic = useState(16000)");
      expect(recruitmentViewSource).not.toContain("offerHousing = useState(4000)");
      expect(recruitmentViewSource).not.toContain("offerTransport = useState(1000)");
      expect(recruitmentViewSource).not.toContain("Math.random()");
    });

    it("1.3 Recruitment repository exports authoritative query hooks and atomic mutations", () => {
      expect(recruitmentRepoSource).toContain("useRecruitmentRequisitions");
      expect(recruitmentRepoSource).toContain("useJobOpenings");
      expect(recruitmentRepoSource).toContain("useCandidates");
      expect(recruitmentRepoSource).toContain("useCandidatePipeline");
      expect(recruitmentRepoSource).toContain("useCandidateInterviews");
      expect(recruitmentRepoSource).toContain("useInterviewScorecards");
      expect(recruitmentRepoSource).toContain("useJobOffers");
      expect(recruitmentRepoSource).toContain("useTalentPool");
      expect(recruitmentRepoSource).toContain("useRecruitmentKpis");
      expect(recruitmentRepoSource).toContain("useRecruitmentRepositoryMutations");

      // Verify server-side atomic RPC invocations
      expect(recruitmentRepoSource).toContain("create_recruitment_requisition_atomic");
      expect(recruitmentRepoSource).toContain("approve_recruitment_requisition_atomic");
      expect(recruitmentRepoSource).toContain("create_job_opening_atomic");
      expect(recruitmentRepoSource).toContain("publish_job_opening_atomic");
      expect(recruitmentRepoSource).toContain("apply_candidate_atomic");
      expect(recruitmentRepoSource).toContain("move_candidate_stage_atomic");
      expect(recruitmentRepoSource).toContain("schedule_interview_atomic");
      expect(recruitmentRepoSource).toContain("submit_scorecard_atomic");
      expect(recruitmentRepoSource).toContain("create_job_offer_atomic");
      expect(recruitmentRepoSource).toContain("update_offer_status_atomic");
      expect(recruitmentRepoSource).toContain("convert_candidate_to_employee_atomic");
      expect(recruitmentRepoSource).toContain("add_to_talent_pool_atomic");
      expect(recruitmentRepoSource).toContain("get_recruitment_kpis_atomic");
    });

    it("1.4 Recruitment domain index uses executeReliableMutation and provides complete domain facades", () => {
      expect(recruitmentDomainSource).toContain("executeReliableMutation");
      expect(recruitmentDomainSource).toContain("useRecruitmentDomain");
      expect(recruitmentDomainSource).toContain("createRequisition");
      expect(recruitmentDomainSource).toContain("approveRequisition");
      expect(recruitmentDomainSource).toContain("createJobOpening");
      expect(recruitmentDomainSource).toContain("publishJobOpening");
      expect(recruitmentDomainSource).toContain("applyCandidate");
      expect(recruitmentDomainSource).toContain("moveCandidateStage");
      expect(recruitmentDomainSource).toContain("scheduleInterview");
      expect(recruitmentDomainSource).toContain("submitScorecard");
      expect(recruitmentDomainSource).toContain("createJobOffer");
      expect(recruitmentDomainSource).toContain("updateOfferStatus");
      expect(recruitmentDomainSource).toContain("convertCandidateToEmployee");
      expect(recruitmentDomainSource).toContain("addToTalentPool");
    });

    it("1.5 Centralized query keys provide full hierarchy for recruitment", () => {
      expect(queryKeysSource).toContain("recruitment: {");
      expect(queryKeysSource).toContain("openings: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("opening: (id: string)");
      expect(queryKeysSource).toContain("requisitions: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("requisition: (id: string)");
      expect(queryKeysSource).toContain("candidates: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("candidate: (id: string)");
      expect(queryKeysSource).toContain("pipeline: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("interviews: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("interview: (id: string)");
      expect(queryKeysSource).toContain("scorecards: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("offers: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("offer: (id: string)");
      expect(queryKeysSource).toContain("kpis: (companyId?: string | null)");
      expect(queryKeysSource).toContain("talentPool: (filters?: Record<string, unknown>)");
    });
  });

  // ==========================================================================
  // PART 2: DATABASE ENGINE TESTS VIA PGLITE
  // ==========================================================================
  describe("Recruitment & ATS Database Engine Execution (PGlite)", () => {
    let pg: PGlite;

    const companyAId = "11111111-1111-1111-1111-111111111111";
    const companyBId = "22222222-2222-2222-2222-222222222222";
    const userAId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const userBId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const deptAId = "33333333-3333-3333-3333-333333333333";
    const locAId = "44444444-4444-4444-4444-444444444444";
    const posAId = "55555555-5555-5555-5555-555555555555";

    let createdRequisitionId: string;
    let createdJobId: string;
    let createdCandidateId: string;
    let createdInterviewId: string;
    let createdOfferId: string;

    async function rpc<T = any>(sql: string): Promise<{ rows: [T] }> {
      const res = await pg.query(sql);
      const row = res.rows[0] as any;
      if (!row) return { rows: [{} as T] };
      const firstVal = Object.values(row)[0];
      const parsed = (typeof firstVal === "object" && firstVal !== null ? firstVal : row) as T;
      return { rows: [parsed] };
    }

    async function asUser(userId: string | null) {
      await pg.exec(`SELECT set_config('test.auth_uid', '${userId || ""}', false);`);
    }

    beforeAll(async () => {
      pg = new PGlite();

      // 1. Setup Postgres mocks and extensions
      await pg.exec(`
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

        -- Base core tables
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

        CREATE TABLE IF NOT EXISTS public.work_locations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          name_ar text NOT NULL,
          name_en text NOT NULL,
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

        CREATE TABLE IF NOT EXISTS public.cost_centers (
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
          email text,
          phone text,
          department_id uuid REFERENCES public.departments(id),
          job_position_id uuid REFERENCES public.job_positions(id),
          work_location_id uuid REFERENCES public.work_locations(id),
          job_title text DEFAULT 'مهندس برمجيات',
          job_title_ar text DEFAULT 'مهندس برمجيات',
          status text NOT NULL DEFAULT 'active',
          role text NOT NULL DEFAULT 'employee',
          nationality text DEFAULT 'SA',
          work_type text DEFAULT 'full_time',
          contract_type text DEFAULT 'full_time',
          basic_salary numeric(12,2) DEFAULT 0,
          housing_allowance numeric(12,2) DEFAULT 0,
          transport_allowance numeric(12,2) DEFAULT 0,
          total_salary numeric(12,2) DEFAULT 0,
          hire_date date DEFAULT CURRENT_DATE,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.workforce_plans (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          fiscal_year integer NOT NULL,
          plan_code text,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.headcount_requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          status text DEFAULT 'approved',
          created_at timestamptz DEFAULT now()
        );
      `);

      // 2. Load migration 20261003000000_production_recruitment_ats_engine.sql
      const migrationFile = path.resolve(
        __dirname,
        "../../supabase/migrations/20261003000000_production_recruitment_ats_engine.sql",
      );
      const migrationSql = fs.readFileSync(migrationFile, "utf-8");
      await pg.exec(migrationSql);

      // 3. Seed initial baseline multi-tenant data
      await pg.exec(`
        INSERT INTO auth.users (id, email) VALUES
          ('${userAId}', 'admin-a@company-a.com'),
          ('${userBId}', 'admin-b@company-b.com');

        INSERT INTO public.companies (id, name_ar, name_en, owner_user_id) VALUES
          ('${companyAId}', 'شركة ألف للتقنية', 'Company Alpha Tech', '${userAId}'),
          ('${companyBId}', 'شركة باء للتجارة', 'Company Beta Commerce', '${userBId}');

        INSERT INTO public.departments (id, company_id, name_ar, name_en, code) VALUES
          ('${deptAId}', '${companyAId}', 'الهندسة والتطوير', 'Engineering', 'ENG-01');

        INSERT INTO public.work_locations (id, company_id, name_ar, name_en) VALUES
          ('${locAId}', '${companyAId}', 'المقر الرئيسي - الرياض', 'Riyadh HQ');

        INSERT INTO public.job_positions (id, company_id, department_id, title_ar, title_en, code) VALUES
          ('${posAId}', '${companyAId}', '${deptAId}', 'مهندس نظم أول', 'Senior Systems Engineer', 'POS-ENG-01');

        INSERT INTO public.employees (id, company_id, user_id, employee_no, first_name_ar, last_name_ar, role, status) VALUES
          (gen_random_uuid(), '${companyAId}', '${userAId}', 'EMP-2026-0001', 'أحمد', 'المسؤول', 'super_admin', 'active'),
          (gen_random_uuid(), '${companyBId}', '${userBId}', 'EMP-2026-0002', 'خالد', 'المسؤول', 'super_admin', 'active');
      `);
    });

    it("2.1 Requisition creation & approval lifecycle with sequential numbering", async () => {
      // Set Auth context as User A
      await asUser(userAId);

      const res = await rpc<{ ok: boolean; requisition_id: string; requisition_no: string }>(`
        SELECT * FROM public.create_recruitment_requisition_atomic(
          p_company_id := '${companyAId}',
          p_title_ar := 'مهندس منصات كلاود',
          p_title_en := 'Cloud Platform Engineer',
          p_department_id := '${deptAId}',
          p_job_position_id := '${posAId}',
          p_openings_count := 2,
          p_employment_type := 'full_time',
          p_salary_min := 15000,
          p_salary_max := 22000,
          p_justification := 'توسيع البنية التحتية لمنظومة الموارد البشرية'
        );
      `);

      expect(res.rows[0].ok).toBe(true);
      expect(res.rows[0].requisition_id).toBeDefined();
      expect(res.rows[0].requisition_no).toMatch(/^REQ-\d{4}-\d{4}$/);

      createdRequisitionId = res.rows[0].requisition_id;

      // Verify status is pending_approval
      const checkReq = await pg.query<{ status: string; openings_count: number }>(`
        SELECT status, openings_count FROM public.recruitment_requisitions WHERE id = '${createdRequisitionId}';
      `);
      expect(checkReq.rows[0].status).toBe("pending_approval");
      expect(checkReq.rows[0].openings_count).toBe(2);

      // Approve requisition
      const approveRes = await rpc<{ ok: boolean; status: string }>(`
        SELECT * FROM public.approve_recruitment_requisition_atomic(
          p_requisition_id := '${createdRequisitionId}',
          p_company_id := '${companyAId}',
          p_action := 'approve',
          p_reason := 'معتمد حسب خطة الربع الرابع'
        );
      `);

      expect(approveRes.rows[0].ok).toBe(true);
      expect(approveRes.rows[0].status).toBe("approved");

      // Verify approved status in database
      const verifyApproved = await pg.query<{ status: string; approved_by: string }>(`
        SELECT status, approved_by FROM public.recruitment_requisitions WHERE id = '${createdRequisitionId}';
      `);
      expect(verifyApproved.rows[0].status).toBe("approved");
      expect(verifyApproved.rows[0].approved_by).toBe(userAId);
    });

    it("2.2 Job opening creation linked to requisition & publishing controls", async () => {
      await asUser(userAId);

      const res = await rpc<{ ok: boolean; job_id: string; job_reference: string }>(`
        SELECT * FROM public.create_job_opening_atomic(
          p_company_id := '${companyAId}',
          p_title_ar := 'مهندس منصات كلاود أول',
          p_title_en := 'Senior Cloud Platform Engineer',
          p_department_id := '${deptAId}',
          p_job_position_id := '${posAId}',
          p_location_id := '${locAId}',
          p_requisition_id := '${createdRequisitionId}',
          p_openings_count := 2,
          p_employment_type := 'full_time',
          p_salary_min := 16000,
          p_salary_max := 22000,
          p_salary_visibility := 'range',
          p_description_ar := 'قيادة بنية السحابة وإدارة الحاويات',
          p_requirements_ar := 'خبرة 5 سنوات في Kubernetes وTerraform'
        );
      `);

      expect(res.rows[0].ok).toBe(true);
      expect(res.rows[0].job_id).toBeDefined();
      expect(res.rows[0].job_reference).toMatch(/^JOB-\d{4}-\d{4}$/);

      createdJobId = res.rows[0].job_id;

      // Verify created opening status is draft
      const checkOpening = await pg.query<{ status: string; published_status: string }>(`
        SELECT status, published_status FROM public.job_openings WHERE id = '${createdJobId}';
      `);
      expect(checkOpening.rows[0].status).toBe("draft");

      // Publish opening
      const pubRes = await rpc<{ ok: boolean; status: string }>(`
        SELECT * FROM public.publish_job_opening_atomic(
          p_job_id := '${createdJobId}',
          p_company_id := '${companyAId}',
          p_action := 'publish'
        );
      `);
      expect(pubRes.rows[0].ok).toBe(true);
      expect(pubRes.rows[0].status).toBe("published");

      // Pause opening
      const pauseRes = await rpc<{ ok: boolean; status: string }>(`
        SELECT * FROM public.publish_job_opening_atomic(
          p_job_id := '${createdJobId}',
          p_company_id := '${companyAId}',
          p_action := 'pause'
        );
      `);
      expect(pauseRes.rows[0].ok).toBe(true);
      expect(pauseRes.rows[0].status).toBe("paused");

      // Re-publish opening
      await rpc(`
        SELECT * FROM public.publish_job_opening_atomic(
          p_job_id := '${createdJobId}',
          p_company_id := '${companyAId}',
          p_action := 'publish'
        );
      `);
    });

    it("2.3 Candidate application, sequential code generation, deduplication & stage progression", async () => {
      await asUser(userAId);

      // 1. Submit first candidate
      const candRes = await rpc<{ ok: boolean; candidate_id: string; candidate_code: string; duplicate_flag: boolean }>(`
        SELECT * FROM public.apply_candidate_atomic(
          p_company_id := '${companyAId}',
          p_job_id := '${createdJobId}',
          p_full_name := 'سعد بن ناصر القحطاني',
          p_email := 'saad.qahtani@example.com',
          p_phone := '0551122334',
          p_source := 'linkedin',
          p_consent_given := true
        );
      `);

      expect(candRes.rows[0].ok).toBe(true);
      expect(candRes.rows[0].candidate_id).toBeDefined();
      expect(candRes.rows[0].candidate_code).toMatch(/^CND-\d{4}-\d{4}$/);
      expect(candRes.rows[0].duplicate_flag).toBe(false);

      createdCandidateId = candRes.rows[0].candidate_id;

      // 2. Submit second candidate with SAME email to verify duplicate detection
      const dupRes = await rpc<{ ok: boolean; candidate_id: string; duplicate_flag: boolean }>(`
        SELECT * FROM public.apply_candidate_atomic(
          p_company_id := '${companyAId}',
          p_job_id := '${createdJobId}',
          p_full_name := 'سعد القحطاني مكرر',
          p_email := 'saad.qahtani@example.com',
          p_phone := '0551122334',
          p_source := 'website',
          p_consent_given := true
        );
      `);

      expect(dupRes.rows[0].ok).toBe(true);
      expect(dupRes.rows[0].duplicate_flag).toBe(true);

      // 3. Move stage: applied -> screening -> interview -> assessment -> job_offer
      const stageSteps = ["screening", "interview", "assessment", "job_offer"] as const;
      for (const st of stageSteps) {
        const moveRes = await rpc<{ ok: boolean; new_stage: string }>(`
          SELECT * FROM public.move_candidate_stage_atomic(
            p_candidate_id := '${createdCandidateId}',
            p_company_id := '${companyAId}',
            p_new_stage := '${st}',
            p_reason := 'ترقية نظامية حسب التقييم'
          );
        `);
        expect(moveRes.rows[0].ok).toBe(true);
        expect(moveRes.rows[0].new_stage).toBe(st);
      }

      // Verify audit stage history was recorded
      const history = await pg.query<{ count: string }>(`
        SELECT COUNT(*) as count FROM public.candidate_stage_history
        WHERE candidate_id = '${createdCandidateId}';
      `);
      expect(Number(history.rows[0].count)).toBeGreaterThanOrEqual(4);
    });

    it("2.4 Interview scheduling, panel assignment & scorecard submission", async () => {
      await asUser(userAId);

      const scheduledTime = new Date(Date.now() + 86400000).toISOString();

      // Schedule interview
      const intRes = await rpc<{ ok: boolean; interview_id: string }>(`
        SELECT * FROM public.schedule_interview_atomic(
          p_company_id := '${companyAId}',
          p_candidate_id := '${createdCandidateId}',
          p_job_id := '${createdJobId}',
          p_interview_type := 'technical',
          p_scheduled_at := '${scheduledTime}',
          p_duration_minutes := 60,
          p_location_type := 'video',
          p_meeting_link := 'https://meet.google.com/abc-defg-hij',
          p_notes := 'التركيز على تصميم النظم وهيكلية السحابة',
          p_interviewer_ids := ARRAY['${userAId}']::uuid[]
        );
      `);

      expect(intRes.rows[0].ok).toBe(true);
      expect(intRes.rows[0].interview_id).toBeDefined();
      createdInterviewId = intRes.rows[0].interview_id;

      // Submit scorecard
      const criteriaJson = JSON.stringify([
        { criterion_name: "المهارات الفنية", score: 5, weight_pct: 40 },
        { criterion_name: "حل المشكلات", score: 4, weight_pct: 30 },
        { criterion_name: "التواصل والتوافق", score: 5, weight_pct: 30 }
      ]);

      const scRes = await rpc<{ ok: boolean; scorecard_id: string; overall_score: number }>(`
        SELECT * FROM public.submit_scorecard_atomic(
          p_company_id := '${companyAId}',
          p_interview_id := '${createdInterviewId}',
          p_candidate_id := '${createdCandidateId}',
          p_recommendation := 'strong_hire',
          p_strengths := 'تمكن ممتاز من تقنيات السحابة وKubernetes',
          p_weaknesses := 'يحتاج خبرة إضافية في أنظمة الرصد والمراقبة',
          p_general_feedback := 'مرشح متميز ويوصى بالتعيين الفوري',
          p_criteria := '${criteriaJson}'::jsonb
        );
      `);

      expect(scRes.rows[0].ok).toBe(true);
      expect(scRes.rows[0].scorecard_id).toBeDefined();
      expect(Number(scRes.rows[0].overall_score)).toBeGreaterThanOrEqual(4.5);

      // Verify interview status updated to completed
      const checkInt = await pg.query<{ status: string }>(`
        SELECT status FROM public.candidate_interviews WHERE id = '${createdInterviewId}';
      `);
      expect(checkInt.rows[0].status).toBe("completed");
    });

    it("2.5 Job offer issuance, compensation calculation & status lifecycle", async () => {
      await asUser(userAId);

      const offerRes = await rpc<{
        ok: boolean;
        offer_id: string;
        offer_code: string;
        total_salary: number;
      }>(`
        SELECT * FROM public.create_job_offer_atomic(
          p_company_id := '${companyAId}',
          p_candidate_id := '${createdCandidateId}',
          p_job_id := '${createdJobId}',
          p_requisition_id := '${createdRequisitionId}',
          p_basic_salary := 16000,
          p_housing_allowance := 4000,
          p_transport_allowance := 1000,
          p_other_allowances := 500,
          p_proposed_start_date := '2026-11-01',
          p_expiry_date := '2026-10-15',
          p_notes := 'عرض عمل رسمي خاضع لنظام العمل السعودي'
        );
      `);

      expect(offerRes.rows[0].ok).toBe(true);
      expect(offerRes.rows[0].offer_id).toBeDefined();
      expect(offerRes.rows[0].offer_code).toMatch(/^OFF-\d{4}-\d{4}$/);
      expect(Number(offerRes.rows[0].total_salary)).toBe(21500);

      createdOfferId = offerRes.rows[0].offer_id;

      // Workflow: approve -> send -> accept
      const approveOffer = await rpc<{ ok: boolean; status: string }>(`
        SELECT * FROM public.update_offer_status_atomic(
          p_offer_id := '${createdOfferId}',
          p_company_id := '${companyAId}',
          p_action := 'approve'
        );
      `);
      expect(approveOffer.rows[0].ok).toBe(true);
      expect(approveOffer.rows[0].status).toBe("approved");

      const sendOffer = await rpc<{ ok: boolean; status: string }>(`
        SELECT * FROM public.update_offer_status_atomic(
          p_offer_id := '${createdOfferId}',
          p_company_id := '${companyAId}',
          p_action := 'send'
        );
      `);
      expect(sendOffer.rows[0].ok).toBe(true);
      expect(sendOffer.rows[0].status).toBe("sent");

      const acceptOffer = await rpc<{ ok: boolean; status: string }>(`
        SELECT * FROM public.update_offer_status_atomic(
          p_offer_id := '${createdOfferId}',
          p_company_id := '${companyAId}',
          p_action := 'accept'
        );
      `);
      expect(acceptOffer.rows[0].ok).toBe(true);
      expect(acceptOffer.rows[0].status).toBe("accepted");
    });

    it("2.6 Candidate -> Employee conversion atomic RPC (sequential EMP-YYYY-NNNN & idempotency)", async () => {
      await asUser(userAId);

      const convRes = await rpc<{
        ok: boolean;
        employee_id: string;
        employee_no: string;
        already_converted: boolean;
      }>(`
        SELECT * FROM public.convert_candidate_to_employee_atomic(
          p_candidate_id := '${createdCandidateId}',
          p_company_id := '${companyAId}',
          p_first_name_ar := 'سعد',
          p_last_name_ar := 'القحطاني',
          p_department_id := '${deptAId}',
          p_work_location_id := '${locAId}',
          p_hire_date := '2026-11-01',
          p_contract_type := 'full_time',
          p_work_type := 'full_time',
          p_basic_salary := 16000,
          p_housing_allowance := 4000,
          p_transport_allowance := 1000
        );
      `);

      expect(convRes.rows[0].ok).toBe(true);
      expect(convRes.rows[0].employee_id).toBeDefined();
      expect(convRes.rows[0].employee_no).toMatch(/^EMP-\d{4}-\d{4}$/);
      expect(convRes.rows[0].already_converted).toBe(false);

      const createdEmpId = convRes.rows[0].employee_id;

      // Verify employee record created with draft status
      const empRecord = await pg.query<{ status: string; basic_salary: number; department_id: string }>(`
        SELECT status, basic_salary, department_id FROM public.employees WHERE id = '${createdEmpId}';
      `);
      expect(empRecord.rows[0].status).toBe("draft");
      expect(Number(empRecord.rows[0].basic_salary)).toBe(16000);
      expect(empRecord.rows[0].department_id).toBe(deptAId);

      // Verify candidate stage updated to hired and converted_employee_id linked
      const candRecord = await pg.query<{ stage: string; converted_employee_id: string }>(`
        SELECT stage, converted_employee_id FROM public.candidates WHERE id = '${createdCandidateId}';
      `);
      expect(candRecord.rows[0].stage).toBe("hired");
      expect(candRecord.rows[0].converted_employee_id).toBe(createdEmpId);

      // Verify job opening filled_count incremented
      const jobRecord = await pg.query<{ filled_count: number }>(`
        SELECT filled_count FROM public.job_openings WHERE id = '${createdJobId}';
      `);
      expect(jobRecord.rows[0].filled_count).toBe(1);

      // Test idempotency: calling conversion again on already hired candidate returns the same employee
      const retryRes = await rpc<{
        ok: boolean;
        employee_id: string;
        employee_no: string;
        already_converted: boolean;
      }>(`
        SELECT * FROM public.convert_candidate_to_employee_atomic(
          p_candidate_id := '${createdCandidateId}',
          p_company_id := '${companyAId}',
          p_first_name_ar := 'سعد',
          p_last_name_ar := 'القحطاني',
          p_department_id := '${deptAId}',
          p_work_location_id := '${locAId}',
          p_hire_date := '2026-11-01'
        );
      `);

      expect(retryRes.rows[0].ok).toBe(true);
      expect(retryRes.rows[0].employee_id).toBe(createdEmpId);
      expect(retryRes.rows[0].already_converted).toBe(true);
    });

    it("2.7 Talent pool addition & retention period enforcement", async () => {
      await asUser(userAId);

      // Create a second candidate to add to talent pool
      const cand2 = await rpc<{ candidate_id: string }>(`
        SELECT * FROM public.apply_candidate_atomic(
          p_company_id := '${companyAId}',
          p_job_id := '${createdJobId}',
          p_full_name := 'منى إبراهيم المنصور',
          p_email := 'mona.mansour@example.com',
          p_phone := '0559988776',
          p_source := 'referral',
          p_consent_given := true
        );
      `);
      const cand2Id = cand2.rows[0].candidate_id;

      // Add to talent pool
      const tpRes = await rpc<{ ok: boolean; pool_id: string }>(`
        SELECT * FROM public.add_to_talent_pool_atomic(
          p_company_id := '${companyAId}',
          p_candidate_id := '${cand2Id}',
          p_skills := ARRAY['PostgreSQL', 'Cloud Infrastructure', 'Go']::text[],
          p_notes := 'مرشحة قوية جداً للشواغر التقنية المستقبلية',
          p_retention_months := 12
        );
      `);

      expect(tpRes.rows[0].ok).toBe(true);
      expect(tpRes.rows[0].pool_id).toBeDefined();

      // Verify talent pool entry and retention date
      const poolCheck = await pg.query<{ retention_until: string; candidate_id: string }>(`
        SELECT retention_until, candidate_id FROM public.talent_pool_entries WHERE candidate_id = '${cand2Id}';
      `);
      expect(poolCheck.rows[0].candidate_id).toBe(cand2Id);
      expect(poolCheck.rows[0].retention_until).toBeDefined();

      // Verify candidate flag
      const candFlag = await pg.query<{ is_in_talent_pool: boolean }>(`
        SELECT is_in_talent_pool FROM public.candidates WHERE id = '${cand2Id}';
      `);
      expect(candFlag.rows[0].is_in_talent_pool).toBe(true);
    });

    it("2.8 Multi-tenant security isolation: Company B cannot mutate Company A recruitment data", async () => {
      // Set auth context as User B from Company B
      await asUser(userBId);

      // User B tries to approve Company A requisition -> must fail
      const rogueApprove = await rpc<{ ok: boolean; error: string }>(`
        SELECT * FROM public.approve_recruitment_requisition_atomic(
          p_requisition_id := '${createdRequisitionId}',
          p_company_id := '${companyBId}',
          p_action := 'approve'
        );
      `);
      expect(rogueApprove.rows[0].ok).toBe(false);

      // User B tries to move Company A candidate stage -> must fail
      const rogueStage = await rpc<{ ok: boolean; error: string }>(`
        SELECT * FROM public.move_candidate_stage_atomic(
          p_candidate_id := '${createdCandidateId}',
          p_company_id := '${companyBId}',
          p_new_stage := 'interview'
        );
      `);
      expect(rogueStage.rows[0].ok).toBe(false);

      // User B tries to update Company A offer status -> must fail
      const rogueOffer = await rpc<{ ok: boolean; error: string }>(`
        SELECT * FROM public.update_offer_status_atomic(
          p_offer_id := '${createdOfferId}',
          p_company_id := '${companyBId}',
          p_action := 'accept'
        );
      `);
      expect(rogueOffer.rows[0].ok).toBe(false);
    });
  });
});
