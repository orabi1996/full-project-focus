// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 31: PRODUCTION ENGAGEMENT, SURVEYS & RECOGNITION QUERY KEYS FACTORY
// src/lib/query/engagement-query-keys.ts
// ============================================================================

export const engagementQueryKeys = {
  all: ["engagement"] as const,
  kpis: (companyId: string) => [...engagementQueryKeys.all, "kpis", companyId] as const,
  templates: {
    all: () => [...engagementQueryKeys.all, "templates"] as const,
    list: (companyId: string) => [...engagementQueryKeys.templates.all(), "list", companyId] as const,
    detail: (templateId: string) => [...engagementQueryKeys.templates.all(), "detail", templateId] as const,
  },
  questions: {
    all: () => [...engagementQueryKeys.all, "questions"] as const,
    list: (companyId: string, category?: string) =>
      category
        ? ([...engagementQueryKeys.questions.all(), "list", companyId, category] as const)
        : ([...engagementQueryKeys.questions.all(), "list", companyId] as const),
  },
  surveys: {
    all: () => [...engagementQueryKeys.all, "surveys"] as const,
    list: (companyId: string, status?: string) =>
      status
        ? ([...engagementQueryKeys.surveys.all(), "list", companyId, status] as const)
        : ([...engagementQueryKeys.surveys.all(), "list", companyId] as const),
    detail: (surveyId: string) => [...engagementQueryKeys.surveys.all(), "detail", surveyId] as const,
    analytics: (companyId: string, surveyId: string) =>
      [...engagementQueryKeys.surveys.all(), "analytics", companyId, surveyId] as const,
    participants: (companyId: string, surveyId: string) =>
      [...engagementQueryKeys.surveys.all(), "participants", companyId, surveyId] as const,
    myPendingSurveys: (companyId: string, employeeId: string) =>
      [...engagementQueryKeys.surveys.all(), "my-pending", companyId, employeeId] as const,
  },
  actionPlans: {
    all: () => [...engagementQueryKeys.all, "action-plans"] as const,
    list: (companyId: string, surveyId?: string) =>
      surveyId
        ? ([...engagementQueryKeys.actionPlans.all(), "list", companyId, surveyId] as const)
        : ([...engagementQueryKeys.actionPlans.all(), "list", companyId] as const),
    detail: (planId: string) => [...engagementQueryKeys.actionPlans.all(), "detail", planId] as const,
  },
  recognitions: {
    all: () => [...engagementQueryKeys.all, "recognitions"] as const,
    feed: (companyId: string) => [...engagementQueryKeys.recognitions.all(), "feed", companyId] as const,
    byEmployee: (companyId: string, employeeId: string) =>
      [...engagementQueryKeys.recognitions.all(), "employee", companyId, employeeId] as const,
    categories: (companyId: string) => [...engagementQueryKeys.recognitions.all(), "categories", companyId] as const,
    badges: (companyId: string) => [...engagementQueryKeys.recognitions.all(), "badges", companyId] as const,
  },
  campaigns: {
    all: () => [...engagementQueryKeys.all, "campaigns"] as const,
    list: (companyId: string) => [...engagementQueryKeys.campaigns.all(), "list", companyId] as const,
    detail: (campaignId: string) => [...engagementQueryKeys.campaigns.all(), "detail", campaignId] as const,
    nominations: (campaignId: string) => [...engagementQueryKeys.campaigns.all(), "nominations", campaignId] as const,
  },
};
