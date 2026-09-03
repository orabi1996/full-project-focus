import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Shield, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import type { DataScope } from "../../types";
import {
  createFullAccessScreenMap,
  createReadOnlyScreenMap,
  type PermissionGroup,
} from "../../lib/auth/rbac-definitions";

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (group: PermissionGroup) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const { permissionGroups, createPermissionGroup } = useApp();

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [code, setCode] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [dataScope, setDataScope] = useState<DataScope>("department");
  const [templateGroupId, setTemplateGroupId] = useState<string>("copy_super");
  const [color, setColor] = useState("#2563eb");

  const colors = [
    { label: "أزرق نيلي", value: "#4f46e5" },
    { label: "أزرق سماوي", value: "#0284c7" },
    { label: "زمردي أخضر", value: "#059669" },
    { label: "كهرماني", value: "#d97706" },
    { label: "بنفسجي", value: "#7c3aed" },
    { label: "وردي داكن", value: "#db2777" },
    { label: "رمادي معدني", value: "#475569" },
  ];

  const handleCreate = () => {
    if (!nameAr.trim()) {
      toast.error("يرجى إدخال اسم المجموعة بالعربية.");
      return;
    }

    const generatedCode =
      code.trim() ||
      `grp_${nameAr
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 15)}_${Date.now().toString().slice(-4)}`;

    // Build initial screen permissions based on selected template
    let screens = createReadOnlyScreenMap();
    if (templateGroupId === "full") {
      screens = createFullAccessScreenMap();
    } else if (templateGroupId === "empty") {
      screens = Object.fromEntries(
        Object.keys(createReadOnlyScreenMap()).map((k) => [
          k,
          { view: false, create: false, edit: false, delete: false, approveExport: false },
        ]),
      );
    } else {
      const templateGroup = permissionGroups.find((g) => g.id === templateGroupId);
      if (templateGroup?.screens) {
        screens = JSON.parse(JSON.stringify(templateGroup.screens));
      }
    }

    const newGroup = createPermissionGroup({
      code: generatedCode,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      descriptionAr: descriptionAr.trim() || `مجموعة صلاحيات مخصصة: ${nameAr}`,
      descriptionEn: nameEn.trim() || "Custom Permission Group",
      isSystem: false,
      color,
      iconName: "admin_panel_settings",
      dataScope,
      memberUserIds: [],
      screens,
    });

    onCreated(newGroup);
    onOpenChange(false);
    setNameAr("");
    setNameEn("");
    setCode("");
    setDescriptionAr("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6 shadow-2xl border-border/80">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: color }}
            >
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-foreground">
                إنشاء مجموعة صلاحيات وأدوار جديدة
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                تحديد اسم المجموعة، نطاق البيانات، وقالب الصلاحيات لتعيين المستخدمين لاحقاً
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          {/* Group Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">اسم المجموعة (بالعربي) *</label>
              <input
                type="text"
                value={nameAr}
                onChange={(e) => {
                  setNameAr(e.target.value);
                  if (!code) {
                    setCode(
                      `grp_${e.target.value
                        .trim()
                        .toLowerCase()
                        .replace(/\s+/g, "_")
                        .slice(0, 16)}`,
                    );
                  }
                }}
                placeholder="مثال: مدراء الفروع الإقليمية"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/30 px-3 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-foreground">اسم المجموعة (بالإنجليزية)</label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Branch Regional Managers"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/30 px-3 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-left"
                dir="ltr"
              />
            </div>
          </div>

          {/* Code Identifier & Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">الكود التعريفي (Identifier Code)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. branch_managers"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/30 px-3 text-xs font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-left"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-foreground">نطاق أمان البيانات (Data Scope) *</label>
              <select
                value={dataScope}
                onChange={(e) => setDataScope(e.target.value as DataScope)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/30 px-3 text-xs font-bold text-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">كامل المنشأة (All Company Records)</option>
                <option value="subsidiary">الشركة التابعة الحالية فقط</option>
                <option value="department">القسم / الإدارة الحالية فقط</option>
                <option value="team">أعضاء الفريق المباشر فقط</option>
                <option value="self">البيانات الشخصية فقط (Self Only)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground">وصف ومسؤوليات المجموعة</label>
            <textarea
              rows={2}
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              placeholder="اكتب وصفاً لطبيعة صلاحيات ومهام الأعضاء المنتمين لهذه المجموعة..."
              className="w-full rounded-2xl border border-border/80 bg-muted/30 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          {/* Permissions Template Selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex items-center gap-1.5">
              <Copy className="h-3.5 w-3.5 text-primary" />
              قالب استنساخ مصفوفة الصلاحيات الأولية
            </label>
            <select
              value={templateGroupId}
              onChange={(e) => setTemplateGroupId(e.target.value)}
              className="w-full h-10 rounded-2xl border border-border/80 bg-muted/30 px-3 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="full">🚀 صلاحيات كاملة على كل الشاشات (Full Admin Access)</option>
              <option value="readonly">👁️ قراءة واستعراض فقط لكافة الشاشات (Read Only)</option>
              <option value="empty">🔒 فارغ (حظر الوصول لجميع الشاشات وتعيين يدوي)</option>
              {permissionGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  استنساخ من: {g.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* Color Tag */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground">لون تمييز شارة المجموعة</label>
            <div className="flex items-center gap-2">
              {colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    color === c.value
                      ? "scale-110 border-foreground shadow-xs ring-2 ring-primary/40"
                      : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 pt-4 flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-full text-xs font-bold h-9 px-4"
          >
            إلغاء
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            className="rounded-full text-xs font-bold h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5"
          >
            <Sparkles className="h-4 w-4" />
            إنشاء المجموعة وضبط الصلاحيات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
