import { describe, it, expect } from "vitest";
import { allocatePayrollLoans } from "./payroll-loans";
describe("per-loan installment allocation", () => {
  it("caps each loan independently instead of deducting the employee total from every loan", () => {
    expect(
      allocatePayrollLoans([
        { id: "a", employee_id: "e", monthly_installment: 300, remaining_balance: 900 },
        { id: "b", employee_id: "e", monthly_installment: 200, remaining_balance: 50 },
      ]),
    ).toEqual([
      { loan_id: "a", employee_id: "e", amount: 300 },
      { loan_id: "b", employee_id: "e", amount: 50 },
    ]);
  });
  it("rejects invalid values and duplicate IDs", () => {
    const loan = { id: "a", employee_id: "e", monthly_installment: 200, remaining_balance: 100 };
    for (const value of [-1, NaN, Infinity])
      expect(() => allocatePayrollLoans([{ ...loan, remaining_balance: value }])).toThrow();
    expect(() => allocatePayrollLoans([loan, loan])).toThrow();
    expect(allocatePayrollLoans([{ ...loan, remaining_balance: 0 }])).toEqual([]);
  });
});
