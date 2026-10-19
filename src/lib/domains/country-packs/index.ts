// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: PRODUCTION MULTI-COUNTRY STATUTORY COUNTRY PACKS DOMAIN
// src/lib/domains/country-packs/index.ts
// ============================================================================

import {
  EGYPT_SOURCES,
  EGYPT_TAX_BRACKETS,
  EGYPT_TAX_BRACKETS_2027,
  calculateEgyptPayrollTax,
  calculateEgyptSocialInsurance,
  type EgyptTaxBracket,
  type EgyptTaxBracketSlice,
  type StatutoryRuleMetadata,
} from "./egypt";
import { SAUDI_SOURCES, calculateSaudiSocialInsurance } from "./saudi-arabia";
import { QATAR_SOURCES, calculateQatarSocialInsurance } from "./qatar";
import { OMAN_SOURCES, calculateOmanSocialInsurance } from "./oman";
import { BAHRAIN_SOURCES, calculateBahrainSocialInsurance } from "./bahrain";

export type CountryCode = "EG" | "SA" | "QA" | "OM" | "BH";

export type CountryPackVerificationStatus =
  | "architecture_ready"
  | "configuration_required"
  | "verified"
  | "production_active";

export type StatutoryRuleSetStatus =
  | "draft"
  | "verified"
  | "scheduled"
  | "active"
  | "superseded"
  | "retired";

export type StatutoryRoundingPolicy = "HALF_UP" | "FLOOR" | "CEIL";

export interface CountryPackConfig {
  countryCode: CountryCode;
  nameAr: string;
  nameEn: string;
  currencyCode: "EGP" | "SAR" | "QAR" | "OMR" | "BHD";
  decimalPrecision: 2 | 3;
  roundingPolicy: StatutoryRoundingPolicy;
  timezoneDefault: string;
  workingWeekDays: string[];
  verificationStatus: CountryPackVerificationStatus;
  wpsSupported: boolean;
  incomeTaxSupported: boolean;
  socialInsuranceSupported: boolean;
  standardWorkingHoursPerDay: number;
  standardWorkingHoursPerWeek: number;
  ramadanWorkingHoursPerWeek?: number;
  maxProbationMonths: number;
  maxProbationDaysStandard: number;
  maxProbationDaysExtended?: number;
  standardNoticeDays: number;
  statutoryIdNameAr: string;
  statutoryIdNameEn: string;
  ibanPrefix: string;
}

export const COUNTRY_PACK_CATALOG: Record<CountryCode, CountryPackConfig> = {
  EG: {
    countryCode: "EG",
    nameAr: "جمهورية مصر العربية",
    nameEn: "Arab Republic of Egypt",
    currencyCode: "EGP",
    decimalPrecision: 2,
    roundingPolicy: "HALF_UP",
    timezoneDefault: "Africa/Cairo",
    workingWeekDays: ["sun", "mon", "tue", "wed", "thu"],
    verificationStatus: "production_active",
    wpsSupported: true,
    incomeTaxSupported: true,
    socialInsuranceSupported: true,
    standardWorkingHoursPerDay: 8,
    standardWorkingHoursPerWeek: 48,
    maxProbationMonths: 3,
    maxProbationDaysStandard: 90,
    standardNoticeDays: 60,
    statutoryIdNameAr: "الرقم القومي (14 رقماً)",
    statutoryIdNameEn: "National ID (14 digits)",
    ibanPrefix: "EG",
  },
  SA: {
    countryCode: "SA",
    nameAr: "المملكة العربية السعودية",
    nameEn: "Kingdom of Saudi Arabia",
    currencyCode: "SAR",
    decimalPrecision: 2,
    roundingPolicy: "HALF_UP",
    timezoneDefault: "Asia/Riyadh",
    workingWeekDays: ["sun", "mon", "tue", "wed", "thu"],
    verificationStatus: "production_active",
    wpsSupported: true,
    incomeTaxSupported: false,
    socialInsuranceSupported: true,
    standardWorkingHoursPerDay: 8,
    standardWorkingHoursPerWeek: 48,
    ramadanWorkingHoursPerWeek: 36,
    maxProbationMonths: 6, // 90 days extendable to 180 days with written agreement
    maxProbationDaysStandard: 90,
    maxProbationDaysExtended: 180,
    standardNoticeDays: 60,
    statutoryIdNameAr: "الهوية الوطنية / الإقامة (10 أرقام)",
    statutoryIdNameEn: "National ID / Iqama (10 digits)",
    ibanPrefix: "SA",
  },
  QA: {
    countryCode: "QA",
    nameAr: "دولة قطر",
    nameEn: "State of Qatar",
    currencyCode: "QAR",
    decimalPrecision: 2,
    roundingPolicy: "HALF_UP",
    timezoneDefault: "Asia/Qatar",
    workingWeekDays: ["sun", "mon", "tue", "wed", "thu"],
    verificationStatus: "production_active",
    wpsSupported: true,
    incomeTaxSupported: false,
    socialInsuranceSupported: true,
    standardWorkingHoursPerDay: 8,
    standardWorkingHoursPerWeek: 48,
    ramadanWorkingHoursPerWeek: 36,
    maxProbationMonths: 6,
    maxProbationDaysStandard: 180,
    standardNoticeDays: 30,
    statutoryIdNameAr: "البطاقة الشخصية القطرية QID (11 رقماً)",
    statutoryIdNameEn: "Qatar ID (11 digits)",
    ibanPrefix: "QA",
  },
  OM: {
    countryCode: "OM",
    nameAr: "سلطنة عمان",
    nameEn: "Sultanate of Oman",
    currencyCode: "OMR",
    decimalPrecision: 3,
    roundingPolicy: "HALF_UP",
    timezoneDefault: "Asia/Muscat",
    workingWeekDays: ["sun", "mon", "tue", "wed", "thu"],
    verificationStatus: "production_active",
    wpsSupported: true,
    incomeTaxSupported: false,
    socialInsuranceSupported: true,
    standardWorkingHoursPerDay: 8,
    standardWorkingHoursPerWeek: 40,
    ramadanWorkingHoursPerWeek: 30,
    maxProbationMonths: 3,
    maxProbationDaysStandard: 90,
    standardNoticeDays: 30,
    statutoryIdNameAr: "الرقم المدني العماني",
    statutoryIdNameEn: "Oman Civil Number",
    ibanPrefix: "OM",
  },
  BH: {
    countryCode: "BH",
    nameAr: "مملكة البحرين",
    nameEn: "Kingdom of Bahrain",
    currencyCode: "BHD",
    decimalPrecision: 3,
    roundingPolicy: "HALF_UP",
    timezoneDefault: "Asia/Bahrain",
    workingWeekDays: ["sun", "mon", "tue", "wed", "thu"],
    verificationStatus: "production_active",
    wpsSupported: true,
    incomeTaxSupported: false,
    socialInsuranceSupported: true,
    standardWorkingHoursPerDay: 8,
    standardWorkingHoursPerWeek: 48,
    ramadanWorkingHoursPerWeek: 36,
    maxProbationMonths: 3,
    maxProbationDaysStandard: 90,
    standardNoticeDays: 30,
    statutoryIdNameAr: "الرقم الشخصي البحريني CPR (9 أرقام)",
    statutoryIdNameEn: "Bahrain CPR (9 digits)",
    ibanPrefix: "BH",
  },
};

// ============================================================================
// CURRENCY PRECISION & ROUNDING ENGINE (SECTION 59)
// ============================================================================

export function roundByCountryCurrency(country: CountryCode, amount: number): number {
  const precision = COUNTRY_PACK_CATALOG[country]?.decimalPrecision ?? 2;
  const factor = Math.pow(10, precision);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

// ============================================================================
// VERSIONED EFFECTIVE-DATED STATUTORY RULE REGISTRY (SECTIONS 3, 5, 58)
// ============================================================================

export interface StatutoryRuleSetVersionConfig {
  countryCode: CountryCode;
  versionCode: string;
  versionNameAr: string;
  versionNameEn: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: StatutoryRuleSetStatus;
  proposedBy?: string;
  verifiedBy?: string;
  approvedBy?: string;
  socialInsurance: {
    nationalEmployeeRate: number;
    nationalEmployerRate: number;
    expatEmployeeRate: number;
    expatEmployerRate: number;
    minWageBasisNational: number;
    minWageBasisExpat: number;
    maxWageBasis: number | null;
    specialEmployeeRate: number;
    specialEmployerRate: number;
  };
  tax: {
    enabled: boolean;
    personalExemptionAnnual: number;
    brackets: EgyptTaxBracket[];
  };
  legalReference: string;
}

export const VERSIONED_STATUTORY_RULE_REGISTRY: Record<string, StatutoryRuleSetVersionConfig> = {
  "EG-2024-V1": {
    countryCode: "EG",
    versionCode: "EG-2024-V1",
    versionNameAr: "حزمة القوانين والضرائب المصرية 2024-2026",
    versionNameEn: "Egypt Statutory & Tax Pack 2024-2026",
    effectiveFrom: "2024-01-01",
    effectiveTo: "2026-12-31",
    status: "active",
    socialInsurance: {
      nationalEmployeeRate: 0.11,
      nationalEmployerRate: 0.1875,
      expatEmployeeRate: 0.11,
      expatEmployerRate: 0.1875,
      minWageBasisNational: 2000,
      minWageBasisExpat: 2000,
      maxWageBasis: 12600,
      specialEmployeeRate: 0.0005,
      specialEmployerRate: 0.01,
    },
    tax: {
      enabled: true,
      personalExemptionAnnual: 20000,
      brackets: EGYPT_TAX_BRACKETS,
    },
    legalReference: "NOSI Law 148/2019 & ETA Law 7/2024",
  },
  "EG-2027-V1": {
    countryCode: "EG",
    versionCode: "EG-2027-V1",
    versionNameAr: "حزمة القوانين والضرائب المصرية 2027 (شرائح وسقف تأميني محدث)",
    versionNameEn: "Egypt Statutory & Tax Pack 2027",
    effectiveFrom: "2027-01-01",
    effectiveTo: null,
    status: "scheduled",
    socialInsurance: {
      nationalEmployeeRate: 0.11,
      nationalEmployerRate: 0.1875,
      expatEmployeeRate: 0.11,
      expatEmployerRate: 0.1875,
      minWageBasisNational: 2300,
      minWageBasisExpat: 2300,
      maxWageBasis: 14500,
      specialEmployeeRate: 0.0005,
      specialEmployerRate: 0.01,
    },
    tax: {
      enabled: true,
      personalExemptionAnnual: 24000,
      brackets: EGYPT_TAX_BRACKETS_2027,
    },
    legalReference: "NOSI Law 148/2019 Annual Escalation 2027",
  },
  "SA-2024-V1": {
    countryCode: "SA",
    versionCode: "SA-2024-V1",
    versionNameAr: "حزمة التأمينات وحماية الأجور السعودية 2024-2026",
    versionNameEn: "Saudi Statutory & GOSI Pack 2024-2026",
    effectiveFrom: "2024-01-01",
    effectiveTo: "2026-12-31",
    status: "active",
    socialInsurance: {
      nationalEmployeeRate: 0.0975,
      nationalEmployerRate: 0.1175,
      expatEmployeeRate: 0,
      expatEmployerRate: 0.02,
      minWageBasisNational: 1500,
      minWageBasisExpat: 400,
      maxWageBasis: 45000,
      specialEmployeeRate: 0,
      specialEmployerRate: 0,
    },
    tax: { enabled: false, personalExemptionAnnual: 0, brackets: [] },
    legalReference: "GOSI Royal Decree M/33 & MHRSD Labor Law M/51",
  },
  "SA-2027-V1": {
    countryCode: "SA",
    versionCode: "SA-2027-V1",
    versionNameAr: "حزمة التأمينات وحماية الأجور السعودية 2027",
    versionNameEn: "Saudi Statutory & GOSI Pack 2027",
    effectiveFrom: "2027-01-01",
    effectiveTo: null,
    status: "scheduled",
    socialInsurance: {
      nationalEmployeeRate: 0.1025,
      nationalEmployerRate: 0.1225,
      expatEmployeeRate: 0,
      expatEmployerRate: 0.02,
      minWageBasisNational: 1500,
      minWageBasisExpat: 400,
      maxWageBasis: 45000,
      specialEmployeeRate: 0,
      specialEmployerRate: 0,
    },
    tax: { enabled: false, personalExemptionAnnual: 0, brackets: [] },
    legalReference: "GOSI Gradual Contribution Schedule 2027",
  },
  "QA-2024-V1": {
    countryCode: "QA",
    versionCode: "QA-2024-V1",
    versionNameAr: "حزمة العمل والتقاعد وحماية الأجور القطرية 2024-2026",
    versionNameEn: "Qatar Statutory & WPS Pack 2024-2026",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    status: "active",
    socialInsurance: {
      nationalEmployeeRate: 0.07,
      nationalEmployerRate: 0.14,
      expatEmployeeRate: 0,
      expatEmployerRate: 0,
      minWageBasisNational: 1000,
      minWageBasisExpat: 0,
      maxWageBasis: null,
      specialEmployeeRate: 0,
      specialEmployerRate: 0,
    },
    tax: { enabled: false, personalExemptionAnnual: 0, brackets: [] },
    legalReference: "GRSIA Law 1/2022 & Qatar Labor Law 14/2004",
  },
  "OM-2024-V1": {
    countryCode: "OM",
    versionCode: "OM-2024-V1",
    versionNameAr: "حزمة الحماية الاجتماعية وقانون العمل العماني 2024-2026",
    versionNameEn: "Oman Social Protection Pack 2024-2026",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    status: "active",
    socialInsurance: {
      nationalEmployeeRate: 0.08,
      nationalEmployerRate: 0.14,
      expatEmployeeRate: 0,
      expatEmployerRate: 0.01,
      minWageBasisNational: 100,
      minWageBasisExpat: 50,
      maxWageBasis: 3000,
      specialEmployeeRate: 0,
      specialEmployerRate: 0,
    },
    tax: { enabled: false, personalExemptionAnnual: 0, brackets: [] },
    legalReference: "Oman Royal Decrees 52/2023 (SPF) & 53/2023 (Labor Law)",
  },
  "BH-2024-V1": {
    countryCode: "BH",
    versionCode: "BH-2024-V1",
    versionNameAr: "حزمة التأمينات وحماية الأجور البحرينية 2024-2026",
    versionNameEn: "Bahrain SIO & Labor Pack 2024-2026",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    status: "active",
    socialInsurance: {
      nationalEmployeeRate: 0.08,
      nationalEmployerRate: 0.16,
      expatEmployeeRate: 0.01,
      expatEmployerRate: 0.03,
      minWageBasisNational: 100,
      minWageBasisExpat: 50,
      maxWageBasis: 4000,
      specialEmployeeRate: 0,
      specialEmployerRate: 0,
    },
    tax: { enabled: false, personalExemptionAnnual: 0, brackets: [] },
    legalReference: "Bahrain SIO Law 24/1976 & Labor Law 36/2012",
  },
};

export function resolveStatutoryRuleSet(
  country: CountryCode,
  effectiveDate: string = "2026-06-01",
  explicitVersion?: string
): StatutoryRuleSetVersionConfig {
  if (explicitVersion && VERSIONED_STATUTORY_RULE_REGISTRY[explicitVersion]) {
    return VERSIONED_STATUTORY_RULE_REGISTRY[explicitVersion];
  }
  const candidates = Object.values(VERSIONED_STATUTORY_RULE_REGISTRY).filter(
    (r) =>
      r.countryCode === country &&
      r.effectiveFrom <= effectiveDate &&
      (r.effectiveTo === null || r.effectiveTo >= effectiveDate)
  );
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return candidates[0];
  }
  return VERSIONED_STATUTORY_RULE_REGISTRY[`${country}-2024-V1`];
}

// ============================================================================
// CALCULATION TRACEABILITY (SECTION 6)
// ============================================================================

export interface StatutoryCalculationTrace {
  countryCode: CountryCode;
  ruleSetVersion: string;
  ruleCode: string;
  effectiveDate: string;
  currencyCode: string;
  decimalPrecision: number;
  roundingPolicy: StatutoryRoundingPolicy;
  inputs: Record<string, unknown>;
  wageBasis: number;
  appliedFloor: number;
  appliedCeiling: number | null;
  employeeAmount: number;
  employerAmount: number;
  legalReference: string;
  bracketSlices?: EgyptTaxBracketSlice[];
}

// ============================================================================
// STATUTORY VALIDATORS
// ============================================================================

export function validateNationalIdFormat(country: CountryCode, idValue: string): { valid: boolean; message?: string } {
  const cleaned = idValue.trim();
  if (!cleaned) return { valid: false, message: "رقم الهوية إلزامي" };

  switch (country) {
    case "EG":
      if (!/^\d{14}$/.test(cleaned)) {
        return { valid: false, message: "الرقم القومي المصري يجب أن يتكون من 14 رقماً بالضبط" };
      }
      return { valid: true };

    case "SA":
      if (!/^[12]\d{9}$/.test(cleaned)) {
        return { valid: false, message: "الهوية السعودية تبدأ بـ 1 للسعوديين و2 للإقامة وتتكون من 10 أرقام" };
      }
      return { valid: true };

    case "QA":
      if (!/^\d{11}$/.test(cleaned)) {
        return { valid: false, message: "البطاقة الشخصية القطرية QID يجب أن تتكون من 11 رقماً" };
      }
      return { valid: true };

    case "BH":
      if (!/^\d{9}$/.test(cleaned)) {
        return { valid: false, message: "الرقم الشخصي البحريني CPR يجب أن يتكون من 9 أرقام" };
      }
      return { valid: true };

    case "OM":
      if (!/^\d{7,10}$/.test(cleaned)) {
        return { valid: false, message: "الرقم المدني العماني يجب أن يكون من 7 إلى 10 أرقام" };
      }
      return { valid: true };

    default:
      return { valid: cleaned.length >= 6 };
  }
}

export function validateIbanFormat(country: CountryCode, iban: string): { valid: boolean; message?: string } {
  const cleaned = iban.replace(/\s+/g, "").toUpperCase();
  const config = COUNTRY_PACK_CATALOG[country];
  if (!config) return { valid: false, message: "دولة غير معتمدة" };

  if (!cleaned.startsWith(config.ibanPrefix)) {
    return { valid: false, message: `رقم الآيبان لهذه الدولة يجب أن يبدأ بـ ${config.ibanPrefix}` };
  }

  // Length requirements
  const expectedLengths: Record<CountryCode, number> = {
    EG: 29,
    SA: 24,
    QA: 29,
    OM: 23,
    BH: 22,
  };

  if (cleaned.length !== expectedLengths[country]) {
    return {
      valid: false,
      message: `طول الآيبان لـ ${config.nameAr} يجب أن يكون ${expectedLengths[country]} حرفاً ورقم (الحالي: ${cleaned.length})`,
    };
  }

  return { valid: true };
}

// ============================================================================
// EOS / END OF SERVICE DOMAIN ENGINE (5 COUNTRIES + SIMULATION WATERMARK)
// ============================================================================

export type SeparationReason =
  | "termination_by_employer"
  | "resignation"
  | "contract_expiration"
  | "force_majeure"
  | "retirement";

export interface EOSCalculationResult {
  countryCode: CountryCode;
  currencyCode: string;
  decimalPrecision: number;
  ruleVersion: string;
  serviceYearsDecimal: number;
  netServiceDays: number;
  wageBasis: number;
  baseEOS: number;
  resignationMultiplier: number;
  finalEOSAmount: number;
  ruleTitle: string;
  calculationTrace: StatutoryCalculationTrace;
}

export interface EOSSimulationResult extends EOSCalculationResult {
  simulationMode: true;
  watermark: "ESTIMATE / SIMULATION";
  persistedToPayrollOrSettlement: false;
}

export function calculateEOSByCountry(
  country: CountryCode,
  serviceStartDate: string,
  serviceEndDate: string,
  lastWageBasis: number,
  separationReason: SeparationReason = "termination_by_employer",
  unpaidDays: number = 0
): EOSCalculationResult {
  const start = new Date(serviceStartDate);
  const end = new Date(serviceEndDate);
  let calYears = end.getFullYear() - start.getFullYear();
  let calMonths = end.getMonth() - start.getMonth();
  let calDays = end.getDate() - start.getDate();
  if (calDays < 0) {
    calMonths -= 1;
    const prevMonthDays = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    calDays += prevMonthDays;
  }
  if (calMonths < 0) {
    calYears -= 1;
    calMonths += 12;
  }
  const totalDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const netServiceDays = Math.max(0, totalDays - unpaidDays);
  const serviceYearsDecimal =
    Math.round((calYears + calMonths / 12 + Math.max(0, calDays - unpaidDays) / 365.25) * 10000) / 10000;

  let baseEOS = 0;
  let multiplier = 1.0;
  let ruleTitle = "";

  switch (country) {
    case "SA":
      ruleTitle = "نظام العمل السعودي (المادتان 84 و 85)";
      if (serviceYearsDecimal <= 5) {
        baseEOS = serviceYearsDecimal * (lastWageBasis * 0.5);
      } else {
        baseEOS = 5 * (lastWageBasis * 0.5) + (serviceYearsDecimal - 5) * lastWageBasis;
      }
      if (separationReason === "resignation") {
        if (serviceYearsDecimal < 2) multiplier = 0;
        else if (serviceYearsDecimal < 5) multiplier = 0.3333;
        else if (serviceYearsDecimal < 10) multiplier = 0.6667;
        else multiplier = 1.0;
      }
      break;

    case "EG":
      ruleTitle = "قانون العمل المصري 12/2003 (المادة 126)";
      if (serviceYearsDecimal <= 5) {
        baseEOS = serviceYearsDecimal * (lastWageBasis * 0.5);
      } else {
        baseEOS = 5 * (lastWageBasis * 0.5) + (serviceYearsDecimal - 5) * lastWageBasis;
      }
      break;

    case "QA":
      ruleTitle = "قانون العمل القطري 14/2004 (المادة 54)";
      // Minimum 3 weeks basic salary per year of service (21/30 of monthly wage)
      baseEOS = serviceYearsDecimal * (lastWageBasis * (21 / 30));
      if (separationReason === "resignation" && serviceYearsDecimal < 2) {
        multiplier = 0;
      }
      break;

    case "OM":
      ruleTitle = "قانون العمل العماني المرسوم 53/2023 (المادة 61)";
      // 1 full month salary per year
      baseEOS = serviceYearsDecimal * lastWageBasis;
      break;

    case "BH":
      ruleTitle = "قانون العمل في القطاع الأهلي البحريني 36/2012 (المادة 116)";
      // 0.5 month for first 3 years, 1 month thereafter
      if (serviceYearsDecimal <= 3) {
        baseEOS = serviceYearsDecimal * (lastWageBasis * 0.5);
      } else {
        baseEOS = 3 * (lastWageBasis * 0.5) + (serviceYearsDecimal - 3) * lastWageBasis;
      }
      break;
  }

  const pack = COUNTRY_PACK_CATALOG[country];
  const ruleSet = resolveStatutoryRuleSet(country, serviceEndDate);
  const roundedBaseEOS = roundByCountryCurrency(country, baseEOS);
  const finalEOSAmount = roundByCountryCurrency(country, baseEOS * multiplier);

  return {
    countryCode: country,
    currencyCode: pack.currencyCode,
    decimalPrecision: pack.decimalPrecision,
    ruleVersion: ruleSet.versionCode,
    serviceYearsDecimal,
    netServiceDays,
    wageBasis: lastWageBasis,
    baseEOS: roundedBaseEOS,
    resignationMultiplier: multiplier,
    finalEOSAmount,
    ruleTitle,
    calculationTrace: {
      countryCode: country,
      ruleSetVersion: ruleSet.versionCode,
      ruleCode: `${country}_EOS_STATUTORY`,
      effectiveDate: serviceEndDate,
      currencyCode: pack.currencyCode,
      decimalPrecision: pack.decimalPrecision,
      roundingPolicy: pack.roundingPolicy,
      inputs: {
        serviceStartDate,
        serviceEndDate,
        lastWageBasis,
        separationReason,
        unpaidDays,
      },
      wageBasis: lastWageBasis,
      appliedFloor: 0,
      appliedCeiling: null,
      employeeAmount: 0,
      employerAmount: finalEOSAmount,
      legalReference: ruleTitle,
    },
  };
}

export function simulateCountryEOS(
  country: CountryCode,
  serviceStartDate: string,
  serviceEndDate: string,
  lastWageBasis: number,
  separationReason: SeparationReason = "resignation",
  unpaidDays: number = 0
): EOSSimulationResult {
  const result = calculateEOSByCountry(
    country,
    serviceStartDate,
    serviceEndDate,
    lastWageBasis,
    separationReason,
    unpaidDays
  );
  return {
    ...result,
    simulationMode: true,
    watermark: "ESTIMATE / SIMULATION",
    persistedToPayrollOrSettlement: false,
  };
}

// ============================================================================
// OVERTIME, WORKING TIME & LEAVE LOCALIZATION (SECTIONS 60, 61)
// ============================================================================

export function getStatutoryOvertimeMultiplier(
  country: CountryCode,
  type: "weekday" | "night" | "weekend_or_rest" | "public_holiday"
): number {
  switch (country) {
    case "SA":
      return 1.5; // Actual wage + 50%
    case "EG":
      if (type === "night") return 1.7; // +70%
      if (type === "public_holiday" || type === "weekend_or_rest") return 2.0; // Double pay
      return 1.35; // +35% daytime
    case "QA":
      if (type === "night" || type === "weekend_or_rest" || type === "public_holiday") return 1.5; // +50%
      return 1.25; // +25%
    case "OM":
      if (type === "public_holiday" || type === "weekend_or_rest") return 2.0;
      if (type === "night") return 1.5;
      return 1.25;
    case "BH":
      if (type === "night" || type === "weekend_or_rest" || type === "public_holiday") return 1.5;
      return 1.25;
  }
}

export interface CountryLeavePolicyConfig {
  countryCode: CountryCode;
  annualLeaveBaseDays: number;
  annualLeaveSeniorDays: number;
  seniorityThresholdYears: number;
  maternityLeavePaidDays: number;
  pilgrimageLeaveOnceDays: number;
  sickLeaveMaxDaysPerYear: number;
}

export const COUNTRY_LEAVE_POLICIES: Record<CountryCode, CountryLeavePolicyConfig> = {
  EG: {
    countryCode: "EG",
    annualLeaveBaseDays: 21,
    annualLeaveSeniorDays: 30,
    seniorityThresholdYears: 10,
    maternityLeavePaidDays: 90,
    pilgrimageLeaveOnceDays: 30,
    sickLeaveMaxDaysPerYear: 180,
  },
  SA: {
    countryCode: "SA",
    annualLeaveBaseDays: 21,
    annualLeaveSeniorDays: 30,
    seniorityThresholdYears: 5,
    maternityLeavePaidDays: 70,
    pilgrimageLeaveOnceDays: 10,
    sickLeaveMaxDaysPerYear: 120,
  },
  QA: {
    countryCode: "QA",
    annualLeaveBaseDays: 21,
    annualLeaveSeniorDays: 28,
    seniorityThresholdYears: 5,
    maternityLeavePaidDays: 50,
    pilgrimageLeaveOnceDays: 20,
    sickLeaveMaxDaysPerYear: 84,
  },
  OM: {
    countryCode: "OM",
    annualLeaveBaseDays: 30,
    annualLeaveSeniorDays: 30,
    seniorityThresholdYears: 1,
    maternityLeavePaidDays: 98,
    pilgrimageLeaveOnceDays: 15,
    sickLeaveMaxDaysPerYear: 182,
  },
  BH: {
    countryCode: "BH",
    annualLeaveBaseDays: 30,
    annualLeaveSeniorDays: 30,
    seniorityThresholdYears: 1,
    maternityLeavePaidDays: 60,
    pilgrimageLeaveOnceDays: 14,
    sickLeaveMaxDaysPerYear: 55,
  },
};

export function validateCountryLeaveEntitlement(
  country: CountryCode,
  serviceYears: number,
  configuredAnnualDays: number
): { valid: boolean; minimumRequiredDays: number; message?: string } {
  const policy = COUNTRY_LEAVE_POLICIES[country];
  const minimumRequiredDays =
    serviceYears >= policy.seniorityThresholdYears
      ? policy.annualLeaveSeniorDays
      : policy.annualLeaveBaseDays;
  if (configuredAnnualDays < minimumRequiredDays) {
    return {
      valid: false,
      minimumRequiredDays,
      message: `رصيد الإجازة السنوية (${configuredAnnualDays} يوم) أقل من الحد الأدنى النظامي (${minimumRequiredDays} يوم)`,
    };
  }
  return { valid: true, minimumRequiredDays };
}

export function validateCountryProbationPeriod(
  country: CountryCode,
  probationDays: number,
  hasWrittenExtension: boolean = false
): { valid: boolean; maxAllowedDays: number; message?: string } {
  const pack = COUNTRY_PACK_CATALOG[country];
  const maxAllowedDays =
    country === "SA" && hasWrittenExtension && pack.maxProbationDaysExtended
      ? pack.maxProbationDaysExtended
      : pack.maxProbationDaysStandard;

  if (probationDays > maxAllowedDays) {
    return {
      valid: false,
      maxAllowedDays,
      message: `فترة التجربة (${probationDays} يوم) تتجاوز الحد الأقصى النظامي (${maxAllowedDays} يوم)`,
    };
  }
  return { valid: true, maxAllowedDays };
}

export function validateWeeklyWorkingHours(
  country: CountryCode,
  weeklyHours: number,
  isRamadan: boolean = false
): { valid: boolean; maxWeeklyHours: number; excessOvertimeHours: number } {
  const pack = COUNTRY_PACK_CATALOG[country];
  const maxWeeklyHours =
    isRamadan && pack.ramadanWorkingHoursPerWeek
      ? pack.ramadanWorkingHoursPerWeek
      : pack.standardWorkingHoursPerWeek;
  const excessOvertimeHours = Math.max(0, weeklyHours - maxWeeklyHours);
  return {
    valid: excessOvertimeHours === 0,
    maxWeeklyHours,
    excessOvertimeHours,
  };
}

// ============================================================================
// UNIFIED WPS ARCHITECTURE & 5 COUNTRY ADAPTERS (SECTIONS 51, 52, 53, 54)
// ============================================================================

export interface WpsEmployeeRecordInput {
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  nationalOrResidentId: string;
  iban: string;
  bankCode: string;
  basicSalary: number;
  housingAllowance: number;
  otherAllowances: number;
  deductions: number;
  netSalary: number;
}

export interface WpsEmployerMetadata {
  employerId: string;
  employerName: string;
  establishmentNumber: string;
  payerIban: string;
  payerBankCode: string;
  periodStart: string;
  periodEnd: string;
  valueDate: string;
}

export interface WpsPackageGenerationResult {
  batchReference: string;
  countryCode: CountryCode;
  adapterCode: "SA_MUDAD_WPS" | "QA_QCB_SIF" | "OM_CBO_WPS" | "BH_LMRA_WPS" | "EG_CBE_PAYROLL";
  fileFormat: "sif" | "txt" | "csv" | "cbe_card";
  currencyCode: string;
  decimalPrecision: number;
  fileVersion: number;
  status: "validated" | "draft" | "superseded";
  supersedesBatchReference?: string;
  regenerationReason?: string;
  totalSalaries: number;
  employeeCount: number;
  validRecordCount: number;
  blockedRecordCount: number;
  warningRecordCount: number;
  validationPassed: boolean;
  fileName: string;
  fileContent: string;
  checksumHash: string;
  recordValidations: Array<{
    employeeId: string;
    status: "valid" | "warning" | "blocked";
    messages: string[];
  }>;
}

function computeDeterministicChecksum(content: string): string {
  let h1 = 0xdeadbeef ^ content.length;
  let h2 = 0x41c6ce57 ^ content.length;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, "0");
}

export function generateCountryWpsPackage(
  country: CountryCode,
  employer: WpsEmployerMetadata,
  records: WpsEmployeeRecordInput[],
  options?: {
    batchReference?: string;
    fileVersion?: number;
    supersedesBatchReference?: string;
    regenerationReason?: string;
  }
): WpsPackageGenerationResult {
  const pack = COUNTRY_PACK_CATALOG[country];
  const fileVersion = options?.fileVersion ?? 1;
  const batchReference =
    options?.batchReference ?? `WPS-${country}-${employer.periodEnd.slice(0, 7)}-V${fileVersion}`;

  const adapterMap: Record<
    CountryCode,
    { adapterCode: WpsPackageGenerationResult["adapterCode"]; fileFormat: WpsPackageGenerationResult["fileFormat"]; ext: string }
  > = {
    SA: { adapterCode: "SA_MUDAD_WPS", fileFormat: "txt", ext: "txt" },
    QA: { adapterCode: "QA_QCB_SIF", fileFormat: "sif", ext: "sif" },
    OM: { adapterCode: "OM_CBO_WPS", fileFormat: "csv", ext: "csv" },
    BH: { adapterCode: "BH_LMRA_WPS", fileFormat: "csv", ext: "csv" },
    EG: { adapterCode: "EG_CBE_PAYROLL", fileFormat: "cbe_card", ext: "csv" },
  };

  const { adapterCode, fileFormat, ext } = adapterMap[country];
  const recordValidations: WpsPackageGenerationResult["recordValidations"] = [];
  const lines: string[] = [];

  let totalSalaries = 0;
  let validRecordCount = 0;
  let blockedRecordCount = 0;
  let warningRecordCount = 0;

  // Header line per country adapter
  lines.push(
    `HDR,${adapterCode},${country},${employer.establishmentNumber},${employer.payerBankCode},${employer.payerIban},${employer.valueDate},${pack.currencyCode},V${fileVersion}`
  );

  for (const rec of records) {
    const messages: string[] = [];
    let status: "valid" | "warning" | "blocked" = "valid";

    const idCheck = validateNationalIdFormat(country, rec.nationalOrResidentId);
    if (!idCheck.valid) {
      status = "blocked";
      messages.push(idCheck.message || "Invalid statutory ID");
    }

    const ibanCheck = validateIbanFormat(country, rec.iban);
    if (!ibanCheck.valid) {
      status = "blocked";
      messages.push(ibanCheck.message || "Invalid IBAN");
    }

    const expectedNet = roundByCountryCurrency(
      country,
      rec.basicSalary + rec.housingAllowance + rec.otherAllowances - rec.deductions
    );
    const actualNet = roundByCountryCurrency(country, rec.netSalary);

    if (Math.abs(expectedNet - actualNet) > 0.01) {
      status = "blocked";
      messages.push(`Net salary mismatch: expected ${expectedNet}, got ${actualNet}`);
    } else if (actualNet <= 0) {
      if (status !== "blocked") status = "warning";
      messages.push("Zero or negative net salary");
    }

    if (status === "blocked") {
      blockedRecordCount += 1;
    } else if (status === "warning") {
      warningRecordCount += 1;
      validRecordCount += 1;
    } else {
      validRecordCount += 1;
    }

    recordValidations.push({
      employeeId: rec.employeeId,
      status,
      messages,
    });

    totalSalaries = roundByCountryCurrency(country, totalSalaries + actualNet);
    const precision = pack.decimalPrecision;
    lines.push(
      `EDR,${rec.employeeNo},${rec.nationalOrResidentId},${rec.bankCode},${rec.iban},${rec.basicSalary.toFixed(precision)},${rec.housingAllowance.toFixed(precision)},${rec.otherAllowances.toFixed(precision)},${rec.deductions.toFixed(precision)},${actualNet.toFixed(precision)},${status.toUpperCase()}`
    );
  }

  lines.push(
    `SCR,${records.length},${validRecordCount},${blockedRecordCount},${totalSalaries.toFixed(pack.decimalPrecision)},${pack.currencyCode}`
  );

  const fileContent = lines.join("\n");
  const validationPassed = blockedRecordCount === 0 && records.length > 0;

  return {
    batchReference,
    countryCode: country,
    adapterCode,
    fileFormat,
    currencyCode: pack.currencyCode,
    decimalPrecision: pack.decimalPrecision,
    fileVersion,
    status: validationPassed ? "validated" : "draft",
    supersedesBatchReference: options?.supersedesBatchReference,
    regenerationReason: options?.regenerationReason,
    totalSalaries,
    employeeCount: records.length,
    validRecordCount,
    blockedRecordCount,
    warningRecordCount,
    validationPassed,
    fileName: `${batchReference}.${ext}`,
    fileContent,
    checksumHash: computeDeterministicChecksum(fileContent),
    recordValidations,
  };
}

export function regenerateCountryWpsPackage(
  priorPackage: WpsPackageGenerationResult,
  employer: WpsEmployerMetadata,
  updatedRecords: WpsEmployeeRecordInput[],
  regenerationReason: string
): {
  supersededPackage: WpsPackageGenerationResult;
  newPackage: WpsPackageGenerationResult;
} {
  const supersededPackage: WpsPackageGenerationResult = {
    ...priorPackage,
    status: "superseded",
  };
  const nextVersion = priorPackage.fileVersion + 1;
  const newPackage = generateCountryWpsPackage(priorPackage.countryCode, employer, updatedRecords, {
    fileVersion: nextVersion,
    supersedesBatchReference: priorPackage.batchReference,
    regenerationReason,
  });
  return { supersededPackage, newPackage };
}

// ============================================================================
// HISTORICAL PAYROLL IMMUTABILITY, FOUR-EYES, SIMULATION & RETROACTIVE ENGINE
// (SECTIONS 5, 57, 58, 67, 68, 69)
// ============================================================================

export interface ImmutablePayrollStatutorySnapshot {
  snapshotId: string;
  payrollRunId: string;
  employeeId: string;
  countryCode: CountryCode;
  currencyCode: string;
  decimalPrecision: number;
  periodStart: string;
  periodEnd: string;
  countryPackVersion: string;
  socialInsuranceEmployee: number;
  socialInsuranceEmployer: number;
  incomeTaxMonthly: number;
  netPay: number;
  isLocked: true;
  calculationTrace: StatutoryCalculationTrace;
}

export function createImmutablePayrollStatutorySnapshot(params: {
  snapshotId: string;
  payrollRunId: string;
  employeeId: string;
  countryCode: CountryCode;
  periodStart: string;
  periodEnd: string;
  grossWage: number;
  isNational: boolean;
  explicitRuleVersion?: string;
}): ImmutablePayrollStatutorySnapshot {
  const { countryCode, periodEnd, grossWage, isNational, explicitRuleVersion } = params;
  const pack = COUNTRY_PACK_CATALOG[countryCode];
  const ruleSet = resolveStatutoryRuleSet(countryCode, periodEnd, explicitRuleVersion);

  let socialInsuranceEmployee = 0;
  let socialInsuranceEmployer = 0;
  let incomeTaxMonthly = 0;
  let insurableWage = grossWage;

  if (countryCode === "EG") {
    const si = calculateEgyptSocialInsurance(grossWage, { ruleVersion: ruleSet.versionCode });
    insurableWage = si.insurableWage;
    socialInsuranceEmployee = si.totalEmployeeDeduction;
    socialInsuranceEmployer = si.totalEmployerCost;
    const tax = calculateEgyptPayrollTax(grossWage, {
      ruleVersion: ruleSet.versionCode,
      socialInsuranceDeductionMonthly: si.employeeContribution,
    });
    incomeTaxMonthly = tax.monthlyTax;
  } else if (countryCode === "SA") {
    const minBasis = isNational ? ruleSet.socialInsurance.minWageBasisNational : ruleSet.socialInsurance.minWageBasisExpat;
    const maxBasis = ruleSet.socialInsurance.maxWageBasis ?? grossWage;
    insurableWage = Math.min(maxBasis, Math.max(minBasis, grossWage));
    const empRate = isNational ? ruleSet.socialInsurance.nationalEmployeeRate : ruleSet.socialInsurance.expatEmployeeRate;
    const erRate = isNational ? ruleSet.socialInsurance.nationalEmployerRate : ruleSet.socialInsurance.expatEmployerRate;
    socialInsuranceEmployee = roundByCountryCurrency(countryCode, insurableWage * empRate);
    socialInsuranceEmployer = roundByCountryCurrency(countryCode, insurableWage * erRate);
  } else if (countryCode === "QA") {
    const si = calculateQatarSocialInsurance(grossWage, isNational);
    insurableWage = si.insurableWage;
    socialInsuranceEmployee = si.totalEmployeeDeduction;
    socialInsuranceEmployer = si.employerContribution;
  } else if (countryCode === "OM") {
    const si = calculateOmanSocialInsurance(grossWage, isNational);
    insurableWage = si.insurableWage;
    socialInsuranceEmployee = si.totalEmployeeDeduction;
    socialInsuranceEmployer = si.employerContribution;
  } else if (countryCode === "BH") {
    const si = calculateBahrainSocialInsurance(grossWage, isNational);
    insurableWage = si.insurableWage;
    socialInsuranceEmployee = si.totalEmployeeDeduction;
    socialInsuranceEmployer = si.employerContribution;
  }

  const netPay = roundByCountryCurrency(
    countryCode,
    grossWage - socialInsuranceEmployee - incomeTaxMonthly
  );

  return Object.freeze({
    snapshotId: params.snapshotId,
    payrollRunId: params.payrollRunId,
    employeeId: params.employeeId,
    countryCode,
    currencyCode: pack.currencyCode,
    decimalPrecision: pack.decimalPrecision,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    countryPackVersion: ruleSet.versionCode,
    socialInsuranceEmployee,
    socialInsuranceEmployer,
    incomeTaxMonthly,
    netPay,
    isLocked: true,
    calculationTrace: {
      countryCode,
      ruleSetVersion: ruleSet.versionCode,
      ruleCode: `${countryCode}_PAYROLL_STATUTORY_SNAPSHOT`,
      effectiveDate: params.periodEnd,
      currencyCode: pack.currencyCode,
      decimalPrecision: pack.decimalPrecision,
      roundingPolicy: pack.roundingPolicy,
      inputs: { grossWage, isNational },
      wageBasis: insurableWage,
      appliedFloor: isNational
        ? ruleSet.socialInsurance.minWageBasisNational
        : ruleSet.socialInsurance.minWageBasisExpat,
      appliedCeiling: ruleSet.socialInsurance.maxWageBasis,
      employeeAmount: roundByCountryCurrency(countryCode, socialInsuranceEmployee + incomeTaxMonthly),
      employerAmount: socialInsuranceEmployer,
      legalReference: ruleSet.legalReference,
    },
  });
}

export function validateFourEyesRuleActivation(params: {
  ruleVersion: string;
  proposedByUserId: string;
  verifiedByUserId?: string;
  approvedByUserId: string;
}): { allowed: boolean; status: StatutoryRuleSetStatus; reason?: string } {
  if (!params.proposedByUserId || !params.approvedByUserId) {
    return { allowed: false, status: "draft", reason: "Both proposer and approver user IDs are required" };
  }
  if (params.proposedByUserId === params.approvedByUserId) {
    return {
      allowed: false,
      status: "verified",
      reason: "Four-eyes governance violation: proposer cannot approve and activate the same statutory rule set",
    };
  }
  return { allowed: true, status: "active" };
}

export interface RuleSimulationComparisonResult {
  countryCode: CountryCode;
  baselineVersion: string;
  candidateVersion: string;
  affectedEmployeesCount: number;
  baselineEmployerCost: number;
  candidateEmployerCost: number;
  employerCostDelta: number;
  baselineEmployeeDeduction: number;
  candidateEmployeeDeduction: number;
  employeeDeductionDelta: number;
  netPayDelta: number;
  mutatedLivePayroll: false;
}

export function simulateRuleVersionImpact(
  countryCode: CountryCode,
  baselineVersion: string,
  candidateVersion: string,
  employees: Array<{ employeeId: string; grossWage: number; isNational: boolean }>
): RuleSimulationComparisonResult {
  let baselineEmployerCost = 0;
  let candidateEmployerCost = 0;
  let baselineEmployeeDeduction = 0;
  let candidateEmployeeDeduction = 0;
  let baselineNetPay = 0;
  let candidateNetPay = 0;

  for (const emp of employees) {
    const baseSnap = createImmutablePayrollStatutorySnapshot({
      snapshotId: `sim-base-${emp.employeeId}`,
      payrollRunId: "SIMULATION_ONLY",
      employeeId: emp.employeeId,
      countryCode,
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      grossWage: emp.grossWage,
      isNational: emp.isNational,
      explicitRuleVersion: baselineVersion,
    });
    const candSnap = createImmutablePayrollStatutorySnapshot({
      snapshotId: `sim-cand-${emp.employeeId}`,
      payrollRunId: "SIMULATION_ONLY",
      employeeId: emp.employeeId,
      countryCode,
      periodStart: "2027-01-01",
      periodEnd: "2027-01-31",
      grossWage: emp.grossWage,
      isNational: emp.isNational,
      explicitRuleVersion: candidateVersion,
    });

    baselineEmployerCost += baseSnap.socialInsuranceEmployer;
    candidateEmployerCost += candSnap.socialInsuranceEmployer;
    baselineEmployeeDeduction += baseSnap.socialInsuranceEmployee + baseSnap.incomeTaxMonthly;
    candidateEmployeeDeduction += candSnap.socialInsuranceEmployee + candSnap.incomeTaxMonthly;
    baselineNetPay += baseSnap.netPay;
    candidateNetPay += candSnap.netPay;
  }

  return {
    countryCode,
    baselineVersion,
    candidateVersion,
    affectedEmployeesCount: employees.length,
    baselineEmployerCost: roundByCountryCurrency(countryCode, baselineEmployerCost),
    candidateEmployerCost: roundByCountryCurrency(countryCode, candidateEmployerCost),
    employerCostDelta: roundByCountryCurrency(countryCode, candidateEmployerCost - baselineEmployerCost),
    baselineEmployeeDeduction: roundByCountryCurrency(countryCode, baselineEmployeeDeduction),
    candidateEmployeeDeduction: roundByCountryCurrency(countryCode, candidateEmployeeDeduction),
    employeeDeductionDelta: roundByCountryCurrency(
      countryCode,
      candidateEmployeeDeduction - baselineEmployeeDeduction
    ),
    netPayDelta: roundByCountryCurrency(countryCode, candidateNetPay - baselineNetPay),
    mutatedLivePayroll: false,
  };
}

export interface RetroactiveStatutoryAdjustmentProposal {
  employeeId: string;
  countryCode: CountryCode;
  closedPayrollRunId: string;
  targetOpenPayrollRunId: string;
  priorRuleVersion: string;
  retroactiveRuleVersion: string;
  employeeDeductionDelta: number;
  employerContributionDelta: number;
  taxDelta: number;
  netAdjustmentAmount: number;
  status: "proposed" | "approved";
  historicalSnapshotMutated: false;
}

export function createRetroactiveStatutoryAdjustmentProposal(params: {
  closedSnapshot: ImmutablePayrollStatutorySnapshot;
  retroactiveRuleVersion: string;
  targetOpenPayrollRunId: string;
  grossWage: number;
  isNational: boolean;
}): RetroactiveStatutoryAdjustmentProposal {
  const recalculated = createImmutablePayrollStatutorySnapshot({
    snapshotId: `retro-${params.closedSnapshot.snapshotId}`,
    payrollRunId: params.targetOpenPayrollRunId,
    employeeId: params.closedSnapshot.employeeId,
    countryCode: params.closedSnapshot.countryCode,
    periodStart: params.closedSnapshot.periodStart,
    periodEnd: params.closedSnapshot.periodEnd,
    grossWage: params.grossWage,
    isNational: params.isNational,
    explicitRuleVersion: params.retroactiveRuleVersion,
  });

  const c = params.closedSnapshot.countryCode;
  const employeeDeductionDelta = roundByCountryCurrency(
    c,
    recalculated.socialInsuranceEmployee - params.closedSnapshot.socialInsuranceEmployee
  );
  const employerContributionDelta = roundByCountryCurrency(
    c,
    recalculated.socialInsuranceEmployer - params.closedSnapshot.socialInsuranceEmployer
  );
  const taxDelta = roundByCountryCurrency(
    c,
    recalculated.incomeTaxMonthly - params.closedSnapshot.incomeTaxMonthly
  );
  const netAdjustmentAmount = roundByCountryCurrency(
    c,
    recalculated.netPay - params.closedSnapshot.netPay
  );

  return {
    employeeId: params.closedSnapshot.employeeId,
    countryCode: c,
    closedPayrollRunId: params.closedSnapshot.payrollRunId,
    targetOpenPayrollRunId: params.targetOpenPayrollRunId,
    priorRuleVersion: params.closedSnapshot.countryPackVersion,
    retroactiveRuleVersion: params.retroactiveRuleVersion,
    employeeDeductionDelta,
    employerContributionDelta,
    taxDelta,
    netAdjustmentAmount,
    status: "proposed",
    historicalSnapshotMutated: false,
  };
}

// ============================================================================
// CROSS-COUNTRY EMPLOYEE LOCALIZATION HISTORY (SECTION 57)
// ============================================================================

export interface EmployeeLocalizationSlice {
  employeeId: string;
  countryCode: CountryCode;
  currencyCode: string;
  countryPackVersion: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  transferReason?: string;
}

export function transferEmployeeBetweenCountries(
  existingHistory: EmployeeLocalizationSlice[],
  transfer: {
    employeeId: string;
    newCountryCode: CountryCode;
    effectiveDate: string;
    transferReason: string;
  }
): EmployeeLocalizationSlice[] {
  const prevDay = new Date(transfer.effectiveDate);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
  const closedDateStr = prevDay.toISOString().slice(0, 10);

  const updated = existingHistory.map((slice) => {
    if (
      slice.employeeId === transfer.employeeId &&
      slice.effectiveTo === null &&
      slice.effectiveFrom < transfer.effectiveDate
    ) {
      return {
        ...slice,
        effectiveTo: closedDateStr,
      };
    }
    return { ...slice };
  });

  const targetPack = COUNTRY_PACK_CATALOG[transfer.newCountryCode];
  const targetRule = resolveStatutoryRuleSet(transfer.newCountryCode, transfer.effectiveDate);

  updated.push({
    employeeId: transfer.employeeId,
    countryCode: transfer.newCountryCode,
    currencyCode: targetPack.currencyCode,
    countryPackVersion: targetRule.versionCode,
    effectiveFrom: transfer.effectiveDate,
    effectiveTo: null,
    transferReason: transfer.transferReason,
  });

  return updated;
}

export function resolveEmployeeCountryPackForPeriod(
  history: EmployeeLocalizationSlice[],
  employeeId: string,
  periodDate: string
): EmployeeLocalizationSlice | undefined {
  return history.find(
    (h) =>
      h.employeeId === employeeId &&
      h.effectiveFrom <= periodDate &&
      (h.effectiveTo === null || h.effectiveTo >= periodDate)
  );
}

// ============================================================================
// RBAC PERMISSIONS & SENSITIVE STATUTORY FIELD SECURITY (SECTIONS 77, 78, 79)
// ============================================================================

export const COUNTRY_PACK_PERMISSIONS = [
  "country_packs.read",
  "country_packs.manage",
  "statutory_rules.read",
  "statutory_rules.propose",
  "statutory_rules.verify",
  "statutory_rules.activate",
  "statutory_reports.read",
  "statutory_reports.generate",
  "statutory_reports.submit",
  "wps.generate",
  "wps.approve",
  "wps.export",
] as const;

export type CountryPackPermission = (typeof COUNTRY_PACK_PERMISSIONS)[number];

export function maskStatutoryIdentifier(rawValue: string | null | undefined, canViewUnmasked: boolean = false): string {
  if (!rawValue) return "—";
  if (canViewUnmasked) return rawValue;
  const cleaned = rawValue.trim();
  if (cleaned.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, cleaned.length - 4))}${cleaned.slice(-4)}`;
}

const SENSITIVE_STATUTORY_KEYS = new Set([
  "nationalid",
  "national_id",
  "residency_or_national_id",
  "iqama",
  "qid",
  "cpr",
  "civilnumber",
  "civil_or_cpr_or_qid",
  "iban",
  "bankaccount",
  "bank_account",
  "socialinsurancenumber",
  "social_insurance_number",
  "taxidentifier",
  "tax_identifier",
  "passportnumber",
  "passport_number",
]);

export function sanitizeStatutoryLogPayload<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (SENSITIVE_STATUTORY_KEYS.has(normalizedKey)) {
      sanitized[key] = typeof val === "string" ? maskStatutoryIdentifier(val, false) : "[REDACTED]";
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      sanitized[key] = sanitizeStatutoryLogPayload(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

// Re-exports
export {
  EGYPT_SOURCES,
  EGYPT_TAX_BRACKETS,
  EGYPT_TAX_BRACKETS_2027,
  calculateEgyptPayrollTax,
  calculateEgyptSocialInsurance,
  SAUDI_SOURCES,
  calculateSaudiSocialInsurance,
  QATAR_SOURCES,
  calculateQatarSocialInsurance,
  OMAN_SOURCES,
  calculateOmanSocialInsurance,
  BAHRAIN_SOURCES,
  calculateBahrainSocialInsurance,
  type EgyptTaxBracket,
  type EgyptTaxBracketSlice,
  type StatutoryRuleMetadata,
};
