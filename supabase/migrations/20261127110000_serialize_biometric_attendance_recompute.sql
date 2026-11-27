BEGIN;

-- Serialize terminal-triggered attendance processing for one employee and
-- business date. The lock and processing run in the same PostgreSQL transaction.
-- Scope is biometric route calls only; other direct process_attendance_day or
-- TypeScript recomputeDay callers are not serialized by this wrapper.
-- The event timestamp is converted with the employee's company's IANA timezone;
-- overnight checkout events can be attributed to the previous published shift.
CREATE OR REPLACE FUNCTION public.recompute_biometric_attendance_day(
  p_employee_id uuid,
  p_punch_time timestamptz,
  p_punch_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_timezone text;
  v_local_date date;
  v_business_date date;
  v_schedule_count integer;
  v_assignment_count integer;
  v_effective_assignment_id uuid;
  v_raw_assignment_id uuid;
  v_schedule record;
  v_result jsonb;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'غير مصرح بإعادة احتساب بصمة جهاز' USING ERRCODE = '42501';
  END IF;
  IF p_punch_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'نوع البصمة غير صالح' USING ERRCODE = '22023';
  END IF;

  SELECT e.company_id INTO v_company_id
  FROM public.employees e
  WHERE e.id = p_employee_id;
  IF NOT FOUND OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'الموظف أو المنشأة غير موجودة';
  END IF;

  v_timezone := public.get_effective_company_timezone(v_company_id);
  v_local_date := (p_punch_time AT TIME ZONE v_timezone)::date;
  v_business_date := v_local_date;

  -- An overnight shift belongs to its roster date. When a terminal records
  -- its checkout after local midnight, process the previous day's shift.
  IF p_punch_type = 'out' THEN
    SELECT s.work_date, s.start_time, s.end_time
      INTO v_schedule
    FROM public.vw_effective_published_schedules s
    WHERE s.employee_id = p_employee_id
      AND s.work_date = v_local_date - 1
      AND (COALESCE(s.is_overnight, false) OR s.end_time < s.start_time)
      AND p_punch_time >= ((s.work_date + s.start_time) AT TIME ZONE v_timezone) - interval '4 hours'
      AND p_punch_time <= (((s.work_date + 1) + s.end_time) AT TIME ZONE v_timezone) + interval '6 hours'
    ORDER BY s.work_date DESC
    LIMIT 1;
    IF FOUND THEN
      v_business_date := v_schedule.work_date;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_employee_id::text || ':' || v_business_date::text, 0)
  );

  -- Do not let the legacy processor consume a draft or unpublished assignment.
  -- It must resolve to exactly one authoritative published schedule first.
  SELECT count(*), (array_agg(s.assignment_id))[1]
    INTO v_schedule_count, v_effective_assignment_id
  FROM public.vw_effective_published_schedules s
  WHERE s.employee_id = p_employee_id
    AND s.work_date = v_business_date
    AND s.company_id = v_company_id;
  IF v_schedule_count <> 1 THEN
    RAISE EXCEPTION 'لا يوجد جدول عمل منشور وحيد ومعتمد لهذا اليوم' USING ERRCODE = 'P0001';
  END IF;

  -- process_attendance_day reads the raw assignment table with LIMIT 1. Fail
  -- closed if a draft/unpublished row could win that unordered selection.
  SELECT count(*), (array_agg(sa.id))[1]
    INTO v_assignment_count, v_raw_assignment_id
  FROM public.schedule_assignments sa
  WHERE sa.employee_id = p_employee_id
    AND sa.work_date = v_business_date;
  IF v_assignment_count <> 1 OR v_raw_assignment_id IS DISTINCT FROM v_effective_assignment_id THEN
    RAISE EXCEPTION 'تعارض بين جدول العمل المنشور والسجلات الخام' USING ERRCODE = 'P0001';
  END IF;

  -- Guarded above by the authoritative effective schedule view, the existing
  -- processor applies company-local time windows and attendance policy.
  v_result := public.process_attendance_day(p_employee_id, v_business_date);

  IF COALESCE((v_result ->> 'ok')::boolean, false) IS FALSE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'business_date', v_business_date,
      'attendance_result', v_result
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'business_date', v_business_date,
    'attendance_result', v_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_biometric_attendance_day(uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_biometric_attendance_day(uuid, timestamptz, text) TO service_role;

COMMIT;
