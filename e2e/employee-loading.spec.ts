import { expect, test } from "@playwright/test";
import { enterDemo, openModule } from "./helpers";

test("employee read failure is distinct from an empty directory and can be retried", async ({ page }) => {
  await enterDemo(page);
  let fail = true;
  await page.route("**/rest/v1/rpc/get_employee_directory", async (route) => {
    if (fail) {
      await route.fulfill({ status: 503, json: { message: "Test backend unavailable" } });
    } else {
      await route.fulfill({ json: { items: [], total_count: 0, page: 1, page_size: 25 } });
    }
  });
  await openModule(page, "دليل وملفات الموظفين", "employees");
  await expect(page.getByRole("alert")).toContainText("تعذر تحميل بيانات الموظفين");
  await expect(page.getByText("لا توجد سجلات موظفين متاحة ضمن نطاق العرض الحالي")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "إضافة موظف جديد", exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "إعادة المحاولة", exact: true }).click();
  await expect(page.getByText("لا توجد سجلات موظفين متاحة ضمن نطاق العرض الحالي")).toBeVisible();
  await expect(page.getByRole("button", { name: "إضافة موظف جديد", exact: true })).toBeVisible();
});
