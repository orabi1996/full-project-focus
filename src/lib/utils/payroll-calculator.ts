// ============================================================================
// Payroll Calculation Engine (Standard Saudi Labor Law & International Conventions)
// ============================================================================

import type { PayrollCalculationBasis } from "../../types";

export interface PayrollCalculationInput {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances?: number;
  calculationBasis: PayrollCalculationBasis;
  daysInMonth: number; // 28, 29, 30, or 31
  unpaidLeaveDays?: number;
  sickLeaveDays?: number;
  absenceDays?: number;
  lateMinutes?: number;
  earlyDepartureMinutes?: number;
  penaltiesAmount?: number;
  overtimeHours?: number;
  loanInstallment?: number;
  bonus?: number;
  isSaudiNational?: boolean;
  gosiScheme?: "legacy" | "new_1445";
  payrollDate?: string;
}

function newSystemPensionRate(payrollDate: string) {
  const date = new Date(`${payrollDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid payrollDate");
  if (date >= new Date("2028-07-01T00:00:00Z")) return 0.11;
  if (date >= new Date("2027-07-01T00:00:00Z")) return 0.105;
  if (date >= new Date("2026-07-01T00:00:00Z")) return 0.1;
  if (date >= new Date("2025-07-01T00:00:00Z")) return 0.095;
  return 0.09;
}

export interface PayrollCalculationResult {
  dailyRate: number;
  hourlyRate: number;
  grossSalary: number;
  overtimeAmount: number;
  unpaidLeaveDeduction: number;
  sickLeaveDeduction: number;
  absenceDeduction: number;
  lateDeduction: number;
  earlyDepartureDeduction: number;
  penaltiesDeduction: number;
  gosiEmployee: number;
  gosiEmployer: number;
  loanDeduction: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
}

/**
 * Calculates accurate payroll line item components
 */
export function calculateEmployeePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const {
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances = 0,
    calculationBasis,
    daysInMonth,
    unpaidLeaveDays = 0,
    sickLeaveDays = 0,
    absenceDays = 0,
    lateMinutes = 0,
    earlyDepartureMinutes = 0,
    penaltiesAmount = 0,
    overtimeHours = 0,
    loanInstallment = 0,
    bonus = 0,
    isSaudiNational = true,
    gosiScheme = "legacy",
    payrollDate = new Date().toISOString().split("T")[0],
  } = input;

  if (daysInMonth < 28 || daysInMonth > 31)
    throw new Error("daysInMonth must be between 28 and 31");
  if (
    [
      basicSalary,
      housingAllowance,
      transportAllowance,
      otherAllowances,
      unpaidLeaveDays,
      sickLeaveDays,
      absenceDays,
      lateMinutes,
      earlyDepartureMinutes,
      penaltiesAmount,
      overtimeHours,
      loanInstallment,
      bonus,
    ].some((value) => (value ?? 0) < 0)
  ) {
    throw new Error("Payroll values cannot be negative");
  }

  const totalMonthlyWage = basicSalary + housingAllowance + transportAllowance + otherAllowances;
  const basicPlusHousing = basicSalary + housingAllowance;

  // 1. Daily rate calculation
  const divisor = calculationBasis === "fixed_30_days" ? 30 : daysInMonth;
  const dailyRate = Number((totalMonthlyWage / divisor).toFixed(2));

  // 2. Hourly rate (standard 8 hours / day or 240 hours / month)
  const hourlyRate = Number((totalMonthlyWage / 240).toFixed(2));

  // Saudi Labor Law Article 107: actual hourly wage plus 50% of the basic hourly wage.
  const basicHourlyRate = basicSalary / 240;
  const overtimeAmount = Number(((hourlyRate + basicHourlyRate * 0.5) * overtimeHours).toFixed(2));

  // 4. Absence & Unpaid Leave Deductions
  const unpaidLeaveDeduction = Number((dailyRate * unpaidLeaveDays).toFixed(2));
  const absenceDeduction = Number((dailyRate * absenceDays).toFixed(2));

  // Sick Leave deduction according to Saudi Labor Law Article 117:
  // First 30 days: full pay (0% deduction)
  // Next 60 days (days 31-90): 75% pay (25% deduction)
  // Next 30 days (days 91-120): unpaid (100% deduction)
  // Above 120 days: unpaid (100% deduction)
  let sickLeaveDeduction = 0;
  if (sickLeaveDays > 90) {
    const tier2Days = 60;
    const tier3Days = Math.min(30, sickLeaveDays - 90);
    const beyondDays = Math.max(0, sickLeaveDays - 120);
    sickLeaveDeduction = Number(
      ((tier2Days * 0.25 + tier3Days * 1.0 + beyondDays * 1.0) * dailyRate).toFixed(2),
    );
  } else if (sickLeaveDays > 30) {
    const tier2Days = sickLeaveDays - 30;
    sickLeaveDeduction = Number((tier2Days * 0.25 * dailyRate).toFixed(2));
  }

  // Late & Early departure deduction (per minute based on standard wage rate)
  const minuteRate = hourlyRate / 60;
  const lateDeduction = Number((minuteRate * lateMinutes).toFixed(2));
  const earlyDepartureDeduction = Number((minuteRate * earlyDepartureMinutes).toFixed(2));
  const penaltiesDeduction = Number(penaltiesAmount.toFixed(2));

  // 5. GOSI / Social Insurance calculation (Saudi standard)
  // Capped at 45,000 SAR on (Basic + Housing)
  const gosiSubjectAmount = Math.min(basicPlusHousing, 45000);
  let gosiEmployee = 0;
  let gosiEmployer = 0;

  if (isSaudiNational) {
    const pensionRate = gosiScheme === "new_1445" ? newSystemPensionRate(payrollDate) : 0.09;
    // Employee: pension + 0.75% SANED. Employer: pension + 0.75% SANED + 2% hazards.
    gosiEmployee = Number((gosiSubjectAmount * (pensionRate + 0.0075)).toFixed(2));
    gosiEmployer = Number((gosiSubjectAmount * (pensionRate + 0.0075 + 0.02)).toFixed(2));
  } else {
    // Non-Saudi: 2% occupational hazards borne by employer
    gosiEmployee = 0;
    gosiEmployer = Number((gosiSubjectAmount * 0.02).toFixed(2));
  }

  // 6. Totals
  const totalEarnings = Number((totalMonthlyWage + overtimeAmount + bonus).toFixed(2));
  const totalDeductions = Number(
    (
      unpaidLeaveDeduction +
      sickLeaveDeduction +
      absenceDeduction +
      lateDeduction +
      earlyDepartureDeduction +
      penaltiesDeduction +
      gosiEmployee +
      loanInstallment
    ).toFixed(2),
  );

  const netSalary = Math.max(0, Number((totalEarnings - totalDeductions).toFixed(2)));

  return {
    dailyRate,
    hourlyRate,
    grossSalary: totalMonthlyWage,
    overtimeAmount,
    unpaidLeaveDeduction,
    sickLeaveDeduction,
    absenceDeduction,
    lateDeduction,
    earlyDepartureDeduction,
    penaltiesDeduction,
    gosiEmployee,
    gosiEmployer,
    loanDeduction: loanInstallment,
    totalEarnings,
    totalDeductions,
    netSalary,
  };
}
