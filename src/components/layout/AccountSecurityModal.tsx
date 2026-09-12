import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
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
  Sun,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth/AuthContext";
import { changeAccountPassword } from "../../lib/auth/account-security";
import { supabase } from "../../integrations/supabase/client";
import { useApp } from "../../lib/context/AppContext";

interface AccountSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export const AccountSecurityModal: React.FC<AccountSecurityModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const { language, setLanguage, currentUser } = useApp();
  const { session, isDemo } = useAuth();
  const [isTerminatingSessions, setIsTerminatingSessions] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "فارغة", color: "bg-muted" };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 25, label: "ضعيفة", color: "bg-destructive" };
    if (score === 2) return { score: 50, label: "متوسطة", color: "bg-amber-500" };
    if (score === 3) return { score: 75, label: "جيدة", color: "bg-blue-500" };
    return { score: 100, label: "قوية جداً ومحمية", color: "bg-emerald-600" };
  };

  const strength = getPasswordStrength(newPassword);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    if (isDemo || !session?.user.email) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if (!currentPassword) {
      toast.error("يرجى إدخال كلمة المرور الحالية");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("يجب ألا تقل كلمة المرور الجديدة عن 8 خانات");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمة المرور الجديدة غير متطابقة مع التأكيد");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changeAccountPassword(
        supabase.auth,
        { id: session.user.id, email: session.user.email },
        currentPassword,
        newPassword,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("تم تحديث كلمة المرور بنجاح");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث كلمة المرور");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleTerminateOtherSessions = async () => {
    if (isDemo || !session) return;
    setIsTerminatingSessions(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast.success(
        "تم إلغاء تجديد الجلسات الأخرى؛ تنتهي صلاحية رموز الدخول الحالية عند انتهاء مدتها",
      );
    } catch {
      toast.error("تعذر إنهاء الجلسات الأخرى. حاول مجددًا.");
    } finally {
      setIsTerminatingSessions(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-3xl p-6 sm:p-7 shadow-2xl border-border/80">
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
                  إدارة حماية الحساب، كلمة المرور، ووسائل الإشعارات لـ ({userEmail})
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] font-bold">
              معرف الأمان: {currentUser.id.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="security" className="mt-4">
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
          <TabsContent value="security" className="space-y-5 pt-3">
            {isDemo && (
              <p className="text-xs text-muted-foreground">
                تغيير كلمة المرور وإدارة الجلسات متاحان للحسابات المسجلة فقط.
              </p>
            )}
            <form
              onSubmit={handleUpdatePassword}
              className="space-y-3.5 rounded-2xl border border-border/70 p-4 bg-muted/20"
            >
              <h4 className="text-xs font-black flex items-center gap-1.5 text-foreground">
                <Lock className="h-3.5 w-3.5 text-primary" />
                تغيير كلمة المرور
              </h4>

              <div className="space-y-1">
                <label
                  htmlFor="account-current-password"
                  className="text-[11px] font-bold text-muted-foreground"
                >
                  كلمة المرور الحالية *
                </label>
                <div className="relative">
                  <input
                    id="account-current-password"
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-9 rounded-xl border border-border/80 bg-card px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "إخفاء كلمات المرور" : "إظهار كلمات المرور"}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="account-new-password"
                    className="text-[11px] font-bold text-muted-foreground"
                  >
                    كلمة المرور الجديدة *
                  </label>
                  <input
                    id="account-new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8 خانات على الأقل"
                    className="w-full h-9 rounded-xl border border-border/80 bg-card px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="account-confirm-password"
                    className="text-[11px] font-bold text-muted-foreground"
                  >
                    تأكيد كلمة المرور الجديدة *
                  </label>
                  <input
                    id="account-confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال الجديدة"
                    className="w-full h-9 rounded-xl border border-border/80 bg-card px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Strength Bar */}
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
                disabled={isUpdatingPassword || isDemo || !session}
                className="rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-4"
              >
                {isUpdatingPassword ? "جارٍ الحفظ والتحديث..." : "تحديث كلمة المرور"}
              </Button>
            </form>

            {/* 2FA Toggle */}
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 flex items-center justify-between gap-4">
              <div className="space-y-0.5 text-start">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-black">
                    المصادقة الثنائية (2-Factor Authentication)
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-bold rounded-full">
                    موصى به
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  إعداد المصادقة الثنائية غير متاح في هذه الواجهة حاليًا؛ لا تعكس هذه الشاشة حالة
                  تفعيلها في الحساب.
                </p>
              </div>
              <Badge variant="outline">غير متاح</Badge>
            </div>

            {/* Active Sessions */}
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-primary" />
                  <span className="text-xs font-black">الجلسات والأجهزة النشطة</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTerminateOtherSessions}
                  disabled={isDemo || !session || isTerminatingSessions}
                  className="rounded-full text-[11px] font-bold h-7 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-3 w-3" />
                  إنهاء الجلسات الأخرى
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                الحساب الحالي: {session?.user.email ?? "وضع تجريبي"}. قائمة الأجهزة ومواقعها غير
                متاحة حاليًا.
              </p>
            </div>
          </TabsContent>

          {/* TAB 2: Notifications */}
          <TabsContent value="notifications" className="space-y-3 pt-3">
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-3 text-start">
              <h4 className="text-xs font-black">قنوات استلام الإشعارات</h4>
              <p className="text-xs text-muted-foreground">
                إعداد قنوات الإشعارات وحفظ تفضيلاتها غير متاحين حاليًا.
              </p>

              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div>
                  <span className="text-xs font-bold block">إشعارات البريد الإلكتروني</span>
                  <span className="text-[10px] text-muted-foreground">
                    استلام طلبات الإجازات ومسيرات الرواتب وتحديثات الوثائق على البريد
                  </span>
                </div>
                <Switch aria-label="إشعارات البريد الإلكتروني" disabled checked={false} />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div>
                  <span className="text-xs font-bold block">إشعارات الواتساب والرسائل النصية</span>
                  <span className="text-[10px] text-muted-foreground">
                    تنبيهات فورية عند إيداع الراتب، والطلبات العاجلة لاعتمادات العمليات
                  </span>
                </div>
                <Switch aria-label="إشعارات الرسائل" disabled checked={false} />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="text-xs font-bold block">
                    إشعارات المتصفح الفورية (Push Alerts)
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    تنبيهات سطح المكتب أثناء العمل على النظام لطلبات الموظفين والموافقات
                  </span>
                </div>
                <Switch aria-label="إشعارات المتصفح" disabled checked={false} />
              </div>
            </div>

            <Button
              size="sm"
              disabled
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
                توقيت مكة المكرمة / الرياض (GMT+3) - مطابق لحسابات مسيرات التأمينات ونظام العمل
                السعودي.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
