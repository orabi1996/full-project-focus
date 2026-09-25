
-- 1) file_objects: أعمدة البيانات الوصفية الكاملة
ALTER TABLE public.file_objects
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS safe_filename text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS employee_id uuid,
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS malware_status text NOT NULL DEFAULT 'unscanned',
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 2) دوال لوحة التحكم
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_start_date date, p_end_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_total int; v_active int; v_saudi int; v_non_saudi int;
  v_pending_requests int; v_present_today int; v_absent_today int;
BEGIN
  SELECT count(*) INTO v_total FROM public.employees;
  SELECT count(*) INTO v_active FROM public.employees WHERE status IN ('active','probation','on_leave');
  SELECT count(*) INTO v_saudi FROM public.employees
    WHERE status IN ('active','probation','on_leave')
      AND (nationality ILIKE '%سعود%' OR nationality ILIKE '%saudi%');
  v_non_saudi := v_active - v_saudi;
  SELECT count(*) INTO v_pending_requests FROM public.requests WHERE status IN ('pending','submitted');
  SELECT count(*) FILTER (WHERE status = 'present'), count(*) FILTER (WHERE status = 'absent')
    INTO v_present_today, v_absent_today
    FROM public.attendance_records WHERE work_date = p_end_date;
  RETURN jsonb_build_object(
    'totalEmployees', v_total,
    'activeEmployees', v_active,
    'saudiCount', v_saudi,
    'nonSaudiCount', v_non_saudi,
    'pendingRequests', v_pending_requests,
    'presentToday', v_present_today,
    'absentToday', v_absent_today,
    'startDate', p_start_date,
    'endDate', p_end_date
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_attendance_trend(p_anchor_date date, p_days int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'date', d,
      'present', COALESCE(s.present, 0),
      'absent', COALESCE(s.absent, 0),
      'late', COALESCE(s.late, 0)
    ) ORDER BY d)
    FROM generate_series(p_anchor_date - (p_days - 1), p_anchor_date, interval '1 day') AS d
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE status = 'present') AS present,
        count(*) FILTER (WHERE status = 'absent') AS absent,
        count(*) FILTER (WHERE status = 'late') AS late
      FROM public.attendance_records WHERE work_date = d::date
    ) s ON true
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_integration_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN jsonb_build_object(
    'biometricDevices', (SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'status', status)) FROM public.biometric_devices),
    'checkedAt', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_summary(date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_attendance_trend(date, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_integration_health() FROM anon;
