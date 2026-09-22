-- Read-only. No names, emails, user identifiers or employee records are exported.
SELECT
  'function' AS section,
  n.nspname || '.' || p.proname AS object_name,
  pg_get_functiondef(p.oid) AS details
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind = 'f'
  AND (n.nspname = 'private_sec'
       OR (n.nspname = 'auth' AND p.proname = 'current_company_id'))

UNION ALL

SELECT 'enum', 'employee_status', string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname = 'employee_status'

UNION ALL

SELECT 'role_count', role::text, count(*)::text
FROM public.user_roles
GROUP BY role

UNION ALL

SELECT 'organization', 'company_count', count(*)::text FROM public.companies

UNION ALL

SELECT 'organization', 'departments_without_company', count(*)::text
FROM public.departments WHERE company_id IS NULL

UNION ALL

SELECT 'organization', 'work_locations_without_company', count(*)::text
FROM public.work_locations WHERE company_id IS NULL

ORDER BY section, object_name;
