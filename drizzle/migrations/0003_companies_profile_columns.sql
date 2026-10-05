ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'limited_liability',
  ADD COLUMN IF NOT EXISTS unified_number text,
  ADD COLUMN IF NOT EXISTS gosi_number text,
  ADD COLUMN IF NOT EXISTS labor_office_number text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'SA',
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS setup_status text DEFAULT 'incomplete';
NOTIFY pgrst, 'reload schema';