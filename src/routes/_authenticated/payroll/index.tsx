import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../../components/auth/RouteGuard";

const PayrollView = lazy(() =>
  import("../../../components/payroll/PayrollView").then((m) => ({
    default: m.PayrollView,
  })),
);

export const Route = createFileRoute("/_authenticated/payroll/")({
  head: () => ({
    meta: [{ title: "مسيرات الرواتب الشهرية | Focus HRMS" }],
  }),
  component: PayrollRoute,
});

function PayrollRoute() {
  return (
    <RouteGuard moduleId="payroll" moduleNameAr="مسيرات الرواتب">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل مسيرات الرواتب…
          </div>
        }
      >
        <PayrollView key="payroll" section="payroll" />
      </Suspense>
    </RouteGuard>
  );
}
