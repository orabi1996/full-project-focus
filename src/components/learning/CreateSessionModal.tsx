// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 29: CREATE TRAINING SESSION MODAL
// src/components/learning/CreateSessionModal.tsx
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
import { Calendar, Users, CheckCircle2 } from "lucide-react";
import { createTrainingSession } from "../../lib/data/learning-repository";
import type { LearningItem } from "../../lib/domains/learning";

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  courses: LearningItem[];
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  courses,
}) => {
  const [loading, setLoading] = useState(false);
  const [learningItemId, setLearningItemId] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [virtualUrl, setVirtualUrl] = useState("");
  const [capacity, setCapacity] = useState<number>(20);
  const [costPerSeat, setCostPerSeat] = useState<number>(0);
  const [registrationDeadline, setRegistrationDeadline] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learningItemId || !sessionCode.trim() || !startDate || !endDate) {
      toast.error("يرجى اختيار الدورة وتحديد رمز الجلسة وتواريخ البداية والنهاية");
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      toast.error("تاريخ ونهاية الجلسة يجب أن يكون بعد تاريخ البداية");
      return;
    }

    setLoading(true);
    try {
      const res = await createTrainingSession({
        companyId,
        learningItemId,
        sessionCode: sessionCode.trim().toUpperCase(),
        trainerName: trainerName.trim() || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        location: location.trim() || undefined,
        virtualUrl: virtualUrl.trim() || undefined,
        capacity: Number(capacity) || 20,
        costPerSeat: Number(costPerSeat) || 0,
        registrationDeadline: registrationDeadline || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "فشل جدولة الجلسة التدريبية");
        return;
      }

      toast.success("تمت جدولة الجلسة التدريبية بنجاح");
      onSuccess();
      onClose();
    } catch {
      toast.error("حدث خطأ أثناء جدولة الجلسة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">جدولة جلسة تدريبية جديدة</DialogTitle>
              <DialogDescription>
                تحديد المواعيد، القاعة أو الرابط الرقمي، والحد الأقصى للمقاعد
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-bold text-muted-foreground">الدورة التدريبية *</Label>
            <select
              value={learningItemId}
              onChange={(e) => {
                setLearningItemId(e.target.value);
                const selected = courses.find((c) => c.id === e.target.value);
                if (selected && !sessionCode) {
                  setSessionCode(`${selected.code}-S1`);
                  setCostPerSeat(selected.estimatedCost || 0);
                }
              }}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
            >
              <option value="">-- اختر الدورة التدريبية --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.code}] {c.titleAr} ({c.durationHours} ساعة)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">رمز الجلسة *</Label>
              <Input
                placeholder="CRS-01-S01"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value)}
                required
                className="mt-1 font-mono uppercase"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">اسم المدرب / المحاضر</Label>
              <Input
                placeholder="مثال: د. إبراهيم الزهراني"
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">تاريخ ووقت البداية *</Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">تاريخ ووقت النهاية *</Label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">السعة (عدد المقاعد) *</Label>
              <Input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                required
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">تكلفة المقعد (ر.س)</Label>
              <Input
                type="number"
                min={0}
                value={costPerSeat}
                onChange={(e) => setCostPerSeat(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">آخر موعد للتسجيل</Label>
              <Input
                type="date"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">الموقع / القاعة</Label>
              <Input
                placeholder="مثال: قاعة التدريب الرئيسية - الدور 3"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">رابط الجلسة الرقمية (Teams / Zoom)</Label>
              <Input
                placeholder="https://teams.microsoft.com/..."
                value={virtualUrl}
                onChange={(e) => setVirtualUrl(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "جاري الحفظ..." : "جدولة الجلسة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
