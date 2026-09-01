-- ============================================================================
-- HRMS complete business schema
-- Adds the operational records required by the 20 product modules while
-- preserving the tables already created by earlier Lovable migrations.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_has_any_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text = ANY(allowed_roles)
  )
$$;
REVOKE ALL ON FUNCTION public.current_user_has_any_role(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_any_role(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_is_hr()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('org_admin', 'super_admin', 'hr_manager')
  )
$$;

-- Expand core employee and organization master records.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'ar';

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS unit_type text NOT NULL DEFAULT 'department',
  ADD COLUMN IF NOT EXISTS manager_employee_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subsidiary_id uuid REFERENCES public.subsidiaries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_name_ar text,
  ADD COLUMN IF NOT EXISTS last_name_ar text,
  ADD COLUMN IF NOT EXISTS first_name_en text,
  ADD COLUMN IF NOT EXISTS last_name_en text,
  ADD COLUMN IF NOT EXISTS personal_email text,
  ADD COLUMN IF NOT EXISTS national_id_or_iqama text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS probation_end_date date,
  ADD COLUMN IF NOT EXISTS total_salary numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS current_step_index integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_steps integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS current_approver_role text;

ALTER TABLE public.subsidiaries
  ADD COLUMN IF NOT EXISTS manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.work_locations
  ADD COLUMN IF NOT EXISTS default_shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS flexible_hours numeric(5,2),
  ADD COLUMN IF NOT EXISTS split_second_start_time time,
  ADD COLUMN IF NOT EXISTS split_second_end_time time,
  ADD COLUMN IF NOT EXISTS allow_single_punch boolean NOT NULL DEFAULT false;

ALTER TABLE public.job_openings
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS requirements_ar text,
  ADD COLUMN IF NOT EXISTS requirements_en text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS cv_url text,
  ADD COLUMN IF NOT EXISTS notes_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.hardware_assets
  ADD COLUMN IF NOT EXISTS assigned_date date;

ALTER TABLE public.company_documents
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS visibility_scope text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS requires_acknowledgment boolean NOT NULL DEFAULT false;

ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_manager_employee_id_fkey;
ALTER TABLE public.departments
  ADD CONSTRAINT departments_manager_employee_id_fkey
  FOREIGN KEY (manager_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  title_ar text NOT NULL,
  title_en text,
  document_number text,
  issue_date date,
  expiry_date date,
  file_url text NOT NULL,
  status text NOT NULL DEFAULT 'valid',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salary_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date,
  basic_salary numeric(12,2) NOT NULL,
  housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
  transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
  other_allowances jsonb NOT NULL DEFAULT '[]'::jsonb,
  bank_name text,
  iban text,
  payroll_group_id uuid REFERENCES public.payroll_groups(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Configurable permission matrix.
CREATE TABLE IF NOT EXISTS public.role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  data_scope text NOT NULL DEFAULT 'self',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_definition_id uuid NOT NULL REFERENCES public.role_definitions(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_definition_id)
);

INSERT INTO public.role_definitions (
  code, name_ar, name_en, description_ar, description_en, is_system, data_scope
)
VALUES
  ('super_admin', 'مدير النظام', 'Super Admin', 'إدارة كاملة لجميع وحدات النظام', 'Full platform administration', true, 'all'),
  ('org_admin', 'مدير المنشأة', 'Organization Admin', 'إدارة إعدادات وبيانات المنشأة', 'Organization administration', true, 'all'),
  ('hr_manager', 'مدير الموارد البشرية', 'HR Manager', 'إدارة الموظفين والعمليات والاعتمادات', 'HR operations and approvals', true, 'all'),
  ('line_manager', 'مدير مباشر', 'Line Manager', 'إدارة الفريق والاعتمادات المباشرة', 'Team management and approvals', true, 'team'),
  ('payroll_officer', 'مسؤول الرواتب', 'Payroll Officer', 'احتساب واعتماد مسيرات الرواتب', 'Payroll processing', true, 'all'),
  ('attendance_officer', 'مسؤول الحضور', 'Attendance Officer', 'إدارة الحضور والورديات', 'Attendance operations', true, 'all'),
  ('recruiter', 'مسؤول التوظيف', 'Recruiter', 'إدارة الشواغر والمرشحين', 'Recruitment operations', true, 'all'),
  ('finance_officer', 'مسؤول المالية', 'Finance Officer', 'إدارة المصروفات والقيود', 'Finance operations', true, 'all'),
  ('performance_lead', 'مسؤول الأداء', 'Performance Lead', 'إدارة دورات وتقييمات الأداء', 'Performance management', true, 'all'),
  ('auditor', 'مدقق', 'Auditor', 'قراءة التقارير وسجل التدقيق', 'Read-only audit access', true, 'all'),
  ('employee', 'موظف', 'Employee', 'الخدمة الذاتية وبيانات الموظف', 'Employee self service', true, 'self')
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  is_system = EXCLUDED.is_system,
  data_scope = EXCLUDED.data_scope;

CREATE TABLE IF NOT EXISTS public.app_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_code text NOT NULL UNIQUE,
  module_code text NOT NULL,
  action_code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.app_permissions(id) ON DELETE CASCADE,
  data_scope text NOT NULL DEFAULT 'self',
  UNIQUE(role, permission_id)
);

CREATE TABLE IF NOT EXISTS public.approval_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  scope_type text NOT NULL DEFAULT 'all_employees',
  scope_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.request_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  step_number integer NOT NULL DEFAULT 1,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_paid boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  name text NOT NULL,
  provider text NOT NULL,
  serial_number text NOT NULL UNIQUE,
  connection_type text NOT NULL DEFAULT 'cloud_api',
  last_sync_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_profile_id uuid REFERENCES public.salary_profiles(id) ON DELETE SET NULL,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
  transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
  other_allowances numeric(12,2) NOT NULL DEFAULT 0,
  overtime_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_amount numeric(12,2) NOT NULL DEFAULT 0,
  bonus_amount numeric(12,2) NOT NULL DEFAULT 0,
  unpaid_leave_deduction numeric(12,2) NOT NULL DEFAULT 0,
  absence_late_deduction numeric(12,2) NOT NULL DEFAULT 0,
  loan_deduction numeric(12,2) NOT NULL DEFAULT 0,
  gosi_employee_deduction numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  UNIQUE(payroll_run_id, employee_id)
);

ALTER TABLE public.expense_claims
  ADD COLUMN IF NOT EXISTS report_id uuid,
  ADD COLUMN IF NOT EXISTS policy_warning_triggered boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.expense_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no text NOT NULL UNIQUE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_claims
  DROP CONSTRAINT IF EXISTS expense_claims_report_id_fkey;
ALTER TABLE public.expense_claims
  ADD CONSTRAINT expense_claims_report_id_fkey
  FOREIGN KEY (report_id) REFERENCES public.expense_reports(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.performance_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  period_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  participants_count integer NOT NULL DEFAULT 0,
  completion_rate numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evaluation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  evaluator_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  evaluation_type text NOT NULL,
  competency_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_score numeric(3,2),
  notes text,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz,
  UNIQUE(cycle_id, employee_id, evaluator_employee_id, evaluation_type)
);

CREATE TABLE IF NOT EXISTS public.workforce_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  plan_year integer NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  current_headcount integer NOT NULL DEFAULT 0,
  planned_hires integer NOT NULL DEFAULT 0,
  planned_exits integer NOT NULL DEFAULT 0,
  target_headcount integer NOT NULL DEFAULT 0,
  current_budget numeric(14,2) NOT NULL DEFAULT 0,
  projected_cost numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  basic_salary numeric(12,2) NOT NULL,
  housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
  transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
  proposed_start_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.hardware_assets(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  condition_on_assign text,
  condition_on_return text,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.document_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.company_documents(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.accounting_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_no text NOT NULL UNIQUE,
  source_type text NOT NULL,
  source_reference text NOT NULL,
  journal_date date NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_debit numeric(14,2) NOT NULL DEFAULT 0,
  total_credit numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  erp_integration_type text,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_debit = total_credit)
);

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  display_name text NOT NULL,
  config_encrypted jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'inactive',
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  target_url text NOT NULL,
  secret_hash text,
  status text NOT NULL DEFAULT 'active',
  last_delivery_at timestamptz,
  last_delivery_status integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for newly created business tables.
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_documents_owner_or_hr" ON public.employee_documents FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY "employee_documents_hr_write" ON public.employee_documents FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

CREATE POLICY "salary_owner_or_payroll_read" ON public.salary_profiles FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer','finance_officer','auditor']));
CREATE POLICY "salary_payroll_write" ON public.salary_profiles FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer']));

CREATE POLICY "role_definitions_authenticated_read" ON public.role_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_definitions_admin_write" ON public.role_definitions FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin']));
CREATE POLICY "role_assignments_self_or_admin_read" ON public.user_role_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_has_any_role(ARRAY['org_admin','super_admin']));
CREATE POLICY "role_assignments_admin_write" ON public.user_role_assignments FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin']));

DROP POLICY IF EXISTS "roles_admin_write" ON public.user_roles;
CREATE POLICY "roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin']));

CREATE POLICY "permissions_authenticated_read" ON public.app_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_authenticated_read" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_admin_write" ON public.app_permissions FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin']));
CREATE POLICY "role_permissions_admin_write" ON public.role_permissions FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin']));

CREATE POLICY "approval_chains_authenticated_read" ON public.approval_chains FOR SELECT TO authenticated USING (true);
CREATE POLICY "approval_chains_hr_write" ON public.approval_chains FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "requests_approver_read" ON public.requests FOR SELECT TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager'])
    OR (
      public.current_user_has_any_role(ARRAY['line_manager'])
      AND EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = requests.employee_id
          AND e.manager_id = public.current_employee_id()
      )
    )
  );
DROP POLICY IF EXISTS "requests_hr_update" ON public.requests;
CREATE POLICY "requests_approver_update" ON public.requests FOR UPDATE TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager'])
    OR (
      public.current_user_has_any_role(ARRAY['line_manager'])
      AND requests.current_step_index = 1
      AND EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = requests.employee_id
          AND e.manager_id = public.current_employee_id()
      )
    )
  )
  WITH CHECK (
    public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager'])
    OR (
      public.current_user_has_any_role(ARRAY['line_manager'])
      AND EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = requests.employee_id
          AND e.manager_id = public.current_employee_id()
      )
    )
  );
CREATE POLICY "request_timeline_participant_read" ON public.request_timeline FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id));
CREATE POLICY "request_timeline_actor_insert" ON public.request_timeline FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      (
        action = 'submitted'
        AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.created_by = auth.uid())
      )
      OR public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','line_manager'])
    )
  );

CREATE POLICY "holidays_authenticated_read" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_hr_write" ON public.holidays FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "attendance_devices_staff_read" ON public.attendance_devices FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','attendance_officer','auditor']));
CREATE POLICY "attendance_devices_staff_write" ON public.attendance_devices FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','attendance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','attendance_officer']));

DROP POLICY IF EXISTS "attendance_self_or_hr_read" ON public.attendance_records;
CREATE POLICY "attendance_scoped_read" ON public.attendance_records FOR SELECT TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','attendance_officer','auditor'])
    OR (
      public.current_user_has_any_role(ARRAY['line_manager'])
      AND EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = attendance_records.employee_id
          AND e.manager_id = public.current_employee_id()
      )
    )
  );

DROP POLICY IF EXISTS "attendance_hr_write" ON public.attendance_records;
CREATE POLICY "attendance_staff_write" ON public.attendance_records FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','attendance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','attendance_officer']));
DROP POLICY IF EXISTS "shifts_hr_write" ON public.shifts;
CREATE POLICY "shifts_staff_write" ON public.shifts FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','attendance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','attendance_officer']));
DROP POLICY IF EXISTS "schedule_hr_write" ON public.schedule_assignments;
CREATE POLICY "schedule_staff_write" ON public.schedule_assignments FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','attendance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','attendance_officer']));

CREATE POLICY "payroll_details_owner_or_staff_read" ON public.payroll_details FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer','finance_officer','auditor']));
CREATE POLICY "payroll_details_staff_write" ON public.payroll_details FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer']));

DROP POLICY IF EXISTS "payroll_groups_read" ON public.payroll_groups;
CREATE POLICY "payroll_groups_staff_read" ON public.payroll_groups FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer','finance_officer','auditor']));
DROP POLICY IF EXISTS "payroll_runs_read" ON public.payroll_runs;
CREATE POLICY "payroll_runs_staff_read" ON public.payroll_runs FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer','finance_officer','auditor']));
DROP POLICY IF EXISTS "payroll_groups_hr_write" ON public.payroll_groups;
CREATE POLICY "payroll_groups_staff_write" ON public.payroll_groups FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer']));
DROP POLICY IF EXISTS "payroll_runs_hr_write" ON public.payroll_runs;
CREATE POLICY "payroll_runs_staff_write" ON public.payroll_runs FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer']));

CREATE POLICY "expense_reports_owner_or_finance_read" ON public.expense_reports FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','finance_officer','auditor']));
CREATE POLICY "expense_reports_owner_insert" ON public.expense_reports FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());
CREATE POLICY "expense_reports_finance_write" ON public.expense_reports FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','finance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','finance_officer']));

CREATE POLICY "performance_cycles_authenticated_read" ON public.performance_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "performance_cycles_lead_write" ON public.performance_cycles FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','performance_lead']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','performance_lead']));
CREATE POLICY "evaluations_participant_read" ON public.evaluation_records FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR evaluator_employee_id = public.current_employee_id() OR public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','performance_lead','auditor']));
CREATE POLICY "evaluations_evaluator_write" ON public.evaluation_records FOR ALL TO authenticated
  USING (evaluator_employee_id = public.current_employee_id() OR public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','performance_lead']))
  WITH CHECK (evaluator_employee_id = public.current_employee_id() OR public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','performance_lead']));

CREATE POLICY "workforce_plans_staff_read" ON public.workforce_plans FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter','finance_officer','auditor']));
CREATE POLICY "workforce_plans_staff_write" ON public.workforce_plans FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter']));
CREATE POLICY "job_offers_staff_read" ON public.job_offers FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter','auditor']));
CREATE POLICY "job_offers_staff_write" ON public.job_offers FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter']));

DROP POLICY IF EXISTS "candidates_read" ON public.candidates;
CREATE POLICY "candidates_staff_read" ON public.candidates FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter','auditor']));
DROP POLICY IF EXISTS "jobs_hr_write" ON public.job_openings;
CREATE POLICY "jobs_staff_write" ON public.job_openings FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter']));
DROP POLICY IF EXISTS "candidates_hr_write" ON public.candidates;
CREATE POLICY "candidates_staff_write" ON public.candidates FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','recruiter']));

CREATE POLICY "expense_claims_finance_write" ON public.expense_claims FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','finance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','finance_officer']) OR employee_id = public.current_employee_id());
CREATE POLICY "loans_payroll_write" ON public.loans FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer','finance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer','finance_officer']));
CREATE POLICY "settlements_payroll_write" ON public.settlements FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer','finance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer','finance_officer']));
CREATE POLICY "expense_categories_finance_write" ON public.expense_categories FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','finance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','finance_officer']));

CREATE POLICY "asset_assignments_owner_or_hr" ON public.asset_assignments FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY "asset_assignments_hr_write" ON public.asset_assignments FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "document_ack_owner_read" ON public.document_acknowledgements FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY "document_ack_owner_insert" ON public.document_acknowledgements FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());

CREATE POLICY "journals_finance_read" ON public.accounting_journals FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','hr_manager','payroll_officer','finance_officer','auditor']));
CREATE POLICY "journals_finance_write" ON public.accounting_journals FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','finance_officer']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin','finance_officer']));
CREATE POLICY "integrations_admin_read" ON public.integration_connections FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','finance_officer','auditor']));
CREATE POLICY "integrations_admin_write" ON public.integration_connections FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin']));
CREATE POLICY "webhooks_admin_read" ON public.webhooks FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin','auditor']));
CREATE POLICY "webhooks_admin_write" ON public.webhooks FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['org_admin','super_admin']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['org_admin','super_admin']));

-- Performance indexes for common HRMS queries.
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_requests_employee_status ON public.requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance_records(employee_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_punches_employee_time ON public.punches(employee_id, punch_time DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_details_run ON public.payroll_details(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_employee ON public.expense_claims(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications_inbox(recipient_id, is_read, created_at DESC);
