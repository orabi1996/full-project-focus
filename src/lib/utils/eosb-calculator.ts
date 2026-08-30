// ============================================================================
// End of Service Benefit (EOSB) Calculator (Saudi Labor Law Articles 84 & 85)
// ============================================================================

export type SeparationType = 
  | 'termination_by_employer' 
  | 'contract_expiration' 
  | 'resignation' 
  | 'force_majeure' 
  | 'female_marriage';

export interface EOSBCalculationInput {
  totalMonthlyWage: number; // Last received wage (Basic + Housing + regular allowances)
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  separationType: SeparationType;
  unpaidLeaveDays?: number;
}

export interface EOSBCalculationResult {
  serviceYears: number;
  serviceMonths: number;
  serviceDays: number;
  totalServiceYearsDecimal: number;
  baseEOSB: number;
  resignationMultiplier: number;
  finalEOSBAmount: number;
}

export function calculateEOSB(input: EOSBCalculationInput): EOSBCalculationResult {
  const { totalMonthlyWage, startDate, endDate, separationType, unpaidLeaveDays = 0 } = input;

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Total calendar days of service minus unpaid leaves
  const diffTime = Math.max(0, end.getTime() - start.getTime());
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)) - unpaidLeaveDays);
  
  const totalServiceYearsDecimal = diffDays / 365.25;
  const serviceYears = Math.floor(totalServiceYearsDecimal);
  const remainingDays = diffDays - (serviceYears * 365.25);
  const serviceMonths = Math.floor(remainingDays / 30.4375);
  const serviceDays = Math.floor(remainingDays % 30.4375);

  // Article 84:
  // - Half month's wage for each of the first 5 years
  // - One month's wage for each following year
  let baseEOSB = 0;
  if (totalServiceYearsDecimal <= 5) {
    baseEOSB = totalServiceYearsDecimal * (totalMonthlyWage * 0.5);
  } else {
    const firstFiveYears = 5 * (totalMonthlyWage * 0.5);
    const remainingYears = (totalServiceYearsDecimal - 5) * totalMonthlyWage;
    baseEOSB = firstFiveYears + remainingYears;
  }

  // Article 85 Resignation Multiplier:
  // - Less than 2 years: 0%
  // - 2 to 5 years: 1/3 (33.33%)
  // - 5 to 10 years: 2/3 (66.67%)
  // - 10+ years: 100%
  let multiplier = 1.0;
  if (separationType === 'resignation') {
    if (totalServiceYearsDecimal < 2) {
      multiplier = 0.0;
    } else if (totalServiceYearsDecimal <= 5) {
      multiplier = 1 / 3;
    } else if (totalServiceYearsDecimal <= 10) {
      multiplier = 2 / 3;
    } else {
      multiplier = 1.0;
    }
  } else {
    // For employer termination, expiration, force majeure, or marriage: 100%
    multiplier = 1.0;
  }

  const finalEOSBAmount = Number((baseEOSB * multiplier).toFixed(2));

  return {
    serviceYears,
    serviceMonths,
    serviceDays,
    totalServiceYearsDecimal: Number(totalServiceYearsDecimal.toFixed(2)),
    baseEOSB: Number(baseEOSB.toFixed(2)),
    resignationMultiplier: Number((multiplier * 100).toFixed(1)),
    finalEOSBAmount,
  };
}
