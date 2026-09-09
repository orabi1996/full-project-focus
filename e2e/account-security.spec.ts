import { expect, test } from "@playwright/test";

import { enterDemo, failOnPageErrors } from "./helpers";

test("توضح شاشة الأمان حدود الخدمة دون جمع كلمات مرور أو عرض حماية وهمية", async ({ page }) => {
  const assertNoErrors = failOnPageErrors(page);
  await enterDemo(page);

  const accountMenu = page.locator("header button").filter({
    has: page.locator("img.rounded-full"),
  });
  await expect(accountMenu).toHaveCount(1);
  await accountMenu.click();
  await page.getByRole("menuitem", { name: "إعدادات الحساب والأمان وكلمة المرور" }).click();

  const dialog = page.getByRole("dialog", { name: "إعدادات الحساب والأمان الشخصي" });
  const security = dialog.getByRole("region", { name: "إدارة أمان الحساب", exact: true });
  await expect(security).toBeVisible();
  await expect(security).toContainText("أنت في النسخة التجريبية");
  await expect(security).toContainText("لم يتم التحقق من الحالة");
  await expect(security.locator("input, form, button, [role=switch]")).toHaveCount(0);
  await expect(security).not.toContainText("158.140.22.81");
  await expect(security).not.toContainText("نشط الآن");

  // Returning from another tab must not restore the old local MFA state/form.
  await dialog.getByRole("tab", { name: "الإشعارات", exact: true }).click();
  await dialog.getByRole("tab", { name: "الأمان", exact: true }).click();
  await expect(security).toContainText("لم يتم التحقق من الحالة");
  await expect(security.locator("input, form, button, [role=switch]")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  assertNoErrors();
});
