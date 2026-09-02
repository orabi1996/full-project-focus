import { expect, test } from "@playwright/test";

import { enterDemo } from "./helpers";

test("يفتح الإجراءات الحساسة في وضع المراجعة", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "المسار المكتبي فقط");
  await enterDemo(page);

  const flows = [
    ["دليل وملفات الموظفين", /إضافة موظف/],
    ["الإجازات والعطلات", /طلب إجازة/],
    ["الحضور والانصراف", /تصحيح|بصمة/],
    ["مسيرات الرواتب", /تشغيل مسير/],
    ["إدارة النفقات", /مطالبة|مصروف/],
    ["التوظيف وتتبع المتقدمين", /وظيفة|مرشح/],
  ] as const;

  for (const [moduleName, action] of flows) {
    const moduleButton = page.getByRole("button", { name: new RegExp(moduleName) }).first();
    await moduleButton.scrollIntoViewIfNeeded();
    await moduleButton.click();
    await expect(page.getByText(action).first()).toBeVisible();
  }
});
