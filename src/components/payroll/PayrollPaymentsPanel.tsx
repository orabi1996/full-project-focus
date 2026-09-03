import React, { useCallback, useEffect, useState } from "react";
import { Banknote, RefreshCw, Send, ListChecks, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { exportToCSV } from "../../lib/utils/export-helpers";
import {
  disburseRunPaymentsServer,
  listRunPaymentsServer,
  prepareRunPaymentsServer,
} from "../../lib/business/payments.functions";

interface PaymentRow {
  id: string;
  employeeName: string;
  employeeNo: string;
  netAmount: number;
  iban: string | null;
  bankName: string | null;
  status: string;
  batchNo: string | null;
  reference: string | null;
  paidAt: string | null;
  failureReason: string | null;
}

interface AccountRow {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
  balance: number;
  isPrimary: boolean;
}

const money = (value: number) => `${Math.round(value).toLocaleString("ar-EG")} ر.س`;

export const PayrollPaymentsPanel: React.FC<{ runId?: string; period?: string }> = ({
  runId,
  period,
}) => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!runId) {
      setPayments([]);
      return;
    }
    setLoading(true);
    try {
      const result: any = await listRunPaymentsServer({ data: { runId } });
      setPayments(result.payments as PaymentRow[]);
      setAccounts(result.accounts as AccountRow[]);
      setAccountId(
        (previous) =>
          previous || result.accounts.find((a: AccountRow) => a.isPrimary)?.id || result.accounts[0]?.id || "",
      );
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر قراءة الدفعات");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePrepare = async () => {
    if (!runId) return;
    setBusy(true);
    try {
      const result: any = await prepareRunPaymentsServer({ data: { runId } });
      toast.success(
        `تم تجهيز ${result.prepared} دفعة بإجمالي ${money(result.totalNet)}${result.missingIban ? ` — ${result.missingIban} موظف بدون آيبان` : ""}`,
      );
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر تجهيز الدفعات");
    } finally {
      setBusy(false);
    }
  };

  const handleDisburse = async () => {
    if (!runId || !accountId) {
      toast.error("اختر حساب المنشأة البنكي");
      return;
    }
    setBusy(true);
    try {
      const result: any = await disburseRunPaymentsServer({ data: { runId, bankAccountId: accountId } });
      toast.success(
        `تم صرف ${result.paid} دفعة بإجمالي ${money(result.totalPaid)} — دفعة ${result.batchNo}`,
      );
      if (result.failed) toast.warning(`${result.failed} دفعة فشلت لعدم وجود آيبان`);
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر صرف الرواتب");
    } finally {
      setBusy(false);
    }
  };

  const totalPending = payments
    .filter((p) => p.status !== "paid")
    .reduce((sum, p) => sum + p.netAmount, 0);
  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.netAmount, 0);
  const account = accounts.find((a) => a.id === accountId);

  if (!runId) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
        اختر مسيّر رواتب أولًا لعرض شاشة الدفع.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm">دفع رواتب {period ?? "الشهر الحالي"}</h3>
              <p className="text-xs text-muted-foreground">
                يُخصم إجمالي الصافي من حساب المنشأة ويُسجَّل مرجع تحويل لكل موظف.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={handlePrepare} className="rounded-xl gap-1.5">
              <ListChecks className="h-4 w-4" /> تجهيز الدفعات
            </Button>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
            >
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.bankName} — {money(item.balance)}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={busy || !payments.length} onClick={handleDisburse} className="rounded-xl gap-1.5 font-bold">
              <Send className="h-4 w-4" /> صرف الرواتب
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                exportToCSV(
                  `payroll-payments-${period ?? runId}`,
                  payments.map((p) => ({
                    employee_no: p.employeeNo,
                    employee: p.employeeName,
                    net_amount: p.netAmount,
                    iban: p.iban ?? "",
                    bank: p.bankName ?? "",
                    status: p.status,
                    reference: p.reference ?? "",
                  })),
                )
              }
            >
              تصدير
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Stat label="عدد الدفعات" value={String(payments.length)} />
          <Stat label="إجمالي معلق" value={money(totalPending)} />
          <Stat label="إجمالي مدفوع" value={money(totalPaid)} />
          <Stat label="رصيد حساب المنشأة" value={account ? money(account.balance) : "—"} />
        </div>

        {account && totalPending > account.balance && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 text-destructive px-3 py-2 text-xs font-bold">
            <AlertTriangle className="h-4 w-4" /> رصيد الحساب لا يغطي إجمالي الدفعات المعلقة.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-3 text-start">الموظف</th>
              <th className="p-3 text-start">الصافي</th>
              <th className="p-3 text-start">الآيبان</th>
              <th className="p-3 text-start">البنك</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">المرجع</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-border/40">
                <td className="p-3 font-bold">
                  {payment.employeeName}
                  <span className="block text-[10px] text-muted-foreground">{payment.employeeNo}</span>
                </td>
                <td className="p-3 font-bold">{money(payment.netAmount)}</td>
                <td className="p-3 font-mono text-[10px]">{payment.iban ?? "—"}</td>
                <td className="p-3">{payment.bankName ?? "—"}</td>
                <td className="p-3">
                  <Badge
                    variant={
                      payment.status === "paid"
                        ? "default"
                        : payment.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {payment.status === "paid" ? "مدفوعة" : payment.status === "failed" ? "فشلت" : "معلقة"}
                  </Badge>
                  {payment.failureReason && (
                    <span className="block text-[10px] text-destructive mt-1">{payment.failureReason}</span>
                  )}
                </td>
                <td className="p-3 font-mono text-[10px] text-muted-foreground">{payment.reference ?? "—"}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  لا توجد دفعات — اضغط «تجهيز الدفعات».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
    <p className="text-[10px] text-muted-foreground font-bold">{label}</p>
    <p className="text-sm font-bold mt-1">{value}</p>
  </div>
);
