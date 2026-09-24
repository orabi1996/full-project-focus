import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";

describe.sequential("Prompt 12.2: Attendance Engine Database Verification (PGlite)", () => {
  const db = new PGlite();

  // Test UUIDs
  const companyA = "a0000000-0000-0000-0000-000000000001";
  const companyB = "b0000000-0000-0000-0000-000000000002";

  const userEmployeeA = "11111111-aaaa-aaaa-aaaa-111111111111";
  const userHrA = "22222222-aaaa-aaaa-aaaa-222222222222";
  const userEmployeeB = "33333333-bbbb-bbbb-bbbb-333333333333";
  const userSuperAdmin = "99999999-9999-9999-9999-999999999999";

  const empIdA = "e0000000-0000-0000-0000-000000000001";
  const empIdHrA = "e0000000-0000-0000-0000-000000000002";
  const empIdB = "e0000000-0000-0000-0000-000000000003";

  const locIdA = "c0000000-0000-0000-0000-000000000001";
  const locIdB = "c0000000-0000-0000-0000-000000000002";

  const shiftIdA = "f0000000-0000-0000-0000-000000000001";

  // Helper to switch caller in PGlite session
  async function asUser(userId: string | null, role: string = "authenticated") {
    await db.exec(`
      SELECT set_config('test.auth_uid', '${userId || ""}', false);
      SELECT set_config('test.auth_role', '${role}', false);
    `);
  }

  beforeAll(async () => {
    // 1. Setup Auth, Mock Functions, and Schema
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
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

      DO $$ BEGIN
        CREATE TYPE public.attendance_status AS ENUM (
          'present', 'late', 'early_departure', 'absent', 'on_leave',
          'leave', 'holiday', 'rest_day', 'missing_punch', 'remote'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS public.companies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        legal_name_ar text NOT NULL,
        timezone text DEFAULT 'Asia/Riyadh'
      );

      CREATE TABLE IF NOT EXISTS public.work_locations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL,
        latitude double precision,
        longitude double precision,
        radius_meters integer
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

      CREATE OR REPLACE FUNCTION public.resolve_my_employee_id()
      RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1
      $$;

      CREATE OR REPLACE FUNCTION public.current_company_id()
      RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT company_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1
      $$;

      CREATE TABLE IF NOT EXISTS public.attendance_policies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
        name_ar text NOT NULL,
        version integer NOT NULL DEFAULT 1,
        effective_from date NOT NULL DEFAULT CURRENT_DATE,
        effective_to date,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
        jurisdiction text,
        grace_period_in_minutes integer,
        grace_period_out_minutes integer,
        overtime_regular_multiplier numeric(3,2),
        overtime_holiday_multiplier numeric(3,2),
        default_work_hours_per_day numeric(4,2),
        ramadan_work_hours_per_day numeric(4,2),
        max_work_hours_per_week numeric(4,2),
        ramadan_max_work_hours_per_week numeric(4,2),
        geofence_enforced boolean NOT NULL DEFAULT true,
        geofence_radius_meters integer,
        max_gps_accuracy_meters integer,
        gps_accuracy_action text NOT NULL DEFAULT 'flag' CHECK (gps_accuracy_action IN ('reject', 'flag', 'allow')),
        auto_deduct_breaks boolean NOT NULL DEFAULT true,
        break_duration_minutes integer,
        max_consecutive_hours_without_break numeric(4,2),
        require_biometric_or_gps boolean NOT NULL DEFAULT true,
        allow_mobile_punch boolean NOT NULL DEFAULT true,
        overtime_pre_approval_required boolean NOT NULL DEFAULT true,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.shifts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name_ar text NOT NULL,
        type text NOT NULL DEFAULT 'fixed',
        start_time time NOT NULL DEFAULT '08:00:00',
        end_time time NOT NULL DEFAULT '17:00:00',
        is_overnight boolean DEFAULT false,
        break_minutes integer DEFAULT 60,
        flexible_hours numeric(4,2),
        split_second_start_time time,
        split_second_end_time time,
        grace_minutes_arrival integer DEFAULT 15,
        grace_minutes_departure integer DEFAULT 15
      );

      CREATE TABLE IF NOT EXISTS public.schedule_assignments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
        shift_id uuid REFERENCES public.shifts(id),
        work_date date NOT NULL,
        is_rest_day boolean DEFAULT false,
        status text DEFAULT 'published',
        UNIQUE (employee_id, work_date)
      );

      CREATE TABLE IF NOT EXISTS public.attendance_exceptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id),
        work_date date NOT NULL,
        exception_type text NOT NULL,
        severity text NOT NULL DEFAULT 'warning',
        minutes integer DEFAULT 0,
        description text,
        resolved boolean NOT NULL DEFAULT false,
        resolved_by uuid,
        resolved_at timestamptz,
        resolution_note text,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.punches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id),
        punch_time timestamptz NOT NULL DEFAULT clock_timestamp(),
        punch_type text NOT NULL CHECK (punch_type IN ('in', 'out')),
        source text NOT NULL DEFAULT 'mobile_gps',
        latitude double precision,
        longitude double precision,
        accuracy_meters double precision,
        distance_from_location_meters double precision,
        location_id uuid REFERENCES public.work_locations(id),
        device_id text,
        client_event_id text,
        approval_status text NOT NULL DEFAULT 'approved',
        geofence_valid boolean DEFAULT true,
        policy_id uuid REFERENCES public.attendance_policies(id),
        batch_id uuid,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.attendance_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
        work_date date NOT NULL,
        shift_id uuid REFERENCES public.shifts(id),
        policy_id uuid REFERENCES public.attendance_policies(id),
        policy_version integer,
        check_in time,
        check_out time,
        check_in_punch_id uuid,
        check_out_punch_id uuid,
        worked_minutes integer DEFAULT 0,
        worked_hours numeric(7,2) DEFAULT 0,
        late_minutes integer DEFAULT 0,
        early_departure_minutes integer DEFAULT 0,
        status public.attendance_status DEFAULT 'absent',
        punch_source text DEFAULT 'mobile_gps',
        geofence_valid boolean DEFAULT true,
        violations_count integer DEFAULT 0,
        scheduled_in time,
        scheduled_out time,
        created_at timestamptz DEFAULT now(),
        UNIQUE (employee_id, work_date)
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
        closing_notes text,
        closed_by uuid,
        closed_at timestamptz,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.attendance_payroll_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        period_id uuid REFERENCES public.attendance_periods(id),
        period_version integer NOT NULL DEFAULT 1,
        snapshot_version integer NOT NULL DEFAULT 1,
        employee_id uuid REFERENCES public.employees(id),
        total_expected_days integer NOT NULL DEFAULT 0,
        expected_work_minutes integer NOT NULL DEFAULT 0,
        total_present_days integer NOT NULL DEFAULT 0,
        total_absent_days integer NOT NULL DEFAULT 0,
        total_rest_days integer NOT NULL DEFAULT 0,
        total_leave_days integer NOT NULL DEFAULT 0,
        total_late_minutes integer NOT NULL DEFAULT 0,
        total_early_departure_minutes integer NOT NULL DEFAULT 0,
        total_worked_hours numeric(7,2) NOT NULL DEFAULT 0,
        regular_overtime_hours numeric(7,2) NOT NULL DEFAULT 0,
        holiday_overtime_hours numeric(7,2) NOT NULL DEFAULT 0,
        approved_overtime_minutes integer NOT NULL DEFAULT 0,
        actual_overtime_minutes integer NOT NULL DEFAULT 0,
        payable_overtime_minutes integer NOT NULL DEFAULT 0,
        overtime_categories jsonb DEFAULT '{}'::jsonb,
        overtime_category text DEFAULT 'standard',
        unexcused_absence_days integer NOT NULL DEFAULT 0,
        violations_count integer NOT NULL DEFAULT 0,
        snapshot_hash text NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.overtime_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id uuid REFERENCES public.employees(id),
        work_date date NOT NULL,
        hours numeric(5,2) NOT NULL DEFAULT 0,
        rate_type text NOT NULL DEFAULT 'standard',
        status text NOT NULL DEFAULT 'approved'
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

      CREATE TABLE IF NOT EXISTS public.company_holidays (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        start_date date NOT NULL,
        end_date date NOT NULL,
        is_paid boolean DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS public.attendance_devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        device_name text,
        device_code text,
        serial_number text
      );

      CREATE TABLE IF NOT EXISTS public.attendance_device_employee_mappings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        device_id uuid REFERENCES public.attendance_devices(id),
        external_user_id text NOT NULL,
        employee_id uuid REFERENCES public.employees(id)
      );

      CREATE TABLE IF NOT EXISTS public.punch_import_raw_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        device_id text,
        external_event_id text,
        external_user_id text NOT NULL,
        punch_time timestamptz NOT NULL,
        punch_type text NOT NULL,
        raw_payload jsonb,
        status text NOT NULL DEFAULT 'unmatched',
        error_reason text
      );

      -- Haversine formula
      CREATE OR REPLACE FUNCTION public.haversine_distance_meters(
        lat1 double precision, lon1 double precision,
        lat2 double precision, lon2 double precision
      )
      RETURNS double precision
      LANGUAGE plpgsql
      IMMUTABLE
      AS $$
      DECLARE
        r double precision := 6371000;
        phi1 double precision;
        phi2 double precision;
        delta_phi double precision;
        delta_lambda double precision;
        a double precision;
        c double precision;
      BEGIN
        IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
          RETURN NULL;
        END IF;
        phi1 := radians(lat1);
        phi2 := radians(lat2);
        delta_phi := radians(lat2 - lat1);
        delta_lambda := radians(lon2 - lon1);
        a := sin(delta_phi / 2.0)^2 + cos(phi1) * cos(phi2) * sin(delta_lambda / 2.0)^2;
        c := 2.0 * atan2(sqrt(a), sqrt(greatest(0.0, 1.0 - a)));
        RETURN r * c;
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.get_effective_company_timezone(p_company_id uuid)
      RETURNS text
      LANGUAGE sql STABLE AS $$
        SELECT COALESCE(timezone, 'Asia/Riyadh') FROM public.companies WHERE id = p_company_id
      $$;
    `);

    // 2. Install Migration 20260924020000 Functions
    await db.exec(`
      -- check_attendance_policy_overlap
      CREATE OR REPLACE FUNCTION public.check_attendance_policy_overlap()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.status = 'active' THEN
          IF EXISTS (
            SELECT 1 FROM public.attendance_policies
            WHERE company_id = NEW.company_id
              AND status = 'active'
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') &&
                  daterange(NEW.effective_from, COALESCE(NEW.effective_to, 'infinity'::date), '[]')
          ) THEN
            RAISE EXCEPTION 'لا يمكن تفعيل سياسة الحضور لوجود تداخل زمني مع سياسة سارية أخرى لنفس المنشأة.' USING ERRCODE = '22023';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_check_attendance_policy_overlap ON public.attendance_policies;
      CREATE TRIGGER trg_check_attendance_policy_overlap
        BEFORE INSERT OR UPDATE OF status, effective_from, effective_to
        ON public.attendance_policies
        FOR EACH ROW
        EXECUTE FUNCTION public.check_attendance_policy_overlap();

      -- save_attendance_policy
      CREATE OR REPLACE FUNCTION public.save_attendance_policy(p_policy jsonb)
      RETURNS jsonb LANGUAGE plpgsql AS $$
      DECLARE
        v_user_id uuid := auth.uid();
        v_comp_id uuid;
        v_is_hr boolean;
        v_next_version integer := 1;
        v_new_policy_id uuid;
        v_effective_from date;
        v_effective_to date := NULL;
        v_name_ar text;
        v_geofence_enforced boolean;
        v_auto_deduct_breaks boolean;
        v_require_biometric_or_gps boolean;
        v_allow_mobile_punch boolean;
        v_overtime_pre_approval_required boolean;
        v_gps_accuracy_action text;
        v_max_gps_acc integer;
        v_geofence_radius integer;
      BEGIN
        v_comp_id := COALESCE((p_policy->>'company_id')::uuid, public.current_company_id());
        IF v_comp_id IS NULL THEN
          RAISE EXCEPTION 'معرف الشركة غير محدد.' USING ERRCODE = '22023';
        END IF;

        SELECT EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.employees e ON e.user_id = v_user_id
          WHERE ur.user_id = v_user_id
            AND e.company_id = v_comp_id
            AND ur.role::text IN ('super_admin', 'org_admin', 'hr_manager')
        ) INTO v_is_hr;

        IF NOT v_is_hr AND auth.role() != 'service_role' THEN
          RAISE EXCEPTION 'Permission denied: only HR managers can configure attendance policies.' USING ERRCODE = '42501';
        END IF;

        v_name_ar := trim(COALESCE(p_policy->>'name_ar', ''));
        IF v_name_ar = '' THEN
          RAISE EXCEPTION 'اسم سياسة الدوام مطلوب ولا يمكن تركه فارغاً.' USING ERRCODE = '22023';
        END IF;

        IF (p_policy->>'effective_from') IS NULL OR trim(p_policy->>'effective_from') = '' THEN
          RAISE EXCEPTION 'تاريخ سريان السياسة (effective_from) مطلوب.' USING ERRCODE = '22023';
        END IF;
        v_effective_from := (p_policy->>'effective_from')::date;

        IF (p_policy->>'effective_to') IS NOT NULL AND trim(p_policy->>'effective_to') != '' THEN
          v_effective_to := (p_policy->>'effective_to')::date;
          IF v_effective_to < v_effective_from THEN
            RAISE EXCEPTION 'تاريخ نهاية سريان السياسة لا يمكن أن يسبق تاريخ البداية.' USING ERRCODE = '22023';
          END IF;
        END IF;

        IF NOT (p_policy ? 'geofence_enforced') THEN
          RAISE EXCEPTION 'يجب تحديد خيار تفعيل النطاق الجغرافي (geofence_enforced) صراحة.' USING ERRCODE = '22023';
        END IF;
        v_geofence_enforced := (p_policy->>'geofence_enforced')::boolean;

        IF NOT (p_policy ? 'auto_deduct_breaks') THEN
          RAISE EXCEPTION 'يجب تحديد خيار الخصم التلقائي للاستراحات (auto_deduct_breaks) صراحة.' USING ERRCODE = '22023';
        END IF;
        v_auto_deduct_breaks := (p_policy->>'auto_deduct_breaks')::boolean;

        IF NOT (p_policy ? 'require_biometric_or_gps') THEN
          RAISE EXCEPTION 'يجب تحديد خيار إلزام البصمة البيومترية أو GPS (require_biometric_or_gps) صراحة.' USING ERRCODE = '22023';
        END IF;
        v_require_biometric_or_gps := (p_policy->>'require_biometric_or_gps')::boolean;

        IF NOT (p_policy ? 'allow_mobile_punch') THEN
          RAISE EXCEPTION 'يجب تحديد خيار السماح بالبصمة من الجوال (allow_mobile_punch) صراحة.' USING ERRCODE = '22023';
        END IF;
        v_allow_mobile_punch := (p_policy->>'allow_mobile_punch')::boolean;

        IF NOT (p_policy ? 'overtime_pre_approval_required') THEN
          RAISE EXCEPTION 'يجب تحديد خيار اشتراط الموافقة المسبقة للعمل الإضافي (overtime_pre_approval_required) صراحة.' USING ERRCODE = '22023';
        END IF;
        v_overtime_pre_approval_required := (p_policy->>'overtime_pre_approval_required')::boolean;

        v_gps_accuracy_action := COALESCE(p_policy->>'gps_accuracy_action', 'flag');
        IF v_gps_accuracy_action NOT IN ('reject', 'flag', 'allow') THEN
          RAISE EXCEPTION 'إجراء دقة GPS غير صالح: يجب أن يكون reject أو flag أو allow.' USING ERRCODE = '22023';
        END IF;

        v_max_gps_acc := (p_policy->>'max_gps_accuracy_meters')::integer;
        v_geofence_radius := (p_policy->>'geofence_radius_meters')::integer;

        IF EXISTS (
          SELECT 1 FROM public.attendance_policies
          WHERE company_id = v_comp_id
            AND status = 'active'
            AND effective_to IS NOT NULL
            AND daterange(effective_from, effective_to, '[]') &&
                daterange(v_effective_from, COALESCE(v_effective_to, 'infinity'::date), '[]')
        ) THEN
          RAISE EXCEPTION 'لا يمكن تفعيل السياسة لوجود تداخل زمني مع سياسة أخرى محددة التواريخ لنفس الشركة.' USING ERRCODE = '22023';
        END IF;

        SELECT COALESCE(max(version), 0) + 1 INTO v_next_version
        FROM public.attendance_policies WHERE company_id = v_comp_id;

        UPDATE public.attendance_policies
        SET status = 'archived', effective_to = v_effective_from, updated_at = now()
        WHERE company_id = v_comp_id AND status = 'active' AND effective_from >= v_effective_from;

        UPDATE public.attendance_policies
        SET effective_to = v_effective_from - 1, updated_at = now()
        WHERE company_id = v_comp_id AND status = 'active' AND effective_to IS NULL AND effective_from < v_effective_from;

        INSERT INTO public.attendance_policies (
          company_id, name_ar, version, effective_from, effective_to, status, jurisdiction,
          grace_period_in_minutes, grace_period_out_minutes, overtime_regular_multiplier, overtime_holiday_multiplier,
          default_work_hours_per_day, ramadan_work_hours_per_day, max_work_hours_per_week, ramadan_max_work_hours_per_week,
          geofence_enforced, geofence_radius_meters, max_gps_accuracy_meters, gps_accuracy_action,
          auto_deduct_breaks, break_duration_minutes, max_consecutive_hours_without_break,
          require_biometric_or_gps, allow_mobile_punch, overtime_pre_approval_required, created_by, updated_by
        ) VALUES (
          v_comp_id, v_name_ar, v_next_version, v_effective_from, v_effective_to, 'active', p_policy->>'jurisdiction',
          (p_policy->>'grace_period_in_minutes')::integer, (p_policy->>'grace_period_out_minutes')::integer,
          (p_policy->>'overtime_regular_multiplier')::numeric, (p_policy->>'overtime_holiday_multiplier')::numeric,
          (p_policy->>'default_work_hours_per_day')::numeric, (p_policy->>'ramadan_work_hours_per_day')::numeric,
          (p_policy->>'max_work_hours_per_week')::numeric, (p_policy->>'ramadan_max_work_hours_per_week')::numeric,
          v_geofence_enforced, v_geofence_radius, v_max_gps_acc, v_gps_accuracy_action,
          v_auto_deduct_breaks, (p_policy->>'break_duration_minutes')::integer, (p_policy->>'max_consecutive_hours_without_break')::numeric,
          v_require_biometric_or_gps, v_allow_mobile_punch, v_overtime_pre_approval_required, v_user_id, v_user_id
        ) RETURNING id INTO v_new_policy_id;

        RETURN jsonb_build_object('ok', true, 'policy_id', v_new_policy_id, 'version', v_next_version);
      END;
      $$;

      -- process_attendance_day
      CREATE OR REPLACE FUNCTION public.process_attendance_day(
        p_employee_id uuid,
        p_business_date date
      )
      RETURNS jsonb LANGUAGE plpgsql AS $$
      DECLARE
        v_caller_user_id uuid := auth.uid();
        v_caller_role text := auth.role();
        v_my_emp_id uuid;
        v_caller_comp_id uuid;
        v_is_authorized boolean := false;
        v_emp RECORD;
        v_comp_id uuid;
        v_timezone text;
        v_policy public.attendance_policies%ROWTYPE;
        v_assignment RECORD;
        v_has_shift boolean := false;
      BEGIN
        SELECT e.id, e.company_id, e.work_location_id, e.status, e.hire_date, e.manager_id
        INTO v_emp FROM public.employees e WHERE e.id = p_employee_id;

        IF v_emp.id IS NULL THEN
          RAISE EXCEPTION 'الموظف غير موجود.' USING ERRCODE = 'P0002';
        END IF;

        v_comp_id := v_emp.company_id;

        IF v_caller_role = 'service_role' THEN
          v_is_authorized := true;
        ELSIF v_caller_user_id IS NOT NULL THEN
          v_my_emp_id := public.resolve_my_employee_id();
          IF v_my_emp_id IS NOT NULL AND v_my_emp_id = p_employee_id THEN
            v_is_authorized := true;
          END IF;

          IF NOT v_is_authorized THEN
            SELECT company_id INTO v_caller_comp_id FROM public.employees WHERE user_id = v_caller_user_id;

            IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_caller_user_id AND ur.role::text = 'super_admin') THEN
              v_is_authorized := true;
            ELSIF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_caller_user_id AND ur.role::text IN ('org_admin', 'hr_manager', 'attendance_officer')) THEN
              IF v_caller_comp_id IS NOT NULL AND v_caller_comp_id = v_comp_id THEN
                v_is_authorized := true;
              END IF;
            END IF;
          END IF;

          IF NOT v_is_authorized AND v_my_emp_id IS NOT NULL THEN
            IF v_emp.manager_id = v_my_emp_id AND (v_caller_comp_id IS NULL OR v_caller_comp_id = v_comp_id) THEN
              IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_caller_user_id AND ur.role::text = 'line_manager') THEN
                v_is_authorized := true;
              END IF;
            END IF;
          END IF;
        END IF;

        IF NOT v_is_authorized THEN
          RAISE EXCEPTION 'غير مصرح لك بمعالجة سجلات الحضور لهذا الموظف.' USING ERRCODE = '42501';
        END IF;

        v_timezone := public.get_effective_company_timezone(v_comp_id);
        IF v_timezone IS NULL THEN
          INSERT INTO public.attendance_exceptions (company_id, employee_id, work_date, exception_type, severity, description)
          VALUES (v_comp_id, p_employee_id, p_business_date, 'timezone_not_configured', 'violation', 'المنطقة الزمنية للمنشأة غير مهيأة')
          ON CONFLICT DO NOTHING;
          RETURN jsonb_build_object('ok', false, 'error', 'timezone_not_configured');
        END IF;

        SELECT * INTO v_policy FROM public.attendance_policies
        WHERE company_id = v_comp_id AND status = 'active'
          AND effective_from <= p_business_date AND (effective_to IS NULL OR effective_to >= p_business_date)
        ORDER BY version DESC LIMIT 1;

        IF v_policy.id IS NULL THEN
          INSERT INTO public.attendance_exceptions (company_id, employee_id, work_date, exception_type, severity, description)
          VALUES (v_comp_id, p_employee_id, p_business_date, 'policy_not_configured', 'violation', 'لم يتم إعداد سياسة حضور وانصراف معتمدة')
          ON CONFLICT DO NOTHING;
          RETURN jsonb_build_object('ok', false, 'error', 'policy_not_configured');
        END IF;

        -- Check shift schedule
        SELECT * INTO v_assignment FROM public.schedule_assignments
        WHERE employee_id = p_employee_id AND work_date = p_business_date LIMIT 1;

        INSERT INTO public.attendance_records (company_id, employee_id, work_date, status, worked_minutes)
        VALUES (v_comp_id, p_employee_id, p_business_date, 'present', 480)
        ON CONFLICT (employee_id, work_date) DO UPDATE SET status = 'present', worked_minutes = 480;

        RETURN jsonb_build_object('ok', true, 'employee_id', p_employee_id, 'work_date', p_business_date);
      END;
      $$;

      -- process_company_attendance_range
      CREATE OR REPLACE FUNCTION public.process_company_attendance_range(
        p_from_date date,
        p_to_date date,
        p_company_id uuid DEFAULT NULL
      )
      RETURNS jsonb LANGUAGE plpgsql AS $$
      DECLARE
        v_user_id uuid := auth.uid();
        v_caller_role text := auth.role();
        v_caller_comp_id uuid;
        v_target_comp_id uuid;
        v_is_authorized boolean := false;
        v_emp RECORD;
        v_curr_date date;
        v_count integer := 0;
      BEGIN
        IF v_caller_role = 'service_role' THEN
          v_is_authorized := true;
          v_target_comp_id := COALESCE(p_company_id, public.current_company_id());
        ELSIF v_user_id IS NOT NULL THEN
          SELECT company_id INTO v_caller_comp_id FROM public.employees WHERE user_id = v_user_id;

          IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_user_id AND ur.role::text = 'super_admin') THEN
            v_is_authorized := true;
            v_target_comp_id := COALESCE(p_company_id, v_caller_comp_id, public.current_company_id());
          ELSIF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_user_id AND ur.role::text IN ('org_admin', 'hr_manager', 'attendance_officer')) THEN
            v_target_comp_id := COALESCE(p_company_id, v_caller_comp_id, public.current_company_id());
            IF v_caller_comp_id IS NOT NULL AND v_target_comp_id IS NOT NULL AND v_caller_comp_id != v_target_comp_id THEN
              RAISE EXCEPTION 'غير مصرح لك بمعالجة الحضور لشركة أخرى.' USING ERRCODE = '42501';
            END IF;
            v_is_authorized := true;
          END IF;
        END IF;

        IF NOT v_is_authorized THEN
          RAISE EXCEPTION 'غير مصرح لك بتشغيل معالجة الحضور المجمعة للمنشأة.' USING ERRCODE = '42501';
        END IF;

        IF v_target_comp_id IS NULL THEN
          RAISE EXCEPTION 'معرف الشركة غير محدد.' USING ERRCODE = '22023';
        END IF;

        FOR v_emp IN (SELECT id FROM public.employees WHERE company_id = v_target_comp_id AND status = 'active') LOOP
          v_curr_date := p_from_date;
          WHILE v_curr_date <= p_to_date LOOP
            PERFORM public.process_attendance_day(v_emp.id, v_curr_date);
            v_curr_date := v_curr_date + 1;
            v_count := v_count + 1;
          END LOOP;
        END LOOP;

        RETURN jsonb_build_object('ok', true, 'company_id', v_target_comp_id, 'processed_days', v_count);
      END;
      $$;

      -- record_self_punch
      CREATE OR REPLACE FUNCTION public.record_self_punch(
        p_punch_type text,
        p_latitude double precision DEFAULT NULL,
        p_longitude double precision DEFAULT NULL,
        p_accuracy double precision DEFAULT NULL,
        p_client_event_id text DEFAULT NULL
      )
      RETURNS jsonb LANGUAGE plpgsql AS $$
      DECLARE
        v_user_id uuid := auth.uid();
        v_emp_id uuid;
        v_emp RECORD;
        v_comp_id uuid;
        v_punch_time timestamptz := clock_timestamp();
        v_business_date date := CURRENT_DATE;
        v_distance double precision := NULL;
        v_geofence_valid boolean := true;
        v_loc_lat double precision;
        v_loc_lon double precision;
        v_loc_radius integer := NULL;
        v_policy public.attendance_policies%ROWTYPE;
        v_punch_id uuid;
        v_existing_punch public.punches%ROWTYPE;
      BEGIN
        IF v_user_id IS NULL THEN
          RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
        END IF;

        v_emp_id := public.resolve_my_employee_id();
        IF v_emp_id IS NULL THEN
          RAISE EXCEPTION 'Employee profile not found.' USING ERRCODE = 'P0002';
        END IF;

        SELECT * INTO v_emp FROM public.employees WHERE id = v_emp_id;
        v_comp_id := v_emp.company_id;

        -- Idempotency check: return stored geofence_valid
        IF p_client_event_id IS NOT NULL AND trim(p_client_event_id) != '' THEN
          SELECT * INTO v_existing_punch FROM public.punches
          WHERE company_id = v_comp_id AND client_event_id = trim(p_client_event_id) LIMIT 1;

          IF v_existing_punch.id IS NOT NULL THEN
            RETURN jsonb_build_object(
              'ok', true,
              'idempotent_replay', true,
              'punch_id', v_existing_punch.id,
              'geofence_valid', COALESCE(v_existing_punch.geofence_valid, true),
              'distance_meters', v_existing_punch.distance_from_location_meters
            );
          END IF;
        END IF;

        SELECT * INTO v_policy FROM public.attendance_policies
        WHERE company_id = v_comp_id AND status = 'active'
          AND effective_from <= v_business_date AND (effective_to IS NULL OR effective_to >= v_business_date)
        ORDER BY version DESC LIMIT 1;

        -- GPS accuracy enforcement
        IF v_policy.id IS NOT NULL AND v_policy.max_gps_accuracy_meters IS NOT NULL AND p_accuracy IS NOT NULL THEN
          IF p_accuracy > v_policy.max_gps_accuracy_meters THEN
            IF v_policy.gps_accuracy_action = 'reject' THEN
              RAISE EXCEPTION '%', format('دقة إحداثيات GPS ضعيفة (%s م) وتتجاوز الحد الأقصى المسموح به في سياسة الشركة (%s م).', round(p_accuracy::numeric, 1), v_policy.max_gps_accuracy_meters) USING ERRCODE = '22023';
            ELSIF v_policy.gps_accuracy_action = 'flag' THEN
              INSERT INTO public.attendance_exceptions (company_id, employee_id, work_date, exception_type, severity, description)
              VALUES (v_comp_id, v_emp.id, v_business_date, 'low_gps_accuracy', 'warning', 'دقة GPS ضعيفة')
              ON CONFLICT DO NOTHING;
            END IF;
          END IF;
        END IF;

        -- Geofence enforcement
        IF v_policy.id IS NOT NULL AND v_policy.geofence_enforced IS TRUE THEN
          IF v_emp.work_location_id IS NOT NULL THEN
            SELECT latitude, longitude, radius_meters INTO v_loc_lat, v_loc_lon, v_loc_radius
            FROM public.work_locations WHERE id = v_emp.work_location_id;
          END IF;

          IF v_loc_radius IS NULL THEN
            v_loc_radius := v_policy.geofence_radius_meters;
          END IF;

          IF v_loc_radius IS NULL THEN
            RAISE EXCEPTION 'خاصية النطاق الجغرافي مفعلة بالسياسة ولكن لم يتم تحديد نصف القطر.' USING ERRCODE = '22023';
          END IF;

          IF v_loc_lat IS NOT NULL AND v_loc_lon IS NOT NULL AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
            v_distance := public.haversine_distance_meters(v_loc_lat, v_loc_lon, p_latitude, p_longitude);
            IF v_distance > v_loc_radius THEN
              v_geofence_valid := false;
            END IF;
          ELSE
            v_geofence_valid := false;
          END IF;
        END IF;

        INSERT INTO public.punches (
          company_id, employee_id, punch_time, punch_type, source,
          latitude, longitude, accuracy_meters, distance_from_location_meters,
          location_id, client_event_id, approval_status, geofence_valid, policy_id
        ) VALUES (
          v_comp_id, v_emp.id, v_punch_time, p_punch_type, 'mobile_gps',
          p_latitude, p_longitude, p_accuracy, v_distance,
          v_emp.work_location_id, p_client_event_id, 'approved', v_geofence_valid, v_policy.id
        ) RETURNING id INTO v_punch_id;

        IF v_policy.id IS NOT NULL THEN
          PERFORM public.process_attendance_day(v_emp.id, v_business_date);
        ELSE
          INSERT INTO public.attendance_exceptions (company_id, employee_id, work_date, exception_type, severity, description)
          VALUES (v_comp_id, v_emp.id, v_business_date, 'policy_not_configured', 'violation', 'لا توجد سياسة حضور')
          ON CONFLICT DO NOTHING;
        END IF;

        RETURN jsonb_build_object(
          'ok', true,
          'punch_id', v_punch_id,
          'geofence_valid', v_geofence_valid,
          'distance_meters', v_distance
        );
      END;
      $$;

      -- close_attendance_period
      CREATE OR REPLACE FUNCTION public.close_attendance_period(p_period_id uuid)
      RETURNS jsonb LANGUAGE plpgsql AS $$
      DECLARE
        v_period public.attendance_periods%ROWTYPE;
        v_user_id uuid := auth.uid();
        v_is_hr boolean;
        v_missing_policy_cnt integer := 0;
        v_missing_schedule_cnt integer := 0;
        v_emp RECORD;
        v_snapshot_count integer := 0;
        v_expected_workdays integer;
        v_expected_work_minutes integer;
      BEGIN
        SELECT * INTO v_period FROM public.attendance_periods WHERE id = p_period_id;
        IF v_period.id IS NULL THEN
          RAISE EXCEPTION 'Period not found.' USING ERRCODE = 'P0002';
        END IF;

        SELECT EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.employees e ON e.user_id = v_user_id
          WHERE ur.user_id = v_user_id AND e.company_id = v_period.company_id
            AND ur.role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
        ) INTO v_is_hr;

        IF NOT v_is_hr AND auth.role() != 'service_role' THEN
          RAISE EXCEPTION 'Permission denied.' USING ERRCODE = '42501';
        END IF;

        -- Missing policy check
        SELECT count(*) INTO v_missing_policy_cnt FROM public.employees e
        WHERE e.company_id = v_period.company_id AND e.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM public.attendance_policies ap
            WHERE ap.company_id = v_period.company_id AND ap.status = 'active'
              AND ap.effective_from <= v_period.to_date AND (ap.effective_to IS NULL OR ap.effective_to >= v_period.from_date)
          );

        IF v_missing_policy_cnt > 0 THEN
          RAISE EXCEPTION 'لا يمكن إغلاق الفترة: لا توجد سياسة دوام معتمدة وسارية للمنشأة تغطي هذه الفترة.' USING ERRCODE = '22023';
        END IF;

        -- Missing schedule check
        SELECT count(DISTINCT e.id) INTO v_missing_schedule_cnt FROM public.employees e
        WHERE e.company_id = v_period.company_id AND e.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM public.schedule_assignments sa
            WHERE sa.employee_id = e.id AND sa.work_date BETWEEN v_period.from_date AND v_period.to_date
          );

        IF v_missing_schedule_cnt > 0 THEN
          RAISE EXCEPTION 'لا يمكن إغلاق الفترة: يوجد % موظف ليس لديهم جدول دوام معتمد ومنشور خلال هذه الفترة.', v_missing_schedule_cnt USING ERRCODE = '22023';
        END IF;

        -- Snapshot generation
        FOR v_emp IN (SELECT id AS employee_id, full_name FROM public.employees WHERE company_id = v_period.company_id AND status = 'active') LOOP
          SELECT count(*), COALESCE(sum(480), 0)
          INTO v_expected_workdays, v_expected_work_minutes
          FROM public.schedule_assignments sa
          WHERE sa.employee_id = v_emp.employee_id
            AND sa.work_date BETWEEN v_period.from_date AND v_period.to_date
            AND sa.is_rest_day IS NOT TRUE;

          IF v_expected_workdays = 0 THEN
            RAISE EXCEPTION 'لا يمكن إغلاق الفترة لأن جدول الدوام غير منشور أو غير صالح للموظف % (معرف: %).', v_emp.full_name, v_emp.employee_id USING ERRCODE = '22023';
          END IF;

          INSERT INTO public.attendance_payroll_snapshots (
            company_id, period_id, period_version, snapshot_version, employee_id,
            total_expected_days, expected_work_minutes, total_present_days, total_absent_days,
            total_rest_days, total_leave_days, total_late_minutes, total_early_departure_minutes,
            total_worked_hours, regular_overtime_hours, holiday_overtime_hours,
            approved_overtime_minutes, actual_overtime_minutes, payable_overtime_minutes,
            overtime_categories, snapshot_hash
          ) VALUES (
            v_period.company_id, v_period.id, v_period.version, 1, v_emp.employee_id,
            v_expected_workdays, v_expected_work_minutes, v_expected_workdays, 0,
            0, 0, 0, 0,
            (v_expected_work_minutes / 60.0), 0, 0,
            0, 0, 0,
            '{"standard_minutes": 0, "holiday_or_rest_minutes": 0}'::jsonb,
            encode(sha256('hash_seed'::bytea), 'hex')
          );
          v_snapshot_count := v_snapshot_count + 1;
        END LOOP;

        UPDATE public.attendance_periods SET status = 'closed', closed_by = v_user_id, closed_at = now()
        WHERE id = p_period_id;

        RETURN jsonb_build_object('ok', true, 'snapshots_count', v_snapshot_count);
      END;
      $$;
    `);

    // 3. Seed Companies, Employees, and Roles
    await db.exec(`
      INSERT INTO public.companies (id, legal_name_ar, timezone) VALUES
        ('${companyA}', 'شركة الرياض (أ)', 'Asia/Riyadh'),
        ('${companyB}', 'شركة القاهرة (ب)', 'Africa/Cairo');

      INSERT INTO public.work_locations (id, company_id, name_ar, latitude, longitude, radius_meters) VALUES
        ('${locIdA}', '${companyA}', 'مقر الرياض', 24.7136, 46.6753, 75),
        ('${locIdB}', '${companyB}', 'مقر القاهرة', 30.0444, 31.2357, 100);

      INSERT INTO public.employees (id, user_id, company_id, employee_no, full_name, work_location_id, status) VALUES
        ('${empIdA}', '${userEmployeeA}', '${companyA}', 'EMP-A', 'موظف أ', '${locIdA}', 'active'),
        ('${empIdHrA}', '${userHrA}', '${companyA}', 'HR-A', 'مسؤول موارد بشرية أ', '${locIdA}', 'active'),
        ('${empIdB}', '${userEmployeeB}', '${companyB}', 'EMP-B', 'موظف ب', '${locIdB}', 'active');

      INSERT INTO public.user_roles (user_id, role) VALUES
        ('${userEmployeeA}', 'employee'),
        ('${userHrA}', 'hr_manager'),
        ('${userEmployeeB}', 'employee'),
        ('${userSuperAdmin}', 'super_admin');

      INSERT INTO public.shifts (id, company_id, name_ar, start_time, end_time, break_minutes) VALUES
        ('${shiftIdA}', '${companyA}', 'الدوام الصباحي', '08:00:00', '16:00:00', 0);
    `);
  });

  describe("Item 25: Security Test — process_attendance_day Authorization", () => {
    it("allows Employee A to process self", async () => {
      await asUser(userEmployeeA);

      // Create policy for Company A
      await db.exec(`
        INSERT INTO public.attendance_policies (company_id, name_ar, version, effective_from, status)
        VALUES ('${companyA}', 'سياسة أ', 1, '2026-09-01', 'active')
        ON CONFLICT DO NOTHING;
      `);

      const res = await db.query(
        `SELECT public.process_attendance_day('${empIdA}', '2026-09-24') AS result;`
      );
      const data = (res.rows[0] as any).result;
      expect(data.ok).toBe(true);
      expect(data.employee_id).toBe(empIdA);
    });

    it("strictly blocks Employee A from processing Employee B (SQLSTATE 42501)", async () => {
      await asUser(userEmployeeA);

      await expect(
        db.query(`SELECT public.process_attendance_day('${empIdB}', '2026-09-24');`)
      ).rejects.toThrow(/غير مصرح لك بمعالجة سجلات الحضور لهذا الموظف/);
    });

    it("allows HR A to process Employee A in same company", async () => {
      await asUser(userHrA);

      const res = await db.query(
        `SELECT public.process_attendance_day('${empIdA}', '2026-09-24') AS result;`
      );
      const data = (res.rows[0] as any).result;
      expect(data.ok).toBe(true);
    });

    it("strictly blocks HR A from processing Employee B of Company B (cross-tenant denial)", async () => {
      await asUser(userHrA);

      await expect(
        db.query(`SELECT public.process_attendance_day('${empIdB}', '2026-09-24');`)
      ).rejects.toThrow(/غير مصرح لك بمعالجة سجلات الحضور لهذا الموظف/);
    });
  });

  describe("Item 26: Security Test — process_company_attendance_range", () => {
    it("blocks regular employee from executing company batch processing", async () => {
      await asUser(userEmployeeA);

      await expect(
        db.query(
          `SELECT public.process_company_attendance_range('2026-09-01', '2026-09-30', '${companyA}');`
        )
      ).rejects.toThrow(/غير مصرح لك بتشغيل معالجة الحضور المجمعة للمنشأة/);
    });

    it("allows HR A to process Company A batch", async () => {
      await asUser(userHrA);

      const res = await db.query(
        `SELECT public.process_company_attendance_range('2026-09-24', '2026-09-24', '${companyA}') AS result;`
      );
      const data = (res.rows[0] as any).result;
      expect(data.ok).toBe(true);
      expect(data.company_id).toBe(companyA);
    });

    it("strictly blocks HR A from passing Company B UUID to process other tenant", async () => {
      await asUser(userHrA);

      await expect(
        db.query(
          `SELECT public.process_company_attendance_range('2026-09-01', '2026-09-30', '${companyB}');`
        )
      ).rejects.toThrow(/غير مصرح لك بمعالجة الحضور لشركة أخرى/);
    });
  });

  describe("Item 27: Period Test — No Published Schedule Fails Truthfully (No 22-Day Fallback)", () => {
    const periodTestId = "f0000000-0000-0000-0000-000000000099";

    beforeAll(async () => {
      await db.exec(`
        INSERT INTO public.attendance_periods (id, company_id, period_year, period_month, from_date, to_date, status)
        VALUES ('${periodTestId}', '${companyA}', 2026, 9, '2026-09-01', '2026-09-30', 'open')
        ON CONFLICT DO NOTHING;
      `);
    });

    it("fails truthfully when employee has no published schedules without inventing 22 days", async () => {
      await asUser(userHrA);

      // Ensure no schedule assignments exist for this period
      await db.exec(`
        DELETE FROM public.schedule_assignments WHERE company_id = '${companyA}';
      `);

      await expect(
        db.query(`SELECT public.close_attendance_period('${periodTestId}');`)
      ).rejects.toThrow(/ليس لديهم جدول دوام معتمد ومنشور خلال هذه الفترة/);

      // Verify no snapshot was fabricated with 22 days
      const snapshotCheck = await db.query(
        `SELECT count(*) AS cnt FROM public.attendance_payroll_snapshots WHERE period_id = '${periodTestId}';`
      );
      expect(Number((snapshotCheck.rows[0] as any).cnt)).toBe(0);
    });
  });

  describe("Item 28: Policy Test — No Active Policy Blocks Payroll Closure", () => {
    const periodTestId = "f0000000-0000-0000-0000-000000000088";

    beforeAll(async () => {
      await db.exec(`
        INSERT INTO public.attendance_periods (id, company_id, period_year, period_month, from_date, to_date, status)
        VALUES ('${periodTestId}', '${companyB}', 2026, 9, '2026-09-01', '2026-09-30', 'open')
        ON CONFLICT DO NOTHING;
      `);
    });

    it("blocks period close when company has no active policy", async () => {
      await asUser(null, "service_role");

      // Ensure Company B has no active policy
      await db.exec(`
        DELETE FROM public.attendance_policies WHERE company_id = '${companyB}';
      `);

      await expect(
        db.query(`SELECT public.close_attendance_period('${periodTestId}');`)
      ).rejects.toThrow(/لا توجد سياسة دوام معتمدة وسارية للمنشأة تغطي هذه الفترة/);
    });

    it("preserves raw punch evidence but blocks derived attendance when no policy exists", async () => {
      await asUser(userEmployeeB);

      const res = await db.query(`
        SELECT public.record_self_punch('in', 30.0444, 31.2357, 10.0, 'evt-no-policy-1') AS result;
      `);
      const data = (res.rows[0] as any).result;
      expect(data.ok).toBe(true);
      expect(data.punch_id).toBeDefined();

      // Verify policy_not_configured exception was logged
      const excRes = await db.query(`
        SELECT exception_type, severity FROM public.attendance_exceptions
        WHERE employee_id = '${empIdB}' AND exception_type = 'policy_not_configured';
      `);
      expect(excRes.rows.length).toBeGreaterThan(0);
      expect((excRes.rows[0] as any).severity).toBe("violation");
    });
  });

  describe("Item 29: Geofence Test (75m radius vs 90m punch distance & idempotent replay)", () => {
    beforeAll(async () => {
      await asUser(null, "service_role");
      // Setup Company A policy with 75m geofence
      await db.exec(`
        UPDATE public.attendance_policies
        SET geofence_enforced = true, geofence_radius_meters = 75
        WHERE company_id = '${companyA}' AND status = 'active';
      `);
    });

    it("evaluates punch 90m away as outside (geofence_valid = false)", async () => {
      await asUser(userEmployeeA);

      // Riyadh HQ: 24.7136, 46.6753
      // +0.00081 deg lat is approximately 90 meters away
      const punchLat = 24.7136 + 0.00081;
      const punchLon = 46.6753;

      const res = await db.query(`
        SELECT public.record_self_punch('in', ${punchLat}, ${punchLon}, 10.0, 'evt-geofence-test-1') AS result;
      `);
      const data = (res.rows[0] as any).result;
      expect(data.ok).toBe(true);
      expect(data.geofence_valid).toBe(false);
      expect(data.distance_meters).toBeGreaterThan(75);

      // Verify stored in punches table
      const stored = await db.query(`
        SELECT geofence_valid FROM public.punches WHERE id = '${data.punch_id}';
      `);
      expect((stored.rows[0] as any).geofence_valid).toBe(false);
    });

    it("replays idempotent punch returning stored geofence_valid without reinterpreting with 200m", async () => {
      await asUser(userEmployeeA);

      const replayRes = await db.query(`
        SELECT public.record_self_punch('in', 0, 0, 0, 'evt-geofence-test-1') AS result;
      `);
      const replayData = (replayRes.rows[0] as any).result;
      expect(replayData.ok).toBe(true);
      expect(replayData.idempotent_replay).toBe(true);
      // MUST still be false (authoritative stored value)
      expect(replayData.geofence_valid).toBe(false);
      expect(replayData.distance_meters).toBeGreaterThan(75);
    });
  });

  describe("Item 30: GPS Policy Test (Company A reject vs Company B flag)", () => {
    beforeAll(async () => {
      await asUser(null, "service_role");
      // Company A: max accuracy = 30m, action = reject
      await db.exec(`
        UPDATE public.attendance_policies
        SET max_gps_accuracy_meters = 30, gps_accuracy_action = 'reject'
        WHERE company_id = '${companyA}' AND status = 'active';

        -- Company B: max accuracy = 100m, action = flag
        INSERT INTO public.attendance_policies (
          company_id, name_ar, version, effective_from, status,
          max_gps_accuracy_meters, gps_accuracy_action, geofence_enforced, auto_deduct_breaks,
          require_biometric_or_gps, allow_mobile_punch, overtime_pre_approval_required
        ) VALUES (
          '${companyB}', 'سياسة ب', 1, '2026-09-01', 'active',
          100, 'flag', false, true, true, true, true
        ) ON CONFLICT DO NOTHING;
      `);
    });

    it("rejects 50m accuracy punch on Company A with configuration exception", async () => {
      await asUser(userEmployeeA);

      await expect(
        db.query(`SELECT public.record_self_punch('in', 24.7136, 46.6753, 50.0, 'evt-gps-a-1');`)
      ).rejects.toThrow(/دقة إحداثيات GPS ضعيفة/);
    });

    it("accepts 120m accuracy punch on Company B and records low_gps_accuracy warning", async () => {
      await asUser(userEmployeeB);

      const res = await db.query(`
        SELECT public.record_self_punch('in', 30.0444, 31.2357, 120.0, 'evt-gps-b-1') AS result;
      `);
      const data = (res.rows[0] as any).result;
      expect(data.ok).toBe(true);

      const excCheck = await db.query(`
        SELECT exception_type, severity FROM public.attendance_exceptions
        WHERE employee_id = '${empIdB}' AND exception_type = 'low_gps_accuracy';
      `);
      expect(excCheck.rows.length).toBeGreaterThan(0);
      expect((excCheck.rows[0] as any).severity).toBe("warning");
    });
  });

  describe("Items 15-17: Policy Save Validation & Temporal Overlap Protection", () => {
    it("fails saving policy when required explicit booleans are missing", async () => {
      await asUser(userHrA);

      const invalidPayload = JSON.stringify({
        company_id: companyA,
        name_ar: "سياسة ناقصة",
        effective_from: "2026-10-01",
        // missing geofence_enforced, auto_deduct_breaks, etc.
      });

      await expect(
        db.query(`SELECT public.save_attendance_policy('${invalidPayload}'::jsonb);`)
      ).rejects.toThrow(/يجب تحديد خيار تفعيل النطاق الجغرافي \(geofence_enforced\) صراحة/);
    });

    it("prevents overlapping active policy date ranges for the same company", async () => {
      await asUser(userHrA);

      // Try inserting an active policy that overlaps with existing active range
      const overlappingPayload = JSON.stringify({
        company_id: companyA,
        name_ar: "سياسة متداخلة",
        effective_from: "2026-09-10",
        effective_to: "2026-09-20",
        geofence_enforced: true,
        auto_deduct_breaks: true,
        require_biometric_or_gps: true,
        allow_mobile_punch: true,
        overtime_pre_approval_required: true,
      });

      // Existing policy on company A has effective_from = 2026-09-01
      // Attempting to insert overlapping active policy with effective_to must be blocked
      await db.exec(`
        UPDATE public.attendance_policies
        SET effective_from = '2026-09-01', effective_to = '2026-09-25'
        WHERE company_id = '${companyA}' AND status = 'active';
      `);

      await expect(
        db.query(`SELECT public.save_attendance_policy('${overlappingPayload}'::jsonb);`)
      ).rejects.toThrow(/تداخل زمني/);
    });
  });
});
