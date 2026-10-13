import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import { useBenefitPlans, useEnrollEmployeeBenefit, useEmployeeDependents } from "../../lib/data/compensation-repository";

interface BenefitEnrollmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  employees: Array<{ id: string; name: string; employeeNo: string }>;
  onSuccess: () => void;
}

export function BenefitEnrollmentModal({
  open,
  onOpenChange,
  companyId,
  employees,
  onSuccess,
}: BenefitEnrollmentModalProps) {
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [enrollmentType, setEnrollmentType] = useState<"open_enrollment" | "new_hire" | "life_event" | "administrative_addition">("open_enrollment");
  const [selectedDepIds, setSelectedDepIds] = useState<string[]>([]);

  const { data: plans = [] } = useBenefitPlans(companyId);
  const { data: dependents = [] } = useEmployeeDependents(companyId, selectedEmpId);
  const enrollMutation = useEnrollEmployeeBenefit();

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const handleToggleDependent = (depId: string) => {
    setSelectedDepIds((prev) =>
      prev.includes(depId) ? prev.filter((id) => id !== depId) : [...prev, depId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !selectedPlanId) {
      toast.error("يرجى اختيار الموظف وخطة المزايا");
      return;
    }

    try {
      await enrollMutation.mutateAsync({
        companyId,
        employeeId: selectedEmpId,
        planId: selectedPlanId,
        enrollmentType,
        dependentIds: selectedDepIds,
      });
      toast.success("تم تسجيل الموظف والمستفيدين في خطة المزايا بنجاح");
      onSuccess();
      onOpenChange(false);
      setSelectedEmpId("");
      setSelectedPlanId("");
      setSelectedDepIds([]);
    } catch (err: any) {
      toast.error(err.message || "فشل تسجيل المزايا");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary" />
            تسجيل الموظف في خطة المزايا (Benefits Enrollment)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>الموظف المستفيد *</Label>
            <Select value={selectedEmpId} onValueChange={(val) => { setSelectedEmpId(val); setSelectedDepIds([]); }}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الموظف..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>خطة المزايا المتاحة *</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الخطة أو التغطية..." />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name_ar} — {p.tier_level.toUpperCase()} (مساهمة المنشأة: {p.employer_monthly_cost.toLocaleString()} ر.س/شهر)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPlan && (
            <div className="p-3 bg-secondary/30 rounded-lg text-sm space-y-1.5 border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">التكلفة الشهرية للموظف:</span>
                <span className="font-mono font-bold text-foreground">
                  {selectedPlan.employee_monthly_cost.toLocaleString()} ر.س
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">مساهمة صاحب العمل الشهرية:</span>
                <span className="font-mono font-bold text-emerald-600">
                  {selectedPlan.employer_monthly_cost.toLocaleString()} ر.س
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>تغطية التابعين: {selectedPlan.dependent_coverage_allowed ? "مسموحة (حتى 5 تابعين)" : "غير مسموحة"}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>نوع وقناة التسجيل</Label>
            <Select value={enrollmentType} onValueChange={(val: any) => setEnrollmentType(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open_enrollment">التسجيل السنوي المفتوح (Open Enrollment)</SelectItem>
                <SelectItem value="new_hire">انضمام موظف جديد (New Hire)</SelectItem>
                <SelectItem value="life_event">واقعة حياتية - زواج / مولود (Life Event)</SelectItem>
                <SelectItem value="administrative_addition">إضافة إدارية خاصة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedPlan?.dependent_coverage_allowed && dependents.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                إضافة التابعين المعتمدين ({dependents.length})
              </Label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {dependents.map((dep) => (
                  <label
                    key={dep.id}
                    className="flex items-center justify-between p-2 rounded border bg-card hover:bg-muted/50 cursor-pointer text-sm"
                  >
                    <div>
                      <span className="font-medium text-foreground">{dep.full_name_ar}</span>
                      <span className="text-xs text-muted-foreground mr-2">({dep.relationship})</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedDepIds.includes(dep.id)}
                      onChange={() => handleToggleDependent(dep.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={enrollMutation.isPending}>
              {enrollMutation.isPending ? "جاري التسجيل..." : "تأكيد تسجيل المزايا"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
