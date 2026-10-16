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

// Pre-seeded authoritative knowledge base for offline verification
export const SEEDED_KNOWLEDGE_BASE: Array<{
  documentTitle: string;
  version: string;
  category: "hr_policy" | "labor_law" | "handbook";
  accessScope: "all" | "hr_only" | "managers_only";
  sectionTitle: string;
  content: string;
  keywords: string[];
}> = [
  {
    documentTitle: "سياسة الإجازات الرسمية والعطلات",
    version: "3.2",
    category: "hr_policy",
    accessScope: "all",
    sectionTitle: "القسم 4.2: استحقاق الإجازة السنوية",
    content: "يستحق الموظف إجازة سنوية مدفوعة الأجر مدتها 21 يوماً عن كل عام خدمة، وتزاد إلى 30 يوماً إذا أمضى الموظف خمس سنوات متصلة في خدمة المنشأة.",
    keywords: ["إجازة", "سنوية", "استحقاق", "رصيد", "leave", "annual"],
  },
  {
    documentTitle: "لائحة تنظيم العمل وفترة التجربة",
    version: "2.0",
    category: "handbook",
    accessScope: "all",
    sectionTitle: "المادة 5: أحكام وضوابط فترة التجربة",
    content: "يخضع الموظف الجديد لفترة تجربة مدتها 90 يوماً تبدأ من تاريخ مباشرة العمل الفعلي، ويجوز باتفاق كتابي تمديدها بما لا يتجاوز 180 يوماً.",
    keywords: ["تجربة", "فترة", "تمديد", "تثبيت", "probation"],
  },
  {
    documentTitle: "دليل إدارة مسيرات الرواتب والبدلات",
    version: "4.1",
    category: "hr_policy",
    accessScope: "hr_only",
    sectionTitle: "القسم 2.1: مواعيد صرف الرواتب وحماية الأجور",
    content: "تصرف الرواتب الشهرية في اليوم السابع والعشرين من كل شهر ميلادي عبر نظام حماية الأجور WPS، ولا يجوز إجراء أي استقطاع إلا بموجب سند نظامي.",
    keywords: ["رواتب", "مسير", "حماية الأجور", "wps", "payroll", "salary"],
  },
  {
    documentTitle: "دليل التحقيق والمخالفات التأديبية",
    version: "1.5",
    category: "hr_policy",
    accessScope: "hr_only",
    sectionTitle: "المادة 12: إجراءات التحقيق الإداري",
    content: "لا يجوز توقيع أي جزاء تأديبي على الموظف إلا بعد إبلاغه كتابة بما هو منسوب إليه وسماع أقواله وتحقيق دفاعه وإثبات ذلك في محضر رسمي.",
    keywords: ["تحقيق", "جزاء", "تأديب", "مخالفة", "disciplinary", "investigation"],
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
    return matchesKeyword || matchesText;
  });

  if (matchingChunks.length === 0) {
    return {
      answer: "عذراً، لم يتم العثور على نصوص معتمدة في قاعدة المعرفة تتطابق مع استفسارك أو ليس لديك الصلاحية للاطلاع عليها.",
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
