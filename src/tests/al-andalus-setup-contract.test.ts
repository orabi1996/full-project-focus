import { describe, expect, it } from "vitest";
import { canAccessModule, canManageModule } from "../lib/auth/permissions";
import { MODULE_ROUTE_MAP, LEGACY_HASH_MAP, getLegacyHashRedirect } from "../lib/router/legacy-hash";
import { ar } from "../lib/translations/ar";
import { en } from "../lib/translations/en";

describe("Prompt 11 — Al-Andalus Company Setup & Governance Contract", () => {
  it("allows only authorized roles to access and manage the setup module", () => {
    expect(canAccessModule("super_admin", "setup")).toBe(true);
    expect(canAccessModule("hr_manager", "setup")).toBe(true);
    expect(canAccessModule("employee", "setup")).toBe(false);
    expect(canAccessModule("attendance_officer", "setup")).toBe(false);
    expect(canAccessModule("payroll_officer", "setup")).toBe(false);
    expect(canAccessModule("auditor", "setup")).toBe(false);

    expect(canManageModule("super_admin", "setup")).toBe(true);
    expect(canManageModule("hr_manager", "setup")).toBe(true);
    expect(canManageModule("employee", "setup")).toBe(false);
  });

  it("configures routing maps and legacy hash redirect for /setup", () => {
    expect(MODULE_ROUTE_MAP["setup"]).toBe("/setup");
    expect(LEGACY_HASH_MAP["#setup"]).toBe("/setup");
    expect(getLegacyHashRedirect("#setup")).toBe("/setup");
  });

  it("provides Arabic and English translations for system setup", () => {
    expect(ar.nav.setup).toBe("تهيئة النظام");
    expect(en.nav.setup).toBe("System Setup");
  });
});
