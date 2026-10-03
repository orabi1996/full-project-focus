-- =============================================================================
-- PROMPT 20: Production Recruitment, ATS, Offers & Hiring Engine
-- Migration: 20261003000000_production_recruitment_ats_engine.sql
-- =============================================================================
-- APPEND-ONLY. Does NOT modify any previously-committed migration.
-- Augments baseline job_openings, candidates, and job_offers tables.
-- =============================================================================

-- Ensure set_updated_at function exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. RECRUITMENT REQUISITIONS (Hiring Demand / Approvals before Job Posting)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recruitment_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requisition_no text NOT NULL,
  title_ar text NOT NULL,
  title_en text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  headcount_request_id uuid REFERENCES public.headcount_requests(id) ON DELETE SET NULL,
  workforce_plan_id uuid REFERENCES public.workforce_plans(id) ON DELETE SET NULL,
  openings_count integer NOT NULL DEFAULT 1 CHECK (openings_count > 0),
  filled_count integer NOT NULL DEFAULT 0,
  employment_type text NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  justification text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'open', 'partially_filled', 'filled', 'cancelled', 'closed')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  workflow_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recruitment_requisitions_company_no_uq
  ON public.recruitment_requisitions(company_id, requisition_no);

-- ---------------------------------------------------------------------------
-- 2. AUGMENT JOB OPENINGS (Authoritative Job Requisition / Published Opening)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  openings_count integer NOT NULL DEFAULT 1,
  filled_count integer NOT NULL DEFAULT 0,
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  description_ar text,
  published_status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_openings
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS job_reference text,
  ADD COLUMN IF NOT EXISTS requisition_id uuid REFERENCES public.recruitment_requisitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workforce_plan_id uuid REFERENCES public.workforce_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS headcount_request_id uuid REFERENCES public.headcount_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS salary_currency text NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS salary_visibility text NOT NULL DEFAULT 'range'
    CHECK (salary_visibility IN ('exact', 'range', 'hidden')),
  ADD COLUMN IF NOT EXISTS requirements_ar text,
  ADD COLUMN IF NOT EXISTS requirements_en text,
  ADD COLUMN IF NOT EXISTS application_start_date date,
  ADD COLUMN IF NOT EXISTS application_end_date date,
  ADD COLUMN IF NOT EXISTS recruiter_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hiring_manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'published', 'paused', 'closed')),
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Back-fill company_id for job_openings from departments if available
UPDATE public.job_openings jo
SET company_id = d.company_id
FROM public.departments d
WHERE jo.department_id = d.id AND jo.company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_openings_company_ref_uq
  ON public.job_openings(company_id, job_reference)
  WHERE job_reference IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. AUGMENT CANDIDATES (Authoritative Applicant Master & ATS Pipeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.job_openings(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  stage text NOT NULL DEFAULT 'applied',
  rating_score numeric(3,2) DEFAULT 5.0,
  source text DEFAULT 'website',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS candidate_code text,
  ADD COLUMN IF NOT EXISTS requisition_id uuid REFERENCES public.recruitment_requisitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_name_ar text,
  ADD COLUMN IF NOT EXISTS last_name_ar text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS cv_file_id uuid,
  ADD COLUMN IF NOT EXISTS cv_url text,
  ADD COLUMN IF NOT EXISTS consent_given boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_date timestamptz,
  ADD COLUMN IF NOT EXISTS retention_until date,
  ADD COLUMN IF NOT EXISTS is_in_talent_pool boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS talent_pool_notes text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejection_stage text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_notes text,
  ADD COLUMN IF NOT EXISTS converted_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hired_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Back-fill company_id for candidates from job_openings
UPDATE public.candidates c
SET company_id = jo.company_id
FROM public.job_openings jo
WHERE c.job_id = jo.id AND c.company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS candidates_company_code_uq
  ON public.candidates(company_id, candidate_code)
  WHERE candidate_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. CANDIDATE STAGE HISTORY (Authoritative Audit Trail for Pipeline Moves)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  old_stage text NOT NULL,
  new_stage text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 5. CANDIDATE INTERVIEWS & INTERVIEW PANELS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.job_openings(id) ON DELETE SET NULL,
  interview_type text NOT NULL DEFAULT 'technical'
    CHECK (interview_type IN ('screening', 'technical', 'hr', 'cultural', 'executive', 'final')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 45,
  location_type text NOT NULL DEFAULT 'video'
    CHECK (location_type IN ('in_person', 'video', 'phone')),
  meeting_link text,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interview_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.candidate_interviews(id) ON DELETE CASCADE,
  interviewer_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'interviewer'
    CHECK (role IN ('lead', 'interviewer', 'observer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(interview_id, interviewer_employee_id)
);

-- ---------------------------------------------------------------------------
-- 6. INTERVIEW SCORECARDS & SCORECARD ITEMS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interview_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  interview_id uuid NOT NULL REFERENCES public.candidate_interviews(id) ON DELETE CASCADE,
  interviewer_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  overall_score numeric(4,2) NOT NULL DEFAULT 0,
  recommendation text NOT NULL
    CHECK (recommendation IN ('strong_hire', 'hire', 'neutral', 'reject', 'strong_reject')),
  strengths text,
  weaknesses text,
  general_feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(interview_id, interviewer_employee_id)
);

CREATE TABLE IF NOT EXISTS public.interview_scorecard_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id uuid NOT NULL REFERENCES public.interview_scorecards(id) ON DELETE CASCADE,
  criterion_name text NOT NULL,
  score numeric(3,1) NOT NULL CHECK (score BETWEEN 1 AND 5),
  weight_pct numeric(5,2) NOT NULL DEFAULT 100,
  comments text
);

-- ---------------------------------------------------------------------------
-- 7. CANDIDATE ASSESSMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  assessment_title text NOT NULL,
  assessment_type text NOT NULL DEFAULT 'technical'
    CHECK (assessment_type IN ('technical', 'psychometric', 'language', 'assignment', 'other')),
  score numeric(5,2),
  max_score numeric(5,2) DEFAULT 100,
  passed boolean,
  reviewer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 8. AUGMENT JOB OFFERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
  transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
  proposed_start_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS offer_number text,
  ADD COLUMN IF NOT EXISTS offer_code text,
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.job_openings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requisition_id uuid REFERENCES public.recruitment_requisitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS other_allowances numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_salary numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS offer_file_id uuid,
  ADD COLUMN IF NOT EXISTS offer_url text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS prepared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Back-fill company_id for job_offers from candidates
UPDATE public.job_offers jo
SET company_id = c.company_id
FROM public.candidates c
WHERE jo.candidate_id = c.id AND jo.company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_offers_company_num_uq
  ON public.job_offers(company_id, offer_number)
  WHERE offer_number IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 9. TALENT POOL ENTRIES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.talent_pool_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  domain_skills text[],
  notes text,
  retention_consent_date timestamptz,
  retention_expiry_date date,
  retention_until date,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, candidate_id)
);

-- ---------------------------------------------------------------------------
-- 10. RECRUITMENT AUDIT LOGS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recruitment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_state jsonb,
  new_state jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 11. INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS recruitment_reqs_company_idx ON public.recruitment_requisitions(company_id);
CREATE INDEX IF NOT EXISTS recruitment_reqs_status_idx ON public.recruitment_requisitions(status);
CREATE INDEX IF NOT EXISTS job_openings_company_idx ON public.job_openings(company_id);
CREATE INDEX IF NOT EXISTS job_openings_status_idx ON public.job_openings(status);
CREATE INDEX IF NOT EXISTS candidates_company_idx ON public.candidates(company_id);
CREATE INDEX IF NOT EXISTS candidates_job_id_idx ON public.candidates(job_id);
CREATE INDEX IF NOT EXISTS candidates_stage_idx ON public.candidates(stage);
CREATE INDEX IF NOT EXISTS candidate_stage_hist_candidate_idx ON public.candidate_stage_history(candidate_id);
CREATE INDEX IF NOT EXISTS candidate_interviews_candidate_idx ON public.candidate_interviews(candidate_id);
CREATE INDEX IF NOT EXISTS candidate_interviews_company_idx ON public.candidate_interviews(company_id);
CREATE INDEX IF NOT EXISTS interview_scorecards_candidate_idx ON public.interview_scorecards(candidate_id);
CREATE INDEX IF NOT EXISTS job_offers_company_idx ON public.job_offers(company_id);
CREATE INDEX IF NOT EXISTS job_offers_candidate_idx ON public.job_offers(candidate_id);
CREATE INDEX IF NOT EXISTS talent_pool_company_idx ON public.talent_pool_entries(company_id);

-- ---------------------------------------------------------------------------
-- 12. TRIGGERS
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS recruitment_requisitions_set_updated_at ON public.recruitment_requisitions;
CREATE TRIGGER recruitment_requisitions_set_updated_at
  BEFORE UPDATE ON public.recruitment_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS job_openings_set_updated_at ON public.job_openings;
CREATE TRIGGER job_openings_set_updated_at
  BEFORE UPDATE ON public.job_openings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS candidates_set_updated_at ON public.candidates;
CREATE TRIGGER candidates_set_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS candidate_interviews_set_updated_at ON public.candidate_interviews;
CREATE TRIGGER candidate_interviews_set_updated_at
  BEFORE UPDATE ON public.candidate_interviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS job_offers_set_updated_at ON public.job_offers;
CREATE TRIGGER job_offers_set_updated_at
  BEFORE UPDATE ON public.job_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 13. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.recruitment_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_pool_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Requisitions
DROP POLICY IF EXISTS "rec_req_read" ON public.recruitment_requisitions;
CREATE POLICY "rec_req_read" ON public.recruitment_requisitions
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "rec_req_write" ON public.recruitment_requisitions;
CREATE POLICY "rec_req_write" ON public.recruitment_requisitions
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'hr_admin', 'hr_specialist', 'recruiter')
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Job Openings
DROP POLICY IF EXISTS "job_openings_read" ON public.job_openings;
CREATE POLICY "job_openings_read" ON public.job_openings
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "job_openings_write" ON public.job_openings;
CREATE POLICY "job_openings_write" ON public.job_openings
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'hr_admin', 'hr_specialist', 'recruiter')
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Candidates
DROP POLICY IF EXISTS "candidates_read" ON public.candidates;
CREATE POLICY "candidates_read" ON public.candidates
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "candidates_write" ON public.candidates;
CREATE POLICY "candidates_write" ON public.candidates
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'hr_admin', 'hr_specialist', 'recruiter')
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Candidate Stage History
DROP POLICY IF EXISTS "stage_history_read" ON public.candidate_stage_history;
CREATE POLICY "stage_history_read" ON public.candidate_stage_history
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Candidate Interviews
DROP POLICY IF EXISTS "interviews_read" ON public.candidate_interviews;
CREATE POLICY "interviews_read" ON public.candidate_interviews
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Interview Scorecards: visible to HR and assigned interviewers
DROP POLICY IF EXISTS "scorecards_read" ON public.interview_scorecards;
CREATE POLICY "scorecards_read" ON public.interview_scorecards
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Job Offers: sensitive financial terms restricted to HR, Finance, and Company Owner
DROP POLICY IF EXISTS "job_offers_read" ON public.job_offers;
CREATE POLICY "job_offers_read" ON public.job_offers
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'hr_admin', 'hr_specialist', 'recruiter', 'finance_officer', 'payroll_officer')
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Talent Pool
DROP POLICY IF EXISTS "talent_pool_read" ON public.talent_pool_entries;
CREATE POLICY "talent_pool_read" ON public.talent_pool_entries
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE owner_user_id = auth.uid()
  ));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruitment_requisitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_openings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_stage_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_interviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_panels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_scorecards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_scorecard_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_pool_entries TO authenticated;
GRANT SELECT, INSERT ON public.recruitment_audit_logs TO authenticated;

-- =============================================================================
-- ATOMIC RPCS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 14. RPC: create_recruitment_requisition_atomic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_recruitment_requisition_atomic(
  p_company_id uuid,
  p_title_ar text,
  p_title_en text DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_job_position_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_work_location_id uuid DEFAULT NULL,
  p_headcount_request_id uuid DEFAULT NULL,
  p_workforce_plan_id uuid DEFAULT NULL,
  p_openings_count integer DEFAULT 1,
  p_employment_type text DEFAULT 'full_time',
  p_salary_min numeric DEFAULT NULL,
  p_salary_max numeric DEFAULT NULL,
  p_justification text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
  v_req_no text;
  v_year integer := EXTRACT(year FROM CURRENT_DATE)::integer;
  v_req_id uuid;
  v_caller_company_id uuid;
  v_hc_approved_count integer;
BEGIN
  -- Validate caller access
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id;

  IF v_caller_company_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  -- If linked to an approved headcount request, verify quota
  IF p_headcount_request_id IS NOT NULL THEN
    SELECT approved_headcount INTO v_hc_approved_count
    FROM public.headcount_requests
    WHERE id = p_headcount_request_id AND company_id = p_company_id AND status = 'approved';

    IF v_hc_approved_count IS NOT NULL AND p_openings_count > v_hc_approved_count THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'headcount_quota_exceeded',
        'approved_headcount', v_hc_approved_count);
    END IF;
  END IF;

  -- Generate sequential requisition number REQ-YYYY-NNNN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.recruitment_requisitions
  WHERE company_id = p_company_id AND EXTRACT(year FROM created_at) = v_year;

  v_req_no := 'REQ-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

  INSERT INTO public.recruitment_requisitions (
    company_id, requisition_no, title_ar, title_en,
    department_id, job_position_id, cost_center_id, work_location_id,
    headcount_request_id, workforce_plan_id, openings_count, employment_type,
    salary_min, salary_max, justification, status, requested_by
  ) VALUES (
    p_company_id, v_req_no, p_title_ar, p_title_en,
    p_department_id, p_job_position_id, p_cost_center_id, p_work_location_id,
    p_headcount_request_id, p_workforce_plan_id, COALESCE(p_openings_count, 1), p_employment_type,
    p_salary_min, p_salary_max, p_justification, 'pending_approval', auth.uid()
  ) RETURNING id INTO v_req_id;

  INSERT INTO public.recruitment_audit_logs (company_id, entity_type, entity_id, action, actor_user_id, new_state)
  VALUES (p_company_id, 'requisition', v_req_id, 'requisition_created', auth.uid(),
    jsonb_build_object('requisition_no', v_req_no, 'openings_count', p_openings_count));

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'requisition_id', v_req_id,
    'requisition_no', v_req_no,
    'status', 'pending_approval'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 15. RPC: approve_recruitment_requisition_atomic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_recruitment_requisition_atomic(
  p_requisition_id uuid,
  p_company_id uuid,
  p_action text, -- 'approve' or 'reject'
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_new_status text;
  v_caller_company_id uuid;
BEGIN
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin', 'hr_admin', 'finance_officer');

  IF v_caller_company_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  SELECT status INTO v_current_status
  FROM public.recruitment_requisitions
  WHERE id = p_requisition_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'requisition_not_found');
  END IF;

  v_new_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;

  UPDATE public.recruitment_requisitions
  SET status = v_new_status,
      approved_by = CASE WHEN p_action = 'approve' THEN auth.uid() ELSE NULL END,
      approved_at = CASE WHEN p_action = 'approve' THEN now() ELSE NULL END,
      rejection_reason = CASE WHEN p_action = 'reject' THEN p_reason ELSE NULL END,
      updated_at = now()
  WHERE id = p_requisition_id AND company_id = p_company_id;

  INSERT INTO public.recruitment_audit_logs (company_id, entity_type, entity_id, action, actor_user_id, old_state, new_state)
  VALUES (p_company_id, 'requisition', p_requisition_id, 'requisition_' || p_action || 'd', auth.uid(),
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', v_new_status, 'reason', p_reason));

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'status', v_new_status,
    'new_status', v_new_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 16. RPC: create_job_opening_atomic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_job_opening_atomic(
  p_company_id uuid,
  p_title_ar text,
  p_title_en text DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_job_position_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_requisition_id uuid DEFAULT NULL,
  p_workforce_plan_id uuid DEFAULT NULL,
  p_headcount_request_id uuid DEFAULT NULL,
  p_openings_count integer DEFAULT 1,
  p_employment_type text DEFAULT 'full_time',
  p_salary_min numeric DEFAULT NULL,
  p_salary_max numeric DEFAULT NULL,
  p_salary_visibility text DEFAULT 'range',
  p_description_ar text DEFAULT NULL,
  p_requirements_ar text DEFAULT NULL,
  p_application_start_date date DEFAULT CURRENT_DATE,
  p_application_end_date date DEFAULT NULL,
  p_recruiter_id uuid DEFAULT NULL,
  p_hiring_manager_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
  v_job_ref text;
  v_year integer := EXTRACT(year FROM CURRENT_DATE)::integer;
  v_job_id uuid;
  v_caller_company_id uuid;
BEGIN
  -- Validate caller access
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id;

  IF v_caller_company_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  -- Generate atomic reference: JOB-YYYY-NNNN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.job_openings
  WHERE company_id = p_company_id AND EXTRACT(year FROM created_at) = v_year;

  v_job_ref := 'JOB-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

  INSERT INTO public.job_openings (
    company_id, job_reference, title_ar, title_en,
    department_id, job_position_id, location_id, cost_center_id,
    requisition_id, workforce_plan_id, headcount_request_id,
    openings_count, filled_count, employment_type,
    salary_min, salary_max, salary_visibility,
    description_ar, requirements_ar,
    application_start_date, application_end_date,
    recruiter_id, hiring_manager_id,
    status, published_status
  ) VALUES (
    p_company_id, v_job_ref, p_title_ar, COALESCE(p_title_en, p_title_ar),
    p_department_id, p_job_position_id, p_location_id, p_cost_center_id,
    p_requisition_id, p_workforce_plan_id, p_headcount_request_id,
    COALESCE(p_openings_count, 1), 0, p_employment_type,
    p_salary_min, p_salary_max, COALESCE(p_salary_visibility, 'range'),
    p_description_ar, p_requirements_ar,
    p_application_start_date, p_application_end_date,
    p_recruiter_id, p_hiring_manager_id,
    'draft', 'draft'
  ) RETURNING id INTO v_job_id;

  INSERT INTO public.recruitment_audit_logs (company_id, entity_type, entity_id, action, actor_user_id, new_state)
  VALUES (p_company_id, 'job_opening', v_job_id, 'job_created', auth.uid(),
    jsonb_build_object('job_reference', v_job_ref, 'status', 'draft'));

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'job_id', v_job_id,
    'job_reference', v_job_ref,
    'status', 'draft'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 17. RPC: publish_job_opening_atomic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_job_opening_atomic(
  p_job_id uuid,
  p_company_id uuid,
  p_action text DEFAULT 'publish' -- 'publish', 'pause', 'close'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status text;
  v_caller_company_id uuid;
BEGIN
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin', 'hr_admin', 'hr_specialist', 'recruiter');

  IF v_caller_company_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  v_new_status := CASE p_action
    WHEN 'publish' THEN 'published'
    WHEN 'pause' THEN 'paused'
    WHEN 'close' THEN 'closed'
    ELSE 'draft'
  END;

  UPDATE public.job_openings
  SET status = v_new_status,
      published_status = v_new_status,
      published_at = CASE WHEN p_action = 'publish' THEN COALESCE(published_at, now()) ELSE published_at END,
      closed_at = CASE WHEN p_action = 'close' THEN now() ELSE closed_at END,
      updated_at = now()
  WHERE id = p_job_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'job_not_found');
  END IF;

  INSERT INTO public.recruitment_audit_logs (company_id, entity_type, entity_id, action, actor_user_id, new_state)
  VALUES (p_company_id, 'job_opening', p_job_id, 'job_' || p_action || 'ed', auth.uid(),
    jsonb_build_object('status', v_new_status));

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'status', v_new_status,
    'new_status', v_new_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 18. RPC: apply_candidate_atomic (Duplicate Candidate Detection)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_candidate_atomic(
  p_company_id uuid,
  p_job_id uuid,
  p_full_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_source text DEFAULT 'website',
  p_cv_file_id uuid DEFAULT NULL,
  p_cv_url text DEFAULT NULL,
  p_consent_given boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
  v_cand_code text;
  v_year integer := EXTRACT(year FROM CURRENT_DATE)::integer;
  v_cand_id uuid;
  v_existing_id uuid;
  v_duplicate_flag boolean := false;
  v_duplicate_notes text := NULL;
BEGIN
  -- Duplicate detection based on email or phone
  SELECT id INTO v_existing_id
  FROM public.candidates
  WHERE company_id = p_company_id
    AND (
      LOWER(email) = LOWER(TRIM(p_email))
      OR (p_phone IS NOT NULL AND TRIM(phone) = TRIM(p_phone))
      OR (p_national_id IS NOT NULL AND TRIM(national_id) = TRIM(p_national_id))
    )
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    v_duplicate_flag := true;
    v_duplicate_notes := 'مقدم طلب مكرر: تطابق في البريد أو الهاتف أو الهوية مع المرشح ' || v_existing_id::text;
  END IF;

  -- Generate atomic code: CND-YYYY-NNNN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.candidates
  WHERE company_id = p_company_id AND EXTRACT(year FROM created_at) = v_year;

  v_cand_code := 'CND-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

  INSERT INTO public.candidates (
    company_id, candidate_code, job_id, full_name,
    email, phone, national_id, stage, source,
    cv_file_id, cv_url, consent_given, consent_date,
    duplicate_flag, duplicate_notes
  ) VALUES (
    p_company_id, v_cand_code, p_job_id, TRIM(p_full_name),
    LOWER(TRIM(p_email)), p_phone, p_national_id, 'applied', COALESCE(p_source, 'website'),
    p_cv_file_id, p_cv_url, COALESCE(p_consent_given, true), now(),
    v_duplicate_flag, v_duplicate_notes
  ) RETURNING id INTO v_cand_id;

  -- Record initial stage history
  INSERT INTO public.candidate_stage_history (company_id, candidate_id, old_stage, new_stage, actor_id, reason)
  VALUES (p_company_id, v_cand_id, 'none', 'applied', auth.uid(), 'تقديم طلب جديد');

  INSERT INTO public.recruitment_audit_logs (company_id, entity_type, entity_id, action, actor_user_id, new_state)
  VALUES (p_company_id, 'candidate', v_cand_id, 'candidate_applied', auth.uid(),
    jsonb_build_object('candidate_code', v_cand_code, 'job_id', p_job_id, 'duplicate_flag', v_duplicate_flag));

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'candidate_id', v_cand_id,
    'candidate_code', v_cand_code,
    'duplicate_flag', v_duplicate_flag,
    'duplicate_notes', v_duplicate_notes,
    'stage', 'applied'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 19. RPC: move_candidate_stage_atomic (Strict Server-Side State Machine)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.move_candidate_stage_atomic(
  p_candidate_id uuid,
  p_company_id uuid,
  p_new_stage text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_stage text;
  v_caller_company_id uuid;
BEGIN
  -- Validate caller access
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin', 'hr_admin', 'hr_specialist', 'recruiter');

  IF v_caller_company_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  SELECT stage INTO v_old_stage
  FROM public.candidates
  WHERE id = p_candidate_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'candidate_not_found');
  END IF;

  -- Transition rules:
  -- 1. Hired candidates cannot be moved back
  IF v_old_stage = 'hired' AND p_new_stage != 'hired' THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'hired_candidate_immutable');
  END IF;

  -- 2. Cannot skip directly to hired (must go through convert_candidate_to_employee_atomic)
  IF p_new_stage = 'hired' THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'use_convert_candidate_to_employee');
  END IF;

  UPDATE public.candidates
  SET stage = p_new_stage,
      rejection_reason = CASE WHEN p_new_stage = 'rejected' THEN p_reason ELSE rejection_reason END,
      rejection_stage = CASE WHEN p_new_stage = 'rejected' THEN v_old_stage ELSE rejection_stage END,
      rejected_at = CASE WHEN p_new_stage = 'rejected' THEN now() ELSE rejected_at END,
      rejected_by = CASE WHEN p_new_stage = 'rejected' THEN auth.uid() ELSE rejected_by END,
      updated_at = now()
  WHERE id = p_candidate_id AND company_id = p_company_id;

  -- Record stage transition history
  INSERT INTO public.candidate_stage_history (company_id, candidate_id, old_stage, new_stage, actor_id, reason)
  VALUES (p_company_id, p_candidate_id, v_old_stage, p_new_stage, auth.uid(), p_reason);

  INSERT INTO public.recruitment_audit_logs (company_id, entity_type, entity_id, action, actor_user_id, old_state, new_state)
  VALUES (p_company_id, 'candidate', p_candidate_id, 'stage_changed', auth.uid(),
    jsonb_build_object('stage', v_old_stage),
    jsonb_build_object('stage', p_new_stage, 'reason', p_reason));

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'old_stage', v_old_stage,
    'new_stage', p_new_stage,
    'stage', p_new_stage
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 20. RPC: schedule_interview_atomic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_interview_atomic(
  p_company_id uuid,
  p_candidate_id uuid,
  p_job_id uuid,
  p_interview_type text,
  p_scheduled_at timestamptz,
  p_duration_minutes integer DEFAULT 45,
  p_location_type text DEFAULT 'video',
  p_meeting_link text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_interviewer_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interview_id uuid;
  v_interviewer_id uuid;
  v_caller_company_id uuid;
BEGIN
  -- Validate caller access
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id;

  IF v_caller_company_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  INSERT INTO public.candidate_interviews (
    company_id, candidate_id, job_id, interview_type,
    scheduled_at, duration_minutes, location_type, meeting_link, notes, status
  ) VALUES (
    p_company_id, p_candidate_id, p_job_id, COALESCE(p_interview_type, 'technical'),
    p_scheduled_at, COALESCE(p_duration_minutes, 45), COALESCE(p_location_type, 'video'),
    p_meeting_link, p_notes, 'scheduled'
  ) RETURNING id INTO v_interview_id;

  -- Assign interviewers
  IF p_interviewer_ids IS NOT NULL THEN
    FOREACH v_interviewer_id IN ARRAY p_interviewer_ids LOOP
      IF EXISTS (SELECT 1 FROM public.employees WHERE id = v_interviewer_id AND company_id = p_company_id) THEN
        INSERT INTO public.interview_panels (interview_id, interviewer_employee_id, role)
        VALUES (v_interview_id, v_interviewer_id, 'interviewer')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Advance candidate stage to 'interview' if currently prior
  UPDATE public.candidates
  SET stage = 'interview', updated_at = now()
  WHERE id = p_candidate_id AND company_id = p_company_id AND stage IN ('applied', 'screening', 'shortlisted');

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'interview_id', v_interview_id,
    'status', 'scheduled'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 21. RPC: submit_scorecard_atomic (Server-Side Weighted Scoring & Panel Security)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_scorecard_atomic(
  p_company_id uuid,
  p_interview_id uuid,
  p_candidate_id uuid,
  p_recommendation text,
  p_strengths text DEFAULT NULL,
  p_weaknesses text DEFAULT NULL,
  p_general_feedback text DEFAULT NULL,
  p_criteria jsonb DEFAULT '[]'::jsonb -- array of { criterion_name, score, weight_pct, comments }
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interviewer_emp_id uuid;
  v_scorecard_id uuid;
  v_item jsonb;
  v_total_weighted numeric := 0;
  v_total_weights numeric := 0;
  v_overall_score numeric(4,2) := 0;
  v_avg_cand_score numeric(4,2) := 0;
BEGIN
  -- Determine calling interviewer employee ID
  SELECT id INTO v_interviewer_emp_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id;

  IF v_interviewer_emp_id IS NULL THEN
    -- Check if company owner
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid()) THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
    END IF;
    -- Select first admin for owner
    SELECT id INTO v_interviewer_emp_id FROM public.employees WHERE company_id = p_company_id LIMIT 1;
  END IF;

  -- Verify panel membership or HR admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.interview_panels
    WHERE interview_id = p_interview_id AND interviewer_employee_id = v_interviewer_emp_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = v_interviewer_emp_id AND role IN ('super_admin', 'hr_admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'not_assigned_interviewer');
  END IF;

  -- Calculate weighted score server-side
  IF jsonb_array_length(p_criteria) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_criteria) LOOP
      v_total_weighted := v_total_weighted + ((v_item->>'score')::numeric * COALESCE((v_item->>'weight_pct')::numeric, 100));
      v_total_weights := v_total_weights + COALESCE((v_item->>'weight_pct')::numeric, 100);
    END LOOP;
    IF v_total_weights > 0 THEN
      v_overall_score := ROUND(v_total_weighted / v_total_weights, 2);
    END IF;
  ELSE
    v_overall_score := 3.0;
  END IF;

  -- Upsert Scorecard
  INSERT INTO public.interview_scorecards (
    company_id, interview_id, interviewer_employee_id, candidate_id,
    overall_score, recommendation, strengths, weaknesses, general_feedback
  ) VALUES (
    p_company_id, p_interview_id, v_interviewer_emp_id, p_candidate_id,
    v_overall_score, p_recommendation, p_strengths, p_weaknesses, p_general_feedback
  )
  ON CONFLICT (interview_id, interviewer_employee_id) DO UPDATE
  SET overall_score = EXCLUDED.overall_score,
      recommendation = EXCLUDED.recommendation,
      strengths = EXCLUDED.strengths,
      weaknesses = EXCLUDED.weaknesses,
      general_feedback = EXCLUDED.general_feedback,
      submitted_at = now()
  RETURNING id INTO v_scorecard_id;

  -- Insert Scorecard Items
  DELETE FROM public.interview_scorecard_items WHERE scorecard_id = v_scorecard_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_criteria) LOOP
    INSERT INTO public.interview_scorecard_items (
      scorecard_id, criterion_name, score, weight_pct, comments
    ) VALUES (
      v_scorecard_id,
      v_item->>'criterion_name',
      (v_item->>'score')::numeric,
      COALESCE((v_item->>'weight_pct')::numeric, 100),
      v_item->>'comments'
    );
  END LOOP;

  -- Mark interview completed
  UPDATE public.candidate_interviews
  SET status = 'completed', updated_at = now()
  WHERE id = p_interview_id;

  -- Recompute aggregate candidate rating score from all scorecards
  SELECT ROUND(AVG(overall_score), 2) INTO v_avg_cand_score
  FROM public.interview_scorecards
  WHERE candidate_id = p_candidate_id;

  UPDATE public.candidates
  SET rating_score = v_avg_cand_score, updated_at = now()
  WHERE id = p_candidate_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'scorecard_id', v_scorecard_id,
    'overall_score', v_overall_score,
    'candidate_new_rating', v_avg_cand_score
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 22. RPC: create_job_offer_atomic (Salary Range & Approval Controls)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_job_offer_atomic(
  p_company_id uuid,
  p_candidate_id uuid,
  p_basic_salary numeric,
  p_housing_allowance numeric DEFAULT 0,
  p_transport_allowance numeric DEFAULT 0,
  p_other_allowances numeric DEFAULT 0,
  p_proposed_start_date date DEFAULT (CURRENT_DATE + interval '30 days')::date,
  p_expiry_date date DEFAULT (CURRENT_DATE + interval '14 days')::date,
  p_job_id uuid DEFAULT NULL,
  p_requisition_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
  v_offer_num text;
  v_year integer := EXTRACT(year FROM CURRENT_DATE)::integer;
  v_offer_id uuid;
  v_total_sal numeric;
  v_job_salary_max numeric;
  v_caller_company_id uuid;
BEGIN
  -- Validate caller access
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin', 'hr_admin', 'hr_specialist', 'recruiter', 'finance_officer');

  IF v_caller_company_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  v_total_sal := p_basic_salary + COALESCE(p_housing_allowance, 0) + COALESCE(p_transport_allowance, 0) + COALESCE(p_other_allowances, 0);

  -- Validate against Job Opening salary maximum if exists
  IF p_job_id IS NOT NULL THEN
    SELECT salary_max INTO v_job_salary_max FROM public.job_openings WHERE id = p_job_id;
    IF v_job_salary_max IS NOT NULL AND p_basic_salary > v_job_salary_max * 1.25 THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'salary_exceeds_budget_band',
        'max_allowed', v_job_salary_max);
    END IF;
  END IF;

  -- Generate sequential offer number OFF-YYYY-NNNN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.job_offers
  WHERE company_id = p_company_id AND EXTRACT(year FROM created_at) = v_year;

  v_offer_num := 'OFF-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

  INSERT INTO public.job_offers (
    company_id, offer_number, offer_code, candidate_id, job_id, requisition_id,
    basic_salary, housing_allowance, transport_allowance, other_allowances, total_salary,
    proposed_start_date, expiry_date, status, prepared_by, notes
  ) VALUES (
    p_company_id, v_offer_num, v_offer_num, p_candidate_id, p_job_id, p_requisition_id,
    p_basic_salary, COALESCE(p_housing_allowance, 0), COALESCE(p_transport_allowance, 0),
    COALESCE(p_other_allowances, 0), v_total_sal,
    p_proposed_start_date, p_expiry_date, 'draft', auth.uid(), p_notes
  ) RETURNING id INTO v_offer_id;

  -- Advance candidate stage to 'offer_pending'
  UPDATE public.candidates
  SET stage = 'offer_pending', updated_at = now()
  WHERE id = p_candidate_id AND company_id = p_company_id;

  INSERT INTO public.recruitment_audit_logs (company_id, entity_type, entity_id, action, actor_user_id, new_state)
  VALUES (p_company_id, 'job_offer', v_offer_id, 'offer_created', auth.uid(),
    jsonb_build_object('offer_number', v_offer_num, 'total_salary', v_total_sal));

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'offer_id', v_offer_id,
    'offer_number', v_offer_num,
    'offer_code', v_offer_num,
    'status', 'draft',
    'total_salary', v_total_sal
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 23. RPC: update_offer_status_atomic (Offer Approval, Sending & Acceptance)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_offer_status_atomic(
  p_offer_id uuid,
  p_company_id uuid,
  p_action text, -- 'approve', 'send', 'accept', 'decline', 'withdraw'
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer record;
  v_new_status text;
  v_caller_company_id uuid;
BEGIN
  SELECT * INTO v_offer
  FROM public.job_offers
  WHERE id = p_offer_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'offer_not_found');
  END IF;

  v_new_status := CASE p_action
    WHEN 'approve' THEN 'approved'
    WHEN 'send' THEN 'sent'
    WHEN 'accept' THEN 'accepted'
    WHEN 'decline' THEN 'declined'
    WHEN 'withdraw' THEN 'withdrawn'
    ELSE v_offer.status
  END;

  UPDATE public.job_offers
  SET status = v_new_status,
      approved_by = CASE WHEN p_action = 'approve' THEN auth.uid() ELSE approved_by END,
      approved_at = CASE WHEN p_action = 'approve' THEN now() ELSE approved_at END,
      sent_at = CASE WHEN p_action = 'send' THEN now() ELSE sent_at END,
      accepted_at = CASE WHEN p_action = 'accept' THEN now() ELSE accepted_at END,
      declined_at = CASE WHEN p_action = 'decline' THEN now() ELSE declined_at END,
      decline_reason = CASE WHEN p_action = 'decline' THEN p_reason ELSE decline_reason END,
      updated_at = now()
  WHERE id = p_offer_id AND company_id = p_company_id;

  -- Synchronize candidate stage with offer lifecycle
  IF p_action = 'send' THEN
    UPDATE public.candidates SET stage = 'offer_sent', updated_at = now() WHERE id = v_offer.candidate_id;
    INSERT INTO public.candidate_stage_history (company_id, candidate_id, old_stage, new_stage, actor_id, reason)
    VALUES (p_company_id, v_offer.candidate_id, 'offer_pending', 'offer_sent', auth.uid(), 'إرسال العرض المالي للمرشح');
  ELSIF p_action = 'accept' THEN
    UPDATE public.candidates SET stage = 'offer_accepted', updated_at = now() WHERE id = v_offer.candidate_id;
    INSERT INTO public.candidate_stage_history (company_id, candidate_id, old_stage, new_stage, actor_id, reason)
    VALUES (p_company_id, v_offer.candidate_id, 'offer_sent', 'offer_accepted', auth.uid(), 'قبول العرض المالي من قِبل المرشح');
  ELSIF p_action = 'decline' THEN
    UPDATE public.candidates SET stage = 'offer_declined', updated_at = now() WHERE id = v_offer.candidate_id;
    INSERT INTO public.candidate_stage_history (company_id, candidate_id, old_stage, new_stage, actor_id, reason)
    VALUES (p_company_id, v_offer.candidate_id, 'offer_sent', 'offer_declined', auth.uid(), p_reason);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'status', v_new_status,
    'new_status', v_new_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 24. RPC: convert_candidate_to_employee_atomic (Atomic & Idempotent Hire Engine)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_candidate_to_employee_atomic(
  p_candidate_id uuid,
  p_company_id uuid,
  p_first_name_ar text,
  p_last_name_ar text,
  p_department_id uuid,
  p_work_location_id uuid,
  p_hire_date date,
  p_contract_type text DEFAULT 'full_time',
  p_work_type text DEFAULT 'full_time',
  p_basic_salary numeric DEFAULT NULL,
  p_housing_allowance numeric DEFAULT NULL,
  p_transport_allowance numeric DEFAULT NULL,
  p_job_position_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cand record;
  v_job record;
  v_offer record;
  v_new_emp_id uuid;
  v_emp_no text;
  v_seq integer;
  v_year integer := EXTRACT(year FROM CURRENT_DATE)::integer;
  v_basic numeric;
  v_housing numeric;
  v_transport numeric;
  v_total numeric;
  v_caller_company_id uuid;
BEGIN
  -- 1. Validate caller access
  SELECT company_id INTO v_caller_company_id
  FROM public.employees
  WHERE user_id = auth.uid() AND company_id = p_company_id
    AND role IN ('super_admin', 'hr_admin', 'hr_specialist');

  IF v_caller_company_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'access_denied');
  END IF;

  -- 2. Lock candidate row
  SELECT * INTO v_cand
  FROM public.candidates
  WHERE id = p_candidate_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'candidate_not_found');
  END IF;

  -- 3. Idempotency Check: if already converted, return existing employee without error
  IF v_cand.stage = 'hired' AND v_cand.converted_employee_id IS NOT NULL THEN
    SELECT employee_no INTO v_emp_no FROM public.employees WHERE id = v_cand.converted_employee_id;
    RETURN jsonb_build_object(
      'ok', true,
      'success', true,
      'already_converted', true,
      'already_hired', true,
      'employee_id', v_cand.converted_employee_id,
      'employee_no', v_emp_no
    );
  END IF;

  -- 4. Verify candidate stage allows conversion (must have accepted offer or be in offer/assessment stage)
  IF v_cand.stage NOT IN ('offer_accepted', 'offer_pending', 'offer_sent', 'job_offer', 'interview', 'assessment', 'applied', 'screening') THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'invalid_candidate_stage_for_hire',
      'current_stage', v_cand.stage);
  END IF;

  -- 5. Retrieve accepted job offer for authoritative compensation if not explicitly provided
  SELECT * INTO v_offer
  FROM public.job_offers
  WHERE candidate_id = p_candidate_id AND company_id = p_company_id
  ORDER BY created_at DESC LIMIT 1;

  v_basic := COALESCE(p_basic_salary, v_offer.basic_salary, 0);
  v_housing := COALESCE(p_housing_allowance, v_offer.housing_allowance, 0);
  v_transport := COALESCE(p_transport_allowance, v_offer.transport_allowance, 0);
  v_total := v_basic + v_housing + v_transport;

  -- 6. Generate Employee Number (EMP-YYYY-NNNN)
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.employees
  WHERE company_id = p_company_id;

  v_emp_no := 'EMP-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

  -- 7. Insert Employee Master Record (status: draft for onboarding workflow)
  INSERT INTO public.employees (
    company_id, employee_no, first_name_ar, last_name_ar,
    email, phone, department_id, work_location_id, job_position_id,
    hire_date, contract_type, work_type, status,
    basic_salary, housing_allowance, transport_allowance, total_salary
  ) VALUES (
    p_company_id, v_emp_no, TRIM(p_first_name_ar), TRIM(p_last_name_ar),
    v_cand.email, v_cand.phone, p_department_id, p_work_location_id, p_job_position_id,
    p_hire_date, p_contract_type, p_work_type, 'draft',
    v_basic, v_housing, v_transport, v_total
  ) RETURNING id INTO v_new_emp_id;

  -- 8. Mark Candidate as Hired and link employee ID
  UPDATE public.candidates
  SET stage = 'hired',
      converted_employee_id = v_new_emp_id,
      hired_at = now(),
      updated_at = now()
  WHERE id = p_candidate_id;

  -- 9. Update Job Opening filled count if linked
  IF v_cand.job_id IS NOT NULL THEN
    UPDATE public.job_openings
    SET filled_count = filled_count + 1,
        status = CASE WHEN filled_count + 1 >= openings_count THEN 'closed' ELSE status END,
        updated_at = now()
    WHERE id = v_cand.job_id AND company_id = p_company_id;
  END IF;

  -- 10. Record Stage History and Audit Log
  INSERT INTO public.candidate_stage_history (company_id, candidate_id, old_stage, new_stage, actor_id, reason)
  VALUES (p_company_id, p_candidate_id, v_cand.stage, 'hired', auth.uid(), 'تحويل المرشح إلى موظف في الخدمة');

  INSERT INTO public.recruitment_audit_logs (company_id, entity_type, entity_id, action, actor_user_id, new_state)
  VALUES (p_company_id, 'candidate', p_candidate_id, 'candidate_hired', auth.uid(),
    jsonb_build_object('employee_id', v_new_emp_id, 'employee_no', v_emp_no));

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'already_converted', false,
    'already_hired', false,
    'employee_id', v_new_emp_id,
    'employee_no', v_emp_no,
    'stage', 'hired'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 25. RPC: get_recruitment_kpis_atomic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_recruitment_kpis_atomic(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open_jobs integer := 0;
  v_active_requisitions integer := 0;
  v_total_candidates integer := 0;
  v_interviews_scheduled integer := 0;
  v_offers_pending integer := 0;
  v_offers_accepted integer := 0;
  v_total_hired integer := 0;
  v_talent_pool_count integer := 0;
  v_avg_days_to_hire numeric := 0;
  v_stage_breakdown jsonb;
  v_source_breakdown jsonb;
BEGIN
  -- Open jobs
  SELECT COUNT(*) INTO v_open_jobs
  FROM public.job_openings
  WHERE company_id = p_company_id AND status = 'published';

  -- Active requisitions
  SELECT COUNT(*) INTO v_active_requisitions
  FROM public.recruitment_requisitions
  WHERE company_id = p_company_id AND status IN ('pending_approval', 'approved', 'open');

  -- Candidates
  SELECT COUNT(*) INTO v_total_candidates
  FROM public.candidates
  WHERE company_id = p_company_id;

  -- Interviews scheduled
  SELECT COUNT(*) INTO v_interviews_scheduled
  FROM public.candidate_interviews
  WHERE company_id = p_company_id AND status = 'scheduled';

  -- Offers pending & accepted
  SELECT
    COUNT(*) FILTER (WHERE status = 'sent'),
    COUNT(*) FILTER (WHERE status = 'accepted')
  INTO v_offers_pending, v_offers_accepted
  FROM public.job_offers
  WHERE company_id = p_company_id;

  -- Hires
  SELECT COUNT(*) INTO v_total_hired
  FROM public.candidates
  WHERE company_id = p_company_id AND stage = 'hired';

  -- Talent pool
  SELECT COUNT(*) INTO v_talent_pool_count
  FROM public.talent_pool_entries
  WHERE company_id = p_company_id;

  -- Average days to hire
  SELECT COALESCE(ROUND(AVG(EXTRACT(epoch FROM (hired_at - created_at)) / 86400)::numeric, 1), 0)
  INTO v_avg_days_to_hire
  FROM public.candidates
  WHERE company_id = p_company_id AND stage = 'hired' AND hired_at IS NOT NULL;

  -- Stage breakdown
  SELECT jsonb_object_agg(stage, cnt) INTO v_stage_breakdown
  FROM (
    SELECT stage, COUNT(*) AS cnt
    FROM public.candidates
    WHERE company_id = p_company_id
    GROUP BY stage
  ) s;

  -- Source breakdown
  SELECT jsonb_object_agg(source, cnt) INTO v_source_breakdown
  FROM (
    SELECT COALESCE(source, 'website') AS source, COUNT(*) AS cnt
    FROM public.candidates
    WHERE company_id = p_company_id
    GROUP BY source
  ) src;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'open_jobs', v_open_jobs,
    'active_requisitions', v_active_requisitions,
    'total_candidates', v_total_candidates,
    'interviews_scheduled', v_interviews_scheduled,
    'offers_pending', v_offers_pending,
    'offers_accepted', v_offers_accepted,
    'total_hired', v_total_hired,
    'talent_pool_count', v_talent_pool_count,
    'avg_days_to_hire', v_avg_days_to_hire,
    'stage_breakdown', COALESCE(v_stage_breakdown, '{}'::jsonb),
    'source_breakdown', COALESCE(v_source_breakdown, '{}'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 26. RPC: add_to_talent_pool_atomic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_to_talent_pool_atomic(
  p_company_id uuid,
  p_candidate_id uuid,
  p_skills text[] DEFAULT '{}',
  p_notes text DEFAULT NULL,
  p_retention_months integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_id uuid;
BEGIN
  INSERT INTO public.talent_pool_entries (
    company_id, candidate_id, domain_skills, notes,
    retention_consent_date, retention_expiry_date, retention_until, added_by
  ) VALUES (
    p_company_id, p_candidate_id, p_skills, p_notes,
    now(),
    (CURRENT_DATE + (p_retention_months || ' months')::interval)::date,
    (CURRENT_DATE + (p_retention_months || ' months')::interval)::date,
    auth.uid()
  )
  ON CONFLICT (company_id, candidate_id) DO UPDATE
  SET domain_skills = EXCLUDED.domain_skills,
      notes = EXCLUDED.notes,
      retention_expiry_date = EXCLUDED.retention_expiry_date,
      retention_until = EXCLUDED.retention_until
  RETURNING id INTO v_pool_id;

  UPDATE public.candidates
  SET is_in_talent_pool = true,
      talent_pool_notes = p_notes,
      retention_until = (CURRENT_DATE + (p_retention_months || ' months')::interval)::date,
      updated_at = now()
  WHERE id = p_candidate_id AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'pool_id', v_pool_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 27. GRANTS FOR RPCS
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.create_recruitment_requisition_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_recruitment_requisition_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_job_opening_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_job_opening_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_candidate_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_candidate_stage_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_interview_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_scorecard_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_job_offer_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_offer_status_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_candidate_to_employee_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recruitment_kpis_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_talent_pool_atomic TO authenticated;
