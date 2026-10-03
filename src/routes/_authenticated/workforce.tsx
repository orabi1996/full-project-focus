import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const WorkforcePlanningView = lazy(() =>
  import("../../components/workforce/WorkforcePlanningView").then((m) => ({
    default: m.WorkforcePlanningView,
  })),
);

export const Route = createFileRoute("/_authenticated/workforce")({
  head: () => ({
    meta: [{ title: "تخطيط القوى العاملة والميزانيات | Focus HRMS" }],
  }),
  component: WorkforceRoute,
});

function WorkforceRoute() {
  return (
    <RouteGuard moduleId="workforce" moduleNameAr="تخطيط القوى العاملة">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل خطط القوى العاملة…
          </div>
        }
      >
        <WorkforcePlanningView />
      </Suspense>
    </RouteGuard>
  );
}
