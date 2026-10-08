// ============================================================================
// ONBOARDING & PROBATION DOMAIN TYPES & ENGINE
// src/lib/domains/onboarding/index.ts
// ============================================================================

export type OnboardingStatus =
  | "draft"
  | "pre_onboarding"
  | "in_progress"
  | "waiting_employee"
  | "waiting_internal"
  | "ready_to_join"
  | "completed"
  | "cancelled";

export type TaskOwnerRole =
  | "employee"
  | "hr"
  | "manager"
  | "it"
  | "finance"
  | "payroll"
  | "facilities"
  | "admin"
  | "security";

export type TaskCategory =
  | "document"
  | "asset"
  | "account"
  | "policy"
  | "orientation"
  | "introduction"
  | "setup"
  | "general";

export type OnboardingTaskStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export type ReadinessStatus = "not_ready" | "partially_ready" | "ready";

export type ProbationStatus =
  | "not_started"
  | "active"
  | "review_due"
  | "under_review"
  | "confirmed"
  | "extended"
  | "failed"
  | "cancelled";

export type ProbationReviewType = "mid_term" | "final";

export type ProbationRecommendation = "confirm" | "extend" | "terminate";

export type ProbationDecision = "confirmed" | "extended" | "failed";

export interface OnboardingTemplate {
  id: string;
  companyId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  country: string;
  departmentId?: string;
  employmentType: string;
  isActive: boolean;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingTaskDefinition {
  id: string;
  companyId: string;
  code: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  ownerRole: TaskOwnerRole;
  category: TaskCategory;
  relativeDueDays: number;
  isBlocking: boolean;
  dependencyTaskCodes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface OnboardingCase {
  id: string;
  companyId: string;
  employeeId: string;
  candidateId?: string;
  employmentId?: string;
  templateId?: string;
  templateVersion: number;
  joiningDate: string;
  status: OnboardingStatus;
  ownerUserId?: string;
  managerId?: string;
  buddyId?: string;
  progressPercentage: number;
  readinessStatus: ReadinessStatus;
  blockingReasons: string[];
  welcomeNotes?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  updatedAt: string;
  // Joined fields for display
  employeeName?: string;
  employeeNo?: string;
  jobTitle?: string;
  departmentName?: string;
  managerName?: string;
  buddyName?: string;
}

export interface OnboardingTask {
  id: string;
  caseId: string;
  companyId: string;
  taskDefinitionId?: string;
  code: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  ownerRole: TaskOwnerRole;
  assignedToUserId?: string;
  assignedToEmployeeId?: string;
  dueDate: string;
  relativeDueDays: number;
  status: OnboardingTaskStatus;
  isBlocking: boolean;
  dependsOnTaskIds: string[];
  operationalTaskId?: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface OnboardingDocumentRequirement {
  id: string;
  caseId: string;
  companyId: string;
  docType: string;
  nameAr: string;
  nameEn: string;
  isMandatory: boolean;
  status: "pending" | "uploaded" | "verified" | "rejected";
  employeeDocumentId?: string;
  fileId?: string;
  rejectionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
}

export interface OnboardingAcknowledgement {
  id: string;
  caseId: string;
  companyId: string;
  employeeId: string;
  policyCode: string;
  policyTitleAr: string;
  policyTitleEn: string;
  policyVersion: string;
  acknowledgedAt: string;
  ipAddress?: string;
  signatureText?: string;
}

export interface ProbationPolicy {
  id: string;
  companyId: string;
  nameAr: string;
  nameEn: string;
  country: string;
  defaultDurationDays: number;
  maxExtensionDays: number;
  midReviewDays?: number;
  finalReviewDaysBeforeEnd: number;
  isActive: boolean;
}

export interface ProbationCase {
  id: string;
  companyId: string;
  employeeId: string;
  employmentId?: string;
  onboardingCaseId?: string;
  policyId?: string;
  startDate: string;
  originalEndDate: string;
  currentEndDate: string;
  status: ProbationStatus;
  reviewerEmployeeId?: string;
  reviewDueAt: string;
  finalDecision?: ProbationDecision;
  decisionDate?: string;
  decisionNotes?: string;
  extensionCount: number;
  extensionDays: number;
  extensionReason?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields for display
  employeeName?: string;
  employeeNo?: string;
  jobTitle?: string;
  departmentName?: string;
  reviewerName?: string;
}

export interface ProbationReview {
  id: string;
  probationCaseId: string;
  companyId: string;
  reviewType: ProbationReviewType;
  reviewerId?: string;
  reviewerEmployeeId?: string;
  rating?: number;
  goalsAchievementScore?: number;
  competencyScore?: number;
  managerRecommendation?: ProbationRecommendation;
  hrRecommendation?: ProbationRecommendation;
  comments?: string;
  strengths?: string;
  improvements?: string;
  decision?: ProbationDecision;
  completedAt?: string;
  createdAt: string;
}

export interface OnboardingKpis {
  upcomingJoiners: number;
  joiningThisWeek: number;
  overdueTasks: number;
  missingDocuments: number;
  readyToJoin: number;
  activeCases: number;
  delayedCases: number;
  probationDue: number;
  probationConfirmedRate: number;
}

// ============================================================================
// DOMAIN HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates a deterministic due date based on joining date and relative offset days.
 */
export function calculateTaskDueDate(joiningDateStr: string, relativeDueDays: number): string {
  const date = new Date(joiningDateStr);
  if (isNaN(date.getTime())) {
    throw new Error("تاريخ المباشرة غير صالح");
  }
  date.setDate(date.getDate() + relativeDueDays);
  return date.toISOString().split("T")[0];
}

/**
 * Evaluates the joining readiness truthful status based on actual task and document state.
 */
export function evaluateReadiness(
  tasks: OnboardingTask[],
  docs: OnboardingDocumentRequirement[],
): {
  readiness: ReadinessStatus;
  blockers: string[];
  progress: number;
} {
  const activeTasks = tasks.filter((t) => t.status !== "cancelled");
  const totalTasks = activeTasks.length;
  const completedTasks = activeTasks.filter((t) => t.status === "completed").length;
  const blockingIncomplete = activeTasks.filter((t) => t.isBlocking && t.status !== "completed");

  const mandatoryDocs = docs.filter((d) => d.isMandatory);
  const unverifiedDocs = mandatoryDocs.filter((d) => d.status !== "verified");
  const uploadedOrVerifiedDocs = mandatoryDocs.filter(
    (d) => d.status === "uploaded" || d.status === "verified",
  );

  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const blockers: string[] = [];

  if (blockingIncomplete.length > 0) {
    blockers.push(`يوجد ${blockingIncomplete.length} مهام تأسيسية معلقة تمنع المباشرة`);
  }

  if (unverifiedDocs.length > 0) {
    blockers.push(`يوجد ${unverifiedDocs.length} مستندات إلزامية بانتظار الاعتماد`);
  }

  let readiness: ReadinessStatus = "not_ready";

  if (blockingIncomplete.length === 0 && unverifiedDocs.length === 0) {
    readiness = "ready";
  } else if (uploadedOrVerifiedDocs.length > 0 || progress >= 50) {
    readiness = "partially_ready";
  } else {
    readiness = "not_ready";
  }

  return { readiness, blockers, progress };
}

/**
 * Checks whether an onboarding case can be officially completed.
 */
export function canCompleteOnboarding(
  _onboardingCase: OnboardingCase,
  tasks: OnboardingTask[],
  docs: OnboardingDocumentRequirement[],
): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const incompleteBlockingTasks = tasks.filter(
    (t) => t.status !== "cancelled" && t.isBlocking && t.status !== "completed",
  );
  if (incompleteBlockingTasks.length > 0) {
    reasons.push(`لا يمكن إنهاء التهيئة قبل إكمال المهام الأساسية (${incompleteBlockingTasks.length})`);
  }

  const unverifiedMandatoryDocs = docs.filter(
    (d) => d.isMandatory && d.status !== "verified",
  );
  if (unverifiedMandatoryDocs.length > 0) {
    reasons.push(`لا يمكن إنهاء التهيئة قبل اعتماد كافة الوثائق الإلزامية (${unverifiedMandatoryDocs.length})`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

/**
 * Validates requested probation extension against policy limits.
 */
export function validateProbationExtension(
  policy: ProbationPolicy | undefined,
  currentExtensionDays: number,
  requestedExtensionDays: number,
): { valid: boolean; reason?: string } {
  if (requestedExtensionDays <= 0) {
    return { valid: false, reason: "عدد أيام التمديد يجب أن يكون أكبر من صفر" };
  }

  if (!policy) {
    // If no policy specified, fallback max 90 days
    if (currentExtensionDays + requestedExtensionDays > 90) {
      return { valid: false, reason: "التمديد يتجاوز الحد الأقصى الافتراضي (90 يوماً)" };
    }
    return { valid: true };
  }

  if (policy.maxExtensionDays <= 0) {
    return { valid: false, reason: `وفقاً لسياسة الدولة (${policy.country}) لا يسمح بتمديد فترة التجربة` };
  }

  if (currentExtensionDays + requestedExtensionDays > policy.maxExtensionDays) {
    return {
      valid: false,
      reason: `التمديد الإجمالي (${currentExtensionDays + requestedExtensionDays} يوماً) يتجاوز الحد النظامي الأقصى (${policy.maxExtensionDays} يوماً)`,
    };
  }

  return { valid: true };
}

/**
 * Privacy protection: Masks or strips sensitive fields when presenting data to line managers.
 * Managers must not see bank accounts, national ID details, or private medical attachments.
 */
export function maskSensitiveEmployeeDataForManager<T extends Record<string, any>>(data: T): T {
  const safe: Record<string, any> = { ...data };
  if ("bankAccount" in safe) delete safe.bankAccount;
  if ("iban" in safe) safe.iban = "SA****************";
  if ("nationalIdOrIqama" in safe) safe.nationalIdOrIqama = "**********";
  if ("medicalAttachment" in safe) delete safe.medicalAttachment;
  if ("basicSalary" in safe) delete safe.basicSalary;
  if ("totalSalary" in safe) delete safe.totalSalary;
  return safe as T;
}
