// ============================================================================
// Payroll Calculation Engine (Standard Saudi Labor Law & International Conventions)
// ============================================================================

import type { PayrollCalculationBasis } from '../../types';

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
  overtimeHours?: number;
  loanInstallment?: number;
  bonus?: number;
  isSaudiNational?: boolean;
}

export interface PayrollCalculationResult {
  dailyRate: number;
  hourlyRate: number;
  grossSalary: number;
  overtimeAmount: number;
  unpaidLeaveDeduction: number;
  absenceDeduction: number;
  lateDeduction: number;
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
    absenceDays = 0,
    lateMinutes = 0,
    overtimeHours = 0,
    loanInstallment = 0,
    bonus = 0,
    isSaudiNational = true,
  } = input;

  const totalMonthlyWage = basicSalary + housingAllowance + transportAllowance + otherAllowances;
  const basicPlusHousing = basicSalary + housingAllowance;

  // 1. Daily rate calculation
  const divisor = calculationBasis === 'fixed_30_days' ? 30 : daysInMonth;
  const dailyRate = Number((totalMonthlyWage / divisor).toFixed(2));
  
  // 2. Hourly rate (standard 8 hours / day or 240 hours / month)
  const hourlyRate = Number((totalMonthlyWage / 240).toFixed(2));

  // 3. Overtime calculation (Standard 1.5x of hourly rate for regular overtime)
  const overtimeAmount = Number((hourlyRate * 1.5 * overtimeHours).toFixed(2));

  // 4. Absence & Unpaid Leave Deductions
  const unpaidLeaveDeduction = Number((dailyRate * unpaidLeaveDays).toFixed(2));
  const absenceDeduction = Number((dailyRate * absenceDays).toFixed(2));
  
  // Late deduction (per minute based on standard wage rate)
  const minuteRate = hourlyRate / 60;
  const lateDeduction = Number((minuteRate * lateMinutes).toFixed(2));

  // 5. GOSI / Social Insurance calculation (Saudi standard)
  // Capped at 45,000 SAR on (Basic + Housing)
  const gosiSubjectAmount = Math.min(basicPlusHousing, 45000);
  let gosiEmployee = 0;
  let gosiEmployer = 0;

  if (isSaudiNational) {
    // 9.75% employee (9% pension + 0.75% SANED)
    gosiEmployee = Number((gosiSubjectAmount * 0.0975).toFixed(2));
    // 11.75% employer (9% pension + 0.75% SANED + 2% Hazards)
    gosiEmployer = Number((gosiSubjectAmount * 0.1175).toFixed(2));
  } else {
    // Non-Saudi: 2% occupational hazards borne by employer
    gosiEmployee = 0;
    gosiEmployer = Number((gosiSubjectAmount * 0.02).toFixed(2));
  }

  // 6. Totals
  const totalEarnings = Number((totalMonthlyWage + overtimeAmount + bonus).toFixed(2));
  const totalDeductions = Number((
    unpaidLeaveDeduction +
    absenceDeduction +
    lateDeduction +
    gosiEmployee +
    loanInstallment
  ).toFixed(2));

  const netSalary = Math.max(0, Number((totalEarnings - totalDeductions).toFixed(2)));

  return {
    dailyRate,
    hourlyRate,
    grossSalary: totalMonthlyWage,
    overtimeAmount,
    unpaidLeaveDeduction,
    absenceDeduction,
    lateDeduction,
    gosiEmployee,
    gosiEmployer,
    loanDeduction: loanInstallment,
    totalEarnings,
    totalDeductions,
    netSalary,
  };
}
