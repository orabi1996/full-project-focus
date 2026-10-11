// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: APPLY FOR INTERNAL OPPORTUNITY MODAL
// src/components/talent/InternalApplicationModal.tsx
// ============================================================================

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";
import { applyForInternalOpportunity } from "../../lib/data/talent-repository";
import type { InternalOpportunity } from "../../lib/domains/talent";

interface InternalApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  opportunity: InternalOpportunity;
  employeeId: string;
}

export const InternalApplicationModal: React.FC<InternalApplicationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  opportunity,
  employeeId,
}) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await applyForInternalOpportunity({
        companyId,
        opportunityId: opportunity.id,
        employeeId,
        notes: notes || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "فشل تقديم طلب التنقل الداخلي");
        return;
      }

      setSubmittedScore(res.matchScore ?? 100);
      toast.success("تم إرسال طلب التقديم الداخلي بنجاح واحتساب نسبة المواءمة");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">التقديم على فرصة تنقل داخلي</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {opportunity.titleAr}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {submittedScore !== null ? (
          <div className="py-6 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="font-bold text-sm">تم استلام طلبك بنجاح!</h4>
            <p className="text-xs text-muted-foreground">
              نسبة المواءمة المحسوبة: <span className="font-bold text-foreground font-mono">{submittedScore}%</span>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="p-3 bg-muted/20 border rounded-lg space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الجهة / الإدارة:</span>
                <span className="font-bold">{opportunity.departmentNameAr || "عامة"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المرتبة المستهدفة:</span>
                <span className="font-bold font-mono">{opportunity.targetGrade || "حسب الخبرة"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الحد الأدنى للخدمة:</span>
                <span>{opportunity.minTenureMonthsRequired} شهر</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">خطاب الرغبة ومبررات التقديم</Label>
              <Textarea
                placeholder="وضح دوافعك للالتحاق بهذه الفرصة، الخبرات ذات الصلة..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 min-h-[80px]"
              />
            </div>

            <div className="p-2.5 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                يقوم النظام بالتحقق الآلي من مدة الخدمة ومواءمة المهارات والمرتبة واحتساب درجة التوافق.
              </span>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                إلغاء
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "جاري الإرسال..." : "تأكيد وإرسال الطلب"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
