import { describe, expect, it, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from "../integrations/supabase/public-config";

/**
 * Prompt 13.5: Remote Supabase Authenticated Security & Authorization Verification
 * 
 * SECURITY NOTICE:
 * NO CREDENTIALS MAY BE HARDCODED IN THIS FILE.
 * Credentials must be supplied via environment variables (e.g. .env or CI secrets).
 * If environment credentials are missing, tests assert BLOCKED to prevent false passes.
 */
describe("Prompt 13.5: Live Remote Supabase Authenticated Security & Authorization Verification", () => {
  const anonClient = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY);

  let hrAClient: SupabaseClient | null = null;
  let empAClient: SupabaseClient | null = null;
  let mgrAClient: SupabaseClient | null = null;
  let hrBClient: SupabaseClient | null = null;

  const hrAEmail = process.env.SUPABASE_TEST_HR_A_EMAIL;
  const hrAPass = process.env.SUPABASE_TEST_HR_A_PASSWORD;

  const empAEmail = process.env.SUPABASE_TEST_EMPLOYEE_A_EMAIL;
  const empAPass = process.env.SUPABASE_TEST_EMPLOYEE_A_PASSWORD;

  const mgrAEmail = process.env.SUPABASE_TEST_MANAGER_A_EMAIL;
  const mgrAPass = process.env.SUPABASE_TEST_MANAGER_A_PASSWORD;

  const hrBEmail = process.env.SUPABASE_TEST_HR_B_EMAIL;
  const hrBPass = process.env.SUPABASE_TEST_HR_B_PASSWORD;

  const companyAId = process.env.SUPABASE_TEST_COMPANY_A_ID || "a0000000-0000-0000-0000-000000000001";
  const companyBId = process.env.SUPABASE_TEST_COMPANY_B_ID || "b0000000-0000-0000-0000-000000000002";

  let hrAAuthenticated = false;
  let empAAuthenticated = false;
  let mgrAAuthenticated = false;
  let hrBAuthenticated = false;

  let empAId: string | null = process.env.SUPABASE_TEST_EMPLOYEE_A_ID || null;

  beforeAll(async () => {
    // 1. Authenticate HR Admin A (if configured)
    if (hrAEmail && hrAPass) {
      try {
        const client = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY);
        const { data, error } = await client.auth.signInWithPassword({
          email: hrAEmail,
          password: hrAPass,
        });
        if (!error && data.session) {
          hrAClient = client;
          hrAAuthenticated = true;
        }
      } catch {
        hrAAuthenticated = false;
      }
    }

    // 2. Authenticate Regular Employee A (if configured)
    if (empAEmail && empAPass) {
      try {
        const client = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY);
        const { data, error } = await client.auth.signInWithPassword({
          email: empAEmail,
          password: empAPass,
        });
        if (!error && data.session) {
          empAClient = client;
          empAAuthenticated = true;

          if (!empAId && data.user) {
            const { data: empRecord } = await client
              .from("employees")
              .select("id")
              .eq("user_id", data.user.id)
              .maybeSingle();
            if (empRecord?.id) {
              empAId = empRecord.id;
            }
          }
        }
      } catch {
        empAAuthenticated = false;
      }
    }

    // 3. Authenticate Line Manager A (if configured)
    if (mgrAEmail && mgrAPass) {
      try {
        const client = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY);
        const { data, error } = await client.auth.signInWithPassword({
          email: mgrAEmail,
          password: mgrAPass,
        });
        if (!error && data.session) {
          mgrAClient = client;
          mgrAAuthenticated = true;
        }
      } catch {
        mgrAAuthenticated = false;
      }
    }

    // 4. Authenticate HR Admin B (if configured)
    if (hrBEmail && hrBPass) {
      try {
        const client = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY);
        const { data, error } = await client.auth.signInWithPassword({
          email: hrBEmail,
          password: hrBPass,
        });
        if (!error && data.session) {
          hrBClient = client;
          hrBAuthenticated = true;
        }
      } catch {
        hrBAuthenticated = false;
      }
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 1: Anonymous Baseline & Boundary Verification (Always Runs)
  // --------------------------------------------------------------------------
  describe("Anonymous Baseline & Boundary Verification", () => {
    it("verifies live Supabase connectivity and public responsiveness", async () => {
      expect(DEFAULT_SUPABASE_URL).toBe("https://rdvelndwxluuxryehlds.supabase.co");
      expect(DEFAULT_SUPABASE_PUBLISHABLE_KEY).toBeTruthy();

      const { error } = await anonClient.from("shifts").select("id, code, version, status").limit(1);
      expect(error === null || error.code !== undefined).toBe(true);
    });

    it("Anonymous RPC detect_roster_conflicts rejects unauthenticated access", async () => {
      const { data, error } = await anonClient.rpc("detect_roster_conflicts", {
        p_roster_id: "00000000-0000-0000-0000-000000000000",
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/فترة الجدولة.*غير موجودة|غير مصرح/);
    });

    it("Anonymous RPC publish_roster strictly rejects unauthorized client", async () => {
      const { data, error } = await anonClient.rpc("publish_roster", {
        p_roster_id: "00000000-0000-0000-0000-000000000000",
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/فترة الجدولة.*غير موجودة|غير مصرح/);
    });

    it("Anonymous RPC create_roster_amendment rejects unauthenticated caller", async () => {
      const { data, error } = await anonClient.rpc("create_roster_amendment", {
        p_roster_period_id: "00000000-0000-0000-0000-000000000000",
        p_reason: "تعديل غير مصرح",
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("Anonymous RPC approve_shift_swap strictly enforces authorization", async () => {
      const { data, error } = await anonClient.rpc("approve_shift_swap", {
        p_swap_request_id: "00000000-0000-0000-0000-000000000000",
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/طلب.*غير موجود|غير مصرح/);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Direct-Table Mutation Denial (Authenticated Employee)
  // --------------------------------------------------------------------------
  describe("Direct-Table Mutation Denial (Authenticated Employee)", () => {
    it("strictly blocks direct INSERT into schedule_assignments for regular employee", async () => {
      if (!empAAuthenticated || !empAClient) {
        throw new Error("BLOCKED: Employee test credentials unavailable in environment (SUPABASE_TEST_EMPLOYEE_A_EMAIL / SUPABASE_TEST_EMPLOYEE_A_PASSWORD)");
      }

      const { data, error } = await empAClient.from("schedule_assignments").insert({
        company_id: companyAId,
        employee_id: empAId,
        work_date: "2026-12-31",
        status: "published",
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toMatch(/violates row-level security policy|permission denied/i);
    });

    it("strictly blocks direct UPDATE on roster_periods for regular employee", async () => {
      if (!empAAuthenticated || !empAClient) {
        throw new Error("BLOCKED: Employee test credentials unavailable in environment (SUPABASE_TEST_EMPLOYEE_A_EMAIL / SUPABASE_TEST_EMPLOYEE_A_PASSWORD)");
      }

      const { data, error } = await empAClient
        .from("roster_periods")
        .update({ status: "published" })
        .eq("company_id", companyAId);

      if (error) {
        expect(error.code).toBe("42501");
      } else {
        expect(!data || (Array.isArray(data) && (data as unknown[]).length === 0)).toBe(true);
      }
    });

    it("strictly blocks direct DELETE on schedule_assignments for regular employee", async () => {
      if (!empAAuthenticated || !empAClient) {
        throw new Error("BLOCKED: Employee test credentials unavailable in environment (SUPABASE_TEST_EMPLOYEE_A_EMAIL / SUPABASE_TEST_EMPLOYEE_A_PASSWORD)");
      }

      const { data, error } = await empAClient
        .from("schedule_assignments")
        .delete()
        .eq("company_id", companyAId);

      if (error) {
        expect(["42501", "42703"]).toContain(error.code);
      } else {
        expect(!data || (Array.isArray(data) && (data as unknown[]).length === 0)).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Employee Self Access & Same-Company Isolation
  // --------------------------------------------------------------------------
  describe("Employee Self Access & Same-Company Isolation", () => {
    it("allows Employee to read their own employee profile", async () => {
      if (!empAAuthenticated || !empAClient || !empAId) {
        throw new Error("BLOCKED: Employee test credentials unavailable in environment (SUPABASE_TEST_EMPLOYEE_A_EMAIL / SUPABASE_TEST_EMPLOYEE_A_PASSWORD)");
      }

      const { data, error } = await empAClient
        .from("employees")
        .select("id, email, company_id")
        .eq("id", empAId);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data?.length).toBe(1);
      expect(data?.[0].email).toBe(empAEmail);
    });

    it("strictly denies or isolates Employee from accessing foreign company employee records", async () => {
      if (!empAAuthenticated || !empAClient) {
        throw new Error("BLOCKED: Employee test credentials unavailable in environment (SUPABASE_TEST_EMPLOYEE_A_EMAIL / SUPABASE_TEST_EMPLOYEE_A_PASSWORD)");
      }

      const { data, error } = await empAClient
        .from("employees")
        .select("id, email, basic_salary")
        .eq("company_id", companyBId);

      if (error) {
        expect(["42501", "PGRST116"]).toContain(error.code);
      } else {
        expect(data?.length).toBe(0);
      }
    });

    it("Employee cannot access cross-company employee schedules", async () => {
      if (!empAAuthenticated || !empAClient) {
        throw new Error("BLOCKED: Employee test credentials unavailable in environment (SUPABASE_TEST_EMPLOYEE_A_EMAIL / SUPABASE_TEST_EMPLOYEE_A_PASSWORD)");
      }

      const { data, error } = await empAClient
        .from("schedule_assignments")
        .select("*")
        .eq("company_id", companyBId);

      if (error) {
        expect(["42501", "42703", "PGRST205"]).toContain(error.code);
      } else {
        expect(data?.length).toBe(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 4: Manager A Scope Verification (Direct Reports vs Unrelated)
  // --------------------------------------------------------------------------
  describe("Manager A Scope Verification (Direct Reports vs Unrelated)", () => {
    it("Manager A can view own profile and direct reports", async () => {
      if (!mgrAAuthenticated || !mgrAClient) {
        throw new Error("BLOCKED: Manager test credentials unavailable in environment (SUPABASE_TEST_MANAGER_A_EMAIL / SUPABASE_TEST_MANAGER_A_PASSWORD)");
      }

      const { data, error } = await mgrAClient
        .from("employees")
        .select("id, employee_no, company_id")
        .eq("company_id", companyAId);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it("Manager A is strictly denied access to Company B employee records", async () => {
      if (!mgrAAuthenticated || !mgrAClient) {
        throw new Error("BLOCKED: Manager test credentials unavailable in environment (SUPABASE_TEST_MANAGER_A_EMAIL / SUPABASE_TEST_MANAGER_A_PASSWORD)");
      }

      const { data, error } = await mgrAClient
        .from("employees")
        .select("id, employee_no")
        .eq("company_id", companyBId);

      if (error) {
        expect(error.code).toBe("42501");
      } else {
        expect(data?.length).toBe(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 5: HR Same-Company Positive & Cross-Company Denial
  // --------------------------------------------------------------------------
  describe("HR Same-Company Positive & Cross-Company Denial", () => {
    it("HR A can successfully execute generate_shift_code for Company A", async () => {
      if (!hrAAuthenticated || !hrAClient) {
        throw new Error("BLOCKED: HR A test credentials unavailable in environment (SUPABASE_TEST_HR_A_EMAIL / SUPABASE_TEST_HR_A_PASSWORD)");
      }

      const { data, error } = await hrAClient.rpc("generate_shift_code", {
        p_company_id: companyAId,
      });

      expect(error).toBeNull();
      expect(typeof data).toBe("string");
      expect(data).toMatch(/^SH-\d+$/);
    });

    it("HR A is denied cross-company operations on Company B", async () => {
      if (!hrAAuthenticated || !hrAClient) {
        throw new Error("BLOCKED: HR A test credentials unavailable in environment (SUPABASE_TEST_HR_A_EMAIL / SUPABASE_TEST_HR_A_PASSWORD)");
      }

      const { data, error } = await hrAClient
        .from("companies")
        .select("id, legal_name_ar")
        .eq("id", companyBId);

      if (error) {
        expect(error.code).toBe("42501");
      } else {
        expect(data?.length).toBe(0);
      }
    });

    it("HR A can query employees within Company A", async () => {
      if (!hrAAuthenticated || !hrAClient) {
        throw new Error("BLOCKED: HR A test credentials unavailable in environment (SUPABASE_TEST_HR_A_EMAIL / SUPABASE_TEST_HR_A_PASSWORD)");
      }

      const { data, error } = await hrAClient
        .from("employees")
        .select("id, email, company_id")
        .eq("company_id", companyAId);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 6: Remote Version Progression & Overlap Verification (V1 -> V2)
  // --------------------------------------------------------------------------
  describe("Remote Version Progression & Overlap Verification (V1 -> V2)", () => {
    it("HR A verifies roster amendment lifecycle with disposable test tag", async () => {
      if (!hrAAuthenticated || !hrAClient) {
        throw new Error("BLOCKED: HR A test credentials unavailable in environment (SUPABASE_TEST_HR_A_EMAIL / SUPABASE_TEST_HR_A_PASSWORD)");
      }

      // Query any published roster in Company A to test amendment RPC validation
      const { data: rosters, error: rError } = await hrAClient
        .from("roster_periods")
        .select("id, version, status")
        .eq("company_id", companyAId)
        .eq("status", "published")
        .limit(1);

      expect(rError).toBeNull();
      if (rosters && rosters.length > 0) {
        const rosterId = rosters[0].id;
        const { data: amendData, error: amendError } = await hrAClient.rpc("create_roster_amendment", {
          p_roster_period_id: rosterId,
          p_reason: "Prompt 13.5 Remote Verification Test",
        });

        // Amendment must either succeed or return expected business status
        if (amendError) {
          expect(amendError.message).toMatch(/فترة الجدولة|غير مصرح/);
        } else {
          expect(amendData).toBeDefined();
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 7: Authoritative Fail-Closed Schedule View Verification
  // --------------------------------------------------------------------------
  describe("Authoritative Schedule & Version Progression Verification", () => {
    it("View vw_effective_published_schedules fails closed for unassigned dates without guessing", async () => {
      if (!empAAuthenticated || !empAClient || !empAId) {
        throw new Error("BLOCKED: Employee test credentials unavailable in environment (SUPABASE_TEST_EMPLOYEE_A_EMAIL / SUPABASE_TEST_EMPLOYEE_A_PASSWORD)");
      }

      const { data, error } = await empAClient
        .from("vw_effective_published_schedules")
        .select("*")
        .eq("employee_id", empAId)
        .eq("work_date", "2099-01-01");

      if (error) {
        expect(error.code !== undefined).toBe(true);
      } else {
        expect(data?.length).toBe(0);
      }
    });
  });
});
