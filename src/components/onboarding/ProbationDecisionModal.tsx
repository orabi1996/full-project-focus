import React, { useState } from "react";
import { X, CheckCircle2, Clock, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { decideProbationOutcome } from "../../lib/data/onboarding-repository";
import type { ProbationCase, ProbationPolicy, ProbationDecision } from "../../lib/domains/onboarding";
import { validateProbationExtension } from "../../lib/domains/onboarding";

interface ProbationDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  probationCase: ProbationCase | null;
  policy?: ProbationPolicy;
}

export const ProbationDecisionModal: React.FC<ProbationDecisionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  probationCase,
  policy,
}) => {
  const [decision, setDecision] = useState<ProbationDecision>("confirmed");
  const [notes, setNotes] = useState("");
  const [extensionDays, setExtensionDays] = useState<number>(30);
  const [extensionReason, setExtensionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !probationCase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast.error("يرجى إدخال مبررات وملاحظات القرار الإداري");
      return;
    }

    if (decision === "extended") {
      const val = validateProbationExtension(
        policy,
        probationCase.extensionDays || 0,
        extensionDays,
      );
      if (!val.valid) {
        toast.error(val.reason || "فترة التمديد غير نظامية");
        return;
      }
      if (!extensionReason.trim()) {
        toast.error("يرجى توضيح سبب تمديد فترة التجربة وأوجه التطوير المطلوبة");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await decideProbationOutcome({
        caseId: probationCase.id,
        decision,
        notes: notes.trim(),
        extensionDays: decision === "extended" ? extensionDays : undefined,
        extensionReason: decision === "extended" ? extensionReason.trim() : undefined,
      });

      if (!res.ok) {
        toast.error(res.message || "تعذر اعتماد قرار فترة التجربة");
        return;
      }

      if (decision === "confirmed") {
        toast.success("تم تثبيت الموظف وتحديث حالته إلى 'على رأس العمل' بنجاح");
      } else if (decision === "extended") {
        toast.success(`تم تمديد فترة التجربة لمدة ${extensionDays} يوماً بنجاح`);
      } else {
        toast.warning(
          "تم تسجيل عدم اجتياز التجربة وتحويل الموظف لمسار تصفية المستحقات وإنهاء الخدمة النظامي",
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">قرار فترة التجربة النهائي</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              الموظف: {probationCase.employeeName || probationCase.employeeNo} | تاريخ الانتهاء الحالي:{" "}
              {probationCase.currentEndDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">
              نوع القرار الإداري <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDecision("confirmed")}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  decision === "confirmed"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-xs">تثبيت التعيين</span>
              </button>

              <button
                type="button"
                onClick={() => setDecision("extended")}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  decision === "extended"
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <Clock className="h-5 w-5 text-amber-600" />
                <span className="text-xs">تمديد التجربة</span>
              </button>

              <button
                type="button"
                onClick={() => setDecision("failed")}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  decision === "failed"
                    ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                <span className="text-xs">إنهاء الخدمة</span>
              </button>
            </div>
          </div>

          {decision === "extended" && (
            <div className="space-y-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-800 dark:text-amber-400">
                  عدد أيام التمديد (الحد الأقصى المتبقي:{" "}
                  {(policy?.maxExtensionDays ?? 90) - (probationCase.extensionDays ?? 0)} يوم)
                </span>
              </div>
              <input
                type="number"
                min={1}
                max={(policy?.maxExtensionDays ?? 90) - (probationCase.extensionDays ?? 0)}
                value={extensionDays}
                onChange={(e) => setExtensionDays(Number(e.target.value))}
                className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                required
              />

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  سبب التمديد وخطة التحسين المحددة
                </label>
                <input
                  type="text"
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="مثال: بحاجة لمزيد من التدريب على المنظومة التقنية وتقييم إضافي"
                  className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>
          )}

          {decision === "failed" && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                <strong>تأكيد نظامي:</strong> لن يتم حذف سجل الموظف إطلاقاً من النظام. سيتم تحويل حالته إلى "منتهي الخدمة" وتوجيهه تلقائياً إلى إدارة تصفية المستحقات والعهد (Offboarding Clearance) بما يتوافق مع نظام العمل.
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              ملاحظات القرار والاعتماد الإداري <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="سجل مبررات القرار، توصية المدير المباشر، وتاريخ التفعيل..."
              className="w-full p-3 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-xs font-bold rounded-xl text-white flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 ${
                decision === "confirmed"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : decision === "extended"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {isSubmitting ? "جاري الاعتماد..." : "اعتماد القرار وحفظ السجل"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
