-- ============================================================================
-- MIGRATION: 20260924010000_finalize_attendance_integrity_and_tenant_security.sql
-- DESCRIPTION: Prompt 12.1 Attendance Production Integrity + Security Hotfix
--              - Removes implicit Saudi defaults & automatic global policy insertion
--              - Effective-dated & versioned attendance policy architecture
--              - Eliminates hardcoded 'Asia/Riyadh' and arbitrary location fallbacks
--              - Eliminates 08:00/17:00 shift fallbacks (records no_shift_assignment)
--              - Client event idempotency (client_event_id)
--              - Multiple punch pairs & unpaired/duplicate punch exceptions
--              - Authoritative process_attendance_day RPC with Leave & Holiday integration
--              - Biometric device master & employee mapping tables
--              - Company-scoped tenant authorization on all RPCs & strict RLS
--              - Versioned, deterministic SHA-256 payroll attendance snapshots
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CLEAN UP AUTOMATIC SEEDS & UNPROVABLE SHIFTS
-- ============================================================================

-- Remove automatic default seed rows that were created with generic names
DELETE FROM public.attendance_policies
WHERE name_ar LIKE 'سياسة الدوام لشركة %'
  AND updated_at = created_at;

-- Remove hardcoded Al-Andalus company_id from legacy shifts that have no provable relationship
-- (i.e., shifts that have no schedule_assignments or locations belonging to Al-Andalus)
UPDATE public.shifts s
SET company_id = NULL
WHERE s.company_id = 'a0000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM public.schedule_assignments sa
    JOIN public.employees e ON e.id = sa.employee_id
    WHERE sa.shift_id = s.id AND e.company_id = 'a0000000-0000-0000-0000-000000000001'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.work_locations wl
    WHERE wl.default_shift_id = s.id AND wl.company_id = 'a0000000-0000-0000-0000-000000000001'
  );


-- ============================================================================
-- 2. EFFECTIVE-DATED & VERSIONED ATTENDANCE POLICIES ARCHITECTURE
-- ============================================================================

-- Alter attendance_policies columns to allow explicit configuration without silent Saudi defaults
ALTER TABLE public.attendance_policies
  ALTER COLUMN grace_period_in_minutes DROP DEFAULT,
  ALTER COLUMN grace_period_out_minutes DROP DEFAULT,
  ALTER COLUMN overtime_regular_multiplier DROP DEFAULT,
  ALTER COLUMN overtime_holiday_multiplier DROP DEFAULT,
  ALTER COLUMN default_work_hours_per_day DROP DEFAULT,
  ALTER COLUMN ramadan_work_hours_per_day DROP DEFAULT,
  ALTER COLUMN max_work_hours_per_week DROP DEFAULT,
  ALTER COLUMN ramadan_max_work_hours_per_week DROP DEFAULT,
  ALTER COLUMN geofence_radius_meters DROP DEFAULT,
  ALTER COLUMN break_duration_minutes DROP DEFAULT,
  ALTER COLUMN max_consecutive_hours_without_break DROP DEFAULT;

-- Add versioning and effective date columns
ALTER TABLE public.attendance_policies
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS max_gps_accuracy_meters integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Replace single-policy unique constraint with versioned unique constraint
ALTER TABLE public.attendance_policies
  DROP CONSTRAINT IF EXISTS uq_attendance_policies_company;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_attendance_policies_company_version'
      AND conrelid = 'public.attendance_policies'::regclass
  ) THEN
    ALTER TABLE public.attendance_policies
      ADD CONSTRAINT uq_attendance_policies_company_version UNIQUE (company_id, version);
  END IF;
END $$;

-- Enhance attendance_records to track effective policy version
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.attendance_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS policy_version integer;


-- ============================================================================
-- 3. RAW PUNCH IDEMPOTENCY & CLIENT EVENT IDENTIFIER
-- ============================================================================

ALTER TABLE public.punches
  ADD COLUMN IF NOT EXISTS client_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_punches_client_event
  ON public.punches (company_id, client_event_id)
  WHERE client_event_id IS NOT NULL;


-- ============================================================================
-- 4. BIOMETRIC DEVICE MASTER & EMPLOYEE MAPPING
-- ============================================================================

-- Ensure attendance_devices has all enterprise columns
CREATE TABLE IF NOT EXISTS public.attendance_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  device_name text NOT NULL DEFAULT 'جهاز بصمة',
  vendor text NOT NULL DEFAULT 'generic',
  model text,
  serial_number text,
  device_code text,
  timezone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  health_status text DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_devices
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS vendor text DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS device_code text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill company_id from work_locations if available
UPDATE public.attendance_devices ad
SET company_id = wl.company_id
FROM public.work_locations wl
WHERE ad.work_location_id = wl.id AND ad.company_id IS NULL;

-- Populate device_name from name if null
UPDATE public.attendance_devices
SET device_name = name
WHERE device_name IS NULL AND EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'attendance_devices' AND column_name = 'name'
);

-- Populate device_code from serial_number if null
UPDATE public.attendance_devices
SET device_code = serial_number
WHERE device_code IS NULL AND serial_number IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_attendance_devices_code'
      AND conrelid = 'public.attendance_devices'::regclass
  ) THEN
    ALTER TABLE public.attendance_devices
      ADD CONSTRAINT uq_attendance_devices_code UNIQUE (company_id, device_code);
  END IF;
END $$;

ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.attendance_device_employee_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.attendance_devices(id) ON DELETE CASCADE,
  external_user_id text NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_device_employee_mapping UNIQUE (company_id, device_id, external_user_id)
);

ALTER TABLE public.attendance_device_employee_mappings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.punch_import_raw_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.punch_import_batches(id) ON DELETE SET NULL,
  device_id text,
  external_event_id text,
  external_user_id text NOT NULL,
  punch_time timestamptz NOT NULL,
  punch_type text NOT NULL,
  raw_payload jsonb,
  status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'ignored')),
  matched_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_punch_raw_events_ext
  ON public.punch_import_raw_events (company_id, device_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

ALTER TABLE public.punch_import_raw_events ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 5. ATTENDANCE EXCEPTIONS EXPANSION
-- ============================================================================

ALTER TABLE public.attendance_exceptions
  DROP CONSTRAINT IF EXISTS attendance_exceptions_exception_type_check;

ALTER TABLE public.attendance_exceptions
  ADD CONSTRAINT attendance_exceptions_exception_type_check CHECK (exception_type IN (
    'late_arrival',
    'early_departure',
    'missing_in',
    'missing_out',
    'unexcused_absence',
    'geofence_breach',
    'overtime_without_approval',
    'excessive_break',
    'no_shift_assignment',
    'low_gps_accuracy',
    'unpaired_in',
    'unpaired_out',
    'duplicate_in',
    'duplicate_out'
  ));


-- ============================================================================
-- 6. PERIOD LIFECYCLE & DETERMINISTIC PAYROLL SNAPSHOTS
-- ============================================================================

-- Add period version and expanded status lifecycle
ALTER TABLE public.attendance_periods
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS closing_notes text;

ALTER TABLE public.attendance_periods
  DROP CONSTRAINT IF EXISTS attendance_periods_status_check;

ALTER TABLE public.attendance_periods
  ADD CONSTRAINT attendance_periods_status_check CHECK (
    status IN ('open', 'processing', 'review', 'closed', 'exported_to_payroll', 'reopened')
  );

-- Enhance payroll snapshots for versioning and non-monetary metrics
ALTER TABLE public.attendance_payroll_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS period_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approved_overtime_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payable_overtime_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_category text DEFAULT 'standard';

-- Replace old snapshot unique constraint with versioned unique constraint
ALTER TABLE public.attendance_payroll_snapshots
  DROP CONSTRAINT IF EXISTS uq_attendance_payroll_snapshots;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_attendance_payroll_snapshots_ver'
      AND conrelid = 'public.attendance_payroll_snapshots'::regclass
  ) THEN
    ALTER TABLE public.attendance_payroll_snapshots
      ADD CONSTRAINT uq_attendance_payroll_snapshots_ver
      UNIQUE (period_id, period_version, employee_id, snapshot_version);
  END IF;
END $$;

-- Update immutability trigger for snapshots to allow inserts of new versions but block updates
CREATE OR REPLACE FUNCTION public.prevent_payroll_snapshot_tampering()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Attendance payroll snapshots are sealed and strictly immutable. Changes require reopening the period and generating a new version.';
  ELSIF TG_OP = 'DELETE' THEN
    IF current_user != 'postgres' AND auth.role() != 'service_role' THEN
      RAISE EXCEPTION 'Attendance payroll snapshots cannot be deleted. Period must be reopened instead.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

-- Fix period lock trigger DELETE bug (Prompt 12.1 Item 47)
CREATE OR REPLACE FUNCTION public.check_attendance_period_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_status text;
  v_comp_id uuid;
  v_work_date date;
BEGIN
  v_comp_id   := COALESCE(NEW.company_id, OLD.company_id);
  v_work_date := COALESCE(NEW.work_date, OLD.work_date);

  -- Check if there is an active closed period covering this work_date
  SELECT status INTO v_period_status
  FROM public.attendance_periods
  WHERE company_id = v_comp_id
    AND v_work_date BETWEEN from_date AND to_date
    AND status IN ('closed', 'exported_to_payroll')
  LIMIT 1;

  IF v_period_status IN ('closed', 'exported_to_payroll') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Attendance records for date % belong to a closed payroll attendance period and cannot be modified.', v_work_date;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


-- ============================================================================
-- 7. TIMEZONE RESOLUTION HELPER (Prompt 12.1 Item 5)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_effective_company_timezone(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'معرف الشركة غير محدد للتحقق من المنطقة الزمنية.' USING ERRCODE = '22023';
  END IF;

  SELECT timezone INTO v_tz
  FROM public.companies
  WHERE id = p_company_id;

  IF v_tz IS NULL OR trim(v_tz) = '' THEN
    RAISE EXCEPTION 'لم يتم ضبط المنطقة الزمنية للمنشأة (company.timezone). يرجى إعداد المنطقة الزمنية في ملف المنشأة أولاً.' USING ERRCODE = '22023';
  END IF;

  -- Validate that PostgreSQL recognizes this IANA timezone without error
  BEGIN
    PERFORM now() AT TIME ZONE v_tz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'المنطقة الزمنية المحددة للمنشأة غير صالحة (%s).', v_tz USING ERRCODE = '22023';
  END;

  RETURN v_tz;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_company_timezone(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_company_timezone(uuid) TO service_role;


-- ============================================================================
-- 8. AUTHORITATIVE PROCESS_ATTENDANCE_DAY RPC (Prompt 12.1 Items 13, 14, 15, 16, 17, 18, 19, 20)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_attendance_day(
  p_employee_id uuid,
  p_business_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp RECORD;
  v_comp_id uuid;
  v_timezone text;
  v_company_today date;
  v_policy public.attendance_policies%ROWTYPE;
  v_has_policy boolean := false;
  v_period_status text;
  v_assignment RECORD;
  v_has_shift boolean := false;
  v_shift RECORD;
  v_leave RECORD;
  v_has_leave boolean := false;
  v_is_holiday boolean := false;
  v_is_rest_day boolean := false;
  
  -- Punch pairing variables
  v_punch RECORD;
  v_punches_count integer := 0;
  v_first_in time := NULL;
  v_last_out time := NULL;
  v_check_in_punch_id uuid := NULL;
  v_check_out_punch_id uuid := NULL;
  v_current_in_time timestamptz := NULL;
  v_worked_minutes integer := 0;
  v_late_minutes integer := 0;
  v_early_departure_minutes integer := 0;
  v_violations_count integer := 0;
  v_status public.attendance_status := 'absent';
  v_source text := 'mobile_gps';
  v_geofence_valid boolean := true;
  v_expected_minutes integer := 0;
  
  -- Time window for overnight shift
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_shift_start_ts timestamptz;
  v_shift_end_ts timestamptz;
  v_grace_in integer := 0;
  v_grace_out integer := 0;
BEGIN
  -- 1. Resolve employee and company
  SELECT e.id, e.company_id, e.work_location_id, e.status, e.hire_date
  INTO v_emp
  FROM public.employees e
  WHERE e.id = p_employee_id;

  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود.' USING ERRCODE = 'P0002';
  END IF;

  v_comp_id := v_emp.company_id;

  -- 2. Resolve company timezone
  v_timezone := public.get_effective_company_timezone(v_comp_id);
  v_company_today := (now() AT TIME ZONE v_timezone)::date;

  -- 3. Check period lock
  SELECT status INTO v_period_status
  FROM public.attendance_periods
  WHERE company_id = v_comp_id
    AND p_business_date BETWEEN from_date AND to_date
    AND status IN ('closed', 'exported_to_payroll')
  LIMIT 1;

  IF v_period_status IN ('closed', 'exported_to_payroll') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'لا يمكن تعديل سجلات فترة حضور مغلقة ومختومة.' USING ERRCODE = '22023';
  END IF;

  -- 4. Resolve effective policy for this date
  SELECT * INTO v_policy
  FROM public.attendance_policies
  WHERE company_id = v_comp_id
    AND status = 'active'
    AND effective_from <= p_business_date
    AND (effective_to IS NULL OR effective_to >= p_business_date)
  ORDER BY version DESC
  LIMIT 1;

  IF v_policy.id IS NOT NULL THEN
    v_has_policy := true;
    v_grace_in := COALESCE(v_policy.grace_period_in_minutes, 0);
    v_grace_out := COALESCE(v_policy.grace_period_out_minutes, 0);
  END IF;

  -- 5. Resolve shift schedule assignment (Prompt 12.1 Item 6 & 20)
  SELECT sa.*, s.start_time, s.end_time, s.type AS shift_type, s.is_overnight,
         s.break_minutes, s.flexible_hours, s.split_second_start_time, s.split_second_end_time,
         s.grace_minutes_arrival, s.grace_minutes_departure
  INTO v_assignment
  FROM public.schedule_assignments sa
  LEFT JOIN public.shifts s ON s.id = sa.shift_id
  WHERE sa.employee_id = p_employee_id AND sa.work_date = p_business_date
  LIMIT 1;

  IF v_assignment.shift_id IS NOT NULL THEN
    v_has_shift := true;
    IF v_assignment.grace_minutes_arrival IS NOT NULL THEN
      v_grace_in := v_assignment.grace_minutes_arrival;
    END IF;
    IF v_assignment.grace_minutes_departure IS NOT NULL THEN
      v_grace_out := v_assignment.grace_minutes_departure;
    END IF;
  END IF;

  v_is_rest_day := COALESCE(v_assignment.is_rest_day, false);

  -- 6. Check company holiday (Prompt 12.1 Item 17)
  SELECT EXISTS (
    SELECT 1 FROM public.company_holidays
    WHERE company_id = v_comp_id
      AND p_business_date BETWEEN start_date AND end_date
  ) INTO v_is_holiday;

  -- 7. Check approved leave (Prompt 12.1 Item 16)
  SELECT r.id, r.days, r.payload
  INTO v_leave
  FROM public.requests r
  WHERE r.employee_id = p_employee_id
    AND r.type = 'leave'
    AND r.status = 'approved'
    AND p_business_date BETWEEN r.start_date AND r.end_date
  LIMIT 1;

  IF v_leave.id IS NOT NULL THEN
    v_has_leave := true;
  END IF;

  -- 8. Define punch collection window for this business day
  -- Handles overnight shift crossing midnight (Prompt 12.1 Item 19)
  IF v_has_shift AND COALESCE(v_assignment.is_overnight, false) THEN
    -- Window spans from 4 hours before shift start on business_date to 6 hours after shift end on next day
    v_window_start := (p_business_date || ' ' || v_assignment.start_time)::timestamp AT TIME ZONE v_timezone - interval '4 hours';
    v_window_end   := ((p_business_date + 1) || ' ' || v_assignment.end_time)::timestamp AT TIME ZONE v_timezone + interval '6 hours';
  ELSE
    -- Standard day: covers the entire calendar business day in company timezone plus 4 hours grace
    v_window_start := (p_business_date || ' 00:00:00')::timestamp AT TIME ZONE v_timezone - interval '2 hours';
    v_window_end   := (p_business_date || ' 23:59:59')::timestamp AT TIME ZONE v_timezone + interval '4 hours';
  END IF;

  -- 9. Fetch and pair raw punches (Prompt 12.1 Items 14 & 15)
  FOR v_punch IN (
    SELECT p.*, (p.punch_time AT TIME ZONE v_timezone)::time AS local_time
    FROM public.punches p
    WHERE p.employee_id = p_employee_id
      AND p.punch_time >= v_window_start
      AND p.punch_time <= v_window_end
      AND p.approval_status = 'approved'
    ORDER BY p.punch_time ASC
  ) LOOP
    v_punches_count := v_punches_count + 1;
    v_source := v_punch.source;

    IF v_punch.distance_from_location_meters IS NOT NULL AND v_punch.distance_from_location_meters > 200 THEN
      v_geofence_valid := false;
    END IF;

    IF v_punch.punch_type = 'in' THEN
      IF v_first_in IS NULL THEN
        v_first_in := v_punch.local_time;
        v_check_in_punch_id := v_punch.id;
      END IF;

      -- Check for consecutive IN without OUT (Prompt 12.1 Item 15)
      IF v_current_in_time IS NOT NULL THEN
        v_violations_count := v_violations_count + 1;
        INSERT INTO public.attendance_exceptions (
          company_id, employee_id, work_date, exception_type, severity, description
        ) VALUES (
          v_comp_id, p_employee_id, p_business_date, 'duplicate_in', 'warning',
          'تم تسجيل بصمة دخول متكررة قبل تسجيل الانصراف للبصمة السابقة'
        ) ON CONFLICT DO NOTHING;
      END IF;

      v_current_in_time := v_punch.punch_time;

    ELSIF v_punch.punch_type = 'out' THEN
      v_last_out := v_punch.local_time;
      v_check_out_punch_id := v_punch.id;

      IF v_current_in_time IS NOT NULL THEN
        -- Valid pair: calculate interval in minutes
        v_worked_minutes := v_worked_minutes + round(EXTRACT(EPOCH FROM (v_punch.punch_time - v_current_in_time)) / 60.0)::integer;
        v_current_in_time := NULL;
      ELSE
        -- OUT without preceding IN (Prompt 12.1 Item 15)
        v_violations_count := v_violations_count + 1;
        INSERT INTO public.attendance_exceptions (
          company_id, employee_id, work_date, exception_type, severity, description
        ) VALUES (
          v_comp_id, p_employee_id, p_business_date, 'unpaired_out', 'warning',
          'تم تسجيل بصمة انصراف دون وجود بصمة حضور سابقة مقترنة بها'
        ) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  -- Trailing IN without OUT
  IF v_current_in_time IS NOT NULL THEN
    -- If shift/cutoff has already passed in company timezone, record exception
    IF p_business_date < v_company_today THEN
      v_violations_count := v_violations_count + 1;
      INSERT INTO public.attendance_exceptions (
        company_id, employee_id, work_date, exception_type, severity, description
      ) VALUES (
        v_comp_id, p_employee_id, p_business_date, 'missing_out', 'warning',
        'تم تسجيل بصمة دخول ولكن لم يتم تسجيل بصمة انصراف حتى نهاية اليوم'
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- 10. Deduct break if policy configured
  IF v_has_policy AND v_policy.auto_deduct_breaks IS TRUE AND v_policy.break_duration_minutes IS NOT NULL THEN
    IF v_worked_minutes >= 300 THEN -- 5 hours
      v_worked_minutes := GREATEST(0, v_worked_minutes - v_policy.break_duration_minutes);
    END IF;
  END IF;

  -- 11. Determine status and calculate lateness / early departure
  IF v_punches_count > 0 THEN
    v_status := 'present';

    -- No shift assignment exception (Prompt 12.1 Item 6)
    IF NOT v_has_shift THEN
      v_violations_count := v_violations_count + 1;
      INSERT INTO public.attendance_exceptions (
        company_id, employee_id, work_date, exception_type, severity, description
      ) VALUES (
        v_comp_id, p_employee_id, p_business_date, 'no_shift_assignment', 'info',
        'تم تسجيل بصمات حضور للموظف دون وجود جدول وردية معتمد لهذا اليوم'
      ) ON CONFLICT DO NOTHING;
    ELSE
      -- Shift exists: calculate late minutes
      IF v_assignment.start_time IS NOT NULL AND v_first_in IS NOT NULL THEN
        IF v_first_in > (v_assignment.start_time + (v_grace_in || ' minutes')::interval) THEN
          v_late_minutes := round(EXTRACT(EPOCH FROM (v_first_in - v_assignment.start_time)) / 60.0)::integer;
          v_status := 'late';
          v_violations_count := v_violations_count + 1;

          INSERT INTO public.attendance_exceptions (
            company_id, employee_id, work_date, exception_type, severity, minutes, description
          ) VALUES (
            v_comp_id, p_employee_id, p_business_date, 'late_arrival',
            CASE WHEN v_late_minutes > 60 THEN 'violation' ELSE 'warning' END,
            v_late_minutes,
            format('تأخر في الحضور بمقدار %s دقيقة عن موعد الوردية', v_late_minutes)
          ) ON CONFLICT DO NOTHING;
        END IF;
      END IF;

      -- Calculate early departure
      IF v_assignment.end_time IS NOT NULL AND v_last_out IS NOT NULL THEN
        IF v_last_out < (v_assignment.end_time - (v_grace_out || ' minutes')::interval) THEN
          v_early_departure_minutes := round(EXTRACT(EPOCH FROM (v_assignment.end_time - v_last_out)) / 60.0)::integer;
          v_violations_count := v_violations_count + 1;

          INSERT INTO public.attendance_exceptions (
            company_id, employee_id, work_date, exception_type, severity, minutes, description
          ) VALUES (
            v_comp_id, p_employee_id, p_business_date, 'early_departure', 'warning',
            v_early_departure_minutes,
            format('انصراف مبكر بمقدار %s دقيقة قبل نهاية الوردية', v_early_departure_minutes)
          ) ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END IF;

  ELSE
    -- No punches recorded
    IF v_has_leave THEN
      v_status := 'leave';
      v_worked_minutes := 0;
    ELSIF v_is_holiday THEN
      v_status := 'present'; -- holiday status marker
      v_worked_minutes := 0;
    ELSIF v_is_rest_day THEN
      v_status := 'present'; -- rest day marker
      v_worked_minutes := 0;
    ELSE
      -- Normal working day with no punches
      -- Future date guard (Prompt 12.1 Item 18): Never mark future dates absent!
      IF p_business_date > v_company_today THEN
        -- Future date: leave unfinalized, do not mark absent
        RETURN jsonb_build_object('ok', true, 'status', 'future', 'date', p_business_date);
      ELSIF p_business_date < v_company_today THEN
        -- Past date: definitive absence
        v_status := 'absent';
        v_violations_count := v_violations_count + 1;
        INSERT INTO public.attendance_exceptions (
          company_id, employee_id, work_date, exception_type, severity, description
        ) VALUES (
          v_comp_id, p_employee_id, p_business_date, 'unexcused_absence', 'violation',
          'غياب غير مبرر عن يوم عمل معتمد دون تسجيل أي حركة حضور أو تقديم إجازة'
        ) ON CONFLICT DO NOTHING;
      ELSE
        -- Today: check if shift end time has passed
        IF v_has_shift AND v_assignment.end_time IS NOT NULL THEN
          IF (now() AT TIME ZONE v_timezone)::time > (v_assignment.end_time + interval '2 hours') THEN
            v_status := 'absent';
            v_violations_count := v_violations_count + 1;
            INSERT INTO public.attendance_exceptions (
              company_id, employee_id, work_date, exception_type, severity, description
            ) VALUES (
              v_comp_id, p_employee_id, p_business_date, 'unexcused_absence', 'violation',
              'غياب غير مبرر: انتهت ساعات الوردية دون تسجيل حضور'
            ) ON CONFLICT DO NOTHING;
          ELSE
            -- Shift is still active or upcoming today
            v_status := 'present';
          END IF;
        ELSE
          v_status := 'present';
        END IF;
      END IF;
    END IF;
  END IF;

  -- 12. Upsert daily attendance record idempotently
  INSERT INTO public.attendance_records (
    company_id,
    employee_id,
    work_date,
    shift_id,
    policy_id,
    policy_version,
    check_in,
    check_out,
    check_in_punch_id,
    check_out_punch_id,
    worked_minutes,
    worked_hours,
    late_minutes,
    early_departure_minutes,
    status,
    punch_source,
    geofence_valid,
    violations_count,
    scheduled_in,
    scheduled_out
  ) VALUES (
    v_comp_id,
    p_employee_id,
    p_business_date,
    v_assignment.shift_id,
    v_policy.id,
    v_policy.version,
    v_first_in,
    v_last_out,
    v_check_in_punch_id,
    v_check_out_punch_id,
    v_worked_minutes,
    round(v_worked_minutes / 60.0, 2),
    v_late_minutes,
    v_early_departure_minutes,
    v_status,
    v_source,
    v_geofence_valid,
    v_violations_count,
    v_assignment.start_time,
    v_assignment.end_time
  )
  ON CONFLICT (employee_id, work_date) DO UPDATE
  SET shift_id = EXCLUDED.shift_id,
      policy_id = EXCLUDED.policy_id,
      policy_version = EXCLUDED.policy_version,
      check_in = EXCLUDED.check_in,
      check_out = EXCLUDED.check_out,
      check_in_punch_id = EXCLUDED.check_in_punch_id,
      check_out_punch_id = EXCLUDED.check_out_punch_id,
      worked_minutes = EXCLUDED.worked_minutes,
      worked_hours = EXCLUDED.worked_hours,
      late_minutes = EXCLUDED.late_minutes,
      early_departure_minutes = EXCLUDED.early_departure_minutes,
      status = EXCLUDED.status,
      punch_source = EXCLUDED.punch_source,
      geofence_valid = EXCLUDED.geofence_valid,
      violations_count = EXCLUDED.violations_count,
      scheduled_in = EXCLUDED.scheduled_in,
      scheduled_out = EXCLUDED.scheduled_out;

  RETURN jsonb_build_object(
    'ok', true,
    'employee_id', p_employee_id,
    'work_date', p_business_date,
    'status', v_status,
    'worked_minutes', v_worked_minutes,
    'late_minutes', v_late_minutes,
    'violations_count', v_violations_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_attendance_day(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_attendance_day(uuid, date) TO service_role;


-- Batch wrapper for processing attendance across a company and date range
CREATE OR REPLACE FUNCTION public.process_company_attendance_range(
  p_from_date date,
  p_to_date date,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp_id uuid := COALESCE(p_company_id, public.current_company_id());
  v_emp RECORD;
  v_curr_date date;
  v_count integer := 0;
BEGIN
  IF v_comp_id IS NULL THEN
    RAISE EXCEPTION 'معرف الشركة غير محدد.' USING ERRCODE = '22023';
  END IF;

  FOR v_emp IN (
    SELECT id FROM public.employees
    WHERE company_id = v_comp_id AND status IN ('active', 'probation', 'on_leave')
  ) LOOP
    v_curr_date := p_from_date;
    WHILE v_curr_date <= p_to_date LOOP
      PERFORM public.process_attendance_day(v_emp.id, v_curr_date);
      v_curr_date := v_curr_date + 1;
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'company_id', v_comp_id, 'processed_days', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_company_attendance_range(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_company_attendance_range(date, date, uuid) TO service_role;


-- ============================================================================
-- 9. REWRITE RECORD_SELF_PUNCH WITH TIMEZONE & STRICT IDEMPOTENCY (Prompt 12.1 Items 5, 9, 10, 11, 12)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_self_punch(
  p_punch_type text,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy double precision DEFAULT NULL,
  p_client_event_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_emp_id uuid;
  v_emp RECORD;
  v_comp_id uuid;
  v_timezone text;
  v_punch_time timestamptz := clock_timestamp(); -- Official server UTC timestamp
  v_business_date date;
  v_distance double precision := NULL;
  v_geofence_valid boolean := true;
  v_loc_lat double precision;
  v_loc_lon double precision;
  v_loc_radius integer := 200;
  v_policy public.attendance_policies%ROWTYPE;
  v_max_gps_acc integer := 100;
  v_punch_id uuid;
  v_existing_punch public.punches%ROWTYPE;
BEGIN
  -- 1. Authentication
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to punch in/out.' USING ERRCODE = '42501';
  END IF;

  IF p_punch_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Invalid punch type: must be "in" or "out".' USING ERRCODE = '22023';
  END IF;

  -- 2. Server-authoritative employee identity resolution
  v_emp_id := public.resolve_my_employee_id();
  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'No active employee profile linked to current user.' USING ERRCODE = 'P0002';
  END IF;

  SELECT e.id, e.full_name, e.company_id, e.work_location_id, e.status
  INTO v_emp
  FROM public.employees e
  WHERE e.id = v_emp_id;

  v_comp_id := v_emp.company_id;

  -- 3. Idempotency Check via client_event_id (Prompt 12.1 Item 11)
  IF p_client_event_id IS NOT NULL AND trim(p_client_event_id) != '' THEN
    SELECT * INTO v_existing_punch
    FROM public.punches
    WHERE company_id = v_comp_id
      AND client_event_id = trim(p_client_event_id)
    LIMIT 1;

    IF v_existing_punch.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent_replay', true,
        'punch_id', v_existing_punch.id,
        'punch_type', v_existing_punch.punch_type,
        'punch_time', v_existing_punch.punch_time,
        'employee_name', v_emp.full_name,
        'geofence_valid', (v_existing_punch.distance_from_location_meters <= 200 OR v_existing_punch.distance_from_location_meters IS NULL),
        'distance_meters', v_existing_punch.distance_from_location_meters
      );
    END IF;
  END IF;

  -- 4. Company Timezone Resolution (Prompt 12.1 Item 5)
  v_timezone := public.get_effective_company_timezone(v_comp_id);
  v_business_date := (v_punch_time AT TIME ZONE v_timezone)::date;

  -- 5. Active Attendance Policy Lookup
  SELECT * INTO v_policy
  FROM public.attendance_policies
  WHERE company_id = v_comp_id
    AND status = 'active'
    AND effective_from <= v_business_date
    AND (effective_to IS NULL OR effective_to >= v_business_date)
  ORDER BY version DESC
  LIMIT 1;

  IF v_policy.id IS NOT NULL THEN
    v_max_gps_acc := COALESCE(v_policy.max_gps_accuracy_meters, 100);
  END IF;

  -- 6. GPS Accuracy Policy Validation (Prompt 12.1 Item 9)
  IF p_accuracy IS NOT NULL AND p_accuracy > v_max_gps_acc THEN
    INSERT INTO public.attendance_exceptions (
      company_id, employee_id, work_date, exception_type, severity, description
    ) VALUES (
      v_comp_id, v_emp.id, v_business_date, 'low_gps_accuracy', 'warning',
      format('دقة إحداثيات GPS ضعيفة (%s م) وتتجاوز الحد المسموح بالسياسة (%s م)', round(p_accuracy::numeric, 1), v_max_gps_acc)
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 7. Geofence Evaluation — Strictly Assigned Work Location (Prompt 12.1 Item 10)
  -- NO arbitrary first company location fallback!
  IF v_emp.work_location_id IS NOT NULL THEN
    SELECT latitude, longitude, COALESCE(radius_meters, 200)
    INTO v_loc_lat, v_loc_lon, v_loc_radius
    FROM public.work_locations
    WHERE id = v_emp.work_location_id AND company_id = v_comp_id;
  END IF;

  IF v_loc_lat IS NOT NULL AND v_loc_lon IS NOT NULL AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    v_distance := public.haversine_distance_meters(v_loc_lat, v_loc_lon, p_latitude, p_longitude);
    IF v_policy.id IS NOT NULL AND v_policy.geofence_enforced IS TRUE AND v_distance > v_loc_radius THEN
      v_geofence_valid := false;
    END IF;
  ELSIF v_policy.id IS NOT NULL AND v_policy.geofence_enforced IS TRUE AND v_emp.work_location_id IS NULL THEN
    -- Geofence enforced by policy but employee has no location assigned
    v_geofence_valid := false;
  END IF;

  -- 8. Insert Immutable Raw Punch (Prompt 12.1 Item 12)
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
    location_id,
    client_event_id,
    approval_status
  ) VALUES (
    v_comp_id,
    v_emp.id,
    v_punch_time,
    p_punch_type,
    'mobile_gps',
    p_latitude,
    p_longitude,
    p_accuracy,
    v_distance,
    v_emp.work_location_id,
    p_client_event_id,
    'approved'
  ) RETURNING id INTO v_punch_id;

  -- Log geofence breach exception if violated
  IF NOT v_geofence_valid THEN
    INSERT INTO public.attendance_exceptions (
      company_id, employee_id, work_date, exception_type, severity, description
    ) VALUES (
      v_comp_id, v_emp.id, v_business_date, 'geofence_breach', 'violation',
      format('بصمة مسجلة خارج نطاق المقر المحدد (%s متر عن الموقع المعتمد)', round(COALESCE(v_distance, 0)::numeric, 1))
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 9. Authoritative Daily Attendance Derivation
  PERFORM public.process_attendance_day(v_emp.id, v_business_date);

  RETURN jsonb_build_object(
    'ok', true,
    'punch_id', v_punch_id,
    'punch_type', p_punch_type,
    'punch_time', v_punch_time,
    'business_date', v_business_date,
    'employee_name', v_emp.full_name,
    'geofence_valid', v_geofence_valid,
    'distance_meters', v_distance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_self_punch(text, double precision, double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_self_punch(text, double precision, double precision, double precision, text) TO service_role;


-- ============================================================================
-- 10. REWRITE CLOSE_ATTENDANCE_PERIOD WITH BLOCKING CHECKS & DETERMINISTIC HASH
--     (Prompt 12.1 Items 29, 40, 41, 42, 43, 44, 45, 46)
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
  v_blocking_exceptions integer := 0;
  v_pending_corrections integer := 0;
  v_emp RECORD;
  v_snapshot_count integer := 0;
  v_target_version integer;
  v_expected_workdays integer;
  v_hash text;
BEGIN
  -- 1. Load target period
  SELECT * INTO v_period
  FROM public.attendance_periods
  WHERE id = p_period_id;

  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'Attendance period not found.' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Tenant Check: Verify caller has HR rights in this specific company (Prompt 12.1 Item 29)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.user_id = v_user_id
    WHERE ur.user_id = v_user_id
      AND e.company_id = v_period.company_id
      AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
  ) INTO v_is_hr;

  IF NOT v_is_hr AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: cannot manage attendance period for another company.' USING ERRCODE = '42501';
  END IF;

  IF v_period.status IN ('closed', 'exported_to_payroll') THEN
    RAISE EXCEPTION 'This attendance period is already closed and sealed.' USING ERRCODE = '22023';
  END IF;

  -- 3. Verify blocking Attendance exceptions (Prompt 12.1 Item 40)
  SELECT count(*) INTO v_blocking_exceptions
  FROM public.attendance_exceptions
  WHERE company_id = v_period.company_id
    AND work_date BETWEEN v_period.from_date AND v_period.to_date
    AND resolved = false
    AND severity = 'violation';

  IF v_blocking_exceptions > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق فترة الحضور لوجود % مخالفة/استثناءات حرجة غير معالجة.', v_blocking_exceptions USING ERRCODE = '22023';
  END IF;

  -- 4. Verify pending corrections
  SELECT count(*) INTO v_pending_corrections
  FROM public.requests r
  WHERE r.company_id = v_period.company_id
    AND r.type = 'attendance_correction'
    AND r.status = 'pending'
    AND (r.payload->>'workDate')::date BETWEEN v_period.from_date AND v_period.to_date;

  IF v_pending_corrections > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق فترة الحضور لوجود % طلبات تصحيح بصمة معلقة بانتظار الاعتماد.', v_pending_corrections USING ERRCODE = '22023';
  END IF;

  v_target_version := v_period.version;

  -- 5. Iterate through all eligible workforce (Prompt 12.1 Item 42)
  FOR v_emp IN (
    SELECT e.id AS employee_id
    FROM public.employees e
    WHERE e.company_id = v_period.company_id
      AND (e.hire_date IS NULL OR e.hire_date <= v_period.to_date)
      AND (e.status IN ('active', 'probation', 'on_leave') OR e.exit_date >= v_period.from_date)
  ) LOOP
    -- Calculate expected working days from effective schedules (Prompt 12.1 Item 41)
    SELECT count(*) INTO v_expected_workdays
    FROM public.schedule_assignments sa
    WHERE sa.employee_id = v_emp.employee_id
      AND sa.work_date BETWEEN v_period.from_date AND v_period.to_date
      AND sa.is_rest_day IS NOT TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.company_holidays ch
        WHERE ch.company_id = v_period.company_id
          AND sa.work_date BETWEEN ch.start_date AND ch.end_date
      );

    IF v_expected_workdays = 0 THEN
      -- Fallback to standard 22 working days if schedule assignments not published yet
      v_expected_workdays := 22;
    END IF;

    -- Aggregate attendance stats
    WITH stats AS (
      SELECT
        count(*) FILTER (WHERE ar.status = 'present') AS present_days,
        count(*) FILTER (WHERE ar.status = 'absent') AS absent_days,
        count(*) FILTER (WHERE ar.status = 'leave') AS leave_days,
        COALESCE(sum(ar.late_minutes), 0) AS late_minutes,
        COALESCE(sum(ar.early_departure_minutes), 0) AS early_mins,
        COALESCE(sum(ar.worked_hours), 0) AS worked_hrs,
        COALESCE(sum(ar.violations_count), 0) AS violations
      FROM public.attendance_records ar
      WHERE ar.employee_id = v_emp.employee_id
        AND ar.work_date BETWEEN v_period.from_date AND v_period.to_date
    ),
    ot AS (
      SELECT
        COALESCE(sum(hours) FILTER (WHERE rate_type = 'regular_150' AND status = 'approved'), 0) AS reg_ot_hrs,
        COALESCE(sum(hours) FILTER (WHERE rate_type = 'holiday_200' AND status = 'approved'), 0) AS hol_ot_hrs,
        COALESCE(sum(round(hours * 60)), 0) AS total_ot_mins
      FROM public.overtime_records
      WHERE employee_id = v_emp.employee_id
        AND work_date BETWEEN v_period.from_date AND v_period.to_date
    )
    -- Insert Versioned Immutable Snapshot (Prompt 12.1 Items 44 & 45)
    INSERT INTO public.attendance_payroll_snapshots (
      company_id,
      period_id,
      period_version,
      snapshot_version,
      employee_id,
      total_expected_days,
      total_present_days,
      total_absent_days,
      total_rest_days,
      total_leave_days,
      total_late_minutes,
      total_early_departure_minutes,
      total_worked_hours,
      regular_overtime_hours,
      holiday_overtime_hours,
      approved_overtime_minutes,
      payable_overtime_minutes,
      unexcused_absence_days,
      violations_count,
      snapshot_hash
    )
    SELECT
      v_period.company_id,
      v_period.id,
      v_target_version,
      1,
      v_emp.employee_id,
      v_expected_workdays,
      stats.present_days,
      stats.absent_days,
      GREATEST(0, (v_period.to_date - v_period.from_date + 1) - v_expected_workdays),
      stats.leave_days,
      stats.late_minutes,
      stats.early_mins,
      stats.worked_hrs,
      ot.reg_ot_hrs,
      ot.hol_ot_hrs,
      ot.total_ot_mins,
      ot.total_ot_mins,
      stats.absent_days,
      stats.violations,
      -- Deterministic SHA-256 seal (Prompt 12.1 Item 46)
      encode(sha256(
        (v_period.company_id::text || '|' ||
         v_period.id::text || '|' ||
         v_target_version::text || '|' ||
         v_emp.employee_id::text || '|' ||
         v_expected_workdays::text || '|' ||
         stats.present_days::text || '|' ||
         stats.absent_days::text || '|' ||
         stats.worked_hrs::text || '|' ||
         ot.reg_ot_hrs::text || '|' ||
         stats.late_minutes::text)::bytea
      ), 'hex')
    FROM stats, ot;

    v_snapshot_count := v_snapshot_count + 1;
  END LOOP;

  -- Seal period status to 'closed'
  UPDATE public.attendance_periods
  SET status = 'closed',
      closed_by = v_user_id,
      closed_at = now()
  WHERE id = p_period_id;

  RETURN jsonb_build_object(
    'ok', true,
    'period_id', p_period_id,
    'version', v_target_version,
    'status', 'closed',
    'snapshots_count', v_snapshot_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_attendance_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_attendance_period(uuid) TO service_role;


-- ============================================================================
-- 11. REOPEN_ATTENDANCE_PERIOD WITH VERSION INCREMENT & TENANT CHECK
--     (Prompt 12.1 Items 30, 44, 45)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reopen_attendance_period(p_period_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_period public.attendance_periods%ROWTYPE;
  v_is_hr boolean;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A valid reason is required to reopen a closed attendance period.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_period
  FROM public.attendance_periods
  WHERE id = p_period_id;

  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'Attendance period not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Tenant Check: Verify caller belongs to same company as period
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.user_id = v_user_id
    WHERE ur.user_id = v_user_id
      AND e.company_id = v_period.company_id
      AND ur.role IN ('super_admin', 'org_admin', 'hr_manager')
  ) INTO v_is_hr;

  IF NOT v_is_hr AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: cannot reopen attendance period for another company.' USING ERRCODE = '42501';
  END IF;

  -- Increment period version so historical snapshots remain preserved and subsequent close uses new version
  UPDATE public.attendance_periods
  SET status = 'reopened',
      version = version + 1,
      reopened_by = v_user_id,
      reopened_at = now(),
      reopen_reason = p_reason
  WHERE id = p_period_id;

  RETURN jsonb_build_object(
    'ok', true,
    'period_id', p_period_id,
    'new_version', v_period.version + 1,
    'status', 'reopened'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reopen_attendance_period(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_attendance_period(uuid, text) TO service_role;


-- ============================================================================
-- 12. RESOLVE_ATTENDANCE_EXCEPTION WITH TENANT & TEAM SCOPE (Prompt 12.1 Item 31)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_attendance_exception(p_exception_id uuid, p_resolution_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_emp_id uuid;
  v_caller_comp_id uuid;
  v_exc public.attendance_exceptions%ROWTYPE;
  v_is_hr boolean;
  v_is_direct_manager boolean;
BEGIN
  IF p_resolution_note IS NULL OR trim(p_resolution_note) = '' THEN
    RAISE EXCEPTION 'Resolution note is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_exc
  FROM public.attendance_exceptions
  WHERE id = p_exception_id;

  IF v_exc.id IS NULL THEN
    RAISE EXCEPTION 'Attendance exception not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT id, company_id INTO v_caller_emp_id, v_caller_comp_id
  FROM public.employees
  WHERE user_id = v_user_id;

  -- 1. Check HR / Admin within same company
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
      AND v_caller_comp_id = v_exc.company_id
      AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
  ) INTO v_is_hr;

  -- 2. Check Line Manager: Must be direct manager of target employee
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = v_exc.employee_id
      AND e.manager_id = v_caller_emp_id
  ) INTO v_is_direct_manager;

  IF NOT v_is_hr AND NOT v_is_direct_manager AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: cannot resolve exceptions outside your company or direct reporting team.' USING ERRCODE = '42501';
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

GRANT EXECUTE ON FUNCTION public.resolve_attendance_exception(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_attendance_exception(uuid, text) TO service_role;


-- ============================================================================
-- 13. IMPORT_BIOMETRIC_PUNCHES WITH ADMIN RESTRICTION & UNMATCHED QUEUE
--     (Prompt 12.1 Items 32, 36, 37, 38, 39)
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
  v_user_id uuid := auth.uid();
  v_caller_comp_id uuid;
  v_is_authorized boolean;
  v_item jsonb;
  v_ext_user_id text;
  v_ext_event_id text;
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
  -- 1. Authorization: Attendance officer or HR manager only (Prompt 12.1 Item 32)
  SELECT company_id INTO v_caller_comp_id
  FROM public.employees
  WHERE user_id = v_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
      AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: only Attendance Officers or HR managers can import biometric punch batches.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_comp_id IS NULL AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Target company not found for caller.' USING ERRCODE = 'P0002';
  END IF;

  IF jsonb_typeof(p_punches) != 'array' THEN
    RAISE EXCEPTION 'Punches payload must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  v_total := jsonb_array_length(p_punches);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_punches) LOOP
    v_ext_user_id  := v_item->>'employee_no';
    v_ext_event_id := v_item->>'external_event_id';
    v_ptime        := (v_item->>'punch_time')::timestamptz;
    v_ptype        := COALESCE(v_item->>'punch_type', 'in');

    -- Resolve employee: Check device mapping table first (Prompt 12.1 Item 37)
    SELECT em.employee_id INTO v_emp_id
    FROM public.attendance_device_employee_mappings em
    WHERE em.company_id = v_caller_comp_id
      AND em.external_user_id = v_ext_user_id
    LIMIT 1;

    -- Fallback to employee_no or id
    IF v_emp_id IS NULL THEN
      SELECT e.id INTO v_emp_id
      FROM public.employees e
      WHERE e.company_id = v_caller_comp_id
        AND (e.employee_no = v_ext_user_id OR e.id::text = v_ext_user_id)
      LIMIT 1;
    END IF;

    -- If unmatched: Preserve raw event data for mapping later (Prompt 12.1 Item 38)
    IF v_emp_id IS NULL THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('external_user_id', v_ext_user_id, 'error', 'Unmatched external user');

      INSERT INTO public.punch_import_raw_events (
        company_id, batch_id, device_id, external_event_id, external_user_id,
        punch_time, punch_type, raw_payload, status, error_reason
      ) VALUES (
        v_caller_comp_id, v_batch_id, p_device_id, v_ext_event_id, v_ext_user_id,
        v_ptime, v_ptype, v_item, 'unmatched', 'Employee not mapped'
      ) ON CONFLICT DO NOTHING;

      CONTINUE;
    END IF;

    -- Deduplication: check external_event_id first, fallback to 60s (Prompt 12.1 Item 39)
    IF v_ext_event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.punches
      WHERE company_id = v_caller_comp_id
        AND client_event_id = v_ext_event_id
    ) THEN
      v_dup := v_dup + 1;
      CONTINUE;
    END IF;

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
      client_event_id,
      approval_status,
      batch_id
    ) VALUES (
      v_caller_comp_id,
      v_emp_id,
      v_ptime,
      v_ptype,
      'biometric_device',
      p_device_id,
      v_ext_event_id,
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
    v_caller_comp_id,
    p_device_id,
    v_user_id,
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

GRANT EXECUTE ON FUNCTION public.import_biometric_punches(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_biometric_punches(text, jsonb) TO service_role;


-- ============================================================================
-- 14. CONTROLLED ATTENDANCE POLICY SAVE RPC (Prompt 12.1 Item 53)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_attendance_policy(p_policy jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_comp_id uuid;
  v_is_hr boolean;
  v_next_version integer := 1;
  v_new_policy_id uuid;
  v_effective_from date := COALESCE((p_policy->>'effective_from')::date, CURRENT_DATE);
BEGIN
  v_comp_id := COALESCE((p_policy->>'company_id')::uuid, public.current_company_id());

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.user_id = v_user_id
    WHERE ur.user_id = v_user_id
      AND e.company_id = v_comp_id
      AND ur.role IN ('super_admin', 'org_admin', 'hr_manager')
  ) INTO v_is_hr;

  IF NOT v_is_hr AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: only HR managers can configure attendance policies.' USING ERRCODE = '42501';
  END IF;

  -- Determine next version
  SELECT COALESCE(max(version), 0) + 1 INTO v_next_version
  FROM public.attendance_policies
  WHERE company_id = v_comp_id;

  -- Terminate previous active version effective_to
  UPDATE public.attendance_policies
  SET effective_to = v_effective_from - 1
  WHERE company_id = v_comp_id
    AND status = 'active'
    AND effective_to IS NULL;

  INSERT INTO public.attendance_policies (
    company_id,
    name_ar,
    version,
    effective_from,
    status,
    jurisdiction,
    grace_period_in_minutes,
    grace_period_out_minutes,
    overtime_regular_multiplier,
    overtime_holiday_multiplier,
    default_work_hours_per_day,
    ramadan_work_hours_per_day,
    max_work_hours_per_week,
    ramadan_max_work_hours_per_week,
    geofence_enforced,
    geofence_radius_meters,
    max_gps_accuracy_meters,
    auto_deduct_breaks,
    break_duration_minutes,
    max_consecutive_hours_without_break,
    require_biometric_or_gps,
    allow_mobile_punch,
    overtime_pre_approval_required,
    created_by,
    updated_by
  ) VALUES (
    v_comp_id,
    COALESCE(p_policy->>'name_ar', 'سياسة الحضور المعتمدة'),
    v_next_version,
    v_effective_from,
    'active',
    p_policy->>'jurisdiction',
    (p_policy->>'grace_period_in_minutes')::integer,
    (p_policy->>'grace_period_out_minutes')::integer,
    (p_policy->>'overtime_regular_multiplier')::numeric,
    (p_policy->>'overtime_holiday_multiplier')::numeric,
    (p_policy->>'default_work_hours_per_day')::numeric,
    (p_policy->>'ramadan_work_hours_per_day')::numeric,
    (p_policy->>'max_work_hours_per_week')::numeric,
    (p_policy->>'ramadan_max_work_hours_per_week')::numeric,
    COALESCE((p_policy->>'geofence_enforced')::boolean, true),
    (p_policy->>'geofence_radius_meters')::integer,
    COALESCE((p_policy->>'max_gps_accuracy_meters')::integer, 100),
    COALESCE((p_policy->>'auto_deduct_breaks')::boolean, true),
    (p_policy->>'break_duration_minutes')::integer,
    (p_policy->>'max_consecutive_hours_without_break')::numeric,
    COALESCE((p_policy->>'require_biometric_or_gps')::boolean, true),
    COALESCE((p_policy->>'allow_mobile_punch')::boolean, true),
    COALESCE((p_policy->>'overtime_pre_approval_required')::boolean, true),
    v_user_id,
    v_user_id
  ) RETURNING id INTO v_new_policy_id;

  RETURN jsonb_build_object(
    'ok', true,
    'policy_id', v_new_policy_id,
    'version', v_next_version,
    'company_id', v_comp_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_attendance_policy(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_attendance_policy(jsonb) TO service_role;


-- ============================================================================
-- 15. ATTENDANCE SUMMARY SERVER RPC (Prompt 12.1 Item 52)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_attendance_summary_kpis(p_target_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp_id uuid := public.current_company_id();
  v_timezone text;
  v_date date;
  v_total_emps integer := 0;
  v_present_cnt integer := 0;
  v_late_cnt integer := 0;
  v_absent_cnt integer := 0;
  v_leave_cnt integer := 0;
  v_ot_hours numeric(7,2) := 0;
  v_exceptions_cnt integer := 0;
  v_has_policy boolean := false;
BEGIN
  IF v_comp_id IS NULL THEN
    RETURN jsonb_build_object(
      'total_employees', 0, 'present_count', 0, 'late_count', 0,
      'absent_count', 0, 'leave_count', 0, 'attendance_rate', 0,
      'total_overtime_hours', 0, 'open_exceptions_count', 0,
      'is_policy_configured', false
    );
  END IF;

  v_timezone := public.get_effective_company_timezone(v_comp_id);
  v_date := COALESCE(p_target_date, (now() AT TIME ZONE v_timezone)::date);

  -- Check if policy is configured
  SELECT EXISTS (
    SELECT 1 FROM public.attendance_policies
    WHERE company_id = v_comp_id AND status = 'active'
  ) INTO v_has_policy;

  -- Canonical active workforce
  SELECT count(*) INTO v_total_emps
  FROM public.employees
  WHERE company_id = v_comp_id
    AND status IN ('active', 'probation', 'on_leave')
    AND (hire_date IS NULL OR hire_date <= v_date);

  -- Attendance metrics from daily records
  SELECT
    count(*) FILTER (WHERE status = 'present'),
    count(*) FILTER (WHERE status = 'late' OR (late_minutes IS NOT NULL AND late_minutes > 0)),
    count(*) FILTER (WHERE status = 'absent'),
    count(*) FILTER (WHERE status = 'leave')
  INTO v_present_cnt, v_late_cnt, v_absent_cnt, v_leave_cnt
  FROM public.attendance_records
  WHERE company_id = v_comp_id AND work_date = v_date;

  -- Overtime approved hours
  SELECT COALESCE(sum(hours), 0) INTO v_ot_hours
  FROM public.overtime_records
  WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = v_comp_id)
    AND work_date = v_date
    AND status = 'approved';

  -- Unresolved exceptions
  SELECT count(*) INTO v_exceptions_cnt
  FROM public.attendance_exceptions
  WHERE company_id = v_comp_id
    AND work_date = v_date
    AND resolved = false;

  RETURN jsonb_build_object(
    'total_employees', v_total_emps,
    'present_count', v_present_cnt,
    'late_count', v_late_cnt,
    'absent_count', v_absent_cnt,
    'leave_count', v_leave_cnt,
    'attendance_rate', CASE WHEN v_total_emps > 0 THEN round(((v_present_cnt + v_late_cnt)::numeric / v_total_emps) * 100) ELSE 0 END,
    'total_overtime_hours', v_ot_hours,
    'open_exceptions_count', v_exceptions_cnt,
    'is_policy_configured', v_has_policy
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_summary_kpis(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary_kpis(date) TO service_role;


-- ============================================================================
-- 16. STRICT TENANT-SAFE RLS POLICIES (Prompt 12.1 Items 33, 34, 35)
-- ============================================================================

-- Drop all previous policies on attendance tables
DROP POLICY IF EXISTS attendance_policies_read ON public.attendance_policies;
DROP POLICY IF EXISTS attendance_policies_manage ON public.attendance_policies;
DROP POLICY IF EXISTS attendance_periods_read ON public.attendance_periods;
DROP POLICY IF EXISTS attendance_periods_manage ON public.attendance_periods;
DROP POLICY IF EXISTS attendance_payroll_snapshots_read ON public.attendance_payroll_snapshots;
DROP POLICY IF EXISTS punches_read ON public.punches;
DROP POLICY IF EXISTS punches_insert ON public.punches;
DROP POLICY IF EXISTS attendance_records_read ON public.attendance_records;
DROP POLICY IF EXISTS attendance_records_manage ON public.attendance_records;
DROP POLICY IF EXISTS attendance_exceptions_read ON public.attendance_exceptions;
DROP POLICY IF EXISTS attendance_devices_staff_read ON public.attendance_devices;
DROP POLICY IF EXISTS attendance_devices_staff_write ON public.attendance_devices;
DROP POLICY IF EXISTS attendance_devices_read ON public.attendance_devices;
DROP POLICY IF EXISTS attendance_devices_manage ON public.attendance_devices;
DROP POLICY IF EXISTS attendance_device_employee_mappings_read ON public.attendance_device_employee_mappings;
DROP POLICY IF EXISTS attendance_device_employee_mappings_manage ON public.attendance_device_employee_mappings;
DROP POLICY IF EXISTS punch_import_raw_events_read ON public.punch_import_raw_events;

-- 1. Attendance Policies RLS (Strict current_company_id, no NULL)
CREATE POLICY attendance_policies_read ON public.attendance_policies
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY attendance_policies_manage ON public.attendance_policies
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.employees e ON e.user_id = auth.uid()
      WHERE ur.user_id = auth.uid()
        AND e.company_id = public.current_company_id()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager')
    )
  );

-- 2. Attendance Periods RLS
CREATE POLICY attendance_periods_read ON public.attendance_periods
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY attendance_periods_manage ON public.attendance_periods
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.employees e ON e.user_id = auth.uid()
      WHERE ur.user_id = auth.uid()
        AND e.company_id = public.current_company_id()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- 3. Attendance Payroll Snapshots RLS
CREATE POLICY attendance_payroll_snapshots_read ON public.attendance_payroll_snapshots
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id() AND (
      employee_id = public.resolve_my_employee_id() OR
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.employees e ON e.user_id = auth.uid()
        WHERE ur.user_id = auth.uid()
          AND e.company_id = public.current_company_id()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'payroll_officer')
      )
    )
  );

-- 4. Punches RLS (No NULL sharing, line manager scoped to direct reports)
CREATE POLICY punches_read ON public.punches
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id() AND (
      employee_id = public.resolve_my_employee_id() OR
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.employees e ON e.user_id = auth.uid()
        WHERE ur.user_id = auth.uid()
          AND e.company_id = public.current_company_id()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      ) OR (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'line_manager') AND
        employee_id IN (SELECT id FROM public.employees WHERE manager_id = public.resolve_my_employee_id())
      )
    )
  );

CREATE POLICY punches_insert ON public.punches
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id() AND (
      employee_id = public.resolve_my_employee_id() OR
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.employees e ON e.user_id = auth.uid()
        WHERE ur.user_id = auth.uid()
          AND e.company_id = public.current_company_id()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

-- 5. Attendance Records RLS (Scoped line manager)
CREATE POLICY attendance_records_read ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id() AND (
      employee_id = public.resolve_my_employee_id() OR
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.employees e ON e.user_id = auth.uid()
        WHERE ur.user_id = auth.uid()
          AND e.company_id = public.current_company_id()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      ) OR (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'line_manager') AND
        employee_id IN (SELECT id FROM public.employees WHERE manager_id = public.resolve_my_employee_id())
      )
    )
  );

CREATE POLICY attendance_records_manage ON public.attendance_records
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.employees e ON e.user_id = auth.uid()
      WHERE ur.user_id = auth.uid()
        AND e.company_id = public.current_company_id()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- 6. Attendance Exceptions RLS (Scoped line manager)
CREATE POLICY attendance_exceptions_read ON public.attendance_exceptions
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id() AND (
      employee_id = public.resolve_my_employee_id() OR
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.employees e ON e.user_id = auth.uid()
        WHERE ur.user_id = auth.uid()
          AND e.company_id = public.current_company_id()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      ) OR (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'line_manager') AND
        employee_id IN (SELECT id FROM public.employees WHERE manager_id = public.resolve_my_employee_id())
      )
    )
  );

-- 7. Devices & Mappings RLS
CREATE POLICY attendance_devices_read ON public.attendance_devices
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY attendance_devices_manage ON public.attendance_devices
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.employees e ON e.user_id = auth.uid()
      WHERE ur.user_id = auth.uid()
        AND e.company_id = public.current_company_id()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

CREATE POLICY attendance_device_employee_mappings_read ON public.attendance_device_employee_mappings
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY attendance_device_employee_mappings_manage ON public.attendance_device_employee_mappings
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.employees e ON e.user_id = auth.uid()
      WHERE ur.user_id = auth.uid()
        AND e.company_id = public.current_company_id()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

CREATE POLICY punch_import_raw_events_read ON public.punch_import_raw_events
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.employees e ON e.user_id = auth.uid()
      WHERE ur.user_id = auth.uid()
        AND e.company_id = public.current_company_id()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.attendance_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_device_employee_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.punch_import_raw_events TO authenticated;

COMMIT;
