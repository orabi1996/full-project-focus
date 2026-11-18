import { describe, expect, it, vi } from "vitest";
import { readPayrollRows, readPayrollEmployeeRows } from "../lib/business/payroll-data";

describe("complete payroll input loading", () => {
  it("loads beyond 1000 records in stable pages without dropping the last page", async () => {
    const rows = Array.from({ length: 2501 }, (_, id) => ({ id }));
    const ranges: number[][] = [];
    const build = () => ({ order: () => ({ range: async (start: number, end: number) => {
      ranges.push([start, end]); return { data: rows.slice(start, end + 1), error: null };
    } }) });
    expect(await readPayrollRows(build, "test")).toEqual(rows);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("bounds ID lists and retains data from all batches", async () => {
    const ids = Array.from({ length: 817 }, (_, i) => String(i));
    const sizes: number[] = [];
    const build = (batch: string[]) => ({ order: () => ({ range: async () => {
      sizes.push(batch.length); return { data: batch.map(id => ({ id })), error: null };
    } }) });
    expect(await readPayrollEmployeeRows(ids, build, "test")).toHaveLength(817);
    expect(Math.max(...sizes)).toBe(100);
    expect(sizes.at(-1)).toBe(17);
  });
  it("propagates an error on a later page instead of calculating with partial inputs", async () => {
    const build = () => ({ order: () => ({ range: async (start: number) => start === 0
      ? { data: Array(1000).fill({ id: "row" }), error: null }
      : { data: null, error: { message: "read failed" } } }) });
    await expect(readPayrollRows(build, "test")).rejects.toThrow("read failed");
  });
  it("avoids requests for empty employee lists", async () => {
    const build = vi.fn();
    expect(await readPayrollEmployeeRows([], build, "test")).toEqual([]);
    expect(build).not.toHaveBeenCalled();
  });
});
