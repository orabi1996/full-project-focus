import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const OrganizationView = lazy(() =>
  import("../../components/organization/OrganizationView").then((m) => ({
    default: m.OrganizationView,
  })),
);

export const Route = createFileRoute("/_authenticated/organization")({
  head: () => ({
    meta: [{ title: "المنشأة والهيكل التنظيمي | Focus HRMS" }],
  }),
  component: OrganizationRoute,
});

function OrganizationRoute() {
  return (
    <RouteGuard moduleId="organization" moduleNameAr="المنشأة والهيكل التنظيمي">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل المنشأة والهيكل التنظيمي…
          </div>
        }
      >
        <OrganizationView />
      </Suspense>
    </RouteGuard>
  );
}
