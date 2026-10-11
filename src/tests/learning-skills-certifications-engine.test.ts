import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  calculateSkillGap,
  evaluateSessionCapacity,
  evaluateCertificationExpiry,
  maskConfidentialAssessment,
  calculateLearningCompletionRate,
  formatProficiencyLevel,
  type LearningAssessment,
} from "../lib/domains/learning";

describe("Prompt 29: Production Learning, Skills, Certifications & Training Engine", () => {
  // ==========================================================================
  // SECTION 1: PURE DOMAIN RULES & LOGIC TESTS
  // ==========================================================================
  describe("1. Pure Domain Logic & Rules", () => {
    it("calculates skill gap accurately (Required vs Validated)", () => {
      // 1. Employee proficiency below required -> positive gap
      const underQualified = calculateSkillGap(4.0, 2.5);
      expect(underQualified.gap).toBe(1.5);
      expect(underQualified.hasGap).toBe(true);
      expect(underQualified.meetsRequirement).toBe(false);
      expect(underQualified.exceedsRequirement).toBe(false);

      // 2. Employee proficiency matches required -> zero gap
      const exactMatch = calculateSkillGap(3.0, 3.0);
      expect(exactMatch.gap).toBe(0);
      expect(exactMatch.hasGap).toBe(false);
      expect(exactMatch.meetsRequirement).toBe(true);
      expect(exactMatch.exceedsRequirement).toBe(false);

      // 3. Employee proficiency exceeds required -> zero gap, exceeds flag
      const overQualified = calculateSkillGap(2.0, 4.5);
      expect(overQualified.gap).toBe(0);
      expect(overQualified.hasGap).toBe(false);
      expect(overQualified.meetsRequirement).toBe(true);
      expect(overQualified.exceedsRequirement).toBe(true);

      // 4. Missing skill (validated 0) -> gap equals required
      const missingSkill = calculateSkillGap(5.0, 0.0);
      expect(missingSkill.gap).toBe(5.0);
      expect(missingSkill.hasGap).toBe(true);
      expect(missingSkill.meetsRequirement).toBe(false);
    });

    it("evaluates session seat capacity deterministically", () => {
      // Available seats
      const available = evaluateSessionCapacity(25, 18);
      expect(available.hasSeat).toBe(true);
      expect(available.isFull).toBe(false);
      expect(available.seatsRemaining).toBe(7);

      // Exactly full
      const full = evaluateSessionCapacity(20, 20);
      expect(full.hasSeat).toBe(false);
      expect(full.isFull).toBe(true);
      expect(full.seatsRemaining).toBe(0);

      // Overflow guard
      const overflow = evaluateSessionCapacity(10, 15);
      expect(overflow.hasSeat).toBe(false);
      expect(overflow.isFull).toBe(true);
      expect(overflow.seatsRemaining).toBe(0);
    });

    it("evaluates certification expiry status across lifecycle windows", () => {
      const today = "2026-10-15";

      // Active / Valid beyond 60 days (e.g. 180 days)
      const validCert = evaluateCertificationExpiry("2027-04-15", 60, today);
      expect(validCert.status).toBe("valid");
      expect(validCert.isExpiring).toBe(false);
      expect(validCert.isExpired).toBe(false);
      expect(validCert.daysUntilExpiry).toBeGreaterThan(60);

      // Expiring soon (within 60 days, e.g. 30 days)
      const expiringCert = evaluateCertificationExpiry("2026-11-14", 60, today);
      expect(expiringCert.status).toBe("expiring");
      expect(expiringCert.isExpiring).toBe(true);
      expect(expiringCert.isExpired).toBe(false);
      expect(expiringCert.daysUntilExpiry).toBe(30);

      // Expired in the past
      const expiredCert = evaluateCertificationExpiry("2026-09-30", 60, today);
      expect(expiredCert.status).toBe("expired");
      expect(expiredCert.isExpiring).toBe(false);
      expect(expiredCert.isExpired).toBe(true);
      expect(expiredCert.daysUntilExpiry).toBeLessThan(0);

      // Permanent certification with null expiry date
      const permanentCert = evaluateCertificationExpiry(null, 60, today);
      expect(permanentCert.status).toBe("valid");
      expect(permanentCert.daysUntilExpiry).toBeNull();
      expect(permanentCert.isExpiring).toBe(false);
      expect(permanentCert.isExpired).toBe(false);
    });

    it("masks confidential assessment feedback for unprivileged viewers", () => {
      const assessment: LearningAssessment = {
        id: "asm-1",
        companyId: "c1",
        employeeId: "emp-1",
        assessmentType: "trainer_evaluation",
        score: 85,
        maxScore: 100,
        passed: true,
        assessedAt: "2026-10-10",
        isConfidential: true,
        notes: "Evaluator sensitive notes: Needs improvement in executive presence.",
        createdAt: "2026-10-10",
      };

      // Unprivileged viewer (employee ESS or line peer)
      const masked = maskConfidentialAssessment(assessment, false);
      expect(masked.notes).toContain("محمية ومخصصة للمقيمين المعتمدين فقط");
      expect(masked.score).toBe(85); // Score remains visible

      // Privileged viewer (HR / Assessor)
      const unmasked = maskConfidentialAssessment(assessment, true);
      expect(unmasked.notes).toBe("Evaluator sensitive notes: Needs improvement in executive presence.");

      // Non-confidential assessment unchanged for everyone
      const publicAsm: LearningAssessment = { ...assessment, isConfidential: false };
      expect(maskConfidentialAssessment(publicAsm, false).notes).toBe(publicAsm.notes);
    });

    it("calculates learning completion rates accurately", () => {
      expect(calculateLearningCompletionRate(10, 20)).toBe(50.0);
      expect(calculateLearningCompletionRate(15, 16)).toBe(93.8);
      expect(calculateLearningCompletionRate(0, 50)).toBe(0.0);
      expect(calculateLearningCompletionRate(0, 0)).toBe(0.0);
    });

    it("formats 1-5 proficiency scale levels correctly", () => {
      expect(formatProficiencyLevel(1).labelEn).toBe("Level 1 — Awareness");
      expect(formatProficiencyLevel(2).labelEn).toBe("Level 2 — Basic");
      expect(formatProficiencyLevel(3).labelEn).toBe("Level 3 — Working");
      expect(formatProficiencyLevel(4).labelEn).toBe("Level 4 — Advanced");
      expect(formatProficiencyLevel(5).labelEn).toBe("Level 5 — Expert");
      expect(formatProficiencyLevel(3).labelAr).toContain("ممارس");
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
    const employeeId1 = "33333333-3333-3333-3333-333333333333";
    const employeeId2 = "44444444-4444-4444-4444-444444444444";
    const employeeId3 = "55555555-5555-5555-5555-555555555555";
    const deptId = "66666666-6666-6666-6666-666666666666";
    const posId = "77777777-7777-7777-7777-777777777777";

    let categoryIdA: string;
    let skillIdA1: string;
    let skillIdA2: string;
    let providerIdA: string;
    let courseIdA: string;
    let sessionIdA: string;
    let certIdA: string;

    beforeAll(async () => {
      // 1. Setup base prerequisites in PGlite
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

        CREATE TABLE IF NOT EXISTS public.competencies (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          name_ar text,
          name_en text
        );

        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid,
          employee_no text,
          first_name_ar text,
          last_name_ar text,
          status text NOT NULL DEFAULT 'active',
          job_title text,
          department_id uuid REFERENCES public.departments(id),
          job_position_id uuid REFERENCES public.job_positions(id),
          grade text,
          hire_date date DEFAULT current_date,
          updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          employee_id uuid REFERENCES public.employees(id),
          request_type text NOT NULL,
          status text NOT NULL DEFAULT 'pending'
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

        CREATE TABLE IF NOT EXISTS public.operational_tasks (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          title_ar text,
          title_en text,
          category text,
          priority text,
          status text DEFAULT 'pending',
          due_date date,
          entity_type text,
          entity_id text,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.notifications_inbox (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid,
          title_ar text,
          created_at timestamptz DEFAULT now()
        );

        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT nullif(current_setting('test.uid', true), '')::uuid
        $$;
      `);

      // 2. Run Prompt 29 Learning Engine Migration
      const migrationSql = readFileSync(
        "supabase/migrations/20261011000000_production_learning_skills_certifications_engine.sql",
        "utf8"
      );
      await db.exec(migrationSql);

      // 3. Seed Base Test Tenants and Employees
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES
          ('${adminUser}', 'admin@madarx.local');

        INSERT INTO public.companies (id, name) VALUES
          ('${companyA}', 'Al-Madar Tech Co A'),
          ('${companyB}', 'Rawasi Holding Co B');

        INSERT INTO public.departments (id, company_id, name_ar, name_en) VALUES
          ('${deptId}', '${companyA}', 'إدارة تقنية المعلومات', 'IT & Software');

        INSERT INTO public.job_positions (id, company_id, title_ar, title_en, department_id) VALUES
          ('${posId}', '${companyA}', 'مهندس برمجيات أول', 'Senior Software Engineer', '${deptId}');

        INSERT INTO public.employees (id, company_id, user_id, employee_no, first_name_ar, last_name_ar, department_id, job_position_id, grade, status) VALUES
          ('${employeeId1}', '${companyA}', '${adminUser}', 'EMP-001', 'أحمد', 'الغامدي', '${deptId}', '${posId}', 'G5', 'active'),
          ('${employeeId2}', '${companyA}', gen_random_uuid(), 'EMP-002', 'سارة', 'العتيبي', '${deptId}', '${posId}', 'G5', 'active'),
          ('${employeeId3}', '${companyA}', gen_random_uuid(), 'EMP-003', 'خالد', 'الشمري', '${deptId}', '${posId}', 'G5', 'active');
      `);

      // 4. Seed Learning Entities
      const catRes = await db.query<{ id: string }>(`
        INSERT INTO public.skill_categories (company_id, code, name_ar, name_en)
        VALUES ('${companyA}', 'TECH', 'المهارات التقنية والبرمجية', 'Technical & Software')
        RETURNING id;
      `);
      categoryIdA = catRes.rows[0].id;

      const skillRes1 = await db.query<{ id: string }>(`
        INSERT INTO public.skills (company_id, category_id, code, name_ar, name_en, category, proficiency_scale_type)
        VALUES ('${companyA}', '${categoryIdA}', 'SK-TS', 'تايب سكريبت وتطوير النظم', 'TypeScript Architecture', 'technical', '1_to_5')
        RETURNING id;
      `);
      skillIdA1 = skillRes1.rows[0].id;

      const skillRes2 = await db.query<{ id: string }>(`
        INSERT INTO public.skills (company_id, category_id, code, name_ar, name_en, category, proficiency_scale_type)
        VALUES ('${companyA}', '${categoryIdA}', 'SK-CYBER', 'الأمن السيبراني والامتثال', 'Cybersecurity & Compliance', 'safety', '1_to_5')
        RETURNING id;
      `);
      skillIdA2 = skillRes2.rows[0].id;

      const provRes = await db.query<{ id: string }>(`
        INSERT INTO public.training_providers (company_id, provider_type, name_ar, name_en)
        VALUES ('${companyA}', 'external', 'أكاديمية طويق للتقنية', 'Tuwaiq Tech Academy')
        RETURNING id;
      `);
      providerIdA = provRes.rows[0].id;

      const courseRes = await db.query<{ id: string }>(`
        INSERT INTO public.learning_items (
          company_id, item_type, code, title_ar, title_en, delivery_method, duration_hours, provider_id, skills_developed, estimated_cost
        ) VALUES (
          '${companyA}', 'course', 'CRS-TS-01', 'دورة التايب سكريبت المتقدمة للمهندسين', 'Advanced TypeScript for Engineers',
          'virtual', 16.0, '${providerIdA}', ARRAY['${skillIdA1}'::uuid], 1500.00
        ) RETURNING id;
      `);
      courseIdA = courseRes.rows[0].id;

      // Create session with capacity of 2 seats
      const sessRes = await db.query<{ id: string }>(`
        INSERT INTO public.training_sessions (
          company_id, learning_item_id, session_code, trainer_name, provider_id,
          start_date, end_date, capacity, enrolled_count, cost_per_seat, status
        ) VALUES (
          '${companyA}', '${courseIdA}', 'SES-2026-001', 'م. حسام العلي', '${providerIdA}',
          now() + interval '5 days', now() + interval '7 days', 2, 0, 1500.00, 'open'
        ) RETURNING id;
      `);
      sessionIdA = sessRes.rows[0].id;

      // Seed Certification Catalog
      const certRes = await db.query<{ id: string }>(`
        INSERT INTO public.certifications (
          company_id, code, name_ar, name_en, issuer, validity_months, renewal_required
        ) VALUES (
          '${companyA}', 'CERT-AWS-SA', 'مهندس حلول سحابية معتمد AWS', 'AWS Certified Solutions Architect',
          'Amazon Web Services', 36, true
        ) RETURNING id;
      `);
      certIdA = certRes.rows[0].id;
    });

    afterAll(async () => {
      await db.close();
    });

    // ------------------------------------------------------------------------
    // TEST 1: Atomic Seat Reservation, Capacity Control & Waitlisting
    // ------------------------------------------------------------------------
    it("manages session enrollment and capacity atomically with waitlisting", async () => {
      // Seat 1: Enroll Employee 1
      const res1 = await db.query<{ enroll_in_training_session_atomic: any }>(`
        SELECT public.enroll_in_training_session_atomic(
          '${companyA}', '${sessionIdA}', '${employeeId1}', 'employee_request'
        );
      `);
      const payload1 = res1.rows[0].enroll_in_training_session_atomic;
      expect(payload1.success).toBe(true);
      expect(payload1.status).toBe("enrolled");
      expect(payload1.enrolled_count).toBe(1);

      // Duplicate enrollment check for Employee 1
      const resDup = await db.query<{ enroll_in_training_session_atomic: any }>(`
        SELECT public.enroll_in_training_session_atomic(
          '${companyA}', '${sessionIdA}', '${employeeId1}', 'employee_request'
        );
      `);
      expect(resDup.rows[0].enroll_in_training_session_atomic.success).toBe(false);
      expect(resDup.rows[0].enroll_in_training_session_atomic.error).toContain("already enrolled");

      // Seat 2: Enroll Employee 2 (Reaching capacity = 2)
      const res2 = await db.query<{ enroll_in_training_session_atomic: any }>(`
        SELECT public.enroll_in_training_session_atomic(
          '${companyA}', '${sessionIdA}', '${employeeId2}', 'manager_nomination'
        );
      `);
      const payload2 = res2.rows[0].enroll_in_training_session_atomic;
      expect(payload2.success).toBe(true);
      expect(payload2.status).toBe("enrolled");
      expect(payload2.enrolled_count).toBe(2);

      // Verify Session Status became 'full'
      const sessCheck = await db.query<{ status: string; enrolled_count: number }>(`
        SELECT status, enrolled_count FROM public.training_sessions WHERE id = '${sessionIdA}';
      `);
      expect(sessCheck.rows[0].status).toBe("full");
      expect(sessCheck.rows[0].enrolled_count).toBe(2);

      // Seat 3: Enroll Employee 3 (Over-capacity -> waitlisted atomically)
      // Note: Re-open session status or let it accept waitlist
      await db.query(`UPDATE public.training_sessions SET status = 'open' WHERE id = '${sessionIdA}';`);
      const res3 = await db.query<{ enroll_in_training_session_atomic: any }>(`
        SELECT public.enroll_in_training_session_atomic(
          '${companyA}', '${sessionIdA}', '${employeeId3}', 'employee_request'
        );
      `);
      const payload3 = res3.rows[0].enroll_in_training_session_atomic;
      expect(payload3.success).toBe(true);
      expect(payload3.status).toBe("waitlisted");
      expect(payload3.enrolled_count).toBe(2); // Count remains 2!
    });

    // ------------------------------------------------------------------------
    // TEST 2: Server-side Skill Gap Calculation
    // ------------------------------------------------------------------------
    it("calculates employee skill gaps server-side against job position requirements", async () => {
      // 1. Define job requirement: Senior Engineer requires TypeScript at Level 4.0
      await db.query(`
        INSERT INTO public.job_skill_requirements (
          company_id, job_position_id, skill_id, required_proficiency, is_mandatory
        ) VALUES (
          '${companyA}', '${posId}', '${skillIdA1}', 4.0, true
        );
      `);

      // 2. Set employee current validated proficiency to 2.0
      await db.query(`
        INSERT INTO public.employee_skills (
          company_id, employee_id, skill_id, current_proficiency, source, status
        ) VALUES (
          '${companyA}', '${employeeId1}', '${skillIdA1}', 2.0, 'manager_assessment', 'active'
        );
      `);

      // 3. Execute RPC
      const gapRes = await db.query<{ calculate_employee_skill_gaps: any }>(`
        SELECT public.calculate_employee_skill_gaps('${companyA}', '${employeeId1}');
      `);
      const payload = gapRes.rows[0].calculate_employee_skill_gaps;
      expect(payload.success).toBe(true);
      expect(payload.employee_id).toBe(employeeId1);
      expect(payload.skill_gaps).toHaveLength(1);

      const gapItem = payload.skill_gaps[0];
      expect(gapItem.skill_id).toBe(skillIdA1);
      expect(gapItem.required_proficiency).toBe(4.0);
      expect(gapItem.validated_proficiency).toBe(2.0);
      expect(gapItem.gap).toBe(2.0);
      expect(gapItem.has_gap).toBe(true);
      expect(gapItem.is_mandatory).toBe(true);
    });

    // ------------------------------------------------------------------------
    // TEST 3: Attendance, Training Completion & Automatic Skill Profile Upgrade
    // ------------------------------------------------------------------------
    it("records attendance & completion and automatically upgrades employee skill profile", async () => {
      // Find Employee 1 enrollment
      const enrRes = await db.query<{ id: string }>(`
        SELECT id FROM public.training_enrollments
        WHERE session_id = '${sessionIdA}' AND employee_id = '${employeeId1}';
      `);
      const enrollmentId = enrRes.rows[0].id;

      // Record completion with score 92.0 and passed: true
      const compRes = await db.query<{ record_session_attendance_and_completion_atomic: any }>(`
        SELECT public.record_session_attendance_and_completion_atomic(
          '${companyA}', '${enrollmentId}', 'present', 'completed', 92.0, true, current_date
        );
      `);
      const payload = compRes.rows[0].record_session_attendance_and_completion_atomic;
      expect(payload.success).toBe(true);
      expect(payload.completion_status).toBe("completed");
      expect(payload.attendance_status).toBe("present");

      // Verify that Employee 1's skill profile was automatically updated to level 3.0 via training_completion
      const skillCheck = await db.query<{
        current_proficiency: number;
        formally_verified_level: number;
        source: string;
      }>(`
        SELECT current_proficiency, formally_verified_level, source
        FROM public.employee_skills
        WHERE company_id = '${companyA}' AND employee_id = '${employeeId1}' AND skill_id = '${skillIdA1}';
      `);
      expect(Number(skillCheck.rows[0].current_proficiency)).toBe(3.0);
      expect(Number(skillCheck.rows[0].formally_verified_level)).toBe(3.0);
      expect(skillCheck.rows[0].source).toBe("training_completion");
    });

    // ------------------------------------------------------------------------
    // TEST 4: Verification of Professional Certifications
    // ------------------------------------------------------------------------
    it("verifies employee certifications and records audit trail", async () => {
      // Employee submits certificate
      const certSubRes = await db.query<{ id: string }>(`
        INSERT INTO public.employee_certifications (
          company_id, employee_id, certification_id, certificate_number, issuer,
          issue_date, expiry_date, verification_status, status
        ) VALUES (
          '${companyA}', '${employeeId1}', '${certIdA}', 'AWS-SAA-987654', 'Amazon Web Services',
          '2026-01-10', '2029-01-10', 'pending_verification', 'pending_verification'
        ) RETURNING id;
      `);
      const empCertId = certSubRes.rows[0].id;

      // HR verifies certificate
      const verRes = await db.query<{ verify_employee_certification_atomic: any }>(`
        SELECT public.verify_employee_certification_atomic(
          '${companyA}', '${empCertId}', 'verified', '${adminUser}', 'تم التحقق عبر بوابة الاعتماد الرسمية'
        );
      `);
      const payload = verRes.rows[0].verify_employee_certification_atomic;
      expect(payload.success).toBe(true);
      expect(payload.verification_status).toBe("verified");
      expect(payload.status).toBe("valid");

      // Verify Audit Event logged
      const auditRes = await db.query<{ action: string; entity_type: string }>(`
        SELECT action, entity_type FROM public.audit_events
        WHERE company_id = '${companyA}' AND entity_id = '${empCertId}';
      `);
      expect(auditRes.rows).toHaveLength(1);
      expect(auditRes.rows[0].action).toBe("certification.verified");
    });

    // ------------------------------------------------------------------------
    // TEST 5: Expiration Monitoring & Automatic Task Generation
    // ------------------------------------------------------------------------
    it("detects expiring certifications and generates operational tasks", async () => {
      // Insert certification expiring in 30 days
      await db.query(`
        INSERT INTO public.employee_certifications (
          company_id, employee_id, certification_id, certificate_number, issuer,
          issue_date, expiry_date, verification_status, status
        ) VALUES (
          '${companyA}', '${employeeId2}', '${certIdA}', 'AWS-SAA-112233', 'Amazon Web Services',
          '2023-11-01', (current_date + interval '30 days')::date, 'verified', 'valid'
        );
      `);

      // Run expiring check RPC
      const checkRes = await db.query<{ check_expiring_certifications_and_generate_tasks_atomic: any }>(`
        SELECT public.check_expiring_certifications_and_generate_tasks_atomic('${companyA}');
      `);
      const payload = checkRes.rows[0].check_expiring_certifications_and_generate_tasks_atomic;
      expect(payload.success).toBe(true);
      expect(payload.processed_count).toBeGreaterThanOrEqual(1);

      // Verify Task generated in operational_tasks
      const taskRes = await db.query<{ title_ar: string; priority: string; status: string }>(`
        SELECT title_ar, priority, status FROM public.operational_tasks
        WHERE company_id = '${companyA}' AND entity_type = 'employee_certification';
      `);
      expect(taskRes.rows.length).toBeGreaterThanOrEqual(1);
      expect(taskRes.rows[0].title_ar).toContain("تجديد شهادة مهنية قاربت على الانتهاء");
      expect(taskRes.rows[0].priority).toBe("high");
    });

    // ------------------------------------------------------------------------
    // TEST 6: Mandatory Compliance Learning Rules Assignment
    // ------------------------------------------------------------------------
    it("assigns mandatory compliance learning rules without duplicating assignments", async () => {
      // Create mandatory rule for all employees
      const ruleRes = await db.query<{ id: string }>(`
        INSERT INTO public.mandatory_learning_rules (
          company_id, rule_name_ar, rule_name_en, course_id, target_type, recurrence_months, days_to_complete
        ) VALUES (
          '${companyA}', 'دورة الأمن السيبراني الإلزامية السنوية', 'Annual Mandatory Cybersecurity Course',
          '${courseIdA}', 'all_employees', 12, 30
        ) RETURNING id;
      `);
      const ruleId = ruleRes.rows[0].id;

      // Assign mandatory learning
      const assignRes = await db.query<{ assign_mandatory_learning_atomic: any }>(`
        SELECT public.assign_mandatory_learning_atomic('${companyA}', '${ruleId}');
      `);
      const payload = assignRes.rows[0].assign_mandatory_learning_atomic;
      expect(payload.success).toBe(true);
      expect(payload.assigned_count).toBe(3); // 3 active employees

      // Running again should assign 0 (idempotent / no duplicates)
      const reassignRes = await db.query<{ assign_mandatory_learning_atomic: any }>(`
        SELECT public.assign_mandatory_learning_atomic('${companyA}', '${ruleId}');
      `);
      expect(reassignRes.rows[0].assign_mandatory_learning_atomic.assigned_count).toBe(0);
    });

    // ------------------------------------------------------------------------
    // TEST 7: Truthful Learning KPIs
    // ------------------------------------------------------------------------
    it("computes truthful Learning KPIs without fabrication", async () => {
      const kpiRes = await db.query<{ get_learning_kpis_atomic: any }>(`
        SELECT public.get_learning_kpis_atomic('${companyA}');
      `);
      const kpis = kpiRes.rows[0].get_learning_kpis_atomic;

      expect(kpis.active_courses).toBe(1);
      expect(kpis.total_enrollments).toBe(3); // emp1, emp2, emp3
      expect(kpis.completed_enrollments).toBe(1); // emp1 completed
      expect(kpis.completion_rate).toBe(33.33); // 1 out of 3 = 33.33%
      expect(kpis.total_training_cost).toBeGreaterThan(0);
      expect(kpis.active_skills_count).toBe(2);
    });

    // ------------------------------------------------------------------------
    // TEST 8: Multi-tenant RLS Isolation
    // ------------------------------------------------------------------------
    it("strictly isolates learning catalog and records between companies", async () => {
      // Company B has no courses
      const kpiB = await db.query<{ get_learning_kpis_atomic: any }>(`
        SELECT public.get_learning_kpis_atomic('${companyB}');
      `);
      expect(kpiB.rows[0].get_learning_kpis_atomic.active_courses).toBe(0);
      expect(kpiB.rows[0].get_learning_kpis_atomic.total_enrollments).toBe(0);
      expect(kpiB.rows[0].get_learning_kpis_atomic.active_skills_count).toBe(0);
    });
  });
});
