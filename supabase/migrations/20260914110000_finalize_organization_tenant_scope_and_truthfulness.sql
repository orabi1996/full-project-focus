-- ============================================================================
-- Migration: 20260914110000_finalize_organization_tenant_scope_and_truthfulness.sql
-- Description:
-- 1. Trusted helper: current_user_can_manage_company(p_company_id)
-- 2. Tenant-scope security hardening for all Organization SECURITY DEFINER RPCs:
--    - archive_organization_unit
--    - archive_subsidiary
--    - archive_work_location
--    - archive_cost_center
--    - archive_job_position
--    - get_master_data_dependencies
-- 3. Strict tenant-scoped RLS policies on organization_change_history & employee_assignment_history
-- 4. Master table RLS audit & hardening (departments, subsidiaries, work_locations, cost_centers, job_positions, companies)
-- 5. Cross-company relationship and manager assignment integrity triggers
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TRUSTED HELPER: current_user_can_manage_company
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_can_manage_company(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_company_id uuid;
BEGIN
  -- Unauthenticated or missing target company: reject
  IF v_uid IS NULL OR p_company_id IS NULL THEN
    RETURN false;
  END IF;

  -- super_admin: global management authority across all companies
  IF public.current_user_has_any_role(ARRAY['super_admin']) THEN
    RETURN true;
  END IF;

  -- Resolve authenticated user's company
  v_user_company_id := public.current_user_company_id();
  IF v_user_company_id IS NULL THEN
    RETURN false;
  END IF;

  -- Strict same-company verification: cross-company operations are completely forbidden
  IF v_user_company_id <> p_company_id THEN
    RETURN false;
  END IF;

  -- Authorized roles within the same company
  IF public.current_user_has_any_role(ARRAY['org_admin', 'hr_manager']) OR public.current_user_is_hr() THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_manage_company(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_company(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. HARDEN get_master_data_dependencies RPC
-- ---------------------------------------------------------------------------
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
  v_entity_company_id uuid;
  v_result jsonb;
  v_emp_count integer := 0;
  v_child_dept_count integer := 0;
  v_pos_count integer := 0;
  v_loc_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: المستخدم غير مسجل دخول';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'المعرف غير صالح أو مفقود';
  END IF;

  -- 1. Load entity & resolve company_id. If entity not found, raise not-found exception.
  IF p_entity_type = 'department' THEN
    SELECT company_id INTO v_entity_company_id FROM public.departments WHERE id = p_entity_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'الإدارة المستهدفة غير موجودة'; END IF;
  ELSIF p_entity_type = 'subsidiary' THEN
    SELECT company_id INTO v_entity_company_id FROM public.subsidiaries WHERE id = p_entity_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'الشركة التابعة المستهدفة غير موجودة'; END IF;
  ELSIF p_entity_type = 'work_location' THEN
    SELECT company_id INTO v_entity_company_id FROM public.work_locations WHERE id = p_entity_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'موقع العمل المستهدف غير موجود'; END IF;
  ELSIF p_entity_type = 'cost_center' THEN
    SELECT company_id INTO v_entity_company_id FROM public.cost_centers WHERE id = p_entity_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'مركز التكلفة المستهدف غير موجود'; END IF;
  ELSIF p_entity_type = 'job_position' THEN
    SELECT company_id INTO v_entity_company_id FROM public.job_positions WHERE id = p_entity_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'المسمى الوظيفي المستهدف غير موجود'; END IF;
  ELSE
    RAISE EXCEPTION 'نوع الكيان غير معروف: %', p_entity_type;
  END IF;

  -- Fall back to caller's company if entity company_id is NULL
  IF v_entity_company_id IS NULL THEN
    v_entity_company_id := public.current_user_company_id();
  END IF;

  -- 2. Verify caller has permission to manage this specific company
  IF NOT public.current_user_can_manage_company(v_entity_company_id) THEN
    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية الوصول لبيانات هذه المنشأة';
  END IF;

  -- 3. Compute dependencies
  IF p_entity_type = 'department' THEN
    SELECT count(*) INTO v_emp_count FROM public.employees WHERE department_id = p_entity_id AND status NOT IN ('terminated');
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
    SELECT count(*) INTO v_emp_count FROM public.employees WHERE subsidiary_id = p_entity_id AND status NOT IN ('terminated');
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
    SELECT count(*) INTO v_emp_count FROM public.employees WHERE work_location_id = p_entity_id AND status NOT IN ('terminated');
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
    SELECT count(*) INTO v_emp_count FROM public.employees WHERE job_position_id = p_entity_id AND status NOT IN ('terminated');
    v_result := jsonb_build_object(
      'entity_type', 'job_position',
      'entity_id', p_entity_id,
      'employees_count', v_emp_count,
      'has_dependencies', (v_emp_count > 0)
    );
  END IF;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. HARDEN archive_organization_unit RPC
-- ---------------------------------------------------------------------------
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
  v_reparent_dept record;
  v_target_company_id uuid;
  v_emp_count integer := 0;
  v_child_count integer := 0;
  v_reparent_target uuid;
  v_emp record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: المستخدم غير مسجل دخول';
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

  -- Resolve company_id
  v_target_company_id := COALESCE(v_dept.company_id, public.current_user_company_id());

  -- Strict company-scope authorization check
  IF NOT public.current_user_can_manage_company(v_target_company_id) THEN
    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إدارة المنشأة التابعة لها هذه الإدارة';
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

    IF COALESCE(v_reassign_dept.company_id, v_target_company_id) <> v_target_company_id THEN
      RAISE EXCEPTION 'إدارة إعادة التسكين لا تتبع نفس المنشأة';
    END IF;
  END IF;

  -- Check employee dependencies
  SELECT count(*) INTO v_emp_count
  FROM public.employees
  WHERE department_id = p_department_id AND status NOT IN ('terminated');

  IF v_emp_count > 0 AND p_reassign_department_id IS NULL THEN
    RAISE EXCEPTION 'يوجد % موظف مسكن في هذه الإدارة - يجب اختيار إدارة بديلة لنقلهم قبل الأرشفة', v_emp_count;
  END IF;

  -- Atomically reassign employees if any
  IF v_emp_count > 0 AND p_reassign_department_id IS NOT NULL THEN
    FOR v_emp IN
      SELECT id, company_id, subsidiary_id, work_location_id, job_position_id, cost_center_id, manager_id
      FROM public.employees
      WHERE department_id = p_department_id AND status NOT IN ('terminated')
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
        COALESCE(v_emp.company_id, v_target_company_id),
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
    WHERE department_id = p_department_id AND status NOT IN ('terminated');
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

      SELECT * INTO v_reparent_dept
      FROM public.departments
      WHERE id = p_reparent_children_to;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'إدارة ربط الفروع المستهدفة غير موجودة';
      END IF;

      IF COALESCE(v_reparent_dept.company_id, v_target_company_id) <> v_target_company_id THEN
        RAISE EXCEPTION 'إدارة ربط الفروع لا تتبع نفس المنشأة';
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
    v_target_company_id,
    'department',
    p_department_id,
    'archive',
    to_jsonb(v_dept),
    jsonb_build_object('status', 'archived', 'reassigned_employees_count', v_emp_count, 'reparented_children_count', v_child_count),
    'أرشفة وحدة تنظيمية مع نقل الموظفين وإعادة ربط الفروع',
    v_user_id
  );

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

-- ---------------------------------------------------------------------------
-- 4. HARDEN archive_subsidiary RPC
-- ---------------------------------------------------------------------------
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
  v_reassign_sub record;
  v_target_company_id uuid;
  v_emp_count integer := 0;
  v_dept_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_sub FROM public.subsidiaries WHERE id = p_subsidiary_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الشركة التابعة غير موجودة'; END IF;
  IF v_sub.status = 'archived' THEN RAISE EXCEPTION 'الشركة التابعة مؤرشفة بالفعل'; END IF;

  v_target_company_id := COALESCE(v_sub.company_id, public.current_user_company_id());
  IF NOT public.current_user_can_manage_company(v_target_company_id) THEN
    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إدارة الشركة التابعة لهذه المنشأة';
  END IF;

  IF p_reassign_subsidiary_id IS NOT NULL THEN
    IF p_reassign_subsidiary_id = p_subsidiary_id THEN
      RAISE EXCEPTION 'لا يمكن إعادة التسكين لنفس الشركة المراد أرشفتها';
    END IF;

    SELECT * INTO v_reassign_sub FROM public.subsidiaries WHERE id = p_reassign_subsidiary_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'الشركة التابعة لإعادة التسكين غير موجودة'; END IF;
    IF COALESCE(v_reassign_sub.company_id, v_target_company_id) <> v_target_company_id THEN
      RAISE EXCEPTION 'الشركة التابعة لإعادة التسكين تتبع منشأة أخرى';
    END IF;
  END IF;

  SELECT count(*) INTO v_emp_count FROM public.employees WHERE subsidiary_id = p_subsidiary_id AND status NOT IN ('terminated');
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
    v_target_company_id,
    'subsidiary',
    p_subsidiary_id,
    'archive',
    to_jsonb(v_sub),
    jsonb_build_object('status', 'archived'),
    'أرشفة شركة تابعة',
    v_user_id
  );

  RETURN jsonb_build_object('success', true, 'archived_id', p_subsidiary_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. HARDEN archive_work_location RPC
-- ---------------------------------------------------------------------------
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
  v_reassign_loc record;
  v_target_company_id uuid;
  v_emp_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_loc FROM public.work_locations WHERE id = p_location_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'موقع العمل غير موجود'; END IF;
  IF v_loc.status = 'archived' THEN RAISE EXCEPTION 'موقع العمل مؤرشف بالفعل'; END IF;

  v_target_company_id := COALESCE(v_loc.company_id, public.current_user_company_id());
  IF NOT public.current_user_can_manage_company(v_target_company_id) THEN
    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إدارة موقع العمل لهذه المنشأة';
  END IF;

  IF p_reassign_location_id IS NOT NULL THEN
    IF p_reassign_location_id = p_location_id THEN
      RAISE EXCEPTION 'لا يمكن إعادة التسكين لنفس موقع العمل المراد أرشفته';
    END IF;

    SELECT * INTO v_reassign_loc FROM public.work_locations WHERE id = p_reassign_location_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'موقع العمل لإعادة التسكين غير موجود'; END IF;
    IF COALESCE(v_reassign_loc.company_id, v_target_company_id) <> v_target_company_id THEN
      RAISE EXCEPTION 'موقع العمل لإعادة التسكين يتبع منشأة أخرى';
    END IF;
  END IF;

  SELECT count(*) INTO v_emp_count FROM public.employees WHERE work_location_id = p_location_id AND status NOT IN ('terminated');

  IF v_emp_count > 0 AND p_reassign_location_id IS NULL THEN
    RAISE EXCEPTION 'الموقع مرتبط بـ % موظف - يرجى تحديد موقع بديل لنقلهم قبل الأرشفة', v_emp_count;
  END IF;

  IF v_emp_count > 0 AND p_reassign_location_id IS NOT NULL THEN
    UPDATE public.employees SET work_location_id = p_reassign_location_id WHERE work_location_id = p_location_id;
  END IF;

  UPDATE public.work_locations SET status = 'archived', updated_at = now() WHERE id = p_location_id;

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
    v_target_company_id,
    'work_location',
    p_location_id,
    'archive',
    to_jsonb(v_loc),
    jsonb_build_object('status', 'archived'),
    'أرشفة موقع عمل',
    v_user_id
  );

  RETURN jsonb_build_object('success', true, 'archived_id', p_location_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. HARDEN archive_cost_center RPC
-- ---------------------------------------------------------------------------
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
  v_reassign_cc record;
  v_target_company_id uuid;
  v_dept_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_cc FROM public.cost_centers WHERE id = p_cost_center_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'مركز التكلفة غير موجود'; END IF;
  IF v_cc.status = 'archived' THEN RAISE EXCEPTION 'مركز التكلفة مؤرشف بالفعل'; END IF;

  v_target_company_id := COALESCE(v_cc.company_id, public.current_user_company_id());
  IF NOT public.current_user_can_manage_company(v_target_company_id) THEN
    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إدارة مركز التكلفة لهذه المنشأة';
  END IF;

  IF p_reassign_cost_center_id IS NOT NULL THEN
    IF p_reassign_cost_center_id = p_cost_center_id THEN
      RAISE EXCEPTION 'لا يمكن إعادة التسكين لنفس مركز التكلفة المراد أرشفته';
    END IF;

    SELECT * INTO v_reassign_cc FROM public.cost_centers WHERE id = p_reassign_cost_center_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'مركز التكلفة لإعادة التسكين غير موجود'; END IF;
    IF COALESCE(v_reassign_cc.company_id, v_target_company_id) <> v_target_company_id THEN
      RAISE EXCEPTION 'مركز التكلفة لإعادة التسكين يتبع منشأة أخرى';
    END IF;
  END IF;

  SELECT count(*) INTO v_dept_count FROM public.departments WHERE cost_center_id = p_cost_center_id AND status <> 'archived';

  IF v_dept_count > 0 AND p_reassign_cost_center_id IS NULL THEN
    RAISE EXCEPTION 'مركز التكلفة مرتبط بـ % إدارة - يرجى فك الارتباط أو تحديد مركز بديل قبل الأرشفة', v_dept_count;
  END IF;

  IF v_dept_count > 0 AND p_reassign_cost_center_id IS NOT NULL THEN
    UPDATE public.departments SET cost_center_id = p_reassign_cost_center_id WHERE cost_center_id = p_cost_center_id;
  END IF;

  UPDATE public.cost_centers SET status = 'archived', updated_at = now() WHERE id = p_cost_center_id;

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
    v_target_company_id,
    'cost_center',
    p_cost_center_id,
    'archive',
    to_jsonb(v_cc),
    jsonb_build_object('status', 'archived'),
    'أرشفة مركز تكلفة',
    v_user_id
  );

  RETURN jsonb_build_object('success', true, 'archived_id', p_cost_center_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. HARDEN archive_job_position RPC
-- ---------------------------------------------------------------------------
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
  v_reassign_pos record;
  v_target_company_id uuid;
  v_emp_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_pos FROM public.job_positions WHERE id = p_position_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المسمى الوظيفي غير موجود'; END IF;
  IF v_pos.status = 'archived' THEN RAISE EXCEPTION 'المسمى الوظيفي مؤرشف بالفعل'; END IF;

  v_target_company_id := COALESCE(v_pos.company_id, public.current_user_company_id());
  IF NOT public.current_user_can_manage_company(v_target_company_id) THEN
    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إدارة المسمى الوظيفي لهذه المنشأة';
  END IF;

  IF p_reassign_position_id IS NOT NULL THEN
    IF p_reassign_position_id = p_position_id THEN
      RAISE EXCEPTION 'لا يمكن إعادة التسكين لنفس المسمى الوظيفي المراد أرشفته';
    END IF;

    SELECT * INTO v_reassign_pos FROM public.job_positions WHERE id = p_reassign_position_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'المسمى الوظيفي لإعادة التسكين غير موجود'; END IF;
    IF COALESCE(v_reassign_pos.company_id, v_target_company_id) <> v_target_company_id THEN
      RAISE EXCEPTION 'المسمى الوظيفي لإعادة التسكين يتبع منشأة أخرى';
    END IF;
  END IF;

  SELECT count(*) INTO v_emp_count FROM public.employees WHERE job_position_id = p_position_id AND status NOT IN ('terminated');

  IF v_emp_count > 0 AND p_reassign_position_id IS NULL THEN
    RAISE EXCEPTION 'المسمى الوظيفي مرتبط بـ % موظف - يرجى تحديد مسمى بديل قبل الأرشفة', v_emp_count;
  END IF;

  IF v_emp_count > 0 AND p_reassign_position_id IS NOT NULL THEN
    UPDATE public.employees SET job_position_id = p_reassign_position_id WHERE job_position_id = p_position_id;
  END IF;

  UPDATE public.job_positions SET status = 'archived', updated_at = now() WHERE id = p_position_id;

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
    v_target_company_id,
    'job_position',
    p_position_id,
    'archive',
    to_jsonb(v_pos),
    jsonb_build_object('status', 'archived'),
    'أرشفة مسمى وظيفي',
    v_user_id
  );

  RETURN jsonb_build_object('success', true, 'archived_id', p_position_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. STRICT TENANT-SCOPED HISTORY TABLE RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_change_history_read" ON public.organization_change_history;
CREATE POLICY "org_change_history_read" ON public.organization_change_history
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['super_admin'])
    OR (
      company_id = public.current_user_company_id()
      AND (
        public.current_user_has_any_role(ARRAY['org_admin', 'hr_manager', 'auditor'])
        OR public.current_user_is_hr()
      )
    )
  );

DROP POLICY IF EXISTS "org_change_history_insert" ON public.organization_change_history;
CREATE POLICY "org_change_history_insert" ON public.organization_change_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_manage_company(company_id)
  );

DROP POLICY IF EXISTS "emp_assignment_history_read" ON public.employee_assignment_history;
CREATE POLICY "emp_assignment_history_read" ON public.employee_assignment_history
  FOR SELECT TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_has_any_role(ARRAY['super_admin'])
    OR (
      company_id = public.current_user_company_id()
      AND (
        public.current_user_has_any_role(ARRAY['org_admin', 'hr_manager', 'auditor'])
        OR public.current_user_is_hr()
      )
    )
  );

DROP POLICY IF EXISTS "emp_assignment_history_insert" ON public.employee_assignment_history;
CREATE POLICY "emp_assignment_history_insert" ON public.employee_assignment_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_manage_company(company_id)
  );

-- ---------------------------------------------------------------------------
-- 9. MASTER TABLE RLS AUDIT & HARDENING
-- ---------------------------------------------------------------------------
-- A. departments
DROP POLICY IF EXISTS "departments_hr_write" ON public.departments;
DROP POLICY IF EXISTS "dept_write" ON public.departments;
CREATE POLICY "departments_tenant_insert" ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "departments_tenant_update" ON public.departments
  FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_company(company_id))
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "departments_tenant_delete" ON public.departments
  FOR DELETE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['super_admin']));

-- B. subsidiaries
DROP POLICY IF EXISTS "subsidiaries_hr_write" ON public.subsidiaries;
CREATE POLICY "subsidiaries_tenant_insert" ON public.subsidiaries
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "subsidiaries_tenant_update" ON public.subsidiaries
  FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_company(company_id))
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "subsidiaries_tenant_delete" ON public.subsidiaries
  FOR DELETE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['super_admin']));

-- C. work_locations
DROP POLICY IF EXISTS "locations_hr_write" ON public.work_locations;
CREATE POLICY "work_locations_tenant_insert" ON public.work_locations
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "work_locations_tenant_update" ON public.work_locations
  FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_company(company_id))
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "work_locations_tenant_delete" ON public.work_locations
  FOR DELETE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['super_admin']));

-- D. cost_centers
DROP POLICY IF EXISTS "cost_centers_hr_write" ON public.cost_centers;
CREATE POLICY "cost_centers_tenant_insert" ON public.cost_centers
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "cost_centers_tenant_update" ON public.cost_centers
  FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_company(company_id))
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "cost_centers_tenant_delete" ON public.cost_centers
  FOR DELETE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['super_admin']));

-- E. job_positions
DROP POLICY IF EXISTS "job_positions_hr_write" ON public.job_positions;
CREATE POLICY "job_positions_tenant_insert" ON public.job_positions
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "job_positions_tenant_update" ON public.job_positions
  FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_company(company_id))
  WITH CHECK (public.current_user_can_manage_company(company_id));

CREATE POLICY "job_positions_tenant_delete" ON public.job_positions
  FOR DELETE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['super_admin']));

-- F. companies
DROP POLICY IF EXISTS "companies_hr_write" ON public.companies;
CREATE POLICY "companies_tenant_update" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_company(id))
  WITH CHECK (public.current_user_can_manage_company(id));

CREATE POLICY "companies_tenant_delete" ON public.companies
  FOR DELETE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['super_admin']));

-- ---------------------------------------------------------------------------
-- 10. CROSS-COMPANY RELATIONSHIP & MANAGER INTEGRITY TRIGGER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_organization_relationships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_company_id uuid;
  v_rel_company_id uuid;
  v_mgr_status text;
  v_mgr_company_id uuid;
BEGIN
  -- Default company_id if missing
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_user_company_id();
  END IF;

  -- Non-super-admin cannot assign a record to a different company
  IF NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
    v_caller_company_id := public.current_user_company_id();
    IF v_caller_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND NEW.company_id <> v_caller_company_id THEN
      RAISE EXCEPTION 'لا يمكن إنشاء أو تعديل سجل يتبع منشأة أخرى';
    END IF;
  END IF;

  -- Table-specific relationship validation
  IF TG_TABLE_NAME = 'departments' THEN
    -- Check parent department
    IF NEW.parent_id IS NOT NULL THEN
      SELECT company_id INTO v_rel_company_id FROM public.departments WHERE id = NEW.parent_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'الإدارة الرئيسية غير موجودة'; END IF;
      IF v_rel_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_rel_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'الإدارة الرئيسية لا تتبع نفس المنشأة';
      END IF;
    END IF;

    -- Check subsidiary
    IF NEW.subsidiary_id IS NOT NULL THEN
      SELECT company_id INTO v_rel_company_id FROM public.subsidiaries WHERE id = NEW.subsidiary_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'الشركة التابعة غير موجودة'; END IF;
      IF v_rel_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_rel_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'الشركة التابعة لا تتبع نفس المنشأة';
      END IF;
    END IF;

    -- Check cost center
    IF NEW.cost_center_id IS NOT NULL THEN
      SELECT company_id INTO v_rel_company_id FROM public.cost_centers WHERE id = NEW.cost_center_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'مركز التكلفة غير موجود'; END IF;
      IF v_rel_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_rel_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'مركز التكلفة لا يتبع نفس المنشأة';
      END IF;
    END IF;

    -- Check manager employee
    IF NEW.manager_employee_id IS NOT NULL THEN
      SELECT company_id, status INTO v_mgr_company_id, v_mgr_status
      FROM public.employees
      WHERE id = NEW.manager_employee_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'المدير المحدد غير مسجل في النظام كموظف';
      END IF;

      IF v_mgr_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_mgr_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'المدير المحدد يتبع منشأة أخرى';
      END IF;

      IF v_mgr_status IN ('terminated', 'suspended') THEN
        RAISE EXCEPTION 'لا يمكن تعيين موظف منتهية خدمته أو موقوف كمدير للإدارة';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'subsidiaries' THEN
    IF NEW.manager_employee_id IS NOT NULL THEN
      SELECT company_id, status INTO v_mgr_company_id, v_mgr_status
      FROM public.employees
      WHERE id = NEW.manager_employee_id;

      IF NOT FOUND THEN RAISE EXCEPTION 'المدير المحدد غير موجود'; END IF;
      IF v_mgr_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_mgr_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'المدير المحدد يتبع منشأة أخرى';
      END IF;
      IF v_mgr_status IN ('terminated', 'suspended') THEN
        RAISE EXCEPTION 'لا يمكن تعيين موظف غير نشط كمدير للشركة التابعة';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'work_locations' THEN
    IF NEW.subsidiary_id IS NOT NULL THEN
      SELECT company_id INTO v_rel_company_id FROM public.subsidiaries WHERE id = NEW.subsidiary_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'الشركة التابعة لموقع العمل غير موجودة'; END IF;
      IF v_rel_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_rel_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'الشركة التابعة لموقع العمل تتبع منشأة أخرى';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'cost_centers' THEN
    IF NEW.manager_employee_id IS NOT NULL THEN
      SELECT company_id, status INTO v_mgr_company_id, v_mgr_status
      FROM public.employees
      WHERE id = NEW.manager_employee_id;

      IF NOT FOUND THEN RAISE EXCEPTION 'المدير المحدد لمركز التكلفة غير موجود'; END IF;
      IF v_mgr_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_mgr_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'المدير المحدد لمركز التكلفة يتبع منشأة أخرى';
      END IF;
      IF v_mgr_status IN ('terminated', 'suspended') THEN
        RAISE EXCEPTION 'لا يمكن تعيين موظف غير نشط كمدير لمركز التكلفة';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'job_positions' THEN
    IF NEW.department_id IS NOT NULL THEN
      SELECT company_id INTO v_rel_company_id FROM public.departments WHERE id = NEW.department_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'إدارة المسمى الوظيفي غير موجودة'; END IF;
      IF v_rel_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_rel_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'إدارة المسمى الوظيفي تتبع منشأة أخرى';
      END IF;
    END IF;

    IF NEW.subsidiary_id IS NOT NULL THEN
      SELECT company_id INTO v_rel_company_id FROM public.subsidiaries WHERE id = NEW.subsidiary_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'الشركة التابعة للمسمى الوظيفي غير موجودة'; END IF;
      IF v_rel_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_rel_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'الشركة التابعة للمسمى الوظيفي تتبع منشأة أخرى';
      END IF;
    END IF;

    IF NEW.cost_center_id IS NOT NULL THEN
      SELECT company_id INTO v_rel_company_id FROM public.cost_centers WHERE id = NEW.cost_center_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'مركز التكلفة للمسمى الوظيفي غير موجود'; END IF;
      IF v_rel_company_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_rel_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'مركز التكلفة للمسمى الوظيفي يتبع منشأة أخرى';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_departments_relationships ON public.departments;
CREATE TRIGGER trg_validate_departments_relationships
  BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.validate_organization_relationships();

DROP TRIGGER IF EXISTS trg_validate_subsidiaries_relationships ON public.subsidiaries;
CREATE TRIGGER trg_validate_subsidiaries_relationships
  BEFORE INSERT OR UPDATE ON public.subsidiaries
  FOR EACH ROW EXECUTE FUNCTION public.validate_organization_relationships();

DROP TRIGGER IF EXISTS trg_validate_work_locations_relationships ON public.work_locations;
CREATE TRIGGER trg_validate_work_locations_relationships
  BEFORE INSERT OR UPDATE ON public.work_locations
  FOR EACH ROW EXECUTE FUNCTION public.validate_organization_relationships();

DROP TRIGGER IF EXISTS trg_validate_cost_centers_relationships ON public.cost_centers;
CREATE TRIGGER trg_validate_cost_centers_relationships
  BEFORE INSERT OR UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.validate_organization_relationships();

DROP TRIGGER IF EXISTS trg_validate_job_positions_relationships ON public.job_positions;
CREATE TRIGGER trg_validate_job_positions_relationships
  BEFORE INSERT OR UPDATE ON public.job_positions
  FOR EACH ROW EXECUTE FUNCTION public.validate_organization_relationships();
