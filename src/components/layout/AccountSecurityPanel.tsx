import { useId } from "react";
import { KeyRound, Laptop, ShieldCheck } from "lucide-react";

import type { Language } from "../../types";

interface AccountSecurityPanelProps {
  language: Language;
  isDemo: boolean;
}

const messages = {
  ar: {
    title: "إدارة أمان الحساب",
    unavailable: "غير متاح من هذه الشاشة",
    unknown: "لم يتم التحقق من الحالة",
    introduction:
      "إدارة إعدادات الأمان ليست متاحة من هذه الشاشة حاليًا. تواصل مع مسؤول النظام لمعرفة طريقة إدارة أمان حسابك.",
    demo: "أنت في النسخة التجريبية. لا تُغيَّر إعدادات أي حساب حقيقي هنا.",
    password: "كلمة المرور",
    passwordDescription:
      "تغيير كلمة المرور غير متاح هنا حاليًا. لن نطلب منك إدخال كلمة المرور في هذه الشاشة.",
    mfa: "المصادقة الثنائية",
    mfaDescription:
      "لم يتم التحقق من حالة المصادقة الثنائية لحسابك. لا تعني هذه الرسالة أنها مفعلة أو متوقفة، ولا يمكن تغييرها من هنا.",
    sessions: "الجلسات والأجهزة",
    sessionsDescription:
      "لا تتوفر قائمة موثوقة بالجلسات أو الأجهزة من هذه الشاشة، ولا يمكن إنهاء الجلسات الأخرى من هنا.",
  },
  en: {
    title: "Account security management",
    unavailable: "Unavailable from this screen",
    unknown: "Status not verified",
    introduction:
      "Security settings cannot be managed from this screen yet. Contact your system administrator to find out how to manage your account security.",
    demo: "You are in demo mode. No real account settings are changed here.",
    password: "Password",
    passwordDescription:
      "Password changes are not available here yet. This screen will not ask you to enter your password.",
    mfa: "Two-factor authentication",
    mfaDescription:
      "Your account's two-factor authentication status has not been verified. This does not mean it is enabled or disabled, and it cannot be changed here.",
    sessions: "Sessions and devices",
    sessionsDescription:
      "A verified list of sessions and devices is not available from this screen. Other sessions cannot be ended here.",
  },
} as const;

/** Read-only until verified identity-management operations are integrated. */
export function AccountSecurityPanel({ language, isDemo }: AccountSecurityPanelProps) {
  const id = useId();
  const copy = messages[language];
  const sections = [
    {
      key: "password",
      title: copy.password,
      description: copy.passwordDescription,
      status: copy.unavailable,
      icon: KeyRound,
    },
    {
      key: "mfa",
      title: copy.mfa,
      description: copy.mfaDescription,
      status: copy.unknown,
      icon: ShieldCheck,
    },
    {
      key: "sessions",
      title: copy.sessions,
      description: copy.sessionsDescription,
      status: copy.unavailable,
      icon: Laptop,
    },
  ];

  return (
    <section
      dir={language === "ar" ? "rtl" : "ltr"}
      aria-labelledby={`${id}-title`}
      className="space-y-4 text-start"
    >
      <div className="space-y-2">
        <h3 id={`${id}-title`} className="text-lg font-semibold text-foreground">
          {copy.title}
        </h3>
        <p className="text-base leading-7 text-muted-foreground">{copy.introduction}</p>
        {isDemo && (
          <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-6 text-foreground">
            {copy.demo}
          </p>
        )}
      </div>

      {sections.map(({ key, title, description, status, icon: Icon }) => (
        <section
          key={key}
          aria-labelledby={`${id}-${key}`}
          className="space-y-3 rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4
              id={`${id}-${key}`}
              className="flex items-center gap-2 text-base font-semibold text-foreground"
            >
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
              {title}
            </h4>
            <span className="rounded-md bg-muted px-2 py-1 text-sm text-muted-foreground">
              {status}
            </span>
          </div>
          <p className="text-base leading-7 text-muted-foreground">{description}</p>
        </section>
      ))}
    </section>
  );
}
