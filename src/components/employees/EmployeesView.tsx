import React, { useState } from "react";
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
} from "lucide-react";
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

export const EmployeesView: React.FC = () => {
  const {
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);

  // Document Print Modal State
  const [docModalEmployee, setDocModalEmployee] = useState<Employee | null>(null);
  const [docModalType, setDocModalType] = useState<DocType>("salary_certificate");

  // Wizard form state
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
    workLocationId: workLocations[0]?.id || "",
    workLocationName: workLocations[0]?.nameAr || "",
    hireDate: new Date().toISOString().split("T")[0],
    contractType: "full_time" as ContractType,
    status: "active" as const,
    basicSalary: 10000,
    totalSalary: 13500,
  });

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.firstNameAr.includes(searchTerm) ||
      emp.lastNameAr.includes(searchTerm) ||
      emp.firstNameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.nationalIdOrIqama.includes(searchTerm) ||
      emp.jobTitleAr.includes(searchTerm);
    const matchesDept = selectedDept === "all" || emp.departmentId === selectedDept;
    const matchesStatus = selectedStatus === "all" || emp.status === selectedStatus;
    return matchesSearch && matchesDept && matchesStatus;
  });

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
      "الراتب الأساسي": e.basicSalary,
      "إجمالي الراتب": e.totalSalary,
      "تاريخ المباشرة": e.hireDate,
      الحالة: e.status === "active" ? "نشط" : e.status === "probation" ? "تحت التجربة" : "في إجازة",
    }));
    exportToCSV(`Employees_List_${new Date().toISOString().split("T")[0]}`, dataToExport);
  };

  const handleCreateEmployee = () => {
    if (!newEmp.firstNameAr || !newEmp.lastNameAr || !newEmp.email) {
      alert("يرجى استكمال الحقول الإلزامية");
      return;
    }
    addEmployee(newEmp);
    setIsAddWizardOpen(false);
    setWizardStep(1);
    alert("تمت إضافة الموظف بنجاح في سجلات المنظومة");
  };

  const openDocumentModal = (emp: Employee, type: DocType) => {
    setDocModalEmployee(emp);
    setDocModalType(type);
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="badge" source="material" filled size={24} className="text-primary" />
            {t.employees.directory} ({employees.length})
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            سجل الموظفين المركزي، الملفات الموحدة 360°، العقود والمستندات وتعديل البيانات
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
            {t.export} (Excel/CSV)
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالاسم، الرقم الوظيفي، الهوية، المسمى..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-2xl border border-border/80 bg-card pr-10 pl-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="h-10 rounded-2xl border border-border/80 bg-card px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">جميع الأقسام والإدارات</option>
            {orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {language === "ar" ? unit.nameAr : unit.nameEn}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 rounded-2xl border border-border/80 bg-card px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">كافة الحالات</option>
            <option value="active">نشط على رأس العمل</option>
            <option value="probation">تحت التجربة</option>
            <option value="on_leave">في إجازة</option>
          </select>
        </div>
      </div>

      {/* Employees Table Grid */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs p-5 space-y-3">
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-4 text-start">الموظف</th>
                <th className="py-3 px-4 text-start">الرقم الوظيفي</th>
                <th className="py-3 px-4 text-start">القسم / الوحدة</th>
                <th className="py-3 px-4 text-start">المسمى الوظيفي</th>
                <th className="py-3 px-4 text-start">الراتب الإجمالي</th>
                <th className="py-3 px-4 text-start">الحالة</th>
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
                        className="h-10 w-10 rounded-full border object-cover shadow-xs group-hover:ring-2 group-hover:ring-primary/40 transition-all"
                      />
                      <div>
                        <span className="font-black text-foreground group-hover:text-primary group-hover:underline transition-colors block">
                          {language === "ar"
                            ? `${emp.firstNameAr} ${emp.lastNameAr}`
                            : `${emp.firstNameEn} ${emp.lastNameEn}`}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-muted-foreground">
                    {emp.employeeNo}
                  </td>
                  <td className="py-3 px-4 font-bold text-foreground">{emp.departmentName}</td>
                  <td className="py-3 px-4 text-muted-foreground font-medium">{emp.jobTitleAr}</td>
                  <td className="py-3 px-4 font-black text-primary font-mono">
                    {emp.totalSalary.toLocaleString()} {t.currency}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-full px-2.5 font-bold ${
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
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
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
        <DialogContent className="max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              معالج إضافة موظف جديد (الخطوة {wizardStep} من 3)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              استكمال البيانات الشخصية والوظيفية والمالية للموظف
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
                <label className="font-bold">البريد الإلكتروني *</label>
                <input
                  type="email"
                  value={newEmp.email}
                  onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                  placeholder="ahmed@focus-hrms.com"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">رقم الهوية / الإقامة *</label>
                <input
                  type="text"
                  value={newEmp.nationalIdOrIqama}
                  onChange={(e) => setNewEmp({ ...newEmp, nationalIdOrIqama: e.target.value })}
                  placeholder="10XXXXXXXX"
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
                  placeholder="مثال: مهندس برمجيات"
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
                    setNewEmp({ ...newEmp, basicSalary: b, totalSalary: Number((b * 1.35).toFixed(0)) });
                  }}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">إجمالي الراتب التقديري</label>
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
