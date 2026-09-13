import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const DashboardView = lazy(() =>
  import("../../components/dashboard/DashboardView").then((m) => ({
    default: m.DashboardView,
  })),
);

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "لوحة المؤشرات | Focus HRMS" }],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  const navigate = useNavigate();

  return (
    <RouteGuard moduleId="dashboard" moduleNameAr="لوحة المؤشرات">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل لوحة المؤشرات…
          </div>
        }
      >
        <DashboardView
          onNavigate={(target) => {
            const path = target.startsWith("/")
              ? target
              : `/${target === "workflow" ? "workflows" : target === "ats" ? "recruitment" : target}`;
            void navigate({ to: path as never });
          }}
        />
      </Suspense>
    </RouteGuard>
  );
}
