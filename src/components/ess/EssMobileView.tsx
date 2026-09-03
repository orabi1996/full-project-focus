import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { IconSymbol } from "../ui/IconSymbol";
import {
  Smartphone,
  Clock,
  CalendarDays,
  Receipt,
  FileText,
  DollarSign,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Shield,
  Sparkles,
  QrCode,
  Download,
  Send,
  Plus,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";

export const EssMobileView: React.FC<{ onNavigate: (tabId: string) => void }> = ({
  onNavigate,
}) => {
  const {
    currentUser,
    leaveBalances,
    leaveTypes,
    punchInOut,
    requests,
    payrollDetails,
    company,
    applyLeave,
    submitAttendanceCorrection,
    language,
    t,
    isSaving,
  } = useApp();

  // Dialog States
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isQuickLeaveModalOpen, setIsQuickLeaveModalOpen] = useState(false);
  const [isPunchCorrectionModalOpen, setIsPunchCorrectionModalOpen] = useState(false);

  // Certificate State
  const [certificateDestination, setCertificateDestination] = useState("سفارة / جهة حكومية / بنك");

  // Quick Leave Form State
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id || "");
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().slice(0, 10));
  const [leaveDays, setLeaveDays] = useState(3);
  const [leaveReason, setLeaveReason] = useState("");

  // Punch Correction Form State
  const [corrDate, setCorrDate] = useState(new Date().toISOString().slice(0, 10));
  const [corrPunchType, setCorrPunchType] = useState<"check_in" | "check_out">("check_in");
  const [corrTime, setCorrTime] = useState("08:30");
  const [corrReason, setCorrReason] = useState("");

  const handlePunch = (type: "in" | "out") => {
    if (isSaving) return;
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const res = await punchInOut(type, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          if (res.success) {
            toast.success(
              `${res.message} (GPS: ${res.geofenceValid ? "داخل نطاق مقر العمل" : "خارج النطاق"})`,
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

  const handleRequestCertificate = () => {
    toast.success(
      `تم إصدار شهادة التعريف بالراتب الإلكترونية الموجهة إلى (${certificateDestination}) مع الختم الرقمي ورمز الاستجابة QR بنجاح!`,
    );
    setIsCertificateModalOpen(false);
  };

  const handleSubmitQuickLeave = async () => {
    if (isSaving) return;
    if (!leaveReason.trim()) {
      toast.error("يرجى كتابة سبب الإجازة");
      return;
    }
    const success = await applyLeave({
      leaveTypeId,
      startDate: leaveStart,
      endDate: leaveEnd,
      totalDays: Number(leaveDays),
      reason: leaveReason,
    });
    if (success) {
      setIsQuickLeaveModalOpen(false);
      setLeaveReason("");
    }
  };

  const handleSubmitPunchCorrection = () => {
    if (!corrReason.trim()) {
      toast.error("يرجى كتابة مبرر تصحيح البصمة");
      return;
    }
    submitAttendanceCorrection({
      workDate: corrDate,
      correctIn: corrPunchType === "check_in" ? corrTime : undefined,
      correctOut: corrPunchType === "check_out" ? corrTime : undefined,
      reason: corrReason,
    });
    toast.success("تم إرسال طلب تصحيح البصمة لمسار الاعتماد بنجاح!");
    setIsPunchCorrectionModalOpen(false);
    setCorrReason("");
  };

  const myPendingRequests = requests.filter((r) => r.requesterId === currentUser.id);
  const myPayroll = payrollDetails[0];
  const annualBalance =
    leaveBalances.find((b) => b.leaveTypeId.includes("annual")) || leaveBalances[0];

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol
              name="smartphone"
              source="material"
              filled
              size={26}
              className="text-primary"
            />
            بوابة الخدمة الذاتية وتطبيق الجوال الذكي (M07)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            تجربة الخدمة الذاتية الموحدة للموظف: تسجيل الحضور بالـ GPS، تقديم الإجازات، قسيمة
            الراتب، وشهادات التعريف
          </p>
        </div>
      </div>

      {/* Centered Mobile Phone Mockup Simulation */}
      <div className="flex justify-center py-2">
        <div className="w-full max-w-sm rounded-[44px] border-[6px] border-slate-900 bg-card p-5 shadow-2xl space-y-4 relative overflow-hidden ring-4 ring-primary/20">
          {/* Phone Speaker & Dynamic Island Notch */}
          <div className="mx-auto h-5 w-32 rounded-full bg-slate-900 mb-2 flex items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-slate-950 mr-2" />
          </div>

          {/* User Profile Card */}
          <div className="flex items-center gap-3 rounded-3xl bg-gradient-to-r from-primary via-primary/95 to-primary/80 p-4 text-primary-foreground shadow-md">
            <img
              src={
                currentUser.avatarUrl ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
              }
              alt={currentUser.firstNameAr}
              className="h-12 w-12 rounded-full border-2 border-white/40 object-cover shadow-sm"
            />
            <div className="truncate">
              <span className="text-xs font-black block truncate">
                {language === "ar"
                  ? `${currentUser.firstNameAr} ${currentUser.lastNameAr}`
                  : `${currentUser.firstNameEn} ${currentUser.lastNameEn}`}
              </span>
              <p className="text-[10px] text-primary-foreground/80 truncate font-medium">
                {currentUser.jobTitleAr}
              </p>
              <p className="text-[10px] text-primary-foreground/70 font-mono mt-0.5">
                {currentUser.employeeNo}
              </p>
            </div>
          </div>

          {/* GPS Punch Card */}
          <div className="rounded-3xl border border-border/80 bg-muted/20 p-4 text-center space-y-3.5 shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <MapPin className="h-4 w-4 text-emerald-600 animate-bounce" />
              <span>المقر الرئيسي - برج العليا (الرياض)</span>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                onClick={() => handlePunch("in")}
                size="sm"
                className="h-10 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs gap-1.5"
              >
                <Clock className="h-4 w-4" />
                تسجيل دخول
              </Button>
              <Button
                onClick={() => handlePunch("out")}
                size="sm"
                variant="outline"
                className="h-10 px-5 rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary"
              >
                <Clock className="h-4 w-4 text-amber-600" />
                تسجيل خروج
              </Button>
            </div>
          </div>

          {/* Quick Leave Balance Pill */}
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 flex justify-between items-center text-xs">
            <div>
              <span className="text-muted-foreground text-[10px] block font-medium">
                رصيد إجازتك السنوية:
              </span>
              <span className="font-black text-foreground text-sm font-mono">
                {annualBalance?.availableBalance ?? 21} يوم متاح
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsQuickLeaveModalOpen(true)}
              className="h-7 text-[11px] font-bold rounded-full border-primary/30 text-primary px-3 hover:bg-secondary"
            >
              <Plus className="h-3 w-3 mr-1" />
              طلب إجازة
            </Button>
          </div>

          {/* Quick Actions Grid */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">
              خدمات الموظف الذاتية
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsQuickLeaveModalOpen(true)}
                className="rounded-2xl border border-border/80 bg-muted/10 p-3 text-start hover:border-primary/50 transition-all hover:bg-secondary/40 cursor-pointer"
              >
                <CalendarDays className="h-5 w-5 text-sky-500 mb-1.5" />
                <p className="text-xs font-black text-foreground">طلب إجازة</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">تقديم فوري</p>
              </button>

              <button
                type="button"
                onClick={() => setIsPunchCorrectionModalOpen(true)}
                className="rounded-2xl border border-border/80 bg-muted/10 p-3 text-start hover:border-primary/50 transition-all hover:bg-secondary/40 cursor-pointer"
              >
                <Clock className="h-5 w-5 text-amber-500 mb-1.5" />
                <p className="text-xs font-black text-foreground">تصحيح بصمة</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">نسيان تسجيل</p>
              </button>

              <button
                type="button"
                onClick={() => setIsPayslipModalOpen(true)}
                className="rounded-2xl border border-border/80 bg-muted/10 p-3 text-start hover:border-primary/50 transition-all hover:bg-secondary/40 cursor-pointer"
              >
                <FileText className="h-5 w-5 text-purple-500 mb-1.5" />
                <p className="text-xs font-black text-foreground">قسيمة الراتب</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">كشف معتمد</p>
              </button>

              <button
                type="button"
                onClick={() => setIsCertificateModalOpen(true)}
                className="rounded-2xl border border-border/80 bg-muted/10 p-3 text-start hover:border-primary/50 transition-all hover:bg-secondary/40 cursor-pointer"
              >
                <QrCode className="h-5 w-5 text-emerald-500 mb-1.5" />
                <p className="text-xs font-black text-foreground">شهادة تعريف</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">مصدقة بـ QR</p>
              </button>
            </div>
          </div>

          {/* My Requests Track */}
          <div className="space-y-2 border-t border-border/60 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">
                آخر طلباتي ومسار الاعتماد
              </span>
              <button
                type="button"
                onClick={() => onNavigate("workflow")}
                className="text-[10px] text-primary font-bold hover:underline"
              >
                عرض الكل
              </button>
            </div>

            {myPendingRequests.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-2 font-medium">
                لا توجد طلبات معلقة حالياً
              </p>
            ) : (
              myPendingRequests.slice(0, 3).map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-border/70 bg-muted/20 p-2.5 text-xs flex justify-between items-center"
                >
                  <div className="truncate max-w-[170px]">
                    <span className="font-bold text-foreground block truncate">
                      {req.payload.leaveTypeNameAr ||
                        req.payload.categoryNameAr ||
                        req.payload.reason ||
                        req.type}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {req.referenceNo}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] rounded-full font-bold shrink-0 ${
                      req.status === "approved"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : req.status === "rejected"
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {req.status === "approved"
                      ? "معتمد"
                      : req.status === "rejected"
                        ? "مرفوض"
                        : "قيد المراجعة"}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: Quick Leave Request */}
      <Dialog open={isQuickLeaveModalOpen} onOpenChange={setIsQuickLeaveModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              تقديم طلب إجازة سريعة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              سيتم إرسال الطلب لمديرك المباشر تلقائياً للموافقة والاعتماد
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">نوع الإجازة *</label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameAr} ({t.maxDaysPerYear} يوم سنوي)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ البدء *</label>
                <input
                  type="date"
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ النهاية *</label>
                <input
                  type="date"
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">عدد الأيام المطلوبة *</label>
              <input
                type="number"
                min={1}
                value={leaveDays}
                onChange={(e) => setLeaveDays(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">سبب الإجازة *</label>
              <textarea
                rows={2}
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="اكتب سبب طلب الإجازة..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleSubmitQuickLeave}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-9"
            >
              إرسال طلب الإجازة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Quick Punch Regularization */}
      <Dialog open={isPunchCorrectionModalOpen} onOpenChange={setIsPunchCorrectionModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              طلب تصحيح بصمة حضور / انصراف
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              في حال تعذر تسجيل البصمة أو وجود عطل فني في جهاز البصمة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ البصمة *</label>
                <input
                  type="date"
                  value={corrDate}
                  onChange={(e) => setCorrDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">نوع البصمة *</label>
                <select
                  value={corrPunchType}
                  onChange={(e) => setCorrPunchType(e.target.value as any)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="check_in">بصمة حضور (صباحي)</option>
                  <option value="check_out">بصمة انصراف (مسائي)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">التوقيت الفعلي *</label>
              <input
                type="time"
                value={corrTime}
                onChange={(e) => setCorrTime(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">مبرر التصحيح *</label>
              <textarea
                rows={2}
                value={corrReason}
                onChange={(e) => setCorrReason(e.target.value)}
                placeholder="مثال: مهمة عمل خارجية، عطل في جهاز البصمة..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleSubmitPunchCorrection}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-9"
            >
              إرسال طلب التصحيح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Salary Certificate Modal */}
      <Dialog open={isCertificateModalOpen} onOpenChange={setIsCertificateModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              إصدار شهادة تعريف بالراتب فورية
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              شهادة رسمية موثقة برمز الاستجابة السريع QR والختم المعتمد
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الجهة الموجه إليها الخطاب *</label>
              <input
                type="text"
                value={certificateDestination}
                onChange={(e) => setCertificateDestination(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5 text-xs">
              <p className="font-bold text-foreground">بيانات الشهادة:</p>
              <p className="text-muted-foreground">
                الموظف:{" "}
                <strong className="text-foreground">
                  {currentUser.firstNameAr} {currentUser.lastNameAr}
                </strong>
              </p>
              <p className="text-muted-foreground font-mono">
                الراتب الأساسي: 12,000 ر.س • إجمالي الراتب: 16,000 ر.س
              </p>
              <p className="text-muted-foreground font-mono">
                تاريخ المباشرة: {currentUser.hireDate}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleRequestCertificate}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              توليد وتحميل الشهادة PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Mobile Payslip Modal with Overtime & Print */}
      {myPayroll && (
        <Dialog open={isPayslipModalOpen} onOpenChange={setIsPayslipModalOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                قسيمة الراتب الرقمية المعتمدة
              </DialogTitle>
              <DialogDescription className="text-xs font-medium">
                {company.legalNameAr} • شهر أغسطس 2026
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs py-2 font-mono">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
                <div className="flex justify-between">
                  <span>الراتب الأساسي:</span>
                  <span className="font-bold">{myPayroll.basicSalary.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>بدل السكن + النقل:</span>
                  <span>
                    +{(myPayroll.housingAllowance + myPayroll.transportAllowance).toLocaleString()}{" "}
                    ر.س
                  </span>
                </div>
                {myPayroll.overtimeAmount > 0 && (
                  <div className="flex justify-between text-primary font-bold">
                    <span>بدل ساعات إضافية (م107):</span>
                    <span>+{myPayroll.overtimeAmount.toLocaleString()} ر.س</span>
                  </div>
                )}
                <div className="flex justify-between text-destructive font-bold">
                  <span>التأمينات GOSI:</span>
                  <span>-{myPayroll.gosiEmployeeDeduction.toLocaleString()} ر.س</span>
                </div>
                {myPayroll.loanInstallmentDeduction > 0 && (
                  <div className="flex justify-between text-destructive font-bold">
                    <span>استقطاع السلفة الشهرية:</span>
                    <span>-{myPayroll.loanInstallmentDeduction.toLocaleString()} ر.س</span>
                  </div>
                )}
                <div className="border-t border-border/60 pt-2 flex justify-between font-black text-sm text-primary font-sans">
                  <span>صافي الراتب المحول:</span>
                  <span className="font-mono">{myPayroll.netSalary.toLocaleString()} ر.س</span>
                </div>
              </div>

              {/* Security Seal */}
              <div className="p-2.5 rounded-2xl bg-secondary/50 border border-primary/20 flex items-center justify-between text-[10px] font-sans">
                <div className="flex items-center gap-1.5 text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>معتمد ومصادق إلكترونياً</span>
                </div>
                <Badge
                  variant="outline"
                  className="font-mono text-[9px] border-emerald-300 text-emerald-700"
                >
                  WPS VERIFIED
                </Badge>
              </div>
            </div>

            <DialogFooter className="flex gap-2 mt-2">
              <Button
                size="sm"
                onClick={() => window.print()}
                variant="outline"
                className="flex-1 text-xs font-bold gap-1.5 rounded-full h-9"
              >
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
              <Button
                size="sm"
                onClick={() => setIsPayslipModalOpen(false)}
                className="flex-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full h-9"
              >
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
