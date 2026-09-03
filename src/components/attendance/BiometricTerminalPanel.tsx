import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Fingerprint, Check, X, RefreshCw, Lock, LogIn, LogOut } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  recordPunchServer,
  listPunchesServer,
  decidePunchServer,
  settleAttendancePeriodServer,
} from "../../lib/business/attendance.functions";

interface PunchRow {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  punchTime: string;
  punchType: "in" | "out";
  source: string;
  deviceId: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const statusMeta: Record<PunchRow["approvalStatus"], { label: string; className: string }> = {
  pending: { label: "بانتظار الاعتماد", className: "bg-amber-500/15 text-amber-700" },
  approved: { label: "معتمدة", className: "bg-emerald-500/15 text-emerald-700" },
  rejected: { label: "مرفوضة", className: "bg-destructive/15 text-destructive" },
};

export const BiometricTerminalPanel: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const recordPunch = useServerFn(recordPunchServer);
  const listPunches = useServerFn(listPunchesServer);
  const decidePunch = useServerFn(decidePunchServer);
  const settlePeriod = useServerFn(settleAttendancePeriodServer);

  const [date, setDate] = useState(todayISO());
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<PunchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await listPunches({ data: { date } })) as PunchRow[];
      setRows(data);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date, listPunches]);

  useEffect(() => {
    void load();
  }, [load]);

  const punch = async (punchType: "in" | "out") => {
    if (!code.trim()) {
      toast.error("أدخل الرقم الوظيفي على الجهاز");
      return;
    }
    setBusy(true);
    try {
      const result = (await recordPunch({
        data: { employeeCode: code.trim(), punchType, source: "biometric_device" },
      })) as { employeeName: string };
      toast.success(
        `${punchType === "in" ? "بصمة دخول" : "بصمة خروج"} مسجلة للموظف ${result.employeeName}`,
      );
      setCode("");
      await load();
      onChanged?.();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (punchId: string, decision: "approved" | "rejected") => {
    setBusy(true);
    try {
      await decidePunch({ data: { punchId, decision } });
      toast.success(decision === "approved" ? "تم اعتماد البصمة" : "تم رفض البصمة واستبعادها من الرواتب");
      await load();
      onChanged?.();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const settle = async () => {
    const [year, month] = date.split("-").map(Number);
    setBusy(true);
    try {
      const result = (await settlePeriod({ data: { year, month } })) as {
        employees: number;
        totalNet: number;
      };
      toast.success(
        `تمت تسوية الحضور وإعادة احتساب الرواتب لـ ${result.employees} موظف وقفل المسيّر (صافي ${result.totalNet.toLocaleString("ar-SA")} ر.س)`,
      );
      onChanged?.();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = useMemo(
    () => rows.filter((r) => r.approvalStatus === "pending").length,
    [rows],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="rounded-2xl border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <Fingerprint className="h-4 w-4 text-primary" />
            جهاز البصمة (طرفية FP-TERMINAL-01)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="الرقم الوظيفي، مثال: EMP-DEMO-01"
            className="text-center font-bold tracking-wider"
            dir="ltr"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={busy} onClick={() => punch("in")} className="gap-1.5">
              <LogIn className="h-4 w-4" /> بصمة دخول
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => punch("out")}
              className="gap-1.5"
            >
              <LogOut className="h-4 w-4" /> بصمة خروج
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            تُسجَّل كل بصمة في قاعدة البيانات بحالة «بانتظار الاعتماد». البصمة المعتمدة تُحوَّل إلى
            سجل حضور وتدخل في احتساب الراتب، والمرفوضة تُستبعد ويُخصم اليوم من الأجر.
          </p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={settle}
            className="w-full gap-1.5 font-bold"
          >
            <Lock className="h-4 w-4" /> تسوية الحضور وقفل رواتب الشهر
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-sm font-bold">
            بصمات اليوم
            {pendingCount > 0 && (
              <Badge className="mr-2 rounded-full bg-amber-500 text-white text-[10px]">
                {pendingCount} بانتظار الاعتماد
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 w-40 text-xs"
            />
            <Button size="sm" variant="ghost" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-2 text-right font-bold">الموظف</th>
                  <th className="p-2 text-right font-bold">الوقت</th>
                  <th className="p-2 text-right font-bold">النوع</th>
                  <th className="p-2 text-right font-bold">الحالة</th>
                  <th className="p-2 text-right font-bold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      لا توجد بصمات مسجلة في هذا التاريخ
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/50">
                    <td className="p-2">
                      <div className="font-bold">{row.employeeName}</div>
                      <div className="text-[10px] text-muted-foreground" dir="ltr">
                        {row.employeeNo}
                      </div>
                    </td>
                    <td className="p-2" dir="ltr">
                      {new Date(row.punchTime).toLocaleTimeString("ar-SA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-2">{row.punchType === "in" ? "دخول" : "خروج"}</td>
                    <td className="p-2">
                      <Badge
                        variant="secondary"
                        className={`rounded-full text-[10px] ${statusMeta[row.approvalStatus].className}`}
                      >
                        {statusMeta[row.approvalStatus].label}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || row.approvalStatus === "approved"}
                          onClick={() => decide(row.id, "approved")}
                          className="h-7 px-2 text-emerald-600"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || row.approvalStatus === "rejected"}
                          onClick={() => decide(row.id, "rejected")}
                          className="h-7 px-2 text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
