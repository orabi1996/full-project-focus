-- Close NULL-current-company tenant bypasses without copying the business RPC bodies.
-- The existing implementations are kept private under versioned names; public RPCs
-- become thin scope-checking wrappers that then call the unchanged implementation.
BEGIN;

CREATE OR REPLACE FUNCTION public.require_rpc_company_scope(p_company_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد المنشأة المستهدفة للعملية: %', p_action USING ERRCODE = '42501';
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN;
  END IF;

  IF NOT public.can_access_core_company(p_company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بالوصول إلى المنشأة المستهدفة للعملية: %', p_action USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_rpc_company_scope(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_rpc_company_scope(uuid, text) TO authenticated, service_role;

ALTER FUNCTION public.calculate_payroll_run_atomic(uuid)
  RENAME TO calculate_payroll_run_atomic_unscoped_20261127130000;
REVOKE ALL ON FUNCTION public.calculate_payroll_run_atomic_unscoped_20261127130000(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.calculate_payroll_run_atomic(p_payroll_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id FROM public.payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'مسيّر الرواتب غير موجود'; END IF;
  PERFORM public.require_rpc_company_scope(v_company_id, 'احتساب مسيّر الرواتب');
  RETURN public.calculate_payroll_run_atomic_unscoped_20261127130000(p_payroll_run_id);
END;
$$;

ALTER FUNCTION public.approve_payroll_run_atomic(uuid, text)
  RENAME TO approve_payroll_run_atomic_unscoped_20261127130000;
REVOKE ALL ON FUNCTION public.approve_payroll_run_atomic_unscoped_20261127130000(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.approve_payroll_run_atomic(p_payroll_run_id uuid, p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id FROM public.payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'مسيّر الرواتب غير موجود'; END IF;
  PERFORM public.require_rpc_company_scope(v_company_id, 'اعتماد مسيّر الرواتب');
  RETURN public.approve_payroll_run_atomic_unscoped_20261127130000(p_payroll_run_id, p_note);
END;
$$;

ALTER FUNCTION public.validate_payroll_wps_export(uuid)
  RENAME TO validate_payroll_wps_export_unscoped_20261127130000;
REVOKE ALL ON FUNCTION public.validate_payroll_wps_export_unscoped_20261127130000(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.validate_payroll_wps_export(p_payroll_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id FROM public.payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'مسيّر الرواتب غير موجود'; END IF;
  PERFORM public.require_rpc_company_scope(v_company_id, 'التحقق من ملف حماية الأجور');
  RETURN public.validate_payroll_wps_export_unscoped_20261127130000(p_payroll_run_id);
END;
$$;

ALTER FUNCTION public.calculate_final_settlement_atomic(uuid, date, text, integer)
  RENAME TO calculate_final_settlement_atomic_unscoped_20261127130000;
REVOKE ALL ON FUNCTION public.calculate_final_settlement_atomic_unscoped_20261127130000(uuid, date, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.calculate_final_settlement_atomic(
  p_employee_id uuid,
  p_termination_date date,
  p_separation_type text DEFAULT 'contract_expiration',
  p_unpaid_leave_days integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الموظف غير موجود بالنظام'; END IF;
  PERFORM public.require_rpc_company_scope(v_company_id, 'احتساب مخالصة نهاية الخدمة');
  RETURN public.calculate_final_settlement_atomic_unscoped_20261127130000(
    p_employee_id, p_termination_date, p_separation_type, p_unpaid_leave_days
  );
END;
$$;

ALTER FUNCTION public.create_final_settlement_atomic(jsonb)
  RENAME TO create_final_settlement_atomic_unscoped_20261127130000;
REVOKE ALL ON FUNCTION public.create_final_settlement_atomic_unscoped_20261127130000(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.create_final_settlement_atomic(p_params jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_employee_id uuid := (p_params->>'employee_id')::uuid;
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id FROM public.employees WHERE id = v_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الموظف المحدد غير موجود'; END IF;
  PERFORM public.require_rpc_company_scope(v_company_id, 'إنشاء تسوية نهاية الخدمة');
  RETURN public.create_final_settlement_atomic_unscoped_20261127130000(p_params);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_payroll_run_atomic(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_payroll_run_atomic(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_payroll_wps_export(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_final_settlement_atomic(uuid, date, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_final_settlement_atomic(jsonb) TO authenticated, service_role;

COMMIT;
