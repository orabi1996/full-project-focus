import React, { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { ShieldCheck, Lock, LogOut, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { Button } from "../ui/button";
import { AppLogo } from "../common/AppLogo";
import { toast } from "sonner";

export function MfaVerificationGate() {
  const { session, verifyMfaLogin, signOut } = useAuth();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const userEmail = session?.user?.email || "المستخدم";

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const nextDigits = [...digits];
    nextDigits[index] = value.slice(-1);
    setDigits(nextDigits);

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const nextDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = pasted[i] || "";
    }
    setDigits(nextDigits);
    const nextFocus = Math.min(pasted.length, 5);
    inputsRef.current[nextFocus]?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const fullCode = digits.join("");
    if (fullCode.length !== 6) {
      triggerError("يرجى إدخال رمز التحقق كاملاً المكون من 6 أرقام");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const result = await verifyMfaLogin(fullCode);

    if (result.error) {
      triggerError(result.error);
    } else {
      toast.success("تم توثيق الهوية بنجاح عبر تطبيق المصادقة (AAL2).");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 via-[#F8FAFC] to-blue-50/40 p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/80">
        <div className="flex flex-col items-center text-center space-y-3">
          <AppLogo variant="horizontal" className="h-9" />

          <div className="h-14 w-14 rounded-2xl bg-blue-50 text-[#004BCE] border border-blue-100 flex items-center justify-center mt-2 shadow-xs">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-900">
              التحقق الثنائي عبر تطبيق المصادقة (MFA)
            </h2>
            <p className="text-xs font-medium text-slate-500 max-w-xs mx-auto">
              حسابك محمي بنظام التحقق الثنائي. يرجى فتح تطبيق المصادقة (Google Authenticator أو ما يماثله) وإدخال الرمز المكون من 6 أرقام لـ ({userEmail}).
            </p>
          </div>
        </div>

        {error && (
          <div
            className={`mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center gap-2 ${
              shake ? "animate-m3-shake" : ""
            }`}
          >
            <Lock className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-600 block text-center">
              رمز التحقق المؤقت (TOTP Code)
            </label>
            <div className="flex justify-center gap-2" dir="ltr" onPaste={handlePaste}>
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputsRef.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  disabled={isSubmitting}
                  className="w-11 h-12 text-center text-lg font-bold font-mono rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:border-[#004BCE] focus:ring-2 focus:ring-[#004BCE]/20 transition-all disabled:opacity-50"
                  autoFocus={idx === 0}
                />
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || digits.join("").length !== 6}
            className="w-full h-11 rounded-full text-xs font-black bg-[#004BCE] hover:bg-[#003da6] text-white shadow-md shadow-blue-500/10 gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جارٍ التحقق وتأكيد الجلسة…</span>
              </>
            ) : (
              <>
                <span>تأكيد الدخول الموثق</span>
                <ArrowLeft className="h-4 w-4" />
              </>
            )}
          </Button>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void signOut()}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 gap-1.5 rounded-full"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>تسجيل الخروج والرجوع</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
