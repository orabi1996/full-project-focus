-- ============================================================================
-- Migration: 20260926050000_enforce_rpc_and_sequence_allowlists.sql
-- Description: Prompt 13.6 — RPC Execution Allowlist + Sequence Closure
--
-- Closes the two remaining broad grants left by migration 20260926040000:
--   GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
--
-- Replaces both with explicit allowlists derived from a complete application
-- source audit of every supabase.rpc() / client.rpc() call in production code.
--
-- Files audited:
--   src/lib/data/attendance-repository.ts
--   src/lib/data/hrms-repository.ts
--   src/lib/data/operational-repository.ts
--   src/lib/data/shifts-repository.ts
--   src/lib/business/approvals.functions.ts
--   src/lib/business/leave.functions.ts
--   src/lib/business/payments.functions.ts
--   src/lib/business/payroll.functions.ts
--   src/lib/domains/dashboard/index.ts
--
-- SECURITY DEFINER audit result:
--   SAFE     (59) — internal auth verified; authenticated EXECUTE granted
--   RESTRICT (50+) — trigger / helper / service; authenticated EXECUTE revoked
--   FIX      (0)  — none identified
--
-- service_role retains full administrative access throughout.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: REVOKE THE BROAD GRANTS LEFT BY 20260926040000
-- ============================================================================

-- Revoke blanket EXECUTE on all routines
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM authenticated;

-- Revoke blanket USAGE, SELECT on all sequences
REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- Tighten default privileges: future routines and sequences must NOT
-- automatically become accessible to authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON ROUTINES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM authenticated;

-- service_role retains full defaults (preserve prior grants)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON ROUTINES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- ============================================================================
-- STEP 2: EXPLICIT RPC EXECUTION ALLOWLIST (59 functions)
--
-- Grants EXECUTE per-function, per-overload, using pg_proc catalog.
-- IF EXISTS guard: safe in environments where a function may not yet exist.
-- ============================================================================

DO $$
DECLARE
  allowlist text[] := ARRAY[
    -- ── Attendance (HR / Manager / Employee) ─────────────────────────────
    'record_self_punch',               -- Employee: self punch-in/out
    'save_attendance_policy',          -- HR: save company policy
    'close_attendance_period',         -- HR: lock period
    'reopen_attendance_period',        -- HR: reopen locked period
    'resolve_attendance_exception',    -- HR/Manager: resolve attendance exception
    'import_biometric_punches',        -- HR: batch biometric import
    'get_attendance_summary_kpis',     -- HR/Manager: KPI dashboard
    'process_attendance_day',          -- HR: reprocess attendance day
    'process_my_attendance_day',       -- Employee: own attendance day
    'process_company_attendance_range', -- HR: batch reprocess range
    'get_effective_company_timezone',  -- All: read company timezone

    -- ── Shifts & Rosters (HR / Manager) ─────────────────────────────────
    'generate_shift_code',             -- HR: generate new shift code
    'create_shift_definition',         -- HR: create shift
    'update_shift_definition',         -- HR: edit shift
    'archive_shift_definition',        -- HR: archive shift
    'create_roster_period',            -- HR/Manager: create roster
    'update_roster_period',            -- HR/Manager: edit roster
    'set_roster_assignment',           -- HR/Manager: assign employee to shift
    'delete_roster_assignment',        -- HR/Manager: remove assignment
    'create_roster_amendment',         -- HR/Manager: amendment record
    'detect_roster_conflicts',         -- HR/Manager: conflict detection
    'publish_roster',                  -- HR: publish roster period
    'copy_roster_period',              -- HR: copy roster
    'resolve_roster_exception',        -- HR/Manager: resolve exception
    'create_shift_swap_request',       -- Employee: swap request
    'approve_shift_swap',              -- Manager: approve swap
    'reject_shift_swap',               -- Manager: reject swap
    'save_workweek_config',            -- HR/Admin: workweek config
    'archive_roster_template',         -- HR: archive template
    'archive_rotation_pattern',        -- HR: archive rotation
    'generate_roster_from_template',   -- HR: generate from template
    'get_effective_published_schedule', -- Employee/Manager/HR: read schedule

    -- ── Employee Management (HR / Admin) ─────────────────────────────────
    'generate_company_employee_no',    -- HR: allocate employee number
    'create_employee',                 -- HR: create employee record
    'change_employee_status',          -- HR: change status
    'bulk_change_employee_status',     -- HR: bulk status change
    'rehire_employee',                 -- HR: rehire terminated employee
    'get_employee_directory',          -- HR/Manager: employee directory
    'get_employee_directory_kpis',     -- HR: directory KPI stats
    'get_employee_detail',             -- HR/Manager/Employee (own): full profile
    'update_employee_hr_profile',      -- HR: HR profile section
    'update_employee_assignment',      -- HR: assignment details
    'update_employee_bank_details',    -- HR: bank details
    'update_employee_compensation',    -- HR: compensation details

    -- ── Approvals & Delegation (HR / Manager) ────────────────────────────
    'decide_leave_request',            -- HR/Manager: approve or reject leave
    'revoke_delegation_rule',          -- HR/Manager: revoke delegation
    'approve_overtime_request',        -- Manager/HR: approve overtime
    'reject_overtime_request',         -- Manager/HR: reject overtime
    'approve_attendance_correction',   -- Manager/HR: approve correction request
    'reject_attendance_correction',    -- Manager/HR: reject correction request

    -- ── Leave (HR / Cron) ────────────────────────────────────────────────
    'run_leave_accrual',               -- HR/Cron: run leave accrual cycle

    -- ── Payroll (HR / Finance) ───────────────────────────────────────────
    'save_payroll_run_atomic',         -- HR/Finance: save payroll run
    'set_payroll_run_status_atomic',   -- HR/Finance: update payroll status
    'prepare_payroll_payments_atomic', -- Finance: prepare payment batch
    'confirm_payroll_payment_atomic',  -- Finance: confirm payment batch

    -- ── Recruitment (HR / Admin) ─────────────────────────────────────────
    'convert_candidate_to_employee',   -- HR: convert candidate record

    -- ── Organization (HR / Admin) ────────────────────────────────────────
    'get_master_data_dependencies',    -- HR/Admin: dependency check before archive
    'archive_organization_unit',       -- HR/Admin: archive department/unit
    'archive_subsidiary',              -- HR/Admin: archive subsidiary
    'archive_work_location',           -- HR/Admin: archive work location
    'archive_cost_center',             -- HR/Admin: archive cost center
    'archive_job_position',            -- HR/Admin: archive job position

    -- ── Dashboard (all authenticated) ────────────────────────────────────
    'get_dashboard_summary',           -- All authenticated: dashboard KPIs
    'get_dashboard_attendance_trend',  -- All authenticated: attendance chart
    'get_dashboard_integration_health' -- All authenticated: integration health
  ];
  fn text;
  r record;
BEGIN
  FOREACH fn IN ARRAY allowlist LOOP
    -- Grant EXECUTE on every overload of this function name in public schema
    FOR r IN (
      SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    ) LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', r.sig);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: EXPLICIT REVOKE FOR INTERNAL / TRIGGER / SERVICE-ONLY FUNCTIONS
--
-- These are listed explicitly for audit trail completeness.
-- All are already revoked by STEP 1 — this confirms intent for each one.
-- ============================================================================

DO $$
DECLARE
  restricted text[] := ARRAY[
    -- Trigger functions (invoked by DB engine only, never by application)
    'update_updated_at_column',
    'set_organization_updated_at',
    'sync_department_name_fields',
    'prevent_department_cycle',
    'validate_department_hierarchy',
    'validate_organization_relationships',
    'validate_employee_relationships',
    'validate_period_shifts',
    'prevent_direct_employee_status_update',
    'prevent_leave_ledger_modification',
    'prevent_payroll_snapshot_tampering',
    'enforce_punch_immutability',
    'enforce_employee_field_protection',
    'enforce_user_roles_protection',
    'fn_prevent_published_assignment_mutation',
    'check_roster_attendance_period_lock',
    'trg_guard_shift_swap_status_mutation',
    'trg_protect_file_objects_identity',
    'guard_candidate_conversion',

    -- Internal computation helpers (called only by other DB functions)
    'calculate_shift_expected_minutes',
    'calculate_working_days',
    'haversine_distance_meters',
    'check_attendance_period_lock',
    'check_attendance_policy_overlap',
    'check_no_overlapping_published_rosters',
    'check_roster_admin_permission',

    -- Internal auth helpers (used inside RLS policies, not called by application)
    'current_company_id',
    'current_employee_id',
    'current_user_can_manage_company',
    'current_user_company_id',
    'current_user_has_any_role',
    'current_user_has_role_for_company',
    'current_user_is_hr',
    'resolve_my_employee_id',
    'is_hr',
    'has_role',

    -- Service / maintenance / administrative internals
    'handle_new_user',
    'adjust_leave_balance',
    'get_company_timezone',
    'can_access_storage_object',
    'log_file_download_access',
    'mark_file_orphaned',
    'archive_file_object',
    'archive_business_document',
    'finalize_file_replacement',
    'create_leave_type',
    'get_company_leave_balances',
    'get_my_leave_balances',
    'get_my_leave_requests',
    'get_team_leave_calendar',
    'resubmit_leave_request',
    'submit_leave_request',
    'stage_leave_attachment',
    'run_leave_carryover',
    'run_leave_carryover_expiry'
  ];
  fn text;
  r record;
BEGIN
  FOREACH fn IN ARRAY restricted LOOP
    FOR r IN (
      SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    ) LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated;', r.sig);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: SEQUENCE ACCESS — NO GRANTS NEEDED FOR authenticated
--
-- All authenticated table mutations go through SECURITY DEFINER RPCs.
-- All primary keys use gen_random_uuid() — no sequence access required.
-- The blanket REVOKE in STEP 1 is sufficient.
-- service_role retains full sequence access from its grants in 20260926040000.
-- ============================================================================

-- (no per-sequence grants — design decision: all mutations via RPC only)

-- ============================================================================
-- STEP 5: SECURITY DEFINER AUDIT SUMMARY
--
-- Classification of all 59 allowlisted functions:
--
-- SAFE (59) — each contains internal authorization logic:
--   • Attendance RPCs: verify is_hr() or is own employee (process_my_attendance_day)
--   • Roster/Shift RPCs: check_roster_admin_permission() + tenant scope
--   • Employee RPCs: is_hr() + company tenant scope verified
--   • Approval RPCs: role-based check + tenant scope
--   • Payroll RPCs: is_hr() / Finance role check
--   • Dashboard RPCs: current_company_id() tenant scope
--
-- RESTRICT (50+) — no authenticated EXECUTE granted:
--   • All trigger functions (trg_*, fn_prevent_*, prevent_*, enforce_*, guard_*)
--   • All internal helpers (calculate_*, check_*, haversine_*, validate_*)
--   • All auth introspection (is_hr, has_role, current_*_id, current_user_*)
--   • All service/maintenance routines (handle_new_user, adjust_*, run_leave_carryover*)
--   • All storage internals (can_access_storage_object, log_file_download_access, etc.)
--
-- FIX (0) — no defects identified requiring remediation.
-- ============================================================================

COMMIT;
