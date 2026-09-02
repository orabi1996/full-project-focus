import React, { useState, useMemo } from "react";
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
  GitPullRequest,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Plus,
  Filter,
  User,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
  Send,
  FileCheck,
  Sparkles,
  Trash2,
  Calendar,
  UserCheck,
  Search,
  CheckSquare,
  Square,
  ShieldAlert,
  ArrowLeftRight,
  Info,
  Sliders,
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

export const WorkflowView: React.FC = () => {
  const {
    requests,
    approvalChains,
    delegationRules,
    employees,
    currentUser,
    currentRole,
    approveRequest,
    rejectRequest,
    returnRequest,
    submitRequest,
    addApprovalChain,
    deleteApprovalChain,
    addDelegationRule,
    revokeDelegationRule,
    openEmployeeProfile,
    language,
    t,
  } = useApp();

  const canApprove = canManageModule(currentRole, "workflow");

  const [activeTab, setActiveTab] = useState<"inbox" | "my_requests" | "chains" | "delegations">(
    "inbox",
  );

  // Filter States
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxCategoryFilter, setInboxCategoryFilter] = useState<string>("all");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);

  // Selected Request for Detail Modal
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [decisionNote, setDecisionNote] = useState("");

  // Modals
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isNewChainOpen, setIsNewChainOpen] = useState(false);
  const [isNewDelegationOpen, setIsNewDelegationOpen] = useState(false);

  // New Request State
  const [reqType, setReqType] = useState<RequestCategory>("general");
  const [reqReason, setReqReason] = useState("");

  // New Chain Designer State
  const [chainNameAr, setChainNameAr] = useState("");
  const [chainCategory, setChainCategory] = useState<RequestCategory>("leave");
  const [chainScope, setChainScope] = useState<ApprovalChain["scopeType"]>("all_employees");
  const [chainSteps, setChainSteps] = useState<ApprovalStep[]>([
    {
      sequence: 1,
      stepNameAr: "موافقة المدير المباشر",
      stepNameEn: "Direct Manager Approval",
      resolverType: "direct_manager",
    },
    {
      sequence: 2,
      stepNameAr: "موافقة مدير إدارة الموارد البشرية",
      stepNameEn: "HR Manager Approval",
      resolverType: "hr_manager",
    },
  ]);

  // New Delegation State
  const [delegateEmpId, setDelegateEmpId] = useState(employees[0]?.id || "");
  const [delStartDate, setDelStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [delEndDate, setDelEndDate] = useState("2026-09-15");
  const [delScope, setDelScope] = useState<DelegationRule["scope"]>("all_requests");
  const [delReason, setDelReason] = useState("");

  const pendingInbox = useMemo(() => {
    return requests.filter((r) => r.status === "pending_approval");
  }, [requests]);

  const filteredInbox = useMemo(() => {
    return pendingInbox.filter((r) => {
      const matchesSearch =
        r.referenceNo.toLowerCase().includes(inboxSearch.toLowerCase()) ||
        r.requesterName.toLowerCase().includes(inboxSearch.toLowerCase()) ||
        (r.departmentName && r.departmentName.toLowerCase().includes(inboxSearch.toLowerCase()));

      const matchesCat = inboxCategoryFilter === "all" || r.type === inboxCategoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [pendingInbox, inboxSearch, inboxCategoryFilter]);

  const myRequests = useMemo(() => {
    return requests.filter((r) => r.requesterId === currentUser.id);
  }, [requests, currentUser.id]);

  const activeDelegation = useMemo(() => {
    return delegationRules.find(
      (d) => d.status === "active" && (d.delegatorId === currentUser.id || d.delegateId === currentUser.id),
    );
  }, [delegationRules, currentUser.id]);

  // Bulk Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedRequestIds.length === filteredInbox.length) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(filteredInbox.map((r) => r.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedRequestIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleBulkApprove = () => {
    if (selectedRequestIds.length === 0) {
      toast.error("يرجى تحديد طلب واحد على الأقل للاعتماد");
      return;
    }
    selectedRequestIds.forEach((id) => {
      approveRequest(id, "تم الاعتماد السريع ضمن دفعة الاعتمادات المجمعة");
    });
    toast.success(`تم اعتماد ${selectedRequestIds.length} طلبات بنجاح`);
    setSelectedRequestIds([]);
  };

  const handleApprove = (id: string) => {
    approveRequest(id, decisionNote || "تمت الموافقة والاعتماد الإلكتروني");
    setSelectedRequest(null);
    setDecisionNote("");
  };

  const handleReject = (id: string) => {
    rejectRequest(id, decisionNote || "تم الرفض لعدم استيفاء الشروط");
    setSelectedRequest(null);
    setDecisionNote("");
  };

  const handleReturn = (id: string) => {
    returnRequest(id, decisionNote || "يرجى استكمال المستندات الداعمة والمراجعة");
    setSelectedRequest(null);
    setDecisionNote("");
  };

  const handleCreateNewRequest = () => {
    if (!reqReason.trim()) {
      toast.error("يرجى كتابة تفاصيل ومبررات الطلب");
      return;
    }
    submitRequest({
      type: reqType,
      payload: {
        reason: reqReason,
      },
    });
    setIsNewRequestOpen(false);
    setReqReason("");
  };

  // Dynamic Step Helpers for Designer
  const handleAddStepToChain = () => {
    const nextSeq = chainSteps.length + 1;
    setChainSteps((prev) => [
      ...prev,
      {
        sequence: nextSeq,
        stepNameAr: `المستوى ${nextSeq}: موافقة الإدارة المعنية`,
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
    // Re-index sequences
    setChainSteps(updated.map((s, idx) => ({ ...s, sequence: idx + 1 })));
  };

  const handleCreateNewChain = () => {
    if (!chainNameAr.trim()) {
      toast.error("يرجى كتابة اسم مسار الاعتماد");
      return;
    }
    addApprovalChain({
      nameAr: chainNameAr,
      nameEn: chainNameAr,
      requestType: chainCategory,
      scopeType: chainScope,
      status: "active",
      isDefault: false,
      steps: chainSteps,
    });
    setIsNewChainOpen(false);
    setChainNameAr("");
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
  };

  const handleCreateDelegation = () => {
    if (!delReason.trim()) {
      toast.error("يرجى كتابة سبب التفويض");
      return;
    }
    const targetDelegate = employees.find((e) => e.id === delegateEmpId);
    if (!targetDelegate) return;

    addDelegationRule({
      delegatorId: currentUser.id,
      delegatorName: `${currentUser.firstNameAr} ${currentUser.lastNameAr} (${currentUser.jobTitleAr})`,
      delegateId: targetDelegate.id,
      delegateName: `${targetDelegate.firstNameAr} ${targetDelegate.lastNameAr} (${targetDelegate.jobTitleAr})`,
      startDate: delStartDate,
      endDate: delEndDate,
      reason: delReason,
      scope: delScope,
    });

    setIsNewDelegationOpen(false);
    setDelReason("");
  };

  const categoryLabels: Record<RequestCategory, string> = {
    leave: "طلب إجازة",
    attendance_correction: "تصحيح بصمة",
    expense_claim: "مطالبة مصروفات",
    loan_advance: "سلفة مالية",
    salary_certificate: "شهادة تعريف بالراتب",
    resignation: "طلب استقالة / إخلاء طرف",
    asset_request: "طلب عهدة / أجهزة",
    general: "طلب إداري عام",
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="approval" source="material" filled size={26} className="text-primary" />
            محرك الطلبات ومسارات الاعتماد الذكية (M05)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            إدارة تدفقات الموافقات متعددة المستويات، تفويض الصلاحيات، والاعتماد الإلكتروني الموثق
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeDelegation && (
            <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 rounded-full px-3 py-1 text-xs gap-1.5 font-bold">
              <ArrowLeftRight className="h-3.5 w-3.5 text-amber-600" />
              تفويض مفعل: {activeDelegation.delegateName.split(" ")[0]}
            </Badge>
          )}

          <Button
            onClick={() => setIsNewRequestOpen(true)}
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-xs h-10 px-5"
          >
            <Plus className="h-4 w-4" />
            تقديم طلب جديد
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">صندوق الوارد (بانتظار الاعتماد)</span>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{pendingInbox.length}</p>
            <span className="text-[10px] text-muted-foreground font-bold">تتطلب اتخاذ قرار</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">طلباتي المقدمة</span>
            <p className="text-2xl font-black text-foreground mt-0.5">{myRequests.length}</p>
            <span className="text-[10px] text-emerald-600 font-bold">
              {myRequests.filter((r) => r.status === "approved").length} معتمد •{" "}
              {myRequests.filter((r) => r.status === "pending_approval").length} جاري
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Send className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">سلاسل الاعتماد النشطة</span>
            <p className="text-2xl font-black text-indigo-600 mt-0.5">
              {approvalChains.filter((c) => c.status === "active").length}
            </p>
            <span className="text-[10px] text-muted-foreground font-bold">تغطي كافة أقسام المنشأة</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
            <Layers className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">قواعد تفويض الصلاحيات</span>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">
              {delegationRules.filter((d) => d.status === "active").length}
            </p>
            <span className="text-[10px] text-muted-foreground font-bold">سارية المفعول حالياً</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-muted/40 p-1 rounded-2xl border border-border/60">
          <TabsTrigger value="inbox" className="rounded-xl text-xs font-bold gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            صندوق الوارد للاعتماد
            {pendingInbox.length > 0 && (
              <Badge className="mr-1 bg-amber-500 text-white rounded-full text-[10px] h-4 px-1.5">
                {pendingInbox.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="my_requests" className="rounded-xl text-xs font-bold gap-1.5">
            <Send className="h-3.5 w-3.5 text-primary" />
            طلباتي ومتابعة الحالات
            <Badge className="mr-1 bg-muted text-foreground border border-border rounded-full text-[10px] h-4 px-1.5">
              {myRequests.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="chains" className="rounded-xl text-xs font-bold gap-1.5">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            مصمم مسارات الاعتماد ({approvalChains.length})
          </TabsTrigger>
          <TabsTrigger value="delegations" className="rounded-xl text-xs font-bold gap-1.5">
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
                    onChange={(e) => setInboxSearch(e.target.value)}
                    placeholder="بحث برقم الطلب، اسم الموظف..."
                    className="w-full h-9 rounded-full border border-border/80 bg-muted/40 pr-9 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={inboxCategoryFilter}
                  onChange={(e) => setInboxCategoryFilter(e.target.value)}
                  className="h-9 rounded-full border border-border/80 bg-muted/40 px-3 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">جميع أنواع الطلبات</option>
                  <option value="leave">طلبات الإجازات</option>
                  <option value="attendance_correction">تصحيح البصمة</option>
                  <option value="expense_claim">مطالبات المصروفات</option>
                  <option value="loan_advance">السلف المالية</option>
                  <option value="resignation">الاستقالات وإخلاء الطرف</option>
                  <option value="general">طلبات إدارية عامة</option>
                </select>
              </div>

              {/* Bulk Actions */}
              {canApprove && selectedRequestIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleBulkApprove}
                    className="rounded-full h-9 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4"
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
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {selectedRequestIds.length === filteredInbox.length && filteredInbox.length > 0 ? (
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
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredInbox.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                      {canApprove && (
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectOne(req.id)}
                            className="text-muted-foreground hover:text-foreground"
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
                        <span className="font-mono font-bold text-primary block">{req.referenceNo}</span>
                        <Badge variant="outline" className="text-[10px] rounded-full border-border/80">
                          {categoryLabels[req.type] || req.type}
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
                          {req.departmentName}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-sm truncate text-muted-foreground font-medium">
                        {String(req.payload.reason || req.payload.notes || "لا توجد تفاصيل إضافية")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 rounded-full font-bold text-[10px]">
                            المرحلة {req.currentStepIndex + 1} من {req.totalSteps}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          {req.currentApproverRole || "المدير المباشر"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[10px] text-muted-foreground">
                        {new Date(req.submittedAt).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => setSelectedRequest(req)}
                            className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-7 px-3"
                          >
                            اتخاذ قرار
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInbox.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground font-medium">
                        رائع! لا توجد طلبات معلقة بانتظار اعتمادك حالياً 🎉
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: My Requests */}
        <TabsContent value="my_requests" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-border/60 pb-4">
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                سجل طلباتي ومتابعة مسار الاعتمادات
              </h2>
              <Button
                size="sm"
                onClick={() => setIsNewRequestOpen(true)}
                className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground h-9 px-4"
              >
                <Plus className="h-4 w-4" />
                طلب جديد
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start">رقم الطلب</th>
                    <th className="py-3 px-4 text-start">نوع الخدمة</th>
                    <th className="py-3 px-4 text-start">المبررات والتفاصيل</th>
                    <th className="py-3 px-4 text-center">تقدم المسار</th>
                    <th className="py-3 px-4 text-center">تاريخ التقديم</th>
                    <th className="py-3 px-4 text-center">الحالة الحالية</th>
                    <th className="py-3 px-4 text-center">التفاصيل والتتبع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {myRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {req.referenceNo}
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {categoryLabels[req.type] || req.type}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-muted-foreground font-medium">
                        {String(req.payload.reason || "—")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-foreground">
                          {req.currentStepIndex + 1} / {req.totalSteps}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[10px] text-muted-foreground">
                        {new Date(req.submittedAt).toLocaleDateString("ar-SA")}
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
                                  : "bg-amber-500/10 text-amber-700 border-amber-300"
                          }`}
                        >
                          {req.status === "approved"
                            ? "معتمد نهائياً"
                            : req.status === "rejected"
                              ? "مرفوض"
                              : req.status === "returned"
                                ? "معاد للاستكمال"
                                : "قيد المراجعة"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedRequest(req)}
                          className="h-7 text-xs font-bold text-primary hover:bg-secondary rounded-full px-2.5"
                        >
                          عرض المسار الزمني
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {myRequests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground font-medium">
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
                  بناء وتخصيص مستويات الموافقة لكل نوع خدمة حسب الهيكل الإداري والصلاحيات المالية
                </p>
              </div>

              {canApprove && (
                <Button
                  size="sm"
                  onClick={() => setIsNewChainOpen(true)}
                  className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground h-9 px-4"
                >
                  <Plus className="h-4 w-4" />
                  تصميم مسار جديد
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approvalChains.map((chain) => (
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
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium block mt-0.5">
                        نوع الطلب: {categoryLabels[chain.requestType] || chain.requestType} • النطاق:{" "}
                        {chain.scopeType === "all_employees" ? "كافة الموظفين" : chain.scopeType}
                      </span>
                    </div>

                    {!chain.isDefault && canApprove && (
                      <button
                        type="button"
                        onClick={() => deleteApprovalChain(chain.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="حذف المسار"
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
                          <Badge variant="outline" className="text-[9px] font-mono rounded-full shrink-0">
                            {step.resolverType === "direct_manager"
                              ? "المدير المباشر"
                              : step.resolverType === "hr_manager"
                                ? "مدير الموارد البشرية"
                                : step.resolverType === "finance_manager"
                                  ? "المدير المالي"
                                  : "مدير الإدارة"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
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
                  تمكين المدراء من تفويض صلاحيات اتخاذ القرار والاعتمادات لموظف بديل أثناء الإجازات والانتدابات
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsNewDelegationOpen(true)}
                className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground h-9 px-4"
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
                    <th className="py-3 px-4 text-start">سبب التفويض والمبرر</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {delegationRules.map((del) => (
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
                      <td className="py-3 px-4 max-w-xs truncate text-muted-foreground font-medium" title={del.reason}>
                        {del.reason}
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
                            onClick={() => revokeDelegationRule(del.id)}
                            className="h-7 text-[11px] font-bold text-destructive hover:bg-destructive/10 rounded-full px-2.5 border-destructive/30"
                          >
                            إلغاء التفويض
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {delegationRules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground font-medium">
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
                  مقدم من: {selectedRequest?.requesterName} • {selectedRequest?.departmentName}
                </DialogDescription>
              </div>
              <Badge variant="outline" className="rounded-full text-xs font-mono">
                {selectedRequest ? categoryLabels[selectedRequest.type] || selectedRequest.type : ""}
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
                      {new Date(selectedRequest.submittedAt).toLocaleString("ar-SA")}
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
                        المرحلة {evt.stepNumber}: {evt.action === "approved" ? "موافقة" : evt.action} •{" "}
                        {evt.actorName} ({evt.actorRole})
                      </span>
                      {evt.note && (
                        <p className="text-[11px] text-muted-foreground italic mt-0.5">
                          "{evt.note}"
                        </p>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(evt.timestamp).toLocaleString("ar-SA")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision Input & Actions (if pending) */}
              {selectedRequest.status === "pending_approval" && canApprove && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <label className="font-bold text-foreground block">
                    ملاحظات وقرار الاعتماد (اختياري):
                  </label>
                  <textarea
                    rows={2}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="اكتب أي توجيهات أو مبررات للقرار..."
                    className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(selectedRequest.id)}
                      className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      موافقة واعتماد الطلب
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReturn(selectedRequest.id)}
                      className="rounded-full text-xs font-bold text-amber-700 border-amber-300 hover:bg-amber-50 px-4"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      إعادة للتعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(selectedRequest.id)}
                      className="rounded-full text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/10 px-4"
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
              سيتم توجيه الطلب تلقائياً للمسار المعتمد وفق هيكل الموافقات
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
                <option value="general">طلب إداري عام</option>
                <option value="salary_certificate">طلب شهادة تعريف بالراتب</option>
                <option value="expense_claim">مطالبة عهدة أو مصروفات</option>
                <option value="loan_advance">طلب سلفة مالية طارئة</option>
                <option value="asset_request">طلب أجهزة أو عهدة عمل</option>
                <option value="resignation">طلب إخلاء طرف واستقالة</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">تفاصيل ومبررات الطلب *</label>
              <textarea
                rows={3}
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="اكتب الغرض من الطلب وكافة الملاحظات التوضيحية..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateNewRequest}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-9"
            >
              إرسال الطلب
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
              تحديد تسلسل متسلسل لجهات الاعتماد حسب نوع المعاملة
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

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">نوع الخدمة / المعاملة</label>
                <select
                  value={chainCategory}
                  onChange={(e) => setChainCategory(e.target.value as any)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="leave">الإجازات</option>
                  <option value="expense_claim">المصروفات والعهد</option>
                  <option value="loan_advance">السلف المالية</option>
                  <option value="attendance_correction">تصحيح البصمة</option>
                  <option value="general">طلبات عامة</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">نطاق التطبيق</label>
                <select
                  value={chainScope}
                  onChange={(e) => setChainScope(e.target.value as any)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all_employees">كافة موظفي المنشأة</option>
                  <option value="department">إدارة محددة</option>
                  <option value="subsidiary">شركة تابعة محددة</option>
                </select>
              </div>
            </div>

            {/* Dynamic Step Builder */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex justify-between items-center">
                <label className="font-bold">مستويات الاعتماد المتسلسلة ({chainSteps.length}):</label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddStepToChain}
                  className="h-7 text-[11px] rounded-full px-2.5 font-bold gap-1"
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
                    </select>
                    {chainSteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStepFromChain(idx)}
                        className="text-muted-foreground hover:text-destructive p-1"
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
              className="rounded-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 h-9"
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
              تفويض صلاحيات اعتماد المعاملات لموظف بديل خلال فترة الغياب
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
                {employees
                  .filter((e) => e.id !== currentUser.id)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstNameAr} {emp.lastNameAr} ({emp.jobTitleAr})
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
                placeholder="مثال: إجازة سنوية، انتداب لمؤتمر عمل خارجي..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateDelegation}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-9"
            >
              تفعيل التفويض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
