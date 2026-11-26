DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
CREATE POLICY audit_events_insert ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
    AND COALESCE(entity_type, '') NOT IN ('file_object', 'file_objects', 'file')
    AND COALESCE(action, '') NOT LIKE 'file\_%'
  );