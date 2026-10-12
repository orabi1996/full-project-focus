// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 31: PRODUCTION EMPLOYEE ENGAGEMENT, SURVEYS, PULSE & RECOGNITION ENGINE
// Domain Architecture: src/lib/domains/engagement/index.ts
// ============================================================================

export type SurveyType =
  | "engagement"
  | "pulse"
  | "enps"
  | "onboarding"
  | "probation"
  | "exit"
  | "manager_effectiveness"
  | "event_feedback"
  | "custom";

export type AnonymityMode = "anonymous" | "identified";

export type SurveyInstanceStatus =
  | "draft"
  | "scheduled"
  | "open"
  | "paused"
  | "closed"
  | "cancelled"
  | "archived";

export type AudienceTargetType =
  | "all_company"
  | "department"
  | "location"
  | "grade"
  | "job_position"
  | "custom_group";

export type ParticipationStatus = "eligible" | "started" | "completed";

export type QuestionCategory =
  | "leadership"
  | "manager"
  | "communication"
  | "culture"
  | "recognition"
  | "growth"
  | "learning"
  | "wellbeing"
  | "teamwork"
  | "work_environment"
  | "trust"
  | "purpose"
  | "compensation_perception"
  | "employee_experience"
  | "general";

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "likert_scale"
  | "numeric_scale"
  | "enps_0_10"
  | "rating"
  | "yes_no"
  | "free_text";

export type ActionPlanStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "overdue";

export type ActionItemStatus = "pending" | "completed";

export type RecognitionVisibility = "private" | "team" | "company";

export type RecognitionStatus = "published" | "pending_approval" | "rejected";

export type CampaignType =
  | "employee_of_month"
  | "innovation_award"
  | "leadership_award"
  | "values_champion";

export type CampaignStatus = "draft" | "active" | "voting" | "closed" | "archived";

export type NominationStatus = "submitted" | "shortlisted" | "winner" | "rejected";

// ============================================================================
// ENTITY INTERFACES
// ============================================================================

export interface SurveyTemplate {
  id: string;
  companyId: string;
  code: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  surveyType: SurveyType;
  defaultAnonymityMode: AnonymityMode;
  estimatedCompletionMinutes: number;
  isActive: boolean;
  currentVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  versions?: SurveyTemplateVersion[];
}

export interface SurveyTemplateVersion {
  id: string;
  templateId: string;
  companyId: string;
  versionNumber: number;
  status: "draft" | "published" | "archived";
  questionsJson: SurveyQuestionSnapshot[];
  createdAt: string;
}

export interface SurveyQuestionSnapshot {
  id: string;
  code: string;
  textAr: string;
  textEn: string;
  category: QuestionCategory;
  questionType: QuestionType;
  scaleConfig?: {
    min: number;
    max: number;
    minLabelAr?: string;
    maxLabelAr?: string;
    options?: Array<{ id: string; labelAr: string; labelEn: string; value: number | string }>;
  } | null;
  isRequired: boolean;
  orderIndex?: number;
}

export interface SurveyQuestion {
  id: string;
  companyId: string;
  code: string;
  textAr: string;
  textEn: string;
  category: QuestionCategory;
  questionType: QuestionType;
  scaleConfig?: {
    min: number;
    max: number;
    minLabelAr?: string;
    maxLabelAr?: string;
    options?: Array<{ id: string; labelAr: string; labelEn: string; value: number | string }>;
  } | null;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface SurveyAudience {
  id: string;
  surveyId: string;
  companyId: string;
  targetType: AudienceTargetType;
  targetEntityId?: string | null;
  createdAt: string;
}

export interface SurveyParticipant {
  id: string;
  surveyId: string;
  companyId: string;
  employeeId: string;
  participationStatus: ParticipationStatus;
  anonymityToken: string;
  invitedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  departmentSnapshotId?: string | null;
  createdAt: string;
  employeeNameAr?: string;
  employeeNo?: string;
}

export interface SurveyAnswer {
  questionId: string;
  questionCode: string;
  category: QuestionCategory;
  questionType: QuestionType;
  valueNumeric?: number | null;
  valueText?: string | null;
  choiceIds?: string[];
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  companyId: string;
  submissionToken: string;
  employeeId?: string | null; // NULL in anonymous mode!
  status: "draft" | "submitted";
  answers: SurveyAnswer[];
  departmentId?: string | null;
  submittedAt: string;
  createdAt: string;
}

export interface DepartmentScore {
  department_id: string;
  department_name: string;
  response_count: number;
  suppressed: boolean;
  score: number | null;
  suppression_reason?: string;
}

export interface SurveyResultSnapshot {
  id: string;
  surveyId: string;
  companyId: string;
  eligibleCount: number;
  completedCount: number;
  participationRate: number;
  overallEngagementScore: number;
  enpsScore: number;
  promotersCount: number;
  passivesCount: number;
  detractorsCount: number;
  dimensionScores: Record<string, number>;
  departmentScores: DepartmentScore[];
  calculatedAt: string;
}

export interface SurveyInstance {
  id: string;
  companyId: string;
  templateVersionId?: string | null;
  code: string;
  titleAr: string;
  titleEn: string;
  surveyType: SurveyType;
  status: SurveyInstanceStatus;
  launchAt?: string | null;
  closeAt?: string | null;
  anonymityMode: AnonymityMode;
  minimumReportingGroupSize: number;
  createdBy?: string | null;
  publishedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  templateTitleAr?: string;
  snapshot?: SurveyResultSnapshot | null;
  audiences?: SurveyAudience[];
  questions?: SurveyQuestionSnapshot[];
}

export interface EngagementActionPlan {
  id: string;
  companyId: string;
  surveyId?: string | null;
  surveyTitleAr?: string;
  titleAr: string;
  titleEn: string;
  dimension: string;
  departmentId?: string | null;
  departmentNameAr?: string;
  ownerEmployeeId?: string | null;
  ownerNameAr?: string;
  description?: string | null;
  targetDate?: string | null;
  status: ActionPlanStatus;
  successMeasure?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: EngagementActionItem[];
}

export interface EngagementActionItem {
  id: string;
  actionPlanId: string;
  companyId: string;
  titleAr: string;
  titleEn: string;
  assigneeId?: string | null;
  assigneeNameAr?: string;
  dueDate?: string | null;
  status: ActionItemStatus;
  createdAt: string;
}

export interface RecognitionCategory {
  id: string;
  companyId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  iconName: string;
  color: string;
  isActive: boolean;
  createdAt: string;
}

export interface RecognitionBadge {
  id: string;
  companyId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  iconName: string;
  categoryId?: string | null;
  categoryNameAr?: string;
  isActive: boolean;
  createdAt: string;
}

export interface EmployeeRecognition {
  id: string;
  companyId: string;
  senderEmployeeId: string;
  senderNameAr?: string;
  senderJobTitleAr?: string;
  senderAvatarUrl?: string;
  recipientEmployeeId: string;
  recipientNameAr?: string;
  recipientJobTitleAr?: string;
  recipientAvatarUrl?: string;
  categoryId?: string | null;
  categoryNameAr?: string;
  categoryColor?: string;
  badgeId?: string | null;
  badgeNameAr?: string;
  badgeIconName?: string;
  message: string;
  visibility: RecognitionVisibility;
  status: RecognitionStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  points: number;
  createdAt: string;
}

export interface RecognitionCampaign {
  id: string;
  companyId: string;
  code: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  campaignType: CampaignType;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  winnerEmployeeId?: string | null;
  winnerNameAr?: string;
  createdAt: string;
  nominationsCount?: number;
}

export interface RecognitionNomination {
  id: string;
  campaignId: string;
  campaignTitleAr?: string;
  companyId: string;
  nomineeEmployeeId: string;
  nomineeNameAr?: string;
  nomineeJobTitleAr?: string;
  nominatorEmployeeId: string;
  nominatorNameAr?: string;
  reason: string;
  evidenceUrl?: string | null;
  status: NominationStatus;
  createdAt: string;
}

export interface EngagementKpis {
  activeSurveys: number;
  avgParticipation: number;
  latestEnps: number;
  openActions: number;
  overdueActions: number;
  recognitionsMonth: number;
  recognizedEmployeesCount: number;
}

// ============================================================================
// PURE DOMAIN RULES & LOGIC
// ============================================================================

/**
 * Standard eNPS formula:
 * Detractors: 0-6
 * Passives: 7-8
 * Promoters: 9-10
 * eNPS = % Promoters - % Detractors
 * Range: -100.00 to +100.00
 */
export function calculateEnps(
  promoters: number,
  passives: number,
  detractors: number
): number {
  const total = promoters + passives + detractors;
  if (total <= 0) return 0;
  const promoterPct = (promoters / total) * 100;
  const detractorPct = (detractors / total) * 100;
  return Math.round((promoterPct - detractorPct) * 100) / 100;
}

/**
 * Classifies an individual 0-10 eNPS score into promoter, passive, or detractor.
 */
export function classifyEnpsScore(score: number): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

/**
 * Calculates Favorability Rate (% favorable answers).
 * Typically rating >= 4 on 1-5 Likert scale or >= 8 on 0-10 scale.
 */
export function calculateFavorability(
  answers: Array<{ valueNumeric?: number | null; questionType: QuestionType }>
): number {
  const eligible = answers.filter((a) => a.valueNumeric != null);
  if (eligible.length === 0) return 0;

  let favorableCount = 0;
  for (const a of eligible) {
    const val = a.valueNumeric!;
    if (a.questionType === "likert_scale" && val >= 4) {
      favorableCount++;
    } else if (a.questionType === "enps_0_10" && val >= 8) {
      favorableCount++;
    } else if (a.questionType === "numeric_scale" && val >= 4) {
      favorableCount++;
    } else if (val >= 4) {
      favorableCount++;
    }
  }

  return Math.round((favorableCount / eligible.length) * 10000) / 100;
}

/**
 * Evaluates whether an aggregate cohort meets the anonymity privacy threshold.
 * Default minimum is 5 responses.
 */
export function evaluateAnonymityThreshold(
  responseCount: number,
  threshold = 5
): { isSuppressed: boolean; reason?: string } {
  if (responseCount < threshold) {
    return {
      isSuppressed: true,
      reason: `عدد الاستجابات (${responseCount}) أقل من حد حماية الخصوصية الأدنى (${threshold})`,
    };
  }
  return { isSuppressed: false };
}

/**
 * Sanitizes free-text comments to avoid inadvertent deanonymization
 * if anonymous mode is enabled (strips email patterns and phone numbers).
 */
export function sanitizeAnonymousComment(comment: string, isAnonymous: boolean): string {
  if (!isAnonymous || !comment) return comment;
  return comment
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[تم حجب البريد للسرية]")
    .replace(/(\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[تم حجب الرقم للسرية]");
}

/**
 * Status presentation mappings
 */
export function formatSurveyStatus(status: SurveyInstanceStatus): {
  labelAr: string;
  labelEn: string;
  color: string;
} {
  switch (status) {
    case "draft":
      return { labelAr: "مسودة", labelEn: "Draft", color: "bg-slate-100 text-slate-800 border-slate-300" };
    case "scheduled":
      return { labelAr: "مجدول", labelEn: "Scheduled", color: "bg-blue-100 text-blue-800 border-blue-300" };
    case "open":
      return { labelAr: "مفتوح ومستمر", labelEn: "Open", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    case "paused":
      return { labelAr: "موقف مؤقتاً", labelEn: "Paused", color: "bg-amber-100 text-amber-800 border-amber-300" };
    case "closed":
      return { labelAr: "مغلق", labelEn: "Closed", color: "bg-purple-100 text-purple-800 border-purple-300" };
    case "cancelled":
      return { labelAr: "ملغي", labelEn: "Cancelled", color: "bg-rose-100 text-rose-800 border-rose-300" };
    case "archived":
      return { labelAr: "مؤرشف", labelEn: "Archived", color: "bg-zinc-100 text-zinc-700 border-zinc-300" };
    default:
      return { labelAr: status, labelEn: status, color: "bg-muted text-muted-foreground border-border" };
  }
}

export function formatSurveyType(type: SurveyType): { labelAr: string; labelEn: string } {
  switch (type) {
    case "engagement":
      return { labelAr: "استبيان الارتباط الوظيفي الشامل", labelEn: "Engagement Survey" };
    case "pulse":
      return { labelAr: "استبيان النبض السريع", labelEn: "Pulse Survey" };
    case "enps":
      return { labelAr: "مؤشر ولاء الموظفين (eNPS)", labelEn: "eNPS Survey" };
    case "onboarding":
      return { labelAr: "استبيان التهيئة والتأهيل", labelEn: "Onboarding Survey" };
    case "probation":
      return { labelAr: "استبيان نهاية فترة التجربة", labelEn: "Probation Review Survey" };
    case "exit":
      return { labelAr: "استبيان إنهاء الخدمة / المقابلة", labelEn: "Exit Survey" };
    case "manager_effectiveness":
      return { labelAr: "تقييم كفاءة القيادة والإدارة", labelEn: "Manager Effectiveness" };
    case "event_feedback":
      return { labelAr: "استبيان الفعاليات والمبادرات", labelEn: "Event Feedback" };
    case "custom":
      return { labelAr: "استبيان مخصص", labelEn: "Custom Survey" };
    default:
      return { labelAr: type, labelEn: type };
  }
}

export function formatDimensionName(category: QuestionCategory): { labelAr: string; labelEn: string } {
  switch (category) {
    case "leadership":
      return { labelAr: "القيادة العليا والرؤية", labelEn: "Senior Leadership" };
    case "manager":
      return { labelAr: "العلاقة مع المدير المباشر", labelEn: "Manager Support" };
    case "communication":
      return { labelAr: "التواصل الداخلي والشفافية", labelEn: "Internal Communication" };
    case "culture":
      return { labelAr: "الثقافة وبيئة العمل", labelEn: "Company Culture" };
    case "recognition":
      return { labelAr: "التقدير والمكافآت المعنوية", labelEn: "Recognition & Reward" };
    case "growth":
      return { labelAr: "التطور والفرص المهنية", labelEn: "Career Growth" };
    case "learning":
      return { labelAr: "التدريب واكتساب المهارات", labelEn: "Learning & Development" };
    case "wellbeing":
      return { labelAr: "الصحة وجودة الحياة الوظيفية", labelEn: "Wellbeing & Work-Life" };
    case "teamwork":
      return { labelAr: "التعاون وروح الفريق", labelEn: "Team Collaboration" };
    case "work_environment":
      return { labelAr: "بيئة وأدوات العمل", labelEn: "Work Environment" };
    case "trust":
      return { labelAr: "الثقة والأمان النفسي", labelEn: "Trust & Safety" };
    case "purpose":
      return { labelAr: "الشعور بالأثر والهدف", labelEn: "Purpose & Impact" };
    case "compensation_perception":
      return { labelAr: "عدالة المزايا والتعويضات", labelEn: "Compensation Perception" };
    case "employee_experience":
      return { labelAr: "تجربة الموظف الإجمالية", labelEn: "Employee Experience" };
    case "general":
      return { labelAr: "محاور عامة", labelEn: "General" };
    default:
      return { labelAr: category, labelEn: category };
  }
}

export function formatActionPlanStatus(status: ActionPlanStatus): {
  labelAr: string;
  labelEn: string;
  color: string;
} {
  switch (status) {
    case "draft":
      return { labelAr: "مسودة", labelEn: "Draft", color: "bg-slate-100 text-slate-800 border-slate-300" };
    case "planned":
      return { labelAr: "مخطط لها", labelEn: "Planned", color: "bg-blue-100 text-blue-800 border-blue-300" };
    case "in_progress":
      return { labelAr: "قيد التنفيذ", labelEn: "In Progress", color: "bg-amber-100 text-amber-800 border-amber-300" };
    case "completed":
      return { labelAr: "مكتملة", labelEn: "Completed", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    case "overdue":
      return { labelAr: "متأخرة", labelEn: "Overdue", color: "bg-rose-100 text-rose-800 border-rose-300" };
    case "cancelled":
      return { labelAr: "ملغاة", labelEn: "Cancelled", color: "bg-zinc-100 text-zinc-600 border-zinc-300" };
    default:
      return { labelAr: status, labelEn: status, color: "bg-muted text-muted-foreground border-border" };
  }
}

export function formatCampaignType(type: CampaignType): { labelAr: string; labelEn: string } {
  switch (type) {
    case "employee_of_month":
      return { labelAr: "موظف الشهر المتميز", labelEn: "Employee of the Month" };
    case "innovation_award":
      return { labelAr: "جائزة الابتكار والتحسين", labelEn: "Innovation Award" };
    case "leadership_award":
      return { labelAr: "جائزة القدوة والقيادة", labelEn: "Leadership Champion" };
    case "values_champion":
      return { labelAr: "سفير قيم المنشأة", labelEn: "Values Champion" };
    default:
      return { labelAr: type, labelEn: type };
  }
}
