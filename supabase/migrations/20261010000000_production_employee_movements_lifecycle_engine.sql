-- ============================================================================
-- MADARX ENTERPRISE WORKFORCE PLATFORM
-- PROMPT 28: PRODUCTION EMPLOYEE MOVEMENTS, EFFECTIVE-DATED CHANGES & LIFECYCLE ENGINE
-- Migration: 20261010000000_production_employee_movements_lifecycle_engine.sql
-- ============================================================================

-- 1. Sequence / Counter for Movement Numbers per Company (MOV-YYYY-XXXXXX)
CREATE TABLE IF NOT EXISTS public.company_movement_number_counters (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.get_next_movement_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next integer;
  v_year text := to_char(current_date, 'YYYY');
BEGIN
  INSERT INTO public.company_movement_number_counters (company_id, last_number, updated_at)
  VALUES (p_company_id, 1, now())
  ON CONFLICT (company_id)
  DO UPDATE SET last_number = public.company_movement_number_counters.last_number + 1, updated_at = now()
  RETURNING last_number INTO v_next;

  RETURN 'MOV-' || v_year || '-' || lpad(v_next::text, 6, '0');
END;
$$;

-- 2. Employee Movements Table
CREATE TABLE IF NOT EXISTS public.employee_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  movement_number text NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN (
    'promotion',
    'demotion',
    'transfer',
    'department_change',
    'business_unit_change',
    'legal_entity_change',
    'job_change',
    'position_change',
    'grade_change',
    'manager_change',
    'location_change',
    'cost_center_change',
    'employment_type_change',
    'contract_change',
    'compensation_change',
    'temporary_assignment',
    'secondment',
    'acting_assignment',
    'return_from_assignment',
    'status_change'
  )),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  effective_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'submitted',
    'under_review',
    'approved',
    'scheduled',
    'effective',
    'rejected',
    'returned',
    'cancelled',
    'failed'
  )),
  workflow_instance_id uuid,
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  approved_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  reversal_of_movement_id uuid REFERENCES public.employee_movements(id) ON DELETE SET NULL,
  notes text,
  is_bulk boolean NOT NULL DEFAULT false,
  batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_movement_number_company UNIQUE (company_id, movement_number)
);

CREATE INDEX IF NOT EXISTS idx_movements_emp_status ON public.employee_movements (company_id, employee_id, status);
CREATE INDEX IF NOT EXISTS idx_movements_effective_date ON public.employee_movements (company_id, effective_date, status);
CREATE INDEX IF NOT EXISTS idx_movements_type ON public.employee_movements (company_id, movement_type);

-- 3. Movement Field-Level Changes (Before / After Snapshots)
CREATE TABLE IF NOT EXISTS public.employee_movement_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id uuid NOT NULL REFERENCES public.employee_movements(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  field_code text NOT NULL,
  old_reference_id uuid,
  new_reference_id uuid,
  old_value text,
  new_value text,
  old_display_value text,
  new_display_value text,
  is_confidential boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movement_changes_mov ON public.employee_movement_changes (movement_id);

-- 4. Enhance / Ensure Employee Assignment History columns
ALTER TABLE public.employee_assignment_history
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS movement_id uuid REFERENCES public.employee_movements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temporary_assignment_id uuid;

CREATE INDEX IF NOT EXISTS idx_emp_assignment_current ON public.employee_assignment_history (company_id, employee_id, is_current);
CREATE INDEX IF NOT EXISTS idx_emp_assignment_dates ON public.employee_assignment_history (company_id, employee_id, effective_from, effective_to);

-- 5. Employee Contract Versions
CREATE TABLE IF NOT EXISTS public.employee_contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.employee_contracts(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  contract_number text,
  contract_type text NOT NULL DEFAULT 'full_time',
  start_date date NOT NULL,
  end_date date,
  probation_end_date date,
  work_type text,
  terms text,
  effective_from date NOT NULL,
  effective_to date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'terminated', 'cancelled')),
  reason text,
  movement_id uuid REFERENCES public.employee_movements(id) ON DELETE SET NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_versions_emp ON public.employee_contract_versions (company_id, employee_id, is_current);

-- 6. Temporary Assignments (Secondment, Acting, Temporary Assignment)
CREATE TABLE IF NOT EXISTS public.temporary_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assignment_type text NOT NULL CHECK (assignment_type IN ('temporary_assignment', 'secondment', 'acting_assignment')),
  start_date date NOT NULL,
  expected_end_date date NOT NULL,
  actual_end_date date,
  home_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  host_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  home_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  temp_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  home_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  temp_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  home_manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  temp_manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  home_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  temp_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  base_assignment_id uuid REFERENCES public.employee_assignment_history(id) ON DELETE SET NULL,
  source_movement_id uuid REFERENCES public.employee_movements(id) ON DELETE SET NULL,
  return_movement_id uuid REFERENCES public.employee_movements(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temp_assign_emp ON public.temporary_assignments (company_id, employee_id, status);

-- 7. Movement Policies
CREATE TABLE IF NOT EXISTS public.movement_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  policy_code text NOT NULL,
  movement_type text NOT NULL,
  requires_workflow boolean NOT NULL DEFAULT true,
  allow_cross_legal_entity boolean NOT NULL DEFAULT false,
  cross_entity_action text NOT NULL DEFAULT 'internal_transfer' CHECK (cross_entity_action IN ('internal_transfer', 'new_employment', 'separation_rehire')),
  max_temporary_months integer NOT NULL DEFAULT 12,
  allow_concurrent_scheduled boolean NOT NULL DEFAULT false,
  enforce_position_control boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_movement_policy_type UNIQUE (company_id, movement_type)
);

-- ============================================================================
-- 8. BUSINESS FUNCTIONS & ATOMIC RPCS
-- ============================================================================

-- A. Circular Manager Check (Hierarchy Loop Prevention)
CREATE OR REPLACE FUNCTION public.check_manager_hierarchy_circular(
  p_company_id uuid,
  p_employee_id uuid,
  p_new_manager_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_curr_id uuid := p_new_manager_id;
  v_visited uuid[] := ARRAY[]::uuid[];
BEGIN
  -- An employee cannot manage themselves
  IF p_employee_id = p_new_manager_id THEN
    RETURN true; -- Is circular!
  END IF;

  -- Traverse up from new manager
  WHILE v_curr_id IS NOT NULL LOOP
    IF v_curr_id = p_employee_id THEN
      RETURN true; -- Found loop: new manager reports up to employee!
    END IF;

    IF v_curr_id = ANY(v_visited) THEN
      RETURN true; -- Existing cycle detected
    END IF;
    v_visited := array_append(v_visited, v_curr_id);

    SELECT manager_id INTO v_curr_id
    FROM public.employees
    WHERE id = v_curr_id AND company_id = p_company_id;
  END LOOP;

  RETURN false; -- Safe, no cycle
END;
$$;

-- B. Apply Employee Movement Atomic (Internal applicator for effective date)
CREATE OR REPLACE FUNCTION public.apply_employee_movement_atomic(
  p_company_id uuid,
  p_movement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mov public.employee_movements%ROWTYPE;
  v_ch record;
  v_current_assign record;
  v_new_dept_id uuid;
  v_new_pos_id uuid;
  v_new_mgr_id uuid;
  v_new_loc_id uuid;
  v_new_cc_id uuid;
  v_new_sub_id uuid;
  v_new_grade text;
  v_new_job_title text;
  v_new_emp_type text;
  v_new_contract_type text;
  v_new_basic numeric;
  v_new_housing numeric;
  v_new_transport numeric;
  v_new_status text;
  v_assign_id uuid;
BEGIN
  SELECT * INTO v_mov
  FROM public.employee_movements
  WHERE id = p_movement_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Movement record not found');
  END IF;

  -- Close existing current assignment
  UPDATE public.employee_assignment_history
  SET is_current = false,
      effective_to = v_mov.effective_date
  WHERE company_id = p_company_id
    AND employee_id = v_mov.employee_id
    AND is_current = true;

  -- Inspect existing employee data as base defaults
  SELECT 
    department_id, job_position_id, manager_id, work_location_id, cost_center_id, subsidiary_id, grade, job_title, status
  INTO 
    v_new_dept_id, v_new_pos_id, v_new_mgr_id, v_new_loc_id, v_new_cc_id, v_new_sub_id, v_new_grade, v_new_job_title, v_new_status
  FROM public.employees
  WHERE id = v_mov.employee_id AND company_id = p_company_id;

  -- Apply changes from movement changes table
  FOR v_ch IN 
    SELECT field_code, new_reference_id, new_value
    FROM public.employee_movement_changes
    WHERE movement_id = v_mov.id
  LOOP
    IF v_ch.field_code = 'department_id' THEN
      v_new_dept_id := v_ch.new_reference_id;
    ELSIF v_ch.field_code = 'job_position_id' THEN
      v_new_pos_id := v_ch.new_reference_id;
      -- Auto fetch job title if position changed
      SELECT title_ar INTO v_new_job_title FROM public.job_positions WHERE id = v_ch.new_reference_id;
    ELSIF v_ch.field_code = 'manager_id' THEN
      v_new_mgr_id := v_ch.new_reference_id;
    ELSIF v_ch.field_code = 'work_location_id' THEN
      v_new_loc_id := v_ch.new_reference_id;
    ELSIF v_ch.field_code = 'cost_center_id' THEN
      v_new_cc_id := v_ch.new_reference_id;
    ELSIF v_ch.field_code = 'subsidiary_id' THEN
      v_new_sub_id := v_ch.new_reference_id;
    ELSIF v_ch.field_code = 'grade' THEN
      v_new_grade := v_ch.new_value;
    ELSIF v_ch.field_code = 'employment_type' THEN
      v_new_emp_type := v_ch.new_value;
    ELSIF v_ch.field_code = 'contract_type' THEN
      v_new_contract_type := v_ch.new_value;
    ELSIF v_ch.field_code = 'basic_salary' THEN
      v_new_basic := NULLIF(v_ch.new_value, '')::numeric;
    ELSIF v_ch.field_code = 'housing_allowance' THEN
      v_new_housing := NULLIF(v_ch.new_value, '')::numeric;
    ELSIF v_ch.field_code = 'transport_allowance' THEN
      v_new_transport := NULLIF(v_ch.new_value, '')::numeric;
    ELSIF v_ch.field_code = 'status' THEN
      v_new_status := v_ch.new_value;
    END IF;
  END LOOP;

  -- Insert new active assignment history record
  INSERT INTO public.employee_assignment_history (
    company_id,
    employee_id,
    department_id,
    subsidiary_id,
    work_location_id,
    job_position_id,
    cost_center_id,
    manager_id,
    grade,
    employment_type,
    effective_from,
    effective_to,
    is_current,
    change_reason,
    changed_by,
    movement_id
  ) VALUES (
    p_company_id,
    v_mov.employee_id,
    v_new_dept_id,
    v_new_sub_id,
    v_new_loc_id,
    v_new_pos_id,
    v_new_cc_id,
    v_new_mgr_id,
    v_new_grade,
    v_new_emp_type,
    v_mov.effective_date,
    NULL,
    true,
    v_mov.reason,
    v_mov.requested_by,
    v_mov.id
  ) RETURNING id INTO v_assign_id;

  -- Update authoritative employee master record
  UPDATE public.employees
  SET department_id = COALESCE(v_new_dept_id, department_id),
      job_position_id = COALESCE(v_new_pos_id, job_position_id),
      manager_id = v_new_mgr_id, -- Allow nullifying or changing manager
      work_location_id = COALESCE(v_new_loc_id, work_location_id),
      cost_center_id = COALESCE(v_new_cc_id, cost_center_id),
      subsidiary_id = COALESCE(v_new_sub_id, subsidiary_id),
      grade = COALESCE(v_new_grade, grade),
      job_title = COALESCE(v_new_job_title, job_title),
      status = COALESCE(v_new_status, status),
      updated_at = now()
  WHERE id = v_mov.employee_id AND company_id = p_company_id;

  -- If contract changed, version the contract
  IF v_new_contract_type IS NOT NULL THEN
    UPDATE public.employee_contract_versions
    SET is_current = false, status = 'superseded', effective_to = v_mov.effective_date
    WHERE company_id = p_company_id AND employee_id = v_mov.employee_id AND is_current = true;

    INSERT INTO public.employee_contract_versions (
      company_id,
      employee_id,
      contract_type,
      start_date,
      effective_from,
      is_current,
      status,
      reason,
      movement_id
    ) VALUES (
      p_company_id,
      v_mov.employee_id,
      v_new_contract_type,
      v_mov.effective_date,
      v_mov.effective_date,
      true,
      'active',
      v_mov.reason,
      v_mov.id
    );
  END IF;

  -- If compensation changed, version compensation
  IF v_new_basic IS NOT NULL THEN
    UPDATE public.employee_compensation_versions
    SET effective_to = v_mov.effective_date
    WHERE company_id = p_company_id AND employee_id = v_mov.employee_id AND effective_to IS NULL;

    INSERT INTO public.employee_compensation_versions (
      company_id,
      employee_id,
      version,
      effective_from,
      effective_to,
      basic_salary,
      housing_allowance,
      transport_allowance
    ) VALUES (
      p_company_id,
      v_mov.employee_id,
      (SELECT COALESCE(MAX(version), 0) + 1 FROM public.employee_compensation_versions WHERE company_id = p_company_id AND employee_id = v_mov.employee_id),
      v_mov.effective_date,
      NULL,
      v_new_basic,
      COALESCE(v_new_housing, 0),
      COALESCE(v_new_transport, 0)
    );
  END IF;

  -- Mark movement as effective
  UPDATE public.employee_movements
  SET status = 'effective',
      completed_at = now(),
      updated_at = now()
  WHERE id = v_mov.id;

  -- Audit event
  INSERT INTO public.audit_events (
    company_id,
    action,
    entity_type,
    entity_id,
    entity_name,
    changes_summary,
    severity
  ) VALUES (
    p_company_id,
    'movement.effective',
    'employee_movement',
    v_mov.id::text,
    v_mov.movement_number,
    'Applied movement ' || v_mov.movement_type || ' for employee ' || v_mov.employee_id::text,
    'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', v_mov.id,
    'assignment_id', v_assign_id,
    'status', 'effective'
  );
END;
$$;

-- C. Create Employee Movement Atomic
CREATE OR REPLACE FUNCTION public.create_employee_movement_atomic(
  p_company_id uuid,
  p_employee_id uuid,
  p_movement_type text,
  p_effective_date date,
  p_reason text,
  p_changes jsonb,
  p_requested_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_auto_approve boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mov_no text;
  v_mov_id uuid;
  v_item jsonb;
  v_field_code text;
  v_new_mgr_id uuid;
  v_is_circular boolean := false;
  v_conflict_count integer := 0;
  v_status text := 'submitted';
  v_apply_res jsonb;
BEGIN
  -- 1. Verify employee exists and belongs to company
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND company_id = p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found in company');
  END IF;

  -- 2. Validate Manager Circularity if manager_id is in changes
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_changes) LOOP
    IF (v_item->>'field_code') = 'manager_id' THEN
      v_new_mgr_id := (v_item->>'new_reference_id')::uuid;
      IF v_new_mgr_id IS NOT NULL THEN
        v_is_circular := public.check_manager_hierarchy_circular(p_company_id, p_employee_id, v_new_mgr_id);
        IF v_is_circular THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Circular hierarchy detected: cannot set employee or their subordinate as manager'
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 3. Check for conflicting scheduled movements on the same effective date
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.employee_movements
  WHERE company_id = p_company_id
    AND employee_id = p_employee_id
    AND effective_date = p_effective_date
    AND status IN ('scheduled', 'submitted', 'under_review');

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Conflicting movement already exists for this employee on the specified effective date'
    );
  END IF;

  -- 4. Generate Movement Number
  v_mov_no := public.get_next_movement_number(p_company_id);

  -- 5. Determine initial status
  IF p_auto_approve THEN
    IF p_effective_date > current_date THEN
      v_status := 'scheduled';
    ELSE
      v_status := 'effective';
    END IF;
  ELSE
    v_status := 'submitted';
  END IF;

  -- 6. Insert Movement
  INSERT INTO public.employee_movements (
    company_id,
    movement_number,
    employee_id,
    movement_type,
    requested_by,
    effective_date,
    reason,
    status,
    notes,
    approved_at,
    created_at
  ) VALUES (
    p_company_id,
    v_mov_no,
    p_employee_id,
    p_movement_type,
    p_requested_by,
    p_effective_date,
    p_reason,
    v_status,
    p_notes,
    CASE WHEN p_auto_approve THEN now() ELSE NULL END,
    now()
  ) RETURNING id INTO v_mov_id;

  -- 7. Insert Changes
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_changes) LOOP
    INSERT INTO public.employee_movement_changes (
      movement_id,
      company_id,
      field_code,
      old_reference_id,
      new_reference_id,
      old_value,
      new_value,
      old_display_value,
      new_display_value,
      is_confidential
    ) VALUES (
      v_mov_id,
      p_company_id,
      v_item->>'field_code',
      NULLIF(v_item->>'old_reference_id', '')::uuid,
      NULLIF(v_item->>'new_reference_id', '')::uuid,
      v_item->>'old_value',
      v_item->>'new_value',
      v_item->>'old_display_value',
      v_item->>'new_display_value',
      COALESCE((v_item->>'is_confidential')::boolean, false)
    );
  END LOOP;

  -- 8. If effective immediately, apply now
  IF v_status = 'effective' THEN
    v_apply_res := public.apply_employee_movement_atomic(p_company_id, v_mov_id);
  END IF;

  -- 9. Audit Log
  INSERT INTO public.audit_events (
    company_id,
    action,
    entity_type,
    entity_id,
    entity_name,
    changes_summary,
    severity
  ) VALUES (
    p_company_id,
    'movement.created',
    'employee_movement',
    v_mov_id::text,
    v_mov_no,
    'Created ' || p_movement_type || ' movement for employee ' || p_employee_id::text,
    'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', v_mov_id,
    'movement_number', v_mov_no,
    'status', v_status
  );
END;
$$;

-- D. Approve Employee Movement Atomic
CREATE OR REPLACE FUNCTION public.approve_employee_movement_atomic(
  p_company_id uuid,
  p_movement_id uuid,
  p_approved_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mov public.employee_movements%ROWTYPE;
  v_target_status text;
  v_apply_res jsonb;
BEGIN
  SELECT * INTO v_mov
  FROM public.employee_movements
  WHERE id = p_movement_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Movement not found');
  END IF;

  IF v_mov.status NOT IN ('submitted', 'under_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Movement cannot be approved in current status: ' || v_mov.status);
  END IF;

  -- Check effective date
  IF v_mov.effective_date > current_date THEN
    v_target_status := 'scheduled';
    UPDATE public.employee_movements
    SET status = 'scheduled',
        approved_at = now(),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = v_mov.id;
  ELSE
    v_target_status := 'effective';
    UPDATE public.employee_movements
    SET status = 'approved',
        approved_at = now(),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = v_mov.id;

    v_apply_res := public.apply_employee_movement_atomic(p_company_id, v_mov.id);
  END IF;

  -- Audit
  INSERT INTO public.audit_events (
    company_id,
    action,
    entity_type,
    entity_id,
    entity_name,
    changes_summary,
    severity
  ) VALUES (
    p_company_id,
    'movement.approved',
    'employee_movement',
    v_mov.id::text,
    v_mov.movement_number,
    'Approved movement ' || v_mov.movement_number || ' status transitioned to ' || v_target_status,
    'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', v_mov.id,
    'status', v_target_status
  );
END;
$$;

-- E. Activate Due Employee Movements Atomic (Deterministic Scheduler / RPC)
CREATE OR REPLACE FUNCTION public.activate_due_employee_movements_atomic(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec record;
  v_count integer := 0;
  v_activated_ids uuid[] := ARRAY[]::uuid[];
  v_res jsonb;
BEGIN
  FOR v_rec IN
    SELECT id, movement_number
    FROM public.employee_movements
    WHERE company_id = p_company_id
      AND status = 'scheduled'
      AND effective_date <= current_date
    ORDER BY effective_date ASC
  LOOP
    v_res := public.apply_employee_movement_atomic(p_company_id, v_rec.id);
    IF (v_res->>'success')::boolean THEN
      v_count := v_count + 1;
      v_activated_ids := array_append(v_activated_ids, v_rec.id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'activated_count', v_count,
    'activated_movement_ids', v_activated_ids
  );
END;
$$;

-- F. Create Temporary Assignment Atomic
CREATE OR REPLACE FUNCTION public.create_temporary_assignment_atomic(
  p_company_id uuid,
  p_employee_id uuid,
  p_assignment_type text,
  p_start_date date,
  p_expected_end_date date,
  p_temp_dept_id uuid DEFAULT NULL,
  p_temp_position_id uuid DEFAULT NULL,
  p_temp_manager_id uuid DEFAULT NULL,
  p_temp_location_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'Temporary reassignment',
  p_requested_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_base_assign_id uuid;
  v_temp_id uuid;
  v_mov_res jsonb;
  v_changes jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Fetch or create base assignment history snapshot
  SELECT id INTO v_base_assign_id
  FROM public.employee_assignment_history
  WHERE company_id = p_company_id AND employee_id = p_employee_id AND is_current = true
  LIMIT 1;

  IF v_base_assign_id IS NULL THEN
    INSERT INTO public.employee_assignment_history (
      company_id, employee_id, department_id, job_position_id, manager_id,
      work_location_id, cost_center_id, subsidiary_id, is_current, effective_from
    ) VALUES (
      p_company_id, p_employee_id, v_emp.department_id, v_emp.job_position_id, v_emp.manager_id,
      v_emp.work_location_id, v_emp.cost_center_id, v_emp.subsidiary_id, true, v_emp.hire_date
    ) RETURNING id INTO v_base_assign_id;
  END IF;

  -- Prepare changes array
  IF p_temp_dept_id IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object(
      'field_code', 'department_id',
      'old_reference_id', v_emp.department_id,
      'new_reference_id', p_temp_dept_id
    );
  END IF;
  IF p_temp_position_id IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object(
      'field_code', 'job_position_id',
      'old_reference_id', v_emp.job_position_id,
      'new_reference_id', p_temp_position_id
    );
  END IF;
  IF p_temp_manager_id IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object(
      'field_code', 'manager_id',
      'old_reference_id', v_emp.manager_id,
      'new_reference_id', p_temp_manager_id
    );
  END IF;
  IF p_temp_location_id IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object(
      'field_code', 'work_location_id',
      'old_reference_id', v_emp.work_location_id,
      'new_reference_id', p_temp_location_id
    );
  END IF;

  -- Create source movement
  v_mov_res := public.create_employee_movement_atomic(
    p_company_id,
    p_employee_id,
    p_assignment_type,
    p_start_date,
    p_reason,
    v_changes,
    p_requested_by,
    'Temporary assignment until ' || p_expected_end_date::text,
    true -- Auto approve temporary assignment
  );

  IF NOT (v_mov_res->>'success')::boolean THEN
    RETURN v_mov_res;
  END IF;

  -- Record temporary assignment
  INSERT INTO public.temporary_assignments (
    company_id,
    employee_id,
    assignment_type,
    start_date,
    expected_end_date,
    home_department_id,
    temp_department_id,
    home_position_id,
    temp_position_id,
    home_manager_id,
    temp_manager_id,
    home_location_id,
    temp_location_id,
    base_assignment_id,
    source_movement_id,
    status,
    reason
  ) VALUES (
    p_company_id,
    p_employee_id,
    p_assignment_type,
    p_start_date,
    p_expected_end_date,
    v_emp.department_id,
    p_temp_dept_id,
    v_emp.job_position_id,
    p_temp_position_id,
    v_emp.manager_id,
    p_temp_manager_id,
    v_emp.work_location_id,
    p_temp_location_id,
    v_base_assign_id,
    (v_mov_res->>'movement_id')::uuid,
    'active',
    p_reason
  ) RETURNING id INTO v_temp_id;

  RETURN jsonb_build_object(
    'success', true,
    'temporary_assignment_id', v_temp_id,
    'movement_id', v_mov_res->>'movement_id',
    'base_assignment_id', v_base_assign_id
  );
END;
$$;

-- G. Return from Temporary Assignment Atomic
CREATE OR REPLACE FUNCTION public.return_from_temporary_assignment_atomic(
  p_company_id uuid,
  p_assignment_id uuid,
  p_actual_end_date date DEFAULT current_date,
  p_reason text DEFAULT 'Completed temporary assignment',
  p_requested_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_temp public.temporary_assignments%ROWTYPE;
  v_base public.employee_assignment_history%ROWTYPE;
  v_changes jsonb := '[]'::jsonb;
  v_mov_res jsonb;
BEGIN
  SELECT * INTO v_temp
  FROM public.temporary_assignments
  WHERE id = p_assignment_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Temporary assignment not found');
  END IF;

  IF v_temp.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assignment is already closed');
  END IF;

  -- Load base assignment
  SELECT * INTO v_base
  FROM public.employee_assignment_history
  WHERE id = v_temp.base_assignment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Base assignment record not found');
  END IF;

  -- Build restoration changes
  v_changes := jsonb_build_array(
    jsonb_build_object('field_code', 'department_id', 'new_reference_id', v_base.department_id),
    jsonb_build_object('field_code', 'job_position_id', 'new_reference_id', v_base.job_position_id),
    jsonb_build_object('field_code', 'manager_id', 'new_reference_id', v_base.manager_id),
    jsonb_build_object('field_code', 'work_location_id', 'new_reference_id', v_base.work_location_id),
    jsonb_build_object('field_code', 'cost_center_id', 'new_reference_id', v_base.cost_center_id),
    jsonb_build_object('field_code', 'subsidiary_id', 'new_reference_id', v_base.subsidiary_id)
  );

  -- Create return movement
  v_mov_res := public.create_employee_movement_atomic(
    p_company_id,
    v_temp.employee_id,
    'return_from_assignment',
    p_actual_end_date,
    p_reason,
    v_changes,
    p_requested_by,
    'Return to base assignment',
    true -- Auto-approve return
  );

  IF NOT (v_mov_res->>'success')::boolean THEN
    RETURN v_mov_res;
  END IF;

  -- Mark temporary assignment completed
  UPDATE public.temporary_assignments
  SET status = 'completed',
      actual_end_date = p_actual_end_date,
      return_movement_id = (v_mov_res->>'movement_id')::uuid
  WHERE id = v_temp.id;

  RETURN jsonb_build_object(
    'success', true,
    'temporary_assignment_id', v_temp.id,
    'return_movement_id', v_mov_res->>'movement_id',
    'status', 'completed'
  );
END;
$$;

-- H. Bulk Create Movements Atomic
CREATE OR REPLACE FUNCTION public.bulk_create_employee_movements_atomic(
  p_company_id uuid,
  p_movement_type text,
  p_effective_date date,
  p_reason text,
  p_rows jsonb,
  p_requested_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id uuid := gen_random_uuid();
  v_row jsonb;
  v_emp_id uuid;
  v_changes jsonb;
  v_res jsonb;
  v_valid_count integer := 0;
  v_invalid_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_created_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_emp_id := (v_row->>'employee_id')::uuid;
    v_changes := COALESCE(v_row->'changes', '[]'::jsonb);

    v_res := public.create_employee_movement_atomic(
      p_company_id,
      v_emp_id,
      p_movement_type,
      p_effective_date,
      p_reason,
      v_changes,
      p_requested_by,
      'Bulk batch: ' || v_batch_id::text,
      false
    );

    IF (v_res->>'success')::boolean THEN
      v_valid_count := v_valid_count + 1;
      v_created_ids := array_append(v_created_ids, (v_res->>'movement_id')::uuid);
    ELSE
      v_invalid_count := v_invalid_count + 1;
      v_errors := v_errors || jsonb_build_object(
        'employee_id', v_emp_id,
        'error', v_res->>'error'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'valid_count', v_valid_count,
    'invalid_count', v_invalid_count,
    'created_movement_ids', v_created_ids,
    'errors', v_errors
  );
END;
$$;

-- I. Cancel Employee Movement Atomic
CREATE OR REPLACE FUNCTION public.cancel_employee_movement_atomic(
  p_company_id uuid,
  p_movement_id uuid,
  p_cancelled_by uuid DEFAULT NULL,
  p_reason text DEFAULT 'Cancelled by user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mov public.employee_movements%ROWTYPE;
BEGIN
  SELECT * INTO v_mov
  FROM public.employee_movements
  WHERE id = p_movement_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Movement not found');
  END IF;

  IF v_mov.status IN ('effective', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot cancel movement in status: ' || v_mov.status || '. For effective movements, use corrective reversal.'
    );
  END IF;

  UPDATE public.employee_movements
  SET status = 'cancelled',
      cancelled_at = now(),
      notes = COALESCE(notes || E'\n', '') || 'Cancellation reason: ' || p_reason,
      updated_at = now()
  WHERE id = v_mov.id;

  INSERT INTO public.audit_events (
    company_id,
    action,
    entity_type,
    entity_id,
    entity_name,
    changes_summary,
    severity
  ) VALUES (
    p_company_id,
    'movement.cancelled',
    'employee_movement',
    v_mov.id::text,
    v_mov.movement_number,
    'Cancelled movement ' || v_mov.movement_number || ': ' || p_reason,
    'warning'
  );

  RETURN jsonb_build_object('success', true, 'movement_id', v_mov.id, 'status', 'cancelled');
END;
$$;

-- J. Get Employee Movements KPIs Atomic
CREATE OR REPLACE FUNCTION public.get_employee_movements_kpis_atomic(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total integer := 0;
  v_pending integer := 0;
  v_scheduled integer := 0;
  v_effective integer := 0;
  v_promotions integer := 0;
  v_transfers integer := 0;
  v_manager_changes integer := 0;
  v_temp_assignments integer := 0;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('submitted', 'under_review')),
    COUNT(*) FILTER (WHERE status = 'scheduled'),
    COUNT(*) FILTER (WHERE status = 'effective'),
    COUNT(*) FILTER (WHERE movement_type = 'promotion'),
    COUNT(*) FILTER (WHERE movement_type IN ('transfer', 'department_change', 'business_unit_change', 'legal_entity_change')),
    COUNT(*) FILTER (WHERE movement_type = 'manager_change')
  INTO
    v_total, v_pending, v_scheduled, v_effective, v_promotions, v_transfers, v_manager_changes
  FROM public.employee_movements
  WHERE company_id = p_company_id;

  SELECT COUNT(*) INTO v_temp_assignments
  FROM public.temporary_assignments
  WHERE company_id = p_company_id AND status = 'active';

  RETURN jsonb_build_object(
    'total_movements', v_total,
    'pending_movements', v_pending,
    'scheduled_movements', v_scheduled,
    'effective_movements', v_effective,
    'promotions_count', v_promotions,
    'transfers_count', v_transfers,
    'manager_changes_count', v_manager_changes,
    'active_temporary_assignments', v_temp_assignments
  );
END;
$$;

-- ============================================================================
-- 9. ROW-LEVEL SECURITY & GRANTS
-- ============================================================================

ALTER TABLE public.company_movement_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_movement_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporary_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movements_company_isolation" ON public.employee_movements;
CREATE POLICY "movements_company_isolation" ON public.employee_movements
  FOR ALL TO authenticated, service_role
  USING (
    company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid
    OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin'
  );

DROP POLICY IF EXISTS "movement_changes_company_isolation" ON public.employee_movement_changes;
CREATE POLICY "movement_changes_company_isolation" ON public.employee_movement_changes
  FOR ALL TO authenticated, service_role
  USING (
    company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid
    OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin'
  );

DROP POLICY IF EXISTS "contract_versions_company_isolation" ON public.employee_contract_versions;
CREATE POLICY "contract_versions_company_isolation" ON public.employee_contract_versions
  FOR ALL TO authenticated, service_role
  USING (
    company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid
    OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin'
  );

DROP POLICY IF EXISTS "temp_assignments_company_isolation" ON public.temporary_assignments;
CREATE POLICY "temp_assignments_company_isolation" ON public.temporary_assignments
  FOR ALL TO authenticated, service_role
  USING (
    company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid
    OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin'
  );

DROP POLICY IF EXISTS "movement_policies_company_isolation" ON public.movement_policies;
CREATE POLICY "movement_policies_company_isolation" ON public.movement_policies
  FOR ALL TO authenticated, service_role
  USING (
    company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid
    OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin'
  );

GRANT SELECT, INSERT, UPDATE ON public.employee_movements TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.employee_movement_changes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.employee_contract_versions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.temporary_assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.movement_policies TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.company_movement_number_counters TO authenticated, service_role;
