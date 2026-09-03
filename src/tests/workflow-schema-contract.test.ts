import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const businessSchema = source(
  "../../supabase/migrations/20260831115000_business_schema.sql",
);
const delegationSchema = source(
  "../../supabase/migrations/20260903132000_workflow_delegations.sql",
);

describe("workflow persistence schema contracts", () => {
  it("persists approval chains and protects their writes with RLS", () => {
    expect(businessSchema).toContain("CREATE TABLE IF NOT EXISTS public.approval_chains");
    expect(businessSchema).toContain("ALTER TABLE public.approval_chains ENABLE ROW LEVEL SECURITY");
    expect(businessSchema).toContain('CREATE POLICY "approval_chains_hr_write"');
    expect(businessSchema).toContain("public.current_user_is_hr()");
  });

  it("persists delegation rules with participant and date integrity checks", () => {
    expect(delegationSchema).toContain("CREATE TABLE IF NOT EXISTS public.delegation_rules");
    expect(delegationSchema).toContain("delegation_rules_distinct_employees");
    expect(delegationSchema).toContain("delegation_rules_valid_period");
    expect(delegationSchema).toContain("CHECK (end_date >= start_date)");
    expect(delegationSchema).toContain("delegator_employee_id <> delegate_employee_id");
  });

  it("limits delegation visibility and creation through RLS", () => {
    expect(delegationSchema).toContain("ALTER TABLE public.delegation_rules ENABLE ROW LEVEL SECURITY");
    expect(delegationSchema).toContain('CREATE POLICY "delegation_rules_participant_read"');
    expect(delegationSchema).toContain('CREATE POLICY "delegation_rules_owner_insert"');
    expect(delegationSchema).toContain("employee.user_id = auth.uid()");
    expect(delegationSchema).not.toContain("GRANT UPDATE, DELETE ON public.delegation_rules TO authenticated");
  });

  it("revokes delegation through an authorization-checked server function", () => {
    expect(delegationSchema).toContain("CREATE OR REPLACE FUNCTION public.revoke_delegation_rule");
    expect(delegationSchema).toContain("SECURITY DEFINER");
    expect(delegationSchema).toContain("Not authorized to revoke delegation rule");
    expect(delegationSchema).toContain("revoked_by = auth.uid()");
    expect(delegationSchema).toContain("GRANT EXECUTE ON FUNCTION public.revoke_delegation_rule(uuid) TO authenticated");
  });
});
