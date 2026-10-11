-- ============================================================================
-- MADARX ENTERPRISE WORKFORCE PLATFORM
-- PROMPT 30: PRODUCTION CAREER, TALENT, SUCCESSION & INTERNAL MOBILITY ENGINE
-- Migration: 20261012000000_production_talent_career_succession_internal_mobility.sql
-- ============================================================================

-- 1. Career Paths & Architecture
CREATE TABLE IF NOT EXISTS public.career_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description_ar text,
  description_en text,
  path_type text NOT NULL CHECK (path_type IN ('vertical', 'lateral', 'cross_functional', 'leadership', 'specialist')),
  job_family text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_career_paths_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_career_paths_company ON public.career_paths (company_id, status);

-- 2. Career Path Steps (Milestones & Transition Criteria)
CREATE TABLE IF NOT EXISTS public.career_path_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_path_id uuid NOT NULL REFERENCES public.career_paths(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  job_title_ar text NOT NULL,
  job_title_en text NOT NULL,
  target_grade text,
  min_tenure_months integer DEFAULT 12,
  required_performance_rating numeric(3,1) DEFAULT 3.0,
  skills_required jsonb DEFAULT '[]'::jsonb, -- Array of { skill_id: uuid, required_proficiency: number }
  certifications_required jsonb DEFAULT '[]'::jsonb, -- Array of { certification_id: uuid }
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_career_step_order UNIQUE (career_path_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_career_steps_path ON public.career_path_steps (career_path_id, step_order);

-- 3. Employee Career Preferences & Aspirations (ESS Permitted)
CREATE TABLE IF NOT EXISTS public.employee_career_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  target_job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  target_job_family text,
  target_job_title_ar text,
  career_interests text,
  development_interests text,
  preferred_location text,
  willing_to_relocate boolean NOT NULL DEFAULT false,
  international_mobility boolean NOT NULL DEFAULT false,
  is_confidential_from_manager boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_emp_career_pref UNIQUE (company_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_emp_career_pref_emp ON public.employee_career_preferences (company_id, employee_id);

-- 4. Career Target Roles
CREATE TABLE IF NOT EXISTS public.career_target_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  job_position_id uuid NOT NULL REFERENCES public.job_positions(id) ON DELETE CASCADE,
  target_readiness text NOT NULL DEFAULT 'development_required' CHECK (target_readiness IN (
    'ready', 'near_ready', 'development_required', 'not_ready'
  )),
  target_date date,
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_emp_target_role UNIQUE (company_id, employee_id, job_position_id)
);

CREATE INDEX IF NOT EXISTS idx_target_roles_emp ON public.career_target_roles (company_id, employee_id, status);

-- 5. Talent Review Cycles
CREATE TABLE IF NOT EXISTS public.talent_review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  year integer NOT NULL DEFAULT extract(year from current_date)::integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'calibration', 'finalized', 'closed')),
  guidelines text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_talent_review_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_talent_cycles_company ON public.talent_review_cycles (company_id, status);

-- 6. Talent Assessments (9-Box Grid, Potential & Calibration)
CREATE TABLE IF NOT EXISTS public.talent_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.talent_review_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assessor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performance_rating text NOT NULL DEFAULT 'medium' CHECK (performance_rating IN ('low', 'medium', 'high')),
  potential_rating text NOT NULL DEFAULT 'medium' CHECK (potential_rating IN ('low', 'medium', 'high')),
  nine_box_cell text NOT NULL DEFAULT '2B', -- 1A: Star, 1B: High Performer, 2A: High Potential, 2B: Core Player, etc.
  calibrated_performance_rating text CHECK (calibrated_performance_rating IN ('low', 'medium', 'high')),
  calibrated_potential_rating text CHECK (calibrated_potential_rating IN ('low', 'medium', 'high')),
  calibrated_nine_box_cell text,
  calibration_notes text,
  calibrated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  calibrated_at timestamptz,
  retention_risk text NOT NULL DEFAULT 'low' CHECK (retention_risk IN ('low', 'medium', 'high', 'critical')),
  retention_risk_reason text,
  critical_talent_flag boolean NOT NULL DEFAULT false,
  readiness_for_promotion text NOT NULL DEFAULT 'ready_1_year' CHECK (readiness_for_promotion IN (
    'ready_now', 'ready_1_year', 'ready_2_years', 'not_ready'
  )),
  is_confidential boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'calibrated', 'finalized')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_talent_assessment UNIQUE (company_id, cycle_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_talent_assessments_cycle ON public.talent_assessments (company_id, cycle_id, status);
CREATE INDEX IF NOT EXISTS idx_talent_assessments_emp ON public.talent_assessments (company_id, employee_id);

-- 7. Enterprise Talent Pools
CREATE TABLE IF NOT EXISTS public.talent_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  pool_type text NOT NULL CHECK (pool_type IN ('leadership', 'technical', 'high_potential', 'future_managers', 'critical_operations')),
  owner_role text DEFAULT 'hr',
  is_confidential boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_talent_pools_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_talent_pools_company ON public.talent_pools (company_id, is_active);

-- 8. Talent Pool Membership (Effective-Dated)
CREATE TABLE IF NOT EXISTS public.talent_pool_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_pool_id uuid NOT NULL REFERENCES public.talent_pools(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  exit_date date,
  nomination_source text NOT NULL DEFAULT 'manual_nomination' CHECK (nomination_source IN (
    'manual_nomination', 'assessment_cycle', 'calibration', 'leadership_review', 'manager_recommendation'
  )),
  nominated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'removed', 'on_hold')),
  reason text,
  development_focus text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pool_member UNIQUE (talent_pool_id, employee_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_pool_members_pool ON public.talent_pool_members (talent_pool_id, status);
CREATE INDEX IF NOT EXISTS idx_pool_members_emp ON public.talent_pool_members (company_id, employee_id, status);

-- 9. Critical Roles & Dependency Analysis
CREATE TABLE IF NOT EXISTS public.critical_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_position_id uuid NOT NULL REFERENCES public.job_positions(id) ON DELETE CASCADE,
  criticality_tier text NOT NULL CHECK (criticality_tier IN (
    'business_critical', 'leadership_critical', 'hard_to_fill', 'operational_critical'
  )),
  vacancy_risk text NOT NULL DEFAULT 'medium' CHECK (vacancy_risk IN ('low', 'medium', 'high', 'critical')),
  impact_of_loss text,
  key_person_dependency_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_critical_role_pos UNIQUE (company_id, job_position_id)
);

CREATE INDEX IF NOT EXISTS idx_critical_roles_company ON public.critical_roles (company_id, is_active);

-- 10. Succession Plans
CREATE TABLE IF NOT EXISTS public.succession_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  critical_role_id uuid REFERENCES public.critical_roles(id) ON DELETE CASCADE,
  job_position_id uuid NOT NULL REFERENCES public.job_positions(id) ON DELETE CASCADE,
  incumbent_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'under_review', 'executed', 'archived')),
  target_fill_urgency text NOT NULL DEFAULT 'within_1_year' CHECK (target_fill_urgency IN (
    'immediate', 'within_6_months', 'within_1_year', 'long_term'
  )),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_succession_pos UNIQUE (company_id, job_position_id)
);

CREATE INDEX IF NOT EXISTS idx_succession_company ON public.succession_plans (company_id, status);

-- 11. Succession Candidates (Ranked & Readiness Assessed)
CREATE TABLE IF NOT EXISTS public.succession_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  succession_plan_id uuid NOT NULL REFERENCES public.succession_plans(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  readiness_timeline text NOT NULL DEFAULT 'ready_1_year' CHECK (readiness_timeline IN (
    'ready_now', 'ready_1_year', 'ready_2_years', 'ready_2_plus_years', 'not_ready'
  )),
  ranking integer NOT NULL DEFAULT 1 CHECK (ranking >= 1 AND ranking <= 10),
  nomination_reason text,
  retention_risk text NOT NULL DEFAULT 'low' CHECK (retention_risk IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'nominated' CHECK (status IN (
    'nominated', 'approved', 'in_development', 'promoted', 'withdrawn'
  )),
  is_emergency_successor boolean NOT NULL DEFAULT false,
  development_gap_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_succ_candidate UNIQUE (succession_plan_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_succ_candidates_plan ON public.succession_candidates (succession_plan_id, status);
CREATE INDEX IF NOT EXISTS idx_succ_candidates_emp ON public.succession_candidates (company_id, employee_id);

-- 12. Talent Development Actions (Integrated across Learning & Performance)
CREATE TABLE IF NOT EXISTS public.talent_development_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN (
    'learning_course', 'mentoring', 'stretch_assignment', 'temporary_assignment', 'certification', 'project_exposure', 'coaching'
  )),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  target_completion_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'in_progress', 'completed', 'cancelled', 'overdue'
  )),
  source_context text NOT NULL DEFAULT 'career_gap' CHECK (source_context IN (
    'career_gap', 'succession_readiness', 'talent_review', 'aspiration', 'performance_idp'
  )),
  source_reference_id uuid, -- Reference to succession_candidate_id, career_target_role_id, etc.
  learning_item_id uuid REFERENCES public.learning_items(id) ON DELETE SET NULL,
  temporary_assignment_id uuid,
  completion_evidence text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_talent_actions_emp ON public.talent_development_actions (company_id, employee_id, status);

-- 13. Internal Opportunities (Job Marketplace & Mobility)
CREATE TABLE IF NOT EXISTS public.internal_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opportunity_type text NOT NULL CHECK (opportunity_type IN (
    'open_position', 'temporary_assignment', 'project_assignment', 'developmental_secondment'
  )),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  work_location_id uuid,
  target_grade text,
  duration_months integer, -- For temporary/secondment
  description_ar text,
  description_en text,
  required_skills jsonb DEFAULT '[]'::jsonb, -- Array of { skill_id: uuid, required_proficiency: number }
  required_experience_years numeric(3,1) DEFAULT 1.0,
  min_tenure_months_required integer DEFAULT 6,
  application_deadline date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed', 'filled', 'cancelled')),
  requisition_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_opps_company ON public.internal_opportunities (company_id, status);

-- 14. Internal Applications
CREATE TABLE IF NOT EXISTS public.internal_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.internal_opportunities(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  current_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  current_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'screening', 'shortlisted', 'interviewing', 'selected', 'rejected', 'withdrawn'
  )),
  is_manager_notified boolean NOT NULL DEFAULT false,
  match_score numeric(5,2) DEFAULT 0.00,
  match_reasons jsonb DEFAULT '[]'::jsonb,
  applied_at timestamptz NOT NULL DEFAULT now(),
  selected_at timestamptz,
  movement_id uuid, -- Links to employee_movements upon selection!
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_int_app UNIQUE (opportunity_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_int_apps_opp ON public.internal_applications (opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_int_apps_emp ON public.internal_applications (company_id, employee_id);

-- 15. Mentoring Relationships
CREATE TABLE IF NOT EXISTS public.mentoring_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  mentor_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  mentee_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  objective_ar text NOT NULL,
  objective_en text,
  focus_areas text,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'terminated')),
  confidential_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_diff_mentor_mentee CHECK (mentor_employee_id != mentee_employee_id)
);

CREATE INDEX IF NOT EXISTS idx_mentoring_company ON public.mentoring_relationships (company_id, status);
CREATE INDEX IF NOT EXISTS idx_mentoring_mentee ON public.mentoring_relationships (company_id, mentee_employee_id);

-- 16. Career Conversations
CREATE TABLE IF NOT EXISTS public.career_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  manager_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  conversation_date date NOT NULL DEFAULT current_date,
  career_goals_discussed text,
  development_priorities_agreed text,
  target_roles_discussed text,
  agreed_actions text,
  confidential_manager_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_conv_emp ON public.career_conversations (company_id, employee_id);

-- ============================================================================
-- 17. ATOMIC BUSINESS STORED PROCEDURES (RPCS)
-- ============================================================================

-- A. Calculate Career Readiness & Skill Gaps Atomic
CREATE OR REPLACE FUNCTION public.calculate_career_readiness_and_gaps_atomic(
  p_company_id uuid,
  p_employee_id uuid,
  p_target_position_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_pos public.job_positions%ROWTYPE;
  v_req record;
  v_val_prof numeric(3,1);
  v_skill_gap numeric(3,1);
  v_total_skills integer := 0;
  v_matched_skills integer := 0;
  v_missing_skills jsonb := '[]'::jsonb;
  v_gaps jsonb := '[]'::jsonb;
  v_readiness text := 'ready';
  v_score numeric(5,2) := 100.00;
BEGIN
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  SELECT * INTO v_pos FROM public.job_positions WHERE id = p_target_position_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target position not found');
  END IF;

  -- Iterate through skill requirements of the target position
  FOR v_req IN
    SELECT r.skill_id, s.name_ar, s.name_en, s.code, r.required_proficiency, r.is_mandatory
    FROM public.job_skill_requirements r
    JOIN public.skills s ON s.id = r.skill_id
    WHERE r.company_id = p_company_id AND r.job_position_id = p_target_position_id
  LOOP
    v_total_skills := v_total_skills + 1;

    SELECT current_proficiency INTO v_val_prof
    FROM public.employee_skills
    WHERE company_id = p_company_id AND employee_id = p_employee_id AND skill_id = v_req.skill_id;

    v_val_prof := COALESCE(v_val_prof, 0.0);
    v_skill_gap := GREATEST(0.0, v_req.required_proficiency - v_val_prof);

    IF v_skill_gap = 0.0 THEN
      v_matched_skills := v_matched_skills + 1;
    ELSE
      v_missing_skills := v_missing_skills || jsonb_build_object(
        'skill_id', v_req.skill_id,
        'skill_code', v_req.code,
        'name_ar', v_req.name_ar,
        'required', v_req.required_proficiency,
        'current', v_val_prof,
        'gap', v_skill_gap
      );
    END IF;

    v_gaps := v_gaps || jsonb_build_object(
      'skill_id', v_req.skill_id,
      'code', v_req.code,
      'name_ar', v_req.name_ar,
      'required', v_req.required_proficiency,
      'validated', v_val_prof,
      'gap', v_skill_gap,
      'has_gap', (v_skill_gap > 0)
    );
  END LOOP;

  -- Determine readiness truthfully based on gaps
  IF v_total_skills > 0 THEN
    v_score := ROUND((v_matched_skills::numeric / v_total_skills::numeric) * 100.0, 2);
    IF v_matched_skills = v_total_skills THEN
      v_readiness := 'ready';
    ELSIF v_score >= 70.0 THEN
      v_readiness := 'near_ready';
    ELSIF v_score >= 40.0 THEN
      v_readiness := 'development_required';
    ELSE
      v_readiness := 'not_ready';
    END IF;
  ELSE
    v_readiness := 'ready';
    v_score := 100.00;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'employee_id', p_employee_id,
    'target_position_id', p_target_position_id,
    'readiness', v_readiness,
    'match_score', v_score,
    'total_skills_required', v_total_skills,
    'matched_skills_count', v_matched_skills,
    'missing_skills', v_missing_skills,
    'gaps', v_gaps
  );
END;
$$;

-- B. Assess and Calibrate Talent Atomic (9-Box Grid)
CREATE OR REPLACE FUNCTION public.assess_and_calibrate_talent_atomic(
  p_company_id uuid,
  p_cycle_id uuid,
  p_employee_id uuid,
  p_performance_rating text,
  p_potential_rating text,
  p_assessor_id uuid,
  p_is_calibration boolean DEFAULT false,
  p_notes text DEFAULT NULL,
  p_retention_risk text DEFAULT 'low',
  p_readiness text DEFAULT 'ready_1_year'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cell text;
  v_assessment_id uuid;
BEGIN
  -- Determine 9-Box Cell deterministically:
  -- High Perf (1), Med Perf (2), Low Perf (3)
  -- High Pot (A), Med Pot (B), Low Pot (C)
  IF p_performance_rating = 'high' AND p_potential_rating = 'high' THEN v_cell := '1A'; -- Star
  ELSIF p_performance_rating = 'high' AND p_potential_rating = 'medium' THEN v_cell := '1B'; -- High Performer
  ELSIF p_performance_rating = 'high' AND p_potential_rating = 'low' THEN v_cell := '1C'; -- Solid Professional
  ELSIF p_performance_rating = 'medium' AND p_potential_rating = 'high' THEN v_cell := '2A'; -- High Potential
  ELSIF p_performance_rating = 'medium' AND p_potential_rating = 'medium' THEN v_cell := '2B'; -- Core Player
  ELSIF p_performance_rating = 'medium' AND p_potential_rating = 'low' THEN v_cell := '2C'; -- Effective
  ELSIF p_performance_rating = 'low' AND p_potential_rating = 'high' THEN v_cell := '3A'; -- Enigma
  ELSIF p_performance_rating = 'low' AND p_potential_rating = 'medium' THEN v_cell := '3B'; -- Dilemma
  ELSE v_cell := '3C'; -- Underperformer / Risk
  END IF;

  IF p_is_calibration THEN
    -- Update calibrated values preserving initial ratings
    UPDATE public.talent_assessments
    SET calibrated_performance_rating = p_performance_rating,
        calibrated_potential_rating = p_potential_rating,
        calibrated_nine_box_cell = v_cell,
        calibration_notes = p_notes,
        calibrated_by = p_assessor_id,
        calibrated_at = now(),
        status = 'calibrated',
        retention_risk = p_retention_risk,
        readiness_for_promotion = p_readiness,
        updated_at = now()
    WHERE company_id = p_company_id AND cycle_id = p_cycle_id AND employee_id = p_employee_id
    RETURNING id INTO v_assessment_id;
  ELSE
    -- Initial assessment insertion/update
    INSERT INTO public.talent_assessments (
      company_id, cycle_id, employee_id, assessor_id,
      performance_rating, potential_rating, nine_box_cell,
      retention_risk, readiness_for_promotion, status, created_at, updated_at
    ) VALUES (
      p_company_id, p_cycle_id, p_employee_id, p_assessor_id,
      p_performance_rating, p_potential_rating, v_cell,
      p_retention_risk, p_readiness, 'submitted', now(), now()
    )
    ON CONFLICT (company_id, cycle_id, employee_id)
    DO UPDATE SET
      performance_rating = EXCLUDED.performance_rating,
      potential_rating = EXCLUDED.potential_rating,
      nine_box_cell = EXCLUDED.nine_box_cell,
      assessor_id = EXCLUDED.assessor_id,
      retention_risk = EXCLUDED.retention_risk,
      readiness_for_promotion = EXCLUDED.readiness_for_promotion,
      updated_at = now()
    RETURNING id INTO v_assessment_id;
  END IF;

  -- Audit entry
  INSERT INTO public.audit_events (
    company_id, action, entity_type, entity_id, entity_name, changes_summary, severity
  ) VALUES (
    p_company_id,
    CASE WHEN p_is_calibration THEN 'talent.calibrated' ELSE 'talent.assessed' END,
    'talent_assessment',
    v_assessment_id::text,
    'Employee Talent Assessment',
    '9-Box cell updated to: ' || v_cell || ' (Perf: ' || p_performance_rating || ', Pot: ' || p_potential_rating || ')',
    'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'assessment_id', v_assessment_id,
    'nine_box_cell', v_cell,
    'performance_rating', p_performance_rating,
    'potential_rating', p_potential_rating
  );
END;
$$;

-- C. Nominate Succession Candidate Atomic
CREATE OR REPLACE FUNCTION public.nominate_succession_candidate_atomic(
  p_company_id uuid,
  p_plan_id uuid,
  p_employee_id uuid,
  p_readiness text DEFAULT 'ready_1_year',
  p_ranking integer DEFAULT 1,
  p_nominator_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_is_emergency boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_candidate_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.succession_candidates
    WHERE succession_plan_id = p_plan_id AND employee_id = p_employee_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee is already nominated for this succession plan');
  END IF;

  INSERT INTO public.succession_candidates (
    succession_plan_id, company_id, employee_id, readiness_timeline,
    ranking, nomination_reason, is_emergency_successor, status
  ) VALUES (
    p_plan_id, p_company_id, p_employee_id, p_readiness,
    p_ranking, p_reason, p_is_emergency, 'approved'
  ) RETURNING id INTO v_candidate_id;

  INSERT INTO public.audit_events (
    company_id, action, entity_type, entity_id, entity_name, changes_summary, severity
  ) VALUES (
    p_company_id, 'succession.nominated', 'succession_candidate', v_candidate_id::text,
    'Successor Nominated', 'Nominated with readiness: ' || p_readiness || ' and ranking: ' || p_ranking, 'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'candidate_id', v_candidate_id,
    'readiness', p_readiness,
    'ranking', p_ranking
  );
END;
$$;

-- D. Match Internal Opportunity Deterministically
CREATE OR REPLACE FUNCTION public.match_internal_opportunity_atomic(
  p_company_id uuid,
  p_opportunity_id uuid,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_opp public.internal_opportunities%ROWTYPE;
  v_emp public.employees%ROWTYPE;
  v_pref public.employee_career_preferences%ROWTYPE;
  v_explanations text[] := ARRAY[]::text[];
  v_score numeric(5,2) := 100.00;
  v_tenure_months integer;
  v_eligible boolean := true;
BEGIN
  SELECT * INTO v_opp FROM public.internal_opportunities WHERE id = p_opportunity_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opportunity not found');
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- 1. Tenure check
  v_tenure_months := ROUND(EXTRACT(epoch FROM (now() - v_emp.hire_date::timestamp)) / (30.4375 * 86400));
  IF v_tenure_months < v_opp.min_tenure_months_required THEN
    v_eligible := false;
    v_score := v_score - 30.0;
    v_explanations := array_append(v_explanations, 'مدة الخدمة الحالية (' || v_tenure_months || ' شهر) أقل من الحد الأدنى المطلوب (' || v_opp.min_tenure_months_required || ' شهر)');
  ELSE
    v_explanations := array_append(v_explanations, 'مدة الخدمة الحالية مستوفية للشروط المطلوبة');
  END IF;

  -- 2. Grade compatibility
  IF v_opp.target_grade IS NOT NULL AND v_emp.grade IS NOT NULL THEN
    IF v_opp.target_grade = v_emp.grade THEN
      v_explanations := array_append(v_explanations, 'المرتبة الوظيفية الحالية متطابقة مع المرتبة المستهدفة (' || v_opp.target_grade || ')');
    ELSE
      v_explanations := array_append(v_explanations, 'المرتبة الوظيفية الحالية (' || v_emp.grade || ') متوافقة مع مسار الترقية للمرتبة (' || v_opp.target_grade || ')');
    END IF;
  END IF;

  -- 3. Career Aspiration match
  SELECT * INTO v_pref FROM public.employee_career_preferences WHERE employee_id = p_employee_id AND company_id = p_company_id;
  IF FOUND AND v_pref.target_job_position_id = v_opp.job_position_id THEN
    v_explanations := array_append(v_explanations, 'تطابق تام مع الطموح المهني المحدد في ملف الموظف الشخصي');
  END IF;

  v_score := GREATEST(0.00, LEAST(100.00, v_score));

  RETURN jsonb_build_object(
    'success', true,
    'eligible', v_eligible,
    'match_score', v_score,
    'match_reasons', to_jsonb(v_explanations)
  );
END;
$$;

-- E. Apply for Internal Opportunity Atomic
CREATE OR REPLACE FUNCTION public.apply_for_internal_opportunity_atomic(
  p_company_id uuid,
  p_opportunity_id uuid,
  p_employee_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_opp public.internal_opportunities%ROWTYPE;
  v_emp public.employees%ROWTYPE;
  v_match jsonb;
  v_app_id uuid;
BEGIN
  SELECT * INTO v_opp FROM public.internal_opportunities WHERE id = p_opportunity_id AND company_id = p_company_id;
  IF NOT FOUND OR v_opp.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opportunity is not open for internal applications');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.internal_applications
    WHERE opportunity_id = p_opportunity_id AND employee_id = p_employee_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee has already applied for this opportunity');
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id AND company_id = p_company_id;

  -- Calculate match score
  v_match := public.match_internal_opportunity_atomic(p_company_id, p_opportunity_id, p_employee_id);

  INSERT INTO public.internal_applications (
    company_id, opportunity_id, employee_id, current_department_id,
    current_position_id, status, match_score, match_reasons, notes, applied_at
  ) VALUES (
    p_company_id, p_opportunity_id, p_employee_id, v_emp.department_id,
    v_emp.job_position_id, 'submitted', (v_match->>'match_score')::numeric,
    COALESCE(v_match->'match_reasons', '[]'::jsonb), p_notes, now()
  ) RETURNING id INTO v_app_id;

  INSERT INTO public.audit_events (
    company_id, action, entity_type, entity_id, entity_name, changes_summary, severity
  ) VALUES (
    p_company_id, 'internal_mobility.applied', 'internal_application', v_app_id::text,
    'Internal Application Submitted', 'Employee applied for internal opportunity: ' || v_opp.title_ar, 'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_app_id,
    'match_score', (v_match->>'match_score')::numeric
  );
END;
$$;

-- F. Select Internal Candidate and Initiate Lifecycle Movement Atomic (Prompt 28 Integration)
CREATE OR REPLACE FUNCTION public.select_internal_candidate_and_initiate_movement_atomic(
  p_company_id uuid,
  p_application_id uuid,
  p_movement_type text, -- 'promotion', 'transfer', 'job_change', etc.
  p_effective_date date,
  p_initiator_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_app public.internal_applications%ROWTYPE;
  v_opp public.internal_opportunities%ROWTYPE;
  v_movement_id uuid;
  v_mov_number text;
BEGIN
  SELECT * INTO v_app FROM public.internal_applications WHERE id = p_application_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Internal application record not found');
  END IF;

  SELECT * INTO v_opp FROM public.internal_opportunities WHERE id = v_app.opportunity_id;

  v_mov_number := 'MOV-' || to_char(now(), 'YYYY') || '-' || lpad(floor(random()*1000000)::text, 6, '0');

  -- Create approved movement in employee_movements table from Prompt 28
  INSERT INTO public.employee_movements (
    company_id, movement_number, employee_id, movement_type,
    effective_date, reason, status, requested_by, approved_at, approved_by, created_at, updated_at
  ) VALUES (
    p_company_id, v_mov_number, v_app.employee_id, p_movement_type,
    p_effective_date, 'تعيين داخلي بموجب فرصة التنقل الوظيفي: ' || v_opp.title_ar,
    'scheduled', p_initiator_id, now(), p_initiator_id, now(), now()
  ) RETURNING id INTO v_movement_id;

  -- Update application with selection status and movement linkage
  UPDATE public.internal_applications
  SET status = 'selected',
      selected_at = now(),
      movement_id = v_movement_id,
      updated_at = now()
  WHERE id = v_app.id;

  -- Update opportunity status
  UPDATE public.internal_opportunities
  SET status = 'filled', updated_at = now()
  WHERE id = v_opp.id;

  INSERT INTO public.audit_events (
    company_id, action, entity_type, entity_id, entity_name, changes_summary, severity
  ) VALUES (
    p_company_id, 'internal_mobility.selected', 'internal_application', v_app.id::text,
    'Internal Candidate Selected', 'Candidate selected and movement request ' || v_mov_number || ' generated', 'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_app.id,
    'movement_id', v_movement_id,
    'movement_number', v_mov_number
  );
END;
$$;

-- G. Truthful Talent & Succession KPIs Atomic
CREATE OR REPLACE FUNCTION public.get_talent_kpis_atomic(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_critical_roles_count integer := 0;
  v_roles_without_successor integer := 0;
  v_ready_now_successors_count integer := 0;
  v_succession_coverage_rate numeric(5,2) := 0.00;
  v_bench_strength_rate numeric(5,2) := 0.00;
  v_high_potential_count integer := 0;
  v_active_internal_opps integer := 0;
  v_internal_applications integer := 0;
  v_active_talent_pools integer := 0;
  v_overdue_actions integer := 0;
  v_roles_with_any_successor integer := 0;
  v_roles_with_ready_successor integer := 0;
BEGIN
  -- 1. Critical roles count
  SELECT COUNT(*) INTO v_critical_roles_count
  FROM public.critical_roles
  WHERE company_id = p_company_id AND is_active = true;

  -- 2. Successors analysis
  SELECT 
    COUNT(DISTINCT sp.job_position_id) FILTER (WHERE sc.id IS NOT NULL),
    COUNT(DISTINCT sp.job_position_id) FILTER (WHERE sc.readiness_timeline = 'ready_now'),
    COUNT(sc.id) FILTER (WHERE sc.readiness_timeline = 'ready_now')
  INTO 
    v_roles_with_any_successor,
    v_roles_with_ready_successor,
    v_ready_now_successors_count
  FROM public.succession_plans sp
  LEFT JOIN public.succession_candidates sc ON sc.succession_plan_id = sp.id AND sc.status IN ('nominated', 'approved', 'in_development')
  WHERE sp.company_id = p_company_id AND sp.status = 'active';

  IF v_critical_roles_count > 0 THEN
    v_roles_without_successor := GREATEST(0, v_critical_roles_count - v_roles_with_any_successor);
    v_succession_coverage_rate := ROUND((v_roles_with_any_successor::numeric / v_critical_roles_count::numeric) * 100.0, 2);
    v_bench_strength_rate := ROUND((v_roles_with_ready_successor::numeric / v_critical_roles_count::numeric) * 100.0, 2);
  END IF;

  -- 3. High Potentials (from latest finalized/submitted assessments)
  SELECT COUNT(DISTINCT employee_id) INTO v_high_potential_count
  FROM public.talent_assessments
  WHERE company_id = p_company_id 
    AND (potential_rating = 'high' OR calibrated_potential_rating = 'high');

  -- 4. Internal Opportunities and Applications
  SELECT COUNT(*) INTO v_active_internal_opps
  FROM public.internal_opportunities
  WHERE company_id = p_company_id AND status = 'open';

  SELECT COUNT(*) INTO v_internal_applications
  FROM public.internal_applications
  WHERE company_id = p_company_id AND status IN ('submitted', 'screening', 'shortlisted', 'interviewing');

  -- 5. Talent Pools
  SELECT COUNT(*) INTO v_active_talent_pools
  FROM public.talent_pools
  WHERE company_id = p_company_id AND is_active = true;

  -- 6. Overdue Development Actions
  SELECT COUNT(*) INTO v_overdue_actions
  FROM public.talent_development_actions
  WHERE company_id = p_company_id 
    AND status IN ('planned', 'in_progress')
    AND target_completion_date < current_date;

  RETURN jsonb_build_object(
    'critical_roles_count', v_critical_roles_count,
    'roles_without_successor', v_roles_without_successor,
    'ready_now_successors_count', v_ready_now_successors_count,
    'succession_coverage_rate', v_succession_coverage_rate,
    'bench_strength_rate', v_bench_strength_rate,
    'high_potential_count', v_high_potential_count,
    'active_internal_opps', v_active_internal_opps,
    'internal_applications_count', v_internal_applications,
    'active_talent_pools_count', v_active_talent_pools,
    'overdue_actions_count', v_overdue_actions
  );
END;
$$;

-- ============================================================================
-- 18. ROW LEVEL SECURITY POLICIES & GRANTS
-- ============================================================================

ALTER TABLE public.career_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_path_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_career_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_target_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critical_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.succession_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.succession_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_development_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentoring_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_conversations ENABLE ROW LEVEL SECURITY;

-- Standard tenant isolation policies
DROP POLICY IF EXISTS "career_paths_isolation" ON public.career_paths;
CREATE POLICY "career_paths_isolation" ON public.career_paths FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "career_path_steps_isolation" ON public.career_path_steps;
CREATE POLICY "career_path_steps_isolation" ON public.career_path_steps FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "emp_career_pref_isolation" ON public.employee_career_preferences;
CREATE POLICY "emp_career_pref_isolation" ON public.employee_career_preferences FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "talent_assessments_isolation" ON public.talent_assessments;
CREATE POLICY "talent_assessments_isolation" ON public.talent_assessments FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "talent_pools_isolation" ON public.talent_pools;
CREATE POLICY "talent_pools_isolation" ON public.talent_pools FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "succession_plans_isolation" ON public.succession_plans;
CREATE POLICY "succession_plans_isolation" ON public.succession_plans FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "internal_opps_isolation" ON public.internal_opportunities;
CREATE POLICY "internal_opps_isolation" ON public.internal_opportunities FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "internal_apps_isolation" ON public.internal_applications;
CREATE POLICY "internal_apps_isolation" ON public.internal_applications FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

GRANT SELECT, INSERT, UPDATE ON public.career_paths TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.career_path_steps TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.employee_career_preferences TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.career_target_roles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.talent_review_cycles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.talent_assessments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.talent_pools TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.talent_pool_members TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.critical_roles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.succession_plans TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.succession_candidates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.talent_development_actions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.internal_opportunities TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.internal_applications TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.mentoring_relationships TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.career_conversations TO authenticated, service_role;
