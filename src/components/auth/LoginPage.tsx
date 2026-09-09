import React, { useState, type FormEvent } from "react";
import { Navigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
  Loader2,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Zap,
} from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { isDemoModeEnabled } from "../../lib/config/runtime-config";
import { AppLogo, BrandLogoSwitcher, useActiveBrandLogo } from "../common/AppLogo";

const platformFeatures = [
  {
    icon: UsersRound,
    title: "إدارة متكاملة لرأس المال البشري 360°",
    desc: "هيكل تنظيمي مرن، عقود ذكية، ومتابعة فورية للموظفين والمواهب",
  },
  {
    icon: Zap,
    title: "الامتثال المالي ونظام حماية الأجور WPS",
    desc: "احتساب دقيق لمسيرات الرواتب والبدلات والخصومات ومكافأة نهاية الخدمة",
  },
  {
    icon: ShieldCheck,
    title: "حوكمة الصلاحيات والأمان المؤسسي",
    desc: "مصفوفة أدوار دقيقة قابلة للتخصيص ومصادقة مشفرة متعددة المستويات",
  },
];

export function LoginPage() {
  const { session, isDemo, isLoading, signIn, enterDemo } = useAuth();
  const { activeConfig } = useActiveBrandLogo();
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
      <div className="min-h-screen grid place-items-center bg-[#060D1A] text-white" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="h-16 w-16 rounded-full border-2 border-[#00B5FF]/20 border-t-[#00B5FF] animate-spin" />
            <Sparkles className="h-6 w-6 text-[#00B5FF] absolute animate-pulse" />
          </div>
          <p className="text-xs font-bold text-slate-300">جارٍ تهيئة بوابة Classera Pulse الآمنة…</p>
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
      className="min-h-screen bg-[#060D1A] text-slate-100 relative overflow-hidden flex flex-col justify-between p-4 sm:p-6 lg:p-8 select-none"
    >
      {/* Dynamic Background Lighting Effects */}
      <div className="absolute -top-40 -left-40 w-[550px] h-[550px] bg-[#004BCE]/25 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[550px] h-[550px] bg-[#00B5FF]/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[180px] pointer-events-none" />

      {/* Top Header Bar with Live Brand Logo Switcher */}
      <header className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 relative z-20 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-white/15 flex items-center gap-2 shadow-lg">
            <span className="h-2 w-2 rounded-full bg-[#00B5FF] animate-ping" />
            <span className="text-xs font-black tracking-wide text-white">Classera Pulse HCM</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00B5FF]/20 text-[#00B5FF] font-bold">
              v2026
            </span>
          </div>
        </div>

        {/* Live Brand Logo Switcher Bar */}
        <div className="flex items-center gap-2">
          <BrandLogoSwitcher className="border-white/15" />
        </div>
      </header>

      {/* Center Main Stage Split Card */}
      <div className="w-full max-w-6xl mx-auto rounded-3xl overflow-hidden border border-white/15 bg-slate-900/60 backdrop-blur-2xl shadow-2xl shadow-black/80 grid grid-cols-1 lg:grid-cols-12 relative z-10 my-auto">
        {/* Left/Showcase Brand Panel (Hidden on mobile, 7 cols on desktop) */}
        <div className="hidden lg:flex lg:col-span-7 p-8 sm:p-12 lg:p-14 bg-gradient-to-br from-[#0A1A36]/90 via-[#07152B]/95 to-[#040A15] relative flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-e border-white/10">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#00B5FF]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-8 relative z-10">
            {/* Active Logo Display Showcase Frame */}
            <div className="inline-flex items-center bg-white rounded-2xl p-4 shadow-xl shadow-blue-950/50 border border-white/30 transition-all duration-300">
              <AppLogo height={44} />
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B5FF]/15 border border-[#00B5FF]/30 text-xs font-bold text-[#00B5FF]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>الجيل الجديد لإدارة رأس المال البشري والامتثال</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-snug">
                كفاءة تشغيلية متقدمة لبيئة عمل رقمية ذكية
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium max-w-xl">
                منصة سحابية متكاملة تدعم دورة حياة الموظف من التوظيف إلى نهاية الخدمة، مدعومة باحتساب آلي للرواتب، الحضور الذكي، وسير الموافقات المرن.
              </p>
            </div>

            {/* 3 Core Value Cards */}
            <div className="space-y-3 pt-2">
              {platformFeatures.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 transition-colors"
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#004BCE] to-[#00B5FF] flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 text-white mt-0.5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-xs sm:text-sm font-bold text-white">{title}</h2>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance & Legal Disclaimer (Required by Security Contract Test) */}
          <div className="relative z-10 pt-8 mt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>مصمم لدعم متطلبات الموارد البشرية، وتخضع إعدادات الامتثال لاعتماد المنشأة</span>
            <span className="font-mono font-bold text-[#00B5FF] text-xs shrink-0">Classera Pulse Enterprise</span>
          </div>
        </div>

        {/* Right Authentication Form Panel (5 cols on desktop) */}
        <div className="lg:col-span-5 p-8 sm:p-12 flex flex-col justify-center bg-white dark:bg-[#0B1526] text-foreground relative">
          <div className="w-full max-w-md mx-auto space-y-6">
            {/* Header / Intro */}
            <div className="space-y-2 text-start">
              {/* Responsive Logo on Form Top */}
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-white rounded-2xl px-3 py-1.5 border border-border/80 shadow-xs inline-flex">
                  <AppLogo height={32} />
                </div>
              </div>

              <Badge
                variant="secondary"
                className="rounded-full px-3 py-1 font-bold text-xs gap-1.5 mb-1 inline-flex bg-[#004BCE]/10 text-[#004BCE] dark:bg-[#00B5FF]/10 dark:text-[#00B5FF] border-[#004BCE]/20 dark:border-[#00B5FF]/30"
              >
                <LockKeyhole className="h-3.5 w-3.5 text-[#004BCE] dark:text-[#00B5FF]" />
                تسجيل الدخول الموحد الآمن
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                مرحباً بعودتك 👋
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                أدخل بيانات حسابك المعتمد للدخول إلى لوحة التحكم
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive font-bold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="work-email" className="text-xs font-bold text-foreground block">
                  البريد الإلكتروني الوظيفي *
                </label>
                <input
                  id="work-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@classera-pulse.com"
                  required
                  autoFocus
                  className="w-full h-11 rounded-2xl border border-border/80 bg-muted/40 px-4 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-[#00B5FF]/60 focus:border-[#00B5FF] transition-all shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-xs font-bold text-foreground block">
                    كلمة المرور *
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-11 rounded-2xl border border-border/80 bg-muted/40 px-4 pl-11 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-[#00B5FF]/60 focus:border-[#00B5FF] transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-muted-foreground hover:text-foreground p-0.5 rounded-lg transition-colors cursor-pointer"
                    title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                aria-label="تسجيل الدخول"
                className="w-full h-12 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#004BCE] via-[#0066E0] to-[#00B5FF] hover:opacity-95 shadow-lg shadow-blue-600/30 transition-all gap-2 mt-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>جارٍ التحقق من الحساب…</span>
                  </>
                ) : (
                  <>
                    <span>تسجيل الدخول إلى المنظومة</span>
                    <ArrowRight className="h-4 w-4 rotate-180" />
                  </>
                )}
              </Button>
            </form>

            {/* Demo Mode Quick Access */}
            {demoEnabled && (
              <div className="pt-4 border-t border-border/70 space-y-2.5">
                <div className="text-center text-[11px] font-bold text-muted-foreground">
                  أو للاستعراض والتجربة الفورية للنظام:
                </div>
                <Button
                  variant="outline"
                  onClick={enterDemo}
                  className="w-full h-11 rounded-2xl font-bold text-xs border-[#00B5FF]/40 bg-[#00B5FF]/10 text-[#004BCE] dark:text-[#00B5FF] hover:bg-[#00B5FF]/20 shadow-xs cursor-pointer transition-all gap-2"
                >
                  <Sparkles className="h-4 w-4 text-[#00B5FF]" />
                  <span>الدخول المباشر إلى النسخة التجريبية (Demo Mode)</span>
                </Button>
              </div>
            )}

            <div className="pt-2 text-center text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-500" />
              <span>اتصال آمن ومشفر بأعلى معايير الحماية المؤسسية</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <footer className="w-full max-w-6xl mx-auto text-center py-2 text-[11px] text-slate-400 relative z-10">
        جميع الحقوق محفوظة © {new Date().getFullYear()} Classera Pulse — Human Capital Management System
      </footer>
    </main>
  );
}
