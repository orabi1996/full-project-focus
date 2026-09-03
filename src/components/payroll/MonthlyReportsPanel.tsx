import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, HandCoins, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { openArabicReportPdf, reportMoney } from "../../lib/utils/arabic-report-pdf";
import { getMonthlyReportServer } from "../../lib/business/monthly-reports.functions";

const money = (value: number) => `${Math.round(value ?? 0).toLocaleString("ar-EG")} ر.س`;

const loanStatusLabel: Record<string, string> = {
  approved: "معتمدة — بانتظار الصرف",
  active: "قائمة (تُسترد شهريًا)",
  pending: "قيد الاعتماد",
  closed: "مسددة",
  rejected: "مرفوضة",
};

export const MonthlyReportsPanel: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await getMonthlyReportServer({ data: { year, month } }));
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر إنشاء التقرير");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const years = useMemo(
    () => Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i),
    [now],
  );

  const printFull = () => {
    if (!report) return;
    try {
      openArabicReportPdf({
        title: `التقرير الشهري الموحّد — ${report.period}`,
        subtitle: "تسوية الرواتب، السلف، الحضور، والرواتب حسب الإدارة",
        cards: [
          { label: "صافي المسيّر", value: reportMoney(report.payroll?.net ?? 0) },
          { label: "المصروف بنكيًا", value: reportMoney(report.payroll?.paidOut ?? 0) },
          { label: "سلف مستردة هذا الشهر", value: reportMoney(report.loans.recoveredThisMonth) },
          { label: "رصيد السلف القائم", value: reportMoney(report.loans.outstanding) },
        ],
        sections: [
          {
            title: "الرواتب حسب الإدارة",
            columns: [
              "الإدارة",
              "الموظفون",
              "الأساسي",
              "البدلات",
              "التأمينات",
              "خصم السلف",
              "الصافي",
            ],
            rows: report.byDepartment.map((d: any) => [
              d.departmentName,
              d.employees,
              reportMoney(d.basic),
              reportMoney(d.allowances),
              reportMoney(d.gosi),
              reportMoney(d.loans),
              reportMoney(d.net),
            ]),
            totals: [
              "الإجمالي",
              report.byDepartment.reduce((s: number, d: any) => s + d.employees, 0),
              reportMoney(report.byDepartment.reduce((s: number, d: any) => s + d.basic, 0)),
              reportMoney(report.byDepartment.reduce((s: number, d: any) => s + d.allowances, 0)),
              reportMoney(report.byDepartment.reduce((s: number, d: any) => s + d.gosi, 0)),
              reportMoney(report.byDepartment.reduce((s: number, d: any) => s + d.loans, 0)),
              reportMoney(report.byDepartment.reduce((s: number, d: any) => s + d.net, 0)),
            ],
          },
          {
            title: "الحضور حسب الإدارة",
            columns: ["الإدارة", "حضور", "تأخير", "غياب", "إجازة", "ساعات العمل", "ساعات إضافية"],
            rows: report.attendanceByDepartment.map((a: any) => [
              a.departmentName,
              a.present,
              a.late,
              a.absent,
              a.leave,
              a.hours,
              a.overtimeHours,
            ]),
          },
          {
            title: "السلف",
            columns: ["الموظف", "الرقم الوظيفي", "الحالة", "المبلغ", "القسط", "المتبقي"],
            rows: report.loans.rows.map((l: any) => [
              l.employeeName,
              l.employeeNo,
              loanStatusLabel[l.status] ?? l.status,
              reportMoney(l.amount),
              reportMoney(l.installment),
              reportMoney(l.outstanding),
            ]),
            note: `مرجع الدفع البنكي للمسيّر: ${report.payroll?.batchNo ?? "—"}`,
          },
        ],
      });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const printLoans = () => {
    if (!report) return;
    try {
      openArabicReportPdf({
        title: `تقرير السلف الشهري — ${report.period}`,
        subtitle: "المعلّق، المسترد، والاسترداد الشهري من الرواتب",
        cards: [
          { label: "سلف معلّقة (بانتظار الصرف)", value: reportMoney(report.loans.pendingAmount) },
          { label: "مسترد هذا الشهر", value: reportMoney(report.loans.recoveredThisMonth) },
          { label: "الاسترداد الشهري المتوقع", value: reportMoney(report.loans.monthlyRecovery) },
          { label: "رصيد السلف القائم", value: reportMoney(report.loans.outstanding) },
        ],
        sections: [
          {
            title: "تفاصيل السلف",
            columns: ["الموظف", "الرقم الوظيفي", "الحالة", "المبلغ", "القسط الشهري", "المتبقي"],
            rows: report.loans.rows.map((l: any) => [
              l.employeeName,
              l.employeeNo,
              loanStatusLabel[l.status] ?? l.status,
              reportMoney(l.amount),
              reportMoney(l.installment),
              reportMoney(l.outstanding),
            ]),
            totals: [
              "الإجمالي",
              "",
              "",
              reportMoney(report.loans.rows.reduce((s: number, l: any) => s + l.amount, 0)),
              reportMoney(report.loans.rows.reduce((s: number, l: any) => s + l.installment, 0)),
              reportMoney(report.loans.rows.reduce((s: number, l: any) => s + l.outstanding, 0)),
            ],
          },
        ],
      });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" />
          <div>
            <h3 className="text-sm font-black text-foreground">التقارير الشهرية</h3>
            <p className="text-xs text-muted-foreground">
              تسوية الرواتب، السلف، الحضور، والرواتب حسب الإدارة — بتحميل PDF عربي.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                شهر {m}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={printFull} disabled={!report}>
            <FileText className="size-4" /> التقرير الشهري PDF
          </Button>
          <Button size="sm" variant="outline" onClick={printLoans} disabled={!report}>
            <HandCoins className="size-4" /> تقرير السلف PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "حالة المسيّر", value: report?.payroll?.status ?? "لا يوجد مسيّر" },
          { label: "صافي المسيّر", value: money(report?.payroll?.net ?? 0) },
          { label: "المصروف بنكيًا", value: money(report?.payroll?.paidOut ?? 0) },
          { label: "سلف مستردة", value: money(report?.loans?.recoveredThisMonth ?? 0) },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs font-bold text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-lg font-black text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
          <h4 className="border-b border-border/60 p-3 text-sm font-black">الرواتب حسب الإدارة</h4>
          <table className="w-full text-right text-xs">
            <thead className="bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="p-3">الإدارة</th>
                <th className="p-3">موظفون</th>
                <th className="p-3">الأساسي</th>
                <th className="p-3">التأمينات</th>
                <th className="p-3">الصافي</th>
              </tr>
            </thead>
            <tbody>
              {(report?.byDepartment ?? []).map((d: any) => (
                <tr key={d.departmentId} className="border-t border-border/50">
                  <td className="p-3 font-bold">{d.departmentName}</td>
                  <td className="p-3">{d.employees}</td>
                  <td className="p-3">{money(d.basic)}</td>
                  <td className="p-3">{money(d.gosi)}</td>
                  <td className="p-3 font-black">{money(d.net)}</td>
                </tr>
              ))}
              {!(report?.byDepartment ?? []).length && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    لا يوجد مسيّر لهذا الشهر
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
          <h4 className="border-b border-border/60 p-3 text-sm font-black">الحضور حسب الإدارة</h4>
          <table className="w-full text-right text-xs">
            <thead className="bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="p-3">الإدارة</th>
                <th className="p-3">حضور</th>
                <th className="p-3">تأخير</th>
                <th className="p-3">غياب</th>
                <th className="p-3">ساعات</th>
              </tr>
            </thead>
            <tbody>
              {(report?.attendanceByDepartment ?? []).map((a: any, i: number) => (
                <tr key={`${a.departmentName}-${i}`} className="border-t border-border/50">
                  <td className="p-3 font-bold">{a.departmentName}</td>
                  <td className="p-3">{a.present}</td>
                  <td className="p-3">{a.late}</td>
                  <td className="p-3">{a.absent}</td>
                  <td className="p-3">{a.hours}</td>
                </tr>
              ))}
              {!(report?.attendanceByDepartment ?? []).length && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    لا توجد سجلات حضور لهذا الشهر
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        <h4 className="border-b border-border/60 p-3 text-sm font-black">
          السلف — المعلّق والمسترد{" "}
          <Badge variant="outline" className="ms-2 text-[10px]">
            معلّق {money(report?.loans?.pendingAmount ?? 0)}
          </Badge>
        </h4>
        <table className="w-full text-right text-xs">
          <thead className="bg-muted/40 font-bold text-muted-foreground">
            <tr>
              <th className="p-3">الموظف</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">المبلغ</th>
              <th className="p-3">القسط</th>
              <th className="p-3">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {(report?.loans?.rows ?? []).map((l: any, i: number) => (
              <tr key={`${l.employeeNo}-${i}`} className="border-t border-border/50">
                <td className="p-3 font-bold">{l.employeeName}</td>
                <td className="p-3">{loanStatusLabel[l.status] ?? l.status}</td>
                <td className="p-3">{money(l.amount)}</td>
                <td className="p-3">{money(l.installment)}</td>
                <td className="p-3">{money(l.outstanding)}</td>
              </tr>
            ))}
            {!(report?.loans?.rows ?? []).length && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  لا توجد سلف مسجّلة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
