-- ============================================================================
-- Annual leave integrity
-- - Keep one balance per employee, leave type and calendar year.
-- - Reserve/settle days under a row lock so concurrent requests cannot
--   overspend a balance.
-- - Persist the leave type on the request so approval can settle the same
--   reservation that was created at submission time.
-- ============================================================================

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS leave_type_id uuid REFERENCES public.leave_types(id) ON DELETE SET NULL;

ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS balance numeric(7,2);

UPDATE public.leave_balances
SET year = COALESCE(year, EXTRACT(YEAR FROM CURRENT_DATE)::integer),
    balance = COALESCE(
      balance,
      GREATEST(0, accrued_days + carried_over_days - used_days - reserved_days)
    );

ALTER TABLE public.leave_balances
  ALTER COLUMN year SET DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer;

ALTER TABLE public.leave_balances
  DROP CONSTRAINT IF EXISTS leave_balances_employee_id_leave_type_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leave_balances_employee_type_year_key'
      AND conrelid = 'public.leave_balances'::regclass
  ) THEN
    ALTER TABLE public.leave_balances
      ADD CONSTRAINT leave_balances_employee_type_year_key
      UNIQUE (employee_id, leave_type_id, year);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS leave_balances_employee_year_idx
  ON public.leave_balances (employee_id, year);

CREATE INDEX IF NOT EXISTS requests_open_leave_lookup_idx
  ON public.requests (employee_id, leave_type_id, start_date, end_date)
  WHERE type = 'leave' AND status = 'pending' AND leave_type_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_leave_balance_atomic(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_year integer,
  p_days numeric
)
RETURNS TABLE (
  balance_id uuid,
  employee_id uuid,
  leave_type_id uuid,
  year integer,
  reserved_days numeric,
  used_days numeric,
  available_days numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private_sec
AS $$
DECLARE
  v_balance public.leave_balances%ROWTYPE;
  v_year integer := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
  v_days numeric := round(COALESCE(p_days, 0), 2);
  v_available numeric;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لحجز رصيد الإجازة';
  END IF;
  IF p_employee_id IS NULL OR p_leave_type_id IS NULL THEN
    RAISE EXCEPTION 'بيانات رصيد الإجازة ناقصة';
  END IF;
  IF v_year NOT BETWEEN 2000 AND 2200 THEN
    RAISE EXCEPTION 'سنة الإجازة غير صالحة';
  END IF;
  IF v_days <= 0 OR v_days > 366 THEN
    RAISE EXCEPTION 'عدد أيام الإجازة غير صالح';
  END IF;
  IF auth.role() <> 'service_role'
     AND p_employee_id IS DISTINCT FROM private_sec.current_employee_id()
     AND NOT public.current_user_has_any_role(
       ARRAY['org_admin','super_admin','hr_manager']
     ) THEN
    RAISE EXCEPTION 'غير مصرح بحجز رصيد موظف آخر';
  END IF;

  SELECT *
  INTO v_balance
  FROM public.leave_balances
  WHERE employee_id = p_employee_id
    AND leave_type_id = p_leave_type_id
    AND year = v_year
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا يوجد رصيد إجازات مسجّل لهذه السنة';
  END IF;

  v_available := round(
    GREATEST(
      0,
      COALESCE(v_balance.accrued_days, 0)
        + COALESCE(v_balance.carried_over_days, 0)
        - COALESCE(v_balance.used_days, 0)
        - COALESCE(v_balance.reserved_days, 0)
    ),
    2
  );

  IF v_available < v_days THEN
    RAISE EXCEPTION 'رصيد الإجازة غير كافٍ (المتاح: %)', v_available;
  END IF;

  UPDATE public.leave_balances
  SET reserved_days = round(COALESCE(reserved_days, 0) + v_days, 2),
      balance = round(v_available - v_days, 2),
      updated_at = now()
  WHERE id = v_balance.id;

  RETURN QUERY
  SELECT v_balance.id,
         v_balance.employee_id,
         v_balance.leave_type_id,
         v_year,
         round(COALESCE(v_balance.reserved_days, 0) + v_days, 2),
         COALESCE(v_balance.used_days, 0),
         round(v_available - v_days, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_leave_reservation_atomic(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_year integer,
  p_days numeric,
  p_outcome text
)
RETURNS TABLE (
  balance_id uuid,
  employee_id uuid,
  leave_type_id uuid,
  year integer,
  reserved_days numeric,
  used_days numeric,
  available_days numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private_sec
AS $$
DECLARE
  v_balance public.leave_balances%ROWTYPE;
  v_year integer := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
  v_days numeric := round(COALESCE(p_days, 0), 2);
  v_reserved numeric;
  v_used numeric;
  v_available numeric;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لتسوية رصيد الإجازة';
  END IF;
  IF p_employee_id IS NULL OR p_leave_type_id IS NULL THEN
    RAISE EXCEPTION 'بيانات رصيد الإجازة ناقصة';
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('commit', 'release') THEN
    RAISE EXCEPTION 'نتيجة تسوية الإجازة غير صالحة';
  END IF;
  IF v_year NOT BETWEEN 2000 AND 2200 THEN
    RAISE EXCEPTION 'سنة الإجازة غير صالحة';
  END IF;
  IF v_days <= 0 OR v_days > 366 THEN
    RAISE EXCEPTION 'عدد أيام الإجازة غير صالح';
  END IF;
  IF auth.role() <> 'service_role'
     AND NOT public.current_user_has_any_role(
       ARRAY['org_admin','super_admin','hr_manager','line_manager']
     ) THEN
    RAISE EXCEPTION 'غير مصرح بتسوية رصيد الإجازة';
  END IF;

  SELECT *
  INTO v_balance
  FROM public.leave_balances
  WHERE employee_id = p_employee_id
    AND leave_type_id = p_leave_type_id
    AND year = v_year
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا يوجد رصيد إجازات مسجّل لهذه السنة';
  END IF;

  v_reserved := round(COALESCE(v_balance.reserved_days, 0), 2);
  IF v_reserved < v_days THEN
    RAISE EXCEPTION 'الأيام المحجوزة أقل من الأيام المطلوب تسويتها';
  END IF;

  v_reserved := round(v_reserved - v_days, 2);
  v_used := round(
    COALESCE(v_balance.used_days, 0)
      + CASE WHEN p_outcome = 'commit' THEN v_days ELSE 0 END,
    2
  );
  v_available := round(
    GREATEST(
      0,
      COALESCE(v_balance.accrued_days, 0)
        + COALESCE(v_balance.carried_over_days, 0)
        - v_used
        - v_reserved
    ),
    2
  );

  UPDATE public.leave_balances
  SET reserved_days = v_reserved,
      used_days = v_used,
      balance = v_available,
      updated_at = now()
  WHERE id = v_balance.id;

  RETURN QUERY
  SELECT v_balance.id,
         v_balance.employee_id,
         v_balance.leave_type_id,
         v_year,
         v_reserved,
         v_used,
         v_available;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_leave_balance_atomic(uuid, uuid, integer, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_leave_reservation_atomic(uuid, uuid, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_leave_balance_atomic(uuid, uuid, integer, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_leave_reservation_atomic(uuid, uuid, integer, numeric, text) TO authenticated, service_role;
