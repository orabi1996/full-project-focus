import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const DocumentVaultView = lazy(() =>
  import("../../components/documents/DocumentVaultView").then((m) => ({
    default: m.DocumentVaultView,
  })),
);

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [{ title: "مستودع الوثائق والشهادات | Focus HRMS" }],
  }),
  component: DocumentsRoute,
});

function DocumentsRoute() {
  return (
    <RouteGuard moduleId="documents" moduleNameAr="مستودع الوثائق والشهادات">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل مستودع الوثائق…
          </div>
        }
      >
        <DocumentVaultView />
      </Suspense>
    </RouteGuard>
  );
}
