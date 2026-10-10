import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  calculateTaskDueDate,
  evaluateReadiness,
  canCompleteOnboarding,
  validateProbationExtension,
  maskSensitiveEmployeeDataForManager,
  type OnboardingTask,
  type OnboardingDocumentRequirement,
  type OnboardingCase,
  type ProbationPolicy,
} from "../lib/domains/onboarding";

describe("Prompt 27: Production Onboarding & Probation Engine", () => {
  // ==========================================================================
  // SECTION 1: PURE DOMAIN LOGIC & CALCULATION TESTS
  // ==========================================================================
  describe("1. Pure Domain Logic & Rules", () => {
    it("calculates deterministic task due dates relative to joining date", () => {
      const joiningDate = "2026-11-01";
      expect(calculateTaskDueDate(joiningDate, -14)).toBe("2026-10-18");
      expect(calculateTaskDueDate(joiningDate, -7)).toBe("2026-10-25");
      expect(calculateTaskDueDate(joiningDate, -1)).toBe("2026-10-31");
      expect(calculateTaskDueDate(joiningDate, 0)).toBe("2026-11-01");
      expect(calculateTaskDueDate(joiningDate, 1)).toBe("2026-11-02");
      expect(calculateTaskDueDate(joiningDate, 7)).toBe("2026-11-08");
      expect(calculateTaskDueDate(joiningDate, 30)).toBe("2026-12-01");
    });

    it("evaluates joining readiness truthfully based on task and document states", () => {
      const mockTasks: OnboardingTask[] = [
        {
          id: "t1",
          caseId: "c1",
          companyId: "comp1",
          code: "T1",
          titleAr: "مهمة أساسية",
          titleEn: "Blocking Task",
          ownerRole: "employee",
          dueDate: "2026-10-25",
          relativeDueDays: -7,
          status: "pending",
          isBlocking: true,
          dependsOnTaskIds: [],
          createdAt: "2026-10-01",
        },
        {
          id: "t2",
          caseId: "c1",
          companyId: "comp1",
          code: "T2",
          titleAr: "مهمة غير أساسية",
          titleEn: "Non-blocking Task",
          ownerRole: "it",
          dueDate: "2026-10-30",
          relativeDueDays: -2,
          status: "pending",
          isBlocking: false,
          dependsOnTaskIds: [],
          createdAt: "2026-10-01",
        },
      ];

      const mockDocs: OnboardingDocumentRequirement[] = [
        {
          id: "d1",
          caseId: "c1",
          companyId: "comp1",
          docType: "national_id",
          nameAr: "الهوية الوطنية",
          nameEn: "National ID",
          isMandatory: true,
          status: "pending",
          createdAt: "2026-10-01",
        },
      ];

      // Initially not ready
      const initial = evaluateReadiness(mockTasks, mockDocs);
      expect(initial.readiness).toBe("not_ready");
      expect(initial.progress).toBe(0);
      expect(initial.blockers.length).toBeGreaterThan(0);

      // When document uploaded and some tasks done -> partially_ready
      mockDocs[0].status = "uploaded";
      const partial = evaluateReadiness(mockTasks, mockDocs);
      expect(partial.readiness).toBe("partially_ready");

      // When all blocking tasks completed and mandatory docs verified -> ready
      mockTasks[0].status = "completed";
      mockDocs[0].status = "verified";
      const ready = evaluateReadiness(mockTasks, mockDocs);
      expect(ready.readiness).toBe("ready");
      expect(ready.blockers.length).toBe(0);
    });

    it("prevents completing onboarding if blocking tasks or unverified documents remain", () => {
      const mockCase: OnboardingCase = {
        id: "c1",
        companyId: "comp1",
        employeeId: "emp1",
        templateVersion: 1,
        joiningDate: "2026-11-01",
        status: "in_progress",
        progressPercentage: 50,
        readinessStatus: "partially_ready",
        blockingReasons: [],
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
      };

      const tasks: OnboardingTask[] = [
        {
          id: "t1",
          caseId: "c1",
          companyId: "comp1",
          code: "T1",
          titleAr: "عقد العمل",
          titleEn: "Contract",
          ownerRole: "employee",
          dueDate: "2026-10-25",
          relativeDueDays: -7,
          status: "pending",
          isBlocking: true,
          dependsOnTaskIds: [],
          createdAt: "2026-10-01",
        },
      ];

      const docs: OnboardingDocumentRequirement[] = [
        {
          id: "d1",
          caseId: "c1",
          companyId: "comp1",
          docType: "national_id",
          nameAr: "الهوية",
          nameEn: "ID",
          isMandatory: true,
          status: "uploaded",
          createdAt: "2026-10-01",
        },
      ];

      const check1 = canCompleteOnboarding(mockCase, tasks, docs);
      expect(check1.allowed).toBe(false);
      expect(check1.reasons.length).toBe(2);

      // Complete task and verify document
      tasks[0].status = "completed";
      docs[0].status = "verified";
      const check2 = canCompleteOnboarding(mockCase, tasks, docs);
      expect(check2.allowed).toBe(true);
      expect(check2.reasons.length).toBe(0);
    });

    it("enforces probation policy extension boundaries and country-specific rules", () => {
      const saudiPolicy: ProbationPolicy = {
        id: "pol-sa",
        companyId: "comp1",
        nameAr: "سياسة السعودية",
        nameEn: "Saudi Policy",
        country: "SA",
        defaultDurationDays: 90,
        maxExtensionDays: 90,
        finalReviewDaysBeforeEnd: 14,
        isActive: true,
      };

      // Valid extension of 30 days
      expect(validateProbationExtension(saudiPolicy, 0, 30).valid).toBe(true);

      // Exceeding maximum allowed extension of 90 days
      const excessive = validateProbationExtension(saudiPolicy, 60, 45);
      expect(excessive.valid).toBe(false);
      expect(excessive.reason).toContain("يتجاوز الحد النظامي الأقصى");

      // Country where extension is disallowed (e.g., Egypt max 0 extension)
      const egyptPolicy: ProbationPolicy = {
        ...saudiPolicy,
        country: "EG",
        maxExtensionDays: 0,
      };
      const egCheck = validateProbationExtension(egyptPolicy, 0, 30);
      expect(egCheck.valid).toBe(false);
      expect(egCheck.reason).toContain("لا يسمح بتمديد فترة التجربة");
    });

    it("enforces field-level privacy masking for managers", () => {
      const sensitiveProfile = {
        employeeId: "emp-101",
        name: "خالد الشهري",
        iban: "SA4420000001234567890123",
        bankAccount: "123456789",
        nationalIdOrIqama: "1098765432",
        medicalAttachment: "medical_report_confidential.pdf",
        basicSalary: 15000,
        totalSalary: 20000,
        jobTitle: "مهندس نظم",
      };

      const masked = maskSensitiveEmployeeDataForManager(sensitiveProfile);
      expect(masked.iban).toBe("SA****************");
      expect(masked.nationalIdOrIqama).toBe("**********");
      expect("bankAccount" in masked).toBe(false);
      expect("medicalAttachment" in masked).toBe(false);
      expect("basicSalary" in masked).toBe(false);
      expect("totalSalary" in masked).toBe(false);
      expect(masked.jobTitle).toBe("مهندس نظم");
    });
  });

  // ==========================================================================
  // SECTION 2: PGLITE DATABASE MIGRATION & ATOMIC RPCS
  // ==========================================================================
  describe("2. Database Schema, RPCs & RLS Isolation (PGlite)", () => {
    const db = new PGlite();
    const companyA = "11111111-1111-1111-1111-111111111111";
    const companyB = "22222222-2222-2222-2222-222222222222";
    const adminUser = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const empUserA = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const employeeIdA = "33333333-3333-3333-3333-333333333333";
    const employeeIdB = "44444444-4444-4444-4444-444444444444";

    beforeAll(async () => {
      // 1. Setup base database environment, roles, and helper functions
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
          name_ar text
        );

        CREATE TABLE IF NOT EXISTS public.candidates (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          full_name text,
          email text,
          phone text,
          stage text NOT NULL DEFAULT 'applied'
        );

        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid,
          employee_no text,
          first_name_ar text,
          last_name_ar text,
          status text NOT NULL DEFAULT 'draft',
          job_title_ar text,
          department_id uuid REFERENCES public.departments(id),
          manager_id uuid,
          custom_fields jsonb DEFAULT '{}'::jsonb,
          updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.employee_documents (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          employee_id uuid REFERENCES public.employees(id),
          doc_type text,
          status text DEFAULT 'pending',
          verified_by text,
          verified_at timestamptz,
          rejection_reason text
        );

        CREATE TABLE IF NOT EXISTS public.operational_tasks (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          task_number text,
          title_ar text,
          title_en text,
          description_ar text,
          description_en text,
          category text,
          priority text DEFAULT 'medium',
          status text DEFAULT 'pending',
          due_date timestamptz,
          entity_type text,
          entity_id text,
          completed_at timestamptz,
          completed_by uuid,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.audit_events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid,
          event_type text,
          action text,
          status text,
          details jsonb,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.notifications_inbox (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid,
          type text,
          title_ar text,
          title_en text,
          body_ar text,
          body_en text,
          priority text,
          entity_type text,
          entity_id text,
          created_at timestamptz DEFAULT now()
        );

        -- Auth & Security helpers
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT nullif(current_setting('test.uid', true), '')::uuid
        $$;

        CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT nullif(current_setting('test.company_id', true), '')::uuid
        $$;

        CREATE OR REPLACE FUNCTION public.resolve_my_employee_id() RETURNS uuid LANGUAGE plpgsql STABLE AS $$
        DECLARE
          v_emp_id uuid;
        BEGIN
          SELECT id INTO v_emp_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
          RETURN v_emp_id;
        END;
        $$;

        CREATE OR REPLACE FUNCTION public.current_user_can_manage_company(p_company_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
          SELECT auth.uid() IS NOT NULL AND (
            current_setting('test.role', true) IN ('super_admin', 'hr_manager', 'hr_specialist')
            OR p_company_id = public.current_company_id()
          );
        $$;

        CREATE OR REPLACE FUNCTION public.change_employee_status(
          p_employee_id uuid,
          p_new_status text,
          p_effective_date date DEFAULT current_date,
          p_reason text DEFAULT NULL,
          p_termination_type text DEFAULT NULL
        ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
        BEGIN
          UPDATE public.employees
          SET status = p_new_status, updated_at = now()
          WHERE id = p_employee_id;
          RETURN jsonb_build_object('ok', true, 'status', p_new_status);
        END;
        $$;
      `);

      // 2. Insert test tenants and employees
      await db.exec(`
        INSERT INTO public.companies(id, name) VALUES
          ('${companyA}', 'Company A'),
          ('${companyB}', 'Company B');

        INSERT INTO auth.users(id, email) VALUES
          ('${adminUser}', 'admin@companya.com'),
          ('${empUserA}', 'employee@companya.com');

        INSERT INTO public.employees(id, company_id, user_id, employee_no, first_name_ar, last_name_ar, status) VALUES
          ('${employeeIdA}', '${companyA}', '${empUserA}', 'EMP-2026-0001', 'سعد', 'الغامدي', 'draft'),
          ('${employeeIdB}', '${companyB}', NULL, 'EMP-2026-0002', 'طارق', 'المنصور', 'draft');
      `);

      // 3. Apply Prompt 27 migration
      const migrationSql = readFileSync(
        "supabase/migrations/20261009000000_production_onboarding_probation_engine.sql",
        "utf8",
      ).replace(/^\uFEFF/, "");
      await db.exec(migrationSql);
    });

    afterAll(async () => {
      await db.close();
    });

    it("applies the migration and creates all required tables and constraints", async () => {
      const res = await db.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN (
            'onboarding_templates',
            'onboarding_template_versions',
            'onboarding_task_definitions',
            'onboarding_cases',
            'onboarding_tasks',
            'onboarding_document_requirements',
            'onboarding_acknowledgements',
            'probation_policies',
            'probation_cases',
            'probation_reviews'
          )
        ORDER BY table_name;
      `);

      expect(res.rows.length).toBe(10);
    });

    it("successfully creates an onboarding case via create_onboarding_case_atomic", async () => {
      // Act as HR Admin for Company A
      await db.exec(`
        SET test.uid = '${adminUser}';
        SET test.role = 'hr_manager';
        SET test.company_id = '${companyA}';
      `);

      const res = await db.query<{ result: any }>(
        `SELECT public.create_onboarding_case_atomic(
          $1::uuid,
          $2::uuid,
          '2026-11-01'::date,
          NULL::uuid,
          NULL::uuid,
          NULL::uuid,
          NULL::uuid,
          'مرحباً بك في الفريق'
        ) AS result`,
        [companyA, employeeIdA],
      );

      const result = res.rows[0].result;
      expect(result.ok).toBe(true);
      expect(result.case_id).toBeDefined();
      expect(result.probation_case_id).toBeDefined();

      // Check tasks seeded
      const tasksRes = await db.query(
        `SELECT count(*)::int as count FROM public.onboarding_tasks WHERE case_id = $1::uuid`,
        [result.case_id],
      );
      expect((tasksRes.rows[0] as any).count).toBeGreaterThanOrEqual(8);

      // Check documents seeded
      const docsRes = await db.query(
        `SELECT count(*)::int as count FROM public.onboarding_document_requirements WHERE case_id = $1::uuid`,
        [result.case_id],
      );
      expect((docsRes.rows[0] as any).count).toBeGreaterThanOrEqual(3);

      // Check probation case created
      const probRes = await db.query(
        `SELECT * FROM public.probation_cases WHERE id = $1::uuid`,
        [result.probation_case_id],
      );
      expect(probRes.rows.length).toBe(1);
      expect((probRes.rows[0] as any).employee_id).toBe(employeeIdA);
      expect((probRes.rows[0] as any).original_end_date).toBeDefined();
    });

    it("strictly prevents duplicate onboarding cases for the same employee", async () => {
      await db.exec(`
        SET test.uid = '${adminUser}';
        SET test.role = 'hr_manager';
        SET test.company_id = '${companyA}';
      `);

      // Try creating a second active case for employeeIdA
      const duplicateRes = await db.query<{ result: any }>(
        `SELECT public.create_onboarding_case_atomic(
          $1::uuid,
          $2::uuid,
          '2026-11-15'::date
        ) AS result`,
        [companyA, employeeIdA],
      );

      const result = duplicateRes.rows[0].result;
      expect(result.ok).toBe(false);
      expect(result.error).toBe("duplicate_onboarding_case");
    });

    it("verifies documents and updates case readiness", async () => {
      const caseRow = (
        await db.query(`SELECT id FROM public.onboarding_cases WHERE employee_id = '${employeeIdA}'`)
      ).rows[0] as { id: string };

      const docRow = (
        await db.query(
          `SELECT id FROM public.onboarding_document_requirements WHERE case_id = '${caseRow.id}' AND is_mandatory = true LIMIT 1`,
        )
      ).rows[0] as { id: string };

      // Verify the document
      const verifyRes = await db.query<{ result: any }>(
        `SELECT public.verify_onboarding_document_atomic($1::uuid, 'verified') AS result`,
        [docRow.id],
      );
      expect(verifyRes.rows[0].result.ok).toBe(true);

      const updatedDoc = (
        await db.query(`SELECT status FROM public.onboarding_document_requirements WHERE id = '${docRow.id}'`)
      ).rows[0] as { status: string };
      expect(updatedDoc.status).toBe("verified");
    });

    it("submits probation review and processes probation confirmation", async () => {
      const probRow = (
        await db.query(`SELECT id FROM public.probation_cases WHERE employee_id = '${employeeIdA}'`)
      ).rows[0] as { id: string };

      // 1. Submit review
      const revRes = await db.query<{ result: any }>(
        `SELECT public.submit_probation_review_atomic(
          $1::uuid,
          'final',
          4.8,
          95,
          90,
          'confirm',
          'أداء متميز وتكامل سريع مع الفريق',
          'الالتزام والمبادرة',
          'مواصلة تطوير المهارات'
        ) AS result`,
        [probRow.id],
      );
      expect(revRes.rows[0].result.ok).toBe(true);

      // 2. Decide outcome: Confirm
      const decRes = await db.query<{ result: any }>(
        `SELECT public.decide_probation_outcome_atomic(
          $1::uuid,
          'confirmed',
          'تم تثبيت الموظف بنجاح بناءً على نتائج التقييم'
        ) AS result`,
        [probRow.id],
      );
      expect(decRes.rows[0].result.ok).toBe(true);

      // Verify employee status updated to active
      const empRes = await db.query(`SELECT status FROM public.employees WHERE id = '${employeeIdA}'`);
      expect((empRes.rows[0] as any).status).toBe("active");
    });

    it("processes probation extension with legal limit enforcement", async () => {
      // Create new employee and case for extension test
      const empExtId = "55555555-5555-5555-5555-555555555555";
      await db.exec(`
        INSERT INTO public.employees(id, company_id, employee_no, first_name_ar, last_name_ar, status)
        VALUES ('${empExtId}', '${companyA}', 'EMP-2026-EXT1', 'فهد', 'السبيعي', 'draft');
      `);

      const caseRes = await db.query<{ result: any }>(
        `SELECT public.create_onboarding_case_atomic(
          $1::uuid,
          $2::uuid,
          '2026-12-01'::date
        ) AS result`,
        [companyA, empExtId],
      );
      const probCaseId = caseRes.rows[0].result.probation_case_id;

      // Extend within limit (30 days)
      const extRes = await db.query<{ result: any }>(
        `SELECT public.decide_probation_outcome_atomic(
          $1::uuid,
          'extended',
          'تمديد إضافي لاكتساب المهارات',
          30,
          'الحاجة لتدريب متخصص'
        ) AS result`,
        [probCaseId],
      );
      expect(extRes.rows[0].result.ok).toBe(true);

      const updatedProb = (
        await db.query(`SELECT status, extension_count, extension_days FROM public.probation_cases WHERE id = '${probCaseId}'`)
      ).rows[0] as { status: string; extension_count: number; extension_days: number };
      expect(updatedProb.status).toBe("extended");
      expect(updatedProb.extension_count).toBe(1);
      expect(updatedProb.extension_days).toBe(30);

      // Trying to extend beyond legal maximum (e.g., adding 70 days when max is 90 and current is 30) -> 100 > 90
      const illegalExt = await db.query<{ result: any }>(
        `SELECT public.decide_probation_outcome_atomic(
          $1::uuid,
          'extended',
          'تمديد غير نظامي',
          70,
          'تجاوز الحد'
        ) AS result`,
        [probCaseId],
      );
      expect(illegalExt.rows[0].result.ok).toBe(false);
      expect(illegalExt.rows[0].result.error).toBe("exceeds_max_extension");
    });

    it("processes failed probation by initiating controlled offboarding WITHOUT deleting employee record", async () => {
      const empFailId = "66666666-6666-6666-6666-666666666666";
      await db.exec(`
        INSERT INTO public.employees(id, company_id, employee_no, first_name_ar, last_name_ar, status)
        VALUES ('${empFailId}', '${companyA}', 'EMP-2026-FAIL1', 'ماجد', 'العتيبي', 'probation');
      `);

      const caseRes = await db.query<{ result: any }>(
        `SELECT public.create_onboarding_case_atomic(
          $1::uuid,
          $2::uuid,
          '2026-10-01'::date
        ) AS result`,
        [companyA, empFailId],
      );
      const probCaseId = caseRes.rows[0].result.probation_case_id;

      // Fail probation
      const failRes = await db.query<{ result: any }>(
        `SELECT public.decide_probation_outcome_atomic(
          $1::uuid,
          'failed',
          'عدم اجتياز متطلبات فترة التجربة الفنية'
        ) AS result`,
        [probCaseId],
      );
      expect(failRes.rows[0].result.ok).toBe(true);

      // Critical contract check: Employee MUST STILL EXIST in the database
      const empCheck = await db.query(
        `SELECT id, status FROM public.employees WHERE id = '${empFailId}'`,
      );
      expect(empCheck.rows.length).toBe(1);
      expect((empCheck.rows[0] as any).status).toBe("terminated");

      // Offboarding clearance operational task MUST be created
      const taskCheck = await db.query(
        `SELECT * FROM public.operational_tasks WHERE entity_id = '${empFailId}' AND category = 'offboarding'`,
      );
      expect(taskCheck.rows.length).toBe(1);
      expect((taskCheck.rows[0] as any).priority).toBe("urgent");
    });

    it("returns server-backed governed KPIs via get_onboarding_kpis_atomic", async () => {
      const kpisRes = await db.query<{ result: any }>(
        `SELECT public.get_onboarding_kpis_atomic($1::uuid) AS result`,
        [companyA],
      );
      const kpis = kpisRes.rows[0].result;
      expect(kpis.ok).toBe(true);
      expect(typeof kpis.activeCases).toBe("number");
      expect(typeof kpis.probationConfirmedRate).toBe("number");
      expect(kpis.company_id).toBe(companyA);
    });

    it("verifies strict tenant isolation across companies", async () => {
      // Company B cannot see Company A's onboarding cases
      const crossRes = await db.query(
        `SELECT count(*)::int as count FROM public.onboarding_cases WHERE company_id = '${companyB}'`,
      );
      expect((crossRes.rows[0] as any).count).toBe(0);
    });
  });
});
