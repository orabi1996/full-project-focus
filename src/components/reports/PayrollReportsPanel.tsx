import React, { useMemo, useState } from "react";
import { Download, FileBarChart, Printer, Search, Wallet } from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { useApp } from "../../lib/context/AppContext";
import { usePayroll } from "../../lib/domains/payroll";
import { useEmployees } from "../../lib/domains/employees";
import { usePayrollRunEmployees } from "../../lib/data/payroll-repository";
import { formatPayrollMoney } from "../../lib/business/payroll-country";
import { exportToCSV } from "../../lib/utils/export-helpers";
import type { EmployeePayrollDetail } from "../../types";
import { PayrollDistributionPanel } from "../payroll/PayrollDistributionPanel";
import { MonthlyReportsPanel } from "../payroll/MonthlyReportsPanel";
import { PayrollReconciliationPanel } from "../payroll/PayrollReconciliationPanel";
import { SettlementNotificationsPanel } from "../payroll/SettlementNotificationsPanel";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

const PAYROLL_REPORT_ROLES = ["super_admin", "org_admin", "hr_manager", "payroll_officer", "finance_officer"];

export const PayrollReportsPanel: React.FC = () => {
  const { session, isDemo } = useAuth();
  const { currentRole, orgUnits, company } = useApp();
  const { payrollRuns, isLoading } = usePayroll();
  const { employees } = useEmployees();
  const canViewPayroll = PAYROLL_REPORT_ROLES.includes(currentRole);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [search, setSearch] = useState("");
  const [reportTab, setReportTab] = useState("details");
  const [selectedPayslip, setSelectedPayslip] = useState<EmployeePayrollDetail | null>(null);
  const isLive = Boolean(session && !isDemo);

  const selectedRun = payrollRuns.find((run) => run.id === selectedRunId) || payrollRuns[0];
  const runEmployees = usePayrollRunEmployees(selectedRun?.id);

  const details: EmployeePayrollDetail[] = useMemo(() => {
    if (!selectedRun || !isLive || !runEmployees.data) return [];
    return runEmployees.data.map((row) => ({
      id: row.id,
      payrollRunId: row.payrollRunId,
      employeeId: row.employeeId,
      employeeNo: row.employeeNo,
      employeeName: row.employeeName,
      jobTitle: "",
      departmentName: row.departmentName || "",
      bankName: row.bankName || "",
      iban: row.iban || "",
      basicSalary: row.basicSalary,
      housingAllowance: row.housingAllowance,
      transportAllowance: row.transportAllowance,
      otherAllowances: 0,
      overtimeHours: row.overtimeHours,
      overtimeAmount: row.overtimeAmount,
      retroAdjustments: 0,
      bonusAmount: row.bonusAmount,
      grossSalary: row.grossSalary,
      unpaidLeaveDeduction: row.unpaidLeaveDeduction,
      absenceLateDeduction: row.absenceDeduction,
      loanInstallmentDeduction: row.loanDeduction,
      gosiEmployeeDeduction: row.gosiEmployee,
      gosiEmployerContribution: row.gosiEmployer,
      otherDeductions: row.otherDeductions - (row.incomeTax || 0),
      incomeTax: row.incomeTax,
      totalDeductions: row.totalDeductions,
      netSalary: row.netSalary,
      unpaidLeaveDays: row.unpaidLeaveDays,
      absenceDays: row.absenceDays,
    }));
  }, [selectedRun, isLive, runEmployees.data]);

  const visibleDetails = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return details;
    return details.filter((row) =>
      row.employeeName.toLowerCase().includes(query) || row.employeeNo.toLowerCase().includes(query),
    );
  }, [details, search]);

  const currency = selectedRun?.currency || company.currency || "SAR";
  const money = (value: number) => formatPayrollMoney(value, currency);

  const exportDetails = () => {
    if (!selectedRun || !visibleDetails.length) return;
    exportToCSV(`كشف_مسير_${selectedRun.periodYear}_${selectedRun.periodMonth}`, visibleDetails.map((row) => ({
      "الرقم الوظيفي": row.employeeNo,
      "اسم الموظف": row.employeeName,
      "القسم": row.departmentName,
      "الراتب الأساسي": row.basicSalary,
      "بدل السكن": row.housingAllowance,
      "بدل النقل": row.transportAllowance,
      "العمل الإضافي": row.overtimeAmount,
      "التأمينات": row.gosiEmployeeDeduction,
      "الضريبة": row.incomeTax || 0,
      "الاستقطاعات": row.totalDeductions,
      "صافي الراتب": row.netSalary,
    })));
  };

  if (!canViewPayroll) {
    return <div className="rounded-2xl border p-6 text-sm text-muted-foreground">لا تتوفر لك صلاحية عرض تقارير الرواتب.</div>;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-primary/10 p-2 text-primary"><FileBarChart className="h-5 w-5" /></span>
          <div>
            <h2 className="font-black">تقارير الرواتب</h2>
            <p className="mt-1 text-xs text-muted-foreground">كشوف الموظفين والرواتب والتوزيع والتسويات موجودة هنا بعيدًا عن شاشة إنشاء المسير.</p>
          </div>
        </div>
        {reportTab === "details" && (
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="اختيار مسير لعرض تقريره"
              value={selectedRun?.id || ""}
              onChange={(event) => setSelectedRunId(event.target.value)}
              className="h-9 min-w-48 rounded-xl border bg-background px-3 text-xs font-semibold"
            >
              {payrollRuns.map((run) => <option key={run.id} value={run.id}>{run.periodMonth}/{run.periodYear} — {run.payrollGroupName}</option>)}
            </select>
            <Button onClick={exportDetails} disabled={!visibleDetails.length} variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" />تصدير الكشف
            </Button>
          </div>
        )}
      </div>

      <Tabs value={reportTab} onValueChange={setReportTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="details">تفاصيل مسير الرواتب</TabsTrigger>
          <TabsTrigger value="distribution">التوزيع الإداري</TabsTrigger>
          <TabsTrigger value="monthly">التقارير الشهرية</TabsTrigger>
          <TabsTrigger value="reconciliation">التسويات والإشعارات</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 pt-3">
          {!selectedRun ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل المسيرات..." : "لا توجد مسيرات رواتب لعرضها."}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["الراتب الأساسي", selectedRun.totalBasicSalary],
                  ["البدلات والإضافي", selectedRun.totalAllowances + selectedRun.totalOvertimeAmount],
                  ["الاستقطاعات", selectedRun.totalDeductions],
                  ["صافي المسير", selectedRun.totalNetSalary],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl border bg-card p-4">
                    <span className="text-xs font-bold text-muted-foreground">{label}</span>
                    <p className="mt-1 font-mono text-lg font-black">{money(Number(value))}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Wallet className="h-4 w-4 text-primary" />
                  {selectedRun.periodMonth}/{selectedRun.periodYear} — {selectedRun.payrollGroupName}
                  <Badge variant="outline">{details.length || selectedRun.totalEmployees} موظف</Badge>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث بالاسم أو الرقم الوظيفي" className="h-9 w-full rounded-xl border bg-background pr-9 pl-3 text-xs" />
                </div>
              </div>

              {runEmployees.isError && <p role="alert" className="text-sm text-destructive">تعذر تحميل تفاصيل هذا المسير.</p>}
              {!isLive && <p className="text-xs text-muted-foreground">تفاصيل الرواتب الفعلية تظهر بعد تسجيل الدخول بحساب مخوّل.</p>}
              {runEmployees.isLoading ? <div className="rounded-xl border p-6 text-sm text-muted-foreground">جارٍ تحميل تفاصيل الموظفين...</div> :
                <div className="overflow-x-auto rounded-2xl border bg-card">
                  <table className="w-full min-w-[900px] text-right text-xs">
                    <thead className="bg-muted/50 text-muted-foreground"><tr>
                      <th className="p-3">الموظف</th><th className="p-3">القسم</th><th className="p-3">الأساسي</th><th className="p-3">البدلات</th><th className="p-3">الإضافي</th><th className="p-3">التأمينات والخصومات</th><th className="p-3">صافي الراتب</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {visibleDetails.map((row) => <tr key={row.id}>
                        <td className="p-3"><strong>{row.employeeName}</strong><span className="block text-[10px] text-muted-foreground">{row.employeeNo}</span><button type="button" onClick={() => setSelectedPayslip(row)} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary"><Printer className="h-3 w-3" />عرض القسيمة</button></td>
                        <td className="p-3">{row.departmentName || "—"}</td>
                        <td className="p-3 font-mono">{money(row.basicSalary)}</td>
                        <td className="p-3 font-mono">{money(row.housingAllowance + row.transportAllowance + row.otherAllowances)}</td>
                        <td className="p-3 font-mono">{money(row.overtimeAmount)}</td>
                        <td className="p-3 font-mono">{money(row.totalDeductions)}</td>
                        <td className="p-3 font-mono font-black">{money(row.netSalary)}</td>
                      </tr>)}
                      {visibleDetails.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{isLive ? "لا توجد تفاصيل مطابقة للبحث في هذا المسير." : "لا توجد بيانات فعلية متاحة في وضع المعاينة."}</td></tr>}
                    </tbody>
                  </table>
                </div>
              }
            </>
          )}
        </TabsContent>

        <TabsContent value="distribution" className="pt-3">
          <PayrollDistributionPanel orgUnits={orgUnits} employees={employees} details={details}
            periodLabel={selectedRun ? `${selectedRun.periodMonth}-${selectedRun.periodYear}` : "—"}
            isEstimate={!details.length} currencyCode={currency} />
        </TabsContent>
        <TabsContent value="monthly" className="pt-3"><MonthlyReportsPanel /></TabsContent>
        <TabsContent value="reconciliation" className="space-y-4 pt-3"><PayrollReconciliationPanel /><SettlementNotificationsPanel /></TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedPayslip)} onOpenChange={(open) => { if (!open) setSelectedPayslip(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>قسيمة الراتب — {selectedPayslip?.employeeName}</DialogTitle></DialogHeader>
          {selectedPayslip && <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">{selectedPayslip.employeeNo} · {selectedPayslip.departmentName || "—"} · {selectedRun?.periodMonth}/{selectedRun?.periodYear}</p>
            <div className="grid grid-cols-2 gap-3 rounded-xl border p-4">
              <span>الراتب الأساسي</span><strong>{money(selectedPayslip.basicSalary)}</strong>
              <span>البدلات</span><strong>{money(selectedPayslip.housingAllowance + selectedPayslip.transportAllowance)}</strong>
              <span>العمل الإضافي</span><strong>{money(selectedPayslip.overtimeAmount)}</strong>
              <span>الاستقطاعات</span><strong>{money(selectedPayslip.totalDeductions)}</strong>
              <span className="font-black text-primary">صافي الراتب</span><strong className="font-black text-primary">{money(selectedPayslip.netSalary)}</strong>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
};
