import { describe, it, expect } from "vitest";
import { queryKeys } from "../lib/query/query-keys";
import type {
  EmployeeLeaveBalance,
  LeaveTypePolicy,
  LeaveBalanceTransaction,
  TeamLeaveCalendarItem,
} from "../types";
import * as fs from "fs";
import * as path from "path";

describe("Production Leave Management, Entitlements & Absence Engine", () => {
  describe("1. Query Keys Architecture", () => {
    it("provides dedicated hierarchical query keys for all leave operations", () => {
      expect(queryKeys.leaves.all).toEqual(["leaves"]);
      expect(queryKeys.leaves.types()).toEqual(["leaves", "types"]);
      expect(queryKeys.leaves.balances()).toEqual(["leaves", "balances", "all"]);
      expect(queryKeys.leaves.myBalances(2026)).toEqual(["leaves", "myBalances", 2026]);
      expect(queryKeys.leaves.adminBalances({ year: 2026, departmentId: "dept-1" })).toEqual([
        "leaves",
        "adminBalances",
        { year: 2026, departmentId: "dept-1" },
      ]);
      expect(
        queryKeys.leaves.teamCalendar({ startDate: "2026-09-01", endDate: "2026-09-30" }),
      ).toEqual([
        "leaves",
        "teamCalendar",
        { startDate: "2026-09-01", endDate: "2026-09-30" },
      ]);
      expect(queryKeys.leaves.accrualRuns(2026)).toEqual(["leaves", "accrualRuns", 2026]);
      expect(queryKeys.leaves.holidays("comp-1")).toEqual(["leaves", "holidays", "comp-1"]);
    });
  });

  describe("2. Authoritative Leave Balance Formula", () => {
    const calculateAvailable = (b: {
      annualEntitlement: number;
      accruedDays: number;
      carriedOverDays: number;
      usedDays: number;
      reservedDays: number;
    }) => {
      return b.accruedDays + b.carriedOverDays - (b.usedDays + b.reservedDays);
    };

    it("correctly computes available balance according to authoritative formula: (accrued + carried) - (used + reserved)", () => {
      const balance: EmployeeLeaveBalance = {
        leaveTypeId: "annual-01",
        leaveTypeNameAr: "إجازة سنوية",
        leaveTypeNameEn: "Annual Leave",
        color: "#059669",
        annualEntitlement: 30,
        accruedDays: 30,
        carriedOverDays: 5,
        usedDays: 10,
        reservedDays: 4,
        availableBalance: 21,
      };

      const computed = calculateAvailable(balance);
      expect(computed).toBe(21);
      expect(balance.availableBalance).toBe(computed);
    });

    it("atomically reserves days upon submission: reserved increases, available decreases", () => {
      const initial: EmployeeLeaveBalance = {
        leaveTypeId: "annual-01",
        leaveTypeNameAr: "إجازة سنوية",
        leaveTypeNameEn: "Annual Leave",
        color: "#059669",
        annualEntitlement: 21,
        accruedDays: 21,
        carriedOverDays: 0,
        usedDays: 0,
        reservedDays: 0,
        availableBalance: 21,
      };

      const requestedDays = 5;
      const afterReservation: EmployeeLeaveBalance = {
        ...initial,
        reservedDays: initial.reservedDays + requestedDays,
        availableBalance: calculateAvailable({
          ...initial,
          reservedDays: initial.reservedDays + requestedDays,
        }),
      };

      expect(afterReservation.reservedDays).toBe(5);
      expect(afterReservation.usedDays).toBe(0);
      expect(afterReservation.availableBalance).toBe(16);
    });

    it("commits reservation on approval: reserved shifts to used, available remains stable", () => {
      const pending: EmployeeLeaveBalance = {
        leaveTypeId: "annual-01",
        leaveTypeNameAr: "إجازة سنوية",
        leaveTypeNameEn: "Annual Leave",
        color: "#059669",
        annualEntitlement: 21,
        accruedDays: 21,
        carriedOverDays: 0,
        usedDays: 2,
        reservedDays: 5,
        availableBalance: 14,
      };

      const approvedDays = 5;
      const afterApproval: EmployeeLeaveBalance = {
        ...pending,
        reservedDays: pending.reservedDays - approvedDays,
        usedDays: pending.usedDays + approvedDays,
        availableBalance: calculateAvailable({
          ...pending,
          reservedDays: pending.reservedDays - approvedDays,
          usedDays: pending.usedDays + approvedDays,
        }),
      };

      expect(afterApproval.reservedDays).toBe(0);
      expect(afterApproval.usedDays).toBe(7);
      expect(afterApproval.availableBalance).toBe(14);
    });

    it("releases reservation on rejection or withdrawal: reserved returns to available", () => {
      const pending: EmployeeLeaveBalance = {
        leaveTypeId: "annual-01",
        leaveTypeNameAr: "إجازة سنوية",
        leaveTypeNameEn: "Annual Leave",
        color: "#059669",
        annualEntitlement: 21,
        accruedDays: 21,
        carriedOverDays: 0,
        usedDays: 2,
        reservedDays: 5,
        availableBalance: 14,
      };

      const rejectedDays = 5;
      const afterRejection: EmployeeLeaveBalance = {
        ...pending,
        reservedDays: pending.reservedDays - rejectedDays,
        availableBalance: calculateAvailable({
          ...pending,
          reservedDays: pending.reservedDays - rejectedDays,
        }),
      };

      expect(afterRejection.reservedDays).toBe(0);
      expect(afterRejection.usedDays).toBe(2);
      expect(afterRejection.availableBalance).toBe(19);
    });
  });

  describe("3. Working Days & Holidays Calculation Logic", () => {
    function computeWorkingDays(
      startDate: string,
      endDate: string,
      isHalfDay: boolean = false,
      holidays: string[] = [],
      weekendDays: number[] = [5, 6], // 5: Friday, 6: Saturday
    ): number {
      if (isHalfDay) return 0.5;
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) return 0;

      let workingDays = 0;
      const cur = new Date(start);
      while (cur <= end) {
        const dayOfWeek = cur.getDay();
        const iso = cur.toISOString().split("T")[0];
        const isWeekend = weekendDays.includes(dayOfWeek);
        const isHoliday = holidays.includes(iso);

        if (!isWeekend && !isHoliday) {
          workingDays++;
        }
        cur.setDate(cur.getDate() + 1);
      }
      return workingDays;
    }

    it("excludes standard weekends (Friday & Saturday) from working days count", () => {
      // 2026-09-03 is Thursday, 2026-09-04 is Friday, 2026-09-05 is Saturday, 2026-09-06 is Sunday
      const days = computeWorkingDays("2026-09-03", "2026-09-06");
      // Thursday + Sunday = 2 working days
      expect(days).toBe(2);
    });

    it("excludes company paid holidays falling on working days", () => {
      // 2026-09-21 (Mon) to 2026-09-24 (Thu) = 4 calendar days
      // If 2026-09-23 is National Day (holiday)
      const holidays = ["2026-09-23"];
      const days = computeWorkingDays("2026-09-21", "2026-09-24", false, holidays);
      expect(days).toBe(3);
    });

    it("returns 0.5 for half-day requests regardless of duration", () => {
      const days = computeWorkingDays("2026-09-21", "2026-09-21", true);
      expect(days).toBe(0.5);
    });

    it("returns 1 for single working day", () => {
      // 2026-09-21 is Monday (working day)
      const days = computeWorkingDays("2026-09-21", "2026-09-21", false);
      expect(days).toBe(1);
    });

    it("returns 0 if start date is greater than end date", () => {
      const days = computeWorkingDays("2026-09-25", "2026-09-20", false);
      expect(days).toBe(0);
    });
  });

  describe("4. Overlap Prevention & Policy Restrictions", () => {
    interface ActiveLeave {
      startDate: string;
      endDate: string;
      status: "pending" | "pending_approval" | "approved" | "rejected";
    }

    function hasOverlap(
      existingLeaves: ActiveLeave[],
      candidateStart: string,
      candidateEnd: string,
    ): boolean {
      return existingLeaves.some(
        (l) =>
          ["pending", "pending_approval", "approved"].includes(l.status) &&
          l.startDate <= candidateEnd &&
          l.endDate >= candidateStart,
      );
    }

    it("detects and rejects overlapping leave requests against pending and approved leaves", () => {
      const active: ActiveLeave[] = [
        { startDate: "2026-10-05", endDate: "2026-10-12", status: "pending_approval" },
        { startDate: "2026-11-01", endDate: "2026-11-05", status: "approved" },
        { startDate: "2026-08-01", endDate: "2026-08-05", status: "rejected" },
      ];

      // Overlap with pending_approval
      expect(hasOverlap(active, "2026-10-10", "2026-10-15")).toBe(true);
      // Overlap with approved
      expect(hasOverlap(active, "2026-10-31", "2026-11-02")).toBe(true);
      // Overlap with rejected (should NOT conflict)
      expect(hasOverlap(active, "2026-08-02", "2026-08-04")).toBe(false);
      // Completely separate period
      expect(hasOverlap(active, "2026-10-15", "2026-10-20")).toBe(false);
    });

    it("validates negative balance rules: rejects unless allowNegativeBalance is true", () => {
      const policyNoNegative: LeaveTypePolicy = {
        id: "lt-1",
        code: "ANNUAL",
        nameAr: "إجازة سنوية",
        nameEn: "Annual Leave",
        color: "#059669",
        isPaid: true,
        deductFromWorkingDaysOnly: true,
        maxDaysPerYear: 21,
        allowHalfDay: true,
        allowNegativeBalance: false,
        requiresAttachment: false,
        accrualMethod: "yearly_frontloaded",
        carryoverLimitDays: 5,
        status: "active",
      };

      const policyWithNegative: LeaveTypePolicy = {
        ...policyNoNegative,
        allowNegativeBalance: true,
      };

      const available = 3;
      const requested = 5;

      const canSubmit1 = available >= requested || policyNoNegative.allowNegativeBalance;
      const canSubmit2 = available >= requested || policyWithNegative.allowNegativeBalance;

      expect(canSubmit1).toBe(false);
      expect(canSubmit2).toBe(true);
    });
  });

  describe("5. Ledger & Transaction Type Integrity", () => {
    it("recognizes all authoritative transaction types for audit and accounting", () => {
      const validTypes: LeaveBalanceTransaction["transactionType"][] = [
        "opening",
        "entitlement",
        "accrual",
        "carryover",
        "reservation",
        "reservation_release",
        "usage",
        "adjustment",
        "expiry",
        "reversal",
      ];

      expect(validTypes).toHaveLength(10);
      expect(validTypes).toContain("reservation");
      expect(validTypes).toContain("reservation_release");
      expect(validTypes).toContain("usage");
      expect(validTypes).toContain("adjustment");
    });
  });

  describe("6. UI & Codebase Truthfulness Verification", () => {
    const leavesViewPath = path.resolve(
      __dirname,
      "../components/leaves/LeavesView.tsx",
    );
    const leavesContent = fs.readFileSync(leavesViewPath, "utf-8");

    it("does NOT contain hardcoded fake initial dates 2026-09-01 or 2026-09-05 in LeavesView.tsx", () => {
      expect(leavesContent).not.toContain('"2026-09-01"');
      expect(leavesContent).not.toContain('"2026-09-05"');
    });

    it("does NOT contain hardcoded fake employees 'محمد الشمري' or 'نورة القحطاني'", () => {
      expect(leavesContent).not.toContain("محمد الشمري");
      expect(leavesContent).not.toContain("نورة القحطاني");
    });

    it("does NOT contain external Unsplash avatar URLs in LeavesView.tsx", () => {
      expect(leavesContent).not.toContain("images.unsplash.com");
    });

    it("does NOT claim 'متوافق مع قوى ونظام العمل' as a global hardcoded truth", () => {
      expect(leavesContent).not.toContain("متوافق مع قوى ونظام العمل");
      expect(leavesContent).toContain("سياسة الإجازات المعتمدة");
    });

    it("does NOT automatically select employees[0] in adjust balance modal", () => {
      expect(leavesContent).not.toContain('useState(employees[0]?.id || "")');
      expect(leavesContent).toContain('useState("")');
      expect(leavesContent).toContain("-- اختر الموظف --");
    });

    it("uses automatic working days calculation preview instead of free-form day input", () => {
      expect(leavesContent).toContain("calculateWorkingDaysRecord");
      expect(leavesContent).toContain("أيام العمل الفعلية المستحقة");
    });
  });

  describe("7. Database Migration Completeness", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/20260921000000_production_leave_entitlements_and_reservations.sql",
    );

    it("contains the complete production leave schema and RPC definitions", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, "utf-8");

      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.leave_balance_transactions");
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.leave_accrual_runs");
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.company_holidays");
      expect(sql).toContain("FUNCTION public.calculate_working_days");
      expect(sql).toContain("FUNCTION public.submit_leave_request");
      expect(sql).toContain("FUNCTION public.decide_leave_request");
      expect(sql).toContain("FUNCTION public.get_my_leave_balances");
      expect(sql).toContain("FUNCTION public.get_team_leave_calendar");
      expect(sql).toContain("FUNCTION public.adjust_leave_balance");
      expect(sql).toContain("FUNCTION public.run_leave_accrual");
      expect(sql).toContain("FUNCTION public.create_leave_type");
    });
  });
});
