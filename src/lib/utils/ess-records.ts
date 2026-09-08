import type { EmployeeLeaveBalance, EmployeePayrollDetail, PayrollRun } from "../../types";

/** Never infer the employee from array order, even for users with broad read access. */
export function latestEmployeePayroll(
  employeeId: string,
  details: EmployeePayrollDetail[],
  runs: PayrollRun[],
) {
  if (!employeeId) return undefined;
  const published = new Map(
    runs
      .filter((run) => ["confirmed_locked", "paid", "closed"].includes(run.status))
      .map((run) => [run.id, run]),
  );
  return details
    .filter((row) => row.employeeId === employeeId && published.has(row.payrollRunId))
    .sort((a, b) => {
      const ar = published.get(a.payrollRunId)!;
      const br = published.get(b.payrollRunId)!;
      return br.periodYear - ar.periodYear || br.periodMonth - ar.periodMonth;
    })[0];
}

export function employeeLeaveBalances(
  employeeId: string,
  balances: EmployeeLeaveBalance[],
  demo = false,
) {
  if (!employeeId) return [];
  return balances.filter(
    (balance) => balance.employeeId === employeeId || (demo && !balance.employeeId),
  );
}
