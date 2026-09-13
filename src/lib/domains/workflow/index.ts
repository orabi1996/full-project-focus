import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type {
  ApprovalChain,
  DelegationRule,
  RequestCategory,
  ServiceRequest,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { createRequestRecord, updateRequestDecision } from "../../data/hrms-repository";
import { createApprovalChainRecord } from "../../data/operational-repository";
import { actOnRequestServer } from "../../business/approvals.functions";
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
  const isLive = Boolean(session && !isDemo);
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

      if (!isLive) {
        demoStore.requests = [newReq, ...demoStore.requests];
        demoStore.notify();
        toast.success("تم إرسال الطلب بنجاح وهو الآن قيد المراجعة والاعتماد");
        return true;
      }

      try {
        await createRequestRecord(empId, req.type, (req.payload || {}) as Record<string, unknown>);
        await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم إرسال الطلب واعتماده في دورة العمل");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر إرسال الطلب");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const approveRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      if (!isLive) {
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
        toast.success("تم اعتماد الطلب رسمياً بنجاح");
        return true;
      }

      try {
        await actOnRequestServer({ data: { requestId, decision: "approved", note } });
        await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم اعتماد الطلب بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر اعتماد الطلب");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const rejectRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      if (!isLive) {
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
        toast.success("تم رفض الطلب وإشعار الموظف");
        return true;
      }

      try {
        await actOnRequestServer({ data: { requestId, decision: "rejected", note } });
        await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم رفض الطلب بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر رفض الطلب");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const returnRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      if (!isLive) {
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
        toast.success("تم إعادة الطلب للاستكمال وتعديل الملاحظات");
        return true;
      }

      try {
        await actOnRequestServer({ data: { requestId, decision: "returned", note } });
        await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تمت إعادة الطلب بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر إعادة الطلب");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const addApprovalChain = useCallback(
    async (chain: Omit<ApprovalChain, "id">): Promise<boolean> => {
      const newChain: ApprovalChain = {
        ...chain,
        id: `chain-${Date.now()}`,
      };
      if (!isLive) {
        demoStore.approvalChains = [...demoStore.approvalChains, newChain];
        demoStore.notify();
        toast.success("تم إنشاء سلسلة الموافقات بنجاح");
        return true;
      }
      try {
        await createApprovalChainRecord(newChain);
        await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.chains() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم حفظ سلسلة الاعتمادات بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر حفظ سلسلة الاعتمادات");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const deleteApprovalChain = useCallback(
    (id: string) => {
      demoStore.approvalChains = demoStore.approvalChains.filter((c) => c.id !== id);
      demoStore.notify();
      toast.success("تم حذف مسار الاعتماد");
    },
    [],
  );

  const addDelegationRule = useCallback(
    (rule: Omit<DelegationRule, "id" | "createdAt" | "status">) => {
      const newRule: DelegationRule = {
        ...rule,
        id: `del-${Date.now()}`,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      demoStore.delegationRules = [newRule, ...demoStore.delegationRules];
      demoStore.notify();
      toast.success("تم تفعيل التفويض المؤقت بنجاح");
    },
    [],
  );

  const revokeDelegationRule = useCallback(
    (id: string) => {
      demoStore.delegationRules = demoStore.delegationRules.map((r) =>
        r.id === id ? { ...r, status: "revoked" as const } : r,
      );
      demoStore.notify();
      toast.success("تم إلغاء التفويض بنجاح");
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
  };
}
