import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "../query/query-keys";
import type {
  ApprovalChain,
  DelegationRule,
  RequestCategory,
  ServiceRequest,
} from "../../types";
import { useAuth } from "../auth/AuthContext";
import { demoStore, useDemoStore } from "../domains/demo/demo-store";
import { toast } from "sonner";
import { useCallback } from "react";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface WorkflowKpis {
  inboxPending: number;
  myPending: number;
  myApproved: number;
  myRejected: number;
  myReturned: number;
  overdueCount: number;
}

export interface WorkflowRequestFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  status?: string;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ----------------------------------------------------------------------------
// Low-Level RPC Callers
// ----------------------------------------------------------------------------

export async function fetchWorkflowInboxRecord(
  filters: WorkflowRequestFilters = {},
): Promise<PaginatedResult<ServiceRequest>> {
  const { data, error } = await (supabase as any).rpc("get_workflow_inbox_paginated", {
    p_filters: filters as Record<string, unknown>,
  });

  if (error) throw new Error(error.message);
  const res = data as {
    data: ServiceRequest[];
    total_count: number;
    page: number;
    page_size: number;
  };

  return {
    data: res?.data || [],
    totalCount: res?.total_count || 0,
    page: res?.page || 1,
    pageSize: res?.page_size || 20,
  };
}

export async function fetchMyWorkflowRequestsRecord(
  filters: WorkflowRequestFilters = {},
): Promise<PaginatedResult<ServiceRequest>> {
  const { data, error } = await (supabase as any).rpc("get_my_workflow_requests_paginated", {
    p_filters: filters as Record<string, unknown>,
  });

  if (error) throw new Error(error.message);
  const res = data as {
    data: ServiceRequest[];
    total_count: number;
    page: number;
    page_size: number;
  };

  return {
    data: res?.data || [],
    totalCount: res?.total_count || 0,
    page: res?.page || 1,
    pageSize: res?.page_size || 20,
  };
}

export async function fetchWorkflowRequestDetailRecord(
  id: string,
): Promise<ServiceRequest> {
  const { data, error } = await (supabase as any).rpc("get_workflow_request_detail", {
    p_request_id: id,
  });

  if (error) throw new Error(error.message);
  return data as unknown as ServiceRequest;
}

export async function fetchApprovalChainsRecord(
  filters: { companyId?: string; status?: string } = {},
): Promise<ApprovalChain[]> {
  let query = (supabase as any)
    .from("approval_chains")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    requestType: row.request_type as RequestCategory,
    nameAr: row.name_ar,
    nameEn: row.name_en || row.name_ar,
    scopeType: row.scope_type as ApprovalChain["scopeType"],
    scopeValues: Array.isArray(row.scope_values) ? (row.scope_values as string[]) : [],
    steps: Array.isArray(row.steps) ? (row.steps as ApprovalChain["steps"]) : [],
    isDefault: Boolean(row.is_default),
    status: row.status as ApprovalChain["status"],
    version: row.version ?? 1,
    priority: row.priority ?? 100,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    departmentId: row.department_id,
    description: row.description,
  }));
}

export async function fetchApprovalChainDetailRecord(id: string): Promise<ApprovalChain | null> {
  const { data, error } = await (supabase as any)
    .from("approval_chains")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    requestType: data.request_type as RequestCategory,
    nameAr: data.name_ar,
    nameEn: data.name_en || data.name_ar,
    scopeType: data.scope_type as ApprovalChain["scopeType"],
    scopeValues: Array.isArray(data.scope_values) ? (data.scope_values as string[]) : [],
    steps: Array.isArray(data.steps) ? (data.steps as ApprovalChain["steps"]) : [],
    isDefault: Boolean(data.is_default),
    status: data.status as ApprovalChain["status"],
    version: data.version ?? 1,
    priority: data.priority ?? 100,
    effectiveFrom: data.effective_from,
    effectiveTo: data.effective_to,
    departmentId: data.department_id,
    description: data.description,
  };
}

export async function fetchMyDelegationsRecord(): Promise<DelegationRule[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", user.user.id)
    .maybeSingle();

  if (!emp) return [];

  const { data, error } = await (supabase as any)
    .from("delegation_rules")
    .select("*, delegator:delegator_id(id, full_name, first_name_ar, last_name_ar), delegate:delegate_id(id, full_name, first_name_ar, last_name_ar)")
    .or(`delegator_id.eq.${emp.id},delegate_id.eq.${emp.id}`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    delegatorId: row.delegator_id,
    delegatorName: row.delegator?.full_name || `${row.delegator?.first_name_ar ?? ""} ${row.delegator?.last_name_ar ?? ""}`.trim() || "المدير",
    delegateId: row.delegate_id,
    delegateName: row.delegate?.full_name || `${row.delegate?.first_name_ar ?? ""} ${row.delegate?.last_name_ar ?? ""}`.trim() || "المفوض",
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason || "",
    status: row.status,
    scope: row.scope,
    createdAt: row.created_at,
  }));
}

export async function fetchDelegationsAdminRecord(
  filters: { companyId?: string } = {},
): Promise<DelegationRule[]> {
  let query = (supabase as any)
    .from("delegation_rules")
    .select("*, delegator:delegator_id(id, full_name, first_name_ar, last_name_ar), delegate:delegate_id(id, full_name, first_name_ar, last_name_ar)")
    .order("created_at", { ascending: false });

  if (filters.companyId) {
    query = query.eq("company_id", filters.companyId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    delegatorId: row.delegator_id,
    delegatorName: row.delegator?.full_name || `${row.delegator?.first_name_ar ?? ""} ${row.delegator?.last_name_ar ?? ""}`.trim() || "المدير",
    delegateId: row.delegate_id,
    delegateName: row.delegate?.full_name || `${row.delegate?.first_name_ar ?? ""} ${row.delegate?.last_name_ar ?? ""}`.trim() || "المفوض",
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason || "",
    status: row.status,
    scope: row.scope,
    createdAt: row.created_at,
  }));
}

export async function fetchWorkflowKpisRecord(
  companyId?: string,
): Promise<WorkflowKpis> {
  const { data, error } = await (supabase as any).rpc("get_workflow_kpis", {
    p_company_id: companyId || null,
  });

  if (error) throw new Error(error.message);
  return data as unknown as WorkflowKpis;
}

export async function submitWorkflowRequestRecord(payload: {
  requestType: RequestCategory;
  payload: Record<string, unknown>;
  onBehalfOfEmployeeId?: string;
  idempotencyKey?: string;
}): Promise<{ ok: boolean; requestId: string; reference: string; totalSteps: number }> {
  const { data, error } = await (supabase as any).rpc("submit_workflow_request", {
    p_request_type: payload.requestType,
    p_payload: payload.payload,
    p_on_behalf_of_employee_id: payload.onBehalfOfEmployeeId || null,
    p_idempotency_key: payload.idempotencyKey || null,
  });

  if (error) throw new Error(error.message);
  const res = data as any;
  return {
    ok: true,
    requestId: res.request_id,
    reference: res.reference,
    totalSteps: res.total_steps,
  };
}

export async function decideWorkflowRequestRecord(payload: {
  requestId: string;
  decision: "approved" | "rejected" | "returned";
  note: string;
  internalNote?: string;
  idempotencyKey?: string;
}): Promise<{ ok: boolean; status: string; step: number; isFinal: boolean }> {
  const { data, error } = await (supabase as any).rpc("decide_workflow_request", {
    p_request_id: payload.requestId,
    p_decision: payload.decision,
    p_note: payload.note,
    p_internal_note: payload.internalNote || null,
    p_idempotency_key: payload.idempotencyKey || null,
  });

  if (error) throw new Error(error.message);
  const res = data as any;
  return {
    ok: true,
    status: res.status,
    step: res.step,
    isFinal: res.is_final,
  };
}

export async function resubmitWorkflowRequestRecord(payload: {
  requestId: string;
  payload: Record<string, unknown>;
  note?: string;
}): Promise<{ ok: boolean; requestId: string; reference: string; revision: number }> {
  const { data, error } = await (supabase as any).rpc("resubmit_workflow_request", {
    p_request_id: payload.requestId,
    p_payload: payload.payload,
    p_note: payload.note || null,
  });

  if (error) throw new Error(error.message);
  const res = data as any;
  return {
    ok: true,
    requestId: res.request_id,
    reference: res.reference,
    revision: res.revision,
  };
}

export async function withdrawWorkflowRequestRecord(payload: {
  requestId: string;
  reason: string;
}): Promise<{ ok: boolean; requestId: string; status: string }> {
  const { data, error } = await (supabase as any).rpc("withdraw_workflow_request", {
    p_request_id: payload.requestId,
    p_reason: payload.reason,
  });

  if (error) throw new Error(error.message);
  const res = data as any;
  return {
    ok: true,
    requestId: res.request_id,
    status: res.status,
  };
}

export async function createDelegationRuleAtomicRecord(payload: {
  delegateId: string;
  startDate: string;
  endDate: string;
  scope: string;
  requestTypes?: string[];
  reason?: string;
}): Promise<{ ok: boolean; id: string }> {
  const { data, error } = await (supabase as any).rpc("create_delegation_rule_atomic", {
    p_delegate_id: payload.delegateId,
    p_start_date: payload.startDate,
    p_end_date: payload.endDate,
    p_scope: payload.scope,
    p_request_types: payload.requestTypes || [],
    p_reason: payload.reason || "",
  });

  if (error) throw new Error(error.message);
  return { ok: true, id: (data as any).id };
}

export async function revokeDelegationRuleAtomicRecord(
  ruleId: string,
): Promise<{ ok: boolean; id: string; status: string }> {
  const { data, error } = await (supabase as any).rpc("revoke_delegation_rule_atomic", {
    p_rule_id: ruleId,
  });

  if (error) throw new Error(error.message);
  return { ok: true, id: (data as any).id, status: (data as any).status };
}

export async function saveApprovalChainRecord(
  chainData: Record<string, unknown>,
): Promise<{ ok: boolean; id: string; version: number }> {
  const { data, error } = await (supabase as any).rpc("create_approval_chain_versioned", {
    p_chain_data: chainData,
  });

  if (error) throw new Error(error.message);
  const res = data as any;
  return { ok: true, id: res.id, version: res.version };
}

export async function archiveApprovalChainRecord(
  chainId: string,
): Promise<{ ok: boolean; id: string }> {
  const { data, error } = await (supabase as any).rpc("archive_approval_chain_atomic", {
    p_chain_id: chainId,
  });

  if (error) throw new Error(error.message);
  return { ok: true, id: (data as any).id };
}

export async function bulkDecideWorkflowRequestsRecord(payload: {
  requestIds: string[];
  decision: "approved" | "rejected";
  note: string;
}): Promise<{ ok: boolean; successCount: number; failureCount: number; failures: any[] }> {
  const { data, error } = await (supabase as any).rpc("bulk_decide_workflow_requests", {
    p_request_ids: payload.requestIds,
    p_decision: payload.decision,
    p_note: payload.note,
  });

  if (error) throw new Error(error.message);
  const res = data as any;
  return {
    ok: true,
    successCount: res.success_count || 0,
    failureCount: res.failure_count || 0,
    failures: res.failures || [],
  };
}

// ----------------------------------------------------------------------------
// Dedicated TanStack Query Hooks (Item 2)
// ----------------------------------------------------------------------------

export function useApprovalInbox(filters: WorkflowRequestFilters = {}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoRequests = useDemoStore((s) => s.requests);

  return useQuery({
    queryKey: queryKeys.workflow.inbox(filters as Record<string, unknown>),
    queryFn: async () => {
      if (!isLive) {
        const pending = demoRequests.filter((r) => r.status === "pending_approval");
        return {
          data: pending,
          totalCount: pending.length,
          page: filters.page || 1,
          pageSize: filters.pageSize || 20,
        };
      }
      return fetchWorkflowInboxRecord(filters);
    },
    staleTime: 30_000,
  });
}

export function useMyRequests(filters: WorkflowRequestFilters = {}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoRequests = useDemoStore((s) => s.requests);

  return useQuery({
    queryKey: queryKeys.workflow.myRequests(filters as Record<string, unknown>),
    queryFn: async () => {
      if (!isLive) {
        return {
          data: demoRequests,
          totalCount: demoRequests.length,
          page: filters.page || 1,
          pageSize: filters.pageSize || 20,
        };
      }
      return fetchMyWorkflowRequestsRecord(filters);
    },
    staleTime: 30_000,
  });
}

export function useRequestDetail(id: string | null) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoRequests = useDemoStore((s) => s.requests);

  return useQuery({
    queryKey: queryKeys.workflow.request(id || "none"),
    queryFn: async () => {
      if (!id) return null;
      if (!isLive) {
        return demoRequests.find((r) => r.id === id) || null;
      }
      return fetchWorkflowRequestDetailRecord(id);
    },
    enabled: Boolean(id),
  });
}

export function useApprovalChains(filters: { companyId?: string; status?: string } = {}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoChains = useDemoStore((s) => s.approvalChains);

  return useQuery({
    queryKey: queryKeys.workflow.chains(filters as Record<string, unknown>),
    queryFn: async () => {
      if (!isLive) {
        return demoChains;
      }
      return fetchApprovalChainsRecord(filters);
    },
    staleTime: 60_000,
  });
}

export function useMyDelegations() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoDelegations = useDemoStore((s) => s.delegationRules);

  return useQuery({
    queryKey: queryKeys.workflow.myDelegations(),
    queryFn: async () => {
      if (!isLive) {
        return demoDelegations;
      }
      return fetchMyDelegationsRecord();
    },
    staleTime: 60_000,
  });
}

export function useDelegationsAdmin(filters: { companyId?: string } = {}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoDelegations = useDemoStore((s) => s.delegationRules);

  return useQuery({
    queryKey: queryKeys.workflow.delegations(filters as Record<string, unknown>),
    queryFn: async () => {
      if (!isLive) {
        return demoDelegations;
      }
      return fetchDelegationsAdminRecord(filters);
    },
    staleTime: 60_000,
  });
}

export function useWorkflowKpis(companyId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoRequests = useDemoStore((s) => s.requests);

  return useQuery({
    queryKey: queryKeys.workflow.kpis(companyId),
    queryFn: async () => {
      if (!isLive) {
        return {
          inboxPending: demoRequests.filter((r) => r.status === "pending_approval").length,
          myPending: demoRequests.filter((r) => r.status === "pending_approval").length,
          myApproved: demoRequests.filter((r) => r.status === "approved").length,
          myRejected: demoRequests.filter((r) => r.status === "rejected").length,
          myReturned: demoRequests.filter((r) => r.status === "returned").length,
          overdueCount: 0,
        };
      }
      return fetchWorkflowKpisRecord(companyId);
    },
    staleTime: 30_000,
  });
}

// ----------------------------------------------------------------------------
// Mutation Hook with Targeted Query Invalidation (Item 2)
// ----------------------------------------------------------------------------

export function useWorkflowEngineMutations() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const invalidateWorkflowQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all }),
    ]);
  }, [queryClient]);

  const submitRequest = useCallback(
    async (payload: {
      type: RequestCategory;
      payload: Record<string, unknown>;
      onBehalfOfEmployeeId?: string;
    }): Promise<boolean> => {
      try {
        if (!isLive) {
          const emp = demoStore.employees[0];
          const newReq: ServiceRequest = {
            id: `req-${Date.now()}`,
            referenceNo: `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            type: payload.type,
            requesterId: emp?.id || "emp-01",
            requesterName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "الموظف",
            requesterJobTitle: emp?.jobTitleAr || "موظف",
            status: "pending_approval",
            currentStepIndex: 1,
            totalSteps: 2,
            currentApproverRole: "المدير المباشر",
            submittedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            payload: payload.payload as any,
            timeline: [
              {
                id: `tl-${Date.now()}`,
                stepNumber: 1,
                actorId: emp?.id || "emp-01",
                actorName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "الموظف",
                actorRole: "مقدم الطلب",
                action: "submitted",
                timestamp: new Date().toISOString(),
              },
            ],
          };
          demoStore.requests = [newReq, ...demoStore.requests];
          demoStore.notify();
          toast.success("تم إرسال الطلب بنجاح وهو الآن قيد المراجعة والاعتماد");
          return true;
        }

        await submitWorkflowRequestRecord({
          requestType: payload.type,
          payload: payload.payload,
          onBehalfOfEmployeeId: payload.onBehalfOfEmployeeId,
        });

        await invalidateWorkflowQueries();
        toast.success("تم إرسال الطلب بنجاح وهو الآن قيد المراجعة والاعتماد");
        return true;
      } catch (err: any) {
        toast.error(err.message || "تعذر إرسال الطلب");
        return false;
      }
    },
    [isLive, invalidateWorkflowQueries],
  );

  const decideRequest = useCallback(
    async (
      requestId: string,
      decision: "approved" | "rejected" | "returned",
      note: string,
      internalNote?: string,
    ): Promise<boolean> => {
      try {
        if (!isLive) {
          demoStore.requests = demoStore.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: decision === "approved" ? "approved" : decision,
                  decisionNote: note,
                  updatedAt: new Date().toISOString(),
                }
              : r,
          );
          demoStore.notify();
          const label =
            decision === "approved" ? "تم اعتماد الطلب بنجاح" : decision === "rejected" ? "تم رفض الطلب" : "تمت إعادة الطلب للاستكمال";
          toast.success(label);
          return true;
        }

        await decideWorkflowRequestRecord({
          requestId,
          decision,
          note,
          internalNote,
        });

        await invalidateWorkflowQueries();
        const label =
          decision === "approved" ? "تم اعتماد الطلب بنجاح" : decision === "rejected" ? "تم رفض الطلب" : "تمت إعادة الطلب للاستكمال";
        toast.success(label);
        return true;
      } catch (err: any) {
        toast.error(err.message || "تعذر معالجة الطلب");
        return false;
      }
    },
    [isLive, invalidateWorkflowQueries],
  );

  const resubmitRequest = useCallback(
    async (
      requestId: string,
      payload: Record<string, unknown>,
      note?: string,
    ): Promise<boolean> => {
      try {
        if (!isLive) {
          demoStore.requests = demoStore.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "pending_approval",
                  payload: payload as any,
                  updatedAt: new Date().toISOString(),
                }
              : r,
          );
          demoStore.notify();
          toast.success("تمت إعادة تقديم الطلب للمراجعة بنجاح");
          return true;
        }

        await resubmitWorkflowRequestRecord({
          requestId,
          payload,
          note,
        });

        await invalidateWorkflowQueries();
        toast.success("تمت إعادة تقديم الطلب للمراجعة بنجاح");
        return true;
      } catch (err: any) {
        toast.error(err.message || "تعذر إعادة تقديم الطلب");
        return false;
      }
    },
    [isLive, invalidateWorkflowQueries],
  );

  const withdrawRequest = useCallback(
    async (requestId: string, reason: string): Promise<boolean> => {
      try {
        if (!isLive) {
          demoStore.requests = demoStore.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "cancelled",
                  updatedAt: new Date().toISOString(),
                }
              : r,
          );
          demoStore.notify();
          toast.success("تم سحب الطلب بنجاح");
          return true;
        }

        await withdrawWorkflowRequestRecord({
          requestId,
          reason,
        });

        await invalidateWorkflowQueries();
        toast.success("تم سحب الطلب بنجاح");
        return true;
      } catch (err: any) {
        toast.error(err.message || "تعذر سحب الطلب");
        return false;
      }
    },
    [isLive, invalidateWorkflowQueries],
  );

  const createDelegation = useCallback(
    async (rule: {
      delegateId: string;
      startDate: string;
      endDate: string;
      scope: string;
      requestTypes?: string[];
      reason?: string;
    }): Promise<boolean> => {
      try {
        if (!isLive) {
          const newRule: DelegationRule = {
            id: `del-${Date.now()}`,
            delegatorId: demoStore.employees[0]?.id || "emp-01",
            delegatorName: "المدير المباشر",
            delegateId: rule.delegateId,
            delegateName: demoStore.employees.find((e) => e.id === rule.delegateId)?.firstNameAr || "المفوض",
            startDate: rule.startDate,
            endDate: rule.endDate,
            reason: rule.reason || "",
            status: "active",
            scope: rule.scope as any,
            createdAt: new Date().toISOString(),
          };
          demoStore.delegationRules = [newRule, ...demoStore.delegationRules];
          demoStore.notify();
          toast.success("تم تفعيل التفويض بنجاح");
          return true;
        }

        await createDelegationRuleAtomicRecord(rule);
        await invalidateWorkflowQueries();
        toast.success("تم تفعيل التفويض بنجاح");
        return true;
      } catch (err: any) {
        toast.error(err.message || "تعذر تفعيل التفويض");
        return false;
      }
    },
    [isLive, invalidateWorkflowQueries],
  );

  const revokeDelegation = useCallback(
    async (ruleId: string): Promise<boolean> => {
      try {
        if (!isLive) {
          demoStore.delegationRules = demoStore.delegationRules.map((d) =>
            d.id === ruleId ? { ...d, status: "revoked" } : d,
          );
          demoStore.notify();
          toast.success("تم إلغاء التفويض بنجاح");
          return true;
        }

        await revokeDelegationRuleAtomicRecord(ruleId);
        await invalidateWorkflowQueries();
        toast.success("تم إلغاء التفويض بنجاح");
        return true;
      } catch (err: any) {
        toast.error(err.message || "تعذر إلغاء التفويض");
        return false;
      }
    },
    [isLive, invalidateWorkflowQueries],
  );

  const saveChain = useCallback(
    async (chainData: Record<string, unknown>): Promise<boolean> => {
      try {
        if (!isLive) {
          const newChain: ApprovalChain = {
            id: `chain-${Date.now()}`,
            requestType: chainData.request_type as RequestCategory,
            nameAr: chainData.name_ar as string,
            nameEn: (chainData.name_en as string) || (chainData.name_ar as string),
            scopeType: (chainData.scope_type as any) || "all_employees",
            scopeValues: (chainData.scope_values as any) || [],
            steps: (chainData.steps as any) || [],
            isDefault: Boolean(chainData.is_default),
            status: "active",
          };
          demoStore.approvalChains = [newChain, ...demoStore.approvalChains];
          demoStore.notify();
          toast.success("تم حفظ وتفعيل مسار الاعتماد بنجاح");
          return true;
        }

        await saveApprovalChainRecord(chainData);
        await invalidateWorkflowQueries();
        toast.success("تم حفظ وتفعيل مسار الاعتماد بنجاح");
        return true;
      } catch (err: any) {
        toast.error(err.message || "تعذر حفظ مسار الاعتماد");
        return false;
      }
    },
    [isLive, invalidateWorkflowQueries],
  );

  const archiveChain = useCallback(
    async (chainId: string): Promise<boolean> => {
      try {
        if (!isLive) {
          demoStore.approvalChains = demoStore.approvalChains.filter((c) => c.id !== chainId);
          demoStore.notify();
          toast.success("تم أرشفة مسار الاعتماد");
          return true;
        }

        await archiveApprovalChainRecord(chainId);
        await invalidateWorkflowQueries();
        toast.success("تم أرشفة مسار الاعتماد");
        return true;
      } catch (err: any) {
        toast.error(err.message || "تعذر أرشفة مسار الاعتماد");
        return false;
      }
    },
    [isLive, invalidateWorkflowQueries],
  );

  const bulkDecide = useCallback(
    async (
      requestIds: string[],
      decision: "approved" | "rejected",
      note: string,
    ): Promise<{ ok: boolean; successCount: number; failureCount: number }> => {
      try {
        if (!isLive) {
          demoStore.requests = demoStore.requests.map((r) =>
            requestIds.includes(r.id) ? { ...r, status: decision === "approved" ? "approved" : "rejected" } : r,
          );
          demoStore.notify();
          toast.success(`تمت معالجة ${requestIds.length} طلبات بنجاح`);
          return { ok: true, successCount: requestIds.length, failureCount: 0 };
        }

        const res = await bulkDecideWorkflowRequestsRecord({
          requestIds,
          decision,
          note,
        });

        await invalidateWorkflowQueries();
        if (res.failureCount > 0) {
          toast.warning(`تمت معالجة ${res.successCount} طلبات بنجاح، وفشل ${res.failureCount} طلبات`);
        } else {
          toast.success(`تم اعتماد ${res.successCount} طلبات بنجاح`);
        }
        return { ok: true, successCount: res.successCount, failureCount: res.failureCount };
      } catch (err: any) {
        toast.error(err.message || "تعذر تنفيذ الاعتماد المجمع");
        return { ok: false, successCount: 0, failureCount: requestIds.length };
      }
    },
    [isLive, invalidateWorkflowQueries],
  );

  return {
    submitRequest,
    decideRequest,
    resubmitRequest,
    withdrawRequest,
    createDelegation,
    revokeDelegation,
    saveChain,
    archiveChain,
    bulkDecide,
  };
}
