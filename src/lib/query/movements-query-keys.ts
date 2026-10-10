// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 28: MOVEMENTS QUERY KEYS FACTORY
// src/lib/query/movements-query-keys.ts
// ============================================================================

export const movementsQueryKeys = {
  all: ["movements"] as const,
  kpis: (companyId: string) => [...movementsQueryKeys.all, "kpis", companyId] as const,
  list: (companyId: string, filters?: Record<string, unknown>) =>
    filters
      ? ([...movementsQueryKeys.all, "list", companyId, filters] as const)
      : ([...movementsQueryKeys.all, "list", companyId] as const),
  detail: (movementId: string) => [...movementsQueryKeys.all, "detail", movementId] as const,
  employeeHistory: (employeeId: string) =>
    [...movementsQueryKeys.all, "employee-history", employeeId] as const,
  employeeContractVersions: (employeeId: string) =>
    [...movementsQueryKeys.all, "employee-contract-versions", employeeId] as const,
  temporaryAssignments: {
    all: () => [...movementsQueryKeys.all, "temporary-assignments"] as const,
    list: (companyId: string) =>
      [...movementsQueryKeys.temporaryAssignments.all(), "list", companyId] as const,
    byEmployee: (employeeId: string) =>
      [...movementsQueryKeys.temporaryAssignments.all(), "employee", employeeId] as const,
  },
  policies: (companyId: string) => [...movementsQueryKeys.all, "policies", companyId] as const,
};
