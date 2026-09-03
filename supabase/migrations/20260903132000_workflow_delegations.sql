-- ============================================================================
-- Workflow delegation persistence and security hardening
-- Closes the P0 gap where approval delegations existed only in client state.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.delegation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  delegate_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked')),
  scope text NOT NULL DEFAULT 'all_requests'
    CHECK (scope IN ('all_requests', 'leave', 'expense_claim', 'loan_advance')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delegation_rules_distinct_employees
    CHECK (delegator_employee_id <> delegate_employee_id),
  CONSTRAINT delegation_rules_valid_period
    CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_delegation_rules_delegator
  ON public.delegation_rules (delegator_employee_id, status, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_delegation_rules_delegate
  ON public.delegation_rules (delegate_employee_id, status, start_date, end_date);

ALTER TABLE public.delegation_rules ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.delegation_rules TO authenticated;
GRANT ALL ON public.delegation_rules TO service_role;

DROP POLICY IF EXISTS "delegation_rules_participant_read" ON public.delegation_rules;
CREATE POLICY "delegation_rules_participant_read"
ON public.delegation_rules
FOR SELECT
TO authenticated
USING (
  public.current_user_is_hr()
  OR EXISTS (
    SELECT 1
    FROM public.employees employee
    WHERE employee.user_id = auth.uid()
      AND employee.id IN (delegator_employee_id, delegate_employee_id)
  )
);

DROP POLICY IF EXISTS "delegation_rules_owner_insert" ON public.delegation_rules;
CREATE POLICY "delegation_rules_owner_insert"
ON public.delegation_rules
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_is_hr()
  OR EXISTS (
    SELECT 1
    FROM public.employees employee
    WHERE employee.user_id = auth.uid()
      AND employee.id = delegator_employee_id
  )
);

CREATE OR REPLACE FUNCTION public.revoke_delegation_rule(_rule_id uuid)
RETURNS public.delegation_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_rule public.delegation_rules;
BEGIN
  SELECT *
  INTO target_rule
  FROM public.delegation_rules
  WHERE id = _rule_id;

  IF target_rule.id IS NULL THEN
    RAISE EXCEPTION 'Delegation rule not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.current_user_is_hr()
    OR EXISTS (
      SELECT 1
      FROM public.employees employee
      WHERE employee.user_id = auth.uid()
        AND employee.id = target_rule.delegator_employee_id
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to revoke delegation rule' USING ERRCODE = '42501';
  END IF;

  IF target_rule.status = 'revoked' THEN
    RETURN target_rule;
  END IF;

  UPDATE public.delegation_rules
  SET
    status = 'revoked',
    revoked_by = auth.uid(),
    revoked_at = now(),
    updated_at = now()
  WHERE id = _rule_id
  RETURNING * INTO target_rule;

  RETURN target_rule;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_delegation_rule(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_delegation_rule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_delegation_rule(uuid) TO service_role;

COMMIT;
