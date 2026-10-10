import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  validateHierarchyCircular,
  detectMovementConflicts,
  validatePositionAvailability,
  validateTemporaryAssignmentReturn,
  maskMovementConfidentialData,
  calculateMovementTurnaround,
  type EmployeeMovement,
  type TemporaryAssignment,
} from "../lib/domains/movements";

describe("Prompt 28: Production Employee Movements, Effective-Dated Changes & Lifecycle Engine", () => {
  // ==========================================================================
  // SECTION 1: PURE DOMAIN LOGIC & CALCULATION TESTS
  // ==========================================================================
  describe("1. Pure Domain Logic & Rules", () => {
    it("strictly prevents self-management (employee cannot manage themselves)", () => {
      const empId = "emp-001";
      const tree: Record<string, string | null> = {
        "emp-001": null,
      };
      const result = validateHierarchyCircular(empId, empId, tree);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("الموظف لا يمكن أن يكون مديراً لنفسه");
    });

    it("detects direct and multi-level circular reporting chains (A -> B -> C -> A)", () => {
      // Tree: CEO (null) -> VP (ceo) -> Dir (vp) -> Mgr (dir) -> Emp (mgr)
      const tree: Record<string, string | null> = {
        ceo: null,
        vp: "ceo",
        dir: "vp",
        mgr: "dir",
        emp: "mgr",
      };

      // Valid assignment: Assign Emp to VP
      expect(validateHierarchyCircular("emp", "vp", tree).valid).toBe(true);

      // Circular assignment: Assign Dir to Emp (Dir -> Emp -> Mgr -> Dir => LOOP!)
      const invalidCycle = validateHierarchyCircular("dir", "emp", tree);
      expect(invalidCycle.valid).toBe(false);
      expect(invalidCycle.reason).toContain("تسلسل هرمي دائري");

      // Circular assignment: Assign VP to Mgr
      const invalidVp = validateHierarchyCircular("vp", "mgr", tree);
      expect(invalidVp.valid).toBe(false);
    });

    it("detects movement conflicts on same effective date or overlapping fields", () => {
      const existing: EmployeeMovement[] = [
        {
          id: "mov-1",
          companyId: "c1",
          movementNumber: "MOV-2026-000001",
          employeeId: "emp-1",
          movementType: "promotion",
          effectiveDate: "2026-11-01",
          reason: "Promotion to Senior",
          status: "scheduled",
          isBulk: false,
          createdAt: "2026-10-01",
          updatedAt: "2026-10-01",
          changes: [
            {
              id: "ch-1",
              movementId: "mov-1",
              companyId: "c1",
              fieldCode: "job_position_id",
              isConfidential: false,
              createdAt: "2026-10-01",
            },
          ],
        },
      ];

      // Same date conflict
      const conflictDate = detectMovementConflicts(
        {
          employeeId: "emp-1",
          effectiveDate: "2026-11-01",
          fieldCodes: ["department_id"],
        },
        existing,
      );
      expect(conflictDate.hasConflict).toBe(true);
      expect(conflictDate.reason).toContain("MOV-2026-000001");

      // Overlapping pending field conflict
      const conflictField = detectMovementConflicts(
        {
          employeeId: "emp-1",
          effectiveDate: "2026-12-01",
          fieldCodes: ["job_position_id"],
        },
        existing,
      );
      expect(conflictField.hasConflict).toBe(true);
      expect(conflictField.reason).toContain("job_position_id");

      // Non-overlapping movement
      const valid = detectMovementConflicts(
        {
          employeeId: "emp-1",
          effectiveDate: "2026-12-01",
          fieldCodes: ["work_location_id"],
        },
        existing,
      );
      expect(valid.hasConflict).toBe(false);
    });

    it("validates target position availability and headcount control", () => {
      // Inactive position
      const inactive = validatePositionAvailability({
        id: "pos-1",
        status: "inactive",
        plannedHeadcount: 5,
        currentHeadcount: 2,
      });
      expect(inactive.eligible).toBe(false);
      expect(inactive.reason).toContain("غير نشطة");

      // Position at capacity with no multiple incumbents allowed
      const atCapacity = validatePositionAvailability({
        id: "pos-2",
        status: "active",
        plannedHeadcount: 1,
        currentHeadcount: 1,
        allowMultipleIncumbents: false,
      });
      expect(atCapacity.eligible).toBe(false);
      expect(atCapacity.reason).toContain("مشغولة بالكامل");

      // Position with available capacity
      const available = validatePositionAvailability({
        id: "pos-3",
        status: "active",
        plannedHeadcount: 3,
        currentHeadcount: 2,
      });
      expect(available.eligible).toBe(true);

      // Multiple incumbents allowed
      const multi = validatePositionAvailability({
        id: "pos-4",
        status: "active",
        plannedHeadcount: 1,
        currentHeadcount: 1,
        allowMultipleIncumbents: true,
      });
      expect(multi.eligible).toBe(true);
    });

    it("validates return from temporary assignment preserving base assignment truth", () => {
      const activeAssign: TemporaryAssignment = {
        id: "temp-1",
        companyId: "c1",
        employeeId: "emp-1",
        assignmentType: "acting_assignment",
        startDate: "2026-09-01",
        expectedEndDate: "2026-12-31",
        baseAssignmentId: "base-assign-1",
        status: "active",
        reason: "Acting Director",
        createdAt: "2026-09-01",
      };

      // Valid return
      const valid = validateTemporaryAssignmentReturn(activeAssign, "2026-12-01");
      expect(valid.canReturn).toBe(true);

      // Already closed
      const closed = validateTemporaryAssignmentReturn(
        { ...activeAssign, status: "completed" },
        "2026-12-01",
      );
      expect(closed.canReturn).toBe(false);
      expect(closed.reason).toContain("مغلق بالفعل");

      // Missing base assignment
      const noBase = validateTemporaryAssignmentReturn(
        { ...activeAssign, baseAssignmentId: null },
        "2026-12-01",
      );
      expect(noBase.canReturn).toBe(false);
      expect(noBase.reason).toContain("Missing base assignment snapshot");

      // Return date before start date
      const invalidDate = validateTemporaryAssignmentReturn(activeAssign, "2026-08-01");
      expect(invalidDate.canReturn).toBe(false);
      expect(invalidDate.reason).toContain("تاريخ العودة لا يمكن أن يكون قبل");
    });

    it("masks sensitive compensation data for unprivileged viewers", () => {
      const movement: EmployeeMovement = {
        id: "mov-1",
        companyId: "c1",
        movementNumber: "MOV-2026-000001",
        employeeId: "emp-1",
        movementType: "compensation_change",
        effectiveDate: "2026-10-01",
        reason: "Annual Merit Increase",
        status: "effective",
        isBulk: false,
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
        changes: [
          {
            id: "ch-1",
            movementId: "mov-1",
            companyId: "c1",
            fieldCode: "basic_salary",
            oldValue: "15000",
            newValue: "18000",
            oldDisplayValue: "15,000 SAR",
            newDisplayValue: "18,000 SAR",
            isConfidential: true,
            createdAt: "2026-10-01",
          },
          {
            id: "ch-2",
            movementId: "mov-1",
            companyId: "c1",
            fieldCode: "grade",
            oldValue: "G5",
            newValue: "G6",
            oldDisplayValue: "Grade 5",
            newDisplayValue: "Grade 6",
            isConfidential: false,
            createdAt: "2026-10-01",
          },
        ],
      };

      // Unprivileged viewer (e.g. Line Manager or Employee)
      const masked = maskMovementConfidentialData(movement, false);
      expect(masked.changes?.[0].newValue).toBe("******");
      expect(masked.changes?.[0].newDisplayValue).toBe("******");
      expect(masked.changes?.[1].newValue).toBe("G6");

      // Privileged viewer (HR / Payroll Specialist)
      const privileged = maskMovementConfidentialData(movement, true);
      expect(privileged.changes?.[0].newValue).toBe("18000");
      expect(privileged.changes?.[0].newDisplayValue).toBe("18,000 SAR");
    });

    it("calculates movement approval turnaround time metrics", () => {
      const movements: EmployeeMovement[] = [
        {
          id: "m1",
          companyId: "c1",
          movementNumber: "MOV-1",
          employeeId: "e1",
          movementType: "promotion",
          effectiveDate: "2026-10-15",
          reason: "Promotion",
          status: "approved",
          isBulk: false,
          createdAt: "2026-10-01T00:00:00Z",
          approvedAt: "2026-10-03T00:00:00Z", // 2 days
          updatedAt: "2026-10-03T00:00:00Z",
        },
        {
          id: "m2",
          companyId: "c1",
          movementNumber: "MOV-2",
          employeeId: "e2",
          movementType: "transfer",
          effectiveDate: "2026-10-20",
          reason: "Transfer",
          status: "effective",
          isBulk: false,
          createdAt: "2026-10-01T00:00:00Z",
          approvedAt: "2026-10-05T00:00:00Z", // 4 days
          updatedAt: "2026-10-05T00:00:00Z",
        },
      ];

      const metrics = calculateMovementTurnaround(movements);
      expect(metrics.averageDays).toBe(3);
      expect(metrics.medianDays).toBe(3);
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
    const deptId1 = "66666666-6666-6666-6666-666666666666";
    const deptId2 = "77777777-7777-7777-7777-777777777777";
    const posId1 = "88888888-8888-8888-8888-888888888888";
    const posId2 = "99999999-9999-9999-9999-999999999999";

    beforeAll(async () => {
      // 1. Setup base database environment and prerequisite tables
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

        CREATE TABLE IF NOT EXISTS public.subsidiaries (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          name_ar text
        );

        CREATE TABLE IF NOT EXISTS public.work_locations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          name_ar text
        );

        CREATE TABLE IF NOT EXISTS public.job_positions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          title_ar text,
          title_en text,
          department_id uuid REFERENCES public.departments(id)
        );

        CREATE TABLE IF NOT EXISTS public.cost_centers (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          code text,
          name_ar text
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
          manager_id uuid REFERENCES public.employees(id),
          work_location_id uuid REFERENCES public.work_locations(id),
          cost_center_id uuid REFERENCES public.cost_centers(id),
          subsidiary_id uuid REFERENCES public.subsidiaries(id),
          grade text,
          hire_date date DEFAULT current_date,
          updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.employee_contracts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          employee_id uuid REFERENCES public.employees(id),
          contract_type text DEFAULT 'full_time',
          start_date date DEFAULT current_date
        );

        CREATE TABLE IF NOT EXISTS public.requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          employee_id uuid REFERENCES public.employees(id),
          request_type text NOT NULL,
          status text NOT NULL DEFAULT 'pending'
        );

        CREATE TABLE IF NOT EXISTS public.employee_assignment_history (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
          employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
          department_id uuid REFERENCES public.departments(id),
          subsidiary_id uuid REFERENCES public.subsidiaries(id),
          work_location_id uuid REFERENCES public.work_locations(id),
          job_position_id uuid REFERENCES public.job_positions(id),
          cost_center_id uuid REFERENCES public.cost_centers(id),
          manager_id uuid REFERENCES public.employees(id),
          effective_from date NOT NULL DEFAULT current_date,
          effective_to date,
          change_reason text,
          changed_by uuid REFERENCES auth.users(id),
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.employee_compensation_versions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
          company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
          version integer NOT NULL DEFAULT 1,
          effective_from date NOT NULL,
          effective_to date,
          basic_salary numeric(12,2) NOT NULL DEFAULT 0,
          housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
          transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
          currency text NOT NULL DEFAULT 'SAR',
          status text NOT NULL DEFAULT 'approved',
          created_at timestamptz NOT NULL DEFAULT now()
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
          status text DEFAULT 'pending',
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.notifications_inbox (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid,
          title_ar text,
          created_at timestamptz DEFAULT now()
        );

        -- Auth & Security helpers
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT nullif(current_setting('test.uid', true), '')::uuid
        $$;

        CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT nullif(current_setting('test.company_id', true), '')::uuid
        $$;
      `);

      // 2. Insert test entities
      await db.exec(`
        INSERT INTO public.companies(id, name) VALUES
          ('${companyA}', 'Alpha Holding Co.'),
          ('${companyB}', 'Beta Corp.');

        INSERT INTO auth.users(id, email) VALUES
          ('${adminUser}', 'admin@alpha.com');

        INSERT INTO public.departments(id, company_id, name_ar, name_en) VALUES
          ('${deptId1}', '${companyA}', 'إدارة الموارد البشرية', 'Human Resources'),
          ('${deptId2}', '${companyA}', 'إدارة تقنية المعلومات', 'Information Technology');

        INSERT INTO public.job_positions(id, company_id, title_ar, title_en, department_id) VALUES
          ('${posId1}', '${companyA}', 'أخصائي توظيف أول', 'Senior Talent Specialist', '${deptId1}'),
          ('${posId2}', '${companyA}', 'مدير الموارد البشرية', 'HR Director', '${deptId1}');

        -- Employee 1: Director
        INSERT INTO public.employees(id, company_id, employee_no, first_name_ar, last_name_ar, department_id, job_position_id, manager_id, grade, status) VALUES
          ('${employeeId1}', '${companyA}', 'EMP-001', 'أحمد', 'الغامدي', '${deptId1}', '${posId2}', NULL, 'G7', 'active');

        -- Employee 2: Specialist (reports to Director)
        INSERT INTO public.employees(id, company_id, employee_no, first_name_ar, last_name_ar, department_id, job_position_id, manager_id, grade, status) VALUES
          ('${employeeId2}', '${companyA}', 'EMP-002', 'سارة', 'العتيبي', '${deptId1}', '${posId1}', '${employeeId1}', 'G5', 'active');

        -- Employee 3: In Company B (for RLS testing)
        INSERT INTO public.employees(id, company_id, employee_no, first_name_ar, last_name_ar, status) VALUES
          ('${employeeId3}', '${companyB}', 'EMP-003', 'فيصل', 'الدوسري', 'active');
      `);

      // 3. Apply Prompt 28 Migration
      const migrationSql = readFileSync(
        "supabase/migrations/20261010000000_production_employee_movements_lifecycle_engine.sql",
        "utf8",
      ).replace(/^\uFEFF/, "");
      await db.exec(migrationSql);

      // 4. Seed initial current assignment history for Employee 2 (columns added by migration)
      await db.exec(`
        INSERT INTO public.employee_assignment_history(
          company_id, employee_id, department_id, job_position_id, manager_id, grade, is_current, effective_from
        ) VALUES (
          '${companyA}', '${employeeId2}', '${deptId1}', '${posId1}', '${employeeId1}', 'G5', true, '2026-01-01'
        );
      `);
    });

    afterAll(async () => {
      await db.close();
    });

    it("applies the migration and creates all required tables and constraints", async () => {
      const res = await db.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN (
            'company_movement_number_counters',
            'employee_movements',
            'employee_movement_changes',
            'employee_contract_versions',
            'temporary_assignments',
            'movement_policies'
          )
        ORDER BY table_name;
      `);
      expect(res.rows.length).toBe(6);
    });

    it("generates deterministic sequential movement numbers per company (MOV-YYYY-XXXXXX)", async () => {
      const n1 = await db.query(`SELECT public.get_next_movement_number('${companyA}') as num`);
      const n2 = await db.query(`SELECT public.get_next_movement_number('${companyA}') as num`);
      const year = new Date().getFullYear().toString();

      expect((n1.rows[0] as any).num).toBe(`MOV-${year}-000001`);
      expect((n2.rows[0] as any).num).toBe(`MOV-${year}-000002`);
    });

    it("evaluates hierarchy circularity in SQL function check_manager_hierarchy_circular", async () => {
      // Self-management: Emp 1 manages Emp 1
      const selfRes = await db.query(
        `SELECT public.check_manager_hierarchy_circular('${companyA}', '${employeeId1}', '${employeeId1}') as is_circular`,
      );
      expect((selfRes.rows[0] as any).is_circular).toBe(true);

      // Circular loop: Emp 1 (Director) reporting to Emp 2 (subordinate)
      const loopRes = await db.query(
        `SELECT public.check_manager_hierarchy_circular('${companyA}', '${employeeId1}', '${employeeId2}') as is_circular`,
      );
      expect((loopRes.rows[0] as any).is_circular).toBe(true);

      // Safe reporting: Emp 2 reporting to Emp 1
      const safeRes = await db.query(
        `SELECT public.check_manager_hierarchy_circular('${companyA}', '${employeeId2}', '${employeeId1}') as is_circular`,
      );
      expect((safeRes.rows[0] as any).is_circular).toBe(false);
    });

    it("creates an employee movement request with changes array and auto-approves effective immediately", async () => {
      const changes = JSON.stringify([
        {
          field_code: "grade",
          old_value: "G5",
          new_value: "G6",
          old_display_value: "Grade 5",
          new_display_value: "Grade 6",
          is_confidential: false,
        },
        {
          field_code: "job_position_id",
          new_reference_id: posId2,
          new_value: posId2,
          new_display_value: "مدير الموارد البشرية",
          is_confidential: false,
        },
      ]);

      const createRes = await db.query(
        `SELECT public.create_employee_movement_atomic(
          '${companyA}',
          '${employeeId2}',
          'promotion',
          current_date,
          'ترقية استثنائية لتميز الأداء',
          $1::jsonb,
          '${adminUser}',
          'ملاحظات المعتمد',
          true
        ) as res`,
        [changes],
      );

      const parsed = (createRes.rows[0] as any).res;
      expect(parsed.success).toBe(true);
      expect(parsed.status).toBe("effective");
      expect(parsed.movement_id).toBeDefined();

      // Verify employee record was updated
      const empRes = await db.query(
        `SELECT grade, job_position_id FROM public.employees WHERE id = '${employeeId2}'`,
      );
      expect((empRes.rows[0] as any).grade).toBe("G6");
      expect((empRes.rows[0] as any).job_position_id).toBe(posId2);

      // Verify employee assignment history appended with is_current = true
      const histRes = await db.query(
        `SELECT grade, is_current FROM public.employee_assignment_history 
         WHERE employee_id = '${employeeId2}' ORDER BY created_at DESC`,
      );
      expect(histRes.rows.length).toBeGreaterThanOrEqual(2);
      expect((histRes.rows[0] as any).is_current).toBe(true);
      expect((histRes.rows[0] as any).grade).toBe("G6");
      expect((histRes.rows[1] as any).is_current).toBe(false);
    });

    it("schedules a future-dated movement WITHOUT modifying employee master prematurely", async () => {
      const changes = JSON.stringify([
        {
          field_code: "department_id",
          old_reference_id: deptId1,
          new_reference_id: deptId2,
          new_display_value: "إدارة تقنية المعلومات",
        },
      ]);

      // Create movement for next month
      const createRes = await db.query(
        `SELECT public.create_employee_movement_atomic(
          '${companyA}',
          '${employeeId2}',
          'transfer',
          (current_date + interval '30 days')::date,
          'نقل وظيفي مجدول للشهر القادم',
          $1::jsonb,
          '${adminUser}',
          NULL,
          true
        ) as res`,
        [changes],
      );

      const parsed = (createRes.rows[0] as any).res;
      expect(parsed.success).toBe(true);
      expect(parsed.status).toBe("scheduled");

      // Verify employee department is STILL Dept 1 (HR), NOT Dept 2 (IT) prematurely
      const empRes = await db.query(
        `SELECT department_id FROM public.employees WHERE id = '${employeeId2}'`,
      );
      expect((empRes.rows[0] as any).department_id).toBe(deptId1);
    });

    it("activates due employee movements deterministically via activate_due_employee_movements_atomic", async () => {
      // Backdate the scheduled movement to yesterday so it is due
      await db.query(`
        UPDATE public.employee_movements
        SET effective_date = (current_date - interval '1 day')::date
        WHERE company_id = '${companyA}' AND status = 'scheduled';
      `);

      const activateRes = await db.query(
        `SELECT public.activate_due_employee_movements_atomic('${companyA}') as res`,
      );
      const parsed = (activateRes.rows[0] as any).res;
      expect(parsed.success).toBe(true);
      expect(parsed.activated_count).toBeGreaterThanOrEqual(1);

      // Now the employee's department MUST be Dept 2 (IT)
      const empRes = await db.query(
        `SELECT department_id FROM public.employees WHERE id = '${employeeId2}'`,
      );
      expect((empRes.rows[0] as any).department_id).toBe(deptId2);
    });

    it("handles temporary assignments and returns accurately restoring base assignment snapshot", async () => {
      // Employee 1 is currently in HR Dept with Pos 2
      const tempRes = await db.query(
        `SELECT public.create_temporary_assignment_atomic(
          '${companyA}',
          '${employeeId1}',
          'acting_assignment',
          current_date,
          (current_date + interval '90 days')::date,
          '${deptId2}',
          '${posId1}',
          NULL,
          NULL,
          'تكليف مؤقت كقائم بالأعمال',
          '${adminUser}'
        ) as res`,
      );

      const tempParsed = (tempRes.rows[0] as any).res;
      expect(tempParsed.success).toBe(true);
      expect(tempParsed.temporary_assignment_id).toBeDefined();
      expect(tempParsed.base_assignment_id).toBeDefined();

      // Check employee is currently in temporary assignment department
      const empTemp = await db.query(`SELECT department_id FROM public.employees WHERE id = '${employeeId1}'`);
      expect((empTemp.rows[0] as any).department_id).toBe(deptId2);

      // Return from temporary assignment
      const returnRes = await db.query(
        `SELECT public.return_from_temporary_assignment_atomic(
          '${companyA}',
          '${tempParsed.temporary_assignment_id}',
          current_date,
          'انتهاء فترة التكليف والعودة للإدارة الأصلية',
          '${adminUser}'
        ) as res`,
      );

      const returnParsed = (returnRes.rows[0] as any).res;
      expect(returnParsed.success).toBe(true);
      expect(returnParsed.status).toBe("completed");

      // Employee MUST be restored to home department (Dept 1)
      const empRestored = await db.query(`SELECT department_id FROM public.employees WHERE id = '${employeeId1}'`);
      expect((empRestored.rows[0] as any).department_id).toBe(deptId1);
    });

    it("processes bulk movement requests atomically with per-row pre-validation", async () => {
      const bulkRows = JSON.stringify([
        {
          employee_id: employeeId1,
          changes: [
            {
              field_code: "grade",
              new_value: "G8",
              new_display_value: "Grade 8",
            },
          ],
        },
        {
          employee_id: employeeId2,
          changes: [
            {
              field_code: "grade",
              new_value: "G7",
              new_display_value: "Grade 7",
            },
          ],
        },
        {
          // Non-existent employee in this company
          employee_id: "00000000-0000-0000-0000-000000000000",
          changes: [],
        },
      ]);

      const bulkRes = await db.query(
        `SELECT public.bulk_create_employee_movements_atomic(
          '${companyA}',
          'grade_change',
          (current_date + interval '60 days')::date,
          'تعديل الدرجات الوظيفية السنوي المجمع',
          $1::jsonb,
          '${adminUser}'
        ) as res`,
        [bulkRows],
      );

      const parsed = (bulkRes.rows[0] as any).res;
      expect(parsed.success).toBe(true);
      expect(parsed.valid_count).toBe(2);
      expect(parsed.invalid_count).toBe(1);
      expect(parsed.errors.length).toBe(1);
    });

    it("prevents cancelling an effective movement without corrective reversal", async () => {
      // Find an effective movement
      const effectiveMov = await db.query(`
        SELECT id FROM public.employee_movements 
        WHERE company_id = '${companyA}' AND status = 'effective' 
        LIMIT 1;
      `);

      const movId = (effectiveMov.rows[0] as any).id;
      const cancelRes = await db.query(
        `SELECT public.cancel_employee_movement_atomic(
          '${companyA}',
          '${movId}',
          '${adminUser}',
          'محاولة إلغاء خاطئة'
        ) as res`,
      );

      const parsed = (cancelRes.rows[0] as any).res;
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("For effective movements, use corrective reversal");
    });

    it("returns governed KPIs via get_employee_movements_kpis_atomic", async () => {
      const kpiRes = await db.query(
        `SELECT public.get_employee_movements_kpis_atomic('${companyA}') as res`,
      );
      const kpis = (kpiRes.rows[0] as any).res;
      expect(kpis.total_movements).toBeGreaterThan(0);
      expect(kpis.effective_movements).toBeGreaterThan(0);
    });

    it("enforces multi-tenant RLS boundary between companies", async () => {
      const crossRes = await db.query(
        `SELECT count(*)::int as count FROM public.employee_movements WHERE company_id = '${companyB}'`,
      );
      expect((crossRes.rows[0] as any).count).toBe(0);
    });
  });
});
