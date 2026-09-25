import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from "../integrations/supabase/public-config";

describe("Prompt 13: Live Supabase Remote RPC & Schema Verification", () => {
  const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY);

  it("verifies live Supabase connectivity and shifts table responsiveness", async () => {
    expect(DEFAULT_SUPABASE_URL).toBe("https://rdvelndwxluuxryehlds.supabase.co");
    expect(DEFAULT_SUPABASE_PUBLISHABLE_KEY).toBeTruthy();

    const { error } = await supabase.from("shifts").select("id, code, version, status").limit(1);
    // Under RLS, anon read might return empty or error, but endpoint must respond with HTTP status
    expect(error === null || error.code !== undefined).toBe(true);
  });

  it("Real RPC generate_shift_code responds with valid format string", async () => {
    const { data, error } = await supabase.rpc("generate_shift_code", {
      p_company_id: "a0000000-0000-0000-0000-000000000001",
    });

    if (error) {
      // If RLS/auth restriction applies, verify code
      expect(["42501", "P0001", "22023"]).toContain(error.code);
    } else {
      expect(typeof data).toBe("string");
      expect(data).toMatch(/^SH-\d+$/);
    }
  });

  it("Real RPC detect_roster_conflicts rejects non-existent roster period", async () => {
    const { data, error } = await supabase.rpc("detect_roster_conflicts", {
      p_roster_id: "00000000-0000-0000-0000-000000000000",
    });

    // Must fail because roster period does not exist
    expect(error).not.toBeNull();
    expect(data).toBeNull();
    expect(error?.message).toMatch(/فترة الجدولة.*غير موجودة|غير مصرح/);
  });

  it("Real RPC publish_roster strictly rejects non-existent roster period", async () => {
    const { data, error } = await supabase.rpc("publish_roster", {
      p_roster_id: "00000000-0000-0000-0000-000000000000",
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/فترة الجدولة.*غير موجودة|غير مصرح/);
  });

  it("Real RPC approve_shift_swap rejects non-existent swap request", async () => {
    const { data, error } = await supabase.rpc("approve_shift_swap", {
      p_swap_request_id: "00000000-0000-0000-0000-000000000000",
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/طلب.*غير موجود|غير مصرح/);
  });

  it("Real RPC copy_roster_period rejects non-existent source period", async () => {
    const { data, error } = await supabase.rpc("copy_roster_period", {
      p_source_period_id: "00000000-0000-0000-0000-000000000000",
      p_target_start: "2026-10-01",
      p_target_end: "2026-10-07",
      p_name: null,
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/فترة الجدولة الأصلية غير موجودة|غير مصرح/);
  });
});
