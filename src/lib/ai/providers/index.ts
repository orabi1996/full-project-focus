/**
 * MadarX AI Provider Abstraction
 * Supports configurable, pluggable LLM backends with offline safe fallback
 */

import type { AIChatMessage, AIProviderType } from "../../domains/ai";

export interface AIProviderRequest {
  messages: AIChatMessage[];
  systemInstructions: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Record<string, unknown>[];
  contextData?: Record<string, unknown>;
}

export interface AIProviderResponse {
  content: string;
  provider: AIProviderType;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  toolCalls?: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
  }>;
}

export interface AIProvider {
  type: AIProviderType;
  generateResponse(request: AIProviderRequest): Promise<AIProviderResponse>;
}

/**
 * Deterministic, offline-safe Enterprise Provider used for fast execution,
 * testing, and when external API keys are not configured.
 */
export class MockEnterpriseAIProvider implements AIProvider {
  type: AIProviderType = "mock";

  async generateResponse(request: AIProviderRequest): Promise<AIProviderResponse> {
    const startTime = Date.now();
    const lastUserMessage = [...request.messages].reverse().find((m) => m.role === "user");
    const query = lastUserMessage?.content || "";

    let content = "أهلاً بك في مساعد MadarX الذكي. كيف يمكنني مساعدتك اليوم في إدارة شؤون الموظفين والعمليات؟";

    if (request.contextData && Object.keys(request.contextData).length > 0) {
      content = `بناءً على السجلات المعتمدة في النظام:\n${JSON.stringify(request.contextData, null, 2)}`;
    } else if (query.includes("إجاز") || query.includes("رصيد")) {
      content = "وفقاً لسجلات نظام الإجازات: رصيد الإجازات السنوية المتاح للموظف هو 21 يوماً.";
    } else if (query.includes("راتب") || query.includes("رواتب")) {
      content = "إجمالي تكلفة مسير الرواتب المعتمد للشهر الجاري متوافق مع الميزانية التشغيلية.";
    } else if (query.includes("شهادة") || query.includes("انتهاء")) {
      content = "يوجد 2 من الموظفين لديهم شهادات مهنية تنتهي صلاحيتها خلال الـ 30 يوماً القادمة.";
    }

    const latencyMs = Date.now() - startTime + 10;
    const inputTokens = Math.ceil(query.length / 4) + 120;
    const outputTokens = Math.ceil(content.length / 4);

    return {
      content,
      provider: "mock",
      model: "madarx-local-v1",
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: 0.0001,
      latencyMs,
    };
  }
}

/**
 * Factory for creating the active configured provider
 */
export function getActiveAIProvider(providerType: AIProviderType = "mock"): AIProvider {
  switch (providerType) {
    case "mock":
    default:
      return new MockEnterpriseAIProvider();
  }
}
