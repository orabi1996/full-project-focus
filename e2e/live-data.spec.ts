import { expect, test } from "@playwright/test";

test("فشل تحميل الحساب الحقيقي يظهر خطأ ويمكن إعادة المحاولة دون بيانات تجريبية", async ({
  page,
}) => {
  let failData = true;
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "audit@example.invalid",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-09-10T00:00:00Z",
  };
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated", aud: "authenticated" })}.test-signature`;

  // All authentication and data responses in this test are synthetic.
  await page.route("**/auth/v1/**", async (route) => {
    await route.fulfill({
      json: {
        access_token: accessToken,
        refresh_token: "test-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      },
    });
  });
  await page.route("**/rest/v1/**", async (route) => {
    if (route.request().url().includes("/user_roles")) {
      await route.fulfill({ json: [{ role: "hr_manager" }] });
    } else {
      await route.fulfill({
        status: failData ? 503 : 200,
        json: failData ? { message: "synthetic unavailable" } : [],
      });
    }
  });
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني الوظيفي").fill(user.email);
  await page.getByLabel(/^كلمة المرور\s*\*?$/).fill("synthetic-password");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("تعذر تحميل بيانات المؤسسة");
  await expect(page.locator("main")).not.toContainText("مرحباً بك مجدداً");
  failData = false;
  await page.getByRole("button", { name: "إعادة المحاولة", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("مرحباً بك مجدداً").first()).toBeVisible();
});

test("بوابة البصمة ترفض المدخلات غير الصالحة قبل الوصول للقاعدة", async ({ request }) => {
  const response = await request.post("/api/public/biometric/punch", {
    data: {
      device_id: "test-device",
      token: "synthetic-token",
      employee_no: "E-1",
      punch_type: "in",
      punch_time: "not-a-date",
    },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid punch payload" });
});
