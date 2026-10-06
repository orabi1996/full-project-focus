export const taskQueryKeys = {
  all: ["operational-tasks"] as const,
  list: (companyId: string, filters?: Record<string, unknown>) =>
    filters
      ? ([...taskQueryKeys.all, "list", companyId, filters] as const)
      : ([...taskQueryKeys.all, "list", companyId] as const),
  detail: (taskId: string) => [...taskQueryKeys.all, "detail", taskId] as const,
  slaPolicies: (companyId: string) => [...taskQueryKeys.all, "sla-policies", companyId] as const,
  escalations: (taskId: string) => [...taskQueryKeys.all, "escalations", taskId] as const,
  slaEvents: (taskId: string) => [...taskQueryKeys.all, "sla-events", taskId] as const,
};
