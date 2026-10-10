import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const MovementsView = lazy(() =>
  import("../../components/movements/MovementsView").then((m) => ({
    default: m.MovementsView,
  })),
);

export const Route = createFileRoute("/_authenticated/movements")({
  head: () => ({
    meta: [{ title: "تنقلات الموظفين ودورة الحياة الوظيفية | MadarX" }],
  }),
  component: MovementsRoute,
});

function MovementsRoute() {
  return (
    <RouteGuard moduleId="movements" moduleNameAr="تنقلات الموظفين ودورة الحياة الوظيفية">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل نظام تنقلات الموظفين ودورة الحياة الوظيفية…
          </div>
        }
      >
        <MovementsView />
      </Suspense>
    </RouteGuard>
  );
}
