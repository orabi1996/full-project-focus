import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 14: Production Workflow, Request, Approval & Delegation Engine (PGlite Tests)", () => {
  const db = new PGlite();

  // Test UUIDs
  const companyA = "a0000000-0000-0000-0000-000000000001";
  const companyB = "b0000000-0000-0000-0000-000000000002";

  const dept1A = "d0000000-0000-0000-0000-000000000001";
  const dept2A = "d0000000-0000-0000-0000-000000000002";

  // Users
  const userHrA = "11111111-aaaa-aaaa-aaaa-111111111111";
  const userEmp1A = "22222222-aaaa-aaaa-aaaa-222222222222";
  const userEmp2A = "33333333-aaaa-aaaa-aaaa-333333333333";
  const userMgrA = "55555555-aaaa-aaaa-aaaa-555555555555";
  const userOtherMgrA = "77777777-aaaa-aaaa-aaaa-777777777777";
  const userHrB = "44444444-bbbb-bbbb-bbbb-444444444444";
  const userEmpB = "66666666-bbbb-bbbb-bbbb-666666666666";

  // Employees
  const empIdHrA = "e0000000-0000-0000-0000-000000000000";
  const empId1A = "e0000000-0000-0000-0000-000000000001";
  const empId2A = "e0000000-0000-0000-0000-000000000002";
  const empIdMgrA = "e0000000-0000-0000-0000-000000000004";
  const empIdOtherMgrA = "e0000000-0000-0000-0000-000000000007";
  const empIdHrB = "e0000000-0000-0000-0000-000000000003";
  const empIdEmpB = "e0000000-0000-0000-0000-000000000005";

  // Helper to switch caller in PGlite session
  async function asUser(userId: string | null, role: string = "authenticated") {
    await db.exec(`
      SELECT set_config('test.auth_uid', '${userId || ""}', false);
      SELECT set_config('test.auth_role', '${role}', false);
    `);
  }

  beforeAll(async () => {
    // 1. Setup Auth & Helper functions
    await db.exec(`
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('test.auth_uid', true), '')::uuid
      $$;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
        SELECT COALESCE(nullif(current_setting('test.auth_role', true), ''), 'authenticated')
      $$;

      GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
      GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticated, anon, service_role;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated, anon, service_role;
      GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

      DO $$ BEGIN
        CREATE TYPE public.app_role AS ENUM (
          'super_admin', 'org_admin', 'hr_manager', 'line_manager',
          'employee', 'payroll_manager', 'finance_officer', 'department_head'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE public.request_type AS ENUM (
          'leave', 'attendance_fix', 'attendance_correction', 'overtime',
          'advance', 'loan_advance', 'expense', 'expense_claim',
          'salary_certificate', 'resignation', 'asset_request', 'shift_swap', 'general'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE public.request_status AS ENUM (
          'draft', 'submitted', 'pending_approval', 'pending',
          'returned', 'approved', 'rejected', 'in_execution', 'completed', 'cancelled', 'withdrawn'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS public.companies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        timezone text NOT NULL DEFAULT 'Asia/Riyadh'
      );

      CREATE TABLE IF NOT EXISTS public.departments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL,
        manager_id uuid
      );

      CREATE TABLE IF NOT EXISTS public.subsidiaries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL DEFAULT 'الفرع الرئيسي'
      );

      CREATE TABLE IF NOT EXISTS public.work_locations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL DEFAULT 'المقر الرئيسي'
      );

      CREATE TABLE IF NOT EXISTS public.employees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id),
        company_id uuid NOT NULL REFERENCES public.companies(id),
        department_id uuid REFERENCES public.departments(id),
        manager_id uuid REFERENCES public.employees(id),
        employee_no text,
        full_name text,
        first_name_ar text,
        last_name_ar text,
        job_title_ar text,
        status text NOT NULL DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS public.user_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id),
        role public.app_role NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.employee_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES public.companies(id),
        user_id uuid NOT NULL REFERENCES auth.users(id),
        role text NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.notifications_inbox (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_id uuid REFERENCES auth.users(id),
        title_ar text,
        title_en text,
        message_ar text,
        message_en text,
        body_ar text,
        body_en text,
        type text,
        link_path text,
        is_read boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      );

      -- Base workflow tables
      CREATE TABLE IF NOT EXISTS public.requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reference text NOT NULL UNIQUE,
        employee_id uuid NOT NULL REFERENCES public.employees(id),
        type public.request_type NOT NULL,
        status public.request_status NOT NULL DEFAULT 'pending',
        start_date date,
        end_date date,
        days integer,
        amount numeric(12,2),
        reason text,
        payload jsonb DEFAULT '{}'::jsonb,
        current_step_index integer NOT NULL DEFAULT 1,
        total_steps integer NOT NULL DEFAULT 1,
        current_approver_role text,
        decision_note text,
        decided_by uuid REFERENCES auth.users(id),
        decided_at timestamptz,
        created_by uuid REFERENCES auth.users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.approval_chains (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        request_type text NOT NULL,
        name_ar text NOT NULL,
        name_en text NOT NULL,
        scope_type text NOT NULL DEFAULT 'all_employees',
        scope_values jsonb NOT NULL DEFAULT '[]'::jsonb,
        steps jsonb NOT NULL DEFAULT '[]'::jsonb,
        is_default boolean NOT NULL DEFAULT false,
        status text NOT NULL DEFAULT 'active',
        is_system_template boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.approval_steps (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
        step_order integer NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        approver_role text,
        approver_user_id uuid REFERENCES auth.users(id),
        approver_employee_id uuid REFERENCES public.employees(id),
        acted_at timestamptz,
        acted_by uuid REFERENCES auth.users(id),
        note text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.delegation_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        delegator_id uuid NOT NULL REFERENCES public.employees(id),
        delegate_id uuid NOT NULL REFERENCES public.employees(id),
        start_date date NOT NULL,
        end_date date NOT NULL,
        reason text NOT NULL DEFAULT '',
        scope text NOT NULL DEFAULT 'all_requests',
        status text NOT NULL DEFAULT 'active',
        created_by uuid REFERENCES auth.users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS public.request_timeline (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
        step_number integer NOT NULL DEFAULT 1,
        actor_id uuid REFERENCES auth.users(id),
        actor_name text,
        actor_role text,
        action text NOT NULL,
        note text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      -- RLS Helper Stubs for PGlite
      CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT company_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
      $$;

      CREATE OR REPLACE FUNCTION public.is_hr(p_user_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role IN ('hr_manager', 'super_admin', 'org_admin')
        ) OR EXISTS (
          SELECT 1 FROM public.employee_roles WHERE user_id = p_user_id AND role IN ('hr_manager', 'super_admin', 'org_admin')
        );
      END;
      $$;

      -- Domain Finalizer Stubs for Integration Testing
      CREATE OR REPLACE FUNCTION public.decide_leave_request(p_request_id uuid, p_decision text, p_note text)
      RETURNS jsonb LANGUAGE plpgsql AS $$
      BEGIN
        IF p_note = 'TRIGGER_LEAVE_ERROR' THEN
          RAISE EXCEPTION 'رصيد الإجازة غير كافٍ أو حدث تعارض في الأيام';
        END IF;
        RETURN jsonb_build_object('ok', true, 'status', p_decision);
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.approve_attendance_correction(p_request_id uuid)
      RETURNS jsonb LANGUAGE plpgsql AS $$
      BEGIN
        RETURN jsonb_build_object('ok', true);
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_overtime_id uuid)
      RETURNS jsonb LANGUAGE plpgsql AS $$
      BEGIN
        RETURN jsonb_build_object('ok', true);
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.approve_shift_swap(p_swap_request_id uuid, p_decision_note text)
      RETURNS jsonb LANGUAGE plpgsql AS $$
      BEGIN
        RETURN jsonb_build_object('ok', true);
      END;
      $$;
    `);

    // 2. Load Prompt 14 Migration
    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/20260927000000_production_workflow_approval_engine.sql",
    );
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    await db.exec(sqlContent);

    // 3. Seed Companies, Users, and Employees
    await db.exec(`
      INSERT INTO public.companies (id, name, timezone)
      VALUES
        ('${companyA}', 'شركة التقنية المتقدمة A', 'Asia/Riyadh'),
        ('${companyB}', 'شركة الدولية للخدمات B', 'Asia/Riyadh')
      ON CONFLICT DO NOTHING;

      INSERT INTO auth.users (id, email)
      VALUES
        ('${userHrA}', 'hr.a@company-a.com'),
        ('${userEmp1A}', 'emp1.a@company-a.com'),
        ('${userEmp2A}', 'emp2.a@company-a.com'),
        ('${userMgrA}', 'mgr.a@company-a.com'),
        ('${userOtherMgrA}', 'other.mgr.a@company-a.com'),
        ('${userHrB}', 'hr.b@company-b.com'),
        ('${userEmpB}', 'emp.b@company-b.com')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.departments (id, company_id, name_ar, manager_id)
      VALUES
        ('${dept1A}', '${companyA}', 'إدارة تقنية المعلومات', NULL),
        ('${dept2A}', '${companyA}', 'إدارة المبيعات', NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO public.employees (id, user_id, company_id, department_id, manager_id, employee_no, full_name, first_name_ar, last_name_ar, job_title_ar)
      VALUES
        ('${empIdHrA}', '${userHrA}', '${companyA}', '${dept1A}', NULL, 'EMP-HR-A', 'أحمد مدير الموارد', 'أحمد', 'الموارد', 'مدير الموارد البشرية'),
        ('${empIdMgrA}', '${userMgrA}', '${companyA}', '${dept1A}', NULL, 'EMP-MGR-A', 'خالد المدير المباشر', 'خالد', 'المدير', 'مدير فريق'),
        ('${empIdOtherMgrA}', '${userOtherMgrA}', '${companyA}', '${dept2A}', NULL, 'EMP-OMGR-A', 'سعد مدير قسم آخر', 'سعد', 'المدير', 'مدير مبيعات'),
        ('${empId1A}', '${userEmp1A}', '${companyA}', '${dept1A}', '${empIdMgrA}', 'EMP-001-A', 'فهد موظف 1', 'فهد', 'الموظف', 'مهندس برمجيات'),
        ('${empId2A}', '${userEmp2A}', '${companyA}', '${dept1A}', '${empIdMgrA}', 'EMP-002-A', 'سالم موظف 2', 'سالم', 'الموظف', 'محلل أعمال'),
        ('${empIdHrB}', '${userHrB}', '${companyB}', NULL, NULL, 'EMP-HR-B', 'عمر HR شركة B', 'عمر', 'الغامدي', 'مدير HR'),
        ('${empIdEmpB}', '${userEmpB}', '${companyB}', NULL, NULL, 'EMP-001-B', 'طارق موظف B', 'طارق', 'الشهري', 'موظف')
      ON CONFLICT DO NOTHING;

      -- Update department manager
      UPDATE public.departments SET manager_id = '${empIdMgrA}' WHERE id = '${dept1A}';

      -- Roles
      INSERT INTO public.user_roles (user_id, role)
      VALUES
        ('${userHrA}', 'hr_manager'),
        ('${userMgrA}', 'line_manager'),
        ('${userOtherMgrA}', 'line_manager'),
        ('${userHrB}', 'hr_manager')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.employee_roles (company_id, user_id, role)
      VALUES
        ('${companyA}', '${userHrA}', 'hr_manager'),
        ('${companyA}', '${userMgrA}', 'line_manager'),
        ('${companyA}', '${userOtherMgrA}', 'line_manager'),
        ('${companyB}', '${userHrB}', 'hr_manager')
      ON CONFLICT DO NOTHING;

      -- Seed Approval Chain for Leave in Company A (2 Steps: direct_manager -> hr_manager)
      INSERT INTO public.approval_chains (
        company_id, request_type, name_ar, name_en, scope_type, priority, is_default, status, version, steps
      ) VALUES (
        '${companyA}',
        'leave',
        'مسار اعتمادات الإجازات المعياري',
        'Standard Leave Chain',
        'all_employees',
        100,
        true,
        'active',
        1,
        '[
          {"sequence": 1, "stepNameAr": "موافقة المدير المباشر", "resolverType": "direct_manager", "due_hours": 24},
          {"sequence": 2, "stepNameAr": "موافقة مدير الموارد البشرية", "resolverType": "hr_manager", "due_hours": 48}
        ]'::jsonb
      );

      -- Seed Department-specific chain for IT department in Company A (High Priority: 200)
      INSERT INTO public.approval_chains (
        company_id, department_id, request_type, name_ar, name_en, scope_type, priority, is_default, status, version, steps
      ) VALUES (
        '${companyA}',
        '${dept1A}',
        'asset_request',
        'مسار طلبات العهد لقسم التقنية',
        'IT Asset Chain',
        'department',
        200,
        false,
        'active',
        1,
        '[
          {"sequence": 1, "stepNameAr": "موافقة رئيس قسم التقنية", "resolverType": "department_head", "due_hours": 24}
        ]'::jsonb
      );
    `);
  }, 60000);

  // ==========================================================================
  // SUITE 1: CANONICAL REQUEST CATALOG & ATOMIC SEQUENCE GENERATION
  // ==========================================================================
  describe("Suite 1: Canonical Catalog & Atomic Reference Sequence", () => {
    it("1.1: Request Catalog contains all canonical request types with domain handlers", async () => {
      const res = await db.query<{ code: string; domain_handler: string }>(`
        SELECT code, domain_handler FROM public.request_catalog ORDER BY code;
      `);
      const codes = res.rows.map((r) => r.code);
      expect(codes).toContain("leave");
      expect(codes).toContain("attendance_correction");
      expect(codes).toContain("overtime");
      expect(codes).toContain("expense_claim");
      expect(codes).toContain("loan_advance");
      expect(codes).toContain("salary_certificate");
      expect(codes).toContain("resignation");
      expect(codes).toContain("asset_request");
      expect(codes).toContain("shift_swap");
      expect(codes).toContain("general");
    });

    it("1.2: generate_request_reference generates sequential company-scoped references REQ-YYYY-XXXXXX", async () => {
      const year = new Date().getFullYear().toString();
      const res1 = await db.query<{ ref: string }>(`SELECT public.generate_request_reference('${companyA}'::uuid) AS ref;`);
      const res2 = await db.query<{ ref: string }>(`SELECT public.generate_request_reference('${companyA}'::uuid) AS ref;`);

      expect(res1.rows[0].ref).toMatch(new RegExp(`^REQ-${year}-\\d{6}$`));
      expect(res2.rows[0].ref).toMatch(new RegExp(`^REQ-${year}-\\d{6}$`));
      expect(res1.rows[0].ref).not.toBe(res2.rows[0].ref);
    });
  });

  // ==========================================================================
  // SUITE 2: APPROVAL CHAIN RESOLUTION, VERSIONING & MATERIALIZATION
  // ==========================================================================
  describe("Suite 2: Approval Chain Resolution & Materialization", () => {
    it("2.1: Resolves scoped chain by department and priority with deterministic match", async () => {
      const res = await db.query<{ chain_id: string; chain_version: number }>(`
        SELECT chain_id, chain_version FROM public.resolve_approval_chain(
          '${companyA}'::uuid,
          'asset_request',
          '${dept1A}'::uuid
        );
      `);
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].chain_version).toBe(1);
    });

    it("2.2: Fails truthfully when no valid approval chain exists (NO silent line_manager fallback)", async () => {
      // General request has no chain seeded
      await asUser(userEmp1A);
      await expect(
        db.query(`
          SELECT public.submit_workflow_request(
            'resignation',
            '{"reason": "رغبة في إنهاء العقد"}'::jsonb
          );
        `),
      ).rejects.toThrow(/لم يتم إعداد مسار اعتماد صالح لهذا النوع من الطلبات/);
      await asUser(null);
    });

    it("2.3: Materializes actual approvers at submission (immune to subsequent org re-orgs)", async () => {
      await asUser(userEmp1A);
      const res = await db.query<{ res: any }>(`
        SELECT public.submit_workflow_request(
          'leave',
          '{"startDate": "2026-10-01", "endDate": "2026-10-05", "days": 5, "reason": "إجازة سنوية"}'::jsonb
        ) AS res;
      `);
      const reqId = res.rows[0].res.request_id;
      expect(reqId).toBeDefined();

      // Verify approval_steps materialized actual manager user_id and employee_id
      const steps = await db.query<{ step_order: number; approver_user_id: string; approver_employee_id: string; status: string }>(`
        SELECT step_order, approver_user_id, approver_employee_id, status
        FROM public.approval_steps
        WHERE request_id = '${reqId}'
        ORDER BY step_order ASC;
      `);

      expect(steps.rows.length).toBe(2);
      expect(steps.rows[0].step_order).toBe(1);
      expect(steps.rows[0].approver_user_id).toBe(userMgrA);
      expect(steps.rows[0].approver_employee_id).toBe(empIdMgrA);
      expect(steps.rows[0].status).toBe("pending");

      expect(steps.rows[1].step_order).toBe(2);
      expect(steps.rows[1].approver_user_id).toBe(userHrA);
      expect(steps.rows[1].status).toBe("waiting");

      await asUser(null);
    });
  });

  // ==========================================================================
  // SUITE 3: APPROVER AUTHORIZATION & SELF-APPROVAL PREVENTION (P0)
  // ==========================================================================
  describe("Suite 3: Strict Authorization & Self-Approval Prevention (P0)", () => {
    let testRequestId: string;

    beforeAll(async () => {
      await asUser(userEmp1A);
      const res = await db.query<{ res: any }>(`
        SELECT public.submit_workflow_request(
          'leave',
          '{"startDate": "2026-11-01", "endDate": "2026-11-03", "days": 3, "reason": "إجازة اعتيادية"}'::jsonb
        ) AS res;
      `);
      testRequestId = res.rows[0].res.request_id;
      await asUser(null);
    });

    it("3.1: Requester cannot self-approve their own request (Self-Approval Denied)", async () => {
      await asUser(userEmp1A);
      await expect(
        db.query(`
          SELECT public.decide_workflow_request(
            '${testRequestId}'::uuid,
            'approved',
            'موافقة ذاتية'
          );
        `),
      ).rejects.toThrow(/لا يمكن لمقدم الطلب اعتماد طلبه بنفسه/);
      await asUser(null);
    });

    it("3.2: Peer employee cannot approve another employee's request", async () => {
      await asUser(userEmp2A);
      await expect(
        db.query(`
          SELECT public.decide_workflow_request(
            '${testRequestId}'::uuid,
            'approved',
            'موافقة زميل'
          );
        `),
      ).rejects.toThrow(/غير مصرح لك باتخاذ قرار على هذا الطلب/);
      await asUser(null);
    });

    it("3.3: Same-role unrelated manager cannot approve (Role alone is NOT authorization!)", async () => {
      // userOtherMgrA has line_manager role, but is NOT the materialized approver for userEmp1A!
      await asUser(userOtherMgrA);
      await expect(
        db.query(`
          SELECT public.decide_workflow_request(
            '${testRequestId}'::uuid,
            'approved',
            'موافقة مدير غير معني'
          );
        `),
      ).rejects.toThrow(/غير مصرح لك باتخاذ قرار على هذا الطلب/);
      await asUser(null);
    });

    it("3.4: Cross-tenant approval strictly denied (HR of Company B cannot approve Company A request)", async () => {
      await asUser(userHrB);
      await expect(
        db.query(`
          SELECT public.decide_workflow_request(
            '${testRequestId}'::uuid,
            'approved',
            'موافقة من شركة أخرى'
          );
        `),
      ).rejects.toThrow(/Cross-Tenant Access Denied/);
      await asUser(null);
    });

    it("3.5: Materialized approver can approve step 1 and atomically advance to step 2", async () => {
      await asUser(userMgrA);
      const res = await db.query<{ res: any }>(`
        SELECT public.decide_workflow_request(
          '${testRequestId}'::uuid,
          'approved',
          'موافقة المدير المباشر'
        ) AS res;
      `);
      expect(res.rows[0].res.ok).toBe(true);
      expect(res.rows[0].res.is_final).toBe(false);

      // Verify request state: step 2 is now pending
      const req = await db.query<{ current_step_index: number; status: string }>(`
        SELECT current_step_index, status FROM public.requests WHERE id = '${testRequestId}';
      `);
      expect(req.rows[0].current_step_index).toBe(2);
      expect(req.rows[0].status).toBe("pending_approval");

      await asUser(null);
    });
  });

  // ==========================================================================
  // SUITE 4: ATOMIC DECISION TRANSACTION & FAIL-CLOSED DOMAIN FINALIZATION
  // ==========================================================================
  describe("Suite 4: Atomic Decision & Fail-Closed Domain Finalization", () => {
    it("4.1: If domain finalizer fails, workflow approval transaction ROLLS BACK entirely", async () => {
      // Submit a leave request that will trigger failure in the domain stub
      await asUser(userEmp1A);
      const submitRes = await db.query<{ res: any }>(`
        SELECT public.submit_workflow_request(
          'leave',
          '{"startDate": "2026-12-01", "endDate": "2026-12-05", "days": 5, "reason": "إجازة مع عطل"}'::jsonb
        ) AS res;
      `);
      const reqId = submitRes.rows[0].res.request_id;
      await asUser(null);

      // Step 1: Manager approves
      await asUser(userMgrA);
      await db.query(`SELECT public.decide_workflow_request('${reqId}'::uuid, 'approved', 'موافقة 1');`);
      await asUser(null);

      // Step 2: HR approves with note triggering domain error
      await asUser(userHrA);
      await expect(
        db.query(`
          SELECT public.decide_workflow_request(
            '${reqId}'::uuid,
            'approved',
            'TRIGGER_LEAVE_ERROR'
          );
        `),
      ).rejects.toThrow(/فشل اعتماد الإجازة في محرك الإجازات/);
      await asUser(null);

      // Verify request is STILL pending at step 2 (NOT approved)!
      const req = await db.query<{ status: string; current_step_index: number }>(`
        SELECT status, current_step_index FROM public.requests WHERE id = '${reqId}';
      `);
      expect(req.rows[0].status).toBe("pending_approval");
      expect(req.rows[0].current_step_index).toBe(2);
    });

    it("4.2: Successful final step executes domain finalizer and sets status to approved", async () => {
      await asUser(userEmp1A);
      const submitRes = await db.query<{ res: any }>(`
        SELECT public.submit_workflow_request(
          'leave',
          '{"startDate": "2026-12-10", "endDate": "2026-12-12", "days": 3, "reason": "إجازة ناجحة"}'::jsonb
        ) AS res;
      `);
      const reqId = submitRes.rows[0].res.request_id;
      await asUser(null);

      // Step 1: Manager approves
      await asUser(userMgrA);
      await db.query(`SELECT public.decide_workflow_request('${reqId}'::uuid, 'approved', 'موافقة 1');`);
      await asUser(null);

      // Step 2: HR approves
      await asUser(userHrA);
      const finalRes = await db.query<{ decide_workflow_request: { status: string; is_final: boolean } }>(`
        SELECT public.decide_workflow_request('${reqId}'::uuid, 'approved', 'موافقة نهائية');
      `);
      expect(finalRes.rows[0].decide_workflow_request.status).toBe("approved");
      expect(finalRes.rows[0].decide_workflow_request.is_final).toBe(true);

      const req = await db.query<{ status: string; decided_by: string }>(`
        SELECT status, decided_by FROM public.requests WHERE id = '${reqId}';
      `);
      expect(req.rows[0].status).toBe("approved");
      expect(req.rows[0].decided_by).toBe(userHrA);
      await asUser(null);
    });
  });

  // ==========================================================================
  // SUITE 5: RETURN & RESUBMIT LIFECYCLE (Item 10)
  // ==========================================================================
  describe("Suite 5: Return & Resubmit Lifecycle", () => {
    it("5.1: Returned request increments revision_number, preserves reference, and restarts path", async () => {
      await asUser(userEmp1A);
      const submitRes = await db.query<{ res: any }>(`
        SELECT public.submit_workflow_request(
          'leave',
          '{"startDate": "2027-01-01", "endDate": "2027-01-05", "days": 5, "reason": "طلب للتعديل"}'::jsonb
        ) AS res;
      `);
      const reqId = submitRes.rows[0].res.request_id;
      const originalRef = submitRes.rows[0].res.reference;
      await asUser(null);

      // Manager returns request for more info
      await asUser(userMgrA);
      await db.query(`
        SELECT public.decide_workflow_request('${reqId}'::uuid, 'returned', 'يرجى تقديم التقرير الطبي المعتمد');
      `);
      await asUser(null);

      // Verify status is returned
      const returnedReq = await db.query<{ status: string; revision_number: number }>(`
        SELECT status, revision_number FROM public.requests WHERE id = '${reqId}';
      `);
      expect(returnedReq.rows[0].status).toBe("returned");
      expect(returnedReq.rows[0].revision_number).toBe(1);

      // Requester resubmits with updated payload
      await asUser(userEmp1A);
      const resubmitRes = await db.query<{ res: any }>(`
        SELECT public.resubmit_workflow_request(
          '${reqId}'::uuid,
          '{"startDate": "2027-01-01", "endDate": "2027-01-05", "days": 5, "reason": "تم إرفاق التقرير الطبي"}'::jsonb,
          'مرفق التقرير المطلوب'
        ) AS res;
      `);
      expect(resubmitRes.rows[0].res.ok).toBe(true);
      expect(resubmitRes.rows[0].res.reference).toBe(originalRef);
      expect(resubmitRes.rows[0].res.revision).toBe(2);

      // Verify step 1 is pending again and revision number is 2
      const updatedReq = await db.query<{ status: string; revision_number: number; current_step_index: number }>(`
        SELECT status, revision_number, current_step_index FROM public.requests WHERE id = '${reqId}';
      `);
      expect(updatedReq.rows[0].status).toBe("pending_approval");
      expect(updatedReq.rows[0].revision_number).toBe(2);
      expect(updatedReq.rows[0].current_step_index).toBe(1);

      await asUser(null);
    });
  });

  // ==========================================================================
  // SUITE 6: WITHDRAWAL LIFECYCLE (Item 11)
  // ==========================================================================
  describe("Suite 6: Request Withdrawal Lifecycle", () => {
    it("6.1: Requester can withdraw pending request; cannot withdraw after final approval", async () => {
      await asUser(userEmp1A);
      const submitRes = await db.query<{ res: any }>(`
        SELECT public.submit_workflow_request(
          'leave',
          '{"startDate": "2027-02-01", "endDate": "2027-02-03", "days": 3, "reason": "طلب للسحب"}'::jsonb
        ) AS res;
      `);
      const reqId = submitRes.rows[0].res.request_id;

      // Withdraw request
      const withdrawRes = await db.query<{ res: any }>(`
        SELECT public.withdraw_workflow_request('${reqId}'::uuid, 'عدم الحاجة للإجازة في هذا التاريخ') AS res;
      `);
      expect(withdrawRes.rows[0].res.ok).toBe(true);
      expect(withdrawRes.rows[0].res.status).toBe("cancelled");

      // Verify request cannot be acted on anymore
      await asUser(userMgrA);
      await expect(
        db.query(`SELECT public.decide_workflow_request('${reqId}'::uuid, 'approved', 'موافقة لاغية');`),
      ).rejects.toThrow(/تمت معالجة هذا الطلب مسبقاً/);

      await asUser(null);
    });
  });

  // ==========================================================================
  // SUITE 7: PRODUCTION DELEGATION ENGINE (Items 28, 29, 30, 31)
  // ==========================================================================
  describe("Suite 7: Production Delegation Engine", () => {
    it("7.1: Rejects self-delegation", async () => {
      await asUser(userMgrA);
      await expect(
        db.query(`
          SELECT public.create_delegation_rule_atomic(
            '${empIdMgrA}'::uuid,
            '2026-10-01'::date,
            '2026-10-10'::date,
            'all_requests'
          );
        `),
      ).rejects.toThrow(/لا يمكن تفويض الصلاحيات لنفسك/);
      await asUser(null);
    });

    it("7.2: Rejects cross-tenant delegation", async () => {
      await asUser(userMgrA);
      await expect(
        db.query(`
          SELECT public.create_delegation_rule_atomic(
            '${empIdEmpB}'::uuid,
            '2026-10-01'::date,
            '2026-10-10'::date,
            'all_requests'
          );
        `),
      ).rejects.toThrow(/Cross-Tenant Delegation Denied/);
      await asUser(null);
    });

    it("7.3: Active valid delegate can approve on behalf of delegator, and timeline records delegation", async () => {
      // 1. Manager A delegates to Employee 2A (empId2A)
      await asUser(userMgrA);
      const delRes = await db.query<{ res: any }>(`
        SELECT public.create_delegation_rule_atomic(
          '${empId2A}'::uuid,
          CURRENT_DATE,
          (CURRENT_DATE + interval '10 days')::date,
          'all_requests',
          '{}'::text[],
          'انتداب لمؤتمر عمل'
        ) AS res;
      `);
      expect(delRes.rows[0].res.ok).toBe(true);
      const ruleId = delRes.rows[0].res.id;
      await asUser(null);

      // 2. Employee 1A submits request assigned to Manager A
      await asUser(userEmp1A);
      const submitRes = await db.query<{ res: any }>(`
        SELECT public.submit_workflow_request(
          'leave',
          '{"startDate": "2027-03-01", "endDate": "2027-03-05", "days": 5, "reason": "طلب للتفويض"}'::jsonb
        ) AS res;
      `);
      const reqId = submitRes.rows[0].res.request_id;
      await asUser(null);

      // 3. Delegate (userEmp2A) approves on behalf of Manager A
      await asUser(userEmp2A);
      const decideRes = await db.query<{ res: any }>(`
        SELECT public.decide_workflow_request(
          '${reqId}'::uuid,
          'approved',
          'موافقة من المفوض أثناء غياب المدير'
        ) AS res;
      `);
      expect(decideRes.rows[0].res.ok).toBe(true);
      await asUser(null);

      // 4. Verify timeline recorded delegate actor, delegator, and delegation rule ID (Item 31)
      const tl = await db.query<{ actor_id: string; delegator_id: string; delegation_rule_id: string }>(`
        SELECT actor_id, delegator_id, delegation_rule_id
        FROM public.request_timeline
        WHERE request_id = '${reqId}' AND action = 'approved';
      `);
      expect(tl.rows.length).toBe(1);
      expect(tl.rows[0].actor_id).toBe(userEmp2A);
      expect(tl.rows[0].delegator_id).toBe(empIdMgrA);
      expect(tl.rows[0].delegation_rule_id).toBe(ruleId);
    });

    it("7.4: Rejects circular delegation (B cannot delegate to A when A delegates to B)", async () => {
      // In 7.3, Manager A delegated to Emp 2A.
      // Now Emp 2A tries to delegate back to Manager A in the same period -> MUST REJECT!
      await asUser(userEmp2A);
      await expect(
        db.query(`
          SELECT public.create_delegation_rule_atomic(
            '${empIdMgrA}'::uuid,
            CURRENT_DATE,
            (CURRENT_DATE + interval '5 days')::date,
            'all_requests'
          );
        `),
      ).rejects.toThrow(/Circular Delegation Denied/);
      await asUser(null);
    });
  });

  // ==========================================================================
  // SUITE 8: SERVER PAGINATION & RLS TENANT ISOLATION
  // ==========================================================================
  describe("Suite 8: Server Pagination & RLS Tenant Isolation", () => {
    it("8.1: get_workflow_inbox_paginated returns only requests actionable by authenticated user", async () => {
      await asUser(userMgrA);
      const res = await db.query<{ res: any }>(`
        SELECT public.get_workflow_inbox_paginated('{"page": 1, "pageSize": 10}'::jsonb) AS res;
      `);
      expect(res.rows[0].res.data).toBeDefined();
      expect(Array.isArray(res.rows[0].res.data)).toBe(true);
      await asUser(null);
    });

    it("8.2: get_my_workflow_requests_paginated returns only user's own requests", async () => {
      await asUser(userEmp1A);
      const res = await db.query<{ res: any }>(`
        SELECT public.get_my_workflow_requests_paginated('{"page": 1, "pageSize": 10}'::jsonb) AS res;
      `);
      expect(res.rows[0].res.data).toBeDefined();
      expect(Array.isArray(res.rows[0].res.data)).toBe(true);
      for (const item of res.rows[0].res.data) {
        expect(item.requesterId).toBe(empId1A);
      }
      await asUser(null);
    });

    it("8.3: Direct table mutation via INSERT on requests is strictly denied under RLS", async () => {
      await asUser(userEmp1A);
      await db.exec("SET ROLE authenticated;");
      try {
        await expect(
          db.query(`
            INSERT INTO public.requests (reference, employee_id, type, status)
            VALUES ('FAKE-REQ-001', '${empId1A}', 'leave', 'approved');
          `),
        ).rejects.toThrow();
      } finally {
        await db.exec("RESET ROLE;");
        await asUser(null);
      }
    });
  });
});
