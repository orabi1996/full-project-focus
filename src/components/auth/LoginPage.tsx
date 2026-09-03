import React, { useState, type FormEvent } from "react";
import { Navigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { isDemoModeEnabled } from "../../lib/config/runtime-config";

const platformFeatures = [
  { icon: ShieldCheck, label: "صلاحيات مؤسسية قابلة للتهيئة حسب الدور" },
  { icon: UsersRound, label: "إدارة مركزية موحدة 360° للموظفين" },
  { icon: BadgeCheck, label: "إجراءات واعتمادات إلكترونية موثقة" },
];

export function LoginPage() {
  const { session, isDemo, isLoading, signIn, enterDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demoEnabled = isDemoModeEnabled(
    import.meta.env["VITE_ENABLE_DEMO_MODE"],
    import.meta.env.PROD,
  );

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <p className="text-xs font-bold text-muted-foreground">جارٍ تجهيز بوابة الدخول الآمنة…</p>
        </div>
      </div>
    );
  }

  if (session || isDemo) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await signIn(email.trim(), password);
    if (result.error) setError(result.error);

    setIsSubmitting(false);
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen grid place-items-center p-4 sm:p-6 lg:p-10 bg-background relative overflow-hidden"
    >
      {/* Background Decorative Gradient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-secondary/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Material 3 Login Card */}
      <div className="w-full max-w-5xl rounded-3xl overflow-hidden border border-border/80 bg-card shadow-2xl grid grid-cols-1 md:grid-cols-2 relative z-10">
        {/* Left Decorative Brand Panel (Material Gradient) */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-primary via-primary/90 to-[#041E49] text-primary-foreground relative overflow-hidden">
          <div className="space-y-6 relative z-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-lg">
              <Building2 className="h-7 w-7 text-white" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-md border border-white/20">
                  نظام الموارد البشرية المؤسسي
                </span>
                <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
              </div>
              <h1 className="text-3xl font-black tracking-tight">Focus HRMS</h1>
              <p className="text-xs text-white/80 leading-relaxed font-medium">
                المنصة السحابية الموحدة لإدارة رأس المال البشري، الحضور والانصراف، مسيرات الرواتب،
                والخدمة الذاتية.
              </p>
            </div>
          </div>

          <div className="space-y-4 relative z-10 my-8">
            {platformFeatures.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3.5">
                <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/15">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs font-bold text-white/95">{label}</span>
              </div>
            ))}
          </div>

          <div className="relative z-10 pt-4 border-t border-white/15 text-[11px] text-white/70">
            مصمم لدعم متطلبات الموارد البشرية، وتخضع إعدادات الامتثال لاعتماد المنشأة
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-8 sm:p-12 flex flex-col justify-center bg-card">
          <div className="w-full max-w-md mx-auto space-y-6">
            <div className="space-y-2 text-start">
              <Badge
                variant="secondary"
                className="rounded-full px-3 py-1 font-bold text-xs gap-1.5 mb-1 inline-flex"
              >
                <LockKeyhole className="h-3.5 w-3.5 text-primary" />
                بوابة الموظفين والمدراء الآمنة
              </Badge>
              <h2 className="text-2xl font-black text-foreground">مرحباً بعودتك 👋</h2>
              <p className="text-xs text-muted-foreground font-medium">
                أدخل بيانات حسابك المعتمد للدخول إلى لوحة التحكم
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive font-bold">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="work-email" className="text-xs font-bold text-foreground block">
                  البريد الإلكتروني الوظيفي *
                </label>
                <input
                  id="work-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@focus-hrms.com"
                  required
                  autoFocus
                  className="w-full h-11 rounded-2xl border border-border/80 bg-muted/40 px-4 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-xs font-bold text-foreground block">
                  كلمة المرور *
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-11 rounded-2xl border border-border/80 bg-muted/40 px-4 pl-10 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                    title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-full font-black text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all gap-2 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جارٍ التحقق من الحساب…
                  </>
                ) : (
                  "تسجيل الدخول إلى المنظومة"
                )}
              </Button>
            </form>

            {demoEnabled && (
              <div className="pt-4 border-t border-border/60 space-y-3">
                <div className="text-center text-[11px] font-bold text-muted-foreground">
                  أو للاستعراض والتجربة الفورية:
                </div>
                <Button
                  variant="outline"
                  onClick={enterDemo}
                  className="w-full h-10 rounded-full font-bold text-xs border-primary/30 bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-xs"
                >
                  الدخول المباشر إلى النسخة التجريبية (Demo Mode)
                </Button>
              </div>
            )}

            <p className="text-center text-[10px] text-muted-foreground font-medium pt-2">
              يتم تأمين الوصول إلى البيانات وفق الدور والصلاحيات المعتمدة
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
