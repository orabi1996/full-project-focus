export const auditQueryKeys = {
  all: ["audit"] as const,
  list: (companyId?: string, filters?: Record<string, unknown>) =>
    filters
      ? ([...auditQueryKeys.all, "list", companyId || "all", filters] as const)
      : ([...auditQueryKeys.all, "list", companyId || "all"] as const),
  integrity: (companyId?: string) =>
    [...auditQueryKeys.all, "integrity", companyId || "all"] as const,
  securityEvents: (companyId?: string) =>
    [...auditQueryKeys.all, "security-events", companyId || "all"] as const,
  backgroundJobs: (companyId?: string) =>
    [...auditQueryKeys.all, "background-jobs", companyId || "all"] as const,
  deadLetterJobs: (companyId?: string) =>
    [...auditQueryKeys.all, "dead-letter-jobs", companyId || "all"] as const,
  healthSummary: (companyId?: string) =>
    [...auditQueryKeys.all, "health-summary", companyId || "all"] as const,
};
