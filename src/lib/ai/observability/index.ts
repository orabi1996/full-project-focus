/**
 * MadarX AI Observability & Monitoring
 * Captures latency breakdown, cost metrics, and safety denial counters
 */

export interface AIObservabilityEvent {
  timestamp: string;
  conversationId: string;
  userId: string;
  toolName?: string;
  modelLatencyMs: number;
  toolLatencyMs: number;
  totalLatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  status: "success" | "safety_denial" | "tool_failed" | "budget_exceeded";
}

export class AIObservabilityCollector {
  private events: AIObservabilityEvent[] = [];

  recordEvent(event: Omit<AIObservabilityEvent, "timestamp">) {
    this.events.push({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  getMetricsSummary() {
    const total = this.events.length;
    if (total === 0) {
      return {
        totalEvents: 0,
        averageLatencyMs: 0,
        totalCostUsd: 0,
        safetyDenials: 0,
        successRatePct: 100,
      };
    }

    const totalCost = this.events.reduce((sum, e) => sum + e.estimatedCostUsd, 0);
    const totalLatency = this.events.reduce((sum, e) => sum + e.totalLatencyMs, 0);
    const safetyDenials = this.events.filter((e) => e.status === "safety_denial").length;
    const successes = this.events.filter((e) => e.status === "success").length;

    return {
      totalEvents: total,
      averageLatencyMs: Math.round(totalLatency / total),
      totalCostUsd: Number(totalCost.toFixed(4)),
      safetyDenials,
      successRatePct: Math.round((successes / total) * 100),
    };
  }
}

export const aiObservability = new AIObservabilityCollector();
