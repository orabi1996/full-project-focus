import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const PayrollView = lazy(() =>
  import("../../components/payroll/PayrollView").then((m) => ({
    default: m.PayrollView,
  })),
);

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({
    meta: [{ title: "السلف ومكافأة نهاية الخدمة | Focus HRMS" }],
  }),
  component: LoansRoute,
});

function LoansRoute() {
  return (
    <RouteGuard moduleId="loans" moduleNameAr="السلف ومكافأة نهاية الخدمة">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل السلف والمخالصات…
          </div>
        }
      >
        <PayrollView key="loans" section="loans" />
      </Suspense>
    </RouteGuard>
  );
}
