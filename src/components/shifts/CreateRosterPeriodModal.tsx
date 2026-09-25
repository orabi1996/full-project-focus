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
import { Calendar, AlertCircle } from "lucide-react";
import { useRosterMutations } from "../../lib/domains/shifts";
import { useApp } from "../../lib/context/AppContext";
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
  const { company } = useApp();
  const { createPeriod } = useRosterMutations(companyId);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timezone, setTimezone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setTimezone(company?.timezone || "");
    }
  }, [open, company?.timezone]);

  const hasCompanyTimezone = Boolean(company?.timezone?.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasCompanyTimezone) {
      toast.error("يرجى ضبط المنطقة الزمنية للمنشأة من إعدادات الشركة أولاً.");
      return;
    }
    if (!name.trim()) {
      toast.error("يرجى إدخال اسم فترة الجدولة");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("يرجى تحديد تاريخ بداية ونهاية الفترة");
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
        timezone: company!.timezone.trim(),
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
            فترة الجدولة تحدد نطاق تواريخ توزيع الورديات وتكون مسودة حتى اعتمادها ونشرها رسمياً.
          </DialogDescription>
        </DialogHeader>

        {!hasCompanyTimezone && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium flex items-center gap-2 mt-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>يرجى ضبط المنطقة الزمنية للمنشأة من إعدادات الشركة أولاً.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-bold">اسم فترة الجدولة *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: جدول شهر أكتوبر 2026"
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
            <Label className="text-xs font-bold">المنطقة الزمنية للمنشأة (معتمدة رسمياً) *</Label>
            <Input
              value={timezone || "غير محددة في إعدادات المنشأة"}
              readOnly
              disabled
              className="mt-1 text-xs font-mono bg-muted/50 cursor-not-allowed"
            />
            <span className="text-[10px] text-muted-foreground mt-1 block">
              تُستخرج حصراً من إعدادات المنشأة الرسمية لضمان الدقة والامتثال.
            </span>
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
