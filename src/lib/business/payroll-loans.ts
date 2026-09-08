export interface PayrollLoan {
  id: string;
  employee_id: string;
  monthly_installment: number | string;
  remaining_balance: number | string;
}

/** Each loan contributes its own installment, capped at its remaining balance. */
export function allocatePayrollLoans(loans: PayrollLoan[]) {
  const seen = new Set<string>();
  return loans.flatMap((loan) => {
    if (seen.has(loan.id)) throw new Error("تكرار السلفة في بيانات المسيّر");
    seen.add(loan.id);
    const installment = Number(loan.monthly_installment);
    const remaining = Number(loan.remaining_balance);
    if (![installment, remaining].every((n) => Number.isFinite(n) && n >= 0)) {
      throw new Error("بيانات قسط السلفة أو رصيدها غير صالحة");
    }
    const amount = Math.round(Math.min(installment, remaining) * 100) / 100;
    return amount > 0 ? [{ loan_id: loan.id, employee_id: loan.employee_id, amount }] : [];
  });
}
