-- Restrict direct permission/role-definition writes; existing grants and permissive policies still apply.
BEGIN;
DROP POLICY IF EXISTS guard_permission_admin_insert ON public.role_definitions;
CREATE POLICY guard_permission_admin_insert ON public.role_definitions AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role))
;
DROP POLICY IF EXISTS guard_permission_admin_update ON public.role_definitions;
CREATE POLICY guard_permission_admin_update ON public.role_definitions AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role))
;
DROP POLICY IF EXISTS guard_permission_admin_delete ON public.role_definitions;
CREATE POLICY guard_permission_admin_delete ON public.role_definitions AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
;
DROP POLICY IF EXISTS guard_permission_admin_insert ON public.role_permissions;
CREATE POLICY guard_permission_admin_insert ON public.role_permissions AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role))
;
DROP POLICY IF EXISTS guard_permission_admin_update ON public.role_permissions;
CREATE POLICY guard_permission_admin_update ON public.role_permissions AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role))
;
DROP POLICY IF EXISTS guard_permission_admin_delete ON public.role_permissions;
CREATE POLICY guard_permission_admin_delete ON public.role_permissions AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
;
COMMIT;
