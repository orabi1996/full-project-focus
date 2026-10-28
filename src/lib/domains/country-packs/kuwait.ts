// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PRODUCTION COUNTRY PACK — KUWAIT (KW)
// src/lib/domains/country-packs/kuwait.ts
// ============================================================================

import type { StatutoryRuleMetadata } from "./egypt";

export const KUWAIT_SOURCES: Record<string, StatutoryRuleMetadata> = {
  socialInsurance: {
    ruleCode: "KW_PIFSS_LAW_61",
    sourceAuthority: "المؤسسة العامة للتأمينات الاجتماعية بدولة الكويت (PIFSS)",
    sourceTitle: "قانون التأمينات الاجتماعية الكويتي الصادر بالأمر الأميري بالقانون رقم 61 لسنة 1976 وقانون التأمين ضد البطالة 101 لسنة 2013 وتعديلاته",
    publicationRef: "الكويت اليوم - العدد 1104 بتاريخ 14 أكتوبر 1976 والعدد 1131",
    sourceUrl: "https://www.pifss.gov.kw",
    effectiveFrom: "1977-01-01",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "KW-PIFSS-2024.1",
    notes: "نسبة المواطنين الكويتيين بالقطاع الأهلي: 10.5% اشتراك مؤمن عليه (7.5% أساسي + 2.5% تكميلي + 0.5% بطالة)، 11.5% اشتراك صاحب عمل (10% تقاعد + 1.5% بطالة) بالإضافة إلى مساهمة الخزانة العامة للدولة. سقف الأجر الخاضع للاشتراك 2,750 دينار كويتي شهرياً. غير الكويتيين: 0% اشتراكات، وتطبق مكافأة نهاية الخدمة وفق قانون العمل.",
  },
  laborLaw: {
    ruleCode: "KW_PAM_LAW_6",
    sourceAuthority: "الهيئة العامة للقوى العاملة (PAM) ووزارة الشؤون الاجتماعية",
    sourceTitle: "قانون العمل في القطاع الأهلي رقم 6 لسنة 2010 وتعديلاته بالقانون 85 لسنة 2017",
    publicationRef: "الكويت اليوم - ملحق العدد 963 بتاريخ 21 فبراير 2010",
    sourceUrl: "https://www.manpower.gov.kw",
    effectiveFrom: "2010-02-21",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "KW-PAM-2024.1",
    notes: "ساعات العمل 8 يومياً و48 أسبوعياً (36 أسبوعياً في رمضان)، فترة التجربة بحد أقصى 100 يوم عمل، إجازة سنوية 30 يوم عمل براتب كامل، مكافأة نهاية الخدمة أجر 15 يوماً عن كل سنة من السنوات الخمس الأولى وأجر شهر عن كل سنة تالية وبحد أقصى أجر سنة ونصف (المادتان 51 و 53).",
  },
  wps: {
    ruleCode: "KW_CBK_WPS_2017",
    sourceAuthority: "بنك الكويت المركزي (CBK) والهيئة العامة للقوى العاملة (PAM)",
    sourceTitle: "نظام حماية الأجور الكويتي (CBK / PAM WPS)",
    publicationRef: "القرار الوزاري رقم 85 لسنة 2017 وتعاميم بنك الكويت المركزي",
    sourceUrl: "https://www.cbk.gov.kw",
    effectiveFrom: "2017-06-01",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "KW-WPS-2024.1",
    notes: "تحويل أجور العاملين للبنوك المحلية بالرقم المدني الكويتي ورقم ملف المنشأة والآيبان المكون من 30 حرفاً ورقم بالدينار الكويتي (3 خانات عشرية).",
  },
};

export function calculateKuwaitSocialInsurance(wage: number, isKuwaiti: boolean): {
  insurableWage: number;
  employeeContribution: number;
  employerContribution: number;
  totalEmployeeDeduction: number;
} {
  if (!isKuwaiti) {
    return {
      insurableWage: 0,
      employeeContribution: 0,
      employerContribution: 0,
      totalEmployeeDeduction: 0,
    };
  }

  const minBasis = 230;
  const maxBasis = 2750; // 2,750 KWD statutory cap
  const insurableWage = Math.min(maxBasis, Math.max(minBasis, wage));

  // 10.5% employee contribution (7.5% basic + 2.5% supplementary + 0.5% unemployment)
  const employeeContribution = Math.round(insurableWage * 0.105 * 1000) / 1000;
  // 11.5% employer contribution (10% pension + 1.5% unemployment)
  const employerContribution = Math.round(insurableWage * 0.115 * 1000) / 1000;

  return {
    insurableWage,
    employeeContribution,
    employerContribution,
    totalEmployeeDeduction: employeeContribution,
  };
}
