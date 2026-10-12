// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 31: CREATE SURVEY QUESTION MODAL (QUESTION BANK)
// src/components/engagement/CreateQuestionModal.tsx
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
import { HelpCircle, Plus } from "lucide-react";
import { createSurveyQuestion } from "../../lib/data/engagement-repository";
import type { QuestionCategory, QuestionType } from "../../lib/domains/engagement";
import { formatDimensionName } from "../../lib/domains/engagement";

interface CreateQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
}

export const CreateQuestionModal: React.FC<CreateQuestionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
}) => {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(`Q-${Math.floor(1000 + Math.random() * 9000)}`);
  const [textAr, setTextAr] = useState("");
  const [textEn, setTextEn] = useState("");
  const [category, setCategory] = useState<QuestionCategory>("culture");
  const [questionType, setQuestionType] = useState<QuestionType>("likert_scale");
  const [isRequired, setIsRequired] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textAr.trim()) {
      toast.error("يرجى إدخال نص السؤال بالعربية");
      return;
    }

    try {
      setLoading(true);
      await createSurveyQuestion(companyId, {
        code,
        textAr,
        textEn: textEn || textAr,
        category,
        questionType,
        isRequired,
      });

      toast.success("تمت إضافة السؤال بنجاح إلى بنك الأسئلة المؤسسي");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ السؤال");
    } finally {
      setLoading(false);
    }
  };

  const categories: QuestionCategory[] = [
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
    "purpose",
    "compensation_perception",
    "employee_experience",
    "general",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <HelpCircle className="h-5 w-5" />
            <DialogTitle>إضافة سؤال جديد إلى بنك الأسئلة</DialogTitle>
          </div>
          <DialogDescription>
            إضافة سؤال معياري قابل لإعادة الاستخدام في استبيانات النبض والارتباط.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>رمز السؤال (Code)</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Q-CULT-01"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>المحور الاستراتيجي *</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as QuestionCategory)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {formatDimensionName(c).labelAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>نص السؤال (بالعربية) *</Label>
            <Textarea
              rows={2}
              value={textAr}
              onChange={(e) => setTextAr(e.target.value)}
              placeholder="مثال: أشعر بالفخر والاعتزاز بالعمل في هذه المنشأة"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>نص السؤال (بالإنجليزية)</Label>
            <Textarea
              rows={2}
              value={textEn}
              onChange={(e) => setTextEn(e.target.value)}
              placeholder="e.g. I am proud to work for this company"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع السؤال ومقياس الإجابة</Label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as QuestionType)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="likert_scale">مقياس ليكرت الخماسي (1-5)</option>
                <option value="enps_0_10">مقياس صافي الترويج eNPS (0-10)</option>
                <option value="yes_no">نعم / لا (Yes / No)</option>
                <option value="free_text">نص حر / تعليق نوعي</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="is_req"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="is_req" className="text-sm font-medium cursor-pointer">
                إلزامية الإجابة
              </label>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <Plus className="h-4 w-4" />
              {loading ? "جاري الحفظ..." : "إضافة السؤال"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
