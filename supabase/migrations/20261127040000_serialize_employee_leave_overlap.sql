BEGIN;

-- Serialize leave-request overlap checks by employee, including requests for
-- different leave types that do not contend on the same balance row.
CREATE OR REPLACE FUNCTION public.guard_employee_leave_request_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.type <> 'leave'
     OR NEW.employee_id IS NULL
     OR NEW.start_date IS NULL
     OR NEW.end_date IS NULL
     OR NEW.status NOT IN ('pending', 'pending_approval', 'approved') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.employee_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.requests r
    WHERE r.employee_id = NEW.employee_id
      AND r.type = 'leave'
      AND r.status IN ('pending', 'pending_approval', 'approved')
      AND r.start_date <= NEW.end_date
      AND r.end_date >= NEW.start_date
      AND (TG_OP = 'INSERT' OR r.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'يوجد طلب إجازة نشط أو معتمد يتداخل مع الفترة المحددة.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_employee_leave_request_overlap ON public.requests;
CREATE TRIGGER trg_guard_employee_leave_request_overlap
BEFORE INSERT OR UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.guard_employee_leave_request_overlap();

COMMIT;
