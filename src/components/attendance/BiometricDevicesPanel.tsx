import React, { useCallback, useEffect, useState } from "react";
import { Cpu, KeyRound, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  deleteBiometricDeviceServer,
  listBiometricDevicesServer,
  registerBiometricDeviceServer,
  updateBiometricDeviceServer,
} from "../../lib/business/attendance.functions";

interface DeviceRow {
  id: string;
  device_id: string;
  name_ar: string;
  status: string;
  auto_approve: boolean;
  last_seen_at: string | null;
  total_punches: number;
}

export const BiometricDevicesPanel: React.FC = () => {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<{ deviceId: string; value: string } | null>(null);
  const [form, setForm] = useState({ deviceId: "", nameAr: "", autoApprove: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDevices((await listBiometricDevicesServer()) as DeviceRow[]);
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر قراءة الأجهزة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addDevice = async () => {
    setBusy(true);
    try {
      const result: any = await registerBiometricDeviceServer({ data: form });
      setToken({ deviceId: result.deviceId, value: result.token });
      toast.success("تم تسجيل الجهاز — انسخ رمز الاتصال الآن");
      setForm({ deviceId: "", nameAr: "", autoApprove: true });
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر تسجيل الجهاز");
    } finally {
      setBusy(false);
    }
  };

  const update = async (device: DeviceRow, patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      const result: any = await updateBiometricDeviceServer({ data: { id: device.id, ...patch } });
      if (result?.token) setToken({ deviceId: device.device_id, value: result.token });
      toast.success("تم تحديث الجهاز");
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر تحديث الجهاز");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (device: DeviceRow) => {
    if (!window.confirm(`حذف الجهاز ${device.device_id}؟ تبقى بصماته السابقة في سجل الحضور.`))
      return;
    setBusy(true);
    try {
      await deleteBiometricDeviceServer({ data: { id: device.id } });
      toast.success("تم حذف الجهاز");
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر حذف الجهاز");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <Cpu className="size-5 text-primary" />
          <div>
            <h3 className="text-sm font-black text-foreground">إعدادات أجهزة البصمة</h3>
            <p className="text-xs text-muted-foreground">
              كل جهاز يرسل بصماته إلى <span className="font-mono">/api/public/biometric/punch</span>{" "}
              برمز اتصاله، وتنعكس على الحضور ثم على تسوية الرواتب.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> تحديث
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          معرّف الجهاز
          <input
            value={form.deviceId}
            onChange={(e) => setForm((f) => ({ ...f, deviceId: e.target.value }))}
            placeholder="FP-TERMINAL-02"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          اسم الجهاز
          <input
            value={form.nameAr}
            onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
            placeholder="بوابة المقر الرئيسي"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 pt-6 text-xs font-bold text-muted-foreground">
          <input
            type="checkbox"
            checked={form.autoApprove}
            onChange={(e) => setForm((f) => ({ ...f, autoApprove: e.target.checked }))}
          />
          اعتماد البصمات تلقائيًا
        </label>
        <div className="flex items-end">
          <Button size="sm" onClick={() => void addDevice()} disabled={busy}>
            <Plus className="size-4" /> إضافة جهاز
          </Button>
        </div>
      </div>

      {token && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <KeyRound className="size-4 text-primary" /> رمز اتصال {token.deviceId} (يظهر مرة واحدة)
          </div>
          <p className="mt-2 break-all font-mono text-[11px]">{token.value}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        <table className="w-full text-right text-sm">
          <thead className="bg-muted/40 text-xs font-bold text-muted-foreground">
            <tr>
              <th className="px-4 py-3">الجهاز</th>
              <th className="px-4 py-3">الاسم</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">الاعتماد التلقائي</th>
              <th className="px-4 py-3">آخر اتصال</th>
              <th className="px-4 py-3">البصمات</th>
              <th className="px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id} className="border-t border-border/50">
                <td className="px-4 py-3 font-mono text-xs font-bold">{device.device_id}</td>
                <td className="px-4 py-3">
                  <input
                    defaultValue={device.name_ar}
                    onBlur={(e) =>
                      e.target.value !== device.name_ar &&
                      void update(device, { nameAr: e.target.value })
                    }
                    className="w-40 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-3">
                  <Badge variant={device.status === "active" ? "default" : "outline"}>
                    {device.status === "active" ? "نشط" : "موقوف"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={device.auto_approve}
                    onChange={(e) => void update(device, { autoApprove: e.target.checked })}
                  />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString("ar-EG") : "—"}
                </td>
                <td className="px-4 py-3 font-black">{device.total_punches}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void update(device, {
                          status: device.status === "active" ? "inactive" : "active",
                        })
                      }
                    >
                      <Save className="size-3.5" />
                      {device.status === "active" ? "إيقاف" : "تفعيل"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void update(device, { rotateToken: true })}
                    >
                      <KeyRound className="size-3.5" /> رمز جديد
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void remove(device)}
                    >
                      <Trash2 className="size-3.5" /> حذف
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!devices.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  لا توجد أجهزة مسجّلة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
