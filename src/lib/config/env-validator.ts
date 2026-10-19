/**
 * MadarX Enterprise — Production Environment & Runtime Configuration Validator.
 * Enforces strict environment constraints, preventing misconfigured production deployments.
 * Authoritative Supabase API Key Contract:
 *   - Client/Browser: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 *   - Trusted Server: SUPABASE_URL, SUPABASE_SECRET_KEY
 * Legacy VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are formally deprecated and rejected.
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
    legacyApiKeyDependency: boolean;
    clientSecretExposure: boolean;
  };
}

export interface ServerSecretValidationResult {
  isValid: boolean;
  keyType: "new_secret" | "deprecated_legacy_rejected" | "missing";
  supabaseUrlConfigured: boolean;
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

  // 0. Check for forbidden legacy or leaked client variables
  const hasLegacyAnonKey = Boolean(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY);
  const hasLegacyServiceRoleKey = Boolean(env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY);
  const hasClientSecretLeak = Boolean(
    env.VITE_SUPABASE_SECRET_KEY ||
      env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      env.VITE_DATABASE_URL ||
      env.VITE_POSTGRES_PASSWORD
  );

  if (hasLegacyAnonKey) {
    issues.push(
      "LEGACY_KEY_DEPRECATED: VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY is deprecated and unsupported. Use VITE_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  if (hasLegacyServiceRoleKey) {
    issues.push(
      "LEGACY_KEY_DEPRECATED: SUPABASE_SERVICE_ROLE_KEY is deprecated and unsupported. Use SUPABASE_SECRET_KEY on trusted server only."
    );
  }

  if (hasClientSecretLeak) {
    issues.push(
      "CRITICAL SECURITY DEFECT: Server secret variable prefixed with VITE_ detected. Never expose SUPABASE_SECRET_KEY or database credentials to browser bundles!"
    );
  }

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
  let keyIsSecret = false;

  if (!publishableKey || publishableKey.trim() === "") {
    issues.push("VITE_SUPABASE_PUBLISHABLE_KEY is missing. Public browser key must be configured.");
  } else {
    if (SERVICE_ROLE_PATTERN.test(publishableKey)) {
      keyIsSecret = true;
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
      warnings.push(
        "VITE_SUPABASE_PUBLISHABLE_KEY is using a legacy JWT format. Migration to modern sb_publishable_* format is recommended."
      );
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
      legacyApiKeyDependency: hasLegacyAnonKey || hasLegacyServiceRoleKey,
      clientSecretExposure: hasClientSecretLeak || keyIsSecret,
    },
  };
}

/**
 * Validates backend server-side privileged secret key configuration.
 * Trusted server environments MUST supply SUPABASE_SECRET_KEY (and SUPABASE_URL).
 * Legacy SUPABASE_SERVICE_ROLE_KEY is formally deprecated and rejected.
 */
export function validateServerSecretKey(env: Record<string, string | undefined> = {}): ServerSecretValidationResult {
  const issues: string[] = [];
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  const legacyServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (legacyServiceRoleKey) {
    issues.push(
      "LEGACY_KEY_DEPRECATED: SUPABASE_SERVICE_ROLE_KEY is deprecated and removed. Configure SUPABASE_SECRET_KEY (sb_secret_*) instead."
    );
    if (!secretKey) {
      return {
        isValid: false,
        keyType: "deprecated_legacy_rejected",
        supabaseUrlConfigured: Boolean(supabaseUrl),
        issues,
      };
    }
  }

  if (!secretKey || secretKey.trim() === "") {
    issues.push("SUPABASE_SECRET_KEY is missing. Trusted server admin operations require SUPABASE_SECRET_KEY.");
    return {
      isValid: false,
      keyType: "missing",
      supabaseUrlConfigured: Boolean(supabaseUrl),
      issues,
    };
  }

  if (secretKey.startsWith("sb_publishable_")) {
    issues.push(
      "CRITICAL: A publishable key was provided as SUPABASE_SECRET_KEY. Server admin client requires a privileged secret key (sb_secret_*)."
    );
    return {
      isValid: false,
      keyType: "missing",
      supabaseUrlConfigured: Boolean(supabaseUrl),
      issues,
    };
  }

  return {
    isValid: issues.length === 0,
    keyType: "new_secret",
    supabaseUrlConfigured: Boolean(supabaseUrl),
    issues,
  };
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
