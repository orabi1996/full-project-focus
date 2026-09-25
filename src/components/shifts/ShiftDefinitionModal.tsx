import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Clock, CalendarCheck, ShieldAlert, Sparkles, Moon, Sun, Split, Sliders } from "lucide-react";
import type { ShiftDefinition, ShiftType, ShiftBreakType } from "../../types";
import { useShiftMutations } from "../../lib/domains/shifts";
import { toast } from "sonner";

interface ShiftDefinitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialShift?: ShiftDefinition | null;
  companyId?: string;
  onSuccess?: () => void;
}

const PRESET_COLORS = [
  "#0284c7", // Blue
  "#0d9488", // Teal
  "#16a34a", // Green
  "#d97706", // Amber
  "#dc2626", // Red
  "#7c3aed", // Purple
  "#475569", // Slate
];

export const ShiftDefinitionModal: React.FC<ShiftDefinitionModalProps> = ({
  open,
  onOpenChange,
  initialShift,
  companyId,
  onSuccess,
}) => {
  const isEditing = Boolean(initialShift);
  const { addShift, updateShift, getNewShiftCode } = useShiftMutations(companyId);

  // Form State
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [color, setColor] = useState("#0284c7");
  const [shiftType, setShiftType] = useState<ShiftType>("fixed");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [flexibleHours, setFlexibleHours] = useState(8);
  const [splitSecondStartTime, setSplitSecondStartTime] = useState("16:00");
  const [splitSecondEndTime, setSplitSecondEndTime] = useState("20:00");
  const [graceArrival, setGraceArrival] = useState(15);
  const [graceDeparture, setGraceDeparture] = useState(15);
  const [overtimeEligible, setOvertimeEligible] = useState(true);
  const [allowSinglePunch, setAllowSinglePunch] = useState(false);
  const [breakType, setBreakType] = useState<ShiftBreakType>("none");
  const [autoDeductBreaks, setAutoDeductBreaks] = useState(false);
  const [minRestHoursAfter, setMinRestHoursAfter] = useState(11);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().substring(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form on open/shift change
  useEffect(() => {
    if (open) {
      if (initialShift) {
        setCode(initialShift.code || "");
        setNameAr(initialShift.nameAr || "");
        setNameEn(initialShift.nameEn || "");
        setColor(initialShift.color || "#0284c7");
        setShiftType(initialShift.type || "fixed");
        setStartTime(initialShift.startTime || "08:00");
        setEndTime(initialShift.endTime || "17:00");
        setFlexibleHours(initialShift.flexibleHours ?? 8);
        setSplitSecondStartTime(initialShift.splitSecondStartTime || "16:00");
        setSplitSecondEndTime(initialShift.splitSecondEndTime || "20:00");
        setGraceArrival(initialShift.graceMinutesArrival ?? 15);
        setGraceDeparture(initialShift.graceMinutesDeparture ?? 15);
        setOvertimeEligible(Boolean(initialShift.overtimeEligible));
        setAllowSinglePunch(Boolean(initialShift.allowSinglePunch));
        setBreakType(initialShift.breakType || "none");
        setAutoDeductBreaks(Boolean(initialShift.autoDeductBreaks));
        setMinRestHoursAfter(initialShift.minRestHoursAfter ?? 11);
        setEffectiveFrom(initialShift.effectiveFrom || new Date().toISOString().substring(0, 10));
        setEffectiveTo(initialShift.effectiveTo || "");
      } else {
        // Reset defaults and generate code
        setNameAr("");
        setNameEn("");
        setColor("#0284c7");
        setShiftType("fixed");
        setStartTime("08:00");
        setEndTime("17:00");
        setFlexibleHours(8);
        setSplitSecondStartTime("16:00");
        setSplitSecondEndTime("20:00");
        setGraceArrival(15);
        setGraceDeparture(15);
        setOvertimeEligible(true);
        setAllowSinglePunch(false);
        setBreakType("none");
        setAutoDeductBreaks(false);
        setMinRestHoursAfter(11);
        setEffectiveFrom(new Date().toISOString().substring(0, 10));
        setEffectiveTo("");

        getNewShiftCode().then((newCode) => {
          setCode(newCode);
        });
      }
    }
  }, [open, initialShift, getNewShiftCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      toast.error("يرجى إدخال اسم الوردية بالعربية");
      return;
    }

    if (shiftType === "overnight" && startTime <= endTime) {
      toast.warning("تنبيه: الوردية الليلية عادة ما تبدأ في المساء وتنتهي في صباح اليوم التالي");
    }

    if (shiftType === "split") {
      if (!splitSecondStartTime || !splitSecondEndTime) {
        toast.error("يرجى تحديد أوقات الفترة الثانية للوردية المقسومة");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<ShiftDefinition> = {
        companyId,
        code: code.trim(),
        nameAr: nameAr.trim(),
        nameEn: (nameEn.trim() || nameAr.trim()),
        color,
        type: shiftType,
        startTime,
        endTime,
        flexibleHours: shiftType === "flexible" ? Number(flexibleHours) : undefined,
        splitSecondStartTime: shiftType === "split" ? splitSecondStartTime : undefined,
        splitSecondEndTime: shiftType === "split" ? splitSecondEndTime : undefined,
        graceMinutesArrival: Number(graceArrival),
        graceMinutesDeparture: Number(graceDeparture),
        overtimeEligible,
        allowSinglePunch,
        breakType,
        autoDeductBreaks,
        minRestHoursAfter: Number(minRestHoursAfter),
        effectiveFrom: effectiveFrom || undefined,
        effectiveTo: effectiveTo || undefined,
      };

      let success = false;
      if (isEditing && initialShift) {
        success = await updateShift(initialShift.id, payload);
      } else {
        success = await addShift(payload);
      }

      if (success) {
        onOpenChange(false);
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            {isEditing ? `تعديل سياسة الوردية (${initialShift?.code})` : "إنشاء وردية دوام رسمية جديدة"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEditing
              ? "سيتم حفظ التعديلات وإصدار نسخة جديدة من الوردية لضمان سلامة السجلات السابقة"
              : "تحديد معايير الوردية، مواعيد الدخول والانصراف، فترات السماح وقواعد الراحة الإلزامية"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Shift Code & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-bold">كود الوردية</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SH-001"
                className="mt-1 font-mono text-xs"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-bold">الاسم بالعربية *</Label>
              <Input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="الوردية الصباحية المعتادة"
                className="mt-1 text-xs"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-bold">الاسم بالإنجليزية</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Morning Regular Shift"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          {/* Color & Shift Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-2xl p-4 bg-muted/20">
            <div>
              <Label className="text-xs font-bold block mb-2">نوع الوردية</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShiftType("fixed")}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    shiftType === "fixed"
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-border hover:bg-muted text-foreground"
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  <span>ثابتة (Fixed)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShiftType("flexible")}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    shiftType === "flexible"
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-border hover:bg-muted text-foreground"
                  }`}
                >
                  <Sliders className="h-4 w-4" />
                  <span>مرنة (Flexible)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShiftType("split")}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    shiftType === "split"
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-border hover:bg-muted text-foreground"
                  }`}
                >
                  <Split className="h-4 w-4" />
                  <span>مقسمة (Split)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShiftType("overnight")}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    shiftType === "overnight"
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-border hover:bg-muted text-foreground"
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  <span>ليلية (Overnight)</span>
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold block mb-2">لون الوردية في التقويم</Label>
              <div className="flex items-center gap-2 mt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                      color === c ? "scale-110 border-foreground shadow-xs" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-10 p-0 border-0 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                يظهر هذا اللون لتمييز ورديات الموظفين في شبكة الجدولة وتقويم الحضور.
              </p>
            </div>
          </div>

          {/* Timing details depending on type */}
          <div className="border rounded-2xl p-4 bg-card space-y-4">
            <h4 className="text-xs font-black flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              مواعيد العمل
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">
                  {shiftType === "split" ? "بداية الفترة الأولى" : "وقت الحضور الرسمي"}
                </Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 font-mono text-xs"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-bold">
                  {shiftType === "split" ? "نهاية الفترة الأولى" : "وقت الانصراف الرسمي"}
                </Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 font-mono text-xs"
                  required
                />
              </div>
            </div>

            {shiftType === "flexible" && (
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                <Label className="text-xs font-bold text-primary">عدد الساعات الإلزامية المطلوب إنجازها</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={16}
                    step={0.5}
                    value={flexibleHours}
                    onChange={(e) => setFlexibleHours(Number(e.target.value))}
                    className="max-w-[120px] text-xs font-bold"
                  />
                  <span className="text-xs text-muted-foreground">
                    ساعات عمل مطلوبة بين نطاق ({startTime} - {endTime})
                  </span>
                </div>
              </div>
            )}

            {shiftType === "split" && (
              <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/20 space-y-3">
                <p className="text-xs font-bold text-amber-700">الفترة الثانية (بعد الراحة المقررة)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold">بداية الفترة الثانية</Label>
                    <Input
                      type="time"
                      value={splitSecondStartTime}
                      onChange={(e) => setSplitSecondStartTime(e.target.value)}
                      className="mt-1 font-mono text-xs"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold">نهاية الفترة الثانية</Label>
                    <Input
                      type="time"
                      value={splitSecondEndTime}
                      onChange={(e) => setSplitSecondEndTime(e.target.value)}
                      className="mt-1 font-mono text-xs"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {shiftType === "overnight" && (
              <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20 flex items-center gap-2">
                <Moon className="h-4 w-4 text-indigo-600 shrink-0" />
                <span className="text-xs text-indigo-700 font-medium">
                  الوردية الليلية تمتد عبر منتصف الليل ويتم ربط بصماتها آلياً بيوم بداية الوردية وفق سياسات نظام العمل.
                </span>
              </div>
            )}
          </div>

          {/* Grace & Overtime Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-2xl p-4 bg-muted/20">
            <div>
              <Label className="text-xs font-bold">فترة السماح عند الحضور (بالدقائق)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={graceArrival}
                onChange={(e) => setGraceArrival(Number(e.target.value))}
                className="mt-1 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">لا يُحتسب تأخير إذا كان ضمن هذا النطاق</span>
            </div>
            <div>
              <Label className="text-xs font-bold">فترة السماح عند الانصراف (بالدقائق)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={graceDeparture}
                onChange={(e) => setGraceDeparture(Number(e.target.value))}
                className="mt-1 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">لا يُحتسب خروج مبكر إذا كان ضمن هذا النطاق</span>
            </div>
          </div>

          {/* Saudi Labor Law & Rest Rules */}
          <div className="border rounded-2xl p-4 bg-card space-y-4">
            <h4 className="text-xs font-black flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-4 w-4 text-primary" />
              قواعد فترات الراحة ونظام العمل
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-bold">نوع الاستراحة المقررة</Label>
                <select
                  value={breakType}
                  onChange={(e) => setBreakType(e.target.value as ShiftBreakType)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  <option value="none">بدون استراحة رسمية</option>
                  <option value="paid">استراحة مدفوعة الأجر</option>
                  <option value="unpaid">استراحة غير مدفوعة (تُخصم من الساعات)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold">الحد الأدنى لساعات الراحة بعدها</Label>
                <Input
                  type="number"
                  min={8}
                  max={24}
                  value={minRestHoursAfter}
                  onChange={(e) => setMinRestHoursAfter(Number(e.target.value))}
                  className="mt-1 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">افتراضياً 11 ساعة نظامية بين ورديتين</span>
              </div>

              <div>
                <Label className="text-xs font-bold">سريان الوردية من تاريخ</Label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                <span className="text-xs font-bold">أهلية احتساب الإضافي</span>
                <Switch checked={overtimeEligible} onCheckedChange={setOvertimeEligible} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                <span className="text-xs font-bold">خصم فترات الراحة آلياً</span>
                <Switch checked={autoDeductBreaks} onCheckedChange={setAutoDeductBreaks} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                <span className="text-xs font-bold">السماح ببصمة واحدة</span>
                <Switch checked={allowSinglePunch} onCheckedChange={setAllowSinglePunch} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs font-bold rounded-xl"
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="classera-btn-primary text-xs font-bold rounded-xl px-5"
            >
              {isSubmitting ? "جاري الحفظ..." : isEditing ? "حفظ التعديلات" : "إنشاء الوردية"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
