import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "../query/query-keys";
import { useAuth } from "../auth/AuthContext";

export interface EmployeeSeparation {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  departmentName?: string;
  separationType: "resignation" | "contract_expiration" | "termination" | "retirement" | "other";
  initiatedBy: "employee" | "hr";
  requestId?: string | null;
  requestedDate: string;
  lastWorkingDay: string;
  reason: string;
  noticePeriodDays: number;
  noticePeriodServed: boolean;
  workflowStatus: "draft" | "pending" | "approved" | "rejected" | "withdrawn";
  clearanceStatus: "pending" | "in_progress" | "completed" | "blocked";
  settlementStatus: "not_calculated" | "calculated" | "approved" | "paid";
  settlementId?: string | null;
  status: "pending" | "in_clearance" | "settlement_ready" | "finalized" | "cancelled";
  finalizedAt?: string | null;
  createdAt: string;
}

export interface ClearanceItem {
  id: string;
  separationId: string;
  companyId: string;
  employeeId: string;
  category: "hr" | "manager_handover" | "assets_return" | "documents" | "finance" | "loans" | "it_access";
  itemKey: string;
  titleAr: string;
  assignedRole: string;
  status: "pending" | "cleared" | "waived" | "blocked";
  assetId?: string | null;
  loanId?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  evidenceUrl?: string | null;
}

// ============================================================================
// 1. SEPARATIONS LIST HOOK
// ============================================================================

export function useEmployeeSeparations(filters: { status?: string; employeeId?: string } = {}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.separations.list(filters),
    queryFn: async (): Promise<EmployeeSeparation[]> => {
      if (!isLive) return [];

      let query = (supabase as any)
        .from("employee_separations")
        .select(`
          *,
          employees (
            id,
            employee_no,
            first_name_ar,
            last_name_ar,
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (filters.status) query = query.eq("status", filters.status);
      if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map((s: any) => ({
        id: s.id,
        companyId: s.company_id,
        employeeId: s.employee_id,
        employeeName: s.employees
          ? (s.employees.first_name_ar ? `${s.employees.first_name_ar} ${s.employees.last_name_ar}` : s.employees.full_name)
          : "—",
        employeeNo: s.employees?.employee_no || "—",
        separationType: s.separation_type,
        initiatedBy: s.initiated_by,
        requestId: s.request_id,
        requestedDate: s.requested_date,
        lastWorkingDay: s.last_working_day,
        reason: s.reason,
        noticePeriodDays: s.notice_period_days || 0,
        noticePeriodServed: Boolean(s.notice_period_served),
        workflowStatus: s.workflow_status,
        clearanceStatus: s.clearance_status,
        settlementStatus: s.settlement_status,
        settlementId: s.settlement_id,
        status: s.status,
        finalizedAt: s.finalized_at,
        createdAt: s.created_at,
      }));
    },
    enabled: isLive,
    staleTime: 15_000,
  });
}

// ============================================================================
// 2. CLEARANCE ITEMS HOOK
// ============================================================================

export function useClearanceItems(separationId?: string | null) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo && separationId);

  return useQuery({
    queryKey: queryKeys.separations.clearance(separationId || ""),
    queryFn: async (): Promise<ClearanceItem[]> => {
      if (!isLive || !separationId) return [];

      const { data, error } = await (supabase as any)
        .from("clearance_items")
        .select("*")
        .eq("separation_id", separationId)
        .order("category", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw new Error(error.message);

      return (data || []).map((c: any) => ({
        id: c.id,
        separationId: c.separation_id,
        companyId: c.company_id,
        employeeId: c.employee_id,
        category: c.category,
        itemKey: c.item_key,
        titleAr: c.title_ar,
        assignedRole: c.assigned_role,
        status: c.status,
        assetId: c.asset_id,
        loanId: c.loan_id,
        completedBy: c.completed_by,
        completedAt: c.completed_at,
        notes: c.notes,
        evidenceUrl: c.evidence_url,
      }));
    },
    enabled: isLive,
    staleTime: 10_000,
  });
}

// ============================================================================
// 3. SEPARATION & CLEARANCE MUTATIONS HOOK
// ============================================================================

export function useSeparationMutations() {
  const queryClient = useQueryClient();

  const submitResignation = useMutation({
    mutationFn: async (params: { lastWorkingDay: string; reason: string; noticeServed?: boolean }) => {
      const { data, error } = await (supabase as any).rpc("submit_resignation_atomic", {
        p_last_working_day: params.lastWorkingDay,
        p_reason: params.reason,
        p_notice_served: params.noticeServed ?? true,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("تم إرسال إشعار الاستقالة بنجاح لمسار الاعتماد الإداري");
      void queryClient.invalidateQueries({ queryKey: queryKeys.separations.all });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر تقديم طلب الاستقالة");
    },
  });

  const initiateSeparation = useMutation({
    mutationFn: async (params: {
      employeeId: string;
      separationType: string;
      lastWorkingDay: string;
      reason: string;
      noticeServed?: boolean;
    }) => {
      const { data, error } = await (supabase as any).rpc("initiate_separation_hr_atomic", {
        p_employee_id: params.employeeId,
        p_separation_type: params.separationType,
        p_last_working_day: params.lastWorkingDay,
        p_reason: params.reason,
        p_notice_served: params.noticeServed ?? true,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `تم بدء إجراءات إنهاء الخدمة بنجاح وتوليد قائمة إخلاء الطرف (${data.clearance_items_count} بند)`
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.separations.all });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر بدء إجراءات إنهاء الخدمة");
    },
  });

  const updateClearanceItem = useMutation({
    mutationFn: async (params: {
      itemId: string;
      status: "pending" | "cleared" | "waived" | "blocked";
      notes?: string;
      evidenceUrl?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("update_clearance_item_atomic", {
        p_item_id: params.itemId,
        p_status: params.status,
        p_notes: params.notes || null,
        p_evidence_url: params.evidenceUrl || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("تم تحديث بند إخلاء الطرف بنجاح");
      void queryClient.invalidateQueries({ queryKey: queryKeys.separations.all });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر تحديث بند إخلاء الطرف");
    },
  });

  const finalizeOffboarding = useMutation({
    mutationFn: async (params: { separationId: string }) => {
      const { data, error } = await (supabase as any).rpc("finalize_employee_offboarding_atomic", {
        p_separation_id: params.separationId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("تم إنهاء خدمة الموظف وإغلاق ملفه الوظيفي رسميًا بنجاح");
      void queryClient.invalidateQueries({ queryKey: queryKeys.separations.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
    onError: (err: any) => {
      toast.error(err.message || "فشل إغلاق ملف الموظف وإنهاء خدمته");
    },
  });

  return {
    submitResignation: submitResignation.mutateAsync,
    isSubmittingResignation: submitResignation.isPending,
    initiateSeparation: initiateSeparation.mutateAsync,
    isInitiatingSeparation: initiateSeparation.isPending,
    updateClearanceItem: updateClearanceItem.mutateAsync,
    isUpdatingClearance: updateClearanceItem.isPending,
    finalizeOffboarding: finalizeOffboarding.mutateAsync,
    isFinalizingOffboarding: finalizeOffboarding.isPending,
  };
}
