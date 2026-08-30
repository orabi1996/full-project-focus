import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import type { Employee, ContractType, Gender, MaritalStatus } from '../../types';
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
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export const EmployeesView: React.FC = () => {
  const { employees, orgUnits, subsidiaries, workLocations, addEmployee, language, t } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);

  // Wizard form state
  const [wizardStep, setWizardStep] = useState(1);
  const [newEmp, setNewEmp] = useState({
    employeeNo: `FOC-${Math.floor(1000 + Math.random() * 9000)}`,
    firstNameAr: '',
    lastNameAr: '',
    firstNameEn: '',
    lastNameEn: '',
    email: '',
    phone: '',
    nationalIdOrIqama: '',
    nationality: 'سعودي',
    gender: 'male' as Gender,
    birthDate: '1995-01-01',
    maritalStatus: 'single' as MaritalStatus,
    subsidiaryId: subsidiaries[0]?.id || '',
    subsidiaryName: subsidiaries[0]?.nameAr || '',
    departmentId: orgUnits[0]?.id || '',
    departmentName: orgUnits[0]?.nameAr || '',
    jobTitleAr: '',
    jobTitleEn: '',
    workLocationId: workLocations[0]?.id || '',
    workLocationName: workLocations[0]?.nameAr || '',
    hireDate: new Date().toISOString().split('T')[0],
    contractType: 'full_time' as ContractType,
    status: 'active' as const,
    basicSalary: 10000,
    totalSalary: 13500,
  });

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.firstNameAr.includes(searchTerm) ||
      emp.lastNameAr.includes(searchTerm) ||
      emp.firstNameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.jobTitleAr.includes(searchTerm);
    const matchesDept = selectedDept === 'all' || emp.departmentId === selectedDept;
    return matchesSearch && matchesDept;
  });

  const handleCreateEmployee = () => {
    if (!newEmp.firstNameAr || !newEmp.lastNameAr || !newEmp.email) {
      alert('يرجى استكمال الحقول الإلزامية');
      return;
    }
    addEmployee(newEmp);
    setIsAddWizardOpen(false);
    setWizardStep(1);
    alert('تمت إضافة الموظف بنجاح');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t.employees.directory} ({employees.length})
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            سجل الموظفين المركزي، الملفات الموحدة 360°، العقود والمستندات والرواتب
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsAddWizardOpen(true)}
            size="sm"
            className="font-bold text-xs gap-1.5 bg-primary"
          >
            <UserPlus className="h-4 w-4" />
            {t.employees.addEmployee}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالاسم، الرقم الوظيفي، المسمى..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-9 w-full rounded-lg border bg-card pr-9 pl-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="h-9 rounded-lg border bg-card px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">جميع الأقسام والإدارات</option>
            {orgUnits.map(unit => (
              <option key={unit.id} value={unit.id}>
                {language === 'ar' ? unit.nameAr : unit.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table Grid */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-4 text-start">الموظف</th>
                <th className="py-3 px-4 text-start">الرقم الوظيفي</th>
                <th className="py-3 px-4 text-start">القسم / الوحدة</th>
                <th className="py-3 px-4 text-start">المسمى الوظيفي</th>
                <th className="py-3 px-4 text-start">الراتب الإجمالي</th>
                <th className="py-3 px-4 text-start">الحالة</th>
                <th className="py-3 px-4 text-start">اكتمال الملف</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt={emp.firstNameAr}
                        className="h-9 w-9 rounded-full border object-cover shadow-xs"
                      />
                      <div>
                        <span className="font-bold text-foreground">
                          {language === 'ar'
                            ? `${emp.firstNameAr} ${emp.lastNameAr}`
                            : `${emp.firstNameEn} ${emp.lastNameEn}`}
                        </span>
                        <p className="text-[10px] text-muted-foreground">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-muted-foreground">{emp.employeeNo}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{emp.departmentName}</td>
                  <td className="py-3 px-4 text-muted-foreground">{emp.jobTitleAr}</td>
                  <td className="py-3 px-4 font-bold text-foreground">
                    {emp.totalSalary.toLocaleString()} {t.currency}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        emp.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                          : emp.status === 'probation'
                          ? 'bg-amber-500/10 text-amber-700 border-amber-200'
                          : 'bg-blue-500/10 text-blue-700 border-blue-200'
                      }`}
                    >
                      {emp.status === 'active' ? 'نشط' : emp.status === 'probation' ? 'تحت التجربة' : 'في إجازة'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${emp.completionScore}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">%{emp.completionScore}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEmployee(emp)}
                      className="h-7 text-xs font-bold text-primary gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      عرض 360°
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 360° Employee Profile Modal */}
      {selectedEmployee && (
        <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <img
                  src={selectedEmployee.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={selectedEmployee.firstNameAr}
                  className="h-16 w-16 rounded-full border-2 border-primary object-cover shadow-sm"
                />
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {language === 'ar'
                      ? `${selectedEmployee.firstNameAr} ${selectedEmployee.lastNameAr}`
                      : `${selectedEmployee.firstNameEn} ${selectedEmployee.lastNameEn}`}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {selectedEmployee.jobTitleAr} • {selectedEmployee.departmentName} • {selectedEmployee.employeeNo}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="overview" className="text-xs">عام وهوية</TabsTrigger>
                <TabsTrigger value="contract" className="text-xs">العقد والوظيفة</TabsTrigger>
                <TabsTrigger value="salary" className="text-xs">الراتب والبنك</TabsTrigger>
                <TabsTrigger value="documents" className="text-xs">المستندات</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-3 pt-3 text-xs">
                <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3">
                  <div><span className="text-muted-foreground">رقم الهوية / الإقامة:</span> <span className="font-bold">{selectedEmployee.nationalIdOrIqama}</span></div>
                  <div><span className="text-muted-foreground">الجنسية:</span> <span className="font-bold">{selectedEmployee.nationality}</span></div>
                  <div><span className="text-muted-foreground">الجوال:</span> <span className="font-bold">{selectedEmployee.phone}</span></div>
                  <div><span className="text-muted-foreground">البريد الإلكتروني:</span> <span className="font-bold">{selectedEmployee.email}</span></div>
                  <div><span className="text-muted-foreground">تاريخ الميلاد:</span> <span className="font-bold">{selectedEmployee.birthDate}</span></div>
                  <div><span className="text-muted-foreground">الحالة الاجتماعية:</span> <span className="font-bold">{selectedEmployee.maritalStatus === 'married' ? 'متزوج' : 'أعزب'}</span></div>
                </div>
              </TabsContent>

              <TabsContent value="contract" className="space-y-3 pt-3 text-xs">
                <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3">
                  <div><span className="text-muted-foreground">تاريخ المباشرة:</span> <span className="font-bold">{selectedEmployee.hireDate}</span></div>
                  <div><span className="text-muted-foreground">نوع العقد:</span> <span className="font-bold">دوام كامل (Full-time)</span></div>
                  <div><span className="text-muted-foreground">موقع العمل:</span> <span className="font-bold">{selectedEmployee.workLocationName}</span></div>
                  <div><span className="text-muted-foreground">المدير المباشر:</span> <span className="font-bold">{selectedEmployee.managerName || 'غير محدد'}</span></div>
                </div>
              </TabsContent>

              <TabsContent value="salary" className="space-y-3 pt-3 text-xs">
                <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3">
                  <div><span className="text-muted-foreground">الراتب الأساسي:</span> <span className="font-bold text-emerald-600">{selectedEmployee.basicSalary.toLocaleString()} ر.س</span></div>
                  <div><span className="text-muted-foreground">إجمالي الراتب الشهري:</span> <span className="font-bold text-primary">{selectedEmployee.totalSalary.toLocaleString()} ر.س</span></div>
                  <div><span className="text-muted-foreground">البنك المعتمد:</span> <span className="font-bold">مصرف الراجحي</span></div>
                  <div><span className="text-muted-foreground">الآيبان (IBAN):</span> <span className="font-mono font-bold">SA4480000201608010001234</span></div>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="space-y-2 pt-3 text-xs">
                <div className="rounded-lg border p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>بطاقة الهوية الوطنية / الإقامة (محدثة)</span>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">سارية</Badge>
                </div>
                <div className="rounded-lg border p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>عقد العمل الإلكتروني الموثق (قوى)</span>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">موثق</Badge>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* 5-Step Add Employee Wizard Modal */}
      <Dialog open={isAddWizardOpen} onOpenChange={setIsAddWizardOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              معالج إضافة موظف جديد (Wizard Step {wizardStep} of 3)
            </DialogTitle>
            <DialogDescription className="text-xs">
              استكمال البيانات الشخصية والوظيفية والمالية للموظف
            </DialogDescription>
          </DialogHeader>

          {/* Wizard Step 1: Personal */}
          {wizardStep === 1 && (
            <div className="grid grid-cols-2 gap-3 text-xs py-2">
              <div className="space-y-1">
                <label className="font-bold">الاسم الأول (بالعربي) *</label>
                <input
                  type="text"
                  value={newEmp.firstNameAr}
                  onChange={e => setNewEmp({ ...newEmp, firstNameAr: e.target.value })}
                  placeholder="مثال: أحمد"
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">اسم العائلة (بالعربي) *</label>
                <input
                  type="text"
                  value={newEmp.lastNameAr}
                  onChange={e => setNewEmp({ ...newEmp, lastNameAr: e.target.value })}
                  placeholder="مثال: السعيد"
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">البريد الإلكتروني *</label>
                <input
                  type="email"
                  value={newEmp.email}
                  onChange={e => setNewEmp({ ...newEmp, email: e.target.value })}
                  placeholder="ahmed@focus-hrms.com"
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">رقم الهوية / الإقامة *</label>
                <input
                  type="text"
                  value={newEmp.nationalIdOrIqama}
                  onChange={e => setNewEmp({ ...newEmp, nationalIdOrIqama: e.target.value })}
                  placeholder="10XXXXXXXX"
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
            </div>
          )}

          {/* Wizard Step 2: Job Details */}
          {wizardStep === 2 && (
            <div className="grid grid-cols-2 gap-3 text-xs py-2">
              <div className="space-y-1">
                <label className="font-bold">المسمى الوظيفي *</label>
                <input
                  type="text"
                  value={newEmp.jobTitleAr}
                  onChange={e => setNewEmp({ ...newEmp, jobTitleAr: e.target.value })}
                  placeholder="مثال: مهندس برمجيات"
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">القسم / الإدارة</label>
                <select
                  value={newEmp.departmentId}
                  onChange={e => {
                    const d = orgUnits.find(u => u.id === e.target.value);
                    setNewEmp({ ...newEmp, departmentId: e.target.value, departmentName: d?.nameAr || '' });
                  }}
                  className="w-full h-8 rounded border px-2.5"
                >
                  {orgUnits.map(u => (
                    <option key={u.id} value={u.id}>{u.nameAr}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold">موقع العمل</label>
                <select
                  value={newEmp.workLocationId}
                  onChange={e => {
                    const l = workLocations.find(loc => loc.id === e.target.value);
                    setNewEmp({ ...newEmp, workLocationId: e.target.value, workLocationName: l?.nameAr || '' });
                  }}
                  className="w-full h-8 rounded border px-2.5"
                >
                  {workLocations.map(l => (
                    <option key={l.id} value={l.id}>{l.nameAr}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold">تاريخ المباشرة</label>
                <input
                  type="date"
                  value={newEmp.hireDate}
                  onChange={e => setNewEmp({ ...newEmp, hireDate: e.target.value })}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
            </div>
          )}

          {/* Wizard Step 3: Salary & Review */}
          {wizardStep === 3 && (
            <div className="grid grid-cols-2 gap-3 text-xs py-2">
              <div className="space-y-1">
                <label className="font-bold">الراتب الأساسي (ر.س) *</label>
                <input
                  type="number"
                  value={newEmp.basicSalary}
                  onChange={e => {
                    const b = Number(e.target.value);
                    setNewEmp({ ...newEmp, basicSalary: b, totalSalary: b * 1.35 });
                  }}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">إجمالي الراتب التقديري</label>
                <input
                  type="number"
                  readOnly
                  value={newEmp.totalSalary}
                  className="w-full h-8 rounded border px-2.5 bg-muted font-bold text-primary"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center w-full mt-3">
            {wizardStep > 1 && (
              <Button variant="outline" size="sm" onClick={() => setWizardStep(prev => prev - 1)} className="text-xs">
                السابق
              </Button>
            )}
            <div className="flex gap-2 mr-auto">
              {wizardStep < 3 ? (
                <Button size="sm" onClick={() => setWizardStep(prev => prev + 1)} className="text-xs bg-primary">
                  التالي
                </Button>
              ) : (
                <Button size="sm" onClick={handleCreateEmployee} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  تأكيد وإضافة الموظف
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
