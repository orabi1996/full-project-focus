CREATE OR REPLACE FUNCTION public.current_user_is_hr()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('org_admin', 'hr_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_hr(uuid) FROM public;
REVOKE ALL ON FUNCTION public.is_hr(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_hr(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.current_user_is_hr() FROM public;
REVOKE ALL ON FUNCTION public.current_user_is_hr() FROM anon;
REVOKE ALL ON FUNCTION public.current_user_is_hr() FROM authenticated;
REVOKE ALL ON FUNCTION public.current_employee_id() FROM public;
REVOKE ALL ON FUNCTION public.current_employee_id() FROM anon;
REVOKE ALL ON FUNCTION public.current_employee_id() FROM authenticated;

DROP POLICY IF EXISTS "roles_read" ON public.user_roles;
CREATE POLICY "roles_select_own_or_hr" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_hr());
CREATE POLICY "roles_insert_hr" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "roles_update_hr" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "roles_delete_hr" ON public.user_roles FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_select_own_or_hr" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_user_is_hr());
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "dept_write" ON public.departments;
DROP POLICY IF EXISTS "dept_read" ON public.departments;
CREATE POLICY "dept_select_all" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "dept_insert_hr" ON public.departments FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "dept_update_hr" ON public.departments FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "dept_delete_hr" ON public.departments FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "emp_write" ON public.employees;
DROP POLICY IF EXISTS "emp_read" ON public.employees;
CREATE POLICY "emp_select" ON public.employees FOR SELECT TO authenticated
  USING (
    public.current_user_is_hr()
    OR user_id = auth.uid()
    OR manager_id = public.current_employee_id()
  );
CREATE POLICY "emp_insert_hr" ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "emp_update_hr_or_self" ON public.employees FOR UPDATE TO authenticated
  USING (public.current_user_is_hr() OR user_id = auth.uid())
  WITH CHECK (public.current_user_is_hr() OR user_id = auth.uid());
CREATE POLICY "emp_delete_hr" ON public.employees FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "att_write" ON public.attendance_records;
DROP POLICY IF EXISTS "att_read" ON public.attendance_records;
CREATE POLICY "att_select" ON public.attendance_records FOR SELECT TO authenticated
  USING (
    public.current_user_is_hr()
    OR employee_id = public.current_employee_id()
    OR employee_id IN (
      SELECT id FROM public.employees WHERE manager_id = public.current_employee_id()
    )
  );
CREATE POLICY "att_insert" ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "att_update_hr" ON public.attendance_records FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "att_delete_hr" ON public.attendance_records FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "req_read" ON public.requests;
DROP POLICY IF EXISTS "req_insert" ON public.requests;
DROP POLICY IF EXISTS "req_update" ON public.requests;
DROP POLICY IF EXISTS "req_delete" ON public.requests;
CREATE POLICY "req_select" ON public.requests FOR SELECT TO authenticated
  USING (
    public.current_user_is_hr()
    OR employee_id = public.current_employee_id()
    OR created_by = auth.uid()
    OR employee_id IN (
      SELECT id FROM public.employees WHERE manager_id = public.current_employee_id()
    )
  );
CREATE POLICY "req_insert_self" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY "req_update_decider" ON public.requests FOR UPDATE TO authenticated
  USING (
    public.current_user_is_hr()
    OR employee_id = public.current_employee_id()
    OR employee_id IN (
      SELECT id FROM public.employees WHERE manager_id = public.current_employee_id()
    )
  );
CREATE POLICY "req_delete" ON public.requests FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "schedule_read" ON public.schedule_assignments;
CREATE POLICY "sched_select" ON public.schedule_assignments FOR SELECT TO authenticated
  USING (
    public.current_user_is_hr()
    OR employee_id = public.current_employee_id()
    OR employee_id IN (
      SELECT id FROM public.employees WHERE manager_id = public.current_employee_id()
    )
  );
CREATE POLICY "sched_insert_hr" ON public.schedule_assignments FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "sched_update_hr" ON public.schedule_assignments FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "sched_delete_hr" ON public.schedule_assignments FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "leave_balances_read" ON public.leave_balances;
CREATE POLICY "lb_select" ON public.leave_balances FOR SELECT TO authenticated
  USING (
    public.current_user_is_hr()
    OR employee_id = public.current_employee_id()
    OR employee_id IN (
      SELECT id FROM public.employees WHERE manager_id = public.current_employee_id()
    )
  );
CREATE POLICY "lb_insert_hr" ON public.leave_balances FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "lb_update_hr" ON public.leave_balances FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "lb_delete_hr" ON public.leave_balances FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "punches_read" ON public.punches;
CREATE POLICY "punch_select" ON public.punches FOR SELECT TO authenticated
  USING (
    public.current_user_is_hr()
    OR employee_id = public.current_employee_id()
    OR employee_id IN (
      SELECT id FROM public.employees WHERE manager_id = public.current_employee_id()
    )
  );
CREATE POLICY "punch_insert" ON public.punches FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY "punch_update_hr" ON public.punches FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "punch_delete_hr" ON public.punches FOR DELETE TO authenticated
  USING (public.current_user_is_hr());