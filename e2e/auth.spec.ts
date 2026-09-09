import { expect, test } from "@playwright/test";

import { enterDemo, failOnPageErrors } from "./helpers";

test.describe("بوابة الدخول", () => {
  test("تعرض نموذج الدخول الآمن بدون إنشاء حساب", async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page);
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /مرحب.*بعودتك/ })).toBeVisible();
    await expect(page.getByLabel("البريد الإلكتروني الوظيفي")).toBeVisible();
    await expect(page.getByLabel(/^كلمة المرور\s*\*?$/)).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: "تسجيل الدخول" })).toBeVisible();
    await expect(page.getByText(/إنشاء حساب|حساب جديد/)).toHaveCount(0);
    assertNoErrors();
  });

  test("يمكن إظهار وإخفاء كلمة المرور", async ({ page }) => {
    await page.goto("/login");
    // Match the field label, excluding the show/hide button's accessible name.
    const password = page.getByLabel(/^كلمة المرور\s*\*?$/);
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "إظهار كلمة المرور" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "إخفاء كلمة المرور" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("يفتح الوضع التجريبي بدون بيانات اعتماد", async ({ page }) => {
    await enterDemo(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});
