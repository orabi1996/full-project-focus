-- Resolve a tenant only from a verified, active membership. Never guess a tenant.
BEGIN;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_claims jsonb;
  v_claim_company_id uuid;
  v_claim_present boolean := false;
  v_jwt_role text;
  v_company_id uuid;
  v_company_count bigint;
BEGIN
  BEGIN
    v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- Malformed claims must not cause tenant guessing.
    RETURN NULL;
  END;

  v_claim_present := COALESCE(v_claims ? 'company_id', false);
  IF v_claim_present THEN
    BEGIN
      v_claim_company_id := NULLIF(v_claims ->> 'company_id', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
    IF v_claim_company_id IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  v_jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    v_claims ->> 'role'
  );

  -- service_role bypasses RLS. It must carry an explicit, existing tenant
  -- scope before a helper can resolve a company for it.
  IF v_jwt_role = 'service_role' THEN
    IF NOT v_claim_present OR NOT EXISTS (
      SELECT 1 FROM public.companies c WHERE c.id = v_claim_company_id
    ) THEN
      RETURN NULL;
    END IF;
    RETURN v_claim_company_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- A requested tenant is accepted only when it exists and the caller is an
  -- active employee/member there. Super admins retain their explicit global
  -- bypass in can_access_core_company, but a tenant-scoped claim still needs
  -- a real relationship so it cannot silently become an unverified scope.
  IF v_claim_present THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.companies c WHERE c.id = v_claim_company_id
    ) THEN
      RETURN NULL;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = v_user_id
        AND e.company_id = v_claim_company_id
        AND e.status::text NOT IN ('terminated', 'suspended')
    ) OR EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = v_user_id
        AND uca.company_id = v_claim_company_id
        AND uca.status = 'active'
    ) THEN
      RETURN v_claim_company_id;
    END IF;
    RETURN NULL;
  END IF;

  -- Backward-compatible inference is allowed only when exactly one active
  -- tenant relationship exists across both membership sources.
  WITH memberships AS (
    SELECT e.company_id
    FROM public.employees e
    WHERE e.user_id = v_user_id
      AND e.company_id IS NOT NULL
      AND e.status::text NOT IN ('terminated', 'suspended')
    UNION
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = v_user_id
      AND uca.status = 'active'
  )
  SELECT count(*), min(company_id::text)::uuid
  INTO v_company_count, v_company_id
  FROM memberships;

  IF v_company_count = 1 THEN
    RETURN v_company_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_company_id();
$$;

CREATE OR REPLACE FUNCTION public.can_access_core_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND p_company_id IS NOT NULL AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR COALESCE(public.current_company_id() = p_company_id, false)
  );
$$;

-- These legacy SECURITY DEFINER reports treated a NULL tenant as "all
-- companies". Rename their implementations behind non-public names and keep
-- the public RPC signatures as scope-validating wrappers.
ALTER FUNCTION public.get_expense_kpis_atomic(uuid) RENAME TO get_expense_kpis_atomic_unscoped;
ALTER FUNCTION public.get_performance_kpis_atomic(uuid, uuid) RENAME TO get_performance_kpis_atomic_unscoped;

REVOKE ALL ON FUNCTION public.get_expense_kpis_atomic_unscoped(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_performance_kpis_atomic_unscoped(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_expense_kpis_atomic(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF auth.role() = 'service_role' THEN
    IF p_company_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.companies c WHERE c.id = p_company_id
    ) THEN
      RAISE EXCEPTION 'Explicit valid company scope is required.' USING ERRCODE = '22023';
    END IF;
    v_company_id := p_company_id;
  ELSE
    v_company_id := COALESCE(p_company_id, public.current_company_id());
    IF v_company_id IS NULL OR NOT public.can_access_core_company(v_company_id) THEN
      RAISE EXCEPTION 'Active company membership is required.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN public.get_expense_kpis_atomic_unscoped(v_company_id);
END;
$$;

CREATE FUNCTION public.get_performance_kpis_atomic(
  p_cycle_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF auth.role() = 'service_role' THEN
    IF p_company_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.companies c WHERE c.id = p_company_id
    ) THEN
      RAISE EXCEPTION 'Explicit valid company scope is required.' USING ERRCODE = '22023';
    END IF;
    v_company_id := p_company_id;
  ELSE
    v_company_id := COALESCE(p_company_id, public.current_company_id());
    IF v_company_id IS NULL OR NOT public.can_access_core_company(v_company_id) THEN
      RAISE EXCEPTION 'Active company membership is required.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_cycle_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.performance_cycles pc
    WHERE pc.id = p_cycle_id AND pc.company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Performance cycle is outside the requested company scope.' USING ERRCODE = '42501';
  END IF;

  RETURN public.get_performance_kpis_atomic_unscoped(p_cycle_id, v_company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_expense_kpis_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_expense_kpis_atomic(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_performance_kpis_atomic(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_kpis_atomic(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.current_user_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO authenticated;
REVOKE ALL ON FUNCTION public.can_access_core_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_core_company(uuid) TO authenticated;

COMMIT;
