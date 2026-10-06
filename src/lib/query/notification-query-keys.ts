export const notificationQueryKeys = {
  all: ["notifications"] as const,
  inbox: (userId?: string, companyId?: string, filters?: Record<string, unknown>) =>
    [...notificationQueryKeys.all, "inbox", userId || "all", companyId || "all", filters || {}] as const,
  unreadCount: (userId?: string) =>
    [...notificationQueryKeys.all, "unread-count", userId || "current"] as const,
  templates: (companyId?: string) =>
    [...notificationQueryKeys.all, "templates", companyId || "all"] as const,
  preferences: (userId?: string) =>
    [...notificationQueryKeys.all, "preferences", userId || "current"] as const,
  deliveries: (notificationId?: string) =>
    notificationId
      ? ([...notificationQueryKeys.all, "deliveries", notificationId] as const)
      : ([...notificationQueryKeys.all, "deliveries"] as const),
};
