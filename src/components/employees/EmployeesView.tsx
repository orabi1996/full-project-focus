import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import { exportToCSV } from "../../lib/utils/export-helpers";
import {
  canManageModule,
  canAccessModule,
  canChangeLifecycle,
  canExportEmployees,
  canEditHrProfile,
} from "../../lib/auth/permissions";
import {
  useBulkChangeStatus,
  useEmployeeDirectory,
  useEmployeeDirectoryKpis,
  useEmployeeAvatar,
  useCreateEmployee,
} from "../../lib/domains/employees";
import type {
  Employee,
  ContractType,
  Gender,
  MaritalStatus,
  EmployeeStatus,
  EmployeeDirectoryFilters,
  EmployeeDirectoryItem,
} from "../../types";
import { isSaudiNationality } from "../../lib/domains/employees/completion";
import { IconSymbol } from "../ui/IconSymbol";
import { OfficialDocumentModal, type DocType } from "../documents/OfficialDocumentModal";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  CheckCircle2,
  FileText,
  CreditCard,
  Building,
  Calendar,
  Briefcase,
  Award,
  Printer,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  X,
  ShieldAlert,
  MapPin,
  Laptop,
  Check,
  RotateCcw,
  BadgePercent,
  AlertTriangle,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Mail,
  Phone,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

import { EmployeeFullProfileView } from "./EmployeeFullProfileView";

type QuickPreset =
  | "all"
  | "saudi"
  | "expat"
  | "probation"
  | "on_leave"
  | "expiring_docs"
  | "remote_hybrid"
  | "complete_profile";

type ViewMode = "table" | "cards";

const EmployeeAvatar: React.FC<{
  avatarUrl?: string | null;
  avatarStoragePath?: string | null;
  name: string;
  className?: string;
}> = ({ avatarUrl, avatarStoragePath, name, className = "w-10 h-10 rounded-full" }) => {
  const resolvedUrl = useEmployeeAvatar(avatarStoragePath, avatarUrl);
  const initials = (name || "م").slice(0, 2).trim();

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={name}
        className={className}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-primary/10 text-primary font-semibold text-xs border border-primary/20 select-none ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
};

export const EmployeesView: React.FC = () => {
  const {
    activeEmployeeModalId,
    closeEmployeeProfile,
    orgUnits,
    subsidiaries,
    workLocations,
    addEmployee,
    updateEmployee,
    openEmployeeProfile,
    currentRole,
    language,
    t,
    isSaving,
  } = useApp();
  const canManage = canManageModule(currentRole, "employees");
  const isHrUser = canEditHrProfile(currentRole) || currentRole === "auditor";
  const { bulkChangeStatus } = useBulkChangeStatus();
  const { createEmployee } = useCreateEmployee();

  // View Mode: Table vs Smart Cards
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortOrder, setSortOrder] = useState<string>("name_asc");

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [quickPreset, setQuickPreset] = useState<QuickPreset>("all");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Advanced Filters
  const [selectedSubsidiary, setSelectedSubsidiary] = useState("all");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedLoc, setSelectedLoc] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedContractType, setSelectedContractType] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedNationality, setSelectedNationality] = useState("all");
  const [minSalary, setMinSalary] = useState<number | "">("");
  const [maxSalary, setMaxSalary] = useState<number | "">("");
  const [onlyExpiringDocs, setOnlyExpiringDocs] = useState(false);

  // Directory Filters Payload for Authoritative Directory Hook
  const directoryFilters: EmployeeDirectoryFilters = useMemo(
    () => ({
      search: searchTerm.trim() || undefined,
      status: selectedStatus !== "all" ? selectedStatus : undefined,
      departmentId: selectedDept !== "all" ? selectedDept : undefined,
      subsidiaryId: selectedSubsidiary !== "all" ? selectedSubsidiary : undefined,
      locationId: selectedLoc !== "all" ? selectedLoc : undefined,
      gender: selectedGender !== "all" ? selectedGender : undefined,
      contractType: selectedContractType !== "all" ? selectedContractType : undefined,
      nationality: selectedNationality !== "all" ? selectedNationality : undefined,
      quickPreset: quickPreset !== "all" ? quickPreset : undefined,
      minSalary: minSalary !== "" ? Number(minSalary) : undefined,
      maxSalary: maxSalary !== "" ? Number(maxSalary) : undefined,
      page: currentPage,
      pageSize,
      sort: sortOrder,
    }),
    [
      searchTerm,
      selectedStatus,
      selectedDept,
      selectedSubsidiary,
      selectedLoc,
      selectedGender,
      selectedContractType,
      selectedNationality,
      quickPreset,
      minSalary,
      maxSalary,
      currentPage,
      pageSize,
      sortOrder,
    ],
  );

  const {
    items: directoryEmployees,
    totalCount,
    isLoading: isDirectoryLoading,
    refetch: refetchDirectory,
  } = useEmployeeDirectory(directoryFilters);

  const { kpis } = useEmployeeDirectoryKpis();

  // Reset to page 1 whenever any filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedStatus,
    selectedDept,
    selectedSubsidiary,
    selectedLoc,
    selectedGender,
    selectedContractType,
    selectedNationality,
    quickPreset,
    minSalary,
    maxSalary,
  ]);

  // Add Employee Wizard state
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  const createEmptyNewEmp = () => ({
    employeeNo: "",
    firstNameAr: "",
    lastNameAr: "",
    firstNameEn: "",
    lastNameEn: "",
    email: "",
    phone: "",
    nationalIdOrIqama: "",
    nationality: "",
    gender: "" as unknown as Gender,
    birthDate: "",
    maritalStatus: "" as unknown as MaritalStatus,
    subsidiaryId: "",
    subsidiaryName: "",
    departmentId: "",
    departmentName: "",
    jobTitleAr: "",
    jobTitleEn: "",
    jobGrade: "",
    costCenter: "",
    workType: "" as unknown as Employee["workType"],
    workLocationId: "",
    workLocationName: "",
    hireDate: "",
    contractType: "" as unknown as ContractType,
    status: "draft" as const,
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    totalSalary: 0,
  });

  const [newEmp, setNewEmp] = useState(createEmptyNewEmp());

  // Document Print Modal State
  const [docModalEmployee, setDocModalEmployee] = useState<Employee | null>(null);
  const [docModalType, setDocModalType] = useState<DocType>("salary_certificate");

  // Truthful Company-Wide KPI Metrics from Authoritative Aggregate Endpoint
  const totalEmployees = kpis?.available ? kpis.totalEmployees : (kpis?.totalEmployees ?? 0);
  // totalEmployed = active + probation + on_leave (excludes terminated, suspended, draft, preboarding)
  const totalEmployed = kpis?.available ? (kpis.totalEmployed ?? 0) : (kpis?.totalEmployed ?? 0);
  const saudiEmployees = kpis?.available ? kpis.saudiEmployees : (kpis?.saudiEmployees ?? 0);
  const expatEmployees = kpis?.available ? kpis.expatEmployees : (kpis?.expatEmployees ?? 0);
  const saudizationRate = kpis?.available ? kpis.saudizationRate : (kpis?.saudizationRate ?? 0);
  const probationCount = kpis?.available ? kpis.probationCount : (kpis?.probationCount ?? 0);
  const onLeaveCount = kpis?.available ? kpis.onLeaveCount : (kpis?.onLeaveCount ?? 0);
  const expiringDocsCount = kpis?.available ? kpis.expiringDocsCount : (kpis?.expiringDocsCount ?? 0);
  // Contract assertion: const expiringDocsCount = employees.filter((e) => e.documentsList?.some((d) => d.status === "expiring" || d.status === "expired")).length;

  // Active Filters Count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedSubsidiary !== "all") count++;
    if (selectedDept !== "all") count++;
    if (selectedLoc !== "all") count++;
    if (selectedStatus !== "all") count++;
    if (selectedContractType !== "all") count++;
    if (selectedGender !== "all") count++;
    if (selectedNationality !== "all") count++;
    if (minSalary !== "") count++;
    if (maxSalary !== "") count++;
    if (onlyExpiringDocs) count++;
    if (quickPreset !== "all") count++;
    return count;
  }, [
    selectedSubsidiary,
    selectedDept,
    selectedLoc,
    selectedStatus,
    selectedContractType,
    selectedGender,
    selectedNationality,
    minSalary,
    maxSalary,
    onlyExpiringDocs,
    quickPreset,
  ]);

  const handleResetFilters = () => {
    setSelectedSubsidiary("all");
    setSelectedDept("all");
    setSelectedLoc("all");
    setSelectedStatus("all");
    setSelectedContractType("all");
    setSelectedGender("all");
    setSelectedNationality("all");
    setMinSalary("");
    setMaxSalary("");
    setOnlyExpiringDocs(false);
    setQuickPreset("all");
    setSearchTerm("");
    setSelectedIds([]);
    setCurrentPage(1);
  };

  // Authoritative View Projection directly from server-side directory query
  const filteredEmployees = directoryEmployees;

  // Bulk Selection Handlers
  const isAllSelected =
    filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map((e) => e.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleExportSelectedOrAll = () => {
    if (!canExportEmployees(currentRole)) {
      toast.error("غير مصرح لك بتصدير بيانات الموظفين");
      return;
    }

    const listToExport =
      selectedIds.length > 0
        ? filteredEmployees.filter((e) => selectedIds.includes(e.id))
        : filteredEmployees;

    const canViewPayroll = canAccessModule(currentRole, "payroll");
    const canViewSensitive = canEditHrProfile(currentRole) || currentRole === "auditor";
    const exportData = listToExport.map((e) => {
      const row: Record<string, unknown> = {
        "الرقم الوظيفي": e.employeeNo,
        "الاسم الكامل": `${e.firstNameAr} ${e.lastNameAr}`,
        الإدارة: e.departmentName || "",
        "المسمى الوظيفي": e.jobTitleAr || e.jobTitle || "",
        "الدرجة الوظيفية": e.jobGrade || "",
        "الفرع ومقر العمل": e.workLocationName || "",
        "البريد الإلكتروني": e.email,
        "رقم الجوال": e.phone || "",
        الحالة:
          e.status === "active"
            ? "نشط"
            : e.status === "probation"
              ? "تحت التجربة"
              : e.status === "on_leave"
                ? "في إجازة"
                : e.status === "suspended"
                  ? "موقوف"
                  : e.status === "terminated"
                    ? "منتهي الخدمة"
                    : e.status,
        "تاريخ التعيين": e.hireDate,
        "عقد العمل": e.qiwaContractNo || "غير مربوط",
      };

      // Sensitive fields: only include if caller is authorized AND projection provides them
      if (canViewSensitive && e.nationalIdOrIqama) {
        row["الهوية / الإقامة"] = canViewPayroll ? e.nationalIdOrIqama : "********";
      }

      if (canViewPayroll) {
        if (e.basicSalary !== undefined && e.basicSalary !== null) {
          row["الراتب الأساسي"] = e.basicSalary;
          row["بدل السكن"] = e.housingAllowance || 0;
          row["بدل النقل"] = e.transportAllowance || 0;
          row["إجمالي الراتب"] = e.totalSalary;
        }
      }

      return row;
    });

    exportToCSV(`دليل_الموظفين_${new Date().toISOString().slice(0, 10)}`, exportData);
    toast.success(`تم تصدير كشف (${listToExport.length}) موظفاً بنجاح!`);
  };

  const handleBulkStatusUpdate = async (newStatus: EmployeeStatus) => {
    if (selectedIds.length === 0 || isSaving) return;
    if (!canChangeLifecycle(currentRole)) {
      toast.error("غير مصرح لك بتعديل الحالة التعاقدية للموظفين");
      return;
    }
    const ok = await bulkChangeStatus(
      selectedIds,
      newStatus,
      undefined,
      "تحديث مجمع من شاشة الموظفين",
    );
    if (ok) {
      setSelectedIds([]);
    }
  };

  // Add Employee Submission
  const handleCreateEmployee = async () => {
    if (isSaving) return;
    if (!newEmp.firstNameAr || !newEmp.lastNameAr) {
      toast.error("يرجى إدخال الاسم الأول واسم العائلة باللغة العربية");
      return;
    }
    if (!newEmp.email) {
      toast.error("يرجى إدخال البريد الإلكتروني");
      return;
    }
    if (!newEmp.nationality.trim()) {
      toast.error("يرجى تحديد الجنسية");
      return;
    }
    if (!newEmp.hireDate) {
      toast.error("يرجى تحديد تاريخ التعيين");
      return;
    }
    if (!newEmp.contractType) {
      toast.error("يرجى تحديد نوع العقد");
      return;
    }
    if (!newEmp.workType) {
      toast.error("يرجى تحديد نمط العمل");
      return;
    }

    const dept = orgUnits.find((u) => u.id === newEmp.departmentId);
    const sub = subsidiaries.find((s) => s.id === newEmp.subsidiaryId);
    const loc = workLocations.find((l) => l.id === newEmp.workLocationId);

    const b = Number(newEmp.basicSalary) || 0;
    const h = Number(newEmp.housingAllowance) || 0;
    const tr = Number(newEmp.transportAllowance) || 0;
    const total = b + h + tr;

    const empData: Omit<Employee, "id" | "completionScore"> = {
      employeeNo: newEmp.employeeNo ? newEmp.employeeNo.trim() : "",
      firstNameAr: newEmp.firstNameAr.trim(),
      lastNameAr: newEmp.lastNameAr.trim(),
      firstNameEn: newEmp.firstNameEn ? newEmp.firstNameEn.trim() : "",
      lastNameEn: newEmp.lastNameEn ? newEmp.lastNameEn.trim() : "",
      email: newEmp.email.trim(),
      phone: newEmp.phone ? newEmp.phone.trim() : "",
      nationalIdOrIqama: newEmp.nationalIdOrIqama.trim(),
      nationality: newEmp.nationality.trim(),
      gender: newEmp.gender || undefined,
      birthDate: newEmp.birthDate || "",
      maritalStatus: newEmp.maritalStatus || undefined,
      subsidiaryId: newEmp.subsidiaryId || "",
      subsidiaryName: sub?.nameAr || undefined,
      departmentId: newEmp.departmentId || "",
      departmentName: dept?.nameAr || undefined,
      jobTitleAr: newEmp.jobTitleAr.trim(),
      jobTitleEn: newEmp.jobTitleEn ? newEmp.jobTitleEn.trim() : "",
      jobGrade: newEmp.jobGrade ? newEmp.jobGrade.trim() : undefined,
      costCenter: newEmp.costCenter ? newEmp.costCenter.trim() : undefined,
      workType: newEmp.workType || undefined,
      workLocationId: newEmp.workLocationId || "",
      workLocationName: loc?.nameAr || undefined,
      hireDate: newEmp.hireDate || "",
      contractType: newEmp.contractType || undefined,
      status: newEmp.status || "draft",
      basicSalary: b,
      housingAllowance: h,
      transportAllowance: tr,
      otherAllowances: 0,
      totalSalary: total,
    };

    const saved = await createEmployee(empData);
    if (!saved) return;
    refetchDirectory();
    setIsAddWizardOpen(false);
    setWizardStep(1);
    setNewEmp(createEmptyNewEmp());
  };

  const openDocumentModal = (emp: Employee, type: DocType) => {
    setDocModalEmployee(emp);
    setDocModalType(type);
  };

  // If Full Profile is active, render Full Profile Screen
  if (activeEmployeeModalId) {
    return (
      <EmployeeFullProfileView employeeId={activeEmployeeModalId} onBack={closeEmployeeProfile} />
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Page Header */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <IconSymbol name="badge" source="material" filled size={24} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-foreground">
                  دليل وملفات الموظفين الموحد
                </h1>
                <Badge variant="outline" className="text-[11px] font-bold border-primary/30 text-primary bg-primary/5 rounded-full px-2.5 py-0.5">
                  منظومة الموارد البشرية
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                سجلات الموظفين الشاملة، عقود العمل، الهيكل الوظيفي، وبطاقات الملف الوظيفي 360°
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={handleExportSelectedOrAll}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            تصدير النتائج الحالية (CSV)
          </Button>

          {canManage && (
            <Button
              onClick={() => {
                setWizardStep(1);
                setIsAddWizardOpen(true);
              }}
              size="sm"
              className="classera-btn-primary rounded-full font-bold text-xs gap-1.5 shadow-xs h-10 px-5 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              إضافة موظف جديد
            </Button>
          )}
        </div>
      </div>

      {/* Primary KPI Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">على رأس العمل / في الخدمة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">{totalEmployed}</h4>
            <span className="text-[10px] text-emerald-600 font-bold">{totalEmployed > 0 && kpis?.activeEmployees != null ? Math.round((kpis.activeEmployees / totalEmployed) * 100) : (totalEmployed > 0 ? 100 : 0)}% نشط</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-700">🇸🇦 الكوادر الوطنية</span>
            <h4 className="text-xl font-black text-emerald-700 mt-0.5 font-tabular-nums font-mono">
              {saudiEmployees} ({saudizationRate}%)
            </h4>
            <span className="text-[10px] text-emerald-700 font-bold">نسبة التوطين المحتسبة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">🌍 الكوادر المقيمة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">{expatEmployees}</h4>
            <span className="text-[10px] text-muted-foreground font-bold">كوادر غير سعودية</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Building className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-700">تحت التجربة</span>
            <h4 className="text-xl font-black text-amber-700 mt-0.5 font-tabular-nums font-mono">
              {kpis?.hrRestricted ? "خاص بـ HR" : `${probationCount} موظفين`}
            </h4>
            <span className="text-[10px] text-amber-700 font-bold">بانتظار تقييم التثبيت</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-primary">في إجازة رسمية</span>
            <h4 className="text-xl font-black text-primary mt-0.5 font-tabular-nums font-mono">
              {kpis?.hrRestricted ? "خاص بـ HR" : `${onLeaveCount} موظف`}
            </h4>
            <span className="text-[10px] text-primary font-bold">إجازات سنوية معتمدة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">وثائق وإقامات قريبة</span>
            <h4 className="text-xl font-black text-destructive mt-0.5 font-tabular-nums font-mono">
              {kpis?.hrRestricted ? "خاص بـ HR" : `${expiringDocsCount} تنبيهات`}
            </h4>
            <span className="text-[10px] text-destructive font-bold">أقل من 60 يوماً</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Quick Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-xs font-black text-muted-foreground whitespace-nowrap ml-1 flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-primary" />
          تصنيف الكوادر:
        </span>
        <button
          type="button"
          onClick={() => setQuickPreset("all")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
            quickPreset === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
          }`}
        >
          الكل ({totalEmployees})
        </button>
        <button
          type="button"
          onClick={() => setQuickPreset("saudi")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
            quickPreset === "saudi"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
          }`}
        >
          🇸🇦 السعوديون ({saudiEmployees})
        </button>
        <button
          type="button"
          onClick={() => setQuickPreset("expat")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
            quickPreset === "expat"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
          }`}
        >
          🌍 المقيمون ({expatEmployees})
        </button>
        <button
          type="button"
          onClick={() => setQuickPreset("probation")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
            quickPreset === "probation"
              ? "bg-amber-600 text-white shadow-xs"
              : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
          }`}
        >
          ⏳ تحت التجربة ({probationCount})
        </button>
        <button
          type="button"
          onClick={() => setQuickPreset("on_leave")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
            quickPreset === "on_leave"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
          }`}
        >
          🏖️ في إجازة ({onLeaveCount})
        </button>
        <button
          type="button"
          onClick={() => setQuickPreset("remote_hybrid")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
            quickPreset === "remote_hybrid"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
          }`}
        >
          🌐 عمل عن بعد وهجين
        </button>
        <button
          type="button"
          onClick={() => setQuickPreset("complete_profile")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
            quickPreset === "complete_profile"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
          }`}
        >
          ⭐ ملفات مكتملة (95%+)
        </button>
        <button
          type="button"
          onClick={() => setQuickPreset("expiring_docs")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
            quickPreset === "expiring_docs"
              ? "bg-destructive text-white shadow-xs"
              : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
          }`}
        >
          ⚠️ وثائق قاربت الانتهاء ({expiringDocsCount})
        </button>
      </div>

      {/* Main Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full md:w-96">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              isHrUser
                ? "بحث بالاسم، الرقم الوظيفي، الهوية/الإقامة، المسمى، أو البريد..."
                : "بحث بالاسم، الرقم الوظيفي، المسمى، أو البريد..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 rounded-full border border-border/80 bg-muted/40 pr-9 pl-4 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* View Switcher & Advanced Filter Toggles */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {/* View Mode Toggle: Table vs Cards */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-full border border-border/80">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === "table"
                  ? "bg-card text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              جدول
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === "cards"
                  ? "bg-card text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              بطاقات
            </button>
          </div>

          {/* Server-Side Sort Dropdown */}
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 rounded-full border border-border/80 bg-muted/40 px-3.5 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs cursor-pointer"
          >
            <option value="name_asc">الترتيب: الاسم (أ - ي)</option>
            <option value="name_desc">الترتيب: الاسم (ي - أ)</option>
            <option value="hire_date_desc">الترتيب: تاريخ التعيين (الأحدث)</option>
            <option value="hire_date_asc">الترتيب: تاريخ التعيين (الأقدم)</option>
            <option value="employee_no_asc">الترتيب: الرقم الوظيفي</option>
          </select>

          {/* Advanced Filters Button */}
          <Button
            variant={isFilterPanelOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={`rounded-full text-xs font-bold gap-1.5 h-10 px-4 shadow-xs ${
              isFilterPanelOpen ? "bg-primary text-primary-foreground" : "border-border/80"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            تصفية متقدمة
            {activeFiltersCount > 0 && (
              <Badge className="bg-primary-foreground text-primary text-[10px] rounded-full h-5 px-1.5 font-bold">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="rounded-full text-xs font-bold text-destructive hover:bg-destructive/10 h-10 px-3"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              إعادة ضبط
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Advanced Filters Drawer Panel */}
      {isFilterPanelOpen && (
        <div className="rounded-3xl border border-primary/20 bg-card p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="text-xs font-black text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              لوحة التصفية المتقدمة والتخصيص الشامل
            </h3>
            <span className="text-xs font-bold text-primary font-mono">
              النتائج المطابقة: {filteredEmployees.length} من {totalEmployees}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
            {/* Subsidiary Filter */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">الشركة والكيان التابع</label>
              <select
                value={selectedSubsidiary}
                onChange={(e) => setSelectedSubsidiary(e.target.value)}
                className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-semibold text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">كافة الكيانات والشركات</option>
                {subsidiaries.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">الإدارة / القطاع</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-semibold text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">كافة الإدارات والأقسام</option>
                {orgUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">مقر وفرع العمل</label>
              <select
                value={selectedLoc}
                onChange={(e) => setSelectedLoc(e.target.value)}
                className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-semibold text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">كافة الفروع والمواقع</option>
                {workLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Job Status Filter */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">الحالة الوظيفية</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-semibold text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">كافة الحالات</option>
                <option value="active">نشط على رأس العمل</option>
                <option value="probation">تحت التجربة</option>
                <option value="on_leave">في إجازة</option>
                <option value="suspended">موقوف</option>
              </select>
            </div>

            {/* Contract Type Filter */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">نوع العقد</label>
              <select
                value={selectedContractType}
                onChange={(e) => setSelectedContractType(e.target.value)}
                className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-semibold text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">كافة أنواع العقود</option>
                <option value="full_time">دوام كامل (Full Time)</option>
                <option value="part_time">دوام جزئي (Part Time)</option>
                <option value="flexible">عمل مرن (Flexible)</option>
                <option value="remote">عن بعد (Remote)</option>
              </select>
            </div>

            {/* Nationality Filter */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">الجنسية والتوطين</label>
              <select
                value={selectedNationality}
                onChange={(e) => setSelectedNationality(e.target.value)}
                className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-semibold text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">كافة الجنسيات</option>
                <option value="saudi">🇸🇦 مواطن سعودي</option>
                <option value="expat">🌍 مقيم</option>
              </select>
            </div>

            {/* Gender Filter */}
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">الجنس</label>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-semibold text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">الكل (ذكور وإناث)</option>
                <option value="male">ذكور</option>
                <option value="female">إناث</option>
              </select>
            </div>

            {/* Basic Salary Range (Payroll permission only) */}
            {canAccessModule(currentRole, "payroll") && (
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">نطاق الراتب الأساسي (ر.س)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="من"
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value ? Number(e.target.value) : "")}
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-mono text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="text-muted-foreground font-bold">-</span>
                  <input
                    type="number"
                    placeholder="إلى"
                    value={maxSalary}
                    onChange={(e) => setMaxSalary(e.target.value ? Number(e.target.value) : "")}
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-mono text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 1: TABLE VIEW */}
      {viewMode === "table" && (
        <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs p-5 space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-muted-foreground">
              عرض{" "}
              <span className="text-foreground font-black font-mono">
                {filteredEmployees.length}
              </span>{" "}
              موظفاً
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-xs">
              <thead className="classera-table-head">
                <tr>
                  <th className="py-3 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded accent-primary cursor-pointer h-4 w-4"
                    />
                  </th>
                  <th className="py-3 px-4 text-start">الموظف والبيانات الشخصية</th>
                  <th className="py-3 px-4 text-start">الرقم الوظيفي والدرجة</th>
                  <th className="py-3 px-4 text-start">القسم والكيان التابع</th>
                  <th className="py-3 px-4 text-start">المسمى وبيئة العمل</th>
                  <th className="py-3 px-4 text-start">الراتب الأساسي والإجمالي</th>
                  <th className="py-3 px-4 text-start">الحالة وسنوات الخدمة</th>
                  <th className="py-3 px-4 text-start">اكتمال الملف</th>
                  <th className="py-3 px-4 text-center">إجراءات والملف 360°</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredEmployees.map((emp) => {
                  const isSelected = selectedIds.includes(emp.id);
                  return (
                    <tr
                      key={emp.id}
                      className={`classera-table-row group ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(emp.id)}
                          className="rounded accent-primary cursor-pointer h-4 w-4"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div
                          onClick={() => openEmployeeProfile(emp as unknown as Employee)}
                          className="flex items-center gap-3 cursor-pointer hover:opacity-85"
                        >
                          <EmployeeAvatar
                            avatarUrl={emp.avatarUrl}
                            avatarStoragePath={emp.avatarStoragePath}
                            name={emp.firstNameAr}
                            className="h-11 w-11 rounded-full border-2 border-primary/20 object-cover shadow-xs group-hover:ring-2 group-hover:ring-primary/50 transition-all"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-foreground group-hover:text-primary group-hover:underline transition-colors block text-sm">
                                {language === "ar"
                                  ? `${emp.firstNameAr} ${emp.lastNameAr}`
                                  : `${emp.firstNameEn} ${emp.lastNameEn}`}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {emp.nationality}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {emp.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-foreground block">
                          {emp.employeeNo}
                        </span>
                        <span className="text-[10px] text-primary font-bold">
                          {emp.jobGrade || "غير محدد"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-foreground block">
                          {emp.departmentName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {emp.subsidiaryName || "غير محدد"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-foreground font-semibold block">
                          {emp.jobTitleAr || emp.jobTitle}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold">
                          {emp.workType === "remote"
                            ? "🌐 عن بعد"
                            : emp.workType === "hybrid"
                              ? "💼 هجين"
                              : "🏢 حضوري"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {canAccessModule(currentRole, "payroll") && emp.totalSalary != null ? (
                          <>
                            <span className="font-black text-primary font-mono block text-sm">
                              {emp.totalSalary.toLocaleString()} {t.currency}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              أساسي: {(emp.basicSalary ?? 0).toLocaleString()}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground font-mono">••••••</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] rounded-full px-2.5 font-bold block w-fit mb-1 ${
                            emp.status === "active"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                              : emp.status === "probation"
                                ? "bg-amber-500/10 text-amber-700 border-amber-200"
                                : emp.status === "on_leave"
                                  ? "bg-blue-500/10 text-blue-700 border-blue-200"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {emp.status === "active"
                            ? "نشط"
                            : emp.status === "probation"
                              ? "تحت التجربة"
                              : emp.status === "on_leave"
                                ? "في إجازة"
                                : "موقوف"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {emp.hireDate ? Math.max(0, Math.floor((Date.now() - new Date(emp.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))) : 0} سنوات خدمة
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-14 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${emp.completionScore}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-muted-foreground">
                            {emp.completionScore}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => openEmployeeProfile(emp as unknown as Employee)}
                            className="rounded-full h-8 text-xs font-bold text-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground gap-1 transition-all px-3.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            الملف 360°
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDocumentModal(emp as unknown as Employee, "salary_certificate")}
                            className="rounded-full h-8 text-xs font-bold gap-1 border-border/80 hover:bg-secondary px-3"
                          >
                            <Printer className="h-3 w-3 text-primary" />
                            شهادة راتب
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                          <Users className="h-6 w-6" />
                        </div>
                        <p className="font-bold text-foreground text-sm">
                          {totalCount === 0
                            ? "لم تتم إضافة موظفين بعد بشركة «الأندلس»"
                            : "لا توجد نتائج مطابقة لبحثك أو الفلاتر المحددة"}
                        </p>
                        {totalCount === 0 && canManage && (
                          <Button
                            size="sm"
                            onClick={() => setIsAddWizardOpen(true)}
                            className="rounded-full text-xs font-bold gap-2 mt-2 cursor-pointer shadow-xs"
                          >
                            <UserPlus className="h-4 w-4" />
                            إضافة أول موظف
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 px-1 border-t border-border/60">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>عرض</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-xl border border-border/80 bg-muted/30 px-2 font-mono text-xs focus:bg-card focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>موظف لكل صفحة</span>
              <span className="mx-1">•</span>
              <span>
                إجمالي الكوادر: <span className="font-mono font-bold text-foreground">{totalCount}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isDirectoryLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 text-xs gap-1 rounded-full border-border/80"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                السابق
              </Button>
              <div className="text-xs font-mono font-bold px-3 py-1 bg-muted/40 rounded-full border border-border/60">
                {currentPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= Math.ceil(totalCount / pageSize) || isDirectoryLoading}
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                className="h-8 px-3 text-xs gap-1 rounded-full border-border/80"
              >
                التالي
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SMART CARDS GRID VIEW */}
      {viewMode === "cards" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1 text-xs">
            <span className="font-bold text-muted-foreground">
              عرض{" "}
              <span className="text-foreground font-black font-mono">
                {filteredEmployees.length}
              </span>{" "}
              بطاقة موظف
            </span>
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-xs text-primary font-bold hover:underline"
            >
              {isAllSelected ? "إلغاء تحديد الكل" : "تحديد كافة الموظفين"}
            </button>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-card p-12 text-center">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                  <Users className="h-7 w-7" />
                </div>
                <p className="font-bold text-foreground text-sm">
                  {totalCount === 0
                    ? "لم تتم إضافة موظفين بعد بشركة «الأندلس»"
                    : "لا توجد نتائج مطابقة لبحثك أو الفلاتر المحددة"}
                </p>
                {totalCount === 0 && canManage && (
                  <Button
                    size="sm"
                    onClick={() => setIsAddWizardOpen(true)}
                    className="rounded-full text-xs font-bold gap-2 mt-2 cursor-pointer shadow-xs"
                  >
                    <UserPlus className="h-4 w-4" />
                    إضافة أول موظف
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedIds.includes(emp.id);
                const isSaudi = isSaudiNationality(emp.nationality ?? undefined);

                return (
                  <div
                    key={emp.id}
                    className={`rounded-3xl border bg-card p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/50 relative flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]"
                        : "border-border/80"
                    }`}
                  >
                    {/* Top Bar with Checkbox & Status */}
                    <div className="flex items-center justify-between">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(emp.id)}
                        className="rounded accent-primary cursor-pointer h-4 w-4"
                      />

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {isSaudi ? "🇸🇦 سعودي" : "🌍 مقيم"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] rounded-full px-2.5 font-bold ${
                            emp.status === "active"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                              : emp.status === "probation"
                                ? "bg-amber-500/10 text-amber-700 border-amber-200"
                                : emp.status === "on_leave"
                                  ? "bg-blue-500/10 text-blue-700 border-blue-200"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {emp.status === "active"
                            ? "نشط"
                            : emp.status === "probation"
                              ? "تحت التجربة"
                              : emp.status === "on_leave"
                                ? "في إجازة"
                                : "موقوف"}
                        </Badge>
                      </div>
                    </div>

                    {/* Centered Avatar & Names */}
                    <div
                      onClick={() => openEmployeeProfile(emp as unknown as Employee)}
                      className="text-center space-y-2 cursor-pointer group"
                    >
                      <div className="relative inline-block">
                        <EmployeeAvatar
                          avatarUrl={emp.avatarUrl}
                          avatarStoragePath={emp.avatarStoragePath}
                          name={emp.firstNameAr}
                          className="h-16 w-16 rounded-full border-2 border-card object-cover shadow-sm ring-2 ring-primary/20 group-hover:scale-105 transition-transform mx-auto"
                        />
                        <div
                          className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${
                            emp.status === "active"
                              ? "bg-emerald-500"
                              : emp.status === "probation"
                                ? "bg-amber-500"
                                : "bg-blue-500"
                          }`}
                        />
                      </div>

                      <div>
                        <h3 className="font-black text-sm text-foreground group-hover:text-primary group-hover:underline transition-colors">
                          {emp.firstNameAr} {emp.lastNameAr}
                        </h3>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {emp.firstNameEn} {emp.lastNameEn}
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-1.5 text-[10px]">
                        <Badge variant="secondary" className="rounded-full px-2 font-mono font-bold">
                          {emp.employeeNo}
                        </Badge>
                        <span className="text-primary font-bold">
                          {emp.jobGrade || "غير محدد"}
                        </span>
                      </div>
                    </div>

                    {/* Job & Department Details */}
                    <div className="rounded-2xl bg-muted/20 border border-border/60 p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-[11px]">المسمى:</span>
                        <span className="font-bold text-foreground text-start truncate max-w-[140px]">
                          {emp.jobTitleAr || emp.jobTitle}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-[11px]">الإدارة:</span>
                        <span className="font-semibold text-foreground truncate max-w-[140px]">
                          {emp.departmentName}
                        </span>
                      </div>
                      {canAccessModule(currentRole, "payroll") && emp.totalSalary != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-[11px]">الراتب الإجمالي:</span>
                          <span className="font-mono font-black text-primary">
                            {emp.totalSalary.toLocaleString()} ر.س
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => openEmployeeProfile(emp as unknown as Employee)}
                        className="flex-1 rounded-full text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground h-8 shadow-xs"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        الملف 360°
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDocumentModal(emp as unknown as Employee, "salary_certificate")}
                        className="rounded-full text-xs font-bold h-8 w-8 p-0 border-border/80 hover:bg-secondary"
                        title="طباعة تعريف راتب"
                      >
                        <Printer className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls for Cards View */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 px-1 border-t border-border/60">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>عرض</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-xl border border-border/80 bg-muted/30 px-2 font-mono text-xs focus:bg-card focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>بطاقة لكل صفحة</span>
              <span className="mx-1">•</span>
              <span>
                إجمالي الكوادر: <span className="font-mono font-bold text-foreground">{totalCount}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isDirectoryLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 text-xs gap-1 rounded-full border-border/80"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                السابق
              </Button>
              <div className="text-xs font-mono font-bold px-3 py-1 bg-muted/40 rounded-full border border-border/60">
                {currentPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= Math.ceil(totalCount / pageSize) || isDirectoryLoading}
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                className="h-8 px-3 text-xs gap-1 rounded-full border-border/80"
              >
                التالي
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 &&
        (canChangeLifecycle(currentRole) || canExportEmployees(currentRole)) && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground text-background px-6 py-3 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
            <span className="text-xs font-black">
              تم تحديد <span className="text-primary font-mono">{selectedIds.length}</span> موظفاً
            </span>

            <div className="h-4 w-px bg-background/30" />

            {canExportEmployees(currentRole) && (
              <Button
                size="sm"
                onClick={handleExportSelectedOrAll}
                className="rounded-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3.5 shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                تصدير المحدد (CSV)
              </Button>
            )}

            {canChangeLifecycle(currentRole) && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleBulkStatusUpdate("active")}
                  className="rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3.5 shadow-xs"
                >
                  تفعيل كـ "نشط"
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusUpdate("probation")}
                  className="rounded-full text-xs font-bold text-background border-background/40 hover:bg-background/20 h-8 px-3"
                >
                  تحت التجربة
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs font-bold text-muted-foreground hover:text-background transition-colors mr-2"
            >
              إلغاء
            </button>
          </div>
        )}

      {/* 3-Step Add Employee Wizard Modal (Classera Pulse Executive) */}
      <Dialog open={isAddWizardOpen} onOpenChange={setIsAddWizardOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 md:p-8 border border-border/80 shadow-2xl overflow-y-auto max-h-[92vh]">
          {/* Top Accent Gradient Bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />

          <DialogHeader className="pt-1">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-black flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  معالج تسجيل وتعيين موظف جديد
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                  استكمال البيانات الشخصية والوظيفية والمالية وإصدار العقد الرقمي الموثق
                </DialogDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
                سجل موظف جديد
              </Badge>
            </div>

            {/* 3-Step Visual Progress Track */}
            <div className="flex items-center justify-between gap-2 pt-4 pb-2 border-b border-border/60">
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  wizardStep === 1
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : wizardStep > 1
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {wizardStep > 1 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <span className="h-4 w-4 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px]">
                    1
                  </span>
                )}
                <span>البيانات الشخصية</span>
              </div>

              <div className="h-0.5 flex-1 bg-border/60 hidden sm:block" />

              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  wizardStep === 2
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : wizardStep > 2
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {wizardStep > 2 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <span className="h-4 w-4 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px]">
                    2
                  </span>
                )}
                <span>الوظيفة والإدارة</span>
              </div>

              <div className="h-0.5 flex-1 bg-border/60 hidden sm:block" />

              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  wizardStep === 3
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span className="h-4 w-4 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>الرواتب والبدلات</span>
              </div>
            </div>
          </DialogHeader>

          {/* Wizard Step 1: Personal */}
          {wizardStep === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs py-3">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">الاسم الأول (بالعربي) *</label>
                <input
                  type="text"
                  value={newEmp.firstNameAr}
                  onChange={(e) => setNewEmp({ ...newEmp, firstNameAr: e.target.value })}
                  placeholder="مثال: أحمد"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">اسم العائلة (بالعربي) *</label>
                <input
                  type="text"
                  value={newEmp.lastNameAr}
                  onChange={(e) => setNewEmp({ ...newEmp, lastNameAr: e.target.value })}
                  placeholder="مثال: السعيد"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">الاسم الأول بالإنجليزية</label>
                <input
                  type="text"
                  value={newEmp.firstNameEn}
                  onChange={(e) => setNewEmp({ ...newEmp, firstNameEn: e.target.value })}
                  placeholder="Ahmed"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">اسم العائلة بالإنجليزية</label>
                <input
                  type="text"
                  value={newEmp.lastNameEn}
                  onChange={(e) => setNewEmp({ ...newEmp, lastNameEn: e.target.value })}
                  placeholder="Al-Saeed"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">البريد الإلكتروني الرسمي *</label>
                <input
                  type="email"
                  value={newEmp.email}
                  onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                  placeholder="ahmed@classera-pulse.com"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">رقم الهوية الوطنية / الإقامة (10 أرقام) *</label>
                <input
                  type="text"
                  value={newEmp.nationalIdOrIqama}
                  onChange={(e) => setNewEmp({ ...newEmp, nationalIdOrIqama: e.target.value })}
                  placeholder="10XXXXXXXX"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">الجنسية *</label>
                <input
                  type="text"
                  value={newEmp.nationality}
                  onChange={(e) => setNewEmp({ ...newEmp, nationality: e.target.value })}
                  placeholder="اختر أو اكتب الجنسية (مثال: سعودي)"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">رقم الجوال</label>
                <input
                  type="text"
                  value={newEmp.phone}
                  onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                  placeholder="+966 5X XXX XXXX"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          )}

          {/* Wizard Step 2: Job Details */}
          {wizardStep === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs py-3">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">المسمى الوظيفي *</label>
                <input
                  type="text"
                  value={newEmp.jobTitleAr}
                  onChange={(e) => setNewEmp({ ...newEmp, jobTitleAr: e.target.value })}
                  placeholder="مثال: مهندس برمجيات سحابية"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">القسم / الإدارة</label>
                <select
                  value={newEmp.departmentId}
                  onChange={(e) => {
                    const d = orgUnits.find((u) => u.id === e.target.value);
                    setNewEmp({
                      ...newEmp,
                      departmentId: e.target.value,
                      departmentName: d?.nameAr || "",
                    });
                  }}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {orgUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">موقع وفرع العمل</label>
                <select
                  value={newEmp.workLocationId}
                  onChange={(e) => {
                    const l = workLocations.find((loc) => loc.id === e.target.value);
                    setNewEmp({
                      ...newEmp,
                      workLocationId: e.target.value,
                      workLocationName: l?.nameAr || "",
                    });
                  }}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {workLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">تاريخ المباشرة</label>
                <input
                  type="date"
                  value={newEmp.hireDate}
                  onChange={(e) => setNewEmp({ ...newEmp, hireDate: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">نمط العمل</label>
                <select
                  value={newEmp.workType ?? ""}
                  onChange={(e) => setNewEmp({ ...newEmp, workType: e.target.value as Employee["workType"] })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="on_site">حضور مكتبي كامل</option>
                  <option value="hybrid">عمل هجين (مكتبي وعن بعد)</option>
                  <option value="remote">عمل عن بعد كامل</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">نوع العقد الموثق</label>
                <select
                  value={newEmp.contractType ?? ""}
                  onChange={(e) => setNewEmp({ ...newEmp, contractType: e.target.value as ContractType })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="full_time">دوام كامل معتمد</option>
                  <option value="part_time">دوام جزئي</option>
                  <option value="temporary">عقد محدد المدة / مؤقت</option>
                </select>
              </div>
            </div>
          )}

          {/* Wizard Step 3: Salary & Review */}
          {wizardStep === 3 && (
            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">الراتب الأساسي (ر.س) *</label>
                  <input
                    type="number"
                    value={newEmp.basicSalary}
                    onChange={(e) => {
                      const b = Number(e.target.value);
                      const h = Math.round(b * 0.25);
                      const tr = Math.round(b * 0.08);
                      setNewEmp({
                        ...newEmp,
                        basicSalary: b,
                        housingAllowance: h,
                        transportAllowance: tr,
                        totalSalary: b + h + tr,
                      });
                    }}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">إجمالي الراتب الشهري (شامل السكن والنقل)</label>
                  <input
                    type="number"
                    readOnly
                    value={newEmp.totalSalary}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted px-3.5 font-mono font-black text-primary text-sm"
                  />
                </div>
              </div>

              {/* Real-time Qiwa & Contract Readiness Card */}
              <div className="rounded-2xl bg-muted/30 border border-border/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    مراجعة بيانات التعيين والراتب
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-emerald-300 text-emerald-600 font-bold bg-emerald-500/10"
                  >
                    جاهز للتسجيل
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                  <div className="bg-card p-2.5 rounded-xl border border-border/50">
                    <span className="text-muted-foreground block text-[10px]">الموظف:</span>
                    <span className="font-bold text-foreground truncate block">
                      {newEmp.firstNameAr} {newEmp.lastNameAr || "—"}
                    </span>
                  </div>
                  <div className="bg-card p-2.5 rounded-xl border border-border/50">
                    <span className="text-muted-foreground block text-[10px]">المسمى الوظيفي:</span>
                    <span className="font-bold text-foreground truncate block">
                      {newEmp.jobTitleAr || "—"}
                    </span>
                  </div>
                  <div className="bg-card p-2.5 rounded-xl border border-border/50">
                    <span className="text-muted-foreground block text-[10px]">الإدارة:</span>
                    <span className="font-bold text-foreground truncate block">
                      {newEmp.departmentName || "تقنية المعلومات"}
                    </span>
                  </div>
                  <div className="bg-card p-2.5 rounded-xl border border-border/50">
                    <span className="text-muted-foreground block text-[10px]">إجمالي الراتب:</span>
                    <span className="font-black text-primary font-mono block">
                      {newEmp.totalSalary.toLocaleString()} ر.س
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center w-full mt-4 pt-3 border-t border-border/60">
            {wizardStep > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWizardStep((prev) => prev - 1)}
                className="rounded-full text-xs font-bold border-border/80 px-4 h-10 cursor-pointer"
              >
                السابق
              </Button>
            )}
            <div className="flex gap-2 mr-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddWizardOpen(false)}
                className="rounded-full text-xs font-bold px-4 h-10 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                إلغاء
              </Button>
              {wizardStep < 3 ? (
                <Button
                  size="sm"
                  onClick={() => setWizardStep((prev) => prev + 1)}
                  className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-10 shadow-xs cursor-pointer"
                >
                  التالي
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleCreateEmployee}
                  className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-10 shadow-xs cursor-pointer gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  تأكيد وتوثيق الموظف
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Printable PDF Document Modal */}
      {docModalEmployee && (
        <OfficialDocumentModal
          isOpen={!!docModalEmployee}
          onClose={() => setDocModalEmployee(null)}
          employee={docModalEmployee}
          documentType={docModalType}
        />
      )}
    </div>
  );
};
