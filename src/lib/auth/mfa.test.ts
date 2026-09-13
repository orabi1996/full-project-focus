import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validatePasswordStrength } from "./security";
import { isMfaVerificationError, toAuthErrorMessage } from "./auth-errors";

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("password security policy and validation", () => {
  it("rejects empty or short passwords under 8 characters", () => {
    expect(validatePasswordStrength("").valid).toBe(false);
    expect(validatePasswordStrength("Short1!").valid).toBe(false);
    expect(validatePasswordStrength("Short1!").error).toContain("8 خانات");
  });

  it("rejects simple weak passwords without sufficient character diversity", () => {
    expect(validatePasswordStrength("abcdefgh").valid).toBe(false);
    expect(validatePasswordStrength("12345678").valid).toBe(false);
  });

  it("accepts valid passwords meeting enterprise requirements", () => {
    const medium = validatePasswordStrength("Employee2026");
    expect(medium.valid).toBe(true);
    expect(medium.score).toBeGreaterThanOrEqual(50);

    const strong = validatePasswordStrength("Str0ng!Pass#2026");
    expect(strong.valid).toBe(true);
    expect(strong.score).toBe(100);
  });
});

describe("MFA error mapping and categorization", () => {
  it("maps invalid MFA TOTP codes accurately to clear Arabic messages", () => {
    const err = { code: "mfa_verification_failed", message: "Invalid TOTP code" };
    expect(toAuthErrorMessage(err)).toContain("رمز التحقق من تطبيق المصادقة غير صحيح");
    expect(isMfaVerificationError(err)).toBe(true);
  });

  it("maps expired MFA challenges accurately", () => {
    const err = { code: "mfa_challenge_expired", message: "Challenge has expired" };
    expect(toAuthErrorMessage(err)).toContain("انتهت صلاحية جلسة التحقق");
  });

  it("maps unverified or missing MFA factors accurately", () => {
    const err = { code: "mfa_factor_not_found", message: "Factor not found" };
    expect(toAuthErrorMessage(err)).toContain("عامل المصادقة غير مسجل");
  });

  it("maps insufficient assurance level (AAL2)", () => {
    const err = { code: "insufficient_aal", message: "AAL2 required" };
    expect(toAuthErrorMessage(err)).toContain("AAL2");
  });
});

describe("AccountSecurityModal production contracts", () => {
  const modalCode = source("../../components/layout/AccountSecurityModal.tsx");

  it("does not use fake setTimeout for password changes", () => {
    const passwordFunctionMatch = modalCode.match(
      /const handleUpdatePassword = async[\s\S]*?\n\s*\};/,
    );
    expect(passwordFunctionMatch).not.toBeNull();
    expect(passwordFunctionMatch?.[0]).not.toContain("setTimeout");
    expect(modalCode).toContain("changeUserPassword");
  });

  it("does not contain fake hardcoded IP or device location", () => {
    expect(modalCode).not.toContain("158.140.22.81");
    expect(modalCode).not.toMatch(/المملكة العربية السعودية، الرياض • IP/);
  });

  it("does not claim SMS MFA exists", () => {
    expect(modalCode).not.toContain("رسالة SMS أو تطبيق المصادقة");
  });

  it("derives 2FA state from real Supabase factors, not a local boolean toggle", () => {
    expect(modalCode).not.toContain("is2FAEnabled");
    expect(modalCode).toContain("mfaFactors");
    expect(modalCode).toContain("verifiedTotpFactor");
  });

  it("uses real Supabase terminate other sessions", () => {
    expect(modalCode).toContain("terminateOtherSessions");
  });

  it("guards against demo mode tampering with production authentication", () => {
    expect(modalCode).toContain("isDemo");
    expect(modalCode).toMatch(/if\s*\(isDemo\)/);
  });
});

describe("MFA enforcement and isolation contracts", () => {
  const authGateCode = source("../../components/auth/AuthGate.tsx");
  const authContextCode = source("./AuthContext.tsx");
  const mfaGateCode = source("../../components/auth/MfaVerificationGate.tsx");

  it("enforces AAL2 in AuthGate so navigation or page refresh cannot bypass MFA", () => {
    expect(authGateCode).toContain("needsMfa");
    expect(authGateCode).toContain("<MfaVerificationGate");
  });

  it("verifies MFA verification never calls enterDemo", () => {
    expect(authContextCode).not.toMatch(/verifyMfaLogin[\s\S]*?enterDemo\(\)/);
    expect(mfaGateCode).not.toContain("enterDemo");
  });

  it("verifies security module never logs passwords or secrets", () => {
    const securityCode = source("./security.ts");
    expect(securityCode).not.toMatch(/console\.log\(.*password/i);
    expect(securityCode).not.toMatch(/console\.log\(.*secret/i);
  });
});
