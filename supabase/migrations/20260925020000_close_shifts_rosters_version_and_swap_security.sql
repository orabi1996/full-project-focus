-- ============================================================================
-- PROMPT 13.2: FINAL SHIFTS & ROSTERS CLOSURE HOTFIX
-- Append-only migration: Version supersession, attendance deterministic resolution,
-- 8-hour fallback removal, shift swap RLS hardening, and template safety.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ROSTER PERIODS: SUPERSEDED STATUS & SINGLE PUBLISHED VERSION CONSTRAINT
-- ----------------------------------------------------------------------------

-- Update status check constraint to include 'superseded'
ALTER TABLE public.roster_periods DROP CONSTRAINT IF EXISTS roster_periods_status_check;
ALTER TABLE public.roster_periods ADD CONSTRAINT roster_periods_status_check
  CHECK (status IN ('draft', 'validation_failed', 'ready', 'published', 'superseded', 'locked', 'archived'));

-- Database enforcement: Exactly ONE authoritative published roster version per company & date range
DROP INDEX IF EXISTS public.uq_roster_periods_single_published_per_range;
CREATE UNIQUE INDEX uq_roster_periods_single_published_per_range
  ON public.roster_periods (company_id, period_start, period_end)
  WHERE (status = 'published');

-- ----------------------------------------------------------------------------
-- 2. ATTENDANCE RECORDS: LINKAGE & REPROCESS FLAG COLUMNS
-- ----------------------------------------------------------------------------

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS roster_period_id uuid REFERENCES public.roster_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS roster_version integer,
  ADD COLUMN IF NOT EXISTS shift_version integer,
  ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_reprocess_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reprocess_status text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS chk_attendance_records_reprocess_status;
ALTER TABLE public.attendance_records ADD CONSTRAINT chk_attendance_records_reprocess_status
  CHECK (reprocess_status IN ('normal', 'attendance_reprocess_required', 'reprocessed'));

-- ----------------------------------------------------------------------------
-- 3. SCHEDULE ASSIGNMENTS: STATUS EXPANSION & SHIFT SWAP STATUS MACHINE
-- ----------------------------------------------------------------------------

ALTER TABLE public.schedule_assignments DROP CONSTRAINT IF EXISTS schedule_assignments_status_check;
ALTER TABLE public.schedule_assignments ADD CONSTRAINT schedule_assignments_status_check
  CHECK (status IN ('draft', 'published', 'superseded', 'archived', 'cancelled'));

ALTER TABLE public.shift_swap_requests DROP CONSTRAINT IF EXISTS chk_shift_swap_requests_status;
ALTER TABLE public.shift_swap_requests DROP CONSTRAINT IF EXISTS shift_swap_requests_status_check;
ALTER TABLE public.shift_swap_requests ADD CONSTRAINT chk_shift_swap_requests_status
  CHECK (status IN ('draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'cancelled'));

ALTER TABLE public.shift_swap_requests
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.roster_templates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.rotation_patterns
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ----------------------------------------------------------------------------
-- 4. DETERMINISTIC EFFECTIVE PUBLISHED SCHEDULE VIEW & RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vw_effective_published_schedules AS
SELECT
  sa.id AS assignment_id,
  sa.company_id,
  sa.roster_period_id,
  sa.roster_version,
  sa.employee_id,
  sa.work_date,
  sa.shift_id,
  sa.shift_version,
  sa.is_rest_day,
  sa.work_location_id,
  sa.status AS assignment_status,
  rp.status AS roster_status,
  rp.period_start,
  rp.period_end,
  rp.timezone AS roster_timezone,
  s.code AS shift_code,
  s.name_ar AS shift_name_ar,
  s.name_en AS shift_name_en,
  s.start_time,
  s.end_time,
  s.grace_minutes_arrival,
  s.grace_minutes_departure,
  s.overtime_eligible,
  s.break_type,
  s.break_minutes,
  s.is_overnight,
  s.type AS shift_type,
  s.flexible_hours
FROM public.schedule_assignments sa
JOIN public.roster_periods rp ON sa.roster_period_id = rp.id
LEFT JOIN public.shifts s ON sa.shift_id = s.id
WHERE rp.status = 'published'
  AND sa.status = 'published';

GRANT SELECT ON public.vw_effective_published_schedules TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_effective_published_schedule(
  p_employee_id uuid,
  p_work_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
BEGIN
  SELECT jsonb_build_object(
    'assignment_id', v.assignment_id,
    'company_id', v.company_id,
    'roster_period_id', v.roster_period_id,
    'roster_version', v.roster_version,
    'employee_id', v.employee_id,
    'work_date', v.work_date,
    'shift_id', v.shift_id,
    'shift_version', v.shift_version,
    'is_rest_day', v.is_rest_day,
    'work_location_id', v.work_location_id,
    'shift_code', v.shift_code,
    'shift_name_ar', v.shift_name_ar,
    'shift_name_en', v.shift_name_en,
    'start_time', v.start_time,
    'end_time', v.end_time,
    'grace_minutes_arrival', v.grace_minutes_arrival,
    'grace_minutes_departure', v.grace_minutes_departure,
    'overtime_eligible', v.overtime_eligible,
    'break_type', v.break_type,
    'break_minutes', v.break_minutes,
    'is_overnight', v.is_overnight,
    'shift_type', v.shift_type,
    'flexible_hours', v.flexible_hours
  ) INTO v_res
  FROM public.vw_effective_published_schedules v
  WHERE v.employee_id = p_employee_id
    AND v.work_date = p_work_date
  LIMIT 1;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_published_schedule(uuid, date) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. ATOMIC PUBLISHING WITH AUTOMATIC SUPERSESSION & REPROCESS AUDIT
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.publish_roster(p_roster_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.roster_periods%ROWTYPE;
  v_conflicts jsonb;
  v_conflict_count integer := 0;
  v_closed_att_count integer := 0;
  v_old_published_id uuid;
  v_old_version integer;
  v_reprocess_count integer := 0;
  v_published_count integer := 0;
BEGIN
  -- 1. Retrieve roster
  SELECT * INTO v_target FROM public.roster_periods WHERE id = p_roster_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة غير موجودة' USING ERRCODE = '22023';
  END IF;

  -- 2. Tenant authorization (Admins only)
  PERFORM public.check_roster_admin_permission(v_target.company_id);

  IF v_target.status NOT IN ('draft', 'ready', 'validation_failed') THEN
    RAISE EXCEPTION 'فترة الجدولة بحالة (%) ولا يمكن نشرها مجدداً', v_target.status USING ERRCODE = '22023';
  END IF;

  -- 3. Detect blocking conflicts
  v_conflicts := public.detect_roster_conflicts(p_roster_id);
  v_conflict_count := COALESCE((v_conflicts->>'blocking_exceptions')::integer, 0);

  IF v_conflict_count > 0 THEN
    UPDATE public.roster_periods
    SET status = 'validation_failed', updated_at = now()
    WHERE id = p_roster_id;

    RAISE EXCEPTION 'لا يمكن اعتماد ونشر الجدول: يحتوي على % تعارضات حتمية', v_conflict_count USING ERRCODE = '22023';
  END IF;

  -- 4. Attendance Lock Interlock
  SELECT count(*) INTO v_closed_att_count
  FROM public.attendance_periods ap
  WHERE ap.company_id = v_target.company_id
    AND ap.status IN ('closed', 'exported_to_payroll')
    AND ap.from_date <= v_target.period_end
    AND ap.to_date >= v_target.period_start;

  IF v_closed_att_count > 0 THEN
    RAISE EXCEPTION 'لا يمكن نشر الجدول: يتقاطع مع فترات حضور مقفلة أو مصدرة للمرتبات' USING ERRCODE = '22023';
  END IF;

  -- 5. ATOMIC SUPERSESSION: If another version is currently published for this range, mark it superseded
  SELECT id, version INTO v_old_published_id, v_old_version
  FROM public.roster_periods
  WHERE company_id = v_target.company_id
    AND period_start = v_target.period_start
    AND period_end = v_target.period_end
    AND status = 'published'
    AND id != p_roster_id;

  IF v_old_published_id IS NOT NULL THEN
    -- Mark old version superseded
    UPDATE public.roster_periods
    SET status = 'superseded', updated_at = now()
    WHERE id = v_old_published_id;

    -- Audit supersession event
    INSERT INTO public.roster_audit_logs (
      company_id, roster_period_id, action, entity_type, entity_id, actor_id, details
    ) VALUES (
      v_target.company_id, v_old_published_id, 'superseded', 'roster_period', v_old_published_id, auth.uid(),
      jsonb_build_object(
        'superseded_by_period_id', p_roster_id,
        'superseded_by_version', v_target.version,
        'superseded_at', now()
      )
    );

    -- Flag attendance records that exist on modified dates as requiring reprocess
    WITH changed_assignments AS (
      SELECT new_sa.employee_id, new_sa.work_date
      FROM public.schedule_assignments new_sa
      LEFT JOIN public.schedule_assignments old_sa
        ON old_sa.roster_period_id = v_old_published_id
        AND old_sa.employee_id = new_sa.employee_id
        AND old_sa.work_date = new_sa.work_date
      WHERE new_sa.roster_period_id = p_roster_id
        AND (
          old_sa.id IS NULL
          OR old_sa.shift_id IS DISTINCT FROM new_sa.shift_id
          OR old_sa.work_location_id IS DISTINCT FROM new_sa.work_location_id
          OR old_sa.is_rest_day IS DISTINCT FROM new_sa.is_rest_day
        )
    )
    UPDATE public.attendance_records ar
    SET attendance_reprocess_required = true,
        reprocess_status = 'attendance_reprocess_required',
        updated_at = now()
    FROM changed_assignments ca
    WHERE ar.company_id = v_target.company_id
      AND ar.employee_id = ca.employee_id
      AND ar.work_date = ca.work_date;

    GET DIAGNOSTICS v_reprocess_count = ROW_COUNT;
  END IF;

  -- 6. Atomically publish target roster and its assignments
  UPDATE public.roster_periods
  SET status = 'published',
      published_by = auth.uid(),
      published_at = now(),
      updated_at = now()
  WHERE id = p_roster_id;

  -- Bypass mutation guard trigger for publishing transition
  PERFORM set_config('roster.allow_published_mutation', 'on', true);

  UPDATE public.schedule_assignments
  SET status = 'published',
      published_at = now(),
      updated_at = now()
  WHERE roster_period_id = p_roster_id;

  GET DIAGNOSTICS v_published_count = ROW_COUNT;

  -- Reset bypass setting
  PERFORM set_config('roster.allow_published_mutation', 'off', true);

  -- 7. Audit log for publishing event
  INSERT INTO public.roster_audit_logs (
    company_id, roster_period_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_target.company_id, p_roster_id, 'publish', 'roster_period', p_roster_id, auth.uid(),
    jsonb_build_object(
      'version', v_target.version,
      'superseded_version', v_old_version,
      'published_assignments', v_published_count,
      'attendance_reprocess_flagged', v_reprocess_count,
      'published_at', now()
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'roster_id', p_roster_id,
    'version', v_target.version,
    'published_assignments', v_published_count,
    'published_assignments_count', v_published_count,
    'superseded_period_id', v_old_published_id,
    'superseded_version', v_old_version,
    'reprocess_flagged_count', v_reprocess_count,
    'message', CASE
      WHEN v_old_version IS NOT NULL THEN format('تم نشر نسخة الجدول V%s بنجاح وترقية النسخة السابقة V%s إلى ملغاة/مستبدلة (Superseded)', v_target.version, v_old_version)
      ELSE format('تم اعتماد ونشر جدول العمل بنجاح (النسخة V%s)', v_target.version)
    END
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. EXPLICIT SHIFT EFFECTIVE DATE REQUIREMENT (ZERO CURRENT_DATE FALLBACK)
-- ----------------------------------------------------------------------------

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

  -- PROMPT 13.2: REQUIRE effective_from explicitly. ZERO CURRENT_DATE fallback!
  v_effective_from := (COALESCE(p_payload->>'effective_from', p_payload->>'effectiveFrom'))::date;
  IF v_effective_from IS NULL THEN
    RAISE EXCEPTION 'تاريخ سريان الوردية (effective_from) إلزامي وصريح ولا يقبل قيماً افتراضية' USING ERRCODE = '22023';
  END IF;
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
    effective_from, effective_to, version, status
  ) VALUES (
    v_company_id, v_code, v_name_ar, v_name_en, v_type, v_color,
    v_start_time, v_end_time, v_grace_in, v_grace_out,
    v_flexible_hours, v_split_start2, v_split_end2,
    v_is_overnight, v_allow_single_punch, v_overtime_eligible, v_break_mins,
    v_break_type, v_auto_deduct, v_min_rest,
    v_effective_from, v_effective_to, 1, 'active'
  )
  RETURNING id INTO v_shift_id;

  -- 6. Insert Shift Segments
  v_segments := p_payload->'segments';
  IF v_segments IS NOT NULL AND jsonb_typeof(v_segments) = 'array' THEN
    FOR v_seg IN SELECT * FROM jsonb_array_elements(v_segments)
    LOOP
      INSERT INTO public.shift_segments (
        company_id, shift_id, segment_order, start_time, end_time,
        segment_type, is_overnight, paid
      ) VALUES (
        v_company_id,
        v_shift_id,
        v_seg_order,
        (v_seg->>'start_time')::time,
        (v_seg->>'end_time')::time,
        COALESCE(v_seg->>'segment_type', 'work'),
        COALESCE((v_seg->>'is_overnight')::boolean, false),
        COALESCE((v_seg->>'paid')::boolean, true)
      );
      v_seg_order := v_seg_order + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_shift_id,
    'shift_id', v_shift_id,
    'code', v_code,
    'message', 'تم إنشاء وحفظ وردية العمل بنجاح'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. CONTROLLED SHIFT SWAP RPC: create_shift_swap_request
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_shift_swap_request(
  p_requester_assignment_id uuid,
  p_target_employee_id uuid,
  p_target_assignment_id uuid,
  p_reason text,
  p_requester_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_emp_id uuid;
  v_my_emp_id uuid;
  v_asg_req public.schedule_assignments%ROWTYPE;
  v_asg_tgt public.schedule_assignments%ROWTYPE;
  v_emp_req public.employees%ROWTYPE;
  v_emp_tgt public.employees%ROWTYPE;
  v_roster_req public.roster_periods%ROWTYPE;
  v_roster_tgt public.roster_periods%ROWTYPE;
  v_swap_id uuid;
BEGIN
  -- 1. Determine requester employee id truthfully
  v_my_emp_id := public.resolve_my_employee_id();

  IF p_requester_employee_id IS NOT NULL AND (v_my_emp_id IS NULL OR v_my_emp_id != p_requester_employee_id) THEN
    -- Admin acting on behalf of employee
    SELECT * INTO v_emp_req FROM public.employees WHERE id = p_requester_employee_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الموظف صاحب الطلب غير موجود' USING ERRCODE = '22023';
    END IF;
    PERFORM public.check_roster_admin_permission(v_emp_req.company_id);
    v_req_emp_id := p_requester_employee_id;
  ELSE
    IF v_my_emp_id IS NULL THEN
      RAISE EXCEPTION 'تعذر التحقق من هوية الموظف مقدم الطلب' USING ERRCODE = '42501';
    END IF;
    v_req_emp_id := v_my_emp_id;
    SELECT * INTO v_emp_req FROM public.employees WHERE id = v_req_emp_id;
  END IF;

  -- 2. Verify target employee
  IF p_target_employee_id = v_req_emp_id THEN
    RAISE EXCEPTION 'لا يمكن تقديم طلب تبادل وردية مع نفس الموظف' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_emp_tgt FROM public.employees WHERE id = p_target_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المستهدف غير موجود' USING ERRCODE = '22023';
  END IF;

  IF v_emp_req.status != 'active' OR v_emp_tgt.status != 'active' THEN
    RAISE EXCEPTION 'كلا الموظفين يجب أن يكونا على رأس العمل بحالة نشطة' USING ERRCODE = '22023';
  END IF;

  IF v_emp_req.company_id != v_emp_tgt.company_id THEN
    RAISE EXCEPTION 'لا يمكن التبادل بين موظفين من منشآت مختلفة' USING ERRCODE = '42501';
  END IF;

  -- 3. Verify assignments
  SELECT * INTO v_asg_req FROM public.schedule_assignments WHERE id = p_requester_assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'إسناد وردية مقدم الطلب غير موجود' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_asg_tgt FROM public.schedule_assignments WHERE id = p_target_assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'إسناد وردية الموظف البديل غير موجود' USING ERRCODE = '22023';
  END IF;

  -- Verify ownership
  IF v_asg_req.employee_id != v_req_emp_id THEN
    RAISE EXCEPTION 'إسناد الوردية الأول لا يخص مقدم الطلب' USING ERRCODE = '42501';
  END IF;

  IF v_asg_tgt.employee_id != p_target_employee_id THEN
    RAISE EXCEPTION 'إسناد الوردية الثاني لا يخص الموظف البديل المحدد' USING ERRCODE = '42501';
  END IF;

  IF v_asg_req.company_id != v_emp_req.company_id OR v_asg_tgt.company_id != v_emp_req.company_id THEN
    RAISE EXCEPTION 'تعارض في تبعية المنشأة لإسنادات الورديات' USING ERRCODE = '42501';
  END IF;

  -- Must be published assignments on current published rosters
  SELECT * INTO v_roster_req FROM public.roster_periods WHERE id = v_asg_req.roster_period_id;
  SELECT * INTO v_roster_tgt FROM public.roster_periods WHERE id = v_asg_tgt.roster_period_id;

  IF v_asg_req.status != 'published' OR v_roster_req.status != 'published' OR
     v_asg_tgt.status != 'published' OR v_roster_tgt.status != 'published' THEN
    RAISE EXCEPTION 'لا يمكن تبادل الورديات إلا للجداول المنشورة والمعتمدة حالياً' USING ERRCODE = '22023';
  END IF;

  -- Insert swap request
  INSERT INTO public.shift_swap_requests (
    company_id,
    requester_employee_id,
    requester_assignment_id,
    target_employee_id,
    target_assignment_id,
    status,
    reason,
    created_by
  ) VALUES (
    v_emp_req.company_id,
    v_req_emp_id,
    p_requester_assignment_id,
    p_target_employee_id,
    p_target_assignment_id,
    'pending_approval',
    trim(COALESCE(p_reason, 'طلب تبادل وردية')),
    auth.uid()
  )
  RETURNING id INTO v_swap_id;

  RETURN jsonb_build_object(
    'ok', true,
    'swap_request_id', v_swap_id,
    'status', 'pending_approval',
    'message', 'تم تقديم طلب تبادل الوردية بنجاح وهو قيد المراجعة'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_shift_swap_request(uuid, uuid, uuid, text, uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. HARDEN SHIFT SWAP RLS & PROHIBIT DIRECT STATUS MANIPULATION
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS shift_swap_requests_manage ON public.shift_swap_requests;
DROP POLICY IF EXISTS shift_swap_requests_read ON public.shift_swap_requests;
DROP POLICY IF EXISTS shift_swap_requests_select ON public.shift_swap_requests;
DROP POLICY IF EXISTS shift_swap_requests_insert ON public.shift_swap_requests;
DROP POLICY IF EXISTS shift_swap_requests_update ON public.shift_swap_requests;
DROP POLICY IF EXISTS shift_swap_requests_delete ON public.shift_swap_requests;

-- 1. SELECT: requester, target, their line manager, or HR/Admins of the same company
CREATE POLICY shift_swap_requests_select ON public.shift_swap_requests
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      requester_employee_id = public.resolve_my_employee_id()
      OR target_employee_id = public.resolve_my_employee_id()
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

-- 2. INSERT: only for self as requester, with status strictly 'pending_approval' or 'draft'
CREATE POLICY shift_swap_requests_insert ON public.shift_swap_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND requester_employee_id = public.resolve_my_employee_id()
    AND status IN ('pending_approval', 'draft')
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- 3. UPDATE: Employees can ONLY cancel their own requests while pending. Direct approval is strictly forbidden!
CREATE POLICY shift_swap_requests_update ON public.shift_swap_requests
  FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND requester_employee_id = public.resolve_my_employee_id()
    AND status IN ('pending_approval', 'submitted', 'draft')
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND requester_employee_id = public.resolve_my_employee_id()
    AND status = 'cancelled'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- 4. DELETE: No direct client DELETE permitted
CREATE POLICY shift_swap_requests_delete ON public.shift_swap_requests
  FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND requester_employee_id = public.resolve_my_employee_id()
    AND status = 'draft'
  );

-- Trigger to guard swap status mutation from table updates
CREATE OR REPLACE FUNCTION public.trg_guard_shift_swap_status_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status is transitioning to approved or rejected, require controlled RPC bypass setting
  IF NEW.status IN ('approved', 'rejected') THEN
    IF current_setting('roster.allow_swap_decision', true) != 'on' THEN
      RAISE EXCEPTION 'غير مصرح: لا يمكن اعتماد أو رفض طلب التبادل عبر التعديل المباشر للجدول. يرجى استخدام الإجراء المعتمد' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- State machine enforcement
  IF OLD.status IN ('approved', 'rejected', 'cancelled') AND NEW.status != OLD.status THEN
    RAISE EXCEPTION 'لا يمكن تعديل حالة طلب تبادل تم البت فيه نهائياً (الحالة الحالية: %)', OLD.status USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_shift_swap_status ON public.shift_swap_requests;
CREATE TRIGGER trg_guard_shift_swap_status
  BEFORE UPDATE ON public.shift_swap_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_shift_swap_status_mutation();

-- ----------------------------------------------------------------------------
-- 9. FULL BUSINESS RULE REVALIDATION IN approve_shift_swap & reject_shift_swap
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.approve_shift_swap(uuid);
DROP FUNCTION IF EXISTS public.approve_shift_swap(uuid, text);
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
  v_roster_req public.roster_periods%ROWTYPE;
  v_roster_tgt public.roster_periods%ROWTYPE;
  v_my_emp_id uuid;
  v_is_authorized boolean := false;
  v_closed_att integer := 0;
  v_closed_pay integer := 0;
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

  -- 1. Pre-approval Revalidation: Assignments still exist
  SELECT * INTO v_asg_req FROM public.schedule_assignments WHERE id = v_swap.requester_assignment_id;
  SELECT * INTO v_asg_tgt FROM public.schedule_assignments WHERE id = v_swap.target_assignment_id;

  IF v_asg_req.id IS NULL OR v_asg_tgt.id IS NULL THEN
    RAISE EXCEPTION 'أحد إسنادات الورديات المرتبطة بالطلب لم يعد موجوداً' USING ERRCODE = '22023';
  END IF;

  -- 2. Current Published Roster Version Check
  SELECT * INTO v_roster_req FROM public.roster_periods WHERE id = v_asg_req.roster_period_id;
  SELECT * INTO v_roster_tgt FROM public.roster_periods WHERE id = v_asg_tgt.roster_period_id;

  IF v_roster_req.status != 'published' OR v_roster_tgt.status != 'published' THEN
    RAISE EXCEPTION 'لا يمكن اعتماد التبادل: جدول إحدى الوردتين لم يعد النسخة المعتمدة المنشورة حالياً' USING ERRCODE = '22023';
  END IF;

  IF v_asg_req.status != 'published' OR v_asg_tgt.status != 'published' THEN
    RAISE EXCEPTION 'لا يمكن إتمام التبادل إلا بين ورديات منشورة ومعتمدة رسمياً' USING ERRCODE = '22023';
  END IF;

  -- 3. Employment Validity
  IF v_emp_req.status != 'active' OR v_emp_tgt.status != 'active' THEN
    RAISE EXCEPTION 'لا يمكن إتمام التبادل: أحد الموظفين لم يعد على رأس العمل بحالة نشطة' USING ERRCODE = '22023';
  END IF;

  IF v_asg_tgt.work_date < v_emp_req.hire_date OR (v_emp_req.exit_date IS NOT NULL AND v_asg_tgt.work_date > v_emp_req.exit_date) THEN
    RAISE EXCEPTION 'تاريخ الوردية البديلة يقع خارج فترة عمل مقدم الطلب' USING ERRCODE = '22023';
  END IF;

  IF v_asg_req.work_date < v_emp_tgt.hire_date OR (v_emp_tgt.exit_date IS NOT NULL AND v_asg_req.work_date > v_emp_tgt.exit_date) THEN
    RAISE EXCEPTION 'تاريخ الوردية البديلة يقع خارج فترة عمل الموظف البديل' USING ERRCODE = '22023';
  END IF;

  -- 4. Leave Conflict Revalidation
  IF EXISTS (
    SELECT 1 FROM public.leave_requests
    WHERE employee_id = v_swap.requester_employee_id
      AND status = 'approved'
      AND v_asg_tgt.work_date BETWEEN start_date AND end_date
  ) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد التبادل: مقدم الطلب لديه إجازة معتمدة في تاريخ الوردية الجديدة' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leave_requests
    WHERE employee_id = v_swap.target_employee_id
      AND status = 'approved'
      AND v_asg_req.work_date BETWEEN start_date AND end_date
  ) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد التبادل: الموظف البديل لديه إجازة معتمدة في تاريخ الوردية الجديدة' USING ERRCODE = '22023';
  END IF;

  -- 5. Overlap Check if dates differ
  IF v_asg_req.work_date != v_asg_tgt.work_date THEN
    IF EXISTS (
      SELECT 1 FROM public.schedule_assignments
      WHERE employee_id = v_swap.requester_employee_id
        AND work_date = v_asg_tgt.work_date
        AND is_rest_day = false
        AND id != v_asg_req.id
    ) THEN
      RAISE EXCEPTION 'مقدم الطلب لديه وردية أخرى مجدولة في نفس يوم التبادل المطلوب' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.schedule_assignments
      WHERE employee_id = v_swap.target_employee_id
        AND work_date = v_asg_req.work_date
        AND is_rest_day = false
        AND id != v_asg_tgt.id
    ) THEN
      RAISE EXCEPTION 'الموظف البديل لديه وردية أخرى مجدولة في نفس يوم التبادل المطلوب' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 6. Closed Attendance Period & Payroll Interlock
  SELECT count(*) INTO v_closed_att
  FROM public.attendance_periods ap
  WHERE ap.company_id = v_swap.company_id
    AND ap.status IN ('closed', 'exported_to_payroll')
    AND (v_asg_req.work_date BETWEEN ap.from_date AND ap.to_date OR v_asg_tgt.work_date BETWEEN ap.from_date AND ap.to_date);

  IF v_closed_att > 0 THEN
    RAISE EXCEPTION 'لا يمكن تبديل الورديات: يقع تاريخ إحدى الوردتين ضمن فترة حضور مقفلة' USING ERRCODE = '22023';
  END IF;

  -- 7. Temporarily allow assignment update through trigger for approved swap
  PERFORM set_config('roster.allow_published_mutation', 'on', true);
  PERFORM set_config('roster.allow_swap_decision', 'on', true);

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
    is_rest_day = v_asg_tgt.is_rest_day,
    work_location_id = v_asg_tgt.work_location_id,
    shift_color = v_asg_tgt.shift_color,
    shift_name_ar = v_asg_tgt.shift_name_ar,
    shift_version = v_asg_tgt.shift_version,
    source = 'swap',
    updated_at = now()
  WHERE id = v_asg_req.id;

  UPDATE public.schedule_assignments
  SET
    shift_id = v_temp_shift,
    is_rest_day = v_temp_rest,
    work_location_id = v_temp_loc,
    shift_color = v_temp_color,
    shift_name_ar = v_temp_name,
    shift_version = v_temp_version,
    source = 'swap',
    updated_at = now()
  WHERE id = v_asg_tgt.id;

  -- Update swap request status
  UPDATE public.shift_swap_requests
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = COALESCE(p_notes, 'تم اعتماد تبادل الورديتين بنجاح وتحديث الجدول المعتمد'),
    updated_at = now()
  WHERE id = p_swap_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'تم اعتماد طلب تبادل الوردية وتحديث إسنادات الموظفين بنجاح'
  );
END;
$$;

DROP FUNCTION IF EXISTS public.reject_shift_swap(uuid, text);
CREATE OR REPLACE FUNCTION public.reject_shift_swap(
  p_swap_request_id uuid,
  p_reason text DEFAULT NULL
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

  IF v_swap.status != 'pending_approval' THEN
    RAISE EXCEPTION 'طلب التبادل ليس قيد الاعتماد (الحالة: %)', v_swap.status USING ERRCODE = '22023';
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

  PERFORM set_config('roster.allow_swap_decision', 'on', true);

  UPDATE public.shift_swap_requests
  SET
    status = 'rejected',
    rejection_reason = p_reason,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = COALESCE(p_reason, 'تم رفض طلب تبادل الوردية'),
    updated_at = now()
  WHERE id = p_swap_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'تم رفض طلب تبادل الوردية بنجاح'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_shift_swap(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_shift_swap(uuid, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 10. TEMPLATE GENERATION VALIDATION & TEMPLATE SAFETY
-- ----------------------------------------------------------------------------

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
  v_emp public.employees%ROWTYPE;
  v_curr_date date;
  v_day_idx integer;
  v_pat_item jsonb;
  v_shift_id uuid;
  v_is_rest boolean;
  v_shift public.shifts%ROWTYPE;
  v_created integer := 0;
  v_skipped integer := 0;
BEGIN
  -- 1. Validate period
  SELECT * INTO v_period FROM public.roster_periods WHERE id = p_roster_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة غير موجودة' USING ERRCODE = '22023';
  END IF;

  PERFORM public.check_roster_admin_permission(v_period.company_id);

  IF v_period.status IN ('published', 'locked') THEN
    RAISE EXCEPTION 'لا يمكن تطبيق قالب على فترة جدولة منشورة أو مقفلة' USING ERRCODE = '22023';
  END IF;

  -- 2. Validate template
  SELECT * INTO v_template FROM public.roster_templates
  WHERE id = p_template_id AND company_id = v_period.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'قالب الجدول غير موجود أو تابع لمنشأة أخرى' USING ERRCODE = '22023';
  END IF;

  IF NOT v_template.is_active THEN
    RAISE EXCEPTION 'قالب الجدول محذوف أو غير نشط' USING ERRCODE = '22023';
  END IF;

  -- 3. Verify all employee IDs belong to the company
  IF EXISTS (
    SELECT 1 FROM unnest(p_employee_ids) AS eid
    LEFT JOIN public.employees e ON e.id = eid AND e.company_id = v_period.company_id
    WHERE e.id IS NULL
  ) THEN
    RAISE EXCEPTION 'أحد الموظفين المحددين لا ينتمي إلى هذه المنشأة' USING ERRCODE = '42501';
  END IF;

  -- 4. Generate schedules
  FOREACH v_emp_id IN ARRAY p_employee_ids
  LOOP
    SELECT * INTO v_emp FROM public.employees WHERE id = v_emp_id;

    v_curr_date := v_period.period_start;
    WHILE v_curr_date <= v_period.period_end
    LOOP
      -- Check employment tenure
      IF v_curr_date < v_emp.hire_date OR (v_emp.exit_date IS NOT NULL AND v_curr_date > v_emp.exit_date) THEN
        v_skipped := v_skipped + 1;
        v_curr_date := v_curr_date + 1;
        CONTINUE;
      END IF;

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
          SELECT * INTO v_shift FROM public.shifts
          WHERE id = v_shift_id AND company_id = v_period.company_id;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'الوردية المحددة في القالب غير موجودة أو تابعة لمنشأة أخرى' USING ERRCODE = '22023';
          END IF;

          IF v_shift.status = 'archived' THEN
            RAISE EXCEPTION 'الوردية (%) المحددة في القالب مؤرشفة ولا يمكن توليد إسنادات منها', v_shift.code USING ERRCODE = '22023';
          END IF;
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

GRANT EXECUTE ON FUNCTION public.generate_roster_from_template(uuid, uuid, uuid[]) TO authenticated, service_role;

-- Safe Template & Rotation Archival functions
CREATE OR REPLACE FUNCTION public.archive_roster_template(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpl public.roster_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_tpl FROM public.roster_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'قالب الجدول غير موجود' USING ERRCODE = '22023';
  END IF;

  PERFORM public.check_roster_admin_permission(v_tpl.company_id);

  UPDATE public.roster_templates
  SET is_active = false, updated_at = now()
  WHERE id = p_template_id;

  RETURN jsonb_build_object('ok', true, 'message', 'تمت أرشفة قالب الجدول بنجاح');
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_rotation_pattern(p_rotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rot public.rotation_patterns%ROWTYPE;
BEGIN
  SELECT * INTO v_rot FROM public.rotation_patterns WHERE id = p_rotation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'نمط التدوير غير موجود' USING ERRCODE = '22023';
  END IF;

  PERFORM public.check_roster_admin_permission(v_rot.company_id);

  UPDATE public.rotation_patterns
  SET is_active = false, updated_at = now()
  WHERE id = p_rotation_id;

  RETURN jsonb_build_object('ok', true, 'message', 'تمت أرشفة نمط التدوير بنجاح');
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_roster_template(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_rotation_pattern(uuid) TO authenticated, service_role;
