import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import { createSalaryPayGrade, createSalaryRange, useSalaryPayGrades } from "../../lib/data/compensation-repository";

interface CreateStructureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onSuccess: () => void;
}

export function CreateStructureModal({
  open,
  onOpenChange,
  companyId,
  onSuccess,
}: CreateStructureModalProps) {
  const [mode, setMode] = useState<"grade" | "range">("range");
  const { data: payGrades = [] } = useSalaryPayGrades(companyId);

  // Grade state
  const [gradeCode, setGradeCode] = useState("");
  const [gradeNameAr, setGradeNameAr] = useState("");
  const [gradeLevel, setGradeLevel] = useState<number>(1);
  const [careerTrack, setCareerTrack] = useState<"executive" | "management" | "professional" | "technical" | "operational">("professional");

  // Range state
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [minSalary, setMinSalary] = useState<number>(5000);
  const [midSalary, setMidSalary] = useState<number>(7500);
  const [maxSalary, setMaxSalary] = useState<number>(10000);
  const [currency, setCurrency] = useState("SAR");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "grade") {
        if (!gradeCode || !gradeNameAr) {
          toast.error("يرجى إدخال رمز ومسمى الدرجة الوظيفية");
          setIsSubmitting(false);
          return;
        }
        await createSalaryPayGrade({
          company_id: companyId,
          code: gradeCode.toUpperCase(),
          name_ar: gradeNameAr,
          name_en: gradeCode.toUpperCase(),
          grade_level: gradeLevel,
          career_track: careerTrack,
        });
        toast.success("تم إنشاء الدرجة الوظيفية بنجاح");
      } else {
        if (!selectedGradeId) {
          toast.error("يرجى اختيار الدرجة الوظيفية");
          setIsSubmitting(false);
          return;
        }
        if (minSalary > midSalary || midSalary > maxSalary) {
          toast.error("يجب أن يكون الحد الأدنى <= نقطة المنتصف <= الحد الأقصى");
          setIsSubmitting(false);
          return;
        }
        await createSalaryRange({
          company_id: companyId,
          pay_grade_id: selectedGradeId,
          currency,
          minimum_salary: minSalary,
          midpoint_salary: midSalary,
          maximum_salary: maxSalary,
          effective_from: new Date().toISOString().split("T")[0],
        });
        toast.success("تم إدراج نطاق الراتب المعتمد بنجاح");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary" />
            إدارة هيكل ونطاقات الرواتب (Salary Structures)
          </DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-border mb-4">
          <button
            type="button"
            onClick={() => setMode("range")}
            className={`flex-1 py-2 text-sm font-semibold text-center border-b-2 transition-colors ${
              mode === "range" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            إضافة نطاق راتب (Pay Band)
          </button>
          <button
            type="button"
            onClick={() => setMode("grade")}
            className={`flex-1 py-2 text-sm font-semibold text-center border-b-2 transition-colors ${
              mode === "grade" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            إضافة درجة وظيفية (Pay Grade)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "range" ? (
            <>
              <div className="space-y-2">
                <Label>الدرجة الوظيفية (Pay Grade) *</Label>
                <Select value={selectedGradeId} onValueChange={setSelectedGradeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الدرجة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {payGrades.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.code} — {g.name_ar} (مستوى {g.grade_level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>الحد الأدنى *</Label>
                  <Input
                    type="number"
                    value={minSalary}
                    onChange={(e) => setMinSalary(parseFloat(e.target.value) || 0)}
                    required
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>نقطة المنتصف *</Label>
                  <Input
                    type="number"
                    value={midSalary}
                    onChange={(e) => setMidSalary(parseFloat(e.target.value) || 0)}
                    required
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الحد الأقصى *</Label>
                  <Input
                    type="number"
                    value={maxSalary}
                    onChange={(e) => setMaxSalary(parseFloat(e.target.value) || 0)}
                    required
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>العملة</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAR">SAR — ريال سعودي</SelectItem>
                    <SelectItem value="EGP">EGP — جنيه مصري</SelectItem>
                    <SelectItem value="AED">AED — درهم إماراتي</SelectItem>
                    <SelectItem value="QAR">QAR — ريال قطري</SelectItem>
                    <SelectItem value="USD">USD — دولار أمريكي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رمز الدرجة (مثال: G1, L4) *</Label>
                  <Input
                    value={gradeCode}
                    onChange={(e) => setGradeCode(e.target.value)}
                    placeholder="G01"
                    required
                    className="font-mono font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label>المستوى الرقمي (1-15) *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="15"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(parseInt(e.target.value) || 1)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>المسمى باللغة العربية *</Label>
                <Input
                  value={gradeNameAr}
                  onChange={(e) => setGradeNameAr(e.target.value)}
                  placeholder="الدرجة المهنية التخصصية"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>المسار المهني (Career Track)</Label>
                <Select value={careerTrack} onValueChange={(val: any) => setCareerTrack(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive">تنفيذي (Executive)</SelectItem>
                    <SelectItem value="management">إداري وإشرافي (Management)</SelectItem>
                    <SelectItem value="professional">مهني وتخصصي (Professional)</SelectItem>
                    <SelectItem value="technical">تقني وفني (Technical)</SelectItem>
                    <SelectItem value="operational">تشغيلي ودعم (Operational)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "جاري الحفظ..." : "حفظ الهيكل"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
