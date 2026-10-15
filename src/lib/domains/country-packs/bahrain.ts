// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: PRODUCTION COUNTRY PACK — BAHRAIN (BH)
// src/lib/domains/country-packs/bahrain.ts
// ============================================================================

import type { StatutoryRuleMetadata } from "./egypt";

export const BAHRAIN_SOURCES: Record<string, StatutoryRuleMetadata> = {
  socialInsurance: {
    ruleCode: "BH_SIO_LAW_24",
    sourceAuthority: "الهيئة العامة للتأمين الاجتماعي بمملكة البحرين (SIO)",
    sourceTitle: "قانون التأمين الاجتماعي رقم 24 لسنة 1976 وقانون التأمين ضد التعطل 78 لسنة 2006 وتعديلاته بالقانون 14 لسنة 2022",
    publicationRef: "الجريدة الرسمية البحرينية - العدد 1195 والعدد 2769",
    sourceUrl: "https://www.sio.gov.bh",
    effectiveFrom: "2022-04-18",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "BH-SIO-2024.1",
    notes: "نسبة البحرينيين: 8% موظف (7% تقاعد + 1% تعطل)، 16% صاحب عمل (12% تقاعد + 3% إصابات + 1% تعطل)، الحد الأقصى للأجر 4,000 دينار. غير البحرينيين: 1% تعطل موظف، 3% إصابات صاحب عمل.",
  },
  laborLaw: {
    ruleCode: "BH_LMRA_LAW_36",
    sourceAuthority: "وزارة العمل وهيئة تنظيم سوق العمل (LMRA)",
    sourceTitle: "قانون العمل في القطاع الأهلي رقم 36 لسنة 2012",
    publicationRef: "الجريدة الرسمية البحرينية - العدد 3063 بتاريخ 2 أغسطس 2012",
    sourceUrl: "https://www.mol.gov.bh",
    effectiveFrom: "2012-09-02",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "BH-MOL-2024.1",
    notes: "ساعات العمل 8 يومياً و48 أسبوعياً (36 في رمضان للمسلمين)، فترة التجربة بحد أقصى 3 أشهر، إجازة سنوية 30 يوماً براتب كامل (2.5 يوم شهرياً)، مكافأة نهاية الخدمة نصف شهر عن كل سنة من السنوات الثلاث الأولى وشهر عن كل سنة تالية (المادة 116).",
  },
  wps: {
    ruleCode: "BH_LMRA_WPS_2019",
    sourceAuthority: "مصرف البحرين المركزي وهيئة تنظيم سوق العمل",
    sourceTitle: "نظام حماية الأجور بمملكة البحرين",
    publicationRef: "قرار رقم 68 لسنة 2019 بشأن نظام حماية الأجور",
    sourceUrl: "https://lmra.gov.bh",
    effectiveFrom: "2019-09-01",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "BH-WPS-2024.1",
    notes: "تحويل الرواتب للمصارف المعتمدة بالرقم الشخصي CPR ورقم السجل التجاري CR والآيبان.",
  },
};

export function calculateBahrainSocialInsurance(wage: number, isBahraini: boolean): {
  insurableWage: number;
  employeeContribution: number;
  employerContribution: number;
  totalEmployeeDeduction: number;
} {
  const maxBasis = 4000; // 4,000 BHD cap
  const minBasis = isBahraini ? 100 : 50;
  const insurableWage = Math.min(maxBasis, Math.max(minBasis, wage));

  if (!isBahraini) {
    // 1% unemployment employee, 3% work injury employer
    const employeeContribution = Math.round(insurableWage * 0.01 * 1000) / 1000;
    const employerContribution = Math.round(insurableWage * 0.03 * 1000) / 1000;
    return {
      insurableWage,
      employeeContribution,
      employerContribution,
      totalEmployeeDeduction: employeeContribution,
    };
  }

  // 8% employee (7% retirement + 1% unemployment)
  const employeeContribution = Math.round(insurableWage * 0.08 * 1000) / 1000;
  // 16% employer (12% retirement + 3% work injury + 1% unemployment)
  const employerContribution = Math.round(insurableWage * 0.16 * 1000) / 1000;

  return {
    insurableWage,
    employeeContribution,
    employerContribution,
    totalEmployeeDeduction: employeeContribution,
  };
}
