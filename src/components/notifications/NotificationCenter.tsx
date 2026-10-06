import React, { useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Archive,
  Filter,
  Shield,
  Clock,
  ExternalLink,
  Settings,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Mail,
  Smartphone,
  Globe,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  EnterpriseNotification,
  NotificationCategory,
  NotificationSeverity,
  NOTIFICATION_CATEGORIES_CONFIG,
  useNotificationsInbox,
  useUnreadNotificationsCount,
  useNotificationTemplates,
  useNotificationPreferences,
  useNotificationMutations,
} from "../../lib/domains/notifications";

interface NotificationCenterProps {
  onClose?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<"inbox" | "preferences" | "templates">("inbox");

  const { data: notifications = [], isLoading } = useNotificationsInbox({
    category: selectedCategory,
    unreadOnly,
  });
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const { data: templates = [] } = useNotificationTemplates();
  const { data: preferences = [] } = useNotificationPreferences();
  const { markAsRead, markAllAsRead, archiveNotification } = useNotificationMutations();

  const getSeverityIcon = (severity: NotificationSeverity) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
      default:
        return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
    }
  };

  const getSeverityBadge = (severity: NotificationSeverity) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive" className="text-[10px] px-2 py-0">حرج</Badge>;
      case "warning":
        return <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0">تنبيه</Badge>;
      case "success":
        return <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0">مكتمل</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-2 py-0">معلومة</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-foreground">مركز التنبيهات المؤسسي</h3>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs font-bold rounded-full px-2">
                {unreadCount} غير مقروء
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            إدارة كافة الإشعارات الفورية، قنوات التسليم، وتفضيلات الموظف
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-muted/70 p-1 text-xs">
            <button
              onClick={() => setActiveTab("inbox")}
              className={`rounded-lg px-3 py-1 font-bold transition-all ${
                activeTab === "inbox" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              الوارد
            </button>
            <button
              onClick={() => setActiveTab("preferences")}
              className={`rounded-lg px-3 py-1 font-bold transition-all ${
                activeTab === "preferences" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              القنوات والتفضيلات
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={`rounded-lg px-3 py-1 font-bold transition-all ${
                activeTab === "templates" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              قوالب الإشعارات
            </button>
          </div>

          {activeTab === "inbox" && unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead()}
              className="h-8 text-xs font-bold gap-1 rounded-full border-border/80"
            >
              <CheckCheck className="h-3.5 w-3.5 text-primary" />
              تحديد الكل كمقروء
            </Button>
          )}
        </div>
      </div>

      {activeTab === "inbox" && (
        <>
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`rounded-full px-3 py-1 font-bold transition-all shrink-0 ${
                  selectedCategory === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                الكل
              </button>
              {(Object.keys(NOTIFICATION_CATEGORIES_CONFIG) as NotificationCategory[]).map((cat) => {
                const conf = NOTIFICATION_CATEGORIES_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-3 py-1 font-bold transition-all shrink-0 ${
                      selectedCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {conf.labelAr}
                  </button>
                );
              })}
            </div>

            <Button
              variant={unreadOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setUnreadOnly(!unreadOnly)}
              className="h-7 text-xs font-bold rounded-full mr-auto"
            >
              <Filter className="h-3 w-3 mr-1" />
              {unreadOnly ? "عرض الكل" : "غير المقروء فقط"}
            </Button>
          </div>

          {/* Notifications List */}
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                جاري تحميل التنبيهات من السجل الموثوق...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground rounded-2xl border border-dashed p-6">
                لا توجد تنبيهات تطابق المعايير المحددة
              </div>
            ) : (
              notifications.map((n) => {
                const conf = NOTIFICATION_CATEGORIES_CONFIG[n.category] || NOTIFICATION_CATEGORIES_CONFIG.system;
                return (
                  <div
                    key={n.id}
                    className={`rounded-2xl border p-3.5 transition-all flex items-start gap-3 relative group ${
                      n.isRead
                        ? "bg-card border-border/70 text-muted-foreground"
                        : "bg-primary/5 border-primary/30 text-foreground shadow-2xs font-medium"
                    }`}
                  >
                    {getSeverityIcon(n.severity)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-foreground text-xs">{n.titleAr}</span>
                        {getSeverityBadge(n.severity)}
                        <Badge variant="outline" className="text-[10px] px-2 py-0 font-normal">
                          {conf.labelAr}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono mr-auto flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(n.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {n.messageAr || n.bodyAr}
                      </p>

                      {n.linkPath && (
                        <div className="mt-2">
                          <a
                            href={n.linkPath}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                          >
                            عرض التفاصيل والاتخاذ إجراء
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!n.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markAsRead(n.id)}
                          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                          title="تحديد كمقروء"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => archiveNotification(n.id)}
                        className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        title="أرشفة"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {activeTab === "preferences" && (
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-4">
          <div>
            <h4 className="text-sm font-black text-foreground">إعدادات قنوات الإشعار والتسليم</h4>
            <p className="text-xs text-muted-foreground">
              تحديد القنوات المفضلة لاستلام التنبيهات. تنبيهات الأمان الحرجة إلزامية ولا يمكن تعطيلها.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-4 text-start">فئة التنبيه</th>
                  <th className="py-2.5 px-4 text-center">داخل النظام (In-App)</th>
                  <th className="py-2.5 px-4 text-center">البريد الإلكتروني (Email)</th>
                  <th className="py-2.5 px-4 text-center">الرسائل النصية (SMS)</th>
                  <th className="py-2.5 px-4 text-center">الحالة الإلزامية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {(Object.keys(NOTIFICATION_CATEGORIES_CONFIG) as NotificationCategory[]).map((cat) => {
                  const conf = NOTIFICATION_CATEGORIES_CONFIG[cat];
                  const inAppPref = preferences.find((p) => p.category === cat && p.channel === "in_app");
                  const emailPref = preferences.find((p) => p.category === cat && p.channel === "email");
                  const smsPref = preferences.find((p) => p.category === cat && p.channel === "sms");
                  const isMandatory = cat === "security" || cat === "system";

                  return (
                    <tr key={cat} className="hover:bg-muted/20">
                      <td className="py-2.5 px-4 font-bold text-foreground">
                        {conf.labelAr}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <Check className="h-3.5 w-3.5" /> مفعل
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 font-bold ${
                          emailPref?.enabled || isMandatory ? "text-emerald-600" : "text-muted-foreground"
                        }`}>
                          {emailPref?.enabled || isMandatory ? "مفعل" : "معطل"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 font-bold ${
                          smsPref?.enabled ? "text-emerald-600" : "text-muted-foreground"
                        }`}>
                          {smsPref?.enabled ? "مفعل" : "معطل"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {isMandatory ? (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40">إلزامي أمنياً</Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">اختياري</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-4">
          <div>
            <h4 className="text-sm font-black text-foreground">دليل قوالب التنبيهات المعتمدة</h4>
            <p className="text-xs text-muted-foreground">
              القوالب المركزية المعتمدة لرسائل النظام والاعتمادات وسير العمل
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((tpl) => (
              <div key={tpl.id} className="rounded-xl border border-border/70 p-3 bg-muted/20 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-primary">{tpl.eventCode}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {tpl.channel}
                  </Badge>
                </div>
                <div>
                  <h5 className="font-bold text-foreground">{tpl.titleTemplateAr}</h5>
                  <p className="text-muted-foreground text-[11px] mt-1 font-mono bg-card p-2 rounded-lg border border-border/60">
                    {tpl.bodyTemplateAr}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
