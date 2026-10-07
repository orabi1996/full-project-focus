-- ============================================================================
-- PROMPT 25: PRODUCTION EMPLOYEE SELF-SERVICE, MANAGER SELF-SERVICE & MOBILE
-- Migration: 20261008000000_production_employee_manager_self_service_mobile.sql
-- ============================================================================

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 1. EMPLOYEE PROFILE CHANGE REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  request_number text NOT NULL,
  field_name text NOT NULL,
  field_label_ar text NOT NULL,
  field_label_en text NOT NULL,
  old_value text,
  requested_value text NOT NULL,
  reason text NOT NULL,
  attachment_file_id uuid,
  attachment_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pcr_request_number_company UNIQUE (company_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_pcr_company_emp ON public.employee_profile_change_requests(company_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_pcr_status ON public.employee_profile_change_requests(company_id, status);

-- ----------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY ON PROFILE CHANGE REQUESTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.employee_profile_change_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "pcr_select_policy" ON public.employee_profile_change_requests;
  DROP POLICY IF EXISTS "pcr_insert_policy" ON public.employee_profile_change_requests;
  DROP POLICY IF EXISTS "pcr_update_policy" ON public.employee_profile_change_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "pcr_select_policy" ON public.employee_profile_change_requests
  FOR SELECT
  TO authenticated
  USING (
    -- Direct employee ownership
    employee_id = public.resolve_my_employee_id()
    -- Manager scope for direct reports
    OR employee_id IN (
      SELECT id FROM public.employees 
      WHERE manager_id = public.resolve_my_employee_id() 
         OR manager_employee_id = public.resolve_my_employee_id()
    )
    -- HR / Admin roles or company isolation
    OR (
      company_id = public.current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role_id IN ('super_admin', 'hr_manager', 'hr_specialist', 'admin')
      )
    )
  );

CREATE POLICY "pcr_insert_policy" ON public.employee_profile_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = public.resolve_my_employee_id()
    AND (company_id = public.current_company_id() OR public.current_company_id() IS NULL)
  );

CREATE POLICY "pcr_update_policy" ON public.employee_profile_change_requests
  FOR UPDATE
  TO authenticated
  USING (
    -- Only managers or HR can review/update status
    employee_id IN (
      SELECT id FROM public.employees 
      WHERE manager_id = public.resolve_my_employee_id() 
         OR manager_employee_id = public.resolve_my_employee_id()
    )
    OR (
      company_id = public.current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role_id IN ('super_admin', 'hr_manager', 'admin')
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 3. RPC: GET AUTHENTICATED EMPLOYEE CONTEXT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_authenticated_employee_context(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_comp_id uuid := COALESCE(p_company_id, public.current_company_id());
  v_emp_id uuid;
  v_emp RECORD;
  v_direct_reports_count integer := 0;
  v_is_manager boolean := false;
  v_dept_name text := '';
  v_manager_name text := '';
BEGIN
  -- 1. Resolve employee id
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_emp_id
    FROM public.employees
    WHERE (user_id = auth.uid() OR custom_fields->>'userId' = auth.uid()::text)
      AND (company_id = v_caller_comp_id OR v_caller_comp_id IS NULL)
    LIMIT 1;

    IF v_emp_id IS NULL THEN
      SELECT e.id INTO v_emp_id
      FROM public.employees e
      JOIN auth.users u ON lower(u.email) = lower(e.email)
      WHERE u.id = auth.uid()
        AND (e.company_id = v_caller_comp_id OR v_caller_comp_id IS NULL)
      LIMIT 1;
    END IF;
  END IF;

  -- Fallback if no employee record linked yet
  IF v_emp_id IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'employee', null,
      'is_manager', false,
      'direct_reports_count', 0
    );
  END IF;

  -- 2. Fetch employee master record
  SELECT e.*, d.name AS department_name
  INTO v_emp
  FROM public.employees e
  LEFT JOIN public.departments d ON d.id = e.department_id
  WHERE e.id = v_emp_id;

  -- 3. Resolve manager name if assigned
  IF v_emp.manager_id IS NOT NULL OR v_emp.manager_employee_id IS NOT NULL THEN
    SELECT COALESCE(m.full_name, m.first_name_ar || ' ' || m.last_name_ar)
    INTO v_manager_name
    FROM public.employees m
    WHERE m.id = COALESCE(v_emp.manager_id, v_emp.manager_employee_id);
  END IF;

  -- 4. Calculate direct reports count
  SELECT count(*) INTO v_direct_reports_count
  FROM public.employees
  WHERE (manager_id = v_emp_id OR manager_employee_id = v_emp_id)
    AND status != 'terminated';

  v_is_manager := (v_direct_reports_count > 0);

  RETURN jsonb_build_object(
    'found', true,
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'company_id', v_emp.company_id,
      'employee_no', v_emp.employee_no,
      'first_name_ar', COALESCE(v_emp.first_name_ar, split_part(v_emp.full_name, ' ', 1)),
      'last_name_ar', COALESCE(v_emp.last_name_ar, split_part(v_emp.full_name, ' ', 2)),
      'first_name_en', COALESCE(v_emp.first_name_en, ''),
      'last_name_en', COALESCE(v_emp.last_name_en, ''),
      'full_name', v_emp.full_name,
      'email', v_emp.email,
      'phone', v_emp.phone,
      'job_title_ar', COALESCE(v_emp.job_title_ar, v_emp.job_title),
      'job_title_en', COALESCE(v_emp.job_title_en, ''),
      'department_id', v_emp.department_id,
      'department_name', COALESCE(v_emp.department_name, ''),
      'manager_id', COALESCE(v_emp.manager_id, v_emp.manager_employee_id),
      'manager_name', COALESCE(v_manager_name, ''),
      'status', v_emp.status,
      'hire_date', v_emp.hire_date,
      'contract_type', COALESCE(v_emp.contract_type, 'full_time'),
      'national_id_or_iqama', v_emp.national_id_or_iqama,
      'nationality', v_emp.nationality,
      'gender', v_emp.gender,
      'marital_status', v_emp.marital_status,
      'avatar_url', v_emp.avatar_url,
      'basic_salary', v_emp.basic_salary,
      'housing_allowance', COALESCE(v_emp.housing_allowance, 0),
      'transport_allowance', COALESCE(v_emp.transportation_allowance, 0),
      'total_salary', COALESCE(v_emp.total_salary, v_emp.basic_salary + COALESCE(v_emp.housing_allowance, 0) + COALESCE(v_emp.transportation_allowance, 0)),
      'bank_iban', v_emp.bank_iban,
      'bank_name', v_emp.bank_name,
      'emergency_contact', v_emp.emergency_contact
    ),
    'is_manager', v_is_manager,
    'direct_reports_count', v_direct_reports_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_authenticated_employee_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_authenticated_employee_context(uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. RPC: GET MY EMPLOYEE PROFILE (DETAILED SELF SERVICE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_employee_profile(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.get_authenticated_employee_context(p_company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_employee_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_employee_profile(uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. RPC: UPDATE MY DIRECT PROFILE FIELDS (LOW-RISK INSTANT UPDATE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_direct_profile_fields(
  p_company_id uuid,
  p_phone text DEFAULT NULL,
  p_personal_email text DEFAULT NULL,
  p_emergency_contact jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id uuid := public.resolve_my_employee_id();
  v_old_phone text;
  v_old_email text;
BEGIN
  IF v_emp_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated employee record found');
  END IF;

  SELECT phone, email INTO v_old_phone, v_old_email
  FROM public.employees
  WHERE id = v_emp_id;

  UPDATE public.employees
  SET 
    phone = COALESCE(p_phone, phone),
    emergency_contact = COALESCE(p_emergency_contact, emergency_contact),
    updated_at = now()
  WHERE id = v_emp_id;

  -- Record audit trail
  BEGIN
    INSERT INTO public.audit_events (
      company_id,
      actor_id,
      actor_name,
      actor_role,
      action,
      entity_type,
      entity_id,
      entity_name,
      changes_summary,
      before_state,
      after_state,
      is_sensitive
    ) VALUES (
      p_company_id,
      auth.uid(),
      'Employee Self-Service',
      'employee',
      'profile.direct_update',
      'employee',
      v_emp_id::text,
      'Self Profile Update',
      'Updated direct profile contact details',
      jsonb_build_object('phone', v_old_phone),
      jsonb_build_object('phone', p_phone, 'emergency_contact', p_emergency_contact),
      false
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'message', 'Profile updated successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_direct_profile_fields(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_direct_profile_fields(uuid, text, text, jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 6. RPC: SUBMIT PROFILE CHANGE REQUEST (HIGH-RISK WORKFLOW)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_profile_change_request(
  p_company_id uuid,
  p_field_name text,
  p_field_label_ar text,
  p_field_label_en text,
  p_old_value text,
  p_requested_value text,
  p_reason text,
  p_attachment_file_id uuid DEFAULT NULL,
  p_attachment_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id uuid := public.resolve_my_employee_id();
  v_req_id uuid;
  v_req_num text;
  v_seq integer;
  v_emp_name text;
BEGIN
  IF v_emp_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated employee found');
  END IF;

  IF p_requested_value IS NULL OR trim(p_requested_value) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Requested value cannot be empty');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is required');
  END IF;

  -- Generate PCR sequence number
  SELECT COALESCE(count(*), 0) + 1 INTO v_seq
  FROM public.employee_profile_change_requests
  WHERE company_id = p_company_id;

  v_req_num := 'PCR-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.employee_profile_change_requests (
    company_id,
    employee_id,
    request_number,
    field_name,
    field_label_ar,
    field_label_en,
    old_value,
    requested_value,
    reason,
    attachment_file_id,
    attachment_name,
    status
  ) VALUES (
    p_company_id,
    v_emp_id,
    v_req_num,
    p_field_name,
    p_field_label_ar,
    p_field_label_en,
    p_old_value,
    trim(p_requested_value),
    trim(p_reason),
    p_attachment_file_id,
    p_attachment_name,
    'pending'
  )
  RETURNING id INTO v_req_id;

  -- Audit event
  SELECT COALESCE(full_name, first_name_ar || ' ' || last_name_ar) INTO v_emp_name
  FROM public.employees WHERE id = v_emp_id;

  BEGIN
    INSERT INTO public.audit_events (
      company_id,
      actor_id,
      actor_name,
      actor_role,
      action,
      entity_type,
      entity_id,
      entity_name,
      changes_summary,
      before_state,
      after_state,
      is_sensitive
    ) VALUES (
      p_company_id,
      auth.uid(),
      COALESCE(v_emp_name, 'Employee'),
      'employee',
      'profile_change.submitted',
      'employee_profile_change_request',
      v_req_id::text,
      v_req_num,
      'Submitted request to change ' || p_field_name || ' to ' || p_requested_value,
      jsonb_build_object('field', p_field_name, 'old_value', p_old_value),
      jsonb_build_object('field', p_field_name, 'requested_value', p_requested_value, 'reason', p_reason),
      true
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_req_id,
    'request_number', v_req_num,
    'message', 'Profile change request submitted successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_profile_change_request(uuid, text, text, text, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_profile_change_request(uuid, text, text, text, text, text, text, uuid, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 7. RPC: REVIEW PROFILE CHANGE REQUEST (APPROVE / REJECT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_profile_change_request(
  p_request_id uuid,
  p_status text,
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_sql text;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status. Must be approved or rejected');
  END IF;

  SELECT * INTO v_req
  FROM public.employee_profile_change_requests
  WHERE id = p_request_id;

  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile change request not found');
  END IF;

  IF v_req.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request has already been processed');
  END IF;

  -- Update request record
  UPDATE public.employee_profile_change_requests
  SET 
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = p_review_notes,
    updated_at = now()
  WHERE id = p_request_id;

  -- If approved, apply the requested change directly to the employee record
  IF p_status = 'approved' THEN
    IF v_req.field_name = 'phone' THEN
      UPDATE public.employees SET phone = v_req.requested_value WHERE id = v_req.employee_id;
    ELSIF v_req.field_name = 'marital_status' THEN
      UPDATE public.employees SET marital_status = v_req.requested_value::public.marital_status WHERE id = v_req.employee_id;
    ELSIF v_req.field_name = 'bank_iban' THEN
      UPDATE public.employees SET bank_iban = v_req.requested_value WHERE id = v_req.employee_id;
    ELSIF v_req.field_name = 'bank_name' THEN
      UPDATE public.employees SET bank_name = v_req.requested_value WHERE id = v_req.employee_id;
    ELSIF v_req.field_name = 'personal_email' OR v_req.field_name = 'email' THEN
      UPDATE public.employees SET email = v_req.requested_value WHERE id = v_req.employee_id;
    END IF;
  END IF;

  -- Audit log
  BEGIN
    INSERT INTO public.audit_events (
      company_id,
      actor_id,
      actor_name,
      actor_role,
      action,
      entity_type,
      entity_id,
      entity_name,
      changes_summary,
      before_state,
      after_state,
      is_sensitive
    ) VALUES (
      v_req.company_id,
      auth.uid(),
      'Manager/HR Approver',
      'approver',
      'profile_change.' || p_status,
      'employee_profile_change_request',
      p_request_id::text,
      v_req.request_number,
      'Profile change request ' || v_req.request_number || ' ' || p_status,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object('status', p_status, 'notes', p_review_notes),
      true
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'status', p_status, 'message', 'Request processed successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_profile_change_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_profile_change_request(uuid, text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 8. RPC: GET MANAGER TEAM SUMMARY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_manager_team_summary(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_comp_id uuid := COALESCE(p_company_id, public.current_company_id());
  v_mgr_id uuid := public.resolve_my_employee_id();
  v_total_team integer := 0;
  v_present_today integer := 0;
  v_on_leave_today integer := 0;
  v_absent_today integer := 0;
  v_pending_leaves integer := 0;
  v_pending_pcr integer := 0;
  v_today date := current_date;
BEGIN
  IF v_mgr_id IS NULL THEN
    RETURN jsonb_build_object(
      'is_manager', false,
      'total_team_members', 0,
      'present_today', 0,
      'on_leave_today', 0,
      'absent_today', 0,
      'pending_leaves_count', 0,
      'pending_profile_changes_count', 0
    );
  END IF;

  -- Total team members under this manager
  SELECT count(*) INTO v_total_team
  FROM public.employees
  WHERE (manager_id = v_mgr_id OR manager_employee_id = v_mgr_id)
    AND (company_id = v_caller_comp_id OR v_caller_comp_id IS NULL)
    AND status != 'terminated';

  IF v_total_team = 0 THEN
    RETURN jsonb_build_object(
      'is_manager', false,
      'total_team_members', 0,
      'present_today', 0,
      'on_leave_today', 0,
      'absent_today', 0,
      'pending_leaves_count', 0,
      'pending_profile_changes_count', 0
    );
  END IF;

  -- Present today
  SELECT count(DISTINCT ar.employee_id) INTO v_present_today
  FROM public.attendance_records ar
  JOIN public.employees e ON e.id = ar.employee_id
  WHERE (e.manager_id = v_mgr_id OR e.manager_employee_id = v_mgr_id)
    AND ar.work_date = v_today
    AND ar.status IN ('present', 'late');

  -- On leave today
  SELECT count(DISTINCT lr.employee_id) INTO v_on_leave_today
  FROM public.leave_requests lr
  JOIN public.employees e ON e.id = lr.employee_id
  WHERE (e.manager_id = v_mgr_id OR e.manager_employee_id = v_mgr_id)
    AND lr.status = 'approved'
    AND v_today BETWEEN lr.start_date AND lr.end_date;

  -- Absent today
  v_absent_today := GREATEST(0, v_total_team - v_present_today - v_on_leave_today);

  -- Pending leave requests from direct reports
  SELECT count(*) INTO v_pending_leaves
  FROM public.leave_requests lr
  JOIN public.employees e ON e.id = lr.employee_id
  WHERE (e.manager_id = v_mgr_id OR e.manager_employee_id = v_mgr_id)
    AND lr.status = 'pending';

  -- Pending profile changes from direct reports
  SELECT count(*) INTO v_pending_pcr
  FROM public.employee_profile_change_requests pcr
  JOIN public.employees e ON e.id = pcr.employee_id
  WHERE (e.manager_id = v_mgr_id OR e.manager_employee_id = v_mgr_id)
    AND pcr.status = 'pending';

  RETURN jsonb_build_object(
    'is_manager', true,
    'total_team_members', v_total_team,
    'present_today', v_present_today,
    'on_leave_today', v_on_leave_today,
    'absent_today', v_absent_today,
    'pending_leaves_count', v_pending_leaves,
    'pending_profile_changes_count', v_pending_pcr
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manager_team_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_team_summary(uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 9. RPC: GET MANAGER TEAM MEMBERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_manager_team_members(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_comp_id uuid := COALESCE(p_company_id, public.current_company_id());
  v_mgr_id uuid := public.resolve_my_employee_id();
  v_today date := current_date;
  v_res jsonb := '[]'::jsonb;
BEGIN
  IF v_mgr_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'employee_no', e.employee_no,
      'full_name', COALESCE(e.full_name, e.first_name_ar || ' ' || e.last_name_ar),
      'first_name_ar', e.first_name_ar,
      'last_name_ar', e.last_name_ar,
      'email', e.email,
      'phone', e.phone,
      'job_title_ar', COALESCE(e.job_title_ar, e.job_title),
      'department_name', COALESCE(d.name, ''),
      'status', e.status,
      'avatar_url', e.avatar_url,
      'hire_date', e.hire_date,
      'attendance_today', CASE 
        WHEN ar.id IS NOT NULL THEN jsonb_build_object(
          'status', ar.status,
          'check_in', ar.check_in,
          'check_out', ar.check_out
        )
        ELSE NULL
      END,
      'on_leave', (
        SELECT count(*) > 0
        FROM public.leave_requests lr
        WHERE lr.employee_id = e.id
          AND lr.status = 'approved'
          AND v_today BETWEEN lr.start_date AND lr.end_date
      )
    ) ORDER BY e.employee_no ASC
  ) INTO v_res
  FROM public.employees e
  LEFT JOIN public.departments d ON d.id = e.department_id
  LEFT JOIN public.attendance_records ar ON ar.employee_id = e.id AND ar.work_date = v_today
  WHERE (e.manager_id = v_mgr_id OR e.manager_employee_id = v_mgr_id)
    AND (e.company_id = v_caller_comp_id OR v_caller_comp_id IS NULL)
    AND e.status != 'terminated';

  RETURN COALESCE(v_res, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manager_team_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_team_members(uuid) TO service_role;
