-- de-duplicate attendance before adding the constraint
DELETE FROM public.attendance_records a
USING public.attendance_records b
WHERE a.employee_id = b.employee_id
  AND a.work_date = b.work_date
  AND a.ctid > b.ctid;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_employee_date_key UNIQUE (employee_id, work_date);

UPDATE public.leave_balances SET year = EXTRACT(YEAR FROM now())::int WHERE year IS NULL;

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