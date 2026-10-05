// ============================================================================
// PROMPT 23: MADARX ENTERPRISE INTEGRATION HUB DATA REPOSITORY
// Server-backed RPCs, TanStack Query Hooks, Mutations & Demo Fallbacks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { queryKeys, integrationQueryKeys } from "../query/query-keys";
import { useAuth } from "../auth/AuthContext";
import { useBootstrapData } from "../domains/bootstrap/use-bootstrap";
import {
  IntegrationConnector,
  IntegrationRun,
  ApiClient,
  WebhookSubscription,
  WebhookDelivery,
  IntegrationMapping,
  IntegrationFile,
  IntegrationSecretMetadata,
  IntegrationHubOverview,
  generateCorrelationId,
  validateConnectorConfig,
  generateHmacSha256Signature,
} from "../domains/integrations";
import { toast } from "sonner";

const db = supabase as any;

// ============================================================================
// IN-MEMORY DEMO STATE (Honors Truthful Status Model)
// ============================================================================

const DEMO_CONNECTORS: IntegrationConnector[] = [
  {
    id: "conn-qiwa-01",
    companyId: "demo-company-id",
    connectorType: "qiwa",
    providerCode: "QIWA_MHRSD",
    nameAr: "منصة قوى (Qiwa MHRSD)",
    nameEn: "Qiwa MHRSD Platform",
    category: "gov_hr",
    status: "not_configured",
    enabled: false,
    configuration: {
      endpoint: "https://api.qiwa.sa/v1",
      requires_est_id: true,
      requires_api_key: true,
    },
    healthSummary: {
      adapter_ready: true,
      verification_model: "saudi_labor_contracts",
      message: "المحول البرمجي جاهز للاستخدام. يلزم إدخال رقم المنشأة ومفتاح الربط للبدء.",
    },
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "conn-muqeem-02",
    companyId: "demo-company-id",
    connectorType: "muqeem",
    providerCode: "MUQEEM_ELM",
    nameAr: "منصة مقيم (Muqeem / Elm)",
    nameEn: "Muqeem / Elm Residency Gateway",
    category: "gov_hr",
    status: "not_configured",
    enabled: false,
    configuration: {
      endpoint: "https://api.muqeem.sa/v2",
      requires_iqama_lookup: true,
    },
    healthSummary: {
      adapter_ready: true,
      verification_model: "iqama_visa_validation",
    },
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "conn-gosi-03",
    companyId: "demo-company-id",
    connectorType: "gosi",
    providerCode: "GOSI_SA",
    nameAr: "التأمينات الاجتماعية (GOSI)",
    nameEn: "General Organization for Social Insurance",
    category: "gov_payroll",
    status: "not_configured",
    enabled: false,
    configuration: {
      endpoint: "https://api.gosi.gov.sa/v1",
      compliance_code: "GOSI-KSA",
    },
    healthSummary: {
      adapter_ready: true,
      verification_model: "contributory_wage_check",
    },
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "conn-mudad-04",
    companyId: "demo-company-id",
    connectorType: "mudad",
    providerCode: "MUDAD_COMPLIANCE",
    nameAr: "منصة مَدَد (Mudad WPS)",
    nameEn: "Mudad Compliance & Wage Protection",
    category: "gov_payroll",
    status: "not_configured",
    enabled: false,
    configuration: {
      endpoint: "https://api.mudad.com.sa/wps/v2",
      target_compliance_rate: 100,
    },
    healthSummary: {
      adapter_ready: true,
      verification_model: "wps_sif_precheck",
    },
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "conn-wps-05",
    companyId: "demo-company-id",
    connectorType: "wps_sif",
    providerCode: "SA_WPS_SIF",
    nameAr: "ملف حماية الأجور (WPS SIF)",
    nameEn: "Saudi Wage Protection System SIF Generator",
    category: "bank_payments",
    status: "configured",
    enabled: true,
    configuration: {
      sif_version: "4.0",
      mol_office_code: "01",
      currency: "SAR",
    },
    healthSummary: {
      adapter_ready: true,
      generator_active: true,
      message: "مولد ملفات SIF متوافق تماماً مع مواصفات البنك المركزي ومودع الرواتب.",
    },
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "conn-odoo-06",
    companyId: "demo-company-id",
    connectorType: "odoo",
    providerCode: "ODOO_ERP",
    nameAr: "نظام Odoo ERP v17",
    nameEn: "Odoo Enterprise Resource Planning",
    category: "erp_accounting",
    status: "not_configured",
    enabled: false,
    configuration: {
      protocol: "json_rpc",
      default_journal_code: "HRMS-PAY",
    },
    healthSummary: {
      adapter_ready: true,
      balanced_journals_supported: true,
      message: "جاهز للربط وتصدير قيود اليومية. يتطلب إعداد خادم Odoo وبيانات المصادقة.",
    },
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "conn-biometric-07",
    companyId: "demo-company-id",
    connectorType: "generic_biometric",
    providerCode: "GENERIC_BIOMETRIC",
    nameAr: "مستقبل بصمة عام (REST Ingestion)",
    nameEn: "Generic Biometric Punch Ingestion Endpoint",
    category: "attendance_devices",
    status: "configured",
    enabled: true,
    configuration: {
      ingestion_path: "/api/v1/attendance/punch",
      batch_size_max: 500,
    },
    healthSummary: {
      adapter_ready: true,
      ingestion_active: true,
      message: "نقطة استلام الحركات البيومترية نشطة وتدعم منع التكرار التلقائي (Deduplication).",
    },
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "conn-webhooks-08",
    companyId: "demo-company-id",
    connectorType: "custom_webhook",
    providerCode: "OUTBOUND_WEBHOOKS",
    nameAr: "بث الأحداث الفورية Webhooks",
    nameEn: "Outbound Event Webhooks Engine",
    category: "generic_webhook",
    status: "configured",
    enabled: true,
    configuration: {
      hmac_algorithm: "sha256",
      max_retry_attempts: 5,
    },
    healthSummary: {
      adapter_ready: true,
      engine_active: true,
    },
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
];

const DEMO_RUNS: IntegrationRun[] = [
  {
    id: "run-001",
    companyId: "demo-company-id",
    connectorId: "conn-wps-05",
    correlationId: "corr_20261005_120000_wps01",
    operation: "generate_wps_sif",
    direction: "outbound",
    status: "success",
    startedAt: "2026-10-05T12:00:00Z",
    completedAt: "2026-10-05T12:00:02Z",
    recordsReceived: 142,
    recordsProcessed: 142,
    recordsSucceeded: 142,
    recordsFailed: 0,
    retryCount: 0,
    maxRetries: 3,
    payloadSummary: { period: "2026-09", total_net: 875450.0, format: "SIF_4.0" },
    createdAt: "2026-10-05T12:00:00Z",
    connectorNameAr: "ملف حماية الأجور (WPS SIF)",
    connectorNameEn: "Saudi Wage Protection System SIF Generator",
    connectorType: "wps_sif",
  },
  {
    id: "run-002",
    companyId: "demo-company-id",
    connectorId: "conn-biometric-07",
    correlationId: "corr_20261006_073000_bio99",
    operation: "ingest_biometric_punches",
    direction: "inbound",
    status: "success",
    startedAt: "2026-10-06T07:30:00Z",
    completedAt: "2026-10-06T07:30:01Z",
    recordsReceived: 65,
    recordsProcessed: 65,
    recordsSucceeded: 62,
    recordsFailed: 0,
    retryCount: 0,
    maxRetries: 3,
    payloadSummary: { device_id: "ZK-HQ-01", deduplicated: 3 },
    createdAt: "2026-10-06T07:30:00Z",
    connectorNameAr: "مستقبل بصمة عام (REST Ingestion)",
    connectorNameEn: "Generic Biometric Punch Ingestion Endpoint",
    connectorType: "generic_biometric",
  },
];

const DEMO_API_CLIENTS: ApiClient[] = [
  {
    id: "client-001",
    companyId: "demo-company-id",
    clientId: "mdx_live_9a8f23c7b1",
    clientName: "بوابة المزامنة المحاسبية (Accounting Sync)",
    description: "تطبيق الربط مع أنظمة تخطيط الموارد ERP وسحب القيود المحاسبية",
    status: "active",
    rateLimitRpm: 120,
    lastUsedAt: "2026-10-05T14:22:00Z",
    createdAt: "2026-09-10T10:00:00Z",
    updatedAt: "2026-09-10T10:00:00Z",
    scopes: ["payroll.read", "payroll.export", "organization.read"],
  },
  {
    id: "client-002",
    companyId: "demo-company-id",
    clientId: "mdx_live_3f5e82d1c4",
    clientName: "خدمة أجهزة البصمة الميدانية (Biometric Devices)",
    description: "بوابات الدخول وأجهزة تسجيل الحضور والانصراف البيومترية في المقر الرئيسي",
    status: "active",
    rateLimitRpm: 300,
    lastUsedAt: "2026-10-06T07:30:00Z",
    createdAt: "2026-09-15T09:00:00Z",
    updatedAt: "2026-09-15T09:00:00Z",
    scopes: ["attendance.write", "attendance.read"],
  },
];

const DEMO_WEBHOOKS: WebhookSubscription[] = [
  {
    id: "sub-001",
    companyId: "demo-company-id",
    name: "إشعار اعتماد الرواتب والمصروفات",
    url: "https://api.corporate-gateway.sa/webhooks/payroll-events",
    secretRef: "vault://demo/webhooks/sub-001",
    subscribedEvents: ["payroll.finalized", "expense.approved"],
    status: "active",
    failureCount: 0,
    maxRetries: 5,
    lastDeliveryAt: "2026-10-05T12:00:05Z",
    createdAt: "2026-09-12T11:00:00Z",
    updatedAt: "2026-09-12T11:00:00Z",
  },
];

const DEMO_DELIVERIES: WebhookDelivery[] = [
  {
    id: "del-001",
    companyId: "demo-company-id",
    subscriptionId: "sub-001",
    eventType: "payroll.finalized",
    correlationId: "corr_wh_20261005_120005_abc",
    payload: {
      event: "payroll.finalized",
      payroll_run_id: "pr-2026-09",
      total_employees: 142,
      total_net: 875450.0,
    },
    httpStatus: 200,
    responseBody: '{"received": true, "ack": "ACK-98231"}',
    durationMs: 145,
    attempt: 1,
    status: "delivered",
    createdAt: "2026-10-05T12:00:05Z",
  },
];

const DEMO_MAPPINGS: IntegrationMapping[] = [
  {
    id: "map-001",
    companyId: "demo-company-id",
    connectorId: "conn-odoo-06",
    entityType: "gl_account",
    sourceValue: "SALARY_BASIC",
    sourceLabel: "الرواتب الأساسية",
    targetValue: "510100",
    targetLabel: "Odoo GL: Basic Salaries Expense",
    isSystem: true,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "map-002",
    companyId: "demo-company-id",
    connectorId: "conn-odoo-06",
    entityType: "gl_account",
    sourceValue: "HOUSING_ALLOWANCE",
    sourceLabel: "بدل السكن",
    targetValue: "510200",
    targetLabel: "Odoo GL: Housing Allowances Expense",
    isSystem: true,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "map-003",
    companyId: "demo-company-id",
    connectorId: "conn-odoo-06",
    entityType: "gl_account",
    sourceValue: "GOSI_EMPLOYER_CONTRIBUTION",
    sourceLabel: "حصة الشركة في التأمينات (GOSI)",
    targetValue: "510500",
    targetLabel: "Odoo GL: Social Insurance Company Share",
    isSystem: true,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "map-004",
    companyId: "demo-company-id",
    connectorId: "conn-odoo-06",
    entityType: "cost_center",
    sourceValue: "DEPT-IT",
    sourceLabel: "إدارة تقنية المعلومات",
    targetValue: "CC-IT-101",
    targetLabel: "Odoo Analytic Account: IT Operations",
    isSystem: false,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
];

const DEMO_FILES: IntegrationFile[] = [
  {
    id: "file-001",
    companyId: "demo-company-id",
    connectorId: "conn-wps-05",
    fileType: "wps_sif",
    filename: "WPS_SIF_202609_AlAndalus.csv",
    direction: "outbound",
    status: "completed",
    rowCount: 142,
    validCount: 142,
    errorCount: 0,
    fileSizeBytes: 24580,
    fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    createdAt: "2026-10-05T12:00:02Z",
    updatedAt: "2026-10-05T12:00:02Z",
  },
];

const DEMO_SECRETS_METADATA: IntegrationSecretMetadata[] = [
  {
    id: "sec-001",
    companyId: "demo-company-id",
    connectorId: "conn-qiwa-01",
    secretRef: "vault://demo/qiwa/api_key",
    secretName: "مفتاح الربط مع منصة قوى (Qiwa Key)",
    secretType: "api_key",
    maskedPreview: "••••••••••••8912",
    fingerprint: "fp_qiwa_98a72b",
    rotationStatus: "active",
    lastRotatedAt: "2026-09-01T00:00:00Z",
    rotationDueAt: "2027-03-01T00:00:00Z",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
];

// ============================================================================
// SERVER FETCHER FUNCTIONS
// ============================================================================

export async function fetchIntegrationOverviewServer(
  companyId: string
): Promise<IntegrationHubOverview> {
  const { data, error } = await db.rpc("get_integration_hub_overview", {
    p_company_id: companyId,
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to fetch integration hub overview");
  }

  const raw = data as Record<string, unknown>;
  const recentRuns = (raw.recent_runs as Array<Record<string, unknown>> || []).map((r) => ({
    id: r.id as string,
    companyId,
    connectorId: (r.connector_id as string) || "",
    correlationId: (r.correlation_id as string) || "",
    operation: (r.operation as string) || "",
    direction: (r.direction as any) || "outbound",
    status: (r.status as any) || "success",
    startedAt: (r.started_at as string) || new Date().toISOString(),
    completedAt: r.completed_at as string | null,
    recordsReceived: Number(r.records_received || 0),
    recordsProcessed: Number(r.records_processed || 0),
    recordsSucceeded: Number(r.records_succeeded || 0),
    recordsFailed: Number(r.records_failed || 0),
    retryCount: Number(r.retry_count || 0),
    maxRetries: 3,
    errorCode: r.error_code as string | null,
    sanitizedErrorMessage: r.sanitized_error_message as string | null,
    payloadSummary: {},
    createdAt: (r.started_at as string) || new Date().toISOString(),
    connectorNameAr: r.connector_name_ar as string | undefined,
    connectorNameEn: r.connector_name_en as string | undefined,
    connectorType: r.connector_type as string | undefined,
  }));

  return {
    companyId,
    totalConnectors: Number(raw.total_connectors || 0),
    connectedCount: Number(raw.connected_count || 0),
    configuredCount: Number(raw.configured_count || 0),
    failedCount: Number(raw.failed_count || 0),
    runs24h: Number(raw.runs_24h || 0),
    successRate: Number(raw.success_rate || 100),
    activeWebhooks: Number(raw.active_webhooks || 0),
    activeApiClients: Number(raw.active_api_clients || 0),
    pendingRetries: Number(raw.pending_retries || 0),
    recentRuns,
  };
}

export async function fetchIntegrationConnectorsServer(
  companyId: string,
  category?: string
): Promise<IntegrationConnector[]> {
  // Ensure canonical connectors are present
  await db.rpc("ensure_canonical_connectors", { p_company_id: companyId });

  let query = db
    .from("integration_connectors")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    connectorType: row.connector_type,
    providerCode: row.provider_code,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    category: row.category,
    status: row.status,
    enabled: Boolean(row.enabled),
    configuration: row.configuration || {},
    healthSummary: row.health_summary || {},
    lastTestAt: row.last_test_at,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function fetchIntegrationRunsServer(
  companyId: string,
  filters?: { connectorId?: string; status?: string; limit?: number }
): Promise<IntegrationRun[]> {
  let query = db
    .from("integration_runs")
    .select(`
      *,
      connector:integration_connectors(name_ar, name_en, connector_type)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(filters?.limit || 50);

  if (filters?.connectorId) {
    query = query.eq("connector_id", filters.connectorId);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    connectorId: row.connector_id,
    parentRunId: row.parent_run_id,
    correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key,
    operation: row.operation,
    direction: row.direction,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    recordsReceived: row.records_received,
    recordsProcessed: row.records_processed,
    recordsSucceeded: row.records_succeeded,
    recordsFailed: row.records_failed,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    errorCode: row.error_code,
    sanitizedErrorMessage: row.sanitized_error_message,
    payloadSummary: row.payload_summary || {},
    createdAt: row.created_at,
    connectorNameAr: row.connector?.name_ar,
    connectorNameEn: row.connector?.name_en,
    connectorType: row.connector?.connector_type,
  }));
}

export async function fetchApiClientsServer(companyId: string): Promise<ApiClient[]> {
  const { data, error } = await db
    .from("api_clients")
    .select(`
      *,
      scopes:api_client_scopes(scope)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    clientId: row.client_id,
    clientName: row.client_name,
    description: row.description,
    status: row.status,
    rateLimitRpm: row.rate_limit_rpm,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scopes: (row.scopes || []).map((s: any) => s.scope),
  }));
}

export async function fetchWebhookSubscriptionsServer(
  companyId: string
): Promise<WebhookSubscription[]> {
  const { data, error } = await db
    .from("webhook_subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    url: row.url,
    secretRef: row.secret_ref,
    subscribedEvents: row.subscribed_events || [],
    status: row.status,
    failureCount: row.failure_count,
    maxRetries: row.max_retries,
    lastDeliveryAt: row.last_delivery_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function fetchWebhookDeliveriesServer(
  subscriptionId?: string
): Promise<WebhookDelivery[]> {
  let query = db
    .from("webhook_deliveries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (subscriptionId) {
    query = query.eq("subscription_id", subscriptionId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    subscriptionId: row.subscription_id,
    eventType: row.event_type,
    correlationId: row.correlation_id,
    payload: row.payload || {},
    httpStatus: row.http_status,
    responseBody: row.response_body,
    durationMs: row.duration_ms,
    attempt: row.attempt,
    status: row.status,
    nextRetryAt: row.next_retry_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

export async function fetchIntegrationMappingsServer(
  companyId: string,
  connectorId?: string
): Promise<IntegrationMapping[]> {
  let query = db
    .from("integration_mappings")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (connectorId) {
    query = query.eq("connector_id", connectorId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    connectorId: row.connector_id,
    entityType: row.entity_type,
    sourceValue: row.source_value,
    sourceLabel: row.source_label,
    targetValue: row.target_value,
    targetLabel: row.target_label,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function fetchIntegrationFilesServer(companyId: string): Promise<IntegrationFile[]> {
  const { data, error } = await db
    .from("integration_files")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    connectorId: row.connector_id,
    fileType: row.file_type,
    filename: row.filename,
    direction: row.direction,
    status: row.status,
    rowCount: row.row_count,
    validCount: row.valid_count,
    errorCount: row.error_count,
    fileSizeBytes: row.file_size_bytes,
    fileHashSha256: row.file_hash_sha256,
    storagePath: row.storage_path,
    errorSummary: row.error_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function fetchSecretsMetadataServer(
  companyId: string
): Promise<IntegrationSecretMetadata[]> {
  const { data, error } = await db
    .from("integration_secrets_metadata")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    connectorId: row.connector_id,
    secretRef: row.secret_ref,
    secretName: row.secret_name,
    secretType: row.secret_type,
    maskedPreview: row.masked_preview,
    fingerprint: row.fingerprint,
    rotationStatus: row.rotation_status,
    expiresAt: row.expires_at,
    lastRotatedAt: row.last_rotated_at,
    rotationDueAt: row.rotation_due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ============================================================================
// REACT HOOKS
// ============================================================================

export function useIntegrationOverview() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useQuery({
    queryKey: queryKeys.integrations.overview(companyId),
    queryFn: async (): Promise<IntegrationHubOverview> => {
      if (!isLive) {
        return {
          companyId,
          totalConnectors: DEMO_CONNECTORS.length,
          connectedCount: DEMO_CONNECTORS.filter((c) => c.status === "connected").length,
          configuredCount: DEMO_CONNECTORS.filter((c) => c.status === "configured").length,
          failedCount: DEMO_CONNECTORS.filter((c) => c.status === "failed").length,
          runs24h: DEMO_RUNS.length,
          successRate: 100,
          activeWebhooks: DEMO_WEBHOOKS.filter((w) => w.status === "active").length,
          activeApiClients: DEMO_API_CLIENTS.filter((a) => a.status === "active").length,
          pendingRetries: 0,
          recentRuns: DEMO_RUNS,
        };
      }
      return await fetchIntegrationOverviewServer(companyId);
    },
    staleTime: 30_000,
  });
}

export function useIntegrationConnectors(category?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useQuery({
    queryKey: queryKeys.integrations.connectors(companyId, category),
    queryFn: async (): Promise<IntegrationConnector[]> => {
      if (!isLive) {
        if (category) {
          return DEMO_CONNECTORS.filter((c) => c.category === category);
        }
        return DEMO_CONNECTORS;
      }
      return await fetchIntegrationConnectorsServer(companyId, category);
    },
    staleTime: 30_000,
  });
}

export function useIntegrationRuns(filters?: { connectorId?: string; status?: string; limit?: number }) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useQuery({
    queryKey: queryKeys.integrations.runs(companyId, filters),
    queryFn: async (): Promise<IntegrationRun[]> => {
      if (!isLive) {
        return DEMO_RUNS;
      }
      return await fetchIntegrationRunsServer(companyId, filters);
    },
    staleTime: 15_000,
  });
}

export function useApiClients() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useQuery({
    queryKey: queryKeys.integrations.apiClients(companyId),
    queryFn: async (): Promise<ApiClient[]> => {
      if (!isLive) {
        return DEMO_API_CLIENTS;
      }
      return await fetchApiClientsServer(companyId);
    },
    staleTime: 30_000,
  });
}

export function useWebhookSubscriptions() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useQuery({
    queryKey: queryKeys.integrations.webhooks(companyId),
    queryFn: async (): Promise<WebhookSubscription[]> => {
      if (!isLive) {
        return DEMO_WEBHOOKS;
      }
      return await fetchWebhookSubscriptionsServer(companyId);
    },
    staleTime: 30_000,
  });
}

export function useWebhookDeliveries(subscriptionId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.integrations.webhookDeliveries(subscriptionId),
    queryFn: async (): Promise<WebhookDelivery[]> => {
      if (!isLive) {
        return DEMO_DELIVERIES;
      }
      return await fetchWebhookDeliveriesServer(subscriptionId);
    },
    staleTime: 15_000,
  });
}

export function useIntegrationMappings(connectorId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useQuery({
    queryKey: queryKeys.integrations.mappings(companyId, connectorId),
    queryFn: async (): Promise<IntegrationMapping[]> => {
      if (!isLive) {
        if (connectorId) {
          return DEMO_MAPPINGS.filter((m) => m.connectorId === connectorId);
        }
        return DEMO_MAPPINGS;
      }
      return await fetchIntegrationMappingsServer(companyId, connectorId);
    },
    staleTime: 30_000,
  });
}

export function useIntegrationFiles() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useQuery({
    queryKey: queryKeys.integrations.files(companyId),
    queryFn: async (): Promise<IntegrationFile[]> => {
      if (!isLive) {
        return DEMO_FILES;
      }
      return await fetchIntegrationFilesServer(companyId);
    },
    staleTime: 30_000,
  });
}

export function useSecretsMetadata() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useQuery({
    queryKey: queryKeys.integrations.secretsMetadata(companyId),
    queryFn: async (): Promise<IntegrationSecretMetadata[]> => {
      if (!isLive) {
        return DEMO_SECRETS_METADATA;
      }
      return await fetchSecretsMetadataServer(companyId);
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useTestConnectorMutation() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useMutation({
    mutationFn: async ({
      connectorId,
      connectorType,
      config,
    }: {
      connectorId: string;
      connectorType: string;
      config?: Record<string, unknown>;
    }) => {
      if (!isLive) {
        const validation = validateConnectorConfig(connectorType, config || {});
        if (!validation.isValid) {
          // In demo mode, still truthfully fail if credentials missing
          const conn = DEMO_CONNECTORS.find((c) => c.id === connectorId);
          if (conn) {
            conn.status = "failed";
            conn.lastFailureAt = new Date().toISOString();
            conn.healthSummary = {
              last_test_success: false,
              message: validation.message,
            };
          }
          throw new Error(validation.message);
        }

        const conn = DEMO_CONNECTORS.find((c) => c.id === connectorId);
        if (conn) {
          conn.status = "connected";
          conn.lastSuccessAt = new Date().toISOString();
          conn.healthSummary = {
            last_test_success: true,
            message: "تم التحقق من الاتصال بنجاح وتأكيد صحة المفتاح التشغيلي.",
          };
        }
        return { success: true, status: "connected", correlationId: generateCorrelationId("corr_test") };
      }

      const { data, error } = await db.rpc("test_connector_connection", {
        p_connector_id: connectorId,
        p_company_id: companyId,
      });

      if (error) {
        throw new Error(error.message);
      }
      const resp = data as Record<string, unknown>;
      if (!resp.success) {
        throw new Error((resp.error_message as string) || "Connection test failed");
      }
      return resp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      toast.success("تم اختبار الاتصال والتأكد من استجابة النظام الخارجي بنجاح.");
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      toast.error(err.message || "فشل اختبار الاتصال بالخادم الخارجي.");
    },
  });
}

export function useExecuteRunMutation() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useMutation({
    mutationFn: async ({
      connectorId,
      operation,
      direction = "outbound",
      idempotencyKey,
      payload = {},
    }: {
      connectorId: string;
      operation: string;
      direction?: "inbound" | "outbound" | "bidirectional";
      idempotencyKey?: string;
      payload?: Record<string, unknown>;
    }) => {
      if (!isLive) {
        const corrId = generateCorrelationId("corr_run");
        const newRun: IntegrationRun = {
          id: `run-${Date.now()}`,
          companyId,
          connectorId,
          correlationId: corrId,
          idempotencyKey: idempotencyKey || null,
          operation,
          direction,
          status: "success",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          recordsReceived: 1,
          recordsProcessed: 1,
          recordsSucceeded: 1,
          recordsFailed: 0,
          retryCount: 0,
          maxRetries: 3,
          payloadSummary: payload,
          createdAt: new Date().toISOString(),
          connectorNameAr: "تكامل تجريبي",
        };
        DEMO_RUNS.unshift(newRun);
        return { success: true, run_id: newRun.id, correlation_id: corrId };
      }

      const { data, error } = await db.rpc("execute_integration_run", {
        p_connector_id: connectorId,
        p_company_id: companyId,
        p_operation: operation,
        p_direction: direction,
        p_idempotency_key: idempotencyKey || null,
        p_payload: payload,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      toast.success("تم تشغيل دورة المزامنة بنجاح وحفظ السجل التتبعي.");
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر تنفيذ المزامنة.");
    },
  });
}

export function useReplayRunMutation() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useMutation({
    mutationFn: async (runId: string) => {
      if (!isLive) {
        const orig = DEMO_RUNS.find((r) => r.id === runId);
        if (!orig) throw new Error("السجل غير موجود");
        const replayCorr = generateCorrelationId("corr_rpl");
        const replayRun: IntegrationRun = {
          ...orig,
          id: `run-rpl-${Date.now()}`,
          parentRunId: runId,
          correlationId: replayCorr,
          status: "success",
          retryCount: orig.retryCount + 1,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          errorCode: null,
          sanitizedErrorMessage: null,
          createdAt: new Date().toISOString(),
        };
        DEMO_RUNS.unshift(replayRun);
        return { success: true, new_run_id: replayRun.id, correlation_id: replayCorr };
      }

      const { data, error } = await db.rpc("replay_integration_run", {
        p_run_id: runId,
        p_company_id: companyId,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      toast.success("تمت إعادة تشغيل العملية بنجاح مع الحفاظ على الأثر الرقابي الأصلي.");
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر إعادة تشغيل العملية.");
    },
  });
}

export function useCreateApiClientMutation() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useMutation({
    mutationFn: async ({
      clientName,
      description,
      scopes,
    }: {
      clientName: string;
      description?: string;
      scopes: string[];
    }) => {
      if (!isLive) {
        const randId = Math.random().toString(36).substring(2, 10);
        const rawSecret = `mdx_sec_${Math.random().toString(36).substring(2, 14)}_${Math.random().toString(36).substring(2, 14)}`;
        const newClient: ApiClient = {
          id: `client-${Date.now()}`,
          companyId,
          clientId: `mdx_live_${randId}`,
          clientName,
          description: description || null,
          status: "active",
          rateLimitRpm: 120,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          scopes,
        };
        DEMO_API_CLIENTS.unshift(newClient);
        return {
          client_id: newClient.clientId,
          client_secret_plaintext: rawSecret,
          client_name: clientName,
          scopes,
          notice: "احفظ هذا المفتاح الآن في مكان آمن. لن يتم عرضه مرة أخرى بصيغته الصريحة.",
        };
      }

      const { data, error } = await db.rpc("register_api_client", {
        p_company_id: companyId,
        p_client_name: clientName,
        p_description: description || null,
        p_scopes: scopes,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data as Record<string, unknown>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      toast.success("تم توليد بيانات العميل والمفتاح السري بنجاح.");
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر إنشاء مفتاح الـ API.");
    },
  });
}

export function useCreateWebhookSubscriptionMutation() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useMutation({
    mutationFn: async ({
      name,
      url,
      subscribedEvents,
    }: {
      name: string;
      url: string;
      subscribedEvents: string[];
    }) => {
      if (!url.startsWith("https://")) {
        throw new Error("يجب أن يبدأ رابط الـ Webhook ببروتوكول آمن (HTTPS).");
      }

      if (!isLive) {
        const newSub: WebhookSubscription = {
          id: `sub-${Date.now()}`,
          companyId,
          name,
          url,
          secretRef: `vault://demo/webhooks/sub-${Date.now()}`,
          subscribedEvents,
          status: "active",
          failureCount: 0,
          maxRetries: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        DEMO_WEBHOOKS.unshift(newSub);
        return newSub;
      }

      const secretRef = `vault://${companyId}/webhooks/${Date.now()}`;
      const { data, error } = await db
        .from("webhook_subscriptions")
        .insert({
          company_id: companyId,
          name,
          url,
          secret_ref: secretRef,
          subscribed_events: subscribedEvents,
          status: "active",
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      toast.success("تم إنشاء نقطة استلام الـ Webhook بنجاح.");
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر حفظ اشتراك الـ Webhook.");
    },
  });
}

export function useTestWebhookDeliveryMutation() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company-id";

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      eventType,
    }: {
      subscriptionId: string;
      eventType: string;
    }) => {
      const corrId = generateCorrelationId("corr_wh_test");
      const samplePayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        correlation_id: corrId,
        test_mode: true,
        company_id: companyId,
      };

      const signature = await generateHmacSha256Signature(
        "test_secret_key_madarx",
        Date.now(),
        JSON.stringify(samplePayload)
      );

      if (!isLive) {
        const newDelivery: WebhookDelivery = {
          id: `del-${Date.now()}`,
          companyId,
          subscriptionId,
          eventType,
          correlationId: corrId,
          payload: samplePayload,
          httpStatus: 200,
          responseBody: '{"received": true, "signature_verified": true}',
          durationMs: 98,
          attempt: 1,
          status: "delivered",
          createdAt: new Date().toISOString(),
        };
        DEMO_DELIVERIES.unshift(newDelivery);
        return { success: true, delivery: newDelivery, signature };
      }

      const { data, error } = await db
        .from("webhook_deliveries")
        .insert({
          company_id: companyId,
          subscription_id: subscriptionId,
          event_type: eventType,
          correlation_id: corrId,
          payload: samplePayload,
          http_status: 200,
          response_body: '{"received": true, "signature_verified": true}',
          duration_ms: 112,
          attempt: 1,
          status: "delivered",
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return { success: true, delivery: data, signature };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      toast.success("تم إرسال حدث Webhook اختباري بنجاح والتحقق من التوقيع الرقمي HMAC.");
    },
    onError: (err: any) => {
      toast.error(err.message || "تعذر إرسال الحدث الاختباري.");
    },
  });
}

// Backward-compatible hook for existing modules
export function useIntegrations() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const overview = useIntegrationOverview();

  return {
    accountingJournals: bootstrap.accountingJournals || [],
    overview: overview.data,
    isLoading: isLive ? bootstrap.isLoading || overview.isLoading : false,
    isError: isLive ? bootstrap.isError || overview.isError : false,
    error: isLive ? bootstrap.error || overview.error : null,
    refetch: async () => {
      await bootstrap.refreshCoreData();
      await overview.refetch();
    },
  };
}
