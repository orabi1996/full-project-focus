// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 29: CREATE COURSE MODAL
// src/components/learning/CreateCourseModal.tsx
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
import { BookOpen, CheckCircle2 } from "lucide-react";
import { createLearningItem } from "../../lib/data/learning-repository";
import type { TrainingProvider } from "../../lib/domains/learning";

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  providers: TrainingProvider[];
}

export const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  providers,
}) => {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [category, setCategory] = useState("functional");
  const [deliveryMethod, setDeliveryMethod] = useState("virtual");
  const [itemType, setItemType] = useState("course");
  const [durationHours, setDurationHours] = useState<number>(4);
  const [providerId, setProviderId] = useState("");
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [isMandatory, setIsMandatory] = useState(false);
  const [descriptionAr, setDescriptionAr] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !titleAr.trim() || !titleEn.trim()) {
      toast.error("يرجى ملء جميع الحقول الإلزامية (الرمز والاسم بالعربية والإنجليزية)");
      return;
    }

    setLoading(true);
    try {
      const res = await createLearningItem({
        companyId,
        code: code.trim().toUpperCase(),
        titleAr: titleAr.trim(),
        titleEn: titleEn.trim(),
        category,
        deliveryMethod,
        itemType,
        durationHours: Number(durationHours) || 1,
        providerId: providerId || undefined,
        estimatedCost: Number(estimatedCost) || 0,
        isMandatory,
        descriptionAr: descriptionAr.trim() || undefined,
        targetAudience: targetAudience.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "فشل إنشاء الدورة التدريبية");
        return;
      }

      toast.success("تم إضافة البرنامج / الدورة التدريبية بنجاح");
      onSuccess();
      onClose();
    } catch {
      toast.error("حدث خطأ أثناء حفظ الدورة التدريبية");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">إضافة برنامج أو دورة تدريبية جديدة</DialogTitle>
              <DialogDescription>
                إدراج دورة تدريبية أو ورشة عمل في الدليل العام للتعليم والتطوير
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">رمز الدورة *</Label>
              <Input
                placeholder="CRS-2026-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="mt-1 font-mono uppercase"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">نوع العنصر التعليمي</Label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
              >
                <option value="course">دورة تدريبية (Course)</option>
                <option value="workshop">ورشة عمل (Workshop)</option>
                <option value="program">برنامج تدريبي متكامل (Program)</option>
                <option value="webinar">ندوة رقمية (Webinar)</option>
                <option value="orientation">برنامج توجيهي (Orientation)</option>
                <option value="certification_preparation">إعداد شهادة احترافية</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">التصنيف</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
              >
                <option value="functional">تخصصي / وظيفي</option>
                <option value="technical">تقني / فني</option>
                <option value="leadership">قيادي وإشرافي</option>
                <option value="compliance">امتثال وتشريعات</option>
                <option value="safety">سلامة وصحة مهنية</option>
                <option value="digital">مهارات رقمية</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">عنوان الدورة (بالعربية) *</Label>
              <Input
                placeholder="مثال: أسس القيادة الاستراتيجية"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">عنوان الدورة (بالإنجليزية) *</Label>
              <Input
                placeholder="Strategic Leadership Fundamentals"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                required
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">طريقة التقديم</Label>
              <select
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
              >
                <option value="virtual">عن بعد (Virtual)</option>
                <option value="classroom">حضوري (Classroom)</option>
                <option value="blended">مدمج (Blended)</option>
                <option value="self_paced">تعلم ذاتي (Self-Paced)</option>
                <option value="external">خارجي (External)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">المدة (بالساعات) *</Label>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                required
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">التكلفة التقديرية (ر.س)</Label>
              <Input
                type="number"
                min={0}
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">الجهة التدريبية / المزود</Label>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
              >
                <option value="">تدريب داخلي بالشركة</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} ({p.providerType === "internal" ? "داخلي" : "خارجي"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">الفئة المستهدفة</Label>
              <Input
                placeholder="مثال: مديرو الإدارات ورؤساء الفرق"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold text-muted-foreground">نبذة عن البرنامج والمحاور</Label>
            <Textarea
              rows={3}
              placeholder="وصف الأهداف التدريبية والمخرجات المتوقعة..."
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              className="mt-1 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isMandatory"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="rounded border-input h-4 w-4 text-primary"
            />
            <Label htmlFor="isMandatory" className="text-sm font-semibold cursor-pointer">
              تدريب إلزامي بموجب سياسات الامتثال (Mandatory Compliance Training)
            </Label>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "جاري الحفظ..." : "حفظ الدورة التدريبية"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
