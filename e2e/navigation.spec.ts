import { expect, test } from "@playwright/test";

import { enterDemo, failOnPageErrors, openModule } from "./helpers";

const modules = [
  ["organization", "المنشأة والهيكل التنظيمي"],
  ["employees", "دليل وملفات الموظفين"],
  ["rbac", "الصلاحيات والأمان"],
  ["workflow", "الطلبات والاعتمادات"],
  ["leaves", "الإجازات والعطلات"],
  ["attendance", "الحضور والانصراف"],
  ["shifts", "الدوامات والجدولة"],
  ["payroll", "مسيرات الرواتب"],
  ["loans", "السلف والمخالصات"],
  ["expenses", "إدارة النفقات"],
  ["ats", "التوظيف وتتبع المتقدمين"],
  ["performance", "إدارة الأداء 360°"],
  ["workforce", "تخطيط القوى العاملة"],
  ["assets", "العهد والوثائق"],
  ["reports", "التقارير والإحصائيات"],
  ["integrations", "التكاملات والقيود"],
  ["audit", "سجل التدقيق والعمليات"],
  ["ess", "الخدمة الذاتية (الموظف)"],
] as const;

test("يفتح كل وحدات النظام من القائمة بدون أخطاء JavaScript عبر المسارات النظيفة", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "يغطيه اختبار الموبايل المختصر");
  const assertNoErrors = failOnPageErrors(page);
  await enterDemo(page);

  for (const [id, label] of modules) {
    await openModule(page, label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), id);
  }
  assertNoErrors();
});

test("تعمل القائمة على شاشة الجوال وتتنقل عبر المسارات النظيفة", async ({ page }) => {
  test.skip(!test.info().project.name.includes("mobile"), "خاص بمشروع الموبايل");
  const assertNoErrors = failOnPageErrors(page);
  await enterDemo(page);
  await expect(page.getByTitle("فتح القائمة الرئيسية")).toBeVisible();
  await openModule(page, "دليل وملفات الموظفين", "employees");
  await expect(page).toHaveURL(/\/employees$/);
  assertNoErrors();
});

test("يدعم التنقل المباشر وتحديث الصفحة وأزرار الرجوع والتقدم بالمتصفح", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "يغطيه اختبار سطح المكتب");
  const assertNoErrors = failOnPageErrors(page);
  await enterDemo(page);

  // Direct URL navigation to /employees
  await page.goto("/employees");
  await expect(page).toHaveURL(/\/employees$/);
  await expect(page.locator("main")).toBeVisible();

  // Browser refresh preserves route
  await page.reload();
  await expect(page).toHaveURL(/\/employees$/);
  await expect(page.locator("main")).toBeVisible();

  // Navigate to attendance
  await page.goto("/attendance");
  await expect(page).toHaveURL(/\/attendance$/);

  // Browser Back
  await page.goBack();
  await expect(page).toHaveURL(/\/employees$/);

  // Browser Forward
  await page.goForward();
  await expect(page).toHaveURL(/\/attendance$/);

  assertNoErrors();
});

test("يرحل الهاش القديم #employees تلقائياً إلى المسار النظيف /employees", async ({ page }) => {
  const assertNoErrors = failOnPageErrors(page);
  await enterDemo(page);

  // Navigate with legacy hash
  await page.goto("/#employees");
  await expect(page).toHaveURL(/\/employees$/);
  await expect(page.locator("main")).toBeVisible();

  assertNoErrors();
});
