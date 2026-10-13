// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: RECORD FORMAL DECISION MODAL
// src/components/employee-relations/RecordDecisionModal.tsx
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
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { Scale, CheckCircle2, AlertCircle } from "lucide-react";
import { recordErDecisionRecord } from "../../lib/data/employee-relations-repository";
import type { ErCase, ErDecisionType } from "../../lib/domains/employee-relations";
import { useEmployees } from "../../lib/domains/employees";

interface RecordDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  erCase: ErCase | null;
}

export const RecordDecisionModal: React.FC<RecordDecisionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  erCase,
}) => {
  const { employees } = useEmployees();
  const [loading, setLoading] = useState(false);
  const [decisionMakerId, setDecisionMakerId] = useState("");
  const [decisionType, setDecisionType] = useState<ErDecisionType>("formal_warning");
  const [decisionSummary, setDecisionSummary] = useState("");
  const [rationale, setRationale] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [appealEligible, setAppealEligible] = useState(true);
  const [appealDeadlineDays, setAppealDeadlineDays] = useState(15);

  React.useEffect(() => {
    if (erCase) {
      setDecisionSummary(`قرار تأديبي بحق الموظف المعني في القضية ${erCase.caseNumber}`);
      setRationale("استناداً إلى نتائج التحقيق وثبوت المخالفة وفق لائحة تنظيم العمل الداخلية");
    }
  }, [erCase]);

  if (!erCase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionMakerId) {
      toast.error("يرجى تحديد متخذ القرار أو رئيس لجنة التحقيق");
      return;
    }
    if (!decisionSummary.trim()) {
      toast.error("يرجى كتابة منطوق القرار وملخصه");
      return;
    }
    if (!rationale.trim()) {
      toast.error("يرجى كتابة حيثيات وأسباب القرار");
      return;
    }

    try {
      setLoading(true);
      const res = await recordErDecisionRecord({
        caseId: erCase.id,
        decisionMakerId,
        decisionType,
        decisionSummary: decisionSummary.trim(),
        rationale: rationale.trim(),
        effectiveDate,
        appealEligible,
        appealDeadlineDays,
      });

      if (res && res.success) {
        toast.success(`تم تسجيل القرار بنجاح برقم: ${res.decision_number}`);
        onSuccess();
        onClose();
      } else {
        toast.error(res?.error || "تعذر تسجيل القرار");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء اعتماد القرار");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                إصدار وتسجيل قرار رسمي: {erCase.caseNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                توثيق قرار لجنة الجزاءات والتحقيق مع حفظ حق الاستئناف النظامي للموظف
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Decision Maker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              متخذ القرار / رئيس لجنة المخالفات <span className="text-destructive">*</span>
            </Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
              value={decisionMakerId}
              onChange={(e) => setDecisionMakerId(e.target.value)}
              required
            >
              <option value="">-- حدد المسؤول المصرح له بالقرار --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstNameAr} {emp.lastNameAr} ({emp.jobTitleAr || emp.employeeNo})
                </option>
              ))}
            </select>
          </div>

          {/* Decision Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">طبيعة ونوع القرار</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
              value={decisionType}
              onChange={(e) => setDecisionType(e.target.value as ErDecisionType)}
            >
              <option value="formal_warning">إصدار إنذار كتابي رسمي (Formal Warning)</option>
              <option value="disciplinary_action">تطبيق جزاء تأديبي نظامي (Disciplinary Action)</option>
              <option value="corrective_action_plan">إلزام بخطة تصحيح وتطوير سلوكي (CAP)</option>
              <option value="informal_counseling">جلسة توجيه وإرشاد غير رسمية (Informal Counseling)</option>
              <option value="suspension">إيقاف مؤقت عن العمل للتحقيق (Suspension)</option>
              <option value="transfer_recommendation">توصية نقل إداري أو تغيـير موقع العمل (Transfer)</option>
              <option value="dismissal_recommendation">توصية بإنهاء الخدمة للمراجعة القانونية (Dismissal Review)</option>
              <option value="no_action">حفظ الملف وتبرئة الموظف لعدم الثبوت (No Action / Dismissed)</option>
            </select>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              منطوق القرار الرسمي <span className="text-destructive">*</span>
            </Label>
            <textarea
              rows={2}
              value={decisionSummary}
              onChange={(e) => setDecisionSummary(e.target.value)}
              required
              className="w-full p-2.5 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Rationale */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              الأسباب والحيثيات النظامية <span className="text-destructive">*</span>
            </Label>
            <textarea
              rows={3}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              required
              className="w-full p-2.5 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Effective Date & Appeal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">تاريخ سريان القرار</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">مهلة تقديم الاستئناف (أيام)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={appealDeadlineDays}
                onChange={(e) => setAppealDeadlineDays(parseInt(e.target.value) || 15)}
                disabled={!appealEligible}
                className="text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/50 border border-border">
            <input
              type="checkbox"
              id="appealEligible"
              checked={appealEligible}
              onChange={(e) => setAppealEligible(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <label htmlFor="appealEligible" className="text-xs font-medium cursor-pointer text-foreground">
              القرار قابل للاستئناف والتظلم أمام لجنة التظلمات المستقلة
            </label>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? "جاري الاعتماد..." : "اعتماد القرار وتعميمه"}
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
