import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { IconSymbol } from "../ui/IconSymbol";
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Users,
  Info,
  Sliders,
  Settings,
  ShieldCheck,
  TrendingUp,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

export const LeavesView: React.FC = () => {
  const {
    leaveBalances,
    leaveTypes,
    employees,
    applyLeave,
    addLeaveType,
    adjustLeaveBalance,
    accrueLeaveBalances,
    currentRole,
    language,
    t,
  } = useApp();
  const canManage = canManageModule(currentRole, "leaves");
  const [activeTab, setActiveTab] = useState("balances");

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);

  // Apply Form State
  const [selectedTypeId, setSelectedTypeId] = useState(leaveTypes[0]?.id || "");
  const [startDate, setStartDate] = useState("2026-09-01");
  const [endDate, setEndDate] = useState("2026-09-05");
  const [totalDays, setTotalDays] = useState(5);
  const [reason, setReason] = useState("");

  // Add Type State
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDays, setNewTypeDays] = useState(5);
  const [newTypePaid, setNewTypePaid] = useState(true);

  // Adjust Balance State
  const [adjustEmpId, setAdjustEmpId] = useState(employees[0]?.id || "");
  const [adjustDays, setAdjustDays] = useState(2);
  const [adjustReason, setAdjustReason] = useState("");

  const selectedBalance = leaveBalances.find((b) => b.leaveTypeId === selectedTypeId);

  const handleApply = () => {
    if (!reason) {
      alert("يرجى كتابة سبب الإجازة");
      return;
    }
    const success = applyLeave({
      leaveTypeId: selectedTypeId,
      startDate,
      endDate,
      totalDays,
      reason,
    });
    if (success) {
      alert("تم تقديم طلب الإجازة وحجز الرصيد بنجاح وتحويله لمسار الموافقات الإلكتروني");
      setIsApplyModalOpen(false);
      setReason("");
    } else {
      alert("عذراً، رصيدك المتاح لا يكفي لتغطية عدد الأيام المطلوبة");
    }
  };

  const handleCreateLeaveType = () => {
    if (!newTypeName) {
      alert("يرجى كتابة اسم نوع الإجازة");
      return;
    }
    addLeaveType({ nameAr: newTypeName, maxDaysPerYear: newTypeDays, isPaid: newTypePaid });
    alert(`تمت إضافة نوع الإجازة (${newTypeName}) بنجاح!`);
    setIsAddTypeModalOpen(false);
    setNewTypeName("");
  };

  const handleAdjustBalance = () => {
    if (!adjustReason) {
      alert("يرجى كتابة سبب تعديل الرصيد");
      return;
    }
    const emp = employees.find((e) => e.id === adjustEmpId);
    adjustLeaveBalance(adjustEmpId, selectedTypeId, adjustDays, adjustReason);
    alert(
      `تم تعديل الرصيد لـ (${emp?.firstNameAr} ${emp?.lastNameAr}) بمقدار ${adjustDays} يوم وتوثيقه في سجل التدقيق.`,
    );
    setIsAdjustBalanceOpen(false);
    setAdjustReason("");
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="event_available" source="material" filled size={24} className="text-primary" />
            {t.leaves.balance} وإدارة العطلات (M06)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            إدارة أرصدة الإجازات السنوية والمرضية، التقديم، وحجز الرصيد وفق معايير نظام العمل السعودي
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            onClick={() => setIsApplyModalOpen(true)}
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
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
                className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs"
              >
                <TrendingUp className="h-4 w-4 text-primary" />
                ترحيل الاستحقاق الشهري
              </Button>
              <Button
                onClick={() => setIsAddTypeModalOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
              >
                <Settings className="h-4 w-4 text-primary" />
                إضافة نوع إجازة
              </Button>
              <Button
                onClick={() => setIsAdjustBalanceOpen(true)}
                variant="secondary"
                size="sm"
                className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs"
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
            className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5 relative overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-foreground">
                {language === "ar" ? bal.leaveTypeNameAr : bal.leaveTypeNameEn}
              </span>
              <div className="h-3.5 w-3.5 rounded-full shadow-xs" style={{ backgroundColor: bal.color || "#0B57D0" }} />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-foreground">{bal.availableBalance}</span>
              <span className="text-xs text-muted-foreground font-bold">يوم متاح</span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground text-center">
              <div>
                <p>المستحق السنوي</p>
                <p className="font-bold text-foreground mt-0.5">{bal.annualEntitlement}</p>
              </div>
              <div>
                <p>المستخدم</p>
                <p className="font-bold text-foreground mt-0.5">{bal.usedDays}</p>
              </div>
              <div>
                <p className="text-amber-600 font-semibold">المحجوز</p>
                <p className="font-bold text-amber-600 mt-0.5">{bal.reservedDays}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Layout (Google M3 Tabs) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg bg-muted/60 p-1 rounded-full border border-border/60">
          <TabsTrigger value="balances" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            التقويم والجدولة
          </TabsTrigger>
          <TabsTrigger value="types" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            أنواع وسياسات الإجازات
          </TabsTrigger>
          <TabsTrigger value="law" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            نظام العمل السعودي (قوى)
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
                  {t.leaves.teamCalendar} (سبتمبر 2026)
                </h2>
                <Badge variant="outline" className="text-[10px] rounded-full px-2.5 font-bold">
                  مخطط زمني نشط
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <img
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150"
                      alt="محمد"
                      className="h-10 w-10 rounded-full border-2 border-primary/20 object-cover shadow-xs"
                    />
                    <div>
                      <span className="font-bold text-foreground block">محمد الشمري</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">إجازة سنوية مجدولة</p>
                    </div>
                  </div>
                  <Badge
                    className="bg-sky-500/10 text-sky-700 border-sky-200 text-[10px] rounded-full px-3 py-1 font-bold"
                    variant="outline"
                  >
                    5 سبتمبر - 12 سبتمبر (6 أيام عمل)
                  </Badge>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <img
                      src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"
                      alt="نورة"
                      className="h-10 w-10 rounded-full border-2 border-primary/20 object-cover shadow-xs"
                    />
                    <div>
                      <span className="font-bold text-foreground block">نورة القحطاني</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">إجازة سنوية معتمدة</p>
                    </div>
                  </div>
                  <Badge
                    className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[10px] rounded-full px-3 py-1 font-bold"
                    variant="outline"
                  >
                    15 سبتمبر - 20 سبتمبر (5 أيام عمل)
                  </Badge>
                </div>
              </div>
            </div>

            {/* Leave Quick Rules */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-black text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
                <Info className="h-4 w-4 text-primary" />
                قواعد احتساب الإجازات
              </h2>
              <div className="space-y-3 text-xs text-muted-foreground font-medium leading-relaxed">
                <p>• الإجازة السنوية تخصم من أيام العمل الفعلية فقط مع استبعاد عطلات نهاية الأسبوع والأعياد الرسمية.</p>
                <p>• يتم حجز الرصيد فور تقديم الطلب لمنع تكرار التقديم أو تجاوزه.</p>
                <p>• الإجازات المرضية تخضع لشرائح نظام العمل السعودي (أول 30 يوم بأجر كامل، 60 يوم بثلاثة أرباع الأجر).</p>
                <p>• الحد الأقصى لترحيل الإجازة السنوية للعام القادم هو 10 أيام عمل بموافقة صاحب العمل.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Leave Types List */}
        <TabsContent value="types" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaveTypes.map((type) => (
              <div key={type.id} className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3 hover:border-primary/40 transition-all">
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
                  <span className="font-bold text-foreground">{type.maxDaysPerYear} يوماً</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Saudi Labor Law Leave Policies */}
        <TabsContent value="law" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              لائحة الإجازات الرسمية المعتمدة وفق نظام العمل السعودي (منصة قوى)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
                <span className="font-black text-foreground block">1. الإجازة السنوية (المادة 109)</span>
                <p className="text-muted-foreground leading-relaxed">
                  21 يوماً مدفوعة الأجر تزداد إلى 30 يوماً متى أمضى العامل في خدمة صاحب العمل 5 سنوات متصلة.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
                <span className="font-black text-foreground block">2. الإجازة المرضية (المادة 117)</span>
                <p className="text-muted-foreground leading-relaxed">
                  أول 30 يوماً بأجر كامل، الـ 60 يوماً التالية بثلاثة أرباع الأجر، والـ 30 يوماً التي تليها بدون أجر خلال السنة الواحدة.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
                <span className="font-black text-foreground block">3. إجازات المناسبات الاجتماعية (المادة 113)</span>
                <p className="text-muted-foreground leading-relaxed">
                  5 أيام بأجر كامل عند زواج العامل أو وفاة الزوج أو أحد الأصول والفروع، و3 أيام عند ولادة مولود جديد (أبوة).
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
                <span className="font-black text-foreground block">4. إجازة الحج والامتحانات (المادة 114 و 115)</span>
                <p className="text-muted-foreground leading-relaxed">
                  إجازة حج من 10 إلى 15 يوماً بأجر كامل لمرة واحدة طوال مدة الخدمة (بشرط إمضاء عامين)، وإجازة مدفوعة لأداء الامتحانات.
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
                <span className="text-emerald-600 font-black">
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

            <div className="space-y-1.5">
              <label className="font-bold">عدد أيام الإجازة *</label>
              <input
                type="number"
                min="1"
                max="30"
                value={totalDays}
                onChange={(e) => setTotalDays(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
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
            <Button size="sm" onClick={handleApply} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              تأكيد وإرسال الطلب
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
              تحديد الاستحقاق السنوي وطريقة الاحتساب
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
              <label className="font-bold">الحد الأقصى للأيام سنوياً *</label>
              <input
                type="number"
                value={newTypeDays}
                onChange={(e) => setNewTypeDays(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="paidCheck"
                checked={newTypePaid}
                onChange={(e) => setNewTypePaid(e.target.checked)}
                className="rounded text-primary h-4 w-4"
              />
              <label htmlFor="paidCheck" className="text-xs font-bold text-foreground">
                إجازة مدفوعة الأجر بالكامل (Paid Leave)
              </label>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateLeaveType}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              حفظ نوع الإجازة
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
              إضافة أو خصم أيام رصيد مع توثيق الأسباب في سجل التدقيق
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
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr}
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
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9"
            >
              تأكيد وتوثيق تعديل الرصيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
