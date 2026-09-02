import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { exportToCSV } from "../../lib/utils/export-helpers";
import { canManageModule } from "../../lib/auth/permissions";
import { IconSymbol } from "../ui/IconSymbol";
import {
  Receipt,
  Plus,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Upload,
  CreditCard,
  Building,
  DollarSign,
  Download,
  Settings,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";

export const ExpensesView: React.FC = () => {
  const {
    expenseCategories,
    expenseClaims,
    addExpenseClaim,
    addExpenseCategory,
    currentUser,
    currentRole,
    language,
    t,
  } = useApp();
  const canManage = canManageModule(currentRole, "expenses");
  const canSubmitClaim = currentRole !== "auditor";
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);

  // Claim Form State
  const [selectedCatId, setSelectedCatId] = useState(expenseCategories[0]?.id || "");
  const [amount, setAmount] = useState(500);
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");

  // Category Form State
  const [newCatName, setNewCatName] = useState("");
  const [newCatWarning, setNewCatWarning] = useState(1500);
  const [newCatBlock, setNewCatBlock] = useState(6000);

  const selectedCat = expenseCategories.find((c) => c.id === selectedCatId);
  const isOverWarning = selectedCat ? amount > selectedCat.maxLimitWarning : false;
  const isOverBlock = selectedCat ? amount > selectedCat.maxLimitBlock : false;

  const handleAddClaim = () => {
    if (isOverBlock) {
      toast.error(`عذراً، المبلغ يتجاوز الحد المانع لهذه الفئة (${selectedCat?.maxLimitBlock} ر.س)`);
      return;
    }
    if (!merchant || !description) {
      toast.error("يرجى استكمال بيانات المورد ووصف المصروف");
      return;
    }

    addExpenseClaim({
      employeeId: currentUser.id,
      categoryId: selectedCatId,
      categoryNameAr: selectedCat?.nameAr || "نفقات عامة",
      categoryNameEn: selectedCat?.nameEn || "General",
      amount,
      currency: "SAR",
      spentAt: new Date().toISOString().split("T")[0],
      merchantName: merchant,
      description,
    });

    toast.success("تم تقديم مطالبة المصروفات بنجاح وإرسالها للمدير والمالية للاعتماد");
    setIsClaimModalOpen(false);
    setMerchant("");
    setDescription("");
  };

  const handleCreateCategory = () => {
    if (!newCatName) {
      toast.error("يرجى كتابة اسم فئة المصروف");
      return;
    }
    addExpenseCategory({
      nameAr: newCatName,
      warningLimit: newCatWarning,
      blockLimit: newCatBlock,
    });
    toast.success(`تمت إضافة سياسة وفئة المصروفات (${newCatName}) بنجاح!`);
    setIsAddCatModalOpen(false);
    setNewCatName("");
  };

  const handleExportExpenses = () => {
    const data = expenseClaims.map((c) => ({
      التصنيف: c.categoryNameAr,
      "المورد / الجهة": c.merchantName,
      الوصف: c.description,
      التاريخ: c.spentAt,
      المبلغ: c.amount,
      العملة: c.currency,
      الحالة: c.status === "approved" ? "معتمد" : "قيد المراجعة",
    }));
    exportToCSV(`Expenses_Claims_${new Date().toISOString().split("T")[0]}`, data);
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="receipt_long" source="material" filled size={24} className="text-primary" />
            {t.expenses.claims} وإدارة النفقات والمصروفات (M12)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            إدارة فواتير ومصروفات الأعمال، حدود السياسات والتحقق، والاعتماد والترحيل المالي
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {canSubmitClaim && (
            <Button
              onClick={() => setIsClaimModalOpen(true)}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              {t.expenses.newClaim}
            </Button>
          )}
          {canManage && (
            <Button
              onClick={() => setIsAddCatModalOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
            >
              <Settings className="h-4 w-4 text-primary" />
              إضافة فئة وسياسة
            </Button>
          )}
          <Button
            onClick={handleExportExpenses}
            variant="secondary"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs"
          >
            <Download className="h-4 w-4 text-primary" />
            {t.export} (Excel/CSV)
          </Button>
        </div>
      </div>

      {/* Expense Policy Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {expenseCategories.map((cat) => (
          <div key={cat.id} className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3 hover:border-primary/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-foreground">{cat.nameAr}</span>
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/60 font-medium">
              <div className="flex justify-between">
                <span>حد التحذير:</span>
                <span className="font-bold text-amber-600 font-mono">
                  {cat.maxLimitWarning.toLocaleString()} ر.س
                </span>
              </div>
              <div className="flex justify-between">
                <span>الحد المانع:</span>
                <span className="font-bold text-destructive font-mono">
                  {cat.maxLimitBlock.toLocaleString()} ر.س
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                {cat.requiresReceipt ? "• الفاتورة إلزامية" : "• اختياري"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Claims List Table */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs space-y-3 p-5">
        <div className="flex justify-between items-center border-b border-border/60 pb-3">
          <h2 className="text-sm font-black text-foreground">سجل المطالبات المقدمة</h2>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-4 text-start">التصنيف</th>
                <th className="py-3 px-4 text-start">المورد / الجهة</th>
                <th className="py-3 px-4 text-start">الوصف</th>
                <th className="py-3 px-4 text-start">التاريخ</th>
                <th className="py-3 px-4 text-start">المبلغ</th>
                <th className="py-3 px-4 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {expenseClaims.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-bold text-foreground">{c.categoryNameAr}</td>
                  <td className="py-3 px-4 font-semibold">{c.merchantName}</td>
                  <td className="py-3 px-4 text-muted-foreground font-medium">{c.description}</td>
                  <td className="py-3 px-4 text-muted-foreground font-mono">{c.spentAt}</td>
                  <td className="py-3 px-4 font-black text-primary font-mono">
                    {c.amount.toLocaleString()} {c.currency}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-full px-2.5 font-bold ${
                        c.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                          : "bg-amber-500/10 text-amber-700 border-amber-200"
                      }`}
                    >
                      {c.status === "approved" ? "معتمد" : "قيد المراجعة"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Expense Claim Modal */}
      <Dialog open={isClaimModalOpen} onOpenChange={setIsClaimModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              {t.expenses.newClaim}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              رفع الفواتير وإثباتات الصرف لمطابقتها مع سياسة الشركة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">تصنيف المصروف *</label>
              <select
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                {expenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">المبلغ المدفوع (ر.س) *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {isOverWarning && !isOverBlock && (
                <p className="text-[11px] text-amber-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  تنبيه: المبلغ يتجاوز حد التحذير ويتطلب تصعيداً إدارياً.
                </p>
              )}
              {isOverBlock && (
                <p className="text-[11px] text-destructive font-bold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  تجاوز للحد المانع! لا يمكن تقديم هذا المبلغ.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">اسم المورد / الجهة المستلمة *</label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="مثال: فندق الفورسيزونز الرياض"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">وصف المصروف والغرض العملي *</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب الغرض من المصروف..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">إرفاق صورة الفاتورة / الإيصال</label>
              <div className="border-2 border-dashed border-primary/30 rounded-2xl p-4 text-center text-muted-foreground hover:bg-secondary/30 cursor-pointer transition-colors">
                <Upload className="mx-auto h-6 w-6 mb-1 text-primary" />
                <span className="text-[11px] font-bold text-foreground block">اضغط هنا لرفع الإيصال</span>
                <span className="text-[10px] text-muted-foreground font-mono">يدعم PNG, JPG, PDF بحد أقصى 10MB</span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              disabled={isOverBlock}
              onClick={handleAddClaim}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              إرسال المطالبة للاعتماد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Modal */}
      <Dialog open={isAddCatModalOpen} onOpenChange={setIsAddCatModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              إضافة فئة وسياسة مصروفات جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد سقف التحذير والحد المانع للصرف
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم فئة المصروف *</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="مثال: رسوم تجديد التراخيص الحكومية"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">سقف التحذير (ر.س)</label>
                <input
                  type="number"
                  value={newCatWarning}
                  onChange={(e) => setNewCatWarning(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الحد المانع (ر.س)</label>
                <input
                  type="number"
                  value={newCatBlock}
                  onChange={(e) => setNewCatBlock(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateCategory}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              حفظ وتطبيق السياسة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
