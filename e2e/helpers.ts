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
  onboarding: "/onboarding",
  movements: "/movements",
  learning: "/learning",
  talent: "/talent",
  engagement: "/engagement",
  "employee-relations": "/employee-relations",
  employee_relations: "/employee-relations",
  compensation: "/compensation",
  "country-packs": "/country-packs",
  country_packs: "/country-packs",
  "ai-copilot": "/ai-copilot",
  ai_copilot: "/ai-copilot",
};

export async function enterDemo(page: Page) {
  // UI smoke tests use deterministic read-only data, never the production backend.
  await page.route("https://*.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/rest/v1/rpc/get_employee_directory") {
      await route.fulfill({ json: { items: [], total_count: 0, page: 1, page_size: 25 } });
    } else if (path === "/rest/v1/rpc/get_employee_directory_kpis") {
      await route.fulfill({ json: { available: true, total_employees: 0 } });
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await page.goto("/login");
  const demoButton = page.getByRole("button", {
    name: /النسخة التجريبية|Demo Mode/i,
  });
  await expect(demoButton).toBeVisible();
  await demoButton.click();
  await expect(page).toHaveURL(/(\/|\/dashboard)$/);
  await expect(page.locator("main")).toBeVisible();
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
