// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 29: CREATE SKILL MODAL
// src/components/learning/CreateSkillModal.tsx
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
import { Award, CheckCircle2 } from "lucide-react";
import { createSkill } from "../../lib/data/learning-repository";

interface CreateSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
}

export const CreateSkillModal: React.FC<CreateSkillModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
}) => {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [category, setCategory] = useState("functional");
  const [proficiencyScaleType, setProficiencyScaleType] = useState("1_to_5");
  const [descriptionAr, setDescriptionAr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !nameAr.trim() || !nameEn.trim()) {
      toast.error("يرجى إدخال الرمز واسم المهارة بالعربية والإنجليزية");
      return;
    }

    setLoading(true);
    try {
      const res = await createSkill({
        companyId,
        code: code.trim().toUpperCase(),
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        category,
        proficiencyScaleType,
        descriptionAr: descriptionAr.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "فشل إنشاء المهارة في الدليل");
        return;
      }

      toast.success("تم إضافة المهارة إلى دليل المهارات بنجاح");
      onSuccess();
      onClose();
    } catch {
      toast.error("حدث خطأ أثناء حفظ المهارة");
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
              <Award className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">إضافة مهارة جديدة لدليل المنظمة</DialogTitle>
              <DialogDescription>
                تعريف مهارة معيارية وتحديد تصنيفها ومقياس الإتقان المعتمد
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">رمز المهارة *</Label>
              <Input
                placeholder="SKL-FIN-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="mt-1 font-mono uppercase"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">التصنيف *</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
              >
                <option value="technical">تقنية / برمجية (Technical)</option>
                <option value="functional">وظيفية / تخصصية (Functional)</option>
                <option value="behavioral">سلوكية (Behavioral)</option>
                <option value="leadership">قيادية وإشرافية (Leadership)</option>
                <option value="digital">رقمية وتحليل بيانات (Digital)</option>
                <option value="language">لغات وتواصل (Language)</option>
                <option value="safety">سلامة وصحة مهنية (Safety)</option>
                <option value="compliance">امتثال وحوكمة (Compliance)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">اسم المهارة (بالعربية) *</Label>
              <Input
                placeholder="مثال: التحليل المالي المتقدم"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">اسم المهارة (بالإنجليزية) *</Label>
              <Input
                placeholder="Financial Analysis"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                required
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold text-muted-foreground">مقياس الإتقان (Proficiency Scale)</Label>
            <select
              value={proficiencyScaleType}
              onChange={(e) => setProficiencyScaleType(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
            >
              <option value="1_to_5">مقياس خماسي 1-5 (إدراك، أساسي، ممارس، متقدم، خبير)</option>
              <option value="1_to_3">مقياس ثلاثي 1-3 (مبتدئ، متوسط، محترف)</option>
              <option value="binary">ثنائي (متقن / غير متقن)</option>
            </select>
          </div>

          <div>
            <Label className="text-xs font-bold text-muted-foreground">الوصف والمؤشرات السلوكية</Label>
            <Textarea
              rows={3}
              placeholder="وصف مختصر لمعايير قياس المهارة وتطبيقاتها..."
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              className="mt-1 resize-none"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "جاري الحفظ..." : "حفظ المهارة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
