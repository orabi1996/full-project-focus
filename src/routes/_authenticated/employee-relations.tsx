// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: PRODUCTION EMPLOYEE RELATIONS, CASES & DISCIPLINARY ROUTE
// src/routes/_authenticated/employee-relations.tsx
// ============================================================================

import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const EmployeeRelationsView = lazy(() =>
  import("../../components/employee-relations/EmployeeRelationsView").then((m) => ({
    default: m.EmployeeRelationsView,
  })),
);

export const Route = createFileRoute("/_authenticated/employee-relations")({
  head: () => ({
    meta: [{ title: "علاقات الموظفين والقضايا والتحقيقات | MadarX" }],
  }),
  component: EmployeeRelationsRoute,
});

function EmployeeRelationsRoute() {
  return (
    <RouteGuard
      moduleId="employee_relations"
      moduleNameAr="علاقات الموظفين والقضايا والتحقيقات"
    >
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل منظومة علاقات الموظفين والقضايا والتحقيقات…
          </div>
        }
      >
        <EmployeeRelationsView />
      </Suspense>
    </RouteGuard>
  );
}
