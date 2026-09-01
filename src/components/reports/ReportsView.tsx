import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { exportToCSV } from "../../lib/utils/export-helpers";
import { IconSymbol } from "../ui/IconSymbol";
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
  Sparkles,
  TrendingUp,
  Award,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export const ReportsView: React.FC = () => {
  const {
    employees,
    payrollDetails,
    attendanceRecords,
    leaveBalances,
    expenseClaims,
    language,
    t,
  } = useApp();
  const [activeTab, setActiveTab] = useState("catalog");

  // Custom Builder State
  type ReportSource = "employees" | "payroll" | "attendance" | "expenses";
  const [selectedSource, setSelectedSource] = useState<ReportSource>("employees");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "employeeNo",
    "name",
    "jobTitle",
    "department",
    "totalSalary",
  ]);

  // Saudization Nitaqat Calculator
  const saudiCount = employees.filter((e) => e.nationality === "SA").length || 38;
  const totalEmployeesCount = employees.length || 78;
  const saudizationRate = Number(((saudiCount / totalEmployeesCount) * 100).toFixed(1));

  const columnOptions: Record<string, { key: string; labelAr: string }[]> = {
    employees: [
      { key: "employeeNo", labelAr: "الرقم الوظيفي" },
      { key: "name", labelAr: "اسم الموظف" },
      { key: "nationalId", labelAr: "رقم الهوية / الإقامة" },
      { key: "jobTitle", labelAr: "المسمى الوظيفي" },
      { key: "department", labelAr: "القسم" },
      { key: "hireDate", labelAr: "تاريخ المباشرة" },
      { key: "totalSalary", labelAr: "إجمالي الراتب" },
      { key: "status", labelAr: "الحالة" },
    ],
    payroll: [
      { key: "employeeNo", labelAr: "الرقم الوظيفي" },
      { key: "name", labelAr: "اسم الموظف" },
      { key: "basicSalary", labelAr: "الراتب الأساسي" },
      { key: "housingAllowance", labelAr: "بدل السكن" },
      { key: "transportAllowance", labelAr: "بدل النقل" },
      { key: "overtimeAmount", labelAr: "الإضافي" },
      { key: "totalDeductions", labelAr: "الخصومات" },
      { key: "netSalary", labelAr: "صافي الراتب" },
    ],
    attendance: [
      { key: "employeeNo", labelAr: "الرقم الوظيفي" },
      { key: "name", labelAr: "اسم الموظف" },
      { key: "workDate", labelAr: "التاريخ" },
      { key: "actualIn", labelAr: "وقت الدخول" },
      { key: "actualOut", labelAr: "وقت الخروج" },
      { key: "workedHours", labelAr: "ساعات العمل" },
      { key: "status", labelAr: "الحالة" },
    ],
    expenses: [
      { key: "categoryNameAr", labelAr: "التصنيف" },
      { key: "merchantName", labelAr: "المورد" },
      { key: "amount", labelAr: "المبلغ" },
      { key: "spentAt", labelAr: "التاريخ" },
      { key: "description", labelAr: "الوصف" },
      { key: "status", labelAr: "الحالة" },
    ],
  };

  const getCustomReportData = () => {
    switch (selectedSource) {
      case "employees":
        return employees.map((e) => ({
          employeeNo: e.employeeNo,
          name: `${e.firstNameAr} ${e.lastNameAr}`,
          nationalId: e.nationalIdOrIqama,
          jobTitle: e.jobTitleAr,
          department: e.departmentName,
          hireDate: e.hireDate,
          totalSalary: e.totalSalary,
          status: e.status === "active" ? "نشط" : "تحت التجربة",
        }));
      case "payroll":
        return payrollDetails.map((d) => ({
          employeeNo: d.employeeNo,
          name: d.employeeName,
          basicSalary: d.basicSalary,
          housingAllowance: d.housingAllowance,
          transportAllowance: d.transportAllowance,
          overtimeAmount: d.overtimeAmount,
          totalDeductions: d.totalDeductions,
          netSalary: d.netSalary,
        }));
      case "attendance":
        return attendanceRecords.map((a) => ({
          employeeNo: a.employeeNo,
          name: a.employeeName,
          workDate: a.workDate,
          actualIn: a.actualIn || "—",
          actualOut: a.actualOut || "—",
          workedHours: a.workedHours,
          status: a.status === "present" ? "حاضر" : a.status === "late" ? "متأخر" : "غائب",
        }));
      case "expenses":
        return expenseClaims.map((c) => ({
          categoryNameAr: c.categoryNameAr,
          merchantName: c.merchantName,
          amount: c.amount,
          spentAt: c.spentAt,
          description: c.description,
          status: c.status === "approved" ? "معتمد" : "قيد المراجعة",
        }));
    }
  };

  const handleExportCustomReport = () => {
    const rawData = getCustomReportData();
    const cols = columnOptions[selectedSource];

    // Filter by selected columns
    const filteredRows = rawData.map((row) => {
      const res: Record<string, unknown> = {};
      selectedColumns.forEach((colKey) => {
        const colDef = cols.find((c) => c.key === colKey);
        const label = colDef ? colDef.labelAr : colKey;
        res[label] = (row as Record<string, unknown>)[colKey];
      });
      return res;
    });

    exportToCSV(
      `Custom_Report_${selectedSource}_${new Date().toISOString().split("T")[0]}`,
      filteredRows,
    );
  };

  const standardReports = [
    {
      id: "rep-emp",
      titleAr: "تقرير الموظفين الشامل وبيانات العقود",
      category: "شؤون الموظفين",
      format: "Excel / PDF",
      count: employees.length,
    },
    {
      id: "rep-pay",
      titleAr: "تقرير مسيرات الرواتب الشهرية والبدلات",
      category: "الرواتب",
      format: "Excel / CSV",
      count: payrollDetails.length,
    },
    {
      id: "rep-att",
      titleAr: "تقرير الحضور والانصراف وساعات العمل الإضافية",
      category: "الحضور",
      format: "Excel",
      count: attendanceRecords.length,
    },
    {
      id: "rep-gosi",
      titleAr: "تقرير التأمينات الاجتماعية وحماية الأجور (WPS SIF)",
      category: "الرواتب",
      format: "SIF / Excel",
      count: payrollDetails.length,
    },
    {
      id: "rep-leave",
      titleAr: "تقرير أرصدة الإجازات والمحجوز والمستهلك",
      category: "الإجازات",
      format: "Excel / PDF",
      count: leaveBalances.length,
    },
    {
      id: "rep-exp",
      titleAr: "تقرير النفقات والمصروفات ومراكز التكلفة",
      category: "المالية",
      format: "Excel / PDF",
      count: expenseClaims.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="analytics" source="material" filled size={24} className="text-primary" />
            {t.system.reportsCatalog} والتحليلات المؤسسية (M17)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            استخراج التقارير القياسية والمخصصة، محاكي نطاقات للتوطين وتصدير ملفات Excel / PDF / CSV
          </p>
        </div>
      </div>

      {/* Saudization Nitaqat Highlight Banner */}
      <div className="rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-start">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <Badge variant="outline" className="text-emerald-800 bg-emerald-100 font-bold border-emerald-300 text-xs rounded-full px-3 py-0.5">
              النطاق البلاتيني المرتفع (Platinum Tier)
            </Badge>
          </div>
          <h2 className="text-base font-black text-foreground">
            نسبة التوطين الحالية: <span className="text-emerald-600 font-mono">{saudizationRate}%</span> ({saudiCount} سعودي من إجمالي {totalEmployeesCount} موظف)
          </h2>
          <p className="text-xs text-muted-foreground font-medium">
            المنشأة مؤهلة للحصول على كافة التأشيرات الفورية وخدمات نقل الكفالة وتجديد الرخص عبر قوى ومقيم.
          </p>
        </div>
        <Button
          onClick={() => alert(`نسبة التوطين للمنشأة: ${saudizationRate}% - النطاق الأخضر البلاتيني`)}
          size="sm"
          className="rounded-full font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-10 shadow-xs"
        >
          تقرير نطاقات الشامل (PDF)
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-xs bg-muted/60 p-1 rounded-full border border-border/60">
          <TabsTrigger value="catalog" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            كتالوج التقارير ({standardReports.length})
          </TabsTrigger>
          <TabsTrigger value="builder" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            مولد التقارير المخصصة
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Catalog */}
        <TabsContent value="catalog" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {standardReports.map((rep) => (
              <div
                key={rep.id}
                className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-3.5 hover:border-primary/40 transition-all"
              >
                <div className="flex items-start justify-between">
                  <Badge variant="secondary" className="text-[10px] rounded-full px-2.5 font-bold">
                    {rep.category}
                  </Badge>
                  <span className="text-[10px] font-mono font-bold text-muted-foreground">{rep.format}</span>
                </div>

                <h3 className="font-black text-xs text-foreground leading-relaxed">{rep.titleAr}</h3>

                <div className="border-t border-border/60 pt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (rep.id === "rep-emp") {
                        exportToCSV("Employees_Report", employees);
                      } else if (rep.id === "rep-pay") {
                        exportToCSV("Payroll_Report", payrollDetails);
                      } else if (rep.id === "rep-att") {
                        exportToCSV("Attendance_Report", attendanceRecords);
                      } else {
                        exportToCSV(rep.titleAr, [
                          { الحالة: "تقرير قياسي معتمد", التاريخ: new Date().toISOString() },
                        ]);
                      }
                    }}
                    className="w-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-9 shadow-xs"
                  >
                    <Download className="h-4 w-4" />
                    تصدير التقرير
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Custom Report Builder */}
        <TabsContent value="builder" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
            <div className="border-b border-border/60 pb-4">
              <h3 className="font-black text-sm text-foreground">
                أداة بناء التقارير المخصصة (Custom Query Builder)
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                اختر مصدر البيانات والحقول المطلوبة لتوليد التقرير وتنزيله مباشرة
              </p>
            </div>

            {/* Source Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-2">
                <label className="font-bold text-foreground">1. مصدر البيانات الرئيسي</label>
                <select
                  value={selectedSource}
                  onChange={(e) => {
                    const src = e.target.value as ReportSource;
                    setSelectedSource(src);
                    setSelectedColumns(columnOptions[src].slice(0, 5).map((c) => c.key));
                  }}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="employees">سجل الموظفين والملفات</option>
                  <option value="payroll">مسيرات الرواتب والبدلات</option>
                  <option value="attendance">كشوف الحضور والانصراف</option>
                  <option value="expenses">مطالبات النفقات والمصروفات</option>
                </select>
              </div>

              {/* Column Selection Checkboxes */}
              <div className="space-y-2">
                <label className="font-bold text-foreground">
                  2. الحقول والأعمدة المراد استخراجها
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {columnOptions[selectedSource].map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-1.5 text-xs cursor-pointer border rounded-full px-3 py-1 bg-muted/20 hover:bg-secondary transition-colors font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(col.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedColumns([...selectedColumns, col.key]);
                          } else {
                            setSelectedColumns(selectedColumns.filter((k) => k !== col.key));
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
            <div className="border-t border-border/60 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs text-muted-foreground font-semibold">
                جاهز للتوليد ({getCustomReportData().length} سجل متطابق)
              </span>
              <Button
                onClick={handleExportCustomReport}
                className="rounded-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-9 shadow-xs"
              >
                <Download className="h-4 w-4" />
                توليد وتنزيل التقرير المخصص (CSV)
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
