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
  getMyProfile: {
    name: "getMyProfile",
    descriptionAr: "استرجاع الملف الشخصي للموظف المسجل حالياً",
    descriptionEn: "Retrieve authenticated employee self profile",
    requiredModule: "employees",
    requiredRoles: ["super_admin", "hr_manager", "payroll_officer", "attendance_officer", "line_manager", "recruiter", "finance_officer", "performance_lead", "employee", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: {},
  },
  getMyLeaveBalance: {
    name: "getMyLeaveBalance",
    descriptionAr: "استرجاع رصيد الإجازات الخاص بالموظف المسجل حالياً",
    descriptionEn: "Retrieve authenticated employee leave balance",
    requiredModule: "leaves",
    requiredRoles: ["super_admin", "hr_manager", "payroll_officer", "attendance_officer", "line_manager", "recruiter", "finance_officer", "performance_lead", "employee", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: {},
  },
  getMyAttendanceSummary: {
    name: "getMyAttendanceSummary",
    descriptionAr: "استرجاع ملخص الحضور والانصراف الخاص بالموظف المسجل حالياً",
    descriptionEn: "Retrieve authenticated employee attendance summary",
    requiredModule: "attendance",
    requiredRoles: ["super_admin", "hr_manager", "payroll_officer", "attendance_officer", "line_manager", "recruiter", "finance_officer", "performance_lead", "employee", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { month: "string?" },
  },
  getTeamSummary: {
    name: "getTeamSummary",
    descriptionAr: "استرجاع ملخص فريق العمل المباشر للمدير",
    descriptionEn: "Retrieve direct-report team summary for manager",
    requiredModule: "employees",
    requiredRoles: ["super_admin", "hr_manager", "line_manager", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { managerEmployeeId: "string" },
  },
  getEmployeeSummary: {
    name: "getEmployeeSummary",
    descriptionAr: "استرجاع ملخص ملف موظف وفق صلاحيات الدور والنطاق",
    descriptionEn: "Retrieve employee summary respecting role and hierarchy scope",
    requiredModule: "employees",
    requiredRoles: ["super_admin", "hr_manager", "line_manager", "employee", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { employeeId: "string" },
  },
  getPayrollSummary: {
    name: "getPayrollSummary",
    descriptionAr: "استرجاع ملخص مسير الرواتب للمخولين مالياً فقط",
    descriptionEn: "Retrieve payroll run summary for authorized payroll/finance roles",
    requiredModule: "payroll",
    requiredRoles: ["super_admin", "hr_manager", "payroll_officer", "finance_officer", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { period: "string?" },
  },
  searchPolicies: {
    name: "searchPolicies",
    descriptionAr: "البحث في اللوائح وسياسات الموارد البشرية المعتمدة",
    descriptionEn: "Search governed HR policies and regulations",
    requiredModule: "documents",
    requiredRoles: ["super_admin", "hr_manager", "payroll_officer", "attendance_officer", "line_manager", "recruiter", "finance_officer", "performance_lead", "employee", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { query: "string" },
  },
  getOpenTasks: {
    name: "getOpenTasks",
    descriptionAr: "استرجاع المهام المفتوحة والمعلقة للمستخدم",
    descriptionEn: "Retrieve open tasks assigned to the user",
    requiredModule: "workflow",
    requiredRoles: ["super_admin", "hr_manager", "payroll_officer", "attendance_officer", "line_manager", "recruiter", "finance_officer", "performance_lead", "employee", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: {},
  },
  getReportsMetadata: {
    name: "getReportsMetadata",
    descriptionAr: "استرجاع تعريفات التقارير والمؤشرات المعتمدة",
    descriptionEn: "Retrieve governed reports and KPI metadata",
    requiredModule: "reports",
    requiredRoles: ["super_admin", "hr_manager", "payroll_officer", "finance_officer", "line_manager", "auditor"],
    isMutation: false,
    requiresConfirmation: false,
    parametersSchema: { domain: "string?" },
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

// ============================================================================
// SERVER-SIDE CONTEXT, HIERARCHY & SENSITIVE PRIVACY ENFORCEMENT
// ============================================================================

export type AISensitiveDomain =
  | "salary"
  | "bank_details"
  | "identity_documents"
  | "medical_information"
  | "disciplinary_cases"
  | "talent_ratings"
  | "succession"
  | "survey_anonymity"
  | "government_credentials";

export interface AIToolAuthorizationContext {
  actorUserId: string;
  actorEmployeeId: string;
  actorCompanyId: string;
  actorRole: UserRole;
  targetCompanyId: string;
  targetEmployeeId?: string;
  directReportEmployeeIds?: string[];
  toolName: string;
  requestedSensitiveDomains?: AISensitiveDomain[];
}

export interface AIToolAuthorizationResult {
  allowed: boolean;
  reasonCode:
    | "AUTHORIZED"
    | "CROSS_TENANT_DENIED"
    | "ROLE_UNAUTHORIZED"
    | "SELF_SCOPE_VIOLATION"
    | "MANAGER_HIERARCHY_VIOLATION"
    | "SENSITIVE_PRIVACY_DENIED"
    | "ANONYMOUS_SURVEY_PROTECTED"
    | "GOVERNMENT_CREDENTIAL_ACCESS_FORBIDDEN";
  messageAr: string;
  messageEn: string;
}

const SENSITIVE_DOMAIN_ALLOWED_ROLES: Record<AISensitiveDomain, UserRole[]> = {
  salary: ["super_admin", "hr_manager", "payroll_officer", "finance_officer", "auditor"],
  bank_details: ["super_admin", "payroll_officer", "finance_officer"],
  identity_documents: ["super_admin", "hr_manager", "auditor"],
  medical_information: ["super_admin", "hr_manager"],
  disciplinary_cases: ["super_admin", "hr_manager", "auditor"],
  talent_ratings: ["super_admin", "hr_manager", "performance_lead", "auditor"],
  succession: ["super_admin", "hr_manager", "performance_lead", "auditor"],
  survey_anonymity: [], // Never exposed individually to any role via AI
  government_credentials: [], // Never exposed in plaintext to any role via AI
};

export function authorizeGovernedAIToolAccess(
  ctx: AIToolAuthorizationContext
): AIToolAuthorizationResult {
  if (!ctx.actorCompanyId || !ctx.targetCompanyId || ctx.actorCompanyId !== ctx.targetCompanyId) {
    return {
      allowed: false,
      reasonCode: "CROSS_TENANT_DENIED",
      messageAr: "تم رفض الوصول: لا يمكن للمساعد الذكي الوصول إلى بيانات منشأة أخرى.",
      messageEn: "Access denied: AI cannot access data belonging to another tenant/company.",
    };
  }

  if (!isUserAuthorizedForTool(ctx.actorRole, ctx.toolName)) {
    return {
      allowed: false,
      reasonCode: "ROLE_UNAUTHORIZED",
      messageAr: "تم رفض الوصول: دورك الوظيفي غير مخول لاستخدام هذه الأداة.",
      messageEn: "Access denied: Your role is not authorized to invoke this AI tool.",
    };
  }

  if (ctx.requestedSensitiveDomains && ctx.requestedSensitiveDomains.length > 0) {
    for (const domain of ctx.requestedSensitiveDomains) {
      if (domain === "survey_anonymity") {
        return {
          allowed: false,
          reasonCode: "ANONYMOUS_SURVEY_PROTECTED",
          messageAr: "تم حجب البيانات: استبيانات الموظفين السرية محمية ولا يمكن كشف هوية المشاركين.",
          messageEn: "Access denied: Anonymous employee survey responses cannot be de-anonymized.",
        };
      }
      if (domain === "government_credentials") {
        return {
          allowed: false,
          reasonCode: "GOVERNMENT_CREDENTIAL_ACCESS_FORBIDDEN",
          messageAr: "تم حجب البيانات: يمنع وصول المساعد الذكي إلى مفاتيح وشهادات الربط الحكومي السرية.",
          messageEn: "Access denied: AI is strictly prohibited from accessing government credentials.",
        };
      }
      const allowedRoles = SENSITIVE_DOMAIN_ALLOWED_ROLES[domain] || [];
      const isSelfAllowed =
        (domain === "salary" || domain === "identity_documents") &&
        ctx.targetEmployeeId &&
        ctx.targetEmployeeId === ctx.actorEmployeeId;
      if (!allowedRoles.includes(ctx.actorRole) && !isSelfAllowed) {
        return {
          allowed: false,
          reasonCode: "SENSITIVE_PRIVACY_DENIED",
          messageAr: `تم حجب البيانات الحساسة (${domain}): لا تملك صلاحية الاطلاع على هذا النطاق.`,
          messageEn: `Sensitive domain (${domain}) blocked: insufficient field-level authorization.`,
        };
      }
    }
  }

  if (ctx.targetEmployeeId && ctx.targetEmployeeId !== ctx.actorEmployeeId) {
    if (ctx.actorRole === "employee") {
      return {
        allowed: false,
        reasonCode: "SELF_SCOPE_VIOLATION",
        messageAr: "تم رفض الوصول: يمكن للموظف الاستعلام عن بياناته الشخصية فقط.",
        messageEn: "Access denied: Employee role is restricted to self-scope data only.",
      };
    }
    if (ctx.actorRole === "line_manager") {
      const reports = ctx.directReportEmployeeIds || [];
      if (!reports.includes(ctx.targetEmployeeId)) {
        return {
          allowed: false,
          reasonCode: "MANAGER_HIERARCHY_VIOLATION",
          messageAr: "تم رفض الوصول: يمكن للمدير المباشر الوصول إلى بيانات مرؤوسيه المباشرين فقط.",
          messageEn: "Access denied: Line manager can only access direct-report employee records.",
        };
      }
    }
  }

  return {
    allowed: true,
    reasonCode: "AUTHORIZED",
    messageAr: "تم التحقق من صلاحيات السياق بنجاح.",
    messageEn: "Context authorization verified.",
  };
}

// ============================================================================
// AI HR ACTION PREPARATION BOUNDARY (NEVER BYPASS WORKFLOW/RBAC)
// ============================================================================

export type GovernedAIHrActionType =
  | "leave_request"
  | "employee_movement"
  | "salary_change"
  | "disciplinary_action"
  | "payroll_action"
  | "termination"
  | "approval";

export interface PreparedAIHrActionProposal {
  actionType: GovernedAIHrActionType;
  status: "PREPARED_DRAFT_REQUIRES_HUMAN_APPROVAL" | "BLOCKED_UNAUTHORIZED";
  bypassAllowed: false;
  executedDirectly: false;
  requiresValidation: true;
  requiresWorkflowApproval: true;
  requiresRbacCheck: true;
  requiresServerMutation: true;
  requiresAudit: true;
  targetWorkflowModule: string;
  draftPayload: Record<string, unknown>;
  messageAr: string;
  messageEn: string;
}

export function prepareGovernedAIHrAction(params: {
  actorRole: UserRole;
  actorCompanyId: string;
  targetCompanyId: string;
  actionType: GovernedAIHrActionType;
  draftPayload: Record<string, unknown>;
  attemptDirectBypass?: boolean;
}): PreparedAIHrActionProposal {
  if (params.attemptDirectBypass) {
    throw new Error(
      "AI_DIRECT_MUTATION_FORBIDDEN: AI cannot directly execute irreversible HR or financial actions without human workflow approval."
    );
  }

  const roleAllowedForPrep: Record<GovernedAIHrActionType, UserRole[]> = {
    leave_request: ["super_admin", "hr_manager", "line_manager", "employee"],
    employee_movement: ["super_admin", "hr_manager", "line_manager"],
    salary_change: ["super_admin", "hr_manager", "payroll_officer"],
    disciplinary_action: ["super_admin", "hr_manager", "line_manager"],
    payroll_action: ["super_admin", "hr_manager", "payroll_officer", "finance_officer"],
    termination: ["super_admin", "hr_manager"],
    approval: ["super_admin", "hr_manager", "line_manager", "payroll_officer", "finance_officer"],
  };

  const isAuthorized =
    params.actorCompanyId === params.targetCompanyId &&
    roleAllowedForPrep[params.actionType]?.includes(params.actorRole);

  if (!isAuthorized) {
    return {
      actionType: params.actionType,
      status: "BLOCKED_UNAUTHORIZED",
      bypassAllowed: false,
      executedDirectly: false,
      requiresValidation: true,
      requiresWorkflowApproval: true,
      requiresRbacCheck: true,
      requiresServerMutation: true,
      requiresAudit: true,
      targetWorkflowModule: params.actionType,
      draftPayload: {},
      messageAr: "غير مصرح بإعداد هذا الإجراء الوظيفي وفق صلاحيات الدور أو المنشأة.",
      messageEn: "Unauthorized to prepare this HR action under current role or tenant scope.",
    };
  }

  return {
    actionType: params.actionType,
    status: "PREPARED_DRAFT_REQUIRES_HUMAN_APPROVAL",
    bypassAllowed: false,
    executedDirectly: false,
    requiresValidation: true,
    requiresWorkflowApproval: true,
    requiresRbacCheck: true,
    requiresServerMutation: true,
    requiresAudit: true,
    targetWorkflowModule: `workflow.${params.actionType}`,
    draftPayload: params.draftPayload,
    messageAr:
      "تم إعداد مسودة الإجراء فقط — يتطلب التنفيذ النهائي مراجعة واعتماد المستخدم عبر مسار العمل الرسمي.",
    messageEn:
      "Draft action prepared only — final execution requires explicit human confirmation through authoritative workflow and RBAC.",
  };
}

// ============================================================================
// FACTUAL EXPLANATIONS & TRACEABLE SOURCE CONTEXT
// ============================================================================

export type AIExplainableScenario =
  | "leave_rejected"
  | "employee_not_payroll_ready"
  | "attendance_result"
  | "outside_salary_range"
  | "onboarding_blockers"
  | "pending_approvals";

export interface FactualAIExplanation {
  scenario: AIExplainableScenario;
  confidence: "FACTUAL_VERIFIED" | "INSUFFICIENT_DATA";
  explanationAr: string;
  explanationEn: string;
  sourceContext: {
    module: string;
    entityType: string;
    entityId: string;
    asOfDate: string;
    factsUsed: string[];
  };
}

export function explainSystemOutcomeFactually(params: {
  scenario: AIExplainableScenario;
  entityId: string;
  asOfDate: string;
  systemFacts: Record<string, unknown> | null;
}): FactualAIExplanation {
  const moduleMap: Record<AIExplainableScenario, { module: string; entityType: string }> = {
    leave_rejected: { module: "leaves", entityType: "leave_request" },
    employee_not_payroll_ready: { module: "payroll", entityType: "employee_payroll_readiness" },
    attendance_result: { module: "attendance", entityType: "attendance_record" },
    outside_salary_range: { module: "compensation", entityType: "salary_structure_band" },
    onboarding_blockers: { module: "onboarding", entityType: "onboarding_case" },
    pending_approvals: { module: "workflow", entityType: "approval_request" },
  };

  const meta = moduleMap[params.scenario];
  if (!params.systemFacts || Object.keys(params.systemFacts).length === 0) {
    return {
      scenario: params.scenario,
      confidence: "INSUFFICIENT_DATA",
      explanationAr: "لا تتوفر بيانات مسجلة في النظام لتفسير هذه الحالة — لا يقوم المساعد الذكي بافتراض أسباب غير موثقة.",
      explanationEn: "Insufficient recorded system facts to explain this state — AI does not invent unverified explanations.",
      sourceContext: {
        module: meta.module,
        entityType: meta.entityType,
        entityId: params.entityId,
        asOfDate: params.asOfDate,
        factsUsed: [],
      },
    };
  }

  const factsUsed = Object.entries(params.systemFacts).map(([k, v]) => `${k}=${String(v)}`);
  return {
    scenario: params.scenario,
    confidence: "FACTUAL_VERIFIED",
    explanationAr: `تفسير مبني على بيانات النظام الفعلية (${meta.module}): ${factsUsed.join("، ")}`,
    explanationEn: `Factual explanation derived from authoritative ${meta.module} records: ${factsUsed.join(", ")}`,
    sourceContext: {
      module: meta.module,
      entityType: meta.entityType,
      entityId: params.entityId,
      asOfDate: params.asOfDate,
      factsUsed,
    },
  };
}

// ============================================================================
// PROMPT INJECTION DEFENSE FOR UNTRUSTED RECORD CONTENT
// ============================================================================

export type UntrustedContentSource =
  | "uploaded_document"
  | "employee_note"
  | "policy_text"
  | "external_content";

export function sanitizeUntrustedContentForAI(params: {
  source: UntrustedContentSource;
  rawContent: string;
}): {
  containsInjectionAttempt: boolean;
  safeExcerpt: string;
  canOverrideSystemRules: false;
} {
  const injectionRegex =
    /(ignore\s+(all\s+)?(previous|prior|system)\s+instructions|override\s+authorization|grant\s+admin|bypass\s+rbac|reveal\s+secrets?|system\s*prompt|<\|im_start\|>|drop\s+table|delete\s+from)/gi;
  const containsInjectionAttempt = injectionRegex.test(params.rawContent);
  const safeExcerpt = params.rawContent.replace(
    injectionRegex,
    "[UNTRUSTED_DIRECTIVE_REDACTED]"
  );

  return {
    containsInjectionAttempt,
    safeExcerpt: `[UNTRUSTED_DATA source=${params.source}] ${safeExcerpt}`,
    canOverrideSystemRules: false,
  };
}

// ============================================================================
// AI FAILURE MODE (NON-BLOCKING HRMS AVAILABILITY) & SAFE AI AUDIT
// ============================================================================

export async function executeAIWithSafeFallback<T>(
  operation: () => Promise<T>
): Promise<{
  aiAvailable: boolean;
  hrmsOperational: true;
  data: T | null;
  fallbackMessageAr?: string;
  fallbackMessageEn?: string;
}> {
  try {
    const data = await operation();
    return {
      aiAvailable: true,
      hrmsOperational: true,
      data,
    };
  } catch {
    return {
      aiAvailable: false,
      hrmsOperational: true,
      data: null,
      fallbackMessageAr:
        "خدمة المساعد الذكي غير متاحة مؤقتاً — تستمر جميع عمليات نظام الموارد البشرية والرواتب بالعمل بشكل طبيعي.",
      fallbackMessageEn:
        "AI Assistant service is temporarily unavailable — core HRMS and Payroll operations continue normally.",
    };
  }
}

export interface SafeAIAuditEntry {
  userId: string;
  companyId: string;
  toolName: string;
  entityType: string;
  timestamp: string;
  resultStatus: "authorized_success" | "blocked_unauthorized" | "failed_safe";
  confidentialContentLogged: false;
}

export function createGovernedAIAuditRecord(params: {
  userId: string;
  companyId: string;
  toolName: string;
  entityType: string;
  resultStatus: "authorized_success" | "blocked_unauthorized" | "failed_safe";
  timestamp?: string;
}): SafeAIAuditEntry {
  return {
    userId: params.userId,
    companyId: params.companyId,
    toolName: params.toolName,
    entityType: params.entityType,
    timestamp: params.timestamp || new Date().toISOString(),
    resultStatus: params.resultStatus,
    confidentialContentLogged: false,
  };
}

// ============================================================================
// FAIL-CLOSED GOVERNMENT CONNECTOR STATE CLASSIFIER (PROMPT 34/35 CONTRACT)
// ============================================================================

export type CanonicalGovernmentConnectorState =
  | "NOT_CONFIGURED"
  | "WAITING_FOR_CUSTOMER_CREDENTIALS"
  | "CONFIGURED"
  | "VERIFYING"
  | "ACTIVE"
  | "ERROR"
  | "DISABLED";

export function classifyGovernmentConnectorSafetyState(params: {
  isDisabled?: boolean;
  hasConfiguration: boolean;
  hasCustomerCredentials: boolean;
  isVerifying?: boolean;
  hasError?: boolean;
  providerVerifiedSuccess: boolean;
  workflowApproved: boolean;
}): CanonicalGovernmentConnectorState {
  if (params.isDisabled) return "DISABLED";
  if (params.hasError) return "ERROR";
  if (!params.hasConfiguration) return "NOT_CONFIGURED";
  if (!params.hasCustomerCredentials) return "WAITING_FOR_CUSTOMER_CREDENTIALS";
  if (params.isVerifying) return "VERIFYING";
  if (params.providerVerifiedSuccess && params.workflowApproved) return "ACTIVE";
  return "CONFIGURED";
}

