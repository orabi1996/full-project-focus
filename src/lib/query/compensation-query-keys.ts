// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 33: COMPENSATION & BENEFITS QUERY KEYS FACTORY
// src/lib/query/compensation-query-keys.ts
// ============================================================================

export const compensationQueryKeys = {
  all: ["compensation"] as const,
  kpis: (companyId: string) => [...compensationQueryKeys.all, "kpis", companyId] as const,

  components: {
    all: () => [...compensationQueryKeys.all, "components"] as const,
    list: (companyId: string) => [...compensationQueryKeys.components.all(), "list", companyId] as const,
  },

  payGrades: {
    all: () => [...compensationQueryKeys.all, "pay-grades"] as const,
    list: (companyId: string) => [...compensationQueryKeys.payGrades.all(), "list", companyId] as const,
  },

  salaryRanges: {
    all: () => [...compensationQueryKeys.all, "salary-ranges"] as const,
    list: (companyId: string) => [...compensationQueryKeys.salaryRanges.all(), "list", companyId] as const,
  },

  packages: {
    all: () => [...compensationQueryKeys.all, "packages"] as const,
    list: (companyId: string) => [...compensationQueryKeys.packages.all(), "list", companyId] as const,
    byEmployee: (employeeId: string) => [...compensationQueryKeys.packages.all(), "employee", employeeId] as const,
  },

  changeRequests: {
    all: () => [...compensationQueryKeys.all, "change-requests"] as const,
    list: (companyId: string, status?: string) =>
      [...compensationQueryKeys.changeRequests.all(), "list", companyId, status ?? "all"] as const,
    detail: (requestId: string) => [...compensationQueryKeys.changeRequests.all(), "detail", requestId] as const,
  },

  reviewCycles: {
    all: () => [...compensationQueryKeys.all, "review-cycles"] as const,
    list: (companyId: string) => [...compensationQueryKeys.reviewCycles.all(), "list", companyId] as const,
    detail: (cycleId: string) => [...compensationQueryKeys.reviewCycles.all(), "detail", cycleId] as const,
    populations: (cycleId: string) => [...compensationQueryKeys.reviewCycles.all(), "populations", cycleId] as const,
    recommendations: (cycleId: string) => [...compensationQueryKeys.reviewCycles.all(), "recommendations", cycleId] as const,
  },

  variablePay: {
    all: () => [...compensationQueryKeys.all, "variable-pay"] as const,
    plans: (companyId: string) => [...compensationQueryKeys.variablePay.all(), "plans", companyId] as const,
    cycles: (companyId: string) => [...compensationQueryKeys.variablePay.all(), "cycles", companyId] as const,
    awards: (cycleId: string) => [...compensationQueryKeys.variablePay.all(), "awards", cycleId] as const,
  },

  benefits: {
    all: () => [...compensationQueryKeys.all, "benefits"] as const,
    categories: () => [...compensationQueryKeys.benefits.all(), "categories"] as const,
    providers: (companyId: string) => [...compensationQueryKeys.benefits.all(), "providers", companyId] as const,
    plans: (companyId: string) => [...compensationQueryKeys.benefits.all(), "plans", companyId] as const,
    enrollments: (companyId: string, employeeId?: string) =>
      [...compensationQueryKeys.benefits.all(), "enrollments", companyId, employeeId ?? "all"] as const,
    dependents: (employeeId: string) => [...compensationQueryKeys.benefits.all(), "dependents", employeeId] as const,
  },

  totalRewards: {
    all: () => [...compensationQueryKeys.all, "total-rewards"] as const,
    byEmployee: (employeeId: string, year?: number) =>
      [...compensationQueryKeys.totalRewards.all(), "employee", employeeId, year ?? "latest"] as const,
  },
};
