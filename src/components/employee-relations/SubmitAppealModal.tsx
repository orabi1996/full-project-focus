// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: SUBMIT ER APPEAL MODAL
// src/components/employee-relations/SubmitAppealModal.tsx
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
import { toast } from "sonner";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { submitErAppealRecord } from "../../lib/data/employee-relations-repository";
import type { ErCase, ErAppealGrounds } from "../../lib/domains/employee-relations";

interface SubmitAppealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  erCase: ErCase | null;
  decisionId?: string;
  appellantEmployeeId?: string;
}

export const SubmitAppealModal: React.FC<SubmitAppealModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  erCase,
  decisionId,
  appellantEmployeeId,
}) => {
  const [loading, setLoading] = useState(false);
  const [grounds, setGrounds] = useState<ErAppealGrounds>("procedural_defect");
  const [statement, setStatement] = useState("");

  if (!erCase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statement.trim()) {
      toast.error("يرجى كتابة أسباب ودفوع الاستئناف بالتفصيل");
      return;
    }

    try {
      setLoading(true);
      const res = await submitErAppealRecord({
        caseId: erCase.id,
        decisionId: decisionId || erCase.id,
        appellantEmployeeId: appellantEmployeeId || erCase.subjectEmployeeId || "",
        grounds,
        statement: statement.trim(),
      });

      if (res && res.success) {
        toast.success(`تم تسجيل طلب الاستئناف بنجاح برقم: ${res.appeal_number}`);
        onSuccess();
        onClose();
        setStatement("");
      } else {
        toast.error(res?.error || "تعذر قيد طلب الاستئناف");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء تقديم الاستئناف");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                تقديم طلب استئناف وتظلم: {erCase.caseNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                إحالة القرار للجنة استئناف محايدة ومستقلة وفق ضوابط فصل السلطات
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Grounds for Appeal */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">السند النظامي للاستئناف</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
              value={grounds}
              onChange={(e) => setGrounds(e.target.value as ErAppealGrounds)}
            >
              <option value="procedural_defect">عيب إجرائي في التحقيق أو الإخطار (Procedural Defect)</option>
              <option value="new_evidence">ظهور وقائع وأدلة جوهرية جديدة (New Evidence)</option>
              <option value="disproportionate_penalty">عدم تناسب الجزاء مع الواقعة (Disproportionate Penalty)</option>
              <option value="factual_error">خطأ مادي في الوقائع المستند إليها (Factual Error)</option>
              <option value="bias_or_conflict">شبهة تحيز أو تعارض مصالح (Bias / Conflict of Interest)</option>
            </select>
          </div>

          {/* Statement */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              مذكرة الاستئناف وأوجه الدفوع <span className="text-destructive">*</span>
            </Label>
            <textarea
              rows={5}
              placeholder="اكتب شرحاً وافياً للأسباب التي تدعو لتعديل أو إلغاء القرار الصادر..."
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              required
              className="w-full p-2.5 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300">
            <strong>ضمانة النزاهة المؤسسية:</strong>
            <p className="mt-0.5">
              يحظر نظامياً على المحقق الأصلي أو متخذ القرار النظر في هذا الاستئناف، وسيتولى فحصه عضو محايد من لجنة التظلمات العليا.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
              {loading ? "جاري الإرسال..." : "إرسال طلب الاستئناف"}
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
