// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 33: PRODUCTION COMPENSATION & BENEFITS ROUTE
// src/routes/_authenticated/compensation.tsx
// ============================================================================

import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const CompensationView = lazy(() =>
  import("../../components/compensation/CompensationView").then((m) => ({
    default: m.CompensationView,
  })),
);

export const Route = createFileRoute("/_authenticated/compensation")({
  head: () => ({
    meta: [{ title: "التعويضات والمزايا والمكافآت الشاملة | MadarX" }],
  }),
  component: CompensationRoute,
});

function CompensationRoute() {
  return (
    <RouteGuard
      moduleId="compensation"
      moduleNameAr="التعويضات والمزايا والمكافآت الشاملة"
    >
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل منظومة التعويضات والمزايا وهيكل الرواتب…
          </div>
        }
      >
        <CompensationView />
      </Suspense>
    </RouteGuard>
  );
}
