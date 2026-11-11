import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ middleware: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }) }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/business/attendance.functions", () => ({ recomputeDay: vi.fn() }));
import { executeAutomatedMonthlyLeaveAccrual, processQueuedBackgroundJobs } from "../lib/business/cron.functions";

type Response = { data?: unknown; error?: { message: string } | null };
function client(responses: Response[]) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "lte", "order", "limit", "update", "insert", "maybeSingle", "single"]) {
      chain[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return chain; };
    }
    chain.then = (resolve: (value: Response) => void) => {
      if (!responses.length) throw new Error("Unexpected database request");
      return Promise.resolve(resolve(responses.shift()!));
    };
    return chain;
  };
  return { from, rpc: vi.fn(async () => responses.shift()!), calls };
}
const job = { id: "job-1", company_id: "company-1", job_type: "evaluate_task_slas", attempts: 0, max_attempts: 3 };
const ok = { data: null, error: null };

describe("scheduled job failure reporting", () => {
  it("does not disguise a queue database failure as an empty successful batch", async () => {
    await expect(processQueuedBackgroundJobs(client([{ error: { message: "unavailable" } }]))).rejects.toThrow("unavailable");
  });
  it("skips a job claimed by another worker", async () => {
    const db = client([{ data: [job] }, { data: null }]);
    expect(await processQueuedBackgroundJobs(db)).toMatchObject({ jobsProcessed: 0, completedCount: 0 });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.calls).toContainEqual({ table: "background_jobs", method: "eq", args: ["status", "queued"] });
    expect(db.calls).toContainEqual({ table: "background_jobs", method: "eq", args: ["attempts", 0] });
  });
  it("records a returned RPC error as failure, without reporting completion", async () => {
    const db = client([{ data: [job] }, { data: { id: job.id } }, { error: { message: "SLA failed" } }, ok]);
    expect(await processQueuedBackgroundJobs(db)).toMatchObject({ ok: false, jobsProcessed: 1, failedCount: 1, completedCount: 0 });
    expect(db.calls.some(c => c.method === "update" && (c.args[0] as { status: string }).status === "completed")).toBe(false);
  });
  it("rejects unknown job types instead of silently completing them", async () => {
    const db = client([{ data: [{ ...job, job_type: "unknown" }] }, { data: { id: job.id } }, ok]);
    expect(await processQueuedBackgroundJobs(db)).toMatchObject({ ok: false, failedCount: 1, completedCount: 0 });
  });
  it("only counts completion after database confirmation", async () => {
    const db = client([{ data: [job] }, { data: { id: job.id } }, ok, { error: { message: "completion failed" } }, ok]);
    expect(await processQueuedBackgroundJobs(db)).toMatchObject({ ok: false, failedCount: 1, completedCount: 0 });
  });
  it("surfaces failure-state persistence errors", async () => {
    const db = client([{ data: [{ ...job, job_type: "unknown" }] }, { data: { id: job.id } }, { error: { message: "write failed" } }]);
    await expect(processQueuedBackgroundJobs(db)).rejects.toThrow("write failed");
  });
  it("surfaces dead-letter insertion errors", async () => {
    const db = client([{ data: [{ ...job, job_type: "unknown", max_attempts: 1 }] }, { data: { id: job.id } }, ok, { error: { message: "dead letter failed" } }]);
    await expect(processQueuedBackgroundJobs(db)).rejects.toThrow("dead letter failed");
  });
  it("counts a successfully persisted completion", async () => {
    const db = client([{ data: [job] }, { data: { id: job.id } }, ok, { data: { id: job.id } }]);
    expect(await processQueuedBackgroundJobs(db)).toMatchObject({ ok: true, jobsProcessed: 1, completedCount: 1 });
  });
  it.each(["balance update", "ledger insert", "run insert"])("propagates RPC failure at %s without fallback writes", async (step) => {
    const db = client([{ data: [{ id: "company-1" }] }, { error: { message: `${step} failed` } }]);
    await expect(executeAutomatedMonthlyLeaveAccrual(db)).rejects.toThrow(`${step} failed`);
    expect(db.calls.every(c => c.table === "companies")).toBe(true);
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
});
