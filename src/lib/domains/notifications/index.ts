import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "../../auth/AuthContext";
import { markNotificationReadRecord } from "../../data/operational-repository";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";

export function useNotifications() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoNotifications = useDemoStore((s) => s.notifications);

  const notifications = isLive ? bootstrap.notifications : demoNotifications;

  return {
    notifications,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useNotificationMutations() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const markNotificationRead = useCallback(
    async (id: string): Promise<void> => {
      if (!isLive) {
        demoStore.notifications = demoStore.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        );
        demoStore.notify();
        return;
      }

      try {
        await markNotificationReadRecord(id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    },
    [isLive, queryClient],
  );

  return { markNotificationRead };
}
