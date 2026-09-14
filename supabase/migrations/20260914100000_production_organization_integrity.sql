-- ============================================================================
-- Migration: 20260914100000_production_organization_integrity.sql
-- Description: Production Organization Structure & Master Data Completion (Prompt 08)
-- - Unique master data codes scoped per company
-- - Soft archive status support across master data entities
-- - Backward-compatible name_ar column on departments
-- - Server-side hierarchy cycle detection & tenant boundary validation
-- - Atomic department archive & employee reassignment RPC (archive_organization_unit)
-- - Master data dependency inspection and safe archiving RPCs
-- - Audit and change tracking (organization_change_history & employee_assignment_history)
-- - Hardened RLS policies for organizational master data
-- ============================================================================

-- 1. Ensure name_ar exists on departments and is kept in sync with name
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS name_ar text;
UPDATE public.departments SET name_ar = name WHERE name_ar IS NULL;

-- Trigger to keep name and name_ar in sync
CREATE OR REPLACE FUNCTION public.sync_department_name_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name_ar IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    NEW.name := NEW.name_ar;
  ELSIF NEW.name IS NOT NULL AND (NEW.name_ar IS NULL OR NEW.name_ar = '') THEN
    NEW.name_ar := NEW.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_department_name_fields ON public.departments;
CREATE TRIGGER trg_sync_department_name_fields
  BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.sync_department_name_fields();

-- 2. Ensure status column with archived support exists on all master entities
DO $$
BEGIN
  -- departments status check
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_status_check;
    ALTER TABLE public.departments ADD CONSTRAINT departments_status_check
      CHECK (status IN ('active', 'inactive', 'archived'));
  ELSE
    ALTER TABLE public.departments ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'inactive', 'archived'));
  END IF;

  -- subsidiaries status check
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subsidiaries' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.subsidiaries DROP CONSTRAINT IF EXISTS subsidiaries_status_check;
    ALTER TABLE public.subsidiaries ADD CONSTRAINT subsidiaries_status_check
      CHECK (status IN ('active', 'inactive', 'archived'));
  ELSE
    ALTER TABLE public.subsidiaries ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'inactive', 'archived'));
  END IF;

  -- work_locations status check
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_locations' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.work_locations DROP CONSTRAINT IF EXISTS work_locations_status_check;
    ALTER TABLE public.work_locations ADD CONSTRAINT work_locations_status_check
      CHECK (status IN ('active', 'inactive', 'archived'));
  ELSE
    ALTER TABLE public.work_locations ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'inactive', 'archived'));
  END IF;

  -- cost_centers status check
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cost_centers' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.cost_centers DROP CONSTRAINT IF EXISTS cost_centers_status_check;
    ALTER TABLE public.cost_centers ADD CONSTRAINT cost_centers_status_check
      CHECK (status IN ('active', 'inactive', 'archived'));
  END IF;

  -- job_positions status check
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_positions' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.job_positions DROP CONSTRAINT IF EXISTS job_positions_status_check;
    ALTER TABLE public.job_positions ADD CONSTRAINT job_positions_status_check
      CHECK (status IN ('active', 'inactive', 'archived'));
  END IF;
END $$;

-- 3. Scoped unique constraints for master data codes
CREATE UNIQUE INDEX IF NOT EXISTS departments_company_code_uidx
  ON public.departments(company_id, code)
  WHERE company_id IS NOT NULL AND status != 'archived';

CREATE UNIQUE INDEX IF NOT EXISTS subsidiaries_company_code_uidx
  ON public.subsidiaries(company_id, code)
  WHERE company_id IS NOT NULL AND status != 'archived';

CREATE UNIQUE INDEX IF NOT EXISTS work_locations_company_code_uidx
  ON public.work_locations(company_id, code)
  WHERE company_id IS NOT NULL AND status != 'archived';

CREATE UNIQUE INDEX IF NOT EXISTS cost_centers_company_code_uidx
  ON public.cost_centers(company_id, code)
  WHERE company_id IS NOT NULL AND status != 'archived';

CREATE UNIQUE INDEX IF NOT EXISTS job_positions_company_code_uidx
  ON public.job_positions(company_id, code)
  WHERE company_id IS NOT NULL AND status != 'archived';

-- 4. Audit & History Tables
CREATE TABLE IF NOT EXISTS public.organization_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('department', 'subsidiary', 'work_location', 'cost_center', 'job_position', 'company')),
  entity_id uuid NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('create', 'update', 'archive', 'reassign', 'manager_change', 'parent_change')),
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  before_data jsonb,
  after_data jsonb,
  change_reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_change_history_entity_idx
  ON public.organization_change_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS org_change_history_company_idx
  ON public.organization_change_history(company_id);

CREATE TABLE IF NOT EXISTS public.employee_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  subsidiary_id uuid REFERENCES public.subsidiaries(id) ON DELETE SET NULL,
  work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  change_reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emp_assignment_history_emp_idx
  ON public.employee_assignment_history(employee_id);
CREATE INDEX IF NOT EXISTS emp_assignment_history_dept_idx
  ON public.employee_assignment_history(department_id);
CREATE INDEX IF NOT EXISTS emp_assignment_history_company_idx
  ON public.employee_assignment_history(company_id);

-- 5. Hierarchy Cycle Prevention & Tenant Boundary Function
CREATE OR REPLACE FUNCTION public.validate_department_hierarchy(
  p_department_id uuid,
  p_new_parent_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_dept_company_id uuid;
  v_parent_company_id uuid;
  v_cycle_found boolean := false;
BEGIN
  -- If no parent or root level, valid
  IF p_new_parent_id IS NULL THEN
    RETURN true;
  END IF;

  -- Cannot be its own parent
  IF p_department_id IS NOT NULL AND p_department_id = p_new_parent_id THEN
    RETURN false;
  END IF;

  -- Validate tenant boundary if department exists
  IF p_department_id IS NOT NULL THEN
    SELECT company_id INTO v_dept_company_id FROM public.departments WHERE id = p_department_id;
    SELECT company_id INTO v_parent_company_id FROM public.departments WHERE id = p_new_parent_id;

    IF v_dept_company_id IS NOT NULL AND v_parent_company_id IS NOT NULL AND v_dept_company_id <> v_parent_company_id THEN
      RETURN false;
    END IF;

    -- Recursive cycle detection
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM public.departments WHERE id = p_new_parent_id
      UNION ALL
      SELECT d.id, d.parent_id
      FROM public.departments d
      JOIN ancestors a ON d.id = a.parent_id
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = p_department_id) INTO v_cycle_found;

    IF v_cycle_found THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- Upgrade the prevent_department_cycle trigger on departments
CREATE OR REPLACE FUNCTION public.prevent_department_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS NOT NULL AND NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A department cannot be its own parent';
  END IF;

  IF NOT public.validate_department_hierarchy(NEW.id, NEW.parent_id) THEN
    RAISE EXCEPTION 'The selected parent creates an organization cycle or crosses company boundaries';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS departments_prevent_cycle ON public.departments;
CREATE TRIGGER departments_prevent_cycle
  BEFORE INSERT OR UPDATE OF parent_id, company_id ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_department_cycle();

-- 6. Atomic Master Data Dependency Inspection RPC
CREATE OR REPLACE FUNCTION public.get_master_data_dependencies(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_emp_count integer := 0;
  v_child_dept_count integer := 0;
  v_pos_count integer := 0;
  v_loc_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_entity_type = 'department' THEN
    SELECT count(*) INTO v_emp_count FROM public.employees WHERE department_id = p_entity_id AND status <> 'terminated';
    SELECT count(*) INTO v_child_dept_count FROM public.departments WHERE parent_id = p_entity_id AND status <> 'archived';
    SELECT count(*) INTO v_pos_count FROM public.job_positions WHERE department_id = p_entity_id AND status <> 'archived';
    v_result := jsonb_build_object(
      'entity_type', 'department',
      'entity_id', p_entity_id,
      'employees_count', v_emp_count,
      'child_departments_count', v_child_dept_count,
      'job_positions_count', v_pos_count,
      'has_dependencies', (v_emp_count > 0 OR v_child_dept_count > 0 OR v_pos_count > 0)
    );
  ELSIF p_entity_type = 'subsidiary' THEN
    SELECT count(*) INTO v_emp_count FROM public.employees WHERE subsidiary_id = p_entity_id AND status <> 'terminated';
    SELECT count(*) INTO v_child_dept_count FROM public.departments WHERE subsidiary_id = p_entity_id AND status <> 'archived';
    SELECT count(*) INTO v_loc_count FROM public.work_locations WHERE subsidiary_id = p_entity_id AND status <> 'archived';
    SELECT count(*) INTO v_pos_count FROM public.job_positions WHERE subsidiary_id = p_entity_id AND status <> 'archived';
    v_result := jsonb_build_object(
      'entity_type', 'subsidiary',
      'entity_id', p_entity_id,
      'employees_count', v_emp_count,
      'departments_count', v_child_dept_count,
      'work_locations_count', v_loc_count,
      'job_positions_count', v_pos_count,
      'has_dependencies', (v_emp_count > 0 OR v_child_dept_count > 0 OR v_loc_count > 0 OR v_pos_count > 0)
    );
  ELSIF p_entity_type = 'work_location' THEN
    SELECT count(*) INTO v_emp_count FROM public.employees WHERE work_location_id = p_entity_id AND status <> 'terminated';
    v_result := jsonb_build_object(
      'entity_type', 'work_location',
      'entity_id', p_entity_id,
      'employees_count', v_emp_count,
      'has_dependencies', (v_emp_count > 0)
    );
  ELSIF p_entity_type = 'cost_center' THEN
    SELECT count(*) INTO v_child_dept_count FROM public.departments WHERE cost_center_id = p_entity_id AND status <> 'archived';
    SELECT count(*) INTO v_pos_count FROM public.job_positions WHERE cost_center_id = p_entity_id AND status <> 'archived';
    v_result := jsonb_build_object(
      'entity_type', 'cost_center',
      'entity_id', p_entity_id,
      'departments_count', v_child_dept_count,
      'job_positions_count', v_pos_count,
      'has_dependencies', (v_child_dept_count > 0 OR v_pos_count > 0)
    );
  ELSIF p_entity_type = 'job_position' THEN
    SELECT count(*) INTO v_emp_count FROM public.employees WHERE job_position_id = p_entity_id AND status <> 'terminated';
    v_result := jsonb_build_object(
      'entity_type', 'job_position',
      'entity_id', p_entity_id,
      'employees_count', v_emp_count,
      'has_dependencies', (v_emp_count > 0)
    );
  ELSE
    RAISE EXCEPTION 'Unknown entity type: %', p_entity_type;
  END IF;

  RETURN v_result;
END;
$$;

-- 7. Atomic Department Archive & Reassignment RPC
CREATE OR REPLACE FUNCTION public.archive_organization_unit(
  p_department_id uuid,
  p_reassign_department_id uuid DEFAULT NULL,
  p_reparent_children_to uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_dept record;
  v_reassign_dept record;
  v_emp_count integer := 0;
  v_child_count integer := 0;
  v_reparent_target uuid;
  v_emp record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: المستخدم غير مسجل دخول';
  END IF;

  -- Check authorized role (super_admin, org_admin, hr_manager or current_user_is_hr)
  IF NOT (
    public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    OR public.current_user_is_hr()
  ) THEN
    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إدارة الهيكل التنظيمي';
  END IF;

  -- Lock and fetch target department
  SELECT * INTO v_dept
  FROM public.departments
  WHERE id = p_department_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإدارة المستهدفة غير موجودة';
  END IF;

  IF v_dept.status = 'archived' THEN
    RAISE EXCEPTION 'الإدارة مؤرشفة بالفعل';
  END IF;

  -- Target != Reassignment target
  IF p_reassign_department_id IS NOT NULL AND p_reassign_department_id = p_department_id THEN
    RAISE EXCEPTION 'لا يمكن إعادة تسكين الموظفين في نفس الإدارة المراد أرشفتها';
  END IF;

  -- Validate reassignment department if provided
  IF p_reassign_department_id IS NOT NULL THEN
    SELECT * INTO v_reassign_dept
    FROM public.departments
    WHERE id = p_reassign_department_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'إدارة إعادة التسكين المستهدفة غير موجودة';
    END IF;

    IF v_reassign_dept.status = 'archived' THEN
      RAISE EXCEPTION 'لا يمكن إعادة التسكين إلى إدارة مؤرشفة';
    END IF;

    IF v_dept.company_id IS NOT NULL AND v_reassign_dept.company_id IS NOT NULL AND v_dept.company_id <> v_reassign_dept.company_id THEN
      RAISE EXCEPTION 'إدارة إعادة التسكين لا تتبع نفس المنشأة';
    END IF;
  END IF;

  -- Check employee dependencies
  SELECT count(*) INTO v_emp_count
  FROM public.employees
  WHERE department_id = p_department_id AND status <> 'terminated';

  IF v_emp_count > 0 AND p_reassign_department_id IS NULL THEN
    RAISE EXCEPTION 'يوجد % موظف مسكن في هذه الإدارة - يجب اختيار إدارة بديلة لنقلهم قبل الأرشفة', v_emp_count;
  END IF;

  -- Atomically reassign employees if any
  IF v_emp_count > 0 AND p_reassign_department_id IS NOT NULL THEN
    FOR v_emp IN
      SELECT id, company_id, subsidiary_id, work_location_id, job_position_id, cost_center_id, manager_id
      FROM public.employees
      WHERE department_id = p_department_id AND status <> 'terminated'
    LOOP
      -- Insert assignment history record
      INSERT INTO public.employee_assignment_history (
        company_id,
        employee_id,
        department_id,
        subsidiary_id,
        work_location_id,
        job_position_id,
        cost_center_id,
        manager_id,
        change_reason,
        changed_by
      ) VALUES (
        COALESCE(v_emp.company_id, v_dept.company_id),
        v_emp.id,
        p_reassign_department_id,
        v_emp.subsidiary_id,
        v_emp.work_location_id,
        v_emp.job_position_id,
        v_emp.cost_center_id,
        v_emp.manager_id,
        'إعادة تسكين تلقائي عند أرشفة الإدارة ' || COALESCE(v_dept.name_ar, v_dept.name),
        v_user_id
      );
    END LOOP;

    -- Update all employees
    UPDATE public.employees
    SET department_id = p_reassign_department_id
    WHERE department_id = p_department_id AND status <> 'terminated';
  END IF;

  -- Handle child departments
  SELECT count(*) INTO v_child_count
  FROM public.departments
  WHERE parent_id = p_department_id AND status <> 'archived';

  IF v_child_count > 0 THEN
    IF p_reparent_children_to IS NOT NULL THEN
      IF p_reparent_children_to = p_department_id THEN
        RAISE EXCEPTION 'لا يمكن إعادة تعيين الإدارات التابعة لنفس الإدارة';
      END IF;
      v_reparent_target := p_reparent_children_to;
    ELSE
      -- Reparent to parent of the archived department (or NULL if it was root)
      v_reparent_target := v_dept.parent_id;
    END IF;

    -- Update child departments
    UPDATE public.departments
    SET parent_id = v_reparent_target,
        updated_at = now()
    WHERE parent_id = p_department_id AND status <> 'archived';
  END IF;

  -- Mark target department as archived
  UPDATE public.departments
  SET status = 'archived',
      updated_at = now()
  WHERE id = p_department_id;

  -- Log organizational change history
  IF v_dept.company_id IS NOT NULL THEN
    INSERT INTO public.organization_change_history (
      company_id,
      entity_type,
      entity_id,
      change_type,
      before_data,
      after_data,
      change_reason,
      changed_by
    ) VALUES (
      v_dept.company_id,
      'department',
      p_department_id,
      'archive',
      to_jsonb(v_dept),
      jsonb_build_object('status', 'archived', 'reassigned_employees_count', v_emp_count, 'reparented_children_count', v_child_count),
      'أرشفة وحدة تنظيمية مع نقل الموظفين وإعادة ربط الفروع',
      v_user_id
    );
  END IF;

  -- Log audit event
  INSERT INTO public.audit_events (
    action,
    action_type,
    actor_user_id,
    entity_type,
    entity_id,
    changes_summary
  ) VALUES (
    'ARCHIVE_ORGANIZATION_UNIT',
    'ARCHIVE',
    v_user_id,
    'departments',
    p_department_id::text,
    format('Archived department %s. Reassigned %s employees to %s. Reparented %s children.',
      COALESCE(v_dept.name_ar, v_dept.name), v_emp_count, COALESCE(p_reassign_department_id::text, 'none'), v_child_count)
  );

  RETURN jsonb_build_object(
    'success', true,
    'archived_department_id', p_department_id,
    'reassigned_employees_count', v_emp_count,
    'reparented_children_count', v_child_count
  );
END;
$$;

-- 8. Archive RPCs for Subsidiary, Work Location, Cost Center, Job Position
CREATE OR REPLACE FUNCTION public.archive_subsidiary(
  p_subsidiary_id uuid,
  p_reassign_subsidiary_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sub record;
  v_emp_count integer := 0;
  v_dept_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) OR public.current_user_is_hr()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_sub FROM public.subsidiaries WHERE id = p_subsidiary_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الشركة التابعة غير موجودة'; END IF;
  IF v_sub.status = 'archived' THEN RAISE EXCEPTION 'الشركة التابعة مؤرشفة بالفعل'; END IF;

  SELECT count(*) INTO v_emp_count FROM public.employees WHERE subsidiary_id = p_subsidiary_id AND status <> 'terminated';
  SELECT count(*) INTO v_dept_count FROM public.departments WHERE subsidiary_id = p_subsidiary_id AND status <> 'archived';

  IF (v_emp_count > 0 OR v_dept_count > 0) AND p_reassign_subsidiary_id IS NULL THEN
    RAISE EXCEPTION 'الشركة التابعة مرتبطة بـ % موظف و % إدارة - يرجى فك الارتباط أو تحديد شركة بديلة', v_emp_count, v_dept_count;
  END IF;

  IF p_reassign_subsidiary_id IS NOT NULL THEN
    UPDATE public.employees SET subsidiary_id = p_reassign_subsidiary_id WHERE subsidiary_id = p_subsidiary_id;
    UPDATE public.departments SET subsidiary_id = p_reassign_subsidiary_id WHERE subsidiary_id = p_subsidiary_id;
    UPDATE public.work_locations SET subsidiary_id = p_reassign_subsidiary_id WHERE subsidiary_id = p_subsidiary_id;
  END IF;

  UPDATE public.subsidiaries SET status = 'archived', updated_at = now() WHERE id = p_subsidiary_id;

  RETURN jsonb_build_object('success', true, 'archived_id', p_subsidiary_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_work_location(
  p_location_id uuid,
  p_reassign_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_loc record;
  v_emp_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) OR public.current_user_is_hr()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_loc FROM public.work_locations WHERE id = p_location_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'موقع العمل غير موجود'; END IF;
  IF v_loc.status = 'archived' THEN RAISE EXCEPTION 'موقع العمل مؤرشف بالفعل'; END IF;

  SELECT count(*) INTO v_emp_count FROM public.employees WHERE work_location_id = p_location_id AND status <> 'terminated';

  IF v_emp_count > 0 AND p_reassign_location_id IS NULL THEN
    RAISE EXCEPTION 'الموقع مرتبط بـ % موظف - يرجى تحديد موقع بديل لنقلهم قبل الأرشفة', v_emp_count;
  END IF;

  IF v_emp_count > 0 AND p_reassign_location_id IS NOT NULL THEN
    UPDATE public.employees SET work_location_id = p_reassign_location_id WHERE work_location_id = p_location_id;
  END IF;

  UPDATE public.work_locations SET status = 'archived', updated_at = now() WHERE id = p_location_id;

  RETURN jsonb_build_object('success', true, 'archived_id', p_location_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_cost_center(
  p_cost_center_id uuid,
  p_reassign_cost_center_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cc record;
  v_dept_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) OR public.current_user_is_hr()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_cc FROM public.cost_centers WHERE id = p_cost_center_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'مركز التكلفة غير موجود'; END IF;
  IF v_cc.status = 'archived' THEN RAISE EXCEPTION 'مركز التكلفة مؤرشف بالفعل'; END IF;

  SELECT count(*) INTO v_dept_count FROM public.departments WHERE cost_center_id = p_cost_center_id AND status <> 'archived';

  IF v_dept_count > 0 AND p_reassign_cost_center_id IS NULL THEN
    RAISE EXCEPTION 'مركز التكلفة مرتبط بـ % إدارة - يرجى فك الارتباط أو تحديد مركز بديل قبل الأرشفة', v_dept_count;
  END IF;

  IF v_dept_count > 0 AND p_reassign_cost_center_id IS NOT NULL THEN
    UPDATE public.departments SET cost_center_id = p_reassign_cost_center_id WHERE cost_center_id = p_cost_center_id;
  END IF;

  UPDATE public.cost_centers SET status = 'archived', updated_at = now() WHERE id = p_cost_center_id;

  RETURN jsonb_build_object('success', true, 'archived_id', p_cost_center_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_job_position(
  p_position_id uuid,
  p_reassign_position_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pos record;
  v_emp_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) OR public.current_user_is_hr()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_pos FROM public.job_positions WHERE id = p_position_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المسمى الوظيفي غير موجود'; END IF;
  IF v_pos.status = 'archived' THEN RAISE EXCEPTION 'المسمى الوظيفي مؤرشف بالفعل'; END IF;

  SELECT count(*) INTO v_emp_count FROM public.employees WHERE job_position_id = p_position_id AND status <> 'terminated';

  IF v_emp_count > 0 AND p_reassign_position_id IS NULL THEN
    RAISE EXCEPTION 'المسمى الوظيفي مرتبط بـ % موظف - يرجى تحديد مسمى بديل قبل الأرشفة', v_emp_count;
  END IF;

  IF v_emp_count > 0 AND p_reassign_position_id IS NOT NULL THEN
    UPDATE public.employees SET job_position_id = p_reassign_position_id WHERE job_position_id = p_position_id;
  END IF;

  UPDATE public.job_positions SET status = 'archived', updated_at = now() WHERE id = p_position_id;

  RETURN jsonb_build_object('success', true, 'archived_id', p_position_id);
END;
$$;

-- 9. Grants & Revocations for RPCs
REVOKE ALL ON FUNCTION public.validate_department_hierarchy(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_department_hierarchy(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_master_data_dependencies(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_master_data_dependencies(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_organization_unit(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_organization_unit(uuid, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_subsidiary(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_subsidiary(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_work_location(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_work_location(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_cost_center(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_cost_center(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_job_position(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_job_position(uuid, uuid) TO authenticated;

-- 10. RLS on History Tables
ALTER TABLE public.organization_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_change_history_read" ON public.organization_change_history;
CREATE POLICY "org_change_history_read" ON public.organization_change_history
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_user_company_id()
    OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'auditor'])
  );

DROP POLICY IF EXISTS "org_change_history_insert" ON public.organization_change_history;
CREATE POLICY "org_change_history_insert" ON public.organization_change_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    OR public.current_user_is_hr()
  );

DROP POLICY IF EXISTS "emp_assignment_history_read" ON public.employee_assignment_history;
CREATE POLICY "emp_assignment_history_read" ON public.employee_assignment_history
  FOR SELECT TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR company_id = public.current_user_company_id()
    OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'auditor'])
  );

DROP POLICY IF EXISTS "emp_assignment_history_insert" ON public.employee_assignment_history;
CREATE POLICY "emp_assignment_history_insert" ON public.employee_assignment_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    OR public.current_user_is_hr()
  );

REVOKE ALL ON public.organization_change_history, public.employee_assignment_history FROM anon;
GRANT SELECT, INSERT ON public.organization_change_history, public.employee_assignment_history TO authenticated;
GRANT ALL ON public.organization_change_history, public.employee_assignment_history TO service_role;
