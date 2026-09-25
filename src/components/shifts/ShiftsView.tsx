import React, { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { IconSymbol } from "../ui/IconSymbol";
import {
  CalendarCheck,
  Clock,
  Plus,
  Server,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowLeftRight,
  Copy,
  Edit2,
  Archive,
  Search,
  Filter,
  RefreshCw,
  Sun,
  Moon,
  Split,
  Sliders,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import {
  useShiftDefinitions,
  useShiftMutations,
  useRosterPeriods,
  useRosterAssignments,
  useRosterExceptions,
  useShiftSwapRequests,
  useRosterMutations,
} from "../../lib/domains/shifts";
import type { ShiftDefinition, ScheduleAssignment, Employee, ShiftSwapRequest } from "../../types";
import { ShiftDefinitionModal } from "./ShiftDefinitionModal";
import { CreateRosterPeriodModal } from "./CreateRosterPeriodModal";
import { AssignShiftModal } from "./AssignShiftModal";
import { CreateShiftSwapModal } from "./CreateShiftSwapModal";
import { WorkweekConfigCard } from "./WorkweekConfigCard";

export const ShiftsView: React.FC = () => {
  const navigate = useNavigate();
  const { company, employees, openEmployeeProfile, currentRole, language, t } = useApp();
  const canManage = canManageModule(currentRole, "shifts");

  const companyId = company?.id;
  const companyName = company?.legalNameAr || company?.legalNameEn || "المنشأة";

  // Data Hooks
  const { shifts, isLoading: shiftsLoading, refetch: refetchShifts } = useShiftDefinitions(companyId);
  const { archiveShift } = useShiftMutations(companyId);
  const { periods, isLoading: periodsLoading, refetch: refetchPeriods } = useRosterPeriods({ companyId });

  // Selected Period State
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const activePeriod = useMemo(() => {
    if (!periods.length) return null;
    return periods.find((p) => p.id === selectedPeriodId) || periods[0];
  }, [periods, selectedPeriodId]);

  const effectivePeriodId = activePeriod?.id;

  const { assignments, isLoading: assignmentsLoading, refetch: refetchAssignments } = useRosterAssignments(
    effectivePeriodId,
    { companyId },
  );

  const { exceptions, refetch: refetchExceptions } = useRosterExceptions(effectivePeriodId);
  const { swapRequests, refetch: refetchSwaps } = useShiftSwapRequests({ companyId });
  const { checkConflicts, publish, copyPeriod, resolveException, approveSwap, rejectSwap } =
    useRosterMutations(companyId);

  // Tab State
  const [activeTab, setActiveTab] = useState("definitions");

  // Modals
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftDefinition | null>(null);
  const [isCreatePeriodOpen, setIsCreatePeriodOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    employee: Employee | null;
    date: string;
    currentAssignment: ScheduleAssignment | null;
  }>({ employee: null, date: "", currentAssignment: null });
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);

  // Filters
  const [shiftFilter, setShiftFilter] = useState<"all" | "active" | "archived">("active");
  const [shiftSearch, setShiftSearch] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [swapStatusFilter, setSwapStatusFilter] = useState<string>("all");

  // Action states
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  // Filtered shifts
  const filteredShifts = useMemo(() => {
    return shifts.filter((sh) => {
      const matchStatus =
        shiftFilter === "all" ? true : shiftFilter === "active" ? sh.status !== "archived" : sh.status === "archived";
      const matchSearch =
        !shiftSearch ||
        sh.nameAr.toLowerCase().includes(shiftSearch.toLowerCase()) ||
        sh.code.toLowerCase().includes(shiftSearch.toLowerCase()) ||
        sh.nameEn.toLowerCase().includes(shiftSearch.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [shifts, shiftFilter, shiftSearch]);

  // Generate days array for current period
  const periodDays = useMemo(() => {
    if (!activePeriod?.startDate || !activePeriod?.endDate) return [];
    const days: { dateStr: string; dayName: string; dayIndex: number }[] = [];
    const start = new Date(activePeriod.startDate);
    const end = new Date(activePeriod.endDate);

    const arabicDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

    const cur = new Date(start);
    while (cur <= end && days.length < 31) {
      const dateStr = cur.toISOString().substring(0, 10);
      days.push({
        dateStr,
        dayName: arabicDays[cur.getDay()],
        dayIndex: cur.getDay(),
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [activePeriod]);

  // Filtered employees for roster
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.departmentName) set.add(e.departmentName);
    });
    return Array.from(set);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchDept = departmentFilter === "all" || emp.departmentName === departmentFilter;
      const fullName = `${emp.firstNameAr || ""} ${emp.lastNameAr || ""}`.toLowerCase();
      const matchSearch =
        !rosterSearch ||
        fullName.includes(rosterSearch.toLowerCase()) ||
        emp.employeeNo.toLowerCase().includes(rosterSearch.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [employees, departmentFilter, rosterSearch]);

  // Lookup assignments by employeeId + date
  const assignmentMap = useMemo(() => {
    const map = new Map<string, ScheduleAssignment>();
    assignments.forEach((a) => {
      map.set(`${a.employeeId}_${a.date}`, a);
    });
    return map;
  }, [assignments]);

  // Publish Handler
  const handlePublish = async () => {
    if (!effectivePeriodId) return;
    setIsPublishing(true);
    try {
      await publish(effectivePeriodId);
      refetchPeriods();
      refetchAssignments();
    } finally {
      setIsPublishing(false);
    }
  };

  // Conflict Check Handler
  const handleCheckConflicts = async () => {
    if (!effectivePeriodId) return;
    setIsCheckingConflicts(true);
    try {
      await checkConflicts(effectivePeriodId);
      refetchExceptions();
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  // Cell Click in Grid
  const handleCellClick = (employee: Employee, dateStr: string) => {
    if (!canManage) return;
    if (activePeriod?.status === "locked") {
      toast.error("فترة الجدولة مقفلة ولا يمكن تعديل إسناداتها");
      return;
    }
    const current = assignmentMap.get(`${employee.id}_${dateStr}`) || null;
    setSelectedCell({
      employee,
      date: dateStr,
      currentAssignment: current,
    });
    setIsAssignModalOpen(true);
  };

  // Copy Period Handler
  const handleCopyPeriod = async () => {
    if (!activePeriod) return;
    const start = new Date(activePeriod.startDate);
    const end = new Date(activePeriod.endDate);
    const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

    const newStart = new Date(end);
    newStart.setDate(end.getDate() + 1);
    const newEnd = new Date(newStart);
    newEnd.setDate(newStart.getDate() + durationDays - 1);

    const newStartStr = newStart.toISOString().substring(0, 10);
    const newEndStr = newEnd.toISOString().substring(0, 10);
    const newName = `جدول العمل (${newStartStr} إلى ${newEndStr})`;

    await copyPeriod(activePeriod.id, newStartStr, newEndStr, newName);
    refetchPeriods();
  };

  return (
    <div className="space-y-6">
      {/* Executive Page Header */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <IconSymbol name="calendar_month" source="material" filled size={24} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-foreground">
                  {t.nav.shifts} ومحرك الجدولة والورديات
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold border-primary/30 text-primary bg-primary/5 rounded-full px-2.5 py-0.5"
                >
                  محرك معتمد ومطابق لنظام العمل
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                إدارة الورديات وجداول العمل التفاعلية لشركة «{companyName}» مع الفحص الذاتي للتعارضات والنشر التلقائي
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => {
                setEditingShift(null);
                setIsAddShiftOpen(true);
              }}
              size="sm"
              className="classera-btn-primary rounded-full font-bold text-xs gap-1.5 shadow-xs h-10 px-5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              إنشاء وردية دوام جديدة
            </Button>
            <Button
              onClick={() => setIsCreatePeriodOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs cursor-pointer"
            >
              <Calendar className="h-4 w-4 text-primary" />
              فترة جدولة جديدة
            </Button>
          </div>
        )}
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="classera-kpi-card p-4 space-y-1">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            الورديات المعرفة النشطة
          </span>
          <p className="text-2xl font-black text-foreground font-mono">
            {shifts.filter((s) => s.status !== "archived").length}
          </p>
          <span className="text-[10px] text-muted-foreground">شاملة الورديات الثابتة والمرنة والمقسومة</span>
        </div>

        <div className="classera-kpi-card p-4 space-y-1">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            فترة الجدولة المحددة
          </span>
          <p className="text-sm font-black text-foreground truncate">
            {activePeriod?.name || "لا توجد فترة"}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge
              variant="outline"
              className={`text-[10px] rounded-full px-2 font-bold ${
                activePeriod?.status === "published"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300"
                  : activePeriod?.status === "locked"
                    ? "bg-slate-500/10 text-slate-700 border-slate-300"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300"
              }`}
            >
              {activePeriod?.status === "published"
                ? "منشور ومعتمد رسمياً"
                : activePeriod?.status === "locked"
                  ? "مقفلة (أرشيف)"
                  : "مسودة غير منشورة"}
            </Badge>
            {activePeriod && (
              <span className="text-[10px] font-mono text-muted-foreground">v{activePeriod.version}</span>
            )}
          </div>
        </div>

        <div className="classera-kpi-card p-4 space-y-1">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            تعارضات الجدول الحالية
          </span>
          <p
            className={`text-2xl font-black font-mono ${
              exceptions.filter((e) => !e.resolved).length > 0 ? "text-destructive" : "text-emerald-600"
            }`}
          >
            {exceptions.filter((e) => !e.resolved).length}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {exceptions.filter((e) => !e.resolved).length === 0
              ? "الجدول خالٍ من أي تعارضات"
              : "يلزم مراجعة التعارضات قبل النشر"}
          </span>
        </div>

        <div className="classera-kpi-card p-4 space-y-1">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
            طلبات تبديل الورديات
          </span>
          <p className="text-2xl font-black text-foreground font-mono">
            {swapRequests.filter((s) => s.status === "pending" || s.status === "peer_accepted").length}
          </p>
          <span className="text-[10px] text-muted-foreground">بانتظار موافقة الزميل أو اعتماد الإدارة</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="classera-tabs-strip max-w-lg">
          <TabsTrigger value="definitions" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-4">
            {t.attendance.shiftsManagement} ({shifts.length})
          </TabsTrigger>
          <TabsTrigger value="scheduler" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-4">
            جدولة الورديات الفعلية (Roster Grid)
          </TabsTrigger>
          <TabsTrigger value="swaps" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-4">
            طلبات التبديل ({swapRequests.length})
          </TabsTrigger>
          <TabsTrigger value="policy" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-4">
            سياسة العمل والأسبوع
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: Shift Master Definitions */}
        {/* ========================================================================= */}
        <TabsContent value="definitions" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/80 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={shiftSearch}
                  onChange={(e) => setShiftSearch(e.target.value)}
                  placeholder="بحث في الورديات (الاسم، الكود)..."
                  className="pr-9 h-9 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 border rounded-xl p-0.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setShiftFilter("active")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    shiftFilter === "active" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground"
                  }`}
                >
                  النشطة
                </button>
                <button
                  type="button"
                  onClick={() => setShiftFilter("archived")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    shiftFilter === "archived" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground"
                  }`}
                >
                  المؤرشفة
                </button>
                <button
                  type="button"
                  onClick={() => setShiftFilter("all")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    shiftFilter === "all" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground"
                  }`}
                >
                  الكل
                </button>
              </div>
            </div>

            {canManage && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingShift(null);
                  setIsAddShiftOpen(true);
                }}
                className="classera-btn-primary text-xs font-bold rounded-xl h-9 px-4 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                تعريف وردية جديدة
              </Button>
            )}
          </div>

          {filteredShifts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-card p-12 text-center">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                  <Clock className="h-7 w-7" />
                </div>
                <p className="font-bold text-foreground text-sm">لم يتم العثور على ورديات مطابقة</p>
                <p className="text-xs text-muted-foreground max-w-md">
                  يمكنك تعريف وردية دوام جديدة وتحديد ساعات الحضور والانصراف وقواعد الراحة الإلزامية.
                </p>
                {canManage && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingShift(null);
                      setIsAddShiftOpen(true);
                    }}
                    className="classera-btn-primary rounded-full text-xs font-bold gap-2 mt-2"
                  >
                    <Plus className="h-4 w-4" />
                    تعريف وردية الآن
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredShifts.map((sh) => (
                <div
                  key={sh.id}
                  className={`classera-kpi-card p-5 shadow-xs space-y-4 relative overflow-hidden transition-all ${
                    sh.status === "archived" ? "opacity-60 bg-muted/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-4 w-4 rounded-full shadow-xs shrink-0"
                        style={{ backgroundColor: sh.color || "#0284c7" }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-sm text-foreground">{sh.nameAr}</h3>
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                            {sh.code}
                          </Badge>
                          {sh.version && sh.version > 1 && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              v{sh.version}
                            </Badge>
                          )}
                        </div>
                        {sh.nameEn && sh.nameEn !== sh.nameAr && (
                          <p className="text-[11px] text-muted-foreground">{sh.nameEn}</p>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-full px-2.5 font-bold shrink-0 flex items-center gap-1 ${
                        sh.type === "fixed"
                          ? "bg-sky-500/10 text-sky-700 border-sky-300"
                          : sh.type === "flexible"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                            : sh.type === "split"
                              ? "bg-amber-500/10 text-amber-700 border-amber-300"
                              : "bg-indigo-500/10 text-indigo-700 border-indigo-300"
                      }`}
                    >
                      {sh.type === "fixed" && <Sun className="h-3 w-3" />}
                      {sh.type === "flexible" && <Sliders className="h-3 w-3" />}
                      {sh.type === "split" && <Split className="h-3 w-3" />}
                      {sh.type === "overnight" && <Moon className="h-3 w-3" />}
                      {sh.type === "fixed"
                        ? "ثابتة"
                        : sh.type === "flexible"
                          ? "مرنة"
                          : sh.type === "split"
                            ? "مقسمة"
                            : "ليلية"}
                    </Badge>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs space-y-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">فترة العمل:</span>
                      <span className="font-bold text-foreground">
                        {sh.startTime} - {sh.endTime}
                      </span>
                    </div>

                    {sh.type === "flexible" && sh.flexibleHours && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-sans">ساعات ملزمة:</span>
                        <span className="font-bold text-primary">{sh.flexibleHours} ساعات</span>
                      </div>
                    )}

                    {sh.type === "split" && sh.splitSecondStartTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-sans">الفترة الثانية:</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          {sh.splitSecondStartTime} - {sh.splitSecondEndTime}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">سماح حضور / انصراف:</span>
                      <span className="font-bold text-emerald-600">
                        +{sh.graceMinutesArrival} د / +{sh.graceMinutesDeparture} د
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">راحة إلزامية بعدها:</span>
                      <span className="font-bold text-foreground">{sh.minRestHoursAfter ?? 11} ساعة</span>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingShift(sh);
                          setIsAddShiftOpen(true);
                        }}
                        className="h-8 px-2.5 text-xs font-bold gap-1 text-primary hover:bg-primary/10 rounded-xl"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        تعديل وإصدار نسخة
                      </Button>
                      {sh.status !== "archived" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (window.confirm(`هل أنت متأكد من أرشفة الوردية «${sh.nameAr}»؟`)) {
                              await archiveShift(sh.id);
                              refetchShifts();
                            }
                          }}
                          className="h-8 px-2.5 text-xs font-bold gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          أرشفة
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: Roster Scheduler Grid */}
        {/* ========================================================================= */}
        <TabsContent value="scheduler" className="space-y-4">
          {/* Scheduler Controls Bar */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground block">اختيار فترة الجدولة</span>
                  <select
                    value={effectivePeriodId || ""}
                    onChange={(e) => setSelectedPeriodId(e.target.value)}
                    className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-bold min-w-[240px]"
                  >
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.startDate} إلى {p.endDate}) - {p.status === "published" ? "منشور" : "مسودة"}
                      </option>
                    ))}
                    {periods.length === 0 && <option value="">لا توجد فترات جدولة معرفة</option>}
                  </select>
                </div>

                {activePeriod && (
                  <div className="flex items-center gap-2 pt-4">
                    <Badge
                      variant="outline"
                      className={`text-xs rounded-full px-3 py-1 font-bold ${
                        activePeriod.status === "published"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300"
                          : activePeriod.status === "locked"
                            ? "bg-slate-500/10 text-slate-700 border-slate-300"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300"
                      }`}
                    >
                      {activePeriod.status === "published"
                        ? "منشور رسمي لوحدة الحضور"
                        : activePeriod.status === "locked"
                          ? "مغلق ومؤرشف"
                          : "مسودة قيد التعديل"}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">نسخة v{activePeriod.version}</span>
                  </div>
                )}
              </div>

              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCheckConflicts}
                    disabled={isCheckingConflicts || !activePeriod}
                    className="rounded-xl text-xs font-bold gap-1.5 h-9 px-3.5 border-border/80"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    {isCheckingConflicts ? "جاري الفحص..." : "فحص التعارضات"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyPeriod}
                    disabled={!activePeriod}
                    className="rounded-xl text-xs font-bold gap-1.5 h-9 px-3.5 border-border/80"
                  >
                    <Copy className="h-3.5 w-3.5 text-primary" />
                    تكرار الفترة للأسبوع القادم
                  </Button>

                  <Button
                    size="sm"
                    onClick={handlePublish}
                    disabled={isPublishing || !activePeriod || activePeriod.status === "locked"}
                    className="classera-btn-primary rounded-xl text-xs font-bold gap-1.5 h-9 px-4 shadow-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isPublishing ? "جاري النشر..." : "نشر واعتماد الجدول رسمياً"}
                  </Button>
                </div>
              )}
            </div>

            {/* Exceptions / Conflicts Alert Box */}
            {exceptions.filter((e) => !e.resolved).length > 0 && (
              <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-destructive font-black text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      توجد ({exceptions.filter((e) => !e.resolved).length}) تعارضات تم رصدها في جدول العمل
                    </span>
                  </div>
                  <Badge variant="destructive" className="text-[10px] rounded-full">
                    مخالفات نظامية
                  </Badge>
                </div>
                <div className="divide-y divide-destructive/15 text-xs max-h-40 overflow-y-auto space-y-1.5 pt-1">
                  {exceptions
                    .filter((e) => !e.resolved)
                    .map((ex) => (
                      <div key={ex.id} className="pt-1.5 flex items-center justify-between">
                        <span className="text-foreground">{ex.message}</span>
                        {canManage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await resolveException(ex.id, effectivePeriodId);
                              refetchExceptions();
                            }}
                            className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            تسوية وتجاهل
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Grid Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="بحث عن موظف..."
                    className="pr-9 h-8 text-xs"
                  />
                </div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs"
                >
                  <option value="all">كافة الأقسام</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" /> وردية عمل
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400 ms-2" /> راحة أسبوعية
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground ms-2" /> غير مسند
              </div>
            </div>

            {/* Matrix Grid */}
            <div className="overflow-x-auto rounded-2xl border border-border/70 shadow-xs">
              <table className="w-full text-xs">
                <thead className="border-b border-border/70 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start min-w-[180px] sticky right-0 bg-muted/40 z-10">
                      الموظف ({filteredEmployees.length})
                    </th>
                    {periodDays.map((d) => (
                      <th
                        key={d.dateStr}
                        className={`py-2 px-2 text-center min-w-[120px] ${
                          d.dayIndex === 5 || d.dayIndex === 6 ? "bg-muted/60" : ""
                        }`}
                      >
                        <div className="font-bold text-foreground">{d.dayName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{d.dateStr.slice(5)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={periodDays.length + 1} className="py-12 text-center text-muted-foreground">
                        لم يتم العثور على موظفين في هذا القسم أو الفلتر.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="py-3 px-4 whitespace-nowrap sticky right-0 bg-card group-hover:bg-muted/20 z-10 border-e border-border/60">
                          <button
                            type="button"
                            onClick={() => openEmployeeProfile(emp)}
                            className="font-bold text-foreground group-hover:text-primary hover:underline cursor-pointer text-start block"
                          >
                            {emp.firstNameAr} {emp.lastNameAr}
                          </button>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {emp.employeeNo} • {emp.departmentName || "عام"}
                          </span>
                        </td>

                        {periodDays.map((d) => {
                          const assignment = assignmentMap.get(`${emp.id}_${d.dateStr}`);
                          const isRest = assignment?.isRestDay;

                          return (
                            <td
                              key={d.dateStr}
                              onClick={() => handleCellClick(emp, d.dateStr)}
                              className={`py-2 px-1 text-center transition-all ${
                                canManage ? "cursor-pointer hover:bg-primary/5" : ""
                              } ${d.dayIndex === 5 || d.dayIndex === 6 ? "bg-muted/10" : ""}`}
                            >
                              {assignment ? (
                                isRest ? (
                                  <span className="inline-block rounded-xl bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[10px] font-bold">
                                    راحة
                                  </span>
                                ) : (
                                  <div
                                    className="inline-flex flex-col items-center justify-center rounded-xl p-1 px-2 border shadow-2xs max-w-[110px] truncate"
                                    style={{
                                      backgroundColor: `${assignment.shiftColor || "#0284c7"}15`,
                                      borderColor: `${assignment.shiftColor || "#0284c7"}40`,
                                      color: assignment.shiftColor || "#0284c7",
                                    }}
                                  >
                                    <span className="font-bold text-[10px] truncate">
                                      {assignment.shiftNameAr}
                                    </span>
                                  </div>
                                )
                              ) : (
                                <span className="text-muted-foreground/40 text-[11px] font-mono select-none">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: Shift Swaps */}
        {/* ========================================================================= */}
        <TabsContent value="swaps" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/80 shadow-xs">
            <div className="flex items-center gap-2">
              <select
                value={swapStatusFilter}
                onChange={(e) => setSwapStatusFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-bold"
              >
                <option value="all">كافة الطلبات</option>
                <option value="pending">بانتظار الموافقة</option>
                <option value="approved">معتمدة رسمياً</option>
                <option value="rejected">مرفوضة</option>
              </select>
            </div>

            <Button
              size="sm"
              onClick={() => setIsSwapModalOpen(true)}
              className="classera-btn-primary text-xs font-bold rounded-xl h-9 px-4 gap-1.5"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              طلب تبديل وردية جديد
            </Button>
          </div>

          {swapRequests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-card p-12 text-center">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                  <ArrowLeftRight className="h-7 w-7" />
                </div>
                <p className="font-bold text-foreground text-sm">لا توجد طلبات تبديل ورديات مسجلة</p>
                <p className="text-xs text-muted-foreground max-w-md">
                  يمكن للموظفين أو المشرفين إرسال طلبات تبديل الورديات واعتمادها رسمياً مع تعديل الجدول آلياً.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {swapRequests
                .filter((s) => (swapStatusFilter === "all" ? true : s.status === swapStatusFilter))
                .map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-3xl border border-border/80 bg-card shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <ArrowLeftRight className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-foreground">
                            {req.requesterName || "موظف 1"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({req.requesterDate}: {req.requesterShiftName})
                          </span>
                          <span className="text-xs text-muted-foreground">⇄</span>
                          <span className="font-bold text-xs text-foreground">
                            {req.targetEmployeeName || "موظف 2"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({req.targetDate}: {req.targetShiftName})
                          </span>
                        </div>
                        {req.reason && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-bold">السبب:</span> {req.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`text-xs rounded-full px-3 py-1 font-bold ${
                          req.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300"
                            : req.status === "rejected"
                              ? "bg-destructive/10 text-destructive border-destructive/30"
                              : "bg-amber-500/10 text-amber-700 border-amber-300"
                        }`}
                      >
                        {req.status === "approved"
                          ? "معتمد رسمياً"
                          : req.status === "rejected"
                            ? "مرفوض"
                            : "قيد المراجعة والاعتماد"}
                      </Badge>

                      {canManage && (req.status === "pending" || req.status === "peer_accepted") && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              await approveSwap(req.id);
                              refetchSwaps();
                              refetchAssignments();
                            }}
                            className="classera-btn-primary rounded-xl text-xs font-bold h-8 px-3"
                          >
                            اعتماد
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              await rejectSwap(req.id);
                              refetchSwaps();
                            }}
                            className="rounded-xl text-xs font-bold h-8 px-3"
                          >
                            رفض
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 4: Workweek Policy */}
        {/* ========================================================================= */}
        <TabsContent value="policy" className="space-y-4">
          <WorkweekConfigCard companyId={companyId} canManage={canManage} />
        </TabsContent>
      </Tabs>

      {/* Integration Banner linking to Attendance */}
      <div className="rounded-3xl border border-border/80 bg-muted/20 p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-start">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-foreground">
              الربط المباشر مع أجهزة البصمة وبوابة الحضور والانصراف
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              جداول الورديات المنشورة في هذه الشاشة هي المرجع الحصري المعتمد لمحرك الحضور والانصراف لاحتساب التأخير
              والغياب والإضافي.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate({ to: "/attendance" })}
          className="rounded-full text-xs font-bold gap-1.5 h-9 px-4 border-border/80 hover:bg-secondary shrink-0 cursor-pointer"
        >
          الانتقال إلى وحدة الحضور والانصراف
        </Button>
      </div>

      {/* Modals */}
      <ShiftDefinitionModal
        open={isAddShiftOpen}
        onOpenChange={setIsAddShiftOpen}
        initialShift={editingShift}
        companyId={companyId}
        onSuccess={() => {
          refetchShifts();
        }}
      />

      <CreateRosterPeriodModal
        open={isCreatePeriodOpen}
        onOpenChange={setIsCreatePeriodOpen}
        companyId={companyId}
        onSuccess={(createdId) => {
          setSelectedPeriodId(createdId);
          refetchPeriods();
        }}
      />

      <AssignShiftModal
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        employee={selectedCell.employee}
        date={selectedCell.date}
        currentAssignment={selectedCell.currentAssignment}
        shifts={shifts.filter((s) => s.status !== "archived")}
        rosterPeriodId={effectivePeriodId}
        companyId={companyId}
        onSuccess={() => {
          refetchAssignments();
          refetchExceptions();
        }}
      />

      <CreateShiftSwapModal
        open={isSwapModalOpen}
        onOpenChange={setIsSwapModalOpen}
        employees={employees}
        assignments={assignments}
        companyId={companyId}
        onSuccess={() => {
          refetchSwaps();
        }}
      />
    </div>
  );
};
