import React, { useCallback, useEffect, useState } from "react";
import { Fingerprint, Cpu, RefreshCw, CheckCircle2, XCircle, Lock, KeyRound, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useApp } from "../../lib/context/AppContext";
import {
  decidePunchServer,
  listBiometricDevicesServer,
  listPunchesServer,
  recordPunchServer,
  registerBiometricDeviceServer,
  settleAttendancePeriodServer,
} from "../../lib/business/attendance.functions";

interface PunchRow {
  id: string;
  employeeName: string;
  employeeNo: string;
  punchTime: string;
  punchType: string;
  source: string;
  deviceId: string | null;
  approvalStatus: string;
}

interface DeviceRow {
  id: string;
  device_id: string;
  name_ar: string;
  status: string;
  auto_approve: boolean;
  last_seen_at: string | null;
  total_punches: number;
}

const today = () => new Date().toISOString().slice(0, 10);

export const BiometricTerminalPanel: React.FC = () => {
  const { employees, refreshData } = useApp() as any;

  const [date, setDate] = useState(today());
  const [punches, setPunches] = useState<PunchRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeRef, setEmployeeRef] = useState("");
  const [deviceId, setDeviceId] = useState("FP-TERMINAL-01");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [punchRows, deviceRows] = await Promise.all([
        listPunchesServer({ data: { date } }),
        listBiometricDevicesServer(),
      ]);
      setPunches(punchRows as PunchRow[]);
      setDevices(deviceRows as DeviceRow[]);
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر قراءة بيانات البصمة");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePunch = async (punchType: "in" | "out") => {
    if (!employeeRef.trim()) {
      toast.error("أدخل الرقم الوظيفي أولًا");
      return;
    }
    setBusy(true);
    try {
      const result: any = await recordPunchServer({
        data: { employeeRef: employeeRef.trim(), punchType, deviceId },
      });
      toast.success(
        `${punchType === "in" ? "بصمة دخول" : "بصمة خروج"} — ${result.employeeName} (${result.employeeNo})`,
      );
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر تسجيل البصمة");
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (punchId: string, decision: "approved" | "rejected") => {
    setBusy(true);
    try {
      await decidePunchServer({ data: { punchId, decision } });
      toast.success(decision === "approved" ? "تم اعتماد البصمة وتحديث الحضور" : "تم رفض البصمة");
      await load();
      await refreshData?.();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر تنفيذ القرار");
    } finally {
      setBusy(false);
    }
  };

  const handleSettle = async () => {
    setBusy(true);
    try {
      const result: any = await settleAttendancePeriodServer({ data: { year, month } });
      toast.success(
        `تمت تسوية ${result.approvedPunches} بصمة وإقفال مسيّر ${month}/${year} بصافي ${Math.round(result.totalNet).toLocaleString("ar-EG")} ر.س`,
      );
      await load();
      await refreshData?.();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذرت التسوية");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    const nameAr = window.prompt("اسم الجهاز", "جهاز البصمة - فرع جديد");
    const id = window.prompt("معرّف الجهاز (Device ID)", "FP-TERMINAL-02");
    if (!nameAr || !id) return;
    setBusy(true);
    try {
      const result: any = await registerBiometricDeviceServer({
        data: { deviceId: id, nameAr, autoApprove: false },
      });
      setNewToken(result.token);
      toast.success("تم تسجيل الجهاز، انسخ رمز الاتصال الآن");
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر تسجيل الجهاز");
    } finally {
      setBusy(false);
    }
  };

  const endpoint = `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/biometric/punch`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Terminal */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-sm">طرفية البصمة</h3>
          </div>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
          >
            {devices.map((device) => (
              <option key={device.id} value={device.device_id}>
                {device.name_ar} — {device.device_id}
              </option>
            ))}
            {devices.length === 0 && <option value="FP-TERMINAL-01">FP-TERMINAL-01</option>}
          </select>
          <input
            list="employee-refs"
            value={employeeRef}
            onChange={(e) => setEmployeeRef(e.target.value)}
            placeholder="الرقم الوظيفي (مثال: EMP-0142)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <datalist id="employee-refs">
            {employees.map((employee: any) => (
              <option key={employee.id} value={employee.employeeNo}>
                {employee.nameAr ?? employee.name ?? employee.fullName}
              </option>
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={busy} onClick={() => handlePunch("in")} className="rounded-xl font-bold">
              بصمة دخول
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => handlePunch("out")}
              className="rounded-xl font-bold"
            >
              بصمة خروج
            </Button>
          </div>
        </div>

        {/* Devices */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-sm">الأجهزة المرتبطة</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={handleRegister} className="text-xs gap-1">
              <KeyRound className="h-3.5 w-3.5" /> ربط جهاز
            </Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-auto">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2"
              >
                <div>
                  <p className="text-xs font-bold">{device.name_ar}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {device.device_id} • {device.total_punches} بصمة
                  </p>
                </div>
                <Badge variant={device.status === "active" ? "default" : "secondary"} className="text-[10px]">
                  {device.status === "active" ? "متصل" : "متوقف"}
                </Badge>
              </div>
            ))}
            {devices.length === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد أجهزة مسجّلة بعد</p>
            )}
          </div>
          <div className="rounded-xl bg-muted/40 p-3 space-y-1">
            <p className="text-[10px] font-bold flex items-center gap-1">
              <Link2 className="h-3 w-3" /> رابط ربط الجهاز الفعلي
            </p>
            <code className="block text-[10px] break-all text-muted-foreground">{endpoint}</code>
            <p className="text-[10px] text-muted-foreground">
              يرسل الجهاز: device_id، token، employee_no، punch_type
            </p>
            {newToken && (
              <p className="text-[10px] break-all font-mono text-primary">رمز الاتصال: {newToken}</p>
            )}
          </div>
        </div>

        {/* Settlement */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-sm">تسوية الحضور وإقفال المسيّر</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            تعتمد البصمات المعلقة، تعيد بناء سجل الحضور، ثم تحتسب الرواتب وتقفل المسيّر.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={month}
              min={1}
              max={12}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button disabled={busy} onClick={handleSettle} className="w-full rounded-xl font-bold">
            تسوية واحتساب الرواتب
          </Button>
        </div>
      </div>

      {/* Punch log */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border/60">
          <h3 className="font-bold text-sm">سجل بصمات اليوم</h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
            />
            <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-3 text-start">الموظف</th>
              <th className="p-3 text-start">الوقت</th>
              <th className="p-3 text-start">النوع</th>
              <th className="p-3 text-start">الجهاز</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {punches.map((punch) => (
              <tr key={punch.id} className="border-t border-border/40">
                <td className="p-3 font-bold">
                  {punch.employeeName}
                  <span className="block text-[10px] text-muted-foreground">{punch.employeeNo}</span>
                </td>
                <td className="p-3">{new Date(punch.punchTime).toLocaleTimeString("ar-SA")}</td>
                <td className="p-3">{punch.punchType === "in" ? "دخول" : "خروج"}</td>
                <td className="p-3 text-muted-foreground">{punch.deviceId ?? "—"}</td>
                <td className="p-3">
                  <Badge
                    variant={
                      punch.approvalStatus === "approved"
                        ? "default"
                        : punch.approvalStatus === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {punch.approvalStatus === "approved"
                      ? "معتمدة"
                      : punch.approvalStatus === "rejected"
                        ? "مرفوضة"
                        : "بانتظار الاعتماد"}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || punch.approvalStatus === "approved"}
                      onClick={() => handleDecision(punch.id, "approved")}
                      className="h-7 text-[11px] gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> اعتماد
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || punch.approvalStatus === "rejected"}
                      onClick={() => handleDecision(punch.id, "rejected")}
                      className="h-7 text-[11px] gap-1 text-destructive"
                    >
                      <XCircle className="h-3.5 w-3.5" /> رفض
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {punches.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  لا توجد بصمات في هذا اليوم
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
