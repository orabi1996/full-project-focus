import { describe, expect, it } from "vitest";

import { resolvePrimaryRole } from "./roles";

describe("resolvePrimaryRole", () => {
  it("selects an elevated role even when the default employee role is returned first", () => {
    expect(resolvePrimaryRole(["employee", "hr_manager"])).toBe("hr_manager");
  });

  it("selects the highest-priority role deterministically", () => {
    expect(resolvePrimaryRole(["auditor", "org_admin", "payroll_officer"])).toBe("org_admin");
    expect(resolvePrimaryRole(["hr_manager", "super_admin"])).toBe("super_admin");
  });

  it("falls back safely when no recognized role exists", () => {
    expect(resolvePrimaryRole([])).toBe("employee");
    expect(resolvePrimaryRole(["unknown_role", null])).toBe("employee");
  });
});
