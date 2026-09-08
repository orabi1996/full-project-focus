export interface LeaveBalanceSnapshot {
  accrued_days?: number | string | null;
  carried_over_days?: number | string | null;
  used_days?: number | string | null;
  reserved_days?: number | string | null;
}

/** Returns the unused, non-reserved leave days available for a final settlement. */
export function availableLeaveDays(balance: LeaveBalanceSnapshot) {
  const available =
    Number(balance.accrued_days ?? 0) +
    Number(balance.carried_over_days ?? 0) -
    Number(balance.used_days ?? 0) -
    Number(balance.reserved_days ?? 0);
  return Math.max(0, available);
}

export interface SettlementNetInput {
  eosbAmount: number;
  leavePayoutAmount: number;
  pendingSalaryAmount: number;
  loanDeductionAmount: number;
}

/** Final settlement cannot become negative; deductions are applied once. */
export function calculateSettlementNet(input: SettlementNetInput) {
  return Math.max(
    0,
    Number(input.eosbAmount || 0) +
      Number(input.leavePayoutAmount || 0) +
      Number(input.pendingSalaryAmount || 0) -
      Number(input.loanDeductionAmount || 0),
  );
}
