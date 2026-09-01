import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
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

export const EssMobileView: React.FC<{ onNavigate: (tabId: string) => void }> = ({
  onNavigate,
}) => {
  const { currentUser, leaveBalances, punchInOut, requests, payrollDetails, language, t } =
    useApp();

  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [certificateDestination, setCertificateDestination] = useState("سفارة / جهة حكومية");

  const handlePunch = (type: "in" | "out") => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const res = punchInOut(type, { lat: pos.coords.latitude, lng: pos.coords.longitude });
          alert(`${res.message} (GPS: ${res.geofenceValid ? "داخل مقر العمل" : "خارج النطاق"})`);
        },
        () => {
          const res = punchInOut(type);
          alert(res.message);
        },
      );
    } else {
      const res = punchInOut(type);
      alert(res.message);
    }
  };

  const handleRequestCertificate = () => {
    alert(
      `تم إصدار شهادة التعريف بالراتب الإلكترونية الموجهة إلى (${certificateDestination}) مع الختم الرقمي ورمز الاستجابة QR بنجاح!`,
    );
    setIsCertificateModalOpen(false);
  };

  const myPendingRequests = requests.filter((r) => r.requesterId === currentUser.id);
  const myPayroll = payrollDetails[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            {t.nav.ess} وتطبيق الجوال الذكي (M20)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            تجربة الخدمة الذاتية الموحدة للموظف والمدير: تسجيل الحضور بالـ GPS، متابعة الطلبات
            وقسائم الراتب
          </p>
        </div>
      </div>

      {/* Centered Mobile Phone Mockup Simulation */}
      <div className="flex justify-center">
        <div className="w-full max-w-sm rounded-[36px] border-4 border-slate-800 bg-card p-4 shadow-2xl space-y-4 relative overflow-hidden">
          {/* Phone Speaker & Camera Notch */}
          <div className="mx-auto h-4 w-28 rounded-full bg-slate-800 mb-2 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-slate-950 mr-2" />
          </div>

          {/* User Profile Card */}
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-3.5 text-primary-foreground shadow-sm">
            <img
              src={
                currentUser.avatarUrl ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
              }
              alt={currentUser.firstNameAr}
              className="h-12 w-12 rounded-full border-2 border-primary-foreground/40 object-cover shadow-sm"
            />
            <div className="truncate">
              <span className="text-xs font-bold block truncate">
                {language === "ar"
                  ? `${currentUser.firstNameAr} ${currentUser.lastNameAr}`
                  : `${currentUser.firstNameEn} ${currentUser.lastNameEn}`}
              </span>
              <p className="text-[10px] text-primary-foreground/80 truncate">
                {currentUser.jobTitleAr}
              </p>
              <p className="text-[10px] text-primary-foreground/70 font-mono mt-0.5">
                {currentUser.employeeNo}
              </p>
            </div>
          </div>

          {/* GPS Punch Card */}
          <div className="rounded-2xl border bg-muted/20 p-4 text-center space-y-3 shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-4 w-4 text-emerald-600 animate-bounce" />
              <span>المقر الرئيسي - برج العليا (الرياض)</span>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                onClick={() => handlePunch("in")}
                size="sm"
                className="h-10 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm gap-1.5"
              >
                <Clock className="h-4 w-4" />
                تسجيل دخول
              </Button>
              <Button
                onClick={() => handlePunch("out")}
                size="sm"
                variant="outline"
                className="h-10 px-5 rounded-full font-bold text-xs gap-1.5 hover:bg-muted"
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
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigate("leaves")}
                className="rounded-xl border bg-muted/10 p-3 text-start hover:border-primary/50 transition-colors"
              >
                <CalendarDays className="h-5 w-5 text-sky-500 mb-1.5" />
                <p className="text-xs font-bold text-foreground">طلب إجازة</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  رصيد: {leaveBalances[0]?.availableBalance} يوم
                </p>
              </button>

              <button
                onClick={() => onNavigate("expenses")}
                className="rounded-xl border bg-muted/10 p-3 text-start hover:border-primary/50 transition-colors"
              >
                <Receipt className="h-5 w-5 text-amber-500 mb-1.5" />
                <p className="text-xs font-bold text-foreground">رفع مصروف</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">تصوير فاتورة</p>
              </button>

              <button
                onClick={() => setIsPayslipModalOpen(true)}
                className="rounded-xl border bg-muted/10 p-3 text-start hover:border-primary/50 transition-colors"
              >
                <FileText className="h-5 w-5 text-purple-500 mb-1.5" />
                <p className="text-xs font-bold text-foreground">قسيمة الراتب</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">شهر أغسطس 2026</p>
              </button>

              <button
                onClick={() => setIsCertificateModalOpen(true)}
                className="rounded-xl border bg-muted/10 p-3 text-start hover:border-primary/50 transition-colors"
              >
                <QrCode className="h-5 w-5 text-emerald-500 mb-1.5" />
                <p className="text-xs font-bold text-foreground">شهادة تعريف</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">مصدقة رقمياً</p>
              </button>
            </div>
          </div>

          {/* My Requests Track */}
          <div className="space-y-2 border-t pt-3">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">
              آخر طلباتي
            </span>
            {myPendingRequests.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-2">
                لا توجد طلبات معلقة
              </p>
            ) : (
              myPendingRequests.slice(0, 2).map((req) => (
                <div
                  key={req.id}
                  className="rounded-lg border bg-muted/20 p-2.5 text-xs flex justify-between items-center"
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
                  <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              إصدار شهادة تعريف بالراتب فورية
            </DialogTitle>
            <DialogDescription className="text-xs">
              شهادة رسمية موثقة برمز الاستجابة السريع QR والختم المعتمد
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">الجهة الموجه إليها الخطاب *</label>
              <input
                type="text"
                value={certificateDestination}
                onChange={(e) => setCertificateDestination(e.target.value)}
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
              <p className="font-bold">بيانات الشهادة:</p>
              <p className="text-muted-foreground">
                الموظف: {currentUser.firstNameAr} {currentUser.lastNameAr}
              </p>
              <p className="text-muted-foreground">
                الراتب الأساسي: 12,000 ر.س • إجمالي الراتب: 16,000 ر.س
              </p>
              <p className="text-muted-foreground">تاريخ المباشرة: {currentUser.hireDate}</p>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleRequestCertificate}
              className="text-xs bg-primary font-bold"
            >
              توليد وتحميل الشهادة PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Payslip Modal */}
      {myPayroll && (
        <Dialog open={isPayslipModalOpen} onOpenChange={setIsPayslipModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                قسيمة الراتب الرقمية (أغسطس 2026)
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs py-2 font-mono">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span>الراتب الأساسي:</span>
                  <span>{myPayroll.basicSalary.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>بدل السكن + النقل:</span>
                  <span>
                    +{(myPayroll.housingAllowance + myPayroll.transportAllowance).toLocaleString()}{" "}
                    ر.س
                  </span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>التأمينات GOSI:</span>
                  <span>-{myPayroll.gosiEmployeeDeduction.toLocaleString()} ر.س</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-black text-sm text-primary">
                  <span>صافي الراتب:</span>
                  <span>{myPayroll.netSalary.toLocaleString()} ر.س</span>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button
                size="sm"
                onClick={() => setIsPayslipModalOpen(false)}
                className="text-xs bg-primary font-bold"
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
