# MADARX ENTERPRISE WORKFORCE PLATFORM
# AI OPERATIONS & COST MANAGEMENT RUNBOOK

## 1. Observability & Telemetry Architecture
- Every user query, model routing event, and tool execution is captured through `AIObservabilityCollector` and persisted via `record_ai_usage_atomic`.
- **Monitored Dimensions:**
  - `modelLatencyMs`: Model generation latency.
  - `toolLatencyMs`: Stored procedure / database execution time.
  - `totalTokens`: Sum of prompt input and response output tokens.
  - `estimatedCostUsd`: Running financial expense based on model tier rates.
  - `safetyDenials`: Counter for intercepted prompt injection attempts or unauthorized permission attempts.

## 2. Usage & Budget Ceiling Enforcement
- **Daily Token Quotas:** Configured per tenant in `ai_provider_configs.daily_token_limit` (default: 500,000 tokens/day).
- **Monthly Financial Caps:** Configured per tenant in `ai_provider_configs.monthly_cost_limit_usd` (default: $250.00/month).
- When a tenant reaches their allocated quota, `record_ai_usage_atomic` triggers a `budget_exceeded` status, protecting the organization from unexpected cost overruns.

## 3. Provider Failover Protocol
- **Primary:** OpenAI GPT-4o-mini / Google Gemini Flash for real-time conversational intelligence.
- **Secondary Fallback:** OpenAI GPT-3.5-turbo or Anthropic Claude 3.5 Haiku.
- **Offline / Local Fallback:** `MockEnterpriseAIProvider` automatically engages when external API credentials are absent or internet connectivity is partitioned, maintaining unbroken UI responsiveness and safe testing capabilities.
