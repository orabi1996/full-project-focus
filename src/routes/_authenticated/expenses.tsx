import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const ExpensesView = lazy(() =>
  import("../../components/expenses/ExpensesView").then((m) => ({
    default: m.ExpensesView,
  })),
);

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [{ title: "إدارة المصروفات والنفقات | Focus HRMS" }],
  }),
  component: ExpensesRoute,
});

function ExpensesRoute() {
  return (
    <RouteGuard moduleId="expenses" moduleNameAr="إدارة المصروفات">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل إدارة المصروفات…
          </div>
        }
      >
        <ExpensesView />
      </Suspense>
    </RouteGuard>
  );
}
