CREATE OR REPLACE FUNCTION public.finalize_file_replacement(p_previous_file_id uuid, p_new_file_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT private_sec.current_user_is_hr() AND EXISTS (
    SELECT 1 FROM public.file_objects
    WHERE id IN (p_previous_file_id, p_new_file_id)
      AND COALESCE(uploaded_by, created_by) IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'غير مصرح باستبدال هذا الملف' USING ERRCODE = '42501';
  END IF;
  UPDATE public.file_objects SET status = 'archived', archived_at = now() WHERE id = p_previous_file_id;
  UPDATE public.file_objects SET status = 'active' WHERE id = p_new_file_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_performance_goal_atomic(p_cycle_id uuid, p_employee_id uuid, p_parent_goal_id uuid, p_category text, p_level text, p_title_ar text, p_title_en text, p_description text, p_metric_type text, p_start_value numeric, p_target_value numeric, p_weight numeric)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_goal_id uuid;
  v_is_owner boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id AND user_id = auth.uid()) INTO v_is_owner;
  IF NOT (private_sec.current_user_is_hr() OR v_is_owner) THEN
    RAISE EXCEPTION 'غير مصرح بإضافة أهداف لهذا الموظف' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM performance_cycles c JOIN employees e ON e.id = p_employee_id
    WHERE c.id = p_cycle_id AND (c.company_id IS NULL OR c.company_id = e.company_id)
  ) THEN
    RAISE EXCEPTION 'دورة التقييم لا تتبع منشأة الموظف' USING ERRCODE = '42501';
  END IF;
  IF p_title_ar IS NULL OR btrim(p_title_ar) = '' THEN
    RAISE EXCEPTION 'عنوان الهدف مطلوب' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO performance_goals (cycle_id, employee_id, parent_goal_id, category, level, title_ar, title_en, description, metric_type, start_value, target_value, current_value, weight, status)
  VALUES (p_cycle_id, p_employee_id, p_parent_goal_id, COALESCE(p_category, 'individual'), COALESCE(p_level, 'individual'), p_title_ar, p_title_en, p_description, COALESCE(p_metric_type, 'percentage'), COALESCE(p_start_value, 0), COALESCE(p_target_value, 100), COALESCE(p_start_value, 0), COALESCE(p_weight, 0), 'active')
  RETURNING id INTO v_goal_id;
  RETURN jsonb_build_object('success', true, 'goal_id', v_goal_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_performance_kpis_atomic(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalize_file_replacement(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_performance_goal_atomic(uuid,uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_kpis_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_file_replacement(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_performance_goal_atomic(uuid,uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric) TO authenticated;

DO $$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('public.get_performance_kpis_atomic(uuid)'::regprocedure);
  v_def := replace(v_def, E'BEGIN\n  SELECT count(*) INTO v_active_cycles',
    E'BEGIN\n  IF NOT private_sec.current_user_is_hr() THEN\n    RAISE EXCEPTION ''not authorized'' USING ERRCODE = ''42501'';\n  END IF;\n  SELECT count(*) INTO v_active_cycles');
  EXECUTE v_def;
END $$;