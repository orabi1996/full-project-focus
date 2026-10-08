import React, { useState } from "react";
import { X, Calendar, User, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/context/AppContext";
import { createOnboardingCase } from "../../lib/data/onboarding-repository";
import type { OnboardingTemplate } from "../../lib/domains/onboarding";

interface CreateOnboardingCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  templates: OnboardingTemplate[];
}

export const CreateOnboardingCaseModal: React.FC<CreateOnboardingCaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  templates,
}) => {
  const { employees, company } = useApp();
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [joiningDate, setJoiningDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [selectedBuddyId, setSelectedBuddyId] = useState("");
  const [welcomeNotes, setWelcomeNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Potential candidates for onboarding: draft or recently created employees
  const availableEmployees = employees.filter(
    (e) => e.status === "draft" || e.status === "probation" || !e.status,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      toast.error("يرجى اختيار الموظف المطلوب بدء إجراءات تهيئته");
      return;
    }
    if (!joiningDate) {
      toast.error("يرجى تحديد تاريخ مباشرة العمل");
      return;
    }

    const companyId = company?.id || employees[0]?.subsidiaryId || "default";

    try {
      setIsSubmitting(true);
      const res = await createOnboardingCase({
        companyId,
        employeeId: selectedEmpId,
        joiningDate,
        templateId: selectedTemplateId || undefined,
        managerId: selectedManagerId || undefined,
        buddyId: selectedBuddyId || undefined,
        welcomeNotes: welcomeNotes || undefined,
      });

      if (!res.ok) {
        if (res.error === "duplicate_onboarding_case") {
          toast.error("تنبيه: يوجد بالفعل ملف تهيئة نشط لهذا الموظف ولا يمكن تكراره");
        } else {
          toast.error(res.message || "تعذر إنشاء ملف التهيئة");
        }
        return;
      }

      toast.success("تم إنشاء ملف التهيئة وجدولة المهام وفترة التجربة بنجاح");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">بدء رحلة تهيئة موظف جديد</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              إنشاء ملف التهيئة المعتمد وتفعيل المهام التحضيرية وفترة التجربة
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              الموظف المعني <span className="text-destructive">*</span>
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => {
                setSelectedEmpId(e.target.value);
                const emp = employees.find((x) => x.id === e.target.value);
                if (emp?.managerId) setSelectedManagerId(emp.managerId);
              }}
              className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden"
              required
            >
              <option value="">-- اختر الموظف --</option>
              {availableEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstNameAr} {e.lastNameAr} ({e.jobTitleAr || "موظف جديد"}) - {e.employeeNo || "مسودة"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                تاريخ المباشرة (Day 1) <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden"
                  required
                />
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                نموذج التهيئة
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden"
              >
                <option value="">النموذج القياسي للشركة</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameAr} (الإصدار {t.currentVersion})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                المدير المباشر
              </label>
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden"
              >
                <option value="">-- اختياري --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstNameAr} {e.lastNameAr} ({e.jobTitleAr || "إداري"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                المرشد الزميل (Buddy)
              </label>
              <select
                value={selectedBuddyId}
                onChange={(e) => setSelectedBuddyId(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden"
              >
                <option value="">-- اختياري --</option>
                {employees
                  .filter((e) => e.id !== selectedEmpId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstNameAr} {e.lastNameAr}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              ملاحظات أو رسالة ترحيب مخصصة
            </label>
            <textarea
              rows={2}
              value={welcomeNotes}
              onChange={(e) => setWelcomeNotes(e.target.value)}
              placeholder="مثال: يرجى تجهيز حاسب محمول فئة هندسية وتنسيق جلسة ترحيب مع فريق التطوير"
              className="w-full p-3 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden resize-none"
            />
          </div>

          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              يقوم النظام تلقائياً بإنشاء مهام ما قبل المباشرة (Pre-Onboarding)، والتحقق من منع تكرار الحالات، واحتساب جدول فترة التجربة ومواعيد المراجعة بدقة.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                "جاري الإنشاء والجدولة..."
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  بدء إجراءات التهيئة
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
