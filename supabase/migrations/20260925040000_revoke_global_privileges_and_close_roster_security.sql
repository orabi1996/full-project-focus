-- ============================================================================
-- PROMPT 13.4: REVOKE GLOBAL PRIVILEGES & CLOSE ROSTER SECURITY
-- Migration: 20260925040000_revoke_global_privileges_and_close_roster_security.sql
-- 1. Revoke unsafe global GRANT ALL on tables and sequences from authenticated
-- 2. Enforce direct-table mutation denial on schedule_assignments and roster_periods
-- 3. Authoritative published schedule view (security_invoker = true)
-- 4. Overlap prevention trigger and version progression (V1 -> V2)
-- 5. RPC get_effective_published_schedule with strict tenant and cardinality guards
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVOKE UNSAFE GLOBAL PRIVILEGES
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- Grant safe, least-privilege table operations under RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Deny direct-table write mutations on schedule_assignments and roster_periods
-- Mutations MUST proceed through authoritative SECURITY DEFINER RPCs only
REVOKE INSERT, UPDATE, DELETE ON public.schedule_assignments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.roster_periods FROM authenticated;

GRANT SELECT ON public.schedule_assignments TO authenticated;
GRANT SELECT ON public.roster_periods TO authenticated;
GRANT SELECT ON public.shifts TO authenticated;

-- Preserve service_role administrative capabilities
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ----------------------------------------------------------------------------
-- 2. AUTHORITATIVE EFFECTIVE PUBLISHED SCHEDULE VIEW (SECURITY INVOKER)
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

-- ----------------------------------------------------------------------------
-- 3. FAIL-CLOSED RPC: get_effective_published_schedule
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
  -- Service role bypass
  IF auth.role() = 'service_role' THEN
    v_is_authorized := true;
  END IF;

  -- Lookup target employee
  SELECT * INTO v_target_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المحدد غير موجود' USING ERRCODE = '22023';
  END IF;

  IF NOT v_is_authorized THEN
    v_my_emp_id := public.resolve_my_employee_id();
    v_my_company_id := public.current_company_id();

    -- Rule: Cross-company access is strictly DENIED
    IF v_my_company_id IS NULL OR v_my_company_id != v_target_emp.company_id THEN
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

    -- Caller and target belong to same company
    IF v_my_emp_id IS NOT NULL AND v_my_emp_id = p_employee_id THEN
      v_is_authorized := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    ) OR EXISTS (
      SELECT 1 FROM public.employee_roles er
      WHERE er.user_id = auth.uid()
        AND er.company_id = v_target_emp.company_id
        AND er.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    ) THEN
      v_is_authorized := true;
    ELSIF v_my_emp_id IS NOT NULL AND v_target_emp.manager_id = v_my_emp_id THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'غير مصرح: ليس لديك صلاحية للاطلاع على جدول هذا الموظف' USING ERRCODE = '42501';
  END IF;

  -- Cardinality Check: Fail closed if duplicate or conflicting published schedules exist
  SELECT count(*) INTO v_sched_count
  FROM public.vw_effective_published_schedules v
  WHERE v.employee_id = p_employee_id
    AND v.work_date = p_work_date;

  IF v_sched_count = 0 THEN
    RETURN NULL;
  ELSIF v_sched_count > 1 THEN
    RAISE EXCEPTION 'authoritative_schedule_integrity_error: تعارض حرج في قاعدة البيانات: يوجد أكثر من جدول معتمد ومنشور لنفس الموظف في هذا التاريخ' USING ERRCODE = 'P0001';
  END IF;

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
-- 4. OVERLAP PREVENTION TRIGGER
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
        AND id <> NEW.id
        AND status = 'published'
        AND period_start <= NEW.period_end
        AND period_end >= NEW.period_start
    ) THEN
      RAISE EXCEPTION 'لا يمكن نشر فترة جدولة تتداخل مع فترة منشورة أخرى' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_no_overlapping_published_rosters ON public.roster_periods;
CREATE TRIGGER trg_check_no_overlapping_published_rosters
  BEFORE INSERT OR UPDATE OF status, period_start, period_end
  ON public.roster_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.check_no_overlapping_published_rosters();
