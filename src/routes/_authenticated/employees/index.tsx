import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../../components/auth/RouteGuard";

const EmployeesView = lazy(() =>
  import("../../../components/employees/EmployeesView").then((m) => ({
    default: m.EmployeesView,
  })),
);

export const Route = createFileRoute("/_authenticated/employees/")({
  head: () => ({
    meta: [{ title: "سجل وملفات الموظفين | Focus HRMS" }],
  }),
  component: EmployeesRoute,
});

function EmployeesRoute() {
  return (
    <RouteGuard moduleId="employees" moduleNameAr="سجل وملفات الموظفين">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل سجل الموظفين…
          </div>
        }
      >
        <EmployeesView />
      </Suspense>
    </RouteGuard>
  );
}
