import { expect, test } from "@playwright/test";

import { enterDemo, failOnPageErrors, openModule } from "./helpers";

async function selectTab(page: Parameters<typeof enterDemo>[0], name: string | RegExp) {
  const tab = page.getByRole("tab", { name });
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await expect(tab).toHaveAttribute("data-state", "active");
}

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
    await selectTab(page, tab);
  }
  assertNoErrors();
});

test("يفتح محرر الوحدة التنظيمية ويحمي الاختيار الهرمي", async ({ page }) => {
  await selectTab(page, /الأقسام والوحدات/);
  await page.getByRole("button", { name: /إضافة قسم جديد/ }).click();
  await expect(page.getByRole("dialog")).toContainText("إضافة إدارة / قسم جديد");
  await expect(page.getByText("الوحدة الأعلى")).toBeVisible();
  await expect(page.getByText("المدير المسؤول", { exact: true })).toBeVisible();
});

test("يعرض تخطيط المناصب ومراكز التكلفة", async ({ page }) => {
  await selectTab(page, "المناصب");
  await expect(page.getByText(/المخطط/).first()).toBeVisible();
  await selectTab(page, "مراكز التكلفة");
  await expect(page.getByText(/الميزانية/).first()).toBeVisible();
});
