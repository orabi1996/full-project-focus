// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: PRODUCTION EMPLOYEE RELATIONS, CASES & DISCIPLINARY QUERY KEYS FACTORY
// src/lib/query/employee-relations-query-keys.ts
// ============================================================================

export const employeeRelationsQueryKeys = {
  all: ["employee-relations"] as const,
  kpis: (companyId: string) => [...employeeRelationsQueryKeys.all, "kpis", companyId] as const,
  cases: {
    all: () => [...employeeRelationsQueryKeys.all, "cases"] as const,
    list: (companyId: string, filters?: { status?: string; caseType?: string; severity?: string }) =>
      [...employeeRelationsQueryKeys.cases.all(), "list", companyId, filters ?? {}] as const,
    detail: (caseId: string) => [...employeeRelationsQueryKeys.cases.all(), "detail", caseId] as const,
    myCases: (companyId: string, employeeId: string) =>
      [...employeeRelationsQueryKeys.cases.all(), "my-cases", companyId, employeeId] as const,
  },
  participants: (caseId: string) => [...employeeRelationsQueryKeys.all, "participants", caseId] as const,
  notes: (caseId: string) => [...employeeRelationsQueryKeys.all, "notes", caseId] as const,
  investigations: {
    all: () => [...employeeRelationsQueryKeys.all, "investigations"] as const,
    byCase: (caseId: string) => [...employeeRelationsQueryKeys.investigations.all(), "case", caseId] as const,
    detail: (invId: string) => [...employeeRelationsQueryKeys.investigations.all(), "detail", invId] as const,
  },
  interviews: (caseId: string) => [...employeeRelationsQueryKeys.all, "interviews", caseId] as const,
  evidence: (caseId: string) => [...employeeRelationsQueryKeys.all, "evidence", caseId] as const,
  findings: (caseId: string) => [...employeeRelationsQueryKeys.all, "findings", caseId] as const,
  catalog: (companyId: string) => [...employeeRelationsQueryKeys.all, "catalog", companyId] as const,
  decisions: (caseId: string) => [...employeeRelationsQueryKeys.all, "decisions", caseId] as const,
  disciplinaryActions: {
    all: () => [...employeeRelationsQueryKeys.all, "disciplinary-actions"] as const,
    byEmployee: (employeeId: string) => [...employeeRelationsQueryKeys.disciplinaryActions.all(), "emp", employeeId] as const,
  },
  warnings: {
    all: () => [...employeeRelationsQueryKeys.all, "warnings"] as const,
    list: (companyId: string, employeeId?: string) =>
      employeeId
        ? ([...employeeRelationsQueryKeys.warnings.all(), "list", companyId, employeeId] as const)
        : ([...employeeRelationsQueryKeys.warnings.all(), "list", companyId] as const),
    detail: (warningId: string) => [...employeeRelationsQueryKeys.warnings.all(), "detail", warningId] as const,
  },
  appeals: {
    all: () => [...employeeRelationsQueryKeys.all, "appeals"] as const,
    list: (companyId: string) => [...employeeRelationsQueryKeys.appeals.all(), "list", companyId] as const,
    byCase: (caseId: string) => [...employeeRelationsQueryKeys.appeals.all(), "case", caseId] as const,
  },
  caps: {
    all: () => [...employeeRelationsQueryKeys.all, "caps"] as const,
    list: (companyId: string, employeeId?: string) =>
      employeeId
        ? ([...employeeRelationsQueryKeys.caps.all(), "list", companyId, employeeId] as const)
        : ([...employeeRelationsQueryKeys.caps.all(), "list", companyId] as const),
  },
};
