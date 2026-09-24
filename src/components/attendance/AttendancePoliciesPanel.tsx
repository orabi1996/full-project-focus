import React, { useState, useEffect } from "react";
import { ShieldCheck, MapPin, Clock, Save, Info, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useAttendancePolicies, useAttendanceMutations } from "../../lib/domains/attendance";
import type { AttendancePolicy } from "../../types";

interface Props {
  canManage: boolean;
}

export const AttendancePoliciesPanel: React.FC<Props> = ({ canManage }) => {
  const { policy, isLoading } = useAttendancePolicies();
  const { updatePolicy } = useAttendanceMutations();

  const [form, setForm] = useState<Partial<AttendancePolicy>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (policy) {
      setForm(policy);
    }
  }, [policy]);

  const handleSave = async () => {
    if (!canManage) return;
    setIsSaving(true);
    try {
      await updatePolicy(form);
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

  return (
    <div className="space-y-6">
      {/* Saudi Labor Law Banner */}
      <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-bold text-emerald-900 dark:text-emerald-300 block">
            التوافق التام مع نظام العمل السعودي واللوائح التنفيذية
          </span>
          <p className="text-muted-foreground leading-relaxed">
            تطبق هذه السياسة المعايير القانونية الصارمة للمواد (98 لساعات العمل اليومية والأسبوعية، و101 لفترات الراحة والصلاة، و107 لاحتساب أجر العمل الإضافي بنسبة 150% للأيام العادية و200% للعطلات والأعياد).
          </p>
        </div>
      </div>

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
