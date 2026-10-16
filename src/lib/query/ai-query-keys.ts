/**
 * MadarX AI Query Keys Factory
 */

export const aiQueryKeys = {
  all: ["ai"] as const,
  conversations: (userId?: string) => [...aiQueryKeys.all, "conversations", userId] as const,
  conversation: (id?: string) => [...aiQueryKeys.all, "conversation", id] as const,
  messages: (conversationId?: string) => [...aiQueryKeys.all, "messages", conversationId] as const,
  kpis: () => [...aiQueryKeys.all, "kpis"] as const,
  insights: (status?: string) => [...aiQueryKeys.all, "insights", status] as const,
  evaluations: () => [...aiQueryKeys.all, "evaluations"] as const,
  providerConfigs: () => [...aiQueryKeys.all, "provider-configs"] as const,
};
