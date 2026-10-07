/**
 * MadarX Enterprise — Production Environment & Runtime Configuration Validator.
 * Enforces strict environment constraints, preventing misconfigured production deployments.
 * Supports migration from legacy JWT keys to new Supabase Publishable & Secret Key model.
 */

export interface EnvValidationResult {
  isValid: boolean;
  mode: "production" | "development" | "test";
  issues: string[];
  warnings: string[];
  configSummary: {
    supabaseUrlConfigured: boolean;
    publishableKeyConfigured: boolean;
    publishableKeyFormat: "new_publishable" | "legacy_jwt" | "missing";
    demoModeActive: boolean;
    httpsEnforced: boolean;
  };
}

export interface ServerSecretValidationResult {
  isValid: boolean;
  keyType: "new_secret" | "legacy_service_role" | "missing";
  issues: string[];
}

const PLACEHOLDER_PATTERN = /(your[-_ ]?project|example|placeholder|replace[-_ ]?me|localhost)/i;
const SERVICE_ROLE_PATTERN = /(service[_-]?role|sb_secret_|secret_key)/i;

/**
 * Checks if a Supabase key uses the modern opaque key format (sb_publishable_ / sb_secret_).
 */
export function isNewSupabaseApiKey(value: string | undefined): boolean {
  if (!value) return false;
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/**
 * Validates the runtime environment against enterprise production standards.
 */
export function validateEnvironment(env: Record<string, string | undefined> = {}): EnvValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  const nodeEnv = (env.NODE_ENV || import.meta.env?.MODE || "development").toLowerCase();
  const isProduction = nodeEnv === "production" || import.meta.env?.PROD === true;
  const mode = isProduction ? "production" : nodeEnv === "test" ? "test" : "development";

  // 1. Supabase URL Validation
  const supabaseUrl =
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    (typeof import.meta !== "undefined" ? import.meta.env?.["VITE_SUPABASE_URL"] : undefined);

  let httpsEnforced = false;
  if (!supabaseUrl || supabaseUrl.trim() === "") {
    issues.push("VITE_SUPABASE_URL is missing. Production backend URL must be provided.");
  } else {
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol === "https:") {
        httpsEnforced = true;
      } else if (isProduction) {
        issues.push("VITE_SUPABASE_URL must use secure HTTPS in production environment.");
      }

      if (isProduction && PLACEHOLDER_PATTERN.test(parsed.hostname)) {
        issues.push(`VITE_SUPABASE_URL contains invalid placeholder hostname: ${parsed.hostname}`);
      }
    } catch {
      issues.push("VITE_SUPABASE_URL is not a valid URL format.");
    }
  }

  // 2. Publishable API Key Validation
  const publishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    (typeof import.meta !== "undefined" ? import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"] : undefined);

  let publishableKeyFormat: "new_publishable" | "legacy_jwt" | "missing" = "missing";

  if (!publishableKey || publishableKey.trim() === "") {
    issues.push("VITE_SUPABASE_PUBLISHABLE_KEY is missing. Public browser key must be configured.");
  } else {
    if (SERVICE_ROLE_PATTERN.test(publishableKey)) {
      issues.push(
        "CRITICAL SECURITY DEFECT: A service-role or secret key was provided as publishable key. Never expose admin keys on client!"
      );
    }
    if (isProduction && /(placeholder|replace|example)/i.test(publishableKey)) {
      issues.push("VITE_SUPABASE_PUBLISHABLE_KEY contains placeholder text.");
    }

    if (publishableKey.startsWith("sb_publishable_")) {
      publishableKeyFormat = "new_publishable";
    } else if (publishableKey.startsWith("ey")) {
      publishableKeyFormat = "legacy_jwt";
      warnings.push("VITE_SUPABASE_PUBLISHABLE_KEY is using a legacy JWT format. Migration to modern sb_publishable_* format is recommended.");
    } else {
      publishableKeyFormat = "new_publishable";
    }
  }

  // 3. Demo Mode Isolation
  const rawDemoMode =
    env.VITE_ENABLE_DEMO_MODE ||
    (typeof import.meta !== "undefined" ? import.meta.env?.["VITE_ENABLE_DEMO_MODE"] : undefined);
  const demoModeActive = rawDemoMode?.trim().toLowerCase() === "true";

  if (isProduction && demoModeActive) {
    issues.push("CRITICAL: VITE_ENABLE_DEMO_MODE cannot be enabled in production. Demo mode must be disabled.");
  }

  // 4. Optional Storage & Service Integration Warnings
  if (!env.VITE_STORAGE_BUCKET_DOCS && isProduction) {
    warnings.push("VITE_STORAGE_BUCKET_DOCS not explicitly specified, falling back to default 'documents' bucket.");
  }

  return {
    isValid: issues.length === 0,
    mode,
    issues,
    warnings,
    configSummary: {
      supabaseUrlConfigured: Boolean(supabaseUrl),
      publishableKeyConfigured: Boolean(publishableKey),
      publishableKeyFormat,
      demoModeActive: !isProduction && demoModeActive,
      httpsEnforced,
    },
  };
}

/**
 * Validates backend server-side privileged secret key configuration.
 * Server environments should supply SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY for fallback).
 */
export function validateServerSecretKey(env: Record<string, string | undefined> = {}): ServerSecretValidationResult {
  const issues: string[] = [];
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || secretKey.trim() === "") {
    issues.push("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing. Server admin operations will fail.");
    return { isValid: false, keyType: "missing", issues };
  }

  if (secretKey.startsWith("sb_publishable_")) {
    issues.push("CRITICAL: A publishable key was provided as SUPABASE_SECRET_KEY. Server admin client requires a privileged secret key.");
    return { isValid: false, keyType: "missing", issues };
  }

  if (secretKey.startsWith("sb_secret_")) {
    return { isValid: true, keyType: "new_secret", issues: [] };
  }

  return { isValid: true, keyType: "legacy_service_role", issues: [] };
}

/**
 * Asserts production readiness and throws an explicit error if critical requirements fail.
 */
export function assertProductionReadiness(env: Record<string, string | undefined> = {}): void {
  const result = validateEnvironment(env);
  if (!result.isValid) {
    const errorMsg = [
      `======================================================`,
      `[MADARX PRODUCTION READINESS ERROR] Startup Blocked:`,
      ...result.issues.map((i) => ` - ❌ ${i}`),
      `======================================================`,
    ].join("\n");
    throw new Error(errorMsg);
  }
}
