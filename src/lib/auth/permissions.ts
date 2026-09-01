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
};

export const moduleManageAccess: Record<string, UserRole[]> = {
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
};

export function canAccessModule(role: UserRole, moduleId: string) {
  return moduleAccess[moduleId]?.includes(role) ?? false;
}

export function canManageModule(role: UserRole, moduleId: string) {
  return moduleManageAccess[moduleId]?.includes(role) ?? false;
}
