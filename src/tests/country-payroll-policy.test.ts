import { describe, expect, it } from "vitest";
import { COUNTRY_PACK_CATALOG, payrollCountry, isNationalOf, resolveCountryPayrollPolicy, validateCountryPayrollPolicy, countryPayrollCharges, type CountryPayrollPolicy, type CountryPolicyRecord } from "../lib/business/payroll-country";
import { employeePeriodSalary, payrollPeriod } from "../lib/business/payroll-period";
import { allocatePayrollLoans } from "../lib/business/payroll-loans";

export const policyFixture = (): CountryPayrollPolicy => ({
  name: "Synthetic test policy", effectiveFrom: "2026-01-01", effectiveTo: null,
  sourceUrl: "https://example.com/test-policy", monthlyHours: 240, overtimeWageMultiplier: 1, overtimeBasicPremium: 0.5,
  schemes: [
    { code: "national", name: "National", citizenship: "national", contributions: [{ name: "Pension", basis: "gross", minimum: 0, maximum: null, employeeRate: 0.1, employerRate: 0.2 }] },
    { code: "expat", name: "Expat", citizenship: "non_national", contributions: [{ name: "Employer fund", basis: "basic", minimum: 0, maximum: null, employeeRate: 0, employerRate: 0.02 }] },
  ], tax: { enabled: false, annualExemption: 0, brackets: [] },
});

describe("company payroll policies across the installed countries", () => {
  it.each(Object.values(COUNTRY_PACK_CATALOG))("resolves $countryCode aliases and currency precision", pack => {
    expect(payrollCountry(pack.nameAr)).toBe(pack.countryCode);
    expect(payrollCountry(pack.nameEn)).toBe(pack.countryCode);
    expect(payrollCountry(pack.countryCode)).toBe(pack.countryCode);
    const policy = policyFixture();
    const result = countryPayrollCharges(policy, pack.countryCode, { nationality: pack.countryCode,
      nominal: [1000.125, 0, 0, 0], taxableGross: 1000.125 });
    expect(result.employee).toBe(pack.decimalPrecision === 3 ? 100.013 : 100.01);
  });
  it("uses work country independently from citizenship", () => {
    expect(isNationalOf("مصري", "EG")).toBe(true);
    const result = countryPayrollCharges(policyFixture(), "AE", { nationality: "EG", nominal: [1000, 0, 0, 0], taxableGross: 1000 });
    expect(result.employee).toBe(0);
    expect(result.employer).toBe(20);
    expect(() => payrollCountry("unknown")).toThrow();
  });
  it("requires an explicit regime for GCC protection and ambiguous national schemes", () => {
    const policy = policyFixture();
    expect(() => countryPayrollCharges(policy, "AE", { nationality: "SA", nominal: [1000, 0, 0, 0], taxableGross: 1000 })).toThrow();
    policy.schemes.push({ ...policy.schemes[0], code: "legacy" });
    expect(() => countryPayrollCharges(policy, "AE", { nationality: "AE", nominal: [1000, 0, 0, 0], taxableGross: 1000 })).toThrow();
    expect(countryPayrollCharges(policy, "AE", { nationality: "AE", schemeCode: "legacy", nominal: [1000, 0, 0, 0], taxableGross: 1000 }).employee).toBe(100);
  });
  it("retains Saudi historical rules before a future policy begins", () => {
    const policy = policyFixture(); policy.effectiveFrom = "2027-01-01";
    const record: CountryPolicyRecord = { id: "future", company_id: "company", country_code: "SA", status: "active", policy };
    expect(resolveCountryPayrollPolicy([record], "SA", "2026-12-01", "2026-12-31")).toBeNull();
  });
  it("applies each fund's individual registered wage and cap", () => {
    const policy = policyFixture();
    policy.schemes[0].contributions = [
      { name: "Fund 1", basis: "registered", minimum: 0, maximum: 1500, employeeRate: 0.05, employerRate: 0.1 },
      { name: "Fund 2", basis: "gross", minimum: 0, maximum: 2750, employeeRate: 0.025, employerRate: 0.01 },
    ];
    expect(() => countryPayrollCharges(policy, "KW", { nationality: "KW", nominal: [3000, 0, 0, 0], taxableGross: 3000 })).toThrow();
    const result = countryPayrollCharges(policy, "KW", { nationality: "KW", nominal: [3000, 0, 0, 0], taxableGross: 3000, registeredWage: 1800 });
    expect(result.employee).toBe(143.75);
    expect(result.employer).toBe(177.5);
  });
  it("annualizes configured progressive tax and handles withdrawn lower brackets", () => {
    const policy = policyFixture(); policy.schemes[0].contributions[0].employeeRate = 0;
    policy.tax = { enabled: true, annualExemption: 0, brackets: [
      { upper: 12000, rate: 0, availableUpToAnnual: 48000 }, { upper: null, rate: 0.2, availableUpToAnnual: null },
    ] };
    expect(countryPayrollCharges(policy, "EG", { nationality: "EG", nominal: [2000, 0, 0, 0], taxableGross: 2000 }).tax).toBe(200);
    expect(countryPayrollCharges(policy, "EG", { nationality: "EG", nominal: [5000, 0, 0, 0], taxableGross: 5000 }).tax).toBe(1000);
  });
  it("deducts only tax-deductible contributions from the taxable wage", () => {
    const policy = policyFixture();
    policy.tax = { enabled: true, annualExemption: 0, brackets: [{ upper: null, rate: 0.2, availableUpToAnnual: null }] };
    const input = { nationality: "EG", nominal: [1000, 0, 0, 0], taxableGross: 1000 };
    expect(countryPayrollCharges(policy, "EG", input).tax).toBe(180);
    policy.schemes[0].contributions[0].taxDeductible = false;
    expect(countryPayrollCharges(policy, "EG", input).tax).toBe(200);
  });
  it("rejects invalid rates, missing Egyptian tax, and incomplete tax coverage", () => {
    const policy = policyFixture();
    expect(() => validateCountryPayrollPolicy(policy, "EG")).toThrow();
    policy.schemes[0].contributions[0].employeeRate = -1;
    expect(() => validateCountryPayrollPolicy(policy, "SA")).toThrow();
    policy.schemes[0].contributions[0].employeeRate = 0.1;
    policy.tax.enabled = true; policy.tax.brackets = [{ upper: 1000, rate: 0.2, availableUpToAnnual: null }];
    expect(() => validateCountryPayrollPolicy(policy, "SA")).toThrow();
  });
  it("resolves active effective-dated policies and rejects gaps/overlap without Saudi fallback", () => {
    const policy = policyFixture();
    const record: CountryPolicyRecord = { id: "v1", company_id: "company", country_code: "AE", status: "active", policy };
    expect(resolveCountryPayrollPolicy([record], "AE", "2026-04-01", "2026-04-30")?.id).toBe("v1");
    expect(() => resolveCountryPayrollPolicy([{ ...record, status: "draft" }], "AE", "2026-04-01", "2026-04-30")).toThrow();
    expect(() => resolveCountryPayrollPolicy([record, record], "AE", "2026-04-01", "2026-04-30")).toThrow();
    expect(resolveCountryPayrollPolicy([], "SA", "2026-04-01", "2026-04-30")).toBeNull();
    expect(() => resolveCountryPayrollPolicy([{ ...record, country_code: "SA", policy: { ...policy, effectiveTo: "2026-03-31" } }], "SA", "2026-04-01", "2026-04-30")).toThrow();
  });
  it("preserves the third decimal in salary proration and loan allocations", () => {
    const salary = employeePeriodSalary(payrollPeriod({ year: 2026, month: 4 }),
      { hire_date: "2026-04-30", basic_salary: 100.125 }, [], "fixed_30_days", 3);
    expect(salary?.earned[0]).toBe(3.338);
    expect(allocatePayrollLoans([{ id: "loan", employee_id: "emp", monthly_installment: 2.345, remaining_balance: 4 }], 3)[0].amount).toBe(2.345);
  });
});
