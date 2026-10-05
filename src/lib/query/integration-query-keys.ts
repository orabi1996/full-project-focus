export const integrationQueryKeys = {
  all: ["integrations"] as const,
  overview: (companyId: string) => [...integrationQueryKeys.all, "overview", companyId] as const,
  connectors: (companyId: string, category?: string) =>
    category
      ? ([...integrationQueryKeys.all, "connectors", companyId, category] as const)
      : ([...integrationQueryKeys.all, "connectors", companyId] as const),
  connector: (id: string) => [...integrationQueryKeys.all, "connector", id] as const,
  runs: (companyId: string, filters?: Record<string, unknown>) =>
    filters
      ? ([...integrationQueryKeys.all, "runs", companyId, filters] as const)
      : ([...integrationQueryKeys.all, "runs", companyId] as const),
  runDetails: (runId: string) => [...integrationQueryKeys.all, "run-details", runId] as const,
  apiClients: (companyId: string) => [...integrationQueryKeys.all, "api-clients", companyId] as const,
  webhooks: (companyId: string) => [...integrationQueryKeys.all, "webhooks", companyId] as const,
  webhookDeliveries: (subscriptionId?: string) =>
    subscriptionId
      ? ([...integrationQueryKeys.all, "webhook-deliveries", subscriptionId] as const)
      : ([...integrationQueryKeys.all, "webhook-deliveries"] as const),
  mappings: (companyId: string, connectorId?: string) =>
    connectorId
      ? ([...integrationQueryKeys.all, "mappings", companyId, connectorId] as const)
      : ([...integrationQueryKeys.all, "mappings", companyId] as const),
  files: (companyId: string) => [...integrationQueryKeys.all, "files", companyId] as const,
  secretsMetadata: (companyId: string) => [...integrationQueryKeys.all, "secrets-metadata", companyId] as const,
};
