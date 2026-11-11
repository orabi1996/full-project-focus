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

  describe("1. Database-owned monthly accrual", () => {
    const result = { success: true, year: 2026, period_month: 10, total_processed: 1, total_days_credited: 2.5, already_processed: false };
    function db(data = result) {
      return { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [{ id: "comp-1" }], error: null }) }) }), rpc: vi.fn().mockResolvedValue({ data, error: null }) };
    }
    it("passes the exact company and period to the atomic RPC", async () => {
      const client = db();
      const rows = await executeAutomatedMonthlyLeaveAccrual(client, { companyId: "comp-1", year: 2026, month: 10 });
      expect(rows[0]).toMatchObject({ employeesProcessed: 1, totalDaysAccrued: 2.5, alreadyProcessed: false });
      expect(client.rpc).toHaveBeenCalledExactlyOnceWith("run_leave_accrual", { p_company_id: "comp-1", p_year: 2026, p_period_month: 10 });
      expect(client.from).toHaveBeenCalledExactlyOnceWith("companies");
    });
    it("preserves a replay result without reporting prior credits as new work", async () => {
      const rows = await executeAutomatedMonthlyLeaveAccrual(db({ ...result, total_processed: 0, total_days_credited: 0, already_processed: true }), { companyId: "comp-1" });
      expect(rows[0]).toMatchObject({ employeesProcessed: 0, totalDaysAccrued: 0, alreadyProcessed: true });
    });
    it("lets the database resolve omitted dates from company timezone", async () => {
      const client = db();
      await executeAutomatedMonthlyLeaveAccrual(client, { companyId: "comp-1" });
      expect(client.rpc).toHaveBeenCalledWith("run_leave_accrual", { p_company_id: "comp-1", p_year: null, p_period_month: null });
    });
    it("rejects unconfirmed RPC responses", async () => {
      await expect(executeAutomatedMonthlyLeaveAccrual(db({ ...result, success: false }), { companyId: "comp-1" })).rejects.toThrow("تعذر تأكيد");
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
                return {
                  eq: vi.fn().mockReturnThis(),
                  select: vi.fn().mockReturnThis(),
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "claimed-job" }, error: null }),
                  single: vi.fn().mockResolvedValue({ data: { id: "claimed-job" }, error: null }),
                };
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
                return {
                  eq: vi.fn().mockReturnThis(),
                  select: vi.fn().mockReturnThis(),
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "claimed-job" }, error: null }),
                  single: vi.fn().mockResolvedValue({ data: { id: "claimed-job" }, error: null }),
                };
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
