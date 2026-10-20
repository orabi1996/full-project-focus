/**
 * MadarX Enterprise AI — Domain Safety Policies & Country-Aware Statutory Grounding
 * Prompt 35: Enforces strict human-in-the-loop boundaries across Recruitment,
 * Performance, Talent, Employee Relations, Compensation, Payroll, and
 * Multi-Country Statutory Compliance (EG, SA, QA, OM, BH).
 */

import {
  COUNTRY_PACK_CATALOG,
  resolveStatutoryRuleSet,
  type CountryCode,
} from '../../domains/country-packs';

export type SupportedCountryCode = CountryCode;

export type AIDomainModule =
  | 'recruitment'
  | 'performance'
  | 'talent'
  | 'employee_relations'
  | 'compensation'
  | 'payroll'
  | 'statutory_compliance'
  | 'general_hr';

export interface AIDomainSafetyDecision {
  domain: AIDomainModule;
  allowed: boolean;
  classification: 'ALLOWED_ASSISTIVE' | 'BLOCKED_PROHIBITED_DECISION' | 'BLOCKED_UNGROUNDED_LEGAL';
  reasonAr: string;
  reasonEn: string;
  requiredDisclaimerAr: string;
  requiredDisclaimerEn: string;
}

export interface CountryStatutoryGroundingResult {
  countryCode: SupportedCountryCode | null;
  countryNameAr?: string;
  countryNameEn?: string;
  legislationVersionCode?: string;
  isGroundedInActiveCountryPack: boolean;
  hasUncertainOrUnconfiguredLaw: boolean;
  disclaimerAr: string;
  disclaimerEn: string;
  citations: Array<{
    packCode: string;
    authorityNameEn: string;
    effectiveFrom: string;
    summaryEn: string;
  }>;
}

const PROHIBITED_DOMAIN_PATTERNS: Array<{
  domain: AIDomainModule;
  pattern: RegExp;
  reasonAr: string;
  reasonEn: string;
}> = [
  {
    domain: 'recruitment',
    pattern: /\b(auto[- ]?reject|automatically\s+reject|reject\s+candidate|final\s+hiring\s+decision|hire\s+this\s+candidate\s+now|rank\s+by\s+(?:gender|age|religion|nationality|marital)|تمييز|رفض\s+تلقائي|قرار\s+تعيين\s+نهائي)\b/i,
    reasonAr: 'يُحظر على الذكاء الاصطناعي اتخاذ قرارات التوظيف النهائية أو الرفض التلقائي للمرشحين أو التصنيف التمييزي.',
    reasonEn: 'AI is prohibited from making final hiring decisions, auto-rejecting candidates, or ranking on protected attributes.',
  },
  {
    domain: 'performance',
    pattern: /\b(assign\s+final\s+rating|set\s+performance\s+score|finalize\s+appraisal|override\s+calibration|تحديد\s+التقييم\s+النهائي|اعتماد\s+درجة\s+الأداء)\b/i,
    reasonAr: 'يُحظر على الذكاء الاصطناعي تحديد درجة تقييم الأداء النهائية للموظف؛ يقتصر دوره على تلخيص الملاحظات وصياغة مسودات الأهداف.',
    reasonEn: 'AI cannot assign final performance ratings; it may only draft goals and summarize feedback.',
  },
  {
    domain: 'talent',
    pattern: /\b(auto[- ]?nominate\s+successor|finalize\s+9[- ]?box|assign\s+retention\s+risk\s+without\s+review|تعيين\s+خليفة\s+نهائي|اعتماد\s+مصفوفة\s+المواهب)\b/i,
    reasonAr: 'يُحظر على الذكاء الاصطناعي الاعتماد النهائي لخطط الإحلال أو تصنيف المخاطر دون مراجعة بشرية.',
    reasonEn: 'AI cannot finalize succession nominations or 9-box placements without human calibration.',
  },
  {
    domain: 'employee_relations',
    pattern: /\b(determine\s+guilt|issue\s+final\s+disciplinary|terminate\s+employee|fire\s+employee|dismiss\s+employee|إصدار\s+عقوبة\s+نهائية|فصل\s+الموظف|إدانة\s+الموظف)\b/i,
    reasonAr: 'يُحظر على الذكاء الاصطناعي إصدار قرارات الإدانة أو العقوبات التأديبية النهائية أو إنهاء الخدمة.',
    reasonEn: 'AI cannot determine guilt, issue final disciplinary penalties, or terminate employees.',
  },
  {
    domain: 'compensation',
    pattern: /\b(approve\s+salary\s+increase|grant\s+bonus\s+directly|commit\s+merit\s+increase|اعتماد\s+زيادة\s+راتب|صرف\s+مكافأة\s+نهائية)\b/i,
    reasonAr: 'يُحظر على الذكاء الاصطناعي اعتماد زيادات الرواتب أو صرف المكافآت؛ يقتصر دوره على شرح النطاقات وتحليل الميزانية.',
    reasonEn: 'AI cannot approve salary increases or grant bonuses; it only explains bands and models budget impact.',
  },
  {
    domain: 'payroll',
    pattern: /\b(override\s+net\s+pay|calculate\s+official\s+payroll\s+by\s+llm|disburse\s+payroll|finalize\s+wps|تعديل\s+صافي\s+الراتب\s+بالذكاء|صرف\s+الرواتب\s+تلقائيا)\b/i,
    reasonAr: 'يُحظر استبدال محرك الرواتب الحتمي بحسابات الذكاء الاصطناعي أو تنفيذ صرف الرواتب تلقائياً.',
    reasonEn: 'AI must never replace the deterministic payroll engine or disburse payroll.',
  },
];

/**
 * Evaluates a user prompt or AI intent against domain-specific safety boundaries
 * (Sections 18, 19, 20, 21, 22, 23).
 */
export function evaluateDomainAISafety(
  promptText: string,
  targetDomain: AIDomainModule = 'general_hr'
): AIDomainSafetyDecision {
  const normalized = promptText.trim();

  for (const rule of PROHIBITED_DOMAIN_PATTERNS) {
    if (rule.pattern.test(normalized)) {
      return {
        domain: rule.domain,
        allowed: false,
        classification: 'BLOCKED_PROHIBITED_DECISION',
        reasonAr: rule.reasonAr,
        reasonEn: rule.reasonEn,
        requiredDisclaimerAr: 'قرار بشري إلزامي: لا يملك المساعد الذكي صلاحية اتخاذ القرارات النهائية في هذا النطاق.',
        requiredDisclaimerEn: 'Mandatory human control: MadarX AI Copilot is strictly assistive and cannot execute final decisions in this domain.',
      };
    }
  }

  return {
    domain: targetDomain,
    allowed: true,
    classification: 'ALLOWED_ASSISTIVE',
    reasonAr: 'طلب استشاري/تحليلي مسموح ضمن الضوابط المؤسسية.',
    reasonEn: 'Assistive request permitted under enterprise governance controls.',
    requiredDisclaimerAr: 'ملاحظة: مخرجات الذكاء الاصطناعي استرشادية وتخضع للمراجعة البشرية.',
    requiredDisclaimerEn: 'Note: AI Copilot outputs are assistive and subject to human review.',
  };
}

/**
 * Resolves country-specific statutory grounding from the active Country Pack Engine (Prompt 34)
 * and enforces the No-Legal-Hallucination Policy (Sections 12 & 13).
 */
export function resolveCountryStatutoryGrounding(
  countryCodeInput?: string | null,
  asOfDate: string = new Date().toISOString().slice(0, 10)
): CountryStatutoryGroundingResult {
  const normalizedCode = (countryCodeInput || '').trim().toUpperCase() as SupportedCountryCode;
  const supportedCodes: SupportedCountryCode[] = ['EG', 'SA', 'QA', 'OM', 'BH'];

  if (!normalizedCode || !supportedCodes.includes(normalizedCode)) {
    return {
      countryCode: null,
      isGroundedInActiveCountryPack: false,
      hasUncertainOrUnconfiguredLaw: true,
      disclaimerAr:
        'تنبيه قانوني: لم يتم ربط هذا الاستفسار بحزمة دولة مفعّلة في النظام (EG, SA, QA, OM, BH). لا يقوم المساعد الذكي بافتراض نسب قانونية غير مكونة، ويجب مراجعة المختص القانوني أو إعدادات الدولة.',
      disclaimerEn:
        'Legal Grounding Notice: This query is not bound to an active configured Country Pack (EG, SA, QA, OM, BH). MadarX AI never invents statutory percentages; please verify with legal counsel or tenant country configuration.',
      citations: [],
    };
  }

  const meta = COUNTRY_PACK_CATALOG[normalizedCode];
  const pack = resolveStatutoryRuleSet(normalizedCode, asOfDate);

  return {
    countryCode: normalizedCode,
    countryNameAr: meta.nameAr,
    countryNameEn: meta.nameEn,
    legislationVersionCode: pack.versionCode,
    isGroundedInActiveCountryPack: true,
    hasUncertainOrUnconfiguredLaw: false,
    disclaimerAr: `مرجعية النظام (${meta.nameAr} — الإصدار التشريعي ${pack.versionCode}): هذه المعلومات مستندة إلى قواعد حزمة الدولة المفعّلة في النظام للأغراض الاسترشادية ولا تُعد فتوى قانونية رسمية.`,
    disclaimerEn: `Configured Country Pack Reference (${meta.nameEn} — Version ${pack.versionCode}): Grounded in active system statutory configuration for informational guidance; does not constitute formal legal advice.`,
    citations: [
      {
        packCode: pack.versionCode,
        authorityNameEn: pack.legalReference,
        effectiveFrom: pack.effectiveFrom,
        summaryEn: `${meta.nameEn} statutory pack (${meta.currencyCode}) effective ${pack.effectiveFrom}: SI national employee rate ${(pack.socialInsurance.nationalEmployeeRate * 100).toFixed(2)}%, employer rate ${(pack.socialInsurance.nationalEmployerRate * 100).toFixed(2)}%, income tax enabled=${pack.tax.enabled}.`,
      },
    ],
  };
}
