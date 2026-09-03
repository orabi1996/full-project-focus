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
  UserX,
  ExternalLink,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
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
    delegationRules,
    punchInOut,
    openEmployeeProfile,
    approveRequest,
    rejectRequest,
    isSaving,
  } = useApp();

  // Active Tab within Dashboard
  const [dashboardTab, setDashboardTab] = useState<
    "overview" | "tasks" | "compliance" | "activity"
  >("overview");

  // Search & Filter within Urgent Tasks tab
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
        e.nationality.includes("سعود") ||
        e.nationalIdOrIqama?.startsWith("1") ||
        e.nationality.toLowerCase().includes("saudi"),
    );
  }, [employees]);

  const expatriateEmployees = totalEmployees - saudiEmployees.length;
  const saudizationRate =
    totalEmployees > 0 ? ((saudiEmployees.length / totalEmployees) * 100).toFixed(1) : "0";

  // Expiring Document Simulation
  const expiringDocsCount = 3; // 2 passports/iqamas expiring within 30 days + 1 expired

  // Filtered Pending Tasks
  const filteredPendingTasks = useMemo(() => {
    return pendingApprovals.filter((r) => {
      const matchesSearch =
        r.requesterName.toLowerCase().includes(taskSearch.toLowerCase()) ||
        r.referenceNo.toLowerCase().includes(taskSearch.toLowerCase());
      const matchesCat = taskCategoryFilter === "all" || r.type === taskCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [pendingApprovals, taskSearch, taskCategoryFilter]);

  const handleQuickPunch = async (type: "in" | "out") => {
    if (isSaving) return;
    const res = await punchInOut(type);
    if (res.success) toast.success(res.message);
  };

  const handleDirectApprove = async (id: string, requesterName: string) => {
    if (isSaving) return;
    const saved = await approveRequest(id, "تم الاعتماد السريع عبر لوحة المتابعة التشغيلية");
    if (!saved) return;
    toast.success(`تم اعتماد طلب (${requesterName}) بنجاح`);
  };

  const handleDirectReject = async (id: string, requesterName: string) => {
    if (isSaving) return;
    const saved = await rejectRequest(id, "تم الرفض عبر لوحة المتابعة لعدم استيفاء الشروط");
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
    { name: "موظفون سعوديون", value: saudiEmployees.length, color: "#0B57D0" },
    { name: "موظفون مقيمون", value: expatriateEmployees, color: "#10b981" },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-primary/95 to-primary/85 p-6 md:p-7 text-primary-foreground shadow-lg shadow-primary/15 border border-primary/20">
        <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-foreground/15 px-3 py-0.5 text-xs font-bold backdrop-blur-md border border-primary-foreground/20">
                لوحة المتابعة والرقابة التشغيلية الذكية
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 rounded-full text-[10px] font-bold">
                {company.legalNameAr}
              </Badge>
              <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              {t.dashboard.welcome}،{" "}
              {language === "ar"
                ? `${currentUser.firstNameAr} ${currentUser.lastNameAr}`
                : `${currentUser.firstNameEn} ${currentUser.lastNameEn}`}
            </h1>
            <p className="text-xs text-primary-foreground/80 font-medium max-w-xl">
              ملخص الأداء والمؤشرات الحية لليوم •{" "}
              {new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => handleQuickPunch("in")}
              className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs gap-1.5 shadow-sm px-4 h-10"
            >
              <Clock className="h-4 w-4" />
              تسجيل حضور
            </Button>
            <Button
              onClick={() => onNavigate("workflow")}
              variant="secondary"
              className="rounded-full font-bold text-xs gap-1.5 px-4 h-10 bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              <AlertCircle className="h-4 w-4 text-amber-600" />
              الطلبات المعلقة ({pendingApprovals.length})
            </Button>
            <Button
              onClick={() => onNavigate("employees")}
              variant="outline"
              className="rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 font-bold text-xs gap-1.5 px-4 h-10 backdrop-blur-sm"
            >
              <Users className="h-4 w-4" />
              ملفات الموظفين
            </Button>
          </div>
        </div>
      </div>

      {/* Primary KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Employees */}
        <div
          onClick={() => onNavigate("employees")}
          className="group rounded-3xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">
              {t.dashboard.totalEmployees}
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">{totalEmployees}</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="h-3.5 w-3.5" /> +8.4%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">100% عقود موثقة بقوى</p>
        </div>

        {/* Live Attendance */}
        <div
          onClick={() => onNavigate("attendance")}
          className="group rounded-3xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">
              الانضباط والحضور اليوم
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {presentToday} / {totalEmployees}
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              {Math.round((presentToday / Math.max(1, totalEmployees)) * 100)}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-amber-600 font-bold">
            {lateToday} متأخرين • {absentToday} غياب
          </p>
        </div>

        {/* Saudization / Nitaqat */}
        <div
          onClick={() => onNavigate("reports")}
          className="group rounded-3xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">
              معدل التوطين (نطاقات)
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{saudizationRate}%</span>
            <Badge className="bg-emerald-600 text-white rounded-full text-[10px] px-2 font-bold">
              بلاتيني
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            {saudiEmployees.length} سعودي • {expatriateEmployees} مقيم
          </p>
        </div>

        {/* Pending Approvals */}
        <div
          onClick={() => onNavigate("workflow")}
          className="group rounded-3xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">
              الطلبات بانتظار القرار
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 group-hover:scale-110 transition-transform">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{pendingApprovals.length}</span>
            <Badge variant="destructive" className="text-[10px] h-5 rounded-full px-2 font-black">
              عاجل
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">تتطلب تدخلك للاعتماد</p>
        </div>

        {/* Monthly Payroll */}
        <div
          onClick={() => onNavigate("payroll")}
          className="group rounded-3xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground">مسير الرواتب (WPS)</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 group-hover:scale-110 transition-transform">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {currentPayroll ? (currentPayroll.totalNetSalary / 1000).toFixed(1) + "K" : "0"}{" "}
              {t.currency}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] bg-purple-500/10 text-purple-700 border-purple-200 rounded-full px-2 font-bold"
            >
              جاهز للمراجعة
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            مسير شهر 8 متوافق مع SIF
          </p>
        </div>
      </div>

      {/* Dashboard Multi-Tab Operations Navigation */}
      <Tabs
        value={dashboardTab}
        onValueChange={(v) => setDashboardTab(v as any)}
        className="space-y-4"
      >
        <TabsList className="bg-muted/40 p-1 rounded-2xl border border-border/60">
          <TabsTrigger value="overview" className="rounded-xl text-xs font-bold gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            نظرة عامة والتحليلات البيانية
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-xl text-xs font-bold gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            المهام والطلبات العاجلة
            {pendingApprovals.length > 0 && (
              <Badge className="mr-1 bg-amber-500 text-white rounded-full text-[10px] h-4 px-1.5">
                {pendingApprovals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compliance" className="rounded-xl text-xs font-bold gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            منبه الامتثال والوثائق ({expiringDocsCount})
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl text-xs font-bold gap-1.5">
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
            سجل العمليات والأحداث الحية ({auditLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Overview & Analytics */}
        <TabsContent value="overview" className="space-y-6">
          {/* Visual Charts: Attendance Trends & Department Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Attendance Area Chart */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-foreground">
                      مؤشر الالتزام بالحضور والانصراف (خلال الأسبوع)
                    </h2>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      متوسط الانضباط 96.2% وفق لوائح الدوام
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate("attendance")}
                  className="rounded-full text-xs font-bold h-7 px-3 border-border/80"
                >
                  سجل الحضور الكامل
                </Button>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={attendanceTrendData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0B57D0" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0B57D0" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                    <Area
                      type="monotone"
                      dataKey="present"
                      name="حضور في الموعد"
                      stroke="#0B57D0"
                      fillOpacity={1}
                      fill="url(#presentGrad)"
                      strokeWidth={2.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="late"
                      name="متأخرين"
                      stroke="#f59e0b"
                      fillOpacity={1}
                      fill="url(#lateGrad)"
                      strokeWidth={2.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Saudization Radar Pie Chart */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-sm font-black text-foreground">التوطين والكوادر الوطنية</h2>
                </div>
                <Badge className="bg-emerald-600 text-white rounded-full text-[10px]">
                  نطاقات بلاتيني
                </Badge>
              </div>

              <div className="h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={saudizationPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {saudizationPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 text-xs border-t border-border/60 pt-3">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    الموظفون السعوديون:
                  </span>
                  <span className="font-bold text-foreground font-mono">
                    {saudiEmployees.length} ({saudizationRate}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    الموظفون المقيمون:
                  </span>
                  <span className="font-bold text-foreground font-mono">
                    {expatriateEmployees} ({(100 - Number(saudizationRate)).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Department Headcount Bar Chart */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-black text-foreground">
                  توزيع الكوادر البشرية والكتلة المالية عبر الإدارات
                </h2>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onNavigate("organization")}
                className="text-xs text-primary font-bold hover:bg-secondary h-8 rounded-full px-3"
              >
                الهيكل التنظيمي
              </Button>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentDistributionData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="عدد الموظفين" fill="#0B57D0" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Actionable Pending Tasks */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  صندوق متابعة المعاملات والقرارات الفورية
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  اتخاذ قرار مباشر (اعتماد أو رفض) دون مغادرة لوحة المتابعة
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="بحث برقم الطلب أو الاسم..."
                    className="w-full h-8 rounded-full border border-border/80 bg-muted/40 pr-8 pl-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <select
                  value={taskCategoryFilter}
                  onChange={(e) => setTaskCategoryFilter(e.target.value)}
                  className="h-8 rounded-full border border-border/80 bg-muted/40 px-2.5 text-xs font-medium focus:bg-card focus:outline-none"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="leave">إجازات</option>
                  <option value="attendance_correction">تصحيح بصمة</option>
                  <option value="expense_claim">مصروفات</option>
                  <option value="loan_advance">سلف مالية</option>
                </select>
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
                  {filteredPendingTasks.map((req) => (
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
                          req.payload.reason || req.payload.notes || "طلب معتمد في مسار الخدمة",
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
                            className="rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-3.5"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            اعتماد
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDirectReject(req.id, req.requesterName)}
                            className="rounded-full text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 h-7 px-3"
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
                        🎉 لا توجد طلبات معلقة تطابق البحث حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: Compliance & Expiry Radar */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  رادار الامتثال وتنبيهات انتهاء الوثائق والعقود
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  رصد الإقامات، الهويات، عقود منصة قوى، وشهادات التأمين الطبي قبل موعد انتهائها
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavigate("documents")}
                className="rounded-full text-xs font-bold gap-1.5 h-8 border-border/80"
              >
                <FolderOpen className="h-3.5 w-3.5 text-primary" />
                مستودع الوثائق
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-amber-300 bg-amber-500/10 p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-amber-800 text-xs">
                    جواز سفر - د. طارق المنصور
                  </span>
                  <Badge className="bg-amber-600 text-white text-[9px] rounded-full">
                    ينتهي قريباً
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  تاريخ الانتهاء: <strong className="font-mono text-foreground">2026-09-25</strong>{" "}
                  (متبقي 22 يوماً)
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate("documents")}
                  className="w-full text-xs h-7 rounded-full font-bold text-amber-800 border-amber-400 bg-card"
                >
                  بدء إجراءات التجديد
                </Button>
              </div>

              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-destructive text-xs">
                    شهادة فحص طبي - أ. هيفاء الشهري
                  </span>
                  <Badge variant="destructive" className="text-[9px] rounded-full">
                    منتهية الصلاحية
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  تاريخ الانتهاء: <strong className="font-mono text-destructive">2026-08-01</strong>{" "}
                  (منتهية)
                </p>
                <Button
                  size="sm"
                  onClick={() => onNavigate("documents")}
                  className="w-full text-xs h-7 rounded-full font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  تحديث الشهادة الطبية
                </Button>
              </div>

              <div className="rounded-2xl border border-emerald-300 bg-emerald-500/10 p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-emerald-800 text-xs">
                    عقد قوى - أ. نورة التميمي
                  </span>
                  <Badge className="bg-emerald-600 text-white text-[9px] rounded-full">
                    موثق وسارٍ
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  تاريخ الانتهاء: <strong className="font-mono text-foreground">2027-02-01</strong>{" "}
                  (ساري المفعول)
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate("documents")}
                  className="w-full text-xs h-7 rounded-full font-bold text-emerald-800 border-emerald-400 bg-card"
                >
                  معاينة العقد
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: Live Audit & Activity Feed */}
        <TabsContent value="activity" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-500" />
                  سجل العمليات والأحداث المباشرة (Live Audit Log)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تتبع لحظي لكافة الإجراءات والقرارات المنفذة في النظام من كافة المستخدمين
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavigate("reports")}
                className="rounded-full text-xs font-bold gap-1.5 h-8 border-border/80"
              >
                تقرير التدقيق الكامل
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start">الإجراء المنفذ</th>
                    <th className="py-3 px-4 text-start">القائم بالإجراء (المستخدم)</th>
                    <th className="py-3 px-4 text-start">العنصر / السجل المعني</th>
                    <th className="py-3 px-4 text-start">التفاصيل والملاحظات</th>
                    <th className="py-3 px-4 text-center">التوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {auditLogs.slice(0, 8).map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] rounded-full font-bold">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {log.actorName}
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          {log.actorRole}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {log.entityName || log.entityId}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-medium max-w-xs truncate">
                        {log.details || log.changesSummary || "إجراء نظامي موثق"}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[10px] text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        لا توجد سجلات عمليات مسجلة حتى الآن
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
