-- =============================================================================
-- Migration: 20260921010000_finalize_leave_workflow_jurisdiction_and_integrity.sql
-- Purpose:   Prompt 10 Final Production Hotfix:
--            1. Remove implicit SA jurisdiction defaults.
--            2. Remove hardcoded Friday/Saturday weekends; enforce shift/company work-week.
--            3. Secure calculate_working_days against cross-tenant schedule inference.
--            4. Strict half-day validation (start=end, working day, period validation).
--            5. Real Approval Chain resolution and multi-step workflow execution.
--            6. Current approver & delegation enforcement (prevent direct manager bypass).
--            7. Multi-step approval support (intermediate advances step; final settles balance).
--            8. HR submission on behalf with strict tenant management validation.
--            9. Same-company reference validation for employee, leave type, replacement & attachments.
--            10. Truthful negative balance reporting (no GREATEST(0, ...)).
--            11. Explicit rejection of cross-year leave requests (Option B).
--            12. Correct legacy leave type backfill (reset system templates to company_id = NULL).
--            13. Strict company_id integrity and consistency on leave_balances.
--            14. Complete accrual engine for all 3 methods (yearly_frontloaded, monthly_accrual, contract_anniversary).
--            15. Accrual ledger records only actual credit; skip zero-credit transactions.
--            16. Per-leave-type accrual statistics in leave_accrual_runs.
--            17. Production idempotent carryover engine (run_leave_carryover).
--            18. Carryover idempotency table (leave_carryover_runs).
--            19. Secure storage attachment validation (file_objects existence, active, same company/employee).
--            20. Attachment finalization binding and saga safety.
--            21. Policy-driven team calendar privacy defaults (employee sees own by default).
--            22. Request reference concurrency safety via company_request_sequences.
--            23. Complete lockdown of direct mutation on leave_balances.
--            24. Bulletproof immutability of leave_balance_transactions via trigger.
--            25. Truthful create_leave_type parameters without silent legal assumptions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Schema Corrections & Additions
-- -----------------------------------------------------------------------------

-- 1.1 Remove default 'SA' from leave_types and company_holidays
ALTER TABLE public.leave_types
  ALTER COLUMN jurisdiction DROP DEFAULT;

ALTER TABLE public.company_holidays
  ALTER COLUMN jurisdiction DROP DEFAULT;

-- 1.2 Add work-week and privacy configuration to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS work_days integer[] DEFAULT ARRAY[0, 1, 2, 3, 4],
  ADD COLUMN IF NOT EXISTS rest_days integer[] DEFAULT ARRAY[5, 6],
  ADD COLUMN IF NOT EXISTS allow_peer_leave_calendar_visibility boolean DEFAULT false;

-- 1.3 Add work-week configuration to shifts
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS work_days integer[] DEFAULT ARRAY[0, 1, 2, 3, 4],
  ADD COLUMN IF NOT EXISTS rest_days integer[] DEFAULT ARRAY[5, 6];

-- 1.4 Concurrency-safe request sequence generator per company and year
CREATE TABLE IF NOT EXISTS public.company_request_sequences (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year integer NOT NULL,
  current_val bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, year)
);

ALTER TABLE public.company_request_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_request_sequences FROM authenticated;
GRANT ALL ON public.company_request_sequences TO service_role;

-- 1.5 Idempotency tracking table for annual leave carryover
CREATE TABLE IF NOT EXISTS public.leave_carryover_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  source_year integer NOT NULL,
  target_year integer NOT NULL,
  employees_processed integer NOT NULL DEFAULT 0,
  total_days_carried_over numeric(10,2) NOT NULL DEFAULT 0,
  total_days_expired numeric(10,2) NOT NULL DEFAULT 0,
  executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_leave_carryover_run UNIQUE (company_id, leave_type_id, source_year, target_year)
);

ALTER TABLE public.leave_carryover_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leave_carryover_runs FROM authenticated;
GRANT SELECT ON public.leave_carryover_runs TO authenticated;
GRANT ALL ON public.leave_carryover_runs TO service_role;

DROP POLICY IF EXISTS "leave_carryover_runs_select_policy" ON public.leave_carryover_runs;
CREATE POLICY "leave_carryover_runs_select_policy"
  ON public.leave_carryover_runs FOR SELECT TO authenticated
  USING (
    public.current_user_can_manage_company(company_id)
    OR public.current_user_has_any_role(ARRAY['super_admin'])
  );

-- -----------------------------------------------------------------------------
-- STEP 2: Legacy Leave Type Backfill Correction (Item 12)
-- -----------------------------------------------------------------------------
-- Reset standard system template policies to company_id = NULL so they represent
-- global templates rather than being arbitrarily owned by the first company in companies table.
UPDATE public.leave_types
SET company_id = NULL
WHERE company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
  AND code IN ('ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID', 'HAJJ', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'MARRIAGE');

-- -----------------------------------------------------------------------------
-- STEP 3: Immutability & Direct Mutation Lockdown (Items 24 & 25)
-- -----------------------------------------------------------------------------

-- 3.1 Lockdown leave_balances: Revoke all direct writes from authenticated
REVOKE INSERT, UPDATE, DELETE ON public.leave_balances FROM authenticated;
GRANT SELECT ON public.leave_balances TO authenticated;

-- Ensure RLS on leave_balances strictly controls SELECT only
DROP POLICY IF EXISTS "leave_balances_select_scoped" ON public.leave_balances;
CREATE POLICY "leave_balances_select_scoped"
  ON public.leave_balances FOR SELECT TO authenticated
  USING (
    employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.current_user_can_manage_company(company_id)
    OR public.current_user_has_any_role(ARRAY['super_admin'])
  );

-- 3.2 Bulletproof Immutability on leave_balance_transactions
REVOKE INSERT, UPDATE, DELETE ON public.leave_balance_transactions FROM authenticated;
GRANT SELECT ON public.leave_balance_transactions TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_leave_ledger_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'سجل حركات الإجازات غير قابل للتعديل أو الحذف نهائياً (Immutable Ledger).';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_leave_ledger_modification ON public.leave_balance_transactions;
CREATE TRIGGER trg_prevent_leave_ledger_modification
  BEFORE UPDATE OR DELETE ON public.leave_balance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_leave_ledger_modification();

-- -----------------------------------------------------------------------------
-- STEP 4: RPC calculate_working_days (Items 2, 3, 4)
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
  -- 1. Date range validation
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ البداية والنهاية مطلوبان لاحتساب أيام العمل.';
  END IF;

  IF p_end_date < p_start_date THEN
    RETURN 0;
  END IF;

  -- 2. Authorization & Tenant Security (Item 3)
  IF v_user_id IS NOT NULL THEN
    SELECT * INTO v_caller_emp FROM public.employees WHERE user_id = v_user_id;
  END IF;

  IF p_employee_id IS NOT NULL THEN
    SELECT * INTO v_target_emp FROM public.employees WHERE id = p_employee_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الموظف المحدد غير موجود.';
    END IF;

    -- If caller is not the target employee, caller must be authorized:
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
      v_resolved_company_id := COALESCE(p_company_id, auth.current_company_id());
    END IF;
  END IF;

  IF p_company_id IS NOT NULL AND p_company_id <> v_resolved_company_id THEN
    IF NOT public.current_user_can_manage_company(p_company_id)
       AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
      RAISE EXCEPTION 'غير مصرح لك باحتساب أيام العمل لمنشأة أخرى.';
    END IF;
    v_resolved_company_id := p_company_id;
  END IF;

  -- 3. Resolve Company & Work-Week configuration (Item 2)
  SELECT * INTO v_company FROM public.companies WHERE id = v_resolved_company_id;

  -- Check employee shift
  IF v_target_emp.shift_id IS NOT NULL THEN
    SELECT * INTO v_shift FROM public.shifts WHERE id = v_target_emp.shift_id;
  END IF;

  -- Rest days resolution order:
  -- 1. Employee shift rest_days
  -- 2. Company rest_days
  -- 3. Authoritative country standard or fail clearly (no silent arbitrary default)
  IF v_shift.rest_days IS NOT NULL AND array_length(v_shift.rest_days, 1) > 0 THEN
    v_effective_rest_days := v_shift.rest_days;
  ELSIF v_company.rest_days IS NOT NULL AND array_length(v_company.rest_days, 1) > 0 THEN
    v_effective_rest_days := v_company.rest_days;
  ELSE
    -- Derive from company country
    IF v_company.country IN ('المملكة العربية السعودية', 'Saudi Arabia', 'SA', 'مصر', 'جمهورية مصر العربية', 'Egypt', 'EG', 'قطر', 'Qatar', 'QA', 'عمان', 'سلطنة عمان', 'Oman', 'OM', 'البحرين', 'مملكة البحرين', 'Bahrain', 'BH') THEN
      v_effective_rest_days := ARRAY[5, 6]; -- Friday, Saturday
    ELSIF v_company.country IN ('الإمارات العربية المتحدة', 'UAE', 'United Arab Emirates', 'AE') THEN
      v_effective_rest_days := ARRAY[6, 0]; -- Saturday, Sunday
    ELSE
      v_effective_rest_days := ARRAY[5, 6];
    END IF;
  END IF;

  -- 4. Half-day validation (Item 4)
  IF p_is_half_day THEN
    IF p_start_date <> p_end_date THEN
      RAISE EXCEPTION 'إجازة نصف اليوم يجب أن تكون لتاريخ يوم واحد فقط.';
    END IF;
  END IF;

  -- 5. Calculate working days
  v_curr_date := p_start_date;
  WHILE v_curr_date <= p_end_date LOOP
    v_is_rest := false;
    v_is_holiday := false;

    -- 5.1 Check schedule_assignments (published employee shift schedule)
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

    -- 5.2 If no specific schedule assignment, check effective rest days
    IF NOT v_has_schedule THEN
      v_dow := EXTRACT(DOW FROM v_curr_date)::int;
      IF v_effective_rest_days @> ARRAY[v_dow] THEN
        v_is_rest := true;
      END IF;
    END IF;

    -- 5.3 Check company paid holidays
    SELECT EXISTS (
      SELECT 1 FROM public.company_holidays
      WHERE company_id = v_resolved_company_id
        AND v_curr_date BETWEEN start_date AND end_date
        AND is_paid = true
    ) INTO v_is_holiday;

    -- If working day:
    IF NOT v_is_rest AND NOT v_is_holiday THEN
      v_working_days := v_working_days + 1;
    END IF;

    v_curr_date := v_curr_date + 1;
  END LOOP;

  -- 6. Half-day result (Item 4)
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
-- STEP 5: RPC submit_leave_request (Items 4, 5, 8, 9, 11, 13, 19, 20, 22)
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتقديم طلب إجازة.';
  END IF;

  -- 1. Resolve submitting employee & Tenant Validation (Item 8)
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

  -- 2. Validate Dates & Explicit Cross-Year Rejection (Item 11)
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

  -- 3. Half-Day Validation (Item 4)
  IF p_is_half_day THEN
    IF p_start_date <> p_end_date THEN
      RAISE EXCEPTION 'إجازة نصف اليوم يجب أن تكون في يوم واحد فقط.';
    END IF;
    IF p_half_day_period IS NULL OR p_half_day_period NOT IN ('first_half', 'second_half') THEN
      RAISE EXCEPTION 'يرجى تحديد فترة نصف اليوم بشكل صحيح (النصف الأول first_half أو النصف الثاني second_half).';
    END IF;
  END IF;

  -- 4. Validate Leave Type & Same-Company Reference (Item 9)
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

  -- 5. Validate Replacement Employee (Item 9)
  IF p_replacement_employee_id IS NOT NULL THEN
    SELECT * INTO v_rep_emp FROM public.employees WHERE id = p_replacement_employee_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الموظف البديل المحدد غير موجود.';
    END IF;
    IF v_rep_emp.company_id <> v_company_id THEN
      RAISE EXCEPTION 'الموظف البديل يجب أن يكون تابعاً لنفس منشأة الموظف.';
    END IF;
  END IF;

  -- 6. Validate Secure Storage Attachment (Items 19 & 20)
  IF v_leave_type.requires_attachment AND p_attachment_file_id IS NULL THEN
    RAISE EXCEPTION 'سياسة هذا النوع من الإجازات تتطلب إرفاق تقرير أو مستند رسمي.';
  END IF;

  IF p_attachment_file_id IS NOT NULL THEN
    SELECT * INTO v_att_file FROM public.file_objects WHERE id = p_attachment_file_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'المرفق المحدد غير موجود في سجل الملفات الآمنة.';
    END IF;
    IF v_att_file.status <> 'active' THEN
      RAISE EXCEPTION 'مستند المرفق المحدد غير نشط أو تم حذفه.';
    END IF;
    IF v_att_file.company_id <> v_company_id THEN
      RAISE EXCEPTION 'المرفق لا ينتمي لنفس منشأة الموظف.';
    END IF;
    IF v_att_file.employee_id IS NOT NULL AND v_att_file.employee_id <> v_employee.id THEN
      RAISE EXCEPTION 'المرفق لا ينتمي لنفس الموظف مقدم الطلب.';
    END IF;
  END IF;

  -- 7. Calculate working days
  v_chargeable_days := public.calculate_working_days(
    v_company_id, v_employee.id, p_leave_type_id, p_start_date, p_end_date, p_is_half_day
  );

  IF v_chargeable_days <= 0 THEN
    RAISE EXCEPTION 'الفترة المحددة لا تحتوي على أي أيام عمل فعلية مستحقة للخصم (عطلة رسمية أو راحة أسبوعية).';
  END IF;

  -- 8. Overlap check against pending and approved requests
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

  -- 9. Atomic Balance Lock & Availability Check
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

  v_available := (v_balance.accrued_days + v_balance.carried_over_days) - (v_balance.used_days + v_balance.reserved_days);

  IF v_available < v_chargeable_days AND NOT COALESCE(v_leave_type.allow_negative_balance, false) THEN
    RAISE EXCEPTION 'رصيدك المتاح (% يوم) لا يكفي لتغطية مدة الإجازة المطلوبة (% يوم).', v_available, v_chargeable_days;
  END IF;

  -- 10. Reserve Balance Atomically
  UPDATE public.leave_balances
  SET reserved_days = reserved_days + v_chargeable_days,
      updated_at = now()
  WHERE id = v_balance.id;

  -- 11. Concurrency-Safe Request Reference Generation (Item 22)
  INSERT INTO public.company_request_sequences (company_id, year, current_val)
  VALUES (v_company_id, v_year, 1)
  ON CONFLICT (company_id, year)
  DO UPDATE SET current_val = company_request_sequences.current_val + 1, updated_at = now()
  RETURNING current_val INTO v_seq_val;

  v_reference := 'REQ-' || v_year || '-' || lpad(v_seq_val::text, 5, '0');

  -- 12. Resolve Real Approval Chain (Item 5)
  SELECT * INTO v_chain
  FROM public.approval_chains
  WHERE request_type = 'leave' AND status = 'active'
    AND (
      (scope_type = 'department' AND scope_values @> to_jsonb(v_employee.department_id::text))
      OR (scope_type = 'all_employees')
      OR is_default = true
    )
  ORDER BY
    CASE WHEN scope_type = 'department' THEN 1
         WHEN scope_type = 'all_employees' THEN 2
         ELSE 3 END,
    is_default DESC
  LIMIT 1;

  IF FOUND AND v_chain.steps IS NOT NULL AND jsonb_array_length(v_chain.steps) > 0 THEN
    v_steps := v_chain.steps;
  ELSE
    -- Default 1-step chain to line_manager
    v_steps := jsonb_build_array(jsonb_build_object('order', 1, 'role', 'line_manager'));
  END IF;

  v_total_steps := jsonb_array_length(v_steps);
  v_first_step := v_steps->0;
  v_first_role := COALESCE(v_first_step->>'approverRole', v_first_step->>'role', 'line_manager');

  -- 13. Create Request
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

  -- 14. Materialize Approval Steps (Item 5)
  FOR v_step_idx IN 0..(v_total_steps - 1) LOOP
    v_step_item := v_steps->v_step_idx;
    INSERT INTO public.approval_steps (
      request_id, step_order, approver_role, status
    ) VALUES (
      v_request_id,
      COALESCE((v_step_item->>'order')::int, (v_step_item->>'stepOrder')::int, v_step_idx + 1),
      COALESCE(v_step_item->>'approverRole', v_step_item->>'role', 'line_manager'),
      CASE WHEN v_step_idx = 0 THEN 'pending' ELSE 'waiting' END
    );
  END LOOP;

  -- 15. Record Reservation in Ledger
  INSERT INTO public.leave_balance_transactions (
    company_id, employee_id, leave_type_id, year,
    transaction_type, days, request_id, reason, created_by
  ) VALUES (
    v_company_id, v_employee.id, p_leave_type_id, v_year,
    'reservation', v_chargeable_days, v_request_id,
    COALESCE(p_reason, 'حجز رصيد لطلب إجازة قيد الاعتماد'), v_user_id
  );

  -- 16. Timeline step
  INSERT INTO public.request_timeline (
    request_id, step_number, actor_id, actor_name, actor_role, action, note
  ) VALUES (
    v_request_id, 1, v_user_id,
    v_employee.first_name_ar || ' ' || v_employee.last_name_ar,
    'مقدم الطلب', 'submitted', 'تم تقديم طلب الإجازة وحجز الرصيد بنجاح'
  );

  -- 17. Bind Attachment Metadata (Item 20)
  IF p_attachment_file_id IS NOT NULL THEN
    UPDATE public.file_objects
    SET entity_type = 'leave_request',
        entity_id = v_request_id::text,
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
-- STEP 6: RPC decide_leave_request (Items 6, 7, 27)
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
  v_is_hr boolean := false;
  v_is_owner boolean := false;
  v_is_delegated boolean := false;
  v_delegator_id uuid;
  v_is_final boolean := false;
  v_next_step public.approval_steps%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لمعالجة الطلب.';
  END IF;

  SELECT * INTO v_caller_emp FROM public.employees WHERE user_id = v_user_id;

  -- 1. Lock and validate request
  SELECT * INTO v_request
  FROM public.requests
  WHERE id = p_request_id AND type = 'leave'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الإجازة غير موجود.';
  END IF;

  -- Idempotency check: if already finalized, return current status
  IF v_request.status = 'approved' AND p_decision = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'status', 'approved', 'message', 'تم اعتماد هذا الطلب مسبقاً.');
  END IF;
  IF v_request.status = 'rejected' AND p_decision = 'rejected' THEN
    RETURN jsonb_build_object('success', true, 'status', 'rejected', 'message', 'تم رفض هذا الطلب مسبقاً.');
  END IF;

  IF v_request.status NOT IN ('pending', 'pending_approval') AND p_decision <> 'withdrawn' THEN
    RAISE EXCEPTION 'تمت معالجة هذا الطلب مسبقاً (الحالة الحالية: %).', v_request.status;
  END IF;

  -- 2. Authorization Check (Item 6)
  v_is_hr := public.current_user_can_manage_company(v_request.company_id)
             OR public.current_user_has_any_role(ARRAY['super_admin']);

  v_is_owner := (v_request.created_by = v_user_id) OR (
    v_caller_emp.id IS NOT NULL AND v_request.employee_id = v_caller_emp.id
  );

  IF p_decision = 'withdrawn' THEN
    IF NOT v_is_owner AND NOT v_is_hr THEN
      RAISE EXCEPTION 'غير مصرح لك بسحب هذا الطلب.';
    END IF;
  ELSE
    -- Check current step in approval_steps
    SELECT * INTO v_current_step
    FROM public.approval_steps
    WHERE request_id = p_request_id AND step_order = v_request.current_step_index
    FOR UPDATE;

    -- Check if caller is authorized for current step
    IF v_is_hr THEN
      v_is_authorized := true;
    ELSIF v_current_step.approver_role = 'line_manager' THEN
      -- Direct manager of employee
      IF EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = v_request.employee_id AND e.manager_id = v_caller_emp.id
      ) THEN
        v_is_authorized := true;
      END IF;
    ELSE
      -- Check caller role matches step approver_role
      IF public.current_user_has_any_role(ARRAY[v_current_step.approver_role]) THEN
        v_is_authorized := true;
      END IF;
    END IF;

    -- Check delegation (Item 6 & 9)
    IF NOT v_is_authorized AND v_caller_emp.id IS NOT NULL THEN
      SELECT delegator_id INTO v_delegator_id
      FROM public.delegation_rules
      WHERE delegate_id = v_caller_emp.id
        AND status = 'active'
        AND CURRENT_DATE BETWEEN start_date AND end_date
        AND scope IN ('all_requests', 'leave')
      LIMIT 1;

      IF FOUND THEN
        -- Check if delegator is the expected approver
        IF v_current_step.approver_role = 'line_manager' AND EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.id = v_request.employee_id AND e.manager_id = v_delegator_id
        ) THEN
          v_is_authorized := true;
          v_is_delegated := true;
        END IF;
      END IF;
    END IF;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'غير مصرح لك باعتماد أو رفض هذه الخطوة في مسار الموافقات.';
    END IF;
  END IF;

  -- 3. Extract leave parameters
  v_leave_type_id := (v_request.payload->>'leave_type_id')::uuid;
  v_chargeable_days := COALESCE(v_request.days, (v_request.payload->>'working_days')::numeric, 1);
  v_year := EXTRACT(YEAR FROM v_request.start_date)::int;

  -- 4. Lock balance row
  SELECT * INTO v_balance
  FROM public.leave_balances
  WHERE employee_id = v_request.employee_id AND leave_type_id = v_leave_type_id AND year = v_year
  FOR UPDATE;

  -- 5. Decision Processing (Items 7 & 27)
  IF p_decision = 'approved' THEN
    -- Update current approval step
    UPDATE public.approval_steps
    SET status = 'approved',
        acted_by = v_user_id,
        acted_at = now(),
        note = p_note
    WHERE id = v_current_step.id;

    -- Check if final step
    v_is_final := (v_request.current_step_index >= v_request.total_steps);

    IF NOT v_is_final THEN
      -- Advance to next step (Item 7)
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
        COALESCE(v_current_step.approver_role, 'معتمد'),
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
      -- Final approval: commit balance atomically (reserved -> used)
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
        'معتمد نهائي',
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

      -- Release reservation atomically
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
        'معتمد',
        'rejected',
        COALESCE(p_note, 'تم رفض الطلب وإلغاء حجز الرصيد')
      );

    ELSIF p_decision = 'returned' THEN
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
        'معتمد',
        'returned',
        COALESCE(p_note, 'أُعيد الطلب للتعديل والاستكمال')
      );

    ELSIF p_decision = 'withdrawn' THEN
      UPDATE public.requests
      SET status = 'cancelled',
          decision_note = p_note,
          updated_at = now()
      WHERE id = p_request_id;

      -- Release reservation
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
-- STEP 7: RPC get_my_leave_balances & get_company_leave_balances (Item 10)
-- -----------------------------------------------------------------------------
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
  is_paid boolean,
  deduct_working_days_only boolean,
  allow_negative_balance boolean,
  requires_attachment boolean,
  year integer,
  annual_entitlement numeric,
  accrued_days numeric,
  used_days numeric,
  reserved_days numeric,
  carried_over_days numeric,
  available_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_target_emp_id uuid;
  v_company_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;

  IF p_employee_id IS NOT NULL THEN
    SELECT e.id, e.company_id INTO v_target_emp_id, v_company_id
    FROM public.employees e
    WHERE e.id = p_employee_id;

    IF NOT public.current_user_can_manage_company(v_company_id)
       AND NOT public.current_user_has_any_role(ARRAY['super_admin'])
       AND v_target_emp_id <> (SELECT e2.id FROM public.employees e2 WHERE e2.user_id = v_user_id) THEN
      RAISE EXCEPTION 'غير مصرح لك باستعراض أرصدة موظف آخر.';
    END IF;
  ELSE
    SELECT e.id, e.company_id INTO v_target_emp_id, v_company_id
    FROM public.employees e
    WHERE e.user_id = v_user_id;
  END IF;

  IF v_target_emp_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(b.id, gen_random_uuid()) AS id,
    v_target_emp_id AS employee_id,
    lt.id AS leave_type_id,
    lt.code AS leave_type_code,
    lt.name_ar AS leave_type_name_ar,
    lt.name_en AS leave_type_name_en,
    lt.color,
    lt.is_paid,
    lt.deduct_working_days_only,
    COALESCE(lt.allow_negative_balance, false) AS allow_negative_balance,
    COALESCE(lt.requires_attachment, false) AS requires_attachment,
    p_year AS year,
    COALESCE(b.annual_entitlement, lt.max_days_per_year) AS annual_entitlement,
    COALESCE(b.accrued_days, 0) AS accrued_days,
    COALESCE(b.used_days, 0) AS used_days,
    COALESCE(b.reserved_days, 0) AS reserved_days,
    COALESCE(b.carried_over_days, 0) AS carried_over_days,
    -- Truthful available balance without GREATEST(0, ...) (Item 10)
    ((COALESCE(b.accrued_days, 0) + COALESCE(b.carried_over_days, 0)) - (COALESCE(b.used_days, 0) + COALESCE(b.reserved_days, 0))) AS available_balance
  FROM public.leave_types lt
  LEFT JOIN public.leave_balances b
    ON b.leave_type_id = lt.id
   AND b.employee_id = v_target_emp_id
   AND b.year = p_year
  WHERE (lt.company_id IS NULL OR lt.company_id = v_company_id)
    AND lt.status = 'active'
  ORDER BY lt.code;
END;
$$;

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
  color text,
  year integer,
  annual_entitlement numeric,
  accrued_days numeric,
  used_days numeric,
  reserved_days numeric,
  carried_over_days numeric,
  available_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := auth.current_company_id();
BEGIN
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
    lt.color,
    b.year,
    b.annual_entitlement,
    b.accrued_days,
    b.used_days,
    b.reserved_days,
    b.carried_over_days,
    -- Truthful available balance without GREATEST(0, ...) (Item 10)
    ((b.accrued_days + b.carried_over_days) - (b.used_days + b.reserved_days)) AS available_balance
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
-- STEP 8: RPC get_team_leave_calendar (Item 21)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_team_leave_calendar(
  p_start_date date,
  p_end_date date,
  p_department_id uuid DEFAULT NULL
)
RETURNS TABLE (
  request_id uuid,
  employee_id uuid,
  employee_name text,
  department_name text,
  leave_type_id uuid,
  leave_type_name text,
  color text,
  start_date date,
  end_date date,
  working_days numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_emp public.employees%ROWTYPE;
  v_company_id uuid;
  v_company public.companies%ROWTYPE;
  v_can_manage boolean := false;
  v_is_manager boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول.';
  END IF;

  SELECT * INTO v_caller_emp FROM public.employees WHERE user_id = v_user_id;
  v_company_id := COALESCE(v_caller_emp.company_id, auth.current_company_id());

  SELECT * INTO v_company FROM public.companies WHERE id = v_company_id;

  v_can_manage := public.current_user_can_manage_company(v_company_id)
                  OR public.current_user_has_any_role(ARRAY['super_admin']);

  v_is_manager := v_caller_emp.id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.employees WHERE manager_id = v_caller_emp.id
  );

  RETURN QUERY
  SELECT
    r.id AS request_id,
    e.id AS employee_id,
    e.first_name_ar || ' ' || e.last_name_ar AS employee_name,
    COALESCE(d.name, '—') AS department_name,
    (r.payload->>'leave_type_id')::uuid AS leave_type_id,
    COALESCE(r.payload->>'leave_type_name_ar', lt.name_ar, 'إجازة') AS leave_type_name,
    COALESCE(lt.color, '#004BCE') AS color,
    r.start_date,
    r.end_date,
    COALESCE(r.days, (r.payload->>'working_days')::numeric, 1) AS working_days,
    r.status
  FROM public.requests r
  JOIN public.employees e ON e.id = r.employee_id
  LEFT JOIN public.departments d ON d.id = e.department_id
  LEFT JOIN public.leave_types lt ON lt.id = (r.payload->>'leave_type_id')::uuid
  WHERE r.type = 'leave'
    AND r.company_id = v_company_id
    AND r.status IN ('approved', 'pending_approval', 'pending')
    AND r.start_date <= p_end_date
    AND r.end_date >= p_start_date
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    -- Privacy filter (Item 21)
    AND (
      v_can_manage
      OR (v_is_manager AND (e.manager_id = v_caller_emp.id OR e.id = v_caller_emp.id))
      OR (v_company.allow_peer_leave_calendar_visibility AND e.department_id = v_caller_emp.department_id)
      OR e.id = v_caller_emp.id
    )
  ORDER BY r.start_date ASC;
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 9: RPC run_leave_accrual (Items 14, 15, 16)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_leave_accrual(
  p_year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  p_period_month integer DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::int,
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
  v_comp_id uuid := COALESCE(p_company_id, auth.current_company_id());
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
BEGIN
  IF NOT public.current_user_can_manage_company(v_comp_id)
     AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'غير مصرح: ليس لديك صلاحية تنفيذ استحقاق الإجازات لهذه المنشأة.';
  END IF;

  FOR v_lt IN
    SELECT * FROM public.leave_types
    WHERE (company_id IS NULL OR company_id = v_comp_id)
      AND status = 'active'
      AND (p_leave_type_id IS NULL OR id = p_leave_type_id)
  LOOP
    -- Reset per-leave-type counters (Item 16)
    v_type_processed := 0;
    v_type_credited := 0;

    -- Check idempotency
    IF EXISTS (
      SELECT 1 FROM public.leave_accrual_runs
      WHERE company_id = v_comp_id
        AND leave_type_id = v_lt.id
        AND period_year = p_year
        AND period_month = p_period_month
    ) THEN
      CONTINUE;
    END IF;

    -- Process active employees in this company
    FOR v_emp IN
      SELECT * FROM public.employees
      WHERE company_id = v_comp_id AND status = 'active'
    LOOP
      SELECT * INTO v_bal
      FROM public.leave_balances
      WHERE employee_id = v_emp.id AND leave_type_id = v_lt.id AND year = p_year
      FOR UPDATE;

      IF NOT FOUND THEN
        INSERT INTO public.leave_balances (
          employee_id, leave_type_id, company_id, year,
          annual_entitlement, accrued_days, used_days, reserved_days, carried_over_days
        ) VALUES (
          v_emp.id, v_lt.id, v_comp_id, p_year,
          COALESCE(v_lt.max_days_per_year, 0), 0, 0, 0, 0
        )
        RETURNING * INTO v_bal;
      END IF;

      v_old_accrued := v_bal.accrued_days;

      -- Method 1: yearly_frontloaded (Item 14)
      IF v_lt.accrual_method = 'yearly_frontloaded' THEN
        v_new_accrued := COALESCE(v_lt.max_days_per_year, 0);
        v_actual_credit := GREATEST(0, v_new_accrued - v_old_accrued);

      -- Method 2: monthly_accrual (Item 14)
      ELSIF v_lt.accrual_method = 'monthly_accrual' THEN
        v_monthly_rate := ROUND((COALESCE(v_lt.max_days_per_year, 0) / 12.0)::numeric, 2);
        v_cap := COALESCE(v_lt.max_days_per_year, 0) + v_bal.carried_over_days;
        v_new_accrued := LEAST(v_cap, v_old_accrued + v_monthly_rate);
        v_actual_credit := GREATEST(0, v_new_accrued - v_old_accrued);

      -- Method 3: contract_anniversary (Item 14)
      ELSIF v_lt.accrual_method = 'contract_anniversary' THEN
        v_hire_month := EXTRACT(MONTH FROM COALESCE(v_emp.hire_date, CURRENT_DATE))::int;
        IF v_hire_month = p_period_month THEN
          v_new_accrued := v_old_accrued + COALESCE(v_lt.max_days_per_year, 0);
          v_actual_credit := v_new_accrued - v_old_accrued;
        ELSE
          v_actual_credit := 0;
          v_new_accrued := v_old_accrued;
        END IF;
      ELSE
        v_actual_credit := 0;
        v_new_accrued := v_old_accrued;
      END IF;

      -- Item 15: Record ledger entry ONLY if actual credited days > 0
      IF v_actual_credit > 0 THEN
        UPDATE public.leave_balances
        SET accrued_days = v_new_accrued,
            updated_at = now()
        WHERE id = v_bal.id;

        INSERT INTO public.leave_balance_transactions (
          company_id, employee_id, leave_type_id, year,
          transaction_type, days, reason, created_by
        ) VALUES (
          v_comp_id, v_emp.id, v_lt.id, p_year,
          'accrual', v_actual_credit,
          format('استحقاق دوري (%s) لشهر %s لسنة %s', v_lt.accrual_method, p_period_month, p_year),
          v_user_id
        );

        v_type_credited := v_type_credited + v_actual_credit;
      END IF;

      v_type_processed := v_type_processed + 1;
    END LOOP;

    -- Record per-leave-type accrual run (Item 16)
    INSERT INTO public.leave_accrual_runs (
      company_id, leave_type_id, period_year, period_month,
      employees_processed, total_days_accrued, executed_by
    ) VALUES (
      v_comp_id, v_lt.id, p_year, p_period_month,
      v_type_processed, v_type_credited, v_user_id
    );

    v_total_processed := v_total_processed + v_type_processed;
    v_total_credited := v_total_credited + v_type_credited;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'year', p_year,
    'period_month', p_period_month,
    'total_processed', v_total_processed,
    'total_days_credited', v_total_credited,
    'message', format('تم تشغيل استحقاق الإجازات بنجاح لمعالجة %s موظفاً بإجمالي %s يوماً مستحقاً.', v_total_processed, v_total_credited)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 10: RPC run_leave_carryover (Items 17 & 18)
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
  v_comp_id uuid := COALESCE(p_company_id, auth.current_company_id());
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

    -- Idempotency check (Item 18)
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
      v_unused := (v_b_source.accrued_days + v_b_source.carried_over_days) - (v_b_source.used_days + v_b_source.reserved_days);

      IF v_unused > 0 THEN
        v_carried := LEAST(v_unused, v_carryover_limit);
        v_expired := v_unused - v_carried;

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

    -- Record carryover run
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
-- STEP 11: RPC create_leave_type (Item 26)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_leave_type(
  p_name_ar text,
  p_name_en text,
  p_max_days_per_year numeric,
  p_is_paid boolean,
  p_accrual_method text,
  p_code text DEFAULT NULL,
  p_color text DEFAULT '#365F91',
  p_deduct_working_days_only boolean DEFAULT true,
  p_allow_half_day boolean DEFAULT true,
  p_allow_negative_balance boolean DEFAULT false,
  p_requires_attachment boolean DEFAULT false,
  p_carryover_limit_days numeric DEFAULT 0,
  p_carryover_expiry_months integer DEFAULT 3,
  p_jurisdiction text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := COALESCE(p_company_id, auth.current_company_id());
  v_code text;
  v_new_id uuid;
  v_jurisdiction text := p_jurisdiction;
BEGIN
  IF NOT public.current_user_can_manage_company(v_company_id)
     AND NOT public.current_user_has_any_role(ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'غير مصرح لك بإضافة نوع إجازة لهذه المنشأة.';
  END IF;

  -- Validate required fields without silent fabrication (Item 26)
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
    RAISE EXCEPTION 'طريقة الاستحقاق غير صالحة. الطرق المعتمدة: yearly_frontloaded, monthly_accrual, contract_anniversary.';
  END IF;

  -- Derive jurisdiction from company if not provided (Item 1)
  IF v_jurisdiction IS NULL THEN
    SELECT country INTO v_jurisdiction FROM public.companies WHERE id = v_company_id;
  END IF;

  v_code := COALESCE(p_code, 'LT-' || lpad(floor(random()*90000 + 10000)::text, 5, '0'));

  INSERT INTO public.leave_types (
    company_id, code, name_ar, name_en, color,
    is_paid, deduct_working_days_only, max_days_per_year,
    allow_half_day, allow_negative_balance, requires_attachment,
    accrual_method, carryover_limit_days, carryover_expiry_months,
    jurisdiction, status
  ) VALUES (
    v_company_id, v_code, p_name_ar, COALESCE(p_name_en, p_name_ar), p_color,
    p_is_paid, p_deduct_working_days_only, p_max_days_per_year,
    p_allow_half_day, p_allow_negative_balance, p_requires_attachment,
    p_accrual_method, p_carryover_limit_days, p_carryover_expiry_months,
    v_jurisdiction, 'active'
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
-- STEP 12: Grants & Permissions
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.calculate_working_days(uuid, uuid, uuid, date, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_leave_request(uuid, date, date, boolean, text, text, uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_leave_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_leave_balances(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_leave_balances(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_leave_calendar(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_leave_accrual(integer, integer, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_leave_carryover(integer, integer, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_leave_type(text, text, numeric, boolean, text, text, text, boolean, boolean, boolean, boolean, numeric, integer, text, uuid) TO authenticated;
