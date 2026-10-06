/**
 * Production Enterprise Audit & Observability Domain
 */
import {
  EnterpriseAuditEvent,
  AuditSeverity,
  AuditIntegrityResult,
  BackgroundJob,
  DeadLetterJob,
  OperationsHealthSummary,
  maskSensitiveData,
  computeLocalAuditHash,
  useEnterpriseAuditEvents,
  useAuditIntegrityCheck,
  useBackgroundJobs,
  useDeadLetterJobs,
  useOperationsHealthSummary,
  useAuditMutations,
  fetchAuditEventsServer,
  verifyAuditIntegrityServer,
  logEnterpriseAuditEventRecord,
} from "../../data/audit-repository";

export type {
  EnterpriseAuditEvent,
  AuditSeverity,
  AuditIntegrityResult,
  BackgroundJob,
  DeadLetterJob,
  OperationsHealthSummary,
};

export {
  maskSensitiveData,
  computeLocalAuditHash,
  useEnterpriseAuditEvents,
  useAuditIntegrityCheck,
  useBackgroundJobs,
  useDeadLetterJobs,
  useOperationsHealthSummary,
  useAuditMutations,
  fetchAuditEventsServer,
  verifyAuditIntegrityServer,
  logEnterpriseAuditEventRecord,
};

// Backward-compatible hook for legacy callers
export function useAudit() {
  const query = useEnterpriseAuditEvents();
  return {
    auditLogs: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
