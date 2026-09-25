import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 12.3 Item 14: Full Migration Chain Applied from Zero (PGlite)", () => {
  it("applies 20260924000000, 20260924010000, 20260924020000, and 20260924030000 sequentially from scratch", async () => {
    const db = new PGlite();

    // Setup base auth schema, Supabase default roles, and core parent tables
    await db.exec(`
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'authenticated'::text $$;

      DO $$ BEGIN
        CREATE TYPE public.app_role AS ENUM (
          'super_admin', 'org_admin', 'hr_manager', 'line_manager',
          'attendance_officer', 'payroll_officer', 'employee'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

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
        latitude double precision,
        longitude double precision,
        radius_meters integer,
        default_shift_id uuid,
        status text DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS public.employees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid,
        company_id uuid REFERENCES public.companies(id),
        manager_id uuid REFERENCES public.employees(id),
        work_location_id uuid REFERENCES public.work_locations(id),
        employee_no text,
        full_name text,
        hire_date date DEFAULT CURRENT_DATE,
        exit_date date,
        status text DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS public.user_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        role public.app_role NOT NULL
      );

      CREATE OR REPLACE FUNCTION public.current_company_id()
      RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT company_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1
      $$;

      CREATE TABLE IF NOT EXISTS public.company_holidays (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text,
        start_date date NOT NULL,
        end_date date NOT NULL,
        is_paid boolean DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS public.shifts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        code text,
        name_ar text NOT NULL,
        name_en text,
        color text DEFAULT '#10b981',
        type text NOT NULL DEFAULT 'fixed',
        start_time time NOT NULL DEFAULT '08:00:00',
        end_time time NOT NULL DEFAULT '17:00:00',
        grace_minutes_arrival integer DEFAULT 15,
        grace_minutes_departure integer DEFAULT 15,
        overtime_eligible boolean DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.schedule_assignments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
        shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
        work_date date NOT NULL,
        is_rest_day boolean DEFAULT false,
        status text NOT NULL DEFAULT 'published',
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (employee_id, work_date)
      );

      CREATE TABLE IF NOT EXISTS public.punches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
        punch_time timestamptz NOT NULL,
        punch_type text NOT NULL DEFAULT 'in',
        source text NOT NULL DEFAULT 'mobile_gps',
        latitude double precision,
        longitude double precision,
        geofence_valid boolean DEFAULT true,
        device_id text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.overtime_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
        work_date date NOT NULL,
        hours numeric(5,2) NOT NULL DEFAULT 0,
        rate_type text NOT NULL DEFAULT 'standard',
        status text NOT NULL DEFAULT 'approved',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      DO $$ BEGIN
        CREATE TYPE public.attendance_status AS ENUM (
          'present', 'late', 'early_departure', 'absent', 'on_leave',
          'leave', 'holiday', 'rest_day', 'missing_punch', 'remote'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS public.attendance_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
        work_date date NOT NULL,
        check_in time,
        check_out time,
        status public.attendance_status NOT NULL DEFAULT 'present',
        worked_hours numeric(5,2) NOT NULL DEFAULT 0,
        note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (employee_id, work_date)
      );

      CREATE TABLE IF NOT EXISTS public.requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id),
        type text NOT NULL,
        status text NOT NULL DEFAULT 'approved',
        start_date date,
        end_date date,
        days numeric(5,2),
        payload jsonb
      );

      CREATE TABLE IF NOT EXISTS public.attendance_devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
        name text,
        provider text DEFAULT 'generic',
        serial_number text UNIQUE,
        connection_type text DEFAULT 'cloud_api',
        last_sync_at timestamptz,
        status text DEFAULT 'active',
        created_at timestamptz DEFAULT now()
      );
    `);

    const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");

    // Migration 0
    const m0Path = path.join(migrationsDir, "20260924000000_production_attendance_engine.sql");
    expect(fs.existsSync(m0Path)).toBe(true);
    const m0Sql = fs.readFileSync(m0Path, "utf-8");
    await db.exec(m0Sql);

    // Migration 1
    const m1Path = path.join(migrationsDir, "20260924010000_finalize_attendance_integrity_and_tenant_security.sql");
    expect(fs.existsSync(m1Path)).toBe(true);
    const m1Sql = fs.readFileSync(m1Path, "utf-8");
    await db.exec(m1Sql);

    // Migration 2
    const m2Path = path.join(migrationsDir, "20260924020000_finalize_attendance_authorization_and_snapshot_truth.sql");
    expect(fs.existsSync(m2Path)).toBe(true);
    const m2Sql = fs.readFileSync(m2Path, "utf-8");
    await db.exec(m2Sql);

    // Migration 3 (New Prompt 12.3 migration)
    const m3Path = path.join(migrationsDir, "20260924030000_close_attendance_truthfulness_gaps.sql");
    expect(fs.existsSync(m3Path)).toBe(true);
    const m3Sql = fs.readFileSync(m3Path, "utf-8");
    await db.exec(m3Sql);

    // Verify final state
    const tableRes = await db.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN (
        'attendance_policies', 'shifts', 'schedule_assignments',
        'punches', 'attendance_records', 'attendance_periods',
        'attendance_payroll_snapshots'
      );
    `);
    expect(tableRes.rows.length).toBe(7);

    // Verify calculate_shift_expected_minutes is installed
    const procRes = await db.query(`
      SELECT proname FROM pg_proc WHERE proname = 'calculate_shift_expected_minutes';
    `);
    expect(procRes.rows.length).toBe(1);

    // Verify gps_accuracy_action has no default
    const colRes = await db.query<{ column_default: string | null }>(`
      SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'attendance_policies' AND column_name = 'gps_accuracy_action';
    `);
    expect(colRes.rows[0]?.column_default).toBeNull();
  }, 30000);
});
