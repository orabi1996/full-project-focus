import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import { useCreateCompensationReviewCycle, useLaunchCompensationReviewCycle } from "../../lib/data/compensation-repository";

interface ReviewCycleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onSuccess: () => void;
}

export function ReviewCycleModal({
  open,
  onOpenChange,
  companyId,
  onSuccess,
}: ReviewCycleModalProps) {
  const currentYear = new Date().getFullYear();
  const [nameAr, setNameAr] = useState(`دورة مراجعة الرواتب السنوية لعام ${currentYear}`);
  const [yearVal, setYearVal] = useState<number>(currentYear);
  const [allocatedBudget, setAllocatedBudget] = useState<number>(150000);
  const [currency, setCurrency] = useState("SAR");
  const [budgetEnforcement, setBudgetEnforcement] = useState<"warn" | "hard_block" | "none">("warn");
  const [effectiveDate, setEffectiveDate] = useState(`${currentYear}-04-01`);
  const [reviewStartDate, setReviewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [reviewEndDate, setReviewEndDate] = useState(`${currentYear}-03-31`);
  const [autoLaunch, setAutoLaunch] = useState(true);

  const createMutation = useCreateCompensationReviewCycle();
  const launchMutation = useLaunchCompensationReviewCycle();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      toast.error("يرجى إدخال اسم دورة المراجعة");
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        company_id: companyId,
        name_ar: nameAr,
        name_en: `Annual Compensation Review ${yearVal}`,
        year_val: yearVal,
        allocated_budget: allocatedBudget,
        currency,
        budget_enforcement: budgetEnforcement,
        effective_date: effectiveDate,
        review_start_date: reviewStartDate,
        review_end_date: reviewEndDate,
        status: "draft",
      });

      if (autoLaunch && created.id) {
        await launchMutation.mutateAsync({
          companyId,
          cycleId: created.id,
        });
        toast.success("تم إنشاء دورة المراجعة وتجميد المجتمع المستحق وفتحها للمدراء بنجاح!");
      } else {
        toast.success("تم إنشاء دورة المراجعة كمسودة تخطيط بنجاح");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "فشل إطلاق دورة المراجعة");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary" />
            إطلاق دورة مراجعة الرواتب والاستحقاق (Compensation Review Cycle)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>مسمى الدورة (باللغة العربية) *</Label>
            <Input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>السنة المالية *</Label>
              <Input
                type="number"
                value={yearVal}
                onChange={(e) => setYearVal(parseInt(e.target.value) || currentYear)}
                required
                className="font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ سريان الزيادات *</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الميزانية المرصودة للزيادة (ر.س) *</Label>
              <Input
                type="number"
                step="1000"
                value={allocatedBudget}
                onChange={(e) => setAllocatedBudget(parseFloat(e.target.value) || 0)}
                required
                className="font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label>سياسة التحكم بالميزانية</Label>
              <Select value={budgetEnforcement} onValueChange={(val: any) => setBudgetEnforcement(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warn">تحذير عند التجاوز (مرن)</SelectItem>
                  <SelectItem value="hard_block">منع تجاوز الميزانية (صارم)</SelectItem>
                  <SelectItem value="none">بدون قيود إرشادية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>بداية فترة المراجعة *</Label>
              <Input
                type="date"
                value={reviewStartDate}
                onChange={(e) => setReviewStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>نهاية فترة المراجعة *</Label>
              <Input
                type="date"
                value={reviewEndDate}
                onChange={(e) => setReviewEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="p-3 bg-secondary/40 rounded-lg flex items-center justify-between text-sm">
            <div>
              <p className="font-semibold text-foreground">تجميد الموظفين وفتح الدورة فوراً</p>
              <p className="text-xs text-muted-foreground">تجميد رواتب الموظفين الحالية وفتح منصة التوصيات للمدراء</p>
            </div>
            <input
              type="checkbox"
              checked={autoLaunch}
              onChange={(e) => setAutoLaunch(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={createMutation.isPending || launchMutation.isPending}>
              {createMutation.isPending || launchMutation.isPending ? "جاري الإطلاق..." : "اعتماد وإطلاق الدورة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
