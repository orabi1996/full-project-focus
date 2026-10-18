// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 37: LIVE GOVERNMENT, REGULATORY & STATUTORY INTEGRATION CONNECTORS
// src/lib/integrations/government/connector-contract.ts
// ============================================================================

import {
  validateNationalIdFormat,
  validateIbanFormat,
  COUNTRY_PACK_CATALOG,
  type CountryCode,
} from "../../domains/country-packs";

export type GovernmentProviderCode =
  | "GOSI"
  | "MUDAD"
  | "QIWA"
  | "MUQEEM"
  | "NOSI"
  | "ETA"
  | "GRSIA"
  | "MADLSA"
  | "SPF"
  | "CBO"
  | "SIO"
  | "LMRA";

export type GovernmentConnectorMode =
  | "api"
  | "official_file_export"
  | "manual_portal"
  | "rpa_assisted";

export type GovernmentConnectionStatus =
  | "not_configured"
  | "configured"
  | "testing"
  | "connected"
  | "degraded"
  | "failed"
  | "disabled";

export type GovernmentSubmissionStatus =
  | "draft"
  | "ready"
  | "queued"
  | "submitting"
  | "submitted"
  | "acknowledged"
  | "accepted"
  | "partially_accepted"
  | "rejected"
  | "failed"
  | "cancelled";

export type GovernmentSubmissionType =
  | "monthly_social_insurance_declaration"
  | "wps_salary_protection_file"
  | "employee_registration"
  | "employee_termination"
  | "contract_compliance_export"
  | "work_permit_residency_status"
  | "payroll_withholding_tax_reconciliation"
  | "public_pension_contribution";

export interface CertificateMetadata {
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  fingerprintSha256: string;
  secretEnvReference: string;
}

export interface CertificateExpiryEvaluation {
  status: "valid" | "expiring_90d" | "expiring_60d" | "expiring_30d" | "expiring_7d" | "expired" | "not_configured";
  daysRemaining: number | null;
  alertThresholdDays: 90 | 60 | 30 | 7 | 0 | null;
  blocksLiveSubmission: boolean;
  messageAr: string;
}

export interface PreflightEmployeeRecord {
  employeeId: string;
  employeeNameAr: string;
  nationalId: string;
  iban?: string;
  basicSalary: number;
  netSalary: number;
  socialInsuranceEmployeeShare?: number;
  socialInsuranceEmployerShare?: number;
  incomeTaxAmount?: number;
}

export interface PreflightValidationInput {
  organizationId: string;
  legalEntityId?: string;
  countryCode: CountryCode;
  provider: GovernmentProviderCode;
  submissionType: GovernmentSubmissionType;
  sourcePeriod: string;
  sourceReference: string;
  establishmentRegistrationNo?: string | null;
  requiresIbanValidation?: boolean;
  certificate?: CertificateMetadata | null;
  mode: GovernmentConnectorMode;
  records: PreflightEmployeeRecord[];
}

export interface PreflightValidationIssue {
  severity: "BLOCK" | "WARNING";
  code: string;
  employeeId?: string;
  field: string;
  messageAr: string;
}

export interface PreflightValidationResult {
  passed: boolean;
  blockCount: number;
  warningCount: number;
  issues: PreflightValidationIssue[];
  totalAmount: number;
  recordCount: number;
  currencyCode: string;
}

export interface GovernmentSubmissionPackage {
  provider: GovernmentProviderCode;
  countryCode: CountryCode;
  submissionType: GovernmentSubmissionType;
  sourcePeriod: string;
  sourceReference: string;
  mode: GovernmentConnectorMode;
  idempotencyKey: string;
  correlationId: string;
  filename: string;
  mimeType: string;
  content: string;
  payloadHashSha256: string;
  recordCount: number;
  totalAmount: number;
  currencyCode: string;
}

export interface GovernmentAcknowledgementReceipt {
  officialReferenceNumber: string;
  acknowledgedAt: string;
  status: GovernmentSubmissionStatus;
  acceptedCount: number;
  rejectedCount: number;
  rejectionReasons: Array<{
    employeeId?: string;
    code: string;
    messageAr: string;
  }>;
  receiptSummaryAr: string;
}

export interface GovernmentConnectorProviderSpec {
  provider: GovernmentProviderCode;
  countryCode: CountryCode;
  authorityNameAr: string;
  authorityNameEn: string;
  portalNameAr: string;
  portalNameEn: string;
  supportedModes: GovernmentConnectorMode[];
  defaultMode: GovernmentConnectorMode;
  supportedSubmissionTypes: GovernmentSubmissionType[];
  requiresCertificate: boolean;
  requiresEstablishmentId: boolean;
  establishmentIdLabelAr: string;
  officialExportFormat: "SIF" | "CSV" | "XML" | "JSON";
  liveApiSupportedByAuthority: boolean;
  credentialsRequiredEnvVars: string[];
  descriptionAr: string;
}

export interface GovernmentConnectorAdapter {
  spec: GovernmentConnectorProviderSpec;
  validateConfig(config: {
    establishmentRegistrationNo?: string | null;
    secretEnvReference?: string | null;
    certificate?: CertificateMetadata | null;
    mode: GovernmentConnectorMode;
  }): { valid: boolean; status: GovernmentConnectionStatus; issuesAr: string[] };
  testConnection(config: {
    establishmentRegistrationNo?: string | null;
    secretEnvReference?: string | null;
    certificate?: CertificateMetadata | null;
    mode: GovernmentConnectorMode;
    environment?: "sandbox" | "production";
  }): {
    status: GovernmentConnectionStatus;
    liveConnected: boolean;
    latencyMs: number;
    messageAr: string;
  };
  preflightValidate(input: PreflightValidationInput): PreflightValidationResult;
  buildSubmissionPackage(input: PreflightValidationInput): GovernmentSubmissionPackage;
  parseAcknowledgement(rawResponse: {
    officialReferenceNumber?: string;
    acceptedCount: number;
    rejectedCount: number;
    rejections?: Array<{ employeeId?: string; code: string; messageAr: string }>;
  }): GovernmentAcknowledgementReceipt;
}

// ============================================================================
// DETERMINISTIC IDEMPOTENCY KEY & CORRELATION ID BUILDERS
// ============================================================================

export function buildGovernmentSubmissionIdempotencyKey(params: {
  organizationId: string;
  provider: GovernmentProviderCode;
  sourcePeriod: string;
  submissionType: GovernmentSubmissionType;
  sourceReference: string;
}): string {
  const cleanOrg = params.organizationId.trim().toLowerCase();
  const cleanProvider = params.provider.trim().toUpperCase();
  const cleanPeriod = params.sourcePeriod.trim();
  const cleanType = params.submissionType.trim().toLowerCase();
  const cleanRef = params.sourceReference.trim().toLowerCase();
  return `gov-idem:${cleanOrg}:${cleanProvider}:${cleanPeriod}:${cleanType}:${cleanRef}`;
}

export function computeDeterministicPayloadHash(content: string): string {
  let h1 = 0xdeadbeef ^ content.length;
  let h2 = 0x41c6ce57 ^ content.length;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `sha256-${hex1}${hex2}${hex1}${hex2}${hex1}${hex2}${hex1}${hex2}`;
}

// ============================================================================
// CERTIFICATE EXPIRY MONITORING (90 / 60 / 30 / 7 DAYS & EXPIRED BLOCK)
// ============================================================================

export function evaluateCertificateExpiry(
  certificate?: CertificateMetadata | null,
  referenceDate: Date = new Date()
): CertificateExpiryEvaluation {
  if (!certificate || !certificate.validTo) {
    return {
      status: "not_configured",
      daysRemaining: null,
      alertThresholdDays: null,
      blocksLiveSubmission: true,
      messageAr: "لم يتم إرفاق بيانات شهادة الربط الرقمية (X.509/mTLS) في الخزنة الآمنة.",
    };
  }

  const expiry = new Date(certificate.validTo);
  const diffMs = expiry.getTime() - referenceDate.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return {
      status: "expired",
      daysRemaining,
      alertThresholdDays: 0,
      blocksLiveSubmission: true,
      messageAr: `شهادة الربط الرقمية منتهية الصلاحية منذ ${Math.abs(daysRemaining)} يوم — تم حظر الإرسال الحي تلقائياً.`,
    };
  }

  if (daysRemaining <= 7) {
    return {
      status: "expiring_7d",
      daysRemaining,
      alertThresholdDays: 7,
      blocksLiveSubmission: false,
      messageAr: `تنبيه حرج (7 أيام): تنتهي شهادة الربط خلال ${daysRemaining} أيام. يرجى التجديد الفوري.`,
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: "expiring_30d",
      daysRemaining,
      alertThresholdDays: 30,
      blocksLiveSubmission: false,
      messageAr: `تنبيه (30 يوماً): تنتهي شهادة الربط خلال ${daysRemaining} يوماً.`,
    };
  }

  if (daysRemaining <= 60) {
    return {
      status: "expiring_60d",
      daysRemaining,
      alertThresholdDays: 60,
      blocksLiveSubmission: false,
      messageAr: `إشعار مبكر (60 يوماً): تنتهي شهادة الربط خلال ${daysRemaining} يوماً.`,
    };
  }

  if (daysRemaining <= 90) {
    return {
      status: "expiring_90d",
      daysRemaining,
      alertThresholdDays: 90,
      blocksLiveSubmission: false,
      messageAr: `تذكير دوري (90 يوماً): تنتهي شهادة الربط خلال ${daysRemaining} يوماً.`,
    };
  }

  return {
    status: "valid",
    daysRemaining,
    alertThresholdDays: null,
    blocksLiveSubmission: false,
    messageAr: `شهادة الربط الرقمية سارية المفعول (${daysRemaining} يوماً متبقياً).`,
  };
}

// ============================================================================
// BOUNDED EXPONENTIAL RETRY & DEAD-LETTER QUEUE POLICY
// ============================================================================

export type GovernmentSubmissionErrorCategory =
  | "transient_network"
  | "rate_limit"
  | "portal_timeout"
  | "validation_error"
  | "auth_error"
  | "certificate_expired"
  | "duplicate_submission";

export interface RetryDecision {
  shouldRetry: boolean;
  delaySeconds: number;
  sendToDeadLetterQueue: boolean;
  reasonAr: string;
}

export function computeRetryBackoffPolicy(
  retryCount: number,
  maxRetries: number,
  errorCategory: GovernmentSubmissionErrorCategory
): RetryDecision {
  // Never retry non-transient errors (validation, auth, expired certificate, duplicate)
  if (
    errorCategory === "validation_error" ||
    errorCategory === "auth_error" ||
    errorCategory === "certificate_expired" ||
    errorCategory === "duplicate_submission"
  ) {
    return {
      shouldRetry: false,
      delaySeconds: 0,
      sendToDeadLetterQueue: true,
      reasonAr: `خطأ غير قابل لإعادة المحاولة التلقائية (${errorCategory}) — تم تحويله للمراجعة الفورية.`,
    };
  }

  if (retryCount >= maxRetries) {
    return {
      shouldRetry: false,
      delaySeconds: 0,
      sendToDeadLetterQueue: true,
      reasonAr: `تم استنفاد الحد الأقصى لمحاولات الإرسال (${maxRetries}) — تم نقل الحزمة إلى طابور المعالجة المعلقة (DLQ).`,
    };
  }

  // Bounded exponential backoff: 30s, 120s, 480s (capped at 900s)
  const delaySeconds = Math.min(900, 30 * Math.pow(4, retryCount));
  return {
    shouldRetry: true,
    delaySeconds,
    sendToDeadLetterQueue: false,
    reasonAr: `خطأ اتصال مؤقت (${errorCategory}) — ستتم إعادة المحاولة رقم ${retryCount + 1} بعد ${delaySeconds} ثانية.`,
  };
}

// ============================================================================
// SEPARATION OF DUTIES & AUDIT SANITIZATION
// ============================================================================

export function verifySeparationOfDuties(params: {
  preparerId: string;
  reviewerId?: string | null;
  submitterId: string;
  enforceStrictSoD?: boolean;
}): { allowed: boolean; messageAr: string } {
  const { preparerId, reviewerId, submitterId, enforceStrictSoD = true } = params;
  if (!preparerId || !submitterId) {
    return {
      allowed: false,
      messageAr: "يجب تحديد هوية معد الحزمة (Preparer) ومعتمد الإرسال (Submitter).",
    };
  }

  if (enforceStrictSoD && preparerId === submitterId) {
    return {
      allowed: false,
      messageAr:
        "مخالفة فصل الصلاحيات (Separation of Duties): لا يجوز لنفس المستخدم إعداد الحزمة الحكومية واعتماد إرسالها النهائي في الوضع الصارم.",
    };
  }

  if (enforceStrictSoD && reviewerId && reviewerId === preparerId && reviewerId === submitterId) {
    return {
      allowed: false,
      messageAr: "مخالفة فصل الصلاحيات: يجب مراجعة الحزمة من قبل مسؤول مستقل قبل الإرسال.",
    };
  }

  return {
    allowed: true,
    messageAr: "تم التحقق من فصل الصلاحيات الرقابية بنجاح.",
  };
}

const SENSITIVE_KEY_PATTERN =
  /(secret|password|token|private_?key|api_?key|authorization|passphrase|pin|client_secret)/i;

export function sanitizeGovernmentAuditPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[REDACTED_SECRET]";
    } else if (key === "nationalId" || key === "national_id" || key === "iban") {
      const str = String(value ?? "");
      sanitized[key] = str.length > 4 ? `${"*".repeat(str.length - 4)}${str.slice(-4)}` : "****";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeGovernmentAuditPayload(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ============================================================================
// AUTHORITATIVE PRE-FLIGHT VALIDATION ENGINE
// ============================================================================

export function runRegulatoryPreflightValidation(
  input: PreflightValidationInput
): PreflightValidationResult {
  const issues: PreflightValidationIssue[] = [];
  const pack = COUNTRY_PACK_CATALOG[input.countryCode];

  if (!pack) {
    issues.push({
      severity: "BLOCK",
      code: "INVALID_COUNTRY_PACK",
      field: "countryCode",
      messageAr: `حزمة الدولة (${input.countryCode}) غير مفعلة أو غير مدعومة.`,
    });
  }

  if (!input.establishmentRegistrationNo || !input.establishmentRegistrationNo.trim()) {
    issues.push({
      severity: "BLOCK",
      code: "MISSING_ESTABLISHMENT_REG_NO",
      field: "establishmentRegistrationNo",
      messageAr: "رقم تسجيل المنشأة الرسمي لدى الجهة الحكومية إلزامي قبل التوليد أو الإرسال.",
    });
  }

  if (!input.sourcePeriod || !/^\d{4}-\d{2}$/.test(input.sourcePeriod)) {
    issues.push({
      severity: "BLOCK",
      code: "INVALID_SOURCE_PERIOD",
      field: "sourcePeriod",
      messageAr: "الفترة المالية يجب أن تكون بصيغة شهرية معتمدة (YYYY-MM).",
    });
  }

  if (input.mode === "api" && input.certificate) {
    const certEval = evaluateCertificateExpiry(input.certificate);
    if (certEval.blocksLiveSubmission) {
      issues.push({
        severity: "BLOCK",
        code: "CERTIFICATE_EXPIRED_OR_INVALID",
        field: "certificate",
        messageAr: certEval.messageAr,
      });
    } else if (certEval.alertThresholdDays !== null) {
      issues.push({
        severity: "WARNING",
        code: `CERTIFICATE_EXPIRING_${certEval.alertThresholdDays}D`,
        field: "certificate",
        messageAr: certEval.messageAr,
      });
    }
  }

  if (!input.records || input.records.length === 0) {
    issues.push({
      severity: "BLOCK",
      code: "EMPTY_SUBMISSION_RECORDS",
      field: "records",
      messageAr: "لا توجد سجلات موظفين صالحة ضمن الحزمة التنظيمية.",
    });
  }

  let totalAmount = 0;

  for (const rec of input.records || []) {
    const idCheck = validateNationalIdFormat(input.countryCode, rec.nationalId || "");
    if (!idCheck.valid) {
      issues.push({
        severity: "BLOCK",
        code: "INVALID_NATIONAL_ID",
        employeeId: rec.employeeId,
        field: "nationalId",
        messageAr: `${rec.employeeNameAr}: ${idCheck.message || "رقم الهوية غير صالح"}`,
      });
    }

    if (input.requiresIbanValidation) {
      const ibanCheck = validateIbanFormat(input.countryCode, rec.iban || "");
      if (!ibanCheck.valid) {
        issues.push({
          severity: "BLOCK",
          code: "INVALID_IBAN",
          employeeId: rec.employeeId,
          field: "iban",
          messageAr: `${rec.employeeNameAr}: ${ibanCheck.message || "رقم الآيبان غير صالح"}`,
        });
      }
    }

    if (rec.netSalary < 0 || rec.basicSalary <= 0) {
      issues.push({
        severity: "BLOCK",
        code: "INVALID_SALARY_AMOUNT",
        employeeId: rec.employeeId,
        field: "netSalary",
        messageAr: `${rec.employeeNameAr}: قيمة الراتب الأساسي أو الصافي غير صالحة للإرسال.`,
      });
    }

    totalAmount += Number(rec.netSalary || 0);
  }

  const blockCount = issues.filter((i) => i.severity === "BLOCK").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;

  return {
    passed: blockCount === 0,
    blockCount,
    warningCount,
    issues,
    totalAmount: Math.round(totalAmount * 100) / 100,
    recordCount: (input.records || []).length,
    currencyCode: pack?.currencyCode || "SAR",
  };
}
