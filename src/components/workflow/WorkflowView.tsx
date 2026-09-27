import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import type {
  RequestCategory,
  ServiceRequest,
  ApprovalChain,
  ApprovalStep,
  DelegationRule,
} from "../../types";
import { IconSymbol } from "../ui/IconSymbol";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Plus,
  ArrowRight,
  Layers,
  Send,
  FileCheck,
  Trash2,
  Calendar,
  UserCheck,
  Search,
  CheckSquare,
  Square,
  ArrowLeftRight,
  Sliders,
  AlertCircle,
  X,
  FileText,
  Receipt,
  Wallet,
  ClockAlert,
  Laptop,
  UserX,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  useApprovalInbox,
  useMyRequests,
  useApprovalChains,
  useMyDelegations,
  useWorkflowKpis,
  useWorkflowEngineMutations,
  CANONICAL_REQUEST_CATALOG,
  getRequestCatalogItem,
} from "../../lib/domains/workflow";

export const WorkflowView: React.FC = () => {
  const {
    employees,
    currentUser,
    currentRole,
    openEmployeeProfile,
    isSaving,
  } = useApp();

  const canApprove = canManageModule(currentRole, "workflow");

  const [activeTab, setActiveTab] = useState<"inbox" | "my_requests" | "chains" | "delegations">(
    "inbox",
  );

  // Pagination & Filter States for Inbox
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxCategoryFilter, setInboxCategoryFilter] = useState<string>("all");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);

  // Pagination & Filter States for My Requests
  const [myPage, setMyPage] = useState(1);
  const [mySearch, setMySearch] = useState("");
  const [myCategoryFilter, setMyCategoryFilter] = useState<string>("all");
  const [myStatusFilter, setMyStatusFilter] = useState<string>("all");

  // Server Queries (Authoritative - Item 2 & 3)
  const { data: inboxData, isLoading: isInboxLoading } = useApprovalInbox({
    page: inboxPage,
    pageSize: 15,
    search: inboxSearch,
    type: inboxCategoryFilter,
  });

  const { data: myRequestsData, isLoading: isMyRequestsLoading } = useMyRequests({
    page: myPage,
    pageSize: 15,
    search: mySearch,
    type: myCategoryFilter,
    status: myStatusFilter,
  });

  const { data: approvalChains = [], isLoading: isChainsLoading } = useApprovalChains();
  const { data: delegationRules = [], isLoading: isDelegationsLoading } = useMyDelegations();
  const { data: kpis } = useWorkflowKpis();
  const mutations = useWorkflowEngineMutations();

  const inboxRequests = inboxData?.data || [];
  const myRequests = myRequestsData?.data || [];

  // Selected Request for Detail Modal
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [internalNote, setInternalNote] = useState("");

  // Modals
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isNewChainOpen, setIsNewChainOpen] = useState(false);
  const [isNewDelegationOpen, setIsNewDelegationOpen] = useState(false);
  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [requestToResubmit, setRequestToResubmit] = useState<ServiceRequest | null>(null);
  const [requestToWithdraw, setRequestToWithdraw] = useState<ServiceRequest | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");

  // New Request Form State
  const [reqType, setReqType] = useState<RequestCategory>("leave");
  const [reqReason, setReqReason] = useState("");
  const [reqStartDate, setReqStartDate] = useState("");
  const [reqEndDate, setReqEndDate] = useState("");
  const [reqDays, setReqDays] = useState<number | "">("");
  const [reqAmount, setReqAmount] = useState<number | "">("");
  const [reqAttachmentUrl, setReqAttachmentUrl] = useState("");

  // Resubmit Form State
  const [resubmitReason, setResubmitReason] = useState("");
  const [resubmitNote, setResubmitNote] = useState("");

  // New Chain Designer State
  const [chainNameAr, setChainNameAr] = useState("");
  const [chainCategory, setChainCategory] = useState<RequestCategory>("leave");
  const [chainScope, setChainScope] = useState<ApprovalChain["scopeType"]>("all_employees");
  const [chainPriority, setChainPriority] = useState<number>(100);
  const [chainSteps, setChainSteps] = useState<ApprovalStep[]>([
    {
      sequence: 1,
      stepNameAr: "موافقة المدير المباشر",
      stepNameEn: "Direct Manager Approval",
      resolverType: "direct_manager",
    },
    {
      sequence: 2,
      stepNameAr: "موافقة مدير الموارد البشرية",
      stepNameEn: "HR Manager Approval",
      resolverType: "hr_manager",
    },
  ]);

  // New Delegation State (Dynamic dates, no hardcoded year)
  const [delegateEmpId, setDelegateEmpId] = useState<string>(() => {
    const peer = employees.find((e) => e.id !== currentUser?.id);
    return peer ? peer.id : "";
  });
  const [delStartDate, setDelStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [delEndDate, setDelEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [delScope, setDelScope] = useState<DelegationRule["scope"]>("all_requests");
  const [delReason, setDelReason] = useState("");

  // Bulk Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedRequestIds.length === inboxRequests.length) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(inboxRequests.map((r) => r.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedRequestIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleBulkApprove = async () => {
    if (isSaving || selectedRequestIds.length === 0) return;
    const res = await mutations.bulkDecide(
      selectedRequestIds,
      "approved",
      "تم الاعتماد السريع ضمن دفعة الاعتمادات المجمعة المعتمدة",
    );
    if (res.ok) {
      setSelectedRequestIds([]);
    }
  };

  const handleApprove = async (id: string) => {
    if (isSaving) return;
    const ok = await mutations.decideRequest(
      id,
      "approved",
      decisionNote || "تمت الموافقة والاعتماد الإلكتروني الموثق",
      internalNote || undefined,
    );
    if (ok) {
      setSelectedRequest(null);
      setDecisionNote("");
      setInternalNote("");
    }
  };

  const handleReject = async (id: string) => {
    if (isSaving) return;
    if (!decisionNote.trim()) {
      toast.error("يرجى كتابة سبب أو مبرر الرفض");
      return;
    }
    const ok = await mutations.decideRequest(
      id,
      "rejected",
      decisionNote,
      internalNote || undefined,
    );
    if (ok) {
      setSelectedRequest(null);
      setDecisionNote("");
      setInternalNote("");
    }
  };

  const handleReturn = async (id: string) => {
    if (isSaving) return;
    if (!decisionNote.trim()) {
      toast.error("يرجى كتابة الملاحظات والمستندات المطلوبة لإعادة الطلب");
      return;
    }
    const ok = await mutations.decideRequest(
      id,
      "returned",
      decisionNote,
      internalNote || undefined,
    );
    if (ok) {
      setSelectedRequest(null);
      setDecisionNote("");
      setInternalNote("");
    }
  };

  const handleCreateNewRequest = async () => {
    if (isSaving) return;
    if (!reqReason.trim()) {
      toast.error("يرجى كتابة تفاصيل ومبررات الطلب");
      return;
    }

    const payload: Record<string, unknown> = {
      reason: reqReason.trim(),
    };

    if (reqStartDate) payload.startDate = reqStartDate;
    if (reqEndDate) payload.endDate = reqEndDate;
    if (reqDays !== "") payload.days = Number(reqDays);
    if (reqAmount !== "") payload.amount = Number(reqAmount);
    if (reqAttachmentUrl.trim()) {
      payload.attachmentUrls = [reqAttachmentUrl.trim()];
    }

    const ok = await mutations.submitRequest({
      type: reqType,
      payload,
    });

    if (ok) {
      setIsNewRequestOpen(false);
      setReqReason("");
      setReqStartDate("");
      setReqEndDate("");
      setReqDays("");
      setReqAmount("");
      setReqAttachmentUrl("");
    }
  };

  const handleOpenResubmit = (req: ServiceRequest) => {
    setRequestToResubmit(req);
    setResubmitReason(String(req.payload.reason || ""));
    setResubmitNote("");
    setIsResubmitOpen(true);
  };

  const handleConfirmResubmit = async () => {
    if (!requestToResubmit || isSaving) return;
    if (!resubmitReason.trim()) {
      toast.error("يرجى إدخال تفاصيل ومبررات الطلب بعد التعديل");
      return;
    }

    const updatedPayload = {
      ...requestToResubmit.payload,
      reason: resubmitReason.trim(),
    };

    const ok = await mutations.resubmitRequest(
      requestToResubmit.id,
      updatedPayload,
      resubmitNote.trim() || undefined,
    );

    if (ok) {
      setIsResubmitOpen(false);
      setRequestToResubmit(null);
      setResubmitReason("");
      setResubmitNote("");
    }
  };

  const handleOpenWithdraw = (req: ServiceRequest) => {
    setRequestToWithdraw(req);
    setWithdrawReason("");
    setIsWithdrawOpen(true);
  };

  const handleConfirmWithdraw = async () => {
    if (!requestToWithdraw || isSaving) return;
    if (!withdrawReason.trim()) {
      toast.error("يرجى تحديد سبب سحب الطلب");
      return;
    }

    const ok = await mutations.withdrawRequest(requestToWithdraw.id, withdrawReason.trim());
    if (ok) {
      setIsWithdrawOpen(false);
      setRequestToWithdraw(null);
      setWithdrawReason("");
    }
  };

  const handleAddStepToChain = () => {
    const nextSeq = chainSteps.length + 1;
    setChainSteps((prev) => [
      ...prev,
      {
        sequence: nextSeq,
        stepNameAr: `المستوى ${nextSeq}: موافقة الإدارة`,
        stepNameEn: `Level ${nextSeq} Approval`,
        resolverType: "department_head",
      },
    ]);
  };

  const handleRemoveStepFromChain = (index: number) => {
    if (chainSteps.length <= 1) {
      toast.error("يجب أن يحتوي مسار الاعتماد على خطوة واحدة على الأقل");
      return;
    }
    const updated = chainSteps.filter((_, idx) => idx !== index);
    setChainSteps(updated.map((s, idx) => ({ ...s, sequence: idx + 1 })));
  };

  const handleCreateNewChain = async () => {
    if (!chainNameAr.trim()) {
      toast.error("يرجى كتابة اسم مسار الاعتماد");
      return;
    }

    const ok = await mutations.saveChain({
      name_ar: chainNameAr.trim(),
      name_en: chainNameAr.trim(),
      request_type: chainCategory,
      scope_type: chainScope,
      priority: chainPriority,
      steps: chainSteps,
      is_default: false,
    });

    if (ok) {
      setIsNewChainOpen(false);
      setChainNameAr("");
      setChainPriority(100);
      setChainSteps([
        {
          sequence: 1,
          stepNameAr: "موافقة المدير المباشر",
          stepNameEn: "Direct Manager Approval",
          resolverType: "direct_manager",
        },
        {
          sequence: 2,
          stepNameAr: "موافقة مدير الموارد البشرية",
          stepNameEn: "HR Manager Approval",
          resolverType: "hr_manager",
        },
      ]);
    }
  };

  const handleCreateDelegation = async () => {
    if (!delReason.trim()) {
      toast.error("يرجى كتابة سبب ومبرر التفويض");
      return;
    }
    if (!delegateEmpId) {
      toast.error("يرجى اختيار الموظف المفوض له");
      return;
    }
    if (delEndDate < delStartDate) {
      toast.error("تاريخ نهاية التفويض يجب أن يكون بعد تاريخ البدء");
      return;
    }

    const ok = await mutations.createDelegation({
      delegateId: delegateEmpId,
      startDate: delStartDate,
      endDate: delEndDate,
      scope: delScope,
      reason: delReason.trim(),
    });

    if (ok) {
      setIsNewDelegationOpen(false);
      setDelReason("");
    }
  };

  // Helper for rendering catalog icons
  const renderCatalogIcon = (iconName: string) => {
    switch (iconName) {
      case "Calendar":
        return <Calendar className="h-4 w-4" />;
      case "Clock":
        return <Clock className="h-4 w-4" />;
      case "ClockAlert":
        return <ClockAlert className="h-4 w-4" />;
      case "Receipt":
        return <Receipt className="h-4 w-4" />;
      case "Wallet":
        return <Wallet className="h-4 w-4" />;
      case "FileText":
        return <FileText className="h-4 w-4" />;
      case "UserX":
        return <UserX className="h-4 w-4" />;
      case "Laptop":
        return <Laptop className="h-4 w-4" />;
      default:
        return <FileCheck className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Page Header */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <IconSymbol name="approval" source="material" filled size={24} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-foreground">
                  محرك الطلبات ومسارات الاعتماد المؤسسية
                </h1>
                <Badge variant="outline" className="text-[11px] font-bold border-primary/30 text-primary bg-primary/5 rounded-full px-2.5 py-0.5">
                  معتمد وموثق رقمياً
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                إدارة تدفقات الموافقات متعددة المستويات، التفويض الذكي، والربط الحصري مع محركات النظام
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setIsNewRequestOpen(true)}
            className="classera-btn-primary rounded-full font-bold text-xs gap-1.5 shadow-xs h-10 px-5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            تقديم طلب جديد
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="classera-kpi-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">
              صندوق الوارد (بانتظار قرارك)
            </span>
            <p className="text-2xl font-black text-amber-600 mt-0.5 font-tabular-nums font-mono">
              {kpis?.inboxPending ?? inboxRequests.length}
            </p>
            <span className="text-[10px] text-muted-foreground font-bold">معاملات تتطلب اتخاذ إجراء</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="classera-kpi-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">طلباتي الجارية</span>
            <p className="text-2xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {kpis?.myPending ?? myRequests.filter((r) => r.status === "pending_approval").length}
            </p>
            <span className="text-[10px] text-emerald-600 font-bold font-tabular-nums">
              {kpis?.myApproved ?? myRequests.filter((r) => r.status === "approved").length} معتمد • {kpis?.myReturned ?? myRequests.filter((r) => r.status === "returned").length} معاد للاستكمال
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Send className="h-6 w-6" />
          </div>
        </div>

        <div className="classera-kpi-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">
              سلاسل الاعتماد النشطة
            </span>
            <p className="text-2xl font-black text-primary mt-0.5 font-tabular-nums font-mono">
              {approvalChains.filter((c) => c.status === "active").length}
            </p>
            <span className="text-[10px] text-muted-foreground font-bold">
              مسارات حوكمة مُعرفة حسب النطاق
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Layers className="h-6 w-6" />
          </div>
        </div>

        <div className="classera-kpi-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">
              قواعد تفويض الصلاحيات
            </span>
            <p className="text-2xl font-black text-emerald-600 mt-0.5 font-tabular-nums font-mono">
              {delegationRules.filter((d) => d.status === "active").length}
            </p>
            <span className="text-[10px] text-muted-foreground font-bold">
              تفويضات سارية وموثقة
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="classera-tabs-strip">
          <TabsTrigger value="inbox" className="rounded-xl text-xs font-bold gap-1.5 py-2">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            صندوق الوارد للاعتماد
            {(kpis?.inboxPending || inboxRequests.length) > 0 && (
              <Badge className="mr-1 bg-amber-500 text-white rounded-full text-[10px] h-4 px-1.5 font-mono">
                {kpis?.inboxPending ?? inboxRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="my_requests" className="rounded-xl text-xs font-bold gap-1.5 py-2">
            <Send className="h-3.5 w-3.5 text-primary" />
            طلباتي ومتابعة الحالات
            <Badge className="mr-1 bg-muted text-foreground border border-border rounded-full text-[10px] h-4 px-1.5 font-mono">
              {myRequestsData?.totalCount ?? myRequests.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="chains" className="rounded-xl text-xs font-bold gap-1.5 py-2">
            <Layers className="h-3.5 w-3.5 text-primary" />
            مصمم مسارات الاعتماد ({approvalChains.length})
          </TabsTrigger>
          <TabsTrigger value="delegations" className="rounded-xl text-xs font-bold gap-1.5 py-2">
            <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-600" />
            تفويض الصلاحيات ({delegationRules.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Inbox */}
        <TabsContent value="inbox" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={inboxSearch}
                    onChange={(e) => {
                      setInboxSearch(e.target.value);
                      setInboxPage(1);
                    }}
                    placeholder="بحث برقم الطلب، اسم الموظف، المبرر..."
                    className="w-full h-9 rounded-full border border-border/80 bg-muted/40 pr-9 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <select
                  value={inboxCategoryFilter}
                  onChange={(e) => {
                    setInboxCategoryFilter(e.target.value);
                    setInboxPage(1);
                  }}
                  className="h-9 rounded-full border border-border/80 bg-muted/40 px-3 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">كافة أنواع المعاملات</option>
                  {CANONICAL_REQUEST_CATALOG.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bulk Actions */}
              {canApprove && selectedRequestIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleBulkApprove}
                    className="rounded-full h-9 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    اعتماد محدد ({selectedRequestIds.length})
                  </Button>
                </div>
              )}
            </div>

            {/* Inbox Table */}
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    {canApprove && (
                      <th className="py-3 px-4 w-10 text-center">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {selectedRequestIds.length === inboxRequests.length &&
                          inboxRequests.length > 0 ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="py-3 px-4 text-start">رقم المرجع والنوع</th>
                    <th className="py-3 px-4 text-start">مقدم الطلب</th>
                    <th className="py-3 px-4 text-start">تفاصيل ومبرر الطلب</th>
                    <th className="py-3 px-4 text-center">المرحلة الحالية</th>
                    <th className="py-3 px-4 text-center">تاريخ التقديم</th>
                    <th className="py-3 px-4 text-center">المهلة (SLA)</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isInboxLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-muted-foreground">
                        جاري تحميل صندوق الوارد...
                      </td>
                    </tr>
                  ) : inboxRequests.map((req) => {
                    const catalogItem = getRequestCatalogItem(req.type);
                    return (
                      <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                        {canApprove && (
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectOne(req.id)}
                              className="text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              {selectedRequestIds.includes(req.id) ? (
                                <CheckSquare className="h-4 w-4 text-primary" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-primary block">
                            {req.referenceNo}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] rounded-full border-border/80 flex items-center gap-1 w-fit mt-0.5"
                          >
                            {renderCatalogIcon(catalogItem.icon)}
                            {catalogItem.nameAr}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => openEmployeeProfile(req.requesterId)}
                            className="font-bold text-foreground hover:text-primary hover:underline transition-colors block text-start"
                          >
                            {req.requesterName}
                          </button>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {req.departmentName || req.requesterJobTitle || "موظف"}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-sm truncate text-muted-foreground font-medium">
                          {String(req.payload.reason || req.payload.notes || "لا توجد تفاصيل إضافية")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 rounded-full font-bold text-[10px]">
                              المرحلة {req.currentStepIndex} من {req.totalSteps}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            {req.currentApproverRole || "المعتمد الحالي"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[10px] text-muted-foreground">
                          {req.submittedAt ? req.submittedAt.slice(0, 10) : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {req.dueAt ? (
                            <span className="text-[10px] font-mono text-muted-foreground block">
                              {req.dueAt.slice(0, 10)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">معياري (48س)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => setSelectedRequest(req)}
                              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-7 px-3 cursor-pointer"
                            >
                              اتخاذ قرار
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!isInboxLoading && inboxRequests.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-10 text-muted-foreground font-medium"
                      >
                        رائع! لا توجد طلبات معلقة بانتظار قرارك حالياً 🎉
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {(inboxData?.totalCount || 0) > 15 && (
              <div className="flex justify-between items-center pt-2 text-xs text-muted-foreground">
                <span>إجمالي الطلبات: {inboxData?.totalCount}</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={inboxPage <= 1}
                    onClick={() => setInboxPage((p) => Math.max(p - 1, 1))}
                    className="h-8 rounded-full px-3"
                  >
                    السابق
                  </Button>
                  <span className="font-mono">صفحة {inboxPage}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={inboxPage * 15 >= (inboxData?.totalCount || 0)}
                    onClick={() => setInboxPage((p) => p + 1)}
                    className="h-8 rounded-full px-3"
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: My Requests */}
        <TabsContent value="my_requests" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  سجل طلباتي ومتابعة مسار الاعتمادات
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تتبع تقدم طلباتك، التعديل على الطلبات المعادة، أو سحب الطلبات قبل الاعتماد
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setIsNewRequestOpen(true)}
                  className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground h-9 px-4 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  طلب جديد
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start">رقم الطلب</th>
                    <th className="py-3 px-4 text-start">نوع المعاملة</th>
                    <th className="py-3 px-4 text-start">المبررات والتفاصيل</th>
                    <th className="py-3 px-4 text-center">تقدم المسار</th>
                    <th className="py-3 px-4 text-center">تاريخ التقديم</th>
                    <th className="py-3 px-4 text-center">الحالة الحالية</th>
                    <th className="py-3 px-4 text-center">الإجراءات والتتبع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isMyRequestsLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        جاري تحميل طلباتك...
                      </td>
                    </tr>
                  ) : myRequests.map((req) => {
                    const catalogItem = getRequestCatalogItem(req.type);
                    return (
                      <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-primary">
                          {req.referenceNo}
                          {((req as any).revisionNumber || 1) > 1 && (
                            <span className="mr-1 text-[9px] text-muted-foreground">
                              (تعديل {(req as any).revisionNumber})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-foreground">
                          <span className="flex items-center gap-1.5">
                            {renderCatalogIcon(catalogItem.icon)}
                            {catalogItem.nameAr}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-muted-foreground font-medium">
                          {String(req.payload.reason || "—")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono font-bold text-foreground">
                            {req.currentStepIndex} / {req.totalSteps}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[10px] text-muted-foreground">
                          {req.submittedAt ? req.submittedAt.slice(0, 10) : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              req.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                                : req.status === "rejected"
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : req.status === "returned"
                                    ? "bg-purple-500/10 text-purple-700 border-purple-300"
                                    : req.status === "cancelled"
                                      ? "bg-muted text-muted-foreground border-border"
                                      : "bg-amber-500/10 text-amber-700 border-amber-300"
                            }`}
                          >
                            {req.status === "approved"
                              ? "معتمد نهائياً"
                              : req.status === "rejected"
                                ? "مرفوض"
                                : req.status === "returned"
                                  ? "معاد للاستكمال"
                                  : req.status === "cancelled"
                                    ? "مسحوب"
                                    : "قيد المراجعة"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedRequest(req)}
                              className="h-7 text-xs font-bold text-primary hover:bg-secondary rounded-full px-2.5 cursor-pointer"
                            >
                              التفاصيل
                            </Button>
                            {req.status === "returned" && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenResubmit(req)}
                                className="h-7 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-full px-2.5 gap-1 cursor-pointer"
                              >
                                <RotateCcw className="h-3 w-3" />
                                تعديل وإعادة تقديم
                              </Button>
                            )}
                            {(req.status === "pending" || req.status === "pending_approval") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenWithdraw(req)}
                                className="h-7 text-[11px] font-bold text-destructive hover:bg-destructive/10 rounded-full px-2.5 border-destructive/30 cursor-pointer"
                              >
                                سحب الطلب
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!isMyRequestsLoading && myRequests.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-10 text-muted-foreground font-medium"
                      >
                        لم تقم بتقديم أي طلبات حتى الآن
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: Approval Chains Designer */}
        <TabsContent value="chains" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600" />
                  مصمم سلاسل ومسارات الاعتماد المؤسسية
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  بناء وتخصيص مستويات الموافقة لكل نوع خدمة مع دعم التعيين المحدد والأولويات والتاريخ الساري
                </p>
              </div>

              {canApprove && (
                <Button
                  size="sm"
                  onClick={() => setIsNewChainOpen(true)}
                  className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground h-9 px-4 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  تصميم مسار جديد
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isChainsLoading ? (
                <div className="col-span-2 text-center py-10 text-muted-foreground">
                  جاري تحميل مسارات الاعتماد...
                </div>
              ) : approvalChains.map((chain) => {
                const catalogItem = getRequestCatalogItem(chain.requestType);
                return (
                  <div
                    key={chain.id}
                    className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs space-y-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-foreground">{chain.nameAr}</span>
                          {chain.isDefault && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-full">
                              افتراضي
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[9px] rounded-full font-mono">
                            v{(chain as any).version || 1}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium block mt-0.5">
                          نوع المعاملة: {catalogItem.nameAr} • النطاق:{" "}
                          {chain.scopeType === "all_employees" ? "كافة الموظفين" : chain.scopeType}
                        </span>
                      </div>

                      {!chain.isDefault && canApprove && (
                        <button
                          type="button"
                          onClick={() => mutations.archiveChain(chain.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 cursor-pointer"
                          title="أرشفة المسار"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Visual Steps Chain */}
                    <div className="pt-2 space-y-2">
                      <span className="text-[11px] font-bold text-muted-foreground block">
                        مستويات الاعتماد ({chain.steps.length} خطوات):
                      </span>
                      <div className="space-y-1.5">
                        {chain.steps.map((step, idx) => (
                          <div
                            key={step.sequence}
                            className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 border border-border/60 text-xs"
                          >
                            <span className="h-5 w-5 rounded-full bg-primary/15 text-primary font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-foreground flex-1 truncate">
                              {step.stepNameAr}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono rounded-full shrink-0"
                            >
                              {step.resolverType === "direct_manager"
                                ? "المدير المباشر"
                                : step.resolverType === "hr_manager"
                                  ? "مدير الموارد البشرية"
                                  : step.resolverType === "finance_manager"
                                    ? "المدير المالي"
                                    : step.resolverType === "specific_employee"
                                      ? "موظف محدد"
                                      : "مدير الإدارة"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: Delegation of Authority */}
        <TabsContent value="delegations" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
                  قواعد تفويض الصلاحيات (Delegation of Authority & Out of Office)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تفويض صلاحيات اتخاذ القرار والاعتماد لموظف بديل أثناء الإجازات والانتدابات مع التوثيق الكامل
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsNewDelegationOpen(true)}
                className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground h-9 px-4 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                تفعيل تفويض جديد
              </Button>
            </div>

            {/* Delegation Rules Table */}
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start">المفوض (الأصيل)</th>
                    <th className="py-3 px-4 text-start">المفوض له (البديل)</th>
                    <th className="py-3 px-4 text-center">فترة التفويض</th>
                    <th className="py-3 px-4 text-center">نطاق الصلاحيات</th>
                    <th className="py-3 px-4 text-start">سبب ومبرر التفويض</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isDelegationsLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        جاري تحميل التفويضات...
                      </td>
                    </tr>
                  ) : delegationRules.map((del) => (
                    <tr key={del.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-foreground">{del.delegatorName}</td>
                      <td className="py-3 px-4 font-bold text-primary">{del.delegateName}</td>
                      <td className="py-3 px-4 text-center font-mono text-[11px]">
                        {del.startDate} — {del.endDate}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={`rounded-full text-[10px] font-bold ${
                            del.scope === "all_requests"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {del.scope === "all_requests" ? "كافة الطلبات والمعاملات" : del.scope}
                        </Badge>
                      </td>
                      <td
                        className="py-3 px-4 max-w-xs truncate text-muted-foreground font-medium"
                        title={del.reason}
                      >
                        {del.reason || "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            del.status === "active"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                              : del.status === "revoked"
                                ? "bg-destructive/10 text-destructive border-destructive/30"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {del.status === "active"
                            ? "ساري المفعول"
                            : del.status === "revoked"
                              ? "ملغى يدوياً"
                              : "منتهي"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {del.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => mutations.revokeDelegation(del.id)}
                            className="h-7 text-[11px] font-bold text-destructive hover:bg-destructive/10 rounded-full px-2.5 border-destructive/30 cursor-pointer"
                          >
                            إلغاء التفويض
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!isDelegationsLoading && delegationRules.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-10 text-muted-foreground font-medium"
                      >
                        لا توجد قواعد تفويض مسجلة حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL: Request Details & Timeline with Decision Actions */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-base font-black flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  تفاصيل الطلب: {selectedRequest?.referenceNo}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium mt-0.5">
                  مقدم من: {selectedRequest?.requesterName} • {selectedRequest?.departmentName || selectedRequest?.requesterJobTitle || "موظف"}
                </DialogDescription>
              </div>
              <Badge variant="outline" className="rounded-full text-xs font-mono">
                {selectedRequest ? getRequestCatalogItem(selectedRequest.type).nameAr : ""}
              </Badge>
            </div>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 text-xs py-2">
              {/* Payload Data */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                <span className="font-bold text-foreground block">بيانات ومحتوى الطلب:</span>
                <div className="grid grid-cols-2 gap-2 font-medium text-muted-foreground">
                  {Object.entries(selectedRequest.payload).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-border/40 pb-1">
                      <span className="capitalize">{k}:</span>
                      <span className="font-bold text-foreground">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Approval Timeline Stepper */}
              <div className="space-y-2">
                <span className="font-bold text-foreground block">
                  المسار الزمني وسجل الموافقات الإلكترونية:
                </span>
                <div className="border-r-2 border-primary/30 pr-4 space-y-3 mr-2">
                  <div className="relative">
                    <div className="absolute -right-[23px] top-0.5 h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="font-bold text-foreground block">
                      تقديم الطلب بواسطة {selectedRequest.requesterName}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {selectedRequest.submittedAt}
                    </span>
                  </div>

                  {selectedRequest.timeline?.map((evt) => (
                    <div key={evt.id} className="relative">
                      <div
                        className={`absolute -right-[23px] top-0.5 h-3 w-3 rounded-full ${
                          evt.action === "approved"
                            ? "bg-emerald-500"
                            : evt.action === "rejected"
                              ? "bg-destructive"
                              : "bg-amber-500"
                        }`}
                      />
                      <span className="font-bold text-foreground block">
                        المرحلة {evt.stepNumber}:{" "}
                        {evt.action === "approved"
                          ? "موافقة"
                          : evt.action === "rejected"
                            ? "رفض"
                            : evt.action === "returned"
                              ? "إعادة للاستكمال"
                              : evt.action} • {evt.actorName} ({evt.actorRole})
                      </span>
                      {evt.note && (
                        <p className="text-[11px] text-muted-foreground italic mt-0.5">
                          "{evt.note}"
                        </p>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {evt.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision Input & Actions (if pending) */}
              {(selectedRequest.status === "pending" || selectedRequest.status === "pending_approval") && canApprove && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <label className="font-bold text-foreground block">
                    ملاحظات وتوجيهات القرار:
                  </label>
                  <textarea
                    rows={2}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="اكتب التوجيهات أو الملاحظات التي ستظهر لمقدم الطلب..."
                    className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(selectedRequest.id)}
                      className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      موافقة واعتماد الطلب
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReturn(selectedRequest.id)}
                      className="rounded-full text-xs font-bold text-amber-700 border-amber-300 hover:bg-amber-50 px-4 cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      إعادة للتعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(selectedRequest.id)}
                      className="rounded-full text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/10 px-4 cursor-pointer"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      رفض
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Create New Request */}
      <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              تقديم طلب خدمة إدارية جديد
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              سيتم توجيه الطلب تلقائياً لمسار الاعتماد المعتمد حسب الدليل الإجرائي
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">نوع الخدمة المطلوبة *</label>
              <select
                value={reqType}
                onChange={(e) => setReqType(e.target.value as any)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {CANONICAL_REQUEST_CATALOG.filter((c) => c.active).map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.nameAr} ({cat.nameEn})
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Fields according to Request Type */}
            {(reqType === "leave" || reqType === "attendance_correction" || reqType === "overtime") && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="font-bold">
                    {reqType === "leave" ? "تاريخ البدء *" : "تاريخ اليوم المعني *"}
                  </label>
                  <input
                    type="date"
                    value={reqStartDate}
                    onChange={(e) => setReqStartDate(e.target.value)}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                {reqType === "leave" ? (
                  <div className="space-y-1.5">
                    <label className="font-bold">تاريخ الانتهاء *</label>
                    <input
                      type="date"
                      value={reqEndDate}
                      onChange={(e) => setReqEndDate(e.target.value)}
                      className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="font-bold">عدد الساعات / الدقائق</label>
                    <input
                      type="number"
                      value={reqDays}
                      onChange={(e) => setReqDays(e.target.value ? Number(e.target.value) : "")}
                      placeholder="مثال: 2"
                      className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                )}
              </div>
            )}

            {(reqType === "expense_claim" || reqType === "loan_advance") && (
              <div className="space-y-1.5">
                <label className="font-bold">المبلغ المطلوب (ريال سعودي) *</label>
                <input
                  type="number"
                  value={reqAmount}
                  onChange={(e) => setReqAmount(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0.00"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-bold">تفاصيل ومبررات الطلب *</label>
              <textarea
                rows={3}
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="اكتب الغرض من الطلب وكافة الملاحظات التوضيحية اللازمة لاعتماده..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">
                رابط المرفق أو المستند الداعم (اختياري)
              </label>
              <input
                type="text"
                value={reqAttachmentUrl}
                onChange={(e) => setReqAttachmentUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateNewRequest}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-9 cursor-pointer"
            >
              إرسال الطلب للاعتماد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Return and Resubmit (Item 10) */}
      <Dialog open={isResubmitOpen} onOpenChange={setIsResubmitOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-purple-600" />
              تعديل وإعادة تقديم الطلب: {requestToResubmit?.referenceNo}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              سيتم تحديث الطلب وإعادة إرساله لمسار الاعتماد مع حفظ تسلسل المراجعات
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-200 text-purple-900 space-y-1">
              <span className="font-bold block">ملاحظة المعتمد السابقة:</span>
              <p className="text-[11px] italic">
                "{String(requestToResubmit?.decisionNote || "يرجى استكمال البيانات")}"
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">المبررات والتفاصيل بعد التعديل *</label>
              <textarea
                rows={3}
                value={resubmitReason}
                onChange={(e) => setResubmitReason(e.target.value)}
                placeholder="اكتب التعديلات التي قمت بها وفق ملاحظات المعتمد..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">
                ملاحظة توضيحية للمعتمد (اختياري)
              </label>
              <input
                type="text"
                value={resubmitNote}
                onChange={(e) => setResubmitNote(e.target.value)}
                placeholder="تم إرفاق المستندات المطلوبة وتعديل التواريخ..."
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleConfirmResubmit}
              className="rounded-full text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 h-9 cursor-pointer"
            >
              إعادة التقديم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Withdraw Request (Item 11) */}
      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              تأكيد سحب الطلب: {requestToWithdraw?.referenceNo}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              سيتم إلغاء متابعة الطلب نهائياً وتحرير أي أرصدة محجوزة مرتبطة به
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">سبب سحب الطلب *</label>
              <textarea
                rows={2}
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="اذكر سبب الرغبة في إلغاء وسحب هذا الطلب..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsWithdrawOpen(false)}
              className="rounded-full text-xs px-4"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmWithdraw}
              className="rounded-full text-xs bg-destructive hover:bg-destructive/90 text-white font-bold px-5 h-9 cursor-pointer"
            >
              تأكيد السحب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Multi-level Chain Designer */}
      <Dialog open={isNewChainOpen} onOpenChange={setIsNewChainOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              تصميم مسار موافقات متعدد المستويات
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد تسلسل مستويات الاعتماد مع ضبط جهات التعيين والأولويات
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم مسار الاعتماد *</label>
              <input
                type="text"
                value={chainNameAr}
                onChange={(e) => setChainNameAr(e.target.value)}
                placeholder="مثال: مسار اعتمادات المصروفات التشغيلية والمشاريع"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">نوع المعاملة</label>
                <select
                  value={chainCategory}
                  onChange={(e) => setChainCategory(e.target.value as any)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {CANONICAL_REQUEST_CATALOG.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">نطاق التطبيق</label>
                <select
                  value={chainScope}
                  onChange={(e) => setChainScope(e.target.value as any)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all_employees">كافة الموظفين</option>
                  <option value="department">إدارة محددة</option>
                  <option value="subsidiary">شركة تابعة محددة</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">الأولوية (Priority)</label>
                <input
                  type="number"
                  value={chainPriority}
                  onChange={(e) => setChainPriority(Number(e.target.value) || 100)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Dynamic Step Builder */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex justify-between items-center">
                <label className="font-bold">
                  مستويات الاعتماد المتسلسلة ({chainSteps.length}):
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddStepToChain}
                  className="h-7 text-[11px] rounded-full px-2.5 font-bold gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  إضافة مستوى
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {chainSteps.map((step, idx) => (
                  <div
                    key={step.sequence}
                    className="flex items-center gap-2 p-2.5 rounded-2xl bg-muted/40 border border-border/60 text-xs"
                  >
                    <span className="h-6 w-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={step.stepNameAr}
                      onChange={(e) => {
                        const val = e.target.value;
                        setChainSteps((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, stepNameAr: val } : s)),
                        );
                      }}
                      className="flex-1 h-8 rounded-xl border border-border/80 bg-card px-2 text-xs"
                    />
                    <select
                      value={step.resolverType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setChainSteps((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, resolverType: val } : s)),
                        );
                      }}
                      className="h-8 rounded-xl border border-border/80 bg-card px-2 text-xs"
                    >
                      <option value="direct_manager">المدير المباشر</option>
                      <option value="department_head">مدير الإدارة</option>
                      <option value="hr_manager">مدير الموارد البشرية</option>
                      <option value="finance_manager">المدير المالي</option>
                      <option value="specific_employee">موظف محدد</option>
                    </select>
                    {chainSteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStepFromChain(idx)}
                        className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateNewChain}
              className="rounded-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 h-9 cursor-pointer"
            >
              حفظ وتفعيل المسار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: New Delegation */}
      <Dialog open={isNewDelegationOpen} onOpenChange={setIsNewDelegationOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
              تفعيل تفويض صلاحيات جديد (Out of Office)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تفويض صلاحيات اعتماد المعاملات لموظف بديل خلال فترة الغياب مع التوثيق
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الموظف المفوض له (البديل) *</label>
              <select
                value={delegateEmpId}
                onChange={(e) => setDelegateEmpId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">اختر الموظف البديل...</option>
                {employees
                  .filter((e) => e.id !== currentUser?.id)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstNameAr} {emp.lastNameAr} ({emp.jobTitleAr || "موظف"})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">من تاريخ *</label>
                <input
                  type="date"
                  value={delStartDate}
                  onChange={(e) => setDelStartDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">إلى تاريخ *</label>
                <input
                  type="date"
                  value={delEndDate}
                  onChange={(e) => setDelEndDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">نطاق الصلاحيات المفوضة</label>
              <select
                value={delScope}
                onChange={(e) => setDelScope(e.target.value as any)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all_requests">كافة الطلبات والمعاملات</option>
                <option value="leave">طلبات الإجازات فقط</option>
                <option value="expense_claim">مطالبات المصروفات فقط</option>
                <option value="loan_advance">السلف المالية فقط</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">مبرر وسبب التفويض *</label>
              <textarea
                rows={2}
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
                placeholder="مثال: إجازة سنوية، انتداب لمهمة عمل رسمية..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateDelegation}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-9 cursor-pointer"
            >
              تفعيل التفويض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
