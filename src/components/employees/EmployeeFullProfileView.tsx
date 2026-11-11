import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../lib/context/AppContext";
import {
  canAccessModule,
  canEditHrProfile,
  canEditAssignment,
  canEditPayroll,
  canEditBank,
  canChangeLifecycle,
  canManageDocuments,
} from "../../lib/auth/permissions";
import {
  isStorageInDemoMode,
  uploadSecureFile,
  createSignedDownloadUrl,
  deleteStorageFile,
  rollbackUploadedFile,
} from "../../lib/storage/storage-service";
import { useEmployee, useEmployeeAvatar } from "../../lib/domains/employees";
import { transliterateArabicName } from "../../lib/utils/arabic-transliteration";
import type { Employee, ContractType, Gender, MaritalStatus } from "../../types";
import {
  fetchMovementsList,
  fetchEmployeeAssignmentHistoryList,
} from "../../lib/data/movements-repository";
import type { EmployeeMovement, EmployeeAssignmentHistory } from "../../lib/domains/movements";
import { IconSymbol } from "../ui/IconSymbol";
import { OfficialDocumentModal, type DocType } from "../documents/OfficialDocumentModal";
import {
  Users,
  User,
  Mail,
  Phone,
  CreditCard,
  Building,
  Briefcase,
  Calendar,
  FileText,
  DollarSign,
  Shield,
  Printer,
  Edit,
  Save,
  X,
  Eye,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Download,
  Share2,
  Clock,
  MapPin,
  Award,
  GraduationCap,
  Laptop,
  Home,
  HeartPulse,
  Globe,
  BadgeCheck,
  AlertTriangle,
  Layers,
  ArrowRight,
  UserX,
  Camera,
  Upload,
  Image as ImageIcon,
  Check,
  Plus,
  Trash2,
  GitCommit,
  ChevronLeft,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

interface EmployeeFullProfileViewProps {
  employeeId: string;
  onBack: () => void;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300&auto=format&fit=crop&q=80",
];

export const EmployeeFullProfileView: React.FC<EmployeeFullProfileViewProps> = ({
  employeeId,
  onBack,
}) => {
  const {
    employees,
    orgUnits,
    subsidiaries,
    workLocations,
    leaveBalances,
    requests,
    updateEmployee,
    isSaving,
    currentRole,
    language,
    t,
  } = useApp();

  // Authoritative 360 query (never fall back to employees.find((e) => e.id === employeeId) || null)
  const { employee, isLoading: isEmployeeLoading } = useEmployee(employeeId);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({});

  // Avatar Changer Modal state
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document Modal state
  const [docModalType, setDocModalType] = useState<DocType | null>(null);

  // Employee Career Movements & Lifecycle History
  const [empMovements, setEmpMovements] = useState<EmployeeMovement[]>([]);
  const [empAssignments, setEmpAssignments] = useState<EmployeeAssignmentHistory[]>([]);

  useEffect(() => {
    if (employee?.companyId && employee?.id) {
      Promise.all([
        fetchMovementsList(employee.companyId, { employeeId: employee.id }),
        fetchEmployeeAssignmentHistoryList(employee.companyId, employee.id),
      ])
        .then(([movs, assigns]) => {
          setEmpMovements(movs);
          setEmpAssignments(assigns);
        })
        .catch(() => {});
    }
  }, [employee?.companyId, employee?.id]);

  const resolvedAvatarUrl = useEmployeeAvatar(
    formData.avatarStoragePath || employee?.avatarStoragePath,
    formData.avatarUrl || employee?.avatarUrl,
  );

  // Sync formData when employee changes
  useEffect(() => {
    if (employee) {
      const dynamicYears = employee.hireDate
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(employee.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
            ),
          )
        : (employee.yearsOfService ?? 0);

      setFormData({
        employeeNo: employee.employeeNo || "",
        biometricId: employee.biometricId || "",
        identityType: employee.identityType || "national_id",
        religion: employee.religion || "مسلم",
        birthPlace: employee.birthPlace || "",
        avatarUrl: employee.avatarUrl,
        avatarStoragePath: employee.avatarStoragePath,
        firstNameAr: employee.firstNameAr,
        lastNameAr: employee.lastNameAr,
        firstNameEn: employee.firstNameEn || "",
        lastNameEn: employee.lastNameEn || "",
        nationalIdOrIqama: employee.nationalIdOrIqama,
        nationalIdExpiry: employee.nationalIdExpiry || "",
        passportNo: employee.passportNo || "",
        passportExpiry: employee.passportExpiry || "",
        nationality: employee.nationality,
        birthDate: employee.birthDate,
        gender: employee.gender,
        maritalStatus: employee.maritalStatus,
        bloodType: employee.bloodType || "",
        dependentsCount: employee.dependentsCount || 0,
        email: employee.email,
        personalEmail: employee.personalEmail || "",
        phone: employee.phone || "",
        secondaryPhone: employee.secondaryPhone || "",
        workPhone: employee.workPhone || "",
        currentResidenceAddress: employee.currentResidenceAddress || "",
        shortNationalAddress: employee.shortNationalAddress || "",
        homeCountryAddress: employee.homeCountryAddress,
        region: employee.region || "",
        mainDepartment: employee.mainDepartment || "",
        careerTrack: employee.careerTrack || "",
        sector: employee.sector || "",
        currentRoleName: employee.currentRoleName || "",
        specialization: employee.specialization || "",
        joiningDate: employee.joiningDate || employee.hireDate || "",
        annualLeaveCalculation: employee.annualLeaveCalculation || "من تاريخ المباشرة",
        experienceYears: employee.experienceYears ?? 0,
        probationDays: employee.probationDays ?? 90,
        kingdomEntryDate: employee.kingdomEntryDate || "",
        highestQualification: employee.highestQualification || employee.educationDegree || "",
        shiftId: employee.shiftId || "",
        departmentId: employee.departmentId,
        departmentName: employee.departmentName,
        subsidiaryId: employee.subsidiaryId,
        subsidiaryName: employee.subsidiaryName,
        jobTitleAr: employee.jobTitleAr,
        jobTitleEn: employee.jobTitleEn || "",
        jobGrade: employee.jobGrade || "",
        costCenter: employee.costCenter || "",
        workType: employee.workType || "on_site",
        workLocationId: employee.workLocationId,
        workLocationName: employee.workLocationName,
        hireDate: employee.hireDate,
        contractStartDate: employee.contractStartDate || employee.hireDate,
        contractEndDate: employee.contractEndDate || "",
        qiwaContractNo: employee.qiwaContractNo || "",
        contractDurationType: employee.contractDurationType || "fixed_term",
        contractAnnualLeaveDays: employee.contractAnnualLeaveDays ?? 21,
        annualLeavePolicy: employee.annualLeavePolicy || "لائحة العمل القياسية (21 يوماً)",
        contractWorkPattern: employee.contractWorkPattern || "full_time",
        workJurisdiction: employee.workJurisdiction || "inside_kingdom",
        weeklyWorkDays: employee.weeklyWorkDays ?? 5,
        weeklyRestDays: employee.weeklyRestDays ?? 2,
        workHoursStandard: employee.workHoursStandard || "daily",
        standardWorkHoursCount: employee.standardWorkHoursCount ?? 8,
        qiwaContractClauses: employee.qiwaContractClauses || "",
        contractAttachmentName: employee.contractAttachmentName || "",
        contractNotes: employee.contractNotes || "",
        contractAutoRenew: employee.contractAutoRenew ?? true,
        yearsOfService: dynamicYears,
        contractType: employee.contractType,
        status: employee.status,
        basicSalary: employee.basicSalary,
        housingAllowance: employee.housingAllowance ?? 0,
        transportAllowance: employee.transportAllowance ?? 0,
        otherAllowances: employee.otherAllowances ?? 0,
        totalSalary: employee.totalSalary,
        jobCategory: employee.jobCategory || "",
        sponsorName: employee.sponsorName || "",
        paymentMethod: employee.paymentMethod || "bank",
        bankName: employee.bankName || "",
        bankCommissionStatus: employee.bankCommissionStatus || "not_deducted",
        bankAccountNumber: employee.bankAccountNumber || "",
        iban: employee.iban || "",
        lockBankData: Boolean(employee.lockBankData),
        customAllowances: employee.customAllowances || [],
        customDeductions: employee.customDeductions || [],
        gosiNumber: employee.gosiNumber || "",
        managerId: employee.managerId,
        managerName: employee.managerName,
        educationDegree: employee.educationDegree || employee.highestQualification || "",
        university: employee.university || "",
        graduationYear: employee.graduationYear,
        certifications: employee.certifications || [],
        languages: employee.languages || [],
        nationalAddress: employee.nationalAddress,
        emergencyContact: employee.emergencyContact,
      });
      setIsEditing(false);
    }
  }, [employee]);

  if (isEmployeeLoading && !employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center space-y-4">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-semibold">
          جاري استرجاع السجل الموحد للموظف...
        </p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
          <UserX className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-black text-foreground">الموظف المطلوب غير موجود</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            لم يتم العثور على سجل للموظف بالمعرّف المحدد ضمن نطاق صلاحيات المنشأة الحالية.
          </p>
        </div>
        <Button
          onClick={onBack}
          variant="outline"
          className="rounded-full text-xs font-bold gap-2 cursor-pointer mt-2"
        >
          <ArrowRight className="h-4 w-4" />
          العودة لدليل الموظفين
        </Button>
      </div>
    );
  }

  const canEditHr = canEditHrProfile(currentRole);
  const canEditAssign = canEditAssignment(currentRole);
  const canEditPay = canEditPayroll(currentRole);
  const canEditBnk = canEditBank(currentRole);
  const canEditLifecycle = canChangeLifecycle(currentRole);
  const canEdit = canEditHr || canEditAssign || canEditPay || canEditBnk;
  const canViewPayroll = canAccessModule(currentRole, "payroll");
  const maskIban = (iban?: string) => {
    if (!iban) return "غير مسجل";
    const clean = iban.replace(/\s+/g, "");
    if (clean.length < 8) return "••••••••";
    return `${clean.slice(0, 4)} •••• •••• ${clean.slice(-4)}`;
  };

  const empLeaveBalance = employee ? leaveBalances.find((b) => b.employeeId === employee.id) || null : null;

  const empRequests = employee ? requests.filter((r) => r.requesterId === employee.id) : [];

  // File Upload for Avatar
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن لا يتجاوز 5 ميغابايت");
      return;
    }
    const validMimes = ["image/png", "image/jpeg", "image/webp"];
    if (!validMimes.includes(file.type)) {
      toast.error("صيغة الملف غير مدعومة. يرجى اختيار صورة بصيغة PNG أو JPG أو WebP");
      return;
    }

    try {
      let finalAvatarUrl: string;
      let newStoragePath: string | null = null;

      if (isStorageInDemoMode()) {
        finalAvatarUrl = URL.createObjectURL(file);
        const saved = await updateEmployee(employee.id, {
          avatarUrl: finalAvatarUrl,
          avatarStoragePath: newStoragePath,
        });
        if (saved) {
          setFormData((prev) => ({
            ...prev,
            avatarUrl: finalAvatarUrl,
            avatarStoragePath: newStoragePath,
          }));
          setIsAvatarModalOpen(false);
          toast.success("تم تحديث صورة البروفايل بنجاح!");
        }
      } else {
        const fileExt = file.name.split(".").pop() || "png";
        const objectPath = `${employee.companyId || "org"}/${employee.id}/avatar-${Date.now()}.${fileExt}`;

        // 1. Upload new file and register metadata in file_objects
        const uploadedFile = await uploadSecureFile({
          bucket: "employee-avatars",
          objectPath,
          file,
          originalFilename: file.name,
          contentType: file.type,
          entityType: "employee_avatar",
          entityId: employee.id,
          employeeId: employee.id,
          companyId: employee.companyId,
        });
        newStoragePath = objectPath;

        // 2. Persist avatar_storage_path to employee record (do not persist temporary signed URL)
        const oldStoragePath = employee.avatarStoragePath;
        let saved = false;
        try {
          saved = await updateEmployee(employee.id, {
            avatarStoragePath: newStoragePath,
          });
        } catch (updateErr) {
          await rollbackUploadedFile({
            fileId: uploadedFile?.id,
            bucket: "employee-avatars",
            objectPath: newStoragePath,
            reason: "avatar_update_failed",
          });
          throw updateErr;
        }

        if (!saved) {
          await rollbackUploadedFile({
            fileId: uploadedFile?.id,
            bucket: "employee-avatars",
            objectPath: newStoragePath,
            reason: "avatar_update_failed",
          });
          throw new Error("فشل حفظ مسار الصورة الرمزية في قاعدة البيانات");
        }

        // 3. Confirm commit before deleting old file
        if (employee.avatarStoragePath && employee.avatarStoragePath !== newStoragePath) {
          try {
            await deleteStorageFile("employee-avatars", employee.avatarStoragePath);
          } catch (delErr) {
            console.warn("Failed to delete previous avatar file:", delErr);
            await rollbackUploadedFile({
              bucket: "employee-avatars",
              objectPath: employee.avatarStoragePath,
              reason: "old_avatar_replaced",
            });
          }
        }

        // Generate short-lived signed URL for immediate local preview
        try {
          const signed = await createSignedDownloadUrl("employee-avatars", newStoragePath, {
            expiresInSeconds: 3600,
          });
          finalAvatarUrl = signed.signedUrl;
        } catch {
          finalAvatarUrl = "";
        }

        setFormData((prev) => ({
          ...prev,
          avatarUrl: finalAvatarUrl || prev.avatarUrl,
          avatarStoragePath: newStoragePath,
        }));
        setIsAvatarModalOpen(false);
        toast.success("تم تحديث صورة البروفايل بنجاح!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل رفع الصورة";
      toast.error(msg);
    }
  };

  const handleSelectPresetAvatar = async (url: string) => {
    if (isSaving || !employee) return;
    const saved = await updateEmployee(employee.id, { avatarUrl: url });
    if (!saved) return;
    setFormData((prev) => ({ ...prev, avatarUrl: url }));
    setIsAvatarModalOpen(false);
    toast.success("تم تعيين الصورة الرمزية للموظف بنجاح!");
  };

  const handleSaveCustomAvatarUrl = async () => {
    if (!customAvatarUrl.trim() || isSaving || !employee) return;
    const saved = await updateEmployee(employee.id, { avatarUrl: customAvatarUrl });
    if (!saved) return;
    setFormData((prev) => ({ ...prev, avatarUrl: customAvatarUrl }));
    setIsAvatarModalOpen(false);
    setCustomAvatarUrl("");
    toast.success("تم تحديث رابط الصورة بنجاح!");
  };

  const handleSaveChanges = async () => {
    if (isSaving || !employee) return;
    if (!formData.firstNameAr || !formData.lastNameAr || !formData.email) {
      toast.error("يرجى التأكد من استكمال الحقول الأساسية");
      return;
    }

    const basic = Number(formData.basicSalary) || employee.basicSalary;
    const housing = Number(formData.housingAllowance) || Math.round(basic * 0.25);
    const transport = Number(formData.transportAllowance) || Math.round(basic * 0.08);
    const other = Number(formData.otherAllowances) || 0;
    const total = basic + housing + transport + other;

    const selectedDept = orgUnits.find((u) => u.id === formData.departmentId);
    const selectedSub = subsidiaries.find((s) => s.id === formData.subsidiaryId);
    const selectedLoc = workLocations.find((l) => l.id === formData.workLocationId);
    const selectedMgr = employees.find((e) => e.id === formData.managerId);

    const isSaudi = formData.nationality === "سعودي" || formData.nationality === "سعودية";
    const gosiEmp = isSaudi ? Math.round(basic * 0.0975) : 0;
    const gosiComp = isSaudi ? Math.round(basic * 0.1175) : Math.round(basic * 0.02);

    const updates: Partial<Employee> = {
      ...formData,
      basicSalary: basic,
      housingAllowance: housing,
      transportAllowance: transport,
      otherAllowances: other,
      totalSalary: total,
      gosiEmployeeDeduction: gosiEmp,
      gosiEmployerContribution: gosiComp,
      departmentName: selectedDept?.nameAr || formData.departmentName || employee.departmentName,
      subsidiaryName: selectedSub?.nameAr || formData.subsidiaryName || employee.subsidiaryName,
      workLocationName:
        selectedLoc?.nameAr || formData.workLocationName || employee.workLocationName,
      managerName: selectedMgr
        ? `${selectedMgr.firstNameAr} ${selectedMgr.lastNameAr}`
        : formData.managerName || employee.managerName,
    };

    const saved = await updateEmployee(employee.id, updates);
    if (!saved) return;
    toast.success(`تم حفظ وتحديث ملف الموظف (${updates.firstNameAr} ${updates.lastNameAr}) بنجاح!`);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <Button
            onClick={onBack}
            variant="outline"
            size="sm"
            className="rounded-full text-xs font-bold gap-2 border-border/80 hover:bg-secondary h-9 px-4 shadow-xs"
          >
            <ArrowRight className="h-4 w-4 text-primary" />
            العودة إلى دليل الموظفين
          </Button>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <span>دليل الموظفين</span>
            <span>/</span>
            <span>الملف الموحد 360°</span>
            <span>/</span>
            <span className="font-bold text-foreground">
              {employee.firstNameAr} {employee.lastNameAr}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSaveChanges}
                    className="rounded-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-9 shadow-xs"
                  >
                    <Save className="h-4 w-4" />
                    حفظ التعديلات
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="rounded-full text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary px-4 h-9"
                  >
                    <X className="h-4 w-4" />
                    إلغاء
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-5 h-9 shadow-xs"
                >
                  <Edit className="h-4 w-4" />
                  تعديل بيانات الموظف
                </Button>
              )}
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setDocModalType("salary_certificate")}
            className="rounded-full text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary px-4 h-9 shadow-xs"
          >
            <Printer className="h-4 w-4 text-primary" />
            شهادة راتب (A4)
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setDocModalType("employment_contract")}
            className="rounded-full text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary px-4 h-9 shadow-xs"
          >
            <FileText className="h-4 w-4 text-emerald-600" />
            عقد قوى
          </Button>
        </div>
      </div>

      {/* Hero Profile Card with Avatar Changer */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Avatar & Key Info */}
          <div className="flex items-center gap-5">
            <div
              className="relative group cursor-pointer"
              onClick={() => setIsAvatarModalOpen(true)}
            >
              {resolvedAvatarUrl || formData.avatarUrl || employee.avatarUrl ? (
                <img
                  src={resolvedAvatarUrl || formData.avatarUrl || employee.avatarUrl}
                  alt={employee.firstNameAr}
                  className="h-24 w-24 rounded-full border-4 border-card object-cover shadow-md ring-4 ring-primary/20 group-hover:opacity-80 transition-all"
                />
              ) : (
                <div
                  className="h-24 w-24 rounded-full border-4 border-card bg-primary/10 text-primary font-black text-2xl flex items-center justify-center shadow-md ring-4 ring-primary/20 group-hover:opacity-80 transition-all select-none"
                  aria-label={employee.firstNameAr}
                >
                  {(employee.firstNameAr || "م").slice(0, 2)}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6" />
                <span className="text-[9px] font-bold mt-1">تغيير الصورة</span>
              </div>
              <div
                className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-card ${
                  employee.status === "active"
                    ? "bg-emerald-500"
                    : employee.status === "probation"
                      ? "bg-amber-500"
                      : "bg-blue-500"
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-black text-foreground">
                  {language === "ar"
                    ? `${formData.firstNameAr || employee.firstNameAr} ${formData.lastNameAr || employee.lastNameAr}`
                    : `${formData.firstNameEn || employee.firstNameEn} ${formData.lastNameEn || employee.lastNameEn}`}
                </h2>
                <Badge
                  variant="outline"
                  className={`text-[11px] rounded-full px-3 py-0.5 font-bold ${
                    employee.status === "active"
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                      : employee.status === "probation"
                        ? "bg-amber-500/10 text-amber-700 border-amber-300"
                        : "bg-blue-500/10 text-blue-700 border-blue-300"
                  }`}
                >
                  {employee.status === "active"
                    ? "نشط على رأس العمل"
                    : employee.status === "probation"
                      ? "فترة التجربة"
                      : "في إجازة رسمية"}
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-[11px] rounded-full px-3 py-0.5 font-bold"
                >
                  {formData.jobGrade || employee.jobGrade || "غير محدد"}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[11px] rounded-full px-3 py-0.5 font-bold border-primary/30 text-primary"
                >
                  {formData.workType === "remote"
                    ? "🌐 عمل عن بعد"
                    : formData.workType === "hybrid"
                      ? "💼 عمل هجين"
                      : "🏢 حضور مكتبي"}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground font-medium">
                {formData.jobTitleAr || employee.jobTitleAr} •{" "}
                {formData.departmentName || employee.departmentName} •{" "}
                <span className="font-mono font-bold text-foreground">{employee.employeeNo}</span> •{" "}
                <span className="text-primary font-bold">
                  {formData.costCenter || employee.costCenter || "غير محدد"}
                </span>
              </p>

              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {formData.workLocationName || employee.workLocationName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  {formData.email || employee.email}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  {formData.phone || employee.phone}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Photo Upload Trigger Button */}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAvatarModalOpen(true)}
              className="rounded-full text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary h-9 px-3.5"
            >
              <Camera className="h-3.5 w-3.5 text-primary" />
              تغيير الصورة الرمزية
            </Button>
          </div>
        </div>

        {/* 5 KPI Metric Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-border/60">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs">
            <span className="text-muted-foreground font-bold">الراتب الأساسي</span>
            <p className="text-base font-black text-foreground mt-0.5 font-mono">
              {(Number(formData.basicSalary) || employee.basicSalary).toLocaleString()} ر.س
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs">
            <span className="text-muted-foreground font-bold">الراتب الإجمالي الشهري</span>
            <p className="text-base font-black text-primary mt-0.5 font-mono">
              {(Number(formData.totalSalary) || employee.totalSalary).toLocaleString()} ر.س
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs">
            <span className="text-muted-foreground font-bold">رصيد الإجازات المتاح</span>
            <p className="text-base font-black text-emerald-600 mt-0.5 font-mono">
              {empLeaveBalance ? `${empLeaveBalance.availableBalance} يوم` : "غير مسجل"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs">
            <span className="text-muted-foreground font-bold">سنوات الخدمة في الشركة</span>
            <p className="text-base font-bold text-foreground mt-0.5 font-mono">
              {employee.hireDate ? Math.max(0, Math.floor((Date.now() - new Date(employee.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))) : (employee.yearsOfService ?? 0)} سنة
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs col-span-2 sm:col-span-1">
            <span className="text-muted-foreground font-bold">اكتمال الملف 360°</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${employee.completionScore}%` }}
                />
              </div>
              <span className="text-xs font-black text-foreground font-mono">
                {employee.completionScore}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive 7-Tab Content */}
      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="grid grid-cols-7 w-full bg-muted/60 p-1.5 rounded-full border border-border/60">
          <TabsTrigger
            value="identity"
            className="rounded-full text-xs font-bold py-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            الهوية والعنوان
          </TabsTrigger>
          <TabsTrigger
            value="job"
            className="rounded-full text-xs font-bold py-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            الوظيفة والعقد
          </TabsTrigger>
          <TabsTrigger
            value="compensation"
            className="rounded-full text-xs font-bold py-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            الأجور والتأمينات
          </TabsTrigger>
          <TabsTrigger
            value="education"
            className="rounded-full text-xs font-bold py-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            المؤهلات والشهادات
          </TabsTrigger>
          <TabsTrigger
            value="assets"
            className="rounded-full text-xs font-bold py-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            العهد والأصول
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="rounded-full text-xs font-bold py-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            الخزينة الرقمية
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-full text-xs font-bold py-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
          >
            الإجازات والطلبات
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Identity, Civil & Saudi National Address */}
        <TabsContent value="identity" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <h3 className="font-black text-sm text-foreground">
                  بيانات الهوية الشخصية، الرقم الوظيفي، البصمة، والأحوال المدنية
                </h3>
              </div>
              {isEditing && (
                <Badge variant="secondary" className="text-[10px] font-bold">
                  ترجمة تلقائية فورية للاسم الإنجليزي
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">الرقم الوظيفي</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.employeeNo || ""}
                    onChange={(e) => setFormData({ ...formData, employeeNo: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-mono font-bold text-primary bg-primary/10 p-2.5 rounded-2xl">
                    {employee.employeeNo || "—"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">رقم البصمة (جهاز الحضور)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.biometricId || ""}
                    onChange={(e) => setFormData({ ...formData, biometricId: e.target.value })}
                    placeholder="BIO-XXXX"
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-mono font-bold text-emerald-700 bg-emerald-500/10 p-2.5 rounded-2xl">
                    {employee.biometricId || "غير مربوط"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">الاسم الأول (بالعربي) *</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.firstNameAr || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        firstNameAr: val,
                        firstNameEn: transliterateArabicName(val) || formData.firstNameEn,
                      });
                    }}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.firstNameAr}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">اسم العائلة (بالعربي) *</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.lastNameAr || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        lastNameAr: val,
                        lastNameEn: transliterateArabicName(val) || formData.lastNameEn,
                      });
                    }}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.lastNameAr}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">الاسم الأول (بالإنجليزية)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.firstNameEn || ""}
                    onChange={(e) => setFormData({ ...formData, firstNameEn: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-mono font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.firstNameEn || "—"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">اسم العائلة (بالإنجليزية)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.lastNameEn || ""}
                    onChange={(e) => setFormData({ ...formData, lastNameEn: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-mono font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.lastNameEn || "—"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">نوع الهوية</label>
                {isEditing ? (
                  <select
                    value={formData.identityType || "national_id"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        identityType: e.target.value as Employee["identityType"],
                      })
                    }
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="national_id">هوية وطنية</option>
                    <option value="iqama">إقامة نظامية</option>
                    <option value="passport">جواز سفر</option>
                    <option value="border_number">رقم حدود</option>
                  </select>
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.identityType === "iqama"
                      ? "إقامة نظامية"
                      : employee.identityType === "passport"
                        ? "جواز سفر"
                        : employee.identityType === "border_number"
                          ? "رقم حدود"
                          : "هوية وطنية"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  رقم الهوية / الإقامة / الوثيقة *
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.nationalIdOrIqama || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, nationalIdOrIqama: e.target.value })
                    }
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-mono font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.nationalIdOrIqama}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  تاريخ انتهاء الهوية / الإقامة
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    value={formData.nationalIdExpiry || ""}
                    onChange={(e) => setFormData({ ...formData, nationalIdExpiry: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-mono font-bold text-emerald-600 bg-muted/20 p-2.5 rounded-2xl">
                    {employee.nationalIdExpiry || "غير مسجل"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">الجنسية</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.nationality || ""}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.nationality}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">الديانة</label>
                {isEditing ? (
                  <select
                    value={formData.religion || "مسلم"}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="مسلم">مسلم</option>
                    <option value="غير مسلم">غير مسلم</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.religion || "مسلم"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">مكان وتاريخ الميلاد</label>
                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="مكان الميلاد"
                      value={formData.birthPlace || ""}
                      onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                      className="w-1/2 h-10 rounded-2xl border border-border/80 bg-muted/40 px-2.5 font-semibold"
                    />
                    <input
                      type="date"
                      value={formData.birthDate || ""}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      className="w-1/2 h-10 rounded-2xl border border-border/80 bg-muted/40 px-2.5 font-mono"
                    />
                  </div>
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.birthPlace || "—"} • {employee.birthDate || "—"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  الحالة الاجتماعية وعدد أفراد الأسرة
                </label>
                {isEditing ? (
                  <div className="flex gap-2">
                    <select
                      value={formData.maritalStatus || "single"}
                      onChange={(e) =>
                        setFormData({ ...formData, maritalStatus: e.target.value as MaritalStatus })
                      }
                      className="w-1/2 h-10 rounded-2xl border border-border/80 bg-muted/40 px-2.5 font-bold"
                    >
                      <option value="single">أعزب</option>
                      <option value="married">متزوج</option>
                      <option value="divorced">مطلق</option>
                      <option value="widowed">أرمل</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={formData.dependentsCount ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, dependentsCount: Number(e.target.value) })
                      }
                      className="w-1/2 h-10 rounded-2xl border border-border/80 bg-muted/40 px-2.5 font-mono font-bold"
                    />
                  </div>
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.maritalStatus === "married"
                      ? "متزوج"
                      : employee.maritalStatus === "divorced"
                        ? "مطلق"
                        : employee.maritalStatus === "widowed"
                          ? "أرمل"
                          : "أعزب"}{" "}
                    •{" "}
                    {employee.dependentsCount !== undefined && employee.dependentsCount !== null
                      ? `${employee.dependentsCount} أفراد أسرة`
                      : "0"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  البريد الإلكتروني الرسمي (النظام)
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-mono font-medium text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">البريد الإلكتروني الشخصي</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.personalEmail || ""}
                    onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-mono font-medium text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.personalEmail || "غير مسجل"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  أرقام التواصل (الأساسي / الإضافي / العمل)
                </label>
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="الجوال الأساسي"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-10 rounded-2xl border border-border/80 bg-muted/40 px-2.5 font-mono"
                    />
                    <input
                      type="text"
                      placeholder="جوال إضافي"
                      value={formData.secondaryPhone || ""}
                      onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
                      className="h-10 rounded-2xl border border-border/80 bg-muted/40 px-2.5 font-mono"
                    />
                  </div>
                ) : (
                  <p className="font-mono font-medium text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.phone || "—"}{" "}
                    {employee.secondaryPhone ? `• ${employee.secondaryPhone}` : ""}{" "}
                    {employee.workPhone ? `• تحويلة: ${employee.workPhone}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Saudi National Address, Home Country Address & Emergency Contacts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Home className="h-5 w-5 text-emerald-600" />
                <h4 className="font-black text-xs text-foreground">
                  العنوان الوطني والمعلومات البريدية (SPL)
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-muted/20 p-3 rounded-2xl col-span-2">
                  <span className="text-[10px] text-muted-foreground font-bold block">
                    العنوان الوطني المختصر وعنوان الإقامة الحالي
                  </span>
                  <span className="font-mono font-black text-primary">
                    {employee.shortNationalAddress || "—"}
                  </span>{" "}
                  <span className="font-bold text-foreground">
                    {employee.currentResidenceAddress ? `• ${employee.currentResidenceAddress}` : ""}
                  </span>
                </div>
                <div className="bg-muted/20 p-3 rounded-2xl">
                  <span className="text-[10px] text-muted-foreground font-bold block">
                    المدينة والحي
                  </span>
                  <span className="font-bold text-foreground">
                    {employee.nationalAddress
                      ? `${employee.nationalAddress.city || ""} - ${employee.nationalAddress.district || ""}`
                      : "غير مسجل"}
                  </span>
                </div>
                <div className="bg-muted/20 p-3 rounded-2xl">
                  <span className="text-[10px] text-muted-foreground font-bold block">
                    اسم الشارع
                  </span>
                  <span className="font-bold text-foreground">
                    {employee.nationalAddress?.street || "غير مسجل"}
                  </span>
                </div>
                <div className="bg-muted/20 p-3 rounded-2xl">
                  <span className="text-[10px] text-muted-foreground font-bold block">
                    رقم المبنى
                  </span>
                  <span className="font-mono font-black text-primary">
                    {employee.nationalAddress?.buildingNo || "—"}
                  </span>
                </div>
                <div className="bg-muted/20 p-3 rounded-2xl">
                  <span className="text-[10px] text-muted-foreground font-bold block">
                    الرمز البريدي والإضافي
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {employee.nationalAddress?.postalCode || "—"} -{" "}
                    {employee.nationalAddress?.additionalNo || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Globe className="h-5 w-5 text-blue-600" />
                <h4 className="font-black text-xs text-foreground">
                  عنوان الإقامة في البلد الأم
                </h4>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between bg-muted/20 p-3 rounded-2xl">
                  <span className="text-muted-foreground font-bold">الدولة والمدينة:</span>
                  <span className="font-bold text-foreground">
                    {employee.homeCountryAddress?.country || "غير مسجل"}{" "}
                    {employee.homeCountryAddress?.city ? `- ${employee.homeCountryAddress.city}` : ""}
                  </span>
                </div>
                <div className="flex justify-between bg-muted/20 p-3 rounded-2xl">
                  <span className="text-muted-foreground font-bold">العنوان التفصيلي:</span>
                  <span className="font-bold text-foreground truncate max-w-[180px]">
                    {employee.homeCountryAddress?.detailedAddress || "—"}
                  </span>
                </div>
                <div className="flex justify-between bg-muted/20 p-3 rounded-2xl">
                  <span className="text-muted-foreground font-bold">هاتف البلد الأم:</span>
                  <span className="font-mono font-bold text-primary">
                    {employee.homeCountryAddress?.phone || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <HeartPulse className="h-5 w-5 text-destructive" />
                <h4 className="font-black text-xs text-foreground">
                  جهة اتصال الطوارئ (Emergency Contact)
                </h4>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between bg-muted/20 p-3 rounded-2xl">
                  <span className="text-muted-foreground font-bold">اسم جهة الاتصال:</span>
                  <span className="font-bold text-foreground">
                    {employee.emergencyContact?.name || "غير مسجل"}
                  </span>
                </div>
                <div className="flex justify-between bg-muted/20 p-3 rounded-2xl">
                  <span className="text-muted-foreground font-bold">صلة القرابة:</span>
                  <span className="font-bold text-foreground">
                    {employee.emergencyContact?.relation || "—"}
                  </span>
                </div>
                <div className="flex justify-between bg-muted/20 p-3 rounded-2xl">
                  <span className="text-muted-foreground font-bold">رقم الهاتف المباشر:</span>
                  <span className="font-mono font-bold text-primary">
                    {employee.emergencyContact?.phone || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Job Structure, Qiwa Contract & Career */}
        <TabsContent value="job" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <Briefcase className="h-5 w-5 text-primary" />
              <h3 className="font-black text-sm text-foreground">
                بيانات العمل، الهيكل التنظيمي، التواريخ الوظيفية، والخبرة
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">المنطقة الإدارية</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.region || ""}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold"
                  />
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.region || "منطقة الرياض"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">الفرع / موقع العمل</label>
                {isEditing ? (
                  <select
                    value={formData.workLocationId}
                    onChange={(e) => setFormData({ ...formData, workLocationId: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {workLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.nameAr}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.workLocationName || "المركز الرئيسي"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">القسم الرئيسي والمسار</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.mainDepartment || ""}
                    onChange={(e) => setFormData({ ...formData, mainDepartment: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold"
                  />
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.mainDepartment || employee.departmentName || "—"} •{" "}
                    {employee.careerTrack || "—"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">القسم / الإدارة</label>
                {isEditing ? (
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {orgUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nameAr}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.departmentName}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">المسمى الوظيفي والوظيفة الحالية</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.jobTitleAr || ""}
                    onChange={(e) => setFormData({ ...formData, jobTitleAr: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.jobTitleAr}{" "}
                    {employee.currentRoleName ? `(${employee.currentRoleName})` : ""}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">التخصص والقطاع</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.specialization || ""}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold"
                  />
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.specialization || "—"} • {employee.sector || "القطاع الخاص"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  الدرجة الوظيفية (Job Grade)
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.jobGrade || ""}
                    onChange={(e) => setFormData({ ...formData, jobGrade: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-bold text-primary bg-primary/10 p-2.5 rounded-2xl">
                    {employee.jobGrade || "غير مسجل"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">المدير المباشر</label>
                {isEditing ? (
                  <select
                    value={formData.managerId || ""}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">بدون مدير مباشر</option>
                    {employees
                      .filter((e) => e.id !== employee.id)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.firstNameAr} {e.lastNameAr} ({e.jobTitleAr})
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.managerName || "لا يوجد مدير مباشر"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  تاريخ التعيين وتاريخ المباشرة
                </label>
                <p className="font-mono font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                  تعيين: {employee.hireDate || "—"} • مباشرة:{" "}
                  {employee.joiningDate || employee.hireDate || "—"}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  الخبرة، فترة التجربة، ودخول المملكة
                </label>
                <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                  خبرة {employee.experienceYears ?? 0} سنة • تجربة {employee.probationDays ?? 90} يوم
                  {employee.kingdomEntryDate ? ` • دخول: ${employee.kingdomEntryDate}` : ""}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">آخر مؤهل دراسي</label>
                <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                  {employee.highestQualification || employee.educationDegree || "غير مسجل"}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">احتساب الإجازة السنوية</label>
                <p className="font-bold text-emerald-700 bg-emerald-500/10 p-2.5 rounded-2xl">
                  {employee.annualLeaveCalculation || "من تاريخ المباشرة"}
                </p>
              </div>
            </div>
          </div>

          {/* Contract & Working Hours Regulation Details Card */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                <h3 className="font-black text-sm text-foreground">
                  تفاصيل العقد، تنظيم أوقات العمل، الراحة الأسبوعية، وبنود منصة قوى
                </h3>
              </div>
              <Badge variant="outline" className="text-[11px] font-bold border-primary/30 text-primary">
                {employee.contractDurationType === "ajeer"
                  ? "عقد أجير (بدون إجازة سنوية)"
                  : employee.contractDurationType === "indefinite"
                    ? "عقد غير محدد المدة"
                    : "عقد محدد المدة"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  رقم العقد الموحد في قوى (QIWA ID)
                </label>
                <p className="font-mono font-bold text-emerald-600 bg-muted/20 p-2.5 rounded-2xl">
                  {employee.qiwaContractNo || "غير مسجل"}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">تاريخ بداية العقد ونهايته</label>
                <p className="font-mono font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                  {employee.contractStartDate || employee.hireDate} ➔{" "}
                  {employee.contractDurationType === "indefinite"
                    ? "عقد غير محدد المدة"
                    : employee.contractEndDate || "غير محدد"}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">استحقاق الإجازة السنوية بالعقد</label>
                <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                  {employee.contractDurationType === "ajeer"
                    ? "0 يوم (نظام أجير لا يمنح إجازة سنوية)"
                    : `${employee.contractAnnualLeaveDays ?? 21} يوماً (${employee.annualLeavePolicy || "لائحة العمل"})`}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">تنظيم أوقات العمل والراحة</label>
                <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                  {employee.weeklyWorkDays ?? 5} أيام عمل /{" "}
                  <span className="text-emerald-700">
                    {employee.weeklyRestDays ?? Math.max(0, 7 - (employee.weeklyWorkDays ?? 5))} أيام راحة
                  </span>{" "}
                  • {employee.standardWorkHoursCount ?? 8} ساعات (
                  {employee.workHoursStandard === "weekly" ? "أسبوعياً" : "يومياً"})
                </p>
              </div>
            </div>

            {(employee.qiwaContractClauses ||
              employee.contractNotes ||
              employee.contractAttachmentName) && (
              <div className="rounded-2xl bg-muted/20 border border-border/60 p-4 space-y-2 text-xs">
                {employee.qiwaContractClauses && (
                  <div>
                    <span className="font-black text-foreground block mb-1">
                      بنود العقد المدرجة (منصة قوى):
                    </span>
                    <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                      {employee.qiwaContractClauses}
                    </p>
                  </div>
                )}
                {employee.contractNotes && (
                  <div className="pt-1">
                    <span className="font-bold text-foreground">ملاحظات العقد: </span>
                    <span className="text-muted-foreground">{employee.contractNotes}</span>
                  </div>
                )}
                {employee.contractAttachmentName && (
                  <div className="pt-1 flex items-center gap-2 text-primary font-bold">
                    <FileText className="h-4 w-4" />
                    <span>مرفق العقد المرفوع: {employee.contractAttachmentName}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Career Movements & Effective-Dated Assignment History */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <GitCommit className="h-5 w-5 text-purple-600" />
                <h3 className="font-black text-sm text-foreground">
                  سجل التنقلات والتاريخ الوظيفي المؤرخ (Career Movements & History)
                </h3>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono">
                {empAssignments.length} تعيينات مسجلة
              </Badge>
            </div>

            {/* Future Scheduled Movements Warning Card */}
            {empMovements.filter((m) => m.status === "scheduled").length > 0 && (
              <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-400">
                  <Calendar className="h-4 w-4" />
                  حركات وظيفية معتمدة مجدولة مستقبلاً (تنتظر تاريخ السريان):
                </div>
                <div className="space-y-1.5">
                  {empMovements
                    .filter((m) => m.status === "scheduled")
                    .map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs bg-background/80 p-2 rounded-xl border border-purple-200/50">
                        <div>
                          <span className="font-bold font-mono text-purple-600 mr-1.5">{m.movementNumber}</span>
                          <span className="font-bold">{m.reason}</span>
                          <span className="text-muted-foreground mr-2">({m.movementType})</span>
                        </div>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px] font-mono">
                          سريان: {m.effectiveDate}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Chronological Assignment History Timeline */}
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-black text-foreground">التسلسل الزمني للتعيينات والترقيات:</h4>
              {empAssignments.length === 0 ? (
                <div className="p-4 rounded-2xl bg-muted/20 text-xs text-muted-foreground text-center">
                  التعيين الحالي: {employee.departmentName || "—"} / {employee.jobTitleAr || "—"} (تاريخ المباشرة: {employee.hireDate})
                </div>
              ) : (
                <div className="space-y-2.5">
                  {empAssignments.map((assign, idx) => (
                    <div
                      key={assign.id || idx}
                      className={`p-3.5 rounded-2xl border text-xs transition-colors ${
                        assign.isCurrent
                          ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800"
                          : "bg-muted/30 border-border/60 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            {assign.positionTitle || employee.jobTitleAr}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="font-semibold text-foreground">
                            {assign.departmentName || employee.departmentName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {assign.isCurrent && (
                            <Badge className="bg-emerald-600 text-white text-[10px]">
                              التعيين الحالي
                            </Badge>
                          )}
                          <span className="font-mono text-[11px]">
                            {assign.effectiveFrom} ➔ {assign.effectiveTo || "مستمر"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        {assign.managerName && <span>المدير: {assign.managerName}</span>}
                        {assign.locationName && <span>الموقع: {assign.locationName}</span>}
                        {assign.changeReason && <span className="text-foreground/80 font-medium">السبب: {assign.changeReason}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Compensation, GOSI & Banking */}
        <TabsContent value="compensation" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h3 className="font-black text-sm text-foreground">
                  تفاصيل البيانات المالية، البدلات، الاستقطاعات، والبيانات البنكية (WPS & GOSI)
                </h3>
              </div>
              {employee.lockBankData && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold bg-amber-500/10 text-amber-700 border-amber-400"
                >
                  🔒 تعديل البيانات البنكية محظور
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">الراتب الأساسي (ر.س) *</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.basicSalary || ""}
                    onChange={(e) => {
                      const b = Number(e.target.value);
                      const h = Math.round(b * 0.25);
                      const tr = Math.round(b * 0.08);
                      setFormData({
                        ...formData,
                        basicSalary: b,
                        housingAllowance: h,
                        transportAllowance: tr,
                        totalSalary: b + h + tr,
                      });
                    }}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-black focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <p className="font-mono font-black text-foreground bg-muted/20 p-2.5 rounded-2xl text-sm">
                    {employee.basicSalary.toLocaleString()} ر.س
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">بدل السكن (25%)</label>
                <p className="font-mono font-bold text-emerald-600 bg-muted/20 p-2.5 rounded-2xl">
                  +
                  {(
                    employee.housingAllowance || Math.round(employee.basicSalary * 0.25)
                  ).toLocaleString()}{" "}
                  ر.س
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">بدل النقل والمواصلات</label>
                <p className="font-mono font-bold text-emerald-600 bg-muted/20 p-2.5 rounded-2xl">
                  +
                  {(
                    employee.transportAllowance || Math.round(employee.basicSalary * 0.08)
                  ).toLocaleString()}{" "}
                  ر.س
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  إجمالي الراتب الشهري (Gross)
                </label>
                <p className="font-mono font-black text-primary bg-primary/10 p-2.5 rounded-2xl text-sm">
                  {employee.totalSalary.toLocaleString()} ر.س
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">الفئة الوظيفية والكفيل</label>
                <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                  {employee.jobCategory || "غير محدد"}{" "}
                  {employee.sponsorName ? `• الكفيل: ${employee.sponsorName}` : ""}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">طريقة القبض وعمولة البنك</label>
                <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                  {employee.paymentMethod === "cash"
                    ? "نقدي (Cash)"
                    : employee.paymentMethod === "exchange"
                      ? "صرافة"
                      : "تحويل بنكي (WPS)"}{" "}
                  •{" "}
                  {employee.bankCommissionStatus === "deducted"
                    ? "تخصم العمولة"
                    : "لا تخصم العمولة"}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  البنك المعتمد ورقم الحساب
                </label>
                {isEditing && !formData.lockBankData ? (
                  <input
                    type="text"
                    value={formData.bankName || ""}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold"
                  />
                ) : (
                  <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                    {employee.bankName || "غير مسجل"}{" "}
                    {employee.bankAccountNumber ? `(${employee.bankAccountNumber})` : ""}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">
                  رقم الآيبان الدولي (IBAN - نظام حماية الأجور)
                </label>
                {isEditing && !formData.lockBankData ? (
                  <input
                    type="text"
                    value={formData.iban || ""}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-bold"
                  />
                ) : (
                  <p className="font-mono font-black text-foreground bg-muted/20 p-2.5 rounded-2xl text-xs">
                    {canViewPayroll ? (employee.iban || "غير مسجل") : maskIban(employee.iban)}
                  </p>
                )}
              </div>

              {/* Custom Allowances & Deductions Breakdown */}
              {((employee.customAllowances && employee.customAllowances.length > 0) ||
                (employee.customDeductions && employee.customDeductions.length > 0)) && (
                <div className="sm:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2">
                    <span className="font-black text-emerald-700 text-xs block">
                      الاستحقاقات والبدلات الإضافية المسجلة:
                    </span>
                    {(employee.customAllowances || []).map((alw) => (
                      <div key={alw.id} className="flex justify-between text-xs">
                        <span className="font-semibold">{alw.name}</span>
                        <span className="font-mono font-bold text-emerald-700">
                          +{Number(alw.amount).toLocaleString()} ر.س
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-2">
                    <span className="font-black text-rose-700 text-xs block">
                      الاستقطاعات والحسميات الثابتة المسجلة:
                    </span>
                    {(employee.customDeductions || []).map((ded) => (
                      <div key={ded.id} className="flex justify-between text-xs">
                        <span className="font-semibold">{ded.name}</span>
                        <span className="font-mono font-bold text-rose-700">
                          -{Number(ded.amount).toLocaleString()} ر.س
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GOSI Breakdown Box */}
              <div className="sm:col-span-4 rounded-2xl border border-emerald-300 bg-emerald-500/10 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 flex items-center gap-1.5 text-xs">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    اشتراك المؤسسة العامة للتأمينات الاجتماعية (GOSI) - مسجل برقم:{" "}
                    {employee.gosiNumber || "غير مسجل"}
                  </span>
                  <Badge className="bg-emerald-600 text-white text-[10px] rounded-full">
                    ساري ومطابق لنظام العمل
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="bg-card/80 p-3 rounded-2xl border border-border/50">
                    <span className="text-muted-foreground block text-[10px]">
                      استقطاع الموظف (9.75%)
                    </span>
                    <span className="font-mono font-bold text-destructive text-sm">
                      -
                      {(
                        employee.gosiEmployeeDeduction || Math.round(employee.basicSalary * 0.0975)
                      ).toLocaleString()}{" "}
                      ر.س
                    </span>
                  </div>
                  <div className="bg-card/80 p-3 rounded-2xl border border-border/50">
                    <span className="text-muted-foreground block text-[10px]">
                      مساهمة المنشأة (11.75%)
                    </span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      +
                      {(
                        employee.gosiEmployerContribution ||
                        Math.round(employee.basicSalary * 0.1175)
                      ).toLocaleString()}{" "}
                      ر.س
                    </span>
                  </div>
                  <div className="bg-card/80 p-3 rounded-2xl border border-border/50">
                    <span className="text-muted-foreground block text-[10px]">
                      صافي الراتب المحول للحساب
                    </span>
                    <span className="font-mono font-black text-primary text-sm">
                      {(
                        employee.totalSalary -
                        (employee.gosiEmployeeDeduction ||
                          Math.round(employee.basicSalary * 0.0975))
                      ).toLocaleString()}{" "}
                      ر.س
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Education, Certifications & Skills */}
        <TabsContent value="education" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h4 className="font-black text-xs text-foreground">المؤهل الأكاديمي والتعليمي</h4>
              </div>
              <div className="bg-muted/20 p-4 rounded-2xl space-y-1.5 text-xs">
                <span className="font-black text-foreground block text-base">
                  {employee.educationDegree || "غير مسجل"}
                </span>
                <p className="text-muted-foreground font-semibold">
                  {employee.university || "غير مسجل"}
                </p>
                <span className="text-[10px] text-primary font-mono font-bold block">
                  سنة التخرج: {employee.graduationYear || "غير مسجل"}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Award className="h-5 w-5 text-amber-500" />
                <h4 className="font-black text-xs text-foreground">
                  الشهادات المهنية واللغات المتقنة
                </h4>
              </div>
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground font-bold block mb-2">
                    الشهادات المعتمدة:
                  </span>
                  {employee.certifications && employee.certifications.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {employee.certifications.map((cert, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-[11px] rounded-full px-3 py-1 font-bold"
                        >
                          ✓ {cert}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs font-medium">لا توجد شهادات مهنية مسجلة</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-bold block mb-2">
                    اللغات:
                  </span>
                  {employee.languages && employee.languages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {employee.languages.map((lang, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-[11px] rounded-full px-3 py-1 font-bold border-primary/30 text-primary"
                        >
                          🌐 {lang}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs font-medium">لا توجد لغات إضافية مسجلة</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Hardware Assets */}
        <TabsContent value="assets" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Laptop className="h-5 w-5 text-primary" />
                <h3 className="font-black text-sm text-foreground">
                  العهد والأجهزة المستلمة ({employee.assignedAssets?.length || 0})
                </h3>
              </div>
            </div>

            {employee.assignedAssets && employee.assignedAssets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                {employee.assignedAssets.map((ast, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex justify-between items-center"
                  >
                    <div className="space-y-1">
                      <span className="font-bold text-foreground block text-sm">{ast.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono block">
                        الرقم التسلسلي: {ast.serialNo}
                      </span>
                      <span className="text-[10px] text-primary font-mono block">
                        تاريخ التسليم: {ast.assignedDate}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] rounded-full bg-emerald-500/10 text-emerald-700 border-emerald-200"
                    >
                      مسندة وفي العهدة
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground text-xs font-medium">
                لا توجد عهد أو أجهزة مستلمة مسجلة للموظف
              </p>
            )}
          </div>
        </TabsContent>

        {/* Tab 6: Digital Documents Vault */}
        <TabsContent value="documents" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                <h3 className="font-black text-sm text-foreground">
                  الخزينة الرقمية والمستندات المعتمدة ({employee.documentsList?.length || 0})
                </h3>
              </div>
            </div>

            {employee.documentsList && employee.documentsList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                {employee.documentsList.map((doc, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex justify-between items-center"
                  >
                    <div className="space-y-1">
                      <span className="font-bold text-foreground block text-sm">{doc.title}</span>
                      <span className="text-[10px] text-muted-foreground font-mono block">
                        رقم المستند: {doc.docNo}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono block">
                        تاريخ الانتهاء: {doc.expiryDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] rounded-full ${doc.status === "valid" ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" : "bg-amber-500/10 text-amber-700 border-amber-200"}`}
                      >
                        {doc.status === "valid" ? "ساري الصلاحية" : "ينتهي قريباً"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDocModalType("salary_certificate")}
                        className="h-8 rounded-full text-xs font-bold gap-1 px-3"
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" />
                        معاينة
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground text-xs font-medium">
                لا توجد مستندات أو وثائق معتمدة مسجلة في الخزينة
              </p>
            )}
          </div>
        </TabsContent>

        {/* Tab 7: Leaves, Attendance & Requests Activity */}
        <TabsContent value="activity" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="font-black text-sm text-foreground">
                سجل طلبات الموظف والإجازات والاعتمادات السابقة
              </h3>
            </div>

            {empRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 font-medium">
                لا توجد طلبات سابقة مسجلة للموظف
              </p>
            ) : (
              <div className="space-y-2.5">
                {empRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs flex justify-between items-center"
                  >
                    <div>
                      <span className="font-bold text-foreground block text-sm">
                        {req.payload.leaveTypeNameAr ||
                          req.payload.categoryNameAr ||
                          req.payload.reason}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {req.referenceNo} • {req.submittedAt.split("T")[0]}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-full px-3 py-1 font-bold ${
                        req.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                          : req.status === "rejected"
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-amber-500/10 text-amber-700 border-amber-200"
                      }`}
                    >
                      {req.status === "approved"
                        ? "معتمد بالكامل"
                        : req.status === "rejected"
                          ? "مرفوض"
                          : "قيد المراجعة"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Avatar Changer Modal */}
      <Dialog open={isAvatarModalOpen} onOpenChange={setIsAvatarModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              تغيير الصورة الرمزية وصورة الملف الشخصي
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              اختر صورة من جهازك، أو اختر صورة رمزية احترافية جاهزة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Upload from PC */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-foreground block">
                1. رفع صورة من الجهاز:
              </span>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-2xl h-11 text-xs font-bold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              >
                <Upload className="h-4 w-4" />
                اختيار ورفع ملف صورة (PNG/JPG)
              </Button>
            </div>

            {/* Presets Gallery (Demo Mode only) */}
            {isStorageInDemoMode() && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <span className="text-xs font-bold text-foreground block">
                  2. أو اختر صورة رمزية احترافية جاهزة (وضع العرض التجريبي فقط):
                </span>
                <div className="grid grid-cols-5 gap-2.5">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(url)}
                      className="relative rounded-full overflow-hidden border-2 border-border hover:border-primary hover:scale-105 transition-all aspect-square"
                    >
                      <img
                        src={url}
                        alt={`Avatar ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Image URL (Demo Mode only) */}
            {isStorageInDemoMode() && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <span className="text-xs font-bold text-foreground block">
                  3. أو أدخل رابط صورة خارجي مباشر (وضع العرض التجريبي فقط):
                </span>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={customAvatarUrl}
                    onChange={(e) => setCustomAvatarUrl(e.target.value)}
                    className="flex-1 h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveCustomAvatarUrl}
                    className="rounded-2xl h-9 text-xs font-bold px-3"
                  >
                    تعيين
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Official PDF Document Modal */}
      {docModalType && employee && (
        <OfficialDocumentModal
          isOpen={!!docModalType}
          onClose={() => setDocModalType(null)}
          employee={employee}
          documentType={docModalType}
        />
      )}
    </div>
  );
};
