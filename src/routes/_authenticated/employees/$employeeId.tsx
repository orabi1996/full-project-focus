import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useApp } from "../../../lib/context/AppContext";
import { canAccessModule } from "../../../lib/auth/permissions";
import { ArrowRight, UserX } from "lucide-react";
import { Button } from "../../../components/ui/button";

const EmployeeFullProfileView = lazy(() =>
  import("../../../components/employees/EmployeeFullProfileView").then((m) => ({
    default: m.EmployeeFullProfileView,
  })),
);

export const Route = createFileRoute("/_authenticated/employees/$employeeId")({
  head: () => ({
    meta: [{ title: "الملف الوظيفي الشامل للموظف | Focus HRMS" }],
  }),
  component: EmployeeProfileRoute,
});

function EmployeeProfileRoute() {
  const { employeeId } = Route.useParams();
  const { employees, currentRole, currentUser } = useApp();
  const navigate = useNavigate();

  // Enforce Data Scope / RBAC: Admins & HR can view all; Employee can only view own profile
  const canViewAllEmployees = canAccessModule(currentRole, "employees");
  const isSelf = currentUser?.id === employeeId;

  if (!canViewAllEmployees && !isSelf) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <UserX className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">
          غير مصرح لك بعرض بيانات هذا الموظف
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          وفق ضوابط حماية البيانات ونطاق الصلاحيات، لا يمكنك استعراض الملف الوظيفي لغير حسابك الشخصي.
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

  const employee = employees.find((e) => e.id === employeeId);

  // Safe Not Found State for unknown employee IDs
  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-4">
          <UserX className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">
          الموظف المطلوب غير موجود
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          لم يتم العثور على سجل للموظف بالمعرّف ({employeeId}). قد يكون تم نقله أو حذفه من المنظومة.
        </p>
        <Button
          onClick={() => navigate({ to: "/employees" })}
          className="rounded-full text-xs font-bold gap-2 cursor-pointer"
        >
          <ArrowRight className="h-4 w-4" />
          العودة لدليل الموظفين
        </Button>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          جاري تحميل الملف الوظيفي الشامل…
        </div>
      }
    >
      <EmployeeFullProfileView
        employeeId={employeeId}
        onBack={() => navigate({ to: "/employees" })}
      />
    </Suspense>
  );
}
