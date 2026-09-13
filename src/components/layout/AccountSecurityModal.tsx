import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import {
  ShieldCheck,
  KeyRound,
  Bell,
  Sliders,
  Smartphone,
  Laptop,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Globe,
  Copy,
  QrCode,
  AlertTriangle,
  Loader2,
  Trash2,
  Check,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/context/AppContext";
import { useAuth } from "../../lib/auth/AuthContext";
import {
  changeUserPassword,
  validatePasswordStrength,
  terminateOtherSessions,
  reauthenticateUser,
  recordSecurityAuditEvent,
} from "../../lib/auth/security";
import {
  enrollTotpFactor,
  verifyMfaFactor,
  unenrollMfaFactor,
  type EnrolledTotpData,
} from "../../lib/auth/mfa";

interface AccountSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

const NOTIFS_STORAGE_KEY = "hrms_notification_preferences";

function getBrowserClientSummary(): string {
  if (typeof navigator === "undefined") return "متصفح الويب الحالي";
  const ua = navigator.userAgent;
  let browser = "متصفح غير محدد";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "متصفح Chrome";
  else if (ua.includes("Edg")) browser = "متصفح Microsoft Edge";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "متصفح Safari";
  else if (ua.includes("Firefox")) browser = "متصفح Firefox";

  let os = "نظام تشغيل حديث";
  if (ua.includes("Windows")) os = "نظام Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "نظام macOS";
  else if (ua.includes("Linux")) os = "نظام Linux";
  else if (ua.includes("Android")) os = "نظام Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "نظام iOS";

  return `${browser} على ${os}`;
}

export const AccountSecurityModal: React.FC<AccountSecurityModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const { language, setLanguage, currentUser } = useApp();
  const { session, isDemo, mfaFactors, refreshMfaState } = useAuth();

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // MFA state
  const verifiedTotpFactor = mfaFactors.find(
    (f) => f.factor_type === "totp" && f.status === "verified",
  );
  const is2FAActive = Boolean(verifiedTotpFactor);

  // MFA Enrollment Modal/Flow states
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);
  const [enrolledData, setEnrolledData] = useState<EnrolledTotpData | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // MFA Removal Modal state
  const [isUnenrollingMfa, setIsUnenrollingMfa] = useState(false);
  const [unenrollPassword, setUnenrollPassword] = useState("");
  const [isRemovingMfa, setIsRemovingMfa] = useState(false);

  // Session termination state
  const [isTerminatingSessions, setIsTerminatingSessions] = useState(false);

  // Notification preferences state
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(false);
  const [systemPushAlerts, setSystemPushAlerts] = useState(false);

  // Restore saved notification preferences
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(NOTIFS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.email === "boolean") setEmailAlerts(parsed.email);
        if (typeof parsed.whatsapp === "boolean") setWhatsappAlerts(parsed.whatsapp);
        if (typeof parsed.push === "boolean") setSystemPushAlerts(parsed.push);
      }
    } catch {
      // ignore
    }
  }, []);

  const strength = validatePasswordStrength(newPassword);

  // Real password change handler
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isDemo) {
      toast.info("الوضع التجريبي (عرض فقط) - عمليات تغيير كلمة المرور معطلة في هذا الوضع لحماية النظام.");
      return;
    }

    if (!currentPassword) {
      toast.error("يرجى إدخال كلمة المرور الحالية لتأكيد هويتك");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("يجب ألا تقل كلمة المرور الجديدة عن 8 خانات");
      return;
    }

    if (!strength.valid) {
      toast.error(strength.error || "كلمة المرور الجديدة لا تستوفي معايير القوة المطلوبة");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("كلمة المرور الجديدة غير متطابقة مع التأكيد");
      return;
    }

    setIsUpdatingPassword(true);

    const result = await changeUserPassword(currentPassword, newPassword);

    if (result.error) {
      toast.error(result.error);
    } else {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("تم تحديث كلمة المرور بنجاح وتأمين الحساب في منظومة Supabase!");
    }

    setIsUpdatingPassword(false);
  };

  // Start real TOTP MFA enrollment
  const handleStartMfaEnrollment = async () => {
    if (isDemo) {
      toast.info("الوضع التجريبي للعرض فقط - تفعيل المصادقة الثنائية يتطلب جلسة موثقة في بيئة الإنتاج.");
      return;
    }

    setIsEnrollingMfa(true);
    const result = await enrollTotpFactor("Classera Pulse Authenticator");

    if (result.error || !result.data) {
      toast.error(result.error || "تعذر بدء إعداد المصادقة الثنائية");
      setIsEnrollingMfa(false);
      return;
    }

    setEnrolledData(result.data);
    setMfaCode("");
    void recordSecurityAuditEvent("MFA_ENROLLMENT_STARTED", "بدأ المستخدم مسار تسجيل عامل مصادقة ثنائية جديد.");
  };

  // Verify and confirm enrolled MFA factor
  const handleVerifyMfaEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrolledData) return;

    const cleanCode = mfaCode.trim().replace(/\s+/g, "");
    if (cleanCode.length !== 6) {
      toast.error("يرجى إدخال الرمز كاملاً المكون من 6 أرقام من تطبيق المصادقة");
      return;
    }

    setIsVerifyingMfa(true);
    const result = await verifyMfaFactor(enrolledData.id, cleanCode);

    if (result.error) {
      toast.error(result.error);
    } else {
      await refreshMfaState();
      void recordSecurityAuditEvent("MFA_ENABLED", "تم تفعيل وتأكيد عامل المصادقة الثنائية (TOTP) بنجاح.");
      toast.success("تم تفعيل وتأكيد المصادقة الثنائية (TOTP) بنجاح لحسابك!");
      setEnrolledData(null);
      setIsEnrollingMfa(false);
    }

    setIsVerifyingMfa(false);
  };

  // Cancel MFA enrollment and clean up unverified factor
  const handleCancelMfaEnrollment = async () => {
    if (enrolledData?.id) {
      void unenrollMfaFactor(enrolledData.id);
    }
    setEnrolledData(null);
    setIsEnrollingMfa(false);
    setMfaCode("");
  };

  // Copy secret key to clipboard
  const handleCopySecret = () => {
    if (!enrolledData?.secret) return;
    void navigator.clipboard.writeText(enrolledData.secret);
    setCopiedSecret(true);
    toast.success("تم نسخ المفتاح السري إلى الحافظة بنجاح");
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  // Unenroll MFA factor after password re-authentication
  const handleConfirmUnenrollMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedTotpFactor) return;

    if (!unenrollPassword) {
      toast.error("يرجى إدخال كلمة المرور الحالية لتأكيد إلغاء حماية الحساب");
      return;
    }

    setIsRemovingMfa(true);

    // Re-authenticate sensitive action
    const reauth = await reauthenticateUser(unenrollPassword);
    if (!reauth.success) {
      toast.error(reauth.error || "تعذر التحقق من كلمة المرور الحالية");
      setIsRemovingMfa(false);
      return;
    }

    const result = await unenrollMfaFactor(verifiedTotpFactor.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      await refreshMfaState();
      void recordSecurityAuditEvent("MFA_DISABLED", "تم إلغاء وحذف عامل المصادقة الثنائية بعد إعادة التوثيق.");
      toast.success("تم إيقاف وحذف عامل المصادقة الثنائية بنجاح.");
      setIsUnenrollingMfa(false);
      setUnenrollPassword("");
    }

    setIsRemovingMfa(false);
  };

  // Terminate all other sessions via Supabase
  const handleTerminateOtherSessions = async () => {
    if (isDemo) {
      toast.info("الوضع التجريبي (عرض فقط) - لا توجد جلسات أخرى لإنهاء صلاحيتها.");
      return;
    }

    setIsTerminatingSessions(true);
    const result = await terminateOtherSessions();

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("تم تسجيل الخروج بنجاح من كافة الأجهزة والجلسات الأخرى عبر Supabase!");
    }

    setIsTerminatingSessions(false);
  };

  // Save notification preferences
  const handleSaveNotifications = () => {
    try {
      localStorage.setItem(
        NOTIFS_STORAGE_KEY,
        JSON.stringify({
          email: emailAlerts,
          whatsapp: whatsappAlerts,
          push: systemPushAlerts,
        }),
      );
      toast.success("تم حفظ تفضيلات الإشعارات بنجاح");
    } catch {
      toast.error("تعذر حفظ التفضيلات محلياً");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-3xl p-6 sm:p-7 shadow-2xl border-border/80" dir="rtl">
        <DialogHeader className="text-start space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black">
                  إعدادات الحساب والأمان الشخصي
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground">
                  إدارة حماية الحساب، كلمة المرور، والمصادقة الثنائية لـ ({userEmail})
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] font-bold">
              معرف الحساب: {session?.user?.id ? session.user.id.slice(0, 8).toUpperCase() : currentUser.id.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        {isDemo && (
          <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800 flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-600" />
            <span>الوضع التجريبي (عرض فقط) - العمليات الأمنية وتغيير كلمات المرور معطلة في هذا الوضع لحماية بيئة النظام.</span>
          </div>
        )}

        <Tabs defaultValue="security" className="mt-3">
          <TabsList className="grid grid-cols-3 h-11 rounded-2xl bg-muted/50 p-1">
            <TabsTrigger
              value="security"
              className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-xs"
            >
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              الأمان وكلمة المرور
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-xs"
            >
              <Bell className="h-3.5 w-3.5 text-primary" />
              تفضيلات الإشعارات
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-xs"
            >
              <Sliders className="h-3.5 w-3.5 text-primary" />
              التفضيلات واللغة
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Password & Security */}
          <TabsContent value="security" className="space-y-4 pt-3">
            {/* Real Password Change Form */}
            <form onSubmit={handleUpdatePassword} className="space-y-3.5 rounded-2xl border border-border/70 p-4 bg-muted/20">
              <h4 className="text-xs font-black flex items-center gap-1.5 text-foreground">
                <Lock className="h-3.5 w-3.5 text-primary" />
                تغيير كلمة المرور (موثق عبر Supabase)
              </h4>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">
                  كلمة المرور الحالية *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isUpdatingPassword}
                    className="w-full h-9 rounded-xl border border-border/80 bg-card px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">
                    كلمة المرور الجديدة *
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8 خانات على الأقل"
                    disabled={isUpdatingPassword}
                    className="w-full h-9 rounded-xl border border-border/80 bg-card px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">
                    تأكيد كلمة المرور الجديدة *
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال الجديدة"
                    disabled={isUpdatingPassword}
                    className="w-full h-9 rounded-xl border border-border/80 bg-card px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Real Strength Bar */}
              {newPassword && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>قوة كلمة المرور:</span>
                    <span className="text-primary">{strength.label}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${strength.color} transition-all duration-300`}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                size="sm"
                disabled={isUpdatingPassword || !currentPassword || !newPassword}
                className="rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-4 gap-1.5"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>جارٍ التحقق والتحديث…</span>
                  </>
                ) : (
                  <span>تحديث كلمة المرور</span>
                )}
              </Button>
            </form>

            {/* Real TOTP MFA Management */}
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-3 text-start">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-black">
                      المصادقة الثنائية عبر تطبيق المصادقة (TOTP MFA)
                    </span>
                    {is2FAActive ? (
                      <Badge className="text-[10px] font-bold rounded-full bg-emerald-600 text-white gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        مفعل ومؤكد
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-bold rounded-full text-slate-500">
                        غير مفعل
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    توليد رمز أمان إضافي مؤقت عبر تطبيقات المصادقة المتوافقة (Google Authenticator, Microsoft Authenticator, 1Password, etc.).
                  </p>
                </div>

                {!is2FAActive && !enrolledData && (
                  <Button
                    size="sm"
                    onClick={handleStartMfaEnrollment}
                    disabled={isEnrollingMfa}
                    className="rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-8 px-4"
                  >
                    {isEnrollingMfa ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        <span>جارٍ التجهيز…</span>
                      </>
                    ) : (
                      <span>تفعيل المصادقة الثنائية</span>
                    )}
                  </Button>
                )}

                {is2FAActive && !isUnenrollingMfa && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsUnenrollingMfa(true)}
                    className="rounded-full text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 shrink-0 h-8 px-3 gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>إيقاف المصادقة</span>
                  </Button>
                )}
              </div>

              {/* MFA Active Details */}
              {is2FAActive && verifiedTotpFactor && (
                <div className="p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold block text-foreground">
                        {verifiedTotpFactor.friendly_name || "تطبيق المصادقة (TOTP)"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        المعرف: {verifiedTotpFactor.id.slice(0, 12)}… • تاريخ الربط:{" "}
                        {new Date(verifiedTotpFactor.created_at).toLocaleDateString("ar-SA")}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    AAL2 Secured
                  </Badge>
                </div>
              )}

              {/* Unenroll Confirmation Panel */}
              {isUnenrollingMfa && (
                <form onSubmit={handleConfirmUnenrollMfa} className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <span>تأكيد إيقاف المصادقة الثنائية (عملية حساسة)</span>
                  </div>
                  <p className="text-[11px] text-red-700">
                    سيؤدي إيقاف المصادقة الثنائية إلى تقليل مستوى حماية حسابك. يرجى إدخال كلمة المرور الحالية لتأكيد الإجراء.
                  </p>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-red-900 block">
                      كلمة المرور الحالية *
                    </label>
                    <input
                      type="password"
                      value={unenrollPassword}
                      onChange={(e) => setUnenrollPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isRemovingMfa}
                      className="w-full h-8 rounded-lg border border-red-300 bg-white px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isRemovingMfa || !unenrollPassword}
                      className="rounded-full text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 h-7 px-4 gap-1.5"
                    >
                      {isRemovingMfa ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>جارٍ التحقق والإلغاء…</span>
                        </>
                      ) : (
                        <span>تأكيد الإلغاء</span>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsUnenrollingMfa(false);
                        setUnenrollPassword("");
                      }}
                      className="rounded-full text-xs font-bold text-slate-600 h-7 px-3"
                    >
                      تراجع
                    </Button>
                  </div>
                </form>
              )}

              {/* MFA Enrollment Step-by-Step Flow */}
              {enrolledData && (
                <div className="p-4 rounded-2xl bg-card border border-primary/30 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-primary" />
                      <h5 className="text-xs font-black text-foreground">
                        إعداد تطبيق المصادقة (خطوة 2 من 2)
                      </h5>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelMfaEnrollment}
                      className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      إلغاء الإعداد
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* QR Code */}
                    <div className="flex flex-col items-center p-3 rounded-xl bg-white border border-slate-200">
                      <img
                        src={enrolledData.qrCode}
                        alt="TOTP QR Code"
                        className="w-36 h-36 object-contain rounded-lg shadow-2xs"
                      />
                      <span className="text-[10px] text-slate-500 font-bold mt-2">
                        امسح الرمز عبر تطبيق المصادقة
                      </span>
                    </div>

                    {/* Manual Secret Key */}
                    <div className="space-y-2.5 text-xs">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        افتح تطبيق المصادقة المفضل لديك، ثم امسح رمز الـ QR أعلاه أو أدخل المفتاح السري التالي يدوياً:
                      </p>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">
                          المفتاح السري (Secret Key):
                        </label>
                        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50 border border-border font-mono text-[11px] select-all">
                          <span className="truncate flex-1 text-primary font-bold">
                            {enrolledData.secret}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleCopySecret}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            title="نسخ المفتاح"
                          >
                            {copiedSecret ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Form */}
                  <form onSubmit={handleVerifyMfaEnrollment} className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-center gap-3">
                    <div className="w-full sm:w-auto flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground block">
                        أدخل الرمز المكون من 6 أرقام لتأكيد الربط:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        disabled={isVerifyingMfa}
                        className="w-full h-9 rounded-xl border border-border bg-background px-3 text-center font-mono font-bold tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        autoFocus
                      />
                    </div>

                    <div className="w-full sm:w-auto flex items-center gap-2 sm:self-end">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isVerifyingMfa || mfaCode.length !== 6}
                        className="flex-1 sm:flex-initial rounded-full text-xs font-bold bg-primary text-primary-foreground h-9 px-5 gap-1.5"
                      >
                        {isVerifyingMfa ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>جارٍ التحقق…</span>
                          </>
                        ) : (
                          <span>تأكيد وتفعيل MFA</span>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Real Active Session & Real Terminate Other Sessions */}
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-3 text-start">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-primary" />
                  <span className="text-xs font-black">الجلسة الحالية وأمان الأجهزة</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTerminateOtherSessions}
                  disabled={isTerminatingSessions}
                  className="rounded-full text-[11px] font-bold h-7 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  {isTerminatingSessions ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <LogOut className="h-3 w-3" />
                  )}
                  <span>إنهاء الجلسات الأخرى</span>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/60 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <span className="font-bold block text-foreground">
                      {getBrowserClientSummary()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      آخر تسجيل دخول:{" "}
                      {session?.user?.last_sign_in_at
                        ? new Date(session.user.last_sign_in_at).toLocaleString("ar-SA")
                        : "الآن"}{" "}
                      • صلاحية الجلسة: نشطة ومحمية
                    </span>
                  </div>
                </div>
                <Badge variant="default" className="text-[10px] font-bold bg-emerald-600">
                  الجلسة النشطة الحالية
                </Badge>
              </div>

              <p className="text-[10px] text-muted-foreground">
                ملاحظة أمنية: يتم إنهاء كافة الجلسات النشطة في المتصفحات الأخرى عبر خادم المصادقة الفعلي لضمان عدم وجود أي وصول غير مصرح به.
              </p>
            </div>
          </TabsContent>

          {/* TAB 2: Notifications */}
          <TabsContent value="notifications" className="space-y-3 pt-3">
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-3 text-start">
              <h4 className="text-xs font-black">قنوات استلام الإشعارات</h4>

              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div>
                  <span className="text-xs font-bold block">إشعارات البريد الإلكتروني</span>
                  <span className="text-[10px] text-muted-foreground">
                    استلام إشعارات الأمان والعمليات الإدارية ومسيرات الرواتب على بريدك المسجل
                  </span>
                </div>
                <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold block">إشعارات الواتساب والرسائل النصية</span>
                    <Badge variant="outline" className="text-[9px] font-bold text-amber-700 bg-amber-50">
                      يتطلب مزود ربط (SMS Gateway)
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    تنبيهات فورية على الجوال (تتطلب ربط بوابة رسائل الرسائل المؤسسية)
                  </span>
                </div>
                <Switch checked={whatsappAlerts} onCheckedChange={setWhatsappAlerts} />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold block">إشعارات المتصفح الفورية (Push Alerts)</span>
                    <Badge variant="outline" className="text-[9px] font-bold text-slate-600 bg-slate-100">
                      يتطلب إذن المتصفح
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    تنبيهات سطح المكتب أثناء العمل على النظام للطلبات والموافقات
                  </span>
                </div>
                <Switch checked={systemPushAlerts} onCheckedChange={setSystemPushAlerts} />
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleSaveNotifications}
              className="rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-5"
            >
              حفظ التفضيلات
            </Button>
          </TabsContent>

          {/* TAB 3: Preferences */}
          <TabsContent value="preferences" className="space-y-4 pt-3 text-start">
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-3">
              <h4 className="text-xs font-black">لغة واجهة النظام الإقليمية</h4>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={language === "ar" ? "default" : "outline"}
                  onClick={() => {
                    setLanguage("ar");
                    toast.success("تم اعتماد اللغة العربية");
                  }}
                  className="rounded-full text-xs font-bold gap-1.5 h-8 px-4"
                >
                  <Globe className="h-3.5 w-3.5" />
                  العربية (المملكة العربية السعودية)
                </Button>
                <Button
                  size="sm"
                  variant={language === "en" ? "default" : "outline"}
                  onClick={() => {
                    setLanguage("en");
                    toast.success("Language switched to English");
                  }}
                  className="rounded-full text-xs font-bold gap-1.5 h-8 px-4"
                >
                  <Globe className="h-3.5 w-3.5" />
                  English (International)
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-2">
              <h4 className="text-xs font-black">التوقيت المؤسسي المعتمد</h4>
              <p className="text-[11px] text-muted-foreground">
                توقيت مكة المكرمة / الرياض (GMT+3) - مطابق لحسابات مسيرات التأمينات ونظام العمل السعودي.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
