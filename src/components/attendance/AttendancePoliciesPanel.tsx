import React, { useState, useEffect } from "react";
import { ShieldCheck, MapPin, Clock, Save, Info, AlertTriangle, Globe, Layers, History } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  useAttendancePolicies,
  useAttendancePolicyVersions,
  useAttendanceMutations,
} from "../../lib/domains/attendance";
import type { AttendancePolicy } from "../../types";

interface Props {
  canManage: boolean;
}

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

export const AttendancePoliciesPanel: React.FC<Props> = ({ canManage }) => {
  const { policy, isLoading } = useAttendancePolicies();
  const { versions } = useAttendancePolicyVersions();
  const { updatePolicy } = useAttendanceMutations();

  const [form, setForm] = useState<Partial<AttendancePolicy>>({});
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>("custom");
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (policy) {
      setForm(policy);
      setSelectedJurisdiction(policy.jurisdiction || "custom");
    }
  }, [policy]);

  const handleApplyPreset = (code: string) => {
    if (!canManage) return;
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
    if (!canManage) return;
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
        جاري تحميل سياسات وقواعد الدوام…
      </div>
    );
  }

  const jurisdictionTitle =
    selectedJurisdiction === "SA"
      ? "نظام العمل السعودي (المواد 98 و 101 و 107)"
      : selectedJurisdiction === "EG"
        ? "قانون العمل المصري رقم 12 لسنة 2003"
        : selectedJurisdiction === "QA"
          ? "قانون العمل القطري رقم 14 لسنة 2004"
          : "اللائحة الداخلية المعتمدة لتنظيم العمل بالمنشأة";

  const jurisdictionDesc =
    selectedJurisdiction === "SA"
      ? "تطبق هذه السياسة المعايير القانونية الصارمة للمواد (98 لساعات العمل اليومية والأسبوعية، و101 لفترات الراحة، و107 لاحتساب أجر العمل الإضافي بنسبة 150% للأيام العادية و200% للعطلات والأعياد)."
      : selectedJurisdiction === "EG"
        ? "تطبق هذه السياسة معايير قانون العمل المصري (8 ساعات يومياً، و48 ساعة أسبوعياً كحد أقصى، واحتساب العمل الإضافي بنسبة 135% للنهاري و170% لليلي)."
        : selectedJurisdiction === "QA"
          ? "تطبق هذه السياسة معايير قانون العمل القطري (8 ساعات يومياً و36 ساعة في شهر رمضان المبارك، واحتساب العمل الإضافي بنسبة 125% للأيام العادية و150% للعطلات)."
          : "تعتمد هذه السياسة القواعد التنظيمية المخصصة المعتمدة للمنشأة دون تقييد بقالب قانوني محدد مسبقاً.";

  return (
    <div className="space-y-6">
      {/* Jurisdiction Status Banner */}
      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-foreground block">
              الإطار التنظيمي المعتمد: {jurisdictionTitle}
            </span>
            <p className="text-muted-foreground leading-relaxed">{jurisdictionDesc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {policy ? (
            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 rounded-full text-xs font-bold">
              الإصدار v{policy.version} (ساري)
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300 rounded-full text-xs font-bold">
              غير مهيأة بعد
            </Badge>
          )}

          {versions.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="rounded-full text-xs gap-1 h-8"
            >
              <History className="h-3.5 w-3.5" />
              سجل النسخ ({versions.length})
            </Button>
          )}
        </div>
      </div>

      {/* Preset Selector */}
      {canManage && (
        <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Globe className="h-4 w-4 text-primary" />
              تطبيق نموذج نظام عمل معتمد
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
      )}

      {/* Version History Drawer / List */}
      {showHistory && (
        <div className="p-4 rounded-2xl border border-border/80 bg-card space-y-3">
          <div className="font-bold text-xs flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            سجل وتاريخ نسخ سياسة الحضور المعتمدة
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/60">
                <tr>
                  <th className="py-2 px-3 text-start">الإصدار</th>
                  <th className="py-2 px-3 text-start">اسم السياسة</th>
                  <th className="py-2 px-3 text-start">النظام</th>
                  <th className="py-2 px-3 text-start">تاريخ السريان</th>
                  <th className="py-2 px-3 text-start">تاريخ الانتهاء</th>
                  <th className="py-2 px-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {versions.map((ver) => (
                  <tr key={ver.id} className="hover:bg-muted/20">
                    <td className="py-2 px-3 font-mono font-bold">v{ver.version}</td>
                    <td className="py-2 px-3">{ver.nameAr}</td>
                    <td className="py-2 px-3">{ver.jurisdiction || "مخصص"}</td>
                    <td className="py-2 px-3 font-mono">{ver.effectiveFrom}</td>
                    <td className="py-2 px-3 font-mono">{ver.effectiveTo || "مستمر"}</td>
                    <td className="py-2 px-3 text-center">
                      <Badge
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          ver.status === "active"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {ver.status === "active" ? "نشط" : "مؤرشف"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Working Hours & Grace Periods */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Clock className="h-5 w-5 text-indigo-600" />
            ساعات الدوام الرسمية وفترات السماح
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1.5">
                اسم السياسة الرسمية
              </label>
              <input
                type="text"
                disabled={!canManage}
                value={form.nameAr || ""}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1.5">
                  سماح الحضور (بالدقائق)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  disabled={!canManage}
                  value={form.gracePeriodInMinutes ?? 15}
                  onChange={(e) =>
                    setForm({ ...form, gracePeriodInMinutes: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1.5">
                  سماح الانصراف (بالدقائق)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  disabled={!canManage}
                  value={form.gracePeriodOutMinutes ?? 15}
                  onChange={(e) =>
                    setForm({ ...form, gracePeriodOutMinutes: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1.5">
                  ساعات الدوام اليومي (العادي)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={4}
                  max={12}
                  disabled={!canManage}
                  value={form.defaultWorkHoursPerDay ?? 8}
                  onChange={(e) =>
                    setForm({ ...form, defaultWorkHoursPerDay: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  مادة 98: 8 ساعات كحد أقصى
                </span>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1.5">
                  ساعات دوام رمضان (يومي)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={4}
                  max={8}
                  disabled={!canManage}
                  value={form.ramadanWorkHoursPerDay ?? 6}
                  onChange={(e) =>
                    setForm({ ...form, ramadanWorkHoursPerDay: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  مادة 98: 6 ساعات للمسلمين
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1.5">
                  فترة الراحة اليومية (دقائق)
                </label>
                <input
                  type="number"
                  min={30}
                  max={120}
                  disabled={!canManage}
                  value={form.breakDurationMinutes ?? 60}
                  onChange={(e) =>
                    setForm({ ...form, breakDurationMinutes: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  مادة 101: لا تقل عن 30 دقيقة
                </span>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1.5">
                  أقصى عمل متواصل قبل الراحة
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={3}
                  max={5}
                  disabled={!canManage}
                  value={form.maxConsecutiveHoursWithoutBreak ?? 5}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxConsecutiveHoursWithoutBreak: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  مادة 101: 5 ساعات كحد أقصى
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Overtime & Geofence GPS Settings */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <MapPin className="h-5 w-5 text-emerald-600" />
            السياج الجغرافي والعمل الإضافي
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1.5">
                  مضاعف الإضافي العادي
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={1.0}
                  max={3.0}
                  disabled={!canManage}
                  value={form.overtimeRegularMultiplier ?? 1.5}
                  onChange={(e) =>
                    setForm({ ...form, overtimeRegularMultiplier: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  المادة 107: 150% من الأجر الأساسي
                </span>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1.5">
                  مضاعف إضافي العطلات والأعياد
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={1.5}
                  max={3.0}
                  disabled={!canManage}
                  value={form.overtimeHolidayMultiplier ?? 2.0}
                  onChange={(e) =>
                    setForm({ ...form, overtimeHolidayMultiplier: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  المادة 107: 200% للعطلات الأسبوعية
                </span>
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1.5">
                نطاق السياج الجغرافي الافتراضي (بالمتر)
              </label>
              <input
                type="number"
                min={50}
                max={2000}
                disabled={!canManage}
                value={form.geofenceRadiusMeters ?? 200}
                onChange={(e) =>
                  setForm({ ...form, geofenceRadiusMeters: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 outline-none font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                أقصى مسافة مسموح بها بين موقع الموظف ومقر العمل عند تسجيل البصمة
              </span>
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-muted/20 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManage}
                  checked={form.geofenceEnforced ?? true}
                  onChange={(e) => setForm({ ...form, geofenceEnforced: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary/20"
                />
                <div>
                  <span className="font-bold text-foreground block">
                    إلزامية مطابقة السياج الجغرافي GPS
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    توليد استثناء وتنبيه تدقيقي عند تسجيل بصمة خارج النطاق المعتمد
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-muted/20 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManage}
                  checked={form.overtimePreApprovalRequired ?? true}
                  onChange={(e) =>
                    setForm({ ...form, overtimePreApprovalRequired: e.target.checked })
                  }
                  className="rounded border-border text-primary focus:ring-primary/20"
                />
                <div>
                  <span className="font-bold text-foreground block">
                    اشتراط الموافقة المسبقة للعمل الإضافي
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    عدم احتساب الساعات الزائدة ضمن الراتب دون تكليف أو اعتماد مسبق
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-muted/20 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManage}
                  checked={form.allowMobilePunch ?? true}
                  onChange={(e) => setForm({ ...form, allowMobilePunch: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary/20"
                />
                <div>
                  <span className="font-bold text-foreground block">
                    السماح بالبصمة من تطبيق الجوال
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    تمكين الموظف من تسجيل الحضور عبر الهاتف الذكي الموثق وموقع GPS
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-2xl font-bold px-6 py-2.5 gap-2 text-xs"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "جاري الحفظ…" : "حفظ وتثبيت السياسات"}
          </Button>
        </div>
      )}
    </div>
  );
};
