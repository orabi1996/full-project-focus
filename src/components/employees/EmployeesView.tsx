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
import { transliterateArabicName } from "../../lib/utils/arabic-transliteration";
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
import { useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";
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
  const navigate = useNavigate();
  const {
    activeEmployeeModalId,
    closeEmployeeProfile,
    orgUnits,
    subsidiaries,
    workLocations,
    shifts,
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
  const { createEmployee, createEmployeeWithResult } = useCreateEmployee();

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
    isError: isDirectoryError,
    isFetching: isDirectoryFetching,
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
    // Step 1: Personal
    employeeNo: "",
    biometricId: "",
    firstNameAr: "",
    lastNameAr: "",
    firstNameEn: "",
    lastNameEn: "",
    identityType: "national_id" as "national_id" | "iqama" | "passport" | "border_number",
    nationalIdOrIqama: "",
    nationalIdExpiry: "",
    nationality: "",
    religion: "مسلم",
    gender: "" as unknown as Gender,
    maritalStatus: "" as unknown as MaritalStatus,
    dependentsCount: 0,
    avatarUrl: "",

    // Step 2: Work & Organizational
    region: "",
    subsidiaryId: "",
    subsidiaryName: "",
    workLocationId: "",
    workLocationName: "",
    mainDepartment: "",
    careerTrack: "",
    departmentId: "",
    departmentName: "",
    sector: "",
    jobGrade: "",
    managerId: "",
    shiftId: "",
    currentRoleName: "",
    specialization: "",
    jobTitleAr: "",
    jobTitleEn: "",
    costCenter: "",
    workType: "" as unknown as Employee["workType"],
    birthDate: "",
    hireDate: "",
    joiningDate: "",
    annualLeaveCalculation: "من تاريخ المباشرة",
    experienceYears: 0,
    probationDays: 90,
    kingdomEntryDate: "",
    highestQualification: "",

    // Step 3: Contact & Addresses
    phone: "",
    secondaryPhone: "",
    workPhone: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
    currentResidenceAddress: "",
    homeCountry: "",
    homeCity: "",
    homeDetailedAddress: "",
    homePhone: "",
    buildingNo: "",
    postalCode: "",
    additionalNo: "",
    district: "",
    email: "",
    personalEmail: "",
    birthPlace: "",
    shortNationalAddress: "",
    city: "",
    street: "",

    // Step 4: Financial
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    totalSalary: 0,
    jobCategory: "",
    sponsorName: "",
    paymentMethod: "bank" as "cash" | "bank" | "exchange",
    bankName: "",
    bankCommissionStatus: "not_deducted" as "deducted" | "not_deducted",
    bankAccountNumber: "",
    iban: "",
    lockBankData: false,
    customAllowances: [] as { id: string; name: string; amount: number }[],
    customDeductions: [] as { id: string; name: string; amount: number }[],

    // Step 5: Contracts
    contractType: "" as unknown as ContractType,
    qiwaContractNo: "",
    contractStartDate: "",
    contractEndDate: "",
    contractDurationType: "fixed_term" as "fixed_term" | "indefinite" | "ajeer" | "part_time" | "seasonal",
    annualLeavePolicy: "لائحة العمل القياسية (21 يوماً)",
    contractAnnualLeaveDays: 21,
    contractWorkPattern: "full_time" as "full_time" | "part_time" | "remote" | "voluntary",
    workJurisdiction: "inside_kingdom" as "inside_kingdom" | "outside_kingdom",
    weeklyWorkDays: 5,
    workHoursStandard: "daily" as "daily" | "weekly",
    standardWorkHoursCount: 8,
    weeklyRestDays: 2,
    qiwaContractClauses: "",
    contractAttachmentName: "",
    contractAttachmentUrl: "",
    contractNotes: "",
    contractAutoRenew: true,
    status: "draft" as const,
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

  // Add Employee Submission (5-Step Enterprise Onboarding Wizard)
  const handleCreateEmployee = async () => {
    if (isSaving) return;
    if (!newEmp.firstNameAr || !newEmp.lastNameAr) {
      toast.error("يرجى إدخال الاسم الأول واسم العائلة باللغة العربية");
      setWizardStep(1);
      return;
    }
    if (!newEmp.nationality.trim()) {
      toast.error("يرجى تحديد الجنسية");
      setWizardStep(1);
      return;
    }
    if (!newEmp.hireDate) {
      toast.error("يرجى تحديد تاريخ التعيين في خطوة بيانات العمل");
      setWizardStep(2);
      return;
    }
    if (!newEmp.email) {
      toast.error("يرجى إدخال البريد الإلكتروني في خطوة بيانات التواصل");
      setWizardStep(3);
      return;
    }

    const resolvedContractType: ContractType =
      newEmp.contractType ||
      (newEmp.contractDurationType === "ajeer"
        ? "contractor"
        : newEmp.contractWorkPattern === "part_time"
          ? "part_time"
          : "full_time");

    const resolvedWorkType: NonNullable<Employee["workType"]> =
      newEmp.workType || (newEmp.contractWorkPattern === "remote" ? "remote" : "on_site");

    const dept = orgUnits.find((u) => u.id === newEmp.departmentId);
    const sub = subsidiaries.find((s) => s.id === newEmp.subsidiaryId);
    const loc = workLocations.find((l) => l.id === newEmp.workLocationId);
    const mgr = directoryEmployees.find((m) => m.id === newEmp.managerId);

    const b = Number(newEmp.basicSalary) || 0;
    const h = Number(newEmp.housingAllowance) || 0;
    const tr = Number(newEmp.transportAllowance) || 0;
    const customAllowancesSum = (newEmp.customAllowances || []).reduce(
      (acc, item) => acc + (Number(item.amount) || 0),
      0,
    );
    const customDeductionsSum = (newEmp.customDeductions || []).reduce(
      (acc, item) => acc + (Number(item.amount) || 0),
      0,
    );
    const total = Math.max(0, b + h + tr + customAllowancesSum - customDeductionsSum);

    // Compute probation end date if hireDate + probationDays exist
    let computedProbationEnd: string | undefined;
    if (newEmp.hireDate && newEmp.probationDays) {
      const start = new Date(newEmp.joiningDate || newEmp.hireDate);
      if (!Number.isNaN(start.getTime())) {
        start.setDate(start.getDate() + Number(newEmp.probationDays));
        computedProbationEnd = start.toISOString().slice(0, 10);
      }
    }

    const empData: Omit<Employee, "id" | "completionScore"> = {
      employeeNo: newEmp.employeeNo ? newEmp.employeeNo.trim() : "",
      biometricId: newEmp.biometricId ? newEmp.biometricId.trim() : undefined,
      firstNameAr: newEmp.firstNameAr.trim(),
      lastNameAr: newEmp.lastNameAr.trim(),
      firstNameEn: newEmp.firstNameEn
        ? newEmp.firstNameEn.trim()
        : transliterateArabicName(newEmp.firstNameAr.trim()),
      lastNameEn: newEmp.lastNameEn
        ? newEmp.lastNameEn.trim()
        : transliterateArabicName(newEmp.lastNameAr.trim()),
      identityType: newEmp.identityType,
      nationalIdOrIqama: newEmp.nationalIdOrIqama.trim(),
      nationalIdExpiry: newEmp.nationalIdExpiry || undefined,
      nationality: newEmp.nationality.trim(),
      religion: newEmp.religion || undefined,
      gender: newEmp.gender || undefined,
      birthDate: newEmp.birthDate || "",
      maritalStatus: newEmp.maritalStatus || undefined,
      dependentsCount: Number(newEmp.dependentsCount) || 0,
      avatarUrl: newEmp.avatarUrl || undefined,

      // Step 2: Work & Organizational
      region: newEmp.region || undefined,
      subsidiaryId: newEmp.subsidiaryId || "",
      subsidiaryName: sub?.nameAr || newEmp.subsidiaryName || undefined,
      workLocationId: newEmp.workLocationId || "",
      workLocationName: loc?.nameAr || newEmp.workLocationName || undefined,
      mainDepartment: newEmp.mainDepartment || undefined,
      careerTrack: newEmp.careerTrack || undefined,
      departmentId: newEmp.departmentId || "",
      departmentName: dept?.nameAr || newEmp.departmentName || undefined,
      sector: newEmp.sector || undefined,
      jobGrade: newEmp.jobGrade ? newEmp.jobGrade.trim() : undefined,
      managerId: newEmp.managerId || null,
      managerName: mgr ? `${mgr.firstNameAr} ${mgr.lastNameAr}`.trim() : undefined,
      shiftId: newEmp.shiftId || undefined,
      currentRoleName: newEmp.currentRoleName || undefined,
      specialization: newEmp.specialization || undefined,
      jobTitleAr: (newEmp.jobTitleAr || newEmp.currentRoleName || "موظف").trim(),
      jobTitleEn: newEmp.jobTitleEn ? newEmp.jobTitleEn.trim() : "",
      costCenter: newEmp.costCenter ? newEmp.costCenter.trim() : undefined,
      workType: resolvedWorkType,
      hireDate: newEmp.hireDate || "",
      joiningDate: newEmp.joiningDate || newEmp.hireDate || undefined,
      annualLeaveCalculation: newEmp.annualLeaveCalculation || undefined,
      experienceYears: Number(newEmp.experienceYears) || 0,
      probationDays: Number(newEmp.probationDays) || 90,
      probationEndDate: computedProbationEnd,
      kingdomEntryDate: newEmp.kingdomEntryDate || undefined,
      highestQualification: newEmp.highestQualification || undefined,
      educationDegree: newEmp.highestQualification || undefined,

      // Step 3: Contact & Addresses
      email: newEmp.email.trim(),
      personalEmail: newEmp.personalEmail ? newEmp.personalEmail.trim() : undefined,
      phone: newEmp.phone ? newEmp.phone.trim() : "",
      secondaryPhone: newEmp.secondaryPhone ? newEmp.secondaryPhone.trim() : undefined,
      workPhone: newEmp.workPhone ? newEmp.workPhone.trim() : undefined,
      birthPlace: newEmp.birthPlace ? newEmp.birthPlace.trim() : undefined,
      currentResidenceAddress: newEmp.currentResidenceAddress || undefined,
      shortNationalAddress: newEmp.shortNationalAddress || undefined,
      homeCountryAddress:
        newEmp.homeCountry || newEmp.homeCity || newEmp.homeDetailedAddress || newEmp.homePhone
          ? {
              country: newEmp.homeCountry || undefined,
              city: newEmp.homeCity || undefined,
              detailedAddress: newEmp.homeDetailedAddress || undefined,
              phone: newEmp.homePhone || undefined,
            }
          : undefined,
      nationalAddress: {
        buildingNo: newEmp.buildingNo || "",
        street: newEmp.street || "",
        district: newEmp.district || "",
        city: newEmp.city || "",
        postalCode: newEmp.postalCode || "",
        additionalNo: newEmp.additionalNo || "",
      },
      emergencyContact:
        newEmp.emergencyContactName || newEmp.emergencyContactPhone
          ? {
              name: newEmp.emergencyContactName || "",
              relation: newEmp.emergencyContactRelation || "",
              phone: newEmp.emergencyContactPhone || "",
            }
          : undefined,

      // Step 4: Financial
      basicSalary: b,
      housingAllowance: h,
      transportAllowance: tr,
      otherAllowances: customAllowancesSum,
      totalSalary: total,
      jobCategory: newEmp.jobCategory || undefined,
      sponsorName: newEmp.sponsorName || undefined,
      paymentMethod: newEmp.paymentMethod,
      bankName: newEmp.paymentMethod === "bank" ? newEmp.bankName || undefined : undefined,
      bankCommissionStatus:
        newEmp.paymentMethod === "bank" ? newEmp.bankCommissionStatus : undefined,
      bankAccountNumber:
        newEmp.paymentMethod === "bank" ? newEmp.bankAccountNumber || undefined : undefined,
      iban: newEmp.paymentMethod === "bank" ? newEmp.iban || undefined : undefined,
      lockBankData: Boolean(newEmp.lockBankData),
      customAllowances: newEmp.customAllowances,
      customDeductions: newEmp.customDeductions,

      // Step 5: Contracts
      contractType: resolvedContractType,
      status: newEmp.status || "active",
      qiwaContractNo: newEmp.qiwaContractNo || undefined,
      contractStartDate: newEmp.contractStartDate || newEmp.hireDate || undefined,
      contractEndDate:
        newEmp.contractDurationType === "indefinite"
          ? undefined
          : newEmp.contractEndDate || undefined,
      contractDurationType: newEmp.contractDurationType,
      annualLeavePolicy:
        newEmp.contractDurationType === "ajeer" ? "نظام أجير (بدون إجازة سنوية)" : newEmp.annualLeavePolicy,
      contractAnnualLeaveDays:
        newEmp.contractDurationType === "ajeer" ? 0 : Number(newEmp.contractAnnualLeaveDays) || 21,
      contractWorkPattern: newEmp.contractWorkPattern,
      workJurisdiction: newEmp.workJurisdiction,
      weeklyWorkDays: Number(newEmp.weeklyWorkDays) || 5,
      workHoursStandard: newEmp.workHoursStandard,
      standardWorkHoursCount: Number(newEmp.standardWorkHoursCount) || 8,
      weeklyRestDays: Math.max(0, 7 - (Number(newEmp.weeklyWorkDays) || 5)),
      qiwaContractClauses: newEmp.qiwaContractClauses || undefined,
      contractAttachmentName: newEmp.contractAttachmentName || undefined,
      contractAttachmentUrl: newEmp.contractAttachmentUrl || undefined,
      contractNotes: newEmp.contractNotes || undefined,
      contractAutoRenew: Boolean(newEmp.contractAutoRenew),
    };

    const created = await createEmployeeWithResult(empData);
    if (!created) return;
    refetchDirectory();
    setIsAddWizardOpen(false);
    setWizardStep(1);
    setNewEmp(createEmptyNewEmp());
    // Redirect immediately to the newly created employee's 360 profile screen
    openEmployeeProfile(created.id);
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

  if (isDirectoryLoading || isDirectoryError) {
    return (
      <section className="rounded-3xl border bg-card p-8 text-center" aria-busy={isDirectoryFetching}>
        <h1 className="text-xl font-bold">{language === "ar" ? "دليل وملفات الموظفين" : "Employee directory"}</h1>
        <p className="my-4 text-muted-foreground" role={isDirectoryError ? "alert" : "status"}>
          {isDirectoryError
            ? (language === "ar" ? "تعذر تحميل بيانات الموظفين. لا يمكن تحديد عدد الموظفين حاليًا." : "Employee data could not be loaded. The employee count is currently unavailable.")
            : (language === "ar" ? "جارٍ تحميل بيانات الموظفين..." : "Loading employee data...")}
        </p>
        {isDirectoryError && (
          <Button onClick={() => void refetchDirectory()} disabled={isDirectoryFetching}>
            {language === "ar" ? "إعادة المحاولة" : "Try again"}
          </Button>
        )}
      </section>
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
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 mb-1">شاشة العمليات وسجل الموظفين اليومي</span>
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
            onClick={() => navigate({ to: "/setup?tab=org" as any })}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs cursor-pointer"
          >
            <Settings className="h-4 w-4 text-primary" />
            تهيئة الهيكل والمناصب
          </Button>
          <Button
            onClick={() => navigate({ to: "/setup?tab=users" as any })}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs cursor-pointer"
          >
            <Settings className="h-4 w-4 text-indigo-600" />
            حوكمة الصلاحيات
          </Button>
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
                            ? "لا توجد سجلات موظفين متاحة ضمن نطاق العرض الحالي"
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
                    ? "لا توجد سجلات موظفين متاحة ضمن نطاق العرض الحالي"
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

      {/* 5-Step Enterprise Add Employee Wizard Modal */}
      <Dialog open={isAddWizardOpen} onOpenChange={setIsAddWizardOpen}>
        <DialogContent className="max-w-5xl rounded-3xl p-6 md:p-8 border border-border/80 shadow-2xl overflow-y-auto max-h-[94vh]">
          {/* Top Accent Gradient Bar */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />

          <DialogHeader className="pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-base md:text-lg font-black flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  معالج تسجيل وتعيين موظف جديد (5 خطوات شاملة)
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                  استكمال البيانات الشخصية، بيانات العمل والهيكل، التواصل والعناوين، البيانات المالية، والعقود الموثقة
                </DialogDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
                الخطوة {wizardStep} من 5
              </Badge>
            </div>

            {/* 5-Step Interactive Visual Progress Track */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-4 pb-3 border-b border-border/60">
              {[
                { step: 1, title: "البيانات الشخصية" },
                { step: 2, title: "بيانات العمل" },
                { step: 3, title: "بيانات التواصل" },
                { step: 4, title: "البيانات المالية" },
                { step: 5, title: "العقود والإنهاء" },
              ].map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setWizardStep(item.step)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer text-start ${
                    wizardStep === item.step
                      ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20"
                      : wizardStep > item.step
                        ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {wizardStep > item.step ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-background/20 flex items-center justify-center text-[10px] font-mono shrink-0">
                      {item.step}
                    </span>
                  )}
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
            </div>
          </DialogHeader>

          {/* ================================================================= */}
          {/* STEP 1: البيانات الشخصية (Personal Information)                   */}
          {/* ================================================================= */}
          {wizardStep === 1 && (
            <div className="space-y-5 py-3 text-xs">
              {/* Employee Photo Upload + Employee No & Biometric ID */}
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 rounded-2xl border-2 border-primary/30 bg-card flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                    {newEmp.avatarUrl ? (
                      <img src={newEmp.avatarUrl} alt="صورة الموظف" className="h-full w-full object-cover" />
                    ) : (
                      <Users className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-black text-foreground block">الصورة الشخصية للموظف</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-bold text-[11px] cursor-pointer transition-colors">
                        <span>رفع صورة شخصية</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === "string") {
                                setNewEmp((prev) => ({ ...prev, avatarUrl: reader.result as string }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      {newEmp.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setNewEmp((prev) => ({ ...prev, avatarUrl: "" }))}
                          className="text-[11px] text-rose-600 font-bold hover:underline"
                        >
                          إزالة الصورة
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP بحد أقصى 5 ميجابايت</p>
                  </div>
                </div>

                {/* Controllable Employee No & Biometric ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto md:min-w-[340px]">
                  <div className="space-y-1">
                    <label className="font-bold text-foreground flex items-center justify-between">
                      <span>الرقم الوظيفي</span>
                      <span className="text-[10px] text-primary font-semibold">قابل للتخصيص</span>
                    </label>
                    <input
                      type="text"
                      value={newEmp.employeeNo}
                      onChange={(e) => setNewEmp({ ...newEmp, employeeNo: e.target.value })}
                      placeholder="تلقائي أو أدخل رقماً (مثال: EMP-1050)"
                      className="w-full h-10 rounded-xl border border-border/80 bg-card px-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-foreground flex items-center justify-between">
                      <span>رقم البصمة (جهاز الحضور)</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">ربط البصمة</span>
                    </label>
                    <input
                      type="text"
                      value={newEmp.biometricId}
                      onChange={(e) => setNewEmp({ ...newEmp, biometricId: e.target.value })}
                      placeholder="مثال: BIO-4092"
                      className="w-full h-10 rounded-xl border border-border/80 bg-card px-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* Arabic Name with Real-time Automatic English Transliteration */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-primary" />
                    الاسم النظامي (مع التحويل التلقائي الفوري للغة الإنجليزية)
                  </h4>
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    ترجمة صوتية تلقائية
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الاسم الأول (بالعربي) *</label>
                    <input
                      type="text"
                      value={newEmp.firstNameAr}
                      onChange={(e) => {
                        const val = e.target.value;
                        const autoEn = transliterateArabicName(val);
                        setNewEmp({
                          ...newEmp,
                          firstNameAr: val,
                          firstNameEn: autoEn || newEmp.firstNameEn,
                        });
                      }}
                      placeholder="مثال: محمد"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">اسم العائلة (بالعربي) *</label>
                    <input
                      type="text"
                      value={newEmp.lastNameAr}
                      onChange={(e) => {
                        const val = e.target.value;
                        const autoEn = transliterateArabicName(val);
                        setNewEmp({
                          ...newEmp,
                          lastNameAr: val,
                          lastNameEn: autoEn || newEmp.lastNameEn,
                        });
                      }}
                      placeholder="مثال: العتيبي"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الاسم الأول (بالإنجليزية)</label>
                    <input
                      type="text"
                      value={newEmp.firstNameEn}
                      onChange={(e) => setNewEmp({ ...newEmp, firstNameEn: e.target.value })}
                      placeholder="Mohammed"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">اسم العائلة (بالإنجليزية)</label>
                    <input
                      type="text"
                      value={newEmp.lastNameEn}
                      onChange={(e) => setNewEmp({ ...newEmp, lastNameEn: e.target.value })}
                      placeholder="Al-Otaibi"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Identity Type & Civil Demographics */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  بيانات الهوية والحالة الشخصية
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">نوع الهوية *</label>
                    <select
                      value={newEmp.identityType}
                      onChange={(e) =>
                        setNewEmp({
                          ...newEmp,
                          identityType: e.target.value as
                            | "national_id"
                            | "iqama"
                            | "passport"
                            | "border_number",
                        })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="national_id">هوية وطنية</option>
                      <option value="iqama">إقامة نظامية</option>
                      <option value="passport">جواز سفر</option>
                      <option value="border_number">رقم حدود</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">
                      {newEmp.identityType === "national_id"
                        ? "رقم الهوية الوطنية *"
                        : newEmp.identityType === "iqama"
                          ? "رقم الإقامة *"
                          : newEmp.identityType === "passport"
                            ? "رقم جواز السفر *"
                            : "رقم الحدود *"}
                    </label>
                    <input
                      type="text"
                      value={newEmp.nationalIdOrIqama}
                      onChange={(e) => setNewEmp({ ...newEmp, nationalIdOrIqama: e.target.value })}
                      placeholder={
                        newEmp.identityType === "national_id"
                          ? "10XXXXXXXX"
                          : newEmp.identityType === "iqama"
                            ? "2XXXXXXXXX"
                            : newEmp.identityType === "passport"
                              ? "A12345678"
                              : "3XXXXXXXXX"
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">تاريخ انتهاء الوثيقة</label>
                    <input
                      type="date"
                      value={newEmp.nationalIdExpiry}
                      onChange={(e) => setNewEmp({ ...newEmp, nationalIdExpiry: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الجنسية *</label>
                    <input
                      type="text"
                      list="nationalities-list"
                      value={newEmp.nationality}
                      onChange={(e) => setNewEmp({ ...newEmp, nationality: e.target.value })}
                      placeholder="اختر أو اكتب الجنسية (مثال: سعودي)"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <datalist id="nationalities-list">
                      <option value="سعودي" />
                      <option value="مصري" />
                      <option value="أردني" />
                      <option value="سوري" />
                      <option value="يمني" />
                      <option value="سوداني" />
                      <option value="لبناني" />
                      <option value="فلسطيني" />
                      <option value="مغربي" />
                      <option value="تونسي" />
                      <option value="باكستاني" />
                      <option value="هندي" />
                      <option value="فلبيني" />
                    </datalist>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الديانة</label>
                    <select
                      value={newEmp.religion}
                      onChange={(e) => setNewEmp({ ...newEmp, religion: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="مسلم">مسلم</option>
                      <option value="غير مسلم">غير مسلم</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الجنس</label>
                    <select
                      value={newEmp.gender ?? ""}
                      onChange={(e) => setNewEmp({ ...newEmp, gender: e.target.value as Gender })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">اختر الجنس...</option>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الحالة الاجتماعية</label>
                    <select
                      value={newEmp.maritalStatus ?? ""}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, maritalStatus: e.target.value as MaritalStatus })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">اختر الحالة الاجتماعية...</option>
                      <option value="single">أعزب / عزباء</option>
                      <option value="married">متزوج / متزوجة</option>
                      <option value="divorced">مطلق / مطلقة</option>
                      <option value="widowed">أرمل / أرملة</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">عدد أفراد الأسرة (المعالين)</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={newEmp.dependentsCount}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, dependentsCount: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 2: بيانات العمل (Work & Organizational Data - 4 Subsections) */}
          {/* ================================================================= */}
          {wizardStep === 2 && (
            <div className="space-y-4 py-3 text-xs">
              {/* Subsection 1: المنطقة والفرع والمسار */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  أولاً: المنطقة والفرع والمسار التنظيمي
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">المنطقة الإدارية</label>
                    <select
                      value={newEmp.region}
                      onChange={(e) => setNewEmp({ ...newEmp, region: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">اختر المنطقة...</option>
                      <option value="منطقة الرياض">منطقة الرياض</option>
                      <option value="منطقة مكة المكرمة (جدة)">منطقة مكة المكرمة (جدة)</option>
                      <option value="المنطقة الشرقية (الدمام/الخبر)">المنطقة الشرقية (الدمام/الخبر)</option>
                      <option value="منطقة المدينة المنورة">منطقة المدينة المنورة</option>
                      <option value="منطقة القصيم">منطقة القصيم</option>
                      <option value="منطقة عسير">منطقة عسير</option>
                      <option value="منطقة تبوك">منطقة تبوك</option>
                      <option value="منطقة حائل">منطقة حائل</option>
                      <option value="منطقة جازان">منطقة جازان</option>
                      <option value="منطقة نجران">منطقة نجران</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الفرع / موقع العمل</label>
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
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">اختر الفرع من التهيئة...</option>
                      {workLocations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">القسم الرئيسي / الإدارة العامة</label>
                    <input
                      type="text"
                      value={newEmp.mainDepartment}
                      onChange={(e) => setNewEmp({ ...newEmp, mainDepartment: e.target.value })}
                      placeholder="مثال: قطاع العمليات والتشغيل"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">المسار الوظيفي</label>
                    <select
                      value={newEmp.careerTrack}
                      onChange={(e) => setNewEmp({ ...newEmp, careerTrack: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">اختر المسار...</option>
                      <option value="مسار قيادي وتنفيذي">مسار قيادي وتنفيذي</option>
                      <option value="مسار تقني وهندسي">مسار تقني وهندسي</option>
                      <option value="مسار إداري وموارد بشرية">مسار إداري وموارد بشرية</option>
                      <option value="مسار مالي ومحاسبي">مسار مالي ومحاسبي</option>
                      <option value="مسار مبيعات وتطوير أعمال">مسار مبيعات وتطوير أعمال</option>
                      <option value="مسار تشغيلي وميداني">مسار تشغيلي وميداني</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Subsection 2: بيانات الوظيفة والتفاصيل الإدارية */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-primary" />
                  ثانياً: بيانات الوظيفة والتفاصيل الإدارية
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">القسم / الوحدة التنظيمية</label>
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
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">اختر القسم...</option>
                      {orgUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">القطاع</label>
                    <input
                      type="text"
                      value={newEmp.sector}
                      onChange={(e) => setNewEmp({ ...newEmp, sector: e.target.value })}
                      placeholder="مثال: القطاع الخاص / تقنية"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">المستوى الوظيفي / الدرجة</label>
                    <input
                      type="text"
                      value={newEmp.jobGrade}
                      onChange={(e) => setNewEmp({ ...newEmp, jobGrade: e.target.value })}
                      placeholder="مثال: الدرجة العاشرة / Senior"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">المدير المباشر</label>
                    <select
                      value={newEmp.managerId}
                      onChange={(e) => setNewEmp({ ...newEmp, managerId: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">بدون مدير مباشر / اختر...</option>
                      {directoryEmployees.map((mgr) => (
                        <option key={mgr.id} value={mgr.id}>
                          {mgr.firstNameAr} {mgr.lastNameAr} ({mgr.employeeNo})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">جدول الدوام (الوردية)</label>
                    <select
                      value={newEmp.shiftId}
                      onChange={(e) => setNewEmp({ ...newEmp, shiftId: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">الدوام الرسمي الافتراضي (08:00 - 16:00)</option>
                      {(shifts || []).map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          {sh.nameAr} ({sh.startTime} - {sh.endTime})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الوظيفة الحالية</label>
                    <input
                      type="text"
                      value={newEmp.currentRoleName}
                      onChange={(e) => setNewEmp({ ...newEmp, currentRoleName: e.target.value })}
                      placeholder="مثال: أخصائي موارد بشرية"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">التخصص المهني</label>
                    <input
                      type="text"
                      value={newEmp.specialization}
                      onChange={(e) => setNewEmp({ ...newEmp, specialization: e.target.value })}
                      placeholder="مثال: إدارة الأعمال / هندسة النظم"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">المسمى الوظيفي المعتمد (في العقد) *</label>
                    <input
                      type="text"
                      value={newEmp.jobTitleAr}
                      onChange={(e) => setNewEmp({ ...newEmp, jobTitleAr: e.target.value })}
                      placeholder="مثال: مدير مشروع تقني"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* Subsection 3: التواريخ الوظيفية واحتساب الإجازة */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  ثالثاً: التواريخ الوظيفية واحتساب الإجازة السنوية
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">تاريخ الميلاد</label>
                    <input
                      type="date"
                      value={newEmp.birthDate}
                      onChange={(e) => setNewEmp({ ...newEmp, birthDate: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">تاريخ التعيين *</label>
                    <input
                      type="date"
                      value={newEmp.hireDate}
                      onChange={(e) =>
                        setNewEmp({
                          ...newEmp,
                          hireDate: e.target.value,
                          joiningDate: newEmp.joiningDate || e.target.value,
                          contractStartDate: newEmp.contractStartDate || e.target.value,
                        })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">تاريخ مباشرة العمل الفعلي</label>
                    <input
                      type="date"
                      value={newEmp.joiningDate}
                      onChange={(e) => setNewEmp({ ...newEmp, joiningDate: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">آلية احتساب الإجازة السنوية</label>
                    <select
                      value={newEmp.annualLeaveCalculation}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, annualLeaveCalculation: e.target.value })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="من تاريخ المباشرة">من تاريخ مباشرة العمل</option>
                      <option value="من تاريخ التعيين">من تاريخ التعيين في العقد</option>
                      <option value="حسب السنة الميلادية">حسب السنة الميلادية</option>
                      <option value="استحقاق شهري تراكمي (21 يوماً)">استحقاق شهري تراكمي (21 يوماً)</option>
                      <option value="استحقاق شهري تراكمي (30 يوماً)">استحقاق شهري تراكمي (30 يوماً)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Subsection 4: بيانات الخبرة العملية والمؤهل وفترة التجربة */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-primary" />
                  رابعاً: الخبرة العملية، فترة التجربة، والمؤهل الدراسي
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">مدة الخبرة السابقة (بالسنوات)</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={newEmp.experienceYears}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, experienceYears: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">فترة التجربة (بالأيام)</label>
                    <select
                      value={newEmp.probationDays}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, probationDays: Number(e.target.value) })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value={30}>30 يوماً</option>
                      <option value={60}>60 يوماً</option>
                      <option value={90}>90 يوماً (القياسية)</option>
                      <option value={180}>180 يوماً (الحد الأقصى نظاماً)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">تاريخ دخول المملكة</label>
                    <input
                      type="date"
                      value={newEmp.kingdomEntryDate}
                      onChange={(e) => setNewEmp({ ...newEmp, kingdomEntryDate: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">آخر مؤهل دراسي</label>
                    <select
                      value={newEmp.highestQualification}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, highestQualification: e.target.value })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">اختر المؤهل الدراسي...</option>
                      <option value="دكتوراه">دكتوراه</option>
                      <option value="ماجستير">ماجستير</option>
                      <option value="بكالوريوس">بكالوريوس</option>
                      <option value="دبلوم عالي">دبلوم عالي</option>
                      <option value="دبلوم متوسط">دبلوم متوسط</option>
                      <option value="ثانوية عامة">ثانوية عامة</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 3: بيانات التواصل والعناوين (Contact & Addresses - 5 Sections)*/}
          {/* ================================================================= */}
          {wizardStep === 3 && (
            <div className="space-y-4 py-3 text-xs">
              {/* 1. أرقام التواصل والطوارئ */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-primary" />
                  أولاً: أرقام التواصل وبيانات الطوارئ
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">رقم الجوال الأساسي *</label>
                    <input
                      type="text"
                      value={newEmp.phone}
                      onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                      placeholder="+966 5X XXX XXXX"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">جوال إضافي / واتساب</label>
                    <input
                      type="text"
                      value={newEmp.secondaryPhone}
                      onChange={(e) => setNewEmp({ ...newEmp, secondaryPhone: e.target.value })}
                      placeholder="+966 5X XXX XXXX"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">هاتف العمل / التحويلة</label>
                    <input
                      type="text"
                      value={newEmp.workPhone}
                      onChange={(e) => setNewEmp({ ...newEmp, workPhone: e.target.value })}
                      placeholder="تحويلة 104 أو رقم مباشر"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">اسم جهة اتصال الطوارئ</label>
                    <input
                      type="text"
                      value={newEmp.emergencyContactName}
                      onChange={(e) => setNewEmp({ ...newEmp, emergencyContactName: e.target.value })}
                      placeholder="الاسم الثلاثي"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">صلة القرابة</label>
                    <input
                      type="text"
                      value={newEmp.emergencyContactRelation}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, emergencyContactRelation: e.target.value })
                      }
                      placeholder="أب / أخ / زوجة / قريب"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">رقم جوال الطوارئ</label>
                    <input
                      type="text"
                      value={newEmp.emergencyContactPhone}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, emergencyContactPhone: e.target.value })
                      }
                      placeholder="+966 5X XXX XXXX"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* 2. عناوين الإقامة (الحالي والبلد الأم) */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-primary" />
                  ثانياً: عناوين الإقامة (الحالي وعنوان البلد الأم)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="font-bold text-foreground">عنوان الإقامة الحالي داخل المملكة</label>
                    <input
                      type="text"
                      value={newEmp.currentResidenceAddress}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, currentResidenceAddress: e.target.value })
                      }
                      placeholder="المدينة - الحي - الشارع - بجوار..."
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">البلد الأم (الدولة)</label>
                    <input
                      type="text"
                      value={newEmp.homeCountry}
                      onChange={(e) => setNewEmp({ ...newEmp, homeCountry: e.target.value })}
                      placeholder="مثال: مصر / الأردن / السعودية"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">مدينة البلد الأم</label>
                    <input
                      type="text"
                      value={newEmp.homeCity}
                      onChange={(e) => setNewEmp({ ...newEmp, homeCity: e.target.value })}
                      placeholder="مثال: القاهرة / عمّان"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <label className="font-bold text-foreground">العنوان التفصيلي في البلد الأم</label>
                    <input
                      type="text"
                      value={newEmp.homeDetailedAddress}
                      onChange={(e) => setNewEmp({ ...newEmp, homeDetailedAddress: e.target.value })}
                      placeholder="المحافظة - المنطقة - الشارع - رقم العقار"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">هاتف التواصل في البلد الأم</label>
                    <input
                      type="text"
                      value={newEmp.homePhone}
                      onChange={(e) => setNewEmp({ ...newEmp, homePhone: e.target.value })}
                      placeholder="00201XXXXXXXXX"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* 3. المعلومات البريدية و 5. تفاصيل العنوان الوطني */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  ثالثاً وخامساً: المعلومات البريدية وتفاصيل العنوان الوطني (سبل)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">العنوان الوطني المختصر</label>
                    <input
                      type="text"
                      value={newEmp.shortNationalAddress}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, shortNationalAddress: e.target.value.toUpperCase() })
                      }
                      placeholder="مثال: RRRD2929"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono uppercase focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">المدينة</label>
                    <input
                      type="text"
                      value={newEmp.city}
                      onChange={(e) => setNewEmp({ ...newEmp, city: e.target.value })}
                      placeholder="مثال: الرياض"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الحي</label>
                    <input
                      type="text"
                      value={newEmp.district}
                      onChange={(e) => setNewEmp({ ...newEmp, district: e.target.value })}
                      placeholder="مثال: حي العليا"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الشارع</label>
                    <input
                      type="text"
                      value={newEmp.street}
                      onChange={(e) => setNewEmp({ ...newEmp, street: e.target.value })}
                      placeholder="مثال: طريق الملك فهد"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">رقم المبنى (4 أرقام)</label>
                    <input
                      type="text"
                      value={newEmp.buildingNo}
                      onChange={(e) => setNewEmp({ ...newEmp, buildingNo: e.target.value })}
                      placeholder="2929"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الرمز البريدي (5 أرقام)</label>
                    <input
                      type="text"
                      value={newEmp.postalCode}
                      onChange={(e) => setNewEmp({ ...newEmp, postalCode: e.target.value })}
                      placeholder="12214"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الرقم الإضافي (4 أرقام)</label>
                    <input
                      type="text"
                      value={newEmp.additionalNo}
                      onChange={(e) => setNewEmp({ ...newEmp, additionalNo: e.target.value })}
                      placeholder="8118"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* 4. البريد الإلكتروني ومكان الميلاد */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-primary" />
                  رابعاً: البريد الإلكتروني (الرسمي والشخصي) ومكان الميلاد
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">البريد الإلكتروني المستخدم في النظام *</label>
                    <input
                      type="email"
                      value={newEmp.email}
                      onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                      placeholder="employee@company.com"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">البريد الإلكتروني الشخصي</label>
                    <input
                      type="email"
                      value={newEmp.personalEmail}
                      onChange={(e) => setNewEmp({ ...newEmp, personalEmail: e.target.value })}
                      placeholder="personal@gmail.com"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">مكان الميلاد</label>
                    <input
                      type="text"
                      value={newEmp.birthPlace}
                      onChange={(e) => setNewEmp({ ...newEmp, birthPlace: e.target.value })}
                      placeholder="مثال: الرياض / جدة / القاهرة"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 4: البيانات المالية (Financial Information)                  */}
          {/* ================================================================= */}
          {wizardStep === 4 && (
            <div className="space-y-4 py-3 text-xs">
              {/* الراتب الأساسي والفئة الوظيفية واسم الكفيل */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-primary" />
                  أولاً: الراتب الأساسي، البدلات القياسية، الفئة الوظيفية، والكفيل
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الراتب الأساسي (ر.س) *</label>
                    <input
                      type="number"
                      min={0}
                      value={newEmp.basicSalary}
                      onChange={(e) => {
                        const b = Math.max(0, Number(e.target.value));
                        const h = Math.round(b * 0.25);
                        const tr = Math.round(b * 0.1);
                        setNewEmp({
                          ...newEmp,
                          basicSalary: b,
                          housingAllowance: h,
                          transportAllowance: tr,
                          totalSalary: b + h + tr,
                        });
                      }}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">بدل السكن (ر.س)</label>
                    <input
                      type="number"
                      min={0}
                      value={newEmp.housingAllowance}
                      onChange={(e) => {
                        const h = Math.max(0, Number(e.target.value));
                        setNewEmp({
                          ...newEmp,
                          housingAllowance: h,
                          totalSalary: Number(newEmp.basicSalary) + h + Number(newEmp.transportAllowance),
                        });
                      }}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">بدل النقل (ر.س)</label>
                    <input
                      type="number"
                      min={0}
                      value={newEmp.transportAllowance}
                      onChange={(e) => {
                        const tr = Math.max(0, Number(e.target.value));
                        setNewEmp({
                          ...newEmp,
                          transportAllowance: tr,
                          totalSalary: Number(newEmp.basicSalary) + Number(newEmp.housingAllowance) + tr,
                        });
                      }}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">الفئة الوظيفية المالية</label>
                    <select
                      value={newEmp.jobCategory}
                      onChange={(e) => setNewEmp({ ...newEmp, jobCategory: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">اختر الفئة...</option>
                      <option value="الفئة التنفيذية العليا">الفئة التنفيذية العليا</option>
                      <option value="الفئة الأولى (إشرافية)">الفئة الأولى (إشرافية)</option>
                      <option value="الفئة الثانية (تخصصية)">الفئة الثانية (تخصصية)</option>
                      <option value="الفئة الثالثة (فنية وتشغيلية)">الفئة الثالثة (فنية وتشغيلية)</option>
                      <option value="الفئة الرابعة (مساندة)">الفئة الرابعة (مساندة)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">اسم الكفيل / المنشأة الكفيلة</label>
                    <input
                      type="text"
                      value={newEmp.sponsorName}
                      onChange={(e) => setNewEmp({ ...newEmp, sponsorName: e.target.value })}
                      placeholder="اسم الكفيل أو المنشأة"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* طريقة القبض وتفاصيل البنك وقفل البيانات البنكية */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-primary" />
                    ثانياً: طريقة صرف الراتب والبيانات البنكية (حماية الأجور WPS)
                  </h4>
                  <label className="inline-flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEmp.lockBankData}
                      onChange={(e) => setNewEmp({ ...newEmp, lockBankData: e.target.checked })}
                      className="rounded accent-amber-600 h-3.5 w-3.5"
                    />
                    <span>حظر تعديل البيانات البنكية بعد الحفظ</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">طريقة القبض *</label>
                    <select
                      value={newEmp.paymentMethod}
                      onChange={(e) =>
                        setNewEmp({
                          ...newEmp,
                          paymentMethod: e.target.value as "cash" | "bank" | "exchange",
                        })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="bank">تحويل بنكي (مدد / WPS)</option>
                      <option value="cash">نقدي (Cash)</option>
                      <option value="exchange">صرافة / حوالة مالية</option>
                    </select>
                  </div>

                  {newEmp.paymentMethod === "bank" && (
                    <>
                      <div className="space-y-1.5">
                        <label className="font-bold text-foreground">اسم البنك المعتمد</label>
                        <select
                          value={newEmp.bankName}
                          onChange={(e) => setNewEmp({ ...newEmp, bankName: e.target.value })}
                          className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <option value="">اختر البنك من التهيئة...</option>
                          <option value="مصرف الراجحي">مصرف الراجحي (Al Rajhi)</option>
                          <option value="البنك الأهلي السعودي (SNB)">البنك الأهلي السعودي (SNB)</option>
                          <option value="بنك الرياض">بنك الرياض (Riyad Bank)</option>
                          <option value="مصرف الإنماء">مصرف الإنماء (Alinma)</option>
                          <option value="البنك السعودي الأول (SAB)">البنك السعودي الأول (SAB)</option>
                          <option value="البنك العربي الوطني (ANB)">البنك العربي الوطني (ANB)</option>
                          <option value="بنك البلاد">بنك البلاد (Bank Albilad)</option>
                          <option value="بنك الجزيرة">بنك الجزيرة (Bank AlJazira)</option>
                          <option value="البنك السعودي الفرنسي">البنك السعودي الفرنسي (BSF)</option>
                          <option value="البنك السعودي للاستثمار">البنك السعودي للاستثمار (SAIB)</option>
                          <option value="STC Bank">بنك إس تي سي (STC Bank)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-foreground">حالة عمولة التحويل البنكي</label>
                        <select
                          value={newEmp.bankCommissionStatus}
                          onChange={(e) =>
                            setNewEmp({
                              ...newEmp,
                              bankCommissionStatus: e.target.value as "deducted" | "not_deducted",
                            })
                          }
                          className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <option value="not_deducted">لا تخصم العمولة من الموظف</option>
                          <option value="deducted">تخصم العمولة من الموظف</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-foreground">رقم الحساب البنكي</label>
                        <input
                          type="text"
                          value={newEmp.bankAccountNumber}
                          onChange={(e) =>
                            setNewEmp({ ...newEmp, bankAccountNumber: e.target.value })
                          }
                          placeholder="رقم الحساب المحلي"
                          className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-foreground">رقم الآيبان (IBAN)</label>
                        <input
                          type="text"
                          value={newEmp.iban}
                          onChange={(e) =>
                            setNewEmp({ ...newEmp, iban: e.target.value.toUpperCase() })
                          }
                          placeholder="SA00 0000 0000 0000 0000 0000"
                          className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono uppercase focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* الاستحقاقات والاستقطاعات الديناميكية */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* الاستحقاقات الإضافية */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-emerald-700 text-xs">
                      ثالثاً: الاستحقاقات والبدلات الإضافية
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setNewEmp({
                          ...newEmp,
                          customAllowances: [
                            ...newEmp.customAllowances,
                            { id: `alw-${Date.now()}`, name: "بدل طبيعة عمل", amount: 500 },
                          ],
                        })
                      }
                      className="h-7 rounded-xl text-[11px] font-bold border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10"
                    >
                      + إضافة استحقاق
                    </Button>
                  </div>
                  {newEmp.customAllowances.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-2">
                      لا توجد بدلات إضافية غير السكن والنقل. اضغط «+ إضافة استحقاق» لإدراج بدل جديد.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {newEmp.customAllowances.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              const next = [...newEmp.customAllowances];
                              next[idx] = { ...item, name: e.target.value };
                              setNewEmp({ ...newEmp, customAllowances: next });
                            }}
                            placeholder="مسمى الاستحقاق"
                            className="flex-1 h-9 rounded-xl border border-border/80 bg-card px-2.5 text-xs font-semibold"
                          />
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => {
                              const next = [...newEmp.customAllowances];
                              next[idx] = { ...item, amount: Math.max(0, Number(e.target.value)) };
                              setNewEmp({ ...newEmp, customAllowances: next });
                            }}
                            placeholder="المبلغ"
                            className="w-28 h-9 rounded-xl border border-border/80 bg-card px-2.5 text-xs font-mono font-bold"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setNewEmp({
                                ...newEmp,
                                customAllowances: newEmp.customAllowances.filter(
                                  (_, i) => i !== idx,
                                ),
                              })
                            }
                            className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center hover:bg-rose-500/20"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* الاستقطاعات الشهرية */}
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-rose-700 text-xs">
                      رابعاً: الاستقطاعات والحسميات الثابتة
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setNewEmp({
                          ...newEmp,
                          customDeductions: [
                            ...newEmp.customDeductions,
                            { id: `ded-${Date.now()}`, name: "تأمينات / قسط سلفة", amount: 250 },
                          ],
                        })
                      }
                      className="h-7 rounded-xl text-[11px] font-bold border-rose-500/40 text-rose-700 hover:bg-rose-500/10"
                    >
                      + إضافة استقطاع
                    </Button>
                  </div>
                  {newEmp.customDeductions.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-2">
                      لا توجد استقطاعات ثابتة مسجلة. اضغط «+ إضافة استقطاع» لإدراج حسم شهري.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {newEmp.customDeductions.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              const next = [...newEmp.customDeductions];
                              next[idx] = { ...item, name: e.target.value };
                              setNewEmp({ ...newEmp, customDeductions: next });
                            }}
                            placeholder="مسمى الاستقطاع"
                            className="flex-1 h-9 rounded-xl border border-border/80 bg-card px-2.5 text-xs font-semibold"
                          />
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => {
                              const next = [...newEmp.customDeductions];
                              next[idx] = { ...item, amount: Math.max(0, Number(e.target.value)) };
                              setNewEmp({ ...newEmp, customDeductions: next });
                            }}
                            placeholder="المبلغ"
                            className="w-28 h-9 rounded-xl border border-border/80 bg-card px-2.5 text-xs font-mono font-bold"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setNewEmp({
                                ...newEmp,
                                customDeductions: newEmp.customDeductions.filter(
                                  (_, i) => i !== idx,
                                ),
                              })
                            }
                            className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center hover:bg-rose-500/20"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ملخص صافي الراتب الفوري */}
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground font-bold block">
                    صافي الراتب الشهري الإجمالي (شامل البدلات ناقص الاستقطاعات)
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    أساسي: {Number(newEmp.basicSalary || 0).toLocaleString()} ر.س + سكن ونقل:{" "}
                    {(
                      Number(newEmp.housingAllowance || 0) + Number(newEmp.transportAllowance || 0)
                    ).toLocaleString()}{" "}
                    ر.س
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-primary">
                  {Math.max(
                    0,
                    Number(newEmp.basicSalary || 0) +
                      Number(newEmp.housingAllowance || 0) +
                      Number(newEmp.transportAllowance || 0) +
                      newEmp.customAllowances.reduce((a, c) => a + (Number(c.amount) || 0), 0) -
                      newEmp.customDeductions.reduce((a, c) => a + (Number(c.amount) || 0), 0),
                  ).toLocaleString()}{" "}
                  ر.س
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 5: العقود والإنهاء (Contracts & Completion)                  */}
          {/* ================================================================= */}
          {wizardStep === 5 && (
            <div className="space-y-4 py-3 text-xs">
              {/* أولاً: تفاصيل العقد وربطه بالإجازات وتاريخ النهاية */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    أولاً: تفاصيل العقد الأساسية وربط الإجازات السنوية
                  </h4>
                  {newEmp.contractDurationType === "ajeer" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold bg-amber-500/10 text-amber-700 border-amber-400"
                    >
                      نظام أجير: لا يستحق إجازات سنوية
                    </Badge>
                  )}
                  {newEmp.contractDurationType === "indefinite" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold bg-blue-500/10 text-blue-700 border-blue-400"
                    >
                      عقد غير محدد المدة: بدون تاريخ نهاية
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">نوع العقد (حسب التهيئة) *</label>
                    <select
                      value={newEmp.contractDurationType}
                      onChange={(e) => {
                        const dur = e.target.value as
                          | "fixed_term"
                          | "indefinite"
                          | "ajeer"
                          | "part_time"
                          | "seasonal";
                        setNewEmp({
                          ...newEmp,
                          contractDurationType: dur,
                          contractType:
                            dur === "ajeer"
                              ? "contractor"
                              : dur === "part_time"
                                ? "part_time"
                                : "full_time",
                          contractEndDate: dur === "indefinite" ? "" : newEmp.contractEndDate,
                          contractAnnualLeaveDays:
                            dur === "ajeer" ? 0 : newEmp.contractAnnualLeaveDays || 21,
                          annualLeavePolicy:
                            dur === "ajeer"
                              ? "غير متاح (عقد أجير بدون إجازة سنوية)"
                              : "لائحة العمل القياسية (21 يوماً)",
                        });
                      }}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="fixed_term">عقد محدد المدة</option>
                      <option value="indefinite">عقد غير محدد المدة</option>
                      <option value="ajeer">عقد أجير (Ajeer)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">رقم العقد الموحد (قوى)</label>
                    <input
                      type="text"
                      value={newEmp.qiwaContractNo}
                      onChange={(e) => setNewEmp({ ...newEmp, qiwaContractNo: e.target.value })}
                      placeholder="مثال: QW-2026-98412"
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">تاريخ بداية العقد *</label>
                    <input
                      type="date"
                      value={newEmp.contractStartDate || newEmp.hireDate}
                      onChange={(e) => setNewEmp({ ...newEmp, contractStartDate: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">
                      تاريخ نهاية العقد{" "}
                      {newEmp.contractDurationType === "indefinite" && "(غير متاح)"}
                    </label>
                    <input
                      type="date"
                      disabled={newEmp.contractDurationType === "indefinite"}
                      value={
                        newEmp.contractDurationType === "indefinite" ? "" : newEmp.contractEndDate
                      }
                      onChange={(e) => setNewEmp({ ...newEmp, contractEndDate: e.target.value })}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono disabled:opacity-50 disabled:cursor-not-allowed focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">
                      استحقاق الإجازة السنوية{" "}
                      {newEmp.contractDurationType === "ajeer" && "(محظور لأجير)"}
                    </label>
                    <select
                      disabled={newEmp.contractDurationType === "ajeer"}
                      value={
                        newEmp.contractDurationType === "ajeer"
                          ? 0
                          : newEmp.contractAnnualLeaveDays
                      }
                      onChange={(e) => {
                        const days = Number(e.target.value);
                        setNewEmp({
                          ...newEmp,
                          contractAnnualLeaveDays: days,
                          annualLeavePolicy:
                            days === 30
                              ? "لائحة العمل المتقدمة (30 يوماً)"
                              : days === 21
                                ? "لائحة العمل القياسية (21 يوماً)"
                                : `${days} يوماً سنوياً`,
                        });
                      }}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {newEmp.contractDurationType === "ajeer" ? (
                        <option value={0}>0 يوم — نظام أجير لا يمنح إجازة سنوية</option>
                      ) : (
                        <>
                          <option value={21}>21 يوماً سنوياً (الحد الأدنى النظامي)</option>
                          <option value={30}>30 يوماً سنوياً (بعد 5 سنوات أو بالاتفاق)</option>
                          <option value={25}>25 يوماً سنوياً</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* ثانياً وثالثاً: تنظيم أوقات العمل وتنظيم الإجازات والراحة الأسبوعية */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  ثانياً وثالثاً: تنظيم أوقات العمل والربط التلقائي لأيام الراحة الأسبوعية
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">نوع الدوام</label>
                    <select
                      value={newEmp.contractWorkPattern}
                      onChange={(e) => {
                        const pat = e.target.value as
                          | "full_time"
                          | "part_time"
                          | "remote"
                          | "voluntary";
                        setNewEmp({
                          ...newEmp,
                          contractWorkPattern: pat,
                          workType: pat === "remote" ? "remote" : "on_site",
                        });
                      }}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="full_time">دوام كلي</option>
                      <option value="part_time">دوام جزئي</option>
                      <option value="remote">عمل عن بعد</option>
                      <option value="voluntary">عمل تطوعي</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">نطاق نظام العمل</label>
                    <select
                      value={newEmp.workJurisdiction}
                      onChange={(e) =>
                        setNewEmp({
                          ...newEmp,
                          workJurisdiction: e.target.value as "inside_kingdom" | "outside_kingdom",
                        })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="inside_kingdom">نظام العمل داخل المملكة</option>
                      <option value="outside_kingdom">خارج المملكة</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">أيام العمل الأسبوعية</label>
                    <select
                      value={newEmp.weeklyWorkDays}
                      onChange={(e) => {
                        const workDays = Math.min(7, Math.max(1, Number(e.target.value)));
                        setNewEmp({
                          ...newEmp,
                          weeklyWorkDays: workDays,
                          weeklyRestDays: Math.max(0, 7 - workDays),
                        });
                      }}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value={5}>5 أيام عمل أسبوعياً</option>
                      <option value={6}>6 أيام عمل أسبوعياً</option>
                      <option value={4}>4 أيام عمل أسبوعياً</option>
                      <option value={3}>3 أيام عمل أسبوعياً</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-emerald-700">
                      أيام الراحة الأسبوعية (تلقائي)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`${Math.max(0, 7 - Number(newEmp.weeklyWorkDays || 5))} أيام راحة أسبوعية`}
                      className="w-full h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-800 px-3 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">معيار ساعات العمل</label>
                    <select
                      value={newEmp.workHoursStandard}
                      onChange={(e) => {
                        const std = e.target.value as "daily" | "weekly";
                        setNewEmp({
                          ...newEmp,
                          workHoursStandard: std,
                          standardWorkHoursCount: std === "daily" ? 8 : 40,
                        });
                      }}
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="daily">يومي</option>
                      <option value="weekly">أسبوعي</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">
                      عدد الساعات ({newEmp.workHoursStandard === "daily" ? "يومياً" : "أسبوعياً"})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={newEmp.standardWorkHoursCount}
                      onChange={(e) =>
                        setNewEmp({
                          ...newEmp,
                          standardWorkHoursCount: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-full h-10 rounded-xl border border-border/80 bg-muted/30 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* رابعاً: بنود العقد (منصة قوى) ومرفق العقد والتجديد التلقائي */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    رابعاً: بنود العقد المعتمدة (منصة قوى) والمرفقات
                  </h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setNewEmp({
                        ...newEmp,
                        qiwaContractClauses:
                          "البند الأول: يلتزم الطرف الثاني (الموظف) بأداء مهام وظيفته بأمانة وإخلاص وفق لوائح العمل المعتمدة في المملكة العربية السعودية ومنصة قوى.\nالبند الثاني: يخضع الموظف لفترة تجربة مدتها (" +
                          newEmp.probationDays +
                          " يوماً) تبدأ من تاريخ المباشرة الفعلية.\nالبند الثالث: يلتزم الطرف الثاني بالحفاظ على سرية المعلومات والبيانات الخاصة بالمنشأة وعدم إفشائها.\nالبند الرابع: تحدد أيام الراحة الأسبوعية بـ (" +
                          Math.max(0, 7 - Number(newEmp.weeklyWorkDays || 5)) +
                          " يوم) مدفوعة الأجر.",
                      })
                    }
                    className="h-8 rounded-xl text-[11px] font-bold border-primary/40 text-primary hover:bg-primary/10"
                  >
                    استيراد بنود العقد القياسية من منصة قوى
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">
                      بنود العقد الإضافية والخاصة (تدرج في وثيقة العقد)
                    </label>
                    <textarea
                      rows={4}
                      value={newEmp.qiwaContractClauses}
                      onChange={(e) =>
                        setNewEmp({ ...newEmp, qiwaContractClauses: e.target.value })
                      }
                      placeholder="اكتب بنود العقد أو اضغط «استيراد بنود العقد القياسية من منصة قوى»..."
                      className="w-full rounded-xl border border-border/80 bg-muted/30 p-3 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-foreground">ملاحظات العقد</label>
                      <textarea
                        rows={2}
                        value={newEmp.contractNotes}
                        onChange={(e) => setNewEmp({ ...newEmp, contractNotes: e.target.value })}
                        placeholder="أي ملاحظات إدارية أو تنظيمية إضافية على العقد..."
                        className="w-full rounded-xl border border-border/80 bg-muted/30 p-2.5 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>

                    {/* مرفق العقد والتجديد التلقائي */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary font-bold text-xs cursor-pointer hover:bg-primary/10 transition-colors">
                        <FileText className="h-4 w-4" />
                        <span>
                          {newEmp.contractAttachmentName
                            ? `المرفق: ${newEmp.contractAttachmentName}`
                            : "رفع مرفق العقد (PDF / صورة)"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setNewEmp((prev) => ({
                              ...prev,
                              contractAttachmentName: file.name,
                            }));
                          }}
                        />
                      </label>

                      <label className="inline-flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newEmp.contractAutoRenew}
                          disabled={newEmp.contractDurationType === "indefinite"}
                          onChange={(e) =>
                            setNewEmp({ ...newEmp, contractAutoRenew: e.target.checked })
                          }
                          className="rounded accent-primary h-4 w-4"
                        />
                        <span>تجديد العقد تلقائياً بعد انتهاء مدته</span>
                      </label>
                    </div>
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
              {wizardStep < 5 ? (
                <Button
                  size="sm"
                  onClick={() => setWizardStep((prev) => prev + 1)}
                  className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-10 shadow-xs cursor-pointer"
                >
                  التالي (الخطوة {wizardStep + 1})
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleCreateEmployee}
                  className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-10 shadow-xs cursor-pointer gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  إنهاء وحفظ وفتح ملف الموظف 360°
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
