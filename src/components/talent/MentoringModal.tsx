// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: MENTORING RELATIONSHIP MODAL
// src/components/talent/MentoringModal.tsx
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
import { Users2 } from "lucide-react";
import { createMentoringRelationship } from "../../lib/data/talent-repository";

interface MentoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  employees: Array<{ id: string; name: string; employeeNo: string }>;
}

export const MentoringModal: React.FC<MentoringModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  employees,
}) => {
  const [loading, setLoading] = useState(false);
  const [mentorId, setMentorId] = useState("");
  const [menteeId, setMenteeId] = useState("");
  const [objectiveAr, setObjectiveAr] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorId || !menteeId) {
      toast.error("يرجى اختيار كل من الموجه والمسترشد");
      return;
    }

    if (mentorId === menteeId) {
      toast.error("لا يمكن أن يكون الموجه والمسترشد نفس الموظف");
      return;
    }

    if (!objectiveAr.trim()) {
      toast.error("يرجى تحديد أهداف برنامج التوجيه المهني");
      return;
    }

    try {
      setLoading(true);
      const res = await createMentoringRelationship({
        companyId,
        mentorEmployeeId: mentorId,
        menteeEmployeeId: menteeId,
        objectiveAr,
        focusAreas: focusAreas || undefined,
        startDate,
      });

      if (!res.success) {
        toast.error(res.error || "فشل إطلاق علاقة التوجيه");
        return;
      }

      toast.success("تم تفعيل علاقة التوجيه والإرشاد المهني بنجاح");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">بدء شراكة توجيه مهني (Mentorship)</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                ربط القيادات والخبراء مع الكفاءات الصاعدة لنقل الخبرات
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold">الموجه (Mentor) *</Label>
            <select
              className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
              required
            >
              <option value="">-- اختر الموجه (الخبير/القائد) --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeNo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs font-semibold">المسترشد (Mentee) *</Label>
            <select
              className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              value={menteeId}
              onChange={(e) => setMenteeId(e.target.value)}
              required
            >
              <option value="">-- اختر المسترشد (الموهبة الصاعدة) --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeNo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs font-semibold">تاريخ البدء</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">أهداف الشراكة المهنية *</Label>
            <Input
              placeholder="مثال: تطوير المهارات القيادية وتوسيع الشبكة المهنية"
              value={objectiveAr}
              onChange={(e) => setObjectiveAr(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">المجالات ومحاور التركيز</Label>
            <Textarea
              placeholder="الموضوعات المطروحة للنقاش: اتخاذ القرار، إدارة النزاعات..."
              value={focusAreas}
              onChange={(e) => setFocusAreas(e.target.value)}
              className="mt-1 min-h-[60px]"
            />
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : "تفعيل التوجيه"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
