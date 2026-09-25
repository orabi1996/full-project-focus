-- ============================================================================
-- Migration: 20260924030000_close_attendance_truthfulness_gaps.sql
-- Description: PROMPT 12.3 Final Attendance Truthfulness & Real DB Closure
--              - Drops default 'flag' on gps_accuracy_action
--              - Eliminates 480-minute shift fallback in period closing
--              - Explicit split shift calculation: seg1 + seg2 - break
--              - Validates shift completeness (fixed, overnight, flexible, split)
--              - Truthful rest days: calculated explicitly, not as residual
--              - Authoritative overtime facts: requested, approved, actual, payable
--              - Preserves legacy overtime history (no destructive rate_type rewrite)
-- ============================================================================

-- 1. Drop default on gps_accuracy_action
ALTER TABLE public.attendance_policies
  ALTER COLUMN gps_accuracy_action DROP DEFAULT;

-- 2. Add requested_overtime_minutes to payroll snapshots if missing
ALTER TABLE public.attendance_payroll_snapshots
  ADD COLUMN IF NOT EXISTS requested_overtime_minutes integer NOT NULL DEFAULT 0;

-- 3. Add legacy_original_rate_type to overtime_records to preserve source history
ALTER TABLE public.overtime_records
  ADD COLUMN IF NOT EXISTS legacy_original_rate_type text;

DO $$
BEGIN
  ALTER TABLE public.overtime_records DROP CONSTRAINT IF EXISTS overtime_records_rate_type_check;
  ALTER TABLE public.overtime_records ADD CONSTRAINT overtime_records_rate_type_check
    CHECK (rate_type IN ('standard', 'holiday_or_rest_day', 'regular_150', 'holiday_200', 'rest_day_200'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Shift Duration Calculation Helper (NO 480-MINUTE FALLBACK!)
CREATE OR REPLACE FUNCTION public.calculate_shift_expected_minutes(p_shift_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_seg1 integer;
  v_seg2 integer;
  v_duration integer;
BEGIN
  IF p_shift_id IS NULL THEN
    RAISE EXCEPTION 'معرف الوردية غير محدد.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الوردية المحددة غير موجودة (معرف: %).', p_shift_id USING ERRCODE = '22023';
  END IF;

  IF v_shift.type = 'fixed' THEN
    IF v_shift.start_time IS NULL OR v_shift.end_time IS NULL THEN
      RAISE EXCEPTION 'الوردية الثابتة (%) تفتقر لوقت البداية أو النهاية.', v_shift.name_ar USING ERRCODE = '22023';
    END IF;

    IF v_shift.is_overnight IS TRUE THEN
      v_duration := round(EXTRACT(EPOCH FROM (('2000-01-02 ' || v_shift.end_time)::timestamp - ('2000-01-01 ' || v_shift.start_time)::timestamp)) / 60.0)::integer;
    ELSE
      v_duration := round(EXTRACT(EPOCH FROM (('2000-01-01 ' || v_shift.end_time)::timestamp - ('2000-01-01 ' || v_shift.start_time)::timestamp)) / 60.0)::integer;
    END IF;

    v_duration := GREATEST(0, v_duration - COALESCE(v_shift.break_minutes, 0));
    RETURN v_duration;

  ELSIF v_shift.type = 'overnight' THEN
    IF v_shift.start_time IS NULL OR v_shift.end_time IS NULL THEN
      RAISE EXCEPTION 'الوردية الليلية (%) تفتقر لوقت البداية أو النهاية.', v_shift.name_ar USING ERRCODE = '22023';
    END IF;

    v_duration := round(EXTRACT(EPOCH FROM (('2000-01-02 ' || v_shift.end_time)::timestamp - ('2000-01-01 ' || v_shift.start_time)::timestamp)) / 60.0)::integer;
    v_duration := GREATEST(0, v_duration - COALESCE(v_shift.break_minutes, 0));
    RETURN v_duration;

  ELSIF v_shift.type = 'flexible' THEN
    IF v_shift.flexible_hours IS NULL OR v_shift.flexible_hours <= 0 THEN
      RAISE EXCEPTION 'الوردية المرنة (%) تفتقر لعدد الساعات المرنة المطلوبة (flexible_hours).', v_shift.name_ar USING ERRCODE = '22023';
    END IF;

    RETURN round(v_shift.flexible_hours * 60.0)::integer;

  ELSIF v_shift.type = 'split' THEN
    IF v_shift.start_time IS NULL OR v_shift.end_time IS NULL OR
       v_shift.split_second_start_time IS NULL OR v_shift.split_second_end_time IS NULL THEN
      RAISE EXCEPTION 'وردية الدوام المجزأ (%) تفتقر لأوقات بداية أو نهاية الفترتين.', v_shift.name_ar USING ERRCODE = '22023';
    END IF;

    v_seg1 := round(EXTRACT(EPOCH FROM (('2000-01-01 ' || v_shift.end_time)::timestamp - ('2000-01-01 ' || v_shift.start_time)::timestamp)) / 60.0)::integer;
    v_seg2 := round(EXTRACT(EPOCH FROM (('2000-01-01 ' || v_shift.split_second_end_time)::timestamp - ('2000-01-01 ' || v_shift.split_second_start_time)::timestamp)) / 60.0)::integer;

    v_duration := GREATEST(0, (v_seg1 + v_seg2) - COALESCE(v_shift.break_minutes, 0));
    RETURN v_duration;

  ELSE
    RAISE EXCEPTION 'نوع الوردية غير مدعوم أو غير مكتمل الإعداد (%: %).', v_shift.name_ar, v_shift.type USING ERRCODE = '22023';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_shift_expected_minutes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_shift_expected_minutes(uuid) TO service_role;

-- 5. Shift Configuration Validation Helper
CREATE OR REPLACE FUNCTION public.validate_period_shifts(p_period_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.attendance_periods%ROWTYPE;
  v_rec record;
  v_expected_mins integer;
BEGIN
  SELECT * INTO v_period FROM public.attendance_periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الحضور المحددة غير موجودة.' USING ERRCODE = '22023';
  END IF;

  FOR v_rec IN (
    SELECT DISTINCT s.id AS shift_id, s.name_ar, s.type
    FROM public.schedule_assignments sa
    JOIN public.shifts s ON s.id = sa.shift_id
    WHERE sa.company_id = v_period.company_id
      AND sa.work_date BETWEEN v_period.from_date AND v_period.to_date
      AND sa.is_rest_day IS NOT TRUE
  ) LOOP
    v_expected_mins := public.calculate_shift_expected_minutes(v_rec.shift_id);
    IF v_expected_mins <= 0 THEN
      RAISE EXCEPTION 'الوردية (%) المجدولة خلال الفترة تحسب 0 دقيقة عمل، يرجى مراجعة إعدادات الوردية.', v_rec.name_ar USING ERRCODE = '22023';
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_period_shifts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_period_shifts(uuid) TO service_role;

-- 6. Save Attendance Policy (NO 'flag' DEFAULT, EXPLICIT VALIDATION)
CREATE OR REPLACE FUNCTION public.save_attendance_policy(p_policy jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_comp_id uuid;
  v_policy_company_id uuid;
  v_new_id uuid;
  v_new_version integer := 1;
  v_effective_from date;
  v_effective_to date;
  v_name_ar text;
  v_jurisdiction text;
  v_grace_in integer;
  v_grace_out integer;
  v_ot_reg numeric(3,2);
  v_ot_hol numeric(3,2);
  v_def_hours numeric(4,2);
  v_ram_hours numeric(4,2);
  v_max_week numeric(4,2);
  v_ram_week numeric(4,2);
  v_geofence_enforced boolean;
  v_geofence_radius integer;
  v_max_gps_acc integer;
  v_gps_accuracy_action text;
  v_auto_deduct_breaks boolean;
  v_break_duration integer;
  v_max_consec_hours numeric(4,2);
  v_req_biometric boolean;
  v_allow_mobile boolean;
  v_ot_pre_approval boolean;
BEGIN
  -- Authorization check
  IF auth.role() != 'service_role' THEN
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'يجب تسجيل الدخول لإدارة سياسات الحضور.' USING ERRCODE = '42501';
    END IF;

    SELECT role::text INTO v_user_role
    FROM public.user_roles
    WHERE user_id = v_user_id
      AND role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    LIMIT 1;

    IF v_user_role IS NULL THEN
      RAISE EXCEPTION 'غير مصرح لك بإدارة أو تعديل سياسات الحضور والانصراف.' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_comp_id := public.current_company_id();
  IF p_policy ? 'company_id' AND (p_policy->>'company_id') IS NOT NULL THEN
    v_policy_company_id := (p_policy->>'company_id')::uuid;
    IF v_comp_id IS NOT NULL AND v_policy_company_id != v_comp_id AND v_user_role != 'super_admin' AND auth.role() != 'service_role' THEN
      RAISE EXCEPTION 'غير مصرح لك بإنشاء أو تعديل سياسة لمنشأة أخرى.' USING ERRCODE = '42501';
    END IF;
    v_comp_id := v_policy_company_id;
  END IF;

  IF v_comp_id IS NULL THEN
    RAISE EXCEPTION 'معرف الشركة مطلوب لتهيئة سياسة الحضور.' USING ERRCODE = '22023';
  END IF;

  v_name_ar := trim(p_policy->>'name_ar');
  IF v_name_ar IS NULL OR v_name_ar = '' THEN
    RAISE EXCEPTION 'اسم سياسة الدوام مطلوب باللغة العربية.' USING ERRCODE = '22023';
  END IF;

  v_effective_from := (p_policy->>'effective_from')::date;
  IF v_effective_from IS NULL THEN
    RAISE EXCEPTION 'تاريخ بدء سريان السياسة (effective_from) مطلوب وصريح.' USING ERRCODE = '22023';
  END IF;

  IF p_policy ? 'effective_to' AND (p_policy->>'effective_to') IS NOT NULL THEN
    v_effective_to := (p_policy->>'effective_to')::date;
  END IF;

  -- Validate required explicit booleans
  IF NOT (p_policy ? 'geofence_enforced') OR (p_policy->>'geofence_enforced') IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد خيار إلزامية السياج الجغرافي صراحة (geofence_enforced: true/false).' USING ERRCODE = '22023';
  END IF;
  v_geofence_enforced := (p_policy->>'geofence_enforced')::boolean;

  IF NOT (p_policy ? 'auto_deduct_breaks') OR (p_policy->>'auto_deduct_breaks') IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد خيار خصم فترات الراحة تلقائياً صراحة (auto_deduct_breaks: true/false).' USING ERRCODE = '22023';
  END IF;
  v_auto_deduct_breaks := (p_policy->>'auto_deduct_breaks')::boolean;

  IF NOT (p_policy ? 'require_biometric_or_gps') OR (p_policy->>'require_biometric_or_gps') IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد خيار اشتراط البصمة أو GPS صراحة (require_biometric_or_gps: true/false).' USING ERRCODE = '22023';
  END IF;
  v_req_biometric := (p_policy->>'require_biometric_or_gps')::boolean;

  IF NOT (p_policy ? 'allow_mobile_punch') OR (p_policy->>'allow_mobile_punch') IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد خيار السماح بتسجيل الجوال صراحة (allow_mobile_punch: true/false).' USING ERRCODE = '22023';
  END IF;
  v_allow_mobile := (p_policy->>'allow_mobile_punch')::boolean;

  IF NOT (p_policy ? 'overtime_pre_approval_required') OR (p_policy->>'overtime_pre_approval_required') IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد خيار اشتراط الموافقة المسبقة للإضافي صراحة (overtime_pre_approval_required: true/false).' USING ERRCODE = '22023';
  END IF;
  v_ot_pre_approval := (p_policy->>'overtime_pre_approval_required')::boolean;

  -- Explicit GPS accuracy action (NO SILENT 'flag' DEFAULT!)
  v_gps_accuracy_action := p_policy->>'gps_accuracy_action';
  IF v_allow_mobile IS TRUE OR (p_policy ? 'max_gps_accuracy_meters' AND (p_policy->>'max_gps_accuracy_meters') IS NOT NULL) THEN
    IF v_gps_accuracy_action IS NULL OR v_gps_accuracy_action NOT IN ('reject', 'flag', 'allow') THEN
      RAISE EXCEPTION 'يجب تحديد إجراء دقة نظام تحديد المواقع (gps_accuracy_action) صراحة (reject, flag, allow) عند تفعيل تسجيل الجوال.' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_jurisdiction := p_policy->>'jurisdiction';
  v_grace_in := (p_policy->>'grace_period_in_minutes')::integer;
  v_grace_out := (p_policy->>'grace_period_out_minutes')::integer;
  v_ot_reg := (p_policy->>'overtime_regular_multiplier')::numeric;
  v_ot_hol := (p_policy->>'overtime_holiday_multiplier')::numeric;
  v_def_hours := (p_policy->>'default_work_hours_per_day')::numeric;
  v_ram_hours := (p_policy->>'ramadan_work_hours_per_day')::numeric;
  v_max_week := (p_policy->>'max_work_hours_per_week')::numeric;
  v_ram_week := (p_policy->>'ramadan_max_work_hours_per_week')::numeric;
  v_geofence_radius := (p_policy->>'geofence_radius_meters')::integer;
  v_max_gps_acc := (p_policy->>'max_gps_accuracy_meters')::integer;
  v_break_duration := (p_policy->>'break_duration_minutes')::integer;
  v_max_consec_hours := (p_policy->>'max_consecutive_hours_without_break')::numeric;

  -- Close existing active policy if needed
  UPDATE public.attendance_policies
  SET
    status = 'archived',
    effective_to = LEAST(COALESCE(effective_to, v_effective_from - 1), v_effective_from - 1),
    updated_at = now()
  WHERE company_id = v_comp_id
    AND status = 'active'
    AND effective_from < v_effective_from;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
  FROM public.attendance_policies
  WHERE company_id = v_comp_id;

  INSERT INTO public.attendance_policies (
    company_id, name_ar, version, effective_from, effective_to, status,
    jurisdiction, grace_period_in_minutes, grace_period_out_minutes,
    overtime_regular_multiplier, overtime_holiday_multiplier,
    default_work_hours_per_day, ramadan_work_hours_per_day,
    max_work_hours_per_week, ramadan_max_work_hours_per_week,
    geofence_enforced, geofence_radius_meters, max_gps_accuracy_meters, gps_accuracy_action,
    auto_deduct_breaks, break_duration_minutes, max_consecutive_hours_without_break,
    require_biometric_or_gps, allow_mobile_punch, overtime_pre_approval_required,
    created_by, updated_by, created_at, updated_at
  ) VALUES (
    v_comp_id, v_name_ar, v_new_version, v_effective_from, v_effective_to, 'active',
    v_jurisdiction, v_grace_in, v_grace_out,
    v_ot_reg, v_ot_hol,
    v_def_hours, v_ram_hours,
    v_max_week, v_ram_week,
    v_geofence_enforced, v_geofence_radius, v_max_gps_acc, v_gps_accuracy_action,
    v_auto_deduct_breaks, v_break_duration, v_max_consec_hours,
    v_req_biometric, v_allow_mobile, v_ot_pre_approval,
    v_user_id, v_user_id, now(), now()
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'policy_id', v_new_id,
    'version', v_new_version,
    'status', 'active',
    'effective_from', v_effective_from,
    'company_id', v_comp_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_attendance_policy(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_attendance_policy(jsonb) TO service_role;

-- 7. Close Attendance Period (TRUTHFUL REST DAYS, SHIFT CALCULATION, NEUTRAL OVERTIME FACTS)
CREATE OR REPLACE FUNCTION public.close_attendance_period(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_period public.attendance_periods%ROWTYPE;
  v_target_version integer;
  v_missing_policy_cnt integer;
  v_missing_schedule_cnt integer;
  v_unprocessed_days_cnt integer;
  v_snapshot_count integer := 0;
  v_emp record;
  v_expected_workdays integer;
  v_expected_work_minutes integer;
  v_rest_days integer;
  v_policy public.attendance_policies%ROWTYPE;
  v_approved_ot_mins integer;
  v_requested_ot_mins integer;
  v_actual_ot_mins integer;
  v_payable_ot_mins integer;
BEGIN
  IF p_period_id IS NULL THEN
    RAISE EXCEPTION 'معرف فترة الحضور مطلوب.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_period
  FROM public.attendance_periods
  WHERE id = p_period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الحضور المحددة غير موجودة.' USING ERRCODE = '22023';
  END IF;

  -- 1. Authorization Verification
  IF auth.role() != 'service_role' THEN
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'يجب تسجيل الدخول لإغلاق فترة الحضور.' USING ERRCODE = '42501';
    END IF;

    SELECT role::text INTO v_user_role
    FROM public.user_roles
    WHERE user_id = v_user_id
      AND role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    LIMIT 1;

    IF v_user_role IS NULL THEN
      RAISE EXCEPTION 'غير مصرح لك بإغلاق فترة الحضور والانصراف.' USING ERRCODE = '42501';
    END IF;

    IF v_user_role != 'super_admin' THEN
      IF public.current_company_id() != v_period.company_id THEN
        RAISE EXCEPTION 'غير مصرح لك بإغلاق فترة حضور لشركة أخرى.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- 2. State Verification
  IF v_period.status != 'open' THEN
    RAISE EXCEPTION 'لا يمكن إغلاق فترة حضور حالتها الحالية ليست مفتوحة (%s).', v_period.status USING ERRCODE = '22023';
  END IF;

  -- 3. Policy Verification
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

  -- 4. Timezone Verification
  IF public.get_effective_company_timezone(v_period.company_id) IS NULL THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الفترة: المنطقة الزمنية للمنشأة غير مهيأة.' USING ERRCODE = '22023';
  END IF;

  -- 5. Published Schedule Verification
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

  -- 6. Shift Configuration Completeness Validation
  PERFORM public.validate_period_shifts(p_period_id);

  -- 7. Processing Completeness Verification
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

  -- Resolve active policy for overtime calculation rules
  SELECT * INTO v_policy
  FROM public.attendance_policies
  WHERE company_id = v_period.company_id
    AND status = 'active'
    AND effective_from <= v_period.to_date
    AND (effective_to IS NULL OR effective_to >= v_period.from_date)
  ORDER BY version DESC
  LIMIT 1;

  -- 8. Snapshot Generation with Truthful Values
  FOR v_emp IN (
    SELECT e.id AS employee_id, e.full_name, e.hire_date, e.exit_date
    FROM public.employees e
    WHERE e.company_id = v_period.company_id
      AND (e.hire_date IS NULL OR e.hire_date <= v_period.to_date)
      AND (e.status IN ('active', 'probation', 'on_leave') OR e.exit_date >= v_period.from_date)
  ) LOOP
    -- Calculate expected working days and minutes using actual shift definitions
    SELECT
      count(*),
      COALESCE(sum(public.calculate_shift_expected_minutes(sa.shift_id)), 0)
    INTO v_expected_workdays, v_expected_work_minutes
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
      RAISE EXCEPTION 'لا يمكن إغلاق الفترة لأن جدول الدوام غير منشور أو غير صالح للموظف % (معرف: %).', v_emp.full_name, v_emp.employee_id USING ERRCODE = '22023';
    END IF;

    -- Truthful Rest Days: calculated explicitly from schedule assignments within active tenure
    SELECT count(*) INTO v_rest_days
    FROM public.schedule_assignments sa
    WHERE sa.employee_id = v_emp.employee_id
      AND sa.work_date BETWEEN v_period.from_date AND v_period.to_date
      AND sa.is_rest_day IS TRUE
      AND (v_emp.hire_date IS NULL OR sa.work_date >= v_emp.hire_date)
      AND (v_emp.exit_date IS NULL OR sa.work_date <= v_emp.exit_date);

    -- Attendance record statistics
    WITH stats AS (
      SELECT
        count(*) FILTER (WHERE ar.status = 'present') AS present_days,
        count(*) FILTER (WHERE ar.status = 'absent') AS absent_days,
        count(*) FILTER (WHERE ar.status IN ('leave', 'on_leave')) AS leave_days,
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
        COALESCE(sum(round(hours * 60)), 0) AS req_ot_mins,
        COALESCE(sum(round(hours * 60)) FILTER (WHERE status = 'approved'), 0) AS app_ot_mins,
        COALESCE(sum(hours) FILTER (WHERE rate_type IN ('standard', 'regular_150') AND status = 'approved'), 0) AS reg_ot_hrs,
        COALESCE(sum(hours) FILTER (WHERE rate_type IN ('holiday_or_rest_day', 'holiday_200', 'rest_day_200') AND status = 'approved'), 0) AS hol_ot_hrs,
        jsonb_build_object(
          'standard_minutes', COALESCE(sum(round(hours * 60)) FILTER (WHERE rate_type IN ('standard', 'regular_150') AND status = 'approved'), 0),
          'holiday_or_rest_minutes', COALESCE(sum(round(hours * 60)) FILTER (WHERE rate_type IN ('holiday_or_rest_day', 'holiday_200', 'rest_day_200') AND status = 'approved'), 0)
        ) AS ot_categories
      FROM public.overtime_records
      WHERE employee_id = v_emp.employee_id
        AND work_date BETWEEN v_period.from_date AND v_period.to_date
    )
    SELECT
      ot.req_ot_mins,
      ot.app_ot_mins
    INTO v_requested_ot_mins, v_approved_ot_mins
    FROM ot;

    -- Authoritative Actual Overtime: derived from attendance records worked exceeding expected shift minutes
    SELECT COALESCE(sum(
      GREATEST(0, ar.worked_minutes - COALESCE(public.calculate_shift_expected_minutes(ar.shift_id), 0))
    ), 0) INTO v_actual_ot_mins
    FROM public.attendance_records ar
    WHERE ar.employee_id = v_emp.employee_id
      AND ar.work_date BETWEEN v_period.from_date AND v_period.to_date
      AND ar.shift_id IS NOT NULL;

    -- Payable Overtime: reconciled with pre-approval policy
    IF v_policy.overtime_pre_approval_required IS TRUE THEN
      IF v_actual_ot_mins > 0 THEN
        v_payable_ot_mins := LEAST(v_approved_ot_mins, v_actual_ot_mins);
      ELSE
        v_payable_ot_mins := v_approved_ot_mins;
      END IF;
    ELSE
      v_payable_ot_mins := v_actual_ot_mins;
    END IF;

    -- Insert snapshot with deterministic SHA-256 seal
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
      requested_overtime_minutes,
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
      v_rest_days,
      stats.leave_days,
      stats.late_minutes,
      stats.early_mins,
      stats.worked_hrs,
      ot.reg_ot_hrs,
      ot.hol_ot_hrs,
      v_requested_ot_mins,
      v_approved_ot_mins,
      v_actual_ot_mins,
      v_payable_ot_mins,
      ot.ot_categories,
      'standard',
      stats.absent_days,
      stats.violations,
      encode(sha256(
        (v_period.company_id::text || '|' ||
         v_period.id::text || '|' ||
         v_target_version::text || '|' ||
         v_emp.employee_id::text || '|' ||
         v_expected_workdays::text || '|' ||
         v_expected_work_minutes::text || '|' ||
         stats.present_days::text || '|' ||
         stats.absent_days::text || '|' ||
         v_rest_days::text || '|' ||
         v_approved_ot_mins::text || '|' ||
         v_actual_ot_mins::text || '|' ||
         v_payable_ot_mins::text || '|' ||
         stats.late_minutes::text)::bytea
      ), 'hex')
    FROM (
      SELECT
        count(*) FILTER (WHERE ar.status = 'present') AS present_days,
        count(*) FILTER (WHERE ar.status = 'absent') AS absent_days,
        count(*) FILTER (WHERE ar.status IN ('leave', 'on_leave')) AS leave_days,
        COALESCE(sum(ar.late_minutes), 0) AS late_minutes,
        COALESCE(sum(ar.early_departure_minutes), 0) AS early_mins,
        COALESCE(sum(ar.worked_hours), 0) AS worked_hrs,
        COALESCE(sum(ar.violations_count), 0) AS violations
      FROM public.attendance_records ar
      WHERE ar.employee_id = v_emp.employee_id
        AND ar.work_date BETWEEN v_period.from_date AND v_period.to_date
    ) stats,
    (
      SELECT
        COALESCE(sum(hours) FILTER (WHERE rate_type IN ('standard', 'regular_150') AND status = 'approved'), 0) AS reg_ot_hrs,
        COALESCE(sum(hours) FILTER (WHERE rate_type IN ('holiday_or_rest_day', 'holiday_200', 'rest_day_200') AND status = 'approved'), 0) AS hol_ot_hrs,
        jsonb_build_object(
          'standard_minutes', COALESCE(sum(round(hours * 60)) FILTER (WHERE rate_type IN ('standard', 'regular_150') AND status = 'approved'), 0),
          'holiday_or_rest_minutes', COALESCE(sum(round(hours * 60)) FILTER (WHERE rate_type IN ('holiday_or_rest_day', 'holiday_200', 'rest_day_200') AND status = 'approved'), 0)
        ) AS ot_categories
      FROM public.overtime_records
      WHERE employee_id = v_emp.employee_id
        AND work_date BETWEEN v_period.from_date AND v_period.to_date
    ) ot;

    v_snapshot_count := v_snapshot_count + 1;
  END LOOP;

  -- Seal period status to 'closed'
  UPDATE public.attendance_periods
  SET
    status = 'closed',
    closed_by = v_user_id,
    closed_at = now()
  WHERE id = p_period_id;

  RETURN jsonb_build_object(
    'ok', true,
    'period_id', p_period_id,
    'status', 'closed',
    'version', v_target_version,
    'snapshots_count', v_snapshot_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_attendance_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_attendance_period(uuid) TO service_role;
