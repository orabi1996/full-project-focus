import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import { exportToCSV } from "../../lib/utils/export-helpers";
import { canManageModule } from "../../lib/auth/permissions";
import type { Employee, ContractType, Gender, MaritalStatus, EmployeeStatus } from "../../types";
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
  Sparkles,
  Award,
  Printer,
  ChevronRight,
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

export const EmployeesView: React.FC = () => {
  const {
    activeEmployeeModalId,
    closeEmployeeProfile,
    employees,
    orgUnits,
    subsidiaries,
    workLocations,
    addEmployee,
    updateEmployee,
    openEmployeeProfile,
    currentRole,
    language,
    t,
  } = useApp();
  const canManage = canManageModule(currentRole, "employees");

  // View Mode: Table vs Smart Cards
  const [viewMode, setViewMode] = useState<ViewMode>("table");

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

  // Add Employee Wizard state
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [newEmp, setNewEmp] = useState({
    employeeNo: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    firstNameAr: "",
    lastNameAr: "",
    firstNameEn: "",
    lastNameEn: "",
    email: "",
    phone: "",
    nationalIdOrIqama: "",
    nationality: "سعودي",
    gender: "male" as Gender,
    birthDate: "1995-01-01",
    maritalStatus: "single" as MaritalStatus,
    subsidiaryId: subsidiaries[0]?.id || "",
    subsidiaryName: subsidiaries[0]?.nameAr || "",
    departmentId: orgUnits[0]?.id || "",
    departmentName: orgUnits[0]?.nameAr || "",
    jobTitleAr: "",
    jobTitleEn: "",
    jobGrade: "L3 - اختصاصي",
    costCenter: "CC-101",
    workType: "on_site" as const,
    workLocationId: workLocations[0]?.id || "",
    workLocationName: workLocations[0]?.nameAr || "",
    hireDate: new Date().toISOString().split("T")[0],
    contractType: "full_time" as ContractType,
    status: "active" as const,
    basicSalary: 10000,
    housingAllowance: 2500,
    transportAllowance: 800,
    totalSalary: 13300,
  });

  // Document Print Modal State
  const [docModalEmployee, setDocModalEmployee] = useState<Employee | null>(null);
  const [docModalType, setDocModalType] = useState<DocType>("salary_certificate");

  // KPI Calculations
  const totalEmployees = employees.length;
  const saudiEmployees = employees.filter(
    (e) =>
      e.nationality.includes("سعود") ||
      e.nationalIdOrIqama?.startsWith("1") ||
      e.nationality.toLowerCase().includes("saudi"),
  ).length;
  const expatEmployees = totalEmployees - saudiEmployees;
  const saudizationRate = totalEmployees > 0 ? Math.round((saudiEmployees / totalEmployees) * 100) : 0;
  const probationCount = employees.filter((e) => e.status === "probation").length;
  const onLeaveCount = employees.filter((e) => e.status === "on_leave").length;
  const expiringDocsCount = employees.filter(
    (e) =>
      e.documentsList?.some((d) => d.status === "expiring" || d.status === "expired") ||
      e.status === "probation",
  ).length;

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
  };

  // Filter Logic
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Search
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        emp.firstNameAr.toLowerCase().includes(term) ||
        emp.lastNameAr.toLowerCase().includes(term) ||
        emp.firstNameEn.toLowerCase().includes(term) ||
        emp.lastNameEn.toLowerCase().includes(term) ||
        emp.employeeNo.toLowerCase().includes(term) ||
        emp.nationalIdOrIqama.includes(term) ||
        emp.jobTitleAr.toLowerCase().includes(term) ||
        emp.email.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      const isSaudi =
        emp.nationality.includes("سعود") ||
        emp.nationalIdOrIqama?.startsWith("1") ||
        emp.nationality.toLowerCase().includes("saudi");

      // Quick Preset Pills
      if (quickPreset === "saudi" && !isSaudi) return false;
      if (quickPreset === "expat" && isSaudi) return false;
      if (quickPreset === "probation" && emp.status !== "probation") return false;
      if (quickPreset === "on_leave" && emp.status !== "on_leave") return false;
      if (quickPreset === "remote_hybrid" && emp.workType !== "remote" && emp.workType !== "hybrid")
        return false;
      if (quickPreset === "complete_profile" && emp.completionScore < 95) return false;
      if (
        quickPreset === "expiring_docs" &&
        !emp.documentsList?.some((d) => d.status === "expiring" || d.status === "expired") &&
        emp.status !== "probation"
      )
        return false;

      // Advanced Filters
      if (selectedSubsidiary !== "all" && emp.subsidiaryId !== selectedSubsidiary) return false;
      if (selectedDept !== "all" && emp.departmentId !== selectedDept) return false;
      if (selectedLoc !== "all" && emp.workLocationId !== selectedLoc) return false;
      if (selectedStatus !== "all" && emp.status !== selectedStatus) return false;
      if (selectedContractType !== "all" && emp.contractType !== selectedContractType) return false;
      if (selectedGender !== "all" && emp.gender !== selectedGender) return false;
      if (selectedNationality === "saudi" && !isSaudi) return false;
      if (selectedNationality === "expat" && isSaudi) return false;
      if (minSalary !== "" && emp.basicSalary < minSalary) return false;
      if (maxSalary !== "" && emp.basicSalary > maxSalary) return false;
      if (
        onlyExpiringDocs &&
        !emp.documentsList?.some((d) => d.status === "expiring" || d.status === "expired")
      )
        return false;

      return true;
    });
  }, [
    employees,
    searchTerm,
    quickPreset,
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
  ]);

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
    const listToExport =
      selectedIds.length > 0
        ? filteredEmployees.filter((e) => selectedIds.includes(e.id))
        : filteredEmployees;

    const exportData = listToExport.map((e) => ({
      "الرقم الوظيفي": e.employeeNo,
      "الاسم الكامل": `${e.firstNameAr} ${e.lastNameAr}`,
      "الاسم بالإنجليزية": `${e.firstNameEn} ${e.lastNameEn}`,
      "الهوية / الإقامة": e.nationalIdOrIqama,
      "الجنسية": e.nationality,
      "الإدارة": e.departmentName,
      "المسمى الوظيفي": e.jobTitleAr,
      "الدرجة الوظيفية": e.jobGrade || "L3",
      "الفرع ومقر العمل": e.workLocationName,
      "الراتب الأساسي": e.basicSalary,
      "بدل السكن": e.housingAllowance || 0,
      "بدل النقل": e.transportAllowance || 0,
      "إجمالي الراتب": e.totalSalary,
      "البريد الإلكتروني": e.email,
      "رقم الجوال": e.phone,
      "الحالة":
        e.status === "active"
          ? "نشط"
          : e.status === "probation"
            ? "تحت التجربة"
            : e.status === "on_leave"
              ? "في إجازة"
              : "موقوف",
      "تاريخ التعيين": e.hireDate,
      "عقد قوى": e.qiwaContractNo || "موثق",
    }));

    exportToCSV(`دليل_الموظفين_${new Date().toISOString().slice(0, 10)}`, exportData);
    toast.success(`تم تصدير كشف (${listToExport.length}) موظفاً بنجاح!`);
  };

  const handleBulkStatusUpdate = (newStatus: EmployeeStatus) => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach((id) => {
      updateEmployee(id, { status: newStatus });
    });
    toast.success(`تم تحديث حالة (${selectedIds.length}) موظفاً إلى (${newStatus === "active" ? "نشط" : newStatus === "probation" ? "تحت التجربة" : "موقوف"}) بنجاح!`);
    setSelectedIds([]);
  };

  // Add Employee Submission
  const handleCreateEmployee = () => {
    if (!newEmp.firstNameAr || !newEmp.lastNameAr || !newEmp.email || !newEmp.nationalIdOrIqama) {
      toast.error("يرجى استكمال الحقول الإلزامية للموظف");
      return;
    }

    const dept = orgUnits.find((u) => u.id === newEmp.departmentId);
    const sub = subsidiaries.find((s) => s.id === newEmp.subsidiaryId);
    const loc = workLocations.find((l) => l.id === newEmp.workLocationId);

    const b = Number(newEmp.basicSalary) || 10000;
    const h = Number(newEmp.housingAllowance) || Math.round(b * 0.25);
    const tr = Number(newEmp.transportAllowance) || Math.round(b * 0.08);
    const total = b + h + tr;

    const isSaudi =
      newEmp.nationality.includes("سعود") ||
      newEmp.nationalIdOrIqama.startsWith("1") ||
      newEmp.nationality.toLowerCase().includes("saudi");

    const empData: Omit<Employee, "id" | "completionScore"> = {
      employeeNo: newEmp.employeeNo,
      firstNameAr: newEmp.firstNameAr,
      lastNameAr: newEmp.lastNameAr,
      firstNameEn: newEmp.firstNameEn || newEmp.firstNameAr,
      lastNameEn: newEmp.lastNameEn || newEmp.lastNameAr,
      email: newEmp.email,
      phone: newEmp.phone || "+966 50 000 0000",
      nationalIdOrIqama: newEmp.nationalIdOrIqama,
      nationalIdExpiry: "2030-05-15",
      passportNo: "KSA-88992211",
      passportExpiry: "2029-10-10",
      nationality: newEmp.nationality,
      gender: newEmp.gender,
      birthDate: newEmp.birthDate,
      maritalStatus: newEmp.maritalStatus,
      dependentsCount: 1,
      bloodType: "O+",
      subsidiaryId: newEmp.subsidiaryId || "sub-1",
      subsidiaryName: sub?.nameAr || "فوكس للتقنية",
      departmentId: newEmp.departmentId || "dept-tech",
      departmentName: dept?.nameAr || "تقنية المعلومات",
      jobTitleAr: newEmp.jobTitleAr || "اختصاصي تقنية",
      jobTitleEn: newEmp.jobTitleEn || "Specialist",
      jobGrade: newEmp.jobGrade,
      costCenter: newEmp.costCenter,
      workType: newEmp.workType,
      workLocationId: newEmp.workLocationId || "loc-riyadh",
      workLocationName: loc?.nameAr || "المقر الرئيسي - الرياض",
      hireDate: newEmp.hireDate,
      contractStartDate: newEmp.hireDate,
      contractEndDate: "2027-12-31",
      contractType: newEmp.contractType,
      status: newEmp.status,
      basicSalary: b,
      housingAllowance: h,
      transportAllowance: tr,
      otherAllowances: 0,
      totalSalary: total,
      gosiDeductionPercentage: isSaudi ? 9.75 : 0,
      isGosiEnrolled: true,
      bankName: "مصرف الراجحي",
      iban: "SA0000000000000000000000",
      shiftId: "shift-general",
      avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 500)}?w=200`,
      qiwaContractNo: `QIWA-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      yearsOfService: 1,
    };

    addEmployee(empData);
    toast.success(`تم تسجيل وتعيين الموظف (${newEmp.firstNameAr} ${newEmp.lastNameAr}) بنجاح!`);
    setIsAddWizardOpen(false);
    setWizardStep(1);
    setNewEmp({
      employeeNo: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      firstNameAr: "",
      lastNameAr: "",
      firstNameEn: "",
      lastNameEn: "",
      email: "",
      phone: "",
      nationalIdOrIqama: "",
      nationality: "سعودي",
      gender: "male",
      birthDate: "1995-01-01",
      maritalStatus: "single",
      subsidiaryId: subsidiaries[0]?.id || "",
      subsidiaryName: subsidiaries[0]?.nameAr || "",
      departmentId: orgUnits[0]?.id || "",
      departmentName: orgUnits[0]?.nameAr || "",
      jobTitleAr: "",
      jobTitleEn: "",
      jobGrade: "L3 - اختصاصي",
      costCenter: "CC-101",
      workType: "on_site",
      workLocationId: workLocations[0]?.id || "",
      workLocationName: workLocations[0]?.nameAr || "",
      hireDate: new Date().toISOString().split("T")[0],
      contractType: "full_time",
      status: "active",
      basicSalary: 10000,
      housingAllowance: 2500,
      transportAllowance: 800,
      totalSalary: 13300,
    });
  };

  const openDocumentModal = (emp: Employee, type: DocType) => {
    setDocModalEmployee(emp);
    setDocModalType(type);
  };

  // If Full Profile is active, render Full Profile Screen
  if (activeEmployeeModalId) {
    return (
      <EmployeeFullProfileView
        employeeId={activeEmployeeModalId}
        onBack={closeEmployeeProfile}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="badge" source="material" filled size={26} className="text-primary" />
            دليل وملفات الموظفين الموحد (Employee Directory)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            سجلات الموظفين الشاملة، العقود الموثقة بقوى، الهيكل الوظيفي، وبطاقات التعديل 360°
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={handleExportSelectedOrAll}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            تصدير كشف الموظفين (CSV)
          </Button>

          {canManage && (
            <Button
              onClick={() => {
                setWizardStep(1);
                setIsAddWizardOpen(true);
              }}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-5"
            >
              <UserPlus className="h-4 w-4" />
              إضافة موظف جديد
            </Button>
          )}
        </div>
      </div>

      {/* Primary KPI Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">إجمالي الموظفين</span>
            <h4 className="text-xl font-black text-foreground mt-0.5">{totalEmployees}</h4>
            <span className="text-[10px] text-emerald-600 font-bold">100% عقود سارية</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-300 bg-emerald-500/10 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-800">🇸🇦 الكوادر الوطنية</span>
            <h4 className="text-xl font-black text-emerald-700 mt-0.5">
              {saudiEmployees} ({saudizationRate}%)
            </h4>
            <span className="text-[10px] text-emerald-700 font-bold">نطاق بلاتيني معتمد</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-600/20 flex items-center justify-center text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">🌍 الكوادر المقيمة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5">{expatEmployees}</h4>
            <span className="text-[10px] text-muted-foreground font-bold">إقامات مهنية موثقة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Building className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-300 bg-amber-500/10 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-800">تحت التجربة (90 يوم)</span>
            <h4 className="text-xl font-black text-amber-700 mt-0.5">{probationCount} موظفين</h4>
            <span className="text-[10px] text-amber-700 font-bold">بانتظار تقييم التثبيت</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-600/20 flex items-center justify-center text-amber-700">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-blue-300 bg-blue-500/10 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-800">في إجازة رسمية</span>
            <h4 className="text-xl font-black text-blue-700 mt-0.5">{onLeaveCount} موظف</h4>
            <span className="text-[10px] text-blue-700 font-bold">إجازات سنوية معتمدة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-700">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">وثائق وإقامات قريبة</span>
            <h4 className="text-xl font-black text-destructive mt-0.5">{expiringDocsCount} تنبيهات</h4>
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
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          فلاتر سريعة:
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
            placeholder="بحث بالاسم، الرقم الوظيفي، الهوية، المسمى، أو البريد..."
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

            {/* Basic Salary Range */}
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
          </div>
        </div>
      )}

      {/* VIEW 1: TABLE VIEW */}
      {viewMode === "table" && (
        <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs p-5 space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-muted-foreground">
              عرض <span className="text-foreground font-black font-mono">{filteredEmployees.length}</span> موظفاً
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-xs">
              <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
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
                      className={`hover:bg-muted/20 transition-colors group ${
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
                          onClick={() => openEmployeeProfile(emp)}
                          className="flex items-center gap-3 cursor-pointer hover:opacity-85"
                        >
                          <img
                            src={
                              emp.avatarUrl ||
                              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                            }
                            alt={emp.firstNameAr}
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
                          {emp.jobGrade || "L3 - اختصاصي"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-foreground block">{emp.departmentName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {emp.subsidiaryName || "فوكس للتقنية"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-foreground font-semibold block">{emp.jobTitleAr}</span>
                        <span className="text-[10px] text-muted-foreground font-bold">
                          {emp.workType === "remote"
                            ? "🌐 عن بعد"
                            : emp.workType === "hybrid"
                              ? "💼 هجين"
                              : "🏢 حضوري"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-black text-primary font-mono block text-sm">
                          {emp.totalSalary.toLocaleString()} {t.currency}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          أساسي: {emp.basicSalary.toLocaleString()}
                        </span>
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
                          {emp.yearsOfService || 3} سنوات خدمة
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
                            onClick={() => openEmployeeProfile(emp)}
                            className="rounded-full h-8 text-xs font-bold text-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground gap-1 transition-all px-3.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            الملف 360°
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDocumentModal(emp, "salary_certificate")}
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
                    <td colSpan={9} className="text-center py-12 text-muted-foreground font-medium">
                      لا توجد نتائج مطابقة لبحثك أو الفلاتر المحددة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: SMART CARDS GRID VIEW */}
      {viewMode === "cards" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1 text-xs">
            <span className="font-bold text-muted-foreground">
              عرض <span className="text-foreground font-black font-mono">{filteredEmployees.length}</span> بطاقة موظف
            </span>
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-xs text-primary font-bold hover:underline"
            >
              {isAllSelected ? "إلغاء تحديد الكل" : "تحديد كافة الموظفين"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredEmployees.map((emp) => {
              const isSelected = selectedIds.includes(emp.id);
              const isSaudi =
                emp.nationality.includes("سعود") ||
                emp.nationalIdOrIqama?.startsWith("1") ||
                emp.nationality.toLowerCase().includes("saudi");

              return (
                <div
                  key={emp.id}
                  className={`rounded-3xl border bg-card p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/50 relative flex flex-col justify-between space-y-4 ${
                    isSelected ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]" : "border-border/80"
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
                    onClick={() => openEmployeeProfile(emp)}
                    className="text-center space-y-2 cursor-pointer group"
                  >
                    <div className="relative inline-block">
                      <img
                        src={
                          emp.avatarUrl ||
                          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                        }
                        alt={emp.firstNameAr}
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
                      <span className="text-primary font-bold">{emp.jobGrade || "L3 - اختصاصي"}</span>
                    </div>
                  </div>

                  {/* Job & Department Details */}
                  <div className="rounded-2xl bg-muted/20 border border-border/60 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-[11px]">المسمى:</span>
                      <span className="font-bold text-foreground text-start truncate max-w-[140px]">
                        {emp.jobTitleAr}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-[11px]">الإدارة:</span>
                      <span className="font-semibold text-foreground truncate max-w-[140px]">
                        {emp.departmentName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-[11px]">الراتب الإجمالي:</span>
                      <span className="font-mono font-black text-primary">
                        {emp.totalSalary.toLocaleString()} ر.س
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => openEmployeeProfile(emp)}
                      className="flex-1 rounded-full text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground h-8 shadow-xs"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      الملف 360°
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDocumentModal(emp, "salary_certificate")}
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
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground text-background px-6 py-3 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-xs font-black">
            تم تحديد <span className="text-primary font-mono">{selectedIds.length}</span> موظفاً
          </span>

          <div className="h-4 w-px bg-background/30" />

          <Button
            size="sm"
            onClick={handleExportSelectedOrAll}
            className="rounded-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3.5 shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            تصدير المحدد (CSV)
          </Button>

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

          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="text-xs font-bold text-muted-foreground hover:text-background transition-colors mr-2"
          >
            إلغاء
          </button>
        </div>
      )}

      {/* 3-Step Add Employee Wizard Modal */}
      <Dialog open={isAddWizardOpen} onOpenChange={setIsAddWizardOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              معالج تسجيل وتعيين موظف جديد (الخطوة {wizardStep} من 3)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              استكمال البيانات الشخصية والوظيفية والمالية وإصدار العقد الرقمي
            </DialogDescription>
          </DialogHeader>

          {/* Wizard Step 1: Personal */}
          {wizardStep === 1 && (
            <div className="grid grid-cols-2 gap-3.5 text-xs py-2">
              <div className="space-y-1.5">
                <label className="font-bold">الاسم الأول (بالعربي) *</label>
                <input
                  type="text"
                  value={newEmp.firstNameAr}
                  onChange={(e) => setNewEmp({ ...newEmp, firstNameAr: e.target.value })}
                  placeholder="مثال: أحمد"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">اسم العائلة (بالعربي) *</label>
                <input
                  type="text"
                  value={newEmp.lastNameAr}
                  onChange={(e) => setNewEmp({ ...newEmp, lastNameAr: e.target.value })}
                  placeholder="مثال: السعيد"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الاسم الأول بالإنجليزية</label>
                <input
                  type="text"
                  value={newEmp.firstNameEn}
                  onChange={(e) => setNewEmp({ ...newEmp, firstNameEn: e.target.value })}
                  placeholder="Ahmed"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">اسم العائلة بالإنجليزية</label>
                <input
                  type="text"
                  value={newEmp.lastNameEn}
                  onChange={(e) => setNewEmp({ ...newEmp, lastNameEn: e.target.value })}
                  placeholder="Al-Saeed"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">البريد الإلكتروني للعمل *</label>
                <input
                  type="email"
                  value={newEmp.email}
                  onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                  placeholder="ahmed@focus-hrms.com"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">رقم الهوية الوطنية / الإقامة (10 أرقام) *</label>
                <input
                  type="text"
                  value={newEmp.nationalIdOrIqama}
                  onChange={(e) => setNewEmp({ ...newEmp, nationalIdOrIqama: e.target.value })}
                  placeholder="10XXXXXXXX"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الجنسية</label>
                <input
                  type="text"
                  value={newEmp.nationality}
                  onChange={(e) => setNewEmp({ ...newEmp, nationality: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">رقم الجوال</label>
                <input
                  type="text"
                  value={newEmp.phone}
                  onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                  placeholder="+966 5X XXX XXXX"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          )}

          {/* Wizard Step 2: Job Details */}
          {wizardStep === 2 && (
            <div className="grid grid-cols-2 gap-3.5 text-xs py-2">
              <div className="space-y-1.5">
                <label className="font-bold">المسمى الوظيفي *</label>
                <input
                  type="text"
                  value={newEmp.jobTitleAr}
                  onChange={(e) => setNewEmp({ ...newEmp, jobTitleAr: e.target.value })}
                  placeholder="مثال: مهندس برمجيات سحابية"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">القسم / الإدارة</label>
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
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {orgUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">موقع وفرع العمل</label>
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
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {workLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ المباشرة</label>
                <input
                  type="date"
                  value={newEmp.hireDate}
                  onChange={(e) => setNewEmp({ ...newEmp, hireDate: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          )}

          {/* Wizard Step 3: Salary & Review */}
          {wizardStep === 3 && (
            <div className="grid grid-cols-2 gap-3.5 text-xs py-2">
              <div className="space-y-1.5">
                <label className="font-bold">الراتب الأساسي (ر.س) *</label>
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
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">إجمالي الراتب الشهري (شامل السكن والنقل)</label>
                <input
                  type="number"
                  readOnly
                  value={newEmp.totalSalary}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted px-3 font-mono font-black text-primary"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center w-full mt-4">
            {wizardStep > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWizardStep((prev) => prev - 1)}
                className="rounded-full text-xs font-bold border-border/80 px-4 h-9"
              >
                السابق
              </Button>
            )}
            <div className="flex gap-2 mr-auto">
              {wizardStep < 3 ? (
                <Button
                  size="sm"
                  onClick={() => setWizardStep((prev) => prev + 1)}
                  className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9 shadow-xs"
                >
                  التالي
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleCreateEmployee}
                  className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9 shadow-xs"
                >
                  تأكيد وإضافة الموظف
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
