import { describe, expect, it } from "vitest";
import {
  ALL_SYSTEM_SCREENS,
  createFullAccessScreenMap,
  createReadOnlyScreenMap,
  INITIAL_ENTERPRISE_GROUPS,
} from "./rbac-definitions";

describe("RBAC System Definitions & Screen Catalog", () => {
  it("contains exactly 20 full enterprise screens covering all modules", () => {
    expect(ALL_SYSTEM_SCREENS).toHaveLength(20);
    const codes = ALL_SYSTEM_SCREENS.map((s) => s.code);
    expect(codes).toContain("M01");
    expect(codes).toContain("M05");
    expect(codes).toContain("M10");
    expect(codes).toContain("M20");
  });

  it("every screen has complete Arabic and English metadata", () => {
    for (const screen of ALL_SYSTEM_SCREENS) {
      expect(screen.id).toBeTruthy();
      expect(screen.nameAr).toBeTruthy();
      expect(screen.nameEn).toBeTruthy();
      expect(screen.category).toBeTruthy();
      expect(screen.iconName).toBeTruthy();
    }
  });

  it("createFullAccessScreenMap enables all CRUD actions across all 20 screens", () => {
    const fullMap = createFullAccessScreenMap();
    expect(Object.keys(fullMap)).toHaveLength(20);
    for (const screen of ALL_SYSTEM_SCREENS) {
      expect(fullMap[screen.id]).toEqual({
        view: true,
        create: true,
        edit: true,
        delete: true,
        approveExport: true,
      });
    }
  });

  it("createReadOnlyScreenMap enables only view and export while disabling write operations", () => {
    const readOnlyMap = createReadOnlyScreenMap();
    expect(Object.keys(readOnlyMap)).toHaveLength(20);
    for (const screen of ALL_SYSTEM_SCREENS) {
      expect(readOnlyMap[screen.id].view).toBe(true);
      expect(readOnlyMap[screen.id].create).toBe(false);
      expect(readOnlyMap[screen.id].edit).toBe(false);
      expect(readOnlyMap[screen.id].delete).toBe(false);
    }
  });

  it("initializes essential enterprise groups including super_admin and hr_manager", () => {
    const superAdmin = INITIAL_ENTERPRISE_GROUPS.find((g) => g.code === "super_admin");
    expect(superAdmin).toBeDefined();
    expect(superAdmin?.isSystem).toBe(true);
    expect(superAdmin?.dataScope).toBe("all");
    expect(superAdmin?.screens.dashboard.view).toBe(true);
    expect(superAdmin?.screens.payroll.create).toBe(true);

    const hrGroup = INITIAL_ENTERPRISE_GROUPS.find((g) => g.code === "hr_manager");
    expect(hrGroup).toBeDefined();
    expect(hrGroup?.memberUserIds.length).toBeGreaterThan(0);
  });
});
