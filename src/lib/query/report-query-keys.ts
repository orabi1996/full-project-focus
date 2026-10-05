export const reportQueryKeys = {
  all: ["reports"] as const,
  catalog: (category?: string) =>
    category ? ([...reportQueryKeys.all, "catalog", category] as const) : ([...reportQueryKeys.all, "catalog"] as const),
  metrics: (domain?: string) =>
    domain ? ([...reportQueryKeys.all, "metrics", domain] as const) : ([...reportQueryKeys.all, "metrics"] as const),
  executiveKpis: (filters?: Record<string, unknown>) =>
    filters ? ([...reportQueryKeys.all, "executiveKpis", filters] as const) : ([...reportQueryKeys.all, "executiveKpis"] as const),
  data: (
    reportCode: string,
    filters?: Record<string, unknown>,
    pagination?: Record<string, unknown>,
    sort?: Record<string, unknown>
  ) =>
    [...reportQueryKeys.all, "data", reportCode, filters ?? {}, pagination ?? {}, sort ?? {}] as const,
  savedFilters: (reportCode?: string) =>
    reportCode ? ([...reportQueryKeys.all, "savedFilters", reportCode] as const) : ([...reportQueryKeys.all, "savedFilters"] as const),
  favorites: (userId?: string) =>
    userId ? ([...reportQueryKeys.all, "favorites", userId] as const) : ([...reportQueryKeys.all, "favorites"] as const),
  recents: (userId?: string) =>
    userId ? ([...reportQueryKeys.all, "recents", userId] as const) : ([...reportQueryKeys.all, "recents"] as const),
  scheduled: () => [...reportQueryKeys.all, "scheduled"] as const,
  exportJobs: (status?: string) =>
    status ? ([...reportQueryKeys.all, "exportJobs", status] as const) : ([...reportQueryKeys.all, "exportJobs"] as const),
};
