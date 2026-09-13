import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const IntegrationsView = lazy(() =>
  import("../../components/integrations/IntegrationsView").then((m) => ({
    default: m.IntegrationsView,
  })),
);

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [{ title: "مركز التكامل والقيود المحاسبية | Focus HRMS" }],
  }),
  component: IntegrationsRoute,
});

function IntegrationsRoute() {
  return (
    <RouteGuard moduleId="integrations" moduleNameAr="مركز التكامل والقيود">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل مركز التكاملات…
          </div>
        }
      >
        <IntegrationsView />
      </Suspense>
    </RouteGuard>
  );
}
