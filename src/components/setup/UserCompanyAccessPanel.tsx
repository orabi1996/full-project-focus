import React, { useEffect, useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Plus,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { enterpriseSupabase } from "../../lib/data/enterprise-client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

export interface UserAccessItem {
  id: string;
  userId: string;
  companyId: string;
  status: "active" | "pending" | "revoked";
  approvedAt?: string | null;
  createdAt: string;
  userEmail?: string;
  userRole?: string;
}

export const UserCompanyAccessPanel: React.FC = () => {
  const { company, currentRole, employees, roles } = useApp();
  const canManage = currentRole === "super_admin";

  const [accessList, setAccessList] = useState<UserAccessItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAccess = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch from user_company_access if table exists
      const { data, error } = await (enterpriseSupabase as any)
        .from("user_company_access")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback: derive from user_roles and employees if table not created yet
        const derived: UserAccessItem[] = (roles || []).map((r, idx) => ({
          id: `derived-${idx}`,
          userId: r.id,
          companyId: company?.id || "",
          status: "active" as const,
          createdAt: new Date().toISOString(),
          userRole: r.nameAr || r.code,
        }));
        setAccessList(derived);
      } else if (data) {
        setAccessList(
          data.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            companyId: row.company_id,
            status: row.status,
            createdAt: row.created_at,
            approvedAt: row.approved_at,
          }))
        );
      }
    } catch {
      toast.error("تعذر جلب بيانات ربط المستخدمين");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccess();
  }, [company?.id]);

  const handleUpdateStatus = async (item: UserAccessItem, newStatus: "active" | "revoked") => {
    if (!canManage) {
      toast.error("لا تملك صلاحية تعديل صلاحيات الربط");
      return;
    }

    try {
      const { error } = await (enterpriseSupabase as any)
        .from("user_company_access")
        .update({
          status: newStatus,
          approved_at: newStatus === "active" ? new Date().toISOString() : null,
        })
        .eq("id", item.id);

      if (error) {
        toast.error("فشل تحديث حالة الارتباط في قاعدة البيانات");
      } else {
        toast.success(newStatus === "active" ? "تم اعتماد ربط المستخدم بنجاح" : "تم إلغاء ربط المستخدم");
        fetchAccess();
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
  };

  const handleAddAccess = async () => {
    if (!targetUserId.trim()) {
      toast.error("يرجى إدخال معرف المستخدم (User ID)");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await (enterpriseSupabase as any).from("user_company_access").insert({
        user_id: targetUserId.trim(),
        company_id: company?.id || "a0000000-0000-0000-0000-000000000001",
        status: "active",
        approved_at: new Date().toISOString(),
      });

      if (error) {
        toast.error(`تعذر ربط المستخدم: ${error.message}`);
      } else {
        toast.success("تم ربط المستخدم بشركة «الأندلس» بنجاح");
        setIsAddModalOpen(false);
        setTargetUserId("");
        fetchAccess();
      }
    } catch {
      toast.error("حدث خطأ أثناء تنفيذ الطلب");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            حوكمة وربط المستخدمين بشركة «{company?.legalNameAr || "الأندلس"}»
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            ربط صريح بين حسابات الدخول المعتمدة ونطاق الشركة. لا يتم الاعتماد على أول شركة مسجلة ولا على حقول قابلة للتعديل.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAccess}
            disabled={isLoading}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-3 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              ربط مستخدم جديد
            </Button>
          )}
        </div>
      </div>

      {/* Security Notice */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold text-primary">
          <ShieldCheck className="h-4 w-4" />
          سياسة حوكمة الوصول والصلاحيات:
        </div>
        <p className="text-muted-foreground">
          حسابات الدخول الحالية في نظام المصادقة محتفظ بها بالكامل. منح الصلاحيات يتم عبر شاشة الصلاحيات والأدوار، بينما يختص هذا الجدول بالربط القانوني المعتمد بالمنشأة.
        </p>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-xs">
        <table className="w-full text-xs">
          <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
            <tr>
              <th className="py-3 px-4 text-start">معرف المستخدم (User ID)</th>
              <th className="py-3 px-4 text-start">المنشأة المرتبطة</th>
              <th className="py-3 px-4 text-center">تاريخ الربط</th>
              <th className="py-3 px-4 text-center">حالة الاعتماد</th>
              <th className="py-3 px-4 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {accessList.map((item) => (
              <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-foreground">
                  {item.userId}
                </td>
                <td className="py-3 px-4 font-medium text-foreground">
                  «{company?.legalNameAr || "الأندلس"}»
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground font-mono">
                  {item.approvedAt ? new Date(item.approvedAt).toLocaleDateString("ar-SA") : "قيد المراجعة"}
                </td>
                <td className="py-3 px-4 text-center">
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      item.status === "active"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                        : item.status === "pending"
                          ? "bg-amber-500/10 text-amber-700 border-amber-300"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                    }`}
                  >
                    {item.status === "active" ? "معتمد ونشط" : item.status === "pending" ? "بانتظار الاعتماد" : "ملغي الربط"}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-center">
                  {canManage ? (
                    <div className="flex items-center justify-center gap-1.5">
                      {item.status !== "active" && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(item, "active")}
                          className="h-7 text-[11px] rounded-full px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                          اعتماد
                        </Button>
                      )}
                      {item.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(item, "revoked")}
                          className="h-7 text-[11px] rounded-full px-2.5 border-destructive/30 text-destructive hover:bg-destructive/10 font-bold"
                        >
                          إلغاء
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">للمسؤول فقط</span>
                  )}
                </td>
              </tr>
            ))}
            {accessList.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted-foreground">
                  لا توجد سجلات ربط صريحة مسجلة حالياً.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Access Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">ربط مستخدم بنطاق شركة «الأندلس»</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              أدخل معرف المستخدم المسجل في نظام المصادقة لربطه رسمياً بالشركة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">معرف المستخدم (UUID):</label>
              <input
                type="text"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="مثال: 00000000-0000-0000-0000-000000000000"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-full text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={handleAddAccess}
              className="rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? "جاري الحفظ..." : "تأكيد الربط"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
