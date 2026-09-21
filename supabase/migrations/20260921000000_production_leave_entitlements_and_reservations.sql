-- ============================================================================
-- Migration: Production Leave Entitlements, Absence Management & Atomic Reservations
-- Prompt 10: Production-grade leave engine with atomic reservations, working-day
-- calculation, immutable ledger, idempotent accrual, and tenant isolation.
-- ============================================================================

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 1. Schema Enhancements: leave_types (Company Scoping & Policy Controls)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS allow_negative_balance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_attachment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carryover_limit_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carryover_expiry_months integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS effective_from date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS effective_to date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS jurisdiction text DEFAULT 'SA';

-- Backfill company_id for any existing leave_types from default company if null
UPDATE public.leave_types
SET company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Make company_id NOT NULL if at least one company exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.companies) THEN
    ALTER TABLE public.leave_types ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- Drop legacy global unique constraint on code if exists and enforce company-scoped uniqueness
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leave_types_code_key' AND conrelid = 'public.leave_types'::regclass
  ) THEN
    ALTER TABLE public.leave_types DROP CONSTRAINT leave_types_code_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_types_company_code
  ON public.leave_types (company_id, code);

-- ---------------------------------------------------------------------------
-- 2. Schema Enhancements: leave_balances (Year & Unique Identity)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Backfill company_id from employee
UPDATE public.leave_balances lb
SET company_id = e.company_id
FROM public.employees e
WHERE lb.employee_id = e.id AND lb.company_id IS NULL;

-- Enforce unique identity: (employee_id, leave_type_id, year)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leave_balances_employee_type_year_key' AND conrelid = 'public.leave_balances'::regclass
  ) THEN
    -- Remove any partial duplicates before adding constraint
    DELETE FROM public.leave_balances a
    USING public.leave_balances b
    WHERE a.employee_id = b.employee_id
      AND a.leave_type_id = b.leave_type_id
      AND a.year = b.year
      AND a.ctid > b.ctid;

    ALTER TABLE public.leave_balances
      ADD CONSTRAINT leave_balances_employee_type_year_key UNIQUE (employee_id, leave_type_id, year);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Schema: leave_balance_transactions (Immutable Audit Ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  year integer NOT NULL,
  transaction_type text NOT NULL, -- opening, entitlement, accrual, carryover, reservation, reservation_release, usage, adjustment, expiry, reversal
  days numeric(5,2) NOT NULL,
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_tx_emp_type_year
  ON public.leave_balance_transactions (employee_id, leave_type_id, year, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leave_tx_company_created
  ON public.leave_balance_transactions (company_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Schema: leave_accrual_runs (Idempotency Tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_accrual_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  employees_processed integer NOT NULL DEFAULT 0,
  total_days_accrued numeric(10,2) NOT NULL DEFAULT 0,
  executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, leave_type_id, period_year, period_month)
);

-- ---------------------------------------------------------------------------
-- 5. Schema: company_holidays (Regional & Company-Specific Holidays)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_paid boolean NOT NULL DEFAULT true,
  jurisdiction text DEFAULT 'SA',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_company_holidays_range
  ON public.company_holidays (company_id, start_date, end_date);

-- Also add company_id to requests table if missing
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.requests r
SET company_id = e.company_id
FROM public.employees e
WHERE r.employee_id = e.id AND r.company_id IS NULL;

-- ---------------------------------------------------------------------------
-- 6. RPC: calculate_working_days (Authoritative Working Days Engine)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_working_days(
  p_company_id uuid,
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_is_half_day boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deduct_working_days boolean := true;
  v_curr_date date;
  v_working_days numeric := 0;
  v_is_rest boolean;
  v_is_holiday boolean;
  v_dow integer;
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RETURN 0;
  END IF;

  IF p_is_half_day THEN
    RETURN 0.5;
  END IF;

  -- Check leave type policy
  SELECT deduct_working_days_only INTO v_deduct_working_days
  FROM public.leave_types
  WHERE id = p_leave_type_id;

  -- If policy does not deduct working days only, return calendar days
  IF v_deduct_working_days IS FALSE THEN
    RETURN (p_end_date - p_start_date + 1)::numeric;
  END IF;

  -- Calculate day by day
  v_curr_date := p_start_date;
  WHILE v_curr_date <= p_end_date LOOP
    -- 1. Check shift assignments for explicit rest day
    v_is_rest := false;
    SELECT is_rest_day INTO v_is_rest
    FROM public.shift_assignments
    WHERE employee_id = p_employee_id AND work_date = v_curr_date;

    IF v_is_rest IS NULL THEN
      -- Default weekend check: Friday (5) and Saturday (6) for Middle East jurisdictions
      v_dow := EXTRACT(DOW FROM v_curr_date);
      IF v_dow IN (5, 6) THEN
        v_is_rest := true;
      ELSE
        v_is_rest := false;
      END IF;
    END IF;

    -- 2. Check company paid holidays
    v_is_holiday := false;
    SELECT EXISTS (
      SELECT 1 FROM public.company_holidays
      WHERE company_id = p_company_id
        AND v_curr_date BETWEEN start_date AND end_date
        AND is_paid = true
    ) INTO v_is_holiday;

    -- If not a rest day and not a paid holiday, count as working day
    IF NOT v_is_rest AND NOT v_is_holiday THEN
      v_working_days := v_working_days + 1;
    END IF;

    v_curr_date := v_curr_date + 1;
  END LOOP;

  RETURN v_working_days;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC: submit_leave_request (Atomic Reservation, Overlap & Ledger)
-- ---------------------------------------------------------------------------
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
  v_employee_id uuid;
  v_company_id uuid;
  v_leave_type public.leave_types%ROWTYPE;
  v_year integer;
  v_chargeable_days numeric;
  v_balance public.leave_balances%ROWTYPE;
  v_available numeric;
  v_request_id uuid;
  v_reference text;
  v_approver_role text := 'line_manager';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتقديم طلب إجازة.';
  END IF;

  -- 1. Resolve employee identity
  IF p_target_employee_id IS NOT NULL THEN
    -- HR/Admin submission on behalf of employee
    IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
      RAISE EXCEPTION 'غير مصرح لك بتقديم طلب إجازة نيابة عن موظف آخر.';
    END IF;
    SELECT id, company_id INTO v_employee_id, v_company_id
    FROM public.employees WHERE id = p_target_employee_id;
  ELSE
    SELECT id, company_id INTO v_employee_id, v_company_id
    FROM public.employees WHERE user_id = v_user_id;
  END IF;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'لم يتم العثور على ملف موظف مرتبط بحسابك.';
  END IF;

  -- 2. Validate leave type and company scope
  SELECT * INTO v_leave_type
  FROM public.leave_types
  WHERE id = p_leave_type_id AND (company_id = v_company_id OR company_id IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'نوع الإجازة المحدد غير موجود أو غير متاح لمنشأتك.';
  END IF;

  IF v_leave_type.status <> 'active' THEN
    RAISE EXCEPTION 'نوع الإجازة المحدد غير نشط حالياً.';
  END IF;

  -- 3. Date validation
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'يرجى تحديد تاريخ بداية ونهاية الإجازة.';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'تاريخ نهاية الإجازة لا يمكن أن يكون قبل تاريخ البداية.';
  END IF;

  -- Half day validation
  IF p_is_half_day AND NOT v_leave_type.allow_half_day THEN
    RAISE EXCEPTION 'هذا النوع من الإجازات لا يسمح بنصف يوم وفق سياسة المنشأة.';
  END IF;

  -- Attachment validation
  IF v_leave_type.requires_attachment AND p_attachment_file_id IS NULL THEN
    RAISE EXCEPTION 'إرفاق التقرير أو المستند الثبوتي إلزامي لتقديم هذا النوع من الإجازات.';
  END IF;

  -- 4. Calculate chargeable working days server-side
  v_chargeable_days := public.calculate_working_days(
    v_company_id, v_employee_id, p_leave_type_id, p_start_date, p_end_date, p_is_half_day
  );

  IF v_chargeable_days <= 0 THEN
    RAISE EXCEPTION 'الفترة المحددة لا تحتوي على أي أيام عمل فعلية مستحقة للخصم.';
  END IF;

  -- 5. Overlap check against pending and approved requests
  IF EXISTS (
    SELECT 1 FROM public.requests
    WHERE employee_id = v_employee_id
      AND type = 'leave'
      AND status IN ('pending', 'pending_approval', 'approved')
      AND start_date <= p_end_date
      AND end_date >= p_start_date
  ) THEN
    RAISE EXCEPTION 'يوجد طلب إجازة نشط أو معتمد مسبقاً يتداخل مع الفترة المحددة.';
  END IF;

  -- 6. Atomic balance lock & availability check
  v_year := EXTRACT(YEAR FROM p_start_date)::int;

  SELECT * INTO v_balance
  FROM public.leave_balances
  WHERE employee_id = v_employee_id AND leave_type_id = p_leave_type_id AND year = v_year
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Initialize annual balance if missing
    INSERT INTO public.leave_balances (
      employee_id, leave_type_id, company_id, year,
      annual_entitlement,
      accrued_days,
      used_days, reserved_days, carried_over_days
    ) VALUES (
      v_employee_id, p_leave_type_id, v_company_id, v_year,
      v_leave_type.max_days_per_year,
      CASE WHEN v_leave_type.accrual_method = 'yearly_frontloaded' THEN v_leave_type.max_days_per_year ELSE 0 END,
      0, 0, 0
    )
    RETURNING * INTO v_balance;

    -- Record opening balance transaction
    INSERT INTO public.leave_balance_transactions (
      company_id, employee_id, leave_type_id, year, transaction_type, days, reason, created_by
    ) VALUES (
      v_company_id, v_employee_id, p_leave_type_id, v_year, 'opening',
      v_balance.accrued_days, 'رصيد افتتاحي أولي للعام', v_user_id
    );
  END IF;

  -- Authoritative balance formula: available = accrued + carried_over - used - reserved
  v_available := (v_balance.accrued_days + v_balance.carried_over_days) - (v_balance.used_days + v_balance.reserved_days);

  IF v_available < v_chargeable_days AND NOT v_leave_type.allow_negative_balance THEN
    RAISE EXCEPTION 'رصيدك المتاح (% يوم) لا يكفي لتغطية مدة الإجازة المطلوبة (% يوم).', v_available, v_chargeable_days;
  END IF;

  -- 7. Reserve balance atomically
  UPDATE public.leave_balances
  SET reserved_days = reserved_days + v_chargeable_days,
      updated_at = now()
  WHERE id = v_balance.id;

  -- 8. Create request
  v_reference := 'REQ-' || v_year || '-' || lpad(floor(random()*90000 + 10000)::text, 5, '0');

  INSERT INTO public.requests (
    reference, employee_id, company_id, type, status,
    start_date, end_date, days, reason, created_by,
    current_step_index, total_steps, current_approver_role,
    payload
  ) VALUES (
    v_reference, v_employee_id, v_company_id, 'leave', 'pending_approval',
    p_start_date, p_end_date, v_chargeable_days, p_reason, v_user_id,
    1, 2, v_approver_role,
    jsonb_build_object(
      'leave_type_id', p_leave_type_id,
      'leave_type_name_ar', v_leave_type.name_ar,
      'is_half_day', p_is_half_day,
      'half_day_period', p_half_day_period,
      'working_days', v_chargeable_days,
      'attachment_file_id', p_attachment_file_id,
      'replacement_employee_id', p_replacement_employee_id,
      'emergency_phone', p_emergency_phone
    )
  )
  RETURNING id INTO v_request_id;

  -- 9. Record reservation in ledger
  INSERT INTO public.leave_balance_transactions (
    company_id, employee_id, leave_type_id, year,
    transaction_type, days, request_id, reason, created_by
  ) VALUES (
    v_company_id, v_employee_id, p_leave_type_id, v_year,
    'reservation', v_chargeable_days, v_request_id,
    COALESCE(p_reason, 'حجز رصيد لطلب إجازة قيد الاعتماد'), v_user_id
  );

  -- 10. Record initial timeline step
  INSERT INTO public.request_timeline (
    request_id, step_number, actor_id, actor_name, actor_role, action, note
  ) VALUES (
    v_request_id, 1, v_user_id,
    (SELECT full_name FROM public.employees WHERE id = v_employee_id),
    'مقدم الطلب', 'submitted', 'تم تقديم طلب الإجازة وحجز الرصيد بنجاح'
  );

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

-- ---------------------------------------------------------------------------
-- 8. RPC: decide_leave_request (Atomic Approval/Rejection Settlement)
-- ---------------------------------------------------------------------------
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
  v_request public.requests%ROWTYPE;
  v_leave_type_id uuid;
  v_chargeable_days numeric;
  v_year integer;
  v_balance public.leave_balances%ROWTYPE;
  v_is_authorized boolean := false;
  v_is_hr boolean := false;
  v_is_owner boolean := false;
  v_is_manager boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لمعالجة الطلب.';
  END IF;

  -- 1. Lock and validate request
  SELECT * INTO v_request
  FROM public.requests
  WHERE id = p_request_id AND type = 'leave'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الإجازة غير موجود.';
  END IF;

  IF v_request.status NOT IN ('pending', 'pending_approval') AND p_decision <> 'withdrawn' THEN
    RAISE EXCEPTION 'تمت معالجة هذا الطلب مسبقاً (الحالة الحالية: %).', v_request.status;
  END IF;

  -- 2. Authorization check
  v_is_hr := public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager'])
             AND (v_request.company_id = auth.current_company_id() OR public.current_user_has_any_role(ARRAY['super_admin']));

  v_is_owner := (v_request.created_by = v_user_id) OR (
    v_request.employee_id = (SELECT id FROM public.employees WHERE user_id = v_user_id)
  );

  v_is_manager := EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = v_request.employee_id AND e.manager_id = (SELECT id FROM public.employees WHERE user_id = v_user_id)
  );

  IF p_decision = 'withdrawn' THEN
    IF NOT v_is_owner AND NOT v_is_hr THEN
      RAISE EXCEPTION 'غير مصرح لك بسحب هذا الطلب.';
    END IF;
  ELSE
    IF NOT v_is_hr AND NOT v_is_manager THEN
      RAISE EXCEPTION 'غير مصرح لك باتخاذ قرار بشأن هذا الطلب.';
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

  -- 5. Settle balance atomically
  IF p_decision = 'approved' THEN
    -- Commit: reserved -> used
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
        decision_note = p_note
    WHERE id = p_request_id;

  ELSIF p_decision IN ('rejected', 'returned', 'withdrawn') THEN
    -- Release: reserved -> released
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
        format('تحرير الرصيد المحجوز بسبب %s الطلب: %s', p_decision, COALESCE(p_note, 'بدون ملاحظات')),
        v_user_id
      );
    END IF;

    UPDATE public.requests
    SET status = CASE WHEN p_decision = 'withdrawn' THEN 'cancelled'::public.request_status ELSE 'rejected'::public.request_status END,
        decided_by = v_user_id,
        decided_at = now(),
        decision_note = p_note
    WHERE id = p_request_id;
  END IF;

  -- 6. Add timeline record
  INSERT INTO public.request_timeline (
    request_id, step_number, actor_id, actor_name, actor_role, action, note
  ) VALUES (
    p_request_id, v_request.current_step_index + 1, v_user_id,
    COALESCE((SELECT full_name FROM public.profiles WHERE id = v_user_id), 'المعتمد'),
    CASE WHEN v_is_hr THEN 'مسؤول الموارد البشرية' ELSE 'المدير المباشر' END,
    p_decision, p_note
  );

  RETURN jsonb_build_object(
    'success', true,
    'decision', p_decision,
    'request_id', p_request_id,
    'message', format('تم تسجيل القرار (%s) وتسوية رصيد الإجازات بنجاح.', p_decision)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. RPC: get_my_leave_balances (Self-Service Secure Retrieval)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_leave_balances(
  p_year integer DEFAULT EXTRACT(YEAR FROM now())::int
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_employee_id uuid;
  v_company_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT id, company_id INTO v_employee_id, v_company_id
  FROM public.employees WHERE user_id = v_user_id;

  IF v_employee_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'employeeId', b.employee_id,
      'leaveTypeId', lt.id,
      'leaveTypeNameAr', lt.name_ar,
      'leaveTypeNameEn', lt.name_en,
      'color', lt.color,
      'annualEntitlement', COALESCE(b.annual_entitlement, lt.max_days_per_year),
      'accruedDays', COALESCE(b.accrued_days, 0),
      'usedDays', COALESCE(b.used_days, 0),
      'reservedDays', COALESCE(b.reserved_days, 0),
      'carriedOverDays', COALESCE(b.carried_over_days, 0),
      'availableBalance', GREATEST(0, (COALESCE(b.accrued_days, 0) + COALESCE(b.carried_over_days, 0)) - (COALESCE(b.used_days, 0) + COALESCE(b.reserved_days, 0))),
      'allowNegativeBalance', lt.allow_negative_balance,
      'requiresAttachment', lt.requires_attachment,
      'allowHalfDay', lt.allow_half_day,
      'year', COALESCE(b.year, p_year)
    ) ORDER BY lt.name_ar ASC
  ), '[]'::jsonb) INTO v_result
  FROM public.leave_types lt
  LEFT JOIN public.leave_balances b
    ON b.leave_type_id = lt.id
    AND b.employee_id = v_employee_id
    AND b.year = p_year
  WHERE lt.company_id = v_company_id AND lt.status = 'active';

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. RPC: get_team_leave_calendar (Privacy-Aware Team Calendar)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_team_leave_calendar(
  p_start_date date,
  p_end_date date,
  p_department_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := auth.current_company_id();
  v_caller_emp_id uuid;
  v_is_hr boolean;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL OR v_company_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT id INTO v_caller_emp_id FROM public.employees WHERE user_id = v_user_id;
  v_is_hr := public.current_user_can_manage_company(v_company_id);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'employeeId', e.id,
      'employeeName', e.first_name_ar || ' ' || e.last_name_ar,
      'avatarUrl', e.avatar_url,
      'avatarStoragePath', e.avatar_storage_path,
      'departmentName', d.name,
      'leaveTypeName', lt.name_ar,
      'startDate', r.start_date,
      'endDate', r.end_date,
      'workingDays', r.days,
      'status', r.status
      -- Private medical reasons, attachments and notes are intentionally omitted for peer privacy
    ) ORDER BY r.start_date ASC
  ), '[]'::jsonb) INTO v_result
  FROM public.requests r
  JOIN public.employees e ON r.employee_id = e.id
  LEFT JOIN public.departments d ON e.department_id = d.id
  LEFT JOIN public.leave_types lt ON (r.payload->>'leave_type_id')::uuid = lt.id
  WHERE r.company_id = v_company_id
    AND r.type = 'leave'
    AND r.status IN ('pending', 'pending_approval', 'approved')
    AND r.start_date <= p_end_date
    AND r.end_date >= p_start_date
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    -- Visibility rule: HR sees all; Line Manager sees team; Peers see same department
    AND (
      v_is_hr
      OR e.manager_id = v_caller_emp_id
      OR e.department_id = (SELECT department_id FROM public.employees WHERE id = v_caller_emp_id)
    );

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. RPC: adjust_leave_balance (Ledger-Backed Manual Adjustment)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_leave_balance(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_year integer,
  p_days numeric,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_balance public.leave_balances%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتعديل الرصيد.';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'سبب التعديل إلزامي ومطلوب للتوثيق والتدقيق.';
  END IF;

  SELECT company_id INTO v_company_id FROM public.employees WHERE id = p_employee_id;
  IF NOT public.current_user_can_manage_company(v_company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل أرصدة الإجازات لهذه المنشأة.';
  END IF;

  SELECT * INTO v_balance
  FROM public.leave_balances
  WHERE employee_id = p_employee_id AND leave_type_id = p_leave_type_id AND year = p_year
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.leave_balances (
      employee_id, leave_type_id, company_id, year,
      annual_entitlement, accrued_days, used_days, reserved_days, carried_over_days
    ) VALUES (
      p_employee_id, p_leave_type_id, v_company_id, p_year,
      0, p_days, 0, 0, 0
    )
    RETURNING * INTO v_balance;
  ELSE
    UPDATE public.leave_balances
    SET accrued_days = accrued_days + p_days,
        updated_at = now()
    WHERE id = v_balance.id
    RETURNING * INTO v_balance;
  END IF;

  -- Record in ledger
  INSERT INTO public.leave_balance_transactions (
    company_id, employee_id, leave_type_id, year,
    transaction_type, days, reason, created_by
  ) VALUES (
    v_company_id, p_employee_id, p_leave_type_id, p_year,
    'adjustment', p_days, p_reason, v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_accrued_days', v_balance.accrued_days,
    'available', (v_balance.accrued_days + v_balance.carried_over_days) - (v_balance.used_days + v_balance.reserved_days),
    'message', 'تم تعديل الرصيد وتدوين القيد في السجل بنجاح.'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 12. RPC: run_leave_accrual (Idempotent Company-Scoped Accrual)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_leave_accrual(
  p_company_id uuid,
  p_year integer,
  p_month integer,
  p_leave_type_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_lt record;
  v_emp record;
  v_monthly_amount numeric;
  v_total_processed integer := 0;
  v_total_days numeric := 0;
BEGIN
  IF NOT public.current_user_can_manage_company(p_company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بتشغيل دورة الاستحقاق لهذه المنشأة.';
  END IF;

  -- Process applicable leave types (only monthly_accrual)
  FOR v_lt IN
    SELECT * FROM public.leave_types
    WHERE company_id = p_company_id
      AND status = 'active'
      AND accrual_method = 'monthly_accrual'
      AND (p_leave_type_id IS NULL OR id = p_leave_type_id)
  LOOP
    -- Idempotency check: verify run has not executed already for this period
    IF EXISTS (
      SELECT 1 FROM public.leave_accrual_runs
      WHERE company_id = p_company_id
        AND leave_type_id = v_lt.id
        AND period_year = p_year
        AND period_month = p_month
    ) THEN
      CONTINUE; -- Skip already accrued period
    END IF;

    v_monthly_amount := round((v_lt.max_days_per_year::numeric / 12.0), 2);

    -- Process active eligible employees
    FOR v_emp IN
      SELECT id FROM public.employees
      WHERE company_id = p_company_id
        AND status IN ('active', 'probation', 'on_leave')
    LOOP
      -- Lock or insert balance
      INSERT INTO public.leave_balances (
        employee_id, leave_type_id, company_id, year,
        annual_entitlement, accrued_days, used_days, reserved_days, carried_over_days
      ) VALUES (
        v_emp.id, v_lt.id, p_company_id, p_year,
        v_lt.max_days_per_year, v_monthly_amount, 0, 0, 0
      )
      ON CONFLICT (employee_id, leave_type_id, year)
      DO UPDATE SET
        accrued_days = LEAST(
          leave_balances.annual_entitlement + leave_balances.carried_over_days,
          leave_balances.accrued_days + v_monthly_amount
        ),
        updated_at = now();

      -- Record transaction
      INSERT INTO public.leave_balance_transactions (
        company_id, employee_id, leave_type_id, year,
        transaction_type, days, reason, created_by
      ) VALUES (
        p_company_id, v_emp.id, v_lt.id, p_year,
        'accrual', v_monthly_amount,
        format('استحقاق شهري دوري لشهر %s/%s', p_month, p_year),
        v_user_id
      );

      v_total_processed := v_total_processed + 1;
      v_total_days := v_total_days + v_monthly_amount;
    END LOOP;

    -- Record completion in idempotency tracker
    INSERT INTO public.leave_accrual_runs (
      company_id, leave_type_id, period_year, period_month,
      employees_processed, total_days_accrued, executed_by
    ) VALUES (
      p_company_id, v_lt.id, p_year, p_month,
      v_total_processed, v_total_days, v_user_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'employees_processed', v_total_processed,
    'total_days_accrued', v_total_days,
    'message', format('تم تشغيل الاستحقاق الشهري (%s/%s) لـ %s موظفاً بنجاح.', p_month, p_year, v_total_processed)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 13. RPC: create_leave_type (Authoritative Company-Scoped Leave Type)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_leave_type(
  p_code text,
  p_name_ar text,
  p_name_en text DEFAULT NULL,
  p_max_days_per_year integer DEFAULT 30,
  p_is_paid boolean DEFAULT true,
  p_deduct_working_days_only boolean DEFAULT true,
  p_allow_half_day boolean DEFAULT false,
  p_allow_negative_balance boolean DEFAULT false,
  p_requires_attachment boolean DEFAULT false,
  p_accrual_method text DEFAULT 'yearly_frontloaded',
  p_carryover_limit_days integer DEFAULT 0,
  p_jurisdiction text DEFAULT 'SA',
  p_color text DEFAULT '#0284c7'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := auth.current_company_id();
  v_code text;
  v_new_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول واختيار منشأة معتمدة.';
  END IF;

  IF NOT public.current_user_can_manage_company(v_company_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة وإضافة أنواع الإجازات لهذه المنشأة.';
  END IF;

  IF p_name_ar IS NULL OR btrim(p_name_ar) = '' THEN
    RAISE EXCEPTION 'اسم نوع الإجازة باللغة العربية إلزامي.';
  END IF;

  -- Generate code if not provided
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    v_code := 'LT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  ELSE
    v_code := upper(btrim(p_code));
  END IF;

  INSERT INTO public.leave_types (
    company_id, code, name_ar, name_en, color, is_paid,
    deduct_working_days_only, max_days_per_year, allow_half_day,
    allow_negative_balance, requires_attachment, accrual_method,
    carryover_limit_days, jurisdiction, status
  ) VALUES (
    v_company_id, v_code, p_name_ar, COALESCE(p_name_en, p_name_ar), p_color, p_is_paid,
    p_deduct_working_days_only, p_max_days_per_year, p_allow_half_day,
    p_allow_negative_balance, p_requires_attachment, p_accrual_method,
    p_carryover_limit_days, p_jurisdiction, 'active'
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'code', v_code,
    'message', 'تم إنشاء نوع الإجازة بنجاح.'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 14. Grants & Permissions
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.calculate_working_days FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_working_days TO authenticated;

REVOKE ALL ON FUNCTION public.submit_leave_request FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_leave_request TO authenticated;

REVOKE ALL ON FUNCTION public.decide_leave_request FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_leave_request TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_leave_balances FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_leave_balances TO authenticated;

REVOKE ALL ON FUNCTION public.get_team_leave_calendar FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_leave_calendar TO authenticated;

REVOKE ALL ON FUNCTION public.adjust_leave_balance FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_leave_balance TO authenticated;

REVOKE ALL ON FUNCTION public.run_leave_accrual FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_leave_accrual TO authenticated;

REVOKE ALL ON FUNCTION public.create_leave_type FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_leave_type TO authenticated;

-- RLS enablement
ALTER TABLE public.leave_balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_accrual_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

-- Transactions RLS: employee sees own transactions; HR sees company
CREATE POLICY "leave_tx_select_policy"
  ON public.leave_balance_transactions FOR SELECT TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.current_user_can_manage_company(company_id)
  );

-- Accrual runs RLS: HR only
CREATE POLICY "leave_accrual_runs_select_policy"
  ON public.leave_accrual_runs FOR SELECT TO authenticated
  USING (
    public.current_user_can_manage_company(company_id)
  );

-- Company holidays RLS: viewable by employees of same company
CREATE POLICY "company_holidays_select_policy"
  ON public.company_holidays FOR SELECT TO authenticated
  USING (
    company_id = auth.current_company_id()
    OR public.current_user_can_manage_company(company_id)
  );

CREATE POLICY "company_holidays_manage_policy"
  ON public.company_holidays FOR ALL TO authenticated
  USING (public.current_user_can_manage_company(company_id))
  WITH CHECK (public.current_user_can_manage_company(company_id));

-- Prevent direct client updates on balances
DROP POLICY IF EXISTS "leave_balances_update_policy" ON public.leave_balances;
CREATE POLICY "leave_balances_update_policy"
  ON public.leave_balances FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);
