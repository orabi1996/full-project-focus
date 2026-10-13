// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: START FORMAL INVESTIGATION MODAL
// src/components/employee-relations/InvestigationModal.tsx
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
import { Search, CheckCircle2, ShieldAlert } from "lucide-react";
import { startErInvestigationRecord } from "../../lib/data/employee-relations-repository";
import type { ErCase } from "../../lib/domains/employee-relations";
import { useEmployees } from "../../lib/domains/employees";

interface InvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  erCase: ErCase | null;
}

export const InvestigationModal: React.FC<InvestigationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  erCase,
}) => {
  const { employees } = useEmployees();
  const [loading, setLoading] = useState(false);
  const [leadInvestigatorId, setLeadInvestigatorId] = useState(erCase?.assignedInvestigatorId || "");
  const [scope, setScope] = useState("");
  const [methodology, setMethodology] = useState("");
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split("T")[0];
  });

  React.useEffect(() => {
    if (erCase) {
      setLeadInvestigatorId(erCase.assignedInvestigatorId || "");
      setScope(`التحقيق في وقائع المخالفة / البلاغ المقيد برقم ${erCase.caseNumber}: ${erCase.title}`);
      setMethodology("سماع أقوال الشاكي، مواجهة الموظف المعني بالأدلة، مراجعة السجلات الرقمية والشهود");
    }
  }, [erCase]);

  if (!erCase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scope.trim()) {
      toast.error("يرجى تحديد نطاق التحقيق وموضوعه");
      return;
    }

    try {
      setLoading(true);
      const res = await startErInvestigationRecord({
        caseId: erCase.id,
        scope: scope.trim(),
        methodology: methodology.trim() || undefined,
        leadInvestigatorId: leadInvestigatorId || undefined,
        targetCompletionDate: targetDate,
      });

      if (res && res.success) {
        toast.success(`تم إطلاق التحقيق الرسمي بنجاح برقم: ${res.investigation_number}`);
        onSuccess();
        onClose();
      } else {
        toast.error(res?.error || "تعذر بدء التحقيق");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء فتح ملف التحقيق");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                بدء تحقيق إداري رسمي: {erCase.caseNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                فتح محضر رسمي، توليد خطوات التحقيق المعيارية، وتكليف المحقق المستقل
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Lead Investigator */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">المحقق المستقل المكلف بإدارة الملف</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
              value={leadInvestigatorId}
              onChange={(e) => setLeadInvestigatorId(e.target.value)}
            >
              <option value="">-- اختياري: حدد المحقق المستقل --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstNameAr} {emp.lastNameAr} ({emp.jobTitleAr || emp.employeeNo})
                </option>
              ))}
            </select>
          </div>

          {/* Scope */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">نطاق وموضوع التحقيق <span className="text-destructive">*</span></Label>
            <textarea
              rows={3}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              required
              className="w-full p-2.5 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Methodology */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">منهجية ووسائل التحقيق المقترحة</Label>
            <Input
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              className="text-sm"
              placeholder="مثال: فحص رسائل البريد، كاميرات المراقبة، سماع الشهود"
            />
          </div>

          {/* Target Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">تاريخ الانتهاء المستهدف من التحقيق</Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="p-3 bg-muted/50 rounded-lg border border-border text-xs text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              البروتوكول المعياري للتحقيق:
            </div>
            <p>
              سيقوم النظام آلياً بتوليد 4 مراحل إجرائية للتحقيق تشمل فحص الأدلة، سماع الأطراف، جلسة المواجهة، وإعداد تقرير النتائج النهائي.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? "جاري فتح الملف..." : "اعتماد وبدء التحقيق الرسمي"}
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
