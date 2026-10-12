// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 31: CREATE & LAUNCH SURVEY MODAL
// src/components/engagement/CreateSurveyModal.tsx
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
import { Send, Shield, Sparkles } from "lucide-react";
import {
  createSurveyInstance,
  createSurveyTemplate,
  launchSurveyInstance,
} from "../../lib/data/engagement-repository";
import type { SurveyType, AnonymityMode, AudienceTargetType } from "../../lib/domains/engagement";

interface CreateSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
}

export const CreateSurveyModal: React.FC<CreateSurveyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
}) => {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(`SRV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [surveyType, setSurveyType] = useState<SurveyType>("engagement");
  const [anonymityMode, setAnonymityMode] = useState<AnonymityMode>("anonymous");
  const [minGroupSize, setMinGroupSize] = useState(5);
  const [targetType, setTargetType] = useState<AudienceTargetType>("all_company");
  const [launchImmediately, setLaunchImmediately] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleAr.trim()) {
      toast.error("يرجى إدخال عنوان الاستبيان بالعربية");
      return;
    }

    try {
      setLoading(true);

      // Create an underlying default template if needed
      const template = await createSurveyTemplate(companyId, {
        code: `TPL-${code}`,
        titleAr,
        titleEn: titleEn || titleAr,
        surveyType,
        defaultAnonymityMode: anonymityMode,
        estimatedCompletionMinutes: surveyType === "pulse" ? 3 : 7,
        questions: [
          {
            id: crypto.randomUUID(),
            code: "Q1",
            textAr: "ما مدى رضاك العام عن بيئة العمل وثقافة المنشأة؟",
            textEn: "How satisfied are you overall with the workplace culture?",
            category: "culture",
            questionType: "likert_scale",
            scaleConfig: { min: 1, max: 5 },
            isRequired: true,
          },
          {
            id: crypto.randomUUID(),
            code: "Q2",
            textAr: "هل تتلقى الدعم والتوجيه اللازم من مديرك المباشر للنجاح في مهامك؟",
            textEn: "Do you receive adequate support and guidance from your direct manager?",
            category: "manager",
            questionType: "likert_scale",
            scaleConfig: { min: 1, max: 5 },
            isRequired: true,
          },
          {
            id: crypto.randomUUID(),
            code: "Q3",
            textAr: "ما مدى احتمالية ترشيحك لمنشأتنا كمكان عمل مفضل لأصدقائك أو زملائك؟ (0-10)",
            textEn: "How likely are you to recommend our company as a great place to work? (0-10)",
            category: "trust",
            questionType: "enps_0_10",
            scaleConfig: { min: 0, max: 10 },
            isRequired: true,
          },
          {
            id: crypto.randomUUID(),
            code: "Q4",
            textAr: "ما هي المقترحات الإضافية لتحسين تجربة الموظفين وبيئة العمل؟",
            textEn: "What suggestions do you have to improve employee experience?",
            category: "employee_experience",
            questionType: "free_text",
            isRequired: false,
          },
        ],
      });

      // Create survey instance
      const instance = await createSurveyInstance(companyId, {
        code,
        titleAr,
        titleEn: titleEn || titleAr,
        surveyType,
        templateId: template.id,
        anonymityMode,
        minimumReportingGroupSize: minGroupSize,
        targetType,
      });

      if (launchImmediately) {
        await launchSurveyInstance(companyId, instance.id);
        toast.success("تم إنشاء وإطلاق الاستبيان بنجاح لجميع المشمولين");
      } else {
        toast.success("تم إنشاء مسودة الاستبيان بنجاح");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء إنشاء الاستبيان");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <DialogTitle>إطلاق استبيان ارتباط أو نبض جديد</DialogTitle>
          </div>
          <DialogDescription>
            تحديد إعدادات الاستبيان، سياسة السرية، وحد حماية خصوصية المجموعات الصغرى.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>رمز الاستبيان (Code)</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SRV-2026-001"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>نوع الاستبيان</Label>
              <select
                value={surveyType}
                onChange={(e) => setSurveyType(e.target.value as SurveyType)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="engagement">ارتباط وظيفي شامل (Engagement)</option>
                <option value="pulse">استبيان نبض سريع (Pulse)</option>
                <option value="enps">ولاء الموظفين (eNPS)</option>
                <option value="onboarding">تهيئة الموظفين الجدد (Onboarding)</option>
                <option value="manager_effectiveness">تقييم كفاءة القيادة</option>
                <option value="custom">استبيان مخصص</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>عنوان الاستبيان (بالعربية) *</Label>
            <Input
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              placeholder="مثال: استبيان الارتباط الوظيفي ونبض المنشأة لعام 2026"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>العنوان بالإنجليزية</Label>
            <Input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="e.g. Q4 2026 Employee Engagement Pulse Survey"
            />
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border space-y-3">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span>ميثاق السرية وحماية هوية الموظفين</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>نمط الهوية</Label>
                <select
                  value={anonymityMode}
                  onChange={(e) => setAnonymityMode(e.target.value as AnonymityMode)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="anonymous">مجهول الهوية بالكامل (Anonymous Token)</option>
                  <option value="identified">محدد الهوية (Identified)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>حد حجب المجموعات الصغرى (Threshold)</Label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={minGroupSize}
                  onChange={(e) => setMinGroupSize(Number(e.target.value))}
                />
                <span className="text-[11px] text-muted-foreground">
                  يحجب نتائج أي إدارة يقل عدد مشاركيها عن هذا الحد.
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نطاق الجمهور المستهدف</Label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as AudienceTargetType)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="all_company">جميع موظفي المنشأة على رأس العمل</option>
                <option value="department">إدارة محددة</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="launch_now"
                checked={launchImmediately}
                onChange={(e) => setLaunchImmediately(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="launch_now" className="text-sm font-medium cursor-pointer">
                إطلاق الاستبيان فوراً وإنشاء الرموز
              </label>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <Send className="h-4 w-4" />
              {loading ? "جاري المعالجة..." : launchImmediately ? "إنشاء وإطلاق الآن" : "حفظ كمسودة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
