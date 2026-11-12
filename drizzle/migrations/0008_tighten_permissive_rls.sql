-- Reference/config data: signed-in users only
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('role_permissions','role_perm_select'),('role_definitions','role_def_select'),
    ('competency_frameworks','comp_frameworks_select'),('competencies','competencies_select'),
    ('performance_criteria','perf_crit_select'),('review_templates','review_templates_select'),
    ('review_template_items','review_template_items_select'),('reference_lists','ref_lists_select'),
    ('expense_categories','expense_categories_select'),('departments','dept_select_all'),
    ('subsidiaries','subsidiaries_select'),('work_locations','work_locations_select'),
    ('leave_types','leave_types_select'),('shifts','shifts_read'),
    ('approval_chains','approval_chains_select'),('org_settings','org_settings_select'),
    ('companies','companies_select'),('job_openings','job_openings_select'),
    ('performance_cycles','perf_cycles_select'),('company_documents','company_documents_select')
  ) t(tbl,pol) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL)', r.pol, r.tbl);
  END LOOP;
END $$;

-- Per-employee performance data: HR, the employee, or their manager/reviewer
DROP POLICY IF EXISTS perf_participants_select ON public.performance_cycle_participants;
CREATE POLICY perf_participants_select ON public.performance_cycle_participants FOR SELECT TO authenticated
 USING (private_sec.current_user_is_hr() OR employee_id = private_sec.current_employee_id() OR manager_employee_id = private_sec.current_employee_id());

DROP POLICY IF EXISTS perf_goals_select ON public.performance_goals;
CREATE POLICY perf_goals_select ON public.performance_goals FOR SELECT TO authenticated
 USING (private_sec.current_user_is_hr() OR employee_id = private_sec.current_employee_id()
   OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = performance_goals.employee_id AND e.manager_id = private_sec.current_employee_id()));

DROP POLICY IF EXISTS goal_history_select ON public.goal_progress_history;
CREATE POLICY goal_history_select ON public.goal_progress_history FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.performance_goals g WHERE g.id = goal_progress_history.goal_id));

DROP POLICY IF EXISTS pips_select ON public.performance_improvement_plans;
CREATE POLICY pips_select ON public.performance_improvement_plans FOR SELECT TO authenticated
 USING (private_sec.current_user_is_hr() OR employee_id = private_sec.current_employee_id() OR manager_employee_id = private_sec.current_employee_id());

DROP POLICY IF EXISTS review_assignments_select ON public.performance_review_assignments;
CREATE POLICY review_assignments_select ON public.performance_review_assignments FOR SELECT TO authenticated
 USING (private_sec.current_user_is_hr() OR employee_id = private_sec.current_employee_id() OR reviewer_employee_id = private_sec.current_employee_id());

DROP POLICY IF EXISTS potential_assessments_select ON public.potential_assessments;
CREATE POLICY potential_assessments_select ON public.potential_assessments FOR SELECT TO authenticated
 USING (private_sec.current_user_is_hr() OR assessor_employee_id = private_sec.current_employee_id());

DROP POLICY IF EXISTS calibration_sessions_select ON public.calibration_sessions;
CREATE POLICY calibration_sessions_select ON public.calibration_sessions FOR SELECT TO authenticated
 USING (private_sec.current_user_is_hr());

DROP POLICY IF EXISTS calibration_adjustments_select ON public.calibration_adjustments;
CREATE POLICY calibration_adjustments_select ON public.calibration_adjustments FOR SELECT TO authenticated
 USING (private_sec.current_user_is_hr());

DROP POLICY IF EXISTS development_plans_select ON public.development_plans;
CREATE POLICY development_plans_select ON public.development_plans FOR SELECT TO authenticated
 USING (private_sec.current_user_is_hr() OR employee_id = private_sec.current_employee_id());

DROP POLICY IF EXISTS development_plan_items_select ON public.development_plan_items;
CREATE POLICY development_plan_items_select ON public.development_plan_items FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.development_plans p WHERE p.id = development_plan_items.plan_id));

DROP POLICY IF EXISTS workforce_plans_select ON public.workforce_plans;
CREATE POLICY workforce_plans_select ON public.workforce_plans FOR SELECT TO authenticated
 USING (private_sec.current_user_is_hr());

-- Open inserts: stricter guard policies already exist
DROP POLICY IF EXISTS file_objects_insert ON public.file_objects;
DROP POLICY IF EXISTS file_objects_select ON public.file_objects;
DROP POLICY IF EXISTS delegation_rules_insert ON public.delegation_rules;
DROP POLICY IF EXISTS delegation_rules_select ON public.delegation_rules;
DROP POLICY IF EXISTS overtime_records_insert ON public.overtime_records;
CREATE POLICY overtime_records_insert ON public.overtime_records FOR INSERT TO authenticated
 WITH CHECK (private_sec.current_user_is_hr() OR (employee_id = private_sec.current_employee_id() AND (created_by IS NULL OR created_by = (select auth.uid()))));

-- Storage: bind non-avatar reads/writes to the uploader
DROP POLICY IF EXISTS "app_buckets_read" ON storage.objects;
CREATE POLICY "app_buckets_read" ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id IN ('employee-avatars','employee-documents','company-documents','leave-attachments')
   AND (private_sec.current_user_is_hr() OR owner_id = (select auth.uid())::text));
DROP POLICY IF EXISTS "app_buckets_insert" ON storage.objects;
CREATE POLICY "app_buckets_insert" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id IN ('employee-avatars','employee-documents','company-documents','leave-attachments')
   AND (private_sec.current_user_is_hr() OR (bucket_id <> 'company-documents' AND owner_id = (select auth.uid())::text)));