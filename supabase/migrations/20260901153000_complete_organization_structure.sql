-- Complete establishment and organization-structure master data (M02).
-- Safe to run on projects that already contain the original enterprise tables.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'limited_liability',
  ADD COLUMN IF NOT EXISTS unified_number text,
  ADD COLUMN IF NOT EXISTS gosi_number text,
  ADD COLUMN IF NOT EXISTS labor_office_number text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'المملكة العربية السعودية',
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS companies_code_unique
  ON public.companies (code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS companies_unified_number_unique
  ON public.companies (unified_number) WHERE unified_number IS NOT NULL;

ALTER TABLE public.subsidiaries
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS unified_number text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.work_locations
  ADD COLUMN IF NOT EXISTS subsidiary_id uuid REFERENCES public.subsidiaries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_type text NOT NULL DEFAULT 'branch',
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'المملكة العربية السعودية',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  annual_budget numeric(16,2) NOT NULL DEFAULT 0 CHECK (annual_budget >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS subsidiary_id uuid REFERENCES public.subsidiaries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description_ar text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.job_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subsidiary_id uuid REFERENCES public.subsidiaries(id) ON DELETE SET NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  reports_to_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  grade text,
  employment_type text NOT NULL DEFAULT 'full_time',
  planned_headcount integer NOT NULL DEFAULT 1 CHECK (planned_headcount >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS departments_parent_id_idx ON public.departments(parent_id);
CREATE INDEX IF NOT EXISTS departments_subsidiary_id_idx ON public.departments(subsidiary_id);
CREATE INDEX IF NOT EXISTS departments_cost_center_id_idx ON public.departments(cost_center_id);
CREATE INDEX IF NOT EXISTS work_locations_subsidiary_id_idx ON public.work_locations(subsidiary_id);
CREATE INDEX IF NOT EXISTS job_positions_department_id_idx ON public.job_positions(department_id);
CREATE INDEX IF NOT EXISTS job_positions_reports_to_idx ON public.job_positions(reports_to_position_id);
CREATE INDEX IF NOT EXISTS employees_job_position_id_idx ON public.employees(job_position_id);

CREATE OR REPLACE FUNCTION public.prevent_department_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cycle_found boolean;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A department cannot be its own parent';
  END IF;

  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id FROM public.departments WHERE id = NEW.parent_id
    UNION ALL
    SELECT d.id, d.parent_id
    FROM public.departments d
    JOIN ancestors a ON d.id = a.parent_id
  )
  SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id) INTO cycle_found;

  IF cycle_found THEN
    RAISE EXCEPTION 'The selected parent creates an organization cycle';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS departments_prevent_cycle ON public.departments;
CREATE TRIGGER departments_prevent_cycle
  BEFORE INSERT OR UPDATE OF parent_id ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_department_cycle();

CREATE OR REPLACE FUNCTION public.set_organization_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_set_updated_at ON public.companies;
CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_updated_at();
DROP TRIGGER IF EXISTS subsidiaries_set_updated_at ON public.subsidiaries;
CREATE TRIGGER subsidiaries_set_updated_at BEFORE UPDATE ON public.subsidiaries
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_updated_at();
DROP TRIGGER IF EXISTS work_locations_set_updated_at ON public.work_locations;
CREATE TRIGGER work_locations_set_updated_at BEFORE UPDATE ON public.work_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_updated_at();
DROP TRIGGER IF EXISTS departments_set_updated_at ON public.departments;
CREATE TRIGGER departments_set_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_updated_at();
DROP TRIGGER IF EXISTS cost_centers_set_updated_at ON public.cost_centers;
CREATE TRIGGER cost_centers_set_updated_at BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_updated_at();
DROP TRIGGER IF EXISTS job_positions_set_updated_at ON public.job_positions;
CREATE TRIGGER job_positions_set_updated_at BEFORE UPDATE ON public.job_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_updated_at();

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cost_centers_read" ON public.cost_centers;
CREATE POLICY "cost_centers_read" ON public.cost_centers
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cost_centers_hr_write" ON public.cost_centers;
CREATE POLICY "cost_centers_hr_write" ON public.cost_centers
  FOR ALL TO authenticated
  USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());

DROP POLICY IF EXISTS "job_positions_read" ON public.job_positions;
CREATE POLICY "job_positions_read" ON public.job_positions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "job_positions_hr_write" ON public.job_positions;
CREATE POLICY "job_positions_hr_write" ON public.job_positions
  FOR ALL TO authenticated
  USING (public.current_user_is_hr())
  WITH CHECK (public.current_user_is_hr());

REVOKE ALL ON public.cost_centers, public.job_positions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers, public.job_positions TO authenticated;
GRANT ALL ON public.cost_centers, public.job_positions TO service_role;
