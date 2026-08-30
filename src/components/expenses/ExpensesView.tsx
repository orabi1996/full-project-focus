import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
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
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';

export const ExpensesView: React.FC = () => {
  const { expenseCategories, expenseClaims, addExpenseClaim, currentUser, language, t } = useApp();
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState(expenseCategories[0]?.id || '');
  const [amount, setAmount] = useState(500);
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');

  const selectedCat = expenseCategories.find(c => c.id === selectedCatId);
  const isOverWarning = selectedCat ? amount > selectedCat.maxLimitWarning : false;
  const isOverBlock = selectedCat ? amount > selectedCat.maxLimitBlock : false;

  const handleAddClaim = () => {
    if (isOverBlock) {
      alert(`عذراً، المبلغ يتجاوز الحد المانع لهذه الفئة (${selectedCat?.maxLimitBlock} ر.س)`);
      return;
    }
    if (!merchant || !description) {
      alert('يرجى استكمال بيانات المورد ووصف المصروف');
      return;
    }

    addExpenseClaim({
      employeeId: currentUser.id,
      categoryId: selectedCatId,
      categoryNameAr: selectedCat?.nameAr || 'نفقات عامة',
      categoryNameEn: selectedCat?.nameEn || 'General',
      amount,
      currency: 'SAR',
      spentAt: new Date().toISOString().split('T')[0],
      merchantName: merchant,
      description,
    });

    alert('تم تقديم مطالبة المصروفات بنجاح وإرسالها للمدير والمالية للاعتماد');
    setIsClaimModalOpen(false);
    setMerchant('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {t.expenses.claims} وتقارير النفقات
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            إدارة فواتير ومصروفات الأعمال، حدود السياسات والتحقق، والاعتماد والترحيل المالي
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setIsClaimModalOpen(true)}
            size="sm"
            className="font-bold text-xs gap-1.5 bg-primary"
          >
            <Plus className="h-4 w-4" />
            {t.expenses.newClaim}
          </Button>
        </div>
      </div>

      {/* Expense Policy Categories */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {expenseCategories.map(cat => (
          <div key={cat.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-foreground">{cat.nameAr}</span>
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t">
              <div className="flex justify-between">
                <span>حد التحذير:</span>
                <span className="font-bold text-amber-600">{cat.maxLimitWarning.toLocaleString()} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span>الحد المانع:</span>
                <span className="font-bold text-destructive">{cat.maxLimitBlock.toLocaleString()} ر.س</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                {cat.requiresReceipt ? '• الفاتورة إلزامية' : '• اختياري'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Claims List Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-sm font-bold text-foreground">سجل المطالبات المقدمة</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-4 text-start">التصنيف</th>
                <th className="py-3 px-4 text-start">المورد / الجهة</th>
                <th className="py-3 px-4 text-start">الوصف</th>
                <th className="py-3 px-4 text-start">التاريخ</th>
                <th className="py-3 px-4 text-start">المبلغ</th>
                <th className="py-3 px-4 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenseClaims.map(c => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="py-3 px-4 font-bold text-foreground">{c.categoryNameAr}</td>
                  <td className="py-3 px-4 font-medium">{c.merchantName}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.description}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.spentAt}</td>
                  <td className="py-3 px-4 font-bold text-primary">
                    {c.amount.toLocaleString()} {c.currency}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        c.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                          : 'bg-amber-500/10 text-amber-700 border-amber-200'
                      }`}
                    >
                      {c.status === 'approved' ? 'معتمد' : 'قيد المراجعة'}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              {t.expenses.newClaim}
            </DialogTitle>
            <DialogDescription className="text-xs">
              رفع الفواتير وإثباتات الصرف لمطابقتها مع سياسة الشركة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">تصنيف المصروف *</label>
              <select
                value={selectedCatId}
                onChange={e => setSelectedCatId(e.target.value)}
                className="w-full h-8 rounded border px-2.5"
              >
                {expenseCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nameAr}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold">المبلغ المدفوع (ر.س) *</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full h-8 rounded border px-2.5"
              />
              {isOverWarning && !isOverBlock && (
                <p className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  تنبيه: المبلغ يتجاوز حد التحذير ويتطلب تصعيداً إدارياً.
                </p>
              )}
              {isOverBlock && (
                <p className="text-[11px] text-destructive font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  تجاوز للحد المانع! لا يمكن تقديم هذا المبلغ.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="font-bold">اسم المورد / الجهة المستلمة *</label>
              <input
                type="text"
                value={merchant}
                onChange={e => setMerchant(e.target.value)}
                placeholder="مثال: فندق الفورسيزونز الرياض"
                className="w-full h-8 rounded border px-2.5"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold">وصف المصروف والغرض العملي *</label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="اكتب الغرض من المصروف..."
                className="w-full rounded border p-2 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold">إرفاق صورة الفاتورة / الإيصال</label>
              <div className="border border-dashed rounded-lg p-3 text-center text-muted-foreground hover:bg-muted/20 cursor-pointer">
                <Upload className="mx-auto h-5 w-5 mb-1 text-primary" />
                <span className="text-[11px]">اضغط هنا لرفع الإيصال (PNG, JPG, PDF)</span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              disabled={isOverBlock}
              onClick={handleAddClaim}
              className="text-xs bg-primary font-bold"
            >
              إرسال المطالبة للاعتماد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
