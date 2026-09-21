import React, { useState, useEffect } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { IconSymbol } from "../ui/IconSymbol";
import {
  CalendarDays,
  Plus,
  Calendar,
  Users,
  Info,
  Sliders,
  Settings,
  ShieldCheck,
  TrendingUp,
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
  useLeaves,
  useLeaveMutations,
  useLeaveTeamCalendar,
} from "../../lib/domains/leaves";
import { calculateWorkingDaysRecord } from "../../lib/data/operational-repository";

export const LeavesView: React.FC = () => {
  const {
    employees,
    currentRole,
    language,
    t,
    isSaving,
  } = useApp();

  const { leaveTypes, leaveBalances } = useLeaves();
  const { applyLeave, addLeaveType, adjustLeaveBalance, accrueLeaveBalances } = useLeaveMutations();

  const canManage = canManageModule(currentRole, "leaves");
  const [activeTab, setActiveTab] = useState("balances");

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);

  // Apply Form State - Truthful initial state (NO hardcoded fake dates)
  const [selectedTypeId, setSelectedTypeId] = useState(leaveTypes[0]?.id || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [calculatedWorkingDays, setCalculatedWorkingDays] = useState<number | null>(null);
  const [isCalculatingDays, setIsCalculatingDays] = useState(false);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"first_half" | "second_half">("first_half");
  const [reason, setReason] = useState("");

  // Add Type State
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDays, setNewTypeDays] = useState(21);
  const [newTypePaid, setNewTypePaid] = useState(true);
  const [newTypeAllowHalfDay, setNewTypeAllowHalfDay] = useState(true);
  const [newTypeAllowNegative, setNewTypeAllowNegative] = useState(false);
  const [newTypeRequiresAttachment, setNewTypeRequiresAttachment] = useState(false);
  const [newTypeCarryoverLimit, setNewTypeCarryoverLimit] = useState(5);

  // Adjust Balance State - Truthful initial state (NO auto-selecting employees[0])
  const [adjustEmpId, setAdjustEmpId] = useState("");
  const [adjustDays, setAdjustDays] = useState(1);
  const [adjustReason, setAdjustReason] = useState("");

  // Calculate working days automatically when dates change
  useEffect(() => {
    let active = true;
    if (!startDate || !endDate || endDate < startDate) {
      setCalculatedWorkingDays(null);
      return () => {
        active = false;
      };
    }
    setIsCalculatingDays(true);
    calculateWorkingDaysRecord(startDate, endDate, selectedTypeId, isHalfDay)
      .then((res) => {
        if (active) {
          setCalculatedWorkingDays(res.workingDays);
        }
      })
      .catch(() => {
        if (active) {
          setCalculatedWorkingDays(null);
        }
      })
      .finally(() => {
        if (active) setIsCalculatingDays(false);
      });
    return () => {
      active = false;
    };
  }, [startDate, endDate, selectedTypeId, isHalfDay]);

  // Current month team calendar
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];
  const { calendarItems, isLoading: isCalendarLoading } = useLeaveTeamCalendar(startOfMonth, endOfMonth);

  const selectedBalance = leaveBalances.find((b) => b.leaveTypeId === selectedTypeId);

  const handleApply = async () => {
    if (isSaving) return;
    if (!startDate || !endDate) {
      toast.error("يرجى اختيار تاريخ البداية وتاريخ النهاية");
      return;
    }
    if (endDate < startDate) {
      toast.error("تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو يطابقه");
      return;
    }
    if (calculatedWorkingDays === null || calculatedWorkingDays <= 0) {
      toast.error("الفترة المحددة لا تحتوي على أي أيام عمل فعلية مستحقة للخصم");
      return;
    }
    if (!reason.trim()) {
      toast.error("يرجى كتابة سبب الإجازة");
      return;
    }

    const success = await applyLeave({
      leaveTypeId: selectedTypeId || leaveTypes[0]?.id || "",
      startDate,
      endDate,
      isHalfDay,
      halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
      totalDays: calculatedWorkingDays,
      reason: reason.trim(),
    });

    if (success) {
      setIsApplyModalOpen(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      setIsHalfDay(false);
    }
  };

  const [isCreatingType, setIsCreatingType] = useState(false);
  const [isAdjustingBalance, setIsAdjustingBalance] = useState(false);

  const handleCreateLeaveType = async () => {
    if (!newTypeName.trim()) {
      toast.error("يرجى كتابة اسم نوع الإجازة");
      return;
    }
    setIsCreatingType(true);
    try {
      const ok = await addLeaveType({
        nameAr: newTypeName.trim(),
        maxDaysPerYear: newTypeDays,
        isPaid: newTypePaid,
        allowHalfDay: newTypeAllowHalfDay,
        allowNegativeBalance: newTypeAllowNegative,
        requiresAttachment: newTypeRequiresAttachment,
        carryoverLimitDays: newTypeCarryoverLimit,
      });
      if (ok) {
        setIsAddTypeModalOpen(false);
        setNewTypeName("");
        setNewTypeDays(21);
      }
    } finally {
      setIsCreatingType(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustEmpId) {
      toast.error("يرجى اختيار الموظف أولاً");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("يرجى كتابة سبب تعديل الرصيد");
      return;
    }
    setIsAdjustingBalance(true);
    try {
      const targetType = selectedTypeId || leaveTypes[0]?.id || "";
      const ok = await adjustLeaveBalance(adjustEmpId, targetType, adjustDays, adjustReason.trim());
      if (ok) {
        setIsAdjustBalanceOpen(false);
        setAdjustReason("");
        setAdjustEmpId("");
      }
    } finally {
      setIsAdjustingBalance(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Page Header */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <IconSymbol name="event_available" source="material" filled size={24} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-foreground">
                  {t.leaves.balance} وإدارة العطلات والغياب
                </h1>
                <Badge variant="outline" className="text-[11px] font-bold border-primary/30 text-primary bg-primary/5 rounded-full px-2.5 py-0.5">
                  سياسة الإجازات المعتمدة
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                إدارة أرصدة الإجازات السنوية والمرضية، التقديم، وحجز الرصيد وفق لائحة وسياسة العمل المعتمدة
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setIsApplyModalOpen(true)}
            size="sm"
            className="classera-btn-primary rounded-full font-bold text-xs gap-1.5 shadow-xs h-10 px-5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {t.leaves.applyLeave}
          </Button>
          {canManage && (
            <>
              <Button
                onClick={() => accrueLeaveBalances(new Date().getFullYear())}
                size="sm"
                variant="secondary"
                className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs cursor-pointer"
              >
                <TrendingUp className="h-4 w-4 text-primary" />
                ترحيل الاستحقاق السنوي
              </Button>
              <Button
                onClick={() => setIsAddTypeModalOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs cursor-pointer"
              >
                <Settings className="h-4 w-4 text-primary" />
                إضافة نوع إجازة
              </Button>
              <Button
                onClick={() => setIsAdjustBalanceOpen(true)}
                variant="secondary"
                size="sm"
                className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs cursor-pointer"
              >
                <Sliders className="h-4 w-4 text-primary" />
                تعديل رصيد يدوي
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Primary KPI Balance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {leaveBalances.map((bal) => (
          <div
            key={bal.leaveTypeId}
            className="classera-kpi-card p-5 shadow-xs space-y-3.5 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-foreground">
                {language === "ar" ? bal.leaveTypeNameAr : bal.leaveTypeNameEn}
              </span>
              <div
                className="h-3.5 w-3.5 rounded-full shadow-xs"
                style={{ backgroundColor: bal.color || "#004BCE" }}
              />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-foreground font-tabular-nums font-mono">{bal.availableBalance}</span>
              <span className="text-xs text-muted-foreground font-bold font-sans">يوم متاح</span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground text-center">
              <div>
                <p>المستحق السنوي</p>
                <p className="font-bold text-foreground mt-0.5 font-tabular-nums font-mono">{bal.annualEntitlement}</p>
              </div>
              <div>
                <p>المستخدم</p>
                <p className="font-bold text-foreground mt-0.5 font-tabular-nums font-mono">{bal.usedDays}</p>
              </div>
              <div>
                <p className="text-amber-600 font-semibold">المحجوز</p>
                <p className="font-bold text-amber-600 mt-0.5 font-tabular-nums font-mono">{bal.reservedDays}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="classera-tabs-strip max-w-lg">
          <TabsTrigger
            value="balances"
            className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-4"
          >
            التقويم والجدولة
          </TabsTrigger>
          <TabsTrigger
            value="types"
            className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-4"
          >
            أنواع وسياسات الإجازات
          </TabsTrigger>
          <TabsTrigger
            value="law"
            className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-4"
          >
            سياسة الإجازات واللوائح
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Calendar & Team Schedule */}
        <TabsContent value="balances" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team Leaves Calendar List */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h2 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {t.leaves.teamCalendar}
                </h2>
                <Badge variant="outline" className="text-[10px] rounded-full px-2.5 font-bold">
                  {calendarItems.length} {calendarItems.length === 1 ? "إجازة مسجلة" : "إجازات مسجلة"}
                </Badge>
              </div>

              {isCalendarLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
                  جاري تحميل جدول إجازات الفريق...
                </div>
              ) : calendarItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-2xl p-6 space-y-2">
                  <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="font-bold text-foreground">لا توجد إجازات مجدولة لفريق العمل في هذه الفترة</p>
                  <p className="text-[11px] text-muted-foreground">
                    تظهر هنا الإجازات المعتمدة وقيد الاعتماد لأعضاء الفريق بصورة آنية
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  {calendarItems.map((item) => (
                    <div
                      key={item.requestId}
                      className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className="h-10 w-10 rounded-full border border-primary/20 flex items-center justify-center font-bold text-xs shadow-xs text-white"
                          style={{ backgroundColor: item.color || "#004BCE" }}
                        >
                          {item.employeeName?.slice(0, 2) || "مو"}
                        </div>
                        <div>
                          <span className="font-bold text-foreground block">{item.employeeName}</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {item.leaveTypeName} {item.departmentName ? `• ${item.departmentName}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`text-[10px] rounded-full px-3 py-1 font-bold ${
                          item.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                            : "bg-amber-500/10 text-amber-700 border-amber-200"
                        }`}
                        variant="outline"
                      >
                        {item.startDate} إلى {item.endDate} ({item.workingDays} {item.workingDays === 1 ? "يوم عمل" : "أيام عمل"})
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leave Quick Rules */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-black text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
                <Info className="h-4 w-4 text-primary" />
                قواعد احتساب الإجازات
              </h2>
              <div className="space-y-3 text-xs text-muted-foreground font-medium leading-relaxed">
                <p>
                  • تخصم الإجازة من أيام العمل الفعلية فقط مع استبعاد عطلات نهاية الأسبوع والأعياد الرسمية للشركة.
                </p>
                <p>• يتم حجز الرصيد فور تقديم الطلب لمنع تكرار التقديم أو تجاوز الاستحقاق.</p>
                <p>
                  • عند اعتماد الطلب نهائياً، يتحول الرصيد المحجوز إلى مستخدم، وفي حال الرفض يُعاد فوراً إلى الرصيد المتاح.
                </p>
                <p>
                  • تخضع شرائح الاستحقاق والترحيل لسياسة الشركة ولائحة العمل المعتمدة لكل جهة اختصاص.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Leave Types List */}
        <TabsContent value="types" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaveTypes.map((type) => (
              <div
                key={type.id}
                className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs text-foreground">{type.nameAr}</h3>
                  <Badge
                    variant="outline"
                    className={`text-[10px] rounded-full px-2.5 font-bold ${
                      type.isPaid
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {type.isPaid ? "مدفوعة الأجر" : "بدون أجر"}
                  </Badge>
                </div>
                <div className="border-t border-border/60 pt-2.5 flex justify-between text-xs text-muted-foreground">
                  <span>الحد الأقصى السنوي:</span>
                  <span className="font-bold text-foreground font-mono">{type.maxDaysPerYear} يوماً</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Statutory & Company Leave Policies */}
        <TabsContent value="law" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              لائحة وسياسات الإجازات المعتمدة
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
                <span className="font-black text-foreground block">
                  1. الإجازة السنوية (المادة 109)
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  21 يوماً مدفوعة الأجر تزداد إلى 30 يوماً متى أمضى العامل في خدمة صاحب العمل 5
                  سنوات متصلة.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
                <span className="font-black text-foreground block">
                  2. الإجازة المرضية (المادة 117)
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  أول 30 يوماً بأجر كامل، الـ 60 يوماً التالية بثلاثة أرباع الأجر، والـ 30 يوماً
                  التي تليها بدون أجر خلال السنة الواحدة.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
                <span className="font-black text-foreground block">
                  3. إجازات المناسبات الاجتماعية (المادة 113)
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  5 أيام بأجر كامل عند زواج العامل أو وفاة الزوج أو أحد الأصول والفروع، و3 أيام عند
                  ولادة مولود جديد (أبوة).
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
                <span className="font-black text-foreground block">
                  4. إجازة الحج والامتحانات (المادة 114 و 115)
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  إجازة حج من 10 إلى 15 يوماً بأجر كامل لمرة واحدة طوال مدة الخدمة (بشرط إمضاء
                  عامين)، وإجازة مدفوعة لأداء الامتحانات.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Apply Leave Modal */}
      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {t.leaves.applyLeave}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              سيتم فحص رصيدك المتاح وحجزه وإرسال الطلب لسلسلة الموافقات
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">نوع الإجازة *</label>
              <select
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {selectedBalance && (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 flex justify-between text-xs font-semibold">
                <span>رصيدك المتاح حالياً:</span>
                <span className="text-emerald-600 font-black font-mono">
                  {selectedBalance.availableBalance} يوم
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">من تاريخ *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">إلى تاريخ *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="checkbox"
                id="halfDayCheck"
                checked={isHalfDay}
                onChange={(e) => setIsHalfDay(e.target.checked)}
                className="rounded text-primary h-4 w-4"
              />
              <label htmlFor="halfDayCheck" className="text-xs font-bold text-foreground cursor-pointer">
                إجازة نصف يوم (0.5 يوم عمل)
              </label>
            </div>

            {isHalfDay && (
              <div className="space-y-1.5 pl-4 border-r-2 border-primary/40">
                <label className="font-bold">الفترة الزمنية لنصف اليوم</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="halfDayPeriod"
                      value="first_half"
                      checked={halfDayPeriod === "first_half"}
                      onChange={() => setHalfDayPeriod("first_half")}
                    />
                    النصف الأول (صباحي)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="halfDayPeriod"
                      value="second_half"
                      checked={halfDayPeriod === "second_half"}
                      onChange={() => setHalfDayPeriod("second_half")}
                    />
                    النصف الثاني (مسائي)
                  </label>
                </div>
              </div>
            )}

            {/* Computed Working Days Preview */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-foreground">أيام العمل الفعلية المستحقة للخصم:</span>
                {isCalculatingDays ? (
                  <span className="text-muted-foreground animate-pulse">جاري الحساب...</span>
                ) : calculatedWorkingDays !== null ? (
                  <span className="font-black text-primary font-mono text-sm font-tabular-nums">
                    {calculatedWorkingDays} {calculatedWorkingDays === 1 ? "يوم" : "أيام"}
                  </span>
                ) : (
                  <span className="text-muted-foreground font-medium">حدد التواريخ لاحتساب الأيام</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                يتم احتساب أيام العمل تلقائياً مع استبعاد العطلات الرسمية وأيام الراحة الأسبوعية.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">سبب الإجازة *</label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اكتب سبب طلب الإجازة..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isSaving || isCalculatingDays || calculatedWorkingDays === null || calculatedWorkingDays <= 0}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              تأكيد وحجز الرصيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Leave Type Modal */}
      <Dialog open={isAddTypeModalOpen} onOpenChange={setIsAddTypeModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              إضافة نوع إجازة وسياسة جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد الاستحقاق السنوي وطريقة الاحتساب والقيود
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم نوع الإجازة *</label>
              <input
                type="text"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="مثال: إجازة أداء الامتحانات الدراسية"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">الاستحقاق السنوي (أيام) *</label>
              <input
                type="number"
                value={newTypeDays}
                onChange={(e) => setNewTypeDays(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">الحد الأقصى لترحيل الأيام سنوياً</label>
              <input
                type="number"
                value={newTypeCarryoverLimit}
                onChange={(e) => setNewTypeCarryoverLimit(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="paidCheck"
                  checked={newTypePaid}
                  onChange={(e) => setNewTypePaid(e.target.checked)}
                  className="rounded text-primary h-4 w-4"
                />
                <label htmlFor="paidCheck" className="text-xs font-bold text-foreground">
                  إجازة مدفوعة الأجر (Paid Leave)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="halfDayAllowedCheck"
                  checked={newTypeAllowHalfDay}
                  onChange={(e) => setNewTypeAllowHalfDay(e.target.checked)}
                  className="rounded text-primary h-4 w-4"
                />
                <label htmlFor="halfDayAllowedCheck" className="text-xs font-bold text-foreground">
                  السماح بتقديم نصف يوم
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="negativeAllowedCheck"
                  checked={newTypeAllowNegative}
                  onChange={(e) => setNewTypeAllowNegative(e.target.checked)}
                  className="rounded text-primary h-4 w-4"
                />
                <label htmlFor="negativeAllowedCheck" className="text-xs font-bold text-foreground">
                  السماح برصيد سالب (سلفة إجازات)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="attachCheck"
                  checked={newTypeRequiresAttachment}
                  onChange={(e) => setNewTypeRequiresAttachment(e.target.checked)}
                  className="rounded text-primary h-4 w-4"
                />
                <label htmlFor="attachCheck" className="text-xs font-bold text-foreground">
                  إلزامية إرفاق مستند (تقرير طبي / إثبات)
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateLeaveType}
              disabled={isCreatingType}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              {isCreatingType ? "جاري الحفظ..." : "حفظ نوع الإجازة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Modal */}
      <Dialog open={isAdjustBalanceOpen} onOpenChange={setIsAdjustBalanceOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              تعديل رصيد إجازة استثنائي (Balance Adjustment)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              إضافة أو خصم أيام رصيد مع توثيق الأسباب في سجل التدقيق المالي والإداري
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الموظف المعني *</label>
              <select
                value={adjustEmpId}
                onChange={(e) => setAdjustEmpId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                <option value="">-- اختر الموظف --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} {emp.employeeNo ? `(${emp.employeeNo})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">نوع الإجازة *</label>
              <select
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">عدد الأيام للتعديل (+ إضافة / - خصم) *</label>
              <input
                type="number"
                value={adjustDays}
                onChange={(e) => setAdjustDays(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">سبب التعديل الاستثنائي *</label>
              <textarea
                rows={2}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="مثال: رصيد تعويضي عن ساعات عمل في عطلة رسمية..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleAdjustBalance}
              disabled={isAdjustingBalance}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9"
            >
              {isAdjustingBalance ? "جاري التوثيق..." : "تأكيد وتوثيق تعديل الرصيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
