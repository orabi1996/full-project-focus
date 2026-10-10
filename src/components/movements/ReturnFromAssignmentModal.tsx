// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 28: RETURN FROM TEMPORARY ASSIGNMENT MODAL
// src/components/movements/ReturnFromAssignmentModal.tsx
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
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import type { TemporaryAssignment } from "../../lib/domains/movements";
import { validateTemporaryAssignmentReturn } from "../../lib/domains/movements";
import { returnFromTemporaryAssignmentRecord } from "../../lib/data/movements-repository";

interface ReturnFromAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  assignment: TemporaryAssignment | null;
}

export const ReturnFromAssignmentModal: React.FC<ReturnFromAssignmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  assignment,
}) => {
  const [actualEndDate, setActualEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("انتهاء فترة التكليف المؤقت والعودة للعمل الأصلي");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!assignment) return null;

  const validation = validateTemporaryAssignmentReturn(assignment, actualEndDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.canReturn) {
      toast.error(validation.reason || "لا يمكن إتمام العودة من التكليف");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await returnFromTemporaryAssignmentRecord({
        companyId,
        assignmentId: assignment.id,
        actualEndDate,
        reason,
      });

      if (res.success) {
        toast.success("تم استعادة التعيين الأساسي للموظف بنجاح");
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "تعذر إنهاء التكليف");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء تنفيذ العودة");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <RotateCcw className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-black">إنهاء التكليف والعودة للتعيين الأساسي</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                الموظف: {assignment.employeeName || assignment.employeeId}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Base Assignment Snapshot Preview */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 text-xs space-y-2">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              التعيين الأساسي المحفوظ الذي ستتم استعادته:
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>الإدارة الأصلية: <span className="font-semibold text-foreground">{assignment.homeDepartmentName || "محددة بالنظام"}</span></div>
              <div>الوظيفة الأصلية: <span className="font-semibold text-foreground">{assignment.homePositionTitle || "محددة بالنظام"}</span></div>
              <div>المدير الأصلي: <span className="font-semibold text-foreground">{assignment.homeManagerName || "محدد بالنظام"}</span></div>
              <div>تاريخ بدء التكليف: <span className="font-mono text-foreground">{assignment.startDate}</span></div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">تاريخ العودة الفعلي *</Label>
            <Input
              type="date"
              value={actualEndDate}
              onChange={(e) => setActualEndDate(e.target.value)}
              className="mt-1 h-10 rounded-xl"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-bold">ملاحظات / سبب إنهاء التكليف *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 rounded-xl text-xs"
              rows={2}
              required
            />
          </div>

          {!validation.canReturn && (
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validation.reason}</span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !validation.canReturn}
              className="rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isSubmitting ? "جاري الاستعادة..." : "تأكيد العودة واستعادة التعيين"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
