// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: CREATE INTERNAL OPPORTUNITY MODAL
// src/components/talent/CreateInternalOpportunityModal.tsx
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
import { Briefcase } from "lucide-react";
import { createInternalOpportunity } from "../../lib/data/talent-repository";
import type { InternalOpportunityType } from "../../lib/domains/talent";

interface CreateInternalOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  departments: Array<{ id: string; name: string }>;
}

export const CreateInternalOpportunityModal: React.FC<CreateInternalOpportunityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  departments,
}) => {
  const [loading, setLoading] = useState(false);
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [opportunityType, setOpportunityType] = useState<InternalOpportunityType>("open_position");
  const [departmentId, setDepartmentId] = useState("");
  const [targetGrade, setTargetGrade] = useState("G07");
  const [durationMonths, setDurationMonths] = useState<number | undefined>(undefined);
  const [descriptionAr, setDescriptionAr] = useState("");
  const [deadline, setDeadline] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleAr.trim() || !titleEn.trim()) {
      toast.error("يرجى إدخال عنوان الفرصة باللغتين العربية والإنجليزية");
      return;
    }

    try {
      setLoading(true);
      const res = await createInternalOpportunity({
        companyId,
        opportunityType,
        titleAr,
        titleEn,
        departmentId: departmentId || undefined,
        targetGrade: targetGrade || undefined,
        durationMonths: durationMonths || undefined,
        descriptionAr: descriptionAr || undefined,
        applicationDeadline: deadline || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "فشل نشر الفرصة الداخلية");
        return;
      }

      toast.success("تم نشر الفرصة الوظيفية الداخلية بنجاح في سوق التنقل الداخلي");
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">نشر فرصة تنقل وظيفي داخلي</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                إتاحة الفرص والشواغر لموظفي المنشأة لتعزيز الحراك الداخلي
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">نوع الفرصة *</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={opportunityType}
                onChange={(e) => setOpportunityType(e.target.value as InternalOpportunityType)}
              >
                <option value="open_position">شاغر وظيفي دائم (Open Position)</option>
                <option value="temporary_assignment">تكليف مؤقت (Temporary Assignment)</option>
                <option value="project_assignment">مهمة مشروع تطويري (Project)</option>
                <option value="developmental_secondment">إعارة تطويرية (Secondment)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold">المرتبة المستهدفة (Grade)</Label>
              <Input
                placeholder="مثال: G07"
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
                className="mt-1 font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">عنوان الفرصة (بالعربية) *</Label>
            <Input
              placeholder="مثال: أخصائي أول تميز مؤسسي وتخطيط"
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">عنوان الفرصة (بالإنجليزية) *</Label>
            <Input
              placeholder="e.g. Senior Corporate Excellence Specialist"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">الإدارة / القسم</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">-- عامة / متعددة --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold">آخر موعد للتقديم</Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {opportunityType !== "open_position" && (
            <div>
              <Label className="text-xs font-semibold">مدة التكليف (بالأشهر)</Label>
              <Input
                type="number"
                min={1}
                placeholder="مثال: 6 أشهر"
                value={durationMonths || ""}
                onChange={(e) => setDurationMonths(Number(e.target.value) || undefined)}
                className="mt-1"
              />
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold">تفاصيل الفرصة والمسؤوليات</Label>
            <Textarea
              placeholder="المسؤوليات الرئيسية، المخرجات المتوقعة، المهارات المطلوبة..."
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              className="mt-1 min-h-[70px]"
            />
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري النشر..." : "نشر الفرصة الآن"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
