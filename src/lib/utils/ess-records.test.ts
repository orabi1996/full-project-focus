import { describe, it, expect } from "vitest";
import { employeeLeaveBalances, latestEmployeePayroll } from "./ess-records";
import type { EmployeeLeaveBalance, EmployeePayrollDetail, PayrollRun } from "../../types";
describe("ESS employee and period selection", () => {
  it("selects the employee's latest published period despite broad admin access and unordered rows", () => {
    const runs = [
      { id: "old", periodYear: 2025, periodMonth: 12, status: "paid" },
      { id: "new", periodYear: 2026, periodMonth: 1, status: "confirmed_locked" },
      { id: "draft", periodYear: 2026, periodMonth: 2, status: "draft" },
    ] as PayrollRun[];
    const rows = [
      { employeeId: "other", payrollRunId: "new" },
      { employeeId: "me", payrollRunId: "old" },
      { employeeId: "me", payrollRunId: "draft" },
      { employeeId: "me", payrollRunId: "new" },
    ] as EmployeePayrollDetail[];
    expect(latestEmployeePayroll("me", rows, runs)).toBe(rows[3]);
    expect(latestEmployeePayroll("", rows, runs)).toBeUndefined();
    expect(latestEmployeePayroll("unlinked", rows, runs)).toBeUndefined();
  });
  it("does not use another employee's leave balance or unscoped live rows", () => {
    const rows = [{ employeeId: "other" }, { employeeId: "me" }, {}] as EmployeeLeaveBalance[];
    expect(employeeLeaveBalances("me", rows)).toEqual([rows[1]]);
    expect(employeeLeaveBalances("me", rows, true)).toEqual([rows[1], rows[2]]);
    expect(employeeLeaveBalances("", rows, true)).toEqual([]);
  });
});
