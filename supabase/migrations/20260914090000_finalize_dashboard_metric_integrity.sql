-- =============================================================================
-- MIGRATION: 20260914090000_finalize_dashboard_metric_integrity.sql
-- PURPOSE  : Final integrity and security hotfix for Production Dashboard Analytics:
--            • Canonical pending_approval status alignment
--            • Active workforce definition (active, probation, on_leave)
--            • Removal of false turnover calculation (no updated_at guessing)
--            • Authoritative nationality for Saudization (no ID prefix heuristic)
--            • Company-scoped document expiry authorization (HR only for org counts)
--            • Company timezone-aware anchor dates (safe IANA resolution)
--            • Truthful attendance denominator and actionable approval items
-- SECURITY : SECURITY DEFINER + search_path = public, REVOKE FROM PUBLIC,
--            GRANT TO authenticated only.
-- APPEND-ONLY: Does NOT modify earlier migrations.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUM & STATUS ALIGNMENT: Add pending_approval to request_status enum
-- ---------------------------------------------------------------------------
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'pending_approval';
COMMIT;

-- Migrate existing 'pending' rows to canonical 'pending_approval'
UPDATE public.requests
SET status = 'pending_approval'
WHERE status::text = 'pending';

-- Update default on requests.status to canonical 'pending_approval'
ALTER TABLE public.requests
  ALTER COLUMN status SET DEFAULT 'pending_approval'::public.request_status;

-- Index for canonical pending_approval queries
CREATE INDEX IF NOT EXISTS idx_requests_pending_approval
  ON public.requests (employee_id, status, created_at DESC)
  WHERE status = 'pending_approval';

-- ---------------------------------------------------------------------------
-- 2. HELPER: Resolve company timezone safely with fallback
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_company_timezone(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN 'Asia/Riyadh';
  END IF;

  SELECT c.timezone INTO v_tz
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_tz IS NULL OR TRIM(v_tz) = '' THEN
    RETURN 'Asia/Riyadh';
  END IF;

  -- Validate IANA timezone by testing conversion
  BEGIN
    PERFORM now() AT TIME ZONE v_tz;
    RETURN v_tz;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'Asia/Riyadh';
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_company_timezone(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_company_timezone(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. REFINED RPC 1: get_dashboard_summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid                   uuid := auth.uid();
  v_emp_id                uuid;
  v_company_id            uuid;
  v_timezone              text;
  v_company_today         date;
  v_start_date            date;
  v_end_date              date;

  -- Roles
  v_is_hr                 boolean;
  v_is_payroll            boolean;
  v_is_recruiter          boolean;

  -- Active Workforce & Headcount (active, probation, on_leave)
  v_active_count          integer := 0;
  v_new_hires             integer := 0;
  v_prev_new_hires        integer := 0;

  -- Authoritative Saudization (nationality-based, no ID prefix heuristic)
  v_known_saudi           integer := 0;
  v_known_non_saudi       integer := 0;
  v_unknown_nat           integer := 0;

  -- Attendance
  v_att_present           integer := 0;
  v_att_late              integer := 0;
  v_att_absent            integer := 0;
  v_att_on_leave          integer := 0;
  v_att_eligible          integer := 0;
  v_scheduled_count       integer := 0;

  -- Pending approvals (canonical 'pending_approval' status)
  v_pending_count         integer := 0;
  v_pending_items         jsonb := '[]'::jsonb;

  -- Payroll (authorized only)
  v_payroll_available     boolean := false;
  v_payroll_period        text;
  v_payroll_status        text;
  v_payroll_emp_count     integer;
  v_payroll_net_total     numeric;

  -- Document expiry alerts (authorized HR only)
  v_docs_available        boolean := false;
  v_docs_expired          integer := 0;
  v_docs_7d               integer := 0;
  v_docs_30d              integer := 0;
  v_docs_60d              integer := 0;

  -- Recruitment (recruiter and HR only)
  v_recruit_available     boolean := false;
  v_open_positions        integer := 0;
  v_active_candidates     integer := 0;

  -- Leave roster (real approved leaves covering anchor date)
  v_leave_roster          jsonb := '[]'::jsonb;

  -- Comparison period
  v_period_days           integer;
  v_prev_start            date;
  v_prev_end              date;

BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_emp_id       := public.current_employee_id();
  v_company_id   := public.current_user_company_id();
  v_is_hr        := public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager']);
  v_is_payroll   := public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','payroll_officer','finance_officer']);
  v_is_recruiter := public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager','recruiter']);

  -- Resolve company timezone and business anchor date
  v_timezone      := public.get_company_timezone(v_company_id);
  v_company_today := (now() AT TIME ZONE v_timezone)::date;

  v_end_date      := COALESCE(p_end_date, v_company_today);
  v_start_date    := COALESCE(p_start_date, v_end_date - 29);

  -- -------------------------------------------------------------------------
  -- HEADCOUNT & ACTIVE WORKFORCE (HR Scope Only)
  -- Active workforce definition: status IN ('active', 'probation', 'on_leave')
  -- Excludes: 'terminated', 'suspended'
  -- -------------------------------------------------------------------------
  IF v_is_hr AND v_company_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.employees
    WHERE company_id = v_company_id
      AND status IN ('active', 'probation', 'on_leave');

    SELECT COUNT(*) INTO v_new_hires
    FROM public.employees
    WHERE company_id = v_company_id
      AND hire_date BETWEEN v_start_date AND v_end_date;

    -- Comparison period for new hires
    v_period_days := v_end_date - v_start_date + 1;
    v_prev_end    := v_start_date - 1;
    v_prev_start  := v_prev_end - v_period_days + 1;

    SELECT COUNT(*) INTO v_prev_new_hires
    FROM public.employees
    WHERE company_id = v_company_id
      AND hire_date BETWEEN v_prev_start AND v_prev_end;

    -- Authoritative Saudization: Based purely on normalized nationality field
    SELECT
      COUNT(*) FILTER (WHERE nationality ILIKE '%سعود%' OR nationality ILIKE '%saudi%'),
      COUNT(*) FILTER (WHERE nationality IS NOT NULL AND TRIM(nationality) <> '' AND NOT (nationality ILIKE '%سعود%' OR nationality ILIKE '%saudi%')),
      COUNT(*) FILTER (WHERE nationality IS NULL OR TRIM(nationality) = '')
    INTO v_known_saudi, v_known_non_saudi, v_unknown_nat
    FROM public.employees
    WHERE company_id = v_company_id
      AND status IN ('active', 'probation', 'on_leave');
  END IF;

  -- -------------------------------------------------------------------------
  -- ATTENDANCE KPIS (For Anchor Date v_end_date)
  -- -------------------------------------------------------------------------
  IF v_is_hr AND v_company_id IS NOT NULL THEN
    -- Check if schedule assignments exist for this date
    SELECT COUNT(DISTINCT sa.employee_id) INTO v_scheduled_count
    FROM public.schedule_assignments sa
    JOIN public.employees e ON e.id = sa.employee_id
    WHERE e.company_id = v_company_id
      AND sa.work_date = v_end_date
      AND COALESCE(sa.is_rest_day, false) = false
      AND e.status IN ('active', 'probation', 'on_leave');

    IF v_scheduled_count > 0 THEN
      v_att_eligible := v_scheduled_count;
    ELSE
      -- Fallback: total active employed workforce
      v_att_eligible := v_active_count;
    END IF;

    SELECT COUNT(DISTINCT ar.employee_id) INTO v_att_present
    FROM public.attendance_records ar
    JOIN public.employees e ON e.id = ar.employee_id
    WHERE e.company_id = v_company_id
      AND ar.work_date = v_end_date AND ar.status = 'present';

    SELECT COUNT(DISTINCT ar.employee_id) INTO v_att_late
    FROM public.attendance_records ar
    JOIN public.employees e ON e.id = ar.employee_id
    WHERE e.company_id = v_company_id
      AND ar.work_date = v_end_date AND ar.status = 'late';

    SELECT COUNT(DISTINCT ar.employee_id) INTO v_att_absent
    FROM public.attendance_records ar
    JOIN public.employees e ON e.id = ar.employee_id
    WHERE e.company_id = v_company_id
      AND ar.work_date = v_end_date AND ar.status = 'absent';

    -- Approved leaves covering anchor date
    SELECT COUNT(DISTINCT r.employee_id) INTO v_att_on_leave
    FROM public.requests r
    JOIN public.employees e ON e.id = r.employee_id
    WHERE e.company_id = v_company_id
      AND r.type = 'leave'
      AND r.status = 'approved'
      AND COALESCE(r.start_date::date, (r.payload->>'startDate')::date) <= v_end_date
      AND COALESCE(r.end_date::date, (r.payload->>'endDate')::date)     >= v_end_date;
  END IF;

  -- -------------------------------------------------------------------------
  -- PENDING APPROVALS: Canonical 'pending_approval' status & Actionable List
  -- Both count and items use the exact same authorization and criteria.
  -- -------------------------------------------------------------------------
  IF v_company_id IS NOT NULL THEN
    IF v_is_hr THEN
      SELECT COUNT(*) INTO v_pending_count
      FROM public.requests r
      JOIN public.employees e ON e.id = r.employee_id
      WHERE e.company_id = v_company_id
        AND r.status::text = 'pending_approval';

      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id',             r.id,
            'referenceNo',    r.reference,
            'type',           r.type,
            'requesterId',    e.id,
            'requesterName',  COALESCE(e.first_name_ar || ' ' || e.last_name_ar, e.full_name, 'الموظف'),
            'departmentName', (SELECT d.name_ar FROM public.departments d WHERE d.id = e.department_id),
            'submittedAt',    r.created_at,
            'reason',         COALESCE(r.reason, r.payload->>'reason', r.payload->>'notes', 'طلب في مسار الخدمة')
          )
          ORDER BY r.created_at DESC
        ),
        '[]'::jsonb
      ) INTO v_pending_items
      FROM (
        SELECT r2.*
        FROM public.requests r2
        JOIN public.employees e2 ON e2.id = r2.employee_id
        WHERE e2.company_id = v_company_id
          AND r2.status::text = 'pending_approval'
        ORDER BY r2.created_at DESC
        LIMIT 10
      ) r
      JOIN public.employees e ON e.id = r.employee_id;

    ELSE
      -- Line managers & role-designated approvers
      SELECT COUNT(*) INTO v_pending_count
      FROM public.requests r
      JOIN public.employees e ON e.id = r.employee_id
      WHERE e.company_id = v_company_id
        AND r.status::text = 'pending_approval'
        AND (
          (public.current_user_has_any_role(ARRAY['line_manager']) AND e.manager_id = v_emp_id)
          OR r.current_approver_role IN (
            SELECT rd.role_code FROM public.role_definitions rd
            JOIN public.user_roles ur ON ur.role_id = rd.id
            WHERE ur.user_id = v_uid
          )
        );

      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id',             r.id,
            'referenceNo',    r.reference,
            'type',           r.type,
            'requesterId',    e.id,
            'requesterName',  COALESCE(e.first_name_ar || ' ' || e.last_name_ar, e.full_name, 'الموظف'),
            'departmentName', (SELECT d.name_ar FROM public.departments d WHERE d.id = e.department_id),
            'submittedAt',    r.created_at,
            'reason',         COALESCE(r.reason, r.payload->>'reason', r.payload->>'notes', 'طلب في مسار الخدمة')
          )
          ORDER BY r.created_at DESC
        ),
        '[]'::jsonb
      ) INTO v_pending_items
      FROM (
        SELECT r2.*
        FROM public.requests r2
        JOIN public.employees e2 ON e2.id = r2.employee_id
        WHERE e2.company_id = v_company_id
          AND r2.status::text = 'pending_approval'
          AND (
            (public.current_user_has_any_role(ARRAY['line_manager']) AND e2.manager_id = v_emp_id)
            OR r2.current_approver_role IN (
              SELECT rd.role_code FROM public.role_definitions rd
              JOIN public.user_roles ur ON ur.role_id = rd.id
              WHERE ur.user_id = v_uid
            )
          )
        ORDER BY r2.created_at DESC
        LIMIT 10
      ) r
      JOIN public.employees e ON e.id = r.employee_id;
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- PAYROLL (Authorized Roles Only)
  -- -------------------------------------------------------------------------
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

  -- -------------------------------------------------------------------------
  -- DOCUMENT EXPIRY ALERTS (HR Scope Only — Protected from unauthorized leakage)
  -- Uses company business date v_end_date consistently.
  -- -------------------------------------------------------------------------
  IF v_is_hr AND v_company_id IS NOT NULL THEN
    v_docs_available := true;

    -- Employee documents
    SELECT
      COUNT(*) FILTER (WHERE ed.expiry_date < v_end_date),
      COUNT(*) FILTER (WHERE ed.expiry_date BETWEEN v_end_date AND v_end_date + 7),
      COUNT(*) FILTER (WHERE ed.expiry_date BETWEEN v_end_date + 8 AND v_end_date + 30),
      COUNT(*) FILTER (WHERE ed.expiry_date BETWEEN v_end_date + 31 AND v_end_date + 60)
    INTO v_docs_expired, v_docs_7d, v_docs_30d, v_docs_60d
    FROM public.employee_documents ed
    JOIN public.employees e ON e.id = ed.employee_id
    WHERE e.company_id = v_company_id
      AND ed.expiry_date IS NOT NULL
      AND COALESCE(ed.status, 'valid') NOT IN ('archived', 'deleted');

    -- Company documents (HR only)
    SELECT
      v_docs_expired + COUNT(*) FILTER (WHERE cd.expiry_date < v_end_date),
      v_docs_7d      + COUNT(*) FILTER (WHERE cd.expiry_date BETWEEN v_end_date AND v_end_date + 7),
      v_docs_30d     + COUNT(*) FILTER (WHERE cd.expiry_date BETWEEN v_end_date + 8 AND v_end_date + 30),
      v_docs_60d     + COUNT(*) FILTER (WHERE cd.expiry_date BETWEEN v_end_date + 31 AND v_end_date + 60)
    INTO v_docs_expired, v_docs_7d, v_docs_30d, v_docs_60d
    FROM public.company_documents cd
    WHERE cd.company_id = v_company_id
      AND cd.expiry_date IS NOT NULL
      AND COALESCE(cd.status, 'published') NOT IN ('archived', 'deleted', 'draft');
  ELSE
    v_docs_available := false;
  END IF;

  -- -------------------------------------------------------------------------
  -- RECRUITMENT (Authorized Roles Only)
  -- -------------------------------------------------------------------------
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

  -- -------------------------------------------------------------------------
  -- LEAVE ROSTER (HR Scope Only)
  -- -------------------------------------------------------------------------
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
      AND COALESCE(r.start_date::date, (r.payload->>'startDate')::date) <= v_end_date
      AND COALESCE(r.end_date::date, (r.payload->>'endDate')::date)     >= v_end_date
    LIMIT 10;
  END IF;

  -- -------------------------------------------------------------------------
  -- ASSEMBLE TRUTHFUL RESPONSE
  -- -------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'scope',       CASE WHEN v_is_hr THEN 'organization' ELSE 'self' END,
    'timezone',    v_timezone,
    'anchorDate',  v_end_date::text,
    'startDate',   v_start_date::text,
    'endDate',     v_end_date::text,

    'headcount', jsonb_build_object(
      'available',                 v_is_hr,
      'activeCount',               CASE WHEN v_is_hr THEN v_active_count     ELSE NULL END,
      'newHires',                  CASE WHEN v_is_hr THEN v_new_hires         ELSE NULL END,
      'prevNewHires',              CASE WHEN v_is_hr THEN v_prev_new_hires    ELSE NULL END,
      'saudiCount',                CASE WHEN v_is_hr THEN v_known_saudi      ELSE NULL END,
      'nonSaudiCount',             CASE WHEN v_is_hr THEN v_known_non_saudi  ELSE NULL END,
      'unknownNationalityCount',   CASE WHEN v_is_hr THEN v_unknown_nat      ELSE NULL END,
      -- Turnover unavailable: No authoritative termination_date field exists
      'turnoverRate',              NULL,
      'reasonTurnoverUnavailable', 'termination_date_not_available',
      'reasonUnavailable',         CASE WHEN NOT v_is_hr THEN 'unauthorized' ELSE NULL END
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
      'count',     v_pending_count,
      'items',     v_pending_items
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
      'available',         v_docs_available,
      'expired',           v_docs_expired,
      'within7d',          v_docs_7d,
      'within30d',         v_docs_30d,
      'within60d',         v_docs_60d,
      'reasonUnavailable', CASE WHEN NOT v_docs_available THEN 'unauthorized' ELSE NULL END
    ),

    'recruitment', jsonb_build_object(
      'available',         v_recruit_available,
      'openPositions',     CASE WHEN v_recruit_available THEN v_open_positions     ELSE NULL END,
      'activeCandidates',  CASE WHEN v_recruit_available THEN v_active_candidates  ELSE NULL END,
      'reasonUnavailable', CASE WHEN NOT v_recruit_available THEN 'unauthorized' ELSE NULL END
    ),

    'leaveRoster', v_leave_roster
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_summary(date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_summary(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. REFINED RPC 2: get_dashboard_attendance_trend
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_attendance_trend(
  p_anchor_date date DEFAULT NULL,
  p_days        integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_company_id    uuid;
  v_timezone      text;
  v_anchor_date   date;
  v_is_hr         boolean;
  v_result        jsonb := '[]'::jsonb;
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

  v_timezone    := public.get_company_timezone(v_company_id);
  v_anchor_date := COALESCE(p_anchor_date, (now() AT TIME ZONE v_timezone)::date);

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
  FROM generate_series(v_anchor_date - (p_days - 1), v_anchor_date, '1 day'::interval) AS d
  LEFT JOIN (
    SELECT
      ar.work_date,
      COUNT(DISTINCT ar.employee_id) FILTER (WHERE ar.status = 'present') AS cnt_present,
      COUNT(DISTINCT ar.employee_id) FILTER (WHERE ar.status = 'late')    AS cnt_late,
      COUNT(DISTINCT ar.employee_id) FILTER (WHERE ar.status = 'absent')  AS cnt_absent
    FROM public.attendance_records ar
    JOIN public.employees e ON e.id = ar.employee_id
    WHERE e.company_id = v_company_id
      AND ar.work_date BETWEEN (v_anchor_date - (p_days - 1)) AND v_anchor_date
    GROUP BY ar.work_date
  ) agg ON agg.work_date = d::date;

  RETURN jsonb_build_object(
    'available',   true,
    'timezone',    v_timezone,
    'anchorDate',  v_anchor_date::text,
    'days',        p_days,
    'trend',       v_result
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_attendance_trend(date, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_attendance_trend(date, integer) TO authenticated;
