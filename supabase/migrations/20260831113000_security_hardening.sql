-- ============================================================================
-- HRMS security hardening
-- - New accounts start as employees, never HR managers.
-- - Sensitive records are visible only to the owner or authorized HR roles.
-- - Mutations receive explicit, least-privilege RLS policies.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_is_hr()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('org_admin', 'hr_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.employees
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_user_is_hr() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_employee_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_hr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.employees
  SET user_id = NEW.id
  WHERE user_id IS NULL
    AND NEW.email IS NOT NULL
    AND lower(email) = lower(NEW.email);

  IF NOT FOUND THEN
    INSERT INTO public.employees (
      user_id,
      employee_no,
      full_name,
      email,
      job_title,
      hire_date,
      status
    )
    VALUES (
      NEW.id,
      'USR-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8)),
      COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(NEW.email, '@', 1)),
      NEW.email,
      'غير محدد',
      CURRENT_DATE,
      'active'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Core identity and workforce data.
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_or_hr_read" ON public.profiles;
CREATE POLICY "profiles_self_or_hr_read"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_user_is_hr());

DROP POLICY IF EXISTS "roles_read" ON public.user_roles;
DROP POLICY IF EXISTS "roles_self_or_hr_read" ON public.user_roles;
CREATE POLICY "roles_self_or_hr_read"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_hr());

DROP POLICY IF EXISTS "emp_read" ON public.employees;
DROP POLICY IF EXISTS "emp_write" ON public.employees;
DROP POLICY IF EXISTS "employees_self_or_hr_read" ON public.employees;
CREATE POLICY "employees_self_or_hr_read"
  ON public.employees FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_hr());
CREATE POLICY "employees_hr_write"
  ON public.employees FOR ALL TO authenticated
  USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "att_read" ON public.attendance_records;
DROP POLICY IF EXISTS "att_write" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_self_or_hr_read" ON public.attendance_records;
CREATE POLICY "attendance_self_or_hr_read"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY "attendance_hr_write"
  ON public.attendance_records FOR ALL TO authenticated
  USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "attendance_self_insert"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());
CREATE POLICY "attendance_self_update"
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id())
  WITH CHECK (employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "req_read" ON public.requests;
DROP POLICY IF EXISTS "req_insert" ON public.requests;
DROP POLICY IF EXISTS "req_update" ON public.requests;
DROP POLICY IF EXISTS "req_delete" ON public.requests;
DROP POLICY IF EXISTS "requests_self_or_hr_read" ON public.requests;
CREATE POLICY "requests_self_or_hr_read"
  ON public.requests FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR employee_id = public.current_employee_id()
    OR public.current_user_is_hr()
  );
CREATE POLICY "requests_owner_insert"
  ON public.requests FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND employee_id = public.current_employee_id()
  );
CREATE POLICY "requests_hr_update"
  ON public.requests FOR UPDATE TO authenticated
  USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "requests_hr_delete"
  ON public.requests FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "dept_write" ON public.departments;
CREATE POLICY "departments_hr_write"
  ON public.departments FOR ALL TO authenticated
  USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());

-- Employee-owned operational data.
DROP POLICY IF EXISTS "schedule_read" ON public.schedule_assignments;
CREATE POLICY "schedule_self_or_hr_read"
  ON public.schedule_assignments FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());

DROP POLICY IF EXISTS "punches_read" ON public.punches;
CREATE POLICY "punches_self_or_hr_read"
  ON public.punches FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY "punches_self_insert"
  ON public.punches FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "leave_balances_read" ON public.leave_balances;
CREATE POLICY "leave_balances_self_or_hr_read"
  ON public.leave_balances FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());

DROP POLICY IF EXISTS "loans_read" ON public.loans;
CREATE POLICY "loans_self_or_hr_read"
  ON public.loans FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());

DROP POLICY IF EXISTS "settlements_read" ON public.settlements;
CREATE POLICY "settlements_self_or_hr_read"
  ON public.settlements FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());

DROP POLICY IF EXISTS "expense_claims_read" ON public.expense_claims;
CREATE POLICY "expense_claims_self_or_hr_read"
  ON public.expense_claims FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY "expense_claims_self_insert"
  ON public.expense_claims FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "assets_read" ON public.hardware_assets;
CREATE POLICY "assets_self_or_hr_read"
  ON public.hardware_assets FOR SELECT TO authenticated
  USING (
    assigned_to_employee_id = public.current_employee_id()
    OR assigned_to_employee_id IS NULL
    OR public.current_user_is_hr()
  );

DROP POLICY IF EXISTS "notifications_read" ON public.notifications_inbox;
CREATE POLICY "notifications_owner_read"
  ON public.notifications_inbox FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY "notifications_owner_update"
  ON public.notifications_inbox FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "audit_read" ON public.audit_events;
CREATE POLICY "audit_hr_read"
  ON public.audit_events FOR SELECT TO authenticated
  USING (public.current_user_is_hr());
CREATE POLICY "audit_authenticated_insert"
  ON public.audit_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- HR write access for controlled master and operational records.
CREATE POLICY "companies_hr_write" ON public.companies
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "subsidiaries_hr_write" ON public.subsidiaries
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "locations_hr_write" ON public.work_locations
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "shifts_hr_write" ON public.shifts
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "schedule_hr_write" ON public.schedule_assignments
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "leave_types_hr_write" ON public.leave_types
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "leave_balances_hr_write" ON public.leave_balances
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "payroll_groups_hr_write" ON public.payroll_groups
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "payroll_runs_hr_write" ON public.payroll_runs
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "loans_hr_write" ON public.loans
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "settlements_hr_write" ON public.settlements
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "expense_categories_hr_write" ON public.expense_categories
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "expense_claims_hr_write" ON public.expense_claims
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "jobs_hr_write" ON public.job_openings
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "candidates_hr_write" ON public.candidates
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "assets_hr_write" ON public.hardware_assets
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "company_docs_hr_write" ON public.company_documents
  FOR ALL TO authenticated USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());
