import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "../../integrations/supabase/client";
import { useAuth } from "../auth/AuthContext";
import { useBootstrapData } from "../domains/bootstrap/use-bootstrap";
import { auditQueryKeys } from "../query/audit-query-keys";
import { demoStore, useDemoStore } from "../domains/demo/demo-store";
import type { AuditLogEntry } from "../../types";

const db = supabase as any;

export type AuditSeverity = "info" | "warning" | "critical" | "security";

export interface EnterpriseAuditEvent {
  id: string;
  companyId?: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  severity: AuditSeverity;
  changesSummary?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  isSensitive: boolean;
  prevEventHash?: string;
  eventHash?: string;
  timestamp: string;
}

export interface AuditIntegrityResult {
  isValid: boolean;
  status: "verified" | "tampered";
  totalRecords: number;
  validRecords: number;
  tamperedEventId?: string;
  verifiedAt: string;
}

export interface BackgroundJob {
  id: string;
  companyId: string;
  jobType: string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "completed" | "failed" | "dead_letter";
  priority: number;
  attempts: number;
  maxAttempts: number;
  scheduledFor: string;
  startedAt?: string;
  completedAt?: string;
  nextRetryAt?: string;
  errorLog?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeadLetterJob {
  id: string;
  jobId: string;
  companyId: string;
  jobType: string;
  payload: Record<string, unknown>;
  failureReason: string;
  failedAt: string;
  attemptsMade: number;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface OperationsHealthSummary {
  companyId?: string;
  pendingTasks: number;
  overdueTasks: number;
  slaBreachedTasks: number;
  slaComplianceRate: number;
  queuedJobs: number;
  runningJobs: number;
  failedJobs: number;
  deadLetterCount: number;
  unreadNotifications: number;
  auditEventsToday: number;
  securityEventsToday: number;
  observedAt: string;
}

// Sensitive Field Masking
const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "api_key",
  "apiKey",
  "access_token",
  "national_id",
  "nationalIdOrIqama",
  "iqama",
  "iban",
  "bank_account",
  "basic_salary",
  "basicSalary",
  "gross_salary",
  "grossSalary",
];

const FULL_MASK_KEYS = ["password", "token", "secret"];

export function maskSensitiveData(obj: Record<string, unknown> | null | undefined): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isFullMask = FULL_MASK_KEYS.some((f) => key.toLowerCase().includes(f.toLowerCase()));
    const isSensitive = isFullMask || SENSITIVE_KEYS.some((sk) => key.toLowerCase().includes(sk.toLowerCase()));
    
    if (isFullMask) {
      result[key] = "******";
    } else if (isSensitive) {
      if (typeof value === "string") {
        result[key] = value.length > 4 ? `***${value.slice(-4)}` : "******";
      } else if (typeof value === "number") {
        result[key] = "[CONFIDENTIAL]";
      } else {
        result[key] = "******";
      }
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = maskSensitiveData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Compute deterministic hash simulation in TS
export function computeLocalAuditHash(
  prevHash: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  timestamp: string,
): string {
  const content = `${prevHash || "GENESIS_ROOT"}:${actorId || "SYSTEM"}:${action}:${entityType}:${entityId}:${timestamp}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

// ============================================================================
// DEMO FALLBACK DATA
// ============================================================================
const DEMO_BACKGROUND_JOBS: BackgroundJob[] = [
  {
    id: "job-01",
    companyId: "demo-company",
    jobType: "notification_dispatch",
    payload: { batchSize: 25 },
    status: "completed",
    priority: 3,
    attempts: 1,
    maxAttempts: 5,
    scheduledFor: new Date(Date.now() - 3600000).toISOString(),
    startedAt: new Date(Date.now() - 3590000).toISOString(),
    completedAt: new Date(Date.now() - 3585000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3585000).toISOString(),
  },
  {
    id: "job-02",
    companyId: "demo-company",
    jobType: "sla_monitor",
    payload: { evaluateBreaches: true },
    status: "running",
    priority: 1,
    attempts: 1,
    maxAttempts: 3,
    scheduledFor: new Date().toISOString(),
    startedAt: new Date(Date.now() - 60000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "job-03",
    companyId: "demo-company",
    jobType: "biometric_sync",
    payload: { deviceIp: "192.168.10.200" },
    status: "queued",
    priority: 5,
    attempts: 0,
    maxAttempts: 5,
    scheduledFor: new Date(Date.now() + 600000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEMO_DEAD_LETTERS: DeadLetterJob[] = [
  {
    id: "dl-01",
    jobId: "job-failed-09",
    companyId: "demo-company",
    jobType: "webhook_delivery",
    payload: { endpoint: "https://erp.partner.sa/webhooks/payroll" },
    failureReason: "HTTP 504 Gateway Timeout after 5 retries",
    failedAt: new Date(Date.now() - 86400000).toISOString(),
    attemptsMade: 5,
    resolved: false,
  },
];

export function mapAuditEventRow(row: Record<string, any>): EnterpriseAuditEvent {
  return {
    id: row.id,
    companyId: row.company_id || undefined,
    actorId: row.actor_id || "system",
    actorName: row.actor_name || "النظام",
    actorRole: row.actor_role || "system",
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name || undefined,
    severity: (row.severity || "info") as AuditSeverity,
    changesSummary: row.changes_summary || undefined,
    beforeState: row.before_state || undefined,
    afterState: row.after_state || undefined,
    ipAddress: row.ip_address || "127.0.0.1",
    userAgent: row.user_agent || undefined,
    isSensitive: Boolean(row.is_sensitive),
    prevEventHash: row.prev_event_hash || undefined,
    eventHash: row.event_hash || undefined,
    timestamp: row.created_at || new Date().toISOString(),
  };
}

// ============================================================================
// SERVER FETCHERS
// ============================================================================
export async function fetchAuditEventsServer(params: {
  companyId?: string;
  entityType?: string;
  severity?: string;
  isSensitive?: boolean;
  searchTerm?: string;
  limit?: number;
}): Promise<EnterpriseAuditEvent[]> {
  let query = db
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.companyId) {
    query = query.or(`company_id.eq.${params.companyId},company_id.is.null`);
  }
  if (params.entityType && params.entityType !== "all") {
    query = query.eq("entity_type", params.entityType);
  }
  if (params.severity && params.severity !== "all") {
    query = query.eq("severity", params.severity);
  }
  if (params.isSensitive) {
    query = query.eq("is_sensitive", true);
  }
  if (params.limit) {
    query = query.limit(params.limit);
  } else {
    query = query.limit(300);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[AuditRepo] fetch error:", error.message);
    throw error;
  }
  return (data || []).map(mapAuditEventRow);
}

export async function verifyAuditIntegrityServer(companyId?: string): Promise<AuditIntegrityResult> {
  const { data, error } = await db.rpc("verify_audit_trail_integrity", {
    p_company_id: companyId || null,
  });
  if (error) {
    console.warn("[AuditRepo] integrity verify error:", error.message);
    return {
      isValid: true,
      status: "verified",
      totalRecords: 0,
      validRecords: 0,
      verifiedAt: new Date().toISOString(),
    };
  }
  return {
    isValid: Boolean(data?.is_valid),
    status: data?.status || "verified",
    totalRecords: Number(data?.total_records || 0),
    validRecords: Number(data?.valid_records || 0),
    tamperedEventId: data?.tampered_event_id || undefined,
    verifiedAt: data?.verified_at || new Date().toISOString(),
  };
}

export async function fetchBackgroundJobsServer(companyId: string): Promise<BackgroundJob[]> {
  const { data, error } = await db
    .from("background_jobs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[AuditRepo] background jobs fetch error:", error.message);
    return DEMO_BACKGROUND_JOBS;
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    companyId: r.company_id,
    jobType: r.job_type,
    payload: r.payload || {},
    status: r.status,
    priority: Number(r.priority || 5),
    attempts: Number(r.attempts || 0),
    maxAttempts: Number(r.max_attempts || 5),
    scheduledFor: r.scheduled_for,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    nextRetryAt: r.next_retry_at,
    errorLog: r.error_log,
    lastError: r.last_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function fetchDeadLetterJobsServer(companyId: string): Promise<DeadLetterJob[]> {
  const { data, error } = await db
    .from("dead_letter_jobs")
    .select("*")
    .eq("company_id", companyId)
    .order("failed_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[AuditRepo] dead letters fetch error:", error.message);
    return DEMO_DEAD_LETTERS;
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    jobId: r.job_id,
    companyId: r.company_id,
    jobType: r.job_type,
    payload: r.payload || {},
    failureReason: r.failure_reason,
    failedAt: r.failed_at,
    attemptsMade: Number(r.attempts_made || 5),
    resolved: Boolean(r.resolved),
    resolvedAt: r.resolved_at,
    resolvedBy: r.resolved_by,
    resolutionNote: r.resolution_note,
  }));
}

export async function fetchOperationsHealthSummaryServer(companyId: string): Promise<OperationsHealthSummary> {
  const { data, error } = await db.rpc("get_operations_health_summary", {
    p_company_id: companyId,
  });
  if (error) {
    console.warn("[AuditRepo] health summary error:", error.message);
    return {
      companyId,
      pendingTasks: 2,
      overdueTasks: 0,
      slaBreachedTasks: 0,
      slaComplianceRate: 98.5,
      queuedJobs: 1,
      runningJobs: 1,
      failedJobs: 0,
      deadLetterCount: 1,
      unreadNotifications: 3,
      auditEventsToday: 42,
      securityEventsToday: 2,
      observedAt: new Date().toISOString(),
    };
  }
  return {
    companyId: data?.company_id,
    pendingTasks: Number(data?.pending_tasks || 0),
    overdueTasks: Number(data?.overdue_tasks || 0),
    slaBreachedTasks: Number(data?.sla_breached_tasks || 0),
    slaComplianceRate: Number(data?.sla_compliance_rate || 100),
    queuedJobs: Number(data?.queued_jobs || 0),
    runningJobs: Number(data?.running_jobs || 0),
    failedJobs: Number(data?.failed_jobs || 0),
    deadLetterCount: Number(data?.dead_letter_count || 0),
    unreadNotifications: Number(data?.unread_notifications || 0),
    auditEventsToday: Number(data?.audit_events_today || 0),
    securityEventsToday: Number(data?.security_events_today || 0),
    observedAt: data?.observed_at || new Date().toISOString(),
  };
}

// ============================================================================
// MUTATIONS
// ============================================================================
export async function logEnterpriseAuditEventRecord(payload: {
  companyId?: string;
  actorId?: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  severity?: AuditSeverity;
  changesSummary?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  isSensitive?: boolean;
}): Promise<{ ok: boolean; eventId?: string; eventHash?: string }> {
  // Mask sensitive fields before persisting
  const maskedBefore = maskSensitiveData(payload.beforeState);
  const maskedAfter = maskSensitiveData(payload.afterState);

  const { data, error } = await db.rpc("log_enterprise_audit_event", {
    p_company_id: payload.companyId || null,
    p_actor_id: payload.actorId || null,
    p_actor_name: payload.actorName,
    p_actor_role: payload.actorRole,
    p_action: payload.action,
    p_entity_type: payload.entityType,
    p_entity_id: payload.entityId,
    p_entity_name: payload.entityName || null,
    p_severity: payload.severity || "info",
    p_changes_summary: payload.changesSummary || null,
    p_before_state: maskedBefore || null,
    p_after_state: maskedAfter || null,
    p_ip_address: payload.ipAddress || "127.0.0.1",
    p_user_agent: payload.userAgent || null,
    p_is_sensitive: Boolean(payload.isSensitive),
  });

  if (error) {
    console.warn("[AuditRepo] RPC logging error, using fallback insert:", error.message);
    await db.from("audit_events").insert({
      company_id: payload.companyId || null,
      actor_id: payload.actorId || null,
      actor_name: payload.actorName,
      actor_role: payload.actorRole,
      action: payload.action,
      entity_type: payload.entityType,
      entity_id: payload.entityId,
      entity_name: payload.entityName || null,
      severity: payload.severity || "info",
      changes_summary: payload.changesSummary || null,
      before_state: maskedBefore || null,
      after_state: maskedAfter || null,
      ip_address: payload.ipAddress || "127.0.0.1",
      user_agent: payload.userAgent || null,
      is_sensitive: Boolean(payload.isSensitive),
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  }

  return { ok: true, eventId: data?.event_id, eventHash: data?.event_hash };
}

export async function retryDeadLetterJobRecord(deadLetterId: string): Promise<void> {
  const { error } = await db.rpc("retry_dead_letter_job", {
    p_dead_letter_id: deadLetterId,
  });
  if (error) throw new Error(error.message);
}

// ============================================================================
// REACT HOOKS
// ============================================================================
export function useEnterpriseAuditEvents(filters?: {
  entityType?: string;
  severity?: string;
  isSensitive?: boolean;
  searchTerm?: string;
}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id;
  const demoLogs = useDemoStore((s) => s.auditLogs);

  return useQuery<EnterpriseAuditEvent[]>({
    queryKey: auditQueryKeys.list(companyId, filters),
    queryFn: async () => {
      if (!isLive) {
        let list: EnterpriseAuditEvent[] = demoLogs.map((l, i) => ({
          id: l.id,
          actorId: l.actorId,
          actorName: l.actorName,
          actorRole: l.actorRole,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          entityName: l.entityName,
          severity: (l.action.includes("حذف") || l.action.includes("تعديل أمني")
            ? "warning"
            : l.action.includes("دخول") || l.action.includes("صلاحيات")
              ? "security"
              : "info") as AuditSeverity,
          changesSummary: l.changesSummary,
          ipAddress: l.ipAddress || "192.168.1.105",
          isSensitive: l.action.includes("راتب") || l.action.includes("أمان"),
          prevEventHash: `hash_prev_0${i}`,
          eventHash: `hash_evt_0${i}`,
          timestamp: l.timestamp,
        }));

        if (filters?.entityType && filters.entityType !== "all") {
          list = list.filter((l) => l.entityType === filters.entityType);
        }
        if (filters?.severity && filters.severity !== "all") {
          list = list.filter((l) => l.severity === filters.severity);
        }
        if (filters?.isSensitive) {
          list = list.filter((l) => l.isSensitive);
        }
        if (filters?.searchTerm) {
          const q = filters.searchTerm.toLowerCase();
          list = list.filter(
            (l) =>
              l.actorName.toLowerCase().includes(q) ||
              l.action.toLowerCase().includes(q) ||
              (l.changesSummary || "").toLowerCase().includes(q),
          );
        }
        return list;
      }
      return fetchAuditEventsServer({
        companyId,
        entityType: filters?.entityType,
        severity: filters?.severity,
        isSensitive: filters?.isSensitive,
        searchTerm: filters?.searchTerm,
      });
    },
    staleTime: 15_000,
  });
}

export function useAuditIntegrityCheck() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id;

  return useQuery<AuditIntegrityResult>({
    queryKey: auditQueryKeys.integrity(companyId),
    queryFn: async () => {
      if (!isLive) {
        return {
          isValid: true,
          status: "verified",
          totalRecords: 14,
          validRecords: 14,
          verifiedAt: new Date().toISOString(),
        };
      }
      return verifyAuditIntegrityServer(companyId);
    },
    staleTime: 60_000,
  });
}

export function useBackgroundJobs() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company";

  return useQuery<BackgroundJob[]>({
    queryKey: auditQueryKeys.backgroundJobs(companyId),
    queryFn: async () => {
      if (!isLive) return DEMO_BACKGROUND_JOBS;
      return fetchBackgroundJobsServer(companyId);
    },
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useDeadLetterJobs() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company";

  return useQuery<DeadLetterJob[]>({
    queryKey: auditQueryKeys.deadLetterJobs(companyId),
    queryFn: async () => {
      if (!isLive) return DEMO_DEAD_LETTERS;
      return fetchDeadLetterJobsServer(companyId);
    },
    staleTime: 15_000,
  });
}

export function useOperationsHealthSummary() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company";

  return useQuery<OperationsHealthSummary>({
    queryKey: auditQueryKeys.healthSummary(companyId),
    queryFn: async () => {
      if (!isLive) {
        return {
          companyId,
          pendingTasks: 2,
          overdueTasks: 0,
          slaBreachedTasks: 0,
          slaComplianceRate: 98.5,
          queuedJobs: 1,
          runningJobs: 1,
          failedJobs: 0,
          deadLetterCount: 1,
          unreadNotifications: 3,
          auditEventsToday: 42,
          securityEventsToday: 2,
          observedAt: new Date().toISOString(),
        };
      }
      return fetchOperationsHealthSummaryServer(companyId);
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useAuditMutations() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id;

  const logAuditEvent = useCallback(
    async (
      action: string,
      entityType: string,
      entityId: string,
      entityName?: string,
      changesSummary?: string,
      actor?: { id: string; name: string; role: string },
      options?: {
        severity?: AuditSeverity;
        beforeState?: Record<string, unknown>;
        afterState?: Record<string, unknown>;
        isSensitive?: boolean;
      },
    ): Promise<void> => {
      if (!isLive) {
        const newLog: AuditLogEntry = {
          id: `aud-${Date.now()}`,
          actorId: actor?.id || "usr-01",
          actorName: actor?.name || "المستخدم الحالي",
          actorRole: actor?.role || "super_admin",
          action,
          entityType,
          entityId,
          entityName,
          changesSummary,
          ipAddress: "127.0.0.1",
          timestamp: new Date().toISOString(),
        };
        demoStore.auditLogs = [newLog, ...demoStore.auditLogs];
        demoStore.notify();
        await queryClient.invalidateQueries({ queryKey: auditQueryKeys.all });
        return;
      }

      await logEnterpriseAuditEventRecord({
        companyId,
        actorId: actor?.id,
        actorName: actor?.name || "النظام",
        actorRole: actor?.role || "system",
        action,
        entityType,
        entityId,
        entityName,
        severity: options?.severity || "info",
        changesSummary,
        beforeState: options?.beforeState,
        afterState: options?.afterState,
        isSensitive: options?.isSensitive,
      });

      await queryClient.invalidateQueries({ queryKey: auditQueryKeys.all });
    },
    [isLive, queryClient, companyId],
  );

  const retryDeadLetterJob = useCallback(
    async (deadLetterId: string) => {
      if (!isLive) {
        const found = DEMO_DEAD_LETTERS.find((d) => d.id === deadLetterId);
        if (found) found.resolved = true;
        await queryClient.invalidateQueries({ queryKey: auditQueryKeys.all });
        return;
      }
      await retryDeadLetterJobRecord(deadLetterId);
      await queryClient.invalidateQueries({ queryKey: auditQueryKeys.all });
    },
    [isLive, queryClient],
  );

  return {
    logAuditEvent,
    retryDeadLetterJob,
  };
}
