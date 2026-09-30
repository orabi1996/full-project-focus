import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "../query/query-keys";
import { useAuth } from "../auth/AuthContext";
import { uploadExpenseReceiptFile, rollbackUploadedFile } from "../storage";
import { demoStore, useDemoStore } from "../domains/demo/demo-store";

// ============================================================================
// 1. DOMAIN INTERFACES & TYPES
// ============================================================================

export type ExpensePaymentMethod = "employee_paid" | "corporate_card" | "company_paid" | "cash_advance";

export type ExpenseReimbursementStatus =
  | "not_applicable"
  | "unreimbursed"
  | "queued_in_batch"
  | "approved_for_payment"
  | "submitted_to_bank"
  | "reimbursed"
  | "transferred_to_payroll"
  | "failed"
  | "reversed";

export type ExpenseClaimStatus =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "returned"
  | "approved"
  | "rejected"
  | "cancelled";

export type ReimbursementPaymentStatus =
  | "prepared"
  | "approved_for_payment"
  | "submitted"
  | "transferred_to_payroll"
  | "confirmed_paid"
  | "failed"
  | "reversed";

export interface ExpenseCategory {
  id: string;
  companyId?: string;
  code: string;
  nameAr: string;
  nameEn: string;
  maxLimitWarning: number;
  maxLimitBlock: number;
  requiresReceipt: boolean;
  currency: string;
  accountingAccountCode: string;
  isActive: boolean;
  description?: string;
}

export interface ExpensePolicy {
  id: string;
  companyId: string;
  categoryId?: string | null;
  departmentId?: string | null;
  jobGrade?: string | null;
  employeeGroup?: string | null;
  singleTransactionLimit: number;
  monthlyLimit: number;
  annualLimit: number;
  receiptRequiredThreshold: number;
  requiresApproval: boolean;
  approvalChainCode: string;
  allowedPaymentMethods: ExpensePaymentMethod[];
  allowPayrollReimbursement: boolean;
  isActive: boolean;
}

export interface ExpenseClaimItem {
  id: string;
  claimId: string;
  categoryId: string;
  categoryNameAr?: string;
  itemDate: string;
  merchantName: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  convertedAmount: number;
  description: string;
  receiptFileId?: string | null;
  receiptUrl?: string | null;
  receiptHash?: string | null;
  taxAmount: number;
  policyWarningTriggered?: boolean;
  policyWarningNotes?: string | null;
}

export interface ExpenseClaim {
  id: string;
  companyId?: string;
  employeeId: string;
  employeeName?: string;
  employeeNo?: string;
  departmentName?: string;
  categoryId?: string;
  categoryNameAr: string;
  categoryNameEn?: string;
  claimNumber: string;
  title: string;
  businessJustification?: string;
  costCenterId?: string | null;
  projectCode?: string | null;
  paymentMethod: ExpensePaymentMethod;
  isReimbursable: boolean;
  amount: number;
  currency: string;
  exchangeRate: number;
  convertedAmount: number;
  spentAt: string;
  merchantName: string;
  receiptUrl?: string | null;
  receiptFileId?: string | null;
  description: string;
  status: ExpenseClaimStatus;
  policyWarningTriggered: boolean;
  policyWarningReason?: string | null;
  reimbursementBatchId?: string | null;
  reimbursementStatus: ExpenseReimbursementStatus;
  reimbursedAt?: string | null;
  reimbursedAmount?: number | null;
  reimbursementMethod?: string | null;
  duplicateFlag?: boolean;
  workflowRequestId?: string | null;
  version: number;
  createdAt: string;
  items?: ExpenseClaimItem[];
}

export interface ReimbursementBatch {
  id: string;
  companyId: string;
  batchNumber: string;
  periodKey: string;
  paymentMethod: "direct_bank_transfer" | "payroll" | "cash";
  currency: string;
  bankAccountId?: string | null;
  bankAccountName?: string | null;
  totalAmount: number;
  totalClaimsCount: number;
  totalEmployeesCount: number;
  paymentStatus: ReimbursementPaymentStatus;
  preparedBy?: string | null;
  preparedByName?: string | null;
  preparedAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  reversedBy?: string | null;
  reversedAt?: string | null;
  reversalReason?: string | null;
  bankReference?: string | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface ExpenseKpis {
  totalSubmittedAmount: number;
  totalSubmittedCount: number;
  pendingApprovalCount: number;
  approvedCount: number;
  approvedAmount: number;
  rejectedCount: number;
  returnedCount: number;
  awaitingReimbursementCount: number;
  awaitingReimbursementAmount: number;
  confirmedReimbursedCount: number;
  confirmedReimbursedAmount: number;
  categoriesBreakdown: Array<{
    categoryId: string;
    nameAr: string;
    nameEn: string;
    totalAmount: number;
    count: number;
  }>;
  departmentsBreakdown: Array<{
    departmentId: string;
    departmentName: string;
    totalAmount: number;
    count: number;
  }>;
}

export interface ExpenseFilterParams {
  search?: string;
  status?: string;
  reimbursementStatus?: string;
  paymentMethod?: string;
  categoryId?: string;
  departmentId?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// 2. QUERY HOOKS
// ============================================================================

export function useExpenseCategories() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoData = useDemoStore((s) => s.expenseCategories);

  return useQuery({
    queryKey: queryKeys.expenses.categories(),
    queryFn: async (): Promise<ExpenseCategory[]> => {
      if (!isLive) {
        return (demoData || []).map((cat) => ({
          id: cat.id,
          code: cat.nameEn?.toUpperCase().replace(/\s+/g, "_") || "EXP",
          nameAr: cat.nameAr,
          nameEn: cat.nameEn || cat.nameAr,
          maxLimitWarning: cat.maxLimitWarning,
          maxLimitBlock: cat.maxLimitBlock,
          requiresReceipt: cat.requiresReceipt,
          currency: "SAR",
          accountingAccountCode: "510100",
          isActive: true,
        }));
      }

      const { data, error } = await (supabase as any)
        .from("expense_categories")
        .select("*")
        .order("name_ar", { ascending: true });

      if (error) throw new Error(error.message);

      return (data || []).map((r: any) => ({
        id: r.id,
        companyId: r.company_id,
        code: r.code || "EXP",
        nameAr: r.name_ar,
        nameEn: r.name_en || r.name_ar,
        maxLimitWarning: Number(r.max_limit_warning || 1000),
        maxLimitBlock: Number(r.max_limit_block || 5000),
        requiresReceipt: Boolean(r.requires_receipt),
        currency: r.currency || "SAR",
        accountingAccountCode: r.accounting_account_code || "510100",
        isActive: r.is_active ?? true,
        description: r.description,
      }));
    },
    staleTime: 60_000,
  });
}

export function useExpensePolicies() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.expenses.policies(),
    queryFn: async (): Promise<ExpensePolicy[]> => {
      if (!isLive) return [];

      const { data, error } = await (supabase as any)
        .from("expense_policies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((p: any) => ({
        id: p.id,
        companyId: p.company_id,
        categoryId: p.category_id,
        departmentId: p.department_id,
        jobGrade: p.job_grade,
        employeeGroup: p.employee_group,
        singleTransactionLimit: Number(p.single_transaction_limit || 5000),
        monthlyLimit: Number(p.monthly_limit || 20000),
        annualLimit: Number(p.annual_limit || 100000),
        receiptRequiredThreshold: Number(p.receipt_required_threshold || 0),
        requiresApproval: Boolean(p.requires_approval),
        approvalChainCode: p.approval_chain_code || "expense_claim",
        allowedPaymentMethods: p.allowed_payment_methods || ["employee_paid"],
        allowPayrollReimbursement: Boolean(p.allow_payroll_reimbursement),
        isActive: Boolean(p.is_active),
      }));
    },
    enabled: isLive,
    staleTime: 60_000,
  });
}

export function useExpenseClaims(filters: ExpenseFilterParams = {}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoData = useDemoStore((s) => s.expenseClaims);

  return useQuery({
    queryKey: queryKeys.expenses.claims(filters as Record<string, unknown>),
    queryFn: async (): Promise<{
      data: ExpenseClaim[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }> => {
      if (!isLive) {
        let claims: ExpenseClaim[] = (demoData || []).map((c) => ({
          id: c.id,
          employeeId: c.employeeId,
          employeeName: "موظف النظام",
          categoryNameAr: c.categoryNameAr,
          categoryNameEn: c.categoryNameEn || c.categoryNameAr,
          claimNumber: `EXP-${c.id.slice(0, 8)}`,
          title: `مطالبة ${c.merchantName}`,
          paymentMethod: "employee_paid",
          isReimbursable: true,
          amount: c.amount,
          currency: c.currency || "SAR",
          exchangeRate: 1,
          convertedAmount: c.amount,
          spentAt: c.spentAt,
          merchantName: c.merchantName,
          receiptUrl: c.receiptUrl,
          receiptFileId: c.receiptFileId,
          description: c.description,
          status: c.status as ExpenseClaimStatus,
          policyWarningTriggered: Boolean(c.policyWarningTriggered),
          reimbursementStatus: (c.status === "approved" ? "unreimbursed" : "unreimbursed") as ExpenseReimbursementStatus,
          version: 1,
          createdAt: c.spentAt || new Date().toISOString(),
        }));

        if (filters.search) {
          const q = filters.search.toLowerCase();
          claims = claims.filter(
            (c) =>
              c.merchantName.toLowerCase().includes(q) ||
              c.description.toLowerCase().includes(q) ||
              c.categoryNameAr.toLowerCase().includes(q)
          );
        }

        if (filters.status && filters.status !== "all") {
          claims = claims.filter((c) => c.status === filters.status);
        }

        return {
          data: claims,
          total: claims.length,
          page: 1,
          pageSize: 50,
          totalPages: 1,
        };
      }

      const page = filters.page || 1;
      const pageSize = filters.pageSize || 50;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = (supabase as any)
        .from("expense_claims")
        .select(
          `
          *,
          employee:employee_id(id, first_name_ar, last_name_ar, employee_no, department:department_id(name_ar)),
          category:category_id(id, name_ar, name_en)
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.reimbursementStatus && filters.reimbursementStatus !== "all") {
        query = query.eq("reimbursement_status", filters.reimbursementStatus);
      }
      if (filters.paymentMethod && filters.paymentMethod !== "all") {
        query = query.eq("payment_method", filters.paymentMethod);
      }
      if (filters.categoryId && filters.categoryId !== "all") {
        query = query.eq("category_id", filters.categoryId);
      }
      if (filters.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
      }
      if (filters.dateFrom) {
        query = query.gte("spent_at", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("spent_at", filters.dateTo);
      }

      const { data, count, error } = await query;
      if (error) throw new Error(error.message);

      let mapped: ExpenseClaim[] = (data || []).map((row: any) => ({
        id: row.id,
        companyId: row.company_id,
        employeeId: row.employee_id,
        employeeName: row.employee
          ? `${row.employee.first_name_ar || ""} ${row.employee.last_name_ar || ""}`.trim()
          : "موظف",
        employeeNo: row.employee?.employee_no || "",
        departmentName: row.employee?.department?.name_ar || "",
        categoryId: row.category_id,
        categoryNameAr: row.category?.name_ar || "مصروفات عامة",
        categoryNameEn: row.category?.name_en || "General",
        claimNumber: row.claim_number || `EXP-${row.id.slice(0, 8)}`,
        title: row.title || `مطالبة ${row.merchant_name}`,
        businessJustification: row.business_justification || row.description,
        costCenterId: row.cost_center_id,
        projectCode: row.project_code,
        paymentMethod: row.payment_method || "employee_paid",
        isReimbursable: Boolean(row.is_reimbursable),
        amount: Number(row.amount),
        currency: row.currency || "SAR",
        exchangeRate: Number(row.exchange_rate || 1),
        convertedAmount: Number(row.converted_amount || row.amount),
        spentAt: row.spent_at,
        merchantName: row.merchant_name,
        receiptUrl: row.receipt_url,
        receiptFileId: row.receipt_file_id,
        description: row.description || "",
        status: row.status,
        policyWarningTriggered: Boolean(row.policy_warning_triggered),
        policyWarningReason: row.policy_warning_reason,
        reimbursementBatchId: row.reimbursement_batch_id,
        reimbursementStatus: row.reimbursement_status || "unreimbursed",
        reimbursedAt: row.reimbursed_at,
        reimbursedAmount: row.reimbursed_amount ? Number(row.reimbursed_amount) : null,
        reimbursementMethod: row.reimbursement_method,
        duplicateFlag: Boolean(row.duplicate_flag),
        workflowRequestId: row.workflow_request_id,
        version: row.version || 1,
        createdAt: row.created_at,
      }));

      if (filters.search) {
        const q = filters.search.toLowerCase();
        mapped = mapped.filter(
          (m) =>
            m.claimNumber.toLowerCase().includes(q) ||
            m.employeeName?.toLowerCase().includes(q) ||
            m.merchantName.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q)
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
    enabled: true,
    staleTime: 15_000,
  });
}

export function useExpenseClaimItems(claimId?: string | null) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo && claimId);

  return useQuery({
    queryKey: queryKeys.expenses.items(claimId || ""),
    queryFn: async (): Promise<ExpenseClaimItem[]> => {
      if (!isLive || !claimId) return [];

      const { data, error } = await (supabase as any)
        .from("expense_claim_items")
        .select(`
          *,
          category:category_id(id, name_ar, name_en)
        `)
        .eq("claim_id", claimId)
        .order("item_date", { ascending: true });

      if (error) throw new Error(error.message);

      return (data || []).map((i: any) => ({
        id: i.id,
        claimId: i.claim_id,
        categoryId: i.category_id,
        categoryNameAr: i.category?.name_ar || "",
        itemDate: i.item_date,
        merchantName: i.merchant_name,
        amount: Number(i.amount),
        currency: i.currency || "SAR",
        exchangeRate: Number(i.exchange_rate || 1),
        convertedAmount: Number(i.converted_amount || i.amount),
        description: i.description || "",
        receiptFileId: i.receipt_file_id,
        receiptUrl: i.receipt_url,
        receiptHash: i.receipt_hash,
        taxAmount: Number(i.tax_amount || 0),
        policyWarningTriggered: Boolean(i.policy_warning_triggered),
        policyWarningNotes: i.policy_warning_notes,
      }));
    },
    enabled: isLive,
    staleTime: 30_000,
  });
}

export function useReimbursementBatches(filters: Record<string, unknown> = {}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.expenses.batches(filters),
    queryFn: async (): Promise<ReimbursementBatch[]> => {
      if (!isLive) return [];

      const { data, error } = await (supabase as any)
        .from("reimbursement_batches")
        .select(`
          *,
          bank_account:bank_account_id(bank_name, account_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((b: any) => ({
        id: b.id,
        companyId: b.company_id,
        batchNumber: b.batch_number,
        periodKey: b.period_key,
        paymentMethod: b.payment_method,
        currency: b.currency || "SAR",
        bankAccountId: b.bank_account_id,
        bankAccountName: b.bank_account
          ? `${b.bank_account.bank_name} - ${b.bank_account.account_name}`
          : undefined,
        totalAmount: Number(b.total_amount),
        totalClaimsCount: Number(b.total_claims_count || 0),
        totalEmployeesCount: Number(b.total_employees_count || 0),
        paymentStatus: b.payment_status,
        preparedBy: b.prepared_by,
        preparedAt: b.prepared_at,
        approvedBy: b.approved_by,
        approvedAt: b.approved_at,
        confirmedBy: b.confirmed_by,
        confirmedAt: b.confirmed_at,
        reversedBy: b.reversed_by,
        reversedAt: b.reversed_at,
        reversalReason: b.reversal_reason,
        bankReference: b.bank_reference,
        idempotencyKey: b.idempotency_key,
        notes: b.notes,
        createdAt: b.created_at,
      }));
    },
    enabled: isLive,
    staleTime: 15_000,
  });
}

export function useExpenseKpis() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoData = useDemoStore((s) => s.expenseClaims);

  return useQuery({
    queryKey: queryKeys.expenses.kpis(),
    queryFn: async (): Promise<ExpenseKpis> => {
      if (!isLive) {
        const claims = demoData || [];
        const total = claims.reduce((acc, c) => acc + c.amount, 0);
        const approved = claims.filter((c) => c.status === "approved");
        const pending = claims.filter((c) => c.status !== "approved");

        return {
          totalSubmittedAmount: total,
          totalSubmittedCount: claims.length,
          pendingApprovalCount: pending.length,
          approvedCount: approved.length,
          approvedAmount: approved.reduce((acc, c) => acc + c.amount, 0),
          rejectedCount: 0,
          returnedCount: 0,
          awaitingReimbursementCount: approved.length,
          awaitingReimbursementAmount: approved.reduce((acc, c) => acc + c.amount, 0),
          confirmedReimbursedCount: 0,
          confirmedReimbursedAmount: 0,
          categoriesBreakdown: [],
          departmentsBreakdown: [],
        };
      }

      const { data, error } = await (supabase as any).rpc("get_expense_kpis_atomic");
      if (error) throw new Error(error.message);

      return data as ExpenseKpis;
    },
    staleTime: 15_000,
  });
}

// ============================================================================
// 3. MUTATIONS HOOK
// ============================================================================

export function useExpenseMutations() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const validateClaim = useCallback(
    async (params: {
      employeeId: string;
      paymentMethod: ExpensePaymentMethod;
      items: Array<{
        categoryId: string;
        itemDate: string;
        merchantName: string;
        amount: number;
        currency?: string;
        description?: string;
        receiptUrl?: string;
        receiptFileId?: string;
      }>;
    }) => {
      if (!isLive) {
        return { is_valid: true, errors: [], warnings: [], total_amount: 0, total_converted: 0 };
      }

      const { data, error } = await (supabase as any).rpc("validate_expense_claim_atomic", {
        p_employee_id: params.employeeId,
        p_payment_method: params.paymentMethod,
        p_items: params.items,
      });

      if (error) throw new Error(error.message);
      return data;
    },
    [isLive]
  );

  const submitClaimMutation = useMutation({
    mutationFn: async (params: {
      title?: string;
      justification?: string;
      costCenterId?: string;
      projectCode?: string;
      paymentMethod: ExpensePaymentMethod;
      items: Array<{
        categoryId: string;
        itemDate: string;
        merchantName: string;
        amount: number;
        currency?: string;
        description?: string;
        receiptFile?: File;
        receiptUrl?: string;
        receiptFileId?: string;
        taxAmount?: number;
      }>;
      idempotencyKey?: string;
    }) => {
      // 1. Process files upload securely
      const preparedItems = [];
      const uploadedFileIds: string[] = [];

      for (const item of params.items) {
        let receiptFileId = item.receiptFileId;
        let receiptUrl = item.receiptUrl;

        if (item.receiptFile && isLive) {
          try {
            const expId = crypto.randomUUID();
            const uploaded = await uploadExpenseReceiptFile({
              employeeId: session?.user?.id || "temp",
              expenseId: expId,
              file: item.receiptFile,
            });
            receiptFileId = uploaded.id;
            receiptUrl = uploaded.object_path;
            uploadedFileIds.push(uploaded.id);
          } catch (err: any) {
            // Rollback already uploaded files on failure
            for (const fId of uploadedFileIds) {
              await rollbackUploadedFile({ fileId: fId }).catch(() => null);
            }
            throw new Error(`فشل رفع إيصال المصروف: ${err.message || ""}`);
          }
        }

        preparedItems.push({
          categoryId: item.categoryId,
          itemDate: item.itemDate,
          merchantName: item.merchantName,
          amount: item.amount,
          currency: item.currency || "SAR",
          description: item.description || "",
          receiptUrl,
          receiptFileId,
          taxAmount: item.taxAmount || 0,
        });
      }

      // Demo fallback
      if (!isLive) {
        const first = preparedItems[0];
        const newClaim = {
          id: `exp-${Date.now()}`,
          employeeId: session?.user?.id || "demo-emp",
          categoryId: first?.categoryId,
          categoryNameAr: "نفقات أعمال",
          categoryNameEn: "Business",
          amount: preparedItems.reduce((acc, i) => acc + i.amount, 0),
          currency: first?.currency || "SAR",
          spentAt: first?.itemDate || new Date().toISOString().split("T")[0],
          merchantName: first?.merchantName || "مورد",
          description: params.justification || "مصروف أعمال",
          status: "submitted",
          policyWarningTriggered: false,
        };
        demoStore.expenseClaims = [newClaim as any, ...demoStore.expenseClaims];
        demoStore.notify();
        return { ok: true, claim_id: newClaim.id };
      }

      // Live RPC
      const { data, error } = await (supabase as any).rpc("submit_expense_claim_atomic", {
        p_title: params.title || null,
        p_justification: params.justification || null,
        p_cost_center_id: params.costCenterId || null,
        p_project_code: params.projectCode || null,
        p_payment_method: params.paymentMethod,
        p_items: preparedItems,
        p_idempotency_key: params.idempotencyKey || null,
      });

      if (error) {
        // Rollback uploaded files if DB insert failed
        for (const fId of uploadedFileIds) {
          await rollbackUploadedFile({ fileId: fId }).catch(() => null);
        }
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success("تم إرسال مطالبة المصروفات بنجاح إلى مسار الاعتماد");
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر تقديم مطالبة المصروفات");
    },
  });

  const prepareBatchMutation = useMutation({
    mutationFn: async (params: {
      periodKey: string;
      claimIds: string[];
      paymentMethod?: "direct_bank_transfer" | "payroll" | "cash";
      bankAccountId?: string;
      notes?: string;
      idempotencyKey?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("prepare_reimbursement_batch_atomic", {
        p_period_key: params.periodKey,
        p_claim_ids: params.claimIds,
        p_payment_method: params.paymentMethod || "direct_bank_transfer",
        p_bank_account_id: params.bankAccountId || null,
        p_notes: params.notes || null,
        p_idempotency_key: params.idempotencyKey || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `تم تجهيز دفعة الصرف رقم (${data.batch_number}) بنجاح بقيمة إجمالية ${Number(data.total_amount).toLocaleString()} ر.س`
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر تجهيز دفعة الصرف");
    },
  });

  const approveBatchForPaymentMutation = useMutation({
    mutationFn: async (params: { batchId: string; notes?: string }) => {
      const { data, error } = await (supabase as any).rpc(
        "approve_reimbursement_batch_for_payment_atomic",
        {
          p_batch_id: params.batchId,
          p_notes: params.notes || null,
        }
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("تم اعتماد دفعة الصرف المالي بنجاح وجاهزة للتنفيذ المصرفي");
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر اعتماد دفعة الصرف");
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (params: { batchId: string; bankReference: string; notes?: string }) => {
      const { data, error } = await (supabase as any).rpc("confirm_reimbursement_payment_atomic", {
        p_batch_id: params.batchId,
        p_bank_reference: params.bankReference,
        p_notes: params.notes || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`تم تأكيد صرف الدفعة بنجاح وقيد السداد بالبنك برقم مرجعي: ${data.bank_reference}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.company.bankAccounts() });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر تأكيد سداد دفعة المصروفات");
    },
  });

  const reverseBatchMutation = useMutation({
    mutationFn: async (params: { batchId: string; reason: string }) => {
      const { data, error } = await (supabase as any).rpc("reverse_reimbursement_batch_atomic", {
        p_batch_id: params.batchId,
        p_reason: params.reason,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("تم عكس دفعة المصروفات وإعادة المطالبات لقائمة المستحقات غير المصروفة بنجاح");
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.company.bankAccounts() });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر عكس دفعة المصروفات");
    },
  });

  const transferToPayrollMutation = useMutation({
    mutationFn: async (params: { batchId: string; payrollRunId: string }) => {
      const { data, error } = await (supabase as any).rpc(
        "transfer_reimbursement_to_payroll_atomic",
        {
          p_batch_id: params.batchId,
          p_payroll_run_id: params.payrollRunId,
        }
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`تم ترحيل ${data.transferred_count} بنود تعويض إلى مسير الرواتب بنجاح`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all });
    },
    onError: (err: any) => {
      toast.error(err.message || "فشل ترحيل التعويضات لمسير الرواتب");
    },
  });

  const resubmitClaimMutation = useMutation({
    mutationFn: async (params: {
      claimId: string;
      items: any[];
      justification?: string;
      note?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("resubmit_expense_claim_atomic", {
        p_claim_id: params.claimId,
        p_items: params.items,
        p_justification: params.justification || null,
        p_note: params.note || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("تمت إعادة تقديم المطالبة بنجاح وإرسالها للموافقة");
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر إعادة تقديم المطالبة");
    },
  });

  const addCategoryMutation = useMutation({
    mutationFn: async (params: {
      nameAr: string;
      nameEn?: string;
      code?: string;
      warningLimit: number;
      blockLimit: number;
      requiresReceipt?: boolean;
      accountingAccountCode?: string;
      description?: string;
    }) => {
      if (!isLive) {
        const cat = {
          id: `cat-${Date.now()}`,
          nameAr: params.nameAr,
          nameEn: params.nameEn || params.nameAr,
          icon: "Receipt",
          maxLimitWarning: params.warningLimit,
          maxLimitBlock: params.blockLimit,
          requiresReceipt: params.requiresReceipt ?? true,
        };
        demoStore.expenseCategories = [...demoStore.expenseCategories, cat as any];
        demoStore.notify();
        return cat;
      }

      const { data, error } = await (supabase as any).from("expense_categories").insert({
        name_ar: params.nameAr,
        name_en: params.nameEn || params.nameAr,
        code: params.code || params.nameEn?.toUpperCase().replace(/\s+/g, "_") || "EXP",
        max_limit_warning: params.warningLimit,
        max_limit_block: params.blockLimit,
        requires_receipt: params.requiresReceipt ?? true,
        accounting_account_code: params.accountingAccountCode || "510100",
        description: params.description || null,
      }).select().single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("تمت إضافة فئة المصروفات وتعيين حدودها المالية بنجاح");
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses.categories() });
    },
    onError: (err: any) => {
      toast.error(err.message || "فشلت إضافة فئة المصروفات");
    },
  });

  return {
    validateClaim,
    submitClaim: submitClaimMutation.mutateAsync,
    isSubmitting: submitClaimMutation.isPending,
    prepareBatch: prepareBatchMutation.mutateAsync,
    isPreparingBatch: prepareBatchMutation.isPending,
    approveBatchForPayment: approveBatchForPaymentMutation.mutateAsync,
    isApprovingBatch: approveBatchForPaymentMutation.isPending,
    confirmPayment: confirmPaymentMutation.mutateAsync,
    isConfirmingPayment: confirmPaymentMutation.isPending,
    reverseBatch: reverseBatchMutation.mutateAsync,
    isReversingBatch: reverseBatchMutation.isPending,
    transferToPayroll: transferToPayrollMutation.mutateAsync,
    isTransferringToPayroll: transferToPayrollMutation.isPending,
    resubmitClaim: resubmitClaimMutation.mutateAsync,
    isResubmitting: resubmitClaimMutation.isPending,
    addCategory: addCategoryMutation.mutateAsync,
    isAddingCategory: addCategoryMutation.isPending,
  };
}
