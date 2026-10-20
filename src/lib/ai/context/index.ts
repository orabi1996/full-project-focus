/**
 * MadarX Enterprise AI — Copilot Persona Contexts, Natural Language Reporting,
 * Enterprise AI Search, Drafting Copilot & Action Confirmation Cards
 * Prompt 35: Sections 7–10, 14–17, 28
 */

import { resolveCountryStatutoryGrounding, type SupportedCountryCode } from '../policies';

export type AIRoleContext = 'employee' | 'manager' | 'hr' | 'executive';

export interface CopilotPersonaCapabilities {
  persona: AIRoleContext;
  titleAr: string;
  titleEn: string;
  allowedCapabilities: string[];
  prohibitedBoundaries: string[];
  allowedToolIds: string[];
  scopeRule: 'SELF_ONLY' | 'DIRECT_REPORTS_ONLY' | 'TENANT_HR_GOVERNED' | 'EXECUTIVE_AGGREGATED';
}

const PERSONA_CAPABILITY_MAP: Record<AIRoleContext, CopilotPersonaCapabilities> = {
  employee: {
    persona: 'employee',
    titleAr: 'المساعد الذكي للموظف (ESS Copilot)',
    titleEn: 'Employee Self-Service Copilot',
    scopeRule: 'SELF_ONLY',
    allowedCapabilities: [
      'explain_payslip_line_items',
      'explain_leave_balances_and_entitlements',
      'explain_company_policies',
      'guide_self_service_requests',
      'summarize_assigned_training',
      'show_expiring_personal_documents',
      'explain_benefits_and_allowances',
      'draft_leave_or_expense_or_letter_request',
    ],
    prohibitedBoundaries: [
      'Never expose another employee’s personal, salary, or case data',
      'Never execute direct database mutations without confirmation',
    ],
    allowedToolIds: [
      'get_employee_summary',
      'get_leave_balance',
      'get_attendance_summary',
      'get_learning_status',
      'get_expiring_certifications',
      'search_hr_knowledge_base',
      'draft_leave_request',
      'draft_hr_letter',
    ],
  },
  manager: {
    persona: 'manager',
    titleAr: 'المساعد الذكي للمدير (MSS Copilot)',
    titleEn: 'Manager Self-Service Copilot',
    scopeRule: 'DIRECT_REPORTS_ONLY',
    allowedCapabilities: [
      'summarize_team_attendance_and_overtime_trends',
      'highlight_pending_team_approvals',
      'identify_team_leave_overlaps',
      'summarize_direct_report_onboarding_progress',
      'highlight_overdue_training_and_expiring_certifications',
      'assist_with_goal_drafting_and_performance_review_prep',
    ],
    prohibitedBoundaries: [
      'Restricted strictly to direct/authorized reporting scope',
      'Cannot view confidential Employee Relations investigations or unauthorized compensation',
    ],
    allowedToolIds: [
      'get_employee_summary',
      'search_employees',
      'get_leave_balance',
      'get_pending_approvals',
      'get_attendance_summary',
      'get_learning_status',
      'get_expiring_certifications',
      'search_hr_knowledge_base',
      'draft_performance_goals',
    ],
  },
  hr: {
    persona: 'hr',
    titleAr: 'المساعد الذكي للموارد البشرية والرواتب (HR & Payroll Copilot)',
    titleEn: 'HR & Payroll Specialist Copilot',
    scopeRule: 'TENANT_HR_GOVERNED',
    allowedCapabilities: [
      'analyze_headcount_joiners_leavers_and_movements',
      'explain_payroll_run_anomalies_and_missing_inputs',
      'identify_employees_missing_statutory_or_bank_fields',
      'summarize_compliance_risks_and_expiring_documents',
      'assist_with_policy_answers_and_letter_drafting',
      'summarize_open_er_cases_for_authorized_hr_roles',
      'analyze_compensation_review_readiness',
    ],
    prohibitedBoundaries: [
      'Cannot bypass approval chains or finalize payroll/disciplinary decisions autonomously',
    ],
    allowedToolIds: [
      'get_employee_summary',
      'search_employees',
      'get_leave_balance',
      'get_pending_approvals',
      'get_payroll_summary',
      'get_attendance_summary',
      'get_learning_status',
      'get_expiring_certifications',
      'get_open_cases',
      'get_workforce_metrics',
      'run_governed_report',
      'search_hr_knowledge_base',
      'draft_job_description',
      'draft_hr_letter',
      'draft_employee_movement',
    ],
  },
  executive: {
    persona: 'executive',
    titleAr: 'المساعد الذكي للقيادات التنفيذية (Executive Copilot)',
    titleEn: 'Executive Workforce Intelligence Copilot',
    scopeRule: 'EXECUTIVE_AGGREGATED',
    allowedCapabilities: [
      'workforce_cost_trends',
      'attrition_and_headcount_trends',
      'nationalization_and_localization_summary',
      'overtime_and_absence_hotspots',
      'open_critical_roles_and_succession_coverage',
      'learning_and_compliance_completion',
      'survey_engagement_trends',
      'multi_country_workforce_distribution',
    ],
    prohibitedBoundaries: [
      'Uses governed aggregated metrics; never fabricates numbers or bypasses tenant boundaries',
    ],
    allowedToolIds: [
      'get_workforce_metrics',
      'get_payroll_summary',
      'get_attendance_summary',
      'get_learning_status',
      'run_governed_report',
      'search_hr_knowledge_base',
    ],
  },
};

export function getCopilotPersonaCapabilities(persona: AIRoleContext): CopilotPersonaCapabilities {
  return PERSONA_CAPABILITY_MAP[persona];
}

// ============================================================================
// NATURAL LANGUAGE REPORTING MAPPER (Section 14 — NO RAW SQL GENERATION)
// ============================================================================

export type GovernedReportKey =
  | 'headcount_by_department'
  | 'expat_document_expiry'
  | 'overtime_by_department'
  | 'pending_approvals_aging'
  | 'payroll_variance_summary'
  | 'nationalization_compliance'
  | 'training_overdue_summary';

export interface GovernedReportIntentResult {
  matched: boolean;
  reportKey: GovernedReportKey;
  titleAr: string;
  titleEn: string;
  filters: Record<string, string | number | boolean>;
  requiredPermission: string;
  usesRawSql: false;
  exportFormats: Array<'CSV' | 'JSON'>;
}

/**
 * Maps a natural-language analytical query into a strictly governed report definition
 * and structured filter object. Never generates or executes raw SQL from user text.
 */
export function mapNaturalLanguageToGovernedReport(
  naturalLanguageQuery: string,
  countryCode?: SupportedCountryCode
): GovernedReportIntentResult {
  const q = naturalLanguageQuery.toLowerCase();
  const baseFilters: Record<string, string | number | boolean> = {};
  if (countryCode) {
    baseFilters.countryCode = countryCode;
  }

  if (/(expir|document|iqama|visa|passport|وثائق|إقامة|جواز|تأشيرة|منتهي)/i.test(q)) {
    const daysMatch = q.match(/(\d{1,3})\s*(?:day|يوم|أيام)/i);
    baseFilters.withinDays = daysMatch ? Math.min(Number(daysMatch[1]), 365) : 60;
    return {
      matched: true,
      reportKey: 'expat_document_expiry',
      titleAr: 'تقرير الوثائق والإقامات المنتهية أو قريبة الانتهاء',
      titleEn: 'Expiring Documents & Residency Permits Report',
      filters: baseFilters,
      requiredPermission: 'documents.view',
      usesRawSql: false,
      exportFormats: ['CSV', 'JSON'],
    };
  }

  if (/(overtime|عمل\s*إضافي|ساعات\s*إضافية)/i.test(q)) {
    return {
      matched: true,
      reportKey: 'overtime_by_department',
      titleAr: 'تقرير العمل الإضافي حسب القسم',
      titleEn: 'Overtime Trend by Department Report',
      filters: baseFilters,
      requiredPermission: 'attendance.view',
      usesRawSql: false,
      exportFormats: ['CSV', 'JSON'],
    };
  }

  if (/(approval|pending|موافقات|معلقة|بانتظار)/i.test(q)) {
    return {
      matched: true,
      reportKey: 'pending_approvals_aging',
      titleAr: 'تقرير أعمار الموافقات المعلقة حسب المدير',
      titleEn: 'Pending Approvals Aging by Approver Report',
      filters: baseFilters,
      requiredPermission: 'workflow.view',
      usesRawSql: false,
      exportFormats: ['CSV', 'JSON'],
    };
  }

  if (/(payroll|salary|variance|رواتب|مسير|تباين)/i.test(q)) {
    return {
      matched: true,
      reportKey: 'payroll_variance_summary',
      titleAr: 'تقرير ملخص وتباين مسير الرواتب',
      titleEn: 'Payroll Run Variance & Summary Report',
      filters: baseFilters,
      requiredPermission: 'payroll.view',
      usesRawSql: false,
      exportFormats: ['CSV', 'JSON'],
    };
  }

  if (/(saudization|omanization|bahrainization|qatarization|nationalization|توطين|نطاقات|سعودة|تعمين|بحرنة|تقطير)/i.test(q)) {
    return {
      matched: true,
      reportKey: 'nationalization_compliance',
      titleAr: 'تقرير نسب التوطين والامتثال الوطني',
      titleEn: 'Nationalization & Localization Compliance Report',
      filters: baseFilters,
      requiredPermission: 'reports.view',
      usesRawSql: false,
      exportFormats: ['CSV', 'JSON'],
    };
  }

  if (/(training|learning|course|certification|تدريب|دورات|شهادات)/i.test(q)) {
    return {
      matched: true,
      reportKey: 'training_overdue_summary',
      titleAr: 'تقرير التدريبات الإلزامية المتأخرة والشهادات',
      titleEn: 'Overdue Mandatory Training & Certifications Report',
      filters: baseFilters,
      requiredPermission: 'employees.view',
      usesRawSql: false,
      exportFormats: ['CSV', 'JSON'],
    };
  }

  return {
    matched: true,
    reportKey: 'headcount_by_department',
    titleAr: 'تقرير توزيع القوى العاملة حسب القسم والدولة',
    titleEn: 'Active Workforce Headcount by Department & Country',
    filters: baseFilters,
    requiredPermission: 'reports.view',
    usesRawSql: false,
    exportFormats: ['CSV', 'JSON'],
  };
}

// ============================================================================
// ENTERPRISE AI SEARCH WITH PAGINATION & PERMISSION FILTERING (Section 15)
// ============================================================================

export type EnterpriseSearchCategory = 'employees' | 'policies' | 'tasks' | 'workflows' | 'reports' | 'navigation';

export interface EnterpriseSearchItem {
  id: string;
  category: EnterpriseSearchCategory;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  routePath: string;
  requiredPermission: string;
}

export interface EnterpriseSearchResponse {
  query: string;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  items: EnterpriseSearchItem[];
}

const ENTERPRISE_SEARCH_INDEX: EnterpriseSearchItem[] = [
  {
    id: 'nav-employees',
    category: 'navigation',
    titleAr: 'دليل الموظفين وملفات القوى العاملة',
    titleEn: 'Employee Directory & Master Profiles',
    subtitleAr: 'إدارة بيانات الموظفين والعقود والهويات الوطنية',
    routePath: '/employees',
    requiredPermission: 'employees.view',
  },
  {
    id: 'nav-payroll',
    category: 'navigation',
    titleAr: 'مسيرات الرواتب وحماية الأجور (WPS)',
    titleEn: 'Payroll Runs & WPS Compliance',
    subtitleAr: 'احتساب الرواتب والتأمينات الاجتماعية والضرائب',
    routePath: '/payroll',
    requiredPermission: 'payroll.view',
  },
  {
    id: 'nav-country-packs',
    category: 'policies',
    titleAr: 'حزم الدول والامتثال التشريعي (EG, SA, QA, OM, BH)',
    titleEn: 'Multi-Country Statutory Compliance Packs',
    subtitleAr: 'قواعد التأمينات، ضريبة الدخل، مكافأة نهاية الخدمة، والإجازات',
    routePath: '/country-packs',
    requiredPermission: 'settings.view',
  },
  {
    id: 'nav-leaves',
    category: 'workflows',
    titleAr: 'إدارة الإجازات والأرصدة',
    titleEn: 'Leave Management & Entitlements',
    subtitleAr: 'طلبات الإجازة السنوية والمرضية والأمومة والحج',
    routePath: '/leaves',
    requiredPermission: 'leaves.view',
  },
  {
    id: 'nav-compensation',
    category: 'reports',
    titleAr: 'التعويضات والمزايا وإجمالي المكافآت',
    titleEn: 'Compensation, Salary Bands & Total Rewards',
    subtitleAr: 'هياكل الدرجات الوظيفية، دورات المراجعة السنوية، والمكافآت',
    routePath: '/compensation',
    requiredPermission: 'payroll.view',
  },
  {
    id: 'nav-ai-copilot',
    category: 'tasks',
    titleAr: 'مساعد مدار الذكي (MadarX AI Copilot)',
    titleEn: 'MadarX Enterprise AI Copilot & Insights',
    subtitleAr: 'الاستعلام الذكي، شرح السياسات، وصياغة المسودات بأمان',
    routePath: '/ai-copilot',
    requiredPermission: 'dashboard.view',
  },
];

export function executeEnterpriseAISearch(params: {
  query: string;
  userPermissions: string[];
  isSuperAdmin?: boolean;
  page?: number;
  pageSize?: number;
}): EnterpriseSearchResponse {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 10));
  const q = params.query.trim().toLowerCase();

  const permitted = ENTERPRISE_SEARCH_INDEX.filter(
    (item) => params.isSuperAdmin || params.userPermissions.includes(item.requiredPermission) || item.requiredPermission === 'dashboard.view'
  );

  const matched = !q
    ? permitted
    : permitted.filter(
        (item) =>
          item.titleAr.toLowerCase().includes(q) ||
          item.titleEn.toLowerCase().includes(q) ||
          item.subtitleAr.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );

  const totalItems = matched.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;
  const items = matched.slice(start, start + pageSize);

  return {
    query: params.query,
    page,
    pageSize,
    totalItems,
    totalPages,
    items,
  };
}

// ============================================================================
// JOB DESCRIPTION & HR LETTER DRAFTING COPILOT (Sections 16 & 17)
// ============================================================================

export type AIDraftDocumentType =
  | 'job_description'
  | 'interview_rubric'
  | 'salary_certificate'
  | 'employment_verification'
  | 'promotion_letter'
  | 'transfer_letter'
  | 'onboarding_welcome'
  | 'policy_announcement';

export interface GovernedAIDraftResult {
  draftType: AIDraftDocumentType;
  status: 'DRAFT_ONLY_REQUIRES_HUMAN_APPROVAL';
  autoSent: false;
  autoSigned: false;
  autoFinalized: false;
  countryCode: SupportedCountryCode | null;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  statutoryNoticeAr: string;
  statutoryNoticeEn: string;
}

export function generateGovernedAIDraft(params: {
  draftType: AIDraftDocumentType;
  roleOrSubjectAr: string;
  roleOrSubjectEn: string;
  departmentName?: string;
  countryCode?: SupportedCountryCode;
}): GovernedAIDraftResult {
  const grounding = resolveCountryStatutoryGrounding(params.countryCode || 'SA');
  const dept = params.departmentName || 'General Operations';

  if (params.draftType === 'job_description') {
    return {
      draftType: params.draftType,
      status: 'DRAFT_ONLY_REQUIRES_HUMAN_APPROVAL',
      autoSent: false,
      autoSigned: false,
      autoFinalized: false,
      countryCode: grounding.countryCode,
      titleAr: `مسودة وصف وظيفي: ${params.roleOrSubjectAr}`,
      titleEn: `Draft Job Description: ${params.roleOrSubjectEn}`,
      bodyAr: `المسمى الوظيفي: ${params.roleOrSubjectAr}\nالقسم: ${dept}\nالمسؤوليات الرئيسية:\n1. قيادة المهام التشغيلية وتحقيق مستهدفات الجودة.\n2. الالتزام الكامل بسياسات الحوكمة المؤسسية ومعايير العمل المحلية.\nالمتطلبات والكفاءات:\n- خبرة عملية موثقة في المجال وتواصل فعال ضمن فرق العمل.`,
      bodyEn: `Job Title: ${params.roleOrSubjectEn}\nDepartment: ${dept}\nKey Responsibilities:\n1. Lead operational deliverables and quality KPIs.\n2. Comply with enterprise governance and local labor regulations.\nCompetencies:\n- Proven domain expertise and structured cross-functional collaboration.`,
      statutoryNoticeAr: grounding.disclaimerAr,
      statutoryNoticeEn: grounding.disclaimerEn,
    };
  }

  return {
    draftType: params.draftType,
    status: 'DRAFT_ONLY_REQUIRES_HUMAN_APPROVAL',
    autoSent: false,
    autoSigned: false,
    autoFinalized: false,
    countryCode: grounding.countryCode,
    titleAr: `مسودة خطاب موارد بشرية (${params.draftType}): ${params.roleOrSubjectAr}`,
    titleEn: `Draft HR Letter (${params.draftType}): ${params.roleOrSubjectEn}`,
    bodyAr: `إلى من يهمه الأمر،\nتشهد إدارة الموارد البشرية بأن هذا المستند مسودة أولية خاصة بـ (${params.roleOrSubjectAr}) في قسم (${dept}). لا يُعتد بهذا المستند رسمياً إلا بعد المراجعة البشرية والتوقيع المعتمد.`,
    bodyEn: `To Whom It May Concern,\nThis document is an unapproved draft regarding (${params.roleOrSubjectEn}) in (${dept}). It holds no official validity until reviewed, approved, and signed by authorized HR personnel.`,
    statutoryNoticeAr: grounding.disclaimerAr,
    statutoryNoticeEn: grounding.disclaimerEn,
  };
}

// ============================================================================
// ACTION CONFIRMATION CARD BUILDER (Section 28)
// ============================================================================

export interface AIActionConfirmationCard {
  confirmationId: string;
  toolName: string;
  actionTitleAr: string;
  actionTitleEn: string;
  targetRecordSummary: string;
  proposedFields: Record<string, unknown>;
  validationWarnings: string[];
  requiredPermission: string;
  requiresExplicitUserClick: true;
  status: 'AWAITING_HUMAN_CONFIRMATION';
}

export function buildAIActionConfirmationCard(params: {
  toolName: string;
  actionTitleAr: string;
  actionTitleEn: string;
  targetRecordSummary: string;
  proposedFields: Record<string, unknown>;
  requiredPermission: string;
  validationWarnings?: string[];
}): AIActionConfirmationCard {
  return {
    confirmationId: `confirm_${params.toolName}_${Date.now()}`,
    toolName: params.toolName,
    actionTitleAr: params.actionTitleAr,
    actionTitleEn: params.actionTitleEn,
    targetRecordSummary: params.targetRecordSummary,
    proposedFields: params.proposedFields,
    validationWarnings: params.validationWarnings ?? [],
    requiredPermission: params.requiredPermission,
    requiresExplicitUserClick: true,
    status: 'AWAITING_HUMAN_CONFIRMATION',
  };
}
