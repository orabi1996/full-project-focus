-- ============================================================================
-- HRMS Enterprise Solution - Complete Logical Database Schema (M01 - M20)
-- ============================================================================

-- 1. Companies & Subsidiaries (M02)
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name_ar text NOT NULL,
  legal_name_en text NOT NULL,
  cr_number text,
  tax_number text,
  currency text NOT NULL DEFAULT 'SAR',
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  headquarters_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subsidiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  code text NOT NULL UNIQUE,
  cr_number text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  latitude double precision,
  longitude double precision,
  radius_meters integer NOT NULL DEFAULT 150,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Shifts & Attendance (M07, M08, M09)
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  color text DEFAULT '#10b981',
  type text NOT NULL DEFAULT 'fixed', -- fixed, flexible, split
  start_time time NOT NULL,
  end_time time NOT NULL,
  grace_minutes_arrival integer DEFAULT 15,
  grace_minutes_departure integer DEFAULT 15,
  overtime_eligible boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  work_date date NOT NULL,
  is_rest_day boolean DEFAULT false,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS public.punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  punch_time timestamptz NOT NULL,
  punch_type text NOT NULL DEFAULT 'in', -- in, out
  source text NOT NULL DEFAULT 'mobile_gps', -- mobile_gps, biometric_device, manual_admin
  latitude double precision,
  longitude double precision,
  geofence_valid boolean DEFAULT true,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Leaves & Balances (M06)
CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  color text DEFAULT '#0284c7',
  is_paid boolean DEFAULT true,
  deduct_working_days_only boolean DEFAULT true,
  max_days_per_year integer DEFAULT 30,
  allow_half_day boolean DEFAULT true,
  accrual_method text DEFAULT 'yearly_frontloaded',
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid REFERENCES public.leave_types(id) ON DELETE CASCADE,
  annual_entitlement numeric(5,2) NOT NULL DEFAULT 30,
  accrued_days numeric(5,2) NOT NULL DEFAULT 0,
  used_days numeric(5,2) NOT NULL DEFAULT 0,
  reserved_days numeric(5,2) NOT NULL DEFAULT 0,
  carried_over_days numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id)
);

-- 4. Payroll & Loans (M10, M11)
CREATE TABLE IF NOT EXISTS public.payroll_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  calculation_basis text NOT NULL DEFAULT 'fixed_30_days', -- fixed_30_days, calendar_days
  cutoff_day integer NOT NULL DEFAULT 25,
  payday integer NOT NULL DEFAULT 28,
  currency text NOT NULL DEFAULT 'SAR',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_group_id uuid REFERENCES public.payroll_groups(id) ON DELETE SET NULL,
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, calculating, ready_for_review, confirmed_locked, paid
  total_employees integer NOT NULL DEFAULT 0,
  total_basic_salary numeric(14,2) NOT NULL DEFAULT 0,
  total_allowances numeric(14,2) NOT NULL DEFAULT 0,
  total_overtime_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_net_salary numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_gosi numeric(14,2) NOT NULL DEFAULT 0,
  locked_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_group_id, period_year, period_month)
);

CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  loan_type text NOT NULL DEFAULT 'personal_advance',
  principal_amount numeric(12,2) NOT NULL,
  monthly_installment numeric(12,2) NOT NULL,
  total_installments integer NOT NULL,
  paid_installments integer NOT NULL DEFAULT 0,
  remaining_balance numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  termination_date date NOT NULL,
  service_years integer NOT NULL DEFAULT 0,
  service_months integer NOT NULL DEFAULT 0,
  eosb_amount numeric(12,2) NOT NULL DEFAULT 0,
  leave_payout_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_settlement_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Expense Management (M12)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  max_limit_warning numeric(12,2) NOT NULL DEFAULT 1000,
  max_limit_block numeric(12,2) NOT NULL DEFAULT 5000,
  requires_receipt boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  spent_at date NOT NULL,
  merchant_name text NOT NULL,
  receipt_url text,
  description text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. ATS & Recruitment (M15)
CREATE TABLE IF NOT EXISTS public.job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  openings_count integer NOT NULL DEFAULT 1,
  filled_count integer NOT NULL DEFAULT 0,
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  description_ar text,
  published_status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.job_openings(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  stage text NOT NULL DEFAULT 'applied', -- applied, screening, interview, assessment, job_offer, hired, rejected
  rating_score numeric(3,2) DEFAULT 5.0,
  source text DEFAULT 'website',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Hardware Assets & Company Documents (M16)
CREATE TABLE IF NOT EXISTS public.hardware_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  category text NOT NULL,
  serial_number text NOT NULL,
  assigned_to_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  category text NOT NULL,
  version text NOT NULL DEFAULT 'v1.0',
  file_url text NOT NULL,
  acknowledged_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Audit Events & Notifications (M19)
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  changes_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  message_ar text NOT NULL,
  message_en text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for all created tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subsidiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_inbox ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated users
CREATE POLICY "companies_read" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "subsidiaries_read" ON public.subsidiaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "locations_read" ON public.work_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "shifts_read" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedule_read" ON public.schedule_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "punches_read" ON public.punches FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_types_read" ON public.leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_balances_read" ON public.leave_balances FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_groups_read" ON public.payroll_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_runs_read" ON public.payroll_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "loans_read" ON public.loans FOR SELECT TO authenticated USING (true);
CREATE POLICY "settlements_read" ON public.settlements FOR SELECT TO authenticated USING (true);
CREATE POLICY "expense_categories_read" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "expense_claims_read" ON public.expense_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "jobs_read" ON public.job_openings FOR SELECT TO authenticated USING (true);
CREATE POLICY "candidates_read" ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets_read" ON public.hardware_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "company_docs_read" ON public.company_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_read" ON public.audit_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "notifications_read" ON public.notifications_inbox FOR SELECT TO authenticated USING (true);