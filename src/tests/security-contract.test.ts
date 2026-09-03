import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("client-side security contracts", () => {
  it("does not expose registration on the login page", () => {
    const login = source("../components/auth/LoginPage.tsx");
    expect(login).not.toMatch(/signUp\s*\(/);
    expect(login).not.toMatch(/إنشاء حساب|حساب جديد/);
    expect(login).toContain('type={showPassword ? "text" : "password"}');
  });

  it("never embeds a Supabase service-role credential in public config", () => {
    const config = source("../integrations/supabase/public-config.ts");
    expect(config).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*=/);
    expect(config).not.toMatch(/service[_-]?role[_-]?key\s*[:=]/i);
  });

  it("does not contain GitHub personal access tokens in source", () => {
    const files = [
      source("../integrations/supabase/public-config.ts"),
      source("../components/auth/LoginPage.tsx"),
    ];
    expect(files.join("\n")).not.toMatch(/ghp_[A-Za-z0-9]{20,}/);
  });
});
