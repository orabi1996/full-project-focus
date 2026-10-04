import React, { useState, useMemo } from "react";
import { toast } from "sonner";
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
  Table as TableIcon,
  TrendingUp,
  Award,
  Search,
  Printer,
  ShieldAlert,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  BookmarkPlus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  FolderLock,
  Briefcase,
  Layers,
} from "lucide-react";
import { IconSymbol } from "../ui/IconSymbol";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { useAuth } from "../../lib/auth/AuthContext";
import { useBootstrapData } from "../../lib/domains/bootstrap/use-bootstrap";
import {
  REPORT_CATALOG,
  useExecutiveKpis,
  useReportData,
  useSavedReportFilters,
  useReportMutations,
  type ReportCatalogItem,
  type ReportCategory,
  type ReportFilterState,
  type ReportPaginationState,
  type ReportSortState,
  type SavedReportFilter,
} from "../../lib/data/reports-repository";
import {
  useReportingEngine,
  resolveDatePreset,
  exportReportDataToCsv,
  exportReportDataToArabicPdf,
} from "../../lib/domains/reports";

export const ReportsView: React.FC = () => {
  const { role, isDemo } = useAuth();
  const bootstrap = useBootstrapData();
  const { canAccessReport, saveFilterPreset, deleteFilterPreset } = useReportingEngine();
  const reportMutations = useReportMutations();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<"overview" | "catalog" | "viewer" | "builder">("overview");

  // Executive Date Preset State
  const [datePreset, setDatePreset] = useState<
    "today" | "last_7_days" | "current_month" | "prev_month" | "quarter" | "year" | "custom"
  >("current_month");

  const resolvedDates = useMemo(() => resolveDatePreset(datePreset), [datePreset]);

  // Executive KPIs Query
  const {
    data: kpis,
    isLoading: isKpisLoading,
    isError: isKpisError,
    refetch: refetchKpis,
  } = useExecutiveKpis({
    startDate: resolvedDates.startDate,
    endDate: resolvedDates.endDate,
  });

  // Catalog Filter State
  const [catalogCategory, setCatalogCategory] = useState<string>("all");
  const [catalogSearch, setCatalogSearch] = useState<string>("");

  // Report Viewer State
  const [selectedReportCode, setSelectedReportCode] = useState<string>("EMP_DIR");
  const [viewerFilters, setViewerFilters] = useState<ReportFilterState>({
    status: "all",
    startDate: resolvedDates.startDate,
    endDate: resolvedDates.endDate,
    search: "",
  });
  const [pagination, setPagination] = useState<ReportPaginationState>({ page: 1, pageSize: 25 });
  const [sort, setSort] = useState<ReportSortState>({ column: "created_at", direction: "desc" });

  // Save Filter Dialog State
  const [isSaveFilterOpen, setIsSaveFilterOpen] = useState(false);
  const [filterNameAr, setFilterNameAr] = useState("");
  const [isFilterShared, setIsFilterShared] = useState(false);

  // Selected Report Metadata
  const currentReport = useMemo(
    () => REPORT_CATALOG.find((r) => r.code === selectedReportCode) || REPORT_CATALOG[0],
    [selectedReportCode],
  );

  // Check if current user has permission for active report
  const isReportPermitted = canAccessReport(selectedReportCode);

  // Report Data Query
  const {
    data: reportResult,
    isLoading: isReportLoading,
    isError: isReportError,
    refetch: refetchReportData,
  } = useReportData(
    isReportPermitted ? selectedReportCode : "",
    viewerFilters,
    pagination,
    sort,
  );

  // Saved Filters Query
  const { data: savedFilters } = useSavedReportFilters(selectedReportCode);

  // Filtered Catalog Items based on category, search, and user role
  const filteredCatalog = useMemo(() => {
    return REPORT_CATALOG.filter((item) => {
      if (catalogCategory !== "all" && item.module !== catalogCategory) return false;
      if (
        catalogSearch &&
        !item.nameAr.toLowerCase().includes(catalogSearch.toLowerCase()) &&
        !item.nameEn.toLowerCase().includes(catalogSearch.toLowerCase()) &&
        !item.code.toLowerCase().includes(catalogSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [catalogCategory, catalogSearch]);

  // Departments for dropdowns
  const departments = bootstrap.orgUnits || [];

  // Drill down from KPI card directly to report
  const handleDrillDown = (reportCode: string, defaultFilter?: Partial<ReportFilterState>) => {
    setSelectedReportCode(reportCode);
    if (defaultFilter) {
      setViewerFilters((prev) => ({ ...prev, ...defaultFilter }));
    }
    setPagination({ page: 1, pageSize: 25 });
    setActiveTab("viewer");
  };

  // Switch to report from catalog
  const handleSelectReport = (reportCode: string) => {
    setSelectedReportCode(reportCode);
    setPagination({ page: 1, pageSize: 25 });
    setActiveTab("viewer");
  };

  // Apply saved filter
  const handleApplySavedFilter = (filter: SavedReportFilter) => {
    setViewerFilters(filter.filters);
    setPagination({ page: 1, pageSize: 25 });
    toast.success(`تم تطبيق الفلتر: ${filter.nameAr}`);
  };

  // Save current filter preset
  const handleConfirmSaveFilter = async () => {
    if (!filterNameAr.trim()) {
      toast.error("يرجى إدخال اسم الفلتر");
      return;
    }
    const success = await saveFilterPreset(
      selectedReportCode,
      filterNameAr,
      viewerFilters,
      undefined,
      sort.column,
      sort.direction,
      isFilterShared,
    );
    if (success) {
      setIsSaveFilterOpen(false);
      setFilterNameAr("");
    }
  };

  // Export handlers
  const handleExportCsv = () => {
    if (!reportResult?.data || reportResult.data.length === 0) {
      toast.error("لا توجد بيانات متاحة للتصدير");
      return;
    }
    exportReportDataToCsv(currentReport.nameAr, reportResult.data);
    reportMutations.logReportGeneration.mutate({
      reportCode: currentReport.code,
      filters: viewerFilters,
      rowCount: reportResult.data.length,
      exportFormat: "csv",
      sensitiveAccessed: currentReport.isSensitive,
    });
  };

  const handleExportPdf = () => {
    if (!reportResult?.data || reportResult.data.length === 0) {
      toast.error("لا توجد بيانات متاحة للطباعة");
      return;
    }
    const sample = reportResult.data[0] || {};
    const cols = Object.keys(sample)
      .filter((k) => k !== "id")
      .slice(0, 7)
      .map((k) => ({ key: k, label: k }));

    exportReportDataToArabicPdf(
      currentReport.nameAr,
      `منشأة: ${bootstrap.company?.legalNameAr || "منظومة مدار إكس MadarX"} | الفترة: ${viewerFilters.startDate || "الكل"} إلى ${viewerFilters.endDate || "الآن"}`,
      cols,
      reportResult.data,
      [
        { label: "إجمالي السجلات", value: String(reportResult.totalCount) },
        { label: "كود التقرير", value: currentReport.code },
        { label: "التصنيف", value: currentReport.categoryNameAr },
      ],
    );

    reportMutations.logReportGeneration.mutate({
      reportCode: currentReport.code,
      filters: viewerFilters,
      rowCount: reportResult.data.length,
      exportFormat: "pdf",
      sensitiveAccessed: currentReport.isSensitive,
    });
  };

  // Custom Builder State
  type BuilderSource = "employees" | "attendance" | "payroll" | "expenses" | "assets";
  const [builderSource, setBuilderSource] = useState<BuilderSource>("employees");
  const [builderColumns, setBuilderColumns] = useState<string[]>([
    "employee_no",
    "full_name_ar",
    "job_title_ar",
    "department_name_ar",
  ]);

  const builderColumnConfigs: Record<BuilderSource, { key: string; labelAr: string }[]> = {
    employees: [
      { key: "employee_no", labelAr: "الرقم الوظيفي" },
      { key: "full_name_ar", labelAr: "اسم الموظف" },
      { key: "department_name_ar", labelAr: "الإدارة" },
      { key: "job_title_ar", labelAr: "المسمى الوظيفي" },
      { key: "nationality", labelAr: "الجنسية" },
      { key: "contract_type", labelAr: "نوع العقد" },
      { key: "hire_date", labelAr: "تاريخ المباشرة" },
      { key: "status", labelAr: "الحالة" },
    ],
    attendance: [
      { key: "employee_no", labelAr: "الرقم الوظيفي" },
      { key: "employee_name_ar", labelAr: "اسم الموظف" },
      { key: "work_date", labelAr: "تاريخ العمل" },
      { key: "check_in", labelAr: "وقت الدخول" },
      { key: "check_out", labelAr: "وقت الخروج" },
      { key: "worked_hours", labelAr: "ساعات العمل" },
      { key: "status", labelAr: "الحالة" },
    ],
    payroll: [
      { key: "employee_no", labelAr: "الرقم الوظيفي" },
      { key: "employee_name_ar", labelAr: "اسم الموظف" },
      { key: "department_name_ar", labelAr: "الإدارة" },
      { key: "basic_salary", labelAr: "الراتب الأساسي" },
      { key: "housing_allowance", labelAr: "بدل السكن" },
      { key: "transport_allowance", labelAr: "بدل النقل" },
      { key: "total_deductions", labelAr: "الخصومات" },
      { key: "net_salary", labelAr: "صافي الراتب" },
    ],
    expenses: [
      { key: "claim_number", labelAr: "رقم المطالبة" },
      { key: "employee_name_ar", labelAr: "اسم الموظف" },
      { key: "category_name_ar", labelAr: "التصنيف" },
      { key: "merchant_name", labelAr: "المورد" },
      { key: "amount", labelAr: "المبلغ" },
      { key: "spent_at", labelAr: "التاريخ" },
      { key: "status", labelAr: "الحالة" },
    ],
    assets: [
      { key: "asset_tag", labelAr: "رمز الأصل" },
      { key: "name_ar", labelAr: "اسم الأصل" },
      { key: "category", labelAr: "الفئة" },
      { key: "assigned_employee_name_ar", labelAr: "المستلم" },
      { key: "location", labelAr: "الموقع" },
      { key: "status", labelAr: "الحالة" },
    ],
  };

  const getSourceReportCode = (src: BuilderSource): string => {
    switch (src) {
      case "employees":
        return "EMP_DIR";
      case "attendance":
        return "ATT_SUMMARY";
      case "payroll":
        return "PAY_REGISTER";
      case "expenses":
        return "EXP_CLAIMS";
      case "assets":
        return "AST_INVENTORY";
    }
  };

  const { data: builderData } = useReportData(
    getSourceReportCode(builderSource),
    { status: "all" },
    { page: 1, pageSize: 50 },
    { column: "created_at", direction: "desc" },
  );

  const handleExportBuilderReport = () => {
    if (!builderData?.data || builderData.data.length === 0) {
      toast.error("لا توجد بيانات متاحة للتصدير");
      return;
    }

    const availableCols = builderColumnConfigs[builderSource];
    const filteredRows = builderData.data.map((row) => {
      const res: Record<string, unknown> = {};
      builderColumns.forEach((colKey) => {
        const colDef = availableCols.find((c) => c.key === colKey);
        const label = colDef ? colDef.labelAr : colKey;
        res[label] = row[colKey] !== null && row[colKey] !== undefined ? row[colKey] : "—";
      });
      return res;
    });

    exportReportDataToCsv(`Custom_Report_${builderSource}`, filteredRows);
  };

  // Nitaqat band styling
  const getNitaqatBadge = (band: string) => {
    switch (band) {
      case "platinum":
        return { label: "النطاق البلاتيني المرتفع (Platinum)", color: "text-emerald-800 bg-emerald-100 border-emerald-300" };
      case "high_green":
        return { label: "النطاق الأخضر المرتفع (High Green)", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
      case "mid_green":
        return { label: "النطاق الأخضر المتوسط (Mid Green)", color: "text-teal-700 bg-teal-50 border-teal-200" };
      case "low_green":
        return { label: "النطاق الأخضر المنخفض (Low Green)", color: "text-amber-800 bg-amber-100 border-amber-300" };
      case "red":
      default:
        return { label: "النطاق الأحمر الحرج (Red Tier)", color: "text-red-800 bg-red-100 border-red-300" };
    }
  };

  const nitaqatInfo = getNitaqatBadge(kpis?.nitaqatBand || "platinum");

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="classera-page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <IconSymbol name="analytics" source="material" filled size={16} />
              منصة التقارير والتحليلات المؤسسية
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30">
              v22 Enterprise Engine
            </Badge>
          </div>
          <h1 className="text-2xl font-black text-foreground mt-2">
            مركز التقارير، التحليلات ومؤشرات الأداء (BI & Analytics)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            بيانات موثوقة من قاعدة البيانات المركزية، تصدير CSV / Excel / PDF معزز بحماية الحقول الحساسة وعزل المستأجرين.
          </p>
        </div>

        {/* Global Date Preset Picker */}
        <div className="flex items-center gap-2 bg-card p-1.5 rounded-2xl border shadow-xs">
          <CalendarDays className="h-4 w-4 text-muted-foreground mr-1" />
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as any)}
            className="text-xs font-bold bg-transparent border-none focus:outline-none cursor-pointer pr-1"
          >
            <option value="today">اليوم</option>
            <option value="last_7_days">آخر 7 أيام</option>
            <option value="current_month">الشهر الحالي</option>
            <option value="prev_month">الشهر السابق</option>
            <option value="quarter">الربع المالي الحالي</option>
            <option value="year">السنة الحالية</option>
            <option value="custom">نطاق مخصص (30 يوماً)</option>
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetchKpis()}
            className="h-8 w-8 p-0 rounded-xl"
            title="تحديث المؤشرات"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Saudization Nitaqat Highlight Banner */}
      <div className="rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1.5 text-center sm:text-start">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <Badge variant="outline" className={`font-bold text-xs rounded-full px-3 py-0.5 ${nitaqatInfo.color}`}>
              {nitaqatInfo.label}
            </Badge>
            <span className="text-[11px] font-bold text-muted-foreground">
              حساب لحظي معتمد
            </span>
          </div>
          <h2 className="text-base font-black text-foreground">
            نسبة التوطين الرسمية:{" "}
            <span className="text-emerald-600 font-mono font-tabular-nums text-lg">
              {kpis?.saudizationRate != null ? `${kpis.saudizationRate}%` : "—"}
            </span>{" "}
            ({kpis?.saudiCount || 0} مواطن سعودي من إجمالي {kpis?.totalHeadcount || 0} موظف بالمنشأة)
          </h2>
          <p className="text-xs text-muted-foreground font-medium">
            تتوافق المنشأة مع معايير وزارة الموارد البشرية وبرنامج نطاقات للخدمات الفورية عبر منصتي قوى ومقيم.
          </p>
        </div>
        <Button
          onClick={() => handleDrillDown("EMP_HEADCOUNT")}
          size="sm"
          className="rounded-full font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-10 shadow-xs gap-1.5"
        >
          <Award className="h-4 w-4" />
          تقرير نطاقات والتوطين الشامل
        </Button>
      </div>

      {/* Primary Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
        <TabsList className="classera-tabs-strip w-full max-w-2xl grid grid-cols-4 p-1 bg-muted/30 rounded-2xl">
          <TabsTrigger
            value="overview"
            className="rounded-xl text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            نظرة عامة والتحليلات
          </TabsTrigger>
          <TabsTrigger
            value="catalog"
            className="rounded-xl text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            كتالوج التقارير ({REPORT_CATALOG.length})
          </TabsTrigger>
          <TabsTrigger
            value="viewer"
            className="rounded-xl text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            استعراض وتصدير التقرير
          </TabsTrigger>
          <TabsTrigger
            value="builder"
            className="rounded-xl text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            مولد التقارير المخصصة
          </TabsTrigger>
        </TabsList>

        {/* =================================================================== */}
        {/* TAB 1: EXECUTIVE ANALYTICS & OVERVIEW                               */}
        {/* =================================================================== */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          {/* Executive KPI Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div
              onClick={() => handleDrillDown("EMP_DIR")}
              className="classera-kpi-card p-4 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all"
            >
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">إجمالي القوى العاملة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
                  {kpis?.totalHeadcount ?? "—"}
                </h4>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {kpis?.activeEmployees ?? 0} على رأس العمل
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div
              onClick={() => handleDrillDown("EMP_JOINERS")}
              className="classera-kpi-card p-4 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all"
            >
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">التعيينات الجديدة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
                  {kpis?.newHires ?? "—"}
                </h4>
                <span className="text-[10px] text-muted-foreground font-bold">
                  خلال الفترة المحددة
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Plus className="h-5 w-5" />
              </div>
            </div>

            <div
              onClick={() => handleDrillDown("ATT_SUMMARY")}
              className="classera-kpi-card p-4 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all"
            >
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">معدل الانضباط والحضور</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
                  {kpis?.attendanceRate != null ? `${kpis.attendanceRate}%` : "—"}
                </h4>
                <span className="text-[10px] text-amber-600 font-bold">
                  {kpis?.latenessCount ?? 0} حالة تأخير
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>

            <div
              onClick={() => handleDrillDown("PAY_REGISTER")}
              className="classera-kpi-card p-4 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all"
            >
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">تكلفة الرواتب الشهرية</span>
                <h4 className="text-lg font-black text-foreground mt-0.5 font-tabular-nums font-mono">
                  {kpis?.payrollCost != null ? Number(kpis.payrollCost).toLocaleString("ar-SA") : "—"}
                </h4>
                <span className="text-[10px] text-muted-foreground font-bold">ريال سعودي</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Wallet className="h-5 w-5" />
              </div>
            </div>

            <div
              onClick={() => handleDrillDown("REC_REQUISITIONS")}
              className="classera-kpi-card p-4 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all"
            >
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">الشواغر الوظيفية</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
                  {kpis?.openVacancies ?? "—"}
                </h4>
                <span className="text-[10px] text-primary font-bold">
                  {kpis?.recruitmentCandidates ?? 0} مرشح نشط
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                <Briefcase className="h-5 w-5" />
              </div>
            </div>

            <div
              onClick={() => handleDrillDown("WKF_PENDING")}
              className="classera-kpi-card p-4 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all"
            >
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">الطلبات المعلقة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
                  {kpis?.pendingApprovals ?? "—"}
                </h4>
                <span className="text-[10px] text-rose-600 font-bold">بانتظار الاعتماد</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Quick Canonical Reports Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-3xl border bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-sm text-foreground">التقارير القياسية الأكثر طلباً</h3>
                  <p className="text-xs text-muted-foreground">وصول فوري للتقارير التنفيذية الأكثر استخداماً</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab("catalog")}
                  className="rounded-full text-xs font-bold"
                >
                  استعراض كامل الكتالوج
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { code: "EMP_DIR", title: "دليل الموظفين الموحد", desc: "كشف شامل ببيانات القوى العاملة", icon: Users },
                  { code: "ATT_SUMMARY", title: "ملخص الحضور الشهري", desc: "ساعات العمل والتأخير والانضباط", icon: Clock },
                  { code: "PAY_REGISTER", title: "مسير الرواتب المعتمد", desc: "البدلات، الاستقطاعات وصافي التحويل", icon: Wallet },
                  { code: "LEV_BALANCES", title: "أرصدة الإجازات السنوية", desc: "المستحق والمستهلك والمتبقي", icon: CalendarDays },
                  { code: "EXP_CLAIMS", title: "مطالبات المصروفات والعهد", desc: "فواتير ومصروفات الموظفين المعتمدة", icon: Receipt },
                  { code: "WKF_PENDING", title: "المعاملات المعلقة للاعتماد", desc: "طلبات بانتظار موافقة المسؤولين", icon: Layers },
                ].map((rep) => {
                  const Icon = rep.icon;
                  return (
                    <div
                      key={rep.code}
                      onClick={() => handleSelectReport(rep.code)}
                      className="p-3.5 rounded-2xl border border-border/80 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-muted/40 group-hover:bg-primary/10 flex items-center justify-center text-primary transition-colors">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            {rep.title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground">{rep.desc}</p>
                        </div>
                      </div>
                      <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:translate-x-[-2px] transition-transform" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Department Distribution Summary Card */}
            <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
              <h3 className="font-black text-sm text-foreground">توزيع القوى العاملة والامتثال</h3>
              <p className="text-xs text-muted-foreground">المؤشرات الهيكلية المعتمدة</p>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>نسبة التوطين للمنشأة</span>
                    <span className="font-mono text-emerald-600">{kpis?.saudizationRate || 0}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, kpis?.saudizationRate || 0)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>نسبة الالتزام بالحضور</span>
                    <span className="font-mono text-primary">{kpis?.attendanceRate || 100}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, kpis?.attendanceRate || 100)}%` }}
                    />
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">إجمالي الموظفين السعوديين:</span>
                    <span className="font-bold font-mono">{kpis?.saudiCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">إجمالي الموظفين المقيمين:</span>
                    <span className="font-bold font-mono">{kpis?.expatCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">حالات الغياب المسجلة:</span>
                    <span className="font-bold font-mono text-rose-600">{kpis?.absenceCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">ساعات العمل الإضافي:</span>
                    <span className="font-bold font-mono text-amber-600">{kpis?.overtimeHours || 0} س</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 2: CANONICAL REPORT CATALOG                                     */}
        {/* =================================================================== */}
        <TabsContent value="catalog" className="space-y-5 pt-4">
          {/* Catalog Filter Bar */}
          <div className="rounded-3xl border bg-card p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {[
                { id: "all", label: "كافة الأقسام" },
                { id: "employees", label: "الموظفين" },
                { id: "attendance", label: "الحضور والانصراف" },
                { id: "leaves", label: "الإجازات" },
                { id: "payroll", label: "الرواتب والبدلات" },
                { id: "performance", label: "الأداء" },
                { id: "recruitment", label: "التوظيف" },
                { id: "workforce", label: "تخطيط القوى" },
                { id: "expenses", label: "النفقات" },
                { id: "assets", label: "الأصول" },
                { id: "documents", label: "الوثائق" },
                { id: "workflow", label: "إجراءات العمل" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCatalogCategory(cat.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                    catalogCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/40 hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="h-4 w-4 absolute right-3 top-3 text-muted-foreground" />
              <Input
                placeholder="بحث في التقارير (اسم أو رمز)..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="pr-9 rounded-2xl h-10 text-xs"
              />
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((rep) => {
              const hasAccess = canAccessReport(rep.code);
              return (
                <div
                  key={rep.code}
                  className={`rounded-3xl border bg-card p-5 shadow-xs space-y-3.5 transition-all flex flex-col justify-between ${
                    hasAccess ? "hover:border-primary/50" : "opacity-75 bg-muted/10"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px] font-bold rounded-full px-2.5">
                          {rep.categoryNameAr}
                        </Badge>
                        {rep.isSensitive && (
                          <Badge variant="destructive" className="text-[9px] font-bold rounded-full gap-1">
                            <FolderLock className="h-3 w-3" />
                            بيانات مالية حساسة
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">
                        {rep.code}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-black text-sm text-foreground leading-snug">{rep.nameAr}</h3>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{rep.nameEn}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-2 leading-relaxed">
                        {rep.descriptionAr}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                      {rep.exportFormats.map((fmt) => (
                        <span key={fmt} className="px-1.5 py-0.5 rounded bg-muted/60 font-semibold">
                          {fmt.toUpperCase()}
                        </span>
                      ))}
                    </div>

                    {hasAccess ? (
                      <Button
                        size="sm"
                        onClick={() => handleSelectReport(rep.code)}
                        className="rounded-full text-xs font-bold gap-1 bg-primary text-primary-foreground h-8 px-4 shadow-xs"
                      >
                        <Play className="h-3.5 w-3.5" />
                        استعراض وتوليد
                      </Button>
                    ) : (
                      <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        يتطلب صلاحية
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 3: REPORT DATA VIEWER (PAGINATION, FILTERS, REAL DATA, EXPORTS) */}
        {/* =================================================================== */}
        <TabsContent value="viewer" className="space-y-4 pt-4">
          {/* Active Report Header Bar */}
          <div className="rounded-3xl border bg-card p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs font-bold">
                  {currentReport.code}
                </Badge>
                <Badge variant="secondary" className="text-xs font-bold">
                  {currentReport.categoryNameAr}
                </Badge>
                {currentReport.isSensitive && (
                  <Badge variant="destructive" className="text-[10px] font-bold gap-1">
                    <FolderLock className="h-3 w-3" />
                    حماية مالية
                  </Badge>
                )}
              </div>
              <h2 className="text-lg font-black text-foreground mt-1.5">{currentReport.nameAr}</h2>
              <p className="text-xs text-muted-foreground">{currentReport.descriptionAr}</p>
            </div>

            {/* Quick Export & Actions Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaveFilterOpen(true)}
                className="rounded-full text-xs font-bold gap-1.5 h-9"
              >
                <BookmarkPlus className="h-4 w-4" />
                حفظ الفلتر
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="rounded-full text-xs font-bold gap-1.5 h-9"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                تصدير CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                className="rounded-full text-xs font-bold gap-1.5 h-9"
              >
                <Printer className="h-4 w-4 text-blue-600" />
                طباعة / PDF
              </Button>

              <Button
                size="sm"
                onClick={() => refetchReportData()}
                className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground h-9"
              >
                <RefreshCw className="h-4 w-4" />
                تحديث
              </Button>
            </div>
          </div>

          {/* Saved Filters Selector & Filter Controls Bar */}
          <div className="rounded-3xl border bg-card p-5 shadow-xs space-y-4">
            {savedFilters && (savedFilters as SavedReportFilter[]).length > 0 && (
              <div className="flex items-center gap-2 pb-3 border-b overflow-x-auto">
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                  الفلاتر المحفوظة:
                </span>
                {(savedFilters as SavedReportFilter[]).map((flt: SavedReportFilter) => (
                  <div
                    key={flt.id}
                    className="inline-flex items-center gap-1.5 bg-muted/40 hover:bg-muted text-xs font-semibold px-3 py-1 rounded-full border cursor-pointer"
                  >
                    <span onClick={() => handleApplySavedFilter(flt)}>{flt.nameAr}</span>
                    <button
                      onClick={() => deleteFilterPreset(flt.id, selectedReportCode)}
                      className="text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-foreground">الإدارة / القسم</label>
                <select
                  value={viewerFilters.departmentId || "all"}
                  onChange={(e) => {
                    setViewerFilters((prev) => ({ ...prev, departmentId: e.target.value }));
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="w-full h-9 rounded-xl border bg-background px-3 text-xs font-semibold focus:outline-none"
                >
                  <option value="all">كافة الإدارات</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">الحالة</label>
                <select
                  value={viewerFilters.status || "all"}
                  onChange={(e) => {
                    setViewerFilters((prev) => ({ ...prev, status: e.target.value }));
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="w-full h-9 rounded-xl border bg-background px-3 text-xs font-semibold focus:outline-none"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="active">نشط / معتمد</option>
                  <option value="probation">تحت التجربة</option>
                  <option value="terminated">منتهي الخدمة</option>
                  <option value="pending">معلق / قيد المراجعة</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">البحث النصي</label>
                <Input
                  placeholder="بحث بالاسم أو الرقم..."
                  value={viewerFilters.search || ""}
                  onChange={(e) => {
                    setViewerFilters((prev) => ({ ...prev, search: e.target.value }));
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">عدد السجلات بالصفحة</label>
                <select
                  value={pagination.pageSize}
                  onChange={(e) =>
                    setPagination({ page: 1, pageSize: Number(e.target.value) })
                  }
                  className="w-full h-9 rounded-xl border bg-background px-3 text-xs font-semibold focus:outline-none"
                >
                  <option value="10">10 سجلات</option>
                  <option value="25">25 سجل</option>
                  <option value="50">50 سجل</option>
                  <option value="100">100 سجل</option>
                </select>
              </div>
            </div>
          </div>

          {/* Data Table Container */}
          <div className="rounded-3xl border bg-card shadow-xs overflow-hidden">
            {!isReportPermitted ? (
              <div className="p-12 text-center space-y-3">
                <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto" />
                <h3 className="font-black text-base text-foreground">الصلاحية غير متوفرة</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  حسابك الحالي بالدور ({role}) لا يمتلك إذن الوصول لهذا التقرير وفقاً لمصفوفة الصلاحيات والحوكمة RBAC.
                </p>
              </div>
            ) : isReportLoading ? (
              <div className="p-12 text-center space-y-3">
                <RefreshCw className="h-8 w-8 text-primary animate-spin mx-auto" />
                <p className="text-xs text-muted-foreground font-semibold">
                  جاري جلب بيانات التقرير من الخادم المعتمد...
                </p>
              </div>
            ) : isReportError ? (
              <div className="p-12 text-center space-y-3">
                <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
                <h3 className="font-black text-sm text-foreground">خطأ أثناء استعلام التقرير</h3>
                <p className="text-xs text-muted-foreground">تعذر استرجاع البيانات من قاعدة البيانات.</p>
                <Button size="sm" onClick={() => refetchReportData()} className="rounded-full text-xs">
                  إعادة المحاولة
                </Button>
              </div>
            ) : !reportResult?.data || reportResult.data.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <TableIcon className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
                <h3 className="font-black text-sm text-foreground">لا توجد سجلات مطابقة</h3>
                <p className="text-xs text-muted-foreground">
                  لم يتم العثور على بيانات توافق شروط الفلترة المحددة.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-muted/40 border-b border-border/80">
                      <tr>
                        {Object.keys(reportResult.data[0] || {})
                          .filter((k) => k !== "id")
                          .map((colKey) => (
                            <th key={colKey} className="py-3 px-4 font-bold text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1 cursor-pointer">
                                <span>{colKey}</span>
                              </div>
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {reportResult.data.map((row, idx) => (
                        <tr key={(row.id as string) || idx} className="hover:bg-muted/20 transition-colors">
                          {Object.entries(row)
                            .filter(([k]) => k !== "id")
                            .map(([k, val]) => (
                              <td key={k} className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                                {val === null || val === undefined ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : typeof val === "boolean" ? (
                                  val ? (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">
                                      نعم
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-slate-50 text-slate-700 text-[10px]">
                                      لا
                                    </Badge>
                                  )
                                ) : (
                                  String(val)
                                )}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground font-semibold">
                    عرض {reportResult.data.length} من أصل {reportResult.totalCount} سجل معتمد (الصفحة {reportResult.page} من {reportResult.totalPages || 1})
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pagination.page <= 1}
                      onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                      className="rounded-xl h-8 px-3 text-xs font-bold"
                    >
                      <ChevronRight className="h-4 w-4 mr-1" />
                      السابق
                    </Button>
                    <span className="px-3 py-1 font-mono font-bold bg-muted/30 rounded-xl">
                      {pagination.page}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pagination.page >= (reportResult.totalPages || 1)}
                      onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                      className="rounded-xl h-8 px-3 text-xs font-bold"
                    >
                      التالي
                      <ChevronLeft className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 4: CUSTOM REPORT BUILDER                                        */}
        {/* =================================================================== */}
        <TabsContent value="builder" className="space-y-4 pt-4">
          <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
            <div className="border-b pb-4">
              <h3 className="font-black text-sm text-foreground">
                أداة بناء التقارير المخصصة (Custom Query & Export Builder)
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                اختر مصدر البيانات والحقول المطلوبة لتوليد التقرير وتنزيله فورياً بصيغة CSV المتوافقة مع Excel
              </p>
            </div>

            {/* Source & Column Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-2">
                <label className="font-bold text-foreground">1. مصدر البيانات الرئيسي</label>
                <select
                  value={builderSource}
                  onChange={(e) => {
                    const src = e.target.value as BuilderSource;
                    setBuilderSource(src);
                    setBuilderColumns(builderColumnConfigs[src].slice(0, 4).map((c) => c.key));
                  }}
                  className="w-full h-10 rounded-2xl border bg-background px-3 text-xs font-semibold focus:outline-none"
                >
                  <option value="employees">سجل الموظفين والملفات الوظيفية</option>
                  <option value="attendance">كشوف الحضور والانصراف</option>
                  <option value="payroll">مسيرات الرواتب والبدلات</option>
                  <option value="expenses">مطالبات النفقات والمصروفات</option>
                  <option value="assets">جرد الأصول والعهد العينية</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-foreground">2. الحقول والأعمدة المراد تضمينها</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {builderColumnConfigs[builderSource].map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-1.5 text-xs cursor-pointer border rounded-full px-3 py-1 bg-muted/20 hover:bg-secondary transition-colors font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={builderColumns.includes(col.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBuilderColumns([...builderColumns, col.key]);
                          } else {
                            setBuilderColumns(builderColumns.filter((k) => k !== col.key));
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
            <div className="border-t pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs text-muted-foreground font-semibold">
                جاهز للتوليد ({builderData?.data?.length || 0} سجل متوفر للمعاينة)
              </span>
              <Button
                onClick={handleExportBuilderReport}
                className="rounded-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-9 shadow-xs"
              >
                <Download className="h-4 w-4" />
                توليد وتنزيل التقرير المخصص (CSV)
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Filter Dialog Modal */}
      <Dialog open={isSaveFilterOpen} onOpenChange={setIsSaveFilterOpen}>
        <DialogContent className="max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">حفظ إعدادات الفلترة الحالية</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">اسم الفلتر المحفوظ</label>
              <Input
                placeholder="مثال: موظفو تقنية المعلومات النشطون..."
                value={filterNameAr}
                onChange={(e) => setFilterNameAr(e.target.value)}
                className="rounded-xl text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="shareFilterCheck"
                checked={isFilterShared}
                onChange={(e) => setIsFilterShared(e.target.checked)}
                className="rounded text-primary h-4 w-4"
              />
              <label htmlFor="shareFilterCheck" className="font-bold text-foreground cursor-pointer">
                مشاركة هذا الفلتر مع بقية مسؤولي المنشأة
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSaveFilterOpen(false)}
              className="rounded-full text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSaveFilter}
              className="rounded-full text-xs font-bold bg-primary text-primary-foreground"
            >
              تأكيد وحفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
