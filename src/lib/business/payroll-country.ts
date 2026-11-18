import { COUNTRY_PACK_CATALOG, type CountryCode } from "../domains/country-packs";

import { round2 } from "./guards";

export { COUNTRY_PACK_CATALOG };
export type { CountryCode };
export type WageBasis = "basic" | "basic_housing" | "gross" | "registered";
export interface PayrollContribution {
  name: string;
  basis: WageBasis;
  taxDeductible?: boolean;
  employeeRate: number;
  employerRate: number;
  offset?: number;
  minimum: number;
  maximum: number | null;
}
export interface PayrollScheme {
  code: string;
  name: string;
  citizenship: "national" | "non_national" | "explicit";
  contributions: PayrollContribution[];
}
export interface PayrollTaxBracket {
  upper: number | null;
  rate: number;
  availableUpToAnnual: number | null;
}
export interface CountryPayrollPolicy {
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string;
  monthlyHours: number;
  overtimeWageMultiplier: number;
  overtimeBasicPremium: number;
  schemes: PayrollScheme[];
  tax: { enabled: boolean; annualExemption: number; brackets: PayrollTaxBracket[] };
}
export interface CountryPolicyRecord {
  id: string;
  company_id: string;
  country_code: CountryCode;
  status: "draft" | "active";
  policy: CountryPayrollPolicy;
}

export function payrollCountry(value: string): CountryCode {
  const raw = String(value ?? "").trim();
  const upper = raw.toUpperCase();
  const aliases: Record<string, CountryCode> = {
    "السعودية": "SA", "سعودي": "SA", "سعودية": "SA", "SAUDI ARABIA": "SA", "SAUDI": "SA", "SAU": "SA", "KSA": "SA",
    "مصر": "EG", "مصري": "EG", "مصرية": "EG", "EGYPT": "EG", "EGYPTIAN": "EG", "EGY": "EG",
    "الإمارات": "AE", "اماراتي": "AE", "إماراتي": "AE", "UAE": "AE", "EMIRATI": "AE", "إماراتية": "AE", "اماراتية": "AE", "ARE": "AE",
    "قطر": "QA", "قطري": "QA", "QATAR": "QA", "QATARI": "QA", "قطرية": "QA", "QAT": "QA",
    "عمان": "OM", "عُمان": "OM", "عماني": "OM", "OMAN": "OM", "OMANI": "OM", "عمانية": "OM", "OMN": "OM",
    "البحرين": "BH", "بحريني": "BH", "BAHRAIN": "BH", "BAHRAINI": "BH", "بحرينية": "BH", "BHR": "BH",
    "الكويت": "KW", "كويتي": "KW", "KUWAIT": "KW", "KUWAITI": "KW", "كويتية": "KW", "KWT": "KW",
  };
  if (upper in COUNTRY_PACK_CATALOG) return upper as CountryCode;
  if (aliases[upper]) return aliases[upper];
  const entry = Object.values(COUNTRY_PACK_CATALOG).find(pack => pack.nameAr === raw || pack.nameEn.toUpperCase() === upper);
  if (!entry) throw new Error("دولة المنشأة غير معرّفة ضمن حزم الرواتب المتاحة");
  return entry.countryCode;
}

export function isNationalOf(nationality: string, country: CountryCode) {
  if (!String(nationality ?? "").trim()) throw new Error("جنسية الموظف مطلوبة لتحديد نظام الاشتراك");
  try { return payrollCountry(nationality) === country; } catch { return false; }
}

export function requiresGccRegime(nationality: string, workCountry: CountryCode) {
  const gcc: CountryCode[] = ["SA", "AE", "QA", "OM", "BH", "KW"];
  if (!gcc.includes(workCountry)) return false;
  try {
    const citizenship = payrollCountry(nationality);
    return citizenship !== workCountry && gcc.includes(citizenship);
  } catch { return false; }
}

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const finiteRange = (value: number, min: number, max = Number.MAX_SAFE_INTEGER) =>
  Number.isFinite(value) && value >= min && value <= max;

export function validateCountryPayrollPolicy(policy: CountryPayrollPolicy, country: CountryCode) {
  if (!policy || !policy.name?.trim() || !isDate(policy.effectiveFrom) ||
      (policy.effectiveTo !== null && (!isDate(policy.effectiveTo) || policy.effectiveTo < policy.effectiveFrom))) {
    throw new Error("اسم السياسة وفترة سريانها مطلوبان بصورة صحيحة");
  }
  let source: URL;
  try { source = new URL(policy.sourceUrl); } catch { throw new Error("أدخل رابط مصدر السياسة"); }
  if (source.protocol !== "https:") throw new Error("رابط مصدر السياسة يجب أن يستخدم HTTPS");
  if (!finiteRange(policy.monthlyHours, 1, 744) || !finiteRange(policy.overtimeWageMultiplier, 0, 10) ||
      !finiteRange(policy.overtimeBasicPremium, 0, 10) || !Array.isArray(policy.schemes) ||
      !policy.schemes.length || policy.schemes.length > 30) throw new Error("ساعات العمل وأنظمة الاشتراك غير صالحة");
  const codes = new Set<string>();
  for (const scheme of policy.schemes) {
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(scheme.code) || codes.has(scheme.code) || !scheme.name?.trim() ||
        !["national", "non_national", "explicit"].includes(scheme.citizenship) ||
        !Array.isArray(scheme.contributions) || !scheme.contributions.length || scheme.contributions.length > 20) {
      throw new Error("تعريف نظام الاشتراك غير صالح أو مكرر");
    }
    codes.add(scheme.code);
    for (const component of scheme.contributions) {
      if ((component.taxDeductible !== undefined && typeof component.taxDeductible !== "boolean") || !component.name?.trim() || !["basic", "basic_housing", "gross", "registered"].includes(component.basis) ||
          !finiteRange(component.employeeRate, 0, 1) || !finiteRange(component.employerRate, 0, 1) ||
          !finiteRange(component.offset ?? 0, 0) || !finiteRange(component.minimum, 0) || (component.maximum !== null && !finiteRange(component.maximum, component.minimum))) {
        throw new Error("نسبة الاشتراك أو أساس الأجر أو حدوده غير صالحة");
      }
    }
  }
  if (!policy.tax || typeof policy.tax.enabled !== "boolean" || !finiteRange(policy.tax.annualExemption, 0)) throw new Error("إعدادات الضريبة غير صالحة");
  if (country === "EG" && !policy.tax.enabled) throw new Error("يلزم تهيئة ضريبة الدخل ضمن سياسة الرواتب المصرية");
  if (policy.tax.enabled) {
    if (!Array.isArray(policy.tax.brackets) || !policy.tax.brackets.length || policy.tax.brackets.length > 30 ||
        policy.tax.brackets.at(-1)?.upper !== null) throw new Error("شرائح الضريبة مطلوبة ويجب أن تكون الشريحة الأخيرة مفتوحة");
    let previous = 0;
    for (const [index, bracket] of policy.tax.brackets.entries()) {
      if ((bracket.upper === null && index !== policy.tax.brackets.length - 1) || !finiteRange(bracket.rate, 0, 1) || (bracket.upper !== null && !finiteRange(bracket.upper, previous + 0.001)) ||
          (bracket.availableUpToAnnual !== null && !finiteRange(bracket.availableUpToAnnual, 0))) throw new Error("حدود شرائح الضريبة غير صالحة");
      previous = bracket.upper ?? previous;
    }
  }
  return policy;
}

export function resolveCountryPayrollPolicy(records: CountryPolicyRecord[], country: CountryCode, start: string, end: string) {
  const matches = records.filter(row => row.status === "active" && row.country_code === country &&
    row.policy.effectiveFrom <= start && (!row.policy.effectiveTo || row.policy.effectiveTo >= end));
  if (matches.length > 1) throw new Error("توجد سياسات رواتب متداخلة؛ راجع تاريخ السريان");
  if (!matches.length) {
    const active = records.filter(row => row.status === "active" && row.country_code === country);
    if (country === "SA" && (!active.length || active.every(row => row.policy.effectiveFrom > end))) return null;
    throw new Error("لا توجد سياسة رواتب معتمدة تغطي كامل الفترة لدولة المنشأة؛ افتح إعداد سياسة الدولة");
  }
  validateCountryPayrollPolicy(matches[0].policy, country);
  return matches[0];
}

export function countryPayrollCharges(policy: CountryPayrollPolicy, country: CountryCode, input: {
  nationality: string; schemeCode?: string; nominal: number[]; taxableGross: number; registeredWage?: number;
}) {
  const national = isNationalOf(input.nationality, country);
  const crossBorder = requiresGccRegime(input.nationality, country);
  if (crossBorder && !input.schemeCode) throw new Error("موظف خليجي يعمل بدولة أخرى؛ حدد نظام مد الحماية التأمينية للموظف صراحة");
  const schemes = policy.schemes.filter(scheme => input.schemeCode ? scheme.code === input.schemeCode :
    scheme.citizenship === (national ? "national" : "non_national"));
  if (schemes.length !== 1) throw new Error("حدد نظام الاشتراك المناسب للموظف؛ توجد أنظمة متعددة أو بيانات ناقصة");
  const scheme = schemes[0];
  if (crossBorder && scheme.citizenship !== "explicit") {
    throw new Error("اختر نظام مد الحماية التأمينية المعرّف صراحة للموظف الخليجي");
  }
  if (scheme.citizenship === "national" && !national || scheme.citizenship === "non_national" && national) {
    throw new Error("نظام الاشتراك المحدد لا يطابق جنسية الموظف");
  }
  const round = (value: number) => round2(value, COUNTRY_PACK_CATALOG[country].decimalPrecision);
  const breakdown = scheme.contributions.map(component => {
    const bases = { basic: input.nominal[0], basic_housing: input.nominal[0] + input.nominal[1],
      gross: input.nominal.reduce((sum, value) => sum + value, 0), registered: input.registeredWage };
    const raw = bases[component.basis];
    if (raw === undefined || !finiteRange(raw, 0)) throw new Error("أجر الاشتراك المسجل مطلوب أو غير صالح في ملف الموظف");
    const wage = Math.min(component.maximum ?? Number.MAX_SAFE_INTEGER, Math.max(component.minimum, raw - (component.offset ?? 0)));
    return { name: component.name, wage, taxDeductible: component.taxDeductible !== false, employee: round(wage * component.employeeRate), employer: round(wage * component.employerRate) };
  });
  const employee = round(breakdown.reduce((sum, item) => sum + item.employee, 0));
  const employer = round(breakdown.reduce((sum, item) => sum + item.employer, 0));
  const deductibleContributions = breakdown.filter(item => item.taxDeductible).reduce((sum, item) => sum + item.employee, 0);
  let annualTax = 0;
  if (policy.tax.enabled) {
    const taxable = Math.max(0, (input.taxableGross - deductibleContributions) * 12 - policy.tax.annualExemption);
    const applicable = policy.tax.brackets.filter(bracket => bracket.availableUpToAnnual === null || taxable <= bracket.availableUpToAnnual);
    if (!applicable.length) throw new Error("لا توجد شريحة ضريبية تنطبق على دخل الموظف");
    let lower = 0;
    for (const bracket of applicable) {
      annualTax += Math.max(0, Math.min(taxable, bracket.upper ?? taxable) - lower) * bracket.rate;
      lower = bracket.upper ?? taxable;
    }
  }
  return { employee, employer, tax: round(annualTax / 12), scheme: scheme.code, breakdown };
}

export function formatPayrollMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("ar", { style: "currency", currency }).format(amount);
}
