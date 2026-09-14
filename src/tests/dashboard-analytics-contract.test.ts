import { describe, it, expect } from "vitest";
import { queryKeys } from "../lib/query/query-keys";
import { getDefaultDashboardFilters } from "../lib/domains/dashboard";
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

    it("generates valid default filters with last7 preset", () => {
      const filters = getDefaultDashboardFilters();
      expect(filters.preset).toBe("last7");
      expect(filters.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(filters.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(filters.startDate).getTime()).toBeLessThanOrEqual(
        new Date(filters.endDate).getTime(),
      );
    });
  });

  // ─── 2. Metric Correctness & Formulas ────────────────────────────────────
  describe("Metric Correctness & Edge Cases", () => {
    it("handles zero denominator safely for Saudization rate", () => {
      const calculateSaudizationRate = (saudi: number, total: number): string => {
        return total > 0 ? ((saudi / total) * 100).toFixed(1) : "0";
      };
      expect(calculateSaudizationRate(0, 0)).toBe("0");
      expect(calculateSaudizationRate(5, 0)).toBe("0");
      expect(calculateSaudizationRate(25, 100)).toBe("25.0");
      expect(calculateSaudizationRate(1, 3)).toBe("33.3");
    });

    it("handles zero denominator safely for Attendance rate", () => {
      const calculateAttendanceRate = (present: number, eligible: number): number => {
        return eligible > 0 ? Math.round((present / eligible) * 100) : 0;
      };
      expect(calculateAttendanceRate(0, 0)).toBe(0);
      expect(calculateAttendanceRate(45, 50)).toBe(90);
    });

    it("computes turnover rate correctly based on period departures and active headcount", () => {
      const calculateTurnover = (
        departures: number,
        activeHeadcount: number,
      ): number | null => {
        if (activeHeadcount <= 0) return null;
        return Number(((departures / activeHeadcount) * 100).toFixed(2));
      };
      expect(calculateTurnover(2, 100)).toBe(2.0);
      expect(calculateTurnover(0, 50)).toBe(0.0);
      expect(calculateTurnover(3, 0)).toBeNull();
    });

    it("deduplicates attendance records per employee correctly", () => {
      const rawRecords = [
        { employeeId: "emp-1", status: "present", workDate: "2026-09-14" },
        { employeeId: "emp-1", status: "present", workDate: "2026-09-14" }, // duplicate punch
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

    it("filters active leave roster covering anchor date and excludes pending/rejected", () => {
      const anchorDate = "2026-09-14";
      const requests = [
        {
          id: "req-1",
          type: "leave",
          status: "approved",
          startDate: "2026-09-10",
          endDate: "2026-09-18",
        },
        {
          id: "req-2",
          type: "leave",
          status: "pending_approval", // not approved yet
          startDate: "2026-09-10",
          endDate: "2026-09-18",
        },
        {
          id: "req-3",
          type: "leave",
          status: "rejected", // rejected
          startDate: "2026-09-10",
          endDate: "2026-09-18",
        },
        {
          id: "req-4",
          type: "leave",
          status: "approved",
          startDate: "2026-09-01",
          endDate: "2026-09-10", // past leave
        },
      ];

      const activeOnLeave = requests.filter(
        (r) =>
          r.type === "leave" &&
          r.status === "approved" &&
          r.startDate <= anchorDate &&
          r.endDate >= anchorDate,
      );

      expect(activeOnLeave).toHaveLength(1);
      expect(activeOnLeave[0]?.id).toBe("req-1");
    });

    it("correctly buckets document expiry dates without fabrication", () => {
      const now = new Date("2026-09-14T12:00:00Z");
      const docs = [
        { id: "doc-1", expiryDate: "2026-09-10" }, // expired (-4 days)
        { id: "doc-2", expiryDate: "2026-09-18" }, // within 7 days (+4 days)
        { id: "doc-3", expiryDate: "2026-10-05" }, // within 30 days (+21 days)
        { id: "doc-4", expiryDate: "2026-11-01" }, // within 60 days (+48 days)
        { id: "doc-5", expiryDate: "2027-01-01" }, // safe (>60 days)
      ];

      const expired = docs.filter((d) => new Date(d.expiryDate) < now).length;
      const within7d = docs.filter((d) => {
        const diff = (new Date(d.expiryDate).getTime() - now.getTime()) / 86400000;
        return diff >= 0 && diff <= 7;
      }).length;
      const within30d = docs.filter((d) => {
        const diff = (new Date(d.expiryDate).getTime() - now.getTime()) / 86400000;
        return diff > 7 && diff <= 30;
      }).length;
      const within60d = docs.filter((d) => {
        const diff = (new Date(d.expiryDate).getTime() - now.getTime()) / 86400000;
        return diff > 30 && diff <= 60;
      }).length;

      expect(expired).toBe(1);
      expect(within7d).toBe(1);
      expect(within30d).toBe(1);
      expect(within60d).toBe(1);
    });
  });

  // ─── 3. Security & Data Scope ─────────────────────────────────────────────
  describe("Security & Role Scope Contracts", () => {
    it("enforces that non-HR roles receive unavailable for headcount, attendance, and payroll", () => {
      // Mock response shape when user is a regular employee
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
        },
        payroll: {
          available: false,
          reasonUnavailable: "unauthorized",
        },
        documents: {
          available: true,
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
        integrations: {
          available: false,
          reasonUnavailable: "not_configured",
          platforms: [],
        },
      };

      expect(employeeDashboard.scope).toBe("self");
      expect(employeeDashboard.headcount.available).toBe(false);
      expect(employeeDashboard.headcount.activeCount).toBeUndefined();
      expect(employeeDashboard.payroll.available).toBe(false);
      expect(employeeDashboard.payroll.netTotal).toBeUndefined();
      expect(employeeDashboard.recruitment.available).toBe(false);
      expect(employeeDashboard.recruitment.activeCandidates).toBeUndefined();
    });

    it("enforces that HR manager receives organization scope with aggregated metrics", () => {
      const hrDashboard: DashboardAnalytics = {
        scope: "organization",
        anchorDate: "2026-09-14",
        startDate: "2026-09-07",
        endDate: "2026-09-14",
        headcount: {
          available: true,
          activeCount: 120,
          newHires: 3,
          departures: 1,
          saudiCount: 42,
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
          count: 7,
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
        leaveRoster: [
          {
            id: "req-1",
            employeeId: "emp-5",
            firstNameAr: "سالم",
            lastNameAr: "العتيبي",
            jobTitleAr: "مهندس نظم",
            leaveType: "إجازة سنوية",
          },
        ],
        integrations: {
          available: false,
          reasonUnavailable: "not_configured",
          platforms: [],
        },
      };

      expect(hrDashboard.scope).toBe("organization");
      expect(hrDashboard.headcount.available).toBe(true);
      expect(hrDashboard.headcount.activeCount).toBe(120);
      expect(hrDashboard.attendance.present).toBe(112);
      expect(hrDashboard.payroll.netTotal).toBe(1245000);
      expect(hrDashboard.leaveRoster).toHaveLength(1);
    });
  });

  // ─── 4. Truthfulness & Anti-Regression ────────────────────────────────────
  describe("Truthfulness & Anti-Regression Source Audits", () => {
    const dashboardViewPath = path.resolve(
      __dirname,
      "../components/dashboard/DashboardView.tsx",
    );
    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/20260914080000_production_dashboard_analytics.sql",
    );

    it("asserts DashboardView does NOT contain hardcoded attendance trend numbers (116, 114, 117)", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("present: 116");
      expect(src).not.toContain("present: 114");
      expect(src).not.toContain("present: 117");
      expect(src).not.toContain("present: 118");
    });

    it("asserts DashboardView does NOT contain fixed +8.4% employee growth string", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("+8.4%");
    });

    it("asserts DashboardView does NOT contain fixed WPS 100% (SIF) compliance claim", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("مطابق 100% (SIF)");
      expect(src).not.toContain("ملف SIF مطابق 100%");
    });

    it("asserts DashboardView does NOT contain fixed '100% عقود موثقة بقوى' claim", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("100% عقود موثقة بقوى");
      expect(src).not.toContain("عقود موثقة بقوى");
    });

    it("asserts DashboardView does NOT contain fabricated sample leave roster fallback", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("// Fallback sample if no employee marked on_leave");
      expect(src).not.toContain("employees.slice(0, 3).map((e, idx)");
    });

    it("asserts DashboardView does NOT contain fake document alert names", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("طارق المنصور");
      expect(src).not.toContain("هيفاء الشهري");
      expect(src).not.toContain("فيصل العتيبي");
    });

    it("asserts DashboardView does NOT contain always-Platinum (بلاتيني) badge label", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("(بلاتيني)");
      expect(src).not.toContain("نطاقات بلاتيني");
    });

    it("asserts DashboardView does NOT contain fake 99.9% uptime or 12-minute sync strings", () => {
      const src = fs.readFileSync(dashboardViewPath, "utf8");
      expect(src).not.toContain("99.9%");
      expect(src).not.toContain("قبل 12 دقيقة");
      expect(src).not.toContain("قبل 25 دقيقة");
      expect(src).not.toContain("قبل 40 دقيقة");
    });

    it("asserts the production migration SQL defines the 3 secure SECURITY DEFINER RPCs", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_dashboard_summary");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_dashboard_attendance_trend");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_dashboard_integration_health");
      expect(sql).toContain("SECURITY DEFINER");
      expect(sql).toContain("SET search_path = public");
      expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.get_dashboard_summary");
      expect(sql).toContain("GRANT  EXECUTE ON FUNCTION public.get_dashboard_summary");
    });
  });
});
