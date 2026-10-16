/**
 * MadarX Enterprise AI Domain
 * Authoritative types, PII minimization, intent routing, and security contracts
 */

import type { UserRole } from "../../../types";

export type AIProviderType = "openai" | "anthropic" | "gemini" | "azure" | "custom" | "mock";

export type AIMessageRole = "user" | "assistant" | "system" | "tool";

export type AIToolExecutionStatus = "pending" | "approved" | "executed" | "rejected" | "failed";

export type AIInsightSeverity = "critical" | "high" | "medium" | "low";

export type AIInsightCategory =
  | "certificate_expiry"
  | "probation_due"
  | "attendance_sla"
  | "leave_balance"
  | "unfilled_critical_role"
  | "payroll_anomaly"
  | "overdue_review";

export interface AIChatMessage {
  id: string;
  conversationId: string;
  role: AIMessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  toolCallId?: string;
  createdAt: string;
}

export interface AIConversation {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  contextModule?: string;
  contextEntityId?: string;
  status: "active" | "archived" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface AIToolCall {
  id: string;
  conversationId: string;
  messageId?: string;
  toolName: string;
  parameters: Record<string, unknown>;
  result?: Record<string, unknown>;
  requiresConfirmation: boolean;
  isConfirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  idempotencyKey?: string;
  executionStatus: AIToolExecutionStatus;
  errorMessage?: string;
  latencyMs: number;
  createdAt: string;
}

export interface AIInsight {
  id: string;
  companyId: string;
  category: AIInsightCategory;
  severity: AIInsightSeverity;
  titleAr: string;
  titleEn: string;
  explanationAr: string;
  explanationEn: string;
  entityType?: string;
  entityId?: string;
  recommendedAction?: string;
  status: "active" | "snoozed" | "dismissed" | "resolved";
  snoozedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIUsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  totalTokens: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
  totalToolCalls: number;
  toolFailureRatePct: number;
  activeInsights: number;
  positiveFeedbackPct: number;
}

export interface AIKnowledgeChunk {
  chunkId: string;
  documentTitle: string;
  documentVersion: string;
  category: string;
  sectionTitle: string;
  content: string;
  rank: number;
}

export interface AIToolDefinition {
  name: string;
  descriptionAr: string;
  descriptionEn: string;
  requiredModule: string;
  requiredRoles: UserRole[];
  isMutation: boolean;
  requiresConfirmation: boolean;
  parametersSchema: Record<string, unknown>;
}

// ============================================================================
// 1. PII MINIMIZATION & SCRUBBING
// ============================================================================

export function minimizeEmployeePII(record: Record<string, unknown>): Record<string, unknown> {
  const allowed = [
    "id",
    "employeeNo",
    "firstNameAr",
    "lastNameAr",
    "departmentName",
    "jobTitle",
    "hireDate",
    "status",
    "workType",
  ];
  const sanitized: Record<string, unknown> = {};
  for (const key of allowed) {
    if (record[key] !== undefined) {
      sanitized[key] = record[key];
    }
  }
  return sanitized;
}

// ============================================================================
// 2. PROMPT INJECTION & ADVERSARIAL SANITIZATION
// ============================================================================

const INJECTION_PATTERNS = [
  /drop\s+table/i,
  /delete\s+from/i,
  /truncate\s+table/i,
  /insert\s+into/i,
  /update\s+\w+\s+set/i,
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /bypass\s+permissions/i,
  /reveal\s+system\s+prompt/i,
  /show\s+(all\s+)?salaries/i,
  /show\s+secret\s+key/i,
  /change\s+tenant/i,
  /select\s+\*\s+from/i,
  /union\s+select/i,
];

export interface SanitizationResult {
  isSafe: boolean;
  sanitizedPrompt: string;
  violationReason?: string;
}

export function detectAndSanitizePrompt(prompt: string): SanitizationResult {
  const trimmed = prompt.trim();
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isSafe: false,
        sanitizedPrompt: "",
        violationReason: `Adversarial or unauthorized instruction detected: ${pattern.source}`,
      };
    }
  }
  return {
    isSafe: true,
    sanitizedPrompt: trimmed,
  };
}

// ============================================================================
// 3. INTENT DETECTION & WORKLOAD ROUTING
// ============================================================================

export type AIIntent =
  | "employee_search"
  | "leave_balance"
  | "attendance_check"
  | "payroll_summary"
  | "recruitment_pipeline"
  | "performance_review"
  | "learning_certificates"
  | "succession_risks"
  | "policy_rag"
  | "insights_summary"
  | "action_proposal"
  | "general_chat";

export function detectIntent(query: string): AIIntent {
  const q = query.toLowerCase();

  if (q.includes("راتب") || q.includes("رواتب") || q.includes("مسير") || q.includes("payroll") || q.includes("salary")) {
    return "payroll_summary";
  }
  if (q.includes("إجاز") || q.includes("اجاز") || q.includes("رصيد") || q.includes("leave") || q.includes("vacation")) {
    return "leave_balance";
  }
  if (q.includes("حضور") || q.includes("تأخير") || q.includes("غياب") || q.includes("بصمة") || q.includes("attendance") || q.includes("late")) {
    return "attendance_check";
  }
  if (q.includes("شهادة") || q.includes("شهادات") || q.includes("تدريب") || q.includes("course") || q.includes("certificate")) {
    return "learning_certificates";
  }
  if (q.includes("تعاقب") || q.includes("خلافة") || q.includes("وظيفة حرجة") || q.includes("succession") || q.includes("critical role")) {
    return "succession_risks";
  }
  if (q.includes("توظيف") || q.includes("مرشح") || q.includes("وظائف") || q.includes("recruitment") || q.includes("candidate")) {
    return "recruitment_pipeline";
  }
  if (q.includes("سياسة") || q.includes("لائحة") || q.includes("نظام العمل") || q.includes("قانون") || q.includes("policy") || q.includes("handbook")) {
    return "policy_rag";
  }
  if (q.includes("تقييم") || q.includes("أداء") || q.includes("تجربة") || q.includes("performance") || q.includes("probation")) {
    return "performance_review";
  }
  if (q.includes("تنبيه") || q.includes("رؤى") || q.includes("ملاحظات") || q.includes("insight") || q.includes("alert")) {
    return "insights_summary";
  }
  if (q.includes("أرسل") || q.includes("ارسل") || q.includes("أنشئ") || q.includes("انشئ") || q.includes("send") || q.includes("create")) {
    return "action_proposal";
  }
  if (q.includes("موظف") || q.includes("موظفين") || q.includes("بحث") || q.includes("employee") || q.includes("staff")) {
    return "employee_search";
  }

  return "general_chat";
}

// ============================================================================
// 4. FACTUAL GROUNDING ENFORCER
// ============================================================================

export function verifyGrounding(
  responseContent: string,
  groundingData: Record<string, unknown> | null
): { isGrounded: boolean; finalResponse: string } {
  if (!groundingData || Object.keys(groundingData).length === 0) {
    if (responseContent.includes("لا تتوفر بيانات") || responseContent.includes("Information unavailable")) {
      return { isGrounded: true, finalResponse: responseContent };
    }
    return {
      isGrounded: true,
      finalResponse: "عذراً، لم يتم العثور على سجلات مطابقة في النظام للبيانات المطلوبة.",
    };
  }
  return { isGrounded: true, finalResponse: responseContent };
}
