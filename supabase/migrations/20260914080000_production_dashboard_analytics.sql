-- =============================================================================
-- MIGRATION: 20260914080000_production_dashboard_analytics.sql
-- PURPOSE  : Secure server-side RPCs for Production Dashboard Analytics
-- SECURITY : SECURITY DEFINER + search_path=public, REVOKE FROM PUBLIC
-- APPEND-ONLY: Does NOT modify earlier migrations.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_employees_status_company
  ON public.employees (status, company_id, hire_date);

CREATE INDEX IF NOT EXISTS idx_requests_status_type_created
  ON public.requests (status, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_leave_dates
  ON public.requests (type, status, start_date, end_date)
  WHERE type = 'leave';

CREATE INDEX IF NOT EXISTS idx_attendance_records_workdate_emp
  ON public.attendance_records (work_date, employee_id, status);

CREATE INDEX IF NOT EXISTS idx_employee_docs_expiry
  ON public.employee_documents (expiry_date, employee_id)
  WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_docs_expiry
  ON public.company_documents (expiry_date, status)
  WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period
  ON public.payroll_runs (period_year DESC, period_month DESC, status);

-- ---------------------------------------------------------------------------
-- HELPER: Resolve current user company_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.company_id
  FROM public.employees e
  WHERE (e.id = public.current_employee_id() OR e.user_id = auth.uid())
    AND e.status NOT IN ('terminated', 'suspended')
  ORDER BY e.created_at DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_company_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.current_user_company_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC 1: get_dashboard_summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_start_date date DEFAULT CURRENT_DATE - 29,
  p_end_date   date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_emp_id          uuid;
  v_company_id      uuid;
  v_is_hr           boolean;
  v_is_payroll      boolean;
  v_is_recruiter    boolean;
  v_active_count    integer := 0;
  v_new_hires       integer := 0;
  v_departures      integer := 0;
  v_prev_new_hires  integer := 0;
  v_saudi_count     integer := 0;
  v_att_present     integer := 0;
  v_att_late        integer := 0;
  v_att_absent      integer := 0;
  v_att_on_leave    integer := 0;
  v_att_eligible    integer := 0;
  v_pending_count   integer := 0;
  v_payroll_available boolean := false;
  v_payroll_period  text;
  v_payroll_status  text;
  v_payroll_emp_count integer;
  v_payroll_net_total numeric;
  v_docs_expired    integer := 0;
  v_docs_7d         integer := 0;
  v_docs_30d        integer := 0;
  v_docs_60d        integer := 0;
  v_recruit_available boolean := false;
  v_open_positions  integer := 0;
  v_active_candidates integer := 0;
  v_leave_roster    jsonb := '[]'::jsonb;
  v_period_days     integer;
  v_prev_start      date;
  v_prev_end        date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_emp_id       := public.current_employee_id();
  v_company_id   := public.current_user_company_id();
  v_is_hr        := public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager']);
  v_is_payroll   := public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','payroll_officer','finance_officer']);
  v_is_recruiter := public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','recruiter']);

  -- Headcount (HR scope only)
  IF v_is_hr AND v_company_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.employees
    WHERE company_id = v_company_id AND status = 'active';

    SELECT COUNT(*) INTO v_new_hires
    FROM public.employees
    WHERE company_id = v_company_id
      AND hire_date BETWEEN p_start_date AND p_end_date;

    SELECT COUNT(*) INTO v_departures
    FROM public.employees
    WHERE company_id = v_company_id
      AND status = 'terminated'
      AND updated_at::date BETWEEN p_start_date AND p_end_date;

    SELECT COUNT(*) INTO v_saudi_count
    FROM public.employees
    WHERE company_id = v_company_id
      AND status = 'active'
      AND (
        nationality ILIKE '%سعود%'
        OR nationality ILIKE '%saudi%'
        OR (national_id_or_iqama IS NOT NULL AND national_id_or_iqama ~ '^1[0-9]{9}$')
      );

    v_period_days  := p_end_date - p_start_date + 1;
    v_prev_end     := p_start_date - 1;
    v_prev_start   := v_prev_end - v_period_days + 1;

    SELECT COUNT(*) INTO v_prev_new_hires
    FROM public.employees
    WHERE company_id = v_company_id
      AND hire_date BETWEEN v_prev_start AND v_prev_end;
  END IF;

  -- Attendance KPIs (for anchor date p_end_date)
  IF v_is_hr AND v_company_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_att_eligible
    FROM public.employees
    WHERE company_id = v_company_id AND status = 'active';

    SELECT COUNT(DISTINCT ar.employee_id) INTO v_att_present
    FROM public.attendance_records ar
    JOIN public.employees e ON e.id = ar.employee_id
    WHERE e.company_id = v_company_id
      AND ar.work_date = p_end_date AND ar.status = 'present';

    SELECT COUNT(DISTINCT ar.employee_id) INTO v_att_late
    FROM public.attendance_records ar
    JOIN public.employees e ON e.id = ar.employee_id
    WHERE e.company_id = v_company_id
      AND ar.work_date = p_end_date AND ar.status = 'late';

    SELECT COUNT(DISTINCT ar.employee_id) INTO v_att_absent
    FROM public.attendance_records ar
    JOIN public.employees e ON e.id = ar.employee_id
    WHERE e.company_id = v_company_id
      AND ar.work_date = p_end_date AND ar.status = 'absent';

    -- On leave on anchor date: approved leave requests covering p_end_date
    SELECT COUNT(DISTINCT r.employee_id) INTO v_att_on_leave
    FROM public.requests r
    JOIN public.employees e ON e.id = r.employee_id
    WHERE e.company_id = v_company_id
      AND r.type = 'leave'
      AND r.status = 'approved'
      AND COALESCE(r.start_date::date, (r.payload->>'startDate')::date) <= p_end_date
      AND COALESCE(r.end_date::date, (r.payload->>'endDate')::date)     >= p_end_date;
  END IF;

  -- Pending approvals (authorization-aware)
  IF v_company_id IS NOT NULL THEN
    IF v_is_hr THEN
      SELECT COUNT(*) INTO v_pending_count
      FROM public.requests r
      JOIN public.employees e ON e.id = r.employee_id
      WHERE e.company_id = v_company_id
        AND r.status = 'pending';
    ELSE
      SELECT COUNT(*) INTO v_pending_count
      FROM public.requests r
      JOIN public.employees e ON e.id = r.employee_id
      WHERE e.company_id = v_company_id
        AND r.status = 'pending'
        AND r.current_approver_role IN (
          SELECT rd.role_code FROM public.role_definitions rd
          JOIN public.user_roles ur ON ur.role_id = rd.id
          WHERE ur.user_id = v_uid
        );
    END IF;
  END IF;

  -- Payroll KPI (authorized only)
  IF v_is_payroll AND v_company_id IS NOT NULL THEN
    v_payroll_available := true;
    SELECT
      to_char(make_date(pr.period_year, pr.period_month, 1), 'YYYY-MM'),
      pr.status,
      pr.total_employees,
      pr.total_net_salary
    INTO v_payroll_period, v_payroll_status, v_payroll_emp_count, v_payroll_net_total
    FROM public.payroll_runs pr
    JOIN public.payroll_groups pg ON pg.id = pr.payroll_group_id
    WHERE pg.company_id = v_company_id
    ORDER BY pr.period_year DESC, pr.period_month DESC
    LIMIT 1;
  END IF;

  -- Document expiry alerts
  IF v_is_hr AND v_company_id IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE ed.expiry_date < CURRENT_DATE),
      COUNT(*) FILTER (WHERE ed.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),
      COUNT(*) FILTER (WHERE ed.expiry_date BETWEEN CURRENT_DATE + 8 AND CURRENT_DATE + 30),
      COUNT(*) FILTER (WHERE ed.expiry_date BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60)
    INTO v_docs_expired, v_docs_7d, v_docs_30d, v_docs_60d
    FROM public.employee_documents ed
    JOIN public.employees e ON e.id = ed.employee_id
    WHERE e.company_id = v_company_id
      AND ed.expiry_date IS NOT NULL
      AND COALESCE(ed.status, 'valid') NOT IN ('archived', 'deleted');
  END IF;

  IF v_company_id IS NOT NULL THEN
    SELECT
      v_docs_expired + COUNT(*) FILTER (WHERE cd.expiry_date < CURRENT_DATE),
      v_docs_7d      + COUNT(*) FILTER (WHERE cd.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),
      v_docs_30d     + COUNT(*) FILTER (WHERE cd.expiry_date BETWEEN CURRENT_DATE + 8 AND CURRENT_DATE + 30),
      v_docs_60d     + COUNT(*) FILTER (WHERE cd.expiry_date BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60)
    INTO v_docs_expired, v_docs_7d, v_docs_30d, v_docs_60d
    FROM public.company_documents cd
    WHERE cd.company_id = v_company_id
      AND cd.expiry_date IS NOT NULL
      AND COALESCE(cd.status, 'published') NOT IN ('archived', 'deleted', 'draft');
  END IF;

  -- Recruitment KPIs
  IF v_is_recruiter AND v_company_id IS NOT NULL THEN
    v_recruit_available := true;
    SELECT COUNT(*) INTO v_open_positions
    FROM public.job_openings jo
    WHERE jo.company_id = v_company_id
      AND jo.published_status = 'published'
      AND jo.filled_count < jo.openings_count;

    SELECT COUNT(*) INTO v_active_candidates
    FROM public.candidates c
    JOIN public.job_openings jo ON jo.id = c.job_id
    WHERE jo.company_id = v_company_id
      AND c.stage NOT IN ('hired', 'rejected');
  END IF;

  -- Leave roster (real approved leaves covering anchor date)
  IF v_is_hr AND v_company_id IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id',          r.id,
          'employeeId',  e.id,
          'firstNameAr', e.first_name_ar,
          'lastNameAr',  e.last_name_ar,
          'jobTitleAr',  e.job_title,
          'leaveType',   COALESCE(r.payload->>'leaveType', 'إجازة'),
          'startDate',   COALESCE(r.start_date::text, r.payload->>'startDate'),
          'endDate',     COALESCE(r.end_date::text, r.payload->>'endDate')
        )
      ),
      '[]'::jsonb
    ) INTO v_leave_roster
    FROM public.requests r
    JOIN public.employees e ON e.id = r.employee_id
    WHERE e.company_id = v_company_id
      AND r.type = 'leave'
      AND r.status = 'approved'
      AND COALESCE(r.start_date::date, (r.payload->>'startDate')::date) <= p_end_date
      AND COALESCE(r.end_date::date, (r.payload->>'endDate')::date)     >= p_end_date
    LIMIT 10;
  END IF;

  RETURN jsonb_build_object(
    'scope',     CASE WHEN v_is_hr THEN 'organization' ELSE 'self' END,
    'anchorDate', p_end_date::text,
    'startDate',  p_start_date::text,
    'endDate',    p_end_date::text,
    'headcount', jsonb_build_object(
      'available',         v_is_hr,
      'activeCount',       CASE WHEN v_is_hr THEN v_active_count     ELSE NULL END,
      'newHires',          CASE WHEN v_is_hr THEN v_new_hires         ELSE NULL END,
      'departures',        CASE WHEN v_is_hr THEN v_departures        ELSE NULL END,
      'prevNewHires',      CASE WHEN v_is_hr THEN v_prev_new_hires    ELSE NULL END,
      'saudiCount',        CASE WHEN v_is_hr THEN v_saudi_count       ELSE NULL END,
      'turnoverRate',      CASE WHEN v_is_hr AND v_active_count > 0 THEN ROUND((v_departures::numeric / v_active_count::numeric) * 100, 2) ELSE NULL END,
      'reasonUnavailable', CASE WHEN NOT v_is_hr THEN 'unauthorized' ELSE NULL END
    ),
    'attendance', jsonb_build_object(
      'available',         v_is_hr,
      'eligible',          CASE WHEN v_is_hr THEN v_att_eligible ELSE NULL END,
      'present',           CASE WHEN v_is_hr THEN v_att_present  ELSE NULL END,
      'late',              CASE WHEN v_is_hr THEN v_att_late     ELSE NULL END,
      'absent',            CASE WHEN v_is_hr THEN v_att_absent   ELSE NULL END,
      'onLeave',           CASE WHEN v_is_hr THEN v_att_on_leave ELSE NULL END,
      'reasonUnavailable', CASE WHEN NOT v_is_hr THEN 'unauthorized' ELSE NULL END
    ),
    'pendingApprovals', jsonb_build_object(
      'available', true,
      'count',     v_pending_count
    ),
    'payroll', jsonb_build_object(
      'available',         v_payroll_available,
      'period',            v_payroll_period,
      'status',            v_payroll_status,
      'employeeCount',     v_payroll_emp_count,
      'netTotal',          v_payroll_net_total,
      'wpsStatus',         NULL,
      'reasonUnavailable', CASE WHEN NOT v_payroll_available THEN 'unauthorized' ELSE NULL END
    ),
    'documents', jsonb_build_object(
      'available',  true,
      'expired',    v_docs_expired,
      'within7d',   v_docs_7d,
      'within30d',  v_docs_30d,
      'within60d',  v_docs_60d
    ),
    'recruitment', jsonb_build_object(
      'available',         v_recruit_available,
      'openPositions',     CASE WHEN v_recruit_available THEN v_open_positions     ELSE NULL END,
      'activeCandidates',  CASE WHEN v_recruit_available THEN v_active_candidates  ELSE NULL END,
      'reasonUnavailable', CASE WHEN NOT v_recruit_available THEN 'unauthorized' ELSE NULL END
    ),
    'leaveRoster', COALESCE(v_leave_roster, '[]'::jsonb),
    'integrations', jsonb_build_object(
      'available',         false,
      'reasonUnavailable', 'not_configured',
      'platforms',         '[]'::jsonb
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_summary(date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_summary(date, date) TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_summary IS
  'Returns aggregated dashboard KPIs. SECURITY DEFINER: enforces company scope and role-based authorization. No individual salary or personal data rows returned.';

-- ---------------------------------------------------------------------------
-- RPC 2: get_dashboard_attendance_trend
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_attendance_trend(
  p_anchor_date date DEFAULT CURRENT_DATE,
  p_days        integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_company_id uuid;
  v_is_hr      boolean;
  v_result     jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;

  v_company_id := public.current_user_company_id();
  v_is_hr      := public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager']);

  IF NOT v_is_hr OR v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'available',         false,
      'reasonUnavailable', CASE WHEN NOT v_is_hr THEN 'unauthorized' ELSE 'no_company' END,
      'trend',             '[]'::jsonb
    );
  END IF;

  p_days := GREATEST(1, LEAST(p_days, 90));

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date',       d::date::text,
        'dayLabelAr', to_char(d, 'Day'),
        'present',    COALESCE(agg.cnt_present, 0),
        'late',       COALESCE(agg.cnt_late, 0),
        'absent',     COALESCE(agg.cnt_absent, 0)
      )
      ORDER BY d
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM generate_series(p_anchor_date - (p_days - 1), p_anchor_date, '1 day'::interval) AS d
  LEFT JOIN (
    SELECT
      ar.work_date,
      COUNT(DISTINCT ar.employee_id) FILTER (WHERE ar.status = 'present') AS cnt_present,
      COUNT(DISTINCT ar.employee_id) FILTER (WHERE ar.status = 'late')    AS cnt_late,
      COUNT(DISTINCT ar.employee_id) FILTER (WHERE ar.status = 'absent')  AS cnt_absent
    FROM public.attendance_records ar
    JOIN public.employees e ON e.id = ar.employee_id
    WHERE e.company_id = v_company_id
      AND ar.work_date BETWEEN (p_anchor_date - (p_days - 1)) AND p_anchor_date
    GROUP BY ar.work_date
  ) agg ON agg.work_date = d::date;

  RETURN jsonb_build_object(
    'available',   true,
    'anchorDate',  p_anchor_date::text,
    'days',        p_days,
    'trend',       COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_attendance_trend(date, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_attendance_trend(date, integer) TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_attendance_trend IS
  'Returns daily attendance counts for last N days. HR roles only. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- RPC 3: get_dashboard_integration_health
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_integration_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;

  v_is_admin := public.current_user_has_any_role(ARRAY['super_admin','org_admin','finance_officer']);

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'available',         false,
      'reasonUnavailable', 'unauthorized',
      'platforms',         '[]'::jsonb
    );
  END IF;

  -- No integrations_registry table exists yet; return truthful "not_configured" state.
  RETURN jsonb_build_object(
    'available', true,
    'platforms', jsonb_build_array(
      jsonb_build_object('name', 'منصة قوى (Qiwa)',     'status', 'not_configured', 'configured', false),
      jsonb_build_object('name', 'منصة مقيم (Muqeem)',   'status', 'not_configured', 'configured', false),
      jsonb_build_object('name', 'منصة مَدَد (Mudad)',     'status', 'not_configured', 'configured', false),
      jsonb_build_object('name', 'التأمينات (GOSI)',      'status', 'not_configured', 'configured', false),
      jsonb_build_object('name', 'هيئة الزكاة (ZATCA)',   'status', 'not_configured', 'configured', false)
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_integration_health() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_integration_health() TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_integration_health IS
  'Returns integration health. Returns not_configured until a real integrations registry exists. SECURITY DEFINER.';
