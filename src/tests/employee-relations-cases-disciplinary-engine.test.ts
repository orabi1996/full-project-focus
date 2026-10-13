// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: PRODUCTION EMPLOYEE RELATIONS, CASES, GRIEVANCES,
//            INVESTIGATIONS & DISCIPLINARY ENGINE TEST SUITE
// src/tests/employee-relations-cases-disciplinary-engine.test.ts
// ============================================================================

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  calculateSlaDueDate,
  isSlaBreached,
  isWarningValid,
  validateSeparationOfDuties,
  evaluateCaseAccess,
  formatCaseType,
  formatCaseStatus,
  formatConfidentialityLevel,
  formatSeverity,
  formatDecisionType,
  formatWarningLevel,
  formatAcknowledgementStatus,
  formatAppealStatus,
  formatFindingOutcome,
  formatGroundsForAppeal,
} from "../lib/domains/employee-relations";

describe("Prompt 32: Production Employee Relations, Cases, Grievances, Investigations & Disciplinary Engine", () => {
  // ==========================================================================
  // SECTION 1: PURE DOMAIN RULES & LOGIC TESTS
  // ==========================================================================
  describe("1. Pure Domain Logic & Rules", () => {
    it("calculates SLA due date accurately based on target resolution days", () => {
      const baseDate = "2026-10-01";
      const dueDate14 = calculateSlaDueDate(baseDate, 14);
      expect(dueDate14).toBe("2026-10-15");

      const dueDate30 = calculateSlaDueDate(baseDate, 30);
      expect(dueDate30).toBe("2026-10-31");
    });

    it("evaluates SLA breach accurately for open and resolved cases", () => {
      // Future date -> not breached
      const futureDate = "2099-12-31";
      expect(isSlaBreached(futureDate)).toBe(false);

      // Past date without resolution -> breached
      const pastDate = "2020-01-01";
      expect(isSlaBreached(pastDate)).toBe(true);

      // Past date resolved before deadline -> not breached
      expect(isSlaBreached("2026-10-15", "2026-10-10T12:00:00Z")).toBe(false);

      // Past date resolved after deadline -> breached
      expect(isSlaBreached("2026-10-15", "2026-10-20T12:00:00Z")).toBe(true);
    });

    it("verifies warning validity period correctly", () => {
      // Valid future date
      expect(isWarningValid("2026-01-01", "2099-12-31")).toBe(true);

      // Expired past date
      expect(isWarningValid("2020-01-01", "2020-06-30")).toBe(false);
    });

    it("strictly enforces separation of duties: appeals officer cannot be investigator or decision maker", () => {
      const investigatorId = "emp-inv-001";
      const decisionMakerId = "emp-dec-002";
      const appealsOfficerId = "emp-app-003";

      // 1. Investigator trying to review appeal -> REJECT
      const check1 = validateSeparationOfDuties(investigatorId, investigatorId, decisionMakerId);
      expect(check1.allowed).toBe(false);
      expect(check1.reason).toContain("لا يجوز لمحقق القضية الأصلي");

      // 2. Decision Maker trying to review appeal -> REJECT
      const check2 = validateSeparationOfDuties(decisionMakerId, investigatorId, decisionMakerId);
      expect(check2.allowed).toBe(false);
      expect(check2.reason).toContain("لا يجوز لمتخذ القرار الأصلي");

      // 3. Independent appeals officer -> ALLOW
      const check3 = validateSeparationOfDuties(appealsOfficerId, investigatorId, decisionMakerId);
      expect(check3.allowed).toBe(true);
      expect(check3.reason).toBeUndefined();
    });

    it("evaluates confidentiality and access permissions according to role and explicit grants", () => {
      const standardCase = {
        confidentialityLevel: "standard_hr" as const,
        subjectEmployeeId: "emp-subj",
        complainantEmployeeId: "emp-comp",
        assignedInvestigatorId: "emp-inv",
      };

      const highlyConfidentialCase = {
        confidentialityLevel: "highly_confidential" as const,
        subjectEmployeeId: "emp-subj",
        complainantEmployeeId: "emp-comp",
        assignedInvestigatorId: "emp-inv",
      };

      // Super Admin on standard case -> Full access
      const saAccess = evaluateCaseAccess(standardCase, "admin-user", "super_admin");
      expect(saAccess.canView).toBe(true);
      expect(saAccess.canManage).toBe(true);
      expect(saAccess.isMasked).toBe(false);

      // Super Admin on highly confidential without explicit grant -> View denied
      const saRestricted = evaluateCaseAccess(highlyConfidentialCase, "admin-user", "super_admin", []);
      expect(saRestricted.canView).toBe(false);

      // Super Admin on highly confidential WITH explicit grant -> Access allowed
      const saGranted = evaluateCaseAccess(highlyConfidentialCase, "admin-user", "super_admin", ["admin-user"]);
      expect(saGranted.canView).toBe(true);
      expect(saGranted.canManage).toBe(true);

      // Subject employee -> Masked view only, cannot manage
      const subjAccess = evaluateCaseAccess(standardCase, "emp-subj", "employee");
      expect(subjAccess.canView).toBe(true);
      expect(subjAccess.canManage).toBe(false);
      expect(subjAccess.isMasked).toBe(true);

      // Complainant employee -> Masked view only
      const compAccess = evaluateCaseAccess(standardCase, "emp-comp", "employee");
      expect(compAccess.canView).toBe(true);
      expect(compAccess.canManage).toBe(false);
      expect(compAccess.isMasked).toBe(true);

      // Unrelated employee -> Access completely denied
      const randomAccess = evaluateCaseAccess(standardCase, "emp-other", "employee");
      expect(randomAccess.canView).toBe(false);
      expect(randomAccess.canManage).toBe(false);
    });

    it("formats and localizes case metadata accurately", () => {
      expect(formatCaseType("grievance", "ar")).toBe("تظلم موظف");
      expect(formatCaseType("misconduct", "ar")).toBe("سوء سلوك مهني");
      expect(formatCaseStatus("investigation", "ar")).toBe("تحقيق رسمي جارٍ");
      expect(formatConfidentialityLevel("highly_confidential", "ar")).toBe("سري للغاية");
      expect(formatSeverity("critical", "ar")).toBe("حرجة للغاية");
      expect(formatDecisionType("formal_warning", "ar")).toBe("إصدار إنذار كتابي رسمي");
      expect(formatWarningLevel("final", "ar")).toBe("إنذار كتابي نهائي");
      expect(formatAcknowledgementStatus("acknowledged", "ar")).toBe("تم التوقيع والاستلام");
      expect(formatAcknowledgementStatus("refused_to_sign", "ar")).toBe("امتنع الموظف عن التوقيع (مثبت بمحضر)");
      expect(formatAppealStatus("upheld", "ar")).toBe("تأييد القرار الأصلي");
      expect(formatFindingOutcome("substantiated", "ar")).toBe("ثبوت المخالفة بالأدلة");
      expect(formatGroundsForAppeal("procedural_defect", "ar")).toBe("عيب إجرائي في التحقيق أو الإخطار");
    });
  });

  // ==========================================================================
  // SECTION 2 & 3: PGLITE DATABASE MIGRATION & ATOMIC RPCS
  // ==========================================================================
  describe("2 & 3. Database Migration & Atomic Stored Procedures (PGlite)", () => {
    let db: PGlite;
    let companyId: string;
    let subjectEmpId: string;
    let complainantEmpId: string;
    let investigatorEmpId: string;
    let decisionMakerEmpId: string;
    let appealsOfficerEmpId: string;
    let witnessEmpId: string;

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
          employee_no text,
          first_name_ar text,
          last_name_ar text,
          status text NOT NULL DEFAULT 'active',
          department_id uuid REFERENCES public.departments(id),
          job_title_ar text,
          created_at timestamptz DEFAULT now()
        );
      `);

      // 2. Load and run Prompt 32 Migration SQL
      const migrationSql = readFileSync(
        "supabase/migrations/20261014000000_production_employee_relations_cases_disciplinary_engine.sql",
        "utf8"
      );
      await db.exec(migrationSql);

      // 3. Seed Companies, Departments, and Employees
      const companyRes = await db.query<{ id: string }>(
        `INSERT INTO public.companies (name) VALUES ('شركة مدار إكس للحلول المتكاملة') RETURNING id;`
      );
      companyId = companyRes.rows[0].id;

      const deptRes = await db.query<{ id: string }>(
        `INSERT INTO public.departments (company_id, name_ar, name_en)
         VALUES ($1, 'إدارة العمليات', 'Operations') RETURNING id;`,
        [companyId]
      );
      const deptId = deptRes.rows[0].id;

      // Seed 6 employees: Subject, Complainant, Investigator, Decision Maker, Appeals Officer, Witness
      const e1 = await db.query<{ id: string }>(
        `INSERT INTO public.employees (company_id, employee_no, first_name_ar, last_name_ar, department_id, job_title_ar)
         VALUES ($1, 'EMP-101', 'أحمد', 'الغامدي', $2, 'أخصائي عمليات') RETURNING id;`,
        [companyId, deptId]
      );
      subjectEmpId = e1.rows[0].id;

      const e2 = await db.query<{ id: string }>(
        `INSERT INTO public.employees (company_id, employee_no, first_name_ar, last_name_ar, department_id, job_title_ar)
         VALUES ($1, 'EMP-102', 'سارة', 'العتيبي', $2, 'مشرفة فريق') RETURNING id;`,
        [companyId, deptId]
      );
      complainantEmpId = e2.rows[0].id;

      const e3 = await db.query<{ id: string }>(
        `INSERT INTO public.employees (company_id, employee_no, first_name_ar, last_name_ar, department_id, job_title_ar)
         VALUES ($1, 'EMP-103', 'عبدالله', 'الشهري', $2, 'محقق إداري أول') RETURNING id;`,
        [companyId, deptId]
      );
      investigatorEmpId = e3.rows[0].id;

      const e4 = await db.query<{ id: string }>(
        `INSERT INTO public.employees (company_id, employee_no, first_name_ar, last_name_ar, department_id, job_title_ar)
         VALUES ($1, 'EMP-104', 'خالد', 'القحطاني', $2, 'رئيس لجنة الجزاءات') RETURNING id;`,
        [companyId, deptId]
      );
      decisionMakerEmpId = e4.rows[0].id;

      const e5 = await db.query<{ id: string }>(
        `INSERT INTO public.employees (company_id, employee_no, first_name_ar, last_name_ar, department_id, job_title_ar)
         VALUES ($1, 'EMP-105', 'فهد', 'الدوسري', $2, 'رئيس لجنة التظلمات العليا') RETURNING id;`,
        [companyId, deptId]
      );
      appealsOfficerEmpId = e5.rows[0].id;

      const e6 = await db.query<{ id: string }>(
        `INSERT INTO public.employees (company_id, employee_no, first_name_ar, last_name_ar, department_id, job_title_ar)
         VALUES ($1, 'EMP-106', 'محمد', 'الزهراني', $2, 'شاهد إداري') RETURNING id;`,
        [companyId, deptId]
      );
      witnessEmpId = e6.rows[0].id;
    });

    afterAll(async () => {
      await db?.close();
    });

    it("verifies all 17 employee relations tables exist in the database schema", async () => {
      const res = await db.query<{ table_name: string }>(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND (table_name LIKE 'er_%')
        ORDER BY table_name;
      `);
      const tables = res.rows.map((r) => r.table_name);
      expect(tables).toContain("er_case_sequences");
      expect(tables).toContain("er_cases");
      expect(tables).toContain("er_case_participants");
      expect(tables).toContain("er_case_access_grants");
      expect(tables).toContain("er_case_notes");
      expect(tables).toContain("er_case_investigations");
      expect(tables).toContain("er_investigation_steps");
      expect(tables).toContain("er_case_witnesses");
      expect(tables).toContain("er_case_interviews");
      expect(tables).toContain("er_case_evidence");
      expect(tables).toContain("er_case_findings");
      expect(tables).toContain("er_disciplinary_action_catalog");
      expect(tables).toContain("er_case_decisions");
      expect(tables).toContain("er_employee_disciplinary_actions");
      expect(tables).toContain("er_employee_warnings");
      expect(tables).toContain("er_case_appeals");
      expect(tables).toContain("er_corrective_action_plans");
    });

    it("generates atomic monotonically increasing business reference numbers (ER-YYYY-XXXXXX)", async () => {
      const num1 = await db.query<{ generate_er_reference_number: string }>(
        `SELECT public.generate_er_reference_number($1, 'case');`,
        [companyId]
      );
      const num2 = await db.query<{ generate_er_reference_number: string }>(
        `SELECT public.generate_er_reference_number($1, 'case');`,
        [companyId]
      );

      const year = new Date().getFullYear();
      expect(num1.rows[0].generate_er_reference_number).toBe(`ER-${year}-000001`);
      expect(num2.rows[0].generate_er_reference_number).toBe(`ER-${year}-000002`);
    });

    it("executes create_er_case_atomic: registers case, automatically enrolls participants and logs initial note", async () => {
      const createRes = await db.query<{ create_er_case_atomic: any }>(
        `SELECT public.create_er_case_atomic(
          $1,
          'شكوى اعتداء لفظي ومخالفة سياسة بيئة العمل',
          'قام الموظف بالتلفظ بألفاظ غير مقبولة خلال اجتماع القسم صباح يوم الأحد',
          'misconduct',
          'restricted_hr',
          'high',
          $2,
          $3,
          false,
          '2026-10-10'::date,
          14
        );`,
        [companyId, subjectEmpId, complainantEmpId]
      );

      const result = createRes.rows[0].create_er_case_atomic;
      expect(result.success).toBe(true);
      expect(result.case_id).toBeDefined();
      expect(result.case_number).toMatch(/^ER-\d{4}-\d{6}$/);
      expect(result.status).toBe("submitted");

      // Verify participant auto-enrollment
      const partRes = await db.query<{ participant_role: string }>(
        `SELECT participant_role FROM public.er_case_participants WHERE case_id = $1 ORDER BY participant_role;`,
        [result.case_id]
      );
      const roles = partRes.rows.map((r) => r.participant_role);
      expect(roles).toContain("complainant");
      expect(roles).toContain("subject");

      // Verify initial system note
      const noteRes = await db.query<{ note_type: string; content: string }>(
        `SELECT note_type, content FROM public.er_case_notes WHERE case_id = $1;`,
        [result.case_id]
      );
      expect(noteRes.rows.length).toBeGreaterThan(0);
      expect(noteRes.rows[0].note_type).toBe("system_event");
    });

    it("executes triage_er_case_atomic: updates case status, assigns investigator and enrolls in participants", async () => {
      // Create a test case
      const cRes = await db.query<{ create_er_case_atomic: any }>(
        `SELECT public.create_er_case_atomic($1, 'تظلم بخصوص خصم غير نظامي', 'شرح التظلم', 'grievance', 'standard_hr', 'medium', $2, $2);`,
        [companyId, subjectEmpId]
      );
      const caseId = cRes.rows[0].create_er_case_atomic.case_id;

      // Triage
      const triageRes = await db.query<{ triage_er_case_atomic: any }>(
        `SELECT public.triage_er_case_atomic(
          $1,
          'under_review',
          'medium',
          $2,
          $3,
          'تمت مراجعة التظلم وإحالته للمحقق للتحقق من كشوفات البصمة'
        );`,
        [caseId, investigatorEmpId, decisionMakerEmpId]
      );

      const tResult = triageRes.rows[0].triage_er_case_atomic;
      expect(tResult.success).toBe(true);
      expect(tResult.new_status).toBe("under_review");

      // Check that investigator was enrolled in participants
      const pCheck = await db.query<{ count: string }>(
        `SELECT count(*) FROM public.er_case_participants WHERE case_id = $1 AND employee_id = $2 AND participant_role = 'investigator';`,
        [caseId, investigatorEmpId]
      );
      expect(Number(pCheck.rows[0].count)).toBe(1);
    });

    it("executes start_er_investigation_atomic: launches investigation and generates structured 4-step protocol", async () => {
      const cRes = await db.query<{ create_er_case_atomic: any }>(
        `SELECT public.create_er_case_atomic($1, 'قضية إفشاء بيانات غير مصرح بها', 'تفاصيل', 'policy_violation', 'legal_sensitive', 'high', $2);`,
        [companyId, subjectEmpId]
      );
      const caseId = cRes.rows[0].create_er_case_atomic.case_id;

      const invRes = await db.query<{ start_er_investigation_atomic: any }>(
        `SELECT public.start_er_investigation_atomic(
          $1,
          'التحقيق في تسريب تقرير الأجور الداخلي',
          'مراجعة سجلات البريد الإلكتروني والبصمة الرقمية',
          $2,
          '2026-10-25'::date
        );`,
        [caseId, investigatorEmpId]
      );

      const iResult = invRes.rows[0].start_er_investigation_atomic;
      expect(iResult.success).toBe(true);
      expect(iResult.investigation_number).toMatch(/^INV-\d{4}-\d{6}$/);

      // Verify case status shifted to 'investigation'
      const caseCheck = await db.query<{ status: string }>(
        `SELECT status FROM public.er_cases WHERE id = $1;`,
        [caseId]
      );
      expect(caseCheck.rows[0].status).toBe("investigation");

      // Verify the 4 default investigation steps were created
      const stepsCheck = await db.query<{ step_order: number; title: string }>(
        `SELECT step_order, title FROM public.er_investigation_steps WHERE investigation_id = $1 ORDER BY step_order;`,
        [iResult.investigation_id]
      );
      expect(stepsCheck.rows.length).toBe(4);
      expect(stepsCheck.rows[0].title).toContain("فحص الأدلة والمستندات");
      expect(stepsCheck.rows[1].title).toContain("سماع أقوال الشاكي والشهود");
      expect(stepsCheck.rows[2].title).toContain("جلسة التحقيق ومواجهة الموظف");
      expect(stepsCheck.rows[3].title).toContain("صياغة التقرير النهائي");
    });

    it("executes record_er_decision_atomic: issues formal decision with appeal deadline calculation", async () => {
      const cRes = await db.query<{ create_er_case_atomic: any }>(
        `SELECT public.create_er_case_atomic($1, 'مخالفة انضباط سلوكي', 'تفاصيل', 'misconduct', 'standard_hr', 'medium', $2);`,
        [companyId, subjectEmpId]
      );
      const caseId = cRes.rows[0].create_er_case_atomic.case_id;

      const decRes = await db.query<{ record_er_decision_atomic: any }>(
        `SELECT public.record_er_decision_atomic(
          $1,
          $2,
          'formal_warning',
          'توجيه إنذار كتابي رسمي أول للموظف استناداً للمادة 66 من لائحة العمل',
          'ثبوت الواقعة بموجب محضر التحقيق رقم INV-2026-000001',
          CURRENT_DATE,
          true,
          15
        );`,
        [caseId, decisionMakerEmpId]
      );

      const dResult = decRes.rows[0].record_er_decision_atomic;
      expect(dResult.success).toBe(true);
      expect(dResult.decision_number).toMatch(/^DEC-\d{4}-\d{6}$/);
      expect(dResult.new_status).toBe("action_required");
      expect(dResult.appeal_deadline).toBeDefined();
    });

    it("executes issue_disciplinary_action_atomic: creates employee warning letter record awaiting acknowledgement", async () => {
      const cRes = await db.query<{ create_er_case_atomic: any }>(
        `SELECT public.create_er_case_atomic($1, 'مخالفة تأخير متكرر', 'تفاصيل', 'attendance_discipline', 'standard_hr', 'low', $2);`,
        [companyId, subjectEmpId]
      );
      const caseId = cRes.rows[0].create_er_case_atomic.case_id;

      const decRes = await db.query<{ record_er_decision_atomic: any }>(
        `SELECT public.record_er_decision_atomic($1, $2, 'formal_warning', 'إنذار كتابي أول', 'حيثيات');`,
        [caseId, decisionMakerEmpId]
      );
      const decisionId = decRes.rows[0].record_er_decision_atomic.decision_id;

      const actionRes = await db.query<{ issue_disciplinary_action_atomic: any }>(
        `SELECT public.issue_disciplinary_action_atomic(
          $1,
          $2,
          $3,
          NULL,
          'written_warning',
          'إنذار كتابي أول لمخالفة تعليمات الدوام',
          'تكرار التأخر الصباحي لأكثر من 5 مرات خلال الشهر',
          'first_written',
          180
        );`,
        [caseId, decisionId, subjectEmpId]
      );

      const aResult = actionRes.rows[0].issue_disciplinary_action_atomic;
      expect(aResult.success).toBe(true);
      expect(aResult.action_id).toBeDefined();
      expect(aResult.warning_id).toBeDefined();
      expect(aResult.warning_number).toMatch(/^WRN-\d{4}-\d{6}$/);

      // Verify warning record is pending acknowledgement
      const wrnCheck = await db.query<{ acknowledgement_status: string; is_active: boolean }>(
        `SELECT acknowledgement_status, is_active FROM public.er_employee_warnings WHERE id = $1;`,
        [aResult.warning_id]
      );
      expect(wrnCheck.rows[0].acknowledgement_status).toBe("pending_acknowledgement");
      expect(wrnCheck.rows[0].is_active).toBe(true);
    });

    it("executes acknowledge_warning_atomic: supports employee sign-off or recording refusal with witness", async () => {
      // 1. Create a warning to acknowledge
      const cRes = await db.query<{ create_er_case_atomic: any }>(
        `SELECT public.create_er_case_atomic($1, 'مخالفة 1', 'تفاصيل', 'misconduct', 'standard_hr', 'low', $2);`,
        [companyId, subjectEmpId]
      );
      const caseId = cRes.rows[0].create_er_case_atomic.case_id;
      const decRes = await db.query<{ record_er_decision_atomic: any }>(
        `SELECT public.record_er_decision_atomic($1, $2, 'formal_warning', 'إنذار', 'حيثيات');`,
        [caseId, decisionMakerEmpId]
      );
      const decId = decRes.rows[0].record_er_decision_atomic.decision_id;

      const aRes1 = await db.query<{ issue_disciplinary_action_atomic: any }>(
        `SELECT public.issue_disciplinary_action_atomic($1, $2, $3, NULL, 'written_warning', 'إنذار كتابي', 'تفاصيل', 'first_written', 180);`,
        [caseId, decId, subjectEmpId]
      );
      const warningId1 = aRes1.rows[0].issue_disciplinary_action_atomic.warning_id;

      // Positive acknowledgement
      const ackRes = await db.query<{ acknowledge_warning_atomic: any }>(
        `SELECT public.acknowledge_warning_atomic($1, 'acknowledged', 'أتعهد بالالتزام بالتعليمات مستقبلاً');`,
        [warningId1]
      );
      expect(ackRes.rows[0].acknowledge_warning_atomic.success).toBe(true);
      expect(ackRes.rows[0].acknowledge_warning_atomic.status).toBe("acknowledged");

      // 2. Refusal to sign with witness
      const aRes2 = await db.query<{ issue_disciplinary_action_atomic: any }>(
        `SELECT public.issue_disciplinary_action_atomic($1, $2, $3, NULL, 'final_warning', 'إنذار نهائي', 'تفاصيل', 'final', 180);`,
        [caseId, decId, subjectEmpId]
      );
      const warningId2 = aRes2.rows[0].issue_disciplinary_action_atomic.warning_id;

      const refRes = await db.query<{ acknowledge_warning_atomic: any }>(
        `SELECT public.acknowledge_warning_atomic(
          $1,
          'refused_to_sign',
          NULL,
          $2,
          'تم تسليم الإنذار للموظف ورفض التوقيع بحضور المشرف'
        );`,
        [warningId2, witnessEmpId]
      );
      expect(refRes.rows[0].acknowledge_warning_atomic.success).toBe(true);
      expect(refRes.rows[0].acknowledge_warning_atomic.status).toBe("refused_to_sign");

      const refCheck = await db.query<{ refusal_witness_id: string; refusal_notes: string }>(
        `SELECT refusal_witness_id, refusal_notes FROM public.er_employee_warnings WHERE id = $1;`,
        [warningId2]
      );
      expect(refCheck.rows[0].refusal_witness_id).toBe(witnessEmpId);
      expect(refCheck.rows[0].refusal_notes).toContain("رفض التوقيع بحضور المشرف");
    });

    it("executes submit_er_appeal_atomic: files formal appeal and shifts case status to appeal_pending", async () => {
      const cRes = await db.query<{ create_er_case_atomic: any }>(
        `SELECT public.create_er_case_atomic($1, 'قضية قابلة للاستئناف', 'تفاصيل', 'policy_violation', 'standard_hr', 'medium', $2);`,
        [companyId, subjectEmpId]
      );
      const caseId = cRes.rows[0].create_er_case_atomic.case_id;

      const decRes = await db.query<{ record_er_decision_atomic: any }>(
        `SELECT public.record_er_decision_atomic($1, $2, 'formal_warning', 'إنذار كتابي', 'حيثيات', CURRENT_DATE, true, 15);`,
        [caseId, decisionMakerEmpId]
      );
      const decId = decRes.rows[0].record_er_decision_atomic.decision_id;

      const appealRes = await db.query<{ submit_er_appeal_atomic: any }>(
        `SELECT public.submit_er_appeal_atomic(
          $1,
          $2,
          $3,
          'procedural_defect',
          'لم يتم استدعائي لجلسة الاستجواب ومواجهتي بالأدلة وفق الإجراء النظامي'
        );`,
        [caseId, decId, subjectEmpId]
      );

      const apResult = appealRes.rows[0].submit_er_appeal_atomic;
      expect(apResult.success).toBe(true);
      expect(apResult.appeal_number).toMatch(/^APL-\d{4}-\d{6}$/);

      // Verify case status shifted to 'appeal_pending'
      const caseCheck = await db.query<{ status: string }>(
        `SELECT status FROM public.er_cases WHERE id = $1;`,
        [caseId]
      );
      expect(caseCheck.rows[0].status).toBe("appeal_pending");
    });

    it("executes get_er_dashboard_kpis_atomic: calculates real-time enterprise metrics accurately", async () => {
      const kpiRes = await db.query<{ get_er_dashboard_kpis_atomic: any }>(
        `SELECT public.get_er_dashboard_kpis_atomic($1);`,
        [companyId]
      );

      const kpis = kpiRes.rows[0].get_er_dashboard_kpis_atomic;
      expect(kpis.total_cases).toBeGreaterThan(0);
      expect(kpis.open_cases).toBeGreaterThan(0);
      expect(kpis.active_warnings).toBeGreaterThan(0);
      expect(kpis.open_appeals).toBeGreaterThan(0);
      expect(typeof kpis.avg_resolution_days).toBe("number");
      expect(typeof kpis.grievance_resolution_rate).toBe("number");
      expect(typeof kpis.case_type_counts).toBe("object");
    });
  });
});
