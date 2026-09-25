import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ArrowLeftRight, UserCheck } from "lucide-react";
import type { Employee, ScheduleAssignment, ShiftSwapRequest } from "../../types";
import { useRosterMutations } from "../../lib/domains/shifts";
import { toast } from "sonner";

interface CreateShiftSwapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  assignments: ScheduleAssignment[];
  companyId?: string;
  onSuccess?: () => void;
}

export const CreateShiftSwapModal: React.FC<CreateShiftSwapModalProps> = ({
  open,
  onOpenChange,
  employees,
  assignments,
  companyId,
  onSuccess,
}) => {
  const { createSwap } = useRosterMutations(companyId);

  const [requesterId, setRequesterId] = useState("");
  const [requesterAssignmentId, setRequesterAssignmentId] = useState("");
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [targetAssignmentId, setTargetAssignmentId] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requesterAssignments = assignments.filter((a) => a.employeeId === requesterId && !a.isRestDay);
  const targetAssignments = assignments.filter((a) => a.employeeId === targetEmployeeId && !a.isRestDay);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requesterId || !requesterAssignmentId) {
      toast.error("يرجى اختيار الموظف صاحب الطلب والوردية المراد تبديلها");
      return;
    }
    if (!targetEmployeeId || !targetAssignmentId) {
      toast.error("يرجى اختيار الموظف البديل والوردية البديلة");
      return;
    }
    if (requesterId === targetEmployeeId) {
      toast.error("لا يمكن التبديل مع نفس الموظف");
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await createSwap({
        companyId,
        requesterId,
        requesterAssignmentId,
        targetEmployeeId,
        targetAssignmentId,
        reason: reason.trim() || undefined,
      });

      if (ok) {
        onOpenChange(false);
        setReason("");
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            تقديم طلب تبديل وردية بين موظفين
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            إرسال طلب تبديل جدول العمل لمراجعة الزميل واعتماد الإدارة دون الإخلال بساعات العمل النظامية.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Requester Box */}
          <div className="p-3.5 bg-muted/30 border border-border/80 rounded-2xl space-y-3">
            <p className="text-xs font-black text-foreground">الطرف الأول (مقدم الطلب)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">الموظف</Label>
                <select
                  value={requesterId}
                  onChange={(e) => {
                    setRequesterId(e.target.value);
                    setRequesterAssignmentId("");
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  required
                >
                  <option value="">اختر الموظف...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold">وردية العمل الحالية</Label>
                <select
                  value={requesterAssignmentId}
                  onChange={(e) => setRequesterAssignmentId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  disabled={!requesterId}
                  required
                >
                  <option value="">اختر الوردية المراد تبديلها...</option>
                  {requesterAssignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.date}: {a.shiftNameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Target Box */}
          <div className="p-3.5 bg-muted/30 border border-border/80 rounded-2xl space-y-3">
            <p className="text-xs font-black text-foreground">الطرف الثاني (الموظف البديل)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">الموظف البديل</Label>
                <select
                  value={targetEmployeeId}
                  onChange={(e) => {
                    setTargetEmployeeId(e.target.value);
                    setTargetAssignmentId("");
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  required
                >
                  <option value="">اختر الموظف البديل...</option>
                  {employees
                    .filter((e) => e.id !== requesterId)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold">الوردية المستهدفة</Label>
                <select
                  value={targetAssignmentId}
                  onChange={(e) => setTargetAssignmentId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  disabled={!targetEmployeeId}
                  required
                >
                  <option value="">اختر الوردية البديلة...</option>
                  {targetAssignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.date}: {a.shiftNameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">سبب طلب التبديل</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: ظرف شخصي طارئ، تغطية مهمة عمل خارجية..."
              className="mt-1 text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs font-bold rounded-xl"
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="classera-btn-primary text-xs font-bold rounded-xl px-5"
            >
              {isSubmitting ? "جاري الإرسال..." : "إرسال طلب التبديل"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
