-- ============================================================================
-- PROMPT 13.3: FINAL SECURITY & AUTHORITATIVE SCHEDULE CLOSURE
-- Append-only migration: Secure view (security_invoker), authorized RPC access,
-- overlap prevention, deterministic schedule cardinality, and strict tenant RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURE EFFECTIVE SCHEDULE VIEW (SECURITY INVOKER)
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.vw_effective_published_schedules CASCADE;

CREATE OR REPLACE VIEW public.vw_effective_published_schedules
WITH (security_invoker = true) AS
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
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. HARDEN TENANT & SCOPE RLS POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- A. Schedule Assignments RLS: Employee self, team manager, HR admin of same company
DROP POLICY IF EXISTS schedule_read ON public.schedule_assignments;
DROP POLICY IF EXISTS "schedule_read" ON public.schedule_assignments;
DROP POLICY IF EXISTS schedule_assignments_read ON public.schedule_assignments;
CREATE POLICY schedule_assignments_read ON public.schedule_assignments
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      -- 1. Employee sees their own published assignments
      (employee_id = public.resolve_my_employee_id() AND status = 'published')
      -- 2. Line Manager sees direct reporting team published assignments
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = schedule_assignments.employee_id
          AND e.manager_id = public.resolve_my_employee_id()
          AND schedule_assignments.status = 'published'
      )
      -- 3. HR / Org Admin / Attendance Officer sees company assignments
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
      OR EXISTS (
        SELECT 1 FROM public.employee_roles er
        WHERE er.user_id = auth.uid()
          AND er.company_id = schedule_assignments.company_id
          AND er.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

DROP POLICY IF EXISTS schedule_assignments_write ON public.schedule_assignments;
CREATE POLICY schedule_assignments_write ON public.schedule_assignments
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
      OR EXISTS (
        SELECT 1 FROM public.employee_roles er
        WHERE er.user_id = auth.uid()
          AND er.company_id = schedule_assignments.company_id
          AND er.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
      OR EXISTS (
        SELECT 1 FROM public.employee_roles er
        WHERE er.user_id = auth.uid()
          AND er.company_id = schedule_assignments.company_id
          AND er.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

-- B. Roster Periods RLS: Own company only (Zero cross-company enumeration)
DROP POLICY IF EXISTS roster_periods_read ON public.roster_periods;
CREATE POLICY roster_periods_read ON public.roster_periods
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      status IN ('published', 'superseded')
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
      OR EXISTS (
        SELECT 1 FROM public.employee_roles er
        WHERE er.user_id = auth.uid()
          AND er.company_id = roster_periods.company_id
          AND er.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

DROP POLICY IF EXISTS roster_periods_write ON public.roster_periods;
CREATE POLICY roster_periods_write ON public.roster_periods
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
      OR EXISTS (
        SELECT 1 FROM public.employee_roles er
        WHERE er.user_id = auth.uid()
          AND er.company_id = roster_periods.company_id
          AND er.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

-- C. Shifts RLS: Own company only
DROP POLICY IF EXISTS shifts_read ON public.shifts;
DROP POLICY IF EXISTS "shifts_read" ON public.shifts;
CREATE POLICY shifts_read ON public.shifts
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
  );

DROP POLICY IF EXISTS shifts_write ON public.shifts;
CREATE POLICY shifts_write ON public.shifts
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
      OR EXISTS (
        SELECT 1 FROM public.employee_roles er
        WHERE er.user_id = auth.uid()
          AND er.company_id = shifts.company_id
          AND er.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 3. SECURE AUTHORIZED EFFECTIVE SCHEDULE RPC (CARDINALITY & DETERMINISM)
-- ----------------------------------------------------------------------------

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
  v_target_emp public.employees%ROWTYPE;
  v_my_emp_id uuid;
  v_my_company_id uuid;
  v_is_authorized boolean := false;
  v_sched_count integer := 0;
BEGIN
  -- 1. Service role bypass
  IF auth.role() = 'service_role' THEN
    v_is_authorized := true;
  END IF;

  -- 2. Lookup target employee
  SELECT * INTO v_target_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المحدد غير موجود' USING ERRCODE = '22023';
  END IF;

  IF NOT v_is_authorized THEN
    v_my_emp_id := public.resolve_my_employee_id();
    v_my_company_id := public.current_company_id();

    -- Rule: Cross-company access is strictly DENIED
    IF v_my_company_id IS NULL OR v_my_company_id != v_target_emp.company_id THEN
      -- Check if caller is platform super_admin
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
      ) AND NOT EXISTS (
        SELECT 1 FROM public.employee_roles er
        WHERE er.user_id = auth.uid() AND er.role = 'super_admin'
      ) THEN
        RAISE EXCEPTION 'غير مصرح: لا يمكنك الاطلاع على جدول موظف تابع لمنشأة أخرى' USING ERRCODE = '42501';
      END IF;
    END IF;

    -- Caller and target belong to same company (or caller is super_admin)
    -- Check role hierarchy:
    -- A. Self: employee requesting own schedule
    IF v_my_emp_id IS NOT NULL AND v_my_emp_id = p_employee_id THEN
      v_is_authorized := true;
    -- B. Super Admin
    ELSIF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    ) OR EXISTS (
      SELECT 1 FROM public.employee_roles er
      WHERE er.user_id = auth.uid() AND er.role = 'super_admin'
    ) THEN
      v_is_authorized := true;
    -- C. Org Admin / HR Manager / Attendance Officer of the same company
    ELSIF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('org_admin', 'hr_manager', 'attendance_officer')
    ) OR EXISTS (
      SELECT 1 FROM public.employee_roles er
      WHERE er.user_id = auth.uid()
        AND er.company_id = v_target_emp.company_id
        AND er.role IN ('org_admin', 'hr_manager', 'attendance_officer')
    ) THEN
      v_is_authorized := true;
    -- D. Line Manager: direct reporting team only
    ELSIF v_my_emp_id IS NOT NULL AND v_target_emp.manager_id = v_my_emp_id THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'غير مصرح: ليس لديك صلاحية للاطلاع على جدول هذا الموظف' USING ERRCODE = '42501';
  END IF;

  -- 3. Cardinality Check & Deterministic resolution (no unordered LIMIT 1)
  -- Count matching authoritative published schedules
  SELECT count(*) INTO v_sched_count
  FROM public.vw_effective_published_schedules v
  WHERE v.employee_id = p_employee_id
    AND v.work_date = p_work_date;

  IF v_sched_count = 0 THEN
    RETURN NULL;
  ELSIF v_sched_count > 1 THEN
    RAISE EXCEPTION 'authoritative_schedule_integrity_error: تعارض حرج في قاعدة البيانات: يوجد أكثر من جدول معتمد ومنشور لنفس الموظف في هذا التاريخ' USING ERRCODE = 'P0001';
  END IF;

  -- Exactly one authoritative schedule exists
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
    AND v.work_date = p_work_date;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_published_schedule(uuid, date) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. DATABASE-LEVEL OVERLAP PREVENTION TRIGGER
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_no_overlapping_published_rosters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published' THEN
    IF EXISTS (
      SELECT 1 FROM public.roster_periods
      WHERE company_id = NEW.company_id
        AND status = 'published'
        AND id != NEW.id
        AND (period_start <= NEW.period_end AND period_end >= NEW.period_start)
    ) THEN
      RAISE EXCEPTION 'لا يمكن وجود فترات جداول عمل منشورة متداخلة لنفس المنشأة (الفترة: % إلى %)', NEW.period_start, NEW.period_end USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_overlapping_published_rosters ON public.roster_periods;
CREATE TRIGGER trg_prevent_overlapping_published_rosters
  BEFORE INSERT OR UPDATE OF status, period_start, period_end ON public.roster_periods
  FOR EACH ROW
  WHEN (NEW.status = 'published')
  EXECUTE FUNCTION public.check_no_overlapping_published_rosters();

-- ----------------------------------------------------------------------------
-- 5. ATOMIC PUBLISHING WITH OVERLAP REJECTION & AMENDMENT SUPERSESSION
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
  v_overlapping_id uuid;
  v_overlap_start date;
  v_overlap_end date;
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

  -- 5. OVERLAP CHECK: Reject any other published roster period with overlapping dates
  -- unless it is the EXACT same period range (the legitimate predecessor being superseded by amendment)
  SELECT id, period_start, period_end INTO v_overlapping_id, v_overlap_start, v_overlap_end
  FROM public.roster_periods
  WHERE company_id = v_target.company_id
    AND status = 'published'
    AND id != p_roster_id
    AND (period_start <= v_target.period_end AND period_end >= v_target.period_start)
    AND NOT (period_start = v_target.period_start AND period_end = v_target.period_end);

  IF v_overlapping_id IS NOT NULL THEN
    RAISE EXCEPTION 'لا يمكن اعتماد ونشر الجدول: يوجد جدول عمل معتمد ومنشور يتداخل مع هذه الفترة (الفترة المتداخلة: % إلى %). يمنع تداخل فترات الجداول المنشورة للمنشأة الواحدة', v_overlap_start, v_overlap_end USING ERRCODE = '22023';
  END IF;

  -- 6. ATOMIC AMENDMENT SUPERSESSION:
  -- If another version is currently published for the exact same date range, supersede it FIRST
  SELECT id, version INTO v_old_published_id, v_old_version
  FROM public.roster_periods
  WHERE company_id = v_target.company_id
    AND period_start = v_target.period_start
    AND period_end = v_target.period_end
    AND status = 'published'
    AND id != p_roster_id;

  IF v_old_published_id IS NOT NULL THEN
    -- Mark old version superseded FIRST (before V2 becomes published)
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

    -- Flag attendance records on modified assignments as requiring reprocess
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

  -- 7. Atomically publish target roster and its assignments
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

  -- 8. Audit log for publishing event
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

GRANT EXECUTE ON FUNCTION public.publish_roster(uuid) TO authenticated, service_role;
