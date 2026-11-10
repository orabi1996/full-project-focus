-- Compatible with legacy leave tables; requires existing core tenant authorization helpers.
BEGIN;

-- Additive compatibility for the legacy leave schema; no entitlement defaults or data are changed.
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.leave_balances ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.leave_balances ADD COLUMN IF NOT EXISTS carried_over_used_days numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.leave_balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),
  year integer NOT NULL,
  transaction_type text NOT NULL,
  days numeric NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.leave_accrual_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),
  period_year integer NOT NULL,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  employees_processed integer NOT NULL DEFAULT 0,
  total_days_accrued numeric NOT NULL DEFAULT 0,
  executed_by uuid,
  executed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, leave_type_id, period_year, period_month)
);
ALTER TABLE public.leave_balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_accrual_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leave_balance_transactions, public.leave_accrual_runs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.leave_balance_transactions, public.leave_accrual_runs FROM authenticated;
GRANT SELECT ON public.leave_balance_transactions, public.leave_accrual_runs TO authenticated;
DROP POLICY IF EXISTS accrual_run_read ON public.leave_accrual_runs;
CREATE POLICY accrual_run_read ON public.leave_accrual_runs FOR SELECT TO authenticated
USING (public.can_access_core_company(company_id) AND
  (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'org_admin') OR public.has_role(auth.uid(), 'hr_manager')));
DROP POLICY IF EXISTS accrual_ledger_read ON public.leave_balance_transactions;
CREATE POLICY accrual_ledger_read ON public.leave_balance_transactions FOR SELECT TO authenticated
USING (public.can_access_core_company(company_id) AND (
  public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'org_admin') OR public.has_role(auth.uid(), 'hr_manager')
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
));

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
  v_comp_id uuid := p_company_id;
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
  v_types integer := 0;
  v_skipped integer := 0;
  v_company_now timestamp;
BEGIN
  IF v_comp_id IS NULL THEN
    SELECT e.company_id INTO v_comp_id FROM public.employees e
    WHERE e.user_id = v_user_id ORDER BY e.id LIMIT 1;
  END IF;
  IF v_user_id IS NULL OR v_comp_id IS NULL OR NOT COALESCE((
    public.has_role(v_user_id, 'super_admin')
    OR (public.can_access_core_company(v_comp_id) AND
      (public.has_role(v_user_id, 'org_admin') OR public.has_role(v_user_id, 'hr_manager')))
  ), false) THEN
    RAISE EXCEPTION 'غير مصرح: ليس لديك صلاحية تنفيذ استحقاق الإجازات لهذه المنشأة.';
  END IF;

  -- Serialize all accrual periods for a company before inspecting the run ledger.
  -- The row lock lasts for this transaction, including balance and ledger writes.
  SELECT * INTO v_company FROM public.companies WHERE id = v_comp_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'المنشأة غير موجودة';
  END IF;

  -- Item 20: Require explicit company timezone without silent Asia/Riyadh fabrication
  IF p_year IS NULL OR p_period_month IS NULL THEN
    IF (to_jsonb(v_company)->>'timezone') IS NULL OR trim((to_jsonb(v_company)->>'timezone')) = '' THEN
      RAISE EXCEPTION 'لم يتم ضبط المنطقة الزمنية للمنشأة (company.timezone). يرجى إعداد المنطقة الزمنية للمنشأة أولاً لتحديد فترة الاستحقاق.';
    END IF;

    BEGIN
      v_company_now := now() AT TIME ZONE (to_jsonb(v_company)->>'timezone');
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'المنطقة الزمنية المحددة للمنشأة غير صالحة (%s).', (to_jsonb(v_company)->>'timezone');
    END;

    v_year := COALESCE(p_year, EXTRACT(YEAR FROM v_company_now)::int);
    v_period_month := COALESCE(p_period_month, EXTRACT(MONTH FROM v_company_now)::int);
  ELSE
    v_year := p_year;
    v_period_month := p_period_month;
  END IF;

  IF v_year NOT BETWEEN 1 AND 9999 OR v_period_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'فترة الاستحقاق غير صالحة';
  END IF;

  FOR v_lt IN
    SELECT * FROM public.leave_types
    WHERE (company_id IS NULL OR company_id = v_comp_id)
      AND status = 'active'
      AND (p_leave_type_id IS NULL OR id = p_leave_type_id)
  LOOP
    v_types := v_types + 1;
    v_type_processed := 0;
    v_type_credited := 0;

    IF EXISTS (
      SELECT 1 FROM public.leave_accrual_runs
      WHERE company_id = v_comp_id
        AND leave_type_id = v_lt.id
        AND period_year = v_year
        AND period_month = v_period_month
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    FOR v_emp IN
      SELECT * FROM public.employees
      WHERE company_id = v_comp_id
        AND status::text IN ('active', 'probation', 'on_leave')
    LOOP
      SELECT * INTO v_bal
      FROM public.leave_balances
      WHERE employee_id = v_emp.id AND leave_type_id = v_lt.id AND year = v_year
      FOR UPDATE;

      IF NOT FOUND THEN
        INSERT INTO public.leave_balances (
          employee_id, leave_type_id, company_id, year,
          annual_entitlement, accrued_days, used_days, reserved_days, carried_over_days, carried_over_used_days
        ) VALUES (
          v_emp.id, v_lt.id, v_comp_id, v_year,
          COALESCE(v_lt.max_days_per_year, 0), 0, 0, 0, 0, 0
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
    'already_processed', v_types > 0 AND v_skipped = v_types,
    'year', v_year,
    'period_month', v_period_month,
    'total_processed', v_total_processed,
    'total_days_credited', v_total_credited,
    'message', format('تم تشغيل استحقاق الإجازات بنجاح لمعالجة %s موظفاً بإجمالي %s يوماً مستحقاً.', v_total_processed, v_total_credited)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_leave_accrual(integer, integer, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_leave_accrual(integer, integer, uuid, uuid) TO authenticated;
COMMIT;
