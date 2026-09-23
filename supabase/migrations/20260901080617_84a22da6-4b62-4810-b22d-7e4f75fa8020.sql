-- de-duplicate attendance before adding the constraint
DELETE FROM public.attendance_records a
USING public.attendance_records b
WHERE a.employee_id = b.employee_id
  AND a.work_date = b.work_date
  AND a.ctid > b.ctid;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_employee_date_key UNIQUE (employee_id, work_date);

ALTER TABLE public.leave_balances ADD COLUMN IF NOT EXISTS year integer DEFAULT EXTRACT(YEAR FROM now())::int;

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
CREATE TABLE IF NOT EXISTS public.approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approver_role text,
  approver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acted_at timestamptz,
  acted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.approval_steps TO authenticated;
GRANT ALL ON public.approval_steps TO service_role;

CREATE INDEX IF NOT EXISTS approval_steps_request_order_idx ON public.approval_steps (request_id, step_order);
CREATE INDEX IF NOT EXISTS payroll_details_run_idx ON public.payroll_details (payroll_run_id);