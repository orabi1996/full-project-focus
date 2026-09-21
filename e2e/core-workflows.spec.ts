import { expect, test } from "@playwright/test";

import { enterDemo, openModule } from "./helpers";

test("يفتح الإجراءات الحساسة في وضع المراجعة", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "المسار المكتبي فقط");
  await enterDemo(page);

  const flows = [
    ["employees", "دليل وملفات الموظفين", /إضافة موظف/],
    ["leaves", "الإجازات والعطلات", /طلب إجازة/],
    ["attendance", "الحضور والانصراف", /تصحيح|بصمة/],
    ["payroll", "مسيرات الرواتب", /تشغيل مسير/],
    ["expenses", "إدارة النفقات", /مطالبة|مصروف/],
    ["ats", "التوظيف وتتبع المتقدمين", /وظيفة|مرشح/],
  ] as const;

  for (const [moduleId, moduleName, action] of flows) {
    await openModule(page, moduleName, moduleId);
    await expect(page.getByText(action).first()).toBeVisible();
  }
});
