import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const PerformanceView = lazy(() =>
  import("../../components/performance/PerformanceView").then((m) => ({
    default: m.PerformanceView,
  })),
);

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({
    meta: [{ title: "إدارة وتطوير الأداء 360° | Focus HRMS" }],
  }),
  component: PerformanceRoute,
});

function PerformanceRoute() {
  return (
    <RouteGuard moduleId="performance" moduleNameAr="إدارة وتطوير الأداء">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل دورات تقييم الأداء…
          </div>
        }
      >
        <PerformanceView />
      </Suspense>
    </RouteGuard>
  );
}
