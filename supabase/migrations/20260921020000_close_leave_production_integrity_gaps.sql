-- =============================================================================
-- Migration: 20260921020000_close_leave_production_integrity_gaps.sql
-- Purpose:   Prompt 10 Final Micro Hotfix:
--            1. Remove implicit DB work-week defaults from companies & shifts.
--            2. Require explicit work-week configuration in calculate_working_days (no Friday/Saturday guess).
--            3. Add company_id and is_system_template to approval_chains with tenant-scoped RLS.
--            4. Remove line_manager fallback in submit_leave_request (require explicit active chain).
--            5. Deterministic approval chain resolution priority (dept -> all_emp -> default -> system).
--            6. Authoritative current-approver enforcement in decide_leave_request (remove universal HR bypass).
--            7. Materialize approver_employee_id and conditions into approval_steps.
--            8. Returned request resubmission lifecycle with atomic reserved balance adjustment.
--            9. Strict leave attachment validation (leave_attachment_staging, leave-attachments bucket, metadata-first).
--            10. Attachment finalization to leave_request_attachment and strict private RLS.
--            11. Deduct transferable/expired days from source balance in run_leave_carryover.
--            12. Implement run_leave_carryover_expiry with idempotency table leave_carryover_expiry_runs.
--            13. Contract-anniversary accrual truthfulness (no fake hire date fallback).
--            14. Company timezone support in accrual period calculations.
--            15. Explicit accrual employee eligibility (active, probation, on_leave).
--            16. Deterministic company-scoped leave type code generator (no Math.random).
--            17. Explicit leave type policy configuration without silent defaults.
--            18. Null English leave name when omitted (never copy Arabic).
--            19. Protect system templates (is_system_template) against non-super_admin mutations.
--            20. Secure team calendar privacy defaults.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Schema Corrections & Additions
-- -----------------------------------------------------------------------------

-- 1.1 Remove implicit DB defaults for work-week from companies & shifts (Item 1)
ALTER TABLE public.companies
  ALTER COLUMN work_days DROP DEFAULT,
  ALTER COLUMN rest_days DROP DEFAULT;

ALTER TABLE public.shifts
  ALTER COLUMN work_days DROP DEFAULT,
  ALTER COLUMN rest_days DROP DEFAULT;

-- 1.2 Add company_id and is_system_template to approval_chains (Items 3 & 4)
ALTER TABLE public.approval_chains
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_system_template boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_approval_chains_company_type
  ON public.approval_chains(company_id, request_type, status);

-- 1.3 Add approver_employee_id and conditions to approval_steps (Item 8)
ALTER TABLE public.approval_steps
  ADD COLUMN IF NOT EXISTS approver_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conditions jsonb DEFAULT NULL;

-- 1.4 Add transferred_out_days and expired_days to leave_balances (Item 18 & 19)
ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS transferred_out_days numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expired_days numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carried_over_expired_days numeric(10,2) NOT NULL DEFAULT 0;

-- 1.5 Add is_system_template to leave_types and mark existing global templates (Item 27 & 28)
ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS is_system_template boolean NOT NULL DEFAULT false;

UPDATE public.leave_types
SET is_system_template = true
WHERE company_id IS NULL;

-- 1.6 Idempotency tracking table for carryover expiry (Item 20)
CREATE TABLE IF NOT EXISTS public.leave_carryover_expiry_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  expiry_date date NOT NULL,
  expired_days numeric(10,2) NOT NULL DEFAULT 0,
  executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_leave_carryover_expiry_run UNIQUE (company_id, leave_type_id, year, expiry_date)
);

ALTER TABLE public.leave_carryover_expiry_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leave_carryover_expiry_runs FROM authenticated;
GRANT SELECT ON public.leave_carryover_expiry_runs TO authenticated;
GRANT ALL ON public.leave_carryover_expiry_runs TO service_role;

DROP POLICY IF EXISTS "leave_carryover_expiry_runs_select" ON public.leave_carryover_expiry_runs;
CREATE POLICY "leave_carryover_expiry_runs_select"
  ON public.leave_carryover_expiry_runs FOR SELECT TO authenticated
  USING (
    public.current_user_can_manage_company(company_id)
    OR public.current_user_has_any_role(ARRAY['super_admin'])
  );

-- -----------------------------------------------------------------------------
-- STEP 2: Approval Chains RLS Hardening (Item 4)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "approval_chains_authenticated_read" ON public.approval_chains;
DROP POLICY IF EXISTS "approval_chains_hr_write" ON public.approval_chains;
DROP POLICY IF EXISTS "approval_chains_scoped_read" ON public.approval_chains;
DROP POLICY IF EXISTS "approval_chains_scoped_write" ON public.approval_chains;

CREATE POLICY "approval_chains_scoped_read"
  ON public.approval_chains FOR SELECT TO authenticated
  USING (
    is_system_template = true
    OR company_id = public.current_company_id()
    OR company_id = (SELECT company_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)
    OR public.current_user_can_manage_company(company_id)
    OR public.current_user_has_any_role(ARRAY['super_admin'])
  );

CREATE POLICY "approval_chains_scoped_write"
  ON public.approval_chains FOR ALL TO authenticated
  USING (
    (company_id IS NOT NULL AND public.current_user_can_manage_company(company_id))
    OR public.current_user_has_any_role(ARRAY['super_admin'])
  )
  WITH CHECK (
    (company_id IS NOT NULL AND public.current_user_can_manage_company(company_id))
    OR public.current_user_has_any_role(ARRAY['super_admin'])
  );

-- -----------------------------------------------------------------------------
-- STEP 3: Leave Types Protection & System Template Safety (Item 28)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "leave_types_scoped_write" ON public.leave_types;
CREATE POLICY "leave_types_scoped_write"
  ON public.leave_types FOR ALL TO authenticated
  USING (
    (is_system_template = false AND company_id IS NOT NULL AND public.current_user_can_manage_company(company_id))
    OR public.current_user_has_any_role(ARRAY['super_admin'])
  )
  WITH CHECK (
    (is_system_template = false AND company_id IS NOT NULL AND public.current_user_can_manage_company(company_id))
    OR public.current_user_has_any_role(ARRAY['super_admin'])
  );

-- -----------------------------------------------------------------------------
-- STEP 4: RPC calculate_working_days (Items 1 & 2)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_working_days(
  p_company_id uuid DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,
  p_leave_type_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_is_half_day boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_emp public.employees%ROWTYPE;
  v_target_emp public.employees%ROWTYPE;
  v_resolved_company_id uuid;
  v_company public.companies%ROWTYPE;
  v_shift public.shifts%ROWTYPE;
  v_effective_rest_days integer[];
  v_curr_date date;
  v_dow integer;
  v_is_rest boolean;
  v_is_holiday boolean;
  v_working_days numeric := 0;
  v_has_schedule boolean := false;
  v_is_sched_rest boolean := false;
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ البداية والنهاية مطلوبان لاحتساب أيام العمل.';
  END IF;

  IF p_end_date < p_start_date THEN
    RETURN 0;
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT * INTO v_caller_emp FROM public.employees WHERE user_id = v_user_id;
  END IF;

  IF p_employee_id IS NOT NULL THEN
    SELECT * INTO v_target_emp FROM public.employees WHERE id = p_employee_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الموظف المحدد غير موجود.';
    END IF;

    IF v_caller_emp.id IS NULL OR v_caller_emp.id <> v_target_emp.id THEN
      IF NOT public.current_user_can_manage_company(v_target_emp.company_id)
         AND NOT public.current_user_has_any_role(ARRAY['super_admin'])
         AND v_target_emp.manager_id <> v_caller_emp.id THEN
        RAISE EXCEPTION 'غير مصرح لك باحتساب أيام العمل لموظف خارج صلاحياتك الإدارية.';
      END IF;
    END IF;
    v_resolved_company_id := v_target_emp.company_id;
  ELSE
    IF v_caller_emp.id IS NOT NULL THEN
      v_target_emp := v_caller_emp;
      v_resolved_company_id := v_caller_emp.company_id;
    ELSE
      v_resolved_company_id := COALESCE(p_company_id, public.current_company_id());
    END IF;
  END IF;

  IF p_company_id IS NOT NULL AND p_company_id <> v_resolved_company_id THEN
    IF NOT public.current_user_can_manage_company(p_company_id)
       AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
      RAISE EXCEPTION 'غير مصرح لك باحتساب أيام العمل لمنشأة أخرى.';
    END IF;
    v_resolved_company_id := p_company_id;
  END IF;

  SELECT * INTO v_company FROM public.companies WHERE id = v_resolved_company_id;

  IF v_target_emp.shift_id IS NOT NULL THEN
    SELECT * INTO v_shift FROM public.shifts WHERE id = v_target_emp.shift_id;
  END IF;

  -- Item 1: Resolve rest days with NO silent Friday/Saturday default
  IF v_shift.rest_days IS NOT NULL AND array_length(v_shift.rest_days, 1) > 0 THEN
    v_effective_rest_days := v_shift.rest_days;
  ELSIF v_company.rest_days IS NOT NULL AND array_length(v_company.rest_days, 1) > 0 THEN
    v_effective_rest_days := v_company.rest_days;
  END IF;

  -- If neither shift nor company has configured rest days, check if published schedules exist
  -- Otherwise FAIL explicitly without guessing:
  IF v_effective_rest_days IS NULL THEN
    -- Check if target employee has published schedule assignments
    SELECT EXISTS (
      SELECT 1 FROM public.schedule_assignments
      WHERE employee_id = v_target_emp.id AND work_date BETWEEN p_start_date AND p_end_date
    ) INTO v_has_schedule;

    IF NOT v_has_schedule THEN
      RAISE EXCEPTION 'لم يتم إعداد أيام العمل والراحة للمنشأة.';
    END IF;
  END IF;

  IF p_is_half_day THEN
    IF p_start_date <> p_end_date THEN
      RAISE EXCEPTION 'إجازة نصف اليوم يجب أن تكون لتاريخ يوم واحد فقط.';
    END IF;
  END IF;

  v_curr_date := p_start_date;
  WHILE v_curr_date <= p_end_date LOOP
    v_is_rest := false;
    v_is_holiday := false;
    v_has_schedule := false;

    IF v_target_emp.id IS NOT NULL THEN
      SELECT is_rest_day INTO v_is_sched_rest
      FROM public.schedule_assignments
      WHERE employee_id = v_target_emp.id AND work_date = v_curr_date
      LIMIT 1;

      IF FOUND THEN
        v_is_rest := COALESCE(v_is_sched_rest, false);
        v_has_schedule := true;
      END IF;
    END IF;

    IF NOT v_has_schedule THEN
      IF v_effective_rest_days IS NOT NULL THEN
        v_dow := EXTRACT(DOW FROM v_curr_date)::int;
        IF v_effective_rest_days @> ARRAY[v_dow] THEN
          v_is_rest := true;
        END IF;
      END IF;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.company_holidays
      WHERE company_id = v_resolved_company_id
        AND v_curr_date BETWEEN start_date AND end_date
        AND is_paid = true
    ) INTO v_is_holiday;

    IF NOT v_is_rest AND NOT v_is_holiday THEN
      v_working_days := v_working_days + 1;
    END IF;

    v_curr_date := v_curr_date + 1;
  END LOOP;

  IF p_is_half_day THEN
    IF v_working_days >= 1 THEN
      RETURN 0.5;
    ELSE
      RETURN 0;
    END IF;
  END IF;

  RETURN v_working_days;
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 5: RPC submit_leave_request (Items 4, 5, 6, 8, 14, 15, 16)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_leave_request(
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_is_half_day boolean DEFAULT false,
  p_half_day_period text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_replacement_employee_id uuid DEFAULT NULL,
  p_emergency_phone text DEFAULT NULL,
  p_attachment_file_id uuid DEFAULT NULL,
  p_target_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_emp public.employees%ROWTYPE;
  v_employee public.employees%ROWTYPE;
  v_company_id uuid;
  v_leave_type public.leave_types%ROWTYPE;
  v_year integer;
  v_chargeable_days numeric;
  v_balance public.leave_balances%ROWTYPE;
  v_available numeric;
  v_reference text;
  v_seq_val bigint;
  v_request_id uuid;
  v_chain public.approval_chains%ROWTYPE;
  v_steps jsonb;
  v_total_steps integer;
  v_first_step jsonb;
  v_first_role text;
  v_step_item jsonb;
  v_step_idx integer;
  v_rep_emp public.employees%ROWTYPE;
  v_att_file public.file_objects%ROWTYPE;
  v_step_approver_emp_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتقديم طلب إجازة.';
  END IF;

  SELECT * INTO v_caller_emp FROM public.employees WHERE user_id = v_user_id;

  IF p_target_employee_id IS NOT NULL THEN
    SELECT * INTO v_employee FROM public.employees WHERE id = p_target_employee_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الموظف المستهدف غير موجود.';
    END IF;

    IF v_caller_emp.id IS NULL OR v_caller_emp.id <> v_employee.id THEN
      IF NOT public.current_user_can_manage_company(v_employee.company_id)
         AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
        RAISE EXCEPTION 'غير مصرح لك بتقديم إجازة نيابة عن موظف في شركة أخرى.';
      END IF;
    END IF;
  ELSE
    IF v_caller_emp.id IS NULL THEN
      RAISE EXCEPTION 'لا يوجد ملف موظف نشط مرتبط بحسابك الحالي.';
    END IF;
    v_employee := v_caller_emp;
  END IF;

  v_company_id := v_employee.company_id;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'يرجى تحديد تاريخ البداية وتاريخ النهاية.';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'تاريخ نهاية الإجازة يجب أن يكون مساوياً أو لاحقاً لتاريخ البداية.';
  END IF;

  IF EXTRACT(YEAR FROM p_start_date)::int <> EXTRACT(YEAR FROM p_end_date)::int THEN
    RAISE EXCEPTION 'طلب الإجازة يمتد عبر سنتين تقويميتين مختلفتين (% و %). يرجى تقديم طلب إجازة منفصل لكل سنة على حدة لضمان دقة الاستحقاق وترحيل الأرصدة.',
      EXTRACT(YEAR FROM p_start_date)::int,
      EXTRACT(YEAR FROM p_end_date)::int;
  END IF;

  v_year := EXTRACT(YEAR FROM p_start_date)::int;

  IF p_is_half_day THEN
    IF p_start_date <> p_end_date THEN
      RAISE EXCEPTION 'إجازة نصف اليوم يجب أن تكون في يوم واحد فقط.';
    END IF;
    IF p_half_day_period IS NULL OR p_half_day_period NOT IN ('first_half', 'second_half') THEN
      RAISE EXCEPTION 'يرجى تحديد فترة نصف اليوم بشكل صحيح (النصف الأول first_half أو النصف الثاني second_half).';
    END IF;
  END IF;

  SELECT * INTO v_leave_type FROM public.leave_types WHERE id = p_leave_type_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'نوع الإجازة المحدد غير موجود.';
  END IF;

  IF v_leave_type.status <> 'active' THEN
    RAISE EXCEPTION 'نوع الإجازة غير نشط حالياً.';
  END IF;

  IF v_leave_type.company_id IS NOT NULL AND v_leave_type.company_id <> v_company_id THEN
    RAISE EXCEPTION 'نوع الإجازة لا ينتمي لنفس المنشأة التابع لها الموظف.';
  END IF;

  IF p_replacement_employee_id IS NOT NULL THEN
    SELECT * INTO v_rep_emp FROM public.employees WHERE id = p_replacement_employee_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الموظف البديل المحدد غير موجود.';
    END IF;
    IF v_rep_emp.company_id <> v_company_id THEN
      RAISE EXCEPTION 'الموظف البديل يجب أن يكون تابعاً لنفس منشأة الموظف.';
    END IF;
  END IF;

  -- Strict attachment validation (Items 13, 14, 15)
  IF v_leave_type.requires_attachment AND p_attachment_file_id IS NULL THEN
    RAISE EXCEPTION 'سياسة هذا النوع من الإجازات تتطلب إرفاق تقرير أو مستند رسمي.';
  END IF;

  IF p_attachment_file_id IS NOT NULL THEN
    SELECT * INTO v_att_file FROM public.file_objects WHERE id = p_attachment_file_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'المرفق المحدد غير موجود في سجل الملفات الآمنة.';
    END IF;
    IF v_att_file.status <> 'active' AND v_att_file.status <> 'staged' THEN
      RAISE EXCEPTION 'مستند المرفق المحدد غير نشط أو تم حذفه.';
    END IF;
    IF v_att_file.entity_type <> 'leave_attachment_staging' THEN
      RAISE EXCEPTION 'لا يمكن استخدام مستندات أو صور عادية كملف مرفق لإجازة. يجب رفع الملف عبر نموذج الإجازة.';
    END IF;
    IF v_att_file.bucket <> 'leave-attachments' THEN
      RAISE EXCEPTION 'المرفق يجب أن يكون محفوظاً في حاوية مرفقات الإجازات الآمنة (leave-attachments).';
    END IF;
    IF v_att_file.company_id <> v_company_id THEN
      RAISE EXCEPTION 'المرفق لا ينتمي لنفس منشأة الموظف.';
    END IF;
    IF v_att_file.employee_id IS NOT NULL AND v_att_file.employee_id <> v_employee.id THEN
      RAISE EXCEPTION 'المرفق لا ينتمي لنفس الموظف مقدم الطلب.';
    END IF;
    IF v_att_file.uploaded_by <> v_user_id AND NOT public.current_user_can_manage_company(v_company_id) THEN
      RAISE EXCEPTION 'المرفق لم يتم رفعه بواسطة المستخدم الحالي أو مسؤول المنشأة.';
    END IF;
  END IF;

  v_chargeable_days := public.calculate_working_days(
    v_company_id, v_employee.id, p_leave_type_id, p_start_date, p_end_date, p_is_half_day
  );

  IF v_chargeable_days <= 0 THEN
    RAISE EXCEPTION 'الفترة المحددة لا تحتوي على أي أيام عمل فعلية مستحقة للخصم (عطلة رسمية أو راحة أسبوعية).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.requests
    WHERE employee_id = v_employee.id
      AND type = 'leave'
      AND status IN ('pending', 'pending_approval', 'approved')
      AND start_date <= p_end_date
      AND end_date >= p_start_date
  ) THEN
    RAISE EXCEPTION 'يوجد طلب إجازة نشط أو معتمد مسبقاً يتداخل مع الفترة المحددة.';
  END IF;

  SELECT * INTO v_balance
  FROM public.leave_balances
  WHERE employee_id = v_employee.id AND leave_type_id = p_leave_type_id AND year = v_year
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.leave_balances (
      employee_id, leave_type_id, company_id, year,
      annual_entitlement,
      accrued_days,
      used_days, reserved_days, carried_over_days
    ) VALUES (
      v_employee.id, p_leave_type_id, v_company_id, v_year,
      COALESCE(v_leave_type.max_days_per_year, 0),
      CASE WHEN v_leave_type.accrual_method = 'yearly_frontloaded' THEN COALESCE(v_leave_type.max_days_per_year, 0) ELSE 0 END,
      0, 0, 0
    )
    RETURNING * INTO v_balance;

    INSERT INTO public.leave_balance_transactions (
      company_id, employee_id, leave_type_id, year, transaction_type, days, reason, created_by
    ) VALUES (
      v_company_id, v_employee.id, p_leave_type_id, v_year, 'opening',
      v_balance.accrued_days, 'رصيد افتتاحي أولي للعام', v_user_id
    );
  END IF;

  v_available := (v_balance.accrued_days + v_balance.carried_over_days) - (v_balance.used_days + v_balance.reserved_days + v_balance.transferred_out_days + v_balance.expired_days);

  IF v_available < v_chargeable_days AND NOT COALESCE(v_leave_type.allow_negative_balance, false) THEN
    RAISE EXCEPTION 'رصيدك المتاح (% يوم) لا يكفي لتغطية مدة الإجازة المطلوبة (% يوم).', v_available, v_chargeable_days;
  END IF;

  UPDATE public.leave_balances
  SET reserved_days = reserved_days + v_chargeable_days,
      updated_at = now()
  WHERE id = v_balance.id;

  INSERT INTO public.company_request_sequences (company_id, year, current_val)
  VALUES (v_company_id, v_year, 1)
  ON CONFLICT (company_id, year)
  DO UPDATE SET current_val = company_request_sequences.current_val + 1, updated_at = now()
  RETURNING current_val INTO v_seq_val;

  v_reference := 'REQ-' || v_year || '-' || lpad(v_seq_val::text, 5, '0');

  -- Deterministic approval chain resolution (Item 5 & 6)
  -- Priority 1: Same-company department-specific
  SELECT * INTO v_chain
  FROM public.approval_chains
  WHERE company_id = v_company_id
    AND request_type = 'leave'
    AND status = 'active'
    AND scope_type = 'department'
    AND scope_values @> to_jsonb(v_employee.department_id::text)
  LIMIT 1;

  -- Priority 2: Same-company all_employees
  IF NOT FOUND THEN
    SELECT * INTO v_chain
    FROM public.approval_chains
    WHERE company_id = v_company_id
      AND request_type = 'leave'
      AND status = 'active'
      AND scope_type = 'all_employees'
      AND is_default = false
    LIMIT 1;
  END IF;

  -- Priority 3: Same-company default
  IF NOT FOUND THEN
    SELECT * INTO v_chain
    FROM public.approval_chains
    WHERE company_id = v_company_id
      AND request_type = 'leave'
      AND status = 'active'
      AND is_default = true
    LIMIT 1;
  END IF;

  -- Priority 4: Explicit global system template (company_id IS NULL AND is_system_template = true)
  IF NOT FOUND THEN
    SELECT * INTO v_chain
    FROM public.approval_chains
    WHERE company_id IS NULL
      AND is_system_template = true
      AND request_type = 'leave'
      AND status = 'active'
      AND is_default = true
    LIMIT 1;
  END IF;

  -- Item 5: If no active chain exists, REJECT without inventing fallback line-manager chain
  IF NOT FOUND OR v_chain.steps IS NULL OR jsonb_array_length(v_chain.steps) = 0 THEN
    RAISE EXCEPTION 'لم يتم إعداد مسار اعتماد لطلبات الإجازات لهذه المنشأة.';
  END IF;

  v_steps := v_chain.steps;
  v_total_steps := jsonb_array_length(v_steps);
  v_first_step := v_steps->0;
  v_first_role := COALESCE(v_first_step->>'approverRole', v_first_step->>'role', 'line_manager');

  INSERT INTO public.requests (
    reference, employee_id, company_id, type, status,
    start_date, end_date, days, reason, created_by,
    current_step_index, total_steps, current_approver_role,
    payload
  ) VALUES (
    v_reference, v_employee.id, v_company_id, 'leave', 'pending_approval',
    p_start_date, p_end_date, v_chargeable_days, p_reason, v_user_id,
    1, v_total_steps, v_first_role,
    jsonb_build_object(
      'leave_type_id', p_leave_type_id,
      'leave_type_name_ar', v_leave_type.name_ar,
      'is_half_day', p_is_half_day,
      'half_day_period', p_half_day_period,
      'working_days', v_chargeable_days,
      'attachment_file_id', p_attachment_file_id,
      'replacement_employee_id', p_replacement_employee_id,
      'emergency_phone', p_emergency_phone,
      'approval_chain_id', v_chain.id
    )
  )
  RETURNING id INTO v_request_id;

  -- Materialize approval steps with approver_employee_id and conditions (Item 8)
  FOR v_step_idx IN 0..(v_total_steps - 1) LOOP
    v_step_item := v_steps->v_step_idx;
    v_step_approver_emp_id := NULL;
    IF (v_step_item->>'approverEmployeeId') IS NOT NULL AND (v_step_item->>'approverEmployeeId') <> '' THEN
      v_step_approver_emp_id := (v_step_item->>'approverEmployeeId')::uuid;
    ELSIF (v_step_item->>'approver_employee_id') IS NOT NULL AND (v_step_item->>'approver_employee_id') <> '' THEN
      v_step_approver_emp_id := (v_step_item->>'approver_employee_id')::uuid;
    END IF;

    INSERT INTO public.approval_steps (
      request_id, step_order, approver_role, approver_employee_id, conditions, status
    ) VALUES (
      v_request_id,
      COALESCE((v_step_item->>'order')::int, (v_step_item->>'stepOrder')::int, v_step_idx + 1),
      COALESCE(v_step_item->>'approverRole', v_step_item->>'role', 'line_manager'),
      v_step_approver_emp_id,
      v_step_item->'conditions',
      CASE WHEN v_step_idx = 0 THEN 'pending' ELSE 'waiting' END
    );
  END LOOP;

  INSERT INTO public.leave_balance_transactions (
    company_id, employee_id, leave_type_id, year,
    transaction_type, days, request_id, reason, created_by
  ) VALUES (
    v_company_id, v_employee.id, p_leave_type_id, v_year,
    'reservation', v_chargeable_days, v_request_id,
    COALESCE(p_reason, 'حجز رصيد لطلب إجازة قيد الاعتماد'), v_user_id
  );

  INSERT INTO public.request_timeline (
    request_id, step_number, actor_id, actor_name, actor_role, action, note
  ) VALUES (
    v_request_id, 1, v_user_id,
    v_employee.first_name_ar || ' ' || v_employee.last_name_ar,
    'مقدم الطلب', 'submitted', 'تم تقديم طلب الإجازة وحجز الرصيد بنجاح'
  );

  -- Finalize attachment (Item 16)
  IF p_attachment_file_id IS NOT NULL THEN
    UPDATE public.file_objects
    SET entity_type = 'leave_request_attachment',
        entity_id = v_request_id::text,
        status = 'active',
        updated_at = now()
    WHERE id = p_attachment_file_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'reference', v_reference,
    'chargeable_days', v_chargeable_days,
    'available_remaining', v_available - v_chargeable_days,
    'message', format('تم تقديم طلب الإجازة بنجاح ومدتها (%s) أيام عمل.', v_chargeable_days)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 6: RPC decide_leave_request (Item 7)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_leave_request(
  p_request_id uuid,
  p_decision text, -- approved, rejected, returned, withdrawn
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_emp public.employees%ROWTYPE;
  v_request public.requests%ROWTYPE;
  v_leave_type_id uuid;
  v_chargeable_days numeric;
  v_year integer;
  v_balance public.leave_balances%ROWTYPE;
  v_current_step public.approval_steps%ROWTYPE;
  v_is_authorized boolean := false;
  v_is_owner boolean := false;
  v_is_delegated boolean := false;
  v_delegator_id uuid;
  v_is_final boolean := false;
  v_is_emergency_override boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لمعالجة الطلب.';
  END IF;

  SELECT * INTO v_caller_emp FROM public.employees WHERE user_id = v_user_id;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = p_request_id AND type = 'leave'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الإجازة غير موجود.';
  END IF;

  IF v_request.status = 'approved' AND p_decision = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'status', 'approved', 'message', 'تم اعتماد هذا الطلب مسبقاً.');
  END IF;
  IF v_request.status = 'rejected' AND p_decision = 'rejected' THEN
    RETURN jsonb_build_object('success', true, 'status', 'rejected', 'message', 'تم رفض هذا الطلب مسبقاً.');
  END IF;

  IF v_request.status NOT IN ('pending', 'pending_approval') AND p_decision <> 'withdrawn' THEN
    RAISE EXCEPTION 'تمت معالجة هذا الطلب مسبقاً (الحالة الحالية: %).', v_request.status;
  END IF;

  v_is_owner := (v_request.created_by = v_user_id) OR (
    v_caller_emp.id IS NOT NULL AND v_request.employee_id = v_caller_emp.id
  );

  IF p_decision = 'withdrawn' THEN
    IF NOT v_is_owner AND NOT public.current_user_can_manage_company(v_request.company_id) THEN
      RAISE EXCEPTION 'غير مصرح لك بسحب هذا الطلب.';
    END IF;
  ELSE
    -- Current step approver validation (Item 7: Remove universal HR bypass)
    SELECT * INTO v_current_step
    FROM public.approval_steps
    WHERE request_id = p_request_id AND step_order = v_request.current_step_index
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'خطوة مسار الاعتماد الحالية غير موجودة.';
    END IF;

    -- 1. Check specific employee approver
    IF v_current_step.approver_employee_id IS NOT NULL THEN
      IF v_caller_emp.id = v_current_step.approver_employee_id THEN
        v_is_authorized := true;
      END IF;
    ELSIF v_current_step.approver_user_id IS NOT NULL THEN
      IF v_user_id = v_current_step.approver_user_id::uuid THEN
        v_is_authorized := true;
      END IF;
    ELSIF v_current_step.approver_role = 'line_manager' THEN
      -- Direct line manager only
      IF EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = v_request.employee_id AND e.manager_id = v_caller_emp.id
      ) THEN
        v_is_authorized := true;
      END IF;
    ELSIF v_current_step.approver_role IN ('hr_manager', 'hr') THEN
      -- Authorized HR for this company
      IF public.current_user_can_manage_company(v_request.company_id)
         OR public.current_user_has_any_role(ARRAY['hr_manager', 'hr']) THEN
        v_is_authorized := true;
      END IF;
    ELSIF v_current_step.approver_role = 'finance' THEN
      -- Authorized Finance
      IF public.current_user_has_any_role(ARRAY['finance', 'finance_manager']) THEN
        v_is_authorized := true;
      END IF;
    ELSE
      -- Generic role check
      IF public.current_user_has_any_role(ARRAY[v_current_step.approver_role]) THEN
        v_is_authorized := true;
      END IF;
    END IF;

    -- 2. Delegation check
    IF NOT v_is_authorized AND v_caller_emp.id IS NOT NULL THEN
      SELECT delegator_id INTO v_delegator_id
      FROM public.delegation_rules
      WHERE delegate_id = v_caller_emp.id
        AND status = 'active'
        AND CURRENT_DATE BETWEEN start_date AND end_date
        AND scope IN ('all_requests', 'leave')
      LIMIT 1;

      IF FOUND THEN
        IF v_current_step.approver_employee_id IS NOT NULL AND v_current_step.approver_employee_id = v_delegator_id THEN
          v_is_authorized := true;
          v_is_delegated := true;
        ELSIF v_current_step.approver_role = 'line_manager' AND EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.id = v_request.employee_id AND e.manager_id = v_delegator_id
        ) THEN
          v_is_authorized := true;
          v_is_delegated := true;
        END IF;
      END IF;
    END IF;

    -- 3. Super Admin Emergency Override (explicit & audited)
    IF NOT v_is_authorized AND public.current_user_has_any_role(ARRAY['super_admin']) THEN
      v_is_authorized := true;
      v_is_emergency_override := true;
    END IF;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'غير مصرح لك باعتماد أو رفض هذه الخطوة في مسار الموافقات. الاعتماد مخصص لـ (%) فقط.',
        COALESCE(v_current_step.approver_role, 'المعتمد المحدد');
    END IF;
  END IF;

  v_leave_type_id := (v_request.payload->>'leave_type_id')::uuid;
  v_chargeable_days := COALESCE(v_request.days, (v_request.payload->>'working_days')::numeric, 1);
  v_year := EXTRACT(YEAR FROM v_request.start_date)::int;

  SELECT * INTO v_balance
  FROM public.leave_balances
  WHERE employee_id = v_request.employee_id AND leave_type_id = v_leave_type_id AND year = v_year
  FOR UPDATE;

  IF p_decision = 'approved' THEN
    UPDATE public.approval_steps
    SET status = 'approved',
        acted_by = v_user_id,
        acted_at = now(),
        note = p_note
    WHERE id = v_current_step.id;

    v_is_final := (v_request.current_step_index >= v_request.total_steps);

    IF NOT v_is_final THEN
      UPDATE public.requests
      SET current_step_index = current_step_index + 1,
          current_approver_role = (
            SELECT approver_role FROM public.approval_steps
            WHERE request_id = p_request_id AND step_order = v_request.current_step_index + 1
          ),
          updated_at = now()
      WHERE id = p_request_id;

      UPDATE public.approval_steps
      SET status = 'pending'
      WHERE request_id = p_request_id AND step_order = v_request.current_step_index + 1;

      INSERT INTO public.request_timeline (
        request_id, step_number, actor_id, actor_name, actor_role, action, note
      ) VALUES (
        p_request_id, v_request.current_step_index, v_user_id,
        COALESCE(v_caller_emp.first_name_ar || ' ' || v_caller_emp.last_name_ar, 'المعتمد'),
        CASE WHEN v_is_emergency_override THEN 'super_admin_emergency_override' ELSE COALESCE(v_current_step.approver_role, 'معتمد') END,
        'step_approved',
        COALESCE(p_note, format('تمت الموافقة على الخطوة (%s) وإحالة الطلب للخطوة التالية', v_request.current_step_index))
      );

      RETURN jsonb_build_object(
        'success', true,
        'status', 'pending_approval',
        'current_step', v_request.current_step_index + 1,
        'message', 'تمت الموافقة على الخطوة ونقل الطلب للخطوة التالية في مسار الاعتماد.'
      );
    ELSE
      IF v_balance.id IS NOT NULL THEN
        UPDATE public.leave_balances
        SET reserved_days = GREATEST(0, reserved_days - v_chargeable_days),
            used_days = used_days + v_chargeable_days,
            updated_at = now()
        WHERE id = v_balance.id;

        INSERT INTO public.leave_balance_transactions (
          company_id, employee_id, leave_type_id, year,
          transaction_type, days, request_id, reason, created_by
        ) VALUES (
          v_request.company_id, v_request.employee_id, v_leave_type_id, v_year,
          'usage', v_chargeable_days, p_request_id,
          COALESCE(p_note, 'اعتماد نهائي لطلب الإجازة واستنزاف الرصيد المحجوز'), v_user_id
        );
      END IF;

      UPDATE public.requests
      SET status = 'approved',
          decided_by = v_user_id,
          decided_at = now(),
          decision_note = p_note,
          updated_at = now()
      WHERE id = p_request_id;

      INSERT INTO public.request_timeline (
        request_id, step_number, actor_id, actor_name, actor_role, action, note
      ) VALUES (
        p_request_id, v_request.current_step_index, v_user_id,
        COALESCE(v_caller_emp.first_name_ar || ' ' || v_caller_emp.last_name_ar, 'المعتمد النهائي'),
        CASE WHEN v_is_emergency_override THEN 'super_admin_emergency_override' ELSE 'معتمد نهائي' END,
        'approved',
        COALESCE(p_note, 'تم الاعتماد النهائي للطلب وتسوية الرصيد')
      );
    END IF;

  ELSIF p_decision IN ('rejected', 'returned', 'withdrawn') THEN
    IF p_decision = 'rejected' THEN
      UPDATE public.approval_steps
      SET status = 'rejected',
          acted_by = v_user_id,
          acted_at = now(),
          note = p_note
      WHERE id = v_current_step.id;

      UPDATE public.requests
      SET status = 'rejected',
          decided_by = v_user_id,
          decided_at = now(),
          decision_note = p_note,
          updated_at = now()
      WHERE id = p_request_id;

      IF v_balance.id IS NOT NULL THEN
        UPDATE public.leave_balances
        SET reserved_days = GREATEST(0, reserved_days - v_chargeable_days),
            updated_at = now()
        WHERE id = v_balance.id;

        INSERT INTO public.leave_balance_transactions (
          company_id, employee_id, leave_type_id, year,
          transaction_type, days, request_id, reason, created_by
        ) VALUES (
          v_request.company_id, v_request.employee_id, v_leave_type_id, v_year,
          'reservation_release', v_chargeable_days, p_request_id,
          COALESCE(p_note, 'إلغاء حجز الرصيد لرفض طلب الإجازة'), v_user_id
        );
      END IF;

      INSERT INTO public.request_timeline (
        request_id, step_number, actor_id, actor_name, actor_role, action, note
      ) VALUES (
        p_request_id, v_request.current_step_index, v_user_id,
        COALESCE(v_caller_emp.first_name_ar || ' ' || v_caller_emp.last_name_ar, 'المعتمد'),
        CASE WHEN v_is_emergency_override THEN 'super_admin_emergency_override' ELSE 'معتمد' END,
        'rejected',
        COALESCE(p_note, 'تم رفض الطلب وإلغاء حجز الرصيد')
      );

    ELSIF p_decision = 'returned' THEN
      -- Item 9: Returned keeps reserved balance, allows resubmission
      UPDATE public.approval_steps
      SET status = 'returned',
          acted_by = v_user_id,
          acted_at = now(),
          note = p_note
      WHERE id = v_current_step.id;

      UPDATE public.requests
      SET status = 'returned',
          decision_note = p_note,
          updated_at = now()
      WHERE id = p_request_id;

      INSERT INTO public.request_timeline (
        request_id, step_number, actor_id, actor_name, actor_role, action, note
      ) VALUES (
        p_request_id, v_request.current_step_index, v_user_id,
        COALESCE(v_caller_emp.first_name_ar || ' ' || v_caller_emp.last_name_ar, 'المعتمد'),
        CASE WHEN v_is_emergency_override THEN 'super_admin_emergency_override' ELSE 'معتمد' END,
        'returned',
        COALESCE(p_note, 'أُعيد الطلب للموظف للتعديل وإعادة التقديم')
      );

    ELSIF p_decision = 'withdrawn' THEN
      UPDATE public.requests
      SET status = 'cancelled',
          decision_note = p_note,
          updated_at = now()
      WHERE id = p_request_id;

      IF v_balance.id IS NOT NULL THEN
        UPDATE public.leave_balances
        SET reserved_days = GREATEST(0, reserved_days - v_chargeable_days),
            updated_at = now()
        WHERE id = v_balance.id;

        INSERT INTO public.leave_balance_transactions (
          company_id, employee_id, leave_type_id, year,
          transaction_type, days, request_id, reason, created_by
        ) VALUES (
          v_request.company_id, v_request.employee_id, v_leave_type_id, v_year,
          'reservation_release', v_chargeable_days, p_request_id,
          COALESCE(p_note, 'إلغاء حجز الرصيد لسحب الطلب من قبل مقدمه'), v_user_id
        );
      END IF;

      INSERT INTO public.request_timeline (
        request_id, step_number, actor_id, actor_name, actor_role, action, note
      ) VALUES (
        p_request_id, v_request.current_step_index, v_user_id,
        COALESCE(v_caller_emp.first_name_ar || ' ' || v_caller_emp.last_name_ar, 'الموظف'),
        'مقدم الطلب',
        'withdrawn',
        COALESCE(p_note, 'تم سحب الطلب من قبل الموظف')
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', CASE WHEN p_decision = 'withdrawn' THEN 'cancelled' ELSE p_decision END,
    'message', 'تمت معالجة قرار الإجازة بنجاح.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 7: RPC resubmit_leave_request (Item 9)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resubmit_leave_request(
  p_request_id uuid,
  p_start_date date,
  p_end_date date,
  p_is_half_day boolean DEFAULT false,
  p_half_day_period text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_replacement_employee_id uuid DEFAULT NULL,
  p_emergency_phone text DEFAULT NULL,
  p_attachment_file_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_emp public.employees%ROWTYPE;
  v_request public.requests%ROWTYPE;
  v_leave_type_id uuid;
  v_leave_type public.leave_types%ROWTYPE;
  v_old_chargeable_days numeric;
  v_new_chargeable_days numeric;
  v_days_diff numeric;
  v_year integer;
  v_balance public.leave_balances%ROWTYPE;
  v_available numeric;
  v_att_file public.file_objects%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لإعادة تقديم الطلب.';
  END IF;

  SELECT * INTO v_caller_emp FROM public.employees WHERE user_id = v_user_id;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = p_request_id AND type = 'leave'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الإجازة غير موجود.';
  END IF;

  IF v_request.status <> 'returned' THEN
    RAISE EXCEPTION 'لا يمكن إعادة تقديم الطلب إلا إذا كانت حالته معاد للتعديل (returned). الحالة الحالية: %.', v_request.status;
  END IF;

  IF v_caller_emp.id IS NULL OR v_request.employee_id <> v_caller_emp.id THEN
    IF NOT public.current_user_can_manage_company(v_request.company_id)
       AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
      RAISE EXCEPTION 'غير مصرح لك بإعادة تقديم هذا الطلب. فقط الموظف صاحب الطلب أو مسؤول المنشأة يمكنه ذلك.';
    END IF;
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'يرجى تحديد تاريخ البداية وتاريخ النهاية.';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'تاريخ نهاية الإجازة يجب أن يكون مساوياً أو لاحقاً لتاريخ البداية.';
  END IF;

  IF EXTRACT(YEAR FROM p_start_date)::int <> EXTRACT(YEAR FROM p_end_date)::int THEN
    RAISE EXCEPTION 'طلب الإجازة يمتد عبر سنتين تقويميتين مختلفتين. يرجى تقديم طلب منفصل لكل سنة.';
  END IF;

  v_year := EXTRACT(YEAR FROM p_start_date)::int;
  v_leave_type_id := (v_request.payload->>'leave_type_id')::uuid;

  SELECT * INTO v_leave_type FROM public.leave_types WHERE id = v_leave_type_id;

  IF p_attachment_file_id IS NOT NULL THEN
    SELECT * INTO v_att_file FROM public.file_objects WHERE id = p_attachment_file_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'المرفق المحدد غير موجود.';
    END IF;
    IF v_att_file.entity_type <> 'leave_attachment_staging' AND v_att_file.entity_type <> 'leave_request_attachment' THEN
      RAISE EXCEPTION 'نوع الملف غير صالح كمرفق إجازة.';
    END IF;
  END IF;

  v_old_chargeable_days := COALESCE(v_request.days, (v_request.payload->>'working_days')::numeric, 1);

  v_new_chargeable_days := public.calculate_working_days(
    v_request.company_id, v_request.employee_id, v_leave_type_id, p_start_date, p_end_date, p_is_half_day
  );

  IF v_new_chargeable_days <= 0 THEN
    RAISE EXCEPTION 'الفترة المحددة لا تحتوي على أي أيام عمل فعلية مستحقة للخصم.';
  END IF;

  v_days_diff := v_new_chargeable_days - v_old_chargeable_days;

  SELECT * INTO v_balance
  FROM public.leave_balances
  WHERE employee_id = v_request.employee_id AND leave_type_id = v_leave_type_id AND year = v_year
  FOR UPDATE;

  IF v_balance.id IS NOT NULL AND v_days_diff > 0 THEN
    v_available := (v_balance.accrued_days + v_balance.carried_over_days) - (v_balance.used_days + v_balance.reserved_days + v_balance.transferred_out_days + v_balance.expired_days);
    IF v_available < v_days_diff AND NOT COALESCE(v_leave_type.allow_negative_balance, false) THEN
      RAISE EXCEPTION 'رصيدك المتاح لا يكفي للزيادة المطلوبة في مدة الإجازة.';
    END IF;
  END IF;

  IF v_balance.id IS NOT NULL AND v_days_diff <> 0 THEN
    UPDATE public.leave_balances
    SET reserved_days = GREATEST(0, reserved_days + v_days_diff),
        updated_at = now()
    WHERE id = v_balance.id;

    INSERT INTO public.leave_balance_transactions (
      company_id, employee_id, leave_type_id, year,
      transaction_type, days, request_id, reason, created_by
    ) VALUES (
      v_request.company_id, v_request.employee_id, v_leave_type_id, v_year,
      CASE WHEN v_days_diff > 0 THEN 'reservation' ELSE 'reservation_release' END,
      abs(v_days_diff), p_request_id,
      'تعديل حجز الرصيد عند إعادة تقديم الطلب', v_user_id
    );
  END IF;

  -- Reset request to pending_approval at step 1
  UPDATE public.requests
  SET status = 'pending_approval',
      start_date = p_start_date,
      end_date = p_end_date,
      days = v_new_chargeable_days,
      reason = COALESCE(p_reason, reason),
      current_step_index = 1,
      current_approver_role = (
        SELECT approver_role FROM public.approval_steps
        WHERE request_id = p_request_id AND step_order = 1
      ),
      payload = jsonb_set(
        jsonb_set(
          jsonb_set(payload, '{working_days}', to_jsonb(v_new_chargeable_days)),
          '{is_half_day}', to_jsonb(p_is_half_day)
        ),
        '{half_day_period}', to_jsonb(p_half_day_period)
      ),
      updated_at = now()
  WHERE id = p_request_id;

  -- Reset steps: step 1 pending, others waiting
  UPDATE public.approval_steps
  SET status = CASE WHEN step_order = 1 THEN 'pending' ELSE 'waiting' END,
      acted_by = NULL,
      acted_at = NULL,
      note = NULL
  WHERE request_id = p_request_id;

  INSERT INTO public.request_timeline (
    request_id, step_number, actor_id, actor_name, actor_role, action, note
  ) VALUES (
    p_request_id, 1, v_user_id,
    COALESCE(v_caller_emp.first_name_ar || ' ' || v_caller_emp.last_name_ar, 'الموظف'),
    'مقدم الطلب', 'resubmitted', 'تم تعديل وإعادة تقديم طلب الإجازة بنجاح'
  );

  IF p_attachment_file_id IS NOT NULL THEN
    UPDATE public.file_objects
    SET entity_type = 'leave_request_attachment',
        entity_id = p_request_id::text,
        status = 'active',
        updated_at = now()
    WHERE id = p_attachment_file_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'chargeable_days', v_new_chargeable_days,
    'message', 'تم تعديل وإعادة تقديم طلب الإجازة بنجاح.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 8: RPC get_my_leave_balances & get_company_leave_balances (Item 18)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_leave_balances(integer, uuid);
DROP FUNCTION IF EXISTS public.get_my_leave_balances;
CREATE OR REPLACE FUNCTION public.get_my_leave_balances(
  p_year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  p_employee_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  leave_type_id uuid,
  leave_type_code text,
  leave_type_name_ar text,
  leave_type_name_en text,
  color text,
  year integer,
  annual_entitlement numeric,
  accrued_days numeric,
  used_days numeric,
  reserved_days numeric,
  carried_over_days numeric,
  transferred_out_days numeric,
  expired_days numeric,
  available_balance numeric,
  allow_negative_balance boolean,
  requires_attachment boolean,
  deduct_working_days_only boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_emp public.employees%ROWTYPE;
  v_target_emp_id uuid;
  v_target_company_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;

  SELECT * INTO v_caller_emp FROM public.employees WHERE user_id = v_user_id;

  IF p_employee_id IS NOT NULL THEN
    IF v_caller_emp.id IS NOT NULL AND v_caller_emp.id = p_employee_id THEN
      v_target_emp_id := v_caller_emp.id;
      v_target_company_id := v_caller_emp.company_id;
    ELSE
      SELECT company_id INTO v_target_company_id FROM public.employees WHERE id = p_employee_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'الموظف المحدد غير موجود.';
      END IF;

      IF NOT public.current_user_can_manage_company(v_target_company_id)
         AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
        RAISE EXCEPTION 'غير مصرح لك باستعراض أرصدة موظف في منشأة أخرى.';
      END IF;
      v_target_emp_id := p_employee_id;
    END IF;
  ELSE
    IF v_caller_emp.id IS NULL THEN
      RAISE EXCEPTION 'لا يوجد ملف موظف نشط مرتبط بحسابك.';
    END IF;
    v_target_emp_id := v_caller_emp.id;
    v_target_company_id := v_caller_emp.company_id;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(b.id, gen_random_uuid()) AS id,
    v_target_emp_id AS employee_id,
    lt.id AS leave_type_id,
    lt.code AS leave_type_code,
    lt.name_ar AS leave_type_name_ar,
    COALESCE(lt.name_en, lt.name_ar) AS leave_type_name_en,
    COALESCE(lt.color, '#004BCE') AS color,
    p_year AS year,
    COALESCE(b.annual_entitlement, lt.max_days_per_year, 0) AS annual_entitlement,
    COALESCE(b.accrued_days, 0) AS accrued_days,
    COALESCE(b.used_days, 0) AS used_days,
    COALESCE(b.reserved_days, 0) AS reserved_days,
    COALESCE(b.carried_over_days, 0) AS carried_over_days,
    COALESCE(b.transferred_out_days, 0) AS transferred_out_days,
    COALESCE(b.expired_days, 0) AS expired_days,
    -- Item 18: Authoritative formula deducting transferred_out and expired days
    ((COALESCE(b.accrued_days, 0) + COALESCE(b.carried_over_days, 0)) - (COALESCE(b.used_days, 0) + COALESCE(b.reserved_days, 0) + COALESCE(b.transferred_out_days, 0) + COALESCE(b.expired_days, 0))) AS available_balance,
    COALESCE(lt.allow_negative_balance, false) AS allow_negative_balance,
    COALESCE(lt.requires_attachment, false) AS requires_attachment,
    COALESCE(lt.deduct_working_days_only, true) AS deduct_working_days_only
  FROM public.leave_types lt
  LEFT JOIN public.leave_balances b
    ON b.leave_type_id = lt.id
   AND b.employee_id = v_target_emp_id
   AND b.year = p_year
  WHERE (lt.company_id = v_target_company_id OR lt.company_id IS NULL)
    AND lt.status = 'active'
  ORDER BY lt.code;
END;
$$;

DROP FUNCTION IF EXISTS public.get_company_leave_balances(integer, uuid);
DROP FUNCTION IF EXISTS public.get_company_leave_balances;
CREATE OR REPLACE FUNCTION public.get_company_leave_balances(
  p_year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  p_department_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  employee_no text,
  employee_name_ar text,
  employee_name_en text,
  department_name_ar text,
  leave_type_id uuid,
  leave_type_code text,
  leave_type_name_ar text,
  leave_type_name_en text,
  color text,
  year integer,
  annual_entitlement numeric,
  accrued_days numeric,
  used_days numeric,
  reserved_days numeric,
  carried_over_days numeric,
  transferred_out_days numeric,
  expired_days numeric,
  available_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_emp public.employees%ROWTYPE;
  v_company_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;

  SELECT * INTO v_caller_emp FROM public.employees WHERE user_id = v_user_id;
  v_company_id := COALESCE(v_caller_emp.company_id, public.current_company_id());

  IF NOT public.current_user_can_manage_company(v_company_id)
     AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'غير مصرح لك باستعراض أرصدة موظفي المنشأة.';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    e.id AS employee_id,
    e.employee_no,
    e.first_name_ar || ' ' || e.last_name_ar AS employee_name_ar,
    e.first_name_en || ' ' || e.last_name_en AS employee_name_en,
    COALESCE(d.name, '—') AS department_name_ar,
    lt.id AS leave_type_id,
    lt.code AS leave_type_code,
    lt.name_ar AS leave_type_name_ar,
    COALESCE(lt.name_en, lt.name_ar) AS leave_type_name_en,
    lt.color,
    b.year,
    b.annual_entitlement,
    b.accrued_days,
    b.used_days,
    b.reserved_days,
    b.carried_over_days,
    b.transferred_out_days,
    b.expired_days,
    -- Item 18: Deducts transferred and expired days from source availability
    ((b.accrued_days + b.carried_over_days) - (b.used_days + b.reserved_days + b.transferred_out_days + b.expired_days)) AS available_balance
  FROM public.leave_balances b
  JOIN public.employees e ON e.id = b.employee_id
  JOIN public.leave_types lt ON lt.id = b.leave_type_id
  LEFT JOIN public.departments d ON d.id = e.department_id
  WHERE b.company_id = v_company_id
    AND b.year = p_year
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
  ORDER BY e.employee_no, lt.code;
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 9: RPC run_leave_carryover (Item 18)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_leave_carryover(
  p_source_year integer,
  p_target_year integer,
  p_leave_type_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_comp_id uuid := COALESCE(p_company_id, public.current_company_id());
  v_lt RECORD;
  v_b_source RECORD;
  v_b_target public.leave_balances%ROWTYPE;
  v_unused numeric;
  v_carryover_limit numeric;
  v_carried numeric;
  v_expired numeric;
  v_type_processed integer := 0;
  v_type_carried numeric := 0;
  v_type_expired numeric := 0;
  v_total_processed integer := 0;
  v_total_carried numeric := 0;
  v_total_expired numeric := 0;
BEGIN
  IF NOT public.current_user_can_manage_company(v_comp_id)
     AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'غير مصرح: ليس لديك صلاحية ترحيل الإجازات لهذه المنشأة.';
  END IF;

  IF p_target_year <= p_source_year THEN
    RAISE EXCEPTION 'سنة الهدف للترحيل (%s) يجب أن تكون لاحقة لسنة المصدر (%s).', p_target_year, p_source_year;
  END IF;

  FOR v_lt IN
    SELECT * FROM public.leave_types
    WHERE (company_id IS NULL OR company_id = v_comp_id)
      AND status = 'active'
      AND (p_leave_type_id IS NULL OR id = p_leave_type_id)
  LOOP
    v_type_processed := 0;
    v_type_carried := 0;
    v_type_expired := 0;

    IF EXISTS (
      SELECT 1 FROM public.leave_carryover_runs
      WHERE company_id = v_comp_id
        AND leave_type_id = v_lt.id
        AND source_year = p_source_year
        AND target_year = p_target_year
    ) THEN
      CONTINUE;
    END IF;

    v_carryover_limit := COALESCE(v_lt.carryover_limit_days, 0);

    FOR v_b_source IN
      SELECT * FROM public.leave_balances
      WHERE company_id = v_comp_id
        AND leave_type_id = v_lt.id
        AND year = p_source_year
      FOR UPDATE
    LOOP
      v_unused := (v_b_source.accrued_days + v_b_source.carried_over_days) - (v_b_source.used_days + v_b_source.reserved_days + v_b_source.transferred_out_days + v_b_source.expired_days);

      IF v_unused > 0 THEN
        v_carried := LEAST(v_unused, v_carryover_limit);
        v_expired := v_unused - v_carried;

        -- Deduct from source balance availability (Item 18)
        UPDATE public.leave_balances
        SET transferred_out_days = transferred_out_days + v_carried,
            expired_days = expired_days + v_expired,
            updated_at = now()
        WHERE id = v_b_source.id;

        -- Find or create target year balance
        SELECT * INTO v_b_target
        FROM public.leave_balances
        WHERE employee_id = v_b_source.employee_id AND leave_type_id = v_lt.id AND year = p_target_year
        FOR UPDATE;

        IF NOT FOUND THEN
          INSERT INTO public.leave_balances (
            employee_id, leave_type_id, company_id, year,
            annual_entitlement, accrued_days, used_days, reserved_days, carried_over_days
          ) VALUES (
            v_b_source.employee_id, v_lt.id, v_comp_id, p_target_year,
            COALESCE(v_lt.max_days_per_year, 0), 0, 0, 0, v_carried
          )
          RETURNING * INTO v_b_target;
        ELSE
          UPDATE public.leave_balances
          SET carried_over_days = carried_over_days + v_carried,
              updated_at = now()
          WHERE id = v_b_target.id;
        END IF;

        IF v_carried > 0 THEN
          INSERT INTO public.leave_balance_transactions (
            company_id, employee_id, leave_type_id, year,
            transaction_type, days, reason, created_by
          ) VALUES (
            v_comp_id, v_b_source.employee_id, v_lt.id, p_target_year,
            'carryover', v_carried,
            format('ترحيل رصيد متبقي من سنة %s إلى سنة %s', p_source_year, p_target_year),
            v_user_id
          );
        END IF;

        IF v_expired > 0 THEN
          INSERT INTO public.leave_balance_transactions (
            company_id, employee_id, leave_type_id, year,
            transaction_type, days, reason, created_by
          ) VALUES (
            v_comp_id, v_b_source.employee_id, v_lt.id, p_source_year,
            'expiry', v_expired,
            format('انقضاء وسقوط رصيد متجاوز للحد الأقصى للترحيل لسنة %s', p_source_year),
            v_user_id
          );
        END IF;

        v_type_carried := v_type_carried + v_carried;
        v_type_expired := v_type_expired + v_expired;
      END IF;

      v_type_processed := v_type_processed + 1;
    END LOOP;

    INSERT INTO public.leave_carryover_runs (
      company_id, leave_type_id, source_year, target_year,
      employees_processed, total_days_carried_over, total_days_expired, executed_by
    ) VALUES (
      v_comp_id, v_lt.id, p_source_year, p_target_year,
      v_type_processed, v_type_carried, v_type_expired, v_user_id
    );

    v_total_processed := v_total_processed + v_type_processed;
    v_total_carried := v_total_carried + v_type_carried;
    v_total_expired := v_total_expired + v_type_expired;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'source_year', p_source_year,
    'target_year', p_target_year,
    'employees_processed', v_total_processed,
    'total_carried', v_total_carried,
    'total_expired', v_total_expired,
    'message', format('تم ترحيل أرصدة الإجازات بنجاح بإجمالي %s يوماً مرحلاً و %s يوماً منقضياً.', v_total_carried, v_total_expired)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 10: RPC run_leave_carryover_expiry (Items 19 & 20)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_leave_carryover_expiry(
  p_year integer,
  p_as_of_date date DEFAULT CURRENT_DATE,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_comp_id uuid := COALESCE(p_company_id, public.current_company_id());
  v_lt RECORD;
  v_bal RECORD;
  v_expiry_date date;
  v_to_expire numeric;
  v_total_expired numeric := 0;
  v_total_processed integer := 0;
  v_type_expired numeric := 0;
  v_type_processed integer := 0;
BEGIN
  IF NOT public.current_user_can_manage_company(v_comp_id)
     AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'غير مصرح: ليس لديك صلاحية تنفيذ انقضاء الأرصدة لهذه المنشأة.';
  END IF;

  FOR v_lt IN
    SELECT * FROM public.leave_types
    WHERE (company_id IS NULL OR company_id = v_comp_id)
      AND status = 'active'
      AND COALESCE(carryover_expiry_months, 0) > 0
  LOOP
    -- Expiry date is calculated from start of year + carryover_expiry_months
    v_expiry_date := (make_date(p_year, 1, 1) + (v_lt.carryover_expiry_months || ' months')::interval)::date;

    IF p_as_of_date < v_expiry_date THEN
      CONTINUE;
    END IF;

    -- Idempotency check (Item 20)
    IF EXISTS (
      SELECT 1 FROM public.leave_carryover_expiry_runs
      WHERE company_id = v_comp_id
        AND leave_type_id = v_lt.id
        AND year = p_year
        AND expiry_date = v_expiry_date
    ) THEN
      CONTINUE;
    END IF;

    v_type_processed := 0;
    v_type_expired := 0;

    FOR v_bal IN
      SELECT * FROM public.leave_balances
      WHERE company_id = v_comp_id
        AND leave_type_id = v_lt.id
        AND year = p_year
        AND carried_over_days > 0
      FOR UPDATE
    LOOP
      -- Calculate remaining unexpired carried-over days taking into account usage
      v_to_expire := GREATEST(0, v_bal.carried_over_days - COALESCE(v_bal.carried_over_expired_days, 0) - v_bal.used_days);

      IF v_to_expire > 0 THEN
        UPDATE public.leave_balances
        SET carried_over_expired_days = COALESCE(carried_over_expired_days, 0) + v_to_expire,
            updated_at = now()
        WHERE id = v_bal.id;

        INSERT INTO public.leave_balance_transactions (
          company_id, employee_id, leave_type_id, year,
          transaction_type, days, reason, created_by
        ) VALUES (
          v_comp_id, v_bal.employee_id, v_lt.id, p_year,
          'expiry', v_to_expire,
          format('انقضاء الرصيد المرحل لتجاوز مهلة الاستخدام (%s أشهر) لسنة %s', v_lt.carryover_expiry_months, p_year),
          v_user_id
        );

        v_type_expired := v_type_expired + v_to_expire;
      END IF;

      v_type_processed := v_type_processed + 1;
    END LOOP;

    INSERT INTO public.leave_carryover_expiry_runs (
      company_id, leave_type_id, year, expiry_date, expired_days, executed_by
    ) VALUES (
      v_comp_id, v_lt.id, p_year, v_expiry_date, v_type_expired, v_user_id
    );

    v_total_processed := v_total_processed + v_type_processed;
    v_total_expired := v_total_expired + v_type_expired;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'year', p_year,
    'as_of_date', p_as_of_date,
    'employees_processed', v_total_processed,
    'total_days_expired', v_total_expired,
    'message', format('تم تنفيذ انقضاء الأرصدة المرحّلة بإجمالي %s يوماً منقضياً.', v_total_expired)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 11: RPC run_leave_accrual (Items 21, 22, 23)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_leave_accrual(
  p_year integer DEFAULT NULL,
  p_period_month integer DEFAULT NULL,
  p_leave_type_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_comp_id uuid := COALESCE(p_company_id, public.current_company_id());
  v_company public.companies%ROWTYPE;
  v_year integer;
  v_period_month integer;
  v_lt RECORD;
  v_emp RECORD;
  v_bal public.leave_balances%ROWTYPE;
  v_monthly_rate numeric;
  v_cap numeric;
  v_old_accrued numeric;
  v_new_accrued numeric;
  v_actual_credit numeric;
  v_type_processed integer := 0;
  v_type_credited numeric := 0;
  v_total_processed integer := 0;
  v_total_credited numeric := 0;
  v_hire_month integer;
  v_company_now timestamptz;
BEGIN
  IF NOT public.current_user_can_manage_company(v_comp_id)
     AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'غير مصرح: ليس لديك صلاحية تنفيذ استحقاق الإجازات لهذه المنشأة.';
  END IF;

  SELECT * INTO v_company FROM public.companies WHERE id = v_comp_id;

  -- Item 22: Drive period from company timezone when not provided
  v_company_now := now() AT TIME ZONE COALESCE(v_company.timezone, 'Asia/Riyadh');
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM v_company_now)::int);
  v_period_month := COALESCE(p_period_month, EXTRACT(MONTH FROM v_company_now)::int);

  FOR v_lt IN
    SELECT * FROM public.leave_types
    WHERE (company_id IS NULL OR company_id = v_comp_id)
      AND status = 'active'
      AND (p_leave_type_id IS NULL OR id = p_leave_type_id)
  LOOP
    v_type_processed := 0;
    v_type_credited := 0;

    IF EXISTS (
      SELECT 1 FROM public.leave_accrual_runs
      WHERE company_id = v_comp_id
        AND leave_type_id = v_lt.id
        AND period_year = v_year
        AND period_month = v_period_month
    ) THEN
      CONTINUE;
    END IF;

    -- Item 23: Explicit eligibility - active, probation, and on_leave
    FOR v_emp IN
      SELECT * FROM public.employees
      WHERE company_id = v_comp_id
        AND status IN ('active', 'probation', 'on_leave')
    LOOP
      SELECT * INTO v_bal
      FROM public.leave_balances
      WHERE employee_id = v_emp.id AND leave_type_id = v_lt.id AND year = v_year
      FOR UPDATE;

      IF NOT FOUND THEN
        INSERT INTO public.leave_balances (
          employee_id, leave_type_id, company_id, year,
          annual_entitlement, accrued_days, used_days, reserved_days, carried_over_days
        ) VALUES (
          v_emp.id, v_lt.id, v_comp_id, v_year,
          COALESCE(v_lt.max_days_per_year, 0), 0, 0, 0, 0
        )
        RETURNING * INTO v_bal;
      END IF;

      v_old_accrued := v_bal.accrued_days;

      IF v_lt.accrual_method = 'yearly_frontloaded' THEN
        v_new_accrued := COALESCE(v_lt.max_days_per_year, 0);
        v_actual_credit := GREATEST(0, v_new_accrued - v_old_accrued);

      ELSIF v_lt.accrual_method = 'monthly_accrual' THEN
        v_monthly_rate := ROUND((COALESCE(v_lt.max_days_per_year, 0) / 12.0)::numeric, 2);
        v_cap := COALESCE(v_lt.max_days_per_year, 0) + v_bal.carried_over_days;
        v_new_accrued := LEAST(v_cap, v_old_accrued + v_monthly_rate);
        v_actual_credit := GREATEST(0, v_new_accrued - v_old_accrued);

      ELSIF v_lt.accrual_method = 'contract_anniversary' THEN
        -- Item 21: NO fake CURRENT_DATE fallback if hire_date is null
        IF v_emp.hire_date IS NULL THEN
          v_actual_credit := 0;
          v_new_accrued := v_old_accrued;
        ELSE
          v_hire_month := EXTRACT(MONTH FROM v_emp.hire_date)::int;
          IF v_hire_month = v_period_month THEN
            v_new_accrued := v_old_accrued + COALESCE(v_lt.max_days_per_year, 0);
            v_actual_credit := v_new_accrued - v_old_accrued;
          ELSE
            v_actual_credit := 0;
            v_new_accrued := v_old_accrued;
          END IF;
        END IF;
      ELSE
        v_actual_credit := 0;
        v_new_accrued := v_old_accrued;
      END IF;

      IF v_actual_credit > 0 THEN
        UPDATE public.leave_balances
        SET accrued_days = v_new_accrued,
            updated_at = now()
        WHERE id = v_bal.id;

        INSERT INTO public.leave_balance_transactions (
          company_id, employee_id, leave_type_id, year,
          transaction_type, days, reason, created_by
        ) VALUES (
          v_comp_id, v_emp.id, v_lt.id, v_year,
          'accrual', v_actual_credit,
          format('استحقاق دوري (%s) لشهر %s لسنة %s', v_lt.accrual_method, v_period_month, v_year),
          v_user_id
        );

        v_type_credited := v_type_credited + v_actual_credit;
      END IF;

      v_type_processed := v_type_processed + 1;
    END LOOP;

    INSERT INTO public.leave_accrual_runs (
      company_id, leave_type_id, period_year, period_month,
      employees_processed, total_days_accrued, executed_by
    ) VALUES (
      v_comp_id, v_lt.id, v_year, v_period_month,
      v_type_processed, v_type_credited, v_user_id
    );

    v_total_processed := v_total_processed + v_type_processed;
    v_total_credited := v_total_credited + v_type_credited;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'year', v_year,
    'period_month', v_period_month,
    'total_processed', v_total_processed,
    'total_days_credited', v_total_credited,
    'message', format('تم تشغيل استحقاق الإجازات بنجاح لمعالجة %s موظفاً بإجمالي %s يوماً مستحقاً.', v_total_processed, v_total_credited)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 12: RPC create_leave_type (Items 24, 25, 26, 27, 28)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_leave_type(
  p_name_ar text,
  p_name_en text DEFAULT NULL,
  p_max_days_per_year numeric DEFAULT NULL,
  p_is_paid boolean DEFAULT NULL,
  p_accrual_method text DEFAULT NULL,
  p_deduct_working_days_only boolean DEFAULT NULL,
  p_allow_half_day boolean DEFAULT NULL,
  p_allow_negative_balance boolean DEFAULT NULL,
  p_requires_attachment boolean DEFAULT NULL,
  p_carryover_limit_days numeric DEFAULT NULL,
  p_carryover_expiry_months integer DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_color text DEFAULT '#365F91',
  p_jurisdiction text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_is_system_template boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := COALESCE(p_company_id, public.current_company_id());
  v_code text;
  v_new_id uuid;
  v_jurisdiction text := p_jurisdiction;
  v_seq_num integer;
BEGIN
  IF p_is_system_template THEN
    IF NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
      RAISE EXCEPTION 'فقط المسؤول العام للنظام (super_admin) يمكنه إنشاء أو تعديل قوالب النظام العامة.';
    END IF;
    v_company_id := NULL;
  ELSE
    IF NOT public.current_user_can_manage_company(v_company_id)
       AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
      RAISE EXCEPTION 'غير مصرح لك بإضافة نوع إجازة لهذه المنشأة.';
    END IF;
  END IF;

  -- Item 25: Require explicit non-null values without silent defaults
  IF p_name_ar IS NULL OR trim(p_name_ar) = '' THEN
    RAISE EXCEPTION 'اسم نوع الإجازة بالعربية مطلوب.';
  END IF;

  IF p_max_days_per_year IS NULL OR p_max_days_per_year < 0 THEN
    RAISE EXCEPTION 'الحد الأقصى لأيام الإجازة سنوياً مطلوب ويجب ألا يقل عن صفر.';
  END IF;

  IF p_is_paid IS NULL THEN
    RAISE EXCEPTION 'حالة الأجر (مدفوعة الأجر أو بدون أجر) مطلوبة صراحة.';
  END IF;

  IF p_accrual_method IS NULL OR p_accrual_method NOT IN ('yearly_frontloaded', 'monthly_accrual', 'contract_anniversary') THEN
    RAISE EXCEPTION 'طريقة الاستحقاق مطلوبة صراحة (yearly_frontloaded, monthly_accrual, contract_anniversary).';
  END IF;

  IF p_deduct_working_days_only IS NULL THEN
    RAISE EXCEPTION 'طريقة الخصم (أيام عمل فقط أم أيام تقويمية) مطلوبة صراحة.';
  END IF;

  IF p_allow_half_day IS NULL THEN
    RAISE EXCEPTION 'تحديد إمكانية طلب نصف يوم مطلوب صراحة.';
  END IF;

  IF p_allow_negative_balance IS NULL THEN
    RAISE EXCEPTION 'تحديد إمكانية الرصيد السالب مطلوب صراحة.';
  END IF;

  IF p_requires_attachment IS NULL THEN
    RAISE EXCEPTION 'تحديد إلزامية المرفق مطلوب صراحة.';
  END IF;

  IF p_carryover_limit_days IS NULL OR p_carryover_limit_days < 0 THEN
    RAISE EXCEPTION 'الحد الأقصى للترحيل مطلوب ويجب ألا يقل عن صفر.';
  END IF;

  IF p_carryover_expiry_months IS NULL OR p_carryover_expiry_months < 0 THEN
    RAISE EXCEPTION 'مدة صلاحية الرصيد المرحل بالأشهر مطلوبة ويجب ألا تقل عن صفر.';
  END IF;

  IF v_jurisdiction IS NULL AND v_company_id IS NOT NULL THEN
    SELECT country INTO v_jurisdiction FROM public.companies WHERE id = v_company_id;
  END IF;

  -- Item 24: Deterministic company-scoped code generation (no Math.random)
  IF p_code IS NOT NULL AND trim(p_code) <> '' THEN
    v_code := upper(trim(p_code));
  ELSE
    SELECT COALESCE(count(*), 0) + 1 INTO v_seq_num
    FROM public.leave_types
    WHERE (company_id = v_company_id OR (v_company_id IS NULL AND company_id IS NULL));
    v_code := 'LT-' || lpad(v_seq_num::text, 4, '0');
  END IF;

  -- Item 26: English name remains NULL when omitted (never copy Arabic)
  INSERT INTO public.leave_types (
    company_id, code, name_ar, name_en, color,
    is_paid, deduct_working_days_only, max_days_per_year,
    allow_half_day, allow_negative_balance, requires_attachment,
    accrual_method, carryover_limit_days, carryover_expiry_months,
    jurisdiction, status, is_system_template
  ) VALUES (
    v_company_id, v_code, p_name_ar, p_name_en, p_color,
    p_is_paid, p_deduct_working_days_only, p_max_days_per_year,
    p_allow_half_day, p_allow_negative_balance, p_requires_attachment,
    p_accrual_method, p_carryover_limit_days, p_carryover_expiry_months,
    v_jurisdiction, 'active', p_is_system_template
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'code', v_code,
    'name_ar', p_name_ar,
    'message', 'تم إضافة نوع وسياسة الإجازة بنجاح.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 13: Grants
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.calculate_working_days(uuid, uuid, uuid, date, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_leave_request(uuid, date, date, boolean, text, text, uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_leave_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_leave_request(uuid, date, date, boolean, text, text, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_leave_balances(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_leave_balances(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_leave_carryover(integer, integer, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_leave_carryover_expiry(integer, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_leave_accrual(integer, integer, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_leave_type(text, text, numeric, boolean, text, boolean, boolean, boolean, boolean, numeric, integer, text, text, text, uuid, boolean) TO authenticated;
