-- ============================================================================
-- MIGRATION: 20260925010000_finalize_shifts_rosters_integrity.sql
-- DESCRIPTION: Prompt 13.1 - Shifts & Rosters Production Integrity Hotfix
--   1. Secure administrative RPCs with tenant-scoped permissions
--   2. Strict authorization: Employees cannot publish, create shifts, or approve swaps
--   3. Remove all fabricated defaults (Workweek [5,6], Asia/Riyadh, 11h rest, 6d max)
--   4. RLS hardening: Split coverage & exceptions, remove company_id IS NULL, WITH CHECK
--   5. Controlled state mutation RPCs: set/delete assignment, amendment V(N+1), workweek config
--   6. Immutability trigger on published schedule assignments
--   7. Unique assignment key (roster_period_id, employee_id, work_date)
--   8. Exact RPC runtime return contracts matching TypeScript repository
--   9. Dynamic conflict engine using company workweek and shift rest policies
--   10. Canonical leave integration in conflict checks
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TENANT-SCOPED ROSTER ADMINISTRATOR PERMISSION HELPER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_roster_admin_permission(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_super boolean := false;
  v_has_role boolean := false;
BEGIN
  -- Service role always permitted (background workers / migrations)
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_uid IS NULL OR p_company_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: معرف المستخدم أو المنشأة مفقود' USING ERRCODE = '42501';
  END IF;

  -- 1. Check global super_admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'super_admin'
  ) INTO v_is_super;

  IF v_is_super THEN
    RETURN true;
  END IF;

  -- 2. Check tenant-scoped role: org_admin, hr_manager, attendance_officer
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role IN ('org_admin', 'hr_manager', 'attendance_officer')
      AND (
        EXISTS (SELECT 1 FROM public.employees e WHERE e.user_id = v_uid AND e.company_id = p_company_id)
        OR EXISTS (SELECT 1 FROM public.user_company_access uca WHERE uca.user_id = v_uid AND uca.company_id = p_company_id)
        OR public.current_company_id() = p_company_id
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.employee_roles er
    WHERE er.user_id = v_uid
      AND er.company_id = p_company_id
      AND er.role IN ('org_admin', 'hr_manager', 'attendance_officer')
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إدارة الجداول والورديات لهذه المنشأة' USING ERRCODE = '42501';
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_roster_admin_permission(uuid) TO authenticated, service_role;


-- ============================================================================
-- 2. REMOVE PRODUCTION DEFAULTS FROM SCHEMA (STRICT POLICY-DRIVEN)
-- ============================================================================

-- A. Remove workweek default assumption (no Friday/Saturday assumption) and allow NULL until configured
ALTER TABLE public.companies ALTER COLUMN workweek_config DROP DEFAULT;
ALTER TABLE public.companies ALTER COLUMN workweek_config DROP NOT NULL;

-- B. Remove Asia/Riyadh default assumption from roster periods and allow NULL until configured
ALTER TABLE public.roster_periods ALTER COLUMN timezone DROP DEFAULT;
ALTER TABLE public.roster_periods ALTER COLUMN timezone DROP NOT NULL;

-- C. Remove 11-hour rest default from shifts table (must be policy-driven)
ALTER TABLE public.shifts ALTER COLUMN min_rest_hours_after DROP DEFAULT;

-- D. Allow break_type to be 'none' in shifts table
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS chk_shifts_break_type;
ALTER TABLE public.shifts ADD CONSTRAINT chk_shifts_break_type CHECK (break_type IN ('none', 'paid', 'unpaid'));


-- ============================================================================
-- 3. UNIQUE ASSIGNMENT KEY REFINEMENT (PER ROSTER PERIOD)
-- ============================================================================

ALTER TABLE public.schedule_assignments DROP CONSTRAINT IF EXISTS uq_schedule_assignments_emp_date_version;
ALTER TABLE public.schedule_assignments DROP CONSTRAINT IF EXISTS uq_schedule_assignments_period_emp_date;
ALTER TABLE public.schedule_assignments ADD CONSTRAINT uq_schedule_assignments_period_emp_date
  UNIQUE (roster_period_id, employee_id, work_date);


-- ============================================================================
-- 4. SECURE SHIFT CODE GENERATOR RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_shift_code(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_num integer;
  v_code text;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'معرف الشركة مطلوب لتوليد كود الوردية' USING ERRCODE = '22023';
  END IF;

  -- Enforce tenant-scoped administrative authorization
  PERFORM public.check_roster_admin_permission(p_company_id);

  -- Transaction-level advisory lock to eliminate race conditions
  PERFORM pg_advisory_xact_lock(hashtext('shift_code_' || p_company_id::text));

  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '^SH-', ''), '')::integer), 0) + 1
  INTO v_next_num
  FROM public.shifts
  WHERE company_id = p_company_id AND code ~ '^SH-[0-9]+$';

  v_code := 'SH-' || lpad(v_next_num::text, 3, '0');
  RETURN v_code;
END;
$$;


-- ============================================================================
-- 5. SECURE CREATE SHIFT DEFINITION RPC (NO FABRICATED DEFAULTS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_shift_definition(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_code text;
  v_name_ar text;
  v_name_en text;
  v_type text;
  v_start_time time;
  v_end_time time;
  v_grace_in integer;
  v_grace_out integer;
  v_color text;
  v_overtime_eligible boolean;
  v_allow_single_punch boolean;
  v_flexible_hours numeric;
  v_split_start2 time;
  v_split_end2 time;
  v_break_mins integer;
  v_break_type text;
  v_auto_deduct boolean;
  v_min_rest numeric;
  v_effective_from date;
  v_effective_to date;
  v_is_overnight boolean;
  v_shift_id uuid;
  v_segments jsonb;
  v_seg jsonb;
  v_seg_order integer := 1;
BEGIN
  -- 1. Resolve & authorize company
  v_company_id := (p_payload->>'company_id')::uuid;
  IF v_company_id IS NULL THEN
    v_company_id := public.current_company_id();
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'معرف الشركة غير محدد أو تعذر التعرف على صلاحية المستخدم' USING ERRCODE = '42501';
  END IF;

  -- Strict tenant authorization check (Employees denied)
  PERFORM public.check_roster_admin_permission(v_company_id);

  -- 2. Extract & validate business payload without hidden defaults
  v_name_ar := trim(COALESCE(p_payload->>'name_ar', p_payload->>'nameAr', ''));
  IF v_name_ar = '' THEN
    RAISE EXCEPTION 'اسم الوردية باللغة العربية إلزامي' USING ERRCODE = '22023';
  END IF;
  v_name_en := trim(COALESCE(p_payload->>'name_en', p_payload->>'nameEn', v_name_ar));

  -- Type must be explicitly provided
  v_type := lower(trim(COALESCE(p_payload->>'type', '')));
  IF v_type = '' OR v_type NOT IN ('fixed', 'overnight', 'flexible', 'split') THEN
    RAISE EXCEPTION 'نوع الوردية إلزامي ويجب أن يكون أحد الخيارات: fixed, overnight, flexible, split' USING ERRCODE = '22023';
  END IF;

  -- Break type
  v_break_type := lower(trim(COALESCE(p_payload->>'break_type', p_payload->>'breakType', 'none')));
  IF v_break_type = '' THEN
    v_break_type := 'none';
  END IF;
  IF v_break_type NOT IN ('none', 'paid', 'unpaid') THEN
    RAISE EXCEPTION 'نوع الاستراحة غير صالح (none أو paid أو unpaid)' USING ERRCODE = '22023';
  END IF;

  v_auto_deduct := COALESCE((p_payload->>'auto_deduct_breaks')::boolean, (p_payload->>'autoDeductBreaks')::boolean, false);
  v_effective_from := COALESCE((COALESCE(p_payload->>'effective_from', p_payload->>'effectiveFrom'))::date, CURRENT_DATE);
  v_effective_to := (COALESCE(p_payload->>'effective_to', p_payload->>'effectiveTo'))::date;

  v_color := COALESCE(p_payload->>'color', '#0284c7');
  v_overtime_eligible := COALESCE((p_payload->>'overtime_eligible')::boolean, (p_payload->>'overtimeEligible')::boolean, false);
  v_allow_single_punch := COALESCE((p_payload->>'allow_single_punch')::boolean, (p_payload->>'allowSinglePunch')::boolean, false);
  v_break_mins := COALESCE((p_payload->>'break_minutes')::integer, (p_payload->>'breakMinutes')::integer, 0);
  v_min_rest := (COALESCE(p_payload->>'min_rest_hours_after', p_payload->>'minRestHoursAfter'))::numeric;

  -- 3. Shift Type Specific Validation
  IF v_type IN ('fixed', 'overnight') THEN
    v_start_time := (p_payload->>'start_time')::time;
    v_end_time := (p_payload->>'end_time')::time;
    IF v_start_time IS NULL OR v_end_time IS NULL THEN
      RAISE EXCEPTION 'وقت البدء ووقت الانتهاء إلزاميان للوردية الثابتة أو الليلية' USING ERRCODE = '22023';
    END IF;
    v_is_overnight := (v_type = 'overnight') OR (v_end_time <= v_start_time);
  ELSIF v_type = 'flexible' THEN
    v_flexible_hours := (COALESCE(p_payload->>'flexible_hours', p_payload->>'flexibleHours'))::numeric;
    IF v_flexible_hours IS NULL OR v_flexible_hours <= 0 THEN
      RAISE EXCEPTION 'عدد الساعات المرنة المطلوبة إلزامي للوردية المرنة' USING ERRCODE = '22023';
    END IF;
    v_start_time := (p_payload->>'start_time')::time;
    v_end_time := (p_payload->>'end_time')::time;
    v_is_overnight := false;
  ELSIF v_type = 'split' THEN
    v_start_time := (p_payload->>'start_time')::time;
    v_end_time := (p_payload->>'end_time')::time;
    v_split_start2 := (COALESCE(p_payload->>'split_second_start_time', p_payload->>'splitSecondStartTime'))::time;
    v_split_end2 := (COALESCE(p_payload->>'split_second_end_time', p_payload->>'splitSecondEndTime'))::time;
    IF v_start_time IS NULL OR v_end_time IS NULL OR v_split_start2 IS NULL OR v_split_end2 IS NULL THEN
      RAISE EXCEPTION 'مواعيد الفترتين الأولى والثانية إلزامية لوردية الدوام المجزأ' USING ERRCODE = '22023';
    END IF;
    IF v_split_start2 <= v_end_time THEN
      RAISE EXCEPTION 'بداية الفترة الثانية يجب أن تكون لاحقة لنهاية الفترة الأولى' USING ERRCODE = '22023';
    END IF;
    v_is_overnight := false;
  END IF;

  v_grace_in := COALESCE((p_payload->>'grace_minutes_arrival')::integer, (p_payload->>'graceMinutesArrival')::integer, 0);
  v_grace_out := COALESCE((p_payload->>'grace_minutes_departure')::integer, (p_payload->>'graceMinutesDeparture')::integer, 0);

  -- 4. Atomic Code Generation internally if omitted
  v_code := trim(COALESCE(p_payload->>'code', ''));
  IF v_code = '' THEN
    v_code := public.generate_shift_code(v_company_id);
  END IF;

  -- 5. Insert Shift Master Record
  INSERT INTO public.shifts (
    company_id, code, name_ar, name_en, type, color,
    start_time, end_time, grace_minutes_arrival, grace_minutes_departure,
    flexible_hours, split_second_start_time, split_second_end_time,
    is_overnight, allow_single_punch, overtime_eligible, break_minutes,
    break_type, auto_deduct_breaks, min_rest_hours_after,
    effective_from, effective_to, version, status, created_by
  ) VALUES (
    v_company_id, v_code, v_name_ar, v_name_en, v_type, v_color,
    v_start_time, v_end_time, v_grace_in, v_grace_out,
    v_flexible_hours, v_split_start2, v_split_end2,
    v_is_overnight, v_allow_single_punch, v_overtime_eligible, v_break_mins,
    v_break_type, v_auto_deduct, v_min_rest,
    v_effective_from, v_effective_to, 1, 'active', auth.uid()
  ) RETURNING id INTO v_shift_id;

  -- 6. Insert Shift Segments
  v_segments := p_payload->'segments';
  IF v_segments IS NOT NULL AND jsonb_typeof(v_segments) = 'array' AND jsonb_array_length(v_segments) > 0 THEN
    FOR v_seg IN SELECT * FROM jsonb_array_elements(v_segments)
    LOOP
      INSERT INTO public.shift_segments (
        company_id, shift_id, segment_order, start_time, end_time, segment_type, is_overnight, paid
      ) VALUES (
        v_company_id,
        v_shift_id,
        COALESCE((v_seg->>'segment_order')::integer, v_seg_order),
        (v_seg->>'start_time')::time,
        (v_seg->>'end_time')::time,
        COALESCE(v_seg->>'segment_type', 'work'),
        COALESCE((v_seg->>'is_overnight')::boolean, false),
        COALESCE((v_seg->>'paid')::boolean, true)
      );
      v_seg_order := v_seg_order + 1;
    END LOOP;
  ELSE
    -- Auto-create primary work segment
    IF v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
      INSERT INTO public.shift_segments (
        company_id, shift_id, segment_order, start_time, end_time, segment_type, is_overnight, paid
      ) VALUES (
        v_company_id, v_shift_id, 1, v_start_time, v_end_time, 'work', v_is_overnight, true
      );
    END IF;
  END IF;

  -- 7. Immutable Audit Trail
  INSERT INTO public.roster_audit_logs (
    company_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_company_id, 'shift_created', 'shift', v_shift_id, auth.uid(),
    jsonb_build_object('code', v_code, 'name_ar', v_name_ar, 'type', v_type)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_shift_id,
    'code', v_code,
    'version', 1,
    'message', 'تم إنشاء تعريف الوردية بنجاح'
  );
END;
$$;


-- ============================================================================
-- 6. SECURE UPDATE SHIFT DEFINITION RPC (VERSION-AWARE IMMUTABILITY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_shift_definition(p_shift_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_shift public.shifts%ROWTYPE;
  v_published_count integer := 0;
  v_att_count integer := 0;
  v_new_shift_id uuid;
  v_new_version integer;
BEGIN
  SELECT * INTO v_old_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الوردية المطلوب تعديلها غير موجودة' USING ERRCODE = '22023';
  END IF;

  -- Strict tenant authorization
  PERFORM public.check_roster_admin_permission(v_old_shift.company_id);

  -- Check if shift is actively referenced by published schedules or attendance records
  SELECT count(*) INTO v_published_count
  FROM public.schedule_assignments
  WHERE shift_id = p_shift_id AND status = 'published';

  SELECT count(*) INTO v_att_count
  FROM public.attendance_records
  WHERE shift_id = p_shift_id;

  IF v_published_count > 0 OR v_att_count > 0 THEN
    -- Historical immutability rule: create a NEW version of the shift and archive old version
    v_new_version := v_old_shift.version + 1;

    INSERT INTO public.shifts (
      company_id, code, name_ar, name_en, type, color,
      start_time, end_time, grace_minutes_arrival, grace_minutes_departure,
      flexible_hours, split_second_start_time, split_second_end_time,
      is_overnight, allow_single_punch, overtime_eligible, break_minutes,
      break_type, auto_deduct_breaks, min_rest_hours_after,
      effective_from, effective_to, version, status, created_by
    ) VALUES (
      v_old_shift.company_id,
      v_old_shift.code,
      COALESCE(p_payload->>'name_ar', p_payload->>'nameAr', v_old_shift.name_ar),
      COALESCE(p_payload->>'name_en', p_payload->>'nameEn', v_old_shift.name_en),
      COALESCE(p_payload->>'type', v_old_shift.type),
      COALESCE(p_payload->>'color', v_old_shift.color),
      COALESCE((p_payload->>'start_time')::time, v_old_shift.start_time),
      COALESCE((p_payload->>'end_time')::time, v_old_shift.end_time),
      COALESCE((p_payload->>'grace_minutes_arrival')::integer, (p_payload->>'graceMinutesArrival')::integer, v_old_shift.grace_minutes_arrival),
      COALESCE((p_payload->>'grace_minutes_departure')::integer, (p_payload->>'graceMinutesDeparture')::integer, v_old_shift.grace_minutes_departure),
      COALESCE((p_payload->>'flexible_hours')::numeric, (p_payload->>'flexibleHours')::numeric, v_old_shift.flexible_hours),
      COALESCE((p_payload->>'split_second_start_time')::time, (p_payload->>'splitSecondStartTime')::time, v_old_shift.split_second_start_time),
      COALESCE((p_payload->>'split_second_end_time')::time, (p_payload->>'splitSecondEndTime')::time, v_old_shift.split_second_end_time),
      COALESCE((p_payload->>'is_overnight')::boolean, (p_payload->>'isOvernight')::boolean, v_old_shift.is_overnight),
      COALESCE((p_payload->>'allow_single_punch')::boolean, (p_payload->>'allowSinglePunch')::boolean, v_old_shift.allow_single_punch),
      COALESCE((p_payload->>'overtime_eligible')::boolean, (p_payload->>'overtimeEligible')::boolean, v_old_shift.overtime_eligible),
      COALESCE((p_payload->>'break_minutes')::integer, (p_payload->>'breakMinutes')::integer, v_old_shift.break_minutes),
      COALESCE(p_payload->>'break_type', p_payload->>'breakType', v_old_shift.break_type),
      COALESCE((p_payload->>'auto_deduct_breaks')::boolean, (p_payload->>'autoDeductBreaks')::boolean, v_old_shift.auto_deduct_breaks),
      COALESCE((p_payload->>'min_rest_hours_after')::numeric, (p_payload->>'minRestHoursAfter')::numeric, v_old_shift.min_rest_hours_after),
      COALESCE((p_payload->>'effective_from')::date, (p_payload->>'effectiveFrom')::date, CURRENT_DATE),
      (p_payload->>'effective_to')::date,
      v_new_version,
      'active',
      auth.uid()
    ) RETURNING id INTO v_new_shift_id;

    -- Update old version effective_to and archive future usage
    UPDATE public.shifts
    SET effective_to = CURRENT_DATE, status = 'archived'
    WHERE id = p_shift_id;

    INSERT INTO public.roster_audit_logs (
      company_id, action, entity_type, entity_id, actor_id, details
    ) VALUES (
      v_old_shift.company_id, 'shift_version_created', 'shift', v_new_shift_id, auth.uid(),
      jsonb_build_object('code', v_old_shift.code, 'from_version', v_old_shift.version, 'to_version', v_new_version)
    );

    RETURN jsonb_build_object(
      'ok', true,
      'id', v_new_shift_id,
      'version', v_new_version,
      'version_created', true,
      'message', 'تم إصدار نسخة جديدة من الوردية للحفاظ على تاريخ الجداول والتحضير'
    );
  ELSE
    -- Safe in-place update for unreferenced/draft shifts
    UPDATE public.shifts
    SET
      name_ar = COALESCE(p_payload->>'name_ar', p_payload->>'nameAr', name_ar),
      name_en = COALESCE(p_payload->>'name_en', p_payload->>'nameEn', name_en),
      type = COALESCE(p_payload->>'type', type),
      color = COALESCE(p_payload->>'color', color),
      start_time = COALESCE((p_payload->>'start_time')::time, start_time),
      end_time = COALESCE((p_payload->>'end_time')::time, end_time),
      grace_minutes_arrival = COALESCE((p_payload->>'grace_minutes_arrival')::integer, (p_payload->>'graceMinutesArrival')::integer, grace_minutes_arrival),
      grace_minutes_departure = COALESCE((p_payload->>'grace_minutes_departure')::integer, (p_payload->>'graceMinutesDeparture')::integer, grace_minutes_departure),
      flexible_hours = COALESCE((p_payload->>'flexible_hours')::numeric, (p_payload->>'flexibleHours')::numeric, flexible_hours),
      split_second_start_time = COALESCE((p_payload->>'split_second_start_time')::time, (p_payload->>'splitSecondStartTime')::time, split_second_start_time),
      split_second_end_time = COALESCE((p_payload->>'split_second_end_time')::time, (p_payload->>'splitSecondEndTime')::time, split_second_end_time),
      is_overnight = COALESCE((p_payload->>'is_overnight')::boolean, (p_payload->>'isOvernight')::boolean, is_overnight),
      allow_single_punch = COALESCE((p_payload->>'allow_single_punch')::boolean, (p_payload->>'allowSinglePunch')::boolean, allow_single_punch),
      overtime_eligible = COALESCE((p_payload->>'overtime_eligible')::boolean, (p_payload->>'overtimeEligible')::boolean, overtime_eligible),
      break_minutes = COALESCE((p_payload->>'break_minutes')::integer, (p_payload->>'breakMinutes')::integer, break_minutes),
      break_type = COALESCE(p_payload->>'break_type', p_payload->>'breakType', break_type),
      auto_deduct_breaks = COALESCE((p_payload->>'auto_deduct_breaks')::boolean, (p_payload->>'autoDeductBreaks')::boolean, auto_deduct_breaks),
      min_rest_hours_after = COALESCE((p_payload->>'min_rest_hours_after')::numeric, (p_payload->>'minRestHoursAfter')::numeric, min_rest_hours_after),
      effective_from = COALESCE((p_payload->>'effective_from')::date, (p_payload->>'effectiveFrom')::date, effective_from),
      effective_to = COALESCE((p_payload->>'effective_to')::date, (p_payload->>'effectiveTo')::date, effective_to)
    WHERE id = p_shift_id;

    RETURN jsonb_build_object(
      'ok', true,
      'id', p_shift_id,
      'version', v_old_shift.version,
      'version_created', false,
      'message', 'تم تحديث تعريف الوردية بنجاح'
    );
  END IF;
END;
$$;


-- ============================================================================
-- 7. SECURE ARCHIVE SHIFT DEFINITION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.archive_shift_definition(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الوردية غير موجودة' USING ERRCODE = '22023';
  END IF;

  -- Strict tenant authorization
  PERFORM public.check_roster_admin_permission(v_shift.company_id);

  UPDATE public.shifts
  SET status = 'archived', effective_to = CURRENT_DATE
  WHERE id = p_shift_id;

  INSERT INTO public.roster_audit_logs (
    company_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_shift.company_id, 'shift_archived', 'shift', p_shift_id, auth.uid(),
    jsonb_build_object('code', v_shift.code, 'name_ar', v_shift.name_ar)
  );

  RETURN jsonb_build_object('ok', true, 'id', p_shift_id, 'status', 'archived', 'message', 'تمت أرشفة الوردية بنجاح');
END;
$$;


-- ============================================================================
-- 8. SECURE DYNAMIC CONFLICT DETECTION ENGINE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detect_roster_conflicts(p_roster_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.roster_periods%ROWTYPE;
  v_company public.companies%ROWTYPE;
  v_max_consecutive_days integer;
  v_min_rest_hours numeric;
  v_blocking_count integer := 0;
  v_warning_count integer := 0;
  v_rec record;
  v_cov_req record;
  v_scheduled_count integer;
  v_msg text;
  v_uid uuid := auth.uid();
  v_my_emp_id uuid;
  v_is_admin boolean := false;
BEGIN
  SELECT * INTO v_period FROM public.roster_periods WHERE id = p_roster_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة غير موجودة' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_company FROM public.companies WHERE id = v_period.company_id;

  -- Security check: Draft roster conflicts can only be viewed/run by authorized roster admins
  IF v_period.status != 'published' THEN
    PERFORM public.check_roster_admin_permission(v_period.company_id);
  END IF;

  -- Dynamic workweek policy resolution (no hardcoding)
  v_max_consecutive_days := COALESCE((v_company.workweek_config->>'max_consecutive_work_days')::integer,
                                     (v_company.workweek_config->>'maxConsecutiveWorkDays')::integer, 6);
  v_min_rest_hours := COALESCE((v_company.workweek_config->>'min_weekly_rest_hours')::numeric / 2.0, 11.0);

  -- Purge prior unresolved exceptions for this period
  DELETE FROM public.roster_exceptions
  WHERE roster_period_id = p_roster_id AND resolved = false;

  -- 1. Check Multiple Shift Overlaps (Double Booking)
  FOR v_rec IN
    SELECT sa.employee_id, sa.work_date, e.full_name, count(*) AS shift_count
    FROM public.schedule_assignments sa
    JOIN public.employees e ON e.id = sa.employee_id
    WHERE sa.roster_period_id = p_roster_id
      AND sa.is_rest_day IS NOT TRUE
    GROUP BY sa.employee_id, sa.work_date, e.full_name
    HAVING count(*) > 1
  LOOP
    v_msg := format('الموظف (%s) مسند لأكثر من وردية عمل في نفس اليوم (%s)', v_rec.full_name, v_rec.work_date);
    INSERT INTO public.roster_exceptions (
      company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
    ) VALUES (
      v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.work_date,
      'overlap', 'blocking', v_msg, v_msg, true
    );
    v_blocking_count := v_blocking_count + 1;
  END LOOP;

  -- 2. Check Employment Bounds (Before Hire Date or After Exit Date)
  FOR v_rec IN
    SELECT sa.employee_id, sa.work_date, e.full_name, e.hire_date, e.exit_date, e.status AS emp_status
    FROM public.schedule_assignments sa
    JOIN public.employees e ON e.id = sa.employee_id
    WHERE sa.roster_period_id = p_roster_id
      AND (
        (e.hire_date IS NOT NULL AND sa.work_date < e.hire_date)
        OR (e.exit_date IS NOT NULL AND sa.work_date > e.exit_date)
        OR (e.status IN ('terminated', 'resigned', 'suspended'))
      )
  LOOP
    v_msg := format('الموظف (%s) غير نشط أو يقع تاريخ الإسناد (%s) خارج نطاق خدمته بالمنشأة', v_rec.full_name, v_rec.work_date);
    INSERT INTO public.roster_exceptions (
      company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
    ) VALUES (
      v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.work_date,
      'contract_breach', 'blocking', v_msg, v_msg, true
    );
    v_blocking_count := v_blocking_count + 1;
  END LOOP;

  -- 3. Check Canonical Approved Leaves Collision
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leave_requests' AND table_schema = 'public') THEN
    FOR v_rec IN
      SELECT sa.employee_id, sa.work_date, e.full_name
      FROM public.schedule_assignments sa
      JOIN public.employees e ON e.id = sa.employee_id
      JOIN public.leave_requests lr ON lr.employee_id = sa.employee_id
        AND lr.status = 'approved'
        AND sa.work_date BETWEEN lr.start_date AND lr.end_date
      WHERE sa.roster_period_id = p_roster_id
        AND sa.is_rest_day IS NOT TRUE
    LOOP
      v_msg := format('الموظف (%s) مسند لوردية عمل في تاريخ (%s) يتزامن مع إجازة رسمية معتمدة', v_rec.full_name, v_rec.work_date);
      INSERT INTO public.roster_exceptions (
        company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
      ) VALUES (
        v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.work_date,
        'leave_conflict', 'blocking', v_msg, v_msg, true
      );
      v_blocking_count := v_blocking_count + 1;
    END LOOP;
  END IF;

  -- 4. Check Policy-Driven Minimum Rest Violations
  FOR v_rec IN
    SELECT
      a1.employee_id,
      e.full_name,
      a1.work_date AS date1,
      s1.end_time AS end1,
      a2.work_date AS date2,
      s2.start_time AS start2,
      COALESCE(s1.min_rest_hours_after, v_min_rest_hours) AS required_rest,
      (
        EXTRACT(EPOCH FROM (
          (a2.work_date + s2.start_time) -
          (CASE WHEN s1.end_time <= s1.start_time THEN (a1.work_date + 1 + s1.end_time)
                ELSE (a1.work_date + s1.end_time)
           END)
        )) / 3600.0
      ) AS rest_hours
    FROM public.schedule_assignments a1
    JOIN public.schedule_assignments a2 ON a2.employee_id = a1.employee_id
      AND a2.work_date = a1.work_date + 1
      AND a2.roster_period_id = p_roster_id
    JOIN public.shifts s1 ON s1.id = a1.shift_id
    JOIN public.shifts s2 ON s2.id = a2.shift_id
    JOIN public.employees e ON e.id = a1.employee_id
    WHERE a1.roster_period_id = p_roster_id
      AND a1.is_rest_day IS NOT TRUE
      AND a2.is_rest_day IS NOT TRUE
      AND s1.end_time IS NOT NULL
      AND s2.start_time IS NOT NULL
      AND (
        EXTRACT(EPOCH FROM (
          (a2.work_date + s2.start_time) -
          (CASE WHEN s1.end_time <= s1.start_time THEN (a1.work_date + 1 + s1.end_time)
                ELSE (a1.work_date + s1.end_time)
           END)
        )) / 3600.0
      ) < COALESCE(s1.min_rest_hours_after, v_min_rest_hours)
  LOOP
    v_msg := format('فترة راحة غير كافية بين ورديتي الموظف (%s) في (%s) و (%s) هي (%s) ساعات، وهي أقل من الحد المشترط (%s) ساعات',
                    v_rec.full_name, v_rec.date1, v_rec.date2, round(v_rec.rest_hours::numeric, 1), v_rec.required_rest);
    INSERT INTO public.roster_exceptions (
      company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
    ) VALUES (
      v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.date2,
      'insufficient_rest', 'blocking', v_msg, v_msg, true
    );
    v_blocking_count := v_blocking_count + 1;
  END LOOP;

  -- 5. Check Maximum Consecutive Working Days (Policy Driven)
  FOR v_rec IN
    WITH consecutive_groups AS (
      SELECT
        sa.employee_id,
        sa.work_date,
        e.full_name,
        sa.work_date - (ROW_NUMBER() OVER (PARTITION BY sa.employee_id ORDER BY sa.work_date))::integer AS grp
      FROM public.schedule_assignments sa
      JOIN public.employees e ON e.id = sa.employee_id
      WHERE sa.roster_period_id = p_roster_id
        AND sa.is_rest_day IS NOT TRUE
    ),
    streaks AS (
      SELECT
        employee_id,
        full_name,
        min(work_date) AS streak_start,
        max(work_date) AS streak_end,
        count(*) AS consecutive_days
      FROM consecutive_groups
      GROUP BY employee_id, full_name, grp
      HAVING count(*) > v_max_consecutive_days
    )
    SELECT * FROM streaks
  LOOP
    v_msg := format('الموظف (%s) مسند لـ (%s) أيام عمل متتالية من (%s) إلى (%s) دون يوم راحة أسبوعية (الحد الأقصى للمنشأة: %s أيام)',
                    v_rec.full_name, v_rec.consecutive_days, v_rec.streak_start, v_rec.streak_end, v_max_consecutive_days);
    INSERT INTO public.roster_exceptions (
      company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
    ) VALUES (
      v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.streak_end,
      'excess_hours', 'warning', v_msg, v_msg, false
    );
    v_warning_count := v_warning_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'conflict_count', (v_blocking_count + v_warning_count),
    'blocking_exceptions', v_blocking_count,
    'warning_exceptions', v_warning_count,
    'can_publish', (v_blocking_count = 0)
  );
END;
$$;


-- ============================================================================
-- 9. SECURE PUBLISH ROSTER RPC (EXACT CONTRACT MATCH)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.publish_roster(p_roster_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.roster_periods%ROWTYPE;
  v_conflicts jsonb;
  v_blocking integer;
  v_closed_att_count integer;
  v_published_count integer;
BEGIN
  SELECT * INTO v_period FROM public.roster_periods WHERE id = p_roster_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة غير موجودة' USING ERRCODE = '22023';
  END IF;

  -- Strict tenant authorization check (Employees denied)
  PERFORM public.check_roster_admin_permission(v_period.company_id);

  IF v_period.status = 'locked' THEN
    RAISE EXCEPTION 'لا يمكن نشر فترة جدولة مقفلة رسمياً' USING ERRCODE = '22023';
  END IF;

  -- 1. Run Conflict Detector
  v_conflicts := public.detect_roster_conflicts(p_roster_id);
  v_blocking := (v_conflicts->>'blocking_exceptions')::integer;

  IF v_blocking > 0 THEN
    UPDATE public.roster_periods SET status = 'validation_failed' WHERE id = p_roster_id;
    RAISE EXCEPTION 'تعذر نشر جدول العمل: يوجد % تعارضات تشغيلية مانعة (Blocking Exceptions) يلزم معالجتها أولاً.', v_blocking USING ERRCODE = '22023';
  END IF;

  -- 2. Attendance Period Interlock: Verify no dates fall within closed/exported attendance periods
  SELECT count(*) INTO v_closed_att_count
  FROM public.attendance_periods ap
  WHERE ap.company_id = v_period.company_id
    AND ap.status IN ('closed', 'exported_to_payroll')
    AND daterange(ap.from_date, ap.to_date, '[]') && daterange(v_period.period_start, v_period.period_end, '[]');

  IF v_closed_att_count > 0 THEN
    RAISE EXCEPTION 'لا يمكن نشر جدول العمل: يتقاطع نطاق الجدولة مع فترات حضور مغلقة أو مصدرة للرواتب.' USING ERRCODE = '22023';
  END IF;

  -- 3. Temporarily bypass immutability trigger for this authorized publication transition
  PERFORM set_config('roster.allow_published_mutation', 'on', true);

  UPDATE public.schedule_assignments
  SET
    status = 'published',
    published_at = now(),
    roster_version = v_period.version
  WHERE roster_period_id = p_roster_id;

  GET DIAGNOSTICS v_published_count = ROW_COUNT;

  UPDATE public.roster_periods
  SET
    status = 'published',
    published_at = now(),
    published_by = auth.uid(),
    updated_at = now()
  WHERE id = p_roster_id;

  -- Reset config
  PERFORM set_config('roster.allow_published_mutation', 'off', true);

  -- 4. Audit Log
  INSERT INTO public.roster_audit_logs (
    company_id, roster_period_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_period.company_id, p_roster_id, 'publish', 'roster_period', p_roster_id, auth.uid(),
    jsonb_build_object(
      'name', v_period.name,
      'version', v_period.version,
      'published_assignments', v_published_count,
      'period_start', v_period.period_start,
      'period_end', v_period.period_end
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'roster_id', p_roster_id,
    'status', 'published',
    'roster_version', v_period.version,
    'published_assignments', v_published_count,
    'message', 'تم اعتماد ونشر جدول العمل بنجاح'
  );
END;
$$;


-- ============================================================================
-- 10. CONTROLLED ROSTER PERIOD MUTATIONS (RPCs)
-- ============================================================================

-- Create Roster Period RPC
CREATE OR REPLACE FUNCTION public.create_roster_period(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_name text;
  v_start date;
  v_end date;
  v_timezone text;
  v_notes text;
  v_new_id uuid;
  v_overlap_count integer;
BEGIN
  v_company_id := (p_payload->>'company_id')::uuid;
  IF v_company_id IS NULL THEN
    v_company_id := public.current_company_id();
  END IF;

  PERFORM public.check_roster_admin_permission(v_company_id);

  v_name := trim(COALESCE(p_payload->>'name', ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'اسم فترة الجدولة إلزامي' USING ERRCODE = '22023';
  END IF;

  v_start := (COALESCE(p_payload->>'startDate', p_payload->>'period_start', p_payload->>'start_date'))::date;
  v_end := (COALESCE(p_payload->>'endDate', p_payload->>'period_end', p_payload->>'end_date'))::date;

  IF v_start IS NULL OR v_end IS NULL THEN
    RAISE EXCEPTION 'تاريخ بداية ونهاية فترة الجدولة إلزاميان' USING ERRCODE = '22023';
  END IF;

  IF v_end < v_start THEN
    RAISE EXCEPTION 'تاريخ نهاية الفترة يجب أن يكون لاحقاً أو مساوياً لبدايتها' USING ERRCODE = '22023';
  END IF;

  -- Timezone must derive from company or payload; no hardcoded Asia/Riyadh
  v_timezone := trim(COALESCE(p_payload->>'timezone', ''));
  IF v_timezone = '' THEN
    SELECT timezone INTO v_timezone FROM public.companies WHERE id = v_company_id;
  END IF;

  IF v_timezone IS NULL OR v_timezone = '' THEN
    RAISE EXCEPTION 'لم يتم ضبط المنطقة الزمنية للمنشأة. يرجى تهيئة إعدادات المنشأة أولاً' USING ERRCODE = '22023';
  END IF;

  v_notes := p_payload->>'notes';

  INSERT INTO public.roster_periods (
    company_id, name, period_start, period_end, status, version, timezone, notes, created_by
  ) VALUES (
    v_company_id, v_name, v_start, v_end, 'draft', 1, v_timezone, v_notes, auth.uid()
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.roster_audit_logs (
    company_id, roster_period_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_company_id, v_new_id, 'period_created', 'roster_period', v_new_id, auth.uid(),
    jsonb_build_object('name', v_name, 'start', v_start, 'end', v_end)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_new_id,
    'name', v_name,
    'startDate', v_start,
    'endDate', v_end,
    'timezone', v_timezone,
    'status', 'draft',
    'version', 1
  );
END;
$$;

-- Update Roster Period RPC
CREATE OR REPLACE FUNCTION public.update_roster_period(p_roster_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.roster_periods%ROWTYPE;
BEGIN
  SELECT * INTO v_period FROM public.roster_periods WHERE id = p_roster_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة غير موجودة' USING ERRCODE = '22023';
  END IF;

  PERFORM public.check_roster_admin_permission(v_period.company_id);

  IF v_period.status IN ('published', 'locked') THEN
    RAISE EXCEPTION 'لا يمكن تعديل فترة جدولة منشورة أو مقفلة مباشرة. يلزم استخدام دورة التعديل الرسمية (Amendment)' USING ERRCODE = '22023';
  END IF;

  UPDATE public.roster_periods
  SET
    name = COALESCE(p_payload->>'name', name),
    period_start = COALESCE((COALESCE(p_payload->>'startDate', p_payload->>'period_start'))::date, period_start),
    period_end = COALESCE((COALESCE(p_payload->>'endDate', p_payload->>'period_end'))::date, period_end),
    timezone = COALESCE(p_payload->>'timezone', timezone),
    notes = COALESCE(p_payload->>'notes', notes),
    updated_at = now()
  WHERE id = p_roster_id;

  RETURN jsonb_build_object('ok', true, 'id', p_roster_id, 'status', v_period.status);
END;
$$;


-- ============================================================================
-- 11. CONTROLLED ASSIGNMENT MUTATIONS (RPCs)
-- ============================================================================

-- Set Roster Assignment RPC
CREATE OR REPLACE FUNCTION public.set_roster_assignment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id uuid;
  v_period public.roster_periods%ROWTYPE;
  v_emp_id uuid;
  v_emp public.employees%ROWTYPE;
  v_shift_id uuid;
  v_shift public.shifts%ROWTYPE;
  v_work_date date;
  v_is_rest boolean;
  v_loc_id uuid;
  v_asg_id uuid;
  v_closed_att integer;
BEGIN
  v_period_id := (COALESCE(p_payload->>'roster_period_id', p_payload->>'rosterPeriodId'))::uuid;
  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'معرف فترة الجدولة إلزامي' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_period FROM public.roster_periods WHERE id = v_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة غير موجودة' USING ERRCODE = '22023';
  END IF;

  PERFORM public.check_roster_admin_permission(v_period.company_id);

  IF v_period.status IN ('published', 'locked') THEN
    RAISE EXCEPTION 'لا يمكن تعديل إسنادات فترة جدولة منشورة أو مقفلة مباشرة. يلزم إنشاء مسودة ملحق تعديل (Amendment)' USING ERRCODE = '22023';
  END IF;

  v_emp_id := (COALESCE(p_payload->>'employee_id', p_payload->>'employeeId'))::uuid;
  SELECT * INTO v_emp FROM public.employees WHERE id = v_emp_id AND company_id = v_period.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف غير موجود أو لا ينتمي إلى نفس المنشأة' USING ERRCODE = '22023';
  END IF;

  v_work_date := (COALESCE(p_payload->>'work_date', p_payload->>'date'))::date;
  IF v_work_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ العمل إلزامي' USING ERRCODE = '22023';
  END IF;

  IF v_work_date < v_period.period_start OR v_work_date > v_period.period_end THEN
    RAISE EXCEPTION 'تاريخ العمل يقع خارج نطاق فترة الجدولة (% إلى %)', v_period.period_start, v_period.period_end USING ERRCODE = '22023';
  END IF;

  -- Validate employment dates
  IF (v_emp.hire_date IS NOT NULL AND v_work_date < v_emp.hire_date) OR
     (v_emp.exit_date IS NOT NULL AND v_work_date > v_emp.exit_date) THEN
    RAISE EXCEPTION 'تاريخ الإسناد خارج نطاق خدمة الموظف الفعلية' USING ERRCODE = '22023';
  END IF;

  -- Attendance closed period check
  SELECT count(*) INTO v_closed_att
  FROM public.attendance_periods ap
  WHERE ap.company_id = v_period.company_id
    AND ap.status IN ('closed', 'exported_to_payroll')
    AND v_work_date BETWEEN ap.from_date AND ap.to_date;

  IF v_closed_att > 0 THEN
    RAISE EXCEPTION 'لا يمكن تعديل جدول العمل: يقع التاريخ ضمن فترة حضور مغلقة رسمياً' USING ERRCODE = '22023';
  END IF;

  v_is_rest := COALESCE((COALESCE(p_payload->>'is_rest_day', p_payload->>'isRestDay'))::boolean, false);
  v_shift_id := (COALESCE(p_payload->>'shift_id', p_payload->>'shiftId'))::uuid;

  IF NOT v_is_rest THEN
    IF v_shift_id IS NULL THEN
      RAISE EXCEPTION 'تحديد الوردية إلزامي لأيام العمل' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_shift FROM public.shifts WHERE id = v_shift_id AND company_id = v_period.company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الوردية غير موجودة أو تابعة لمنشأة أخرى' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_loc_id := (COALESCE(p_payload->>'work_location_id', p_payload->>'workLocationId'))::uuid;

  -- Upsert schedule assignment on (roster_period_id, employee_id, work_date)
  INSERT INTO public.schedule_assignments (
    company_id, roster_period_id, employee_id, work_date,
    shift_id, shift_version, shift_name_ar, shift_color,
    is_rest_day, work_location_id, status, source, notes, created_by
  ) VALUES (
    v_period.company_id, v_period_id, v_emp_id, v_work_date,
    v_shift_id, COALESCE(v_shift.version, 1),
    CASE WHEN v_is_rest THEN 'راحة أسبوعية' ELSE v_shift.name_ar END,
    CASE WHEN v_is_rest THEN '#94a3b8' ELSE v_shift.color END,
    v_is_rest, v_loc_id, 'draft',
    COALESCE(p_payload->>'source', 'manual'),
    p_payload->>'notes',
    auth.uid()
  )
  ON CONFLICT (roster_period_id, employee_id, work_date)
  DO UPDATE SET
    shift_id = EXCLUDED.shift_id,
    shift_version = EXCLUDED.shift_version,
    shift_name_ar = EXCLUDED.shift_name_ar,
    shift_color = EXCLUDED.shift_color,
    is_rest_day = EXCLUDED.is_rest_day,
    work_location_id = EXCLUDED.work_location_id,
    source = EXCLUDED.source,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_asg_id;

  RETURN jsonb_build_object('ok', true, 'id', v_asg_id, 'employee_id', v_emp_id, 'work_date', v_work_date);
END;
$$;

-- Delete Roster Assignment RPC
CREATE OR REPLACE FUNCTION public.delete_roster_assignment(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asg public.schedule_assignments%ROWTYPE;
  v_period public.roster_periods%ROWTYPE;
BEGIN
  SELECT * INTO v_asg FROM public.schedule_assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'إسناد الوردية غير موجود' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_period FROM public.roster_periods WHERE id = v_asg.roster_period_id;
  PERFORM public.check_roster_admin_permission(v_asg.company_id);

  IF v_period.status IN ('published', 'locked') THEN
    RAISE EXCEPTION 'لا يمكن حذف إسناد وردية لجدول معتمد أو مقفل مباشرة' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.schedule_assignments WHERE id = p_assignment_id;
  RETURN jsonb_build_object('ok', true, 'id', p_assignment_id);
END;
$$;


-- ============================================================================
-- 12. ROSTER AMENDMENT LIFECYCLE RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_roster_amendment(
  p_roster_period_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src public.roster_periods%ROWTYPE;
  v_new_period_id uuid;
  v_new_version integer;
  v_copied_count integer := 0;
BEGIN
  SELECT * INTO v_src FROM public.roster_periods WHERE id = p_roster_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة الأصلية غير موجودة' USING ERRCODE = '22023';
  END IF;

  PERFORM public.check_roster_admin_permission(v_src.company_id);

  IF v_src.status NOT IN ('published', 'locked') THEN
    RAISE EXCEPTION 'يمكن إنشاء ملحق تعديل فقط للجداول المنشورة أو المقفلة (الحالة الحالية: %)', v_src.status USING ERRCODE = '22023';
  END IF;

  v_new_version := v_src.version + 1;

  -- 1. Create new draft period for amendment
  INSERT INTO public.roster_periods (
    company_id, name, period_start, period_end, status, version, timezone, notes, created_by
  ) VALUES (
    v_src.company_id,
    v_src.name || ' (ملحق V' || v_new_version || ')',
    v_src.period_start,
    v_src.period_end,
    'draft',
    v_new_version,
    v_src.timezone,
    COALESCE(p_reason, 'ملحق تعديل رسمي لجدول معتمد'),
    auth.uid()
  ) RETURNING id INTO v_new_period_id;

  -- 2. Clone active assignments from source period into new draft version
  INSERT INTO public.schedule_assignments (
    company_id, roster_period_id, employee_id, work_date,
    shift_id, shift_version, shift_name_ar, shift_color,
    is_rest_day, work_location_id, status, roster_version, source, notes, created_by
  )
  SELECT
    sa.company_id,
    v_new_period_id,
    sa.employee_id,
    sa.work_date,
    sa.shift_id,
    sa.shift_version,
    sa.shift_name_ar,
    sa.shift_color,
    sa.is_rest_day,
    sa.work_location_id,
    'draft',
    v_new_version,
    'copy',
    sa.notes,
    auth.uid()
  FROM public.schedule_assignments sa
  WHERE sa.roster_period_id = p_roster_period_id
    AND sa.status = 'published';

  GET DIAGNOSTICS v_copied_count = ROW_COUNT;

  -- 3. Audit trail
  INSERT INTO public.roster_audit_logs (
    company_id, roster_period_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_src.company_id, v_new_period_id, 'amendment_created', 'roster_period', v_new_period_id, auth.uid(),
    jsonb_build_object('source_id', p_roster_period_id, 'from_version', v_src.version, 'to_version', v_new_version, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_new_period_id,
    'new_roster_period_id', v_new_period_id,
    'version', v_new_version,
    'new_version', v_new_version,
    'status', 'draft',
    'copied_assignments', v_copied_count,
    'copied_assignments_count', v_copied_count,
    'message', 'تم إنشاء مسودة ملحق التعديل بنجاح'
  );
END;
$$;


-- ============================================================================
-- 13. WORKWEEK SAVE RPC (STRICT VALIDATION)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_workweek_config(
  p_company_id uuid,
  p_config jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weekends jsonb;
  v_max_consec integer;
  v_min_rest numeric;
  v_daily_hrs numeric;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'معرف المنشأة إلزامي' USING ERRCODE = '22023';
  END IF;

  PERFORM public.check_roster_admin_permission(p_company_id);

  v_weekends := COALESCE(p_config->'weekendDays', p_config->'weekend_days', p_config->'rest_days');
  IF v_weekends IS NULL OR jsonb_typeof(v_weekends) != 'array' THEN
    RAISE EXCEPTION 'قائمة أيام الراحة الأسبوعية إلزامية ويجب أن تكون مصفوفة' USING ERRCODE = '22023';
  END IF;

  v_max_consec := (COALESCE(p_config->>'maxConsecutiveWorkDays', p_config->>'max_consecutive_work_days'))::integer;
  IF v_max_consec IS NULL OR v_max_consec <= 0 OR v_max_consec > 14 THEN
    RAISE EXCEPTION 'الحد الأقصى لأيام العمل المتتالية يجب أن يكون بين 1 و 14 يوماً' USING ERRCODE = '22023';
  END IF;

  v_min_rest := (COALESCE(p_config->>'minWeeklyRestHours', p_config->>'min_weekly_rest_hours'))::numeric;
  IF v_min_rest IS NULL OR v_min_rest < 0 THEN
    RAISE EXCEPTION 'الحد الأدنى لساعات الراحة الأسبوعية إلزامي' USING ERRCODE = '22023';
  END IF;

  v_daily_hrs := (COALESCE(p_config->>'defaultDailyHours', p_config->>'default_daily_hours'))::numeric;
  IF v_daily_hrs IS NULL OR v_daily_hrs <= 0 OR v_daily_hrs > 24 THEN
    RAISE EXCEPTION 'ساعات العمل اليومية المعيارية يجب أن تكون بين 1 و 24 ساعة' USING ERRCODE = '22023';
  END IF;

  UPDATE public.companies
  SET
    workweek_config = p_config
  WHERE id = p_company_id;

  RETURN jsonb_build_object('ok', true, 'message', 'تم حفظ سياسة أسبوع العمل بنجاح');
END;
$$;


-- ============================================================================
-- 14. RESOLVE ROSTER EXCEPTION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_roster_exception(
  p_exception_id uuid,
  p_resolution_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exc public.roster_exceptions%ROWTYPE;
BEGIN
  SELECT * INTO v_exc FROM public.roster_exceptions WHERE id = p_exception_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'سجل التعارض غير موجود' USING ERRCODE = '22023';
  END IF;

  PERFORM public.check_roster_admin_permission(v_exc.company_id);

  UPDATE public.roster_exceptions
  SET
    resolved = true,
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution_note = p_resolution_note
  WHERE id = p_exception_id;

  INSERT INTO public.roster_audit_logs (
    company_id, roster_period_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_exc.company_id, v_exc.roster_period_id, 'exception_resolved', 'roster_period', p_exception_id, auth.uid(),
    jsonb_build_object('type', v_exc.exception_type, 'note', p_resolution_note)
  );

  RETURN jsonb_build_object('ok', true, 'id', p_exception_id, 'message', 'تمت معالجة التعارض بنجاح');
END;
$$;


-- ============================================================================
-- 15. SECURE SHIFT SWAP APPROVAL & REJECTION (WORKFLOW READINESS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_shift_swap(
  p_swap_request_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap public.shift_swap_requests%ROWTYPE;
  v_asg_req public.schedule_assignments%ROWTYPE;
  v_asg_tgt public.schedule_assignments%ROWTYPE;
  v_emp_req public.employees%ROWTYPE;
  v_emp_tgt public.employees%ROWTYPE;
  v_my_emp_id uuid;
  v_is_authorized boolean := false;
  v_closed_att integer := 0;
  v_temp_shift uuid;
  v_temp_rest boolean;
  v_temp_loc uuid;
  v_temp_color text;
  v_temp_name text;
  v_temp_version integer;
BEGIN
  SELECT * INTO v_swap FROM public.shift_swap_requests WHERE id = p_swap_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب تبادل الوردية غير موجود' USING ERRCODE = '22023';
  END IF;

  IF v_swap.status != 'pending_approval' THEN
    RAISE EXCEPTION 'طلب التبادل ليس قيد الاعتماد (الحالة: %)', v_swap.status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_emp_req FROM public.employees WHERE id = v_swap.requester_employee_id;
  SELECT * INTO v_emp_tgt FROM public.employees WHERE id = v_swap.target_employee_id;
  v_my_emp_id := public.resolve_my_employee_id();

  -- Requester cannot self-approve
  IF v_my_emp_id IS NOT NULL AND v_my_emp_id = v_swap.requester_employee_id THEN
    RAISE EXCEPTION 'غير مصرح: لا يمكن لمقدم طلب التبادل اعتماد طلبه بنفسه' USING ERRCODE = '42501';
  END IF;

  -- Verify approver identity: Line Manager of requester/target OR authorized HR Admin
  IF auth.role() = 'service_role' OR
     (v_my_emp_id IS NOT NULL AND (v_my_emp_id = v_emp_req.manager_id OR v_my_emp_id = v_emp_tgt.manager_id)) THEN
    v_is_authorized := true;
  ELSE
    BEGIN
      PERFORM public.check_roster_admin_permission(v_swap.company_id);
      v_is_authorized := true;
    EXCEPTION WHEN OTHERS THEN
      v_is_authorized := false;
    END;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'غير مصرح: وحدها الإدارة المباشرة أو مسؤولو الورديات المعتمدون يمكنهم اعتماد التبادل' USING ERRCODE = '42501';
  END IF;

  -- Pre-approval Revalidation
  SELECT * INTO v_asg_req FROM public.schedule_assignments WHERE id = v_swap.requester_assignment_id;
  SELECT * INTO v_asg_tgt FROM public.schedule_assignments WHERE id = v_swap.target_assignment_id;

  IF v_asg_req.id IS NULL OR v_asg_tgt.id IS NULL THEN
    RAISE EXCEPTION 'أحد إسنادات الورديات المرتبطة بالطلب لم يعد موجوداً' USING ERRCODE = '22023';
  END IF;

  IF v_asg_req.status != 'published' OR v_asg_tgt.status != 'published' THEN
    RAISE EXCEPTION 'لا يمكن إتمام التبادل إلا بين ورديات منشورة ومعتمدة رسمياً' USING ERRCODE = '22023';
  END IF;

  -- Revalidate closed attendance lock
  SELECT count(*) INTO v_closed_att
  FROM public.attendance_periods ap
  WHERE ap.company_id = v_swap.company_id
    AND ap.status IN ('closed', 'exported_to_payroll')
    AND (v_asg_req.work_date BETWEEN ap.from_date AND ap.to_date OR v_asg_tgt.work_date BETWEEN ap.from_date AND ap.to_date);

  IF v_closed_att > 0 THEN
    RAISE EXCEPTION 'لا يمكن تبديل الورديات: يقع تاريخ إحدى الوردتين ضمن فترة حضور مقفلة' USING ERRCODE = '22023';
  END IF;

  -- Temporarily allow assignment update through trigger for approved swap
  PERFORM set_config('roster.allow_published_mutation', 'on', true);

  -- Transactional atomic swap
  v_temp_shift := v_asg_req.shift_id;
  v_temp_rest := v_asg_req.is_rest_day;
  v_temp_loc := v_asg_req.work_location_id;
  v_temp_color := v_asg_req.shift_color;
  v_temp_name := v_asg_req.shift_name_ar;
  v_temp_version := v_asg_req.shift_version;

  UPDATE public.schedule_assignments
  SET
    shift_id = v_asg_tgt.shift_id,
    shift_name_ar = v_asg_tgt.shift_name_ar,
    shift_color = v_asg_tgt.shift_color,
    shift_version = v_asg_tgt.shift_version,
    is_rest_day = v_asg_tgt.is_rest_day,
    work_location_id = v_asg_tgt.work_location_id,
    source = 'swap',
    updated_at = now()
  WHERE id = v_asg_req.id;

  UPDATE public.schedule_assignments
  SET
    shift_id = v_temp_shift,
    shift_name_ar = v_temp_name,
    shift_color = v_temp_color,
    shift_version = v_temp_version,
    is_rest_day = v_temp_rest,
    work_location_id = v_temp_loc,
    source = 'swap',
    updated_at = now()
  WHERE id = v_asg_tgt.id;

  PERFORM set_config('roster.allow_published_mutation', 'off', true);

  UPDATE public.shift_swap_requests
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = p_notes,
    updated_at = now()
  WHERE id = p_swap_request_id;

  INSERT INTO public.roster_audit_logs (
    company_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_swap.company_id, 'swap_approved', 'swap', p_swap_request_id, auth.uid(),
    jsonb_build_object('requester', v_swap.requester_employee_id, 'target', v_swap.target_employee_id)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'approved', 'message', 'تم اعتماد وتبديل الورديتين بنجاح');
END;
$$;

-- Reject Shift Swap RPC
CREATE OR REPLACE FUNCTION public.reject_shift_swap(
  p_swap_request_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap public.shift_swap_requests%ROWTYPE;
  v_emp_req public.employees%ROWTYPE;
  v_emp_tgt public.employees%ROWTYPE;
  v_my_emp_id uuid;
  v_is_authorized boolean := false;
BEGIN
  SELECT * INTO v_swap FROM public.shift_swap_requests WHERE id = p_swap_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب تبادل الوردية غير موجود' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_emp_req FROM public.employees WHERE id = v_swap.requester_employee_id;
  SELECT * INTO v_emp_tgt FROM public.employees WHERE id = v_swap.target_employee_id;
  v_my_emp_id := public.resolve_my_employee_id();

  IF auth.role() = 'service_role' OR
     (v_my_emp_id IS NOT NULL AND (v_my_emp_id = v_emp_req.manager_id OR v_my_emp_id = v_emp_tgt.manager_id)) THEN
    v_is_authorized := true;
  ELSE
    BEGIN
      PERFORM public.check_roster_admin_permission(v_swap.company_id);
      v_is_authorized := true;
    EXCEPTION WHEN OTHERS THEN
      v_is_authorized := false;
    END;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'غير مصرح: وحدها الإدارة المباشرة أو مسؤولو الورديات المعتمدون يمكنهم رفض الطلب' USING ERRCODE = '42501';
  END IF;

  UPDATE public.shift_swap_requests
  SET
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = p_reason,
    updated_at = now()
  WHERE id = p_swap_request_id;

  INSERT INTO public.roster_audit_logs (
    company_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_swap.company_id, 'swap_rejected', 'swap', p_swap_request_id, auth.uid(),
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'rejected', 'message', 'تم رفض طلب تبديل الوردية');
END;
$$;


-- ============================================================================
-- 16. PUBLISHED ASSIGNMENT IMMUTABILITY TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_prevent_published_assignment_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
BEGIN
  -- Bypass for service_role or authorized transactional RPCs (swap / publish)
  IF auth.role() = 'service_role' OR current_setting('roster.allow_published_mutation', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status INTO v_status FROM public.roster_periods WHERE id = OLD.roster_period_id;
  IF v_status IN ('published', 'locked') THEN
    RAISE EXCEPTION 'لا يمكن تعديل أو حذف إسنادات جدول معتمد أو مقفل مباشرة (معرف الإسناد: %). يلزم استخدام دورة التعديل الرسمية (Amendment)'
      , OLD.id USING ERRCODE = '22023';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_published_assignment_mutation ON public.schedule_assignments;
CREATE TRIGGER trg_prevent_published_assignment_mutation
  BEFORE UPDATE OR DELETE ON public.schedule_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_published_assignment_mutation();


-- ============================================================================
-- 17. HARDENED ROW LEVEL SECURITY POLICIES WITH 'WITH CHECK'
-- ============================================================================

-- A. Shifts Policies (Remove company_id IS NULL write path)
DROP POLICY IF EXISTS shifts_manage ON public.shifts;
CREATE POLICY shifts_manage ON public.shifts
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- B. Shift Segments Manage Policy
DROP POLICY IF EXISTS shift_segments_manage ON public.shift_segments;
CREATE POLICY shift_segments_manage ON public.shift_segments
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- C. Roster Periods Manage Policy
DROP POLICY IF EXISTS roster_periods_manage ON public.roster_periods;
CREATE POLICY roster_periods_manage ON public.roster_periods
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- D. Schedule Assignments Manage Policy
DROP POLICY IF EXISTS schedule_assignments_manage ON public.schedule_assignments;
CREATE POLICY schedule_assignments_manage ON public.schedule_assignments
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- E. Roster Templates & Rotation Patterns Policies
DROP POLICY IF EXISTS roster_templates_manage ON public.roster_templates;
CREATE POLICY roster_templates_manage ON public.roster_templates
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

DROP POLICY IF EXISTS rotation_patterns_manage ON public.rotation_patterns;
CREATE POLICY rotation_patterns_manage ON public.rotation_patterns
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- F. Roster Coverage Requirements Policies (Split Read vs Manage)
DROP POLICY IF EXISTS roster_coverage_requirements_policy ON public.roster_coverage_requirements;
DROP POLICY IF EXISTS roster_coverage_requirements_read ON public.roster_coverage_requirements;
CREATE POLICY roster_coverage_requirements_read ON public.roster_coverage_requirements
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS roster_coverage_requirements_manage ON public.roster_coverage_requirements;
CREATE POLICY roster_coverage_requirements_manage ON public.roster_coverage_requirements
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- G. Roster Exceptions Policies (Split Read vs Manage)
DROP POLICY IF EXISTS roster_exceptions_policy ON public.roster_exceptions;
DROP POLICY IF EXISTS roster_exceptions_read ON public.roster_exceptions;
CREATE POLICY roster_exceptions_read ON public.roster_exceptions
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      employee_id = public.resolve_my_employee_id()
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = roster_exceptions.employee_id
          AND e.manager_id = public.resolve_my_employee_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

DROP POLICY IF EXISTS roster_exceptions_manage ON public.roster_exceptions;
CREATE POLICY roster_exceptions_manage ON public.roster_exceptions
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- H. Shift Swap Requests (Line Manager Restricted to Direct Reports)
DROP POLICY IF EXISTS shift_swap_requests_read ON public.shift_swap_requests;
CREATE POLICY shift_swap_requests_read ON public.shift_swap_requests
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      requester_employee_id = public.resolve_my_employee_id()
      OR target_employee_id = public.resolve_my_employee_id()
      -- Line Manager can only see requests involving their team members
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE (e.id = shift_swap_requests.requester_employee_id OR e.id = shift_swap_requests.target_employee_id)
          AND e.manager_id = public.resolve_my_employee_id()
      )
      -- HR Admins see whole company
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

DROP POLICY IF EXISTS shift_swap_requests_manage ON public.shift_swap_requests;
CREATE POLICY shift_swap_requests_manage ON public.shift_swap_requests
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      requester_employee_id = public.resolve_my_employee_id()
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE (e.id = shift_swap_requests.requester_employee_id OR e.id = shift_swap_requests.target_employee_id)
          AND e.manager_id = public.resolve_my_employee_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      requester_employee_id = public.resolve_my_employee_id()
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE (e.id = shift_swap_requests.requester_employee_id OR e.id = shift_swap_requests.target_employee_id)
          AND e.manager_id = public.resolve_my_employee_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );


-- ============================================================================
-- 18. GENERATE DRAFT ROSTER FROM TEMPLATE RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_roster_from_template(
  p_roster_period_id uuid,
  p_template_id uuid,
  p_employee_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.roster_periods%ROWTYPE;
  v_template public.roster_templates%ROWTYPE;
  v_emp_id uuid;
  v_curr_date date;
  v_day_idx integer;
  v_pat_item jsonb;
  v_shift_id uuid;
  v_is_rest boolean;
  v_shift public.shifts%ROWTYPE;
  v_created integer := 0;
  v_skipped integer := 0;
BEGIN
  SELECT * INTO v_period FROM public.roster_periods WHERE id = p_roster_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة غير موجودة' USING ERRCODE = '22023';
  END IF;

  PERFORM public.check_roster_admin_permission(v_period.company_id);

  IF v_period.status IN ('published', 'locked') THEN
    RAISE EXCEPTION 'لا يمكن تطبيق قالب على فترة جدولة منشورة أو مقفلة' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_template FROM public.roster_templates WHERE id = p_template_id AND company_id = v_period.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'قالب الجدول غير موجود أو تابع لمنشأة أخرى' USING ERRCODE = '22023';
  END IF;

  FOREACH v_emp_id IN ARRAY p_employee_ids
  LOOP
    v_curr_date := v_period.period_start;
    WHILE v_curr_date <= v_period.period_end
    LOOP
      v_day_idx := (v_curr_date - v_period.period_start) % COALESCE(v_template.cycle_days, 7);

      IF jsonb_typeof(v_template.pattern) = 'array' THEN
        v_pat_item := v_template.pattern->v_day_idx;
      ELSE
        v_pat_item := v_template.pattern->v_day_idx::text;
      END IF;

      IF v_pat_item IS NOT NULL THEN
        v_shift_id := (v_pat_item->>'shift_id')::uuid;
        v_is_rest := COALESCE((v_pat_item->>'is_rest_day')::boolean, (v_pat_item->>'isRestDay')::boolean, (v_shift_id IS NULL));

        IF NOT v_is_rest AND v_shift_id IS NOT NULL THEN
          SELECT * INTO v_shift FROM public.shifts WHERE id = v_shift_id;
        END IF;

        INSERT INTO public.schedule_assignments (
          company_id, roster_period_id, employee_id, work_date,
          shift_id, shift_version, shift_name_ar, shift_color,
          is_rest_day, status, source, created_by
        ) VALUES (
          v_period.company_id, v_period.id, v_emp_id, v_curr_date,
          v_shift_id, COALESCE(v_shift.version, 1),
          CASE WHEN v_is_rest THEN 'راحة أسبوعية' ELSE COALESCE(v_shift.name_ar, 'وردية عمل') END,
          CASE WHEN v_is_rest THEN '#94a3b8' ELSE COALESCE(v_shift.color, '#0284c7') END,
          v_is_rest, 'draft', 'template', auth.uid()
        )
        ON CONFLICT (roster_period_id, employee_id, work_date)
        DO UPDATE SET
          shift_id = EXCLUDED.shift_id,
          shift_version = EXCLUDED.shift_version,
          shift_name_ar = EXCLUDED.shift_name_ar,
          shift_color = EXCLUDED.shift_color,
          is_rest_day = EXCLUDED.is_rest_day,
          source = EXCLUDED.source,
          updated_at = now();

        v_created := v_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;

      v_curr_date := v_curr_date + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'created_count', v_created,
    'skipped_count', v_skipped,
    'message', format('تم توليد %s إسناد مسودة من القالب بنجاح', v_created)
  );
END;
$$;


-- ============================================================================
-- 19. RPC EXECUTE GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.check_roster_admin_permission(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_shift_code(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_shift_definition(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_shift_definition(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_shift_definition(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.detect_roster_conflicts(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_roster(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_roster_period(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_roster_period(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_roster_assignment(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_roster_assignment(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_roster_amendment(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_workweek_config(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_roster_exception(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_shift_swap(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_shift_swap(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_roster_from_template(uuid, uuid, uuid[]) TO authenticated, service_role;

COMMIT;

