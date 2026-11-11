-- Restrictive tenant guards. Existing role policies remain authoritative.
BEGIN;
DROP POLICY IF EXISTS guard_performance_company ON public.calibration_sessions;
CREATE POLICY guard_performance_company ON public.calibration_sessions AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.competencies;
CREATE POLICY guard_performance_company ON public.competencies AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.competency_frameworks;
CREATE POLICY guard_performance_company ON public.competency_frameworks AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.development_plans;
CREATE POLICY guard_performance_company ON public.development_plans AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.performance_cycle_participants;
CREATE POLICY guard_performance_company ON public.performance_cycle_participants AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.performance_cycles;
CREATE POLICY guard_performance_company ON public.performance_cycles AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.performance_goals;
CREATE POLICY guard_performance_company ON public.performance_goals AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.performance_improvement_plans;
CREATE POLICY guard_performance_company ON public.performance_improvement_plans AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.performance_review_assignments;
CREATE POLICY guard_performance_company ON public.performance_review_assignments AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.potential_assessments;
CREATE POLICY guard_performance_company ON public.potential_assessments AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.review_templates;
CREATE POLICY guard_performance_company ON public.review_templates AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_core_company(company_id)) WITH CHECK (public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_performance_company ON public.calibration_adjustments;
CREATE POLICY guard_performance_company ON public.calibration_adjustments AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.calibration_sessions parent WHERE parent.id=calibration_adjustments.session_id AND public.can_access_core_company(parent.company_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.calibration_sessions parent WHERE parent.id=calibration_adjustments.session_id AND public.can_access_core_company(parent.company_id)));
DROP POLICY IF EXISTS guard_performance_company ON public.development_plan_items;
CREATE POLICY guard_performance_company ON public.development_plan_items AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.development_plans parent WHERE parent.id=development_plan_items.plan_id AND public.can_access_core_company(parent.company_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.development_plans parent WHERE parent.id=development_plan_items.plan_id AND public.can_access_core_company(parent.company_id)));
DROP POLICY IF EXISTS guard_performance_company ON public.goal_progress_history;
CREATE POLICY guard_performance_company ON public.goal_progress_history AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_goals parent WHERE parent.id=goal_progress_history.goal_id AND public.can_access_core_company(parent.company_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.performance_goals parent WHERE parent.id=goal_progress_history.goal_id AND public.can_access_core_company(parent.company_id)));
DROP POLICY IF EXISTS guard_performance_company ON public.performance_criteria;
CREATE POLICY guard_performance_company ON public.performance_criteria AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.performance_cycles parent WHERE parent.id=performance_criteria.cycle_id AND public.can_access_core_company(parent.company_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.performance_cycles parent WHERE parent.id=performance_criteria.cycle_id AND public.can_access_core_company(parent.company_id)));
DROP POLICY IF EXISTS guard_performance_company ON public.review_template_items;
CREATE POLICY guard_performance_company ON public.review_template_items AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.review_templates parent WHERE parent.id=review_template_items.template_id AND public.can_access_core_company(parent.company_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.review_templates parent WHERE parent.id=review_template_items.template_id AND public.can_access_core_company(parent.company_id)));
COMMIT;
