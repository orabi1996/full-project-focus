/**
 * Centralized, hierarchical query key factories for Employee Self-Service (ESS)
 * and Manager Self-Service (MSS).
 */
export const essQueryKeys = {
  all: ["ess"] as const,
  profile: (companyId?: string) => [...essQueryKeys.all, "profile", companyId ?? "current"] as const,
  myRequests: (companyId?: string, filters?: Record<string, unknown>) =>
    filters
      ? ([...essQueryKeys.all, "my-requests", companyId ?? "current", filters] as const)
      : ([...essQueryKeys.all, "my-requests", companyId ?? "current"] as const),
  myAttendance: (companyId?: string, month?: string) =>
    [...essQueryKeys.all, "my-attendance", companyId ?? "current", month ?? "current"] as const,
  myLeaves: (companyId?: string) => [...essQueryKeys.all, "my-leaves", companyId ?? "current"] as const,
  myPayroll: (companyId?: string) => [...essQueryKeys.all, "my-payroll", companyId ?? "current"] as const,
  myExpenses: (companyId?: string) => [...essQueryKeys.all, "my-expenses", companyId ?? "current"] as const,
  myDocuments: (companyId?: string) => [...essQueryKeys.all, "my-documents", companyId ?? "current"] as const,
  myAssets: (companyId?: string) => [...essQueryKeys.all, "my-assets", companyId ?? "current"] as const,
  myPerformance: (companyId?: string) => [...essQueryKeys.all, "my-performance", companyId ?? "current"] as const,
  myProfileChangeRequests: (companyId?: string) =>
    [...essQueryKeys.all, "my-profile-change-requests", companyId ?? "current"] as const,

  // Manager Self-Service (MSS)
  team: {
    all: () => [...essQueryKeys.all, "team"] as const,
    summary: (companyId?: string) => [...essQueryKeys.all, "team", "summary", companyId ?? "current"] as const,
    members: (companyId?: string) => [...essQueryKeys.all, "team", "members", companyId ?? "current"] as const,
    pendingApprovals: (companyId?: string) =>
      [...essQueryKeys.all, "team", "pending-approvals", companyId ?? "current"] as const,
    todayAttendance: (companyId?: string) =>
      [...essQueryKeys.all, "team", "attendance-today", companyId ?? "current"] as const,
  },
} as const;
