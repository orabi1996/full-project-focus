import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const RecruitmentView = lazy(() =>
  import("../../components/recruitment/RecruitmentView").then((m) => ({
    default: m.RecruitmentView,
  })),
);

export const Route = createFileRoute("/_authenticated/recruitment")({
  head: () => ({
    meta: [{ title: "استقطاب المواهب وتتبع المتقدمين ATS | Focus HRMS" }],
  }),
  component: RecruitmentRoute,
});

function RecruitmentRoute() {
  return (
    <RouteGuard moduleId="ats" moduleNameAr="استقطاب المواهب والتوظيف">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل نظام التوظيف والمتقدمين…
          </div>
        }
      >
        <RecruitmentView key="ats" section="ats" />
      </Suspense>
    </RouteGuard>
  );
}
