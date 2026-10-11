// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: PRODUCTION TALENT, CAREER & SUCCESSION QUERY KEYS FACTORY
// src/lib/query/talent-query-keys.ts
// ============================================================================

export const talentQueryKeys = {
  all: ["talent"] as const,
  kpis: (companyId: string) => [...talentQueryKeys.all, "kpis", companyId] as const,
  careerPaths: {
    all: () => [...talentQueryKeys.all, "career-paths"] as const,
    list: (companyId: string) => [...talentQueryKeys.careerPaths.all(), "list", companyId] as const,
    detail: (pathId: string) => [...talentQueryKeys.careerPaths.all(), "detail", pathId] as const,
    steps: (pathId: string) => [...talentQueryKeys.careerPaths.all(), "steps", pathId] as const,
  },
  careerPreferences: {
    all: () => [...talentQueryKeys.all, "career-preferences"] as const,
    byEmployee: (companyId: string, employeeId: string) =>
      [...talentQueryKeys.careerPreferences.all(), "employee", companyId, employeeId] as const,
    targetRoles: (companyId: string, employeeId: string) =>
      [...talentQueryKeys.careerPreferences.all(), "target-roles", companyId, employeeId] as const,
  },
  reviewCycles: {
    all: () => [...talentQueryKeys.all, "review-cycles"] as const,
    list: (companyId: string) => [...talentQueryKeys.reviewCycles.all(), "list", companyId] as const,
    detail: (cycleId: string) => [...talentQueryKeys.reviewCycles.all(), "detail", cycleId] as const,
  },
  assessments: {
    all: () => [...talentQueryKeys.all, "assessments"] as const,
    list: (companyId: string, cycleId?: string) =>
      cycleId
        ? ([...talentQueryKeys.assessments.all(), "list", companyId, cycleId] as const)
        : ([...talentQueryKeys.assessments.all(), "list", companyId] as const),
    nineBoxGrid: (companyId: string, cycleId?: string) =>
      cycleId
        ? ([...talentQueryKeys.assessments.all(), "9box", companyId, cycleId] as const)
        : ([...talentQueryKeys.assessments.all(), "9box", companyId] as const),
    byEmployee: (companyId: string, employeeId: string) =>
      [...talentQueryKeys.assessments.all(), "employee", companyId, employeeId] as const,
  },
  talentPools: {
    all: () => [...talentQueryKeys.all, "talent-pools"] as const,
    list: (companyId: string) => [...talentQueryKeys.talentPools.all(), "list", companyId] as const,
    members: (companyId: string, poolId: string) =>
      [...talentQueryKeys.talentPools.all(), "members", companyId, poolId] as const,
  },
  criticalRoles: {
    all: () => [...talentQueryKeys.all, "critical-roles"] as const,
    list: (companyId: string) => [...talentQueryKeys.criticalRoles.all(), "list", companyId] as const,
  },
  successionPlans: {
    all: () => [...talentQueryKeys.all, "succession-plans"] as const,
    list: (companyId: string) => [...talentQueryKeys.successionPlans.all(), "list", companyId] as const,
    detail: (planId: string) => [...talentQueryKeys.successionPlans.all(), "detail", planId] as const,
    candidates: (planId: string) => [...talentQueryKeys.successionPlans.all(), "candidates", planId] as const,
  },
  developmentActions: {
    all: () => [...talentQueryKeys.all, "development-actions"] as const,
    list: (companyId: string, employeeId?: string) =>
      employeeId
        ? ([...talentQueryKeys.developmentActions.all(), "list", companyId, employeeId] as const)
        : ([...talentQueryKeys.developmentActions.all(), "list", companyId] as const),
  },
  internalOpportunities: {
    all: () => [...talentQueryKeys.all, "internal-opportunities"] as const,
    list: (companyId: string) => [...talentQueryKeys.internalOpportunities.all(), "list", companyId] as const,
    detail: (opportunityId: string) =>
      [...talentQueryKeys.internalOpportunities.all(), "detail", opportunityId] as const,
    applications: (companyId: string, opportunityId?: string) =>
      opportunityId
        ? ([...talentQueryKeys.internalOpportunities.all(), "applications", companyId, opportunityId] as const)
        : ([...talentQueryKeys.internalOpportunities.all(), "applications", companyId] as const),
    myApplications: (companyId: string, employeeId: string) =>
      [...talentQueryKeys.internalOpportunities.all(), "my-applications", companyId, employeeId] as const,
  },
  mentoring: {
    all: () => [...talentQueryKeys.all, "mentoring"] as const,
    list: (companyId: string) => [...talentQueryKeys.mentoring.all(), "list", companyId] as const,
    byEmployee: (companyId: string, employeeId: string) =>
      [...talentQueryKeys.mentoring.all(), "employee", companyId, employeeId] as const,
  },
  careerConversations: {
    all: () => [...talentQueryKeys.all, "career-conversations"] as const,
    list: (companyId: string, employeeId?: string) =>
      employeeId
        ? ([...talentQueryKeys.careerConversations.all(), "list", companyId, employeeId] as const)
        : ([...talentQueryKeys.careerConversations.all(), "list", companyId] as const),
  },
};
