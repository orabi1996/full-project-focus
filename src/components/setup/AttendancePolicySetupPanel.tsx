import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, MapPin, CalendarClock, Save } from "lucide-react";
import { Button } from "../ui/button";
import {
  fetchAttendancePolicyRecord,
  saveAttendancePolicyRecord,
} from "../../lib/data/operational-repository";
import { queryKeys } from "../../lib/query/query-keys";

type MissingPunchBehavior = "flag" | "absent" | "ignore";

export const AttendancePolicySetupPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const policyQuery = useQuery({
    queryKey: queryKeys.attendance.policy(),
    queryFn: fetchAttendancePolicyRecord,
    staleTime: 30_000,
  });

  const [allowMobilePunch, setAllowMobilePunch] = useState(false);
  const [requireGeofence, setRequireGeofence] = useState(false);
  const [autoApproveMobilePunches, setAutoApproveMobilePunches] = useState(false);
  const [allowOutsideGeofenceWithReason, setAllowOutsideGeofenceWithReason] =
    useState(false);
  const [maxLocationAccuracyMeters, setMaxLocationAccuracyMeters] =
    useState<number | "">(50);
  const [requirePublishedSchedule, setRequirePublishedSchedule] = useState(true);
  const [missingPunchBehavior, setMissingPunchBehavior] =
    useState<MissingPunchBehavior>("flag");
  const [overtimeRequiresApproval, setOvertimeRequiresApproval] = useState(true);
  const [earlyDepartureGraceMinutes, setEarlyDepartureGraceMinutes] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const policy = policyQuery.data;
    if (!policy?.configured) return;
    setAllowMobilePunch(policy.allowMobilePunch);
    setRequireGeofence(policy.requireGeofence);
    setAutoApproveMobilePunches(policy.autoApproveMobilePunches);
    setAllowOutsideGeofenceWithReason(policy.allowOutsideGeofenceWithReason);
    setMaxLocationAccuracyMeters(policy.maxLocationAccuracyMeters ?? "");
    setRequirePublishedSchedule(policy.requirePublishedSchedule);
    setMissingPunchBehavior(policy.missingPunchBehavior);
    setOvertimeRequiresApproval(policy.overtimeRequiresApproval);
    setEarlyDepartureGraceMinutes(policy.earlyDepartureGraceMinutes);
  }, [policyQuery.data]);

  const handleSave = async () => {
    if (requireGeofence && maxLocationAccuracyMeters === "") {
      toast.error("حدد حد دقة GPS عند تفعيل السياج الجغرافي.");
      return;
    }
    if (
      maxLocationAccuracyMeters !== "" &&
      (!Number.isFinite(Number(maxLocationAccuracyMeters)) ||
        Number(maxLocationAccuracyMeters) <= 0)
    ) {
      toast.error("حد دقة الموقع يجب أن يكون أكبر من صفر.");
      return;
    }
    if (earlyDepartureGraceMinutes < 0) {
      toast.error("فترة سماح الانصراف المبكر لا يمكن أن تكون سالبة.");
      return;
    }

    setSaving(true);
    try {
      await saveAttendancePolicyRecord({
        allowMobilePunch,
        requireGeofence,
        autoApproveMobilePunches,
        allowOutsideGeofenceWithReason,
        maxLocationAccuracyMeters:
          maxLocationAccuracyMeters === "" ? null : Number(maxLocationAccuracyMeters),
        requirePublishedSchedule,
        missingPunchBehavior,
        overtimeRequiresApproval,
        earlyDepartureGraceMinutes,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
      toast.success("تم حفظ سياسة الحضور للمنشأة.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ سياسة الحضور.");
    } finally {
      setSaving(false);
    }
  };

  const ToggleRow = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card p-4 cursor-pointer">
      <div>
        <div className="text-sm font-black text-foreground">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-primary"
      />
    </label>
  );

  if (policyQuery.isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
        جاري تحميل سياسة الحضور...
      </div>
    );
  }

  if (policyQuery.isError) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {policyQuery.error instanceof Error
          ? policyQuery.error.message
          : "تعذر تحميل سياسة الحضور."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border/70 bg-card p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-black text-foreground">سياسة الحضور والانصراف</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              هذه القيم هي المصدر التشغيلي الفعلي لوحدة الحضور. لا توجد افتراضات
              قانونية أو أسبوع عمل مخفية داخل الشاشة.
            </p>
          </div>
        </div>
        {!policyQuery.data?.configured && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-500/10 p-3 text-xs text-amber-800">
            لم تُحفظ سياسة حضور للمنشأة بعد. العمليات التي تحتاج سياسة صريحة ستبقى
            متوقفة حتى الحفظ.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ToggleRow
          label="السماح بتسجيل الحضور من الجوال"
          description="يتيح للموظف إنشاء بصمة GPS من حسابه المرتبط بملف الموظف."
          checked={allowMobilePunch}
          onChange={setAllowMobilePunch}
        />
        <ToggleRow
          label="إلزام السياج الجغرافي"
          description="يتطلب إحداثيات موقع العمل ودقة GPS مقبولة قبل تسجيل البصمة."
          checked={requireGeofence}
          onChange={setRequireGeofence}
        />
        <ToggleRow
          label="الاعتماد التلقائي لبصمات الجوال"
          description="لا يُنصح بتفعيله إلا بعد اكتمال الموقع والجدولة وسياسة الاستثناءات."
          checked={autoApproveMobilePunches}
          onChange={setAutoApproveMobilePunches}
        />
        <ToggleRow
          label="السماح بخارج النطاق مع مبرر"
          description="إذا كان السياج إلزامياً، تسجل الحالة للمراجعة فقط عند وجود مبرر."
          checked={allowOutsideGeofenceWithReason}
          onChange={setAllowOutsideGeofenceWithReason}
        />
        <ToggleRow
          label="اشتراط جدول دوام منشور"
          description="يمنع معالجة الحضور أو بصمة الجوال بدون Schedule فعلي لذلك اليوم."
          checked={requirePublishedSchedule}
          onChange={setRequirePublishedSchedule}
        />
        <ToggleRow
          label="العمل الإضافي يحتاج اعتماداً"
          description="مدة التكليف تُعتمد في الحضور، بينما التسعير المالي يتم داخل Payroll."
          checked={overtimeRequiresApproval}
          onChange={setOvertimeRequiresApproval}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-3xl border border-border/70 bg-card p-5 md:grid-cols-3">
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs font-bold">
            <MapPin className="h-4 w-4 text-primary" />
            أقصى دقة GPS بالمتر
          </label>
          <input
            type="number"
            min={1}
            value={maxLocationAccuracyMeters}
            onChange={(event) =>
              setMaxLocationAccuracyMeters(
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
            disabled={!requireGeofence}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs font-bold">
            <CalendarClock className="h-4 w-4 text-primary" />
            سياسة البصمة الناقصة
          </label>
          <select
            value={missingPunchBehavior}
            onChange={(event) =>
              setMissingPunchBehavior(event.target.value as MissingPunchBehavior)
            }
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="flag">حالة للمراجعة</option>
            <option value="absent">تسجيل غياب</option>
            <option value="ignore">تجاهل اليوم</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold">سماح الانصراف المبكر (دقيقة)</label>
          <input
            type="number"
            min={0}
            value={earlyDepartureGraceMinutes}
            onChange={(event) =>
              setEarlyDepartureGraceMinutes(Number(event.target.value || 0))
            }
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="rounded-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? "جاري الحفظ..." : "حفظ سياسة الحضور"}
        </Button>
      </div>
    </div>
  );
};
