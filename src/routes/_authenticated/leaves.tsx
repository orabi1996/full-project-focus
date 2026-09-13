import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const LeavesView = lazy(() =>
  import("../../components/leaves/LeavesView").then((m) => ({
    default: m.LeavesView,
  })),
);

export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({
    meta: [{ title: "إدارة الإجازات والعطلات | Focus HRMS" }],
  }),
  component: LeavesRoute,
});

function LeavesRoute() {
  return (
    <RouteGuard moduleId="leaves" moduleNameAr="إدارة الإجازات">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل شاشة الإجازات…
          </div>
        }
      >
        <LeavesView />
      </Suspense>
    </RouteGuard>
  );
}
