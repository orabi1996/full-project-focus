DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('org_admin', 'hr_manager', 'line_manager', 'employee');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'employee_status'
  ) THEN
    CREATE TYPE public.employee_status AS ENUM ('active', 'on_leave', 'suspended', 'terminated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'attendance_status'
  ) THEN
    CREATE TYPE public.attendance_status AS ENUM ('present', 'late', 'absent', 'leave', 'remote');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'request_type'
  ) THEN
    CREATE TYPE public.request_type AS ENUM ('leave', 'attendance_fix', 'advance', 'expense');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'request_status'
  ) THEN
    CREATE TYPE public.request_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'returned');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no text NOT NULL UNIQUE,
  full_name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  job_title text NOT NULL DEFAULT '',
  email text,
  phone text,
  hire_date date NOT NULL DEFAULT current_date,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  status public.employee_status NOT NULL DEFAULT 'active',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  check_in time,
  check_out time,
  status public.attendance_status NOT NULL DEFAULT 'present',
  worked_hours numeric(5,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('REQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type public.request_type NOT NULL,
  status public.request_status NOT NULL DEFAULT 'pending',
  start_date date,
  end_date date,
  days integer,
  amount numeric(12,2),
  reason text,
  decision_note text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
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

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subsidiary_id uuid REFERENCES public.subsidiaries(id) ON DELETE SET NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS position_title text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS payroll_group_id uuid REFERENCES public.payroll_groups(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS late_minutes integer DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS worked_minutes integer DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS overtime_minutes integer DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;
ALTER TABLE public.punches ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS approved_amount numeric(12,2);
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS total_paid numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS outstanding_amount numeric(12,2);
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS installments_total integer;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS installments_paid integer NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS installment_amount numeric(12,2);
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS decision_note text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS requested_at timestamptz;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS claim_no text;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS report_no text;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS policy_category_id uuid;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS merchant text;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS expense_date date;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS receipt_attached boolean DEFAULT false;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS decision_note text;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE public.job_openings ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.job_openings ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL;
ALTER TABLE public.job_openings ADD COLUMN IF NOT EXISTS employment_type text;
ALTER TABLE public.job_openings ADD COLUMN IF NOT EXISTS headcount integer DEFAULT 1;
ALTER TABLE public.job_openings ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.job_openings ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS full_name_ar text;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS rating integer;
ALTER TABLE public.hardware_assets ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.hardware_assets ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS requires_ack boolean DEFAULT false;
ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS body_ar text;
ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS action_type text;
ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS severity text;
ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS body_ar text;
ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS body_en text;
ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS link_path text;
ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS max_days integer;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS requires_attachment boolean DEFAULT false;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE public.leave_balances ADD COLUMN IF NOT EXISTS balance numeric(6,2);
ALTER TABLE public.leave_balances ADD COLUMN IF NOT EXISTS year integer;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_hr(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('org_admin', 'hr_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee') ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.employees (user_id, employee_no, full_name, email, job_title, hire_date, status)
  SELECT NEW.id,
         'USR-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8)),
         COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(NEW.email, '@', 1)),
         NEW.email, '', current_date, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.employees WHERE user_id = NEW.id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, full_name, email)
SELECT id, COALESCE(raw_user_meta_data ->> 'full_name', ''), email
FROM auth.users
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'employee'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.employees (user_id, employee_no, full_name, email, job_title, hire_date, status)
SELECT u.id,
       'USR-' || upper(substr(replace(u.id::text, '-', ''), 1, 8)),
       COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
       u.email, '', current_date, 'active'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.user_id = u.id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.user_roles, public.departments,
  public.employees, public.attendance_records, public.requests, public.schedule_assignments,
  public.leave_balances TO authenticated;
GRANT ALL ON public.profiles, public.user_roles, public.departments, public.employees,
  public.attendance_records, public.requests, public.schedule_assignments, public.leave_balances TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "roles_read" ON public.user_roles;
CREATE POLICY "roles_read" ON public.user_roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dept_read" ON public.departments;
CREATE POLICY "dept_read" ON public.departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dept_write" ON public.departments;
CREATE POLICY "dept_write" ON public.departments FOR ALL TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
DROP POLICY IF EXISTS "emp_read" ON public.employees;
CREATE POLICY "emp_read" ON public.employees FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "emp_write" ON public.employees;
CREATE POLICY "emp_write" ON public.employees FOR ALL TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
DROP POLICY IF EXISTS "att_read" ON public.attendance_records;
CREATE POLICY "att_read" ON public.attendance_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "att_write" ON public.attendance_records;
CREATE POLICY "att_write" ON public.attendance_records FOR ALL TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
DROP POLICY IF EXISTS "req_read" ON public.requests;
CREATE POLICY "req_read" ON public.requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "req_insert" ON public.requests;
CREATE POLICY "req_insert" ON public.requests FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "req_update" ON public.requests;
CREATE POLICY "req_update" ON public.requests FOR UPDATE TO authenticated
  USING (public.is_hr(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_hr(auth.uid()) OR created_by = auth.uid());
DROP POLICY IF EXISTS "req_delete" ON public.requests;
CREATE POLICY "req_delete" ON public.requests FOR DELETE TO authenticated USING (public.is_hr(auth.uid()));