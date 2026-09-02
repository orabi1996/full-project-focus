import { expect, type Page } from "@playwright/test";

export async function enterDemo(page: Page) {
  await page.goto("/login");
  const demoButton = page.getByRole("button", {
    name: /النسخة التجريبية|Demo Mode/i,
  });
  await expect(demoButton).toBeVisible();
  await demoButton.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("مرحباً بك مجدداً").first()).toBeVisible();
}

export async function openModule(page: Page, label: string, moduleId: string) {
  const moduleButton = page.getByRole("button", { name: new RegExp(label) }).first();
  const mobileMenuButton = page.getByTitle("فتح القائمة الرئيسية");
  if (await mobileMenuButton.isVisible()) await mobileMenuButton.click();
  await moduleButton.scrollIntoViewIfNeeded();
  await moduleButton.click();
  await expect(page).toHaveURL(new RegExp(`#${moduleId}$`));
  await expect(page.locator("main")).toBeVisible();
}

export function failOnPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return () => expect(errors, errors.join("\n")).toEqual([]);
}
