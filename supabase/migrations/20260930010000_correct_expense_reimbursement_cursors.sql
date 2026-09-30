-- ============================================================================
-- CORRECTIVE MIGRATION: REIMBURSEMENT CURSORS & PAYROLL TRANSFER INTEGRITY
-- Migration: 20260930010000_correct_expense_reimbursement_cursors.sql
-- ============================================================================

-- 1. Ensure reimbursement_batches table check constraint supports transferred_to_payroll
DO $$
BEGIN
  ALTER TABLE public.reimbursement_batches 
    DROP CONSTRAINT IF EXISTS reimbursement_batches_payment_status_check;
    
  ALTER TABLE public.reimbursement_batches 
    ADD CONSTRAINT reimbursement_batches_payment_status_check 
    CHECK (payment_status IN ('prepared', 'approved_for_payment', 'submitted', 'transferred_to_payroll', 'confirmed_paid', 'failed', 'reversed'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Correct prepare_reimbursement_batch_atomic ensuring all cursors include amount & converted_amount
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
  v_existing_id uuid;
  v_existing_no text;
  v_existing_tot numeric(14,2);
  v_batch_id uuid;
  v_batch_number text;
  v_claim record;
  v_total_amount numeric(14,2) := 0;
  v_claims_count integer := 0;
  v_distinct_employees uuid[] := ARRAY[]::uuid[];
  v_employees_count integer := 0;
  v_bank_balance numeric(14,2);
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND NOT public.current_user_has_any_role(ARRAY['super_admin', 'org_admin', 'finance_officer', 'payroll_officer']) THEN
    RAISE EXCEPTION 'غير مصرح للمستخدم بإنشاء دفعات صرف التعويضات';
  END IF;

  v_company_id := public.current_company_id();

  IF p_claim_ids IS NULL OR array_length(p_claim_ids, 1) = 0 THEN
    RAISE EXCEPTION 'يجب تحديد مطالبة واحدة على الأقل لإنشاء دفعة الصرف';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, batch_number, total_amount INTO v_existing_id, v_existing_no, v_existing_tot
    FROM public.reimbursement_batches
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'batch_id', v_existing_id,
        'batch_number', v_existing_no,
        'total_amount', v_existing_tot,
        'idempotent', true
      );
    END IF;
  END IF;

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
    idempotency_key
  ) VALUES (
    gen_random_uuid(),
    COALESCE(v_company_id, (SELECT company_id FROM public.expense_claims WHERE id = p_claim_ids[1])),
    'REIMB-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || SUBSTRING(gen_random_uuid()::text, 1, 6),
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
    p_idempotency_key
  )
  RETURNING id, batch_number INTO v_batch_id, v_batch_number;

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

  -- 3. Audit Log
  INSERT INTO public.expense_audit_logs (
    company_id,
    batch_id,
    action,
    actor_id,
    new_state,
    notes
  ) VALUES (
    COALESCE(v_company_id, (SELECT company_id FROM public.expense_claims WHERE id = p_claim_ids[1])),
    v_batch_id,
    'batch_prepared',
    v_caller_uid,
    jsonb_build_object(
      'batchNumber', v_batch_number,
      'totalAmount', v_total_amount,
      'claimsCount', v_claims_count,
      'paymentMethod', p_payment_method
    ),
    'تم تجهيز دفعة صرف تعويضات المصروفات وحجز المطالبات'
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

-- 3. Correct transfer_reimbursement_to_payroll_atomic:
--    - Failures are not silently ignored (no swallowing with NULL)
--    - Payment status is set to transferred_to_payroll (not falsely marked confirmed_paid externally)
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

  -- Add adjustments into payroll_adjustments with explicit error escalation (NEVER silently ignored!)
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

  -- Update batch status:
  -- Marked as 'transferred_to_payroll' (not confirmed_paid because external payment is NOT complete yet)
  UPDATE public.reimbursement_batches
  SET payment_method = 'payroll',
      payment_status = 'transferred_to_payroll',
      payroll_run_id = p_payroll_run_id,
      updated_at = now()
  WHERE id = p_batch_id;

  -- Update claims:
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
