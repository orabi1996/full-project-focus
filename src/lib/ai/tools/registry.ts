/**
 * MadarX Governed AI Tool Registry
 * Strictly enforces user RBAC, tenant isolation, and confirmation for mutations
 */

import type { UserRole } from "../../../types";
import type { AIToolDefinition } from "../../domains/ai";

export const GOVERNED_AI_TOOLS: Record<string, AIToolDefinition> = {
  "employee.search": {
    name: "employee.search",
    descriptionAr: "البحث في دليل الموظفين حسب الاسم، الإدارة، أو الحالة الوظيفية",
    descriptionEn: "Search employee directory by name, department, or status",
    requiredModule: "employees",
    requiredRoles: ["super_admin", "hr_manager", "line_manager", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { query: "string", department: "string?", status: "string?" },
  },
  "employee.get_profile": {
    name: "employee.get_profile",
    descriptionAr: "استرجاع الملف الوظيفي للموظف وفق محددات الأمان",
    descriptionEn: "Retrieve employee profile respecting security boundaries",
    requiredModule: "employees",
    requiredRoles: ["super_admin", "hr_manager", "line_manager", "employee", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { employeeId: "string" },
  },
  "leave.get_balance": {
    name: "leave.get_balance",
    descriptionAr: "الاستعلام عن رصيد الإجازات السنوية والمتبقية",
    descriptionEn: "Check annual and remaining leave balances",
    requiredModule: "leaves",
    requiredRoles: ["super_admin", "hr_manager", "line_manager", "employee", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { employeeId: "string?" },
  },
  "leave.get_requests": {
    name: "leave.get_requests",
    descriptionAr: "استرجاع طلبات الإجازات المعلقة وسجل الإجازات",
    descriptionEn: "Retrieve pending leave requests and history",
    requiredModule: "leaves",
    requiredRoles: ["super_admin", "hr_manager", "line_manager", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { status: "string?" },
  },
  "attendance.get_summary": {
    name: "attendance.get_summary",
    descriptionAr: "عرض ملخص الحضور والانصراف، نسب الالتزام وساعات العمل",
    descriptionEn: "View attendance summary, compliance rates, and working hours",
    requiredModule: "attendance",
    requiredRoles: ["super_admin", "hr_manager", "attendance_officer", "line_manager", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { month: "string?" },
  },
  "attendance.get_exceptions": {
    name: "attendance.get_exceptions",
    descriptionAr: "عرض استثناءات الحضور وحالات التأخير والغياب المتكررة",
    descriptionEn: "View attendance exceptions, late arrivals, and repeated absences",
    requiredModule: "attendance",
    requiredRoles: ["super_admin", "hr_manager", "attendance_officer", "line_manager", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { limit: "number?" },
  },
  "payroll.get_summary": {
    name: "payroll.get_summary",
    descriptionAr: "استعراض تكلفة مسير الرواتب الشهري وإجمالي البدلات والاستقطاعات",
    descriptionEn: "Review monthly payroll run cost, allowances, and deductions",
    requiredModule: "payroll",
    requiredRoles: ["super_admin", "hr_manager", "payroll_officer", "finance_officer", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { period: "string?" },
  },
  "recruitment.get_pipeline": {
    name: "recruitment.get_pipeline",
    descriptionAr: "استعراض خط أنابيب التوظيف والوظائف الشاغرة ومراحل المرشحين",
    descriptionEn: "Review recruitment pipeline, open vacancies, and candidate stages",
    requiredModule: "ats",
    requiredRoles: ["super_admin", "hr_manager", "recruiter", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { jobId: "string?" },
  },
  "performance.get_cycle_summary": {
    name: "performance.get_cycle_summary",
    descriptionAr: "عرض حالة دورات تقييم الأداء ونسب الإنجاز",
    descriptionEn: "View performance review cycle status and completion rates",
    requiredModule: "performance",
    requiredRoles: ["super_admin", "hr_manager", "performance_lead", "line_manager", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { cycleId: "string?" },
  },
  "learning.get_expiring_certificates": {
    name: "learning.get_expiring_certificates",
    descriptionAr: "عرض الشهادات المهنية والرخص التي تنتهي قريباً",
    descriptionEn: "View professional certifications and licenses expiring soon",
    requiredModule: "learning",
    requiredRoles: ["super_admin", "hr_manager", "line_manager", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { daysThreshold: "number?" },
  },
  "talent.get_succession_risks": {
    name: "talent.get_succession_risks",
    descriptionAr: "تحديد الوظائف الحرجة التي تفتقر لمرشحين جاهزين في التعاقب الوظيفي",
    descriptionEn: "Identify critical positions lacking ready succession nominees",
    requiredModule: "talent",
    requiredRoles: ["super_admin", "hr_manager", "performance_lead", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: {},
  },
  "knowledge.search": {
    name: "knowledge.search",
    descriptionAr: "البحث في قاعدة المعرفة وسياسات الموارد البشرية مع توثيق المصادر",
    descriptionEn: "Search knowledge base and HR policies with source citations",
    requiredModule: "documents",
    requiredRoles: ["super_admin", "hr_manager", "payroll_officer", "attendance_officer", "line_manager", "recruiter", "finance_officer", "performance_lead", "employee", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { query: "string" },
  },
  "insights.get_active": {
    name: "insights.get_active",
    descriptionAr: "استعراض التنبيهات والرؤى الاستباقية النشطة",
    descriptionEn: "Review active proactive insights and recommendations",
    requiredModule: "dashboard",
    requiredRoles: ["super_admin", "hr_manager", "line_manager", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { category: "string?" },
  },
  "tasks.get_pending": {
    name: "tasks.get_pending",
    descriptionAr: "استعراض المهام المعلقة الخاصة بالمستخدم",
    descriptionEn: "Review pending user tasks",
    requiredModule: "workflow",
    requiredRoles: ["super_admin", "hr_manager", "payroll_officer", "attendance_officer", "line_manager", "recruiter", "finance_officer", "performance_lead", "employee", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: {},
  },
  "tasks.create": {
    name: "tasks.create",
    descriptionAr: "إنشاء مهمة عمل جديدة (يتطلب تأكيداً مسبقاً)",
    descriptionEn: "Create a new task (requires explicit human confirmation)",
    requiredModule: "workflow",
    requiredRoles: ["super_admin", "hr_manager", "line_manager"],
    isMutation: true,
    requiresConfirmation: true,
    parametersSchema: { title: "string", assigneeId: "string", dueDate: "string?" },
  },
  "notifications.send_reminder": {
    name: "notifications.send_reminder",
    descriptionAr: "إرسال إشعار تذكيري للموظفين (يتطلب تأكيداً مسبقاً)",
    descriptionEn: "Send a reminder notification to employees (requires explicit human confirmation)",
    requiredModule: "workflow",
    requiredRoles: ["super_admin", "hr_manager", "line_manager"],
    isMutation: true,
    requiresConfirmation: true,
    parametersSchema: { recipientId: "string", message: "string" },
  },
};

/**
 * Validates whether user role is authorized to execute a specific tool
 */
export function isUserAuthorizedForTool(role: UserRole, toolName: string): boolean {
  const tool = GOVERNED_AI_TOOLS[toolName];
  if (!tool) return false;
  return tool.requiredRoles.includes(role);
}
