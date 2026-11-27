-- Ensure KPI RPCs cannot be used as SECURITY DEFINER cross-tenant read paths.
-- Keep their public signatures and default arguments intact for existing clients.
BEGIN;

ALTER FUNCTION public.get_payroll_kpis(uuid)
  RENAME TO get_payroll_kpis_unscoped_20261127170000;
REVOKE ALL ON FUNCTION public.get_payroll_kpis_unscoped_20261127170000(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_payroll_kpis(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := COALESCE(p_company_id, public.current_company_id());
  PERFORM public.require_rpc_company_scope(v_company_id, 'عرض مؤشرات الرواتب');
  RETURN public.get_payroll_kpis_unscoped_20261127170000(v_company_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_payroll_kpis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payroll_kpis(uuid) TO authenticated, service_role;

ALTER FUNCTION public.get_workflow_kpis(uuid)
  RENAME TO get_workflow_kpis_unscoped_20261127170000;
REVOKE ALL ON FUNCTION public.get_workflow_kpis_unscoped_20261127170000(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_workflow_kpis(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := COALESCE(p_company_id, public.current_company_id());
  PERFORM public.require_rpc_company_scope(v_company_id, 'عرض مؤشرات سير العمل');
  RETURN public.get_workflow_kpis_unscoped_20261127170000(v_company_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_workflow_kpis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workflow_kpis(uuid) TO authenticated, service_role;

COMMIT;
