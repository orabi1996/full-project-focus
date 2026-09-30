import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "../query/query-keys";
import { useAuth } from "../auth/AuthContext";

export interface LoanPolicy {
  id: string;
  companyId: string;
  loanType: string;
  minAmount: number;
  maxAmount: number;
  maxSalaryPercentage: number;
  maxInstallments: number;
  minServiceDays: number;
  allowedEmployeeGroups?: string[] | null;
  approvalChainCode: string;
  earlySettlementBehavior: string;
  payrollRecoveryBehavior: string;
  allowMultipleActive: boolean;
  isActive: boolean;
}

export interface LoanInstallment {
  id: string;
  loanId: string;
  companyId: string;
  employeeId: string;
  installmentNumber: number;
  duePayrollPeriod: string;
  dueDate: string;
  principalAmount: number;
  deductedAmount: number;
  remainingBalance: number;
  status: "pending" | "deducted" | "waived" | "early_settled";
  payrollRunId?: string | null;
  recoveredAt?: string | null;
}

export interface LoanDisbursement {
  id: string;
  companyId: string;
  loanId: string;
  bankAccountId: string;
  disbursedAmount: number;
  previousBankBalance: number;
  newBankBalance: number;
  disbursementStatus: "prepared" | "submitted_to_bank" | "confirmed" | "failed";
  externalReference?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface LoanDetail {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  loanType: string;
  principalAmount: number;
  approvedAmount: number;
  monthlyInstallment: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingBalance: number;
  outstandingAmount: number;
  status: "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "disbursement_pending" | "active" | "closed" | "cancelled";
  disbursementStatus: "prepared" | "submitted_to_bank" | "confirmed" | "failed";
  disbursementAccountId?: string | null;
  disbursedAt?: string | null;
  settledAt?: string | null;
  settlementType?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  installments?: LoanInstallment[];
}

export interface LoanFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  loanType?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// 1. LOAN POLICIES HOOK
// ============================================================================

export function useLoanPolicies() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.loans.policies(),
    queryFn: async (): Promise<LoanPolicy[]> => {
      if (!isLive) return [];
      const { data, error } = await (supabase as any)
        .from("company_loan_policies")
        .select("*")
        .eq("is_active", true)
        .order("loan_type", { ascending: true });

      if (error) throw new Error(error.message);
      return (data || []).map((p: any) => ({
        id: p.id,
        companyId: p.company_id,
        loanType: p.loan_type,
        minAmount: Number(p.min_amount),
        maxAmount: Number(p.max_amount),
        maxSalaryPercentage: Number(p.max_salary_percentage),
        maxInstallments: p.max_installments,
        minServiceDays: p.min_service_days,
        allowedEmployeeGroups: p.allowed_employee_groups,
        approvalChainCode: p.approval_chain_code,
        earlySettlementBehavior: p.early_settlement_behavior,
        payrollRecoveryBehavior: p.payroll_recovery_behavior,
        allowMultipleActive: p.allow_multiple_active,
        isActive: p.is_active,
      }));
    },
    enabled: isLive,
    staleTime: 60_000,
  });
}

// ============================================================================
// 2. PAGINATED & FILTERED LOANS LIST HOOK
// ============================================================================

export function useLoans(filters: LoanFilters = {}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.loans.list(filters as Record<string, unknown>),
    queryFn: async () => {
      if (!isLive) {
        return { data: [], total: 0, page: 1, pageSize: filters.pageSize || 20, totalPages: 0 };
      }

      let query = (supabase as any)
        .from("loans")
        .select(`
          *,
          employees (
            id,
            employee_no,
            first_name_ar,
            last_name_ar,
            full_name
          )
        `, { count: "exact" });

      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.loanType) {
        query = query.eq("loan_type", filters.loanType);
      }
      if (filters.startDate) {
        query = query.gte("created_at", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("created_at", filters.endDate);
      }

      query = query.order("created_at", { ascending: false });

      const page = filters.page || 1;
      const pageSize = filters.pageSize || 20;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw new Error(error.message);

      let mapped: LoanDetail[] = (data || []).map((l: any) => ({
        id: l.id,
        companyId: l.company_id,
        employeeId: l.employee_id,
        employeeName: l.employees
          ? (l.employees.first_name_ar ? `${l.employees.first_name_ar} ${l.employees.last_name_ar}` : l.employees.full_name)
          : "—",
        employeeNo: l.employees?.employee_no || "—",
        loanType: l.loan_type,
        principalAmount: Number(l.principal_amount || 0),
        approvedAmount: Number(l.approved_amount || l.principal_amount || 0),
        monthlyInstallment: Number(l.monthly_installment || l.installment_amount || 0),
        totalInstallments: Number(l.total_installments || l.installments_total || 0),
        paidInstallments: Number(l.paid_installments || l.installments_paid || 0),
        remainingBalance: Number(l.remaining_balance || l.outstanding_amount || 0),
        outstandingAmount: Number(l.outstanding_amount || l.remaining_balance || 0),
        status: l.status,
        disbursementStatus: l.disbursement_status || "prepared",
        disbursementAccountId: l.disbursement_account_id,
        disbursedAt: l.disbursed_at,
        settledAt: l.settled_at,
        settlementType: l.settlement_type,
        reason: l.reason,
        notes: l.notes,
        createdAt: l.created_at,
      }));

      if (filters.search) {
        const q = filters.search.toLowerCase();
        mapped = mapped.filter(
          (m) => m.employeeName.toLowerCase().includes(q) || m.employeeNo.toLowerCase().includes(q)
        );
      }

      const total = count || mapped.length;
      return {
        data: mapped,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },
    enabled: isLive,
    staleTime: 15_000,
  });
}

// ============================================================================
// 3. LOAN INSTALLMENTS HOOK
// ============================================================================

export function useLoanInstallments(loanId?: string | null) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo && loanId);

  return useQuery({
    queryKey: queryKeys.loans.installments(loanId || ""),
    queryFn: async (): Promise<LoanInstallment[]> => {
      if (!isLive || !loanId) return [];
      const { data, error } = await (supabase as any)
        .from("loan_installments")
        .select("*")
        .eq("loan_id", loanId)
        .order("installment_number", { ascending: true });

      if (error) throw new Error(error.message);
      return (data || []).map((i: any) => ({
        id: i.id,
        loanId: i.loan_id,
        companyId: i.company_id,
        employeeId: i.employee_id,
        installmentNumber: i.installment_number,
        duePayrollPeriod: i.due_payroll_period,
        dueDate: i.due_date,
        principalAmount: Number(i.principal_amount),
        deductedAmount: Number(i.deducted_amount),
        remainingBalance: Number(i.remaining_balance),
        status: i.status,
        payrollRunId: i.payroll_run_id,
        recoveredAt: i.recovered_at,
      }));
    },
    enabled: isLive,
    staleTime: 15_000,
  });
}

// ============================================================================
// 4. LOAN MUTATIONS HOOK
// ============================================================================

export function useLoanMutations() {
  const queryClient = useQueryClient();

  const validateEligibility = useCallback(
    async (params: { employeeId: string; amount: number; installments: number; loanType?: string }) => {
      const { data, error } = await (supabase as any).rpc("validate_loan_eligibility", {
        p_employee_id: params.employeeId,
        p_amount: params.amount,
        p_installments: params.installments,
        p_loan_type: params.loanType || "personal_advance",
      });
      if (error) throw new Error(error.message);
      return data;
    },
    []
  );

  const submitLoanMutation = useMutation({
    mutationFn: async (params: {
      loanType: string;
      amount: number;
      installments: number;
      reason: string;
      employeeId?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("submit_loan_request_atomic", {
        p_loan_type: params.loanType,
        p_amount: params.amount,
        p_installments: params.installments,
        p_reason: params.reason,
        p_employee_id: params.employeeId || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("تم إرسال طلب السلفة بنجاح لمسار الاعتماد");
      void queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.payroll.loans() });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر تقديم طلب السلفة");
    },
  });

  const disburseLoanMutation = useMutation({
    mutationFn: async (params: {
      loanId: string;
      bankAccountId: string;
      externalRef?: string;
      notes?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("disburse_loan_atomic", {
        p_loan_id: params.loanId,
        p_bank_account_id: params.bankAccountId,
        p_external_ref: params.externalRef || null,
        p_notes: params.notes || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `تم صرف السلفة بنجاح بمبلغ ${data.disbursed_amount} ر.س وإنشاء جدول الأقساط المعتمد (${data.installments_created} قسط)`
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.company.bankAccounts() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.payroll.loans() });
    },
    onError: (err: any) => {
      toast.error(err.message || "فشلت عملية صرف السلفة");
    },
  });

  const settleEarlyMutation = useMutation({
    mutationFn: async (params: {
      loanId: string;
      paymentMethod?: string;
      receiptRef?: string;
      notes?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("settle_loan_early_atomic", {
        p_loan_id: params.loanId,
        p_payment_method: params.paymentMethod || "bank_transfer",
        p_receipt_ref: params.receiptRef || null,
        p_notes: params.notes || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`تم سداد وإغلاق السلفة بنجاح بقيمة ${data.settled_amount} ر.س`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.payroll.loans() });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر السداد المبكر للسلفة");
    },
  });

  return {
    validateEligibility,
    submitLoan: submitLoanMutation.mutateAsync,
    isSubmitting: submitLoanMutation.isPending,
    disburseLoan: disburseLoanMutation.mutateAsync,
    isDisbursing: disburseLoanMutation.isPending,
    settleEarly: settleEarlyMutation.mutateAsync,
    isSettlingEarly: settleEarlyMutation.isPending,
  };
}
