-- Restrictive tenant checks intersect existing role policies without granting access.
BEGIN;
CREATE OR REPLACE FUNCTION public.can_access_core_company(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND (
   public.has_role(auth.uid(),'super_admin'::public.app_role)
   OR (p_company_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.employees e WHERE e.user_id=auth.uid() AND e.company_id=p_company_id
   ))
 );
$$;
REVOKE ALL ON FUNCTION public.can_access_core_company(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_core_company(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_employee_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL AND current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL AND (
   public.has_role(auth.uid(),'super_admin'::public.app_role) OR public.is_hr(auth.uid())
 ) THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL OR OLD.user_id IS DISTINCT FROM auth.uid() OR
   (to_jsonb(NEW)-ARRAY['phone','personal_email','updated_at']) IS DISTINCT FROM
   (to_jsonb(OLD)-ARRAY['phone','personal_email','updated_at']) THEN
   RAISE EXCEPTION 'Self-service can update only contact information' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_employee_self_update() FROM PUBLIC,anon;
DROP TRIGGER IF EXISTS guard_employee_self_update ON public.employees;
CREATE TRIGGER guard_employee_self_update BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.guard_employee_self_update();

DROP POLICY IF EXISTS guard_core_company ON public.employees;
CREATE POLICY guard_core_company ON public.employees AS RESTRICTIVE FOR ALL TO authenticated
USING(public.can_access_core_company(company_id)) WITH CHECK(public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_core_company ON public.departments;
CREATE POLICY guard_core_company ON public.departments AS RESTRICTIVE FOR ALL TO authenticated
USING(public.can_access_core_company(company_id)) WITH CHECK(public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_core_company ON public.subsidiaries;
CREATE POLICY guard_core_company ON public.subsidiaries AS RESTRICTIVE FOR ALL TO authenticated
USING(public.can_access_core_company(company_id)) WITH CHECK(public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_core_company ON public.work_locations;
CREATE POLICY guard_core_company ON public.work_locations AS RESTRICTIVE FOR ALL TO authenticated
USING(public.can_access_core_company(company_id)) WITH CHECK(public.can_access_core_company(company_id));
DROP POLICY IF EXISTS guard_core_company ON public.companies;
CREATE POLICY guard_core_company ON public.companies AS RESTRICTIVE FOR ALL TO authenticated
USING(public.can_access_core_company(id)) WITH CHECK(public.can_access_core_company(id));
COMMIT;
