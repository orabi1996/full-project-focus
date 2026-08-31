import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import type { UserRole, DataScope } from '../../types';
import {
  ShieldCheck,
  Users,
  Lock,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  Shield,
  Key,
  Plus,
  Save,
  Sliders,
  Check,
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

export const RbacView: React.FC = () => {
  const { roles, language, t } = useApp();
  const [selectedRole, setSelectedRole] = useState<any>(roles[0]);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleScope, setNewRoleScope] = useState<DataScope>('team');

  // 20 Full Enterprise Modules
  const permissionModules = [
    { id: 'm01', code: 'M01', nameAr: 'الصفحة الرئيسية والمؤشرات', actions: ['عرض المؤشرات', 'تخصيص اللوحة', 'تصدير'] },
    { id: 'm02', code: 'M02', nameAr: 'الهيكل المؤسسي والسياج GPS', actions: ['عرض', 'إضافة وتعديل', 'حذف وحدات', 'ضبط السياج'] },
    { id: 'm03', code: 'M03', nameAr: 'سجل الموظفين والملفات 360°', actions: ['عرض الدليل', 'إضافة موظف', 'تعديل الراتب', 'تعديل العقد', 'تصدير'] },
    { id: 'm04', code: 'M04', nameAr: 'مصفوفة الصلاحيات والأمان', actions: ['عرض الأدوار', 'تعديل الصلاحيات', 'تعيين المستخدمين'] },
    { id: 'm05', code: 'M05', nameAr: 'محرك الاعتمادات ومسارات العمل', actions: ['عرض الطلبات', 'اعتماد وقبول', 'رفض', 'إعادة للتصحيح'] },
    { id: 'm06', code: 'M06', nameAr: 'الإجازات والعطلات والأرصدة', actions: ['تقديم طلب', 'اعتماد الإجازة', 'تعديل الأرصدة', 'ترحيل سنوي'] },
    { id: 'm07', code: 'M07', nameAr: 'الحضور والانصراف اللحظي', actions: ['تسجيل بصمة', 'عرض السجلات', 'اعتماد التصحيح', 'قفل الشهر'] },
    { id: 'm08', code: 'M08', nameAr: 'الورديات وجدولة الدوامات', actions: ['عرض الورديات', 'إنشاء وردية', 'جدولة الموظفين'] },
    { id: 'm09', code: 'M09', nameAr: 'أجهزة البصمة واستيراد السجلات', actions: ['ربط الأجهزة', 'استيراد خام', 'مزامنة السجلات'] },
    { id: 'm10', code: 'M10', nameAr: 'مسيرات الرواتب الشهرية', actions: ['عرض الكشف', 'احتساب المسير', 'اعتماد وقفل', 'تصدير WPS SIF', 'تأكيد الصرف'] },
    { id: 'm11', code: 'M11', nameAr: 'السلف ومكافأة نهاية الخدمة EOSB', actions: ['طلب سلفة', 'اعتماد السلفة', 'احتساب EOSB', 'تصفية المخالصة'] },
    { id: 'm12', code: 'M12', nameAr: 'إدارة النفقات والمصروفات', actions: ['رفع مطالبة', 'فحص السياسات', 'اعتماد الصرف', 'ترحيل محاسبي'] },
    { id: 'm13', code: 'M13', nameAr: 'تقييم الأداء 360°', actions: ['بدء دورة التقييم', 'التقييم الذاتي', 'تقييم المدير', 'معايرة النتائج'] },
    { id: 'm14', code: 'M14', nameAr: 'تخطيط القوى العاملة', actions: ['عرض الخطة', 'نمذجة الميزانية', 'اعتماد الشواغر'] },
    { id: 'm15', code: 'M15', nameAr: 'التوظيف وتتبع المرشحين ATS', actions: ['نشر وظيفة', 'ترقية المراحل Kanban', 'تقييم المرشح', 'إصدار عرض عمل'] },
    { id: 'm16', code: 'M16', nameAr: 'العهد والأصول ووثائق المنشأة', actions: ['تسليم عهدة', 'استرجاع وإخلاء', 'نشر لوائح', 'متابعة الإقرارات'] },
    { id: 'm17', code: 'M17', nameAr: 'التقارير ومولد الاستعلامات', actions: ['عرض الكتالوج', 'توليد تقرير مخصص', 'تصدير Excel/PDF'] },
    { id: 'm18', code: 'M18', nameAr: 'القيود المحاسبية وتكاملات ERP', actions: ['عرض القيود', 'ترحيل لـ Odoo/SAP', 'إدارة Webhooks وAPI'] },
    { id: 'm19', code: 'M19', nameAr: 'الإشعارات وسجل التدقيق Audit Log', actions: ['عرض سجل التدقيق', 'تصدير السجل', 'إدارة التنبيهات'] },
    { id: 'm20', code: 'M20', nameAr: 'بوابة الخدمة الذاتية وتطبيق الجوال', actions: ['تبصيم GPS', 'عرض قسيمة الراتب', 'تقديم الطلبات', 'اعتماد الجوال'] },
  ];

  const handleCreateCustomRole = () => {
    if (!newRoleName) {
      alert('يرجى كتابة مسمى الدور');
      return;
    }
    const createdRole: any = {
      id: `role-${Date.now()}`,
      code: `custom_${newRoleName.toLowerCase().replace(/\s+/g, '_')}`,
      nameAr: newRoleName,
      nameEn: newRoleName,
      descriptionAr: newRoleDesc || 'دور مخصص بصلاحيات محددة',
      descriptionEn: 'Custom Role',
      userCount: 1,
      isSystem: false,
      dataScope: newRoleScope,
      permissions: [],
    };
    roles.push(createdRole);
    setSelectedRole(createdRole);
    setIsAddRoleOpen(false);
    alert(`تم إنشاء الدور المخصص (${newRoleName}) بنجاح!`);
    setNewRoleName('');
    setNewRoleDesc('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t.nav.rbac} ومصفوفة الصلاحيات (RBAC - M04)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            إدارة الأدوار، مصفوفة الصلاحيات الدقيقة للـ 20 وحدة، نطاقات البيانات (Data Scopes)، والاستثناءات
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsAddRoleOpen(true)}
            size="sm"
            className="font-bold text-xs gap-1.5 bg-primary"
          >
            <Plus className="h-4 w-4" />
            إنشاء دور مخصص جديد
          </Button>
        </div>
      </div>

      {/* Grid: Roles Selection & Permission Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase">الأدوار المعرفة في المنظومة ({roles.length})</h2>
          <div className="space-y-2">
            {roles.map(role => (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`rounded-xl border p-3.5 text-xs transition-all cursor-pointer space-y-1.5 ${
                  selectedRole.id === role.id
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40'
                    : 'bg-card hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{role.nameAr}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {role.userCount} مستخدم
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{role.descriptionAr}</p>
                <div className="pt-1 flex items-center justify-between text-[10px]">
                  <span className="font-mono text-primary font-bold uppercase">{role.code}</span>
                  <Badge variant="secondary" className="text-[9px]">
                    نطاق: {role.dataScope === 'all' ? 'كامل المنشأة' : role.dataScope === 'department' ? 'القسم' : 'الفريق المباشر'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permission Matrix for Selected Role */}
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-foreground">
                  مصفوفة صلاحيات: {selectedRole.nameAr}
                </h3>
                {selectedRole.isSystem && (
                  <Badge variant="secondary" className="text-[10px]">
                    دور نظام أساسي (System Role)
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                تخصيص الإجراءات المسموحة ونطاق البيانات لكل وحدة وظيفية
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold">نطاق البيانات:</span>
              <select
                value={selectedRole.dataScope}
                onChange={e => {
                  selectedRole.dataScope = e.target.value as any;
                  setSelectedRole({ ...selectedRole });
                }}
                className="h-8 rounded border bg-background px-2 text-xs font-bold text-primary"
              >
                <option value="all">كامل المنشأة (All Company)</option>
                <option value="subsidiary">الشركة التابعة فقط</option>
                <option value="department">القسم / الإدارة فقط</option>
                <option value="team">أعضاء الفريق المباشر فقط</option>
                <option value="self">البيانات الشخصية فقط (Self)</option>
              </select>
            </div>
          </div>

          {/* Module Matrix List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {permissionModules.map(mod => (
              <div key={mod.id} className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] font-mono">
                      {mod.code}
                    </Badge>
                    <span className="font-bold text-foreground">{mod.nameAr}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedRole.code === 'super_admin' ? 'صلاحية كاملة (Full Access)' : 'صلاحيات محددة'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 pt-2 border-t">
                  {mod.actions.map((act, actIdx) => (
                    <label key={actIdx} className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        defaultChecked={selectedRole.code === 'super_admin' || actIdx === 0}
                        className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span className="text-foreground">{act}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-3 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              يتم تطبيق الصلاحيات بشكل فوري على جميع المستخدمين المسند لهم هذا الدور.
            </span>
            <Button
              onClick={() => alert('تم حفظ وتطبيق مصفوفة الصلاحيات بنجاح!')}
              size="sm"
              className="text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="h-3.5 w-3.5" />
              حفظ مصفوفة الصلاحيات
            </Button>
          </div>
        </div>
      </div>

      {/* Add Custom Role Modal */}
      <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              إنشاء دور مخصص جديد (Custom Role)
            </DialogTitle>
            <DialogDescription className="text-xs">
              تحديد المسمى ونطاق البيانات لبدء تخصيص مصفوفة الصلاحيات
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">مسمى الدور الجديد *</label>
              <input
                type="text"
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                placeholder="مثال: مسؤول علاقات الموظفين والتدريب"
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">وصف ومسؤوليات الدور</label>
              <textarea
                rows={2}
                value={newRoleDesc}
                onChange={e => setNewRoleDesc(e.target.value)}
                placeholder="اكتب وصفاً مختصراً للمهام..."
                className="w-full rounded border p-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">نطاق البيانات الافتراضي</label>
              <select
                value={newRoleScope}
                onChange={e => setNewRoleScope(e.target.value as DataScope)}
                className="w-full h-8 rounded border px-2.5"
              >
                <option value="team">أعضاء الفريق المباشر (Team)</option>
                <option value="department">القسم / الإدارة (Department)</option>
                <option value="subsidiary">الشركة التابعة (Subsidiary)</option>
                <option value="all">كامل المنشأة (All)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleCreateCustomRole} className="text-xs bg-primary font-bold">
              إنشاء الدور وتعيين الصلاحيات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
