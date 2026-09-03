import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, HandCoins, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  disburseApprovedLoansServer,
  listLoansOverviewServer,
} from "../../lib/business/loans.functions";
import { getCompanyProfileServer } from "../../lib/business/company.functions";

const money = (value: number) =>
  `${Number(value ?? 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ر.س`;

export const LoansTreasuryPanel: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loans, company] = await Promise.all([
        listLoansOverviewServer(),
        getCompanyProfileServer(),
      ]);
      setData(loans);
      const list = (company as any).accounts ?? [];
      setAccounts(list);
      setAccountId((prev) => prev || list.find((a: any) => a.isPrimary)?.id || list[0]?.id || "");
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر قراءة السلف");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId],
  );

  const disburse = async () => {
    setBusy(true);
    try {
      const result: any = await disburseApprovedLoansServer({ data: { bankAccountId: accountId } });
      toast.success(
        `تم صرف ${result.disbursed} سلفة بقيمة ${money(result.totalDisbursed)} — الرصيد المتبقي ${money(result.remainingBalance)}`,
      );
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر صرف السلف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <HandCoins className="size-5 text-primary" />
          <div>
            <h3 className="text-sm font-black text-foreground">سلف الموظفين وحساب المنشأة</h3>
            <p className="text-xs text-muted-foreground">
              تُصرف السلف المعتمدة من رصيد المنشأة، ثم تُسترد أقساطها تلقائيًا من صافي المسيّر.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> تحديث
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "سلف بانتظار الصرف", value: money(data?.totals?.approvedAmount ?? 0) },
          { label: "طلبات سلف قيد الاعتماد", value: `${data?.totals?.pendingCount ?? 0}` },
          { label: "رصيد سلف قائم", value: money(data?.totals?.activeOutstanding ?? 0) },
          { label: "استرداد شهري من الرواتب", value: money(data?.totals?.monthlyRecovery ?? 0) },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs font-bold text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-lg font-black text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          حساب الصرف
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bankName} — {account.iban}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs font-bold text-muted-foreground">
          الرصيد المتاح:{" "}
          <span className="text-sm font-black text-foreground">
            {money(selectedAccount?.balance ?? 0)}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => void disburse()}
          disabled={busy || !accountId || !(data?.totals?.approvedAmount > 0)}
        >
          <Send className="size-4" /> صرف السلف المعتمدة
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        <table className="w-full text-right text-sm">
          <thead className="bg-muted/40 text-xs font-bold text-muted-foreground">
            <tr>
              <th className="px-4 py-3">الموظف</th>
              <th className="px-4 py-3">النوع</th>
              <th className="px-4 py-3">المبلغ</th>
              <th className="px-4 py-3">القسط</th>
              <th className="px-4 py-3">الأقساط</th>
              <th className="px-4 py-3">المتبقي</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {(data?.loans ?? []).map((loan: any) => (
              <tr key={loan.id} className="border-t border-border/50">
                <td className="px-4 py-3 font-bold">
                  {loan.employeeName}
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {loan.employeeNo}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{loan.loanType}</td>
                <td className="px-4 py-3 font-black">{money(loan.amount)}</td>
                <td className="px-4 py-3">{money(loan.installment)}</td>
                <td className="px-4 py-3 text-xs">
                  {loan.installmentsPaid} / {loan.installmentsTotal}
                </td>
                <td className="px-4 py-3">{money(loan.outstanding)}</td>
                <td className="px-4 py-3">
                  <Badge variant={loan.status === "active" ? "default" : "outline"}>
                    {loan.status === "approved"
                      ? "معتمدة — بانتظار الصرف"
                      : loan.status === "active"
                        ? "قائمة"
                        : loan.status === "pending"
                          ? "قيد الاعتماد"
                          : loan.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {!(data?.loans ?? []).length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  <Banknote className="mx-auto mb-2 size-5 opacity-50" />
                  لا توجد سلف مسجّلة حاليًا.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
