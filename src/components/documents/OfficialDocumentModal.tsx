import React from 'react';
import type { Employee } from '../../types';
import {
  FileText,
  Printer,
  Download,
  CheckCircle2,
  Building2,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';

export type DocType = 'salary_certificate' | 'employment_contract' | 'clearance_letter';

interface OfficialDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  documentType: DocType;
  destinationEntity?: string;
}

export const OfficialDocumentModal: React.FC<OfficialDocumentModalProps> = ({
  isOpen,
  onClose,
  employee,
  documentType,
  destinationEntity = 'إلى من يهمه الأمر (السفارات / البنوك والجهات الرسمية)',
}) => {
  const currentDate = new Date().toLocaleDateString('ar-SA');
  const refNo = `DOC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-slate-100 dark:bg-slate-900">
        {/* Document Actions Header */}
        <div className="p-4 bg-card border-b flex items-center justify-between no-print sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm text-foreground">
              {documentType === 'salary_certificate'
                ? 'شهادة تعريف بالراتب موثقة رقمياً'
                : documentType === 'employment_contract'
                ? 'عقد عمل سعودي موحد (قوى)'
                : 'شهادة إخلاء طرف ومخالصة نهائية'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrint} size="sm" className="font-bold text-xs gap-1.5 bg-primary">
              <Printer className="h-4 w-4" />
              طباعة المستند / حفظ كـ PDF
            </Button>
          </div>
        </div>

        {/* Printable A4 Document Sheet */}
        <div className="p-8 my-4 mx-auto bg-white text-slate-900 max-w-2xl rounded-xl shadow-lg border space-y-6 font-sans text-xs leading-relaxed print:m-0 print:p-8 print:shadow-none print:border-0 print:max-w-none">
          {/* Header with Official Logo & Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div className="space-y-1">
              <h1 className="text-base font-black text-slate-900">شركة فوكس للتقنية وحلول الأعمال</h1>
              <p className="text-[11px] text-slate-600 font-medium">سجل تجاري: 1010789654 • الرقم الضريبي: 300098765400003</p>
              <p className="text-[11px] text-slate-600">الرياض - المملكة العربية السعودية</p>
            </div>
            <div className="text-end space-y-1 font-mono text-[11px]">
              <p className="font-bold">الرقم المرجعي: {refNo}</p>
              <p>التاريخ: {currentDate}</p>
            </div>
          </div>

          {/* Document Title Banner */}
          <div className="text-center py-2 border-y border-slate-200 bg-slate-50">
            <h2 className="text-base font-black text-slate-900">
              {documentType === 'salary_certificate'
                ? 'شهادة تعريف وتفاصيل الراتب'
                : documentType === 'employment_contract'
                ? 'عقد عمل رسمي محدد المدة'
                : 'شهادة إخلاء طرف وإبراء ذمة'}
            </h2>
          </div>

          {/* Recipient Notice */}
          {documentType === 'salary_certificate' && (
            <div className="font-bold text-slate-800">
              سعادة / {destinationEntity} .. المحترمين
            </div>
          )}

          {/* Document Body Content */}
          {documentType === 'salary_certificate' && (
            <div className="space-y-4 text-justify text-slate-800 text-xs leading-6">
              <p>
                تشهد شركة فوكس للتقنية وحلول الأعمال بأن الموظف الموضحة بياناته أدناه يعمل لدينا وتحت كفالتنا، وما زال على رأس العمل حتى تاريخه:
              </p>

              <div className="rounded-lg border border-slate-300 p-3 space-y-2 bg-slate-50">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="font-semibold text-slate-600">اسم الموظف:</span> <span className="font-bold text-slate-900">{employee.firstNameAr} {employee.lastNameAr}</span></div>
                  <div><span className="font-semibold text-slate-600">الجنسية:</span> <span className="font-bold text-slate-900">{employee.nationality}</span></div>
                  <div><span className="font-semibold text-slate-600">رقم الهوية / الإقامة:</span> <span className="font-bold font-mono text-slate-900">{employee.nationalIdOrIqama}</span></div>
                  <div><span className="font-semibold text-slate-600">الرقم الوظيفي:</span> <span className="font-bold font-mono text-slate-900">{employee.employeeNo}</span></div>
                  <div><span className="font-semibold text-slate-600">المسمى الوظيفي:</span> <span className="font-bold text-slate-900">{employee.jobTitleAr}</span></div>
                  <div><span className="font-semibold text-slate-600">تاريخ الالتحاق بالعمل:</span> <span className="font-bold font-mono text-slate-900">{employee.hireDate}</span></div>
                </div>
              </div>

              <p className="font-bold text-slate-900">تفاصيل الراتب والبدلات الشهرية:</p>

              <table className="w-full border border-slate-300 text-center text-xs">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                  <tr>
                    <th className="py-2 border-l border-slate-300">الراتب الأساسي</th>
                    <th className="py-2 border-l border-slate-300">بدل السكن</th>
                    <th className="py-2 border-l border-slate-300">بدل النقل</th>
                    <th className="py-2 font-black bg-slate-200">إجمالي الراتب الشهري</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-mono font-bold">
                    <td className="py-2.5 border-l border-slate-300">{employee.basicSalary.toLocaleString()} ر.س</td>
                    <td className="py-2.5 border-l border-slate-300">{Number((employee.basicSalary * 0.25).toFixed(0)).toLocaleString()} ر.س</td>
                    <td className="py-2.5 border-l border-slate-300">{Number((employee.basicSalary * 0.10).toFixed(0)).toLocaleString()} ر.س</td>
                    <td className="py-2.5 font-black bg-slate-50 text-slate-900">{employee.totalSalary.toLocaleString()} ر.س</td>
                  </tr>
                </tbody>
              </table>

              <p className="text-[11px] text-slate-600">
                وقد أُعطيت له هذه الشهادة بناءً على طلبه لتقديمها إلى الجهة المذكورة أعلاه دون أدنى مسؤولية مالية أو قانونية على الشركة تجاه الغير.
              </p>
            </div>
          )}

          {documentType === 'employment_contract' && (
            <div className="space-y-3 text-slate-800 text-xs leading-5">
              <p className="font-bold">الطرف الأول (صاحب العمل): شركة فوكس للتقنية وحلول الأعمال</p>
              <p className="font-bold">الطرف الثاني (الموظف): {employee.firstNameAr} {employee.lastNameAr} - هوية رقم ({employee.nationalIdOrIqama})</p>
              <div className="border-t pt-2 space-y-1.5 text-justify">
                <p>1. <strong>المسمى الوظيفي:</strong> يعمل الطرف الثاني لدى الطرف الأول بمهنة ({employee.jobTitleAr}) في مدينة ({employee.workLocationName}).</p>
                <p>2. <strong>الأجر والمزايا:</strong> يتقاضى الطرف الثاني أجراً أساسياً قدره ({employee.basicSalary.toLocaleString()} ر.س) بالإضافة للبدلات المتفق عليها بإجمالي ({employee.totalSalary.toLocaleString()} ر.س) شهرياً يحول عبر نظام حماية الأجور WPS.</p>
                <p>3. <strong>فترة التجربة:</strong> يخضع الطرف الثاني لفترة تجربة مدتها 90 يوماً قابلة للتمديد إلى 180 يوماً بموجب اتفاق كتابي وفق نظام العمل السعودي.</p>
                <p>4. <strong>ساعات العمل والإجازات:</strong> 8 ساعات عمل يومياً، ويستحق الموظف إجازة سنوية مدفوعة الأجر مدتها 30 يوماً عن كل عام خدمة.</p>
              </div>
            </div>
          )}

          {/* Stamp, Signature & Verification Footer */}
          <div className="border-t-2 border-slate-900 pt-6 mt-8 flex justify-between items-end">
            <div className="space-y-1">
              <p className="font-bold text-slate-900">إدارة الموارد البشرية والشؤون الإدارية</p>
              <p className="text-[11px] text-slate-600">شركة فوكس للتقنية وحلول الأعمال</p>
              <div className="h-16 w-32 border-2 border-dashed border-emerald-600 rounded-lg flex items-center justify-center text-emerald-700 font-bold text-[10px] mt-2 rotate-[-4deg]">
                ختم الموارد البشرية المعتمد
              </div>
            </div>

            <div className="text-center space-y-1">
              <div className="h-16 w-16 mx-auto border-2 border-slate-900 rounded p-1 flex items-center justify-center">
                <QrCode className="h-12 w-12 text-slate-900" />
              </div>
              <span className="text-[9px] font-mono text-slate-500 block">رمز التحقق الإلكتروني</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
