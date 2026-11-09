-- Restrictive guards intersect existing permissive policies; they do not grant access.
-- Direct approval delegation and priced overtime creation require existing HR authority.
BEGIN;
DROP POLICY IF EXISTS guard_delegation_insert ON public.delegation_rules;
CREATE POLICY guard_delegation_insert ON public.delegation_rules AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_hr(auth.uid()) AND created_by = auth.uid());
DROP POLICY IF EXISTS guard_delegation_read ON public.delegation_rules;
CREATE POLICY guard_delegation_read ON public.delegation_rules AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_hr(auth.uid()) OR EXISTS (
  SELECT 1 FROM public.employees e WHERE e.user_id=auth.uid() AND e.id IN (delegator_id,delegate_id)
));
DROP POLICY IF EXISTS guard_overtime_insert ON public.overtime_records;
CREATE POLICY guard_overtime_insert ON public.overtime_records AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_hr(auth.uid()) AND created_by=auth.uid() AND status='pending' AND decided_by IS NULL AND decided_at IS NULL);
DROP POLICY IF EXISTS guard_overtime_read ON public.overtime_records;
CREATE POLICY guard_overtime_read ON public.overtime_records AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_hr(auth.uid()) OR EXISTS (
  SELECT 1 FROM public.employees e WHERE e.user_id=auth.uid() AND e.id=employee_id
));
-- File registration must identify the current uploader; self-service must own its employee scope.
DROP POLICY IF EXISTS guard_file_insert ON public.file_objects;
CREATE POLICY guard_file_insert ON public.file_objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (uploaded_by=auth.uid() AND (created_by IS NULL OR created_by=auth.uid()) AND (
  public.is_hr(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.employees e WHERE e.user_id=auth.uid() AND e.id=employee_id AND e.company_id=file_objects.company_id
  )
));
DROP POLICY IF EXISTS guard_file_read ON public.file_objects;
CREATE POLICY guard_file_read ON public.file_objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_hr(auth.uid()) OR uploaded_by=auth.uid() OR EXISTS (
  SELECT 1 FROM public.employees e WHERE e.user_id=auth.uid() AND e.id=employee_id AND e.company_id=file_objects.company_id
));
COMMIT;
