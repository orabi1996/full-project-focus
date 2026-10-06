/**
 * Production Notifications Domain
 * Re-exports domain types, hooks, categories and mutations.
 */
import {
  EnterpriseNotification,
  NotificationCategory,
  NotificationSeverity,
  NotificationChannel,
  DeliveryStatus,
  NotificationTemplate,
  NotificationPreference,
  NotificationDelivery,
  NOTIFICATION_CATEGORIES_CONFIG,
  useNotificationsInbox,
  useUnreadNotificationsCount,
  useNotificationTemplates,
  useNotificationPreferences,
  useNotificationMutations,
  fetchNotificationsServer,
  fetchUnreadCountServer,
  markNotificationStatusRecord,
  markAllNotificationsReadRecord,
  sendEnterpriseNotificationRecord,
} from "../../data/notifications-repository";

export type {
  EnterpriseNotification,
  NotificationCategory,
  NotificationSeverity,
  NotificationChannel,
  DeliveryStatus,
  NotificationTemplate,
  NotificationPreference,
  NotificationDelivery,
};

export {
  NOTIFICATION_CATEGORIES_CONFIG,
  useNotificationsInbox,
  useUnreadNotificationsCount,
  useNotificationTemplates,
  useNotificationPreferences,
  useNotificationMutations,
  fetchNotificationsServer,
  fetchUnreadCountServer,
  markNotificationStatusRecord,
  markAllNotificationsReadRecord,
  sendEnterpriseNotificationRecord,
};

// Backward-compatible hook signature for existing callers
export function useNotifications() {
  const query = useNotificationsInbox();
  const mutations = useNotificationMutations();

  return {
    notifications: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    markNotificationRead: mutations.markAsRead,
    markAllNotificationsRead: mutations.markAllAsRead,
    archiveNotification: mutations.archiveNotification,
  };
}
