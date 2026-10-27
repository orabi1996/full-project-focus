import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import type {
  RequestCategory,
  ApprovalChain,
  ApprovalStep,
  DelegationRule,
} from "../../types";
import {
  Layers,
  Plus,
  Trash2,
  ArrowLeftRight,
  ExternalLink,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
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
  useApprovalChains,
  useMyDelegations,
  useWorkflowEngineMutations,
  CANONICAL_REQUEST_CATALOG,
  getRequestCatalogItem,
} from "../../lib/domains/workflow";

export const WorkflowChainsSetupPanel: React.FC = () => {
  const { employees, currentUser, currentRole, company } = useApp();
  const navigate = useNavigate();
  const canManage =
    canManageModule(currentRole, "setup") || canManageModule(currentRole, "workflow");

  const { data: approvalChains = [], isLoading: isChainsLoading } = useApprovalChains();
  const { data: delegationRules = [], isLoading: isDelegationsLoading } = useMyDelegations();
  const mutations = useWorkflowEngineMutations();

  const [isNewChainOpen, setIsNewChainOpen] = useState(false);
  const [isNewDelegationOpen, setIsNewDelegationOpen] = useState(false);

  // Chain Designer State
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

  // Delegation State
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

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              تهيئة مسارات الاعتماد وقواعد التفويض لشركة «{company?.legalNameAr || "الأندلس"}»
            </h2>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">
              شاشة التهيئة والحوكمة
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            تصميم سلاسل الموافقات متعددة المستويات وقواعد تفويض الصلاحيات، بينما تتم معالجة الطلبات اليومية في شاشة صندوق الوارد.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/workflows" })}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-3.5 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            الانتقال لصندوق الوارد والطلبات اليومية
          </Button>
          {canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsNewDelegationOpen(true)}
                className="rounded-full text-xs font-bold gap-1.5 h-9 px-3.5 cursor-pointer"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-600" />
                تفعيل تفويض جديد
              </Button>
              <Button
                size="sm"
                onClick={() => setIsNewChainOpen(true)}
                className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                تصميم مسار اعتماد جديد
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Section 1: Approval Chains */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">
              سلاسل ومسارات الاعتماد المؤسسية ({approvalChains.length})
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full">
            حوكمة متعددة المستويات
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isChainsLoading ? (
            <div className="col-span-2 text-center py-8 text-xs text-muted-foreground">
              جاري تحميل مسارات الاعتماد...
            </div>
          ) : approvalChains.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-xs text-muted-foreground">
              لا توجد مسارات اعتماد مخصصة حالياً.
            </div>
          ) : (
            approvalChains.map((chain) => {
              const catalogItem = getRequestCatalogItem(chain.requestType);
              return (
                <div
                  key={chain.id}
                  className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs space-y-3 hover:border-primary/40 transition-colors"
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
                        نوع المعاملة: {catalogItem.nameAr} • النطاق:{" "}
                        {chain.scopeType === "all_employees" ? "كافة الموظفين" : chain.scopeType}
                      </span>
                    </div>

                    {!chain.isDefault && canManage && (
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

                  <div className="pt-2 space-y-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground block">
                      مستويات الاعتماد ({chain.steps.length} خطوات):
                    </span>
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
                                : step.resolverType === "specific_employee"
                                  ? "موظف محدد"
                                  : "مدير الإدارة"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Section 2: Delegation of Authority Rules */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-black text-foreground">
              قواعد تفويض الصلاحيات المعتمدة ({delegationRules.length})
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full border-emerald-500/30 text-emerald-600">
            Out of Office & Delegation
          </Badge>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-4 text-start">المفوض (الأصيل)</th>
                <th className="py-3 px-4 text-start">المفوض له (البديل)</th>
                <th className="py-3 px-4 text-center">فترة التفويض</th>
                <th className="py-3 px-4 text-center">نطاق الصلاحيات</th>
                <th className="py-3 px-4 text-start">سبب التفويض</th>
                <th className="py-3 px-4 text-center">الحالة</th>
                <th className="py-3 px-4 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isDelegationsLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    جاري تحميل التفويضات...
                  </td>
                </tr>
              ) : delegationRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    لا توجد قواعد تفويض مسجلة حالياً.
                  </td>
                </tr>
              ) : (
                delegationRules.map((del) => (
                  <tr key={del.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground">{del.delegatorName}</td>
                    <td className="py-3 px-4 font-bold text-primary">{del.delegateName}</td>
                    <td className="py-3 px-4 text-center font-mono text-[11px]">
                      {del.startDate} — {del.endDate}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge className="rounded-full text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                        {del.scope === "all_requests" ? "كافة الطلبات والمعاملات" : del.scope}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-muted-foreground font-medium">
                      {del.reason || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          del.status === "active"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {del.status === "active" ? "ساري المفعول" : "ملغى / منتهي"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {del.status === "active" && canManage && (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Multi-level Chain Designer */}
      <Dialog open={isNewChainOpen} onOpenChange={setIsNewChainOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6" dir="rtl">
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
        <DialogContent className="max-w-md rounded-3xl p-6" dir="rtl">
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
