import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canAccessModule, moduleAccess, moduleManageAccess } from "../lib/auth/permissions";
import { ar } from "../lib/translations/ar";
import { getLegacyHashRedirect, LEGACY_HASH_MAP, MODULE_ROUTE_MAP } from "../lib/router/legacy-hash";

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

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

describe("TanStack Router route architecture contracts", () => {
  it("defines real clean routes for all major HRMS modules", () => {
    expect(MODULE_ROUTE_MAP.dashboard).toBe("/dashboard");
    expect(MODULE_ROUTE_MAP.organization).toBe("/organization");
    expect(MODULE_ROUTE_MAP.employees).toBe("/employees");
    expect(MODULE_ROUTE_MAP.documents).toBe("/documents");
    expect(MODULE_ROUTE_MAP.rbac).toBe("/rbac");
    expect(MODULE_ROUTE_MAP.workflow).toBe("/workflows");
    expect(MODULE_ROUTE_MAP.leaves).toBe("/leaves");
    expect(MODULE_ROUTE_MAP.attendance).toBe("/attendance");
    expect(MODULE_ROUTE_MAP.shifts).toBe("/shifts");
    expect(MODULE_ROUTE_MAP.payroll).toBe("/payroll");
    expect(MODULE_ROUTE_MAP.loans).toBe("/loans");
    expect(MODULE_ROUTE_MAP.expenses).toBe("/expenses");
    expect(MODULE_ROUTE_MAP.ats).toBe("/recruitment");
    expect(MODULE_ROUTE_MAP.performance).toBe("/performance");
    expect(MODULE_ROUTE_MAP.workforce).toBe("/workforce");
    expect(MODULE_ROUTE_MAP.assets).toBe("/assets");
    expect(MODULE_ROUTE_MAP.reports).toBe("/reports");
    expect(MODULE_ROUTE_MAP.integrations).toBe("/integrations");
    expect(MODULE_ROUTE_MAP.audit).toBe("/audit");
    expect(MODULE_ROUTE_MAP.ess).toBe("/ess");
  });

  it("ensures AppLayout is a true router shell with Outlet and no hash navigation", () => {
    const appLayoutCode = source("../components/layout/AppLayout.tsx");
    expect(appLayoutCode).toContain("<Outlet");
    expect(appLayoutCode).not.toContain("renderActiveView");
    expect(appLayoutCode).not.toContain("window.location.hash");
    expect(appLayoutCode).not.toContain("window.addEventListener(\"hashchange\"");
    expect(appLayoutCode).not.toContain("history.pushState(null, \"\", `#");
  });

  it("ensures protected layout route owns AuthGate and AppProvider", () => {
    const authLayoutCode = source("../routes/_authenticated.tsx");
    expect(authLayoutCode).toContain("<AuthGate>");
    expect(authLayoutCode).toContain("<AppProvider>");
    expect(authLayoutCode).toContain("<AppLayout />");
  });

  it("ensures root index route redirects authenticated users to /dashboard", () => {
    const indexRouteCode = source("../routes/index.tsx");
    expect(indexRouteCode).toContain('legacyTarget || "/dashboard"');
    expect(indexRouteCode).toContain("getLegacyHashRedirect(window.location.hash)");
    expect(indexRouteCode).toContain("<AuthGate>");
  });
});

describe("route-level RBAC authorization enforcement", () => {
  it("blocks unauthorized roles from direct access to confidential modules", () => {
    // Employee must not have access to payroll or rbac
    expect(canAccessModule("employee", "payroll")).toBe(false);
    expect(canAccessModule("employee", "rbac")).toBe(false);
    expect(canAccessModule("employee", "organization")).toBe(false);
    expect(canAccessModule("employee", "audit")).toBe(false);
    expect(canAccessModule("employee", "ats")).toBe(false);

    // HR manager and super admin have access
    expect(canAccessModule("super_admin", "payroll")).toBe(true);
    expect(canAccessModule("super_admin", "rbac")).toBe(true);
    expect(canAccessModule("hr_manager", "payroll")).toBe(true);
    expect(canAccessModule("hr_manager", "employees")).toBe(true);
  });

  it("verifies RouteGuard component exists and protects routes", () => {
    const routeGuardCode = source("../components/auth/RouteGuard.tsx");
    expect(routeGuardCode).toContain("canAccessModule");
    expect(routeGuardCode).toContain("غير مصرح لك بالوصول");
  });
});

describe("legacy hash compatibility migration contracts", () => {
  it("maps legacy bookmark hashes to target routes accurately", () => {
    expect(getLegacyHashRedirect("#employees")).toBe("/employees");
    expect(getLegacyHashRedirect("#payroll")).toBe("/payroll");
    expect(getLegacyHashRedirect("#attendance")).toBe("/attendance");
    expect(getLegacyHashRedirect("#workflow")).toBe("/workflows");
    expect(getLegacyHashRedirect("#ats")).toBe("/recruitment");
    expect(getLegacyHashRedirect("#loans")).toBe("/loans");
    expect(getLegacyHashRedirect("#ess")).toBe("/ess");
    expect(getLegacyHashRedirect("#dashboard")).toBe("/dashboard");
    expect(getLegacyHashRedirect("#organization")).toBe("/organization");
  });

  it("never intercepts Supabase auth tokens or recovery fragments", () => {
    expect(getLegacyHashRedirect("#access_token=xyz123&type=recovery")).toBeNull();
    expect(getLegacyHashRedirect("#type=recovery")).toBeNull();
    expect(getLegacyHashRedirect("#error=unauthorized")).toBeNull();
  });

  it("returns null for unknown or non-hash URLs", () => {
    expect(getLegacyHashRedirect("")).toBeNull();
    expect(getLegacyHashRedirect("/employees")).toBeNull();
    expect(getLegacyHashRedirect("#unknown_random_hash")).toBeNull();
  });
});

describe("deep-linking route contracts", () => {
  it("verifies employee deep link route validates existence and data scope", () => {
    const employeeRouteCode = source("../routes/_authenticated/employees/$employeeId.tsx");
    expect(employeeRouteCode).toContain("employeeId");
    expect(employeeRouteCode).toContain("canAccessModule");
    expect(employeeRouteCode).toContain("الموظف المطلوب غير موجود");
    expect(employeeRouteCode).toContain("<EmployeeFullProfileView");
  });

  it("verifies payroll run deep link route validates run existence and permissions", () => {
    const payrollRunRouteCode = source("../routes/_authenticated/payroll/$runId.tsx");
    expect(payrollRunRouteCode).toContain("runId");
    expect(payrollRunRouteCode).toContain("canAccessModule(currentRole, \"payroll\")");
    expect(payrollRunRouteCode).toContain("مسير الرواتب المطلوب غير موجود");
    expect(payrollRunRouteCode).toContain("<PayrollView");
  });
});
