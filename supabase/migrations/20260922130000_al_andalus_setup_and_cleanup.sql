-- Migration: 20260922130000_al_andalus_setup_and_cleanup.sql
-- Description:
-- 1. Create audit log & backup tables to secure any demo data before deletion.
-- 2. Safely clean up mock/demo operational and organizational records in strict relational order.
-- 3. Preserve all authentication accounts (auth.users) and role assignments (user_roles).
-- 4. Initialize company "الأندلس" with verified minimal data and setup_status = 'incomplete'.
-- 5. Enforce sensitive employee field protection via SECURITY DEFINER trigger.

BEGIN;

-- 1. Setup Status on Companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'setup_status'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN setup_status text NOT NULL DEFAULT 'incomplete';
  END IF;
END $$;

-- 2. Create Audit Log for Cleanup Tracking
CREATE TABLE IF NOT EXISTS public.cleanup_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  target_entity text NOT NULL,
  backed_up_count integer NOT NULL DEFAULT 0,
  details jsonb DEFAULT '{}'::jsonb
);

-- 3. Back up and safely clean up demo records (Only if tables exist)
DO $$
DECLARE
  v_count integer;
BEGIN
  -- A. Candidates & Recruitment
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'candidates') THEN
    CREATE TABLE IF NOT EXISTS public._backup_candidates_20260922 AS SELECT * FROM public.candidates;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
    VALUES ('BACKUP_AND_DELETE', 'candidates', v_count, '{"reason": "demo data cleanup"}'::jsonb);
    DELETE FROM public.candidates;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_openings') THEN
    CREATE TABLE IF NOT EXISTS public._backup_job_openings_20260922 AS SELECT * FROM public.job_openings;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
    VALUES ('BACKUP_AND_DELETE', 'job_openings', v_count, '{"reason": "demo data cleanup"}'::jsonb);
    DELETE FROM public.job_openings;
  END IF;

  -- B. Expenses & Claims
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_claims') THEN
    CREATE TABLE IF NOT EXISTS public._backup_expense_claims_20260922 AS SELECT * FROM public.expense_claims;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
    VALUES ('BACKUP_AND_DELETE', 'expense_claims', v_count, '{"reason": "demo data cleanup"}'::jsonb);
    DELETE FROM public.expense_claims;
  END IF;

  -- C. Performance
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluations') THEN
    CREATE TABLE IF NOT EXISTS public._backup_evaluations_20260922 AS SELECT * FROM public.evaluations;
    DELETE FROM public.evaluations;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'performance_cycles') THEN
    CREATE TABLE IF NOT EXISTS public._backup_performance_cycles_20260922 AS SELECT * FROM public.performance_cycles;
    DELETE FROM public.performance_cycles;
  END IF;

  -- D. Attendance & Corrections & Overtime
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_records') THEN
    CREATE TABLE IF NOT EXISTS public._backup_attendance_records_20260922 AS SELECT * FROM public.attendance_records;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
    VALUES ('BACKUP_AND_DELETE', 'attendance_records', v_count, '{"reason": "demo data cleanup"}'::jsonb);
    DELETE FROM public.attendance_records;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'overtime_records') THEN
    CREATE TABLE IF NOT EXISTS public._backup_overtime_records_20260922 AS SELECT * FROM public.overtime_records;
    DELETE FROM public.overtime_records;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_corrections') THEN
    CREATE TABLE IF NOT EXISTS public._backup_attendance_corrections_20260922 AS SELECT * FROM public.attendance_corrections;
    DELETE FROM public.attendance_corrections;
  END IF;

  -- E. Payroll & Loans
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_runs') THEN
    CREATE TABLE IF NOT EXISTS public._backup_payroll_runs_20260922 AS SELECT * FROM public.payroll_runs;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
    VALUES ('BACKUP_AND_DELETE', 'payroll_runs', v_count, '{"reason": "demo data cleanup"}'::jsonb);
    DELETE FROM public.payroll_runs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
    CREATE TABLE IF NOT EXISTS public._backup_loans_20260922 AS SELECT * FROM public.loans;
    DELETE FROM public.loans;
  END IF;

  -- F. Service Requests
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_requests') THEN
    CREATE TABLE IF NOT EXISTS public._backup_service_requests_20260922 AS SELECT * FROM public.service_requests;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
    VALUES ('BACKUP_AND_DELETE', 'service_requests', v_count, '{"reason": "demo data cleanup"}'::jsonb);
    DELETE FROM public.service_requests;
  END IF;

  -- G. Employees (Delete mock employees while preserving auth.users & user_roles)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
    CREATE TABLE IF NOT EXISTS public._backup_employees_20260922 AS SELECT * FROM public.employees;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
    VALUES ('BACKUP_AND_DELETE', 'employees', v_count, '{"reason": "demo employee cleanup, preserving user_roles"}'::jsonb);
    DELETE FROM public.employees;
  END IF;

  -- H. Organizational Structure
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_positions') THEN
    CREATE TABLE IF NOT EXISTS public._backup_job_positions_20260922 AS SELECT * FROM public.job_positions;
    DELETE FROM public.job_positions;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_centers') THEN
    CREATE TABLE IF NOT EXISTS public._backup_cost_centers_20260922 AS SELECT * FROM public.cost_centers;
    DELETE FROM public.cost_centers;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments') THEN
    CREATE TABLE IF NOT EXISTS public._backup_departments_20260922 AS SELECT * FROM public.departments;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
    VALUES ('BACKUP_AND_DELETE', 'departments', v_count, '{"reason": "demo departments cleanup"}'::jsonb);
    DELETE FROM public.departments;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_locations') THEN
    CREATE TABLE IF NOT EXISTS public._backup_work_locations_20260922 AS SELECT * FROM public.work_locations;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
    VALUES ('BACKUP_AND_DELETE', 'work_locations', v_count, '{"reason": "demo locations cleanup"}'::jsonb);
    DELETE FROM public.work_locations;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subsidiaries') THEN
    CREATE TABLE IF NOT EXISTS public._backup_subsidiaries_20260922 AS SELECT * FROM public.subsidiaries;
    DELETE FROM public.subsidiaries;
  END IF;

  -- I. Shifts & Policies (Clean up demo definitions)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shifts') THEN
    CREATE TABLE IF NOT EXISTS public._backup_shifts_20260922 AS SELECT * FROM public.shifts;
    DELETE FROM public.shifts;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_types') THEN
    CREATE TABLE IF NOT EXISTS public._backup_leave_types_20260922 AS SELECT * FROM public.leave_types;
    DELETE FROM public.leave_types;
  END IF;

  -- J. Companies: Clean demo companies, prepare for Al-Andalus
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    CREATE TABLE IF NOT EXISTS public._backup_companies_20260922 AS SELECT * FROM public.companies;
    DELETE FROM public.companies WHERE legal_name_ar != 'الأندلس';
  END IF;

END $$;

-- 4. Ensure Company «الأندلس» Exists with verified minimal profile
INSERT INTO public.companies (
  id,
  legal_name_ar,
  legal_name_en,
  code,
  entity_type,
  country,
  currency,
  timezone,
  setup_status,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'الأندلس',
  '',
  'AL-ANDALUS',
  'limited_liability',
  'المملكة العربية السعودية',
  'SAR',
  'Asia/Riyadh',
  'incomplete',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET
  legal_name_ar = 'الأندلس',
  setup_status = 'incomplete',
  updated_at = now();

-- 5. Field Protection Trigger on Employees (Prevent direct modification of sensitive fields by unauthorized roles)
CREATE OR REPLACE FUNCTION public.enforce_employee_field_protection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_authorized boolean := false;
BEGIN
  -- If executed by service_role or admin, allow
  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'hr_manager', 'org_admin')
    ) INTO v_is_authorized;
  ELSE
    -- System/internal migration/worker context
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    IF NEW.basic_salary IS DISTINCT FROM OLD.basic_salary OR
       NEW.total_salary IS DISTINCT FROM OLD.total_salary OR
       NEW.company_id IS DISTINCT FROM OLD.company_id OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.job_title IS DISTINCT FROM OLD.job_title OR
       NEW.department_id IS DISTINCT FROM OLD.department_id OR
       NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'غير مصرح لك بتعديل البيانات المالية أو التنظيمية أو الوظيفية للموظف مباشرة';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_employee_field_protection ON public.employees;
CREATE TRIGGER trg_enforce_employee_field_protection
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.enforce_employee_field_protection();

COMMIT;
