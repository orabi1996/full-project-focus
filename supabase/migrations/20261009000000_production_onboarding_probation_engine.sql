-- ============================================================================
-- PROMPT 27: PRODUCTION ONBOARDING, NEW-HIRE JOURNEY & PROBATION ENGINE
-- Migration: 20261009000000_production_onboarding_probation_engine.sql
-- ============================================================================

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 1. ONBOARDING TEMPLATES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  country text NOT NULL DEFAULT 'SA',
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  employment_type text NOT NULL DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  current_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_onboarding_template_name UNIQUE (company_id, name_ar)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_templates_comp ON public.onboarding_templates(company_id, is_active);

-- ----------------------------------------------------------------------------
-- 2. ONBOARDING TEMPLATE VERSIONS TABLE (Immutable Snapshots)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_template_version_num UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_template_vers ON public.onboarding_template_versions(template_id, version_number);

-- ----------------------------------------------------------------------------
-- 3. ONBOARDING TASK DEFINITIONS (Reusable Task Library)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_task_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description_ar text,
  description_en text,
  owner_role text NOT NULL CHECK (owner_role IN (
    'employee', 'hr', 'manager', 'it', 'finance', 'payroll', 'facilities', 'admin', 'security'
  )),
  category text NOT NULL CHECK (category IN (
    'document', 'asset', 'account', 'policy', 'orientation', 'introduction', 'setup', 'general'
  )),
  relative_due_days integer NOT NULL DEFAULT 0,
  is_blocking boolean NOT NULL DEFAULT false,
  dependency_task_codes text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_task_def_company_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_task_defs_comp ON public.onboarding_task_definitions(company_id, is_active);

-- ----------------------------------------------------------------------------
-- 4. ONBOARDING CASES TABLE (Authoritative Journey Entity)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  employment_id text,
  template_id uuid REFERENCES public.onboarding_templates(id) ON DELETE SET NULL,
  template_version integer NOT NULL DEFAULT 1,
  joining_date date NOT NULL,
  status text NOT NULL DEFAULT 'pre_onboarding' CHECK (status IN (
    'draft',
    'pre_onboarding',
    'in_progress',
    'waiting_employee',
    'waiting_internal',
    'ready_to_join',
    'completed',
    'cancelled'
  )),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  buddy_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  progress_percentage numeric(5,2) NOT NULL DEFAULT 0.00,
  readiness_status text NOT NULL DEFAULT 'not_ready' CHECK (readiness_status IN (
    'not_ready', 'partially_ready', 'ready'
  )),
  blocking_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  welcome_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Duplicate prevention constraint: Exactly one active onboarding case per employee
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_onboarding_employee 
  ON public.onboarding_cases(company_id, employee_id) 
  WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_onboarding_cases_comp ON public.onboarding_cases(company_id, status);
CREATE INDEX IF NOT EXISTS idx_onboarding_cases_emp ON public.onboarding_cases(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_cases_join ON public.onboarding_cases(company_id, joining_date);

-- ----------------------------------------------------------------------------
-- 5. ONBOARDING TASKS TABLE (Individual Actionable Tasks)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.onboarding_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  task_definition_id uuid REFERENCES public.onboarding_task_definitions(id) ON DELETE SET NULL,
  code text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description_ar text,
  description_en text,
  owner_role text NOT NULL CHECK (owner_role IN (
    'employee', 'hr', 'manager', 'it', 'finance', 'payroll', 'facilities', 'admin', 'security'
  )),
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  relative_due_days integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'blocked', 'completed', 'cancelled'
  )),
  is_blocking boolean NOT NULL DEFAULT false,
  depends_on_task_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  operational_task_id uuid REFERENCES public.operational_tasks(id) ON DELETE SET NULL,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_case_task_code UNIQUE (case_id, code)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_case ON public.onboarding_tasks(case_id, status);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_owner ON public.onboarding_tasks(company_id, owner_role, status);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_due ON public.onboarding_tasks(company_id, due_date);

-- ----------------------------------------------------------------------------
-- 6. ONBOARDING DOCUMENT REQUIREMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_document_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.onboarding_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_mandatory boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'uploaded', 'verified', 'rejected'
  )),
  employee_document_id uuid REFERENCES public.employee_documents(id) ON DELETE SET NULL,
  file_id text,
  rejection_reason text,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_case_doc_type UNIQUE (case_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_docs_case ON public.onboarding_document_requirements(case_id, status);

-- ----------------------------------------------------------------------------
-- 7. ONBOARDING DIGITAL ACKNOWLEDGEMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.onboarding_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  policy_code text NOT NULL,
  policy_title_ar text NOT NULL,
  policy_title_en text NOT NULL,
  policy_version text NOT NULL DEFAULT '1.0',
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  signature_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_case_policy_ack UNIQUE (case_id, policy_code)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_ack_case ON public.onboarding_acknowledgements(case_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_ack_emp ON public.onboarding_acknowledgements(employee_id);

-- ----------------------------------------------------------------------------
-- 8. PROBATION POLICIES TABLE (Country & Company Governance)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.probation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  country text NOT NULL DEFAULT 'SA',
  default_duration_days integer NOT NULL DEFAULT 90,
  max_extension_days integer NOT NULL DEFAULT 90,
  mid_review_days integer DEFAULT 45,
  final_review_days_before_end integer NOT NULL DEFAULT 14,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_probation_policy_name UNIQUE (company_id, name_ar)
);

CREATE INDEX IF NOT EXISTS idx_probation_policies_comp ON public.probation_policies(company_id, is_active);

-- ----------------------------------------------------------------------------
-- 9. PROBATION CASES TABLE (Authoritative Probation Tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.probation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employment_id text,
  onboarding_case_id uuid REFERENCES public.onboarding_cases(id) ON DELETE SET NULL,
  policy_id uuid REFERENCES public.probation_policies(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  original_end_date date NOT NULL,
  current_end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'not_started',
    'active',
    'review_due',
    'under_review',
    'confirmed',
    'extended',
    'failed',
    'cancelled'
  )),
  reviewer_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  review_due_at date NOT NULL,
  final_decision text CHECK (final_decision IN ('confirmed', 'extended', 'failed')),
  decision_date date,
  decision_notes text,
  extension_count integer NOT NULL DEFAULT 0,
  extension_days integer NOT NULL DEFAULT 0,
  extension_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_active_probation_employee UNIQUE (company_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_probation_cases_comp ON public.probation_cases(company_id, status);
CREATE INDEX IF NOT EXISTS idx_probation_cases_end ON public.probation_cases(company_id, current_end_date);
CREATE INDEX IF NOT EXISTS idx_probation_cases_due ON public.probation_cases(company_id, review_due_at);

-- ----------------------------------------------------------------------------
-- 10. PROBATION REVIEWS TABLE (Mid-term and Final Reviews)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.probation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  probation_case_id uuid NOT NULL REFERENCES public.probation_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  review_type text NOT NULL CHECK (review_type IN ('mid_term', 'final')),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  rating numeric(3,2) CHECK (rating >= 1.00 AND rating <= 5.00),
  goals_achievement_score numeric(5,2),
  competency_score numeric(5,2),
  manager_recommendation text CHECK (manager_recommendation IN ('confirm', 'extend', 'terminate')),
  hr_recommendation text CHECK (hr_recommendation IN ('confirm', 'extend', 'terminate')),
  comments text,
  strengths text,
  improvements text,
  decision text CHECK (decision IN ('confirmed', 'extended', 'failed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_probation_review_type UNIQUE (probation_case_id, review_type)
);

CREATE INDEX IF NOT EXISTS idx_probation_reviews_case ON public.probation_reviews(probation_case_id);

-- ----------------------------------------------------------------------------
-- 11. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_task_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.probation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.probation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.probation_reviews ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 12. RLS POLICIES (Tenant Isolation & Field/Role Security)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  -- Drop existing policies if any
  DROP POLICY IF EXISTS "templates_tenant_policy" ON public.onboarding_templates;
  DROP POLICY IF EXISTS "template_versions_tenant_policy" ON public.onboarding_template_versions;
  DROP POLICY IF EXISTS "task_definitions_tenant_policy" ON public.onboarding_task_definitions;
  DROP POLICY IF EXISTS "onboarding_cases_select_policy" ON public.onboarding_cases;
  DROP POLICY IF EXISTS "onboarding_cases_write_policy" ON public.onboarding_cases;
  DROP POLICY IF EXISTS "onboarding_tasks_select_policy" ON public.onboarding_tasks;
  DROP POLICY IF EXISTS "onboarding_tasks_write_policy" ON public.onboarding_tasks;
  DROP POLICY IF EXISTS "onboarding_docs_select_policy" ON public.onboarding_document_requirements;
  DROP POLICY IF EXISTS "onboarding_docs_write_policy" ON public.onboarding_document_requirements;
  DROP POLICY IF EXISTS "onboarding_ack_policy" ON public.onboarding_acknowledgements;
  DROP POLICY IF EXISTS "probation_policies_tenant_policy" ON public.probation_policies;
  DROP POLICY IF EXISTS "probation_cases_select_policy" ON public.probation_cases;
  DROP POLICY IF EXISTS "probation_cases_write_policy" ON public.probation_cases;
  DROP POLICY IF EXISTS "probation_reviews_select_policy" ON public.probation_reviews;
  DROP POLICY IF EXISTS "probation_reviews_write_policy" ON public.probation_reviews;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Templates: Company isolation
CREATE POLICY "templates_tenant_policy" ON public.onboarding_templates
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE id = public.resolve_my_employee_id()
    ) OR public.current_user_can_manage_company(company_id)
  )
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "template_versions_tenant_policy" ON public.onboarding_template_versions
  FOR ALL TO authenticated
  USING (
    template_id IN (
      SELECT id FROM public.onboarding_templates 
      WHERE company_id IN (
        SELECT company_id FROM public.employees WHERE id = public.resolve_my_employee_id()
      ) OR public.current_user_can_manage_company(company_id)
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM public.onboarding_templates 
      WHERE public.current_user_can_manage_company(company_id)
    )
  );

-- Task definitions: Company isolation
CREATE POLICY "task_definitions_tenant_policy" ON public.onboarding_task_definitions
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE id = public.resolve_my_employee_id()
    ) OR public.current_user_can_manage_company(company_id)
  )
  WITH CHECK (public.current_user_can_manage_company(company_id));

-- Onboarding cases: Employee sees own case, Manager sees team, HR/Admin sees company
CREATE POLICY "onboarding_cases_select_policy" ON public.onboarding_cases
  FOR SELECT TO authenticated
  USING (
    -- Pre-joiner / Employee self
    employee_id = public.resolve_my_employee_id()
    -- Manager of employee
    OR manager_id = public.resolve_my_employee_id()
    OR employee_id IN (
      SELECT id FROM public.employees WHERE manager_id = public.resolve_my_employee_id()
    )
    -- Assigned buddy
    OR buddy_id = public.resolve_my_employee_id()
    -- HR / SuperAdmin with company scope
    OR public.current_user_can_manage_company(company_id)
  );

CREATE POLICY "onboarding_cases_write_policy" ON public.onboarding_cases
  FOR ALL TO authenticated
  USING (public.current_user_can_manage_company(company_id))
  WITH CHECK (public.current_user_can_manage_company(company_id));

-- Onboarding tasks:
CREATE POLICY "onboarding_tasks_select_policy" ON public.onboarding_tasks
  FOR SELECT TO authenticated
  USING (
    -- Employee tasks for self
    (case_id IN (SELECT id FROM public.onboarding_cases WHERE employee_id = public.resolve_my_employee_id())
     AND owner_role = 'employee')
    -- Assigned user or manager
    OR assigned_to_user_id = auth.uid()
    OR assigned_to_employee_id = public.resolve_my_employee_id()
    OR (case_id IN (SELECT id FROM public.onboarding_cases WHERE manager_id = public.resolve_my_employee_id())
        AND owner_role = 'manager')
    -- HR / Admin
    OR public.current_user_can_manage_company(company_id)
  );

CREATE POLICY "onboarding_tasks_write_policy" ON public.onboarding_tasks
  FOR ALL TO authenticated
  USING (
    assigned_to_user_id = auth.uid()
    OR (case_id IN (SELECT id FROM public.onboarding_cases WHERE employee_id = public.resolve_my_employee_id())
        AND owner_role = 'employee')
    OR (case_id IN (SELECT id FROM public.onboarding_cases WHERE manager_id = public.resolve_my_employee_id())
        AND owner_role = 'manager')
    OR public.current_user_can_manage_company(company_id)
  )
  WITH CHECK (
    assigned_to_user_id = auth.uid()
    OR (case_id IN (SELECT id FROM public.onboarding_cases WHERE employee_id = public.resolve_my_employee_id())
        AND owner_role = 'employee')
    OR (case_id IN (SELECT id FROM public.onboarding_cases WHERE manager_id = public.resolve_my_employee_id())
        AND owner_role = 'manager')
    OR public.current_user_can_manage_company(company_id)
  );

-- Onboarding documents:
CREATE POLICY "onboarding_docs_select_policy" ON public.onboarding_document_requirements
  FOR SELECT TO authenticated
  USING (
    -- Employee can view own requirements
    case_id IN (SELECT id FROM public.onboarding_cases WHERE employee_id = public.resolve_my_employee_id())
    -- HR / Admin
    OR public.current_user_can_manage_company(company_id)
  );

CREATE POLICY "onboarding_docs_write_policy" ON public.onboarding_document_requirements
  FOR ALL TO authenticated
  USING (
    case_id IN (SELECT id FROM public.onboarding_cases WHERE employee_id = public.resolve_my_employee_id())
    OR public.current_user_can_manage_company(company_id)
  )
  WITH CHECK (
    case_id IN (SELECT id FROM public.onboarding_cases WHERE employee_id = public.resolve_my_employee_id())
    OR public.current_user_can_manage_company(company_id)
  );

-- Acknowledgements:
CREATE POLICY "onboarding_ack_policy" ON public.onboarding_acknowledgements
  FOR ALL TO authenticated
  USING (
    employee_id = public.resolve_my_employee_id()
    OR public.current_user_can_manage_company(company_id)
  )
  WITH CHECK (
    employee_id = public.resolve_my_employee_id()
    OR public.current_user_can_manage_company(company_id)
  );

-- Probation policies:
CREATE POLICY "probation_policies_tenant_policy" ON public.probation_policies
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE id = public.resolve_my_employee_id()
    ) OR public.current_user_can_manage_company(company_id)
  )
  WITH CHECK (public.current_user_can_manage_company(company_id));

-- Probation cases:
CREATE POLICY "probation_cases_select_policy" ON public.probation_cases
  FOR SELECT TO authenticated
  USING (
    employee_id = public.resolve_my_employee_id()
    OR reviewer_employee_id = public.resolve_my_employee_id()
    OR employee_id IN (
      SELECT id FROM public.employees WHERE manager_id = public.resolve_my_employee_id()
    )
    OR public.current_user_can_manage_company(company_id)
  );

CREATE POLICY "probation_cases_write_policy" ON public.probation_cases
  FOR ALL TO authenticated
  USING (
    reviewer_employee_id = public.resolve_my_employee_id()
    OR public.current_user_can_manage_company(company_id)
  )
  WITH CHECK (
    reviewer_employee_id = public.resolve_my_employee_id()
    OR public.current_user_can_manage_company(company_id)
  );

-- Probation reviews:
CREATE POLICY "probation_reviews_select_policy" ON public.probation_reviews
  FOR SELECT TO authenticated
  USING (
    reviewer_employee_id = public.resolve_my_employee_id()
    OR probation_case_id IN (
      SELECT id FROM public.probation_cases 
      WHERE reviewer_employee_id = public.resolve_my_employee_id()
         OR employee_id IN (SELECT id FROM public.employees WHERE manager_id = public.resolve_my_employee_id())
    )
    OR public.current_user_can_manage_company(company_id)
  );

CREATE POLICY "probation_reviews_write_policy" ON public.probation_reviews
  FOR ALL TO authenticated
  USING (
    reviewer_employee_id = public.resolve_my_employee_id()
    OR public.current_user_can_manage_company(company_id)
  )
  WITH CHECK (
    reviewer_employee_id = public.resolve_my_employee_id()
    OR public.current_user_can_manage_company(company_id)
  );

-- ----------------------------------------------------------------------------
-- 13. ATOMIC RPC: calculate_onboarding_readiness_atomic
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_onboarding_readiness_atomic(
  p_case_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.onboarding_cases%ROWTYPE;
  v_total_tasks integer := 0;
  v_completed_tasks integer := 0;
  v_blocking_incomplete integer := 0;
  v_mandatory_docs_total integer := 0;
  v_mandatory_docs_verified integer := 0;
  v_mandatory_docs_uploaded integer := 0;
  v_blockers text[] := '{}'::text[];
  v_progress numeric(5,2) := 0.00;
  v_readiness text := 'not_ready';
BEGIN
  SELECT * INTO v_case FROM public.onboarding_cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'case_not_found');
  END IF;

  -- 1. Tasks count & completion
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE is_blocking = true AND status != 'completed')
  INTO v_total_tasks, v_completed_tasks, v_blocking_incomplete
  FROM public.onboarding_tasks
  WHERE case_id = p_case_id AND status != 'cancelled';

  IF v_total_tasks > 0 THEN
    v_progress := ROUND((v_completed_tasks::numeric / v_total_tasks::numeric) * 100.0, 2);
  ELSE
    v_progress := 0.00;
  END IF;

  -- 2. Mandatory Documents
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'verified'),
    COUNT(*) FILTER (WHERE status = 'uploaded')
  INTO v_mandatory_docs_total, v_mandatory_docs_verified, v_mandatory_docs_uploaded
  FROM public.onboarding_document_requirements
  WHERE case_id = p_case_id AND is_mandatory = true;

  -- 3. Determine Blockers
  IF v_blocking_incomplete > 0 THEN
    v_blockers := array_append(v_blockers, 'يوجد ' || v_blocking_incomplete || ' مهام أساسية معلقة تمنع المباشرة');
  END IF;

  IF v_mandatory_docs_total > v_mandatory_docs_verified THEN
    v_blockers := array_append(v_blockers, 'يوجد ' || (v_mandatory_docs_total - v_mandatory_docs_verified) || ' مستندات إلزامية بانتظار الاعتماد أو الرفع');
  END IF;

  -- 4. Calculate Readiness
  IF v_blocking_incomplete = 0 AND (v_mandatory_docs_total = 0 OR v_mandatory_docs_verified = v_mandatory_docs_total) THEN
    v_readiness := 'ready';
  ELSIF (v_mandatory_docs_uploaded + v_mandatory_docs_verified) > 0 OR v_progress >= 50.00 THEN
    v_readiness := 'partially_ready';
  ELSE
    v_readiness := 'not_ready';
  END IF;

  -- 5. Update Case State
  UPDATE public.onboarding_cases
  SET progress_percentage = v_progress,
      readiness_status = v_readiness,
      blocking_reasons = to_jsonb(v_blockers),
      status = CASE 
        WHEN status IN ('draft', 'pre_onboarding') AND v_readiness = 'ready' THEN 'ready_to_join'
        WHEN status = 'ready_to_join' AND v_readiness != 'ready' THEN 'in_progress'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_case_id;

  RETURN jsonb_build_object(
    'ok', true,
    'case_id', p_case_id,
    'readiness', v_readiness,
    'progress_percentage', v_progress,
    'total_tasks', v_total_tasks,
    'completed_tasks', v_completed_tasks,
    'blocking_incomplete', v_blocking_incomplete,
    'mandatory_docs_total', v_mandatory_docs_total,
    'mandatory_docs_verified', v_mandatory_docs_verified,
    'blockers', v_blockers
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_onboarding_readiness_atomic(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 14. ATOMIC RPC: create_onboarding_case_atomic
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_onboarding_case_atomic(
  p_company_id uuid,
  p_employee_id uuid,
  p_joining_date date,
  p_candidate_id uuid DEFAULT NULL,
  p_template_id uuid DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL,
  p_buddy_id uuid DEFAULT NULL,
  p_welcome_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_case_id uuid;
  v_emp public.employees%ROWTYPE;
  v_tmpl public.onboarding_templates%ROWTYPE;
  v_case_id uuid;
  v_version integer := 1;
  v_policy public.probation_policies%ROWTYPE;
  v_prob_case_id uuid;
  v_prob_end date;
  v_review_due date;
  v_calc_due date;
  v_task_count integer := 0;
BEGIN
  -- 1. Check Caller Permission
  IF NOT public.current_user_can_manage_company(p_company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied', 'message', 'غير مصرح بإنشاء حالة تهيئة');
  END IF;

  -- 2. Verify Employee Exists and belongs to company
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'employee_not_found', 'message', 'سجل الموظف غير موجود');
  END IF;

  -- 3. Duplicate Prevention (Must not have an active non-cancelled onboarding case)
  SELECT id INTO v_existing_case_id
  FROM public.onboarding_cases
  WHERE company_id = p_company_id AND employee_id = p_employee_id AND status != 'cancelled'
  LIMIT 1;

  IF v_existing_case_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'duplicate_onboarding_case',
      'message', 'يوجد بالفعل ملف تهيئة نشط لهذا الموظف',
      'existing_case_id', v_existing_case_id
    );
  END IF;

  -- 4. Resolve Template or Default
  IF p_template_id IS NOT NULL THEN
    SELECT * INTO v_tmpl FROM public.onboarding_templates WHERE id = p_template_id AND company_id = p_company_id;
  ELSE
    SELECT * INTO v_tmpl FROM public.onboarding_templates WHERE company_id = p_company_id AND is_active = true ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_tmpl.id IS NOT NULL THEN
    v_version := v_tmpl.current_version;
  END IF;

  -- 5. Insert Onboarding Case Record
  INSERT INTO public.onboarding_cases (
    company_id,
    employee_id,
    candidate_id,
    template_id,
    template_version,
    joining_date,
    status,
    owner_user_id,
    manager_id,
    buddy_id,
    welcome_notes,
    started_at
  ) VALUES (
    p_company_id,
    p_employee_id,
    p_candidate_id,
    v_tmpl.id,
    v_version,
    p_joining_date,
    'pre_onboarding',
    auth.uid(),
    COALESCE(p_manager_id, v_emp.manager_id),
    p_buddy_id,
    p_welcome_notes,
    now()
  ) RETURNING id INTO v_case_id;

  -- 6. Seed Tasks from Task Definitions or Defaults
  IF EXISTS (SELECT 1 FROM public.onboarding_task_definitions WHERE company_id = p_company_id AND is_active = true) THEN
    INSERT INTO public.onboarding_tasks (
      case_id, company_id, task_definition_id, code, title_ar, title_en,
      description_ar, description_en, owner_role, due_date, relative_due_days, is_blocking
    )
    SELECT
      v_case_id,
      p_company_id,
      td.id,
      td.code,
      td.title_ar,
      td.title_en,
      td.description_ar,
      td.description_en,
      td.owner_role,
      (p_joining_date + (td.relative_due_days * interval '1 day'))::date,
      td.relative_due_days,
      td.is_blocking
    FROM public.onboarding_task_definitions td
    WHERE td.company_id = p_company_id AND td.is_active = true;
  ELSE
    -- Standard Default Task Seed
    INSERT INTO public.onboarding_tasks (
      case_id, company_id, code, title_ar, title_en, owner_role, due_date, relative_due_days, is_blocking
    ) VALUES
      (v_case_id, p_company_id, 'DOC_ID', 'رفع الهوية الوطنية / الإقامة', 'Upload National ID / Iqama', 'employee', (p_joining_date - interval '7 days')::date, -7, true),
      (v_case_id, p_company_id, 'DOC_IBAN', 'تقديم الآيبان البنكي المعتمد', 'Submit Certified Bank IBAN', 'employee', (p_joining_date - interval '3 days')::date, -3, true),
      (v_case_id, p_company_id, 'DOC_CONTRACT', 'مراجعة وتوقيع عقد العمل', 'Review & Sign Employment Contract', 'employee', (p_joining_date - interval '2 days')::date, -2, true),
      (v_case_id, p_company_id, 'IT_EMAIL', 'إنشاء البريد الإلكتروني الرسمي', 'Provision Corporate Email', 'it', (p_joining_date - interval '2 days')::date, -2, true),
      (v_case_id, p_company_id, 'IT_LAPTOP', 'تجهيز وتسليم الحاسب المحمول', 'Prepare and Handover Laptop', 'it', (p_joining_date - interval '1 day')::date, -1, false),
      (v_case_id, p_company_id, 'FAC_BADGE', 'إصدار بطاقة الدخول الذكية', 'Issue Access Smart Card', 'facilities', p_joining_date, 0, false),
      (v_case_id, p_company_id, 'HR_WELCOME', 'جلسة الترحيب والتعريف بالمنشأة', 'HR Induction & Welcome Session', 'hr', (p_joining_date + interval '1 day')::date, 1, false),
      (v_case_id, p_company_id, 'MGR_MEET', 'جلسة التعارف وخطة عمل المدير المباشر', 'Manager 1-on-1 & Alignment', 'manager', (p_joining_date + interval '1 day')::date, 1, false),
      (v_case_id, p_company_id, 'PROB_GOALS', 'تحديد أهداف فترة التجربة 90 يوماً', 'Set 90-Day Probation Objectives', 'manager', (p_joining_date + interval '7 days')::date, 7, false),
      (v_case_id, p_company_id, 'POL_ACK', 'الإقرار الرقمي على لوائح وسياسات العمل', 'Acknowledge Corporate Policies', 'employee', (p_joining_date + interval '3 days')::date, 3, true);
  END IF;

  -- 7. Seed Mandatory Document Requirements
  INSERT INTO public.onboarding_document_requirements (
    case_id, company_id, doc_type, name_ar, name_en, is_mandatory
  ) VALUES
    (v_case_id, p_company_id, 'national_id', 'الهوية الوطنية / الإقامة', 'National ID / Iqama', true),
    (v_case_id, p_company_id, 'bank_certificate', 'شهادة الآيبان البنكي', 'Bank IBAN Certificate', true),
    (v_case_id, p_company_id, 'education_degree', 'المؤهل العلمي / الشهادة الدراسية', 'Educational Degree', false),
    (v_case_id, p_company_id, 'medical_report', 'الفحص الطبي للتوظيف', 'Pre-employment Medical Check', false);

  -- 8. Initialize Probation Case Automatically
  SELECT * INTO v_policy 
  FROM public.probation_policies 
  WHERE company_id = p_company_id AND is_active = true 
  ORDER BY created_at ASC LIMIT 1;

  IF v_policy.id IS NULL THEN
    -- Fallback default policy (90 days, max ext 90)
    INSERT INTO public.probation_policies (
      company_id, name_ar, name_en, country, default_duration_days, max_extension_days, mid_review_days, final_review_days_before_end
    ) VALUES (
      p_company_id, 'السياسة القياسية لفترة التجربة', 'Standard Probation Policy', 'SA', 90, 90, 45, 14
    ) RETURNING * INTO v_policy;
  END IF;

  v_prob_end := (p_joining_date + (v_policy.default_duration_days * interval '1 day'))::date;
  v_review_due := (v_prob_end - (v_policy.final_review_days_before_end * interval '1 day'))::date;

  INSERT INTO public.probation_cases (
    company_id,
    employee_id,
    onboarding_case_id,
    policy_id,
    start_date,
    original_end_date,
    current_end_date,
    status,
    reviewer_employee_id,
    review_due_at
  ) VALUES (
    p_company_id,
    p_employee_id,
    v_case_id,
    v_policy.id,
    p_joining_date,
    v_prob_end,
    v_prob_end,
    'not_started',
    COALESCE(p_manager_id, v_emp.manager_id),
    v_review_due
  )
  ON CONFLICT (company_id, employee_id) DO UPDATE
  SET onboarding_case_id = v_case_id,
      start_date = p_joining_date,
      original_end_date = v_prob_end,
      current_end_date = v_prob_end,
      review_due_at = v_review_due,
      updated_at = now()
  RETURNING id INTO v_prob_case_id;

  -- 9. Calculate initial readiness
  PERFORM public.calculate_onboarding_readiness_atomic(v_case_id);

  -- 10. Audit Event
  BEGIN
    INSERT INTO public.audit_events (
      company_id, user_id, event_type, action, status, details
    ) VALUES (
      p_company_id,
      auth.uid(),
      'onboarding.case_created',
      'create_onboarding_case',
      'success',
      jsonb_build_object(
        'case_id', v_case_id,
        'employee_id', p_employee_id,
        'joining_date', p_joining_date,
        'candidate_id', p_candidate_id,
        'probation_case_id', v_prob_case_id
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 11. Notification to Inbox
  BEGIN
    INSERT INTO public.notifications_inbox (
      company_id, user_id, type, title_ar, title_en, body_ar, body_en, priority, entity_type, entity_id
    ) VALUES (
      p_company_id,
      auth.uid(),
      'onboarding.started',
      'بدء إجراءات التهيئة والمباشرة',
      'Onboarding Journey Started',
      'تم إنشاء ملف التهيئة للموظف بموعد مباشرة: ' || p_joining_date::text,
      'Onboarding case created for employee with joining date ' || p_joining_date::text,
      'normal',
      'onboarding_case',
      v_case_id::text
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'case_id', v_case_id,
    'employee_id', p_employee_id,
    'probation_case_id', v_prob_case_id,
    'joining_date', p_joining_date,
    'status', 'pre_onboarding'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_onboarding_case_atomic(uuid, uuid, date, uuid, uuid, uuid, uuid, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 15. ATOMIC RPC: update_onboarding_task_status_atomic
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_onboarding_task_status_atomic(
  p_task_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.onboarding_tasks%ROWTYPE;
  v_case public.onboarding_cases%ROWTYPE;
  v_unmet_dep_count integer := 0;
BEGIN
  -- 1. Fetch Task
  SELECT * INTO v_task FROM public.onboarding_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_not_found', 'message', 'المهمة غير موجودة');
  END IF;

  SELECT * INTO v_case FROM public.onboarding_cases WHERE id = v_task.case_id;

  -- 2. Validate Dependencies if completing
  IF p_new_status = 'completed' AND array_length(v_task.depends_on_task_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_unmet_dep_count
    FROM public.onboarding_tasks
    WHERE id = ANY(v_task.depends_on_task_ids) AND status != 'completed';

    IF v_unmet_dep_count > 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'unmet_dependencies',
        'message', 'لا يمكن إنهاء المهمة قبل إكمال المهام التأسيسية المرتبطة بها'
      );
    END IF;
  END IF;

  -- 3. Update Task Status
  UPDATE public.onboarding_tasks
  SET status = p_new_status,
      completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE NULL END,
      completed_by = CASE WHEN p_new_status = 'completed' THEN auth.uid() ELSE NULL END,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_task_id;

  -- 4. Sync operational task if linked
  IF v_task.operational_task_id IS NOT NULL THEN
    UPDATE public.operational_tasks
    SET status = CASE WHEN p_new_status = 'completed' THEN 'completed' ELSE 'in_progress' END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE NULL END,
        completed_by = CASE WHEN p_new_status = 'completed' THEN auth.uid() ELSE NULL END,
        updated_at = now()
    WHERE id = v_task.operational_task_id;
  END IF;

  -- 5. Recalculate Readiness & Progress
  PERFORM public.calculate_onboarding_readiness_atomic(v_task.case_id);

  -- 6. Audit
  BEGIN
    INSERT INTO public.audit_events (
      company_id, user_id, event_type, action, status, details
    ) VALUES (
      v_task.company_id,
      auth.uid(),
      'onboarding.task_status_changed',
      'update_task_status',
      'success',
      jsonb_build_object(
        'task_id', p_task_id,
        'old_status', v_task.status,
        'new_status', p_new_status,
        'case_id', v_task.case_id
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'status', p_new_status,
    'case_id', v_task.case_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_onboarding_task_status_atomic(uuid, text, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 16. ATOMIC RPC: verify_onboarding_document_atomic
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_onboarding_document_atomic(
  p_requirement_id uuid,
  p_status text, -- 'verified' or 'rejected'
  p_rejection_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc public.onboarding_document_requirements%ROWTYPE;
BEGIN
  -- 1. Check HR / Admin Permission
  SELECT * INTO v_doc FROM public.onboarding_document_requirements WHERE id = p_requirement_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'requirement_not_found', 'message', 'متطلب الوثيقة غير موجود');
  END IF;

  IF NOT public.current_user_can_manage_company(v_doc.company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied', 'message', 'غير مصرح باعتماد المستندات');
  END IF;

  IF p_status NOT IN ('verified', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status', 'message', 'حالة الاعتماد غير صالحة');
  END IF;

  -- 2. Update requirement
  UPDATE public.onboarding_document_requirements
  SET status = p_status,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
      verified_at = CASE WHEN p_status = 'verified' THEN now() ELSE NULL END,
      verified_by = auth.uid(),
      updated_at = now()
  WHERE id = p_requirement_id;

  -- 3. Sync employee_documents table if linked
  IF v_doc.employee_document_id IS NOT NULL THEN
    UPDATE public.employee_documents
    SET status = CASE WHEN p_status = 'verified' THEN 'valid' ELSE 'rejected' END,
        rejection_reason = p_rejection_reason,
        verified_at = CASE WHEN p_status = 'verified' THEN now() ELSE NULL END,
        verified_by = 'HR Specialist'
    WHERE id = v_doc.employee_document_id;
  END IF;

  -- 4. Recalculate Readiness
  PERFORM public.calculate_onboarding_readiness_atomic(v_doc.case_id);

  -- 5. Audit
  BEGIN
    INSERT INTO public.audit_events (
      company_id, user_id, event_type, action, status, details
    ) VALUES (
      v_doc.company_id,
      auth.uid(),
      'onboarding.document_' || p_status,
      'verify_document',
      'success',
      jsonb_build_object(
        'requirement_id', p_requirement_id,
        'doc_type', v_doc.doc_type,
        'status', p_status,
        'rejection_reason', p_rejection_reason
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'requirement_id', p_requirement_id,
    'status', p_status,
    'case_id', v_doc.case_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_onboarding_document_atomic(uuid, text, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 17. ATOMIC RPC: complete_onboarding_case_atomic
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_onboarding_case_atomic(
  p_case_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.onboarding_cases%ROWTYPE;
  v_blocking_incomplete integer := 0;
  v_unverified_docs integer := 0;
BEGIN
  SELECT * INTO v_case FROM public.onboarding_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'case_not_found', 'message', 'ملف التهيئة غير موجود');
  END IF;

  IF NOT public.current_user_can_manage_company(v_case.company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied', 'message', 'غير مصرح بإنهاء ملف التهيئة');
  END IF;

  -- 1. Validate Blocking Incomplete Tasks
  SELECT COUNT(*) INTO v_blocking_incomplete
  FROM public.onboarding_tasks
  WHERE case_id = p_case_id AND is_blocking = true AND status != 'completed';

  IF v_blocking_incomplete > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'blocking_tasks_incomplete',
      'message', 'لا يمكن إغلاق ملف التهيئة لوجود مهام أساسية غير مكتملة (' || v_blocking_incomplete || ')'
    );
  END IF;

  -- 2. Validate Mandatory Documents
  SELECT COUNT(*) INTO v_unverified_docs
  FROM public.onboarding_document_requirements
  WHERE case_id = p_case_id AND is_mandatory = true AND status != 'verified';

  IF v_unverified_docs > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'mandatory_documents_missing',
      'message', 'لا يمكن إغلاق ملف التهيئة لوجود وثائق إلزامية غير معتمدة (' || v_unverified_docs || ')'
    );
  END IF;

  -- 3. Mark Case Completed
  UPDATE public.onboarding_cases
  SET status = 'completed',
      completed_at = now(),
      readiness_status = 'ready',
      progress_percentage = 100.00,
      updated_at = now()
  WHERE id = p_case_id;

  -- 4. Transition Employee Status to probation (or active)
  UPDATE public.employees
  SET status = 'probation',
      updated_at = now()
  WHERE id = v_case.employee_id AND status IN ('draft', 'preboarding');

  -- 5. Activate Probation Case
  UPDATE public.probation_cases
  SET status = 'active',
      updated_at = now()
  WHERE onboarding_case_id = p_case_id AND status = 'not_started';

  -- 6. Audit & Notification
  BEGIN
    INSERT INTO public.audit_events (
      company_id, user_id, event_type, action, status, details
    ) VALUES (
      v_case.company_id,
      auth.uid(),
      'onboarding.case_completed',
      'complete_onboarding',
      'success',
      jsonb_build_object(
        'case_id', p_case_id,
        'employee_id', v_case.employee_id,
        'completed_at', now()
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'case_id', p_case_id,
    'status', 'completed',
    'employee_id', v_case.employee_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_case_atomic(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 18. ATOMIC RPC: submit_probation_review_atomic
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_probation_review_atomic(
  p_case_id uuid,
  p_review_type text, -- 'mid_term' or 'final'
  p_rating numeric,
  p_goals_achievement_score numeric,
  p_competency_score numeric,
  p_manager_recommendation text, -- 'confirm', 'extend', 'terminate'
  p_comments text,
  p_strengths text DEFAULT NULL,
  p_improvements text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prob public.probation_cases%ROWTYPE;
  v_rev_id uuid;
  v_my_emp_id uuid := public.resolve_my_employee_id();
BEGIN
  SELECT * INTO v_prob FROM public.probation_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'probation_case_not_found', 'message', 'ملف فترة التجربة غير موجود');
  END IF;

  -- Verify reviewer is authorized manager or HR
  IF v_prob.reviewer_employee_id != v_my_emp_id 
     AND NOT public.current_user_can_manage_company(v_prob.company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied', 'message', 'غير مصرح بتقديم تقييم فترة التجربة');
  END IF;

  INSERT INTO public.probation_reviews (
    probation_case_id,
    company_id,
    review_type,
    reviewer_id,
    reviewer_employee_id,
    rating,
    goals_achievement_score,
    competency_score,
    manager_recommendation,
    comments,
    strengths,
    improvements,
    completed_at
  ) VALUES (
    p_case_id,
    v_prob.company_id,
    p_review_type,
    auth.uid(),
    v_my_emp_id,
    p_rating,
    p_goals_achievement_score,
    p_competency_score,
    p_manager_recommendation,
    p_comments,
    p_strengths,
    p_improvements,
    now()
  )
  ON CONFLICT (probation_case_id, review_type) DO UPDATE
  SET rating = p_rating,
      goals_achievement_score = p_goals_achievement_score,
      competency_score = p_competency_score,
      manager_recommendation = p_manager_recommendation,
      comments = p_comments,
      strengths = p_strengths,
      improvements = p_improvements,
      completed_at = now()
  RETURNING id INTO v_rev_id;

  -- Update probation case state to under_review
  UPDATE public.probation_cases
  SET status = 'under_review',
      updated_at = now()
  WHERE id = p_case_id;

  -- Audit Event
  BEGIN
    INSERT INTO public.audit_events (
      company_id, user_id, event_type, action, status, details
    ) VALUES (
      v_prob.company_id,
      auth.uid(),
      'probation.review_submitted',
      'submit_probation_review',
      'success',
      jsonb_build_object(
        'probation_case_id', p_case_id,
        'review_type', p_review_type,
        'rating', p_rating,
        'recommendation', p_manager_recommendation
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'review_id', v_rev_id,
    'probation_case_id', p_case_id,
    'status', 'under_review'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_probation_review_atomic(uuid, text, numeric, numeric, numeric, text, text, text, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 19. ATOMIC RPC: decide_probation_outcome_atomic
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_probation_outcome_atomic(
  p_case_id uuid,
  p_decision text, -- 'confirmed', 'extended', 'failed'
  p_notes text,
  p_extension_days integer DEFAULT NULL,
  p_extension_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prob public.probation_cases%ROWTYPE;
  v_policy public.probation_policies%ROWTYPE;
  v_new_end_date date;
  v_new_review_due date;
BEGIN
  SELECT * INTO v_prob FROM public.probation_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'case_not_found', 'message', 'ملف التجربة غير موجود');
  END IF;

  IF NOT public.current_user_can_manage_company(v_prob.company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied', 'message', 'غير مصرح باتخاذ قرار فترة التجربة');
  END IF;

  SELECT * INTO v_policy FROM public.probation_policies WHERE id = v_prob.policy_id;

  IF p_decision = 'confirmed' THEN
    -- 1. Confirm Employment
    UPDATE public.probation_cases
    SET status = 'confirmed',
        final_decision = 'confirmed',
        decision_date = current_date,
        decision_notes = p_notes,
        updated_at = now()
    WHERE id = p_case_id;

    -- Update Employee Master status to active
    PERFORM public.change_employee_status(
      v_prob.employee_id,
      'active',
      current_date,
      COALESCE(p_notes, 'اجتياز فترة التجربة وتثبيت التثبيت النهائي')
    );

  ELSIF p_decision = 'extended' THEN
    -- 2. Validate Extension Days against policy
    IF p_extension_days IS NULL OR p_extension_days <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_extension_days', 'message', 'يلزم تحديد عدد أيام التمديد');
    END IF;

    IF v_policy.id IS NOT NULL AND (v_prob.extension_days + p_extension_days) > v_policy.max_extension_days THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'exceeds_max_extension',
        'message', 'التمديد المطلوب يتجاوز الحد الأقصى النظامي المسموح به (' || v_policy.max_extension_days || ' يوماً)'
      );
    END IF;

    v_new_end_date := (v_prob.current_end_date + (p_extension_days * interval '1 day'))::date;
    v_new_review_due := (v_new_end_date - interval '14 days')::date;

    UPDATE public.probation_cases
    SET status = 'extended',
        current_end_date = v_new_end_date,
        review_due_at = v_new_review_due,
        extension_count = extension_count + 1,
        extension_days = extension_days + p_extension_days,
        extension_reason = p_extension_reason,
        decision_notes = p_notes,
        updated_at = now()
    WHERE id = p_case_id;

  ELSIF p_decision = 'failed' THEN
    -- 3. Failed Probation: NEVER delete the employee! Initiate controlled separation/offboarding
    UPDATE public.probation_cases
    SET status = 'failed',
        final_decision = 'failed',
        decision_date = current_date,
        decision_notes = p_notes,
        updated_at = now()
    WHERE id = p_case_id;

    -- Call authoritative change_employee_status
    PERFORM public.change_employee_status(
      v_prob.employee_id,
      'terminated',
      current_date,
      COALESCE(p_notes, 'عدم اجتياز فترة التجربة المقررة'),
      'probation_failure'
    );

    -- Emit Offboarding task in operational_tasks
    INSERT INTO public.operational_tasks (
      company_id,
      task_number,
      title_ar,
      title_en,
      description_ar,
      description_en,
      category,
      priority,
      status,
      due_date,
      entity_type,
      entity_id
    ) VALUES (
      v_prob.company_id,
      'TSK-OFFB-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 90000) + 10000)::text, 5, '0'),
      'إجراءات إنهاء الخدمة وتسوية المستحقات (عدم اجتياز التجربة)',
      'Offboarding & Settlement Clearance (Probation Failure)',
      'بدء تصفية المستحقات وإخلاء الطرف واستلام العهد للموظف المنتهية فترة تجربته',
      'Initiate final settlement and asset clearance for probation termination',
      'offboarding',
      'urgent',
      'pending',
      now() + interval '3 days',
      'employee',
      v_prob.employee_id::text
    );

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_decision', 'message', 'القرار المحدد غير صالح');
  END IF;

  -- Audit Log
  BEGIN
    INSERT INTO public.audit_events (
      company_id, user_id, event_type, action, status, details
    ) VALUES (
      v_prob.company_id,
      auth.uid(),
      'probation.decision_' || p_decision,
      'decide_probation_outcome',
      'success',
      jsonb_build_object(
        'case_id', p_case_id,
        'decision', p_decision,
        'extension_days', p_extension_days,
        'notes', p_notes
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'probation_case_id', p_case_id,
    'decision', p_decision,
    'status', CASE WHEN p_decision = 'extended' THEN 'extended' ELSE p_decision END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.decide_probation_outcome_atomic(uuid, text, text, integer, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 20. ATOMIC RPC: get_onboarding_kpis_atomic
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_onboarding_kpis_atomic(
  p_company_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_upcoming_joiners integer := 0;
  v_joining_this_week integer := 0;
  v_overdue_tasks integer := 0;
  v_missing_docs integer := 0;
  v_ready_to_join integer := 0;
  v_active_cases integer := 0;
  v_delayed_cases integer := 0;
  v_probation_due integer := 0;
  v_probation_confirmed_count integer := 0;
  v_probation_total_decided integer := 0;
  v_probation_confirmed_rate numeric(5,2) := 100.00;
BEGIN
  -- 1. Cases Metrics
  SELECT 
    COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled')),
    COUNT(*) FILTER (WHERE status = 'ready_to_join'),
    COUNT(*) FILTER (WHERE joining_date >= CURRENT_DATE AND joining_date <= CURRENT_DATE + interval '30 days'),
    COUNT(*) FILTER (WHERE joining_date >= CURRENT_DATE AND joining_date <= CURRENT_DATE + interval '7 days')
  INTO v_active_cases, v_ready_to_join, v_upcoming_joiners, v_joining_this_week
  FROM public.onboarding_cases
  WHERE company_id = p_company_id;

  -- 2. Overdue Tasks
  SELECT COUNT(*) INTO v_overdue_tasks
  FROM public.onboarding_tasks
  WHERE company_id = p_company_id AND status NOT IN ('completed', 'cancelled') AND due_date < CURRENT_DATE;

  -- 3. Delayed Cases (active cases with overdue tasks)
  SELECT COUNT(DISTINCT case_id) INTO v_delayed_cases
  FROM public.onboarding_tasks
  WHERE company_id = p_company_id AND status NOT IN ('completed', 'cancelled') AND due_date < CURRENT_DATE;

  -- 4. Missing Mandatory Documents
  SELECT COUNT(*) INTO v_missing_docs
  FROM public.onboarding_document_requirements
  WHERE company_id = p_company_id AND is_mandatory = true AND status IN ('pending', 'rejected');

  -- 5. Probation Metrics
  SELECT COUNT(*) INTO v_probation_due
  FROM public.probation_cases
  WHERE company_id = p_company_id 
    AND status IN ('active', 'review_due', 'under_review') 
    AND review_due_at <= CURRENT_DATE + interval '14 days';

  SELECT 
    COUNT(*) FILTER (WHERE final_decision = 'confirmed'),
    COUNT(*) FILTER (WHERE final_decision IN ('confirmed', 'failed'))
  INTO v_probation_confirmed_count, v_probation_total_decided
  FROM public.probation_cases
  WHERE company_id = p_company_id;

  IF v_probation_total_decided > 0 THEN
    v_probation_confirmed_rate := ROUND((v_probation_confirmed_count::numeric / v_probation_total_decided::numeric) * 100.0, 2);
  ELSE
    v_probation_confirmed_rate := 100.00;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'company_id', p_company_id,
    'upcomingJoiners', v_upcoming_joiners,
    'joiningThisWeek', v_joining_this_week,
    'overdueTasks', v_overdue_tasks,
    'missingDocuments', v_missing_docs,
    'readyToJoin', v_ready_to_join,
    'activeCases', v_active_cases,
    'delayedCases', v_delayed_cases,
    'probationDue', v_probation_due,
    'probationConfirmedRate', v_probation_confirmed_rate
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_onboarding_kpis_atomic(uuid) TO authenticated, service_role;
