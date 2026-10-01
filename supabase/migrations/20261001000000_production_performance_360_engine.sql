-- ============================================================================
-- PROMPT 18: PRODUCTION PERFORMANCE MANAGEMENT, OKR, COMPETENCY & 360° REVIEW ENGINE
-- Migration: 20261001000000_production_performance_360_engine.sql
-- ============================================================================

-- 1. Upgrade public.performance_cycles table
ALTER TABLE public.performance_cycles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS goal_setting_start date,
  ADD COLUMN IF NOT EXISTS goal_setting_end date,
  ADD COLUMN IF NOT EXISTS self_review_start date,
  ADD COLUMN IF NOT EXISTS self_review_end date,
  ADD COLUMN IF NOT EXISTS manager_review_start date,
  ADD COLUMN IF NOT EXISTS manager_review_end date,
  ADD COLUMN IF NOT EXISTS peer_review_start date,
  ADD COLUMN IF NOT EXISTS peer_review_end date,
  ADD COLUMN IF NOT EXISTS calibration_start date,
  ADD COLUMN IF NOT EXISTS calibration_end date,
  ADD COLUMN IF NOT EXISTS finalization_date date,
  ADD COLUMN IF NOT EXISTS require_goals_weight_100 boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_peer_reviews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_peer_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_peer_reviewers integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_peer_reviewers integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS rating_scale_min numeric(3,1) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS rating_scale_max numeric(3,1) NOT NULL DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS rating_scale_step numeric(3,1) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS goals_weight numeric(5,2) NOT NULL DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS competencies_weight numeric(5,2) NOT NULL DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS goals_weight_pct numeric(5,2) NOT NULL DEFAULT 60.00,
  ADD COLUMN IF NOT EXISTS competencies_weight_pct numeric(5,2) NOT NULL DEFAULT 40.00,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS workflow_request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

-- Update check constraints on performance_cycles
DO $$
BEGIN
  ALTER TABLE public.performance_cycles DROP CONSTRAINT IF EXISTS performance_cycles_status_check;
  ALTER TABLE public.performance_cycles ADD CONSTRAINT performance_cycles_status_check
    CHECK (status IN ('draft', 'planned', 'open', 'review_in_progress', 'calibration', 'finalized', 'archived'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.performance_cycles DROP CONSTRAINT IF EXISTS performance_cycles_period_type_check;
  ALTER TABLE public.performance_cycles ADD CONSTRAINT performance_cycles_period_type_check
    CHECK (period_type IN ('annual', 'semi_annual', 'quarterly', 'probation', 'project'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Performance Cycle Participants (Frozen historical snapshot)
CREATE TABLE IF NOT EXISTS public.performance_cycle_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id),
  employee_name_ar text,
  employee_name_en text,
  job_title text,
  job_grade text,
  manager_id uuid REFERENCES public.employees(id),
  status text NOT NULL DEFAULT 'eligible' CHECK (status IN ('eligible', 'in_progress', 'completed', 'exempted')),
  final_score numeric(4,2),
  final_overall_score numeric(4,2),
  final_goal_score numeric(4,2),
  final_competency_score numeric(4,2),
  calibrated_score numeric(4,2),
  rating_label text,
  final_rating_label text,
  potential_score numeric(4,2),
  nine_box_performance text,
  nine_box_potential text,
  nine_box_cell text,
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, employee_id)
);

-- 3. Performance Goals / OKRs (With Cascading and Level Traceability)
CREATE TABLE IF NOT EXISTS public.performance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  parent_goal_id uuid REFERENCES public.performance_goals(id) ON DELETE SET NULL,
  goal_level text NOT NULL DEFAULT 'individual' CHECK (goal_level IN ('company', 'department', 'team', 'individual')),
  title text NOT NULL,
  title_ar text,
  title_en text,
  description text,
  category text NOT NULL DEFAULT 'operational' CHECK (category IN ('financial', 'customer', 'internal_process', 'learning_growth', 'operational', 'strategic', 'individual', 'department', 'company', 'technical', 'behavioral')),
  measurement_type text NOT NULL DEFAULT 'percentage' CHECK (measurement_type IN ('percentage', 'numeric', 'currency', 'boolean')),
  target_value numeric(14,2) NOT NULL DEFAULT 100,
  current_value numeric(14,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '%',
  weight numeric(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'submitted_for_approval', 'approved', 'in_progress', 'completed', 'cancelled')),
  progress_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  score numeric(4,2),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Goal Progress History (Auditable non-destructive updates)
CREATE TABLE IF NOT EXISTS public.goal_progress_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.performance_goals(id) ON DELETE CASCADE,
  previous_value numeric(14,2),
  new_value numeric(14,2) NOT NULL,
  previous_progress numeric(5,2),
  new_progress numeric(5,2) NOT NULL,
  percentage numeric(5,2),
  notes text,
  note text,
  evidence_url text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Competency Frameworks & Versioning
CREATE TABLE IF NOT EXISTS public.competency_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description text,
  applicable_grades text[] DEFAULT '{}'::text[],
  applicable_positions text[] DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, code, version)
);

-- 6. Configurable Competencies
CREATE TABLE IF NOT EXISTS public.competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES public.competency_frameworks(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('core', 'leadership', 'functional', 'technical', 'behavioral')),
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description text,
  behavioral_indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  weight numeric(5,2) NOT NULL DEFAULT 20.00,
  scale_min numeric(3,1) NOT NULL DEFAULT 1.0,
  scale_max numeric(3,1) NOT NULL DEFAULT 5.0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Review Form Templates
CREATE TABLE IF NOT EXISTS public.review_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  target_role text NOT NULL CHECK (target_role IN ('employee', 'manager', 'leadership', 'all')),
  include_goals boolean NOT NULL DEFAULT true,
  include_competencies boolean NOT NULL DEFAULT true,
  include_development boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, code, version)
);

-- 8. Review Template Items
CREATE TABLE IF NOT EXISTS public.review_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.review_templates(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('goals', 'competencies', 'questions', 'development')),
  competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  question_ar text,
  question_en text,
  item_type text NOT NULL CHECK (item_type IN ('rating', 'text', 'multiple_choice', 'boolean')),
  weight numeric(5,2) NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0
);

-- 9. Reviewer Assignments (360° Review Model)
CREATE TABLE IF NOT EXISTS public.performance_review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  review_type text NOT NULL CHECK (review_type IN ('self', 'manager', 'peer', 'subordinate', 'external')),
  template_id uuid REFERENCES public.review_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'returned', 'calibrated', 'finalized')),
  is_anonymous boolean NOT NULL DEFAULT false,
  due_date date,
  submitted_at timestamptz,
  returned_at timestamptz,
  return_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, employee_id, reviewer_id, review_type)
);

CREATE OR REPLACE FUNCTION public.sync_reviewer_assignment_columns()
RETURNS trigger AS $$
BEGIN
  IF NEW.reviewer_employee_id IS NULL AND NEW.reviewer_id IS NOT NULL THEN
    NEW.reviewer_employee_id := NEW.reviewer_id;
  END IF;
  IF NEW.reviewer_id IS NULL AND NEW.reviewer_employee_id IS NOT NULL THEN
    NEW.reviewer_id := NEW.reviewer_employee_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_reviewer_assignments ON public.performance_review_assignments;
CREATE TRIGGER trg_sync_reviewer_assignments
BEFORE INSERT OR UPDATE ON public.performance_review_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_reviewer_assignment_columns();

-- 10. Performance Reviews (Filled Evaluation Data)
CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES public.performance_review_assignments(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  review_type text NOT NULL,
  goal_score numeric(4,2),
  competency_score numeric(4,2),
  overall_score numeric(4,2) NOT NULL,
  private_manager_notes text,
  hr_calibration_notes text,
  shared_feedback text,
  general_feedback text,
  strengths text,
  strengths_summary text,
  areas_for_improvement text,
  growth_areas_summary text,
  is_locked boolean NOT NULL DEFAULT true,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.sync_performance_review_columns()
RETURNS trigger AS $$
BEGIN
  IF NEW.strengths_summary IS NULL THEN NEW.strengths_summary := NEW.strengths; END IF;
  IF NEW.strengths IS NULL THEN NEW.strengths := NEW.strengths_summary; END IF;

  IF NEW.growth_areas_summary IS NULL THEN NEW.growth_areas_summary := NEW.areas_for_improvement; END IF;
  IF NEW.areas_for_improvement IS NULL THEN NEW.areas_for_improvement := NEW.growth_areas_summary; END IF;

  IF NEW.general_feedback IS NULL THEN NEW.general_feedback := NEW.shared_feedback; END IF;
  IF NEW.shared_feedback IS NULL THEN NEW.shared_feedback := NEW.general_feedback; END IF;

  IF NEW.reviewer_employee_id IS NULL THEN NEW.reviewer_employee_id := NEW.reviewer_id; END IF;
  IF NEW.reviewer_id IS NULL THEN NEW.reviewer_id := NEW.reviewer_employee_id; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_performance_reviews ON public.performance_reviews;
CREATE TRIGGER trg_sync_performance_reviews
BEFORE INSERT OR UPDATE ON public.performance_reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_performance_review_columns();

-- 11. Performance Review Item Scores
CREATE TABLE IF NOT EXISTS public.performance_review_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('goal', 'competency', 'question')),
  item_id uuid NOT NULL,
  score numeric(4,2) NOT NULL,
  weight numeric(5,2) NOT NULL DEFAULT 0,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. Calibration Sessions & Adjustments
CREATE TABLE IF NOT EXISTS public.calibration_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  session_name text DEFAULT 'جلسة معايرة وموازنة',
  title_ar text,
  title_en text,
  moderator_id uuid REFERENCES public.employees(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'approved', 'cancelled')),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  target_distribution jsonb DEFAULT '{}'::jsonb,
  actual_distribution jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calibration_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.calibration_sessions(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  original_score numeric(4,2) NOT NULL,
  calibrated_score numeric(4,2) NOT NULL,
  original_rating_label text,
  calibrated_rating_label text,
  justification text NOT NULL,
  adjusted_by uuid NOT NULL REFERENCES auth.users(id),
  adjusted_at timestamptz NOT NULL DEFAULT now()
);

-- 13. Potential Assessments (Independent 9-Box Dimension)
CREATE TABLE IF NOT EXISTS public.potential_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assessor_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  potential_score numeric(4,2) NOT NULL CHECK (potential_score >= 1.0 AND potential_score <= 5.0),
  potential_level text NOT NULL CHECK (potential_level IN ('low', 'medium', 'high')),
  agility_score numeric(4,2),
  aspiration_score numeric(4,2),
  leadership_capability_score numeric(4,2),
  comments text,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, employee_id)
);

-- 14. Individual Development Plans (IDP)
CREATE TABLE IF NOT EXISTS public.development_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES public.performance_cycles(id) ON DELETE SET NULL,
  mentor_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'in_progress', 'completed', 'cancelled')),
  target_completion_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.development_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.development_plans(id) ON DELETE CASCADE,
  competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('training', 'mentorship', 'stretch_assignment', 'self_study', 'certification')),
  description text NOT NULL,
  success_criteria text,
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'verified')),
  completed_at timestamptz
);

-- 15. Performance Improvement Plans (PIP)
CREATE TABLE IF NOT EXISTS public.performance_improvement_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reason text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  checkpoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'successful', 'unsuccessful', 'extended', 'cancelled')),
  hr_approver_id uuid REFERENCES auth.users(id),
  final_review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 16. Performance Audit Logs
CREATE TABLE IF NOT EXISTS public.performance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  old_state jsonb,
  new_state jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 2: ROW LEVEL SECURITY & DENY-BY-DEFAULT POLICIES
-- ============================================================================

ALTER TABLE public.performance_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_cycles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.performance_cycle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_cycle_participants FORCE ROW LEVEL SECURITY;

ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_goals FORCE ROW LEVEL SECURITY;

ALTER TABLE public.goal_progress_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress_history FORCE ROW LEVEL SECURITY;

ALTER TABLE public.competency_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_frameworks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competencies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.review_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_templates FORCE ROW LEVEL SECURITY;

ALTER TABLE public.review_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_template_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.performance_review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_review_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews FORCE ROW LEVEL SECURITY;

ALTER TABLE public.performance_review_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_review_scores FORCE ROW LEVEL SECURITY;

ALTER TABLE public.calibration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibration_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.calibration_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibration_adjustments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.potential_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.potential_assessments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.development_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_plans FORCE ROW LEVEL SECURITY;

ALTER TABLE public.development_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_plan_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.performance_improvement_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_improvement_plans FORCE ROW LEVEL SECURITY;

ALTER TABLE public.performance_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_audit_logs FORCE ROW LEVEL SECURITY;

-- Cycles RLS
DROP POLICY IF EXISTS "performance_cycles_read_policy" ON public.performance_cycles;
CREATE POLICY "performance_cycles_read_policy"
  ON public.performance_cycles FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "performance_cycles_admin_policy" ON public.performance_cycles;
CREATE POLICY "performance_cycles_admin_policy"
  ON public.performance_cycles FOR ALL
  TO authenticated
  USING (
    (company_id = public.current_company_id() OR company_id IS NULL)
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  )
  WITH CHECK (
    (company_id = public.current_company_id() OR company_id IS NULL)
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
  );

-- Participants RLS
DROP POLICY IF EXISTS "participants_read_policy" ON public.performance_cycle_participants;
CREATE POLICY "participants_read_policy"
  ON public.performance_cycle_participants FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
      OR manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
      OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'general_manager'])
    )
  );

-- Goals RLS
DROP POLICY IF EXISTS "performance_goals_policy" ON public.performance_goals;
CREATE POLICY "performance_goals_policy"
  ON public.performance_goals FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      goal_level IN ('company', 'department')
      OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
      OR employee_id IN (SELECT id FROM public.employees WHERE manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
      OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
      OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    )
  );

-- Review Assignments RLS
DROP POLICY IF EXISTS "review_assignments_policy" ON public.performance_review_assignments;
CREATE POLICY "review_assignments_policy"
  ON public.performance_review_assignments FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      reviewer_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
      OR (
        employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
        AND status IN ('finalized', 'calibrated')
      )
      OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    )
  );

-- Audits & Frameworks Grants
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ============================================================================
-- STEP 3: ATOMIC RPC - LAUNCH CYCLE (With Snapshot & Assignments)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.launch_performance_cycle_atomic(
  p_cycle_id uuid,
  p_department_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_cycle public.performance_cycles%ROWTYPE;
  v_emp record;
  v_participant_count integer := 0;
  v_assignments_count integer := 0;
  v_template_id uuid;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
    RAISE EXCEPTION 'غير مصرح للمستخدم بإطلاق دورة تقييم الأداء';
  END IF;

  SELECT * INTO v_cycle FROM public.performance_cycles WHERE id = p_cycle_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'دورة التقييم المحددة غير موجودة';
  END IF;

  IF v_cycle.status NOT IN ('draft', 'planned') THEN
    RAISE EXCEPTION 'لا يمكن إطلاق الدورة، حالتها الحالية هي: %', v_cycle.status;
  END IF;

  -- Pick default review template
  SELECT id INTO v_template_id
  FROM public.review_templates
  WHERE (company_id = v_cycle.company_id OR company_id IS NULL)
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  -- Snapshot eligible active employees
  FOR v_emp IN
    SELECT
      e.id,
      e.company_id,
      e.department_id,
      e.job_title,
      COALESCE(e.manager_id, e.manager_employee_id) AS manager_id,
      TRIM(e.first_name_ar || ' ' || e.last_name_ar) AS employee_name_ar,
      TRIM(COALESCE(e.first_name_en, '') || ' ' || COALESCE(e.last_name_en, '')) AS employee_name_en
    FROM public.employees e
    WHERE e.status = 'active'
      AND (v_cycle.company_id IS NULL OR e.company_id = v_cycle.company_id)
      AND (p_department_ids IS NULL OR e.department_id = ANY(p_department_ids))
  LOOP
    -- Insert Participant Snapshot
    INSERT INTO public.performance_cycle_participants (
      cycle_id,
      employee_id,
      company_id,
      department_id,
      employee_name_ar,
      employee_name_en,
      job_title,
      manager_id,
      status
    ) VALUES (
      p_cycle_id,
      v_emp.id,
      v_emp.company_id,
      v_emp.department_id,
      v_emp.employee_name_ar,
      v_emp.employee_name_en,
      v_emp.job_title,
      v_emp.manager_id,
      'eligible'
    )
    ON CONFLICT (cycle_id, employee_id) DO NOTHING;

    v_participant_count := v_participant_count + 1;

    -- 1. Create Self-Review Assignment
    INSERT INTO public.performance_review_assignments (
      company_id,
      cycle_id,
      employee_id,
      reviewer_id,
      review_type,
      template_id,
      due_date,
      status
    ) VALUES (
      v_emp.company_id,
      p_cycle_id,
      v_emp.id,
      v_emp.id,
      'self',
      v_template_id,
      COALESCE(v_cycle.self_review_end, v_cycle.end_date),
      'not_started'
    )
    ON CONFLICT (cycle_id, employee_id, reviewer_id, review_type) DO NOTHING;
    v_assignments_count := v_assignments_count + 1;

    -- 2. Create Manager Review Assignment (if manager exists)
    IF v_emp.manager_id IS NOT NULL AND v_emp.manager_id != v_emp.id THEN
      INSERT INTO public.performance_review_assignments (
        company_id,
        cycle_id,
        employee_id,
        reviewer_id,
        review_type,
        template_id,
        due_date,
        status
      ) VALUES (
        v_emp.company_id,
        p_cycle_id,
        v_emp.id,
        v_emp.manager_id,
        'manager',
        v_template_id,
        COALESCE(v_cycle.manager_review_end, v_cycle.end_date),
        'not_started'
      )
      ON CONFLICT (cycle_id, employee_id, reviewer_id, review_type) DO NOTHING;
      v_assignments_count := v_assignments_count + 1;
    END IF;
  END LOOP;

  -- Update Cycle to open
  UPDATE public.performance_cycles
  SET status = 'open',
      participants_count = v_participant_count,
      updated_at = now()
  WHERE id = p_cycle_id;

  -- Audit Log
  INSERT INTO public.performance_audit_logs (
    company_id,
    cycle_id,
    action,
    actor_id,
    new_state,
    notes
  ) VALUES (
    COALESCE(v_cycle.company_id, public.current_company_id()),
    p_cycle_id,
    'cycle_launched',
    COALESCE(v_caller_uid, '00000000-0000-0000-0000-000000000000'::uuid),
    jsonb_build_object('participantsCount', v_participant_count, 'assignmentsCount', v_assignments_count),
    'تم إطلاق دورة تقييم الأداء وتجميد سجل المشاركين وإنشاء التكليفات الذاتية والإدارية'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'cycle_id', p_cycle_id,
    'status', 'open',
    'participants_count', v_participant_count,
    'participants_enrolled', v_participant_count,
    'assignments_count', v_assignments_count,
    'assignments_generated', v_assignments_count
  );
END;
$$;

-- ============================================================================
-- STEP 4: ATOMIC RPC - ASSIGN PEER REVIEWERS (360° Peer Review)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_peer_reviewers_atomic(
  p_cycle_id uuid,
  p_employee_id uuid,
  p_peer_ids uuid[],
  p_is_anonymous boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_cycle public.performance_cycles%ROWTYPE;
  v_emp public.employees%ROWTYPE;
  v_peer_id uuid;
  v_peer public.employees%ROWTYPE;
  v_assigned_count integer := 0;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
    -- Check if caller is the direct manager of employee
    IF NOT EXISTS (
      SELECT 1 FROM public.employees m
      JOIN public.employees e ON COALESCE(e.manager_id, e.manager_employee_id) = m.id
      WHERE m.user_id = v_caller_uid AND e.id = p_employee_id
    ) THEN
      RAISE EXCEPTION 'غير مصرح للمستخدم بتعيين مقيمي الزملاء (360) لهذا الموظف';
    END IF;
  END IF;

  SELECT * INTO v_cycle FROM public.performance_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'دورة التقييم المحددة غير موجودة';
  END IF;

  IF NOT v_cycle.allow_peer_reviews THEN
    RAISE EXCEPTION 'دورة التقييم الحالية لا تتيح تقييم الزملاء (Peer Reviews)';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'سجل الموظف المراد تقييمه غير موجود';
  END IF;

  FOREACH v_peer_id IN ARRAY p_peer_ids
  LOOP
    IF v_peer_id = p_employee_id THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'لا يمكن للموظف تقييم نفسه كزميل (غير صالح)');
    END IF;

    SELECT * INTO v_peer FROM public.employees WHERE id = v_peer_id AND status = 'active';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'المقيّم الزميل غير صالح أو غير نشط');
    END IF;

    IF v_peer.company_id != v_emp.company_id THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'الزميل المقيّم غير صالح أو ينتمي لشركة أخرى ولا يجوز تعيينه');
    END IF;

    INSERT INTO public.performance_review_assignments (
      company_id,
      cycle_id,
      employee_id,
      reviewer_id,
      reviewer_employee_id,
      review_type,
      due_date,
      is_anonymous,
      status
    ) VALUES (
      v_emp.company_id,
      p_cycle_id,
      p_employee_id,
      v_peer_id,
      v_peer_id,
      'peer',
      COALESCE(v_cycle.peer_review_end, v_cycle.end_date),
      COALESCE(p_is_anonymous, v_cycle.is_peer_anonymous),
      'not_started'
    )
    ON CONFLICT (cycle_id, employee_id, reviewer_id, review_type) DO NOTHING;

    v_assigned_count := v_assigned_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'cycle_id', p_cycle_id,
    'employee_id', p_employee_id,
    'assignments_count', v_assigned_count,
    'assigned_count', v_assigned_count
  );
END;
$$;

-- ============================================================================
-- STEP 5: ATOMIC RPC - SUBMIT / MANAGE GOALS / OKRs (With Weight Check)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_performance_goal_atomic(
  p_cycle_id uuid,
  p_employee_id uuid DEFAULT NULL,
  p_parent_goal_id uuid DEFAULT NULL,
  p_category text DEFAULT 'individual',
  p_level text DEFAULT 'individual',
  p_title_ar text DEFAULT '',
  p_title_en text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metric_type text DEFAULT 'percentage',
  p_start_value numeric DEFAULT 0,
  p_target_value numeric DEFAULT 100,
  p_weight numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_cycle public.performance_cycles%ROWTYPE;
  v_goal_id uuid;
  v_current_total numeric;
  v_target_emp_id uuid;
BEGIN
  v_caller_uid := auth.uid();
  SELECT * INTO v_cycle FROM public.performance_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'دورة التقييم المحددة غير موجودة');
  END IF;

  v_target_emp_id := p_employee_id;
  IF v_target_emp_id IS NULL THEN
    SELECT id INTO v_target_emp_id FROM public.employees WHERE user_id = v_caller_uid LIMIT 1;
  END IF;

  IF p_weight > 100.00 THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'وزن الهدف لا يمكن أن يتجاوز 100%');
  END IF;

  -- Validate weights if individual goal
  IF v_target_emp_id IS NOT NULL THEN
    SELECT COALESCE(SUM(weight), 0) INTO v_current_total
    FROM public.performance_goals
    WHERE cycle_id = p_cycle_id
      AND employee_id = v_target_emp_id
      AND status NOT IN ('cancelled');

    IF (v_current_total + p_weight) > 100.00 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'success', false,
        'error', format('إجمالي أوزان أهداف الموظف يتجاوز 100%% (الإجمالي الحالي: %s + المطلوب: %s)', v_current_total, p_weight)
      );
    END IF;
  END IF;

  v_goal_id := gen_random_uuid();
  INSERT INTO public.performance_goals (
    id,
    company_id,
    cycle_id,
    employee_id,
    parent_goal_id,
    goal_level,
    title,
    title_ar,
    title_en,
    description,
    category,
    measurement_type,
    target_value,
    current_value,
    unit,
    weight,
    start_date,
    end_date,
    status,
    progress_percentage,
    created_by
  ) VALUES (
    v_goal_id,
    COALESCE(v_cycle.company_id, public.current_company_id()),
    p_cycle_id,
    v_target_emp_id,
    p_parent_goal_id,
    p_level,
    COALESCE(p_title_ar, 'هدف'),
    p_title_ar,
    p_title_en,
    p_description,
    p_category,
    COALESCE(p_metric_type, 'percentage'),
    COALESCE(p_target_value, 100),
    COALESCE(p_start_value, 0),
    '%',
    p_weight,
    v_cycle.start_date,
    v_cycle.end_date,
    'active',
    0,
    v_caller_uid
  );

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'goal_id', v_goal_id,
    'weight', p_weight,
    'title', p_title_ar
  );
END;
$$;

-- ============================================================================
-- STEP 6: ATOMIC RPC - UPDATE GOAL PROGRESS (With History)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_goal_progress_atomic(
  p_goal_id uuid,
  p_new_value numeric,
  p_percentage numeric DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_goal public.performance_goals%ROWTYPE;
  v_calc_progress numeric(5,2);
  v_final_progress numeric(5,2);
BEGIN
  v_caller_uid := auth.uid();
  SELECT * INTO v_goal FROM public.performance_goals WHERE id = p_goal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'الهدف المحدد غير موجود');
  END IF;

  IF p_percentage IS NOT NULL THEN
    v_final_progress := LEAST(100.00, GREATEST(0.00, p_percentage));
  ELSIF v_goal.target_value > 0 THEN
    v_final_progress := LEAST(100.00, GREATEST(0.00, ROUND((p_new_value / v_goal.target_value) * 100.00, 2)));
  ELSE
    v_final_progress := 100.00;
  END IF;

  -- Record Progress History
  INSERT INTO public.goal_progress_history (
    goal_id,
    previous_value,
    new_value,
    previous_progress,
    new_progress,
    percentage,
    notes,
    note,
    evidence_url,
    updated_by
  ) VALUES (
    p_goal_id,
    v_goal.current_value,
    p_new_value,
    v_goal.progress_percentage,
    v_final_progress,
    v_final_progress,
    p_note,
    p_note,
    p_evidence_url,
    v_caller_uid
  );

  -- Update Goal
  UPDATE public.performance_goals
  SET current_value = p_new_value,
      progress_percentage = v_final_progress,
      status = CASE WHEN v_final_progress >= 100.00 THEN 'completed' ELSE 'in_progress' END,
      updated_at = now()
  WHERE id = p_goal_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'goal_id', p_goal_id,
    'new_value', p_new_value,
    'new_percentage', v_final_progress,
    'progress_percentage', v_final_progress
  );
END;
$$;

-- ============================================================================
-- STEP 7: ATOMIC RPC - SUBMIT REVIEW & SERVER-SIDE SCORING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_performance_review_atomic(
  p_assignment_id uuid,
  p_scores jsonb,
  p_strengths_summary text DEFAULT NULL,
  p_growth_areas_summary text DEFAULT NULL,
  p_general_feedback text DEFAULT NULL,
  p_private_manager_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_assign public.performance_review_assignments%ROWTYPE;
  v_cycle public.performance_cycles%ROWTYPE;
  v_caller_emp_id uuid;
  v_review_id uuid;
  v_goal_sum numeric(10,2) := 0;
  v_goal_count integer := 0;
  v_goal_score numeric(4,2) := 0;
  v_comp_sum numeric(10,2) := 0;
  v_comp_count integer := 0;
  v_comp_score numeric(4,2) := 0;
  v_overall_score numeric(4,2) := 0;
  v_elem jsonb;
  v_item_score numeric;
  v_item_type text;
BEGIN
  v_caller_uid := auth.uid();
  SELECT * INTO v_assign FROM public.performance_review_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'تكليف التقييم المحدد غير موجود');
  END IF;

  IF v_assign.status IN ('submitted', 'finalized') THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'هذا التقييم تم تقديمه بالفعل ولا يمكن تعديله إلا عبر إعادة الفتح من الموارد البشرية');
  END IF;

  SELECT * INTO v_cycle FROM public.performance_cycles WHERE id = v_assign.cycle_id;

  -- Authorization check: Caller must be the assigned reviewer or authorized HR
  SELECT id INTO v_caller_emp_id FROM public.employees WHERE user_id = v_caller_uid LIMIT 1;
  IF v_caller_emp_id IS NOT NULL AND v_caller_emp_id != v_assign.reviewer_id THEN
    IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'غير مصرح للمستخدم بتقديم تقييم مكلف لشخص آخر');
    END IF;
  END IF;

  -- 1. Calculate Goal & Competency Scores Server-side
  IF p_scores IS NOT NULL AND jsonb_array_length(p_scores) > 0 THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_scores)
    LOOP
      v_item_score := (v_elem->>'score')::numeric;
      v_item_type := COALESCE(v_elem->>'item_type', 'goal');

      IF v_item_type = 'goal' THEN
        v_goal_sum := v_goal_sum + v_item_score;
        v_goal_count := v_goal_count + 1;
      ELSIF v_item_type = 'competency' THEN
        v_comp_sum := v_comp_sum + v_item_score;
        v_comp_count := v_comp_count + 1;
      END IF;
    END LOOP;

    IF v_goal_count > 0 THEN
      v_goal_score := ROUND((v_goal_sum / v_goal_count), 2);
    END IF;
    IF v_comp_count > 0 THEN
      v_comp_score := ROUND((v_comp_sum / v_comp_count), 2);
    END IF;

    -- 2. Calculate Overall Weighted Score
    IF v_goal_count > 0 AND v_comp_count > 0 THEN
      v_overall_score := ROUND(
        (v_goal_score * (COALESCE(v_cycle.goals_weight_pct, 60.0) / 100.00)) + 
        (v_comp_score * (COALESCE(v_cycle.competencies_weight_pct, 40.0) / 100.00)),
        2
      );
    ELSIF v_goal_count > 0 THEN
      v_overall_score := v_goal_score;
    ELSE
      v_overall_score := v_comp_score;
    END IF;
  END IF;

  -- Insert Performance Review
  v_review_id := gen_random_uuid();
  INSERT INTO public.performance_reviews (
    id,
    assignment_id,
    cycle_id,
    employee_id,
    reviewer_id,
    reviewer_employee_id,
    review_type,
    goal_score,
    competency_score,
    overall_score,
    private_manager_notes,
    shared_feedback,
    general_feedback,
    strengths,
    strengths_summary,
    areas_for_improvement,
    growth_areas_summary,
    is_locked,
    answers
  ) VALUES (
    v_review_id,
    p_assignment_id,
    v_assign.cycle_id,
    v_assign.employee_id,
    v_assign.reviewer_id,
    v_assign.reviewer_id,
    v_assign.review_type,
    v_goal_score,
    v_comp_score,
    v_overall_score,
    p_private_manager_notes,
    p_general_feedback,
    p_general_feedback,
    p_strengths_summary,
    p_strengths_summary,
    p_growth_areas_summary,
    p_growth_areas_summary,
    true,
    jsonb_build_object('scores', p_scores)
  );

  -- Update assignment status
  UPDATE public.performance_review_assignments
  SET status = 'submitted',
      submitted_at = now()
  WHERE id = p_assignment_id;

  -- Audit log
  INSERT INTO public.performance_audit_logs (
    company_id,
    cycle_id,
    employee_id,
    action,
    actor_id,
    new_state,
    notes
  ) VALUES (
    v_assign.company_id,
    v_assign.cycle_id,
    v_assign.employee_id,
    'review_submitted',
    COALESCE(v_caller_uid, '00000000-0000-0000-0000-000000000000'::uuid),
    jsonb_build_object('reviewType', v_assign.review_type, 'overallScore', v_overall_score),
    'تم اعتماد وحفظ تقييم الأداء بنجاح واحتساب الدرجات آلياً'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'review_id', v_review_id,
    'assignment_id', p_assignment_id,
    'goal_score', v_goal_score,
    'competency_score', v_comp_score,
    'overall_score', v_overall_score
  );
END;
$$;

-- ============================================================================
-- STEP 8: ATOMIC RPC - CALIBRATION ADJUSTMENT & AUDIT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.adjust_calibration_atomic(
  p_session_id uuid,
  p_employee_id uuid,
  p_cycle_id uuid,
  p_calibrated_score numeric,
  p_justification text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_participant public.performance_cycle_participants%ROWTYPE;
  v_original_score numeric;
  v_calibrated_label text;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
    RAISE EXCEPTION 'غير مصرح للمستخدم بتعديل المعايرة وموازنة الدرجات (Calibration)';
  END IF;

  SELECT * INTO v_participant
  FROM public.performance_cycle_participants
  WHERE cycle_id = p_cycle_id AND employee_id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'سجل مشاركة الموظف في الدورة غير موجود';
  END IF;

  IF v_participant.is_locked THEN
    RAISE EXCEPTION 'تم إغلاق نتائج الموظف في هذه الدورة مسبقاً ولا يمكن تعديلها';
  END IF;

  v_original_score := COALESCE(v_participant.final_score, v_participant.calibrated_score, 3.0);

  -- Determine calibrated label
  IF p_calibrated_score >= 4.8 THEN v_calibrated_label := 'استثنائي (Exceptional)';
  ELSIF p_calibrated_score >= 4.0 THEN v_calibrated_label := 'يتجاوز التوقعات (Exceeds Expectations)';
  ELSIF p_calibrated_score >= 3.0 THEN v_calibrated_label := 'مطابق للتوقعات (Meets Expectations)';
  ELSIF p_calibrated_score >= 2.0 THEN v_calibrated_label := 'يحتاج تطوير (Needs Improvement)';
  ELSE v_calibrated_label := 'أداء غير مرضي (Unsatisfactory)';
  END IF;

  INSERT INTO public.calibration_adjustments (
    session_id,
    employee_id,
    cycle_id,
    original_score,
    calibrated_score,
    original_rating_label,
    calibrated_rating_label,
    justification,
    adjusted_by
  ) VALUES (
    p_session_id,
    p_employee_id,
    p_cycle_id,
    v_original_score,
    p_calibrated_score,
    v_participant.rating_label,
    v_calibrated_label,
    p_justification,
    COALESCE(v_caller_uid, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  UPDATE public.performance_cycle_participants
  SET calibrated_score = p_calibrated_score,
      final_score = p_calibrated_score,
      final_overall_score = p_calibrated_score,
      rating_label = v_calibrated_label,
      final_rating_label = v_calibrated_label
  WHERE cycle_id = p_cycle_id AND employee_id = p_employee_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'adjustment_id', gen_random_uuid(),
    'employee_id', p_employee_id,
    'original_score', v_original_score,
    'calibrated_score', p_calibrated_score,
    'rating_label', v_calibrated_label,
    'calibrated_rating_label', v_calibrated_label
  );
END;
$$;

-- ============================================================================
-- STEP 9: ATOMIC RPC - ASSESS POTENTIAL (Independent 9-Box Dimension)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assess_potential_atomic(
  p_cycle_id uuid,
  p_employee_id uuid,
  p_potential_score numeric,
  p_comments text DEFAULT NULL,
  p_agility numeric DEFAULT NULL,
  p_aspiration numeric DEFAULT NULL,
  p_leadership numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_emp public.employees%ROWTYPE;
  v_caller_emp public.employees%ROWTYPE;
  v_level text;
  v_perf_score numeric;
  v_perf_level text;
  v_nine_box text;
BEGIN
  v_caller_uid := auth.uid();
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف المحدد غير موجود';
  END IF;

  SELECT * INTO v_caller_emp FROM public.employees WHERE user_id = v_caller_uid LIMIT 1;
  IF v_caller_emp.id IS NOT NULL AND v_caller_emp.id != COALESCE(v_emp.manager_id, v_emp.manager_employee_id) THEN
    IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
      RAISE EXCEPTION 'غير مصرح بتقييم الإمكانات والقدرات (Potential) إلا للمدير المباشر أو الموارد البشرية';
    END IF;
  END IF;

  -- Determine Potential Level
  IF p_potential_score >= 3.8 THEN v_level := 'high';
  ELSIF p_potential_score >= 2.8 THEN v_level := 'medium';
  ELSE v_level := 'low';
  END IF;

  INSERT INTO public.potential_assessments (
    cycle_id,
    employee_id,
    company_id,
    assessor_id,
    potential_score,
    potential_level,
    agility_score,
    aspiration_score,
    leadership_capability_score,
    comments
  ) VALUES (
    p_cycle_id,
    p_employee_id,
    v_emp.company_id,
    COALESCE(v_caller_emp.id, p_employee_id),
    p_potential_score,
    v_level,
    p_agility,
    p_aspiration,
    p_leadership,
    p_comments
  )
  ON CONFLICT (cycle_id, employee_id) DO UPDATE
  SET potential_score = EXCLUDED.potential_score,
      potential_level = EXCLUDED.potential_level,
      agility_score = EXCLUDED.agility_score,
      aspiration_score = EXCLUDED.aspiration_score,
      leadership_capability_score = EXCLUDED.leadership_capability_score,
      comments = EXCLUDED.comments,
      assessed_at = now();

  -- Calculate 9-box cell for participant
  SELECT COALESCE(calibrated_score, final_score, 3.0) INTO v_perf_score
  FROM public.performance_cycle_participants
  WHERE cycle_id = p_cycle_id AND employee_id = p_employee_id;

  IF v_perf_score >= 3.8 THEN v_perf_level := 'high';
  ELSIF v_perf_score >= 2.8 THEN v_perf_level := 'medium';
  ELSE v_perf_level := 'low';
  END IF;

  -- Combine performance and potential into 9-box standard grid cells (1A - 3C)
  v_nine_box := CASE
    WHEN v_perf_level = 'high' AND v_level = 'high' THEN '1A'
    WHEN v_perf_level = 'high' AND v_level = 'medium' THEN '1B'
    WHEN v_perf_level = 'high' AND v_level = 'low' THEN '1C'
    WHEN v_perf_level = 'medium' AND v_level = 'high' THEN '2A'
    WHEN v_perf_level = 'medium' AND v_level = 'medium' THEN '2B'
    WHEN v_perf_level = 'medium' AND v_level = 'low' THEN '2C'
    WHEN v_perf_level = 'low' AND v_level = 'high' THEN '3A'
    WHEN v_perf_level = 'low' AND v_level = 'medium' THEN '3B'
    ELSE '3C'
  END;

  UPDATE public.performance_cycle_participants
  SET potential_score = p_potential_score,
      nine_box_performance = v_perf_level,
      nine_box_potential = v_level,
      nine_box_cell = v_nine_box
  WHERE cycle_id = p_cycle_id AND employee_id = p_employee_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'employee_id', p_employee_id,
    'potential_score', p_potential_score,
    'potential_level', v_level,
    'nine_box_cell', v_nine_box
  );
END;
$$;

-- ============================================================================
-- STEP 10: ATOMIC RPC - FINALIZE PERFORMANCE CYCLE (Immutable Lock)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_performance_cycle_atomic(
  p_cycle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_cycle public.performance_cycles%ROWTYPE;
  v_participant record;
  v_manager_score numeric;
  v_final numeric;
  v_label text;
  v_count integer := 0;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
    RAISE EXCEPTION 'غير مصرح للمستخدم باعتماد وإغلاق دورة تقييم الأداء';
  END IF;

  SELECT * INTO v_cycle FROM public.performance_cycles WHERE id = p_cycle_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'دورة التقييم المحددة غير موجودة';
  END IF;

  -- Lock all participants and establish immutable scores
  FOR v_participant IN
    SELECT p.id, p.employee_id, p.calibrated_score, p.final_score
    FROM public.performance_cycle_participants p
    WHERE p.cycle_id = p_cycle_id
  LOOP
    v_count := v_count + 1;
    -- Get manager score if calibrated score not set
    IF v_participant.calibrated_score IS NOT NULL THEN
      v_final := v_participant.calibrated_score;
    ELSIF v_participant.final_score IS NOT NULL THEN
      v_final := v_participant.final_score;
    ELSE
      SELECT r.overall_score INTO v_manager_score
      FROM public.performance_reviews r
      WHERE r.cycle_id = p_cycle_id AND r.employee_id = v_participant.employee_id AND r.review_type = 'manager'
      LIMIT 1;

      v_final := COALESCE(v_manager_score, 3.0);
    END IF;

    IF v_final >= 4.8 THEN v_label := 'استثنائي (Exceptional)';
    ELSIF v_final >= 4.0 THEN v_label := 'يتجاوز التوقعات (Exceeds Expectations)';
    ELSIF v_final >= 3.0 THEN v_label := 'مطابق للتوقعات (Meets Expectations)';
    ELSIF v_final >= 2.0 THEN v_label := 'يحتاج تطوير (Needs Improvement)';
    ELSE v_label := 'أداء غير مرضي (Unsatisfactory)';
    END IF;

    UPDATE public.performance_cycle_participants
    SET final_score = v_final,
        final_overall_score = v_final,
        rating_label = v_label,
        final_rating_label = v_label,
        status = 'completed',
        is_locked = true,
        locked_at = now()
    WHERE id = v_participant.id;
  END LOOP;

  -- Finalize cycle
  UPDATE public.performance_cycles
  SET status = 'finalized',
      is_locked = true,
      finalization_date = CURRENT_DATE,
      completion_rate = 100.00,
      updated_at = now()
  WHERE id = p_cycle_id;

  INSERT INTO public.performance_audit_logs (
    company_id,
    cycle_id,
    action,
    actor_id,
    notes
  ) VALUES (
    COALESCE(v_cycle.company_id, public.current_company_id()),
    p_cycle_id,
    'cycle_finalized',
    COALESCE(v_caller_uid, '00000000-0000-0000-0000-000000000000'::uuid),
    'تم إغلاق دورة تقييم الأداء نهائياً وتجميد نتائج ودرجات كافة الموظفين'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'cycle_id', p_cycle_id,
    'status', 'finalized',
    'finalized_count', v_count
  );
END;
$$;

-- ============================================================================
-- STEP 11: ATOMIC RPC - GET REAL SERVER PERFORMANCE KPIS & 9-BOX
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_performance_kpis_atomic(
  p_cycle_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_cycle_id uuid;
  v_total_participants integer := 0;
  v_completed_reviews integer := 0;
  v_pending_reviews integer := 0;
  v_completion_rate numeric(5,2) := 0;
  v_avg_score numeric(4,2) := 0;
  v_nine_box_counts jsonb;
  v_rating_distribution jsonb;
BEGIN
  v_company_id := COALESCE(p_company_id, public.current_company_id());
  v_cycle_id := p_cycle_id;

  IF v_cycle_id IS NULL THEN
    SELECT id INTO v_cycle_id
    FROM public.performance_cycles
    WHERE (v_company_id IS NULL OR company_id = v_company_id)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- 1. Total Participants
  SELECT COUNT(*) INTO v_total_participants
  FROM public.performance_cycle_participants
  WHERE (v_cycle_id IS NULL OR cycle_id = v_cycle_id);

  -- 2. Review Assignments completion
  SELECT
    COUNT(*) FILTER (WHERE status = 'submitted'),
    COUNT(*) FILTER (WHERE status != 'submitted')
  INTO
    v_completed_reviews,
    v_pending_reviews
  FROM public.performance_review_assignments
  WHERE (v_cycle_id IS NULL OR cycle_id = v_cycle_id);

  IF (v_completed_reviews + v_pending_reviews) > 0 THEN
    v_completion_rate := ROUND((v_completed_reviews::numeric / (v_completed_reviews + v_pending_reviews)::numeric) * 100.0, 1);
  END IF;

  -- 3. Average Score
  SELECT COALESCE(ROUND(AVG(COALESCE(calibrated_score, final_score)), 2), 0) INTO v_avg_score
  FROM public.performance_cycle_participants
  WHERE (v_cycle_id IS NULL OR cycle_id = v_cycle_id)
    AND (calibrated_score IS NOT NULL OR final_score IS NOT NULL);

  -- 4. Nine Box Real Counts (supports both grid cell keys 1A-3C and descriptive titles)
  SELECT jsonb_build_object(
    '1A', COUNT(*) FILTER (WHERE nine_box_cell = '1A' OR nine_box_cell = 'future_leader'),
    '1B', COUNT(*) FILTER (WHERE nine_box_cell = '1B' OR nine_box_cell = 'high_performer'),
    '1C', COUNT(*) FILTER (WHERE nine_box_cell = '1C' OR nine_box_cell = 'solid_professional'),
    '2A', COUNT(*) FILTER (WHERE nine_box_cell = '2A' OR nine_box_cell = 'emerging_talent'),
    '2B', COUNT(*) FILTER (WHERE nine_box_cell = '2B' OR nine_box_cell = 'core_player'),
    '2C', COUNT(*) FILTER (WHERE nine_box_cell = '2C' OR nine_box_cell = 'effective_contributor'),
    '3A', COUNT(*) FILTER (WHERE nine_box_cell = '3A' OR nine_box_cell = 'enigma'),
    '3B', COUNT(*) FILTER (WHERE nine_box_cell = '3B' OR nine_box_cell = 'dilemma'),
    '3C', COUNT(*) FILTER (WHERE nine_box_cell = '3C' OR nine_box_cell = 'action_plan'),
    'future_leader', COUNT(*) FILTER (WHERE nine_box_cell = '1A' OR nine_box_cell = 'future_leader'),
    'high_performer', COUNT(*) FILTER (WHERE nine_box_cell = '1B' OR nine_box_cell = 'high_performer'),
    'solid_professional', COUNT(*) FILTER (WHERE nine_box_cell = '1C' OR nine_box_cell = 'solid_professional'),
    'emerging_talent', COUNT(*) FILTER (WHERE nine_box_cell = '2A' OR nine_box_cell = 'emerging_talent'),
    'core_player', COUNT(*) FILTER (WHERE nine_box_cell = '2B' OR nine_box_cell = 'core_player'),
    'effective_contributor', COUNT(*) FILTER (WHERE nine_box_cell = '2C' OR nine_box_cell = 'effective_contributor'),
    'enigma', COUNT(*) FILTER (WHERE nine_box_cell = '3A' OR nine_box_cell = 'enigma'),
    'dilemma', COUNT(*) FILTER (WHERE nine_box_cell = '3B' OR nine_box_cell = 'dilemma'),
    'action_plan', COUNT(*) FILTER (WHERE nine_box_cell = '3C' OR nine_box_cell = 'action_plan')
  ) INTO v_nine_box_counts
  FROM public.performance_cycle_participants
  WHERE (v_cycle_id IS NULL OR cycle_id = v_cycle_id);

  -- 5. Score Distribution
  SELECT jsonb_build_object(
    'exceptional', COUNT(*) FILTER (WHERE COALESCE(calibrated_score, final_score) >= 4.8),
    'exceeds', COUNT(*) FILTER (WHERE COALESCE(calibrated_score, final_score) >= 4.0 AND COALESCE(calibrated_score, final_score) < 4.8),
    'meets', COUNT(*) FILTER (WHERE COALESCE(calibrated_score, final_score) >= 3.0 AND COALESCE(calibrated_score, final_score) < 4.0),
    'needs_improvement', COUNT(*) FILTER (WHERE COALESCE(calibrated_score, final_score) >= 2.0 AND COALESCE(calibrated_score, final_score) < 3.0),
    'unsatisfactory', COUNT(*) FILTER (WHERE COALESCE(calibrated_score, final_score) < 2.0 AND COALESCE(calibrated_score, final_score) IS NOT NULL)
  ) INTO v_rating_distribution
  FROM public.performance_cycle_participants
  WHERE (v_cycle_id IS NULL OR cycle_id = v_cycle_id);

  RETURN jsonb_build_object(
    'cycle_id', v_cycle_id,
    'cycleId', v_cycle_id,
    'total_participants', v_total_participants,
    'totalParticipants', v_total_participants,
    'completed_reviews', v_completed_reviews,
    'completedReviews', v_completed_reviews,
    'pending_reviews', v_pending_reviews,
    'pendingReviews', v_pending_reviews,
    'completion_rate', v_completion_rate,
    'completionRate', v_completion_rate,
    'overall_completion_rate', v_completion_rate,
    'average_score', v_avg_score,
    'averageScore', v_avg_score,
    'nine_box_distribution', v_nine_box_counts,
    'nineBoxDistribution', v_nine_box_counts,
    'nineBoxCounts', v_nine_box_counts,
    'rating_distribution', v_rating_distribution,
    'ratingDistribution', v_rating_distribution
  );
END;
$$;
