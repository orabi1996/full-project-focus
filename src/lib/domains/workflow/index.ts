import { useCallback } from "react";
import { toast } from "sonner";
import type {
  ApprovalChain,
  DelegationRule,
  RequestCategory,
  ServiceRequest,
} from "../../../types";
import { executeReliableMutation } from "../../data/reliable-mutation";
import {
  useApprovalInbox,
  useMyRequests,
  useApprovalChains,
  useMyDelegations,
  useWorkflowEngineMutations,
  createDelegationRuleRecord,
  revokeDelegationRuleRecord,
} from "../../data/workflow-repository";

export * from "./request-catalog";
export * from "../../data/workflow-repository";

/**
 * High-level hook for Workflow queries.
 * Live mode queries dedicated, scoped endpoints rather than bootstrap data.
 */
export function useWorkflow() {
  const inboxQuery = useApprovalInbox();
  const myRequestsQuery = useMyRequests();
  const chainsQuery = useApprovalChains();
  const delegationsQuery = useMyDelegations();

  const requests = [...(inboxQuery.data?.data || []), ...(myRequestsQuery.data?.data || [])];
  const approvalChains = chainsQuery.data || [];
  const delegationRules = delegationsQuery.data || [];

  const isLoading = inboxQuery.isLoading || myRequestsQuery.isLoading || chainsQuery.isLoading;
  const isError = inboxQuery.isError || myRequestsQuery.isError || chainsQuery.isError;
  const error = inboxQuery.error || myRequestsQuery.error || chainsQuery.error;

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
  const engine = useWorkflowEngineMutations();

  const submitRequest = useCallback(
    async (
      req: {
        type: RequestCategory;
        payload: ServiceRequest["payload"];
      },
      requesterId?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `workflow-submit-${req.type}-${Date.now()}`,
        operation: async () => {
          const ok = await engine.submitRequest({
            type: req.type,
            payload: (req.payload || {}) as Record<string, unknown>,
            onBehalfOfEmployeeId: requesterId,
          });
          return ok;
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
    [engine],
  );

  const approveRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `workflow-approve-${requestId}`,
        operation: async () => {
          const ok = await engine.decideRequest(
            requestId,
            "approved",
            note || "تمت الموافقة والاعتماد الإلكتروني",
          );
          return ok;
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
    [engine],
  );

  const rejectRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `workflow-reject-${requestId}`,
        operation: async () => {
          const ok = await engine.decideRequest(
            requestId,
            "rejected",
            note || "تم الرفض لعدم استيفاء الشروط",
          );
          return ok;
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
    [engine],
  );

  const returnRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `workflow-return-${requestId}`,
        operation: async () => {
          const ok = await engine.decideRequest(
            requestId,
            "returned",
            note || "يرجى استكمال المستندات والمراجعة",
          );
          return ok;
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
    [engine],
  );

  const addApprovalChain = useCallback(
    async (chain: Omit<ApprovalChain, "id">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
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
        onCommitted: () => {
          toast.success("تم إنشاء وحفظ مسار الاعتماد بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ مسار الاعتماد");
        },
      });
      return result.ok;
    },
    [engine],
  );

  const deleteApprovalChain = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `workflow-chain-del-${id}`,
        operation: async () => {
          const ok = await engine.archiveChain(id);
          return ok;
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
    [engine],
  );

  const addDelegationRule = useCallback(
    async (rule: Omit<DelegationRule, "id" | "createdAt" | "status">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `workflow-del-add-${rule.delegateId}-${rule.startDate}`,
        operation: async () => {
          const res = await createDelegationRuleRecord({
            delegateId: rule.delegateId,
            startDate: rule.startDate,
            endDate: rule.endDate,
            scope: rule.scope,
            reason: rule.reason,
          });
          return res.ok;
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
    [],
  );

  const revokeDelegationRule = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `workflow-del-revoke-${id}`,
        operation: async () => {
          const res = await revokeDelegationRuleRecord(id);
          return res.ok;
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
    [],
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
