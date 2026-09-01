// ============================================================================
// End of Service Benefit (EOSB) Calculator (Saudi Labor Law Articles 84 & 85)
// ============================================================================

export type SeparationType =
  | "termination_by_employer"
  | "contract_expiration"
  | "resignation"
  | "force_majeure"
  | "female_marriage";

export interface EOSBCalculationInput {
  totalMonthlyWage: number; // Last received wage (Basic + Housing + regular allowances)
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
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

  if (totalMonthlyWage < 0 || unpaidLeaveDays < 0)
    throw new Error("EOSB values cannot be negative");
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    throw new Error("Invalid service date");
  if (end < start) throw new Error("End date cannot be before start date");

  const dayMs = 1000 * 60 * 60 * 24;
  const adjustedEnd = new Date(end.getTime() - unpaidLeaveDays * dayMs);
  if (adjustedEnd < start) throw new Error("Unpaid leave cannot exceed service duration");

  let serviceYears = adjustedEnd.getUTCFullYear() - start.getUTCFullYear();
  let anniversary = new Date(
    Date.UTC(start.getUTCFullYear() + serviceYears, start.getUTCMonth(), start.getUTCDate()),
  );
  if (anniversary > adjustedEnd) {
    serviceYears -= 1;
    anniversary = new Date(
      Date.UTC(start.getUTCFullYear() + serviceYears, start.getUTCMonth(), start.getUTCDate()),
    );
  }

  let serviceMonths = 0;
  let monthBoundary = anniversary;
  while (serviceMonths < 11) {
    const nextBoundary = new Date(
      Date.UTC(
        anniversary.getUTCFullYear(),
        anniversary.getUTCMonth() + serviceMonths + 1,
        anniversary.getUTCDate(),
      ),
    );
    if (nextBoundary > adjustedEnd) break;
    serviceMonths += 1;
    monthBoundary = nextBoundary;
  }
  const serviceDays = Math.floor((adjustedEnd.getTime() - monthBoundary.getTime()) / dayMs);
  const totalServiceYearsDecimal = serviceYears + serviceMonths / 12 + serviceDays / 365.25;

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
  if (separationType === "resignation") {
    if (totalServiceYearsDecimal < 2) {
      multiplier = 0.0;
    } else if (totalServiceYearsDecimal <= 5) {
      multiplier = 1 / 3;
    } else if (totalServiceYearsDecimal < 10) {
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
