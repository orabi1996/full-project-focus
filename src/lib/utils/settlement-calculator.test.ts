import { describe, expect, it } from "vitest";
import { availableLeaveDays, calculateSettlementNet } from "./settlement-calculator";

describe("final settlement calculations", () => {
  it("excludes used and reserved leave from the payout", () => {
    expect(
      availableLeaveDays({
        accrued_days: 20,
        carried_over_days: 4,
        used_days: 8,
        reserved_days: 6,
      }),
    ).toBe(10);
  });

  it("never returns a negative settlement after loan recovery", () => {
    expect(
      calculateSettlementNet({
        eosbAmount: 5_000,
        leavePayoutAmount: 1_000,
        pendingSalaryAmount: 500,
        loanDeductionAmount: 20_000,
      }),
    ).toBe(0);
  });

  it("adds pending salary and applies the loan deduction exactly once", () => {
    expect(
      calculateSettlementNet({
        eosbAmount: 10_000,
        leavePayoutAmount: 2_000,
        pendingSalaryAmount: 3_000,
        loanDeductionAmount: 1_500,
      }),
    ).toBe(13_500);
  });
});
