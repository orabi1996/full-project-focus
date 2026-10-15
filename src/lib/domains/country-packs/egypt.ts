// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: PRODUCTION COUNTRY PACK — EGYPT (EG)
// src/lib/domains/country-packs/egypt.ts
// ============================================================================

export interface StatutoryRuleMetadata {
  ruleCode: string;
  sourceAuthority: string;
  sourceTitle: string;
  publicationRef: string;
  sourceUrl?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  verifiedAt: string;
  ruleVersion: string;
  notes?: string;
}

export const EGYPT_SOURCES: Record<string, StatutoryRuleMetadata> = {
  socialInsurance: {
    ruleCode: "EG_NOSI_LAW_148",
    sourceAuthority: "الهيئة القومية للتأمين الاجتماعي (NOSI)",
    sourceTitle: "قانون التأمينات الاجتماعية والمعاشات رقم 148 لسنة 2019",
    publicationRef: "الجريدة الرسمية - العدد 33 مكرر (أ) بتاريخ 19 أغسطس 2019",
    sourceUrl: "https://www.nosi.gov.eg",
    effectiveFrom: "2020-01-01",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "EG-NOSI-2024.1",
    notes: "الحد الأدنى لأجر الاشتراك 2,000 ج.م والحد الأقصى 12,600 ج.م لعام 2024 ومحدث وفق قرارات مجلس إدارة الهيئة.",
  },
  incomeTax: {
    ruleCode: "EG_ETA_LAW_7",
    sourceAuthority: "مصلحة الضرائب المصرية (ETA)",
    sourceTitle: "قانون تعديل بعض أحكام قانون الضريبة على الدخل رقم 7 لسنة 2024",
    publicationRef: "الجريدة الرسمية - العدد 8 مكرر (ب) بتاريخ 25 فبراير 2024",
    sourceUrl: "https://www.eta.gov.eg",
    effectiveFrom: "2024-03-01",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "EG-TAX-2024.1",
    notes: "حد الإعفاء الشخصي السنوي 20,000 ج.م والشرائح تصاعدية من 0% حتى 27.5%.",
  },
  laborLaw: {
    ruleCode: "EG_MOL_LAW_12",
    sourceAuthority: "وزارة العمل المصرية (MOL)",
    sourceTitle: "قانون العمل المصري الموحد رقم 12 لسنة 2003",
    publicationRef: "الجريدة الرسمية - العدد 14 مكرر بتاريخ 7 أبريل 2003",
    sourceUrl: "https://www.manpower.gov.eg",
    effectiveFrom: "2003-07-01",
    verifiedAt: "2026-01-01T00:00:00Z",
    ruleVersion: "EG-MOL-2003.1",
    notes: "ساعات العمل 8 يومياً و48 أسبوعياً، فترة التجربة بحد أقصى 3 أشهر، وإجازة سنوية 21/30 يوماً.",
  },
};

export interface EgyptTaxBracket {
  order: number;
  lowerBound: number;
  upperBound: number | null;
  rate: number;
}

export const EGYPT_TAX_BRACKETS: EgyptTaxBracket[] = [
  { order: 1, lowerBound: 0, upperBound: 40000, rate: 0.00 },
  { order: 2, lowerBound: 40000, upperBound: 55000, rate: 0.10 },
  { order: 3, lowerBound: 55000, upperBound: 70000, rate: 0.15 },
  { order: 4, lowerBound: 70000, upperBound: 200000, rate: 0.20 },
  { order: 5, lowerBound: 200000, upperBound: 400000, rate: 0.225 },
  { order: 6, lowerBound: 400000, upperBound: 1200000, rate: 0.25 },
  { order: 7, lowerBound: 1200000, upperBound: null, rate: 0.275 },
];

export function calculateEgyptPayrollTax(monthlyGrossTaxable: number): {
  monthlyTax: number;
  annualTax: number;
  taxableNetAnnual: number;
  personalExemption: number;
} {
  const annualGross = monthlyGrossTaxable * 12;
  const personalExemption = 20000;
  const taxableNetAnnual = Math.max(0, annualGross - personalExemption);

  if (taxableNetAnnual <= 0) {
    return { monthlyTax: 0, annualTax: 0, taxableNetAnnual: 0, personalExemption };
  }

  let totalAnnualTax = 0;
  for (const b of EGYPT_TAX_BRACKETS) {
    if (taxableNetAnnual > b.lowerBound) {
      const taxableSlice = b.upperBound ? Math.min(taxableNetAnnual, b.upperBound) - b.lowerBound : taxableNetAnnual - b.lowerBound;
      totalAnnualTax += taxableSlice * b.rate;
    }
  }

  const monthlyTax = Math.round((totalAnnualTax / 12) * 100) / 100;
  return {
    monthlyTax,
    annualTax: Math.round(totalAnnualTax * 100) / 100,
    taxableNetAnnual: Math.round(taxableNetAnnual * 100) / 100,
    personalExemption,
  };
}

export function calculateEgyptSocialInsurance(grossWage: number): {
  insurableWage: number;
  employeeContribution: number;
  employerContribution: number;
  martyrsFund: number;
  emergencyFund: number;
  totalEmployeeDeduction: number;
} {
  const minBasis = 2000;
  const maxBasis = 12600;
  const insurableWage = Math.min(maxBasis, Math.max(minBasis, grossWage));

  const employeeRate = 0.11; // 11%
  const employerRate = 0.1875; // 18.75%
  const martyrsFundRate = 0.0005; // 0.05% (Law 4 of 2021)
  const emergencyFundRate = 0.01; // 1% of basic/insurable wage (Law 156 of 2002)

  const employeeContribution = Math.round(insurableWage * employeeRate * 100) / 100;
  const employerContribution = Math.round(insurableWage * employerRate * 100) / 100;
  const martyrsFund = Math.round(insurableWage * martyrsFundRate * 100) / 100;
  const emergencyFund = Math.round(insurableWage * emergencyFundRate * 100) / 100;

  return {
    insurableWage,
    employeeContribution,
    employerContribution,
    martyrsFund,
    emergencyFund,
    totalEmployeeDeduction: Math.round((employeeContribution + martyrsFund) * 100) / 100,
  };
}
