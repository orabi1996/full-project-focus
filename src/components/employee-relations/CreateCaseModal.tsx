// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: CREATE ER CASE / GRIEVANCE MODAL
// src/components/employee-relations/CreateCaseModal.tsx
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
import { Shield, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";
import { createErCaseRecord } from "../../lib/data/employee-relations-repository";
import type {
  ErCaseType,
  ErConfidentialityLevel,
  ErSeverity,
} from "../../lib/domains/employee-relations";
import { useEmployees } from "../../lib/domains/employees";

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
}

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
}) => {
  const { employees } = useEmployees();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [caseType, setCaseType] = useState<ErCaseType>("grievance");
  const [confidentialityLevel, setConfidentialityLevel] = useState<ErConfidentialityLevel>("standard_hr");
  const [severity, setSeverity] = useState<ErSeverity>("medium");
  const [subjectEmployeeId, setSubjectEmployeeId] = useState("");
  const [complainantEmployeeId, setComplainantEmployeeId] = useState("");
  const [isAnonymousComplainant, setIsAnonymousComplainant] = useState(false);
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split("T")[0]);
  const [targetResolutionDays, setTargetResolutionDays] = useState(14);
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("يرجى إدخال عنوان القضية أو التظلم");
      return;
    }
    if (!description.trim()) {
      toast.error("يرجى كتابة تفاصيل ووقائع القضية");
      return;
    }

    try {
      setLoading(true);
      const res = await createErCaseRecord({
        companyId,
        title: title.trim(),
        description: description.trim(),
        caseType,
        confidentialityLevel,
        severity,
        subjectEmployeeId: subjectEmployeeId || undefined,
        complainantEmployeeId: complainantEmployeeId || undefined,
        isAnonymousComplainant,
        incidentDate,
        targetResolutionDays,
      });

      if (res && res.success) {
        toast.success(`تم قيد القضية بنجاح برقم مرجعي: ${res.case_number}`);
        onSuccess();
        onClose();
        // Reset form
        setTitle("");
        setDescription("");
        setSubjectEmployeeId("");
        setComplainantEmployeeId("");
        setIsAnonymousComplainant(false);
      } else {
        toast.error(res?.error || "فشل قيد القضية، يرجى التحقق من المدخلات");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع أثناء قيد القضية");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">تسجيل قضية / تظلم / واقعة جديدة</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                منظومة قيد القضايا العمالية والتظلمات مع ضبط مستويات السرية وحماية الهوية
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-semibold">
              عنوان البلاغ / القضية <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="مثال: تظلم بشأن تقييم الأداء السنوي أو شكوى بيئة عمل"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="text-sm"
            />
          </div>

          {/* Grid: Type & Confidentiality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">تصنيف القضية / البلاغ</Label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={caseType}
                onChange={(e) => setCaseType(e.target.value as ErCaseType)}
              >
                <option value="grievance">تظلم موظف (Grievance)</option>
                <option value="employee_complaint">شكوى موظف (Employee Complaint)</option>
                <option value="manager_complaint">شكوى من مدير (Manager Complaint)</option>
                <option value="workplace_incident">حادثة في بيئة العمل (Incident)</option>
                <option value="policy_violation">مخالفة سياسات المنشأة (Policy Violation)</option>
                <option value="misconduct">سوء سلوك مهني (Misconduct)</option>
                <option value="attendance_discipline">مخالفة انضباط وحضور متكررة (Attendance)</option>
                <option value="behavioral_issue">مشكلة سلوكية (Behavioral)</option>
                <option value="workplace_conflict">نزاع بيئة عمل (Workplace Conflict)</option>
                <option value="harassment_allegation">ادعاء تحرش / مضايقة (Harassment Allegation)</option>
                <option value="safety_incident">مخالفة سلامة وصحة مهنية (Safety)</option>
                <option value="ethics_concern">اشتباه أخلاقي ونزاهة (Ethics Concern)</option>
                <option value="performance_conduct_issue">تعثر أداء متصل بالسلوك (Performance Conduct)</option>
                <option value="other">أخرى (Other)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">مستوى السرية والوصول</Label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={confidentialityLevel}
                onChange={(e) => setConfidentialityLevel(e.target.value as ErConfidentialityLevel)}
              >
                <option value="standard_hr">موارد بشرية قياسي (Standard HR)</option>
                <option value="restricted_hr">مقيد للجنة التحقيق فقط (Restricted HR)</option>
                <option value="legal_sensitive">حساس قانونياً (Legal Sensitive)</option>
                <option value="highly_confidential">سري للغاية ومحمي (Highly Confidential)</option>
              </select>
            </div>
          </div>

          {/* Grid: Severity & SLA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">درجة الأهمية / الخطورة</Label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as ErSeverity)}
              >
                <option value="low">منخفضة (Low)</option>
                <option value="medium">متوسطة (Medium)</option>
                <option value="high">عالية (High)</option>
                <option value="critical">حرجة للغاية (Critical)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">تاريخ الواقعة / المخالفة</Label>
              <Input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">المهلة المستهدفة للحل (أيام SLA)</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={targetResolutionDays}
                onChange={(e) => setTargetResolutionDays(parseInt(e.target.value) || 14)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Grid: Subject Employee & Complainant */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الموظف المعني / المشكو في حقه</Label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={subjectEmployeeId}
                onChange={(e) => setSubjectEmployeeId(e.target.value)}
              >
                <option value="">-- اختياري: حدد الموظف المعني --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">مقدم الشكوى / المتظلم</Label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={complainantEmployeeId}
                onChange={(e) => setComplainantEmployeeId(e.target.value)}
              >
                <option value="">-- اختياري: حدد مقدم الشكوى --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Anonymity Checkbox */}
          {complainantEmployeeId && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/50 border border-border">
              <input
                type="checkbox"
                id="isAnonymous"
                checked={isAnonymousComplainant}
                onChange={(e) => setIsAnonymousComplainant(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <label htmlFor="isAnonymous" className="text-xs font-medium cursor-pointer text-foreground">
                حماية هوية الشاكي (Whistleblower Protection): حجب الاسم عن أطراف التحقيق غير المصرح لهم
              </label>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">
              تفاصيل ووقائع القضية / التظلم <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="description"
              rows={4}
              placeholder="اكتب شرحاً دقيقاً وموضوعياً للواقعة أو التظلم مع ذكر التواريخ والأدلة المتاحة إن وجدت..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full p-2.5 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? "جاري القيد والتسجيل..." : "تسجيل واعتماد القضية"}
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
