// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: PRODUCTION MULTI-COUNTRY STATUTORY COUNTRY PACKS DOMAIN
// src/lib/domains/country-packs/index.ts
// ============================================================================

import { EGYPT_SOURCES, calculateEgyptPayrollTax, calculateEgyptSocialInsurance } from "./egypt";
import { SAUDI_SOURCES, calculateSaudiSocialInsurance } from "./saudi-arabia";
import { QATAR_SOURCES, calculateQatarSocialInsurance } from "./qatar";
import { OMAN_SOURCES, calculateOmanSocialInsurance } from "./oman";
import { BAHRAIN_SOURCES, calculateBahrainSocialInsurance } from "./bahrain";

export type CountryCode = "EG" | "SA" | "QA" | "OM" | "BH";

export interface CountryPackConfig {
  countryCode: CountryCode;
  nameAr: string;
  nameEn: string;
  currencyCode: string;
  wpsSupported: boolean;
  incomeTaxSupported: boolean;
  socialInsuranceSupported: boolean;
  standardWorkingHoursPerDay: number;
  standardWorkingHoursPerWeek: number;
  ramadanWorkingHoursPerWeek?: number;
  maxProbationMonths: number;
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
    wpsSupported: true,
    incomeTaxSupported: true,
    socialInsuranceSupported: true,
    standardWorkingHoursPerDay: 8,
    standardWorkingHoursPerWeek: 48,
    maxProbationMonths: 3,
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
    wpsSupported: true,
    incomeTaxSupported: false,
    socialInsuranceSupported: true,
    standardWorkingHoursPerDay: 8,
    standardWorkingHoursPerWeek: 48,
    ramadanWorkingHoursPerWeek: 36,
    maxProbationMonths: 6, // 90 days extendable to 180 days
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
    wpsSupported: true,
    incomeTaxSupported: false,
    socialInsuranceSupported: true,
    standardWorkingHoursPerDay: 8,
    standardWorkingHoursPerWeek: 48,
    ramadanWorkingHoursPerWeek: 36,
    maxProbationMonths: 6,
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
    wpsSupported: true,
    incomeTaxSupported: false,
    socialInsuranceSupported: true,
    standardWorkingHoursPerDay: 8,
    standardWorkingHoursPerWeek: 40,
    maxProbationMonths: 3,
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
    wpsSupported: true,
    incomeTaxSupported: false,
    socialInsuranceSupported: true,
    standardWorkingHoursPerDay: 8,
    standardWorkingHoursPerWeek: 48,
    ramadanWorkingHoursPerWeek: 36,
    maxProbationMonths: 3,
    standardNoticeDays: 30,
    statutoryIdNameAr: "الرقم الشخصي البحريني CPR (9 أرقام)",
    statutoryIdNameEn: "Bahrain CPR (9 digits)",
    ibanPrefix: "BH",
  },
};

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
// EOS / END OF SERVICE DOMAIN ENGINE (5 COUNTRIES)
// ============================================================================

export type SeparationReason =
  | "termination_by_employer"
  | "resignation"
  | "contract_expiration"
  | "force_majeure"
  | "retirement";

export interface EOSCalculationResult {
  countryCode: CountryCode;
  serviceYearsDecimal: number;
  netServiceDays: number;
  wageBasis: number;
  baseEOS: number;
  resignationMultiplier: number;
  finalEOSAmount: number;
  ruleTitle: string;
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
  const serviceYearsDecimal = Math.round((calYears + calMonths / 12 + Math.max(0, calDays - unpaidDays) / 365.25) * 10000) / 10000;

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
      // Minimum 3 weeks basic salary per year of service (3/4 of monthly wage)
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

  const finalEOSAmount = Math.round(baseEOS * multiplier * 100) / 100;

  return {
    countryCode: country,
    serviceYearsDecimal,
    netServiceDays,
    wageBasis: lastWageBasis,
    baseEOS: Math.round(baseEOS * 100) / 100,
    resignationMultiplier: multiplier,
    finalEOSAmount,
    ruleTitle,
  };
}

// ============================================================================
// OVERTIME MULTIPLIER DOMAIN
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

// Re-exports
export {
  EGYPT_SOURCES,
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
};
