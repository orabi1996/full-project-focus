CREATE OR REPLACE FUNCTION public.record_self_punch(
  p_punch_type text,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy double precision DEFAULT NULL,
  p_client_event_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_emp uuid; v_loc uuid; v_lat double precision; v_lng double precision; v_radius int;
  v_valid boolean := NULL; v_id uuid; v_type text; v_date date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  v_time time := (now() AT TIME ZONE 'Asia/Riyadh')::time;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501'; END IF;
  v_type := CASE WHEN p_punch_type = 'out' THEN 'out' ELSE 'in' END;
  SELECT id, COALESCE(work_location_id, location_id) INTO v_emp, v_loc FROM employees WHERE user_id = auth.uid() LIMIT 1;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'لا يوجد ملف موظف مرتبط بحسابك' USING ERRCODE = 'P0002'; END IF;
  IF v_loc IS NOT NULL THEN
    SELECT latitude, longitude, radius_meters INTO v_lat, v_lng, v_radius FROM work_locations WHERE id = v_loc;
    IF v_lat IS NOT NULL AND p_latitude IS NOT NULL THEN
      v_valid := (6371000 * 2 * asin(sqrt(power(sin(radians(p_latitude - v_lat)/2),2) + cos(radians(v_lat))*cos(radians(p_latitude))*power(sin(radians(p_longitude - v_lng)/2),2)))) <= COALESCE(v_radius, 200);
    END IF;
  END IF;
  INSERT INTO punches (employee_id, punch_time, punch_type, source, latitude, longitude, geofence_valid, work_location_id, approval_status)
  VALUES (v_emp, now(), v_type, 'self', p_latitude, p_longitude, v_valid, v_loc, CASE WHEN v_valid IS FALSE THEN 'pending' ELSE 'approved' END)
  RETURNING id INTO v_id;
  IF v_type = 'in' THEN
    INSERT INTO attendance_records (employee_id, work_date, check_in, status)
    SELECT v_emp, v_date, v_time, 'present'
    WHERE NOT EXISTS (SELECT 1 FROM attendance_records WHERE employee_id = v_emp AND work_date = v_date);
  ELSE
    UPDATE attendance_records SET check_out = v_time,
      worked_hours = round((EXTRACT(EPOCH FROM (v_time - check_in))/3600)::numeric, 2)
    WHERE employee_id = v_emp AND work_date = v_date AND check_in IS NOT NULL;
    IF NOT FOUND THEN
      INSERT INTO attendance_records (employee_id, work_date, check_out, status)
      SELECT v_emp, v_date, v_time, 'present'
      WHERE NOT EXISTS (SELECT 1 FROM attendance_records WHERE employee_id = v_emp AND work_date = v_date);
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'punch_id', v_id, 'geofence_valid', COALESCE(v_valid, true));
END $$;
REVOKE ALL ON FUNCTION public.record_self_punch(text, double precision, double precision, double precision, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_self_punch(text, double precision, double precision, double precision, text) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';