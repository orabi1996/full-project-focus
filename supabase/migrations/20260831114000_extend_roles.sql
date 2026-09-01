-- Extend the database role catalog to match the roles exposed by the HRMS.
-- Kept in its own migration because PostgreSQL enum values must be committed
-- before later migrations reference them in policies and functions.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'payroll_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'attendance_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'recruiter';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'performance_lead';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
