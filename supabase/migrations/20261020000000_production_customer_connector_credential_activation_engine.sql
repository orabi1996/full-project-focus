-- ============================================================================
-- MADARX ENTERPRISE WORKFORCE PLATFORM
-- PROMPT 38: CUSTOMER CREDENTIAL ONBOARDING, CONNECTOR ACTIVATION &
--            LIVE INTEGRATION OPERATIONS ENGINE
-- Migration: 20261020000000_production_customer_connector_credential_activation_engine.sql
-- Append-Only Production Migration
-- ============================================================================

-- 1. TENANT PROVIDER CONNECTIONS (AUTHORITATIVE CUSTOMER CONNECTOR ACCOUNTS)
CREATE TABLE IF NOT EXISTS public.tenant_provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL CHECK (country_code IN ('EG', 'SA', 'QA', 'OM', 'BH')),
  provider_code TEXT NOT NULL CHECK (provider_code IN (
    'GOSI', 'MUDAD', 'QIWA', 'MUQEEM',
    'NOSI', 'ETA',
    'GRSIA', 'MADLSA',
    'SPF', 'CBO',
    'SIO', 'LMRA'
  )),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN (
    'sandbox',
    'test',
    'staging',
    'production'
  )),
  connection_status TEXT NOT NULL DEFAULT 'WAITING_FOR_CUSTOMER_CREDENTIALS' CHECK (connection_status IN (
    'WAITING_FOR_CUSTOMER_CREDENTIALS',
    'NOT_CONFIGURED',
    'CONFIGURATION_INCOMPLETE',
    'READY_FOR_VERIFICATION',
    'VERIFIED',
    'AUTHENTICATION_FAILED',
    'PROVIDER_UNAVAILABLE',
    'NETWORK_ERROR',
    'CERTIFICATE_INVALID',
    'CONFIGURATION_ERROR',
    'NOT_SUPPORTED',
    'RATE_LIMITED'
  )),
  credential_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (credential_status IN (
    'not_configured',
    'configured',
    'replacement_pending',
    'verified',
    'activated',
    'expiring_soon',
    'expired',
    'retired',
    'compromised'
  )),
  activation_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (activation_status IN (
    'not_configured',
    'configuring',
    'verification_required',
    'verified',
    'approval_required',
    'active',
    'suspended',
    'expired',
    'failed',
    'disabled'
  )),
  health_state TEXT NOT NULL DEFAULT 'not_configured' CHECK (health_state IN (
    'healthy',
    'degraded',
    'action_required',
    'offline',
    'suspended',
    'not_configured'
  )),
  go_live_status TEXT NOT NULL DEFAULT 'CUSTOMER_ACTION_REQUIRED' CHECK (go_live_status IN (
    'NOT_READY',
    'CONFIGURATION_REQUIRED',
    'CUSTOMER_ACTION_REQUIRED',
    'VERIFICATION_REQUIRED',
    'READY_FOR_ACTIVATION',
    'ACTIVE',
    'ACTION_REQUIRED'
  )),
  readiness_score INTEGER NOT NULL DEFAULT 0 CHECK (readiness_score >= 0 AND readiness_score <= 100),
  establishment_identifier TEXT NULL,
  tax_identifier TEXT NULL,
  payroll_registration_number TEXT NULL,
  callback_url TEXT NULL,
  suspension_reason TEXT NULL,
  consecutive_auth_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_auth_failures >= 0),
  workflow_approval_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (workflow_approval_status IN (
    'not_requested',
    'pending_hr_payroll',
    'pending_security_it',
    'approved',
    'rejected'
  )),
  last_verified_at TIMESTAMPTZ NULL,
  last_success_at TIMESTAMPTZ NULL,
  last_failure_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  approved_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_provider_conn_env UNIQUE (company_id, country_code, provider_code, environment)
);

CREATE INDEX IF NOT EXISTS idx_tenant_provider_connections_company_status
  ON public.tenant_provider_connections(company_id, activation_status, health_state);

-- 2. PROVIDER CREDENTIAL METADATA (NEVER STORES RAW SECRET VALUES)
CREATE TABLE IF NOT EXISTS public.provider_credential_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.tenant_provider_connections(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL CHECK (provider_code IN (
    'GOSI', 'MUDAD', 'QIWA', 'MUQEEM',
    'NOSI', 'ETA',
    'GRSIA', 'MADLSA',
    'SPF', 'CBO',
    'SIO', 'LMRA'
  )),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'test', 'staging', 'production')),
  credential_type TEXT NOT NULL CHECK (credential_type IN (
    'oauth_client_id',
    'oauth_client_secret',
    'api_key',
    'x509_certificate',
    'private_key_ref',
    'portal_username_ref',
    'portal_password_ref',
    'tenant_customer_identifier',
    'establishment_identifier',
    'provider_account_identifier'
  )),
  -- Only external vault/environment reference is stored (never raw secrets)
  secret_reference TEXT NOT NULL,
  key_identifier TEXT NOT NULL,
  masked_key_suffix TEXT NOT NULL DEFAULT '****',
  oauth_token_endpoint TEXT NULL,
  oauth_scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  oauth_token_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (oauth_token_status IN (
    'not_requested',
    'valid',
    'refreshing',
    'expired',
    'revoked',
    'failed'
  )),
  oauth_token_expires_at TIMESTAMPTZ NULL,
  rotation_state TEXT NOT NULL DEFAULT 'current' CHECK (rotation_state IN (
    'current',
    'replacement_pending',
    'verified',
    'activated',
    'retired'
  )),
  expires_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'configured' CHECK (status IN (
    'configured',
    'verified',
    'expiring_soon',
    'expired',
    'revoked'
  )),
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_credential_meta_conn
  ON public.provider_credential_metadata(company_id, connection_id, rotation_state);

-- 3. PROVIDER X.509 CERTIFICATE METADATA & ROTATION LEDGER
CREATE TABLE IF NOT EXISTS public.provider_certificate_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.tenant_provider_connections(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL CHECK (provider_code IN (
    'GOSI', 'MUDAD', 'QIWA', 'MUQEEM',
    'NOSI', 'ETA',
    'GRSIA', 'MADLSA',
    'SPF', 'CBO',
    'SIO', 'LMRA'
  )),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'test', 'staging', 'production')),
  certificate_role TEXT NOT NULL DEFAULT 'active' CHECK (certificate_role IN (
    'active',
    'standby_replacement',
    'historical_retired'
  )),
  subject TEXT NOT NULL,
  issuer TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  fingerprint_sha256 TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'RSA-2048' CHECK (algorithm IN (
    'RSA-2048',
    'RSA-4096',
    'ECDSA-P256',
    'ECDSA-P384'
  )),
  private_key_secret_ref TEXT NOT NULL,
  private_key_compatible BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL,
  expiry_warning_state TEXT NOT NULL DEFAULT 'valid' CHECK (expiry_warning_state IN (
    'valid',
    'expiring_90d',
    'expiring_60d',
    'expiring_30d',
    'expiring_14d',
    'expiring_7d',
    'expired'
  )),
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN (
    'pending_validation',
    'valid',
    'expiring_soon',
    'expired',
    'revoked',
    'rotated'
  )),
  uploaded_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_cert_meta_conn
  ON public.provider_certificate_metadata(company_id, connection_id, certificate_role);

-- 4. CONNECTOR VERIFICATION & PRE-FLIGHT EVIDENCE RUNS
CREATE TABLE IF NOT EXISTS public.connector_verification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.tenant_provider_connections(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'test', 'staging', 'production')),
  verification_type TEXT NOT NULL CHECK (verification_type IN (
    'preflight',
    'connection_test',
    'certificate_validation',
    'oauth_handshake',
    'callback_verification'
  )),
  result_status TEXT NOT NULL CHECK (result_status IN (
    'PASS',
    'WARNING',
    'FAIL',
    'VERIFIED',
    'WAITING_FOR_CUSTOMER_CREDENTIALS',
    'AUTHENTICATION_FAILED',
    'PROVIDER_UNAVAILABLE',
    'NETWORK_ERROR',
    'CERTIFICATE_INVALID',
    'CONFIGURATION_ERROR',
    'NOT_SUPPORTED',
    'RATE_LIMITED'
  )),
  response_category TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  checks_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  actionable_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  executed_by UUID NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connector_verification_runs_conn
  ON public.connector_verification_runs(company_id, connection_id, executed_at DESC);

-- 5. IMMUTABLE CONNECTOR ACTIVATION & ROTATION AUDIT HISTORY
CREATE TABLE IF NOT EXISTS public.connector_activation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.tenant_provider_connections(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL,
  environment TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'credential_configured',
    'credential_replaced',
    'certificate_uploaded',
    'certificate_rotated',
    'connector_verified',
    'approval_requested',
    'approval_granted',
    'connector_activated',
    'connector_suspended',
    'connector_reactivated'
  )),
  previous_status TEXT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NULL,
  workflow_approval_ref TEXT NULL,
  actor_id UUID NULL,
  actor_role TEXT NULL,
  correlation_id TEXT NOT NULL,
  sanitized_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connector_activation_history_conn
  ON public.connector_activation_history(company_id, connection_id, created_at DESC);

-- 6. CONNECTOR HEALTH SNAPSHOTS
CREATE TABLE IF NOT EXISTS public.connector_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.tenant_provider_connections(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL,
  environment TEXT NOT NULL,
  health_state TEXT NOT NULL CHECK (health_state IN (
    'healthy',
    'degraded',
    'action_required',
    'offline',
    'suspended',
    'not_configured'
  )),
  connection_state TEXT NOT NULL,
  last_successful_handshake_at TIMESTAMPTZ NULL,
  last_successful_submission_at TIMESTAMPTZ NULL,
  last_failed_submission_at TIMESTAMPTZ NULL,
  failure_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  queue_depth INTEGER NOT NULL DEFAULT 0,
  dlq_count INTEGER NOT NULL DEFAULT 0,
  certificate_days_remaining INTEGER NULL,
  credential_days_remaining INTEGER NULL,
  provider_availability_percent NUMERIC(5, 2) NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connector_health_snapshots_conn
  ON public.connector_health_snapshots(company_id, connection_id, captured_at DESC);

-- 7. CUSTOMER ONBOARDING CHECKLISTS
CREATE TABLE IF NOT EXISTS public.connector_onboarding_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.tenant_provider_connections(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL,
  environment TEXT NOT NULL,
  step_code TEXT NOT NULL CHECK (step_code IN (
    'company_master_data',
    'government_registration',
    'tax_identifier',
    'payroll_registration',
    'bank_setup',
    'credential_setup',
    'certificate_upload',
    'preflight_check',
    'connection_test',
    'workflow_approval',
    'final_activation'
  )),
  step_title_ar TEXT NOT NULL,
  step_title_en TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN (
    'MADARX_ADMIN',
    'CUSTOMER_ACTION_REQUIRED',
    'JOINT_VERIFICATION'
  )),
  is_required BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'completed',
    'blocked',
    'not_applicable'
  )),
  blocking_reason_ar TEXT NULL,
  completed_at TIMESTAMPTZ NULL,
  completed_by UUID NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_connector_checklist_step UNIQUE (connection_id, step_code)
);

-- 8. ROW LEVEL SECURITY (RLS) & STRICT TENANT ISOLATION
ALTER TABLE public.tenant_provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_credential_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_certificate_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_activation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_onboarding_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_provider_connections_select ON public.tenant_provider_connections;
CREATE POLICY tenant_provider_connections_select
  ON public.tenant_provider_connections
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager', 'payroll_officer', 'finance_officer', 'auditor'])
  );

DROP POLICY IF EXISTS tenant_provider_connections_manage ON public.tenant_provider_connections;
CREATE POLICY tenant_provider_connections_manage
  ON public.tenant_provider_connections
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager'])
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager'])
  );

-- Credential metadata: strict secret-management isolation
DROP POLICY IF EXISTS provider_credential_metadata_select ON public.provider_credential_metadata;
CREATE POLICY provider_credential_metadata_select
  ON public.provider_credential_metadata
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager', 'auditor'])
  );

DROP POLICY IF EXISTS provider_credential_metadata_manage ON public.provider_credential_metadata;
CREATE POLICY provider_credential_metadata_manage
  ON public.provider_credential_metadata
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin'])
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin'])
  );

DROP POLICY IF EXISTS provider_certificate_metadata_select ON public.provider_certificate_metadata;
CREATE POLICY provider_certificate_metadata_select
  ON public.provider_certificate_metadata
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager', 'payroll_officer', 'auditor'])
  );

DROP POLICY IF EXISTS provider_certificate_metadata_manage ON public.provider_certificate_metadata;
CREATE POLICY provider_certificate_metadata_manage
  ON public.provider_certificate_metadata
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin'])
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin'])
  );

DROP POLICY IF EXISTS connector_verification_runs_select ON public.connector_verification_runs;
CREATE POLICY connector_verification_runs_select
  ON public.connector_verification_runs
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager', 'payroll_officer', 'finance_officer', 'auditor'])
  );

DROP POLICY IF EXISTS connector_verification_runs_insert ON public.connector_verification_runs;
CREATE POLICY connector_verification_runs_insert
  ON public.connector_verification_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager', 'payroll_officer'])
  );

DROP POLICY IF EXISTS connector_activation_history_select ON public.connector_activation_history;
CREATE POLICY connector_activation_history_select
  ON public.connector_activation_history
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager', 'finance_officer', 'auditor'])
  );

DROP POLICY IF EXISTS connector_activation_history_insert ON public.connector_activation_history;
CREATE POLICY connector_activation_history_insert
  ON public.connector_activation_history
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager'])
  );

DROP POLICY IF EXISTS connector_health_snapshots_select ON public.connector_health_snapshots;
CREATE POLICY connector_health_snapshots_select
  ON public.connector_health_snapshots
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager', 'payroll_officer', 'finance_officer', 'auditor'])
  );

DROP POLICY IF EXISTS connector_onboarding_checklists_select ON public.connector_onboarding_checklists;
CREATE POLICY connector_onboarding_checklists_select
  ON public.connector_onboarding_checklists
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager', 'payroll_officer', 'finance_officer', 'auditor'])
  );

DROP POLICY IF EXISTS connector_onboarding_checklists_manage ON public.connector_onboarding_checklists;
CREATE POLICY connector_onboarding_checklists_manage
  ON public.connector_onboarding_checklists
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager'])
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_any_role(ARRAY['super_admin', 'hr_manager'])
  );

-- 9. HARDENED ATOMIC RPC FUNCTIONS FOR CREDENTIAL ONBOARDING & ACTIVATION

CREATE OR REPLACE FUNCTION public.transition_connector_activation_lifecycle_atomic(
  p_company_id UUID,
  p_country_code TEXT,
  p_provider_code TEXT,
  p_environment TEXT,
  p_target_activation_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_workflow_approval_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conn public.tenant_provider_connections%ROWTYPE;
  v_prev_status TEXT;
  v_corr_id TEXT;
BEGIN
  IF p_company_id IS DISTINCT FROM public.current_company_id() THEN
    RAISE EXCEPTION 'TENANT_ISOLATION_VIOLATION: Cross-tenant connector activation denied';
  END IF;

  IF NOT public.has_any_role(ARRAY['super_admin', 'hr_manager']) THEN
    RAISE EXCEPTION 'RBAC_ACCESS_DENIED: Insufficient permissions for connector lifecycle transition';
  END IF;

  SELECT * INTO v_conn
  FROM public.tenant_provider_connections
  WHERE company_id = p_company_id
    AND country_code = p_country_code
    AND provider_code = p_provider_code
    AND environment = p_environment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONNECTOR_NOT_FOUND: Provider connection record not initialized for environment %', p_environment;
  END IF;

  -- Strict Production Activation Guard
  IF p_target_activation_status = 'active' THEN
    IF v_conn.connection_status IS DISTINCT FROM 'VERIFIED' THEN
      RAISE EXCEPTION 'ACTIVATION_GUARD_BLOCKED: Connector cannot become ACTIVE unless connection_status is VERIFIED (current: %)', v_conn.connection_status;
    END IF;
    IF v_conn.credential_status NOT IN ('verified', 'activated') THEN
      RAISE EXCEPTION 'ACTIVATION_GUARD_BLOCKED: Credentials must be verified before activation (current: %)', v_conn.credential_status;
    END IF;
    IF p_environment = 'production' AND v_conn.workflow_approval_status IS DISTINCT FROM 'approved' AND p_workflow_approval_ref IS NULL THEN
      RAISE EXCEPTION 'ACTIVATION_GUARD_BLOCKED: Production connector activation requires completed workflow approval';
    END IF;
  END IF;

  v_prev_status := v_conn.activation_status;
  v_corr_id := 'ACT-' || upper(p_provider_code) || '-' || to_char(now(), 'YYYYMMDDHH24MISS');

  UPDATE public.tenant_provider_connections
  SET activation_status = p_target_activation_status,
      health_state = CASE
        WHEN p_target_activation_status = 'active' THEN 'healthy'
        WHEN p_target_activation_status = 'suspended' THEN 'suspended'
        WHEN p_target_activation_status IN ('expired', 'failed') THEN 'action_required'
        ELSE health_state
      END,
      go_live_status = CASE
        WHEN p_target_activation_status = 'active' THEN 'ACTIVE'
        WHEN p_target_activation_status = 'suspended' THEN 'ACTION_REQUIRED'
        ELSE go_live_status
      END,
      suspension_reason = CASE
        WHEN p_target_activation_status = 'suspended' THEN COALESCE(p_reason, 'Manual administrative suspension')
        WHEN p_target_activation_status = 'active' THEN NULL
        ELSE suspension_reason
      END,
      approved_by = CASE
        WHEN p_target_activation_status = 'active' THEN auth.uid()
        ELSE approved_by
      END,
      updated_at = now()
  WHERE id = v_conn.id;

  INSERT INTO public.connector_activation_history (
    company_id,
    connection_id,
    provider_code,
    environment,
    action_type,
    previous_status,
    new_status,
    reason,
    workflow_approval_ref,
    actor_id,
    correlation_id,
    sanitized_metadata
  ) VALUES (
    p_company_id,
    v_conn.id,
    p_provider_code,
    p_environment,
    CASE
      WHEN p_target_activation_status = 'active' AND v_prev_status = 'suspended' THEN 'connector_reactivated'
      WHEN p_target_activation_status = 'active' THEN 'connector_activated'
      WHEN p_target_activation_status = 'suspended' THEN 'connector_suspended'
      ELSE 'connector_verified'
    END,
    v_prev_status,
    p_target_activation_status,
    p_reason,
    p_workflow_approval_ref,
    auth.uid(),
    v_corr_id,
    jsonb_build_object(
      'country_code', p_country_code,
      'provider_code', p_provider_code,
      'environment', p_environment,
      'previous_status', v_prev_status,
      'new_status', p_target_activation_status
    )
  );

  RETURN jsonb_build_object(
    'connection_id', v_conn.id,
    'provider_code', p_provider_code,
    'environment', p_environment,
    'previous_status', v_prev_status,
    'activation_status', p_target_activation_status,
    'correlation_id', v_corr_id
  );
END;
$$;
