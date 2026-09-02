import React, { useEffect, useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { calculateEOSB, type SeparationType } from "../../lib/utils/eosb-calculator";
import { exportToCSV, generateWPSSIFFile } from "../../lib/utils/export-helpers";
import type { EmployeePayrollDetail } from "../../types";
import { IconSymbol } from "../ui/IconSymbol";
import {
  Wallet,
  DollarSign,
  Download,
  Lock,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Eye,
  Plus,
  ArrowDownRight,
  TrendingUp,
  Receipt,
  Printer,
  ShieldCheck,
  Building,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

interface PayrollViewProps {
  section?: "payroll" | "loans";
}

export const PayrollView: React.FC<PayrollViewProps> = ({ section = "payroll" }) => {
  const {
    payrollRuns,
    payrollDetails,
    loans,
    settlements,
    employees,
    payrollGroups,
    company,
    currentRole,
    processPayrollRun,
    lockAndConfirmPayrollRun,
    markPayrollAsPaid,
    createLoan,
    createSettlement,
    openEmployeeProfile,
    language,
    t,
  } = useApp();

  const [activeTab, setActiveTab] = useState(section === "payroll" ? "runs" : "loans");
  const [selectedRunId, setSelectedRunId] = useState(payrollRuns[0]?.id || "");
  const [selectedPayslipEmployee, setSelectedPayslipEmployee] =
    useState<EmployeePayrollDetail | null>(null);

  const today = new Date();
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runGroupId, setRunGroupId] = useState(payrollGroups[0]?.id || "");
  const [runYear, setRunYear] = useState(today.getFullYear());
  const [runMonth, setRunMonth] = useState(today.getMonth() + 1);

  // Loan Modal State
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanAmount, setLoanAmount] = useState(5000);
  const [installmentsCount, setInstallmentsCount] = useState(5);
  const [loanReason, setLoanReason] = useState("");

  // EOSB Settlement Wizard State
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementEmpId, setSettlementEmpId] = useState(employees[0]?.id || "");
  const [terminationDate, setTerminationDate] = useState("2026-08-31");
  const [separationType, setSeparationType] = useState<SeparationType>("contract_expiration");

  const selectedRun = payrollRuns.find((r) => r.id === selectedRunId) || payrollRuns[0];
  const selectedRunDetails = selectedRun
    ? payrollDetails.filter((detail) => detail.payrollRunId === selectedRun.id)
    : [];

  const canManagePayroll = ["super_admin", "hr_manager", "payroll_officer"].includes(currentRole);
  const canManageSettlements = [
    "super_admin",
    "hr_manager",
    "payroll_officer",
    "finance_officer",
  ].includes(currentRole);
  const canRequestLoan = currentRole !== "auditor";

  useEffect(() => {
    setActiveTab(section === "payroll" ? "runs" : "loans");
  }, [section]);

  useEffect(() => {
    if (selectedRun && selectedRun.id !== selectedRunId) setSelectedRunId(selectedRun.id);
  }, [selectedRun, selectedRunId]);

  const handleRunNewPayroll = () => {
    const groupId = payrollGroups.some((group) => group.id === runGroupId)
      ? runGroupId
      : payrollGroups[0]?.id;
    if (!groupId) {
      toast.error("يجب إنشاء مجموعة رواتب أولاً قبل تشغيل المسير");
      return;
    }
    processPayrollRun(groupId, runYear, runMonth);
    setSelectedRunId(`pr-${groupId}-${runYear}-${String(runMonth).padStart(2, "0")}`);
    setIsRunModalOpen(false);
    toast.success(`تم بدء احتساب مسير رواتب ${runMonth}/${runYear} بنجاح`);
  };

  const handleExportWPS = () => {
    if (!selectedRun) return;
    const establishmentId = company.crNumber || company.taxNumber || "1010892341";
    const employerBankCode = "NCBKSA";
    if (selectedRunDetails.length === 0) {
      toast.error("لا توجد تفاصيل موظفين في المسير المختار");
      return;
    }
    const wpsRecords = selectedRunDetails.map((d) => ({
      employeeId: d.employeeNo,
      employeeName: d.employeeName,
      iban: d.iban || "SA0000000000000000000000",
      basicSalary: d.basicSalary,
      housingAllowance: d.housingAllowance,
      otherEarnings: d.transportAllowance + d.overtimeAmount,
      deductions: d.totalDeductions,
      netSalary: d.netSalary,
    }));

    const payrollPeriod = `${selectedRun.periodYear}${String(selectedRun.periodMonth).padStart(2, "0")}`;
    generateWPSSIFFile(establishmentId, employerBankCode, payrollPeriod, wpsRecords);
    toast.success("تم توليد وتنزيل ملف حماية الأجور (WPS SIF File) المعتمد بنجاح!");
  };

  const handleExportPayrollCSV = () => {
    if (!selectedRun) return;
    const data = selectedRunDetails.map((d) => ({
      "الرقم الوظيفي": d.employeeNo,
      "اسم الموظف": d.employeeName,
      القسم: d.departmentName,
      البنك: d.bankName,
      الآيبان: d.iban,
      "الراتب الأساسي": d.basicSalary,
      "بدل السكن": d.housingAllowance,
      "بدل النقل": d.transportAllowance,
      "أجر الإضافي": d.overtimeAmount,
      "تأمينات GOSI (موظف)": d.gosiEmployeeDeduction,
      "سلف وخصومات": d.loanInstallmentDeduction + d.absenceLateDeduction,
      "صافي الراتب": d.netSalary,
    }));
    exportToCSV(`Payroll_Run_${selectedRun.periodYear}_${selectedRun.periodMonth}`, data);
  };

  const handleCreateLoan = () => {
    if (!loanReason) {
      toast.error("يرجى كتابة سبب طلب السلفة");
      return;
    }
    createLoan({
      principalAmount: loanAmount,
      monthlyInstallment: Math.round(loanAmount / installmentsCount),
      totalInstallments: installmentsCount,
      reason: loanReason,
    });
    toast.success("تم إرسال طلب السلفة للاعتماد بنجاح");
    setIsLoanModalOpen(false);
    setLoanReason("");
  };

  const handleCalculateAndSaveSettlement = () => {
    const emp = employees.find((e) => e.id === settlementEmpId);
    if (!emp) return;

    const eosbRes = calculateEOSB({
      totalMonthlyWage: emp.totalSalary,
      startDate: emp.hireDate,
      endDate: terminationDate,
      separationType,
    });

    const leavePayout = Number(((emp.totalSalary / 30) * 10).toFixed(2));
    const netTotal = eosbRes.finalEOSBAmount + leavePayout + emp.totalSalary;

    createSettlement({
      employeeId: emp.id,
      employeeName: `${emp.firstNameAr} ${emp.lastNameAr}`,
      terminationDate,
      noticePeriodServed: true,
      serviceYears: eosbRes.serviceYears,
      serviceMonths: eosbRes.serviceMonths,
      eosbAmount: eosbRes.finalEOSBAmount,
      leaveBalancePayoutDays: 10,
      leaveBalancePayoutAmount: leavePayout,
      pendingSalaryAmount: emp.totalSalary,
      loanDeductionAmount: 0,
      assetClearanceComplete: true,
      netSettlementAmount: netTotal,
      status: "pending_approval",
    });

    toast.success(`تم احتساب مخالصة نهاية الخدمة بنجاح! إجمالي المستحق: ${netTotal.toLocaleString()} ر.س`);
    setIsSettlementModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="account_balance_wallet" source="material" filled size={24} className="text-primary" />
            {section === "payroll"
              ? `${t.payroll.payrollRuns} والعمليات المالية (M05)`
              : `${t.payroll.loansAndAdvances} و${t.payroll.finalSettlement} (M13)`}
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            {section === "payroll"
              ? "محرك احتساب الرواتب الآلي، خصومات التأمينات (GOSI)، حماية الأجور (WPS)، وقسائم الرواتب"
              : "إدارة طلبات السلف وجدولة الأقساط الشهرية ومكافأة نهاية الخدمة (EOSB)"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {section === "payroll" && canManagePayroll && (
            <Button
              onClick={() => {
                setRunGroupId(payrollGroups[0]?.id || "");
                setIsRunModalOpen(true);
              }}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              {t.payroll.runNewPayroll}
            </Button>
          )}
          {section === "loans" && canManageSettlements && (
            <Button
              onClick={() => setIsSettlementModalOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
            >
              <FileCheck className="h-4 w-4 text-primary" />
              {t.payroll.finalSettlement}
            </Button>
          )}
          {section === "loans" && canRequestLoan && (
            <Button
              onClick={() => setIsLoanModalOpen(true)}
              variant="secondary"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs"
            >
              <DollarSign className="h-4 w-4 text-primary" />
              {t.payroll.newLoan}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={`grid max-w-md bg-muted/60 p-1 rounded-full border border-border/60 ${
            section === "payroll" ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {section === "payroll" ? (
            <TabsTrigger value="runs" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
              {t.payroll.payrollRuns} ({payrollRuns.length})
            </TabsTrigger>
          ) : (
            <>
              <TabsTrigger value="loans" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                {t.payroll.loansAndAdvances} ({loans.length})
              </TabsTrigger>
              <TabsTrigger value="settlements" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                {t.payroll.finalSettlement} ({settlements.length})
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Tab 1: Payroll Runs */}
        <TabsContent value="runs" className="space-y-4 pt-4">
          {/* Active Run Overview Card */}
          {selectedRun && (
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-black text-foreground">
                      مسير رواتب {selectedRun.periodMonth} / {selectedRun.periodYear} (
                      {selectedRun.payrollGroupName})
                    </h2>
                    <Badge
                      variant="outline"
                      className={`text-xs rounded-full px-3 py-0.5 font-bold ${
                        selectedRun.status === "confirmed_locked"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                          : selectedRun.status === "paid"
                            ? "bg-purple-500/10 text-purple-700 border-purple-200"
                            : "bg-amber-500/10 text-amber-700 border-amber-200"
                      }`}
                    >
                      {selectedRun.status === "confirmed_locked"
                        ? "مغلق ومؤكد"
                        : selectedRun.status === "paid"
                          ? "تم الصرف بنجاح"
                          : "جاهز للمراجعة والاعتماد"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    طريقة الاحتساب: ثابت 30 يوم • التغطية: {selectedRun.totalEmployees} موظف مسجل
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {payrollRuns.length > 1 && (
                    <select
                      aria-label="اختيار مسير الرواتب"
                      value={selectedRun.id}
                      onChange={(event) => setSelectedRunId(event.target.value)}
                      className="h-9 rounded-full border border-border/80 bg-background px-3 text-xs font-bold"
                    >
                      {payrollRuns.map((run) => (
                        <option key={run.id} value={run.id}>
                          {run.periodMonth}/{run.periodYear} — {run.payrollGroupName}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    onClick={handleExportPayrollCSV}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs font-bold gap-1.5 h-9 border-border/80 hover:bg-secondary"
                  >
                    <Download className="h-3.5 w-3.5" />
                    تصدير Excel
                  </Button>
                  <Button
                    onClick={handleExportWPS}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs font-bold gap-1.5 text-primary border-primary/30 hover:bg-secondary h-9"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t.payroll.wpsExport}
                  </Button>
                  {canManagePayroll && selectedRun.status === "ready_for_review" && (
                    <Button
                      onClick={() => lockAndConfirmPayrollRun(selectedRun.id)}
                      size="sm"
                      className="rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9 px-4"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      اعتماد وقفل المسير
                    </Button>
                  )}
                  {canManagePayroll && selectedRun.status === "confirmed_locked" && (
                    <Button
                      onClick={() => markPayrollAsPaid(selectedRun.id)}
                      size="sm"
                      className="rounded-full text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-9 px-4"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تأكيد الصرف البنكي
                    </Button>
                  )}
                </div>
              </div>

              {/* Totals Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <span className="text-muted-foreground font-bold">إجمالي الراتب الأساسي</span>
                  <p className="text-lg font-black text-foreground mt-1 font-mono">
                    {selectedRun.totalBasicSalary.toLocaleString()} {t.currency}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <span className="text-muted-foreground font-bold">البدلات والإضافي</span>
                  <p className="text-lg font-black text-emerald-600 mt-1 font-mono">
                    +{(selectedRun.totalAllowances + selectedRun.totalOvertimeAmount).toLocaleString()} {t.currency}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <span className="text-muted-foreground font-bold">الاستقطاعات والتأمينات</span>
                  <p className="text-lg font-black text-destructive mt-1 font-mono">
                    -{selectedRun.totalDeductions.toLocaleString()} {t.currency}
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-secondary/30 p-4">
                  <span className="text-primary font-bold">صافي المسير النهائي</span>
                  <p className="text-xl font-black text-primary mt-1 font-mono">
                    {selectedRun.totalNetSalary.toLocaleString()} {t.currency}
                  </p>
                </div>
              </div>

              {/* Employee Breakdown Table */}
              <div className="overflow-x-auto rounded-2xl border border-border/60">
                <table className="w-full text-xs">
                  <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                    <tr>
                      <th className="py-3 px-3 text-start">الموظف</th>
                      <th className="py-3 px-3 text-start">الراتب الأساسي</th>
                      <th className="py-3 px-3 text-start">البدلات</th>
                      <th className="py-3 px-3 text-start">إضافي (OT)</th>
                      <th className="py-3 px-3 text-start">التأمينات (GOSI)</th>
                      <th className="py-3 px-3 text-start">سلف وخصومات</th>
                      <th className="py-3 px-3 text-start font-bold text-foreground">الصافي</th>
                      <th className="py-3 px-3 text-center">القسيمة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {selectedRunDetails.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => openEmployeeProfile(item.employeeId)}
                            className="text-start font-bold text-foreground block group-hover:text-primary group-hover:underline cursor-pointer"
                          >
                            {item.employeeName}
                          </button>
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            {item.departmentName}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {item.basicSalary.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-600">
                          +{(item.housingAllowance + item.transportAllowance).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-600">
                          {item.overtimeAmount > 0
                            ? `+${item.overtimeAmount.toLocaleString()}`
                            : "0"}
                        </td>
                        <td className="py-3 px-3 font-mono text-destructive">
                          -{item.gosiEmployeeDeduction.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-destructive">
                          {item.loanInstallmentDeduction + item.absenceLateDeduction > 0
                            ? `-${(item.loanInstallmentDeduction + item.absenceLateDeduction).toLocaleString()}`
                            : "0"}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-foreground">
                          {item.netSalary.toLocaleString()} {t.currency}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPayslipEmployee(item)}
                            className="h-7 text-xs text-primary gap-1 font-bold rounded-full hover:bg-secondary px-3"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            عرض
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Loans */}
        <TabsContent value="loans" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loans.map((l) => (
              <div key={l.id} className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3 hover:border-primary/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-foreground">{l.employeeName}</span>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold">
                    سلفة نشطة
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/60 pt-3 text-muted-foreground font-medium">
                  <div>
                    مبلغ السلفة:{" "}
                    <span className="font-bold text-foreground font-mono">
                      {l.principalAmount.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div>
                    القسط الشهري:{" "}
                    <span className="font-bold text-foreground font-mono">
                      {l.monthlyInstallment.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div>
                    الأقساط المسددة:{" "}
                    <span className="font-bold font-mono">
                      {l.paidInstallments} من {l.totalInstallments}
                    </span>
                  </div>
                  <div>
                    الرصيد المتبقي:{" "}
                    <span className="font-bold text-destructive font-mono">
                      {l.remainingBalance.toLocaleString()} ر.س
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Final Settlements */}
        <TabsContent value="settlements" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settlements.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3 hover:border-primary/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-foreground">{s.employeeName}</span>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold">
                    معتمدة للصرف
                  </Badge>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground border-t border-border/60 pt-3 font-medium">
                  <div className="flex justify-between">
                    <span>مدة الخدمة:</span>
                    <span className="font-bold text-foreground">
                      {s.serviceYears} سنوات و {s.serviceMonths} أشهر
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>مكافأة نهاية الخدمة (EOSB):</span>
                    <span className="font-bold text-emerald-600 font-mono">
                      {s.eosbAmount.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>تصفية رصيد الإجازات:</span>
                    <span className="font-bold text-foreground font-mono">
                      {s.leaveBalancePayoutAmount.toLocaleString()} ر.س ({s.leaveBalancePayoutDays} يوم)
                    </span>
                  </div>
                  <div className="flex justify-between font-black text-primary border-t border-border/60 pt-2 text-sm">
                    <span>صافي الشيك النهائي:</span>
                    <span className="font-mono">{s.netSettlementAmount.toLocaleString()} ر.س</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Payroll Run Setup Modal */}
      <Dialog open={isRunModalOpen} onOpenChange={setIsRunModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              تشغيل مسير رواتب جديد
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              اختر مجموعة الرواتب والفترة المطلوب تجميع الحضور والسلف والاستحقاقات لها
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold" htmlFor="payroll-group">
                مجموعة الرواتب *
              </label>
              <select
                id="payroll-group"
                value={runGroupId}
                onChange={(event) => setRunGroupId(event.target.value)}
                className="h-10 w-full rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold text-xs"
              >
                {payrollGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold" htmlFor="payroll-month">
                  الشهر *
                </label>
                <select
                  id="payroll-month"
                  value={runMonth}
                  onChange={(event) => setRunMonth(Number(event.target.value))}
                  className="h-10 w-full rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold text-xs"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold" htmlFor="payroll-year">
                  السنة *
                </label>
                <select
                  id="payroll-year"
                  value={runYear}
                  onChange={(event) => setRunYear(Number(event.target.value))}
                  className="h-10 w-full rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold text-xs"
                >
                  {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(
                    (year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleRunNewPayroll}
              disabled={payrollGroups.length === 0}
              className="rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground px-5 h-9"
            >
              بدء الاحتساب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Digital Payslip Modal */}
      {selectedPayslipEmployee && (
        <Dialog
          open={!!selectedPayslipEmployee}
          onOpenChange={() => setSelectedPayslipEmployee(null)}
        >
          <DialogContent className="max-w-md rounded-3xl p-6">
            <div className="border-b border-border/60 pb-4 text-center space-y-1.5">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground font-black text-xl flex items-center justify-center shadow-md">
                  HR
                </div>
              </div>
              <h2 className="text-base font-black text-foreground">
                قسيمة الراتب الإلكترونية المعتمدة
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                شهر {selectedRun?.periodMonth ?? "—"} / {selectedRun?.periodYear ?? "—"} •{" "}
                {company.legalNameAr}
              </p>
            </div>

            <div className="space-y-3.5 text-xs py-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">اسم الموظف:</span>
                <span className="font-bold text-foreground">
                  {selectedPayslipEmployee.employeeName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الرقم الوظيفي:</span>
                <span className="font-mono font-bold">{selectedPayslipEmployee.employeeNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">البنك والآيبان:</span>
                <span className="font-mono font-bold text-primary">{selectedPayslipEmployee.bankName}</span>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span>الراتب الأساسي:</span>
                  <span>{selectedPayslipEmployee.basicSalary.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>بدل السكن:</span>
                  <span>+{selectedPayslipEmployee.housingAllowance.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>بدل النقل:</span>
                  <span>+{selectedPayslipEmployee.transportAllowance.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-destructive font-bold">
                  <span>التأمينات الاجتماعية (GOSI):</span>
                  <span>-{selectedPayslipEmployee.gosiEmployeeDeduction.toLocaleString()} ر.س</span>
                </div>
                {selectedPayslipEmployee.loanInstallmentDeduction > 0 && (
                  <div className="flex justify-between text-destructive font-bold">
                    <span>استقطاع السلفة الشهرية:</span>
                    <span>
                      -{selectedPayslipEmployee.loanInstallmentDeduction.toLocaleString()} ر.س
                    </span>
                  </div>
                )}
                <div className="border-t border-border/60 pt-2.5 flex justify-between font-black text-sm text-primary">
                  <span>صافي الراتب المحول:</span>
                  <span>{selectedPayslipEmployee.netSalary.toLocaleString()} ر.س</span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex gap-2 mt-2">
              <Button
                size="sm"
                onClick={() => window.print()}
                variant="outline"
                className="flex-1 text-xs font-bold gap-1.5 rounded-full h-9"
              >
                <Printer className="h-4 w-4" />
                طباعة القسيمة
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="flex-1 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-9"
              >
                <Download className="h-4 w-4" />
                حفظ كـ PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Loan Request Modal */}
      <Dialog open={isLoanModalOpen} onOpenChange={setIsLoanModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              طلب سلفة مالية جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تخضع السلف لسياسة المنشأة وتستقطع شهرياً عبر مسير الرواتب
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">المبلغ المطلوب (ر.س) *</label>
              <input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">عدد أشهر السداد (الأقساط) *</label>
              <select
                value={installmentsCount}
                onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value={3}>3 أشهر ({Math.round(loanAmount / 3)} ر.س / شهر)</option>
                <option value={5}>5 أشهر ({Math.round(loanAmount / 5)} ر.س / شهر)</option>
                <option value={10}>10 أشهر ({Math.round(loanAmount / 10)} ر.س / شهر)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">سبب طلب السلفة *</label>
              <textarea
                rows={2}
                value={loanReason}
                onChange={(e) => setLoanReason(e.target.value)}
                placeholder="اكتب سبب طلب السلفة..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button size="sm" onClick={handleCreateLoan} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              تأكيد وإرسال طلب السلفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
