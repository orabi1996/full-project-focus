/**
 * MadarX Enterprise AI — Security Hardening, Rate Limiting, Feature Flags & Argument Validation
 * Prompt 35: Sections 35, 39, 40, 41, 42
 */

import { detectAndSanitizePrompt, minimizeEmployeePII } from '../../domains/ai';
import {
  GOVERNED_AI_TOOLS,
  authorizeGovernedAIToolAccess,
  sanitizeUntrustedContentForAI,
  type AIToolAuthorizationContext,
} from '../tools/registry';

export interface AITenantFeatureFlagConfig {
  tenantId: string;
  copilotEnabled: boolean;
  policyRagEnabled: boolean;
  draftingEnabled: boolean;
  nlReportingEnabled: boolean;
  proactiveInsightsEnabled: boolean;
  actionConfirmationEnabled: boolean;
  externalLlmAllowed: boolean;
  dailyTokenQuota: number;
  requestsPerMinuteLimit: number;
}

export const DEFAULT_AI_FEATURE_FLAGS: Omit<AITenantFeatureFlagConfig, 'tenantId'> = {
  copilotEnabled: true,
  policyRagEnabled: true,
  draftingEnabled: true,
  nlReportingEnabled: true,
  proactiveInsightsEnabled: true,
  actionConfirmationEnabled: true,
  externalLlmAllowed: false,
  dailyTokenQuota: 250000,
  requestsPerMinuteLimit: 30,
};

export interface AIRateLimitState {
  userId: string;
  tenantId: string;
  requestsInCurrentWindow: number;
  tokensUsedToday: number;
}

export interface AIRateLimitDecision {
  allowed: boolean;
  reasonCode: 'OK' | 'RPM_LIMIT_EXCEEDED' | 'DAILY_QUOTA_EXCEEDED' | 'FEATURE_DISABLED';
  messageAr: string;
  messageEn: string;
  remainingRequestsInWindow: number;
  remainingDailyTokens: number;
}

/**
 * Evaluates per-user and per-tenant rate limits and feature flags (Sections 41 & 42).
 */
export function evaluateAIRateLimitAndFlags(
  state: AIRateLimitState,
  flags: Partial<AITenantFeatureFlagConfig> = {},
  requestedFeature: keyof Omit<
    AITenantFeatureFlagConfig,
    'tenantId' | 'dailyTokenQuota' | 'requestsPerMinuteLimit' | 'externalLlmAllowed'
  > = 'copilotEnabled'
): AIRateLimitDecision {
  const mergedFlags: AITenantFeatureFlagConfig = {
    tenantId: state.tenantId,
    ...DEFAULT_AI_FEATURE_FLAGS,
    ...flags,
  };

  if (!mergedFlags.copilotEnabled || !mergedFlags[requestedFeature]) {
    return {
      allowed: false,
      reasonCode: 'FEATURE_DISABLED',
      messageAr: 'تم إيقاف هذه الميزة الذكية من قِبل مسؤول النظام للمنشأة الحالية.',
      messageEn: 'This AI capability is currently disabled by tenant feature flags.',
      remainingRequestsInWindow: 0,
      remainingDailyTokens: Math.max(0, mergedFlags.dailyTokenQuota - state.tokensUsedToday),
    };
  }

  if (state.requestsInCurrentWindow >= mergedFlags.requestsPerMinuteLimit) {
    return {
      allowed: false,
      reasonCode: 'RPM_LIMIT_EXCEEDED',
      messageAr: 'تم تجاوز الحد الأقصى لعدد الطلبات في الدقيقة. يرجى الانتظار قليلاً قبل المحاولة مجدداً.',
      messageEn: 'Per-minute request rate limit exceeded. Please wait briefly before retrying.',
      remainingRequestsInWindow: 0,
      remainingDailyTokens: Math.max(0, mergedFlags.dailyTokenQuota - state.tokensUsedToday),
    };
  }

  if (state.tokensUsedToday >= mergedFlags.dailyTokenQuota) {
    return {
      allowed: false,
      reasonCode: 'DAILY_QUOTA_EXCEEDED',
      messageAr: 'تم استنفاد الحصة اليومية المخصصة للذكاء الاصطناعي للمنشأة.',
      messageEn: 'Daily tenant AI token quota has been reached.',
      remainingRequestsInWindow: Math.max(0, mergedFlags.requestsPerMinuteLimit - state.requestsInCurrentWindow),
      remainingDailyTokens: 0,
    };
  }

  return {
    allowed: true,
    reasonCode: 'OK',
    messageAr: 'مسموح.',
    messageEn: 'Allowed.',
    remainingRequestsInWindow: Math.max(0, mergedFlags.requestsPerMinuteLimit - state.requestsInCurrentWindow - 1),
    remainingDailyTokens: Math.max(0, mergedFlags.dailyTokenQuota - state.tokensUsedToday),
  };
}

export interface ToolArgumentValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedArgs: Record<string, unknown>;
}

/**
 * Validates tool arguments against schema, tenant isolation, and scope boundaries (Section 40).
 * Never trusts model-supplied tenant_id / company_id or cross-employee escalation.
 */
export function validateAndSanitizeToolArguments(
  toolName: string,
  rawArgs: Record<string, unknown>,
  ctx: Omit<AIToolAuthorizationContext, 'toolName'>
): ToolArgumentValidationResult {
  const toolDef = GOVERNED_AI_TOOLS[toolName];
  if (!toolDef) {
    return {
      valid: false,
      reason: `UNREGISTERED_TOOL: ${toolName}`,
      sanitizedArgs: {},
    };
  }

  // Reject any attempt by the model to override tenantId or company_id to a different tenant
  if (
    typeof rawArgs.tenantId === 'string' &&
    rawArgs.tenantId.trim() !== '' &&
    rawArgs.tenantId.trim() !== ctx.actorCompanyId
  ) {
    return {
      valid: false,
      reason: 'CROSS_TENANT_ARGUMENT_REJECTED: Model cannot override caller tenantId.',
      sanitizedArgs: {},
    };
  }

  if (
    typeof rawArgs.company_id === 'string' &&
    rawArgs.company_id.trim() !== '' &&
    rawArgs.company_id.trim() !== ctx.actorCompanyId
  ) {
    return {
      valid: false,
      reason: 'CROSS_TENANT_ARGUMENT_REJECTED: Model cannot override caller company_id.',
      sanitizedArgs: {},
    };
  }

  const targetEmployeeId =
    typeof rawArgs.employeeId === 'string'
      ? rawArgs.employeeId
      : typeof rawArgs.targetEmployeeId === 'string'
        ? rawArgs.targetEmployeeId
        : ctx.targetEmployeeId;

  const authCheck = authorizeGovernedAIToolAccess({
    ...ctx,
    toolName,
    targetEmployeeId,
  });

  if (!authCheck.allowed) {
    return {
      valid: false,
      reason: `${authCheck.reasonCode}: ${authCheck.messageEn}`,
      sanitizedArgs: {},
    };
  }

  const sanitizedArgs: Record<string, unknown> = {
    ...rawArgs,
    companyId: ctx.actorCompanyId,
  };

  return {
    valid: true,
    sanitizedArgs,
  };
}

export { detectAndSanitizePrompt, minimizeEmployeePII, sanitizeUntrustedContentForAI };
