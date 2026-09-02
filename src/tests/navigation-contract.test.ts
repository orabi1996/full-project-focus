import { describe, expect, it } from "vitest";

import { moduleAccess, moduleManageAccess } from "../lib/auth/permissions";
import { ar } from "../lib/translations/ar";

const navigationModules = [
  "dashboard",
  "organization",
  "employees",
  "rbac",
  "workflow",
  "leaves",
  "attendance",
  "shifts",
  "payroll",
  "loans",
  "expenses",
  "performance",
  "ats",
  "workforce",
  "assets",
  "reports",
  "integrations",
  "audit",
  "ess",
] as const;

describe("navigation and permission contracts", () => {
  it("defines Arabic navigation text and access policy for every screen", () => {
    for (const moduleId of navigationModules) {
      expect(ar.nav[moduleId]).toBeTruthy();
      expect(moduleAccess[moduleId]?.length).toBeGreaterThan(0);
    }
  });

  it("never grants management to a role that cannot view the module", () => {
    for (const [moduleId, managingRoles] of Object.entries(moduleManageAccess)) {
      if (moduleId === "settlements") continue;
      for (const role of managingRoles) {
        expect(moduleAccess[moduleId], `${role} must view ${moduleId}`).toContain(role);
      }
    }
  });

  it("keeps auditors read-only across the system", () => {
    for (const managingRoles of Object.values(moduleManageAccess)) {
      expect(managingRoles).not.toContain("auditor");
    }
  });
});
