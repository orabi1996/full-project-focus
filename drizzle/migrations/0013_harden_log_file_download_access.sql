CREATE OR REPLACE FUNCTION public.log_file_download_access(p_file_id uuid, p_access_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_type text := COALESCE(p_access_type, 'view');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;
  IF v_type NOT IN ('view', 'download', 'preview', 'print') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_access_type');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.file_objects f
    WHERE f.id = p_file_id
      AND (
        f.uploaded_by = v_uid
        OR private_sec.current_user_is_hr()
        OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = f.employee_id AND e.user_id = v_uid)
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, changes_summary)
  VALUES (v_uid, 'file_' || v_type, 'file_object', p_file_id::text, NULL);
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_file_download_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_file_download_access(uuid, text) TO authenticated;