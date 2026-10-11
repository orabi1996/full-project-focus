// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: CREATE TALENT DEVELOPMENT ACTION MODAL
// src/components/talent/CreateDevelopmentActionModal.tsx
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
import { Target } from "lucide-react";
import { createTalentDevelopmentAction } from "../../lib/data/talent-repository";
import type {
  TalentDevelopmentActionType,
  TalentDevelopmentActionSource,
} from "../../lib/domains/talent";

interface CreateDevelopmentActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  employeeId: string;
  employeeName: string;
}

export const CreateDevelopmentActionModal: React.FC<CreateDevelopmentActionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  employeeId,
  employeeName,
}) => {
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<TalentDevelopmentActionType>("stretch_assignment");
  const [sourceContext, setSourceContext] = useState<TalentDevelopmentActionSource>("career_gap");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [targetCompletionDate, setTargetCompletionDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleAr.trim() || !titleEn.trim()) {
      toast.error("يرجى إدخال عنوان الإجراء التطويري بالعربية والإنجليزية");
      return;
    }

    try {
      setLoading(true);
      const res = await createTalentDevelopmentAction({
        companyId,
        employeeId,
        actionType,
        sourceContext,
        titleAr,
        titleEn,
        targetCompletionDate: targetCompletionDate || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "فشل تسجيل الإجراء التطويري");
        return;
      }

      toast.success("تم إدراج الإجراء التطويري وربطه بالخطة الفردية للموظف");
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
              <Target className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">إضافة إجراء تطويري للموهبة</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                الموظف: {employeeName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">نوع الإجراء التطويري *</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={actionType}
                onChange={(e) => setActionType(e.target.value as TalentDevelopmentActionType)}
              >
                <option value="stretch_assignment">مهمة توسعية (Stretch Assignment)</option>
                <option value="learning_course">دورة تدريبية متخصصة (Course)</option>
                <option value="mentoring">برنامج توجيه مهني (Mentoring)</option>
                <option value="coaching">جلسات تدريب وتطوير (Coaching)</option>
                <option value="project_exposure">مشاركة في مشروع محوري (Project)</option>
                <option value="temporary_assignment">تكليف مؤقت (Assignment)</option>
                <option value="certification">شهادة مهنية احترافية (Cert)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold">مصدر وسياق الإجراء *</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={sourceContext}
                onChange={(e) => setSourceContext(e.target.value as TalentDevelopmentActionSource)}
              >
                <option value="career_gap">سد فجوة مسار وظيفي</option>
                <option value="succession_readiness">جاهزية تعاقب وظيفي</option>
                <option value="talent_review">مخرجات مراجعة المواهب</option>
                <option value="aspiration">طموح مهني شخصي</option>
                <option value="performance_idp">خطة تطوير فردية IDP</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">عنوان الإجراء (بالعربية) *</Label>
            <Input
              placeholder="مثال: قيادة مبادرة تحسين الأداء المالي للمشاريع"
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">عنوان الإجراء (بالإنجليزية) *</Label>
            <Input
              placeholder="e.g. Lead Project Financial Optimization Initiative"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">تاريخ الإنجاز المستهدف</Label>
            <Input
              type="date"
              value={targetCompletionDate}
              onChange={(e) => setTargetCompletionDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : "حفظ الإجراء التطويري"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
