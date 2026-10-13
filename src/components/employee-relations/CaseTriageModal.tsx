// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: CASE TRIAGE MODAL
// src/components/employee-relations/CaseTriageModal.tsx
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
import { CheckCircle2, UserCheck, ShieldAlert } from "lucide-react";
import { triageErCaseRecord } from "../../lib/data/employee-relations-repository";
import type { ErCase, ErCaseStatus, ErSeverity } from "../../lib/domains/employee-relations";
import { useEmployees } from "../../lib/domains/employees";

interface CaseTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  erCase: ErCase | null;
}

export const CaseTriageModal: React.FC<CaseTriageModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  erCase,
}) => {
  const { employees } = useEmployees();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ErCaseStatus>(erCase?.status || "under_review");
  const [severity, setSeverity] = useState<ErSeverity>(erCase?.severity || "medium");
  const [assignedInvestigatorId, setAssignedInvestigatorId] = useState(erCase?.assignedInvestigatorId || "");
  const [caseOwnerId, setCaseOwnerId] = useState(erCase?.caseOwnerId || "");
  const [triageNotes, setTriageNotes] = useState("");

  React.useEffect(() => {
    if (erCase) {
      setStatus(erCase.status);
      setSeverity(erCase.severity);
      setAssignedInvestigatorId(erCase.assignedInvestigatorId || "");
      setCaseOwnerId(erCase.caseOwnerId || "");
    }
  }, [erCase]);

  if (!erCase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await triageErCaseRecord({
        caseId: erCase.id,
        status,
        severity,
        assignedInvestigatorId: assignedInvestigatorId || undefined,
        caseOwnerId: caseOwnerId || undefined,
        triageNotes: triageNotes.trim() || undefined,
      });

      if (res && res.success) {
        toast.success(`تم تحديث حالة القضية ${erCase.caseNumber} بنجاح`);
        onSuccess();
        onClose();
        setTriageNotes("");
      } else {
        toast.error(res?.error || "تعذر إجراء الفرز للقضية");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء إجراء الفرز");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                فرز وتعيين القضية: {erCase.caseNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                توجيه القضية، تعيين المحقق المختص، وتحديد مسار المراجعة
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Status Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">تحديد حالة القضية</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
              value={status}
              onChange={(e) => setStatus(e.target.value as ErCaseStatus)}
            >
              <option value="under_review">قيد المراجعة والتدقيق (Under Review)</option>
              <option value="investigation">إحالة إلى تحقيق رسمي (Investigation)</option>
              <option value="open">مفتوحة للدراسة الودية (Open)</option>
              <option value="awaiting_response">بانتظار إفادة الأطراف (Awaiting Response)</option>
              <option value="closed">حفظ وإغلاق البلاغ لعدم الاختصاص أو عدم الجدية (Closed)</option>
            </select>
          </div>

          {/* Severity */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">درجة الأهمية / الخطورة</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as ErSeverity)}
            >
              <option value="low">منخفضة (Low)</option>
              <option value="medium">متوسطة (Medium)</option>
              <option value="high">عالية (High)</option>
              <option value="critical">حرجة للغاية (Critical)</option>
            </select>
          </div>

          {/* Investigator Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">المحقق المكلف / عضو إدارة علاقات الموظفين</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
              value={assignedInvestigatorId}
              onChange={(e) => setAssignedInvestigatorId(e.target.value)}
            >
              <option value="">-- اختياري: حدد المحقق المكلف --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstNameAr} {emp.lastNameAr} ({emp.jobTitleAr || emp.employeeNo})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">ملاحظات وقرار الفرز الأولي</Label>
            <textarea
              rows={3}
              placeholder="اكتب توجيه لجنة الفرز أو أسباب تعيين المحقق..."
              value={triageNotes}
              onChange={(e) => setTriageNotes(e.target.value)}
              className="w-full p-2.5 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? "جاري الحفظ..." : "تأكيد إجراء الفرز"}
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
