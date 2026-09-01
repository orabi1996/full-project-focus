import { describe, expect, it } from "vitest";

import { calculateEOSB } from "./eosb-calculator";

describe("calculateEOSB", () => {
  it("calculates half a month for each of the first five years", () => {
    const result = calculateEOSB({
      totalMonthlyWage: 12_000,
      startDate: "2020-01-01",
      endDate: "2025-01-01",
      separationType: "contract_expiration",
    });
    expect(result.serviceYears).toBe(5);
    expect(result.baseEOSB).toBe(30_000);
    expect(result.finalEOSBAmount).toBe(30_000);
  });

  it("uses one month per year after year five", () => {
    const result = calculateEOSB({
      totalMonthlyWage: 12_000,
      startDate: "2018-01-01",
      endDate: "2026-01-01",
      separationType: "termination_by_employer",
    });
    expect(result.baseEOSB).toBe(66_000);
  });

  it("applies resignation tiers and awards the full amount at exactly ten years", () => {
    const result = calculateEOSB({
      totalMonthlyWage: 12_000,
      startDate: "2016-01-01",
      endDate: "2026-01-01",
      separationType: "resignation",
    });
    expect(result.resignationMultiplier).toBe(100);
    expect(result.finalEOSBAmount).toBe(90_000);
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      calculateEOSB({
        totalMonthlyWage: 12_000,
        startDate: "2026-01-01",
        endDate: "2025-01-01",
        separationType: "resignation",
      }),
    ).toThrow();
  });
});
