import { describe, expect, it } from "vitest";

import { assertValidSupabasePublicConfig, isDemoModeEnabled } from "./runtime-config";

describe("runtime production guards", () => {
  it("enables demo only when explicitly requested outside production", () => {
    expect(isDemoModeEnabled("true", false)).toBe(true);
    expect(isDemoModeEnabled(" TRUE ", false)).toBe(true);
    expect(isDemoModeEnabled("false", false)).toBe(false);
    expect(isDemoModeEnabled(undefined, false)).toBe(false);
  });

  it("always disables demo in production", () => {
    expect(isDemoModeEnabled("true", true)).toBe(false);
    expect(isDemoModeEnabled("false", true)).toBe(false);
    expect(isDemoModeEnabled(undefined, true)).toBe(false);
  });

  it("accepts a valid hosted Supabase public configuration", () => {
    expect(() =>
      assertValidSupabasePublicConfig({
        url: "https://project-ref.supabase.co",
        publishableKey: "sb_publishable_public-browser-key",
      }),
    ).not.toThrow();
  });

  it("accepts an HTTP localhost URL for isolated development", () => {
    expect(() =>
      assertValidSupabasePublicConfig({
        url: "http://127.0.0.1:54321",
        publishableKey: "local-anon-key",
      }),
    ).not.toThrow();
  });

  it("rejects placeholders and malformed URLs", () => {
    expect(() =>
      assertValidSupabasePublicConfig({
        url: "https://your-project-id.supabase.co",
        publishableKey: "your-supabase-anon-or-publishable-key",
      }),
    ).toThrow(/Invalid public Supabase configuration/);

    expect(() =>
      assertValidSupabasePublicConfig({
        url: "not-a-url",
        publishableKey: "sb_publishable_public-browser-key",
      }),
    ).toThrow(/VITE_SUPABASE_URL/);

    expect(() =>
      assertValidSupabasePublicConfig({
        url: "http://project-ref.supabase.co",
        publishableKey: "sb_publishable_public-browser-key",
      }),
    ).toThrow(/HTTPS required/);
  });

  it("rejects private Supabase keys in browser configuration", () => {
    expect(() =>
      assertValidSupabasePublicConfig({
        url: "https://project-ref.supabase.co",
        publishableKey: "sb_secret_private-server-key",
      }),
    ).toThrow(/public key required/);

    expect(() =>
      assertValidSupabasePublicConfig({
        url: "https://project-ref.supabase.co",
        publishableKey: "service_role_private-server-key",
      }),
    ).toThrow(/public key required/);
  });
});
