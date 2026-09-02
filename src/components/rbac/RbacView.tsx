import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import type { DataScope, RoleDefinition } from "../../types";
import { IconSymbol } from "../ui/IconSymbol";
import {
  ShieldCheck,
  Users,
  Lock,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  Shield,
  Key,
  Plus,
  Save,
  Sliders,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

export const RbacView: React.FC = () => {
  const { roles, addRole, currentRole, language, t } = useApp();
  const canManage = canManageModule(currentRole, "rbac");
  const [selectedRole, setSelectedRole] = useState<RoleDefinition>(roles[0]);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleScope, setNewRoleScope] = useState<DataScope>("team");

  // 20 Full Enterprise Modules
  const permissionModules = [
    {
      id: "m01",
      code: "M01",
      nameAr: "الصفحة الرئيسية والمؤشرات",
      actions: ["عرض المؤشرات", "تخصيص اللوحة", "تصدير"],
    },
    {
      id: "m02",
      code: "M02",
      nameAr: "الهيكل المؤسسي والسياج GPS",
      actions: ["عرض", "إضافة وتعديل", "حذف وحدات", "ضبط السياج"],
    },
    {
      id: "m03",
      code: "M03",
      nameAr: "سجل الموظفين والملفات 360°",
      actions: ["عرض الدليل", "إضافة موظف", "تعديل الراتب", "تعديل العقد", "تصدير"],
    },
    {
      id: "m04",
      code: "M04",
      nameAr: "مصفوفة الصلاحيات والأمان",
      actions: ["عرض الأدوار", "تعديل الصلاحيات", "تعيين المستخدمين"],
    },
    {
      id: "m05",
      code: "M05",
      nameAr: "محرك الاعتمادات ومسارات العمل",
      actions: ["عرض الطلبات", "اعتماد وقبول", "رفض", "إعادة للتصحيح"],
    },
    {
      id: "m06",
      code: "M06",
      nameAr: "الإجازات والعطلات والأرصدة",
      actions: ["تقديم طلب", "اعتماد الإجازة", "تعديل الأرصدة", "ترحيل سنوي"],
    },
    {
      id: "m07",
      code: "M07",
      nameAr: "الحضور والانصراف اللحظي",
      actions: ["تسجيل بصمة", "عرض السجلات", "اعتماد التصحيح", "قفل الشهر"],
    },
    {
      id: "m08",
      code: "M08",
      nameAr: "الورديات وجدولة الدوامات",
      actions: ["عرض الورديات", "إنشاء وردية", "جدولة الموظفين"],
    },
    {
      id: "m09",
      code: "M09",
      nameAr: "أجهزة البصمة واستيراد السجلات",
      actions: ["ربط الأجهزة", "استيراد خام", "مزامنة السجلات"],
    },
    {
      id: "m10",
      code: "M10",
      nameAr: "مسيرات الرواتب الشهرية",
      actions: ["عرض الكشف", "احتساب المسير", "اعتماد وقفل", "تصدير WPS SIF", "تأكيد الصرف"],
    },
    {
      id: "m11",
      code: "M11",
      nameAr: "السلف ومكافأة نهاية الخدمة EOSB",
      actions: ["طلب سلفة", "اعتماد السلفة", "احتساب EOSB", "تصفية المخالصة"],
    },
    {
      id: "m12",
      code: "M12",
      nameAr: "إدارة النفقات والمصروفات",
      actions: ["رفع مطالبة", "فحص السياسات", "اعتماد الصرف", "ترحيل محاسبي"],
    },
    {
      id: "m13",
      code: "M13",
      nameAr: "تقييم الأداء 360°",
      actions: ["بدء دورة التقييم", "التقييم الذاتي", "تقييم المدير", "معايرة النتائج"],
    },
    {
      id: "m14",
      code: "M14",
      nameAr: "تخطيط القوى العاملة",
      actions: ["عرض الخطة", "نمذجة الميزانية", "اعتماد الشواغر"],
    },
    {
      id: "m15",
      code: "M15",
      nameAr: "التوظيف وتتبع المرشحين ATS",
      actions: ["نشر وظيفة", "ترقية المراحل Kanban", "تقييم المرشح", "إصدار عرض عمل"],
    },
    {
      id: "m16",
      code: "M16",
      nameAr: "مستودع الوثائق والعهد والأصول",
      actions: ["تسليم عهدة", "استرجاع وإخلاء", "نشر لوائح", "متابعة الإقرارات"],
    },
    {
      id: "m17",
      code: "M17",
      nameAr: "التقارير ومولد الاستعلامات",
      actions: ["عرض الكتالوج", "توليد تقرير مخصص", "تصدير Excel/PDF"],
    },
    {
      id: "m18",
      code: "M18",
      nameAr: "القيود المحاسبية وتكاملات ERP",
      actions: ["عرض القيود", "ترحيل لـ Odoo/SAP", "إدارة Webhooks وAPI"],
    },
    {
      id: "m19",
      code: "M19",
      nameAr: "الإشعارات وسجل التدقيق Audit Log",
      actions: ["عرض سجل التدقيق", "تصدير السجل", "إدارة التنبيهات"],
    },
    {
      id: "m20",
      code: "M20",
      nameAr: "بوابة الخدمة الذاتية وتطبيق الجوال",
      actions: ["تبصيم GPS", "عرض قسيمة الراتب", "تقديم الطلبات", "اعتماد الجوال"],
    },
  ];

  const handleCreateCustomRole = () => {
    if (!newRoleName) {
      toast.error("يرجى كتابة مسمى الدور");
      return;
    }
    const createdRole: Omit<RoleDefinition, "id" | "userCount" | "permissions"> & {
      dataScope: DataScope;
    } = {
      code: `custom_${newRoleName.toLowerCase().replace(/\s+/g, "_")}`,
      nameAr: newRoleName,
      nameEn: newRoleName,
      descriptionAr: newRoleDesc || "دور مخصص بصلاحيات محددة",
      descriptionEn: "Custom Role",
      isSystem: false,
      dataScope: newRoleScope,
    };
    setSelectedRole(addRole(createdRole));
    setIsAddRoleOpen(false);
    toast.success(`تم إنشاء الدور المخصص (${newRoleName}) بنجاح!`);
    setNewRoleName("");
    setNewRoleDesc("");
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="admin_panel_settings" source="material" filled size={24} className="text-primary" />
            {t.nav.rbac} ومصفوفة الصلاحيات (RBAC - M15)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            إدارة الأدوار، مصفوفة الصلاحيات الدقيقة للـ 20 وحدة، نطاقات البيانات (Data Scopes)، والاستثناءات
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2.5">
            <Button
              onClick={() => setIsAddRoleOpen(true)}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              إنشاء دور مخصص جديد
            </Button>
          </div>
        )}
      </div>

      {/* Grid: Roles Selection & Permission Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase">
            الأدوار المعرفة في المنظومة ({roles.length})
          </h2>
          <div className="space-y-2.5">
            {roles.map((role) => (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`rounded-3xl border p-4 text-xs transition-all cursor-pointer space-y-2 ${
                  selectedRole.id === role.id
                    ? "border-primary bg-primary/5 shadow-xs ring-2 ring-primary/30"
                    : "bg-card hover:border-primary/40 border-border/80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-foreground">{role.nameAr}</span>
                  <Badge variant="outline" className="text-[10px] font-mono rounded-full px-2">
                    {role.userCount} مستخدم
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 font-medium">
                  {role.descriptionAr}
                </p>
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px]">
                  <span className="font-mono text-primary font-bold uppercase">{role.code}</span>
                  <Badge variant="secondary" className="text-[9px] rounded-full px-2 font-bold">
                    نطاق:{" "}
                    {role.dataScope === "all"
                      ? "كامل المنشأة"
                      : role.dataScope === "department"
                        ? "القسم"
                        : "الفريق المباشر"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permission Matrix for Selected Role */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs lg:col-span-2 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-black text-sm text-foreground">
                  مصفوفة صلاحيات: {selectedRole.nameAr}
                </h3>
                {selectedRole.isSystem && (
                  <Badge variant="secondary" className="text-[10px] rounded-full px-2.5 font-bold">
                    دور نظام أساسي (System Role)
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                تخصيص الإجراءات المسموحة ونطاق البيانات لكل وحدة وظيفية
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-bold">نطاق البيانات:</span>
              <select
                value={selectedRole.dataScope ?? "self"}
                disabled={!canManage}
                onChange={(e) => {
                  setSelectedRole({ ...selectedRole, dataScope: e.target.value as DataScope });
                }}
                className="h-9 rounded-full border border-border/80 bg-background px-3 text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">كامل المنشأة (All Company)</option>
                <option value="subsidiary">الشركة التابعة فقط</option>
                <option value="department">القسم / الإدارة فقط</option>
                <option value="team">أعضاء الفريق المباشر فقط</option>
                <option value="self">البيانات الشخصية فقط (Self)</option>
              </select>
            </div>
          </div>

          {/* Module Matrix List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
            {permissionModules.map((mod) => (
              <div key={mod.id} className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-2.5 text-xs hover:bg-card transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Badge variant="outline" className="text-[10px] font-mono rounded-full px-2 font-black">
                      {mod.code}
                    </Badge>
                    <span className="font-black text-foreground">{mod.nameAr}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    {selectedRole.code === "super_admin"
                      ? "صلاحية كاملة (Full Access)"
                      : "صلاحيات محددة"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3.5 pt-2 border-t border-border/60">
                  {mod.actions.map((act, actIdx) => (
                    <label
                      key={actIdx}
                      className="flex items-center gap-1.5 cursor-pointer text-xs font-medium"
                    >
                      <input
                        type="checkbox"
                        disabled={!canManage}
                        defaultChecked={selectedRole.code === "super_admin" || actIdx === 0}
                        className="rounded text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="text-foreground">{act}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border/60 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium">
              يتم تطبيق الصلاحيات بشكل فوري ولحظي على جميع حسابات المستخدمين.
            </span>
            {canManage && (
              <Button
                onClick={() => toast.success("تم حفظ وتطبيق مصفوفة الصلاحيات بنجاح!")}
                size="sm"
                className="rounded-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-9 shadow-xs"
              >
                <Save className="h-4 w-4" />
                حفظ مصفوفة الصلاحيات
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Add Custom Role Modal */}
      <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              إنشاء دور مخصص جديد (Custom Role)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد المسمى ونطاق البيانات لبدء تخصيص مصفوفة الصلاحيات
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">مسمى الدور الجديد *</label>
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="مثال: مسؤول علاقات الموظفين والتدريب"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">وصف ومسؤوليات الدور</label>
              <textarea
                rows={2}
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="اكتب وصفاً مختصراً للمهام..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">نطاق البيانات الافتراضي</label>
              <select
                value={newRoleScope}
                onChange={(e) => setNewRoleScope(e.target.value as DataScope)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="team">أعضاء الفريق المباشر (Team)</option>
                <option value="department">القسم / الإدارة (Department)</option>
                <option value="subsidiary">الشركة التابعة (Subsidiary)</option>
                <option value="all">كامل المنشأة (All)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateCustomRole}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              إنشاء الدور وتعيين الصلاحيات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
