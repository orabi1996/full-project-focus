import type { DataScope } from "../../types";

export interface ScreenModuleConfig {
  id: string;
  code: string;
  category:
    | "core"
    | "workforce"
    | "operations"
    | "finance"
    | "talent"
    | "governance"
    | "self_service";
  categoryNameAr: string;
  categoryNameEn: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  iconName: string;
}

export interface ScreenActionPermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approveExport: boolean;
}

export interface PermissionGroup {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn?: string;
  isSystem: boolean;
  iconName?: string;
  color?: string;
  dataScope: DataScope;
  memberUserIds: string[];
  screens: Record<string, ScreenActionPermissions>;
}

export const ALL_SYSTEM_SCREENS: readonly ScreenModuleConfig[] = [
  // 1. Core
  {
    id: "dashboard",
    code: "M01",
    category: "core",
    categoryNameAr: "الرئيسية والمؤشرات",
    categoryNameEn: "Executive Dashboard",
    nameAr: "لوحة المعلومات والمؤشرات اللحظية",
    nameEn: "Executive Dashboard & KPI",
    descriptionAr: "المؤشرات الإحصائية العامة، تنبيهات الإجراءات، ونبض المنشأة المالي والإداري.",
    iconName: "dashboard",
  },
  {
    id: "organization",
    code: "M02",
    category: "core",
    categoryNameAr: "الهيكل والمواقع",
    categoryNameEn: "Organization Structure",
    nameAr: "الهيكل التنظيمي ومواقع العمل والسياج الجغرافي",
    nameEn: "Org Structure & Geofencing",
    descriptionAr: "الشركات التابعة، الإدارات، الأقسام، الفروع ومناطق السياج الجغرافي GPS.",
    iconName: "corporate_fare",
  },
  {
    id: "employees",
    code: "M03",
    category: "core",
    categoryNameAr: "شؤون الموظفين",
    categoryNameEn: "Employee Management",
    nameAr: "سجل الموظفين والملف الموحد 360°",
    nameEn: "Employee Master & 360° Profile",
    descriptionAr: "إدارة بيانات الموظفين الشاملة، العقود، الرواتب، الوثائق، وتعديل الحالات.",
    iconName: "badge",
  },
  {
    id: "documents",
    code: "M04",
    category: "core",
    categoryNameAr: "الوثائق والشهادات",
    categoryNameEn: "Document Vault",
    nameAr: "مستودع الوثائق والخطابات الرسمية",
    nameEn: "Document Vault & Letters",
    descriptionAr: "إصدار الخطابات الرسمية، تصديق العقود، أرشيف المستندات والتحقق عبر QR.",
    iconName: "folder_shared",
  },
  {
    id: "rbac",
    code: "M05",
    category: "governance",
    categoryNameAr: "الأمان والامتثال",
    categoryNameEn: "Security & Governance",
    nameAr: "مصفوفة الصلاحيات والمجموعات والأمان",
    nameEn: "RBAC & Security Groups",
    descriptionAr: "إدارة مجموعات المستخدمين، مصفوفة الصلاحيات التفصيلية، ونطاقات البيانات.",
    iconName: "admin_panel_settings",
  },

  // 2. Operations & Daily Work
  {
    id: "workflow",
    code: "M06",
    category: "operations",
    categoryNameAr: "الوقت والعمليات",
    categoryNameEn: "Workflow Engine",
    nameAr: "محرك الاعتمادات ومسارات العمل الذكية",
    nameEn: "Approvals & Workflow Engine",
    descriptionAr: "إدارة سلاسل الاعتماد متعددة المستويات، اتخاذ قرارات القبول والرفض والإحالة.",
    iconName: "approval_delegation",
  },
  {
    id: "leaves",
    code: "M07",
    category: "operations",
    categoryNameAr: "الوقت والعمليات",
    categoryNameEn: "Leave Management",
    nameAr: "الإجازات والعطلات وإدارة الأرصدة",
    nameEn: "Leaves & Time-Off Balances",
    descriptionAr: "طلبات الإجازات السنوية والمرضية، احتساب الأرصدة وفق نظام العمل والترحيل.",
    iconName: "event_available",
  },
  {
    id: "attendance",
    code: "M08",
    category: "operations",
    categoryNameAr: "الوقت والعمليات",
    categoryNameEn: "Attendance & Biometrics",
    nameAr: "الحضور والانصراف وأجهزة البصمة",
    nameEn: "Attendance & Biometric Devices",
    descriptionAr: "سجلات التبصيم الحي، ربط أجهزة البصمة، معالجة التأخير والغياب والاستئذان.",
    iconName: "schedule",
  },
  {
    id: "shifts",
    code: "M09",
    category: "operations",
    categoryNameAr: "الوقت والعمليات",
    categoryNameEn: "Shifts & Rostering",
    nameAr: "الورديات وجداول الدوام ومناوبات العمل",
    nameEn: "Shifts & Shift Rostering",
    descriptionAr: "تصميم الورديات الصباحية والمسائية والمناوبات، وجدولة الموظفين أسبوعياً وشهرياً.",
    iconName: "calendar_month",
  },

  // 3. Payroll & Finance
  {
    id: "payroll",
    code: "M10",
    category: "finance",
    categoryNameAr: "الرواتب والمالية",
    categoryNameEn: "Payroll & Compensation",
    nameAr: "مسيرات الرواتب وحماية الأجور WPS",
    nameEn: "Payroll Runs & Wage Protection",
    descriptionAr: "احتساب الرواتب، البدلات، الخصومات، التأمينات GOSI، وتصدير ملفات WPS SIF.",
    iconName: "account_balance_wallet",
  },
  {
    id: "loans",
    code: "M11",
    category: "finance",
    categoryNameAr: "الرواتب والمالية",
    categoryNameEn: "Loans & EOSB",
    nameAr: "السلف ومكافأة نهاية الخدمة EOSB والمخالصات",
    nameEn: "Loans & End-of-Service (EOSB)",
    descriptionAr: "إدارة أقساط السلف، جدول الاستقطاع، وحساب مكافأة نهاية الخدمة حسب نظام العمل.",
    iconName: "credit_card",
  },
  {
    id: "expenses",
    code: "M12",
    category: "finance",
    categoryNameAr: "الرواتب والمالية",
    categoryNameEn: "Expense Claims",
    nameAr: "إدارة النفقات والمصروفات والعهد النقدية",
    nameEn: "Petty Cash & Expense Claims",
    descriptionAr: "مطالبات استرداد المصاريف، الفواتير الضريبية، سداد العهد، والترحيل المالي.",
    iconName: "receipt_long",
  },

  // 4. Talent & Workforce Growth
  {
    id: "ats",
    code: "M13",
    category: "talent",
    categoryNameAr: "المواهب والنمو",
    categoryNameEn: "Talent Acquisition",
    nameAr: "التوظيف واستقطاب الكفاءات ATS",
    nameEn: "Recruitment & Applicant Tracking",
    descriptionAr: "إعلانات الوظائف، تتبع المرشحين Kanban، مقابلات التقييم، وإصدار عروض العمل.",
    iconName: "person_search",
  },
  {
    id: "performance",
    code: "M14",
    category: "talent",
    categoryNameAr: "المواهب والنمو",
    categoryNameEn: "Performance Management",
    nameAr: "تقييم الأداء والمراجعات 360° والأهداف",
    nameEn: "Performance & OKRs / 360°",
    descriptionAr: "دورات التقييم السنوية والنصفية، تقييم الجدارات، الأهداف OKRs ومصفوفة 9-Box.",
    iconName: "stars",
  },
  {
    id: "workforce",
    code: "M15",
    category: "talent",
    categoryNameAr: "المواهب والنمو",
    categoryNameEn: "Workforce Planning",
    nameAr: "تخطيط القوى العاملة والميزانيات التقديرية",
    nameEn: "Strategic Workforce Planning",
    descriptionAr: "مخططات الشواغر الوظيفية، ميزانيات التوظيف المستقبلية، ومعدلات الدوران الوظيفي.",
    iconName: "monitoring",
  },

  // 5. Governance & Enterprise Ecosystem
  {
    id: "assets",
    code: "M16",
    category: "governance",
    categoryNameAr: "العهد والأصول",
    categoryNameEn: "Asset Management",
    nameAr: "إدارة العهد والأصول التقنية والمكتبية",
    nameEn: "IT & Hardware Asset Tracking",
    descriptionAr: "تسليم واستلام العهد، الأجهزة المحمولة، المركبات، ونماذج إخلاء الطرف.",
    iconName: "devices",
  },
  {
    id: "reports",
    code: "M17",
    category: "governance",
    categoryNameAr: "التقارير والاستعلام",
    categoryNameEn: "BI & Reporting",
    nameAr: "التقارير ومولد الاستعلامات الذكية والتصدير",
    nameEn: "BI Reports & Analytics Studio",
    descriptionAr: "توليد تقارير الامتثال، نسب التوطين (نطاقات)، كشوفات التأمينات، وتصدير Excel/PDF.",
    iconName: "analytics",
  },
  {
    id: "integrations",
    code: "M18",
    category: "governance",
    categoryNameAr: "التكامل والربط",
    categoryNameEn: "Integrations & API",
    nameAr: "تكاملات الأنظمة والقيود وWebhooks",
    nameEn: "ERP Integrations & Webhooks",
    descriptionAr: "الربط مع منصات مدد، مقيم، قوى، أنظمة تخطيط الموارد ERP وسجلات الويب هوكس.",
    iconName: "hub",
  },
  {
    id: "audit",
    code: "M19",
    category: "governance",
    categoryNameAr: "التدقيق والرقابة",
    categoryNameEn: "Audit & Compliance",
    nameAr: "سجل التدقيق والامتثال والأمان المؤسسي",
    nameEn: "Audit Trail & Compliance Log",
    descriptionAr: "سجل غير قابل للتعديل لكافة العمليات الحساسة، أوقات التعديل، وهوية المنفذين.",
    iconName: "verified_user",
  },

  // 6. Self-Service
  {
    id: "ess",
    code: "M20",
    category: "self_service",
    categoryNameAr: "الخدمة الذاتية",
    categoryNameEn: "Employee Self-Service",
    nameAr: "بوابة الخدمة الذاتية للموظف ESS",
    nameEn: "Employee Self-Service Portal",
    descriptionAr: "الوصول الشخصي للبيانات، كشوف الرواتب، طلبات الإجازات، والتبصيم الذكي.",
    iconName: "smartphone",
  },
];

// Helper to build full CRUD permissions for all screens
export function createFullAccessScreenMap(): Record<string, ScreenActionPermissions> {
  const map: Record<string, ScreenActionPermissions> = {};
  for (const screen of ALL_SYSTEM_SCREENS) {
    map[screen.id] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
      approveExport: true,
    };
  }
  return map;
}

// Helper to build read-only permissions for all screens
export function createReadOnlyScreenMap(): Record<string, ScreenActionPermissions> {
  const map: Record<string, ScreenActionPermissions> = {};
  for (const screen of ALL_SYSTEM_SCREENS) {
    map[screen.id] = {
      view: true,
      create: false,
      edit: false,
      delete: false,
      approveExport: true,
    };
  }
  return map;
}

// Initial Enterprise Permission Groups
export const INITIAL_ENTERPRISE_GROUPS: PermissionGroup[] = [
  {
    id: "grp-superadmin",
    code: "super_admin",
    nameAr: "مجموعة الإدارة العامة والنظام (Super Admin)",
    nameEn: "System & Executive Administrators",
    descriptionAr: "صلاحيات سيادية كاملة وغير مقيدة على كافة الشاشات والعمليات وإعدادات الأمان.",
    isSystem: true,
    iconName: "admin_panel_settings",
    color: "#4f46e5", // Indigo
    dataScope: "all",
    memberUserIds: ["emp-01", "emp-04"],
    screens: createFullAccessScreenMap(),
  },
  {
    id: "grp-hrmanager",
    code: "hr_manager",
    nameAr: "مجموعة مدراء الموارد البشرية والشؤون الإدارية",
    nameEn: "HR & People Operations Leads",
    descriptionAr:
      "إدارة شاملة لملفات الموظفين، العقود، الإجازات، الحضور، مسارات التوظيف، وتخطيط القوى العاملة.",
    isSystem: true,
    iconName: "groups",
    color: "#0284c7", // Sky
    dataScope: "all",
    memberUserIds: ["emp-04", "emp-02"],
    screens: {
      dashboard: { view: true, create: false, edit: false, delete: false, approveExport: true },
      organization: { view: true, create: true, edit: true, delete: false, approveExport: true },
      employees: { view: true, create: true, edit: true, delete: true, approveExport: true },
      documents: { view: true, create: true, edit: true, delete: true, approveExport: true },
      rbac: { view: true, create: false, edit: false, delete: false, approveExport: false },
      workflow: { view: true, create: true, edit: true, delete: false, approveExport: true },
      leaves: { view: true, create: true, edit: true, delete: true, approveExport: true },
      attendance: { view: true, create: true, edit: true, delete: false, approveExport: true },
      shifts: { view: true, create: true, edit: true, delete: true, approveExport: true },
      payroll: { view: true, create: false, edit: false, delete: false, approveExport: true },
      loans: { view: true, create: true, edit: true, delete: false, approveExport: true },
      expenses: { view: true, create: true, edit: true, delete: false, approveExport: true },
      ats: { view: true, create: true, edit: true, delete: true, approveExport: true },
      performance: { view: true, create: true, edit: true, delete: true, approveExport: true },
      workforce: { view: true, create: true, edit: true, delete: false, approveExport: true },
      assets: { view: true, create: true, edit: true, delete: true, approveExport: true },
      reports: { view: true, create: true, edit: false, delete: false, approveExport: true },
      integrations: { view: true, create: false, edit: false, delete: false, approveExport: false },
      audit: { view: true, create: false, edit: false, delete: false, approveExport: true },
      ess: { view: true, create: true, edit: true, delete: false, approveExport: true },
    },
  },
  {
    id: "grp-payroll",
    code: "payroll_finance",
    nameAr: "مجموعة إدارة الرواتب والمالية وحماية الأجور",
    nameEn: "Payroll & Financial Controllers",
    descriptionAr:
      "احتساب واعتماد مسيرات الرواتب الشهرية، ملفات WPS، السلف والمخالصات، والتقارير المالية.",
    isSystem: true,
    iconName: "account_balance_wallet",
    color: "#059669", // Emerald
    dataScope: "all",
    memberUserIds: ["emp-03", "emp-07"],
    screens: {
      dashboard: { view: true, create: false, edit: false, delete: false, approveExport: true },
      organization: { view: true, create: false, edit: false, delete: false, approveExport: false },
      employees: { view: true, create: false, edit: false, delete: false, approveExport: true },
      documents: { view: true, create: true, edit: true, delete: false, approveExport: true },
      rbac: { view: false, create: false, edit: false, delete: false, approveExport: false },
      workflow: { view: true, create: true, edit: true, delete: false, approveExport: true },
      leaves: { view: true, create: false, edit: false, delete: false, approveExport: true },
      attendance: { view: true, create: false, edit: false, delete: false, approveExport: true },
      shifts: { view: true, create: false, edit: false, delete: false, approveExport: false },
      payroll: { view: true, create: true, edit: true, delete: true, approveExport: true },
      loans: { view: true, create: true, edit: true, delete: true, approveExport: true },
      expenses: { view: true, create: true, edit: true, delete: true, approveExport: true },
      ats: { view: false, create: false, edit: false, delete: false, approveExport: false },
      performance: { view: false, create: false, edit: false, delete: false, approveExport: false },
      workforce: { view: true, create: false, edit: false, delete: false, approveExport: true },
      assets: { view: true, create: false, edit: false, delete: false, approveExport: false },
      reports: { view: true, create: true, edit: false, delete: false, approveExport: true },
      integrations: { view: true, create: false, edit: false, delete: false, approveExport: true },
      audit: { view: true, create: false, edit: false, delete: false, approveExport: true },
      ess: { view: true, create: true, edit: true, delete: false, approveExport: true },
    },
  },
  {
    id: "grp-linemanagers",
    code: "line_managers",
    nameAr: "مجموعة مدراء الفروع ورؤساء الأقسام",
    nameEn: "Branch & Department Heads",
    descriptionAr: "متابعة حضور وانصراف الفريق المباشر، اعتماد الإجازات والطلبات، وتقييم الأداء.",
    isSystem: true,
    iconName: "supervisor_account",
    color: "#d97706", // Amber
    dataScope: "department",
    memberUserIds: ["emp-02", "emp-05"],
    screens: {
      dashboard: { view: true, create: false, edit: false, delete: false, approveExport: false },
      organization: { view: true, create: false, edit: false, delete: false, approveExport: false },
      employees: { view: true, create: false, edit: false, delete: false, approveExport: false },
      documents: { view: true, create: false, edit: false, delete: false, approveExport: false },
      rbac: { view: false, create: false, edit: false, delete: false, approveExport: false },
      workflow: { view: true, create: true, edit: true, delete: false, approveExport: true },
      leaves: { view: true, create: true, edit: true, delete: false, approveExport: true },
      attendance: { view: true, create: true, edit: true, delete: false, approveExport: true },
      shifts: { view: true, create: true, edit: true, delete: false, approveExport: true },
      payroll: { view: false, create: false, edit: false, delete: false, approveExport: false },
      loans: { view: true, create: false, edit: false, delete: false, approveExport: false },
      expenses: { view: true, create: true, edit: true, delete: false, approveExport: true },
      ats: { view: true, create: false, edit: false, delete: false, approveExport: false },
      performance: { view: true, create: true, edit: true, delete: false, approveExport: true },
      workforce: { view: true, create: false, edit: false, delete: false, approveExport: false },
      assets: { view: true, create: false, edit: false, delete: false, approveExport: false },
      reports: { view: true, create: false, edit: false, delete: false, approveExport: true },
      integrations: { view: false, create: false, edit: false, delete: false, approveExport: false },
      audit: { view: false, create: false, edit: false, delete: false, approveExport: false },
      ess: { view: true, create: true, edit: true, delete: false, approveExport: true },
    },
  },
  {
    id: "grp-operations",
    code: "attendance_operations",
    nameAr: "مجموعة مسؤولي العمليات والحضور وأجهزة البصمة",
    nameEn: "Operations & Attendance Officers",
    descriptionAr: "إدارة البصمات، مزامنة الأجهزة، تسوية سجلات الحضور والانصراف، وجداول الورديات.",
    isSystem: false,
    iconName: "schedule",
    color: "#7c3aed", // Violet
    dataScope: "all",
    memberUserIds: ["emp-06", "emp-08"],
    screens: {
      dashboard: { view: true, create: false, edit: false, delete: false, approveExport: false },
      organization: { view: true, create: false, edit: false, delete: false, approveExport: false },
      employees: { view: true, create: false, edit: false, delete: false, approveExport: false },
      documents: { view: false, create: false, edit: false, delete: false, approveExport: false },
      rbac: { view: false, create: false, edit: false, delete: false, approveExport: false },
      workflow: { view: true, create: false, edit: false, delete: false, approveExport: false },
      leaves: { view: true, create: false, edit: false, delete: false, approveExport: true },
      attendance: { view: true, create: true, edit: true, delete: false, approveExport: true },
      shifts: { view: true, create: true, edit: true, delete: false, approveExport: true },
      payroll: { view: false, create: false, edit: false, delete: false, approveExport: false },
      loans: { view: false, create: false, edit: false, delete: false, approveExport: false },
      expenses: { view: false, create: false, edit: false, delete: false, approveExport: false },
      ats: { view: false, create: false, edit: false, delete: false, approveExport: false },
      performance: { view: false, create: false, edit: false, delete: false, approveExport: false },
      workforce: { view: false, create: false, edit: false, delete: false, approveExport: false },
      assets: { view: true, create: true, edit: true, delete: false, approveExport: false },
      reports: { view: true, create: true, edit: false, delete: false, approveExport: true },
      integrations: { view: false, create: false, edit: false, delete: false, approveExport: false },
      audit: { view: false, create: false, edit: false, delete: false, approveExport: false },
      ess: { view: true, create: true, edit: true, delete: false, approveExport: true },
    },
  },
  {
    id: "grp-employees",
    code: "general_employees",
    nameAr: "مجموعة الموظفين العامة (الخدمة الذاتية ESS)",
    nameEn: "All Company Employees (ESS)",
    descriptionAr: "الصلاحيات الافتراضية لكافة موظفي المنشأة للوصول للخدمات الذاتية الشخصية.",
    isSystem: true,
    iconName: "person",
    color: "#64748b", // Slate
    dataScope: "self",
    memberUserIds: ["emp-09", "emp-10", "emp-11", "emp-12"],
    screens: {
      dashboard: { view: true, create: false, edit: false, delete: false, approveExport: false },
      organization: { view: true, create: false, edit: false, delete: false, approveExport: false },
      employees: { view: false, create: false, edit: false, delete: false, approveExport: false },
      documents: { view: true, create: false, edit: false, delete: false, approveExport: true },
      rbac: { view: false, create: false, edit: false, delete: false, approveExport: false },
      workflow: { view: true, create: true, edit: false, delete: false, approveExport: false },
      leaves: { view: true, create: true, edit: false, delete: false, approveExport: false },
      attendance: { view: true, create: true, edit: false, delete: false, approveExport: false },
      shifts: { view: true, create: false, edit: false, delete: false, approveExport: false },
      payroll: { view: false, create: false, edit: false, delete: false, approveExport: false },
      loans: { view: true, create: true, edit: false, delete: false, approveExport: false },
      expenses: { view: true, create: true, edit: false, delete: false, approveExport: false },
      ats: { view: false, create: false, edit: false, delete: false, approveExport: false },
      performance: { view: true, create: true, edit: false, delete: false, approveExport: false },
      workforce: { view: false, create: false, edit: false, delete: false, approveExport: false },
      assets: { view: true, create: false, edit: false, delete: false, approveExport: false },
      reports: { view: false, create: false, edit: false, delete: false, approveExport: false },
      integrations: { view: false, create: false, edit: false, delete: false, approveExport: false },
      audit: { view: false, create: false, edit: false, delete: false, approveExport: false },
      ess: { view: true, create: true, edit: true, delete: false, approveExport: true },
    },
  },
];
