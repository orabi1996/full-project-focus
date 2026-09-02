import React, { useState, useEffect } from "react";
import { useApp } from "../../lib/context/AppContext";
import type { Employee, ContractType, Gender, MaritalStatus } from "../../types";
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
  Sparkles,
  Award,
  GraduationCap,
  Laptop,
  Home,
  HeartPulse,
  Globe,
  BadgeCheck,
  AlertTriangle,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

export const EmployeeProfileModal: React.FC = () => {
  const {
    activeEmployeeModalId,
    closeEmployeeProfile,
    employees,
    orgUnits,
    subsidiaries,
    workLocations,
    leaveBalances,
    requests,
    updateEmployee,
    currentRole,
    language,
    t,
  } = useApp();

  const employee = employees.find((e) => e.id === activeEmployeeModalId) || null;

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({});

  // Document Modal state
  const [docModalType, setDocModalType] = useState<DocType | null>(null);

  // Sync formData when employee opens
  useEffect(() => {
    if (employee) {
      setFormData({
        firstNameAr: employee.firstNameAr,
        lastNameAr: employee.lastNameAr,
        firstNameEn: employee.firstNameEn,
        lastNameEn: employee.lastNameEn,
        nationalIdOrIqama: employee.nationalIdOrIqama,
        nationalIdExpiry: employee.nationalIdExpiry || "2030-01-01",
        passportNo: employee.passportNo || "",
        passportExpiry: employee.passportExpiry || "",
        nationality: employee.nationality,
        birthDate: employee.birthDate,
        gender: employee.gender,
        maritalStatus: employee.maritalStatus,
        bloodType: employee.bloodType || "O+",
        dependentsCount: employee.dependentsCount || 0,
        email: employee.email,
        personalEmail: employee.personalEmail || "",
        phone: employee.phone,
        departmentId: employee.departmentId,
        departmentName: employee.departmentName,
        jobTitleAr: employee.jobTitleAr,
        jobTitleEn: employee.jobTitleEn,
        jobGrade: employee.jobGrade || "L3 - اختصاصي",
        costCenter: employee.costCenter || "CC-101",
        workType: employee.workType || "on_site",
        workLocationId: employee.workLocationId,
        workLocationName: employee.workLocationName,
        hireDate: employee.hireDate,
        contractStartDate: employee.contractStartDate || employee.hireDate,
        contractEndDate: employee.contractEndDate || "2027-01-01",
        qiwaContractNo: employee.qiwaContractNo || `QIWA-${employee.hireDate.split("-")[0]}-9981`,
        contractType: employee.contractType,
        status: employee.status,
        basicSalary: employee.basicSalary,
        housingAllowance: employee.housingAllowance || Math.round(employee.basicSalary * 0.25),
        transportAllowance: employee.transportAllowance || Math.round(employee.basicSalary * 0.08),
        otherAllowances: employee.otherAllowances || 0,
        totalSalary: employee.totalSalary,
        bankName: employee.bankName || "مصرف الراجحي (Al Rajhi Bank)",
        iban: employee.iban || "SA44 8000 0201 6080 1000 1234",
        gosiNumber: employee.gosiNumber || "7788990011",
        managerId: employee.managerId,
        managerName: employee.managerName,
        educationDegree: employee.educationDegree || "بكالوريوس علوم حاسب",
        university: employee.university || "جامعة الملك سعود",
        graduationYear: employee.graduationYear || 2018,
      });
      setIsEditing(false);
    }
  }, [employee]);

  if (!employee) return null;

  const canEdit = ["super_admin", "hr_manager", "payroll_officer"].includes(currentRole);

  const empLeaveBalance = leaveBalances.find((b) => b.employeeId === employee.id) || {
    availableBalance: 21,
    allocatedAnnualDays: 21,
    usedDays: 5,
    reservedDays: 0,
  };

  const empRequests = requests.filter((r) => r.requesterId === employee.id);

  const handleSaveChanges = () => {
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
      workLocationName: selectedLoc?.nameAr || formData.workLocationName || employee.workLocationName,
      managerName: selectedMgr
        ? `${selectedMgr.firstNameAr} ${selectedMgr.lastNameAr}`
        : formData.managerName || employee.managerName,
    };

    updateEmployee(employee.id, updates);
    toast.success(`تم حفظ وتحديث ملف الموظف (${updates.firstNameAr} ${updates.lastNameAr}) بنجاح!`);
    setIsEditing(false);
  };

  return (
    <>
      <Dialog open={!!activeEmployeeModalId} onOpenChange={(open) => !open && closeEmployeeProfile()}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 shadow-2xl border-border/80">
          <DialogHeader className="border-b border-border/70 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Profile Main Info */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={
                      employee.avatarUrl ||
                      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                    }
                    alt={employee.firstNameAr}
                    className="h-16 w-16 rounded-full border-2 border-primary object-cover shadow-sm ring-4 ring-primary/10"
                  />
                  <div
                    className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${
                      employee.status === "active"
                        ? "bg-emerald-500"
                        : employee.status === "probation"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-lg font-black text-foreground">
                      {language === "ar"
                        ? `${employee.firstNameAr} ${employee.lastNameAr}`
                        : `${employee.firstNameEn} ${employee.lastNameEn}`}
                    </DialogTitle>
                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-full px-2.5 font-bold ${
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
                          ? "فترة التجربة (90 يوم)"
                          : "في إجازة رسمية"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] rounded-full px-2.5 font-bold">
                      {employee.jobGrade || "L4 - اختصاصي"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] rounded-full px-2.5 font-bold border-primary/30 text-primary">
                      {employee.workType === "remote" ? "عمل عن بعد" : employee.workType === "hybrid" ? "عمل هجين" : "حضور مكتبي"}
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground font-medium mt-1">
                    {employee.jobTitleAr} • {employee.departmentName} •{" "}
                    <span className="font-mono font-bold text-foreground">{employee.employeeNo}</span> •{" "}
                    <span className="text-primary font-bold">{employee.costCenter || "CC-101"}</span>
                  </DialogDescription>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {canEdit && (
                  <>
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          onClick={handleSaveChanges}
                          className="rounded-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-9 shadow-xs"
                        >
                          <Save className="h-4 w-4" />
                          حفظ التعديلات
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                          className="rounded-full text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary px-3.5 h-9"
                        >
                          <X className="h-4 w-4" />
                          إلغاء
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-4 h-9 shadow-xs"
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
                  className="rounded-full text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary px-3.5 h-9"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  شهادة راتب (A4)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDocModalType("employment_contract")}
                  className="rounded-full text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary px-3.5 h-9"
                >
                  <FileText className="h-4 w-4 text-emerald-600" />
                  عقد قوى
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-3">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs">
              <span className="text-muted-foreground font-bold">الراتب الأساسي</span>
              <p className="text-sm font-black text-foreground mt-0.5 font-mono">
                {employee.basicSalary.toLocaleString()} ر.س
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs">
              <span className="text-muted-foreground font-bold">إجمالي الراتب الشهري</span>
              <p className="text-sm font-black text-primary mt-0.5 font-mono">
                {employee.totalSalary.toLocaleString()} ر.س
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs">
              <span className="text-muted-foreground font-bold">رصيد الإجازات المتاح</span>
              <p className="text-sm font-black text-emerald-600 mt-0.5 font-mono">
                {empLeaveBalance.availableBalance} يوم
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs">
              <span className="text-muted-foreground font-bold">سنوات الخدمة</span>
              <p className="text-sm font-bold text-foreground mt-0.5 font-mono">
                {employee.yearsOfService || 3} سنوات
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs col-span-2 sm:col-span-1">
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

          {/* Tabbed Comprehensive Profile Content */}
          <Tabs defaultValue="identity" className="w-full">
            <TabsList className="grid grid-cols-6 w-full bg-muted/60 p-1 rounded-full border border-border/60">
              <TabsTrigger value="identity" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الهوية والعنوان
              </TabsTrigger>
              <TabsTrigger value="job" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الوظيفة والعقد
              </TabsTrigger>
              <TabsTrigger value="compensation" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الأجور والبدلات والبنك
              </TabsTrigger>
              <TabsTrigger value="education" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                المؤهلات والشهادات
              </TabsTrigger>
              <TabsTrigger value="assets_docs" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                العهد والمستندات
              </TabsTrigger>
              <TabsTrigger value="activity" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الإجازات والطلبات
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Identity & National Address */}
            <TabsContent value="identity" className="space-y-4 pt-4">
              {/* Personal & Civil ID */}
              <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <User className="h-4 w-4 text-primary" />
                  <h4 className="font-black text-xs text-foreground">بيانات الهوية الشخصية والأحوال المدنية</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">الاسم الأول (بالعربي)</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.firstNameAr || ""}
                        onChange={(e) => setFormData({ ...formData, firstNameAr: e.target.value })}
                        className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    ) : (
                      <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.firstNameAr}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">اسم العائلة (بالعربي)</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.lastNameAr || ""}
                        onChange={(e) => setFormData({ ...formData, lastNameAr: e.target.value })}
                        className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    ) : (
                      <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.lastNameAr}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">الاسم بالإنجليزية</label>
                    <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.firstNameEn} {employee.lastNameEn}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">رقم الهوية الوطنية / الإقامة</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.nationalIdOrIqama || ""}
                        onChange={(e) => setFormData({ ...formData, nationalIdOrIqama: e.target.value })}
                        className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    ) : (
                      <p className="font-mono font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.nationalIdOrIqama}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">تاريخ انتهاء الهوية / الإقامة</label>
                    <p className="font-mono font-bold text-emerald-600 bg-muted/20 p-2.5 rounded-2xl">{employee.nationalIdExpiry || "2030-05-15"}</p>
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
                      <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.nationality}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">رقم جواز السفر</label>
                    <p className="font-mono font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.passportNo || "KSA-99881122"}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">تاريخ انتهاء الجواز</label>
                    <p className="font-mono font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.passportExpiry || "2029-11-20"}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">فصيلة الدم</label>
                    <p className="font-bold text-primary bg-primary/10 p-2.5 rounded-2xl font-mono">{employee.bloodType || "O+"}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">الحالة الاجتماعية والمعالين</label>
                    <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                      {employee.maritalStatus === "married" ? "متزوج" : "أعزب"} • {employee.dependentsCount || 0} أفراد معالين
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">البريد الإلكتروني للعمل</label>
                    <p className="font-mono font-medium text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.email}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">رقم الجوال الشخصي</label>
                    <p className="font-mono font-medium text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.phone}</p>
                  </div>
                </div>
              </div>

              {/* Saudi National Address & Emergency Contact */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* National Address Card */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                    <Home className="h-4 w-4 text-emerald-600" />
                    <h4 className="font-black text-xs text-foreground">العنوان الوطني الموحد (Saudi Post)</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-muted/20 p-2.5 rounded-2xl">
                      <span className="text-[10px] text-muted-foreground font-bold block">المدينة والحي</span>
                      <span className="font-bold text-foreground">{employee.nationalAddress?.city || "الرياض"} - {employee.nationalAddress?.district || "حي النخيل"}</span>
                    </div>
                    <div className="bg-muted/20 p-2.5 rounded-2xl">
                      <span className="text-[10px] text-muted-foreground font-bold block">اسم الشارع</span>
                      <span className="font-bold text-foreground">{employee.nationalAddress?.street || "شارع التخصصي"}</span>
                    </div>
                    <div className="bg-muted/20 p-2.5 rounded-2xl">
                      <span className="text-[10px] text-muted-foreground font-bold block">رقم المبنى</span>
                      <span className="font-mono font-black text-primary">{employee.nationalAddress?.buildingNo || "7214"}</span>
                    </div>
                    <div className="bg-muted/20 p-2.5 rounded-2xl">
                      <span className="text-[10px] text-muted-foreground font-bold block">الرمز البريدي والإضافي</span>
                      <span className="font-mono font-bold text-foreground">{employee.nationalAddress?.postalCode || "12383"} - {employee.nationalAddress?.additionalNo || "3310"}</span>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact Card */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                    <HeartPulse className="h-4 w-4 text-destructive" />
                    <h4 className="font-black text-xs text-foreground">جهة اتصال الطوارئ (Emergency Contact)</h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between bg-muted/20 p-2.5 rounded-2xl">
                      <span className="text-muted-foreground font-bold">اسم جهة الاتصال:</span>
                      <span className="font-bold text-foreground">{employee.emergencyContact?.name || "سعود المهيري"}</span>
                    </div>
                    <div className="flex justify-between bg-muted/20 p-2.5 rounded-2xl">
                      <span className="text-muted-foreground font-bold">صلة القرابة:</span>
                      <span className="font-bold text-foreground">{employee.emergencyContact?.relation || "شقيق"}</span>
                    </div>
                    <div className="flex justify-between bg-muted/20 p-2.5 rounded-2xl">
                      <span className="text-muted-foreground font-bold">رقم الهاتف للطوارئ:</span>
                      <span className="font-mono font-bold text-primary">{employee.emergencyContact?.phone || "+966 50 111 2233"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Job Structure & Contract */}
            <TabsContent value="job" className="space-y-4 pt-4">
              <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <h4 className="font-black text-xs text-foreground">الهيكل الوظيفي، العقد، ومسار الترقية</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">المسمى الوظيفي</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.jobTitleAr || ""}
                        onChange={(e) => setFormData({ ...formData, jobTitleAr: e.target.value })}
                        className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    ) : (
                      <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.jobTitleAr}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">الدرجة الوظيفية (Job Grade)</label>
                    <p className="font-bold text-primary bg-primary/10 p-2.5 rounded-2xl">{employee.jobGrade || "L5 - مدير تنفيذي أول"}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">مركز التكلفة (Cost Center)</label>
                    <p className="font-mono font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.costCenter || "CC-101 - تقنية المعلومات"}</p>
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
                      <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.departmentName}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">موقع وفرع العمل</label>
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
                      <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.workLocationName}</p>
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
                    <label className="font-bold text-muted-foreground">رقم العقد في قوى (QIWA ID)</label>
                    <p className="font-mono font-bold text-emerald-600 bg-muted/20 p-2.5 rounded-2xl">{employee.qiwaContractNo || "QIWA-2021-99812"}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">تاريخ سريان العقد ونهايته</label>
                    <p className="font-mono font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                      {employee.contractStartDate || employee.hireDate} ➔ {employee.contractEndDate || "2027-03-01"}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">نوع العقد والبيئة</label>
                    <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                      {employee.contractType === "full_time" ? "دوام كامل (Full Time)" : "دوام جزئي"} • {employee.workType === "remote" ? "عن بعد" : "هجين"}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Compensation, Allowances & Banking */}
            <TabsContent value="compensation" className="space-y-4 pt-4">
              <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <h4 className="font-black text-xs text-foreground">تفاصيل هيكل الأجور، البدلات، والتأمينات الاجتماعية (WPS & GOSI)</h4>
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
                          setFormData({ ...formData, basicSalary: b, housingAllowance: h, transportAllowance: tr, totalSalary: b + h + tr });
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
                      +{(employee.housingAllowance || Math.round(employee.basicSalary * 0.25)).toLocaleString()} ر.س
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">بدل النقل والمواصلات</label>
                    <p className="font-mono font-bold text-emerald-600 bg-muted/20 p-2.5 rounded-2xl">
                      +{(employee.transportAllowance || Math.round(employee.basicSalary * 0.08)).toLocaleString()} ر.س
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">إجمالي الراتب الشهري (Gross)</label>
                    <p className="font-mono font-black text-primary bg-primary/10 p-2.5 rounded-2xl text-sm">
                      {employee.totalSalary.toLocaleString()} ر.س
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="font-bold text-muted-foreground">البنك المعتمد لتحويل الراتب</label>
                    <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.bankName || "مصرف الراجحي (Al Rajhi Bank)"}</p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="font-bold text-muted-foreground">رقم الآيبان الدولي (IBAN - نظام حماية الأجور)</label>
                    <p className="font-mono font-black text-foreground bg-muted/20 p-2.5 rounded-2xl text-xs">
                      {employee.iban || "SA44 8000 0201 6080 1000 1234"}
                    </p>
                  </div>

                  {/* GOSI Breakdown Box */}
                  <div className="sm:col-span-4 rounded-2xl border border-emerald-300 bg-emerald-500/10 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-800 flex items-center gap-1.5 text-xs">
                        <Shield className="h-4 w-4 text-emerald-600" />
                        اشتراك المؤسسة العامة للتأمينات الاجتماعية (GOSI) - مسجل برقم: {employee.gosiNumber || "7788990011"}
                      </span>
                      <Badge className="bg-emerald-600 text-white text-[10px] rounded-full">ساري ومطابق لنظام العمل</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                      <div className="bg-card/70 p-2.5 rounded-xl border border-border/50">
                        <span className="text-muted-foreground block text-[10px]">استقطاع الموظف (9.75%)</span>
                        <span className="font-mono font-bold text-destructive">
                          -{(employee.gosiEmployeeDeduction || Math.round(employee.basicSalary * 0.0975)).toLocaleString()} ر.س
                        </span>
                      </div>
                      <div className="bg-card/70 p-2.5 rounded-xl border border-border/50">
                        <span className="text-muted-foreground block text-[10px]">مساهمة صاحب العمل (11.75%)</span>
                        <span className="font-mono font-bold text-emerald-700">
                          +{(employee.gosiEmployerContribution || Math.round(employee.basicSalary * 0.1175)).toLocaleString()} ر.س
                        </span>
                      </div>
                      <div className="bg-card/70 p-2.5 rounded-xl border border-border/50">
                        <span className="text-muted-foreground block text-[10px]">صافي الراتب المحول للحساب</span>
                        <span className="font-mono font-black text-primary">
                          {(employee.totalSalary - (employee.gosiEmployeeDeduction || Math.round(employee.basicSalary * 0.0975))).toLocaleString()} ر.س
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
                {/* Academic Degree */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <h4 className="font-black text-xs text-foreground">المؤهل الأكاديمي والتعليمي</h4>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="bg-muted/20 p-3 rounded-2xl space-y-1">
                      <span className="font-black text-foreground block text-sm">{employee.educationDegree || "ماجستير هندسة البرمجيات"}</span>
                      <p className="text-muted-foreground font-semibold">{employee.university || "جامعة الملك فهد للبترول والمعادن"}</p>
                      <span className="text-[10px] text-primary font-mono font-bold block">سنة التخرج: {employee.graduationYear || 2013}</span>
                    </div>
                  </div>
                </div>

                {/* Professional Certifications & Languages */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                    <Award className="h-4 w-4 text-amber-500" />
                    <h4 className="font-black text-xs text-foreground">الشهادات المهنية واللغات المتقنة</h4>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold block mb-1.5">الشهادات المعتمدة:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(employee.certifications || ["PMP Certified", "AWS Solutions Architect", "Scrum Master"]).map((cert, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] rounded-full px-2.5 py-1 font-bold">
                            ✓ {cert}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold block mb-1.5">اللغات:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(employee.languages || ["العربية (اللغة الأم)", "الإنجليزية (طلاقة احترافية)"]).map((lang, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] rounded-full px-2.5 py-1 font-bold border-primary/30 text-primary">
                            🌐 {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 5: Assigned Assets & Digital Documents Vault */}
            <TabsContent value="assets_docs" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Hardware Assets */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                    <Laptop className="h-4 w-4 text-primary" />
                    <h4 className="font-black text-xs text-foreground">العهد والأجهزة المستلمة ({employee.assignedAssets?.length || 2})</h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    {(employee.assignedAssets || [
                      { name: "MacBook Pro M3 Max", type: "كمبيوتر محمول", serialNo: "APL-M3-9988", assignedDate: "2023-11-10" },
                      { name: "شاشة Dell UltraSharp 27-inch", type: "شاشة مكتبية", serialNo: "DEL-4K-5541", assignedDate: "2023-11-10" }
                    ]).map((ast, idx) => (
                      <div key={idx} className="rounded-2xl border border-border/60 bg-muted/20 p-3 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-foreground block">{ast.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">الرقم التسلسلي: {ast.serialNo}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] rounded-full bg-emerald-500/10 text-emerald-700 border-emerald-200">
                          مسندة
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Digital Documents */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <h4 className="font-black text-xs text-foreground">الخزينة الرقمية والمستندات المعتمدة</h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    {(employee.documentsList || [
                      { type: "national_id", title: "الهوية الوطنية / الإقامة", docNo: employee.nationalIdOrIqama, expiryDate: "2030-05-15", status: "valid" },
                      { type: "contract", title: "عقد العمل الموحد (قوى)", docNo: employee.qiwaContractNo || "QIWA-2021-99812", expiryDate: "2027-03-01", status: "valid" },
                    ]).map((doc, idx) => (
                      <div key={idx} className="rounded-2xl border border-border/60 bg-muted/20 p-3 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-foreground block">{doc.title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">رقم المستند: {doc.docNo}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] rounded-full ${doc.status === "valid" ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" : "bg-amber-500/10 text-amber-700 border-amber-200"}`}>
                            {doc.status === "valid" ? "ساري الصلاحية" : "ينتهي قريباً"}
                          </Badge>
                          <Button size="sm" variant="ghost" onClick={() => setDocModalType("salary_certificate")} className="h-7 w-7 p-0 rounded-full">
                            <Eye className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 6: Leaves & Requests Activity */}
            <TabsContent value="activity" className="space-y-4 pt-4">
              <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <h4 className="font-black text-xs text-foreground">سجل طلبات الموظف والاعتمادات السابقة</h4>
                </div>

                {empRequests.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6 font-medium">
                    لا توجد طلبات سابقة مسجلة للموظف
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {empRequests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs flex justify-between items-center"
                      >
                        <div>
                          <span className="font-bold text-foreground block">
                            {req.payload.leaveTypeNameAr || req.payload.categoryNameAr || req.payload.reason}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {req.referenceNo} • {req.createdAt.split("T")[0]}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] rounded-full px-2.5 font-bold ${
                            req.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                              : req.status === "rejected"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-amber-500/10 text-amber-700 border-amber-200"
                          }`}
                        >
                          {req.status === "approved" ? "معتمد" : req.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
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
    </>
  );
};
