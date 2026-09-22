-- ============================================================================
-- Prompt 12: Production Attendance Engine
-- Tenant-scoped attendance policies, truthful punches, geofence validation,
-- idempotent biometric ingestion, dedicated queries and attendance-period close.
-- Payroll computation/locking is intentionally OUTSIDE this migration.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'early_departure';
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'holiday';
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'rest_day';
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'missing_punch';

-- --------------------------------------------------------------------------
-- 1) Company attendance policy
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_policies (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  allow_mobile_punch boolean NOT NULL DEFAULT false,
  require_geofence boolean NOT NULL DEFAULT false,
  auto_approve_mobile_punches boolean NOT NULL DEFAULT false,
  allow_outside_geofence_with_reason boolean NOT NULL DEFAULT false,
  max_location_accuracy_meters numeric(8,2),
  require_published_schedule boolean NOT NULL DEFAULT true,
  missing_punch_behavior text NOT NULL DEFAULT 'flag'
    CHECK (missing_punch_behavior IN ('flag','absent','ignore')),
  overtime_requires_approval boolean NOT NULL DEFAULT true,
  early_departure_grace_minutes integer NOT NULL DEFAULT 0
    CHECK (early_departure_grace_minutes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- 2) Attendance period lifecycle, independent from payroll
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_year integer NOT NULL CHECK (period_year BETWEEN 2000 AND 2200),
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','review','closed')),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  close_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_attendance_periods_company_period
  ON public.attendance_periods(company_id, period_year DESC, period_month DESC);

ALTER TABLE public.attendance_periods ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- 3) Enrich production attendance data with authoritative scope and provenance
-- --------------------------------------------------------------------------
ALTER TABLE public.punches
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS external_event_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS accuracy_meters numeric(8,2),
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

UPDATE public.punches p
SET company_id = e.company_id
FROM public.employees e
WHERE p.employee_id = e.id
  AND p.company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_punches_company_idempotency
  ON public.punches(company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_punches_company_external_event
  ON public.punches(company_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_punches_company_time
  ON public.punches(company_id, punch_time DESC);

ALTER TABLE public.biometric_devices
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS device_token_hash text,
  ADD COLUMN IF NOT EXISTS token_last4 text,
  ADD COLUMN IF NOT EXISTS last_sync_error text;

UPDATE public.biometric_devices d
SET company_id = wl.company_id
FROM public.work_locations wl
WHERE d.work_location_id = wl.id
  AND d.company_id IS NULL;

UPDATE public.biometric_devices
SET device_token_hash = encode(digest(device_token, 'sha256'), 'hex'),
    token_last4 = right(device_token, 4)
WHERE device_token IS NOT NULL
  AND (device_token_hash IS NULL OR device_token_hash = '');

ALTER TABLE public.biometric_devices
  ALTER COLUMN device_token DROP NOT NULL;

UPDATE public.biometric_devices
SET device_token = NULL
WHERE device_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_biometric_devices_company
  ON public.biometric_devices(company_id, status);

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_in time,
  ADD COLUMN IF NOT EXISTS scheduled_out time,
  ADD COLUMN IF NOT EXISTS early_departure_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS geofence_valid boolean,
  ADD COLUMN IF NOT EXISTS punch_source text,
  ADD COLUMN IF NOT EXISTS violations_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviewed_by_payroll boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

UPDATE public.attendance_records a
SET company_id = e.company_id
FROM public.employees e
WHERE a.employee_id = e.id
  AND a.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_company_date
  ON public.attendance_records(company_id, work_date DESC);

ALTER TABLE public.overtime_records
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.overtime_records o
SET company_id = e.company_id
FROM public.employees e
WHERE o.employee_id = e.id
  AND o.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_overtime_company_date
  ON public.overtime_records(company_id, work_date DESC);

-- --------------------------------------------------------------------------
-- 4) RLS: replace broad legacy policies for the production attendance domain
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(ARRAY[
        'attendance_policies','attendance_periods','attendance_records',
        'punches','biometric_devices','overtime_records'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      v_policy.policyname,
      v_policy.tablename
    );
  END LOOP;
END $$;

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_policy_read
  ON public.attendance_policies FOR SELECT TO authenticated
  USING (
    company_id = public.current_user_company_id()
    OR public.current_user_has_any_role(ARRAY['super_admin'])
  );

CREATE POLICY attendance_policy_manage
  ON public.attendance_policies FOR ALL TO authenticated
  USING (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  )
  WITH CHECK (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  );

CREATE POLICY attendance_period_read
  ON public.attendance_periods FOR SELECT TO authenticated
  USING (
    company_id = public.current_user_company_id()
    OR public.current_user_has_any_role(ARRAY['super_admin'])
  );

CREATE POLICY attendance_period_manage
  ON public.attendance_periods FOR ALL TO authenticated
  USING (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  )
  WITH CHECK (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  );

CREATE POLICY attendance_records_scoped_read
  ON public.attendance_records FOR SELECT TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer','auditor']
    )
    OR (
      public.current_user_has_role_for_company(company_id, ARRAY['line_manager'])
      AND EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.id = attendance_records.employee_id
          AND e.manager_id = public.current_employee_id()
          AND e.company_id = attendance_records.company_id
      )
    )
  );

CREATE POLICY attendance_records_staff_insert
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  );

CREATE POLICY attendance_records_staff_update
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  )
  WITH CHECK (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  );

CREATE POLICY punches_scoped_read
  ON public.punches FOR SELECT TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer','auditor']
    )
    OR (
      public.current_user_has_role_for_company(company_id, ARRAY['line_manager'])
      AND EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.id = punches.employee_id
          AND e.manager_id = public.current_employee_id()
          AND e.company_id = punches.company_id
      )
    )
  );

CREATE POLICY punches_staff_write
  ON public.punches FOR ALL TO authenticated
  USING (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  )
  WITH CHECK (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  );

CREATE POLICY biometric_devices_scoped_read
  ON public.biometric_devices FOR SELECT TO authenticated
  USING (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer','auditor']
    )
  );

CREATE POLICY biometric_devices_scoped_manage
  ON public.biometric_devices FOR ALL TO authenticated
  USING (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  )
  WITH CHECK (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  );

CREATE POLICY overtime_scoped_read
  ON public.overtime_records FOR SELECT TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer','payroll_officer','auditor']
    )
    OR (
      public.current_user_has_role_for_company(company_id, ARRAY['line_manager'])
      AND EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.id = overtime_records.employee_id
          AND e.manager_id = public.current_employee_id()
          AND e.company_id = overtime_records.company_id
      )
    )
  );

CREATE POLICY overtime_staff_write
  ON public.overtime_records FOR ALL TO authenticated
  USING (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  )
  WITH CHECK (
    public.current_user_has_role_for_company(
      company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  );

GRANT SELECT ON public.attendance_policies, public.attendance_periods TO authenticated;
GRANT SELECT ON public.attendance_records, public.punches, public.biometric_devices, public.overtime_records TO authenticated;
GRANT ALL ON public.attendance_policies, public.attendance_periods TO service_role;
GRANT ALL ON public.attendance_records, public.punches, public.biometric_devices, public.overtime_records TO service_role;

-- --------------------------------------------------------------------------
-- 5) Geofence calculation
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_distance_meters(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT 6371000.0 * 2.0 * asin(
    sqrt(
      power(sin(radians(p_lat2 - p_lat1) / 2.0), 2)
      + cos(radians(p_lat1))
      * cos(radians(p_lat2))
      * power(sin(radians(p_lon2 - p_lon1) / 2.0), 2)
    )
  );
$$;

REVOKE ALL ON FUNCTION public.attendance_distance_meters(double precision,double precision,double precision,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attendance_distance_meters(double precision,double precision,double precision,double precision) TO authenticated, service_role;

-- --------------------------------------------------------------------------
-- 6) Dedicated policy query
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_attendance_policy()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_policy public.attendance_policies%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة نشطة مرتبطة بالحساب الحالي.';
  END IF;

  SELECT * INTO v_policy
  FROM public.attendance_policies
  WHERE company_id = v_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'configured', false,
      'company_id', v_company_id
    );
  END IF;

  RETURN jsonb_build_object(
    'configured', true,
    'company_id', v_policy.company_id,
    'allow_mobile_punch', v_policy.allow_mobile_punch,
    'require_geofence', v_policy.require_geofence,
    'auto_approve_mobile_punches', v_policy.auto_approve_mobile_punches,
    'allow_outside_geofence_with_reason', v_policy.allow_outside_geofence_with_reason,
    'max_location_accuracy_meters', v_policy.max_location_accuracy_meters,
    'require_published_schedule', v_policy.require_published_schedule,
    'missing_punch_behavior', v_policy.missing_punch_behavior,
    'overtime_requires_approval', v_policy.overtime_requires_approval,
    'early_departure_grace_minutes', v_policy.early_departure_grace_minutes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_attendance_policy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_attendance_policy() TO authenticated;

-- --------------------------------------------------------------------------
-- 6b) Authoritative attendance-policy update
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_attendance_policy(
  p_allow_mobile_punch boolean,
  p_require_geofence boolean,
  p_auto_approve_mobile_punches boolean,
  p_allow_outside_geofence_with_reason boolean,
  p_max_location_accuracy_meters numeric,
  p_require_published_schedule boolean,
  p_missing_punch_behavior text,
  p_overtime_requires_approval boolean,
  p_early_departure_grace_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
  v_company_id uuid := public.current_user_company_id();
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة مرتبطة بالحساب الحالي.';
  END IF;
  IF NOT public.current_user_has_role_for_company(
    v_company_id,
    ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
  ) THEN
    RAISE EXCEPTION 'غير مصرح بتعديل سياسة الحضور.';
  END IF;
  IF p_missing_punch_behavior NOT IN ('flag','absent','ignore') THEN
    RAISE EXCEPTION 'سياسة البصمة الناقصة غير صالحة.';
  END IF;
  IF p_early_departure_grace_minutes < 0 THEN
    RAISE EXCEPTION 'فترة سماح الانصراف المبكر لا يمكن أن تكون سالبة.';
  END IF;
  IF p_max_location_accuracy_meters IS NOT NULL AND p_max_location_accuracy_meters <= 0 THEN
    RAISE EXCEPTION 'حد دقة الموقع يجب أن يكون أكبر من صفر.';
  END IF;

  INSERT INTO public.attendance_policies (
    company_id,
    allow_mobile_punch,
    require_geofence,
    auto_approve_mobile_punches,
    allow_outside_geofence_with_reason,
    max_location_accuracy_meters,
    require_published_schedule,
    missing_punch_behavior,
    overtime_requires_approval,
    early_departure_grace_minutes,
    updated_at
  ) VALUES (
    v_company_id,
    p_allow_mobile_punch,
    p_require_geofence,
    p_auto_approve_mobile_punches,
    p_allow_outside_geofence_with_reason,
    p_max_location_accuracy_meters,
    p_require_published_schedule,
    p_missing_punch_behavior,
    p_overtime_requires_approval,
    p_early_departure_grace_minutes,
    now()
  )
  ON CONFLICT (company_id)
  DO UPDATE SET
    allow_mobile_punch = EXCLUDED.allow_mobile_punch,
    require_geofence = EXCLUDED.require_geofence,
    auto_approve_mobile_punches = EXCLUDED.auto_approve_mobile_punches,
    allow_outside_geofence_with_reason = EXCLUDED.allow_outside_geofence_with_reason,
    max_location_accuracy_meters = EXCLUDED.max_location_accuracy_meters,
    require_published_schedule = EXCLUDED.require_published_schedule,
    missing_punch_behavior = EXCLUDED.missing_punch_behavior,
    overtime_requires_approval = EXCLUDED.overtime_requires_approval,
    early_departure_grace_minutes = EXCLUDED.early_departure_grace_minutes,
    updated_at = now();

  RETURN public.get_attendance_policy();
END;
$;

REVOKE ALL ON FUNCTION public.upsert_attendance_policy(boolean,boolean,boolean,boolean,numeric,boolean,text,boolean,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_attendance_policy(boolean,boolean,boolean,boolean,numeric,boolean,text,boolean,integer) TO authenticated;

-- --------------------------------------------------------------------------
-- 7) Mobile attendance punch: employee identity and company are server-resolved
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_mobile_attendance_punch(
  p_punch_type text,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy_meters numeric DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee public.employees%ROWTYPE;
  v_company public.companies%ROWTYPE;
  v_policy public.attendance_policies%ROWTYPE;
  v_location public.work_locations%ROWTYPE;
  v_period_status text;
  v_work_date date;
  v_distance double precision;
  v_geofence_valid boolean := NULL;
  v_approval text := 'pending';
  v_punch_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;
  IF p_punch_type NOT IN ('in','out') THEN
    RAISE EXCEPTION 'نوع البصمة غير صالح.';
  END IF;

  SELECT * INTO v_employee
  FROM public.employees
  WHERE user_id = auth.uid()
    AND status NOT IN ('terminated')
  LIMIT 1;

  IF NOT FOUND OR v_employee.company_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد ملف موظف نشط مرتبط بالحساب الحالي.';
  END IF;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = v_employee.company_id;

  IF NOT FOUND OR v_company.timezone IS NULL OR btrim(v_company.timezone) = '' THEN
    RAISE EXCEPTION 'لم يتم إعداد المنطقة الزمنية للمنشأة.';
  END IF;

  BEGIN
    v_work_date := (now() AT TIME ZONE v_company.timezone)::date;
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE EXCEPTION 'المنطقة الزمنية للمنشأة غير صالحة.';
  END;

  SELECT * INTO v_policy
  FROM public.attendance_policies
  WHERE company_id = v_employee.company_id;

  IF NOT FOUND OR NOT v_policy.allow_mobile_punch THEN
    RAISE EXCEPTION 'تسجيل الحضور من الجوال غير مفعل لهذه المنشأة.';
  END IF;

  SELECT status INTO v_period_status
  FROM public.attendance_periods
  WHERE company_id = v_employee.company_id
    AND period_year = EXTRACT(YEAR FROM v_work_date)::integer
    AND period_month = EXTRACT(MONTH FROM v_work_date)::integer;

  IF v_period_status = 'closed' THEN
    RAISE EXCEPTION 'فترة الحضور لهذا الشهر مغلقة.';
  END IF;

  IF v_policy.require_published_schedule AND NOT EXISTS (
    SELECT 1
    FROM public.schedule_assignments sa
    WHERE sa.employee_id = v_employee.id
      AND sa.work_date = v_work_date
      AND sa.status = 'published'
  ) THEN
    RAISE EXCEPTION 'لا يوجد جدول دوام منشور للموظف في هذا اليوم.';
  END IF;

  IF v_policy.require_geofence THEN
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
      RAISE EXCEPTION 'الموقع الجغرافي مطلوب لتسجيل الحضور.';
    END IF;

    IF v_policy.max_location_accuracy_meters IS NOT NULL
       AND (p_accuracy_meters IS NULL OR p_accuracy_meters > v_policy.max_location_accuracy_meters) THEN
      RAISE EXCEPTION 'دقة الموقع غير كافية لتسجيل الحضور.';
    END IF;

    SELECT * INTO v_location
    FROM public.work_locations
    WHERE id = v_employee.work_location_id
      AND company_id = v_employee.company_id
      AND status = 'active';

    IF NOT FOUND OR v_location.latitude IS NULL OR v_location.longitude IS NULL THEN
      RAISE EXCEPTION 'لم يتم إعداد إحداثيات موقع العمل للموظف.';
    END IF;

    v_distance := public.attendance_distance_meters(
      p_latitude,
      p_longitude,
      v_location.latitude,
      v_location.longitude
    );
    v_geofence_valid := v_distance <= v_location.radius_meters;

    IF NOT v_geofence_valid
       AND NOT v_policy.allow_outside_geofence_with_reason THEN
      RAISE EXCEPTION 'الموقع الحالي خارج النطاق الجغرافي المعتمد.';
    END IF;

    IF NOT v_geofence_valid AND NULLIF(btrim(COALESCE(p_note,'')), '') IS NULL THEN
      RAISE EXCEPTION 'يجب كتابة سبب التسجيل خارج النطاق الجغرافي.';
    END IF;
  END IF;

  v_approval := CASE
    WHEN v_policy.auto_approve_mobile_punches
      AND COALESCE(v_geofence_valid, true)
      THEN 'approved'
    ELSE 'pending'
  END;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_punch_id
    FROM public.punches
    WHERE company_id = v_employee.company_id
      AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'punch_id', v_punch_id,
        'work_date', v_work_date,
        'geofence_valid', v_geofence_valid,
        'distance_meters', v_distance,
        'approval_status', v_approval
      );
    END IF;
  END IF;

  INSERT INTO public.punches (
    employee_id,
    company_id,
    punch_time,
    punch_type,
    source,
    latitude,
    longitude,
    accuracy_meters,
    geofence_valid,
    work_location_id,
    approval_status,
    idempotency_key,
    raw_payload
  ) VALUES (
    v_employee.id,
    v_employee.company_id,
    now(),
    p_punch_type,
    'mobile_gps',
    p_latitude,
    p_longitude,
    p_accuracy_meters,
    v_geofence_valid,
    v_employee.work_location_id,
    v_approval,
    p_idempotency_key,
    jsonb_build_object('note', NULLIF(btrim(COALESCE(p_note,'')), ''))
  )
  RETURNING id INTO v_punch_id;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'punch_id', v_punch_id,
    'work_date', v_work_date,
    'geofence_valid', v_geofence_valid,
    'distance_meters', v_distance,
    'approval_status', v_approval
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_mobile_attendance_punch(text,double precision,double precision,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_mobile_attendance_punch(text,double precision,double precision,numeric,text,text) TO authenticated;

-- --------------------------------------------------------------------------
-- 8) Secure biometric-device registration: token is returned once, only hash persists
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_biometric_device(
  p_device_id text,
  p_name_ar text,
  p_vendor text DEFAULT NULL,
  p_work_location_id uuid DEFAULT NULL,
  p_auto_approve boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_token text;
  v_id uuid;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة مرتبطة بالحساب الحالي.';
  END IF;
  IF NOT public.current_user_has_role_for_company(
    v_company_id,
    ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
  ) THEN
    RAISE EXCEPTION 'غير مصرح بإدارة أجهزة الحضور.';
  END IF;
  IF NULLIF(btrim(COALESCE(p_device_id,'')), '') IS NULL
     OR NULLIF(btrim(COALESCE(p_name_ar,'')), '') IS NULL THEN
    RAISE EXCEPTION 'معرف الجهاز واسمه مطلوبان.';
  END IF;

  IF p_work_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.work_locations
    WHERE id = p_work_location_id
      AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'موقع العمل لا يتبع المنشأة الحالية.';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.biometric_devices (
    device_id,
    name_ar,
    company_id,
    work_location_id,
    vendor,
    device_token,
    device_token_hash,
    token_last4,
    auto_approve,
    status
  ) VALUES (
    btrim(p_device_id),
    btrim(p_name_ar),
    v_company_id,
    p_work_location_id,
    NULLIF(btrim(COALESCE(p_vendor,'')), ''),
    NULL,
    encode(digest(v_token, 'sha256'), 'hex'),
    right(v_token, 4),
    p_auto_approve,
    'active'
  )
  ON CONFLICT (device_id)
  DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    company_id = EXCLUDED.company_id,
    work_location_id = EXCLUDED.work_location_id,
    vendor = EXCLUDED.vendor,
    device_token = NULL,
    device_token_hash = EXCLUDED.device_token_hash,
    token_last4 = EXCLUDED.token_last4,
    auto_approve = EXCLUDED.auto_approve,
    status = 'active',
    updated_at = now()
  WHERE public.biometric_devices.company_id IS NULL
     OR public.biometric_devices.company_id = v_company_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'معرف الجهاز مستخدم بواسطة منشأة أخرى.';
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'device_id', btrim(p_device_id),
    'token', v_token,
    'token_last4', right(v_token, 4)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_biometric_device(text,text,text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_biometric_device(text,text,text,uuid,boolean) TO authenticated;

-- --------------------------------------------------------------------------
-- 9) Device ingestion: token-authenticated and idempotent
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_biometric_punch(
  p_device_id text,
  p_token text,
  p_external_event_id text,
  p_employee_no text,
  p_punch_time timestamptz,
  p_punch_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_device public.biometric_devices%ROWTYPE;
  v_employee public.employees%ROWTYPE;
  v_punch_id uuid;
BEGIN
  IF p_punch_type NOT IN ('in','out') THEN
    RAISE EXCEPTION 'نوع البصمة غير صالح.';
  END IF;
  IF NULLIF(btrim(COALESCE(p_external_event_id,'')), '') IS NULL THEN
    RAISE EXCEPTION 'معرف الحدث الخارجي مطلوب لمنع التكرار.';
  END IF;

  SELECT * INTO v_device
  FROM public.biometric_devices
  WHERE device_id = btrim(p_device_id)
    AND status = 'active';

  IF NOT FOUND OR v_device.company_id IS NULL THEN
    RAISE EXCEPTION 'الجهاز غير مسجل أو غير نشط.';
  END IF;

  IF v_device.device_token_hash IS NULL
     OR encode(digest(COALESCE(p_token,''), 'sha256'), 'hex') <> v_device.device_token_hash THEN
    RAISE EXCEPTION 'رمز اتصال الجهاز غير صالح.';
  END IF;

  SELECT * INTO v_employee
  FROM public.employees
  WHERE company_id = v_device.company_id
    AND employee_no = btrim(p_employee_no)
    AND status NOT IN ('terminated')
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لم يتم العثور على الموظف داخل منشأة الجهاز.';
  END IF;

  SELECT id INTO v_punch_id
  FROM public.punches
  WHERE company_id = v_device.company_id
    AND external_event_id = p_external_event_id;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'punch_id', v_punch_id);
  END IF;

  INSERT INTO public.punches (
    employee_id,
    company_id,
    punch_time,
    punch_type,
    source,
    device_id,
    work_location_id,
    vendor,
    external_event_id,
    approval_status,
    geofence_valid,
    raw_payload
  ) VALUES (
    v_employee.id,
    v_device.company_id,
    p_punch_time,
    p_punch_type,
    'biometric_device',
    v_device.device_id,
    v_device.work_location_id,
    v_device.vendor,
    p_external_event_id,
    CASE WHEN v_device.auto_approve THEN 'approved' ELSE 'pending' END,
    true,
    COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_punch_id;

  UPDATE public.biometric_devices
  SET last_seen_at = now(),
      total_punches = total_punches + 1,
      last_sync_error = NULL,
      updated_at = now()
  WHERE id = v_device.id;

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'punch_id', v_punch_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_biometric_punch(text,text,text,text,timestamptz,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_biometric_punch(text,text,text,text,timestamptz,text,jsonb) TO anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- 10) Dedicated attendance reads
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_attendance_records(
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee_id uuid := public.current_employee_id();
BEGIN
  IF auth.uid() IS NULL OR v_employee_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد ملف موظف مرتبط بالحساب الحالي.';
  END IF;
  IF p_to < p_from THEN
    RAISE EXCEPTION 'نطاق التاريخ غير صحيح.';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'employee_id', a.employee_id,
        'work_date', a.work_date,
        'shift_id', a.shift_id,
        'scheduled_in', a.scheduled_in,
        'scheduled_out', a.scheduled_out,
        'check_in', a.check_in,
        'check_out', a.check_out,
        'status', a.status,
        'worked_hours', a.worked_hours,
        'worked_minutes', a.worked_minutes,
        'late_minutes', a.late_minutes,
        'early_departure_minutes', a.early_departure_minutes,
        'overtime_hours', a.overtime_hours,
        'overtime_minutes', a.overtime_minutes,
        'punch_source', a.punch_source,
        'geofence_valid', a.geofence_valid,
        'violations_count', a.violations_count,
        'reviewed_by_payroll', a.reviewed_by_payroll,
        'note', a.note
      )
      ORDER BY a.work_date DESC
    )
    FROM public.attendance_records a
    WHERE a.employee_id = v_employee_id
      AND a.work_date BETWEEN p_from AND p_to
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_attendance_records(date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_attendance_records(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_company_attendance_records(
  p_from date,
  p_to date,
  p_employee_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_page integer := GREATEST(COALESCE(p_page,1),1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size,50),1),200);
  v_offset integer;
  v_total bigint;
  v_items jsonb;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة مرتبطة بالحساب الحالي.';
  END IF;
  IF NOT public.current_user_has_role_for_company(
    v_company_id,
    ARRAY['super_admin','org_admin','hr_manager','attendance_officer','auditor','line_manager']
  ) THEN
    RAISE EXCEPTION 'غير مصرح بقراءة سجلات حضور المنشأة.';
  END IF;
  IF p_to < p_from THEN
    RAISE EXCEPTION 'نطاق التاريخ غير صحيح.';
  END IF;

  v_offset := (v_page - 1) * v_page_size;

  SELECT count(*)
  INTO v_total
  FROM public.attendance_records a
  JOIN public.employees e ON e.id = a.employee_id
  WHERE a.company_id = v_company_id
    AND a.work_date BETWEEN p_from AND p_to
    AND (p_employee_id IS NULL OR a.employee_id = p_employee_id)
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (p_status IS NULL OR a.status::text = p_status)
    AND (
      NOT public.current_user_has_any_role(ARRAY['line_manager'])
      OR public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','attendance_officer','auditor'])
      OR e.manager_id = public.current_employee_id()
      OR e.id = public.current_employee_id()
    );

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'id', a.id,
      'employee_id', a.employee_id,
      'employee_no', e.employee_no,
      'employee_name', COALESCE(NULLIF(trim(concat_ws(' ',e.first_name_ar,e.last_name_ar)),''), e.full_name),
      'department_id', e.department_id,
      'department_name', d.name,
      'work_date', a.work_date,
      'shift_id', a.shift_id,
      'scheduled_in', a.scheduled_in,
      'scheduled_out', a.scheduled_out,
      'check_in', a.check_in,
      'check_out', a.check_out,
      'status', a.status,
      'worked_hours', a.worked_hours,
      'worked_minutes', a.worked_minutes,
      'late_minutes', a.late_minutes,
      'early_departure_minutes', a.early_departure_minutes,
      'overtime_hours', a.overtime_hours,
      'overtime_minutes', a.overtime_minutes,
      'punch_source', a.punch_source,
      'geofence_valid', a.geofence_valid,
      'violations_count', a.violations_count,
      'reviewed_by_payroll', a.reviewed_by_payroll,
      'note', a.note
    ) AS item
    FROM public.attendance_records a
    JOIN public.employees e ON e.id = a.employee_id
    LEFT JOIN public.departments d ON d.id = e.department_id
    WHERE a.company_id = v_company_id
      AND a.work_date BETWEEN p_from AND p_to
      AND (p_employee_id IS NULL OR a.employee_id = p_employee_id)
      AND (p_department_id IS NULL OR e.department_id = p_department_id)
      AND (p_status IS NULL OR a.status::text = p_status)
      AND (
        NOT public.current_user_has_any_role(ARRAY['line_manager'])
        OR public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','attendance_officer','auditor'])
        OR e.manager_id = public.current_employee_id()
        OR e.id = public.current_employee_id()
      )
    ORDER BY a.work_date DESC, e.employee_no
    LIMIT v_page_size OFFSET v_offset
  ) q;

  RETURN jsonb_build_object(
    'items', v_items,
    'total_count', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_company_attendance_records(date,date,uuid,uuid,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_attendance_records(date,date,uuid,uuid,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_attendance_summary(
  p_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_company_tz text;
  v_date date;
  v_total integer := 0;
  v_present integer := 0;
  v_late integer := 0;
  v_absent integer := 0;
  v_missing integer := 0;
  v_pending_punches integer := 0;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة مرتبطة بالحساب الحالي.';
  END IF;

  SELECT timezone INTO v_company_tz
  FROM public.companies
  WHERE id = v_company_id;

  IF v_company_tz IS NULL OR btrim(v_company_tz) = '' THEN
    RAISE EXCEPTION 'لم يتم إعداد المنطقة الزمنية للمنشأة.';
  END IF;

  BEGIN
    v_date := COALESCE(p_date, (now() AT TIME ZONE v_company_tz)::date);
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE EXCEPTION 'المنطقة الزمنية للمنشأة غير صالحة.';
  END;

  SELECT count(*) INTO v_total
  FROM public.employees e
  WHERE e.company_id = v_company_id
    AND e.status::text NOT IN ('terminated','draft','preboarding');

  SELECT
    count(*) FILTER (WHERE a.status::text = 'present'),
    count(*) FILTER (WHERE a.status::text = 'late'),
    count(*) FILTER (WHERE a.status::text = 'absent'),
    count(*) FILTER (WHERE a.check_in IS NULL OR a.check_out IS NULL)
  INTO v_present, v_late, v_absent, v_missing
  FROM public.attendance_records a
  WHERE a.company_id = v_company_id
    AND a.work_date = v_date;

  SELECT count(*) INTO v_pending_punches
  FROM public.punches p
  WHERE p.company_id = v_company_id
    AND p.approval_status = 'pending'
    AND (p.punch_time AT TIME ZONE v_company_tz)::date = v_date;

  RETURN jsonb_build_object(
    'date', v_date,
    'total_employees', v_total,
    'present', v_present,
    'late', v_late,
    'absent', v_absent,
    'missing_punch', v_missing,
    'pending_punches', v_pending_punches,
    'attendance_rate',
      CASE WHEN v_total = 0 THEN 0
           ELSE round(((v_present + v_late)::numeric / v_total::numeric) * 100, 1)
      END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_attendance_summary(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary(date) TO authenticated;

-- --------------------------------------------------------------------------
-- 11) Attendance-period close. It NEVER calculates or locks payroll.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_attendance_period(
  p_year integer,
  p_month integer,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_timezone text;
  v_from date;
  v_to date;
  v_pending_punches integer;
  v_missing_records integer;
  v_period_id uuid;
BEGIN
  IF p_year < 2000 OR p_year > 2200 OR p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'فترة الحضور غير صالحة.';
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة مرتبطة بالحساب الحالي.';
  END IF;
  IF NOT public.current_user_has_role_for_company(
    v_company_id,
    ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
  ) THEN
    RAISE EXCEPTION 'غير مصرح بإغلاق فترة الحضور.';
  END IF;

  SELECT timezone INTO v_timezone
  FROM public.companies
  WHERE id = v_company_id;

  IF v_timezone IS NULL OR btrim(v_timezone) = '' THEN
    RAISE EXCEPTION 'لم يتم إعداد المنطقة الزمنية للمنشأة.';
  END IF;

  v_from := make_date(p_year, p_month, 1);
  v_to := (v_from + interval '1 month - 1 day')::date;

  SELECT count(*) INTO v_pending_punches
  FROM public.punches p
  WHERE p.company_id = v_company_id
    AND p.approval_status = 'pending'
    AND (p.punch_time AT TIME ZONE v_timezone)::date BETWEEN v_from AND v_to;

  IF v_pending_punches > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: توجد % بصمة معلقة بانتظار المراجعة.', v_pending_punches;
  END IF;

  SELECT count(*) INTO v_missing_records
  FROM public.attendance_records a
  WHERE a.company_id = v_company_id
    AND a.work_date BETWEEN v_from AND v_to
    AND (a.check_in IS NULL OR a.check_out IS NULL)
    AND a.status::text NOT IN ('absent','leave');

  IF v_missing_records > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: توجد % حالة بصمة ناقصة تحتاج للمراجعة.', v_missing_records;
  END IF;

  INSERT INTO public.attendance_periods (
    company_id, period_year, period_month, status, closed_by, closed_at, close_note
  ) VALUES (
    v_company_id, p_year, p_month, 'closed', auth.uid(), now(), NULLIF(btrim(COALESCE(p_note,'')), '')
  )
  ON CONFLICT (company_id, period_year, period_month)
  DO UPDATE SET
    status = 'closed',
    closed_by = auth.uid(),
    closed_at = now(),
    close_note = EXCLUDED.close_note,
    updated_at = now()
  RETURNING id INTO v_period_id;

  RETURN jsonb_build_object(
    'success', true,
    'period_id', v_period_id,
    'year', p_year,
    'month', p_month,
    'status', 'closed',
    'pending_punches', 0,
    'missing_records', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_attendance_period(integer,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_attendance_period(integer,integer,text) TO authenticated;

-- --------------------------------------------------------------------------
-- 12) Self-service attendance correction submission
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_attendance_correction(
  p_work_date date,
  p_correct_in time DEFAULT NULL,
  p_correct_out time DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee public.employees%ROWTYPE;
  v_period_status text;
  v_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason,'')), '') IS NULL THEN
    RAISE EXCEPTION 'سبب تصحيح البصمة مطلوب.';
  END IF;
  IF p_correct_in IS NULL AND p_correct_out IS NULL THEN
    RAISE EXCEPTION 'يجب إدخال وقت دخول أو خروج مصحح.';
  END IF;

  SELECT * INTO v_employee
  FROM public.employees
  WHERE user_id = auth.uid()
    AND status::text <> 'terminated'
  LIMIT 1;

  IF NOT FOUND OR v_employee.company_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد ملف موظف نشط مرتبط بالحساب الحالي.';
  END IF;

  SELECT status INTO v_period_status
  FROM public.attendance_periods
  WHERE company_id = v_employee.company_id
    AND period_year = EXTRACT(YEAR FROM p_work_date)::integer
    AND period_month = EXTRACT(MONTH FROM p_work_date)::integer;

  IF v_period_status = 'closed' THEN
    RAISE EXCEPTION 'فترة الحضور لهذا التاريخ مغلقة.';
  END IF;

  INSERT INTO public.requests (
    employee_id,
    company_id,
    type,
    status,
    start_date,
    end_date,
    reason,
    created_by,
    payload
  ) VALUES (
    v_employee.id,
    v_employee.company_id,
    'attendance_fix',
    'pending_approval',
    p_work_date,
    p_work_date,
    btrim(p_reason),
    auth.uid(),
    jsonb_build_object(
      'workDate', p_work_date,
      'correctInTime', p_correct_in,
      'correctOutTime', p_correct_out
    )
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.request_timeline (
    request_id,
    step_number,
    actor_id,
    actor_name,
    actor_role,
    action,
    note
  ) VALUES (
    v_request_id,
    1,
    auth.uid(),
    COALESCE(NULLIF(trim(concat_ws(' ',v_employee.first_name_ar,v_employee.last_name_ar)),''), v_employee.full_name),
    'employee',
    'submitted',
    'تم إرسال طلب تصحيح البصمة'
  );

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_attendance_correction(date,time,time,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_attendance_correction(date,time,time,text) TO authenticated;

-- --------------------------------------------------------------------------
-- 13) Overtime attendance request: duration is authoritative, pricing belongs to Payroll
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_overtime_attendance_request(
  p_employee_id uuid,
  p_work_date date,
  p_start_time time,
  p_end_time time,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_target public.employees%ROWTYPE;
  v_caller_employee_id uuid := public.current_employee_id();
  v_start_ts timestamp;
  v_end_ts timestamp;
  v_hours numeric(8,2);
  v_id uuid;
  v_period_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة مرتبطة بالحساب الحالي.';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason,'')), '') IS NULL THEN
    RAISE EXCEPTION 'مبرر العمل الإضافي مطلوب.';
  END IF;

  SELECT * INTO v_target
  FROM public.employees
  WHERE id = p_employee_id
    AND company_id = v_company_id
    AND status::text NOT IN ('terminated','draft','preboarding');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف غير موجود داخل المنشأة الحالية.';
  END IF;

  IF NOT (
    public.current_user_has_role_for_company(
      v_company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
    OR (
      public.current_user_has_role_for_company(v_company_id, ARRAY['line_manager'])
      AND v_target.manager_id = v_caller_employee_id
    )
  ) THEN
    RAISE EXCEPTION 'غير مصرح بتكليف هذا الموظف بعمل إضافي.';
  END IF;

  SELECT status INTO v_period_status
  FROM public.attendance_periods
  WHERE company_id = v_company_id
    AND period_year = EXTRACT(YEAR FROM p_work_date)::integer
    AND period_month = EXTRACT(MONTH FROM p_work_date)::integer;

  IF v_period_status = 'closed' THEN
    RAISE EXCEPTION 'فترة الحضور لهذا التاريخ مغلقة.';
  END IF;

  v_start_ts := p_work_date::timestamp + p_start_time;
  v_end_ts := p_work_date::timestamp + p_end_time;
  IF v_end_ts <= v_start_ts THEN
    v_end_ts := v_end_ts + interval '1 day';
  END IF;

  v_hours := round((EXTRACT(EPOCH FROM (v_end_ts - v_start_ts)) / 3600.0)::numeric, 2);
  IF v_hours <= 0 OR v_hours > 16 THEN
    RAISE EXCEPTION 'مدة العمل الإضافي غير صالحة.';
  END IF;

  INSERT INTO public.overtime_records (
    employee_id,
    company_id,
    work_date,
    start_time,
    end_time,
    hours,
    rate_multiplier,
    rate_type,
    reason,
    hourly_rate,
    total_amount,
    status,
    created_by
  ) VALUES (
    v_target.id,
    v_company_id,
    p_work_date,
    p_start_time,
    p_end_time,
    v_hours,
    0,
    'pending_payroll_rule',
    btrim(p_reason),
    0,
    0,
    'pending',
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'overtime_id', v_id,
    'hours', v_hours,
    'pricing_status', 'pending_payroll_rule'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_overtime_attendance_request(uuid,date,time,time,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_overtime_attendance_request(uuid,date,time,time,text) TO authenticated;

-- --------------------------------------------------------------------------
-- 14) Secure token rotation: raw token is returned once, hash only is persisted
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotate_biometric_device_token(
  p_device_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_token text;
  v_device_code text;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة مرتبطة بالحساب الحالي.';
  END IF;
  IF NOT public.current_user_has_role_for_company(
    v_company_id,
    ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
  ) THEN
    RAISE EXCEPTION 'غير مصرح بإدارة أجهزة الحضور.';
  END IF;

  SELECT device_id INTO v_device_code
  FROM public.biometric_devices
  WHERE id = p_device_id
    AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الجهاز غير موجود داخل المنشأة الحالية.';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  UPDATE public.biometric_devices
  SET device_token = NULL,
      device_token_hash = encode(digest(v_token, 'sha256'), 'hex'),
      token_last4 = right(v_token, 4),
      updated_at = now()
  WHERE id = p_device_id;

  RETURN jsonb_build_object(
    'id', p_device_id,
    'device_id', v_device_code,
    'token', v_token,
    'token_last4', right(v_token, 4)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_biometric_device_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_biometric_device_token(uuid) TO authenticated;

-- --------------------------------------------------------------------------
-- 15) Authorized supervisor/manual punch with server-resolved tenant scope
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_staff_attendance_punch(
  p_employee_ref text,
  p_punch_type text,
  p_device_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_caller_employee_id uuid := public.current_employee_id();
  v_employee public.employees%ROWTYPE;
  v_device public.biometric_devices%ROWTYPE;
  v_punch_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة مرتبطة بالحساب الحالي.';
  END IF;
  IF p_punch_type NOT IN ('in','out') THEN
    RAISE EXCEPTION 'نوع البصمة غير صالح.';
  END IF;

  SELECT * INTO v_employee
  FROM public.employees
  WHERE company_id = v_company_id
    AND (id::text = btrim(p_employee_ref) OR employee_no = btrim(p_employee_ref))
    AND status::text <> 'terminated'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف غير موجود داخل المنشأة الحالية.';
  END IF;

  IF NOT (
    public.current_user_has_role_for_company(
      v_company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
    OR (
      public.current_user_has_role_for_company(v_company_id, ARRAY['line_manager'])
      AND v_employee.manager_id = v_caller_employee_id
    )
  ) THEN
    RAISE EXCEPTION 'غير مصرح بتسجيل بصمة لهذا الموظف.';
  END IF;

  IF NULLIF(btrim(COALESCE(p_device_id,'')), '') IS NOT NULL THEN
    SELECT * INTO v_device
    FROM public.biometric_devices
    WHERE company_id = v_company_id
      AND device_id = btrim(p_device_id)
      AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الجهاز المحدد غير مسجل أو غير نشط لهذه المنشأة.';
    END IF;
  END IF;

  INSERT INTO public.punches (
    employee_id,
    company_id,
    punch_time,
    punch_type,
    source,
    device_id,
    work_location_id,
    approval_status,
    geofence_valid,
    raw_payload
  ) VALUES (
    v_employee.id,
    v_company_id,
    now(),
    p_punch_type,
    'manual_admin',
    CASE WHEN v_device.id IS NOT NULL THEN v_device.device_id ELSE NULL END,
    COALESCE(v_device.work_location_id, v_employee.work_location_id),
    'approved',
    NULL,
    jsonb_build_object('entered_by', auth.uid())
  )
  RETURNING id INTO v_punch_id;

  RETURN jsonb_build_object(
    'success', true,
    'punch_id', v_punch_id,
    'employee_id', v_employee.id,
    'employee_no', v_employee.employee_no,
    'employee_name', COALESCE(NULLIF(trim(concat_ws(' ',v_employee.first_name_ar,v_employee.last_name_ar)),''), v_employee.full_name)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_staff_attendance_punch(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_staff_attendance_punch(text,text,text) TO authenticated;

-- --------------------------------------------------------------------------
-- 16) Dedicated scoped attendance-correction reads
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_attendance_correction_requests(
  p_from date,
  p_to date,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_employee_id uuid := public.current_employee_id();
  v_full_access boolean;
  v_team_access boolean;
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد جلسة أو منشأة نشطة.';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'نطاق التاريخ غير صحيح.';
  END IF;

  v_full_access := public.current_user_has_role_for_company(
    v_company_id,
    ARRAY['super_admin','org_admin','hr_manager','attendance_officer','auditor']
  );
  v_team_access := public.current_user_has_role_for_company(
    v_company_id,
    ARRAY['line_manager']
  );

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'employee_id', r.employee_id,
        'employee_no', e.employee_no,
        'employee_name', COALESCE(NULLIF(trim(concat_ws(' ',e.first_name_ar,e.last_name_ar)),''), e.full_name),
        'department_name', d.name,
        'work_date', COALESCE(r.start_date, (r.payload->>'workDate')::date),
        'original_attendance_id', r.payload->>'originalAttendanceId',
        'original_in', r.payload->>'originalIn',
        'original_out', r.payload->>'originalOut',
        'correct_in', COALESCE(r.payload->>'correctInTime', r.payload->>'correctIn'),
        'correct_out', COALESCE(r.payload->>'correctOutTime', r.payload->>'correctOut'),
        'reason', r.reason,
        'status', r.status,
        'submitted_at', r.created_at,
        'reviewed_by', r.decided_by,
        'reviewed_at', r.decided_at
      )
      ORDER BY r.created_at DESC
    )
    FROM public.requests r
    JOIN public.employees e ON e.id = r.employee_id
    LEFT JOIN public.departments d ON d.id = e.department_id
    WHERE r.company_id = v_company_id
      AND r.type = 'attendance_fix'
      AND COALESCE(r.start_date, (r.payload->>'workDate')::date) BETWEEN p_from AND p_to
      AND (p_status IS NULL OR r.status::text = p_status)
      AND (
        v_full_access
        OR (v_team_access AND e.manager_id = v_employee_id)
        OR r.employee_id = v_employee_id
      )
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_attendance_correction_requests(date,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_attendance_correction_requests(date,date,text) TO authenticated;

-- --------------------------------------------------------------------------
-- 17) Dedicated scoped overtime reads
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_overtime_attendance_requests(
  p_from date,
  p_to date,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_employee_id uuid := public.current_employee_id();
  v_full_access boolean;
  v_team_access boolean;
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد جلسة أو منشأة نشطة.';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'نطاق التاريخ غير صحيح.';
  END IF;

  v_full_access := public.current_user_has_role_for_company(
    v_company_id,
    ARRAY['super_admin','org_admin','hr_manager','attendance_officer','payroll_officer','auditor']
  );
  v_team_access := public.current_user_has_role_for_company(
    v_company_id,
    ARRAY['line_manager']
  );

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'employee_id', o.employee_id,
        'employee_no', e.employee_no,
        'employee_name', COALESCE(NULLIF(trim(concat_ws(' ',e.first_name_ar,e.last_name_ar)),''), e.full_name),
        'department_name', d.name,
        'work_date', o.work_date,
        'start_time', o.start_time,
        'end_time', o.end_time,
        'hours', o.hours,
        'rate_multiplier', o.rate_multiplier,
        'rate_type', o.rate_type,
        'reason', o.reason,
        'hourly_rate', o.hourly_rate,
        'total_amount', o.total_amount,
        'status', o.status,
        'approved_by', o.approved_by,
        'approved_at', o.approved_at,
        'created_at', o.created_at
      )
      ORDER BY o.work_date DESC, o.created_at DESC
    )
    FROM public.overtime_records o
    JOIN public.employees e ON e.id = o.employee_id
    LEFT JOIN public.departments d ON d.id = e.department_id
    WHERE o.company_id = v_company_id
      AND o.work_date BETWEEN p_from AND p_to
      AND (p_status IS NULL OR o.status::text = p_status)
      AND (
        v_full_access
        OR (v_team_access AND e.manager_id = v_employee_id)
        OR o.employee_id = v_employee_id
      )
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_overtime_attendance_requests(date,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_overtime_attendance_requests(date,date,text) TO authenticated;

-- --------------------------------------------------------------------------
-- 18) Overtime is unpriced in Attendance; legacy positive-rate constraint
--     would reject the truthful zero-valued placeholder.
-- --------------------------------------------------------------------------
ALTER TABLE public.overtime_records
  DROP CONSTRAINT IF EXISTS overtime_rate_positive;

ALTER TABLE public.overtime_records
  DROP CONSTRAINT IF EXISTS overtime_rate_nonnegative;

ALTER TABLE public.overtime_records
  ADD CONSTRAINT overtime_rate_nonnegative
  CHECK (rate_multiplier >= 0);

-- --------------------------------------------------------------------------
-- 19) Recreate overtime submission with policy-aware approval semantics.
--     Attendance authorizes duration only; Payroll owns financial pricing.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_overtime_attendance_request(
  p_employee_id uuid,
  p_work_date date,
  p_start_time time,
  p_end_time time,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_target public.employees%ROWTYPE;
  v_caller_employee_id uuid := public.current_employee_id();
  v_start_ts timestamp;
  v_end_ts timestamp;
  v_hours numeric(8,2);
  v_id uuid;
  v_period_status text;
  v_requires_approval boolean;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة مرتبطة بالحساب الحالي.';
  END IF;
  IF p_work_date IS NULL OR p_start_time IS NULL OR p_end_time IS NULL THEN
    RAISE EXCEPTION 'تاريخ وفترة العمل الإضافي مطلوبة.';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason,'')), '') IS NULL THEN
    RAISE EXCEPTION 'مبرر العمل الإضافي مطلوب.';
  END IF;

  SELECT * INTO v_target
  FROM public.employees
  WHERE id = p_employee_id
    AND company_id = v_company_id
    AND status::text NOT IN ('terminated','draft','preboarding');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف غير موجود داخل المنشأة الحالية.';
  END IF;

  IF NOT (
    public.current_user_has_role_for_company(
      v_company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
    OR (
      public.current_user_has_role_for_company(v_company_id, ARRAY['line_manager'])
      AND v_target.manager_id = v_caller_employee_id
    )
  ) THEN
    RAISE EXCEPTION 'غير مصرح بتكليف هذا الموظف بعمل إضافي.';
  END IF;

  SELECT overtime_requires_approval
  INTO v_requires_approval
  FROM public.attendance_policies
  WHERE company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لم يتم إعداد سياسة الحضور للمنشأة.';
  END IF;

  SELECT status INTO v_period_status
  FROM public.attendance_periods
  WHERE company_id = v_company_id
    AND period_year = EXTRACT(YEAR FROM p_work_date)::integer
    AND period_month = EXTRACT(MONTH FROM p_work_date)::integer;

  IF v_period_status = 'closed' THEN
    RAISE EXCEPTION 'فترة الحضور لهذا التاريخ مغلقة.';
  END IF;

  v_start_ts := p_work_date::timestamp + p_start_time;
  v_end_ts := p_work_date::timestamp + p_end_time;
  IF v_end_ts <= v_start_ts THEN
    v_end_ts := v_end_ts + interval '1 day';
  END IF;

  v_hours := round((EXTRACT(EPOCH FROM (v_end_ts - v_start_ts)) / 3600.0)::numeric, 2);
  IF v_hours <= 0 OR v_hours > 16 THEN
    RAISE EXCEPTION 'مدة العمل الإضافي غير صالحة.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.overtime_records o
    WHERE o.employee_id = v_target.id
      AND o.work_date = p_work_date
      AND o.status IN ('pending','approved')
  ) THEN
    RAISE EXCEPTION 'يوجد تكليف عمل إضافي فعال لهذا الموظف في نفس التاريخ.';
  END IF;

  v_status := CASE WHEN v_requires_approval THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.overtime_records (
    employee_id,
    company_id,
    work_date,
    start_time,
    end_time,
    hours,
    rate_multiplier,
    rate_type,
    reason,
    hourly_rate,
    total_amount,
    status,
    approved_by,
    approved_at,
    created_by
  ) VALUES (
    v_target.id,
    v_company_id,
    p_work_date,
    p_start_time,
    p_end_time,
    v_hours,
    0,
    'pending_payroll_rule',
    btrim(p_reason),
    0,
    0,
    v_status,
    CASE WHEN v_status = 'approved' THEN auth.uid() ELSE NULL END,
    CASE WHEN v_status = 'approved' THEN now() ELSE NULL END,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'overtime_id', v_id,
    'hours', v_hours,
    'status', v_status,
    'pricing_status', 'pending_payroll_rule'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_overtime_attendance_request(uuid,date,time,time,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_overtime_attendance_request(uuid,date,time,time,text) TO authenticated;

-- --------------------------------------------------------------------------
-- 20) Tenant-safe overtime decisions. Approval authorizes the request only;
--     actual overtime in attendance is calculated from approved punches.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_overtime_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_caller_employee_id uuid := public.current_employee_id();
  v_record public.overtime_records%ROWTYPE;
  v_target public.employees%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد جلسة أو منشأة نشطة.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_record
  FROM public.overtime_records
  WHERE id = p_overtime_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب العمل الإضافي غير موجود داخل المنشأة الحالية' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_target
  FROM public.employees
  WHERE id = v_record.employee_id
    AND company_id = v_company_id;

  IF NOT (
    public.current_user_has_role_for_company(
      v_company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
    OR (
      public.current_user_has_role_for_company(v_company_id, ARRAY['line_manager'])
      AND v_target.manager_id = v_caller_employee_id
    )
  ) THEN
    RAISE EXCEPTION 'غير مصرح باعتماد العمل الإضافي' USING ERRCODE = '42501';
  END IF;

  IF v_record.status <> 'pending' THEN
    RAISE EXCEPTION 'تم اتخاذ القرار في طلب العمل الإضافي مسبقاً (الحالة: %)', v_record.status
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.overtime_records
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = now()
  WHERE id = p_overtime_id;

  RETURN jsonb_build_object(
    'ok', true,
    'overtimeId', p_overtime_id,
    'employeeId', v_record.employee_id,
    'hours', v_record.hours,
    'approvedBy', auth.uid(),
    'approvedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_overtime_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_overtime_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_overtime_request(p_overtime_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_caller_employee_id uuid := public.current_employee_id();
  v_record public.overtime_records%ROWTYPE;
  v_target public.employees%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد جلسة أو منشأة نشطة.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_record
  FROM public.overtime_records
  WHERE id = p_overtime_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب العمل الإضافي غير موجود داخل المنشأة الحالية' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_target
  FROM public.employees
  WHERE id = v_record.employee_id
    AND company_id = v_company_id;

  IF NOT (
    public.current_user_has_role_for_company(
      v_company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
    OR (
      public.current_user_has_role_for_company(v_company_id, ARRAY['line_manager'])
      AND v_target.manager_id = v_caller_employee_id
    )
  ) THEN
    RAISE EXCEPTION 'غير مصرح برفض العمل الإضافي' USING ERRCODE = '42501';
  END IF;

  IF v_record.status <> 'pending' THEN
    RAISE EXCEPTION 'تم اتخاذ القرار في طلب العمل الإضافي مسبقاً (الحالة: %)', v_record.status
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.overtime_records
  SET status = 'rejected',
      approved_by = auth.uid(),
      approved_at = now()
  WHERE id = p_overtime_id;

  RETURN jsonb_build_object(
    'ok', true,
    'overtimeId', p_overtime_id,
    'rejectedBy', auth.uid(),
    'rejectedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_overtime_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_overtime_request(uuid) TO authenticated;

-- --------------------------------------------------------------------------
-- 21) Tenant-safe correction decisions without fabricated 08:00/17:00.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_attendance_correction(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_caller_employee_id uuid := public.current_employee_id();
  v_req public.requests%ROWTYPE;
  v_target public.employees%ROWTYPE;
  v_payload jsonb;
  v_work_date date;
  v_check_in time;
  v_check_out time;
  v_att public.attendance_records%ROWTYPE;
  v_schedule public.schedule_assignments%ROWTYPE;
  v_shift public.shifts%ROWTYPE;
  v_worked_minutes integer := 0;
  v_late_minutes integer := 0;
  v_early_minutes integer := 0;
  v_overtime_minutes integer := 0;
  v_start_minutes integer;
  v_end_minutes integer;
  v_in_minutes integer;
  v_out_minutes integer;
  v_status public.attendance_status := 'present';
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد جلسة أو منشأة نشطة.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.requests
  WHERE id = p_request_id
    AND company_id = v_company_id
    AND type = 'attendance_fix'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب تصحيح البصمة غير موجود داخل المنشأة الحالية' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_target
  FROM public.employees
  WHERE id = v_req.employee_id
    AND company_id = v_company_id;

  IF NOT (
    public.current_user_has_role_for_company(
      v_company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
    OR (
      public.current_user_has_role_for_company(v_company_id, ARRAY['line_manager'])
      AND v_target.manager_id = v_caller_employee_id
    )
  ) THEN
    RAISE EXCEPTION 'غير مصرح باعتماد تصحيح البصمة' USING ERRCODE = '42501';
  END IF;

  IF v_req.created_by = auth.uid()
     AND NOT public.current_user_has_role_for_company(v_company_id, ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'لا يمكن لصاحب الطلب اعتماد طلبه بنفسه' USING ERRCODE = '42501';
  END IF;

  IF v_req.status::text NOT IN ('pending','pending_approval') THEN
    RAISE EXCEPTION 'تم اتخاذ القرار في هذا الطلب مسبقاً (الحالة: %)', v_req.status
      USING ERRCODE = '23505';
  END IF;

  v_payload := COALESCE(v_req.payload, '{}'::jsonb);
  v_work_date := COALESCE((v_payload->>'workDate')::date, v_req.start_date);

  IF v_work_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ التصحيح غير موجود' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance_periods
    WHERE company_id = v_company_id
      AND period_year = EXTRACT(YEAR FROM v_work_date)::integer
      AND period_month = EXTRACT(MONTH FROM v_work_date)::integer
      AND status = 'closed'
  ) THEN
    RAISE EXCEPTION 'فترة الحضور لهذا التاريخ مغلقة' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_att
  FROM public.attendance_records
  WHERE employee_id = v_req.employee_id
    AND work_date = v_work_date
  FOR UPDATE;

  v_check_in := COALESCE(
    NULLIF(COALESCE(v_payload->>'correctInTime', v_payload->>'correctIn'), '')::time,
    v_att.check_in
  );
  v_check_out := COALESCE(
    NULLIF(COALESCE(v_payload->>'correctOutTime', v_payload->>'correctOut'), '')::time,
    v_att.check_out
  );

  IF v_check_in IS NULL OR v_check_out IS NULL THEN
    RAISE EXCEPTION 'لا يمكن اعتماد التصحيح دون وقت دخول وخروج كامل بعد دمج السجل الحالي'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_schedule
  FROM public.schedule_assignments
  WHERE employee_id = v_req.employee_id
    AND work_date = v_work_date
    AND status = 'published'
  LIMIT 1;

  IF v_schedule.shift_id IS NOT NULL THEN
    SELECT * INTO v_shift
    FROM public.shifts
    WHERE id = v_schedule.shift_id;
  END IF;

  v_in_minutes := EXTRACT(HOUR FROM v_check_in)::integer * 60
                + EXTRACT(MINUTE FROM v_check_in)::integer;
  v_out_minutes := EXTRACT(HOUR FROM v_check_out)::integer * 60
                 + EXTRACT(MINUTE FROM v_check_out)::integer;
  IF v_out_minutes <= v_in_minutes THEN
    v_out_minutes := v_out_minutes + 1440;
  END IF;
  v_worked_minutes := v_out_minutes - v_in_minutes;

  IF v_shift.id IS NOT NULL THEN
    v_start_minutes := EXTRACT(HOUR FROM v_shift.start_time)::integer * 60
                     + EXTRACT(MINUTE FROM v_shift.start_time)::integer;
    v_end_minutes := EXTRACT(HOUR FROM v_shift.end_time)::integer * 60
                   + EXTRACT(MINUTE FROM v_shift.end_time)::integer;
    IF v_end_minutes <= v_start_minutes THEN
      v_end_minutes := v_end_minutes + 1440;
    END IF;

    IF v_in_minutes < v_start_minutes - 720 THEN
      v_in_minutes := v_in_minutes + 1440;
    END IF;

    v_late_minutes := GREATEST(
      0,
      v_in_minutes - v_start_minutes - COALESCE(v_shift.grace_minutes_arrival, 0)
    );
    v_early_minutes := GREATEST(
      0,
      v_end_minutes - v_out_minutes - COALESCE(v_shift.grace_minutes_departure, 0)
    );
    IF v_shift.overtime_eligible IS NOT FALSE THEN
      v_overtime_minutes := GREATEST(0, v_out_minutes - v_end_minutes);
    END IF;
  END IF;

  v_status := CASE
    WHEN v_late_minutes > 0 THEN 'late'::public.attendance_status
    WHEN v_early_minutes > 0 THEN 'early_departure'::public.attendance_status
    ELSE 'present'::public.attendance_status
  END;

  UPDATE public.requests
  SET status = 'approved',
      decided_by = auth.uid(),
      decided_at = now(),
      decision_note = 'تم اعتماد تصحيح البصمة وتحديث سجل الحضور'
  WHERE id = p_request_id;

  INSERT INTO public.attendance_records (
    employee_id,
    company_id,
    work_date,
    shift_id,
    scheduled_in,
    scheduled_out,
    check_in,
    check_out,
    status,
    worked_hours,
    worked_minutes,
    late_minutes,
    early_departure_minutes,
    overtime_hours,
    overtime_minutes,
    is_manual,
    punch_source,
    geofence_valid,
    violations_count,
    reviewed_by_payroll,
    note,
    processed_at
  ) VALUES (
    v_req.employee_id,
    v_company_id,
    v_work_date,
    v_schedule.shift_id,
    v_shift.start_time,
    v_shift.end_time,
    v_check_in,
    v_check_out,
    v_status,
    round((v_worked_minutes::numeric / 60.0), 2),
    v_worked_minutes,
    v_late_minutes,
    v_early_minutes,
    round((v_overtime_minutes::numeric / 60.0), 2),
    v_overtime_minutes,
    true,
    'correction_request',
    NULL,
    (CASE WHEN v_late_minutes > 0 THEN 1 ELSE 0 END)
      + (CASE WHEN v_early_minutes > 0 THEN 1 ELSE 0 END),
    false,
    'تم تصحيح البصمة بموجب طلب معتمد',
    now()
  )
  ON CONFLICT (employee_id, work_date)
  DO UPDATE SET
    company_id = EXCLUDED.company_id,
    shift_id = EXCLUDED.shift_id,
    scheduled_in = EXCLUDED.scheduled_in,
    scheduled_out = EXCLUDED.scheduled_out,
    check_in = EXCLUDED.check_in,
    check_out = EXCLUDED.check_out,
    status = EXCLUDED.status,
    worked_hours = EXCLUDED.worked_hours,
    worked_minutes = EXCLUDED.worked_minutes,
    late_minutes = EXCLUDED.late_minutes,
    early_departure_minutes = EXCLUDED.early_departure_minutes,
    overtime_hours = EXCLUDED.overtime_hours,
    overtime_minutes = EXCLUDED.overtime_minutes,
    is_manual = true,
    punch_source = 'correction_request',
    geofence_valid = NULL,
    violations_count = EXCLUDED.violations_count,
    reviewed_by_payroll = false,
    note = EXCLUDED.note,
    processed_at = now();

  INSERT INTO public.request_timeline (
    request_id, step_number, actor_id, actor_name, actor_role, action, note
  ) VALUES (
    p_request_id,
    COALESCE(v_req.current_step_index, 1),
    auth.uid(),
    'Attendance Approver',
    'attendance_approver',
    'approved',
    'تم اعتماد تصحيح البصمة'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'requestId', p_request_id,
    'employeeId', v_req.employee_id,
    'workDate', v_work_date,
    'approvedBy', auth.uid(),
    'approvedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_attendance_correction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_attendance_correction(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_attendance_correction(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_caller_employee_id uuid := public.current_employee_id();
  v_req public.requests%ROWTYPE;
  v_target public.employees%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد جلسة أو منشأة نشطة.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.requests
  WHERE id = p_request_id
    AND company_id = v_company_id
    AND type = 'attendance_fix'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب تصحيح البصمة غير موجود داخل المنشأة الحالية' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_target
  FROM public.employees
  WHERE id = v_req.employee_id
    AND company_id = v_company_id;

  IF NOT (
    public.current_user_has_role_for_company(
      v_company_id,
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
    OR (
      public.current_user_has_role_for_company(v_company_id, ARRAY['line_manager'])
      AND v_target.manager_id = v_caller_employee_id
    )
  ) THEN
    RAISE EXCEPTION 'غير مصرح برفض تصحيح البصمة' USING ERRCODE = '42501';
  END IF;

  IF v_req.created_by = auth.uid()
     AND NOT public.current_user_has_role_for_company(v_company_id, ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'لا يمكن لصاحب الطلب رفض طلبه بنفسه' USING ERRCODE = '42501';
  END IF;

  IF v_req.status::text NOT IN ('pending','pending_approval') THEN
    RAISE EXCEPTION 'تم اتخاذ القرار في هذا الطلب مسبقاً (الحالة: %)', v_req.status
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.requests
  SET status = 'rejected',
      decided_by = auth.uid(),
      decided_at = now(),
      decision_note = 'تم رفض طلب تصحيح البصمة'
  WHERE id = p_request_id;

  INSERT INTO public.request_timeline (
    request_id, step_number, actor_id, actor_name, actor_role, action, note
  ) VALUES (
    p_request_id,
    COALESCE(v_req.current_step_index, 1),
    auth.uid(),
    'Attendance Approver',
    'attendance_approver',
    'rejected',
    'تم رفض تصحيح البصمة'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'requestId', p_request_id,
    'rejectedBy', auth.uid(),
    'rejectedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_attendance_correction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_attendance_correction(uuid) TO authenticated;

-- --------------------------------------------------------------------------
-- 22) Harden attendance-period close: every published working schedule must
--     have a processed attendance row; correction/overtime decisions must be final.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_attendance_period(
  p_year integer,
  p_month integer,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.current_user_company_id();
  v_timezone text;
  v_from date;
  v_to date;
  v_pending_punches integer;
  v_missing_records integer;
  v_unprocessed_schedules integer;
  v_pending_corrections integer;
  v_pending_overtime integer;
  v_period_id uuid;
BEGIN
  IF p_year < 2000 OR p_year > 2200 OR p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'فترة الحضور غير صالحة.';
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد منشأة مرتبطة بالحساب الحالي.';
  END IF;
  IF NOT public.current_user_has_role_for_company(
    v_company_id,
    ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
  ) THEN
    RAISE EXCEPTION 'غير مصرح بإغلاق فترة الحضور.';
  END IF;

  SELECT timezone INTO v_timezone
  FROM public.companies
  WHERE id = v_company_id;

  IF v_timezone IS NULL OR btrim(v_timezone) = '' THEN
    RAISE EXCEPTION 'لم يتم إعداد المنطقة الزمنية للمنشأة.';
  END IF;

  BEGIN
    PERFORM now() AT TIME ZONE v_timezone;
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE EXCEPTION 'المنطقة الزمنية للمنشأة غير صالحة.';
  END;

  v_from := make_date(p_year, p_month, 1);
  v_to := (v_from + interval '1 month - 1 day')::date;

  SELECT count(*) INTO v_pending_punches
  FROM public.punches p
  WHERE p.company_id = v_company_id
    AND p.approval_status = 'pending'
    AND (p.punch_time AT TIME ZONE v_timezone)::date BETWEEN v_from AND v_to;

  SELECT count(*) INTO v_missing_records
  FROM public.attendance_records a
  WHERE a.company_id = v_company_id
    AND a.work_date BETWEEN v_from AND v_to
    AND (
      a.status::text = 'missing_punch'
      OR (
        (a.check_in IS NULL OR a.check_out IS NULL)
        AND a.status::text NOT IN ('absent','leave','holiday','rest_day')
      )
    );

  SELECT count(*) INTO v_unprocessed_schedules
  FROM public.schedule_assignments sa
  JOIN public.employees e ON e.id = sa.employee_id
  WHERE e.company_id = v_company_id
    AND sa.work_date BETWEEN v_from AND v_to
    AND sa.status = 'published'
    AND NOT sa.is_rest_day
    AND NOT EXISTS (
      SELECT 1
      FROM public.attendance_records a
      WHERE a.employee_id = sa.employee_id
        AND a.work_date = sa.work_date
        AND a.company_id = v_company_id
    );

  SELECT count(*) INTO v_pending_corrections
  FROM public.requests r
  WHERE r.company_id = v_company_id
    AND r.type = 'attendance_fix'
    AND COALESCE(r.start_date, (r.payload->>'workDate')::date) BETWEEN v_from AND v_to
    AND r.status::text IN ('pending','pending_approval','returned');

  SELECT count(*) INTO v_pending_overtime
  FROM public.overtime_records o
  WHERE o.company_id = v_company_id
    AND o.work_date BETWEEN v_from AND v_to
    AND o.status = 'pending';

  IF v_pending_punches > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: توجد % بصمة معلقة بانتظار المراجعة.', v_pending_punches;
  END IF;
  IF v_missing_records > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: توجد % حالة بصمة ناقصة تحتاج للمراجعة.', v_missing_records;
  END IF;
  IF v_unprocessed_schedules > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: توجد % وردية منشورة لم تتم معالجتها.', v_unprocessed_schedules;
  END IF;
  IF v_pending_corrections > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: توجد % طلبات تصحيح بصمة غير محسومة.', v_pending_corrections;
  END IF;
  IF v_pending_overtime > 0 THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: توجد % تكليفات عمل إضافي غير محسومة.', v_pending_overtime;
  END IF;

  INSERT INTO public.attendance_periods (
    company_id, period_year, period_month, status, closed_by, closed_at, close_note
  ) VALUES (
    v_company_id, p_year, p_month, 'closed', auth.uid(), now(), NULLIF(btrim(COALESCE(p_note,'')), '')
  )
  ON CONFLICT (company_id, period_year, period_month)
  DO UPDATE SET
    status = 'closed',
    closed_by = auth.uid(),
    closed_at = now(),
    close_note = EXCLUDED.close_note,
    updated_at = now()
  RETURNING id INTO v_period_id;

  RETURN jsonb_build_object(
    'success', true,
    'period_id', v_period_id,
    'year', p_year,
    'month', p_month,
    'status', 'closed'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_attendance_period(integer,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_attendance_period(integer,integer,text) TO authenticated;

COMMIT;
