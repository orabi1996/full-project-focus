// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 29: LEARNING & SKILLS QUERY KEYS FACTORY
// src/lib/query/learning-query-keys.ts
// ============================================================================

export const learningQueryKeys = {
  all: ["learning"] as const,
  kpis: (companyId: string) => [...learningQueryKeys.all, "kpis", companyId] as const,
  skills: {
    all: () => [...learningQueryKeys.all, "skills"] as const,
    list: (companyId: string) => [...learningQueryKeys.skills.all(), "list", companyId] as const,
    categories: (companyId: string) => [...learningQueryKeys.skills.all(), "categories", companyId] as const,
    employeeSkills: (companyId: string, employeeId?: string) =>
      employeeId
        ? ([...learningQueryKeys.skills.all(), "employee", companyId, employeeId] as const)
        : ([...learningQueryKeys.skills.all(), "employee", companyId] as const),
    skillGaps: (companyId: string, employeeId: string) =>
      [...learningQueryKeys.skills.all(), "gaps", companyId, employeeId] as const,
    matrix: (companyId: string) => [...learningQueryKeys.skills.all(), "matrix", companyId] as const,
  },
  courses: {
    all: () => [...learningQueryKeys.all, "courses"] as const,
    list: (companyId: string) => [...learningQueryKeys.courses.all(), "list", companyId] as const,
    detail: (courseId: string) => [...learningQueryKeys.courses.all(), "detail", courseId] as const,
    programs: (companyId: string) => [...learningQueryKeys.courses.all(), "programs", companyId] as const,
  },
  sessions: {
    all: () => [...learningQueryKeys.all, "sessions"] as const,
    list: (companyId: string) => [...learningQueryKeys.sessions.all(), "list", companyId] as const,
    detail: (sessionId: string) => [...learningQueryKeys.sessions.all(), "detail", sessionId] as const,
  },
  enrollments: {
    all: () => [...learningQueryKeys.all, "enrollments"] as const,
    list: (companyId: string) => [...learningQueryKeys.enrollments.all(), "list", companyId] as const,
    byEmployee: (companyId: string, employeeId: string) =>
      [...learningQueryKeys.enrollments.all(), "employee", companyId, employeeId] as const,
  },
  trainingNeeds: (companyId: string, employeeId?: string) =>
    employeeId
      ? ([...learningQueryKeys.all, "training-needs", companyId, employeeId] as const)
      : ([...learningQueryKeys.all, "training-needs", companyId] as const),
  learningPlans: (companyId: string, employeeId?: string) =>
    employeeId
      ? ([...learningQueryKeys.all, "learning-plans", companyId, employeeId] as const)
      : ([...learningQueryKeys.all, "learning-plans", companyId] as const),
  certifications: {
    all: () => [...learningQueryKeys.all, "certifications"] as const,
    catalog: (companyId: string) => [...learningQueryKeys.certifications.all(), "catalog", companyId] as const,
    employeeList: (companyId: string, employeeId?: string) =>
      employeeId
        ? ([...learningQueryKeys.certifications.all(), "employee", companyId, employeeId] as const)
        : ([...learningQueryKeys.certifications.all(), "employee", companyId] as const),
  },
  providers: (companyId: string) => [...learningQueryKeys.all, "providers", companyId] as const,
  mandatoryRules: (companyId: string) => [...learningQueryKeys.all, "mandatory-rules", companyId] as const,
};
