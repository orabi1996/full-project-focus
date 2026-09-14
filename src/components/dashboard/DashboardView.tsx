import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import {
  Users,
  UserCheck,
  CalendarDays,
  Clock,
  Wallet,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  FileText,
  DollarSign,
  Briefcase,
  Layers,
  Activity,
  Award,
  Zap,
  ShieldCheck,
  ShieldAlert,
  ArrowLeftRight,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  FolderOpen,
  Calendar,
  Building,
  Building2,
  UserX,
  ExternalLink,
  Plus,
  Check,
  Globe,
  Radio,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  FileBadge,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { AppLogo } from "../common/AppLogo";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  useDashboardAnalytics,
  getDefaultDashboardFilters,
} from "../../lib/domains/dashboard";
import type {
  DashboardFilters,
  DashboardPeriodPreset,
} from "../../lib/domains/dashboard/dashboard-types";

// ─── Period Presets ─────────────────────────────────────────────────────────

const PERIOD_PRESETS: { value: DashboardPeriodPreset; labelAr: string }[] = [
  { value: "today",     labelAr: "اليوم" },
  { value: "last7",     labelAr: "آخر 7 أيام" },
  { value: "last30",    labelAr: "آخر 30 يوم" },
  { value: "thisMonth", labelAr: "هذا الشهر" },
  { value: "prevMonth", labelAr: "الشهر الماضي" },
];

function buildFiltersFromPreset(preset: DashboardPeriodPreset): DashboardFilters {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0]!;
  const today = fmt(now);

  switch (preset) {
    case "today":
      return { preset, startDate: today, endDate: today };
    case "last7": {
      const s = new Date(now); s.setDate(now.getDate() - 6);
      return { preset, startDate: fmt(s), endDate: today };
    }
    case "last30": {
      const s = new Date(now); s.setDate(now.getDate() - 29);
      return { preset, startDate: fmt(s), endDate: today };
    }
    case "thisMonth": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { preset, startDate: fmt(s), endDate: today };
    }
    case "prevMonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { preset, startDate: fmt(s), endDate: fmt(e) };
    }
    default:
      return getDefaultDashboardFilters();
  }
}

// ─── Unavailability indicator ───────────────────────────────────────────────
const Unavailable: React.FC<{ reason?: string }> = ({ reason }) => (
  <span className="text-muted-foreground font-medium text-xs">
    {reason === "unauthorized" ? "غير مخوّل" : "غير متاح"}
  </span>
);

// ─── Loading skeleton ────────────────────────────────────────────────────────
const MetricSkeleton: React.FC = () => (
  <div className="h-7 w-20 rounded-lg bg-muted animate-pulse" />
);

// ─── Main Component ──────────────────────────────────────────────────────────
export const DashboardView: React.FC<{ onNavigate: (tabId: string) => void }> = ({
  onNavigate,
}) => {
  const {
    t,
    language,
    currentRole,
    currentUser,
    company,
    orgUnits,
    auditLogs,
    punchInOut,
    openEmployeeProfile,
    approveRequest,
    rejectRequest,
    isSaving,
    requests,
  } = useApp();

  // ── Period Filter State ────────────────────────────────────────────────────
  const [filters, setFilters] = useState<DashboardFilters>(getDefaultDashboardFilters);

  const handlePreset = (preset: DashboardPeriodPreset) => {
    setFilters(buildFiltersFromPreset(preset));
  };

  // ── Analytics from server-side RPCs ───────────────────────────────────────
  const {
    data: analytics,
    trend: trendData,
    isLoading: analyticsLoading,
    isRefreshing,
    refetch,
  } = useDashboardAnalytics(filters);

  // ── Search & Filter for Approvals Stream ──────────────────────────────────
  const [taskSearch, setTaskSearch] = useState("");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState("all");

  // Pending approvals: list from AppContext for interactive decisions
  const pendingApprovals = useMemo(
    () => requests.filter((r) => r.status === "pending_approval"),
    [requests],
  );

  const filteredPendingTasks = useMemo(() => {
    return pendingApprovals.filter((r) => {
      const matchesSearch =
        r.requesterName?.toLowerCase().includes(taskSearch.toLowerCase()) ||
        r.referenceNo?.toLowerCase().includes(taskSearch.toLowerCase());
      const matchesCat = taskCategoryFilter === "all" || r.type === taskCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [pendingApprovals, taskSearch, taskCategoryFilter]);

  // ── Derived from analytics ─────────────────────────────────────────────────
  const headcount = analytics?.headcount;
  const attendance = analytics?.attendance;
  const payroll = analytics?.payroll;
  const documents = analytics?.documents;
  const leaveRoster = analytics?.leaveRoster ?? [];
  const pendingCount = analytics?.pendingApprovals?.count ?? pendingApprovals.length;

  // Saudization (from real headcount data — NO Nitaqat band label)
  const saudiCount = headcount?.saudiCount ?? 0;
  const activeCount = headcount?.activeCount ?? 0;
  const saudizationRate =
    activeCount > 0 ? ((saudiCount / activeCount) * 100).toFixed(1) : "0";
  const expatCount = Math.max(0, activeCount - saudiCount);

  const saudizationPieData = [
    { name: "موظفون سعوديون", value: Math.max(1, saudiCount), color: "#004BCE" },
    { name: "موظفون مقيمون", value: Math.max(1, expatCount), color: "#10b981" },
  ];

  // Attendance trend chart data
  const attendanceTrendData = useMemo(() => {
    if (!trendData?.available || !trendData.trend.length) return [];
    return trendData.trend.map((d) => ({
      day: d.dayLabelAr.trim(),
      present: d.present,
      late: d.late,
      absent: d.absent,
    }));
  }, [trendData]);

  // Department distribution (from real orgUnits)
  const departmentDistributionData = orgUnits.map((unit) => ({
    name:
      language === "ar"
        ? unit.nameAr.replace("قطاع ", "").replace("إدارة ", "").replace("الإدارة العامة لـ", "")
        : unit.nameEn,
    count: unit.employeeCount,
    budget: Math.round(unit.employeeCount * 18500),
  }));

  // Document alert total for KPI badge
  const docAlertTotal = documents
    ? documents.expired + documents.within7d + documents.within30d
    : 0;
  const docCriticalTotal = documents ? documents.expired + documents.within7d : 0;

  // Integration health (from analytics)
  const integrationPlatforms = analytics?.integrations?.platforms ?? [];

  // ── Quick Action Handlers ─────────────────────────────────────────────────
  const handleQuickPunch = async (type: "in" | "out") => {
    if (isSaving) return;
    const res = await punchInOut(type);
    if (res.success) toast.success(res.message);
  };

  const handleDirectApprove = async (id: string, requesterName: string) => {
    if (isSaving) return;
    const saved = await approveRequest(id, "تم الاعتماد الفوري عبر لوحة القيادة التنفيذية");
    if (!saved) return;
    toast.success(`تم اعتماد طلب (${requesterName}) بنجاح`);
  };

  const handleDirectReject = async (id: string, requesterName: string) => {
    if (isSaving) return;
    const saved = await rejectRequest(id, "تم الرفض عبر لوحة القيادة لعدم استيفاء الشروط");
    if (!saved) return;
    toast.info(`تم رفض طلب (${requesterName})`);
  };

  // ── Date display ──────────────────────────────────────────────────────────
  const todayFormatted = new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const payrollPeriodLabel = payroll?.period
    ? new Date(payroll.period + "-01").toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="w-full space-y-6 pb-12">
      {/* 1. Executive Welcome & Command Center Header */}
      <div className="relative overflow-hidden rounded-3xl bg-card border border-border/80 p-6 md:p-8 shadow-xs">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
        <div className="absolute -left-10 -bottom-10 opacity-[0.04] pointer-events-none hidden sm:block">
          <AppLogo height={200} />
        </div>

        <div className="relative z-10 flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          {/* Welcome & System State */}
          <div className="space-y-3.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                مركز القيادة والرقابة التشغيلية المعتمدة
              </span>
              <Badge
                variant="outline"
                className="rounded-full border-border/80 text-muted-foreground text-xs font-semibold px-3 py-0.5"
              >
                {company.legalNameAr}
              </Badge>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                لوحة القيادة التشغيلية
              </span>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                {t.dashboard.welcome}،{" "}
                <span className="text-primary">
                  {language === "ar"
                    ? `${currentUser.firstNameAr} ${currentUser.lastNameAr}`.replace(/\(مدير النظام\)/g, "").trim()
                    : `${currentUser.firstNameEn} ${currentUser.lastNameEn}`.replace(/\(مدير النظام\)/g, "").trim()}
                </span>
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground font-medium flex flex-wrap items-center gap-2">
                <span>متابعة مركزية لكافة مؤشرات العمليات، الأجور، والامتثال وفق الأنظمة السعودية</span>
                <span className="text-muted-foreground/40 hidden sm:inline">•</span>
                <span className="font-semibold text-foreground/80 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  {todayFormatted}
                </span>
              </p>
            </div>

            {/* Micro Pulse Metrics Banner */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <div className="inline-flex items-center gap-2 rounded-xl bg-muted/60 border border-border/70 px-3 py-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">حضور اليوم:</span>
                {analyticsLoading ? (
                  <span className="w-8 h-3 bg-muted animate-pulse rounded" />
                ) : attendance?.available ? (
                  <span className="font-bold text-foreground font-mono">
                    {attendance.eligible && attendance.eligible > 0
                      ? Math.round(((attendance.present ?? 0) / attendance.eligible) * 100)
                      : 0}%
                  </span>
                ) : (
                  <Unavailable reason={attendance?.reasonUnavailable} />
                )}
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-muted/60 border border-border/70 px-3 py-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">نسبة السعوديين:</span>
                {analyticsLoading ? (
                  <span className="w-10 h-3 bg-muted animate-pulse rounded" />
                ) : headcount?.available ? (
                  <span className="font-bold text-primary font-mono">{saudizationRate}%</span>
                ) : (
                  <Unavailable reason={headcount?.reasonUnavailable} />
                )}
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-amber-800 dark:text-amber-300 font-semibold">بانتظار القرار:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400 font-mono">
                  {pendingCount} طلبات
                </span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-purple-800 dark:text-purple-300 font-semibold">مسير الرواتب:</span>
                {analyticsLoading ? (
                  <span className="w-12 h-3 bg-muted animate-pulse rounded" />
                ) : payroll?.available && payroll.status ? (
                  <span className="font-bold text-purple-700 dark:text-purple-400 font-mono">
                    {payroll.status === "paid" ? "مدفوع" : payroll.status === "confirmed_locked" ? "معتمد ومقفل" : "قيد التحضير"}
                  </span>
                ) : (
                  <Unavailable reason={payroll?.reasonUnavailable} />
                )}
              </div>
            </div>
          </div>

          {/* Period Selector + Quick Launchers */}
          <div className="flex flex-col items-start xl:items-end gap-3">
            {/* Period Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handlePreset(p.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    filters.preset === p.value
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/60 text-muted-foreground border-border/70 hover:bg-muted"
                  }`}
                >
                  {p.labelAr}
                </button>
              ))}
              <button
                type="button"
                onClick={refetch}
                className="p-1.5 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                onClick={() => handleQuickPunch("in")}
                className="rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-2 shadow-sm px-4 h-11 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <Clock className="h-4 w-4" />
                تسجيل حضور وانصراف
              </Button>

              <Button
                onClick={() => onNavigate("workflow")}
                variant="outline"
                className="rounded-2xl font-bold text-xs gap-2 px-4 h-11 border-border/80 hover:bg-muted/70 cursor-pointer shadow-2xs relative"
              >
                <AlertCircle className="h-4 w-4 text-amber-500" />
                الطلبات المعلقة
                {pendingCount > 0 && (
                  <span className="rounded-full bg-amber-500 text-white font-mono text-[10px] font-black px-1.5 py-0.2">
                    {pendingCount}
                  </span>
                )}
              </Button>

              <Button
                onClick={() => onNavigate("payroll")}
                variant="outline"
                className="rounded-2xl font-bold text-xs gap-2 px-4 h-11 border-border/80 hover:bg-muted/70 cursor-pointer shadow-2xs text-purple-700 dark:text-purple-400 hover:text-purple-800"
              >
                <Wallet className="h-4 w-4" />
                مسير الرواتب
              </Button>

              <Button
                onClick={() => onNavigate("employees")}
                variant="ghost"
                className="rounded-2xl font-bold text-xs gap-2 px-3.5 h-11 hover:bg-muted/70 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Users className="h-4 w-4" />
                دليل الموظفين
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 6-Column High-Impact KPI Metric Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Metric 1: Total Employees */}
        <div
          onClick={() => onNavigate("employees")}
          className="classera-kpi-card group p-4 md:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:border-primary/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">
              {t.dashboard.totalEmployees}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            {analyticsLoading ? (
              <MetricSkeleton />
            ) : headcount?.available ? (
              <>
                <span className="text-2xl md:text-3xl font-black text-foreground">{headcount.activeCount ?? 0}</span>
                {headcount.newHires != null && headcount.newHires > 0 && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full">
                    <ArrowUpRight className="h-3 w-3" /> +{headcount.newHires}
                  </span>
                )}
              </>
            ) : (
              <Unavailable reason={headcount?.reasonUnavailable} />
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground font-medium truncate">
            {headcount?.available && headcount.newHires != null
              ? `${headcount.newHires} تعيين • ${headcount.departures ?? 0} مغادرة`
              : "إجمالي الكوادر النشطة"}
          </p>
        </div>

        {/* Metric 2: Live Attendance */}
        <div
          onClick={() => onNavigate("attendance")}
          className="classera-kpi-card group p-4 md:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:border-emerald-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">الانضباط والحضور اليوم</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
              <UserCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            {analyticsLoading ? (
              <MetricSkeleton />
            ) : attendance?.available ? (
              <>
                <span className="text-2xl md:text-3xl font-black text-foreground">
                  {attendance.present ?? 0} / {attendance.eligible ?? 0}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full">
                  {attendance.eligible && attendance.eligible > 0
                    ? Math.round(((attendance.present ?? 0) / attendance.eligible) * 100)
                    : 0}%
                </span>
              </>
            ) : (
              <Unavailable reason={attendance?.reasonUnavailable} />
            )}
          </div>
          <p className="mt-1 text-[10px] text-amber-600 font-bold truncate">
            {attendance?.available
              ? `${attendance.late ?? 0} متأخرين • ${attendance.absent ?? 0} غياب`
              : "—"}
          </p>
        </div>

        {/* Metric 3: Saudization Rate (no Nitaqat band) */}
        <div
          onClick={() => onNavigate("reports")}
          className="classera-kpi-card group p-4 md:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:border-emerald-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">نسبة التوطين</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            {analyticsLoading ? (
              <MetricSkeleton />
            ) : headcount?.available ? (
              <span className="text-2xl md:text-3xl font-black text-emerald-600">{saudizationRate}%</span>
            ) : (
              <Unavailable reason={headcount?.reasonUnavailable} />
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground font-medium truncate">
            {headcount?.available
              ? `${saudiCount} مواطن • ${expatCount} مقيم`
              : "نسبة السعوديين"}
          </p>
        </div>

        {/* Metric 4: Urgent Approvals */}
        <div
          onClick={() => onNavigate("workflow")}
          className="classera-kpi-card group p-4 md:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:border-amber-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">طلبات بانتظار القرار</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-110 transition-transform">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-amber-600">{pendingCount}</span>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-[9px] h-4.5 rounded-full px-1.5 font-black">
                عاجل
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground font-medium truncate">
            تتطلب تدخلك واتخاذ قرار
          </p>
        </div>

        {/* Metric 5: Payroll & WPS */}
        <div
          onClick={() => onNavigate("payroll")}
          className="classera-kpi-card group p-4 md:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:border-purple-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">مسير الرواتب (WPS)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 group-hover:scale-110 transition-transform">
              <Wallet className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            {analyticsLoading ? (
              <MetricSkeleton />
            ) : payroll?.available && payroll.netTotal != null ? (
              <span className="text-xl md:text-2xl font-black text-foreground">
                {(payroll.netTotal / 1000).toFixed(1)}K{" "}
                <span className="text-xs font-normal text-muted-foreground">{t.currency}</span>
              </span>
            ) : payroll?.available === false ? (
              <Unavailable reason={payroll?.reasonUnavailable} />
            ) : (
              <span className="text-lg font-black text-muted-foreground">—</span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-purple-600 font-bold truncate">
            {payroll?.available && payrollPeriodLabel
              ? `${payrollPeriodLabel} • ${payroll.status === "paid" ? "مدفوع" : payroll.status === "confirmed_locked" ? "معتمد ومقفل" : "قيد المراجعة"}`
              : "صافي مسير الرواتب"}
          </p>
        </div>

        {/* Metric 6: Compliance & Document Alerts */}
        <div
          onClick={() => onNavigate("documents")}
          className="classera-kpi-card group p-4 md:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:border-amber-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">رادار الامتثال والوثائق</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 group-hover:scale-110 transition-transform">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            {analyticsLoading ? (
              <MetricSkeleton />
            ) : (
              <>
                <span className={`text-2xl md:text-3xl font-black ${docAlertTotal > 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                  {docAlertTotal}
                </span>
                {docCriticalTotal > 0 && (
                  <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 rounded-full text-[9px] px-1.5 font-black">
                    {docCriticalTotal} حرجة
                  </Badge>
                )}
              </>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground font-medium truncate">
            {documents?.available
              ? `منتهية: ${documents.expired} • تنتهي قريباً: ${documents.within30d}`
              : "وثائق تستحق المتابعة"}
          </p>
        </div>
      </div>

      {/* 3. Master 12-Column Responsive Workspace Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left / Main Operational Stream (8 Columns) */}
        <div className="xl:col-span-8 space-y-6">
          {/* Card A: 7-Day Attendance Performance Trends */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-black text-foreground">
                    مؤشر الالتزام بالحضور والانصراف
                  </h2>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {trendData?.available
                      ? `آخر ${trendData.days ?? 7} أيام — بيانات فعلية مسجلة`
                      : "بيانات حضور يومية"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate("attendance")}
                  className="rounded-full text-xs font-bold h-8 px-3.5 border-border/80 cursor-pointer"
                >
                  السجل التفصيلي
                </Button>
              </div>
            </div>

            {analyticsLoading ? (
              <div className="h-64 w-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !trendData?.available ? (
              <div className="h-64 w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ShieldAlert className="h-8 w-8 opacity-30" />
                <p className="text-sm font-medium">
                  {trendData?.reasonUnavailable === "unauthorized"
                    ? "غير مخوّل لعرض بيانات الحضور التنظيمية"
                    : "بيانات الحضور غير متاحة"}
                </p>
              </div>
            ) : attendanceTrendData.length === 0 ? (
              <div className="h-64 w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Activity className="h-8 w-8 opacity-30" />
                <p className="text-sm font-medium">لا توجد سجلات حضور مسجلة في الفترة المحددة</p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={attendanceTrendData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#004BCE" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#004BCE" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Area
                      type="monotone"
                      dataKey="present"
                      name="حضور في الموعد"
                      stroke="#004BCE"
                      fillOpacity={1}
                      fill="url(#presentGrad)"
                      strokeWidth={2.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="late"
                      name="تأخير"
                      stroke="#f59e0b"
                      fillOpacity={1}
                      fill="url(#lateGrad)"
                      strokeWidth={2.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Card B: Department Headcount & Budget Distribution */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-black text-foreground">
                    توزيع الكوادر والميزانيات التقديرية عبر الإدارات
                  </h2>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    متابعة توزيع الملاكات الوظيفية والكتلة الشهرية لكل قطاع
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onNavigate("organization")}
                className="text-xs text-primary font-bold hover:bg-secondary h-8 rounded-full px-3.5 self-start sm:self-auto cursor-pointer"
              >
                الهيكل التنظيمي الكامل
              </Button>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentDistributionData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: unknown, name: string) => [
                      name === "count"
                        ? `${value} موظف`
                        : `${Number(value).toLocaleString()} ${t.currency} (تقديري)`,
                      name === "count" ? "عدد الكوادر" : "الميزانية الشهرية التقديرية",
                    ]}
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    }}
                  />
                  <Bar dataKey="count" name="عدد الكوادر" fill="#004BCE" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card C: Actionable Decision Center */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm md:text-base font-black text-foreground flex items-center gap-2">
                      صندوق المعاملات والقرارات الفورية
                      {pendingCount > 0 && (
                        <Badge className="bg-amber-500 text-white rounded-full text-[10px] h-5 px-2">
                          {pendingCount} بانتظار الاعتماد
                        </Badge>
                      )}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      اتخاذ قرار مباشر (اعتماد أو رفض فوري) وتحديث مسار الطلب لحظياً
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-44">
                  <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="بحث باسم أو رقم..."
                    className="w-full h-8 rounded-full border border-border/80 bg-muted/40 pr-8 pl-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <select
                  value={taskCategoryFilter}
                  onChange={(e) => setTaskCategoryFilter(e.target.value)}
                  className="h-8 rounded-full border border-border/80 bg-muted/40 px-3 text-xs font-medium focus:bg-card focus:outline-none"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="leave">إجازات</option>
                  <option value="attendance_correction">تصحيح بصمة</option>
                  <option value="expense_claim">مصروفات</option>
                  <option value="loan_advance">سلف رواتب</option>
                </select>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate("workflow")}
                  className="rounded-full text-xs font-bold h-8 px-3 border-border/80 cursor-pointer"
                >
                  كل الطلبات
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start">رقم الطلب والنوع</th>
                    <th className="py-3 px-4 text-start">مقدم الطلب</th>
                    <th className="py-3 px-4 text-start">التفاصيل والمبرر</th>
                    <th className="py-3 px-4 text-center">تاريخ التقديم</th>
                    <th className="py-3 px-4 text-center">الإجراء المباشر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredPendingTasks.slice(0, 5).map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {req.referenceNo}
                        <Badge variant="outline" className="text-[10px] rounded-full mr-2">
                          {req.type === "leave"
                            ? "طلب إجازة"
                            : req.type === "expense_claim"
                              ? "مطالبة مالية"
                              : req.type === "attendance_correction"
                                ? "تصحيح بصمة"
                                : req.type === "loan_advance"
                                  ? "سلفة راتب"
                                  : "طلب إداري"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => openEmployeeProfile(req.requesterId)}
                          className="font-bold text-foreground hover:text-primary hover:underline cursor-pointer"
                        >
                          {req.requesterName}
                        </button>
                        <span className="text-[10px] text-muted-foreground block">
                          {req.departmentName}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-muted-foreground font-medium">
                        {String(req.payload?.reason || req.payload?.notes || "طلب معتمد في مسار الخدمة")}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[10px] text-muted-foreground">
                        {new Date(req.submittedAt).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleDirectApprove(req.id, req.requesterName)}
                            className="rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-3.5 cursor-pointer shadow-2xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            اعتماد
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDirectReject(req.id, req.requesterName)}
                            className="rounded-full text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 h-7 px-3 cursor-pointer shadow-2xs"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            رفض
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPendingTasks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground font-medium">
                        🎉 لا توجد طلبات معلقة تطابق البحث حالياً - كافة المعاملات منجزة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card D: Who is on leave today */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-black text-foreground">
                    الموظفون في إجازة اليوم
                  </h2>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    متابعة الغياب المأذون وتغطية المهام وجاهزية الفرق الميدانية
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavigate("leaves")}
                className="rounded-full text-xs font-bold h-8 px-3.5 border-border/80 self-start sm:self-auto cursor-pointer"
              >
                جدول الإجازات الكامل
              </Button>
            </div>

            {analyticsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border border-border/70 bg-muted/30 h-24 animate-pulse" />
                ))}
              </div>
            ) : leaveRoster.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <CalendarDays className="h-8 w-8 opacity-30" />
                <p className="text-sm font-medium">لا يوجد موظفون في إجازة اليوم</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {leaveRoster.slice(0, 3).map((emp, idx) => (
                  <div
                    key={emp.id || idx}
                    className="rounded-2xl border border-border/70 bg-muted/30 p-3.5 flex flex-col justify-between space-y-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {emp.firstNameAr ? emp.firstNameAr.charAt(0) : "م"}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">
                            {emp.firstNameAr} {emp.lastNameAr}
                          </h4>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {emp.jobTitleAr || "أخصائي"}
                          </span>
                        </div>
                      </div>
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px] rounded-full">
                        {emp.leaveType}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>تاريخ العودة:</span>
                      <span className="font-mono font-bold text-foreground">
                        {emp.endDate
                          ? new Date(emp.endDate).toLocaleDateString("ar-SA")
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right / Side Command Tower (4 Columns) */}
        <div className="xl:col-span-4 space-y-6">
          {/* Card E: Saudization Radar Donut (no Nitaqat band label) */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">رادار التوطين والكوادر الوطنية</h2>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    نسبة السعوديين من إجمالي الموظفين
                  </span>
                </div>
              </div>
              {headcount?.available && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {saudizationRate}%
                </span>
              )}
            </div>

            {analyticsLoading ? (
              <div className="h-44 w-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !headcount?.available ? (
              <div className="h-44 w-full flex items-center justify-center text-muted-foreground">
                <Unavailable reason={headcount?.reasonUnavailable} />
              </div>
            ) : (
              <div className="h-44 w-full flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={saudizationPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {saudizationPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-foreground font-mono">{saudizationRate}%</span>
                  <span className="text-[10px] text-muted-foreground font-bold">سعوديون</span>
                </div>
              </div>
            )}

            {headcount?.available && (
              <div className="space-y-2 text-xs border-t border-border/60 pt-3">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    الموظفون السعوديون:
                  </span>
                  <span className="font-bold text-foreground font-mono">
                    {saudiCount} ({saudizationRate}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    الموظفون المقيمون:
                  </span>
                  <span className="font-bold text-foreground font-mono">
                    {expatCount} ({(100 - Number(saudizationRate)).toFixed(1)}%)
                  </span>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border/50 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between mt-2">
                  <span>تصنيف نطاقات:</span>
                  <span className="font-bold font-mono text-foreground">غير محدد (يتطلب ربط وزارة الموارد)</span>
                </div>
              </div>
            )}
          </div>

          {/* Card F: Critical Document Expiry Watch */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                  <ShieldAlert className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">منبه الوثائق والامتثال</h2>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    رصد الصلاحيات قبل الغرامات
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onNavigate("documents")}
                className="text-xs text-primary font-bold h-7 rounded-full px-2.5 cursor-pointer"
              >
                المستودع
              </Button>
            </div>

            {analyticsLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : !documents?.available ? (
              <div className="py-6 text-center text-muted-foreground">
                <Unavailable />
              </div>
            ) : docAlertTotal === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-60" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">جميع الوثائق سارية</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {documents.expired > 0 && (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-destructive">وثائق منتهية الصلاحية</span>
                      <Badge className="bg-destructive text-destructive-foreground text-[9px] rounded-full px-2">
                        {documents.expired}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onNavigate("documents")}
                      className="w-full text-xs h-7 rounded-xl font-bold mt-1 cursor-pointer"
                    >
                      مراجعة فورية
                    </Button>
                  </div>
                )}
                {documents.within7d > 0 && (
                  <div className="rounded-2xl border border-amber-400/40 bg-amber-500/5 p-3 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-800 dark:text-amber-300">تنتهي خلال 7 أيام</span>
                      <Badge className="bg-amber-600 text-white text-[9px] rounded-full px-2">
                        {documents.within7d}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigate("documents")}
                      className="w-full text-xs h-7 rounded-xl font-bold mt-1 cursor-pointer"
                    >
                      بدء التجديد
                    </Button>
                  </div>
                )}
                {documents.within30d > 0 && (
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-foreground">تنتهي خلال 30 يوم</span>
                      <Badge className="bg-muted text-muted-foreground text-[9px] rounded-full px-2 border">
                        {documents.within30d}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigate("documents")}
                      className="w-full text-xs h-7 rounded-xl font-bold mt-1 cursor-pointer"
                    >
                      عرض التفاصيل
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card G: Government Platforms Health Monitor */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-primary">
                  <Globe className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">حالة الربط والمنصات الحكومية</h2>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    حالة التكاملات مع المنصات الرسمية
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onNavigate("integrations")}
                className="text-xs text-primary font-bold h-7 rounded-full px-2.5 cursor-pointer"
              >
                الإعدادات
              </Button>
            </div>

            {analyticsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : integrationPlatforms.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-xs">
                لم يتم إعداد التكاملات بعد
              </div>
            ) : (
              <div className="space-y-2">
                {integrationPlatforms.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/30 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          item.status === "online"
                            ? "bg-emerald-500 animate-pulse"
                            : item.status === "offline"
                              ? "bg-red-500"
                              : "bg-muted-foreground/40"
                        }`}
                      />
                      <span className="font-bold text-foreground">{item.name}</span>
                    </div>
                    <div className="text-end">
                      <span
                        className={`font-bold block text-[11px] ${
                          item.status === "online"
                            ? "text-emerald-600"
                            : item.status === "offline"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {item.status === "online"
                          ? "متصل"
                          : item.status === "offline"
                            ? "غير متصل"
                            : "غير مهيأ"}
                      </span>
                      {item.lastSyncAt && (
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {new Date(item.lastSyncAt).toLocaleTimeString("ar-SA")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card H: Live Operational Audit Timeline */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">شريط الأحداث المباشرة</h2>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    سجل العمليات الإدارية الحية
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onNavigate("reports")}
                className="text-xs text-primary font-bold h-7 rounded-full px-2.5 cursor-pointer"
              >
                تقرير التدقيق
              </Button>
            </div>

            <div className="space-y-3">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex gap-2.5 text-xs items-start">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground truncate">{log.actorName}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {new Date(log.timestamp).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {log.action}: {log.details || log.changesSummary || "تعديل بيانات نظامية"}
                    </p>
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-4">
                  لا توجد عمليات جديدة مسجلة في شريط الأحداث
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Executive Quick Launchpad Dock */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm md:text-base font-black text-foreground">
                منصة الوصول السريع للأنظمة التشغيلية
              </h2>
              <p className="text-[11px] text-muted-foreground font-medium">
                اختصارات سريعة ومباشرة لأهم الوحدات التنفيذية بالنظام
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => onNavigate("employees")}
            className="group rounded-2xl border border-border/70 bg-muted/30 hover:bg-card hover:border-primary/50 p-4 transition-all duration-200 cursor-pointer text-center space-y-2 hover:shadow-xs"
          >
            <div className="mx-auto h-10 w-10 rounded-2xl bg-blue-500/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-foreground">شؤون الموظفين</h3>
            <p className="text-[10px] text-muted-foreground">الملفات والعقود</p>
          </div>

          <div
            onClick={() => onNavigate("attendance")}
            className="group rounded-2xl border border-border/70 bg-muted/30 hover:bg-card hover:border-emerald-500/50 p-4 transition-all duration-200 cursor-pointer text-center space-y-2 hover:shadow-xs"
          >
            <div className="mx-auto h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-foreground">الحضور والدوام</h3>
            <p className="text-[10px] text-muted-foreground">البصمة والمناوبات</p>
          </div>

          <div
            onClick={() => onNavigate("payroll")}
            className="group rounded-2xl border border-border/70 bg-muted/30 hover:bg-card hover:border-purple-500/50 p-4 transition-all duration-200 cursor-pointer text-center space-y-2 hover:shadow-xs"
          >
            <div className="mx-auto h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-foreground">مسيرات الرواتب</h3>
            <p className="text-[10px] text-muted-foreground">WPS وحماية الأجور</p>
          </div>

          <div
            onClick={() => onNavigate("workflow")}
            className="group rounded-2xl border border-border/70 bg-muted/30 hover:bg-card hover:border-amber-500/50 p-4 transition-all duration-200 cursor-pointer text-center space-y-2 hover:shadow-xs"
          >
            <div className="mx-auto h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-foreground">مسارات الاعتماد</h3>
            <p className="text-[10px] text-muted-foreground">التفويض والقرارات</p>
          </div>

          <div
            onClick={() => onNavigate("documents")}
            className="group rounded-2xl border border-border/70 bg-muted/30 hover:bg-card hover:border-blue-500/50 p-4 transition-all duration-200 cursor-pointer text-center space-y-2 hover:shadow-xs"
          >
            <div className="mx-auto h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FolderOpen className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-foreground">مستودع الوثائق</h3>
            <p className="text-[10px] text-muted-foreground">الأرشفة والشهادات</p>
          </div>

          <div
            onClick={() => onNavigate("reports")}
            className="group rounded-2xl border border-border/70 bg-muted/30 hover:bg-card hover:border-emerald-500/50 p-4 transition-all duration-200 cursor-pointer text-center space-y-2 hover:shadow-xs"
          >
            <div className="mx-auto h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-foreground">التقارير التنفيذية</h3>
            <p className="text-[10px] text-muted-foreground">تحليلات الأداء والـ KPI</p>
          </div>
        </div>
      </div>
    </div>
  );
};
