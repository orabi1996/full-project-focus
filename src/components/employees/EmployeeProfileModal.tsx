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
  CheckCircle2,
  AlertCircle,
  QrCode,
  Download,
  Share2,
  Clock,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
        nationality: employee.nationality,
        birthDate: employee.birthDate,
        gender: employee.gender,
        maritalStatus: employee.maritalStatus,
        email: employee.email,
        phone: employee.phone,
        departmentId: employee.departmentId,
        departmentName: employee.departmentName,
        jobTitleAr: employee.jobTitleAr,
        jobTitleEn: employee.jobTitleEn,
        workLocationId: employee.workLocationId,
        workLocationName: employee.workLocationName,
        hireDate: employee.hireDate,
        contractType: employee.contractType,
        status: employee.status,
        basicSalary: employee.basicSalary,
        totalSalary: employee.totalSalary,
        managerId: employee.managerId,
        managerName: employee.managerName,
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
      alert("يرجى التأكد من استكمال الحقول الأساسية");
      return;
    }

    // Auto-calculate total salary if basic changed
    const basic = Number(formData.basicSalary) || employee.basicSalary;
    const total = formData.totalSalary ? Number(formData.totalSalary) : Number((basic * 1.35).toFixed(0));

    const selectedDept = orgUnits.find((u) => u.id === formData.departmentId);
    const selectedLoc = workLocations.find((l) => l.id === formData.workLocationId);
    const selectedMgr = employees.find((e) => e.id === formData.managerId);

    const updates: Partial<Employee> = {
      ...formData,
      basicSalary: basic,
      totalSalary: total,
      departmentName: selectedDept?.nameAr || formData.departmentName || employee.departmentName,
      workLocationName: selectedLoc?.nameAr || formData.workLocationName || employee.workLocationName,
      managerName: selectedMgr
        ? `${selectedMgr.firstNameAr} ${selectedMgr.lastNameAr}`
        : formData.managerName || employee.managerName,
    };

    updateEmployee(employee.id, updates);
    alert(`تم حفظ وتحديث بيانات الموظف (${updates.firstNameAr} ${updates.lastNameAr}) بنجاح!`);
    setIsEditing(false);
  };

  return (
    <>
      <Dialog open={!!activeEmployeeModalId} onOpenChange={(open) => !open && closeEmployeeProfile()}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 shadow-2xl">
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
                  <div className="flex items-center gap-2">
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
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
                    {employee.jobTitleAr} • {employee.departmentName} •{" "}
                    <span className="font-mono font-bold text-foreground">{employee.employeeNo}</span>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs">
              <span className="text-muted-foreground font-bold">الراتب الشهري الإجمالي</span>
              <p className="text-base font-black text-primary mt-0.5 font-mono">
                {employee.totalSalary.toLocaleString()} ر.س
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs">
              <span className="text-muted-foreground font-bold">رصيد الإجازات المتاح</span>
              <p className="text-base font-black text-emerald-600 mt-0.5 font-mono">
                {empLeaveBalance.availableBalance} يوم
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs">
              <span className="text-muted-foreground font-bold">تاريخ المباشرة</span>
              <p className="text-xs font-bold text-foreground mt-1 font-mono">
                {employee.hireDate}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs">
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

          {/* Tabbed Profile Content */}
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid grid-cols-5 w-full bg-muted/60 p-1 rounded-full border border-border/60">
              <TabsTrigger value="personal" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الهوية والاتصال
              </TabsTrigger>
              <TabsTrigger value="job" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الوظيفة والعقد
              </TabsTrigger>
              <TabsTrigger value="salary" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الراتب والبنك
              </TabsTrigger>
              <TabsTrigger value="documents" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الوثائق والشهادات
              </TabsTrigger>
              <TabsTrigger value="activity" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الإجازات والطلبات
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Personal & Contact */}
            <TabsContent value="personal" className="space-y-4 pt-4">
              <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <User className="h-4 w-4 text-primary" />
                  <h4 className="font-black text-xs text-foreground">البيانات الشخصية ورقم الهوية</h4>
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
                    <label className="font-bold text-muted-foreground">البريد الإلكتروني</label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={formData.email || ""}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    ) : (
                      <p className="font-mono font-medium text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.email}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">رقم الجوال</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.phone || ""}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    ) : (
                      <p className="font-mono font-medium text-foreground bg-muted/20 p-2.5 rounded-2xl">{employee.phone}</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Job & Contract */}
            <TabsContent value="job" className="space-y-4 pt-4">
              <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <h4 className="font-black text-xs text-foreground">البيانات الوظيفية وموقع العمل</h4>
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
                    <label className="font-bold text-muted-foreground">نوع العقد</label>
                    {isEditing ? (
                      <select
                        value={formData.contractType}
                        onChange={(e) => setFormData({ ...formData, contractType: e.target.value as ContractType })}
                        className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="full_time">دوام كامل (Full Time)</option>
                        <option value="part_time">دوام جزئي (Part Time)</option>
                        <option value="flexible">عمل مرن (Flexible)</option>
                        <option value="remote">عمل عن بعد (Remote)</option>
                      </select>
                    ) : (
                      <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                        {employee.contractType === "full_time"
                          ? "دوام كامل (Full Time)"
                          : employee.contractType === "part_time"
                            ? "دوام جزئي"
                            : "عمل مرن"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">حالة الموظف</label>
                    {isEditing ? (
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Employee["status"] })}
                        className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="active">نشط على رأس العمل</option>
                        <option value="probation">تحت التجربة</option>
                        <option value="on_leave">في إجازة</option>
                        <option value="suspended">موقوف مؤقتاً</option>
                        <option value="terminated">منتهي الخدمة</option>
                      </select>
                    ) : (
                      <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">
                        {employee.status === "active"
                          ? "نشط"
                          : employee.status === "probation"
                            ? "تحت التجربة"
                            : "في إجازة"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Salary & Banking */}
            <TabsContent value="salary" className="space-y-4 pt-4">
              <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <h4 className="font-black text-xs text-foreground">بيانات الراتب والبدلات والآيبان البنكي (WPS)</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">الراتب الأساسي (ر.س) *</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={formData.basicSalary || ""}
                        onChange={(e) => {
                          const b = Number(e.target.value);
                          setFormData({ ...formData, basicSalary: b, totalSalary: Number((b * 1.35).toFixed(0)) });
                        }}
                        className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-black focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    ) : (
                      <p className="font-mono font-black text-emerald-600 bg-muted/20 p-2.5 rounded-2xl text-sm">
                        {employee.basicSalary.toLocaleString()} ر.س
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">إجمالي الراتب الشهري (ر.س)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={formData.totalSalary || ""}
                        onChange={(e) => setFormData({ ...formData, totalSalary: Number(e.target.value) })}
                        className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-black text-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    ) : (
                      <p className="font-mono font-black text-primary bg-muted/20 p-2.5 rounded-2xl text-sm">
                        {employee.totalSalary.toLocaleString()} ر.س
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">البنك المعتمد لتحويل الراتب</label>
                    <p className="font-bold text-foreground bg-muted/20 p-2.5 rounded-2xl">مصرف الراجحي (Al Rajhi Bank)</p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="font-bold text-muted-foreground">رقم الآيبان الدولي (IBAN)</label>
                    <p className="font-mono font-black text-foreground bg-muted/20 p-2.5 rounded-2xl text-xs">
                      SA44 8000 0201 6080 1000 1234
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground">اشتراك التأمينات الاجتماعية (GOSI)</label>
                    <p className="font-bold text-emerald-700 bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-200">
                      ✓ مسجل ومطابق (حصة الموظف: 9.75%)
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 4: Documents & Certificates */}
            <TabsContent value="documents" className="space-y-4 pt-4">
              <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h4 className="font-black text-xs text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    المستندات والشهادات الرسمية المعتمدة
                  </h4>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/70 p-4 flex items-center justify-between bg-muted/20 hover:bg-card transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="font-black text-xs text-foreground">شهادة تعريف بالراتب (إلكترونية موثقة)</h5>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                          تتضمن تفاصيل الراتب والبدلات وموجهة للبنوك والجهات الحكومية والسفارات
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setDocModalType("salary_certificate")}
                      className="rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-4 h-9 shadow-xs"
                    >
                      <Printer className="h-4 w-4" />
                      عرض وطباعة (PDF)
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-border/70 p-4 flex items-center justify-between bg-muted/20 hover:bg-card transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <QrCode className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="font-black text-xs text-foreground">عقد العمل الموحد الموثق (منصة قوى)</h5>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                          العقد القياسي المتوافق مع نظام العمل السعودي واللائحة التنفيذية
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDocModalType("employment_contract")}
                      className="rounded-full text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary px-4 h-9 shadow-xs"
                    >
                      <Eye className="h-4 w-4 text-emerald-600" />
                      معاينة العقد الرسمي
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 5: Activity & Requests */}
            <TabsContent value="activity" className="space-y-4 pt-4">
              <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <h4 className="font-black text-xs text-foreground">سجل طلبات الموظف والاعتمادات</h4>
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
