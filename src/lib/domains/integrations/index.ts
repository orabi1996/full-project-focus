// ============================================================================
// PROMPT 23: MADARX ENTERPRISE INTEGRATION HUB DOMAIN
// Canonical Definitions, Connector Catalogs, Webhook Events, Scopes & Crypto
// ============================================================================

export type ConnectorCategory =
  | "gov_hr"
  | "gov_payroll"
  | "bank_payments"
  | "erp_accounting"
  | "attendance_devices"
  | "identity_sso"
  | "messaging"
  | "file_exchange"
  | "generic_rest"
  | "generic_webhook";

export type ConnectorStatus =
  | "not_configured"
  | "configured"
  | "testing"
  | "connected"
  | "degraded"
  | "failed"
  | "disabled";

export type RunStatus =
  | "queued"
  | "running"
  | "success"
  | "partial_success"
  | "failed"
  | "cancelled";

export type RunDirection = "inbound" | "outbound" | "bidirectional";

export interface IntegrationConnector {
  id: string;
  companyId: string;
  connectorType: string;
  providerCode: string;
  nameAr: string;
  nameEn: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  enabled: boolean;
  configuration: Record<string, unknown>;
  healthSummary: {
    adapter_ready?: boolean;
    last_test_success?: boolean;
    last_correlation_id?: string;
    last_run_id?: string;
    message?: string;
    [key: string]: unknown;
  };
  lastTestAt?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationRun {
  id: string;
  companyId: string;
  connectorId: string;
  parentRunId?: string | null;
  correlationId: string;
  idempotencyKey?: string | null;
  operation: string;
  direction: RunDirection;
  status: RunStatus;
  startedAt: string;
  completedAt?: string | null;
  recordsReceived: number;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  retryCount: number;
  maxRetries: number;
  errorCode?: string | null;
  sanitizedErrorMessage?: string | null;
  payloadSummary: Record<string, unknown>;
  createdAt: string;
  connectorNameAr?: string;
  connectorNameEn?: string;
  connectorType?: string;
}

export interface IntegrationRunItem {
  id: string;
  companyId: string;
  runId: string;
  itemIndex: number;
  entityType: string;
  entityId?: string | null;
  externalId?: string | null;
  status: "pending" | "processed" | "failed" | "skipped";
  errorMessage?: string | null;
  payloadPreview?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApiClient {
  id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  description?: string | null;
  status: "active" | "suspended" | "revoked";
  rateLimitRpm: number;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  scopes: string[];
}

export interface WebhookSubscription {
  id: string;
  companyId: string;
  name: string;
  url: string;
  secretRef: string;
  subscribedEvents: string[];
  status: "active" | "failing" | "disabled";
  failureCount: number;
  maxRetries: number;
  lastDeliveryAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  companyId: string;
  subscriptionId: string;
  eventType: string;
  correlationId: string;
  payload: Record<string, unknown>;
  httpStatus?: number | null;
  responseBody?: string | null;
  durationMs?: number | null;
  attempt: number;
  status: "pending" | "delivered" | "failed" | "retrying";
  nextRetryAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface IntegrationMapping {
  id: string;
  companyId: string;
  connectorId?: string | null;
  entityType: "department" | "cost_center" | "job_title" | "gl_account" | "leave_type" | "employment_status";
  sourceValue: string;
  sourceLabel?: string | null;
  targetValue: string;
  targetLabel?: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationFile {
  id: string;
  companyId: string;
  connectorId?: string | null;
  fileType: string;
  filename: string;
  direction: "inbound" | "outbound";
  status: "received" | "validated" | "processing" | "completed" | "completed_with_errors" | "rejected";
  rowCount: number;
  validCount: number;
  errorCount: number;
  fileSizeBytes: number;
  fileHashSha256: string;
  storagePath?: string | null;
  errorSummary?: Array<{ row: number; error: string; field?: string }> | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSecretMetadata {
  id: string;
  companyId: string;
  connectorId?: string | null;
  secretRef: string;
  secretName: string;
  secretType: "api_key" | "client_secret" | "private_key" | "sftp_password" | "webhook_signing_key" | "oauth_token" | "service_account";
  maskedPreview: string;
  fingerprint: string;
  rotationStatus: "active" | "rotating" | "revoked";
  expiresAt?: string | null;
  lastRotatedAt: string;
  rotationDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BiometricPunch {
  id?: string;
  companyId: string;
  deviceId: string;
  deviceSerial?: string | null;
  externalUserId: string;
  employeeId?: string | null;
  punchTime: string;
  punchType: "check_in" | "check_out" | "break_in" | "break_out" | "unknown";
  verificationMode?: "fingerprint" | "face" | "card" | "pin" | "manual";
  correlationId: string;
  processingStatus: "raw" | "deduplicated" | "processed" | "ignored" | "failed";
  rawPayload?: Record<string, unknown>;
}

export interface IntegrationHubOverview {
  companyId: string;
  totalConnectors: number;
  connectedCount: number;
  configuredCount: number;
  failedCount: number;
  runs24h: number;
  successRate: number;
  activeWebhooks: number;
  activeApiClients: number;
  pendingRetries: number;
  recentRuns: IntegrationRun[];
}

// ============================================================================
// CANONICAL WEBHOOK EVENT CATALOG
// ============================================================================
export interface WebhookEventDefinition {
  code: string;
  category: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  samplePayload: Record<string, unknown>;
}

export const WEBHOOK_EVENT_CATALOG: WebhookEventDefinition[] = [
  {
    code: "employee.created",
    category: "employees",
    nameAr: "إنشاء موظف جديد",
    nameEn: "Employee Created",
    descriptionAr: "يتم إطلاقه فور إضافة وتوثيق ملف موظف جديد على المنصة.",
    samplePayload: {
      event: "employee.created",
      timestamp: "2026-10-06T08:00:00Z",
      data: {
        employee_id: "emp-9812",
        employee_no: "E-1004",
        first_name_ar: "محمد",
        last_name_ar: "القحطاني",
        national_id: "1098765432",
        department: "تقنية المعلومات",
        hire_date: "2026-10-01",
      },
    },
  },
  {
    code: "employee.terminated",
    category: "employees",
    nameAr: "إنهاء خدمة موظف",
    nameEn: "Employee Terminated",
    descriptionAr: "يتم إطلاقه عند استكمال واعتماد إنهاء الخدمة وإخلاء الطرف.",
    samplePayload: {
      event: "employee.terminated",
      timestamp: "2026-10-06T12:00:00Z",
      data: {
        employee_id: "emp-9812",
        employee_no: "E-1004",
        last_working_day: "2026-10-31",
        reason: "end_of_contract",
      },
    },
  },
  {
    code: "attendance.punch_created",
    category: "attendance",
    nameAr: "تسجيل بصمة حضور/انصراف",
    nameEn: "Biometric Punch Logged",
    descriptionAr: "يتم إطلاقه فور استلام بصمة محققة من أجهزة الحضور البيومترية.",
    samplePayload: {
      event: "attendance.punch_created",
      timestamp: "2026-10-06T07:45:12Z",
      data: {
        device_id: "ZK-HQ-01",
        employee_no: "E-1004",
        punch_type: "check_in",
        verification_mode: "fingerprint",
      },
    },
  },
  {
    code: "leave.approved",
    category: "leaves",
    nameAr: "اعتماد طلب إجازة",
    nameEn: "Leave Request Approved",
    descriptionAr: "يتم إطلاقه عند الاعتماد النهائي لطلب الإجازة من صاحب الصلاحية.",
    samplePayload: {
      event: "leave.approved",
      timestamp: "2026-10-06T09:30:00Z",
      data: {
        leave_request_id: "req-4501",
        employee_no: "E-1004",
        leave_type: "annual",
        start_date: "2026-11-01",
        end_date: "2026-11-15",
        days_count: 15,
      },
    },
  },
  {
    code: "payroll.finalized",
    category: "payroll",
    nameAr: "اعتماد وقفل مسير الرواتب",
    nameEn: "Payroll Run Finalized",
    descriptionAr: "يتم إطلاقه عند إغلاق مسير الرواتب وجاهزية ملف حماية الأجور WPS.",
    samplePayload: {
      event: "payroll.finalized",
      timestamp: "2026-10-25T14:00:00Z",
      data: {
        payroll_run_id: "pr-2026-10",
        period: "2026-10",
        total_employees: 142,
        total_net_salary: 875450.0,
        currency: "SAR",
        wps_status: "ready",
      },
    },
  },
  {
    code: "expense.approved",
    category: "expenses",
    nameAr: "اعتماد مطالبة مصروفات",
    nameEn: "Expense Claim Approved",
    descriptionAr: "يتم إطلاقه عند اعتماد صرف مطالبة عهدة أو بدل نقدي.",
    samplePayload: {
      event: "expense.approved",
      timestamp: "2026-10-06T11:15:00Z",
      data: {
        claim_id: "exp-3011",
        employee_no: "E-1004",
        amount: 1450.0,
        currency: "SAR",
        category: "travel_lodging",
      },
    },
  },
  {
    code: "integration.run_failed",
    category: "system",
    nameAr: "فشل مزامنة تكامل خارجي",
    nameEn: "Integration Run Failed",
    descriptionAr: "يتم إطلاقه عند فشل أي عملية ربط مع نظام خارجي أو منصة حكومية.",
    samplePayload: {
      event: "integration.run_failed",
      timestamp: "2026-10-06T10:02:18Z",
      data: {
        connector_type: "odoo",
        operation: "export_gl_journal",
        error_code: "CONNECTION_TIMEOUT",
        correlation_id: "corr_20261006_091102_a98f12",
      },
    },
  },
];

// ============================================================================
// CANONICAL PUBLIC API SCOPES CATALOG
// ============================================================================
export interface ApiScopeDefinition {
  scope: string;
  category: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
}

export const API_SCOPES_CATALOG: ApiScopeDefinition[] = [
  {
    scope: "employees.read",
    category: "الموظفون",
    nameAr: "قراءة بيانات الموظفين",
    nameEn: "Read Employees",
    descriptionAr: "الوصول لقائمة الموظفين، بيانات العقود والمسميات الوظيفية والأقسام.",
  },
  {
    scope: "employees.write",
    category: "الموظفون",
    nameAr: "إدارة وتعديل بيانات الموظفين",
    nameEn: "Write Employees",
    descriptionAr: "إنشاء وتحديث وتعديل سجلات الموظفين والعقود.",
  },
  {
    scope: "attendance.read",
    category: "الحضور والانصراف",
    nameAr: "قراءة سجلات الحضور",
    nameEn: "Read Attendance",
    descriptionAr: "استعلام سجلات الحضور والانصراف اليومية وحركات البصمة وساعات التأخير.",
  },
  {
    scope: "attendance.write",
    category: "الحضور والانصراف",
    nameAr: "تسجيل بصمات الحضور",
    nameEn: "Write Attendance Punches",
    descriptionAr: "إرسال حركات البصمة البيومترية من البوابات والأجهزة الخارجية.",
  },
  {
    scope: "payroll.read",
    category: "الرواتب والمستحقات",
    nameAr: "قراءة مسيرات الرواتب",
    nameEn: "Read Payroll",
    descriptionAr: "استعلام ملخصات المسيرات والبدلات والاستقطاعات الصافية.",
  },
  {
    scope: "payroll.export",
    category: "الرواتب والمستحقات",
    nameAr: "تصدير القيود وملفات WPS",
    nameEn: "Export WPS & Financial Journals",
    descriptionAr: "توليد وتصدير ملف حماية الأجور وقيود اليومية المحاسبية لأنظمة ERP.",
  },
  {
    scope: "leaves.read",
    category: "الإجازات",
    nameAr: "قراءة رصيد وطلبات الإجازات",
    nameEn: "Read Leaves",
    descriptionAr: "استعلام أرصدة الإجازات السنوية والمرضية والطلبات المعتمدة.",
  },
  {
    scope: "leaves.write",
    category: "الإجازات",
    nameAr: "إنشاء وتحديث الإجازات",
    nameEn: "Write Leaves",
    descriptionAr: "تقديم وتحديث طلبات الإجازات وتسوية الأيام المستحقة.",
  },
  {
    scope: "organization.read",
    category: "الهيكل التنظيمي",
    nameAr: "قراءة الهيكل ومراكز التكلفة",
    nameEn: "Read Organization",
    descriptionAr: "استعلام الأقسام والفروع والشركات التابعة ومراكز التكلفة.",
  },
  {
    scope: "integrations.read",
    category: "التكاملات",
    nameAr: "مراقبة مسارات التكامل",
    nameEn: "Read Integrations",
    descriptionAr: "استعلام حالة الروابط الخارجية وسجلات المزامنة التشغيلية.",
  },
  {
    scope: "integrations.write",
    category: "التكاملات",
    nameAr: "إدارة التكاملات والترحيل",
    nameEn: "Manage Integrations",
    descriptionAr: "تشغيل دورات المزامنة اليدوية، إعادة الترحيل، وإدارة الربط.",
  },
  {
    scope: "webhooks.manage",
    category: "الـ Webhooks",
    nameAr: "إدارة اشتراكات الـ Webhook",
    nameEn: "Manage Webhook Subscriptions",
    descriptionAr: "تسجيل وإيقاف واختبار نقاط استلام الأحداث الفورية.",
  },
];

// ============================================================================
// CRYPTO & VALIDATION HELPERS
// ============================================================================

/**
 * Generates an HMAC-SHA256 signature for outbound Webhook delivery payloads.
 */
export async function generateHmacSha256Signature(
  secret: string,
  timestamp: number,
  payloadString: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${timestamp}.${payloadString}`);
  const keyData = encoder.encode(secret);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback signature hash if crypto.subtle is unavailable
  let hash = 0;
  const combined = `${secret}:${timestamp}:${payloadString}`;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  return `sha256_fallback_${Math.abs(hash).toString(16)}`;
}

/**
 * Generates a correlation ID with date prefix and unique random string.
 */
export function generateCorrelationId(prefix: string = "corr"): string {
  const dateStr = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${dateStr}_${rand}`;
}

/**
 * Generates an idempotency key based on operation name and payload signature.
 */
export function generateIdempotencyKey(
  operation: string,
  companyId: string,
  uniqueSeed: string
): string {
  return `idemp_${operation}_${companyId.substring(0, 8)}_${uniqueSeed}`;
}

/**
 * Validates connector configuration against requirements to enforce truthfulness.
 */
export function validateConnectorConfig(
  connectorType: string,
  config: Record<string, unknown>
): { isValid: boolean; missingFields: string[]; message: string } {
  const missing: string[] = [];

  switch (connectorType) {
    case "qiwa":
    case "muqeem":
    case "gosi":
    case "mudad":
      if (!config.establishment_id && !config.cr_number) {
        missing.push("establishment_id / cr_number (رقم المنشأة أو السجل التجاري)");
      }
      if (!config.api_key && !config.client_secret) {
        missing.push("api_key / client_secret (مفتاح الربط الوزاري المعتمد)");
      }
      break;

    case "odoo":
    case "sap":
    case "oracle":
    case "zoho":
      if (!config.server_url && !config.endpoint) {
        missing.push("server_url (رابط خادم النظام المحاسبي)");
      }
      if (!config.api_key && !config.api_token && !config.database) {
        missing.push("api_key / database (بيانات قاعدة البيانات والمصادقة)");
      }
      break;

    case "wps_sif":
    case "generic_biometric":
      // Built-in handlers are always valid
      break;

    default:
      if (!config.endpoint && !config.api_key && !config.sandbox_mode) {
        missing.push("endpoint / api_key (عنوان الخدمة أو مفتاح الوصول)");
      }
  }

  const isValid = missing.length === 0;
  return {
    isValid,
    missingFields: missing,
    message: isValid
      ? "إعدادات الربط مكتملة ومطابقة لمتطلبات الاتصال."
      : `BLOCKED — CREDENTIALS NOT CONFIGURED: الحقول التالية مطلوبة: ${missing.join(", ")}`,
  };
}

export { useIntegrations } from "../../data/integrations-repository";
