import { describe, expect, it } from "vitest";
import type { OrgUnit } from "../../types";
import {
  buildOrganizationTree,
  filterOrganizationTree,
  getDescendantIds,
} from "./organization-utils";

const unit = (id: string, parentId?: string): OrgUnit => ({
  id,
  companyId: "company",
  parentId,
  nameAr: id,
  nameEn: id,
  code: id.toUpperCase(),
  type: "department",
  status: "active",
  employeeCount: 0,
});

describe("organization tree", () => {
  const units = [unit("root"), unit("child", "root"), unit("leaf", "child")];

  it("builds hierarchy and calculates depths", () => {
    const tree = buildOrganizationTree(units);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].depth).toBe(2);
  });

  it("returns all descendants for safe parent selection", () => {
    expect([...getDescendantIds(units, "root")]).toEqual(["child", "leaf"]);
  });

  it("keeps parents when a descendant matches the search", () => {
    const filtered = filterOrganizationTree(buildOrganizationTree(units), "leaf");
    expect(filtered[0].children[0].children[0].id).toBe("leaf");
  });

  it("treats orphan units as roots", () => {
    expect(buildOrganizationTree([unit("orphan", "missing")])[0].id).toBe("orphan");
  });
});
