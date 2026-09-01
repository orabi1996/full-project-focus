-- 1) Move RLS helper functions out of the API-exposed public schema.
CREATE SCHEMA IF NOT EXISTS private_sec;
REVOKE ALL ON SCHEMA private_sec FROM PUBLIC;
GRANT USAGE ON SCHEMA private_sec TO authenticated, service_role;

ALTER FUNCTION public.current_user_is_hr() SET SCHEMA private_sec;
ALTER FUNCTION public.current_employee_id() SET SCHEMA private_sec;

ALTER FUNCTION private_sec.current_user_is_hr() SET search_path = public;
ALTER FUNCTION private_sec.current_employee_id() SET search_path = public;

REVOKE ALL ON FUNCTION private_sec.current_user_is_hr() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_sec.current_employee_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private_sec.current_user_is_hr() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private_sec.current_employee_id() TO authenticated, service_role;

-- 2) audit_events: entries must be attributed to the acting user.
DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
CREATE POLICY audit_events_insert ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
  );

-- 3) notifications_inbox: no arbitrary cross-user notifications.
DROP POLICY IF EXISTS notifications_insert ON public.notifications_inbox;
CREATE POLICY notifications_insert ON public.notifications_inbox
  FOR INSERT TO authenticated
  WITH CHECK (recipient_id = auth.uid() OR private_sec.current_user_is_hr());

-- 4) request_timeline: only own requests or HR, always as self.
DROP POLICY IF EXISTS request_timeline_insert ON public.request_timeline;
CREATE POLICY request_timeline_insert ON public.request_timeline
  FOR INSERT TO authenticated
  WITH CHECK (
    (actor_id IS NULL OR actor_id = auth.uid())
    AND (
      private_sec.current_user_is_hr()
      OR request_id IN (
        SELECT r.id FROM public.requests r
        WHERE r.employee_id = private_sec.current_employee_id()
      )
    )
  );

-- 5) Consolidate the duplicate acknowledgment tables into one.
INSERT INTO public.document_acknowledgements (document_id, employee_id, acknowledged_at)
SELECT d.document_id, d.employee_id, d.acknowledged_at
FROM public.document_acknowledgments d
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_acknowledgements e
  WHERE e.document_id = d.document_id AND e.employee_id = d.employee_id
);

DROP TABLE public.document_acknowledgments;

CREATE UNIQUE INDEX IF NOT EXISTS document_acknowledgements_unique_idx
  ON public.document_acknowledgements (document_id, employee_id);

DROP POLICY IF EXISTS document_acknowledgements_update ON public.document_acknowledgements;
CREATE POLICY document_acknowledgements_update ON public.document_acknowledgements
  FOR UPDATE TO authenticated
  USING (private_sec.current_user_is_hr())
  WITH CHECK (private_sec.current_user_is_hr());

DROP POLICY IF EXISTS document_acknowledgements_delete ON public.document_acknowledgements;
CREATE POLICY document_acknowledgements_delete ON public.document_acknowledgements
  FOR DELETE TO authenticated
  USING (private_sec.current_user_is_hr());

-- 6) candidates: explicit granular write policies instead of a blanket ALL policy.
DROP POLICY IF EXISTS candidates_write_hr ON public.candidates;
CREATE POLICY candidates_insert ON public.candidates
  FOR INSERT TO authenticated
  WITH CHECK (private_sec.current_user_is_hr());
CREATE POLICY candidates_update ON public.candidates
  FOR UPDATE TO authenticated
  USING (private_sec.current_user_is_hr())
  WITH CHECK (private_sec.current_user_is_hr());
CREATE POLICY candidates_delete ON public.candidates
  FOR DELETE TO authenticated
  USING (private_sec.current_user_is_hr());