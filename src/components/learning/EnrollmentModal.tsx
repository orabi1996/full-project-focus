// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 29: ENROLLMENT & NOMINATION MODAL
// src/components/learning/EnrollmentModal.tsx
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
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { enrollInSession } from "../../lib/data/learning-repository";
import type { TrainingSession } from "../../lib/domains/learning";
import { evaluateSessionCapacity } from "../../lib/domains/learning";

interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  session: TrainingSession | null;
  employees: Array<{ id: string; name: string; employeeNo?: string; departmentName?: string }>;
}

export const EnrollmentModal: React.FC<EnrollmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  session,
  employees,
}) => {
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [source, setSource] = useState("manager_nomination");
  const [notes, setNotes] = useState("");

  if (!session) return null;

  const cap = evaluateSessionCapacity(session.capacity, session.enrolledCount);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast.error("يرجى اختيار الموظف المراد تسجيله");
      return;
    }

    setLoading(true);
    try {
      const res = await enrollInSession({
        companyId,
        sessionId: session.id,
        employeeId,
        source,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "فشل تسجيل الموظف في الجلسة");
        return;
      }

      if (res.status === "waitlisted") {
        toast.warning("الجلسة مكتملة العدد: تم تسجيل الموظف بنجاح في قائمة الانتظار (Waitlist)");
      } else {
        toast.success("تم تأكيد تسجيل الموظف في الجلسة التدريبية بنجاح");
      }

      onSuccess();
      onClose();
    } catch {
      toast.error("حدث خطأ أثناء تنفيذ عملية التسجيل");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">تسجيل / ترشيح موظف في الجلسة</DialogTitle>
              <DialogDescription>
                الجلسة: <span className="font-bold text-foreground font-mono">{session.sessionCode}</span> — {session.courseTitleAr}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleEnroll} className="space-y-4 py-2">
          {/* Capacity Alert */}
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            cap.isFull ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
          }`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>
                {cap.isFull 
                  ? "الجلسة مكتملة العدد حالياً. سيتم إدراج الموظف في قائمة الانتظار (Waitlist)"
                  : `المقاعد الشاغرة: ${cap.seatsRemaining} من إجمالي ${session.capacity}`
                }
              </span>
            </div>
            <Badge variant="outline" className="font-mono">
              {session.enrolledCount} / {session.capacity}
            </Badge>
          </div>

          <div>
            <Label className="text-xs font-bold text-muted-foreground">اختيار الموظف *</Label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
            >
              <option value="">-- اختر الموظف --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.employeeNo ? `(${emp.employeeNo})` : ""} {emp.departmentName ? `— ${emp.departmentName}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs font-bold text-muted-foreground">مصدر التسجيل / نوع الترشيح</Label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
            >
              <option value="manager_nomination">ترشيح من المدير المباشر (Manager Nomination)</option>
              <option value="hr_assignment">تكليف من إدارة الموارد البشرية (HR Assignment)</option>
              <option value="employee_request">طلب الموظف الذاتي (Employee Request)</option>
              <option value="mandatory_assignment">تكليف إلزامي بالامتثال (Mandatory Compliance)</option>
              <option value="development_plan">ضمن الخطة التطويرية (Development Plan)</option>
              <option value="onboarding">برنامج التهيئة والتدريب التأسيسي (Onboarding)</option>
            </select>
          </div>

          <div>
            <Label className="text-xs font-bold text-muted-foreground">مبررات الترشيح وملاحظات إضافية</Label>
            <Textarea
              rows={3}
              placeholder="تحديد أسباب الترشيح أو أهداف المشاركة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 resize-none"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "جاري المعالجة..." : (cap.isFull ? "إضافة لقائمة الانتظار" : "تأكيد التسجيل")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
