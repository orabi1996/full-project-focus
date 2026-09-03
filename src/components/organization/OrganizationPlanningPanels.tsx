import { useState, type ReactNode } from "react";
import { BriefcaseBusiness, CircleDollarSign, Pencil, Plus, Target, Users } from "lucide-react";
import { toast } from "sonner";

import { canManageModule } from "../../lib/auth/permissions";
import { useApp } from "../../lib/context/AppContext";
import type { CostCenter, JobPosition } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const inputClass = "h-10 rounded-xl text-sm";
const selectClass =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold">{label}</Label>
      {children}
    </div>
  );
}

function statusBadge(status: "active" | "inactive") {
  return (
    <Badge
      variant="outline"
      className={
        status === "active"
          ? "rounded-full border-emerald-200 bg-emerald-500/10 text-emerald-700"
          : "rounded-full text-muted-foreground"
      }
    >
      {status === "active" ? "نشط" : "غير نشط"}
    </Badge>
  );
}

export function CostCentersPanel() {
  const {
    company,
    costCenters,
    employees,
    currentRole,
    addCostCenter,
    updateCostCenter,
    isSaving,
  } = useApp();
  const canManage = canManageModule(currentRole, "organization");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<CostCenter, "id" | "employeeCount" | "managerName">>({
    companyId: company.id,
    code: "",
    nameAr: "",
    nameEn: "",
    annualBudget: 0,
    status: "active",
  });

  const reset = () => {
    setEditingId(null);
    setDraft({
      companyId: company.id,
      code: "",
      nameAr: "",
      nameEn: "",
      annualBudget: 0,
      status: "active",
    });
  };

  const startEdit = (center: CostCenter) => {
    setEditingId(center.id);
    setDraft({
      companyId: center.companyId,
      code: center.code,
      nameAr: center.nameAr,
      nameEn: center.nameEn,
      managerEmployeeId: center.managerEmployeeId,
      annualBudget: center.annualBudget,
      status: center.status,
    });
    setOpen(true);
  };

  const save = async () => {
    if (isSaving) return;
    if (!draft.code.trim() || !draft.nameAr.trim() || !draft.nameEn.trim()) {
      toast.error("أكمل الرمز والاسم العربي والإنجليزي لمركز التكلفة");
      return;
    }
    const saved = editingId ? await updateCostCenter(editingId, draft) : await addCostCenter(draft);
    if (!saved) return;
    toast.success(editingId ? "تم تحديث مركز التكلفة" : "تم إنشاء مركز التكلفة");
    setOpen(false);
    reset();
  };

  const totalBudget = costCenters.reduce((sum, center) => sum + center.annualBudget, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            مراكز التكلفة والميزانيات
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {costCenters.length} مراكز • إجمالي الميزانيات {totalBudget.toLocaleString("ar-SA")} ر.س
          </p>
        </div>
        {canManage && (
          <Button
            className="h-10 rounded-full text-xs font-bold"
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            <Plus className="ml-1 h-4 w-4" /> إضافة مركز تكلفة
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {costCenters.map((center) => (
          <div key={center.id} className="rounded-3xl border bg-card p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full font-mono">
                    {center.code}
                  </Badge>
                  {statusBadge(center.status)}
                </div>
                <h4 className="mt-3 text-sm font-black">{center.nameAr}</h4>
                <p className="text-xs text-muted-foreground">{center.nameEn}</p>
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  title={`تعديل ${center.nameAr}`}
                  onClick={() => startEdit(center)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 text-xs">
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-muted-foreground">الميزانية السنوية</p>
                <p className="mt-1 font-black">{center.annualBudget.toLocaleString("ar-SA")} ر.س</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-muted-foreground">الموظفون</p>
                <p className="mt-1 font-black">{center.employeeCount}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              المسؤول: {center.managerName || "غير معين"}
            </p>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل مركز التكلفة" : "إضافة مركز تكلفة"}</DialogTitle>
            <DialogDescription>ربط الميزانية بالمنشأة والمسؤول التشغيلي.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <Field label="الرمز *">
              <Input
                className={inputClass}
                value={draft.code}
                onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              />
            </Field>
            <Field label="الميزانية السنوية">
              <Input
                className={inputClass}
                type="number"
                min={0}
                value={draft.annualBudget}
                onChange={(event) =>
                  setDraft({ ...draft, annualBudget: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="الاسم العربي *">
              <Input
                className={inputClass}
                value={draft.nameAr}
                onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })}
              />
            </Field>
            <Field label="الاسم الإنجليزي *">
              <Input
                className={inputClass}
                dir="ltr"
                value={draft.nameEn}
                onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}
              />
            </Field>
            <Field label="المسؤول">
              <select
                className={selectClass}
                value={draft.managerEmployeeId ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, managerEmployeeId: event.target.value || null })
                }
              >
                <option value="">غير معين</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstNameAr} {employee.lastNameAr}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الحالة">
              <select
                className={selectClass}
                value={draft.status}
                onChange={(event) =>
                  setDraft({ ...draft, status: event.target.value as CostCenter["status"] })
                }
              >
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={save} className="rounded-full">
              حفظ مركز التكلفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function JobPositionsPanel() {
  const {
    company,
    jobPositions,
    orgUnits,
    costCenters,
    currentRole,
    addJobPosition,
    updateJobPosition,
    isSaving,
  } = useApp();
  const canManage = canManageModule(currentRole, "organization");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<JobPosition, "id" | "filledHeadcount">>({
    companyId: company.id,
    orgUnitId: orgUnits[0]?.id ?? "",
    code: "",
    titleAr: "",
    titleEn: "",
    employmentType: "full_time",
    plannedHeadcount: 1,
    status: "active",
  });

  const reset = () => {
    setEditingId(null);
    setDraft({
      companyId: company.id,
      orgUnitId: orgUnits[0]?.id ?? "",
      code: "",
      titleAr: "",
      titleEn: "",
      employmentType: "full_time",
      plannedHeadcount: 1,
      status: "active",
    });
  };

  const startEdit = (position: JobPosition) => {
    setEditingId(position.id);
    const { id: _id, filledHeadcount: _filled, ...editable } = position;
    setDraft(editable);
    setOpen(true);
  };

  const save = async () => {
    if (isSaving) return;
    if (!draft.code.trim() || !draft.titleAr.trim() || !draft.titleEn.trim() || !draft.orgUnitId) {
      toast.error("أكمل الرمز والمسمى والوحدة التنظيمية للمنصب");
      return;
    }
    const saved = editingId
      ? await updateJobPosition(editingId, draft)
      : await addJobPosition(draft);
    if (!saved) return;
    toast.success(editingId ? "تم تحديث المنصب" : "تم إنشاء المنصب");
    setOpen(false);
    reset();
  };

  const planned = jobPositions.reduce((sum, position) => sum + position.plannedHeadcount, 0);
  const filled = jobPositions.reduce((sum, position) => sum + position.filledHeadcount, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "إجمالي المخطط", value: planned, icon: Target },
            { label: "المشغول", value: filled, icon: Users },
            {
              label: "الشواغر",
              value: Math.max(0, planned - filled),
              icon: BriefcaseBusiness,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-3xl border bg-card p-4 shadow-xs">
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-black">{value}</p>
            </div>
          ))}
        </div>
        {canManage && (
          <Button
            className="h-10 self-center rounded-full text-xs font-bold"
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            <Plus className="ml-1 h-4 w-4" /> إضافة منصب
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-3xl border bg-card shadow-xs">
        <table className="w-full min-w-[760px] text-right text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="p-4">المنصب</th>
              <th className="p-4">الوحدة التنظيمية</th>
              <th className="p-4">الدرجة</th>
              <th className="p-4">المخطط / المشغول</th>
              <th className="p-4">الحالة</th>
              <th className="p-4">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobPositions.map((position) => (
              <tr key={position.id}>
                <td className="p-4">
                  <p className="font-black">{position.titleAr}</p>
                  <p className="text-muted-foreground">
                    {position.code} • {position.titleEn}
                  </p>
                </td>
                <td className="p-4">
                  {orgUnits.find((unit) => unit.id === position.orgUnitId)?.nameAr ?? "غير محدد"}
                </td>
                <td className="p-4">{position.grade || "—"}</td>
                <td className="p-4 font-black">
                  {position.plannedHeadcount} / {position.filledHeadcount}
                </td>
                <td className="p-4">{statusBadge(position.status)}</td>
                <td className="p-4">
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={() => startEdit(position)}
                    >
                      <Pencil className="ml-1 h-4 w-4" /> تعديل
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل المنصب الوظيفي" : "إضافة منصب وظيفي"}</DialogTitle>
            <DialogDescription>تحديد التبعية والعدد المخطط ومركز التكلفة.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <Field label="رمز المنصب *">
              <Input
                className={inputClass}
                value={draft.code}
                onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              />
            </Field>
            <Field label="الدرجة الوظيفية">
              <Input
                className={inputClass}
                value={draft.grade ?? ""}
                onChange={(event) => setDraft({ ...draft, grade: event.target.value })}
              />
            </Field>
            <Field label="المسمى العربي *">
              <Input
                className={inputClass}
                value={draft.titleAr}
                onChange={(event) => setDraft({ ...draft, titleAr: event.target.value })}
              />
            </Field>
            <Field label="المسمى الإنجليزي *">
              <Input
                className={inputClass}
                dir="ltr"
                value={draft.titleEn}
                onChange={(event) => setDraft({ ...draft, titleEn: event.target.value })}
              />
            </Field>
            <Field label="الوحدة التنظيمية *">
              <select
                className={selectClass}
                value={draft.orgUnitId}
                onChange={(event) => setDraft({ ...draft, orgUnitId: event.target.value })}
              >
                <option value="">اختر الوحدة</option>
                {orgUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.nameAr}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="مركز التكلفة">
              <select
                className={selectClass}
                value={draft.costCenterId ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, costCenterId: event.target.value || null })
                }
              >
                <option value="">غير محدد</option>
                {costCenters.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.code} — {center.nameAr}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="العدد المخطط">
              <Input
                className={inputClass}
                type="number"
                min={0}
                value={draft.plannedHeadcount}
                onChange={(event) =>
                  setDraft({ ...draft, plannedHeadcount: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="نوع التوظيف">
              <select
                className={selectClass}
                value={draft.employmentType}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    employmentType: event.target.value as JobPosition["employmentType"],
                  })
                }
              >
                <option value="full_time">دوام كامل</option>
                <option value="part_time">دوام جزئي</option>
                <option value="contractor">متعاقد</option>
                <option value="seasonal">موسمي</option>
                <option value="internship">تدريب</option>
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={save} className="rounded-full">
              حفظ المنصب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
