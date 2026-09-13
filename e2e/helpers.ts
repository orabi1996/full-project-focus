import { expect, type Page } from "@playwright/test";

const ROUTE_PATH_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  organization: "/organization",
  employees: "/employees",
  documents: "/documents",
  rbac: "/rbac",
  workflow: "/workflows",
  leaves: "/leaves",
  attendance: "/attendance",
  shifts: "/shifts",
  payroll: "/payroll",
  loans: "/loans",
  expenses: "/expenses",
  ats: "/recruitment",
  performance: "/performance",
  workforce: "/workforce",
  assets: "/assets",
  reports: "/reports",
  integrations: "/integrations",
  audit: "/audit",
  ess: "/ess",
};

export async function enterDemo(page: Page) {
  await page.goto("/login");
  const demoButton = page.getByRole("button", {
    name: /النسخة التجريبية|Demo Mode/i,
  });
  await expect(demoButton).toBeVisible();
  await demoButton.click();
  await expect(page).toHaveURL(/(\/|\/dashboard)$/);
  await expect(page.getByText("مرحباً بك مجدداً").first()).toBeVisible();
}

export async function openModule(page: Page, label: string, moduleId: string) {
  const moduleButton = page.getByRole("button", { name: new RegExp(label) }).first();
  const mobileMenuButton = page.getByTitle("فتح القائمة الرئيسية");
  if (await mobileMenuButton.isVisible()) await mobileMenuButton.click();
  await moduleButton.scrollIntoViewIfNeeded();
  await moduleButton.click();
  const targetPath = ROUTE_PATH_MAP[moduleId] || `/${moduleId}`;
  await expect(page).toHaveURL(new RegExp(`${targetPath}$`));
  await expect(page.locator("main")).toBeVisible();
}

export function failOnPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return () => expect(errors, errors.join("\n")).toEqual([]);
}
