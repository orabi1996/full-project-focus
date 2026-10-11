import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const LearningView = lazy(() =>
  import("../../components/learning/LearningView").then((m) => ({
    default: m.LearningView,
  })),
);

export const Route = createFileRoute("/_authenticated/learning")({
  head: () => ({
    meta: [{ title: "التدريب والمهارات والشهادات المهنية | MadarX" }],
  }),
  component: LearningRoute,
});

function LearningRoute() {
  return (
    <RouteGuard moduleId="learning" moduleNameAr="التدريب والمهارات والشهادات المهنية">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل نظام التدريب والمهارات والشهادات المهنية…
          </div>
        }
      >
        <LearningView />
      </Suspense>
    </RouteGuard>
  );
}
