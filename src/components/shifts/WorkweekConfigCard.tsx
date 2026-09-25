import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AlertTriangle, Calendar, Save, ShieldCheck } from "lucide-react";
import type { WorkweekConfig } from "../../types";
import { useCompanyWorkweek, useRosterMutations } from "../../lib/domains/shifts";

interface WorkweekConfigCardProps {
  companyId?: string;
  canManage?: boolean;
}

const DAYS = [
  { value: 0, label: "الأحد" },
  { value: 1, label: "الإثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
];

export const WorkweekConfigCard: React.FC<WorkweekConfigCardProps> = ({
  companyId,
  canManage = true,
}) => {
  const { workweek, isLoading } = useCompanyWorkweek(companyId);
  const { saveWorkweek } = useRosterMutations(companyId);

  // Initialize without hardcoded Friday/Saturday
  const [weekendDays, setWeekendDays] = useState<number[]>([]);
  const [maxConsecutiveWorkDays, setMaxConsecutiveWorkDays] = useState<number | "">("");
  const [minWeeklyRestHours, setMinWeeklyRestHours] = useState<number | "">("");
  const [defaultDailyHours, setDefaultDailyHours] = useState<number | "">("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (workweek) {
      setWeekendDays(workweek.weekendDays || []);
      setMaxConsecutiveWorkDays(workweek.maxConsecutiveWorkDays ?? "");
      setMinWeeklyRestHours(workweek.minWeeklyRestHours ?? "");
      setDefaultDailyHours(workweek.defaultDailyHours ?? "");
    }
  }, [workweek]);

  const toggleDay = (dayVal: number) => {
    if (!canManage) return;
    setWeekendDays((prev) =>
      prev.includes(dayVal) ? prev.filter((d) => d !== dayVal) : [...prev, dayVal],
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveWorkweek({
        weekendDays,
        maxConsecutiveWorkDays: maxConsecutiveWorkDays !== "" ? Number(maxConsecutiveWorkDays) : undefined,
        minWeeklyRestHours: minWeeklyRestHours !== "" ? Number(minWeeklyRestHours) : undefined,
        defaultDailyHours: defaultDailyHours !== "" ? Number(defaultDailyHours) : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            قواعد أسبوع العمل الخاصة بالمنشأة (Workweek & Rest Policy)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            تحديد أيام الراحة الأسبوعية المعتمدة للمنشأة والحدود التشغيلية لاحتساب أيام العمل والراحة في الجداول.
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="classera-btn-primary text-xs font-bold rounded-xl h-9 px-4 gap-1.5 shadow-xs"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </Button>
        )}
      </div>

      {!isLoading && !workweek && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-800 dark:text-amber-400">
              لم يتم تكوين سياسة أسبوع العمل للمنشأة بعد
            </p>
            <p className="text-muted-foreground">
              يرجى تحديد أيام الراحة الأسبوعية والحدود التشغيلية أدناه وحفظها لتطبيقها عند توليد وفحص جداول العمل.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Weekend Days Selection */}
        <div>
          <Label className="text-xs font-bold block mb-2">أيام الراحة الأسبوعية المعتمدة للمنشأة</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const isSelected = weekendDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  disabled={!canManage}
                  className={`py-2 px-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border/80 bg-muted/20 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d.label} {isSelected && "✓"}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] text-muted-foreground block mt-1.5">
            الأيام المحددة يتم اعتبارها أيام راحة (Off Days) للمنشأة عند جدولة وتوزيع الورديات.
          </span>
        </div>

        {/* Operating Thresholds */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3.5 bg-muted/20 rounded-2xl border border-border/60 space-y-1.5">
            <Label className="text-xs font-bold">أقصى أيام عمل متتالية</Label>
            <Input
              type="number"
              min={1}
              max={14}
              value={maxConsecutiveWorkDays}
              onChange={(e) => setMaxConsecutiveWorkDays(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={!canManage}
              placeholder="مثال: 6"
              className="text-xs font-mono"
            />
            <span className="text-[10px] text-muted-foreground block">
              الحد الأقصى لأيام العمل المتتالية المسموح بها للموظف قبل وجوب يوم راحة.
            </span>
          </div>

          <div className="p-3.5 bg-muted/20 rounded-2xl border border-border/60 space-y-1.5">
            <Label className="text-xs font-bold">الحد الأدنى لساعات الراحة الأسبوعية</Label>
            <Input
              type="number"
              min={12}
              max={72}
              value={minWeeklyRestHours}
              onChange={(e) => setMinWeeklyRestHours(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={!canManage}
              placeholder="مثال: 24"
              className="text-xs font-mono"
            />
            <span className="text-[10px] text-muted-foreground block">
              الحد الأدنى من الساعات المتتالية للراحة الأسبوعية المقررة.
            </span>
          </div>

          <div className="p-3.5 bg-muted/20 rounded-2xl border border-border/60 space-y-1.5">
            <Label className="text-xs font-bold">ساعات العمل اليومية القياسية</Label>
            <Input
              type="number"
              min={1}
              max={16}
              value={defaultDailyHours}
              onChange={(e) => setDefaultDailyHours(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={!canManage}
              placeholder="مثال: 8"
              className="text-xs font-mono"
            />
            <span className="text-[10px] text-muted-foreground block">
              عدد ساعات العمل المعتمدة لاحتساب الدوام اليومي القياسي.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
