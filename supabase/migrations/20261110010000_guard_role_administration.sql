-- Keep existing grants/read policies. Restrictive write guards prevent HR-only escalation.
BEGIN;
DROP POLICY IF EXISTS guard_role_assignment_insert ON public.user_roles;
CREATE POLICY guard_role_assignment_insert ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
DROP POLICY IF EXISTS guard_role_assignment_update ON public.user_roles;
CREATE POLICY guard_role_assignment_update ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
DROP POLICY IF EXISTS guard_role_assignment_delete ON public.user_roles;
CREATE POLICY guard_role_assignment_delete ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
COMMIT;
