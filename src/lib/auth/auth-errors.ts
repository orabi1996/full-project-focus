import type { AuthError } from "@supabase/supabase-js";

/**
 * Maps Supabase Auth errors and codes into safe, professional, localized Arabic messages.
 * Prevents leaking technical internal details or server stack traces to users.
 */
export function toAuthErrorMessage(error: unknown, fallbackMessage = "تعذر إتمام العملية. يرجى المحاولة لاحقاً."): string {
  if (!error) return "";

  const err = error as Partial<AuthError> & { message?: string; code?: string; status?: number };
  const rawMessage = String(err.message || "").toLowerCase();
  const code = String(err.code || "").toLowerCase();
  const status = Number(err.status || 0);

  // Rate Limiting (HTTP 429 or over rate limit codes)
  if (
    status === 429 ||
    code.includes("rate_limit") ||
    rawMessage.includes("rate limit") ||
    rawMessage.includes("too many requests") ||
    rawMessage.includes("over_email_send_rate_limit")
  ) {
    return "تم تجاوز الحد المسموح به للمحاولات. يرجى الانتظار دقيقة واحدة قبل إعادة المحاولة.";
  }

  // Invalid Credentials
  if (
    code === "invalid_credentials" ||
    rawMessage.includes("invalid login credentials") ||
    rawMessage.includes("invalid username or password") ||
    rawMessage.includes("invalid email or password")
  ) {
    return "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.";
  }

  // Email Not Confirmed
  if (
    code === "email_not_confirmed" ||
    rawMessage.includes("email not confirmed")
  ) {
    return "لم يتم تأكيد البريد الإلكتروني بعد. يرجى مراجعة صندوق البريد الوارد لتفعيل الحساب.";
  }

  // User Not Found
  if (
    code === "user_not_found" ||
    rawMessage.includes("user not found")
  ) {
    return "البريد الإلكتروني المدخل غير مسجل في المنظومة.";
  }

  // OTP Expired or Invalid Token
  if (
    code === "otp_expired" ||
    code === "token_expired" ||
    code === "invalid_token" ||
    rawMessage.includes("token has expired") ||
    rawMessage.includes("otp has expired") ||
    rawMessage.includes("invalid token") ||
    rawMessage.includes("token is invalid") ||
    rawMessage.includes("token has expired or is invalid") ||
    ((rawMessage.includes("token") || rawMessage.includes("otp")) && rawMessage.includes("invalid"))
  ) {
    return "رمز التحقق غير صحيح أو منتهي الصلاحية. يرجى طلب رمز جديد والمحاولة مجدداً.";
  }

  // Weak Password
  if (
    code === "weak_password" ||
    rawMessage.includes("password should be at least") ||
    rawMessage.includes("password is too short")
  ) {
    return "يجب أن تتكون كلمة المرور من 6 خانات على الأقل.";
  }

  // Same Password on Reset
  if (
    code === "same_password" ||
    rawMessage.includes("should be different from the old password")
  ) {
    return "كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور السابقة.";
  }

  // Network / Connection Failures
  if (
    rawMessage.includes("network") ||
    rawMessage.includes("fetch") ||
    rawMessage.includes("failed to fetch") ||
    rawMessage.includes("connection refused")
  ) {
    return "تعذر الاتصال بخادم المصادقة. يرجى التحقق من اتصال الإنترنت.";
  }

  // Session Expired
  if (
    code === "session_expired" ||
    rawMessage.includes("session expired") ||
    rawMessage.includes("refresh_token_not_found")
  ) {
    return "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً لمتابعة العمل بأمان.";
  }

  return fallbackMessage;
}

export function isRateLimitError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { message?: string; code?: string; status?: number };
  const raw = String(err.message || "").toLowerCase();
  const code = String(err.code || "").toLowerCase();
  return (
    err.status === 429 ||
    code.includes("rate_limit") ||
    raw.includes("rate limit") ||
    raw.includes("too many requests") ||
    raw.includes("over_email_send_rate_limit")
  );
}

export function isOtpExpiredError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { message?: string; code?: string };
  const raw = String(err.message || "").toLowerCase();
  const code = String(err.code || "").toLowerCase();
  return (
    code === "otp_expired" ||
    code === "token_expired" ||
    code === "invalid_token" ||
    code.includes("expired") ||
    raw.includes("expired") ||
    ((raw.includes("token") || raw.includes("otp")) && raw.includes("invalid"))
  );
}
