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
import { Calendar, Layers } from "lucide-react";
import { useRosterMutations } from "../../lib/domains/shifts";
import { toast } from "sonner";

interface CreateRosterPeriodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  onSuccess?: (createdId: string) => void;
}

export const CreateRosterPeriodModal: React.FC<CreateRosterPeriodModalProps> = ({
  open,
  onOpenChange,
  companyId,
  onSuccess,
}) => {
  const { createPeriod } = useRosterMutations(companyId);

  // Defaults: upcoming week (Sunday to Thursday or Saturday)
  const today = new Date();
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + ((7 - today.getDay()) % 7 || 7));
  const nextSaturday = new Date(nextSunday);
  nextSaturday.setDate(nextSunday.getDate() + 6);

  const [name, setName] = useState(`جدول العمل - ${nextSunday.toISOString().substring(0, 10)}`);
  const [startDate, setStartDate] = useState(nextSunday.toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState(nextSaturday.toISOString().substring(0, 10));
  const [timezone, setTimezone] = useState("Asia/Riyadh");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("يرجى إدخال اسم فترة الجدولة");
      return;
    }
    if (startDate > endDate) {
      toast.error("تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createPeriod({
        companyId,
        name: name.trim(),
        startDate,
        endDate,
        timezone,
        notes: notes.trim() || undefined,
        status: "draft",
      });

      if (created) {
        onOpenChange(false);
        onSuccess?.(created.id);
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
            <Calendar className="h-5 w-5 text-primary" />
            إنشاء فترة جدولة عمل جديدة (Roster Period)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            فترة الجدولة تحدد نطاق تواريخ توزيع الورديات على موظفي المنشأة وتكون مسودة حتى اعتمادها ونشرها رسمياً.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-bold">اسم فترة الجدولة *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: جدول الأسبوع الأول - أكتوبر 2026"
              className="mt-1 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">تاريخ البداية *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 text-xs font-mono"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-bold">تاريخ النهاية *</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 text-xs font-mono"
                required
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">المنطقة الزمنية المعتمدة</Label>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 text-xs font-mono"
              placeholder="Asia/Riyadh"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-bold">ملاحظات أو توجيهات الجدولة</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="توجيهات لفرق العمل أو إشارات خاصة..."
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
              {isSubmitting ? "جاري الإنشاء..." : "إنشاء الفترة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
