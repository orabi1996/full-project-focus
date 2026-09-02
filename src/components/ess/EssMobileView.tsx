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
  const { currentUser, leaveBalances, punchInOut, requests, payrollDetails, language, t } =
    useApp();

  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [certificateDestination, setCertificateDestination] = useState("سفارة / جهة حكومية");

  const handlePunch = (type: "in" | "out") => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const res = punchInOut(type, { lat: pos.coords.latitude, lng: pos.coords.longitude });
          toast.success(`${res.message} (GPS: ${res.geofenceValid ? "داخل مقر العمل" : "خارج النطاق"})`);
        },
        () => {
          const res = punchInOut(type);
          toast.success(res.message);
        },
      );
    } else {
      const res = punchInOut(type);
      toast.success(res.message);
    }
  };

  const handleRequestCertificate = () => {
    toast.success(
      `تم إصدار شهادة التعريف بالراتب الإلكترونية الموجهة إلى (${certificateDestination}) مع الختم الرقمي ورمز الاستجابة QR بنجاح!`,
    );
    setIsCertificateModalOpen(false);
  };

  const myPendingRequests = requests.filter((r) => r.requesterId === currentUser.id);
  const myPayroll = payrollDetails[0];

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="smartphone" source="material" filled size={24} className="text-primary" />
            {t.nav.ess} وتطبيق الجوال الذكي (M18)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            تجربة الخدمة الذاتية الموحدة للموظف والمدير: تسجيل الحضور بالـ GPS، متابعة الطلبات وقسائم الراتب
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

          {/* Quick Actions Grid */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">
              خدمات سريعة
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onNavigate("leaves")}
                className="rounded-2xl border border-border/80 bg-muted/10 p-3 text-start hover:border-primary/50 transition-all hover:bg-secondary/40"
              >
                <CalendarDays className="h-5 w-5 text-sky-500 mb-1.5" />
                <p className="text-xs font-black text-foreground">طلب إجازة</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                  رصيد: {leaveBalances[0]?.availableBalance} يوم
                </p>
              </button>

              <button
                onClick={() => onNavigate("expenses")}
                className="rounded-2xl border border-border/80 bg-muted/10 p-3 text-start hover:border-primary/50 transition-all hover:bg-secondary/40"
              >
                <Receipt className="h-5 w-5 text-amber-500 mb-1.5" />
                <p className="text-xs font-black text-foreground">رفع مصروف</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">تصوير فاتورة</p>
              </button>

              <button
                onClick={() => setIsPayslipModalOpen(true)}
                className="rounded-2xl border border-border/80 bg-muted/10 p-3 text-start hover:border-primary/50 transition-all hover:bg-secondary/40"
              >
                <FileText className="h-5 w-5 text-purple-500 mb-1.5" />
                <p className="text-xs font-black text-foreground">قسيمة الراتب</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">شهر أغسطس 2026</p>
              </button>

              <button
                onClick={() => setIsCertificateModalOpen(true)}
                className="rounded-2xl border border-border/80 bg-muted/10 p-3 text-start hover:border-primary/50 transition-all hover:bg-secondary/40"
              >
                <QrCode className="h-5 w-5 text-emerald-500 mb-1.5" />
                <p className="text-xs font-black text-foreground">شهادة تعريف</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">مصدقة رقمياً</p>
              </button>
            </div>
          </div>

          {/* My Requests Track */}
          <div className="space-y-2 border-t border-border/60 pt-3">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">
              آخر طلباتي
            </span>
            {myPendingRequests.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-2 font-medium">
                لا توجد طلبات معلقة
              </p>
            ) : (
              myPendingRequests.slice(0, 2).map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-xs flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-foreground block">
                      {req.payload.leaveTypeNameAr ||
                        req.payload.categoryNameAr ||
                        req.payload.reason}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {req.referenceNo}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 rounded-full font-bold border-amber-200">
                    بانتظار المدير
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Salary Certificate Modal */}
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
                الموظف: <strong className="text-foreground">{currentUser.firstNameAr} {currentUser.lastNameAr}</strong>
              </p>
              <p className="text-muted-foreground font-mono">
                الراتب الأساسي: 12,000 ر.س • إجمالي الراتب: 16,000 ر.س
              </p>
              <p className="text-muted-foreground font-mono">تاريخ المباشرة: {currentUser.hireDate}</p>
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

      {/* Mobile Payslip Modal */}
      {myPayroll && (
        <Dialog open={isPayslipModalOpen} onOpenChange={setIsPayslipModalOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                قسيمة الراتب الرقمية (أغسطس 2026)
              </DialogTitle>
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
                <div className="flex justify-between text-destructive font-bold">
                  <span>التأمينات GOSI:</span>
                  <span>-{myPayroll.gosiEmployeeDeduction.toLocaleString()} ر.س</span>
                </div>
                <div className="border-t border-border/60 pt-2 flex justify-between font-black text-sm text-primary font-sans">
                  <span>صافي الراتب:</span>
                  <span className="font-mono">{myPayroll.netSalary.toLocaleString()} ر.س</span>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-3">
              <Button
                size="sm"
                onClick={() => setIsPayslipModalOpen(false)}
                className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
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
