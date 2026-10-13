// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: ISSUE DISCIPLINARY ACTION & WARNING MODAL
// src/components/employee-relations/IssueDisciplinaryActionModal.tsx
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
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { issueDisciplinaryActionRecord } from "../../lib/data/employee-relations-repository";
import type { ErCase, ErWarningLevel } from "../../lib/domains/employee-relations";
import { useEmployees } from "../../lib/domains/employees";

interface IssueDisciplinaryActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  erCase: ErCase | null;
  decisionId?: string;
}

export const IssueDisciplinaryActionModal: React.FC<IssueDisciplinaryActionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  erCase,
  decisionId,
}) => {
  const { employees } = useEmployees();
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState(erCase?.subjectEmployeeId || "");
  const [actionType, setActionType] = useState("written_warning");
  const [warningLevel, setWarningLevel] = useState<ErWarningLevel>("first_written");
  const [title, setTitle] = useState("إنذار كتابي رسمي لمخالفة التعليمات والسياسات");
  const [details, setDetails] = useState("");
  const [validityDays, setValidityDays] = useState(180);

  React.useEffect(() => {
    if (erCase) {
      setEmployeeId(erCase.subjectEmployeeId || "");
      setDetails(`نظراً لثبوت المخالفة الموضحة في ملف التحقيق الخاص بالقضية ${erCase.caseNumber}`);
    }
  }, [erCase]);

  if (!erCase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast.error("يرجى تحديد الموظف الصادر بحقه الإجراء");
      return;
    }
    if (!title.trim() || !details.trim()) {
      toast.error("يرجى استكمال عنوان وتفاصيل الإجراء التأديبي");
      return;
    }

    try {
      setLoading(true);
      const res = await issueDisciplinaryActionRecord({
        caseId: erCase.id,
        decisionId: decisionId || erCase.id,
        employeeId,
        actionType,
        title: title.trim(),
        details: details.trim(),
        warningLevel,
        validityDays,
      });

      if (res && res.success) {
        if (res.warning_number) {
          toast.success(`تم إصدار خطاب الإنذار الرسمي بنجاح برقم: ${res.warning_number}`);
        } else {
          toast.success("تم تسجيل الإجراء التأديبي بنجاح");
        }
        onSuccess();
        onClose();
      } else {
        toast.error(res?.error || "تعذر إصدار الإجراء التأديبي");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء إصدار الإجراء");
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
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                إصدار جزاء تأديبي / خطاب إنذار: {erCase.caseNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                تطبيق الإجراء التأديبي النظامي وقيده في السجل الوظيفي للموظف
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Employee Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">الموظف المعني بالجزاء</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">-- حدد الموظف --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo})
                </option>
              ))}
            </select>
          </div>

          {/* Action Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نوع الإجراء التأديبي</Label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
              >
                <option value="written_warning">إنذار كتابي رسمي</option>
                <option value="final_warning">إنذار كتابي نهائي</option>
                <option value="verbal_warning_record">تنبيه شفوي موثق بمحضر</option>
                <option value="corrective_action_plan">خطة تحسين سلوك وإلزام تدريبي</option>
                <option value="policy_acknowledgement">إقرار وتعهد التزام بالسياسة</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">درجة الإنذار التدرجي</Label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={warningLevel}
                onChange={(e) => setWarningLevel(e.target.value as ErWarningLevel)}
              >
                <option value="first_written">إنذار أول (1st Written)</option>
                <option value="second_written">إنذار ثانٍ (2nd Written)</option>
                <option value="final">إنذار أخير / نهائي (Final Warning)</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">عنوان الجزاء / موضوع الإنذار</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="text-sm"
            />
          </div>

          {/* Validity Days */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">مدة سريان الإنذار في السجل (بالأيام)</Label>
            <Input
              type="number"
              min={30}
              max={730}
              value={validityDays}
              onChange={(e) => setValidityDays(parseInt(e.target.value) || 180)}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              تسقط سابقة المخالفة من السجل التأديبي للموظف بعد انقضاء هذه المدة دون تكرار
            </p>
          </div>

          {/* Details */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">تفاصيل المخالفة والتحسينات المطلوبة</Label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              required
              className="w-full p-2.5 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? "جاري الإصدار..." : "إصدار وإحالة لتوقيع الموظف"}
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
