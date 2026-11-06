import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "../../components/auth/RouteGuard";
import { EmployeeExcelImport } from "../../components/data-update/EmployeeExcelImport";

export const Route = createFileRoute("/_authenticated/data-update")({
  head: () => ({
    meta: [
      { title: "تحديث البيانات — استيراد الموظفين | MadarX" },
      { name: "description", content: "إضافة الموظفين دفعة واحدة من ملف إكسل." },
    ],
  }),
  component: () => (
    <RouteGuard moduleId="data_update" moduleNameAr="تحديث البيانات">
      <EmployeeExcelImport />
    </RouteGuard>
  ),
});
