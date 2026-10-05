-- ============================================================================
-- PROMPT 22: ENTERPRISE REPORTING, PEOPLE ANALYTICS & GOVERNED METRICS ENGINE
-- Migration: 20261005000000_production_enterprise_reporting_analytics_engine.sql
-- ============================================================================

-- 1. CANONICAL REPORT CATALOG TABLE
CREATE TABLE IF NOT EXISTS public.report_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  module text NOT NULL, -- employees, attendance, leaves, payroll, performance, recruitment, workforce, expenses, assets, documents, workflow
  category_name_ar text NOT NULL,
  category_name_en text NOT NULL,
  description_ar text NOT NULL,
  description_en text NOT NULL,
  required_roles text[] NOT NULL DEFAULT '{super_admin,hr_manager}'::text[],
  available_filters text[] NOT NULL DEFAULT '{department,status,search}'::text[],
  available_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_columns text[] NOT NULL DEFAULT '{}'::text[],
  export_formats text[] NOT NULL DEFAULT '{csv,excel,pdf}'::text[],
  is_sensitive boolean NOT NULL DEFAULT false,
  drill_down_capability text,
  is_active boolean NOT NULL DEFAULT true,
  icon_name text NOT NULL DEFAULT 'table',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_catalog ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_catalog' AND policyname = 'report_catalog_read_authenticated'
  ) THEN
    CREATE POLICY report_catalog_read_authenticated ON public.report_catalog
      FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END $$;

-- 2. GOVERNED METRIC CATALOG TABLE
CREATE TABLE IF NOT EXISTS public.metric_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  business_definition_ar text NOT NULL,
  business_definition_en text NOT NULL,
  source_domain text NOT NULL,
  source_tables text[] NOT NULL DEFAULT '{}'::text[],
  aggregation_grain text NOT NULL,
  numerator text,
  denominator text,
  formula text NOT NULL,
  time_dimension text NOT NULL,
  applicable_filters text[] NOT NULL DEFAULT '{department,date_range}'::text[],
  owner text NOT NULL DEFAULT 'People Analytics',
  security_classification text NOT NULL DEFAULT 'Internal',
  refresh_behavior text NOT NULL DEFAULT 'realtime',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.metric_catalog ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'metric_catalog' AND policyname = 'metric_catalog_read_authenticated'
  ) THEN
    CREATE POLICY metric_catalog_read_authenticated ON public.metric_catalog
      FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END $$;

-- 3. USER REPORT FAVORITES TABLE
CREATE TABLE IF NOT EXISTS public.report_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_report_favorites_user_report UNIQUE(company_id, user_id, report_code)
);

ALTER TABLE public.report_favorites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_favorites' AND policyname = 'report_favorites_user_policy'
  ) THEN
    CREATE POLICY report_favorites_user_policy ON public.report_favorites
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 4. USER RECENT REPORT VIEWS TABLE
CREATE TABLE IF NOT EXISTS public.report_recents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_code text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_recents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_recents' AND policyname = 'report_recents_user_policy'
  ) THEN
    CREATE POLICY report_recents_user_policy ON public.report_recents
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 5. SCHEDULED REPORT DEFINITIONS TABLE (Prompt 24 Delivery Readiness)
CREATE TABLE IF NOT EXISTS public.scheduled_report_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_code text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  cron_expression text NOT NULL DEFAULT '0 8 * * 1',
  export_format text NOT NULL CHECK (export_format IN ('csv', 'excel', 'pdf')),
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_report_definitions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'scheduled_report_definitions' AND policyname = 'scheduled_report_policy'
  ) THEN
    CREATE POLICY scheduled_report_policy ON public.scheduled_report_definitions
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 6. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_report_favorites_user ON public.report_favorites(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_report_recents_user ON public.report_recents(company_id, user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_catalog_module ON public.report_catalog(module, is_active);
CREATE INDEX IF NOT EXISTS idx_metric_catalog_domain ON public.metric_catalog(source_domain, is_active);

-- 7. ATOMIC RPC: TOGGLE REPORT FAVORITE
CREATE OR REPLACE FUNCTION public.toggle_report_favorite(
  p_company_id uuid,
  p_report_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.report_favorites
    WHERE company_id = p_company_id AND user_id = v_user_id AND report_code = p_report_code
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.report_favorites
    WHERE company_id = p_company_id AND user_id = v_user_id AND report_code = p_report_code;
    RETURN jsonb_build_object('ok', true, 'is_favorite', false);
  ELSE
    INSERT INTO public.report_favorites (company_id, user_id, report_code)
    VALUES (p_company_id, v_user_id, p_report_code)
    ON CONFLICT (company_id, user_id, report_code) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'is_favorite', true);
  END IF;
END;
$$;

-- 8. ATOMIC RPC: LOG RECENT REPORT ACCESS
CREATE OR REPLACE FUNCTION public.log_recent_report_access(
  p_company_id uuid,
  p_report_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NOT NULL AND p_company_id IS NOT NULL THEN
    INSERT INTO public.report_recents (company_id, user_id, report_code, opened_at)
    VALUES (p_company_id, v_user_id, p_report_code, now());
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 9. ENHANCED EXECUTIVE KPIS RPC WITH COMPREHENSIVE GOVERNED METRICS
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
  v_turnover_rate numeric(6,2) := 0.00;
  v_attendance_rate numeric(6,2) := 100.00;
  v_absence_count integer := 0;
  v_absence_rate numeric(6,2) := 0.00;
  v_lateness_count integer := 0;
  v_overtime_hours numeric(10,2) := 0.00;
  v_leave_utilization_days integer := 0;
  v_payroll_cost numeric(14,2) := 0.00;
  v_average_employee_cost numeric(14,2) := 0.00;
  v_open_positions integer := 0;
  v_open_vacancies integer := 0;
  v_candidates_count integer := 0;
  v_offers_count integer := 0;
  v_hires_count integer := 0;
  v_time_to_fill_days numeric(6,1) := 0.0;
  v_review_completion numeric(6,2) := 0.00;
  v_average_rating numeric(3,2) := 0.00;
  v_workforce_plan_variance numeric(6,2) := 0.00;
  v_expense_cost numeric(14,2) := 0.00;
  v_outstanding_assets integer := 0;
  v_expiring_docs integer := 0;
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

  -- Governed Turnover Rate Formula: (Turnover Count / Total Headcount) * 100
  IF v_headcount > 0 THEN
    v_turnover_rate := ROUND((v_turnover_count::numeric / v_headcount::numeric) * 100, 2);
  END IF;

  -- 2. Attendance & Overtime Aggregations
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'present' OR actual_in IS NOT NULL),
    COUNT(*) FILTER (WHERE status = 'absent'),
    COUNT(*) FILTER (WHERE status = 'late' OR (actual_in IS NOT NULL AND scheduled_in IS NOT NULL AND actual_in > scheduled_in)),
    COALESCE(SUM(GREATEST(0, coalesce(worked_hours, 0) - 8)), 0)
  INTO
    v_total_att_records,
    v_present_att_records,
    v_absence_count,
    v_lateness_count,
    v_overtime_hours
  FROM public.attendance_records
  WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = p_company_id)
    AND work_date BETWEEN p_start_date AND p_end_date;

  IF v_total_att_records > 0 THEN
    v_attendance_rate := ROUND((v_present_att_records::numeric / v_total_att_records::numeric) * 100, 2);
    v_absence_rate := ROUND((v_absence_count::numeric / v_total_att_records::numeric) * 100, 2);
  ELSE
    v_attendance_rate := 100.00;
    v_absence_rate := 0.00;
  END IF;

  -- 3. Leave Utilization (Approved leave requests within window)
  SELECT COALESCE(SUM(days), 0)
  INTO v_leave_utilization_days
  FROM public.requests
  WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = p_company_id)
    AND type = 'leave'
    AND status = 'approved'
    AND start_date <= p_end_date
    AND end_date >= p_start_date;

  -- 4. Authoritative Payroll Cost (Locked, Approved, or Paid Payroll Runs)
  SELECT COALESCE(SUM(total_net_salary + total_employer_gosi), 0)
  INTO v_payroll_cost
  FROM public.payroll_runs
  WHERE company_id = p_company_id
    AND status IN ('locked', 'approved', 'paid');

  IF v_active_count > 0 AND v_payroll_cost > 0 THEN
    v_average_employee_cost := ROUND(v_payroll_cost / v_active_count, 2);
  END IF;

  -- 5. Expense Reimbursement Cost
  SELECT COALESCE(SUM(amount), 0)
  INTO v_expense_cost
  FROM public.expense_claims
  WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = p_company_id)
    AND status = 'approved'
    AND spent_at BETWEEN p_start_date AND p_end_date;

  -- 6. Recruitment & Vacancies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_openings') THEN
    SELECT
      COUNT(*),
      COALESCE(SUM(openings_count), 0)
    INTO
      v_open_positions,
      v_open_vacancies
    FROM public.job_openings
    WHERE company_id = p_company_id AND status = 'open';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidates') THEN
    SELECT
      COUNT(*) FILTER (WHERE stage NOT IN ('rejected', 'hired')),
      COUNT(*) FILTER (WHERE stage = 'offer'),
      COUNT(*) FILTER (WHERE stage = 'hired')
    INTO
      v_candidates_count,
      v_offers_count,
      v_hires_count
    FROM public.candidates
    WHERE company_id = p_company_id;
  END IF;

  -- 7. Outstanding Assets
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets') THEN
    SELECT COUNT(*)
    INTO v_outstanding_assets
    FROM public.assets
    WHERE company_id = p_company_id AND status = 'assigned';
  END IF;

  -- 8. Expiring Documents (next 60 days)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_documents') THEN
    SELECT COUNT(*)
    INTO v_expiring_docs
    FROM public.employee_documents
    WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = p_company_id)
      AND expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '60 days');
  END IF;

  -- 9. Pending Workflow Approvals
  SELECT COUNT(*)
  INTO v_pending_approvals
  FROM public.requests
  WHERE employee_id IN (SELECT id FROM public.employees WHERE company_id = p_company_id)
    AND status = 'pending';

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
    'turnover_rate', v_turnover_rate,
    'attendance_rate', v_attendance_rate,
    'absence_count', v_absence_count,
    'absence_rate', v_absence_rate,
    'lateness_count', v_lateness_count,
    'overtime_hours', v_overtime_hours,
    'leave_utilization_days', v_leave_utilization_days,
    'payroll_cost', v_payroll_cost,
    'average_employee_cost', v_average_employee_cost,
    'open_positions', v_open_positions,
    'open_vacancies', v_open_vacancies,
    'recruitment_candidates', v_candidates_count,
    'offers_count', v_offers_count,
    'hires_count', v_hires_count,
    'time_to_fill_days', v_time_to_fill_days,
    'performance_review_completion', v_review_completion,
    'average_rating', v_average_rating,
    'workforce_plan_variance', v_workforce_plan_variance,
    'expense_cost', v_expense_cost,
    'outstanding_assets', v_outstanding_assets,
    'expiring_documents', v_expiring_docs,
    'pending_approvals', v_pending_approvals,
    'generated_at', now()
  );
END;
$$;

-- 10. ENHANCED CANONICAL REPORT DATA QUERY RPC
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
  v_offset integer;
  v_total integer := 0;
  v_dept_id uuid;
  v_status text;
  v_start_date date;
  v_end_date date;
  v_search text;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  p_page := GREATEST(1, coalesce(p_page, 1));
  p_page_size := LEAST(1000, GREATEST(1, coalesce(p_page_size, 25)));
  v_offset := (p_page - 1) * p_page_size;

  -- Extract common filters
  IF p_filters ? 'departmentId' AND (p_filters->>'departmentId') NOT IN ('all', '') THEN
    v_dept_id := (p_filters->>'departmentId')::uuid;
  END IF;

  IF p_filters ? 'status' AND (p_filters->>'status') NOT IN ('all', '') THEN
    v_status := p_filters->>'status';
  END IF;

  IF p_filters ? 'startDate' AND (p_filters->>'startDate') <> '' THEN
    v_start_date := (p_filters->>'startDate')::date;
  END IF;

  IF p_filters ? 'endDate' AND (p_filters->>'endDate') <> '' THEN
    v_end_date := (p_filters->>'endDate')::date;
  END IF;

  IF p_filters ? 'search' AND trim(p_filters->>'search') <> '' THEN
    v_search := '%' || lower(trim(p_filters->>'search')) || '%';
  END IF;

  -- ========================================================================
  -- BRANCH 1: EMPLOYEE REPORTS (EMP_*)
  -- ========================================================================
  IF p_report_code LIKE 'EMP_%' THEN
    SELECT COUNT(*) INTO v_total
    FROM public.employees e
    LEFT JOIN public.departments d ON e.department_id = d.id
    WHERE e.company_id = p_company_id
      AND (v_dept_id IS NULL OR e.department_id = v_dept_id)
      AND (v_status IS NULL OR e.status = v_status)
      AND (v_search IS NULL OR (
        lower(e.employee_no) LIKE v_search
        OR lower(e.first_name_ar) LIKE v_search
        OR lower(e.last_name_ar) LIKE v_search
        OR lower(coalesce(e.email, '')) LIKE v_search
      ));

    SELECT jsonb_agg(row_data) INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'id', e.id,
        'employee_no', e.employee_no,
        'full_name_ar', e.first_name_ar || ' ' || e.last_name_ar,
        'full_name_en', trim(coalesce(e.first_name_en, '') || ' ' || coalesce(e.last_name_en, '')),
        'email', e.email,
        'job_title_ar', e.job_title_ar,
        'department_name_ar', coalesce(d.name_ar, 'عام'),
        'status', e.status,
        'hire_date', e.hire_date,
        'nationality', e.nationality,
        'contract_type', e.contract_type,
        'work_type', e.work_type,
        'national_id_or_iqama', CASE WHEN p_can_view_sensitive THEN e.national_id_or_iqama ELSE '********' END,
        'basic_salary', CASE WHEN p_can_view_sensitive THEN e.basic_salary ELSE NULL END,
        'housing_allowance', CASE WHEN p_can_view_sensitive THEN e.housing_allowance ELSE NULL END,
        'transportation_allowance', CASE WHEN p_can_view_sensitive THEN e.transportation_allowance ELSE NULL END,
        'total_salary', CASE WHEN p_can_view_sensitive THEN (coalesce(e.basic_salary, 0) + coalesce(e.housing_allowance, 0) + coalesce(e.transportation_allowance, 0)) ELSE NULL END
      ) AS row_data
      FROM public.employees e
      LEFT JOIN public.departments d ON e.department_id = d.id
      WHERE e.company_id = p_company_id
        AND (v_dept_id IS NULL OR e.department_id = v_dept_id)
        AND (v_status IS NULL OR e.status = v_status)
        AND (v_search IS NULL OR (
          lower(e.employee_no) LIKE v_search
          OR lower(e.first_name_ar) LIKE v_search
          OR lower(e.last_name_ar) LIKE v_search
          OR lower(coalesce(e.email, '')) LIKE v_search
        ))
      ORDER BY e.created_at DESC
      LIMIT p_page_size OFFSET v_offset
    ) sub;

  -- ========================================================================
  -- BRANCH 2: ATTENDANCE REPORTS (ATT_*)
  -- ========================================================================
  ELSIF p_report_code LIKE 'ATT_%' THEN
    SELECT COUNT(*) INTO v_total
    FROM public.attendance_records a
    JOIN public.employees e ON a.employee_id = e.id
    LEFT JOIN public.departments d ON e.department_id = d.id
    WHERE e.company_id = p_company_id
      AND (v_dept_id IS NULL OR e.department_id = v_dept_id)
      AND (
        (p_report_code = 'ATT_LATENESS' AND (a.status = 'late' OR (a.actual_in IS NOT NULL AND a.scheduled_in IS NOT NULL AND a.actual_in > a.scheduled_in)))
        OR (p_report_code = 'ATT_ABSENCE' AND a.status = 'absent')
        OR (p_report_code = 'ATT_OVERTIME' AND coalesce(a.worked_hours, 8.0) > 8.0)
        OR (p_report_code NOT IN ('ATT_LATENESS', 'ATT_ABSENCE', 'ATT_OVERTIME') AND (v_status IS NULL OR a.status = v_status))
      )
      AND (v_start_date IS NULL OR a.work_date >= v_start_date)
      AND (v_end_date IS NULL OR a.work_date <= v_end_date)
      AND (v_search IS NULL OR (
        lower(e.employee_no) LIKE v_search
        OR lower(e.first_name_ar) LIKE v_search
        OR lower(e.last_name_ar) LIKE v_search
      ));

    SELECT jsonb_agg(row_data) INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'id', a.id,
        'work_date', a.work_date,
        'employee_no', e.employee_no,
        'employee_name_ar', e.first_name_ar || ' ' || e.last_name_ar,
        'department_name_ar', coalesce(d.name_ar, 'العمليات'),
        'check_in', a.actual_in,
        'check_out', a.actual_out,
        'worked_hours', coalesce(a.worked_hours, 8.0),
        'status', a.status,
        'overtime_hours', GREATEST(0, coalesce(a.worked_hours, 8.0) - 8.0),
        'note', CASE
          WHEN a.status = 'late' THEN 'تأخير صباحي'
          WHEN a.status = 'absent' THEN 'غياب غير مسوغ'
          ELSE NULL END
      ) AS row_data
      FROM public.attendance_records a
      JOIN public.employees e ON a.employee_id = e.id
      LEFT JOIN public.departments d ON e.department_id = d.id
      WHERE e.company_id = p_company_id
        AND (v_dept_id IS NULL OR e.department_id = v_dept_id)
        AND (
          (p_report_code = 'ATT_LATENESS' AND (a.status = 'late' OR (a.actual_in IS NOT NULL AND a.scheduled_in IS NOT NULL AND a.actual_in > a.scheduled_in)))
          OR (p_report_code = 'ATT_ABSENCE' AND a.status = 'absent')
          OR (p_report_code = 'ATT_OVERTIME' AND coalesce(a.worked_hours, 8.0) > 8.0)
          OR (p_report_code NOT IN ('ATT_LATENESS', 'ATT_ABSENCE', 'ATT_OVERTIME') AND (v_status IS NULL OR a.status = v_status))
        )
        AND (v_start_date IS NULL OR a.work_date >= v_start_date)
        AND (v_end_date IS NULL OR a.work_date <= v_end_date)
        AND (v_search IS NULL OR (
          lower(e.employee_no) LIKE v_search
          OR lower(e.first_name_ar) LIKE v_search
          OR lower(e.last_name_ar) LIKE v_search
        ))
      ORDER BY a.work_date DESC, a.created_at DESC
      LIMIT p_page_size OFFSET v_offset
    ) sub;

  -- ========================================================================
  -- BRANCH 3: LEAVE REPORTS (LEV_*)
  -- ========================================================================
  ELSIF p_report_code LIKE 'LEV_%' THEN
    IF p_report_code = 'LEV_BALANCES' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leave_balances') THEN
      SELECT COUNT(*) INTO v_total
      FROM public.leave_balances b
      JOIN public.employees e ON b.employee_id = e.id
      LEFT JOIN public.departments d ON e.department_id = d.id
      WHERE e.company_id = p_company_id
        AND (v_dept_id IS NULL OR e.department_id = v_dept_id);

      SELECT jsonb_agg(row_data) INTO v_result
      FROM (
        SELECT jsonb_build_object(
          'id', b.id,
          'employee_no', e.employee_no,
          'employee_name_ar', e.first_name_ar || ' ' || e.last_name_ar,
          'department_name_ar', coalesce(d.name_ar, 'عام'),
          'leave_type_name_ar', 'إجازة سنوية اعتيادية',
          'year', coalesce(b.year, 2026),
          'entitlement_days', coalesce(b.entitlement_days, 30),
          'used_days', coalesce(b.used_days, 0),
          'pending_days', coalesce(b.pending_days, 0),
          'carried_over_days', coalesce(b.carried_over_days, 0),
          'remaining_days', (coalesce(b.entitlement_days, 30) + coalesce(b.carried_over_days, 0) - coalesce(b.used_days, 0))
        ) AS row_data
        FROM public.leave_balances b
        JOIN public.employees e ON b.employee_id = e.id
        LEFT JOIN public.departments d ON e.department_id = d.id
        WHERE e.company_id = p_company_id
          AND (v_dept_id IS NULL OR e.department_id = v_dept_id)
        LIMIT p_page_size OFFSET v_offset
      ) sub;
    ELSE
      SELECT COUNT(*) INTO v_total
      FROM public.requests r
      JOIN public.employees e ON r.employee_id = e.id
      LEFT JOIN public.departments d ON e.department_id = d.id
      WHERE e.company_id = p_company_id
        AND r.type = 'leave'
        AND (v_dept_id IS NULL OR e.department_id = v_dept_id)
        AND (v_status IS NULL OR r.status = v_status)
        AND (v_search IS NULL OR (
          lower(e.employee_no) LIKE v_search
          OR lower(e.first_name_ar) LIKE v_search
          OR lower(e.last_name_ar) LIKE v_search
        ));

      SELECT jsonb_agg(row_data) INTO v_result
      FROM (
        SELECT jsonb_build_object(
          'id', r.id,
          'reference', r.reference,
          'employee_no', e.employee_no,
          'employee_name_ar', e.first_name_ar || ' ' || e.last_name_ar,
          'department_name_ar', coalesce(d.name_ar, 'عام'),
          'start_date', r.start_date,
          'end_date', r.end_date,
          'days', r.days,
          'reason', r.reason,
          'status', r.status,
          'created_at', r.created_at
        ) AS row_data
        FROM public.requests r
        JOIN public.employees e ON r.employee_id = e.id
        LEFT JOIN public.departments d ON e.department_id = d.id
        WHERE e.company_id = p_company_id
          AND r.type = 'leave'
          AND (v_dept_id IS NULL OR e.department_id = v_dept_id)
          AND (v_status IS NULL OR r.status = v_status)
          AND (v_search IS NULL OR (
            lower(e.employee_no) LIKE v_search
            OR lower(e.first_name_ar) LIKE v_search
            OR lower(e.last_name_ar) LIKE v_search
          ))
        ORDER BY r.created_at DESC
        LIMIT p_page_size OFFSET v_offset
      ) sub;
    END IF;

  -- ========================================================================
  -- BRANCH 4: PAYROLL REPORTS (PAY_*)
  -- ========================================================================
  ELSIF p_report_code LIKE 'PAY_%' THEN
    SELECT COUNT(*) INTO v_total
    FROM public.payroll_details pd
    JOIN public.payroll_runs pr ON pd.payroll_run_id = pr.id
    LEFT JOIN public.employees e ON pd.employee_id = e.id
    LEFT JOIN public.departments d ON e.department_id = d.id
    WHERE pr.company_id = p_company_id
      AND (v_dept_id IS NULL OR e.department_id = v_dept_id)
      AND (v_search IS NULL OR (
        lower(pd.employee_no) LIKE v_search
        OR lower(pd.employee_name) LIKE v_search
      ));

    SELECT jsonb_agg(row_data) INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'id', pd.id,
        'period_year', pr.year,
        'period_month', pr.month,
        'employee_no', pd.employee_no,
        'employee_name_ar', pd.employee_name,
        'department_name_ar', coalesce(d.name_ar, 'عام'),
        'is_saudi', pd.is_saudi,
        'iban', CASE WHEN p_can_view_sensitive THEN pd.iban ELSE 'SA******************' END,
        'basic_salary', CASE WHEN p_can_view_sensitive THEN pd.basic_salary ELSE NULL END,
        'housing_allowance', CASE WHEN p_can_view_sensitive THEN pd.housing_allowance ELSE NULL END,
        'transport_allowance', CASE WHEN p_can_view_sensitive THEN pd.transport_allowance ELSE NULL END,
        'other_allowances', CASE WHEN p_can_view_sensitive THEN pd.other_allowances ELSE NULL END,
        'overtime_amount', CASE WHEN p_can_view_sensitive THEN pd.overtime_amount ELSE NULL END,
        'gross_salary', CASE WHEN p_can_view_sensitive THEN pd.gross_salary ELSE NULL END,
        'statutory_employee', CASE WHEN p_can_view_sensitive THEN pd.statutory_employee ELSE NULL END,
        'statutory_employer', CASE WHEN p_can_view_sensitive THEN pd.statutory_employer ELSE NULL END,
        'total_deductions', CASE WHEN p_can_view_sensitive THEN pd.total_deductions ELSE NULL END,
        'net_salary', CASE WHEN p_can_view_sensitive THEN pd.net_salary ELSE NULL END,
        'status', pr.status
      ) AS row_data
      FROM public.payroll_details pd
      JOIN public.payroll_runs pr ON pd.payroll_run_id = pr.id
      LEFT JOIN public.employees e ON pd.employee_id = e.id
      LEFT JOIN public.departments d ON e.department_id = d.id
      WHERE pr.company_id = p_company_id
        AND (v_dept_id IS NULL OR e.department_id = v_dept_id)
        AND (v_search IS NULL OR (
          lower(pd.employee_no) LIKE v_search
          OR lower(pd.employee_name) LIKE v_search
        ))
      ORDER BY pr.year DESC, pr.month DESC, pd.employee_no ASC
      LIMIT p_page_size OFFSET v_offset
    ) sub;

  -- ========================================================================
  -- BRANCH 5: EXPENSE REPORTS (EXP_*)
  -- ========================================================================
  ELSIF p_report_code LIKE 'EXP_%' THEN
    SELECT COUNT(*) INTO v_total
    FROM public.expense_claims c
    JOIN public.employees e ON c.employee_id = e.id
    WHERE e.company_id = p_company_id
      AND (v_status IS NULL OR c.status = v_status)
      AND (v_start_date IS NULL OR c.spent_at >= v_start_date)
      AND (v_end_date IS NULL OR c.spent_at <= v_end_date)
      AND (v_search IS NULL OR (
        lower(c.claim_number) LIKE v_search
        OR lower(c.merchant_name) LIKE v_search
      ));

    SELECT jsonb_agg(row_data) INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'id', c.id,
        'claim_number', c.claim_number,
        'employee_no', e.employee_no,
        'employee_name_ar', e.first_name_ar || ' ' || e.last_name_ar,
        'category_name_ar', c.category_name_ar,
        'merchant_name', c.merchant_name,
        'amount', c.amount,
        'vat_amount', coalesce(c.vat_amount, 0),
        'total_amount', (c.amount + coalesce(c.vat_amount, 0)),
        'currency', coalesce(c.currency, 'SAR'),
        'spent_at', c.spent_at,
        'status', c.status,
        'description', c.description
      ) AS row_data
      FROM public.expense_claims c
      JOIN public.employees e ON c.employee_id = e.id
      WHERE e.company_id = p_company_id
        AND (v_status IS NULL OR c.status = v_status)
        AND (v_start_date IS NULL OR c.spent_at >= v_start_date)
        AND (v_end_date IS NULL OR c.spent_at <= v_end_date)
        AND (v_search IS NULL OR (
          lower(c.claim_number) LIKE v_search
          OR lower(c.merchant_name) LIKE v_search
        ))
      ORDER BY c.spent_at DESC
      LIMIT p_page_size OFFSET v_offset
    ) sub;

  -- ========================================================================
  -- BRANCH 6: WORKFLOW REPORTS (WKF_*)
  -- ========================================================================
  ELSIF p_report_code LIKE 'WKF_%' THEN
    SELECT COUNT(*) INTO v_total
    FROM public.requests r
    JOIN public.employees e ON r.employee_id = e.id
    LEFT JOIN public.departments d ON e.department_id = d.id
    WHERE e.company_id = p_company_id
      AND (v_status IS NULL OR r.status = v_status)
      AND (v_search IS NULL OR lower(r.reference) LIKE v_search);

    SELECT jsonb_agg(row_data) INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'id', r.id,
        'reference', r.reference,
        'type', r.type,
        'status', r.status,
        'employee_no', e.employee_no,
        'employee_name_ar', e.first_name_ar || ' ' || e.last_name_ar,
        'department_name_ar', coalesce(d.name_ar, 'عام'),
        'created_at', r.created_at,
        'reason', r.reason
      ) AS row_data
      FROM public.requests r
      JOIN public.employees e ON r.employee_id = e.id
      LEFT JOIN public.departments d ON e.department_id = d.id
      WHERE e.company_id = p_company_id
        AND (v_status IS NULL OR r.status = v_status)
        AND (v_search IS NULL OR lower(r.reference) LIKE v_search)
      ORDER BY r.created_at DESC
      LIMIT p_page_size OFFSET v_offset
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'report_code', p_report_code,
    'company_id', p_company_id,
    'page', p_page,
    'page_size', p_page_size,
    'total_count', v_total,
    'total_pages', CEIL(v_total::numeric / p_page_size::numeric),
    'data', coalesce(v_result, '[]'::jsonb),
    'sensitive_data_masked', NOT p_can_view_sensitive
  );
END;
$$;
