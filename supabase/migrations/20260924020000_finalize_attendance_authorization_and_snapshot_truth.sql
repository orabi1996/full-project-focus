-- ============================================================================
-- MIGRATION: 20260924020000_finalize_attendance_authorization_and_snapshot_truth.sql
-- DESCRIPTION: Prompt 12.2 Final Attendance Security + Payroll Snapshot Closure
--              - P0 Authorization on process_attendance_day (self, HR admin, line manager, service_role)
--              - P0 Authorization on process_company_attendance_range (prevent cross-tenant execution)
--              - Safe process_my_attendance_day wrapper
--              - Eliminates 22-day fallback in close_attendance_period (fails truthfully on missing schedule)
--              - Calculates authoritative expected_work_minutes and neutral overtime in snapshots
--              - Eliminates 100m GPS default; introduces explicit gps_accuracy_action (reject, flag, allow)
--              - Eliminates 200m Geofence default; persists geofence_valid on punches; replayed truthfully
--              - Policy save requires explicit booleans, validates payload first, and prevents temporal overlap
--              - Restricts attendance_devices, mappings, and raw import events to HR/Attendance admins
--              - Batch import deduplication prioritizes external_event_id over 60s heuristic
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ATTENDANCE POLICIES SCHEMA HARDENING & ACCURACY ACTIONS
-- ============================================================================

ALTER TABLE public.attendance_policies
  ADD COLUMN IF NOT EXISTS gps_accuracy_action text NOT NULL DEFAULT 'flag'
  CHECK (gps_accuracy_action IN ('reject', 'flag', 'allow'));

-- Drop default on max_gps_accuracy_meters to ensure no silent 100m assumption
ALTER TABLE public.attendance_policies
  ALTER COLUMN max_gps_accuracy_meters DROP DEFAULT;


-- ============================================================================
-- 2. PUNCHES TABLE HARDENING (PERSIST GEOFENCE VALIDITY & POLICY LINK)
-- ============================================================================

ALTER TABLE public.punches
  ADD COLUMN IF NOT EXISTS geofence_valid boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.attendance_policies(id) ON DELETE SET NULL;


-- ============================================================================
-- 3. PAYROLL SNAPSHOTS HARDENING (NEUTRAL OVERTIME & EXPECTED MINUTES)
-- ============================================================================

ALTER TABLE public.attendance_payroll_snapshots
  ADD COLUMN IF NOT EXISTS expected_work_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_overtime_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_categories jsonb DEFAULT '{}'::jsonb;


-- ============================================================================
-- 4. ATTENDANCE EXCEPTIONS EXPANSION
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
    'duplicate_out',
    'policy_not_configured',
    'timezone_not_configured',
    'schedule_not_configured'
  ));


-- ============================================================================
-- 5. MIGRATE LEGACY OVERTIME RATE TYPES TO NEUTRAL CATEGORIES
-- ============================================================================

ALTER TABLE public.overtime_records
  ALTER COLUMN rate_type SET DEFAULT 'standard';

UPDATE public.overtime_records
SET rate_type = 'standard'
WHERE rate_type = 'regular_150';

UPDATE public.overtime_records
SET rate_type = 'holiday_or_rest_day'
WHERE rate_type = 'holiday_200';


-- ============================================================================
-- 6. TEMPORAL OVERLAP PROTECTION FOR ATTENDANCE POLICIES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_attendance_policy_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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


-- ============================================================================
-- 7. REWRITE SAVE_ATTENDANCE_POLICY WITH STRICT PRE-VALIDATION & NO DEFAULTS
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
  -- 1. Authorization check
  v_comp_id := COALESCE((p_policy->>'company_id')::uuid, public.current_company_id());
  IF v_comp_id IS NULL THEN
    RAISE EXCEPTION 'معرف الشركة غير محدد.' USING ERRCODE = '22023';
  END IF;

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

  -- 2. Validate Payload FIRST before modifying any existing records
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

  -- Require explicit business policy booleans (Prompt 12.2 Item 15)
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

  -- Optional / Explicit GPS Accuracy Action
  v_gps_accuracy_action := COALESCE(p_policy->>'gps_accuracy_action', 'flag');
  IF v_gps_accuracy_action NOT IN ('reject', 'flag', 'allow') THEN
    RAISE EXCEPTION 'إجراء دقة GPS غير صالح: يجب أن يكون reject أو flag أو allow.' USING ERRCODE = '22023';
  END IF;

  v_max_gps_acc := (p_policy->>'max_gps_accuracy_meters')::integer;
  v_geofence_radius := (p_policy->>'geofence_radius_meters')::integer;

  IF v_geofence_enforced IS TRUE AND v_geofence_radius IS NOT NULL AND v_geofence_radius <= 0 THEN
    RAISE EXCEPTION 'نصف قطر النطاق الجغرافي يجب أن يكون أكبر من الصفر.' USING ERRCODE = '22023';
  END IF;

  -- 3. Temporal Overlap Check (Prompt 12.2 Item 17)
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

  -- 4. Determine next version
  SELECT COALESCE(max(version), 0) + 1 INTO v_next_version
  FROM public.attendance_policies
  WHERE company_id = v_comp_id;

  -- Archive or close previous active versions atomically
  UPDATE public.attendance_policies
  SET status = 'archived',
      effective_to = v_effective_from,
      updated_at = now(),
      updated_by = v_user_id
  WHERE company_id = v_comp_id
    AND status = 'active'
    AND effective_from >= v_effective_from;

  UPDATE public.attendance_policies
  SET effective_to = v_effective_from - 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE company_id = v_comp_id
    AND status = 'active'
    AND effective_to IS NULL
    AND effective_from < v_effective_from;

  -- 5. Insert new validated version
  INSERT INTO public.attendance_policies (
    company_id,
    name_ar,
    version,
    effective_from,
    effective_to,
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
    gps_accuracy_action,
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
    v_name_ar,
    v_next_version,
    v_effective_from,
    v_effective_to,
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
    v_geofence_enforced,
    v_geofence_radius,
    v_max_gps_acc,
    v_gps_accuracy_action,
    v_auto_deduct_breaks,
    (p_policy->>'break_duration_minutes')::integer,
    (p_policy->>'max_consecutive_hours_without_break')::numeric,
    v_require_biometric_or_gps,
    v_allow_mobile_punch,
    v_overtime_pre_approval_required,
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


-- ============================================================================
-- 8. REWRITE RECORD_SELF_PUNCH (EXPLICIT GPS/GEOFENCE TRUTHFULNESS & REPLAY)
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
  v_punch_time timestamptz := clock_timestamp();
  v_business_date date;
  v_distance double precision := NULL;
  v_geofence_valid boolean := true;
  v_loc_lat double precision;
  v_loc_lon double precision;
  v_loc_radius integer := NULL;
  v_policy public.attendance_policies%ROWTYPE;
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

  -- 3. Idempotency Check: Return STORED authoritative geofence_valid (Prompt 12.2 Item 12)
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
        'geofence_valid', COALESCE(v_existing_punch.geofence_valid, true),
        'distance_meters', v_existing_punch.distance_from_location_meters
      );
    END IF;
  END IF;

  -- 4. Company Timezone Resolution
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

  -- 6. GPS Accuracy Policy Validation (Prompt 12.2 Item 10 & 14 - NO 100m fallback)
  IF v_policy.id IS NOT NULL AND v_policy.max_gps_accuracy_meters IS NOT NULL AND p_accuracy IS NOT NULL THEN
    IF p_accuracy > v_policy.max_gps_accuracy_meters THEN
      IF v_policy.gps_accuracy_action = 'reject' THEN
        RAISE EXCEPTION '%', format('دقة إحداثيات GPS ضعيفة (%s م) وتتجاوز الحد الأقصى المسموح به في سياسة الشركة (%s م).', round(p_accuracy::numeric, 1), v_policy.max_gps_accuracy_meters) USING ERRCODE = '22023';
      ELSIF v_policy.gps_accuracy_action = 'flag' THEN
        INSERT INTO public.attendance_exceptions (
          company_id, employee_id, work_date, exception_type, severity, description
        ) VALUES (
          v_comp_id, v_emp.id, v_business_date, 'low_gps_accuracy', 'warning',
          format('دقة إحداثيات GPS ضعيفة (%s م) وتتجاوز الحد المسموح بالسياسة (%s م)', round(p_accuracy::numeric, 1), v_policy.max_gps_accuracy_meters)
        ) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- 7. Geofence Evaluation — Strictly Assigned Work Location (Prompt 12.2 Item 11 - NO 200m fallback)
  IF v_policy.id IS NOT NULL AND v_policy.geofence_enforced IS TRUE THEN
    IF v_emp.work_location_id IS NOT NULL THEN
      SELECT latitude, longitude, radius_meters
      INTO v_loc_lat, v_loc_lon, v_loc_radius
      FROM public.work_locations
      WHERE id = v_emp.work_location_id AND company_id = v_comp_id;
    END IF;

    IF v_loc_radius IS NULL THEN
      v_loc_radius := v_policy.geofence_radius_meters;
    END IF;

    IF v_loc_radius IS NULL THEN
      RAISE EXCEPTION 'خاصية النطاق الجغرافي مفعلة بالسياسة ولكن لم يتم تحديد نصف القطر (radius_meters) للمقر أو السياسة.' USING ERRCODE = '22023';
    END IF;

    IF v_emp.work_location_id IS NULL THEN
      v_geofence_valid := false;
    ELSIF v_loc_lat IS NOT NULL AND v_loc_lon IS NOT NULL AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
      v_distance := public.haversine_distance_meters(v_loc_lat, v_loc_lon, p_latitude, p_longitude);
      IF v_distance > v_loc_radius THEN
        v_geofence_valid := false;
      END IF;
    ELSE
      v_geofence_valid := false;
    END IF;
  ELSE
    -- Geofence not enforced by policy: calculate distance purely as diagnostic metadata if coords exist
    IF v_emp.work_location_id IS NOT NULL THEN
      SELECT latitude, longitude INTO v_loc_lat, v_loc_lon
      FROM public.work_locations
      WHERE id = v_emp.work_location_id AND company_id = v_comp_id;

      IF v_loc_lat IS NOT NULL AND v_loc_lon IS NOT NULL AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
        v_distance := public.haversine_distance_meters(v_loc_lat, v_loc_lon, p_latitude, p_longitude);
      END IF;
    END IF;
    v_geofence_valid := true;
  END IF;

  -- 8. Insert Immutable Raw Punch (Prompt 12.2 Item 13: Storing geofence_valid)
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
    approval_status,
    geofence_valid,
    policy_id
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
    'approved',
    v_geofence_valid,
    v_policy.id
  ) RETURNING id INTO v_punch_id;

  -- Log geofence breach exception if violated
  IF NOT v_geofence_valid THEN
    INSERT INTO public.attendance_exceptions (
      company_id, employee_id, work_date, exception_type, severity, description
    ) VALUES (
      v_comp_id, v_emp.id, v_business_date, 'geofence_breach', 'violation',
      format('بصمة مسجلة خارج نطاق المقر المحدد (%s متر عن الموقع المعتمد، المسموح: %s متر)', round(COALESCE(v_distance, 0)::numeric, 1), COALESCE(v_loc_radius, 0))
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 9. Daily Attendance Derivation (Only if policy exists; Item 28)
  IF v_policy.id IS NOT NULL THEN
    PERFORM public.process_attendance_day(v_emp.id, v_business_date);
  ELSE
    INSERT INTO public.attendance_exceptions (
      company_id, employee_id, work_date, exception_type, severity, description
    ) VALUES (
      v_comp_id, v_emp.id, v_business_date, 'policy_not_configured', 'violation',
      'تم تسجيل البصمة ولكن لم يتم اعتماد سجل الدوام لعدم وجود سياسة حضور وانصراف معتمدة'
    ) ON CONFLICT DO NOTHING;
  END IF;

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


-- ============================================================================
-- 9. REWRITE PROCESS_ATTENDANCE_DAY WITH STRICT P0 AUTHORIZATION & POLICY REQUIREMENT
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
  v_caller_user_id uuid := auth.uid();
  v_caller_role text := auth.role();
  v_my_emp_id uuid;
  v_caller_comp_id uuid;
  v_is_authorized boolean := false;
  v_emp RECORD;
  v_comp_id uuid;
  v_timezone text;
  v_company_today date;
  v_policy public.attendance_policies%ROWTYPE;
  v_period_status text;
  v_assignment RECORD;
  v_has_shift boolean := false;
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
  
  -- Shift boundaries and grace
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_grace_in integer := 0;
  v_grace_out integer := 0;
BEGIN
  -- 1. Resolve employee
  SELECT e.id, e.company_id, e.work_location_id, e.status, e.hire_date, e.manager_id
  INTO v_emp
  FROM public.employees e
  WHERE e.id = p_employee_id;

  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود.' USING ERRCODE = 'P0002';
  END IF;

  v_comp_id := v_emp.company_id;

  -- 2. Strict Authorization Check (Prompt 12.2 Item 1: P0)
  IF v_caller_role = 'service_role' THEN
    v_is_authorized := true;
  ELSIF v_caller_user_id IS NOT NULL THEN
    v_my_emp_id := public.resolve_my_employee_id();

    -- Case A: Employee self-processing
    IF v_my_emp_id IS NOT NULL AND v_my_emp_id = p_employee_id THEN
      v_is_authorized := true;
    END IF;

    -- Case B: HR / Attendance Admin for same company, or super_admin
    IF NOT v_is_authorized THEN
      SELECT company_id INTO v_caller_comp_id
      FROM public.employees
      WHERE user_id = v_caller_user_id;

      IF EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = v_caller_user_id
          AND ur.role = 'super_admin'
      ) THEN
        v_is_authorized := true;
      ELSIF EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = v_caller_user_id
          AND ur.role::text IN ('org_admin', 'hr_manager', 'attendance_officer')
      ) THEN
        IF v_caller_comp_id IS NOT NULL AND v_caller_comp_id = v_comp_id THEN
          v_is_authorized := true;
        END IF;
      END IF;
    END IF;

    -- Case D: Line manager for direct report (same company)
    IF NOT v_is_authorized AND v_my_emp_id IS NOT NULL THEN
      IF v_emp.manager_id = v_my_emp_id AND (v_caller_comp_id IS NULL OR v_caller_comp_id = v_comp_id) THEN
        IF EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = v_caller_user_id AND ur.role = 'line_manager'
        ) THEN
          v_is_authorized := true;
        END IF;
      END IF;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'غير مصرح لك بمعالجة سجلات الحضور لهذا الموظف.' USING ERRCODE = '42501';
  END IF;

  -- 3. Resolve company timezone
  v_timezone := public.get_effective_company_timezone(v_comp_id);
  IF v_timezone IS NULL THEN
    INSERT INTO public.attendance_exceptions (
      company_id, employee_id, work_date, exception_type, severity, description
    ) VALUES (
      v_comp_id, p_employee_id, p_business_date, 'timezone_not_configured', 'violation',
      'المنطقة الزمنية للمنشأة غير مهيأة بشكل صحيح'
    ) ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object('ok', false, 'error', 'timezone_not_configured');
  END IF;

  v_company_today := (now() AT TIME ZONE v_timezone)::date;

  -- 4. Check period lock
  SELECT status INTO v_period_status
  FROM public.attendance_periods
  WHERE company_id = v_comp_id
    AND p_business_date BETWEEN from_date AND to_date
    AND status IN ('closed', 'exported_to_payroll')
  LIMIT 1;

  IF v_period_status IN ('closed', 'exported_to_payroll') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'لا يمكن تعديل سجلات فترة حضور مغلقة ومختومة.' USING ERRCODE = '22023';
  END IF;

  -- 5. Resolve effective policy for this date (Prompt 12.2 Item 8: Policy must be required!)
  SELECT * INTO v_policy
  FROM public.attendance_policies
  WHERE company_id = v_comp_id
    AND status = 'active'
    AND effective_from <= p_business_date
    AND (effective_to IS NULL OR effective_to >= p_business_date)
  ORDER BY version DESC
  LIMIT 1;

  IF v_policy.id IS NULL THEN
    -- Item 8 & 9: Create policy_not_configured blocking exception and do NOT derive attendance
    INSERT INTO public.attendance_exceptions (
      company_id, employee_id, work_date, exception_type, severity, description
    ) VALUES (
      v_comp_id, p_employee_id, p_business_date, 'policy_not_configured', 'violation',
      'لم يتم إعداد سياسة حضور وانصراف معتمدة وسارية للشركة في هذا التاريخ'
    ) ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object(
      'ok', false,
      'error', 'policy_not_configured',
      'message', 'لم يتم إعداد سياسة حضور معتمدة وسارية للمنشأة في هذا التاريخ',
      'employee_id', p_employee_id,
      'work_date', p_business_date
    );
  END IF;

  v_grace_in := COALESCE(v_policy.grace_period_in_minutes, 0);
  v_grace_out := COALESCE(v_policy.grace_period_out_minutes, 0);

  -- 6. Resolve shift schedule assignment
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

  -- 7. Check company holiday
  SELECT EXISTS (
    SELECT 1 FROM public.company_holidays
    WHERE company_id = v_comp_id
      AND p_business_date BETWEEN start_date AND end_date
  ) INTO v_is_holiday;

  -- 8. Check approved leave
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

  -- 9. Define punch collection window
  IF v_has_shift AND COALESCE(v_assignment.is_overnight, false) THEN
    v_window_start := (p_business_date || ' ' || v_assignment.start_time)::timestamp AT TIME ZONE v_timezone - interval '4 hours';
    v_window_end   := ((p_business_date + 1) || ' ' || v_assignment.end_time)::timestamp AT TIME ZONE v_timezone + interval '6 hours';
  ELSE
    v_window_start := (p_business_date || ' 00:00:00')::timestamp AT TIME ZONE v_timezone - interval '2 hours';
    v_window_end   := (p_business_date || ' 23:59:59')::timestamp AT TIME ZONE v_timezone + interval '4 hours';
  END IF;

  -- 10. Fetch and pair raw punches
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

    IF v_punch.geofence_valid IS FALSE THEN
      v_geofence_valid := false;
    END IF;

    IF v_punch.punch_type = 'in' THEN
      IF v_first_in IS NULL THEN
        v_first_in := v_punch.local_time;
        v_check_in_punch_id := v_punch.id;
      END IF;

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
        v_worked_minutes := v_worked_minutes + round(EXTRACT(EPOCH FROM (v_punch.punch_time - v_current_in_time)) / 60.0)::integer;
        v_current_in_time := NULL;
      ELSE
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

  -- 11. Deduct break if policy configured
  IF v_policy.auto_deduct_breaks IS TRUE AND v_policy.break_duration_minutes IS NOT NULL THEN
    IF v_worked_minutes >= 300 THEN
      v_worked_minutes := GREATEST(0, v_worked_minutes - v_policy.break_duration_minutes);
    END IF;
  END IF;

  -- 12. Determine status and calculate lateness / early departure
  IF v_punches_count > 0 THEN
    v_status := 'present';

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
      v_status := 'present';
      v_worked_minutes := 0;
    ELSIF v_is_rest_day THEN
      v_status := 'present';
      v_worked_minutes := 0;
    ELSE
      IF p_business_date > v_company_today THEN
        RETURN jsonb_build_object('ok', true, 'status', 'future', 'date', p_business_date);
      ELSIF p_business_date < v_company_today THEN
        v_status := 'absent';
        v_violations_count := v_violations_count + 1;
        INSERT INTO public.attendance_exceptions (
          company_id, employee_id, work_date, exception_type, severity, description
        ) VALUES (
          v_comp_id, p_employee_id, p_business_date, 'unexcused_absence', 'violation',
          'غياب غير مبرر عن يوم عمل معتمد دون تسجيل أي حركة حضور أو تقديم إجازة'
        ) ON CONFLICT DO NOTHING;
      ELSE
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
            v_status := 'present';
          END IF;
        ELSE
          v_status := 'present';
        END IF;
      END IF;
    END IF;
  END IF;

  -- 13. Upsert daily attendance record idempotently
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


-- ============================================================================
-- 10. SAFE PROCESS_MY_ATTENDANCE_DAY WRAPPER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_my_attendance_day(
  p_business_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_emp_id uuid := public.resolve_my_employee_id();
  v_target_date date;
  v_timezone text;
  v_comp_id uuid;
BEGIN
  IF v_my_emp_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد ملف موظف مرتبط بحسابك الحالي.' USING ERRCODE = 'P0002';
  END IF;

  SELECT company_id INTO v_comp_id FROM public.employees WHERE id = v_my_emp_id;
  v_timezone := public.get_effective_company_timezone(v_comp_id);
  v_target_date := COALESCE(p_business_date, (now() AT TIME ZONE v_timezone)::date);

  RETURN public.process_attendance_day(v_my_emp_id, v_target_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_my_attendance_day(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_my_attendance_day(date) TO service_role;


-- ============================================================================
-- 11. REWRITE PROCESS_COMPANY_ATTENDANCE_RANGE WITH P0 TENANT PROTECTION
-- ============================================================================

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
  v_user_id uuid := auth.uid();
  v_caller_role text := auth.role();
  v_caller_comp_id uuid;
  v_target_comp_id uuid;
  v_is_authorized boolean := false;
  v_emp RECORD;
  v_curr_date date;
  v_count integer := 0;
BEGIN
  -- Strict internal authorization (Prompt 12.2 Item 2)
  IF v_caller_role = 'service_role' THEN
    v_is_authorized := true;
    v_target_comp_id := COALESCE(p_company_id, public.current_company_id());
  ELSIF v_user_id IS NOT NULL THEN
    SELECT company_id INTO v_caller_comp_id
    FROM public.employees
    WHERE user_id = v_user_id;

    IF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_user_id
        AND ur.role = 'super_admin'
    ) THEN
      v_is_authorized := true;
      v_target_comp_id := COALESCE(p_company_id, v_caller_comp_id, public.current_company_id());
    ELSIF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_user_id
        AND ur.role::text IN ('org_admin', 'hr_manager', 'attendance_officer')
    ) THEN
      v_target_comp_id := COALESCE(p_company_id, v_caller_comp_id, public.current_company_id());
      -- Cross-tenant protection: Caller's company must match target company!
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

  FOR v_emp IN (
    SELECT id FROM public.employees
    WHERE company_id = v_target_comp_id AND status IN ('active', 'probation', 'on_leave')
  ) LOOP
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


-- ============================================================================
-- 12. REWRITE CLOSE_ATTENDANCE_PERIOD (NO 22-DAY FALLBACK, EXPECTED MINUTES,
--     POLICY & SCHEDULE BLOCKERS, COMPLETENESS VERIFICATION)
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
  v_missing_policy_cnt integer := 0;
  v_missing_schedule_cnt integer := 0;
  v_unprocessed_days_cnt integer := 0;
  v_emp RECORD;
  v_snapshot_count integer := 0;
  v_target_version integer;
  v_expected_workdays integer;
  v_expected_work_minutes integer;
BEGIN
  -- 1. Load target period
  SELECT * INTO v_period
  FROM public.attendance_periods
  WHERE id = p_period_id;

  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'Attendance period not found.' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Tenant Check: Verify caller has HR rights in this specific company
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

  -- 3. Verify blocking Attendance exceptions (severity = 'violation')
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

  -- 5. Period Close Policy Check (Prompt 12.2 Item 21)
  -- Verify effective attendance policy covers this period
  SELECT count(*) INTO v_missing_policy_cnt
  FROM public.employees e
  WHERE e.company_id = v_period.company_id
    AND (e.hire_date IS NULL OR e.hire_date <= v_period.to_date)
    AND (e.status IN ('active', 'probation', 'on_leave') OR e.exit_date >= v_period.from_date)
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_policies ap
      WHERE ap.company_id = v_period.company_id
        AND ap.status = 'active'
        AND ap.effective_from <= v_period.to_date
        AND (ap.effective_to IS NULL OR ap.effective_to >= v_period.from_date)
    );

  IF v_missing_policy_cnt > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: لا توجد سياسة دوام معتمدة وسارية للمنشأة تغطي هذه الفترة.' USING ERRCODE = '22023';
  END IF;

  -- Verify valid company timezone exists
  IF public.get_effective_company_timezone(v_period.company_id) IS NULL THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: المنطقة الزمنية للمنشأة غير مهيأة.' USING ERRCODE = '22023';
  END IF;

  -- Verify published schedule assignments exist for every eligible workforce member (Item 21)
  SELECT count(DISTINCT e.id) INTO v_missing_schedule_cnt
  FROM public.employees e
  WHERE e.company_id = v_period.company_id
    AND (e.hire_date IS NULL OR e.hire_date <= v_period.to_date)
    AND (e.status IN ('active', 'probation', 'on_leave') OR e.exit_date >= v_period.from_date)
    AND NOT EXISTS (
      SELECT 1 FROM public.schedule_assignments sa
      WHERE sa.employee_id = e.id
        AND sa.work_date BETWEEN v_period.from_date AND v_period.to_date
    );

  IF v_missing_schedule_cnt > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: يوجد % موظف ليس لديهم جدول دوام معتمد ومنشور خلال هذه الفترة.', v_missing_schedule_cnt USING ERRCODE = '22023';
  END IF;

  -- 6. Processing Completeness Verification (Prompt 12.2 Item 22)
  -- Scheduled non-holiday workdays must be processed in attendance_records
  SELECT count(*) INTO v_unprocessed_days_cnt
  FROM public.schedule_assignments sa
  JOIN public.employees e ON e.id = sa.employee_id
  WHERE e.company_id = v_period.company_id
    AND (e.status IN ('active', 'probation', 'on_leave') OR e.exit_date >= v_period.from_date)
    AND sa.work_date BETWEEN v_period.from_date AND v_period.to_date
    AND sa.is_rest_day IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.company_holidays ch
      WHERE ch.company_id = v_period.company_id
        AND sa.work_date BETWEEN ch.start_date AND ch.end_date
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.employee_id = sa.employee_id AND ar.work_date = sa.work_date
    );

  IF v_unprocessed_days_cnt > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: يوجد % يوم عمل مجدول لم تتم معالجة حضوره بعد. يرجى تشغيل معالجة الحضور أولاً.', v_unprocessed_days_cnt USING ERRCODE = '22023';
  END IF;

  v_target_version := v_period.version;

  -- 7. Snapshot Generation with Neutral Overtime and Authoritative Expected Minutes (Prompt 12.2 Items 4, 5, 6, 23)
  FOR v_emp IN (
    SELECT e.id AS employee_id, e.full_name
    FROM public.employees e
    WHERE e.company_id = v_period.company_id
      AND (e.hire_date IS NULL OR e.hire_date <= v_period.to_date)
      AND (e.status IN ('active', 'probation', 'on_leave') OR e.exit_date >= v_period.from_date)
  ) LOOP
    -- Calculate expected working days and minutes from published schedules
    SELECT
      count(*),
      COALESCE(sum(
        CASE
          WHEN s.type = 'fixed' AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL THEN
            GREATEST(0,
              round(EXTRACT(EPOCH FROM (
                CASE
                  WHEN s.is_overnight IS TRUE THEN (('2000-01-02 ' || s.end_time)::timestamp - ('2000-01-01 ' || s.start_time)::timestamp)
                  ELSE (('2000-01-01 ' || s.end_time)::timestamp - ('2000-01-01 ' || s.start_time)::timestamp)
                END
              )) / 60.0)::integer - COALESCE(s.break_minutes, 0)
            )
          WHEN s.type = 'flexible' AND s.flexible_hours IS NOT NULL THEN
            round(s.flexible_hours * 60)::integer
          ELSE
            480
        END
      ), 0)
    INTO v_expected_workdays, v_expected_work_minutes
    FROM public.schedule_assignments sa
    LEFT JOIN public.shifts s ON s.id = sa.shift_id
    WHERE sa.employee_id = v_emp.employee_id
      AND sa.work_date BETWEEN v_period.from_date AND v_period.to_date
      AND sa.is_rest_day IS NOT TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.company_holidays ch
        WHERE ch.company_id = v_period.company_id
          AND sa.work_date BETWEEN ch.start_date AND ch.end_date
      );

    -- Prompt 12.2 Item 4: NO 22-DAY FALLBACK! Fails truthfully
    IF v_expected_workdays = 0 THEN
      RAISE EXCEPTION 'لا يمكن إغلاق الفترة لأن جدول الدوام غير منشور أو غير صالح للموظف % (معرف: %).', v_emp.full_name, v_emp.employee_id USING ERRCODE = '22023';
    END IF;

    -- Aggregate attendance stats & neutral overtime metrics
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
        COALESCE(sum(round(hours * 60)) FILTER (WHERE status = 'approved'), 0) AS approved_ot_mins,
        COALESCE(sum(round(hours * 60)), 0) AS actual_ot_mins,
        COALESCE(sum(round(hours * 60)) FILTER (WHERE status = 'approved'), 0) AS payable_ot_mins,
        COALESCE(sum(hours) FILTER (WHERE rate_type IN ('standard', 'regular_150') AND status = 'approved'), 0) AS reg_ot_hrs,
        COALESCE(sum(hours) FILTER (WHERE rate_type IN ('holiday_or_rest_day', 'holiday_200') AND status = 'approved'), 0) AS hol_ot_hrs,
        jsonb_build_object(
          'standard_minutes', COALESCE(sum(round(hours * 60)) FILTER (WHERE rate_type IN ('standard', 'regular_150') AND status = 'approved'), 0),
          'holiday_or_rest_minutes', COALESCE(sum(round(hours * 60)) FILTER (WHERE rate_type IN ('holiday_or_rest_day', 'holiday_200') AND status = 'approved'), 0)
        ) AS ot_categories
      FROM public.overtime_records
      WHERE employee_id = v_emp.employee_id
        AND work_date BETWEEN v_period.from_date AND v_period.to_date
    )
    INSERT INTO public.attendance_payroll_snapshots (
      company_id,
      period_id,
      period_version,
      snapshot_version,
      employee_id,
      total_expected_days,
      expected_work_minutes,
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
      actual_overtime_minutes,
      payable_overtime_minutes,
      overtime_categories,
      overtime_category,
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
      v_expected_work_minutes,
      stats.present_days,
      stats.absent_days,
      GREATEST(0, (v_period.to_date - v_period.from_date + 1) - v_expected_workdays),
      stats.leave_days,
      stats.late_minutes,
      stats.early_mins,
      stats.worked_hrs,
      ot.reg_ot_hrs,
      ot.hol_ot_hrs,
      ot.approved_ot_mins,
      ot.actual_ot_mins,
      ot.payable_ot_mins,
      ot.ot_categories,
      'standard',
      stats.absent_days,
      stats.violations,
      -- Deterministic SHA-256 seal including neutral metrics
      encode(sha256(
        (v_period.company_id::text || '|' ||
         v_period.id::text || '|' ||
         v_target_version::text || '|' ||
         v_emp.employee_id::text || '|' ||
         v_expected_workdays::text || '|' ||
         v_expected_work_minutes::text || '|' ||
         stats.present_days::text || '|' ||
         stats.absent_days::text || '|' ||
         stats.worked_hrs::text || '|' ||
         ot.approved_ot_mins::text || '|' ||
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


-- ============================================================================
-- 13. REWRITE IMPORT_BIOMETRIC_PUNCHES (DEDUPLICATION PRIORITIZES EXTERNAL ID)
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
  -- 1. Authorization
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

    -- Resolve employee from device mapping
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

    -- If unmatched: Preserve raw event data for mapping later
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

    -- Deduplication (Prompt 12.2 Item 20)
    -- Authoritative external ID check ONLY (no 60s heuristic applied over external ID)
    IF v_ext_event_id IS NOT NULL AND trim(v_ext_event_id) != '' THEN
      IF EXISTS (
        SELECT 1 FROM public.punches
        WHERE company_id = v_caller_comp_id
          AND client_event_id = trim(v_ext_event_id)
      ) OR EXISTS (
        SELECT 1 FROM public.punch_import_raw_events
        WHERE company_id = v_caller_comp_id
          AND device_id = p_device_id
          AND external_event_id = trim(v_ext_event_id)
          AND status = 'matched'
      ) THEN
        v_dup := v_dup + 1;
        CONTINUE;
      END IF;
    ELSE
      -- Fallback to 60-second heuristic ONLY when vendor supplies NO external event ID
      IF EXISTS (
        SELECT 1 FROM public.punches
        WHERE employee_id = v_emp_id
          AND abs(EXTRACT(EPOCH FROM (punch_time - v_ptime))) < 60
      ) THEN
        v_dup := v_dup + 1;
        CONTINUE;
      END IF;
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
      batch_id,
      geofence_valid
    ) VALUES (
      v_caller_comp_id,
      v_emp_id,
      v_ptime,
      v_ptype,
      'biometric_device',
      p_device_id,
      v_ext_event_id,
      'approved',
      v_batch_id,
      true
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


-- ============================================================================
-- 14. RESTRICT DEVICE MASTER & IMPORT RAW EVENTS TO ADMINS (Prompt 12.2 Items 18 & 19)
-- ============================================================================

-- Drop previous open read policies
DROP POLICY IF EXISTS attendance_devices_read ON public.attendance_devices;
DROP POLICY IF EXISTS attendance_devices_admin_read ON public.attendance_devices;
DROP POLICY IF EXISTS attendance_device_employee_mappings_read ON public.attendance_device_employee_mappings;
DROP POLICY IF EXISTS attendance_device_employee_mappings_admin_read ON public.attendance_device_employee_mappings;
DROP POLICY IF EXISTS punch_import_raw_events_read ON public.punch_import_raw_events;
DROP POLICY IF EXISTS punch_import_raw_events_admin_read ON public.punch_import_raw_events;

-- 1. Restricted Read on attendance_devices (Admins only)
CREATE POLICY attendance_devices_admin_read ON public.attendance_devices
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.employees e ON e.user_id = auth.uid()
      WHERE ur.user_id = auth.uid()
        AND e.company_id = public.current_company_id()
        AND ur.role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- 2. Restricted Read on attendance_device_employee_mappings (Admins only)
CREATE POLICY attendance_device_employee_mappings_admin_read ON public.attendance_device_employee_mappings
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.employees e ON e.user_id = auth.uid()
      WHERE ur.user_id = auth.uid()
        AND e.company_id = public.current_company_id()
        AND ur.role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- 3. Restricted Read on punch_import_raw_events (Admins only)
CREATE POLICY punch_import_raw_events_admin_read ON public.punch_import_raw_events
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id() AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.employees e ON e.user_id = auth.uid()
      WHERE ur.user_id = auth.uid()
        AND e.company_id = public.current_company_id()
        AND ur.role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

COMMIT;
