-- =============================================================================
-- Migration: 20260914020000_fix_atomic_rpc_execution_and_delegation_revoke.sql
-- Purpose:   Convert decision RPCs to SECURITY DEFINER, add delegation revocation
--            RPC, adjust overtime insert policy, and refine pending overtime index.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1 - Replace 4 Decision RPCs with Safe SECURITY DEFINER implementations
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

  SELECT id, COALESCE(overtime_hours, 0)
  INTO v_att_id, v_current_ot
  FROM public.attendance_records
  WHERE employee_id = v_record.employee_id
    AND work_date   = v_record.work_date
  FOR UPDATE;

  v_new_ot := v_current_ot + v_record.hours;

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

CREATE OR REPLACE FUNCTION public.reject_overtime_request(p_overtime_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.overtime_records%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يرجى تسجيل الدخول' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    ) THEN
    RAISE EXCEPTION 'غير مصرح برفض العمل الإضافي' USING ERRCODE = '42501';
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
    status      = 'rejected',
    approved_by = auth.uid(),
    approved_at = now()
  WHERE id = p_overtime_id;

  RETURN jsonb_build_object(
    'ok',         true,
    'overtimeId', p_overtime_id,
    'rejectedBy', auth.uid(),
    'rejectedAt', now()
  );
END;
$$;

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

  v_payload   := COALESCE(v_req.payload, '{}'::jsonb);
  v_work_date := COALESCE(
    (v_payload->>'workDate')::date,
    v_req.start_date::date,
    CURRENT_DATE
  );
  v_check_in  := COALESCE(
    (v_payload->>'correctInTime')::time,
    (v_payload->>'correctIn')::time,
    '08:00'::time
  );
  v_check_out := COALESCE(
    (v_payload->>'correctOutTime')::time,
    (v_payload->>'correctOut')::time,
    '17:00'::time
  );
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

CREATE OR REPLACE FUNCTION public.reject_attendance_correction(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يرجى تسجيل الدخول' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    ) THEN
    RAISE EXCEPTION 'غير مصرح برفض تصحيح البصمة' USING ERRCODE = '42501';
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

  UPDATE public.requests
  SET
    status        = 'rejected',
    decided_by    = auth.uid(),
    decided_at    = now(),
    decision_note = 'تم رفض طلب تصحيح البصمة'
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok',         true,
    'requestId',  p_request_id,
    'rejectedBy', auth.uid(),
    'rejectedAt', now()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 2 - Create Atomic Delegation Revocation RPC (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.revoke_delegation_rule(p_delegation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.delegation_rules%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يرجى تسجيل الدخول' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_rule
  FROM public.delegation_rules
  WHERE id = p_delegation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'قاعدة التفويض غير موجودة' USING ERRCODE = 'P0002';
  END IF;

  IF v_rule.status <> 'active' THEN
    RAISE EXCEPTION 'قاعدة التفويض ليست نشطة أو تم إلغاؤها بالفعل (الحالة: %)', v_rule.status
      USING ERRCODE = '23505';
  END IF;

  -- Allow revocation only if caller is delegator or has HR-admin role
  IF v_rule.delegator_id <> public.current_employee_id()
     AND NOT public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager']) THEN
    RAISE EXCEPTION 'غير مصرح بإلغاء قاعدة التفويض هذه' USING ERRCODE = '42501';
  END IF;

  UPDATE public.delegation_rules
  SET
    status     = 'revoked',
    revoked_at = now()
  WHERE id = p_delegation_id;

  RETURN jsonb_build_object(
    'ok',           true,
    'delegationId', p_delegation_id,
    'revokedAt',    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_delegation_rule(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_delegation_rule(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- STEP 3 - Update Overtime INSERT Policy
-- Allow employee to insert own overtime OR operational staff (super_admin, org_admin, hr_manager, attendance_officer)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "overtime_self_insert" ON public.overtime_records;
DROP POLICY IF EXISTS "overtime_submit_policy" ON public.overtime_records;

CREATE POLICY "overtime_submit_policy"
  ON public.overtime_records FOR INSERT TO authenticated
  WITH CHECK (
    (
      employee_id = public.current_employee_id()
      OR public.current_user_has_any_role(
        ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
      )
    )
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- STEP 4 - Replace Overtime Unique Pending Index with Time-Boundary Segments
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.overtime_active_unique_per_employee_date;

CREATE UNIQUE INDEX IF NOT EXISTS overtime_active_unique_per_employee_time
  ON public.overtime_records (employee_id, work_date, start_time, end_time)
  WHERE status = 'pending';
