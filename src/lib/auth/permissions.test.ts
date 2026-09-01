import { describe, expect, it } from "vitest";

import { canAccessModule, canManageModule } from "./permissions";

describe("canAccessModule", () => {
  it("allows super admins to access every registered module", () => {
    expect(canAccessModule("super_admin", "payroll")).toBe(true);
    expect(canAccessModule("super_admin", "rbac")).toBe(true);
  });

  it("keeps employees out of payroll and RBAC", () => {
    expect(canAccessModule("employee", "payroll")).toBe(false);
    expect(canAccessModule("employee", "rbac")).toBe(false);
    expect(canAccessModule("employee", "ess")).toBe(true);
  });

  it("limits payroll officers to finance-related modules", () => {
    expect(canAccessModule("payroll_officer", "payroll")).toBe(true);
    expect(canAccessModule("payroll_officer", "ats")).toBe(false);
  });

  it("keeps read-only roles from mutation capabilities", () => {
    expect(canAccessModule("auditor", "employees")).toBe(false);
    expect(canManageModule("auditor", "employees")).toBe(false);
    expect(canManageModule("finance_officer", "integrations")).toBe(false);
    expect(canManageModule("finance_officer", "expenses")).toBe(true);
  });
});
