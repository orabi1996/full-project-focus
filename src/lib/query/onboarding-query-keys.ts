// ============================================================================
// ONBOARDING & PROBATION QUERY KEYS FACTORY
// src/lib/query/onboarding-query-keys.ts
// ============================================================================

export const onboardingQueryKeys = {
  all: ["onboarding"] as const,
  kpis: (companyId: string) => [...onboardingQueryKeys.all, "kpis", companyId] as const,
  cases: {
    all: () => [...onboardingQueryKeys.all, "cases"] as const,
    list: (companyId: string, filters?: Record<string, unknown>) =>
      filters
        ? ([...onboardingQueryKeys.cases.all(), "list", companyId, filters] as const)
        : ([...onboardingQueryKeys.cases.all(), "list", companyId] as const),
    detail: (caseId: string) => [...onboardingQueryKeys.cases.all(), "detail", caseId] as const,
    myCase: () => [...onboardingQueryKeys.cases.all(), "my-case"] as const,
    teamCases: () => [...onboardingQueryKeys.cases.all(), "team-cases"] as const,
  },
  tasks: {
    all: () => [...onboardingQueryKeys.all, "tasks"] as const,
    byCase: (caseId: string) => [...onboardingQueryKeys.tasks.all(), "case", caseId] as const,
    myTasks: () => [...onboardingQueryKeys.tasks.all(), "my-tasks"] as const,
    definitions: (companyId: string) =>
      [...onboardingQueryKeys.tasks.all(), "definitions", companyId] as const,
  },
  templates: {
    all: () => [...onboardingQueryKeys.all, "templates"] as const,
    list: (companyId: string) =>
      [...onboardingQueryKeys.templates.all(), "list", companyId] as const,
    detail: (templateId: string) =>
      [...onboardingQueryKeys.templates.all(), "detail", templateId] as const,
  },
  documents: {
    all: () => [...onboardingQueryKeys.all, "documents"] as const,
    byCase: (caseId: string) => [...onboardingQueryKeys.documents.all(), "case", caseId] as const,
  },
  acknowledgements: {
    all: () => [...onboardingQueryKeys.all, "acknowledgements"] as const,
    byCase: (caseId: string) =>
      [...onboardingQueryKeys.acknowledgements.all(), "case", caseId] as const,
  },
  probation: {
    all: () => [...onboardingQueryKeys.all, "probation"] as const,
    policies: (companyId: string) =>
      [...onboardingQueryKeys.probation.all(), "policies", companyId] as const,
    cases: (companyId: string, filters?: Record<string, unknown>) =>
      filters
        ? ([...onboardingQueryKeys.probation.all(), "cases", companyId, filters] as const)
        : ([...onboardingQueryKeys.probation.all(), "cases", companyId] as const),
    detail: (caseId: string) =>
      [...onboardingQueryKeys.probation.all(), "detail", caseId] as const,
    reviews: (caseId: string) =>
      [...onboardingQueryKeys.probation.all(), "reviews", caseId] as const,
  },
};
