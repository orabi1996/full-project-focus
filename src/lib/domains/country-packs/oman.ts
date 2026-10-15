// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: PRODUCTION COUNTRY PACK — OMAN (OM)
// src/lib/domains/country-packs/oman.ts
// ============================================================================

import type { StatutoryRuleMetadata } from "./egypt";

export const OMAN_SOURCES: Record<string, StatutoryRuleMetadata> = {
  socialInsurance: {
    ruleCode: "OM_SPF_RD_52",
    sourceAuthority: "صندوق الحماية الاجتماعية سلطنة عمان (SPF)",
    sourceTitle: "قانون الحماية الاجتماعية الصادر بالمرسوم السلطاني رقم 52/2023",
    publicationRef: "الجريدة الرسمية العمانية - العدد 1503 بتاريخ 23 يوليو 2023",
    sourceUrl: "https://www.spf.gov.om",
    effectiveFrom: "2024-01-01",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "OM-SPF-2024.1",
    notes: "نسبة العمانيين: 8% موظف (7.5% تقاعد + 0.5% أمان وظيفي)، 14% صاحب عمل (10.5% تقاعد + 1% إصابات + 0.5% أمان وظيفي + 1% أمومة + 1% إجازات مرضية). سقف الأجر 3,000 ريال عماني. غير العمانيين: 1% إصابات عمل صاحب عمل.",
  },
  laborLaw: {
    ruleCode: "OM_MOL_RD_53",
    sourceAuthority: "وزارة العمل سلطنة عمان (MOL)",
    sourceTitle: "قانون العمل العماني الجديد الصادر بالمرسوم السلطاني رقم 53/2023",
    publicationRef: "مرسوم سلطاني رقم 53/2023 - الجريدة الرسمية العدد 1504 بتاريخ 30 يوليو 2023",
    sourceUrl: "https://www.mol.gov.om",
    effectiveFrom: "2023-07-31",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "OM-MOL-2024.1",
    notes: "ساعات العمل 8 يومياً و40 أسبوعياً، فترة التجربة بحد أقصى 3 أشهر، إجازة سنوية 30 يوماً براتب كامل (بمعدل 2.5 يوم شهرياً)، مكافأة نهاية الخدمة راتب شهر أساسي عن كل سنة خدمة (المادة 61).",
  },
  wps: {
    ruleCode: "OM_CBO_WPS_2023",
    sourceAuthority: "البنك المركزي العماني ووزارة العمل",
    sourceTitle: "نظام حماية الأجور وتحويل الرواتب الإلكتروني",
    publicationRef: "القرار الوزاري رقم 299/2023 بشأن حماية الأجور",
    sourceUrl: "https://www.cbo.gov.om",
    effectiveFrom: "2023-07-10",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "OM-WPS-2024.1",
    notes: "تحويل الرواتب للمصارف المعتمدة بالسلطنة برقم السجل التجاري والرقم المدني للموظف.",
  },
};

export function calculateOmanSocialInsurance(wage: number, isOmani: boolean): {
  insurableWage: number;
  employeeContribution: number;
  employerContribution: number;
  totalEmployeeDeduction: number;
} {
  const maxBasis = 3000; // 3,000 OMR cap
  const minBasis = isOmani ? 100 : 50;
  const insurableWage = Math.min(maxBasis, Math.max(minBasis, wage));

  if (!isOmani) {
    const employerContribution = Math.round(insurableWage * 0.01 * 1000) / 1000; // 1% work injury
    return {
      insurableWage,
      employeeContribution: 0,
      employerContribution,
      totalEmployeeDeduction: 0,
    };
  }

  // 8% employee (7.5% retirement + 0.5% job security)
  const employeeContribution = Math.round(insurableWage * 0.08 * 1000) / 1000;
  // 14% employer
  const employerContribution = Math.round(insurableWage * 0.14 * 1000) / 1000;

  return {
    insurableWage,
    employeeContribution,
    employerContribution,
    totalEmployeeDeduction: employeeContribution,
  };
}
