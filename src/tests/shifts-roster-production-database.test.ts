import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 13: Production Shifts, Rosters & Scheduling Engine (PGlite Database Tests)", () => {
  const db = new PGlite();

  // Test UUIDs
  const companyA = "a0000000-0000-0000-0000-000000000001";
  const companyB = "b0000000-0000-0000-0000-000000000002";

  const userHrA = "11111111-aaaa-aaaa-aaaa-111111111111";
  const userEmp1A = "22222222-aaaa-aaaa-aaaa-222222222222";
  const userEmp2A = "33333333-aaaa-aaaa-aaaa-333333333333";
  const userHrB = "44444444-bbbb-bbbb-bbbb-444444444444";

  const empId1A = "e0000000-0000-0000-0000-000000000001";
  const empId2A = "e0000000-0000-0000-0000-000000000002";
  const empId1B = "e0000000-0000-0000-0000-000000000003";

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

      DO $$ BEGIN
        CREATE TYPE public.app_role AS ENUM (
          'super_admin', 'org_admin', 'hr_manager', 'line_manager',
          'attendance_officer', 'payroll_officer', 'employee'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      -- Base parent tables
      CREATE TABLE IF NOT EXISTS public.companies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        legal_name_ar text NOT NULL,
        timezone text DEFAULT 'Asia/Riyadh',
        status text DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS public.work_locations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL,
        status text DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS public.employees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid,
        company_id uuid REFERENCES public.companies(id),
        manager_id uuid REFERENCES public.employees(id),
        work_location_id uuid REFERENCES public.work_locations(id),
        employee_no text NOT NULL,
        first_name_ar text NOT NULL,
        last_name_ar text NOT NULL,
        full_name text,
        hire_date date DEFAULT CURRENT_DATE,
        exit_date date,
        status text DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS public.employee_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        company_id uuid REFERENCES public.companies(id),
        role public.app_role NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.user_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        role public.app_role NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.user_company_access (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        company_id uuid NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.leaves (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id),
        start_date date NOT NULL,
        end_date date NOT NULL,
        status text NOT NULL DEFAULT 'approved',
        created_at timestamptz DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION public.current_company_id()
      RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT COALESCE(
          (SELECT company_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1),
          (SELECT company_id FROM public.employee_roles WHERE user_id = auth.uid() LIMIT 1)
        )
      $$;

      CREATE OR REPLACE FUNCTION public.resolve_my_employee_id()
      RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1
      $$;

      -- Base shifts & schedule_assignments tables from earlier migrations
      CREATE TABLE IF NOT EXISTS public.shifts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        code text NOT NULL,
        name_ar text NOT NULL,
        name_en text NOT NULL,
        color text NOT NULL DEFAULT '#0284c7',
        type text NOT NULL DEFAULT 'fixed',
        is_overnight boolean NOT NULL DEFAULT false,
        break_minutes integer NOT NULL DEFAULT 0,
        start_time time NOT NULL,
        end_time time NOT NULL,
        flexible_hours numeric(4,2),
        split_second_start_time time,
        split_second_end_time time,
        grace_minutes_arrival integer NOT NULL DEFAULT 15,
        grace_minutes_departure integer NOT NULL DEFAULT 15,
        allow_single_punch boolean NOT NULL DEFAULT false,
        overtime_eligible boolean NOT NULL DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.schedule_assignments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id uuid REFERENCES public.employees(id),
        work_date date NOT NULL,
        shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
        shift_name_ar text,
        shift_color text NOT NULL DEFAULT '#0284c7',
        is_rest_day boolean NOT NULL DEFAULT false,
        status text NOT NULL DEFAULT 'draft',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.departments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL,
        name_en text,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.job_positions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        title_ar text NOT NULL,
        title_en text,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.leave_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id),
        start_date date NOT NULL,
        end_date date NOT NULL,
        status text NOT NULL DEFAULT 'approved',
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id),
        type text NOT NULL,
        status text NOT NULL DEFAULT 'approved',
        start_date date,
        end_date date,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.company_holidays (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.attendance_periods (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        period_year integer NOT NULL,
        period_month integer NOT NULL,
        from_date date NOT NULL,
        to_date date NOT NULL,
        status text NOT NULL DEFAULT 'open',
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.attendance_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id),
        shift_id uuid REFERENCES public.shifts(id),
        work_date date NOT NULL,
        status text NOT NULL DEFAULT 'present',
        created_at timestamptz DEFAULT now()
      );
    `);

    // 2. Load and Apply Migration 20260925000000_production_shifts_rosters_engine.sql
    const migrationPath = path.resolve(__dirname, "../../supabase/migrations/20260925000000_production_shifts_rosters_engine.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");
    await db.exec(migrationSql);

    // 2.1 Load and Apply Migration 20260925010000_finalize_shifts_rosters_integrity.sql
    const migration2Path = path.resolve(__dirname, "../../supabase/migrations/20260925010000_finalize_shifts_rosters_integrity.sql");
    const migration2Sql = fs.readFileSync(migration2Path, "utf-8");
    await db.exec(migration2Sql);

    // 3. Seed Companies, Employees, Users, and Roles
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES
        ('${userHrA}', 'hr_a@andalus.sa'),
        ('${userEmp1A}', 'emp1_a@andalus.sa'),
        ('${userEmp2A}', 'emp2_a@andalus.sa'),
        ('${userHrB}', 'hr_b@other.sa')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.companies (id, legal_name_ar, timezone) VALUES
        ('${companyA}', 'شركة الأندلس القابضة', 'Asia/Riyadh'),
        ('${companyB}', 'شركة النور للمقاولات', 'Asia/Riyadh')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.employees (id, user_id, company_id, employee_no, first_name_ar, last_name_ar) VALUES
        ('${empId1A}', '${userEmp1A}', '${companyA}', 'EMP-001', 'أحمد', 'السعيد'),
        ('${empId2A}', '${userEmp2A}', '${companyA}', 'EMP-002', 'محمد', 'العلي'),
        ('${empId1B}', '${userHrB}', '${companyB}', 'EMP-901', 'خالد', 'الغامدي')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.employee_roles (user_id, company_id, role) VALUES
        ('${userHrA}', '${companyA}', 'hr_manager'),
        ('${userEmp1A}', '${companyA}', 'employee'),
        ('${userEmp2A}', '${companyA}', 'employee'),
        ('${userHrB}', '${companyB}', 'hr_manager')
      ON CONFLICT DO NOTHING;
    `);
  }, 60000);

  // --------------------------------------------------------------------------
  // SUITE 1: Shift Definitions Master Data & Types
  // --------------------------------------------------------------------------
  describe("Suite 1: Shift Definitions Master Data & Shift Types", () => {
    it("auto-generates sequential shift codes per company (SH-001, SH-002)", async () => {
      await asUser(userHrA);
      const code1 = await db.query<{ generate_shift_code: string }>(
        `SELECT public.generate_shift_code('${companyA}'::uuid);`
      );
      expect(code1.rows[0].generate_shift_code).toBe("SH-001");

      // Insert shift with SH-001
      await db.exec(`
        INSERT INTO public.shifts (company_id, code, name_ar, name_en, type, start_time, end_time, version)
        VALUES ('${companyA}', 'SH-001', 'الوردية الأولى', 'Shift 1', 'fixed', '08:00', '16:00', 1);
      `);

      const code2 = await db.query<{ generate_shift_code: string }>(
        `SELECT public.generate_shift_code('${companyA}'::uuid);`
      );
      expect(code2.rows[0].generate_shift_code).toBe("SH-002");
    });

    it("creates Fixed Shift with default break and rest rules", async () => {
      await asUser(userHrA);
      const res = await db.query<{ create_shift_definition: { ok: boolean; id: string } }>(`
        SELECT public.create_shift_definition(jsonb_build_object(
          'company_id', '${companyA}'::text,
          'code', 'SH-FIX',
          'name_ar', 'وردية ثابتة صباحية',
          'name_en', 'Morning Fixed',
          'type', 'fixed',
          'start_time', '08:00',
          'end_time', '17:00',
          'grace_minutes_arrival', 15,
          'grace_minutes_departure', 15,
          'break_type', 'unpaid',
          'auto_deduct_breaks', true,
          'min_rest_hours_after', 11
        ));
      `);

      const shiftId = res.rows[0].create_shift_definition.id;
      expect(shiftId).toBeTruthy();

      const shift = await db.query<any>(`SELECT * FROM public.shifts WHERE id = '${shiftId}';`);
      expect(shift.rows[0].name_ar).toBe("وردية ثابتة صباحية");
      expect(shift.rows[0].version).toBe(1);
      expect(shift.rows[0].status).toBe("active");
      expect(Number(shift.rows[0].min_rest_hours_after)).toBe(11);
    });

    it("creates Overnight Shift spanning across midnight with overnight segment", async () => {
      await asUser(userHrA);
      const res = await db.query<{ create_shift_definition: { ok: boolean; id: string } }>(`
        SELECT public.create_shift_definition(jsonb_build_object(
          'company_id', '${companyA}'::text,
          'code', 'SH-NIGHT',
          'name_ar', 'الوردية الليلية المتداخلة',
          'name_en', 'Overnight Shift',
          'type', 'overnight',
          'start_time', '22:00',
          'end_time', '06:00',
          'grace_minutes_arrival', 15,
          'grace_minutes_departure', 15,
          'segments', jsonb_build_array(
            jsonb_build_object(
              'segment_order', 1,
              'start_time', '22:00',
              'end_time', '06:00',
              'segment_type', 'work',
              'is_overnight', true,
              'paid', true
            )
          )
        ));
      `);

      const shiftId = res.rows[0].create_shift_definition.id;
      const segments = await db.query<any>(`SELECT * FROM public.shift_segments WHERE shift_id = '${shiftId}';`);
      expect(segments.rows.length).toBe(1);
      expect(segments.rows[0].is_overnight).toBe(true);
    });

    it("creates Split Shift with two work segments separated by rest break", async () => {
      await asUser(userHrA);
      const res = await db.query<{ create_shift_definition: { ok: boolean; id: string } }>(`
        SELECT public.create_shift_definition(jsonb_build_object(
          'company_id', '${companyA}'::text,
          'code', 'SH-SPLIT',
          'name_ar', 'وردية فترتين (مقسمة)',
          'name_en', 'Split Shift',
          'type', 'split',
          'start_time', '08:00',
          'end_time', '12:00',
          'split_second_start_time', '16:00',
          'split_second_end_time', '20:00',
          'segments', jsonb_build_array(
            jsonb_build_object('segment_order', 1, 'start_time', '08:00', 'end_time', '12:00', 'segment_type', 'work', 'paid', true),
            jsonb_build_object('segment_order', 2, 'start_time', '12:00', 'end_time', '16:00', 'segment_type', 'break', 'paid', false),
            jsonb_build_object('segment_order', 3, 'start_time', '16:00', 'end_time', '20:00', 'segment_type', 'work', 'paid', true)
          )
        ));
      `);

      const shiftId = res.rows[0].create_shift_definition.id;
      const segments = await db.query<any>(`
        SELECT * FROM public.shift_segments WHERE shift_id = '${shiftId}' ORDER BY segment_order;
      `);
      expect(segments.rows.length).toBe(3);
      expect(segments.rows[1].segment_type).toBe("break");
      expect(segments.rows[1].paid).toBe(false);
    });

    it("updates shift definition by archiving old version and creating version 2", async () => {
      await asUser(userHrA);
      // Fetch SH-FIX
      const fix = await db.query<any>(`SELECT id FROM public.shifts WHERE code = 'SH-FIX' AND status = 'active';`);
      const oldId = fix.rows[0].id;

      // Simulate shift is actively referenced by inserting into schedule_assignments with published status
      await db.exec(`
        INSERT INTO public.schedule_assignments (
          company_id, employee_id, work_date, shift_id, shift_name_ar, is_rest_day, status
        ) VALUES (
          '${companyA}', '${empId1A}', '2026-10-01', '${oldId}', 'وردية سابقة', false, 'published'
        );
      `);

      const res = await db.query<{ update_shift_definition: { ok: boolean; id: string; version: number } }>(`
        SELECT public.update_shift_definition('${oldId}'::uuid, jsonb_build_object(
          'name_ar', 'وردية صباحية معدلة (v2)',
          'name_en', 'Morning Fixed v2',
          'type', 'fixed',
          'start_time', '07:30',
          'end_time', '16:30',
          'grace_minutes_arrival', 20,
          'grace_minutes_departure', 15,
          'min_rest_hours_after', 11
        ));
      `);

      const newId = res.rows[0].update_shift_definition.id;
      expect(newId).not.toBe(oldId);

      const oldShift = await db.query<any>(`SELECT * FROM public.shifts WHERE id = '${oldId}';`);
      expect(oldShift.rows[0].status).toBe("archived");

      const newShift = await db.query<any>(`SELECT * FROM public.shifts WHERE id = '${newId}';`);
      expect(newShift.rows[0].version).toBe(2);
      expect(newShift.rows[0].status).toBe("active");
      expect(newShift.rows[0].start_time).toBe("07:30:00");
    });

    it("archives a shift definition", async () => {
      await asUser(userHrA);
      const res = await db.query<{ create_shift_definition: { ok: boolean; id: string } }>(`
        SELECT public.create_shift_definition(jsonb_build_object(
          'company_id', '${companyA}'::text,
          'code', 'SH-TEMP',
          'name_ar', 'وردية مؤقتة',
          'type', 'fixed',
          'start_time', '09:00',
          'end_time', '15:00'
        ));
      `);
      const shiftId = res.rows[0].create_shift_definition.id;

      const archRes = await db.query<{ archive_shift_definition: { ok: boolean; id: string; status: string } }>(`
        SELECT public.archive_shift_definition('${shiftId}'::uuid);
      `);
      expect(archRes.rows[0].archive_shift_definition.ok).toBe(true);

      const archived = await db.query<any>(`SELECT status FROM public.shifts WHERE id = '${shiftId}';`);
      expect(archived.rows[0].status).toBe("archived");
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Roster Period Management & Tenant Isolation
  // --------------------------------------------------------------------------
  describe("Suite 2: Roster Period Management & Tenant Isolation", () => {
    let rosterA: string;
    let rosterB: string;

    it("creates distinct roster periods for Company A and Company B", async () => {
      await asUser(userHrA);
      const resA = await db.query<any>(`
        INSERT INTO public.roster_periods (company_id, name, period_start, period_end, status)
        VALUES ('${companyA}', 'جدول أكتوبر الأسبوع 1 - الشركة أ', '2026-10-04', '2026-10-10', 'draft')
        RETURNING id;
      `);
      rosterA = resA.rows[0].id;
      expect(rosterA).toBeTruthy();

      await asUser(userHrB);
      const resB = await db.query<any>(`
        INSERT INTO public.roster_periods (company_id, name, period_start, period_end, status)
        VALUES ('${companyB}', 'جدول أكتوبر - الشركة ب', '2026-10-04', '2026-10-10', 'draft')
        RETURNING id;
      `);
      rosterB = resB.rows[0].id;
      expect(rosterB).toBeTruthy();
    });

    it("enforces tenant isolation: HR of Company A cannot detect conflicts or publish Company B roster", async () => {
      await asUser(userHrA);
      // Attempting to detect conflicts for Company B's roster period
      await expect(
        db.query(`SELECT public.detect_roster_conflicts('${rosterB}'::uuid);`)
      ).rejects.toThrow(/غير مصرح|غير موجودة/);

      // Attempting to publish Company B's roster
      await expect(
        db.query(`SELECT public.publish_roster('${rosterB}'::uuid);`)
      ).rejects.toThrow(/غير مصرح|غير موجودة/);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Conflict Detection Engine
  // --------------------------------------------------------------------------
  describe("Suite 3: Conflict Detection Engine", () => {
    let rosterId: string;
    let shiftMorning: string;
    let shiftEvening: string;

    beforeAll(async () => {
      await asUser(userHrA);
      const r = await db.query<any>(`
        INSERT INTO public.roster_periods (company_id, name, period_start, period_end, status)
        VALUES ('${companyA}', 'فترة فحص التعارضات', '2026-10-11', '2026-10-17', 'draft')
        RETURNING id;
      `);
      rosterId = r.rows[0].id;

      // Shifts
      const s1 = await db.query<any>(`
        INSERT INTO public.shifts (company_id, code, name_ar, name_en, type, start_time, end_time, min_rest_hours_after)
        VALUES ('${companyA}', 'SH-M1', 'صباحي 07-15', 'Morning', 'fixed', '07:00', '15:00', 11)
        RETURNING id;
      `);
      shiftMorning = s1.rows[0].id;

      const s2 = await db.query<any>(`
        INSERT INTO public.shifts (company_id, code, name_ar, name_en, type, start_time, end_time, min_rest_hours_after)
        VALUES ('${companyA}', 'SH-E1', 'مسائي 16-00', 'Evening', 'fixed', '16:00', '00:00', 11)
        RETURNING id;
      `);
      shiftEvening = s2.rows[0].id;
    });

    it("detects insufficient rest between consecutive days (< 11 hours)", async () => {
      await asUser(userHrA);

      // Day 1 (2026-10-11): Evening shift 16:00 -> 00:00 (ends at midnight)
      await db.exec(`
        INSERT INTO public.schedule_assignments (
          company_id, employee_id, roster_period_id, work_date, shift_id, shift_name_ar, shift_color, is_rest_day, status
        ) VALUES (
          '${companyA}', '${empId1A}', '${rosterId}', '2026-10-11', '${shiftEvening}', 'مسائي 16-00', '#0284c7', false, 'draft'
        );
      `);

      // Day 2 (2026-10-12): Morning shift 07:00 -> 15:00 (rest between 00:00 and 07:00 is 7 hours < 11 hours minimum)
      await db.exec(`
        INSERT INTO public.schedule_assignments (
          company_id, employee_id, roster_period_id, work_date, shift_id, shift_name_ar, shift_color, is_rest_day, status
        ) VALUES (
          '${companyA}', '${empId1A}', '${rosterId}', '2026-10-12', '${shiftMorning}', 'صباحي 07-15', '#0284c7', false, 'draft'
        );
      `);

      const res = await db.query<{ detect_roster_conflicts: any }>(
        `SELECT public.detect_roster_conflicts('${rosterId}'::uuid);`
      );

      const conflicts = res.rows[0].detect_roster_conflicts;
      expect(conflicts.conflict_count).toBeGreaterThanOrEqual(1);

      // Verify exception recorded in roster_exceptions
      const exceptions = await db.query<any>(`
        SELECT * FROM public.roster_exceptions
        WHERE roster_period_id = '${rosterId}' AND exception_type = 'insufficient_rest';
      `);
      expect(exceptions.rows.length).toBeGreaterThanOrEqual(1);
      expect(exceptions.rows[0].message).toContain("فترة راحة غير كافية");
    });

    it("detects exceeding maximum consecutive work days (> 6 days)", async () => {
      await asUser(userHrA);
      // Clean previous assignments
      await db.exec(`DELETE FROM public.schedule_assignments WHERE roster_period_id = '${rosterId}';`);

      // Assign all 7 days as work days for empId2A
      const dates = [
        "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14",
        "2026-10-15", "2026-10-16", "2026-10-17"
      ];

      for (const d of dates) {
        await db.exec(`
          INSERT INTO public.schedule_assignments (
            company_id, employee_id, roster_period_id, work_date, shift_id, shift_name_ar, shift_color, is_rest_day, status
          ) VALUES (
            '${companyA}', '${empId2A}', '${rosterId}', '${d}', '${shiftMorning}', 'صباحي', '#0284c7', false, 'draft'
          );
        `);
      }

      const res = await db.query<{ detect_roster_conflicts: any }>(
        `SELECT public.detect_roster_conflicts('${rosterId}'::uuid);`
      );

      const conflicts = res.rows[0].detect_roster_conflicts;
      expect(conflicts.conflict_count).toBeGreaterThanOrEqual(1);

      const exc = await db.query<any>(`
        SELECT * FROM public.roster_exceptions
        WHERE roster_period_id = '${rosterId}' AND exception_type = 'excess_hours';
      `);
      expect(exc.rows.length).toBeGreaterThanOrEqual(1);
      expect(exc.rows[0].message).toContain("أيام عمل متتالية");
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 4: Atomic Publishing Engine
  // --------------------------------------------------------------------------
  describe("Suite 4: Atomic Publishing Engine", () => {
    let rosterId: string;
    let shiftId: string;

    beforeAll(async () => {
      await asUser(userHrA);
      const r = await db.query<any>(`
        INSERT INTO public.roster_periods (company_id, name, period_start, period_end, status)
        VALUES ('${companyA}', 'فترة نشر سليمة', '2026-10-18', '2026-10-24', 'draft')
        RETURNING id;
      `);
      rosterId = r.rows[0].id;

      const s = await db.query<any>(`
        INSERT INTO public.shifts (company_id, code, name_ar, name_en, type, start_time, end_time)
        VALUES ('${companyA}', 'SH-PUB', 'وردية النشر', 'Publish Shift', 'fixed', '09:00', '17:00')
        RETURNING id;
      `);
      shiftId = s.rows[0].id;

      // Assign valid schedule with rest days
      await db.exec(`
        INSERT INTO public.schedule_assignments (
          company_id, employee_id, roster_period_id, work_date, shift_id, shift_name_ar, is_rest_day, status
        ) VALUES
          ('${companyA}', '${empId1A}', '${rosterId}', '2026-10-18', '${shiftId}', 'وردية النشر', false, 'draft'),
          ('${companyA}', '${empId1A}', '${rosterId}', '2026-10-19', '${shiftId}', 'وردية النشر', false, 'draft'),
          ('${companyA}', '${empId1A}', '${rosterId}', '2026-10-20', '${shiftId}', 'وردية النشر', false, 'draft'),
          ('${companyA}', '${empId1A}', '${rosterId}', '2026-10-21', '${shiftId}', 'وردية النشر', false, 'draft'),
          ('${companyA}', '${empId1A}', '${rosterId}', '2026-10-22', '${shiftId}', 'وردية النشر', false, 'draft'),
          ('${companyA}', '${empId1A}', '${rosterId}', '2026-10-23', NULL, 'راحة أسبوعية', true, 'draft'),
          ('${companyA}', '${empId1A}', '${rosterId}', '2026-10-24', NULL, 'راحة أسبوعية', true, 'draft');
      `);
    });

    it("atomically publishes roster period and all child assignments", async () => {
      await asUser(userHrA);

      const pubRes = await db.query<{ publish_roster: any }>(
        `SELECT public.publish_roster('${rosterId}'::uuid);`
      );

      const result = pubRes.rows[0].publish_roster;
      expect(result.ok).toBe(true);
      expect(result.published_assignments).toBe(7);

      // Verify period status updated to published
      const period = await db.query<any>(`SELECT * FROM public.roster_periods WHERE id = '${rosterId}';`);
      expect(period.rows[0].status).toBe("published");
      expect(period.rows[0].published_at).not.toBeNull();
      expect(period.rows[0].version).toBe(1);

      // Verify all assignments updated to published
      const assignments = await db.query<any>(`
        SELECT count(*) as count FROM public.schedule_assignments
        WHERE roster_period_id = '${rosterId}' AND status = 'published';
      `);
      expect(Number(assignments.rows[0].count)).toBe(7);
    });

    it("audit log recorded for publishing", async () => {
      const logs = await db.query<any>(`
        SELECT * FROM public.roster_audit_logs
        WHERE (roster_period_id = '${rosterId}' OR entity_id = '${rosterId}') AND action IN ('publish', 'roster_published');
      `);
      expect(logs.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 5: Attendance Interlock
  // --------------------------------------------------------------------------
  describe("Suite 5: Attendance Period Lock Interlock", () => {
    let closedPeriodId: string;

    beforeAll(async () => {
      await asUser(userHrA);
      // Create a closed attendance period for September 2026
      const att = await db.query<any>(`
        INSERT INTO public.attendance_periods (
          company_id, period_year, period_month, from_date, to_date, status
        ) VALUES (
          '${companyA}', 2026, 9, '2026-09-01', '2026-09-30', 'closed'
        ) RETURNING id;
      `);
      closedPeriodId = att.rows[0].id;
    });

    it("strictly blocks modifying schedule assignments inside a closed attendance period", async () => {
      await asUser(userHrA);

      // Attempt to insert assignment on 2026-09-15 (inside closed attendance period)
      await expect(
        db.exec(`
          INSERT INTO public.schedule_assignments (
            company_id, employee_id, work_date, shift_id, shift_name_ar, is_rest_day, status
          ) VALUES (
            '${companyA}', '${empId1A}', '2026-09-15', NULL, 'تعديل متأخر', false, 'draft'
          );
        `)
      ).rejects.toThrow(/لا يمكن تعديل أو حذف جدول العمل لتاريخ/);
    });

    it("allows modifying schedule assignments outside closed attendance periods", async () => {
      await asUser(userHrA);

      // Date in November 2026 (outside closed period)
      await expect(
        db.exec(`
          INSERT INTO public.schedule_assignments (
            company_id, employee_id, work_date, shift_id, shift_name_ar, is_rest_day, status
          ) VALUES (
            '${companyA}', '${empId1A}', '2026-11-15', NULL, 'دوام قادم', false, 'draft'
          );
        `)
      ).resolves.not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 6: Peer-to-Peer Shift Swap Workflow
  // --------------------------------------------------------------------------
  describe("Suite 6: Shift Swap Request & Transactional Approval", () => {
    let assign1Id: string;
    let assign2Id: string;
    let swapId: string;
    let shiftDayId: string;
    let shiftEveId: string;

    beforeAll(async () => {
      await asUser(userHrA);
      // Create actual shift definitions
      const s1 = await db.query<any>(`
        INSERT INTO public.shifts (company_id, code, name_ar, name_en, type, start_time, end_time)
        VALUES ('${companyA}', 'SH-DAY', 'وردية النهار', 'Day Shift', 'fixed', '08:00', '16:00')
        RETURNING id;
      `);
      shiftDayId = s1.rows[0].id;

      const s2 = await db.query<any>(`
        INSERT INTO public.shifts (company_id, code, name_ar, name_en, type, start_time, end_time)
        VALUES ('${companyA}', 'SH-EVE', 'وردية المساء', 'Evening Shift', 'fixed', '16:00', '00:00')
        RETURNING id;
      `);
      shiftEveId = s2.rows[0].id;

      const a1 = await db.query<any>(`
        INSERT INTO public.schedule_assignments (
          company_id, employee_id, work_date, shift_id, shift_name_ar, shift_color, is_rest_day, status
        ) VALUES (
          '${companyA}', '${empId1A}', '2026-11-20', '${shiftDayId}', 'وردية النهار', '#0284c7', false, 'published'
        ) RETURNING id;
      `);
      assign1Id = a1.rows[0].id;

      const a2 = await db.query<any>(`
        INSERT INTO public.schedule_assignments (
          company_id, employee_id, work_date, shift_id, shift_name_ar, shift_color, is_rest_day, status
        ) VALUES (
          '${companyA}', '${empId2A}', '2026-11-20', '${shiftEveId}', 'وردية المساء', '#7c3aed', false, 'published'
        ) RETURNING id;
      `);
      assign2Id = a2.rows[0].id;

      // Submit swap request
      const sw = await db.query<any>(`
        INSERT INTO public.shift_swap_requests (
          company_id, requester_employee_id, requester_assignment_id, target_employee_id, target_assignment_id, reason, status
        ) VALUES (
          '${companyA}', '${empId1A}', '${assign1Id}', '${empId2A}', '${assign2Id}', 'ظرف عائلي', 'pending_approval'
        ) RETURNING id;
      `);
      swapId = sw.rows[0].id;
    });

    it("approves shift swap and atomically exchanges shifts between employees", async () => {
      await asUser(userHrA);

      const res = await db.query<{ approve_shift_swap: any }>(`
        SELECT public.approve_shift_swap('${swapId}'::uuid, 'معتمد من الموارد البشرية');
      `);

      expect(res.rows[0].approve_shift_swap.ok).toBe(true);

      // Verify Emp1 now has Evening shift
      const emp1Assign = await db.query<any>(`SELECT * FROM public.schedule_assignments WHERE id = '${assign1Id}';`);
      expect(emp1Assign.rows[0].shift_id).toBe(shiftEveId);
      expect(emp1Assign.rows[0].shift_name_ar).toBe("وردية المساء");
      expect(emp1Assign.rows[0].source).toBe("swap");

      // Verify Emp2 now has Day shift
      const emp2Assign = await db.query<any>(`SELECT * FROM public.schedule_assignments WHERE id = '${assign2Id}';`);
      expect(emp2Assign.rows[0].shift_id).toBe(shiftDayId);
      expect(emp2Assign.rows[0].shift_name_ar).toBe("وردية النهار");
      expect(emp2Assign.rows[0].source).toBe("swap");

      // Verify swap request status is approved
      const swap = await db.query<any>(`SELECT * FROM public.shift_swap_requests WHERE id = '${swapId}';`);
      expect(swap.rows[0].status).toBe("approved");
      expect(swap.rows[0].review_notes).toBe("معتمد من الموارد البشرية");
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 7: Prompt 13.1 Production Integrity Hotfix Validations
  // --------------------------------------------------------------------------
  describe("Suite 7: Prompt 13.1 Production Integrity Hotfix Validations", () => {
    let publishedRosterId: string;
    let publishedAssignId: string;
    let customShiftId: string;

    beforeAll(async () => {
      await asUser(userHrA);

      // Create a test shift with custom rest hours (14 hours)
      const s = await db.query<any>(`
        INSERT INTO public.shifts (
          company_id, code, name_ar, name_en, type, start_time, end_time, min_rest_hours_after
        ) VALUES (
          '${companyA}', 'SH-14H', 'وردية راحة خاصة', 'Custom Rest', 'fixed', '08:00', '16:00', 14
        ) RETURNING id;
      `);
      customShiftId = s.rows[0].id;

      // Create a roster period and assignments
      const r = await db.query<any>(`
        INSERT INTO public.roster_periods (company_id, name, period_start, period_end, status, timezone)
        VALUES ('${companyA}', 'فترة اختبار التعديل والثبات', '2026-12-01', '2026-12-07', 'draft', 'Asia/Riyadh')
        RETURNING id;
      `);
      publishedRosterId = r.rows[0].id;

      const a = await db.query<any>(`
        INSERT INTO public.schedule_assignments (
          company_id, employee_id, roster_period_id, work_date, shift_id, shift_name_ar, is_rest_day, status
        ) VALUES (
          '${companyA}', '${empId1A}', '${publishedRosterId}', '2026-12-01', '${customShiftId}', 'وردية راحة خاصة', false, 'draft'
        ) RETURNING id;
      `);
      publishedAssignId = a.rows[0].id;

      // Seed a swap request in companyA
      const sw = await db.query<any>(`
        INSERT INTO public.shift_swap_requests (
          company_id, requester_employee_id, requester_assignment_id, target_employee_id, target_assignment_id, reason, status
        ) VALUES (
          '${companyA}', '${empId1A}', '${publishedAssignId}', '${empId2A}', '${publishedAssignId}', 'ظرف عائلي', 'pending_approval'
        ) RETURNING id;
      `);
      const testSwapId = sw.rows[0].id;

      // Publish the roster
      await db.query(`SELECT public.publish_roster('${publishedRosterId}'::uuid);`);

      (globalThis as any).testSwapId = testSwapId;
    });

    it("Rule 1 & 2: Non-admin employees are strictly blocked from administrative RPCs", async () => {
      await asUser(userEmp1A); // Normal employee
      const testSwapId = (globalThis as any).testSwapId;

      // Attempt create_shift_definition
      await expect(
        db.query(`
          SELECT public.create_shift_definition(jsonb_build_object(
            'company_id', '${companyA}'::text,
            'code', 'SH-HACK',
            'name_ar', 'محاولة غير مصرح بها',
            'type', 'fixed',
            'start_time', '08:00',
            'end_time', '16:00'
          ));
        `)
      ).rejects.toThrow(/غير مصرح/);

      // Attempt publish_roster
      await expect(
        db.query(`SELECT public.publish_roster('${publishedRosterId}'::uuid);`)
      ).rejects.toThrow(/غير مصرح/);

      // Attempt approve_shift_swap
      await expect(
        db.query(`SELECT public.approve_shift_swap('${testSwapId}'::uuid);`)
      ).rejects.toThrow(/غير مصرح/);

      // Attempt save_workweek_config
      await expect(
        db.query(`SELECT public.save_workweek_config('${companyA}'::uuid, '{"weekend_days": [5,6]}'::jsonb);`)
      ).rejects.toThrow(/غير مصرح/);
    });

    it("Rule 12: Published schedule assignments are immutable against direct mutations", async () => {
      await asUser(userHrA);

      // Direct UPDATE on published assignment is blocked by trigger trg_prevent_published_assignment_mutation
      await expect(
        db.exec(`
          UPDATE public.schedule_assignments
          SET shift_name_ar = 'تعديل غير مسموح'
          WHERE id = '${publishedAssignId}';
        `)
      ).rejects.toThrow(/لا يمكن تعديل أو حذف إسنادات جدول معتمد/);

      // Direct DELETE on published assignment is blocked
      await expect(
        db.exec(`
          DELETE FROM public.schedule_assignments
          WHERE id = '${publishedAssignId}';
        `)
      ).rejects.toThrow(/لا يمكن تعديل أو حذف إسنادات جدول معتمد/);
    });

    it("Rule 13: Controlled Amendment generates genuine Version+1 roster draft with copied assignments", async () => {
      await asUser(userHrA);

      const amendRes = await db.query<{ create_roster_amendment: any }>(`
        SELECT public.create_roster_amendment('${publishedRosterId}'::uuid, 'تعديل رسمي للجدول');
      `);

      const amend = amendRes.rows[0].create_roster_amendment;
      expect(amend.ok).toBe(true);
      expect(amend.version).toBe(2);
      expect(amend.status).toBe("draft");
      expect(amend.copied_assignments_count).toBeGreaterThanOrEqual(1);

      const newPeriodId = amend.id;

      // In the new draft, assignments have draft status and can be edited
      const draftAssignments = await db.query<any>(`
        SELECT * FROM public.schedule_assignments WHERE roster_period_id = '${newPeriodId}';
      `);
      expect(draftAssignments.rows.length).toBeGreaterThanOrEqual(1);
      expect(draftAssignments.rows[0].status).toBe("draft");
      expect(draftAssignments.rows[0].roster_version).toBe(2);

      // Editing the draft assignment via set_roster_assignment succeeds
      const updateDraft = await db.query<{ set_roster_assignment: any }>(`
        SELECT public.set_roster_assignment(jsonb_build_object(
          'id', '${draftAssignments.rows[0].id}',
          'company_id', '${companyA}'::text,
          'roster_period_id', '${newPeriodId}'::text,
          'employee_id', '${empId1A}'::text,
          'work_date', '2026-12-01',
          'shift_id', '${customShiftId}',
          'shift_name_ar', 'تعديل في المسودة',
          'is_rest_day', false
        ));
      `);
      expect(updateDraft.rows[0].set_roster_assignment.ok).toBe(true);
    });

    it("Rule 4, 6 & 18: Conflict engine detects canonical leave collision and dynamic rest/streak rules", async () => {
      await asUser(userHrA);

      // Create period for conflict check
      const r = await db.query<any>(`
        INSERT INTO public.roster_periods (company_id, name, period_start, period_end, status)
        VALUES ('${companyA}', 'فترة فحص الإجازة', '2026-12-10', '2026-12-16', 'draft')
        RETURNING id;
      `);
      const testRosterId = r.rows[0].id;

      // Seed canonical leave in leave_requests
      await db.exec(`
        INSERT INTO public.leave_requests (company_id, employee_id, start_date, end_date, status)
        VALUES ('${companyA}', '${empId1A}', '2026-12-11', '2026-12-12', 'approved');
      `);

      // Assign work on the leave day (2026-12-11)
      await db.exec(`
        INSERT INTO public.schedule_assignments (
          company_id, employee_id, roster_period_id, work_date, shift_id, shift_name_ar, is_rest_day, status
        ) VALUES (
          '${companyA}', '${empId1A}', '${testRosterId}', '2026-12-11', '${customShiftId}', 'دوام متعارض مع إجازة', false, 'draft'
        );
      `);

      // Configure company workweek with max 4 consecutive days
      await db.query(`
        SELECT public.save_workweek_config('${companyA}'::uuid, jsonb_build_object(
          'weekend_days', jsonb_build_array(5),
          'max_consecutive_work_days', 4,
          'min_weekly_rest_hours', 24,
          'default_daily_hours', 8
        ));
      `);

      const conflictRes = await db.query<{ detect_roster_conflicts: any }>(`
        SELECT public.detect_roster_conflicts('${testRosterId}'::uuid);
      `);

      const conflicts = conflictRes.rows[0].detect_roster_conflicts;
      expect(conflicts.conflict_count).toBeGreaterThanOrEqual(1);

      // Verify leave conflict recorded
      const leaveExceptions = await db.query<any>(`
        SELECT * FROM public.roster_exceptions
        WHERE roster_period_id = '${testRosterId}' AND exception_type = 'leave_conflict';
      `);
      expect(leaveExceptions.rows.length).toBeGreaterThanOrEqual(1);
      expect(leaveExceptions.rows[0].severity).toBe("blocking");
      expect(leaveExceptions.rows[0].message).toContain("إجازة رسمية معتمدة");
    });
  });
});
