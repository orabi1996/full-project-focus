-- ============================================================
-- Performance module: missing tables + atomic RPCs
-- ============================================================

-- 1. Cycle participants (snapshot of employees enrolled in a cycle)
CREATE TABLE IF NOT EXISTS public.performance_cycle_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  employee_no text,
  employee_name_ar text,
  employee_name_en text,
  department_id uuid,
  department_name text,
  job_title text,
  manager_employee_id uuid,
  manager_name text,
  template_id uuid,
  status text NOT NULL DEFAULT 'enrolled',
  final_goal_score numeric,
  final_competency_score numeric,
  final_overall_score numeric,
  calibrated_score numeric,
  final_rating_label text,
  nine_box_performance text,
  nine_box_potential text,
  nine_box_cell text,
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_cycle_participants TO authenticated;
GRANT ALL ON public.performance_cycle_participants TO service_role;
ALTER TABLE public.performance_cycle_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY perf_participants_select ON public.performance_cycle_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY perf_participants_write ON public.performance_cycle_participants FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 2. Performance goals (OKRs)
CREATE TABLE IF NOT EXISTS public.performance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  parent_goal_id uuid REFERENCES public.performance_goals(id),
  category text NOT NULL DEFAULT 'individual',
  level text NOT NULL DEFAULT 'individual',
  title_ar text NOT NULL,
  title_en text,
  description text,
  metric_type text NOT NULL DEFAULT 'percentage',
  start_value numeric NOT NULL DEFAULT 0,
  target_value numeric NOT NULL DEFAULT 100,
  current_value numeric NOT NULL DEFAULT 0,
  weight numeric NOT NULL DEFAULT 0,
  progress_percentage numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  is_locked boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_goals TO authenticated;
GRANT ALL ON public.performance_goals TO service_role;
ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY perf_goals_select ON public.performance_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY perf_goals_write ON public.performance_goals FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 3. Goal progress history
CREATE TABLE IF NOT EXISTS public.goal_progress_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.performance_goals(id) ON DELETE CASCADE,
  previous_value numeric NOT NULL DEFAULT 0,
  new_value numeric NOT NULL DEFAULT 0,
  percentage numeric NOT NULL DEFAULT 0,
  note text,
  recorded_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_progress_history TO authenticated;
GRANT ALL ON public.goal_progress_history TO service_role;
ALTER TABLE public.goal_progress_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY goal_history_select ON public.goal_progress_history FOR SELECT TO authenticated USING (true);
CREATE POLICY goal_history_write ON public.goal_progress_history FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 4. Competency frameworks
CREATE TABLE IF NOT EXISTS public.competency_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  code text,
  title_ar text NOT NULL,
  title_en text,
  version text NOT NULL DEFAULT '1.0',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competency_frameworks TO authenticated;
GRANT ALL ON public.competency_frameworks TO service_role;
ALTER TABLE public.competency_frameworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY comp_frameworks_select ON public.competency_frameworks FOR SELECT TO authenticated USING (true);
CREATE POLICY comp_frameworks_write ON public.competency_frameworks FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 5. Competencies
CREATE TABLE IF NOT EXISTS public.competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  framework_id uuid REFERENCES public.competency_frameworks(id) ON DELETE CASCADE,
  category text,
  code text,
  title_ar text NOT NULL,
  title_en text,
  description_ar text,
  description_en text,
  target_proficiency_level numeric NOT NULL DEFAULT 3,
  weight_pct numeric NOT NULL DEFAULT 20,
  behavioral_indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competencies TO authenticated;
GRANT ALL ON public.competencies TO service_role;
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY competencies_select ON public.competencies FOR SELECT TO authenticated USING (true);
CREATE POLICY competencies_write ON public.competencies FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 6. Review templates
CREATE TABLE IF NOT EXISTS public.review_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  framework_id uuid REFERENCES public.competency_frameworks(id),
  code text,
  title_ar text NOT NULL,
  title_en text,
  target_department_id uuid,
  target_job_title text,
  goals_weight_pct numeric NOT NULL DEFAULT 60,
  competencies_weight_pct numeric NOT NULL DEFAULT 40,
  include_360_peer_review boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_templates TO authenticated;
GRANT ALL ON public.review_templates TO service_role;
ALTER TABLE public.review_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_templates_select ON public.review_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY review_templates_write ON public.review_templates FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 7. Review template items
CREATE TABLE IF NOT EXISTS public.review_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.review_templates(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'competency',
  competency_id uuid REFERENCES public.competencies(id),
  custom_title_ar text,
  custom_title_en text,
  weight_pct numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_template_items TO authenticated;
GRANT ALL ON public.review_template_items TO service_role;
ALTER TABLE public.review_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_template_items_select ON public.review_template_items FOR SELECT TO authenticated USING (true);
CREATE POLICY review_template_items_write ON public.review_template_items FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 8. Review assignments (self / manager / peer)
CREATE TABLE IF NOT EXISTS public.performance_review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.performance_cycle_participants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  employee_name text,
  reviewer_employee_id uuid REFERENCES public.employees(id),
  reviewer_name text,
  review_type text NOT NULL DEFAULT 'self',
  is_anonymous boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id, reviewer_employee_id, review_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_review_assignments TO authenticated;
GRANT ALL ON public.performance_review_assignments TO service_role;
ALTER TABLE public.performance_review_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_assignments_select ON public.performance_review_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY review_assignments_write ON public.performance_review_assignments FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 9. Extend existing performance_reviews with the columns the app expects
ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.performance_review_assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS reviewer_employee_id uuid,
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS goal_score numeric,
  ADD COLUMN IF NOT EXISTS competency_score numeric,
  ADD COLUMN IF NOT EXISTS strengths_summary text,
  ADD COLUMN IF NOT EXISTS growth_areas_summary text,
  ADD COLUMN IF NOT EXISTS general_feedback text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- 10. Calibration sessions
CREATE TABLE IF NOT EXISTS public.calibration_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  department_id uuid,
  department_name text,
  title_ar text NOT NULL,
  title_en text,
  status text NOT NULL DEFAULT 'scheduled',
  session_date date,
  moderator_employee_id uuid,
  moderator_name text,
  target_distribution jsonb,
  actual_distribution jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calibration_sessions TO authenticated;
GRANT ALL ON public.calibration_sessions TO service_role;
ALTER TABLE public.calibration_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY calibration_sessions_select ON public.calibration_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY calibration_sessions_write ON public.calibration_sessions FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 11. Calibration adjustments
CREATE TABLE IF NOT EXISTS public.calibration_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.calibration_sessions(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.performance_cycle_participants(id),
  employee_id uuid,
  employee_name text,
  original_score numeric,
  original_rating_label text,
  calibrated_score numeric NOT NULL,
  calibrated_rating_label text,
  calibration_reason text,
  adjusted_by uuid,
  adjusted_by_name text,
  adjusted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calibration_adjustments TO authenticated;
GRANT ALL ON public.calibration_adjustments TO service_role;
ALTER TABLE public.calibration_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY calibration_adjustments_select ON public.calibration_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY calibration_adjustments_write ON public.calibration_adjustments FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 12. Potential assessments (9-Box)
CREATE TABLE IF NOT EXISTS public.potential_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.performance_cycle_participants(id) ON DELETE CASCADE,
  employee_id uuid,
  employee_name text,
  assessor_employee_id uuid,
  assessor_name text,
  assessor_role text,
  potential_level text NOT NULL DEFAULT 'medium',
  performance_level text NOT NULL DEFAULT 'medium',
  nine_box_cell text,
  learning_agility_score numeric NOT NULL DEFAULT 3,
  leadership_potential_score numeric NOT NULL DEFAULT 3,
  critical_role_readiness text,
  flight_risk text,
  retention_priority text,
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.potential_assessments TO authenticated;
GRANT ALL ON public.potential_assessments TO service_role;
ALTER TABLE public.potential_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY potential_assessments_select ON public.potential_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY potential_assessments_write ON public.potential_assessments FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 13. Development plans (IDP)
CREATE TABLE IF NOT EXISTS public.development_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  cycle_id uuid REFERENCES public.performance_cycles(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  employee_name text,
  title_ar text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  overall_progress_pct numeric NOT NULL DEFAULT 0,
  target_completion_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.development_plans TO authenticated;
GRANT ALL ON public.development_plans TO service_role;
ALTER TABLE public.development_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY development_plans_select ON public.development_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY development_plans_write ON public.development_plans FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 14. Development plan items
CREATE TABLE IF NOT EXISTS public.development_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.development_plans(id) ON DELETE CASCADE,
  competency_id uuid REFERENCES public.competencies(id),
  objective_ar text NOT NULL,
  action_type text NOT NULL DEFAULT 'training',
  activity_description text,
  success_metric text,
  target_date date,
  status text NOT NULL DEFAULT 'planned',
  progress_pct numeric NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.development_plan_items TO authenticated;
GRANT ALL ON public.development_plan_items TO service_role;
ALTER TABLE public.development_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY development_plan_items_select ON public.development_plan_items FOR SELECT TO authenticated USING (true);
CREATE POLICY development_plan_items_write ON public.development_plan_items FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- 15. Performance improvement plans (PIP)
CREATE TABLE IF NOT EXISTS public.performance_improvement_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  cycle_id uuid REFERENCES public.performance_cycles(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  employee_name text,
  manager_employee_id uuid,
  manager_name text,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  review_frequency_days integer NOT NULL DEFAULT 14,
  performance_deficiencies text,
  expected_outcomes text,
  consequences_of_failure text,
  hr_notes text,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_improvement_plans TO authenticated;
GRANT ALL ON public.performance_improvement_plans TO service_role;
ALTER TABLE public.performance_improvement_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY pips_select ON public.performance_improvement_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY pips_write ON public.performance_improvement_plans FOR ALL TO authenticated USING (private_sec.current_user_is_hr()) WITH CHECK (private_sec.current_user_is_hr());

-- ============================================================
-- Atomic RPCs
-- ============================================================

-- Launch a cycle: enroll employees, generate self + manager assignments
CREATE OR REPLACE FUNCTION public.launch_performance_cycle_atomic(p_cycle_id uuid, p_target_department_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
  v_participants int := 0;
  v_assignments int := 0;
BEGIN
  IF NOT private_sec.current_user_is_hr() THEN
    RAISE EXCEPTION 'غير مصرح: إطلاق دورات التقييم متاح لمسؤولي الموارد البشرية فقط' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO v_status FROM performance_cycles WHERE id = p_cycle_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'دورة التقييم غير موجودة' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'لا يمكن إطلاق دورة تم إطلاقها أو إقفالها مسبقاً' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO performance_cycle_participants (cycle_id, employee_id, employee_no, employee_name_ar, department_id, department_name, job_title, manager_employee_id, manager_name, status)
  SELECT p_cycle_id, e.id, e.employee_no, e.full_name, e.department_id, d.name, e.job_title, e.manager_id, m.full_name, 'enrolled'
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees m ON m.id = e.manager_id
  WHERE e.status IN ('active', 'on_leave')
    AND (p_target_department_ids IS NULL OR e.department_id = ANY (p_target_department_ids))
  ON CONFLICT (cycle_id, employee_id) DO NOTHING;
  GET DIAGNOSTICS v_participants = ROW_COUNT;

  INSERT INTO performance_review_assignments (cycle_id, participant_id, employee_id, employee_name, reviewer_employee_id, reviewer_name, review_type, is_anonymous, status)
  SELECT p.cycle_id, p.id, p.employee_id, p.employee_name_ar, p.employee_id, p.employee_name_ar, 'self', false, 'pending'
  FROM performance_cycle_participants p
  WHERE p.cycle_id = p_cycle_id
  ON CONFLICT DO NOTHING;

  INSERT INTO performance_review_assignments (cycle_id, participant_id, employee_id, employee_name, reviewer_employee_id, reviewer_name, review_type, is_anonymous, status)
  SELECT p.cycle_id, p.id, p.employee_id, p.employee_name_ar, p.manager_employee_id, p.manager_name, 'manager', false, 'pending'
  FROM performance_cycle_participants p
  WHERE p.cycle_id = p_cycle_id AND p.manager_employee_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_assignments FROM performance_review_assignments WHERE cycle_id = p_cycle_id;

  UPDATE performance_cycles
  SET status = 'active',
      participants_count = (SELECT count(*) FROM performance_cycle_participants WHERE cycle_id = p_cycle_id),
      updated_at = now()
  WHERE id = p_cycle_id;

  RETURN jsonb_build_object('success', true, 'participants_enrolled', v_participants, 'assignments_generated', v_assignments);
END;
$$;
GRANT EXECUTE ON FUNCTION public.launch_performance_cycle_atomic(uuid, uuid[]) TO authenticated;

-- Assign 360 peer reviewers
CREATE OR REPLACE FUNCTION public.assign_peer_reviewers_atomic(p_cycle_id uuid, p_target_employee_id uuid, p_peer_employee_ids uuid[], p_is_anonymous boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_participant_id uuid;
  v_count int := 0;
BEGIN
  IF NOT private_sec.current_user_is_hr() THEN
    RAISE EXCEPTION 'غير مصرح: تعيين مقيّمي الزملاء متاح لمسؤولي الموارد البشرية فقط' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_participant_id FROM performance_cycle_participants WHERE cycle_id = p_cycle_id AND employee_id = p_target_employee_id;
  IF v_participant_id IS NULL THEN
    RAISE EXCEPTION 'الموظف غير مسجل في هذه الدورة' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO performance_review_assignments (cycle_id, participant_id, employee_id, employee_name, reviewer_employee_id, reviewer_name, review_type, is_anonymous, status)
  SELECT p_cycle_id, v_participant_id, p_target_employee_id, t.full_name, peer.id, peer.full_name, 'peer', COALESCE(p_is_anonymous, true), 'pending'
  FROM unnest(p_peer_employee_ids) AS peer_id
  JOIN employees peer ON peer.id = peer_id
  CROSS JOIN (SELECT full_name FROM employees WHERE id = p_target_employee_id) t
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'assignments_count', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.assign_peer_reviewers_atomic(uuid, uuid, uuid[], boolean) TO authenticated;

-- Submit a goal (HR or the employee themselves)
CREATE OR REPLACE FUNCTION public.submit_performance_goal_atomic(p_cycle_id uuid, p_employee_id uuid, p_parent_goal_id uuid, p_category text, p_level text, p_title_ar text, p_title_en text, p_description text, p_metric_type text, p_start_value numeric, p_target_value numeric, p_weight numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_goal_id uuid;
  v_is_owner boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id AND user_id = auth.uid()) INTO v_is_owner;
  IF NOT (private_sec.current_user_is_hr() OR v_is_owner) THEN
    RAISE EXCEPTION 'غير مصرح بإضافة أهداف لهذا الموظف' USING ERRCODE = '42501';
  END IF;
  IF p_title_ar IS NULL OR btrim(p_title_ar) = '' THEN
    RAISE EXCEPTION 'عنوان الهدف مطلوب' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO performance_goals (cycle_id, employee_id, parent_goal_id, category, level, title_ar, title_en, description, metric_type, start_value, target_value, current_value, weight, status)
  VALUES (p_cycle_id, p_employee_id, p_parent_goal_id, COALESCE(p_category, 'individual'), COALESCE(p_level, 'individual'), p_title_ar, p_title_en, p_description, COALESCE(p_metric_type, 'percentage'), COALESCE(p_start_value, 0), COALESCE(p_target_value, 100), COALESCE(p_start_value, 0), COALESCE(p_weight, 0), 'active')
  RETURNING id INTO v_goal_id;

  RETURN jsonb_build_object('success', true, 'goal_id', v_goal_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_performance_goal_atomic(uuid, uuid, uuid, text, text, text, text, text, text, numeric, numeric, numeric) TO authenticated;

-- Update goal progress (HR or goal owner)
CREATE OR REPLACE FUNCTION public.update_goal_progress_atomic(p_goal_id uuid, p_new_value numeric, p_percentage numeric, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_goal performance_goals%ROWTYPE;
  v_is_owner boolean;
BEGIN
  SELECT * INTO v_goal FROM performance_goals WHERE id = p_goal_id;
  IF v_goal.id IS NULL THEN
    RAISE EXCEPTION 'الهدف غير موجود' USING ERRCODE = 'P0002';
  END IF;
  SELECT EXISTS (SELECT 1 FROM employees WHERE id = v_goal.employee_id AND user_id = auth.uid()) INTO v_is_owner;
  IF NOT (private_sec.current_user_is_hr() OR v_is_owner) THEN
    RAISE EXCEPTION 'غير مصرح بتحديث هذا الهدف' USING ERRCODE = '42501';
  END IF;
  IF v_goal.is_locked THEN
    RAISE EXCEPTION 'الهدف مقفل ولا يمكن تعديله' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO goal_progress_history (goal_id, previous_value, new_value, percentage, note, recorded_by)
  VALUES (p_goal_id, v_goal.current_value, p_new_value, p_percentage, p_note, auth.uid());

  UPDATE performance_goals
  SET current_value = p_new_value,
      progress_percentage = GREATEST(0, LEAST(100, p_percentage)),
      status = CASE WHEN p_percentage >= 100 THEN 'completed' ELSE status END,
      updated_at = now()
  WHERE id = p_goal_id;

  RETURN jsonb_build_object('success', true, 'new_percentage', GREATEST(0, LEAST(100, p_percentage)));
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_goal_progress_atomic(uuid, numeric, numeric, text) TO authenticated;

-- Submit a review for an assignment (assigned reviewer or HR)
CREATE OR REPLACE FUNCTION public.submit_performance_review_atomic(p_assignment_id uuid, p_scores jsonb, p_strengths_summary text DEFAULT NULL, p_growth_areas_summary text DEFAULT NULL, p_general_feedback text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_assignment performance_review_assignments%ROWTYPE;
  v_is_reviewer boolean;
  v_goal_score numeric := 0;
  v_comp_score numeric := 0;
  v_overall numeric := 0;
  v_goals_weight numeric := 60;
  v_comp_weight numeric := 40;
  v_review_id uuid;
BEGIN
  SELECT * INTO v_assignment FROM performance_review_assignments WHERE id = p_assignment_id;
  IF v_assignment.id IS NULL THEN
    RAISE EXCEPTION 'مهمة التقييم غير موجودة' USING ERRCODE = 'P0002';
  END IF;
  SELECT EXISTS (SELECT 1 FROM employees WHERE id = v_assignment.reviewer_employee_id AND user_id = auth.uid()) INTO v_is_reviewer;
  IF NOT (private_sec.current_user_is_hr() OR v_is_reviewer) THEN
    RAISE EXCEPTION 'غير مصرح: هذا التقييم مخصص لمقيّم آخر' USING ERRCODE = '42501';
  END IF;
  IF v_assignment.status = 'submitted' THEN
    RAISE EXCEPTION 'تم تقديم هذا التقييم مسبقاً' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(SUM((s ->> 'score')::numeric * (s ->> 'weight_pct')::numeric) / NULLIF(SUM((s ->> 'weight_pct')::numeric), 0), 0)
    INTO v_goal_score
    FROM jsonb_array_elements(COALESCE(p_scores, '[]'::jsonb)) s
   WHERE s ->> 'item_type' = 'goal';

  SELECT COALESCE(SUM((s ->> 'score')::numeric * (s ->> 'weight_pct')::numeric) / NULLIF(SUM((s ->> 'weight_pct')::numeric), 0), 0)
    INTO v_comp_score
    FROM jsonb_array_elements(COALESCE(p_scores, '[]'::jsonb)) s
   WHERE s ->> 'item_type' = 'competency';

  SELECT COALESCE(goals_weight_pct, 60), COALESCE(competencies_weight_pct, 40)
    INTO v_goals_weight, v_comp_weight
    FROM performance_cycles WHERE id = v_assignment.cycle_id;

  v_overall := round((v_goal_score * v_goals_weight + v_comp_score * v_comp_weight) / NULLIF(v_goals_weight + v_comp_weight, 0), 2);

  INSERT INTO performance_reviews (assignment_id, cycle_id, employee_id, reviewer_employee_id, review_type, is_anonymous, goal_score, competency_score, overall_score, strengths_summary, growth_areas_summary, general_feedback, status, submitted_at)
  VALUES (p_assignment_id, v_assignment.cycle_id, v_assignment.employee_id, v_assignment.reviewer_employee_id, v_assignment.review_type, v_assignment.is_anonymous, v_goal_score, v_comp_score, v_overall, p_strengths_summary, p_growth_areas_summary, p_general_feedback, 'submitted', now())
  RETURNING id INTO v_review_id;

  UPDATE performance_review_assignments SET status = 'submitted', submitted_at = now() WHERE id = p_assignment_id;

  RETURN jsonb_build_object('success', true, 'review_id', v_review_id, 'overall_score', v_overall, 'goal_score', v_goal_score, 'competency_score', v_comp_score);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_performance_review_atomic(uuid, jsonb, text, text, text) TO authenticated;

-- Calibration adjustment (HR only)
CREATE OR REPLACE FUNCTION public.adjust_calibration_atomic(p_session_id uuid, p_participant_id uuid, p_calibrated_score numeric, p_calibrated_rating_label text, p_calibration_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_participant performance_cycle_participants%ROWTYPE;
  v_adjustment_id uuid;
  v_adjuster_name text;
BEGIN
  IF NOT private_sec.current_user_is_hr() THEN
    RAISE EXCEPTION 'غير مصرح: المعايرة والموازنة متاحة لمسؤولي الموارد البشرية فقط' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_participant FROM performance_cycle_participants WHERE id = p_participant_id;
  IF v_participant.id IS NULL THEN
    RAISE EXCEPTION 'المشارك غير موجود في الدورة' USING ERRCODE = 'P0002';
  END IF;
  SELECT full_name INTO v_adjuster_name FROM profiles WHERE id = auth.uid();

  INSERT INTO calibration_adjustments (session_id, participant_id, employee_id, employee_name, original_score, original_rating_label, calibrated_score, calibrated_rating_label, calibration_reason, adjusted_by, adjusted_by_name)
  VALUES (p_session_id, p_participant_id, v_participant.employee_id, v_participant.employee_name_ar, v_participant.final_overall_score, v_participant.final_rating_label, p_calibrated_score, p_calibrated_rating_label, p_calibration_reason, auth.uid(), v_adjuster_name)
  RETURNING id INTO v_adjustment_id;

  UPDATE performance_cycle_participants
  SET calibrated_score = p_calibrated_score,
      final_rating_label = COALESCE(p_calibrated_rating_label, final_rating_label),
      updated_at = now()
  WHERE id = p_participant_id;

  RETURN jsonb_build_object('success', true, 'adjustment_id', v_adjustment_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.adjust_calibration_atomic(uuid, uuid, numeric, text, text) TO authenticated;

-- Potential assessment / 9-Box placement (HR only)
CREATE OR REPLACE FUNCTION public.assess_potential_atomic(p_cycle_id uuid, p_participant_id uuid, p_potential_level text, p_learning_agility_score numeric DEFAULT 3, p_leadership_potential_score numeric DEFAULT 3, p_critical_role_readiness text DEFAULT 'ready_1_year', p_flight_risk text DEFAULT 'low', p_retention_priority text DEFAULT 'normal', p_rationale text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_participant performance_cycle_participants%ROWTYPE;
  v_assessor_id uuid;
  v_assessor_name text;
  v_perf_level text;
  v_score numeric;
  v_cell text;
  v_assessment_id uuid;
BEGIN
  IF NOT private_sec.current_user_is_hr() THEN
    RAISE EXCEPTION 'غير مصرح: تقييم الإمكانات متاح لمسؤولي الموارد البشرية فقط' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_participant FROM performance_cycle_participants WHERE id = p_participant_id AND cycle_id = p_cycle_id;
  IF v_participant.id IS NULL THEN
    RAISE EXCEPTION 'المشارك غير موجود في هذه الدورة' USING ERRCODE = 'P0002';
  END IF;
  SELECT id, full_name INTO v_assessor_id, v_assessor_name FROM employees WHERE user_id = auth.uid() LIMIT 1;

  v_score := COALESCE(v_participant.calibrated_score, v_participant.final_overall_score);
  v_perf_level := CASE
    WHEN v_score IS NULL THEN 'medium'
    WHEN v_score >= 4 THEN 'high'
    WHEN v_score >= 2.5 THEN 'medium'
    ELSE 'low' END;

  v_cell := (CASE p_potential_level WHEN 'high' THEN '1' WHEN 'low' THEN '3' ELSE '2' END)
         || (CASE v_perf_level WHEN 'high' THEN 'A' WHEN 'low' THEN 'C' ELSE 'B' END);

  INSERT INTO potential_assessments (cycle_id, participant_id, employee_id, employee_name, assessor_employee_id, assessor_name, assessor_role, potential_level, performance_level, nine_box_cell, learning_agility_score, leadership_potential_score, critical_role_readiness, flight_risk, retention_priority, rationale)
  VALUES (p_cycle_id, p_participant_id, v_participant.employee_id, v_participant.employee_name_ar, v_assessor_id, COALESCE(v_assessor_name, 'مسؤول الموارد البشرية'), 'hr', p_potential_level, v_perf_level, v_cell, p_learning_agility_score, p_leadership_potential_score, p_critical_role_readiness, p_flight_risk, p_retention_priority, p_rationale)
  RETURNING id INTO v_assessment_id;

  UPDATE performance_cycle_participants
  SET nine_box_potential = p_potential_level,
      nine_box_performance = v_perf_level,
      nine_box_cell = v_cell,
      updated_at = now()
  WHERE id = p_participant_id;

  RETURN jsonb_build_object('success', true, 'assessment_id', v_assessment_id, 'nine_box_cell', v_cell);
END;
$$;
GRANT EXECUTE ON FUNCTION public.assess_potential_atomic(uuid, uuid, text, numeric, numeric, text, text, text, text) TO authenticated;

-- Finalize and lock a cycle (HR only)
CREATE OR REPLACE FUNCTION public.finalize_performance_cycle_atomic(p_cycle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int := 0;
  v_status text;
BEGIN
  IF NOT private_sec.current_user_is_hr() THEN
    RAISE EXCEPTION 'غير مصرح: إقفال دورات التقييم متاح لمسؤولي الموارد البشرية فقط' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO v_status FROM performance_cycles WHERE id = p_cycle_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'دورة التقييم غير موجودة' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'دورة التقييم مقفلة مسبقاً' USING ERRCODE = 'P0002';
  END IF;

  UPDATE performance_cycle_participants SET is_locked = true, locked_at = now(), updated_at = now() WHERE cycle_id = p_cycle_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE performance_goals SET is_locked = true, updated_at = now() WHERE cycle_id = p_cycle_id;
  UPDATE performance_reviews SET is_locked = true WHERE cycle_id = p_cycle_id;

  UPDATE performance_cycles SET status = 'completed', is_locked = true, locked_at = now(), updated_at = now() WHERE id = p_cycle_id;

  RETURN jsonb_build_object('success', true, 'finalized_count', v_count, 'message', 'تم اعتماد وإقفال دورة التقييم بنجاح');
END;
$$;
GRANT EXECUTE ON FUNCTION public.finalize_performance_cycle_atomic(uuid) TO authenticated;

-- Performance KPIs (read-only, any authenticated user)
CREATE OR REPLACE FUNCTION public.get_performance_kpis_atomic(p_cycle_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total int := 0;
  v_active_cycles int := 0;
  v_self_total int := 0; v_self_done int := 0;
  v_mgr_total int := 0; v_mgr_done int := 0;
  v_peer_total int := 0; v_peer_done int := 0;
  v_nine_box jsonb := '{}'::jsonb;
  v_rating jsonb := '{}'::jsonb;
  v_top int := 0;
  v_pip int := 0;
  v_idp int := 0;
BEGIN
  SELECT count(*) INTO v_active_cycles FROM performance_cycles WHERE status = 'active';

  SELECT count(*) INTO v_total FROM performance_cycle_participants p
  WHERE (p_cycle_id IS NULL OR p.cycle_id = p_cycle_id);

  SELECT
    count(*) FILTER (WHERE review_type = 'self'),
    count(*) FILTER (WHERE review_type = 'self' AND status = 'submitted'),
    count(*) FILTER (WHERE review_type = 'manager'),
    count(*) FILTER (WHERE review_type = 'manager' AND status = 'submitted'),
    count(*) FILTER (WHERE review_type = 'peer'),
    count(*) FILTER (WHERE review_type = 'peer' AND status = 'submitted')
  INTO v_self_total, v_self_done, v_mgr_total, v_mgr_done, v_peer_total, v_peer_done
  FROM performance_review_assignments a
  WHERE (p_cycle_id IS NULL OR a.cycle_id = p_cycle_id);

  SELECT COALESCE(jsonb_object_agg(nine_box_cell, cnt), '{}'::jsonb) INTO v_nine_box
  FROM (SELECT nine_box_cell, count(*) AS cnt FROM performance_cycle_participants
        WHERE nine_box_cell IS NOT NULL AND (p_cycle_id IS NULL OR cycle_id = p_cycle_id)
        GROUP BY nine_box_cell) s;

  SELECT COALESCE(jsonb_object_agg(final_rating_label, cnt), '{}'::jsonb) INTO v_rating
  FROM (SELECT final_rating_label, count(*) AS cnt FROM performance_cycle_participants
        WHERE final_rating_label IS NOT NULL AND (p_cycle_id IS NULL OR cycle_id = p_cycle_id)
        GROUP BY final_rating_label) s;

  SELECT count(*) INTO v_top FROM performance_cycle_participants
  WHERE COALESCE(calibrated_score, final_overall_score) >= 4.5
    AND (p_cycle_id IS NULL OR cycle_id = p_cycle_id);

  SELECT count(*) INTO v_pip FROM performance_improvement_plans WHERE status = 'active';
  SELECT count(*) INTO v_idp FROM development_plans WHERE status = 'active';

  RETURN jsonb_build_object(
    'total_participants', v_total,
    'active_cycles_count', v_active_cycles,
    'self_review_completion_rate', CASE WHEN v_self_total > 0 THEN round(v_self_done::numeric * 100 / v_self_total, 1) ELSE 0 END,
    'manager_review_completion_rate', CASE WHEN v_mgr_total > 0 THEN round(v_mgr_done::numeric * 100 / v_mgr_total, 1) ELSE 0 END,
    'peer_review_completion_rate', CASE WHEN v_peer_total > 0 THEN round(v_peer_done::numeric * 100 / v_peer_total, 1) ELSE 0 END,
    'overall_completion_rate', CASE WHEN (v_self_total + v_mgr_total + v_peer_total) > 0 THEN round((v_self_done + v_mgr_done + v_peer_done)::numeric * 100 / (v_self_total + v_mgr_total + v_peer_total), 1) ELSE 0 END,
    'nine_box_distribution', v_nine_box,
    'rating_distribution', v_rating,
    'top_performers_count', v_top,
    'pip_count', v_pip,
    'idp_count', v_idp
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_performance_kpis_atomic(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';