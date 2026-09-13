import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { AuditLogEntry } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { createAuditEventRecord } from "../../data/operational-repository";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";

export function useAudit() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoLogs = useDemoStore((s) => s.auditLogs);

  const auditLogs = isLive ? bootstrap.auditLogs : demoLogs;

  return {
    auditLogs,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useAuditMutations() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const logAuditEvent = useCallback(
    async (
      action: string,
      entityType: string,
      entityId: string,
      entityName: string,
      changesSummary: string,
      actor?: { id: string; name: string; role: string },
    ): Promise<void> => {
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

      if (!isLive) {
        demoStore.auditLogs = [newLog, ...demoStore.auditLogs];
        demoStore.notify();
        return;
      }

      try {
        await createAuditEventRecord(newLog);
        await queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
      } catch (err) {
        console.error("Failed to log audit event:", err);
      }
    },
    [isLive, queryClient],
  );

  return { logAuditEvent };
}
