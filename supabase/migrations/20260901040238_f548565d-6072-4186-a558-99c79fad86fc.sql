ALTER TABLE public.role_definitions ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.role_definitions ADD COLUMN IF NOT EXISTS name_ar text;
ALTER TABLE public.role_definitions ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.role_definitions ADD COLUMN IF NOT EXISTS description_ar text;
ALTER TABLE public.role_definitions ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.role_definitions ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE public.role_definitions ADD COLUMN IF NOT EXISTS data_scope text NOT NULL DEFAULT 'all';
UPDATE public.role_definitions SET code = role_key::text WHERE code IS NULL;
UPDATE public.role_definitions SET name_ar = display_name_ar WHERE name_ar IS NULL;
UPDATE public.role_definitions SET name_en = display_name_en WHERE name_en IS NULL;
UPDATE public.role_definitions SET description_ar = description WHERE description_ar IS NULL;
UPDATE public.role_definitions SET description_en = description WHERE description_en IS NULL;

ALTER TABLE public.performance_cycles ADD COLUMN IF NOT EXISTS title_ar text;
ALTER TABLE public.performance_cycles ADD COLUMN IF NOT EXISTS title_en text;
ALTER TABLE public.performance_cycles ADD COLUMN IF NOT EXISTS period_type text NOT NULL DEFAULT 'annual';
ALTER TABLE public.performance_cycles ADD COLUMN IF NOT EXISTS participants_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.performance_cycles ADD COLUMN IF NOT EXISTS completion_rate numeric(5,2) NOT NULL DEFAULT 0;
UPDATE public.performance_cycles SET title_ar = name_ar WHERE title_ar IS NULL;
UPDATE public.performance_cycles SET title_en = name_en WHERE title_en IS NULL;

ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS flexible_hours numeric(4,2);
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS split_second_start_time time;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS split_second_end_time time;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS allow_single_punch boolean NOT NULL DEFAULT false;

ALTER TABLE public.subsidiaries ADD COLUMN IF NOT EXISTS manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.work_locations ADD COLUMN IF NOT EXISTS default_shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL;

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS unit_type text NOT NULL DEFAULT 'department';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS first_name_ar text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_name_ar text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS first_name_en text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_name_en text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS personal_email text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS national_id_or_iqama text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS marital_status text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS subsidiary_id uuid REFERENCES public.subsidiaries(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'indefinite';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS probation_end_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS total_salary numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS completion_score integer NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS current_step_index integer NOT NULL DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS total_steps integer NOT NULL DEFAULT 1;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS current_approver_role text;

ALTER TABLE public.payroll_details ADD COLUMN IF NOT EXISTS overtime_hours numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_details ADD COLUMN IF NOT EXISTS bonus_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_details ADD COLUMN IF NOT EXISTS unpaid_leave_deduction numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_details ADD COLUMN IF NOT EXISTS absence_late_deduction numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_details ADD COLUMN IF NOT EXISTS loan_deduction numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_details ADD COLUMN IF NOT EXISTS gosi_employee_deduction numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_details ADD COLUMN IF NOT EXISTS total_deductions numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_details ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS report_id uuid REFERENCES public.expense_reports(id) ON DELETE SET NULL;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS policy_warning_triggered boolean NOT NULL DEFAULT false;

ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS cv_url text;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS notes_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.job_offers ADD COLUMN IF NOT EXISTS basic_salary numeric(12,2);
ALTER TABLE public.job_offers ADD COLUMN IF NOT EXISTS housing_allowance numeric(12,2);
ALTER TABLE public.job_offers ADD COLUMN IF NOT EXISTS transport_allowance numeric(12,2);
ALTER TABLE public.job_offers ADD COLUMN IF NOT EXISTS proposed_start_date date;

ALTER TABLE public.hardware_assets ADD COLUMN IF NOT EXISTS assigned_date date;

ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS visibility_scope text NOT NULL DEFAULT 'all';
ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS requires_acknowledgment boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.approval_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  scope_type text NOT NULL DEFAULT 'all',
  scope_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.request_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  step_number integer NOT NULL DEFAULT 0,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evaluation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  evaluator_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  evaluation_type text NOT NULL DEFAULT 'manager',
  competency_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_score numeric(5,2),
  notes text,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.workforce_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text NOT NULL DEFAULT '',
  plan_year integer NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  current_headcount integer NOT NULL DEFAULT 0,
  planned_hires integer NOT NULL DEFAULT 0,
  planned_exits integer NOT NULL DEFAULT 0,
  target_headcount integer NOT NULL DEFAULT 0,
  current_budget numeric(14,2) NOT NULL DEFAULT 0,
  projected_cost numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.hardware_assets(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
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
  UNIQUE (document_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.accounting_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_no text NOT NULL DEFAULT ('JV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  source_type text NOT NULL DEFAULT 'payroll',
  source_reference text NOT NULL DEFAULT '',
  journal_date date NOT NULL DEFAULT current_date,
  total_debit numeric(14,2) NOT NULL DEFAULT 0,
  total_credit numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  erp_integration_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_chains TO authenticated;
GRANT ALL ON public.approval_chains TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_timeline TO authenticated;
GRANT ALL ON public.request_timeline TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_records TO authenticated;
GRANT ALL ON public.evaluation_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_plans TO authenticated;
GRANT ALL ON public.workforce_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_assignments TO authenticated;
GRANT ALL ON public.asset_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_acknowledgements TO authenticated;
GRANT ALL ON public.document_acknowledgements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_journals TO authenticated;
GRANT ALL ON public.accounting_journals TO service_role;

ALTER TABLE public.approval_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_chains_select" ON public.approval_chains FOR SELECT TO authenticated USING (true);
CREATE POLICY "approval_chains_write_hr" ON public.approval_chains FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

CREATE POLICY "request_timeline_select" ON public.request_timeline FOR SELECT TO authenticated
  USING (
    public.current_user_is_hr()
    OR request_id IN (SELECT id FROM public.requests WHERE employee_id = public.current_employee_id())
  );
CREATE POLICY "request_timeline_insert" ON public.request_timeline FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "evaluation_records_select" ON public.evaluation_records FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "evaluation_records_insert" ON public.evaluation_records FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr() OR evaluator_employee_id = public.current_employee_id());
CREATE POLICY "evaluation_records_update" ON public.evaluation_records FOR UPDATE TO authenticated
  USING (public.current_user_is_hr() OR evaluator_employee_id = public.current_employee_id());
CREATE POLICY "evaluation_records_delete" ON public.evaluation_records FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

CREATE POLICY "workforce_plans_select" ON public.workforce_plans FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "workforce_plans_write_hr" ON public.workforce_plans FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

CREATE POLICY "asset_assignments_select" ON public.asset_assignments FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "asset_assignments_write_hr" ON public.asset_assignments FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

CREATE POLICY "document_acknowledgements_select" ON public.document_acknowledgements FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "document_acknowledgements_insert" ON public.document_acknowledgements FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_is_hr());

CREATE POLICY "accounting_journals_select" ON public.accounting_journals FOR SELECT TO authenticated
  USING (public.current_user_is_hr());
CREATE POLICY "accounting_journals_write_hr" ON public.accounting_journals FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

CREATE INDEX IF NOT EXISTS idx_request_timeline_request ON public.request_timeline(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evaluation_records_cycle ON public.evaluation_records(cycle_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journals_date ON public.accounting_journals(journal_date DESC);