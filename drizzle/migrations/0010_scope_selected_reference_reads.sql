CREATE FUNCTION private_sec.current_user_is_org_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees e WHERE e.user_id = auth.uid() AND e.company_id IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION private_sec.current_user_is_org_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private_sec.current_user_is_org_member() TO authenticated, service_role;

ALTER POLICY role_perm_select ON public.role_permissions TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin')
  OR (private_sec.current_user_is_org_member() AND private_sec.current_user_has_role(role_key)));
ALTER POLICY role_def_select ON public.role_definitions TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin')
  OR (private_sec.current_user_is_org_member() AND private_sec.current_user_has_role(role_key)));

ALTER POLICY companies_select ON public.companies TO authenticated USING (public.can_access_core_company(id));
ALTER POLICY dept_select_all ON public.departments TO authenticated USING (public.can_access_core_company(company_id));
ALTER POLICY subsidiaries_select ON public.subsidiaries TO authenticated USING (public.can_access_core_company(company_id));
ALTER POLICY work_locations_select ON public.work_locations TO authenticated USING (public.can_access_core_company(company_id));
ALTER POLICY comp_frameworks_select ON public.competency_frameworks TO authenticated USING (public.can_access_core_company(company_id));
ALTER POLICY competencies_select ON public.competencies TO authenticated USING (public.can_access_core_company(company_id));
ALTER POLICY perf_cycles_select ON public.performance_cycles TO authenticated USING (public.can_access_core_company(company_id));
ALTER POLICY review_templates_select ON public.review_templates TO authenticated USING (public.can_access_core_company(company_id));
ALTER POLICY perf_crit_select ON public.performance_criteria TO authenticated USING (
  EXISTS (SELECT 1 FROM public.performance_cycles parent WHERE parent.id = performance_criteria.cycle_id AND public.can_access_core_company(parent.company_id)));
ALTER POLICY review_template_items_select ON public.review_template_items TO authenticated USING (
  EXISTS (SELECT 1 FROM public.review_templates parent WHERE parent.id = review_template_items.template_id AND public.can_access_core_company(parent.company_id)));

ALTER POLICY ref_lists_select ON public.reference_lists TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin') OR private_sec.current_user_is_org_member());
ALTER POLICY expense_categories_select ON public.expense_categories TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin') OR private_sec.current_user_is_org_member());
ALTER POLICY approval_chains_select ON public.approval_chains TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin') OR private_sec.current_user_is_org_member());
ALTER POLICY leave_types_select ON public.leave_types TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin')
  OR public.can_access_core_company(company_id)
  OR (company_id IS NULL AND private_sec.current_user_is_org_member()));
ALTER POLICY org_settings_select ON public.org_settings TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin'));
ALTER POLICY job_openings_select ON public.job_openings TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('recruiter') OR private_sec.current_user_has_role('auditor'));
ALTER POLICY company_documents_select ON public.company_documents TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin')
  OR (status = 'active' AND EXISTS (
    SELECT 1 FROM public.employees e WHERE e.user_id = auth.uid() AND e.company_id IS NOT NULL
    AND ((visibility_scope = 'all')
      OR (visibility_scope = 'department' AND company_documents.department_id = e.department_id)
      OR (visibility_scope = 'subsidiary' AND company_documents.subsidiary_id = e.subsidiary_id))
  )));
ALTER POLICY shifts_read ON public.shifts TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin')
  OR private_sec.current_user_has_role('attendance_officer') OR private_sec.current_user_has_role('line_manager')
  OR private_sec.current_user_has_role('auditor')
  OR (private_sec.current_user_is_org_member() AND EXISTS (
    SELECT 1 FROM public.schedule_assignments a WHERE a.shift_id = shifts.id AND a.employee_id = private_sec.current_employee_id()
  )));
ALTER POLICY overtime_records_select ON public.overtime_records TO authenticated USING (
  private_sec.current_user_is_hr() OR private_sec.current_user_has_role('super_admin')
  OR employee_id = private_sec.current_employee_id());