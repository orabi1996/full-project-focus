import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const AuditView = lazy(() =>
  import("../../components/audit/AuditView").then((m) => ({
    default: m.AuditView,
  })),
);

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [{ title: "سجل التدقيق والعمليات الأمنية | Focus HRMS" }],
  }),
  component: AuditRoute,
});

function AuditRoute() {
  return (
    <RouteGuard moduleId="audit" moduleNameAr="سجل التدقيق والعمليات">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل سجل التدقيق الأمني…
          </div>
        }
      >
        <AuditView />
      </Suspense>
    </RouteGuard>
  );
}
