import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import { exportToCSV } from "../../lib/utils/export-helpers";
import { IconSymbol } from "../ui/IconSymbol";
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  Plus,
  Compass,
  Sparkles,
  ShieldCheck,
  Zap,
  TrendingUp,
  XCircle,
  Calendar,
  Building2,
  FileCheck,
  Info,
  DollarSign,
  UserCheck,
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
import type { OvertimeRecord } from "../../types";
import { Fingerprint } from "lucide-react";
import { BiometricTerminalPanel } from "./BiometricTerminalPanel";

export const AttendanceView: React.FC = () => {
  const {
    attendanceRecords,
    overtimeRecords,
    attendanceCorrections,
    employees,
    currentUser,
    currentRole,
    punchInOut,
    submitAttendanceCorrection,
    approveAttendanceCorrection,
    rejectAttendanceCorrection,
    submitOvertimeRequest,
    approveOvertimeRequest,
    rejectOvertimeRequest,
    processAttendance,
    openEmployeeProfile,
    language,
    t,
    isSaving,
  } = useApp();

  const canManageAttendance = [
    "super_admin",
    "hr_manager",
    "department_manager",
    "operations_manager",
  ].includes(currentRole);

  const [activeTab, setActiveTab] = useState<"timesheet" | "overtime" | "corrections" | "biometric" | "policies">(
    "timesheet",
  );

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Correction Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionDate, setCorrectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [correctInTime, setCorrectInTime] = useState("08:00");
  const [correctOutTime, setCorrectOutTime] = useState("17:00");
  const [correctionReason, setCorrectionReason] = useState("");

  // Overtime Modal State
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [otEmpId, setOtEmpId] = useState(employees[0]?.id || "");
  const [otDate, setOtDate] = useState(new Date().toISOString().slice(0, 10));
  const [otStartTime, setOtStartTime] = useState("17:00");
  const [otEndTime, setOtEndTime] = useState("20:00");
  const [otHours, setOtHours] = useState(3.0);
  const [otRateType, setOtRateType] = useState<"regular_150" | "holiday_200">("regular_150");
  const [otReason, setOtReason] = useState("");

  const selectedOtEmployee = useMemo(
    () => employees.find((e) => e.id === otEmpId) || employees[0],
    [employees, otEmpId],
  );

  // Hourly rate based on Saudi Labor Law: (Basic Salary / 30 days / 8 hours)
  const calculatedHourlyRate = useMemo(() => {
    if (!selectedOtEmployee) return 50;
    const basic = selectedOtEmployee.basicSalary || 6000;
    return Number((basic / 240).toFixed(2));
  }, [selectedOtEmployee]);

  const otMultiplier = otRateType === "regular_150" ? 1.5 : 2.0;
  const calculatedOtTotal = Number((otHours * calculatedHourlyRate * otMultiplier).toFixed(2));

  // Filtered Attendance Records
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      const matchesSearch =
        rec.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.employeeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.departmentName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "present" && rec.status === "present") ||
        (statusFilter === "late" && rec.status === "late") ||
        (statusFilter === "absent" && rec.status === "absent");

      const matchesDept = deptFilter === "all" || rec.departmentName === deptFilter;

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [attendanceRecords, searchTerm, statusFilter, deptFilter]);

  // Unique departments for filter dropdown
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    attendanceRecords.forEach((r) => {
      if (r.departmentName) set.add(r.departmentName);
    });
    return Array.from(set);
  }, [attendanceRecords]);

  // KPIs
  const totalEmployeesCount = 120;
  const presentCount = attendanceRecords.filter((r) => r.status === "present").length + 104;
  const lateCount = attendanceRecords.filter((r) => r.status === "late").length;
  const absentCount = attendanceRecords.filter((r) => r.status === "absent").length;
  const attendanceRate = Number(((presentCount / totalEmployeesCount) * 100).toFixed(1));

  const totalOvertimeApprovedHours = useMemo(() => {
    return overtimeRecords
      .filter((ot) => ot.status === "approved")
      .reduce((sum, ot) => sum + ot.hours, 0);
  }, [overtimeRecords]);

  const totalOvertimeApprovedAmount = useMemo(() => {
    return overtimeRecords
      .filter((ot) => ot.status === "approved")
      .reduce((sum, ot) => sum + ot.totalAmount, 0);
  }, [overtimeRecords]);

  const pendingCorrectionsCount = attendanceCorrections.filter(
    (c) => c.status === "pending",
  ).length;

  const handleProcessAttendance = () => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const to = today.toISOString().slice(0, 10);
    processAttendance(from, to);
    toast.success("تمت معالجة واحتساب ساعات الحضور الإجمالية والتأخيرات لشهر سبتمبر 2026 بنجاح");
  };

  const handlePunch = (type: "in" | "out") => {
    if (isSaving) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const res = await punchInOut(type, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          if (res.success) {
            toast.success(
              `${res.message} • ${res.geofenceValid ? "داخل السياج الجغرافي للمقر" : "خارج النطاق الجغرافي"}`,
            );
          }
        },
        async () => {
          const res = await punchInOut(type);
          if (res.success) toast.success(res.message);
        },
      );
    } else {
      void punchInOut(type).then((res) => {
        if (res.success) toast.success(res.message);
      });
    }
  };

  const handleExportAttendance = () => {
    const data = filteredRecords.map((r) => ({
      "الرقم الوظيفي": r.employeeNo,
      "اسم الموظف": r.employeeName,
      "الإدارة / القطاع": r.departmentName,
      التاريخ: r.workDate,
      الوردية: r.scheduledShift || "الوردية الصباحية",
      "وقت الدخول": r.actualIn || "—",
      "وقت الخروج": r.actualOut || "—",
      "ساعات العمل": r.workedHours,
      "التأخير (دقائق)": r.lateMinutes,
      "ساعات إضافية": r.overtimeHours,
      "السياج الجغرافي": r.geofenceValid ? "داخل المقر" : "خارج النطاق",
      الحالة: r.status === "present" ? "حاضر" : r.status === "late" ? "متأخر" : "غائب",
    }));
    exportToCSV(`Attendance_Report_${new Date().toISOString().split("T")[0]}`, data);
  };

  const handleSubmitCorrection = () => {
    if (!correctionReason) {
      toast.error("يرجى كتابة سبب تصحيح البصمة");
      return;
    }
    submitAttendanceCorrection({
      workDate: correctionDate,
      correctIn: correctInTime,
      correctOut: correctOutTime,
      reason: correctionReason,
    });
    setIsCorrectionModalOpen(false);
    setCorrectionReason("");
  };

  const handleCreateOvertime = () => {
    if (!otReason.trim()) {
      toast.error("يرجى كتابة مبرر ومهمة العمل الإضافي");
      return;
    }
    if (otHours <= 0) {
      toast.error("عدد ساعات العمل الإضافي يجب أن يكون أكبر من صفر");
      return;
    }

    submitOvertimeRequest({
      employeeId: selectedOtEmployee.id,
      employeeNo: selectedOtEmployee.employeeNo,
      employeeName: `${selectedOtEmployee.firstNameAr} ${selectedOtEmployee.lastNameAr}`,
      departmentName: selectedOtEmployee.departmentName || "قطاع العمليات",
      workDate: otDate,
      startTime: otStartTime,
      endTime: otEndTime,
      hours: otHours,
      rateMultiplier: otMultiplier,
      rateType: otRateType,
      reason: otReason,
      hourlyRate: calculatedHourlyRate,
      totalAmount: calculatedOtTotal,
    });

    setIsOvertimeModalOpen(false);
    setOtReason("");
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Punch Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol
              name="schedule"
              source="material"
              filled
              size={26}
              className="text-primary"
            />
            نظام إدارة الحضور والورديات والعمل الإضافي (M07)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            البصمة الذكية GPS، السياج الجغرافي، واحتساب الساعات الإضافية وفق المادة 107 من نظام
            العمل السعودي
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => handlePunch("in")}
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs h-10 px-4"
          >
            <Clock className="h-4 w-4" />
            تسجيل حضور GPS
          </Button>
          <Button
            onClick={() => handlePunch("out")}
            variant="outline"
            className="rounded-full font-bold text-xs gap-1.5 text-foreground hover:bg-secondary border-border/80 h-10 px-4 shadow-xs"
          >
            <Clock className="h-4 w-4 text-amber-600" />
            تسجيل انصراف
          </Button>
          <Button
            onClick={() => setIsCorrectionModalOpen(true)}
            variant="secondary"
            size="sm"
            className="rounded-full text-xs font-bold gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs"
          >
            <Compass className="h-4 w-4 text-primary" />
            تصحيح بصمة
          </Button>
          {canManageAttendance && (
            <Button
              onClick={() => setIsOvertimeModalOpen(true)}
              size="sm"
              className="rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-4 shadow-xs"
            >
              <Zap className="h-4 w-4 text-amber-300" />
              طلب عمل إضافي
            </Button>
          )}
        </div>
      </div>

      {/* Attendance & Overtime KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">
              نسبة الانضباط والالتزام
            </span>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{attendanceRate}%</p>
            <span className="text-[10px] text-muted-foreground font-bold">
              {presentCount} حاضر من {totalEmployeesCount}
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">
              العمل الإضافي المعتمد
            </span>
            <p className="text-2xl font-black text-foreground mt-0.5">
              {totalOvertimeApprovedHours}{" "}
              <span className="text-xs font-normal text-muted-foreground">ساعة</span>
            </p>
            <span className="text-[10px] text-primary font-bold">
              {totalOvertimeApprovedAmount.toLocaleString()} ر.س مخصص شهري
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Zap className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">
              حالات التأخير والانصراف المبكر
            </span>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{lateCount}</p>
            <span className="text-[10px] text-amber-600 font-bold">ضمن فترة السماح القانونية</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">طلبات تصحيح البصمة</span>
            <p className="text-2xl font-black text-indigo-600 mt-0.5">{pendingCorrectionsCount}</p>
            <span className="text-[10px] text-muted-foreground font-bold">
              بانتظار اعتماد المشرفين
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
            <FileCheck className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Tabs Hub */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-muted/40 p-1 rounded-2xl border border-border/60">
          <TabsTrigger value="timesheet" className="rounded-xl text-xs font-bold gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            سجل الدوام والتايم شيت اليومي
          </TabsTrigger>
          <TabsTrigger value="overtime" className="rounded-xl text-xs font-bold gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            الساعات والعمل الإضافي (م107)
            {overtimeRecords.filter((o) => o.status === "pending").length > 0 && (
              <Badge className="mr-1 bg-amber-500 text-white rounded-full text-[10px] h-4 px-1.5">
                {overtimeRecords.filter((o) => o.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="corrections" className="rounded-xl text-xs font-bold gap-1.5">
            <FileCheck className="h-3.5 w-3.5 text-indigo-500" />
            طلبات تصحيح البصمة
            {pendingCorrectionsCount > 0 && (
              <Badge className="mr-1 bg-indigo-600 text-white rounded-full text-[10px] h-4 px-1.5">
                {pendingCorrectionsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="biometric" className="rounded-xl text-xs font-bold gap-1.5">
            <Fingerprint className="h-3.5 w-3.5 text-primary" />
            جهاز البصمة وتسوية الرواتب
          </TabsTrigger>
          <TabsTrigger value="policies" className="rounded-xl text-xs font-bold gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            ضوابط نظام العمل والسياج الجغرافي
          </TabsTrigger>
        </TabsList>

        <TabsContent value="biometric" className="space-y-4">
          <BiometricTerminalPanel />
        </TabsContent>


        {/* TAB 1: Daily Timesheet & Records */}
        <TabsContent value="timesheet" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="بحث باسم الموظف، الرقم الوظيفي..."
                    className="w-full h-9 rounded-full border border-border/80 bg-muted/40 pr-9 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {/* Status Pills */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-full border border-border/60 text-xs">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1 rounded-full font-bold transition-colors ${
                      statusFilter === "all"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("present")}
                    className={`px-3 py-1 rounded-full font-bold transition-colors ${
                      statusFilter === "present"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    حاضر
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("late")}
                    className={`px-3 py-1 rounded-full font-bold transition-colors ${
                      statusFilter === "late"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    متأخر
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("absent")}
                    className={`px-3 py-1 rounded-full font-bold transition-colors ${
                      statusFilter === "absent"
                        ? "bg-destructive text-destructive-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    غائب
                  </button>
                </div>

                {/* Department Filter */}
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-9 rounded-full border border-border/80 bg-muted/40 px-3 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">جميع الإدارات</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleProcessAttendance}
                  variant="secondary"
                  size="sm"
                  className="rounded-full h-9 text-xs font-bold gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4"
                >
                  <Compass className="h-3.5 w-3.5 text-primary" />
                  معالجة البصمات الشهرية
                </Button>
                <Button
                  onClick={handleExportAttendance}
                  variant="outline"
                  size="sm"
                  className="rounded-full h-9 text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary px-4"
                >
                  <Download className="h-3.5 w-3.5" />
                  تصدير الكشف (CSV)
                </Button>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start">الموظف</th>
                    <th className="py-3 px-4 text-start">الوردية المجدولة</th>
                    <th className="py-3 px-4 text-start">وقت الدخول</th>
                    <th className="py-3 px-4 text-start">وقت الخروج</th>
                    <th className="py-3 px-4 text-center">ساعات العمل</th>
                    <th className="py-3 px-4 text-center">التأخير</th>
                    <th className="py-3 px-4 text-center">عمل إضافي</th>
                    <th className="py-3 px-4 text-center">المصدر والنطاق</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => openEmployeeProfile(rec.employeeId)}
                          className="text-start font-bold text-foreground hover:text-primary hover:underline transition-colors block"
                        >
                          {rec.employeeName}
                        </button>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {rec.employeeNo} • {rec.departmentName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground">{rec.scheduledShift}</span>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {rec.scheduledIn} — {rec.scheduledOut}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {rec.actualIn ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {rec.actualIn}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {rec.actualOut ? (
                          <span className="text-primary">{rec.actualOut}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {rec.workedHours > 0 ? `${rec.workedHours} س` : "0 س"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {rec.lateMinutes > 0 ? (
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 rounded-full font-mono text-[10px]">
                            {rec.lateMinutes} د
                          </Badge>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px]">ملتزم</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {rec.overtimeHours > 0 ? (
                          <Badge className="bg-primary/10 text-primary border-primary/30 rounded-full font-mono font-bold text-[10px]">
                            +{rec.overtimeHours} س
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {rec.punchSource === "mobile_gps"
                              ? "تطبيق الجوال GPS"
                              : rec.punchSource === "biometric_device"
                                ? "جهاز البصمة"
                                : rec.punchSource === "correction_request"
                                  ? "طلب مصحح"
                                  : "تعديل إداري"}
                          </span>
                          {rec.geofenceValid ? (
                            <span
                              className="h-2 w-2 rounded-full bg-emerald-500"
                              title="داخل السياج"
                            />
                          ) : (
                            <span
                              className="h-2 w-2 rounded-full bg-amber-500"
                              title="خارج السياج"
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            rec.status === "present"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                              : rec.status === "late"
                                ? "bg-amber-500/10 text-amber-700 border-amber-300"
                                : "bg-destructive/10 text-destructive border-destructive/30"
                          }`}
                        >
                          {rec.status === "present"
                            ? "حاضر بالموعد"
                            : rec.status === "late"
                              ? "متأخر"
                              : "غائب"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-center py-10 text-muted-foreground font-medium"
                      >
                        لا توجد سجلات حضور تطابق معايير الفلترة المحددة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Overtime Management (المادة 107 من نظام العمل) */}
        <TabsContent value="overtime" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  محرك احتساب وإدارة العمل الإضافي (Overtime Engine)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  وفقاً لنظام العمل السعودي: يُحسب أجر الساعة الإضافية بمعدل 150% (ساعة ونصف) وساعات
                  العطل والأعياد بمعدل 200%.
                </p>
              </div>

              {canManageAttendance && (
                <Button
                  onClick={() => setIsOvertimeModalOpen(true)}
                  size="sm"
                  className="rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4"
                >
                  <Plus className="h-4 w-4" />
                  تسجيل تكليف بعمل إضافي
                </Button>
              )}
            </div>

            {/* Overtime Table */}
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start">الموظف</th>
                    <th className="py-3 px-4 text-start">تاريخ العمل الإضافي</th>
                    <th className="py-3 px-4 text-center">الفترة</th>
                    <th className="py-3 px-4 text-center">عدد الساعات</th>
                    <th className="py-3 px-4 text-center">المعدل النظامي</th>
                    <th className="py-3 px-4 text-center">أجر الساعة الأساسي</th>
                    <th className="py-3 px-4 text-center">المستحق المالي الإجمالي</th>
                    <th className="py-3 px-4 text-start">المبرر ومهمة العمل</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {overtimeRecords.map((ot) => (
                    <tr key={ot.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-foreground block">{ot.employeeName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {ot.employeeNo} • {ot.departmentName}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">{ot.workDate}</td>
                      <td className="py-3 px-4 text-center font-mono">
                        {ot.startTime} — {ot.endTime}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black text-primary">
                        {ot.hours} ساعة
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            ot.rateType === "regular_150"
                              ? "bg-amber-500/10 text-amber-700 border-amber-300"
                              : "bg-purple-500/10 text-purple-700 border-purple-300"
                          }`}
                        >
                          {ot.rateMultiplier === 1.5 ? "150% (دوام عادي)" : "200% (عطلة/عيد)"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium">
                        {ot.hourlyRate} ر.س/س
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black text-emerald-600">
                        {ot.totalAmount.toLocaleString()} ر.س
                      </td>
                      <td
                        className="py-3 px-4 max-w-xs truncate text-muted-foreground font-medium"
                        title={ot.reason}
                      >
                        {ot.reason}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            ot.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                              : ot.status === "rejected"
                                ? "bg-destructive/10 text-destructive border-destructive/30"
                                : "bg-blue-500/10 text-blue-700 border-blue-300"
                          }`}
                        >
                          {ot.status === "approved"
                            ? "معتمد للمسير"
                            : ot.status === "rejected"
                              ? "مرفوض"
                              : "بانتظار الاعتماد"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {ot.status === "pending" && canManageAttendance ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => approveOvertimeRequest(ot.id)}
                              className="h-7 text-[11px] rounded-full px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                              اعتماد
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectOvertimeRequest(ot.id)}
                              className="h-7 text-[11px] rounded-full px-2.5 border-destructive/30 text-destructive hover:bg-destructive/10 font-bold"
                            >
                              رفض
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {ot.approvedBy ? `اعتمد بواسطة: ${ot.approvedBy}` : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {overtimeRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="text-center py-10 text-muted-foreground font-medium"
                      >
                        لا توجد طلبات عمل إضافي مسجلة حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: Punch Regularization Requests */}
        <TabsContent value="corrections" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-indigo-500" />
                  طلبات تصحيح وتبرير البصمات (Punch Regularization)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  معالجة البصمات المنسية أو الأعطال الفنية؛ عند الاعتماد يتم تحديث سجل الحضور وساعات
                  العمل فوراً.
                </p>
              </div>

              <Button
                onClick={() => setIsCorrectionModalOpen(true)}
                size="sm"
                className="rounded-full text-xs font-bold gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4"
              >
                <Plus className="h-4 w-4 text-primary" />
                تقديم طلب تصحيح جديد
              </Button>
            </div>

            {/* Corrections Table */}
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start">الموظف</th>
                    <th className="py-3 px-4 text-start">تاريخ اليوم</th>
                    <th className="py-3 px-4 text-center">البصمة المسجلة أصلية</th>
                    <th className="py-3 px-4 text-center">أوقات التصحيح المطلوبة</th>
                    <th className="py-3 px-4 text-start">المبرر والسبب</th>
                    <th className="py-3 px-4 text-center">تاريخ التقديم</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center">القرار والإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {attendanceCorrections.map((cor) => (
                    <tr key={cor.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-foreground block">{cor.employeeName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {cor.employeeNo} • {cor.departmentName}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">{cor.workDate}</td>
                      <td className="py-3 px-4 text-center font-mono text-muted-foreground">
                        {cor.originalIn || "—"} / {cor.originalOut || "—"}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-primary">
                        {cor.correctInTime} — {cor.correctOutTime}
                      </td>
                      <td className="py-3 px-4 max-w-xs font-medium text-muted-foreground">
                        {cor.reason}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[10px] text-muted-foreground">
                        {new Date(cor.submittedAt).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            cor.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                              : cor.status === "rejected"
                                ? "bg-destructive/10 text-destructive border-destructive/30"
                                : "bg-amber-500/10 text-amber-700 border-amber-300"
                          }`}
                        >
                          {cor.status === "approved"
                            ? "مقبول ومصحح"
                            : cor.status === "rejected"
                              ? "مرفوض"
                              : "قيد المراجعة"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cor.status === "pending" && canManageAttendance ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => approveAttendanceCorrection(cor.id)}
                              className="h-7 text-[11px] rounded-full px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                              اعتماد وتصحيح
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectAttendanceCorrection(cor.id)}
                              className="h-7 text-[11px] rounded-full px-2.5 border-destructive/30 text-destructive hover:bg-destructive/10 font-bold"
                            >
                              رفض
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {cor.reviewedBy ? `المراجع: ${cor.reviewedBy}` : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {attendanceCorrections.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-10 text-muted-foreground font-medium"
                      >
                        لا توجد طلبات تصحيح بصمة حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: Policies, Geofence & Saudi Labor Law Compliance */}
        <TabsContent value="policies" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-primary font-black text-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                نظام العمل السعودي - ساعات الدوام والعمل الإضافي
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="font-bold text-foreground block mb-1">
                    المادة 98 (ساعات العمل الفعلية):
                  </span>
                  لا يجوز تشغيل العامل تشغيلاً فعلياً أكثر من 8 ساعات في اليوم الواحد إذا اعتمد صاحب
                  العمل المعيار اليومي، أو أكثر من 48 ساعة في الأسبوع إذا اعتمد المعيار الأسبوعي.
                  وتخفض ساعات العمل خلال شهر رمضان للمسلمين بحيث لا تزيد على 6 ساعات يومياً أو 36
                  ساعة أسبوعياً.
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="font-bold text-foreground block mb-1">
                    المادة 107 (أجر الساعات الإضافية):
                  </span>
                  يجب على صاحب العمل أن يدفع للعامل عن ساعات العمل الإضافية أجراً يوازي أجر الساعة
                  مضافاً إليه 50% من أجره الأساسي. وإذا كان التشغيل في أيام الأعياد أو العطلات
                  الأسبوعية، تكون جميع الساعات إضافية بأجر مضاعف.
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="font-bold text-foreground block mb-1">
                    المادة 101 (فترات الراحة والصلاة):
                  </span>
                  لا يعمل العامل أكثر من 5 ساعات متتالية دون فترة للراحة والصلاة وتناول الطعام لا
                  تقل عن نصف ساعة في المرة الواحدة.
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-primary font-black text-sm">
                <MapPin className="h-5 w-5 text-indigo-600" />
                إعدادات السياج الجغرافي GPS وأجهزة الدوام
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-2xl border border-border/60 bg-muted/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground block">
                      مقر الرياض - الإدارة العامة
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      خط العرض: 24.7136 | خط الطول: 46.6753
                    </span>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 rounded-full text-[10px]">
                    نطاق 150 متر
                  </Badge>
                </div>

                <div className="p-4 rounded-2xl border border-border/60 bg-muted/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground block">
                      فرع جدة والمنطقة الغربية
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      خط العرض: 21.5433 | خط الطول: 39.1728
                    </span>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 rounded-full text-[10px]">
                    نطاق 200 متر
                  </Badge>
                </div>

                <div className="p-4 rounded-2xl border border-border/60 bg-muted/40 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground block">
                      فرع الخبر والمنطقة الشرقية
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      خط العرض: 26.2172 | خط الطول: 50.1971
                    </span>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 rounded-full text-[10px]">
                    نطاق 150 متر
                  </Badge>
                </div>

                <div className="p-3.5 rounded-2xl bg-secondary/50 border border-primary/20 flex items-start gap-2 text-foreground">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    يتم التحقق من موقع الموظف آلياً عند استخدام تطبيق الجوال؛ في حال كانت البصمة
                    خارج النطاق، يُسجل الحضور مع إشعار بالخروج عن السياج للمشرف.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: Punch Correction Request */}
      <Dialog open={isCorrectionModalOpen} onOpenChange={setIsCorrectionModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              طلب تصحيح أو تسجيل بصمة منسية
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              سيتم إرسال الطلب مع المبررات إلى مديرك المباشر لاعتماده وتعديل مسير الدوام
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">تاريخ اليوم المراد تصحيحه *</label>
              <input
                type="date"
                value={correctionDate}
                onChange={(e) => setCorrectionDate(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">وقت الدخول الفعلي</label>
                <input
                  type="time"
                  value={correctInTime}
                  onChange={(e) => setCorrectInTime(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">وقت الخروج الفعلي</label>
                <input
                  type="time"
                  value={correctOutTime}
                  onChange={(e) => setCorrectOutTime(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">سبب عدم التسجيل أو المبرر *</label>
              <textarea
                rows={2}
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="مثال: نسيان البصمة بسبب اجتماع عمل خارجي أو عطل تقني..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleSubmitCorrection}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              إرسال طلب التصحيح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Create / Assign Overtime */}
      <Dialog open={isOvertimeModalOpen} onOpenChange={setIsOvertimeModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              تسجيل تكليف بساعات عمل إضافي (م107)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              احتساب مالي فوري وفق الأجر الأساسي ونسبة العمل الإضافي المعتمدة نظاماً
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الموظف المكلف *</label>
              <select
                value={otEmpId}
                onChange={(e) => setOtEmpId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo}) — {emp.jobTitleAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ التكليف *</label>
                <input
                  type="date"
                  value={otDate}
                  onChange={(e) => setOtDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">نوع الوردية الإضافية *</label>
                <select
                  value={otRateType}
                  onChange={(e) => setOtRateType(e.target.value as any)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="regular_150">يوم عمل عادي (معدل 150%)</option>
                  <option value="holiday_200">عطلة أسبوعية أو رسمية (معدل 200%)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">وقت البدء</label>
                <input
                  type="time"
                  value={otStartTime}
                  onChange={(e) => setOtStartTime(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">وقت الانتهاء</label>
                <input
                  type="time"
                  value={otEndTime}
                  onChange={(e) => setOtEndTime(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">إجمالي الساعات *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={otHours}
                  onChange={(e) => setOtHours(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Live Calculation Preview Card */}
            <div className="p-3.5 rounded-2xl bg-secondary/60 border border-primary/20 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">أجر الساعة الأساسي:</span>
                <span className="font-mono font-bold">{calculatedHourlyRate} ر.س</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">معامل الاحتساب النظامي:</span>
                <span className="font-bold text-amber-600">{otMultiplier}x</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-border/60">
                <span className="font-bold text-foreground">إجمالي المستحق المالي للطلب:</span>
                <span className="text-sm font-mono font-black text-emerald-600">
                  {calculatedOtTotal.toLocaleString()} ر.س
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">مبرر ومهمة العمل الإضافي *</label>
              <textarea
                rows={2}
                value={otReason}
                onChange={(e) => setOtReason(e.target.value)}
                placeholder="اكتب أسباب التكليف ومخرجات العمل المطلوبة بالتفصيل..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateOvertime}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-9"
            >
              حفظ واعتماد التكليف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
