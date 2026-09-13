import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const WorkflowView = lazy(() =>
  import("../../components/workflow/WorkflowView").then((m) => ({
    default: m.WorkflowView,
  })),
);

export const Route = createFileRoute("/_authenticated/workflows")({
  head: () => ({
    meta: [{ title: "سير الموافقات والاعتمادات | Focus HRMS" }],
  }),
  component: WorkflowsRoute,
});

function WorkflowsRoute() {
  return (
    <RouteGuard moduleId="workflow" moduleNameAr="سير الموافقات والاعتمادات">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل سير الموافقات…
          </div>
        }
      >
        <WorkflowView />
      </Suspense>
    </RouteGuard>
  );
}
