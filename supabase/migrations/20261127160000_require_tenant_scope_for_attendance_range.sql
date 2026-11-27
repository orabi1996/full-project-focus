-- Require a verified tenant before delegating to the legacy batch processor.
-- The legacy function allowed an HR role without an employee-company row to
-- choose any p_company_id because its mismatch check only ran when the row
-- existed. Keep its signature and processing behavior behind this guard.
BEGIN;

ALTER FUNCTION public.process_company_attendance_range(date, date, uuid)
  RENAME TO process_company_attendance_range_unscoped;

REVOKE ALL ON FUNCTION public.process_company_attendance_range_unscoped(date, date, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.process_company_attendance_range(
  p_from_date date,
  p_to_date date,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_company_id uuid;
BEGIN
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_to_date < p_from_date THEN
    RAISE EXCEPTION 'A valid attendance date range is required.' USING ERRCODE = '22023';
  END IF;

  IF auth.role() = 'service_role' THEN
    -- A trusted service caller may not infer or fan out across tenants.
    IF p_company_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.companies c WHERE c.id = p_company_id
    ) THEN
      RAISE EXCEPTION 'An explicit valid company scope is required.' USING ERRCODE = '22023';
    END IF;
    v_target_company_id := p_company_id;
  ELSE
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
    END IF;

    v_target_company_id := COALESCE(p_company_id, public.current_company_id());
    IF v_target_company_id IS NULL
       OR NOT public.can_access_core_company(v_target_company_id) THEN
      RAISE EXCEPTION 'Active membership in the requested company is required.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- The original function retains its role check and batch processing. Passing
  -- the resolved company explicitly prevents its fallback from widening scope.
  RETURN public.process_company_attendance_range_unscoped(
    p_from_date,
    p_to_date,
    v_target_company_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_company_attendance_range(date, date, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_company_attendance_range(date, date, uuid)
  TO authenticated, service_role;

COMMIT;
