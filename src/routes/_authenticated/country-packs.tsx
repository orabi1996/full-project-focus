// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: PRODUCTION COUNTRY PACKS & STATUTORY COMPLIANCE ROUTE
// src/routes/_authenticated/country-packs.tsx
// ============================================================================

import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const CountryPacksView = lazy(() =>
  import("../../components/country-packs/CountryPacksView").then((m) => ({
    default: m.CountryPacksView,
  })),
);

export const Route = createFileRoute("/_authenticated/country-packs")({
  head: () => ({
    meta: [{ title: "حزم الدول والامتثال القانوني والتأمينات | MadarX" }],
  }),
  component: CountryPacksRoute,
});

function CountryPacksRoute() {
  return (
    <RouteGuard
      moduleId="country_packs"
      moduleNameAr="حزم الدول والامتثال القانوني والتأمينات"
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">جاري تحميل حزم الدول والامتثال القانوني...</p>
            </div>
          </div>
        }
      >
        <CountryPacksView />
      </Suspense>
    </RouteGuard>
  );
}
