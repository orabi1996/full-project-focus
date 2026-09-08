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
  absenceDays?: number;
  lateMinutes?: number;
  earlyDepartureMinutes?: number;
  lateGraceMinutes?: number;
  earlyDepartureGraceMinutes?: number;
  deductionCapPercent?: number;
  deductionRoundingMinutes?: number;
  deductionRoundingMode?: "exact" | "up" | "nearest";
  overtimeHours?: number;
  loanInstallment?: number;
  salaryAdvanceDeduction?: number;
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
  absenceDeduction: number;
  lateDeduction: number;
  earlyDepartureDeduction: number;
  gosiEmployee: number;
  gosiEmployer: number;
  loanDeduction: number;
  salaryAdvanceDeduction: number;
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
    absenceDays = 0,
    lateMinutes = 0,
    earlyDepartureMinutes = 0,
    lateGraceMinutes = 0,
    earlyDepartureGraceMinutes = 0,
    deductionCapPercent = 100,
    deductionRoundingMinutes = 1,
    deductionRoundingMode = "exact",
    overtimeHours = 0,
    loanInstallment = 0,
    salaryAdvanceDeduction = 0,
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
      absenceDays,
      lateMinutes,
      earlyDepartureMinutes,
      overtimeHours,
      loanInstallment,
      salaryAdvanceDeduction,
      bonus,
    ].some((value) => value < 0)
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

  // Late deduction (per minute based on standard wage rate)
  const minuteRate = hourlyRate / 60;
  const roundMinutes = (minutes: number) => {
    const value = Math.max(0, minutes);
    if (deductionRoundingMinutes <= 1 || deductionRoundingMode === "exact") return value;
    const units = value / deductionRoundingMinutes;
    const rounded = deductionRoundingMode === "up" ? Math.ceil(units) : Math.round(units);
    return rounded * deductionRoundingMinutes;
  };
  const lateDeduction = Number((minuteRate * roundMinutes(lateMinutes - lateGraceMinutes)).toFixed(2));
  const earlyDepartureDeduction = Number(
    (minuteRate * roundMinutes(earlyDepartureMinutes - earlyDepartureGraceMinutes)).toFixed(2),
  );

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
  const uncappedDeductions = Number(
    (
      unpaidLeaveDeduction +
      absenceDeduction +
      lateDeduction +
      earlyDepartureDeduction +
      gosiEmployee +
      loanInstallment +
      salaryAdvanceDeduction
    ).toFixed(2),
  );
  const totalDeductions = Number(
    Math.min(uncappedDeductions, totalEarnings * Math.max(0, deductionCapPercent) / 100).toFixed(2),
  );

  const netSalary = Math.max(0, Number((totalEarnings - totalDeductions).toFixed(2)));

  return {
    dailyRate,
    hourlyRate,
    grossSalary: totalMonthlyWage,
    overtimeAmount,
    unpaidLeaveDeduction,
    absenceDeduction,
    lateDeduction,
    earlyDepartureDeduction,
    gosiEmployee,
    gosiEmployer,
    loanDeduction: loanInstallment,
    salaryAdvanceDeduction,
    totalEarnings,
    totalDeductions,
    netSalary,
  };
}
