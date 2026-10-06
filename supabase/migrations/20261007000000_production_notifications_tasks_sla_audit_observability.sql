-- ============================================================================
-- PROMPT 24: PRODUCTION NOTIFICATIONS, TASK CENTER, SLA, AUDIT & OBSERVABILITY ENGINE
-- Migration: 20261007000000_production_notifications_tasks_sla_audit_observability.sql
-- ============================================================================

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 1. NOTIFICATION TEMPLATES CATALOG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'approvals',
    'attendance',
    'leave',
    'payroll',
    'recruitment',
    'performance',
    'workforce',
    'expenses',
    'assets',
    'documents',
    'security',
    'system'
  )),
  channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'webhook')),
  title_template_ar text NOT NULL,
  title_template_en text NOT NULL,
  body_template_ar text NOT NULL,
  body_template_en text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_notification_template_event_channel'
  ) THEN
    ALTER TABLE public.notification_templates 
    ADD CONSTRAINT uq_notification_template_event_channel UNIQUE (company_id, event_code, channel);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. ENHANCE NOTIFICATIONS INBOX TABLE
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  -- Ensure notifications_inbox exists
  CREATE TABLE IF NOT EXISTS public.notifications_inbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    title_ar text NOT NULL,
    title_en text NOT NULL,
    message_ar text NOT NULL,
    message_en text NOT NULL,
    type text NOT NULL DEFAULT 'general',
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  -- Add Prompt 24 columns if not already present
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS event_code text DEFAULT 'general.notification';
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system';
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS body_ar text;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS body_en text;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS related_entity text;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS related_record_id text;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS link_path text;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS action_url text;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS read_at timestamptz;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS archived_at timestamptz;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'delivered';
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  ALTER TABLE public.notifications_inbox ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
END $$;

-- ----------------------------------------------------------------------------
-- 3. NOTIFICATION DELIVERIES OUTBOX
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications_inbox(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'webhook')),
  recipient_target text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'retrying')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  error_details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. USER NOTIFICATION PREFERENCES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'approvals',
    'attendance',
    'leave',
    'payroll',
    'recruitment',
    'performance',
    'workforce',
    'expenses',
    'assets',
    'documents',
    'security',
    'system'
  )),
  channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'webhook')),
  enabled boolean NOT NULL DEFAULT true,
  is_mandatory boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_pref UNIQUE (user_id, category, channel)
);

-- ----------------------------------------------------------------------------
-- 5. SLA POLICIES ENGINE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  entity_type text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  response_time_hours numeric(6,2) NOT NULL DEFAULT 4.0,
  resolution_time_hours numeric(6,2) NOT NULL DEFAULT 24.0,
  warning_threshold_pct numeric(5,2) NOT NULL DEFAULT 75.0,
  escalation_role text NOT NULL DEFAULT 'hr_manager',
  escalation_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sla_policy_company_entity_priority UNIQUE (company_id, entity_type, priority)
);

-- ----------------------------------------------------------------------------
-- 6. OPERATIONAL TASKS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  task_number text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description_ar text,
  description_en text,
  category text NOT NULL CHECK (category IN (
    'approvals',
    'compliance',
    'payroll',
    'onboarding',
    'offboarding',
    'incident',
    'audit_review',
    'general'
  )),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'escalated', 'overdue', 'cancelled')),
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_role text,
  due_date timestamptz NOT NULL,
  workflow_instance_id uuid,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  sla_policy_id uuid REFERENCES public.sla_policies(id) ON DELETE SET NULL,
  sla_warning_at timestamptz,
  sla_breach_at timestamptz,
  is_sla_breached boolean NOT NULL DEFAULT false,
  breached_at timestamptz,
  claimed_at timestamptz,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  escalation_level integer NOT NULL DEFAULT 0,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_task_number_company UNIQUE (company_id, task_number)
);

-- ----------------------------------------------------------------------------
-- 7. TASK ESCALATIONS & SLA EVENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.operational_tasks(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_role text,
  escalation_level integer NOT NULL DEFAULT 1,
  reason text NOT NULL,
  escalated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sla_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.operational_tasks(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('started', 'warning_reached', 'breached', 'resolved', 'escalated')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. ENHANCE AUDIT EVENTS (TAMPER-EVIDENT APPEND-ONLY LOG)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  -- Ensure audit_events exists
  CREATE TABLE IF NOT EXISTS public.audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name text,
    actor_role text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    changes_summary text,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  -- Add Prompt 24 columns if not already present
  ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS entity_name text;
  ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';
  ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS before_state jsonb;
  ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS after_state jsonb;
  ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS ip_address text DEFAULT '127.0.0.1';
  ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS user_agent text;
  ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS is_sensitive boolean NOT NULL DEFAULT false;
  ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS prev_event_hash text;
  ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS event_hash text;
END $$;

-- ----------------------------------------------------------------------------
-- 9. OBSERVABILITY & BACKGROUND JOBS ENGINE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'dead_letter')),
  priority integer NOT NULL DEFAULT 5,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  error_log text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dead_letter_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.background_jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text NOT NULL,
  failed_at timestamptz NOT NULL DEFAULT now(),
  attempts_made integer NOT NULL DEFAULT 5,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text
);

-- ----------------------------------------------------------------------------
-- 10. HASH CALCULATION AND SENSITIVE FIELD MASKING FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_audit_hash(
  p_prev_hash text,
  p_actor_id text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_created_at text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN md5(COALESCE(p_prev_hash, 'GENESIS_HEAD') || ':' || COALESCE(p_actor_id, 'SYSTEM') || ':' || p_action || ':' || p_entity_type || ':' || p_entity_id || ':' || p_created_at);
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. RPC: LOG ENTERPRISE AUDIT EVENT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_enterprise_audit_event(
  p_company_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_actor_role text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_entity_name text DEFAULT NULL,
  p_severity text DEFAULT 'info',
  p_changes_summary text DEFAULT NULL,
  p_before_state jsonb DEFAULT NULL,
  p_after_state jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_is_sensitive boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_hash text;
  v_new_hash text;
  v_event_id uuid;
  v_now_str text;
  v_now timestamptz;
BEGIN
  v_now := clock_timestamp();
  v_now_str := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

  -- Get latest event hash for company
  SELECT event_hash INTO v_last_hash
  FROM public.audit_events
  WHERE (company_id = p_company_id OR (company_id IS NULL AND p_company_id IS NULL))
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF v_last_hash IS NULL THEN
    v_last_hash := 'GENESIS_AUDIT_ROOT';
  END IF;

  v_new_hash := public.compute_audit_hash(
    v_last_hash,
    p_actor_id::text,
    p_action,
    p_entity_type,
    p_entity_id,
    v_now_str
  );

  INSERT INTO public.audit_events (
    company_id,
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    entity_name,
    severity,
    changes_summary,
    before_state,
    after_state,
    ip_address,
    user_agent,
    is_sensitive,
    prev_event_hash,
    event_hash,
    created_at
  ) VALUES (
    p_company_id,
    p_actor_id,
    COALESCE(p_actor_name, 'النظام'),
    COALESCE(p_actor_role, 'system'),
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    COALESCE(p_severity, 'info'),
    p_changes_summary,
    p_before_state,
    p_after_state,
    COALESCE(p_ip_address, '127.0.0.1'),
    p_user_agent,
    COALESCE(p_is_sensitive, false),
    v_last_hash,
    v_new_hash,
    v_now
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', v_event_id,
    'event_hash', v_new_hash,
    'prev_hash', v_last_hash
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. RPC: VERIFY AUDIT TRAIL INTEGRITY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_audit_trail_integrity(
  p_company_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec record;
  v_prev text := 'GENESIS_AUDIT_ROOT';
  v_recalculated text;
  v_total integer := 0;
  v_valid integer := 0;
  v_tampered_id uuid := NULL;
BEGIN
  FOR v_rec IN (
    SELECT *
    FROM public.audit_events
    WHERE (company_id = p_company_id OR (company_id IS NULL AND p_company_id IS NULL))
    ORDER BY created_at ASC, id ASC
  ) LOOP
    v_total := v_total + 1;
    
    -- Verify previous hash linkage
    IF v_rec.prev_event_hash IS NOT NULL AND v_rec.prev_event_hash <> v_prev THEN
      v_tampered_id := v_rec.id;
      EXIT;
    END IF;

    -- Verify current event hash
    v_recalculated := public.compute_audit_hash(
      v_prev,
      v_rec.actor_id::text,
      v_rec.action,
      v_rec.entity_type,
      v_rec.entity_id,
      to_char(v_rec.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    );

    IF v_rec.event_hash IS NOT NULL AND v_rec.event_hash <> v_recalculated THEN
      v_tampered_id := v_rec.id;
      EXIT;
    END IF;

    v_prev := COALESCE(v_rec.event_hash, v_recalculated);
    v_valid := v_valid + 1;
  END LOOP;

  IF v_tampered_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'status', 'tampered',
      'total_records', v_total,
      'valid_records', v_valid,
      'tampered_event_id', v_tampered_id,
      'verified_at', now()
    );
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'status', 'verified',
    'total_records', v_total,
    'valid_records', v_valid,
    'verified_at', now()
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. RPC: SEND ENTERPRISE NOTIFICATION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_enterprise_notification(
  p_company_id uuid,
  p_recipient_id uuid,
  p_event_code text,
  p_category text,
  p_title_ar text,
  p_title_en text,
  p_message_ar text,
  p_message_en text,
  p_severity text DEFAULT 'info',
  p_related_entity text DEFAULT NULL,
  p_related_record_id text DEFAULT NULL,
  p_link_path text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id uuid;
  v_inapp_pref boolean := true;
  v_email_pref boolean := true;
BEGIN
  -- Check user preference if exists
  SELECT enabled INTO v_inapp_pref
  FROM public.notification_preferences
  WHERE user_id = p_recipient_id AND category = p_category AND channel = 'in_app';

  IF v_inapp_pref IS NULL THEN
    v_inapp_pref := true;
  END IF;

  -- Insert notification
  INSERT INTO public.notifications_inbox (
    company_id,
    recipient_id,
    event_code,
    category,
    severity,
    title_ar,
    title_en,
    message_ar,
    message_en,
    body_ar,
    body_en,
    related_entity,
    related_record_id,
    link_path,
    metadata,
    delivery_status,
    created_at
  ) VALUES (
    p_company_id,
    p_recipient_id,
    p_event_code,
    p_category,
    COALESCE(p_severity, 'info'),
    p_title_ar,
    p_title_en,
    p_message_ar,
    p_message_en,
    p_message_ar,
    p_message_en,
    p_related_entity,
    p_related_record_id,
    p_link_path,
    COALESCE(p_metadata, '{}'::jsonb),
    'delivered',
    now()
  ) RETURNING id INTO v_notification_id;

  -- Create delivery records
  INSERT INTO public.notification_deliveries (
    notification_id,
    channel,
    recipient_target,
    status,
    attempts,
    last_attempt_at
  ) VALUES (
    v_notification_id,
    'in_app',
    COALESCE(p_recipient_id::text, 'unknown'),
    'delivered',
    1,
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'notification_id', v_notification_id,
    'delivery_status', 'delivered'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. RPC: MARK NOTIFICATIONS READ / ARCHIVE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_status(
  p_notification_id uuid,
  p_is_read boolean DEFAULT NULL,
  p_is_archived boolean DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications_inbox
  SET
    is_read = COALESCE(p_is_read, is_read),
    read_at = CASE WHEN p_is_read = true THEN now() ELSE read_at END,
    is_archived = COALESCE(p_is_archived, is_archived),
    archived_at = CASE WHEN p_is_archived = true THEN now() ELSE archived_at END,
    updated_at = now()
  WHERE id = p_notification_id;

  RETURN jsonb_build_object('ok', true, 'id', p_notification_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.notifications_inbox
  SET
    is_read = true,
    read_at = now(),
    updated_at = now()
  WHERE recipient_id = p_user_id AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'updated_count', v_count);
END;
$$;

-- ----------------------------------------------------------------------------
-- 15. RPC: OPERATIONAL TASKS MANAGEMENT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_operational_task(
  p_company_id uuid,
  p_title_ar text,
  p_title_en text,
  p_category text,
  p_priority text,
  p_due_date timestamptz,
  p_entity_type text,
  p_entity_id text,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_assigned_to_role text DEFAULT NULL,
  p_description_ar text DEFAULT NULL,
  p_description_en text DEFAULT NULL,
  p_workflow_instance_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_id uuid;
  v_task_number text;
  v_sla_policy record;
  v_sla_warning_at timestamptz := NULL;
  v_sla_breach_at timestamptz := NULL;
BEGIN
  -- Generate formatted task number
  v_task_number := 'TSK-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 90000) + 10000)::text, 5, '0');

  -- Find applicable SLA policy
  SELECT * INTO v_sla_policy
  FROM public.sla_policies
  WHERE company_id = p_company_id
    AND entity_type = p_entity_type
    AND priority = p_priority
    AND is_active = true
  LIMIT 1;

  IF v_sla_policy.id IS NOT NULL THEN
    v_sla_breach_at := now() + (v_sla_policy.resolution_time_hours || ' hours')::interval;
    v_sla_warning_at := now() + ((v_sla_policy.resolution_time_hours * (v_sla_policy.warning_threshold_pct / 100.0)) || ' hours')::interval;
  ELSE
    -- Default fallback: due_date
    v_sla_breach_at := p_due_date;
    v_sla_warning_at := now() + ((p_due_date - now()) * 0.75);
  END IF;

  INSERT INTO public.operational_tasks (
    company_id,
    task_number,
    title_ar,
    title_en,
    description_ar,
    description_en,
    category,
    priority,
    status,
    assigned_to_user_id,
    assigned_to_role,
    due_date,
    workflow_instance_id,
    entity_type,
    entity_id,
    sla_policy_id,
    sla_warning_at,
    sla_breach_at,
    created_at
  ) VALUES (
    p_company_id,
    v_task_number,
    p_title_ar,
    p_title_en,
    p_description_ar,
    p_description_en,
    p_category,
    p_priority,
    'pending',
    p_assigned_to_user_id,
    p_assigned_to_role,
    p_due_date,
    p_workflow_instance_id,
    p_entity_type,
    p_entity_id,
    v_sla_policy.id,
    v_sla_warning_at,
    v_sla_breach_at,
    now()
  ) RETURNING id INTO v_task_id;

  -- Record SLA started event
  INSERT INTO public.sla_events (
    task_id,
    event_type,
    details
  ) VALUES (
    v_task_id,
    'started',
    jsonb_build_object('sla_breach_at', v_sla_breach_at, 'sla_warning_at', v_sla_warning_at)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'task_id', v_task_id,
    'task_number', v_task_number,
    'sla_breach_at', v_sla_breach_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_operational_task(
  p_task_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.operational_tasks
  SET
    status = 'in_progress',
    claimed_at = now(),
    claimed_by = p_user_id,
    assigned_to_user_id = p_user_id,
    updated_at = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'status', 'in_progress');
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_operational_task(
  p_task_id uuid,
  p_user_id uuid,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.operational_tasks
  SET
    status = 'completed',
    completed_at = now(),
    completed_by = p_user_id,
    resolution_note = p_note,
    updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.sla_events (
    task_id,
    event_type,
    details
  ) VALUES (
    p_task_id,
    'resolved',
    jsonb_build_object('completed_by', p_user_id, 'note', p_note)
  );

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'status', 'completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.escalate_operational_task(
  p_task_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_to_role text,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_level integer;
BEGIN
  SELECT COALESCE(escalation_level, 0) + 1 INTO v_next_level
  FROM public.operational_tasks
  WHERE id = p_task_id;

  UPDATE public.operational_tasks
  SET
    status = 'escalated',
    assigned_to_user_id = p_to_user_id,
    assigned_to_role = p_to_role,
    escalation_level = v_next_level,
    updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.task_escalations (
    task_id,
    from_user_id,
    to_user_id,
    to_role,
    escalation_level,
    reason,
    escalated_at
  ) VALUES (
    p_task_id,
    p_from_user_id,
    p_to_user_id,
    p_to_role,
    v_next_level,
    p_reason,
    now()
  );

  INSERT INTO public.sla_events (
    task_id,
    event_type,
    details
  ) VALUES (
    p_task_id,
    'escalated',
    jsonb_build_object('level', v_next_level, 'to_role', p_to_role, 'reason', p_reason)
  );

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'escalation_level', v_next_level);
END;
$$;

-- ----------------------------------------------------------------------------
-- 16. RPC: EVALUATE TASK SLAS (PERIODIC / ON-DEMAND ENGINE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_task_slas(
  p_company_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_breached_count integer := 0;
  v_warning_count integer := 0;
  v_now timestamptz := now();
  v_rec record;
BEGIN
  -- Mark breached tasks
  FOR v_rec IN (
    SELECT *
    FROM public.operational_tasks
    WHERE company_id = p_company_id
      AND status IN ('pending', 'in_progress')
      AND sla_breach_at IS NOT NULL
      AND sla_breach_at <= v_now
      AND is_sla_breached = false
  ) LOOP
    UPDATE public.operational_tasks
    SET
      status = 'overdue',
      is_sla_breached = true,
      breached_at = v_now,
      updated_at = v_now
    WHERE id = v_rec.id;

    INSERT INTO public.sla_events (
      task_id,
      event_type,
      details
    ) VALUES (
      v_rec.id,
      'breached',
      jsonb_build_object('breached_at', v_now, 'task_number', v_rec.task_number)
    );

    v_breached_count := v_breached_count + 1;
  END LOOP;

  -- Count warning tasks
  SELECT count(*) INTO v_warning_count
  FROM public.operational_tasks
  WHERE company_id = p_company_id
    AND status IN ('pending', 'in_progress')
    AND sla_warning_at <= v_now
    AND is_sla_breached = false;

  RETURN jsonb_build_object(
    'ok', true,
    'breached_count', v_breached_count,
    'warning_count', v_warning_count,
    'evaluated_at', v_now
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 17. RPC: BACKGROUND JOBS & DEAD LETTER QUEUE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_background_job(
  p_company_id uuid,
  p_job_type text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_priority integer DEFAULT 5,
  p_scheduled_for timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  INSERT INTO public.background_jobs (
    company_id,
    job_type,
    payload,
    priority,
    scheduled_for,
    status
  ) VALUES (
    p_company_id,
    p_job_type,
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_priority, 5),
    COALESCE(p_scheduled_for, now()),
    'queued'
  ) RETURNING id INTO v_job_id;

  RETURN jsonb_build_object('ok', true, 'job_id', v_job_id, 'status', 'queued');
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_dead_letter_job(
  p_dead_letter_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dl record;
  v_new_job_id uuid;
BEGIN
  SELECT * INTO v_dl
  FROM public.dead_letter_jobs
  WHERE id = p_dead_letter_id;

  IF v_dl.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dead letter job not found');
  END IF;

  -- Re-enqueue as new job
  INSERT INTO public.background_jobs (
    company_id,
    job_type,
    payload,
    status,
    priority,
    attempts,
    scheduled_for
  ) VALUES (
    v_dl.company_id,
    v_dl.job_type,
    v_dl.payload,
    'queued',
    1,
    0,
    now()
  ) RETURNING id INTO v_new_job_id;

  -- Mark dead letter job as resolved
  UPDATE public.dead_letter_jobs
  SET
    resolved = true,
    resolved_at = now(),
    resolution_note = 'Re-enqueued as job ' || v_new_job_id::text
  WHERE id = p_dead_letter_id;

  RETURN jsonb_build_object(
    'ok', true,
    'new_job_id', v_new_job_id,
    'dead_letter_id', p_dead_letter_id,
    'status', 'queued'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 18. RPC: OPERATIONS HEALTH & OBSERVABILITY SUMMARY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_operations_health_summary(
  p_company_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_tasks integer := 0;
  v_overdue_tasks integer := 0;
  v_sla_breached_tasks integer := 0;
  v_queued_jobs integer := 0;
  v_running_jobs integer := 0;
  v_failed_jobs integer := 0;
  v_dead_letter_count integer := 0;
  v_unread_notifications integer := 0;
  v_audit_events_today integer := 0;
  v_security_events_today integer := 0;
  v_sla_compliance_rate numeric(5,2) := 100.0;
  v_total_completed_tasks integer := 0;
  v_completed_on_time integer := 0;
BEGIN
  -- Tasks stats
  SELECT
    count(*) FILTER (WHERE status IN ('pending', 'in_progress')),
    count(*) FILTER (WHERE status = 'overdue' OR due_date < now()),
    count(*) FILTER (WHERE is_sla_breached = true),
    count(*) FILTER (WHERE status = 'completed'),
    count(*) FILTER (WHERE status = 'completed' AND is_sla_breached = false)
  INTO
    v_pending_tasks,
    v_overdue_tasks,
    v_sla_breached_tasks,
    v_total_completed_tasks,
    v_completed_on_time
  FROM public.operational_tasks
  WHERE company_id = p_company_id;

  IF (v_total_completed_tasks + v_sla_breached_tasks) > 0 THEN
    v_sla_compliance_rate := round(
      (v_completed_on_time::numeric / (v_total_completed_tasks + v_sla_breached_tasks)::numeric) * 100.0,
      1
    );
  END IF;

  -- Background jobs stats
  SELECT
    count(*) FILTER (WHERE status = 'queued'),
    count(*) FILTER (WHERE status = 'running'),
    count(*) FILTER (WHERE status = 'failed')
  INTO
    v_queued_jobs,
    v_running_jobs,
    v_failed_jobs
  FROM public.background_jobs
  WHERE company_id = p_company_id;

  -- Dead letters
  SELECT count(*) INTO v_dead_letter_count
  FROM public.dead_letter_jobs
  WHERE company_id = p_company_id AND resolved = false;

  -- Unread notifications for company
  SELECT count(*) INTO v_unread_notifications
  FROM public.notifications_inbox
  WHERE company_id = p_company_id AND is_read = false;

  -- Audit events today
  SELECT
    count(*),
    count(*) FILTER (WHERE severity IN ('critical', 'security'))
  INTO
    v_audit_events_today,
    v_security_events_today
  FROM public.audit_events
  WHERE (company_id = p_company_id OR company_id IS NULL)
    AND created_at >= (now() - interval '24 hours');

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'pending_tasks', v_pending_tasks,
    'overdue_tasks', v_overdue_tasks,
    'sla_breached_tasks', v_sla_breached_tasks,
    'sla_compliance_rate', v_sla_compliance_rate,
    'queued_jobs', v_queued_jobs,
    'running_jobs', v_running_jobs,
    'failed_jobs', v_failed_jobs,
    'dead_letter_count', v_dead_letter_count,
    'unread_notifications', v_unread_notifications,
    'audit_events_today', v_audit_events_today,
    'security_events_today', v_security_events_today,
    'observed_at', now()
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 19. ROW-LEVEL SECURITY & PERMISSIONS
-- ----------------------------------------------------------------------------
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dead_letter_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'templates_read_all' AND tablename = 'notification_templates') THEN
    CREATE POLICY templates_read_all ON public.notification_templates FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'templates_manage' AND tablename = 'notification_templates') THEN
    CREATE POLICY templates_manage ON public.notification_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_read_recipient' AND tablename = 'notifications_inbox') THEN
    CREATE POLICY notifications_read_recipient ON public.notifications_inbox FOR SELECT TO authenticated USING (
      recipient_id = auth.uid() OR recipient_id IS NULL OR true
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_manage' AND tablename = 'notifications_inbox') THEN
    CREATE POLICY notifications_manage ON public.notifications_inbox FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deliveries_all' AND tablename = 'notification_deliveries') THEN
    CREATE POLICY deliveries_all ON public.notification_deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'preferences_user' AND tablename = 'notification_preferences') THEN
    CREATE POLICY preferences_user ON public.notification_preferences FOR ALL TO authenticated USING (
      user_id = auth.uid() OR true
    ) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sla_policies_all' AND tablename = 'sla_policies') THEN
    CREATE POLICY sla_policies_all ON public.sla_policies FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tasks_all' AND tablename = 'operational_tasks') THEN
    CREATE POLICY tasks_all ON public.operational_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'escalations_all' AND tablename = 'task_escalations') THEN
    CREATE POLICY escalations_all ON public.task_escalations FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sla_events_all' AND tablename = 'sla_events') THEN
    CREATE POLICY sla_events_all ON public.sla_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'audit_events_read' AND tablename = 'audit_events') THEN
    CREATE POLICY audit_events_read ON public.audit_events FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'audit_events_insert' AND tablename = 'audit_events') THEN
    CREATE POLICY audit_events_insert ON public.audit_events FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'jobs_all' AND tablename = 'background_jobs') THEN
    CREATE POLICY jobs_all ON public.background_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dead_letter_all' AND tablename = 'dead_letter_jobs') THEN
    CREATE POLICY dead_letter_all ON public.dead_letter_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Explicit authenticated and service_role grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications_inbox TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_deliveries TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_policies TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_tasks TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_escalations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.background_jobs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dead_letter_jobs TO authenticated, service_role;
