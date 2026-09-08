-- de-duplicate attendance before adding the constraint
DELETE FROM public.attendance_records a
USING public.attendance_records b
WHERE a.employee_id = b.employee_id
  AND a.work_date = b.work_date
  AND a.ctid > b.ctid;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_employee_date_key UNIQUE (employee_id, work_date);

-- Leave balances are annual records. These columns were present in the
-- generated database contract but were missing from the original bootstrap
-- table, so add them before the de-duplication below runs on a fresh install.
ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS balance numeric(7,2);

UPDATE public.leave_balances SET year = EXTRACT(YEAR FROM now())::int WHERE year IS NULL;
UPDATE public.leave_balances
SET balance = GREATEST(0, accrued_days + carried_over_days - used_days - reserved_days)
WHERE balance IS NULL;

ALTER TABLE public.leave_balances
  ALTER COLUMN year SET DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer;

-- The old two-column key prevented more than one annual balance per employee
-- and leave type. Keep the annual key as the source of truth instead.
ALTER TABLE public.leave_balances
  DROP CONSTRAINT IF EXISTS leave_balances_employee_id_leave_type_id_key;

DELETE FROM public.leave_balances a
USING public.leave_balances b
WHERE a.employee_id = b.employee_id
  AND a.leave_type_id = b.leave_type_id
  AND a.year = b.year
  AND a.ctid > b.ctid;

ALTER TABLE public.leave_balances
  ADD CONSTRAINT leave_balances_employee_type_year_key UNIQUE (employee_id, leave_type_id, year);

CREATE INDEX IF NOT EXISTS punches_employee_time_idx ON public.punches (employee_id, punch_time);
CREATE INDEX IF NOT EXISTS approval_steps_request_order_idx ON public.approval_steps (request_id, step_order);
CREATE INDEX IF NOT EXISTS payroll_details_run_idx ON public.payroll_details (payroll_run_id);
