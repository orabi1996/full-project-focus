// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 28: TEMPORARY ASSIGNMENT MODAL (SECONDMENT, ACTING, TEMPORARY)
// src/components/movements/TemporaryAssignmentModal.tsx
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
import { CalendarClock, ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import type { TemporaryAssignmentType } from "../../lib/domains/movements";
import { createTemporaryAssignmentRecord } from "../../lib/data/movements-repository";

interface TemporaryAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  employees: Array<{ id: string; name: string; employeeNo?: string; departmentName?: string; jobTitle?: string }>;
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string }>;
  locations: Array<{ id: string; name: string }>;
}

export const TemporaryAssignmentModal: React.FC<TemporaryAssignmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  employees,
  departments,
  positions,
  locations,
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [assignmentType, setAssignmentType] = useState<TemporaryAssignmentType>("temporary_assignment");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expectedEndDate, setExpectedEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6); // 6 months default
    return d.toISOString().split("T")[0];
  });
  const [tempDeptId, setTempDeptId] = useState("");
  const [tempPosId, setTempPosId] = useState("");
  const [tempMgrId, setTempMgrId] = useState("");
  const [tempLocId, setTempLocId] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      toast.error("يرجى اختيار الموظف");
      return;
    }
    if (!startDate || !expectedEndDate) {
      toast.error("يرجى تحديد تواريخ التكليف المؤقت");
      return;
    }
    if (expectedEndDate <= startDate) {
      toast.error("تاريخ النهاية المتوقع يجب أن يكون بعد تاريخ البدء");
      return;
    }
    if (!reason.trim()) {
      toast.error("يرجى تحديد مبرر التكليف المؤقت أو الإعارة");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createTemporaryAssignmentRecord({
        companyId,
        employeeId: selectedEmpId,
        assignmentType,
        startDate,
        expectedEndDate,
        tempDeptId: tempDeptId || undefined,
        tempPositionId: tempPosId || undefined,
        tempManagerId: tempMgrId || undefined,
        tempLocationId: tempLocId || undefined,
        reason,
      });

      if (res.success) {
        toast.success("تم تسجيل التكليف المؤقت وحفظ التعيين الأساسي بنجاح");
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "تعذر تسجيل التكليف المؤقت");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ التكليف");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl rounded-3xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-black">تسجيل تكليف مؤقت / إعارة</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                يتم الاحتفاظ بالتعيين الأصلي تلقائياً كمرجع ثابت للعودة دون الاعتماد على التخمين
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <Label className="text-xs font-bold">الموظف *</Label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full mt-1.5 h-10 px-3 rounded-xl border border-input bg-background text-sm"
                required
              >
                <option value="">-- اختر الموظف --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo || "N/A"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-bold">نوع التكليف *</Label>
              <select
                value={assignmentType}
                onChange={(e) => setAssignmentType(e.target.value as TemporaryAssignmentType)}
                className="w-full mt-1.5 h-10 px-3 rounded-xl border border-input bg-background text-sm font-semibold"
                required
              >
                <option value="temporary_assignment">تكليف مؤقت (Internal Assignment)</option>
                <option value="secondment">إعارة خارجية (Secondment)</option>
                <option value="acting_assignment">تكليف بالإنابة (Acting Role)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <Label className="text-xs font-bold">تاريخ البدء *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 h-10 rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-bold">تاريخ النهاية المتوقع *</Label>
              <Input
                type="date"
                value={expectedEndDate}
                onChange={(e) => setExpectedEndDate(e.target.value)}
                className="mt-1.5 h-10 rounded-xl text-sm"
                required
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 p-3.5 bg-muted/30 space-y-3">
            <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
              تفاصيل التكليف المؤقت (اختياري)
            </h5>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">الإدارة المؤقتة</Label>
                <select
                  value={tempDeptId}
                  onChange={(e) => setTempDeptId(e.target.value)}
                  className="w-full mt-1 h-8 px-2 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="">بدون تغيير</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-[11px]">المنصب المؤقت</Label>
                <select
                  value={tempPosId}
                  onChange={(e) => setTempPosId(e.target.value)}
                  className="w-full mt-1 h-8 px-2 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="">بدون تغيير</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-[11px]">المدير المشرف المؤقت</Label>
                <select
                  value={tempMgrId}
                  onChange={(e) => setTempMgrId(e.target.value)}
                  className="w-full mt-1 h-8 px-2 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="">بدون تغيير</option>
                  {employees
                    .filter((e) => e.id !== selectedEmpId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <Label className="text-[11px]">الموقع المؤقت</Label>
                <select
                  value={tempLocId}
                  onChange={(e) => setTempLocId(e.target.value)}
                  className="w-full mt-1 h-8 px-2 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="">بدون تغيير</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">المبرر والمهام المكلف بها *</Label>
            <Textarea
              placeholder="وصف طبيعة التكليف، المشروع، أو المهام المطلوبة..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 rounded-xl text-xs"
              rows={2}
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl font-bold bg-amber-600 text-white hover:bg-amber-700"
            >
              {isSubmitting ? "جاري الحفظ..." : "تأكيد التكليف المؤقت"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
