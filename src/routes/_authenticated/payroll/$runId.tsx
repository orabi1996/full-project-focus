import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useApp } from "../../../lib/context/AppContext";
import { canAccessModule } from "../../../lib/auth/permissions";
import { ArrowRight, ShieldAlert, FileX } from "lucide-react";
import { Button } from "../../../components/ui/button";

const PayrollView = lazy(() =>
  import("../../../components/payroll/PayrollView").then((m) => ({
    default: m.PayrollView,
  })),
);

export const Route = createFileRoute("/_authenticated/payroll/$runId")({
  head: () => ({
    meta: [{ title: "تفاصيل مسير الرواتب | Focus HRMS" }],
  }),
  component: PayrollRunDetailRoute,
});

function PayrollRunDetailRoute() {
  const { runId } = Route.useParams();
  const { payrollRuns, currentRole } = useApp();
  const navigate = useNavigate();

  // Enforce confidential payroll permissions
  const hasPayrollAccess = canAccessModule(currentRole, "payroll");
  if (!hasPayrollAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">
          غير مصرح لك باستعراض مسيرات الرواتب
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          تعتبر مسيرات الرواتب بيانات سرية ومحصورة بالأدوار المالية والإدارية المخولة وفق مصفوفة RBAC.
        </p>
        <Button
          onClick={() => navigate({ to: "/dashboard" })}
          className="rounded-full text-xs font-bold gap-2 cursor-pointer"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للرئيسية
        </Button>
      </div>
    );
  }

  const run = payrollRuns.find((r) => r.id === runId);

  // Safe Not Found state for invalid run IDs
  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-4">
          <FileX className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">
          مسير الرواتب المطلوب غير موجود
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          لم يتم العثور على مسير رواتب بالمعرّف ({runId}). يرجى التأكد من الرابط أو اختيار مسير من القائمة.
        </p>
        <Button
          onClick={() => navigate({ to: "/payroll" })}
          className="rounded-full text-xs font-bold gap-2 cursor-pointer"
        >
          <ArrowRight className="h-4 w-4" />
          العودة لمسيرات الرواتب
        </Button>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          جاري تحميل بيانات مسير الرواتب…
        </div>
      }
    >
      <PayrollView key={`payroll-run-${runId}`} section="payroll" initialRunId={runId} />
    </Suspense>
  );
}
