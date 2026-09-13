export const MODULE_ROUTE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  organization: "/organization",
  employees: "/employees",
  documents: "/documents",
  rbac: "/rbac",
  workflow: "/workflows",
  leaves: "/leaves",
  attendance: "/attendance",
  shifts: "/shifts",
  payroll: "/payroll",
  loans: "/loans",
  expenses: "/expenses",
  ats: "/recruitment",
  performance: "/performance",
  workforce: "/workforce",
  assets: "/assets",
  reports: "/reports",
  integrations: "/integrations",
  audit: "/audit",
  ess: "/ess",
};

export const LEGACY_HASH_MAP: Record<string, string> = {
  "#dashboard": "/dashboard",
  "#organization": "/organization",
  "#employees": "/employees",
  "#documents": "/documents",
  "#rbac": "/rbac",
  "#workflow": "/workflows",
  "#leaves": "/leaves",
  "#attendance": "/attendance",
  "#shifts": "/shifts",
  "#payroll": "/payroll",
  "#loans": "/loans",
  "#expenses": "/expenses",
  "#performance": "/performance",
  "#ats": "/recruitment",
  "#workforce": "/workforce",
  "#assets": "/assets",
  "#reports": "/reports",
  "#integrations": "/integrations",
  "#audit": "/audit",
  "#ess": "/ess",
};

/**
 * Checks whether a given hash fragment corresponds to a known legacy HRMS screen.
 * Ignores Supabase auth redirect tokens (access_token, type=recovery, error).
 */
export function getLegacyHashRedirect(hash: string): string | null {
  if (!hash || !hash.startsWith("#")) return null;
  if (
    hash.includes("access_token") ||
    hash.includes("type=recovery") ||
    hash.includes("error=") ||
    hash.includes("refresh_token")
  ) {
    return null;
  }
  const clean = hash.trim().toLowerCase();
  return LEGACY_HASH_MAP[clean] || null;
}
