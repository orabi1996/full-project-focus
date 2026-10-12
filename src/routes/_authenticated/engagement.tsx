import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const EngagementView = lazy(() =>
  import("../../components/engagement/EngagementView").then((m) => ({
    default: m.EngagementView,
  })),
);

export const Route = createFileRoute("/_authenticated/engagement")({
  head: () => ({
    meta: [{ title: "الارتباط المؤسسي والنبض والتقدير | MadarX" }],
  }),
  component: EngagementRoute,
});

function EngagementRoute() {
  return (
    <RouteGuard moduleId="engagement" moduleNameAr="الارتباط المؤسسي والنبض والتقدير">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل منصة الارتباط المؤسسي واستبيانات النبض والتقدير…
          </div>
        }
      >
        <EngagementView />
      </Suspense>
    </RouteGuard>
  );
}
