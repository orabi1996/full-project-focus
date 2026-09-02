import type { OrgUnit } from "../../types";

export interface OrganizationTreeNode extends OrgUnit {
  children: OrganizationTreeNode[];
  depth: number;
}

export function getDescendantIds(units: OrgUnit[], unitId: string): Set<string> {
  const descendants = new Set<string>();
  const pending = [unitId];

  while (pending.length > 0) {
    const parentId = pending.shift();
    for (const unit of units) {
      if (unit.parentId === parentId && !descendants.has(unit.id)) {
        descendants.add(unit.id);
        pending.push(unit.id);
      }
    }
  }

  return descendants;
}

export function buildOrganizationTree(units: OrgUnit[]): OrganizationTreeNode[] {
  const knownIds = new Set(units.map((unit) => unit.id));
  const childrenByParent = new Map<string | null, OrgUnit[]>();

  for (const unit of units) {
    const parentKey = unit.parentId && knownIds.has(unit.parentId) ? unit.parentId : null;
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(unit);
    childrenByParent.set(parentKey, siblings);
  }

  const visit = (unit: OrgUnit, depth: number, visited: Set<string>): OrganizationTreeNode => {
    if (visited.has(unit.id)) return { ...unit, depth, children: [] };
    const nextVisited = new Set(visited).add(unit.id);
    return {
      ...unit,
      depth,
      children: (childrenByParent.get(unit.id) ?? [])
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((child) => visit(child, depth + 1, nextVisited)),
    };
  };

  return (childrenByParent.get(null) ?? [])
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((unit) => visit(unit, 0, new Set()));
}

export function filterOrganizationTree(
  nodes: OrganizationTreeNode[],
  search: string,
): OrganizationTreeNode[] {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return nodes;

  return nodes.flatMap((node) => {
    const children = filterOrganizationTree(node.children, search);
    const matches = [node.nameAr, node.nameEn, node.code, node.managerName]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(query));
    return matches || children.length > 0 ? [{ ...node, children }] : [];
  });
}
