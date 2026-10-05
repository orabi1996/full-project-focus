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
  Star,
  Eye,
  BookOpen,
  Sparkles,
  AlertTriangle,
  Building2,
  Laptop,
  FileText,
  Percent,
  CheckCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
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
  METRIC_CATALOG,
  REPORT_SEMANTIC_DOMAINS,
  useExecutiveKpis,
  useReportData,
  useSavedReportFilters,
  useReportFavorites,
  useRecentReports,
  useMetricCatalog,
  useReportMutations,
  type ReportCatalogItem,
  type MetricCatalogItem,
  type ReportCategory,
  type ReportFilterState,
  type ReportPaginationState,
  type ReportSortState,
  type SavedReportFilter,
  type SemanticDomain,
} from "../../lib/data/reports-repository";
import {
  useReportingEngine,
  resolveDatePreset,
  exportReportDataToCsv,
  exportReportDataToExcel,
  exportReportDataToArabicPdf,
} from "../../lib/domains/reports";

export const ReportsView: React.FC = () => {
  const { role, isDemo, user } = useAuth();
  const bootstrap = useBootstrapData();
  const { canAccessReport, canAccessField, saveFilterPreset, deleteFilterPreset, toggleFavoriteReport, logRecent } =
    useReportingEngine();
  const reportMutations = useReportMutations();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<"overview" | "catalog" | "viewer" | "builder" | "metrics">("overview");

  // Executive Date Preset State
  const [datePreset, setDatePreset] = useState<
    | "today"
    | "yesterday"
    | "last_7_days"
    | "last_30_days"
    | "current_month"
    | "prev_month"
    | "quarter"
    | "prev_quarter"
    | "year"
    | "prev_year"
    | "custom"
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

  // Favorites & Recents Queries
  const { data: userFavorites = [] } = useReportFavorites();
  const { data: recentReports = [] } = useRecentReports();

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

  // Departments list from bootstrap orgUnits
  const departments = bootstrap.orgUnits || [];

  // --------------------------------------------------------------------------
  // INTERACTIVE DRILL-DOWN HANDLER
  // --------------------------------------------------------------------------
  const handleDrillDown = (targetReportCode: string, presetFilters?: Partial<ReportFilterState>) => {
    setSelectedReportCode(targetReportCode);
    setViewerFilters((prev) => ({
      ...prev,
      ...presetFilters,
      startDate: resolvedDates.startDate,
      endDate: resolvedDates.endDate,
    }));
    setPagination({ page: 1, pageSize: 25 });
    logRecent(targetReportCode);
    setActiveTab("viewer");
  };

  // --------------------------------------------------------------------------
  // EXPORT HANDLERS
  // --------------------------------------------------------------------------
  const handleExportCsv = () => {
    if (!reportResult?.data || reportResult.data.length === 0) {
      toast.error("لا توجد سجلات لتصديرها");
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

  const handleExportExcel = () => {
    if (!reportResult?.data || reportResult.data.length === 0) {
      toast.error("لا توجد سجلات لتصديرها");
      return;
    }
    exportReportDataToExcel(currentReport.nameAr, reportResult.data, undefined, {
      companyName: bootstrap.company?.legalNameAr || "منظومة مدار إكس MadarX",
      userName: user?.email || "مسؤول النظام",
      period: `${resolvedDates.startDate} إلى ${resolvedDates.endDate}`,
      filtersSummary: `الحالة: ${viewerFilters.status || "الكل"} | البحث: ${viewerFilters.search || "لا يوجد"}`,
    });
    reportMutations.logReportGeneration.mutate({
      reportCode: currentReport.code,
      filters: viewerFilters,
      rowCount: reportResult.data.length,
      exportFormat: "excel",
      sensitiveAccessed: currentReport.isSensitive,
    });
  };

  const handleExportPdf = () => {
    if (!reportResult?.data || reportResult.data.length === 0) {
      toast.error("لا توجد سجلات لطباعتها");
      return;
    }
    const cols = Object.keys(reportResult.data[0] || {})
      .filter((k) => k !== "id")
      .map((k) => ({ key: k, label: k }));

    exportReportDataToArabicPdf(
      currentReport.nameAr,
      `${currentReport.categoryNameAr} | الفترة من ${resolvedDates.startDate} إلى ${resolvedDates.endDate}`,
      cols,
      reportResult.data,
      [
        { label: "إجمالي السجلات", value: String(reportResult.totalCount) },
        { label: "كود التقرير", value: currentReport.code },
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

  // --------------------------------------------------------------------------
  // SAVED FILTER HANDLERS
  // --------------------------------------------------------------------------
  const handleConfirmSaveFilter = async () => {
    if (!filterNameAr.trim()) {
      toast.error("يرجى إدخال اسم للفلتر");
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

  const handleApplySavedFilter = (flt: SavedReportFilter) => {
    setViewerFilters(flt.filters);
    if (flt.sortBy) {
      setSort({ column: flt.sortBy, direction: flt.sortOrder || "desc" });
    }
    setPagination({ page: 1, pageSize: 25 });
    toast.info(`تم تطبيق الفلتر: ${flt.nameAr}`);
  };

  // --------------------------------------------------------------------------
  // AD-HOC BUILDER STATE & CONFIG
  // --------------------------------------------------------------------------
  const [builderDomainKey, setBuilderDomainKey] = useState<ReportCategory>("employees");
  const currentDomainConfig = useMemo(
    () => REPORT_SEMANTIC_DOMAINS.find((d) => d.key === builderDomainKey) || REPORT_SEMANTIC_DOMAINS[0],
    [builderDomainKey],
  );

  // Allowable fields for builder filtered by user role
  const allowableFields = useMemo(() => {
    return currentDomainConfig.fields.filter((f) => canAccessField(f.isSensitive));
  }, [currentDomainConfig, canAccessField]);

  const [builderSelectedFields, setBuilderSelectedFields] = useState<string[]>([
    "employee_no",
    "full_name_ar",
    "department_name_ar",
    "status",
  ]);

  const builderReportCode = useMemo(() => {
    switch (builderDomainKey) {
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
      default:
        return "EMP_DIR";
    }
  }, [builderDomainKey]);

  const { data: builderData } = useReportData(
    canAccessReport(builderReportCode) ? builderReportCode : "",
    { status: "all" },
    { page: 1, pageSize: 20 },
    { column: "created_at", direction: "desc" },
  );

  const handleExportBuilderReport = () => {
    if (!builderData?.data || builderData.data.length === 0) {
      toast.error("لا توجد بيانات متاحة للتصدير");
      return;
    }
    const filteredRows = builderData.data.map((row) => {
      const filtered: Record<string, unknown> = {};
      for (const fKey of builderSelectedFields) {
        if (row[fKey] !== undefined) {
          filtered[fKey] = row[fKey];
        }
      }
      return filtered;
    });

    const labels: Record<string, string> = {};
    for (const f of allowableFields) {
      labels[f.key] = f.labelAr;
    }

    exportReportDataToCsv(`تقرير_مخصص_${builderDomainKey}`, filteredRows, labels);
  };

  // Trend Charts Mock Data Grounded in Real Kpis
  const headcountTrendData = useMemo(() => {
    const total = kpis?.totalHeadcount || 10;
    const saudi = kpis?.saudiCount || 4;
    const expat = kpis?.expatCount || 6;
    return [
      { month: "يناير", saudi: Math.max(1, saudi - 2), expat: Math.max(1, expat - 1) },
      { month: "فبراير", saudi: Math.max(1, saudi - 1), expat: expat },
      { month: "مارس", saudi, expat },
    ];
  }, [kpis]);

  const attendanceTrendData = useMemo(() => {
    const attRate = kpis?.attendanceRate || 98;
    return [
      { day: "الأحد", rate: Math.min(100, attRate - 1) },
      { day: "الإثنين", rate: Math.min(100, attRate) },
      { day: "الثلاثاء", rate: Math.min(100, attRate + 0.5) },
      { day: "الأربعاء", rate: Math.min(100, attRate - 0.5) },
      { day: "الخميس", rate: attRate },
    ];
  }, [kpis]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in" dir="rtl">
      {/* ===================================================================== */}
      {/* 1. TOP HEADER & WORKSPACE HERO                                        */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold px-2.5 py-0.5">
              منظومة تحليلات مدار إكس
            </Badge>
            <span className="text-xs text-muted-foreground font-semibold">MadarX People Analytics 2026</span>
          </div>
          <h1 className="text-2xl font-black text-foreground mt-1 tracking-tight">
            التقارير الموحدة والتحليلات المؤسسية
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            محرك موحد للتقارير التنفيذية والتشغيلية، كتالوج المؤشرات المعتمد، وبناء الاستعلامات المخصصة
          </p>
        </div>

        {/* Global Actions Bar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchKpis();
              refetchReportData();
              toast.success("تم تحديث البيانات من الخادم بنجاح");
            }}
            className="rounded-full text-xs font-bold gap-1.5 h-9"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث المؤشرات
          </Button>

          <Button
            size="sm"
            onClick={() => setActiveTab("builder")}
            className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground h-9 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            بناء تقرير مخصص
          </Button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. PRIMARY TAB NAVIGATION                                             */}
      {/* ===================================================================== */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="w-full space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="bg-muted/50 p-1 rounded-2xl h-11 border">
            <TabsTrigger value="overview" className="rounded-xl text-xs font-bold px-4 gap-1.5">
              <TrendingUp className="h-4 w-4 text-[#0066FF]" />
              لوحة القيادة التنفيذية
            </TabsTrigger>
            <TabsTrigger value="catalog" className="rounded-xl text-xs font-bold px-4 gap-1.5">
              <BookOpen className="h-4 w-4 text-[#0284C7]" />
              دليل التقارير ({REPORT_CATALOG.length})
            </TabsTrigger>
            <TabsTrigger value="viewer" className="rounded-xl text-xs font-bold px-4 gap-1.5">
              <TableIcon className="h-4 w-4 text-[#059669]" />
              معاينة واستخراج التقرير
            </TabsTrigger>
            <TabsTrigger value="builder" className="rounded-xl text-xs font-bold px-4 gap-1.5">
              <Sparkles className="h-4 w-4 text-[#7C3AED]" />
              أداة بناء التقارير
            </TabsTrigger>
            <TabsTrigger value="metrics" className="rounded-xl text-xs font-bold px-4 gap-1.5">
              <Layers className="h-4 w-4 text-[#D97706]" />
              كتالوج المؤشرات الحاكم ({METRIC_CATALOG.length})
            </TabsTrigger>
          </TabsList>

          {/* Time Preset Dropdown (Active in Overview and Viewer) */}
          {(activeTab === "overview" || activeTab === "viewer") && (
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as any)}
                className="h-9 rounded-xl border bg-background px-3 text-xs font-semibold focus:outline-none"
              >
                <option value="today">اليوم</option>
                <option value="yesterday">أمس</option>
                <option value="last_7_days">آخر 7 أيام</option>
                <option value="last_30_days">آخر 30 يوماً</option>
                <option value="current_month">الشهر الحالي</option>
                <option value="prev_month">الشهر السابق</option>
                <option value="quarter">الربع الحالي</option>
                <option value="prev_quarter">الربع السابق</option>
                <option value="year">العام الحالي</option>
                <option value="prev_year">العام الماضي</option>
              </select>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* TAB 1: EXECUTIVE PEOPLE DASHBOARD                                   */}
        {/* =================================================================== */}
        <TabsContent value="overview" className="space-y-6 pt-2">
          {/* Executive Summary Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Total Headcount */}
            <div
              onClick={() => handleDrillDown("EMP_DIR")}
              className="classera-kpi-card p-4 shadow-xs flex flex-col justify-between cursor-pointer hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">إجمالي القوى العاملة</span>
                <Users className="h-4 w-4 text-[#0066FF] group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2">
                <h4 className="text-xl font-black text-foreground font-mono font-tabular-nums">
                  {isKpisLoading ? "—" : kpis?.totalHeadcount ?? "غير متوفر"}
                </h4>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-emerald-600 font-bold">{kpis?.activeEmployees || 0} نشط</span>
                  <span className="text-muted-foreground underline text-[9px]">تفاصيل</span>
                </div>
              </div>
            </div>

            {/* 2. Saudization Rate & Nitaqat */}
            <div
              onClick={() => handleDrillDown("EMP_HEADCOUNT")}
              className="classera-kpi-card p-4 shadow-xs flex flex-col justify-between cursor-pointer hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">نسبة التوطين</span>
                <Award className="h-4 w-4 text-[#0D9488] group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2">
                <h4 className="text-xl font-black text-foreground font-mono font-tabular-nums">
                  {isKpisLoading ? "—" : `${kpis?.saudizationRate || 0}%`}
                </h4>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-50 text-emerald-700 font-bold">
                    {kpis?.nitaqatBand === "platinum" ? "بلاتيني" : "أخضر مرتفع"}
                  </Badge>
                  <span className="text-muted-foreground underline text-[9px]">تفاصيل</span>
                </div>
              </div>
            </div>

            {/* 3. Attendance Rate */}
            <div
              onClick={() => handleDrillDown("ATT_SUMMARY")}
              className="classera-kpi-card p-4 shadow-xs flex flex-col justify-between cursor-pointer hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">معدل الحضور</span>
                <Clock className="h-4 w-4 text-[#0284C7] group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2">
                <h4 className="text-xl font-black text-foreground font-mono font-tabular-nums">
                  {isKpisLoading ? "—" : `${kpis?.attendanceRate || 0}%`}
                </h4>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-amber-600 font-bold">{kpis?.latenessCount || 0} تأخير</span>
                  <span className="text-muted-foreground underline text-[9px]">تفاصيل</span>
                </div>
              </div>
            </div>

            {/* 4. Absence Count & Rate */}
            <div
              onClick={() => handleDrillDown("ATT_ABSENCE")}
              className="classera-kpi-card p-4 shadow-xs flex flex-col justify-between cursor-pointer hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">الغياب غير المسوغ</span>
                <AlertTriangle className="h-4 w-4 text-rose-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2">
                <h4 className="text-xl font-black text-foreground font-mono font-tabular-nums">
                  {isKpisLoading ? "—" : `${kpis?.absenceCount || 0} يوم`}
                </h4>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-rose-600 font-bold">{kpis?.absenceRate || 0}% معدل</span>
                  <span className="text-muted-foreground underline text-[9px]">تفاصيل</span>
                </div>
              </div>
            </div>

            {/* 5. Payroll Cost */}
            <div
              onClick={() => handleDrillDown("PAY_REGISTER")}
              className="classera-kpi-card p-4 shadow-xs flex flex-col justify-between cursor-pointer hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">كتلة الرواتب المعتمدة</span>
                <Wallet className="h-4 w-4 text-[#059669] group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2">
                <h4 className="text-base font-black text-foreground font-mono font-tabular-nums truncate">
                  {isKpisLoading ? "—" : `${(kpis?.payrollCost || 0).toLocaleString()} ر.س`}
                </h4>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-muted-foreground text-[9px]">م. التكلفة: {(kpis?.averageEmployeeCost || 0).toLocaleString()}</span>
                  <span className="text-muted-foreground underline text-[9px]">المسير</span>
                </div>
              </div>
            </div>

            {/* 6. Open Vacancies & Pipeline */}
            <div
              onClick={() => handleDrillDown("REC_REQUISITIONS")}
              className="classera-kpi-card p-4 shadow-xs flex flex-col justify-between cursor-pointer hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">شواغر التوظيف</span>
                <Briefcase className="h-4 w-4 text-[#7C3AED] group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2">
                <h4 className="text-xl font-black text-foreground font-mono font-tabular-nums">
                  {isKpisLoading ? "—" : kpis?.openVacancies || 0}
                </h4>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-purple-600 font-bold">{kpis?.recruitmentCandidates || 0} مرشح</span>
                  <span className="text-muted-foreground underline text-[9px]">تفاصيل</span>
                </div>
              </div>
            </div>
          </div>

          {/* Second Row of Executive KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {/* New Hires */}
            <div
              onClick={() => handleDrillDown("EMP_JOINERS")}
              className="rounded-2xl border bg-card/60 p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <div>
                <span className="text-[10px] font-bold text-muted-foreground">منضمون جدد</span>
                <div className="text-base font-black text-foreground font-mono font-tabular-nums">
                  {kpis?.newHires || 0}
                </div>
              </div>
              <Plus className="h-4 w-4 text-emerald-600" />
            </div>

            {/* Turnover Rate */}
            <div
              onClick={() => handleDrillDown("EMP_LEAVERS")}
              className="rounded-2xl border bg-card/60 p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <div>
                <span className="text-[10px] font-bold text-muted-foreground">دوران العمل</span>
                <div className="text-base font-black text-foreground font-mono font-tabular-nums">
                  {kpis?.turnoverRate || 0}%
                </div>
              </div>
              <TrendingUp className="h-4 w-4 text-rose-500" />
            </div>

            {/* Overtime Hours */}
            <div
              onClick={() => handleDrillDown("ATT_OVERTIME")}
              className="rounded-2xl border bg-card/60 p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <div>
                <span className="text-[10px] font-bold text-muted-foreground">ساعات إضافي</span>
                <div className="text-base font-black text-foreground font-mono font-tabular-nums">
                  {kpis?.overtimeHours || 0} س
                </div>
              </div>
              <Clock className="h-4 w-4 text-blue-600" />
            </div>

            {/* Leave Utilization */}
            <div
              onClick={() => handleDrillDown("LEV_REQUESTS")}
              className="rounded-2xl border bg-card/60 p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <div>
                <span className="text-[10px] font-bold text-muted-foreground">استهلاك الإجازات</span>
                <div className="text-base font-black text-foreground font-mono font-tabular-nums">
                  {kpis?.leaveUtilizationDays || 0} يوم
                </div>
              </div>
              <CalendarDays className="h-4 w-4 text-amber-600" />
            </div>

            {/* Expiring Docs */}
            <div
              onClick={() => handleDrillDown("DOC_STATUS")}
              className="rounded-2xl border bg-card/60 p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <div>
                <span className="text-[10px] font-bold text-muted-foreground">وثائق تنتهي قريباً</span>
                <div className="text-base font-black text-amber-600 font-mono font-tabular-nums">
                  {kpis?.expiringDocuments || 0}
                </div>
              </div>
              <FileText className="h-4 w-4 text-amber-600" />
            </div>

            {/* Pending Approvals */}
            <div
              onClick={() => handleDrillDown("WKF_PENDING")}
              className="rounded-2xl border bg-card/60 p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <div>
                <span className="text-[10px] font-bold text-muted-foreground">معاملات معلقة</span>
                <div className="text-base font-black text-foreground font-mono font-tabular-nums">
                  {kpis?.pendingApprovals || 0}
                </div>
              </div>
              <Clock className="h-4 w-4 text-purple-600" />
            </div>
          </div>

          {/* Operational Alerts & Trends Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Headcount & Demographics Trend */}
            <div className="rounded-3xl border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-sm text-foreground">توزيع القوى العاملة (سعودي / مقيم)</h3>
                  <p className="text-[11px] text-muted-foreground">تطور التوطين والكوادر عبر الأشهر</p>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold">
                  تحديث فوري
                </Badge>
              </div>
              <div className="h-60 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={headcountTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, direction: "rtl" }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    <Bar dataKey="saudi" name="سعوديون" fill="#0066FF" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expat" name="مقيمون" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Weekly Attendance Punctuality Trend */}
            <div className="rounded-3xl border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-sm text-foreground">معدل الانضباط الأسبوعي (%)</h3>
                  <p className="text-[11px] text-muted-foreground">نسبة الالتزام بالبصمة وحضور الورديات</p>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-50">
                  {kpis?.attendanceRate || 98}% متوسط
                </Badge>
              </div>
              <div className="h-60 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00A3FF" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00A3FF" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis domain={[90, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, direction: "rtl" }} />
                    <Area type="monotone" dataKey="rate" name="نسبة الحضور" stroke="#0066FF" strokeWidth={2.5} fill="url(#attGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recently Viewed Reports Section */}
          {recentReports.length > 0 && (
            <div className="rounded-3xl border bg-card p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-primary" />
                  التقارير التي تم فتحها مؤخراً
                </span>
                <span className="text-[10px] text-muted-foreground">وصول سريع</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {recentReports.map((rec) => {
                  const rep = REPORT_CATALOG.find((r) => r.code === rec.reportCode);
                  if (!rep) return null;
                  return (
                    <div
                      key={rec.reportCode}
                      onClick={() => handleDrillDown(rep.code)}
                      className="p-3 rounded-2xl border bg-secondary/30 hover:bg-secondary cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div className="truncate">
                        <div className="font-bold text-xs text-foreground truncate">{rep.nameAr}</div>
                        <div className="text-[10px] text-muted-foreground">{rep.categoryNameAr}</div>
                      </div>
                      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 2: COMPLETE REPORT CATALOG                                      */}
        {/* =================================================================== */}
        <TabsContent value="catalog" className="space-y-4 pt-2">
          {/* Filter & Search Bar */}
          <div className="rounded-3xl border bg-card p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Button
                variant={catalogCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setCatalogCategory("all")}
                className="rounded-full text-xs font-bold h-8"
              >
                كافة الأقسام
              </Button>
              <Button
                variant={catalogCategory === "employees" ? "default" : "outline"}
                size="sm"
                onClick={() => setCatalogCategory("employees")}
                className="rounded-full text-xs font-bold h-8"
              >
                شؤون الموظفين
              </Button>
              <Button
                variant={catalogCategory === "attendance" ? "default" : "outline"}
                size="sm"
                onClick={() => setCatalogCategory("attendance")}
                className="rounded-full text-xs font-bold h-8"
              >
                الحضور والانصراف
              </Button>
              <Button
                variant={catalogCategory === "payroll" ? "default" : "outline"}
                size="sm"
                onClick={() => setCatalogCategory("payroll")}
                className="rounded-full text-xs font-bold h-8"
              >
                الرواتب والبدلات
              </Button>
              <Button
                variant={catalogCategory === "recruitment" ? "default" : "outline"}
                size="sm"
                onClick={() => setCatalogCategory("recruitment")}
                className="rounded-full text-xs font-bold h-8"
              >
                التوظيف
              </Button>
              <Button
                variant={catalogCategory === "expenses" ? "default" : "outline"}
                size="sm"
                onClick={() => setCatalogCategory("expenses")}
                className="rounded-full text-xs font-bold h-8"
              >
                النفقات
              </Button>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث في التقارير المتاحة..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="pr-9 rounded-full text-xs h-9"
              />
            </div>
          </div>

          {/* Catalog Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((item) => {
              const isPermitted = canAccessReport(item.code);
              const isFav = userFavorites.includes(item.code);

              return (
                <div
                  key={item.code}
                  className="rounded-3xl border bg-card p-5 shadow-xs flex flex-col justify-between hover:border-primary/50 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] font-bold">
                          {item.code}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          {item.categoryNameAr}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        {item.isSensitive && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-bold gap-1">
                            <FolderLock className="h-2.5 w-2.5" />
                            حماية مالية
                          </Badge>
                        )}
                        <button
                          onClick={() => toggleFavoriteReport(item.code)}
                          className={`p-1.5 rounded-full hover:bg-muted transition-colors ${
                            isFav ? "text-amber-500" : "text-muted-foreground"
                          }`}
                        >
                          <Star className={`h-4 w-4 ${isFav ? "fill-amber-500" : ""}`} />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-black text-sm text-foreground mt-3">{item.nameAr}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descriptionAr}</p>
                  </div>

                  <div className="pt-4 mt-4 border-t flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {item.exportFormats.join(" • ").toUpperCase()}
                    </span>

                    {isPermitted ? (
                      <Button
                        size="sm"
                        onClick={() => handleDrillDown(item.code)}
                        className="rounded-full text-xs font-bold gap-1 h-8 bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        فتح التقرير
                        <ChevronLeft className="h-3.5 w-3.5" />
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
        <TabsContent value="viewer" className="space-y-4 pt-2">
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
                onClick={handleExportExcel}
                className="rounded-full text-xs font-bold gap-1.5 h-9"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                تصدير Excel
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
        {/* TAB 4: AD-HOC REPORT BUILDER                                        */}
        {/* =================================================================== */}
        <TabsContent value="builder" className="space-y-4 pt-2">
          <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
            <div className="border-b pb-4">
              <h3 className="font-black text-sm text-foreground">
                أداة بناء التقارير المخصصة (Custom Query & Export Builder)
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                اختر المجال الإداري والحقول المسموح بها من النموذج الدلالي المحكوم (Semantic Model)
              </p>
            </div>

            {/* Source & Field Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-2">
                <label className="font-bold text-foreground">1. المجال الدلالي المعتمد</label>
                <select
                  value={builderDomainKey}
                  onChange={(e) => {
                    const src = e.target.value as ReportCategory;
                    setBuilderDomainKey(src);
                    const domainObj = REPORT_SEMANTIC_DOMAINS.find((d) => d.key === src);
                    if (domainObj) {
                      setBuilderSelectedFields(domainObj.fields.slice(0, 4).map((f) => f.key));
                    }
                  }}
                  className="w-full h-10 rounded-2xl border bg-background px-3 text-xs font-semibold focus:outline-none"
                >
                  {REPORT_SEMANTIC_DOMAINS.map((domain) => (
                    <option key={domain.key} value={domain.key}>
                      {domain.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-foreground">2. الحقول المسموح باختيارها (Allowlisted Fields)</label>
                <div className="flex flex-wrap gap-2 pt-1 max-h-40 overflow-y-auto p-2 border rounded-2xl">
                  {allowableFields.map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center gap-1.5 text-xs cursor-pointer border rounded-full px-3 py-1 bg-muted/20 hover:bg-secondary transition-colors font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={builderSelectedFields.includes(f.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBuilderSelectedFields([...builderSelectedFields, f.key]);
                          } else {
                            setBuilderSelectedFields(builderSelectedFields.filter((k) => k !== f.key));
                          }
                        }}
                        className="rounded text-primary h-3.5 w-3.5"
                      />
                      <span>{f.labelAr}</span>
                      {f.isSensitive && (
                        <FolderLock className="h-3 w-3 text-amber-600" />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs text-muted-foreground font-semibold">
                جاهز للتوليد ({builderData?.data?.length || 0} سجل متوفر للمعاينة من الخادم)
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

        {/* =================================================================== */}
        {/* TAB 5: GOVERNED METRIC CATALOG                                      */}
        {/* =================================================================== */}
        <TabsContent value="metrics" className="space-y-4 pt-2">
          <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-black text-sm text-foreground">
                كتالوج المؤشرات الحاكم المعتمد (Governed Metric Catalog)
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                تعريفات الأعمال الرسمية، الصيغ الحسابية، وجداول المصادر المعتمدة لمنع تضارب المؤشرات عبر المنظومة
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-muted/40 border-b border-border/80">
                  <tr>
                    <th className="py-3 px-4 font-bold text-muted-foreground">كود المؤشر</th>
                    <th className="py-3 px-4 font-bold text-muted-foreground">اسم المؤشر</th>
                    <th className="py-3 px-4 font-bold text-muted-foreground">المجال الحاكم</th>
                    <th className="py-3 px-4 font-bold text-muted-foreground">الصيغة الحسابية (Formula)</th>
                    <th className="py-3 px-4 font-bold text-muted-foreground">مستوى التجميع</th>
                    <th className="py-3 px-4 font-bold text-muted-foreground">الجهة المالكة</th>
                    <th className="py-3 px-4 font-bold text-muted-foreground">التصنيف الأمني</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {METRIC_CATALOG.map((m) => (
                    <tr key={m.metricCode} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary">{m.metricCode}</td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        <div>{m.nameAr}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{m.nameEn}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          {m.sourceDomain}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground max-w-xs truncate" title={m.formula}>
                        {m.formula}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{m.aggregationGrain}</td>
                      <td className="py-3 px-4 font-medium">{m.owner}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            m.securityClassification === "Restricted"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : m.securityClassification === "Confidential"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-50 text-slate-700"
                          }`}
                        >
                          {m.securityClassification}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
