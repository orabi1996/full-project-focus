-- ============================================================================
-- Migration: Grant EXECUTE permissions on is_hr and has_role security functions
-- Resolves "permission denied for function is_hr" error in RLS policies
-- ============================================================================

-- 1. Ensure public.is_hr exists and is SECURITY DEFINER with public search path
CREATE OR REPLACE FUNCTION public.is_hr(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('org_admin', 'hr_manager', 'super_admin')
  );
$$;

-- 2. Ensure public.has_role exists and is SECURITY DEFINER with public search path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 3. Grant execute to authenticated users and service_role so RLS policies can evaluate them
GRANT EXECUTE ON FUNCTION public.is_hr(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
