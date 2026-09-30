import React, { useState, useRef } from "react";
import { useApp } from "../../lib/context/AppContext";
import { exportToCSV } from "../../lib/utils/export-helpers";
import { canManageModule } from "../../lib/auth/permissions";
import { IconSymbol } from "../ui/IconSymbol";
import {
  Receipt,
  Plus,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Upload,
  CreditCard,
  Building,
  DollarSign,
  Download,
  Settings,
  Eye,
  X,
  Search,
  Filter,
  Landmark,
  ArrowRight,
  RotateCcw,
  Clock,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Trash2,
  Send,
  Wallet,
} from "lucide-react";
import { createSignedDownloadUrl, getSignedUrlForFileId } from "../../lib/storage";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { toast } from "sonner";
import {
  useExpenseCategories,
  useExpensePolicies,
  useExpenseClaims,
  useExpenseClaimItems,
  useReimbursementBatches,
  useExpenseKpis,
  useExpenseMutations,
  type ExpenseClaim,
  type ExpensePaymentMethod,
} from "../../lib/data/expenses-repository";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/query-keys";
import { supabase } from "@/integrations/supabase/client";

interface NewItemLine {
  id: string;
  categoryId: string;
  itemDate: string;
  merchantName: string;
  amount: number;
  currency: string;
  description: string;
  taxAmount: number;
  receiptFile: File | null;
}

export const ExpensesView: React.FC = () => {
  const { currentUser, currentRole, language, t } = useApp();
  const canManage = canManageModule(currentRole, "expenses");
  const isFinanceOrAdmin = [
    "super_admin",
    "org_admin",
    "hr_manager",
    "finance_officer",
    "payroll_officer",
  ].includes(currentRole);
  const canSubmitClaim = currentRole !== "auditor";

  const [activeTab, setActiveTab] = useState<string>("claims");

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [reimbursementFilter, setReimbursementFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Queries
  const { data: categories = [], isLoading: isCategoriesLoading } = useExpenseCategories();
  const { data: policies = [] } = useExpensePolicies();
  const {
    data: claimsResponse,
    isLoading: isClaimsLoading,
    refetch: refetchClaims,
  } = useExpenseClaims({
    search: searchTerm,
    status: statusFilter,
    paymentMethod: paymentMethodFilter,
    reimbursementStatus: reimbursementFilter,
    categoryId: categoryFilter,
  });
  const claims = claimsResponse?.data || [];

  const { data: batches = [], refetch: refetchBatches } = useReimbursementBatches();
  const { data: kpis, refetch: refetchKpis } = useExpenseKpis();

  // Bank Accounts query for reimbursement
  const { data: bankAccounts = [] } = useQuery({
    queryKey: queryKeys.company.bankAccounts(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("company_bank_accounts")
        .select("*")
        .order("is_primary", { ascending: false });
      if (error) return [];
      return data || [];
    },
    staleTime: 60_000,
  });

  // Payroll runs query for transfer to payroll
  const { data: payrollRuns = [] } = useQuery({
    queryKey: queryKeys.payroll.runs(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payroll_runs")
        .select("id, period_year, period_month, status, total_net")
        .neq("status", "paid")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    staleTime: 30_000,
  });

  // Mutations
  const {
    validateClaim,
    submitClaim,
    isSubmitting,
    prepareBatch,
    isPreparingBatch,
    approveBatchForPayment,
    isApprovingBatch,
    confirmPayment,
    isConfirmingPayment,
    reverseBatch,
    isReversingBatch,
    transferToPayroll,
    isTransferringToPayroll,
    resubmitClaim,
    isResubmitting,
    addCategory,
    isAddingCategory,
  } = useExpenseMutations();

  // Modals State
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [selectedClaimForDetail, setSelectedClaimForDetail] = useState<ExpenseClaim | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Reimbursement Batch Modal State
  const [selectedClaimIdsForBatch, setSelectedClaimIdsForBatch] = useState<string[]>([]);
  const [isPrepareBatchModalOpen, setIsPrepareBatchModalOpen] = useState(false);
  const [batchPeriodKey, setBatchPeriodKey] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [batchPaymentMethod, setBatchPaymentMethod] = useState<"direct_bank_transfer" | "payroll">("direct_bank_transfer");
  const [batchBankAccountId, setBatchBankAccountId] = useState<string>("");
  const [batchNotes, setBatchNotes] = useState("");

  // Payment Confirmation Modal State
  const [selectedBatchForConfirm, setSelectedBatchForConfirm] = useState<any>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [bankReference, setBankReference] = useState("");

  // Reverse Batch Modal State
  const [selectedBatchForReverse, setSelectedBatchForReverse] = useState<any>(null);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState("");

  // Transfer to Payroll Modal State
  const [selectedBatchForPayroll, setSelectedBatchForPayroll] = useState<any>(null);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [selectedPayrollRunId, setSelectedPayrollRunId] = useState("");

  // Multi-line New Claim Form State
  const [claimTitle, setClaimTitle] = useState("");
  const [businessJustification, setBusinessJustification] = useState("");
  const [claimPaymentMethod, setClaimPaymentMethod] = useState<ExpensePaymentMethod>("employee_paid");
  const [projectCode, setProjectCode] = useState("");
  const [itemLines, setItemLines] = useState<NewItemLine[]>([
    {
      id: "line-1",
      categoryId: categories[0]?.id || "",
      itemDate: new Date().toISOString().split("T")[0],
      merchantName: "",
      amount: 0,
      currency: "SAR",
      description: "",
      taxAmount: 0,
      receiptFile: null,
    },
  ]);

  // Category Form State
  const [newCatNameAr, setNewCatNameAr] = useState("");
  const [newCatNameEn, setNewCatNameEn] = useState("");
  const [newCatCode, setNewCatCode] = useState("");
  const [newCatWarning, setNewCatWarning] = useState(1500);
  const [newCatBlock, setNewCatBlock] = useState(6000);
  const [newCatRequiresReceipt, setNewCatRequiresReceipt] = useState(true);
  const [newCatAccountCode, setNewCatAccountCode] = useState("510100");

  // Selected Claim Items Query
  const { data: claimItems = [] } = useExpenseClaimItems(selectedClaimForDetail?.id);

  // Line item helpers
  const handleAddItemLine = () => {
    setItemLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        categoryId: categories[0]?.id || "",
        itemDate: new Date().toISOString().split("T")[0],
        merchantName: "",
        amount: 0,
        currency: "SAR",
        description: "",
        taxAmount: 0,
        receiptFile: null,
      },
    ]);
  };

  const handleRemoveItemLine = (id: string) => {
    if (itemLines.length === 1) {
      toast.error("يجب إبقاء بند واحد على الأقل في المطالبة");
      return;
    }
    setItemLines((prev) => prev.filter((line) => line.id !== id));
  };

  const handleUpdateItemLine = (id: string, field: keyof NewItemLine, val: any) => {
    setItemLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: val } : line))
    );
  };

  // Calculations
  const claimTotalAmount = itemLines.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const claimTotalTax = itemLines.reduce((acc, curr) => acc + (Number(curr.taxAmount) || 0), 0);

  // Secure Receipt Viewer
  const handleViewReceipt = async (receiptFileId?: string | null, receiptUrl?: string | null) => {
    try {
      if (receiptFileId) {
        toast.info("جاري تجهيز رابط الإيصال الآمن...");
        const result = await getSignedUrlForFileId(receiptFileId);
        window.open(result.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (receiptUrl) {
        if (!receiptUrl.startsWith("http") && !receiptUrl.startsWith("blob:")) {
          toast.info("جاري تجهيز رابط الإيصال الآمن...");
          const result = await createSignedDownloadUrl("expense-receipts", receiptUrl);
          window.open(result.signedUrl, "_blank", "noopener,noreferrer");
          return;
        }
        window.open(receiptUrl, "_blank", "noopener,noreferrer");
        return;
      }
      toast.error("لا يوجد إيصال مرفق مع هذا البند");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذر فتح الإيصال";
      toast.error(msg);
    }
  };

  // Submit Claim Handler
  const handleSubmitClaim = async () => {
    if (!claimTitle.trim()) {
      toast.error("يرجى إدخال عنوان أو موضوع مطالبة المصروفات");
      return;
    }
    if (itemLines.length === 0) {
      toast.error("يجب إضافة بند واحد على الأقل للمطالبة");
      return;
    }

    for (const [idx, item] of itemLines.entries()) {
      if (!item.categoryId) {
        toast.error(`يرجى تحديد تصنيف المصروف للبند رقم ${idx + 1}`);
        return;
      }
      if (!item.merchantName.trim()) {
        toast.error(`يرجى إدخال اسم المورد للبند رقم ${idx + 1}`);
        return;
      }
      if (!item.amount || item.amount <= 0) {
        toast.error(`يرجى إدخال مبلغ صحيح للبند رقم ${idx + 1}`);
        return;
      }

      // Check category receipt rule
      const cat = categories.find((c) => c.id === item.categoryId);
      if (cat?.requiresReceipt && !item.receiptFile) {
        toast.error(`الفاتورة / الإيصال إلزامية لفئة (${cat.nameAr}) في البند رقم ${idx + 1}`);
        return;
      }

      if (cat?.maxLimitBlock && item.amount > cat.maxLimitBlock) {
        toast.error(`المبلغ في البند رقم ${idx + 1} يتجاوز الحد المانع لفئة (${cat.nameAr}) البالغ ${cat.maxLimitBlock} ر.س`);
        return;
      }
    }

    try {
      await submitClaim({
        title: claimTitle,
        justification: businessJustification,
        paymentMethod: claimPaymentMethod,
        projectCode: projectCode || undefined,
        items: itemLines.map((line) => ({
          categoryId: line.categoryId,
          itemDate: line.itemDate,
          merchantName: line.merchantName,
          amount: Number(line.amount),
          currency: line.currency,
          description: line.description || claimTitle,
          receiptFile: line.receiptFile || undefined,
          taxAmount: Number(line.taxAmount) || 0,
        })),
      });

      setIsClaimModalOpen(false);
      setClaimTitle("");
      setBusinessJustification("");
      setItemLines([
        {
          id: "line-1",
          categoryId: categories[0]?.id || "",
          itemDate: new Date().toISOString().split("T")[0],
          merchantName: "",
          amount: 0,
          currency: "SAR",
          description: "",
          taxAmount: 0,
          receiptFile: null,
        },
      ]);
    } catch {
      // error handled in mutation hook
    }
  };

  // Add Category Handler
  const handleCreateCategory = async () => {
    if (!newCatNameAr.trim()) {
      toast.error("يرجى كتابة اسم فئة المصروف باللغة العربية");
      return;
    }
    try {
      await addCategory({
        nameAr: newCatNameAr,
        nameEn: newCatNameEn || newCatNameAr,
        code: newCatCode || undefined,
        warningLimit: newCatWarning,
        blockLimit: newCatBlock,
        requiresReceipt: newCatRequiresReceipt,
        accountingAccountCode: newCatAccountCode,
      });
      setIsAddCatModalOpen(false);
      setNewCatNameAr("");
      setNewCatNameEn("");
      setNewCatCode("");
    } catch {
      // error handled in hook
    }
  };

  // Batch Preparation Handler
  const handlePrepareBatchSubmit = async () => {
    if (selectedClaimIdsForBatch.length === 0) {
      toast.error("يرجى تحديد مطالبة واحدة على الأقل لإدراجها في دفعة الصرف");
      return;
    }
    if (batchPaymentMethod === "direct_bank_transfer" && !batchBankAccountId) {
      toast.error("يرجى تحديد حساب الشركة البنكي المخصوم منه الصرف");
      return;
    }

    try {
      await prepareBatch({
        periodKey: batchPeriodKey,
        claimIds: selectedClaimIdsForBatch,
        paymentMethod: batchPaymentMethod,
        bankAccountId: batchPaymentMethod === "direct_bank_transfer" ? batchBankAccountId : undefined,
        notes: batchNotes || undefined,
      });
      setIsPrepareBatchModalOpen(false);
      setSelectedClaimIdsForBatch([]);
      setBatchNotes("");
    } catch {
      // error handled in hook
    }
  };

  // Payment Confirmation Submit
  const handleConfirmPaymentSubmit = async () => {
    if (!selectedBatchForConfirm) return;
    if (!bankReference.trim()) {
      toast.error("يرجى إدخال الرقم المرجعي للتحويل البنكي أو إشعار الخصم");
      return;
    }
    try {
      await confirmPayment({
        batchId: selectedBatchForConfirm.id,
        bankReference,
      });
      setIsConfirmModalOpen(false);
      setSelectedBatchForConfirm(null);
      setBankReference("");
    } catch {
      // error handled in hook
    }
  };

  // Reverse Batch Submit
  const handleReverseBatchSubmit = async () => {
    if (!selectedBatchForReverse) return;
    if (!reversalReason.trim()) {
      toast.error("يرجى توضيح سبب إلغاء أو عكس دفعة الصرف");
      return;
    }
    try {
      await reverseBatch({
        batchId: selectedBatchForReverse.id,
        reason: reversalReason,
      });
      setIsReverseModalOpen(false);
      setSelectedBatchForReverse(null);
      setReversalReason("");
    } catch {
      // error handled in hook
    }
  };

  // Transfer to Payroll Submit
  const handleTransferToPayrollSubmit = async () => {
    if (!selectedBatchForPayroll || !selectedPayrollRunId) {
      toast.error("يرجى اختيار مسير الرواتب المستهدف للترحيل");
      return;
    }
    try {
      await transferToPayroll({
        batchId: selectedBatchForPayroll.id,
        payrollRunId: selectedPayrollRunId,
      });
      setIsPayrollModalOpen(false);
      setSelectedBatchForPayroll(null);
    } catch {
      // error handled in hook
    }
  };

  // Export to CSV
  const handleExportExpenses = () => {
    const data = claims.map((c) => ({
      "رقم المطالبة": c.claimNumber,
      الموظف: c.employeeName || "",
      "الرقم الوظيفي": c.employeeNo || "",
      القسم: c.departmentName || "",
      التصنيف: c.categoryNameAr,
      "المورد / الجهة": c.merchantName,
      الوصف: c.description,
      التاريخ: c.spentAt,
      المبلغ: c.amount,
      العملة: c.currency,
      "المبلغ المعادل (ر.س)": c.convertedAmount,
      "طريقة الدفع": c.paymentMethod === "employee_paid" ? "مدفوع من الموظف" : "بطاقة مؤسسية / شركة",
      "حالة الاعتماد": c.status,
      "حالة الصرف والتعويض": c.reimbursementStatus,
      "تاريخ الصرف": c.reimbursedAt || "—",
    }));
    exportToCSV(`Expense_Claims_${new Date().toISOString().split("T")[0]}`, data);
  };

  // Status Badge Colors Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-bold">معتمد</Badge>;
      case "pending_approval":
      case "submitted":
        return <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 font-bold">قيد الاعتماد</Badge>;
      case "returned":
        return <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 font-bold">معاد للموظف</Badge>;
      case "rejected":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30 font-bold">مرفوض</Badge>;
      case "cancelled":
        return <Badge className="bg-muted text-muted-foreground border-border font-bold">ملغي</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReimbursementBadge = (status: string, method?: string) => {
    switch (status) {
      case "reimbursed":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-400 font-bold">
            تم الصرف {method === "payroll" ? "(رواتب)" : "(بنك)"}
          </Badge>
        );
      case "transferred_to_payroll":
        return <Badge className="bg-purple-500/15 text-purple-700 border-purple-400 font-bold">مرحل للرواتب</Badge>;
      case "queued_in_batch":
        return <Badge className="bg-indigo-500/15 text-indigo-700 border-indigo-400 font-bold">مجدول بدفعة</Badge>;
      case "approved_for_payment":
        return <Badge className="bg-teal-500/15 text-teal-700 border-teal-400 font-bold">معتمد للصرف</Badge>;
      case "unreimbursed":
        return <Badge className="bg-amber-500/15 text-amber-800 border-amber-300 font-bold">بانتظار الصرف</Badge>;
      case "reversed":
        return <Badge className="bg-rose-500/15 text-rose-700 border-rose-300 font-bold">معكوس</Badge>;
      case "not_applicable":
      default:
        return <span className="text-[10px] text-muted-foreground font-semibold">غير خاضع للتعويض</span>;
    }
  };

  const getBatchStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed_paid":
        return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-400 font-bold">تم السداد والخصم</Badge>;
      case "approved_for_payment":
        return <Badge className="bg-blue-500/15 text-blue-700 border-blue-400 font-bold">معتمد للصرف</Badge>;
      case "prepared":
        return <Badge className="bg-amber-500/15 text-amber-700 border-amber-400 font-bold">مجهز ومراجع</Badge>;
      case "reversed":
        return <Badge className="bg-rose-500/15 text-rose-700 border-rose-400 font-bold">معكوس / ملغي</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const approvedReimbursableClaims = claims.filter(
    (c) => c.status === "approved" && c.isReimbursable && c.reimbursementStatus === "unreimbursed"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <IconSymbol name="receipt_long" source="material" filled size={16} />
              منظومة المصروفات والتعويضات المالية
            </span>
          </div>
          <h1 className="text-2xl font-black text-foreground mt-2">
            إدارة النفقات والتعويضات المؤسسية
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            إدارة دورة حياة المطالبات المتعددة، سياسات الصرف المالي، مسارات الاعتماد، ودفعات التحويل والرواتب
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {canSubmitClaim && (
            <Button
              onClick={() => setIsClaimModalOpen(true)}
              size="sm"
              className="classera-btn-primary h-10 px-5 text-xs gap-1.5 font-bold shadow-xs"
            >
              <Plus className="h-4 w-4" />
              مطالبة مصروفات جديدة
            </Button>
          )}
          {canManage && (
            <Button
              onClick={() => setIsAddCatModalOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
            >
              <Settings className="h-4 w-4 text-primary" />
              إضافة فئة وسياسة
            </Button>
          )}
          <Button
            onClick={handleExportExpenses}
            variant="secondary"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs"
          >
            <Download className="h-4 w-4 text-primary" />
            تصدير (Excel/CSV)
          </Button>
        </div>
      </div>

      {/* KPI Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">إجمالي المطالبات</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {(kpis?.totalSubmittedAmount || 0).toLocaleString()} <span className="text-xs font-normal">ر.س</span>
            </h4>
            <span className="text-[10px] text-muted-foreground font-semibold">
              {kpis?.totalSubmittedCount || 0} مطالبة مقدمة
            </span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Receipt className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">بانتظار الاعتماد</span>
            <h4 className="text-xl font-black text-amber-600 mt-0.5 font-tabular-nums font-mono">
              {kpis?.pendingApprovalCount || 0}
            </h4>
            <span className="text-[10px] text-amber-600/80 font-bold">بانتظار دورة الموافقات</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">معتمدة نهائياً</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {(kpis?.approvedAmount || 0).toLocaleString()} <span className="text-xs font-normal">ر.س</span>
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold">
              {kpis?.approvedCount || 0} مطالبة معتمدة
            </span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">بانتظار الصرف للموظف</span>
            <h4 className="text-xl font-black text-primary mt-0.5 font-tabular-nums font-mono">
              {(kpis?.awaitingReimbursementAmount || 0).toLocaleString()} <span className="text-xs font-normal">ر.س</span>
            </h4>
            <span className="text-[10px] text-primary/80 font-bold">
              {kpis?.awaitingReimbursementCount || 0} مستحقة للتحويل
            </span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">تم الصرف الفعلي</span>
            <h4 className="text-xl font-black text-emerald-600 mt-0.5 font-tabular-nums font-mono">
              {(kpis?.confirmedReimbursedAmount || 0).toLocaleString()} <span className="text-xs font-normal">ر.س</span>
            </h4>
            <span className="text-[10px] text-muted-foreground font-semibold">
              {kpis?.confirmedReimbursedCount || 0} مطالبة سُدّدت
            </span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Landmark className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">المرفوضة والمعادة</span>
            <h4 className="text-xl font-black text-destructive mt-0.5 font-tabular-nums font-mono">
              {(kpis?.rejectedCount || 0) + (kpis?.returnedCount || 0)}
            </h4>
            <span className="text-[10px] text-muted-foreground font-semibold">
              {kpis?.returnedCount || 0} معادة للتصحيح
            </span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card border border-border/80 p-1 rounded-2xl h-12 w-full justify-start gap-1">
          <TabsTrigger
            value="claims"
            className="rounded-xl px-5 h-10 font-bold text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <Receipt className="h-4 w-4" />
            سجل المطالبات والمصروفات
            <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 h-4">
              {claims.length}
            </Badge>
          </TabsTrigger>

          {isFinanceOrAdmin && (
            <TabsTrigger
              value="reimbursements"
              className="rounded-xl px-5 h-10 font-bold text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <Landmark className="h-4 w-4" />
              لوحة الصرف والتعويضات المالية
              {approvedReimbursableClaims.length > 0 && (
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </TabsTrigger>
          )}

          <TabsTrigger
            value="policies"
            className="rounded-xl px-5 h-10 font-bold text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <Settings className="h-4 w-4" />
            سياسات وفئات النفقات ({categories.length})
          </TabsTrigger>

          <TabsTrigger
            value="reports"
            className="rounded-xl px-5 h-10 font-bold text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            التحليل والتقارير المالية
          </TabsTrigger>
        </TabsList>

        {/* ==================================================================== */}
        {/* TAB 1: CLAIMS & EXPENSES LIST */}
        {/* ==================================================================== */}
        <TabsContent value="claims" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs space-y-4 p-5">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative min-w-[220px]">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="بحث برقم المطالبة، الموظف، المورد..."
                    className="w-full h-9 rounded-xl border border-border/80 bg-muted/40 pr-9 pl-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border border-border/80 bg-muted/40 px-3 text-xs font-semibold focus:bg-card focus:outline-none"
                >
                  <option value="all">كل حالات الاعتماد</option>
                  <option value="submitted">مقدمة</option>
                  <option value="pending_approval">قيد الاعتماد</option>
                  <option value="approved">معتمدة</option>
                  <option value="returned">معادة للتصحيح</option>
                  <option value="rejected">مرفوضة</option>
                </select>

                <select
                  value={reimbursementFilter}
                  onChange={(e) => setReimbursementFilter(e.target.value)}
                  className="h-9 rounded-xl border border-border/80 bg-muted/40 px-3 text-xs font-semibold focus:bg-card focus:outline-none"
                >
                  <option value="all">كل حالات الصرف</option>
                  <option value="unreimbursed">بانتظار الصرف</option>
                  <option value="queued_in_batch">مجدولة بدفعة صرف</option>
                  <option value="reimbursed">تم الصرف الفعلي</option>
                  <option value="transferred_to_payroll">مرحلة لمسير الرواتب</option>
                </select>

                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="h-9 rounded-xl border border-border/80 bg-muted/40 px-3 text-xs font-semibold focus:bg-card focus:outline-none"
                >
                  <option value="all">طريقة الدفع (الكل)</option>
                  <option value="employee_paid">مدفوع من الموظف (مستحق تعويض)</option>
                  <option value="corporate_card">بطاقة ائتمان مؤسسية</option>
                  <option value="company_paid">فاتورة شركة مباشرة</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setPaymentMethodFilter("all");
                    setReimbursementFilter("all");
                    setCategoryFilter("all");
                  }}
                  className="h-9 text-xs rounded-xl"
                >
                  إعادة ضبط
                </Button>
              </div>
            </div>

            {/* Claims Table */}
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="classera-table-head">
                  <tr>
                    <th className="py-3 px-4 text-start">رقم المطالبة</th>
                    <th className="py-3 px-4 text-start">الموظف والقسم</th>
                    <th className="py-3 px-4 text-start">التصنيف والمورد</th>
                    <th className="py-3 px-4 text-start">التاريخ</th>
                    <th className="py-3 px-4 text-start">المبلغ المدفوع</th>
                    <th className="py-3 px-4 text-start">طريقة الدفع</th>
                    <th className="py-3 px-4 text-start">الاعتماد</th>
                    <th className="py-3 px-4 text-start">حالة التعويض</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {claims.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground font-medium">
                        لا توجد مطالبات مصروفات مطابقة للبحث المحدد
                      </td>
                    </tr>
                  ) : (
                    claims.map((c) => (
                      <tr key={c.id} className="classera-table-row hover:bg-secondary/20">
                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                          {c.claimNumber}
                          {c.duplicateFlag && (
                            <span className="mr-1.5 inline-flex items-center text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full font-sans font-bold">
                              تكرار محتمل
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-foreground">{c.employeeName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{c.employeeNo} • {c.departmentName}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-foreground">{c.categoryNameAr}</div>
                          <div className="text-[10px] text-muted-foreground font-semibold">{c.merchantName}</div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground font-mono font-tabular-nums">
                          {c.spentAt}
                        </td>
                        <td className="py-3 px-4 font-black text-primary font-mono font-tabular-nums text-sm">
                          {c.amount.toLocaleString()} {c.currency}
                          {c.currency !== "SAR" && (
                            <span className="block text-[10px] text-muted-foreground font-normal">
                              ≈ {c.convertedAmount.toLocaleString()} ر.س
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {c.paymentMethod === "employee_paid" ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200">
                              مدفوع شخصياً
                            </span>
                          ) : c.paymentMethod === "corporate_card" ? (
                            <span className="text-[11px] font-bold text-purple-700 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-200">
                              بطاقة ائتمان
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-200">
                              شركة مباشرة
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(c.status)}
                          {c.policyWarningTriggered && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                              <AlertTriangle className="h-3 w-3" />
                              تجاوز تحذيري
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {getReimbursementBadge(c.reimbursementStatus, c.reimbursementMethod || undefined)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedClaimForDetail(c);
                                setIsDetailModalOpen(true);
                              }}
                              className="h-7 text-xs px-2.5 rounded-full font-bold text-primary hover:bg-primary/10 gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              التفاصيل
                            </Button>
                            {(c.receiptFileId || c.receiptUrl) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewReceipt(c.receiptFileId, c.receiptUrl)}
                                className="h-7 text-[10px] px-2 rounded-full font-bold border-border/80 hover:bg-secondary"
                                title="عرض الإيصال الأصلي"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 2: FINANCE REIMBURSEMENTS PANEL */}
        {/* ==================================================================== */}
        {isFinanceOrAdmin && (
          <TabsContent value="reimbursements" className="space-y-6">
            {/* Approved Claims Awaiting Reimbursement Queue */}
            <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    المطالبات المعتمدة الجاهزة للصرف المالي للموظفين
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    اختر المطالبات المعتمدة لتجهيز دفعة تحويل مصرفي أو ترحيل لمسير الرواتب
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={selectedClaimIdsForBatch.length === 0}
                    onClick={() => setIsPrepareBatchModalOpen(true)}
                    className="classera-btn-primary h-9 px-4 text-xs font-bold gap-1.5 shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    تجهيز دفعة صرف ({selectedClaimIdsForBatch.length})
                  </Button>
                </div>
              </div>

              {approvedReimbursableClaims.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground font-medium text-xs">
                  لا توجد مطالبات معتمدة بانتظار تجهيز دفعات الصرف حالياً.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="classera-table-head">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={
                              selectedClaimIdsForBatch.length > 0 &&
                              selectedClaimIdsForBatch.length === approvedReimbursableClaims.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClaimIdsForBatch(approvedReimbursableClaims.map((c) => c.id));
                              } else {
                                setSelectedClaimIdsForBatch([]);
                              }
                            }}
                            className="rounded border-border"
                          />
                        </th>
                        <th className="py-2.5 px-4 text-start">رقم المطالبة</th>
                        <th className="py-2.5 px-4 text-start">الموظف</th>
                        <th className="py-2.5 px-4 text-start">التصنيف والمورد</th>
                        <th className="py-2.5 px-4 text-start">التاريخ</th>
                        <th className="py-2.5 px-4 text-start">المبلغ المستحق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {approvedReimbursableClaims.map((c) => {
                        const isSelected = selectedClaimIdsForBatch.includes(c.id);
                        return (
                          <tr
                            key={c.id}
                            onClick={() => {
                              setSelectedClaimIdsForBatch((prev) =>
                                isSelected ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                              );
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? "bg-primary/5" : "hover:bg-secondary/20"
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  setSelectedClaimIdsForBatch((prev) =>
                                    e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                                  );
                                }}
                                className="rounded border-border"
                              />
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-foreground">{c.claimNumber}</td>
                            <td className="py-2.5 px-4">
                              <span className="font-bold text-foreground">{c.employeeName}</span>
                              <span className="text-[10px] text-muted-foreground block font-mono">{c.employeeNo}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="font-bold">{c.categoryNameAr}</span>
                              <span className="text-[10px] text-muted-foreground block">{c.merchantName}</span>
                            </td>
                            <td className="py-2.5 px-4 font-mono font-tabular-nums text-muted-foreground">{c.spentAt}</td>
                            <td className="py-2.5 px-4 font-black text-emerald-700 font-mono font-tabular-nums text-sm">
                              {c.convertedAmount.toLocaleString()} ر.س
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Reimbursement Batches History */}
            <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs space-y-4 p-5">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-primary" />
                  دفعات الصرف والتحويل المالي المسجلة
                </h3>
              </div>

              {batches.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground font-medium text-xs">
                  لا توجد دفعات صرف منشأة حتى الآن
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="classera-table-head">
                      <tr>
                        <th className="py-3 px-4 text-start">رقم الدفعة</th>
                        <th className="py-3 px-4 text-start">فترة الصرف</th>
                        <th className="py-3 px-4 text-start">طريقة الصرف</th>
                        <th className="py-3 px-4 text-start">عدد المطالبات والموظفين</th>
                        <th className="py-3 px-4 text-start">إجمالي المبلغ</th>
                        <th className="py-3 px-4 text-start">الحساب البنكي / المرجع</th>
                        <th className="py-3 px-4 text-start">الحالة المالية</th>
                        <th className="py-3 px-center text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {batches.map((b) => (
                        <tr key={b.id} className="classera-table-row hover:bg-secondary/20">
                          <td className="py-3 px-4 font-mono font-bold text-foreground">{b.batchNumber}</td>
                          <td className="py-3 px-4 font-mono font-bold">{b.periodKey}</td>
                          <td className="py-3 px-4">
                            {b.paymentMethod === "direct_bank_transfer" ? (
                              <span className="text-[11px] font-bold text-blue-700 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-200">
                                تحويل بنكي مباشر
                              </span>
                            ) : b.paymentMethod === "payroll" ? (
                              <span className="text-[11px] font-bold text-purple-700 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-200">
                                مسير الرواتب
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                نقدي
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {b.totalClaimsCount} مطالبات ({b.totalEmployeesCount} موظف)
                          </td>
                          <td className="py-3 px-4 font-black text-emerald-700 font-mono font-tabular-nums text-sm">
                            {b.totalAmount.toLocaleString()} {b.currency}
                          </td>
                          <td className="py-3 px-4">
                            {b.bankAccountName ? (
                              <span className="font-bold text-foreground block">{b.bankAccountName}</span>
                            ) : null}
                            {b.bankReference && (
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                مرجع: {b.bankReference}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {getBatchStatusBadge(b.paymentStatus)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {b.paymentStatus === "prepared" && (
                                <Button
                                  size="sm"
                                  onClick={() => approveBatchForPayment({ batchId: b.id })}
                                  disabled={isApprovingBatch}
                                  className="h-7 text-xs px-3 rounded-full font-bold bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  اعتماد للصرف
                                </Button>
                              )}

                              {(b.paymentStatus === "prepared" || b.paymentStatus === "approved_for_payment") && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedBatchForConfirm(b);
                                      setIsConfirmModalOpen(true);
                                    }}
                                    className="h-7 text-xs px-3 rounded-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    تأكيد السداد البنكي
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedBatchForPayroll(b);
                                      setIsPayrollModalOpen(true);
                                    }}
                                    className="h-7 text-xs px-2.5 rounded-full font-bold border-purple-300 text-purple-700 hover:bg-purple-50"
                                  >
                                    ترحيل للرواتب
                                  </Button>
                                </>
                              )}

                              {b.paymentStatus !== "reversed" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedBatchForReverse(b);
                                    setIsReverseModalOpen(true);
                                  }}
                                  className="h-7 text-xs px-2 rounded-full font-bold text-destructive hover:bg-destructive/10"
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  عكس
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: CATEGORIES & POLICIES */}
        {/* ==================================================================== */}
        <TabsContent value="policies" className="space-y-6">
          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="classera-kpi-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-xs text-foreground block">{cat.nameAr}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{cat.code}</span>
                  </div>
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Receipt className="h-4 w-4" />
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/60 font-medium">
                  <div className="flex justify-between items-center">
                    <span>حد التحذير:</span>
                    <span className="font-bold text-amber-600 font-mono font-tabular-nums">
                      {cat.maxLimitWarning.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>الحد المانع:</span>
                    <span className="font-bold text-destructive font-mono font-tabular-nums">
                      {cat.maxLimitBlock.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>حساب الأستاذ:</span>
                    <span className="font-mono text-foreground font-bold">{cat.accountingAccountCode}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1">
                    {cat.requiresReceipt ? "• إرفاق الفاتورة إلزامي" : "• اختياري"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Corporate Policy Limits Info */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              سياسة حدود المصروفات المعتمدة للمنشأة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60 space-y-1">
                <span className="text-muted-foreground font-semibold">حد المعاملة الواحدة:</span>
                <p className="text-lg font-black text-foreground font-mono">
                  {policies[0]?.singleTransactionLimit?.toLocaleString() || "5,000"} ر.س
                </p>
                <span className="text-[10px] text-muted-foreground">يتطلب تصعيداً إدارياً عند التجاوز</span>
              </div>
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60 space-y-1">
                <span className="text-muted-foreground font-semibold">السقف الشهري للموظف:</span>
                <p className="text-lg font-black text-foreground font-mono">
                  {policies[0]?.monthlyLimit?.toLocaleString() || "20,000"} ر.س
                </p>
                <span className="text-[10px] text-muted-foreground">تراكمي لجميع مطالبات الشهر</span>
              </div>
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60 space-y-1">
                <span className="text-muted-foreground font-semibold">السقف السنوي للموظف:</span>
                <p className="text-lg font-black text-foreground font-mono">
                  {policies[0]?.annualLimit?.toLocaleString() || "100,000"} ر.س
                </p>
                <span className="text-[10px] text-muted-foreground">الحد الائتماني الإجمالي لمصروفات السنة</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 4: REPORTS & ANALYTICS */}
        {/* ==================================================================== */}
        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Category */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-foreground">المصروفات حسب فئة النفقة</h3>
              <div className="space-y-3">
                {(kpis?.categoriesBreakdown || []).map((cat) => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{cat.nameAr}</span>
                      <span className="font-mono text-primary">
                        {cat.totalAmount.toLocaleString()} ر.س ({cat.count})
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: `${
                            kpis?.totalSubmittedAmount
                              ? Math.min(100, (cat.totalAmount / kpis.totalSubmittedAmount) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Department */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-foreground">المصروفات حسب الإدارة</h3>
              <div className="space-y-3">
                {(kpis?.departmentsBreakdown || []).map((dept) => (
                  <div key={dept.departmentId} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{dept.departmentName}</span>
                      <span className="font-mono text-emerald-700">
                        {dept.totalAmount.toLocaleString()} ر.س ({dept.count})
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{
                          width: `${
                            kpis?.totalSubmittedAmount
                              ? Math.min(100, (dept.totalAmount / kpis.totalSubmittedAmount) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================================================================== */}
      {/* MODAL 1: NEW MULTI-LINE CLAIM DIALOG */}
      {/* ==================================================================== */}
      <Dialog open={isClaimModalOpen} onOpenChange={setIsClaimModalOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              تقديم مطالبة مصروفات جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              إضافة فواتير ومصروفات الأعمال، وتعيين بنود الصرف لمطابقتها مع سياسة الشركة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold">عنوان أو موضوع المطالبة *</label>
                <input
                  type="text"
                  value={claimTitle}
                  onChange={(e) => setClaimTitle(e.target.value)}
                  placeholder="مثال: نفقات رحلة عمل معرض الرياض للتقنية"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">طريقة السداد والتمويل *</label>
                <select
                  value={claimPaymentMethod}
                  onChange={(e) => setClaimPaymentMethod(e.target.value as ExpensePaymentMethod)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="employee_paid">مدفوع من حساب الموظف الشخصي (يستحق التعويض المالي)</option>
                  <option value="corporate_card">بطاقة ائتمان الشركة المؤسسية (تسوية عهدة)</option>
                  <option value="company_paid">فاتورة مدفوعة من الشركة مباشرة (قيد محاسبي)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold">المبرر العملي والأهداف *</label>
                <input
                  type="text"
                  value={businessJustification}
                  onChange={(e) => setBusinessJustification(e.target.value)}
                  placeholder="الهدف من المصروف وأثره على أعمال الشركة..."
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">رمز المشروع أو مركز التكلفة (اختياري)</label>
                <input
                  type="text"
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  placeholder="مثال: PRJ-2026-CLOUD"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>
            </div>

            {/* Line Items Builder */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  بنود المصروفات والفواتير ({itemLines.length})
                </h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddItemLine}
                  className="h-8 text-xs rounded-xl font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة بند آخر
                </Button>
              </div>

              <div className="space-y-3">
                {itemLines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="p-4 rounded-2xl border border-border/80 bg-secondary/10 space-y-3 relative"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <span className="font-bold text-xs text-primary">البند رقم {idx + 1}</span>
                      {itemLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemLine(line.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          title="حذف هذا البند"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold">التصنيف *</label>
                        <select
                          value={line.categoryId}
                          onChange={(e) => handleUpdateItemLine(line.id, "categoryId", e.target.value)}
                          className="w-full h-9 rounded-xl border border-border/80 bg-card px-2 text-xs font-semibold focus:outline-none"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nameAr}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold">المورد / الجهة المستلمة *</label>
                        <input
                          type="text"
                          value={line.merchantName}
                          onChange={(e) => handleUpdateItemLine(line.id, "merchantName", e.target.value)}
                          placeholder="مثال: الخطوط السعودية"
                          className="w-full h-9 rounded-xl border border-border/80 bg-card px-2.5 text-xs focus:outline-none font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold">تاريخ المصروف *</label>
                        <input
                          type="date"
                          value={line.itemDate}
                          max={new Date().toISOString().split("T")[0]}
                          onChange={(e) => handleUpdateItemLine(line.id, "itemDate", e.target.value)}
                          className="w-full h-9 rounded-xl border border-border/80 bg-card px-2.5 text-xs font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold">المبلغ *</label>
                        <input
                          type="number"
                          value={line.amount || ""}
                          onChange={(e) => handleUpdateItemLine(line.id, "amount", Number(e.target.value))}
                          placeholder="0.00"
                          className="w-full h-9 rounded-xl border border-border/80 bg-card px-2.5 text-xs font-mono font-bold focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold">العملة</label>
                        <select
                          value={line.currency}
                          onChange={(e) => handleUpdateItemLine(line.id, "currency", e.target.value)}
                          className="w-full h-9 rounded-xl border border-border/80 bg-card px-2 text-xs font-mono font-bold focus:outline-none"
                        >
                          <option value="SAR">SAR (ريال)</option>
                          <option value="USD">USD (دولار)</option>
                          <option value="EUR">EUR (يورو)</option>
                          <option value="GBP">GBP (جنيه)</option>
                          <option value="AED">AED (درهم)</option>
                        </select>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[11px] font-bold">إرفاق الفاتورة / الإيصال</label>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 10 * 1024 * 1024) {
                                toast.error("حجم الملف يتجاوز 10 ميجابايت");
                                return;
                              }
                              handleUpdateItemLine(line.id, "receiptFile", file);
                            }
                          }}
                          className="w-full text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Totals Card */}
              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground block">إجمالي مبلغ المطالبة:</span>
                  <span className="text-lg font-black text-primary font-mono font-tabular-nums">
                    {claimTotalAmount.toLocaleString()} ر.س
                  </span>
                </div>
                <div className="text-end">
                  <span className="text-[10px] text-muted-foreground block font-medium">عدد البنود: {itemLines.length}</span>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    {claimPaymentMethod === "employee_paid" ? "مستحق للتعويض المالي" : "غير خاضع للتعويض"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              disabled={isSubmitting || claimTotalAmount <= 0}
              onClick={handleSubmitClaim}
              className="rounded-full text-xs classera-btn-primary font-bold px-6 h-9 gap-1.5 shadow-xs"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? "جاري الإرسال والتحقق..." : "تقديم المطالبة للاعتماد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 2: CLAIM DETAILS & LINE ITEMS */}
      {/* ==================================================================== */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
          {selectedClaimForDetail && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-black flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    تفاصيل المطالبة: {selectedClaimForDetail.claimNumber}
                  </DialogTitle>
                  {getStatusBadge(selectedClaimForDetail.status)}
                </div>
                <DialogDescription className="text-xs font-medium">
                  {selectedClaimForDetail.title} • تم التقديم بتاريخ {selectedClaimForDetail.spentAt}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-muted/30 p-3.5 rounded-2xl border border-border/60">
                <div>
                  <span className="text-muted-foreground block text-[10px]">الموظف:</span>
                  <span className="font-bold text-foreground">{selectedClaimForDetail.employeeName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">طريقة الدفع:</span>
                  <span className="font-bold text-foreground">
                    {selectedClaimForDetail.paymentMethod === "employee_paid" ? "مدفوع شخصياً" : "بطاقة / شركة"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">حالة الصرف:</span>
                  <span className="font-bold text-foreground">
                    {getReimbursementBadge(selectedClaimForDetail.reimbursementStatus, selectedClaimForDetail.reimbursementMethod || undefined)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">المبلغ الإجمالي:</span>
                  <span className="font-black text-primary font-mono text-sm">
                    {selectedClaimForDetail.amount.toLocaleString()} {selectedClaimForDetail.currency}
                  </span>
                </div>
              </div>

              {/* Line items list */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-foreground">بنود المصروفات المسجلة:</h4>
                <div className="overflow-x-auto rounded-2xl border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="classera-table-head">
                      <tr>
                        <th className="py-2 px-3 text-start">التصنيف</th>
                        <th className="py-2 px-3 text-start">المورد</th>
                        <th className="py-2 px-3 text-start">التاريخ</th>
                        <th className="py-2 px-3 text-start">المبلغ</th>
                        <th className="py-2 px-3 text-center">الإيصال</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {claimItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-muted-foreground">
                            {selectedClaimForDetail.merchantName} - {selectedClaimForDetail.amount.toLocaleString()} {selectedClaimForDetail.currency}
                          </td>
                        </tr>
                      ) : (
                        claimItems.map((item) => (
                          <tr key={item.id} className="hover:bg-secondary/20">
                            <td className="py-2 px-3 font-bold">{item.categoryNameAr || selectedClaimForDetail.categoryNameAr}</td>
                            <td className="py-2 px-3">{item.merchantName}</td>
                            <td className="py-2 px-3 font-mono">{item.itemDate}</td>
                            <td className="py-2 px-3 font-mono font-bold text-primary">
                              {item.amount.toLocaleString()} {item.currency}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {item.receiptFileId || item.receiptUrl ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewReceipt(item.receiptFileId, item.receiptUrl)}
                                  className="h-6 text-[10px] px-2 rounded-full font-bold text-primary hover:bg-primary/10 gap-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  عرض
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedClaimForDetail.businessJustification && (
                <div className="p-3 rounded-2xl bg-secondary/20 border border-border/60 text-xs">
                  <span className="font-bold block text-muted-foreground mb-1">المبرر العملي:</span>
                  <p className="text-foreground">{selectedClaimForDetail.businessJustification}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 3: PREPARE REIMBURSEMENT BATCH */}
      {/* ==================================================================== */}
      <Dialog open={isPrepareBatchModalOpen} onOpenChange={setIsPrepareBatchModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              تجهيز دفعة صرف للمصروفات المعتمدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تجميع {selectedClaimIdsForBatch.length} مطالبات معتمدة لصرفها للموظفين دفعة واحدة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">فترة الصرف (السنة والشهور) *</label>
              <input
                type="month"
                value={batchPeriodKey}
                onChange={(e) => setBatchPeriodKey(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">طريقة الصرف والتعويض *</label>
              <select
                value={batchPaymentMethod}
                onChange={(e) => setBatchPaymentMethod(e.target.value as any)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-semibold focus:bg-card focus:outline-none"
              >
                <option value="direct_bank_transfer">تحويل بنكي مباشر لحسابات الموظفين (WPS/SARIE)</option>
                <option value="payroll">إدراج في مسير الرواتب القادم كتعويضات معتمدة</option>
              </select>
            </div>

            {batchPaymentMethod === "direct_bank_transfer" && (
              <div className="space-y-1.5">
                <label className="font-bold">حساب الشركة البنكي المخصوم منه *</label>
                <select
                  value={batchBankAccountId}
                  onChange={(e) => setBatchBankAccountId(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-semibold focus:bg-card focus:outline-none"
                >
                  <option value="">-- اختر الحساب البنكي --</option>
                  {bankAccounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} - {acc.account_name} (رصيد: {Number(acc.current_balance || 0).toLocaleString()} ر.س)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-bold">ملاحظات أو بيان الدفعة</label>
              <textarea
                rows={2}
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
                placeholder="ملاحظات توضيحية للإدارة المالية..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              disabled={isPreparingBatch}
              onClick={handlePrepareBatchSubmit}
              className="rounded-full text-xs classera-btn-primary font-bold px-5 h-9"
            >
              {isPreparingBatch ? "جاري التجهيز..." : "إنشاء دفعة الصرف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 4: CONFIRM PAYMENT (BANK DEBIT) */}
      {/* ==================================================================== */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              تأكيد صرف الدفعة والخصم البنكي
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تأكيد التحويل البنكي الفعلي للدفعة: {selectedBatchForConfirm?.batchNumber} بمبلغ{" "}
              {Number(selectedBatchForConfirm?.totalAmount || 0).toLocaleString()} ر.س
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الرقم المرجعي البنكي للتحويل (Sarie / Swift Ref) *</label>
              <input
                type="text"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                placeholder="مثال: SARIE-TXN-984210"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono font-bold focus:bg-card focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              disabled={isConfirmingPayment || !bankReference.trim()}
              onClick={handleConfirmPaymentSubmit}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9"
            >
              {isConfirmingPayment ? "جاري تأكيد السداد..." : "تأكيد السداد والترحيل المالي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 5: REVERSE REIMBURSEMENT BATCH */}
      {/* ==================================================================== */}
      <Dialog open={isReverseModalOpen} onOpenChange={setIsReverseModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              إلغاء وعكس دفعة الصرف
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              سيتم إعادة جميع مطالبات الدفعة ({selectedBatchForReverse?.batchNumber}) إلى قائمة المطالبات غير المصروفة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">سبب الإلغاء أو العكس *</label>
              <textarea
                rows={3}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="توضيح السبب المالي أو الإجرائي للإلغاء..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              disabled={isReversingBatch || !reversalReason.trim()}
              onClick={handleReverseBatchSubmit}
              className="rounded-full text-xs bg-destructive hover:bg-destructive/90 text-white font-bold px-5 h-9"
            >
              {isReversingBatch ? "جاري العكس..." : "تأكيد عكس الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 6: TRANSFER TO PAYROLL */}
      {/* ==================================================================== */}
      <Dialog open={isPayrollModalOpen} onOpenChange={setIsPayrollModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-purple-700">
              <Wallet className="h-5 w-5" />
              ترحيل تعويضات المصروفات لمسير الرواتب
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              إدراج مطالبات الدفعة ({selectedBatchForPayroll?.batchNumber}) كتعويضات معتمدة بمسير الرواتب
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اختر مسير الرواتب المستهدف *</label>
              <select
                value={selectedPayrollRunId}
                onChange={(e) => setSelectedPayrollRunId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-semibold focus:bg-card focus:outline-none"
              >
                <option value="">-- اختر مسير الرواتب --</option>
                {payrollRuns.map((run: any) => (
                  <option key={run.id} value={run.id}>
                    مسير {run.period_year}/{run.period_month} (حالة: {run.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              disabled={isTransferringToPayroll || !selectedPayrollRunId}
              onClick={handleTransferToPayrollSubmit}
              className="rounded-full text-xs bg-purple-700 hover:bg-purple-800 text-white font-bold px-5 h-9"
            >
              {isTransferringToPayroll ? "جاري الترحيل..." : "ترحيل للرواتب الآن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 7: ADD CATEGORY MODAL */}
      {/* ==================================================================== */}
      <Dialog open={isAddCatModalOpen} onOpenChange={setIsAddCatModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              إضافة فئة وسياسة مصروفات جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد سقف التحذير والحد المانع ورمز الحساب المحاسبي
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم الفئة باللغة العربية *</label>
              <input
                type="text"
                value={newCatNameAr}
                onChange={(e) => setNewCatNameAr(e.target.value)}
                placeholder="مثال: تدريب وتطوير مهني"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">اسم الفئة باللغة الإنجليزية</label>
              <input
                type="text"
                value={newCatNameEn}
                onChange={(e) => setNewCatNameEn(e.target.value)}
                placeholder="e.g. Training & Development"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">سقف التحذير (ر.س)</label>
                <input
                  type="number"
                  value={newCatWarning}
                  onChange={(e) => setNewCatWarning(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الحد المانع (ر.س)</label>
                <input
                  type="number"
                  value={newCatBlock}
                  onChange={(e) => setNewCatBlock(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">رمز الحساب المحاسبي (دليل الحسابات)</label>
              <input
                type="text"
                value={newCatAccountCode}
                onChange={(e) => setNewCatAccountCode(e.target.value)}
                placeholder="510100"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono font-bold focus:bg-card focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="reqReceipt"
                checked={newCatRequiresReceipt}
                onChange={(e) => setNewCatRequiresReceipt(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="reqReceipt" className="font-bold cursor-pointer text-xs">
                إرفاق الفاتورة أو الإيصال إلزامي لقبول المطالبة
              </label>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              disabled={isAddingCategory}
              onClick={handleCreateCategory}
              className="rounded-full text-xs classera-btn-primary font-bold px-5 h-9"
            >
              {isAddingCategory ? "جاري الحفظ..." : "حفظ وتفعيل الفئة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
