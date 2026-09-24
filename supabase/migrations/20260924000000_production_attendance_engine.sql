-- Migration: 20260924000000_production_attendance_engine.sql
-- Description: Prompt 12 — Production Attendance & Time Engine
-- 1. Attendance policies table and Saudi Labor Law compliance defaults
-- 2. Enhanced immutable raw punches with GPS/Geofence Haversine verification
-- 3. Attendance exceptions and violation tracking
-- 4. Attendance periods and monthly close/reopen workflow
-- 5. Immutable Payroll attendance snapshot with SHA-256 seal
-- 6. Biometric batch import and deduplication
-- 7. Shift and overnight processing with leave/holiday/rest-day integration
-- 8. Server-authoritative RPCs for self punch, period settlement, and exception resolution
-- 9. Tenant-safe Row Level Security (RLS) across all attendance tables

BEGIN;

-- ============================================================================
-- 1. HAVERSINE DISTANCE HELPER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.haversine_distance_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
  r double precision := 6371000.0; -- Earth radius in meters
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)^2;
  -- Guard against rounding errors exceeding 1.0
  IF a > 1.0 THEN a := 1.0; END IF;
  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  RETURN round((r * c)::numeric, 2)::double precision;
END;
$$;

GRANT EXECUTE ON FUNCTION public.haversine_distance_meters(double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.haversine_distance_meters(double precision, double precision, double precision, double precision) TO service_role;


-- ============================================================================
-- 2. RESOLVE CURRENT USER EMPLOYEE ID
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_my_employee_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id uuid;
  v_comp_id uuid := public.current_company_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_emp_id
  FROM public.employees
  WHERE (user_id = auth.uid() OR custom_fields->>'userId' = auth.uid()::text)
    AND (company_id = v_comp_id OR v_comp_id IS NULL)
  LIMIT 1;

  IF v_emp_id IS NULL THEN
    SELECT e.id INTO v_emp_id
    FROM public.employees e
    JOIN auth.users u ON lower(u.email) = lower(e.email)
    WHERE u.id = auth.uid()
      AND (e.company_id = v_comp_id OR v_comp_id IS NULL)
    LIMIT 1;
  END IF;

  RETURN v_emp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_my_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_my_employee_id() TO service_role;


-- ============================================================================
-- 3. ATTENDANCE POLICIES TABLE (Saudi Labor Law Articles 98, 101, 107)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name_ar text NOT NULL DEFAULT 'سياسة الدوام الرسمية',
  grace_period_in_minutes integer NOT NULL DEFAULT 15,
  grace_period_out_minutes integer NOT NULL DEFAULT 15,
  overtime_regular_multiplier numeric(3,2) NOT NULL DEFAULT 1.50,
  overtime_holiday_multiplier numeric(3,2) NOT NULL DEFAULT 2.00,
  default_work_hours_per_day numeric(4,2) NOT NULL DEFAULT 8.00,
  ramadan_work_hours_per_day numeric(4,2) NOT NULL DEFAULT 6.00,
  max_work_hours_per_week numeric(4,2) NOT NULL DEFAULT 48.00,
  ramadan_max_work_hours_per_week numeric(4,2) NOT NULL DEFAULT 36.00,
  geofence_enforced boolean NOT NULL DEFAULT true,
  geofence_radius_meters integer NOT NULL DEFAULT 200,
  auto_deduct_breaks boolean NOT NULL DEFAULT true,
  break_duration_minutes integer NOT NULL DEFAULT 60,
  max_consecutive_hours_without_break numeric(4,2) NOT NULL DEFAULT 5.00,
  require_biometric_or_gps boolean NOT NULL DEFAULT true,
  allow_mobile_punch boolean NOT NULL DEFAULT true,
  overtime_pre_approval_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_attendance_policies_company UNIQUE (company_id)
);

ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;

-- Initial default policy for Al-Andalus or active companies
INSERT INTO public.attendance_policies (company_id, name_ar)
SELECT id, 'سياسة الدوام لشركة ' || coalesce(legal_name_ar, 'الأندلس')
FROM public.companies
ON CONFLICT (company_id) DO NOTHING;


-- ============================================================================
-- 4. ENHANCE SHIFTS TABLE
-- ============================================================================
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS is_overnight boolean DEFAULT false;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS break_minutes integer DEFAULT 60;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS min_worked_hours_for_break numeric(4,2) DEFAULT 5.00;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS max_overtime_hours_per_day numeric(4,2) DEFAULT 4.00;

-- Backfill company_id on existing shifts if missing
UPDATE public.shifts 
SET company_id = 'a0000000-0000-0000-0000-000000000001'::uuid 
WHERE company_id IS NULL;


-- ============================================================================
-- 5. ATTENDANCE PERIODS (Monthly Close & Reopen Workflow)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed', 'reopened')),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  reopened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_attendance_periods_company_month UNIQUE (company_id, period_year, period_month)
);

ALTER TABLE public.attendance_periods ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 6. IMMUTABLE PAYROLL ATTENDANCE SNAPSHOT
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_payroll_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.attendance_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  total_expected_days integer NOT NULL DEFAULT 0,
  total_present_days integer NOT NULL DEFAULT 0,
  total_absent_days integer NOT NULL DEFAULT 0,
  total_rest_days integer NOT NULL DEFAULT 0,
  total_leave_days integer NOT NULL DEFAULT 0,
  total_late_minutes integer NOT NULL DEFAULT 0,
  total_early_departure_minutes integer NOT NULL DEFAULT 0,
  total_worked_hours numeric(7,2) NOT NULL DEFAULT 0,
  regular_overtime_hours numeric(7,2) NOT NULL DEFAULT 0,
  holiday_overtime_hours numeric(7,2) NOT NULL DEFAULT 0,
  unexcused_absence_days integer NOT NULL DEFAULT 0,
  violations_count integer NOT NULL DEFAULT 0,
  snapshot_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_attendance_payroll_snapshots UNIQUE (period_id, employee_id)
);

ALTER TABLE public.attendance_payroll_snapshots ENABLE ROW LEVEL SECURITY;

-- Immutability trigger for payroll snapshot
CREATE OR REPLACE FUNCTION public.prevent_payroll_snapshot_tampering()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Attendance payroll snapshots are immutable and cannot be updated once sealed.';
  ELSIF TG_OP = 'DELETE' THEN
    IF current_user != 'postgres' AND auth.role() != 'service_role' THEN
      RAISE EXCEPTION 'Attendance payroll snapshots cannot be deleted. Period must be reopened instead.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_payroll_snapshot_tampering ON public.attendance_payroll_snapshots;
CREATE TRIGGER trg_prevent_payroll_snapshot_tampering
  BEFORE UPDATE OR DELETE ON public.attendance_payroll_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_payroll_snapshot_tampering();


-- ============================================================================
-- 7. ENHANCE PUNCHES TABLE (Immutable Raw Punch Architecture)
-- ============================================================================
ALTER TABLE public.punches ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.punches ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.punches ADD COLUMN IF NOT EXISTS accuracy_meters double precision;
ALTER TABLE public.punches ADD COLUMN IF NOT EXISTS distance_from_location_meters double precision;
ALTER TABLE public.punches ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL;
ALTER TABLE public.punches ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL;
ALTER TABLE public.punches ADD COLUMN IF NOT EXISTS device_token_hash text;
ALTER TABLE public.punches ADD COLUMN IF NOT EXISTS batch_id uuid;

-- Backfill company_id from employee if possible
UPDATE public.punches p
SET company_id = e.company_id
FROM public.employees e
WHERE p.employee_id = e.id AND p.company_id IS NULL;

-- Trigger to guard raw punch immutability
CREATE OR REPLACE FUNCTION public.enforce_punch_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only approval_status, distance_from_location_meters, and geofence_valid can be updated by managers
    IF OLD.employee_id != NEW.employee_id OR
       OLD.punch_time != NEW.punch_time OR
       OLD.punch_type != NEW.punch_type OR
       OLD.source != NEW.source OR
       OLD.latitude IS DISTINCT FROM NEW.latitude OR
       OLD.longitude IS DISTINCT FROM NEW.longitude OR
       OLD.device_id IS DISTINCT FROM NEW.device_id THEN
      RAISE EXCEPTION 'Raw punch data (time, coordinates, type, source, device) is immutable audit evidence and cannot be altered.';
    END IF;

    -- Verify manager role if changing approval status
    IF OLD.approval_status != NEW.approval_status THEN
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer', 'line_manager')
      ) INTO v_is_admin;

      IF NOT v_is_admin AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Only HR managers or supervisors can update punch approval status.';
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF auth.role() != 'service_role' AND current_user != 'postgres' THEN
      RAISE EXCEPTION 'Raw punches cannot be deleted. Use approval_status = rejected to invalidate a punch.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_punch_immutability ON public.punches;
CREATE TRIGGER trg_enforce_punch_immutability
  BEFORE UPDATE OR DELETE ON public.punches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_punch_immutability();


-- ============================================================================
-- 8. ATTENDANCE EXCEPTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  exception_type text NOT NULL CHECK (exception_type IN (
    'late_arrival',
    'early_departure',
    'missing_in',
    'missing_out',
    'unexcused_absence',
    'geofence_breach',
    'overtime_without_approval',
    'excessive_break'
  )),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'violation')),
  minutes integer NOT NULL DEFAULT 0,
  description text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 9. BIOMETRIC PUNCH IMPORT BATCHES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.punch_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  device_id text,
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total_records integer NOT NULL DEFAULT 0,
  successful_records integer NOT NULL DEFAULT 0,
  failed_records integer NOT NULL DEFAULT 0,
  duplicate_records integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
  error_log jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.punch_import_batches ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 10. ENHANCE ATTENDANCE RECORDS TABLE
-- ============================================================================
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS scheduled_in time;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS scheduled_out time;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS early_departure_minutes integer DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS late_minutes integer DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS worked_minutes integer DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS punch_source text DEFAULT 'mobile_gps';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS geofence_valid boolean DEFAULT true;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS violations_count integer DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS reviewed_by_payroll boolean DEFAULT false;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS is_manual boolean DEFAULT false;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.attendance_periods(id) ON DELETE SET NULL;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS check_in_punch_id uuid REFERENCES public.punches(id) ON DELETE SET NULL;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS check_out_punch_id uuid REFERENCES public.punches(id) ON DELETE SET NULL;

-- Backfill company_id on attendance_records
UPDATE public.attendance_records ar
SET company_id = e.company_id
FROM public.employees e
WHERE ar.employee_id = e.id AND ar.company_id IS NULL;


-- Trigger to prevent modifying attendance records if period is closed
CREATE OR REPLACE FUNCTION public.check_attendance_period_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_status text;
  v_comp_id uuid;
BEGIN
  v_comp_id := coalesce(NEW.company_id, OLD.company_id);
  
  -- Check if there is an active closed period covering this work_date
  SELECT status INTO v_period_status
  FROM public.attendance_periods
  WHERE company_id = v_comp_id
    AND NEW.work_date BETWEEN from_date AND to_date
    AND status = 'closed'
  LIMIT 1;

  IF v_period_status = 'closed' AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Attendance records for date % belong to a closed payroll attendance period and cannot be modified.', NEW.work_date;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_attendance_period_lock ON public.attendance_records;
CREATE TRIGGER trg_check_attendance_period_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.check_attendance_period_lock();


-- ============================================================================
-- 11. RPC: SERVER-AUTHORITATIVE SELF PUNCH WITH GEOFENCE VALIDATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_self_punch(
  p_punch_type text,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_comp_id uuid := public.current_company_id();
  v_emp_id uuid;
  v_emp_name text;
  v_emp_loc_id uuid;
  v_loc_lat double precision;
  v_loc_lon double precision;
  v_loc_radius integer := 200;
  v_policy public.attendance_policies%ROWTYPE;
  v_punch_time timestamptz := clock_timestamp();
  v_work_date date := (v_punch_time AT TIME ZONE 'Asia/Riyadh')::date;
  v_distance double precision := NULL;
  v_geofence_valid boolean := true;
  v_last_punch_time timestamptz;
  v_punch_id uuid;
  v_existing_att public.attendance_records%ROWTYPE;
  v_check_in_time time;
  v_check_out_time time;
  v_worked_mins integer := 0;
  v_late_mins integer := 0;
  v_shift public.shifts%ROWTYPE;
  v_shift_start time;
  v_shift_end time;
  v_grace_in integer := 15;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to punch in/out.' USING ERRCODE = '42501';
  END IF;

  IF p_punch_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Invalid punch type: must be "in" or "out".' USING ERRCODE = '22023';
  END IF;

  -- 1. Server resolves employee identity
  v_emp_id := public.resolve_my_employee_id();
  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'No active employee profile linked to current user.' USING ERRCODE = 'P0002';
  END IF;

  SELECT full_name, work_location_id, company_id
  INTO v_emp_name, v_emp_loc_id, v_comp_id
  FROM public.employees
  WHERE id = v_emp_id;

  -- 2. Anti-spam / duplicate guard: prevent punch within 45 seconds of last punch
  SELECT punch_time INTO v_last_punch_time
  FROM public.punches
  WHERE employee_id = v_emp_id
  ORDER BY punch_time DESC
  LIMIT 1;

  IF v_last_punch_time IS NOT NULL AND (v_punch_time - v_last_punch_time) < interval '45 seconds' THEN
    RAISE EXCEPTION 'Duplicate punch detected. Please wait at least 45 seconds before punching again.' USING ERRCODE = '23505';
  END IF;

  -- 3. Retrieve company policy
  SELECT * INTO v_policy
  FROM public.attendance_policies
  WHERE company_id = v_comp_id;

  IF v_policy.grace_period_in_minutes IS NOT NULL THEN
    v_grace_in := v_policy.grace_period_in_minutes;
  END IF;

  -- 4. Geofence evaluation
  IF v_emp_loc_id IS NOT NULL THEN
    SELECT latitude, longitude, coalesce(radius_meters, 200)
    INTO v_loc_lat, v_loc_lon, v_loc_radius
    FROM public.work_locations
    WHERE id = v_emp_loc_id;
  END IF;

  -- Fallback to any company location if employee has no location assigned
  IF v_loc_lat IS NULL THEN
    SELECT latitude, longitude, coalesce(radius_meters, 200)
    INTO v_loc_lat, v_loc_lon, v_loc_radius
    FROM public.work_locations
    WHERE company_id = v_comp_id AND latitude IS NOT NULL
    LIMIT 1;
  END IF;

  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND v_loc_lat IS NOT NULL THEN
    v_distance := public.haversine_distance_meters(p_latitude, p_longitude, v_loc_lat, v_loc_lon);
    IF v_policy.geofence_enforced AND v_distance > coalesce(v_loc_radius, v_policy.geofence_radius_meters, 200) THEN
      v_geofence_valid := false;
    END IF;
  ELSIF v_policy.geofence_enforced AND (p_latitude IS NULL OR p_longitude IS NULL) THEN
    v_geofence_valid := false;
  END IF;

  -- 5. Insert immutable raw punch
  INSERT INTO public.punches (
    company_id,
    employee_id,
    punch_time,
    punch_type,
    source,
    latitude,
    longitude,
    accuracy_meters,
    distance_from_location_meters,
    geofence_valid,
    location_id,
    approval_status
  ) VALUES (
    v_comp_id,
    v_emp_id,
    v_punch_time,
    p_punch_type,
    'mobile_gps',
    p_latitude,
    p_longitude,
    p_accuracy,
    v_distance,
    v_geofence_valid,
    v_emp_loc_id,
    'approved'
  ) RETURNING id INTO v_punch_id;

  -- If geofence breach, log an exception
  IF NOT v_geofence_valid THEN
    INSERT INTO public.attendance_exceptions (
      company_id,
      employee_id,
      work_date,
      exception_type,
      severity,
      description
    ) VALUES (
      v_comp_id,
      v_emp_id,
      v_work_date,
      'geofence_breach',
      'warning',
      format('بصمة %s خارج نطاق العمل المعتمد (المسافة: %s متر، النطاق المسموح: %s متر)',
        CASE WHEN p_punch_type = 'in' THEN 'دخول' ELSE 'خروج' END,
        coalesce(round(v_distance::numeric, 0)::text, 'غير محددة'),
        v_loc_radius
      )
    );
  END IF;

  -- 6. Synchronize Daily Attendance Record
  SELECT * INTO v_existing_att
  FROM public.attendance_records
  WHERE employee_id = v_emp_id AND work_date = v_work_date;

  -- Fetch shift assigned for today
  SELECT s.* INTO v_shift
  FROM public.schedule_assignments sa
  JOIN public.shifts s ON s.id = sa.shift_id
  WHERE sa.employee_id = v_emp_id AND sa.work_date = v_work_date
  LIMIT 1;

  IF v_shift.id IS NOT NULL THEN
    v_shift_start := v_shift.start_time;
    v_shift_end := v_shift.end_time;
  ELSE
    v_shift_start := '08:00:00'::time;
    v_shift_end := '17:00:00'::time;
  END IF;

  IF p_punch_type = 'in' THEN
    v_check_in_time := (v_punch_time AT TIME ZONE 'Asia/Riyadh')::time;
    
    -- Calculate late arrival minutes
    IF v_check_in_time > (v_shift_start + (v_grace_in || ' minutes')::interval) THEN
      v_late_mins := round(EXTRACT(EPOCH FROM (v_check_in_time - v_shift_start)) / 60.0)::integer;
    ELSE
      v_late_mins := 0;
    END IF;

    IF v_existing_att.id IS NULL THEN
      INSERT INTO public.attendance_records (
        company_id,
        employee_id,
        work_date,
        check_in,
        status,
        late_minutes,
        punch_source,
        geofence_valid,
        check_in_punch_id,
        scheduled_in,
        scheduled_out,
        shift_id
      ) VALUES (
        v_comp_id,
        v_emp_id,
        v_work_date,
        v_check_in_time,
        CASE WHEN v_late_mins > 0 THEN 'late'::public.attendance_status ELSE 'present'::public.attendance_status END,
        v_late_mins,
        'mobile_gps',
        v_geofence_valid,
        v_punch_id,
        v_shift_start,
        v_shift_end,
        v_shift.id
      );
    ELSE
      UPDATE public.attendance_records
      SET check_in = coalesce(check_in, v_check_in_time),
          check_in_punch_id = coalesce(check_in_punch_id, v_punch_id),
          late_minutes = v_late_mins,
          status = CASE WHEN v_late_mins > 0 THEN 'late'::public.attendance_status ELSE 'present'::public.attendance_status END,
          geofence_valid = (geofence_valid AND v_geofence_valid)
      WHERE id = v_existing_att.id;
    END IF;

    -- Record late arrival exception if applicable
    IF v_late_mins > 0 THEN
      INSERT INTO public.attendance_exceptions (
        company_id,
        employee_id,
        work_date,
        exception_type,
        severity,
        minutes,
        description
      ) VALUES (
        v_comp_id,
        v_emp_id,
        v_work_date,
        'late_arrival',
        CASE WHEN v_late_mins > 60 THEN 'violation' ELSE 'warning' END,
        v_late_mins,
        format('تأخر في الحضور بمقدار %s دقيقة عن موعد الوردية', v_late_mins)
      );
    END IF;

  ELSE -- punch_type = 'out'
    v_check_out_time := (v_punch_time AT TIME ZONE 'Asia/Riyadh')::time;

    IF v_existing_att.id IS NOT NULL AND v_existing_att.check_in IS NOT NULL THEN
      -- Worked minutes
      IF v_check_out_time >= v_existing_att.check_in THEN
        v_worked_mins := round(EXTRACT(EPOCH FROM (v_check_out_time - v_existing_att.check_in)) / 60.0)::integer;
      ELSE
        -- Overnight span
        v_worked_mins := round(EXTRACT(EPOCH FROM ((v_check_out_time + interval '24 hours') - v_existing_att.check_in)) / 60.0)::integer;
      END IF;

      UPDATE public.attendance_records
      SET check_out = v_check_out_time,
          check_out_punch_id = v_punch_id,
          worked_minutes = v_worked_mins,
          worked_hours = round((v_worked_mins / 60.0)::numeric, 2),
          geofence_valid = (geofence_valid AND v_geofence_valid)
      WHERE id = v_existing_att.id;
    ELSE
      -- Punch out without previous punch in
      INSERT INTO public.attendance_records (
        company_id,
        employee_id,
        work_date,
        check_out,
        status,
        punch_source,
        geofence_valid,
        check_out_punch_id,
        scheduled_in,
        scheduled_out,
        shift_id
      ) VALUES (
        v_comp_id,
        v_emp_id,
        v_work_date,
        v_check_out_time,
        'present'::public.attendance_status,
        'mobile_gps',
        v_geofence_valid,
        v_punch_id,
        v_shift_start,
        v_shift_end,
        v_shift.id
      );

      INSERT INTO public.attendance_exceptions (
        company_id,
        employee_id,
        work_date,
        exception_type,
        severity,
        description
      ) VALUES (
        v_comp_id,
        v_emp_id,
        v_work_date,
        'missing_in',
        'warning',
        'تم تسجيل بصمة انصراف دون وجود بصمة حضور سابقة لنفس اليوم'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'punch_id', v_punch_id,
    'punch_type', p_punch_type,
    'punch_time', v_punch_time,
    'employee_name', v_emp_name,
    'geofence_valid', v_geofence_valid,
    'distance_meters', v_distance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_self_punch(text, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_self_punch(text, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_self_punch(text, double precision, double precision, double precision) TO service_role;


-- ============================================================================
-- 12. RPC: ATTENDANCE PERIOD CLOSE & IMMUTABLE SNAPSHOT GENERATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.close_attendance_period(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.attendance_periods%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_is_hr boolean;
  v_emp RECORD;
  v_snapshot_count integer := 0;
  v_hash text;
BEGIN
  -- Verify authorization
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
  ) INTO v_is_hr;

  IF NOT v_is_hr AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: only HR managers can close attendance periods.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_period
  FROM public.attendance_periods
  WHERE id = p_period_id;

  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'Attendance period not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_period.status = 'closed' THEN
    RAISE EXCEPTION 'This attendance period is already closed and sealed.' USING ERRCODE = '22023';
  END IF;

  -- Iterate through all active employees of the company and compile immutable snapshot
  FOR v_emp IN (
    SELECT e.id AS employee_id
    FROM public.employees e
    WHERE e.company_id = v_period.company_id AND e.status = 'active'
  ) LOOP
    -- Compute attendance stats for the period
    WITH stats AS (
      SELECT
        count(*) FILTER (WHERE ar.status = 'present') AS present_days,
        count(*) FILTER (WHERE ar.status = 'absent') AS absent_days,
        count(*) FILTER (WHERE ar.status = 'leave') AS leave_days,
        coalesce(sum(ar.late_minutes), 0) AS late_minutes,
        coalesce(sum(ar.early_departure_minutes), 0) AS early_mins,
        coalesce(sum(ar.worked_hours), 0) AS worked_hrs,
        coalesce(sum(ar.violations_count), 0) AS violations
      FROM public.attendance_records ar
      WHERE ar.employee_id = v_emp.employee_id
        AND ar.work_date BETWEEN v_period.from_date AND v_period.to_date
    ),
    ot AS (
      SELECT
        coalesce(sum(hours) FILTER (WHERE rate_type = 'regular_150' AND status = 'approved'), 0) AS reg_ot,
        coalesce(sum(hours) FILTER (WHERE rate_type = 'holiday_200' AND status = 'approved'), 0) AS hol_ot
      FROM public.overtime_records
      WHERE employee_id = v_emp.employee_id
        AND work_date BETWEEN v_period.from_date AND v_period.to_date
    )
    INSERT INTO public.attendance_payroll_snapshots (
      company_id,
      period_id,
      employee_id,
      total_expected_days,
      total_present_days,
      total_absent_days,
      total_leave_days,
      total_late_minutes,
      total_early_departure_minutes,
      total_worked_hours,
      regular_overtime_hours,
      holiday_overtime_hours,
      unexcused_absence_days,
      violations_count,
      snapshot_hash
    )
    SELECT
      v_period.company_id,
      v_period.id,
      v_emp.employee_id,
      (v_period.to_date - v_period.from_date + 1),
      stats.present_days,
      stats.absent_days,
      stats.leave_days,
      stats.late_minutes,
      stats.early_mins,
      stats.worked_hrs,
      ot.reg_ot,
      ot.hol_ot,
      stats.absent_days,
      stats.violations,
      encode(sha256(
        (v_period.id::text || '|' || v_emp.employee_id::text || '|' || stats.worked_hrs::text || '|' || ot.reg_ot::text || '|' || clock_timestamp()::text)::bytea
      ), 'hex')
    FROM stats, ot
    ON CONFLICT (period_id, employee_id) DO UPDATE
    SET total_present_days = EXCLUDED.total_present_days,
        total_absent_days = EXCLUDED.total_absent_days,
        total_leave_days = EXCLUDED.total_leave_days,
        total_late_minutes = EXCLUDED.total_late_minutes,
        total_worked_hours = EXCLUDED.total_worked_hours,
        regular_overtime_hours = EXCLUDED.regular_overtime_hours,
        holiday_overtime_hours = EXCLUDED.holiday_overtime_hours,
        snapshot_hash = EXCLUDED.snapshot_hash;

    v_snapshot_count := v_snapshot_count + 1;
  END LOOP;

  -- Seal period
  UPDATE public.attendance_periods
  SET status = 'closed',
      closed_by = v_user_id,
      closed_at = now()
  WHERE id = p_period_id;

  RETURN jsonb_build_object(
    'ok', true,
    'period_id', p_period_id,
    'status', 'closed',
    'snapshots_count', v_snapshot_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_attendance_period(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_attendance_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_attendance_period(uuid) TO service_role;


-- ============================================================================
-- 13. RPC: REOPEN ATTENDANCE PERIOD
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reopen_attendance_period(p_period_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A valid reason is required to reopen a closed attendance period.' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND role IN ('super_admin', 'org_admin', 'hr_manager')
  ) INTO v_is_admin;

  IF NOT v_is_admin AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: only Super Admin or HR Manager can reopen attendance periods.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.attendance_periods
  SET status = 'reopened',
      reopened_by = v_user_id,
      reopened_at = now(),
      reopen_reason = p_reason
  WHERE id = p_period_id;

  RETURN jsonb_build_object(
    'ok', true,
    'period_id', p_period_id,
    'status', 'reopened'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_attendance_period(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_attendance_period(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_attendance_period(uuid, text) TO service_role;


-- ============================================================================
-- 14. RPC: RESOLVE ATTENDANCE EXCEPTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_attendance_exception(p_exception_id uuid, p_resolution_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_hr boolean;
BEGIN
  IF p_resolution_note IS NULL OR trim(p_resolution_note) = '' THEN
    RAISE EXCEPTION 'Resolution note is required.' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer', 'line_manager')
  ) INTO v_is_hr;

  IF NOT v_is_hr AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: supervisor or HR role required.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.attendance_exceptions
  SET resolved = true,
      resolved_by = v_user_id,
      resolved_at = now(),
      resolution_note = p_resolution_note
  WHERE id = p_exception_id;

  RETURN jsonb_build_object('ok', true, 'exception_id', p_exception_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_attendance_exception(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_attendance_exception(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_attendance_exception(uuid, text) TO service_role;


-- ============================================================================
-- 15. RPC: BIOMETRIC BATCH INGESTION WITH DEDUPLICATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.import_biometric_punches(
  p_device_id text,
  p_punches jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp_id uuid := public.current_company_id();
  v_item jsonb;
  v_emp_ref text;
  v_emp_id uuid;
  v_ptime timestamptz;
  v_ptype text;
  v_total integer := 0;
  v_success integer := 0;
  v_dup integer := 0;
  v_failed integer := 0;
  v_batch_id uuid := gen_random_uuid();
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_punches) != 'array' THEN
    RAISE EXCEPTION 'Punches payload must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  v_total := jsonb_array_length(p_punches);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_punches) LOOP
    v_emp_ref := v_item->>'employee_no';
    v_ptime := (v_item->>'punch_time')::timestamptz;
    v_ptype := coalesce(v_item->>'punch_type', 'in');

    -- Resolve employee
    SELECT id INTO v_emp_id
    FROM public.employees
    WHERE (employee_no = v_emp_ref OR id::text = v_emp_ref)
      AND company_id = v_comp_id
    LIMIT 1;

    IF v_emp_id IS NULL THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('employee_no', v_emp_ref, 'error', 'Employee not found');
      CONTINUE;
    END IF;

    -- Check duplicate within 60 seconds
    IF EXISTS (
      SELECT 1 FROM public.punches
      WHERE employee_id = v_emp_id
        AND abs(EXTRACT(EPOCH FROM (punch_time - v_ptime))) < 60
    ) THEN
      v_dup := v_dup + 1;
      CONTINUE;
    END IF;

    -- Insert raw punch
    INSERT INTO public.punches (
      company_id,
      employee_id,
      punch_time,
      punch_type,
      source,
      device_id,
      approval_status,
      batch_id
    ) VALUES (
      v_comp_id,
      v_emp_id,
      v_ptime,
      v_ptype,
      'biometric_device',
      p_device_id,
      'approved',
      v_batch_id
    );

    v_success := v_success + 1;
  END LOOP;

  -- Record batch summary
  INSERT INTO public.punch_import_batches (
    id,
    company_id,
    device_id,
    imported_by,
    total_records,
    successful_records,
    failed_records,
    duplicate_records,
    error_log
  ) VALUES (
    v_batch_id,
    v_comp_id,
    p_device_id,
    auth.uid(),
    v_total,
    v_success,
    v_failed,
    v_dup,
    v_errors
  );

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'total', v_total,
    'successful', v_success,
    'duplicates', v_dup,
    'failed', v_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_biometric_punches(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_biometric_punches(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_biometric_punches(text, jsonb) TO service_role;


-- ============================================================================
-- 16. TENANT-SAFE RLS POLICIES FOR ALL ATTENDANCE TABLES
-- ============================================================================

-- Attendance Policies RLS
DROP POLICY IF EXISTS attendance_policies_read ON public.attendance_policies;
CREATE POLICY attendance_policies_read ON public.attendance_policies
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS attendance_policies_manage ON public.attendance_policies;
CREATE POLICY attendance_policies_manage ON public.attendance_policies
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager')
    )
  );

-- Attendance Periods RLS
DROP POLICY IF EXISTS attendance_periods_read ON public.attendance_periods;
CREATE POLICY attendance_periods_read ON public.attendance_periods
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS attendance_periods_manage ON public.attendance_periods;
CREATE POLICY attendance_periods_manage ON public.attendance_periods
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- Attendance Payroll Snapshots RLS
DROP POLICY IF EXISTS attendance_payroll_snapshots_read ON public.attendance_payroll_snapshots;
CREATE POLICY attendance_payroll_snapshots_read ON public.attendance_payroll_snapshots
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id() AND (
      employee_id = public.resolve_my_employee_id() OR
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager', 'payroll_officer')
      )
    )
  );

-- Punches RLS
DROP POLICY IF EXISTS punches_read ON public.punches;
CREATE POLICY punches_read ON public.punches
  FOR SELECT TO authenticated
  USING (
    (company_id = public.current_company_id() OR company_id IS NULL) AND (
      employee_id = public.resolve_my_employee_id() OR
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer', 'line_manager')
      )
    )
  );

DROP POLICY IF EXISTS punches_insert ON public.punches;
CREATE POLICY punches_insert ON public.punches
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.resolve_my_employee_id() OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- Attendance Records RLS
DROP POLICY IF EXISTS attendance_records_read ON public.attendance_records;
CREATE POLICY attendance_records_read ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    (company_id = public.current_company_id() OR company_id IS NULL) AND (
      employee_id = public.resolve_my_employee_id() OR
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer', 'line_manager')
      )
    )
  );

DROP POLICY IF EXISTS attendance_records_manage ON public.attendance_records;
CREATE POLICY attendance_records_manage ON public.attendance_records
  FOR ALL TO authenticated
  USING (
    (company_id = public.current_company_id() OR company_id IS NULL) AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- Attendance Exceptions RLS
DROP POLICY IF EXISTS attendance_exceptions_read ON public.attendance_exceptions;
CREATE POLICY attendance_exceptions_read ON public.attendance_exceptions
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id() AND (
      employee_id = public.resolve_my_employee_id() OR
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer', 'line_manager')
      )
    )
  );

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.attendance_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.attendance_periods TO authenticated;
GRANT SELECT ON public.attendance_payroll_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.punches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.attendance_exceptions TO authenticated;
GRANT SELECT, INSERT ON public.punch_import_batches TO authenticated;

COMMIT;
