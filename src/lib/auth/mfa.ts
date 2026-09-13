import type { Factor } from "@supabase/supabase-js";
import { supabase } from "../../integrations/supabase/client";
import { toAuthErrorMessage } from "./auth-errors";

export interface EnrolledTotpData {
  id: string;
  type: "totp";
  qrCode: string;
  secret: string;
  uri: string;
}

export interface MfaAssuranceLevelResult {
  currentLevel: "aal1" | "aal2";
  nextLevel: "aal1" | "aal2";
  error?: string;
}

/**
 * Returns all enrolled MFA factors for the current user session.
 */
export async function listUserMfaFactors(): Promise<{
  all: Factor[];
  totp: Factor[];
  verifiedTotp: Factor[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      return { all: [], totp: [], verifiedTotp: [], error: toAuthErrorMessage(error) };
    }

    const all = data?.all ?? [];
    const totp = data?.totp ?? [];
    const verifiedTotp = totp.filter((f) => f.status === "verified");

    return { all, totp, verifiedTotp };
  } catch (err) {
    return { all: [], totp: [], verifiedTotp: [], error: toAuthErrorMessage(err) };
  }
}

/**
 * Returns current Authenticator Assurance Level (AAL) for the active session.
 */
export async function getMfaAssuranceLevel(): Promise<MfaAssuranceLevelResult> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      return { currentLevel: "aal1", nextLevel: "aal1", error: toAuthErrorMessage(error) };
    }

    const currentLevel = (data?.currentLevel ?? "aal1") as "aal1" | "aal2";
    const nextLevel = (data?.nextLevel ?? "aal1") as "aal1" | "aal2";

    return { currentLevel, nextLevel };
  } catch (err) {
    return { currentLevel: "aal1", nextLevel: "aal1", error: toAuthErrorMessage(err) };
  }
}

/**
 * Initiates TOTP MFA factor enrollment.
 * Returns the unverified factor details including QR code and secret for authenticator apps.
 */
export async function enrollTotpFactor(friendlyName = "تطبيق المصادقة (Authenticator)"): Promise<{
  data?: EnrolledTotpData;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "Classera Pulse HRMS",
      friendlyName: friendlyName.trim(),
    });

    if (error) {
      return { error: toAuthErrorMessage(error) };
    }

    if (!data || !data.totp) {
      return { error: "تعذر توليد بيانات رمز المصادقة. يرجى المحاولة لاحقاً." };
    }

    // Standardize QR code into an image data URI if returned as raw SVG markup
    let rawQr = data.totp.qr_code;
    if (rawQr.startsWith("<svg") || rawQr.includes("<svg")) {
      rawQr = `data:image/svg+xml;utf-8,${encodeURIComponent(rawQr)}`;
    }

    return {
      data: {
        id: data.id,
        type: "totp",
        qrCode: rawQr,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
    };
  } catch (err) {
    return { error: toAuthErrorMessage(err) };
  }
}

/**
 * Challenges and verifies a TOTP code against an enrolled factor.
 * Promotes the active session to AAL2 upon success.
 */
export async function verifyMfaFactor(
  factorId: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanCode = code.trim().replace(/\s+/g, "");
    if (!cleanCode || cleanCode.length !== 6) {
      return { success: false, error: "يجب إدخال رمز التحقق المكون من 6 أرقام." };
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: cleanCode,
    });

    if (error) {
      return { success: false, error: toAuthErrorMessage(error) };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: toAuthErrorMessage(err) };
  }
}

/**
 * Unenrolls/removes a registered MFA factor.
 * Requires appropriate authorization/AAL level.
 */
export async function unenrollMfaFactor(
  factorId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      return { success: false, error: toAuthErrorMessage(error) };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: toAuthErrorMessage(err) };
  }
}
