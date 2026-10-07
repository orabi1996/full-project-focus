/**
 * Centralized, hierarchical query key factories for TanStack Query.
 * Supports targeted invalidation and prevents arbitrary string arrays across the codebase.
 */
import { reportQueryKeys } from "./report-query-keys";
import { integrationQueryKeys } from "./integration-query-keys";
import { notificationQueryKeys } from "./notification-query-keys";
import { taskQueryKeys } from "./tasks-query-keys";
import { auditQueryKeys } from "./audit-query-keys";
import { essQueryKeys } from "./ess-query-keys";

export { reportQueryKeys, integrationQueryKeys, notificationQueryKeys, taskQueryKeys, auditQueryKeys, essQueryKeys };

export const queryKeys = {
  bootstrap: {
    all: ["bootstrap"] as const,
    core: () => [...queryKeys.bootstrap.all, "core"] as const,
    operational: () => [...queryKeys.bootstrap.all, "operational"] as const,
  },
  company: {
    all: ["company"] as const,
    detail: () => [...queryKeys.company.all, "detail"] as const,
    bankAccounts: () => [...queryKeys.company.all, "bankAccounts"] as const,
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
    config: () => [...queryKeys.payroll.all, "config"] as const,
    groups: () => [...queryKeys.payroll.all, "groups"] as const,
    components: () => [...queryKeys.payroll.all, "components"] as const,
    structures: () => [...queryKeys.payroll.all, "structures"] as const,
    compensation: (employeeId?: string) =>
      [...queryKeys.payroll.all, "compensation", employeeId ?? "all"] as const,
    runs: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.payroll.all, "runs", filters] as const)
        : ([...queryKeys.payroll.all, "runs"] as const),
    run: (id: string) => [...queryKeys.payroll.all, "runs", id] as const,
    employees: (runId: string, filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.payroll.all, "employees", runId, filters] as const)
        : ([...queryKeys.payroll.all, "employees", runId] as const),
    lines: (runEmployeeId: string) =>
      [...queryKeys.payroll.all, "lines", runEmployeeId] as const,
    exceptions: (runId: string) =>
      [...queryKeys.payroll.all, "exceptions", runId] as const,
    payslip: (runEmployeeId: string) =>
      [...queryKeys.payroll.all, "payslip", runEmployeeId] as const,
    kpis: () => [...queryKeys.payroll.all, "kpis"] as const,
    batches: () => [...queryKeys.payroll.all, "batches"] as const,
    reconciliation: (runId?: string) =>
      [...queryKeys.payroll.all, "reconciliation", runId ?? "all"] as const,
    statutoryRules: () =>
      [...queryKeys.payroll.all, "statutory_rules"] as const,
    details: (runId?: string) =>
      [...queryKeys.payroll.all, "details", runId ?? "all"] as const,
    loans: () => [...queryKeys.payroll.all, "loans"] as const,
    settlements: () => [...queryKeys.payroll.all, "settlements"] as const,
  },
  attendance: {
    all: ["attendance"] as const,
    records: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.attendance.all, "records", filters] as const)
        : ([...queryKeys.attendance.all, "records"] as const),
    overtime: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.attendance.all, "overtime", filters] as const)
        : ([...queryKeys.attendance.all, "overtime"] as const),
    corrections: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.attendance.all, "corrections", filters] as const)
        : ([...queryKeys.attendance.all, "corrections"] as const),
    policies: () => [...queryKeys.attendance.all, "policies"] as const,
    periods: () => [...queryKeys.attendance.all, "periods"] as const,
    snapshots: (periodId?: string) =>
      [...queryKeys.attendance.all, "snapshots", periodId ?? "all"] as const,
    exceptions: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.attendance.all, "exceptions", filters] as const)
        : ([...queryKeys.attendance.all, "exceptions"] as const),
    punches: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.attendance.all, "punches", filters] as const)
        : ([...queryKeys.attendance.all, "punches"] as const),
    summary: (period?: string) =>
      [...queryKeys.attendance.all, "summary", period ?? "current"] as const,
  },
  workflow: {
    all: ["workflow"] as const,
    requests: () => [...queryKeys.workflow.all, "requests"] as const,
    inbox: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.workflow.all, "inbox", filters] as const)
        : ([...queryKeys.workflow.all, "inbox"] as const),
    myRequests: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.workflow.all, "myRequests", filters] as const)
        : ([...queryKeys.workflow.all, "myRequests"] as const),
    request: (id: string) => [...queryKeys.workflow.all, "request", id] as const,
    chains: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.workflow.all, "chains", filters] as const)
        : ([...queryKeys.workflow.all, "chains"] as const),
    chain: (id: string) => [...queryKeys.workflow.all, "chain", id] as const,
    delegations: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.workflow.all, "delegations", filters] as const)
        : ([...queryKeys.workflow.all, "delegations"] as const),
    myDelegations: () => [...queryKeys.workflow.all, "myDelegations"] as const,
    sla: () => [...queryKeys.workflow.all, "sla"] as const,
    kpis: (companyId?: string) => [...queryKeys.workflow.all, "kpis", companyId ?? "current"] as const,
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
    definitions: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.shifts.all, "definitions", filters] as const)
        : ([...queryKeys.shifts.all, "definitions"] as const),
    definition: (id: string) => [...queryKeys.shifts.all, "definition", id] as const,
    rosters: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.shifts.all, "rosters", filters] as const)
        : ([...queryKeys.shifts.all, "rosters"] as const),
    roster: (id: string) => [...queryKeys.shifts.all, "roster", id] as const,
    assignments: (rosterPeriodId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.shifts.all, "assignments", rosterPeriodId ?? "all", filters ?? {}] as const,
    mySchedule: (startDate: string, endDate: string) =>
      [...queryKeys.shifts.all, "mySchedule", startDate, endDate] as const,
    teamSchedule: (departmentId?: string, startDate?: string, endDate?: string) =>
      [...queryKeys.shifts.all, "teamSchedule", departmentId ?? "all", startDate ?? "", endDate ?? ""] as const,
    templates: () => [...queryKeys.shifts.all, "templates"] as const,
    rotations: () => [...queryKeys.shifts.all, "rotations"] as const,
    exceptions: (rosterPeriodId?: string) =>
      [...queryKeys.shifts.all, "exceptions", rosterPeriodId ?? "all"] as const,
    coverage: (rosterPeriodId: string) =>
      [...queryKeys.shifts.all, "coverage", rosterPeriodId] as const,
    swapRequests: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.shifts.all, "swapRequests", filters] as const)
        : ([...queryKeys.shifts.all, "swapRequests"] as const),
    workweek: () => [...queryKeys.shifts.all, "workweek"] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    categories: () => [...queryKeys.expenses.all, "categories"] as const,
    policies: () => [...queryKeys.expenses.all, "policies"] as const,
    claims: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.expenses.all, "claims", filters] as const)
        : ([...queryKeys.expenses.all, "claims"] as const),
    claim: (id: string) => [...queryKeys.expenses.all, "claim", id] as const,
    items: (claimId: string) => [...queryKeys.expenses.all, "items", claimId] as const,
    batches: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.expenses.all, "batches", filters] as const)
        : ([...queryKeys.expenses.all, "batches"] as const),
    batch: (id: string) => [...queryKeys.expenses.all, "batch", id] as const,
    kpis: (companyId?: string) => [...queryKeys.expenses.all, "kpis", companyId ?? "current"] as const,
    reports: (filters?: Record<string, unknown>) =>
      [...queryKeys.expenses.all, "reports", filters ?? {}] as const,
  },
  performance: {
    all: ["performance"] as const,
    cycles: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.performance.all, "cycles", filters] as const)
        : ([...queryKeys.performance.all, "cycles"] as const),
    cycle: (id: string) => [...queryKeys.performance.all, "cycle", id] as const,
    participants: (cycleId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.performance.all, "participants", cycleId, filters ?? {}] as const,
    goals: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.performance.all, "goals", filters] as const)
        : ([...queryKeys.performance.all, "goals"] as const),
    goal: (id: string) => [...queryKeys.performance.all, "goal", id] as const,
    goalProgress: (goalId: string) => [...queryKeys.performance.all, "goalProgress", goalId] as const,
    frameworks: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.performance.all, "frameworks", filters] as const)
        : ([...queryKeys.performance.all, "frameworks"] as const),
    competencies: (frameworkId?: string) =>
      [...queryKeys.performance.all, "competencies", frameworkId ?? "all"] as const,
    templates: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.performance.all, "templates", filters] as const)
        : ([...queryKeys.performance.all, "templates"] as const),
    template: (id: string) => [...queryKeys.performance.all, "template", id] as const,
    assignments: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.performance.all, "assignments", filters] as const)
        : ([...queryKeys.performance.all, "assignments"] as const),
    myReviews: (cycleId?: string) =>
      [...queryKeys.performance.all, "myReviews", cycleId ?? "all"] as const,
    teamReviews: (cycleId?: string) =>
      [...queryKeys.performance.all, "teamReviews", cycleId ?? "all"] as const,
    review: (id: string) => [...queryKeys.performance.all, "review", id] as const,
    calibrationSessions: (cycleId?: string) =>
      [...queryKeys.performance.all, "calibrationSessions", cycleId ?? "all"] as const,
    nineBox: (cycleId: string, departmentId?: string) =>
      [...queryKeys.performance.all, "nineBox", cycleId, departmentId ?? "all"] as const,
    potential: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.performance.all, "potential", filters] as const)
        : ([...queryKeys.performance.all, "potential"] as const),
    developmentPlans: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.performance.all, "developmentPlans", filters] as const)
        : ([...queryKeys.performance.all, "developmentPlans"] as const),
    pip: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.performance.all, "pip", filters] as const)
        : ([...queryKeys.performance.all, "pip"] as const),
    kpis: (cycleId?: string, companyId?: string) =>
      [...queryKeys.performance.all, "kpis", cycleId ?? "all", companyId ?? "current"] as const,
    employeeHistory: (employeeId: string) =>
      [...queryKeys.performance.all, "employeeHistory", employeeId] as const,
    evaluations: () => [...queryKeys.performance.all, "evaluations"] as const,
  },
  recruitment: {
    all: ["recruitment"] as const,
    openings: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.recruitment.all, "openings", filters] as const)
        : ([...queryKeys.recruitment.all, "openings"] as const),
    opening: (id: string) => [...queryKeys.recruitment.all, "opening", id] as const,
    requisitions: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.recruitment.all, "requisitions", filters] as const)
        : ([...queryKeys.recruitment.all, "requisitions"] as const),
    requisition: (id: string) => [...queryKeys.recruitment.all, "requisition", id] as const,
    candidates: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.recruitment.all, "candidates", filters] as const)
        : ([...queryKeys.recruitment.all, "candidates"] as const),
    candidate: (id: string) => [...queryKeys.recruitment.all, "candidate", id] as const,
    pipeline: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.recruitment.all, "pipeline", filters] as const)
        : ([...queryKeys.recruitment.all, "pipeline"] as const),
    interviews: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.recruitment.all, "interviews", filters] as const)
        : ([...queryKeys.recruitment.all, "interviews"] as const),
    interview: (id: string) => [...queryKeys.recruitment.all, "interview", id] as const,
    scorecards: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.recruitment.all, "scorecards", filters] as const)
        : ([...queryKeys.recruitment.all, "scorecards"] as const),
    offers: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.recruitment.all, "offers", filters] as const)
        : ([...queryKeys.recruitment.all, "offers"] as const),
    offer: (id: string) => [...queryKeys.recruitment.all, "offer", id] as const,
    kpis: (companyId?: string | null) =>
      [...queryKeys.recruitment.all, "kpis", companyId ?? "current"] as const,
    talentPool: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.recruitment.all, "talentPool", filters] as const)
        : ([...queryKeys.recruitment.all, "talentPool"] as const),
    hiringRequests: () => [...queryKeys.recruitment.all, "hiringRequests"] as const,
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
  audit: auditQueryKeys,
  notifications: notificationQueryKeys,
  tasks: taskQueryKeys,
  integrations: integrationQueryKeys,
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
  loans: {
    all: ["loans"] as const,
    list: (filters?: Record<string, unknown>) =>
      filters ? ([...queryKeys.loans.all, "list", filters] as const) : ([...queryKeys.loans.all, "list"] as const),
    detail: (id: string) => [...queryKeys.loans.all, "detail", id] as const,
    policies: () => [...queryKeys.loans.all, "policies"] as const,
    installments: (loanId: string) => [...queryKeys.loans.all, "installments", loanId] as const,
    overview: () => [...queryKeys.loans.all, "overview"] as const,
  },
  separations: {
    all: ["separations"] as const,
    list: (filters?: Record<string, unknown>) =>
      filters ? ([...queryKeys.separations.all, "list", filters] as const) : ([...queryKeys.separations.all, "list"] as const),
    detail: (id: string) => [...queryKeys.separations.all, "detail", id] as const,
    clearance: (separationId: string) => [...queryKeys.separations.all, "clearance", separationId] as const,
  },
  workforce: {
    all: ["workforce"] as const,
    plans: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.workforce.all, "plans", filters] as const)
        : ([...queryKeys.workforce.all, "plans"] as const),
    plan: (id: string) => [...queryKeys.workforce.all, "plan", id] as const,
    planLines: (planId: string) => [...queryKeys.workforce.all, "planLines", planId] as const,
    forecasts: (planId: string, fiscalYear?: number) =>
      [...queryKeys.workforce.all, "forecasts", planId, fiscalYear ?? "all"] as const,
    headcountRequests: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.workforce.all, "headcountRequests", filters] as const)
        : ([...queryKeys.workforce.all, "headcountRequests"] as const),
    kpis: (companyId: string, fiscalYear?: number) =>
      [...queryKeys.workforce.all, "kpis", companyId, fiscalYear ?? "current"] as const,
    actualHeadcount: (companyId: string, departmentId?: string | null, asOfDate?: string) =>
      [...queryKeys.workforce.all, "actualHeadcount", companyId, departmentId ?? "all", asOfDate ?? "today"] as const,
    planVsActual: (planId: string) => [...queryKeys.workforce.all, "planVsActual", planId] as const,
    auditLog: (planId: string) => [...queryKeys.workforce.all, "auditLog", planId] as const,
    scenarios: (companyId: string, fiscalYear?: number) =>
      [...queryKeys.workforce.all, "scenarios", companyId, fiscalYear ?? "current"] as const,
  },
  reports: reportQueryKeys,
  ess: essQueryKeys,
} as const;
