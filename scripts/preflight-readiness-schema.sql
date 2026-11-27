-- Catalog-only compatibility check before applying migrations 20261127100000–20261127180000.
-- Run as the migration role. A missing item needs reconciliation before replay.
-- Presence alone does not verify function bodies, permissions, data, or migration history.
WITH required_functions(signature) AS (
  VALUES
    ('public.get_expense_kpis_atomic(uuid)'),
    ('public.get_performance_kpis_atomic(uuid, uuid)'),
    ('public.create_employee(text, text, text, text, text, text, text, text, text, date, text, date, text, text, uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, text, text, text, uuid)'),
    ('public.prepare_reimbursement_batch_atomic(text, uuid[], text, uuid, text, text)'),
    ('public.calculate_payroll_run_atomic(uuid)'),
    ('public.approve_payroll_run_atomic(uuid, text)'),
    ('public.validate_payroll_wps_export(uuid)'),
    ('public.calculate_final_settlement_atomic(uuid, date, text, integer)'),
    ('public.create_final_settlement_atomic(jsonb)'),
    ('public.get_authenticated_employee_context(uuid)'),
    ('public.get_manager_team_summary(uuid)'),
    ('public.get_manager_team_members(uuid)'),
    ('public.launch_performance_cycle_atomic(uuid, uuid[])'),
    ('public.process_company_attendance_range(date, date, uuid)'),
    ('public.get_payroll_kpis(uuid)'),
    ('public.get_workflow_kpis(uuid)'),
    ('public.process_attendance_day(uuid, date)'),
    ('auth.uid()'),
    ('auth.role()'),
    ('public.current_user_has_any_role(text[])'),
    ('public.get_effective_company_timezone(uuid)')
), required_relations(relation_name, columns) AS (
  VALUES
    ('auth.users', ARRAY['id', 'email', 'email_confirmed_at']),
    ('public.companies', ARRAY['id']),
    ('public.employees', ARRAY['id', 'user_id', 'company_id', 'status', 'email', 'custom_fields', 'manager_id', 'manager_employee_id']),
    ('public.user_company_access', ARRAY['user_id', 'company_id', 'status']),
    ('public.user_roles', ARRAY['user_id', 'role']),
    ('public.performance_cycles', ARRAY['id', 'company_id', 'status']),
    ('public.vw_effective_published_schedules', ARRAY['assignment_id', 'company_id', 'employee_id', 'work_date', 'start_time', 'end_time', 'is_overnight']),
    ('public.schedule_assignments', ARRAY['id', 'employee_id', 'work_date']),
    ('public.expense_claims', ARRAY['id', 'company_id']),
    ('public.reimbursement_batches', ARRAY['company_id', 'idempotency_key']),
    ('public.payroll_runs', ARRAY['id', 'company_id']),
    ('public.employee_profile_change_requests', ARRAY['employee_id', 'company_id']),
    ('public.attendance_records', ARRAY['employee_id', 'company_id']),
    ('public.punches', ARRAY['employee_id', 'company_id'])
), checks(kind, object_name, present) AS (
  SELECT 'function', signature, pg_catalog.to_regprocedure(signature) IS NOT NULL
  FROM required_functions
  UNION ALL
  SELECT 'type', 'public.app_role', pg_catalog.to_regtype('public.app_role') IS NOT NULL
  UNION ALL
  SELECT 'function', 'public.has_role(uuid, public.app_role)',
    CASE WHEN pg_catalog.to_regtype('public.app_role') IS NOT NULL
      THEN pg_catalog.to_regprocedure('public.has_role(uuid, public.app_role)') IS NOT NULL
      ELSE false END
  UNION ALL
  SELECT 'relation', relation_name, pg_catalog.to_regclass(relation_name) IS NOT NULL
  FROM required_relations
  UNION ALL
  SELECT 'column', relation_name || '.' || column_name, EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = pg_catalog.to_regclass(relation_name)
      AND a.attname = column_name AND a.attnum > 0 AND NOT a.attisdropped
  )
  FROM required_relations CROSS JOIN LATERAL unnest(columns) AS c(column_name)
)
SELECT kind, object_name, CASE WHEN present THEN 'present' ELSE 'missing' END AS status
FROM checks
ORDER BY present, kind, object_name;
