-- ============================================================================
-- PROMPT 16: PRODUCTION LOANS, EMPLOYEE SEPARATION & END-OF-SERVICE ENGINE
-- Migration: 20260929000000_production_loans_and_offboarding_engine.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: COMPANY LOAN POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_loan_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  loan_type text NOT NULL,
  min_amount numeric(12,2) NOT NULL DEFAULT 500,
  max_amount numeric(12,2) NOT NULL DEFAULT 50000,
  max_salary_percentage numeric(5,2) NOT NULL DEFAULT 30.00,
  max_installments integer NOT NULL DEFAULT 12,
  min_service_days integer NOT NULL DEFAULT 90,
  allowed_employee_groups text[] DEFAULT NULL,
  approval_chain_code text NOT NULL DEFAULT 'loan_advance',
  early_settlement_behavior text NOT NULL DEFAULT 'allow_no_penalty',
  payroll_recovery_behavior text NOT NULL DEFAULT 'auto_deduct_scheduled',
  allow_multiple_active boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, loan_type)
);

ALTER TABLE public.company_loan_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_loan_policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_loan_policies_select" ON public.company_loan_policies;
CREATE POLICY "company_loan_policies_select"
  ON public.company_loan_policies FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
  );

-- ============================================================================
-- STEP 2: ENHANCE LOANS TABLE WITH LIFECYCLE & DISBURSEMENT DATA
-- ============================================================================

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.company_loan_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS installment_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS installments_total integer,
  ADD COLUMN IF NOT EXISTS installments_paid integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS disbursement_account_id uuid REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disbursed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disbursed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disbursement_status text NOT NULL DEFAULT 'prepared',
  ADD COLUMN IF NOT EXISTS disbursement_reference text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS settled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settlement_type text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill company_id on loans from employees
UPDATE public.loans l
SET company_id = e.company_id
FROM public.employees e
WHERE l.employee_id = e.id AND l.company_id IS NULL;

-- Backfill outstanding_amount and approved_amount if null
UPDATE public.loans
SET approved_amount = COALESCE(approved_amount, principal_amount),
    installment_amount = COALESCE(installment_amount, monthly_installment),
    installments_total = COALESCE(installments_total, total_installments),
    installments_paid = COALESCE(installments_paid, paid_installments),
    outstanding_amount = COALESCE(outstanding_amount, remaining_balance)
WHERE approved_amount IS NULL OR outstanding_amount IS NULL;

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loans_select_policy" ON public.loans;
CREATE POLICY "loans_select_policy"
  ON public.loans FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (
      company_id = public.current_company_id()
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer'])
    )
  );

-- ============================================================================
-- STEP 3: AUTHORITATIVE LOAN INSTALLMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.loan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_payroll_period text NOT NULL, -- Format: YYYY-MM
  due_date date NOT NULL,
  principal_amount numeric(12,2) NOT NULL,
  deducted_amount numeric(12,2) NOT NULL DEFAULT 0,
  remaining_balance numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deducted', 'waived', 'early_settled')),
  payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  recovered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, installment_number)
);

ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_installments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_installments_select_policy" ON public.loan_installments;
CREATE POLICY "loan_installments_select_policy"
  ON public.loan_installments FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (
      company_id = public.current_company_id()
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer'])
    )
  );

DROP POLICY IF EXISTS "deny_direct_mutation_loan_installments" ON public.loan_installments;
CREATE POLICY "deny_direct_mutation_loan_installments"
  ON public.loan_installments FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- ============================================================================
-- STEP 4: LOAN DISBURSEMENTS AUDIT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.loan_disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.company_bank_accounts(id) ON DELETE RESTRICT,
  disbursed_amount numeric(12,2) NOT NULL,
  previous_bank_balance numeric(14,2) NOT NULL,
  new_bank_balance numeric(14,2) NOT NULL,
  disbursement_status text NOT NULL DEFAULT 'confirmed' CHECK (disbursement_status IN ('prepared', 'submitted_to_bank', 'confirmed', 'failed')),
  external_reference text,
  notes text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_disbursements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_disbursements_select_policy" ON public.loan_disbursements;
CREATE POLICY "loan_disbursements_select_policy"
  ON public.loan_disbursements FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer'])
  );

-- ============================================================================
-- STEP 5: AUTHORITATIVE EMPLOYEE SEPARATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employee_separations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  separation_type text NOT NULL CHECK (separation_type IN ('resignation', 'contract_expiration', 'termination', 'retirement', 'other')),
  initiated_by text NOT NULL DEFAULT 'employee' CHECK (initiated_by IN ('employee', 'hr')),
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  requested_date date NOT NULL DEFAULT CURRENT_DATE,
  last_working_day date NOT NULL,
  reason text NOT NULL,
  notice_period_days integer NOT NULL DEFAULT 30,
  notice_period_served boolean NOT NULL DEFAULT true,
  workflow_status text NOT NULL DEFAULT 'pending' CHECK (workflow_status IN ('draft', 'pending', 'approved', 'rejected', 'withdrawn')),
  clearance_status text NOT NULL DEFAULT 'pending' CHECK (clearance_status IN ('pending', 'in_progress', 'completed', 'blocked')),
  settlement_status text NOT NULL DEFAULT 'not_calculated' CHECK (settlement_status IN ('not_calculated', 'calculated', 'approved', 'paid')),
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_clearance', 'settlement_ready', 'finalized', 'cancelled')),
  finalized_at timestamptz,
  finalized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rehire_eligible boolean NOT NULL DEFAULT true,
  rehire_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_separations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_separations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_separations_select_policy" ON public.employee_separations;
CREATE POLICY "employee_separations_select_policy"
  ON public.employee_separations FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (
      company_id = public.current_company_id()
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer'])
    )
  );

-- ============================================================================
-- STEP 6: CLEARANCE ITEMS TABLE (CHECKLIST & ASSETS/LOANS INTEGRATION)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clearance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  separation_id uuid NOT NULL REFERENCES public.employee_separations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('hr', 'manager_handover', 'assets_return', 'documents', 'finance', 'loans', 'it_access')),
  item_key text NOT NULL,
  title_ar text NOT NULL,
  assigned_role text NOT NULL DEFAULT 'hr_manager',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'waived', 'blocked')),
  asset_id uuid REFERENCES public.hardware_assets(id) ON DELETE SET NULL,
  loan_id uuid REFERENCES public.loans(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  notes text,
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clearance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearance_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clearance_items_select_policy" ON public.clearance_items;
CREATE POLICY "clearance_items_select_policy"
  ON public.clearance_items FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (
      company_id = public.current_company_id()
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer'])
    )
  );

-- ============================================================================
-- STEP 7: ENHANCE SETTLEMENTS TABLE WITH PAYMENT STATUS & SEPARATION LINK
-- ============================================================================

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS separation_id uuid REFERENCES public.employee_separations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_ready',
  ADD COLUMN IF NOT EXISTS payment_bank_account_id uuid REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Link separation to settlement if separation_id exists
UPDATE public.employee_separations es
SET settlement_id = s.id, settlement_status = 'calculated'
FROM public.settlements s
WHERE s.separation_id = es.id AND es.settlement_id IS NULL;

-- ============================================================================
-- STEP 8: LOAN ELIGIBILITY VALIDATION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_loan_eligibility(
  p_employee_id uuid,
  p_amount numeric,
  p_installments integer,
  p_loan_type text DEFAULT 'personal_advance'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_comp public.employee_compensation_versions%ROWTYPE;
  v_policy public.company_loan_policies%ROWTYPE;
  v_service_days integer;
  v_active_loans_count integer;
  v_monthly_installment numeric(12,2);
  v_max_monthly_deduction numeric(12,2);
  v_total_salary numeric(12,2);
BEGIN
  -- 1. Fetch employee
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود بالنظام (404)';
  END IF;

  IF v_emp.status <> 'active' THEN
    RAISE EXCEPTION 'الموظف ليس على رأس العمل (الحالة الحالية: %)', v_emp.status;
  END IF;

  -- 2. Fetch or initialize default Loan Policy for company
  SELECT * INTO v_policy
  FROM public.company_loan_policies
  WHERE company_id = v_emp.company_id AND loan_type = p_loan_type AND is_active = true
  LIMIT 1;

  IF v_policy.id IS NULL THEN
    -- Look for general policy or insert default
    INSERT INTO public.company_loan_policies (
      company_id, loan_type, min_amount, max_amount, max_salary_percentage, max_installments, min_service_days
    ) VALUES (
      v_emp.company_id, p_loan_type, 500, 50000, 30.00, 24, 90
    )
    ON CONFLICT (company_id, loan_type) DO UPDATE SET updated_at = now()
    RETURNING * INTO v_policy;
  END IF;

  -- 3. Validate service period
  v_service_days := (CURRENT_DATE - v_emp.hire_date);
  IF v_service_days < v_policy.min_service_days THEN
    RAISE EXCEPTION 'مدة خدمة الموظف (% يوم) أقل من الحد الأدنى المشترط في سياسة السلف (% يوم)', v_service_days, v_policy.min_service_days;
  END IF;

  -- 4. Validate requested amount
  IF p_amount < v_policy.min_amount THEN
    RAISE EXCEPTION 'مبلغ السلفة المطلوب (% ر.س) أقل من الحد الأدنى المسموح به (% ر.س)', p_amount, v_policy.min_amount;
  END IF;

  IF p_amount > v_policy.max_amount THEN
    RAISE EXCEPTION 'مبلغ السلفة المطلوب (% ر.س) يتجاوز سقف السلفة المحدد بالسياسة (% ر.س)', p_amount, v_policy.max_amount;
  END IF;

  -- 5. Validate installments count
  IF p_installments <= 0 OR p_installments > v_policy.max_installments THEN
    RAISE EXCEPTION 'عدد الأقساط المطلوب (% قسط) يجب أن يكون بين 1 و % قسط وفق السياسة', p_installments, v_policy.max_installments;
  END IF;

  -- 6. Check existing active loans
  SELECT count(*) INTO v_active_loans_count
  FROM public.loans
  WHERE employee_id = p_employee_id AND status IN ('active', 'disbursement_pending', 'approved', 'pending_approval');

  IF v_active_loans_count > 0 AND NOT v_policy.allow_multiple_active THEN
    RAISE EXCEPTION 'لا يمكن طلب سلفة جديدة؛ يوجد سلفة سارية أو قيد الاعتماد بالفعل للموظف';
  END IF;

  -- 7. Validate Salary Capacity
  SELECT * INTO v_comp
  FROM public.employee_compensation_versions
  WHERE employee_id = p_employee_id AND status = 'approved'
  ORDER BY effective_from DESC, version DESC
  LIMIT 1;

  IF v_comp.id IS NOT NULL THEN
    v_total_salary := v_comp.basic_salary + COALESCE(v_comp.housing_allowance, 0) + COALESCE(v_comp.transport_allowance, 0);
  ELSE
    v_total_salary := v_emp.total_salary;
  END IF;

  IF v_total_salary <= 0 THEN
    RAISE EXCEPTION 'لا يمكن تحديد الأهلية لعدم توفر سلم رواتب أو تعويضات معتمد للموظف';
  END IF;

  v_monthly_installment := ROUND(p_amount / p_installments, 2);
  v_max_monthly_deduction := ROUND(v_total_salary * (v_policy.max_salary_percentage / 100.0), 2);

  IF v_monthly_installment > v_max_monthly_deduction THEN
    RAISE EXCEPTION 'القسط الشهري المحتسب (% ر.س) يتجاوز الطاقة الاستقطاعية القصوى (% ر.س تمثل % في المائة من الراتب الإجمالي)',
      v_monthly_installment, v_max_monthly_deduction, v_policy.max_salary_percentage;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'eligible', true,
    'employee_id', p_employee_id,
    'principal_amount', p_amount,
    'total_installments', p_installments,
    'monthly_installment', v_monthly_installment,
    'total_salary', v_total_salary,
    'max_deduction_capacity', v_max_monthly_deduction,
    'policy_id', v_policy.id,
    'policy_loan_type', v_policy.loan_type
  );
END;
$$;

-- ============================================================================
-- STEP 9: SUBMIT LOAN REQUEST ATOMIC (WORKFLOW INTEGRATED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_loan_request_atomic(
  p_loan_type text,
  p_amount numeric,
  p_installments integer,
  p_reason text,
  p_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_target_emp_id uuid;
  v_emp public.employees%ROWTYPE;
  v_valid jsonb;
  v_request_id uuid;
  v_loan_id uuid;
  v_monthly_inst numeric(12,2);
  v_chain_id uuid;
BEGIN
  -- Determine target employee
  IF p_employee_id IS NOT NULL THEN
    -- Verify caller has HR or Admin role to submit for someone else
    IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
      RAISE EXCEPTION 'غير مصرح لك بتقديم طلب سلفة نيابة عن موظف آخر (403)';
    END IF;
    v_target_emp_id := p_employee_id;
  ELSE
    SELECT id INTO v_target_emp_id FROM public.employees WHERE user_id = v_caller_uid LIMIT 1;
    IF v_target_emp_id IS NULL THEN
      RAISE EXCEPTION 'لا يوجد ملف موظف مرتبط بحسابك الحالي لتقديم طلب السلفة';
    END IF;
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = v_target_emp_id;

  -- 1. Run authoritative eligibility check
  v_valid := public.validate_loan_eligibility(v_target_emp_id, p_amount, p_installments, p_loan_type);
  v_monthly_inst := (v_valid->>'monthly_installment')::numeric;

  -- 2. Resolve approval chain for loan_advance
  SELECT id INTO v_chain_id
  FROM public.approval_chains
  WHERE company_id = v_emp.company_id AND request_type = 'loan_advance' AND is_active = true
  ORDER BY version DESC
  LIMIT 1;

  -- 3. Create workflow request
  INSERT INTO public.requests (
    company_id,
    employee_id,
    type,
    status,
    title,
    notes,
    payload,
    approval_chain_id,
    current_step,
    total_steps
  ) VALUES (
    v_emp.company_id,
    v_target_emp_id,
    'loan_advance',
    'pending',
    'طلب سلفة مالية - ' || p_amount || ' ر.س',
    p_reason,
    jsonb_build_object(
      'loanType', p_loan_type,
      'amount', p_amount,
      'installmentsCount', p_installments,
      'monthlyInstallment', v_monthly_inst,
      'reason', p_reason
    ),
    v_chain_id,
    1,
    COALESCE((SELECT count(*) FROM public.approval_steps WHERE chain_id = v_chain_id), 1)
  ) RETURNING id INTO v_request_id;

  -- 4. Create Loan in pending_approval
  INSERT INTO public.loans (
    company_id,
    employee_id,
    request_id,
    loan_type,
    principal_amount,
    approved_amount,
    monthly_installment,
    installment_amount,
    total_installments,
    installments_total,
    paid_installments,
    installments_paid,
    remaining_balance,
    outstanding_amount,
    status,
    reason,
    disbursement_status
  ) VALUES (
    v_emp.company_id,
    v_target_emp_id,
    v_request_id,
    p_loan_type,
    p_amount,
    p_amount,
    v_monthly_inst,
    v_monthly_inst,
    p_installments,
    p_installments,
    0,
    0,
    p_amount,
    p_amount,
    'pending_approval',
    p_reason,
    'prepared'
  ) RETURNING id INTO v_loan_id;

  -- Link loanId to request payload
  UPDATE public.requests
  SET payload = payload || jsonb_build_object('loanId', v_loan_id)
  WHERE id = v_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'loan_id', v_loan_id,
    'request_id', v_request_id,
    'principal_amount', p_amount,
    'monthly_installment', v_monthly_inst,
    'status', 'pending_approval'
  );
END;
$$;

-- ============================================================================
-- STEP 10: ATOMIC LOAN DISBURSEMENT RPC (TRANSACTIONAL & FAIL-CLOSED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.disburse_loan_atomic(
  p_loan_id uuid,
  p_bank_account_id uuid,
  p_external_ref text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_loan public.loans%ROWTYPE;
  v_bank public.company_bank_accounts%ROWTYPE;
  v_emp public.employees%ROWTYPE;
  v_due_date date;
  v_period text;
  v_monthly_inst numeric(12,2);
  v_prev_bal numeric(14,2);
  v_new_bal numeric(14,2);
  v_inst_rem numeric(12,2);
BEGIN
  -- 1. Validate caller role: Finance or Admin only
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'finance_officer', 'payroll_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك بصرف السلف المالية (403)';
  END IF;

  -- 2. Lock Loan row FOR UPDATE
  SELECT * INTO v_loan
  FROM public.loans
  WHERE id = p_loan_id
  FOR UPDATE;

  IF v_loan.id IS NULL THEN
    RAISE EXCEPTION 'السلفة المالية غير موجودة (404)';
  END IF;

  IF v_loan.status NOT IN ('approved', 'disbursement_pending') THEN
    RAISE EXCEPTION 'لا يمكن صرف السلفة إلا بعد اعتمادها رسميًا (الحالة الحالية: %)', v_loan.status;
  END IF;

  -- 3. Lock Bank Account row FOR UPDATE & Validate Tenant Security
  SELECT * INTO v_bank
  FROM public.company_bank_accounts
  WHERE id = p_bank_account_id AND company_id = v_loan.company_id
  FOR UPDATE;

  IF v_bank.id IS NULL THEN
    RAISE EXCEPTION 'الحساب البنكي المحدد غير موجود أو لا يتبع لمنشأة السلفة (عزل المنشآت)';
  END IF;

  v_prev_bal := v_bank.current_balance;
  IF v_prev_bal < v_loan.principal_amount THEN
    RAISE EXCEPTION 'رصيد الحساب البنكي غير كافٍ للصرف. الرصيد الحالي: % ر.س، مبلغ السلفة: % ر.س', v_prev_bal, v_loan.principal_amount;
  END IF;

  v_new_bal := v_prev_bal - v_loan.principal_amount;

  -- 4. Deduct bank balance
  UPDATE public.company_bank_accounts
  SET current_balance = v_new_bal,
      updated_at = now()
  WHERE id = v_bank.id;

  -- 5. Record Disbursement
  INSERT INTO public.loan_disbursements (
    company_id,
    loan_id,
    bank_account_id,
    disbursed_amount,
    previous_bank_balance,
    new_bank_balance,
    disbursement_status,
    external_reference,
    notes,
    actor_id
  ) VALUES (
    v_loan.company_id,
    v_loan.id,
    v_bank.id,
    v_loan.principal_amount,
    v_prev_bal,
    v_new_bal,
    'confirmed',
    COALESCE(p_external_ref, 'DISB-' || to_char(now(), 'YYYYMMDD-HH24MISS')),
    p_notes,
    v_caller_uid
  );

  -- 6. Activate Loan
  UPDATE public.loans
  SET status = 'active',
      disbursement_account_id = v_bank.id,
      disbursed_at = now(),
      disbursed_by = v_caller_uid,
      disbursement_status = 'confirmed',
      disbursement_reference = COALESCE(p_external_ref, 'DISB-' || to_char(now(), 'YYYYMMDD-HH24MISS')),
      remaining_balance = v_loan.principal_amount,
      outstanding_amount = v_loan.principal_amount,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = v_loan.id;

  -- 7. Authoritatively generate Installment Plan in public.loan_installments
  DELETE FROM public.loan_installments WHERE loan_id = v_loan.id;

  v_monthly_inst := v_loan.monthly_installment;
  v_inst_rem := v_loan.principal_amount;

  FOR i IN 1..v_loan.total_installments LOOP
    v_due_date := CURRENT_DATE + (i || ' month')::interval;
    v_period := to_char(v_due_date, 'YYYY-MM');

    INSERT INTO public.loan_installments (
      loan_id,
      company_id,
      employee_id,
      installment_number,
      due_payroll_period,
      due_date,
      principal_amount,
      deducted_amount,
      remaining_balance,
      status
    ) VALUES (
      v_loan.id,
      v_loan.company_id,
      v_loan.employee_id,
      i,
      v_period,
      v_due_date,
      v_monthly_inst,
      0,
      v_monthly_inst,
      'pending'
    );
  END LOOP;

  -- 8. Write Audit Log
  INSERT INTO public.payroll_audit_logs (
    company_id,
    action,
    actor_id,
    details
  ) VALUES (
    v_loan.company_id,
    'loan_disbursed',
    v_caller_uid,
    jsonb_build_object(
      'loan_id', v_loan.id,
      'employee_id', v_loan.employee_id,
      'disbursed_amount', v_loan.principal_amount,
      'bank_account_id', v_bank.id,
      'new_balance', v_new_bal,
      'installments_created', v_loan.total_installments
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'loan_id', v_loan.id,
    'disbursed_amount', v_loan.principal_amount,
    'new_bank_balance', v_new_bal,
    'installments_created', v_loan.total_installments,
    'status', 'active'
  );
END;
$$;

-- ============================================================================
-- STEP 11: AUTHORITATIVE EARLY LOAN SETTLEMENT RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.settle_loan_early_atomic(
  p_loan_id uuid,
  p_payment_method text DEFAULT 'bank_transfer',
  p_receipt_ref text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_loan public.loans%ROWTYPE;
  v_settled_amount numeric(12,2);
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'finance_officer', 'payroll_officer', 'hr_manager']) THEN
    RAISE EXCEPTION 'غير مصرح لك بإجراء سداد مبكر للسلفة (403)';
  END IF;

  SELECT * INTO v_loan FROM public.loans WHERE id = p_loan_id FOR UPDATE;
  IF v_loan.id IS NULL THEN
    RAISE EXCEPTION 'السلفة غير موجودة';
  END IF;

  IF v_loan.status <> 'active' THEN
    RAISE EXCEPTION 'السلفة ليست نشطة للسداد المبكر (الحالة: %)', v_loan.status;
  END IF;

  v_settled_amount := v_loan.remaining_balance;

  -- 1. Close remaining pending installments
  UPDATE public.loan_installments
  SET status = 'early_settled',
      remaining_balance = 0,
      recovered_at = now(),
      updated_at = now()
  WHERE loan_id = v_loan.id AND status = 'pending';

  -- 2. Close Loan
  UPDATE public.loans
  SET status = 'closed',
      remaining_balance = 0,
      outstanding_amount = 0,
      settled_at = now(),
      settled_by = v_caller_uid,
      settlement_type = 'early_cash_settlement',
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = v_loan.id;

  -- 3. Audit log
  INSERT INTO public.payroll_audit_logs (
    company_id,
    action,
    actor_id,
    details
  ) VALUES (
    v_loan.company_id,
    'loan_early_settled',
    v_caller_uid,
    jsonb_build_object(
      'loan_id', v_loan.id,
      'settled_amount', v_settled_amount,
      'payment_method', p_payment_method,
      'receipt_ref', p_receipt_ref
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'loan_id', v_loan.id,
    'settled_amount', v_settled_amount,
    'status', 'closed'
  );
END;
$$;

-- ============================================================================
-- STEP 12: IDEMPOTENT PAYROLL LOAN INSTALLMENT RECOVERY RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recover_loan_installments_for_payroll_run(
  p_payroll_run_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.payroll_runs%ROWTYPE;
  v_period text;
  v_rec record;
  v_recovered_count integer := 0;
  v_recovered_amount numeric(12,2) := 0;
BEGIN
  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود';
  END IF;

  v_period := to_char(make_date(v_run.period_year, v_run.period_month, 1), 'YYYY-MM');

  -- Process active loans having pending installments for this period
  FOR v_rec IN
    SELECT li.id AS installment_id, li.loan_id, li.employee_id, li.principal_amount, l.company_id
    FROM public.loan_installments li
    JOIN public.loans l ON l.id = li.loan_id
    JOIN public.payroll_run_employees pre ON pre.payroll_run_id = p_payroll_run_id AND pre.employee_id = li.employee_id
    WHERE l.company_id = v_run.company_id
      AND li.due_payroll_period = v_period
      AND li.status = 'pending'
      AND l.status = 'active'
    FOR UPDATE OF li, l
  LOOP
    -- Mark installment deducted
    UPDATE public.loan_installments
    SET status = 'deducted',
        deducted_amount = v_rec.principal_amount,
        remaining_balance = 0,
        payroll_run_id = p_payroll_run_id,
        recovered_at = now(),
        updated_at = now()
    WHERE id = v_rec.installment_id;

    -- Update loan master balance
    UPDATE public.loans
    SET paid_installments = paid_installments + 1,
        installments_paid = installments_paid + 1,
        remaining_balance = greatest(0, remaining_balance - v_rec.principal_amount),
        outstanding_amount = greatest(0, outstanding_amount - v_rec.principal_amount),
        status = CASE WHEN remaining_balance - v_rec.principal_amount <= 0 THEN 'closed' ELSE status END,
        updated_at = now()
    WHERE id = v_rec.loan_id;

    -- Insert legacy allocation row idempotently
    INSERT INTO public.payroll_loan_allocations (payroll_run_id, loan_id, employee_id, amount, recovered_at)
    VALUES (p_payroll_run_id, v_rec.loan_id, v_rec.employee_id, v_rec.principal_amount, now())
    ON CONFLICT (payroll_run_id, loan_id) DO NOTHING;

    v_recovered_count := v_recovered_count + 1;
    v_recovered_amount := v_recovered_amount + v_rec.principal_amount;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'recovered_count', v_recovered_count,
    'recovered_amount', v_recovered_amount,
    'period', v_period
  );
END;
$$;

-- ============================================================================
-- STEP 13: SUBMIT RESIGNATION ATOMIC (SELF-SERVICE WORKFLOW)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_resignation_atomic(
  p_last_working_day date,
  p_reason text,
  p_notice_served boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_emp public.employees%ROWTYPE;
  v_request_id uuid;
  v_separation_id uuid;
  v_chain_id uuid;
  v_notice_days integer;
BEGIN
  -- 1. Identify Caller Employee
  SELECT * INTO v_emp FROM public.employees WHERE user_id = v_caller_uid LIMIT 1;
  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'المستخدم ليس له ملف موظف نشط لتقديم الاستقالة';
  END IF;

  IF v_emp.status <> 'active' THEN
    RAISE EXCEPTION 'الموظف ليس على رأس العمل لتقديم الاستقالة (الحالة الحالية: %)', v_emp.status;
  END IF;

  IF p_last_working_day < CURRENT_DATE THEN
    RAISE EXCEPTION 'آخر يوم عمل (% ) لا يمكن أن يكون تاريخاً سابقاً لتاريخ اليوم', p_last_working_day;
  END IF;

  v_notice_days := (p_last_working_day - CURRENT_DATE);

  -- 2. Check if active separation already exists
  IF EXISTS (
    SELECT 1 FROM public.employee_separations
    WHERE employee_id = v_emp.id AND status NOT IN ('finalized', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'يوجد طلب استقالة أو إجراء إنهاء خدمة نشط بالفعل للموظف';
  END IF;

  -- 3. Resolve resignation approval chain
  SELECT id INTO v_chain_id
  FROM public.approval_chains
  WHERE company_id = v_emp.company_id AND request_type = 'resignation' AND is_active = true
  ORDER BY version DESC
  LIMIT 1;

  -- 4. Submit workflow request
  INSERT INTO public.requests (
    company_id,
    employee_id,
    type,
    status,
    title,
    notes,
    payload,
    approval_chain_id,
    current_step,
    total_steps
  ) VALUES (
    v_emp.company_id,
    v_emp.id,
    'resignation',
    'pending',
    'إشعار استقالة - ' || v_emp.first_name_ar || ' ' || v_emp.last_name_ar,
    p_reason,
    jsonb_build_object(
      'lastWorkingDay', p_last_working_day,
      'noticePeriodDays', v_notice_days,
      'noticePeriodServed', p_notice_served,
      'reason', p_reason
    ),
    v_chain_id,
    1,
    COALESCE((SELECT count(*) FROM public.approval_steps WHERE chain_id = v_chain_id), 1)
  ) RETURNING id INTO v_request_id;

  -- 5. Create separation record in pending
  INSERT INTO public.employee_separations (
    company_id,
    employee_id,
    separation_type,
    initiated_by,
    request_id,
    requested_date,
    last_working_day,
    reason,
    notice_period_days,
    notice_period_served,
    workflow_status,
    clearance_status,
    settlement_status,
    status
  ) VALUES (
    v_emp.company_id,
    v_emp.id,
    'resignation',
    'employee',
    v_request_id,
    CURRENT_DATE,
    p_last_working_day,
    p_reason,
    v_notice_days,
    p_notice_served,
    'pending',
    'pending',
    'not_calculated',
    'pending'
  ) RETURNING id INTO v_separation_id;

  UPDATE public.requests
  SET payload = payload || jsonb_build_object('separationId', v_separation_id)
  WHERE id = v_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'separation_id', v_separation_id,
    'request_id', v_request_id,
    'last_working_day', p_last_working_day,
    'status', 'pending'
  );
END;
$$;

-- ============================================================================
-- STEP 14: HR ADMINISTRATIVE SEPARATION INITIATION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.initiate_separation_hr_atomic(
  p_employee_id uuid,
  p_separation_type text,
  p_last_working_day date,
  p_reason text,
  p_notice_served boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_emp public.employees%ROWTYPE;
  v_separation_id uuid;
  v_asset record;
  v_loan record;
  v_item_count integer := 0;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
    RAISE EXCEPTION 'غير مصرح لك بإجراء إنهاء خدمة إداري للموظف (403)';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود (404)';
  END IF;

  IF v_emp.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة موظف يتبع لمنشأة أخرى';
  END IF;

  -- 1. Create Separation Record in in_clearance
  INSERT INTO public.employee_separations (
    company_id,
    employee_id,
    separation_type,
    initiated_by,
    requested_date,
    last_working_day,
    reason,
    notice_period_days,
    notice_period_served,
    workflow_status,
    clearance_status,
    settlement_status,
    status
  ) VALUES (
    v_emp.company_id,
    v_emp.id,
    p_separation_type,
    'hr',
    CURRENT_DATE,
    p_last_working_day,
    p_reason,
    greatest(0, (p_last_working_day - CURRENT_DATE)),
    p_notice_served,
    'approved',
    'in_progress',
    'not_calculated',
    'in_clearance'
  ) RETURNING id INTO v_separation_id;

  -- 2. Populate Clearance Items: Assets Return
  FOR v_asset IN
    SELECT id, name, asset_tag
    FROM public.hardware_assets
    WHERE assigned_to_employee_id = p_employee_id AND status <> 'available'
  LOOP
    INSERT INTO public.clearance_items (
      separation_id, company_id, employee_id, category, item_key, title_ar, assigned_role, status, asset_id
    ) VALUES (
      v_separation_id, v_emp.company_id, v_emp.id, 'assets_return', 'asset_' || v_asset.id,
      'تسليم عهدة أصل: ' || COALESCE(v_asset.name, v_asset.asset_tag) || ' (' || v_asset.asset_tag || ')',
      'it_admin', 'pending', v_asset.id
    );
    v_item_count := v_item_count + 1;
  END LOOP;

  -- 3. Populate Clearance Items: Loans Clearance
  FOR v_loan IN
    SELECT id, principal_amount, remaining_balance
    FROM public.loans
    WHERE employee_id = p_employee_id AND status = 'active' AND remaining_balance > 0
  LOOP
    INSERT INTO public.clearance_items (
      separation_id, company_id, employee_id, category, item_key, title_ar, assigned_role, status, loan_id
    ) VALUES (
      v_separation_id, v_emp.company_id, v_emp.id, 'loans', 'loan_' || v_loan.id,
      'تسوية رصيد السلفة القائم (' || v_loan.remaining_balance || ' ر.س)',
      'finance_officer', 'pending', v_loan.id
    );
    v_item_count := v_item_count + 1;
  END LOOP;

  -- 4. Standard Operational Clearance Items
  INSERT INTO public.clearance_items (separation_id, company_id, employee_id, category, item_key, title_ar, assigned_role, status)
  VALUES
    (v_separation_id, v_emp.company_id, v_emp.id, 'hr', 'hr_interview', 'المقابلة الختامية وتسليم الهوية والوثائق', 'hr_manager', 'pending'),
    (v_separation_id, v_emp.company_id, v_emp.id, 'manager_handover', 'dept_handover', 'تسليم المهام والمشاريع لمدير الإدارة', 'dept_head', 'pending'),
    (v_separation_id, v_emp.company_id, v_emp.id, 'it_access', 'it_revocation', 'إيقاف البريد الإلكتروني وصلاحيات الأنظمة', 'it_admin', 'pending'),
    (v_separation_id, v_emp.company_id, v_emp.id, 'finance', 'finance_clearance', 'إخلاء الطرف المالي وتسوية العهد والمصروفات', 'finance_officer', 'pending');
  v_item_count := v_item_count + 4;

  -- Audit log
  INSERT INTO public.payroll_audit_logs (company_id, action, actor_id, details)
  VALUES (v_emp.company_id, 'separation_initiated', v_caller_uid, jsonb_build_object(
    'separation_id', v_separation_id, 'employee_id', p_employee_id, 'separation_type', p_separation_type
  ));

  RETURN jsonb_build_object(
    'ok', true,
    'separation_id', v_separation_id,
    'clearance_items_count', v_item_count,
    'status', 'in_clearance'
  );
END;
$$;

-- ============================================================================
-- STEP 15: UPDATE CLEARANCE ITEM RPC (INTEGRATED ASSETS & LOANS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_clearance_item_atomic(
  p_item_id uuid,
  p_status text,
  p_notes text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_item public.clearance_items%ROWTYPE;
  v_sep public.employee_separations%ROWTYPE;
  v_pending_count integer;
  v_blocked_count integer;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'dept_head', 'finance_officer', 'it_admin']) THEN
    RAISE EXCEPTION 'غير مصرح لك بتحديث بنود إخلاء الطرف (403)';
  END IF;

  SELECT * INTO v_item FROM public.clearance_items WHERE id = p_item_id FOR UPDATE;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'بند إخلاء الطرف غير موجود';
  END IF;

  IF p_status NOT IN ('pending', 'cleared', 'waived', 'blocked') THEN
    RAISE EXCEPTION 'حالة البند غير صالحة: %', p_status;
  END IF;

  -- If asset return item is cleared, update the hardware_assets record
  IF v_item.category = 'assets_return' AND v_item.asset_id IS NOT NULL AND p_status = 'cleared' THEN
    UPDATE public.hardware_assets
    SET status = 'available',
        assigned_to_employee_id = NULL
    WHERE id = v_item.asset_id;
  END IF;

  -- Update Item
  UPDATE public.clearance_items
  SET status = p_status,
      notes = COALESCE(p_notes, notes),
      evidence_url = COALESCE(p_evidence_url, evidence_url),
      completed_at = CASE WHEN p_status IN ('cleared', 'waived') THEN now() ELSE NULL END,
      completed_by = CASE WHEN p_status IN ('cleared', 'waived') THEN v_caller_uid ELSE NULL END,
      updated_at = now()
  WHERE id = p_item_id;

  -- Re-evaluate separation clearance status
  SELECT count(*) INTO v_pending_count
  FROM public.clearance_items
  WHERE separation_id = v_item.separation_id AND status = 'pending';

  SELECT count(*) INTO v_blocked_count
  FROM public.clearance_items
  WHERE separation_id = v_item.separation_id AND status = 'blocked';

  IF v_blocked_count > 0 THEN
    UPDATE public.employee_separations
    SET clearance_status = 'blocked', updated_at = now()
    WHERE id = v_item.separation_id;
  ELSIF v_pending_count = 0 THEN
    UPDATE public.employee_separations
    SET clearance_status = 'completed',
        status = CASE WHEN status = 'in_clearance' THEN 'settlement_ready' ELSE status END,
        updated_at = now()
    WHERE id = v_item.separation_id;
  ELSE
    UPDATE public.employee_separations
    SET clearance_status = 'in_progress', updated_at = now()
    WHERE id = v_item.separation_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'status', p_status,
    'remaining_pending', v_pending_count
  );
END;
$$;

-- ============================================================================
-- STEP 16: EXTENDED SETTLEMENT ENGINE (INTEGRATED WITH PROMPT 16 BLOCKERS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_final_settlement_atomic(
  p_employee_id uuid,
  p_termination_date date,
  p_separation_type text DEFAULT 'contract_expiration',
  p_unpaid_leave_days integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_emp public.employees%ROWTYPE;
  v_comp public.employee_compensation_versions%ROWTYPE;
  v_config public.company_payroll_configs%ROWTYPE;
  v_leave_balance public.leave_balances%ROWTYPE;
  v_separation public.employee_separations%ROWTYPE;
  v_unreturned_assets integer := 0;
  v_open_runs integer := 0;
  v_service_days integer;
  v_service_years_decimal numeric(6,3);
  v_total_monthly_wage numeric(12,2);
  v_daily_rate numeric(12,2);
  v_gross_eosb numeric(12,2) := 0;
  v_resignation_multiplier numeric(6,3) := 100.00;
  v_eosb_amount numeric(12,2) := 0;
  v_leave_payout_amount numeric(12,2) := 0;
  v_loan_deduction numeric(12,2) := 0;
  v_pending_salary numeric(12,2) := 0;
  v_net_settlement numeric(12,2) := 0;
  v_unconsumed_leave numeric(6,2) := 0;
  v_snapshot jsonb;
BEGIN
  -- RBAC check
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'payroll_officer', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح لك باحتساب مخالصة نهاية الخدمة (42501)';
  END IF;

  -- 1. Fetch Employee
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود بالنظام';
  END IF;

  IF public.current_company_id() IS NOT NULL AND v_emp.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة تسوية موظف يتبع لمنشأة أخرى';
  END IF;

  IF p_termination_date < v_emp.hire_date THEN
    RAISE EXCEPTION 'تاريخ انتهاء الخدمة (%) لا يمكن أن يسبق تاريخ التعيين (%)', p_termination_date, v_emp.hire_date;
  END IF;

  -- 2. BLOCKING EXCEPTION: Unreturned Assets
  SELECT count(*) INTO v_unreturned_assets
  FROM public.hardware_assets
  WHERE assigned_to_employee_id = p_employee_id AND status <> 'available';

  IF v_unreturned_assets > 0 THEN
    RAISE EXCEPTION 'لا يمكن احتساب المخالصة لوجود عهد / أصول غير مستلمة (% أصل). يرجى استكمال تسليم العهد أولاً.', v_unreturned_assets;
  END IF;

  -- 3. BLOCKING EXCEPTION: Open unapproved payroll runs
  SELECT count(*) INTO v_open_runs
  FROM public.payroll_runs pr
  JOIN public.payroll_run_employees pre ON pre.payroll_run_id = pr.id
  WHERE pre.employee_id = p_employee_id AND pr.status = 'draft';

  IF v_open_runs > 0 THEN
    RAISE EXCEPTION 'يوجد مسيّر رواتب معلق لم يعتمد بعد يشمل الموظف. يرجى اعتماد أو تسوية مسير الرواتب المعلق أولاً.';
  END IF;

  -- 4. Check for existing separation
  SELECT * INTO v_separation
  FROM public.employee_separations
  WHERE employee_id = p_employee_id AND status NOT IN ('finalized', 'cancelled')
  ORDER BY created_at DESC
  LIMIT 1;

  -- 5. Fetch effective compensation version
  SELECT * INTO v_comp
  FROM public.employee_compensation_versions
  WHERE employee_id = p_employee_id AND status = 'approved'
  ORDER BY effective_from DESC, version DESC
  LIMIT 1;

  IF v_comp.id IS NOT NULL THEN
    v_total_monthly_wage := v_comp.basic_salary + COALESCE(v_comp.housing_allowance, 0) + COALESCE(v_comp.transport_allowance, 0);
  ELSE
    v_total_monthly_wage := v_emp.total_salary;
  END IF;

  IF v_total_monthly_wage <= 0 THEN
    RAISE EXCEPTION 'سجل الراتب والتعويضات غير متوفر أو غير مكتمل للموظف (% - %)', v_emp.employee_no, v_emp.first_name_ar;
  END IF;

  -- 6. Fetch company payroll configuration for daily rate
  SELECT * INTO v_config
  FROM public.company_payroll_configs
  WHERE company_id = v_emp.company_id AND status = 'active'
  LIMIT 1;

  IF v_config.calculation_basis = 'actual_days' THEN
    v_daily_rate := ROUND(v_total_monthly_wage / EXTRACT(DAY FROM (date_trunc('month', p_termination_date) + interval '1 month - 1 day')), 2);
  ELSIF v_config.calculation_basis = 'working_days_22' THEN
    v_daily_rate := ROUND(v_total_monthly_wage / 22.0, 2);
  ELSE
    v_daily_rate := ROUND(v_total_monthly_wage / 30.0, 2);
  END IF;

  -- 7. Service Period Calculation
  v_service_days := (p_termination_date - v_emp.hire_date) + 1 - GREATEST(0, p_unpaid_leave_days);
  IF v_service_days < 0 THEN
    v_service_days := 0;
  END IF;
  v_service_years_decimal := ROUND(v_service_days / 365.0, 3);

  -- 8. Statutory EOSB Under Saudi Labor Law
  IF p_separation_type = 'termination_with_cause' THEN
    v_gross_eosb := 0;
    v_resignation_multiplier := 0;
  ELSE
    IF v_service_years_decimal <= 5.0 THEN
      v_gross_eosb := ROUND(v_service_years_decimal * (v_total_monthly_wage / 2.0), 2);
    ELSE
      v_gross_eosb := ROUND(
        (5.0 * (v_total_monthly_wage / 2.0)) +
        ((v_service_years_decimal - 5.0) * v_total_monthly_wage),
        2
      );
    END IF;

    IF p_separation_type = 'resignation' THEN
      IF v_service_years_decimal < 2.0 THEN
        v_resignation_multiplier := 0.0;
      ELSIF v_service_years_decimal >= 2.0 AND v_service_years_decimal < 5.0 THEN
        v_resignation_multiplier := 33.333;
      ELSIF v_service_years_decimal >= 5.0 AND v_service_years_decimal < 10.0 THEN
        v_resignation_multiplier := 66.667;
      ELSE
        v_resignation_multiplier := 100.0;
      END IF;
    ELSE
      v_resignation_multiplier := 100.0;
    END IF;
  END IF;

  v_eosb_amount := ROUND((v_gross_eosb * (v_resignation_multiplier / 100.0)), 2);

  -- 9. Authoritative Leave Balance Payout
  SELECT * INTO v_leave_balance
  FROM public.leave_balances
  WHERE employee_id = p_employee_id
  LIMIT 1;

  IF v_leave_balance.id IS NULL THEN
    RAISE EXCEPTION 'سجل رصيد الإجازات غير متوفر في النظام للموظف (رقم %)', v_emp.employee_no;
  END IF;

  v_unconsumed_leave := (v_leave_balance.accrued_days + v_leave_balance.carried_over_days) - (v_leave_balance.used_days + v_leave_balance.reserved_days);
  IF v_unconsumed_leave > 0 THEN
    v_leave_payout_amount := ROUND(v_unconsumed_leave * v_daily_rate, 2);
  ELSE
    v_leave_payout_amount := 0;
    v_unconsumed_leave := 0;
  END IF;

  -- 10. Authoritative Active Loans Balance Deduction
  SELECT COALESCE(SUM(remaining_balance), 0) INTO v_loan_deduction
  FROM public.loans
  WHERE employee_id = p_employee_id AND status = 'active';

  -- 11. Net Settlement
  v_net_settlement := (v_eosb_amount + v_leave_payout_amount + v_pending_salary) - v_loan_deduction;

  -- 12. Auditable Snapshot
  v_snapshot := jsonb_build_object(
    'employee_id', v_emp.id,
    'employee_no', v_emp.employee_no,
    'hire_date', v_emp.hire_date,
    'termination_date', p_termination_date,
    'separation_type', p_separation_type,
    'service_days', v_service_days,
    'service_years_decimal', v_service_years_decimal,
    'total_monthly_wage', v_total_monthly_wage,
    'daily_rate', v_daily_rate,
    'calculation_basis', COALESCE(v_config.calculation_basis, 'fixed_30_days'),
    'gross_eosb', v_gross_eosb,
    'resignation_multiplier', v_resignation_multiplier,
    'eosb_amount', v_eosb_amount,
    'leave_balance_payout_days', v_unconsumed_leave,
    'leave_payout_amount', v_leave_payout_amount,
    'loan_deduction_amount', v_loan_deduction,
    'pending_salary_amount', v_pending_salary,
    'net_settlement_amount', v_net_settlement,
    'statutory_policy', 'SA_LABOR_LAW_ARTICLES_84_85',
    'compensation_version_id', v_comp.id,
    'calculated_at', now(),
    'calculated_by', v_caller_uid
  );

  RETURN jsonb_build_object(
    'ok', true,
    'employee_id', v_emp.id,
    'employee_no', v_emp.employee_no,
    'service_days', v_service_days,
    'total_service_years_decimal', v_service_years_decimal,
    'total_monthly_wage', v_total_monthly_wage,
    'daily_rate', v_daily_rate,
    'calculation_basis', COALESCE(v_config.calculation_basis, 'fixed_30_days'),
    'gross_eosb', v_gross_eosb,
    'resignation_multiplier', v_resignation_multiplier,
    'eosb_amount', v_eosb_amount,
    'leave_balance_payout_days', v_unconsumed_leave,
    'leave_payout_amount', v_leave_payout_amount,
    'loan_deduction_amount', v_loan_deduction,
    'pending_salary_amount', v_pending_salary,
    'net_settlement_amount', v_net_settlement,
    'calculation_snapshot', v_snapshot,
    'separation_id', v_separation.id
  );
END;
$$;

-- ============================================================================
-- STEP 17: FINALIZE EMPLOYEE OFFBOARDING RPC (CONTROLLED IMMUTABLE CLOSE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_employee_offboarding_atomic(
  p_separation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_sep public.employee_separations%ROWTYPE;
  v_settlement public.settlements%ROWTYPE;
  v_emp public.employees%ROWTYPE;
  v_pending_clearance integer;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager']) THEN
    RAISE EXCEPTION 'غير مصرح لك بإنهاء خدمة الموظف رسميًا (403)';
  END IF;

  SELECT * INTO v_sep FROM public.employee_separations WHERE id = p_separation_id FOR UPDATE;
  IF v_sep.id IS NULL THEN
    RAISE EXCEPTION 'إجراء إنهاء الخدمة غير موجود (404)';
  END IF;

  IF v_sep.status = 'finalized' THEN
    RAISE EXCEPTION 'تم إنهاء خدمة الموظف وإغلاق ملفه مسبقًا';
  END IF;

  -- 1. Check all clearance items are cleared or waived
  SELECT count(*) INTO v_pending_clearance
  FROM public.clearance_items
  WHERE separation_id = p_separation_id AND status NOT IN ('cleared', 'waived');

  IF v_pending_clearance > 0 THEN
    RAISE EXCEPTION 'لا يمكن إنهاء الخدمة لوجود بنود إخلاء طرف غير مكتملة (% بند)', v_pending_clearance;
  END IF;

  -- 2. Verify Final Settlement exists and is approved or paid
  SELECT * INTO v_settlement
  FROM public.settlements
  WHERE id = v_sep.settlement_id OR (employee_id = v_sep.employee_id AND status IN ('approved', 'paid'))
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_settlement.id IS NULL THEN
    RAISE EXCEPTION 'لا يمكن إنهاء الخدمة قبل اعتماد مخالصة نهاية الخدمة رسميًا';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = v_sep.employee_id FOR UPDATE;

  -- 3. Update employee status to terminated without deleting record
  UPDATE public.employees
  SET status = 'terminated',
      updated_at = now()
  WHERE id = v_emp.id;

  -- 4. Finalize separation record
  UPDATE public.employee_separations
  SET status = 'finalized',
      clearance_status = 'completed',
      finalized_at = now(),
      finalized_by = v_caller_uid,
      updated_at = now()
  WHERE id = p_separation_id;

  -- 5. Audit log
  INSERT INTO public.payroll_audit_logs (company_id, action, actor_id, details)
  VALUES (
    v_emp.company_id,
    'employee_offboarding_finalized',
    v_caller_uid,
    jsonb_build_object(
      'separation_id', p_separation_id,
      'employee_id', v_emp.id,
      'employee_no', v_emp.employee_no,
      'last_working_day', v_sep.last_working_day,
      'settlement_id', v_settlement.id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'separation_id', p_separation_id,
    'employee_id', v_emp.id,
    'status', 'finalized',
    'employee_status', 'terminated'
  );
END;
$$;

-- ============================================================================
-- STEP 18: UPDATE WORKFLOW FINALIZER HOOK FOR LOANS & RESIGNATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_approved_resignation(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%ROWTYPE;
  v_sep public.employee_separations%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_sep FROM public.employee_separations WHERE request_id = p_request_id;
  IF v_sep.id IS NOT NULL THEN
    UPDATE public.employee_separations
    SET workflow_status = 'approved',
        status = 'in_clearance',
        clearance_status = 'in_progress',
        updated_at = now()
    WHERE id = v_sep.id;

    -- Automatically populate clearance items if not already done
    PERFORM public.initiate_separation_hr_atomic(
      v_sep.employee_id,
      v_sep.separation_type,
      v_sep.last_working_day,
      v_sep.reason,
      v_sep.notice_period_served
    );
  END IF;
END;
$$;

-- Hook into finalize_payroll_run_atomic to call recover_loan_installments_for_payroll_run
-- If finalize_payroll_run_atomic exists, ensure it performs loan installment recovery
CREATE OR REPLACE FUNCTION public.finalize_payroll_run_atomic(
  p_payroll_run_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_run public.payroll_runs%ROWTYPE;
  v_blocking_count integer := 0;
  v_loan_res jsonb;
BEGIN
  IF NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'finance_officer', 'payroll_officer', 'hr_manager']) THEN
    RAISE EXCEPTION 'غير مصرح لك بقفل واعتماد مسيّر الرواتب (42501)';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'مسيّر الرواتب غير موجود (404)';
  END IF;

  IF v_run.status NOT IN ('calculated', 'approved') THEN
    RAISE EXCEPTION 'لا يمكن قفل مسيّر الرواتب إلا بعد احتسابه أو اعتماده (الحالة الحالية: %)', v_run.status;
  END IF;

  -- Verify no blocking exceptions
  SELECT count(*) INTO v_blocking_count
  FROM public.payroll_exceptions
  WHERE payroll_run_id = p_payroll_run_id AND severity = 'blocking' AND is_resolved = false;

  IF v_blocking_count > 0 THEN
    RAISE EXCEPTION 'لا يمكن قفل المسيّر؛ يوجد % استثناءات مانعة غير معالجة', v_blocking_count;
  END IF;

  -- 1. Idempotently recover loan installments for this payroll period
  v_loan_res := public.recover_loan_installments_for_payroll_run(p_payroll_run_id);

  -- 2. Lock Payroll Run
  UPDATE public.payroll_runs
  SET status = 'locked',
      locked_by = v_caller_uid,
      locked_at = now(),
      updated_at = now()
  WHERE id = p_payroll_run_id;

  UPDATE public.payroll_run_employees
  SET status = 'locked', updated_at = now()
  WHERE payroll_run_id = p_payroll_run_id;

  INSERT INTO public.payroll_audit_logs (company_id, payroll_run_id, action, actor_id, details)
  VALUES (
    v_run.company_id,
    p_payroll_run_id,
    'locked',
    v_caller_uid,
    jsonb_build_object(
      'locked_at', now(),
      'loans_recovered', v_loan_res
    )
  );

  RETURN jsonb_build_object('ok', true, 'payroll_run_id', p_payroll_run_id, 'status', 'locked', 'loans_recovered', v_loan_res);
END;
$$;

-- ============================================================================
-- STEP 19: STRICT PERMISSIONS & GRANTS
-- ============================================================================

REVOKE ALL ON FUNCTION public.validate_loan_eligibility(uuid, numeric, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_loan_request_atomic(text, numeric, integer, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.disburse_loan_atomic(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_loan_early_atomic(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recover_loan_installments_for_payroll_run(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_resignation_atomic(date, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.initiate_separation_hr_atomic(uuid, text, date, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_clearance_item_atomic(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_employee_offboarding_atomic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_approved_resignation(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.validate_loan_eligibility(uuid, numeric, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_loan_request_atomic(text, numeric, integer, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.disburse_loan_atomic(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_loan_early_atomic(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recover_loan_installments_for_payroll_run(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_resignation_atomic(date, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.initiate_separation_hr_atomic(uuid, text, date, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_clearance_item_atomic(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_employee_offboarding_atomic(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_approved_resignation(uuid) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_loan_policies TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_installments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_disbursements TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_separations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clearance_items TO authenticated, service_role;

