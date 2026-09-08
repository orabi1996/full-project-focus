-- Minimal pre-migration schema matching the repository's canonical payroll tables.
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION public.current_user_has_any_role(roles text[]) RETURNS boolean LANGUAGE sql AS $$
 SELECT coalesce(current_setting('test.app_role',true),'finance_officer')=ANY(roles)
$$;
CREATE TABLE employees(id uuid PRIMARY KEY,iban text,bank_name text);
CREATE TABLE company_bank_accounts(id uuid PRIMARY KEY,current_balance numeric NOT NULL,currency text NOT NULL DEFAULT 'SAR');
CREATE TABLE payroll_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payroll_group_id uuid,period_year int,period_month int,status text NOT NULL DEFAULT 'draft',
 total_employees int DEFAULT 0,total_basic_salary numeric DEFAULT 0,total_allowances numeric DEFAULT 0,total_overtime_amount numeric DEFAULT 0,
 total_deductions numeric DEFAULT 0,total_net_salary numeric DEFAULT 0,total_employer_gosi numeric DEFAULT 0,locked_at timestamptz,paid_at timestamptz,
 UNIQUE(payroll_group_id,period_year,period_month)
);
CREATE TABLE payroll_details(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payroll_run_id uuid NOT NULL REFERENCES payroll_runs ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES employees,basic_salary numeric NOT NULL DEFAULT 0,housing_allowance numeric NOT NULL DEFAULT 0,
 transport_allowance numeric NOT NULL DEFAULT 0,other_allowances numeric NOT NULL DEFAULT 0,overtime_hours numeric NOT NULL DEFAULT 0,
 overtime_amount numeric NOT NULL DEFAULT 0,bonus_amount numeric NOT NULL DEFAULT 0,unpaid_leave_deduction numeric NOT NULL DEFAULT 0,
 absence_late_deduction numeric NOT NULL DEFAULT 0,loan_deduction numeric NOT NULL DEFAULT 0,gosi_employee_deduction numeric NOT NULL DEFAULT 0,
 other_deductions numeric NOT NULL DEFAULT 0,gross_salary numeric NOT NULL DEFAULT 0,total_deductions numeric NOT NULL DEFAULT 0,net_salary numeric NOT NULL DEFAULT 0,
 UNIQUE(payroll_run_id,employee_id)
);
CREATE TABLE loans(id uuid PRIMARY KEY,employee_id uuid REFERENCES employees,monthly_installment numeric NOT NULL,remaining_balance numeric NOT NULL,
 paid_installments int NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'active');
CREATE TABLE payroll_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payroll_run_id uuid REFERENCES payroll_runs ON DELETE CASCADE,
 employee_id uuid REFERENCES employees,net_amount numeric,iban text,bank_name text,status text NOT NULL DEFAULT 'pending',
 bank_account_id uuid REFERENCES company_bank_accounts,batch_no text,reference text,sent_at timestamptz,paid_at timestamptz,failure_reason text,
 UNIQUE(payroll_run_id,employee_id));
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
