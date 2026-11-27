-- Serialize every call path that rebuilds one employee's attendance day.
-- Biometric, mobile, HR and company-range handlers all converge on this RPC.
BEGIN;

ALTER FUNCTION public.process_attendance_day(uuid, date)
  RENAME TO process_attendance_day_unlocked_20261127180000;

REVOKE ALL ON FUNCTION public.process_attendance_day_unlocked_20261127180000(uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.process_attendance_day(
  p_employee_id uuid,
  p_business_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_employee_id IS NULL OR p_business_date IS NULL THEN
    RAISE EXCEPTION 'Employee and business date are required.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_employee_id::text || ':' || p_business_date::text, 0)
  );

  RETURN public.process_attendance_day_unlocked_20261127180000(
    p_employee_id,
    p_business_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_attendance_day(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_attendance_day(uuid, date) TO authenticated, service_role;

COMMIT;
