import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import { calculateEOSB, type SeparationType } from '../../lib/utils/eosb-calculator';
import { exportToCSV, generateWPSSIFFile } from '../../lib/utils/export-helpers';
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
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';

export const PayrollView: React.FC = () => {
  const {
    payrollRuns,
    payrollDetails,
    loans,
    settlements,
    employees,
    processPayrollRun,
    lockAndConfirmPayrollRun,
    markPayrollAsPaid,
    createLoan,
    createSettlement,
    language,
    t,
  } = useApp();

  const [activeTab, setActiveTab] = useState('runs');
  const [selectedRunId, setSelectedRunId] = useState(payrollRuns[0]?.id || '');
  const [selectedPayslipEmployee, setSelectedPayslipEmployee] = useState<any | null>(null);

  // Loan Modal State
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanAmount, setLoanAmount] = useState(5000);
  const [installmentsCount, setInstallmentsCount] = useState(5);
  const [loanReason, setLoanReason] = useState('');

  // EOSB Settlement Wizard State
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementEmpId, setSettlementEmpId] = useState(employees[0]?.id || '');
  const [terminationDate, setTerminationDate] = useState('2026-08-31');
  const [separationType, setSeparationType] = useState<SeparationType>('contract_expiration');

  const selectedRun = payrollRuns.find(r => r.id === selectedRunId) || payrollRuns[0];

  const handleRunNewPayroll = () => {
    processPayrollRun('pg-monthly', 2026, 9);
    alert('تم بدء احتساب مسير رواتب شهر سبتمبر 2026 بنجاح');
  };

  const handleExportWPS = () => {
    const wpsRecords = payrollDetails.map(d => ({
      employeeId: d.employeeNo,
      employeeName: d.employeeName,
      iban: d.iban,
      basicSalary: d.basicSalary,
      housingAllowance: d.housingAllowance,
      otherEarnings: d.transportAllowance + d.overtimeAmount,
      deductions: d.totalDeductions,
      netSalary: d.netSalary,
    }));

    generateWPSSIFFile('1010789654', 'RIBL', '202608', wpsRecords);
    alert('تم توليد وتنزيل ملف حماية الأجور (WPS SIF File) بنجاح!');
  };

  const handleExportPayrollCSV = () => {
    const data = payrollDetails.map(d => ({
      'الرقم الوظيفي': d.employeeNo,
      'اسم الموظف': d.employeeName,
      'القسم': d.departmentName,
      'البنك': d.bankName,
      'الآيبان': d.iban,
      'الراتب الأساسي': d.basicSalary,
      'بدل السكن': d.housingAllowance,
      'بدل النقل': d.transportAllowance,
      'أجر الإضافي': d.overtimeAmount,
      'تأمينات GOSI (موظف)': d.gosiEmployeeDeduction,
      'سلف وخصومات': d.loanInstallmentDeduction + d.absenceLateDeduction,
      'صافي الراتب': d.netSalary,
    }));
    exportToCSV(`Payroll_Run_${selectedRun.periodYear}_${selectedRun.periodMonth}`, data);
  };

  const handleCreateLoan = () => {
    if (!loanReason) {
      alert('يرجى كتابة سبب طلب السلفة');
      return;
    }
    createLoan({
      principalAmount: loanAmount,
      monthlyInstallment: Math.round(loanAmount / installmentsCount),
      totalInstallments: installmentsCount,
      reason: loanReason,
    });
    alert('تم إرسال طلب السلفة للاعتماد');
    setIsLoanModalOpen(false);
    setLoanReason('');
  };

  const handleCalculateAndSaveSettlement = () => {
    const emp = employees.find(e => e.id === settlementEmpId);
    if (!emp) return;

    const eosbRes = calculateEOSB({
      totalMonthlyWage: emp.totalSalary,
      startDate: emp.hireDate,
      endDate: terminationDate,
      separationType,
    });

    const leavePayout = Number(((emp.totalSalary / 30) * 10).toFixed(2)); // 10 days balance
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
      status: 'pending_approval',
    });

    alert(`تم احتساب مخالصة نهاية الخدمة بنجاح! إجمالي المستحق: ${netTotal.toLocaleString()} ر.س`);
    setIsSettlementModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {t.payroll.payrollRuns} والعمليات المالية
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            محرك احتساب الرواتب التلقائي، ملفات حماية الأجور (WPS SIF)، السلف، ومكافأة نهاية الخدمة (EOSB)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleRunNewPayroll}
            size="sm"
            className="font-bold text-xs gap-1.5 bg-primary"
          >
            <Plus className="h-4 w-4" />
            {t.payroll.runNewPayroll}
          </Button>
          <Button
            onClick={() => setIsSettlementModalOpen(true)}
            variant="outline"
            size="sm"
            className="font-bold text-xs gap-1.5"
          >
            {t.payroll.finalSettlement}
          </Button>
          <Button
            onClick={() => setIsLoanModalOpen(true)}
            variant="secondary"
            size="sm"
            className="font-bold text-xs gap-1.5"
          >
            {t.payroll.newLoan}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="runs" className="text-xs font-bold">
            {t.payroll.payrollRuns} ({payrollRuns.length})
          </TabsTrigger>
          <TabsTrigger value="loans" className="text-xs font-bold">
            {t.payroll.loansAndAdvances} ({loans.length})
          </TabsTrigger>
          <TabsTrigger value="settlements" className="text-xs font-bold">
            {t.payroll.finalSettlement} ({settlements.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Payroll Runs */}
        <TabsContent value="runs" className="space-y-4 pt-4">
          {/* Active Run Overview Card */}
          {selectedRun && (
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-foreground">
                      مسير رواتب {selectedRun.periodMonth} / {selectedRun.periodYear} ({selectedRun.payrollGroupName})
                    </h2>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        selectedRun.status === 'confirmed_locked'
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                          : selectedRun.status === 'paid'
                          ? 'bg-purple-500/10 text-purple-700 border-purple-200'
                          : 'bg-amber-500/10 text-amber-700 border-amber-200'
                      }`}
                    >
                      {selectedRun.status === 'confirmed_locked'
                        ? 'مغلق ومؤكد'
                        : selectedRun.status === 'paid'
                        ? 'تم الصرف بنجاح'
                        : 'جاهز للمراجعة والاعتماد'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    طريقة الاحتساب: ثابت 30 يوم • التغطية: {selectedRun.totalEmployees} موظف
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleExportPayrollCSV}
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    تصدير المسير (Excel)
                  </Button>
                  <Button
                    onClick={handleExportWPS}
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold gap-1 text-primary border-primary/30"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t.payroll.wpsExport}
                  </Button>
                  {selectedRun.status === 'ready_for_review' && (
                    <Button
                      onClick={() => lockAndConfirmPayrollRun(selectedRun.id)}
                      size="sm"
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      اعتماد وقفل المسير
                    </Button>
                  )}
                  {selectedRun.status === 'confirmed_locked' && (
                    <Button
                      onClick={() => markPayrollAsPaid(selectedRun.id)}
                      size="sm"
                      className="text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تأكيد الصرف البنكي
                    </Button>
                  )}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <span className="text-muted-foreground">إجمالي الراتب الأساسي</span>
                  <p className="text-base font-bold text-foreground mt-1">
                    {selectedRun.totalBasicSalary.toLocaleString()} {t.currency}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <span className="text-muted-foreground">البدلات والإضافي</span>
                  <p className="text-base font-bold text-emerald-600 mt-1">
                    +{(selectedRun.totalAllowances + selectedRun.totalOvertimeAmount).toLocaleString()} {t.currency}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <span className="text-muted-foreground">الاستقطاعات والتأمينات</span>
                  <p className="text-base font-bold text-destructive mt-1">
                    -{selectedRun.totalDeductions.toLocaleString()} {t.currency}
                  </p>
                </div>
                <div className="rounded-lg border bg-primary/10 border-primary/20 p-3">
                  <span className="text-primary font-semibold">صافي المسير النهائي</span>
                  <p className="text-lg font-black text-primary mt-1">
                    {selectedRun.totalNetSalary.toLocaleString()} {t.currency}
                  </p>
                </div>
              </div>

              {/* Employee Breakdown Table */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/40 font-bold text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3 text-start">الموظف</th>
                      <th className="py-2.5 px-3 text-start">الراتب الأساسي</th>
                      <th className="py-2.5 px-3 text-start">البدلات</th>
                      <th className="py-2.5 px-3 text-start">إضافي (OT)</th>
                      <th className="py-2.5 px-3 text-start">التأمينات (GOSI)</th>
                      <th className="py-2.5 px-3 text-start">سلف وخصومات</th>
                      <th className="py-2.5 px-3 text-start font-bold text-foreground">الصافي</th>
                      <th className="py-2.5 px-3 text-center">القسيمة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payrollDetails.map(item => (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-bold text-foreground">
                          {item.employeeName}
                          <span className="block text-[10px] font-normal text-muted-foreground">{item.departmentName}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{item.basicSalary.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-600">
                          +{(item.housingAllowance + item.transportAllowance).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-600">
                          {item.overtimeAmount > 0 ? `+${item.overtimeAmount.toLocaleString()}` : '0'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-destructive">
                          -{item.gosiEmployeeDeduction.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-destructive">
                          {(item.loanInstallmentDeduction + item.absenceLateDeduction) > 0
                            ? `-${(item.loanInstallmentDeduction + item.absenceLateDeduction).toLocaleString()}`
                            : '0'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black text-foreground">
                          {item.netSalary.toLocaleString()} {t.currency}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPayslipEmployee(item)}
                            className="h-6 text-[11px] text-primary gap-1 font-bold"
                          >
                            <FileText className="h-3 w-3" />
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
            {loans.map(l => (
              <div key={l.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{l.employeeName}</span>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                    سلفة نشطة
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2 text-muted-foreground">
                  <div>مبلغ السلفة: <span className="font-bold text-foreground">{l.principalAmount.toLocaleString()} ر.س</span></div>
                  <div>القسط الشهري: <span className="font-bold text-foreground">{l.monthlyInstallment.toLocaleString()} ر.س</span></div>
                  <div>الأقساط المسددة: <span className="font-bold">{l.paidInstallments} من {l.totalInstallments}</span></div>
                  <div>الرصيد المتبقي: <span className="font-bold text-destructive">{l.remainingBalance.toLocaleString()} ر.س</span></div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Final Settlements */}
        <TabsContent value="settlements" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settlements.map(s => (
              <div key={s.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{s.employeeName}</span>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                    معتمدة للصرف
                  </Badge>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-2">
                  <div className="flex justify-between">
                    <span>مدة الخدمة:</span>
                    <span className="font-bold text-foreground">{s.serviceYears} سنوات و {s.serviceMonths} أشهر</span>
                  </div>
                  <div className="flex justify-between">
                    <span>مكافأة نهاية الخدمة (EOSB):</span>
                    <span className="font-bold text-emerald-600">{s.eosbAmount.toLocaleString()} ر.س</span>
                  </div>
                  <div className="flex justify-between">
                    <span>تصفية رصيد الإجازات:</span>
                    <span className="font-bold text-foreground">{s.leaveBalancePayoutAmount.toLocaleString()} ر.س ({s.leaveBalancePayoutDays} يوم)</span>
                  </div>
                  <div className="flex justify-between font-bold text-primary border-t pt-1.5 text-sm">
                    <span>صافي الشيك النهائي:</span>
                    <span>{s.netSettlementAmount.toLocaleString()} ر.س</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Digital Payslip Modal */}
      {selectedPayslipEmployee && (
        <Dialog open={!!selectedPayslipEmployee} onOpenChange={() => setSelectedPayslipEmployee(null)}>
          <DialogContent className="max-w-md p-6">
            <div className="border-b pb-4 text-center space-y-1">
              <div className="flex justify-center">
                <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground font-black text-xl flex items-center justify-center">
                  HR
                </div>
              </div>
              <h2 className="text-base font-black text-foreground">قسيمة الراتب الإلكترونية المعتمدة</h2>
              <p className="text-xs text-muted-foreground">شهر أغسطس 2026 • شركة فوكس القابضة</p>
            </div>

            <div className="space-y-3 text-xs py-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">اسم الموظف:</span>
                <span className="font-bold text-foreground">{selectedPayslipEmployee.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الرقم الوظيفي:</span>
                <span className="font-mono font-bold">{selectedPayslipEmployee.employeeNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">البنك والآيبان:</span>
                <span className="font-mono">{selectedPayslipEmployee.bankName}</span>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span>الراتب الأساسي:</span>
                  <span>{selectedPayslipEmployee.basicSalary.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>بدل السكن:</span>
                  <span>+{selectedPayslipEmployee.housingAllowance.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>بدل النقل:</span>
                  <span>+{selectedPayslipEmployee.transportAllowance.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>التأمينات الاجتماعية (GOSI):</span>
                  <span>-{selectedPayslipEmployee.gosiEmployeeDeduction.toLocaleString()} ر.س</span>
                </div>
                {selectedPayslipEmployee.loanInstallmentDeduction > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>استقطاع السلفة الشهرية:</span>
                    <span>-{selectedPayslipEmployee.loanInstallmentDeduction.toLocaleString()} ر.س</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-black text-sm text-primary">
                  <span>صافي الراتب المحول:</span>
                  <span>{selectedPayslipEmployee.netSalary.toLocaleString()} ر.س</span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button size="sm" onClick={() => window.print()} variant="outline" className="flex-1 text-xs font-bold gap-1">
                <Printer className="h-3.5 w-3.5" />
                طباعة
              </Button>
              <Button size="sm" onClick={() => alert('تم تنزيل قسيمة الراتب PDF')} className="flex-1 text-xs font-bold gap-1 bg-primary">
                <Download className="h-3.5 w-3.5" />
                تحميل PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Loan Request Modal */}
      <Dialog open={isLoanModalOpen} onOpenChange={setIsLoanModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              طلب سلفة مالية جديدة
            </DialogTitle>
            <DialogDescription className="text-xs">
              تخضع السلف لسياسة المنشأة وتستقطع شهرياً عبر مسير الرواتب
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">المبلغ المطلوب (ر.س) *</label>
              <input
                type="number"
                value={loanAmount}
                onChange={e => setLoanAmount(Number(e.target.value))}
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">عدد أشهر السداد (الأقساط) *</label>
              <select
                value={installmentsCount}
                onChange={e => setInstallmentsCount(Number(e.target.value))}
                className="w-full h-8 rounded border px-2.5"
              >
                <option value={3}>3 أشهر ({Math.round(loanAmount / 3)} ر.س / شهر)</option>
                <option value={5}>5 أشهر ({Math.round(loanAmount / 5)} ر.س / شهر)</option>
                <option value={10}>10 أشهر ({Math.round(loanAmount / 10)} ر.س / شهر)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold">سبب طلب السلفة *</label>
              <textarea
                rows={2}
                value={loanReason}
                onChange={e => setLoanReason(e.target.value)}
                placeholder="اكتب سبب طلب السلفة..."
                className="w-full rounded border p-2 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleCreateLoan} className="text-xs bg-primary font-bold">
              تأكيد وإرسال طلب السلفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EOSB Settlement Wizard Modal */}
      <Dialog open={isSettlementModalOpen} onOpenChange={setIsSettlementModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              معالج مخالصة نهاية الخدمة (EOSB Calculator)
            </DialogTitle>
            <DialogDescription className="text-xs">
              احتساب تلقائي وفق المادتين 84 و 85 من نظام العمل السعودي
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">الموظف المعني *</label>
              <select
                value={settlementEmpId}
                onChange={e => setSettlementEmpId(e.target.value)}
                className="w-full h-8 rounded border px-2.5"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} ({emp.jobTitleAr})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold">سبب انتهاء العلاقة العقدية *</label>
              <select
                value={separationType}
                onChange={e => setSeparationType(e.target.value as SeparationType)}
                className="w-full h-8 rounded border px-2.5"
              >
                <option value="contract_expiration">انتهاء مدة العقد أو فسخه بالتراضي (100% مكافأة)</option>
                <option value="termination_by_employer">إنهاء من قبل صاحب العمل (100% مكافأة)</option>
                <option value="resignation">استقالة الموظف (تخضع لشرائح المادة 85)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold">تاريخ آخر يوم عمل *</label>
              <input
                type="date"
                value={terminationDate}
                onChange={e => setTerminationDate(e.target.value)}
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleCalculateAndSaveSettlement} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              احتساب وتوليد مسودة المخالصة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
