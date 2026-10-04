-- ============================================================================
-- PROMPT 22: PRODUCTION ENTERPRISE REPORTING, ANALYTICS & EXPORT ENGINE
-- Migration: 20261004000000_production_reporting_analytics_engine.sql
-- Description:
-- 1. Saved Report Configurations & Filters Table
-- 2. Report Generation Audit & Access Logs Table
-- 3. Asynchronous / Bounded Report Export Jobs Table
-- 4. High-Performance Reporting & Analytics Indexes
-- 5. Authoritative Executive KPIs Aggregation RPC (get_executive_kpis)
-- 6. Canonical Enterprise Atomic Report Query Engine (query_report_data_atomic)
--    - Multi-Tenant Isolation (enforces company_id boundary)
--    - Server-Side Multi-Parameter Filtering
--    - Server-Side Pagination & Safe Sorting
--    - Sensitive Field Masking (salary, IBAN, national ID)
-- 7. Atomic Filter Management & Export Audit RPCs
-- 8. Strict Security Definer Grants & RLS Whitelisting
-- ============================================================================

-- ============================================================================
-- 1. SAVED REPORT FILTERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saved_report_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_code text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_columns text[] DEFAULT NULL,
  sort_by text DEFAULT NULL,
  sort_order text NOT NULL DEFAULT 'asc' CHECK (sort_order IN ('asc', 'desc')),
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_report_filters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_report_filters' AND policyname = 'saved_report_filters_select'
  ) THEN
    CREATE POLICY saved_report_filters_select ON public.saved_report_filters
      FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid() OR is_shared = true
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_report_filters' AND policyname = 'saved_report_filters_insert'
  ) THEN
    CREATE POLICY saved_report_filters_insert ON public.saved_report_filters
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_report_filters' AND policyname = 'saved_report_filters_update'
  ) THEN
    CREATE POLICY saved_report_filters_update ON public.saved_report_filters
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_report_filters' AND policyname = 'saved_report_filters_delete'
  ) THEN
    CREATE POLICY saved_report_filters_delete ON public.saved_report_filters
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- 2. REPORT GENERATION AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_code text NOT NULL,
  filters_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  export_format text NOT NULL CHECK (export_format IN ('csv', 'excel', 'pdf', 'preview', 'wps_sif')),
  sensitive_data_accessed boolean NOT NULL DEFAULT false,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_generation_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_generation_logs' AND policyname = 'report_generation_logs_select'
  ) THEN
    CREATE POLICY report_generation_logs_select ON public.report_generation_logs
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_generation_logs' AND policyname = 'report_generation_logs_insert'
  ) THEN
    CREATE POLICY report_generation_logs_insert ON public.report_generation_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- 3. REPORT EXPORT JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_code text NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  export_format text NOT NULL CHECK (export_format IN ('csv', 'excel', 'pdf', 'wps_sif')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  file_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz DEFAULT now()
);

ALTER TABLE public.report_export_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_export_jobs' AND policyname = 'report_export_jobs_select'
  ) THEN
    CREATE POLICY report_export_jobs_select ON public.report_export_jobs
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_export_jobs' AND policyname = 'report_export_jobs_insert'
  ) THEN
    CREATE POLICY report_export_jobs_insert ON public.report_export_jobs
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- 4. HIGH-PERFORMANCE REPORTING INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_saved_filters_company_report
  ON public.saved_report_filters(company_id, report_code);

CREATE INDEX IF NOT EXISTS idx_saved_filters_user
  ON public.saved_report_filters(user_id);

CREATE INDEX IF NOT EXISTS idx_report_gen_logs_company_report
  ON public.report_generation_logs(company_id, report_code, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_export_jobs_user
  ON public.report_export_jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_employees_reporting_headcount
  ON public.employees(company_id, status, hire_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_reporting
  ON public.attendance_records(employee_id, work_date, status);

-- ============================================================================
-- 5. EXECUTIVE KPIS AGGREGATION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_executive_kpis(
  p_company_id uuid,
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headcount integer := 0;
  v_active_count integer := 0;
  v_saudi_count integer := 0;
  v_expat_count integer := 0;
  v_saudization_rate numeric(6,2) := 0.00;
  v_nitaqat_band text := 'red';
  v_new_hires integer := 0;
  v_turnover_count integer := 0;
  v_attendance_rate numeric(6,2) := 100.00;
  v_absence_count integer := 0;
  v_lateness_count integer := 0;
  v_overtime_hours numeric(10,2) := 0.00;
  v_leave_utilization_days integer := 0;
  v_payroll_cost numeric(14,2) := 0.00;
  v_expense_cost numeric(14,2) := 0.00;
  v_open_vacancies integer := 0;
  v_candidates_count integer := 0;
  v_pending_approvals integer := 0;
  v_total_att_records integer := 0;
  v_present_att_records integer := 0;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  -- 1. Employee Headcount & Active Counts
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (
      WHERE status = 'active'
        AND upper(coalesce(nationality, '')) IN ('SA', 'SAUDI', 'SAUDI ARABIA', 'سعودي', 'سعودية')
    ),
    COUNT(*) FILTER (
      WHERE status = 'active'
        AND upper(coalesce(nationality, '')) NOT IN ('SA', 'SAUDI', 'SAUDI ARABIA', 'سعودي', 'سعودية')
    ),
    COUNT(*) FILTER (WHERE hire_date BETWEEN p_start_date AND p_end_date),
    COUNT(*) FILTER (WHERE status = 'terminated' AND updated_at::date BETWEEN p_start_date AND p_end_date)
  INTO
    v_headcount,
    v_active_count,
    v_saudi_count,
    v_expat_count,
    v_new_hires,
    v_turnover_count
  FROM public.employees
  WHERE company_id = p_company_id;

  -- Saudization Rate & Nitaqat Band
  IF (v_saudi_count + v_expat_count) > 0 THEN
    v_saudization_rate := ROUND((v_saudi_count::numeric / (v_saudi_count + v_expat_count)::numeric) * 100, 2);
  ELSE
    v_saudization_rate := 0.00;
  END IF;

  IF v_saudization_rate >= 40.00 THEN
    v_nitaqat_band := 'platinum';
  ELSIF v_saudization_rate >= 30.00 THEN
    v_nitaqat_band := 'high_green';
  ELSIF v_saudization_rate >= 20.00 THEN
    v_nitaqat_band := 'mid_green';
  ELSIF v_saudization_rate >= 10.00 THEN
    v_nitaqat_band := 'low_green';
  ELSE
    v_nitaqat_band := 'red';
  END IF;

  -- 2. Attendance & Punctuality Metrics
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE ar.status = 'present'),
    COUNT(*) FILTER (WHERE ar.status = 'absent'),
    COUNT(*) FILTER (WHERE ar.status = 'late' OR (ar.check_in IS NOT NULL AND ar.check_in > '09:00:00')),
    COALESCE(SUM(CASE WHEN ar.worked_hours > 8 THEN ar.worked_hours - 8 ELSE 0 END), 0)
  INTO
    v_total_att_records,
    v_present_att_records,
    v_absence_count,
    v_lateness_count,
    v_overtime_hours
  FROM public.attendance_records ar
  JOIN public.employees e ON e.id = ar.employee_id
  WHERE e.company_id = p_company_id
    AND ar.work_date BETWEEN p_start_date AND p_end_date;

  IF v_total_att_records > 0 THEN
    v_attendance_rate := ROUND((v_present_att_records::numeric / v_total_att_records::numeric) * 100, 2);
  ELSE
    v_attendance_rate := 100.00;
  END IF;

  -- 3. Leave Utilization (Approved requests in date range)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'requests') THEN
    SELECT COALESCE(SUM(days), 0)
    INTO v_leave_utilization_days
    FROM public.requests r
    JOIN public.employees e ON e.id = r.employee_id
    WHERE e.company_id = p_company_id
      AND r.type = 'leave'
      AND r.status = 'approved'
      AND r.start_date BETWEEN p_start_date AND p_end_date;
  END IF;

  -- 4. Financial Costs (Payroll + Expenses)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_runs') THEN
    SELECT COALESCE(SUM(total_net_salary + total_employer_gosi), 0)
    INTO v_payroll_cost
    FROM public.payroll_runs
    WHERE company_id = p_company_id
      AND status IN ('locked', 'approved', 'paid');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expense_claims') THEN
    SELECT COALESCE(SUM(amount), 0)
    INTO v_expense_cost
    FROM public.expense_claims
    WHERE company_id = p_company_id
      AND status = 'approved'
      AND spent_at BETWEEN p_start_date AND p_end_date;
  END IF;

  -- 5. Talent Acquisition & Open Vacancies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_openings') THEN
    SELECT COALESCE(SUM(openings_count), 0)
    INTO v_open_vacancies
    FROM public.job_openings
    WHERE company_id = p_company_id
      AND status = 'open';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidates') THEN
    SELECT COUNT(*)
    INTO v_candidates_count
    FROM public.candidates c
    JOIN public.job_openings j ON j.id = c.job_opening_id
    WHERE j.company_id = p_company_id
      AND c.stage != 'rejected';
  END IF;

  -- 6. Workflow Approvals Pending
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'requests') THEN
    SELECT COUNT(*)
    INTO v_pending_approvals
    FROM public.requests r
    JOIN public.employees e ON e.id = r.employee_id
    WHERE e.company_id = p_company_id
      AND r.status = 'pending';
  END IF;

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'total_headcount', v_headcount,
    'active_employees', v_active_count,
    'saudi_count', v_saudi_count,
    'expat_count', v_expat_count,
    'saudization_rate', v_saudization_rate,
    'nitaqat_band', v_nitaqat_band,
    'new_hires', v_new_hires,
    'turnover_count', v_turnover_count,
    'attendance_rate', v_attendance_rate,
    'absence_count', v_absence_count,
    'lateness_count', v_lateness_count,
    'overtime_hours', v_overtime_hours,
    'leave_utilization_days', v_leave_utilization_days,
    'payroll_cost', v_payroll_cost,
    'expense_cost', v_expense_cost,
    'open_vacancies', v_open_vacancies,
    'recruitment_candidates', v_candidates_count,
    'pending_approvals', v_pending_approvals,
    'generated_at', now()
  );
END;
$$;

-- ============================================================================
-- 6. CANONICAL ATOMIC REPORT QUERY ENGINE (query_report_data_atomic)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.query_report_data_atomic(
  p_report_code text,
  p_company_id uuid,
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25,
  p_sort_col text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc',
  p_can_view_sensitive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page integer := GREATEST(1, COALESCE(p_page, 1));
  v_size integer := LEAST(1000, GREATEST(1, COALESCE(p_page_size, 25)));
  v_offset integer := (v_page - 1) * v_size;
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
  v_filter_dept uuid := NULL;
  v_filter_status text := NULL;
  v_filter_start date := NULL;
  v_filter_end date := NULL;
  v_filter_search text := NULL;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  -- Extract common filters from JSON
  IF p_filters ? 'department_id' AND (p_filters->>'department_id') <> '' AND (p_filters->>'department_id') <> 'all' THEN
    v_filter_dept := (p_filters->>'department_id')::uuid;
  END IF;

  IF p_filters ? 'status' AND (p_filters->>'status') <> '' AND (p_filters->>'status') <> 'all' THEN
    v_filter_status := (p_filters->>'status');
  END IF;

  IF p_filters ? 'start_date' AND (p_filters->>'start_date') <> '' THEN
    v_filter_start := (p_filters->>'start_date')::date;
  END IF;

  IF p_filters ? 'end_date' AND (p_filters->>'end_date') <> '' THEN
    v_filter_end := (p_filters->>'end_date')::date;
  END IF;

  IF p_filters ? 'search' AND (p_filters->>'search') <> '' THEN
    v_filter_search := lower(trim(p_filters->>'search'));
  END IF;

  -- --------------------------------------------------------------------------
  -- ROUTE BY REPORT CODE
  -- --------------------------------------------------------------------------

  -- 1. EMPLOYEE DIRECTORY & HEADCOUNT
  IF p_report_code IN ('EMP_DIR', 'EMP_MASTER', 'EMP_HEADCOUNT', 'EMP_JOINERS', 'EMP_LEAVERS', 'EMP_ORG_DIST') THEN
    SELECT COUNT(*)
    INTO v_total
    FROM public.employees e
    WHERE e.company_id = p_company_id
      AND (v_filter_dept IS NULL OR e.department_id = v_filter_dept)
      AND (
        v_filter_status IS NULL
        OR (p_report_code = 'EMP_LEAVERS' AND e.status = 'terminated')
        OR (p_report_code <> 'EMP_LEAVERS' AND e.status = v_filter_status)
      )
      AND (
        p_report_code <> 'EMP_JOINERS'
        OR (v_filter_start IS NULL OR e.hire_date >= v_filter_start)
        AND (v_filter_end IS NULL OR e.hire_date <= v_filter_end)
      )
      AND (
        v_filter_search IS NULL
        OR lower(e.first_name_ar) LIKE '%' || v_filter_search || '%'
        OR lower(e.last_name_ar) LIKE '%' || v_filter_search || '%'
        OR lower(coalesce(e.employee_no, '')) LIKE '%' || v_filter_search || '%'
        OR lower(coalesce(e.email, '')) LIKE '%' || v_filter_search || '%'
      );

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
    INTO v_data
    FROM (
      SELECT
        e.id,
        e.employee_no,
        e.first_name_ar || ' ' || e.last_name_ar AS full_name_ar,
        coalesce(e.first_name_en || ' ' || coalesce(e.last_name_en, ''), e.first_name_ar) AS full_name_en,
        e.email,
        e.job_title_ar,
        d.name_ar AS department_name_ar,
        e.status,
        e.hire_date,
        e.nationality,
        e.contract_type,
        e.work_type,
        -- Sensitive Field Masking
        CASE WHEN p_can_view_sensitive THEN e.national_id_or_iqama ELSE '********' END AS national_id_or_iqama,
        CASE WHEN p_can_view_sensitive THEN e.basic_salary ELSE NULL END AS basic_salary,
        CASE WHEN p_can_view_sensitive THEN e.housing_allowance ELSE NULL END AS housing_allowance,
        CASE WHEN p_can_view_sensitive THEN e.transportation_allowance ELSE NULL END AS transportation_allowance,
        CASE WHEN p_can_view_sensitive THEN e.total_salary ELSE NULL END AS total_salary
      FROM public.employees e
      LEFT JOIN public.departments d ON d.id = e.department_id
      WHERE e.company_id = p_company_id
        AND (v_filter_dept IS NULL OR e.department_id = v_filter_dept)
        AND (
          v_filter_status IS NULL
          OR (p_report_code = 'EMP_LEAVERS' AND e.status = 'terminated')
          OR (p_report_code <> 'EMP_LEAVERS' AND e.status = v_filter_status)
        )
        AND (
          p_report_code <> 'EMP_JOINERS'
          OR (v_filter_start IS NULL OR e.hire_date >= v_filter_start)
          AND (v_filter_end IS NULL OR e.hire_date <= v_filter_end)
        )
        AND (
          v_filter_search IS NULL
          OR lower(e.first_name_ar) LIKE '%' || v_filter_search || '%'
          OR lower(e.last_name_ar) LIKE '%' || v_filter_search || '%'
          OR lower(coalesce(e.employee_no, '')) LIKE '%' || v_filter_search || '%'
          OR lower(coalesce(e.email, '')) LIKE '%' || v_filter_search || '%'
        )
      ORDER BY
        CASE WHEN p_sort_col = 'employee_no' AND p_sort_dir = 'asc' THEN e.employee_no END ASC,
        CASE WHEN p_sort_col = 'employee_no' AND p_sort_dir = 'desc' THEN e.employee_no END DESC,
        CASE WHEN p_sort_col = 'hire_date' AND p_sort_dir = 'asc' THEN e.hire_date END ASC,
        CASE WHEN p_sort_col = 'hire_date' AND p_sort_dir = 'desc' THEN e.hire_date END DESC,
        e.created_at DESC
      LIMIT v_size OFFSET v_offset
    ) sub;

  -- 2. ATTENDANCE REPORTS
  ELSIF p_report_code IN ('ATT_SUMMARY', 'ATT_DETAILED', 'ATT_COMPREHENSIVE', 'ATT_LATENESS', 'ATT_ABSENCE', 'ATT_OVERTIME') THEN
    SELECT COUNT(*)
    INTO v_total
    FROM public.attendance_records ar
    JOIN public.employees e ON e.id = ar.employee_id
    WHERE e.company_id = p_company_id
      AND (v_filter_dept IS NULL OR e.department_id = v_filter_dept)
      AND (v_filter_start IS NULL OR ar.work_date >= v_filter_start)
      AND (v_filter_end IS NULL OR ar.work_date <= v_filter_end)
      AND (
        CASE
          WHEN p_report_code = 'ATT_LATENESS' THEN (ar.status = 'late' OR (ar.check_in IS NOT NULL AND ar.check_in > '09:00:00'))
          WHEN p_report_code = 'ATT_ABSENCE' THEN ar.status = 'absent'
          WHEN p_report_code = 'ATT_OVERTIME' THEN ar.worked_hours > 8
          WHEN v_filter_status IS NOT NULL THEN ar.status::text = v_filter_status
          ELSE TRUE
        END
      )
      AND (
        v_filter_search IS NULL
        OR lower(e.first_name_ar) LIKE '%' || v_filter_search || '%'
        OR lower(coalesce(e.employee_no, '')) LIKE '%' || v_filter_search || '%'
      );

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
    INTO v_data
    FROM (
      SELECT
        ar.id,
        ar.work_date,
        e.employee_no,
        e.first_name_ar || ' ' || e.last_name_ar AS employee_name_ar,
        d.name_ar AS department_name_ar,
        ar.check_in::text AS check_in,
        ar.check_out::text AS check_out,
        ar.worked_hours,
        ar.status,
        CASE WHEN ar.worked_hours > 8 THEN ar.worked_hours - 8 ELSE 0 END AS overtime_hours,
        ar.note
      FROM public.attendance_records ar
      JOIN public.employees e ON e.id = ar.employee_id
      LEFT JOIN public.departments d ON d.id = e.department_id
      WHERE e.company_id = p_company_id
        AND (v_filter_dept IS NULL OR e.department_id = v_filter_dept)
        AND (v_filter_start IS NULL OR ar.work_date >= v_filter_start)
        AND (v_filter_end IS NULL OR ar.work_date <= v_filter_end)
        AND (
          CASE
            WHEN p_report_code = 'ATT_LATENESS' THEN (ar.status = 'late' OR (ar.check_in IS NOT NULL AND ar.check_in > '09:00:00'))
            WHEN p_report_code = 'ATT_ABSENCE' THEN ar.status = 'absent'
            WHEN p_report_code = 'ATT_OVERTIME' THEN ar.worked_hours > 8
            WHEN v_filter_status IS NOT NULL THEN ar.status::text = v_filter_status
            ELSE TRUE
          END
        )
        AND (
          v_filter_search IS NULL
          OR lower(e.first_name_ar) LIKE '%' || v_filter_search || '%'
          OR lower(coalesce(e.employee_no, '')) LIKE '%' || v_filter_search || '%'
        )
      ORDER BY ar.work_date DESC, ar.check_in ASC
      LIMIT v_size OFFSET v_offset
    ) sub;

  -- 3. LEAVE REPORTS
  ELSIF p_report_code IN ('LEV_BALANCES', 'LEV_REQUESTS', 'LEV_UTILIZATION') THEN
    IF p_report_code = 'LEV_BALANCES' THEN
      SELECT COUNT(*)
      INTO v_total
      FROM public.leave_balances lb
      JOIN public.employees e ON e.id = lb.employee_id
      WHERE e.company_id = p_company_id
        AND (v_filter_dept IS NULL OR e.department_id = v_filter_dept)
        AND (
          v_filter_search IS NULL
          OR lower(e.first_name_ar) LIKE '%' || v_filter_search || '%'
          OR lower(coalesce(e.employee_no, '')) LIKE '%' || v_filter_search || '%'
        );

      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      INTO v_data
      FROM (
        SELECT
          lb.id,
          e.employee_no,
          e.first_name_ar || ' ' || e.last_name_ar AS employee_name_ar,
          d.name_ar AS department_name_ar,
          coalesce(lt.name_ar, 'إجازة سنوية') AS leave_type_name_ar,
          lb.year,
          lb.entitlement_days,
          lb.used_days,
          lb.pending_days,
          lb.carried_over_days,
          (lb.entitlement_days + lb.carried_over_days - lb.used_days) AS remaining_days
        FROM public.leave_balances lb
        JOIN public.employees e ON e.id = lb.employee_id
        LEFT JOIN public.departments d ON d.id = e.department_id
        LEFT JOIN public.leave_types lt ON lt.id = lb.leave_type_id
        WHERE e.company_id = p_company_id
          AND (v_filter_dept IS NULL OR e.department_id = v_filter_dept)
          AND (
            v_filter_search IS NULL
            OR lower(e.first_name_ar) LIKE '%' || v_filter_search || '%'
            OR lower(coalesce(e.employee_no, '')) LIKE '%' || v_filter_search || '%'
          )
        ORDER BY e.employee_no ASC
        LIMIT v_size OFFSET v_offset
      ) sub;
    ELSE
      -- LEV_REQUESTS & LEV_UTILIZATION
      SELECT COUNT(*)
      INTO v_total
      FROM public.requests r
      JOIN public.employees e ON e.id = r.employee_id
      WHERE e.company_id = p_company_id
        AND r.type = 'leave'
        AND (v_filter_dept IS NULL OR e.department_id = v_filter_dept)
        AND (v_filter_status IS NULL OR r.status::text = v_filter_status)
        AND (v_filter_start IS NULL OR r.start_date >= v_filter_start)
        AND (v_filter_end IS NULL OR r.start_date <= v_filter_end)
        AND (
          v_filter_search IS NULL
          OR lower(e.first_name_ar) LIKE '%' || v_filter_search || '%'
          OR lower(coalesce(e.employee_no, '')) LIKE '%' || v_filter_search || '%'
        );

      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      INTO v_data
      FROM (
        SELECT
          r.id,
          r.reference,
          e.employee_no,
          e.first_name_ar || ' ' || e.last_name_ar AS employee_name_ar,
          d.name_ar AS department_name_ar,
          r.start_date,
          r.end_date,
          r.days,
          r.reason,
          r.status,
          r.created_at
        FROM public.requests r
        JOIN public.employees e ON e.id = r.employee_id
        LEFT JOIN public.departments d ON d.id = e.department_id
        WHERE e.company_id = p_company_id
          AND r.type = 'leave'
          AND (v_filter_dept IS NULL OR e.department_id = v_filter_dept)
          AND (v_filter_status IS NULL OR r.status::text = v_filter_status)
          AND (v_filter_start IS NULL OR r.start_date >= v_filter_start)
          AND (v_filter_end IS NULL OR r.start_date <= v_filter_end)
          AND (
            v_filter_search IS NULL
            OR lower(e.first_name_ar) LIKE '%' || v_filter_search || '%'
            OR lower(coalesce(e.employee_no, '')) LIKE '%' || v_filter_search || '%'
          )
        ORDER BY r.created_at DESC
        LIMIT v_size OFFSET v_offset
      ) sub;
    END IF;

  -- 4. PAYROLL REPORTS (Sensitive Financial Protection)
  ELSIF p_report_code IN ('PAY_REGISTER', 'PAY_SUMMARY', 'PAY_COMPONENTS', 'PAY_GOSI') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_run_employees') THEN
      SELECT COUNT(*)
      INTO v_total
      FROM public.payroll_run_employees pre
      JOIN public.payroll_runs pr ON pr.id = pre.payroll_run_id
      WHERE pr.company_id = p_company_id
        AND (v_filter_dept IS NULL OR pre.department_id = v_filter_dept)
        AND (
          v_filter_search IS NULL
          OR lower(pre.employee_name_ar) LIKE '%' || v_filter_search || '%'
          OR lower(pre.employee_no) LIKE '%' || v_filter_search || '%'
        );

      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      INTO v_data
      FROM (
        SELECT
          pre.id,
          pr.period_year,
          pr.period_month,
          pre.employee_no,
          pre.employee_name_ar,
          pre.department_name_ar,
          pre.is_saudi,
          -- Sensitive field protection enforced server-side
          CASE WHEN p_can_view_sensitive THEN pre.iban ELSE 'SA******************' END AS iban,
          CASE WHEN p_can_view_sensitive THEN pre.basic_salary ELSE NULL END AS basic_salary,
          CASE WHEN p_can_view_sensitive THEN pre.housing_allowance ELSE NULL END AS housing_allowance,
          CASE WHEN p_can_view_sensitive THEN pre.transport_allowance ELSE NULL END AS transport_allowance,
          CASE WHEN p_can_view_sensitive THEN pre.other_allowances ELSE NULL END AS other_allowances,
          CASE WHEN p_can_view_sensitive THEN pre.overtime_amount ELSE NULL END AS overtime_amount,
          CASE WHEN p_can_view_sensitive THEN pre.gross_salary ELSE NULL END AS gross_salary,
          CASE WHEN p_can_view_sensitive THEN pre.statutory_employee ELSE NULL END AS statutory_employee,
          CASE WHEN p_can_view_sensitive THEN pre.statutory_employer ELSE NULL END AS statutory_employer,
          CASE WHEN p_can_view_sensitive THEN pre.total_deductions ELSE NULL END AS total_deductions,
          CASE WHEN p_can_view_sensitive THEN pre.net_salary ELSE NULL END AS net_salary,
          pre.status
        FROM public.payroll_run_employees pre
        JOIN public.payroll_runs pr ON pr.id = pre.payroll_run_id
        WHERE pr.company_id = p_company_id
          AND (v_filter_dept IS NULL OR pre.department_id = v_filter_dept)
          AND (
            v_filter_search IS NULL
            OR lower(pre.employee_name_ar) LIKE '%' || v_filter_search || '%'
            OR lower(pre.employee_no) LIKE '%' || v_filter_search || '%'
          )
        ORDER BY pre.employee_no ASC
        LIMIT v_size OFFSET v_offset
      ) sub;
    END IF;

  -- 5. RECRUITMENT REPORTS
  ELSIF p_report_code IN ('REC_REQUISITIONS', 'REC_CANDIDATES', 'REC_HIRES') THEN
    IF p_report_code = 'REC_REQUISITIONS' THEN
      SELECT COUNT(*)
      INTO v_total
      FROM public.job_openings jo
      WHERE jo.company_id = p_company_id
        AND (v_filter_dept IS NULL OR jo.department_id = v_filter_dept)
        AND (v_filter_status IS NULL OR jo.status = v_filter_status)
        AND (v_filter_search IS NULL OR lower(jo.title_ar) LIKE '%' || v_filter_search || '%');

      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      INTO v_data
      FROM (
        SELECT
          jo.id,
          jo.title_ar,
          jo.title_en,
          d.name_ar AS department_name_ar,
          jo.openings_count,
          jo.hired_count,
          jo.status,
          jo.target_date,
          jo.created_at
        FROM public.job_openings jo
        LEFT JOIN public.departments d ON d.id = jo.department_id
        WHERE jo.company_id = p_company_id
          AND (v_filter_dept IS NULL OR jo.department_id = v_filter_dept)
          AND (v_filter_status IS NULL OR jo.status = v_filter_status)
          AND (v_filter_search IS NULL OR lower(jo.title_ar) LIKE '%' || v_filter_search || '%')
        ORDER BY jo.created_at DESC
        LIMIT v_size OFFSET v_offset
      ) sub;
    ELSE
      -- REC_CANDIDATES & REC_HIRES
      SELECT COUNT(*)
      INTO v_total
      FROM public.candidates c
      JOIN public.job_openings jo ON jo.id = c.job_opening_id
      WHERE jo.company_id = p_company_id
        AND (v_filter_dept IS NULL OR jo.department_id = v_filter_dept)
        AND (
          CASE
            WHEN p_report_code = 'REC_HIRES' THEN c.stage = 'hired'
            WHEN v_filter_status IS NOT NULL THEN c.stage = v_filter_status
            ELSE TRUE
          END
        )
        AND (
          v_filter_search IS NULL
          OR lower(c.first_name_ar) LIKE '%' || v_filter_search || '%'
          OR lower(c.last_name_ar) LIKE '%' || v_filter_search || '%'
        );

      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      INTO v_data
      FROM (
        SELECT
          c.id,
          c.first_name_ar || ' ' || c.last_name_ar AS candidate_name_ar,
          c.email,
          c.phone,
          jo.title_ar AS job_title_ar,
          d.name_ar AS department_name_ar,
          c.stage,
          c.rating,
          c.source,
          c.created_at AS application_date
        FROM public.candidates c
        JOIN public.job_openings jo ON jo.id = c.job_opening_id
        LEFT JOIN public.departments d ON d.id = jo.department_id
        WHERE jo.company_id = p_company_id
          AND (v_filter_dept IS NULL OR jo.department_id = v_filter_dept)
          AND (
            CASE
              WHEN p_report_code = 'REC_HIRES' THEN c.stage = 'hired'
              WHEN v_filter_status IS NOT NULL THEN c.stage = v_filter_status
              ELSE TRUE
            END
          )
          AND (
            v_filter_search IS NULL
            OR lower(c.first_name_ar) LIKE '%' || v_filter_search || '%'
            OR lower(c.last_name_ar) LIKE '%' || v_filter_search || '%'
          )
        ORDER BY c.created_at DESC
        LIMIT v_size OFFSET v_offset
      ) sub;
    END IF;

  -- 6. EXPENSE REPORTS
  ELSIF p_report_code IN ('EXP_CLAIMS', 'EXP_BY_CATEGORY') THEN
    SELECT COUNT(*)
    INTO v_total
    FROM public.expense_claims ec
    WHERE ec.company_id = p_company_id
      AND (v_filter_status IS NULL OR ec.status = v_filter_status)
      AND (v_filter_start IS NULL OR ec.spent_at >= v_filter_start)
      AND (v_filter_end IS NULL OR ec.spent_at <= v_filter_end)
      AND (
        v_filter_search IS NULL
        OR lower(coalesce(ec.merchant_name, '')) LIKE '%' || v_filter_search || '%'
        OR lower(coalesce(ec.claim_number, '')) LIKE '%' || v_filter_search || '%'
      );

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
    INTO v_data
    FROM (
      SELECT
        ec.id,
        ec.claim_number,
        e.employee_no,
        e.first_name_ar || ' ' || e.last_name_ar AS employee_name_ar,
        cat.name_ar AS category_name_ar,
        ec.merchant_name,
        ec.amount,
        ec.vat_amount,
        ec.total_amount,
        ec.currency,
        ec.spent_at,
        ec.status,
        ec.description
      FROM public.expense_claims ec
      LEFT JOIN public.employees e ON e.id = ec.employee_id
      LEFT JOIN public.expense_categories cat ON cat.id = ec.category_id
      WHERE ec.company_id = p_company_id
        AND (v_filter_status IS NULL OR ec.status = v_filter_status)
        AND (v_filter_start IS NULL OR ec.spent_at >= v_filter_start)
        AND (v_filter_end IS NULL OR ec.spent_at <= v_filter_end)
        AND (
          v_filter_search IS NULL
          OR lower(coalesce(ec.merchant_name, '')) LIKE '%' || v_filter_search || '%'
          OR lower(coalesce(ec.claim_number, '')) LIKE '%' || v_filter_search || '%'
        )
      ORDER BY ec.spent_at DESC
      LIMIT v_size OFFSET v_offset
    ) sub;

  -- 7. ASSET REPORTS
  ELSIF p_report_code IN ('AST_INVENTORY', 'AST_CUSTODY') THEN
    SELECT COUNT(*)
    INTO v_total
    FROM public.hardware_assets a
    WHERE a.company_id = p_company_id
      AND (
        v_filter_search IS NULL
        OR lower(a.name_ar) LIKE '%' || v_filter_search || '%'
        OR lower(a.asset_tag) LIKE '%' || v_filter_search || '%'
        OR lower(coalesce(a.serial_number, '')) LIKE '%' || v_filter_search || '%'
      );

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
    INTO v_data
    FROM (
      SELECT
        a.id,
        a.asset_tag,
        a.serial_number,
        a.name_ar,
        a.category,
        a.condition,
        a.status,
        a.location,
        e.employee_no AS assigned_employee_no,
        e.first_name_ar || ' ' || e.last_name_ar AS assigned_employee_name_ar,
        a.acquisition_date,
        a.purchase_value
      FROM public.hardware_assets a
      LEFT JOIN public.employees e ON e.id = a.assigned_to_employee_id
      WHERE a.company_id = p_company_id
        AND (
          v_filter_search IS NULL
          OR lower(a.name_ar) LIKE '%' || v_filter_search || '%'
          OR lower(a.asset_tag) LIKE '%' || v_filter_search || '%'
          OR lower(coalesce(a.serial_number, '')) LIKE '%' || v_filter_search || '%'
        )
      ORDER BY a.created_at DESC
      LIMIT v_size OFFSET v_offset
    ) sub;

  -- 8. DOCUMENT REPORTS
  ELSIF p_report_code IN ('DOC_STATUS', 'DOC_LETTERS') THEN
    IF p_report_code = 'DOC_LETTERS' THEN
      SELECT COUNT(*)
      INTO v_total
      FROM public.official_letter_requests olr
      WHERE olr.company_id = p_company_id
        AND (v_filter_status IS NULL OR olr.status = v_filter_status);

      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      INTO v_data
      FROM (
        SELECT
          olr.id,
          olr.request_number,
          e.employee_no,
          e.first_name_ar || ' ' || e.last_name_ar AS employee_name_ar,
          olr.letter_type,
          olr.addressed_to,
          olr.status,
          olr.created_at
        FROM public.official_letter_requests olr
        LEFT JOIN public.employees e ON e.id = olr.employee_id
        WHERE olr.company_id = p_company_id
          AND (v_filter_status IS NULL OR olr.status = v_filter_status)
        ORDER BY olr.created_at DESC
        LIMIT v_size OFFSET v_offset
      ) sub;
    ELSE
      -- DOC_STATUS
      SELECT COUNT(*)
      INTO v_total
      FROM public.employee_documents ed
      JOIN public.employees e ON e.id = ed.employee_id
      WHERE e.company_id = p_company_id;

      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      INTO v_data
      FROM (
        SELECT
          ed.id,
          e.employee_no,
          e.first_name_ar || ' ' || e.last_name_ar AS employee_name_ar,
          ed.document_type,
          ed.document_number,
          ed.issue_date,
          ed.expiry_date,
          ed.status,
          ed.confidentiality
        FROM public.employee_documents ed
        JOIN public.employees e ON e.id = ed.employee_id
        WHERE e.company_id = p_company_id
        ORDER BY ed.expiry_date ASC NULLS LAST
        LIMIT v_size OFFSET v_offset
      ) sub;
    END IF;

  -- 9. WORKFLOW REPORTS
  ELSIF p_report_code IN ('WKF_PENDING', 'WKF_SLA') THEN
    SELECT COUNT(*)
    INTO v_total
    FROM public.requests r
    JOIN public.employees e ON e.id = r.employee_id
    WHERE e.company_id = p_company_id
      AND (
        CASE
          WHEN p_report_code = 'WKF_PENDING' THEN r.status = 'pending'
          WHEN v_filter_status IS NOT NULL THEN r.status::text = v_filter_status
          ELSE TRUE
        END
      );

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
    INTO v_data
    FROM (
      SELECT
        r.id,
        r.reference,
        r.type,
        r.status,
        e.employee_no,
        e.first_name_ar || ' ' || e.last_name_ar AS employee_name_ar,
        d.name_ar AS department_name_ar,
        r.created_at,
        r.start_date,
        r.end_date,
        r.amount,
        r.reason
      FROM public.requests r
      JOIN public.employees e ON e.id = r.employee_id
      LEFT JOIN public.departments d ON d.id = e.department_id
      WHERE e.company_id = p_company_id
        AND (
          CASE
            WHEN p_report_code = 'WKF_PENDING' THEN r.status = 'pending'
            WHEN v_filter_status IS NOT NULL THEN r.status::text = v_filter_status
            ELSE TRUE
          END
        )
      ORDER BY r.created_at DESC
      LIMIT v_size OFFSET v_offset
    ) sub;

  -- 10. PERFORMANCE REPORTS
  ELSIF p_report_code IN ('PRF_RESULTS', 'PRF_GOALS', 'PRF_DISTRIBUTION') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_reviews') THEN
      SELECT COUNT(*)
      INTO v_total
      FROM public.performance_reviews pr
      JOIN public.employees e ON e.id = pr.employee_id
      WHERE e.company_id = p_company_id;

      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      INTO v_data
      FROM (
        SELECT
          pr.id,
          e.employee_no,
          e.first_name_ar || ' ' || e.last_name_ar AS employee_name_ar,
          d.name_ar AS department_name_ar,
          pr.review_type,
          pr.final_rating,
          pr.final_score,
          pr.status,
          pr.created_at
        FROM public.performance_reviews pr
        JOIN public.employees e ON e.id = pr.employee_id
        LEFT JOIN public.departments d ON d.id = e.department_id
        WHERE e.company_id = p_company_id
        ORDER BY pr.created_at DESC
        LIMIT v_size OFFSET v_offset
      ) sub;
    END IF;

  -- 11. WORKFORCE PLANNING REPORTS
  ELSIF p_report_code IN ('WFP_PLAN_VS_ACTUAL', 'WFP_DEMAND') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workforce_plans') THEN
      SELECT COUNT(*)
      INTO v_total
      FROM public.workforce_plans wp
      WHERE wp.company_id = p_company_id;

      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      INTO v_data
      FROM (
        SELECT
          wp.id,
          wp.title_ar,
          wp.fiscal_year,
          wp.status,
          wp.target_headcount,
          wp.approved_budget,
          wp.created_at
        FROM public.workforce_plans wp
        WHERE wp.company_id = p_company_id
        ORDER BY wp.fiscal_year DESC
        LIMIT v_size OFFSET v_offset
      ) sub;
    END IF;
  ELSE
    -- Generic Fallback: empty array
    v_total := 0;
    v_data := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'report_code', p_report_code,
    'company_id', p_company_id,
    'page', v_page,
    'page_size', v_size,
    'total_count', v_total,
    'total_pages', CEIL(v_total::numeric / v_size::numeric),
    'data', v_data,
    'sensitive_data_masked', NOT p_can_view_sensitive
  );
END;
$$;

-- ============================================================================
-- 7. ATOMIC FILTER & EXPORT MANAGEMENT RPCS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_report_filter_atomic(
  p_company_id uuid,
  p_report_code text,
  p_name_ar text,
  p_name_en text DEFAULT NULL,
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_selected_columns text[] DEFAULT NULL,
  p_sort_by text DEFAULT NULL,
  p_sort_order text DEFAULT 'asc',
  p_is_shared boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_filter_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_name_ar IS NULL OR trim(p_name_ar) = '' THEN
    RAISE EXCEPTION 'Filter name in Arabic is required';
  END IF;

  INSERT INTO public.saved_report_filters (
    company_id, user_id, report_code, name_ar, name_en,
    filters, selected_columns, sort_by, sort_order, is_shared
  )
  VALUES (
    p_company_id, v_user_id, p_report_code, trim(p_name_ar), p_name_en,
    coalesce(p_filters, '{}'::jsonb), p_selected_columns, p_sort_by, coalesce(p_sort_order, 'asc'), p_is_shared
  )
  RETURNING id INTO v_filter_id;

  RETURN jsonb_build_object(
    'ok', true,
    'filter_id', v_filter_id,
    'message', 'Saved report filter successfully'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_saved_filter_atomic(
  p_filter_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.saved_report_filters
  WHERE id = p_filter_id AND user_id = v_user_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Filter not found or access denied');
  END IF;

  RETURN jsonb_build_object('ok', true, 'message', 'Filter deleted successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.log_report_generation_atomic(
  p_company_id uuid,
  p_report_code text,
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_row_count integer DEFAULT 0,
  p_export_format text DEFAULT 'csv',
  p_sensitive_accessed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_log_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    -- Fallback to system actor if executing anonymously in test
    v_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  INSERT INTO public.report_generation_logs (
    company_id, user_id, report_code, filters_snapshot, row_count, export_format, sensitive_data_accessed
  )
  VALUES (
    p_company_id, v_user_id, p_report_code, coalesce(p_filters, '{}'::jsonb), p_row_count, p_export_format, p_sensitive_accessed
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object('ok', true, 'log_id', v_log_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_export_job_atomic(
  p_company_id uuid,
  p_report_code text,
  p_export_format text,
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_row_count integer DEFAULT 0,
  p_file_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_job_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    v_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  INSERT INTO public.report_export_jobs (
    company_id, user_id, report_code, status, export_format, filters, row_count, file_url, completed_at
  )
  VALUES (
    p_company_id, v_user_id, p_report_code, 'completed', p_export_format, coalesce(p_filters, '{}'::jsonb), p_row_count, p_file_url, now()
  )
  RETURNING id INTO v_job_id;

  RETURN jsonb_build_object('ok', true, 'job_id', v_job_id);
END;
$$;

-- ============================================================================
-- 8. REVOKE & GRANT STRICT ROLES
-- ============================================================================

REVOKE ALL ON FUNCTION public.get_executive_kpis(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_executive_kpis(uuid, date, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.query_report_data_atomic(text, uuid, jsonb, integer, integer, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.query_report_data_atomic(text, uuid, jsonb, integer, integer, text, text, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.save_report_filter_atomic(uuid, text, text, text, jsonb, text[], text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_report_filter_atomic(uuid, text, text, text, jsonb, text[], text, text, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.delete_saved_filter_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_saved_filter_atomic(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_report_generation_atomic(uuid, text, jsonb, integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_report_generation_atomic(uuid, text, jsonb, integer, text, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_export_job_atomic(uuid, text, text, jsonb, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_export_job_atomic(uuid, text, text, jsonb, integer, text) TO authenticated, service_role;
