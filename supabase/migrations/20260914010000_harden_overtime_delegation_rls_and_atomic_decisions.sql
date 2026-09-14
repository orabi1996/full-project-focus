-- =============================================================================
-- Migration: 20260914010000_harden_overtime_delegation_rls_and_atomic_decisions.sql
-- Purpose:   Security hardening + atomicity for overtime_records and delegation_rules.
--
-- WHAT THIS MIGRATION DOES
-- 1. Drops the insecure USING(true)/WITH CHECK(true) policies added in 20260914000000.
-- 2. Replaces them with ownership- and role-scoped policies.
-- 3. Revokes the over-broad GRANT ALL ... TO authenticated.
-- 4. Adds DB constraints (CHECK, unique index) to both tables.
-- 5. Creates four atomic decision RPCs (approve/reject overtime, approve/reject
--    attendance correction) that run in a single transaction with row-level locks.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1 - Drop insecure policies from 20260914000000
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "delegation_rules_read_authenticated"  ON public.delegation_rules;
DROP POLICY IF EXISTS "delegation_rules_write_authenticated" ON public.delegation_rules;
DROP POLICY IF EXISTS "overtime_records_read_authenticated"  ON public.overtime_records;
DROP POLICY IF EXISTS "overtime_records_write_authenticated" ON public.overtime_records;

-- ---------------------------------------------------------------------------
-- STEP 2 - Revoke over-broad SQL privileges; restore minimum DML
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.overtime_records FROM authenticated;
REVOKE ALL ON public.delegation_rules  FROM authenticated;

GRANT SELECT, INSERT ON public.overtime_records TO authenticated;
GRANT SELECT, INSERT ON public.delegation_rules TO authenticated;

GRANT ALL ON public.overtime_records TO service_role;
GRANT ALL ON public.delegation_rules  TO service_role;

-- ---------------------------------------------------------------------------
-- STEP 3 - Hardened RLS policies: overtime_records
-- ---------------------------------------------------------------------------

CREATE POLICY "overtime_own_or_hr_read"
  ON public.overtime_records FOR SELECT TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer','payroll_officer']
    )
  );

CREATE POLICY "overtime_self_insert"
  ON public.overtime_records FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());

CREATE POLICY "overtime_hr_update"
  ON public.overtime_records FOR UPDATE TO authenticated
  USING (
    public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  )
  WITH CHECK (
    public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  );

CREATE POLICY "overtime_hr_delete"
  ON public.overtime_records FOR DELETE TO authenticated
  USING (
    public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager','attendance_officer']
    )
  );

-- ---------------------------------------------------------------------------
-- STEP 4 - Hardened RLS policies: delegation_rules
-- ---------------------------------------------------------------------------

CREATE POLICY "delegation_own_or_hr_read"
  ON public.delegation_rules FOR SELECT TO authenticated
  USING (
    delegator_id = public.current_employee_id()
    OR delegate_id = public.current_employee_id()
    OR public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager']
    )
  );

CREATE POLICY "delegation_owner_insert"
  ON public.delegation_rules FOR INSERT TO authenticated
  WITH CHECK (
    delegator_id = public.current_employee_id()
    OR public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager']
    )
  );

CREATE POLICY "delegation_owner_or_hr_update"
  ON public.delegation_rules FOR UPDATE TO authenticated
  USING (
    delegator_id = public.current_employee_id()
    OR public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager']
    )
  )
  WITH CHECK (
    delegator_id = public.current_employee_id()
    OR public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager']
    )
  );

CREATE POLICY "delegation_hr_delete"
  ON public.delegation_rules FOR DELETE TO authenticated
  USING (
    public.current_user_has_any_role(
      ARRAY['super_admin','org_admin','hr_manager']
    )
  );

-- ---------------------------------------------------------------------------
-- STEP 5 - DB constraints and indexes
-- ---------------------------------------------------------------------------

ALTER TABLE public.delegation_rules
  ADD CONSTRAINT delegation_not_self
    CHECK (delegator_id <> delegate_id),
  ADD CONSTRAINT delegation_date_order
    CHECK (end_date >= start_date),
  ADD CONSTRAINT delegation_status_values
    CHECK (status IN ('active', 'revoked', 'expired'));

ALTER TABLE public.overtime_records
  ADD CONSTRAINT overtime_hours_positive
    CHECK (hours > 0),
  ADD CONSTRAINT overtime_rate_positive
    CHECK (rate_multiplier > 0),
  ADD CONSTRAINT overtime_total_nonneg
    CHECK (total_amount >= 0),
  ADD CONSTRAINT overtime_status_values
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS overtime_active_unique_per_employee_date
  ON public.overtime_records (employee_id, work_date)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- STEP 6 - Atomic RPC: approve_overtime_request
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_overtime_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_record  public.overtime_records%ROWTYPE;
  v_att_id  uuid;
  v_current_ot numeric(5,2);
  v_new_ot     numeric(5,2);
BEGIN
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

-- ---------------------------------------------------------------------------
-- STEP 7 - Atomic RPC: reject_overtime_request
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_overtime_request(p_overtime_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_record public.overtime_records%ROWTYPE;
BEGIN
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

-- ---------------------------------------------------------------------------
-- STEP 8 - Atomic RPC: approve_attendance_correction
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_attendance_correction(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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

-- ---------------------------------------------------------------------------
-- STEP 9 - Atomic RPC: reject_attendance_correction
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_attendance_correction(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%ROWTYPE;
BEGIN
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
-- STEP 10 - Grant / revoke on new RPCs
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.approve_overtime_request(uuid)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_overtime_request(uuid)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_attendance_correction(uuid)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_attendance_correction(uuid)    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.approve_overtime_request(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_overtime_request(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_attendance_correction(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_attendance_correction(uuid)  TO authenticated;
