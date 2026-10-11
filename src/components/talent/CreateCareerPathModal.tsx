// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: CREATE CAREER PATH MODAL
// src/components/talent/CreateCareerPathModal.tsx
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
import { GitFork, Plus, Trash2 } from "lucide-react";
import { createCareerPath } from "../../lib/data/talent-repository";
import type { PathType } from "../../lib/domains/talent";

interface CreateCareerPathModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
}

export const CreateCareerPathModal: React.FC<CreateCareerPathModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
}) => {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [pathType, setPathType] = useState<PathType>("vertical");
  const [jobFamily, setJobFamily] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");

  const [steps, setSteps] = useState<
    Array<{
      stepOrder: number;
      jobTitleAr: string;
      jobTitleEn: string;
      targetGrade: string;
      minTenureMonths: number;
      requiredPerformanceRating: number;
    }>
  >([
    {
      stepOrder: 1,
      jobTitleAr: "أخصائي مبتدئ",
      jobTitleEn: "Associate Specialist",
      targetGrade: "G05",
      minTenureMonths: 12,
      requiredPerformanceRating: 3.0,
    },
    {
      stepOrder: 2,
      jobTitleAr: "أخصائي أول",
      jobTitleEn: "Senior Specialist",
      targetGrade: "G07",
      minTenureMonths: 24,
      requiredPerformanceRating: 3.5,
    },
  ]);

  const addStep = () => {
    const nextOrder = steps.length + 1;
    setSteps([
      ...steps,
      {
        stepOrder: nextOrder,
        jobTitleAr: "",
        jobTitleEn: "",
        targetGrade: `G0${nextOrder + 5}`,
        minTenureMonths: 18,
        requiredPerformanceRating: 3.5,
      },
    ]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const updated = steps.filter((_, i) => i !== index).map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
    setSteps(updated);
  };

  const updateStepField = (index: number, field: string, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !titleAr.trim() || !titleEn.trim()) {
      toast.error("يرجى إدخال رمز المسار واسمه باللغتين العربية والإنجليزية");
      return;
    }

    for (const step of steps) {
      if (!step.jobTitleAr.trim()) {
        toast.error(`يرجى تحديد المسمى الوظيفي للمرحلة ${step.stepOrder}`);
        return;
      }
    }

    try {
      setLoading(true);
      const res = await createCareerPath({
        companyId,
        code,
        titleAr,
        titleEn,
        pathType,
        jobFamily: jobFamily || undefined,
        descriptionAr: descriptionAr || undefined,
        descriptionEn: descriptionEn || undefined,
        steps,
      });

      if (!res.success) {
        toast.error(res.error || "فشل إنشاء المسار الوظيفي");
        return;
      }

      toast.success("تم إنشاء المسار الوظيفي وتحديد معايير الانتقال بنجاح");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <GitFork className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">تصميم مسار وظيفي مهني جديد</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                تحديد تتابع المسميات الوظيفية ومعايير الانتقال بين المحطات
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">رمز المسار (Code) *</Label>
              <Input
                placeholder="مثال: PATH-HR-OPS"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 font-mono uppercase"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">نوع المسار *</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={pathType}
                onChange={(e) => setPathType(e.target.value as PathType)}
              >
                <option value="vertical">مسار رأسي (ترقية قياسية)</option>
                <option value="lateral">مسار أفقي (توسيع الخبرات)</option>
                <option value="cross_functional">مسار متعدد التخصصات</option>
                <option value="leadership">مسار قيادي وتوجيهي</option>
                <option value="specialist">مسار فني تخصصي (خبير)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">اسم المسار (بالعربية) *</Label>
              <Input
                placeholder="مثال: مسار التميز في العمليات والموارد البشرية"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">اسم المسار (بالإنجليزية) *</Label>
              <Input
                placeholder="e.g. HR Operations Excellence Track"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">العائلة الوظيفية (Job Family)</Label>
            <Input
              placeholder="مثال: الموارد البشرية والعمليات الإدارية"
              value={jobFamily}
              onChange={(e) => setJobFamily(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">الوصف والشروط العامة</Label>
            <Textarea
              placeholder="ملاحظات حول متطلبات التدرج ضمن هذا المسار..."
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              className="mt-1 min-h-[60px]"
            />
          </div>

          {/* Steps Section */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <GitFork className="h-4 w-4 text-primary" />
                محطات وتدرج المسار (Milestone Steps)
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addStep} className="gap-1 text-xs">
                <Plus className="h-3 w-3" />
                إضافة محطة
              </Button>
            </div>

            <div className="space-y-2.5">
              {steps.map((st, idx) => (
                <div key={idx} className="p-2.5 bg-background border rounded-md grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-1 text-center font-bold text-xs text-muted-foreground">
                    #{st.stepOrder}
                  </div>
                  <div className="col-span-4">
                    <Input
                      placeholder="المسمى بالعربية *"
                      value={st.jobTitleAr}
                      onChange={(e) => updateStepField(idx, "jobTitleAr", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="المرتبة (G05)"
                      value={st.targetGrade}
                      onChange={(e) => updateStepField(idx, "targetGrade", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="الأقدمية (شهر)"
                      title="الحد الأدنى للأقدمية بالأشهر"
                      value={st.minTenureMonths}
                      onChange={(e) => updateStepField(idx, "minTenureMonths", Number(e.target.value))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="التقييم المطلوب"
                      title="التقييم الأدنى المطلوب (من 5.0)"
                      value={st.requiredPerformanceRating}
                      onChange={(e) => updateStepField(idx, "requiredPerformanceRating", Number(e.target.value))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStep(idx)}
                      disabled={steps.length <= 1}
                      className="h-7 w-7 text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : "حفظ المسار الوظيفي"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
