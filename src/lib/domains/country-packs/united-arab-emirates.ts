// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PRODUCTION COUNTRY PACK — UNITED ARAB EMIRATES (AE)
// src/lib/domains/country-packs/united-arab-emirates.ts
// ============================================================================

import type { StatutoryRuleMetadata } from "./egypt";

export const UAE_SOURCES: Record<string, StatutoryRuleMetadata> = {
  socialInsurance: {
    ruleCode: "AE_GPSSA_LAW_57",
    sourceAuthority: "الهيئة الاتحادية للتأمين الاجتماعي بدولة الإمارات (GPSSA)",
    sourceTitle: "مرسوم بقانون اتحادي رقم 57 لسنة 2023 بشأن المعاشات والتأمينات الاجتماعية",
    publicationRef: "الجريدة الرسمية لدولة الإمارات - العدد 763 بتاريخ 17 نوفمبر 2023",
    sourceUrl: "https://www.gpssa.gov.ae",
    effectiveFrom: "2023-10-01",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "AE-GPSSA-2024.1",
    notes: "نسبة المواطنين الإماراتيين بالقطاع الخاص: 11% اشتراك موظف، 15% اشتراك صاحب عمل (يتحمل صندوق نافس نسبة دعم للمواطنين المؤهلين)، سقف الأجر الخاضع للاشتراك 70,000 درهم إماراتي. غير المواطنين: 0% اشتراكات تقاعدية، وتطبق مكافأة نهاية الخدمة وفق قانون العمل أو نظام الادخار البديل.",
  },
  laborLaw: {
    ruleCode: "AE_MOHRE_LAW_33",
    sourceAuthority: "وزارة الموارد البشرية والتوطين (MOHRE)",
    sourceTitle: "مرسوم بقانون اتحادي رقم 33 لسنة 2021 بشأن تنظيم علاقات العمل ولائحته التنفيذية",
    publicationRef: "الجريدة الرسمية لدولة الإمارات - العدد 715 بتاريخ 15 نوفمبر 2021",
    sourceUrl: "https://www.mohre.gov.ae",
    effectiveFrom: "2022-02-02",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "AE-MOHRE-2024.1",
    notes: "ساعات العمل 8 يومياً و48 أسبوعياً (تخفض ساعتين يومياً في رمضان)، فترة التجربة بحد أقصى 6 أشهر، إجازة سنوية 30 يوماً تقويمياً براتب كامل، مكافأة نهاية الخدمة 21 يوماً عن كل سنة من السنوات الخمس الأولى و30 يوماً عن كل سنة تالية وبحد أقصى أجر سنتين (المادة 51).",
  },
  wps: {
    ruleCode: "AE_CBUAE_WPS_2009",
    sourceAuthority: "مصرف الإمارات العربية المتحدة المركزي (CBUAE) ووزارة الموارد البشرية والتوطين (MOHRE)",
    sourceTitle: "نظام حماية الأجور لدولة الإمارات (CBUAE / MOHRE WPS)",
    publicationRef: "القرار الوزاري رقم 788 لسنة 2009 والتعاميم المنظمة الصادرة عن المصرف المركزي",
    sourceUrl: "https://www.centralbank.ae",
    effectiveFrom: "2009-09-01",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "AE-WPS-2024.1",
    notes: "تحويل الرواتب للمصارف ومحلات الصرافة المعتمدة برمز توجيه المنشأة ورقم بطاقة العمل / الهوية الإماراتية EID والآيبان المكون من 23 حرفاً ورقم.",
  },
};

export function calculateUaeSocialInsurance(wage: number, isEmirati: boolean): {
  insurableWage: number;
  employeeContribution: number;
  employerContribution: number;
  totalEmployeeDeduction: number;
} {
  if (!isEmirati) {
    return {
      insurableWage: 0,
      employeeContribution: 0,
      employerContribution: 0,
      totalEmployeeDeduction: 0,
    };
  }

  const minBasis = 1000;
  const maxBasis = 70000; // 70,000 AED cap under Decree-Law 57/2023
  const insurableWage = Math.min(maxBasis, Math.max(minBasis, wage));

  // 11% employee contribution
  const employeeContribution = Math.round(insurableWage * 0.11 * 100) / 100;
  // 15% employer contribution
  const employerContribution = Math.round(insurableWage * 0.15 * 100) / 100;

  return {
    insurableWage,
    employeeContribution,
    employerContribution,
    totalEmployeeDeduction: employeeContribution,
  };
}
