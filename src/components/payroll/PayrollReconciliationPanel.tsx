import React, { useCallback, useEffect, useState } from "react";
import { Scale, RefreshCw, Download, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { exportToCSV } from "../../lib/utils/export-helpers";
import {
  listEmployeeReconciliationServer,
  listPayrollReconciliationServer,
  type EmployeeReconciliationRow,
  type MonthlyReconciliationRow,
} from "../../lib/business/reconciliation.functions";

const money = (value: number) => `${Math.round(value).toLocaleString("ar-EG")} ر.س`;

const statusLabel: Record<string, string> = {
  draft: "مسودة",
  locked: "مقفل",
  paid: "مدفوع",
  pending: "معلقة",
  failed: "فشلت",
};

export const PayrollReconciliationPanel: React.FC = () => {
  const [months, setMonths] = useState<MonthlyReconciliationRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [rows, setRows] = useState<EmployeeReconciliationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result: any = await listPayrollReconciliationServer();
      setMonths(result.months);
      setBalance(result.companyBalance);
      setSelectedRunId((previous) => previous ?? result.months[0]?.runId ?? null);
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر قراءة التسويات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedRunId) return;
    void (async () => {
      try {
        const result: any = await listEmployeeReconciliationServer({ data: { runId: selectedRunId } });
        setRows(result as EmployeeReconciliationRow[]);
      } catch (error: any) {
        toast.error(error?.message ?? "تعذر قراءة تقرير الموظفين");
      }
    })();
  }, [selectedRunId]);

  const selected = months.find((month) => month.runId === selectedRunId);

  return (
    <div className="space-y-4">
      {/* Monthly settlements */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm">تسويات الرواتب الشهرية</h3>
              <p className="text-xs text-muted-foreground">
                أيام العمل، الأجر الصافي، السلف المسددة، والمصروف من حساب المنشأة لكل شهر.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl bg-muted/40 px-3 py-1.5 text-xs font-bold">
              <Wallet className="h-4 w-4 text-primary" /> رصيد المنشأة: {money(balance)}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5"
              onClick={() =>
                exportToCSV(
                  "payroll-monthly-reconciliation",
                  months.map((month) => ({
                    period: month.label,
                    status: month.status,
                    employees: month.employees,
                    worked_days: month.workedDays,
                    absent_days: month.absentDays,
                    net: month.net,
                    loans_paid: month.loansPaid,
                    paid_out: month.paidOut,
                    pending_out: month.pendingOut,
                  })),
                )
              }
            >
              <Download className="h-4 w-4" /> تصدير
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-3 text-start">الشهر</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">الموظفون</th>
              <th className="p-3 text-start">أيام العمل</th>
              <th className="p-3 text-start">أيام الغياب</th>
              <th className="p-3 text-start">الأجر الصافي</th>
              <th className="p-3 text-start">السلف المسددة</th>
              <th className="p-3 text-start">المصروف فعليًا</th>
              <th className="p-3 text-start">معلّق</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr
                key={month.runId}
                onClick={() => setSelectedRunId(month.runId)}
                className={`border-t border-border/40 cursor-pointer transition-colors ${
                  month.runId === selectedRunId ? "bg-primary/5" : "hover:bg-muted/30"
                }`}
              >
                <td className="p-3 font-bold">{month.label}</td>
                <td className="p-3">
                  <Badge
                    variant={month.status === "paid" ? "default" : month.status === "draft" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {statusLabel[month.status] ?? month.status}
                  </Badge>
                </td>
                <td className="p-3">{month.employees}</td>
                <td className="p-3">{month.workedDays}</td>
                <td className="p-3">{month.absentDays}</td>
                <td className="p-3 font-bold">{money(month.net)}</td>
                <td className="p-3">{money(month.loansPaid)}</td>
                <td className="p-3 text-emerald-600 font-bold">{money(month.paidOut)}</td>
                <td className="p-3 text-muted-foreground">{money(month.pendingOut)}</td>
              </tr>
            ))}
            {months.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  لا توجد مسيّرات بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Per-employee points report */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border/60">
          <h3 className="font-bold text-sm">
            تقرير الرواتب بالنقاط {selected ? `— ${selected.label}` : ""}
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5"
            disabled={!rows.length}
            onClick={() =>
              exportToCSV(
                `payroll-points-${selected?.label ?? "run"}`,
                rows.map((row) => ({
                  employee_no: row.employeeNo,
                  employee: row.employeeName,
                  department: row.departmentName,
                  working_days: row.workingDays,
                  gross: row.gross,
                  net: row.net,
                  loan_paid: row.loanPaid,
                  gap: row.gap,
                })),
              )
            }
          >
            <Download className="h-4 w-4" /> تصدير
          </Button>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-3 text-start">الموظف</th>
              <th className="p-3 text-start">الإدارة</th>
              <th className="p-3 text-start">أيام العمل</th>
              <th className="p-3 text-start">الإجمالي</th>
              <th className="p-3 text-start">الأجر الصافي</th>
              <th className="p-3 text-start">السلف المدفوعة</th>
              <th className="p-3 text-start">الفرق (إجمالي − صافي)</th>
              <th className="p-3 text-start">حالة الدفع</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId} className="border-t border-border/40">
                <td className="p-3 font-bold">
                  {row.employeeName}
                  <span className="block text-[10px] text-muted-foreground">{row.employeeNo}</span>
                </td>
                <td className="p-3">{row.departmentName}</td>
                <td className="p-3">
                  {row.workingDays}
                  {row.absentDays > 0 && (
                    <span className="text-[10px] text-destructive"> (غياب {row.absentDays})</span>
                  )}
                </td>
                <td className="p-3">{money(row.gross)}</td>
                <td className="p-3 font-bold">{money(row.net)}</td>
                <td className="p-3">{money(row.loanPaid)}</td>
                <td className="p-3 text-muted-foreground">{money(row.gap)}</td>
                <td className="p-3">
                  <Badge
                    variant={
                      row.paymentStatus === "paid"
                        ? "default"
                        : row.paymentStatus === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {statusLabel[row.paymentStatus] ?? row.paymentStatus}
                  </Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  اختر شهرًا لعرض تفاصيل الموظفين
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
