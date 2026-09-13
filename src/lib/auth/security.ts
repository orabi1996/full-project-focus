import { supabase } from "../../integrations/supabase/client";
import { toAuthErrorMessage } from "./auth-errors";
import { createAuditEventRecord } from "../data/operational-repository";

export interface PasswordStrengthResult {
  valid: boolean;
  score: number;
  label: string;
  color: string;
  error?: string;
}

/**
 * Validates password against enterprise security policy:
 * - Minimum 8 characters
 * - Must contain at least mixed characters (letters + numbers or symbols)
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { valid: false, score: 0, label: "فارغة", color: "bg-muted", error: "يرجى إدخال كلمة المرور" };
  }

  if (password.length < 8) {
    return {
      valid: false,
      score: 25,
      label: "قصيرة جداً",
      color: "bg-destructive",
      error: "يجب ألا تقل كلمة المرور عن 8 خانات",
    };
  }

  let diversityCount = 0;
  if (/[a-z]/.test(password)) diversityCount += 1;
  if (/[A-Z]/.test(password)) diversityCount += 1;
  if (/[0-9]/.test(password)) diversityCount += 1;
  if (/[^A-Za-z0-9]/.test(password)) diversityCount += 1;

  if (diversityCount < 2) {
    return {
      valid: false,
      score: 25,
      label: "ضعيفة جداً",
      color: "bg-destructive",
      error: "كلمة المرور ضعيفة. يرجى المزج بين الحروف والأرقام أو الرموز.",
    };
  }

  if (diversityCount === 2) {
    return { valid: true, score: 50, label: "متوسطة ومقبولة", color: "bg-amber-500" };
  }

  if (diversityCount === 3) {
    return { valid: true, score: 75, label: "جيدة ومحمية", color: "bg-blue-500" };
  }

  return { valid: true, score: 100, label: "قوية جداً ومحمية", color: "bg-emerald-600" };
}

/**
 * Re-authenticates the current user session before performing a sensitive security operation.
 * Validates current password securely through Supabase Auth.
 * Passwords are never stored or logged.
 */
export async function reauthenticateUser(currentPassword: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user.email;

    if (!email) {
      return { success: false, error: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً." };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (error) {
      return {
        success: false,
        error: "كلمة المرور الحالية غير صحيحة. يرجى التأكد من إدخالها بدقة.",
      };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: toAuthErrorMessage(err) };
  }
}

/**
 * Securely changes the user password:
 * 1. Validates current password via re-authentication.
 * 2. Enforces password policy (>= 8 chars, strength).
 * 3. Updates password via Supabase Auth.
 * 4. Records security audit event (without sensitive data).
 */
export async function changeUserPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return { success: false, error: strength.error || "كلمة المرور لا تستوفي معايير الأمان" };
    }

    // Sensitive action re-authentication
    const reauth = await reauthenticateUser(currentPassword);
    if (!reauth.success) {
      return { success: false, error: reauth.error };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return { success: false, error: toAuthErrorMessage(updateError) };
    }

    // Audit log event without passwords
    void recordSecurityAuditEvent("PASSWORD_CHANGED", "تم تحديث كلمة المرور للحساب بنجاح.");

    return { success: true };
  } catch (err) {
    return { success: false, error: toAuthErrorMessage(err) };
  }
}

/**
 * Terminates all other active user sessions across other browsers/devices using Supabase Auth.
 */
export async function terminateOtherSessions(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) {
      return { success: false, error: toAuthErrorMessage(error) };
    }

    void recordSecurityAuditEvent(
      "TERMINATE_OTHER_SESSIONS",
      "تم طلب إلغاء وإنهاء كافة الجلسات الأخرى المرتبطة بالحساب.",
    );

    return { success: true };
  } catch (err) {
    return { success: false, error: toAuthErrorMessage(err) };
  }
}

/**
 * Safely records a security audit event into the enterprise audit log.
 * Never records passwords, OTPs, TOTP secrets, or access tokens.
 */
export async function recordSecurityAuditEvent(
  action: string,
  changesSummary: string,
  entityId?: string,
): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    await createAuditEventRecord({
      id: `sec-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      actorId: user?.id || "unknown",
      actorName: user?.email || "User",
      actorRole: "Security Guard",
      action,
      entityType: "account_security",
      entityId: entityId || user?.id || "account",
      entityName: "Account Security Service",
      timestamp: new Date().toISOString(),
      changesSummary,
    });
  } catch {
    // Non-blocking for UI operations
  }
}
