import { describe, expect, it } from "vitest";
import { payrollPeriod, employeePeriodSalary } from "../lib/business/payroll-period";

const employee = { hire_date: "2020-01-01", basic_salary: 3000 };
const version = { effective_from: "2020-01-01", basic_salary: 3000 };

describe("effective-dated payroll periods", () => {
  it.each([2, 4, 7])("pays a complete fixed-30 salary in month %s", month => {
    const salary = employeePeriodSalary(payrollPeriod({ year: 2026, month }), employee, [version], "fixed_30_days");
    expect(salary?.earned[0]).toBe(3000);
  });
  it("handles leap February without paying more than the monthly salary", () => {
    expect(employeePeriodSalary(payrollPeriod({ year: 2028, month: 2 }), employee, [version], "fixed_30_days")?.earned[0]).toBe(3000);
  });
  it("clips eligibility to employment dates and excludes future hires", () => {
    const period = payrollPeriod({ year: 2026, month: 4 });
    expect(employeePeriodSalary(period, { ...employee, hire_date: "2026-04-16" }, [version], "fixed_30_days")?.earned[0]).toBe(1500);
    expect(employeePeriodSalary(period, { ...employee, exit_date: "2026-04-15" }, [version], "fixed_30_days")?.earned[0]).toBe(1500);
    expect(employeePeriodSalary(period, { ...employee, hire_date: "2026-05-01" }, [version], "fixed_30_days")).toBeNull();
  });
  it("splits a salary change instead of applying the new salary retroactively", () => {
    const result = employeePeriodSalary(payrollPeriod({ year: 2026, month: 4 }), employee,
      [version, { effective_from: "2026-04-16", basic_salary: 6000 }], "fixed_30_days");
    expect(result?.earned[0]).toBe(4500);
    expect(result?.daily.get("2026-04-15")?.[0]).toBe(3000);
    expect(result?.daily.get("2026-04-16")?.[0]).toBe(6000);
  });
  it("uses actual days for a calendar-days group", () => {
    const result = employeePeriodSalary(payrollPeriod({ year: 2026, month: 7 }),
      { ...employee, hire_date: "2026-07-16" }, [version], "calendar_days");
    expect(result?.earned[0]).toBe(1548.39);
  });
  it("applies custom-day periods to real dates and eligibility together", () => {
    const period = payrollPeriod({ year: 2026, month: 4, periodCalculationMode: "custom_days", customDaysCount: 20 });
    expect(period.end).toBe("2026-04-20");
    expect(employeePeriodSalary(period, { ...employee, hire_date: "2026-04-16" }, [version], "fixed_30_days")?.earned[0]).toBe(500);
  });
  it.each([0, -1, 31, 2.5, NaN])("rejects invalid April day count %s", customDaysCount => {
    expect(() => payrollPeriod({ year: 2026, month: 4, periodCalculationMode: "custom_days", customDaysCount })).toThrow();
  });
  it.each(["2026-02-30", "2026-03-01", "2026-01-31", "bad"])('rejects invalid period end %s', periodEndDate => {
    expect(() => payrollPeriod({ year: 2026, month: 2, periodCalculationMode: "custom_end_date", periodEndDate })).toThrow();
  });
  it("blocks salary history gaps, duplicate effective dates and unsupported schedules", () => {
    const period = payrollPeriod({ year: 2026, month: 4 });
    expect(() => employeePeriodSalary(period, employee, [{ ...version, effective_from: "2026-04-10" }], "fixed_30_days")).toThrow();
    expect(() => employeePeriodSalary(period, employee, [version, version], "fixed_30_days")).toThrow();
    expect(() => employeePeriodSalary(period, employee, [version], "working_days")).toThrow();
  });
});
