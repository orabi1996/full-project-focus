import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import { exportToCSV } from "../../lib/utils/export-helpers";
import { canManageModule } from "../../lib/auth/permissions";
import type { Employee, ContractType, Gender, MaritalStatus } from "../../types";
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

type QuickPreset = "all" | "saudi" | "expat" | "probation" | "expiring_docs" | "remote_hybrid" | "complete_profile";

export const EmployeesView: React.FC = () => {
  const {
    activeEmployeeModalId,
    closeEmployeeProfile,
    employees,
    orgUnits,
    subsidiaries,
    workLocations,
    addEmployee,
    openEmployeeProfile,
    currentRole,
    language,
    t,
  } = useApp();
  const canManage = canManageModule(currentRole, "employees");

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
  const [minSalary, setMinSalary] = useState<number | "">("");
  const [maxSalary, setMaxSalary] = useState<number | "">("");
  const [onlyExpiringDocs, setOnlyExpiringDocs] = useState(false);

  // Wizard state
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [newEmp, setNewEmp] = useState({
    employeeNo: `FOC-${Math.floor(1000 + Math.random() * 9000)}`,
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
  const saudiEmployees = employees.filter((e) => e.nationality === "سعودي" || e.nationality === "سعودية").length;
  const expatEmployees = totalEmployees - saudiEmployees;
  const saudizationRate = totalEmployees > 0 ? Math.round((saudiEmployees / totalEmployees) * 100) : 0;
  const probationCount = employees.filter((e) => e.status === "probation").length;
  const expiringDocsCount = employees.filter(
    (e) => e.documentsList?.some((d) => d.status === "expiring" || d.status === "expired") || e.status === "probation"
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
    setMinSalary("");
    setMaxSalary("");
    setOnlyExpiringDocs(false);
    setQuickPreset("all");
    setSearchTerm("");
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

      // Quick Preset Pills
      if (quickPreset === "saudi" && !(emp.nationality === "سعودي" || emp.nationality === "سعودية")) return false;
      if (quickPreset === "expat" && (emp.nationality === "سعودي" || emp.nationality === "سعودية")) return false;
      if (quickPreset === "probation" && emp.status !== "probation") return false;
      if (quickPreset === "remote_hybrid" && emp.workType !== "remote" && emp.workType !== "hybrid") return false;
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
      if (minSalary !== "" && emp.basicSalary < Number(minSalary)) return false;
      if (maxSalary !== "" && emp.basicSalary > Number(maxSalary)) return false;
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
    minSalary,
    maxSalary,
    onlyExpiringDocs,
  ]);

  const handleExportEmployees = () => {
    const dataToExport = filteredEmployees.map((e) => ({
      "الرقم الوظيفي": e.employeeNo,
      "الاسم بالعربية": `${e.firstNameAr} ${e.lastNameAr}`,
      "الاسم بالإنجليزية": `${e.firstNameEn} ${e.lastNameEn}`,
      "الهوية / الإقامة": e.nationalIdOrIqama,
      الجنسية: e.nationality,
      "البريد الإلكتروني": e.email,
      الجوال: e.phone,
      القسم: e.departmentName,
      "المسمى الوظيفي": e.jobTitleAr,
      "الدرجة الوظيفية": e.jobGrade || "L3",
      "مركز التكلفة": e.costCenter || "CC-101",
      "الراتب الأساسي": e.basicSalary,
      "بدل السكن": e.housingAllowance || 0,
      "بدل النقل": e.transportAllowance || 0,
      "إجمالي الراتب": e.totalSalary,
      "الحساب البنكي": e.bankName || "الراجحي",
      "رقم الآيبان": e.iban || "SA...",
      "تاريخ المباشرة": e.hireDate,
      "رقم عقد قوى": e.qiwaContractNo || "QIWA...",
      الحالة: e.status === "active" ? "نشط" : e.status === "probation" ? "تحت التجربة" : "في إجازة",
    }));
    exportToCSV(`Employees_Enterprise_List_${new Date().toISOString().split("T")[0]}`, dataToExport);
  };

  const handleCreateEmployee = () => {
    if (!newEmp.firstNameAr || !newEmp.lastNameAr || !newEmp.email) {
      toast.error("يرجى استكمال الحقول الإلزامية");
      return;
    }
    addEmployee(newEmp);
    setIsAddWizardOpen(false);
    setWizardStep(1);
    toast.success("تمت إضافة الموظف بنجاح في سجلات المنظومة");
  };

  const openDocumentModal = (emp: Employee, type: DocType) => {
    setDocModalEmployee(emp);
    setDocModalType(type);
  };

  // Render Full Page Profile View when an employee is selected
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
            <IconSymbol name="badge" source="material" filled size={24} className="text-primary" />
            {t.employees.directory} ({totalEmployees})
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            سجل الموظفين المركزي، الملفات الموحدة 360°، العقود والمستندات، والتصفية المتقدمة للكوادر
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button
            onClick={handleExportEmployees}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
          >
            <Download className="h-4 w-4 text-primary" />
            {t.export} كشف الموظفين الشامل
          </Button>
          {canManage && (
            <Button
              onClick={() => setIsAddWizardOpen(true)}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
            >
              <UserPlus className="h-4 w-4" />
              {t.employees.addEmployee}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">إجمالي القوى العاملة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5">{totalEmployees} موظفاً</h4>
            <span className="text-[10px] text-emerald-600 font-bold">100% مسجلون بالتأمينات</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-300 bg-emerald-500/10 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-800">نسبة التوطين (نطاقات)</span>
            <h4 className="text-xl font-black text-emerald-700 mt-0.5">{saudizationRate}%</h4>
            <span className="text-[10px] text-emerald-700 font-bold">النطاق البلاتيني المرتفع</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-600/20 flex items-center justify-center text-emerald-700">
            <BadgePercent className="h-5 w-5" />
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

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">وثائق وإقامات قريبة الانتهاء</span>
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
          ⏳ فترة التجربة ({probationCount})
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
          ⚠️ وثائق تنتهي قريباً ({expiringDocsCount})
        </button>
        <button
          type="button"
          onClick={() => setQuickPreset("remote_hybrid")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
            quickPreset === "remote_hybrid"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
          }`}
        >
          💻 العمل عن بعد / هجين
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
          ⭐ مكتمل 100%
        </button>
      </div>

      {/* Main Search & Advanced Filter Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالاسم، الرقم الوظيفي، الهوية، المسمى، البريد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-2xl border border-border/80 bg-card pr-10 pl-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <Button
            variant={isFilterPanelOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={`rounded-full text-xs font-bold gap-2 h-10 px-4 transition-all ${
              activeFiltersCount > 0 && !isFilterPanelOpen ? "border-primary text-primary" : ""
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            الفلاتر المتقدمة
            {activeFiltersCount > 0 && (
              <Badge className="h-5 px-1.5 text-[10px] rounded-full bg-primary-foreground text-primary font-black">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="rounded-full text-xs font-bold gap-1 text-muted-foreground hover:text-foreground h-10 px-3"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              إعادة تعيين
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
            <div className="space-y-1.5 sm:col-span-2">
              <label className="font-bold text-muted-foreground">نطاق الراتب الأساسي (ر.س)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="الحد الأدنى (مثال: 10000)"
                  value={minSalary}
                  onChange={(e) => setMinSalary(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-mono text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span className="text-muted-foreground font-bold">-</span>
                <input
                  type="number"
                  placeholder="الحد الأقصى (مثال: 30000)"
                  value={maxSalary}
                  onChange={(e) => setMaxSalary(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 font-mono text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employees Table Grid */}
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
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/20 transition-colors group">
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
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-foreground block">{emp.employeeNo}</span>
                    <span className="text-[10px] text-primary font-bold">{emp.jobGrade || "L3 - اختصاصي"}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-foreground block">{emp.departmentName}</span>
                    <span className="text-[10px] text-muted-foreground">{emp.subsidiaryName || "فوكس للتقنية"}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-foreground font-semibold block">{emp.jobTitleAr}</span>
                    <span className="text-[10px] text-muted-foreground font-bold">
                      {emp.workType === "remote" ? "🌐 عن بعد" : emp.workType === "hybrid" ? "💼 هجين" : "🏢 حضوري"}
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
                            : "bg-blue-500/10 text-blue-700 border-blue-200"
                      }`}
                    >
                      {emp.status === "active"
                        ? "نشط"
                        : emp.status === "probation"
                          ? "تحت التجربة"
                          : "في إجازة"}
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
                        className="rounded-full h-8 text-xs font-bold text-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground gap-1 transition-all px-3"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        عرض وتعديل 360°
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                <label className="font-bold">رقم الهوية الوطنية / الإقامة *</label>
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
                <label className="font-bold">موقع العمل</label>
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
                    setNewEmp({ ...newEmp, basicSalary: b, housingAllowance: h, transportAllowance: tr, totalSalary: b + h + tr });
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
