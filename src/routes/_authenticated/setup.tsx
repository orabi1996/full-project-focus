import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const SetupDashboard = lazy(() =>
  import("../../components/setup/SetupDashboard").then((m) => ({
    default: m.SetupDashboard,
  })),
);

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [{ title: "تهيئة النظام — شركة الأندلس | Focus HRMS" }],
  }),
  component: SetupRoute,
});

function SetupRoute() {
  return (
    <RouteGuard moduleId="setup" moduleNameAr="تهيئة النظام">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل تهيئة النظام…
          </div>
        }
      >
        <SetupDashboard />
      </Suspense>
    </RouteGuard>
  );
}
