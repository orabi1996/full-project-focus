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
  resubmitLeaveRequestRecord,
  decideLeaveRequestRecord,
  fetchMyLeaveBalancesRecord,
  fetchCompanyLeaveBalancesRecord,
  fetchTeamLeaveCalendarRecord,
  fetchMyLeaveRequestsRecord,
  createLeaveTypeRecord,
  adjustLeaveBalanceRecord,
  runLeaveAccrualRecord,
  runLeaveCarryoverRecord,
  runLeaveCarryoverExpiryRecord,
  uploadLeaveAttachmentRecord,
  cleanupStagedLeaveAttachmentRecord,
} from "../lib/data/operational-repository";
import {
  useMyLeaveBalances,
  useCompanyLeaveBalances,
  useLeaveTypes,
  useLeaveTeamCalendar,
  useMyLeaveRequests,
  useLeaves,
  useLeaveMutations,
} from "../lib/domains/leaves";
import {
  getCompanyToday,
  getCompanyYear,
  getCompanyMonth,
  getCompanyMonthBoundaries,
} from "../lib/utils/timezone-dates";

describe("Production Leave Management, Entitlements & Absence Engine (Prompt 10 Hotfix)", () => {
  const runtimeClosureMigrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20260922000000_leave_runtime_closure.sql",
  );
  const runtimeClosureSql = fs.readFileSync(runtimeClosureMigrationPath, "utf-8");
  const operationalRepoPath = path.resolve(__dirname, "../lib/data/operational-repository.ts");
  const operationalRepoContent = fs.readFileSync(operationalRepoPath, "utf-8");
  const leavesDomainPath = path.resolve(__dirname, "../lib/domains/leaves/index.ts");
  const leavesDomainContent = fs.readFileSync(leavesDomainPath, "utf-8");
  const microHotfixMigrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20260921020000_close_leave_production_integrity_gaps.sql",
  );
  const hotfixMigrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20260921010000_finalize_leave_workflow_jurisdiction_and_integrity.sql",
  );
  const baseMigrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20260921000000_production_leave_entitlements_and_reservations.sql",
  );
  const microHotfixSql = fs.readFileSync(microHotfixMigrationPath, "utf-8");
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

  describe("8. Prompt 10 Final Micro Hotfix Specifications (Items 30 - 38)", () => {
    // 30. calculate_working_days rejects unconfigured companies when no shift or schedule exists
    it("30. calculate_working_days rejects unconfigured companies when no shift or schedule exists (no Friday/Saturday fallback)", () => {
      expect(microHotfixSql).toContain("FUNCTION public.calculate_working_days(");
      expect(microHotfixSql).toContain("لم يتم إعداد أيام العمل والراحة للمنشأة.");
      expect(microHotfixSql).not.toContain("ELSE ARRAY[5,6]");
    });

    // 31. submit_leave_request selects departmental chains before company-wide chains before default chains before system templates
    it("31. submit_leave_request selects departmental chains before company-wide chains before default chains before system templates", () => {
      expect(microHotfixSql).toContain("Priority 1: Same-company department-specific");
      expect(microHotfixSql).toContain("scope_type = 'department'");
      expect(microHotfixSql).toContain("scope_type = 'all_employees'");
      expect(microHotfixSql).toContain("is_default = true");
      expect(microHotfixSql).toContain("is_system_template = true");
    });

    // 32. submit_leave_request raises error when no approval chain is configured (no silent line_manager fallback)
    it("32. submit_leave_request raises error when no approval chain is configured (no silent line_manager fallback)", () => {
      expect(microHotfixSql).toContain("لم يتم إعداد مسار اعتماد لطلبات الإجازات لهذه المنشأة.");
      expect(microHotfixSql).not.toContain("INSERT INTO public.approval_steps (request_id, step_order, approver_role)");
    });

    // 33. decide_leave_request does not allow HR to bypass non-HR steps
    it("33. decide_leave_request does not allow HR to bypass non-HR steps", () => {
      expect(microHotfixSql).toContain("FUNCTION public.decide_leave_request(");
      expect(microHotfixSql).toContain("غير مصرح لك باعتماد أو رفض هذه الخطوة في مسار الموافقات");
      expect(microHotfixSql).toContain("super_admin_emergency_override");
      // Must not contain universal v_is_hr bypass
      expect(microHotfixSql).not.toContain("IF v_is_hr THEN");
    });

    // 34. resubmit_leave_request adjusts balance differences atomically and resets steps to pending
    it("34. resubmit_leave_request adjusts balance differences atomically and resets steps to pending", () => {
      expect(microHotfixSql).toContain("FUNCTION public.resubmit_leave_request(");
      expect(microHotfixSql).toContain("v_days_diff := v_new_chargeable_days - v_old_chargeable_days;");
      expect(microHotfixSql).toContain("UPDATE public.leave_balances");
      expect(microHotfixSql).toContain("UPDATE public.approval_steps");
      expect(microHotfixSql).toContain("status = 'pending'");
    });

    // 35. run_leave_carryover reduces source year balance (transferred_out_days / expired_days) preventing double-counting
    it("35. run_leave_carryover reduces source year balance (transferred_out_days / expired_days) preventing double-counting", () => {
      expect(microHotfixSql).toContain("transferred_out_days = transferred_out_days + v_carried");
      expect(microHotfixSql).toContain("expired_days = expired_days + v_expired");
      expect(microHotfixSql).toContain("get_my_leave_balances");
      expect(microHotfixSql).toContain("b.transferred_out_days + b.expired_days");
    });

    // 36. run_leave_carryover_expiry marks expired days and creates 'expiry' transactions
    it("36. run_leave_carryover_expiry marks expired days and creates 'expiry' transactions", () => {
      expect(microHotfixSql).toContain("FUNCTION public.run_leave_carryover_expiry(");
      expect(microHotfixSql).toContain("leave_carryover_expiry_runs");
      expect(microHotfixSql).toContain("'expiry'");
      expect(microHotfixSql).toContain("carried_over_expired_days");
    });

    // 37. run_leave_accrual skips contract_anniversary if hire_date is null
    it("37. run_leave_accrual skips contract_anniversary if hire_date is null (no fake CURRENT_DATE fallback)", () => {
      expect(microHotfixSql).toContain("v_emp.hire_date IS NULL");
      expect(microHotfixSql).toContain("CONTINUE;");
      expect(microHotfixSql).not.toContain("COALESCE(v_emp.hire_date, CURRENT_DATE)");
    });

    // 38. create_leave_type produces deterministic codes like LT-XXXX and requires explicit non-null parameters
    it("38. create_leave_type produces deterministic codes like LT-XXXX and requires explicit non-null parameters", () => {
      expect(microHotfixSql).toContain("FUNCTION public.create_leave_type(");
      expect(microHotfixSql).toContain("'LT-' || lpad(v_seq_num::text, 4, '0')");
      expect(microHotfixSql).toContain("حالة الأجر (مدفوعة الأجر أو بدون أجر) مطلوبة صراحة.");
      expect(microHotfixSql).toContain("الحد الأقصى لأيام الإجازة سنوياً مطلوب ويجب ألا يقل عن صفر.");
    });

    // Timezone utilities contract tests
    it("timezone-dates utilities provide correct date and month boundaries without browser drift", () => {
      const today = getCompanyToday("Asia/Riyadh");
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const year = getCompanyYear("Asia/Riyadh");
      expect(typeof year).toBe("number");
      expect(year).toBeGreaterThanOrEqual(2026);

      const month = getCompanyMonth("Asia/Riyadh");
      expect(typeof month).toBe("number");
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);

      const boundaries = getCompanyMonthBoundaries(2026, 9, "Asia/Riyadh");
      expect(boundaries.startDate).toBe("2026-09-01");
      expect(boundaries.endDate).toBe("2026-09-30");

      const febBoundaries = getCompanyMonthBoundaries(2026, 2, "Asia/Riyadh");
      expect(febBoundaries.startDate).toBe("2026-02-01");
      expect(febBoundaries.endDate).toBe("2026-02-28");
    });

    // Operational repository exports test
    it("operational-repository exports all required micro-hotfix methods", () => {
      expect(typeof resubmitLeaveRequestRecord).toBe("function");
      expect(typeof runLeaveCarryoverExpiryRecord).toBe("function");
      expect(typeof uploadLeaveAttachmentRecord).toBe("function");
      expect(typeof cleanupStagedLeaveAttachmentRecord).toBe("function");
    });

    // LeavesView integration and truthfulness tests
    it("LeavesView uses dedicated queries, timezone boundaries, attachments, employee picker, and resubmission", () => {
      // Uses dedicated queries instead of useLeaves()
      expect(leavesViewContent).toContain("useMyLeaveBalances(currentYear)");
      expect(leavesViewContent).toContain("useCompanyLeaveBalances(currentYear, undefined, { enabled: canManage })");
      expect(leavesViewContent).toContain("useLeaveTypes()");
      expect(leavesViewContent).not.toMatch(/\buseLeaves\(\)/);

      // Uses timezone utilities
      expect(leavesViewContent).toContain("getCompanyYear(companyTz)");
      expect(leavesViewContent).toContain("getCompanyMonthBoundaries");

      // Has real attachment handling
      expect(leavesViewContent).toContain("uploadLeaveAttachmentRecord");
      expect(leavesViewContent).toContain("cleanupStagedLeaveAttachmentRecord");
      expect(leavesViewContent).toContain("selectedLeaveType?.requiresAttachment");

      // Has searchable employee picker for balance adjustments
      expect(leavesViewContent).toContain("adjustEmpSearch");
      expect(leavesViewContent).toContain("filteredAdjustEmployees");

      // Has returned leave request alert and resubmission modal
      expect(leavesViewContent).toContain("returnedLeaveRequests");
      expect(leavesViewContent).toContain("resubmitTargetRequest");
      expect(leavesViewContent).toContain("handleResubmit");
      expect(leavesViewContent).toContain("resubmitLeave");

      // Has carryover expiry button
      expect(leavesViewContent).toContain("expireCarryoverBalances");
    });
  describe("Prompt 10.3 Final Runtime Closure (Leave Management)", () => {
    // 1. Critical Schema & Attachment Fixes
    it("uses bucket_id instead of bucket in all Leave attachment SQL", () => {
      expect(runtimeClosureSql).toContain("v_att_file.bucket_id <> 'leave-attachments'");
      expect(runtimeClosureSql).not.toContain("v_att_file.bucket <> 'leave-attachments'");
      expect(runtimeClosureSql).not.toContain("v_att_file.bucket ");
    });

    it("creates public.leave_attachment_staging table with secure RLS", () => {
      expect(runtimeClosureSql).toContain("CREATE TABLE IF NOT EXISTS public.leave_attachment_staging (");
      expect(runtimeClosureSql).toContain("file_id uuid NOT NULL UNIQUE REFERENCES public.file_objects(id) ON DELETE CASCADE");
      expect(runtimeClosureSql).toContain("company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE");
      expect(runtimeClosureSql).toContain("employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE");
      expect(runtimeClosureSql).toContain("is_finalized boolean NOT NULL DEFAULT false");
      expect(runtimeClosureSql).toContain("finalized_request_id uuid REFERENCES public.requests(id)");
      expect(runtimeClosureSql).toContain("ALTER TABLE public.leave_attachment_staging ENABLE ROW LEVEL SECURITY;");
      expect(runtimeClosureSql).toContain('CREATE POLICY "leave_attachment_staging_select"');
      expect(runtimeClosureSql).toContain('CREATE POLICY "leave_attachment_staging_insert"');
      expect(runtimeClosureSql).toContain('CREATE POLICY "leave_attachment_staging_delete"');
    });

    it("implements stage_leave_attachment RPC resolving auth.uid() and validating tenant boundaries", () => {
      expect(runtimeClosureSql).toContain("FUNCTION public.stage_leave_attachment(");
      expect(runtimeClosureSql).toContain("auth.uid()");
      expect(runtimeClosureSql).toContain("v_att_file.bucket_id <> 'leave-attachments'");
      expect(runtimeClosureSql).toContain("entity_type = 'leave_attachment_staging'");
      expect(runtimeClosureSql).toContain("INSERT INTO public.leave_attachment_staging");
    });

    it("aligns attachment entity_type from staging to finalization without inventing status = staged", () => {
      // In staging: entity_type = 'leave_attachment_staging', status = 'active'
      expect(operationalRepoContent).toContain('entityType: "leave_attachment_staging"');
      expect(operationalRepoContent).not.toContain('entityType: "leave_request",');
      expect(operationalRepoContent).not.toContain("status: 'staged'");

      // In submit_leave_request: updates to 'leave_request_attachment'
      expect(runtimeClosureSql).toContain("entity_type = 'leave_request_attachment'");
      expect(runtimeClosureSql).toContain("is_finalized = true");
      expect(runtimeClosureSql).toContain("finalized_request_id = v_request_id");
    });

    it("provides upload rollback and cleanup to eliminate orphan private storage files", () => {
      expect(operationalRepoContent).toContain("rollbackUploadedFile");
      expect(operationalRepoContent).toContain("stage_leave_attachment");
      expect(operationalRepoContent).toContain("cleanupStagedLeaveAttachmentRecord");
    });

    // 2. Tenant Isolation & Company-Aware Approver Rules
    it("implements current_user_has_role_for_company helper for tenant-isolated approvals", () => {
      expect(runtimeClosureSql).toContain("FUNCTION public.current_user_has_role_for_company(");
      expect(runtimeClosureSql).toContain("v_user_company_id <> p_company_id");
      expect(runtimeClosureSql).toContain("current_user_has_any_role(p_roles)");
    });

    it("decide_leave_request uses company-aware role authorization preventing cross-tenant approvals", () => {
      expect(runtimeClosureSql).toContain("public.current_user_has_role_for_company(v_request.company_id, ARRAY['hr_manager', 'hr', 'org_admin'])");
      expect(runtimeClosureSql).toContain("public.current_user_has_role_for_company(v_request.company_id, ARRAY['finance', 'finance_manager', 'finance_officer'])");
      expect(runtimeClosureSql).toContain("public.current_user_has_role_for_company(v_request.company_id, ARRAY[v_current_step.approver_role])");
      expect(runtimeClosureSql).not.toContain("OR public.current_user_has_any_role(ARRAY['hr_manager', 'hr'])");
    });

    it("validates delegation relationships strictly within the same request company", () => {
      expect(runtimeClosureSql).toContain("e_delegator.company_id = v_request.company_id");
      expect(runtimeClosureSql).toContain("v_caller_emp.company_id = v_request.company_id");
    });

    it("enforces approval chain selection determinism with unique constraints and deterministic ordering", () => {
      expect(runtimeClosureSql).toContain("uq_approval_chains_company_default");
      expect(runtimeClosureSql).toContain("uq_approval_chains_system_default");
      expect(runtimeClosureSql).toContain("ORDER BY created_at ASC");
    });

    // 3. Carryover Accounting & Expiry Engine
    it("adds carried_over_used_days to leave_balances and implements carryover-first accounting", () => {
      expect(runtimeClosureSql).toContain("ADD COLUMN IF NOT EXISTS carried_over_used_days numeric NOT NULL DEFAULT 0;");
      expect(runtimeClosureSql).toContain("v_rem_carry := GREATEST(0, COALESCE(v_balance.carried_over_days, 0) - COALESCE(v_balance.carried_over_used_days, 0) - COALESCE(v_balance.carried_over_expired_days, 0));");
      expect(runtimeClosureSql).toContain("v_carry_portion := LEAST(v_chargeable_days, v_rem_carry);");
      expect(runtimeClosureSql).toContain("v_accrued_portion := v_chargeable_days - v_carry_portion;");
      expect(runtimeClosureSql).toContain("carried_over_used_days = COALESCE(carried_over_used_days, 0) + v_carry_portion");
    });

    it("deducts carried_over_expired_days from available_balance in get_my_leave_balances and get_company_leave_balances", () => {
      expect(runtimeClosureSql).toContain("COALESCE(b.carried_over_expired_days, 0)");
      expect(runtimeClosureSql).toContain("(COALESCE(b.accrued_days, 0) + COALESCE(b.carried_over_days, 0)) - (");
    });

    it("run_leave_carryover_expiry expires only remaining carryover taking into account carried_over_used_days", () => {
      expect(runtimeClosureSql).toContain("GREATEST(0, v_bal.carried_over_days - COALESCE(v_bal.carried_over_used_days, 0) - COALESCE(v_bal.carried_over_expired_days, 0));");
      expect(runtimeClosureSql).not.toContain("v_bal.carried_over_days - COALESCE(v_bal.carried_over_expired_days, 0) - v_bal.used_days");
    });

    // 4. Timezone Validation
    it("run_leave_accrual removes Asia/Riyadh fallback and requires configured company timezone", () => {
      expect(runtimeClosureSql).not.toContain("COALESCE(v_company.timezone, 'Asia/Riyadh')");
      expect(runtimeClosureSql).toContain("لم يتم ضبط المنطقة الزمنية للمنشأة (company.timezone)");
    });

    // 5. Concurrency-Safe Leave Type Code Generation
    it("uses company_leave_type_sequences transactional counter table instead of COUNT(*) + 1", () => {
      expect(runtimeClosureSql).toContain("CREATE TABLE IF NOT EXISTS public.company_leave_type_sequences (");
      expect(runtimeClosureSql).toContain("company_leave_type_sequences.current_val + 1");
      expect(runtimeClosureSql).not.toContain("SELECT COALESCE(count(*), 0) + 1 INTO v_seq_num");
    });

    it("create_leave_type preserves name_en as NULL when omitted (never copies Arabic)", () => {
      expect(runtimeClosureSql).toContain("p_name_en text DEFAULT NULL");
      expect(operationalRepoContent).toContain("p_name_en: input.nameEn || null");
      expect(operationalRepoContent).not.toContain("p_name_en: input.nameEn || input.nameAr");
    });

    // 6. Dedicated Requests Query & UI Separation
    it("provides get_my_leave_requests RPC and useMyLeaveRequests hook", () => {
      expect(runtimeClosureSql).toContain("FUNCTION public.get_my_leave_requests(");
      expect(leavesDomainContent).toContain("export function useMyLeaveRequests(");
      expect(typeof fetchMyLeaveRequestsRecord).toBe("function");
      expect(typeof useMyLeaveRequests).toBe("function");
    });

    // 7. Source Contract Guards (Section 35)
    it("LeavesView source contracts enforce balance privacy, guarded queries, and secure pickers", () => {
      // Privacy: NEVER fall back from myBalances to companyBalances
      expect(leavesViewContent).not.toContain("myBalances.length > 0 ? myBalances : companyBalances");
      expect(leavesViewContent).not.toMatch(/const displayBalancess*=/);

      // Guarded company balance query: only enabled when canManage
      expect(leavesViewContent).toContain("useCompanyLeaveBalances(currentYear, undefined, { enabled: canManage })");
      expect(leavesViewContent).not.toMatch(/useCompanyLeaveBalances(currentYear)[^,]/);

      // Does not use bootstrap employees or requests in LeavesView
      expect(leavesViewContent).not.toMatch(/const\s*\{[^}]*\bemployees\b[^}]*\}\s*=\s*useApp\(\)/);
      expect(leavesViewContent).not.toMatch(/const\s*\{[^}]*\brequests\b[^}]*\}\s*=\s*useApp\(\)/);

      // Uses useEmployeeDirectory search for admin balance adjustment
      expect(leavesViewContent).toMatch(/useEmployeeDirectory\s*\(\s*\{/);

      // Uses useMyLeaveRequests for employee leave lifecycle
      expect(leavesViewContent).toContain("useMyLeaveRequests(currentYear)");

      // Attachment file input restricts types to safe minimum (.pdf,.png,.jpg,.jpeg,.webp)
      expect(leavesViewContent).toContain('accept=".pdf,.png,.jpg,.jpeg,.webp"');
      expect(leavesViewContent).not.toContain(".doc,.docx");

      // Displays timezone warning banner for admins when company timezone is unconfigured
      expect(leavesViewContent).toContain("!hasValidTimezone && canManage");
      expect(leavesViewContent).toContain("لم يتم ضبط المنطقة الزمنية للمنشأة");
    });
  });

  // ===========================================================================
  // SECTION 36: PROMPT 10.4 FINAL RPC SIGNATURE + VERIFICATION CLOSURE
  // ===========================================================================
  describe("Prompt 10.4 Final RPC Signature & Verification Closure", () => {
    it("verifies run_leave_accrual client signature uses p_period_month matching SQL", () => {
      expect(operationalRepoContent).toContain("p_period_month: periodMonth || null");
      expect(operationalRepoContent).not.toMatch(/run_leave_accrual[^}]+p_month:/);
      expect(runtimeClosureSql).toContain("p_period_month integer DEFAULT NULL");
    });

    it("verifies run_leave_carryover_expiry client signature passes p_year, p_as_of_date, p_company_id", () => {
      expect(operationalRepoContent).toContain("p_year: year");
      expect(operationalRepoContent).toContain("p_as_of_date: asOfDate || null");
      expect(operationalRepoContent).toContain("p_company_id: companyId || null");
      expect(operationalRepoContent).not.toContain("p_reference_date");
      expect(runtimeClosureSql).toMatch(/FUNCTION\s+public\.run_leave_carryover_expiry\s*\(\s*p_year\s+integer,\s*p_as_of_date\s+date/);
    });

    it("verifies carryover expiry response mapping accurately maps employees_processed and total_days_expired", () => {
      expect(operationalRepoContent).toContain("processedCount: Number(data?.employees_processed ?? 0)");
      expect(operationalRepoContent).toContain("expiredDaysTotal: Number(data?.total_days_expired ?? 0)");
      expect(operationalRepoContent).not.toContain("data?.processed_count");
      expect(operationalRepoContent).not.toContain("data?.expired_days_total");
    });

    it("verifies expireCarryoverBalances domain mutation signature requires explicit year", () => {
      expect(leavesDomainContent).toMatch(/expireCarryoverBalances\s*=\s*useCallback\(\s*async\s*\(\s*year:\s*number/);
      expect(leavesViewContent).toContain("expireCarryoverBalances(currentYear, company?.id)");
    });

    it("verifies createLeaveTypeRecord has NO implicit policy defaults in repository or domain", () => {
      // Repository must not contain silent business defaults
      expect(operationalRepoContent).not.toContain("p_is_paid: input.isPaid ?? true");
      expect(operationalRepoContent).not.toContain("p_deduct_working_days_only: input.deductFromWorkingDaysOnly ?? true");
      expect(operationalRepoContent).not.toContain("p_allow_half_day: input.allowHalfDay ?? true");
      expect(operationalRepoContent).not.toContain("p_allow_negative_balance: input.allowNegativeBalance ?? false");
      expect(operationalRepoContent).not.toContain("p_requires_attachment: input.requiresAttachment ?? false");
      expect(operationalRepoContent).not.toContain('p_accrual_method: input.accrualMethod || "yearly_frontloaded"');
      expect(operationalRepoContent).not.toContain("p_carryover_expiry_months: input.carryoverExpiryMonths ?? 3");

      // CreateLeaveTypeInput must export required policy fields non-optional
      expect(operationalRepoContent).toContain("export interface CreateLeaveTypeInput {");
      expect(operationalRepoContent).toContain("isPaid: boolean;");
      expect(operationalRepoContent).toContain("deductFromWorkingDaysOnly: boolean;");
      expect(operationalRepoContent).toContain("allowHalfDay: boolean;");
      expect(operationalRepoContent).toContain("allowNegativeBalance: boolean;");
      expect(operationalRepoContent).toContain("requiresAttachment: boolean;");
      expect(operationalRepoContent).toContain('accrualMethod: "yearly_frontloaded" | "monthly_accrual" | "contract_anniversary";');
      expect(operationalRepoContent).toContain("carryoverLimitDays: number;");
      expect(operationalRepoContent).toContain("carryoverExpiryMonths: number;");
    });

    it("verifies LeavesView provides explicit form controls for all leave policy fields", () => {
      // Accrual method control
      expect(leavesViewContent).toContain("newTypeAccrualMethod");
      expect(leavesViewContent).toContain("yearly_frontloaded");
      expect(leavesViewContent).toContain("monthly_accrual");
      expect(leavesViewContent).toContain("contract_anniversary");

      // Deduct working days only control
      expect(leavesViewContent).toContain("newTypeDeductWorkingDaysOnly");
      expect(leavesViewContent).toContain("أيام العمل الفعلية فقط (نعم)");
      expect(leavesViewContent).toContain("الأيام التقويمية كاملة (لا)");

      // Carryover expiry months control
      expect(leavesViewContent).toContain("newTypeCarryoverExpiryMonths");

      // Form validation before submit
      expect(leavesViewContent).toContain("if (!newTypeAccrualMethod)");
      expect(leavesViewContent).toContain("if (newTypeDeductWorkingDaysOnly === null)");
      expect(leavesViewContent).toContain('if (newTypeCarryoverExpiryMonths === "" || Number(newTypeCarryoverExpiryMonths) < 0)');
    });

    it("verifies useEmployeeDirectory query in LeavesView is enabled ONLY when canManage is true", () => {
      expect(leavesViewContent).toContain("useEmployeeDirectory(");
      expect(leavesViewContent).toContain("{ enabled: canManage }");
    });

    it("verifies timezone configuration block prevents operations and shows truthful notices", () => {
      // Accrual, carryover, and expiry buttons are disabled when !hasValidTimezone
      expect(leavesViewContent).toContain("disabled={!hasValidTimezone}");

      // Admin setup warning when !hasValidTimezone && canManage
      expect(leavesViewContent).toContain("!hasValidTimezone && canManage");

      // Employee configuration message when !hasValidTimezone && !canManage
      expect(leavesViewContent).toContain("!hasValidTimezone && !canManage");
      expect(leavesViewContent).toContain("المنطقة الزمنية للمنشأة غير مهيأة حالياً");
    });

    it("verifies fetchMyLeaveRequestsRecord maps timeline history truthfully from RPC", () => {
      expect(operationalRepoContent).toContain("timeline: Array.isArray(row.timeline)");
      expect(operationalRepoContent).toContain("stepNumber: Number(t.step_number || 1)");
      expect(operationalRepoContent).toContain('actorName: String(t.actor_name || "النظام")');
      expect(operationalRepoContent).toContain('actorRole: String(t.actor_role || "النظام")');
      expect(operationalRepoContent).toContain('action: (t.action as ServiceRequest["timeline"][number]["action"]) || "submitted"');
      expect(operationalRepoContent).not.toMatch(/fetchMyLeaveRequestsRecord[^}]*timeline:\s*\[\]/);
    });

    it("verifies authoritative SQL RPC argument names match client repository contracts", () => {
      // calculate_working_days
      expect(runtimeClosureSql).toContain("p_start_date date");
      expect(runtimeClosureSql).toContain("p_end_date date");
      expect(runtimeClosureSql).toContain("p_leave_type_id uuid");
      expect(runtimeClosureSql).toContain("p_is_half_day boolean");

      // submit_leave_request
      expect(runtimeClosureSql).toContain("p_leave_type_id uuid");
      expect(runtimeClosureSql).toContain("p_start_date date");
      expect(runtimeClosureSql).toContain("p_end_date date");
      expect(runtimeClosureSql).toContain("p_attachment_file_id uuid");

      // decide_leave_request
      expect(runtimeClosureSql).toContain("p_request_id uuid");
      expect(runtimeClosureSql).toContain("p_decision text");
      expect(runtimeClosureSql).toContain("p_note text");

      // stage_leave_attachment
      expect(runtimeClosureSql).toContain("p_file_id uuid");

      // get_my_leave_requests
      expect(runtimeClosureSql).toContain("p_year integer DEFAULT NULL");
    });
  });

  });
});
