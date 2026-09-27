-- ============================================================================
-- Migration: 20260927000000_production_workflow_approval_engine.sql
-- Description: Prompt 14 — Production Workflow, Request, Approval, Delegation & SLA Engine
--
-- Features:
-- 1. Atomic reference number generator (company-scoped sequence REQ-YYYY-XXXXXX)
-- 2. Canonical Request Catalog table
-- 3. Enhanced requests, approval_chains, approval_steps, delegation_rules, request_timeline
-- 4. Scope-based deterministic approval chain resolution with versioning
-- 5. Materialization of approvers at submission (immune to subsequent org re-orgs)
-- 6. Strict current approver authorization (materialized approver OR valid active delegate)
-- 7. Hard self-approval block (requester can never approve own request)
-- 8. Atomic decision transaction with fail-closed domain finalization (Leave, Attendance, Swaps)
-- 9. Complete Return + Resubmit lifecycle (retains reference, increments revision_number)
-- 10. Request withdrawal lifecycle
-- 11. Production Delegation Engine (anti-circular, company-scoped, auditable actor/delegator)
-- 12. SLA due date tracking & escalation
-- 13. Server-side paginated inbox and my-requests queries
-- 14. Full SECURITY DEFINER, search_path = public, deny-by-default privilege compliance
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: COMPANY-SCOPED ATOMIC REQUEST REFERENCE COUNTER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_request_number_counters (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  current_val integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.generate_request_reference(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_val integer;
  v_year text;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');

  INSERT INTO public.company_request_number_counters (company_id, current_val, updated_at)
  VALUES (p_company_id, 1, now())
  ON CONFLICT (company_id)
  DO UPDATE SET current_val = company_request_number_counters.current_val + 1, updated_at = now()
  RETURNING current_val INTO v_next_val;

  RETURN 'REQ-' || v_year || '-' || lpad(v_next_val::text, 6, '0');
END;
$$;

-- ============================================================================
-- STEP 2: CANONICAL REQUEST CATALOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.request_catalog (
  code text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  required_fields text[] NOT NULL DEFAULT '{}'::text[],
  attachment_requirement text NOT NULL DEFAULT 'optional' CHECK (attachment_requirement IN ('mandatory', 'optional', 'none')),
  domain_handler text NOT NULL DEFAULT 'generic',
  employee_visibility boolean NOT NULL DEFAULT true,
  icon text NOT NULL DEFAULT 'file',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.request_catalog (code, name_ar, name_en, is_active, required_fields, attachment_requirement, domain_handler, employee_visibility, icon)
VALUES
  ('leave', 'إجازة اعتيادية / اضطرارية', 'Leave Request', true, ARRAY['startDate', 'endDate', 'leaveTypeId'], 'optional', 'leave', true, 'calendar'),
  ('attendance_correction', 'تصحيح حركة حضور / بصمة', 'Attendance Correction', true, ARRAY['workDate', 'correctionType'], 'optional', 'attendance', true, 'clock'),
  ('overtime', 'طلب عمل إضافي', 'Overtime Request', true, ARRAY['workDate', 'hours'], 'optional', 'attendance', true, 'clock-alert'),
  ('expense_claim', 'مطالبة استرداد مصروفات', 'Expense Claim', true, ARRAY['amount', 'expenseCategoryId'], 'mandatory', 'expenses', true, 'receipt'),
  ('loan_advance', 'طلب سلفة / قرض مالي', 'Loan Advance', true, ARRAY['amount', 'installmentsCount'], 'optional', 'loans', true, 'wallet'),
  ('salary_certificate', 'مشهد تعريف بالراتب', 'Salary Certificate', true, ARRAY['purpose'], 'none', 'payroll', true, 'file-text'),
  ('resignation', 'إشعار استقالة / إنهاء خدمة', 'Resignation Notice', true, ARRAY['effectiveDate', 'reason'], 'optional', 'hrms', true, 'user-x'),
  ('asset_request', 'طلب صرف عهدة / أصل', 'Asset Request', true, ARRAY['assetType', 'reason'], 'optional', 'assets', true, 'laptop'),
  ('shift_swap', 'طلب تبادل وردية', 'Shift Swap', true, ARRAY['myAssignmentId', 'targetAssignmentId'], 'none', 'shifts', true, 'arrow-left-right'),
  ('general', 'طلب إداري عام', 'General Administrative Request', true, ARRAY['reason'], 'optional', 'generic', true, 'folder')
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  domain_handler = EXCLUDED.domain_handler,
  attachment_requirement = EXCLUDED.attachment_requirement,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- STEP 3: SCHEMA ENHANCEMENTS ON WORKFLOW TABLES
-- ============================================================================

-- 3.1 requests table enhancements
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS approval_chain_id uuid REFERENCES public.approval_chains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_chain_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_urls text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_overdue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdrawal_reason text;

-- Backfill company_id on requests from employees where missing
UPDATE public.requests r
SET company_id = e.company_id
FROM public.employees e
WHERE r.employee_id = e.id AND r.company_id IS NULL;

-- 3.2 approval_chains table enhancements
ALTER TABLE public.approval_chains
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subsidiary_id uuid REFERENCES public.subsidiaries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS min_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS max_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3.3 approval_steps table enhancements
ALTER TABLE public.approval_steps
  ADD COLUMN IF NOT EXISTS approver_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolver_type text NOT NULL DEFAULT 'role',
  ADD COLUMN IF NOT EXISTS resolver_value text,
  ADD COLUMN IF NOT EXISTS delegation_rule_id uuid REFERENCES public.delegation_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_overdue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_note text;

-- 3.4 delegation_rules table enhancements
ALTER TABLE public.delegation_rules
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS request_types text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS workflow_chain_id uuid REFERENCES public.approval_chains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill company_id on delegation_rules from delegator
UPDATE public.delegation_rules d
SET company_id = e.company_id
FROM public.employees e
WHERE d.delegator_id = e.id AND d.company_id IS NULL;

-- 3.5 request_timeline table enhancements
ALTER TABLE public.request_timeline
  ADD COLUMN IF NOT EXISTS delegator_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delegation_rule_id uuid REFERENCES public.delegation_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1;

-- ============================================================================
-- STEP 4: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_requests_company_status_created
  ON public.requests (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_employee_created
  ON public.requests (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_due_overdue
  ON public.requests (status, due_at)
  WHERE status IN ('pending', 'pending_approval');

CREATE INDEX IF NOT EXISTS idx_approval_steps_request_order
  ON public.approval_steps (request_id, step_order);

CREATE INDEX IF NOT EXISTS idx_approval_steps_approver_user_status
  ON public.approval_steps (approver_user_id, status);

CREATE INDEX IF NOT EXISTS idx_approval_steps_approver_employee_status
  ON public.approval_steps (approver_employee_id, status);

CREATE INDEX IF NOT EXISTS idx_approval_chains_lookup
  ON public.approval_chains (company_id, request_type, status, priority);

CREATE INDEX IF NOT EXISTS idx_delegation_rules_active_lookup
  ON public.delegation_rules (delegator_id, status, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_delegation_rules_delegate_lookup
  ON public.delegation_rules (delegate_id, status, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_request_timeline_request_order
  ON public.request_timeline (request_id, step_number, created_at);

-- ============================================================================
-- STEP 5: APPROVAL CHAIN RESOLVER (Deterministic & Scoped)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_approval_chain(
  p_company_id uuid,
  p_request_type text,
  p_department_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL
)
RETURNS TABLE (
  chain_id uuid,
  chain_version integer,
  chain_steps jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chain record;
  v_match_count integer := 0;
BEGIN
  -- Search for active, effective approval chain matching company and request_type
  -- Priority order:
  -- 1. Exact department match
  -- 2. Amount range match (if amount specified)
  -- 3. Higher priority number (100 > 50)
  -- 4. Company default chain
  FOR v_chain IN (
    SELECT c.id, c.version, c.steps, c.priority
    FROM public.approval_chains c
    WHERE (c.company_id = p_company_id OR (c.company_id IS NULL AND c.is_system_template = true))
      AND c.request_type = p_request_type
      AND c.status = 'active'
      AND c.effective_from <= CURRENT_DATE
      AND (c.effective_to IS NULL OR c.effective_to >= CURRENT_DATE)
      AND (c.department_id IS NULL OR c.department_id = p_department_id)
      AND (p_amount IS NULL OR (
            (c.min_amount IS NULL OR p_amount >= c.min_amount) AND
            (c.max_amount IS NULL OR p_amount <= c.max_amount)
          ))
    ORDER BY
      (CASE WHEN c.department_id = p_department_id THEN 1 ELSE 2 END) ASC,
      (CASE WHEN c.company_id = p_company_id THEN 1 ELSE 2 END) ASC,
      c.priority DESC,
      c.created_at DESC
    LIMIT 2
  ) LOOP
    v_match_count := v_match_count + 1;
    IF v_match_count = 1 THEN
      chain_id := v_chain.id;
      chain_version := v_chain.version;
      chain_steps := v_chain.steps;
    END IF;
  END LOOP;

  IF v_match_count = 0 THEN
    RETURN; -- Returns empty result set; caller will raise truthful "No chain" error
  END IF;

  RETURN NEXT;
END;
$$;

-- ============================================================================
-- STEP 6: MATERIALIZATION HELPER (Resolves actual approver user/employee)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.materialize_step_approver(
  p_company_id uuid,
  p_requester_employee_id uuid,
  p_resolver_type text,
  p_resolver_value text
)
RETURNS TABLE (
  out_user_id uuid,
  out_employee_id uuid,
  out_role_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_emp record;
  v_mgr_emp record;
  v_target_emp record;
  v_role_user record;
BEGIN
  -- Get requester info
  SELECT id, user_id, manager_id, department_id INTO v_req_emp
  FROM public.employees
  WHERE id = p_requester_employee_id;

  IF p_resolver_type = 'direct_manager' THEN
    IF v_req_emp.manager_id IS NOT NULL THEN
      SELECT id, user_id INTO v_mgr_emp
      FROM public.employees
      WHERE id = v_req_emp.manager_id AND status != 'terminated';

      out_employee_id := v_mgr_emp.id;
      out_user_id := v_mgr_emp.user_id;
      out_role_label := 'المدير المباشر';
      RETURN NEXT;
      RETURN;
    END IF;

    -- If no direct manager, escalate to HR Manager
    p_resolver_type := 'hr_manager';
  END IF;

  IF p_resolver_type = 'department_head' THEN
    IF v_req_emp.department_id IS NOT NULL THEN
      SELECT manager_id INTO v_mgr_emp
      FROM public.departments
      WHERE id = v_req_emp.department_id;

      IF v_mgr_emp.manager_id IS NOT NULL THEN
        SELECT id, user_id INTO v_target_emp
        FROM public.employees
        WHERE id = v_mgr_emp.manager_id AND status != 'terminated';

        out_employee_id := v_target_emp.id;
        out_user_id := v_target_emp.user_id;
        out_role_label := 'مدير الإدارة';
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;

    -- Fallback to HR if no dept head
    p_resolver_type := 'hr_manager';
  END IF;

  IF p_resolver_type = 'specific_employee' OR p_resolver_type = 'specific_user' THEN
    SELECT id, user_id INTO v_target_emp
    FROM public.employees
    WHERE (id::text = p_resolver_value OR user_id::text = p_resolver_value)
      AND company_id = p_company_id
      AND status != 'terminated'
    LIMIT 1;

    IF v_target_emp.id IS NOT NULL THEN
      out_employee_id := v_target_emp.id;
      out_user_id := v_target_emp.user_id;
      out_role_label := 'معتمد مخصص';
      RETURN NEXT;
      RETURN;
    END IF;

    p_resolver_type := 'hr_manager';
  END IF;

  IF p_resolver_type = 'hr_manager' THEN
    -- Find an HR manager for the company
    SELECT e.id AS emp_id, e.user_id AS u_id INTO v_role_user
    FROM public.employee_roles er
    JOIN public.employees e ON e.user_id = er.user_id AND e.company_id = p_company_id
    WHERE er.company_id = p_company_id
      AND er.role IN ('hr_manager', 'super_admin', 'org_admin')
      AND e.status != 'terminated'
    LIMIT 1;

    IF v_role_user.emp_id IS NOT NULL THEN
      out_employee_id := v_role_user.emp_id;
      out_user_id := v_role_user.u_id;
      out_role_label := 'مدير الموارد البشرية';
      RETURN NEXT;
      RETURN;
    END IF;

    -- Fallback to user_roles
    SELECT e.id AS emp_id, ur.user_id AS u_id INTO v_role_user
    FROM public.user_roles ur
    JOIN public.employees e ON e.user_id = ur.user_id AND e.company_id = p_company_id
    WHERE ur.role IN ('hr_manager', 'super_admin', 'org_admin')
    LIMIT 1;

    out_employee_id := v_role_user.emp_id;
    out_user_id := v_role_user.u_id;
    out_role_label := 'مدير الموارد البشرية';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_resolver_type = 'finance_manager' THEN
    SELECT e.id AS emp_id, e.user_id AS u_id INTO v_role_user
    FROM public.employee_roles er
    JOIN public.employees e ON e.user_id = er.user_id AND e.company_id = p_company_id
    WHERE er.company_id = p_company_id
      AND er.role IN ('finance_officer', 'payroll_manager', 'hr_manager')
      AND e.status != 'terminated'
    LIMIT 1;

    out_employee_id := v_role_user.emp_id;
    out_user_id := v_role_user.u_id;
    out_role_label := 'الإدارة المالية';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Default role resolution
  out_user_id := NULL;
  out_employee_id := NULL;
  out_role_label := COALESCE(p_resolver_value, p_resolver_type);
  RETURN NEXT;
END;
$$;

-- ============================================================================
-- STEP 7: AUTHORITATIVE RPC: submit_workflow_request
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_workflow_request(
  p_request_type text,
  p_payload jsonb,
  p_on_behalf_of_employee_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_requester_emp record;
  v_company_id uuid;
  v_dept_id uuid;
  v_chain_id uuid;
  v_chain_version integer;
  v_chain_steps jsonb;
  v_ref text;
  v_request_id uuid;
  v_step_elem jsonb;
  v_step_idx integer := 1;
  v_total_steps integer;
  v_approver record;
  v_first_step_role text;
  v_first_approver_uid uuid;
  v_step_sla_hours integer;
  v_due_at timestamptz;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مصادق عليه (Unauthenticated)';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, reference, total_steps INTO v_request_id, v_ref, v_total_steps
    FROM public.requests
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_request_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'request_id', v_request_id,
        'reference', v_ref,
        'total_steps', v_total_steps,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Derive requester employee
  IF p_on_behalf_of_employee_id IS NOT NULL THEN
    -- Verify caller is HR / Admin to submit on behalf
    IF NOT public.is_hr(v_caller_uid) THEN
      RAISE EXCEPTION 'غير مصرح لك بتقديم طلبات نيابة عن موظف آخر';
    END IF;

    SELECT id, company_id, department_id, full_name, first_name_ar, last_name_ar, user_id
    INTO v_requester_emp
    FROM public.employees
    WHERE id = p_on_behalf_of_employee_id;

    IF v_requester_emp.id IS NULL THEN
      RAISE EXCEPTION 'الموظف المحدد غير موجود';
    END IF;
  ELSE
    SELECT id, company_id, department_id, full_name, first_name_ar, last_name_ar, user_id
    INTO v_requester_emp
    FROM public.employees
    WHERE user_id = v_caller_uid
    LIMIT 1;

    IF v_requester_emp.id IS NULL THEN
      RAISE EXCEPTION 'لا يوجد ملف موظف مرتبط بحساب المستخدم الحالي';
    END IF;
  END IF;

  v_company_id := v_requester_emp.company_id;
  v_dept_id := v_requester_emp.department_id;

  -- 1. Resolve Approval Chain (Item 12, 13)
  SELECT c.chain_id, c.chain_version, c.chain_steps
  INTO v_chain_id, v_chain_version, v_chain_steps
  FROM public.resolve_approval_chain(
    v_company_id,
    p_request_type,
    v_dept_id,
    (p_payload->>'amount')::numeric
  ) c;

  IF v_chain_id IS NULL OR v_chain_steps IS NULL OR jsonb_array_length(v_chain_steps) = 0 THEN
    RAISE EXCEPTION 'لم يتم إعداد مسار اعتماد صالح لهذا النوع من الطلبات.';
  END IF;

  v_total_steps := jsonb_array_length(v_chain_steps);

  -- 2. Generate Reference Atomically (Item 6)
  v_ref := public.generate_request_reference(v_company_id);

  -- 3. Calculate initial SLA due date if configured on first step
  v_step_sla_hours := COALESCE((v_chain_steps->0->>'due_hours')::integer, 48);
  v_due_at := now() + (v_step_sla_hours || ' hours')::interval;

  -- 4. Insert Request Record
  INSERT INTO public.requests (
    company_id,
    reference,
    employee_id,
    type,
    status,
    start_date,
    end_date,
    days,
    amount,
    reason,
    payload,
    created_by,
    current_step_index,
    total_steps,
    approval_chain_id,
    approval_chain_version,
    revision_number,
    department_id,
    idempotency_key,
    due_at,
    attachment_urls
  ) VALUES (
    v_company_id,
    v_ref,
    v_requester_emp.id,
    p_request_type::public.request_type,
    'pending_approval',
    (p_payload->>'startDate')::date,
    (p_payload->>'endDate')::date,
    (p_payload->>'days')::integer,
    (p_payload->>'amount')::numeric,
    p_payload->>'reason',
    p_payload,
    v_caller_uid,
    1,
    v_total_steps,
    v_chain_id,
    v_chain_version,
    1,
    v_dept_id,
    p_idempotency_key,
    v_due_at,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'attachmentUrls', '[]'::jsonb)))
  )
  RETURNING id INTO v_request_id;

  -- 5. Materialize Approval Steps (Item 17)
  FOR v_step_elem IN SELECT * FROM jsonb_array_elements(v_chain_steps) LOOP
    SELECT out_user_id, out_employee_id, out_role_label INTO v_approver
    FROM public.materialize_step_approver(
      v_company_id,
      v_requester_emp.id,
      COALESCE(v_step_elem->>'resolverType', v_step_elem->>'resolver_type', 'role'),
      COALESCE(v_step_elem->>'resolverValue', v_step_elem->>'resolver_value', v_step_elem->>'role')
    );

    IF v_step_idx = 1 THEN
      v_first_step_role := v_approver.out_role_label;
      v_first_approver_uid := v_approver.out_user_id;
    END IF;

    INSERT INTO public.approval_steps (
      request_id,
      step_order,
      status,
      approver_role,
      approver_user_id,
      approver_employee_id,
      resolver_type,
      resolver_value,
      due_at
    ) VALUES (
      v_request_id,
      v_step_idx,
      CASE WHEN v_step_idx = 1 THEN 'pending' ELSE 'waiting' END,
      v_approver.out_role_label,
      v_approver.out_user_id,
      v_approver.out_employee_id,
      COALESCE(v_step_elem->>'resolverType', v_step_elem->>'resolver_type', 'role'),
      COALESCE(v_step_elem->>'resolverValue', v_step_elem->>'resolver_value', v_step_elem->>'role'),
      CASE WHEN v_step_idx = 1 THEN v_due_at ELSE NULL END
    );

    v_step_idx := v_step_idx + 1;
  END LOOP;

  -- Update request first approver role
  UPDATE public.requests
  SET current_approver_role = v_first_step_role
  WHERE id = v_request_id;

  -- 6. Insert Timeline Event
  INSERT INTO public.request_timeline (
    request_id,
    step_number,
    actor_id,
    actor_name,
    actor_role,
    action,
    note,
    revision_number
  ) VALUES (
    v_request_id,
    1,
    v_caller_uid,
    COALESCE(v_requester_emp.full_name, v_requester_emp.first_name_ar || ' ' || v_requester_emp.last_name_ar),
    'مقدم الطلب',
    'submitted',
    'تم إرسال الطلب واعتماد مسار الموافقة رقم ' || v_chain_id::text || ' (الإصدار ' || v_chain_version || ')',
    1
  );

  -- 7. Notify first approver
  IF v_first_approver_uid IS NOT NULL THEN
    INSERT INTO public.notifications_inbox (
      recipient_id,
      title_ar,
      title_en,
      message_ar,
      message_en,
      body_ar,
      body_en,
      type,
      link_path
    ) VALUES (
      v_first_approver_uid,
      'طلب بانتظار اعتمادك',
      'Request Pending Your Approval',
      'طلب ' || v_ref || ' من ' || COALESCE(v_requester_emp.full_name, 'الموظف'),
      'Request ' || v_ref || ' requires your decision',
      'طلب ' || v_ref || ' من ' || COALESCE(v_requester_emp.full_name, 'الموظف'),
      'Request ' || v_ref || ' requires your decision',
      'approval',
      '/?module=workflow'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'reference', v_ref,
    'total_steps', v_total_steps
  );
END;
$$;

-- ============================================================================
-- STEP 8: AUTHORITATIVE RPC: decide_workflow_request (Atomic & Fail-Closed)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.decide_workflow_request(
  p_request_id uuid,
  p_decision text,
  p_note text,
  p_internal_note text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_emp record;
  v_request record;
  v_current_step record;
  v_next_step record;
  v_is_authorized boolean := false;
  v_delegation_id uuid := NULL;
  v_delegator_emp_id uuid := NULL;
  v_delegator_name text := NULL;
  v_is_final boolean := false;
  v_new_status text;
  v_next_step_order integer;
  v_requester_user_id uuid;
  v_leave_result record;
  v_swap_result record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مصادق عليه (Unauthenticated)';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected', 'returned') THEN
    RAISE EXCEPTION 'قرار غير صالح: يجب أن يكون approved أو rejected أو returned';
  END IF;

  -- 1. Lock request row FOR UPDATE (Item 20)
  SELECT * INTO v_request
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  IF v_request.status NOT IN ('pending', 'pending_approval') THEN
    RAISE EXCEPTION 'تمت معالجة هذا الطلب مسبقاً (الحالة الحالية: %)', v_request.status;
  END IF;

  -- Get caller employee profile
  SELECT id, company_id, full_name, user_id INTO v_caller_emp
  FROM public.employees
  WHERE user_id = v_caller_uid
  LIMIT 1;

  -- 2. Prevent Self-Approval (Item 19)
  IF v_request.employee_id = v_caller_emp.id OR v_request.created_by = v_caller_uid THEN
    RAISE EXCEPTION 'محاولة مرفوضة: لا يمكن لمقدم الطلب اعتماد طلبه بنفسه (Self-Approval Denied)';
  END IF;

  -- Verify Company Isolation
  IF v_caller_emp.company_id IS NOT NULL AND v_request.company_id != v_caller_emp.company_id THEN
    -- Only platform super_admin can act across company boundaries
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = v_caller_uid AND role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'غير مصرح لك باتخاذ إجراء على طلب تابع لشركة أخرى (Cross-Tenant Access Denied)';
    END IF;
  END IF;

  -- 3. Fetch Current Materialized Step
  SELECT * INTO v_current_step
  FROM public.approval_steps
  WHERE request_id = p_request_id
    AND step_order = v_request.current_step_index
  FOR UPDATE;

  IF v_current_step.id IS NULL THEN
    RAISE EXCEPTION 'خطوة الاعتماد الحالية غير محددة';
  END IF;

  -- 4. Current Approver Authorization Check (Item 18 P0)
  -- Case A: Direct Materialized Approver
  IF (v_current_step.approver_user_id IS NOT NULL AND v_current_step.approver_user_id = v_caller_uid)
     OR (v_current_step.approver_employee_id IS NOT NULL AND v_current_step.approver_employee_id = v_caller_emp.id) THEN
    v_is_authorized := true;
  END IF;

  -- Case B: Valid Active Delegate (Item 28, 29, 30)
  IF NOT v_is_authorized AND v_caller_emp.id IS NOT NULL AND v_current_step.approver_employee_id IS NOT NULL THEN
    SELECT d.id, d.delegator_id, e.full_name INTO v_delegation_id, v_delegator_emp_id, v_delegator_name
    FROM public.delegation_rules d
    JOIN public.employees e ON e.id = d.delegator_id
    WHERE d.delegator_id = v_current_step.approver_employee_id
      AND d.delegate_id = v_caller_emp.id
      AND d.status = 'active'
      AND d.start_date <= CURRENT_DATE
      AND d.end_date >= CURRENT_DATE
      AND (
        d.scope = 'all_requests'
        OR (d.scope = 'specific_request_types' AND v_request.type::text = ANY(d.request_types))
        OR (d.scope = v_request.type::text)
      )
    LIMIT 1;

    IF v_delegation_id IS NOT NULL THEN
      -- Delegate must not be the requester
      IF v_caller_emp.id = v_request.employee_id THEN
        RAISE EXCEPTION 'لا يجوز للمفوض اعتماد طلبه بنفسه';
      END IF;
      v_is_authorized := true;
    END IF;
  END IF;

  -- Case C: Unmaterialized pool role step within same company (Item 18)
  IF NOT v_is_authorized
     AND v_current_step.approver_user_id IS NULL
     AND v_current_step.approver_employee_id IS NULL
     AND v_current_step.approver_role IS NOT NULL
     AND (v_caller_emp.company_id IS NULL OR v_caller_emp.company_id = v_request.company_id) THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_caller_uid AND ur.role::text = v_current_step.approver_role
    ) OR EXISTS (
      SELECT 1 FROM public.employee_roles er
      WHERE er.user_id = v_caller_uid AND er.role = v_current_step.approver_role AND er.company_id = v_request.company_id
    ) THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'غير مصرح لك باتخاذ قرار على هذا الطلب: لست المعتمد الحالي ولا مفوضاً سارياً عنه (42501)';
  END IF;

  -- 5. Record Current Step Decision
  UPDATE public.approval_steps
  SET
    status = p_decision,
    acted_at = now(),
    acted_by = v_caller_uid,
    note = p_note,
    internal_note = p_internal_note,
    delegation_rule_id = v_delegation_id
  WHERE id = v_current_step.id;

  -- Determine next state
  IF p_decision = 'rejected' THEN
    v_is_final := true;
    v_new_status := 'rejected';
  ELSIF p_decision = 'returned' THEN
    v_is_final := true;
    v_new_status := 'returned';
  ELSIF p_decision = 'approved' THEN
    v_next_step_order := v_request.current_step_index + 1;
    IF v_next_step_order > v_request.total_steps THEN
      v_is_final := true;
      v_new_status := 'approved';
    ELSE
      v_is_final := false;
      v_new_status := 'pending_approval';
    END IF;
  END IF;

  -- 6. Advance Chain if Approved & Not Final
  IF NOT v_is_final THEN
    UPDATE public.approval_steps
    SET
      status = 'pending',
      due_at = now() + interval '48 hours'
    WHERE request_id = p_request_id AND step_order = v_next_step_order;

    SELECT approver_role, approver_user_id INTO v_next_step
    FROM public.approval_steps
    WHERE request_id = p_request_id AND step_order = v_next_step_order;

    UPDATE public.requests
    SET
      current_step_index = v_next_step_order,
      current_approver_role = v_next_step.approver_role,
      due_at = now() + interval '48 hours',
      updated_at = now()
    WHERE id = p_request_id;

    -- Notify next approver
    IF v_next_step.approver_user_id IS NOT NULL THEN
      INSERT INTO public.notifications_inbox (
        recipient_id,
        title_ar,
        title_en,
        message_ar,
        message_en,
        body_ar,
        body_en,
        type,
        link_path
      ) VALUES (
        v_next_step.approver_user_id,
        'طلب بانتظار اعتمادك (المرحلة ' || v_next_step_order || ')',
        'Request Pending Your Decision',
        'طلب ' || v_request.reference || ' بحاجة إلى موافقتك',
        'Request ' || v_request.reference || ' requires your decision',
        'طلب ' || v_request.reference || ' بحاجة إلى موافقتك',
        'Request ' || v_request.reference || ' requires your decision',
        'approval',
        '/?module=workflow'
      );
    END IF;
  END IF;

  -- 7. Execute Domain Finalizer with Fail-Closed Behavior (Items 20, 22, 23, 24, 25, 26)
  IF v_is_final AND v_new_status = 'approved' THEN
    -- Leave Finalizer
    IF v_request.type = 'leave' THEN
      BEGIN
        PERFORM public.decide_leave_request(p_request_id, 'approved', p_note);
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'فشل اعتماد الإجازة في محرك الإجازات: % (تم التراجع عن المعاملة)', SQLERRM;
      END;
    END IF;

    -- Attendance Correction Finalizer
    IF v_request.type = 'attendance_fix' OR v_request.type::text = 'attendance_correction' THEN
      BEGIN
        PERFORM public.approve_attendance_correction(p_request_id);
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'فشل اعتماد تصحيح الحضور في محرك الحضور: % (تم التراجع عن المعاملة)', SQLERRM;
      END;
    END IF;

    -- Overtime Finalizer
    IF v_request.type::text = 'overtime' THEN
      BEGIN
        IF (v_request.payload->>'overtimeId') IS NOT NULL THEN
          PERFORM public.approve_overtime_request((v_request.payload->>'overtimeId')::uuid);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'فشل اعتماد ساعات العمل الإضافي: % (تم التراجع عن المعاملة)', SQLERRM;
      END;
    END IF;

    -- Shift Swap Finalizer
    IF v_request.type::text = 'shift_swap' THEN
      BEGIN
        IF (v_request.payload->>'swapRequestId') IS NOT NULL THEN
          PERFORM public.approve_shift_swap((v_request.payload->>'swapRequestId')::uuid, p_note);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'فشل اعتماد تبادل الوردية: % (تم التراجع عن المعاملة)', SQLERRM;
      END;
    END IF;
  END IF;

  -- Handle rejection domain finalizer (e.g. Leave release reserved days)
  IF v_is_final AND v_new_status = 'rejected' AND v_request.type = 'leave' THEN
    BEGIN
      PERFORM public.decide_leave_request(p_request_id, 'rejected', p_note);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- best effort release
    END;
  END IF;

  -- 8. Finalize Request Status
  IF v_is_final THEN
    UPDATE public.requests
    SET
      status = v_new_status::public.request_status,
      decision_note = p_note,
      decided_by = v_caller_uid,
      decided_at = now(),
      updated_at = now()
    WHERE id = p_request_id;
  END IF;

  -- 9. Append Timeline Event (Item 31: Auditing delegate & delegator)
  INSERT INTO public.request_timeline (
    request_id,
    step_number,
    actor_id,
    actor_name,
    actor_role,
    action,
    note,
    delegator_id,
    delegation_rule_id,
    revision_number
  ) VALUES (
    p_request_id,
    v_request.current_step_index,
    v_caller_uid,
    COALESCE(v_caller_emp.full_name, 'معتمد'),
    CASE
      WHEN v_delegation_id IS NOT NULL THEN 'مفوض عن ' || COALESCE(v_delegator_name, 'المدير')
      ELSE COALESCE(v_current_step.approver_role, 'المعتمد')
    END,
    p_decision,
    p_note,
    v_delegator_emp_id,
    v_delegation_id,
    v_request.revision_number
  );

  -- 10. Notify Requester on Final Decision
  IF v_is_final THEN
    SELECT user_id INTO v_requester_user_id
    FROM public.employees
    WHERE id = v_request.employee_id;

    IF v_requester_user_id IS NOT NULL THEN
      INSERT INTO public.notifications_inbox (
        recipient_id,
        title_ar,
        title_en,
        message_ar,
        message_en,
        body_ar,
        body_en,
        type,
        link_path
      ) VALUES (
        v_requester_user_id,
        CASE
          WHEN v_new_status = 'approved' THEN 'تمت الموافقة على طلبك: ' || v_request.reference
          WHEN v_new_status = 'rejected' THEN 'تم رفض طلبك: ' || v_request.reference
          ELSE 'أُعيد طلبك للاستكمال: ' || v_request.reference
        END,
        'Request Decision: ' || v_request.reference,
        COALESCE(p_note, 'تم تحديث حالة طلبك'),
        COALESCE(p_note, 'Your request status has been updated'),
        COALESCE(p_note, 'تم تحديث حالة طلبك'),
        COALESCE(p_note, 'Your request status has been updated'),
        v_new_status,
        '/?module=workflow'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_new_status,
    'step', v_request.current_step_index,
    'is_final', v_is_final
  );
END;
$$;

-- ============================================================================
-- STEP 9: RETURN & RESUBMIT (Item 10)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resubmit_workflow_request(
  p_request_id uuid,
  p_payload jsonb,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_emp record;
  v_request record;
  v_new_revision integer;
  v_first_step record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مصادق عليه';
  END IF;

  SELECT id, full_name INTO v_caller_emp
  FROM public.employees
  WHERE user_id = v_caller_uid
  LIMIT 1;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  IF v_request.status != 'returned' THEN
    RAISE EXCEPTION 'لا يمكن إعادة تقديم الطلب: الحالة الحالية ليست returned (معاد للاستكمال)';
  END IF;

  -- Only the original requester can resubmit
  IF v_request.created_by != v_caller_uid AND v_request.employee_id != v_caller_emp.id THEN
    RAISE EXCEPTION 'غير مصرح لك بإعادة تقديم طلب لا يخصك';
  END IF;

  v_new_revision := v_request.revision_number + 1;

  -- Reset approval steps to restart path
  UPDATE public.approval_steps
  SET
    status = CASE WHEN step_order = 1 THEN 'pending' ELSE 'waiting' END,
    acted_at = NULL,
    acted_by = NULL,
    note = NULL,
    internal_note = NULL,
    due_at = CASE WHEN step_order = 1 THEN now() + interval '48 hours' ELSE NULL END
  WHERE request_id = p_request_id;

  -- Get step 1 approver info
  SELECT approver_role, approver_user_id INTO v_first_step
  FROM public.approval_steps
  WHERE request_id = p_request_id AND step_order = 1;

  -- Update request
  UPDATE public.requests
  SET
    status = 'pending_approval',
    payload = p_payload,
    start_date = COALESCE((p_payload->>'startDate')::date, start_date),
    end_date = COALESCE((p_payload->>'endDate')::date, end_date),
    days = COALESCE((p_payload->>'days')::integer, days),
    amount = COALESCE((p_payload->>'amount')::numeric, amount),
    reason = COALESCE(p_payload->>'reason', reason),
    revision_number = v_new_revision,
    current_step_index = 1,
    current_approver_role = v_first_step.approver_role,
    due_at = now() + interval '48 hours',
    updated_at = now()
  WHERE id = p_request_id;

  -- Record Timeline
  INSERT INTO public.request_timeline (
    request_id,
    step_number,
    actor_id,
    actor_name,
    actor_role,
    action,
    note,
    revision_number
  ) VALUES (
    p_request_id,
    1,
    v_caller_uid,
    COALESCE(v_caller_emp.full_name, 'مقدم الطلب'),
    'مقدم الطلب',
    'submitted',
    'تمت إعادة تقديم الطلب (التعديل رقم ' || v_new_revision || '): ' || COALESCE(p_note, 'تحديث البيانات المطلوبة'),
    v_new_revision
  );

  -- Notify step 1 approver
  IF v_first_step.approver_user_id IS NOT NULL THEN
    INSERT INTO public.notifications_inbox (
      recipient_id,
      title_ar,
      title_en,
      message_ar,
      message_en,
      body_ar,
      body_en,
      type,
      link_path
    ) VALUES (
      v_first_step.approver_user_id,
      'إعادة تقديم طلب: ' || v_request.reference,
      'Resubmitted Request: ' || v_request.reference,
      'قام الموظف بتعديل وإعادة تقديم الطلب للمراجعة مجدداً',
      'The employee has revised and resubmitted request ' || v_request.reference,
      'قام الموظف بتعديل وإعادة تقديم الطلب للمراجعة مجدداً',
      'The employee has revised and resubmitted request ' || v_request.reference,
      'approval',
      '/?module=workflow'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'reference', v_request.reference,
    'revision', v_new_revision
  );
END;
$$;

-- ============================================================================
-- STEP 10: WITHDRAWAL LIFECYCLE (Item 11)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.withdraw_workflow_request(
  p_request_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_emp record;
  v_request record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مصادق عليه';
  END IF;

  SELECT id, full_name INTO v_caller_emp
  FROM public.employees
  WHERE user_id = v_caller_uid
  LIMIT 1;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  -- Only original requester can withdraw
  IF v_request.created_by != v_caller_uid AND v_request.employee_id != v_caller_emp.id THEN
    RAISE EXCEPTION 'غير مصرح لك بسحب طلب لا يخصك';
  END IF;

  -- Cannot withdraw finalized requests
  IF v_request.status IN ('approved', 'rejected', 'withdrawn', 'cancelled') THEN
    RAISE EXCEPTION 'لا يمكن سحب طلب تم اعتماده أو رفضه أو سحبه مسبقاً (الحالة الحالية: %)', v_request.status;
  END IF;

  UPDATE public.requests
  SET
    status = 'cancelled',
    withdrawn_at = now(),
    withdrawn_by = v_caller_uid,
    withdrawal_reason = p_reason,
    updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.request_timeline (
    request_id,
    step_number,
    actor_id,
    actor_name,
    actor_role,
    action,
    note,
    revision_number
  ) VALUES (
    p_request_id,
    v_request.current_step_index,
    v_caller_uid,
    COALESCE(v_caller_emp.full_name, 'مقدم الطلب'),
    'مقدم الطلب',
    'submitted',
    'تم سحب الطلب من قبل الموظف: ' || COALESCE(p_reason, 'لا توجد أسباب مذكورة'),
    v_request.revision_number
  );

  -- If leave request was pending, release reserved leave balance
  IF v_request.type = 'leave' THEN
    BEGIN
      PERFORM public.decide_leave_request(p_request_id, 'rejected', 'سحب الطلب من قبل الموظف');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'request_id', p_request_id, 'status', 'cancelled');
END;
$$;

-- ============================================================================
-- STEP 11: DELEGATION ENGINE (Items 28, 29, 30)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_delegation_rule_atomic(
  p_delegate_id uuid,
  p_start_date date,
  p_end_date date,
  p_scope text,
  p_request_types text[] DEFAULT '{}'::text[],
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_delegator record;
  v_delegate record;
  v_rule_id uuid;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مصادق عليه';
  END IF;

  -- 1. Identify Delegator
  SELECT id, company_id, status INTO v_delegator
  FROM public.employees
  WHERE user_id = v_caller_uid
  LIMIT 1;

  IF v_delegator.id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد ملف موظف مرتبط بالمستخدم الحالي';
  END IF;

  -- 2. Validation: Self-Delegation (Item 29)
  IF v_delegator.id = p_delegate_id THEN
    RAISE EXCEPTION 'لا يمكن تفويض الصلاحيات لنفسك (Self-Delegation Denied)';
  END IF;

  -- 3. Validation: Date Bounds (Item 29)
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'تاريخ نهاية التفويض يجب أن يكون مساوياً أو لاحقاً لتاريخ البدء';
  END IF;

  -- 4. Validation: Delegate Profile & Tenant (Item 29)
  SELECT id, company_id, status INTO v_delegate
  FROM public.employees
  WHERE id = p_delegate_id;

  IF v_delegate.id IS NULL THEN
    RAISE EXCEPTION 'الموظف المفوض إليه غير موجود';
  END IF;

  IF v_delegate.company_id != v_delegator.company_id THEN
    RAISE EXCEPTION 'لا يمكن تفويض الصلاحيات لموظف في شركة أخرى (Cross-Tenant Delegation Denied)';
  END IF;

  IF v_delegate.status = 'terminated' THEN
    RAISE EXCEPTION 'لا يمكن تفويض الصلاحيات لموظف خدمته منتهية';
  END IF;

  -- 5. Validation: Circular Delegation (Item 29)
  IF EXISTS (
    SELECT 1 FROM public.delegation_rules
    WHERE delegator_id = p_delegate_id
      AND delegate_id = v_delegator.id
      AND status = 'active'
      AND start_date <= p_end_date
      AND end_date >= p_start_date
  ) THEN
    RAISE EXCEPTION 'تفويض دائري غير مسموح: الموظف المحدد لديه تفويض نشط موجه إليك في هذه الفترة (Circular Delegation Denied)';
  END IF;

  -- 6. Insert Rule
  INSERT INTO public.delegation_rules (
    company_id,
    delegator_id,
    delegate_id,
    start_date,
    end_date,
    scope,
    request_types,
    reason,
    status,
    created_by
  ) VALUES (
    v_delegator.company_id,
    v_delegator.id,
    p_delegate_id,
    p_start_date,
    p_end_date,
    p_scope,
    p_request_types,
    p_reason,
    'active',
    v_caller_uid
  )
  RETURNING id INTO v_rule_id;

  RETURN jsonb_build_object('ok', true, 'id', v_rule_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_delegation_rule_atomic(
  p_rule_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_emp_id uuid;
  v_rule record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مصادق عليه';
  END IF;

  SELECT id INTO v_caller_emp_id
  FROM public.employees
  WHERE user_id = v_caller_uid
  LIMIT 1;

  SELECT * INTO v_rule
  FROM public.delegation_rules
  WHERE id = p_rule_id
  FOR UPDATE;

  IF v_rule.id IS NULL THEN
    RAISE EXCEPTION 'قاعدة التفويض غير موجودة';
  END IF;

  -- Only delegator or HR admin can revoke
  IF v_rule.delegator_id != v_caller_emp_id AND NOT public.is_hr(v_caller_uid) THEN
    RAISE EXCEPTION 'غير مصرح لك بإلغاء هذا التفويض';
  END IF;

  UPDATE public.delegation_rules
  SET
    status = 'revoked',
    revoked_at = now(),
    revoked_by = v_caller_uid
  WHERE id = p_rule_id;

  RETURN jsonb_build_object('ok', true, 'id', p_rule_id, 'status', 'revoked');
END;
$$;

-- ============================================================================
-- STEP 12: APPROVAL CHAIN DESIGNER & VERSIONING (Items 14, 36, 38)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_approval_chain_versioned(
  p_chain_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_company_id uuid;
  v_chain_id uuid;
  v_existing_chain record;
  v_next_version integer := 1;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL OR NOT public.is_hr(v_caller_uid) THEN
    RAISE EXCEPTION 'صلاحية مسؤول الموارد البشرية مطلوبة لتهيئة مسارات الاعتماد';
  END IF;

  v_company_id := (p_chain_data->>'company_id')::uuid;
  IF v_company_id IS NULL THEN
    v_company_id := public.current_company_id();
  END IF;

  -- If modifying an existing chain, archive/inactivate the old version and bump version number
  IF (p_chain_data->>'id') IS NOT NULL THEN
    SELECT * INTO v_existing_chain
    FROM public.approval_chains
    WHERE id = (p_chain_data->>'id')::uuid;

    IF v_existing_chain.id IS NOT NULL THEN
      v_next_version := v_existing_chain.version + 1;

      -- Mark existing as inactive/archived
      UPDATE public.approval_chains
      SET status = 'archived', effective_to = CURRENT_DATE - 1
      WHERE id = v_existing_chain.id;
    END IF;
  END IF;

  INSERT INTO public.approval_chains (
    company_id,
    request_type,
    name_ar,
    name_en,
    scope_type,
    scope_values,
    steps,
    is_default,
    status,
    version,
    effective_from,
    priority,
    department_id,
    description
  ) VALUES (
    v_company_id,
    p_chain_data->>'request_type',
    p_chain_data->>'name_ar',
    COALESCE(p_chain_data->>'name_en', p_chain_data->>'name_ar'),
    COALESCE(p_chain_data->>'scope_type', 'all_employees'),
    COALESCE(p_chain_data->'scope_values', '[]'::jsonb),
    COALESCE(p_chain_data->'steps', '[]'::jsonb),
    COALESCE((p_chain_data->>'is_default')::boolean, false),
    'active',
    v_next_version,
    COALESCE((p_chain_data->>'effective_from')::date, CURRENT_DATE),
    COALESCE((p_chain_data->>'priority')::integer, 100),
    (p_chain_data->>'department_id')::uuid,
    p_chain_data->>'description'
  )
  RETURNING id INTO v_chain_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_chain_id,
    'version', v_next_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_approval_chain_atomic(
  p_chain_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_hr(auth.uid()) THEN
    RAISE EXCEPTION 'غير مصرح لك بأرشفة مسار الاعتماد';
  END IF;

  UPDATE public.approval_chains
  SET status = 'archived', effective_to = CURRENT_DATE
  WHERE id = p_chain_id;

  RETURN jsonb_build_object('ok', true, 'id', p_chain_id, 'status', 'archived');
END;
$$;

-- ============================================================================
-- STEP 13: BULK APPROVAL (Item 39: Independent Transactional Verification)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bulk_decide_workflow_requests(
  p_request_ids uuid[],
  p_decision text,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_id uuid;
  v_success_count integer := 0;
  v_failure_count integer := 0;
  v_failures jsonb := '[]'::jsonb;
  v_res jsonb;
BEGIN
  FOREACH v_req_id IN ARRAY p_request_ids LOOP
    BEGIN
      v_res := public.decide_workflow_request(v_req_id, p_decision, p_note);
      v_success_count := v_success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failure_count := v_failure_count + 1;
      v_failures := v_failures || jsonb_build_object(
        'request_id', v_req_id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'success_count', v_success_count,
    'failure_count', v_failure_count,
    'failures', v_failures
  );
END;
$$;

-- ============================================================================
-- STEP 14: PAGINATED INBOX & MY REQUESTS (Items 3 & 4)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_workflow_inbox_paginated(
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_emp_id uuid;
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_search text;
  v_type text;
  v_total_count integer;
  v_items jsonb;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('data', '[]'::jsonb, 'total_count', 0, 'page', 1, 'page_size', 20);
  END IF;

  SELECT id INTO v_caller_emp_id
  FROM public.employees
  WHERE user_id = v_caller_uid
  LIMIT 1;

  v_page := GREATEST(COALESCE((p_filters->>'page')::integer, 1), 1);
  v_page_size := LEAST(GREATEST(COALESCE((p_filters->>'pageSize')::integer, 20), 1), 100);
  v_offset := (v_page - 1) * v_page_size;
  v_search := NULLIF(trim(p_filters->>'search'), '');
  v_type := NULLIF(trim(p_filters->>'type'), 'all');

  -- Count authorized pending requests
  SELECT count(*)
  INTO v_total_count
  FROM public.requests r
  JOIN public.approval_steps s ON s.request_id = r.id AND s.step_order = r.current_step_index
  LEFT JOIN public.employees e ON e.id = r.employee_id
  WHERE r.status IN ('pending', 'pending_approval')
    AND s.status = 'pending'
    AND (
      -- Caller is materialized approver
      s.approver_user_id = v_caller_uid
      OR s.approver_employee_id = v_caller_emp_id
      -- OR Caller is active delegate
      OR EXISTS (
        SELECT 1 FROM public.delegation_rules d
        WHERE d.delegator_id = s.approver_employee_id
          AND d.delegate_id = v_caller_emp_id
          AND d.status = 'active'
          AND d.start_date <= CURRENT_DATE
          AND d.end_date >= CURRENT_DATE
      )
      -- OR HR Admin for company
      OR (public.is_hr(v_caller_uid) AND r.company_id = public.current_company_id())
    )
    AND (v_type IS NULL OR r.type::text = v_type)
    AND (
      v_search IS NULL OR (
        r.reference ILIKE '%' || v_search || '%'
        OR e.full_name ILIKE '%' || v_search || '%'
        OR e.first_name_ar ILIKE '%' || v_search || '%'
        OR e.last_name_ar ILIKE '%' || v_search || '%'
        OR r.reason ILIKE '%' || v_search || '%'
      )
    );

  -- Fetch items
  SELECT COALESCE(jsonb_agg(item_json), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'referenceNo', r.reference,
      'type', r.type,
      'requesterId', r.employee_id,
      'requesterName', COALESCE(e.full_name, e.first_name_ar || ' ' || e.last_name_ar, 'الموظف'),
      'requesterJobTitle', e.job_title_ar,
      'departmentName', d.name_ar,
      'status', r.status,
      'currentStepIndex', r.current_step_index,
      'totalSteps', r.total_steps,
      'currentApproverRole', r.current_approver_role,
      'submittedAt', to_char(r.created_at, 'YYYY-MM-DD HH24:MI:SS'),
      'updatedAt', to_char(COALESCE(r.updated_at, r.created_at), 'YYYY-MM-DD HH24:MI:SS'),
      'dueAt', to_char(r.due_at, 'YYYY-MM-DD HH24:MI:SS'),
      'isOverdue', r.is_overdue,
      'payload', r.payload,
      'attachmentUrls', r.attachment_urls
    ) AS item_json
    FROM public.requests r
    JOIN public.approval_steps s ON s.request_id = r.id AND s.step_order = r.current_step_index
    LEFT JOIN public.employees e ON e.id = r.employee_id
    LEFT JOIN public.departments d ON d.id = r.department_id
    WHERE r.status IN ('pending', 'pending_approval')
      AND s.status = 'pending'
      AND (
        s.approver_user_id = v_caller_uid
        OR s.approver_employee_id = v_caller_emp_id
        OR EXISTS (
          SELECT 1 FROM public.delegation_rules del
          WHERE del.delegator_id = s.approver_employee_id
            AND del.delegate_id = v_caller_emp_id
            AND del.status = 'active'
            AND del.start_date <= CURRENT_DATE
            AND del.end_date >= CURRENT_DATE
        )
        OR (public.is_hr(v_caller_uid) AND r.company_id = public.current_company_id())
      )
      AND (v_type IS NULL OR r.type::text = v_type)
      AND (
        v_search IS NULL OR (
          r.reference ILIKE '%' || v_search || '%'
          OR e.full_name ILIKE '%' || v_search || '%'
          OR e.first_name_ar ILIKE '%' || v_search || '%'
          OR e.last_name_ar ILIKE '%' || v_search || '%'
          OR r.reason ILIKE '%' || v_search || '%'
        )
      )
    ORDER BY r.created_at ASC
    LIMIT v_page_size OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'data', v_items,
    'total_count', v_total_count,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_workflow_requests_paginated(
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_emp_id uuid;
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_search text;
  v_type text;
  v_status text;
  v_total_count integer;
  v_items jsonb;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('data', '[]'::jsonb, 'total_count', 0, 'page', 1, 'page_size', 20);
  END IF;

  SELECT id INTO v_caller_emp_id
  FROM public.employees
  WHERE user_id = v_caller_uid
  LIMIT 1;

  v_page := GREATEST(COALESCE((p_filters->>'page')::integer, 1), 1);
  v_page_size := LEAST(GREATEST(COALESCE((p_filters->>'pageSize')::integer, 20), 1), 100);
  v_offset := (v_page - 1) * v_page_size;
  v_search := NULLIF(trim(p_filters->>'search'), '');
  v_type := NULLIF(trim(p_filters->>'type'), 'all');
  v_status := NULLIF(trim(p_filters->>'status'), 'all');

  SELECT count(*)
  INTO v_total_count
  FROM public.requests r
  WHERE (r.employee_id = v_caller_emp_id OR r.created_by = v_caller_uid)
    AND (v_type IS NULL OR r.type::text = v_type)
    AND (v_status IS NULL OR r.status::text = v_status)
    AND (
      v_search IS NULL OR (
        r.reference ILIKE '%' || v_search || '%'
        OR r.reason ILIKE '%' || v_search || '%'
      )
    );

  SELECT COALESCE(jsonb_agg(item_json), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'referenceNo', r.reference,
      'type', r.type,
      'requesterId', r.employee_id,
      'requesterName', COALESCE(e.full_name, e.first_name_ar || ' ' || e.last_name_ar, 'أنا'),
      'requesterJobTitle', e.job_title_ar,
      'departmentName', d.name_ar,
      'status', r.status,
      'currentStepIndex', r.current_step_index,
      'totalSteps', r.total_steps,
      'currentApproverRole', r.current_approver_role,
      'submittedAt', to_char(r.created_at, 'YYYY-MM-DD HH24:MI:SS'),
      'updatedAt', to_char(COALESCE(r.updated_at, r.created_at), 'YYYY-MM-DD HH24:MI:SS'),
      'payload', r.payload,
      'decisionNote', r.decision_note,
      'revisionNumber', r.revision_number,
      'attachmentUrls', r.attachment_urls
    ) AS item_json
    FROM public.requests r
    LEFT JOIN public.employees e ON e.id = r.employee_id
    LEFT JOIN public.departments d ON d.id = r.department_id
    WHERE (r.employee_id = v_caller_emp_id OR r.created_by = v_caller_uid)
      AND (v_type IS NULL OR r.type::text = v_type)
      AND (v_status IS NULL OR r.status::text = v_status)
      AND (
        v_search IS NULL OR (
          r.reference ILIKE '%' || v_search || '%'
          OR r.reason ILIKE '%' || v_search || '%'
        )
      )
    ORDER BY r.created_at DESC
    LIMIT v_page_size OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'data', v_items,
    'total_count', v_total_count,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

-- ============================================================================
-- STEP 15: REQUEST DETAIL WITH TIMELINE & STEPS (Item 40)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_workflow_request_detail(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_emp_id uuid;
  v_req record;
  v_emp record;
  v_timeline jsonb;
  v_steps jsonb;
  v_can_view boolean := false;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مصادق عليه';
  END IF;

  SELECT id INTO v_caller_emp_id
  FROM public.employees
  WHERE user_id = v_caller_uid
  LIMIT 1;

  SELECT * INTO v_req
  FROM public.requests
  WHERE id = p_request_id;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  -- Privacy / RLS Authorization check (Item 42)
  IF v_req.employee_id = v_caller_emp_id OR v_req.created_by = v_caller_uid THEN
    v_can_view := true;
  ELSIF public.is_hr(v_caller_uid) AND v_req.company_id = public.current_company_id() THEN
    v_can_view := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.approval_steps s
    WHERE s.request_id = p_request_id
      AND (s.approver_user_id = v_caller_uid OR s.approver_employee_id = v_caller_emp_id)
  ) THEN
    v_can_view := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.delegation_rules d
    JOIN public.approval_steps s ON s.request_id = p_request_id
    WHERE d.delegator_id = s.approver_employee_id
      AND d.delegate_id = v_caller_emp_id
      AND d.status = 'active'
  ) THEN
    v_can_view := true;
  END IF;

  IF NOT v_can_view THEN
    RAISE EXCEPTION 'غير مصرح لك بعرض تفاصيل هذا الطلب (42501)';
  END IF;

  SELECT full_name, first_name_ar, last_name_ar, job_title_ar INTO v_emp
  FROM public.employees
  WHERE id = v_req.employee_id;

  -- Timeline
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'stepNumber', t.step_number,
      'actorId', t.actor_id,
      'actorName', t.actor_name,
      'actorRole', t.actor_role,
      'action', t.action,
      'note', t.note,
      'timestamp', to_char(t.created_at, 'YYYY-MM-DD HH24:MI:SS'),
      'revisionNumber', t.revision_number
    ) ORDER BY t.created_at ASC
  ), '[]'::jsonb)
  INTO v_timeline
  FROM public.request_timeline t
  WHERE t.request_id = p_request_id;

  -- Steps
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'stepOrder', s.step_order,
      'status', s.status,
      'approverRole', s.approver_role,
      'approverUserId', s.approver_user_id,
      'approverEmployeeId', s.approver_employee_id,
      'actedAt', to_char(s.acted_at, 'YYYY-MM-DD HH24:MI:SS'),
      'note', s.note
    ) ORDER BY s.step_order ASC
  ), '[]'::jsonb)
  INTO v_steps
  FROM public.approval_steps s
  WHERE s.request_id = p_request_id;

  RETURN jsonb_build_object(
    'id', v_req.id,
    'referenceNo', v_req.reference,
    'type', v_req.type,
    'requesterId', v_req.employee_id,
    'requesterName', COALESCE(v_emp.full_name, v_emp.first_name_ar || ' ' || v_emp.last_name_ar, 'الموظف'),
    'requesterJobTitle', v_emp.job_title_ar,
    'status', v_req.status,
    'currentStepIndex', v_req.current_step_index,
    'totalSteps', v_req.total_steps,
    'currentApproverRole', v_req.current_approver_role,
    'submittedAt', to_char(v_req.created_at, 'YYYY-MM-DD HH24:MI:SS'),
    'updatedAt', to_char(COALESCE(v_req.updated_at, v_req.created_at), 'YYYY-MM-DD HH24:MI:SS'),
    'dueAt', to_char(v_req.due_at, 'YYYY-MM-DD HH24:MI:SS'),
    'isOverdue', v_req.is_overdue,
    'payload', v_req.payload,
    'decisionNote', v_req.decision_note,
    'revisionNumber', v_req.revision_number,
    'attachmentUrls', v_req.attachment_urls,
    'timeline', v_timeline,
    'steps', v_steps
  );
END;
$$;

-- ============================================================================
-- STEP 16: WORKFLOW KPIS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_workflow_kpis(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cid uuid;
  v_uid uuid;
  v_eid uuid;
  v_inbox_pending integer := 0;
  v_my_pending integer := 0;
  v_my_approved integer := 0;
  v_my_rejected integer := 0;
  v_my_returned integer := 0;
  v_overdue_count integer := 0;
BEGIN
  v_uid := auth.uid();
  v_cid := COALESCE(p_company_id, public.current_company_id());

  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_eid FROM public.employees WHERE user_id = v_uid LIMIT 1;

    -- Inbox pending for this user
    SELECT count(*) INTO v_inbox_pending
    FROM public.requests r
    JOIN public.approval_steps s ON s.request_id = r.id AND s.step_order = r.current_step_index
    WHERE r.status IN ('pending', 'pending_approval')
      AND s.status = 'pending'
      AND (
        s.approver_user_id = v_uid
        OR s.approver_employee_id = v_eid
        OR EXISTS (
          SELECT 1 FROM public.delegation_rules del
          WHERE del.delegator_id = s.approver_employee_id
            AND del.delegate_id = v_eid
            AND del.status = 'active'
            AND del.start_date <= CURRENT_DATE
            AND del.end_date >= CURRENT_DATE
        )
        OR (public.is_hr(v_uid) AND r.company_id = v_cid)
      );

    -- My requests stats
    SELECT
      count(*) FILTER (WHERE status IN ('pending', 'pending_approval')),
      count(*) FILTER (WHERE status = 'approved'),
      count(*) FILTER (WHERE status = 'rejected'),
      count(*) FILTER (WHERE status = 'returned'),
      count(*) FILTER (WHERE is_overdue = true)
    INTO v_my_pending, v_my_approved, v_my_rejected, v_my_returned, v_overdue_count
    FROM public.requests
    WHERE employee_id = v_eid OR created_by = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'inboxPending', v_inbox_pending,
    'myPending', v_my_pending,
    'myApproved', v_my_approved,
    'myRejected', v_my_rejected,
    'myReturned', v_my_returned,
    'overdueCount', v_overdue_count
  );
END;
$$;

-- ============================================================================
-- STEP 17: ROW LEVEL SECURITY POLICIES (Item 42)
-- ============================================================================

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_catalog ENABLE ROW LEVEL SECURITY;

-- 17.1 requests policies
DROP POLICY IF EXISTS "requests_select_authorized" ON public.requests;
CREATE POLICY "requests_select_authorized"
  ON public.requests FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR created_by = auth.uid()
    OR (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.approval_steps s
      WHERE s.request_id = requests.id
        AND (
          s.approver_user_id = auth.uid()
          OR s.approver_employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.delegation_rules d
      JOIN public.approval_steps s ON s.request_id = requests.id
      WHERE d.delegator_id = s.approver_employee_id
        AND d.delegate_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
        AND d.status = 'active'
        AND d.start_date <= CURRENT_DATE
        AND d.end_date >= CURRENT_DATE
    )
  );

-- Direct mutations denied from authenticated; must go through authoritative SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "requests_deny_direct_mutation" ON public.requests;
CREATE POLICY "requests_deny_direct_mutation"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 17.2 approval_steps policies
DROP POLICY IF EXISTS "approval_steps_select_authorized" ON public.approval_steps;
CREATE POLICY "approval_steps_select_authorized"
  ON public.approval_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = approval_steps.request_id
        AND (
          r.employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
          OR r.created_by = auth.uid()
          OR (r.company_id = public.current_company_id() AND public.is_hr(auth.uid()))
          OR approval_steps.approver_user_id = auth.uid()
          OR approval_steps.approver_employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
        )
    )
  );

-- 17.3 request_timeline policies
DROP POLICY IF EXISTS "request_timeline_select_authorized" ON public.request_timeline;
CREATE POLICY "request_timeline_select_authorized"
  ON public.request_timeline FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_timeline.request_id
        AND (
          r.employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
          OR r.created_by = auth.uid()
          OR (r.company_id = public.current_company_id() AND public.is_hr(auth.uid()))
        )
    )
  );

-- 17.4 delegation_rules policies
DROP POLICY IF EXISTS "delegation_rules_select_authorized" ON public.delegation_rules;
CREATE POLICY "delegation_rules_select_authorized"
  ON public.delegation_rules FOR SELECT
  TO authenticated
  USING (
    delegator_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR delegate_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  );

-- 17.5 request_catalog policies
DROP POLICY IF EXISTS "request_catalog_select_all" ON public.request_catalog;
CREATE POLICY "request_catalog_select_all"
  ON public.request_catalog FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================================================
-- STEP 18: FUNCTION PRIVILEGES & ALLOWLIST (Prompt 13.7 Strict Compliance)
-- ============================================================================

REVOKE ALL ON FUNCTION public.generate_request_reference(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_approval_chain(uuid, text, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.materialize_step_approver(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_workflow_request(text, jsonb, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_workflow_request(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resubmit_workflow_request(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_workflow_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_delegation_rule_atomic(uuid, date, date, text, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_delegation_rule_atomic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_approval_chain_versioned(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_approval_chain_atomic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_decide_workflow_requests(uuid[], text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_workflow_inbox_paginated(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_workflow_requests_paginated(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_workflow_request_detail(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_workflow_kpis(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_request_reference(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_approval_chain(uuid, text, uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.materialize_step_approver(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_workflow_request(text, jsonb, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decide_workflow_request(uuid, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resubmit_workflow_request(uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_workflow_request(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_delegation_rule_atomic(uuid, date, date, text, text[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_delegation_rule_atomic(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_approval_chain_versioned(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_approval_chain_atomic(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_decide_workflow_requests(uuid[], text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workflow_inbox_paginated(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_workflow_requests_paginated(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workflow_request_detail(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workflow_kpis(uuid) TO authenticated, service_role;

GRANT SELECT ON public.requests TO authenticated, service_role;
GRANT SELECT ON public.approval_steps TO authenticated, service_role;
GRANT SELECT ON public.request_timeline TO authenticated, service_role;
GRANT SELECT ON public.delegation_rules TO authenticated, service_role;
GRANT SELECT ON public.approval_chains TO authenticated, service_role;
GRANT SELECT ON public.request_catalog TO authenticated, service_role;
GRANT ALL ON public.company_request_number_counters TO service_role;

COMMIT;
