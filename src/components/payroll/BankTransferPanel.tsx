import React, { useCallback, useEffect, useState } from "react";
import { Building2, Download, FileText, Landmark, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { exportToCSV } from "../../lib/utils/export-helpers";
import { openArabicReportPdf, reportMoney } from "../../lib/utils/arabic-report-pdf";
import { listPayrollReconciliationServer } from "../../lib/business/reconciliation.functions";
import {
  disburseRunPaymentsServer,
  getBankTransferFileServer,
  listRunPaymentsServer,
  prepareRunPaymentsServer,
} from "../../lib/business/payments.functions";

const money = (value: number) => `${Math.round(value).toLocaleString("ar-EG")} ر.س`;

export const BankTransferPanel: React.FC = () => {
  const [runs, setRuns] = useState<{ runId: string; label: string; status: string }[]>([]);
  const [runId, setRunId] = useState<string>("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bankReference, setBankReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setBankReference(""); setConfirmed(false); }, [runId, accountId]);

  const loadRuns = useCallback(async () => {
    const result: any = await listPayrollReconciliationServer();
    setRuns(
      result.months.map((m: any) => ({ runId: m.runId, label: m.label, status: m.status })),
    );
    setRunId((prev) => prev || result.months[0]?.runId || "");
  }, []);

  const loadFile = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const [transfer, payments]: any[] = await Promise.all([
        getBankTransferFileServer({ data: { runId: id } }),
        listRunPaymentsServer({ data: { runId: id } }),
      ]);
      setFile(transfer);
      setAccounts(payments.accounts ?? []);
      setAccountId(
        (prev) =>
          prev ||
          (payments.accounts ?? []).find((a: any) => a.isPrimary)?.id ||
          (payments.accounts ?? [])[0]?.id ||
          "",
      );
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر قراءة ملف التحويل");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns().catch((error: any) => toast.error(error?.message ?? "تعذر قراءة المسيّرات"));
  }, [loadRuns]);

  useEffect(() => {
    void loadFile(runId);
  }, [runId, loadFile]);

  const period = runs.find((r) => r.runId === runId)?.label ?? "";
  const rows: any[] = file?.rows ?? [];
  const paidRows = rows.filter((r) => r.status === "paid");
  const pendingRows = rows.filter((r) => r.status !== "paid");
  const account = accounts.find((a) => a.id === accountId);

  const execute = async () => {
    if (busy || !confirmed || !bankReference.trim()) return;
    setBusy(true);
    try {
      const result: any = await disburseRunPaymentsServer({
        data: { runId, bankAccountId: accountId, bankReference, confirmed },
      });
      toast.success(
        result.alreadyConfirmed ? "سبق تسجيل هذا التأكيد دون خصم إضافي" : `تم تسجيل تأكيد التحويل ${result.batchNo}: ${result.paid} دفعة بقيمة ${money(result.totalPaid)}`,
      );
      setConfirmed(false);
      setBankReference("");
      await loadFile(runId);
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر تنفيذ التحويل البنكي");
    } finally {
      setBusy(false);
    }
  };

  const prepare = async () => {
    if (busy || !runId) return;
    setBusy(true);
    try {
      await prepareRunPaymentsServer({ data: { runId } });
      await loadFile(runId);
      toast.success("تم تجهيز الدفعات؛ لم يتم تنفيذ تحويل بنكي");
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };

  const downloadBankFile = () => {
    exportToCSV(
      `bank-transfer-${period || runId}`,
      pendingRows.map((row) => ({
        debit_iban: account?.iban ?? "",
        beneficiary_name: row.employeeName,
        beneficiary_id: row.employeeNo,
        beneficiary_iban: row.iban,
        beneficiary_bank: row.bankName,
        amount: row.amount,
        currency: "SAR",
        purpose: `PAYROLL ${period}`,
        reference: row.reference,
        status: row.status,
      })),
    );
  };

  const printAdvice = () => {
    try {
      openArabicReportPdf({
        title: `إشعار تحويل بنكي — رواتب ${period}`,
        subtitle: `الحساب المدين: ${file?.debitAccount?.iban ?? "—"} (${file?.debitAccount?.bank_name ?? ""}) — مرجع الدفعة: ${file?.batchNo ?? "—"}`,
        cards: [
          { label: "عدد التحويلات", value: String(rows.length) },
          { label: "المؤكد حسب المرجع المسجل", value: reportMoney(paidRows.reduce((s, r) => s + r.amount, 0)) },
          {
            label: "المعلّق",
            value: reportMoney(pendingRows.reduce((s, r) => s + r.amount, 0)),
          },
          { label: "رصيد الحساب بعد التحويل", value: reportMoney(account?.balance ?? 0) },
        ],
        sections: [
          {
            title: "تفاصيل التحويلات",
            columns: ["#", "المستفيد", "الرقم الوظيفي", "الآيبان", "المبلغ", "المرجع", "الحالة"],
            rows: rows.map((r, i) => [
              i + 1,
              r.employeeName,
              r.employeeNo,
              r.iban || "—",
              reportMoney(r.amount),
              r.reference || "—",
              r.status === "paid" ? "منفّذ" : r.status === "failed" ? "مرفوض" : "معلّق",
            ]),
            totals: ["", "الإجمالي", "", "", reportMoney(file?.total ?? 0), "", ""],
          },
        ],
      });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <Landmark className="size-5 text-primary" />
          <div>
            <h3 className="text-sm font-black text-foreground">تجهيز وتسجيل التحويلات البنكية</h3>
            <p className="text-xs text-muted-foreground">
              جهّز ملف الدفعات ونفّذه لدى البنك، ثم سجّل مرجع التنفيذ لتحديث الرصيد الدفتري. هذه الشاشة لا تتصل بالبنك.
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void loadFile(runId)} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          المسيّر
          <select
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {runs.map((run) => (
              <option key={run.runId} value={run.runId}>
                {run.label} — {run.status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          الحساب المدين (آيبان المنشأة)
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {accounts.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.bankName} — {a.iban}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs font-bold">
          <Building2 className="mb-0.5 ml-1 inline size-3.5 text-primary" />
          الرصيد الدفتري: {money(account?.balance ?? 0)}
        </div>
        <label className="flex flex-col gap-1 text-xs font-bold">
              مرجع تنفيذ البنك
              <input value={bankReference} onChange={(e) => setBankReference(e.target.value)} maxLength={120}
                className="rounded-xl border border-border bg-background px-3 py-2" disabled={busy} />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} />
              أؤكد تنفيذ جميع دفعات هذا المسيّر لدى البنك ومطابقة الإجمالي
            </label>
            <Button size="sm" onClick={() => void execute()} disabled={busy || !runId || !accountId || !confirmed || !bankReference.trim()}>
          <Send className="size-4" /> تسجيل تأكيد التحويل
        </Button>
        <Button size="sm" variant="outline" onClick={() => void prepare()} disabled={busy || !runId}>تجهيز الدفعات</Button>
        <Button size="sm" variant="outline" onClick={downloadBankFile} disabled={!pendingRows.length || !account}>
          <Download className="size-4" /> ملف البنك (CSV)
        </Button>
        <Button size="sm" variant="outline" onClick={printAdvice} disabled={!rows.length}>
          <FileText className="size-4" /> إشعار تحويل PDF
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        <table className="w-full text-right text-xs">
          <thead className="bg-muted/40 font-bold text-muted-foreground">
            <tr>
              <th className="p-3">المستفيد</th>
              <th className="p-3">الآيبان</th>
              <th className="p-3">البنك</th>
              <th className="p-3">المبلغ</th>
              <th className="p-3">المرجع البنكي</th>
              <th className="p-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.employeeNo}-${index}`} className="border-t border-border/50">
                <td className="p-3 font-bold">
                  {row.employeeName}
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {row.employeeNo}
                  </span>
                </td>
                <td className="p-3 font-mono text-[11px]">{row.iban || "—"}</td>
                <td className="p-3">{row.bankName || "—"}</td>
                <td className="p-3 font-black">{money(row.amount)}</td>
                <td className="p-3 font-mono text-[10px]">{row.reference || "—"}</td>
                <td className="p-3">
                  <Badge
                    variant={
                      row.status === "paid"
                        ? "default"
                        : row.status === "failed"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {row.status === "paid" ? "منفّذ" : row.status === "failed" ? "مرفوض" : "معلّق"}
                  </Badge>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  لا توجد دفعات — اعتمد المسيّر ثم اضغط تجهيز الدفعات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
