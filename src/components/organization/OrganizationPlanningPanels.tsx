import { useMemo, useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  CircleDollarSign,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  Users,
} from "lucide-react";
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

const inputClass = "h-10 rounded-2xl border-border/80 bg-muted/40 text-xs";
const selectClass =
  "h-10 w-full rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20";

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
          ? "rounded-full border-emerald-200 bg-emerald-500/10 text-emerald-700 text-[10px] font-bold"
          : "rounded-full text-muted-foreground text-[10px]"
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
    deleteCostCenter,
    isSaving,
  } = useApp();
  const canManage = canManageModule(currentRole, "organization");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmCenter, setDeleteConfirmCenter] = useState<CostCenter | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
    toast.success(editingId ? "تم تحديث مركز التكلفة بنجاح" : "تم إنشاء مركز التكلفة بنجاح");
    setOpen(false);
    reset();
  };

  const handleDelete = async () => {
    if (!deleteConfirmCenter || isSaving) return;
    const ok = await deleteCostCenter(deleteConfirmCenter.id);
    if (ok) {
      toast.success(`تم حذف مركز التكلفة ${deleteConfirmCenter.nameAr} بنجاح`);
    } else {
      toast.error("تعذر حذف مركز التكلفة");
    }
    setDeleteConfirmCenter(null);
  };

  const filteredCenters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return costCenters;
    return costCenters.filter(
      (c) =>
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.managerName && c.managerName.toLowerCase().includes(q)),
    );
  }, [costCenters, searchQuery]);

  const totalBudget = costCenters.reduce((sum, center) => sum + center.annualBudget, 0);

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-col gap-3 rounded-3xl border border-border/80 bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            مراكز التكلفة والميزانيات التشغيلية
          </h3>
          <p className="mt-1 text-xs text-muted-foreground font-medium">
            {costCenters.length} مراكز تكلفة معتمدة • إجمالي الميزانيات{" "}
            <span className="font-mono font-bold text-foreground">
              {totalBudget.toLocaleString("ar-SA")}
            </span>{" "}
            ر.س
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في مراكز التكلفة..."
              className="h-10 w-full rounded-full border border-border/80 bg-muted/40 pr-9 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          {canManage && (
            <Button
              className="h-10 rounded-full text-xs font-bold gap-1.5 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                reset();
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> إضافة مركز تكلفة
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredCenters.map((center) => {
          const actualEmployees = employees.filter(
            (e) =>
              e.costCenterId === center.id ||
              e.costCenter === center.nameAr ||
              (center.code && e.costCenter?.includes(center.code)),
          ).length;
          const displayHeadcount = actualEmployees || center.employeeCount;

          return (
            <div
              key={center.id}
              className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-full font-mono font-bold text-xs">
                      {center.code}
                    </Badge>
                    {statusBadge(center.status)}
                  </div>
                  <h4 className="mt-2 text-sm font-black text-foreground">{center.nameAr}</h4>
                  <p className="text-xs text-muted-foreground">{center.nameEn}</p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-8 w-8 hover:bg-secondary text-muted-foreground hover:text-foreground"
                      title={`تعديل ${center.nameAr}`}
                      onClick={() => startEdit(center)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-8 w-8 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600"
                      title={`حذف ${center.nameAr}`}
                      onClick={() => setDeleteConfirmCenter(center)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs">
                <div className="rounded-2xl bg-muted/40 p-3">
                  <p className="text-[11px] text-muted-foreground font-medium">الميزانية السنوية</p>
                  <p className="mt-1 font-black text-foreground font-mono">
                    {center.annualBudget.toLocaleString("ar-SA")} ر.س
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-3">
                  <p className="text-[11px] text-muted-foreground font-medium">الموظفون المسكنون</p>
                  <p className="mt-1 font-black text-primary font-mono">{displayHeadcount} موظف</p>
                </div>
              </div>

              <div className="border-t border-border/60 pt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>المسؤول المالي / التشغيلي:</span>
                <span className="font-bold text-foreground">
                  {center.managerName || "غير معين"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCenters.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          لا توجد مراكز تكلفة مطابقة لنتائج البحث.
        </div>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black">
              {editingId ? "تعديل مركز التكلفة" : "إضافة مركز تكلفة جديد"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              ربط الميزانية السنوية بالمنشأة وتعيين المسؤول التشغيلي.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3.5 py-2 sm:grid-cols-2">
            <Field label="رمز المركز (Code) *">
              <Input
                className={inputClass}
                value={draft.code}
                onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              />
            </Field>
            <Field label="الميزانية السنوية (SAR)">
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
            <Field label="المسؤول التشغيلي">
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
                    {employee.firstNameAr} {employee.lastNameAr} — {employee.jobTitleAr}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الحالة التشغيلية">
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
          <DialogFooter className="mt-2">
            <Button onClick={save} className="rounded-full text-xs font-bold h-9 px-5">
              حفظ مركز التكلفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmCenter)}
        onOpenChange={(open) => !open && setDeleteConfirmCenter(null)}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              تأكيد حذف مركز التكلفة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              هل أنت متأكد من رغبتك في حذف مركز التكلفة (
              <span className="font-bold text-foreground">{deleteConfirmCenter?.nameAr}</span>)؟
              سيتم فك ارتباط أي إدارات مرتبطة به تلقائياً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => setDeleteConfirmCenter(null)}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              className="rounded-full text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={handleDelete}
            >
              تأكيد الحذف
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
    employees,
    currentRole,
    addJobPosition,
    updateJobPosition,
    deleteJobPosition,
    isSaving,
  } = useApp();
  const canManage = canManageModule(currentRole, "organization");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmPosition, setDeleteConfirmPosition] = useState<JobPosition | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
    toast.success(editingId ? "تم تحديث المنصب الوظيفي بنجاح" : "تم إنشاء المنصب الوظيفي بنجاح");
    setOpen(false);
    reset();
  };

  const handleDelete = async () => {
    if (!deleteConfirmPosition || isSaving) return;
    const ok = await deleteJobPosition(deleteConfirmPosition.id);
    if (ok) {
      toast.success(`تم حذف المنصب ${deleteConfirmPosition.titleAr} بنجاح`);
    } else {
      toast.error("تعذر حذف المنصب");
    }
    setDeleteConfirmPosition(null);
  };

  const filteredPositions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jobPositions;
    return jobPositions.filter(
      (p) =>
        p.titleAr.toLowerCase().includes(q) ||
        p.titleEn.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q),
    );
  }, [jobPositions, searchQuery]);

  const planned = jobPositions.reduce((sum, position) => sum + position.plannedHeadcount, 0);
  const filled = jobPositions.reduce((sum, position) => {
    const actualFilled = employees.filter((e) => e.jobPositionId === position.id).length;
    return sum + (actualFilled || position.filledHeadcount);
  }, 0);

  return (
    <div className="space-y-4">
      {/* KPI bar & actions */}
      <div className="flex flex-col gap-3 rounded-3xl border border-border/80 bg-card p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-3 flex-1">
          {[
            { label: "إجمالي المخطط", value: planned, icon: Target, color: "text-primary" },
            { label: "الوظائف المشغولة", value: filled, icon: Users, color: "text-emerald-600" },
            {
              label: "الشواغر المتاحة",
              value: Math.max(0, planned - filled),
              icon: BriefcaseBusiness,
              color: "text-amber-600",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-2xl border border-border/60 bg-muted/30 p-3.5 shadow-xs flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
                <p className="text-xl font-black text-foreground font-mono mt-0.5">{value}</p>
              </div>
              <div
                className={`h-9 w-9 rounded-xl bg-card border border-border/60 flex items-center justify-center ${color}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 lg:pt-0">
          <div className="relative min-w-[200px]">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في المناصب..."
              className="h-10 w-full rounded-full border border-border/80 bg-muted/40 pr-9 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          {canManage && (
            <Button
              className="h-10 rounded-full text-xs font-bold gap-1.5 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                reset();
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> إضافة منصب
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-3xl border border-border/80 bg-card shadow-xs">
        <table className="w-full min-w-[760px] text-right text-xs">
          <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/60">
            <tr>
              <th className="p-4">المنصب والرمز</th>
              <th className="p-4">الوحدة التنظيمية</th>
              <th className="p-4">مركز التكلفة</th>
              <th className="p-4">المخطط / المشغول</th>
              <th className="p-4">نوع التوظيف</th>
              <th className="p-4">الحالة</th>
              <th className="p-4 text-center">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredPositions.map((position) => {
              const actualFilled = employees.filter((e) => e.jobPositionId === position.id).length;
              const displayFilled = actualFilled || position.filledHeadcount;
              const unit = orgUnits.find((u) => u.id === position.orgUnitId);
              const costCenter = costCenters.find((c) => c.id === position.costCenterId);

              return (
                <tr key={position.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <p className="font-black text-foreground text-sm">{position.titleAr}</p>
                    <p className="text-muted-foreground text-[10px] font-mono mt-0.5">
                      {position.code} • {position.titleEn}
                    </p>
                  </td>
                  <td className="p-4 font-bold text-foreground">{unit?.nameAr ?? "غير محدد"}</td>
                  <td className="p-4 text-muted-foreground">
                    {costCenter ? (
                      <Badge variant="outline" className="text-[10px] font-mono rounded-full">
                        {costCenter.code}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-4 font-black font-mono">
                    <span className="text-primary">{displayFilled}</span> /{" "}
                    <span className="text-muted-foreground">{position.plannedHeadcount}</span>
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary" className="rounded-full text-[10px] font-medium">
                      {position.employmentType === "full_time"
                        ? "دوام كامل"
                        : position.employmentType === "part_time"
                          ? "دوام جزئي"
                          : position.employmentType === "contractor"
                            ? "متعاقد"
                            : "أخرى"}
                    </Badge>
                  </td>
                  <td className="p-4">{statusBadge(position.status)}</td>
                  <td className="p-4 text-center">
                    {canManage && (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                          title="تعديل"
                          onClick={() => startEdit(position)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                          title="حذف"
                          onClick={() => setDeleteConfirmPosition(position)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredPositions.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-xs text-muted-foreground">
                  لا توجد مناصب وظيفية مسجلة مطابقة للبحث.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black">
              {editingId ? "تعديل المنصب الوظيفي" : "إضافة منصب وظيفي جديد"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              تحديد التبعية بالهيكل والعدد المخطط ونوع التوظيف.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3.5 py-2 sm:grid-cols-2">
            <Field label="رمز المنصب *">
              <Input
                className={inputClass}
                value={draft.code}
                onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              />
            </Field>
            <Field label="الدرجة الوظيفية (Grade)">
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
                min={1}
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
          <DialogFooter className="mt-2">
            <Button onClick={save} className="rounded-full text-xs font-bold h-9 px-5">
              حفظ المنصب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmPosition)}
        onOpenChange={(open) => !open && setDeleteConfirmPosition(null)}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              تأكيد حذف المنصب الوظيفي
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              هل أنت متأكد من رغبتك في إزالة المنصب (
              <span className="font-bold text-foreground">{deleteConfirmPosition?.titleAr}</span>) من
              الهيكل التنظيمي؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => setDeleteConfirmPosition(null)}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              className="rounded-full text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={handleDelete}
            >
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
