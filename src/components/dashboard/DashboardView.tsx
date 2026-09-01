import React from "react";
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
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
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
    employees,
    attendanceRecords,
    requests,
    payrollRuns,
    orgUnits,
    punchInOut,
  } = useApp();

  const totalEmployees = employees.length;
  const presentToday = attendanceRecords.filter(
    (a) => a.status === "present" || a.status === "late",
  ).length;
  const lateToday = attendanceRecords.filter((a) => a.status === "late").length;
  const onLeaveToday = employees.filter((e) => e.status === "on_leave").length;
  const pendingApprovals = requests.filter((r) => r.status === "pending_approval");
  const currentPayroll = payrollRuns[0];

  const handleQuickPunch = (type: "in" | "out") => {
    const res = punchInOut(type);
    alert(res.message);
  };

  // Realistic 7-Day Attendance Trend Data (M3 Tonal Colors)
  const attendanceTrendData = [
    { day: "الأحد", present: 116, late: 4, absent: 0 },
    { day: "الإثنين", present: 114, late: 5, absent: 1 },
    { day: "الثلاثاء", present: 117, late: 2, absent: 1 },
    { day: "الأربعاء", present: 115, late: 3, absent: 2 },
    { day: "الخميس", present: 118, late: 2, absent: 0 },
    { day: "الجمعة", present: 0, late: 0, absent: 0 },
    { day: "السبت", present: 0, late: 0, absent: 0 },
  ];

  // Department Headcount & Cost Distribution
  const departmentDistributionData = orgUnits.map((unit) => ({
    name:
      language === "ar"
        ? unit.nameAr.replace("قطاع ", "").replace("إدارة ", "").replace("الإدارة العامة لـ", "")
        : unit.nameEn,
    count: unit.employeeCount,
    budget: Math.round(unit.employeeCount * 18500),
  }));

  return (
    <div className="space-y-6">
      {/* Welcome Banner (Google M3 Expressive Gradient) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-primary/95 to-primary/85 p-6 md:p-8 text-primary-foreground shadow-lg shadow-primary/15 border border-primary/20">
        <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold backdrop-blur-md border border-primary-foreground/20">
                {language === "ar" ? "منظومة الموارد البشرية المتكاملة M3" : "Material 3 Cloud HRMS"}
              </span>
              <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              {t.dashboard.welcome}،{" "}
              {language === "ar"
                ? `${currentUser.firstNameAr} ${currentUser.lastNameAr}`
                : `${currentUser.firstNameEn} ${currentUser.lastNameEn}`}
            </h1>
            <p className="text-xs text-primary-foreground/80 font-medium max-w-xl">
              {t.dashboard.todayOverview} •{" "}
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
              {t.dashboard.punchInNow}
            </Button>
            <Button
              onClick={() => onNavigate("leaves")}
              variant="secondary"
              className="rounded-full font-bold text-xs gap-1.5 px-4 h-10 bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              <CalendarDays className="h-4 w-4 text-primary" />
              {t.dashboard.requestLeave}
            </Button>
            <Button
              onClick={() => onNavigate("employees")}
              variant="outline"
              className="rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 font-bold text-xs gap-1.5 px-4 h-10 backdrop-blur-sm"
            >
              <Users className="h-4 w-4" />
              {t.dashboard.newEmployee}
            </Button>
          </div>
        </div>
      </div>

      {/* Primary KPI Stats Cards (M3 Elevated Cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <div
          onClick={() => onNavigate("employees")}
          className="group rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">{t.dashboard.totalEmployees}</span>
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
          <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">100% عقود سارية وموثقة (قوى)</p>
        </div>

        {/* Attendance Today */}
        <div
          onClick={() => onNavigate("attendance")}
          className="group rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">{t.dashboard.presentToday}</span>
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
          <p className="mt-1.5 text-[11px] text-amber-600 font-semibold">
            {lateToday} موظفين متأخرين اليوم
          </p>
        </div>

        {/* Pending Approvals */}
        <div
          onClick={() => onNavigate("workflow")}
          className="group rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">{t.dashboard.pendingApprovalsCount}</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 group-hover:scale-110 transition-transform">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">{pendingApprovals.length}</span>
            <Badge variant="destructive" className="text-[10px] h-5 rounded-full px-2 font-black">
              عاجل
            </Badge>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">تتطلب تدخلك لاتخاذ القرار</p>
        </div>

        {/* Monthly Payroll */}
        <div
          onClick={() => onNavigate("payroll")}
          className="group rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">{t.dashboard.payrollStatus}</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 group-hover:scale-110 transition-transform">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {currentPayroll ? (currentPayroll.totalNetSalary / 1000).toFixed(1) + "K" : "0"} {t.currency}
            </span>
            <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 border-purple-200 rounded-full px-2 font-bold">
              جاهز للمراجعة
            </Badge>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">مسير شهر أغسطس 2026</p>
        </div>
      </div>

      {/* Visual Charts: Attendance Trends & Department Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Area Chart */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Activity className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-black text-foreground">
                مؤشر الالتزام بالحضور والانصراف (خلال الأسبوع)
              </h2>
            </div>
            <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
              96.2% متوسط الالتزام
            </span>
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

        {/* Headcount Distribution Bar Chart */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-black text-foreground">توزيع الموظفين بالأقسام</h2>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departmentDistributionData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                <Tooltip />
                <Bar dataKey="count" name="عدد الموظفين" fill="#0B57D0" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid: Pending Approvals & Announcements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Pending Approvals List */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-black text-foreground">{t.dashboard.urgentTasks}</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("workflow")}
              className="text-xs text-primary font-bold hover:bg-secondary h-8 rounded-full px-3"
            >
              {t.dashboard.viewAllTasks}
            </Button>
          </div>

          <div className="space-y-3">
            {pendingApprovals.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                رائع! لا توجد طلبات معلقة بانتظار موافقتك حالياً
              </div>
            ) : (
              pendingApprovals.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs transition-all hover:bg-muted/40 shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <img
                      src={
                        req.requesterAvatar ||
                        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                      }
                      alt={req.requesterName}
                      className="h-10 w-10 rounded-full border-2 border-primary/20 object-cover shadow-xs"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{req.requesterName}</span>
                        <Badge variant="secondary" className="text-[10px] rounded-full px-2 font-bold">
                          {req.type === "leave"
                            ? "إجازة"
                            : req.type === "expense_claim"
                              ? "نفقات"
                              : "سلفة مالية"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {req.payload.leaveTypeNameAr ||
                          req.payload.categoryNameAr ||
                          req.payload.reason}
                        {req.payload.totalDays ? ` • ${req.payload.totalDays} أيام` : ""}
                        {req.payload.amount ? ` • ${req.payload.amount} ${t.currency}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      size="sm"
                      onClick={() => onNavigate("workflow")}
                      className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 rounded-full px-4"
                    >
                      {t.approve}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate("workflow")}
                      className="h-8 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-full px-3"
                    >
                      {t.reject}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Company Announcements & Quick Shortcuts */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 className="text-sm font-black text-foreground">{t.dashboard.companyAnnouncements}</h2>
            <Badge variant="outline" className="text-[10px] rounded-full px-2">
              جديد
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-primary/20 bg-secondary/40 p-4 text-xs space-y-1">
              <span className="font-bold text-secondary-foreground">إطلاق لائحة العمل المرن الجديدة 2026</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                تم اعتماد سياسة الدوام المرن والعمل عن بعد بنسبة 40% لجميع فرق هندسة البرمجيات والتطوير.
              </p>
              <div className="pt-1 text-[10px] text-primary font-semibold">قبل يومين • إدارة الموارد البشرية</div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs space-y-1">
              <span className="font-bold text-foreground">موعد إغلاق مسير رواتب شهر أغسطس</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                يرجى من جميع الموظفين رفع مطالبات المصروفات وتصحيح البصمات قبل تاريخ 24 أغسطس.
              </p>
              <div className="pt-1 text-[10px] text-muted-foreground">قبل 4 أيام • قسم الرواتب</div>
            </div>
          </div>

          {/* Module Direct Shortcuts */}
          <div className="border-t border-border/60 pt-3 space-y-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">{t.dashboard.quickActions}</span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("ats")}
                className="justify-start text-xs h-9 gap-2 font-bold rounded-full border-border/80 hover:bg-secondary"
              >
                <Briefcase className="h-4 w-4 text-blue-500" />
                {t.nav.ats}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("shifts")}
                className="justify-start text-xs h-9 gap-2 font-bold rounded-full border-border/80 hover:bg-secondary"
              >
                <Clock className="h-4 w-4 text-emerald-500" />
                {t.nav.shifts}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("expenses")}
                className="justify-start text-xs h-9 gap-2 font-bold rounded-full border-border/80 hover:bg-secondary"
              >
                <DollarSign className="h-4 w-4 text-amber-500" />
                {t.nav.expenses}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("reports")}
                className="justify-start text-xs h-9 gap-2 font-bold rounded-full border-border/80 hover:bg-secondary"
              >
                <FileText className="h-4 w-4 text-purple-500" />
                {t.nav.reports}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
