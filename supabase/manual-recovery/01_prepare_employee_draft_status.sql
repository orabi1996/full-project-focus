-- Run in the existing Lovable Cloud SQL Editor.
-- Additive prerequisite only: no employee rows or defaults are changed.
-- Commit before any later script inserts an employee with this new enum value.
BEGIN;
ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'draft';
COMMIT;

SELECT e.enumlabel AS employee_status
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname = 'employee_status'
ORDER BY e.enumsortorder;
