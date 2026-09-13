-- Migration: 20260914000000_delegation_rules_and_decisions.sql
-- Description: Add delegation_rules, overtime_records, and support columns for attendance corrections

-- 1. Create delegation_rules table
CREATE TABLE IF NOT EXISTS public.delegation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  delegate_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT 'all_requests',
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE public.delegation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delegation_rules_read_authenticated" ON public.delegation_rules;
CREATE POLICY "delegation_rules_read_authenticated"
  ON public.delegation_rules FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "delegation_rules_write_authenticated" ON public.delegation_rules;
CREATE POLICY "delegation_rules_write_authenticated"
  ON public.delegation_rules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.delegation_rules TO authenticated;
GRANT ALL ON public.delegation_rules TO service_role;

-- 2. Create overtime_records table
CREATE TABLE IF NOT EXISTS public.overtime_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  start_time time NOT NULL DEFAULT '17:00:00',
  end_time time NOT NULL DEFAULT '20:00:00',
  hours numeric(5,2) NOT NULL DEFAULT 0,
  rate_multiplier numeric(4,2) NOT NULL DEFAULT 1.5,
  rate_type text NOT NULL DEFAULT 'regular_150',
  reason text NOT NULL DEFAULT '',
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.overtime_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "overtime_records_read_authenticated" ON public.overtime_records;
CREATE POLICY "overtime_records_read_authenticated"
  ON public.overtime_records FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "overtime_records_write_authenticated" ON public.overtime_records;
CREATE POLICY "overtime_records_write_authenticated"
  ON public.overtime_records FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.overtime_records TO authenticated;
GRANT ALL ON public.overtime_records TO service_role;

-- 3. Add overtime_hours to attendance_records
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS overtime_hours numeric(5,2) NOT NULL DEFAULT 0;

-- 4. Add payload to requests
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb;
