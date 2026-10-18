import type { UserRole } from "../../types";

const allRoles: UserRole[] = [
  "super_admin",
  "hr_manager",
  "payroll_officer",
  "attendance_officer",
  "line_manager",
  "recruiter",
  "finance_officer",
  "performance_lead",
  "employee",
  "auditor",
];

export const moduleAccess: Record<string, UserRole[]> = {
  dashboard: allRoles,
  setup: ["super_admin", "hr_manager"],
  organization: ["super_admin", "hr_manager", "auditor"],
  employees: ["super_admin", "hr_manager"],
  documents: allRoles,
  rbac: ["super_admin", "auditor"],
  workflow: allRoles,
  leaves: allRoles,
  attendance: [
    "super_admin",
    "hr_manager",
    "attendance_officer",
    "line_manager",
    "employee",
    "auditor",
  ],
  shifts: ["super_admin", "hr_manager", "attendance_officer", "line_manager", "auditor"],
  payroll: ["super_admin", "hr_manager", "payroll_officer", "finance_officer", "auditor"],
  loans: ["super_admin", "hr_manager", "payroll_officer", "finance_officer", "employee", "auditor"],
  expenses: ["super_admin", "hr_manager", "finance_officer", "line_manager", "employee", "auditor"],
  performance: [
    "super_admin",
    "hr_manager",
    "performance_lead",
    "line_manager",
    "employee",
    "auditor",
  ],
  ats: ["super_admin", "hr_manager", "recruiter", "auditor"],
  workforce: ["super_admin", "hr_manager", "recruiter", "finance_officer", "auditor"],
  assets: ["super_admin", "hr_manager", "employee", "auditor"],
  reports: [
    "super_admin",
    "hr_manager",
    "payroll_officer",
    "attendance_officer",
    "finance_officer",
    "auditor",
  ],
  integrations: ["super_admin", "finance_officer", "auditor"],
  audit: ["super_admin", "auditor"],
  ess: allRoles,
  onboarding: ["super_admin", "hr_manager", "recruiter", "line_manager", "employee", "auditor"],
  probation: ["super_admin", "hr_manager", "line_manager", "auditor"],
  movements: ["super_admin", "hr_manager", "line_manager", "employee", "auditor"],
  learning: [
    "super_admin",
    "hr_manager",
    "line_manager",
    "employee",
    "performance_lead",
    "auditor",
  ],
  talent: [
    "super_admin",
    "hr_manager",
    "line_manager",
    "employee",
    "performance_lead",
    "auditor",
  ],
  engagement: allRoles,
  employee_relations: allRoles,
  compensation: allRoles,
  country_packs: allRoles,
  ai_copilot: allRoles,
};

export const moduleManageAccess: Record<string, UserRole[]> = {
  setup: ["super_admin", "hr_manager"],
  organization: ["super_admin", "hr_manager"],
  employees: ["super_admin", "hr_manager"],
  documents: ["super_admin", "hr_manager"],
  rbac: ["super_admin"],
  workflow: ["super_admin", "hr_manager", "line_manager"],
  leaves: ["super_admin", "hr_manager"],
  attendance: ["super_admin", "hr_manager", "attendance_officer"],
  shifts: ["super_admin", "hr_manager", "attendance_officer"],
  payroll: ["super_admin", "hr_manager", "payroll_officer"],
  settlements: ["super_admin", "hr_manager", "payroll_officer", "finance_officer"],
  expenses: ["super_admin", "hr_manager", "finance_officer"],
  performance: ["super_admin", "hr_manager", "performance_lead"],
  ats: ["super_admin", "hr_manager", "recruiter"],
  workforce: ["super_admin", "hr_manager", "recruiter"],
  assets: ["super_admin", "hr_manager"],
  integrations: ["super_admin"],
  onboarding: ["super_admin", "hr_manager"],
  probation: ["super_admin", "hr_manager", "line_manager"],
  movements: ["super_admin", "hr_manager"],
  learning: ["super_admin", "hr_manager"],
  talent: ["super_admin", "hr_manager", "performance_lead"],
  engagement: ["super_admin", "hr_manager", "performance_lead"],
  employee_relations: ["super_admin", "hr_manager"],
  compensation: ["super_admin", "hr_manager", "payroll_officer", "finance_officer"],
  country_packs: ["super_admin", "hr_manager", "payroll_officer", "finance_officer"],
  ai_copilot: ["super_admin", "hr_manager"],
};

export function canAccessModule(role: UserRole, moduleId: string) {
  return moduleAccess[moduleId]?.includes(role) ?? false;
}

export function canManageModule(role: UserRole, moduleId: string) {
  return moduleManageAccess[moduleId]?.includes(role) ?? false;
}

export function canEditHrProfile(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager";
}

export function canEditAssignment(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager";
}

export function canEditPayroll(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager" || role === "payroll_officer";
}

export function canEditBank(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager" || role === "payroll_officer";
}

export function canChangeLifecycle(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager";
}

export function canManageDocuments(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager";
}

export function canExportEmployees(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager" || role === "auditor";
}

export function canManageLearning(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager";
}

export function canManageTalent(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager" || role === "performance_lead";
}

export function canManageEngagement(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager" || role === "performance_lead";
}

export function canManageEmployeeRelations(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager";
}

export function canManageCompensation(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager" || role === "payroll_officer" || role === "finance_officer";
}

export function canManageCountryPacks(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager" || role === "payroll_officer" || role === "finance_officer";
}

export function canManageAI(role: UserRole): boolean {
  return role === "super_admin" || role === "hr_manager";
}

export type GovernmentIntegrationPermission =
  | "government_integrations:view"
  | "government_integrations:manage"
  | "government_integrations:submit"
  | "government_integrations:configure"
  | "government_integrations:audit"
  | "government_integrations.view"
  | "government_integrations.configure"
  | "government_integrations.credentials.manage"
  | "government_integrations.verify"
  | "government_integrations.activate"
  | "government_integrations.suspend"
  | "government_integrations.operations"
  | "government_integrations.dlq.manage"
  | "government_integrations.audit.view";

export const GOVERNMENT_INTEGRATION_PERMISSION_MATRIX: Record<
  GovernmentIntegrationPermission,
  UserRole[]
> = {
  "government_integrations:view": [
    "super_admin",
    "hr_manager",
    "payroll_officer",
    "finance_officer",
    "auditor",
  ],
  "government_integrations:manage": ["super_admin", "hr_manager", "payroll_officer"],
  "government_integrations:submit": [
    "super_admin",
    "hr_manager",
    "payroll_officer",
    "finance_officer",
  ],
  "government_integrations:configure": ["super_admin", "hr_manager"],
  "government_integrations:audit": ["super_admin", "auditor", "finance_officer"],
  "government_integrations.view": [
    "super_admin",
    "hr_manager",
    "payroll_officer",
    "finance_officer",
    "auditor",
  ],
  "government_integrations.configure": ["super_admin", "hr_manager"],
  // Section 57: Even users with normal integration access do not automatically get secret-management permission
  "government_integrations.credentials.manage": ["super_admin"],
  "government_integrations.verify": ["super_admin", "hr_manager", "payroll_officer"],
  "government_integrations.activate": ["super_admin", "hr_manager"],
  "government_integrations.suspend": ["super_admin", "hr_manager"],
  "government_integrations.operations": [
    "super_admin",
    "hr_manager",
    "payroll_officer",
    "finance_officer",
  ],
  "government_integrations.dlq.manage": ["super_admin", "hr_manager", "payroll_officer"],
  "government_integrations.audit.view": ["super_admin", "auditor", "finance_officer"],
};

export function hasGovernmentIntegrationPermission(
  role: UserRole,
  permission: GovernmentIntegrationPermission
): boolean {
  return GOVERNMENT_INTEGRATION_PERMISSION_MATRIX[permission]?.includes(role) ?? false;
}

