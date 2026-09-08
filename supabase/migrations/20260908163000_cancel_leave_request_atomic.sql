-- Allow an employee to cancel a still-pending request and release any leave
-- reservation created at submission time.

CREATE OR REPLACE FUNCTION public.cancel_request_atomic(
  p_request_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private_sec
AS $$
DECLARE
  v_request public.requests%ROWTYPE;
  v_employee_name text;
  v_note text := NULLIF(left(trim(COALESCE(p_note, '')), 500), '');
  v_leave_year integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لإلغاء الطلب';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'معرّف الطلب مطلوب';
  END IF;

  SELECT *
  INTO v_request
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'لا يمكن إلغاء طلب تمت معالجته مسبقًا';
  END IF;
  IF NOT (
    v_request.created_by = auth.uid()
    OR v_request.employee_id IS NOT DISTINCT FROM private_sec.current_employee_id()
    OR public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager'])
  ) THEN
    RAISE EXCEPTION 'غير مصرح بإلغاء هذا الطلب';
  END IF;

  IF v_request.type = 'leave'
     AND v_request.leave_type_id IS NOT NULL
     AND COALESCE(v_request.days, 0) > 0 THEN
    v_leave_year := COALESCE(
      NULLIF(left(COALESCE(v_request.start_date::text, ''), 4), '')::integer,
      EXTRACT(YEAR FROM CURRENT_DATE)::integer
    );
    PERFORM public.settle_leave_reservation_atomic(
      v_request.employee_id,
      v_request.leave_type_id,
      v_leave_year,
      v_request.days,
      'release'
    );
  END IF;

  UPDATE public.requests
  SET status = 'cancelled',
      decision_note = v_note,
      decided_by = auth.uid(),
      decided_at = now(),
      current_approver_role = NULL
  WHERE id = v_request.id;

  UPDATE public.approval_steps
  SET status = 'cancelled',
      note = COALESCE(v_note, note),
      acted_by = auth.uid(),
      acted_at = now()
  WHERE request_id = v_request.id
    AND status IN ('pending', 'waiting');

  SELECT full_name INTO v_employee_name
  FROM public.employees
  WHERE id = v_request.employee_id;

  INSERT INTO public.request_timeline (
    request_id,
    step_number,
    actor_id,
    actor_name,
    actor_role,
    action,
    note
  ) VALUES (
    v_request.id,
    COALESCE(v_request.current_step_index, 1),
    auth.uid(),
    COALESCE(v_employee_name, 'مستخدم'),
    'مقدم الطلب',
    'cancelled',
    COALESCE(v_note, 'تم إلغاء الطلب وإرجاع الحجز')
  );

  RETURN jsonb_build_object(
    'requestId', v_request.id,
    'status', 'cancelled',
    'leaveReservationReleased', (
      v_request.type = 'leave'
      AND v_request.leave_type_id IS NOT NULL
      AND COALESCE(v_request.days, 0) > 0
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_request_atomic(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_request_atomic(uuid, text) TO authenticated;
