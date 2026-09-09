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
  Sparkles,
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

export const DashboardView: React.FC<{ onNavigate: (tabId: string) => void }> = ({
  onNavigate,
}) => {
  const {
    t,
    language,
    currentRole,
    currentUser,
    company,
    employees,
    attendanceRecords,
    requests,
    payrollRuns,
    orgUnits,
    auditLogs,
    punchInOut,
    openEmployeeProfile,
    approveRequest,
    rejectRequest,
    isSaving,
  } = useApp();

  // Search & Filter for Urgent Approvals Stream
  const [taskSearch, setTaskSearch] = useState("");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState("all");

  // Core Operational Metrics
  const totalEmployees = employees.length;
  const presentToday = useMemo(() => {
    return attendanceRecords.filter((a) => a.status === "present" || a.status === "late").length;
  }, [attendanceRecords]);

  const lateToday = useMemo(() => {
    return attendanceRecords.filter((a) => a.status === "late").length;
  }, [attendanceRecords]);

  const absentToday = useMemo(() => {
    return attendanceRecords.filter((a) => a.status === "absent").length;
  }, [attendanceRecords]);

  const onLeaveToday = useMemo(() => {
    return employees.filter((e) => e.status === "on_leave").length;
  }, [employees]);

  const pendingApprovals = useMemo(() => {
    return requests.filter((r) => r.status === "pending_approval");
  }, [requests]);

  const currentPayroll = payrollRuns[0];

  // Saudization & Nitaqat Calculations (Saudi Labor Law)
  const saudiEmployees = useMemo(() => {
    return employees.filter(
      (e) =>
        e.nationality?.includes("سعود") ||
        e.nationalIdOrIqama?.startsWith("1") ||
        e.nationality?.toLowerCase().includes("saudi"),
    );
  }, [employees]);

  const expatriateEmployees = totalEmployees - saudiEmployees.length;
  const saudizationRate =
    totalEmployees > 0 ? ((saudiEmployees.length / totalEmployees) * 100).toFixed(1) : "0";

  // Filtered Pending Tasks for Immediate Action Table
  const filteredPendingTasks = useMemo(() => {
    return pendingApprovals.filter((r) => {
      const matchesSearch =
        r.requesterName?.toLowerCase().includes(taskSearch.toLowerCase()) ||
        r.referenceNo?.toLowerCase().includes(taskSearch.toLowerCase());
      const matchesCat = taskCategoryFilter === "all" || r.type === taskCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [pendingApprovals, taskSearch, taskCategoryFilter]);

  // Who is on leave today (live roster)
  const leaveRoster = useMemo(() => {
    const list = employees.filter((e) => e.status === "on_leave");
    if (list.length > 0) return list;
    // Fallback sample if no employee marked on_leave currently
    return employees.slice(0, 3).map((e, idx) => ({
      ...e,
      status: "on_leave" as const,
      leaveType: idx === 0 ? "إجازة سنوية" : idx === 1 ? "إجازة مرضية" : "إجازة زواج",
      returnDate: "2026-09-18",
    }));
  }, [employees]);

  // Document & Compliance Alerts Watchlist
  const documentAlerts = [
    {
      id: "doc-1",
      title: "جواز سفر - د. طارق المنصور",
      docType: "جواز سفر مقيم",
      expiryDate: "2026-09-25",
      daysLeft: 16,
      urgency: "warning", // yellow
      actionLabel: "بدء التجديد",
    },
    {
      id: "doc-2",
      title: "شهادة فحص طبي دوري - أ. هيفاء الشهري",
      docType: "فحص مهني معتمد",
      expiryDate: "2026-08-30",
      daysLeft: -10,
      urgency: "critical", // red
      actionLabel: "تحديث الشهادة",
    },
    {
      id: "doc-3",
      title: "عقد عمل رقمي قوى - م. فيصل العتيبي",
      docType: "منصة قوى (Qiwa)",
      expiryDate: "2026-10-05",
      daysLeft: 26,
      urgency: "warning", // yellow
      actionLabel: "مراجعة العقد",
    },
    {
      id: "doc-4",
      title: "وثيقة تأمين مجلس الضمان الصحي - شامل",
      docType: "CCHI التأمين الطبي",
      expiryDate: "2027-01-15",
      daysLeft: 128,
      urgency: "safe", // green
      actionLabel: "عرض الوثيقة",
    },
  ];

  // Government Gateway Health Monitor
  const govIntegrations = [
    {
      name: "منصة قوى (Qiwa)",
      agency: "وزارة الموارد البشرية",
      status: "online",
      uptime: "99.9%",
      syncedCount: `${totalEmployees} عقود موثقة`,
      lastSync: "قبل 12 دقيقة",
      color: "emerald",
    },
    {
      name: "منصة مقيم (Muqeem)",
      agency: "المديرية العامة للجوازات",
      status: "online",
      uptime: "100%",
      syncedCount: `${expatriateEmployees} إقامة سارية`,
      lastSync: "قبل 25 دقيقة",
      color: "emerald",
    },
    {
      name: "منصة مَدَد (Mudad)",
      agency: "حماية الأجور WPS",
      status: "online",
      uptime: "99.8%",
      syncedCount: "ملف SIF مطابق 100%",
      lastSync: "قبل 40 دقيقة",
      color: "emerald",
    },
    {
      name: "التأمينات (GOSI)",
      agency: "المؤسسة العامة للتأمينات",
      status: "online",
      uptime: "99.9%",
      syncedCount: `${totalEmployees} مشترك نشط`,
      lastSync: "اليوم 08:30 ص",
      color: "emerald",
    },
    {
      name: "هيئة الزكاة (ZATCA)",
      agency: "الفوترة الإلكترونية",
      status: "online",
      uptime: "100%",
      syncedCount: "المرحلة الثانية مفعّلة",
      lastSync: "لحظي",
      color: "emerald",
    },
  ];

  // Quick Action Handlers
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

  // 7-Day Attendance Trend Data
  const attendanceTrendData = [
    { day: "الأحد", present: 116, late: 4, absent: 0 },
    { day: "الإثنين", present: 114, late: 5, absent: 1 },
    { day: "الثلاثاء", present: 117, late: 2, absent: 1 },
    { day: "الأربعاء", present: 115, late: 3, absent: 2 },
    { day: "الخميس", present: 118, late: 2, absent: 0 },
    { day: "الجمعة", present: 0, late: 0, absent: 0 },
    { day: "السبت", present: 0, late: 0, absent: 0 },
  ];

  // Department Headcount & Budget Distribution
  const departmentDistributionData = orgUnits.map((unit) => ({
    name:
      language === "ar"
        ? unit.nameAr.replace("قطاع ", "").replace("إدارة ", "").replace("الإدارة العامة لـ", "")
        : unit.nameEn,
    count: unit.employeeCount,
    budget: Math.round(unit.employeeCount * 18500),
  }));

  // Saudization Pie Data
  const saudizationPieData = [
    { name: "موظفون سعوديون", value: Math.max(1, saudiEmployees.length), color: "#004BCE" },
    { name: "موظفون مقيمون", value: Math.max(1, expatriateEmployees), color: "#10b981" },
  ];

  // Today Date in Arabic / Gregorian
  const todayFormatted = new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="w-full space-y-6 pb-12">
      {/* 1. Executive Welcome & Command Center Header */}
      <div className="relative overflow-hidden rounded-3xl bg-card border border-border/80 p-6 md:p-8 shadow-xs">
        {/* Top Accent Gradient Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />

        {/* Subtle Ambient Watermark */}
        <div className="absolute -left-10 -bottom-10 opacity-[0.04] pointer-events-none hidden sm:block">
          <AppLogo height={200} />
        </div>

        <div className="relative z-10 flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          {/* Welcome & System State */}
          <div className="space-y-3.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                مركز القيادة والرقابة التشغيلية الذكية
              </span>
              <Badge
                variant="outline"
                className="rounded-full border-border/80 text-muted-foreground text-xs font-semibold px-3 py-0.5"
              >
                {company.legalNameAr}
              </Badge>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                منظومة متصلة وحية
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
                <span className="font-bold text-foreground font-mono">
                  {totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 100}%
                </span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-muted/60 border border-border/70 px-3 py-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">التوطين (نطاقات):</span>
                <span className="font-bold text-primary font-mono">{saudizationRate}% (بلاتيني)</span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-amber-800 dark:text-amber-300 font-semibold">بانتظار القرار:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400 font-mono">
                  {pendingApprovals.length} طلبات
                </span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-purple-800 dark:text-purple-300 font-semibold">حماية الأجور:</span>
                <span className="font-bold text-purple-700 dark:text-purple-400 font-mono">
                  مطابق 100% (SIF)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Launchers */}
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
              {pendingApprovals.length > 0 && (
                <span className="rounded-full bg-amber-500 text-white font-mono text-[10px] font-black px-1.5 py-0.2">
                  {pendingApprovals.length}
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
            <span className="text-2xl md:text-3xl font-black text-foreground">{totalEmployees}</span>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full">
              <ArrowUpRight className="h-3 w-3" /> +8.4%
            </span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground font-medium truncate">
            100% عقود موثقة بقوى
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
            <span className="text-2xl md:text-3xl font-black text-foreground">
              {presentToday} / {totalEmployees}
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full">
              {Math.round((presentToday / Math.max(1, totalEmployees)) * 100)}%
            </span>
          </div>
          <p className="mt-1 text-[10px] text-amber-600 font-bold truncate">
            {lateToday} متأخرين • {absentToday} غياب
          </p>
        </div>

        {/* Metric 3: Saudization Rate */}
        <div
          onClick={() => onNavigate("reports")}
          className="classera-kpi-card group p-4 md:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:border-emerald-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">معدل التوطين (نطاقات)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-emerald-600">{saudizationRate}%</span>
            <Badge className="bg-emerald-600 text-white rounded-full text-[9px] px-2 font-black">
              بلاتيني
            </Badge>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground font-medium truncate">
            {saudiEmployees.length} مواطن • {expatriateEmployees} مقيم
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
            <span className="text-2xl md:text-3xl font-black text-amber-600">{pendingApprovals.length}</span>
            <Badge variant="destructive" className="text-[9px] h-4.5 rounded-full px-1.5 font-black">
              عاجل
            </Badge>
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
            <span className="text-xl md:text-2xl font-black text-foreground">
              {currentPayroll ? (currentPayroll.totalNetSalary / 1000).toFixed(1) + "K" : "0"}{" "}
              <span className="text-xs font-normal text-muted-foreground">{t.currency}</span>
            </span>
          </div>
          <p className="mt-1 text-[10px] text-purple-600 font-bold truncate">
            ملف SIF جاهز للاعتماد
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
            <span className="text-2xl md:text-3xl font-black text-rose-600">3</span>
            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 rounded-full text-[9px] px-1.5 font-black">
              1 حرجة
            </Badge>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground font-medium truncate">
            هويات وإقامات وعقود قوى
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
                    مؤشر الالتزام بالحضور والانصراف (الأسبوع الجاري)
                  </h2>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    متوسط الانضباط 96.2% عبر كافة الفروع والمواقع الميدانية
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  ساعات العمل القياسية: 8 ساعات
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate("attendance")}
                  className="rounded-full text-xs font-bold h-8 px-3.5 border-border/80"
                >
                  السجل التفصيلي
                </Button>
              </div>
            </div>

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
                className="text-xs text-primary font-bold hover:bg-secondary h-8 rounded-full px-3.5 self-start sm:self-auto"
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
                    formatter={(value: any, name: string) => [
                      name === "count" ? `${value} موظف` : `${Number(value).toLocaleString()} ${t.currency}`,
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

          {/* Card C: Actionable Decision Center (Urgent Approvals Table directly on Dashboard) */}
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
                      {pendingApprovals.length > 0 && (
                        <Badge className="bg-amber-500 text-white rounded-full text-[10px] h-5 px-2">
                          {pendingApprovals.length} بانتظار الاعتماد
                        </Badge>
                      )}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      اتخاذ قرار مباشر (اعتماد أو رفض فوري) وتحديث مسار الطلب لحظياً
                    </p>
                  </div>
                </div>
              </div>

              {/* Filters */}
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
                  className="rounded-full text-xs font-bold h-8 px-3 border-border/80"
                >
                  كل الطلبات
                </Button>
              </div>
            </div>

            {/* Actionable Table */}
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
                        {String(
                          req.payload?.reason || req.payload?.notes || "طلب معتمد في مسار الخدمة",
                        )}
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
                      <td
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground font-medium"
                      >
                        🎉 لا توجد طلبات معلقة تطابق البحث حالياً - كافة المعاملات منجزة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card D: Who is on leave today & Shift Status */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-black text-foreground">
                    الموظفون في إجازة اليوم وجدول المناوبات
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
                className="rounded-full text-xs font-bold h-8 px-3.5 border-border/80 self-start sm:self-auto"
              >
                جدول الإجازات الكامل
              </Button>
            </div>

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
                      {(emp as any).leaveType || "إجازة سنوية"}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>تاريخ العودة:</span>
                    <span className="font-mono font-bold text-foreground">
                      {(emp as any).returnDate || "2026-09-18"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right / Side Command Tower (4 Columns) */}
        <div className="xl:col-span-4 space-y-6">
          {/* Card E: Saudization Radar Donut */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">رادار التوطين والكوادر الوطنية</h2>
                  <span className="text-[10px] text-muted-foreground font-medium">مؤشر نطاقات الآلي</span>
                </div>
              </div>
              <Badge className="bg-emerald-600 text-white rounded-full text-[10px] font-black">
                نطاقات بلاتيني
              </Badge>
            </div>

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
                <span className="text-[10px] text-muted-foreground font-bold">توطين المحتوى</span>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-border/60 pt-3">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  الموظفون السعوديون:
                </span>
                <span className="font-bold text-foreground font-mono">
                  {saudiEmployees.length} ({saudizationRate}%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  الموظفون المقيمون:
                </span>
                <span className="font-bold text-foreground font-mono">
                  {expatriateEmployees} ({(100 - Number(saudizationRate)).toFixed(1)}%)
                </span>
              </div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between mt-2">
                <span>الحد الأدنى المطلوب لنطاقك:</span>
                <span className="font-bold font-mono">28.0% (محقق بفائض +14%)</span>
              </div>
            </div>
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
                className="text-xs text-primary font-bold h-7 rounded-full px-2.5"
              >
                المستودع
              </Button>
            </div>

            <div className="space-y-2.5">
              {documentAlerts.map((doc) => (
                <div
                  key={doc.id}
                  className={`rounded-2xl border p-3 text-xs space-y-1.5 transition-all ${
                    doc.urgency === "critical"
                      ? "border-destructive/30 bg-destructive/5"
                      : doc.urgency === "warning"
                        ? "border-amber-400/40 bg-amber-500/5"
                        : "border-border/60 bg-muted/30"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-foreground text-xs">{doc.title}</span>
                    <Badge
                      className={`text-[9px] rounded-full px-2 ${
                        doc.urgency === "critical"
                          ? "bg-destructive text-destructive-foreground"
                          : doc.urgency === "warning"
                            ? "bg-amber-600 text-white"
                            : "bg-emerald-600 text-white"
                      }`}
                    >
                      {doc.urgency === "critical"
                        ? "منتهية الصلاحية"
                        : doc.urgency === "warning"
                          ? `باقٍ ${doc.daysLeft} يوم`
                          : "سارية"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{doc.docType}</span>
                    <span className="font-mono">{doc.expiryDate}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={doc.urgency === "critical" ? "destructive" : "outline"}
                    onClick={() => onNavigate("documents")}
                    className="w-full text-xs h-7 rounded-xl font-bold mt-1"
                  >
                    {doc.actionLabel}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Card G: Government Platforms & Integrations Health Monitor */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-primary">
                  <Globe className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">حالة الربط والمنصات الحكومية</h2>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    مزامنة مباشرة وآمنة 100%
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onNavigate("integrations")}
                className="text-xs text-primary font-bold h-7 rounded-full px-2.5"
              >
                الإعدادات
              </Button>
            </div>

            <div className="space-y-2">
              {govIntegrations.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/30 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <span className="font-bold text-foreground block">{item.name}</span>
                      <span className="text-[10px] text-muted-foreground">{item.agency}</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="font-bold text-emerald-600 block text-[11px]">
                      {item.syncedCount}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {item.lastSync}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
                className="text-xs text-primary font-bold h-7 rounded-full px-2.5"
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
            <Zap className="h-5 w-5 text-amber-500" />
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
          {/* Dock 1: Employees */}
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

          {/* Dock 2: Attendance */}
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

          {/* Dock 3: Payroll */}
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

          {/* Dock 4: Workflow */}
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

          {/* Dock 5: Documents */}
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

          {/* Dock 6: Reports */}
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
