/**
 * Workforce Planning Domain Facade
 * Delegates to workforce-planning-repository.ts via executeReliableMutation
 * Does NOT use AppContext / demoStore as financial/headcount authority
 */
import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import {
  useWorkforcePlans,
  useWorkforcePlan,
  useWorkforcePlanLines,
  useWorkforcePlanForecasts,
  useHeadcountRequests,
  useWorkforceKPIs,
  useActualHeadcount,
  usePlanVsActual,
  useWorkforcePlanningMutations,
} from "../../data/workforce-planning-repository";

export {
  useWorkforcePlans,
  useWorkforcePlan,
  useWorkforcePlanLines,
  useWorkforcePlanForecasts,
  useHeadcountRequests,
  useWorkforceKPIs,
  useActualHeadcount,
  usePlanVsActual,
};

export type { WorkforcePlanEnriched, WorkforcePlanLine, WorkforcePlanMonthlyForecast, HeadcountRequest, WorkforceKPIs, ActualHeadcountResult, PlanVsActualResult } from "../../data/workforce-planning-repository";

export function useWorkforcePlanningDomain() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const mutations = useWorkforcePlanningMutations();

  const createPlan = useCallback(
    async (params: {
      companyId: string;
      titleAr: string;
      titleEn?: string;
      fiscalYear?: number;
      planType?: string;
      departmentId?: string;
      notes?: string;
      fteBudget?: number;
      totalCompensationBudget?: number;
      saudizationTargetPct?: number;
    }): Promise<{ ok: boolean; planId?: string; planCode?: string }> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-workforce-plan-${params.titleAr}`,
        operation: async () => {
          const res = await mutations.createPlan.mutateAsync(params);
          return res;
        },
        demoOperation: () => {
          return { ok: true, plan_id: crypto.randomUUID(), plan_code: `WFP-${params.fiscalYear ?? new Date().getFullYear()}-001` };
        },
        onCommitted: () => {
          toast.success("تم إنشاء خطة القوى العاملة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إنشاء الخطة");
        },
      });
      const planId = result.data?.plan_id ? String(result.data.plan_id) : undefined;
      const planCode = result.data?.plan_code ? String(result.data.plan_code) : undefined;
      return { ok: result.ok, planId, planCode };
    },
    [mode, mutations]
  );

  const submitPlan = useCallback(
    async (planId: string, companyId: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `submit-workforce-plan-${planId}`,
        operation: async () => {
          await mutations.submitPlan.mutateAsync({ planId, companyId });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success("تم رفع الخطة للاعتماد");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر رفع الخطة للاعتماد");
        },
      });
      return result.ok;
    },
    [mode, mutations]
  );

  const approvePlan = useCallback(
    async (planId: string, companyId: string, action: "approve" | "reject", notes?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `approve-workforce-plan-${planId}`,
        operation: async () => {
          await mutations.approvePlan.mutateAsync({ planId, companyId, action, notes });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success(action === "approve" ? "تم اعتماد الخطة بنجاح" : "تم رفض الخطة وإعادتها لمسودة");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث حالة الخطة");
        },
      });
      return result.ok;
    },
    [mode, mutations]
  );

  const upsertPlanLine = useCallback(
    async (params: Parameters<typeof mutations.upsertPlanLine.mutateAsync>[0]): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `upsert-plan-line-${params.planId}`,
        operation: async () => {
          await mutations.upsertPlanLine.mutateAsync(params);
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success(params.lineId ? "تم تحديث السطر بنجاح" : "تم إضافة السطر للخطة");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ سطر الخطة");
        },
      });
      return result.ok;
    },
    [mode, mutations]
  );

  const generateForecast = useCallback(
    async (companyId: string, planId: string, fiscalYear?: number): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `generate-forecast-${planId}`,
        operation: async () => {
          await mutations.generateForecast.mutateAsync({ companyId, planId, fiscalYear });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success("تم إنشاء التوقعات الشهرية بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إنشاء التوقعات");
        },
      });
      return result.ok;
    },
    [mode, mutations]
  );

  const createHeadcountRequest = useCallback(
    async (params: Parameters<typeof mutations.createHeadcountRequest.mutateAsync>[0]): Promise<{ ok: boolean; requestId?: string; requestNo?: string }> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-hc-request-${params.positionTitleAr}`,
        operation: async () => {
          const res = await mutations.createHeadcountRequest.mutateAsync(params);
          return res;
        },
        demoOperation: () => ({ ok: true, request_id: crypto.randomUUID(), request_no: `HCR-${new Date().getFullYear()}-0001` }),
        onCommitted: () => {
          toast.success("تم إنشاء طلب التوظيف بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إنشاء طلب التوظيف");
        },
      });
      const requestId = result.data?.request_id ? String(result.data.request_id) : undefined;
      const requestNo = result.data?.request_no ? String(result.data.request_no) : undefined;
      return { ok: result.ok, requestId, requestNo };
    },
    [mode, mutations]
  );

  const approveHeadcountRequest = useCallback(
    async (
      requestId: string,
      companyId: string,
      action: "approve" | "reject",
      approvedHeadcount?: number,
      notes?: string
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `approve-hc-request-${requestId}`,
        operation: async () => {
          await mutations.approveHeadcountRequest.mutateAsync({
            requestId,
            companyId,
            action,
            approvedHeadcount,
            notes,
          });
          return true;
        },
        demoOperation: () => true,
        onCommitted: () => {
          toast.success(action === "approve" ? "تم اعتماد طلب التوظيف" : "تم رفض طلب التوظيف");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث طلب التوظيف");
        },
      });
      return result.ok;
    },
    [mode, mutations]
  );

  return {
    createPlan,
    submitPlan,
    approvePlan,
    upsertPlanLine,
    generateForecast,
    createHeadcountRequest,
    approveHeadcountRequest,
    // Expose mutation states
    isCreatingPlan: mutations.createPlan.isPending,
    isSubmittingPlan: mutations.submitPlan.isPending,
    isApprovingPlan: mutations.approvePlan.isPending,
    isUpsertingLine: mutations.upsertPlanLine.isPending,
    isGeneratingForecast: mutations.generateForecast.isPending,
    isCreatingRequest: mutations.createHeadcountRequest.isPending,
    isApprovingRequest: mutations.approveHeadcountRequest.isPending,
  };
}
