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

test("يفتح كل وحدات النظام من القائمة بدون أخطاء JavaScript", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "يغطيه اختبار الموبايل المختصر");
  const assertNoErrors = failOnPageErrors(page);
  await enterDemo(page);

  for (const [id, label] of modules) {
    await openModule(page, label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), id);
  }
  assertNoErrors();
});

test("تعمل القائمة على شاشة الجوال", async ({ page }) => {
  test.skip(!test.info().project.name.includes("mobile"), "خاص بمشروع الموبايل");
  const assertNoErrors = failOnPageErrors(page);
  await enterDemo(page);
  await expect(page.getByTitle("فتح القائمة الرئيسية")).toBeVisible();
  await openModule(page, "دليل وملفات الموظفين", "employees");
  assertNoErrors();
});
