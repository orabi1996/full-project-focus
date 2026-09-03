import { expect, test } from "@playwright/test";

import { enterDemo, failOnPageErrors, openModule } from "./helpers";

test.beforeEach(async ({ page }) => {
  await enterDemo(page);
  await openModule(page, "المنشأة والهيكل التنظيمي", "organization");
});

test("يعرض كل أقسام وحدة المنشأة", async ({ page }) => {
  const assertNoErrors = failOnPageErrors(page);
  for (const tab of [
    "المخطط الهيكلي التفاعلي",
    "الأقسام والوحدات",
    "الشركات الفرعية",
    "مواقع العمل والسياج الجغرافي",
    "المناصب",
    "مراكز التكلفة",
  ]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("data-state", "active");
  }
  assertNoErrors();
});

test("يفتح محرر الوحدة التنظيمية ويحمي الاختيار الهرمي", async ({ page }) => {
  await page.getByRole("tab", { name: /الأقسام والوحدات/ }).click();
  await page.getByRole("button", { name: /إضافة قسم جديد/ }).click();
  await expect(page.getByRole("dialog")).toContainText("إضافة إدارة / قسم جديد");
  await expect(page.getByText("الوحدة الأعلى")).toBeVisible();
  await expect(page.getByText("المدير المسؤول", { exact: true })).toBeVisible();
});

test("يعرض تخطيط المناصب ومراكز التكلفة", async ({ page }) => {
  await page.getByRole("tab", { name: "المناصب" }).click();
  await expect(page.getByText(/المخطط/).first()).toBeVisible();
  await page.getByRole("tab", { name: "مراكز التكلفة" }).click();
  await expect(page.getByText(/الميزانية/).first()).toBeVisible();
});
