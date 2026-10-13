// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: PRODUCTION EMPLOYEE RELATIONS, CASES, GRIEVANCES,
//            INVESTIGATIONS & DISCIPLINARY ENGINE
// Domain: src/lib/domains/employee-relations/index.ts
// ============================================================================

export type ErCaseType =
  | "grievance"
  | "employee_complaint"
  | "manager_complaint"
  | "workplace_incident"
  | "policy_violation"
  | "misconduct"
  | "attendance_discipline"
  | "behavioral_issue"
  | "workplace_conflict"
  | "harassment_allegation"
  | "safety_incident"
  | "ethics_concern"
  | "performance_conduct_issue"
  | "other";

export type ErConfidentialityLevel =
  | "standard_hr"
  | "restricted_hr"
  | "legal_sensitive"
  | "highly_confidential";

export type ErSeverity = "low" | "medium" | "high" | "critical";

export type ErCaseStatus =
  | "draft"
  | "submitted"
  | "triage"
  | "open"
  | "under_review"
  | "investigation"
  | "awaiting_response"
  | "hearing_scheduled"
  | "decision_pending"
  | "action_required"
  | "appeal_pending"
  | "resolved"
  | "closed"
  | "cancelled";

export type ErParticipantRole =
  | "subject"
  | "complainant"
  | "investigator"
  | "hr_reviewer"
  | "manager"
  | "witness"
  | "decision_maker"
  | "legal_counsel"
  | "appeals_officer";

export type ErAccessPermission = "read" | "contribute" | "full";

export type ErInvestigationStatus =
  | "draft"
  | "in_progress"
  | "deliberation"
  | "completed"
  | "cancelled";

export type ErWitnessType = "employee" | "external" | "contractor" | "customer";

export type ErInterviewType =
  | "complainant_interview"
  | "subject_interview"
  | "witness_interview"
  | "formal_hearing"
  | "committee_deliberation"
  | "manager_meeting";

export type ErInterviewStatus =
  | "scheduled"
  | "completed"
  | "rescheduled"
  | "cancelled"
  | "no_show";

export type ErEvidenceType =
  | "document"
  | "email_export"
  | "chat_log"
  | "cctv_log"
  | "attendance_log"
  | "witness_statement"
  | "audit_trace"
  | "device_log"
  | "financial_record"
  | "other";

export type ErEvidenceClassification = "standard" | "restricted" | "confidential";

export type ErFindingOutcome =
  | "substantiated"
  | "partially_substantiated"
  | "unsubstantiated"
  | "inconclusive"
  | "not_applicable";

export type ErDecisionType =
  | "no_action"
  | "informal_counseling"
  | "formal_warning"
  | "disciplinary_action"
  | "corrective_action_plan"
  | "suspension"
  | "transfer_recommendation"
  | "dismissal_recommendation";

export type ErDisciplinaryActionType =
  | "verbal_warning_record"
  | "written_warning"
  | "final_warning"
  | "corrective_action_plan"
  | "training_required"
  | "policy_acknowledgement"
  | "suspension_review"
  | "employment_action_review";

export type ErWarningLevel = "first_written" | "second_written" | "final";

export type ErAcknowledgementStatus =
  | "pending_acknowledgement"
  | "acknowledged"
  | "refused_to_sign";

export type ErAppealGrounds =
  | "new_evidence"
  | "procedural_defect"
  | "disproportionate_penalty"
  | "factual_error"
  | "bias_or_conflict";

export type ErAppealStatus =
  | "submitted"
  | "under_review"
  | "hearing_scheduled"
  | "upheld"
  | "modified"
  | "overturned";

export type ErCorrectivePlanStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type ErReviewFrequency = "weekly" | "biweekly" | "monthly";

// ============================================================================
// ENTITY INTERFACES
// ============================================================================

export interface ErCase {
  id: string;
  companyId: string;
  caseNumber: string;
  title: string;
  description: string;
  caseType: ErCaseType;
  confidentialityLevel: ErConfidentialityLevel;
  severity: ErSeverity;
  status: ErCaseStatus;
  subjectEmployeeId?: string;
  subjectEmployeeName?: string;
  subjectDepartment?: string;
  complainantEmployeeId?: string;
  complainantEmployeeName?: string;
  isAnonymousComplainant: boolean;
  assignedInvestigatorId?: string;
  assignedInvestigatorName?: string;
  caseOwnerId?: string;
  incidentDate?: string;
  targetResolutionDays: number;
  dueDate?: string;
  isSlaBreached: boolean;
  slaBreachedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  resolutionSummary?: string;
  closureReason?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ErCaseParticipant {
  id: string;
  caseId: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  employeeNumber?: string;
  participantRole: ErParticipantRole;
  accessPermission: ErAccessPermission;
  notifiedAt?: string;
  statementSubmitted: boolean;
  notes?: string;
  createdAt: string;
}

export interface ErCaseAccessGrant {
  id: string;
  caseId: string;
  companyId: string;
  userId: string;
  grantedBy?: string;
  grantReason: string;
  validUntil?: string;
  createdAt: string;
}

export interface ErCaseNote {
  id: string;
  caseId: string;
  companyId: string;
  authorId?: string;
  authorName: string;
  authorRole: string;
  noteType: "general" | "investigation" | "hearing" | "deliberation" | "legal_counsel" | "system_event";
  content: string;
  isConfidential: boolean;
  isInternalOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ErInvestigation {
  id: string;
  caseId: string;
  companyId: string;
  investigationNumber: string;
  leadInvestigatorId?: string;
  leadInvestigatorName?: string;
  scopeOfInvestigation: string;
  methodology?: string;
  status: ErInvestigationStatus;
  startedAt?: string;
  targetCompletionDate?: string;
  completedAt?: string;
  summaryReport?: string;
  createdAt: string;
  updatedAt: string;
  steps?: ErInvestigationStep[];
}

export interface ErInvestigationStep {
  id: string;
  investigationId: string;
  companyId: string;
  stepOrder: number;
  title: string;
  description?: string;
  assignedToId?: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  dueDate?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface ErWitness {
  id: string;
  investigationId: string;
  caseId: string;
  companyId: string;
  witnessEmployeeId?: string;
  witnessName: string;
  witnessType: ErWitnessType;
  relationshipToCase?: string;
  statementSummary?: string;
  statementDate?: string;
  isStatementVerified: boolean;
  isAnonymized: boolean;
  createdAt: string;
}

export interface ErInterview {
  id: string;
  investigationId: string;
  caseId: string;
  companyId: string;
  interviewType: ErInterviewType;
  intervieweeId?: string;
  intervieweeName: string;
  scheduledAt: string;
  conductedAt?: string;
  location?: string;
  meetingLink?: string;
  status: ErInterviewStatus;
  minutesOfMeeting?: string;
  interviewSummary?: string;
  admissionsOrDenials?: string;
  acknowledgedByInterviewee: boolean;
  createdAt: string;
}

export interface ErEvidence {
  id: string;
  caseId: string;
  companyId: string;
  evidenceNumber: string;
  title: string;
  description?: string;
  evidenceType: ErEvidenceType;
  filePath?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  classification: ErEvidenceClassification;
  chainOfCustodyLog: Array<{ timestamp: string; action: string; actor: string; note?: string }>;
  uploadedBy?: string;
  isVoided: boolean;
  voidedReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  createdAt: string;
}

export interface ErFinding {
  id: string;
  investigationId: string;
  caseId: string;
  companyId: string;
  allegationItem: string;
  finding: ErFindingOutcome;
  factualBasis: string;
  policyReference?: string;
  recommendedAction?: string;
  createdAt: string;
}

export interface ErDisciplinaryCatalogItem {
  id: string;
  companyId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  actionType: ErDisciplinaryActionType;
  severityLevel: number;
  defaultValidityDays: number;
  requiresHrHeadApproval: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ErDecision {
  id: string;
  caseId: string;
  companyId: string;
  decisionNumber: string;
  decisionMakerId?: string;
  decisionMakerName?: string;
  decisionType: ErDecisionType;
  decisionSummary: string;
  rationale: string;
  effectiveDate: string;
  appealEligible: boolean;
  appealDeadline?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface ErDisciplinaryAction {
  id: string;
  companyId: string;
  caseId?: string;
  decisionId?: string;
  employeeId: string;
  employeeName?: string;
  actionCatalogId?: string;
  actionType: string;
  title: string;
  details: string;
  issuedDate: string;
  expiryDate?: string;
  status: "active" | "expired" | "rescinded" | "appealed";
  rescindedReason?: string;
  rescindedAt?: string;
  createdAt: string;
}

export interface ErEmployeeWarning {
  id: string;
  companyId: string;
  caseId?: string;
  caseNumber?: string;
  employeeId: string;
  employeeName?: string;
  employeeNumber?: string;
  warningNumber: string;
  warningLevel: ErWarningLevel;
  violationCategory: string;
  summary: string;
  requiredImprovements: string;
  consequencesOfRecurrence: string;
  issuedDate: string;
  validUntil: string;
  isActive: boolean;
  acknowledgementStatus: ErAcknowledgementStatus;
  acknowledgedAt?: string;
  employeeComments?: string;
  refusalWitnessId?: string;
  refusalWitnessName?: string;
  refusalNotes?: string;
  createdAt: string;
}

export interface ErAppeal {
  id: string;
  companyId: string;
  caseId: string;
  caseNumber?: string;
  decisionId: string;
  decisionNumber?: string;
  appealNumber: string;
  appellantEmployeeId: string;
  appellantName?: string;
  groundsForAppeal: ErAppealGrounds;
  statement: string;
  status: ErAppealStatus;
  appealsOfficerId?: string;
  appealsOfficerName?: string;
  reviewNotes?: string;
  resolutionSummary?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface ErCorrectiveActionPlan {
  id: string;
  companyId: string;
  caseId?: string;
  caseNumber?: string;
  employeeId: string;
  employeeName?: string;
  supervisorId?: string;
  supervisorName?: string;
  title: string;
  objectives: string;
  startDate: string;
  targetEndDate: string;
  reviewFrequency: ErReviewFrequency;
  linkedCourseId?: string;
  linkedCourseName?: string;
  status: ErCorrectivePlanStatus;
  progressPct: number;
  finalEvaluation?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ErDashboardKpis {
  totalCases: number;
  openCases: number;
  activeInvestigations: number;
  slaBreachedCount: number;
  activeWarnings: number;
  pendingAcknowledgements: number;
  openAppeals: number;
  activeCaps: number;
  avgResolutionDays: number;
  grievanceResolutionRate: number;
  caseTypeCounts: Record<string, number>;
}

// ============================================================================
// PURE DOMAIN RULES & LOGIC FUNCTIONS
// ============================================================================

/**
 * Calculates the SLA due date based on starting date and target days.
 */
export function calculateSlaDueDate(startDate: string, targetDays: number): string {
  const date = new Date(startDate);
  if (isNaN(date.getTime())) {
    const today = new Date();
    today.setDate(today.getDate() + (targetDays || 14));
    return today.toISOString().split("T")[0];
  }
  date.setDate(date.getDate() + (targetDays || 14));
  return date.toISOString().split("T")[0];
}

/**
 * Evaluates whether a case has breached its SLA deadline.
 */
export function isSlaBreached(dueDate?: string | null, resolvedAt?: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;

  const compareDate = resolvedAt ? new Date(resolvedAt) : new Date();
  // Strip time for clean day comparison
  due.setHours(23, 59, 59, 999);
  return compareDate.getTime() > due.getTime();
}

/**
 * Verifies if an official warning remains active and unexpired.
 */
export function isWarningValid(issuedDate: string, validUntil: string): boolean {
  const validUntilDate = new Date(validUntil);
  if (isNaN(validUntilDate.getTime())) return false;
  const now = new Date();
  validUntilDate.setHours(23, 59, 59, 999);
  return now.getTime() <= validUntilDate.getTime();
}

/**
 * Enforces separation of duties:
 * The Appeals Officer must NOT be the original Investigator or Decision Maker.
 */
export function validateSeparationOfDuties(
  appealsOfficerId: string,
  leadInvestigatorId?: string | null,
  decisionMakerId?: string | null
): { allowed: boolean; reason?: string } {
  if (!appealsOfficerId) {
    return { allowed: false, reason: "يجب تحديد مسؤول أو لجنة استئناف معتمدة" };
  }
  if (leadInvestigatorId && appealsOfficerId === leadInvestigatorId) {
    return {
      allowed: false,
      reason: "مخالفة لمبدأ فصل السلطات: لا يجوز لمحقق القضية الأصلي النظر في طلب الاستئناف",
    };
  }
  if (decisionMakerId && appealsOfficerId === decisionMakerId) {
    return {
      allowed: false,
      reason: "مخالفة لمبدأ فصل السلطات: لا يجوز لمتخذ القرار الأصلي النظر في طلب الاستئناف المقدم ضده",
    };
  }
  return { allowed: true };
}

/**
 * Evaluates confidentiality access to an ER case based on role, ownership, and tier.
 */
export function evaluateCaseAccess(
  caseItem: {
    confidentialityLevel: ErConfidentialityLevel;
    subjectEmployeeId?: string;
    complainantEmployeeId?: string;
    assignedInvestigatorId?: string;
  },
  currentUserId: string,
  currentUserRole: string,
  explicitGrantUserIds: string[] = []
): { canView: boolean; canManage: boolean; isMasked: boolean } {
  // Super Admin has oversight, unless marked highly_confidential without grant
  if (currentUserRole === "super_admin") {
    if (caseItem.confidentialityLevel === "highly_confidential") {
      const hasGrant = explicitGrantUserIds.includes(currentUserId);
      return { canView: hasGrant, canManage: hasGrant, isMasked: !hasGrant };
    }
    return { canView: true, canManage: true, isMasked: false };
  }

  // HR Manager has access to standard and restricted
  if (currentUserRole === "hr_manager") {
    if (caseItem.confidentialityLevel === "highly_confidential" || caseItem.confidentialityLevel === "legal_sensitive") {
      const hasGrant = explicitGrantUserIds.includes(currentUserId);
      return { canView: hasGrant, canManage: hasGrant, isMasked: !hasGrant };
    }
    return { canView: true, canManage: true, isMasked: false };
  }

  // Explicit participant check
  if (explicitGrantUserIds.includes(currentUserId)) {
    return { canView: true, canManage: false, isMasked: false };
  }

  // If the user is the investigator
  if (caseItem.assignedInvestigatorId === currentUserId) {
    return { canView: true, canManage: true, isMasked: false };
  }

  // If the user is the subject: Safe partial view only
  if (caseItem.subjectEmployeeId === currentUserId) {
    return { canView: true, canManage: false, isMasked: true };
  }

  // If the user is the complainant
  if (caseItem.complainantEmployeeId === currentUserId) {
    return { canView: true, canManage: false, isMasked: true };
  }

  // Default denied
  return { canView: false, canManage: false, isMasked: true };
}

// ============================================================================
// FORMATTERS & LOCALIZATION HELPERS
// ============================================================================

export function formatCaseType(type: ErCaseType, locale: "ar" | "en" = "ar"): string {
  const map: Record<ErCaseType, { ar: string; en: string }> = {
    grievance: { ar: "تظلم موظف", en: "Employee Grievance" },
    employee_complaint: { ar: "شكوى موظف", en: "Employee Complaint" },
    manager_complaint: { ar: "شكوى من مدير", en: "Manager Complaint" },
    workplace_incident: { ar: "حادثة في بيئة العمل", en: "Workplace Incident" },
    policy_violation: { ar: "مخالفة سياسات الشركة", en: "Policy Violation" },
    misconduct: { ar: "سوء سلوك مهني", en: "Misconduct Allegation" },
    attendance_discipline: { ar: "مخالفة انضباط وحضور", en: "Attendance & Discipline" },
    behavioral_issue: { ar: "مشكلة سلوكية", en: "Behavioral Issue" },
    workplace_conflict: { ar: "نزاع بيئة عمل", en: "Workplace Conflict" },
    harassment_allegation: { ar: "ادعاء مضايقة أو تحرش", en: "Harassment Allegation" },
    safety_incident: { ar: "مخالفة سلامة وصحة مهنية", en: "Safety Incident" },
    ethics_concern: { ar: "اشتباه نزاهة وأخلاقيات", en: "Ethics Concern" },
    performance_conduct_issue: { ar: "تعثر أداء متصل بالسلوك", en: "Performance / Conduct" },
    other: { ar: "أخرى", en: "Other" },
  };
  return map[type]?.[locale] || type;
}

export function formatCaseStatus(status: ErCaseStatus, locale: "ar" | "en" = "ar"): string {
  const map: Record<ErCaseStatus, { ar: string; en: string }> = {
    draft: { ar: "مسودة", en: "Draft" },
    submitted: { ar: "مقدمة جديدة", en: "Submitted" },
    triage: { ar: "قيد الفرز والتقييم", en: "Triage" },
    open: { ar: "مفتوحة", en: "Open" },
    under_review: { ar: "قيد المراجعة", en: "Under Review" },
    investigation: { ar: "تحقيق رسمي جارٍ", en: "Formal Investigation" },
    awaiting_response: { ar: "بانتظار إفادة", en: "Awaiting Response" },
    hearing_scheduled: { ar: "جلسة سماع مجدولة", en: "Hearing Scheduled" },
    decision_pending: { ar: "بانتظار القرار", en: "Decision Pending" },
    action_required: { ar: "يتطلب إجراءً تأديبياً", en: "Action Required" },
    appeal_pending: { ar: "استئناف معلق", en: "Appeal Pending" },
    resolved: { ar: "تم البت فيها", en: "Resolved" },
    closed: { ar: "مغلقة نهائياً", en: "Closed" },
    cancelled: { ar: "ملغاة", en: "Cancelled" },
  };
  return map[status]?.[locale] || status;
}

export function formatConfidentialityLevel(level: ErConfidentialityLevel, locale: "ar" | "en" = "ar"): string {
  const map: Record<ErConfidentialityLevel, { ar: string; en: string }> = {
    standard_hr: { ar: "موارد بشرية قياسي", en: "Standard HR" },
    restricted_hr: { ar: "مقيد للجنة التحقيق", en: "Restricted HR" },
    legal_sensitive: { ar: "حساس قانونياً", en: "Legal Sensitive" },
    highly_confidential: { ar: "سري للغاية", en: "Highly Confidential" },
  };
  return map[level]?.[locale] || level;
}

export function formatSeverity(sev: ErSeverity, locale: "ar" | "en" = "ar"): string {
  const map: Record<ErSeverity, { ar: string; en: string }> = {
    low: { ar: "منخفضة", en: "Low" },
    medium: { ar: "متوسطة", en: "Medium" },
    high: { ar: "عالية", en: "High" },
    critical: { ar: "حرجة للغاية", en: "Critical" },
  };
  return map[sev]?.[locale] || sev;
}

export function formatDecisionType(dec: ErDecisionType, locale: "ar" | "en" = "ar"): string {
  const map: Record<ErDecisionType, { ar: string; en: string }> = {
    no_action: { ar: "حفظ القضية دون إجراء", en: "No Action / Dismissed" },
    informal_counseling: { ar: "جلسة توجيه وإرشاد غير رسمية", en: "Informal Counseling" },
    formal_warning: { ar: "إصدار إنذار كتابي رسمي", en: "Formal Warning" },
    disciplinary_action: { ar: "إجراء تأديبي نظامي", en: "Disciplinary Action" },
    corrective_action_plan: { ar: "إلزام بخطة تصحيح سلوكي (CAP)", en: "Corrective Action Plan" },
    suspension: { ar: "إيقاف مؤقت عن العمل", en: "Suspension" },
    transfer_recommendation: { ar: "توصية نقل إداري", en: "Transfer Recommendation" },
    dismissal_recommendation: { ar: "توصية إنهاء خدمة للمراجعة النظامية", en: "Dismissal Review" },
  };
  return map[dec]?.[locale] || dec;
}

export function formatWarningLevel(level: ErWarningLevel, locale: "ar" | "en" = "ar"): string {
  const map: Record<ErWarningLevel, { ar: string; en: string }> = {
    first_written: { ar: "إنذار كتابي أول", en: "1st Written Warning" },
    second_written: { ar: "إنذار كتابي ثانٍ", en: "2nd Written Warning" },
    final: { ar: "إنذار كتابي نهائي", en: "Final Warning" },
  };
  return map[level]?.[locale] || level;
}

export function formatAcknowledgementStatus(status: ErAcknowledgementStatus, locale: "ar" | "en" = "ar"): string {
  const map: Record<ErAcknowledgementStatus, { ar: string; en: string }> = {
    pending_acknowledgement: { ar: "بانتظار توقيع الموظف", en: "Pending Signature" },
    acknowledged: { ar: "تم التوقيع والاستلام", en: "Acknowledged & Signed" },
    refused_to_sign: { ar: "امتنع الموظف عن التوقيع (مثبت بمحضر)", en: "Refused to Sign" },
  };
  return map[status]?.[locale] || status;
}

export function formatAppealStatus(status: ErAppealStatus, locale: "ar" | "en" = "ar"): string {
  const map: Record<ErAppealStatus, { ar: string; en: string }> = {
    submitted: { ar: "مقدم للاستئناف", en: "Submitted" },
    under_review: { ar: "قيد فحص اللجنة", en: "Under Review" },
    hearing_scheduled: { ar: "جلسة استماع محددة", en: "Hearing Scheduled" },
    upheld: { ar: "تأييد القرار الأصلي", en: "Decision Upheld" },
    modified: { ar: "تعديل العقوبة والتخفيف", en: "Penalty Modified" },
    overturned: { ar: "إلغاء القرار وتبرئة الموظف", en: "Decision Overturned" },
  };
  return map[status]?.[locale] || status;
}

export function formatFindingOutcome(finding: ErFindingOutcome, locale: "ar" | "en" = "ar"): string {
  const map: Record<ErFindingOutcome, { ar: string; en: string }> = {
    substantiated: { ar: "ثبوت المخالفة بالأدلة", en: "Substantiated" },
    partially_substantiated: { ar: "ثبوت جزئي للواقعة", en: "Partially Substantiated" },
    unsubstantiated: { ar: "عدم ثبوت المخالفة (حفظ)", en: "Unsubstantiated" },
    inconclusive: { ar: "أدلة غير كافية / غير حاسمة", en: "Inconclusive" },
    not_applicable: { ar: "غير منطبق نظاماً", en: "Not Applicable" },
  };
  return map[finding]?.[locale] || finding;
}

export function formatGroundsForAppeal(grounds: ErAppealGrounds, locale: "ar" | "en" = "ar"): string {
  const map: Record<ErAppealGrounds, { ar: string; en: string }> = {
    new_evidence: { ar: "ظهور أدلة جوهرية جديدة", en: "New Material Evidence" },
    procedural_defect: { ar: "عيب إجرائي في التحقيق أو الإخطار", en: "Procedural Defect" },
    disproportionate_penalty: { ar: "عدم تناسب الجزاء مع المخالفة", en: "Disproportionate Penalty" },
    factual_error: { ar: "خطأ مادي في الوقائع المستند إليها", en: "Factual Error" },
    bias_or_conflict: { ar: "شبهة تحيز أو تعارض مصالح", en: "Bias or Conflict of Interest" },
  };
  return map[grounds]?.[locale] || grounds;
}
