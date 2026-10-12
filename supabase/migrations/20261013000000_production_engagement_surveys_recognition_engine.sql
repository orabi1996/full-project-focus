-- ============================================================================
-- MADARX ENTERPRISE WORKFORCE PLATFORM
-- PROMPT 31: PRODUCTION EMPLOYEE ENGAGEMENT, SURVEYS, PULSE & RECOGNITION ENGINE
-- Migration: 20261013000000_production_engagement_surveys_recognition_engine.sql
-- ============================================================================

-- 1. Survey Templates
CREATE TABLE IF NOT EXISTS public.survey_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description_ar text,
  description_en text,
  survey_type text NOT NULL CHECK (survey_type IN (
    'engagement', 'pulse', 'enps', 'onboarding', 'probation', 'exit', 'manager_effectiveness', 'event_feedback', 'custom'
  )),
  default_anonymity_mode text NOT NULL DEFAULT 'anonymous' CHECK (default_anonymity_mode IN ('anonymous', 'identified')),
  estimated_completion_minutes integer DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  current_version_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_survey_templates_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_survey_templates_company ON public.survey_templates (company_id, is_active);

-- 2. Survey Template Versions (Immutable Historical Snapshot)
CREATE TABLE IF NOT EXISTS public.survey_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.survey_templates(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  questions_json jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of snapshot questions, scales, categories
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_template_version UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_template_versions_tpl ON public.survey_template_versions (template_id, status);

-- 3. Question Bank (Reusable Enterprise Questions)
CREATE TABLE IF NOT EXISTS public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  text_ar text NOT NULL,
  text_en text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'leadership', 'manager', 'communication', 'culture', 'recognition', 'growth',
    'learning', 'wellbeing', 'teamwork', 'work_environment', 'trust', 'purpose',
    'compensation_perception', 'employee_experience', 'general'
  )),
  question_type text NOT NULL CHECK (question_type IN (
    'single_choice', 'multiple_choice', 'likert_scale', 'numeric_scale', 'enps_0_10', 'rating', 'yes_no', 'free_text'
  )),
  scale_config jsonb DEFAULT '{"min": 1, "max": 5, "min_label_ar": "غير موافق بشدة", "max_label_ar": "موافق بشدة"}'::jsonb,
  is_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_survey_questions_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_company ON public.survey_questions (company_id, category, is_active);

-- 4. Survey Instances (Active & Past Survey Campaigns)
CREATE TABLE IF NOT EXISTS public.survey_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_version_id uuid REFERENCES public.survey_template_versions(id) ON DELETE SET NULL,
  code text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  survey_type text NOT NULL CHECK (survey_type IN (
    'engagement', 'pulse', 'enps', 'onboarding', 'probation', 'exit', 'manager_effectiveness', 'event_feedback', 'custom'
  )),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'open', 'paused', 'closed', 'cancelled', 'archived'
  )),
  launch_at timestamptz,
  close_at timestamptz,
  anonymity_mode text NOT NULL DEFAULT 'anonymous' CHECK (anonymity_mode IN ('anonymous', 'identified')),
  minimum_reporting_group_size integer NOT NULL DEFAULT 5, -- Suppression threshold!
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_survey_instances_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_survey_instances_company ON public.survey_instances (company_id, status);

-- 5. Survey Audiences (Targeting Scope Snapshot)
CREATE TABLE IF NOT EXISTS public.survey_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.survey_instances(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN (
    'all_company', 'department', 'location', 'grade', 'job_position', 'custom_group'
  )),
  target_entity_id uuid, -- Reference to department_id, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_audiences_survey ON public.survey_audiences (survey_id);

-- 6. Survey Participants (Eligibility & True Anonymity Token Engine)
CREATE TABLE IF NOT EXISTS public.survey_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.survey_instances(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  participation_status text NOT NULL DEFAULT 'eligible' CHECK (participation_status IN ('eligible', 'started', 'completed')),
  anonymity_token uuid NOT NULL DEFAULT gen_random_uuid(), -- Blinded participation check token
  invited_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  department_snapshot_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_survey_participant UNIQUE (survey_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_survey ON public.survey_participants (survey_id, participation_status);
CREATE INDEX IF NOT EXISTS idx_participants_token ON public.survey_participants (anonymity_token);
CREATE INDEX IF NOT EXISTS idx_participants_emp ON public.survey_participants (company_id, employee_id);

-- 7. Survey Responses (Immutable Submissions with Anonymity Guarantees)
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.survey_instances(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  submission_token uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL, -- NULL in anonymous mode!
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted')),
  answers jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of { question_id, question_code, category, question_type, value_numeric, value_text, choice_ids }
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL, -- For aggregate analytics
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON public.survey_responses (survey_id, status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_dept ON public.survey_responses (company_id, department_id);

-- 8. Survey Result Snapshots (Governed Analytics & Scores)
CREATE TABLE IF NOT EXISTS public.survey_result_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.survey_instances(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  eligible_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  participation_rate numeric(5,2) NOT NULL DEFAULT 0.00,
  overall_engagement_score numeric(5,2) DEFAULT 0.00,
  enps_score numeric(5,2) DEFAULT 0.00,
  promoters_count integer NOT NULL DEFAULT 0,
  passives_count integer NOT NULL DEFAULT 0,
  detractors_count integer NOT NULL DEFAULT 0,
  dimension_scores jsonb DEFAULT '{}'::jsonb, -- Key-value map of category -> avg score (0-100)
  department_scores jsonb DEFAULT '[]'::jsonb, -- Array of { department_id, name_ar, score, count, suppressed }
  calculated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_survey_snapshot UNIQUE (survey_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_snapshots_company ON public.survey_result_snapshots (company_id);

-- 9. Engagement Action Plans
CREATE TABLE IF NOT EXISTS public.engagement_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  survey_id uuid REFERENCES public.survey_instances(id) ON DELETE SET NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  dimension text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  description text,
  target_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN (
    'draft', 'planned', 'in_progress', 'completed', 'cancelled', 'overdue'
  )),
  success_measure text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_plans_company ON public.engagement_action_plans (company_id, status);

-- 10. Engagement Action Items (Action Plan Tasks)
CREATE TABLE IF NOT EXISTS public.engagement_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id uuid NOT NULL REFERENCES public.engagement_action_plans(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  assignee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_items_plan ON public.engagement_action_items (action_plan_id, status);

-- 11. Recognition Categories
CREATE TABLE IF NOT EXISTS public.recognition_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  icon_name text DEFAULT 'star',
  color text DEFAULT '#F59E0B',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_recog_category_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_recog_cat_company ON public.recognition_categories (company_id, is_active);

-- 12. Recognition Badges
CREATE TABLE IF NOT EXISTS public.recognition_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  icon_name text DEFAULT 'award',
  category_id uuid REFERENCES public.recognition_categories(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_recog_badge_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_recog_badge_company ON public.recognition_badges (company_id, is_active);

-- 13. Employee Recognitions (Peer & Manager Recognition Feed)
CREATE TABLE IF NOT EXISTS public.employee_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  recipient_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.recognition_categories(id) ON DELETE SET NULL,
  badge_id uuid REFERENCES public.recognition_badges(id) ON DELETE SET NULL,
  message text NOT NULL,
  visibility text NOT NULL DEFAULT 'company' CHECK (visibility IN ('private', 'team', 'company')),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pending_approval', 'rejected')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  points integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_diff_recog_sender_recip CHECK (sender_employee_id != recipient_employee_id)
);

CREATE INDEX IF NOT EXISTS idx_recognitions_company ON public.employee_recognitions (company_id, visibility, status);
CREATE INDEX IF NOT EXISTS idx_recognitions_recip ON public.employee_recognitions (company_id, recipient_employee_id);

-- 14. Recognition Campaigns (e.g. Employee of the Month)
CREATE TABLE IF NOT EXISTS public.recognition_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description_ar text,
  description_en text,
  campaign_type text NOT NULL CHECK (campaign_type IN (
    'employee_of_month', 'innovation_award', 'leadership_award', 'values_champion'
  )),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft', 'active', 'voting', 'closed', 'archived'
  )),
  winner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_recog_campaign_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_company ON public.recognition_campaigns (company_id, status);

-- 15. Recognition Nominations
CREATE TABLE IF NOT EXISTS public.recognition_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.recognition_campaigns(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nominee_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  nominator_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reason text NOT NULL,
  evidence_url text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'shortlisted', 'winner', 'rejected'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_campaign_nomination UNIQUE (campaign_id, nominee_employee_id, nominator_employee_id)
);

CREATE INDEX IF NOT EXISTS idx_nominations_campaign ON public.recognition_nominations (campaign_id, status);

-- ============================================================================
-- 16. ATOMIC STORED PROCEDURES (RPCS)
-- ============================================================================

-- A. Launch Survey Instance Atomic (Populates Participants & Blinds Tokens)
CREATE OR REPLACE FUNCTION public.launch_survey_instance_atomic(
  p_company_id uuid,
  p_survey_id uuid,
  p_initiator_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_survey public.survey_instances%ROWTYPE;
  v_emp record;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_survey FROM public.survey_instances
  WHERE id = p_survey_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Survey instance not found');
  END IF;

  IF v_survey.status NOT IN ('draft', 'scheduled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Survey must be in draft or scheduled state to launch');
  END IF;

  -- Resolve active employees snapshot
  FOR v_emp IN
    SELECT id, department_id FROM public.employees
    WHERE company_id = p_company_id AND status = 'active'
  LOOP
    INSERT INTO public.survey_participants (
      survey_id, company_id, employee_id, participation_status,
      anonymity_token, department_snapshot_id, invited_at
    ) VALUES (
      p_survey_id, p_company_id, v_emp.id, 'eligible',
      gen_random_uuid(), v_emp.department_id, now()
    ) ON CONFLICT (survey_id, employee_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  -- Update survey instance
  UPDATE public.survey_instances
  SET status = 'open',
      published_at = now(),
      launch_at = COALESCE(launch_at, now()),
      updated_at = now()
  WHERE id = p_survey_id;

  -- Audit event
  INSERT INTO public.audit_events (
    company_id, action, entity_type, entity_id, entity_name, changes_summary, severity
  ) VALUES (
    p_company_id, 'engagement.survey_launched', 'survey_instance', p_survey_id::text,
    v_survey.title_ar, 'Survey launched with ' || v_count || ' eligible participants snapshot', 'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'survey_id', p_survey_id,
    'eligible_count', v_count
  );
END;
$$;

-- B. Submit Survey Response Atomic (Real Anonymity Preservation & Idempotency)
CREATE OR REPLACE FUNCTION public.submit_survey_response_atomic(
  p_company_id uuid,
  p_survey_id uuid,
  p_token_or_emp_id text, -- anonymity_token (if anonymous) OR employee_id (if identified)
  p_answers jsonb,
  p_is_draft boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_survey public.survey_instances%ROWTYPE;
  v_part public.survey_participants%ROWTYPE;
  v_response_id uuid;
  v_sub_token uuid := gen_random_uuid();
  v_dept_id uuid;
BEGIN
  SELECT * INTO v_survey FROM public.survey_instances
  WHERE id = p_survey_id AND company_id = p_company_id;

  IF NOT FOUND OR v_survey.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Survey is not currently open for responses');
  END IF;

  IF v_survey.anonymity_mode = 'anonymous' THEN
    -- Verify participant by anonymity_token without linking identity to response
    SELECT * INTO v_part FROM public.survey_participants
    WHERE survey_id = p_survey_id AND anonymity_token = p_token_or_emp_id::uuid;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired survey token');
    END IF;

    IF v_part.participation_status = 'completed' AND NOT p_is_draft THEN
      RETURN jsonb_build_object('success', false, 'error', 'Survey has already been submitted');
    END IF;

    v_dept_id := v_part.department_snapshot_id;

    -- Store response with NULL employee_id!
    INSERT INTO public.survey_responses (
      survey_id, company_id, submission_token, employee_id,
      status, answers, department_id, submitted_at
    ) VALUES (
      p_survey_id, p_company_id, v_sub_token, NULL,
      CASE WHEN p_is_draft THEN 'draft' ELSE 'submitted' END,
      p_answers, v_dept_id, now()
    ) RETURNING id INTO v_response_id;

    -- Update participant record without linking which response was created
    IF NOT p_is_draft THEN
      UPDATE public.survey_participants
      SET participation_status = 'completed',
          completed_at = now()
      WHERE id = v_part.id;
    END IF;

  ELSE
    -- Identified mode: employee_id is explicitly recorded
    SELECT * INTO v_part FROM public.survey_participants
    WHERE survey_id = p_survey_id AND employee_id = p_token_or_emp_id::uuid;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Employee is not eligible for this survey');
    END IF;

    IF v_part.participation_status = 'completed' AND NOT p_is_draft THEN
      RETURN jsonb_build_object('success', false, 'error', 'Survey has already been submitted');
    END IF;

    v_dept_id := v_part.department_snapshot_id;

    INSERT INTO public.survey_responses (
      survey_id, company_id, submission_token, employee_id,
      status, answers, department_id, submitted_at
    ) VALUES (
      p_survey_id, p_company_id, v_sub_token, p_token_or_emp_id::uuid,
      CASE WHEN p_is_draft THEN 'draft' ELSE 'submitted' END,
      p_answers, v_dept_id, now()
    ) RETURNING id INTO v_response_id;

    IF NOT p_is_draft THEN
      UPDATE public.survey_participants
      SET participation_status = 'completed',
          completed_at = now()
      WHERE id = v_part.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'response_id', v_response_id,
    'is_draft', p_is_draft
  );
END;
$$;

-- C. Calculate Survey Analytics Atomic (eNPS, Dimensions, Suppression Thresholds)
CREATE OR REPLACE FUNCTION public.calculate_survey_analytics_atomic(
  p_company_id uuid,
  p_survey_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_survey public.survey_instances%ROWTYPE;
  v_eligible integer := 0;
  v_completed integer := 0;
  v_participation_rate numeric(5,2) := 0.00;
  v_promoters integer := 0;
  v_passives integer := 0;
  v_detractors integer := 0;
  v_enps numeric(5,2) := 0.00;
  v_total_enps_answers integer := 0;
  v_overall_score numeric(5,2) := 0.00;
  v_dim_scores jsonb := '{}'::jsonb;
  v_dept_scores jsonb := '[]'::jsonb;
  v_row record;
  v_cat record;
BEGIN
  SELECT * INTO v_survey FROM public.survey_instances
  WHERE id = p_survey_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Survey not found');
  END IF;

  -- 1. Participation metrics
  SELECT COUNT(*) INTO v_eligible FROM public.survey_participants WHERE survey_id = p_survey_id;
  SELECT COUNT(*) INTO v_completed FROM public.survey_participants WHERE survey_id = p_survey_id AND participation_status = 'completed';

  IF v_eligible > 0 THEN
    v_participation_rate := ROUND((v_completed::numeric / v_eligible::numeric) * 100.0, 2);
  END IF;

  -- 2. eNPS calculation:
  -- Promoters (9-10), Passives (7-8), Detractors (0-6)
  FOR v_row IN
    SELECT (elem->>'value_numeric')::numeric AS score
    FROM public.survey_responses r,
         jsonb_array_elements(r.answers) AS elem
    WHERE r.survey_id = p_survey_id
      AND r.status = 'submitted'
      AND elem->>'question_type' = 'enps_0_10'
  LOOP
    v_total_enps_answers := v_total_enps_answers + 1;
    IF v_row.score >= 9 THEN
      v_promoters := v_promoters + 1;
    ELSIF v_row.score >= 7 THEN
      v_passives := v_passives + 1;
    ELSE
      v_detractors := v_detractors + 1;
    END IF;
  END LOOP;

  IF v_total_enps_answers > 0 THEN
    v_enps := ROUND(
      ((v_promoters::numeric / v_total_enps_answers::numeric) * 100.0) -
      ((v_detractors::numeric / v_total_enps_answers::numeric) * 100.0),
      2
    );
  END IF;

  -- 3. Overall Engagement Score (Avg of Likert 1-5 or 0-10 mapped to 0-100)
  SELECT ROUND(AVG(
    CASE 
      WHEN elem->>'question_type' = 'likert_scale' THEN ((elem->>'value_numeric')::numeric / 5.0) * 100.0
      WHEN elem->>'question_type' = 'enps_0_10' THEN ((elem->>'value_numeric')::numeric / 10.0) * 100.0
      ELSE ((elem->>'value_numeric')::numeric / 5.0) * 100.0
    END
  ), 2) INTO v_overall_score
  FROM public.survey_responses r,
       jsonb_array_elements(r.answers) AS elem
  WHERE r.survey_id = p_survey_id
    AND r.status = 'submitted'
    AND elem->>'value_numeric' IS NOT NULL;

  v_overall_score := COALESCE(v_overall_score, 0.00);

  -- 4. Dimension scores
  FOR v_cat IN
    SELECT 
      elem->>'category' AS cat_name,
      ROUND(AVG(((elem->>'value_numeric')::numeric / 5.0) * 100.0), 2) AS cat_avg
    FROM public.survey_responses r,
         jsonb_array_elements(r.answers) AS elem
    WHERE r.survey_id = p_survey_id
      AND r.status = 'submitted'
      AND elem->>'category' IS NOT NULL
      AND elem->>'value_numeric' IS NOT NULL
    GROUP BY elem->>'category'
  LOOP
    v_dim_scores := v_dim_scores || jsonb_build_object(v_cat.cat_name, v_cat.cat_avg);
  END LOOP;

  -- 5. Department Breakdown with Privacy Suppression Threshold!
  FOR v_row IN
    SELECT 
      d.id AS dept_id,
      d.name_ar AS dept_name,
      COUNT(DISTINCT r.id) AS resp_count,
      ROUND(AVG(((elem->>'value_numeric')::numeric / 5.0) * 100.0), 2) AS dept_avg
    FROM public.departments d
    LEFT JOIN public.survey_responses r ON r.department_id = d.id AND r.survey_id = p_survey_id AND r.status = 'submitted'
    LEFT JOIN jsonb_array_elements(COALESCE(r.answers, '[]'::jsonb)) AS elem ON elem->>'value_numeric' IS NOT NULL
    WHERE d.company_id = p_company_id
    GROUP BY d.id, d.name_ar
  LOOP
    IF v_row.resp_count < v_survey.minimum_reporting_group_size THEN
      -- SUPPRESSED TO PROTECT ANONYMITY!
      v_dept_scores := v_dept_scores || jsonb_build_object(
        'department_id', v_row.dept_id,
        'department_name', v_row.dept_name,
        'response_count', v_row.resp_count,
        'suppressed', true,
        'score', null,
        'suppression_reason', 'مجموعة الاستجابة أقل من حد السرية الأدنى (' || v_survey.minimum_reporting_group_size || ' مشاركين)'
      );
    ELSE
      v_dept_scores := v_dept_scores || jsonb_build_object(
        'department_id', v_row.dept_id,
        'department_name', v_row.dept_name,
        'response_count', v_row.resp_count,
        'suppressed', false,
        'score', COALESCE(v_row.dept_avg, 0.00)
      );
    END IF;
  END LOOP;

  -- 6. Upsert snapshot
  INSERT INTO public.survey_result_snapshots (
    survey_id, company_id, eligible_count, completed_count, participation_rate,
    overall_engagement_score, enps_score, promoters_count, passives_count, detractors_count,
    dimension_scores, department_scores, calculated_at
  ) VALUES (
    p_survey_id, p_company_id, v_eligible, v_completed, v_participation_rate,
    v_overall_score, v_enps, v_promoters, v_passives, v_detractors,
    v_dim_scores, v_dept_scores, now()
  )
  ON CONFLICT (survey_id) DO UPDATE SET
    eligible_count = EXCLUDED.eligible_count,
    completed_count = EXCLUDED.completed_count,
    participation_rate = EXCLUDED.participation_rate,
    overall_engagement_score = EXCLUDED.overall_engagement_score,
    enps_score = EXCLUDED.enps_score,
    promoters_count = EXCLUDED.promoters_count,
    passives_count = EXCLUDED.passives_count,
    detractors_count = EXCLUDED.detractors_count,
    dimension_scores = EXCLUDED.dimension_scores,
    department_scores = EXCLUDED.department_scores,
    calculated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'eligible_count', v_eligible,
    'completed_count', v_completed,
    'participation_rate', v_participation_rate,
    'overall_score', v_overall_score,
    'enps', v_enps,
    'promoters', v_promoters,
    'passives', v_passives,
    'detractors', v_detractors,
    'dimension_scores', v_dim_scores,
    'department_scores', v_dept_scores
  );
END;
$$;

-- D. Send Employee Recognition Atomic
CREATE OR REPLACE FUNCTION public.send_employee_recognition_atomic(
  p_company_id uuid,
  p_sender_id uuid,
  p_recipient_id uuid,
  p_category_id uuid,
  p_badge_id uuid,
  p_message text,
  p_visibility text DEFAULT 'company'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recog_id uuid;
BEGIN
  IF p_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender cannot recognize themselves');
  END IF;

  INSERT INTO public.employee_recognitions (
    company_id, sender_employee_id, recipient_employee_id, category_id,
    badge_id, message, visibility, status, created_at
  ) VALUES (
    p_company_id, p_sender_id, p_recipient_id, p_category_id,
    p_badge_id, p_message, p_visibility, 'published', now()
  ) RETURNING id INTO v_recog_id;

  INSERT INTO public.audit_events (
    company_id, action, entity_type, entity_id, entity_name, changes_summary, severity
  ) VALUES (
    p_company_id, 'engagement.recognition_sent', 'employee_recognition', v_recog_id::text,
    'Employee Recognition', 'Recognition published with visibility: ' || p_visibility, 'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'recognition_id', v_recog_id
  );
END;
$$;

-- E. Nominate Campaign Candidate Atomic
CREATE OR REPLACE FUNCTION public.nominate_campaign_candidate_atomic(
  p_company_id uuid,
  p_campaign_id uuid,
  p_nominee_id uuid,
  p_nominator_id uuid,
  p_reason text,
  p_evidence_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nom_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.recognition_nominations
    WHERE campaign_id = p_campaign_id 
      AND nominee_employee_id = p_nominee_id 
      AND nominator_employee_id = p_nominator_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already nominated this employee for this campaign');
  END IF;

  INSERT INTO public.recognition_nominations (
    campaign_id, company_id, nominee_employee_id, nominator_employee_id,
    reason, evidence_url, status, created_at
  ) VALUES (
    p_campaign_id, p_company_id, p_nominee_id, p_nominator_id,
    p_reason, p_evidence_url, 'submitted', now()
  ) RETURNING id INTO v_nom_id;

  RETURN jsonb_build_object(
    'success', true,
    'nomination_id', v_nom_id
  );
END;
$$;

-- F. Truthful Engagement KPIs Atomic
CREATE OR REPLACE FUNCTION public.get_engagement_kpis_atomic(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_surveys integer := 0;
  v_avg_participation numeric(5,2) := 0.00;
  v_latest_enps numeric(5,2) := 0.00;
  v_open_actions integer := 0;
  v_overdue_actions integer := 0;
  v_recognitions_month integer := 0;
  v_recognized_employees_count integer := 0;
BEGIN
  -- 1. Active surveys
  SELECT COUNT(*) INTO v_active_surveys
  FROM public.survey_instances
  WHERE company_id = p_company_id AND status = 'open';

  -- 2. Average participation rate across published snapshots
  SELECT COALESCE(ROUND(AVG(participation_rate), 2), 0.00) INTO v_avg_participation
  FROM public.survey_result_snapshots
  WHERE company_id = p_company_id;

  -- 3. Latest eNPS score
  SELECT COALESCE(enps_score, 0.00) INTO v_latest_enps
  FROM public.survey_result_snapshots
  WHERE company_id = p_company_id
  ORDER BY calculated_at DESC
  LIMIT 1;

  -- 4. Action Plans
  SELECT COUNT(*) INTO v_open_actions
  FROM public.engagement_action_plans
  WHERE company_id = p_company_id AND status IN ('planned', 'in_progress');

  SELECT COUNT(*) INTO v_overdue_actions
  FROM public.engagement_action_plans
  WHERE company_id = p_company_id 
    AND status IN ('planned', 'in_progress')
    AND target_date < current_date;

  -- 5. Recognition activity this month
  SELECT COUNT(*) INTO v_recognitions_month
  FROM public.employee_recognitions
  WHERE company_id = p_company_id 
    AND created_at >= date_trunc('month', current_date);

  SELECT COUNT(DISTINCT recipient_employee_id) INTO v_recognized_employees_count
  FROM public.employee_recognitions
  WHERE company_id = p_company_id 
    AND created_at >= date_trunc('month', current_date);

  RETURN jsonb_build_object(
    'active_surveys', v_active_surveys,
    'active_surveys_count', v_active_surveys,
    'avg_participation', v_avg_participation,
    'average_participation_rate', v_avg_participation,
    'latest_enps', v_latest_enps,
    'open_actions', v_open_actions,
    'open_action_plans_count', v_open_actions,
    'overdue_actions', v_overdue_actions,
    'overdue_action_plans_count', v_overdue_actions,
    'recognitions_month', v_recognitions_month,
    'recognitions_this_month', v_recognitions_month,
    'recognized_employees_count', v_recognized_employees_count,
    'employees_recognized_count', v_recognized_employees_count
  );
END;
$$;

-- ============================================================================
-- 17. ROW LEVEL SECURITY POLICIES & GRANTS
-- ============================================================================

ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_result_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_nominations ENABLE ROW LEVEL SECURITY;

-- Standard tenant isolation policies
DROP POLICY IF EXISTS "survey_templates_isolation" ON public.survey_templates;
CREATE POLICY "survey_templates_isolation" ON public.survey_templates FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "survey_template_versions_isolation" ON public.survey_template_versions;
CREATE POLICY "survey_template_versions_isolation" ON public.survey_template_versions FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "survey_questions_isolation" ON public.survey_questions;
CREATE POLICY "survey_questions_isolation" ON public.survey_questions FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "survey_instances_isolation" ON public.survey_instances;
CREATE POLICY "survey_instances_isolation" ON public.survey_instances FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "survey_participants_isolation" ON public.survey_participants;
CREATE POLICY "survey_participants_isolation" ON public.survey_participants FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "survey_responses_isolation" ON public.survey_responses;
CREATE POLICY "survey_responses_isolation" ON public.survey_responses FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "survey_snapshots_isolation" ON public.survey_result_snapshots;
CREATE POLICY "survey_snapshots_isolation" ON public.survey_result_snapshots FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "engagement_action_plans_isolation" ON public.engagement_action_plans;
CREATE POLICY "engagement_action_plans_isolation" ON public.engagement_action_plans FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "employee_recognitions_isolation" ON public.employee_recognitions;
CREATE POLICY "employee_recognitions_isolation" ON public.employee_recognitions FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

GRANT SELECT, INSERT, UPDATE ON public.survey_templates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.survey_template_versions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.survey_questions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.survey_instances TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.survey_audiences TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.survey_participants TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.survey_responses TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.survey_result_snapshots TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.engagement_action_plans TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.engagement_action_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.recognition_categories TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.recognition_badges TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.employee_recognitions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.recognition_campaigns TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.recognition_nominations TO authenticated, service_role;
