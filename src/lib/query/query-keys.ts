/**
 * Centralized, hierarchical query key factories for TanStack Query.
 * Supports targeted invalidation and prevents arbitrary string arrays across the codebase.
 */
export const queryKeys = {
  bootstrap: {
    all: ["bootstrap"] as const,
    core: () => [...queryKeys.bootstrap.all, "core"] as const,
    operational: () => [...queryKeys.bootstrap.all, "operational"] as const,
  },
  company: {
    all: ["company"] as const,
    detail: () => [...queryKeys.company.all, "detail"] as const,
  },
  organization: {
    all: ["organization"] as const,
    units: () => [...queryKeys.organization.all, "units"] as const,
    subsidiaries: () => [...queryKeys.organization.all, "subsidiaries"] as const,
    locations: () => [...queryKeys.organization.all, "locations"] as const,
    costCenters: () => [...queryKeys.organization.all, "costCenters"] as const,
    positions: () => [...queryKeys.organization.all, "positions"] as const,
  },
  employees: {
    all: ["employees"] as const,
    list: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.employees.all, "list", filters] as const)
        : ([...queryKeys.employees.all, "list"] as const),
    directory: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.employees.all, "directory", filters] as const)
        : ([...queryKeys.employees.all, "directory"] as const),
    kpis: () => [...queryKeys.employees.all, "kpis"] as const,
    detail: (id: string) => [...queryKeys.employees.all, "detail", id] as const,
    history: (id: string) => [...queryKeys.employees.all, "history", id] as const,
    contracts: (id: string) => [...queryKeys.employees.all, "contracts", id] as const,
    documents: (id: string) => [...queryKeys.employees.all, "documents", id] as const,
  },
  payroll: {
    all: ["payroll"] as const,
    groups: () => [...queryKeys.payroll.all, "groups"] as const,
    runs: () => [...queryKeys.payroll.all, "runs"] as const,
    run: (id: string) => [...queryKeys.payroll.runs(), id] as const,
    details: (runId?: string) => [...queryKeys.payroll.all, "details", runId ?? "all"] as const,
    loans: () => [...queryKeys.payroll.all, "loans"] as const,
    settlements: () => [...queryKeys.payroll.all, "settlements"] as const,
  },
  attendance: {
    all: ["attendance"] as const,
    records: () => [...queryKeys.attendance.all, "records"] as const,
    overtime: () => [...queryKeys.attendance.all, "overtime"] as const,
    corrections: () => [...queryKeys.attendance.all, "corrections"] as const,
  },
  workflow: {
    all: ["workflow"] as const,
    requests: () => [...queryKeys.workflow.all, "requests"] as const,
    chains: () => [...queryKeys.workflow.all, "chains"] as const,
    delegations: () => [...queryKeys.workflow.all, "delegations"] as const,
  },
  leaves: {
    all: ["leaves"] as const,
    types: () => [...queryKeys.leaves.all, "types"] as const,
    balances: (employeeId?: string) =>
      [...queryKeys.leaves.all, "balances", employeeId ?? "all"] as const,
    myBalances: (year?: number) => [...queryKeys.leaves.all, "myBalances", year ?? "current"] as const,
    adminBalances: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.leaves.all, "adminBalances", filters] as const)
        : ([...queryKeys.leaves.all, "adminBalances"] as const),
    myRequests: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.leaves.all, "myRequests", filters] as const)
        : ([...queryKeys.leaves.all, "myRequests"] as const),
    teamCalendar: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.leaves.all, "teamCalendar", filters] as const)
        : ([...queryKeys.leaves.all, "teamCalendar"] as const),
    accrualRuns: (year?: number) => [...queryKeys.leaves.all, "accrualRuns", year ?? "all"] as const,
    holidays: (companyId?: string) => [...queryKeys.leaves.all, "holidays", companyId ?? "current"] as const,
  },
  shifts: {
    all: ["shifts"] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    categories: () => [...queryKeys.expenses.all, "categories"] as const,
    claims: () => [...queryKeys.expenses.all, "claims"] as const,
  },
  performance: {
    all: ["performance"] as const,
    cycles: () => [...queryKeys.performance.all, "cycles"] as const,
    evaluations: () => [...queryKeys.performance.all, "evaluations"] as const,
  },
  recruitment: {
    all: ["recruitment"] as const,
    openings: () => [...queryKeys.recruitment.all, "openings"] as const,
    candidates: () => [...queryKeys.recruitment.all, "candidates"] as const,
    offers: () => [...queryKeys.recruitment.all, "offers"] as const,
    workforce: () => [...queryKeys.recruitment.all, "workforce"] as const,
  },
  assets: {
    all: ["assets"] as const,
  },
  documents: {
    all: ["documents"] as const,
    company: () => [...queryKeys.documents.all, "company"] as const,
    employees: () => [...queryKeys.documents.all, "employees"] as const,
    employee: (id: string) => [...queryKeys.documents.all, "employees", id] as const,
  },
  audit: {
    all: ["audit"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
  },
  integrations: {
    all: ["integrations"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    summary: (filters: { start: string; end: string }) =>
      [...queryKeys.dashboard.all, "summary", filters.start, filters.end] as const,
    attendance: (filters: { anchor: string; days: number }) =>
      [...queryKeys.dashboard.all, "attendance-trend", filters.anchor, filters.days] as const,
    integrations: () => [...queryKeys.dashboard.all, "integration-health"] as const,
  },
  rbac: {
    all: ["rbac"] as const,
    roles: () => [...queryKeys.rbac.all, "roles"] as const,
    groups: () => [...queryKeys.rbac.all, "groups"] as const,
  },
} as const;
