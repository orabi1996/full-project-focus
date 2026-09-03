-- ============================================================================
-- Migration: Fix admin roles, employee update policies, and admin employee defaults
-- ============================================================================

-- 1. Ensure is_hr recognizes super_admin
CREATE OR REPLACE FUNCTION public.is_hr(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('org_admin', 'hr_manager', 'super_admin')
  )
$$;

-- 2. Grant super_admin and hr_manager roles to any admin/hr accounts
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users
WHERE lower(email) LIKE '%admin%' OR lower(email) LIKE '%hr%'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'hr_manager'::public.app_role FROM auth.users
WHERE lower(email) LIKE '%admin%' OR lower(email) LIKE '%hr%'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'org_admin'::public.app_role FROM auth.users
WHERE lower(email) LIKE '%admin%' OR lower(email) LIKE '%hr%'
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Fix employees write and update RLS policies
DROP POLICY IF EXISTS "emp_write" ON public.employees;
DROP POLICY IF EXISTS "employees_hr_write" ON public.employees;
DROP POLICY IF EXISTS "employees_self_update" ON public.employees;

CREATE POLICY "emp_write" ON public.employees FOR ALL TO authenticated
  USING (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin') OR user_id = auth.uid())
  WITH CHECK (public.is_hr(auth.uid()) OR public.has_role(auth.uid(), 'super_admin') OR user_id = auth.uid());

-- 4. Update existing admin employee records so they have proper Arabic names and details
UPDATE public.employees
SET full_name = 'أ. عبد العزيز الفهد (مدير النظام)',
    first_name_ar = 'أ. عبد العزيز',
    last_name_ar = 'الفهد (مدير النظام)',
    first_name_en = 'Abdulaziz',
    last_name_en = 'Al-Fahad',
    job_title = 'مدير عام النظام والموارد البشرية',
    basic_salary = CASE WHEN basic_salary = 0 THEN 24000 ELSE basic_salary END,
    total_salary = CASE WHEN total_salary = 0 THEN 31500 ELSE total_salary END,
    completion_score = CASE WHEN completion_score = 0 THEN 95 ELSE completion_score END,
    nationality = COALESCE(NULLIF(nationality, 'غير محدد'), 'سعودي'),
    national_id_or_iqama = COALESCE(NULLIF(national_id_or_iqama, 'غير مسجل'), '1010998877')
WHERE email = 'hr.admin@focus-hrms.sa'
   OR (full_name LIKE '%@%' AND user_id IS NOT NULL);

-- 5. Update handle_new_user to properly initialize admin users in the future
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role := 'employee';
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_job_title text;
  v_basic numeric := 0;
  v_total numeric := 0;
  v_score integer := 25;
BEGIN
  IF lower(NEW.email) LIKE '%admin%' OR lower(NEW.email) LIKE '%hr%' THEN
    v_role := 'super_admin';
    v_full_name := 'أ. عبد العزيز الفهد (مدير النظام)';
    v_first_name := 'أ. عبد العزيز';
    v_last_name := 'الفهد (مدير النظام)';
    v_job_title := 'مدير عام النظام والموارد البشرية';
    v_basic := 24000;
    v_total := 31500;
    v_score := 95;
  ELSE
    v_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(NEW.email, '@', 1));
    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name := COALESCE(NULLIF(substr(v_full_name, length(v_first_name) + 2), ''), '—');
    v_job_title := 'موظف';
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, v_full_name, NEW.email)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role = 'super_admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'hr_manager')
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'org_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  UPDATE public.employees
  SET user_id = NEW.id
  WHERE user_id IS NULL
    AND NEW.email IS NOT NULL
    AND lower(email) = lower(NEW.email);

  IF NOT FOUND THEN
    INSERT INTO public.employees (
      user_id,
      employee_no,
      full_name,
      first_name_ar,
      last_name_ar,
      first_name_en,
      last_name_en,
      email,
      job_title,
      hire_date,
      status,
      basic_salary,
      total_salary,
      completion_score,
      nationality,
      national_id_or_iqama
    )
    VALUES (
      NEW.id,
      'USR-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8)),
      v_full_name,
      v_first_name,
      v_last_name,
      'Abdulaziz',
      'Al-Fahad',
      NEW.email,
      v_job_title,
      CURRENT_DATE,
      'active',
      v_basic,
      v_total,
      v_score,
      'سعودي',
      '1010998877'
    );
  END IF;

  RETURN NEW;
END;
$$;
