import React, { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  listPayrollNotificationsServer,
  markNotificationReadServer,
} from "../../lib/business/payments.functions";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export const SettlementNotificationsPanel: React.FC = () => {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await listPayrollNotificationsServer()) as NotificationRow[]);
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر قراءة الإشعارات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id?: string) => {
    try {
      await markNotificationReadServer({ data: id ? { id } : { all: true } });
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر تحديث الإشعار");
    }
  };

  const unread = items.filter((i) => !i.isRead).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <BellRing className="size-5 text-primary" />
          <div>
            <h3 className="text-sm font-black text-foreground">إشعارات تسوية الرواتب</h3>
            <p className="text-xs text-muted-foreground">
              يصلك عند كل تسوية: صافي المسيّر، السلف المستردة، ومرجع الدفع البنكي للفاتورة.
            </p>
          </div>
          {unread > 0 && <Badge>{unread} جديد</Badge>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void markRead()} disabled={!unread}>
            <CheckCheck className="size-4" /> تعليم الكل كمقروء
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => void markRead(item.id)}
            className={`flex w-full gap-3 rounded-2xl border p-4 text-right transition ${
              item.isRead ? "border-border/50 bg-card" : "border-primary/40 bg-primary/5"
            }`}
          >
            <Bell className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-foreground">{item.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {item.type === "payroll_settlement" ? "تسوية رواتب" : item.type}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("ar-EG")}
                </span>
              </div>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{item.message}</p>
            </div>
          </button>
        ))}
        {!items.length && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
            لا توجد إشعارات بعد — ستظهر تلقائيًا بعد أول تسوية رواتب.
          </div>
        )}
      </div>
    </div>
  );
};
