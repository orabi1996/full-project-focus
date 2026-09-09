-- PART 18 / TEN-001. Additive foundation: no legacy company ownership is inferred.
-- Application users can only read their own currently effective memberships.
-- Provisioning is an operator/server responsibility until an audited invite
-- command is implemented. Never grant membership writes through the browser.

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
  legal_name text NOT NULL CHECK (length(btrim(legal_name)) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'setup_incomplete'
    CHECK (status IN ('setup_incomplete', 'active', 'suspended', 'archived')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((status = 'archived') = (archived_at IS NOT NULL))
);

CREATE TABLE public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, id),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX tenant_memberships_active_user_idx
  ON public.tenant_memberships (user_id, tenant_id)
  WHERE status = 'active' AND archived_at IS NULL;

CREATE TABLE public.tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE RESTRICT,
  locale text NOT NULL CHECK (locale IN ('ar', 'en')),
  timezone text NOT NULL CHECK (length(timezone) BETWEEN 1 AND 100),
  -- Format only: country/currency eligibility belongs to the reviewed policy.
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (tenant_id, id)
);

CREATE FUNCTION public.validate_tenant_settings_timezone()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Unsupported tenant timezone' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_tenant_settings_timezone() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_tenant_settings_timezone
  BEFORE INSERT OR UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_settings_timezone();

CREATE FUNCTION public.touch_tenant_registry_record()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_tenant_registry_record() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER touch_tenants BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenant_registry_record();
CREATE TRIGGER touch_tenant_memberships BEFORE UPDATE ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenant_registry_record();
CREATE TRIGGER touch_tenant_settings BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenant_registry_record();

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings FORCE ROW LEVEL SECURITY;

-- Revoke inherited Supabase grants as well as setting RLS; no write policy or
-- browser RPC can create/upgrade a membership in this delivery.
REVOKE ALL ON public.tenants, public.tenant_memberships, public.tenant_settings
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tenants, public.tenant_memberships, public.tenant_settings
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants, public.tenant_memberships,
  public.tenant_settings TO service_role;

-- Non-recursive policy graph: settings -> tenants -> own memberships.
-- Own membership metadata remains readable for a suspended tenant, but tenant
-- and settings rows (and the /me inner join) are unavailable immediately.
CREATE POLICY tenant_memberships_read_own_effective
  ON public.tenant_memberships FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND status = 'active'
    AND archived_at IS NULL
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY tenants_read_effective_member
  ON public.tenants FOR SELECT TO authenticated
  USING (
    status IN ('setup_incomplete', 'active') AND archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = tenants.id
    )
  );

CREATE POLICY tenant_settings_read_effective_member
  ON public.tenant_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_settings.tenant_id));

COMMENT ON TABLE public.tenant_memberships IS
  'Canonical physical name for memberships in PART 10. Does not grant legacy HR permissions.';
