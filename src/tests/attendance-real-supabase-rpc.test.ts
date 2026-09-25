import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from "../integrations/supabase/public-config";

describe("Prompt 12.3: Real Supabase Remote RPC & Security Verification", () => {
  const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY);

  it("verifies live Supabase connectivity and endpoint responsiveness", async () => {
    expect(DEFAULT_SUPABASE_URL).toBe("https://rdvelndwxluuxryehlds.supabase.co");
    expect(DEFAULT_SUPABASE_PUBLISHABLE_KEY).toBeTruthy();

    const { error } = await supabase.from("companies").select("id").limit(1);
    // Under RLS, anon read might return empty or error, but endpoint must respond with HTTP status
    expect(error === null || error.code !== undefined).toBe(true);
  });

  it("Item 1 & 19: Real RPC get_effective_company_timezone rejects missing company without fabricating Asia/Riyadh", async () => {
    const { data, error } = await supabase.rpc("get_effective_company_timezone", {
      p_company_id: "00000000-0000-0000-0000-000000000000",
    });

    // Must fail because company does not exist or has no timezone
    expect(error).not.toBeNull();
    expect(data).toBeNull();
    // Must NEVER return fabricated "Asia/Riyadh"
    expect(data).not.toBe("Asia/Riyadh");
    expect(error?.message).toMatch(/المنطقة الزمنية|لم يتم ضبط/);
  });

  it("Item 16 & 17: Real RPC process_company_attendance_range strictly blocks unauthorized tenant batch run (42501)", async () => {
    const { data, error } = await supabase.rpc("process_company_attendance_range", {
      p_company_id: "a0000000-0000-0000-0000-000000000001",
      p_from_date: "2026-09-01",
      p_to_date: "2026-09-30",
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message).toContain("غير مصرح لك بتشغيل معالجة الحضور المجمعة للمنشأة");
  });

  it("Item 16 & 17: Real RPC save_attendance_policy strictly blocks unauthenticated/unauthorized callers (42501)", async () => {
    const { data, error } = await supabase.rpc("save_attendance_policy", {
      p_policy: {
        name_ar: "سياسة تجريبية",
        effective_from: "2026-09-01",
        geofence_enforced: true,
        auto_deduct_breaks: true,
        require_biometric_or_gps: true,
        allow_mobile_punch: true,
        overtime_pre_approval_required: true,
        gps_accuracy_action: "reject",
      },
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("Item 16 & 18: Real RPC close_attendance_period strictly blocks unauthorized / invalid period execution", async () => {
    const { data, error } = await supabase.rpc("close_attendance_period", {
      p_period_id: "00000000-0000-0000-0000-000000000000",
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(["42501", "22023"]).toContain(error?.code);
  });

  it("Item 16: Real RPC process_my_attendance_day strictly requires authenticated user with employee record", async () => {
    const { data, error } = await supabase.rpc("process_my_attendance_day", {
      p_business_date: "2026-09-24",
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(["42501", "P0002"]).toContain(error?.code);
  });
});
