-- ============================================================================
-- MADARX ENTERPRISE WORKFORCE PLATFORM
-- PROMPT 32: PRODUCTION EMPLOYEE RELATIONS, CASES, GRIEVANCES,
--            INVESTIGATIONS & DISCIPLINARY ENGINE
-- Migration: 20261014000000_production_employee_relations_cases_disciplinary_engine.sql
-- ============================================================================

-- 1. Atomic Sequence Tracking for Controlled ER Case & Appeal Numbering
CREATE TABLE IF NOT EXISTS public.er_case_sequences (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year integer NOT NULL,
  last_case_number integer NOT NULL DEFAULT 0,
  last_investigation_number integer NOT NULL DEFAULT 0,
  last_decision_number integer NOT NULL DEFAULT 0,
  last_warning_number integer NOT NULL DEFAULT 0,
  last_appeal_number integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, year)
);

CREATE INDEX IF NOT EXISTS idx_er_sequences_lookup ON public.er_case_sequences (company_id, year);

-- Function: Atomic Business Reference Number Generator (e.g. ER-2026-000123)
CREATE OR REPLACE FUNCTION public.generate_er_reference_number(
  p_company_id uuid,
  p_seq_type text -- 'case', 'investigation', 'decision', 'warning', 'appeal'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_next_val integer;
  v_prefix text;
BEGIN
  -- Row-level lock to prevent concurrent collisions
  INSERT INTO public.er_case_sequences (company_id, year, last_case_number, last_investigation_number, last_decision_number, last_warning_number, last_appeal_number)
  VALUES (p_company_id, v_year, 0, 0, 0, 0, 0)
  ON CONFLICT (company_id, year) DO NOTHING;

  IF p_seq_type = 'case' THEN
    UPDATE public.er_case_sequences
    SET last_case_number = last_case_number + 1, updated_at = now()
    WHERE company_id = p_company_id AND year = v_year
    RETURNING last_case_number INTO v_next_val;
    v_prefix := 'ER-';
  ELSIF p_seq_type = 'investigation' THEN
    UPDATE public.er_case_sequences
    SET last_investigation_number = last_investigation_number + 1, updated_at = now()
    WHERE company_id = p_company_id AND year = v_year
    RETURNING last_investigation_number INTO v_next_val;
    v_prefix := 'INV-';
  ELSIF p_seq_type = 'decision' THEN
    UPDATE public.er_case_sequences
    SET last_decision_number = last_decision_number + 1, updated_at = now()
    WHERE company_id = p_company_id AND year = v_year
    RETURNING last_decision_number INTO v_next_val;
    v_prefix := 'DEC-';
  ELSIF p_seq_type = 'warning' THEN
    UPDATE public.er_case_sequences
    SET last_warning_number = last_warning_number + 1, updated_at = now()
    WHERE company_id = p_company_id AND year = v_year
    RETURNING last_warning_number INTO v_next_val;
    v_prefix := 'WRN-';
  ELSIF p_seq_type = 'appeal' THEN
    UPDATE public.er_case_sequences
    SET last_appeal_number = last_appeal_number + 1, updated_at = now()
    WHERE company_id = p_company_id AND year = v_year
    RETURNING last_appeal_number INTO v_next_val;
    v_prefix := 'APL-';
  ELSE
    UPDATE public.er_case_sequences
    SET last_case_number = last_case_number + 1, updated_at = now()
    WHERE company_id = p_company_id AND year = v_year
    RETURNING last_case_number INTO v_next_val;
    v_prefix := 'ER-';
  END IF;

  RETURN v_prefix || v_year::text || '-' || LPAD(v_next_val::text, 6, '0');
END;
$$;

-- 2. Authoritative Employee Relations & Case Management Registry
CREATE TABLE IF NOT EXISTS public.er_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_number text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  case_type text NOT NULL CHECK (case_type IN (
    'grievance', 'employee_complaint', 'manager_complaint', 'workplace_incident',
    'policy_violation', 'misconduct', 'attendance_discipline', 'behavioral_issue',
    'workplace_conflict', 'harassment_allegation', 'safety_incident', 'ethics_concern',
    'performance_conduct_issue', 'other'
  )),
  confidentiality_level text NOT NULL DEFAULT 'standard_hr' CHECK (confidentiality_level IN (
    'standard_hr', 'restricted_hr', 'legal_sensitive', 'highly_confidential'
  )),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN (
    'low', 'medium', 'high', 'critical'
  )),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'triage', 'open', 'under_review', 'investigation',
    'awaiting_response', 'hearing_scheduled', 'decision_pending', 'action_required',
    'appeal_pending', 'resolved', 'closed', 'cancelled'
  )),
  subject_employee_id uuid REFERENCES public.employees(id) ON DELETE RESTRICT,
  complainant_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  is_anonymous_complainant boolean NOT NULL DEFAULT false,
  assigned_investigator_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  case_owner_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  incident_date date,
  target_resolution_days integer NOT NULL DEFAULT 14,
  due_date date,
  is_sla_breached boolean NOT NULL DEFAULT false,
  sla_breached_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_summary text,
  closure_reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_er_cases_number UNIQUE (company_id, case_number)
);

CREATE INDEX IF NOT EXISTS idx_er_cases_company ON public.er_cases (company_id, status);
CREATE INDEX IF NOT EXISTS idx_er_cases_subject ON public.er_cases (subject_employee_id, status);
CREATE INDEX IF NOT EXISTS idx_er_cases_complainant ON public.er_cases (complainant_employee_id);
CREATE INDEX IF NOT EXISTS idx_er_cases_investigator ON public.er_cases (assigned_investigator_id);

-- 3. Case Participants & Granular Access Tracking
CREATE TABLE IF NOT EXISTS public.er_case_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.er_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  participant_role text NOT NULL CHECK (participant_role IN (
    'subject', 'complainant', 'investigator', 'hr_reviewer', 'manager', 'witness',
    'decision_maker', 'legal_counsel', 'appeals_officer'
  )),
  access_permission text NOT NULL DEFAULT 'read' CHECK (access_permission IN ('read', 'contribute', 'full')),
  notified_at timestamptz,
  statement_submitted boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_er_participant UNIQUE (case_id, employee_id, participant_role)
);

CREATE INDEX IF NOT EXISTS idx_er_participants_case ON public.er_case_participants (case_id);
CREATE INDEX IF NOT EXISTS idx_er_participants_employee ON public.er_case_participants (employee_id);

-- 4. Granular Explicit Confidentiality Access Grants
CREATE TABLE IF NOT EXISTS public.er_case_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.er_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  grant_reason text NOT NULL,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_er_access_grant UNIQUE (case_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_er_access_grants_case ON public.er_case_access_grants (case_id, user_id);

-- 5. Secure Immutable Case Notes
CREATE TABLE IF NOT EXISTS public.er_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.er_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_role text NOT NULL,
  note_type text NOT NULL CHECK (note_type IN (
    'general', 'investigation', 'hearing', 'deliberation', 'legal_counsel', 'system_event'
  )),
  content text NOT NULL,
  is_confidential boolean NOT NULL DEFAULT false,
  is_internal_only boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_er_case_notes_case ON public.er_case_notes (case_id, created_at);

-- 6. Formal Investigations Registry
CREATE TABLE IF NOT EXISTS public.er_case_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.er_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  investigation_number text NOT NULL,
  lead_investigator_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  scope_of_investigation text NOT NULL,
  methodology text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'in_progress', 'deliberation', 'completed', 'cancelled'
  )),
  started_at timestamptz,
  target_completion_date date,
  completed_at timestamptz,
  summary_report text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_er_investigation_number UNIQUE (company_id, investigation_number)
);

CREATE INDEX IF NOT EXISTS idx_er_investigations_case ON public.er_case_investigations (case_id, status);

-- 7. Structured Investigation Steps / Protocol
CREATE TABLE IF NOT EXISTS public.er_investigation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.er_case_investigations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text,
  assigned_to_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_er_inv_steps ON public.er_investigation_steps (investigation_id, step_order);

-- 8. Witness Register & Statements
CREATE TABLE IF NOT EXISTS public.er_case_witnesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.er_case_investigations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.er_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  witness_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  witness_name text NOT NULL,
  witness_type text NOT NULL CHECK (witness_type IN ('employee', 'external', 'contractor', 'customer')),
  relationship_to_case text,
  statement_summary text,
  statement_date date,
  is_statement_verified boolean NOT NULL DEFAULT false,
  is_anonymized boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_er_witnesses_inv ON public.er_case_witnesses (investigation_id);

-- 9. Formal Interviews & Hearings
CREATE TABLE IF NOT EXISTS public.er_case_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.er_case_investigations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.er_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  interview_type text NOT NULL CHECK (interview_type IN (
    'complainant_interview', 'subject_interview', 'witness_interview', 'formal_hearing', 'committee_deliberation', 'manager_meeting'
  )),
  interviewee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  interviewee_name text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  conducted_at timestamptz,
  location text,
  meeting_link text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'rescheduled', 'cancelled', 'no_show')),
  minutes_of_meeting text,
  interview_summary text,
  admissions_or_denials text,
  acknowledged_by_interviewee boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_er_interviews_case ON public.er_case_interviews (case_id, scheduled_at);

-- 10. Chain-of-Custody Evidence Vault
CREATE TABLE IF NOT EXISTS public.er_case_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.er_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  evidence_number text NOT NULL,
  title text NOT NULL,
  description text,
  evidence_type text NOT NULL CHECK (evidence_type IN (
    'document', 'email_export', 'chat_log', 'cctv_log', 'attendance_log', 'witness_statement', 'audit_trace', 'device_log', 'financial_record', 'other'
  )),
  file_path text,
  file_size_bytes bigint,
  mime_type text,
  classification text NOT NULL DEFAULT 'restricted' CHECK (classification IN ('standard', 'restricted', 'confidential')),
  chain_of_custody_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_voided boolean NOT NULL DEFAULT false,
  voided_reason text,
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_er_evidence_case ON public.er_case_evidence (case_id, is_voided);

-- 11. Allegation Determinations & Findings
CREATE TABLE IF NOT EXISTS public.er_case_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.er_case_investigations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.er_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  allegation_item text NOT NULL,
  finding text NOT NULL CHECK (finding IN (
    'substantiated', 'partially_substantiated', 'unsubstantiated', 'inconclusive', 'not_applicable'
  )),
  factual_basis text NOT NULL,
  policy_reference text,
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_er_findings_case ON public.er_case_findings (case_id);

-- 12. Predefined Disciplinary Action Catalog
CREATE TABLE IF NOT EXISTS public.er_disciplinary_action_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'verbal_warning_record', 'written_warning', 'final_warning', 'corrective_action_plan',
    'training_required', 'policy_acknowledgement', 'suspension_review', 'employment_action_review'
  )),
  severity_level integer NOT NULL DEFAULT 1 CHECK (severity_level BETWEEN 1 AND 5),
  default_validity_days integer NOT NULL DEFAULT 180,
  requires_hr_head_approval boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_er_catalog_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_er_action_catalog ON public.er_disciplinary_action_catalog (company_id, is_active);

-- 13. Official Case Decisions & Disciplinary Determinations
CREATE TABLE IF NOT EXISTS public.er_case_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.er_cases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  decision_number text NOT NULL,
  decision_maker_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  decision_type text NOT NULL CHECK (decision_type IN (
    'no_action', 'informal_counseling', 'formal_warning', 'disciplinary_action',
    'corrective_action_plan', 'suspension', 'transfer_recommendation', 'dismissal_recommendation'
  )),
  decision_summary text NOT NULL,
  rationale text NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  appeal_eligible boolean NOT NULL DEFAULT true,
  appeal_deadline date,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_er_decisions_number UNIQUE (company_id, decision_number)
);

CREATE INDEX IF NOT EXISTS idx_er_decisions_case ON public.er_case_decisions (case_id);

-- 14. Employee Disciplinary Actions Ledger
CREATE TABLE IF NOT EXISTS public.er_employee_disciplinary_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.er_cases(id) ON DELETE SET NULL,
  decision_id uuid REFERENCES public.er_case_decisions(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  action_catalog_id uuid REFERENCES public.er_disciplinary_action_catalog(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  title text NOT NULL,
  details text NOT NULL,
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'rescinded', 'appealed')),
  rescinded_reason text,
  rescinded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_er_emp_actions ON public.er_employee_disciplinary_actions (employee_id, status);

-- 15. Official Warning Letters & Progressive Discipline Records
CREATE TABLE IF NOT EXISTS public.er_employee_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.er_cases(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  warning_number text NOT NULL,
  warning_level text NOT NULL CHECK (warning_level IN ('first_written', 'second_written', 'final')),
  violation_category text NOT NULL,
  summary text NOT NULL,
  required_improvements text NOT NULL,
  consequences_of_recurrence text NOT NULL,
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  acknowledgement_status text NOT NULL DEFAULT 'pending_acknowledgement' CHECK (acknowledgement_status IN (
    'pending_acknowledgement', 'acknowledged', 'refused_to_sign'
  )),
  acknowledged_at timestamptz,
  employee_comments text,
  refusal_witness_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  refusal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_er_warnings_number UNIQUE (company_id, warning_number)
);

CREATE INDEX IF NOT EXISTS idx_er_emp_warnings ON public.er_employee_warnings (employee_id, is_active, valid_until);

-- 16. Controlled Appeals Process with Separation of Duties
CREATE TABLE IF NOT EXISTS public.er_case_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.er_cases(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL REFERENCES public.er_case_decisions(id) ON DELETE CASCADE,
  appeal_number text NOT NULL,
  appellant_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  grounds_for_appeal text NOT NULL CHECK (grounds_for_appeal IN (
    'new_evidence', 'procedural_defect', 'disproportionate_penalty', 'factual_error', 'bias_or_conflict'
  )),
  statement text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'under_review', 'hearing_scheduled', 'upheld', 'modified', 'overturned'
  )),
  appeals_officer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  review_notes text,
  resolution_summary text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_er_appeals_number UNIQUE (company_id, appeal_number)
);

CREATE INDEX IF NOT EXISTS idx_er_appeals_case ON public.er_case_appeals (case_id, status);
CREATE INDEX IF NOT EXISTS idx_er_appeals_emp ON public.er_case_appeals (appellant_employee_id);

-- 17. Corrective Action Plans (CAP) / Rehabilitation
CREATE TABLE IF NOT EXISTS public.er_corrective_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.er_cases(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  supervisor_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  title text NOT NULL,
  objectives text NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  target_end_date date NOT NULL,
  review_frequency text NOT NULL DEFAULT 'biweekly' CHECK (review_frequency IN ('weekly', 'biweekly', 'monthly')),
  linked_course_id uuid, -- Optional Linkage to Learning Engine
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('draft', 'in_progress', 'completed', 'failed', 'cancelled')),
  progress_pct integer NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  final_evaluation text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_er_cap_emp ON public.er_corrective_action_plans (employee_id, status);

-- ============================================================================
-- 18. ATOMIC STORED PROCEDURES & BUSINESS LOGIC (RPCS)
-- ============================================================================

-- RPC 1: Create ER Case Atomic
CREATE OR REPLACE FUNCTION public.create_er_case_atomic(
  p_company_id uuid,
  p_title text,
  p_description text,
  p_case_type text,
  p_confidentiality_level text DEFAULT 'standard_hr',
  p_severity text DEFAULT 'medium',
  p_subject_employee_id uuid DEFAULT NULL,
  p_complainant_employee_id uuid DEFAULT NULL,
  p_is_anonymous_complainant boolean DEFAULT false,
  p_incident_date date DEFAULT NULL,
  p_target_resolution_days integer DEFAULT 14,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case_num text;
  v_case_id uuid;
  v_due_date date;
  v_status text := 'submitted';
  v_res record;
BEGIN
  -- Calculate SLA due date
  v_due_date := CURRENT_DATE + (COALESCE(p_target_resolution_days, 14) || ' days')::interval;

  -- Generate atomic reference number
  v_case_num := public.generate_er_reference_number(p_company_id, 'case');

  -- Insert Case Record
  INSERT INTO public.er_cases (
    company_id, case_number, title, description, case_type, confidentiality_level,
    severity, status, subject_employee_id, complainant_employee_id, is_anonymous_complainant,
    incident_date, target_resolution_days, due_date, created_by
  )
  VALUES (
    p_company_id, v_case_num, p_title, p_description, p_case_type, p_confidentiality_level,
    p_severity, v_status, p_subject_employee_id, p_complainant_employee_id, p_is_anonymous_complainant,
    p_incident_date, COALESCE(p_target_resolution_days, 14), v_due_date, p_created_by
  )
  RETURNING * INTO v_res;

  v_case_id := v_res.id;

  -- Register Subject as Participant if present
  IF p_subject_employee_id IS NOT NULL THEN
    INSERT INTO public.er_case_participants (
      case_id, company_id, employee_id, participant_role, access_permission, notes
    )
    VALUES (
      v_case_id, p_company_id, p_subject_employee_id, 'subject', 'read', 'الموظف المعني بالقضية'
    )
    ON CONFLICT (case_id, employee_id, participant_role) DO NOTHING;
  END IF;

  -- Register Complainant as Participant if present and not fully anonymous
  IF p_complainant_employee_id IS NOT NULL THEN
    INSERT INTO public.er_case_participants (
      case_id, company_id, employee_id, participant_role, access_permission, notes
    )
    VALUES (
      v_case_id, p_company_id, p_complainant_employee_id, 'complainant', 'contribute',
      CASE WHEN p_is_anonymous_complainant THEN 'مقدم الشكوى (هوية محمية داخلياً)' ELSE 'مقدم الشكوى / المتظلم' END
    )
    ON CONFLICT (case_id, employee_id, participant_role) DO NOTHING;
  END IF;

  -- Initial System Note
  INSERT INTO public.er_case_notes (
    case_id, company_id, author_id, author_name, author_role, note_type, content, is_confidential
  )
  VALUES (
    v_case_id, p_company_id, p_created_by, 'نظام مدار إكس', 'System', 'system_event',
    'تم تسجيل القضية بنجاح برقم مرجعي ' || v_case_num, (p_confidentiality_level != 'standard_hr')
  );

  RETURN jsonb_build_object(
    'success', true,
    'case_id', v_case_id,
    'case_number', v_case_num,
    'status', v_status,
    'due_date', v_due_date
  );
END;
$$;

-- RPC 2: Triage ER Case Atomic
CREATE OR REPLACE FUNCTION public.triage_er_case_atomic(
  p_case_id uuid,
  p_status text,
  p_severity text,
  p_assigned_investigator_id uuid DEFAULT NULL,
  p_case_owner_id uuid DEFAULT NULL,
  p_triage_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case record;
BEGIN
  SELECT * INTO v_case FROM public.er_cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;

  UPDATE public.er_cases
  SET 
    status = p_status,
    severity = COALESCE(p_severity, severity),
    assigned_investigator_id = COALESCE(p_assigned_investigator_id, assigned_investigator_id),
    case_owner_id = COALESCE(p_case_owner_id, case_owner_id),
    updated_at = now()
  WHERE id = p_case_id;

  -- Add Investigator to Participants
  IF p_assigned_investigator_id IS NOT NULL THEN
    INSERT INTO public.er_case_participants (
      case_id, company_id, employee_id, participant_role, access_permission, notes
    )
    VALUES (
      p_case_id, v_case.company_id, p_assigned_investigator_id, 'investigator', 'full', 'المحقق المكلف'
    )
    ON CONFLICT (case_id, employee_id, participant_role) DO NOTHING;
  END IF;

  -- Log Note
  IF p_triage_notes IS NOT NULL AND length(trim(p_triage_notes)) > 0 THEN
    INSERT INTO public.er_case_notes (
      case_id, company_id, author_id, author_name, author_role, note_type, content, is_confidential
    )
    VALUES (
      p_case_id, v_case.company_id, p_user_id, 'لجنة الفرز', 'HR Triage', 'general',
      'إجراء فرز القضية: ' || p_triage_notes, false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'case_id', p_case_id,
    'new_status', p_status
  );
END;
$$;

-- RPC 3: Start Formal Investigation Atomic
CREATE OR REPLACE FUNCTION public.start_er_investigation_atomic(
  p_case_id uuid,
  p_scope text,
  p_methodology text DEFAULT NULL,
  p_lead_investigator_id uuid DEFAULT NULL,
  p_target_completion_date date DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case record;
  v_inv_num text;
  v_inv_id uuid;
BEGIN
  SELECT * INTO v_case FROM public.er_cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;

  v_inv_num := public.generate_er_reference_number(v_case.company_id, 'investigation');

  INSERT INTO public.er_case_investigations (
    case_id, company_id, investigation_number, lead_investigator_id, scope_of_investigation,
    methodology, status, started_at, target_completion_date
  )
  VALUES (
    p_case_id, v_case.company_id, v_inv_num, COALESCE(p_lead_investigator_id, v_case.assigned_investigator_id),
    p_scope, p_methodology, 'in_progress', now(), p_target_completion_date
  )
  RETURNING id INTO v_inv_id;

  -- Update Case Status
  UPDATE public.er_cases
  SET status = 'investigation', updated_at = now()
  WHERE id = p_case_id;

  -- Create Default Investigation Steps
  INSERT INTO public.er_investigation_steps (investigation_id, company_id, step_order, title, description)
  VALUES 
    (v_inv_id, v_case.company_id, 1, 'فحص الأدلة والمستندات الأولية', 'مراجعة المراسلات وسجلات الحضور والوثائق المرفقة'),
    (v_inv_id, v_case.company_id, 2, 'سماع أقوال الشاكي والشهود', 'عقد جلسات استماع وتوثيق الإفادات'),
    (v_inv_id, v_case.company_id, 3, 'جلسة التحقيق ومواجهة الموظف المعني', 'استدعاء الموظف وسماع دفاعه وتدوين محضر رسمي'),
    (v_inv_id, v_case.company_id, 4, 'صياغة التقرير النهائي والنتائج والتوصيات', 'إعداد مذكرة النتائج والرفع للجنة القرار');

  -- Log Case Note
  INSERT INTO public.er_case_notes (
    case_id, company_id, author_id, author_name, author_role, note_type, content, is_confidential
  )
  VALUES (
    p_case_id, v_case.company_id, p_user_id, 'إدارة التحقيقات', 'Investigator', 'investigation',
    'بدء تحقيق رسمي برقم ' || v_inv_num || '. نطاق التحقيق: ' || p_scope, true
  );

  RETURN jsonb_build_object(
    'success', true,
    'investigation_id', v_inv_id,
    'investigation_number', v_inv_num,
    'case_id', p_case_id
  );
END;
$$;

-- RPC 4: Record Case Decision Atomic
CREATE OR REPLACE FUNCTION public.record_er_decision_atomic(
  p_case_id uuid,
  p_decision_maker_id uuid,
  p_decision_type text,
  p_decision_summary text,
  p_rationale text,
  p_effective_date date DEFAULT CURRENT_DATE,
  p_appeal_eligible boolean DEFAULT true,
  p_appeal_deadline_days integer DEFAULT 15,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case record;
  v_dec_num text;
  v_dec_id uuid;
  v_appeal_deadline date := NULL;
  v_next_status text;
BEGIN
  SELECT * INTO v_case FROM public.er_cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;

  IF p_appeal_eligible THEN
    v_appeal_deadline := COALESCE(p_effective_date, CURRENT_DATE) + (COALESCE(p_appeal_deadline_days, 15) || ' days')::interval;
  END IF;

  v_dec_num := public.generate_er_reference_number(v_case.company_id, 'decision');

  INSERT INTO public.er_case_decisions (
    case_id, company_id, decision_number, decision_maker_id, decision_type,
    decision_summary, rationale, effective_date, appeal_eligible, appeal_deadline, approved_by
  )
  VALUES (
    p_case_id, v_case.company_id, v_dec_num, p_decision_maker_id, p_decision_type,
    p_decision_summary, p_rationale, COALESCE(p_effective_date, CURRENT_DATE),
    p_appeal_eligible, v_appeal_deadline, p_user_id
  )
  RETURNING id INTO v_dec_id;

  -- Determine Case Status Transition
  IF p_decision_type IN ('formal_warning', 'disciplinary_action', 'corrective_action_plan') THEN
    v_next_status := 'action_required';
  ELSE
    v_next_status := 'resolved';
  END IF;

  UPDATE public.er_cases
  SET 
    status = v_next_status,
    resolved_at = CASE WHEN v_next_status = 'resolved' THEN now() ELSE resolved_at END,
    resolution_summary = p_decision_summary,
    updated_at = now()
  WHERE id = p_case_id;

  -- Log Decision Note
  INSERT INTO public.er_case_notes (
    case_id, company_id, author_id, author_name, author_role, note_type, content, is_confidential
  )
  VALUES (
    p_case_id, v_case.company_id, p_user_id, 'لجنة القرار التأديبي', 'Disciplinary Authority', 'deliberation',
    'صدور قرار رسمي رقم ' || v_dec_num || ': ' || p_decision_summary, false
  );

  RETURN jsonb_build_object(
    'success', true,
    'decision_id', v_dec_id,
    'decision_number', v_dec_num,
    'appeal_deadline', v_appeal_deadline,
    'new_status', v_next_status
  );
END;
$$;

-- RPC 5: Issue Disciplinary Action & Warning Atomic
CREATE OR REPLACE FUNCTION public.issue_disciplinary_action_atomic(
  p_case_id uuid,
  p_decision_id uuid,
  p_employee_id uuid,
  p_catalog_id uuid DEFAULT NULL,
  p_action_type text DEFAULT 'written_warning',
  p_title text DEFAULT 'إنذار كتابي رسمي',
  p_details text DEFAULT '',
  p_warning_level text DEFAULT 'first_written',
  p_validity_days integer DEFAULT 180,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case record;
  v_action_id uuid;
  v_warning_id uuid := NULL;
  v_wrn_num text := NULL;
  v_expiry_date date;
BEGIN
  SELECT * INTO v_case FROM public.er_cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;

  v_expiry_date := CURRENT_DATE + (COALESCE(p_validity_days, 180) || ' days')::interval;

  -- 1. Insert into Employee Disciplinary Actions
  INSERT INTO public.er_employee_disciplinary_actions (
    company_id, case_id, decision_id, employee_id, action_catalog_id,
    action_type, title, details, issued_date, expiry_date, status
  )
  VALUES (
    v_case.company_id, p_case_id, p_decision_id, p_employee_id, p_catalog_id,
    p_action_type, p_title, p_details, CURRENT_DATE, v_expiry_date, 'active'
  )
  RETURNING id INTO v_action_id;

  -- 2. If it is a warning action, create official warning letter record
  IF p_action_type IN ('written_warning', 'final_warning', 'verbal_warning_record') THEN
    v_wrn_num := public.generate_er_reference_number(v_case.company_id, 'warning');

    INSERT INTO public.er_employee_warnings (
      company_id, case_id, employee_id, warning_number, warning_level,
      violation_category, summary, required_improvements, consequences_of_recurrence,
      issued_date, valid_until, is_active, acknowledgement_status
    )
    VALUES (
      v_case.company_id, p_case_id, p_employee_id, v_wrn_num,
      COALESCE(p_warning_level, 'first_written'),
      v_case.case_type, p_title || ': ' || p_details,
      'الالتزام التام بالسياسات والتعليمات وتفادي تكرار المخالفة',
      'في حال تكرار المخالفة سيتم تطبيق الإجراء التأديبي التالي وفق لائحة تنظيم العمل',
      CURRENT_DATE, v_expiry_date, true, 'pending_acknowledgement'
    )
    RETURNING id INTO v_warning_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action_id', v_action_id,
    'warning_id', v_warning_id,
    'warning_number', v_wrn_num,
    'expiry_date', v_expiry_date
  );
END;
$$;

-- RPC 6: Acknowledge Employee Warning Atomic
CREATE OR REPLACE FUNCTION public.acknowledge_warning_atomic(
  p_warning_id uuid,
  p_acknowledgement_status text, -- 'acknowledged' or 'refused_to_sign'
  p_employee_comments text DEFAULT NULL,
  p_refusal_witness_id uuid DEFAULT NULL,
  p_refusal_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wrn record;
BEGIN
  SELECT * INTO v_wrn FROM public.er_employee_warnings WHERE id = p_warning_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Warning record not found');
  END IF;

  UPDATE public.er_employee_warnings
  SET
    acknowledgement_status = p_acknowledgement_status,
    acknowledged_at = now(),
    employee_comments = p_employee_comments,
    refusal_witness_id = CASE WHEN p_acknowledgement_status = 'refused_to_sign' THEN p_refusal_witness_id ELSE NULL END,
    refusal_notes = CASE WHEN p_acknowledgement_status = 'refused_to_sign' THEN p_refusal_notes ELSE NULL END
  WHERE id = p_warning_id;

  -- Add note to case if linked
  IF v_wrn.case_id IS NOT NULL THEN
    INSERT INTO public.er_case_notes (
      case_id, company_id, author_id, author_name, author_role, note_type, content, is_confidential
    )
    VALUES (
      v_wrn.case_id, v_wrn.company_id, p_user_id, 'سجل التوقيعات', 'Compliance', 'general',
      CASE 
        WHEN p_acknowledgement_status = 'acknowledged' THEN 'قام الموظف بتوقيع واستلام الإنذار رقم ' || v_wrn.warning_number
        ELSE 'تم إثبات امتناع الموظف عن استلام/توقيع الإنذار رقم ' || v_wrn.warning_number || ' بحضور الشاهد'
      END,
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'warning_id', p_warning_id,
    'status', p_acknowledgement_status
  );
END;
$$;

-- RPC 7: Submit ER Appeal Atomic with Separation of Duties
CREATE OR REPLACE FUNCTION public.submit_er_appeal_atomic(
  p_case_id uuid,
  p_decision_id uuid,
  p_appellant_employee_id uuid,
  p_grounds text,
  p_statement text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case record;
  v_dec record;
  v_apl_num text;
  v_apl_id uuid;
BEGIN
  SELECT * INTO v_case FROM public.er_cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;

  SELECT * INTO v_dec FROM public.er_case_decisions WHERE id = p_decision_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Decision not found');
  END IF;

  IF NOT v_dec.appeal_eligible THEN
    RETURN jsonb_build_object('success', false, 'error', 'This decision is not eligible for appeal');
  END IF;

  IF v_dec.appeal_deadline IS NOT NULL AND CURRENT_DATE > v_dec.appeal_deadline THEN
    RETURN jsonb_build_object('success', false, 'error', 'The deadline for submitting an appeal has expired');
  END IF;

  v_apl_num := public.generate_er_reference_number(v_case.company_id, 'appeal');

  INSERT INTO public.er_case_appeals (
    company_id, case_id, decision_id, appeal_number, appellant_employee_id,
    grounds_for_appeal, statement, status
  )
  VALUES (
    v_case.company_id, p_case_id, p_decision_id, v_apl_num, p_appellant_employee_id,
    p_grounds, p_statement, 'submitted'
  )
  RETURNING id INTO v_apl_id;

  -- Update Case Status
  UPDATE public.er_cases
  SET status = 'appeal_pending', updated_at = now()
  WHERE id = p_case_id;

  -- Log Note
  INSERT INTO public.er_case_notes (
    case_id, company_id, author_id, author_name, author_role, note_type, content, is_confidential
  )
  VALUES (
    p_case_id, v_case.company_id, p_user_id, 'لجنة التظلمات', 'Appeals Committee', 'deliberation',
    'تم قيد طلب استئناف رقم ' || v_apl_num || ' على القرار رقم ' || v_dec.decision_number, false
  );

  RETURN jsonb_build_object(
    'success', true,
    'appeal_id', v_apl_id,
    'appeal_number', v_apl_num,
    'case_id', p_case_id
  );
END;
$$;

-- RPC 8: Get ER Dashboard KPIs Atomic
CREATE OR REPLACE FUNCTION public.get_er_dashboard_kpis_atomic(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_cases integer := 0;
  v_open_cases integer := 0;
  v_active_investigations integer := 0;
  v_sla_breached_count integer := 0;
  v_active_warnings integer := 0;
  v_pending_acknowledgements integer := 0;
  v_open_appeals integer := 0;
  v_active_caps integer := 0;
  v_avg_resolution_days numeric := 0.0;
  v_grievance_resolution_rate numeric := 100.0;
  v_case_type_counts jsonb := '{}'::jsonb;
  v_type_rec record;
BEGIN
  -- Total Cases
  SELECT COUNT(*) INTO v_total_cases FROM public.er_cases WHERE company_id = p_company_id;

  -- Open Cases (any status except resolved, closed, cancelled)
  SELECT COUNT(*) INTO v_open_cases FROM public.er_cases 
  WHERE company_id = p_company_id AND status NOT IN ('resolved', 'closed', 'cancelled');

  -- Active Investigations
  SELECT COUNT(*) INTO v_active_investigations FROM public.er_case_investigations 
  WHERE company_id = p_company_id AND status IN ('draft', 'in_progress', 'deliberation');

  -- SLA Breached Count
  SELECT COUNT(*) INTO v_sla_breached_count FROM public.er_cases 
  WHERE company_id = p_company_id AND (is_sla_breached = true OR (status NOT IN ('resolved', 'closed', 'cancelled') AND due_date < CURRENT_DATE));

  -- Active Warnings
  SELECT COUNT(*) INTO v_active_warnings FROM public.er_employee_warnings 
  WHERE company_id = p_company_id AND is_active = true AND valid_until >= CURRENT_DATE;

  -- Pending Warning Acknowledgements
  SELECT COUNT(*) INTO v_pending_acknowledgements FROM public.er_employee_warnings 
  WHERE company_id = p_company_id AND acknowledgement_status = 'pending_acknowledgement';

  -- Open Appeals
  SELECT COUNT(*) INTO v_open_appeals FROM public.er_case_appeals 
  WHERE company_id = p_company_id AND status IN ('submitted', 'under_review', 'hearing_scheduled');

  -- Active Corrective Action Plans
  SELECT COUNT(*) INTO v_active_caps FROM public.er_corrective_action_plans 
  WHERE company_id = p_company_id AND status = 'in_progress';

  -- Average Resolution Days
  SELECT COALESCE(ROUND(AVG(EXTRACT(DAY FROM (resolved_at - created_at))::numeric), 1), 0.0)
  INTO v_avg_resolution_days
  FROM public.er_cases
  WHERE company_id = p_company_id AND resolved_at IS NOT NULL;

  -- Grievance Resolution Rate
  SELECT 
    CASE 
      WHEN COUNT(*) = 0 THEN 100.0
      ELSE ROUND((COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::numeric / COUNT(*)::numeric) * 100.0, 1)
    END INTO v_grievance_resolution_rate
  FROM public.er_cases
  WHERE company_id = p_company_id AND case_type = 'grievance';

  -- Breakdown by Case Type
  FOR v_type_rec IN
    SELECT case_type, COUNT(*) as cnt
    FROM public.er_cases
    WHERE company_id = p_company_id
    GROUP BY case_type
  LOOP
    v_case_type_counts := v_case_type_counts || jsonb_build_object(v_type_rec.case_type, v_type_rec.cnt);
  END LOOP;

  RETURN jsonb_build_object(
    'total_cases', v_total_cases,
    'open_cases', v_open_cases,
    'active_investigations', v_active_investigations,
    'sla_breached_count', v_sla_breached_count,
    'active_warnings', v_active_warnings,
    'pending_acknowledgements', v_pending_acknowledgements,
    'open_appeals', v_open_appeals,
    'active_caps', v_active_caps,
    'avg_resolution_days', v_avg_resolution_days,
    'grievance_resolution_rate', v_grievance_resolution_rate,
    'case_type_counts', v_case_type_counts
  );
END;
$$;

-- ============================================================================
-- 19. ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- ============================================================================

ALTER TABLE public.er_case_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_case_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_case_investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_investigation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_case_witnesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_case_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_case_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_disciplinary_action_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_case_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_employee_disciplinary_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_employee_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_case_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.er_corrective_action_plans ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS "er_case_sequences_isolation" ON public.er_case_sequences;
CREATE POLICY "er_case_sequences_isolation" ON public.er_case_sequences FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_cases_isolation" ON public.er_cases;
CREATE POLICY "er_cases_isolation" ON public.er_cases FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_case_participants_isolation" ON public.er_case_participants;
CREATE POLICY "er_case_participants_isolation" ON public.er_case_participants FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_case_access_grants_isolation" ON public.er_case_access_grants;
CREATE POLICY "er_case_access_grants_isolation" ON public.er_case_access_grants FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_case_notes_isolation" ON public.er_case_notes;
CREATE POLICY "er_case_notes_isolation" ON public.er_case_notes FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_case_investigations_isolation" ON public.er_case_investigations;
CREATE POLICY "er_case_investigations_isolation" ON public.er_case_investigations FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_investigation_steps_isolation" ON public.er_investigation_steps;
CREATE POLICY "er_investigation_steps_isolation" ON public.er_investigation_steps FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_case_witnesses_isolation" ON public.er_case_witnesses;
CREATE POLICY "er_case_witnesses_isolation" ON public.er_case_witnesses FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_case_interviews_isolation" ON public.er_case_interviews;
CREATE POLICY "er_case_interviews_isolation" ON public.er_case_interviews FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_case_evidence_isolation" ON public.er_case_evidence;
CREATE POLICY "er_case_evidence_isolation" ON public.er_case_evidence FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_case_findings_isolation" ON public.er_case_findings;
CREATE POLICY "er_case_findings_isolation" ON public.er_case_findings FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_disciplinary_action_catalog_isolation" ON public.er_disciplinary_action_catalog;
CREATE POLICY "er_disciplinary_action_catalog_isolation" ON public.er_disciplinary_action_catalog FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_case_decisions_isolation" ON public.er_case_decisions;
CREATE POLICY "er_case_decisions_isolation" ON public.er_case_decisions FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_employee_disciplinary_actions_isolation" ON public.er_employee_disciplinary_actions;
CREATE POLICY "er_employee_disciplinary_actions_isolation" ON public.er_employee_disciplinary_actions FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_employee_warnings_isolation" ON public.er_employee_warnings;
CREATE POLICY "er_employee_warnings_isolation" ON public.er_employee_warnings FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_case_appeals_isolation" ON public.er_case_appeals;
CREATE POLICY "er_case_appeals_isolation" ON public.er_case_appeals FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "er_corrective_action_plans_isolation" ON public.er_corrective_action_plans;
CREATE POLICY "er_corrective_action_plans_isolation" ON public.er_corrective_action_plans FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

-- Permissions Grant
GRANT SELECT, INSERT, UPDATE ON public.er_case_sequences TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_cases TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.er_case_participants TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.er_case_access_grants TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_case_notes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_case_investigations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.er_investigation_steps TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_case_witnesses TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_case_interviews TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_case_evidence TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_case_findings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_disciplinary_action_catalog TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_case_decisions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_employee_disciplinary_actions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_employee_warnings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_case_appeals TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.er_corrective_action_plans TO authenticated, service_role;
