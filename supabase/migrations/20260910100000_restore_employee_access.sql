-- Restore least-privilege onboarding. Email addresses and user-controlled
-- metadata are identity/display data, never authorization decisions.
-- Existing assignments and employee records require an owner-reviewed audit;
-- this migration intentionally does not revoke roles or rewrite HR data.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_full_name text := trim(coalesce(NEW.raw_user_meta_data ->> 'full_name', ''));
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, v_full_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Never claim an existing employee solely from an unverified signup email.
  -- HR must explicitly link an existing employee through a trusted admin flow.
  IF NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE user_id = NEW.id
       OR (NEW.email IS NOT NULL AND lower(email) = lower(NEW.email))
  ) THEN
    INSERT INTO public.employees (user_id, employee_no, full_name, email)
    VALUES (NEW.id, 'USR-' || replace(NEW.id::text, '-', ''), v_full_name, NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS emp_write ON public.employees;
DROP POLICY IF EXISTS employees_hr_write ON public.employees;
DROP POLICY IF EXISTS employees_self_update ON public.employees;
CREATE POLICY employees_hr_write ON public.employees
  FOR ALL TO authenticated
  USING (public.is_hr(auth.uid()))
  WITH CHECK (public.is_hr(auth.uid()));

-- Restrictive policies prevent a separate permissive owner policy from
-- granting write access to salary, employment status or identity bindings.
CREATE POLICY employees_insert_hr_only ON public.employees AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY employees_update_hr_only ON public.employees AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY employees_delete_hr_only ON public.employees AS RESTRICTIVE
  FOR DELETE TO authenticated USING (public.is_hr(auth.uid()));
