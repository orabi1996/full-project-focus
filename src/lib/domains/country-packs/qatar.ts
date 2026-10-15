// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: PRODUCTION COUNTRY PACK — QATAR (QA)
// src/lib/domains/country-packs/qatar.ts
// ============================================================================

import type { StatutoryRuleMetadata } from "./egypt";

export const QATAR_SOURCES: Record<string, StatutoryRuleMetadata> = {
  socialInsurance: {
    ruleCode: "QA_GRSIA_LAW_1",
    sourceAuthority: "الهيئة العامة للتقاعد والتأمينات الاجتماعية (GRSIA)",
    sourceTitle: "قانون التأمينات الاجتماعية القطري رقم 1 لسنة 2022",
    publicationRef: "الجريدة الرسمية القطرية - العدد 7 بتاريخ 19 أبريل 2022",
    sourceUrl: "https://www.grsia.gov.qa",
    effectiveFrom: "2023-01-03",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "QA-GRSIA-2024.1",
    notes: "نسبة المواطنين القطريين: 7% اشتراك موظف، 14% اشتراك جهة عمل (إجمالي 21%). غير القطريين 0% اشتراكات تقاعدية.",
  },
  laborLaw: {
    ruleCode: "QA_MOL_LAW_14",
    sourceAuthority: "وزارة العمل بدولة قطر (MOL)",
    sourceTitle: "قانون العمل القطري رقم 14 لسنة 2004 وتعديلاته بالقانون 17 لسنة 2020",
    publicationRef: "الجريدة الرسمية القطرية - العدد 10 بتاريخ 30 يونيو 2004",
    sourceUrl: "https://www.mol.gov.qa",
    effectiveFrom: "2004-05-19",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "QA-MOL-2024.1",
    notes: "ساعات العمل 8 يومياً و48 أسبوعياً (36 أسبوعياً في رمضان)، فترة التجربة 6 أشهر، إجازة سنوية 3 أسابيع ترتفع إلى 4 أسابيع بعد 5 سنوات خدمة، مكافأة نهاية الخدمة 3 أسابيع على الأقل عن كل سنة.",
  },
  wps: {
    ruleCode: "QA_QCB_WPS_SIF",
    sourceAuthority: "مصرف قطر المركزي ووزارة العمل",
    sourceTitle: "نظام حماية الأجور وصيغة ملف SIF القياسية",
    publicationRef: "القانون رقم 1 لسنة 2015 بتعديل بعض أحكام قانون العمل",
    sourceUrl: "https://www.qcb.gov.qa",
    effectiveFrom: "2015-11-02",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "QA-WPS-2024.1",
    notes: "تنسيق SIF (Salary Information File) المعتمد يشمل رقم هوية المنشأة ورقم البطاقة الشخصية القطرية QID والآيبان وتفاصيل الأجر الأساسي والإضافي والاستقطاعات.",
  },
};

export function calculateQatarSocialInsurance(wage: number, isQatari: boolean): {
  insurableWage: number;
  employeeContribution: number;
  employerContribution: number;
  totalEmployeeDeduction: number;
} {
  if (!isQatari) {
    return {
      insurableWage: 0,
      employeeContribution: 0,
      employerContribution: 0,
      totalEmployeeDeduction: 0,
    };
  }

  const insurableWage = Math.max(1000, wage);
  const employeeContribution = Math.round(insurableWage * 0.07 * 100) / 100; // 7%
  const employerContribution = Math.round(insurableWage * 0.14 * 100) / 100; // 14%

  return {
    insurableWage,
    employeeContribution,
    employerContribution,
    totalEmployeeDeduction: employeeContribution,
  };
}
