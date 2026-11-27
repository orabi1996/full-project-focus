BEGIN;

-- Never choose an arbitrary employee record when the caller has no unique,
-- verified company context. This helper is shared by employee and manager RLS.
CREATE OR REPLACE FUNCTION public.resolve_my_employee_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_employee_id uuid;
  v_match_count integer;
BEGIN
  IF v_user_id IS NULL OR v_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*), (array_agg(matches.id))[1]
  INTO v_match_count, v_employee_id
  FROM (
    SELECT DISTINCT e.id
    FROM public.employees e
    LEFT JOIN auth.users u ON lower(u.email) = lower(e.email)
    WHERE e.company_id = v_company_id
      AND (e.user_id = v_user_id
        OR e.custom_fields->>'userId' = v_user_id::text
        OR (u.id = v_user_id AND u.email_confirmed_at IS NOT NULL))
      AND e.status::text NOT IN ('terminated', 'suspended')
  ) AS matches;

  IF v_match_count <> 1 THEN
    RETURN NULL;
  END IF;
  RETURN v_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_my_employee_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_my_employee_id() TO authenticated, service_role;

-- Preserve the existing RPC payloads while validating tenant scope before
-- calling the old implementations. The legacy versions are no longer API-callable.
ALTER FUNCTION public.get_authenticated_employee_context(uuid)
  RENAME TO get_authenticated_employee_context_unscoped;
ALTER FUNCTION public.get_manager_team_summary(uuid)
  RENAME TO get_manager_team_summary_unscoped;
ALTER FUNCTION public.get_manager_team_members(uuid)
  RENAME TO get_manager_team_members_unscoped;

REVOKE ALL ON FUNCTION public.get_authenticated_employee_context_unscoped(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_manager_team_summary_unscoped(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_manager_team_members_unscoped(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.resolve_rpc_company_scope(p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := COALESCE(p_company_id, public.current_company_id());
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'Active company membership is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_access_core_company(v_company_id) THEN
    RAISE EXCEPTION 'Requested company is outside the caller tenant scope.' USING ERRCODE = '42501';
  END IF;
  RETURN v_company_id;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_rpc_company_scope(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_authenticated_employee_context(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := public.resolve_rpc_company_scope(p_company_id);
  RETURN public.get_authenticated_employee_context_unscoped(v_company_id);
END;
$$;

CREATE FUNCTION public.get_manager_team_summary(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_manager_id uuid;
BEGIN
  v_company_id := public.resolve_rpc_company_scope(p_company_id);
  v_manager_id := public.resolve_my_employee_id();
  IF v_manager_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = v_manager_id AND e.company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Manager membership is not available in the selected company.' USING ERRCODE = '42501';
  END IF;
  RETURN public.get_manager_team_summary_unscoped(v_company_id);
END;
$$;

CREATE FUNCTION public.get_manager_team_members(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_manager_id uuid;
BEGIN
  v_company_id := public.resolve_rpc_company_scope(p_company_id);
  v_manager_id := public.resolve_my_employee_id();
  IF v_manager_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = v_manager_id AND e.company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Manager membership is not available in the selected company.' USING ERRCODE = '42501';
  END IF;
  RETURN public.get_manager_team_members_unscoped(v_company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_authenticated_employee_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_team_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_team_members(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_authenticated_employee_context(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_manager_team_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_manager_team_members(uuid) FROM PUBLIC, anon;

-- Keep self-service profile changes in the verified tenant and bind the row to
-- the employee's actual company. The trigger fills company_id for trusted
-- clients that omit it, but rejects mismatches and unresolved employee records.
CREATE OR REPLACE FUNCTION public.guard_employee_scoped_row_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee_company_id uuid;
BEGIN
  SELECT e.company_id INTO v_employee_company_id
  FROM public.employees e
  WHERE e.id = NEW.employee_id;
  IF NOT FOUND OR v_employee_company_id IS NULL THEN
    RAISE EXCEPTION 'Employee must have a verified company before writing scoped data.' USING ERRCODE = '23514';
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_employee_company_id;
  ELSIF NEW.company_id IS DISTINCT FROM v_employee_company_id THEN
    RAISE EXCEPTION 'Record company must match its employee company.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_employee_scoped_row_company() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_profile_change_company ON public.employee_profile_change_requests;
CREATE TRIGGER trg_guard_profile_change_company
  BEFORE INSERT OR UPDATE OF employee_id, company_id
  ON public.employee_profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_scoped_row_company();

DROP TRIGGER IF EXISTS trg_guard_punch_company ON public.punches;
CREATE TRIGGER trg_guard_punch_company
  BEFORE INSERT OR UPDATE OF employee_id, company_id
  ON public.punches
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_scoped_row_company();

DROP TRIGGER IF EXISTS trg_guard_attendance_record_company ON public.attendance_records;
CREATE TRIGGER trg_guard_attendance_record_company
  BEFORE INSERT OR UPDATE OF employee_id, company_id
  ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_scoped_row_company();

DROP POLICY IF EXISTS pcr_select_policy ON public.employee_profile_change_requests;
DROP POLICY IF EXISTS pcr_insert_policy ON public.employee_profile_change_requests;
DROP POLICY IF EXISTS pcr_update_policy ON public.employee_profile_change_requests;
CREATE POLICY pcr_select_policy ON public.employee_profile_change_requests
  FOR SELECT TO authenticated
  USING (
    company_id IS NOT NULL
    AND company_id = public.current_company_id()
    AND (
      employee_id = public.resolve_my_employee_id()
      OR employee_id IN (
        SELECT e.id FROM public.employees e
        WHERE e.company_id = public.current_company_id()
          AND (e.manager_id = public.resolve_my_employee_id()
            OR e.manager_employee_id = public.resolve_my_employee_id())
      )
      OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'hr_specialist', 'admin'])
    )
  );
CREATE POLICY pcr_insert_policy ON public.employee_profile_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IS NOT NULL
    AND company_id = public.current_company_id()
    AND employee_id = public.resolve_my_employee_id()
  );
CREATE POLICY pcr_update_policy ON public.employee_profile_change_requests
  FOR UPDATE TO authenticated
  USING (
    company_id IS NOT NULL
    AND company_id = public.current_company_id()
    AND (
      employee_id IN (
        SELECT e.id FROM public.employees e
        WHERE e.company_id = public.current_company_id()
          AND (e.manager_id = public.resolve_my_employee_id()
            OR e.manager_employee_id = public.resolve_my_employee_id())
      )
      OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'hr_specialist', 'admin'])
    )
  )
  WITH CHECK (
    company_id IS NOT NULL
    AND company_id = public.current_company_id()
    AND (
      employee_id IN (
        SELECT e.id FROM public.employees e
        WHERE e.company_id = public.current_company_id()
          AND (e.manager_id = public.resolve_my_employee_id()
            OR e.manager_employee_id = public.resolve_my_employee_id())
      )
      OR public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'hr_specialist', 'admin'])
    )
  );

-- Existing attendance_scoped_read/attendance_staff_write policies were
-- permissive and had no tenant predicates; remove them so they cannot OR-open
-- rows alongside the stricter attendance policies.
DROP POLICY IF EXISTS attendance_scoped_read ON public.attendance_records;
DROP POLICY IF EXISTS attendance_staff_write ON public.attendance_records;
DROP POLICY IF EXISTS att_read ON public.attendance_records;
DROP POLICY IF EXISTS att_write ON public.attendance_records;

DROP POLICY IF EXISTS punches_read ON public.punches;
DROP POLICY IF EXISTS punches_insert ON public.punches;
-- Older permissive policies on punches OR with the company-scoped policies.
DROP POLICY IF EXISTS punches_self_or_hr_read ON public.punches;
DROP POLICY IF EXISTS punches_self_insert ON public.punches;
CREATE POLICY punches_read ON public.punches
  FOR SELECT TO authenticated
  USING (
    company_id IS NOT NULL AND company_id = public.current_company_id()
    AND (
      employee_id = public.resolve_my_employee_id()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
      OR employee_id IN (
        SELECT e.id FROM public.employees e
        WHERE e.company_id = public.current_company_id()
          AND (e.manager_id = public.resolve_my_employee_id()
            OR e.manager_employee_id = public.resolve_my_employee_id())
      )
    )
  );
CREATE POLICY punches_insert ON public.punches
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IS NOT NULL AND company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = punches.employee_id AND e.company_id = public.current_company_id()
    )
    AND (
      employee_id = public.resolve_my_employee_id()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

DROP POLICY IF EXISTS attendance_records_read ON public.attendance_records;
DROP POLICY IF EXISTS attendance_records_manage ON public.attendance_records;
CREATE POLICY attendance_records_read ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    company_id IS NOT NULL AND company_id = public.current_company_id()
    AND (
      employee_id = public.resolve_my_employee_id()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
      OR employee_id IN (
        SELECT e.id FROM public.employees e
        WHERE e.company_id = public.current_company_id()
          AND (e.manager_id = public.resolve_my_employee_id()
            OR e.manager_employee_id = public.resolve_my_employee_id())
      )
    )
  );
CREATE POLICY attendance_records_manage ON public.attendance_records
  FOR ALL TO authenticated
  USING (
    company_id IS NOT NULL AND company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  )
  WITH CHECK (
    company_id IS NOT NULL AND company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = attendance_records.employee_id AND e.company_id = public.current_company_id()
    )
  );

COMMIT;
