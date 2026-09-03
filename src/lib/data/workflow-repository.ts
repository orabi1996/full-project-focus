import type { SupabaseClient } from "@supabase/supabase-js";

import type { DelegationRule, Employee } from "../../types";
import { enterpriseSupabase } from "./enterprise-client";

interface DelegationRow extends Record<string, unknown> {
  id: string;
  delegator_employee_id: string;
  delegate_employee_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "active" | "expired" | "revoked";
  scope: "all_requests" | "leave" | "expense_claim" | "loan_advance";
  created_at: string;
}

type WorkflowTable<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type WorkflowDatabase = {
  public: {
    Tables: {
      delegation_rules: WorkflowTable<DelegationRow>;
    };
    Views: Record<string, never>;
    Functions: {
      revoke_delegation_rule: {
        Args: { _rule_id: string };
        Returns: DelegationRow;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const workflowSupabase = enterpriseSupabase as unknown as SupabaseClient<WorkflowDatabase>;

const employeeDisplayName = (employee: Employee | undefined, fallback: string) =>
  employee ? `${employee.firstNameAr} ${employee.lastNameAr}` : fallback;

export async function fetchDelegationRulesRecord(employees: Employee[]): Promise<DelegationRule[]> {
  const { data, error } = await workflowSupabase
    .from("delegation_rules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  const today = new Date().toISOString().split("T")[0];

  return (data ?? []).map((row) => ({
    id: row.id,
    delegatorId: row.delegator_employee_id,
    delegatorName: employeeDisplayName(employeeMap.get(row.delegator_employee_id), "مفوّض"),
    delegateId: row.delegate_employee_id,
    delegateName: employeeDisplayName(employeeMap.get(row.delegate_employee_id), "مفوّض له"),
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    status: row.status === "active" && row.end_date < today ? "expired" : row.status,
    scope: row.scope,
    createdAt: row.created_at,
  }));
}

export async function createDelegationRuleRecord(
  rule: Omit<DelegationRule, "id" | "createdAt" | "status">,
) {
  const { error } = await workflowSupabase.from("delegation_rules").insert({
    delegator_employee_id: rule.delegatorId,
    delegate_employee_id: rule.delegateId,
    start_date: rule.startDate,
    end_date: rule.endDate,
    reason: rule.reason,
    status: "active",
    scope: rule.scope,
  });

  if (error) throw new Error(error.message);
}

export async function revokeDelegationRuleRecord(id: string) {
  const { error } = await workflowSupabase.rpc("revoke_delegation_rule", { _rule_id: id });
  if (error) throw new Error(error.message);
}

export async function deleteApprovalChainRecord(id: string) {
  const { error } = await enterpriseSupabase.from("approval_chains").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
