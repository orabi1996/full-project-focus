import type { RequestCategory } from "../../../types";

export interface RequestCatalogItem {
  code: RequestCategory;
  nameAr: string;
  nameEn: string;
  active: boolean;
  requiredFields: string[];
  attachmentRequirement: "mandatory" | "optional" | "none";
  domainHandler: "leave" | "attendance" | "expenses" | "loans" | "payroll" | "hrms" | "assets" | "shifts" | "generic";
  employeeVisibility: boolean;
  icon: string;
  descriptionAr: string;
  descriptionEn: string;
}

export const CANONICAL_REQUEST_CATALOG: RequestCatalogItem[] = [
  {
    code: "leave",
    nameAr: "إجازة اعتيادية / اضطرارية",
    nameEn: "Leave Request",
    active: true,
    requiredFields: ["startDate", "endDate", "leaveTypeId"],
    attachmentRequirement: "optional",
    domainHandler: "leave",
    employeeVisibility: true,
    icon: "Calendar",
    descriptionAr: "طلب إجازة سنوية، مرضية، أو اضطرارية مرتبطة بمحرك الإجازات المعتمد",
    descriptionEn: "Annual, sick, or emergency leave tied to authoritative leave engine",
  },
  {
    code: "attendance_correction",
    nameAr: "تصحيح حركة حضور / بصمة",
    nameEn: "Attendance Correction",
    active: true,
    requiredFields: ["workDate", "correctionType"],
    attachmentRequirement: "optional",
    domainHandler: "attendance",
    employeeVisibility: true,
    icon: "Clock",
    descriptionAr: "طلب تصحيح بصمة منسية أو حركة دوام مع إرفاق الإثبات",
    descriptionEn: "Correction of missed punch or shift presence with evidence",
  },
  {
    code: "overtime",
    nameAr: "طلب عمل إضافي",
    nameEn: "Overtime Request",
    active: true,
    requiredFields: ["workDate", "hours"],
    attachmentRequirement: "optional",
    domainHandler: "attendance",
    employeeVisibility: true,
    icon: "ClockAlert",
    descriptionAr: "طلب اعتماد وتوثيق ساعات العمل الإضافي وفق لوائح الدوام",
    descriptionEn: "Request approval for overtime hours per attendance rules",
  },
  {
    code: "expense_claim",
    nameAr: "مطالبة استرداد مصروفات",
    nameEn: "Expense Claim",
    active: true,
    requiredFields: ["amount", "expenseCategoryId"],
    attachmentRequirement: "mandatory",
    domainHandler: "expenses",
    employeeVisibility: true,
    icon: "Receipt",
    descriptionAr: "طلب استرداد نفقات ومصاريف العمل مع إرفاق الفواتير الضريبية",
    descriptionEn: "Business expense reimbursement request with mandatory tax receipts",
  },
  {
    code: "loan_advance",
    nameAr: "طلب سلفة / قرض مالي",
    nameEn: "Loan Advance",
    active: true,
    requiredFields: ["amount", "installmentsCount"],
    attachmentRequirement: "optional",
    domainHandler: "loans",
    employeeVisibility: true,
    icon: "Wallet",
    descriptionAr: "طلب سلفة راتب أو قرض مالي وتحديد جدول الأقساط الشهرية",
    descriptionEn: "Salary advance or loan with installment schedule",
  },
  {
    code: "salary_certificate",
    nameAr: "مشهد تعريف بالراتب",
    nameEn: "Salary Certificate",
    active: true,
    requiredFields: ["purpose"],
    attachmentRequirement: "none",
    domainHandler: "payroll",
    employeeVisibility: true,
    icon: "FileText",
    descriptionAr: "طلب خطاب تعريف بالراتب موجه للجهات الحكومية أو المصرفية",
    descriptionEn: "Official salary letter addressed to bank or governmental authority",
  },
  {
    code: "resignation",
    nameAr: "إشعار استقالة / إنهاء خدمة",
    nameEn: "Resignation Notice",
    active: true,
    requiredFields: ["effectiveDate", "reason"],
    attachmentRequirement: "optional",
    domainHandler: "hrms",
    employeeVisibility: true,
    icon: "UserX",
    descriptionAr: "تقديم إشعار رغبة في إنهاء العقد وبدء فترة الإنذار النظامية",
    descriptionEn: "Contract termination notice and statutory notice period",
  },
  {
    code: "asset_request",
    nameAr: "طلب صرف عهدة / أصل",
    nameEn: "Asset Request",
    active: true,
    requiredFields: ["assetType", "reason"],
    attachmentRequirement: "optional",
    domainHandler: "assets",
    employeeVisibility: true,
    icon: "Laptop",
    descriptionAr: "طلب استلام جهاز كمبيوتر، هاتف، أو أصل وظيفي للعمل",
    descriptionEn: "Request for work laptop, phone, or company asset",
  },
  {
    code: "shift_swap",
    nameAr: "طلب تبادل وردية",
    nameEn: "Shift Swap",
    active: true,
    requiredFields: ["myAssignmentId", "targetAssignmentId"],
    attachmentRequirement: "none",
    domainHandler: "shifts",
    employeeVisibility: true,
    icon: "ArrowLeftRight",
    descriptionAr: "طلب تبادل وردية عمل مع زميل ضمن نفس جدول المناوبات المعتمد",
    descriptionEn: "Shift exchange request with a colleague in the published roster",
  },
  {
    code: "general",
    nameAr: "طلب إداري عام",
    nameEn: "General Administrative Request",
    active: true,
    requiredFields: ["reason"],
    attachmentRequirement: "optional",
    domainHandler: "generic",
    employeeVisibility: true,
    icon: "Folder",
    descriptionAr: "طلب استثنائي أو إداري عام يتبع دورة الاعتماد المعيارية",
    descriptionEn: "General administrative or exceptional service request",
  },
];

export function getRequestCatalogItem(code: RequestCategory): RequestCatalogItem {
  const item = CANONICAL_REQUEST_CATALOG.find((c) => c.code === code);
  if (!item) {
    return {
      code,
      nameAr: code,
      nameEn: code,
      active: true,
      requiredFields: [],
      attachmentRequirement: "optional",
      domainHandler: "generic",
      employeeVisibility: true,
      icon: "File",
      descriptionAr: "طلب خدمة",
      descriptionEn: "Service request",
    };
  }
  return item;
}
