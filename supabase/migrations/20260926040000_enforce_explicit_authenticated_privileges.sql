-- ============================================================================
-- Migration: 20260926040000_enforce_explicit_authenticated_privileges.sql
-- Description: Prompt 13.5 Emergency Security Closure
-- 1. Revoke global CRUD privileges from authenticated role across public schema
-- 2. Alter default privileges to deny-by-default for future tables/sequences
-- 3. Preserve full service_role administration
-- 4. Establish explicit least-privilege matrix:
--    - RPC-Only / System-Mutated tables: SELECT only under RLS; direct write revoked
--    - Selective RLS Read/Write tables: granted only necessary operations
--    - Internal / sensitive sequence tables: service_role only
-- 5. Guarantee RLS is enabled on ALL public base tables
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. REVOKE GLOBAL PUBLIC PRIVILEGES & SET DENY-BY-DEFAULT
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;

-- Ensure future objects do not automatically grant permissions to authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM authenticated;

-- Preserve service_role administrative capabilities
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

-- Grant standard execution on schema functions to authenticated
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. ENSURE RLS IS ENABLED ON EVERY PUBLIC TABLE
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.table_name);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. EXPLICIT PRIVILEGE MATRIX
-- ----------------------------------------------------------------------------

-- A. RPC-Only & System-Mutated Tables (SELECT only under RLS; direct writes blocked)
DO $$
DECLARE
  rpc_tables text[] := ARRAY[
    'schedule_assignments', 'roster_periods', 'shifts', 'shift_segments',
    'roster_templates', 'rotation_patterns', 'roster_coverage_requirements',
    'roster_exceptions', 'roster_audit_logs', 'attendance_periods',
    'attendance_payroll_snapshots', 'attendance_devices', 'attendance_device_employee_mappings',
    'attendance_records', 'attendance_exceptions', 'payroll_runs',
    'payroll_details', 'payroll_payments', 'payroll_loan_allocations',
    'settlements', 'accounting_journals', 'leave_balances',
    'leave_balance_transactions', 'audit_events', 'organization_change_history',
    'employee_assignment_history', 'request_timeline', 'leave_accrual_runs',
    'leave_carryover_runs', 'leave_carryover_expiry_runs', 'punch_import_batches',
    'punch_import_raw_events', 'candidate_employee_conversions', 'app_permissions',
    'role_definitions', 'role_permissions', 'user_roles',
    'employee_roles', 'user_role_assignments', 'user_company_access', 'delegation_rules',
    'overtime_records'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY rpc_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated;', t);
    END IF;
  END LOOP;
END $$;

-- B. Selective Read/Write Tables Under RLS
DO $$
DECLARE
  crud_tables text[] := ARRAY[
    'company_bank_accounts', 'departments', 'subsidiaries', 'cost_centers',
    'job_positions', 'work_locations', 'workforce_plans', 'approval_chains',
    'approval_steps', 'biometric_devices', 'holidays', 'company_holidays',
    'leave_attachment_staging', 'candidates', 'job_openings', 'job_offers',
    'expense_categories'
  ];
  emp_tables text[] := ARRAY[
    'employees', 'employee_contracts', 'salary_profiles', 'employee_documents',
    'company_documents', 'file_objects', 'document_acknowledgements', 'leave_types',
    'evaluation_records', 'performance_cycles', 'expense_claims', 'expense_reports',
    'loans', 'payroll_groups', 'hardware_assets', 'asset_assignments'
  ];
  t text;
BEGIN
  -- Companies: SELECT, UPDATE under admin RLS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    EXECUTE 'GRANT SELECT, UPDATE ON TABLE public.companies TO authenticated;';
  END IF;

  -- Organization structures: full CRUD under company tenant admin RLS
  FOREACH t IN ARRAY crud_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', t);
    END IF;
  END LOOP;

  -- Employees & Contracts: SELECT, INSERT, UPDATE
  FOREACH t IN ARRAY emp_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO authenticated;', t);
    END IF;
  END LOOP;

  -- Requests: SELECT, INSERT, UPDATE
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'requests') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public.requests TO authenticated;';
  END IF;

  -- Shift Swap Requests: SELECT, INSERT
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shift_swap_requests') THEN
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public.shift_swap_requests TO authenticated;';
  END IF;

  -- Punches: SELECT, INSERT
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'punches') THEN
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public.punches TO authenticated;';
  END IF;

  -- User Profile & Notifications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications_inbox') THEN
    EXECUTE 'GRANT SELECT, UPDATE, DELETE ON TABLE public.notifications_inbox TO authenticated;';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    EXECUTE 'GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;';
  END IF;
END $$;

-- C. Authoritative Schedule View
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'vw_effective_published_schedules') THEN
    EXECUTE 'GRANT SELECT ON public.vw_effective_published_schedules TO authenticated, service_role;';
  END IF;
END $$;

-- D. Strictly Service-Role Only Tables (Revoke ALL from authenticated)
DO $$
DECLARE
  service_only text[] := ARRAY[
    'cleanup_audit_log',
    'company_employee_number_counters',
    'company_leave_type_sequences',
    'company_request_sequences',
    'webhooks'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY service_only LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated;', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
