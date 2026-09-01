ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_email text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  doc_number text,
  issued_at date,
  expires_at date,
  file_url text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salary_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_from date NOT NULL DEFAULT current_date,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
  transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
  other_allowances numeric(12,2) NOT NULL DEFAULT 0,
  gosi_registered boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key public.app_role NOT NULL,
  display_name_ar text NOT NULL,
  display_name_en text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_key)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key public.app_role NOT NULL,
  module text NOT NULL,
  permission text NOT NULL,
  data_scope text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_key, module, permission)
);

CREATE TABLE IF NOT EXISTS public.payroll_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
  transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
  other_allowances numeric(12,2) NOT NULL DEFAULT 0,
  overtime_amount numeric(12,2) NOT NULL DEFAULT 0,
  gosi_employee numeric(12,2) NOT NULL DEFAULT 0,
  gosi_employer numeric(12,2) NOT NULL DEFAULT 0,
  loan_deductions numeric(12,2) NOT NULL DEFAULT 0,
  absence_deductions numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  working_days integer NOT NULL DEFAULT 0,
  absent_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  approver_role text,
  approver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  note text,
  acted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_no text NOT NULL DEFAULT ('EXP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.performance_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.performance_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  weight numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_type text NOT NULL DEFAULT 'manager',
  overall_score numeric(5,2),
  comments text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  stage text NOT NULL,
  moved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  offered_salary numeric(12,2),
  start_date date,
  status text NOT NULL DEFAULT 'sent',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.company_documents(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.org_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reference_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_type text NOT NULL,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_type, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_profiles TO authenticated;
GRANT ALL ON public.salary_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_definitions TO authenticated;
GRANT ALL ON public.role_definitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_details TO authenticated;
GRANT ALL ON public.payroll_details TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_steps TO authenticated;
GRANT ALL ON public.approval_steps TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_reports TO authenticated;
GRANT ALL ON public.expense_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_cycles TO authenticated;
GRANT ALL ON public.performance_cycles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_criteria TO authenticated;
GRANT ALL ON public.performance_criteria TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO authenticated;
GRANT ALL ON public.performance_reviews TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_stages TO authenticated;
GRANT ALL ON public.candidate_stages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_offers TO authenticated;
GRANT ALL ON public.job_offers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_acknowledgments TO authenticated;
GRANT ALL ON public.document_acknowledgments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_settings TO authenticated;
GRANT ALL ON public.org_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_lists TO authenticated;
GRANT ALL ON public.reference_lists TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subsidiaries TO authenticated;
GRANT ALL ON public.subsidiaries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_locations TO authenticated;
GRANT ALL ON public.work_locations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.punches TO authenticated;
GRANT ALL ON public.punches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated;
GRANT ALL ON public.leave_types TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_groups TO authenticated;
GRANT ALL ON public.payroll_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_claims TO authenticated;
GRANT ALL ON public.expense_claims TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_openings TO authenticated;
GRANT ALL ON public.job_openings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hardware_assets TO authenticated;
GRANT ALL ON public.hardware_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications_inbox TO authenticated;
GRANT ALL ON public.notifications_inbox TO service_role;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emp_docs_select" ON public.employee_documents;
CREATE POLICY "emp_docs_select" ON public.employee_documents FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "emp_docs_insert" ON public.employee_documents;
CREATE POLICY "emp_docs_insert" ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "emp_docs_update" ON public.employee_documents;
CREATE POLICY "emp_docs_update" ON public.employee_documents FOR UPDATE TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "emp_docs_delete" ON public.employee_documents;
CREATE POLICY "emp_docs_delete" ON public.employee_documents FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "salary_select" ON public.salary_profiles;
CREATE POLICY "salary_select" ON public.salary_profiles FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "salary_insert" ON public.salary_profiles;
CREATE POLICY "salary_insert" ON public.salary_profiles FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
DROP POLICY IF EXISTS "salary_update" ON public.salary_profiles;
CREATE POLICY "salary_update" ON public.salary_profiles FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
DROP POLICY IF EXISTS "salary_delete" ON public.salary_profiles;
CREATE POLICY "salary_delete" ON public.salary_profiles FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "role_def_select" ON public.role_definitions;
CREATE POLICY "role_def_select" ON public.role_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "role_def_write" ON public.role_definitions;
CREATE POLICY "role_def_write" ON public.role_definitions FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "role_perm_select" ON public.role_permissions;
CREATE POLICY "role_perm_select" ON public.role_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "role_perm_write" ON public.role_permissions;
CREATE POLICY "role_perm_write" ON public.role_permissions FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "payroll_det_select" ON public.payroll_details;
CREATE POLICY "payroll_det_select" ON public.payroll_details FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "payroll_det_write" ON public.payroll_details;
CREATE POLICY "payroll_det_write" ON public.payroll_details FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "approval_select" ON public.approval_steps;
CREATE POLICY "approval_select" ON public.approval_steps FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR approver_user_id = auth.uid());
DROP POLICY IF EXISTS "approval_insert" ON public.approval_steps;
CREATE POLICY "approval_insert" ON public.approval_steps FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
DROP POLICY IF EXISTS "approval_update" ON public.approval_steps;
CREATE POLICY "approval_update" ON public.approval_steps FOR UPDATE TO authenticated
  USING (public.current_user_is_hr() OR approver_user_id = auth.uid());
DROP POLICY IF EXISTS "approval_delete" ON public.approval_steps;
CREATE POLICY "approval_delete" ON public.approval_steps FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "exp_rep_select" ON public.expense_reports;
CREATE POLICY "exp_rep_select" ON public.expense_reports FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "exp_rep_insert" ON public.expense_reports;
CREATE POLICY "exp_rep_insert" ON public.expense_reports FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_is_hr());
DROP POLICY IF EXISTS "exp_rep_update" ON public.expense_reports;
CREATE POLICY "exp_rep_update" ON public.expense_reports FOR UPDATE TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "exp_rep_delete" ON public.expense_reports;
CREATE POLICY "exp_rep_delete" ON public.expense_reports FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "perf_cycles_select" ON public.performance_cycles;
CREATE POLICY "perf_cycles_select" ON public.performance_cycles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "perf_cycles_write" ON public.performance_cycles;
CREATE POLICY "perf_cycles_write" ON public.performance_cycles FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "perf_crit_select" ON public.performance_criteria;
CREATE POLICY "perf_crit_select" ON public.performance_criteria FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "perf_crit_write" ON public.performance_criteria;
CREATE POLICY "perf_crit_write" ON public.performance_criteria FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "perf_rev_select" ON public.performance_reviews;
CREATE POLICY "perf_rev_select" ON public.performance_reviews FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id() OR reviewer_id = auth.uid());
DROP POLICY IF EXISTS "perf_rev_insert" ON public.performance_reviews;
CREATE POLICY "perf_rev_insert" ON public.performance_reviews FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr() OR reviewer_id = auth.uid());
DROP POLICY IF EXISTS "perf_rev_update" ON public.performance_reviews;
CREATE POLICY "perf_rev_update" ON public.performance_reviews FOR UPDATE TO authenticated
  USING (public.current_user_is_hr() OR reviewer_id = auth.uid());
DROP POLICY IF EXISTS "perf_rev_delete" ON public.performance_reviews;
CREATE POLICY "perf_rev_delete" ON public.performance_reviews FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "cand_stages_select" ON public.candidate_stages;
CREATE POLICY "cand_stages_select" ON public.candidate_stages FOR SELECT TO authenticated
  USING (public.current_user_is_hr());
DROP POLICY IF EXISTS "cand_stages_insert" ON public.candidate_stages;
CREATE POLICY "cand_stages_insert" ON public.candidate_stages FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
DROP POLICY IF EXISTS "cand_stages_update" ON public.candidate_stages;
CREATE POLICY "cand_stages_update" ON public.candidate_stages FOR UPDATE TO authenticated
  USING (public.current_user_is_hr());
DROP POLICY IF EXISTS "cand_stages_delete" ON public.candidate_stages;
CREATE POLICY "cand_stages_delete" ON public.candidate_stages FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "job_offers_select" ON public.job_offers;
CREATE POLICY "job_offers_select" ON public.job_offers FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR created_by = auth.uid());
DROP POLICY IF EXISTS "job_offers_insert" ON public.job_offers;
CREATE POLICY "job_offers_insert" ON public.job_offers FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
DROP POLICY IF EXISTS "job_offers_update" ON public.job_offers;
CREATE POLICY "job_offers_update" ON public.job_offers FOR UPDATE TO authenticated
  USING (public.current_user_is_hr());
DROP POLICY IF EXISTS "job_offers_delete" ON public.job_offers;
CREATE POLICY "job_offers_delete" ON public.job_offers FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "doc_ack_select" ON public.document_acknowledgments;
CREATE POLICY "doc_ack_select" ON public.document_acknowledgments FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "doc_ack_insert" ON public.document_acknowledgments;
CREATE POLICY "doc_ack_insert" ON public.document_acknowledgments FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_is_hr());
DROP POLICY IF EXISTS "doc_ack_update" ON public.document_acknowledgments;
CREATE POLICY "doc_ack_update" ON public.document_acknowledgments FOR UPDATE TO authenticated
  USING (public.current_user_is_hr());
DROP POLICY IF EXISTS "doc_ack_delete" ON public.document_acknowledgments;
CREATE POLICY "doc_ack_delete" ON public.document_acknowledgments FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "org_settings_select" ON public.org_settings;
CREATE POLICY "org_settings_select" ON public.org_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "org_settings_write" ON public.org_settings;
CREATE POLICY "org_settings_write" ON public.org_settings FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "ref_lists_select" ON public.reference_lists;
CREATE POLICY "ref_lists_select" ON public.reference_lists FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ref_lists_write" ON public.reference_lists;
CREATE POLICY "ref_lists_write" ON public.reference_lists FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

CREATE POLICY "shifts_insert_hr" ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "shifts_update_hr" ON public.shifts FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "shifts_delete_hr" ON public.shifts FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "leave_types_read" ON public.leave_types;
CREATE POLICY "leave_types_select" ON public.leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_types_insert_hr" ON public.leave_types FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "leave_types_update_hr" ON public.leave_types FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "leave_types_delete_hr" ON public.leave_types FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "companies_read" ON public.companies;
CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_insert_hr" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_hr());
CREATE POLICY "companies_update_hr" ON public.companies FOR UPDATE TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());
CREATE POLICY "companies_delete_hr" ON public.companies FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "subsidiaries_read" ON public.subsidiaries;
CREATE POLICY "subsidiaries_select" ON public.subsidiaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "subsidiaries_write_hr" ON public.subsidiaries FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "locations_read" ON public.work_locations;
CREATE POLICY "work_locations_select" ON public.work_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_locations_write_hr" ON public.work_locations FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "payroll_groups_read" ON public.payroll_groups;
CREATE POLICY "payroll_groups_select" ON public.payroll_groups FOR SELECT TO authenticated
  USING (public.current_user_is_hr());
CREATE POLICY "payroll_groups_write_hr" ON public.payroll_groups FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "payroll_runs_read" ON public.payroll_runs;
CREATE POLICY "payroll_runs_select" ON public.payroll_runs FOR SELECT TO authenticated
  USING (public.current_user_is_hr());
CREATE POLICY "payroll_runs_write_hr" ON public.payroll_runs FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "loans_read" ON public.loans;
CREATE POLICY "loans_select" ON public.loans FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "loans_insert" ON public.loans FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY "loans_update" ON public.loans FOR UPDATE TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "loans_delete" ON public.loans FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "settlements_read" ON public.settlements;
CREATE POLICY "settlements_select" ON public.settlements FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "settlements_write_hr" ON public.settlements FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "expense_categories_read" ON public.expense_categories;
CREATE POLICY "expense_categories_select" ON public.expense_categories FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "expense_categories_write_hr" ON public.expense_categories FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "expense_claims_read" ON public.expense_claims;
CREATE POLICY "expense_claims_select" ON public.expense_claims FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "expense_claims_insert" ON public.expense_claims FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.current_user_is_hr());
CREATE POLICY "expense_claims_update" ON public.expense_claims FOR UPDATE TO authenticated
  USING (public.current_user_is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "expense_claims_delete" ON public.expense_claims FOR DELETE TO authenticated
  USING (public.current_user_is_hr());

DROP POLICY IF EXISTS "jobs_read" ON public.job_openings;
CREATE POLICY "job_openings_select" ON public.job_openings FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "job_openings_write_hr" ON public.job_openings FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "candidates_read" ON public.candidates;
CREATE POLICY "candidates_select" ON public.candidates FOR SELECT TO authenticated
  USING (public.current_user_is_hr());
CREATE POLICY "candidates_write_hr" ON public.candidates FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "assets_read" ON public.hardware_assets;
CREATE POLICY "hardware_assets_select" ON public.hardware_assets FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR assigned_to_employee_id = public.current_employee_id());
CREATE POLICY "hardware_assets_write_hr" ON public.hardware_assets FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "company_docs_read" ON public.company_documents;
CREATE POLICY "company_documents_select" ON public.company_documents FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "company_documents_write_hr" ON public.company_documents FOR ALL TO authenticated
  USING (public.current_user_is_hr()) WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "audit_read" ON public.audit_events;
CREATE POLICY "audit_events_select" ON public.audit_events FOR SELECT TO authenticated
  USING (public.current_user_is_hr() OR actor_id = auth.uid());
CREATE POLICY "audit_events_insert" ON public.audit_events FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "audit_events_update" ON public.audit_events FOR UPDATE TO authenticated
  USING (false);
CREATE POLICY "audit_events_delete" ON public.audit_events FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "notifications_read" ON public.notifications_inbox;
CREATE POLICY "notifications_select" ON public.notifications_inbox FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY "notifications_insert" ON public.notifications_inbox FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "notifications_update" ON public.notifications_inbox FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY "notifications_delete" ON public.notifications_inbox FOR DELETE TO authenticated
  USING (recipient_id = auth.uid() OR public.current_user_is_hr());

INSERT INTO public.role_definitions (role_key, display_name_ar, display_name_en, description) VALUES
  ('super_admin', 'مدير النظام العام', 'Super Admin', 'وصول كامل لجميع الوحدات والإعدادات'),
  ('org_admin', 'مدير المنشأة', 'Org Admin', 'إدارة المنشأة والهيكل التنظيمي'),
  ('hr_manager', 'مدير الموارد البشرية', 'HR Manager', 'إدارة شؤون الموظفين والرواتب والحضور'),
  ('line_manager', 'المدير المباشر', 'Line Manager', 'اعتماد طلبات الفريق المباشر'),
  ('employee', 'موظف', 'Employee', 'الخدمة الذاتية والطلبات الشخصية'),
  ('payroll_officer', 'مسؤول الرواتب', 'Payroll Officer', 'تشغيل مسيرات الرواتب والتأمينات'),
  ('attendance_officer', 'مسؤول الحضور', 'Attendance Officer', 'إدارة الحضور والانصراف والورديات'),
  ('recruiter', 'مسؤول التوظيف', 'Recruiter', 'إدارة الوظائف والمرشحين والعروض'),
  ('finance_officer', 'مسؤول مالي', 'Finance Officer', 'إدارة المصروفات والسلف والتسويات'),
  ('performance_lead', 'قائد الأداء', 'Performance Lead', 'إدارة دورات ومعايير تقييم الأداء'),
  ('auditor', 'مدقق', 'Auditor', 'اطلاع على سجل التدقيق والتقارير')
ON CONFLICT (role_key) DO UPDATE SET
  display_name_ar = EXCLUDED.display_name_ar,
  display_name_en = EXCLUDED.display_name_en,
  description = EXCLUDED.description;

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON public.employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance_records(employee_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_requests_employee ON public.requests(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_employee_date ON public.schedule_assignments(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON public.leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_punches_employee_time ON public.punches(employee_id, punch_time DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_details_run ON public.payroll_details(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_employee ON public.expense_claims(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications_inbox(recipient_id, is_read, created_at DESC);