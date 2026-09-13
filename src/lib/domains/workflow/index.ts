import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type {
  ApprovalChain,
  DelegationRule,
  RequestCategory,
  ServiceRequest,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { createRequestRecord } from "../../data/hrms-repository";
import {
  createApprovalChainRecord,
  deleteApprovalChainRecord,
  createDelegationRuleRecord,
  revokeDelegationRuleRecord,
} from "../../data/operational-repository";
import { actOnRequestServer } from "../../business/approvals.functions";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function useWorkflow() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoData = useDemoStore((s) => ({
    requests: s.requests,
    approvalChains: s.approvalChains,
    delegationRules: s.delegationRules,
  }));

  const requests = isLive ? bootstrap.requests : demoData.requests;
  const approvalChains = isLive ? bootstrap.approvalChains : demoData.approvalChains;
  const delegationRules = isLive ? bootstrap.delegationRules : demoData.delegationRules;

  return {
    requests,
    approvalChains,
    delegationRules,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useWorkflowMutations() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const submitRequest = useCallback(
    async (
      req: {
        type: RequestCategory;
        payload: ServiceRequest["payload"];
      },
      requesterId?: string,
    ): Promise<boolean> => {
      const empId = requesterId || demoStore.employees[0]?.id || "emp-01";
      const emp = demoStore.employees.find((e) => e.id === empId);

      const newReq: ServiceRequest = {
        id: `req-${Date.now()}`,
        referenceNo: `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        type: req.type,
        requesterId: empId,
        requesterName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "الموظف",
        requesterJobTitle: emp?.jobTitleAr || "موظف",
        departmentName: emp?.departmentName || "عام",
        status: "pending_approval",
        currentStepIndex: 1,
        totalSteps: 2,
        currentApproverRole: "مدير الموارد البشرية",
        submittedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        payload: req.payload,
        timeline: [
          {
            id: `tl-${Date.now()}`,
            stepNumber: 1,
            actorId: empId,
            actorName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "الموظف",
            actorRole: "مقدم الطلب",
            action: "submitted",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `req-submit-${empId}-${req.type}-${Date.now()}`,
        operation: async () => {
          await createRequestRecord(empId, req.type, (req.payload || {}) as Record<string, unknown>);
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.requests = [newReq, ...demoStore.requests];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إرسال الطلب بنجاح وهو الآن قيد المراجعة والاعتماد");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إرسال الطلب");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const approveRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `req-approve-${requestId}`,
        operation: async () => {
          await actOnRequestServer({ data: { requestId, decision: "approved", note } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.requests = demoStore.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "approved" as const,
                  currentStepIndex: r.totalSteps,
                  updatedAt: new Date().toISOString(),
                  timeline: [
                    ...r.timeline,
                    {
                      id: `tl-${Date.now()}`,
                      stepNumber: r.currentStepIndex + 1,
                      actorId: "usr-admin",
                      actorName: "مدير النظام",
                      actorRole: "المعتمد",
                      action: "approved" as const,
                      note,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : r,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم اعتماد الطلب رسمياً بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر اعتماد الطلب");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const rejectRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `req-reject-${requestId}`,
        operation: async () => {
          await actOnRequestServer({ data: { requestId, decision: "rejected", note } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.requests = demoStore.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "rejected" as const,
                  updatedAt: new Date().toISOString(),
                  timeline: [
                    ...r.timeline,
                    {
                      id: `tl-${Date.now()}`,
                      stepNumber: r.currentStepIndex + 1,
                      actorId: "usr-admin",
                      actorName: "مدير النظام",
                      actorRole: "المعتمد",
                      action: "rejected" as const,
                      note,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
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
    [mode, queryClient],
  );

  const returnRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `req-return-${requestId}`,
        operation: async () => {
          await actOnRequestServer({ data: { requestId, decision: "returned", note } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.requests = demoStore.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "returned" as const,
                  updatedAt: new Date().toISOString(),
                  timeline: [
                    ...r.timeline,
                    {
                      id: `tl-${Date.now()}`,
                      stepNumber: r.currentStepIndex,
                      actorId: "usr-admin",
                      actorName: "مدير النظام",
                      actorRole: "المعتمد",
                      action: "returned" as const,
                      note,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : r,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إعادة الطلب للاستكمال وتعديل الملاحظات");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إعادة الطلب");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const addApprovalChain = useCallback(
    async (chain: Omit<ApprovalChain, "id">): Promise<boolean> => {
      const newChain: ApprovalChain = {
        ...chain,
        id: `chain-${Date.now()}`,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `chain-add-${chain.nameAr}`,
        operation: async () => {
          await createApprovalChainRecord(newChain);
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.chains() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.approvalChains = [...demoStore.approvalChains, newChain];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إنشاء وحفظ مسار الاعتماد بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ سلسلة الاعتمادات");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const deleteApprovalChain = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `chain-delete-${id}`,
        operation: async () => {
          await deleteApprovalChainRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.chains() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.approvalChains = demoStore.approvalChains.filter((c) => c.id !== id);
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم حذف مسار الاعتماد");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حذف مسار الاعتماد");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const addDelegationRule = useCallback(
    async (rule: Omit<DelegationRule, "id" | "createdAt" | "status">): Promise<boolean> => {
      const newRule: DelegationRule = {
        ...rule,
        id: `del-${Date.now()}`,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `del-add-${rule.delegatorId}-${rule.delegateId}-${rule.startDate}`,
        operation: async () => {
          await createDelegationRuleRecord(newRule);
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.delegations() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
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
    [mode, queryClient],
  );

  const revokeDelegationRule = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `del-revoke-${id}`,
        operation: async () => {
          await revokeDelegationRuleRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.delegations() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
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
    [mode, queryClient],
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
  };
}
