import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import {
  useExpenseCategories,
  useExpensePolicies,
  useExpenseMutations,
} from "../../lib/data/expenses-repository";
import {
  Receipt,
  Settings,
  Plus,
  ExternalLink,
  ShieldCheck,
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

export const ExpensesPolicySetupPanel: React.FC = () => {
  const { company, currentRole } = useApp();
  const navigate = useNavigate();
  const canManage =
    canManageModule(currentRole, "setup") || canManageModule(currentRole, "expenses");

  const { data: categories = [], isLoading: isCategoriesLoading } = useExpenseCategories();
  const { data: policies = [] } = useExpensePolicies();
  const { addCategory, isAddingCategory } = useExpenseMutations();

  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatNameAr, setNewCatNameAr] = useState("");
  const [newCatNameEn, setNewCatNameEn] = useState("");
  const [newCatCode, setNewCatCode] = useState("");
  const [newCatWarning, setNewCatWarning] = useState(1500);
  const [newCatBlock, setNewCatBlock] = useState(6000);
  const [newCatRequiresReceipt, setNewCatRequiresReceipt] = useState(true);
  const [newCatAccountCode, setNewCatAccountCode] = useState("510100");

  const handleCreateCategory = async () => {
    if (!newCatNameAr.trim()) {
      toast.error("يرجى كتابة اسم فئة المصروف باللغة العربية");
      return;
    }
    try {
      await addCategory({
        nameAr: newCatNameAr,
        nameEn: newCatNameEn || newCatNameAr,
        code: newCatCode || undefined,
        warningLimit: newCatWarning,
        blockLimit: newCatBlock,
        requiresReceipt: newCatRequiresReceipt,
        accountingAccountCode: newCatAccountCode,
      });
      setIsAddCatModalOpen(false);
      setNewCatNameAr("");
      setNewCatNameEn("");
      setNewCatCode("");
    } catch {
      // error handled in hook
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              تهيئة فئات وسياسات النفقات والحدود الائتمانية لشركة «{company?.legalNameAr || "الأندلس"}»
            </h2>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">
              شاشة التهيئة والحوكمة
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ضبط فئات المصروفات، حدود التحذير والمنع، وأكواد دليل الحسابات (GL)، بينما يتم تقديم المطالبات اليومية وتجهيز دفعات الصرف في شاشة النفقات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/expenses" })}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-3.5 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            الانتقال لمطالبات المصروفات ودفعات الصرف
          </Button>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setIsAddCatModalOpen(true)}
              className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              إضافة فئة وسياسة مصروفات
            </Button>
          )}
        </div>
      </div>

      {/* Section 1: Corporate Policy Limits */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">
              السقوف والحدود الائتمانية العامة للنفقات المؤسسية
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full">
            حوكمة الصرف المالي
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
            <span className="text-muted-foreground font-semibold">سقف المعاملة الواحدة:</span>
            <p className="text-lg font-black text-foreground font-mono">
              {policies[0]?.singleTransactionLimit?.toLocaleString() || "5,000"} ر.س
            </p>
            <span className="text-[10px] text-muted-foreground">يتطلب تصعيداً إدارياً عند التجاوز</span>
          </div>
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
            <span className="text-muted-foreground font-semibold">السقف الشهري التراكمي للموظف:</span>
            <p className="text-lg font-black text-foreground font-mono">
              {policies[0]?.monthlyLimit?.toLocaleString() || "20,000"} ر.س
            </p>
            <span className="text-[10px] text-muted-foreground">إجمالي مطالبات الموظف خلال الشهر</span>
          </div>
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
            <span className="text-muted-foreground font-semibold">السقف السنوي للموظف:</span>
            <p className="text-lg font-black text-foreground font-mono">
              {policies[0]?.annualLimit?.toLocaleString() || "100,000"} ر.س
            </p>
            <span className="text-[10px] text-muted-foreground">الحد الائتماني الإجمالي للسنة المالية</span>
          </div>
        </div>
      </div>

      {/* Section 2: Expense Categories Grid */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-black text-foreground">
              فئات النفقات المعتمدة وأكواد دليل الحسابات ({categories.length})
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full border-emerald-500/30 text-emerald-600">
            مرتبطة بالأستاذ العام (GL)
          </Badge>
        </div>

        {isCategoriesLoading ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            جاري تحميل فئات النفقات...
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            لا توجد فئات نفقات مسجلة حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-xs text-foreground block">{cat.nameAr}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{cat.code}</span>
                  </div>
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Receipt className="h-4 w-4" />
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/60 font-medium">
                  <div className="flex justify-between items-center">
                    <span>حد التحذير:</span>
                    <span className="font-bold text-amber-600 font-mono">
                      {cat.maxLimitWarning.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>الحد المانع:</span>
                    <span className="font-bold text-destructive font-mono">
                      {cat.maxLimitBlock.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>حساب الأستاذ (GL):</span>
                    <span className="font-mono text-foreground font-bold">{cat.accountingAccountCode}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1">
                    {cat.requiresReceipt ? "• إرفاق الفاتورة إلزامي" : "• إرفاق الفاتورة اختياري"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      <Dialog open={isAddCatModalOpen} onOpenChange={setIsAddCatModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              إضافة فئة وسياسة مصروفات جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد سقف التحذير والحد المانع ورمز الحساب المحاسبي
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم الفئة باللغة العربية *</label>
              <input
                type="text"
                value={newCatNameAr}
                onChange={(e) => setNewCatNameAr(e.target.value)}
                placeholder="مثال: تدريب وتطوير مهني"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">اسم الفئة باللغة الإنجليزية</label>
              <input
                type="text"
                value={newCatNameEn}
                onChange={(e) => setNewCatNameEn(e.target.value)}
                placeholder="e.g. Training & Development"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">سقف التحذير (ر.س)</label>
                <input
                  type="number"
                  value={newCatWarning}
                  onChange={(e) => setNewCatWarning(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الحد المانع (ر.س)</label>
                <input
                  type="number"
                  value={newCatBlock}
                  onChange={(e) => setNewCatBlock(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">رمز الحساب المحاسبي (دليل الحسابات)</label>
              <input
                type="text"
                value={newCatAccountCode}
                onChange={(e) => setNewCatAccountCode(e.target.value)}
                placeholder="510100"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono font-bold focus:bg-card focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="setupReqReceipt"
                checked={newCatRequiresReceipt}
                onChange={(e) => setNewCatRequiresReceipt(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="setupReqReceipt" className="font-bold cursor-pointer text-xs">
                إرفاق الفاتورة أو الإيصال إلزامي لقبول المطالبة
              </label>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              disabled={isAddingCategory}
              onClick={handleCreateCategory}
              className="rounded-full text-xs classera-btn-primary font-bold px-5 h-9"
            >
              {isAddingCategory ? "جاري الحفظ..." : "حفظ وتفعيل الفئة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
