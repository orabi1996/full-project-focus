-- Migration: 20260922130000_al_andalus_setup_and_cleanup.sql
-- Description:
-- 1. Create private, isolated backup schema (archive_pre_cleanup_20260922) inaccessible to anon/authenticated roles.
-- 2. Snapshot ALL candidate operational, financial, and organizational data BEFORE any deletion.
-- 3. Idempotent one-time execution: check cleanup_audit_log to prevent deleting newly created live data.
-- 4. Clean up mock/demo data in strict relational order while strictly preserving auth.users and user_roles.
-- 5. Ensure company "الأندلس" exists using only verified schema columns, retaining existing data if already created.
-- 6. Create explicit user_company_access table for verifiable company membership.
-- 7. Enforce employee field protection trigger with strict separation of financial (salary/bank) vs organizational authorities.
-- 8. Enforce user_roles protection trigger preventing privilege self-escalation.

BEGIN;

-- ============================================================================
-- 1. SECURE BACKUP SCHEMA CREATION & PRIVILEGE HARDENING
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS archive_pre_cleanup_20260922;

-- Revoke all access from public, anon, and authenticated users
REVOKE ALL ON SCHEMA archive_pre_cleanup_20260922 FROM public, anon, authenticated;

-- If old public backup tables exist from previous runs, move them to the private schema safely
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '_backup_%_20260922'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive_pre_cleanup_20260922;', r.table_name);
  END LOOP;
END $$;

-- Revoke access on all tables inside the backup schema
REVOKE ALL ON ALL TABLES IN SCHEMA archive_pre_cleanup_20260922 FROM public, anon, authenticated;


-- ============================================================================
-- 2. AUDIT LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cleanup_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  target_entity text NOT NULL,
  backed_up_count integer NOT NULL DEFAULT 0,
  details jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.cleanup_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cleanup_audit_log_read ON public.cleanup_audit_log;
CREATE POLICY cleanup_audit_log_read ON public.cleanup_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'hr_manager')
    )
  );


-- ============================================================================
-- 3. IDEMPOTENT PRE-CLEANUP SNAPSHOT & SAFE CASCADING CLEANUP
-- ============================================================================
DO $$
DECLARE
  v_already_cleaned boolean := false;
  v_count integer;
  v_table text;
  v_tables text[] := ARRAY[
    'candidates', 'job_offers', 'job_openings', 'evaluations', 'evaluation_records',
    'performance_cycles', 'workforce_plans', 'expense_claims', 'expense_categories',
    'settlements', 'loans', 'payroll_details', 'payroll_runs', 'payroll_groups',
    'punches', 'attendance_records', 'overtime_records', 'attendance_corrections',
    'schedule_assignments', 'shifts', 'leave_requests', 'leave_balances', 'leave_types',
    'service_requests', 'requests', 'hardware_assets', 'employee_documents',
    'company_documents', 'employees', 'cost_centers', 'job_positions',
    'departments', 'work_locations', 'subsidiaries', 'companies'
  ];
BEGIN
  -- Check if cleanup was already executed successfully
  SELECT EXISTS (
    SELECT 1 FROM public.cleanup_audit_log 
    WHERE action = 'AL_ANDALUS_INITIAL_CLEANUP_SUCCESS'
  ) INTO v_already_cleaned;

  IF v_already_cleaned THEN
    RAISE NOTICE 'Cleanup was already executed previously. Skipping deletion to preserve operational data.';
  ELSE
    -- A. Snapshot EVERY candidate table into the private backup schema BEFORE any DELETE runs
    FOREACH v_table IN ARRAY v_tables LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = v_table
      ) THEN
        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS archive_pre_cleanup_20260922.%I AS SELECT * FROM public.%I;',
          v_table, v_table
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        
        INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
        VALUES (
          'PRE_CLEANUP_BACKUP',
          v_table,
          v_count,
          jsonb_build_object('schema', 'archive_pre_cleanup_20260922', 'timestamp', now())
        );
      END IF;
    END LOOP;

    -- Ensure all backup tables have permissions revoked
    REVOKE ALL ON ALL TABLES IN SCHEMA archive_pre_cleanup_20260922 FROM public, anon, authenticated;

    -- B. Now execute foreign-key safe deletions of mock operational data
    -- 1. Talent & Recruitment
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_offers') THEN
      DELETE FROM public.job_offers;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'candidates') THEN
      DELETE FROM public.candidates;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_openings') THEN
      DELETE FROM public.job_openings;
    END IF;

    -- 2. Performance & Evaluations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_records') THEN
      DELETE FROM public.evaluation_records;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluations') THEN
      DELETE FROM public.evaluations;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'performance_cycles') THEN
      DELETE FROM public.performance_cycles;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workforce_plans') THEN
      DELETE FROM public.workforce_plans;
    END IF;

    -- 3. Expenses & Loans
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_claims') THEN
      DELETE FROM public.expense_claims;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_categories') THEN
      DELETE FROM public.expense_categories;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
      DELETE FROM public.loans;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settlements') THEN
      DELETE FROM public.settlements;
    END IF;

    -- 4. Payroll
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_details') THEN
      DELETE FROM public.payroll_details;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_runs') THEN
      DELETE FROM public.payroll_runs;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_groups') THEN
      DELETE FROM public.payroll_groups;
    END IF;

    -- 5. Attendance & Time
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_corrections') THEN
      DELETE FROM public.attendance_corrections;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'overtime_records') THEN
      DELETE FROM public.overtime_records;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_records') THEN
      DELETE FROM public.attendance_records;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'punches') THEN
      DELETE FROM public.punches;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedule_assignments') THEN
      DELETE FROM public.schedule_assignments;
    END IF;

    -- 6. Leaves
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests') THEN
      DELETE FROM public.leave_requests;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_balances') THEN
      DELETE FROM public.leave_balances;
    END IF;

    -- 7. Requests, Documents, Assets
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_requests') THEN
      DELETE FROM public.service_requests;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'requests') THEN
      DELETE FROM public.requests;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hardware_assets') THEN
      DELETE FROM public.hardware_assets;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_documents') THEN
      DELETE FROM public.employee_documents;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_documents') THEN
      DELETE FROM public.company_documents;
    END IF;

    -- 8. Employees (Delete mock employees while strictly preserving auth.users & user_roles)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
      DELETE FROM public.employees;
    END IF;

    -- 9. Organization Structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_positions') THEN
      DELETE FROM public.job_positions;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_centers') THEN
      DELETE FROM public.cost_centers;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments') THEN
      DELETE FROM public.departments;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_locations') THEN
      DELETE FROM public.work_locations;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subsidiaries') THEN
      DELETE FROM public.subsidiaries;
    END IF;

    -- 10. Shifts & Leave Types
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shifts') THEN
      DELETE FROM public.shifts;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_types') THEN
      DELETE FROM public.leave_types;
    END IF;

    -- 11. Companies: delete demo companies (preserve Al-Andalus if existing)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
      DELETE FROM public.companies WHERE legal_name_ar != 'الأندلس';
    END IF;

    -- Record overall successful cleanup
    INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count, details)
    VALUES (
      'AL_ANDALUS_INITIAL_CLEANUP_SUCCESS',
      'system',
      0,
      jsonb_build_object(
        'message', 'Initial demo data cleanup completed successfully. Snapshots preserved in archive_pre_cleanup_20260922 schema.',
        'completed_at', now()
      )
    );
  END IF;
END $$;


-- ============================================================================
-- 4. VERIFIED MINIMAL COMPANY «الأندلس» (SCHEMA-COMPATIBLE)
-- ============================================================================
-- Safely add setup_status and updated_at if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'setup_status'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN setup_status text NOT NULL DEFAULT 'incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- Ensure legal_name_en is nullable so we don't fabricate English names
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'legal_name_en' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.companies ALTER COLUMN legal_name_en DROP NOT NULL;
  END IF;
END $$;

-- Insert company «الأندلس» ONLY IF NOT PRESENT.
-- If it already exists, DO NOT overwrite or reset its setup_status or user-entered fields!
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.companies WHERE legal_name_ar = 'الأندلس' OR id = 'a0000000-0000-0000-0000-000000000001'::uuid
  ) THEN
    INSERT INTO public.companies (
      id,
      legal_name_ar,
      currency,
      timezone,
      setup_status,
      created_at
    ) VALUES (
      'a0000000-0000-0000-0000-000000000001'::uuid,
      'الأندلس',
      'SAR',
      'Asia/Riyadh',
      'incomplete',
      now()
    );
  END IF;
END $$;


-- ============================================================================
-- 5. EXPLICIT USER-COMPANY ASSOCIATION (user_company_access)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'revoked')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

-- Read policy: users can read their own association; admins/HR can read all
DROP POLICY IF EXISTS user_company_access_read ON public.user_company_access;
CREATE POLICY user_company_access_read ON public.user_company_access
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'hr_manager', 'org_admin')
    )
  );

-- Management policy: only super_admin can insert/update/delete access
DROP POLICY IF EXISTS user_company_access_write ON public.user_company_access;
CREATE POLICY user_company_access_write ON public.user_company_access
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Seed initial access for all existing users having user_roles so admin access is preserved
DO $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT id INTO v_company_id FROM public.companies WHERE legal_name_ar = 'الأندلس' LIMIT 1;
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.user_company_access (user_id, company_id, status, approved_at)
    SELECT DISTINCT ur.user_id, v_company_id, 'active', now()
    FROM public.user_roles ur
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_company_access uca 
      WHERE uca.user_id = ur.user_id AND uca.company_id = v_company_id
    );
  END IF;
END $$;


-- ============================================================================
-- 6. EMPLOYEE FIELD PROTECTION TRIGGER (FINANCIAL VS HR SEPARATION)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_employee_field_protection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_system boolean := false;
  v_can_manage_finance boolean := false;
  v_can_manage_org boolean := false;
BEGIN
  -- 1. Trust ONLY verified service_role JWT or direct admin/migration session
  IF (COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
    v_is_system := true;
  ELSIF (auth.jwt() IS NULL OR auth.jwt() = '{}'::jsonb) 
        AND session_user IN ('postgres', 'service_role') 
        AND COALESCE(current_setting('role', true), 'none') NOT IN ('authenticated', 'anon') THEN
    v_is_system := true;
  END IF;

  IF v_is_system THEN
    RETURN NEW;
  END IF;

  -- 2. Non-system context requires an authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتعديل بيانات الموظف';
  END IF;

  -- 3. Check role authorities
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'finance_manager')
  ) INTO v_can_manage_finance;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'hr_manager', 'org_admin')
  ) INTO v_can_manage_org;

  -- 4. Check Financial & Banking fields (Requires Finance Authority)
  IF (NEW.basic_salary IS DISTINCT FROM OLD.basic_salary OR
      NEW.total_salary IS DISTINCT FROM OLD.total_salary OR
      NEW.bank_name IS DISTINCT FROM OLD.bank_name OR
      NEW.iban IS DISTINCT FROM OLD.iban) THEN
    IF NOT v_can_manage_finance THEN
      RAISE EXCEPTION 'غير مصرح لك بتعديل البيانات المالية أو البنكية أو الراتب للموظف دون صلاحية الإدارة المالية المعتمدة';
    END IF;
  END IF;

  -- 5. Check Organizational & Status fields (Requires HR/Org Admin Authority)
  IF (NEW.company_id IS DISTINCT FROM OLD.company_id OR
      NEW.user_id IS DISTINCT FROM OLD.user_id OR
      NEW.status IS DISTINCT FROM OLD.status OR
      NEW.job_title IS DISTINCT FROM OLD.job_title OR
      NEW.department_id IS DISTINCT FROM OLD.department_id) THEN
    IF NOT v_can_manage_org THEN
      RAISE EXCEPTION 'غير مصرح لك بتعديل الشركة أو الهيكل التنظيمي أو الحالة الوظيفية للموظف دون صلاحية الموارد البشرية';
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


-- ============================================================================
-- 7. USER_ROLES PRIVILEGE ESCALATION PROTECTION TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_user_roles_protection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin boolean := false;
BEGIN
  -- Allow internal migration / service_role
  IF (COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
    RETURN COALESCE(NEW, OLD);
  ELSIF (auth.jwt() IS NULL OR auth.jwt() = '{}'::jsonb) 
        AND session_user IN ('postgres', 'service_role') 
        AND COALESCE(current_setting('role', true), 'none') NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول للتعامل مع أدوار المستخدمين';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) INTO v_is_super_admin;

  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'غير مصرح: فقط المسؤول العام (super_admin) يملك صلاحية منح أو تعديل أدوار المستخدمين';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_roles_protection ON public.user_roles;
CREATE TRIGGER trg_enforce_user_roles_protection
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_roles_protection();

COMMIT;
