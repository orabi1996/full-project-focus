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

  it("calculates early departure and late deductions accurately", () => {
    const result = calculateEmployeePayroll({
      ...baseInput,
      overtimeHours: 0,
      lateMinutes: 30,
      earlyDepartureMinutes: 30,
    });
    // total wage = 13,500. hourly rate = 13500 / 240 = 56.25. minute rate = 56.25 / 60 = 0.9375.
    // 30 mins = 28.13 SAR.
    expect(result.lateDeduction).toBe(28.13);
    expect(result.earlyDepartureDeduction).toBe(28.13);
  });

  it("calculates sick leave deduction according to Saudi Labor Law Article 117", () => {
    // 40 days of sick leave: first 30 days full pay (0%), next 10 days at 25% deduction.
    // daily rate = 13500 / 30 = 450.
    // 10 days * 450 * 0.25 = 1,125.
    const result = calculateEmployeePayroll({
      ...baseInput,
      overtimeHours: 0,
      sickLeaveDays: 40,
    });
    expect(result.sickLeaveDeduction).toBe(1125);
  });

  it("includes penalties and unpaid leave deductions in total deductions", () => {
    const result = calculateEmployeePayroll({
      ...baseInput,
      overtimeHours: 0,
      unpaidLeaveDays: 2, // 2 * 450 = 900
      penaltiesAmount: 250,
    });
    expect(result.unpaidLeaveDeduction).toBe(900);
    expect(result.penaltiesDeduction).toBe(250);
  });

  it("rejects negative payroll inputs", () => {
    expect(() => calculateEmployeePayroll({ ...baseInput, absenceDays: -1 })).toThrow();
  });
});
