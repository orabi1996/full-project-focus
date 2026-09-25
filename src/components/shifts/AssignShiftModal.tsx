import React, { useState, useEffect } from "react";
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
import { Badge } from "../ui/badge";
import { Clock, Calendar, Check, Moon, Trash2 } from "lucide-react";
import type { ShiftDefinition, ScheduleAssignment, Employee } from "../../types";
import { useRosterMutations } from "../../lib/domains/shifts";
import { toast } from "sonner";

interface AssignShiftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  date: string;
  currentAssignment?: ScheduleAssignment | null;
  shifts: ShiftDefinition[];
  rosterPeriodId?: string;
  companyId?: string;
  onSuccess?: () => void;
}

export const AssignShiftModal: React.FC<AssignShiftModalProps> = ({
  open,
  onOpenChange,
  employee,
  date,
  currentAssignment,
  shifts,
  rosterPeriodId,
  companyId,
  onSuccess,
}) => {
  const { saveAssignment, removeAssignment } = useRosterMutations(companyId);

  const [isRestDay, setIsRestDay] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (currentAssignment) {
        setIsRestDay(Boolean(currentAssignment.isRestDay));
        setSelectedShiftId(currentAssignment.shiftId || "");
        setNotes(currentAssignment.notes || "");
      } else {
        setIsRestDay(false);
        setSelectedShiftId(shifts[0]?.id || "");
        setNotes("");
      }
    }
  }, [open, currentAssignment, shifts]);

  if (!employee) return null;

  const handleSave = async () => {
    if (!isRestDay && !selectedShiftId) {
      toast.error("يرجى اختيار وردية أو تحديد اليوم كيوم راحة");
      return;
    }

    const chosenShift = shifts.find((s) => s.id === selectedShiftId);

    setIsSubmitting(true);
    try {
      const payload: Partial<ScheduleAssignment> = {
        id: currentAssignment?.id,
        companyId,
        employeeId: employee.id,
        rosterPeriodId,
        date,
        isRestDay,
        shiftId: isRestDay ? "REST_DAY" : selectedShiftId,
        shiftNameAr: isRestDay ? "راحة أسبوعية" : chosenShift?.nameAr || "",
        shiftColor: isRestDay ? "#94a3b8" : chosenShift?.color || "#0284c7",
        status: currentAssignment?.status || "draft",
        notes: notes.trim() || undefined,
      };

      const ok = await saveAssignment(payload);
      if (ok) {
        onOpenChange(false);
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!currentAssignment?.id) return;
    setIsSubmitting(true);
    try {
      const ok = await removeAssignment(currentAssignment.id);
      if (ok) {
        onOpenChange(false);
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            إسناد وردية عمل
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            تحديد جدول عمل الموظف{" "}
            <span className="font-bold text-foreground">
              {employee.firstNameAr} {employee.lastNameAr}
            </span>{" "}
            ليوم <span className="font-mono text-primary font-bold">{date}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Rest Day vs Shift Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-2xl border">
            <button
              type="button"
              onClick={() => setIsRestDay(false)}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !isRestDay
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              وردية عمل رسمية
            </button>
            <button
              type="button"
              onClick={() => setIsRestDay(true)}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isRestDay
                  ? "bg-card text-amber-700 dark:text-amber-400 shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              راحة أسبوعية (Off Day)
            </button>
          </div>

          {!isRestDay ? (
            <div className="space-y-2.5">
              <Label className="text-xs font-bold">اختر الوردية المطلوبة</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {shifts.map((sh) => (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => setSelectedShiftId(sh.id)}
                    className={`w-full text-start p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      selectedShiftId === sh.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border/70 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: sh.color || "#0284c7" }}
                      />
                      <div>
                        <p className="text-xs font-bold text-foreground">{sh.nameAr}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {sh.startTime} - {sh.endTime} ({sh.code})
                        </p>
                      </div>
                    </div>
                    {selectedShiftId === sh.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
              <Moon className="h-6 w-6 text-amber-600 mx-auto" />
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                اليوم محدد كـ يوم راحة رسمي
              </p>
              <p className="text-[11px] text-muted-foreground">
                لن يتم إلزام الموظف ببصمات حضور في هذا التاريخ ولن يُسجل غياب في الحضور والانصراف.
              </p>
            </div>
          )}

          <div>
            <Label className="text-xs font-bold">ملاحظات الإسناد (اختياري)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تغطية موقع المعرض، تكليف إضافي..."
              className="mt-1 text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 flex-wrap">
            {currentAssignment && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="text-xs font-bold rounded-xl gap-1.5 me-auto"
              >
                <Trash2 className="h-3.5 w-3.5" />
                حذف الإسناد
              </Button>
            )}
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
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="classera-btn-primary text-xs font-bold rounded-xl px-5"
            >
              {isSubmitting ? "جاري الحفظ..." : "حفظ الإسناد"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
