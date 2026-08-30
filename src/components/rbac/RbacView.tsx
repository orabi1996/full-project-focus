import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
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
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export const RbacView: React.FC = () => {
  const { roles, language, t } = useApp();
  const [selectedRole, setSelectedRole] = useState(roles[0]);

  const permissionModules = [
    { id: 'employees', nameAr: 'سجل وملف الموظف', permissions: ['عرض', 'إضافة', 'تعديل', 'حذف'] },
    { id: 'payroll', nameAr: 'مسيرات الرواتب والمالية', permissions: ['عرض', 'تشغيل', 'اعتماد', 'صرف'] },
    { id: 'attendance', nameAr: 'الحضور والجدولة', permissions: ['عرض', 'تعديل', 'اعتماد التصحيح'] },
    { id: 'leaves', nameAr: 'الإجازات والأرصدة', permissions: ['تقديم', 'اعتماد', 'تعديل الأرصدة'] },
    { id: 'ats', nameAr: 'التوظيف وATS', permissions: ['عرض المرشحين', 'تقييم', 'إصدار عروض'] },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t.nav.rbac} ومصفوفة الصلاحيات (RBAC)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            إدارة الأدوار، مصفوفة الصلاحيات المتقدمة، نطاقات البيانات (Data Scopes)، والاستثناءات الفردية
          </p>
        </div>
      </div>

      {/* Grid: Roles Selection & Permission Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase">الأدوار المعرفة في النظام</h2>
          <div className="space-y-2">
            {roles.map(role => (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`rounded-xl border p-3.5 text-xs transition-all cursor-pointer space-y-1.5 ${
                  selectedRole.id === role.id
                    ? 'border-primary bg-primary/5 shadow-xs'
                    : 'bg-card hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{role.nameAr}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {role.userCount} مستخدم
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{role.descriptionAr}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-bold text-sm text-foreground">
                مصفوفة صلاحيات: {selectedRole.nameAr}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                تحديد مستوى الوصول ونطاق البيانات لهذا الدور
              </p>
            </div>
            <Badge variant="secondary" className="text-xs font-mono">
              {selectedRole.code}
            </Badge>
          </div>

          <div className="space-y-4">
            {permissionModules.map(mod => (
              <div key={mod.id} className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{mod.nameAr}</span>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    النطاق: {selectedRole.code === 'super_admin' ? 'كامل المنشأة (All)' : selectedRole.code === 'line_manager' ? 'أعضاء الفريق فقط (Team)' : 'مخصص'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t">
                  {mod.permissions.map((perm, pIdx) => (
                    <label key={pIdx} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked={selectedRole.code === 'super_admin' || pIdx < 2}
                        className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span className="text-foreground">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
