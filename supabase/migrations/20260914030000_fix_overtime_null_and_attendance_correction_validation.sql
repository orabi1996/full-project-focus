-- =============================================================================
-- Migration: 20260914030000_fix_overtime_null_and_attendance_correction_validation.sql
-- Purpose:   1. Fix NULL initialization in approve_overtime_request when no
--               attendance record exists yet for the employee/date.
--            2. Require explicit valid correction times in approve_attendance_correction
--               instead of silently fabricating default 08:00/17:00 values.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1 - Fix approve_overtime_request to safely initialize overtime from zero
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_overtime_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record     public.overtime_records%ROWTYPE;
  v_att_id     uuid;
  v_current_ot numeric(5,2);
  v_new_ot     numeric(5,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يرجى تسجيل الدخول' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    ) THEN
    RAISE EXCEPTION 'غير مصرح باعتماد العمل الإضافي' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_record
  FROM public.overtime_records
  WHERE id = p_overtime_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب العمل الإضافي غير موجود' USING ERRCODE = 'P0002';
  END IF;

  IF v_record.status <> 'pending' THEN
    RAISE EXCEPTION 'تم اتخاذ القرار في طلب العمل الإضافي مسبقاً (الحالة: %)', v_record.status
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.overtime_records
  SET
    status      = 'approved',
    approved_by = auth.uid(),
    approved_at = now()
  WHERE id = p_overtime_id;

  v_current_ot := 0;
  SELECT id, COALESCE(overtime_hours, 0)
  INTO v_att_id, v_current_ot
  FROM public.attendance_records
  WHERE employee_id = v_record.employee_id
    AND work_date   = v_record.work_date
  FOR UPDATE;

  -- Safely default to zero if no prior attendance row existed
  v_new_ot := COALESCE(v_current_ot, 0) + v_record.hours;

  IF v_att_id IS NOT NULL THEN
    UPDATE public.attendance_records
    SET overtime_hours = v_new_ot
    WHERE id = v_att_id;
  ELSE
    INSERT INTO public.attendance_records
      (employee_id, work_date, overtime_hours, status, worked_hours, note)
    VALUES
      (v_record.employee_id, v_record.work_date, v_new_ot,
       'present', 0, 'سجل حضور مضاف آلياً مع العمل الإضافي');
  END IF;

  RETURN jsonb_build_object(
    'ok',          true,
    'overtimeId',  p_overtime_id,
    'employeeId',  v_record.employee_id,
    'hours',       v_record.hours,
    'approvedBy',  auth.uid(),
    'approvedAt',  now()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 2 - Fix approve_attendance_correction to strictly validate correction data
--          without silently fabricating 08:00 / 17:00 defaults
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_attendance_correction(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req         public.requests%ROWTYPE;
  v_payload     jsonb;
  v_work_date   date;
  v_check_in    time;
  v_check_out   time;
  v_worked_hrs  numeric(5,2);
  v_att_id      uuid;
  v_in_str      text;
  v_out_str     text;
  v_date_str    text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يرجى تسجيل الدخول' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    ) THEN
    RAISE EXCEPTION 'غير مصرح باعتماد تصحيح البصمة' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب تصحيح البصمة غير موجود' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.type <> 'attendance_fix' THEN
    RAISE EXCEPTION 'الطلب ليس من نوع تصحيح بصمة';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'تم اتخاذ القرار في هذا الطلب مسبقاً (الحالة: %)', v_req.status
      USING ERRCODE = '23505';
  END IF;

  v_payload := COALESCE(v_req.payload, '{}'::jsonb);

  -- Extract and validate work date
  v_date_str := NULLIF(TRIM(v_payload->>'workDate'), '');
  IF v_date_str IS NOT NULL THEN
    BEGIN
      v_work_date := v_date_str::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'تاريخ العمل المدخل في طلب تصحيح البصمة غير صالح' USING ERRCODE = '22023';
    END;
  ELSE
    v_work_date := v_req.start_date::date;
  END IF;

  IF v_work_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ العمل مطلوب لاعتماد طلب تصحيح البصمة' USING ERRCODE = '22023';
  END IF;

  -- Extract and validate correctIn
  v_in_str := COALESCE(
    NULLIF(TRIM(v_payload->>'correctInTime'), ''),
    NULLIF(TRIM(v_payload->>'correctIn'), '')
  );

  IF v_in_str IS NULL THEN
    RAISE EXCEPTION 'وقت الحضور المصحح مطلوب لاعتماد الطلب' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_check_in := v_in_str::time;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'صيغة وقت الحضور المصحح غير صالحة' USING ERRCODE = '22023';
  END;

  -- Extract and validate correctOut
  v_out_str := COALESCE(
    NULLIF(TRIM(v_payload->>'correctOutTime'), ''),
    NULLIF(TRIM(v_payload->>'correctOut'), '')
  );

  IF v_out_str IS NULL THEN
    RAISE EXCEPTION 'وقت الانصراف المصحح مطلوب لاعتماد الطلب' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_check_out := v_out_str::time;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'صيغة وقت الانصراف المصحح غير صالحة' USING ERRCODE = '22023';
  END;

  -- Calculate worked hours
  v_worked_hrs := GREATEST(
    0,
    ROUND(
      EXTRACT(EPOCH FROM (v_check_out - v_check_in)) / 3600.0,
      2
    )::numeric(5,2)
  );

  UPDATE public.requests
  SET
    status        = 'approved',
    decided_by    = auth.uid(),
    decided_at    = now(),
    decision_note = 'تم اعتماد تصحيح البصمة وتحديث السجلات'
  WHERE id = p_request_id;

  SELECT id INTO v_att_id
  FROM public.attendance_records
  WHERE employee_id = v_req.employee_id
    AND work_date   = v_work_date
  FOR UPDATE;

  IF v_att_id IS NOT NULL THEN
    UPDATE public.attendance_records
    SET
      check_in     = v_check_in,
      check_out    = v_check_out,
      status       = 'present',
      worked_hours = v_worked_hrs,
      note         = 'تم تصحيح البصمة بموجب طلب معتمد'
    WHERE id = v_att_id;
  ELSE
    INSERT INTO public.attendance_records
      (employee_id, work_date, check_in, check_out, status, worked_hours, note)
    VALUES
      (v_req.employee_id, v_work_date, v_check_in, v_check_out,
       'present', v_worked_hrs, 'سجل حضور تم إنشاؤه بموجب تصحيح بصمة معتمد');
  END IF;

  RETURN jsonb_build_object(
    'ok',          true,
    'requestId',   p_request_id,
    'employeeId',  v_req.employee_id,
    'workDate',    v_work_date,
    'approvedBy',  auth.uid(),
    'approvedAt',  now()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 3 - Revoke from PUBLIC, grant to authenticated
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.approve_overtime_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_attendance_correction(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.approve_overtime_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_attendance_correction(uuid) TO authenticated;
