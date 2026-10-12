// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 31: CREATE ENGAGEMENT ACTION PLAN MODAL
// src/components/engagement/CreateActionPlanModal.tsx
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
import { Target, Plus, Trash2 } from "lucide-react";
import { createEngagementActionPlan } from "../../lib/data/engagement-repository";
import type { QuestionCategory, SurveyInstance } from "../../lib/domains/engagement";
import { formatDimensionName } from "../../lib/domains/engagement";

interface CreateActionPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  surveys: SurveyInstance[];
  departments: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; name: string }>;
}

export const CreateActionPlanModal: React.FC<CreateActionPlanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  surveys,
  departments,
  employees,
}) => {
  const [loading, setLoading] = useState(false);
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [surveyId, setSurveyId] = useState("");
  const [dimension, setDimension] = useState<QuestionCategory>("manager");
  const [departmentId, setDepartmentId] = useState("");
  const [ownerEmployeeId, setOwnerEmployeeId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState("");
  const [successMeasure, setSuccessMeasure] = useState("");
  const [actionItems, setActionItems] = useState<Array<{ titleAr: string; titleEn: string; dueDate?: string }>>([
    { titleAr: "عقد ورشة عمل توعوية مع قيادات الإدارة", titleEn: "Conduct leadership workshop", dueDate: "" },
  ]);

  const handleAddItem = () => {
    setActionItems([...actionItems, { titleAr: "", titleEn: "", dueDate: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setActionItems(actionItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const updated = [...actionItems];
    (updated[index] as any)[field] = value;
    setActionItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleAr.trim()) {
      toast.error("يرجى إدخال عنوان خطة العمل بالعربية");
      return;
    }

    try {
      setLoading(true);
      await createEngagementActionPlan(companyId, {
        surveyId: surveyId || undefined,
        titleAr,
        titleEn: titleEn || titleAr,
        dimension,
        departmentId: departmentId || undefined,
        ownerEmployeeId: ownerEmployeeId || undefined,
        description,
        targetDate: targetDate || undefined,
        successMeasure,
        items: actionItems.filter((i) => i.titleAr.trim() !== ""),
      });

      toast.success("تم اعتماد خطة عمل التحسين وربط بنودها التنفيذية بنجاح");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ خطة العمل");
    } finally {
      setLoading(false);
    }
  };

  const dimensionsList: QuestionCategory[] = [
    "leadership",
    "manager",
    "communication",
    "culture",
    "recognition",
    "growth",
    "learning",
    "wellbeing",
    "teamwork",
    "work_environment",
    "trust",
    "compensation_perception",
    "employee_experience",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Target className="h-5 w-5" />
            <DialogTitle>إنشاء خطة عمل معالجة وتحسين الارتباط الوظيفي</DialogTitle>
          </div>
          <DialogDescription>
            ربط مخرجات وملاحظات الاستبيان بمبادرات ومهام محددة للمدراء وفرق العمل.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>عنوان خطة العمل (بالعربية) *</Label>
            <Input
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              placeholder="مثال: مبادرة تعزيز التواصل والشفافية في إدارة التقنية"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الاستبيان المرتبط (اختياري)</Label>
              <select
                value={surveyId}
                onChange={(e) => setSurveyId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">-- خطة عامة مستقلة --</option>
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titleAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>محور التحسين الأساسي *</Label>
              <select
                value={dimension}
                onChange={(e) => setDimension(e.target.value as QuestionCategory)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {dimensionsList.map((dim) => (
                  <option key={dim} value={dim}>
                    {formatDimensionName(dim).labelAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الإدارة المستهدفة</Label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">-- جميع الإدارات --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>المسؤول عن المتابعة (Plan Owner)</Label>
              <select
                value={ownerEmployeeId}
                onChange={(e) => setOwnerEmployeeId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">-- حدد المسؤول --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>تاريخ الإنجاز المستهدف</Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>مقياس النجاح (Success Metric)</Label>
              <Input
                value={successMeasure}
                onChange={(e) => setSuccessMeasure(e.target.value)}
                placeholder="مثال: زيادة رضا المحور بمقدار +15 نقطة"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>وصف المبادرة والتفاصيل</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف المشكلة المحددة والحل المقترح..."
              className="resize-none"
            />
          </div>

          {/* Action Items List */}
          <div className="p-3 bg-muted/40 rounded-lg border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground">مهام وإجراءات التنفيذ</span>
              <Button type="button" variant="ghost" size="sm" onClick={handleAddItem} className="gap-1 h-7 text-xs">
                <Plus className="h-3.5 w-3.5" />
                إضافة مهمة
              </Button>
            </div>

            {actionItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={item.titleAr}
                  onChange={(e) => handleItemChange(idx, "titleAr", e.target.value)}
                  placeholder="وصف المهمة التنفيذية..."
                  className="flex-1 h-9 text-xs"
                />
                <Input
                  type="date"
                  value={item.dueDate || ""}
                  onChange={(e) => handleItemChange(idx, "dueDate", e.target.value)}
                  className="w-36 h-9 text-xs"
                />
                {actionItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive"
                    onClick={() => handleRemoveItem(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <Target className="h-4 w-4" />
              {loading ? "جاري الحفظ..." : "حفظ واعتماد الخطة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
