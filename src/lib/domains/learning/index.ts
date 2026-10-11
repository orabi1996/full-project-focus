// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 29: PRODUCTION LEARNING, SKILLS, CERTIFICATIONS & TRAINING ENGINE
// Domain Architecture: src/lib/domains/learning/index.ts
// ============================================================================

export type SkillCategoryCode =
  | "technical"
  | "functional"
  | "behavioral"
  | "leadership"
  | "digital"
  | "language"
  | "safety"
  | "compliance";

export type ProficiencyScaleType = "1_to_5" | "1_to_3" | "binary";

export interface SkillCategory {
  id: string;
  companyId: string;
  code: SkillCategoryCode | string;
  nameAr: string;
  nameEn: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Skill {
  id: string;
  companyId: string;
  categoryId?: string | null;
  categoryNameAr?: string;
  categoryNameEn?: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  category: SkillCategoryCode;
  proficiencyScaleType: ProficiencyScaleType;
  ownerRole?: string | null;
  status: "active" | "inactive" | "deprecated";
  createdAt: string;
  updatedAt: string;
}

export interface Competency {
  id: string;
  frameworkId?: string;
  code: string;
  nameAr: string;
  nameEn: string;
  category: "core" | "leadership" | "functional" | "technical" | "behavioral";
  description?: string | null;
  behavioralIndicators?: Array<{ level: number; description: string }>;
  weight: number;
  scaleMin: number;
  scaleMax: number;
  isActive: boolean;
}

export interface JobSkillRequirement {
  id: string;
  companyId: string;
  jobPositionId?: string | null;
  positionTitleAr?: string;
  grade?: string | null;
  jobFamily?: string | null;
  skillId?: string | null;
  skillNameAr?: string;
  skillNameEn?: string;
  skillCode?: string;
  competencyId?: string | null;
  certificationId?: string | null;
  requiredProficiency: number;
  isMandatory: boolean;
  createdAt: string;
}

export type SkillProficiencySource =
  | "self_assessment"
  | "manager_assessment"
  | "formal_assessment"
  | "training_completion"
  | "certification"
  | "hr_validation";

export interface EmployeeSkill {
  id: string;
  companyId: string;
  employeeId: string;
  employeeNo?: string;
  employeeName?: string;
  skillId: string;
  skillCode?: string;
  skillNameAr?: string;
  skillNameEn?: string;
  skillCategory?: SkillCategoryCode;
  selfReportedLevel?: number | null;
  managerConfirmedLevel?: number | null;
  formallyVerifiedLevel?: number | null;
  currentProficiency: number; // Validated organizational proficiency
  source: SkillProficiencySource;
  assessedBy?: string | null;
  assessorName?: string | null;
  assessedAt: string;
  evidenceUrl?: string | null;
  expiryDate?: string | null;
  status: "active" | "pending_verification" | "expired" | "superseded";
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillGapItem {
  skillId: string;
  skillCode: string;
  skillNameAr: string;
  skillNameEn: string;
  skillCategory: SkillCategoryCode;
  requiredProficiency: number;
  validatedProficiency: number;
  gap: number;
  hasGap: boolean;
  isMandatory: boolean;
}

export interface TrainingProvider {
  id: string;
  companyId: string;
  providerType: "internal" | "external";
  nameAr: string;
  nameEn: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  country: string;
  rating?: number | null;
  status: "active" | "inactive" | "blacklisted";
  notes?: string | null;
  createdAt: string;
}

export type LearningItemType =
  | "course"
  | "workshop"
  | "program"
  | "seminar"
  | "webinar"
  | "orientation"
  | "certification_preparation"
  | "external_training";

export type DeliveryMethod = "classroom" | "virtual" | "self_paced" | "external" | "blended";

export interface LearningItem {
  id: string;
  companyId: string;
  itemType: LearningItemType;
  code: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  category: string;
  deliveryMethod: DeliveryMethod;
  durationHours: number;
  providerId?: string | null;
  providerNameAr?: string;
  skillsDeveloped?: string[];
  targetAudience?: string | null;
  prerequisites?: string | null;
  isMandatory: boolean;
  validityMonths?: number | null;
  estimatedCost: number;
  status: "draft" | "active" | "archived" | "deprecated";
  createdAt: string;
  updatedAt: string;
}

export interface LearningProgram {
  id: string;
  companyId: string;
  code: string;
  titleAr: string;
  titleEn: string;
  description?: string | null;
  targetRole?: string | null;
  status: "active" | "inactive" | "archived";
  itemsCount?: number;
  items?: LearningProgramItem[];
  createdAt: string;
}

export interface LearningProgramItem {
  id: string;
  programId: string;
  learningItemId: string;
  learningItem?: LearningItem;
  sequenceOrder: number;
  isRequired: boolean;
  createdAt: string;
}

export type SessionStatus =
  | "draft"
  | "open"
  | "full"
  | "closed"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface TrainingSession {
  id: string;
  companyId: string;
  learningItemId: string;
  courseTitleAr?: string;
  courseTitleEn?: string;
  sessionCode: string;
  trainerName?: string | null;
  providerId?: string | null;
  providerNameAr?: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location?: string | null;
  virtualUrl?: string | null;
  capacity: number;
  enrolledCount: number;
  registrationDeadline?: string | null;
  costPerSeat: number;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export type EnrollmentSource =
  | "employee_request"
  | "manager_nomination"
  | "hr_assignment"
  | "mandatory_assignment"
  | "development_plan"
  | "onboarding";

export type EnrollmentStatus =
  | "requested"
  | "pending_approval"
  | "approved"
  | "enrolled"
  | "waitlisted"
  | "rejected"
  | "cancelled"
  | "attended"
  | "completed"
  | "failed"
  | "no_show";

export type TrainingAttendanceStatus = "present" | "absent" | "late" | "excused" | "no_show";
export type TrainingCompletionStatus = "completed" | "failed" | "in_progress" | "not_started";

export interface TrainingEnrollment {
  id: string;
  companyId: string;
  sessionId: string;
  sessionCode?: string;
  courseTitleAr?: string;
  courseTitleEn?: string;
  employeeId: string;
  employeeNo?: string;
  employeeName?: string;
  departmentName?: string;
  enrollmentSource: EnrollmentSource;
  status: EnrollmentStatus;
  attendanceStatus?: TrainingAttendanceStatus | null;
  completionStatus?: TrainingCompletionStatus | null;
  completionDate?: string | null;
  score?: number | null;
  passed?: boolean | null;
  requestId?: string | null;
  cost: number;
  notes?: string | null;
  enrolledAt: string;
  updatedAt: string;
}

export type TrainingNeedSource =
  | "skill_gap"
  | "performance_review"
  | "manager_request"
  | "employee_request"
  | "mandatory_compliance"
  | "onboarding"
  | "career_development"
  | "organization_initiative";

export interface TrainingNeed {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  source: TrainingNeedSource;
  skillId?: string | null;
  skillNameAr?: string;
  competencyId?: string | null;
  recommendedLearningItemId?: string | null;
  recommendedCourseTitle?: string;
  reason: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "identified" | "proposed" | "approved" | "planned" | "assigned" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface LearningPlan {
  id: string;
  companyId: string;
  employeeId: string;
  year: number;
  title: string;
  status: "draft" | "active" | "completed" | "cancelled";
  items?: LearningPlanItem[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningPlanItem {
  id: string;
  planId: string;
  trainingNeedId?: string | null;
  learningItemId?: string | null;
  courseTitleAr?: string;
  targetCompletionDate?: string | null;
  priority: "low" | "medium" | "high" | "critical";
  source: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  completedAt?: string | null;
  createdAt: string;
}

export interface LearningAssessment {
  id: string;
  companyId: string;
  employeeId: string;
  sessionId?: string | null;
  assessmentType: "score" | "pass_fail" | "manager_validation" | "trainer_evaluation";
  score?: number | null;
  maxScore?: number;
  passed: boolean;
  assessorId?: string | null;
  assessedAt: string;
  isConfidential: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface Certification {
  id: string;
  companyId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  issuer: string;
  category: string;
  validityMonths?: number | null;
  renewalRequired: boolean;
  isActive: boolean;
  createdAt: string;
}

export type CertificationVerificationStatus = "pending_verification" | "verified" | "rejected" | "revoked";
export type CertificationStatus = "pending_verification" | "valid" | "expiring" | "expired" | "rejected" | "revoked";

export interface EmployeeCertification {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  certificationId: string;
  certificationCode?: string;
  certificationNameAr?: string;
  certificationNameEn?: string;
  certificateNumber: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string | null;
  documentId?: string | null;
  verificationStatus: CertificationVerificationStatus;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
  status: CertificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MandatoryLearningRule {
  id: string;
  companyId: string;
  ruleNameAr: string;
  ruleNameEn: string;
  courseId: string;
  courseTitleAr?: string;
  targetType: "all_employees" | "department" | "job" | "position" | "grade" | "location";
  targetId?: string | null;
  targetValue?: string | null;
  recurrenceMonths?: number | null;
  daysToComplete: number;
  isActive: boolean;
  createdAt: string;
}

export interface LearningKpis {
  activeCourses: number;
  upcomingSessions: number;
  totalEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  expiringCertifications: number;
  totalTrainingCost: number;
  activeSkillsCount: number;
}

// ============================================================================
// PURE DOMAIN RULES & LOGIC FUNCTIONS
// ============================================================================

/**
 * Calculates skill gap between requirement and validated proficiency.
 */
export function calculateSkillGap(
  requiredProficiency: number,
  validatedProficiency: number
): {
  gap: number;
  hasGap: boolean;
  meetsRequirement: boolean;
  exceedsRequirement: boolean;
} {
  const req = Math.max(0, requiredProficiency);
  const val = Math.max(0, validatedProficiency);
  const gap = Math.max(0, Math.round((req - val) * 10) / 10);

  return {
    gap,
    hasGap: gap > 0,
    meetsRequirement: val >= req,
    exceedsRequirement: val > req,
  };
}

/**
 * Evaluates session seat capacity deterministically.
 */
export function evaluateSessionCapacity(
  capacity: number,
  enrolledCount: number
): {
  hasSeat: boolean;
  isFull: boolean;
  seatsRemaining: number;
} {
  const cap = Math.max(1, capacity);
  const enrolled = Math.max(0, enrolledCount);
  const remaining = Math.max(0, cap - enrolled);

  return {
    hasSeat: remaining > 0,
    isFull: remaining === 0,
    seatsRemaining: remaining,
  };
}

/**
 * Evaluates certification expiry status based on target date and threshold.
 */
export function evaluateCertificationExpiry(
  expiryDate: string | null | undefined,
  thresholdDays: number = 60,
  referenceDate: string = new Date().toISOString().split("T")[0]
): {
  status: CertificationStatus;
  daysUntilExpiry: number | null;
  isExpiring: boolean;
  isExpired: boolean;
} {
  if (!expiryDate) {
    return {
      status: "valid",
      daysUntilExpiry: null,
      isExpiring: false,
      isExpired: false,
    };
  }

  const expTime = new Date(expiryDate).getTime();
  const refTime = new Date(referenceDate).getTime();
  const diffDays = Math.round((expTime - refTime) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: "expired",
      daysUntilExpiry: diffDays,
      isExpiring: false,
      isExpired: true,
    };
  }

  if (diffDays <= thresholdDays) {
    return {
      status: "expiring",
      daysUntilExpiry: diffDays,
      isExpiring: true,
      isExpired: false,
    };
  }

  return {
    status: "valid",
    daysUntilExpiry: diffDays,
    isExpiring: false,
    isExpired: false,
  };
}

/**
 * Masks confidential learning assessments for unprivileged viewers.
 */
export function maskConfidentialAssessment(
  assessment: LearningAssessment,
  isPrivileged: boolean
): LearningAssessment {
  if (isPrivileged || !assessment.isConfidential) {
    return assessment;
  }

  return {
    ...assessment,
    notes: "****** (محمية ومخصصة للمقيمين المعتمدين فقط)",
  };
}

/**
 * Calculates training completion rate percentage.
 */
export function calculateLearningCompletionRate(completed: number, total: number): number {
  if (total <= 0) return 0.0;
  return Math.round((Math.max(0, completed) / total) * 1000) / 10;
}

/**
 * Formats a 1-5 proficiency scale with Arabic & English labels.
 */
export function formatProficiencyLevel(level: number): {
  labelAr: string;
  labelEn: string;
  color: string;
} {
  const rounded = Math.round(level);
  switch (rounded) {
    case 1:
      return { labelAr: "مستوى 1 — إدراك (Awareness)", labelEn: "Level 1 — Awareness", color: "text-slate-500" };
    case 2:
      return { labelAr: "مستوى 2 — أساسي (Basic)", labelEn: "Level 2 — Basic", color: "text-blue-500" };
    case 3:
      return { labelAr: "مستوى 3 — ممارس (Working)", labelEn: "Level 3 — Working", color: "text-emerald-500" };
    case 4:
      return { labelAr: "مستوى 4 — متقدم (Advanced)", labelEn: "Level 4 — Advanced", color: "text-purple-500" };
    case 5:
      return { labelAr: "مستوى 5 — خبير (Expert)", labelEn: "Level 5 — Expert", color: "text-amber-500" };
    default:
      return { labelAr: `مستوى ${level}`, labelEn: `Level ${level}`, color: "text-muted-foreground" };
  }
}
