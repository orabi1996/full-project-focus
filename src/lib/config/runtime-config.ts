export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

const PLACEHOLDER_VALUE = /(your[-_ ]?project|example|placeholder|replace[-_ ]?me)/i;

export function isDemoModeEnabled(value: string | undefined, isProduction: boolean): boolean {
  if (isProduction) return false;
  return value?.trim().toLowerCase() === "true";
}

export function assertValidSupabasePublicConfig({
  url,
  publishableKey,
}: SupabasePublicConfig): void {
  const issues: string[] = [];

  if (!url || PLACEHOLDER_VALUE.test(url)) {
    issues.push("VITE_SUPABASE_URL");
  } else {
    try {
      const parsedUrl = new URL(url);
      const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(parsedUrl.hostname);
      if (parsedUrl.protocol !== "https:" && !isLocalDevelopment) {
        issues.push("VITE_SUPABASE_URL (HTTPS required)");
      }
    } catch {
      issues.push("VITE_SUPABASE_URL (invalid URL)");
    }
  }

  if (!publishableKey || PLACEHOLDER_VALUE.test(publishableKey)) {
    issues.push("VITE_SUPABASE_PUBLISHABLE_KEY");
  } else if (publishableKey.startsWith("sb_secret_") || /service[_-]?role/i.test(publishableKey)) {
    issues.push("VITE_SUPABASE_PUBLISHABLE_KEY (public key required)");
  }

  if (issues.length > 0) {
    throw new Error(
      `Invalid public Supabase configuration: ${issues.join(", ")}. Configure the deployment environment before starting Focus HRMS.`,
    );
  }
}
