import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isOtpExpiredError, isRateLimitError, toAuthErrorMessage } from "./auth-errors";
import { isDemoModeEnabled } from "../config/runtime-config";

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("production auth error mapping and categorization", () => {
  it("returns empty string when error is null or undefined", () => {
    expect(toAuthErrorMessage(null)).toBe("");
    expect(toAuthErrorMessage(undefined)).toBe("");
  });

  it("maps rate-limiting errors accurately", () => {
    const err429 = { status: 429, message: "Too Many Requests" };
    const errCode = { code: "over_email_send_rate_limit", message: "rate limit exceeded" };

    expect(toAuthErrorMessage(err429)).toContain("تم تجاوز الحد المسموح به");
    expect(toAuthErrorMessage(errCode)).toContain("تم تجاوز الحد المسموح به");
    expect(isRateLimitError(err429)).toBe(true);
    expect(isRateLimitError(errCode)).toBe(true);
    expect(isRateLimitError({ message: "Invalid credentials" })).toBe(false);
  });

  it("maps invalid credentials to clear localized message", () => {
    const err = { code: "invalid_credentials", message: "Invalid login credentials" };
    expect(toAuthErrorMessage(err)).toBe(
      "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.",
    );
  });

  it("maps unconfirmed email properly", () => {
    const err = { code: "email_not_confirmed", message: "Email not confirmed" };
    expect(toAuthErrorMessage(err)).toContain("لم يتم تأكيد البريد الإلكتروني");
  });

  it("maps unregistered user error properly", () => {
    const err = { code: "user_not_found", message: "User not found" };
    expect(toAuthErrorMessage(err)).toContain("غير مسجل في المنظومة");
  });

  it("maps expired or invalid OTP tokens accurately", () => {
    const expiredErr = { code: "otp_expired", message: "Token has expired" };
    const invalidErr = { message: "token is invalid" };

    expect(toAuthErrorMessage(expiredErr)).toContain("رمز التحقق غير صحيح أو منتهي الصلاحية");
    expect(toAuthErrorMessage(invalidErr)).toContain("رمز التحقق غير صحيح أو منتهي الصلاحية");
    expect(isOtpExpiredError(expiredErr)).toBe(true);
    expect(isOtpExpiredError(invalidErr)).toBe(true);
    expect(isOtpExpiredError({ message: "Network error" })).toBe(false);
  });

  it("maps weak password error properly", () => {
    const err = { code: "weak_password", message: "Password should be at least 6 characters" };
    expect(toAuthErrorMessage(err)).toContain("6 خانات على الأقل");
  });

  it("maps network connection failures safely", () => {
    const err = { message: "Failed to fetch" };
    expect(toAuthErrorMessage(err)).toContain("تعذر الاتصال بخادم المصادقة");
  });

  it("returns fallback message for unknown errors", () => {
    const err = { message: "Some unknown internal database trigger failure" };
    expect(toAuthErrorMessage(err, "خطأ غير متوقع")).toBe("خطأ غير متوقع");
  });
});

describe("production auth security and demo isolation", () => {
  it("strictly disables demo mode in production", () => {
    expect(isDemoModeEnabled("true", true)).toBe(false);
    expect(isDemoModeEnabled("1", true)).toBe(false);
  });

  it("verifies AuthContext does not call enterDemo from verifyOtp or signIn", () => {
    const authCode = source("./AuthContext.tsx");

    // Must never invoke enterDemo inside OTP verification or sign-in
    expect(authCode).not.toMatch(/verifyOtp[\s\S]*?enterDemo\(\)/);
    // enterDemo must check PROD mode
    expect(authCode).toMatch(/if\s*\(import\.meta\.env\.PROD/);
  });

  it("verifies LoginPage has no fake setTimeout authentication flows", () => {
    const loginCode = source("../../components/auth/LoginPage.tsx");

    // OTP verification must not have setTimeout simulating auth
    expect(loginCode).not.toMatch(/handleOtpVerify[\s\S]*?setTimeout/);
    // Must not have fake Absher claims or buttons
    expect(loginCode).not.toContain("أبشر");
    expect(loginCode).not.toContain("نفاذ");
    // Must use real verifyOtp from useAuth
    expect(loginCode).toMatch(/await\s+verifyOtp\(/);
    // Must use real sendOtp from useAuth
    expect(loginCode).toMatch(/await\s+sendOtp\(/);
    // Must use real requestPasswordReset
    expect(loginCode).toMatch(/await\s+requestPasswordReset\(/);
    // Must use real updatePassword
    expect(loginCode).toMatch(/await\s+updatePassword\(/);
  });
});
