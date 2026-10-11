import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const TalentView = lazy(() =>
  import("../../components/talent/TalentView").then((m) => ({
    default: m.TalentView,
  })),
);

export const Route = createFileRoute("/_authenticated/talent")({
  head: () => ({
    meta: [{ title: "المواهب والتعاقب والتنقل الداخلي | MadarX" }],
  }),
  component: TalentRoute,
});

function TalentRoute() {
  return (
    <RouteGuard moduleId="talent" moduleNameAr="المواهب والتعاقب والتنقل الداخلي">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل نظام المواهب وتخطيط التعاقب والتنقل الداخلي…
          </div>
        }
      >
        <TalentView />
      </Suspense>
    </RouteGuard>
  );
}
