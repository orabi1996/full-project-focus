import type {
  CompanyProfile,
  OrgUnit,
  WorkLocation,
  CostCenter,
  JobPosition,
  ShiftDefinition,
  LeaveTypePolicy,
} from "../../../types";

export interface SetupStage {
  id: string;
  title: string;
  category: "base" | "operational" | "governance";
  complete: boolean;
  weight: number;
  description: string;
  missingNote?: string;
  actionTab: "company" | "org" | "locations" | "shifts" | "leaves" | "users";
}

export interface SetupProgressResult {
  percentage: number;
  isFullyConfigured: boolean;
  baseRequirementsMet: boolean;
  stages: SetupStage[];
  missingFields: string[];
  companyStatus: "missing" | "incomplete" | "complete";
}

export function calculateSetupProgress(params: {
  company: CompanyProfile | null | undefined;
  orgUnits: OrgUnit[];
  workLocations: WorkLocation[];
  costCenters?: CostCenter[];
  jobPositions?: JobPosition[];
  shifts: ShiftDefinition[];
  leaveTypes: LeaveTypePolicy[];
  activeUsersCount?: number;
}): SetupProgressResult {
  const {
    company,
    orgUnits,
    workLocations,
    costCenters = [],
    jobPositions = [],
    shifts,
    leaveTypes,
    activeUsersCount = 1,
  } = params;

  const missingFields: string[] = [];

  // 1. Company Legal & Establishment Profile (Base requirement)
  const hasLegalName = Boolean(company?.legalNameAr && company.legalNameAr.trim() !== "");
  const hasCrNumber = Boolean(company?.crNumber && company.crNumber.trim() !== "");
  const hasTaxNumber = Boolean(company?.taxNumber && company.taxNumber.trim() !== "");

  if (!hasLegalName) missingFields.push("اسم المنشأة بالعربية (الأندلس)");
  if (!hasCrNumber) missingFields.push("رقم السجل التجاري الرسمي");
  if (!hasTaxNumber) missingFields.push("الرقم الضريبي (خاص بالمعاملات المالية والفوترة)");

  // Base company is ready if legal name and CR number are filled
  const isCompanyBaseComplete = hasLegalName && hasCrNumber;

  // 2. Organization Structure
  const isOrgComplete = (orgUnits || []).length > 0;
  if (!isOrgComplete) missingFields.push("إضافة إدارة أو قسم واحد على الأقل في الهيكل");

  // 3. Work Locations & Geofence
  const isLocationsComplete = (workLocations || []).length > 0;
  if (!isLocationsComplete) missingFields.push("إضافة مقر عمل أو فرع رئيسي مع تحديد النطاق الجغرافي");

  // 4. Shifts and Working Hours
  const isShiftsComplete = (shifts || []).length > 0;
  if (!isShiftsComplete) missingFields.push("تعريف وردية دوام أساسية واحدة على الأقل");

  // 5. Leave Policies
  const isLeavesComplete = (leaveTypes || []).length > 0;
  if (!isLeavesComplete) missingFields.push("تعريف لائحة الإجازات وسياسة الاستحقاق السنوي");

  // 6. User Company Governance
  const isUsersLinked = activeUsersCount > 0;
  if (!isUsersLinked) missingFields.push("ربط واعتماد المستخدمين المصرح لهم بنطاق شركة الأندلس");

  const stages: SetupStage[] = [
    {
      id: "company_profile",
      title: "بيانات السجل والمنشأة",
      category: "base",
      complete: isCompanyBaseComplete,
      weight: 25,
      description: "توثيق الاسم القانوني لشركة «الأندلس» والسجل التجاري المعتمد",
      missingNote: !hasCrNumber ? "يلزم إدخال رقم السجل التجاري لإثبات هوية المنشأة" : undefined,
      actionTab: "company",
    },
    {
      id: "organization_structure",
      title: "الهيكل التنظيمي والأقسام",
      category: "base",
      complete: isOrgComplete,
      weight: 20,
      description: "بناء الإدارات والأقسام التابعة لشركة الأندلس دون افتراض أقسام وهمية",
      missingNote: !isOrgComplete ? "لم تتم إضافة أقسام بعد — أضف أول قسم من التهيئة" : undefined,
      actionTab: "org",
    },
    {
      id: "work_locations",
      title: "مقار العمل والسياج الجغرافي",
      category: "base",
      complete: isLocationsComplete,
      weight: 15,
      description: "تحديد المقر الرئيسي والفروع مع نطاق البصمة الذكية (GPS Geofence)",
      missingNote: !isLocationsComplete ? "لم تتم إضافة مقار عمل بعد" : undefined,
      actionTab: "locations",
    },
    {
      id: "shifts_definitions",
      title: "سياسات وورديات العمل",
      category: "operational",
      complete: isShiftsComplete,
      weight: 15,
      description: "تحديد مواعيد وساعات العمل وقواعد السماح واحتساب الإضافي",
      missingNote: !isShiftsComplete ? "لم يتم تعريف ورديات بعد" : undefined,
      actionTab: "shifts",
    },
    {
      id: "leave_policies",
      title: "لوائح وأنواع الإجازات",
      category: "operational",
      complete: isLeavesComplete,
      weight: 15,
      description: "تعريف أنواع الإجازات (سنوية، مرضية) والاستحقاق وسياسات الترحيل",
      missingNote: !isLeavesComplete ? "لم يتم تعريف سياسات إجازات بعد" : undefined,
      actionTab: "leaves",
    },
    {
      id: "user_governance",
      title: "حوكمة وربط المستخدمين",
      category: "governance",
      complete: isUsersLinked,
      weight: 10,
      description: "ربط واعتماد حسابات الدخول بنطاق شركة الأندلس مع التحقق من الصلاحيات",
      missingNote: !isUsersLinked ? "بانتظار مراجعة ربط الحسابات" : undefined,
      actionTab: "users",
    },
  ];

  const completedWeight = stages.filter((s) => s.complete).reduce((acc, s) => acc + s.weight, 0);
  const isFullyConfigured = completedWeight === 100;
  const baseRequirementsMet = isCompanyBaseComplete && isOrgComplete && isLocationsComplete;

  let companyStatus: "missing" | "incomplete" | "complete" = "incomplete";
  if (!company || !company.id) {
    companyStatus = "missing";
  } else if (isFullyConfigured) {
    companyStatus = "complete";
  }

  return {
    percentage: completedWeight,
    isFullyConfigured,
    baseRequirementsMet,
    stages,
    missingFields,
    companyStatus,
  };
}
