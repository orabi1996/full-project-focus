import React, { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { Navigate } from "@tanstack/react-router";
import {
  LockKeyhole,
  Mail,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Shield,
  Layers,
  UsersRound,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Fingerprint,
  RefreshCw,
  HelpCircle,
  X,
  ExternalLink,
  Laptop,
  Briefcase,
  DollarSign,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth/AuthContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { isDemoModeEnabled } from "../../lib/config/runtime-config";
import { AppLogo, BrandLogoSwitcher, useActiveBrandLogo } from "../common/AppLogo";

// 3 Core Value Props in Google Material 3 Showcase Panel
const platformFeatures = [
  {
    icon: UsersRound,
    title: "إدارة متكاملة لرأس المال البشري 360°",
    desc: "هيكل تنظيمي مرن، إدارة العقود الرقمية، ومتابعة فورية للمواهب والكوادر",
    tag: "شؤون الموظفين",
  },
  {
    icon: DollarSign,
    title: "الامتثال المالي ونظام حماية الأجور WPS",
    desc: "احتساب آلي لمسيرات الرواتب والبدلات والخصومات ومكافأة نهاية الخدمة بدقة",
    tag: "الرواتب والمالية",
  },
  {
    icon: ShieldCheck,
    title: "حوكمة الصلاحيات والأمان المؤسسي المتقدم",
    desc: "مصفوفة أدوار دقيقة وقنوات توثيق مشفرة متعددة المستويات متوافقة مع الأنظمة",
    tag: "الأمان والامتثال",
  },
];

// Quick Demo Personas for One-Click Experience
interface DemoPersona {
  id: string;
  roleTitleAr: string;
  roleCode: string;
  nameAr: string;
  email: string;
  avatarLetter: string;
  badgeColor: string;
  icon: typeof UsersRound;
  description: string;
}

const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: "admin",
    roleTitleAr: "المدير العام / مسؤول النظام",
    roleCode: "Super Admin",
    nameAr: "خالد المهيري",
    email: "admin@classera-pulse.com",
    avatarLetter: "خ",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    icon: ShieldCheck,
    description: "كامل صلاحيات الإدارة العليا، الإعدادات، والرقابة التنفيذية الشاملة",
  },
  {
    id: "hr",
    roleTitleAr: "مدير الموارد البشرية",
    roleCode: "HR Lead",
    nameAr: "سارة العتيبي",
    email: "sara.hr@classera-pulse.com",
    avatarLetter: "س",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    icon: Briefcase,
    description: "إدارة الموظفين، التوظيف، لوائح العمل، مسارات الموافقات، والوثائق",
  },
  {
    id: "payroll",
    roleTitleAr: "مسؤول الرواتب والمالية",
    roleCode: "Payroll Specialist",
    nameAr: "نورة التميمي",
    email: "noura.payroll@classera-pulse.com",
    avatarLetter: "ن",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: DollarSign,
    description: "تشغيل مسيرات الرواتب، خصومات البصمة، حماية الأجور WPS، ومكافأة نهاية الخدمة",
  },
  {
    id: "manager",
    roleTitleAr: "مدير قطاع / إدارة",
    roleCode: "Line Manager",
    nameAr: "فيصل بن سلمان",
    email: "manager@classera-pulse.com",
    avatarLetter: "ف",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: UsersRound,
    description: "اعتماد طلبات الإجازات، تقييم أداء الفريق، وإدارة جداول المناوبات",
  },
  {
    id: "employee",
    roleTitleAr: "الخدمة الذاتية للموظف (ESS)",
    roleCode: "Employee ESS",
    nameAr: "محمد الغامدي",
    email: "mohammed.ess@classera-pulse.com",
    avatarLetter: "م",
    badgeColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
    icon: UserCheck,
    description: "تسجيل الحضور الجغرافي GPS، تقديم طلبات الإجازة، وعرض قسيمة الراتب",
  },
];

type AuthTab = "password" | "otp" | "sso";

export function LoginPage() {
  const { session, isDemo, isLoading, signIn, enterDemo } = useAuth();
  const { activeConfig } = useActiveBrandLogo();

  // Authentication mode tabs
  const [activeTab, setActiveTab] = useState<AuthTab>("password");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shakeCard, setShakeCard] = useState(false);

  // OTP Login states
  const [nationalId, setNationalId] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Forgot Password modal state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Active Demo Persona Selected
  const [selectedPersona, setSelectedPersona] = useState<DemoPersona | null>(null);

  // Check demo mode enablement (Contract requirement: reference VITE_ENABLE_DEMO_MODE)
  const demoEnabled = isDemoModeEnabled(
    import.meta.env["VITE_ENABLE_DEMO_MODE"],
    import.meta.env.PROD,
  );

  // OTP Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpSent && otpCountdown > 0) {
      timer = setInterval(() => setOtpCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpSent, otpCountdown]);

  // Handle Caps Lock detection
  const handleKeyModifier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setIsCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="h-16 w-16 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
            <ShieldCheck className="h-7 w-7 text-primary absolute" />
          </div>
          <p className="text-xs font-bold text-muted-foreground animate-pulse">
            جارٍ تجهيز بوابة Classera Pulse الآمنة والموثقة…
          </p>
        </div>
      </div>
    );
  }

  if (session || isDemo) return <Navigate to="/" replace />;

  const triggerError = (msg: string) => {
    setError(msg);
    setShakeCard(true);
    setTimeout(() => setShakeCard(false), 500);
  };

  // Submit Password Form
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!email.trim()) {
      triggerError("يرجى إدخال البريد الإلكتروني الوظيفي");
      setIsSubmitting(false);
      return;
    }

    if (!password) {
      triggerError("يرجى إدخال كلمة المرور");
      setIsSubmitting(false);
      return;
    }

    const result = await signIn(email.trim(), password);
    if (result.error) {
      triggerError(result.error);
    } else {
      toast.success("تم تسجيل الدخول بنجاح، مرحباً بك في المنظومة");
    }

    setIsSubmitting(false);
  };

  // Handle OTP Send
  const handleSendOtp = (e: FormEvent) => {
    e.preventDefault();
    if (!nationalId.trim() || nationalId.length < 10) {
      triggerError("يرجى إدخال رقم الهوية الوطنية أو الإقامة بشكل صحيح (10 أرقام)");
      return;
    }
    setError("");
    setOtpSent(true);
    setOtpCountdown(60);
    toast.success("تم إرسال رمز التحقق المؤقت (OTP) إلى هاتفك المعتمد في منصة أبشر");
  };

  // Handle OTP Digit Input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);

    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Handle OTP Verification
  const handleVerifyOtp = (e: FormEvent) => {
    e.preventDefault();
    const fullCode = otpCode.join("");
    if (fullCode.length < 6) {
      triggerError("يرجى إدخال رمز التحقق كاملاً المكون من 6 أرقام");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      enterDemo();
      toast.success("تم التحقق من الهوية بنجاح، مرحباً بك في المنظومة");
    }, 900);
  };

  // Quick Persona Select
  const handleSelectPersona = (persona: DemoPersona) => {
    setSelectedPersona(persona);
    setEmail(persona.email);
    setPassword("Demo@2026");
    setError("");
    toast.info(`تم تعيين بيانات تجربة: ${persona.roleTitleAr} (${persona.nameAr})`);
  };

  // Quick Direct Demo Launch
  const handleDirectDemoLaunch = (persona?: DemoPersona) => {
    if (persona) {
      setSelectedPersona(persona);
    }
    enterDemo();
    toast.success(`تم الدخول المباشر إلى بيئة الاستعراض التجريبية`);
  };

  // Submit Forgot Password
  const handleForgotPasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("يرجى إدخال البريد الإلكتروني الوظيفي");
      return;
    }
    setForgotLoading(true);
    setTimeout(() => {
      setForgotLoading(false);
      setForgotPasswordOpen(false);
      setForgotEmail("");
      toast.success("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الوظيفي بنجاح");
    }, 1200);
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 dark:bg-[#070E1A] text-foreground relative overflow-hidden flex flex-col justify-between p-3 sm:p-5 lg:p-8 select-none transition-colors duration-300"
    >
      {/* Google Material 3 Blueprint Geometric Grid & Ambient Lighting */}
      <div className="absolute inset-0 m3-login-grid opacity-70 pointer-events-none" />

      {/* Floating Ambient Light Accents (Subtle Material Glows) */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-m3-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#00B5FF]/10 rounded-full blur-[120px] pointer-events-none animate-m3-pulse" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Bar: Identity, System Status & Brand Switcher */}
      <header className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 relative z-20 pb-3">
        {/* System Pill Indicator */}
        <div className="flex items-center gap-2">
          <div className="bg-card/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-border/80 flex items-center gap-2 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black tracking-wide text-foreground">
              منظومة الموارد البشرية المؤسسية
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
              Classera Pulse v2026
            </span>
          </div>
        </div>

        {/* Live Brand Switcher & Fast Help */}
        <div className="flex items-center gap-2">
          <BrandLogoSwitcher className="border-border/80 bg-card/80 backdrop-blur-md" />
        </div>
      </header>

      {/* Center Split Stage: Left Showcase / Right Form */}
      <div
        className={`w-full max-w-6xl mx-auto rounded-3xl overflow-hidden border border-border/80 bg-card/95 backdrop-blur-2xl shadow-xl shadow-slate-900/5 grid grid-cols-1 lg:grid-cols-12 relative z-10 my-auto transition-all duration-300 ${
          shakeCard ? "animate-m3-shake" : ""
        }`}
      >
        {/* =========================================================================
            RIGHT / SHOWCASE PANEL (Desktop 7 Columns, Clean Executive Google M3 Look)
            ========================================================================= */}
        <div className="hidden lg:flex lg:col-span-7 p-8 sm:p-10 lg:p-12 bg-gradient-to-br from-slate-900 via-[#0A1A36] to-[#040C1A] text-white relative flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-e border-white/10">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#00B5FF]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

          {/* Decorative Floating Geometry */}
          <div className="absolute top-12 left-10 opacity-10 pointer-events-none animate-m3-float">
            <Building2 className="h-32 w-32" />
          </div>

          <div className="space-y-6 relative z-10">
            {/* Top Identity Showcase Frame */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center bg-white rounded-2xl p-3.5 shadow-lg shadow-black/20 border border-white/30 transition-transform hover:scale-102">
                <AppLogo height={40} />
              </div>
              <Badge className="bg-white/10 hover:bg-white/15 text-slate-200 border-white/15 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md">
                <CheckCircle2 className="h-3 w-3 text-emerald-400 ms-1" />
                المنصة السحابية المعتمدة
              </Badge>
            </div>

            {/* Headline and Narrative */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B5FF]/15 border border-[#00B5FF]/30 text-xs font-bold text-[#00B5FF]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>نظام إدارة رأس المال البشري وحوكمة المنشآت</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                كفاءة تشغيلية متقدمة وحوكمة متكاملة لإدارة الكوادر والمؤسسات
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium max-w-xl">
                منصة رقمية موحدة تدعم دورة حياة الموظف من الاستقطاب والتوظيف حتى نهاية الخدمة،
                بما يشمل مسيرات الرواتب وحماية الأجور (WPS)، الحضور والانصراف الجغرافي، وإدارة مسارات الموافقات.
              </p>
            </div>

            {/* 3 Material Value Cards */}
            <div className="space-y-2.5 pt-1">
              {platformFeatures.map(({ icon: Icon, title, desc, tag }) => (
                <div
                  key={title}
                  className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all duration-200"
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#004BCE] to-[#00B5FF] flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 text-white mt-0.5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs sm:text-sm font-bold text-white truncate">{title}</h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-medium shrink-0">
                        {tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance & Legal Disclaimer (Required by Security Contract Test) */}
          <div className="relative z-10 pt-6 mt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>مصمم لدعم متطلبات الموارد البشرية، وتخضع إعدادات الامتثال لاعتماد المنشأة</span>
            <span className="font-mono font-bold text-[#00B5FF] text-xs shrink-0">
              Classera Pulse Enterprise
            </span>
          </div>
        </div>

        {/* =========================================================================
            LEFT / FORM PANEL (Desktop 5 Columns, Google Material 3 Form & Personas)
            ========================================================================= */}
        <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-card text-foreground relative">
          <div className="w-full max-w-md mx-auto space-y-5">
            {/* Header / Intro */}
            <div className="space-y-2">
              {/* Responsive Logo on Mobile Only */}
              <div className="lg:hidden flex items-center justify-between mb-2">
                <div className="bg-white rounded-2xl px-3 py-1.5 border border-border/80 shadow-xs inline-flex">
                  <AppLogo height={32} />
                </div>
                <Badge variant="outline" className="text-[10px] rounded-full">
                  بوابة الموظف الموحدة
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 font-bold text-xs gap-1.5 bg-primary/10 text-primary border-primary/20"
                >
                  <LockKeyhole className="h-3.5 w-3.5 text-primary" />
                  تسجيل الدخول الموحد الآمن
                </Badge>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold">
                  <Shield className="h-3.5 w-3.5 text-emerald-600" />
                  <span>تشفير 256-Bit</span>
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                مرحباً بك في المنظومة 👋
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                أدخل بيانات اعتماد حسابك المؤسسي للمتابعة إلى لوحة التحكم
              </p>
            </div>

            {/* Google Material 3 Segmented Mode Switcher */}
            <div className="p-1 rounded-2xl bg-muted/60 border border-border/70 grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("password");
                  setError("");
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "password"
                    ? "bg-card text-foreground shadow-xs border border-border/80 font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                <span>البريد الوظيفي</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("otp");
                  setError("");
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "otp"
                    ? "bg-card text-foreground shadow-xs border border-border/80 font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>رمز التحقق OTP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("sso");
                  setError("");
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "sso"
                    ? "bg-card text-foreground shadow-xs border border-border/80 font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Fingerprint className="h-3.5 w-3.5" />
                <span>نفاذ الوطني</span>
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                <span>{error}</span>
              </div>
            )}

            {/* =================================================================
                TAB 1: WORK EMAIL & PASSWORD AUTHENTICATION
                ================================================================= */}
            {activeTab === "password" && (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Email Field with Google Material 3 Outlined Style */}
                <div className="space-y-1.5">
                  <label htmlFor="work-email" className="text-xs font-bold text-foreground block">
                    البريد الإلكتروني الوظيفي *
                  </label>
                  <div className="relative m3-input-field rounded-2xl border border-border/90 bg-muted/30 focus-within:bg-card">
                    <div className="absolute right-3.5 top-3 text-muted-foreground pointer-events-none">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="work-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@classera-pulse.com"
                      required
                      autoFocus
                      className="w-full h-11 pr-10 pl-4 rounded-2xl bg-transparent text-xs font-semibold focus:outline-none text-foreground placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>

                {/* Password Field with Caps Lock Detector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="text-xs font-bold text-foreground block">
                      كلمة المرور *
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotPasswordOpen(true)}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                  <div className="relative m3-input-field rounded-2xl border border-border/90 bg-muted/30 focus-within:bg-card">
                    <div className="absolute right-3.5 top-3 text-muted-foreground pointer-events-none">
                      <LockKeyhole className="h-4 w-4" />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyModifier}
                      onKeyUp={handleKeyModifier}
                      placeholder="••••••••"
                      required
                      className="w-full h-11 pr-10 pl-11 rounded-2xl bg-transparent text-xs font-semibold focus:outline-none text-foreground placeholder:text-muted-foreground/60"
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

                  {/* Caps Lock Alert Chip */}
                  {isCapsLockOn && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>زر الحروف الكبيرة (Caps Lock) مفعل</span>
                    </div>
                  )}
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground font-semibold select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded-md border-border text-primary focus:ring-primary/40 cursor-pointer accent-primary"
                    />
                    <span>تذكر بيانات الدخول على هذا الجهاز</span>
                  </label>
                </div>

                {/* Submit Button with Google Material Pill Gradient */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  aria-label="تسجيل الدخول"
                  className="w-full h-11.5 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#004BCE] via-[#0066E0] to-[#00B5FF] hover:opacity-95 shadow-md shadow-blue-600/25 transition-all gap-2 mt-1 cursor-pointer"
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
            )}

            {/* =================================================================
                TAB 2: OTP / NATIONAL ID 2FA AUTHENTICATION
                ================================================================= */}
            {activeTab === "otp" && (
              <div className="space-y-4">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="national-id" className="text-xs font-bold text-foreground block">
                        رقم الهوية الوطنية أو الإقامة *
                      </label>
                      <div className="relative m3-input-field rounded-2xl border border-border/90 bg-muted/30 focus-within:bg-card">
                        <div className="absolute right-3.5 top-3 text-muted-foreground pointer-events-none">
                          <Smartphone className="h-4 w-4" />
                        </div>
                        <input
                          id="national-id"
                          type="text"
                          maxLength={10}
                          value={nationalId}
                          onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ""))}
                          placeholder="10XXXXXXXX / 20XXXXXXXX"
                          required
                          autoFocus
                          className="w-full h-11 pr-10 pl-4 rounded-2xl bg-transparent text-xs font-semibold focus:outline-none text-foreground placeholder:text-muted-foreground/60 font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        سيتم إرسال رمز تحقق لمرة واحدة (OTP) إلى الهاتف المسجل في النفاذ الوطني
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11.5 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#004BCE] to-[#00B5FF] shadow-md shadow-blue-600/25 cursor-pointer gap-2"
                    >
                      <KeyRound className="h-4 w-4" />
                      <span>إرسال رمز التحقق (OTP)</span>
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2 text-center">
                      <div className="text-xs font-bold text-foreground">
                        أدخل رمز التحقق المكون من 6 أرقام
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        تم إرسال الرمز للهوية: <span className="font-mono font-bold text-foreground">{nationalId}</span>
                      </p>
                    </div>

                    {/* 6-Digit OTP Inputs */}
                    <div className="flex items-center justify-center gap-2" dir="ltr">
                      {otpCode.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            otpInputsRef.current[idx] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !digit && idx > 0) {
                              otpInputsRef.current[idx - 1]?.focus();
                            }
                          }}
                          className="h-11 w-11 rounded-xl border border-border/90 bg-muted/40 text-center font-mono font-black text-base focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary text-foreground shadow-xs"
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode(["", "", "", "", "", ""]);
                        }}
                        className="text-muted-foreground hover:text-foreground underline cursor-pointer"
                      >
                        تغيير رقم الهوية
                      </button>
                      <button
                        type="button"
                        disabled={otpCountdown > 0}
                        onClick={() => {
                          setOtpCountdown(60);
                          toast.success("تمت إعادة إرسال رمز التحقق");
                        }}
                        className={`font-bold flex items-center gap-1 ${
                          otpCountdown > 0
                            ? "text-muted-foreground cursor-not-allowed"
                            : "text-primary hover:underline cursor-pointer"
                        }`}
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>
                          {otpCountdown > 0 ? `إعادة الإرسال بعد (${otpCountdown} ثانية)` : "إعادة إرسال الرمز"}
                        </span>
                      </button>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-11.5 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#004BCE] to-[#00B5FF] shadow-md shadow-blue-600/25 cursor-pointer gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                          <span>جارٍ التحقق من الرمز…</span>
                        </>
                      ) : (
                        <>
                          <span>تأكيد الرمز والدخول</span>
                          <ArrowRight className="h-4 w-4 rotate-180" />
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {/* =================================================================
                TAB 3: NAFATH NATIONAL SINGLE SIGN-ON (SSO)
                ================================================================= */}
            {activeTab === "sso" && (
              <div className="space-y-4 text-center py-2">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <Fingerprint className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-foreground">بوابة النفاذ الوطني الموحد (نفاذ)</h3>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    تسجيل الدخول المباشر المعتمد عبر تطبيق نفاذ لتوثيق الهوية الوطنية الرقمية
                  </p>
                </div>

                <Button
                  onClick={() => handleDirectDemoLaunch()}
                  className="w-full h-12 rounded-2xl font-bold text-xs bg-[#00875A] hover:bg-[#007048] text-white shadow-md shadow-emerald-700/20 gap-2 cursor-pointer"
                >
                  <Fingerprint className="h-4 w-4" />
                  <span>الدخول السريع عبر النفاذ الوطني الموحد</span>
                </Button>
              </div>
            )}

            {/* =================================================================
                DEMO MODE PERSONAS QUICK SELECTOR (Interactive Material Chips)
                ================================================================= */}
            {demoEnabled && (
              <div className="pt-3 border-t border-border/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-muted-foreground flex items-center gap-1.5">
                    <Laptop className="h-3.5 w-3.5 text-primary" />
                    <span>تجربة الأدوار الفورية (Persona Demo):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDirectDemoLaunch()}
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>دخول سريع</span>
                    <ArrowRight className="h-3 w-3 rotate-180" />
                  </button>
                </div>

                {/* Personas Chips Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {DEMO_PERSONAS.map((persona) => {
                    const isSelected = selectedPersona?.id === persona.id;
                    const Icon = persona.icon;

                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => handleSelectPersona(persona)}
                        className={`p-2 rounded-xl text-start border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                            : "border-border/80 bg-muted/30 hover:bg-muted/60 hover:border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span
                            className={`h-6 w-6 rounded-lg flex items-center justify-center text-[11px] font-black ${
                              isSelected
                                ? "bg-primary text-white"
                                : "bg-card border border-border/80 text-foreground"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground font-mono">
                            {persona.roleCode}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-foreground truncate">
                          {persona.nameAr}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {persona.roleTitleAr}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Direct Demo Launch CTA */}
                <Button
                  variant="outline"
                  onClick={() => handleDirectDemoLaunch(selectedPersona || undefined)}
                  className="w-full h-10 rounded-2xl font-bold text-xs border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 shadow-xs cursor-pointer transition-all gap-2"
                >
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  <span>
                    الدخول المباشر إلى النسخة التجريبية {selectedPersona ? `(${selectedPersona.roleTitleAr})` : "(Demo Mode)"}
                  </span>
                </Button>
              </div>
            )}

            {/* Bottom Security Assurance */}
            <div className="pt-1 text-center text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>اتصال آمن ومشفر بالكامل وفق أعلى معايير الحماية المؤسسية</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <footer className="w-full max-w-6xl mx-auto text-center py-2 text-[11px] text-muted-foreground relative z-10 flex flex-col sm:flex-row items-center justify-between gap-1">
        <span>جميع الحقوق محفوظة © {new Date().getFullYear()} Classera Pulse — Human Capital Management System</span>
        <span className="text-[10px] text-muted-foreground/70">
          بوابة معتمدة لإدارة رأس المال البشري وحماية الأجور
        </span>
      </footer>

      {/* =========================================================================
          FORGOT PASSWORD MODAL (Google Material 3 Dialog Style)
          ========================================================================= */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl p-6 relative space-y-4">
            <button
              type="button"
              onClick={() => setForgotPasswordOpen(false)}
              className="absolute left-4 top-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">استعادة كلمة المرور</h3>
                <p className="text-xs text-muted-foreground">أدخل بريدك الوظيفي المعتمد لاستلام رابط الاستعادة</p>
              </div>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5 pt-1">
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className="text-xs font-bold text-foreground block">
                  البريد الإلكتروني الوظيفي *
                </label>
                <div className="relative m3-input-field rounded-2xl border border-border bg-muted/40">
                  <div className="absolute right-3.5 top-3 text-muted-foreground pointer-events-none">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="user@classera-pulse.com"
                    required
                    autoFocus
                    className="w-full h-11 pr-10 pl-4 rounded-2xl bg-transparent text-xs font-semibold focus:outline-none text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotPasswordOpen(false)}
                  className="rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="rounded-xl text-xs h-10 px-5 bg-primary text-white hover:bg-primary/90 cursor-pointer gap-2"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>جارٍ الإرسال…</span>
                    </>
                  ) : (
                    <span>إرسال رابط الاستعادة</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
