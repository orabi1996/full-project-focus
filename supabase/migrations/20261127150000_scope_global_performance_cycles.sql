-- Keep reusable global performance cycles visible/manageable only by super admins.
-- A cycle must carry an explicit tenant before participant snapshots are launched.
BEGIN;

DROP POLICY IF EXISTS "performance_cycles_read_policy" ON public.performance_cycles;
CREATE POLICY "performance_cycles_read_policy"
  ON public.performance_cycles FOR SELECT TO authenticated
  USING (
    (company_id IS NOT NULL AND company_id = public.current_company_id())
    OR (company_id IS NULL AND public.current_user_has_any_role(ARRAY['super_admin']))
  );

DROP POLICY IF EXISTS "performance_cycles_admin_policy" ON public.performance_cycles;
CREATE POLICY "performance_cycles_admin_policy"
  ON public.performance_cycles FOR ALL TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    AND (
      (company_id IS NOT NULL AND company_id = public.current_company_id())
      OR (company_id IS NULL AND public.current_user_has_any_role(ARRAY['super_admin']))
    )
  )
  WITH CHECK (
    public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
    AND (
      (company_id IS NOT NULL AND company_id = public.current_company_id())
      OR (company_id IS NULL AND public.current_user_has_any_role(ARRAY['super_admin']))
    )
  );

-- The earlier tenant guard intentionally excludes NULL company ids. Permit a
-- NULL/global cycle only to an authenticated super admin; tenant cycles still
-- require normal company access.
DROP POLICY IF EXISTS guard_performance_company ON public.performance_cycles;
CREATE POLICY guard_performance_company ON public.performance_cycles AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    (company_id IS NOT NULL AND public.can_access_core_company(company_id))
    OR (company_id IS NULL AND public.current_user_has_any_role(ARRAY['super_admin']))
  )
  WITH CHECK (
    (company_id IS NOT NULL AND public.can_access_core_company(company_id))
    OR (company_id IS NULL AND public.current_user_has_any_role(ARRAY['super_admin']))
  );

CREATE OR REPLACE FUNCTION public.guard_performance_cycle_launch_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'planned', 'archived') THEN
    IF NEW.company_id IS NULL THEN
      RAISE EXCEPTION 'يجب إسناد دورة التقييم إلى منشأة قبل بدء الدورة' USING ERRCODE = '22023';
    END IF;
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND public.current_company_id() IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'نطاق المنشأة النشط لا يطابق دورة التقييم' USING ERRCODE = '42501';
    END IF;
    IF auth.role() = 'service_role'
       AND public.current_company_id() IS NOT NULL
       AND public.current_company_id() <> NEW.company_id THEN
      RAISE EXCEPTION 'نطاق المنشأة النشط لا يطابق دورة التقييم' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_performance_cycle_launch_scope ON public.performance_cycles;
CREATE TRIGGER guard_performance_cycle_launch_scope
  BEFORE INSERT OR UPDATE OF company_id, status ON public.performance_cycles
  FOR EACH ROW EXECUTE FUNCTION public.guard_performance_cycle_launch_scope();

-- Retain the existing snapshot/assignment implementation behind a private name.
-- The public entry point validates the cycle's tenant before that implementation
-- can enumerate employees.
ALTER FUNCTION public.launch_performance_cycle_atomic(uuid, uuid[])
  RENAME TO launch_performance_cycle_atomic_unscoped;
REVOKE ALL ON FUNCTION public.launch_performance_cycle_atomic_unscoped(uuid, uuid[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.launch_performance_cycle_atomic(
  p_cycle_id uuid,
  p_department_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cycle_company_id uuid;
  v_context_company_id uuid;
  v_caller_uid uuid := auth.uid();
  v_caller_role text := auth.role();
BEGIN
  IF v_caller_role IS DISTINCT FROM 'service_role'
     AND (v_caller_uid IS NULL OR NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])) THEN
    RAISE EXCEPTION 'غير مصرح للمستخدم بإطلاق دورة تقييم الأداء' USING ERRCODE = '42501';
  END IF;

  SELECT pc.company_id INTO v_cycle_company_id
  FROM public.performance_cycles pc
  WHERE pc.id = p_cycle_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'دورة التقييم المحددة غير موجودة' USING ERRCODE = 'P0002';
  END IF;

  IF v_cycle_company_id IS NULL THEN
    RAISE EXCEPTION 'يجب إسناد دورة التقييم إلى منشأة قبل إطلاقها' USING ERRCODE = '22023';
  END IF;

  v_context_company_id := public.current_company_id();
  IF v_caller_role IS DISTINCT FROM 'service_role'
     AND (v_context_company_id IS NULL OR v_context_company_id <> v_cycle_company_id) THEN
    RAISE EXCEPTION 'نطاق المنشأة النشط لا يطابق دورة التقييم' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role = 'service_role'
     AND v_context_company_id IS NOT NULL
     AND v_context_company_id <> v_cycle_company_id THEN
    RAISE EXCEPTION 'نطاق المنشأة النشط لا يطابق دورة التقييم' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role IS DISTINCT FROM 'service_role'
     AND NOT public.can_access_core_company(v_cycle_company_id) THEN
    RAISE EXCEPTION 'غير مصرح بإطلاق دورة خارج نطاق المنشأة' USING ERRCODE = '42501';
  END IF;

  RETURN public.launch_performance_cycle_atomic_unscoped(p_cycle_id, p_department_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.launch_performance_cycle_atomic(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.launch_performance_cycle_atomic(uuid, uuid[]) TO authenticated, service_role;

COMMIT;
