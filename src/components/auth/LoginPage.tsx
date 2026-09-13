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
  RefreshCw,
  HelpCircle,
  X,
  Laptop,
  Briefcase,
  DollarSign,
  UserCheck,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth/AuthContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { isDemoModeEnabled } from "../../lib/config/runtime-config";
import { AppLogo } from "../common/AppLogo";

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

// Quick Demo Personas for One-Click Experience (Only available in Dev/Demo environments)
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
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
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
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
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
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
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
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
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
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    icon: UserCheck,
    description: "تسجيل الحضور الجغرافي GPS، تقديم طلبات الإجازة، وعرض قسيمة الراتب",
  },
];

type AuthTab = "password" | "otp";

const OTP_COOLDOWN_STORAGE_KEY = "hrms_auth_otp_cooldown";

export function LoginPage() {
  const {
    session,
    isDemo,
    isLoading,
    isRecoveryMode,
    sessionExpired,
    signIn,
    sendOtp,
    verifyOtp,
    requestPasswordReset,
    updatePassword,
    dismissSessionExpired,
    enterDemo,
  } = useAuth();

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

  // Real OTP Login states
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Forgot Password modal state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Account Recovery (Set New Password) state
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  // Active Demo Persona Selected (Dev Only)
  const [selectedPersona, setSelectedPersona] = useState<DemoPersona | null>(null);

  // Check demo mode enablement (Contract requirement: reference VITE_ENABLE_DEMO_MODE)
  const demoEnabled = isDemoModeEnabled(
    import.meta.env["VITE_ENABLE_DEMO_MODE"],
    import.meta.env.PROD,
  );

  // Handle session expiration notification
  useEffect(() => {
    if (sessionExpired) {
      toast.error("انتهت صلاحية الجلسة الموثقة. يرجى تسجيل الدخول مجدداً للمتابعة بأمان.");
      dismissSessionExpired();
    }
  }, [sessionExpired, dismissSessionExpired]);

  // Restore OTP Resend Countdown from sessionStorage (Resend Throttling)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedExpiry = sessionStorage.getItem(OTP_COOLDOWN_STORAGE_KEY);
      if (savedExpiry) {
        const remaining = Math.ceil((Number(savedExpiry) - Date.now()) / 1000);
        if (remaining > 0) {
          setOtpCountdown(remaining);
        } else {
          sessionStorage.removeItem(OTP_COOLDOWN_STORAGE_KEY);
        }
      }
    } catch {
      // ignore storage error
    }
  }, []);

  // OTP Countdown timer tick
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) {
            try {
              sessionStorage.removeItem(OTP_COOLDOWN_STORAGE_KEY);
            } catch {
              // ignore
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // Handle Caps Lock detection
  const handleKeyModifier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setIsCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-800" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="h-16 w-16 rounded-full border-3 border-blue-200 border-t-[#004BCE] animate-spin" />
            <ShieldCheck className="h-7 w-7 text-[#004BCE] absolute" />
          </div>
          <p className="text-xs font-bold text-slate-600 animate-pulse">
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

  // Submit Password Form (Real Supabase Auth)
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

  // Real Supabase OTP Request (with Resend Throttling)
  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!otpEmail.trim()) {
      triggerError("يرجى إدخال البريد الإلكتروني الوظيفي لاستلام رمز التحقق");
      return;
    }

    if (otpCountdown > 0) {
      toast.info(`يرجى الانتظار ${otpCountdown} ثانية قبل إعادة طلب رمز التحقق`);
      return;
    }

    setError("");
    setIsSubmitting(true);

    const result = await sendOtp(otpEmail.trim());

    if (result.error) {
      triggerError(result.error);
    } else {
      setOtpSent(true);
      const cooldownSecs = 60;
      setOtpCountdown(cooldownSecs);
      try {
        sessionStorage.setItem(OTP_COOLDOWN_STORAGE_KEY, String(Date.now() + cooldownSecs * 1000));
      } catch {
        // ignore
      }
      toast.success("تم إرسال رمز التحقق المؤقت (OTP) بنجاح إلى بريدك الوظيفي. يرجى مراجعة صندوق الوارد.");
    }

    setIsSubmitting(false);
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

  // Real Supabase OTP Verification (NEVER calls enterDemo())
  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    const fullCode = otpCode.join("");
    if (fullCode.length < 6) {
      triggerError("يرجى إدخال رمز التحقق كاملاً المكون من 6 أرقام");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const result = await verifyOtp(otpEmail.trim(), fullCode);

    if (result.error) {
      triggerError(result.error);
    } else {
      toast.success("تم تأكيد الرمز وتوثيق الجلسة بنجاح");
      // Session is established in Supabase. TanStack Router automatically routes to /
    }

    setIsSubmitting(false);
  };

  // Quick Persona Select (Dev / Demo Mode Only)
  const handleSelectPersona = (persona: DemoPersona) => {
    if (!demoEnabled) return;
    setSelectedPersona(persona);
    setEmail(persona.email);
    setPassword("Demo@2026");
    setError("");
    toast.info(`تم تعيين بيانات تجربة: ${persona.roleTitleAr} (${persona.nameAr})`);
  };

  // Direct Demo Launch (Dev / Demo Mode Only - Blocked in Production)
  const handleDirectDemoLaunch = (persona?: DemoPersona) => {
    if (!demoEnabled || import.meta.env.PROD) {
      toast.error("الوضع التجريبي معطل في بيئة الإنتاج");
      return;
    }
    if (persona) {
      setSelectedPersona(persona);
    }
    enterDemo();
    toast.success(`تم الدخول المباشر إلى بيئة الاستعراض التجريبية`);
  };

  // Real Supabase Password Reset Request
  const handleForgotPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("يرجى إدخال البريد الإلكتروني الوظيفي");
      return;
    }

    setForgotLoading(true);
    const result = await requestPasswordReset(forgotEmail.trim());

    if (result.error) {
      toast.error(result.error);
    } else {
      setForgotPasswordOpen(false);
      setForgotEmail("");
      toast.success("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الوظيفي بنجاح. يرجى مراجعة البريد.");
    }

    setForgotLoading(false);
  };

  // Real Account Recovery Password Update
  const handleAccountRecoverySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (recoveryPassword.length < 6) {
      triggerError("يجب أن لا تقل كلمة المرور الجديدة عن 6 خانات");
      return;
    }
    if (recoveryPassword !== recoveryConfirmPassword) {
      triggerError("كلمتا المرور غير متطابقتين. يرجى إعادة التحقق.");
      return;
    }

    setRecoverySubmitting(true);
    const result = await updatePassword(recoveryPassword);

    if (result.error) {
      triggerError(result.error);
    } else {
      toast.success("تم تحديث كلمة المرور بنجاح. مرحباً بك مجدداً في المنظومة.");
      // Session updated and active
    }
    setRecoverySubmitting(false);
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gradient-to-br from-slate-50 via-[#F8FAFC] to-blue-50/40 text-slate-800 relative overflow-hidden flex flex-col justify-between p-3 sm:p-5 lg:p-8 select-none transition-colors duration-300"
    >
      {/* Google Material 3 Blueprint Geometric Grid & Ambient Air */}
      <div className="absolute inset-0 m3-login-grid opacity-60 pointer-events-none" />

      {/* Subtle Airy Light Glow Accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-200/20 rounded-full blur-[120px] pointer-events-none animate-m3-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-200/25 rounded-full blur-[120px] pointer-events-none animate-m3-pulse" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Bar: Identity & Certified System Status */}
      <header className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 relative z-20 pb-3">
        {/* System Pill Indicator */}
        <div className="flex items-center gap-2">
          <div className="bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/90 flex items-center gap-2 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black tracking-wide text-slate-800">
              منظومة الموارد البشرية المؤسسية
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-[#004BCE] font-bold border border-blue-100">
              Classera Pulse v2026
            </span>
          </div>
        </div>

        {/* Security & Verification Header Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 shadow-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>نظام موثق ومعتمد</span>
          </div>
        </div>
      </header>

      {/* Center Split Stage: Left Showcase / Right Form (All Light & Crisp) */}
      <div
        className={`w-full max-w-6xl mx-auto rounded-3xl overflow-hidden border border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-xl shadow-slate-200/60 grid grid-cols-1 lg:grid-cols-12 relative z-10 my-auto transition-all duration-300 ${
          shakeCard ? "animate-m3-shake" : ""
        }`}
      >
        {/* =========================================================================
            RIGHT / SHOWCASE PANEL (Desktop 7 Columns, Crisp, Light Executive Look)
            ========================================================================= */}
        <div className="hidden lg:flex lg:col-span-7 p-8 sm:p-10 lg:p-12 bg-gradient-to-br from-blue-50/70 via-slate-50/90 to-sky-50/50 text-slate-800 relative flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-e border-slate-200/80">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-sky-200/25 rounded-full blur-3xl pointer-events-none" />

          {/* Decorative Subtle Watermark Geometry */}
          <div className="absolute top-12 left-10 text-blue-900/5 pointer-events-none animate-m3-float">
            <Building2 className="h-36 w-36" />
          </div>

          <div className="space-y-6 relative z-10">
            {/* Top Identity Frame with Official Single Logo */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center bg-white rounded-2xl p-3 shadow-xs border border-slate-200/90 transition-transform hover:scale-102">
                <AppLogo height={42} />
              </div>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200/80 rounded-full px-3 py-1 text-xs font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 ms-1" />
                المنصة السحابية المعتمدة
              </Badge>
            </div>

            {/* Headline and Narrative */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/60 border border-blue-200 text-xs font-bold text-[#004BCE]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#004BCE]" />
                <span>نظام إدارة رأس المال البشري وحوكمة المنشآت</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                كفاءة تشغيلية متقدمة وحوكمة متكاملة لإدارة الكوادر والمؤسسات
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium max-w-xl">
                منصة رقمية موحدة تدعم دورة حياة الموظف من الاستقطاب والتوظيف حتى نهاية الخدمة،
                بما يشمل مسيرات الرواتب وحماية الأجور (WPS)، الحضور والانصراف الجغرافي، وإدارة مسارات الموافقات.
              </p>
            </div>

            {/* 3 Material Value Cards (Pristine Light Cards) */}
            <div className="space-y-2.5 pt-1">
              {platformFeatures.map(({ icon: Icon, title, desc, tag }) => (
                <div
                  key={title}
                  className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-300 hover:shadow-md transition-all duration-200"
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#004BCE] to-[#00B5FF] flex items-center justify-center shrink-0 shadow-sm text-white mt-0.5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{title}</h2>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100 shrink-0">
                        {tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance & Legal Disclaimer (Required by Security Contract Test) */}
          <div className="relative z-10 pt-6 mt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>مصمم لدعم متطلبات الموارد البشرية، وتخضع إعدادات الامتثال لاعتماد المنشأة</span>
            <span className="font-mono font-bold text-[#004BCE] text-xs shrink-0">
              Classera Pulse Enterprise
            </span>
          </div>
        </div>

        {/* =========================================================================
            LEFT / FORM PANEL (Desktop 5 Columns, Google Material 3 Form & Personas)
            ========================================================================= */}
        <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-white text-slate-900 relative">
          <div className="w-full max-w-md mx-auto space-y-5">
            {/* Header / Intro */}
            <div className="space-y-2">
              {/* Responsive Logo on Mobile Only */}
              <div className="lg:hidden flex items-center justify-between mb-2">
                <div className="bg-white rounded-2xl px-3 py-1.5 border border-slate-200 shadow-xs inline-flex">
                  <AppLogo height={34} />
                </div>
                <Badge variant="outline" className="text-[10px] rounded-full border-slate-200">
                  بوابة الموظف الموحدة
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 font-bold text-xs gap-1.5 bg-blue-50 text-[#004BCE] border-blue-200"
                >
                  <LockKeyhole className="h-3.5 w-3.5 text-[#004BCE]" />
                  تسجيل الدخول الموحد الآمن
                </Badge>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                  <Shield className="h-3.5 w-3.5 text-emerald-600" />
                  <span>تشفير 256-Bit</span>
                </div>
              </div>

              {/* Exact Match for Playwright Tests: مرحباً بعودتك */}
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                مرحباً بعودتك 👋
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isRecoveryMode
                  ? "أدخل كلمة المرور الجديدة لتوثيق وتحديث حسابك"
                  : "أدخل بيانات اعتماد حسابك المؤسسي للمتابعة إلى لوحة التحكم"}
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* =================================================================
                ACCOUNT RECOVERY VIEW (When arriving from password reset link)
                ================================================================= */}
            {isRecoveryMode ? (
              <form onSubmit={handleAccountRecoverySubmit} className="space-y-4 pt-1">
                <div className="rounded-2xl bg-blue-50/80 border border-blue-200/80 p-3.5 text-xs text-blue-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-[#004BCE]" />
                    <span>إعادة تعيين كلمة المرور المعتمدة</span>
                  </div>
                  <p className="text-[11px] text-blue-700">
                    تم التحقق من رابط الاستعادة. يرجى إدخال كلمة المرور الجديدة وتأكيدها.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="recovery-password" className="text-xs font-bold text-slate-800 block">
                    كلمة المرور الجديدة *
                  </label>
                  <div className="relative m3-input-field rounded-2xl border border-slate-200 bg-slate-50/60 focus-within:bg-white focus-within:border-[#004BCE]">
                    <div className="absolute right-3.5 top-3 text-slate-400 pointer-events-none">
                      <LockKeyhole className="h-4 w-4" />
                    </div>
                    <input
                      id="recovery-password"
                      type={showRecoveryPassword ? "text" : "password"}
                      value={recoveryPassword}
                      onChange={(e) => setRecoveryPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                      className="w-full h-11 pr-10 pl-11 rounded-2xl bg-transparent text-xs font-semibold focus:outline-none text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-slate-700 p-0.5 rounded-lg transition-colors cursor-pointer"
                    >
                      {showRecoveryPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="recovery-confirm-password" className="text-xs font-bold text-slate-800 block">
                    تأكيد كلمة المرور الجديدة *
                  </label>
                  <div className="relative m3-input-field rounded-2xl border border-slate-200 bg-slate-50/60 focus-within:bg-white focus-within:border-[#004BCE]">
                    <div className="absolute right-3.5 top-3 text-slate-400 pointer-events-none">
                      <LockKeyhole className="h-4 w-4" />
                    </div>
                    <input
                      id="recovery-confirm-password"
                      type={showRecoveryPassword ? "text" : "password"}
                      value={recoveryConfirmPassword}
                      onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full h-11 pr-10 pl-11 rounded-2xl bg-transparent text-xs font-semibold focus:outline-none text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={recoverySubmitting}
                  className="w-full h-11.5 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#004BCE] to-[#00B5FF] hover:opacity-95 shadow-md shadow-blue-600/25 transition-all gap-2 cursor-pointer"
                >
                  {recoverySubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>جارٍ حفظ كلمة المرور…</span>
                    </>
                  ) : (
                    <>
                      <span>حفظ كلمة المرور الجديدة والدخول</span>
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <>
                {/* Google Material 3 Segmented Mode Switcher (2 Real Modes) */}
                <div className="p-1 rounded-2xl bg-slate-100/90 border border-slate-200/80 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("password");
                      setError("");
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "password"
                        ? "bg-white text-[#004BCE] shadow-xs border border-slate-200 font-black"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>البريد وكلمة المرور</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("otp");
                      setError("");
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "otp"
                        ? "bg-white text-[#004BCE] shadow-xs border border-slate-200 font-black"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>رمز التحقق OTP</span>
                  </button>
                </div>

                {/* =================================================================
                    TAB 1: WORK EMAIL & PASSWORD AUTHENTICATION (Real Supabase Auth)
                    ================================================================= */}
                {activeTab === "password" && (
                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    {/* Email Field with Google Material 3 Outlined Style */}
                    <div className="space-y-1.5">
                      <label htmlFor="work-email" className="text-xs font-bold text-slate-800 block">
                        البريد الإلكتروني الوظيفي *
                      </label>
                      <div className="relative m3-input-field rounded-2xl border border-slate-200 bg-slate-50/60 focus-within:bg-white focus-within:border-[#004BCE]">
                        <div className="absolute right-3.5 top-3 text-slate-400 pointer-events-none">
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
                          className="w-full h-11 pr-10 pl-4 rounded-2xl bg-transparent text-xs font-semibold focus:outline-none text-slate-900 placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Password Field with Caps Lock Detector */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="login-password" className="text-xs font-bold text-slate-800 block">
                          كلمة المرور *
                        </label>
                        <button
                          type="button"
                          onClick={() => setForgotPasswordOpen(true)}
                          className="text-[11px] font-bold text-[#004BCE] hover:underline cursor-pointer"
                        >
                          نسيت كلمة المرور؟
                        </button>
                      </div>
                      <div className="relative m3-input-field rounded-2xl border border-slate-200 bg-slate-50/60 focus-within:bg-white focus-within:border-[#004BCE]">
                        <div className="absolute right-3.5 top-3 text-slate-400 pointer-events-none">
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
                          className="w-full h-11 pr-10 pl-11 rounded-2xl bg-transparent text-xs font-semibold focus:outline-none text-slate-900 placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-3 text-slate-400 hover:text-slate-700 p-0.5 rounded-lg transition-colors cursor-pointer"
                          title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                          aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Caps Lock Alert Chip */}
                      {isCapsLockOn && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                          <span>زر الحروف الكبيرة (Caps Lock) مفعل</span>
                        </div>
                      )}
                    </div>

                    {/* Remember Me Checkbox */}
                    <div className="flex items-center justify-between pt-0.5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-semibold select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 rounded-md border-slate-300 text-[#004BCE] focus:ring-[#004BCE]/40 cursor-pointer accent-[#004BCE]"
                        />
                        <span>تذكر بيانات الدخول على هذا الجهاز</span>
                      </label>
                    </div>

                    {/* Submit Button with Google Material Pill Gradient */}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      aria-label="تسجيل الدخول"
                      className="w-full h-11.5 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#004BCE] via-[#005AD8] to-[#00B5FF] hover:opacity-95 shadow-md shadow-blue-600/25 transition-all gap-2 mt-1 cursor-pointer"
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
                    TAB 2: REAL SUPABASE OTP AUTHENTICATION
                    ================================================================= */}
                {activeTab === "otp" && (
                  <div className="space-y-4">
                    {!otpSent ? (
                      <form onSubmit={handleSendOtp} className="space-y-3.5">
                        <div className="space-y-1.5">
                          <label htmlFor="otp-email" className="text-xs font-bold text-slate-800 block">
                            البريد الإلكتروني الوظيفي لاستلام الرمز *
                          </label>
                          <div className="relative m3-input-field rounded-2xl border border-slate-200 bg-slate-50/60 focus-within:bg-white focus-within:border-[#004BCE]">
                            <div className="absolute right-3.5 top-3 text-slate-400 pointer-events-none">
                              <Mail className="h-4 w-4" />
                            </div>
                            <input
                              id="otp-email"
                              type="email"
                              value={otpEmail}
                              onChange={(e) => setOtpEmail(e.target.value)}
                              placeholder="employee@classera-pulse.com"
                              required
                              autoFocus
                              className="w-full h-11 pr-10 pl-4 rounded-2xl bg-transparent text-xs font-semibold focus:outline-none text-slate-900 placeholder:text-slate-400"
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed">
                            سيتم إرسال رمز تحقق مؤقت (OTP) مكوّن من 6 أرقام إلى بريدك الوظيفي المعتمد في المنظومة.
                          </p>
                        </div>

                        <Button
                          type="submit"
                          disabled={isSubmitting || otpCountdown > 0}
                          className="w-full h-11.5 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#004BCE] to-[#00B5FF] shadow-md shadow-blue-600/25 cursor-pointer gap-2"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-white" />
                              <span>جارٍ إرسال الرمز…</span>
                            </>
                          ) : (
                            <>
                              <KeyRound className="h-4 w-4" />
                              <span>
                                {otpCountdown > 0
                                  ? `إعادة الإرسال بعد (${otpCountdown} ثانية)`
                                  : "إرسال رمز التحقق (OTP)"}
                              </span>
                            </>
                          )}
                        </Button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div className="space-y-2 text-center">
                          <div className="text-xs font-bold text-slate-800">
                            أدخل رمز التحقق المكون من 6 أرقام
                          </div>
                          <p className="text-[11px] text-slate-500">
                            تم إرسال الرمز إلى: <span className="font-semibold text-slate-900">{otpEmail}</span>
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
                              className="h-11 w-11 rounded-xl border border-slate-200 bg-slate-50 text-center font-mono font-black text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004BCE]/40 focus:border-[#004BCE] text-slate-900 shadow-xs"
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
                            className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
                          >
                            تغيير البريد الإلكتروني
                          </button>
                          <button
                            type="button"
                            disabled={otpCountdown > 0 || isSubmitting}
                            onClick={handleSendOtp}
                            className={`font-bold flex items-center gap-1 ${
                              otpCountdown > 0 || isSubmitting
                                ? "text-slate-400 cursor-not-allowed"
                                : "text-[#004BCE] hover:underline cursor-pointer"
                            }`}
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>
                              {otpCountdown > 0
                                ? `إعادة الإرسال بعد (${otpCountdown} ثانية)`
                                : "إعادة إرسال الرمز"}
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
              </>
            )}

            {/* =================================================================
                DEMO MODE PERSONAS QUICK SELECTOR (Interactive Material Chips)
                Visible strictly when demoEnabled === true (Never in Production)
                ================================================================= */}
            {demoEnabled && (
              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-600 flex items-center gap-1.5">
                    <Laptop className="h-3.5 w-3.5 text-[#004BCE]" />
                    <span>تجربة الأدوار الفورية (Persona Demo):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDirectDemoLaunch()}
                    className="text-[11px] font-bold text-[#004BCE] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>دخول سريع</span>
                    <ArrowRight className="h-3 w-3 rotate-180" />
                  </button>
                </div>

                {/* Personas Chips Grid (Pristine Light Style) */}
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
                            ? "border-[#004BCE] bg-blue-50/80 shadow-xs ring-1 ring-[#004BCE]/40"
                            : "border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span
                            className={`h-6 w-6 rounded-lg flex items-center justify-center text-[11px] font-black ${
                              isSelected
                                ? "bg-[#004BCE] text-white"
                                : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 font-mono">
                            {persona.roleCode}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-900 truncate">
                          {persona.nameAr}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
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
                  className="w-full h-10 rounded-2xl font-bold text-xs border-blue-200 bg-blue-50/50 text-[#004BCE] hover:bg-blue-100/60 shadow-xs cursor-pointer transition-all gap-2"
                >
                  <KeyRound className="h-3.5 w-3.5 text-[#004BCE]" />
                  <span>
                    الدخول المباشر إلى النسخة التجريبية {selectedPersona ? `(${selectedPersona.roleTitleAr})` : "(Demo Mode)"}
                  </span>
                </Button>
              </div>
            )}

            {/* Bottom Security Assurance */}
            <div className="pt-1 text-center text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>اتصال آمن ومشفر بالكامل وفق أعلى معايير الحماية المؤسسية</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <footer className="w-full max-w-6xl mx-auto text-center py-2 text-[11px] text-slate-500 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-1">
        <span>جميع الحقوق محفوظة © {new Date().getFullYear()} Classera Pulse — Human Capital Management System</span>
        <span className="text-[10px] text-slate-400">
          بوابة معتمدة لإدارة رأس المال البشري وحماية الأجور
        </span>
      </footer>

      {/* =========================================================================
          FORGOT PASSWORD MODAL (Real Supabase Password Reset)
          ========================================================================= */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 relative space-y-4">
            <button
              type="button"
              onClick={() => setForgotPasswordOpen(false)}
              className="absolute left-4 top-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-blue-50 text-[#004BCE] flex items-center justify-center shrink-0 border border-blue-100">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">استعادة كلمة المرور</h3>
                <p className="text-xs text-slate-500">أدخل بريدك الوظيفي المعتمد لاستلام رابط الاستعادة</p>
              </div>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5 pt-1">
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className="text-xs font-bold text-slate-800 block">
                  البريد الإلكتروني الوظيفي *
                </label>
                <div className="relative m3-input-field rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="absolute right-3.5 top-3 text-slate-400 pointer-events-none">
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
                    className="w-full h-11 pr-10 pl-4 rounded-2xl bg-transparent text-xs font-semibold focus:outline-none text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotPasswordOpen(false)}
                  className="rounded-xl text-xs h-10 px-4 cursor-pointer border-slate-200"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="rounded-xl text-xs h-10 px-5 bg-[#004BCE] text-white hover:bg-[#003EB0] cursor-pointer gap-2 shadow-sm"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>جارٍ إرسال الرابط…</span>
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
