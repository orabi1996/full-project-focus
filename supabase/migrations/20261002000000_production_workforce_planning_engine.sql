-- =============================================================================
-- PROMPT 19: Production Workforce Planning, Headcount & Manpower Budget Engine
-- Migration: 20261002000000_production_workforce_planning_engine.sql
-- =============================================================================
-- APPEND-ONLY. Does NOT modify any previously-committed migration.
-- Augments the baseline workforce_plans table from 20260831115000_business_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. PREREQUISITES: ensure company_id column exists on workforce_plans
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL;

ALTER TABLE public.workforce_plans
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS fiscal_year integer NOT NULL DEFAULT EXTRACT(year FROM now()),
  ADD COLUMN IF NOT EXISTS plan_code text,
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'annual'
    CHECK (plan_type IN ('annual', 'quarterly', 'project')),
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_plan_id uuid REFERENCES public.workforce_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_baseline boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scenario_label text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS workflow_request_id uuid,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  -- Headcount fields (server-authoritative actual headcount will come from RPCs)
  ADD COLUMN IF NOT EXISTS fte_budget numeric(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saudization_target_pct numeric(5,2) NOT NULL DEFAULT 0,
  -- Budget fields
  ADD COLUMN IF NOT EXISTS total_compensation_budget numeric(16,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benefits_budget numeric(16,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS training_budget numeric(16,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recruitment_budget numeric(16,2) NOT NULL DEFAULT 0;

-- Back-fill company_id from departments for existing rows
UPDATE public.workforce_plans wp
SET company_id = d.company_id
FROM public.departments d
WHERE wp.department_id = d.id AND wp.company_id IS NULL;

-- ---------------------------------------------------------------------------
-- 1. WORKFORCE PLAN LINES  (one row per position/role in the plan)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_plan_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.workforce_plans(id) ON DELETE CASCADE,
  -- Position reference (may be null for new/proposed positions)
  job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  -- Position info (denormalized for plan stability)
  position_title_ar text NOT NULL,
  position_title_en text,
  position_grade text,
  employment_type text NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
  -- Headcount targets
  planned_headcount integer NOT NULL DEFAULT 1,
  current_actual_headcount integer NOT NULL DEFAULT 0, -- snapshot at plan creation
  target_headcount integer NOT NULL DEFAULT 1,
  -- Hiring demand breakdown
  hires_planned integer NOT NULL DEFAULT 0,
  exits_planned integer NOT NULL DEFAULT 0,
  internal_transfers_in integer NOT NULL DEFAULT 0,
  internal_transfers_out integer NOT NULL DEFAULT 0,
  -- FTE
  fte_per_head numeric(5,2) NOT NULL DEFAULT 1.0,
  -- Cost per head (monthly) — sourced from payroll compensation data
  avg_monthly_compensation numeric(14,2) NOT NULL DEFAULT 0,
  -- Line status
  line_status text NOT NULL DEFAULT 'draft'
    CHECK (line_status IN ('draft', 'active', 'approved', 'cancelled')),
  line_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. WORKFORCE PLAN MONTHLY FORECASTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_plan_monthly_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.workforce_plans(id) ON DELETE CASCADE,
  plan_line_id uuid REFERENCES public.workforce_plan_lines(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  forecast_year integer NOT NULL,
  forecast_month integer NOT NULL CHECK (forecast_month BETWEEN 1 AND 12),
  -- Headcount forecast
  forecast_headcount integer NOT NULL DEFAULT 0,
  forecast_hires integer NOT NULL DEFAULT 0,
  forecast_exits integer NOT NULL DEFAULT 0,
  forecast_fte numeric(8,2) NOT NULL DEFAULT 0,
  -- Cost forecast
  forecast_total_cost numeric(16,2) NOT NULL DEFAULT 0,
  forecast_base_salary numeric(16,2) NOT NULL DEFAULT 0,
  forecast_allowances numeric(16,2) NOT NULL DEFAULT 0,
  forecast_benefits numeric(16,2) NOT NULL DEFAULT 0,
  -- Actual vs forecast (populated when payroll runs)
  actual_headcount integer,
  actual_cost numeric(16,2),
  variance_headcount integer,
  variance_cost numeric(16,2)
);

CREATE UNIQUE INDEX IF NOT EXISTS workforce_plan_monthly_forecasts_uq
  ON public.workforce_plan_monthly_forecasts(plan_id, (COALESCE(plan_line_id::text, 'dept')), (COALESCE(department_id::text, 'all')), forecast_year, forecast_month);

-- ---------------------------------------------------------------------------
-- 3. HEADCOUNT REQUESTS (approved hiring demand → feeds Recruitment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.headcount_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_no text NOT NULL,
  plan_id uuid REFERENCES public.workforce_plans(id) ON DELETE SET NULL,
  plan_line_id uuid REFERENCES public.workforce_plan_lines(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  -- Request details
  position_title_ar text NOT NULL,
  position_title_en text,
  employment_type text NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
  requested_headcount integer NOT NULL DEFAULT 1,
  approved_headcount integer,
  justification_ar text,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  target_start_date date,
  -- Compensation range
  min_monthly_salary numeric(12,2),
  max_monthly_salary numeric(12,2),
  -- Workflow
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'fulfilled', 'cancelled')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  workflow_request_id uuid,
  -- Recruitment link (set when job opening is created)
  linked_job_opening_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, request_no)
);

-- ---------------------------------------------------------------------------
-- 4. WORKFORCE PLAN ASSUMPTIONS (configurable parameters for scenarios)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_plan_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.workforce_plans(id) ON DELETE CASCADE,
  assumption_key text NOT NULL,
  assumption_label_ar text NOT NULL,
  assumption_value numeric(14,4) NOT NULL DEFAULT 0,
  assumption_unit text NOT NULL DEFAULT 'percentage'
    CHECK (assumption_unit IN ('percentage', 'number', 'currency', 'days')),
  notes text,
  UNIQUE(plan_id, assumption_key)
);

-- ---------------------------------------------------------------------------
-- 5. WORKFORCE PLAN AUDIT LOG
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_plan_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.workforce_plans(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_status text,
  new_status text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 6. INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS workforce_plan_lines_plan_id_idx ON public.workforce_plan_lines(plan_id);
CREATE INDEX IF NOT EXISTS workforce_plan_lines_company_id_idx ON public.workforce_plan_lines(company_id);
CREATE INDEX IF NOT EXISTS workforce_plan_lines_department_id_idx ON public.workforce_plan_lines(department_id);
CREATE INDEX IF NOT EXISTS workforce_plan_lines_job_position_id_idx ON public.workforce_plan_lines(job_position_id);
CREATE INDEX IF NOT EXISTS workforce_plan_monthly_forecasts_plan_id_idx ON public.workforce_plan_monthly_forecasts(plan_id);
CREATE INDEX IF NOT EXISTS workforce_plan_monthly_forecasts_company_id_idx ON public.workforce_plan_monthly_forecasts(company_id);
CREATE INDEX IF NOT EXISTS headcount_requests_company_id_idx ON public.headcount_requests(company_id);
CREATE INDEX IF NOT EXISTS headcount_requests_plan_id_idx ON public.headcount_requests(plan_id);
CREATE INDEX IF NOT EXISTS headcount_requests_status_idx ON public.headcount_requests(status);
CREATE INDEX IF NOT EXISTS workforce_plans_company_id_idx ON public.workforce_plans(company_id);
CREATE INDEX IF NOT EXISTS workforce_plans_fiscal_year_idx ON public.workforce_plans(fiscal_year);

-- ---------------------------------------------------------------------------
-- 7. UNIQUE CONSTRAINT: one plan code per company+year
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS workforce_plans_company_code_uq
  ON public.workforce_plans(company_id, plan_code)
  WHERE plan_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 8. UPDATED_AT TRIGGERS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workforce_plans_set_updated_at ON public.workforce_plans;
CREATE TRIGGER workforce_plans_set_updated_at
  BEFORE UPDATE ON public.workforce_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS workforce_plan_lines_set_updated_at ON public.workforce_plan_lines;
CREATE TRIGGER workforce_plan_lines_set_updated_at
  BEFORE UPDATE ON public.workforce_plan_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS headcount_requests_set_updated_at ON public.headcount_requests;
CREATE TRIGGER headcount_requests_set_updated_at
  BEFORE UPDATE ON public.headcount_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.workforce_plan_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_plan_monthly_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.headcount_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_plan_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_plan_audit_logs ENABLE ROW LEVEL SECURITY;

-- Workforce plan lines: staff read, HR/admin write
DROP POLICY IF EXISTS "wf_plan_lines_read" ON public.workforce_plan_lines;
CREATE POLICY "wf_plan_lines_read" ON public.workforce_plan_lines
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "wf_plan_lines_write" ON public.workforce_plan_lines;
CREATE POLICY "wf_plan_lines_write" ON public.workforce_plan_lines
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees
    WHERE user_id = auth.uid() AND role IN ('super_admin','hr_admin','hr_specialist','finance_officer')
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Monthly forecasts: staff read, HR/admin write
DROP POLICY IF EXISTS "wf_monthly_forecasts_read" ON public.workforce_plan_monthly_forecasts;
CREATE POLICY "wf_monthly_forecasts_read" ON public.workforce_plan_monthly_forecasts
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "wf_monthly_forecasts_write" ON public.workforce_plan_monthly_forecasts;
CREATE POLICY "wf_monthly_forecasts_write" ON public.workforce_plan_monthly_forecasts
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees
    WHERE user_id = auth.uid() AND role IN ('super_admin','hr_admin','hr_specialist','finance_officer')
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Headcount requests: staff read, HR/admin write
DROP POLICY IF EXISTS "hc_requests_read" ON public.headcount_requests;
CREATE POLICY "hc_requests_read" ON public.headcount_requests
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "hc_requests_write" ON public.headcount_requests;
CREATE POLICY "hc_requests_write" ON public.headcount_requests
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees
    WHERE user_id = auth.uid() AND role IN ('super_admin','hr_admin','hr_specialist','finance_officer')
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Plan assumptions
DROP POLICY IF EXISTS "wf_assumptions_read" ON public.workforce_plan_assumptions;
CREATE POLICY "wf_assumptions_read" ON public.workforce_plan_assumptions
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "wf_assumptions_write" ON public.workforce_plan_assumptions;
CREATE POLICY "wf_assumptions_write" ON public.workforce_plan_assumptions
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees
    WHERE user_id = auth.uid() AND role IN ('super_admin','hr_admin','hr_specialist','finance_officer')
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Audit logs: HR/admin read-only
DROP POLICY IF EXISTS "wf_audit_logs_read" ON public.workforce_plan_audit_logs;
CREATE POLICY "wf_audit_logs_read" ON public.workforce_plan_audit_logs
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees
    WHERE user_id = auth.uid() AND role IN ('super_admin','hr_admin','hr_specialist','finance_officer')
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 10. GRANTS
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_plan_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_plan_monthly_forecasts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.headcount_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_plan_assumptions TO authenticated;
GRANT SELECT ON public.workforce_plan_audit_logs TO authenticated;
GRANT INSERT ON public.workforce_plan_audit_logs TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. ATOMIC RPC: calculate_actual_headcount_atomic
-- Returns server-authoritative actual headcount by company, dept, location
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_actual_headcount_atomic(
  p_company_id uuid,
  p_department_id uuid DEFAULT NULL,
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_active integer := 0;
  v_total_probation integer := 0;
  v_total_on_leave integer := 0;
  v_total_employed integer := 0;
  v_saudi_count integer := 0;
  v_expat_count integer := 0;
  v_fte_total numeric := 0;
  v_dept_breakdown jsonb := '[]'::jsonb;
BEGIN
  -- Validate caller access
  IF NOT EXISTS (
    SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND company_id = p_company_id
    UNION ALL
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  -- Calculate employed workforce (server-authoritative: active + probation + on_leave)
  SELECT
    COUNT(*) FILTER (WHERE e.status = 'active') INTO v_total_active
  FROM public.employees e
  WHERE e.company_id = p_company_id
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (e.hire_date IS NULL OR e.hire_date::date <= p_as_of_date)
    AND (e.termination_date IS NULL OR e.termination_date::date > p_as_of_date);

  SELECT
    COUNT(*) FILTER (WHERE e.status = 'probation') INTO v_total_probation
  FROM public.employees e
  WHERE e.company_id = p_company_id
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (e.hire_date IS NULL OR e.hire_date::date <= p_as_of_date)
    AND (e.termination_date IS NULL OR e.termination_date::date > p_as_of_date);

  SELECT
    COUNT(*) FILTER (WHERE e.status = 'on_leave') INTO v_total_on_leave
  FROM public.employees e
  WHERE e.company_id = p_company_id
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (e.hire_date IS NULL OR e.hire_date::date <= p_as_of_date)
    AND (e.termination_date IS NULL OR e.termination_date::date > p_as_of_date);

  v_total_employed := v_total_active + v_total_probation + v_total_on_leave;

  -- Nationality breakdown (Saudi = SA, other = expat)
  SELECT
    COUNT(*) FILTER (WHERE e.nationality = 'SA' OR e.nationality ILIKE '%saudi%') INTO v_saudi_count
  FROM public.employees e
  WHERE e.company_id = p_company_id
    AND e.status IN ('active','probation','on_leave')
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (e.hire_date IS NULL OR e.hire_date::date <= p_as_of_date)
    AND (e.termination_date IS NULL OR e.termination_date::date > p_as_of_date);

  v_expat_count := v_total_employed - v_saudi_count;

  -- FTE total (full_time=1.0, part_time=0.5, contract=0.75, intern=0.25)
  SELECT COALESCE(SUM(
    CASE e.work_type
      WHEN 'full_time' THEN 1.0
      WHEN 'part_time' THEN 0.5
      ELSE 0.75
    END
  ), 0) INTO v_fte_total
  FROM public.employees e
  WHERE e.company_id = p_company_id
    AND e.status IN ('active','probation','on_leave')
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (e.hire_date IS NULL OR e.hire_date::date <= p_as_of_date)
    AND (e.termination_date IS NULL OR e.termination_date::date > p_as_of_date);

  -- Department breakdown
  SELECT jsonb_agg(jsonb_build_object(
    'department_id', d.id,
    'department_name', COALESCE(d.name_ar, d.name_en, ''),
    'active', dept_counts.active_count,
    'probation', dept_counts.probation_count,
    'on_leave', dept_counts.leave_count,
    'total_employed', dept_counts.active_count + dept_counts.probation_count + dept_counts.leave_count
  ) ORDER BY dept_counts.active_count + dept_counts.probation_count + dept_counts.leave_count DESC)
  INTO v_dept_breakdown
  FROM public.departments d
  JOIN (
    SELECT
      e.department_id,
      COUNT(*) FILTER (WHERE e.status = 'active') AS active_count,
      COUNT(*) FILTER (WHERE e.status = 'probation') AS probation_count,
      COUNT(*) FILTER (WHERE e.status = 'on_leave') AS leave_count
    FROM public.employees e
    WHERE e.company_id = p_company_id
      AND e.status IN ('active','probation','on_leave')
      AND (e.hire_date IS NULL OR e.hire_date::date <= p_as_of_date)
      AND (e.termination_date IS NULL OR e.termination_date::date > p_as_of_date)
    GROUP BY e.department_id
  ) dept_counts ON dept_counts.department_id = d.id
  WHERE d.company_id = p_company_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'as_of_date', p_as_of_date,
    'total_active', v_total_active,
    'total_probation', v_total_probation,
    'total_on_leave', v_total_on_leave,
    'total_employed', v_total_employed,
    'saudi_count', v_saudi_count,
    'expat_count', v_expat_count,
    'fte_total', v_fte_total,
    'saudization_pct', CASE WHEN v_total_employed > 0
      THEN ROUND((v_saudi_count::numeric / v_total_employed) * 100, 2)
      ELSE 0 END,
    'dept_breakdown', COALESCE(v_dept_breakdown, '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 12. ATOMIC RPC: create_workforce_plan_atomic
-- Creates a new plan or new version of an existing plan (approved plans immutable)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_workforce_plan_atomic(
  p_company_id uuid,
  p_title_ar text,
  p_title_en text DEFAULT NULL,
  p_fiscal_year integer DEFAULT NULL,
  p_plan_type text DEFAULT 'annual',
  p_department_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_parent_plan_id uuid DEFAULT NULL,
  p_scenario_label text DEFAULT NULL,
  p_fte_budget numeric DEFAULT 0,
  p_total_compensation_budget numeric DEFAULT 0,
  p_saudization_target_pct numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_year integer;
  v_plan_code text;
  v_version_number integer := 1;
  v_is_baseline boolean := true;
  v_new_plan_id uuid;
  v_caller_company_id uuid;
  v_seq integer;
BEGIN
  -- Verify access
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin','hr_admin','hr_specialist','finance_officer')
  LIMIT 1;

  IF v_caller_company_id IS NULL THEN
    SELECT id INTO v_caller_company_id FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid();
  END IF;

  IF v_caller_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  v_plan_year := COALESCE(p_fiscal_year, EXTRACT(year FROM CURRENT_DATE)::integer);

  -- If this is a new version of an approved plan, increment version number
  IF p_parent_plan_id IS NOT NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1, false
    INTO v_version_number, v_is_baseline
    FROM public.workforce_plans
    WHERE (id = p_parent_plan_id OR parent_plan_id = p_parent_plan_id)
      AND company_id = p_company_id;
    v_is_baseline := false;
  END IF;

  -- Generate plan code
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.workforce_plans
  WHERE company_id = p_company_id AND fiscal_year = v_plan_year;

  v_plan_code := 'WFP-' || v_plan_year || '-' || LPAD(v_seq::text, 4, '0');

  INSERT INTO public.workforce_plans (
    company_id, title_ar, title_en, plan_year, fiscal_year, plan_code, plan_type,
    version_number, parent_plan_id, is_baseline, scenario_label,
    department_id, notes, fte_budget, total_compensation_budget, saudization_target_pct,
    status, created_at, updated_at
  ) VALUES (
    p_company_id, p_title_ar, COALESCE(p_title_en, p_title_ar), v_plan_year, v_plan_year, v_plan_code, p_plan_type,
    v_version_number, p_parent_plan_id, v_is_baseline, p_scenario_label,
    p_department_id, p_notes, p_fte_budget, p_total_compensation_budget, p_saudization_target_pct,
    'draft', now(), now()
  )
  RETURNING id INTO v_new_plan_id;

  -- Audit log
  INSERT INTO public.workforce_plan_audit_logs (company_id, plan_id, action, actor_user_id, new_status, metadata)
  VALUES (p_company_id, v_new_plan_id, 'plan_created', auth.uid(), 'draft',
    jsonb_build_object('plan_code', v_plan_code, 'version', v_version_number, 'parent_plan_id', p_parent_plan_id));

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'plan_id', v_new_plan_id,
    'plan_code', v_plan_code,
    'version_number', v_version_number
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 13. ATOMIC RPC: submit_workforce_plan_atomic
-- Submits a draft plan for approval. Approved plans are IMMUTABLE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_workforce_plan_atomic(
  p_plan_id uuid,
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_caller_company_id uuid;
BEGIN
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin','hr_admin','hr_specialist')
  LIMIT 1;
  IF v_caller_company_id IS NULL THEN
    SELECT id INTO v_caller_company_id FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid();
  END IF;
  IF v_caller_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  SELECT status INTO v_current_status FROM public.workforce_plans
  WHERE id = p_plan_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'plan_not_found');
  END IF;

  IF v_current_status != 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'plan_not_in_draft',
      'current_status', v_current_status);
  END IF;

  UPDATE public.workforce_plans
  SET status = 'pending_approval', submitted_at = now(), updated_at = now()
  WHERE id = p_plan_id AND company_id = p_company_id;

  INSERT INTO public.workforce_plan_audit_logs (company_id, plan_id, action, actor_user_id, old_status, new_status)
  VALUES (p_company_id, p_plan_id, 'plan_submitted', auth.uid(), 'draft', 'pending_approval');

  RETURN jsonb_build_object('ok', true, 'success', true, 'status', 'pending_approval', 'new_status', 'pending_approval');
END;
$$;

-- ---------------------------------------------------------------------------
-- 14. ATOMIC RPC: approve_workforce_plan_atomic
-- Approves or rejects a pending plan. Approved plans become IMMUTABLE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_workforce_plan_atomic(
  p_plan_id uuid,
  p_company_id uuid,
  p_action text, -- 'approve' or 'reject'
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_caller_company_id uuid;
  v_new_status text;
BEGIN
  -- Only super_admin / finance_officer / hr_admin can approve
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin','hr_admin','finance_officer')
  LIMIT 1;
  IF v_caller_company_id IS NULL THEN
    SELECT id INTO v_caller_company_id FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid();
  END IF;
  IF v_caller_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'invalid_action');
  END IF;

  SELECT status INTO v_current_status FROM public.workforce_plans
  WHERE id = p_plan_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'plan_not_found');
  END IF;

  IF v_current_status != 'pending_approval' THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'plan_not_pending',
      'current_status', v_current_status);
  END IF;

  v_new_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'draft' END;

  UPDATE public.workforce_plans
  SET status = v_new_status,
      approved_by = CASE WHEN p_action = 'approve' THEN auth.uid() ELSE NULL END,
      approved_at = CASE WHEN p_action = 'approve' THEN now() ELSE NULL END,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_plan_id AND company_id = p_company_id;

  INSERT INTO public.workforce_plan_audit_logs (company_id, plan_id, action, actor_user_id, old_status, new_status, metadata)
  VALUES (p_company_id, p_plan_id, 'plan_' || p_action || 'd', auth.uid(), v_current_status, v_new_status,
    jsonb_build_object('notes', p_notes));

  RETURN jsonb_build_object('ok', true, 'success', true, 'status', v_new_status, 'new_status', v_new_status);
END;
$$;

-- ---------------------------------------------------------------------------
-- 15. ATOMIC RPC: upsert_plan_line_atomic
-- Creates or updates a workforce plan line. Plan must be in 'draft'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_plan_line_atomic(
  p_company_id uuid,
  p_plan_id uuid,
  p_position_title_ar text,
  p_planned_headcount integer DEFAULT 1,
  p_target_headcount integer DEFAULT 1,
  p_hires_planned integer DEFAULT 0,
  p_exits_planned integer DEFAULT 0,
  p_employment_type text DEFAULT 'full_time',
  p_avg_monthly_compensation numeric DEFAULT 0,
  p_fte_per_head numeric DEFAULT 1.0,
  p_department_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_job_position_id uuid DEFAULT NULL,
  p_position_title_en text DEFAULT NULL,
  p_position_grade text DEFAULT NULL,
  p_line_notes text DEFAULT NULL,
  p_line_id uuid DEFAULT NULL -- if updating existing
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_status text;
  v_line_id uuid;
  v_caller_company_id uuid;
BEGIN
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin','hr_admin','hr_specialist','finance_officer')
  LIMIT 1;
  IF v_caller_company_id IS NULL THEN
    SELECT id INTO v_caller_company_id FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid();
  END IF;
  IF v_caller_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  SELECT status INTO v_plan_status FROM public.workforce_plans
  WHERE id = p_plan_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'plan_not_found');
  END IF;

  IF v_plan_status = 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'plan_approved_immutable');
  END IF;

  IF p_line_id IS NOT NULL THEN
    -- Update
    UPDATE public.workforce_plan_lines
    SET position_title_ar = p_position_title_ar,
        position_title_en = p_position_title_en,
        position_grade = p_position_grade,
        employment_type = p_employment_type,
        planned_headcount = p_planned_headcount,
        target_headcount = p_target_headcount,
        hires_planned = p_hires_planned,
        exits_planned = p_exits_planned,
        avg_monthly_compensation = p_avg_monthly_compensation,
        fte_per_head = p_fte_per_head,
        department_id = p_department_id,
        cost_center_id = p_cost_center_id,
        job_position_id = p_job_position_id,
        line_notes = p_line_notes,
        updated_at = now()
    WHERE id = p_line_id AND plan_id = p_plan_id AND company_id = p_company_id
    RETURNING id INTO v_line_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'line_not_found');
    END IF;
  ELSE
    -- Insert
    INSERT INTO public.workforce_plan_lines (
      company_id, plan_id, job_position_id, department_id, cost_center_id,
      position_title_ar, position_title_en, position_grade, employment_type,
      planned_headcount, target_headcount, hires_planned, exits_planned,
      avg_monthly_compensation, fte_per_head, line_notes
    ) VALUES (
      p_company_id, p_plan_id, p_job_position_id, p_department_id, p_cost_center_id,
      p_position_title_ar, p_position_title_en, p_position_grade, p_employment_type,
      p_planned_headcount, p_target_headcount, p_hires_planned, p_exits_planned,
      p_avg_monthly_compensation, p_fte_per_head, p_line_notes
    ) RETURNING id INTO v_line_id;
  END IF;

  -- Recompute plan aggregates from lines
  UPDATE public.workforce_plans
  SET target_headcount = COALESCE((SELECT SUM(target_headcount) FROM public.workforce_plan_lines WHERE plan_id = p_plan_id AND line_status != 'cancelled'), 0),
      planned_hires = COALESCE((SELECT SUM(hires_planned) FROM public.workforce_plan_lines WHERE plan_id = p_plan_id AND line_status != 'cancelled'), 0),
      planned_exits = COALESCE((SELECT SUM(exits_planned) FROM public.workforce_plan_lines WHERE plan_id = p_plan_id AND line_status != 'cancelled'), 0),
      fte_budget = COALESCE((SELECT SUM(target_headcount * fte_per_head) FROM public.workforce_plan_lines WHERE plan_id = p_plan_id AND line_status != 'cancelled'), 0),
      updated_at = now()
  WHERE id = p_plan_id;

  RETURN jsonb_build_object('ok', true, 'success', true, 'line_id', v_line_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 16. ATOMIC RPC: generate_monthly_forecast_atomic
-- Generates or regenerates monthly forecast rows for a plan
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_monthly_forecast_atomic(
  p_company_id uuid,
  p_plan_id uuid,
  p_forecast_year integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan record;
  v_caller_company_id uuid;
  v_fy integer;
  v_month integer;
  v_rows_inserted integer := 0;
BEGIN
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin','hr_admin','hr_specialist','finance_officer')
  LIMIT 1;
  IF v_caller_company_id IS NULL THEN
    SELECT id INTO v_caller_company_id FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid();
  END IF;
  IF v_caller_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  SELECT * INTO v_plan FROM public.workforce_plans WHERE id = p_plan_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'plan_not_found');
  END IF;

  v_fy := COALESCE(p_forecast_year, v_plan.fiscal_year);

  -- Delete existing forecast rows for this plan+year (only for draft plans)
  IF v_plan.status != 'approved' THEN
    DELETE FROM public.workforce_plan_monthly_forecasts
    WHERE plan_id = p_plan_id AND forecast_year = v_fy;
  END IF;

  -- Generate monthly forecast rows per plan line
  FOR v_month IN 1..12 LOOP
    INSERT INTO public.workforce_plan_monthly_forecasts (
      company_id, plan_id, forecast_year, forecast_month,
      forecast_headcount, forecast_hires, forecast_exits,
      forecast_fte, forecast_total_cost, forecast_base_salary,
      forecast_allowances, forecast_benefits
    )
    SELECT
      p_company_id,
      p_plan_id,
      v_fy,
      v_month,
      SUM(l.target_headcount) AS forecast_headcount,
      CASE WHEN v_month = 1 THEN SUM(l.hires_planned) ELSE 0 END AS forecast_hires,
      CASE WHEN v_month = 12 THEN SUM(l.exits_planned) ELSE 0 END AS forecast_exits,
      SUM(l.target_headcount * l.fte_per_head) AS forecast_fte,
      SUM(l.target_headcount * l.avg_monthly_compensation) AS forecast_total_cost,
      SUM(l.target_headcount * l.avg_monthly_compensation * 0.65) AS forecast_base_salary,
      SUM(l.target_headcount * l.avg_monthly_compensation * 0.25) AS forecast_allowances,
      SUM(l.target_headcount * l.avg_monthly_compensation * 0.10) AS forecast_benefits
    FROM public.workforce_plan_lines l
    WHERE l.plan_id = p_plan_id AND l.company_id = p_company_id
      AND l.line_status != 'cancelled';

    v_rows_inserted := v_rows_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'success', true, 'rows_generated', v_rows_inserted, 'months_generated', v_rows_inserted, 'fiscal_year', v_fy);
END;
$$;

-- ---------------------------------------------------------------------------
-- 17. ATOMIC RPC: create_headcount_request_atomic
-- Creates a headcount/hiring request linked to an approved plan line
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_headcount_request_atomic(
  p_company_id uuid,
  p_position_title_ar text,
  p_requested_headcount integer DEFAULT 1,
  p_employment_type text DEFAULT 'full_time',
  p_priority text DEFAULT 'normal',
  p_plan_id uuid DEFAULT NULL,
  p_plan_line_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_job_position_id uuid DEFAULT NULL,
  p_position_title_en text DEFAULT NULL,
  p_justification_ar text DEFAULT NULL,
  p_target_start_date date DEFAULT NULL,
  p_min_monthly_salary numeric DEFAULT NULL,
  p_max_monthly_salary numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_no text;
  v_request_id uuid;
  v_seq integer;
  v_caller_company_id uuid;
BEGIN
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin','hr_admin','hr_specialist')
  LIMIT 1;
  IF v_caller_company_id IS NULL THEN
    SELECT id INTO v_caller_company_id FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid();
  END IF;
  IF v_caller_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  -- Generate request number
  SELECT COUNT(*) + 1 INTO v_seq FROM public.headcount_requests WHERE company_id = p_company_id;
  v_request_no := 'HCR-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_seq::text, 4, '0');

  INSERT INTO public.headcount_requests (
    company_id, request_no, plan_id, plan_line_id, department_id, cost_center_id, job_position_id,
    position_title_ar, position_title_en, employment_type, requested_headcount,
    priority, justification_ar, target_start_date, min_monthly_salary, max_monthly_salary,
    status, requested_by, notes
  ) VALUES (
    p_company_id, v_request_no, p_plan_id, p_plan_line_id, p_department_id, p_cost_center_id, p_job_position_id,
    p_position_title_ar, p_position_title_en, p_employment_type, p_requested_headcount,
    p_priority, p_justification_ar, p_target_start_date, p_min_monthly_salary, p_max_monthly_salary,
    'draft', auth.uid(), p_notes
  ) RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'request_id', v_request_id,
    'request_no', v_request_no
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 18. ATOMIC RPC: approve_headcount_request_atomic
-- Approves or rejects headcount requests
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_headcount_request_atomic(
  p_request_id uuid,
  p_company_id uuid,
  p_action text, -- 'approve' or 'reject'
  p_approved_headcount integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_caller_company_id uuid;
  v_requested integer;
BEGIN
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin','hr_admin','finance_officer')
  LIMIT 1;
  IF v_caller_company_id IS NULL THEN
    SELECT id INTO v_caller_company_id FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid();
  END IF;
  IF v_caller_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'invalid_action');
  END IF;

  SELECT status, requested_headcount INTO v_current_status, v_requested
  FROM public.headcount_requests
  WHERE id = p_request_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'request_not_found');
  END IF;

  IF v_current_status NOT IN ('draft', 'submitted') THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'request_already_processed',
      'current_status', v_current_status);
  END IF;

  UPDATE public.headcount_requests
  SET status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
      approved_headcount = CASE WHEN p_action = 'approve' THEN COALESCE(p_approved_headcount, v_requested) ELSE NULL END,
      approved_by = CASE WHEN p_action = 'approve' THEN auth.uid() ELSE NULL END,
      approved_at = CASE WHEN p_action = 'approve' THEN now() ELSE NULL END,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_request_id AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'status', CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    'new_status', CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    'approved_headcount', CASE WHEN p_action = 'approve' THEN COALESCE(p_approved_headcount, v_requested) ELSE NULL END
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 19. ATOMIC RPC: get_plan_vs_actual_atomic
-- Returns plan targets vs server-authoritative actual headcount
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_plan_vs_actual_atomic(
  p_plan_id uuid,
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan record;
  v_caller_company_id uuid;
  v_actual_employed integer := 0;
  v_actual_fte numeric := 0;
  v_plan_lines jsonb;
  v_dept_actuals jsonb;
BEGIN
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
  LIMIT 1;
  IF v_caller_company_id IS NULL THEN
    SELECT id INTO v_caller_company_id FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid();
  END IF;
  IF v_caller_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  SELECT * INTO v_plan FROM public.workforce_plans WHERE id = p_plan_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'plan_not_found');
  END IF;

  -- Server-authoritative actual headcount
  SELECT
    COUNT(*) FILTER (WHERE e.status IN ('active','probation','on_leave')),
    COALESCE(SUM(CASE e.work_type
      WHEN 'full_time' THEN 1.0
      WHEN 'part_time' THEN 0.5
      ELSE 0.75
    END) FILTER (WHERE e.status IN ('active','probation','on_leave')), 0)
  INTO v_actual_employed, v_actual_fte
  FROM public.employees e
  WHERE e.company_id = p_company_id
    AND (v_plan.department_id IS NULL OR e.department_id = v_plan.department_id);

  -- Plan lines with per-department actual
  SELECT jsonb_agg(jsonb_build_object(
    'line_id', l.id,
    'position_title_ar', l.position_title_ar,
    'department_id', l.department_id,
    'employment_type', l.employment_type,
    'planned_headcount', l.planned_headcount,
    'target_headcount', l.target_headcount,
    'hires_planned', l.hires_planned,
    'exits_planned', l.exits_planned,
    'avg_monthly_compensation', l.avg_monthly_compensation,
    'fte_per_head', l.fte_per_head,
    'actual_in_dept', (
      SELECT COUNT(*) FROM public.employees e2
      WHERE e2.company_id = p_company_id
        AND e2.status IN ('active','probation','on_leave')
        AND (l.department_id IS NULL OR e2.department_id = l.department_id)
        AND (l.job_position_id IS NULL OR e2.job_position_id = l.job_position_id)
    )
  )) INTO v_plan_lines
  FROM public.workforce_plan_lines l
  WHERE l.plan_id = p_plan_id AND l.company_id = p_company_id AND l.line_status != 'cancelled';

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'plan_id', v_plan.id,
    'plan_code', v_plan.plan_code,
    'plan_status', v_plan.status,
    'fiscal_year', v_plan.fiscal_year,
    'planned_target_headcount', v_plan.target_headcount,
    'planned_fte_budget', v_plan.fte_budget,
    'actual_employed', v_actual_employed,
    'actual_fte', v_actual_fte,
    'headcount_gap', (v_plan.target_headcount - v_actual_employed),
    'fte_gap', (v_plan.fte_budget - v_actual_fte),
    'planned_total_compensation_budget', v_plan.total_compensation_budget,
    'plan_lines', COALESCE(v_plan_lines, '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 20. ATOMIC RPC: get_workforce_kpis_atomic
-- Returns comprehensive workforce planning KPIs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_workforce_kpis_atomic(
  p_company_id uuid,
  p_fiscal_year integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fy integer;
  v_caller_company_id uuid;
  v_total_employed integer := 0;
  v_total_active integer := 0;
  v_saudi_count integer := 0;
  v_expat_count integer := 0;
  v_fte_total numeric := 0;
  v_saudization_pct numeric := 0;
  v_plans_count integer := 0;
  v_approved_plans integer := 0;
  v_pending_plans integer := 0;
  v_total_planned_hires integer := 0;
  v_total_headcount_requests integer := 0;
  v_approved_hc_requests integer := 0;
  v_open_vacancies integer := 0;
  v_total_compensation_budget numeric := 0;
  v_avg_monthly_payroll numeric := 0;
BEGIN
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
  LIMIT 1;
  IF v_caller_company_id IS NULL THEN
    SELECT id INTO v_caller_company_id FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid();
  END IF;
  IF v_caller_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  v_fy := COALESCE(p_fiscal_year, EXTRACT(year FROM CURRENT_DATE)::integer);

  -- Actual headcount (server-authoritative)
  SELECT
    COUNT(*) FILTER (WHERE e.status IN ('active','probation','on_leave')),
    COUNT(*) FILTER (WHERE e.status = 'active'),
    COUNT(*) FILTER (WHERE (e.nationality = 'SA' OR e.nationality ILIKE '%saudi%') AND e.status IN ('active','probation','on_leave')),
    COALESCE(SUM(CASE e.work_type WHEN 'full_time' THEN 1.0 WHEN 'part_time' THEN 0.5 ELSE 0.75 END)
      FILTER (WHERE e.status IN ('active','probation','on_leave')), 0)
  INTO v_total_employed, v_total_active, v_saudi_count, v_fte_total
  FROM public.employees e
  WHERE e.company_id = p_company_id;

  v_expat_count := v_total_employed - v_saudi_count;
  v_saudization_pct := CASE WHEN v_total_employed > 0 THEN
    ROUND((v_saudi_count::numeric / v_total_employed) * 100, 2)
  ELSE 0 END;

  -- Plan counts for fiscal year
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'pending_approval')
  INTO v_plans_count, v_approved_plans, v_pending_plans
  FROM public.workforce_plans
  WHERE company_id = p_company_id AND fiscal_year = v_fy;

  -- Total planned hires from approved plans
  SELECT COALESCE(SUM(wp.planned_hires), 0) INTO v_total_planned_hires
  FROM public.workforce_plans wp
  WHERE wp.company_id = p_company_id AND wp.fiscal_year = v_fy AND wp.status = 'approved';

  -- Headcount requests
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'approved')
  INTO v_total_headcount_requests, v_approved_hc_requests
  FROM public.headcount_requests
  WHERE company_id = p_company_id
    AND EXTRACT(year FROM created_at) = v_fy;

  -- Open vacancies (planned - actual from approved plans)
  SELECT COALESCE(SUM(target_headcount), 0) - v_total_employed INTO v_open_vacancies
  FROM public.workforce_plans
  WHERE company_id = p_company_id AND fiscal_year = v_fy AND status = 'approved';

  -- Total compensation budget from approved plans
  SELECT COALESCE(SUM(total_compensation_budget), 0) INTO v_total_compensation_budget
  FROM public.workforce_plans
  WHERE company_id = p_company_id AND fiscal_year = v_fy AND status = 'approved';

  -- Average monthly payroll from latest payroll run
  SELECT COALESCE(AVG(pr.net_salary), 0) INTO v_avg_monthly_payroll
  FROM public.payroll_run_employees pr
  JOIN public.payroll_runs r ON r.id = pr.payroll_run_id
  WHERE r.company_id = p_company_id
    AND r.status = 'finalized'
    AND r.created_at >= now() - interval '90 days';

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'fiscal_year', v_fy,
    -- Headcount
    'total_employed', v_total_employed,
    'totalEmployed', v_total_employed,
    'total_active', v_total_active,
    'saudi_count', v_saudi_count,
    'expat_count', v_expat_count,
    'fte_total', v_fte_total,
    'saudization_pct', v_saudization_pct,
    -- Plans
    'plans_count', v_plans_count,
    'approved_plans', v_approved_plans,
    'pending_plans', v_pending_plans,
    'total_planned_hires', v_total_planned_hires,
    -- Requests
    'total_headcount_requests', v_total_headcount_requests,
    'approved_hc_requests', v_approved_hc_requests,
    -- Gaps & budget
    'open_vacancies', GREATEST(0, v_open_vacancies),
    'total_compensation_budget', v_total_compensation_budget,
    'avg_monthly_payroll', v_avg_monthly_payroll
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 21. GRANTS FOR RPCS
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.calculate_actual_headcount_atomic(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workforce_plan_atomic(uuid, text, text, integer, text, uuid, text, uuid, text, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_workforce_plan_atomic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_workforce_plan_atomic(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_plan_line_atomic(uuid, uuid, text, integer, integer, integer, integer, text, numeric, numeric, uuid, uuid, uuid, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_forecast_atomic(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_headcount_request_atomic(uuid, text, integer, text, text, uuid, uuid, uuid, uuid, uuid, text, text, date, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_headcount_request_atomic(uuid, uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_vs_actual_atomic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workforce_kpis_atomic(uuid, integer) TO authenticated;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
