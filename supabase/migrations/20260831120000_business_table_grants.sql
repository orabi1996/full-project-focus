-- PostgREST roles need table privileges in addition to RLS policies.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'user_roles', 'departments', 'employees', 'attendance_records', 'requests',
    'companies', 'subsidiaries', 'work_locations', 'shifts', 'schedule_assignments', 'punches',
    'leave_types', 'leave_balances', 'payroll_groups', 'payroll_runs', 'payroll_details',
    'salary_profiles', 'loans', 'settlements', 'expense_categories', 'expense_claims',
    'expense_reports', 'job_openings', 'candidates', 'job_offers', 'hardware_assets',
    'asset_assignments', 'company_documents', 'employee_documents',
    'document_acknowledgements', 'role_definitions', 'user_role_assignments',
    'app_permissions', 'role_permissions', 'approval_chains', 'request_timeline', 'holidays',
    'attendance_devices', 'performance_cycles', 'evaluation_records', 'workforce_plans',
    'accounting_journals', 'integration_connections', 'webhooks', 'audit_events',
    'notifications_inbox'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
        table_name
      );
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
    END IF;
  END LOOP;
END
$$;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Keep future HR tables private unless a migration grants access deliberately.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
