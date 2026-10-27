import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeAutomatedMonthlyLeaveAccrual,
  executeAutomatedDailyAttendanceRollup,
  processQueuedBackgroundJobs,
} from "../lib/business/cron.functions";

describe("Automated Cron & Background Worker Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Monthly Leave Accrual Automation & Idempotency", () => {
    it("accrues 1/12th of annual entitlement and logs immutable ledger transaction", async () => {
      const companies = [{ id: "comp-1", name_ar: "شركة التقنية" }];
      const leaveTypes = [
        { id: "lt-annual", code: "annual", name_ar: "إجازة سنوية", annual_days: 30, accrual_method: "monthly_accrual" },
      ];
      const employees = [{ id: "emp-101", user_id: "usr-101", status: "active" }];
      const balance = {
        id: "bal-101",
        annual_entitlement: 30,
        accrued_days: 5.0,
        used_days: 1.0,
        reserved_days: 0.0,
        carried_over_days: 5.0,
      };

      const insertedTransactions: any[] = [];
      const insertedRuns: any[] = [];
      const updatedBalances: any[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "companies") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: companies, error: null }),
                data: companies,
                error: null,
              }),
            };
          }
          if (table === "leave_types") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: leaveTypes, error: null }),
                }),
              }),
            };
          }
          if (table === "leave_accrual_runs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: null }), // No previous run
                      }),
                    }),
                  }),
                }),
              }),
              insert: vi.fn().mockImplementation((record) => {
                insertedRuns.push(record);
                return Promise.resolve({ error: null });
              }),
            };
          }
          if (table === "employees") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: employees, error: null }),
                }),
              }),
            };
          }
          if (table === "leave_balances") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: balance }),
                  }),
                }),
              }),
              update: vi.fn().mockImplementation((updates) => {
                updatedBalances.push(updates);
                return {
                  eq: vi.fn().mockResolvedValue({ error: null }),
                };
              }),
            };
          }
          if (table === "leave_balance_transactions") {
            return {
              insert: vi.fn().mockImplementation((record) => {
                insertedTransactions.push(record);
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }),
        rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
      };

      const result = await executeAutomatedMonthlyLeaveAccrual(mockSupabase as any, {
        companyId: "comp-1",
        year: 2026,
        month: 10,
        actorUserId: "sys-cron",
      });

      expect(result).toHaveLength(1);
      expect(result[0].ok).toBe(true);
      expect(result[0].alreadyProcessed).toBe(false);
      expect(result[0].employeesProcessed).toBe(1);
      // 30 / 12 = 2.5
      expect(result[0].totalDaysAccrued).toBe(2.5);

      // Verify balance update: accrued 5.0 + 2.5 = 7.5, balance = 7.5 - 1 - 0 = 6.5
      expect(updatedBalances).toHaveLength(1);
      expect(updatedBalances[0].accrued_days).toBe(7.5);
      expect(updatedBalances[0].balance).toBe(6.5);

      // Verify immutable ledger transaction
      expect(insertedTransactions).toHaveLength(1);
      expect(insertedTransactions[0].transaction_type).toBe("accrual");
      expect(insertedTransactions[0].days).toBe(2.5);
      expect(insertedTransactions[0].employee_id).toBe("emp-101");

      // Verify idempotency record in leave_accrual_runs
      expect(insertedRuns).toHaveLength(1);
      expect(insertedRuns[0].period_year).toBe(2026);
      expect(insertedRuns[0].period_month).toBe(10);
      expect(insertedRuns[0].employees_processed).toBe(1);
      expect(insertedRuns[0].total_days_accrued).toBe(2.5);
    });

    it("prevents double-accrual when run already executed for the same month", async () => {
      const companies = [{ id: "comp-1", name_ar: "شركة التقنية" }];
      const leaveTypes = [
        { id: "lt-annual", code: "annual", name_ar: "إجازة سنوية", annual_days: 30, accrual_method: "monthly_accrual" },
      ];
      const existingRun = {
        id: "run-existing",
        employees_processed: 5,
        total_days_accrued: 12.5,
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "companies") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: companies, error: null }),
              }),
            };
          }
          if (table === "leave_types") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: leaveTypes, error: null }),
                }),
              }),
            };
          }
          if (table === "leave_accrual_runs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: existingRun }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
      };

      const result = await executeAutomatedMonthlyLeaveAccrual(mockSupabase as any, {
        companyId: "comp-1",
        year: 2026,
        month: 10,
      });

      expect(result).toHaveLength(1);
      expect(result[0].alreadyProcessed).toBe(true);
      expect(result[0].employeesProcessed).toBe(5);
      expect(result[0].totalDaysAccrued).toBe(12.5);
    });

    it("enforces statutory cap at entitlement + carried_over_days", async () => {
      const companies = [{ id: "comp-1", name_ar: "شركة التقنية" }];
      const leaveTypes = [
        { id: "lt-annual", code: "annual", name_ar: "إجازة سنوية", annual_days: 30, accrual_method: "monthly_accrual" },
      ];
      const employees = [{ id: "emp-capped", user_id: "usr-c", status: "active" }];
      // Employee already near cap: entitlement (30) + carried (5) = 35 max. Currently at 34.
      const balance = {
        id: "bal-capped",
        annual_entitlement: 30,
        accrued_days: 34.0,
        used_days: 10.0,
        reserved_days: 0.0,
        carried_over_days: 5.0,
      };

      const updatedBalances: any[] = [];
      const insertedTransactions: any[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "companies") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: companies, error: null }),
              }),
            };
          }
          if (table === "leave_types") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: leaveTypes, error: null }),
                }),
              }),
            };
          }
          if (table === "leave_accrual_runs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                      }),
                    }),
                  }),
                }),
              }),
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === "employees") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: employees, error: null }),
                }),
              }),
            };
          }
          if (table === "leave_balances") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: balance }),
                  }),
                }),
              }),
              update: vi.fn().mockImplementation((updates) => {
                updatedBalances.push(updates);
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === "leave_balance_transactions") {
            return {
              insert: vi.fn().mockImplementation((record) => {
                insertedTransactions.push(record);
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
      };

      const result = await executeAutomatedMonthlyLeaveAccrual(mockSupabase as any, {
        companyId: "comp-1",
        year: 2026,
        month: 11,
      });

      // Max is 35. 34 + 2.5 would be 36.5, so capped at 35.0 (+1.0 added)
      expect(result[0].totalDaysAccrued).toBe(1.0);
      expect(updatedBalances[0].accrued_days).toBe(35.0);
      expect(insertedTransactions[0].days).toBe(1.0);
    });
  });

  describe("2. Daily Attendance Rollup Automation", () => {
    it("processes all active employees for yesterday by default", async () => {
      const employees = [
        { id: "emp-1", company_id: "comp-1", status: "active" },
        { id: "emp-2", company_id: "comp-1", status: "active" },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "employees") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: employees, error: null }),
                }),
              }),
            };
          }
          if (table === "punches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue({
                      lte: vi.fn().mockReturnValue({
                        order: vi.fn().mockResolvedValue({ data: [], error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "attendance_records") {
            return {
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                  }),
                }),
              }),
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }),
        rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
      };

      const result = await executeAutomatedDailyAttendanceRollup(mockSupabase as any, {
        companyId: "comp-1",
        date: "2026-10-26",
      });

      expect(result.ok).toBe(true);
      expect(result.date).toBe("2026-10-26");
      expect(result.employeesProcessed).toBe(2);
      expect(result.errorsCount).toBe(0);
    });
  });

  describe("3. Background Job Queue Worker & Dead-Letter Escalation", () => {
    it("processes queued jobs and updates status to completed", async () => {
      const queuedJobs = [
        {
          id: "job-1",
          company_id: "comp-1",
          job_type: "evaluate_task_slas",
          payload: {},
          priority: 1,
          attempts: 0,
          max_attempts: 3,
        },
      ];

      const updatedJobStatuses: any[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "background_jobs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          eq: vi.fn().mockResolvedValue({ data: queuedJobs, error: null }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
              update: vi.fn().mockImplementation((updates) => {
                updatedJobStatuses.push(updates);
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({ data: { evaluated_count: 3 }, error: null }),
      };

      const result = await processQueuedBackgroundJobs(mockSupabase as any, {
        companyId: "comp-1",
        batchSize: 5,
      });

      expect(result.ok).toBe(true);
      expect(result.jobsProcessed).toBe(1);
      expect(result.completedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      // Status transitions: first "running", then "completed"
      expect(updatedJobStatuses[0].status).toBe("running");
      expect(updatedJobStatuses[1].status).toBe("completed");
    });

    it("moves jobs to dead_letter when max attempts are exceeded", async () => {
      const failingJobs = [
        {
          id: "job-fail-final",
          company_id: "comp-1",
          job_type: "monthly_leave_accrual",
          payload: { year: 2026, month: 10 },
          priority: 2,
          attempts: 2, // will become 3
          max_attempts: 3,
        },
      ];

      const updatedJobStatuses: any[] = [];
      const deadLetterInserts: any[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "background_jobs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          eq: vi.fn().mockResolvedValue({ data: failingJobs, error: null }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
              update: vi.fn().mockImplementation((updates) => {
                updatedJobStatuses.push(updates);
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === "dead_letter_jobs") {
            return {
              insert: vi.fn().mockImplementation((record) => {
                deadLetterInserts.push(record);
                return Promise.resolve({ error: null });
              }),
            };
          }
          if (table === "companies") {
            // Throw error to trigger job failure
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, error: new Error("Database network failure") }),
              }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const result = await processQueuedBackgroundJobs(mockSupabase as any, {
        companyId: "comp-1",
      });

      expect(result.jobsProcessed).toBe(1);
      expect(result.completedCount).toBe(0);
      expect(result.deadLetterCount).toBe(1);

      // Verify dead letter escalation
      expect(updatedJobStatuses[1].status).toBe("dead_letter");
      expect(deadLetterInserts).toHaveLength(1);
      expect(deadLetterInserts[0].job_id).toBe("job-fail-final");
      expect(deadLetterInserts[0].attempts_made).toBe(3);
    });
  });
});
