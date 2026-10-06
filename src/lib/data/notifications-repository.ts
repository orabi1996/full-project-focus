import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "../../integrations/supabase/client";
import { useAuth } from "../auth/AuthContext";
import { useBootstrapData } from "../domains/bootstrap/use-bootstrap";
import { notificationQueryKeys } from "../query/notification-query-keys";
import { demoStore, useDemoStore } from "../domains/demo/demo-store";

const db = supabase as any;

export type NotificationCategory =
  | "approvals"
  | "attendance"
  | "leave"
  | "payroll"
  | "recruitment"
  | "performance"
  | "workforce"
  | "expenses"
  | "assets"
  | "documents"
  | "security"
  | "system";

export type NotificationSeverity = "info" | "success" | "warning" | "critical";
export type NotificationChannel = "in_app" | "email" | "sms" | "webhook";
export type DeliveryStatus = "pending" | "sent" | "delivered" | "failed" | "retrying";

export interface EnterpriseNotification {
  id: string;
  companyId?: string;
  recipientId: string;
  eventCode: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  bodyAr?: string;
  bodyEn?: string;
  relatedEntity?: string;
  relatedRecordId?: string;
  linkPath?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  isArchived: boolean;
  archivedAt?: string;
  deliveryStatus: DeliveryStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  companyId?: string;
  eventCode: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  titleTemplateAr: string;
  titleTemplateEn: string;
  bodyTemplateAr: string;
  bodyTemplateEn: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
  isMandatory: boolean;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  recipientTarget: string;
  status: DeliveryStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  errorDetails?: string;
  createdAt: string;
}

export const NOTIFICATION_CATEGORIES_CONFIG: Record<
  NotificationCategory,
  { labelAr: string; labelEn: string; icon: string; color: string }
> = {
  approvals: { labelAr: "الاعتمادات وسير العمل", labelEn: "Approvals", icon: "approval", color: "#2563EB" },
  attendance: { labelAr: "الحضور والانصراف", labelEn: "Attendance", icon: "schedule", color: "#059669" },
  leave: { labelAr: "الإجازات والرصيد", labelEn: "Leaves", icon: "beach_access", color: "#D97706" },
  payroll: { labelAr: "الرواتب والمسيرات", labelEn: "Payroll", icon: "payments", color: "#7C3AED" },
  recruitment: { labelAr: "التوظيف والمقابلات", labelEn: "Recruitment", icon: "badge", color: "#DB2777" },
  performance: { labelAr: "تقييم الأداء", labelEn: "Performance", icon: "trending_up", color: "#0D9488" },
  workforce: { labelAr: "تخطيط القوى العاملة", labelEn: "Workforce", icon: "groups", color: "#4F46E5" },
  expenses: { labelAr: "المصروفات والعهد", labelEn: "Expenses", icon: "receipt_long", color: "#EA580C" },
  assets: { labelAr: "العهد والأجهزة", labelEn: "Assets", icon: "devices", color: "#475569" },
  documents: { labelAr: "الوثائق والشهادات", labelEn: "Documents", icon: "description", color: "#0284C7" },
  security: { labelAr: "الأمان والتحقق", labelEn: "Security", icon: "shield", color: "#DC2626" },
  system: { labelAr: "تنبيهات النظام", labelEn: "System", icon: "settings_suggest", color: "#64748B" },
};

// ============================================================================
// DEMO FALLBACK DATA
// ============================================================================
const DEMO_TEMPLATES: NotificationTemplate[] = [
  {
    id: "tpl-01",
    eventCode: "approval.request_submitted",
    category: "approvals",
    channel: "in_app",
    titleTemplateAr: "طلب اعتماد جديد: {{request_type}}",
    titleTemplateEn: "New Approval Request: {{request_type}}",
    bodyTemplateAr: "قام الموظف {{requester_name}} بتقديم طلب {{request_type}} برقم مرجعي {{ref}}",
    bodyTemplateEn: "Employee {{requester_name}} submitted request {{ref}}",
    isSystem: true,
    isActive: true,
  },
  {
    id: "tpl-02",
    eventCode: "task.sla_warning",
    category: "system",
    channel: "in_app",
    titleTemplateAr: "تحذير اقتراب انتهاء SLA للمهمة {{task_number}}",
    titleTemplateEn: "SLA Warning for Task {{task_number}}",
    bodyTemplateAr: "المهمة تجاوزت 75% من المهلة المحددة لحلها",
    bodyTemplateEn: "Task has reached 75% of designated SLA time",
    isSystem: true,
    isActive: true,
  },
  {
    id: "tpl-03",
    eventCode: "security.suspicious_login",
    category: "security",
    channel: "email",
    titleTemplateAr: "تنبيه أمني: تسجيل دخول من جهاز جديد",
    titleTemplateEn: "Security Alert: New Device Login",
    bodyTemplateAr: "تم رصد تسجيل دخول لحسابك من عنوان IP غير معتاد",
    bodyTemplateEn: "New login detected from unfamiliar IP address",
    isSystem: true,
    isActive: true,
  },
];

const DEMO_PREFERENCES: NotificationPreference[] = (
  Object.keys(NOTIFICATION_CATEGORIES_CONFIG) as NotificationCategory[]
).flatMap((cat) => [
  {
    id: `pref-${cat}-in_app`,
    userId: "demo-user",
    category: cat,
    channel: "in_app",
    enabled: true,
    isMandatory: cat === "security" || cat === "system",
  },
  {
    id: `pref-${cat}-email`,
    userId: "demo-user",
    category: cat,
    channel: "email",
    enabled: cat === "security" || cat === "approvals" || cat === "payroll",
    isMandatory: cat === "security",
  },
]);

// Map database row to domain notification
export function mapNotificationRow(row: Record<string, any>): EnterpriseNotification {
  return {
    id: row.id,
    companyId: row.company_id || undefined,
    recipientId: row.recipient_id || "all",
    eventCode: row.event_code || "general.notification",
    category: (row.category || row.type || "system") as NotificationCategory,
    severity: (row.severity || "info") as NotificationSeverity,
    titleAr: row.title_ar || "إشعار جديد",
    titleEn: row.title_en || "New Notification",
    messageAr: row.message_ar || row.body_ar || "",
    messageEn: row.message_en || row.body_en || "",
    bodyAr: row.body_ar || undefined,
    bodyEn: row.body_en || undefined,
    relatedEntity: row.related_entity || undefined,
    relatedRecordId: row.related_record_id || undefined,
    linkPath: row.link_path || row.action_url || undefined,
    actionUrl: row.action_url || row.link_path || undefined,
    isRead: Boolean(row.is_read),
    readAt: row.read_at || undefined,
    isArchived: Boolean(row.is_archived),
    archivedAt: row.archived_at || undefined,
    deliveryStatus: (row.delivery_status || "delivered") as DeliveryStatus,
    metadata: typeof row.metadata === "object" ? row.metadata : undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

// ============================================================================
// SERVER FETCHERS
// ============================================================================
export async function fetchNotificationsServer(params: {
  userId?: string;
  companyId?: string;
  category?: string;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<EnterpriseNotification[]> {
  let query = db
    .from("notifications_inbox")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.companyId) {
    query = query.or(`company_id.eq.${params.companyId},company_id.is.null`);
  }
  if (params.userId) {
    query = query.or(`recipient_id.eq.${params.userId},recipient_id.is.null`);
  }
  if (params.category && params.category !== "all") {
    query = query.eq("category", params.category);
  }
  if (params.unreadOnly) {
    query = query.eq("is_read", false);
  }
  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[NotificationsRepo] fetch error:", error.message);
    throw error;
  }
  return (data || []).map(mapNotificationRow);
}

export async function fetchUnreadCountServer(userId?: string, companyId?: string): Promise<number> {
  let query = db
    .from("notifications_inbox")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if (userId) {
    query = query.or(`recipient_id.eq.${userId},recipient_id.is.null`);
  }
  if (companyId) {
    query = query.or(`company_id.eq.${companyId},company_id.is.null`);
  }

  const { count, error } = await query;
  if (error) {
    console.warn("[NotificationsRepo] count error:", error.message);
    return 0;
  }
  return count || 0;
}

export async function fetchNotificationTemplatesServer(companyId?: string): Promise<NotificationTemplate[]> {
  let query = db.from("notification_templates").select("*").order("category");
  if (companyId) {
    query = query.or(`company_id.eq.${companyId},company_id.is.null`);
  }
  const { data, error } = await query;
  if (error) {
    console.warn("[NotificationsRepo] templates error:", error.message);
    return DEMO_TEMPLATES;
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    companyId: r.company_id || undefined,
    eventCode: r.event_code,
    category: r.category as NotificationCategory,
    channel: r.channel as NotificationChannel,
    titleTemplateAr: r.title_template_ar,
    titleTemplateEn: r.title_template_en,
    bodyTemplateAr: r.body_template_ar,
    bodyTemplateEn: r.body_template_en,
    isSystem: Boolean(r.is_system),
    isActive: Boolean(r.is_active),
  }));
}

export async function fetchNotificationPreferencesServer(userId?: string): Promise<NotificationPreference[]> {
  if (!userId) return DEMO_PREFERENCES;
  const { data, error } = await db
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId);
  if (error || !data || data.length === 0) {
    return DEMO_PREFERENCES;
  }
  return data.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    category: r.category as NotificationCategory,
    channel: r.channel as NotificationChannel,
    enabled: Boolean(r.enabled),
    isMandatory: Boolean(r.is_mandatory),
  }));
}

// ============================================================================
// MUTATIONS
// ============================================================================
export async function markNotificationStatusRecord(
  id: string,
  isRead?: boolean,
  isArchived?: boolean,
): Promise<void> {
  const { error } = await db.rpc("mark_notification_status", {
    p_notification_id: id,
    p_is_read: isRead ?? null,
    p_is_archived: isArchived ?? null,
  });
  if (error) {
    // Direct table update fallback
    await db
      .from("notifications_inbox")
      .update({
        ...(isRead !== undefined ? { is_read: isRead, read_at: isRead ? new Date().toISOString() : null } : {}),
        ...(isArchived !== undefined ? { is_archived: isArchived, archived_at: isArchived ? new Date().toISOString() : null } : {}),
      })
      .eq("id", id);
  }
}

export async function markAllNotificationsReadRecord(userId: string): Promise<void> {
  const { error } = await db.rpc("mark_all_notifications_read", {
    p_user_id: userId,
  });
  if (error) {
    await db
      .from("notifications_inbox")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .eq("is_read", false);
  }
}

export async function sendEnterpriseNotificationRecord(payload: {
  companyId?: string;
  recipientId: string;
  eventCode: string;
  category: NotificationCategory;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  severity?: NotificationSeverity;
  relatedEntity?: string;
  relatedRecordId?: string;
  linkPath?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; notificationId?: string }> {
  const { data, error } = await db.rpc("send_enterprise_notification", {
    p_company_id: payload.companyId || null,
    p_recipient_id: payload.recipientId,
    p_event_code: payload.eventCode,
    p_category: payload.category,
    p_title_ar: payload.titleAr,
    p_title_en: payload.titleEn,
    p_message_ar: payload.messageAr,
    p_message_en: payload.messageEn,
    p_severity: payload.severity || "info",
    p_related_entity: payload.relatedEntity || null,
    p_related_record_id: payload.relatedRecordId || null,
    p_link_path: payload.linkPath || null,
    p_metadata: payload.metadata || {},
  });

  if (error) throw new Error(error.message);
  return { ok: true, notificationId: data?.notification_id };
}

// ============================================================================
// REACT HOOKS
// ============================================================================
export function useNotificationsInbox(filters?: { category?: string; unreadOnly?: boolean; limit?: number }) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id;
  const userId = session?.user?.id;
  const demoNotifications = useDemoStore((s) => s.notifications);

  return useQuery<EnterpriseNotification[]>({
    queryKey: notificationQueryKeys.inbox(userId, companyId, filters),
    queryFn: async () => {
      if (!isLive) {
        let list = demoNotifications.map((n) => ({
          id: n.id,
          recipientId: n.recipientId,
          eventCode: "general.notification",
          category: (n.type as NotificationCategory) || "system",
          severity: "info" as NotificationSeverity,
          titleAr: n.titleAr,
          titleEn: n.titleEn,
          messageAr: n.messageAr,
          messageEn: n.messageEn,
          linkPath: n.actionUrl,
          isRead: n.isRead,
          isArchived: false,
          deliveryStatus: "delivered" as DeliveryStatus,
          createdAt: n.createdAt,
        }));
        if (filters?.category && filters.category !== "all") {
          list = list.filter((n) => n.category === filters.category);
        }
        if (filters?.unreadOnly) {
          list = list.filter((n) => !n.isRead);
        }
        return list;
      }
      return fetchNotificationsServer({
        userId,
        companyId,
        category: filters?.category,
        unreadOnly: filters?.unreadOnly,
        limit: filters?.limit,
      });
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useUnreadNotificationsCount() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id;
  const userId = session?.user?.id;
  const demoNotifications = useDemoStore((s) => s.notifications);

  return useQuery<number>({
    queryKey: notificationQueryKeys.unreadCount(userId),
    queryFn: async () => {
      if (!isLive) {
        return demoNotifications.filter((n) => !n.isRead).length;
      }
      return fetchUnreadCountServer(userId, companyId);
    },
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useNotificationTemplates() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id;

  return useQuery<NotificationTemplate[]>({
    queryKey: notificationQueryKeys.templates(companyId),
    queryFn: async () => {
      if (!isLive) return DEMO_TEMPLATES;
      return fetchNotificationTemplatesServer(companyId);
    },
  });
}

export function useNotificationPreferences() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const userId = session?.user?.id;

  return useQuery<NotificationPreference[]>({
    queryKey: notificationQueryKeys.preferences(userId),
    queryFn: async () => {
      if (!isLive) return DEMO_PREFERENCES;
      return fetchNotificationPreferencesServer(userId);
    },
  });
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const userId = session?.user?.id;

  const markAsRead = useCallback(
    async (id: string) => {
      if (!isLive) {
        demoStore.notifications = demoStore.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        );
        demoStore.notify();
        await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
        return;
      }
      await markNotificationStatusRecord(id, true);
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
    [isLive, queryClient],
  );

  const markAllAsRead = useCallback(async () => {
    if (!isLive) {
      demoStore.notifications = demoStore.notifications.map((n) => ({ ...n, isRead: true }));
      demoStore.notify();
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
      return;
    }
    if (userId) {
      await markAllNotificationsReadRecord(userId);
    }
    await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
  }, [isLive, queryClient, userId]);

  const archiveNotification = useCallback(
    async (id: string) => {
      if (!isLive) {
        demoStore.notifications = demoStore.notifications.filter((n) => n.id !== id);
        demoStore.notify();
        await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
        return;
      }
      await markNotificationStatusRecord(id, undefined, true);
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
    },
    [isLive, queryClient],
  );

  return {
    markAsRead,
    markNotificationRead: markAsRead,
    markAllAsRead,
    archiveNotification,
  };
}
