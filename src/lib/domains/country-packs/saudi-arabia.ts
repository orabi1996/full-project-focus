// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: PRODUCTION COUNTRY PACK — SAUDI ARABIA (SA)
// src/lib/domains/country-packs/saudi-arabia.ts
// ============================================================================

import type { StatutoryRuleMetadata } from "./egypt";

export const SAUDI_SOURCES: Record<string, StatutoryRuleMetadata> = {
  socialInsurance: {
    ruleCode: "SA_GOSI_RD_M33",
    sourceAuthority: "المؤسسة العامة للتأمينات الاجتماعية (GOSI)",
    sourceTitle: "نظام التأمينات الاجتماعية بالمرسوم الملكي م/33 ولوائح ساند",
    publicationRef: "أم القرى العدد 3824 بتاريخ 29 نوفمبر 2000 وتعديلاته",
    sourceUrl: "https://www.gosi.gov.sa",
    effectiveFrom: "2000-11-29",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "SA-GOSI-2024.1",
    notes: "نسبة السعوديين: 9.75% موظف (9% معاشات + 0.75% ساند)، 11.75% منشأة (9% معاشات + 0.75% ساند + 2% أخطار مهنية). سقف الأجر الخاضع 45,000 ريال والحد الأدنى 1,500 ريال. غير السعوديين: 2% أخطار مهنية منشأة فقط.",
  },
  laborLaw: {
    ruleCode: "SA_MHRSD_RD_M51",
    sourceAuthority: "وزارة الموارد البشرية والتنمية الاجتماعية (MHRSD)",
    sourceTitle: "نظام العمل السعودي الصادر بالمرسوم الملكي م/51",
    publicationRef: "أم القرى العدد 4068 بتاريخ 23 أبريل 2006 وتعديلاته بالمرسوم م/46",
    sourceUrl: "https://hrsd.gov.sa",
    effectiveFrom: "2006-04-23",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "SA-MHRSD-2024.1",
    notes: "ساعات العمل 8 يومياً و48 أسبوعياً (6 ساعات في رمضان للمسلمين)، فترة التجربة 90 يوماً وتمدد إلى 180 يوماً باتفاق كتابي، إجازة سنوية 21 يوماً ترتفع إلى 30 يوماً بعد 5 سنوات.",
  },
  wps: {
    ruleCode: "SA_MUDAD_WPS_2020",
    sourceAuthority: "وزارة الموارد البشرية والبنك المركزي السعودي ومنصة مدد",
    sourceTitle: "الضوابط التشغيلية لبرنامج حماية الأجور السعودي",
    publicationRef: "القرار الوزاري رقم 77488 وتعاميم البنك المركزي السعودي SAMA",
    sourceUrl: "https://mudad.com.sa",
    effectiveFrom: "2020-10-01",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "SA-WPS-2024.1",
    notes: "تنسيق ملف صرف الرواتب يتضمن رقم المنشأة، رمز البنك، آيبان الموظف، رقم الهوية/الإقامة، الراتب الأساسي، بدل السكن، البدلات الأخرى، والاستقطاعات.",
  },
};

export function calculateSaudiSocialInsurance(wage: number, isSaudi: boolean): {
  insurableWage: number;
  employeeContribution: number;
  employerContribution: number;
  pensionEmployee: number;
  pensionEmployer: number;
  sanedEmployee: number;
  sanedEmployer: number;
  hazardsEmployer: number;
  totalEmployeeDeduction: number;
} {
  const minBasis = isSaudi ? 1500 : 400;
  const maxBasis = 45000;
  const insurableWage = Math.min(maxBasis, Math.max(minBasis, wage));

  if (!isSaudi) {
    const hazardsEmployer = Math.round(insurableWage * 0.02 * 100) / 100;
    return {
      insurableWage,
      employeeContribution: 0,
      employerContribution: hazardsEmployer,
      pensionEmployee: 0,
      pensionEmployer: 0,
      sanedEmployee: 0,
      sanedEmployer: 0,
      hazardsEmployer,
      totalEmployeeDeduction: 0,
    };
  }

  const pensionEmployee = Math.round(insurableWage * 0.09 * 100) / 100;
  const pensionEmployer = Math.round(insurableWage * 0.09 * 100) / 100;
  const sanedEmployee = Math.round(insurableWage * 0.0075 * 100) / 100;
  const sanedEmployer = Math.round(insurableWage * 0.0075 * 100) / 100;
  const hazardsEmployer = Math.round(insurableWage * 0.02 * 100) / 100;

  const employeeContribution = Math.round((pensionEmployee + sanedEmployee) * 100) / 100;
  const employerContribution = Math.round((pensionEmployer + sanedEmployer + hazardsEmployer) * 100) / 100;

  return {
    insurableWage,
    employeeContribution,
    employerContribution,
    pensionEmployee,
    pensionEmployer,
    sanedEmployee,
    sanedEmployer,
    hazardsEmployer,
    totalEmployeeDeduction: employeeContribution,
  };
}
