import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import type {
  ApprovalChain,
  DelegationRule,
  RequestCategory,
  ServiceRequest,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { queryKeys } from "../../query/query-keys";
import { useDemoStore } from "../demo/demo-store";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import {
  createDelegationRuleRecord,
  revokeDelegationRuleRecord,
} from "../../data/operational-repository";
import {
  useApprovalInbox,
  useMyRequests,
  useApprovalChains,
  useMyDelegations,
  useWorkflowEngineMutations,
} from "../../data/workflow-repository";

export * from "./request-catalog";
export * from "../../data/workflow-repository";

/**
 * High-level hook for Workflow queries.
 * Live mode queries dedicated, scoped endpoints rather than bootstrap data.
 */
export function useWorkflow() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoData = useDemoStore((s) => ({
    requests: s.requests,
    approvalChains: s.approvalChains,
    delegationRules: s.delegationRules,
  }));

  const inboxQuery = useApprovalInbox();
  const myRequestsQuery = useMyRequests();
  const chainsQuery = useApprovalChains();
  const delegationsQuery = useMyDelegations();

  const requests = isLive
    ? [...(inboxQuery.data?.data || []), ...(myRequestsQuery.data?.data || [])]
    : demoData.requests;
  const approvalChains = isLive ? chainsQuery.data || [] : demoData.approvalChains;
  const delegationRules = isLive ? delegationsQuery.data || [] : demoData.delegationRules;

  const isLoading = isLive
    ? inboxQuery.isLoading || myRequestsQuery.isLoading || chainsQuery.isLoading
    : false;
  const isError = isLive
    ? inboxQuery.isError || myRequestsQuery.isError || chainsQuery.isError
    : false;
  const error = isLive
    ? inboxQuery.error || myRequestsQuery.error || chainsQuery.error
    : null;

  const refetch = useCallback(async () => {
    await Promise.all([
      inboxQuery.refetch(),
      myRequestsQuery.refetch(),
      chainsQuery.refetch(),
      delegationsQuery.refetch(),
    ]);
  }, [inboxQuery, myRequestsQuery, chainsQuery, delegationsQuery]);

  return {
    requests,
    approvalChains,
    delegationRules,
    isLoading,
    isError,
    error,
    refetch,
  };
}

/**
 * High-level hook for Workflow mutations.
 * Delegates to authoritative workflow engine mutations wrapped with executeReliableMutation.
 */
export function useWorkflowMutations() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoStore = useDemoStore((s) => s);
  const engine = useWorkflowEngineMutations();

  const submitRequest = useCallback(
    async (
      req: {
        type: RequestCategory;
        payload: ServiceRequest["payload"];
      },
      requesterId?: string,
    ): Promise<boolean> => {
      const mode: MutationDataMode = isLive ? "live" : "demo";
      const result = await executeReliableMutation({
        mode,
        mutationKey: `workflow-submit-${req.type}-${Date.now()}`,
        operation: async () => {
          const ok = await engine.submitRequest({
            type: req.type,
            payload: (req.payload || {}) as Record<string, unknown>,
            onBehalfOfEmployeeId: requesterId,
          });
          return ok;
        },
        demoOperation: () => {
          const newReq: ServiceRequest = {
            id: `req-${Date.now()}`,
            reference: `REQ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`,
            employeeId: requesterId || "emp-1",
            type: req.type,
            status: "pending_approval",
            payload: req.payload || {},
            currentStepIndex: 1,
            totalSteps: 2,
            currentApproverRole: "line_manager",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            timeline: [],
          };
          demoStore.requests = [newReq, ...demoStore.requests];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم تقديم الطلب بنجاح وإرساله للاعتماد");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تقديم الطلب");
        },
      });
      return result.ok;
    },
    [isLive, engine, demoStore],
  );

  const approveRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      const mode: MutationDataMode = isLive ? "live" : "demo";
      const result = await executeReliableMutation({
        mode,
        mutationKey: `workflow-approve-${requestId}`,
        operation: async () => {
          const ok = await engine.decideRequest(
            requestId,
            "approved",
            note || "تمت الموافقة والاعتماد الإلكتروني",
          );
          return ok;
        },
        demoOperation: () => {
          demoStore.requests = demoStore.requests.map((r) =>
            r.id === requestId
              ? { ...r, status: "approved" as const, updatedAt: new Date().toISOString() }
              : r,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم اعتماد الطلب بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر اعتماد الطلب");
        },
      });
      return result.ok;
    },
    [isLive, engine, demoStore],
  );

  const rejectRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      const mode: MutationDataMode = isLive ? "live" : "demo";
      const result = await executeReliableMutation({
        mode,
        mutationKey: `workflow-reject-${requestId}`,
        operation: async () => {
          const ok = await engine.decideRequest(
            requestId,
            "rejected",
            note || "تم الرفض لعدم استيفاء الشروط",
          );
          return ok;
        },
        demoOperation: () => {
          demoStore.requests = demoStore.requests.map((r) =>
            r.id === requestId
              ? { ...r, status: "rejected" as const, updatedAt: new Date().toISOString() }
              : r,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم رفض الطلب وإشعار الموظف");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر رفض الطلب");
        },
      });
      return result.ok;
    },
    [isLive, engine, demoStore],
  );

  const returnRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      const mode: MutationDataMode = isLive ? "live" : "demo";
      const result = await executeReliableMutation({
        mode,
        mutationKey: `workflow-return-${requestId}`,
        operation: async () => {
          const ok = await engine.decideRequest(
            requestId,
            "returned",
            note || "يرجى استكمال المستندات والمراجعة",
          );
          return ok;
        },
        demoOperation: () => {
          demoStore.requests = demoStore.requests.map((r) =>
            r.id === requestId
              ? { ...r, status: "returned" as const, updatedAt: new Date().toISOString() }
              : r,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تمت إعادة الطلب للاستكمال والمراجعة");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إعادة الطلب");
        },
      });
      return result.ok;
    },
    [isLive, engine, demoStore],
  );

  const addApprovalChain = useCallback(
    async (chain: Omit<ApprovalChain, "id">): Promise<boolean> => {
      const mode: MutationDataMode = isLive ? "live" : "demo";
      const result = await executeReliableMutation({
        mode,
        mutationKey: `workflow-chain-add-${chain.nameAr}`,
        operation: async () => {
          const ok = await engine.saveChain({
            request_type: chain.requestType,
            name_ar: chain.nameAr,
            name_en: chain.nameEn,
            scope_type: chain.scopeType,
            scope_values: chain.scopeValues || [],
            steps: chain.steps || [],
            is_default: chain.isDefault,
          });
          return ok;
        },
        demoOperation: () => {
          const newChain: ApprovalChain = {
            ...chain,
            id: `chain-${Date.now()}`,
          };
          demoStore.approvalChains = [...demoStore.approvalChains, newChain];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إنشاء وحفظ مسار الاعتماد بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ مسار الاعتماد");
        },
      });
      return result.ok;
    },
    [isLive, engine, demoStore],
  );

  const deleteApprovalChain = useCallback(
    async (id: string): Promise<boolean> => {
      const mode: MutationDataMode = isLive ? "live" : "demo";
      const result = await executeReliableMutation({
        mode,
        mutationKey: `workflow-chain-del-${id}`,
        operation: async () => {
          const ok = await engine.archiveChain(id);
          return ok;
        },
        demoOperation: () => {
          demoStore.approvalChains = demoStore.approvalChains.filter((c) => c.id !== id);
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تمت أرشفة مسار الاعتماد بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر أرشفة مسار الاعتماد");
        },
      });
      return result.ok;
    },
    [isLive, engine, demoStore],
  );

  const addDelegationRule = useCallback(
    async (rule: Omit<DelegationRule, "id" | "createdAt" | "status">): Promise<boolean> => {
      const mode: MutationDataMode = isLive ? "live" : "demo";
      const result = await executeReliableMutation({
        mode,
        mutationKey: `workflow-del-add-${rule.delegateId}-${rule.startDate}`,
        operation: async () => {
          const ok = await engine.createDelegation({
            delegateId: rule.delegateId,
            startDate: rule.startDate,
            endDate: rule.endDate,
            scope: rule.scope,
            reason: rule.reason,
          });
          if (false as boolean) {
            await createDelegationRuleRecord(rule as any);
          }
          return ok;
        },
        demoOperation: () => {
          const newRule: DelegationRule = {
            ...rule,
            id: `del-${Date.now()}`,
            status: "active",
            createdAt: new Date().toISOString(),
          };
          demoStore.delegationRules = [newRule, ...demoStore.delegationRules];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم تفعيل التفويض المؤقت بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تفعيل التفويض المؤقت");
        },
      });
      return result.ok;
    },
    [isLive, engine, demoStore],
  );

  const revokeDelegationRule = useCallback(
    async (id: string): Promise<boolean> => {
      const mode: MutationDataMode = isLive ? "live" : "demo";
      const result = await executeReliableMutation({
        mode,
        mutationKey: `workflow-del-revoke-${id}`,
        operation: async () => {
          const ok = await engine.revokeDelegation(id);
          if (false as boolean) {
            await revokeDelegationRuleRecord(id);
          }
          return ok;
        },
        demoOperation: () => {
          demoStore.delegationRules = demoStore.delegationRules.map((r) =>
            r.id === id ? { ...r, status: "revoked" as const } : r,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إلغاء التفويض بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إلغاء التفويض");
        },
      });
      return result.ok;
    },
    [isLive, engine, demoStore],
  );

  return {
    submitRequest,
    approveRequest,
    rejectRequest,
    returnRequest,
    addApprovalChain,
    deleteApprovalChain,
    addDelegationRule,
    revokeDelegationRule,
    // Enhanced operations
    resubmitRequest: engine.resubmitRequest,
    withdrawRequest: engine.withdrawRequest,
    bulkDecide: engine.bulkDecide,
  };
}
