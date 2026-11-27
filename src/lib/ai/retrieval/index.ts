/**
 * MadarX Enterprise RAG & Knowledge Retrieval Engine
 * Strictly enforces document permissions and generates verifiable source citations
 */

import type { UserRole } from "../../../types";
import type { AIKnowledgeChunk } from "../../domains/ai";

export interface RAGSearchResult {
  answer: string;
  citations: Array<{
    documentTitle: string;
    version: string;
    sectionTitle: string;
    excerpt: string;
  }>;
  hasSufficientContext: boolean;
}

type KnowledgeChunk = {
  documentTitle: string;
  version: string;
  category: "hr_policy" | "labor_law" | "handbook";
  accessScope: "all" | "hr_only" | "managers_only";
  sectionTitle: string;
  content: string;
  keywords: string[];
  verificationStatus?: "verified" | "demo_unverified";
  verifiedSourceUrl?: string;
  lastVerifiedAt?: string;
};

// Demo-only fixtures. These are not verified sources and must never be presented
// as current policy or legal guidance. Production documents require provenance.
export const SEEDED_KNOWLEDGE_BASE: KnowledgeChunk[] = [
  {
    documentTitle: "سياسة الإجازات الرسمية والعطلات",
    version: "3.2",
    category: "hr_policy",
    accessScope: "all",
    sectionTitle: "القسم 4.2: استحقاق الإجازة السنوية",
    content: "يستحق الموظف إجازة سنوية مدفوعة الأجر مدتها 21 يوماً عن كل عام خدمة، وتزاد إلى 30 يوماً إذا أمضى الموظف خمس سنوات متصلة في خدمة المنشأة.",
    keywords: ["إجازة", "سنوية", "استحقاق", "رصيد", "leave", "annual"],
    verificationStatus: "demo_unverified",
  },
  {
    documentTitle: "لائحة تنظيم العمل وفترة التجربة",
    version: "2.0",
    category: "handbook",
    accessScope: "all",
    sectionTitle: "المادة 5: أحكام وضوابط فترة التجربة",
    content: "يخضع الموظف الجديد لفترة تجربة مدتها 90 يوماً تبدأ من تاريخ مباشرة العمل الفعلي، ويجوز باتفاق كتابي تمديدها بما لا يتجاوز 180 يوماً.",
    keywords: ["تجربة", "فترة", "تمديد", "تثبيت", "probation"],
    verificationStatus: "demo_unverified",
  },
  {
    documentTitle: "دليل إدارة مسيرات الرواتب والبدلات",
    version: "4.1",
    category: "hr_policy",
    accessScope: "hr_only",
    sectionTitle: "القسم 2.1: مواعيد صرف الرواتب وحماية الأجور",
    content: "تصرف الرواتب الشهرية في اليوم السابع والعشرين من كل شهر ميلادي عبر نظام حماية الأجور WPS، ولا يجوز إجراء أي استقطاع إلا بموجب سند نظامي.",
    keywords: ["رواتب", "مسير", "حماية الأجور", "wps", "payroll", "salary"],
    verificationStatus: "demo_unverified",
  },
  {
    documentTitle: "دليل التحقيق والمخالفات التأديبية",
    version: "1.5",
    category: "hr_policy",
    accessScope: "hr_only",
    sectionTitle: "المادة 12: إجراءات التحقيق الإداري",
    content: "لا يجوز توقيع أي جزاء تأديبي على الموظف إلا بعد إبلاغه كتابة بما هو منسوب إليه وسماع أقواله وتحقيق دفاعه وإثبات ذلك في محضر رسمي.",
    keywords: ["تحقيق", "جزاء", "تأديب", "مخالفة", "disciplinary", "investigation"],
    verificationStatus: "demo_unverified",
  },
];

/**
 * Searches the authoritative knowledge base respecting user roles
 */
export function searchKnowledgeBase(query: string, role: UserRole): RAGSearchResult {
  const q = query.toLowerCase();

  const matchingChunks = SEEDED_KNOWLEDGE_BASE.filter((chunk) => {
    // Permission check
    if (chunk.accessScope === "hr_only" && !["super_admin", "hr_manager", "auditor"].includes(role)) {
      return false;
    }
    if (chunk.accessScope === "managers_only" && !["super_admin", "hr_manager", "line_manager", "auditor"].includes(role)) {
      return false;
    }

    // Keyword & content match
    const matchesKeyword = chunk.keywords.some((k) => q.includes(k.toLowerCase()));
    const matchesText = chunk.content.toLowerCase().includes(q) || chunk.sectionTitle.toLowerCase().includes(q);
    const hasVerifiedProvenance =
      chunk.verificationStatus === "verified" &&
      Boolean(chunk.verifiedSourceUrl?.startsWith("https://")) &&
      Boolean(chunk.lastVerifiedAt && !Number.isNaN(Date.parse(chunk.lastVerifiedAt)));
    return hasVerifiedProvenance && (matchesKeyword || matchesText);
  });

  if (matchingChunks.length === 0) {
    const hasUnverifiedMatch = SEEDED_KNOWLEDGE_BASE.some((chunk) => {
      if (chunk.accessScope === "hr_only" && !["super_admin", "hr_manager", "auditor"].includes(role)) return false;
      if (chunk.accessScope === "managers_only" && !["super_admin", "hr_manager", "line_manager", "auditor"].includes(role)) return false;
      const matchesKeyword = chunk.keywords.some((k) => q.includes(k.toLowerCase()));
      const matchesText = chunk.content.toLowerCase().includes(q) || chunk.sectionTitle.toLowerCase().includes(q);
      return (matchesKeyword || matchesText) && chunk.verificationStatus !== "verified";
    });
    return {
      answer: hasUnverifiedMatch
        ? "توجد مادة تجريبية مرتبطة بالسؤال، لكنها غير موثقة بمصدر رسمي وتاريخ مراجعة؛ لذلك لن أعرضها كسياسة معتمدة أو إرشاد قانوني. يلزم الرجوع إلى مستند المنشأة المعتمد أو مصدر رسمي حديث قبل اتخاذ إجراء."
        : "لم أجد مرجعاً موثقاً ومتاحاً في قاعدة المعرفة لهذا السؤال. أرسل مستنداً معتمداً أو راجع مصدراً رسمياً حديثاً قبل اتخاذ إجراء قانوني أو متعلق بالاستحقاقات.",
      citations: [],
      hasSufficientContext: false,
    };
  }

  const primaryChunk = matchingChunks[0];
  const citationText = `وفقاً لـ (${primaryChunk.documentTitle} — الإصدار ${primaryChunk.version} — ${primaryChunk.sectionTitle})`;

  return {
    answer: `${citationText}:\n${primaryChunk.content}`,
    citations: matchingChunks.map((c) => ({
      documentTitle: c.documentTitle,
      version: c.version,
      sectionTitle: c.sectionTitle,
      excerpt: c.content,
    })),
    hasSufficientContext: true,
  };
}

/** Current seeded labor/legal content has no verified provenance, so high-stakes answers fail closed. */
export function isHighStakesLegalQuery(query: string): boolean {
  const q = query.toLocaleLowerCase();
  return /نظام العمل|قانون العمل|قوانين العمل|قانون|لائحة|سياسة|استحقاق|نهاية الخدمة|مكافأة|استقالة|إنهاء العقد|فسخ العقد|عقد العمل|إجازة سنوية|الاجازة السنوية|annual leave|leave entitlement|المدة النظامية.{0,20}التجربة|مدة.{0,20}التجربة.{0,20}(?:نظام|قانون)|ساعات العمل|أحكام العمل|الإضافي|العمل الإضافي|الحد الأدنى للأجور|حماية الأجور|\bwps\b|التوطين|نطاقات|التأمينات الاجتماعية|استقطاع نظامي|خصم من الراتب|تعويض|مادة\s*\(?\d+|المادة\s*\(?\d+|labor law|employment law|overtime|end of service|severance|statutory|legal entitlement|minimum wage/i.test(q);
}

export function getLegalVerificationBoundary(): string {
  return "لا أستطيع تأكيد إجابة قانونية أو حساب استحقاق من قاعدة المعرفة الحالية؛ محتواها التجريبي لا يحمل مصدراً رسمياً موثقاً وتاريخ مراجعة. تحقّق من نظام/لائحة رسمي حديث أو مستند المنشأة المعتمد، ويمكنني مساعدتك في تفسيره إذا أرسلته.";
}
