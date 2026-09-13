import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const AssetsView = lazy(() =>
  import("../../components/assets/AssetsView").then((m) => ({
    default: m.AssetsView,
  })),
);

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({
    meta: [{ title: "إدارة العهد والأصول والسياسات | Focus HRMS" }],
  }),
  component: AssetsRoute,
});

function AssetsRoute() {
  return (
    <RouteGuard moduleId="assets" moduleNameAr="إدارة العهد والأصول">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل سجل العهد والأصول…
          </div>
        }
      >
        <AssetsView />
      </Suspense>
    </RouteGuard>
  );
}
