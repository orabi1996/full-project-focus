import React, { useState } from "react";
import type { Employee } from "../../types";
import {
  FileText,
  Printer,
  Download,
  CheckCircle2,
  Building2,
  QrCode,
  ShieldCheck,
  Building,
  Stamp,
  Globe,
  CreditCard,
  Award,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { toast } from "sonner";

export type DocType =
  | "salary_certificate"
  | "employment_contract"
  | "clearance_letter"
  | "bank_account_letter"
  | "embassy_visa_letter"
  | "experience_certificate";

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
  documentType: initialDocType,
  destinationEntity: initialDestination = "إلى من يهمه الأمر (البنوك / السفارات والجهات الرسمية)",
}) => {
  const [currentDocType, setCurrentDocType] = useState<DocType>(initialDocType);
  const [destinationEntity, setDestinationEntity] = useState(initialDestination);

  const currentDate = new Date().toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const refNo = `DOC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  const handlePrint = () => {
    const sheet = document.getElementById("printable-official-letter-sheet");
    if (!sheet) {
      window.print();
      return;
    }
    const printWindow = window.open("", "_blank", "width=850,height=1100");
    if (!printWindow) {
      toast.error("يرجى السماح بالنوافذ المنبثقة لإتمام الطباعة المباشرة");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${getDocTitle(currentDocType)} - ${employee.firstNameAr} ${employee.lastNameAr}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    body { font-family: 'Cairo', system-ui, sans-serif; margin: 0; padding: 32px; background: #fff; color: #0f172a; direction: rtl; }
    * { box-sizing: border-box; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; }
    @media print { body { padding: 8px; } }
  </style>
</head>
<body>
  ${sheet.outerHTML}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const handleDownload = () => {
    const sheet = document.getElementById("printable-official-letter-sheet");
    if (!sheet) return;
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${getDocTitle(currentDocType)}</title><style>@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'); body { font-family: 'Cairo', system-ui, sans-serif; padding: 40px; background: #fff; direction: rtl; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #cbd5e1; padding: 8px; }</style></head><body>${sheet.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getDocTitle(currentDocType).replace(/\s+/g, "_")}_${employee.employeeNo || "وثيقة"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`تم حفظ وتنزيل الخطاب الرسمي (${getDocTitle(currentDocType)}) على جهازك بنجاح!`);
  };

  const getDocTitle = (type: DocType) => {
    switch (type) {
      case "salary_certificate":
        return "شهادة تعريف وتفاصيل الراتب المعتمدة";
      case "employment_contract":
        return "عقد عمل رسمي موحد (متوافق مع منصة قوى)";
      case "clearance_letter":
        return "شهادة إخلاء طرف ومخالصة نهائية شاملة";
      case "bank_account_letter":
        return "خطاب فتح حساب بنكي وتحويل راتب (WPS)";
      case "embassy_visa_letter":
        return "خطاب موجه للسفارة والقنصلية لطلب تأشيرة سفر";
      case "experience_certificate":
        return "شهادة خبرة وخدمة عمل رسمية معتمدة";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 border-0 bg-slate-100 dark:bg-slate-900 rounded-3xl">
        {/* Document Actions & Selector Header */}
        <div className="p-4 bg-card border-b flex flex-col md:flex-row md:items-center justify-between gap-3 no-print sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-black text-sm text-foreground">{getDocTitle(currentDocType)}</h3>
              <p className="text-[11px] text-muted-foreground font-medium">
                الموظف: {employee.firstNameAr} {employee.lastNameAr} ({employee.employeeNo})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currentDocType}
              onChange={(e) => setCurrentDocType(e.target.value as DocType)}
              className="h-8 rounded-full border border-border/80 bg-background px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="salary_certificate">شهادة تعريف راتب</option>
              <option value="employment_contract">عقد عمل قوى</option>
              <option value="bank_account_letter">خطاب فتح حساب بنكي</option>
              <option value="embassy_visa_letter">خطاب سفارة / تأشيرة</option>
              <option value="clearance_letter">شهادة إخلاء طرف</option>
              <option value="experience_certificate">شهادة خبرة</option>
            </select>

            <Button
              onClick={handleDownload}
              size="sm"
              variant="outline"
              className="font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary rounded-full h-8 px-3 shadow-xs"
              title="تنزيل الخطاب وحفظه على جهازك"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              تنزيل الملف
            </Button>

            <Button
              onClick={handlePrint}
              size="sm"
              className="font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 px-4 shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              طباعة المستند / PDF
            </Button>
          </div>
        </div>

        {/* Destination Quick Edit in Modal */}
        {(currentDocType === "salary_certificate" ||
          currentDocType === "bank_account_letter" ||
          currentDocType === "embassy_visa_letter") && (
          <div className="px-6 pt-3 pb-1 no-print flex items-center gap-2 text-xs">
            <span className="font-bold text-muted-foreground shrink-0">الجهة الموجه إليها:</span>
            <input
              type="text"
              value={destinationEntity}
              onChange={(e) => setDestinationEntity(e.target.value)}
              placeholder="مثال: بنك الراجحي / السفارة البريطانية بالرياض..."
              className="flex-1 h-8 rounded-full border border-border/80 bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        )}

        {/* Printable A4 Document Sheet */}
        <div
          id="printable-official-letter-sheet"
          className="p-8 my-4 mx-auto bg-white text-slate-900 max-w-2xl rounded-2xl shadow-xl border border-slate-200 space-y-6 font-sans text-xs leading-relaxed print:m-0 print:p-8 print:shadow-none print:border-0 print:max-w-none"
        >
          {/* Header with Official Logo & Corporate Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div className="space-y-1">
              <h1 className="text-base font-black text-slate-900">
                شركة فوكس للتقنية وحلول الأعمال المتطورة
              </h1>
              <p className="text-[11px] text-slate-600 font-medium">
                سجل تجاري: 1010789654 • الرقم الضريبي: 300098765400003 • رقم 700: 7001928374
              </p>
              <p className="text-[11px] text-slate-600">الرياض - المقر الرئيسي - المملكة العربية السعودية</p>
            </div>
            <div className="text-end space-y-1 font-mono text-[11px]">
              <p className="font-bold text-slate-900">المرجع: {refNo}</p>
              <p className="text-slate-600">التاريخ: {currentDate}</p>
            </div>
          </div>

          {/* Document Title Banner */}
          <div className="text-center py-2.5 border-y-2 border-slate-900 bg-slate-50">
            <h2 className="text-base font-black text-slate-900 tracking-wide">
              {getDocTitle(currentDocType)}
            </h2>
          </div>

          {/* Recipient Notice */}
          <div className="font-bold text-slate-800 text-xs">
            سعادة / {destinationEntity} .. المحترمين
          </div>

          {/* DOCUMENT BODY 1: SALARY CERTIFICATE */}
          {currentDocType === "salary_certificate" && (
            <div className="space-y-4 text-justify text-slate-800 text-xs leading-6">
              <p>
                تحية طيبة وبعد ،،<br />
                تشهد شركة فوكس للتقنية وحلول الأعمال بأن الموظف الموضحة بياناته أدناه يعمل لدينا
                وتحت كفالتنا، وما زال على رأس العمل حتى تاريخ إصدار هذه الشهادة:
              </p>

              <div className="rounded-xl border border-slate-300 p-3 space-y-2 bg-slate-50">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-semibold text-slate-600">اسم الموظف:</span>{" "}
                    <span className="font-bold text-slate-900">
                      {employee.firstNameAr} {employee.lastNameAr}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">الجنسية:</span>{" "}
                    <span className="font-bold text-slate-900">{employee.nationality}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">رقم الهوية / الإقامة:</span>{" "}
                    <span className="font-bold font-mono text-slate-900">
                      {employee.nationalIdOrIqama}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">الرقم الوظيفي:</span>{" "}
                    <span className="font-bold font-mono text-slate-900">
                      {employee.employeeNo}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">المسمى الوظيفي:</span>{" "}
                    <span className="font-bold text-slate-900">{employee.jobTitleAr}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">تاريخ المباشرة:</span>{" "}
                    <span className="font-bold font-mono text-slate-900">{employee.hireDate}</span>
                  </div>
                </div>
              </div>

              <p className="font-bold text-slate-900">تفاصيل الراتب والبدلات الشهرية الثابتة:</p>

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
                    <td className="py-2.5 border-l border-slate-300">
                      {employee.basicSalary.toLocaleString()} ر.س
                    </td>
                    <td className="py-2.5 border-l border-slate-300">
                      {(employee.housingAllowance || Math.round(employee.basicSalary * 0.25)).toLocaleString()} ر.س
                    </td>
                    <td className="py-2.5 border-l border-slate-300">
                      {(employee.transportAllowance || Math.round(employee.basicSalary * 0.08)).toLocaleString()} ر.س
                    </td>
                    <td className="py-2.5 font-black bg-slate-50 text-slate-900">
                      {employee.totalSalary.toLocaleString()} ر.س
                    </td>
                  </tr>
                </tbody>
              </table>

              <p className="text-[11px] text-slate-600">
                وقد أُعطيت له هذه الشهادة بناءً على طلبه لتقديمها إلى الجهة المذكورة أعلاه دون أدنى
                مسؤولية مالية أو كفالة حقوقية على الشركة تجاه التزامات الموظف الشخصية.
              </p>
            </div>
          )}

          {/* DOCUMENT BODY 2: BANK ACCOUNT OPENING */}
          {currentDocType === "bank_account_letter" && (
            <div className="space-y-4 text-justify text-slate-800 text-xs leading-6">
              <p>
                تحية طيبة وبعد ،،<br />
                يرجى التكرم بفتح حساب بنكي جاري للموظف الموضحة بياناته أدناه، وذلك لغرض تحويل مستحقاته المالية الشهرية عبر نظام حماية الأجور السعودي (WPS):
              </p>

              <div className="rounded-xl border border-slate-300 p-3 space-y-2 bg-slate-50">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-semibold text-slate-600">اسم الموظف:</span>{" "}
                    <span className="font-bold text-slate-900">
                      {employee.firstNameAr} {employee.lastNameAr}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">الجنسية:</span>{" "}
                    <span className="font-bold text-slate-900">{employee.nationality}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">رقم الهوية / الإقامة:</span>{" "}
                    <span className="font-bold font-mono text-slate-900">
                      {employee.nationalIdOrIqama}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">المسمى الوظيفي:</span>{" "}
                    <span className="font-bold text-slate-900">{employee.jobTitleAr}</span>
                  </div>
                </div>
              </div>

              <p>
                وتؤكد الشركة التزامها بتحويل الراتب الشهري البالغ ({employee.totalSalary.toLocaleString()} ر.س) بانتظام فور تزويدنا برقم الحساب البنكي والآيبان (IBAN) المعتمد.
              </p>
            </div>
          )}

          {/* DOCUMENT BODY 3: EMBASSY VISA LETTER */}
          {currentDocType === "embassy_visa_letter" && (
            <div className="space-y-4 text-justify text-slate-800 text-xs leading-6">
              <p>
                To Whom It May Concern / Embassy Visa Section,<br />
                This is to certify that Mr./Ms. <strong>{employee.firstNameEn} {employee.lastNameEn}</strong>, holding {employee.nationality} Nationality, Passport No: <strong>{employee.passportNo || "N/A"}</strong> and National/Iqama ID: <strong>{employee.nationalIdOrIqama}</strong>, is currently employed with FOCUS Technology & Business Solutions as a full-time <strong>{employee.jobTitleEn || employee.jobTitleAr}</strong>.
              </p>
              <p>
                The employee has been with our company since <strong>{employee.hireDate}</strong> and receives a total monthly salary of <strong>SAR {employee.totalSalary.toLocaleString()}</strong>.
              </p>
              <p>
                We confirm that the employee has been granted annual leave and will resume work immediately following their trip. The company guarantees that the employee will return to their position in Saudi Arabia upon completion of their approved travel period.
              </p>
            </div>
          )}

          {/* DOCUMENT BODY 4: CLEARANCE LETTER */}
          {currentDocType === "clearance_letter" && (
            <div className="space-y-4 text-justify text-slate-800 text-xs leading-6">
              <p>
                تحية طيبة وبعد ،،<br />
                تشهد شركة فوكس للتقنية بأن الموظف / <strong>{employee.firstNameAr} {employee.lastNameAr}</strong> (هوية رقم: <span className="font-mono font-bold">{employee.nationalIdOrIqama}</span>) قد أنهى خدمته لدى الشركة بصورة نظامية، وقد تم تسليمه كافة مستحقاته النظامية ومكافأة نهاية الخدمة وفقاً للمادتين 84 و 85 من نظام العمل السعودي.
              </p>
              <p>
                كما تشهد الشركة بأن الموظف قد قام بإخلاء طرفه وتسليم كافة العهد والأصول والمستندات المسلمة إليه أثناء فترة عمله، وبهذا تعتبر ذمته بريئة تجاه الشركة من أي التزامات وظيفية أو مالية حتى تاريخه.
              </p>
            </div>
          )}

          {/* DOCUMENT BODY 5: EXPERIENCE CERTIFICATE */}
          {currentDocType === "experience_certificate" && (
            <div className="space-y-4 text-justify text-slate-800 text-xs leading-6">
              <p>
                تحية طيبة وبعد ،،<br />
                تشهد إدارة الموارد البشرية بشركة فوكس للتقنية بأن الموظف / <strong>{employee.firstNameAr} {employee.lastNameAr}</strong> قد عمل لدينا في وظيفة (<strong>{employee.jobTitleAr}</strong>) في قطاع ({employee.departmentName}) خلال الفترة من (<span className="font-mono font-bold">{employee.hireDate}</span>) وحتى تاريخه.
              </p>
              <p>
                وخلال فترة خدمته تميز بالانضباط المهني والكفاءة العالية وحسن السيرة والسلوك والالتزام بقوانين العمل. وقد أُعطيت له هذه الشهادة بناءً على طلبه كشهادة خبرة دون أدنى مسؤولية على الشركة.
              </p>
            </div>
          )}

          {/* DOCUMENT BODY 6: QIWA CONTRACT */}
          {currentDocType === "employment_contract" && (
            <div className="space-y-3 text-slate-800 text-xs leading-5">
              <p className="font-bold">الطرف الأول (صاحب العمل): شركة فوكس للتقنية وحلول الأعمال</p>
              <p className="font-bold">
                الطرف الثاني (الموظف): {employee.firstNameAr} {employee.lastNameAr} - هوية رقم (
                {employee.nationalIdOrIqama})
              </p>
              <div className="border-t pt-2 space-y-1.5 text-justify">
                <p>
                  1. <strong>المسمى الوظيفي:</strong> يعمل الطرف الثاني لدى الطرف الأول بمهنة (
                  {employee.jobTitleAr}) في مدينة ({employee.workLocationName}).
                </p>
                <p>
                  2. <strong>الأجر والمزايا:</strong> يتقاضى الطرف الثاني أجراً أساسياً قدره (
                  {employee.basicSalary.toLocaleString()} ر.س) بالإضافة للبدلات المتفق عليها بإجمالي
                  ({employee.totalSalary.toLocaleString()} ر.س) شهرياً يحول عبر نظام حماية الأجور
                  WPS.
                </p>
                <p>
                  3. <strong>فترة التجربة:</strong> يخضع الطرف الثاني لفترة تجربة مدتها 90 يوماً
                  قابلة للتمديد إلى 180 يوماً بموجب اتفاق كتابي وفق نظام العمل السعودي.
                </p>
                <p>
                  4. <strong>ساعات العمل والإجازات:</strong> 8 ساعات عمل يومياً، ويستحق الموظف إجازة
                  سنوية مدفوعة الأجر مدتها 30 يوماً عن كل عام خدمة.
                </p>
              </div>
            </div>
          )}

          {/* Stamp, Signature & Electronic Verification Footer */}
          <div className="border-t-2 border-slate-900 pt-6 mt-8 flex justify-between items-end">
            <div className="space-y-1">
              <p className="font-bold text-slate-900">إدارة الموارد البشرية والشؤون القانونية</p>
              <p className="text-[11px] text-slate-600">شركة فوكس للتقنية وحلول الأعمال</p>
              <div className="h-16 w-36 border-2 border-dashed border-emerald-600 rounded-lg flex items-center justify-center text-emerald-700 font-black text-[11px] mt-2 rotate-[-4deg]">
                ختم الموارد البشرية المعتمد
              </div>
            </div>

            <div className="text-center space-y-1">
              <div className="h-16 w-16 mx-auto border-2 border-slate-900 rounded-lg p-1 flex items-center justify-center">
                <QrCode className="h-12 w-12 text-slate-900" />
              </div>
              <span className="text-[9px] font-mono text-slate-500 block">
                رمز التحقق الإلكتروني المعتمد
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
