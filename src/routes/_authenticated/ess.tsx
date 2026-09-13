import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const EssMobileView = lazy(() =>
  import("../../components/ess/EssMobileView").then((m) => ({
    default: m.EssMobileView,
  })),
);

export const Route = createFileRoute("/_authenticated/ess")({
  head: () => ({
    meta: [{ title: "بوابة الخدمة الذاتية للموظف (ESS) | Focus HRMS" }],
  }),
  component: EssRoute,
});

function EssRoute() {
  const navigate = useNavigate();

  return (
    <RouteGuard moduleId="ess" moduleNameAr="بوابة الخدمة الذاتية للموظف">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل بوابة الخدمة الذاتية…
          </div>
        }
      >
        <EssMobileView
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
