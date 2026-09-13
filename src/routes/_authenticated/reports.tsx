import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const ReportsView = lazy(() =>
  import("../../components/reports/ReportsView").then((m) => ({
    default: m.ReportsView,
  })),
);

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [{ title: "التقارير ومولد الاستعلامات | Focus HRMS" }],
  }),
  component: ReportsRoute,
});

function ReportsRoute() {
  return (
    <RouteGuard moduleId="reports" moduleNameAr="التقارير ومولد الاستعلامات">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل كتالوج التقارير…
          </div>
        }
      >
        <ReportsView />
      </Suspense>
    </RouteGuard>
  );
}
