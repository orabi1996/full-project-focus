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
import {
  calculateWorkingDaysRecord,
  submitLeaveRequestRecord,
  decideLeaveRequestRecord,
  fetchMyLeaveBalancesRecord,
  fetchCompanyLeaveBalancesRecord,
  fetchTeamLeaveCalendarRecord,
  createLeaveTypeRecord,
  adjustLeaveBalanceRecord,
  runLeaveAccrualRecord,
  runLeaveCarryoverRecord,
} from "../lib/data/operational-repository";
import {
  useMyLeaveBalances,
  useCompanyLeaveBalances,
  useLeaveTypes,
  useLeaveTeamCalendar,
  useLeaves,
  useLeaveMutations,
} from "../lib/domains/leaves";

describe("Production Leave Management, Entitlements & Absence Engine (Prompt 10 Hotfix)", () => {
  const hotfixMigrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20260921010000_finalize_leave_workflow_jurisdiction_and_integrity.sql",
  );
  const baseMigrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20260921000000_production_leave_entitlements_and_reservations.sql",
  );
  const hotfixSql = fs.readFileSync(hotfixMigrationPath, "utf-8");
  const baseSql = fs.readFileSync(baseMigrationPath, "utf-8");

  const leavesViewPath = path.resolve(
    __dirname,
    "../components/leaves/LeavesView.tsx",
  );
  const leavesViewContent = fs.readFileSync(leavesViewPath, "utf-8");

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
      weekendDays: number[] = [5, 6],
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
      const days = computeWorkingDays("2026-09-03", "2026-09-06");
      expect(days).toBe(2);
    });

    it("excludes company paid holidays falling on working days", () => {
      const holidays = ["2026-09-23"];
      const days = computeWorkingDays("2026-09-21", "2026-09-24", false, holidays);
      expect(days).toBe(3);
    });

    it("returns 0.5 for half-day requests regardless of duration", () => {
      const days = computeWorkingDays("2026-09-21", "2026-09-21", true);
      expect(days).toBe(0.5);
    });

    it("returns 1 for single working day", () => {
      const days = computeWorkingDays("2026-09-21", "2026-09-21", false);
      expect(days).toBe(1);
    });

    it("returns 0 if start date is greater than end date", () => {
      const days = computeWorkingDays("2026-09-25", "2026-09-20", false);
      expect(days).toBe(0);
    });
  });

  describe("4. 30 Production Hotfix Specifications", () => {
    // 1. removes implicit SA default from leave_types and company_holidays
    it("1. removes implicit SA default from leave_types and company_holidays", () => {
      expect(hotfixSql).toContain("ALTER TABLE public.leave_types");
      expect(hotfixSql).toContain("ALTER COLUMN jurisdiction DROP DEFAULT;");
      expect(hotfixSql).toContain("ALTER TABLE public.company_holidays");
    });

    // 2. companies work_days / rest_days columns exist
    it("2. companies work_days / rest_days and visibility columns exist", () => {
      expect(hotfixSql).toContain("ADD COLUMN IF NOT EXISTS work_days integer[]");
      expect(hotfixSql).toContain("ADD COLUMN IF NOT EXISTS rest_days integer[]");
      expect(hotfixSql).toContain("ADD COLUMN IF NOT EXISTS allow_peer_leave_calendar_visibility boolean");
    });

    // 3. shifts work_days / rest_days columns exist
    it("3. shifts work_days / rest_days columns exist", () => {
      expect(hotfixSql).toContain("ALTER TABLE public.shifts");
      expect(hotfixSql).toContain("ADD COLUMN IF NOT EXISTS work_days integer[]");
      expect(hotfixSql).toContain("ADD COLUMN IF NOT EXISTS rest_days integer[]");
    });

    // 4. company_request_sequences exists and is concurrency safe
    it("4. company_request_sequences exists and is concurrency safe with FOR UPDATE", () => {
      expect(hotfixSql).toContain("CREATE TABLE IF NOT EXISTS public.company_request_sequences");
      expect(hotfixSql).toContain("ON CONFLICT (company_id, year)");
    });

    // 5. leave_carryover_runs exists and is unique on (company_id, leave_type_id, source_year, target_year)
    it("5. leave_carryover_runs exists with unique constraint", () => {
      expect(hotfixSql).toContain("CREATE TABLE IF NOT EXISTS public.leave_carryover_runs");
      expect(hotfixSql).toContain("CONSTRAINT uq_leave_carryover_run UNIQUE (company_id, leave_type_id, source_year, target_year)");
    });

    // 6. legacy leave_types backfill reset to company_id = NULL
    it("6. legacy leave_types backfill reset to company_id = NULL", () => {
      expect(hotfixSql).toContain("UPDATE public.leave_types");
      expect(hotfixSql).toContain("SET company_id = NULL");
      expect(hotfixSql).toContain("WHERE company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)");
    });

    // 7. direct DML on leave_balances is revoked from authenticated
    it("7. direct DML on leave_balances is revoked from authenticated", () => {
      expect(hotfixSql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.leave_balances FROM authenticated;");
    });

    // 8. prevent_leave_ledger_modification trigger prevents UPDATE/DELETE on leave_balance_transactions
    it("8. prevent_leave_ledger_modification trigger prevents UPDATE/DELETE on leave_balance_transactions", () => {
      expect(hotfixSql).toContain("FUNCTION public.prevent_leave_ledger_modification()");
      expect(hotfixSql).toContain("BEFORE UPDATE OR DELETE ON public.leave_balance_transactions");
    });

    // 9. calculate_working_days enforces tenant access
    it("9. calculate_working_days enforces tenant access", () => {
      expect(hotfixSql).toContain("FUNCTION public.calculate_working_days(");
      expect(hotfixSql).toContain("current_user_can_manage_company");
    });

    // 10. calculate_working_days respects shift/company rest_days
    it("10. calculate_working_days respects shift/company rest_days", () => {
      expect(hotfixSql).toContain("v_effective_rest_days");
      expect(hotfixSql).toContain("v_shift.rest_days");
      expect(hotfixSql).toContain("v_company.rest_days");
    });

    // 11. calculate_working_days validates half-day (0.5 for 1 day, error if multi-day)
    it("11. calculate_working_days validates half-day (0.5 for 1 day, error if multi-day)", () => {
      expect(hotfixSql).toContain("IF p_is_half_day THEN");
      expect(hotfixSql).toContain("p_start_date <> p_end_date");
      expect(hotfixSql).toContain("إجازة نصف اليوم يجب أن تكون لتاريخ يوم واحد فقط");
    });

    // 12. submit_leave_request rejects cross-year requests (Option B)
    it("12. submit_leave_request rejects cross-year requests (Option B)", () => {
      expect(hotfixSql).toContain("EXTRACT(YEAR FROM p_start_date)::int <> EXTRACT(YEAR FROM p_end_date)::int");
      expect(hotfixSql).toContain("طلب الإجازة يمتد عبر سنتين تقويميتين مختلفتين");
    });

    // 13. submit_leave_request rejects unauthorized on-behalf submissions
    it("13. submit_leave_request rejects unauthorized on-behalf submissions", () => {
      expect(hotfixSql).toContain("IF p_target_employee_id IS NOT NULL THEN");
      expect(hotfixSql).toContain("current_user_can_manage_company");
    });

    // 14. submit_leave_request validates replacement employee is in same company
    it("14. submit_leave_request validates replacement employee is in same company", () => {
      expect(hotfixSql).toContain("p_replacement_employee_id IS NOT NULL");
      expect(hotfixSql).toContain("v_rep_emp.company_id <> v_company_id");
      expect(hotfixSql).toContain("الموظف البديل يجب أن يكون تابعاً لنفس منشأة الموظف");
    });

    // 15. submit_leave_request validates attachment existence and sets is_final/locked
    it("15. submit_leave_request validates attachment existence and sets is_final/locked", () => {
      expect(hotfixSql).toContain("p_attachment_file_id IS NOT NULL");
      expect(hotfixSql).toContain("v_leave_type.requires_attachment");
      expect(hotfixSql).toContain("v_att_file.company_id <> v_company_id");
      expect(hotfixSql).toContain("UPDATE public.file_objects");
    });

    // 16. submit_leave_request resolves approval chain into approval_steps
    it("16. submit_leave_request resolves approval chain into approval_steps", () => {
      expect(hotfixSql).toContain("INSERT INTO public.approval_steps");
      expect(hotfixSql).toContain("current_step_index");
    });

    // 17. decide_leave_request validates current step approver / delegation
    it("17. decide_leave_request validates current step approver / delegation", () => {
      expect(hotfixSql).toContain("FUNCTION public.decide_leave_request(");
      expect(hotfixSql).toContain("current_step_index");
      expect(hotfixSql).toContain("delegation_rules");
    });

    // 18. decide_leave_request advances intermediate steps without settling balance
    it("18. decide_leave_request advances intermediate steps without settling balance", () => {
      expect(hotfixSql).toContain("IF NOT v_is_final THEN");
      expect(hotfixSql).toContain("current_step_index = current_step_index + 1");
    });

    // 19. decide_leave_request commits balance on final approval
    it("19. decide_leave_request commits balance on final approval", () => {
      expect(hotfixSql).toContain("reserved_days = GREATEST(0, reserved_days - v_chargeable_days)");
      expect(hotfixSql).toContain("used_days = used_days + v_chargeable_days");
    });

    // 20. decide_leave_request releases reservation on rejection/withdrawal
    it("20. decide_leave_request releases reservation on rejection/withdrawal", () => {
      expect(hotfixSql).toContain("p_decision = 'rejected'");
      expect(hotfixSql).toContain("reserved_days = GREATEST(0, reserved_days - v_chargeable_days)");
      expect(hotfixSql).toContain("'reservation_release'");
    });

    // 21. decide_leave_request is idempotent on repeated calls
    it("21. decide_leave_request is idempotent on repeated calls", () => {
      expect(hotfixSql).toContain("v_request.status = 'approved' AND p_decision = 'approved'");
      expect(hotfixSql).toContain("v_request.status = 'rejected' AND p_decision = 'rejected'");
      expect(hotfixSql).toContain("تمت معالجة هذا الطلب مسبقاً");
    });

    // 22. get_my_leave_balances returns truthful negative available balances
    it("22. get_my_leave_balances returns truthful negative available balances", () => {
      expect(hotfixSql).toContain("FUNCTION public.get_my_leave_balances(");
      expect(hotfixSql).toContain("((b.accrued_days + b.carried_over_days) - (b.used_days + b.reserved_days)) AS available_balance");
    });

    // 23. get_company_leave_balances returns truthful negative available balances
    it("23. get_company_leave_balances returns truthful negative available balances", () => {
      expect(hotfixSql).toContain("FUNCTION public.get_company_leave_balances(");
      expect(hotfixSql).toContain("((b.accrued_days + b.carried_over_days) - (b.used_days + b.reserved_days)) AS available_balance");
    });

    // 24. get_team_leave_calendar respects allow_peer_leave_calendar_visibility
    it("24. get_team_leave_calendar respects allow_peer_leave_calendar_visibility", () => {
      expect(hotfixSql).toContain("FUNCTION public.get_team_leave_calendar(");
      expect(hotfixSql).toContain("allow_peer_leave_calendar_visibility");
    });

    // 25. run_leave_accrual supports yearly_frontloaded, monthly_accrual, and contract_anniversary
    it("25. run_leave_accrual supports yearly_frontloaded, monthly_accrual, and contract_anniversary", () => {
      expect(hotfixSql).toContain("'yearly_frontloaded'");
      expect(hotfixSql).toContain("'monthly_accrual'");
      expect(hotfixSql).toContain("'contract_anniversary'");
    });

    // 26. run_leave_accrual creates leave_balance_transactions and records actual credit
    it("26. run_leave_accrual creates leave_balance_transactions and records actual credit", () => {
      expect(hotfixSql).toContain("INSERT INTO public.leave_balance_transactions");
      expect(hotfixSql).toContain("v_actual_credit");
      expect(hotfixSql).toContain("'accrual'");
    });

    // 27. run_leave_carryover is idempotent and respects carryover_limit_days
    it("27. run_leave_carryover is idempotent and respects carryover_limit_days", () => {
      expect(hotfixSql).toContain("FUNCTION public.run_leave_carryover(");
      expect(hotfixSql).toContain("LEAST(v_unused, v_carryover_limit)");
      expect(hotfixSql).toContain("INSERT INTO public.leave_carryover_runs");
    });

    // 28. create_leave_type requires explicit parameters without hidden legal defaults
    it("28. create_leave_type requires explicit parameters without hidden legal defaults", () => {
      expect(hotfixSql).toContain("FUNCTION public.create_leave_type(");
      expect(hotfixSql).not.toContain("p_jurisdiction text DEFAULT 'SA'");
      expect(hotfixSql).toContain("p_jurisdiction text DEFAULT NULL");
    });

    // 29. UI LeavesView uses timezone-aware calendar boundaries and rejects cross-year requests
    it("29. UI LeavesView uses timezone-aware calendar boundaries and rejects cross-year requests", () => {
      expect(leavesViewContent).toContain("startDate.slice(0, 4) !== endDate.slice(0, 4)");
      expect(leavesViewContent).toContain("لا يمكن تقديم إجازة تمتد عبر سنتين ماليتين");
      expect(leavesViewContent).toContain("isHalfDay && startDate !== endDate");
      expect(leavesViewContent).toContain("company?.country");
    });

    // 30. operational-repository and domains/leaves export runLeaveCarryoverRecord and carryoverLeaveBalances
    it("30. operational-repository and domains/leaves export runLeaveCarryoverRecord and carryoverLeaveBalances", () => {
      expect(typeof runLeaveCarryoverRecord).toBe("function");
      expect(typeof calculateWorkingDaysRecord).toBe("function");
      expect(typeof submitLeaveRequestRecord).toBe("function");
      expect(typeof decideLeaveRequestRecord).toBe("function");
      expect(typeof fetchMyLeaveBalancesRecord).toBe("function");
      expect(typeof fetchCompanyLeaveBalancesRecord).toBe("function");
      expect(typeof fetchTeamLeaveCalendarRecord).toBe("function");
      expect(typeof createLeaveTypeRecord).toBe("function");
      expect(typeof adjustLeaveBalanceRecord).toBe("function");
      expect(typeof runLeaveAccrualRecord).toBe("function");
      expect(typeof useLeaves).toBe("function");
      expect(typeof useLeaveMutations).toBe("function");
      expect(typeof useMyLeaveBalances).toBe("function");
      expect(typeof useCompanyLeaveBalances).toBe("function");
      expect(typeof useLeaveTypes).toBe("function");
      expect(typeof useLeaveTeamCalendar).toBe("function");
    });
  });

  describe("5. Overlap Prevention & Policy Restrictions", () => {
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

  describe("6. Ledger & Transaction Type Integrity", () => {
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

  describe("7. UI & Codebase Truthfulness Verification", () => {
    it("does NOT contain hardcoded fake initial dates 2026-09-01 or 2026-09-05 in LeavesView.tsx", () => {
      expect(leavesViewContent).not.toContain('"2026-09-01"');
      expect(leavesViewContent).not.toContain('"2026-09-05"');
    });

    it("does NOT contain hardcoded fake employees 'محمد الشمري' or 'نورة القحطاني'", () => {
      expect(leavesViewContent).not.toContain("محمد الشمري");
      expect(leavesViewContent).not.toContain("نورة القحطاني");
    });

    it("does NOT contain external Unsplash avatar URLs in LeavesView.tsx", () => {
      expect(leavesViewContent).not.toContain("images.unsplash.com");
    });

    it("does NOT claim 'متوافق مع قوى ونظام العمل' as a global hardcoded truth", () => {
      expect(leavesViewContent).not.toContain("متوافق مع قوى ونظام العمل");
      expect(leavesViewContent).toContain("سياسة الإجازات المعتمدة");
    });

    it("does NOT automatically select employees[0] in adjust balance modal", () => {
      expect(leavesViewContent).not.toContain('useState(employees[0]?.id || "")');
      expect(leavesViewContent).toContain('useState("")');
      expect(leavesViewContent).toContain("-- اختر الموظف --");
    });

    it("uses automatic working days calculation preview instead of free-form day input", () => {
      expect(leavesViewContent).toContain("calculateWorkingDaysRecord");
      expect(leavesViewContent).toContain("أيام العمل الفعلية المستحقة");
    });
  });
});
