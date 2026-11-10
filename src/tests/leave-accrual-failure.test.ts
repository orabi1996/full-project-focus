import { describe, expect, it, vi } from "vitest";
import { executeLeaveAccrual } from "../lib/business/leave-accrual";

describe("database-owned leave accrual", () => {
  it.each([0, 12])("preserves the actual processed count %s", async (count) => {
    const rpc = vi.fn().mockResolvedValue({ data: { success: true, total_processed: count }, error: null });
    expect(await executeLeaveAccrual({ rpc }, { year: 2026 })).toEqual({ updated: count });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("run_leave_accrual", { p_year: 2026 });
  });
  it("stops after a returned database error without direct balance access", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } }), from: vi.fn() };
    await expect(executeLeaveAccrual(db, { year: 2026 })).rejects.toThrow("denied");
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not retry ambiguous transport failures", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("connection lost"));
    await expect(executeLeaveAccrual({ rpc }, { year: 2026 })).rejects.toThrow("connection lost");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([null, {}, { success: false, total_processed: 1 }, { success: true }, { success: true, total_processed: -1 }])("rejects an unconfirmed result %j", async (data) => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    await expect(executeLeaveAccrual({ rpc }, { year: 2026 })).rejects.toThrow("تعذر تأكيد");
  });
  it.each([0, 2, -1])("rejects unsupported month multiplier %s before mutation", async (months) => {
    const rpc = vi.fn();
    await expect(executeLeaveAccrual({ rpc }, { year: 2026, months })).rejects.toThrow("لفترة واحدة");
    expect(rpc).not.toHaveBeenCalled();
  });
});
