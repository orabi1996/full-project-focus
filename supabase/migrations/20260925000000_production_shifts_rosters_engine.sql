-- ============================================================================
-- MIGRATION: 20260925000000_production_shifts_rosters_engine.sql
-- DESCRIPTION: Prompt 13 Production Shifts, Rosters & Work Scheduling Engine
--   1. Versioned Shift Definitions Master Data with multi-segment & break rules
--   2. Roster Periods lifecycle (draft -> validation_failed -> ready -> published -> locked)
--   3. Authoritative Schedule Assignments with company scope, versioning & location override
--   4. Company Workweek configuration & reusable Roster Templates / Rotation Patterns
--   5. Server-side Conflict & Coverage Engine (roster_exceptions & coverage requirements)
--   6. Atomic publication RPC (publish_roster) with blocking exception gates
--   7. Attendance Period Interlock & Geofence Work Location resolution
--   8. Shift Swap Request workflow (shift_swap_requests) & transactional approval
--   9. Immutable Roster Audit Logs (roster_audit_logs)
--   10. Company-scoped Sequences, Indexes, Strict RLS Policies & RPC Grants
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ENHANCE SHIFTS TABLE (MASTER DATA & VERSIONING)
-- ============================================================================

-- Add enterprise versioning and effective dating to shifts
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS is_overnight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS break_type text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS auto_deduct_breaks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_rest_hours_after numeric(4,2) DEFAULT 11.00,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure status constraint on shifts
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS chk_shifts_status;
ALTER TABLE public.shifts ADD CONSTRAINT chk_shifts_status CHECK (status IN ('draft', 'active', 'archived'));

-- Ensure break_type constraint on shifts
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS chk_shifts_break_type;
ALTER TABLE public.shifts ADD CONSTRAINT chk_shifts_break_type CHECK (break_type IN ('paid', 'unpaid'));

-- Allow overnight shift type in shifts type check if constraint exists
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_type_check;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_type_check CHECK (type IN ('fixed', 'overnight', 'flexible', 'split'));

-- Unique constraint for company, code, and version
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS uq_shifts_company_code_version;
ALTER TABLE public.shifts ADD CONSTRAINT uq_shifts_company_code_version UNIQUE (company_id, code, version);


-- ============================================================================
-- 2. SHIFT SEGMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shift_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  segment_order integer NOT NULL DEFAULT 1,
  start_time time NOT NULL,
  end_time time NOT NULL,
  segment_type text NOT NULL DEFAULT 'work' CHECK (segment_type IN ('work', 'break', 'core', 'flex')),
  is_overnight boolean NOT NULL DEFAULT false,
  paid boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_segment_order UNIQUE (shift_id, segment_order)
);

ALTER TABLE public.shift_segments ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 3. COMPANY WORKWEEK CONFIGURATION
-- ============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS workweek_config jsonb NOT NULL DEFAULT '{"working_days": [0,1,2,3,4], "rest_days": [5,6], "week_start_day": 0}'::jsonb;


-- ============================================================================
-- 4. ROSTER PERIODS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roster_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validation_failed', 'ready', 'published', 'locked', 'archived')),
  version integer NOT NULL DEFAULT 1,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  locked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_roster_period_dates CHECK (period_end >= period_start),
  CONSTRAINT uq_roster_period_company_range UNIQUE (company_id, period_start, period_end, version)
);

ALTER TABLE public.roster_periods ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 5. ENHANCE SCHEDULE ASSIGNMENTS TABLE
-- ============================================================================

ALTER TABLE public.schedule_assignments
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS roster_period_id uuid REFERENCES public.roster_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS roster_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shift_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES public.work_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

-- Update backfill company_id on schedule_assignments from employees
UPDATE public.schedule_assignments sa
SET company_id = e.company_id
FROM public.employees e
WHERE sa.employee_id = e.id AND sa.company_id IS NULL;

-- Update status check constraint on schedule_assignments
ALTER TABLE public.schedule_assignments DROP CONSTRAINT IF EXISTS schedule_assignments_status_check;
ALTER TABLE public.schedule_assignments ADD CONSTRAINT schedule_assignments_status_check
  CHECK (status IN ('draft', 'published', 'archived', 'cancelled'));

-- Update source check constraint on schedule_assignments
ALTER TABLE public.schedule_assignments DROP CONSTRAINT IF EXISTS chk_schedule_assignments_source;
ALTER TABLE public.schedule_assignments ADD CONSTRAINT chk_schedule_assignments_source
  CHECK (source IN ('manual', 'template', 'rotation', 'swap', 'copy'));

-- Unique constraint ensuring an employee has only one active assignment per work_date per version
ALTER TABLE public.schedule_assignments DROP CONSTRAINT IF EXISTS schedule_assignments_employee_id_work_date_key;
ALTER TABLE public.schedule_assignments DROP CONSTRAINT IF EXISTS uq_schedule_assignments_emp_date_version;
ALTER TABLE public.schedule_assignments ADD CONSTRAINT uq_schedule_assignments_emp_date_version
  UNIQUE (employee_id, work_date, roster_version);


-- ============================================================================
-- 6. ROSTER TEMPLATES & ROTATION PATTERNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roster_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template_type text NOT NULL DEFAULT 'weekly' CHECK (template_type IN ('weekly', 'cyclical', 'custom')),
  cycle_days integer NOT NULL DEFAULT 7,
  pattern jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roster_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rotation_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cycle_days integer NOT NULL,
  pattern jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rotation_patterns ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 7. ROSTER COVERAGE REQUIREMENTS & EXCEPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roster_coverage_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  work_location_id uuid REFERENCES public.work_locations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  job_position_id uuid REFERENCES public.job_positions(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE CASCADE,
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
  min_headcount integer NOT NULL DEFAULT 1,
  is_mandatory boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roster_coverage_requirements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.roster_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  roster_period_id uuid NOT NULL REFERENCES public.roster_periods(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  exception_type text NOT NULL CHECK (exception_type IN (
    'missing_shift', 'overlap', 'insufficient_rest', 'outside_employment_period',
    'leave_conflict', 'holiday_assignment', 'understaffed', 'invalid_shift_definition',
    'missing_location', 'overtime_risk', 'excess_hours', 'under_staffed', 'unassigned_shift', 'contract_breach'
  )),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'blocking')),
  description text NOT NULL,
  message text,
  blocking boolean NOT NULL DEFAULT false,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roster_exceptions
  ADD COLUMN IF NOT EXISTS message text;

ALTER TABLE public.roster_exceptions DROP CONSTRAINT IF EXISTS roster_exceptions_exception_type_check;
ALTER TABLE public.roster_exceptions ADD CONSTRAINT roster_exceptions_exception_type_check CHECK (exception_type IN (
  'missing_shift', 'overlap', 'insufficient_rest', 'outside_employment_period',
  'leave_conflict', 'holiday_assignment', 'understaffed', 'invalid_shift_definition',
  'missing_location', 'overtime_risk', 'excess_hours', 'under_staffed', 'unassigned_shift', 'contract_breach'
));

ALTER TABLE public.roster_exceptions ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 8. SHIFT SWAP REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requester_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  target_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requester_assignment_id uuid NOT NULL REFERENCES public.schedule_assignments(id) ON DELETE CASCADE,
  target_assignment_id uuid NOT NULL REFERENCES public.schedule_assignments(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN (
    'draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'cancelled'
  )),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 9. ROSTER AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roster_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  roster_period_id uuid REFERENCES public.roster_periods(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('shift', 'shift_segment', 'roster_period', 'assignment', 'swap', 'coverage')),
  entity_id uuid NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roster_audit_logs
  ADD COLUMN IF NOT EXISTS roster_period_id uuid REFERENCES public.roster_periods(id) ON DELETE CASCADE;

ALTER TABLE public.roster_audit_logs ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 10. INDEXES FOR HIGH-CONCURRENCY PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_shifts_company_status ON public.shifts (company_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_segments_shift ON public.shift_segments (shift_id, segment_order);
CREATE INDEX IF NOT EXISTS idx_roster_periods_company_dates ON public.roster_periods (company_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_company_date ON public.schedule_assignments (company_id, work_date);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_emp_date ON public.schedule_assignments (employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_roster_period ON public.schedule_assignments (roster_period_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_date_status ON public.schedule_assignments (work_date, status);
CREATE INDEX IF NOT EXISTS idx_roster_exceptions_period_resolved ON public.roster_exceptions (roster_period_id, resolved);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_emp_status ON public.shift_swap_requests (requester_employee_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_company_status ON public.shift_swap_requests (company_id, status);


-- ============================================================================
-- 11. SHIFT CODE GENERATOR RPC (NO RACE CONDITIONS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_shift_code(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_num integer;
  v_code text;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'معرف الشركة مطلوب لتوليد كود الوردية' USING ERRCODE = '22023';
  END IF;

  -- Acquire an advisory transaction lock based on company_id to prevent concurrency race conditions
  PERFORM pg_advisory_xact_lock(hashtext('shift_code_' || p_company_id::text));

  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '^SH-', ''), '')::integer), 0) + 1
  INTO v_next_num
  FROM public.shifts
  WHERE company_id = p_company_id AND code ~ '^SH-[0-9]+$';

  v_code := 'SH-' || lpad(v_next_num::text, 3, '0');
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_shift_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_shift_code(uuid) TO service_role;


-- ============================================================================
-- 12. CREATE SHIFT DEFINITION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_shift_definition(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_code text;
  v_name_ar text;
  v_name_en text;
  v_type text;
  v_start_time time;
  v_end_time time;
  v_grace_in integer;
  v_grace_out integer;
  v_color text;
  v_overtime_eligible boolean;
  v_allow_single_punch boolean;
  v_flexible_hours numeric;
  v_split_start2 time;
  v_split_end2 time;
  v_break_mins integer;
  v_break_type text;
  v_auto_deduct boolean;
  v_effective_from date;
  v_is_overnight boolean;
  v_shift_id uuid;
  v_segments jsonb;
  v_seg jsonb;
  v_seg_order integer := 1;
BEGIN
  -- 1. Resolve & authorize company
  v_company_id := (p_payload->>'company_id')::uuid;
  IF v_company_id IS NULL THEN
    v_company_id := public.current_company_id();
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'معرف الشركة غير محدد أو تعذر التعرف على صلاحية المستخدم' USING ERRCODE = '42501';
  END IF;

  -- 2. Extract & validate payload
  v_name_ar := trim(COALESCE(p_payload->>'name_ar', p_payload->>'nameAr', ''));
  v_name_en := trim(COALESCE(p_payload->>'name_en', p_payload->>'nameEn', v_name_ar));
  v_type := lower(trim(COALESCE(p_payload->>'type', 'fixed')));
  v_color := COALESCE(p_payload->>'color', '#0284c7');
  v_overtime_eligible := COALESCE((p_payload->>'overtime_eligible')::boolean, (p_payload->>'overtimeEligible')::boolean, false);
  v_allow_single_punch := COALESCE((p_payload->>'allow_single_punch')::boolean, (p_payload->>'allowSinglePunch')::boolean, false);
  v_break_mins := COALESCE((p_payload->>'break_minutes')::integer, 0);
  v_break_type := COALESCE(p_payload->>'break_type', 'unpaid');
  v_auto_deduct := COALESCE((p_payload->>'auto_deduct_breaks')::boolean, true);
  v_effective_from := COALESCE((p_payload->>'effective_from')::date, CURRENT_DATE);

  IF v_name_ar = '' THEN
    RAISE EXCEPTION 'اسم الوردية باللغة العربية إلزامي' USING ERRCODE = '22023';
  END IF;

  IF v_type NOT IN ('fixed', 'overnight', 'flexible', 'split') THEN
    RAISE EXCEPTION 'نوع الوردية (%) غير معتمد. الأنواع المتاحة: fixed, overnight, flexible, split', v_type USING ERRCODE = '22023';
  END IF;

  -- 3. Shift Type Specific Validation
  IF v_type IN ('fixed', 'overnight') THEN
    v_start_time := (p_payload->>'start_time')::time;
    v_end_time := (p_payload->>'end_time')::time;
    IF v_start_time IS NULL OR v_end_time IS NULL THEN
      RAISE EXCEPTION 'وقت البدء ووقت الانتهاء إلزاميان للوردية الثابتة أو الليلية' USING ERRCODE = '22023';
    END IF;
    v_is_overnight := (v_type = 'overnight') OR (v_end_time <= v_start_time);
  ELSIF v_type = 'flexible' THEN
    v_flexible_hours := (p_payload->>'flexible_hours')::numeric;
    IF v_flexible_hours IS NULL OR v_flexible_hours <= 0 THEN
      RAISE EXCEPTION 'عدد الساعات المرنة المطلوبة إلزامي للوردية المرنة' USING ERRCODE = '22023';
    END IF;
    v_start_time := (p_payload->>'start_time')::time;
    v_end_time := (p_payload->>'end_time')::time;
    v_is_overnight := false;
  ELSIF v_type = 'split' THEN
    v_start_time := (p_payload->>'start_time')::time;
    v_end_time := (p_payload->>'end_time')::time;
    v_split_start2 := (p_payload->>'split_second_start_time')::time;
    v_split_end2 := (p_payload->>'split_second_end_time')::time;
    IF v_start_time IS NULL OR v_end_time IS NULL OR v_split_start2 IS NULL OR v_split_end2 IS NULL THEN
      RAISE EXCEPTION 'مواعيد الفترتين الأولى والثانية إلزامية لوردية الدوام المجزأ' USING ERRCODE = '22023';
    END IF;
    IF v_split_start2 <= v_end_time THEN
      RAISE EXCEPTION 'بداية الفترة الثانية يجب أن تكون لاحقة لنهاية الفترة الأولى' USING ERRCODE = '22023';
    END IF;
    v_is_overnight := false;
  END IF;

  v_grace_in := COALESCE((p_payload->>'grace_minutes_arrival')::integer, 0);
  v_grace_out := COALESCE((p_payload->>'grace_minutes_departure')::integer, 0);

  -- 4. Code Generation
  v_code := trim(COALESCE(p_payload->>'code', ''));
  IF v_code = '' THEN
    v_code := public.generate_shift_code(v_company_id);
  END IF;

  -- 5. Insert Shift Master Record
  INSERT INTO public.shifts (
    company_id, code, name_ar, name_en, type, color,
    start_time, end_time, grace_minutes_arrival, grace_minutes_departure,
    flexible_hours, split_second_start_time, split_second_end_time,
    is_overnight, allow_single_punch, overtime_eligible, break_minutes,
    break_type, auto_deduct_breaks, effective_from, version, status, created_by
  ) VALUES (
    v_company_id, v_code, v_name_ar, v_name_en, v_type, v_color,
    v_start_time, v_end_time, v_grace_in, v_grace_out,
    v_flexible_hours, v_split_start2, v_split_end2,
    v_is_overnight, v_allow_single_punch, v_overtime_eligible, v_break_mins,
    v_break_type, v_auto_deduct, v_effective_from, 1, 'active', auth.uid()
  ) RETURNING id INTO v_shift_id;

  -- 6. Insert Normalized Segments if provided or synthesized from split
  v_segments := p_payload->'segments';
  IF v_segments IS NOT NULL AND jsonb_array_length(v_segments) > 0 THEN
    FOR v_seg IN SELECT * FROM jsonb_array_elements(v_segments)
    LOOP
      INSERT INTO public.shift_segments (
        company_id, shift_id, segment_order, start_time, end_time,
        segment_type, is_overnight, paid
      ) VALUES (
        v_company_id, v_shift_id, v_seg_order,
        (v_seg->>'start_time')::time, (v_seg->>'end_time')::time,
        COALESCE(v_seg->>'segment_type', 'work'),
        COALESCE((v_seg->>'is_overnight')::boolean, false),
        COALESCE((v_seg->>'paid')::boolean, true)
      );
      v_seg_order := v_seg_order + 1;
    END LOOP;
  ELSIF v_type = 'split' THEN
    -- Synthesize default 2 segments for split shift
    INSERT INTO public.shift_segments (
      company_id, shift_id, segment_order, start_time, end_time, segment_type, paid
    ) VALUES
      (v_company_id, v_shift_id, 1, v_start_time, v_end_time, 'work', true),
      (v_company_id, v_shift_id, 2, v_split_start2, v_split_end2, 'work', true);
  END IF;

  -- 7. Audit log
  INSERT INTO public.roster_audit_logs (
    company_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_company_id, 'shift_created', 'shift', v_shift_id, auth.uid(),
    jsonb_build_object('code', v_code, 'name_ar', v_name_ar, 'type', v_type)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_shift_id,
    'code', v_code,
    'name_ar', v_name_ar,
    'version', 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_shift_definition(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shift_definition(jsonb) TO service_role;


-- ============================================================================
-- 13. UPDATE SHIFT DEFINITION RPC (VERSION-AWARE IMMUTABILITY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_shift_definition(p_shift_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_shift public.shifts%ROWTYPE;
  v_published_count integer := 0;
  v_att_count integer := 0;
  v_new_shift_id uuid;
  v_new_version integer;
BEGIN
  SELECT * INTO v_old_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الوردية المطلوب تعديلها غير موجودة' USING ERRCODE = '22023';
  END IF;

  -- Check if shift is actively referenced by published schedules or attendance records
  SELECT count(*) INTO v_published_count
  FROM public.schedule_assignments
  WHERE shift_id = p_shift_id AND status = 'published';

  SELECT count(*) INTO v_att_count
  FROM public.attendance_records
  WHERE shift_id = p_shift_id;

  IF v_published_count > 0 OR v_att_count > 0 THEN
    -- Historical immutability rule: create a NEW version of the shift and archive future edits of old version
    v_new_version := v_old_shift.version + 1;

    INSERT INTO public.shifts (
      company_id, code, name_ar, name_en, type, color,
      start_time, end_time, grace_minutes_arrival, grace_minutes_departure,
      flexible_hours, split_second_start_time, split_second_end_time,
      is_overnight, allow_single_punch, overtime_eligible, break_minutes,
      break_type, auto_deduct_breaks, effective_from, version, status, created_by
    ) VALUES (
      v_old_shift.company_id,
      v_old_shift.code,
      COALESCE(p_payload->>'name_ar', v_old_shift.name_ar),
      COALESCE(p_payload->>'name_en', v_old_shift.name_en),
      COALESCE(p_payload->>'type', v_old_shift.type),
      COALESCE(p_payload->>'color', v_old_shift.color),
      COALESCE((p_payload->>'start_time')::time, v_old_shift.start_time),
      COALESCE((p_payload->>'end_time')::time, v_old_shift.end_time),
      COALESCE((p_payload->>'grace_minutes_arrival')::integer, v_old_shift.grace_minutes_arrival),
      COALESCE((p_payload->>'grace_minutes_departure')::integer, v_old_shift.grace_minutes_departure),
      COALESCE((p_payload->>'flexible_hours')::numeric, v_old_shift.flexible_hours),
      COALESCE((p_payload->>'split_second_start_time')::time, v_old_shift.split_second_start_time),
      COALESCE((p_payload->>'split_second_end_time')::time, v_old_shift.split_second_end_time),
      COALESCE((p_payload->>'is_overnight')::boolean, v_old_shift.is_overnight),
      COALESCE((p_payload->>'allow_single_punch')::boolean, v_old_shift.allow_single_punch),
      COALESCE((p_payload->>'overtime_eligible')::boolean, v_old_shift.overtime_eligible),
      COALESCE((p_payload->>'break_minutes')::integer, v_old_shift.break_minutes),
      COALESCE(p_payload->>'break_type', v_old_shift.break_type),
      COALESCE((p_payload->>'auto_deduct_breaks')::boolean, v_old_shift.auto_deduct_breaks),
      COALESCE((p_payload->>'effective_from')::date, CURRENT_DATE),
      v_new_version,
      'active',
      auth.uid()
    ) RETURNING id INTO v_new_shift_id;

    -- Update old version effective_to
    UPDATE public.shifts
    SET effective_to = CURRENT_DATE, status = 'archived'
    WHERE id = p_shift_id;

    INSERT INTO public.roster_audit_logs (
      company_id, action, entity_type, entity_id, actor_id, details
    ) VALUES (
      v_old_shift.company_id, 'shift_version_created', 'shift', v_new_shift_id, auth.uid(),
      jsonb_build_object('code', v_old_shift.code, 'from_version', v_old_shift.version, 'to_version', v_new_version)
    );

    RETURN jsonb_build_object(
      'ok', true,
      'id', v_new_shift_id,
      'version', v_new_version,
      'version_created', true
    );
  ELSE
    -- Safe in-place update for unreferenced/draft shifts
    UPDATE public.shifts
    SET
      name_ar = COALESCE(p_payload->>'name_ar', name_ar),
      name_en = COALESCE(p_payload->>'name_en', name_en),
      type = COALESCE(p_payload->>'type', type),
      color = COALESCE(p_payload->>'color', color),
      start_time = COALESCE((p_payload->>'start_time')::time, start_time),
      end_time = COALESCE((p_payload->>'end_time')::time, end_time),
      grace_minutes_arrival = COALESCE((p_payload->>'grace_minutes_arrival')::integer, grace_minutes_arrival),
      grace_minutes_departure = COALESCE((p_payload->>'grace_minutes_departure')::integer, grace_minutes_departure),
      flexible_hours = COALESCE((p_payload->>'flexible_hours')::numeric, flexible_hours),
      split_second_start_time = COALESCE((p_payload->>'split_second_start_time')::time, split_second_start_time),
      split_second_end_time = COALESCE((p_payload->>'split_second_end_time')::time, split_second_end_time),
      is_overnight = COALESCE((p_payload->>'is_overnight')::boolean, is_overnight),
      allow_single_punch = COALESCE((p_payload->>'allow_single_punch')::boolean, allow_single_punch),
      overtime_eligible = COALESCE((p_payload->>'overtime_eligible')::boolean, overtime_eligible),
      break_minutes = COALESCE((p_payload->>'break_minutes')::integer, break_minutes),
      break_type = COALESCE(p_payload->>'break_type', break_type),
      auto_deduct_breaks = COALESCE((p_payload->>'auto_deduct_breaks')::boolean, auto_deduct_breaks),
      effective_from = COALESCE((p_payload->>'effective_from')::date, effective_from)
    WHERE id = p_shift_id;

    RETURN jsonb_build_object('ok', true, 'id', p_shift_id, 'version', v_old_shift.version, 'version_created', false);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_shift_definition(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_shift_definition(uuid, jsonb) TO service_role;


-- ============================================================================
-- 14. ARCHIVE SHIFT DEFINITION RPC (ARCHIVE INSTEAD OF DELETE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.archive_shift_definition(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الوردية غير موجودة' USING ERRCODE = '22023';
  END IF;

  UPDATE public.shifts
  SET status = 'archived', effective_to = CURRENT_DATE
  WHERE id = p_shift_id;

  INSERT INTO public.roster_audit_logs (
    company_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_shift.company_id, 'shift_archived', 'shift', p_shift_id, auth.uid(),
    jsonb_build_object('code', v_shift.code, 'name_ar', v_shift.name_ar)
  );

  RETURN jsonb_build_object('ok', true, 'id', p_shift_id, 'status', 'archived');
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_shift_definition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_shift_definition(uuid) TO service_role;


-- ============================================================================
-- 15. CONFLICT & COVERAGE DETECTION ENGINE RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detect_roster_conflicts(p_roster_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.roster_periods%ROWTYPE;
  v_rec record;
  v_blocking_count integer := 0;
  v_warning_count integer := 0;
  v_cov_req record;
  v_assigned_headcount integer;
  v_msg text;
BEGIN
  SELECT * INTO v_period FROM public.roster_periods WHERE id = p_roster_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة المحددة غير موجودة' USING ERRCODE = '22023';
  END IF;

  -- Tenant authorization check
  IF auth.role() <> 'service_role' AND v_period.company_id IS DISTINCT FROM public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى بيانات شركة أخرى' USING ERRCODE = '42501';
  END IF;

  -- Clear previously unresolved exceptions for this period
  DELETE FROM public.roster_exceptions
  WHERE roster_period_id = p_roster_id AND resolved IS FALSE;

  -- 1. Check Employment Tenure Bounds (hire_date and exit_date)
  FOR v_rec IN
    SELECT sa.id AS assignment_id, sa.employee_id, sa.work_date, e.full_name, e.hire_date, e.exit_date, e.status
    FROM public.schedule_assignments sa
    JOIN public.employees e ON e.id = sa.employee_id
    WHERE sa.roster_period_id = p_roster_id
      AND sa.is_rest_day IS NOT TRUE
      AND (
        (e.hire_date IS NOT NULL AND sa.work_date < e.hire_date)
        OR (e.exit_date IS NOT NULL AND sa.work_date > e.exit_date)
        OR e.status = 'terminated'
      )
  LOOP
    v_msg := format('الموظف (%s) مسند لوردية عمل بتاريخ (%s) خارج نطاق خدمته التعاقدية (تاريخ التعيين: %s، تاريخ الإنهاء: %s)',
                    v_rec.full_name, v_rec.work_date, COALESCE(v_rec.hire_date::text, 'غير محدد'), COALESCE(v_rec.exit_date::text, 'لا يوجد'));
    INSERT INTO public.roster_exceptions (
      company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
    ) VALUES (
      v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.work_date,
      'outside_employment_period', 'blocking',
      v_msg, v_msg,
      true
    );
    v_blocking_count := v_blocking_count + 1;
  END LOOP;

  -- 2. Check Overlapping Assignments (Multiple non-rest shifts same day)
  FOR v_rec IN
    SELECT sa.employee_id, sa.work_date, e.full_name, count(*) AS shift_cnt
    FROM public.schedule_assignments sa
    JOIN public.employees e ON e.id = sa.employee_id
    WHERE sa.roster_period_id = p_roster_id AND sa.is_rest_day IS NOT TRUE
    GROUP BY sa.employee_id, sa.work_date, e.full_name
    HAVING count(*) > 1
  LOOP
    v_msg := format('الموظف (%s) مسند لأكثر من وردية عمل في نفس التاريخ (%s) مما يشكل تعارضاً تشغيلياً مانعاً', v_rec.full_name, v_rec.work_date);
    INSERT INTO public.roster_exceptions (
      company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
    ) VALUES (
      v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.work_date,
      'overlap', 'blocking',
      v_msg, v_msg,
      true
    );
    v_blocking_count := v_blocking_count + 1;
  END LOOP;

  -- 3. Check Minimum Rest between Consecutive Shifts (< min_rest_hours_after, default 11h)
  FOR v_rec IN
    SELECT
      sa1.employee_id,
      sa1.work_date,
      e.full_name,
      s1.name_ar AS shift1_name,
      s2.name_ar AS shift2_name,
      round(EXTRACT(EPOCH FROM (
        (sa2.work_date + s2.start_time) -
        (sa1.work_date + s1.end_time + CASE WHEN s1.is_overnight OR s1.end_time <= s1.start_time THEN interval '1 day' ELSE interval '0' END)
      )) / 3600.0, 1) AS rest_hours,
      COALESCE(s1.min_rest_hours_after, 11.0) AS min_rest
    FROM public.schedule_assignments sa1
    JOIN public.shifts s1 ON s1.id = sa1.shift_id
    JOIN public.schedule_assignments sa2 ON sa2.employee_id = sa1.employee_id AND sa2.work_date = sa1.work_date + 1
    JOIN public.shifts s2 ON s2.id = sa2.shift_id
    JOIN public.employees e ON e.id = sa1.employee_id
    WHERE sa1.roster_period_id = p_roster_id
      AND sa1.is_rest_day IS NOT TRUE AND sa2.is_rest_day IS NOT TRUE
      AND (
        (s1.is_overnight IS TRUE AND s2.start_time < '14:00:00'::time)
        OR (
          (sa2.work_date + s2.start_time) -
          (sa1.work_date + s1.end_time + CASE WHEN s1.is_overnight OR s1.end_time <= s1.start_time THEN interval '1 day' ELSE interval '0' END)
        ) < (COALESCE(s1.min_rest_hours_after, 11.0) || ' hours')::interval
      )
  LOOP
    v_msg := format('الموظف (%s) مسند لوردية (%s) تليها وردية (%s) مع فترة راحة غير كافية (%s ساعة، والمطلوب %s ساعة)',
                    v_rec.full_name, v_rec.shift1_name, v_rec.shift2_name, v_rec.rest_hours, v_rec.min_rest);
    INSERT INTO public.roster_exceptions (
      company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
    ) VALUES (
      v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.work_date,
      'insufficient_rest', 'warning',
      v_msg, v_msg,
      false
    );
    v_warning_count := v_warning_count + 1;
  END LOOP;

  -- 4. Check Approved Leave Conflicts
  FOR v_rec IN
    SELECT sa.employee_id, sa.work_date, e.full_name, r.type AS leave_type
    FROM public.schedule_assignments sa
    JOIN public.employees e ON e.id = sa.employee_id
    JOIN public.requests r ON r.employee_id = sa.employee_id
      AND r.type LIKE 'leave_%' AND r.status = 'approved'
      AND sa.work_date BETWEEN r.start_date AND r.end_date
    WHERE sa.roster_period_id = p_roster_id AND sa.is_rest_day IS NOT TRUE
  LOOP
    v_msg := format('الموظف (%s) مسند لوردية عمل بتاريخ (%s) على الرغم من تمتعه بإجازة رسمية معتمدة (%s)',
                    v_rec.full_name, v_rec.work_date, v_rec.leave_type);
    INSERT INTO public.roster_exceptions (
      company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
    ) VALUES (
      v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.work_date,
      'leave_conflict', 'warning',
      v_msg, v_msg,
      false
    );
    v_warning_count := v_warning_count + 1;
  END LOOP;

  -- 5. Check Holiday Special-Duty Assignments
  FOR v_rec IN
    SELECT sa.employee_id, sa.work_date, e.full_name, ch.name_ar AS holiday_name
    FROM public.schedule_assignments sa
    JOIN public.employees e ON e.id = sa.employee_id
    JOIN public.company_holidays ch ON ch.company_id = v_period.company_id
      AND sa.work_date BETWEEN ch.start_date AND ch.end_date
    WHERE sa.roster_period_id = p_roster_id AND sa.is_rest_day IS NOT TRUE
  LOOP
    v_msg := format('تكليف عمل خلال عطلة رسمية للموظف (%s) في مناسبة (%s) بتاريخ (%s)',
                    v_rec.full_name, v_rec.holiday_name, v_rec.work_date);
    INSERT INTO public.roster_exceptions (
      company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
    ) VALUES (
      v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.work_date,
      'holiday_assignment', 'info',
      v_msg, v_msg,
      false
    );
  END LOOP;

  -- 6. Check Staffing Coverage Requirements
  FOR v_cov_req IN
    SELECT rcr.*, w.name_ar AS loc_name, s.name_ar AS shift_name
    FROM public.roster_coverage_requirements rcr
    LEFT JOIN public.work_locations w ON w.id = rcr.work_location_id
    LEFT JOIN public.shifts s ON s.id = rcr.shift_id
    WHERE rcr.company_id = v_period.company_id
  LOOP
    -- Calculate coverage across days in period
    FOR v_rec IN
      SELECT d::date AS chk_date, EXTRACT(DOW FROM d)::integer AS dow
      FROM generate_series(v_period.period_start::timestamp, v_period.period_end::timestamp, '1 day'::interval) d
      WHERE v_cov_req.day_of_week IS NULL OR EXTRACT(DOW FROM d) = v_cov_req.day_of_week
    LOOP
      SELECT count(*) INTO v_assigned_headcount
      FROM public.schedule_assignments sa
      JOIN public.employees e ON e.id = sa.employee_id
      WHERE sa.roster_period_id = p_roster_id
        AND sa.work_date = v_rec.chk_date
        AND sa.is_rest_day IS NOT TRUE
        AND (v_cov_req.shift_id IS NULL OR sa.shift_id = v_cov_req.shift_id)
        AND (v_cov_req.work_location_id IS NULL OR COALESCE(sa.work_location_id, e.work_location_id) = v_cov_req.work_location_id);

      IF v_assigned_headcount < v_cov_req.min_headcount THEN
        v_msg := format('عجز في التغطية التشغيلية لقاعدة (%s): المطلوب %s موظفين والمجدول فعلياً %s في تاريخ %s',
                        v_cov_req.name, v_cov_req.min_headcount, v_assigned_headcount, v_rec.chk_date);
        INSERT INTO public.roster_exceptions (
          company_id, roster_period_id, work_date, exception_type, severity, description, message, blocking
        ) VALUES (
          v_period.company_id, p_roster_id, v_rec.chk_date, 'understaffed',
          CASE WHEN v_cov_req.is_mandatory THEN 'blocking' ELSE 'warning' END,
          v_msg, v_msg,
          v_cov_req.is_mandatory
        );
        IF v_cov_req.is_mandatory THEN
          v_blocking_count := v_blocking_count + 1;
        ELSE
          v_warning_count := v_warning_count + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- 7. Check Maximum Consecutive Working Days (> 6 days without rest)
  FOR v_rec IN
    WITH consecutive_groups AS (
      SELECT
        sa.employee_id,
        sa.work_date,
        e.full_name,
        sa.work_date - (ROW_NUMBER() OVER (PARTITION BY sa.employee_id ORDER BY sa.work_date))::integer AS grp
      FROM public.schedule_assignments sa
      JOIN public.employees e ON e.id = sa.employee_id
      WHERE sa.roster_period_id = p_roster_id
        AND sa.is_rest_day IS NOT TRUE
    ),
    streaks AS (
      SELECT
        employee_id,
        full_name,
        min(work_date) AS streak_start,
        max(work_date) AS streak_end,
        count(*) AS consecutive_days
      FROM consecutive_groups
      GROUP BY employee_id, full_name, grp
      HAVING count(*) > 6
    )
    SELECT * FROM streaks
  LOOP
    v_msg := format('الموظف (%s) مسند لـ (%s) أيام عمل متتالية من (%s) إلى (%s) دون يوم راحة أسبوعية',
                    v_rec.full_name, v_rec.consecutive_days, v_rec.streak_start, v_rec.streak_end);
    INSERT INTO public.roster_exceptions (
      company_id, roster_period_id, employee_id, work_date, exception_type, severity, description, message, blocking
    ) VALUES (
      v_period.company_id, p_roster_id, v_rec.employee_id, v_rec.streak_end,
      'excess_hours', 'warning',
      v_msg, v_msg,
      false
    );
    v_warning_count := v_warning_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'conflict_count', (v_blocking_count + v_warning_count),
    'blocking_exceptions', v_blocking_count,
    'warning_exceptions', v_warning_count,
    'can_publish', (v_blocking_count = 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_roster_conflicts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_roster_conflicts(uuid) TO service_role;


-- ============================================================================
-- 16. ATOMIC PUBLISH ROSTER RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.publish_roster(p_roster_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.roster_periods%ROWTYPE;
  v_conflicts jsonb;
  v_blocking integer;
  v_closed_att_count integer;
  v_published_count integer;
BEGIN
  SELECT * INTO v_period FROM public.roster_periods WHERE id = p_roster_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة غير موجودة' USING ERRCODE = '22023';
  END IF;

  -- Tenant authorization check
  IF auth.role() <> 'service_role' AND v_period.company_id IS DISTINCT FROM public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى بيانات شركة أخرى' USING ERRCODE = '42501';
  END IF;

  IF v_period.status = 'locked' THEN
    RAISE EXCEPTION 'لا يمكن نشر فترة جدولة مقفلة رسمياً' USING ERRCODE = '22023';
  END IF;

  -- 1. Run Conflict Detector
  v_conflicts := public.detect_roster_conflicts(p_roster_id);
  v_blocking := (v_conflicts->>'blocking_exceptions')::integer;

  IF v_blocking > 0 THEN
    UPDATE public.roster_periods SET status = 'validation_failed' WHERE id = p_roster_id;
    RAISE EXCEPTION 'تعذر نشر جدول العمل: يوجد % تعارضات تشغيلية مانعة (Blocking Exceptions) يلزم معالجتها أولاً.', v_blocking USING ERRCODE = '22023';
  END IF;

  -- 2. Attendance Period Interlock: Verify no dates fall within closed/exported attendance periods
  SELECT count(*) INTO v_closed_att_count
  FROM public.attendance_periods ap
  WHERE ap.company_id = v_period.company_id
    AND ap.status IN ('closed', 'exported_to_payroll')
    AND daterange(ap.from_date, ap.to_date, '[]') && daterange(v_period.period_start, v_period.period_end, '[]');

  IF v_closed_att_count > 0 THEN
    RAISE EXCEPTION 'لا يمكن نشر أو تعديل جدول العمل: يتقاطع نطاق الجدولة مع فترات حضور مغلقة أو مصدرة للرواتب.' USING ERRCODE = '22023';
  END IF;

  -- 3. Atomic Publication Transaction
  UPDATE public.schedule_assignments
  SET
    status = 'published',
    published_at = now(),
    roster_version = v_period.version
  WHERE roster_period_id = p_roster_id;

  GET DIAGNOSTICS v_published_count = ROW_COUNT;

  UPDATE public.roster_periods
  SET
    status = 'published',
    published_at = now(),
    published_by = auth.uid(),
    updated_at = now()
  WHERE id = p_roster_id;

  -- 4. Audit Log
  INSERT INTO public.roster_audit_logs (
    company_id, roster_period_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_period.company_id, p_roster_id, 'publish', 'roster_period', p_roster_id, auth.uid(),
    jsonb_build_object(
      'name', v_period.name,
      'version', v_period.version,
      'published_assignments', v_published_count,
      'period_start', v_period.period_start,
      'period_end', v_period.period_end
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'roster_id', p_roster_id,
    'status', 'published',
    'published_assignments', v_published_count,
    'published_assignments_count', v_published_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_roster(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_roster(uuid) TO service_role;


-- ============================================================================
-- 17. COPY ROSTER PERIOD RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.copy_roster_period(
  p_source_period_id uuid,
  p_target_start date,
  p_target_end date,
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source public.roster_periods%ROWTYPE;
  v_new_roster_id uuid;
  v_day_offset integer;
  v_copied_count integer := 0;
  v_rec record;
BEGIN
  SELECT * INTO v_source FROM public.roster_periods WHERE id = p_source_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'فترة الجدولة الأصلية غير موجودة' USING ERRCODE = '22023';
  END IF;

  -- Tenant authorization check
  IF auth.role() <> 'service_role' AND v_source.company_id IS DISTINCT FROM public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى بيانات شركة أخرى' USING ERRCODE = '42501';
  END IF;

  IF p_target_end < p_target_start THEN
    RAISE EXCEPTION 'تاريخ نهاية الفترة الهدف يجب أن يكون لاحقاً لبدايتها' USING ERRCODE = '22023';
  END IF;

  v_day_offset := p_target_start - v_source.period_start;

  -- Create new draft roster period
  INSERT INTO public.roster_periods (
    company_id, name, period_start, period_end, status, version, timezone, created_by
  ) VALUES (
    v_source.company_id, p_name, p_target_start, p_target_end, 'draft', 1, v_source.timezone, auth.uid()
  ) RETURNING id INTO v_new_roster_id;

  -- Copy assignments while validating employee active tenure
  FOR v_rec IN
    SELECT sa.*, e.hire_date, e.exit_date, e.status AS emp_status
    FROM public.schedule_assignments sa
    JOIN public.employees e ON e.id = sa.employee_id
    WHERE sa.roster_period_id = p_source_period_id
  LOOP
    IF (v_rec.work_date + v_day_offset) BETWEEN p_target_start AND p_target_end THEN
      -- Only copy if employee is contractually active on target date
      IF (v_rec.hire_date IS NULL OR (v_rec.work_date + v_day_offset) >= v_rec.hire_date)
         AND (v_rec.exit_date IS NULL OR (v_rec.work_date + v_day_offset) <= v_rec.exit_date)
         AND v_rec.emp_status != 'terminated' THEN

        INSERT INTO public.schedule_assignments (
          company_id, roster_period_id, roster_version, shift_id, shift_version,
          employee_id, work_date, is_rest_day, work_location_id, status, source, created_by
        ) VALUES (
          v_source.company_id, v_new_roster_id, 1, v_rec.shift_id, v_rec.shift_version,
          v_rec.employee_id, v_rec.work_date + v_day_offset, v_rec.is_rest_day,
          v_rec.work_location_id, 'draft', 'copy', auth.uid()
        ) ON CONFLICT (employee_id, work_date, roster_version) DO UPDATE
        SET shift_id = EXCLUDED.shift_id, is_rest_day = EXCLUDED.is_rest_day, work_location_id = EXCLUDED.work_location_id;

        v_copied_count := v_copied_count + 1;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.roster_audit_logs (
    company_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_source.company_id, 'roster_copied', 'roster_period', v_new_roster_id, auth.uid(),
    jsonb_build_object('source_id', p_source_period_id, 'copied_assignments', v_copied_count)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'new_roster_id', v_new_roster_id,
    'copied_count', v_copied_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.copy_roster_period(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_roster_period(uuid, date, date, text) TO service_role;


-- ============================================================================
-- 18. SHIFT SWAP APPROVAL RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_shift_swap(
  p_swap_request_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap public.shift_swap_requests%ROWTYPE;
  v_asg_req public.schedule_assignments%ROWTYPE;
  v_asg_tgt public.schedule_assignments%ROWTYPE;
  v_temp_shift uuid;
  v_temp_rest boolean;
  v_temp_loc uuid;
BEGIN
  SELECT * INTO v_swap FROM public.shift_swap_requests WHERE id = p_swap_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب تبادل الوردية غير موجود' USING ERRCODE = '22023';
  END IF;

  -- Tenant authorization check
  IF auth.role() <> 'service_role' AND v_swap.company_id IS DISTINCT FROM public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى بيانات شركة أخرى' USING ERRCODE = '42501';
  END IF;

  IF v_swap.status != 'pending_approval' THEN
    RAISE EXCEPTION 'طلب التبادل ليس قيد الاعتماد (الحالة: %)', v_swap.status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_asg_req FROM public.schedule_assignments WHERE id = v_swap.requester_assignment_id;
  SELECT * INTO v_asg_tgt FROM public.schedule_assignments WHERE id = v_swap.target_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أحد إسنادات الورديات المرتبطة بالطلب لم يعد موجوداً' USING ERRCODE = '22023';
  END IF;

  -- Swap shift definitions and locations transactionally
  v_temp_shift := v_asg_req.shift_id;
  v_temp_rest := v_asg_req.is_rest_day;
  v_temp_loc := v_asg_req.work_location_id;

  UPDATE public.schedule_assignments
  SET
    shift_id = v_asg_tgt.shift_id,
    shift_name_ar = v_asg_tgt.shift_name_ar,
    shift_color = v_asg_tgt.shift_color,
    shift_version = v_asg_tgt.shift_version,
    is_rest_day = v_asg_tgt.is_rest_day,
    work_location_id = v_asg_tgt.work_location_id,
    source = 'swap',
    updated_at = now()
  WHERE id = v_asg_req.id;

  UPDATE public.schedule_assignments
  SET
    shift_id = v_temp_shift,
    shift_name_ar = v_asg_req.shift_name_ar,
    shift_color = v_asg_req.shift_color,
    shift_version = v_asg_req.shift_version,
    is_rest_day = v_temp_rest,
    work_location_id = v_temp_loc,
    source = 'swap',
    updated_at = now()
  WHERE id = v_asg_tgt.id;

  UPDATE public.shift_swap_requests
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = p_notes,
    updated_at = now()
  WHERE id = p_swap_request_id;

  INSERT INTO public.roster_audit_logs (
    company_id, action, entity_type, entity_id, actor_id, details
  ) VALUES (
    v_swap.company_id, 'swap_approved', 'swap', p_swap_request_id, auth.uid(),
    jsonb_build_object('requester', v_swap.requester_employee_id, 'target', v_swap.target_employee_id)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'approved');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_shift_swap(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_shift_swap(uuid, text) TO service_role;


-- ============================================================================
-- 19. ATTENDANCE INTERLOCK TRIGGER ON SCHEDULE ASSIGNMENTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_roster_attendance_period_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_date date;
  v_comp_id uuid;
  v_closed_cnt integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_work_date := OLD.work_date;
    v_comp_id := OLD.company_id;
  ELSE
    v_work_date := NEW.work_date;
    v_comp_id := NEW.company_id;
  END IF;

  IF v_comp_id IS NOT NULL AND v_work_date IS NOT NULL THEN
    SELECT count(*) INTO v_closed_cnt
    FROM public.attendance_periods ap
    WHERE ap.company_id = v_comp_id
      AND v_work_date BETWEEN ap.from_date AND ap.to_date
      AND ap.status IN ('closed', 'exported_to_payroll');

    IF v_closed_cnt > 0 THEN
      RAISE EXCEPTION 'لا يمكن تعديل أو حذف جدول العمل لتاريخ (%) يقع ضمن فترة حضور مقفلة أو مصدرة للرواتب.', v_work_date USING ERRCODE = '22023';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_roster_attendance_period_lock ON public.schedule_assignments;
CREATE TRIGGER trg_check_roster_attendance_period_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION public.check_roster_attendance_period_lock();


-- ============================================================================
-- 20. ROW LEVEL SECURITY POLICIES FOR SHIFTS & ROSTERS
-- ============================================================================

-- A. Shifts Policies
DROP POLICY IF EXISTS shifts_read ON public.shifts;
CREATE POLICY shifts_read ON public.shifts
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS shifts_manage ON public.shifts;
CREATE POLICY shifts_manage ON public.shifts
  FOR ALL TO authenticated
  USING (
    (company_id = public.current_company_id() OR company_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- B. Shift Segments Policies
DROP POLICY IF EXISTS shift_segments_read ON public.shift_segments;
CREATE POLICY shift_segments_read ON public.shift_segments
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS shift_segments_manage ON public.shift_segments;
CREATE POLICY shift_segments_manage ON public.shift_segments
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- C. Roster Periods Policies
DROP POLICY IF EXISTS roster_periods_read ON public.roster_periods;
CREATE POLICY roster_periods_read ON public.roster_periods
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      status = 'published'
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

DROP POLICY IF EXISTS roster_periods_manage ON public.roster_periods;
CREATE POLICY roster_periods_manage ON public.roster_periods
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- D. Schedule Assignments Policies (Employee Self, Team Manager, HR Admin)
DROP POLICY IF EXISTS schedule_assignments_read ON public.schedule_assignments;
CREATE POLICY schedule_assignments_read ON public.schedule_assignments
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      -- 1. Employee sees their own published schedule
      (employee_id = public.resolve_my_employee_id() AND status = 'published')
      -- 2. Line Manager sees team members published schedules
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = schedule_assignments.employee_id
          AND e.manager_id = public.resolve_my_employee_id()
          AND schedule_assignments.status = 'published'
      )
      -- 3. HR / Attendance Admins see all (draft and published)
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

DROP POLICY IF EXISTS schedule_assignments_manage ON public.schedule_assignments;
CREATE POLICY schedule_assignments_manage ON public.schedule_assignments
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- E. Roster Templates & Rotation Patterns Policies
DROP POLICY IF EXISTS roster_templates_read ON public.roster_templates;
CREATE POLICY roster_templates_read ON public.roster_templates
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS roster_templates_manage ON public.roster_templates;
CREATE POLICY roster_templates_manage ON public.roster_templates
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

DROP POLICY IF EXISTS rotation_patterns_read ON public.rotation_patterns;
CREATE POLICY rotation_patterns_read ON public.rotation_patterns
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS rotation_patterns_manage ON public.rotation_patterns;
CREATE POLICY rotation_patterns_manage ON public.rotation_patterns
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );

-- F. Roster Coverage Requirements & Exceptions Policies
DROP POLICY IF EXISTS roster_coverage_requirements_policy ON public.roster_coverage_requirements;
CREATE POLICY roster_coverage_requirements_policy ON public.roster_coverage_requirements
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS roster_exceptions_policy ON public.roster_exceptions;
CREATE POLICY roster_exceptions_policy ON public.roster_exceptions
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id());

-- G. Shift Swap Requests Policies
DROP POLICY IF EXISTS shift_swap_requests_read ON public.shift_swap_requests;
CREATE POLICY shift_swap_requests_read ON public.shift_swap_requests
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      requester_employee_id = public.resolve_my_employee_id()
      OR target_employee_id = public.resolve_my_employee_id()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer', 'line_manager')
      )
    )
  );

DROP POLICY IF EXISTS shift_swap_requests_manage ON public.shift_swap_requests;
CREATE POLICY shift_swap_requests_manage ON public.shift_swap_requests
  FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      requester_employee_id = public.resolve_my_employee_id()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
      )
    )
  );

-- H. Roster Audit Logs Policies
DROP POLICY IF EXISTS roster_audit_logs_read ON public.roster_audit_logs;
CREATE POLICY roster_audit_logs_read ON public.roster_audit_logs
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')
    )
  );


-- ============================================================================
-- 21. TABLE GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_segments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_periods TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_templates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotation_patterns TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_coverage_requirements TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_exceptions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_swap_requests TO authenticated, service_role;
GRANT SELECT, INSERT ON public.roster_audit_logs TO authenticated, service_role;

COMMIT;
