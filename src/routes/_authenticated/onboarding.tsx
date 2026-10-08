import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const OnboardingView = lazy(() =>
  import("../../components/onboarding/OnboardingView").then((m) => ({
    default: m.OnboardingView,
  })),
);

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [{ title: "تهيئة الموظفين الجدد وفترة التجربة | MadarX" }],
  }),
  component: OnboardingRoute,
});

function OnboardingRoute() {
  return (
    <RouteGuard moduleId="onboarding" moduleNameAr="تهيئة الموظفين الجدد وفترة التجربة">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل نظام التهيئة ومتابعة المنضمين الجدد…
          </div>
        }
      >
        <OnboardingView />
      </Suspense>
    </RouteGuard>
  );
}
