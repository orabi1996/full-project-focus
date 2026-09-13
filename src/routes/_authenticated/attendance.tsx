import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const AttendanceView = lazy(() =>
  import("../../components/attendance/AttendanceView").then((m) => ({
    default: m.AttendanceView,
  })),
);

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [{ title: "الحضور والانصراف والبصمة | Focus HRMS" }],
  }),
  component: AttendanceRoute,
});

function AttendanceRoute() {
  return (
    <RouteGuard moduleId="attendance" moduleNameAr="الحضور والانصراف">
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل سجلات الحضور والانصراف…
          </div>
        }
      >
        <AttendanceView />
      </Suspense>
    </RouteGuard>
  );
}
