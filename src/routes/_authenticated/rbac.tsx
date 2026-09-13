import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const RbacView = lazy(() =>
  import("../../components/rbac/RbacView").then((m) => ({
    default: m.RbacView,
  })),
);

export const Route = createFileRoute("/_authenticated/rbac")({
  head: () => ({
    meta: [{ title: "إدارة الصلاحيات والأدوار (RBAC) | Focus HRMS" }],
  }),
  component: RbacRoute,
});

function RbacRoute() {
  return (
    <RouteGuard moduleId="rbac" moduleNameAr="إدارة الصلاحيات والأدوار">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل شاشة الصلاحيات والأدوار…
          </div>
        }
      >
        <RbacView />
      </Suspense>
    </RouteGuard>
  );
}
