import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import { useCreateSalaryChangeRequest, useSalaryRanges } from "../../lib/data/compensation-repository";
import {
  REASON_LABELS_AR,
  calculateCompaRatio,
  evaluateSalaryRangePosition,
  RANGE_STATUS_LABELS_AR,
  type SalaryChangeReason,
} from "../../lib/domains/compensation";

interface CreateSalaryChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  employees: Array<{ id: string; name: string; basicSalary: number; employeeNo: string }>;
}

export function CreateSalaryChangeModal({
  open,
  onOpenChange,
  companyId,
  employees,
}: CreateSalaryChangeModalProps) {
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [reason, setReason] = useState<SalaryChangeReason>("merit");
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [proposedBasic, setProposedBasic] = useState<number>(0);
  const [justification, setJustification] = useState<string>("");

  const createMutation = useCreateSalaryChangeRequest();
  const { data: salaryRanges = [] } = useSalaryRanges(companyId);

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);
  const currentBasic = selectedEmp ? selectedEmp.basicSalary : 0;
  const increaseAmount = proposedBasic - currentBasic;
  const increasePct = currentBasic > 0 ? Math.round(((increaseAmount / currentBasic) * 100) * 100) / 100 : 0;

  // Midpoint estimation for feedback
  const fallbackMid = salaryRanges[0]?.midpoint_salary || currentBasic;
  const compaRatio = calculateCompaRatio(proposedBasic, fallbackMid);
  const rangeStatus = evaluateSalaryRangePosition(
    proposedBasic,
    salaryRanges[0]?.minimum_salary || 0,
    salaryRanges[0]?.maximum_salary || 999999
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      toast.error("يرجى اختيار الموظف");
      return;
    }
    if (!proposedBasic || proposedBasic <= 0) {
      toast.error("يرجى إدخال الراتب الأساسي المقترح");
      return;
    }

    try {
      await createMutation.mutateAsync({
        companyId,
        employeeId: selectedEmpId,
        reason,
        effectiveDate,
        proposedBasic,
        justification,
      });
      toast.success("تم تقديم طلب تعديل الراتب بنجاح إلى مسار الحوكمة");
      onOpenChange(false);
      setSelectedEmpId("");
      setProposedBasic(0);
      setJustification("");
    } catch (err: any) {
      toast.error(err.message || "فشل تقديم طلب تعديل الراتب");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary" />
            تقديم طلب تعديل / زيادة راتب (Salary Change Request)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>الموظف المستهدف *</Label>
            <Select
              value={selectedEmpId}
              onValueChange={(val) => {
                setSelectedEmpId(val);
                const emp = employees.find((e) => e.id === val);
                if (emp) setProposedBasic(emp.basicSalary);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الموظف..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo}) — الحالي: {emp.basicSalary.toLocaleString()} ر.س
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>سبب التعديل *</Label>
              <Select value={reason} onValueChange={(val) => setReason(val as SalaryChangeReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REASON_LABELS_AR).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>تاريخ السريان (Effective Date) *</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الراتب الأساسي الحالي (ر.س)</Label>
              <Input
                type="number"
                value={currentBasic}
                disabled
                className="bg-muted font-mono font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label>الراتب الأساسي الجديد المقترح (ر.س) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={proposedBasic || ""}
                onChange={(e) => setProposedBasic(parseFloat(e.target.value) || 0)}
                placeholder="أدخل الراتب المقترح..."
                required
                className="font-mono font-bold"
              />
            </div>
          </div>

          {/* Realtime Impact Card */}
          <div className="p-3.5 rounded-lg border bg-secondary/30 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">قيمة الزيادة:</span>
              <span className={`font-mono font-bold ${increaseAmount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {increaseAmount >= 0 ? "+" : ""}{increaseAmount.toLocaleString()} ر.س ({increasePct}%)
              </span>
            </div>
            {compaRatio !== null && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">نسبة التنافسية (Compa-Ratio):</span>
                <span className="font-mono font-bold text-foreground">
                  {compaRatio}%
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">التوافق مع نطاق الرواتب:</span>
              <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${RANGE_STATUS_LABELS_AR[rangeStatus].color}`}>
                {RANGE_STATUS_LABELS_AR[rangeStatus].label}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>المسوغات والمبررات الإدارية</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="اكتب أسباب الزيادة والتوصية الإدارية..."
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "جاري الإرسال..." : "إرسال طلب التعديل"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
