import React, { useState, useMemo, useCallback } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  BarChart3,
  PlusCircle,
  CheckCircle,
  Clock,
  AlertCircle,
  Layers,
  GitBranch,
  Calendar,
  ClipboardList,
  History,
  RefreshCw,
  ChevronRight,
  Building2,
  UserPlus,
} from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import {
  useWorkforcePlans,
  useWorkforcePlanLines,
  useWorkforcePlanForecasts,
  useHeadcountRequests,
  useWorkforceKPIs,
  useActualHeadcount,
  usePlanVsActual,
  useWorkforcePlanningDomain,
  type WorkforcePlanEnriched,
  type HeadcountRequest,
} from "@/lib/domains/workforce-planning";

// ────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────
function fmtN(n: number) {
  return n.toLocaleString("ar-SA");
}
function fmtCurrency(n: number) {
  if (!n) return "0 ر.س";
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1)}M ر.س`;
  if (Math.abs(n) >= 1_000)
    return `${(n / 1_000).toFixed(1)}K ر.س`;
  return `${n.toFixed(0)} ر.س`;
}
function planStatusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    pending_approval: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const labels: Record<string, string> = {
    draft: "مسودة",
    pending_approval: "بانتظار الاعتماد",
    approved: "معتمد",
  };
  return { cls: map[status] ?? "", label: labels[status] ?? status };
}
function requestPriorityBadge(p: string) {
  const map: Record<string, string> = {
    low: "bg-gray-100 text-gray-600",
    normal: "bg-blue-50 text-blue-700",
    high: "bg-orange-50 text-orange-700",
    critical: "bg-red-50 text-red-700",
  };
  const labels: Record<string, string> = {
    low: "منخفض",
    normal: "عادي",
    high: "عالي",
    critical: "حرج",
  };
  return { cls: map[p] ?? "", label: labels[p] ?? p };
}

// ────────────────────────────────────────────────
// KPI CARD
// ────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
  trend,
  color = "primary",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  color?: "primary" | "emerald" | "amber" | "red";
}) {
  const colors = {
    primary: "text-primary bg-secondary",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    red: "text-red-600 bg-red-50",
  };
  return (
    <div className="classera-kpi-card p-4 shadow-xs flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
        <h4 className="text-xl font-black text-foreground mt-0.5 font-mono tabular-nums">
          {typeof value === "number" ? fmtN(value) : value}
        </h4>
        {sub && (
          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5 mt-0.5">
            {trend === "up" && <TrendingUp className="h-2.5 w-2.5 text-emerald-600" />}
            {trend === "down" && <TrendingDown className="h-2.5 w-2.5 text-red-500" />}
            {sub}
          </span>
        )}
      </div>
      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// PLAN STATUS ICON
// ────────────────────────────────────────────────
function PlanStatusIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  if (status === "pending_approval") return <Clock className="h-4 w-4 text-amber-500" />;
  return <AlertCircle className="h-4 w-4 text-gray-400" />;
}

// ────────────────────────────────────────────────
// CREATE PLAN DIALOG
// ────────────────────────────────────────────────
function CreatePlanDialog({
  open,
  onClose,
  companyId,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
}) {
  const domain = useWorkforcePlanningDomain();
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    titleAr: `خطة القوى العاملة ${currentYear}`,
    titleEn: `Workforce Plan ${currentYear}`,
    fiscalYear: currentYear,
    planType: "annual",
    fteBudget: 0,
    totalCompensationBudget: 0,
    saudizationTargetPct: 0,
    notes: "",
  });

  const handleSubmit = useCallback(async () => {
    if (!form.titleAr.trim()) return;
    const res = await domain.createPlan({
      companyId,
      titleAr: form.titleAr,
      titleEn: form.titleEn,
      fiscalYear: form.fiscalYear,
      planType: form.planType,
      fteBudget: form.fteBudget,
      totalCompensationBudget: form.totalCompensationBudget,
      saudizationTargetPct: form.saudizationTargetPct,
      notes: form.notes,
    });
    if (res.ok) onClose();
  }, [form, companyId, domain, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            إنشاء خطة قوى عاملة جديدة
          </DialogTitle>
          <DialogDescription className="text-xs font-medium">
            أدخل بيانات الخطة الاستراتيجية للقوى العاملة والميزانية السنوية
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 text-xs py-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5 font-bold col-span-2">
              اسم الخطة بالعربية *
              <input
                value={form.titleAr}
                onChange={(e) => setForm((f) => ({ ...f, titleAr: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="خطة القوى العاملة 2026"
              />
            </label>
            <label className="space-y-1.5 font-bold">
              السنة المالية *
              <input
                type="number"
                value={form.fiscalYear}
                onChange={(e) => setForm((f) => ({ ...f, fiscalYear: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="space-y-1.5 font-bold">
              نوع الخطة
              <select
                value={form.planType}
                onChange={(e) => setForm((f) => ({ ...f, planType: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="annual">سنوية</option>
                <option value="quarterly">ربع سنوية</option>
                <option value="project">مشروع</option>
              </select>
            </label>
            <label className="space-y-1.5 font-bold">
              ميزانية الرواتب والتعويضات (ر.س)
              <input
                type="number"
                value={form.totalCompensationBudget}
                onChange={(e) => setForm((f) => ({ ...f, totalCompensationBudget: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="space-y-1.5 font-bold">
              ميزانية معادل الدوام الكامل (FTE)
              <input
                type="number"
                step="0.5"
                value={form.fteBudget}
                onChange={(e) => setForm((f) => ({ ...f, fteBudget: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="space-y-1.5 font-bold">
              مستهدف السعودة (%)
              <input
                type="number"
                min="0"
                max="100"
                value={form.saudizationTargetPct}
                onChange={(e) => setForm((f) => ({ ...f, saudizationTargetPct: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="space-y-1.5 font-bold col-span-2">
              ملاحظات
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={domain.isCreatingPlan || !form.titleAr.trim()}
            className="flex-1 rounded-xl text-xs font-bold"
          >
            {domain.isCreatingPlan ? "جاري الإنشاء..." : "إنشاء الخطة"}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs font-bold"
          >
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────
// HEADCOUNT REQUEST DIALOG
// ────────────────────────────────────────────────
function CreateHeadcountRequestDialog({
  open,
  onClose,
  companyId,
  selectedPlanId,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  selectedPlanId?: string;
}) {
  const domain = useWorkforcePlanningDomain();
  const [form, setForm] = useState({
    positionTitleAr: "",
    positionTitleEn: "",
    requestedHeadcount: 1,
    employmentType: "full_time",
    priority: "normal",
    justificationAr: "",
    minMonthlySalary: 0,
    maxMonthlySalary: 0,
  });

  const handleSubmit = useCallback(async () => {
    if (!form.positionTitleAr.trim()) return;
    const res = await domain.createHeadcountRequest({
      companyId,
      positionTitleAr: form.positionTitleAr,
      positionTitleEn: form.positionTitleEn,
      requestedHeadcount: form.requestedHeadcount,
      employmentType: form.employmentType,
      priority: form.priority,
      justificationAr: form.justificationAr,
      minMonthlySalary: form.minMonthlySalary || undefined,
      maxMonthlySalary: form.maxMonthlySalary || undefined,
      planId: selectedPlanId,
    });
    if (res.ok) onClose();
  }, [form, companyId, domain, onClose, selectedPlanId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            طلب توظيف / رفع احتياج بشري
          </DialogTitle>
          <DialogDescription className="text-xs font-medium">
            إنشاء طلب احتياج بشري رسمي مرتبط بخطة القوى العاملة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs py-2">
          <label className="space-y-1.5 font-bold block">
            المسمى الوظيفي بالعربية *
            <input
              value={form.positionTitleAr}
              onChange={(e) => setForm((f) => ({ ...f, positionTitleAr: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5 font-bold">
              عدد المطلوب
              <input
                type="number"
                min="1"
                value={form.requestedHeadcount}
                onChange={(e) => setForm((f) => ({ ...f, requestedHeadcount: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="space-y-1.5 font-bold">
              الأولوية
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="low">منخفض</option>
                <option value="normal">عادي</option>
                <option value="high">عالي</option>
                <option value="critical">حرج</option>
              </select>
            </label>
            <label className="space-y-1.5 font-bold">
              نوع التوظيف
              <select
                value={form.employmentType}
                onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="full_time">دوام كامل</option>
                <option value="part_time">دوام جزئي</option>
                <option value="contract">تعاقد</option>
                <option value="intern">تدريب / تأهيل</option>
              </select>
            </label>
            <label className="space-y-1.5 font-bold">
              الحد الأدنى للراتب (ر.س / شهر)
              <input
                type="number"
                value={form.minMonthlySalary}
                onChange={(e) => setForm((f) => ({ ...f, minMonthlySalary: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          </div>
          <label className="space-y-1.5 font-bold block">
            مسوّغ الاحتياج
            <textarea
              value={form.justificationAr}
              onChange={(e) => setForm((f) => ({ ...f, justificationAr: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border/80 bg-muted/40 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={domain.isCreatingRequest || !form.positionTitleAr.trim()}
            className="flex-1 rounded-xl text-xs font-bold"
          >
            {domain.isCreatingRequest ? "جاري الإنشاء..." : "رفع الطلب"}
          </Button>
          <Button variant="outline" onClick={onClose} className="rounded-xl text-xs font-bold">
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────
// PLAN DETAIL PANEL
// ────────────────────────────────────────────────
function PlanDetailPanel({
  plan,
  companyId,
  onBack,
}: {
  plan: WorkforcePlanEnriched;
  companyId: string;
  onBack: () => void;
}) {
  const domain = useWorkforcePlanningDomain();
  const linesQuery = useWorkforcePlanLines(plan.id);
  const forecastsQuery = useWorkforcePlanForecasts(plan.id, plan.fiscalYear);
  const pvActualQuery = usePlanVsActual(plan.id, companyId);
  const [innerTab, setInnerTab] = useState("overview");
  const [showHcDialog, setShowHcDialog] = useState(false);

  const pvActual = pvActualQuery.data;
  const forecasts = forecastsQuery.data ?? [];
  const lines = linesQuery.data ?? [];

  const handleSubmit = () => domain.submitPlan(plan.id, companyId);
  const handleApprove = () => domain.approvePlan(plan.id, companyId, "approve");
  const handleReject = () => domain.approvePlan(plan.id, companyId, "reject");
  const handleGenForecast = () => domain.generateForecast(companyId, plan.id, plan.fiscalYear);

  const statusBadge = planStatusBadge(plan.status);

  return (
    <div className="space-y-4">
      {/* Back Bar */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="rounded-xl text-xs font-bold"
        >
          ← العودة للخطط
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-black text-foreground">{plan.titleAr}</span>
        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
          {statusBadge.label}
        </Badge>
        <span className="text-xs text-muted-foreground font-medium">
          {plan.planCode} • النسخة {plan.versionNumber} • {plan.fiscalYear}
        </span>
      </div>

      {/* Plan Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {plan.status === "draft" && (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={domain.isSubmittingPlan}
            className="rounded-xl text-xs font-bold"
          >
            <ChevronRight className="h-3.5 w-3.5 me-1" />
            رفع للاعتماد
          </Button>
        )}
        {plan.status === "pending_approval" && (
          <>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={domain.isApprovingPlan}
              className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle className="h-3.5 w-3.5 me-1" />
              اعتماد
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              disabled={domain.isApprovingPlan}
              className="rounded-xl text-xs font-bold text-red-600 border-red-200"
            >
              رفض
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenForecast}
          disabled={domain.isGeneratingForecast}
          className="rounded-xl text-xs font-bold"
        >
          <Calendar className="h-3.5 w-3.5 me-1" />
          إنشاء التوقعات الشهرية
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowHcDialog(true)}
          className="rounded-xl text-xs font-bold"
        >
          <UserPlus className="h-3.5 w-3.5 me-1" />
          رفع احتياج بشري
        </Button>
      </div>

      {/* Inner Tabs */}
      <Tabs value={innerTab} onValueChange={setInnerTab} className="w-full">
        <TabsList className="classera-tabs-strip w-full justify-start">
          {[
            { val: "overview", label: "نظرة عامة" },
            { val: "lines", label: `سطور الخطة (${lines.length})` },
            { val: "gap", label: "فجوة الاحتياج" },
            { val: "cost", label: "الميزانية والتكلفة" },
            { val: "forecast", label: `التوقعات الشهرية (${forecasts.length})` },
          ].map((t) => (
            <TabsTrigger
              key={t.val}
              value={t.val}
              className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="العدد المستهدف" value={plan.targetHeadcount} icon={Target} color="primary" />
            <KpiCard
              label="الفعلي على رأس العمل"
              value={pvActual?.actualEmployed ?? "—"}
              icon={Users}
              color="emerald"
              sub={pvActual ? `الفجوة: ${pvActual.headcountGap}` : undefined}
            />
            <KpiCard
              label="FTE المخطط"
              value={plan.fteBudget || "—"}
              icon={GitBranch}
              color="primary"
              sub={pvActual ? `الفعلي: ${pvActual.actualFte.toFixed(1)}` : undefined}
            />
            <KpiCard
              label="ميزانية التعويضات"
              value={fmtCurrency(plan.totalCompensationBudget)}
              icon={DollarSign}
              color="amber"
            />
          </div>

          {/* Plan Summary Card */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
            <h4 className="text-sm font-black text-foreground">ملخص الخطة</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {[
                { label: "كود الخطة", val: plan.planCode ?? "—" },
                { label: "النسخة", val: `v${plan.versionNumber}` },
                { label: "نوع الخطة", val: plan.planType === "annual" ? "سنوية" : plan.planType === "quarterly" ? "ربع سنوية" : "مشروع" },
                { label: "التعيينات المخططة", val: `+${plan.plannedHires}` },
                { label: "المغادرات المخططة", val: `-${plan.plannedExits}` },
                { label: "مستهدف السعودة", val: `${plan.saudizationTargetPct}%` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/60 p-3 bg-muted/20">
                  <span className="text-muted-foreground font-bold block">{item.label}</span>
                  <span className="font-black text-foreground mt-0.5 block">{item.val}</span>
                </div>
              ))}
            </div>
            {plan.notes && (
              <p className="text-xs text-muted-foreground border-t border-border/60 pt-3">{plan.notes}</p>
            )}
          </div>
        </TabsContent>

        {/* PLAN LINES */}
        <TabsContent value="lines" className="space-y-4 pt-4">
          {linesQuery.isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-xs font-medium">جاري تحميل سطور الخطة...</div>
          ) : lines.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm font-medium">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-20" />
              لا توجد سطور في الخطة بعد
            </div>
          ) : (
            <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-right px-4 py-3 font-bold text-muted-foreground">المنصب</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">المخطط</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">المستهدف</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">تعيينات</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">FTE</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">متوسط التعويض/شهر</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">نوع التوظيف</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr
                      key={line.id}
                      className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3 font-bold text-foreground">{line.positionTitleAr}</td>
                      <td className="px-3 py-3 text-center font-mono font-black text-primary">{line.plannedHeadcount}</td>
                      <td className="px-3 py-3 text-center font-mono font-black text-foreground">{line.targetHeadcount}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-emerald-600">+{line.hiresPlanned}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold">{line.ftePerHead.toFixed(1)}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-amber-600">{fmtCurrency(line.avgMonthlyCompensation)}</td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="outline" className="text-[10px] rounded-full px-2">
                          {line.employmentType === "full_time" ? "كامل" : line.employmentType === "part_time" ? "جزئي" : line.employmentType === "contract" ? "تعاقد" : "تدريب"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* GAP ANALYSIS */}
        <TabsContent value="gap" className="space-y-4 pt-4">
          {pvActualQuery.isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-xs font-medium">جاري تحميل بيانات الفجوة...</div>
          ) : pvActual ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard label="المستهدف" value={pvActual.plannedTargetHeadcount} icon={Target} color="primary" />
                <KpiCard label="الفعلي على رأس العمل" value={pvActual.actualEmployed} icon={Users} color="emerald" />
                <KpiCard
                  label="الفجوة (Vacancy)"
                  value={pvActual.headcountGap}
                  icon={pvActual.headcountGap > 0 ? TrendingDown : CheckCircle}
                  color={pvActual.headcountGap > 0 ? "red" : "emerald"}
                />
                <KpiCard
                  label="فجوة FTE"
                  value={pvActual.fteGap.toFixed(1)}
                  icon={GitBranch}
                  color={pvActual.fteGap > 0 ? "amber" : "emerald"}
                />
              </div>

              {/* Per-line gap detail */}
              {pvActual.planLines.length > 0 && (
                <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-border/60">
                    <h4 className="text-sm font-black">تفصيل الفجوة بحسب المنصب</h4>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30">
                        <th className="text-right px-4 py-3 font-bold text-muted-foreground">المنصب</th>
                        <th className="text-center px-3 py-3 font-bold text-muted-foreground">المستهدف</th>
                        <th className="text-center px-3 py-3 font-bold text-muted-foreground">الفعلي</th>
                        <th className="text-center px-3 py-3 font-bold text-muted-foreground">الفجوة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pvActual.planLines.map((l) => {
                        const gap = l.target_headcount - l.actual_in_dept;
                        return (
                          <tr key={l.line_id} className="border-b border-border/40 hover:bg-muted/20">
                            <td className="px-4 py-3 font-bold text-foreground">{l.position_title_ar}</td>
                            <td className="px-3 py-3 text-center font-mono font-black text-primary">{l.target_headcount}</td>
                            <td className="px-3 py-3 text-center font-mono font-black text-emerald-600">{l.actual_in_dept}</td>
                            <td className="px-3 py-3 text-center">
                              <span className={`font-mono font-black ${gap > 0 ? "text-red-600" : gap < 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                {gap > 0 ? `+${gap} وظيفة شاغرة` : gap < 0 ? `${gap} زيادة` : "✓ مكتمل"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground text-sm font-medium">
              لا توجد بيانات متاحة
            </div>
          )}
        </TabsContent>

        {/* COST / BUDGET */}
        <TabsContent value="cost" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="ميزانية التعويضات السنوية" value={fmtCurrency(plan.totalCompensationBudget)} icon={DollarSign} color="primary" />
            <KpiCard label="الميزانية الشهرية التقديرية" value={fmtCurrency(plan.totalCompensationBudget / 12)} icon={Calendar} color="amber" />
            <KpiCard label="التكلفة المتوقعة (خطوط الخطة)" value={fmtCurrency(lines.reduce((a, l) => a + l.avgMonthlyCompensation * l.targetHeadcount * 12, 0))} icon={BarChart3} color="emerald" />
          </div>

          {lines.length > 0 && (
            <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <div className="p-4 border-b border-border/60">
                <h4 className="text-sm font-black">تفصيل التكلفة بحسب المنصب</h4>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-right px-4 py-3 font-bold text-muted-foreground">المنصب</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">العدد</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">تعويض / شهر</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">تكلفة شهرية</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">تكلفة سنوية</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.id} className={`border-b border-border/40 hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-bold text-foreground">{l.positionTitleAr}</td>
                      <td className="px-3 py-3 text-center font-mono font-black">{l.targetHeadcount}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-muted-foreground">{fmtCurrency(l.avgMonthlyCompensation)}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-amber-600">
                        {fmtCurrency(l.avgMonthlyCompensation * l.targetHeadcount)}
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-black text-primary">
                        {fmtCurrency(l.avgMonthlyCompensation * l.targetHeadcount * 12)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-black border-t border-border">
                    <td className="px-4 py-3 font-black text-foreground" colSpan={3}>الإجمالي</td>
                    <td className="px-3 py-3 text-center font-mono font-black text-amber-700">
                      {fmtCurrency(lines.reduce((a, l) => a + l.avgMonthlyCompensation * l.targetHeadcount, 0))}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-black text-primary">
                      {fmtCurrency(lines.reduce((a, l) => a + l.avgMonthlyCompensation * l.targetHeadcount * 12, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* MONTHLY FORECAST */}
        <TabsContent value="forecast" className="space-y-4 pt-4">
          {forecastsQuery.isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-xs font-medium">جاري تحميل التوقعات...</div>
          ) : forecasts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm font-medium">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
              لا توجد توقعات شهرية — اضغط "إنشاء التوقعات الشهرية" أعلاه
            </div>
          ) : (
            <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-right px-4 py-3 font-bold text-muted-foreground">الشهر</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">عدد القوى العاملة</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">تعيينات</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">مغادرات</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">FTE</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">التكلفة الشهرية</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">الفعلي</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map((f) => {
                    const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
                    const variance = f.actualHeadcount != null ? f.actualHeadcount - f.forecastHeadcount : null;
                    return (
                      <tr key={f.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-3 font-bold text-foreground">{monthNames[f.forecastMonth - 1]} {f.forecastYear}</td>
                        <td className="px-3 py-3 text-center font-mono font-black text-primary">{f.forecastHeadcount}</td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-emerald-600">+{f.forecastHires}</td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-red-500">-{f.forecastExits}</td>
                        <td className="px-3 py-3 text-center font-mono font-bold">{f.forecastFte.toFixed(1)}</td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-amber-600">{fmtCurrency(f.forecastTotalCost)}</td>
                        <td className="px-3 py-3 text-center">
                          {f.actualHeadcount != null ? (
                            <span className={`font-mono font-bold ${variance! > 0 ? "text-emerald-600" : variance! < 0 ? "text-red-500" : "text-foreground"}`}>
                              {f.actualHeadcount} {variance !== 0 && `(${variance! > 0 ? "+" : ""}${variance})`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showHcDialog && (
        <CreateHeadcountRequestDialog
          open={showHcDialog}
          onClose={() => setShowHcDialog(false)}
          companyId={companyId}
          selectedPlanId={plan.id}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// MAIN WORKFORCE PLANNING VIEW
// ────────────────────────────────────────────────
interface WorkforcePlanningViewProps {
  companyId?: string;
}

export function WorkforcePlanningView({ companyId }: WorkforcePlanningViewProps) {
  const { company } = useApp();
  const effectiveCompanyId = companyId || company?.id;

  const [activeTab, setActiveTab] = useState("overview");
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<WorkforcePlanEnriched | null>(null);
  const [fiscalYearFilter] = useState<number>(new Date().getFullYear());
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");

  const plansQuery = useWorkforcePlans({ fiscalYear: fiscalYearFilter });
  const kpisQuery = useWorkforceKPIs(effectiveCompanyId ?? null, fiscalYearFilter);
  const actualHcQuery = useActualHeadcount(effectiveCompanyId ?? null);
  const hcRequestsQuery = useHeadcountRequests(
    requestStatusFilter !== "all" ? { status: requestStatusFilter } : undefined
  );

  const domain = useWorkforcePlanningDomain();

  const kpis = kpisQuery.data;
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const requests = useMemo(() => hcRequestsQuery.data ?? [], [hcRequestsQuery.data]);
  const actualHc = actualHcQuery.data;

  const approvedPlans = useMemo(() => plans.filter((p) => p.status === "approved"), [plans]);
  const pendingPlans = useMemo(() => plans.filter((p) => p.status === "pending_approval"), [plans]);
  const draftPlans = useMemo(() => plans.filter((p) => p.status === "draft"), [plans]);

  // If user selected a plan, show detail panel instead
  if (selectedPlan) {
    return (
      <PlanDetailPanel
        plan={selectedPlan}
        companyId={effectiveCompanyId ?? ""}
        onBack={() => setSelectedPlan(null)}
      />
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground">التخطيط الاستراتيجي للقوى العاملة</h2>
            <p className="text-xs text-muted-foreground font-medium">
              خطط الموارد البشرية • ميزانية الرواتب • الاحتياج البشري • التوقعات الشهرية
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { plansQuery.refetch(); kpisQuery.refetch(); actualHcQuery.refetch(); }}
            className="rounded-xl text-xs font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5 me-1" />
            تحديث
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateRequest(true)}
            variant="outline"
            className="rounded-xl text-xs font-bold"
          >
            <UserPlus className="h-3.5 w-3.5 me-1" />
            رفع احتياج
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreatePlan(true)}
            className="rounded-xl text-xs font-bold"
          >
            <PlusCircle className="h-3.5 w-3.5 me-1" />
            خطة جديدة
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="classera-tabs-strip w-full justify-start">
          {[
            { val: "overview", label: "نظرة عامة" },
            { val: "plans", label: `الخطط (${plans.length})` },
            { val: "headcount-gap", label: "فجوة الاحتياج" },
            { val: "cost-budget", label: "الميزانية" },
            { val: "requests", label: `طلبات التوظيف (${requests.length})` },
            { val: "scenarios", label: "السيناريوهات" },
          ].map((t) => (
            <TabsTrigger
              key={t.val}
              value={t.val}
              className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ===== TAB 1: OVERVIEW ===== */}
        <TabsContent value="overview" className="space-y-4 pt-4">
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              label="على رأس العمل / في الخدمة"
              value={actualHc?.totalEmployed ?? kpis?.totalEmployed ?? 0}
              icon={Users}
              color="primary"
              sub={`نشط: ${actualHc?.totalActive ?? 0} | إجازة: ${actualHc?.totalOnLeave ?? 0}`}
            />
            <KpiCard
              label="معادل دوام كامل (FTE)"
              value={(actualHc?.fteTotal ?? 0).toFixed(1)}
              icon={GitBranch}
              color="emerald"
              sub={`من أصل ${kpis?.totalPlannedHires ?? 0} مخطط للتعيين`}
            />
            <KpiCard
              label="نسبة السعودة"
              value={`${(actualHc?.saudizationPct ?? 0).toFixed(1)}%`}
              icon={Building2}
              color={
                (actualHc?.saudizationPct ?? 0) >= 40 ? "emerald" :
                (actualHc?.saudizationPct ?? 0) >= 20 ? "amber" : "red"
              }
              sub={`سعودي: ${actualHc?.saudiCount ?? 0} | وافد: ${actualHc?.expatCount ?? 0}`}
            />
            <KpiCard
              label="الوظائف الشاغرة"
              value={kpis?.openVacancies ?? 0}
              icon={AlertCircle}
              color={kpis && kpis.openVacancies > 0 ? "red" : "emerald"}
              sub={`طلبات معتمدة: ${kpis?.approvedHcRequests ?? 0}`}
            />
            <KpiCard
              label="خطط معتمدة"
              value={kpis?.approvedPlans ?? 0}
              icon={CheckCircle}
              color="emerald"
              sub={`بانتظار اعتماد: ${kpis?.pendingPlans ?? 0}`}
            />
            <KpiCard
              label="ميزانية التعويضات"
              value={fmtCurrency(kpis?.totalCompensationBudget ?? 0)}
              icon={DollarSign}
              color="amber"
              sub={`متوسط شهري: ${fmtCurrency((kpis?.totalCompensationBudget ?? 0) / 12)}`}
            />
          </div>

          {/* Dept Breakdown */}
          {actualHc?.deptBreakdown && actualHc.deptBreakdown.length > 0 && (
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
              <h4 className="text-sm font-black">التوزيع الفعلي حسب القسم (مصدر: سجل الموظفين)</h4>
              <div className="space-y-2">
                {actualHc.deptBreakdown.slice(0, 8).map((dept) => {
                  const pct = actualHc.totalEmployed > 0
                    ? Math.round((dept.total_employed / actualHc.totalEmployed) * 100)
                    : 0;
                  return (
                    <div key={dept.department_id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-foreground w-32 truncate shrink-0">{dept.department_name}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-black text-foreground w-16 text-left shrink-0">
                        {dept.total_employed} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Plans */}
          {plans.length > 0 && (
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black">آخر الخطط</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("plans")}
                  className="text-xs font-bold rounded-xl"
                >
                  عرض الكل ←
                </Button>
              </div>
              <div className="space-y-2">
                {plans.slice(0, 4).map((p) => {
                  const badge = planStatusBadge(p.status);
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlan(p)}
                      className="flex items-center justify-between p-3 rounded-2xl border border-border/60 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <PlanStatusIcon status={p.status} />
                        <div>
                          <p className="text-xs font-black text-foreground">{p.titleAr}</p>
                          <p className="text-[10px] text-muted-foreground">{p.planCode} • {p.fiscalYear}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">{p.targetHeadcount} موظف</span>
                        <Badge variant="outline" className={`text-[10px] rounded-full px-2 ${badge.cls}`}>
                          {badge.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB 2: PLANS ===== */}
        <TabsContent value="plans" className="space-y-4 pt-4">
          {plansQuery.isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-xs font-medium">جاري تحميل الخطط...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold mb-2">لا توجد خطط بعد</p>
              <p className="text-xs mb-4">أنشئ أول خطة للقوى العاملة لهذه السنة</p>
              <Button size="sm" onClick={() => setShowCreatePlan(true)} className="rounded-xl text-xs font-bold">
                <PlusCircle className="h-3.5 w-3.5 me-1" />
                إنشاء خطة
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Approved */}
              {approvedPlans.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" /> الخطط المعتمدة ({approvedPlans.length})
                  </h4>
                  {approvedPlans.map((p) => (
                    <PlanCard key={p.id} plan={p} onClick={() => setSelectedPlan(p)} />
                  ))}
                </div>
              )}
              {/* Pending */}
              {pendingPlans.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-amber-700 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> بانتظار الاعتماد ({pendingPlans.length})
                  </h4>
                  {pendingPlans.map((p) => (
                    <PlanCard key={p.id} plan={p} onClick={() => setSelectedPlan(p)} />
                  ))}
                </div>
              )}
              {/* Draft */}
              {draftPlans.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-gray-600 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> مسودات ({draftPlans.length})
                  </h4>
                  {draftPlans.map((p) => (
                    <PlanCard key={p.id} plan={p} onClick={() => setSelectedPlan(p)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ===== TAB 3: HEADCOUNT GAP ===== */}
        <TabsContent value="headcount-gap" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="على رأس العمل (فعلي)" value={actualHc?.totalEmployed ?? 0} icon={Users} color="primary" />
            <KpiCard label="العدد المخطط" value={plans.filter(p=>p.status==="approved").reduce((a,p)=>a+p.targetHeadcount,0)} icon={Target} color="emerald" />
            <KpiCard label="الوظائف الشاغرة المقدّرة" value={kpis?.openVacancies ?? 0} icon={AlertCircle} color={kpis && kpis.openVacancies > 0 ? "red" : "emerald"} />
          </div>
          {actualHc?.deptBreakdown && actualHc.deptBreakdown.length > 0 && (
            <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <div className="p-4 border-b border-border/60">
                <h4 className="text-sm font-black">توزيع القوى العاملة الفعلية حسب الأقسام</h4>
                <p className="text-xs text-muted-foreground mt-0.5">مصدر: سجل الموظفين المباشر (نشط + تحت التجربة + في إجازة)</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-right px-4 py-3 font-bold text-muted-foreground">القسم</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">نشط</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">تحت تجربة</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">في إجازة</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {actualHc.deptBreakdown.map((d) => (
                    <tr key={d.department_id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-4 py-3 font-bold text-foreground">{d.department_name}</td>
                      <td className="px-3 py-3 text-center font-mono font-black text-emerald-600">{d.active}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-amber-600">{d.probation}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-blue-500">{d.on_leave}</td>
                      <td className="px-3 py-3 text-center font-mono font-black text-primary">{d.total_employed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB 4: COST / BUDGET ===== */}
        <TabsContent value="cost-budget" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="إجمالي الميزانية المعتمدة" value={fmtCurrency(kpis?.totalCompensationBudget ?? 0)} icon={DollarSign} color="primary" />
            <KpiCard label="متوسط الراتب الشهري" value={fmtCurrency(kpis?.avgMonthlyPayroll ?? 0)} icon={TrendingUp} color="emerald" sub="مصدر: آخر مسير رواتب" />
            <KpiCard label="الميزانية الشهرية التقديرية" value={fmtCurrency((kpis?.totalCompensationBudget ?? 0) / 12)} icon={Calendar} color="amber" />
          </div>

          {approvedPlans.length > 0 && (
            <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <div className="p-4 border-b border-border/60">
                <h4 className="text-sm font-black">ميزانية الخطط المعتمدة</h4>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-right px-4 py-3 font-bold text-muted-foreground">الخطة</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">السنة</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">ميزانية التعويضات</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">FTE المخطط</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">الهدف الوظيفي</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedPlans.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPlan(p)}
                      className="border-b border-border/40 hover:bg-muted/20 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-bold text-foreground">{p.titleAr}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold">{p.fiscalYear}</td>
                      <td className="px-3 py-3 text-center font-mono font-black text-primary">{fmtCurrency(p.totalCompensationBudget)}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold">{p.fteBudget.toFixed(1)}</td>
                      <td className="px-3 py-3 text-center font-mono font-black text-emerald-600">{p.targetHeadcount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB 5: HEADCOUNT REQUESTS ===== */}
        <TabsContent value="requests" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {["all","draft","submitted","approved","rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => setRequestStatusFilter(s)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${requestStatusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"}`}
                >
                  {{ all: "الكل", draft: "مسودة", submitted: "مرفوع", approved: "معتمد", rejected: "مرفوض" }[s]}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => setShowCreateRequest(true)} className="rounded-xl text-xs font-bold">
              <PlusCircle className="h-3.5 w-3.5 me-1" />
              طلب جديد
            </Button>
          </div>

          {hcRequestsQuery.isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-xs font-medium">جاري تحميل الطلبات...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm font-medium">
              <UserPlus className="h-10 w-10 mx-auto mb-3 opacity-20" />
              لا توجد طلبات توظيف
            </div>
          ) : (
            <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-right px-4 py-3 font-bold text-muted-foreground">رقم الطلب</th>
                    <th className="text-right px-3 py-3 font-bold text-muted-foreground">المنصب</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">العدد</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">الأولوية</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">الحالة</th>
                    <th className="text-center px-3 py-3 font-bold text-muted-foreground">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const pBadge = requestPriorityBadge(req.priority);
                    const sBadge = planStatusBadge(req.status);
                    return (
                      <tr key={req.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono font-bold text-primary">{req.requestNo}</td>
                        <td className="px-3 py-3 font-bold text-foreground">{req.positionTitleAr}</td>
                        <td className="px-3 py-3 text-center font-mono font-black">{req.requestedHeadcount}</td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="outline" className={`text-[10px] rounded-full px-2 ${pBadge.cls}`}>
                            {pBadge.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="outline" className={`text-[10px] rounded-full px-2 ${sBadge.cls}`}>
                            {sBadge.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {req.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[10px] font-bold rounded-lg px-2 py-1 h-auto"
                              onClick={() => domain.approveHeadcountRequest(req.id, req.companyId, "approve")}
                            >
                              اعتماد
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB 6: SCENARIOS ===== */}
        <TabsContent value="scenarios" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-black">السيناريوهات والنسخ البديلة</h4>
                <p className="text-xs text-muted-foreground font-medium">خطط بديلة: متفائل، واقعي، متشائم</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              لإنشاء سيناريو بديل، افتح أي خطة معتمدة ✓ ثم اختر "إنشاء نسخة جديدة".
              الخطط المعتمدة مؤمّنة ضد التعديل — يتم إنشاء نسخة جديدة قابلة للتعديل تلقائياً.
            </p>
            {approvedPlans.length > 0 && (
              <div className="mt-4 space-y-2">
                {approvedPlans.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlan(p)}
                    className="flex items-center justify-between p-3 rounded-2xl border border-border/60 hover:bg-muted/30 cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-black text-foreground">{p.titleAr}</p>
                      <p className="text-[10px] text-muted-foreground">{p.planCode} • النسخة {p.versionNumber}</p>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-xl text-[10px] font-bold">
                      فتح ←
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {showCreatePlan && effectiveCompanyId && (
        <CreatePlanDialog
          open={showCreatePlan}
          onClose={() => setShowCreatePlan(false)}
          companyId={effectiveCompanyId}
        />
      )}
      {showCreateRequest && effectiveCompanyId && (
        <CreateHeadcountRequestDialog
          open={showCreateRequest}
          onClose={() => setShowCreateRequest(false)}
          companyId={effectiveCompanyId}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// PLAN CARD COMPONENT
// ────────────────────────────────────────────────
function PlanCard({ plan, onClick }: { plan: WorkforcePlanEnriched; onClick: () => void }) {
  const badge = planStatusBadge(plan.status);
  return (
    <div
      onClick={onClick}
      className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer hover:border-primary/30"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <PlanStatusIcon status={plan.status} />
          <div>
            <h4 className="text-sm font-black text-foreground">{plan.titleAr}</h4>
            <p className="text-[10px] text-muted-foreground font-medium">
              {plan.planCode} • v{plan.versionNumber} • {plan.fiscalYear}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-full ${badge.cls}`}>
          {badge.label}
        </Badge>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="rounded-xl border border-border/50 p-2.5 bg-muted/20">
          <p className="text-muted-foreground font-bold text-[10px]">الهدف</p>
          <p className="font-black text-foreground font-mono">{plan.targetHeadcount}</p>
        </div>
        <div className="rounded-xl border border-border/50 p-2.5 bg-muted/20">
          <p className="text-muted-foreground font-bold text-[10px]">تعيينات</p>
          <p className="font-black text-emerald-600 font-mono">+{plan.plannedHires}</p>
        </div>
        <div className="rounded-xl border border-border/50 p-2.5 bg-muted/20">
          <p className="text-muted-foreground font-bold text-[10px]">FTE</p>
          <p className="font-black text-foreground font-mono">{plan.fteBudget.toFixed(1)}</p>
        </div>
        <div className="rounded-xl border border-border/50 p-2.5 bg-muted/20">
          <p className="text-muted-foreground font-bold text-[10px]">ميزانية</p>
          <p className="font-black text-primary font-mono">{fmtCurrency(plan.totalCompensationBudget)}</p>
        </div>
      </div>
    </div>
  );
}
