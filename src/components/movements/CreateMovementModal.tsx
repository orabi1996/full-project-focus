// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 28: CREATE EMPLOYEE MOVEMENT MODAL
// src/components/movements/CreateMovementModal.tsx
// ============================================================================

import React, { useState, useMemo } from "react";
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
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Briefcase,
  UserCheck,
  MapPin,
  DollarSign,
  Calendar,
  ShieldAlert,
} from "lucide-react";
import type { MovementType } from "../../lib/domains/movements";
import { validateHierarchyCircular } from "../../lib/domains/movements";
import { createEmployeeMovementRecord } from "../../lib/data/movements-repository";

interface CreateMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  employees: Array<{ id: string; name: string; employeeNo?: string; managerId?: string | null; departmentName?: string; jobTitle?: string }>;
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string; plannedHeadcount?: number; currentHeadcount?: number }>;
  locations: Array<{ id: string; name: string }>;
  costCenters: Array<{ id: string; code: string }>;
}

const MOVEMENT_TYPE_LABELS: Record<MovementType, { ar: string; icon: string }> = {
  promotion: { ar: "ترقية وظيفية", icon: "trending-up" },
  demotion: { ar: "تعديل رتبة إدارية", icon: "arrow-down" },
  transfer: { ar: "نقل وظيفي شامل", icon: "arrow-right-left" },
  department_change: { ar: "تغيير الإدارة / القسم", icon: "building" },
  business_unit_change: { ar: "تغيير وحدة الأعمال", icon: "briefcase" },
  legal_entity_change: { ar: "نقل بين الكيانات القانونية", icon: "scale" },
  job_change: { ar: "تغيير المسمى الوظيفي", icon: "badge" },
  position_change: { ar: "تغيير المنصب والوظيفة", icon: "user-check" },
  grade_change: { ar: "تعديل الدرجة / السلم الوظيفي", icon: "layers" },
  manager_change: { ar: "تغيير المدير المباشر", icon: "users" },
  location_change: { ar: "نقل موقع ومقر العمل", icon: "map-pin" },
  cost_center_change: { ar: "تعديل مركز التكلفة المحاسبي", icon: "credit-card" },
  employment_type_change: { ar: "تعديل نمط العمل", icon: "clock" },
  contract_change: { ar: "تعديل بنود العقد", icon: "file-text" },
  compensation_change: { ar: "تعديل الأجر والمزايا", icon: "dollar-sign" },
  temporary_assignment: { ar: "تكليف بمهمة مؤقتة", icon: "calendar-clock" },
  secondment: { ar: "إعارة خارجية", icon: "share-2" },
  acting_assignment: { ar: "تكليف بالإنابة", icon: "shield" },
  return_from_assignment: { ar: "عودة من تكليف مؤقت", icon: "rotate-ccw" },
  status_change: { ar: "تعديل الحالة الوظيفية", icon: "activity" },
};

export const CreateMovementModal: React.FC<CreateMovementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  employees,
  departments,
  positions,
  locations,
  costCenters,
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("promotion");
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // default tomorrow
    return d.toISOString().split("T")[0];
  });
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field change targets
  const [targetDeptId, setTargetDeptId] = useState("");
  const [targetPosId, setTargetPosId] = useState("");
  const [targetMgrId, setTargetMgrId] = useState("");
  const [targetLocId, setTargetLocId] = useState("");
  const [targetCostCenterId, setTargetCostCenterId] = useState("");
  const [targetGrade, setTargetGrade] = useState("");
  const [targetBasicSalary, setTargetBasicSalary] = useState("");
  const [targetHousing, setTargetHousing] = useState("");
  const [targetTransport, setTargetTransport] = useState("");

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmpId),
    [employees, selectedEmpId]
  );

  // Hierarchy validation
  const hierarchyValidation = useMemo(() => {
    if (!selectedEmpId || !targetMgrId) return { valid: true };
    const tree: Record<string, string | null> = {};
    employees.forEach((e) => {
      tree[e.id] = e.managerId ?? null;
    });
    return validateHierarchyCircular(selectedEmpId, targetMgrId, tree);
  }, [selectedEmpId, targetMgrId, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      toast.error("يرجى اختيار الموظف");
      return;
    }
    if (!effectiveDate) {
      toast.error("يرجى تحديد تاريخ السريان");
      return;
    }
    if (!reason.trim()) {
      toast.error("يرجى كتابة سبب التعديل والمبرر الإداري");
      return;
    }
    if (!hierarchyValidation.valid) {
      toast.error(hierarchyValidation.reason || "خطأ في التسلسل الإداري للمدير");
      return;
    }

    // Build changes array
    const changes: any[] = [];
    if (targetDeptId) {
      changes.push({
        field_code: "department_id",
        new_reference_id: targetDeptId,
        new_display_value: departments.find((d) => d.id === targetDeptId)?.name,
      });
    }
    if (targetPosId) {
      changes.push({
        field_code: "job_position_id",
        new_reference_id: targetPosId,
        new_display_value: positions.find((p) => p.id === targetPosId)?.title,
      });
    }
    if (targetMgrId) {
      changes.push({
        field_code: "manager_id",
        new_reference_id: targetMgrId,
        new_display_value: employees.find((e) => e.id === targetMgrId)?.name,
      });
    }
    if (targetLocId) {
      changes.push({
        field_code: "work_location_id",
        new_reference_id: targetLocId,
        new_display_value: locations.find((l) => l.id === targetLocId)?.name,
      });
    }
    if (targetCostCenterId) {
      changes.push({
        field_code: "cost_center_id",
        new_reference_id: targetCostCenterId,
        new_display_value: costCenters.find((c) => c.id === targetCostCenterId)?.code,
      });
    }
    if (targetGrade) {
      changes.push({
        field_code: "grade",
        new_value: targetGrade,
        new_display_value: targetGrade,
      });
    }
    if (targetBasicSalary) {
      changes.push({
        field_code: "basic_salary",
        new_value: targetBasicSalary,
        new_display_value: targetBasicSalary + " SAR",
        is_confidential: true,
      });
    }
    if (targetHousing) {
      changes.push({
        field_code: "housing_allowance",
        new_value: targetHousing,
        new_display_value: targetHousing + " SAR",
        is_confidential: true,
      });
    }
    if (targetTransport) {
      changes.push({
        field_code: "transport_allowance",
        new_value: targetTransport,
        new_display_value: targetTransport + " SAR",
        is_confidential: true,
      });
    }

    if (changes.length === 0) {
      toast.error("يرجى تحديد حقل واحد على الأقل للتغيير (إدارة، وظيفة، مدير، موقع، أو راتب)");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createEmployeeMovementRecord({
        companyId,
        employeeId: selectedEmpId,
        movementType,
        effectiveDate,
        reason,
        changes,
        notes,
      });

      if (res.success) {
        toast.success(`تم إنشاء الحركة الوظيفية بنجاح (${res.movementNumber})`);
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "تعذر إنشاء الحركة الوظيفية");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ الحركة");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-black">طلب حركة وظيفية جديدة</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                تسجيل حركة مؤرخة مع الحفاظ على السجل التاريخي دون الكتابة فوق البيانات القديمة
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Employee & Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold">الموظف المعني *</Label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full mt-1.5 h-10 px-3 rounded-xl border border-input bg-background text-sm"
                required
              >
                <option value="">-- اختر الموظف --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo || "N/A"}) - {emp.jobTitle || "بدون مسمى"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-bold">نوع الحركة الوظيفية *</Label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as MovementType)}
                className="w-full mt-1.5 h-10 px-3 rounded-xl border border-input bg-background text-sm font-semibold"
                required
              >
                {Object.entries(MOVEMENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.ar}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Info Card */}
          {selectedEmployee && (
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">الإدارة الحالية:</span>{" "}
                <span className="font-bold">{selectedEmployee.departmentName || "غير محدد"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">المسمى الحالي:</span>{" "}
                <span className="font-bold">{selectedEmployee.jobTitle || "غير محدد"}</span>
              </div>
            </div>
          )}

          {/* Effective Date & Reason */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                تاريخ السريان المعتمد *
              </Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="mt-1.5 h-10 rounded-xl"
                required
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                إذا كان التاريخ مستقبلياً ستصبح الحركة مجدولة وتتفعل تلقائياً في تاريخها.
              </span>
            </div>

            <div>
              <Label className="text-xs font-bold">المبرر الإداري / سبب التعديل *</Label>
              <Input
                placeholder="مثال: ترقية استثنائية، إعادة هيكلة، قرار مجلس الإدارة"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1.5 h-10 rounded-xl"
                required
              />
            </div>
          </div>

          {/* Section: Proposed Changes */}
          <div className="rounded-2xl border border-border/80 p-4 space-y-4 bg-card/60">
            <h4 className="text-xs font-black text-foreground flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              البيانات المقترح تعديلها (اترك الحقل فارغاً إذا لم يطرأ عليه تغيير)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <Label className="text-xs">الإدارة المستهدفة</Label>
                <select
                  value={targetDeptId}
                  onChange={(e) => setTargetDeptId(e.target.value)}
                  className="w-full mt-1 h-9 px-2.5 rounded-xl border border-input bg-background text-xs"
                >
                  <option value="">بدون تغيير</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">الوظيفة / المنصب المستهدف</Label>
                <select
                  value={targetPosId}
                  onChange={(e) => setTargetPosId(e.target.value)}
                  className="w-full mt-1 h-9 px-2.5 rounded-xl border border-input bg-background text-xs"
                >
                  <option value="">بدون تغيير</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">المدير المباشر الجديد</Label>
                <select
                  value={targetMgrId}
                  onChange={(e) => setTargetMgrId(e.target.value)}
                  className="w-full mt-1 h-9 px-2.5 rounded-xl border border-input bg-background text-xs"
                >
                  <option value="">بدون تغيير</option>
                  {employees
                    .filter((e) => e.id !== selectedEmpId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
                {!hierarchyValidation.valid && (
                  <div className="mt-1.5 p-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>{hierarchyValidation.reason}</span>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs">مقر / موقع العمل الجديد</Label>
                <select
                  value={targetLocId}
                  onChange={(e) => setTargetLocId(e.target.value)}
                  className="w-full mt-1 h-9 px-2.5 rounded-xl border border-input bg-background text-xs"
                >
                  <option value="">بدون تغيير</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">مركز التكلفة المحاسبي</Label>
                <select
                  value={targetCostCenterId}
                  onChange={(e) => setTargetCostCenterId(e.target.value)}
                  className="w-full mt-1 h-9 px-2.5 rounded-xl border border-input bg-background text-xs"
                >
                  <option value="">بدون تغيير</option>
                  {costCenters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">الدرجة / السلم الوظيفي</Label>
                <Input
                  placeholder="مثال: G6, Senior-1"
                  value={targetGrade}
                  onChange={(e) => setTargetGrade(e.target.value)}
                  className="mt-1 h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Compensation Section if Promotion or Compensation change */}
            {(movementType === "promotion" || movementType === "compensation_change") && (
              <div className="pt-3 border-t border-border/70 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>تعديل التعويضات المالية (محمي بسرية الصلاحيات)</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px]">الراتب الأساسي الجديد</Label>
                    <Input
                      type="number"
                      placeholder="SAR"
                      value={targetBasicSalary}
                      onChange={(e) => setTargetBasicSalary(e.target.value)}
                      className="mt-1 h-8 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">بدل السكن</Label>
                    <Input
                      type="number"
                      placeholder="SAR"
                      value={targetHousing}
                      onChange={(e) => setTargetHousing(e.target.value)}
                      className="mt-1 h-8 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">بدل النقل</Label>
                    <Input
                      type="number"
                      placeholder="SAR"
                      value={targetTransport}
                      onChange={(e) => setTargetTransport(e.target.value)}
                      className="mt-1 h-8 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">ملاحظات إضافية</Label>
            <Textarea
              placeholder="أي تفاصيل أو توجيهات متعلقة بالقرار..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 rounded-xl text-xs"
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !hierarchyValidation.valid}
              className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? "جاري الحفظ..." : "اعتماد وتسجيل الحركة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
