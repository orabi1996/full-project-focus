import { describe, expect, it } from "vitest";

import { calculateEmployeePayroll } from "./payroll-calculator";

const baseInput = {
  basicSalary: 10_000,
  housingAllowance: 2_500,
  transportAllowance: 1_000,
  calculationBasis: "fixed_30_days" as const,
  daysInMonth: 31,
  overtimeHours: 10,
};

describe("calculateEmployeePayroll", () => {
  it("uses actual hourly wage plus 50% of basic hourly wage for overtime", () => {
    const result = calculateEmployeePayroll(baseInput);
    expect(result.overtimeAmount).toBe(770.83);
  });

  it("calculates legacy GOSI and observes the 45,000 SAR ceiling", () => {
    const result = calculateEmployeePayroll({
      ...baseInput,
      basicSalary: 40_000,
      housingAllowance: 10_000,
      transportAllowance: 0,
      overtimeHours: 0,
      gosiScheme: "legacy",
    });
    expect(result.gosiEmployee).toBe(4_387.5);
    expect(result.gosiEmployer).toBe(5_287.5);
  });

  it("applies the July 2026 progressive pension rate to new-system contributors", () => {
    const result = calculateEmployeePayroll({
      ...baseInput,
      overtimeHours: 0,
      gosiScheme: "new_1445",
      payrollDate: "2026-08-01",
    });
    expect(result.gosiEmployee).toBe(1_343.75);
    expect(result.gosiEmployer).toBe(1_593.75);
  });

  it("charges only occupational hazards to the employer for non-Saudi employees", () => {
    const result = calculateEmployeePayroll({
      ...baseInput,
      overtimeHours: 0,
      isSaudiNational: false,
    });
    expect(result.gosiEmployee).toBe(0);
    expect(result.gosiEmployer).toBe(250);
  });

  it("rejects negative payroll inputs", () => {
    expect(() => calculateEmployeePayroll({ ...baseInput, absenceDays: -1 })).toThrow();
  });
});
