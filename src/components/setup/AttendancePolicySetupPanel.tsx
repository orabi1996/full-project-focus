import React, { useState, useEffect } from "react";
import { ShieldCheck, Clock, MapPin, Save, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useAttendancePolicies, useAttendanceMutations } from "../../lib/domains/attendance";
import type { AttendancePolicy } from "../../types";

export const AttendancePolicySetupPanel: React.FC = () => {
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
        جاري تحميل سياسة الدوام…
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-black text-sm text-foreground">
              تهيئة سياسات الحضور ونظام العمل (Saudi Labor Law)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              تحديد ساعات العمل الرسمية، فترات السماح، مضاعفات العمل الإضافي، ونطاق السياج الجغرافي GPS
            </p>
          </div>
        </div>

        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 rounded-full text-xs font-bold gap-1 self-start sm:self-center">
          <ShieldCheck className="h-3.5 w-3.5" />
          متوافقة مع المواد 98 و 101 و 107
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* Work hours & grace */}
        <div className="space-y-4 p-4 rounded-2xl border border-border/60 bg-muted/20">
          <div className="font-bold text-foreground text-xs flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            ساعات الدوام وسماح الدخول/الخروج
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
                value={form.gracePeriodInMinutes ?? 15}
                onChange={(e) =>
                  setForm({ ...form, gracePeriodInMinutes: Number(e.target.value) })
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
                value={form.gracePeriodOutMinutes ?? 15}
                onChange={(e) =>
                  setForm({ ...form, gracePeriodOutMinutes: Number(e.target.value) })
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
                value={form.defaultWorkHoursPerDay ?? 8}
                onChange={(e) =>
                  setForm({ ...form, defaultWorkHoursPerDay: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                مادة 98: 8 ساعات كحد أقصى
              </span>
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
                value={form.ramadanWorkHoursPerDay ?? 6}
                onChange={(e) =>
                  setForm({ ...form, ramadanWorkHoursPerDay: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                مادة 98: 6 ساعات للمسلمين
              </span>
            </div>
          </div>
        </div>

        {/* Overtime & Geofence */}
        <div className="space-y-4 p-4 rounded-2xl border border-border/60 bg-muted/20">
          <div className="font-bold text-foreground text-xs flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            العمل الإضافي والسياج الجغرافي
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-foreground block mb-1">
                مضاعف الإضافي العادي
              </label>
              <input
                type="number"
                step="0.1"
                min={1.0}
                max={3.0}
                value={form.overtimeRegularMultiplier ?? 1.5}
                onChange={(e) =>
                  setForm({ ...form, overtimeRegularMultiplier: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                مادة 107: 150% من الأجر
              </span>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                مضاعف إضافي العطلات
              </label>
              <input
                type="number"
                step="0.1"
                min={1.5}
                max={3.0}
                value={form.overtimeHolidayMultiplier ?? 2.0}
                onChange={(e) =>
                  setForm({ ...form, overtimeHolidayMultiplier: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                مادة 107: 200% للعطلات
              </span>
            </div>
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">
              نطاق السياج الجغرافي الافتراضي (بالمتر)
            </label>
            <input
              type="number"
              min={50}
              max={2000}
              value={form.geofenceRadiusMeters ?? 200}
              onChange={(e) =>
                setForm({ ...form, geofenceRadiusMeters: Number(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground outline-none font-mono"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-2xl font-bold px-6 py-2.5 gap-2 text-xs"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "جاري الحفظ…" : "حفظ واعتماد سياسة الدوام"}
        </Button>
      </div>
    </div>
  );
};
