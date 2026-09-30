-- ============================================================================
-- PROMPT 17: PRODUCTION EXPENSE MANAGEMENT & EMPLOYEE REIMBURSEMENT ENGINE
-- Migration: 20260930000000_production_expenses_reimbursements_engine.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: ENHANCE EXPENSE CATEGORIES TABLE
-- ============================================================================

ALTER TABLE public.expense_categories
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS accounting_account_code text NOT NULL DEFAULT '510100',
  ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill company_id on categories if null
UPDATE public.expense_categories
SET company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Ensure code exists
UPDATE public.expense_categories
SET code = UPPER(SUBSTRING(COALESCE(name_en, name_ar, 'EXP') FROM 1 FOR 10))
WHERE code IS NULL;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_select_policy" ON public.expense_categories;
CREATE POLICY "expense_categories_select_policy"
  ON public.expense_categories FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "expense_categories_manage_policy" ON public.expense_categories;
CREATE POLICY "expense_categories_manage_policy"
  ON public.expense_categories FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
  );

-- ============================================================================
-- STEP 2: EXPENSE POLICIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expense_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  job_grade text,
  employee_group text,
  single_transaction_limit numeric(12,2) NOT NULL DEFAULT 5000,
  monthly_limit numeric(12,2) NOT NULL DEFAULT 20000,
  annual_limit numeric(12,2) NOT NULL DEFAULT 100000,
  receipt_required_threshold numeric(12,2) NOT NULL DEFAULT 0, -- 0 means always required
  requires_approval boolean NOT NULL DEFAULT true,
  approval_chain_code text NOT NULL DEFAULT 'expense_claim',
  allowed_payment_methods text[] NOT NULL DEFAULT ARRAY['employee_paid', 'corporate_card', 'company_paid', 'cash_advance'],
  allow_payroll_reimbursement boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_policies_select_policy" ON public.expense_policies;
CREATE POLICY "expense_policies_select_policy"
  ON public.expense_policies FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
  );

DROP POLICY IF EXISTS "expense_policies_manage_policy" ON public.expense_policies;
CREATE POLICY "expense_policies_manage_policy"
  ON public.expense_policies FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
  );

-- ============================================================================
-- STEP 3: ENHANCE EXPENSE CLAIMS TABLE
-- ============================================================================

ALTER TABLE public.expense_claims
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS claim_number text,
  ADD COLUMN IF NOT EXISTS workflow_request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS business_justification text,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_code text,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'employee_paid' CHECK (payment_method IN ('employee_paid', 'corporate_card', 'company_paid', 'cash_advance')),
  ADD COLUMN IF NOT EXISTS is_reimbursable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_file_id uuid,
  ADD COLUMN IF NOT EXISTS receipt_hash text,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(12,6) NOT NULL DEFAULT 1.000000,
  ADD COLUMN IF NOT EXISTS settlement_currency text NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS converted_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS policy_warning_triggered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_warning_reason text,
  ADD COLUMN IF NOT EXISTS reimbursement_batch_id uuid,
  ADD COLUMN IF NOT EXISTS reimbursement_status text NOT NULL DEFAULT 'unreimbursed' CHECK (reimbursement_status IN ('not_applicable', 'unreimbursed', 'queued_in_batch', 'approved_for_payment', 'submitted_to_bank', 'reimbursed', 'transferred_to_payroll', 'failed', 'reversed')),
  ADD COLUMN IF NOT EXISTS reimbursed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reimbursed_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS reimbursement_method text CHECK (reimbursement_method IN ('direct_bank_transfer', 'payroll', 'cash', 'card_reconciliation')),
  ADD COLUMN IF NOT EXISTS payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_potential_claim_id uuid REFERENCES public.expense_claims(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill company_id on expense_claims from employees
UPDATE public.expense_claims ec
SET company_id = e.company_id
FROM public.employees e
WHERE ec.employee_id = e.id AND ec.company_id IS NULL;

-- Backfill claim_number where missing
UPDATE public.expense_claims
SET claim_number = 'EXP-' || TO_CHAR(created_at, 'YYYYMM') || '-' || SUBSTRING(id::text, 1, 6)
WHERE claim_number IS NULL;

-- Backfill converted_amount where missing
UPDATE public.expense_claims
SET converted_amount = amount * exchange_rate
WHERE converted_amount = 0 OR converted_amount IS NULL;

-- Update is_reimbursable based on payment_method
UPDATE public.expense_claims
SET is_reimbursable = (payment_method = 'employee_paid'),
    reimbursement_status = CASE 
      WHEN payment_method != 'employee_paid' THEN 'not_applicable'
      WHEN status = 'approved' AND reimbursement_status = 'unreimbursed' THEN 'unreimbursed'
      ELSE reimbursement_status
    END;

ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_claims FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_claims_select_policy" ON public.expense_claims;
CREATE POLICY "expense_claims_select_policy"
  ON public.expense_claims FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (
      company_id = public.current_company_id()
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'department_manager', 'branch_manager'])
    )
  );

DROP POLICY IF EXISTS "expense_claims_manage_policy" ON public.expense_claims;
CREATE POLICY "expense_claims_manage_policy"
  ON public.expense_claims FOR ALL
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (
      company_id = public.current_company_id()
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
    )
  )
  WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (
      company_id = public.current_company_id()
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
    )
  );

-- ============================================================================
-- STEP 4: MULTI-LINE EXPENSE CLAIM ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expense_claim_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.expense_claims(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  item_date date NOT NULL,
  merchant_name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SAR',
  exchange_rate numeric(12,6) NOT NULL DEFAULT 1.000000,
  converted_amount numeric(12,2) NOT NULL,
  description text NOT NULL,
  receipt_file_id uuid,
  receipt_url text,
  receipt_hash text,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  policy_warning_triggered boolean NOT NULL DEFAULT false,
  policy_warning_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_claim_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_claim_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_claim_items_select_policy" ON public.expense_claim_items;
CREATE POLICY "expense_claim_items_select_policy"
  ON public.expense_claim_items FOR SELECT
  TO authenticated
  USING (
    claim_id IN (
      SELECT ec.id FROM public.expense_claims ec
      WHERE ec.employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
         OR (
           ec.company_id = public.current_company_id()
           AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'department_manager', 'branch_manager'])
         )
    )
  );

DROP POLICY IF EXISTS "expense_claim_items_manage_policy" ON public.expense_claim_items;
CREATE POLICY "expense_claim_items_manage_policy"
  ON public.expense_claim_items FOR ALL
  TO authenticated
  USING (
    claim_id IN (
      SELECT ec.id FROM public.expense_claims ec
      WHERE ec.employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
         OR (
           ec.company_id = public.current_company_id()
           AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
         )
    )
  )
  WITH CHECK (
    claim_id IN (
      SELECT ec.id FROM public.expense_claims ec
      WHERE ec.employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
         OR (
           ec.company_id = public.current_company_id()
           AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
         )
    )
  );

-- ============================================================================
-- STEP 5: REIMBURSEMENT BATCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reimbursement_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  batch_number text NOT NULL UNIQUE,
  period_key text NOT NULL,
  payment_method text NOT NULL DEFAULT 'direct_bank_transfer' CHECK (payment_method IN ('direct_bank_transfer', 'payroll', 'cash')),
  currency text NOT NULL DEFAULT 'SAR',
  bank_account_id uuid REFERENCES public.company_bank_accounts(id) ON DELETE RESTRICT,
  total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  total_claims_count integer NOT NULL DEFAULT 0,
  total_employees_count integer NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'prepared' CHECK (payment_status IN ('prepared', 'approved_for_payment', 'submitted', 'transferred_to_payroll', 'confirmed_paid', 'failed', 'reversed')),
  prepared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  reversed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reversed_at timestamptz,
  reversal_reason text,
  bank_reference text,
  idempotency_key text UNIQUE,
  payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  journal_entry_id uuid REFERENCES public.accounting_journals(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign key link from expense_claims to reimbursement_batches
ALTER TABLE public.expense_claims
  DROP CONSTRAINT IF EXISTS fk_expense_claims_batch,
  ADD CONSTRAINT fk_expense_claims_batch
    FOREIGN KEY (reimbursement_batch_id) REFERENCES public.reimbursement_batches(id) ON DELETE SET NULL;

ALTER TABLE public.reimbursement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursement_batches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reimbursement_batches_select_policy" ON public.reimbursement_batches;
CREATE POLICY "reimbursement_batches_select_policy"
  ON public.reimbursement_batches FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'payroll_officer'])
  );

DROP POLICY IF EXISTS "reimbursement_batches_manage_policy" ON public.reimbursement_batches;
CREATE POLICY "reimbursement_batches_manage_policy"
  ON public.reimbursement_batches FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer'])
  );

-- ============================================================================
-- STEP 6: EXPENSE REIMBURSEMENT ALLOCATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expense_reimbursement_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.reimbursement_batches(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.expense_claims(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'allocated' CHECK (status IN ('allocated', 'paid', 'transferred_to_payroll', 'failed', 'reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, claim_id)
);

ALTER TABLE public.expense_reimbursement_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_reimbursement_allocations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_reimbursement_allocations_select" ON public.expense_reimbursement_allocations;
CREATE POLICY "expense_reimbursement_allocations_select"
  ON public.expense_reimbursement_allocations FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR (
      batch_id IN (SELECT id FROM public.reimbursement_batches WHERE company_id = public.current_company_id())
      AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'payroll_officer'])
    )
  );

-- ============================================================================
-- STEP 7: EXPENSE AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expense_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES public.expense_claims(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.reimbursement_batches(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  policy_id uuid REFERENCES public.expense_policies(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  previous_state jsonb,
  new_state jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_audit_logs_select" ON public.expense_audit_logs;
CREATE POLICY "expense_audit_logs_select"
  ON public.expense_audit_logs FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'auditor'])
  );

-- ============================================================================
-- STEP 8: EXPENSE ACCOUNTING CONFIGS & CURRENCY RATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expense_accounting_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  default_expense_account text NOT NULL DEFAULT '510100',
  employee_payable_account text NOT NULL DEFAULT '210200',
  bank_clearing_account text NOT NULL DEFAULT '110100',
  vat_input_tax_account text NOT NULL DEFAULT '110500',
  corporate_card_payable_account text NOT NULL DEFAULT '210300',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_accounting_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_accounting_configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_accounting_configs_select" ON public.expense_accounting_configs;
CREATE POLICY "expense_accounting_configs_select"
  ON public.expense_accounting_configs FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

CREATE TABLE IF NOT EXISTS public.currency_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_currency text NOT NULL,
  to_currency text NOT NULL DEFAULT 'SAR',
  rate numeric(12,6) NOT NULL CHECK (rate > 0),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, from_currency, to_currency, effective_date)
);

ALTER TABLE public.currency_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_exchange_rates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "currency_exchange_rates_select" ON public.currency_exchange_rates;
CREATE POLICY "currency_exchange_rates_select"
  ON public.currency_exchange_rates FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id() OR company_id IS NULL);

-- Seed default exchange rates for standard companies
INSERT INTO public.currency_exchange_rates (company_id, from_currency, to_currency, rate, effective_date)
SELECT c.id, curr.from_c, 'SAR', curr.r, CURRENT_DATE
FROM public.companies c
CROSS JOIN (
  VALUES 
    ('SAR', 1.000000),
    ('USD', 3.750000),
    ('EUR', 4.100000),
    ('GBP', 4.800000),
    ('AED', 1.020000),
    ('KWD', 12.200000),
    ('BHD', 9.950000),
    ('OMR', 9.740000),
    ('QAR', 1.030000),
    ('EGP', 0.076000)
) AS curr(from_c, r)
ON CONFLICT (company_id, from_currency, to_currency, effective_date) DO NOTHING;

-- Seed default accounting configs for standard companies
INSERT INTO public.expense_accounting_configs (company_id)
SELECT c.id FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

-- ============================================================================
-- STEP 9: ATOMIC RPC - VALIDATE EXPENSE CLAIM
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_expense_claim_atomic(
  p_employee_id uuid,
  p_payment_method text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee public.employees%ROWTYPE;
  v_item jsonb;
  v_item_cat_id uuid;
  v_item_amount numeric(12,2);
  v_item_currency text;
  v_item_date date;
  v_item_merchant text;
  v_item_receipt_url text;
  v_item_receipt_file_id text;
  v_cat public.expense_categories%ROWTYPE;
  v_policy public.expense_policies%ROWTYPE;
  v_total_amount numeric(12,2) := 0;
  v_total_converted numeric(12,2) := 0;
  v_exchange_rate numeric(12,6);
  v_warnings text[] := ARRAY[]::text[];
  v_errors text[] := ARRAY[]::text[];
  v_dup_found boolean := false;
  v_dup_claim_id uuid := NULL;
  v_month_start date;
  v_monthly_spent numeric(12,2) := 0;
BEGIN
  -- 1. Validate employee
  SELECT * INTO v_employee FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'errors', jsonb_build_array('الموظف غير موجود أو غير مصرح له بتقديم مطالبات'),
      'warnings', jsonb_build_array()
    );
  END IF;

  IF v_employee.status NOT IN ('active', 'probation') THEN
    v_errors := array_append(v_errors, 'لا يمكن تقديم مصروفات لموظف غير نشط على رأس العمل');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'errors', jsonb_build_array('يجب أن تحتوي المطالبة على بند مصروفات واحد على الأقل'),
      'warnings', jsonb_build_array()
    );
  END IF;

  -- 2. Validate items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_cat_id := (v_item->>'categoryId')::uuid;
    v_item_amount := (v_item->>'amount')::numeric;
    v_item_currency := COALESCE(v_item->>'currency', 'SAR');
    v_item_date := (v_item->>'itemDate')::date;
    v_item_merchant := COALESCE(v_item->>'merchantName', '');
    v_item_receipt_url := v_item->>'receiptUrl';
    v_item_receipt_file_id := v_item->>'receiptFileId';

    IF v_item_amount IS NULL OR v_item_amount <= 0 THEN
      v_errors := array_append(v_errors, 'مبلغ البند يجب أن يكون أكبر من الصفر');
    END IF;

    -- Lookup Category
    SELECT * INTO v_cat FROM public.expense_categories WHERE id = v_item_cat_id;
    IF NOT FOUND THEN
      v_errors := array_append(v_errors, 'فئة المصروف المحددة غير موجودة');
    ELSE
      IF NOT v_cat.is_active THEN
        v_errors := array_append(v_errors, 'فئة المصروف ' || v_cat.name_ar || ' غير مفعّلة حالياً');
      END IF;

      -- Check Warning & Blocking Limits from Category
      IF v_item_amount > v_cat.max_limit_block THEN
        v_errors := array_append(v_errors, 'المبلغ في فئة (' || v_cat.name_ar || ') يتجاوز الحد المانع البالغ ' || v_cat.max_limit_block || ' ' || v_cat.currency);
      ELSIF v_item_amount > v_cat.max_limit_warning THEN
        v_warnings := array_append(v_warnings, 'المبلغ في فئة (' || v_cat.name_ar || ') يتجاوز سقف التحذير (' || v_cat.max_limit_warning || ' ' || v_cat.currency || ') ويتطلب تصعيداً في الاعتماد');
      END IF;

      -- Check Receipt Requirement
      IF v_cat.requires_receipt AND (v_item_receipt_url IS NULL AND v_item_receipt_file_id IS NULL) THEN
        v_errors := array_append(v_errors, 'إرفاق الفاتورة أو الإيصال إلزامي لفئة (' || v_cat.name_ar || ')');
      END IF;
    END IF;

    -- Check Currency & Conversion
    IF v_item_currency = 'SAR' THEN
      v_exchange_rate := 1.0;
    ELSE
      SELECT rate INTO v_exchange_rate
      FROM public.currency_exchange_rates
      WHERE company_id = v_employee.company_id
        AND from_currency = v_item_currency
        AND to_currency = 'SAR'
        AND is_active = true
      ORDER BY effective_date DESC LIMIT 1;

      IF v_exchange_rate IS NULL THEN
        -- Fallback default for standard currencies
        v_exchange_rate := CASE v_item_currency
          WHEN 'USD' THEN 3.75
          WHEN 'EUR' THEN 4.10
          WHEN 'GBP' THEN 4.80
          WHEN 'AED' THEN 1.02
          ELSE 1.0
        END;
      END IF;
    END IF;

    v_total_amount := v_total_amount + v_item_amount;
    v_total_converted := v_total_converted + (v_item_amount * v_exchange_rate);

    -- Check Future Date
    IF v_item_date > CURRENT_DATE THEN
      v_errors := array_append(v_errors, 'تاريخ المصروف لا يمكن أن يكون في المستقبل');
    END IF;

    -- Check Duplicate Submission
    SELECT eci.claim_id INTO v_dup_claim_id
    FROM public.expense_claim_items eci
    JOIN public.expense_claims ec ON ec.id = eci.claim_id
    WHERE ec.employee_id = p_employee_id
      AND eci.merchant_name ILIKE v_item_merchant
      AND eci.item_date = v_item_date
      AND eci.amount = v_item_amount
      AND ec.status NOT IN ('rejected', 'cancelled')
    LIMIT 1;

    IF v_dup_claim_id IS NULL THEN
      SELECT ec.id INTO v_dup_claim_id
      FROM public.expense_claims ec
      WHERE ec.employee_id = p_employee_id
        AND ec.merchant_name ILIKE v_item_merchant
        AND ec.spent_at = v_item_date
        AND ec.amount = v_item_amount
        AND ec.status NOT IN ('rejected', 'cancelled')
      LIMIT 1;
    END IF;

    IF v_dup_claim_id IS NOT NULL THEN
      v_dup_found := true;
      v_warnings := array_append(v_warnings, 'تنبيه: تم العثور على مصروف مماثل مسبقاً بنفس المورد والتاريخ والمبلغ (' || v_item_merchant || ' - ' || v_item_amount || ' ' || v_item_currency || ')');
    END IF;
  END LOOP;

  -- 3. Policy limits evaluation
  SELECT * INTO v_policy
  FROM public.expense_policies
  WHERE company_id = v_employee.company_id
    AND is_active = true
    AND (department_id IS NULL OR department_id = v_employee.department_id)
  ORDER BY (department_id IS NOT NULL) DESC, created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Single transaction limit check
    IF v_total_converted > v_policy.single_transaction_limit THEN
      v_warnings := array_append(v_warnings, 'إجمالي المطالبة (' || v_total_converted || ' ر.س) يتجاوز الحد المسموح به للعملية الواحدة في سياسة الشركة (' || v_policy.single_transaction_limit || ' ر.س)');
    END IF;

    -- Monthly cumulative limit check
    v_month_start := date_trunc('month', CURRENT_DATE)::date;
    SELECT COALESCE(SUM(converted_amount), 0) INTO v_monthly_spent
    FROM public.expense_claims
    WHERE employee_id = p_employee_id
      AND spent_at >= v_month_start
      AND status IN ('submitted', 'approved', 'reimbursed');

    IF (v_monthly_spent + v_total_converted) > v_policy.monthly_limit THEN
      v_warnings := array_append(v_warnings, 'إجمالي مصروفات الموظف لهذا الشهر (' || (v_monthly_spent + v_total_converted) || ' ر.س) سيتجاوز السقف الشهري المحدد في السياسة (' || v_policy.monthly_limit || ' ر.س)');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_valid', (array_length(v_errors, 1) IS NULL),
    'errors', to_jsonb(v_errors),
    'warnings', to_jsonb(v_warnings),
    'duplicate_found', v_dup_found,
    'duplicate_claim_id', v_dup_claim_id,
    'total_amount', v_total_amount,
    'total_converted', v_total_converted
  );
END;
$$;

-- ============================================================================
-- STEP 10: ATOMIC RPC - SUBMIT EXPENSE CLAIM
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_expense_claim_atomic(
  p_title text,
  p_justification text,
  p_cost_center_id uuid,
  p_project_code text,
  p_payment_method text,
  p_items jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_employee public.employees%ROWTYPE;
  v_val jsonb;
  v_claim_id uuid;
  v_claim_number text;
  v_first_item jsonb;
  v_item jsonb;
  v_total_amount numeric(12,2);
  v_total_converted numeric(12,2);
  v_currency text;
  v_exchange_rate numeric(12,6);
  v_spent_at date;
  v_merchant text;
  v_category_id uuid;
  v_is_reimbursable boolean;
  v_reimbursement_status text;
  v_has_warning boolean := false;
  v_warning_reason text := '';
  v_wf_res jsonb;
  v_wf_request_id uuid := NULL;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مصرح له (يرجى تسجيل الدخول)';
  END IF;

  -- Derive employee
  SELECT * INTO v_employee FROM public.employees WHERE user_id = v_caller_uid LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'لم يتم العثور على سجل موظف مرتبط بهذا الحساب';
  END IF;

  -- Server-side validation
  v_val := public.validate_expense_claim_atomic(v_employee.id, p_payment_method, p_items);
  IF NOT (v_val->>'is_valid')::boolean THEN
    RAISE EXCEPTION 'فشل التحقق من المطالبة: %', (v_val->'errors'->>0);
  END IF;

  v_total_amount := (v_val->>'total_amount')::numeric;
  v_total_converted := (v_val->>'total_converted')::numeric;
  IF jsonb_array_length(v_val->'warnings') > 0 THEN
    v_has_warning := true;
    v_warning_reason := v_val->'warnings'->>0;
  END IF;

  v_first_item := p_items->0;
  v_spent_at := (v_first_item->>'itemDate')::date;
  v_merchant := COALESCE(v_first_item->>'merchantName', 'مورد متعدد');
  v_category_id := (v_first_item->>'categoryId')::uuid;
  v_currency := COALESCE(v_first_item->>'currency', 'SAR');
  v_exchange_rate := CASE WHEN v_currency = 'SAR' THEN 1.0 ELSE (v_total_converted / NULLIF(v_total_amount, 0)) END;

  v_is_reimbursable := (p_payment_method = 'employee_paid');
  v_reimbursement_status := CASE WHEN v_is_reimbursable THEN 'unreimbursed' ELSE 'not_applicable' END;

  -- Generate Claim Number
  v_claim_id := gen_random_uuid();
  v_claim_number := 'EXP-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || SUBSTRING(v_claim_id::text, 1, 6);

  -- 1. Insert into expense_claims
  INSERT INTO public.expense_claims (
    id,
    company_id,
    employee_id,
    category_id,
    claim_number,
    title,
    business_justification,
    cost_center_id,
    project_code,
    payment_method,
    is_reimbursable,
    amount,
    currency,
    exchange_rate,
    settlement_currency,
    converted_amount,
    spent_at,
    merchant_name,
    receipt_url,
    receipt_file_id,
    description,
    status,
    policy_warning_triggered,
    policy_warning_reason,
    reimbursement_status,
    duplicate_flag,
    duplicate_potential_claim_id,
    created_at,
    updated_at
  ) VALUES (
    v_claim_id,
    v_employee.company_id,
    v_employee.id,
    v_category_id,
    v_claim_number,
    COALESCE(p_title, 'مطالبة مصروفات - ' || v_merchant),
    p_justification,
    p_cost_center_id,
    p_project_code,
    p_payment_method,
    v_is_reimbursable,
    v_total_amount,
    v_currency,
    COALESCE(v_exchange_rate, 1.0),
    'SAR',
    v_total_converted,
    v_spent_at,
    v_merchant,
    v_first_item->>'receiptUrl',
    (v_first_item->>'receiptFileId')::uuid,
    COALESCE(p_justification, p_title, 'مصروف أعمال'),
    'submitted',
    v_has_warning,
    v_warning_reason,
    v_reimbursement_status,
    (v_val->>'duplicate_found')::boolean,
    (v_val->>'duplicate_claim_id')::uuid,
    now(),
    now()
  );

  -- 2. Insert multi-line items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.expense_claim_items (
      claim_id,
      category_id,
      item_date,
      merchant_name,
      amount,
      currency,
      exchange_rate,
      converted_amount,
      description,
      receipt_file_id,
      receipt_url,
      receipt_hash,
      tax_amount,
      policy_warning_triggered,
      policy_warning_notes
    ) VALUES (
      v_claim_id,
      (v_item->>'categoryId')::uuid,
      (v_item->>'itemDate')::date,
      v_item->>'merchantName',
      (v_item->>'amount')::numeric,
      COALESCE(v_item->>'currency', 'SAR'),
      1.0,
      (v_item->>'amount')::numeric,
      COALESCE(v_item->>'description', 'بند مصروف'),
      (v_item->>'receiptFileId')::uuid,
      v_item->>'receiptUrl',
      v_item->>'receiptHash',
      COALESCE((v_item->>'taxAmount')::numeric, 0),
      v_has_warning,
      v_warning_reason
    );
  END LOOP;

  -- 3. Integrate with Prompt 14 Workflow Engine
  BEGIN
    v_wf_res := public.submit_workflow_request(
      p_request_type := 'expense_claim',
      p_payload := jsonb_build_object(
        'claimId', v_claim_id,
        'claimNumber', v_claim_number,
        'amount', v_total_amount,
        'convertedAmount', v_total_converted,
        'currency', v_currency,
        'merchant', v_merchant,
        'expenseCategoryId', v_category_id,
        'warningTriggered', v_has_warning,
        'isReimbursable', v_is_reimbursable,
        'paymentMethod', p_payment_method
      ),
      p_on_behalf_of_employee_id := v_employee.id,
      p_idempotency_key := p_idempotency_key
    );

    IF (v_wf_res->>'ok')::boolean THEN
      v_wf_request_id := (v_wf_res->>'request_id')::uuid;
      UPDATE public.expense_claims
      SET workflow_request_id = v_wf_request_id,
          status = 'pending_approval'
      WHERE id = v_claim_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to standard submitted status if workflow catalog entry is not mapped
    NULL;
  END;

  -- 4. Audit Log
  INSERT INTO public.expense_audit_logs (
    company_id,
    claim_id,
    action,
    actor_id,
    actor_role,
    new_state,
    notes
  ) VALUES (
    v_employee.company_id,
    v_claim_id,
    'claim_submitted',
    v_caller_uid,
    'employee',
    jsonb_build_object(
      'claimNumber', v_claim_number,
      'amount', v_total_amount,
      'currency', v_currency,
      'paymentMethod', p_payment_method,
      'workflowRequestId', v_wf_request_id
    ),
    'تم تقديم مطالبة المصروفات وربطها بمسار الاعتماد'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'claim_id', v_claim_id,
    'claim_number', v_claim_number,
    'amount', v_total_amount,
    'currency', v_currency,
    'converted_amount', v_total_converted,
    'workflow_request_id', v_wf_request_id,
    'warnings', v_val->'warnings'
  );
END;
$$;

-- ============================================================================
-- STEP 11: WORKFLOW SYNCHRONIZATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_expense_workflow_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_type = 'expense_claim' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.expense_claims
    SET status = CASE NEW.status
          WHEN 'approved' THEN 'approved'
          WHEN 'rejected' THEN 'rejected'
          WHEN 'returned' THEN 'returned'
          WHEN 'cancelled' THEN 'cancelled'
          WHEN 'pending_approval' THEN 'pending_approval'
          ELSE status
        END,
        reimbursement_status = CASE 
          WHEN NEW.status = 'approved' AND is_reimbursable THEN 'unreimbursed'
          ELSE reimbursement_status
        END,
        updated_at = now()
    WHERE workflow_request_id = NEW.id;

    -- Audit log
    INSERT INTO public.expense_audit_logs (
      company_id,
      claim_id,
      action,
      actor_id,
      notes
    )
    SELECT
      ec.company_id,
      ec.id,
      'workflow_decision_' || NEW.status,
      NEW.decided_by,
      'تحديث حالة المطالبة تلقائياً من محرك الموافقات: ' || NEW.status
    FROM public.expense_claims ec
    WHERE ec.workflow_request_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_expense_workflow ON public.requests;
CREATE TRIGGER trg_sync_expense_workflow
  AFTER UPDATE OF status ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_expense_workflow_status();

-- ============================================================================
-- STEP 12: ATOMIC RPC - PREPARE REIMBURSEMENT BATCH
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prepare_reimbursement_batch_atomic(
  p_period_key text,
  p_claim_ids uuid[],
  p_payment_method text DEFAULT 'direct_bank_transfer',
  p_bank_account_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_company_id uuid;
  v_batch_id uuid;
  v_batch_number text;
  v_claim record;
  v_total_amount numeric(14,2) := 0;
  v_claims_count integer := 0;
  v_employees_count integer := 0;
  v_distinct_employees uuid[] := ARRAY[]::uuid[];
  v_existing_id uuid;
  v_existing_no text;
  v_existing_tot numeric(14,2);
BEGIN
  v_caller_uid := auth.uid();
  v_company_id := public.current_company_id();

  IF v_caller_uid IS NOT NULL AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'hr_manager', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح للمستخدم بتجهيز دفعات الصرف المالي';
  END IF;

  IF p_claim_ids IS NULL OR array_length(p_claim_ids, 1) = 0 THEN
    RAISE EXCEPTION 'يجب تحديد مطالبة واحدة على الأقل لإدراجها في دفعة الصرف';
  END IF;

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, batch_number, total_amount INTO v_existing_id, v_existing_no, v_existing_tot
    FROM public.reimbursement_batches
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'batch_id', v_existing_id,
        'batch_number', v_existing_no,
        'total_amount', v_existing_tot,
        'is_duplicate_call', true
      );
    END IF;
  END IF;

  -- Generate batch number
  v_batch_id := gen_random_uuid();
  v_batch_number := 'REIMB-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || SUBSTRING(v_batch_id::text, 1, 6);

  -- Verify all claims eligibility
  FOR v_claim IN
    SELECT id, employee_id, amount, converted_amount, status, payment_method, reimbursement_status, company_id
    FROM public.expense_claims
    WHERE id = ANY(p_claim_ids)
    FOR UPDATE
  LOOP
    -- Company isolation
    IF v_company_id IS NOT NULL AND v_claim.company_id IS NOT NULL AND v_claim.company_id != v_company_id THEN
      RAISE EXCEPTION 'المطالبة % لا تنتمي لنفس الشركة المصرح بها', v_claim.id;
    END IF;

    -- Must be approved
    IF v_claim.status != 'approved' THEN
      RAISE EXCEPTION 'المطالبة % غير معتمدة نهائياً (حالتها: %)', v_claim.id, v_claim.status;
    END IF;

    -- Must be employee-paid
    IF v_claim.payment_method != 'employee_paid' THEN
      RAISE EXCEPTION 'المطالبة % مدفوعة مسبقاً من الشركة أو بالبطاقة المؤسسية ولا تخضع للصرف للموظف', v_claim.id;
    END IF;

    -- Must not already be queued or reimbursed
    IF v_claim.reimbursement_status != 'unreimbursed' THEN
      RAISE EXCEPTION 'المطالبة % مضافة مسبقاً لدفعة صرف أو تم صرفها بالفعل (حالتها: %)', v_claim.id, v_claim.reimbursement_status;
    END IF;

    v_total_amount := v_total_amount + COALESCE(v_claim.converted_amount, v_claim.amount, 0);
    v_claims_count := v_claims_count + 1;

    IF NOT (v_claim.employee_id = ANY(v_distinct_employees)) THEN
      v_distinct_employees := array_append(v_distinct_employees, v_claim.employee_id);
    END IF;
  END LOOP;

  v_employees_count := array_length(v_distinct_employees, 1);

  -- 1. Create reimbursement batch
  INSERT INTO public.reimbursement_batches (
    id,
    company_id,
    batch_number,
    period_key,
    payment_method,
    currency,
    bank_account_id,
    total_amount,
    total_claims_count,
    total_employees_count,
    payment_status,
    prepared_by,
    prepared_at,
    idempotency_key,
    notes
  ) VALUES (
    v_batch_id,
    COALESCE(v_company_id, (SELECT id FROM public.companies LIMIT 1)),
    v_batch_number,
    p_period_key,
    p_payment_method,
    'SAR',
    p_bank_account_id,
    v_total_amount,
    v_claims_count,
    v_employees_count,
    'prepared',
    v_caller_uid,
    now(),
    p_idempotency_key,
    p_notes
  );

  -- 2. Create allocations and lock claims
  FOR v_claim IN
    SELECT id, employee_id, amount, converted_amount
    FROM public.expense_claims
    WHERE id = ANY(p_claim_ids)
  LOOP
    INSERT INTO public.expense_reimbursement_allocations (
      batch_id,
      claim_id,
      employee_id,
      amount,
      currency,
      status
    ) VALUES (
      v_batch_id,
      v_claim.id,
      v_claim.employee_id,
      COALESCE(v_claim.converted_amount, v_claim.amount, 0),
      'SAR',
      'allocated'
    );

    UPDATE public.expense_claims
    SET reimbursement_status = 'queued_in_batch',
        reimbursement_batch_id = v_batch_id,
        updated_at = now()
    WHERE id = v_claim.id;
  END LOOP;

  -- 3. Write Audit Log
  INSERT INTO public.expense_audit_logs (
    company_id,
    batch_id,
    action,
    actor_id,
    notes,
    new_state
  ) VALUES (
    COALESCE(v_company_id, (SELECT id FROM public.companies LIMIT 1)),
    v_batch_id,
    'reimbursement_batch_prepared',
    v_caller_uid,
    'تم تجهيز دفعة صرف للمصروفات المعتمدة',
    jsonb_build_object(
      'batchNumber', v_batch_number,
      'totalAmount', v_total_amount,
      'claimsCount', v_claims_count,
      'employeesCount', v_employees_count
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'batch_number', v_batch_number,
    'total_amount', v_total_amount,
    'claims_count', v_claims_count,
    'employees_count', v_employees_count
  );
END;
$$;

-- ============================================================================
-- STEP 13: ATOMIC RPC - APPROVE REIMBURSEMENT BATCH FOR PAYMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_reimbursement_batch_for_payment_atomic(
  p_batch_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_batch public.reimbursement_batches%ROWTYPE;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح للمستخدم باعتماد دفعات الصرف المالي';
  END IF;

  SELECT * INTO v_batch FROM public.reimbursement_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'دفعة الصرف غير موجودة';
  END IF;

  IF v_batch.payment_status != 'prepared' THEN
    RAISE EXCEPTION 'لا يمكن اعتماد الدفعة لأن حالتها الحالية هي: %', v_batch.payment_status;
  END IF;

  UPDATE public.reimbursement_batches
  SET payment_status = 'approved_for_payment',
      approved_by = v_caller_uid,
      approved_at = now(),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_batch_id;

  UPDATE public.expense_claims
  SET reimbursement_status = 'approved_for_payment',
      updated_at = now()
  WHERE reimbursement_batch_id = p_batch_id;

  INSERT INTO public.expense_audit_logs (
    company_id,
    batch_id,
    action,
    actor_id,
    notes
  ) VALUES (
    v_batch.company_id,
    p_batch_id,
    'reimbursement_batch_approved',
    v_caller_uid,
    'تم اعتماد دفعة المصروفات وجاهزة للإرسال البنكي أو الصرف الفعلي'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'status', 'approved_for_payment'
  );
END;
$$;

-- ============================================================================
-- STEP 14: ATOMIC RPC - CONFIRM REIMBURSEMENT PAYMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_reimbursement_payment_atomic(
  p_batch_id uuid,
  p_bank_reference text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_batch public.reimbursement_batches%ROWTYPE;
  v_bank public.company_bank_accounts%ROWTYPE;
  v_acc_config public.expense_accounting_configs%ROWTYPE;
  v_journal_id uuid := NULL;
  v_journal_no text;
  v_claim_id uuid;
  v_alloc public.expense_reimbursement_allocations%ROWTYPE;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح للمستخدم بتأكيد العمليات المالية للصرف';
  END IF;

  SELECT * INTO v_batch FROM public.reimbursement_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'دفعة الصرف غير موجودة';
  END IF;

  IF v_batch.payment_status NOT IN ('prepared', 'approved_for_payment', 'submitted') THEN
    RAISE EXCEPTION 'لا يمكن تأكيد سداد دفعة بحالة: %', v_batch.payment_status;
  END IF;

  -- Bank Account validation & debit if specified
  IF v_batch.bank_account_id IS NOT NULL THEN
    SELECT * INTO v_bank FROM public.company_bank_accounts WHERE id = v_batch.bank_account_id FOR UPDATE;
    IF FOUND THEN
      IF v_bank.current_balance < v_batch.total_amount THEN
        RAISE EXCEPTION 'الرصيد المتاح في الحساب البنكي (% ر.س) غير كافٍ لسداد إجمالي الدفعة (% ر.س)', v_bank.current_balance, v_batch.total_amount;
      END IF;

      -- Debit balance
      UPDATE public.company_bank_accounts
      SET current_balance = current_balance - v_batch.total_amount,
          updated_at = now()
      WHERE id = v_bank.id;
    END IF;
  END IF;

  -- Accounting Journal Integration (Section 19: Journal-Ready Entry)
  SELECT * INTO v_acc_config FROM public.expense_accounting_configs WHERE company_id = v_batch.company_id;
  IF FOUND THEN
    v_journal_id := gen_random_uuid();
    v_journal_no := 'JRN-REIMB-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || SUBSTRING(v_journal_id::text, 1, 6);

    BEGIN
      INSERT INTO public.accounting_journals (
        id,
        journal_no,
        source_type,
        source_reference,
        journal_date,
        total_debit,
        total_credit,
        lines,
        status,
        posted_at
      ) VALUES (
        v_journal_id,
        v_journal_no,
        'expense_reimbursement',
        v_batch.batch_number,
        CURRENT_DATE,
        v_batch.total_amount,
        v_batch.total_amount,
        jsonb_build_array(
          jsonb_build_object(
            'accountCode', v_acc_config.employee_payable_account,
            'accountName', 'مستحقات تعويضات الموظفين',
            'debit', v_batch.total_amount,
            'credit', 0,
            'notes', 'سداد تعويضات المصروفات للموظفين - دفعة ' || v_batch.batch_number
          ),
          jsonb_build_object(
            'accountCode', v_acc_config.bank_clearing_account,
            'accountName', 'حساب البنك / وسيط السداد',
            'debit', 0,
            'credit', v_batch.total_amount,
            'notes', 'صرف بنكي مرجعي: ' || COALESCE(p_bank_reference, 'حوالة مصرفية')
          )
        ),
        'posted',
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      -- If journal fails or table mismatch, don't block payment finalization
      v_journal_id := NULL;
    END;
  END IF;

  -- 1. Mark Batch Confirmed Paid
  UPDATE public.reimbursement_batches
  SET payment_status = 'confirmed_paid',
      confirmed_by = v_caller_uid,
      confirmed_at = now(),
      bank_reference = p_bank_reference,
      journal_entry_id = v_journal_id,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_batch_id;

  -- 2. Mark Allocations and Claims Reimbursed
  FOR v_alloc IN SELECT * FROM public.expense_reimbursement_allocations WHERE batch_id = p_batch_id
  LOOP
    UPDATE public.expense_reimbursement_allocations
    SET status = 'paid'
    WHERE id = v_alloc.id;

    UPDATE public.expense_claims
    SET reimbursement_status = 'reimbursed',
        reimbursed_at = now(),
        reimbursed_amount = v_alloc.amount,
        reimbursement_method = v_batch.payment_method,
        updated_at = now()
    WHERE id = v_alloc.claim_id;
  END LOOP;

  -- 3. Audit Log
  INSERT INTO public.expense_audit_logs (
    company_id,
    batch_id,
    action,
    actor_id,
    notes,
    new_state
  ) VALUES (
    v_batch.company_id,
    p_batch_id,
    'payment_confirmed',
    v_caller_uid,
    'تم تأكيد السداد الفعلي لدفعة المصروفات وقيدها بالسجلات المالية',
    jsonb_build_object(
      'bankReference', p_bank_reference,
      'amount', v_batch.total_amount,
      'journalId', v_journal_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'payment_status', 'confirmed_paid',
    'bank_reference', p_bank_reference,
    'journal_id', v_journal_id,
    'total_paid', v_batch.total_amount
  );
END;
$$;

-- ============================================================================
-- STEP 15: ATOMIC RPC - REVERSE REIMBURSEMENT BATCH
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reverse_reimbursement_batch_atomic(
  p_batch_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_batch public.reimbursement_batches%ROWTYPE;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح للمستخدم بإلغاء أو عكس دفعات الصرف المالي';
  END IF;

  SELECT * INTO v_batch FROM public.reimbursement_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'دفعة الصرف غير موجودة';
  END IF;

  IF v_batch.payment_status = 'reversed' THEN
    RAISE EXCEPTION 'الدفعة معكوسة بالفعل';
  END IF;

  -- If was confirmed paid and bank was deducted, restore bank balance
  IF v_batch.payment_status = 'confirmed_paid' AND v_batch.bank_account_id IS NOT NULL THEN
    UPDATE public.company_bank_accounts
    SET current_balance = current_balance + v_batch.total_amount,
        updated_at = now()
    WHERE id = v_batch.bank_account_id;
  END IF;

  -- Mark batch reversed
  UPDATE public.reimbursement_batches
  SET payment_status = 'reversed',
      reversed_by = v_caller_uid,
      reversed_at = now(),
      reversal_reason = p_reason,
      updated_at = now()
  WHERE id = p_batch_id;

  -- Restore claims to unreimbursed and remove batch link
  UPDATE public.expense_claims
  SET reimbursement_status = 'unreimbursed',
      reimbursement_batch_id = NULL,
      reimbursed_at = NULL,
      reimbursed_amount = NULL,
      updated_at = now()
  WHERE reimbursement_batch_id = p_batch_id;

  -- Mark allocations reversed
  UPDATE public.expense_reimbursement_allocations
  SET status = 'reversed'
  WHERE batch_id = p_batch_id;

  INSERT INTO public.expense_audit_logs (
    company_id,
    batch_id,
    action,
    actor_id,
    notes
  ) VALUES (
    v_batch.company_id,
    p_batch_id,
    'batch_reversed',
    v_caller_uid,
    'تم عكس دفعة المصروفات: ' || p_reason
  );

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'status', 'reversed'
  );
END;
$$;

-- ============================================================================
-- STEP 16: ATOMIC RPC - TRANSFER REIMBURSEMENT TO PAYROLL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transfer_reimbursement_to_payroll_atomic(
  p_batch_id uuid,
  p_payroll_run_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_batch public.reimbursement_batches%ROWTYPE;
  v_run public.payroll_runs%ROWTYPE;
  v_alloc record;
  v_transferred_count integer := 0;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'payroll_officer', 'finance_officer']) THEN
    RAISE EXCEPTION 'غير مصرح للمستخدم بترحيل تعويضات المصروفات لمسير الرواتب';
  END IF;

  SELECT * INTO v_batch FROM public.reimbursement_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'دفعة المصروفات غير موجودة';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'مسير الرواتب المحدد غير موجود';
  END IF;

  IF v_run.status = 'paid' THEN
    RAISE EXCEPTION 'لا يمكن ترحيل تعويضات لمسير رواتب تم صرفه بالفعل وإغلاقه';
  END IF;

  -- Add adjustments into payroll_adjustments preserving reimbursement classification
  FOR v_alloc IN
    SELECT a.id, a.claim_id, a.employee_id, a.amount, c.claim_number
    FROM public.expense_reimbursement_allocations a
    JOIN public.expense_claims c ON c.id = a.claim_id
    WHERE a.batch_id = p_batch_id
  LOOP
    BEGIN
      INSERT INTO public.payroll_adjustments (
        payroll_run_id,
        employee_id,
        adjustment_type,
        amount,
        notes
      ) VALUES (
        p_payroll_run_id,
        v_alloc.employee_id,
        'earning',
        v_alloc.amount,
        'تعويض مصروفات معتمد - مطالبة: ' || v_alloc.claim_number
      );
      v_transferred_count := v_transferred_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'فشل إضافة قيد تعويض المصروفات كبدل في مسير الرواتب للمطالبة %: %', v_alloc.claim_number, SQLERRM;
    END;
  END LOOP;

  -- Update batch status
  UPDATE public.reimbursement_batches
  SET payment_method = 'payroll',
      payment_status = 'transferred_to_payroll',
      payroll_run_id = p_payroll_run_id,
      updated_at = now()
  WHERE id = p_batch_id;

  -- Update claims
  UPDATE public.expense_claims
  SET reimbursement_status = 'transferred_to_payroll',
      reimbursement_method = 'payroll',
      payroll_run_id = p_payroll_run_id,
      reimbursed_amount = converted_amount,
      updated_at = now()
  WHERE reimbursement_batch_id = p_batch_id;

  INSERT INTO public.expense_audit_logs (
    company_id,
    batch_id,
    action,
    actor_id,
    notes
  ) VALUES (
    v_batch.company_id,
    p_batch_id,
    'payroll_transferred',
    v_caller_uid,
    'تم ترحيل مبالغ التعويض بنجاح لمسير الرواتب رقم ' || p_payroll_run_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'payroll_run_id', p_payroll_run_id,
    'transferred_count', v_transferred_count
  );
END;
$$;

-- ============================================================================
-- STEP 17: ATOMIC RPC - RESUBMIT EXPENSE CLAIM
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resubmit_expense_claim_atomic(
  p_claim_id uuid,
  p_items jsonb,
  p_justification text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_claim public.expense_claims%ROWTYPE;
  v_employee public.employees%ROWTYPE;
  v_val jsonb;
  v_item jsonb;
  v_total_amount numeric(12,2);
  v_total_converted numeric(12,2);
BEGIN
  v_caller_uid := auth.uid();
  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'المطالبة غير موجودة';
  END IF;

  SELECT * INTO v_employee FROM public.employees WHERE id = v_claim.employee_id;
  IF v_caller_uid IS NOT NULL AND v_employee.user_id != v_caller_uid THEN
    RAISE EXCEPTION 'غير مصرح لك بإعادة تقديم هذه المطالبة';
  END IF;

  IF v_claim.status != 'returned' THEN
    RAISE EXCEPTION 'لا يمكن إعادة تقديم مطالبة إلا إذا كانت معادة للموظف للتعديل (حالتها: %)', v_claim.status;
  END IF;

  -- Validate updated items
  v_val := public.validate_expense_claim_atomic(v_claim.employee_id, v_claim.payment_method, p_items);
  IF NOT (v_val->>'is_valid')::boolean THEN
    RAISE EXCEPTION 'فشل التحقق من بنود المطالبة المحدثة: %', (v_val->'errors'->>0);
  END IF;

  v_total_amount := (v_val->>'total_amount')::numeric;
  v_total_converted := (v_val->>'total_converted')::numeric;

  -- Delete existing items and re-insert
  DELETE FROM public.expense_claim_items WHERE claim_id = p_claim_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.expense_claim_items (
      claim_id,
      category_id,
      item_date,
      merchant_name,
      amount,
      currency,
      exchange_rate,
      converted_amount,
      description,
      receipt_file_id,
      receipt_url,
      tax_amount
    ) VALUES (
      p_claim_id,
      (v_item->>'categoryId')::uuid,
      (v_item->>'itemDate')::date,
      v_item->>'merchantName',
      (v_item->>'amount')::numeric,
      COALESCE(v_item->>'currency', 'SAR'),
      1.0,
      (v_item->>'amount')::numeric,
      COALESCE(v_item->>'description', 'بند مصروف محدث'),
      (v_item->>'receiptFileId')::uuid,
      v_item->>'receiptUrl',
      COALESCE((v_item->>'taxAmount')::numeric, 0)
    );
  END LOOP;

  -- Update Claim Record
  UPDATE public.expense_claims
  SET amount = v_total_amount,
      converted_amount = v_total_converted,
      business_justification = COALESCE(p_justification, business_justification),
      version = version + 1,
      status = 'pending_approval',
      updated_at = now()
  WHERE id = p_claim_id;

  -- Resubmit in workflow if workflow_request_id exists
  IF v_claim.workflow_request_id IS NOT NULL THEN
    BEGIN
      PERFORM public.resubmit_workflow_request(
        v_claim.workflow_request_id,
        jsonb_build_object(
          'amount', v_total_amount,
          'convertedAmount', v_total_converted,
          'note', p_note
        ),
        p_note
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  INSERT INTO public.expense_audit_logs (
    company_id,
    claim_id,
    action,
    actor_id,
    notes,
    new_state
  ) VALUES (
    v_claim.company_id,
    p_claim_id,
    'claim_resubmitted',
    v_caller_uid,
    'تمت إعادة تقديم المطالبة بعد تعديل البيانات: ' || COALESCE(p_note, ''),
    jsonb_build_object('version', v_claim.version + 1, 'amount', v_total_amount)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'claim_id', p_claim_id,
    'version', v_claim.version + 1,
    'amount', v_total_amount
  );
END;
$$;

-- ============================================================================
-- STEP 18: ATOMIC RPC - EXPENSE KPIS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_expense_kpis_atomic(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_total_submitted numeric(14,2) := 0;
  v_submitted_count integer := 0;
  v_pending_count integer := 0;
  v_approved_count integer := 0;
  v_approved_amount numeric(14,2) := 0;
  v_rejected_count integer := 0;
  v_returned_count integer := 0;
  v_awaiting_reimb_count integer := 0;
  v_awaiting_reimb_amount numeric(14,2) := 0;
  v_confirmed_reimb_amount numeric(14,2) := 0;
  v_confirmed_reimb_count integer := 0;
  v_categories jsonb := '[]'::jsonb;
  v_departments jsonb := '[]'::jsonb;
BEGIN
  v_company_id := COALESCE(p_company_id, public.current_company_id());

  -- Aggregate counts & amounts
  SELECT
    COALESCE(SUM(converted_amount), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('submitted', 'pending_approval')),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COALESCE(SUM(converted_amount) FILTER (WHERE status = 'approved'), 0),
    COUNT(*) FILTER (WHERE status = 'rejected'),
    COUNT(*) FILTER (WHERE status = 'returned'),
    COUNT(*) FILTER (WHERE status = 'approved' AND is_reimbursable AND reimbursement_status IN ('unreimbursed', 'queued_in_batch', 'approved_for_payment')),
    COALESCE(SUM(converted_amount) FILTER (WHERE status = 'approved' AND is_reimbursable AND reimbursement_status IN ('unreimbursed', 'queued_in_batch', 'approved_for_payment')), 0),
    COUNT(*) FILTER (WHERE reimbursement_status IN ('reimbursed', 'transferred_to_payroll')),
    COALESCE(SUM(COALESCE(reimbursed_amount, converted_amount)) FILTER (WHERE reimbursement_status IN ('reimbursed', 'transferred_to_payroll')), 0)
  INTO
    v_total_submitted,
    v_submitted_count,
    v_pending_count,
    v_approved_count,
    v_approved_amount,
    v_rejected_count,
    v_returned_count,
    v_awaiting_reimb_count,
    v_awaiting_reimb_amount,
    v_confirmed_reimb_count,
    v_confirmed_reimb_amount
  FROM public.expense_claims
  WHERE (v_company_id IS NULL OR company_id = v_company_id);

  -- Aggregate by Category
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'categoryId', sub.id,
      'nameAr', sub.name_ar,
      'nameEn', sub.name_en,
      'totalAmount', sub.total_amount,
      'count', sub.cnt
    )
  ), '[]'::jsonb) INTO v_categories
  FROM (
    SELECT cat.id, cat.name_ar, cat.name_en, COALESCE(SUM(ec.converted_amount), 0) AS total_amount, COUNT(ec.id) AS cnt
    FROM public.expense_categories cat
    LEFT JOIN public.expense_claims ec ON ec.category_id = cat.id AND (v_company_id IS NULL OR ec.company_id = v_company_id)
    GROUP BY cat.id, cat.name_ar, cat.name_en
  ) sub;

  -- Aggregate by Department
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'departmentId', sub.id,
      'departmentName', sub.name_ar,
      'totalAmount', sub.total_amount,
      'count', sub.cnt
    )
  ), '[]'::jsonb) INTO v_departments
  FROM (
    SELECT d.id, d.name_ar, COALESCE(SUM(ec.converted_amount), 0) AS total_amount, COUNT(ec.id) AS cnt
    FROM public.departments d
    JOIN public.employees e ON e.department_id = d.id
    JOIN public.expense_claims ec ON ec.employee_id = e.id AND (v_company_id IS NULL OR ec.company_id = v_company_id)
    GROUP BY d.id, d.name_ar
  ) sub;

  RETURN jsonb_build_object(
    'totalSubmittedAmount', v_total_submitted,
    'totalSubmittedCount', v_submitted_count,
    'pendingApprovalCount', v_pending_count,
    'approvedCount', v_approved_count,
    'approvedAmount', v_approved_amount,
    'rejectedCount', v_rejected_count,
    'returnedCount', v_returned_count,
    'awaitingReimbursementCount', v_awaiting_reimb_count,
    'awaitingReimbursementAmount', v_awaiting_reimb_amount,
    'confirmedReimbursedCount', v_confirmed_reimb_count,
    'confirmedReimbursedAmount', v_confirmed_reimb_amount,
    'categoriesBreakdown', v_categories,
    'departmentsBreakdown', v_departments
  );
END;
$$;

-- ============================================================================
-- STEP 19: GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_policies TO authenticated;
GRANT ALL ON public.expense_policies TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_claims TO authenticated;
GRANT ALL ON public.expense_claims TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_claim_items TO authenticated;
GRANT ALL ON public.expense_claim_items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reimbursement_batches TO authenticated;
GRANT ALL ON public.reimbursement_batches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_reimbursement_allocations TO authenticated;
GRANT ALL ON public.expense_reimbursement_allocations TO service_role;

GRANT SELECT, INSERT ON public.expense_audit_logs TO authenticated;
GRANT ALL ON public.expense_audit_logs TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.expense_accounting_configs TO authenticated;
GRANT ALL ON public.expense_accounting_configs TO service_role;

GRANT SELECT ON public.currency_exchange_rates TO authenticated;
GRANT ALL ON public.currency_exchange_rates TO service_role;

GRANT EXECUTE ON FUNCTION public.validate_expense_claim_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_expense_claim_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prepare_reimbursement_batch_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_reimbursement_batch_for_payment_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_reimbursement_payment_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_reimbursement_batch_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_reimbursement_to_payroll_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resubmit_expense_claim_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_expense_kpis_atomic TO authenticated, service_role;
