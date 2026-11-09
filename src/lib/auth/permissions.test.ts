import { describe, expect, it } from "vitest";

import {
  canAccessModule, canManageModule, canEditAssignment, canEditBank,
  canEditPayroll, canManageDocuments, canManageLearning, canManageTalent,
  canManageEngagement, canManageEmployeeRelations, canManageCompensation,
  canManageCountryPacks, canManageAI, canExportEmployees,
} from "./permissions";

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

describe("separation of employee administration and specialist duties", () => {
  it("allows payroll edits without granting personnel administration", () => {
    expect(canEditPayroll("payroll_officer")).toBe(true);
    expect(canEditBank("payroll_officer")).toBe(true);
    expect(canEditAssignment("payroll_officer")).toBe(false);
    expect(canManageDocuments("payroll_officer")).toBe(false);
    expect(canManageEmployeeRelations("payroll_officer")).toBe(false);
    expect(canManageAI("payroll_officer")).toBe(false);
  });

  it("lets auditors export without granting write capabilities", () => {
    expect(canExportEmployees("auditor")).toBe(true);
    for (const permission of [canEditAssignment, canEditBank, canEditPayroll,
      canManageDocuments, canManageLearning, canManageTalent, canManageEngagement,
      canManageEmployeeRelations, canManageCompensation, canManageCountryPacks, canManageAI]) {
      expect(permission("auditor")).toBe(false);
      expect(permission("employee")).toBe(false);
      expect(permission("hr_manager")).toBe(true);
      expect(permission("super_admin")).toBe(true);
    }
    expect(canExportEmployees("employee")).toBe(false);
  });

  it("limits performance leads to talent and engagement administration", () => {
    expect(canManageTalent("performance_lead")).toBe(true);
    expect(canManageEngagement("performance_lead")).toBe(true);
    expect(canManageLearning("performance_lead")).toBe(false);
    expect(canManageEmployeeRelations("performance_lead")).toBe(false);
    expect(canEditBank("performance_lead")).toBe(false);
  });

  it("allows financial configuration without granting salary and bank edits", () => {
    expect(canManageCompensation("finance_officer")).toBe(true);
    expect(canManageCountryPacks("finance_officer")).toBe(true);
    expect(canEditPayroll("finance_officer")).toBe(false);
    expect(canEditBank("finance_officer")).toBe(false);
  });

  it("denies unknown modules and applies the same permissions to route aliases", () => {
    expect(canAccessModule("super_admin", "unknown-module")).toBe(false);
    expect(canManageModule("super_admin", "unknown-module")).toBe(false);
    expect(canAccessModule("employee", "employee-relations")).toBe(true);
    expect(canManageModule("employee", "employee-relations")).toBe(false);
    expect(canManageModule("hr_manager", "employee-relations")).toBe(true);
  });
});
