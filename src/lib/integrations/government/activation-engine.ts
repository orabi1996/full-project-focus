// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 38: CUSTOMER CREDENTIAL ONBOARDING, CONNECTOR ACTIVATION &
//            LIVE INTEGRATION OPERATIONS ENGINE
// src/lib/integrations/government/activation-engine.ts
// ============================================================================

import type { CountryCode } from "../../domains/country-packs";
import {
  ALL_GOVERNMENT_PROVIDER_CODES,
  GOVERNMENT_CONNECTOR_REGISTRY,
} from "./index";
import {
  computeDeterministicPayloadHash,
  evaluateCertificateExpiry,
  sanitizeGovernmentAuditPayload,
  type GovernmentProviderCode,
} from "./connector-contract";

// ============================================================================
// 1. ENVIRONMENTS, STATUSES & CAPABILITY TYPES
// ============================================================================

export type ConnectorEnvironment = "sandbox" | "test" | "staging" | "production";

export type ControlledConnectionTestOutcome =
  | "WAITING_FOR_CUSTOMER_CREDENTIALS"
  | "VERIFIED"
  | "AUTHENTICATION_FAILED"
  | "PROVIDER_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "CERTIFICATE_INVALID"
  | "CONFIGURATION_ERROR"
  | "NOT_SUPPORTED"
  | "RATE_LIMITED";

export type ConnectorActivationStatus =
  | "not_configured"
  | "configuring"
  | "verification_required"
  | "verified"
  | "approval_required"
  | "active"
  | "suspended"
  | "expired"
  | "failed"
  | "disabled";

export type CredentialRotationState =
  | "current"
  | "replacement_pending"
  | "verified"
  | "activated"
  | "retired";

export type ConnectorHealthState =
  | "healthy"
  | "degraded"
  | "action_required"
  | "offline"
  | "suspended"
  | "not_configured";

export type CustomerGoLiveStatus =
  | "NOT_READY"
  | "CONFIGURATION_REQUIRED"
  | "CUSTOMER_ACTION_REQUIRED"
  | "VERIFICATION_REQUIRED"
  | "READY_FOR_ACTIVATION"
  | "ACTIVE"
  | "ACTION_REQUIRED";

export type TruthfulSubmissionStatus =
  | "prepared"
  | "queued"
  | "sent"
  | "acknowledged"
  | "accepted"
  | "rejected"
  | "failed"
  | "retrying"
  | "dead_letter";

export type ConnectorSuspensionReason =
  | "credential_compromised"
  | "certificate_expired"
  | "provider_maintenance"
  | "customer_request"
  | "compliance_issue"
  | "manual_suspension"
  | "repeated_authentication_failure"
  | "provider_invalid_credential";

export type CredentialType =
  | "oauth_client_id"
  | "oauth_client_secret"
  | "api_key"
  | "x509_certificate"
  | "private_key_ref"
  | "portal_username_ref"
  | "portal_password_ref"
  | "tenant_customer_identifier"
  | "establishment_identifier"
  | "provider_account_identifier";

// ============================================================================
// 2. PROVIDER-SPECIFIC REQUIREMENTS CATALOG (REUSING PROMPT 37 REGISTRY)
// ============================================================================

export interface ProviderOnboardingRequirementSpec {
  provider: GovernmentProviderCode;
  countryCode: CountryCode;
  requires_x509: boolean;
  requires_oauth: boolean;
  requires_establishment_number: boolean;
  requires_tax_number: boolean;
  requires_payroll_registration: boolean;
  requires_sif: boolean;
  requires_callback_url: boolean;
  supportedEnvironments: ConnectorEnvironment[];
  submissionMethod: "b2g_api_and_file" | "official_file_export" | "portal_batch_upload";
  supportedFileType: "SIF" | "CSV" | "XML" | "JSON";
  apiAvailability: "public_b2g_api" | "partner_restricted_api" | "file_portal_only";
  authenticationMethod: "mTLS_OAuth2" | "X509_API_Key" | "OAuth2_Bearer" | "Portal_Session_Export";
  deliveryMode: "real_time" | "batch" | "hybrid";
  callbackSupported: boolean;
  customerActionItemsAr: string[];
  onboardingGuidanceAr: string;
}

export const PROVIDER_ONBOARDING_REQUIREMENTS: Record<
  GovernmentProviderCode,
  ProviderOnboardingRequirementSpec
> = {
  GOSI: {
    provider: "GOSI",
    countryCode: "SA",
    requires_x509: true,
    requires_oauth: true,
    requires_establishment_number: true,
    requires_tax_number: false,
    requires_payroll_registration: true,
    requires_sif: false,
    requires_callback_url: true,
    supportedEnvironments: ["sandbox", "staging", "production"],
    submissionMethod: "b2g_api_and_file",
    supportedFileType: "CSV",
    apiAvailability: "public_b2g_api",
    authenticationMethod: "mTLS_OAuth2",
    deliveryMode: "hybrid",
    callbackSupported: true,
    customerActionItemsAr: [
      "إصدار شهادة ربط رقمية X.509/mTLS معتمدة للمنشأة",
      "تفعيل حساب تأميناتي أعمال والموافقة على صلاحيات الربط البرمجي B2G",
      "تزويد معرف العميل (OAuth Client ID) ومرجع المفتاح السري في الخزنة البيئية",
    ],
    onboardingGuidanceAr:
      "يتطلب الربط المباشر مع المؤسسة العامة للتأمينات الاجتماعية (GOSI) رقم اشتراك المنشأة التعاوني، وشهادة mTLS سارية، وبيانات OAuth2 الخاصة بالعميل.",
  },
  MUDAD: {
    provider: "MUDAD",
    countryCode: "SA",
    requires_x509: true,
    requires_oauth: true,
    requires_establishment_number: true,
    requires_tax_number: false,
    requires_payroll_registration: true,
    requires_sif: true,
    requires_callback_url: true,
    supportedEnvironments: ["sandbox", "staging", "production"],
    submissionMethod: "b2g_api_and_file",
    supportedFileType: "SIF",
    apiAvailability: "public_b2g_api",
    authenticationMethod: "mTLS_OAuth2",
    deliveryMode: "batch",
    callbackSupported: true,
    customerActionItemsAr: [
      "تفعيل اشتراك المنشأة في منصة مدد لحماية الأجور والربط البنكي",
      "تزويد الرقم الموحد للمنشأة (700) ورقم ملف مكتب العمل",
      "إيداع شهادة التوقيع/الربط ومفاتيح واجهة مدد في خزنة الأسرار",
    ],
    onboardingGuidanceAr:
      "يدعم موصل مدد توليد ملفات حماية الأجور القياسية SIF والتحقق من الآيبان السعودي، ويتطلب تفعيل الربط الحي شهادة العميل ومفاتيح OAuth.",
  },
  QIWA: {
    provider: "QIWA",
    countryCode: "SA",
    requires_x509: false,
    requires_oauth: true,
    requires_establishment_number: true,
    requires_tax_number: false,
    requires_payroll_registration: false,
    requires_sif: false,
    requires_callback_url: false,
    supportedEnvironments: ["sandbox", "production"],
    submissionMethod: "official_file_export",
    supportedFileType: "CSV",
    apiAvailability: "partner_restricted_api",
    authenticationMethod: "OAuth2_Bearer",
    deliveryMode: "batch",
    callbackSupported: false,
    customerActionItemsAr: [
      "توثيق حساب المنشأة في منصة قوى وتفويض ممثل المنشأة",
      "تزويد رقم المنشأة في وزارة الموارد البشرية والتنمية الاجتماعية",
    ],
    onboardingGuidanceAr:
      "يعمل موصل قوى بنمط الحزم الرسمية المعتمدة لتوثيق العقود ومؤشرات التوطين، ويدعم رمز الشريك في حال توفره لدى العميل.",
  },
  MUQEEM: {
    provider: "MUQEEM",
    countryCode: "SA",
    requires_x509: false,
    requires_oauth: false,
    requires_establishment_number: true,
    requires_tax_number: false,
    requires_payroll_registration: false,
    requires_sif: false,
    requires_callback_url: false,
    supportedEnvironments: ["sandbox", "production"],
    submissionMethod: "official_file_export",
    supportedFileType: "CSV",
    apiAvailability: "file_portal_only",
    authenticationMethod: "Portal_Session_Export",
    deliveryMode: "batch",
    callbackSupported: false,
    customerActionItemsAr: [
      "تفعيل اشتراك المنشأة في بوابة مقيم (شركة علم)",
      "إدخال رقم المنشأة في الجوازات (700)",
    ],
    onboardingGuidanceAr:
      "يوفر موصل مقيم حزم متابعة صلاحية الإقامات والتأشيرات بصيغة CSV الرسمية المتوافقة مع بوابة مقيم.",
  },
  NOSI: {
    provider: "NOSI",
    countryCode: "EG",
    requires_x509: false,
    requires_oauth: false,
    requires_establishment_number: true,
    requires_tax_number: true,
    requires_payroll_registration: true,
    requires_sif: false,
    requires_callback_url: false,
    supportedEnvironments: ["sandbox", "production"],
    submissionMethod: "official_file_export",
    supportedFileType: "CSV",
    apiAvailability: "file_portal_only",
    authenticationMethod: "Portal_Session_Export",
    deliveryMode: "batch",
    callbackSupported: false,
    customerActionItemsAr: [
      "تزويد الرقم التأميني للمنشأة لدى الهيئة القومية للتأمين الاجتماعي",
      "اعتماد المفوض بالتوقيع على استمارات 1 و 2 و 6",
    ],
    onboardingGuidanceAr:
      "يولد موصل التأمينات المصرية (NOSI) حزم استمارات 1 و 2 و 6 وفق القانون 148 لسنة 2019 مع فحص الرقم القومي المكون من 14 رقماً.",
  },
  ETA: {
    provider: "ETA",
    countryCode: "EG",
    requires_x509: true,
    requires_oauth: true,
    requires_establishment_number: true,
    requires_tax_number: true,
    requires_payroll_registration: true,
    requires_sif: false,
    requires_callback_url: true,
    supportedEnvironments: ["sandbox", "test", "production"],
    submissionMethod: "b2g_api_and_file",
    supportedFileType: "CSV",
    apiAvailability: "public_b2g_api",
    authenticationMethod: "X509_API_Key",
    deliveryMode: "hybrid",
    callbackSupported: true,
    customerActionItemsAr: [
      "تزويد رقم التسجيل الضريبي الموحد للمنشأة (9 أرقام)",
      "إصدار شهادة الختم الإلكتروني المصرية (Egypt Trust / ई-Seal X.509)",
      "تفعيل بيانات الربط على بوابة مصلحة الضرائب المصرية ومنظومة توحيد معايير الأجور",
    ],
    onboardingGuidanceAr:
      "يدعم موصل مصلحة الضرائب المصرية (ETA) إقرارات كسب العمل الشهرية والتسويات الضريبية مع التحقق من شهادة التوقيع الإلكتروني.",
  },
  GRSIA: {
    provider: "GRSIA",
    countryCode: "QA",
    requires_x509: false,
    requires_oauth: false,
    requires_establishment_number: true,
    requires_tax_number: false,
    requires_payroll_registration: true,
    requires_sif: false,
    requires_callback_url: false,
    supportedEnvironments: ["sandbox", "production"],
    submissionMethod: "official_file_export",
    supportedFileType: "CSV",
    apiAvailability: "file_portal_only",
    authenticationMethod: "Portal_Session_Export",
    deliveryMode: "batch",
    callbackSupported: false,
    customerActionItemsAr: [
      "تزويد رقم جهة العمل في الهيئة العامة للتقاعد والتأمينات الاجتماعية القطرية",
    ],
    onboardingGuidanceAr:
      "يجهز موصل GRSIA كشوف اشتراكات التقاعد والتأمينات للمواطنين القطريين وفق القانون رقم 1 لسنة 2022.",
  },
  MADLSA: {
    provider: "MADLSA",
    countryCode: "QA",
    requires_x509: false,
    requires_oauth: false,
    requires_establishment_number: true,
    requires_tax_number: false,
    requires_payroll_registration: true,
    requires_sif: true,
    requires_callback_url: false,
    supportedEnvironments: ["sandbox", "production"],
    submissionMethod: "official_file_export",
    supportedFileType: "SIF",
    apiAvailability: "file_portal_only",
    authenticationMethod: "Portal_Session_Export",
    deliveryMode: "batch",
    callbackSupported: false,
    customerActionItemsAr: [
      "تزويد رقم قيد المنشأة بوزارة العمل القطرية ومعرف المصرف لحماية الأجور",
    ],
    onboardingGuidanceAr:
      "يولد موصل وزارة العمل ومصرف قطر المركزي ملفات SIF القياسية مع التحقق من QID (11 رقماً) والآيبان القطري.",
  },
  SPF: {
    provider: "SPF",
    countryCode: "OM",
    requires_x509: false,
    requires_oauth: false,
    requires_establishment_number: true,
    requires_tax_number: false,
    requires_payroll_registration: true,
    requires_sif: false,
    requires_callback_url: false,
    supportedEnvironments: ["sandbox", "production"],
    submissionMethod: "official_file_export",
    supportedFileType: "CSV",
    apiAvailability: "file_portal_only",
    authenticationMethod: "Portal_Session_Export",
    deliveryMode: "batch",
    callbackSupported: false,
    customerActionItemsAr: [
      "تزويد رقم التسجيل في صندوق الحماية الاجتماعية بسلطنة عمان (SPF)",
    ],
    onboardingGuidanceAr:
      "يعد موصل SPF كشوف اشتراكات الحماية الاجتماعية والأمن الوظيفي وفق المرسوم السلطاني 52/2023 بالريال العماني (3 خانات عشرية).",
  },
  CBO: {
    provider: "CBO",
    countryCode: "OM",
    requires_x509: false,
    requires_oauth: false,
    requires_establishment_number: true,
    requires_tax_number: false,
    requires_payroll_registration: true,
    requires_sif: true,
    requires_callback_url: false,
    supportedEnvironments: ["sandbox", "production"],
    submissionMethod: "official_file_export",
    supportedFileType: "SIF",
    apiAvailability: "file_portal_only",
    authenticationMethod: "Portal_Session_Export",
    deliveryMode: "batch",
    callbackSupported: false,
    customerActionItemsAr: [
      "تزويد رقم السجل التجاري العماني وملف حماية الأجور لدى البنك المركزي العماني",
    ],
    onboardingGuidanceAr:
      "يولد موصل CBO ملفات حماية الأجور العمانية SIF بالريال العماني مع فحص الرقم المدني والآيبان العماني (23 خانة).",
  },
  SIO: {
    provider: "SIO",
    countryCode: "BH",
    requires_x509: false,
    requires_oauth: false,
    requires_establishment_number: true,
    requires_tax_number: false,
    requires_payroll_registration: true,
    requires_sif: false,
    requires_callback_url: false,
    supportedEnvironments: ["sandbox", "production"],
    submissionMethod: "official_file_export",
    supportedFileType: "CSV",
    apiAvailability: "file_portal_only",
    authenticationMethod: "Portal_Session_Export",
    deliveryMode: "batch",
    callbackSupported: false,
    customerActionItemsAr: [
      "تزويد رقم المنشأة في الهيئة العامة للتأمين الاجتماعي البحرينية (SIO)",
    ],
    onboardingGuidanceAr:
      "يولد موصل SIO كشوف اشتراكات التأمين الاجتماعي والتعطل ضد البطالة بالدينار البحريني (3 خانات عشرية).",
  },
  LMRA: {
    provider: "LMRA",
    countryCode: "BH",
    requires_x509: false,
    requires_oauth: false,
    requires_establishment_number: true,
    requires_tax_number: false,
    requires_payroll_registration: true,
    requires_sif: true,
    requires_callback_url: false,
    supportedEnvironments: ["sandbox", "production"],
    submissionMethod: "official_file_export",
    supportedFileType: "SIF",
    apiAvailability: "file_portal_only",
    authenticationMethod: "Portal_Session_Export",
    deliveryMode: "batch",
    callbackSupported: false,
    customerActionItemsAr: [
      "تزويد رقم السجل التجاري البحريني (CR) ورقم حساب المنشأة في هيئة تنظيم سوق العمل (LMRA)",
    ],
    onboardingGuidanceAr:
      "يولد موصل LMRA حزم حماية الأجور البحرينية والتحقق من الرقم الشخصي CPR (9 أرقام) والآيبان البحريني (22 خانة).",
  },
};

// ============================================================================
// 3. SAFE SECRET STORAGE & METADATA PROJECTION (NEVER EXPOSES RAW SECRETS)
// ============================================================================

export interface SafeCredentialInput {
  companyId: string;
  providerCode: GovernmentProviderCode;
  environment: ConnectorEnvironment;
  credentialType: CredentialType;
  secretReference: string;
  keyIdentifier: string;
  rawSecretValueForSuffixOnly?: string;
  expiresAt?: string | null;
}

export interface SafeCredentialView {
  companyId: string;
  providerCode: GovernmentProviderCode;
  environment: ConnectorEnvironment;
  credentialType: CredentialType;
  secretReference: string;
  keyIdentifier: string;
  maskedKeySuffix: string;
  status: "configured" | "verified" | "expiring_soon" | "expired" | "revoked";
  rotationState: CredentialRotationState;
  lastUpdatedAt: string;
  expiresAt: string | null;
}

export function createSafeCredentialMetadataView(
  input: SafeCredentialInput,
  rotationState: CredentialRotationState = "current"
): SafeCredentialView {
  if (!input.secretReference || !input.secretReference.trim()) {
    throw new Error("SECRET_REFERENCE_REQUIRED: External vault/environment reference is mandatory");
  }
  const suffixSource = input.rawSecretValueForSuffixOnly || input.keyIdentifier || "";
  const cleanSuffix = suffixSource.replace(/\s+/g, "").slice(-4);
  const maskedKeySuffix = cleanSuffix.length > 0 ? `****${cleanSuffix}` : "****";

  let status: SafeCredentialView["status"] = "configured";
  if (input.expiresAt) {
    const days = Math.ceil(
      (new Date(input.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days <= 0) status = "expired";
    else if (days <= 30) status = "expiring_soon";
  }

  // Never include rawSecretValueForSuffixOnly in the returned object
  return {
    companyId: input.companyId,
    providerCode: input.providerCode,
    environment: input.environment,
    credentialType: input.credentialType,
    secretReference: input.secretReference.trim(),
    keyIdentifier: input.keyIdentifier.trim(),
    maskedKeySuffix,
    status,
    rotationState,
    lastUpdatedAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
  };
}

// ============================================================================
// 4. TENANT & PROVIDER ISOLATION ENFORCEMENT
// ============================================================================

export function enforceTenantAndProviderIsolation(params: {
  requestingTenantId: string;
  resourceTenantId: string;
  requestingProvider: GovernmentProviderCode;
  credentialProvider: GovernmentProviderCode;
}): { allowed: boolean; violationCode?: string; messageAr: string } {
  if (
    !params.requestingTenantId ||
    !params.resourceTenantId ||
    params.requestingTenantId !== params.resourceTenantId
  ) {
    return {
      allowed: false,
      violationCode: "CROSS_TENANT_ACCESS_DENIED",
      messageAr:
        "رفض أمني صارم: لا يُسمح بالوصول إلى بيانات اعتماد أو إعدادات موصل تابع لمنشأة أخرى.",
    };
  }

  if (params.requestingProvider !== params.credentialProvider) {
    return {
      allowed: false,
      violationCode: "CROSS_PROVIDER_CREDENTIAL_REUSE_DENIED",
      messageAr: `رفض عزل الموصلات: لا يجوز إعادة استخدام بيانات اعتماد الموصل (${params.credentialProvider}) لتشغيل الموصل (${params.requestingProvider}).`,
    };
  }

  return {
    allowed: true,
    messageAr: "تم التحقق من عزل المستأجر (Tenant Isolation) وعزل الموصل (Provider Isolation).",
  };
}

// ============================================================================
// 5. X.509 CERTIFICATE VALIDATION & STANDBY ROTATION ENGINE
// ============================================================================

export type SupportedX509Algorithm = "RSA-2048" | "RSA-4096" | "ECDSA-P256" | "ECDSA-P384";

export interface X509CertificateOnboardingInput {
  providerCode: GovernmentProviderCode;
  subject: string;
  issuer: string;
  serialNumber: string;
  fingerprintSha256: string;
  algorithm: string;
  privateKeySecretRef: string;
  privateKeyCompatible: boolean;
  validFrom: string;
  validTo: string;
  certificateRole?: "active" | "standby_replacement" | "historical_retired";
}

export interface X509CertificateValidationResult {
  valid: boolean;
  expiryStatus:
    | "valid"
    | "expiring_90d"
    | "expiring_60d"
    | "expiring_30d"
    | "expiring_14d"
    | "expiring_7d"
    | "expired"
    | "not_configured";
  daysRemaining: number | null;
  errorsAr: string[];
  warningsAr: string[];
}

const SUPPORTED_X509_ALGORITHMS = new Set<string>([
  "RSA-2048",
  "RSA-4096",
  "ECDSA-P256",
  "ECDSA-P384",
]);

export function validateX509CertificateOnboarding(
  input: X509CertificateOnboardingInput,
  referenceDate: Date = new Date()
): X509CertificateValidationResult {
  const errorsAr: string[] = [];
  const warningsAr: string[] = [];

  if (!input.subject?.trim() || !input.subject.includes("=")) {
    errorsAr.push("حقل موضوع الشهادة (Certificate Subject DN) غير صالح أو مفقود.");
  }
  if (!input.issuer?.trim()) {
    errorsAr.push("جهة إصدار الشهادة (Certificate Issuer) إلزامية.");
  }
  if (!input.serialNumber?.trim()) {
    errorsAr.push("الرقم التسلسلي للشهادة (Serial Number) إلزامي.");
  }
  if (!input.fingerprintSha256?.trim() || input.fingerprintSha256.trim().length < 8) {
    errorsAr.push("بصمة الشهادة الرقمية (SHA-256 Fingerprint) غير صالحة.");
  }
  if (!SUPPORTED_X509_ALGORITHMS.has(input.algorithm)) {
    errorsAr.push(
      `خوارزمية التشفير (${input.algorithm}) غير مدعومة — الخوارزميات المعتمدة: RSA-2048, RSA-4096, ECDSA-P256, ECDSA-P384.`
    );
  }
  if (!input.privateKeySecretRef?.trim()) {
    errorsAr.push("مرجع المفتاح الخاص في الخزنة الآمنة (Private Key Secret Reference) إلزامي.");
  }
  if (!input.privateKeyCompatible) {
    errorsAr.push("المفتاح الخاص غير متطابق رياضياً مع المفتاح العام للشهادة (Key Pair Mismatch).");
  }

  const fromDate = new Date(input.validFrom);
  const toDate = new Date(input.validTo);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate >= toDate) {
    errorsAr.push("تواريخ صلاحية الشهادة (Valid From / Valid To) غير منطقية أو غير قابلة للقراءة.");
  }

  const expiryEval = evaluateCertificateExpiry(
    {
      issuer: input.issuer,
      subject: input.subject,
      validFrom: input.validFrom,
      validTo: input.validTo,
      fingerprintSha256: input.fingerprintSha256,
      secretEnvReference: input.privateKeySecretRef,
    },
    referenceDate
  );

  if (expiryEval.status === "expired") {
    errorsAr.push(expiryEval.messageAr);
  } else if (expiryEval.alertThresholdDays !== null) {
    warningsAr.push(expiryEval.messageAr);
  }

  return {
    valid: errorsAr.length === 0,
    expiryStatus: expiryEval.status,
    daysRemaining: expiryEval.daysRemaining,
    errorsAr,
    warningsAr,
  };
}

export function rotateX509CertificateLedger(params: {
  currentActiveCertificate: X509CertificateOnboardingInput;
  standbyReplacementCertificate: X509CertificateOnboardingInput;
  referenceDate?: Date;
}): {
  rotated: boolean;
  newActive: X509CertificateOnboardingInput;
  historicalRetired: X509CertificateOnboardingInput;
  auditAction: "certificate_rotated";
  messageAr: string;
} {
  const validation = validateX509CertificateOnboarding(
    params.standbyReplacementCertificate,
    params.referenceDate
  );
  if (!validation.valid) {
    throw new Error(
      `CERTIFICATE_ROTATION_REJECTED: ${validation.errorsAr.join(" | ")}`
    );
  }

  return {
    rotated: true,
    newActive: {
      ...params.standbyReplacementCertificate,
      certificateRole: "active",
    },
    historicalRetired: {
      ...params.currentActiveCertificate,
      certificateRole: "historical_retired",
    },
    auditAction: "certificate_rotated",
    messageAr:
      "تم ترقية الشهادة الاحتياطية (Standby) إلى شهادة نشطة والاحتفاظ بالشهادة السابقة في السجل التاريخي للتدقيق.",
  };
}

// ============================================================================
// 6. OAUTH CONFIGURATION & ANTI-STORM TOKEN REFRESH LOCKING
// ============================================================================

export interface OAuthConnectorConfig {
  companyId: string;
  providerCode: GovernmentProviderCode;
  environment: ConnectorEnvironment;
  clientId: string;
  clientSecretRef: string;
  tokenEndpoint: string;
  scopes: string[];
  tokenStatus: "not_requested" | "valid" | "refreshing" | "expired" | "revoked" | "failed";
  tokenExpiresAt?: string | null;
}

const activeOAuthRefreshLocks = new Map<string, { acquiredAt: number; correlationId: string }>();

export function buildOAuthRefreshLockKey(
  companyId: string,
  providerCode: GovernmentProviderCode,
  environment: ConnectorEnvironment
): string {
  return `oauth-refresh-lock:${companyId.trim().toLowerCase()}:${providerCode}:${environment}`;
}

export function acquireOAuthTokenRefreshLock(params: {
  companyId: string;
  providerCode: GovernmentProviderCode;
  environment: ConnectorEnvironment;
  correlationId: string;
  nowMs?: number;
}): { acquired: boolean; lockKey: string; deduplicatedInFlight: boolean; messageAr: string } {
  const lockKey = buildOAuthRefreshLockKey(
    params.companyId,
    params.providerCode,
    params.environment
  );
  const now = params.nowMs ?? Date.now();
  const existing = activeOAuthRefreshLocks.get(lockKey);

  // Lock TTL = 30 seconds to prevent duplicate refresh storms
  if (existing && now - existing.acquiredAt < 30_000) {
    return {
      acquired: false,
      lockKey,
      deduplicatedInFlight: true,
      messageAr:
        "تم منع عاصفة تحديث الرمز (Duplicate Token Refresh Storm): توجد عملية تجديد رمز جارية لنفس الموصل حالياً.",
    };
  }

  activeOAuthRefreshLocks.set(lockKey, {
    acquiredAt: now,
    correlationId: params.correlationId,
  });

  return {
    acquired: true,
    lockKey,
    deduplicatedInFlight: false,
    messageAr: "تم حجز قفل تجديد رمز OAuth2 بنجاح.",
  };
}

export function releaseOAuthTokenRefreshLock(
  companyId: string,
  providerCode: GovernmentProviderCode,
  environment: ConnectorEnvironment
): void {
  const lockKey = buildOAuthRefreshLockKey(companyId, providerCode, environment);
  activeOAuthRefreshLocks.delete(lockKey);
}

// ============================================================================
// 7. AUTHORITATIVE PRE-FLIGHT ENGINE & DETERMINISTIC READINESS SCORE
// ============================================================================

export interface ConnectorActivationPreflightInput {
  companyId: string;
  countryCode: CountryCode;
  providerCode: GovernmentProviderCode;
  environment: ConnectorEnvironment;
  companyMasterDataComplete: boolean;
  countryEnabled: boolean;
  establishmentIdentifier?: string | null;
  taxIdentifier?: string | null;
  payrollRegistrationNumber?: string | null;
  callbackUrl?: string | null;
  payrollMappingsComplete: boolean;
  employeeIdentifiersComplete: boolean;
  bankConfigurationComplete: boolean;
  credentialsConfigured: boolean;
  credentialExpired?: boolean;
  certificateMetadata?: X509CertificateOnboardingInput | null;
  connectionVerifiedInEnvironment: boolean;
  workflowApproved: boolean;
}

export interface ReadinessScoreBreakdown {
  configuration: number; // max 15
  masterData: number; // max 15
  credentials: number; // max 20
  security: number; // max 15
  connection: number; // max 15
  approval: number; // max 10
  operationalReadiness: number; // max 10
  totalScore: number; // 0..100
}

export interface ConnectorActivationPreflightResult {
  status: "PASS" | "WARNING" | "FAIL";
  goLiveStatus: CustomerGoLiveStatus;
  readinessBreakdown: ReadinessScoreBreakdown;
  actionableReasonsAr: string[];
  customerActionRequiredAr: string[];
  checks: Record<string, "PASS" | "WARNING" | "FAIL">;
}

export function runConnectorActivationPreflight(
  input: ConnectorActivationPreflightInput,
  referenceDate: Date = new Date()
): ConnectorActivationPreflightResult {
  const req = PROVIDER_ONBOARDING_REQUIREMENTS[input.providerCode];
  const actionableReasonsAr: string[] = [];
  const customerActionRequiredAr: string[] = [];
  const checks: Record<string, "PASS" | "WARNING" | "FAIL"> = {};

  // 1. Company Master Data & Country Pack
  if (input.companyMasterDataComplete && input.countryEnabled) {
    checks.company_master_data = "PASS";
  } else {
    checks.company_master_data = "FAIL";
    actionableReasonsAr.push("بيانات المنشأة الأساسية أو تفعيل حزمة الدولة غير مكتمل.");
  }

  // 2. Provider-specific identifiers
  const missingIds: string[] = [];
  if (req.requires_establishment_number && !input.establishmentIdentifier?.trim()) {
    missingIds.push("رقم المنشأة الحكومي");
  }
  if (req.requires_tax_number && !input.taxIdentifier?.trim()) {
    missingIds.push("رقم التسجيل الضريبي");
  }
  if (req.requires_payroll_registration && !input.payrollRegistrationNumber?.trim()) {
    missingIds.push("رقم ملف حماية الأجور / الرواتب");
  }
  if (req.requires_callback_url && !input.callbackUrl?.trim()) {
    missingIds.push("رابط الاستجابة الآمن (Callback URL)");
  }

  if (missingIds.length === 0) {
    checks.provider_configuration = "PASS";
  } else {
    checks.provider_configuration = "FAIL";
    actionableReasonsAr.push(`معرفات الجهة المطلوبة مفقودة: ${missingIds.join("، ")}.`);
  }

  // 3. Payroll, Employee & Bank setup
  if (
    input.payrollMappingsComplete &&
    input.employeeIdentifiersComplete &&
    (!req.requires_sif || input.bankConfigurationComplete)
  ) {
    checks.payroll_and_bank_setup = "PASS";
  } else {
    checks.payroll_and_bank_setup = "FAIL";
    actionableReasonsAr.push(
      "يلزم استكمال ربط عناصر الرواتب، الهويات القانونية للموظفين، وإعدادات الحساب البنكي لصرف الأجور."
    );
  }

  // 4. Credentials
  if (input.credentialsConfigured && !input.credentialExpired) {
    checks.credentials_configured = "PASS";
  } else if (input.credentialExpired) {
    checks.credentials_configured = "FAIL";
    actionableReasonsAr.push("بيانات الاعتماد منتهية الصلاحية — يلزم التدوير أو التجديد.");
    customerActionRequiredAr.push(...req.customerActionItemsAr);
  } else {
    checks.credentials_configured = "FAIL";
    actionableReasonsAr.push("في انتظار تزويد بيانات الاعتماد الحقيقية الخاصة بالعميل.");
    customerActionRequiredAr.push(...req.customerActionItemsAr);
  }

  // 5. X.509 Certificate
  if (!req.requires_x509) {
    checks.certificate_valid = "PASS";
  } else if (!input.certificateMetadata) {
    checks.certificate_valid = "FAIL";
    actionableReasonsAr.push("شهادة الربط الرقمية X.509 مطلوبة لهذا الموصل ولم يتم رفع بياناتها بعد.");
    customerActionRequiredAr.push("إصدار ورفع شهادة الربط الرقمية X.509 المعتمدة للمنشأة.");
  } else {
    const certVal = validateX509CertificateOnboarding(input.certificateMetadata, referenceDate);
    if (!certVal.valid) {
      checks.certificate_valid = "FAIL";
      actionableReasonsAr.push(...certVal.errorsAr);
    } else if (certVal.warningsAr.length > 0) {
      checks.certificate_valid = "WARNING";
      actionableReasonsAr.push(...certVal.warningsAr);
    } else {
      checks.certificate_valid = "PASS";
    }
  }

  // 6. Connection Verification
  if (input.connectionVerifiedInEnvironment) {
    checks.connection_verified = "PASS";
  } else {
    checks.connection_verified = "WARNING";
    actionableReasonsAr.push(
      `لم يتم توثيق نجاح اختبار الاتصال المحكوم في بيئة (${input.environment}) بعد.`
    );
  }

  // 7. Deterministic Readiness Breakdown (0..100)
  const configurationScore = checks.provider_configuration === "PASS" ? 15 : 5;
  const masterDataScore = checks.company_master_data === "PASS" ? 15 : 0;
  const credentialsScore = checks.credentials_configured === "PASS" ? 20 : 0;
  const securityScore =
    checks.certificate_valid === "PASS"
      ? 15
      : checks.certificate_valid === "WARNING"
      ? 10
      : req.requires_x509
      ? 0
      : 15;
  const connectionScore = input.connectionVerifiedInEnvironment ? 15 : 0;
  const approvalScore =
    input.environment !== "production" || input.workflowApproved ? 10 : 0;
  const operationalReadinessScore =
    checks.payroll_and_bank_setup === "PASS" ? 10 : 0;

  const totalScore =
    configurationScore +
    masterDataScore +
    credentialsScore +
    securityScore +
    connectionScore +
    approvalScore +
    operationalReadinessScore;

  const hasFail = Object.values(checks).includes("FAIL");
  const hasWarn = Object.values(checks).includes("WARNING");
  const status: "PASS" | "WARNING" | "FAIL" = hasFail
    ? "FAIL"
    : hasWarn
    ? "WARNING"
    : "PASS";

  let goLiveStatus: CustomerGoLiveStatus = "NOT_READY";
  if (checks.provider_configuration === "FAIL" || checks.company_master_data === "FAIL") {
    goLiveStatus = "CONFIGURATION_REQUIRED";
  } else if (checks.credentials_configured === "FAIL" || checks.certificate_valid === "FAIL") {
    goLiveStatus = "CUSTOMER_ACTION_REQUIRED";
  } else if (!input.connectionVerifiedInEnvironment) {
    goLiveStatus = "VERIFICATION_REQUIRED";
  } else if (input.environment === "production" && !input.workflowApproved) {
    goLiveStatus = "READY_FOR_ACTIVATION";
  } else if (status === "PASS" && input.connectionVerifiedInEnvironment) {
    goLiveStatus = "READY_FOR_ACTIVATION";
  }

  return {
    status,
    goLiveStatus,
    readinessBreakdown: {
      configuration: configurationScore,
      masterData: masterDataScore,
      credentials: credentialsScore,
      security: securityScore,
      connection: connectionScore,
      approval: approvalScore,
      operationalReadiness: operationalReadinessScore,
      totalScore,
    },
    actionableReasonsAr,
    customerActionRequiredAr,
    checks,
  };
}

// ============================================================================
// 8. CONTROLLED SERVER-SIDE CONNECTION VERIFICATION (NO FAKE CONNECTIVITY)
// ============================================================================

export interface ConnectionVerificationEvidence {
  provider: GovernmentProviderCode;
  environment: ConnectorEnvironment;
  timestamp: string;
  outcome: ControlledConnectionTestOutcome;
  responseCategory: string;
  correlationId: string;
  liveHandshakeVerified: boolean;
  messageAr: string;
}

export function verifyCustomerProviderConnection(params: {
  companyId: string;
  providerCode: GovernmentProviderCode;
  environment: ConnectorEnvironment;
  hasActualCustomerCredentials: boolean;
  establishmentIdentifier?: string | null;
  certificateMetadata?: X509CertificateOnboardingInput | null;
  simulatedProviderResponseForTestsOnly?: ControlledConnectionTestOutcome;
}): ConnectionVerificationEvidence {
  const req = PROVIDER_ONBOARDING_REQUIREMENTS[params.providerCode];
  const correlationId = `VERIFY-${params.providerCode}-${params.environment.toUpperCase()}-${Date.now()
    .toString()
    .slice(-6)}`;
  const timestamp = new Date().toISOString();

  if (req.requires_establishment_number && !params.establishmentIdentifier?.trim()) {
    return {
      provider: params.providerCode,
      environment: params.environment,
      timestamp,
      outcome: "CONFIGURATION_ERROR",
      responseCategory: "MISSING_ESTABLISHMENT_IDENTIFIER",
      correlationId,
      liveHandshakeVerified: false,
      messageAr: `خطأ في التهيئة: يجب إدخال رقم المنشأة الرسمي قبل اختبار الاتصال مع (${params.providerCode}).`,
    };
  }

  if (req.requires_x509 && params.certificateMetadata) {
    const certCheck = validateX509CertificateOnboarding(params.certificateMetadata);
    if (!certCheck.valid) {
      return {
        provider: params.providerCode,
        environment: params.environment,
        timestamp,
        outcome: "CERTIFICATE_INVALID",
        responseCategory: "X509_VALIDATION_FAILED",
        correlationId,
        liveHandshakeVerified: false,
        messageAr: certCheck.errorsAr[0] || "الشهادة الرقمية غير صالحة.",
      };
    }
  }

  // Truthfulness Rule: If actual customer credentials do not exist, return WAITING_FOR_CUSTOMER_CREDENTIALS
  if (!params.hasActualCustomerCredentials) {
    return {
      provider: params.providerCode,
      environment: params.environment,
      timestamp,
      outcome: "WAITING_FOR_CUSTOMER_CREDENTIALS",
      responseCategory: "NO_CUSTOMER_CREDENTIALS_PRESENT",
      correlationId,
      liveHandshakeVerified: false,
      messageAr: `WAITING_FOR_CUSTOMER_CREDENTIALS — الموصل (${params.providerCode}) مهيأ برمجياً وينتظر تزويد بيانات الاعتماد الحقيقية الخاصة بالعميل.`,
    };
  }

  if (req.apiAvailability === "file_portal_only" && !params.simulatedProviderResponseForTestsOnly) {
    return {
      provider: params.providerCode,
      environment: params.environment,
      timestamp,
      outcome: "NOT_SUPPORTED",
      responseCategory: "FILE_PORTAL_MODE_ONLY",
      correlationId,
      liveHandshakeVerified: false,
      messageAr: `الجهة (${params.providerCode}) تعمل بنمط رفع الحزم الرسمية (${req.supportedFileType}) ولا توفر واجهة مصافحة لحظية عامة.`,
    };
  }

  const outcome =
    params.simulatedProviderResponseForTestsOnly || "WAITING_FOR_CUSTOMER_CREDENTIALS";

  return {
    provider: params.providerCode,
    environment: params.environment,
    timestamp,
    outcome,
    responseCategory: outcome === "VERIFIED" ? "PROVIDER_HANDSHAKE_OK" : outcome,
    correlationId,
    liveHandshakeVerified: outcome === "VERIFIED",
    messageAr:
      outcome === "VERIFIED"
        ? `تم التحقق من استجابة الموصل (${params.providerCode}) في بيئة (${params.environment}) بنجاح.`
        : `نتيجة فحص الاتصال للموصل (${params.providerCode}): ${outcome}`,
  };
}

// ============================================================================
// 9. ACTIVATION GUARD, SUBMISSION GATE, SUSPENSION & RECOVERY
// ============================================================================

export function evaluateConnectorActivationGuard(params: {
  targetEnvironment: ConnectorEnvironment;
  preflightStatus: "PASS" | "WARNING" | "FAIL";
  connectionOutcome: ControlledConnectionTestOutcome;
  verifiedEnvironment?: ConnectorEnvironment | null;
  workflowApprovalCompleted: boolean;
  credentialsValid: boolean;
}): { canActivate: boolean; blockingReasonsAr: string[] } {
  const blockingReasonsAr: string[] = [];

  if (!params.credentialsValid) {
    blockingReasonsAr.push("بيانات الاعتماد غير مكتملة أو غير صالحة.");
  }
  if (params.preflightStatus === "FAIL") {
    blockingReasonsAr.push("فشل الفحص المسبق (Pre-Flight) — يجب معالجة كافة الأخطاء الحرجة أولاً.");
  }
  if (params.connectionOutcome !== "VERIFIED") {
    blockingReasonsAr.push(
      `لا يمكن تفعيل الموصل لأن حالة الاتصال الحالية هي (${params.connectionOutcome}) وليست (VERIFIED).`
    );
  }
  // Never treat sandbox connection success as production verification
  if (
    params.targetEnvironment === "production" &&
    params.verifiedEnvironment !== "production"
  ) {
    blockingReasonsAr.push(
      "حظر ترويج البيئة: لا يُعتد بنجاح الاتصال في بيئة الاختبار (Sandbox) لتفعيل بيئة الإنتاج (Production) الحية."
    );
  }
  if (params.targetEnvironment === "production" && !params.workflowApprovalCompleted) {
    blockingReasonsAr.push(
      "تفعيل بيئة الإنتاج يتطلب استكمال سلسلة الاعتماد (مسؤول التكامل ← مالك الموارد البشرية/الرواتب ← أمن المعلومات)."
    );
  }

  return {
    canActivate: blockingReasonsAr.length === 0,
    blockingReasonsAr,
  };
}

export function enforceSubmissionGate(params: {
  activationStatus: ConnectorActivationStatus;
  environment: ConnectorEnvironment;
  credentialExpired: boolean;
  certificateExpired: boolean;
}): { allowed: boolean; code: string; messageAr: string } {
  if (params.activationStatus === "suspended") {
    return {
      allowed: false,
      code: "SUBMISSION_BLOCKED_CONNECTOR_SUSPENDED",
      messageAr: "تم رفض الإرسال (Fail-Closed): الموصل الحكومي معلق حالياً لدواعي الأمان أو الصيانة.",
    };
  }
  if (params.credentialExpired) {
    return {
      allowed: false,
      code: "SUBMISSION_BLOCKED_CREDENTIAL_EXPIRED",
      messageAr: "تم رفض الإرسال (Fail-Closed): انتهت صلاحية بيانات الاعتماد.",
    };
  }
  if (params.certificateExpired) {
    return {
      allowed: false,
      code: "SUBMISSION_BLOCKED_CERTIFICATE_EXPIRED",
      messageAr: "تم رفض الإرسال (Fail-Closed): انتهت صلاحية الشهادة الرقمية X.509.",
    };
  }
  if (params.activationStatus !== "active") {
    return {
      allowed: false,
      code: "SUBMISSION_BLOCKED_CONNECTOR_NOT_ACTIVE",
      messageAr: `تم رفض الإرسال (Fail-Closed): يجب أن تكون حالة الموصل (active) قبل الإرسال (الحالة الحالية: ${params.activationStatus}).`,
    };
  }
  return {
    allowed: true,
    code: "SUBMISSION_GATE_OPEN",
    messageAr: "بوابة الإرسال مفتوحة — الموصل نشط وموثق.",
  };
}

export function evaluateAutomaticSafetySuspension(params: {
  credentialExpired: boolean;
  certificateExpired: boolean;
  consecutiveAuthFailures: number;
  providerReportedInvalidCredential: boolean;
}): {
  shouldAutoSuspend: boolean;
  reason?: ConnectorSuspensionReason;
  alertAdminNotificationAr?: string;
  tenantRemainsOperational: true;
} {
  if (params.certificateExpired) {
    return {
      shouldAutoSuspend: true,
      reason: "certificate_expired",
      alertAdminNotificationAr:
        "تعليق أمان تلقائي للموصل: انتهت صلاحية شهادة X.509. بقية أنظمة المنشأة تعمل بشكل طبيعي.",
      tenantRemainsOperational: true,
    };
  }
  if (params.credentialExpired) {
    return {
      shouldAutoSuspend: true,
      reason: "provider_invalid_credential",
      alertAdminNotificationAr:
        "تعليق أمان تلقائي للموصل: انتهت صلاحية بيانات الاعتماد. بقية أنظمة المنشأة تعمل بشكل طبيعي.",
      tenantRemainsOperational: true,
    };
  }
  if (params.providerReportedInvalidCredential) {
    return {
      shouldAutoSuspend: true,
      reason: "provider_invalid_credential",
      alertAdminNotificationAr:
        "تعليق أمان تلقائي للموصل: رفض صريح لبيانات الاعتماد من بوابة الجهة الحكومية.",
      tenantRemainsOperational: true,
    };
  }
  if (params.consecutiveAuthFailures >= 3) {
    return {
      shouldAutoSuspend: true,
      reason: "repeated_authentication_failure",
      alertAdminNotificationAr: `تعليق أمان تلقائي للموصل بعد (${params.consecutiveAuthFailures}) إخفاقات مصادقة متتالية.`,
      tenantRemainsOperational: true,
    };
  }
  return {
    shouldAutoSuspend: false,
    tenantRemainsOperational: true,
  };
}

// ============================================================================
// 10. CALLBACK / WEBHOOK SECURITY & DLQ RESUBMISSION VALIDATOR
// ============================================================================

const processedCallbackNonces = new Set<string>();

export function verifyGovernmentCallbackSecurity(params: {
  expectedTenantId: string;
  payloadTenantId: string;
  expectedProvider: GovernmentProviderCode;
  payloadProvider: GovernmentProviderCode;
  signatureHeader: string;
  expectedSignature: string;
  timestampIso: string;
  nonce: string;
  correlationId: string;
  nowMs?: number;
}): { verified: boolean; reasonCode: string; sanitizedCorrelationId: string } {
  const now = params.nowMs ?? Date.now();
  if (params.expectedTenantId !== params.payloadTenantId) {
    return {
      verified: false,
      reasonCode: "CALLBACK_TENANT_MISMATCH",
      sanitizedCorrelationId: params.correlationId,
    };
  }
  if (params.expectedProvider !== params.payloadProvider) {
    return {
      verified: false,
      reasonCode: "CALLBACK_PROVIDER_MISMATCH",
      sanitizedCorrelationId: params.correlationId,
    };
  }
  if (!params.signatureHeader || params.signatureHeader !== params.expectedSignature) {
    return {
      verified: false,
      reasonCode: "CALLBACK_INVALID_SIGNATURE",
      sanitizedCorrelationId: params.correlationId,
    };
  }
  const eventTime = new Date(params.timestampIso).getTime();
  if (Number.isNaN(eventTime) || Math.abs(now - eventTime) > 5 * 60 * 1000) {
    return {
      verified: false,
      reasonCode: "CALLBACK_TIMESTAMP_EXPIRED_REPLAY_BLOCKED",
      sanitizedCorrelationId: params.correlationId,
    };
  }
  const nonceKey = `${params.expectedTenantId}:${params.expectedProvider}:${params.nonce}`;
  if (processedCallbackNonces.has(nonceKey)) {
    return {
      verified: false,
      reasonCode: "CALLBACK_DUPLICATE_NONCE_REPLAY_BLOCKED",
      sanitizedCorrelationId: params.correlationId,
    };
  }
  processedCallbackNonces.add(nonceKey);
  return {
    verified: true,
    reasonCode: "CALLBACK_VERIFIED",
    sanitizedCorrelationId: params.correlationId,
  };
}

export function validateDlqResubmission(params: {
  payloadValid: boolean;
  connectorActivationStatus: ConnectorActivationStatus;
  credentialsValid: boolean;
  alreadyAcceptedForIdempotencyKey: boolean;
}): { canResubmit: boolean; reasonAr: string } {
  if (params.alreadyAcceptedForIdempotencyKey) {
    return {
      canResubmit: false,
      reasonAr: "تم رفض إعادة الإرسال: هذه الحزمة مقبولة مسبقاً بنفس مفتاح عدم التكرار (Idempotency).",
    };
  }
  if (!params.payloadValid) {
    return {
      canResubmit: false,
      reasonAr: "تم رفض إعادة الإرسال: بيانات الحزمة لم تجتز فحص الصحة (Payload Validation).",
    };
  }
  if (!params.credentialsValid) {
    return {
      canResubmit: false,
      reasonAr: "تم رفض إعادة الإرسال: بيانات الاعتماد أو الشهادة الرقمية غير صالحة.",
    };
  }
  if (params.connectorActivationStatus !== "active") {
    return {
      canResubmit: false,
      reasonAr: `تم رفض إعادة الإرسال: يجب أن يكون الموصل في حالة نشطة (active) قبل إعادة الإرسال من DLQ.`,
    };
  }
  return {
    canResubmit: true,
    reasonAr: "تم التحقق من سلامة الحزمة وحالة الموصل — مسموح بإعادة الإرسال الآمن.",
  };
}

// ============================================================================
// 11. REGULATORY PAYLOAD PREVIEW, FILE INTEGRITY MANIFEST & CHECKSUM
// ============================================================================

export interface RegulatoryPackageIntegrityManifest {
  provider: GovernmentProviderCode;
  countryCode: CountryCode;
  filename: string;
  recordCount: number;
  sha256Hash: string;
  crc32Checksum: string;
  maskedPreviewContent: string;
  generatedAt: string;
}

export function buildRegulatoryPackageManifestAndPreview(params: {
  provider: GovernmentProviderCode;
  countryCode: CountryCode;
  filename: string;
  rawContent: string;
  recordCount: number;
  canViewUnmaskedIdentifiers: boolean;
}): RegulatoryPackageIntegrityManifest {
  const sha256Hash = computeDeterministicPayloadHash(params.rawContent);
  let crc = 0xffffffff;
  for (let i = 0; i < params.rawContent.length; i++) {
    crc ^= params.rawContent.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  const crc32Checksum = ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, "0");

  const maskedPreviewContent = params.canViewUnmaskedIdentifiers
    ? params.rawContent
    : params.rawContent
        .split("\n")
        .map((line) => {
          if (!line.startsWith("REC|")) return line;
          const parts = line.split("|");
          if (parts[2] && parts[2].length > 4) {
            parts[2] = `${"*".repeat(parts[2].length - 4)}${parts[2].slice(-4)}`;
          }
          if (parts[3] && parts[3].length > 6) {
            parts[3] = `${parts[3].slice(0, 2)}${"*".repeat(parts[3].length - 6)}${parts[3].slice(-4)}`;
          }
          return parts.join("|");
        })
        .join("\n");

  return {
    provider: params.provider,
    countryCode: params.countryCode,
    filename: params.filename,
    recordCount: params.recordCount,
    sha256Hash,
    crc32Checksum: `CRC32-${crc32Checksum}`,
    maskedPreviewContent,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 12. CUSTOMER ONBOARDING CHECKLIST, HEALTH, GOVERNED METRICS & TASKS
// ============================================================================

export interface OnboardingChecklistStep {
  stepCode:
    | "company_master_data"
    | "government_registration"
    | "tax_identifier"
    | "payroll_registration"
    | "bank_setup"
    | "credential_setup"
    | "certificate_upload"
    | "preflight_check"
    | "connection_test"
    | "workflow_approval"
    | "final_activation";
  titleAr: string;
  ownerType: "MADARX_ADMIN" | "CUSTOMER_ACTION_REQUIRED" | "JOINT_VERIFICATION";
  required: boolean;
  status: "pending" | "completed" | "blocked" | "not_applicable";
}

export function buildProviderOnboardingChecklist(
  provider: GovernmentProviderCode,
  input?: Partial<ConnectorActivationPreflightInput>
): OnboardingChecklistStep[] {
  const req = PROVIDER_ONBOARDING_REQUIREMENTS[provider];
  return [
    {
      stepCode: "company_master_data",
      titleAr: "استكمال البيانات الأساسية للمنشأة وتفعيل حزمة الدولة",
      ownerType: "MADARX_ADMIN",
      required: true,
      status: input?.companyMasterDataComplete ? "completed" : "pending",
    },
    {
      stepCode: "government_registration",
      titleAr: "تسجيل رقم المنشأة الرسمي لدى الجهة الحكومية",
      ownerType: "CUSTOMER_ACTION_REQUIRED",
      required: req.requires_establishment_number,
      status: !req.requires_establishment_number
        ? "not_applicable"
        : input?.establishmentIdentifier
        ? "completed"
        : "pending",
    },
    {
      stepCode: "tax_identifier",
      titleAr: "إدخال رقم التسجيل الضريبي الموحد للمنشأة",
      ownerType: "CUSTOMER_ACTION_REQUIRED",
      required: req.requires_tax_number,
      status: !req.requires_tax_number
        ? "not_applicable"
        : input?.taxIdentifier
        ? "completed"
        : "pending",
    },
    {
      stepCode: "payroll_registration",
      titleAr: "إعداد ملف الرواتب وحماية الأجور لدى الجهة",
      ownerType: "MADARX_ADMIN",
      required: req.requires_payroll_registration,
      status: !req.requires_payroll_registration
        ? "not_applicable"
        : input?.payrollRegistrationNumber
        ? "completed"
        : "pending",
    },
    {
      stepCode: "bank_setup",
      titleAr: "إعداد حساب المنشأة البنكي ومعرفات الصرف (SIF / IBAN)",
      ownerType: "MADARX_ADMIN",
      required: req.requires_sif,
      status: !req.requires_sif
        ? "not_applicable"
        : input?.bankConfigurationComplete
        ? "completed"
        : "pending",
    },
    {
      stepCode: "credential_setup",
      titleAr: "تزويد مرجع مفاتيح الربط (OAuth / API Credentials) في الخزنة البيئية",
      ownerType: "CUSTOMER_ACTION_REQUIRED",
      required: true,
      status: input?.credentialsConfigured ? "completed" : "pending",
    },
    {
      stepCode: "certificate_upload",
      titleAr: "رفع والتحقق من شهادة الربط الرقمية (X.509 / mTLS)",
      ownerType: "CUSTOMER_ACTION_REQUIRED",
      required: req.requires_x509,
      status: !req.requires_x509
        ? "not_applicable"
        : input?.certificateMetadata
        ? "completed"
        : "pending",
    },
    {
      stepCode: "preflight_check",
      titleAr: "اجتياز الفحص المسبق الشامل (Pre-Flight Validation)",
      ownerType: "JOINT_VERIFICATION",
      required: true,
      status:
        input?.credentialsConfigured && input?.companyMasterDataComplete
          ? "completed"
          : "pending",
    },
    {
      stepCode: "connection_test",
      titleAr: "التحقق من الاتصال الخادمي المحكوم (Controlled Connection Test)",
      ownerType: "JOINT_VERIFICATION",
      required: true,
      status: input?.connectionVerifiedInEnvironment ? "completed" : "pending",
    },
    {
      stepCode: "workflow_approval",
      titleAr: "اعتماد التفعيل النهائي (مسؤول التكامل ← الرواتب ← أمن المعلومات)",
      ownerType: "MADARX_ADMIN",
      required: true,
      status: input?.workflowApproved ? "completed" : "pending",
    },
    {
      stepCode: "final_activation",
      titleAr: "تفعيل الموصل للعمل الحي وفتح بوابة الإرسال (ACTIVE)",
      ownerType: "MADARX_ADMIN",
      required: true,
      status:
        input?.connectionVerifiedInEnvironment && input?.workflowApproved
          ? "completed"
          : "pending",
    },
  ];
}

export interface GovernedIntegrationMetrics {
  GOV_CONNECTOR_ACTIVE_RATE: number;
  GOV_CONNECTOR_VERIFICATION_RATE: number;
  GOV_SUBMISSION_SUCCESS_RATE: number;
  GOV_AUTH_FAILURE_RATE: number;
  GOV_DLQ_COUNT: number;
  CERTIFICATE_EXPIRY_RISK: number;
  CUSTOMER_CONNECTOR_READINESS: number;
}

export function computeGovernmentIntegrationGovernedMetrics(params: {
  totalConnectors: number;
  activeConnectors: number;
  verifiedConnectors: number;
  totalSubmissions: number;
  successfulSubmissions: number;
  authFailureCount: number;
  dlqCount: number;
  expiringOrExpiredCertificatesCount: number;
  averageReadinessScore: number;
}): GovernedIntegrationMetrics {
  const totalConn = Math.max(1, params.totalConnectors);
  const totalSub = Math.max(1, params.totalSubmissions);
  return {
    GOV_CONNECTOR_ACTIVE_RATE: Math.round((params.activeConnectors / totalConn) * 10000) / 100,
    GOV_CONNECTOR_VERIFICATION_RATE:
      Math.round((params.verifiedConnectors / totalConn) * 10000) / 100,
    GOV_SUBMISSION_SUCCESS_RATE:
      params.totalSubmissions === 0
        ? 100
        : Math.round((params.successfulSubmissions / totalSub) * 10000) / 100,
    GOV_AUTH_FAILURE_RATE:
      Math.round((params.authFailureCount / totalConn) * 10000) / 100,
    GOV_DLQ_COUNT: params.dlqCount,
    CERTIFICATE_EXPIRY_RISK: params.expiringOrExpiredCertificatesCount,
    CUSTOMER_CONNECTOR_READINESS: Math.round(params.averageReadinessScore * 100) / 100,
  };
}

export function createSanitizedConnectorAuditEvent(params: {
  companyId: string;
  providerCode: GovernmentProviderCode;
  environment: ConnectorEnvironment;
  actionType:
    | "credential_configured"
    | "credential_replaced"
    | "certificate_uploaded"
    | "certificate_rotated"
    | "connector_verified"
    | "connector_activated"
    | "connector_suspended"
    | "connector_reactivated";
  actorId: string;
  metadata: Record<string, unknown>;
}): {
  companyId: string;
  providerCode: GovernmentProviderCode;
  environment: ConnectorEnvironment;
  actionType: string;
  actorId: string;
  correlationId: string;
  sanitizedMetadata: Record<string, unknown>;
  createdAt: string;
} {
  return {
    companyId: params.companyId,
    providerCode: params.providerCode,
    environment: params.environment,
    actionType: params.actionType,
    actorId: params.actorId,
    correlationId: `AUD-${params.providerCode}-${Date.now().toString().slice(-6)}`,
    sanitizedMetadata: sanitizeGovernmentAuditPayload(params.metadata),
    createdAt: new Date().toISOString(),
  };
}

export function getAllProviderOnboardingSpecs(): ProviderOnboardingRequirementSpec[] {
  return ALL_GOVERNMENT_PROVIDER_CODES.map((code) => ({
    ...PROVIDER_ONBOARDING_REQUIREMENTS[code],
    countryCode: GOVERNMENT_CONNECTOR_REGISTRY[code].spec.countryCode,
  }));
}
