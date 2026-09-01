export type AuthRole =
  | "org_admin"
  | "super_admin"
  | "hr_manager"
  | "payroll_officer"
  | "attendance_officer"
  | "line_manager"
  | "recruiter"
  | "finance_officer"
  | "performance_lead"
  | "employee"
  | "auditor";

export const AUTH_ROLE_PRIORITY: readonly AuthRole[] = [
  "super_admin",
  "org_admin",
  "hr_manager",
  "payroll_officer",
  "attendance_officer",
  "recruiter",
  "finance_officer",
  "performance_lead",
  "line_manager",
  "auditor",
  "employee",
];

export function resolvePrimaryRole(values: readonly unknown[]): AuthRole {
  const assignedRoles = new Set(
    values.filter((value): value is AuthRole => AUTH_ROLE_PRIORITY.includes(value as AuthRole)),
  );

  return AUTH_ROLE_PRIORITY.find((role) => assignedRoles.has(role)) ?? "employee";
}
