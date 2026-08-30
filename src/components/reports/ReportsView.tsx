import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import { exportToCSV } from '../../lib/utils/export-helpers';
import {
  FileBarChart,
  Download,
  Filter,
  Users,
  Wallet,
  Clock,
  CalendarDays,
  Receipt,
  FileSpreadsheet,
  Plus,
  Play,
  Table,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export const ReportsView: React.FC = () => {
  const { employees, payrollDetails, attendanceRecords, leaveBalances, expenseClaims, language, t } = useApp();
  const [activeTab, setActiveTab] = useState('catalog');

  // Custom Builder State
  const [selectedSource, setSelectedSource] = useState<'employees' | 'payroll' | 'attendance' | 'expenses'>('employees');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(['employeeNo', 'name', 'jobTitle', 'department', 'totalSalary']);

  const columnOptions: Record<string, { key: string; labelAr: string }[]> = {
    employees: [
      { key: 'employeeNo', labelAr: 'الرقم الوظيفي' },
      { key: 'name', labelAr: 'اسم الموظف' },
      { key: 'nationalId', labelAr: 'رقم الهوية / الإقامة' },
      { key: 'jobTitle', labelAr: 'المسمى الوظيفي' },
      { key: 'department', labelAr: 'القسم' },
      { key: 'hireDate', labelAr: 'تاريخ المباشرة' },
      { key: 'totalSalary', labelAr: 'إجمالي الراتب' },
      { key: 'status', labelAr: 'الحالة' },
    ],
    payroll: [
      { key: 'employeeNo', labelAr: 'الرقم الوظيفي' },
      { key: 'name', labelAr: 'اسم الموظف' },
      { key: 'basicSalary', labelAr: 'الراتب الأساسي' },
      { key: 'housingAllowance', labelAr: 'بدل السكن' },
      { key: 'transportAllowance', labelAr: 'بدل النقل' },
      { key: 'overtimeAmount', labelAr: 'الإضافي' },
      { key: 'totalDeductions', labelAr: 'الخصومات' },
      { key: 'netSalary', labelAr: 'صافي الراتب' },
    ],
    attendance: [
      { key: 'employeeNo', labelAr: 'الرقم الوظيفي' },
      { key: 'name', labelAr: 'اسم الموظف' },
      { key: 'workDate', labelAr: 'التاريخ' },
      { key: 'actualIn', labelAr: 'وقت الدخول' },
      { key: 'actualOut', labelAr: 'وقت الخروج' },
      { key: 'workedHours', labelAr: 'ساعات العمل' },
      { key: 'status', labelAr: 'الحالة' },
    ],
    expenses: [
      { key: 'categoryNameAr', labelAr: 'التصنيف' },
      { key: 'merchantName', labelAr: 'المورد' },
      { key: 'amount', labelAr: 'المبلغ' },
      { key: 'spentAt', labelAr: 'التاريخ' },
      { key: 'description', labelAr: 'الوصف' },
      { key: 'status', labelAr: 'الحالة' },
    ],
  };

  const getCustomReportData = () => {
    switch (selectedSource) {
      case 'employees':
        return employees.map(e => ({
          employeeNo: e.employeeNo,
          name: `${e.firstNameAr} ${e.lastNameAr}`,
          nationalId: e.nationalIdOrIqama,
          jobTitle: e.jobTitleAr,
          department: e.departmentName,
          hireDate: e.hireDate,
          totalSalary: e.totalSalary,
          status: e.status === 'active' ? 'نشط' : 'تحت التجربة',
        }));
      case 'payroll':
        return payrollDetails.map(d => ({
          employeeNo: d.employeeNo,
          name: d.employeeName,
          basicSalary: d.basicSalary,
          housingAllowance: d.housingAllowance,
          transportAllowance: d.transportAllowance,
          overtimeAmount: d.overtimeAmount,
          totalDeductions: d.totalDeductions,
          netSalary: d.netSalary,
        }));
      case 'attendance':
        return attendanceRecords.map(a => ({
          employeeNo: a.employeeNo,
          name: a.employeeName,
          workDate: a.workDate,
          actualIn: a.actualIn || '—',
          actualOut: a.actualOut || '—',
          workedHours: a.workedHours,
          status: a.status === 'present' ? 'حاضر' : a.status === 'late' ? 'متأخر' : 'غائب',
        }));
      case 'expenses':
        return expenseClaims.map(c => ({
          categoryNameAr: c.categoryNameAr,
          merchantName: c.merchantName,
          amount: c.amount,
          spentAt: c.spentAt,
          description: c.description,
          status: c.status === 'approved' ? 'معتمد' : 'قيد المراجعة',
        }));
    }
  };

  const handleExportCustomReport = () => {
    const rawData = getCustomReportData();
    const cols = columnOptions[selectedSource];
    
    // Filter by selected columns
    const filteredRows = rawData.map(row => {
      const res: Record<string, any> = {};
      selectedColumns.forEach(colKey => {
        const colDef = cols.find(c => c.key === colKey);
        const label = colDef ? colDef.labelAr : colKey;
        res[label] = (row as any)[colKey];
      });
      return res;
    });

    exportToCSV(`Custom_Report_${selectedSource}_${new Date().toISOString().split('T')[0]}`, filteredRows);
  };

  const standardReports = [
    { id: 'rep-emp', titleAr: 'تقرير الموظفين الشامل وبيانات العقود', category: 'شؤون الموظفين', format: 'Excel / PDF', count: employees.length },
    { id: 'rep-pay', titleAr: 'تقرير مسيرات الرواتب الشهرية والبدلات', category: 'الرواتب', format: 'Excel / CSV', count: payrollDetails.length },
    { id: 'rep-att', titleAr: 'تقرير الحضور والانصراف وساعات العمل الإضافية', category: 'الحضور', format: 'Excel', count: attendanceRecords.length },
    { id: 'rep-gosi', titleAr: 'تقرير التأمينات الاجتماعية وحماية الأجور (WPS SIF)', category: 'الرواتب', format: 'SIF / Excel', count: payrollDetails.length },
    { id: 'rep-leave', titleAr: 'تقرير أرصدة الإجازات والمحجوز والمستهلك', category: 'الإجازات', format: 'Excel / PDF', count: leaveBalances.length },
    { id: 'rep-exp', titleAr: 'تقرير النفقات والمصروفات ومراكز التكلفة', category: 'المالية', format: 'Excel / PDF', count: expenseClaims.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            {t.system.reportsCatalog} والتحليلات
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            استخراج التقارير القياسية والمخصصة، الجدولة التلقائية وتصدير ملفات Excel / PDF / CSV
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-xs">
          <TabsTrigger value="catalog" className="text-xs font-bold">
            كتالوج التقارير ({standardReports.length})
          </TabsTrigger>
          <TabsTrigger value="builder" className="text-xs font-bold">
            مولد التقارير المخصصة
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Catalog */}
        <TabsContent value="catalog" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {standardReports.map(rep => (
              <div key={rep.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between">
                  <Badge variant="secondary" className="text-[10px]">
                    {rep.category}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">{rep.format}</span>
                </div>

                <h3 className="font-bold text-xs text-foreground leading-relaxed">{rep.titleAr}</h3>

                <div className="border-t pt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (rep.id === 'rep-emp') {
                        exportToCSV('Employees_Report', employees);
                      } else if (rep.id === 'rep-pay') {
                        exportToCSV('Payroll_Report', payrollDetails);
                      } else if (rep.id === 'rep-att') {
                        exportToCSV('Attendance_Report', attendanceRecords);
                      } else {
                        exportToCSV(rep.titleAr, [{ 'الحالة': 'تقرير قياسي معتمد', 'التاريخ': new Date().toISOString() }]);
                      }
                    }}
                    className="w-full text-xs font-bold gap-1 bg-primary"
                  >
                    <Download className="h-3.5 w-3.5" />
                    تصدير التقرير
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Custom Report Builder */}
        <TabsContent value="builder" className="space-y-4 pt-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="border-b pb-3">
              <h3 className="font-bold text-sm text-foreground">أداة بناء التقارير المخصصة (Custom Query Builder)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                اختر مصدر البيانات والحقول المطلوبة لتوليد التقرير وتنزيله مباشرة
              </p>
            </div>

            {/* Source Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">1. مصدر البيانات الرئيسي</label>
                <select
                  value={selectedSource}
                  onChange={e => {
                    const src = e.target.value as any;
                    setSelectedSource(src);
                    setSelectedColumns(columnOptions[src].slice(0, 5).map(c => c.key));
                  }}
                  className="w-full h-9 rounded-lg border bg-background px-3 text-xs"
                >
                  <option value="employees">سجل الموظفين والملفات</option>
                  <option value="payroll">مسيرات الرواتب والبدلات</option>
                  <option value="attendance">كشوف الحضور والانصراف</option>
                  <option value="expenses">مطالبات النفقات والمصروفات</option>
                </select>
              </div>

              {/* Column Selection Checkboxes */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">2. الحقول والأعمدة المراد استخراجها</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {columnOptions[selectedSource].map(col => (
                    <label key={col.key} className="flex items-center gap-1 text-xs cursor-pointer border rounded-md px-2 py-1 bg-muted/20">
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(col.key)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedColumns([...selectedColumns, col.key]);
                          } else {
                            setSelectedColumns(selectedColumns.filter(k => k !== col.key));
                          }
                        }}
                        className="rounded text-primary h-3.5 w-3.5"
                      />
                      <span>{col.labelAr}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                جاهز للتوليد ({getCustomReportData().length} سجل متطابق)
              </span>
              <Button
                onClick={handleExportCustomReport}
                className="text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Download className="h-3.5 w-3.5" />
                توليد وتنزيل التقرير المخصص (CSV)
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
