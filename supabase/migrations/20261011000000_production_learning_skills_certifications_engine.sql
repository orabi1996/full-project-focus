-- ============================================================================
-- MADARX ENTERPRISE WORKFORCE PLATFORM
-- PROMPT 29: PRODUCTION LEARNING, SKILLS, CERTIFICATIONS & TRAINING ENGINE
-- Migration: 20261011000000_production_learning_skills_certifications_engine.sql
-- ============================================================================

-- 1. Skill Categories
CREATE TABLE IF NOT EXISTS public.skill_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_skill_categories_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_skill_cat_company ON public.skill_categories (company_id, is_active);

-- 2. Skills Catalog
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.skill_categories(id) ON DELETE SET NULL,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  category text NOT NULL DEFAULT 'functional' CHECK (category IN (
    'technical', 'functional', 'behavioral', 'leadership', 'digital', 'language', 'safety', 'compliance'
  )),
  proficiency_scale_type text NOT NULL DEFAULT '1_to_5' CHECK (proficiency_scale_type IN ('1_to_5', '1_to_3', 'binary')),
  owner_role text DEFAULT 'hr',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_skills_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_skills_company ON public.skills (company_id, status);
CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills (company_id, category);

-- 3. Training Providers (Internal & External)
CREATE TABLE IF NOT EXISTS public.training_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('internal', 'external')),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  contact_person text,
  email text,
  phone text,
  website text,
  country text DEFAULT 'SA',
  rating numeric(3,1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_providers_company ON public.training_providers (company_id, status);

-- 4. Learning Items & Courses Catalog
CREATE TABLE IF NOT EXISTS public.learning_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN (
    'course', 'workshop', 'program', 'seminar', 'webinar', 'orientation', 'certification_preparation', 'external_training'
  )),
  code text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description_ar text,
  description_en text,
  category text NOT NULL DEFAULT 'functional',
  delivery_method text NOT NULL CHECK (delivery_method IN ('classroom', 'virtual', 'self_paced', 'external', 'blended')),
  duration_hours numeric(6,2) NOT NULL DEFAULT 1.0 CHECK (duration_hours >= 0),
  provider_id uuid REFERENCES public.training_providers(id) ON DELETE SET NULL,
  skills_developed uuid[] DEFAULT '{}'::uuid[],
  target_audience text,
  prerequisites text,
  is_mandatory boolean NOT NULL DEFAULT false,
  validity_months integer,
  estimated_cost numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (estimated_cost >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived', 'deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_learning_items_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_learning_items_company ON public.learning_items (company_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_items_type ON public.learning_items (company_id, item_type);

-- 5. Learning Programs (Curricula composed of multiple items)
CREATE TABLE IF NOT EXISTS public.learning_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  description text,
  target_role text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_learning_programs_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS public.learning_program_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.learning_programs(id) ON DELETE CASCADE,
  learning_item_id uuid NOT NULL REFERENCES public.learning_items(id) ON DELETE CASCADE,
  sequence_order integer NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_program_item UNIQUE (program_id, learning_item_id)
);

CREATE INDEX IF NOT EXISTS idx_program_items_prog ON public.learning_program_items (program_id, sequence_order);

-- 6. Certifications Catalog
CREATE TABLE IF NOT EXISTS public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  issuer text NOT NULL,
  category text NOT NULL DEFAULT 'professional',
  validity_months integer,
  renewal_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_certifications_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_certifications_company ON public.certifications (company_id, is_active);

-- 7. Job / Position / Grade Skill & Certification Requirements
CREATE TABLE IF NOT EXISTS public.job_skill_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_position_id uuid REFERENCES public.job_positions(id) ON DELETE CASCADE,
  grade text,
  job_family text,
  skill_id uuid REFERENCES public.skills(id) ON DELETE CASCADE,
  competency_id uuid REFERENCES public.competencies(id) ON DELETE CASCADE,
  certification_id uuid REFERENCES public.certifications(id) ON DELETE CASCADE,
  required_proficiency numeric(3,1) NOT NULL DEFAULT 3.0 CHECK (required_proficiency >= 1.0 AND required_proficiency <= 5.0),
  is_mandatory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_skill_req_pos ON public.job_skill_requirements (company_id, job_position_id);
CREATE INDEX IF NOT EXISTS idx_job_skill_req_skill ON public.job_skill_requirements (company_id, skill_id);

-- 8. Employee Skill Profile (With Multi-tier Validation Truth)
CREATE TABLE IF NOT EXISTS public.employee_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  self_reported_level numeric(3,1) CHECK (self_reported_level >= 1.0 AND self_reported_level <= 5.0),
  manager_confirmed_level numeric(3,1) CHECK (manager_confirmed_level >= 1.0 AND manager_confirmed_level <= 5.0),
  formally_verified_level numeric(3,1) CHECK (formally_verified_level >= 1.0 AND formally_verified_level <= 5.0),
  current_proficiency numeric(3,1) NOT NULL DEFAULT 1.0 CHECK (current_proficiency >= 1.0 AND current_proficiency <= 5.0),
  source text NOT NULL DEFAULT 'self_assessment' CHECK (source IN (
    'self_assessment', 'manager_assessment', 'formal_assessment', 'training_completion', 'certification', 'hr_validation'
  )),
  assessed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assessed_at timestamptz DEFAULT now(),
  evidence_url text,
  expiry_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_verification', 'expired', 'superseded')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_emp_skills UNIQUE (company_id, employee_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_emp_skills_emp ON public.employee_skills (company_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_skills_skill ON public.employee_skills (company_id, skill_id);

-- 9. Training Sessions (Scheduled, Atomic Capacity Management)
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  learning_item_id uuid NOT NULL REFERENCES public.learning_items(id) ON DELETE CASCADE,
  session_code text NOT NULL,
  trainer_name text,
  provider_id uuid REFERENCES public.training_providers(id) ON DELETE SET NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  location text,
  virtual_url text,
  capacity integer NOT NULL DEFAULT 20 CHECK (capacity >= 1),
  enrolled_count integer NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  registration_deadline date,
  cost_per_seat numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (cost_per_seat >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN (
    'draft', 'open', 'full', 'closed', 'in_progress', 'completed', 'cancelled'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_training_sessions_code UNIQUE (company_id, session_code)
);

CREATE INDEX IF NOT EXISTS idx_sessions_company ON public.training_sessions (company_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_item ON public.training_sessions (learning_item_id);
CREATE INDEX IF NOT EXISTS idx_sessions_dates ON public.training_sessions (company_id, start_date, end_date);

-- 10. Training Enrollments
CREATE TABLE IF NOT EXISTS public.training_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  enrollment_source text NOT NULL CHECK (enrollment_source IN (
    'employee_request', 'manager_nomination', 'hr_assignment', 'mandatory_assignment', 'development_plan', 'onboarding'
  )),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'pending_approval', 'approved', 'enrolled', 'waitlisted', 'rejected', 'cancelled', 'attended', 'completed', 'failed', 'no_show'
  )),
  attendance_status text CHECK (attendance_status IN ('present', 'absent', 'late', 'excused', 'no_show')),
  completion_status text CHECK (completion_status IN ('completed', 'failed', 'in_progress', 'not_started')),
  completion_date date,
  score numeric(5,2),
  passed boolean,
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  cost numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (cost >= 0),
  notes text,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_session_employee UNIQUE (session_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_session ON public.training_enrollments (session_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_emp ON public.training_enrollments (company_id, employee_id, status);

-- 11. Training Needs
CREATE TABLE IF NOT EXISTS public.training_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN (
    'skill_gap', 'performance_review', 'manager_request', 'employee_request', 'mandatory_compliance', 'onboarding', 'career_development', 'organization_initiative'
  )),
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  recommended_learning_item_id uuid REFERENCES public.learning_items(id) ON DELETE SET NULL,
  reason text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'identified' CHECK (status IN (
    'identified', 'proposed', 'approved', 'planned', 'assigned', 'completed', 'cancelled'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_needs_emp ON public.training_needs (company_id, employee_id, status);

-- 12. Employee Learning Plans & Items
CREATE TABLE IF NOT EXISTS public.learning_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year integer NOT NULL DEFAULT extract(year from current_date)::integer,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_learning_plan_year UNIQUE (company_id, employee_id, year)
);

CREATE TABLE IF NOT EXISTS public.learning_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  training_need_id uuid REFERENCES public.training_needs(id) ON DELETE SET NULL,
  learning_item_id uuid REFERENCES public.learning_items(id) ON DELETE SET NULL,
  target_completion_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  source text NOT NULL DEFAULT 'manager',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON public.learning_plan_items (plan_id, status);

-- 13. Learning Assessments
CREATE TABLE IF NOT EXISTS public.learning_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  assessment_type text NOT NULL CHECK (assessment_type IN ('score', 'pass_fail', 'manager_validation', 'trainer_evaluation')),
  score numeric(5,2),
  max_score numeric(5,2) DEFAULT 100,
  passed boolean NOT NULL DEFAULT true,
  assessor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  is_confidential boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessments_emp ON public.learning_assessments (company_id, employee_id);

-- 14. Employee Certifications (With Verification & Document Linkage)
CREATE TABLE IF NOT EXISTS public.employee_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  certification_id uuid NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  certificate_number text NOT NULL,
  issuer text NOT NULL,
  issue_date date NOT NULL,
  expiry_date date,
  document_id uuid,
  verification_status text NOT NULL DEFAULT 'pending_verification' CHECK (verification_status IN (
    'pending_verification', 'verified', 'rejected', 'revoked'
  )),
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  verification_notes text,
  status text NOT NULL DEFAULT 'pending_verification' CHECK (status IN (
    'pending_verification', 'valid', 'expiring', 'expired', 'rejected', 'revoked'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_emp_cert_num UNIQUE (company_id, employee_id, certificate_number)
);

CREATE INDEX IF NOT EXISTS idx_emp_certs_emp ON public.employee_certifications (company_id, employee_id, status);
CREATE INDEX IF NOT EXISTS idx_emp_certs_expiry ON public.employee_certifications (company_id, expiry_date, status);

-- 15. Mandatory Learning Rules
CREATE TABLE IF NOT EXISTS public.mandatory_learning_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_name_ar text NOT NULL,
  rule_name_en text NOT NULL,
  course_id uuid NOT NULL REFERENCES public.learning_items(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('all_employees', 'department', 'job', 'position', 'grade', 'location')),
  target_id uuid,
  target_value text,
  recurrence_months integer DEFAULT 12,
  days_to_complete integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mandatory_rules_company ON public.mandatory_learning_rules (company_id, is_active);

-- ============================================================================
-- 16. ATOMIC BUSINESS STORED PROCEDURES (RPCS)
-- ============================================================================

-- A. Atomic Seat Reservation & Enrollment (Race-Condition Free)
CREATE OR REPLACE FUNCTION public.enroll_in_training_session_atomic(
  p_company_id uuid,
  p_session_id uuid,
  p_employee_id uuid,
  p_source text DEFAULT 'employee_request',
  p_request_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session public.training_sessions%ROWTYPE;
  v_enrollment_id uuid;
  v_status text;
  v_cost numeric(12,2) := 0.00;
BEGIN
  -- 1. Lock the session row to prevent race conditions on capacity
  SELECT * INTO v_session
  FROM public.training_sessions
  WHERE id = p_session_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Training session not found');
  END IF;

  IF v_session.status NOT IN ('open', 'in_progress') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Training session is not open for registration (' || v_session.status || ')');
  END IF;

  -- 2. Check registration deadline
  IF v_session.registration_deadline IS NOT NULL AND v_session.registration_deadline < current_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration deadline has passed');
  END IF;

  -- 3. Check for existing active enrollment
  IF EXISTS (
    SELECT 1 FROM public.training_enrollments
    WHERE session_id = p_session_id AND employee_id = p_employee_id AND status IN ('enrolled', 'requested', 'approved', 'pending_approval')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee is already enrolled or requested for this session');
  END IF;

  -- 4. Check capacity atomically
  IF v_session.enrolled_count >= v_session.capacity THEN
    v_status := 'waitlisted';
  ELSE
    v_status := 'enrolled';
    -- Increment enrolled count
    UPDATE public.training_sessions
    SET enrolled_count = enrolled_count + 1,
        status = CASE WHEN enrolled_count + 1 >= capacity THEN 'full' ELSE status END,
        updated_at = now()
    WHERE id = p_session_id;
  END IF;

  v_cost := v_session.cost_per_seat;

  -- 5. Insert enrollment record
  INSERT INTO public.training_enrollments (
    company_id,
    session_id,
    employee_id,
    enrollment_source,
    status,
    request_id,
    cost,
    notes,
    enrolled_at
  ) VALUES (
    p_company_id,
    p_session_id,
    p_employee_id,
    p_source,
    v_status,
    p_request_id,
    v_cost,
    p_notes,
    now()
  ) RETURNING id INTO v_enrollment_id;

  -- 6. Audit event
  INSERT INTO public.audit_events (
    company_id,
    action,
    entity_type,
    entity_id,
    entity_name,
    changes_summary,
    severity
  ) VALUES (
    p_company_id,
    'learning.enrollment',
    'training_enrollment',
    v_enrollment_id::text,
    v_session.session_code,
    'Enrolled employee ' || p_employee_id::text || ' with status: ' || v_status,
    'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'status', v_status,
    'enrolled_count', CASE WHEN v_status = 'enrolled' THEN v_session.enrolled_count + 1 ELSE v_session.enrolled_count END,
    'capacity', v_session.capacity
  );
END;
$$;

-- B. Calculate Employee Skill Gaps Server-side
CREATE OR REPLACE FUNCTION public.calculate_employee_skill_gaps(
  p_company_id uuid,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_gaps jsonb := '[]'::jsonb;
  v_rec record;
  v_val_prof numeric(3,1);
  v_gap numeric(3,1);
BEGIN
  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Query required skills for employee's position or grade
  FOR v_rec IN
    SELECT 
      r.skill_id,
      s.code as skill_code,
      s.name_ar as skill_name_ar,
      s.name_en as skill_name_en,
      s.category as skill_category,
      r.required_proficiency,
      r.is_mandatory
    FROM public.job_skill_requirements r
    JOIN public.skills s ON s.id = r.skill_id
    WHERE r.company_id = p_company_id
      AND (
        (v_emp.job_position_id IS NOT NULL AND r.job_position_id = v_emp.job_position_id)
        OR (v_emp.grade IS NOT NULL AND r.grade = v_emp.grade)
      )
  LOOP
    -- Fetch validated employee skill level
    SELECT current_proficiency INTO v_val_prof
    FROM public.employee_skills
    WHERE company_id = p_company_id AND employee_id = p_employee_id AND skill_id = v_rec.skill_id;

    v_val_prof := COALESCE(v_val_prof, 0.0);
    v_gap := GREATEST(0.0, v_rec.required_proficiency - v_val_prof);

    v_gaps := v_gaps || jsonb_build_object(
      'skill_id', v_rec.skill_id,
      'skill_code', v_rec.skill_code,
      'skill_name_ar', v_rec.skill_name_ar,
      'skill_name_en', v_rec.skill_name_en,
      'skill_category', v_rec.skill_category,
      'required_proficiency', v_rec.required_proficiency,
      'validated_proficiency', v_val_prof,
      'gap', v_gap,
      'has_gap', (v_gap > 0.0),
      'is_mandatory', v_rec.is_mandatory
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'employee_id', p_employee_id,
    'skill_gaps', v_gaps
  );
END;
$$;

-- C. Record Attendance and Training Completion Atomic
CREATE OR REPLACE FUNCTION public.record_session_attendance_and_completion_atomic(
  p_company_id uuid,
  p_enrollment_id uuid,
  p_attendance_status text,
  p_completion_status text,
  p_score numeric DEFAULT NULL,
  p_passed boolean DEFAULT NULL,
  p_completion_date date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enr public.training_enrollments%ROWTYPE;
  v_sess public.training_sessions%ROWTYPE;
  v_item public.learning_items%ROWTYPE;
  v_skill_id uuid;
BEGIN
  SELECT * INTO v_enr
  FROM public.training_enrollments
  WHERE id = p_enrollment_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enrollment record not found');
  END IF;

  SELECT * INTO v_sess FROM public.training_sessions WHERE id = v_enr.session_id;
  SELECT * INTO v_item FROM public.learning_items WHERE id = v_sess.learning_item_id;

  UPDATE public.training_enrollments
  SET attendance_status = p_attendance_status,
      completion_status = p_completion_status,
      score = p_score,
      passed = COALESCE(p_passed, (p_completion_status = 'completed')),
      completion_date = CASE WHEN p_completion_status = 'completed' THEN p_completion_date ELSE NULL END,
      status = CASE 
        WHEN p_completion_status = 'completed' THEN 'completed'
        WHEN p_completion_status = 'failed' THEN 'failed'
        WHEN p_attendance_status = 'no_show' THEN 'no_show'
        ELSE status 
      END,
      updated_at = now()
  WHERE id = v_enr.id;

  -- If completed, automatically update employee skill levels developed by this course
  IF p_completion_status = 'completed' AND v_item.skills_developed IS NOT NULL THEN
    FOREACH v_skill_id IN ARRAY v_item.skills_developed LOOP
      INSERT INTO public.employee_skills (
        company_id,
        employee_id,
        skill_id,
        current_proficiency,
        formally_verified_level,
        source,
        assessed_at,
        status
      ) VALUES (
        p_company_id,
        v_enr.employee_id,
        v_skill_id,
        3.0, -- Default working proficiency upon training completion
        3.0,
        'training_completion',
        now(),
        'active'
      )
      ON CONFLICT (company_id, employee_id, skill_id)
      DO UPDATE SET
        current_proficiency = GREATEST(public.employee_skills.current_proficiency, 3.0),
        formally_verified_level = GREATEST(COALESCE(public.employee_skills.formally_verified_level, 1.0), 3.0),
        source = 'training_completion',
        assessed_at = now(),
        status = 'active',
        updated_at = now();
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enr.id,
    'completion_status', p_completion_status,
    'attendance_status', p_attendance_status
  );
END;
$$;

-- D. Verify Employee Certification Atomic
CREATE OR REPLACE FUNCTION public.verify_employee_certification_atomic(
  p_company_id uuid,
  p_employee_certification_id uuid,
  p_verification_status text,
  p_verified_by uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cert public.employee_certifications%ROWTYPE;
  v_status text;
BEGIN
  SELECT * INTO v_cert
  FROM public.employee_certifications
  WHERE id = p_employee_certification_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee certification record not found');
  END IF;

  IF p_verification_status = 'verified' THEN
    IF v_cert.expiry_date IS NOT NULL AND v_cert.expiry_date < current_date THEN
      v_status := 'expired';
    ELSIF v_cert.expiry_date IS NOT NULL AND v_cert.expiry_date <= current_date + interval '60 days' THEN
      v_status := 'expiring';
    ELSE
      v_status := 'valid';
    END IF;
  ELSE
    v_status := p_verification_status;
  END IF;

  UPDATE public.employee_certifications
  SET verification_status = p_verification_status,
      status = v_status,
      verified_by = p_verified_by,
      verified_at = now(),
      verification_notes = p_notes,
      updated_at = now()
  WHERE id = v_cert.id;

  INSERT INTO public.audit_events (
    company_id,
    action,
    entity_type,
    entity_id,
    entity_name,
    changes_summary,
    severity
  ) VALUES (
    p_company_id,
    'certification.verified',
    'employee_certification',
    v_cert.id::text,
    v_cert.certificate_number,
    'Certification verification status updated to: ' || p_verification_status,
    'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'certification_id', v_cert.id,
    'verification_status', p_verification_status,
    'status', v_status
  );
END;
$$;

-- E. Check Expiring Certifications and Generate Tasks Atomic
CREATE OR REPLACE FUNCTION public.check_expiring_certifications_and_generate_tasks_atomic(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec record;
  v_count integer := 0;
BEGIN
  -- Find valid certifications expiring within 60 days
  FOR v_rec IN
    SELECT ec.id, ec.employee_id, ec.certificate_number, ec.expiry_date, c.name_ar, e.first_name_ar, e.last_name_ar
    FROM public.employee_certifications ec
    JOIN public.certifications c ON c.id = ec.certification_id
    JOIN public.employees e ON e.id = ec.employee_id
    WHERE ec.company_id = p_company_id
      AND ec.verification_status = 'verified'
      AND ec.expiry_date IS NOT NULL
      AND ec.expiry_date <= current_date + interval '60 days'
      AND ec.expiry_date >= current_date
      AND ec.status != 'expiring'
  LOOP
    -- Mark expiring
    UPDATE public.employee_certifications
    SET status = 'expiring', updated_at = now()
    WHERE id = v_rec.id;

    -- Create task in operational_tasks
    INSERT INTO public.operational_tasks (
      company_id,
      title_ar,
      title_en,
      category,
      priority,
      status,
      due_date,
      entity_type,
      entity_id
    ) VALUES (
      p_company_id,
      'تجديد شهادة مهنية قاربت على الانتهاء: ' || v_rec.name_ar,
      'Certification renewal due: ' || v_rec.name_ar,
      'compliance',
      'high',
      'pending',
      v_rec.expiry_date,
      'employee_certification',
      v_rec.id::text
    );

    v_count := v_count + 1;
  END LOOP;

  -- Mark expired certifications
  UPDATE public.employee_certifications
  SET status = 'expired', updated_at = now()
  WHERE company_id = p_company_id
    AND expiry_date IS NOT NULL
    AND expiry_date < current_date
    AND status NOT IN ('expired', 'rejected', 'revoked');

  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_count
  );
END;
$$;

-- F. Assign Mandatory Learning Atomic
CREATE OR REPLACE FUNCTION public.assign_mandatory_learning_atomic(
  p_company_id uuid,
  p_rule_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule public.mandatory_learning_rules%ROWTYPE;
  v_emp record;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_rule
  FROM public.mandatory_learning_rules
  WHERE id = p_rule_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mandatory learning rule not found');
  END IF;

  -- Select eligible employees based on target criteria
  FOR v_emp IN
    SELECT id, first_name_ar, last_name_ar
    FROM public.employees
    WHERE company_id = p_company_id
      AND status = 'active'
      AND (
        v_rule.target_type = 'all_employees'
        OR (v_rule.target_type = 'department' AND department_id = v_rule.target_id)
        OR (v_rule.target_type = 'position' AND job_position_id = v_rule.target_id)
        OR (v_rule.target_type = 'grade' AND grade = v_rule.target_value)
      )
  LOOP
    -- Insert training need if not already present
    IF NOT EXISTS (
      SELECT 1 FROM public.training_needs
      WHERE company_id = p_company_id AND employee_id = v_emp.id AND recommended_learning_item_id = v_rule.course_id AND status != 'completed'
    ) THEN
      INSERT INTO public.training_needs (
        company_id,
        employee_id,
        source,
        recommended_learning_item_id,
        reason,
        priority,
        status
      ) VALUES (
        p_company_id,
        v_emp.id,
        'mandatory_compliance',
        v_rule.course_id,
        'تدريب إلزامي بموجب سياسة الامتثال: ' || v_rule.rule_name_ar,
        'high',
        'assigned'
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'assigned_count', v_count,
    'rule_id', v_rule.id
  );
END;
$$;

-- G. Truthful Learning KPIs Atomic
CREATE OR REPLACE FUNCTION public.get_learning_kpis_atomic(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_courses integer := 0;
  v_upcoming_sessions integer := 0;
  v_total_enrollments integer := 0;
  v_completed_enrollments integer := 0;
  v_completion_rate numeric(5,2) := 0.00;
  v_mandatory_overdue integer := 0;
  v_expiring_certs integer := 0;
  v_total_training_cost numeric(14,2) := 0.00;
  v_active_skills integer := 0;
BEGIN
  SELECT COUNT(*) INTO v_active_courses
  FROM public.learning_items
  WHERE company_id = p_company_id AND status = 'active';

  SELECT COUNT(*) INTO v_upcoming_sessions
  FROM public.training_sessions
  WHERE company_id = p_company_id AND status IN ('open', 'in_progress') AND start_date >= now();

  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COALESCE(SUM(cost), 0)
  INTO 
    v_total_enrollments,
    v_completed_enrollments,
    v_total_training_cost
  FROM public.training_enrollments
  WHERE company_id = p_company_id;

  IF v_total_enrollments > 0 THEN
    v_completion_rate := ROUND((v_completed_enrollments::numeric / v_total_enrollments::numeric) * 100.0, 2);
  END IF;

  SELECT COUNT(*) INTO v_expiring_certs
  FROM public.employee_certifications
  WHERE company_id = p_company_id AND status IN ('expiring', 'expired');

  SELECT COUNT(*) INTO v_active_skills
  FROM public.skills
  WHERE company_id = p_company_id AND status = 'active';

  RETURN jsonb_build_object(
    'active_courses', v_active_courses,
    'upcoming_sessions', v_upcoming_sessions,
    'total_enrollments', v_total_enrollments,
    'completed_enrollments', v_completed_enrollments,
    'completion_rate', v_completion_rate,
    'expiring_certifications', v_expiring_certs,
    'total_training_cost', v_total_training_cost,
    'active_skills_count', v_active_skills
  );
END;
$$;

-- ============================================================================
-- 17. ROW LEVEL SECURITY & GRANTS
-- ============================================================================

ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_program_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_skill_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandatory_learning_rules ENABLE ROW LEVEL SECURITY;

-- Standard tenant isolation policies
DROP POLICY IF EXISTS "skill_categories_isolation" ON public.skill_categories;
CREATE POLICY "skill_categories_isolation" ON public.skill_categories FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "skills_isolation" ON public.skills;
CREATE POLICY "skills_isolation" ON public.skills FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "learning_items_isolation" ON public.learning_items;
CREATE POLICY "learning_items_isolation" ON public.learning_items FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "training_sessions_isolation" ON public.training_sessions;
CREATE POLICY "training_sessions_isolation" ON public.training_sessions FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "training_enrollments_isolation" ON public.training_enrollments;
CREATE POLICY "training_enrollments_isolation" ON public.training_enrollments FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "employee_skills_isolation" ON public.employee_skills;
CREATE POLICY "employee_skills_isolation" ON public.employee_skills FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

DROP POLICY IF EXISTS "employee_certs_isolation" ON public.employee_certifications;
CREATE POLICY "employee_certs_isolation" ON public.employee_certifications FOR ALL TO authenticated, service_role
  USING (company_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'company_id')::uuid OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role') = 'super_admin');

GRANT SELECT, INSERT, UPDATE ON public.skill_categories TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.skills TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.training_providers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.learning_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.learning_programs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.learning_program_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.certifications TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.job_skill_requirements TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.employee_skills TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.training_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.training_enrollments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.training_needs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.learning_plans TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.learning_plan_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.learning_assessments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.employee_certifications TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.mandatory_learning_rules TO authenticated, service_role;
