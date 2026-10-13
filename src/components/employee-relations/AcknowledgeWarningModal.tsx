// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: ACKNOWLEDGE WARNING / RECORD REFUSAL MODAL
// src/components/employee-relations/AcknowledgeWarningModal.tsx
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
import { PenTool, CheckCircle2, UserX } from "lucide-react";
import { acknowledgeWarningRecord } from "../../lib/data/employee-relations-repository";
import type { ErEmployeeWarning, ErAcknowledgementStatus } from "../../lib/domains/employee-relations";
import { useEmployees } from "../../lib/domains/employees";

interface AcknowledgeWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  warning: ErEmployeeWarning | null;
}

export const AcknowledgeWarningModal: React.FC<AcknowledgeWarningModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  warning,
}) => {
  const { employees } = useEmployees();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ErAcknowledgementStatus>("acknowledged");
  const [comments, setComments] = useState("");
  const [refusalWitnessId, setRefusalWitnessId] = useState("");
  const [refusalNotes, setRefusalNotes] = useState("");

  if (!warning) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "refused_to_sign" && !refusalWitnessId) {
      toast.error("يرجى تحديد الشاهد الحاضر على واقعة امتناع الموظف عن التوقيع");
      return;
    }

    try {
      setLoading(true);
      const res = await acknowledgeWarningRecord({
        warningId: warning.id,
        acknowledgementStatus: status,
        employeeComments: comments.trim() || undefined,
        refusalWitnessId: status === "refused_to_sign" ? refusalWitnessId : undefined,
        refusalNotes: status === "refused_to_sign" ? refusalNotes.trim() : undefined,
      });

      if (res && res.success) {
        toast.success(
          status === "acknowledged"
            ? "تم توثيق استلام وتوقيع الموظف على الإنذار بنجاح"
            : "تم إثبات واقعة الامتناع عن التوقيع بمحضر رسمي معتمد"
        );
        onSuccess();
        onClose();
      } else {
        toast.error(res?.error || "تعذر تحديث حالة التوقيع");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ التوقيع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                إثبات التوقيع / الاستلام: {warning.warningNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                الموظف: {warning.employeeName} ({warning.employeeNumber})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Action Mode */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">إجراء التوقيع والتسليم</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus("acknowledged")}
                className={`p-3 text-xs font-bold rounded-lg border text-center transition-all ${
                  status === "acknowledged"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-600"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                توقيع واستلام إلكتروني للموظف
              </button>
              <button
                type="button"
                onClick={() => setStatus("refused_to_sign")}
                className={`p-3 text-xs font-bold rounded-lg border text-center transition-all ${
                  status === "refused_to_sign"
                    ? "bg-destructive/10 border-destructive text-destructive"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                إثبات امتناع الموظف عن التوقيع
              </button>
            </div>
          </div>

          {status === "acknowledged" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ملاحظات أو تعليق الموظف (اختياري)</Label>
              <textarea
                rows={3}
                placeholder="يمكن للموظف تدوين أي ملاحظات أو تعهد بعدم تكرار الواقعة هنا..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full p-2.5 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          ) : (
            <div className="space-y-3 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  الشاهد الحاضر على واقعة الامتناع <span className="text-destructive">*</span>
                </Label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                  value={refusalWitnessId}
                  onChange={(e) => setRefusalWitnessId(e.target.value)}
                  required
                >
                  <option value="">-- حدد الشاهد من الموظفين الحاضرين --</option>
                  {employees
                    .filter((e) => e.id !== warning.employeeId)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">محضر وبيان واقعة الامتناع</Label>
                <textarea
                  rows={2}
                  placeholder="تم تسليم الإنذار للموظف وامتنع عن التوقيع والاستلام في تمام الساعة..."
                  value={refusalNotes}
                  onChange={(e) => setRefusalNotes(e.target.value)}
                  className="w-full p-2.5 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={`gap-1.5 ${
                status === "refused_to_sign"
                  ? "bg-destructive hover:bg-destructive/90 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {loading ? "جاري الحفظ..." : status === "acknowledged" ? "تأكيد التوقيع والاستلام" : "إثبات محضر الامتناع"}
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
