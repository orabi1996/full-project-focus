ALTER TABLE public.punches
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

ALTER TABLE public.punches
  DROP CONSTRAINT IF EXISTS punches_approval_status_check;

ALTER TABLE public.punches
  ADD CONSTRAINT punches_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS punches_employee_time_idx
  ON public.punches (employee_id, punch_time DESC);