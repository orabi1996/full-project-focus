import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const ShiftsView = lazy(() =>
  import("../../components/shifts/ShiftsView").then((m) => ({
    default: m.ShiftsView,
  })),
);

export const Route = createFileRoute("/_authenticated/shifts")({
  head: () => ({
    meta: [{ title: "إدارة ورديات ودوامات العمل | Focus HRMS" }],
  }),
  component: ShiftsRoute,
});

function ShiftsRoute() {
  return (
    <RouteGuard moduleId="shifts" moduleNameAr="إدارة ورديات العمل">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل جدول الورديات…
          </div>
        }
      >
        <ShiftsView />
      </Suspense>
    </RouteGuard>
  );
}
