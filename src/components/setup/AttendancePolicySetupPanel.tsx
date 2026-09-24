import React, { useState, useEffect } from "react";
import { ShieldCheck, Clock, MapPin, Save, CheckCircle2, AlertTriangle, Layers, Globe } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useAttendancePolicies, useAttendanceMutations } from "../../lib/domains/attendance";
import type { AttendancePolicy } from "../../types";

const JURISDICTION_PRESETS: Record<string, Partial<AttendancePolicy>> = {
  SA: {
    nameAr: "سياسة نظام العمل السعودي",
    jurisdiction: "SA",
    defaultWorkHoursPerDay: 8,
    ramadanWorkHoursPerDay: 6,
    maxWorkHoursPerWeek: 48,
    ramadanMaxWorkHoursPerWeek: 36,
    gracePeriodInMinutes: 15,
    gracePeriodOutMinutes: 15,
    overtimeRegularMultiplier: 1.5,
    overtimeHolidayMultiplier: 2.0,
    breakDurationMinutes: 60,
    maxConsecutiveHoursWithoutBreak: 5,
    geofenceEnforced: true,
    geofenceRadiusMeters: 200,
    maxGpsAccuracyMeters: 100,
    autoDeductBreaks: true,
    requireBiometricOrGps: true,
    allowMobilePunch: true,
    overtimePreApprovalRequired: true,
  },
  EG: {
    nameAr: "سياسة قانون العمل المصري (قانون 12 لسنة 2003)",
    jurisdiction: "EG",
    defaultWorkHoursPerDay: 8,
    ramadanWorkHoursPerDay: null,
    maxWorkHoursPerWeek: 48,
    ramadanMaxWorkHoursPerWeek: null,
    gracePeriodInMinutes: 15,
    gracePeriodOutMinutes: 15,
    overtimeRegularMultiplier: 1.35,
    overtimeHolidayMultiplier: 1.7,
    breakDurationMinutes: 60,
    maxConsecutiveHoursWithoutBreak: 5,
    geofenceEnforced: true,
    geofenceRadiusMeters: 200,
    maxGpsAccuracyMeters: 100,
    autoDeductBreaks: true,
    requireBiometricOrGps: true,
    allowMobilePunch: true,
    overtimePreApprovalRequired: true,
  },
  QA: {
    nameAr: "سياسة قانون العمل القطري (قانون 14 لسنة 2004)",
    jurisdiction: "QA",
    defaultWorkHoursPerDay: 8,
    ramadanWorkHoursPerDay: 6,
    maxWorkHoursPerWeek: 48,
    ramadanMaxWorkHoursPerWeek: 36,
    gracePeriodInMinutes: 15,
    gracePeriodOutMinutes: 15,
    overtimeRegularMultiplier: 1.25,
    overtimeHolidayMultiplier: 1.5,
    breakDurationMinutes: 60,
    maxConsecutiveHoursWithoutBreak: 5,
    geofenceEnforced: true,
    geofenceRadiusMeters: 200,
    maxGpsAccuracyMeters: 100,
    autoDeductBreaks: true,
    requireBiometricOrGps: true,
    allowMobilePunch: true,
    overtimePreApprovalRequired: true,
  },
};

export const AttendancePolicySetupPanel: React.FC = () => {
  const { policy, isLoading } = useAttendancePolicies();
  const { updatePolicy } = useAttendanceMutations();
  const [form, setForm] = useState<Partial<AttendancePolicy>>({});
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>("custom");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (policy) {
      setForm(policy);
      setSelectedJurisdiction(policy.jurisdiction || "custom");
    }
  }, [policy]);

  const handleApplyPreset = (code: string) => {
    setSelectedJurisdiction(code);
    if (code === "custom") {
      setForm((prev) => ({ ...prev, jurisdiction: "custom" }));
    } else {
      const preset = JURISDICTION_PRESETS[code];
      if (preset) {
        setForm((prev) => ({
          ...prev,
          ...preset,
          effectiveFrom: prev.effectiveFrom || new Date().toISOString().slice(0, 10),
        }));
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePolicy({
        ...form,
        effectiveFrom: form.effectiveFrom || new Date().toISOString().slice(0, 10),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        جاري تحميل سياسة الدوام…
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-black text-sm text-foreground">
              تهيئة سياسات وقواعد الحضور والعمل
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              تحديد ساعات العمل الرسمية، فترات السماح، مضاعفات العمل الإضافي، ونطاق السياج الجغرافي GPS
            </p>
          </div>
        </div>

        {policy ? (
          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 rounded-full text-xs font-bold gap-1 self-start sm:self-center">
            <ShieldCheck className="h-3.5 w-3.5" />
            النسخة المعتمدة v{policy.version} (سارية من {policy.effectiveFrom})
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300 rounded-full text-xs font-bold gap-1 self-start sm:self-center">
            <AlertTriangle className="h-3.5 w-3.5" />
            لم يتم حفظ سياسة بعد
          </Badge>
        )}
      </div>

      {/* Jurisdiction Preset Picker */}
      <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Globe className="h-4 w-4 text-primary" />
            نماذج وقوالب الأنظمة العمالية المعتمدة (Jurisdiction Presets)
          </div>
          <span className="text-[11px] text-muted-foreground">اختر نموذجاً لتطبيق المعايير القانونية تلقائياً</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => handleApplyPreset("SA")}
            className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
              selectedJurisdiction === "SA"
                ? "border-emerald-500 bg-emerald-500/10 text-foreground font-bold shadow-xs"
                : "border-border/70 hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <span className="text-xs block font-bold text-foreground">المملكة العربية السعودية</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">نظام العمل (م98، م107)</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("EG")}
            className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
              selectedJurisdiction === "EG"
                ? "border-blue-500 bg-blue-500/10 text-foreground font-bold shadow-xs"
                : "border-border/70 hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <span className="text-xs block font-bold text-foreground">جمهورية مصر العربية</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">قانون العمل 12/2003</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("QA")}
            className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
              selectedJurisdiction === "QA"
                ? "border-purple-500 bg-purple-500/10 text-foreground font-bold shadow-xs"
                : "border-border/70 hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <span className="text-xs block font-bold text-foreground">دولة قطر</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">قانون العمل 14/2004</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("custom")}
            className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
              selectedJurisdiction === "custom"
                ? "border-primary bg-primary/10 text-foreground font-bold shadow-xs"
                : "border-border/70 hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <span className="text-xs block font-bold text-foreground">مخصص / لائحة داخلية</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">تحديد يدوي للمدد والنسب</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* Work hours & grace */}
        <div className="space-y-4 p-4 rounded-2xl border border-border/60 bg-muted/20">
          <div className="font-bold text-foreground text-xs flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            ساعات الدوام وسماح الدخول/الخروج
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">
              اسم السياسة الرسمية
            </label>
            <input
              type="text"
              value={form.nameAr || ""}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
              placeholder="مثال: سياسة الدوام الرسمية للمنشأة"
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-foreground block mb-1">
                سماح الحضور (دقائق)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={form.gracePeriodInMinutes ?? ""}
                placeholder="غير محدد"
                onChange={(e) =>
                  setForm({
                    ...form,
                    gracePeriodInMinutes: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                سماح الانصراف (دقائق)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={form.gracePeriodOutMinutes ?? ""}
                placeholder="غير محدد"
                onChange={(e) =>
                  setForm({
                    ...form,
                    gracePeriodOutMinutes: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-foreground block mb-1">
                ساعات العمل اليومية (عادي)
              </label>
              <input
                type="number"
                step="0.5"
                min={4}
                max={12}
                value={form.defaultWorkHoursPerDay ?? ""}
                placeholder="غير محدد"
                onChange={(e) =>
                  setForm({
                    ...form,
                    defaultWorkHoursPerDay: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                ساعات العمل اليومية (رمضان)
              </label>
              <input
                type="number"
                step="0.5"
                min={4}
                max={8}
                value={form.ramadanWorkHoursPerDay ?? ""}
                placeholder="غير محدد"
                onChange={(e) =>
                  setForm({
                    ...form,
                    ramadanWorkHoursPerDay: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-foreground block mb-1">
                ساعات العمل الأسبوعية (عادي)
              </label>
              <input
                type="number"
                step="1"
                min={20}
                max={60}
                value={form.maxWorkHoursPerWeek ?? ""}
                placeholder="غير محدد"
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxWorkHoursPerWeek: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                ساعات العمل الأسبوعية (رمضان)
              </label>
              <input
                type="number"
                step="1"
                min={20}
                max={48}
                value={form.ramadanMaxWorkHoursPerWeek ?? ""}
                placeholder="غير محدد"
                onChange={(e) =>
                  setForm({
                    ...form,
                    ramadanMaxWorkHoursPerWeek: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Overtime & Geofence */}
        <div className="space-y-4 p-4 rounded-2xl border border-border/60 bg-muted/20">
          <div className="font-bold text-foreground text-xs flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            العمل الإضافي والسياج الجغرافي GPS
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-foreground block mb-1">
                مضاعف الإضافي العادي
              </label>
              <input
                type="number"
                step="0.05"
                min={1.0}
                max={3.0}
                value={form.overtimeRegularMultiplier ?? ""}
                placeholder="غير محدد"
                onChange={(e) =>
                  setForm({
                    ...form,
                    overtimeRegularMultiplier: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                مضاعف إضافي العطلات
              </label>
              <input
                type="number"
                step="0.05"
                min={1.0}
                max={3.0}
                value={form.overtimeHolidayMultiplier ?? ""}
                placeholder="غير محدد"
                onChange={(e) =>
                  setForm({
                    ...form,
                    overtimeHolidayMultiplier: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-foreground block mb-1">
                نطاق السياج الافتراضي (متر)
              </label>
              <input
                type="number"
                min={50}
                max={2000}
                value={form.geofenceRadiusMeters ?? ""}
                placeholder="200"
                onChange={(e) =>
                  setForm({
                    ...form,
                    geofenceRadiusMeters: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                أقصى دقة GPS مقبولة (متر)
              </label>
              <input
                type="number"
                min={20}
                max={500}
                value={form.maxGpsAccuracyMeters ?? ""}
                placeholder="100"
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxGpsAccuracyMeters: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.geofenceEnforced ?? true}
                onChange={(e) => setForm({ ...form, geofenceEnforced: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="font-medium text-foreground">إلزامية مطابقة السياج الجغرافي GPS</span>
            </label>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowMobilePunch ?? true}
                onChange={(e) => setForm({ ...form, allowMobilePunch: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="font-medium text-foreground">السماح بتسجيل الحضور عبر تطبيق الجوال</span>
            </label>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.overtimePreApprovalRequired ?? true}
                onChange={(e) => setForm({ ...form, overtimePreApprovalRequired: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="font-medium text-foreground">اشتراط الموافقة المسبقة لاحتساب العمل الإضافي</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          الحفظ ينشئ نسخة جديدة سارية المفعول تلقائياً ويؤرشف النسخة السابقة
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-2xl font-bold px-6 py-2.5 gap-2 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "جاري الحفظ واعتماد النسخة…" : "حفظ واعتماد سياسة الدوام"}
        </Button>
      </div>
    </div>
  );
};
