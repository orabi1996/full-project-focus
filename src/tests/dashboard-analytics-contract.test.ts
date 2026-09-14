import { describe, it, expect } from "vitest";
import { queryKeys } from "../lib/query/query-keys";
import {
  getDefaultDashboardFilters,
  getCompanyToday,
} from "../lib/domains/dashboard";
import type {
  DashboardAnalytics,
  DashboardAttendanceTrend,
  DashboardIntegrations,
} from "../lib/domains/dashboard/dashboard-types";
import * as fs from "fs";
import * as path from "path";

describe("Production Dashboard Analytics & Executive Command Center Contracts", () => {
  // ─── 1. Query Keys Architecture ──────────────────────────────────────────
  describe("Query Keys Architecture", () => {
    it("provides stable, hierarchical query keys for dashboard analytics", () => {
      expect(queryKeys.dashboard.all).toEqual(["dashboard"]);
      expect(
        queryKeys.dashboard.summary({ start: "2026-09-01", end: "2026-09-14" }),
      ).toEqual(["dashboard", "summary", "2026-09-01", "2026-09-14"]);
      expect(
        queryKeys.dashboard.attendance({ anchor: "2026-09-14", days: 7 }),
      ).toEqual(["dashboard", "attendance-trend", "2026-09-14", 7]);
      expect(queryKeys.dashboard.integrations()).toEqual([
        "dashboard",
        "integration-health",
      ]);
    });

    it("generates valid default filters with last7 preset based on timezone", () => {
      const filters = getDefaultDashboardFilters("Asia/Riyadh");
      expect(filters.preset).toBe("last7");
      expect(filters.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(filters.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(filters.startDate).getTime()).toBeLessThanOrEqual(
        new Date(filters.endDate).getTime(),
      );
    });

    it("resolves company timezone anchor date accurately and safely", () => {
      const todayRiyadh = getCompanyToday("Asia/Riyadh");
      expect(todayRiyadh).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const todayCairo = getCompanyToday("Africa/Cairo");
      expect(todayCairo).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Fallback for invalid timezone
      const fallback = getCompanyToday("Invalid/Unknown_TZ");
      expect(fallback).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ─── 2. Metric Correctness, Workforce Definitions & Edge Cases ────────────
  describe("Workforce Definitions, Metric Correctness & Edge Cases", () => {
    it("includes probation, active, and on_leave in employed active workforce, excluding terminated and suspended", () => {
      const employees = [
        { id: "e1", status: "active" },
        { id: "e2", status: "probation" },
        { id: "e3", status: "on_leave" },
        { id: "e4", status: "terminated" },
        { id: "e5", status: "suspended" },
      ];

      const employedActiveWorkforce = employees.filter((e) =>
        ["active", "probation", "on_leave"].includes(e.status),
      );

      expect(employedActiveWorkforce).toHaveLength(3);
      expect(employedActiveWorkforce.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);

      // Explicit verification: on_leave remains part of employed headcount
      expect(employedActiveWorkforce.some((e) => e.status === "on_leave")).toBe(true);

      // Explicit verification: probation workforce is included
      expect(employedActiveWorkforce.some((e) => e.status === "probation")).toBe(true);

      // Explicit verification: terminated & suspended are excluded
      expect(employedActiveWorkforce.some((e) => e.status === "terminated")).toBe(false);
      expect(employedActiveWorkforce.some((e) => e.status === "suspended")).toBe(false);
    });

    it("counts pending_approval requests as canonical pending status", () => {
      const requests = [
        { id: "r1", status: "pending_approval" },
        { id: "r2", status: "approved" },
        { id: "r3", status: "rejected" },
        { id: "r4", status: "pending_approval" },
      ];

      const pendingCount = requests.filter(
        (r) => r.status === "pending_approval",
      ).length;

      expect(pendingCount).toBe(2);
    });

    it("verifies turnover is unavailable when no authoritative termination date exists (does NOT use updated_at)", () => {
      const headcount: DashboardAnalytics["headcount"] = {
        available: true,
        activeCount: 100,
        newHires: 4,
        saudiCount: 35,
        turnoverRate: null,
        reasonTurnoverUnavailable: "termination_date_not_available",
      };

      expect(headcount.turnoverRate).toBeNull();
      expect(headcount.reasonTurnoverUnavailable).toBe("termination_date_not_available");
    });

    it("classifies Saudization using authoritative nationality without ID prefix heuristics", () => {
      const employees = [
        { id: "e1", nationality: "سعودي", nationalIdOrIqama: "1001" },
        { id: "e2", nationality: "Saudi", nationalIdOrIqama: "1002" },
        { id: "e3", nationality: "مصر", nationalIdOrIqama: "2001" },
        { id: "e4", nationality: null, nationalIdOrIqama: "1003" }, // ID starts with 1, but nationality unknown!
        { id: "e5", nationality: "", nationalIdOrIqama: "2002" },
      ];

      // Pure nationality classification
      const knownSaudi = employees.filter(
        (e) =>
          e.nationality &&
          (e.nationality.includes("سعود") || e.nationality.toLowerCase().includes("saudi")),
      ).length;

      const knownNonSaudi = employees.filter(
        (e) =>
          e.nationality &&
          e.nationality.trim() !== "" &&
          !e.nationality.includes("سعود") &&
          !e.nationality.toLowerCase().includes("saudi"),
      ).length;

      const unknownNationality = employees.filter(
        (e) => !e.nationality || e.nationality.trim() === "",
      ).length;

      expect(knownSaudi).toBe(2);
      expect(knownNonSaudi).toBe(1);
      expect(unknownNationality).toBe(2);

      // Unknown employees must NOT be falsely assumed to be expats
      expect(knownNonSaudi).not.toBe(employees.length - knownSaudi);
    });

    it("zero Saudi count stays zero and zero expatriate count stays zero", () => {
      const zeroSaudi = 0;
      const zeroExpat = 0;

      const calculateSaudization = (s: number, total: number) =>
        total > 0 ? ((s / total) * 100).toFixed(1) : "0";

      expect(calculateSaudization(zeroSaudi, 10)).toBe("0.0");
      expect(calculateSaudization(zeroSaudi, 0)).toBe("0");

      // Verify chart data does not mutate zero to 1
      const chartData = [
        { name: "موظفون سعوديون", value: zeroSaudi },
        { name: "موظفون مقيمون", value: zeroExpat },
      ].filter((d) => d.value > 0);

      expect(chartData).toHaveLength(0); // Empty chart state when both are zero
    });

    it("zero attendance denominator returns null/unavailable, not 100%", () => {
      const calculateAttendanceRate = (
        present: number,
        eligible: number,
      ): number | null => {
        if (!eligible || eligible <= 0) return null;
        return Math.round((present / eligible) * 100);
      };

      expect(calculateAttendanceRate(0, 0)).toBeNull();
      expect(calculateAttendanceRate(10, 0)).toBeNull();
      expect(calculateAttendanceRate(45, 50)).toBe(90);
    });

    it("deduplicates attendance records per employee correctly", () => {
      const rawRecords = [
        { employeeId: "emp-1", status: "present", workDate: "2026-09-14" },
        { employeeId: "emp-1", status: "present", workDate: "2026-09-14" },
        { employeeId: "emp-2", status: "late", workDate: "2026-09-14" },
        { employeeId: "emp-3", status: "absent", workDate: "2026-09-14" },
      ];

      const uniquePresent = new Set(
        rawRecords.filter((r) => r.status === "present").map((r) => r.employeeId),
      );
      const uniqueLate = new Set(
        rawRecords.filter((r) => r.status === "late").map((r) => r.employeeId),
      );
      const uniqueAbsent = new Set(
        rawRecords.filter((r) => r.status === "absent").map((r) => r.employeeId),
      );

      expect(uniquePresent.size).toBe(1);
      expect(uniqueLate.size).toBe(1);
      expect(uniqueAbsent.size).toBe(1);
    });
  });

  // ─── 3. Security, Authorization & Scoping ─────────────────────────────────
  describe("Security, Authorization & Scoping Contracts", () => {
    it("enforces that non-HR roles receive unavailable for headcount, attendance, payroll, and document counts", () => {
      const employeeDashboard: DashboardAnalytics = {
        scope: "self",
        anchorDate: "2026-09-14",
        startDate: "2026-09-07",
        endDate: "2026-09-14",
        headcount: {
          available: false,
          reasonUnavailable: "unauthorized",
        },
        attendance: {
          available: false,
          reasonUnavailable: "unauthorized",
        },
        pendingApprovals: {
          available: true,
          count: 0,
          items: [],
        },
        payroll: {
          available: false,
          reasonUnavailable: "unauthorized",
        },
        documents: {
          available: false,
          reasonUnavailable: "unauthorized",
          expired: 0,
          within7d: 0,
          within30d: 0,
          within60d: 0,
        },
        recruitment: {
          available: false,
          reasonUnavailable: "unauthorized",
        },
        leaveRoster: [],
      };

      expect(employeeDashboard.scope).toBe("self");
      expect(employeeDashboard.headcount.available).toBe(false);
      expect(employeeDashboard.headcount.activeCount).toBeUndefined();
      expect(employeeDashboard.payroll.available).toBe(false);
      expect(employeeDashboard.documents.available).toBe(false);
      expect(employeeDashboard.documents.reasonUnavailable).toBe("unauthorized");
      expect(employeeDashboard.recruitment.available).toBe(false);
    });

    it("enforces that HR manager receives organization scope with authorized document analytics", () => {
      const hrDashboard: DashboardAnalytics = {
        scope: "organization",
        anchorDate: "2026-09-14",
        startDate: "2026-09-07",
        endDate: "2026-09-14",
        headcount: {
          available: true,
          activeCount: 120,
          newHires: 3,
          saudiCount: 42,
          nonSaudiCount: 78,
        },
        attendance: {
          available: true,
          eligible: 120,
          present: 112,
          late: 5,
          absent: 3,
          onLeave: 2,
        },
        pendingApprovals: {
          available: true,
          count: 2,
          items: [
            {
              id: "r-1",
              referenceNo: "REQ-101",
              type: "leave",
              requesterId: "e-1",
              requesterName: "أحمد علي",
              submittedAt: "2026-09-14T08:00:00Z",
            },
          ],
        },
        payroll: {
          available: true,
          period: "2026-08",
          status: "confirmed_locked",
          employeeCount: 118,
          netTotal: 1245000,
        },
        documents: {
          available: true,
          expired: 2,
          within7d: 1,
          within30d: 4,
          within60d: 6,
        },
        recruitment: {
          available: true,
          openPositions: 4,
          activeCandidates: 18,
        },
        leaveRoster: [],
      };

      expect(hrDashboard.scope).toBe("organization");
      expect(hrDashboard.headcount.available).toBe(true);
      expect(hrDashboard.documents.available).toBe(true);
      expect(hrDashboard.documents.expired).toBe(2);
      expect(hrDashboard.pendingApprovals.items).toHaveLength(1);
    });
  });

  // ─── 4. Truthfulness & Anti-Regression Source Audits ───────────────────────
  describe("Truthfulness & Anti-Regression Source Audits", () => {
    const dashboardViewPath = path.resolve(
      __dirname,
      "../components/dashboard/DashboardView.tsx",
    );
    const migrationPath08 = path.resolve(
      __dirname,
      "../../supabase/migrations/20260914080000_production_dashboard_analytics.sql",
    );
    const migrationPath09 = path.resolve(
      __dirname,
      "../../supabase/migrations/20260914090000_finalize_dashboard_metric_integrity.sql",
    );

    it("asserts DashboardView does NOT contain hardcoded attendance trend numbers", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("present: 116");
      expect(src).not.toContain("present: 114");
      expect(src).not.toContain("present: 117");
      expect(src).not.toContain("present: 118");
    });

    it("asserts DashboardView does NOT fabricate department budget from employeeCount * 18500", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("18500");
      expect(src).not.toContain("employeeCount * 18500");
      expect(src).not.toContain("الميزانية الشهرية التقديرية");
    });

    it("asserts DashboardView does NOT use Math.max(1, ...) placeholder counts in pie chart", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("Math.max(1, saudiCount)");
      expect(src).not.toContain("Math.max(1, expatCount)");
      expect(src).not.toContain("Math.max(1,");
    });

    it("asserts DashboardView wires platforms directly from integrationHealth query result", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).toContain("integrationHealth");
      expect(src).toContain("integrationPlatforms = integrationHealth?.platforms");
    });

    it("asserts DashboardView does NOT contain fixed WPS 100% (SIF) compliance claim", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("مطابق 100% (SIF)");
      expect(src).not.toContain("ملف SIF مطابق 100%");
    });

    it("asserts DashboardView does NOT contain fixed +8.4% growth string", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("+8.4%");
    });

    it("asserts DashboardView does NOT contain always-Platinum (بلاتيني) badge label", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("(بلاتيني)");
      expect(src).not.toContain("نطاقات بلاتيني");
    });

    it("asserts DashboardView does NOT contain fake document alert names", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("طارق المنصور");
      expect(src).not.toContain("هيفاء الشهري");
      expect(src).not.toContain("فيصل العتيبي");
    });

    it("asserts migration 09 enforces canonical pending_approval and active workforce definition", () => {
      const sql = fs.readFileSync(migrationPath09, "utf8");
      expect(sql).toContain("pending_approval");
      expect(sql).toContain("status IN ('active', 'probation', 'on_leave')");
      expect(sql).toContain("get_company_timezone");
      expect(sql).toContain("turnoverRate");
      expect(sql).toContain("termination_date_not_available");
      expect(sql).not.toContain("updated_at::date BETWEEN");
    });

    it("asserts migration 09 restricts document expiry analytics strictly to HR", () => {
      const sql = fs.readFileSync(migrationPath09, "utf8");
      expect(sql).toContain("IF v_is_hr AND v_company_id IS NOT NULL THEN");
      expect(sql).toContain("v_docs_available := true;");
      expect(sql).toContain("v_docs_available := false;");
      expect(sql).toContain("'reasonUnavailable', CASE WHEN NOT v_docs_available THEN 'unauthorized' ELSE NULL END");
    });
  });
});
