import { describe, expect, it } from "vitest";

import { calculateEOSB } from "./eosb-calculator";
import { calculateEmployeePayroll } from "./payroll-calculator";

const payroll = {
  basicSalary: 9_000,
  housingAllowance: 2_250,
  transportAllowance: 750,
  calculationBasis: "fixed_30_days" as const,
  daysInMonth: 30,
};

describe("financial boundary regressions", () => {
  it.each([
    ["2025-06-30", 1_096.88],
    ["2025-07-01", 1_153.13],
    ["2026-07-01", 1_209.38],
    ["2027-07-01", 1_265.62],
    ["2028-07-01", 1_321.88],
  ])("uses the correct new-system pension tier on %s", (date, expected) => {
    const result = calculateEmployeePayroll({
      ...payroll,
      gosiScheme: "new_1445",
      payrollDate: date,
    });
    expect(result.gosiEmployee).toBe(expected);
  });

  it("uses calendar days when configured and never returns a negative net salary", () => {
    const result = calculateEmployeePayroll({
      ...payroll,
      calculationBasis: "calendar_days",
      daysInMonth: 31,
      absenceDays: 31,
      loanInstallment: 100_000,
    });
    expect(result.dailyRate).toBe(387.1);
    expect(result.netSalary).toBe(0);
  });

  it("rejects invalid payroll boundaries", () => {
    expect(() => calculateEmployeePayroll({ ...payroll, daysInMonth: 27 })).toThrow(
      "daysInMonth must be between 28 and 31",
    );
    expect(() => calculateEmployeePayroll({ ...payroll, overtimeHours: -1 })).toThrow(
      "Payroll values cannot be negative",
    );
    expect(() =>
      calculateEmployeePayroll({
        ...payroll,
        gosiScheme: "new_1445",
        payrollDate: "not-a-date",
      }),
    ).toThrow("Invalid payrollDate");
  });

  it("applies occupational hazards only for non-Saudi employees", () => {
    const result = calculateEmployeePayroll({ ...payroll, isSaudiNational: false });
    expect(result.gosiEmployee).toBe(0);
    expect(result.gosiEmployer).toBe(225);
  });

  it.each([
    ["2025-12-31", 0],
    ["2026-01-01", 33.3],
    ["2029-01-01", 33.3],
    ["2031-01-01", 66.7],
    ["2036-01-01", 100],
  ])("applies resignation multiplier at service boundary %s", (endDate, multiplier) => {
    const result = calculateEOSB({
      totalMonthlyWage: 12_000,
      startDate: "2024-01-01",
      endDate,
      separationType: "resignation",
    });
    expect(result.resignationMultiplier).toBe(multiplier);
  });

  it("subtracts unpaid leave from service duration", () => {
    const withoutLeave = calculateEOSB({
      totalMonthlyWage: 10_000,
      startDate: "2020-01-01",
      endDate: "2025-01-01",
      separationType: "contract_expiration",
    });
    const withLeave = calculateEOSB({
      totalMonthlyWage: 10_000,
      startDate: "2020-01-01",
      endDate: "2025-01-01",
      separationType: "contract_expiration",
      unpaidLeaveDays: 30,
    });
    expect(withLeave.finalEOSBAmount).toBeLessThan(withoutLeave.finalEOSBAmount);
  });

  it("rejects invalid end-of-service boundaries", () => {
    expect(() =>
      calculateEOSB({
        totalMonthlyWage: -1,
        startDate: "2020-01-01",
        endDate: "2021-01-01",
        separationType: "contract_expiration",
      }),
    ).toThrow("EOSB values cannot be negative");
    expect(() =>
      calculateEOSB({
        totalMonthlyWage: 10_000,
        startDate: "invalid",
        endDate: "2021-01-01",
        separationType: "contract_expiration",
      }),
    ).toThrow("Invalid service date");
    expect(() =>
      calculateEOSB({
        totalMonthlyWage: 10_000,
        startDate: "2021-01-01",
        endDate: "2020-01-01",
        separationType: "contract_expiration",
      }),
    ).toThrow("End date cannot be before start date");
    expect(() =>
      calculateEOSB({
        totalMonthlyWage: 10_000,
        startDate: "2020-01-01",
        endDate: "2020-01-15",
        separationType: "contract_expiration",
        unpaidLeaveDays: 30,
      }),
    ).toThrow("Unpaid leave cannot exceed service duration");
  });
});
