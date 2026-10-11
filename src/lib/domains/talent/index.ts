// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: PRODUCTION CAREER, TALENT, SUCCESSION & INTERNAL MOBILITY ENGINE
// Domain Architecture: src/lib/domains/talent/index.ts
// ============================================================================

export type PathType =
  | "vertical"
  | "lateral"
  | "cross_functional"
  | "leadership"
  | "specialist";

export type CareerPathStatus = "active" | "draft" | "archived";

export interface CareerPath {
  id: string;
  companyId: string;
  code: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  pathType: PathType;
  jobFamily?: string | null;
  status: CareerPathStatus;
  createdAt: string;
  updatedAt: string;
  steps?: CareerPathStep[];
}

export interface CareerPathStep {
  id: string;
  careerPathId: string;
  companyId: string;
  stepOrder: number;
  jobPositionId?: string | null;
  jobTitleAr: string;
  jobTitleEn: string;
  targetGrade?: string | null;
  minTenureMonths: number;
  requiredPerformanceRating: number;
  skillsRequired: Array<{
    skillId: string;
    skillCode?: string;
    nameAr?: string;
    requiredProficiency: number;
  }>;
  certificationsRequired: Array<{
    certificationId: string;
    code?: string;
    nameAr?: string;
  }>;
  createdAt: string;
}

export type CareerReadinessRating =
  | "ready"
  | "near_ready"
  | "development_required"
  | "not_ready";

export interface EmployeeCareerPreference {
  id: string;
  companyId: string;
  employeeId: string;
  targetJobPositionId?: string | null;
  targetPositionTitleAr?: string;
  targetJobFamily?: string | null;
  targetJobTitleAr?: string | null;
  careerInterests?: string | null;
  developmentInterests?: string | null;
  preferredLocation?: string | null;
  willingToRelocate: boolean;
  internationalMobility: boolean;
  isConfidentialFromManager: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareerTargetRole {
  id: string;
  companyId: string;
  employeeId: string;
  jobPositionId: string;
  positionTitleAr?: string;
  targetReadiness: CareerReadinessRating;
  targetDate?: string | null;
  isPrimary: boolean;
  status: "active" | "achieved" | "abandoned";
  createdAt: string;
  updatedAt: string;
}

export type TalentReviewCycleStatus =
  | "draft"
  | "open"
  | "calibration"
  | "finalized"
  | "closed";

export interface TalentReviewCycle {
  id: string;
  companyId: string;
  code: string;
  titleAr: string;
  titleEn: string;
  startDate: string;
  endDate: string;
  year: number;
  status: TalentReviewCycleStatus;
  guidelines?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PerformanceRatingLevel = "low" | "medium" | "high";
export type PotentialRatingLevel = "low" | "medium" | "high";

export type NineBoxCellCode =
  | "1A" // Star: High Perf, High Pot
  | "1B" // High Performer: High Perf, Med Pot
  | "1C" // Solid Professional: High Perf, Low Pot
  | "2A" // High Potential: Med Perf, High Pot
  | "2B" // Core Player: Med Perf, Med Pot
  | "2C" // Effective: Med Perf, Low Pot
  | "3A" // Enigma: Low Perf, High Pot
  | "3B" // Dilemma: Low Perf, Med Pot
  | "3C"; // Underperformer / Risk: Low Perf, Low Pot

export type RetentionRiskLevel = "low" | "medium" | "high" | "critical";

export type PromotionReadinessLevel =
  | "ready_now"
  | "ready_1_year"
  | "ready_2_years"
  | "not_ready";

export interface TalentAssessment {
  id: string;
  companyId: string;
  cycleId: string;
  cycleTitleAr?: string;
  employeeId: string;
  employeeNo?: string;
  employeeName?: string;
  assessorId?: string | null;
  performanceRating: PerformanceRatingLevel;
  potentialRating: PotentialRatingLevel;
  nineBoxCell: NineBoxCellCode;
  calibratedPerformanceRating?: PerformanceRatingLevel | null;
  calibratedPotentialRating?: PotentialRatingLevel | null;
  calibratedNineBoxCell?: NineBoxCellCode | null;
  calibrationNotes?: string | null;
  calibratedBy?: string | null;
  calibratedAt?: string | null;
  retentionRisk: RetentionRiskLevel;
  retentionRiskReason?: string | null;
  criticalTalentFlag: boolean;
  readinessForPromotion: PromotionReadinessLevel;
  isConfidential: boolean;
  status: "draft" | "submitted" | "calibrated" | "finalized";
  createdAt: string;
  updatedAt: string;
}

export type TalentPoolType =
  | "leadership"
  | "technical"
  | "high_potential"
  | "future_managers"
  | "critical_operations";

export interface TalentPool {
  id: string;
  companyId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  poolType: TalentPoolType;
  ownerRole?: string | null;
  isConfidential: boolean;
  isActive: boolean;
  createdAt: string;
  memberCount?: number;
}

export type PoolNominationSource =
  | "manual_nomination"
  | "assessment_cycle"
  | "calibration"
  | "leadership_review"
  | "manager_recommendation";

export type PoolMemberStatus = "active" | "graduated" | "removed" | "on_hold";

export interface TalentPoolMember {
  id: string;
  talentPoolId: string;
  poolNameAr?: string;
  companyId: string;
  employeeId: string;
  employeeNo?: string;
  employeeName?: string;
  entryDate: string;
  exitDate?: string | null;
  nominationSource: PoolNominationSource;
  nominatedBy?: string | null;
  status: PoolMemberStatus;
  reason?: string | null;
  developmentFocus?: string | null;
  createdAt: string;
}

export type CriticalityTier =
  | "business_critical"
  | "leadership_critical"
  | "hard_to_fill"
  | "operational_critical";

export type VacancyRiskLevel = "low" | "medium" | "high" | "critical";

export interface CriticalRole {
  id: string;
  companyId: string;
  jobPositionId: string;
  positionTitleAr?: string;
  positionTitleEn?: string;
  departmentNameAr?: string;
  criticalityTier: CriticalityTier;
  vacancyRisk: VacancyRiskLevel;
  impactOfLoss?: string | null;
  keyPersonDependencyNotes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  successionPlan?: SuccessionPlan | null;
}

export type SuccessionPlanStatus =
  | "active"
  | "under_review"
  | "executed"
  | "archived";

export type TargetFillUrgency =
  | "immediate"
  | "within_6_months"
  | "within_1_year"
  | "long_term";

export interface SuccessionPlan {
  id: string;
  companyId: string;
  criticalRoleId?: string | null;
  jobPositionId: string;
  positionTitleAr?: string;
  incumbentEmployeeId?: string | null;
  incumbentName?: string | null;
  status: SuccessionPlanStatus;
  targetFillUrgency: TargetFillUrgency;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  candidates?: SuccessionCandidate[];
  candidateCount?: number;
  readyNowCount?: number;
}

export type SuccessionReadinessTimeline =
  | "ready_now"
  | "ready_1_year"
  | "ready_2_years"
  | "ready_2_plus_years"
  | "not_ready";

export type SuccessionCandidateStatus =
  | "nominated"
  | "approved"
  | "in_development"
  | "promoted"
  | "withdrawn";

export interface SuccessionCandidate {
  id: string;
  successionPlanId: string;
  companyId: string;
  employeeId: string;
  employeeNo?: string;
  employeeName?: string;
  currentPositionTitleAr?: string;
  readinessTimeline: SuccessionReadinessTimeline;
  ranking: number;
  nominationReason?: string | null;
  retentionRisk: "low" | "medium" | "high";
  status: SuccessionCandidateStatus;
  isEmergencySuccessor: boolean;
  developmentGapSummary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TalentDevelopmentActionType =
  | "learning_course"
  | "mentoring"
  | "stretch_assignment"
  | "temporary_assignment"
  | "certification"
  | "project_exposure"
  | "coaching";

export type TalentDevelopmentActionStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "overdue";

export type TalentDevelopmentActionSource =
  | "career_gap"
  | "succession_readiness"
  | "talent_review"
  | "aspiration"
  | "performance_idp";

export interface TalentDevelopmentAction {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  actionType: TalentDevelopmentActionType;
  titleAr: string;
  titleEn: string;
  targetCompletionDate?: string | null;
  status: TalentDevelopmentActionStatus;
  sourceContext: TalentDevelopmentActionSource;
  sourceReferenceId?: string | null;
  learningItemId?: string | null;
  learningItemTitleAr?: string | null;
  temporaryAssignmentId?: string | null;
  completionEvidence?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InternalOpportunityType =
  | "open_position"
  | "temporary_assignment"
  | "project_assignment"
  | "developmental_secondment";

export type InternalOpportunityStatus =
  | "draft"
  | "open"
  | "closed"
  | "filled"
  | "cancelled";

export interface InternalOpportunity {
  id: string;
  companyId: string;
  opportunityType: InternalOpportunityType;
  titleAr: string;
  titleEn: string;
  jobPositionId?: string | null;
  positionTitleAr?: string | null;
  departmentId?: string | null;
  departmentNameAr?: string | null;
  workLocationId?: string | null;
  targetGrade?: string | null;
  durationMonths?: number | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  requiredSkills: Array<{
    skillId: string;
    skillCode?: string;
    nameAr?: string;
    requiredProficiency: number;
  }>;
  requiredExperienceYears: number;
  minTenureMonthsRequired: number;
  applicationDeadline?: string | null;
  status: InternalOpportunityStatus;
  requisitionId?: string | null;
  createdAt: string;
  updatedAt: string;
  applicationCount?: number;
}

export type InternalApplicationStatus =
  | "submitted"
  | "screening"
  | "shortlisted"
  | "interviewing"
  | "selected"
  | "rejected"
  | "withdrawn";

export interface InternalApplication {
  id: string;
  companyId: string;
  opportunityId: string;
  opportunityTitleAr?: string;
  opportunityType?: InternalOpportunityType;
  employeeId: string;
  employeeNo?: string;
  employeeName?: string;
  currentDepartmentId?: string | null;
  currentDepartmentNameAr?: string | null;
  currentPositionId?: string | null;
  currentPositionTitleAr?: string | null;
  status: InternalApplicationStatus;
  isManagerNotified: boolean;
  matchScore: number;
  matchReasons: string[];
  appliedAt: string;
  selectedAt?: string | null;
  movementId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MentoringRelationship {
  id: string;
  companyId: string;
  mentorEmployeeId: string;
  mentorName?: string;
  menteeEmployeeId: string;
  menteeName?: string;
  objectiveAr: string;
  objectiveEn?: string | null;
  focusAreas?: string | null;
  startDate: string;
  endDate?: string | null;
  status: "active" | "completed" | "on_hold" | "terminated";
  confidentialNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareerConversation {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  managerEmployeeId: string;
  managerName?: string;
  conversationDate: string;
  careerGoalsDiscussed?: string | null;
  developmentPrioritiesAgreed?: string | null;
  targetRolesDiscussed?: string | null;
  agreedActions?: string | null;
  confidentialManagerNotes?: string | null;
  createdAt: string;
}

export interface TalentKpis {
  criticalRolesCount: number;
  rolesWithoutSuccessor: number;
  readyNowSuccessorsCount: number;
  successionCoverageRate: number;
  benchStrengthRate: number;
  highPotentialCount: number;
  activeInternalOpps: number;
  internalApplicationsCount: number;
  activeTalentPoolsCount: number;
  overdueActionsCount: number;
}

// ----------------------------------------------------------------------------
// PURE DOMAIN FUNCTIONS & EVALUATION ENGINES
// ----------------------------------------------------------------------------

export interface NineBoxCellInfo {
  code: NineBoxCellCode;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  colorClass: string;
  category: "growth" | "high_impact" | "core" | "risk";
}

/**
 * Deterministically maps performance and potential rating to standard 9-Box Grid cell.
 */
export function mapPerformancePotentialToNineBox(
  performance: PerformanceRatingLevel,
  potential: PotentialRatingLevel
): NineBoxCellCode {
  if (performance === "high" && potential === "high") return "1A";
  if (performance === "high" && potential === "medium") return "1B";
  if (performance === "high" && potential === "low") return "1C";
  if (performance === "medium" && potential === "high") return "2A";
  if (performance === "medium" && potential === "medium") return "2B";
  if (performance === "medium" && potential === "low") return "2C";
  if (performance === "low" && potential === "high") return "3A";
  if (performance === "low" && potential === "medium") return "3B";
  return "3C";
}

export function getNineBoxCellInfo(cell: NineBoxCellCode): NineBoxCellInfo {
  switch (cell) {
    case "1A":
      return {
        code: "1A",
        titleAr: "نجم المؤسسة (Star)",
        titleEn: "Star",
        descriptionAr: "أداء فائق وإمكانيات قيادية استثنائية - مرشح قيادي مستقبلي",
        descriptionEn: "Top performance and high potential - key future leadership candidate",
        colorClass: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
        category: "growth",
      };
    case "1B":
      return {
        code: "1B",
        titleAr: "عالي الأداء (High Performer)",
        titleEn: "High Performer",
        descriptionAr: "أداء متميز مع إمكانية نمو متوسطة - ركيزة تنفيذية متقدمة",
        descriptionEn: "Outstanding performance with solid growth runway",
        colorClass: "bg-teal-500/15 border-teal-500/40 text-teal-700 dark:text-teal-300",
        category: "high_impact",
      };
    case "1C":
      return {
        code: "1C",
        titleAr: "خبير ومهني موثوق (Solid Professional)",
        titleEn: "Solid Professional",
        descriptionAr: "إتقان مهني عالي في المنصب الحالي - خبير متخصص مستقر",
        descriptionEn: "High performance expert in current domain, steady contributor",
        colorClass: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
        category: "core",
      };
    case "2A":
      return {
        code: "2A",
        titleAr: "واعد عالي الإمكانيات (High Potential)",
        titleEn: "High Potential",
        descriptionAr: "قدرات نمو عالية مع أداء مستقر - يحتاج صقل وتوجيه نحو التميز",
        descriptionEn: "High potential with consistent delivery - target for stretch assignments",
        colorClass: "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300",
        category: "growth",
      };
    case "2B":
      return {
        code: "2B",
        titleAr: "عنصر محوري وأساسي (Core Player)",
        titleEn: "Core Player",
        descriptionAr: "أداء موثوق ومستقر وإمكانيات نمو طبيعية - العمود الفقري للعمليات",
        descriptionEn: "Dependable backbone performer with steady development",
        colorClass: "bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300",
        category: "core",
      };
    case "2C":
      return {
        code: "2C",
        titleAr: "مساهم فعال (Effective Contributor)",
        titleEn: "Effective Contributor",
        descriptionAr: "يفي بالمتطلبات التشغيلية - يحتاج حوافز وتطوير مهارات مستمر",
        descriptionEn: "Meets operational requirements - focus on incremental skills",
        colorClass: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
        category: "core",
      };
    case "3A":
      return {
        code: "3A",
        titleAr: "طاقة واعدة تحتاج توجيه (Enigma)",
        titleEn: "Enigma",
        descriptionAr: "إمكانيات عالية وأداء متعثر - استكشاف معوقات الإنجاز أو تغيير الدور",
        descriptionEn: "High potential but low output - investigate role-fit or blockers",
        colorClass: "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300",
        category: "growth",
      };
    case "3B":
      return {
        code: "3B",
        titleAr: "يحتاج دعم وتطوير (Dilemma)",
        titleEn: "Dilemma",
        descriptionAr: "أداء دون المأمول مع إمكانيات متوسطة - خطة تحسين أداء مستهدفة",
        descriptionEn: "Performance below expectation - requires targeted coaching plan",
        colorClass: "bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-300",
        category: "risk",
      };
    case "3C":
    default:
      return {
        code: "3C",
        titleAr: "منخفض الأداء / مخاطرة (Underperformer / Risk)",
        titleEn: "Underperformer / Risk",
        descriptionAr: "أداء وإمكانيات منخفضة - اتخاذ إجراءات تصحيحية عاجلة",
        descriptionEn: "Low performance and low potential - urgent corrective action required",
        colorClass: "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300",
        category: "risk",
      };
  }
}

/**
 * Calculates Career Readiness truthfully based on skill requirements and validated proficiencies.
 */
export function calculateReadinessFromGaps(params: {
  requiredSkills: Array<{ skillId: string; requiredProficiency: number }>;
  employeeSkills: Array<{ skillId: string; currentProficiency: number }>;
  minTenureMonths?: number;
  currentTenureMonths?: number;
}): {
  readiness: CareerReadinessRating;
  matchScore: number;
  missingSkillsCount: number;
  hasTenureGap: boolean;
} {
  const { requiredSkills, employeeSkills, minTenureMonths = 0, currentTenureMonths = 0 } = params;

  const hasTenureGap = currentTenureMonths < minTenureMonths;

  if (requiredSkills.length === 0) {
    return {
      readiness: hasTenureGap ? "near_ready" : "ready",
      matchScore: hasTenureGap ? 85.0 : 100.0,
      missingSkillsCount: 0,
      hasTenureGap,
    };
  }

  const empProfMap = new Map<string, number>();
  employeeSkills.forEach((s) => empProfMap.set(s.skillId, s.currentProficiency));

  let matchedCount = 0;
  let missingCount = 0;

  for (const req of requiredSkills) {
    const validated = empProfMap.get(req.skillId) || 0;
    if (validated >= req.requiredProficiency) {
      matchedCount++;
    } else {
      missingCount++;
    }
  }

  const rawScore = (matchedCount / requiredSkills.length) * 100;
  const matchScore = Math.round(rawScore * 100) / 100;

  let readiness: CareerReadinessRating;
  if (matchedCount === requiredSkills.length && !hasTenureGap) {
    readiness = "ready";
  } else if (matchScore >= 70 && !hasTenureGap) {
    readiness = "near_ready";
  } else if (matchScore >= 40 || hasTenureGap) {
    readiness = "development_required";
  } else {
    readiness = "not_ready";
  }

  return {
    readiness,
    matchScore,
    missingSkillsCount: missingCount,
    hasTenureGap,
  };
}

/**
 * Masks confidential talent data for employees viewing their own profiles or unauthorized viewers.
 * Confidential items: potential rating, 9-box cell, succession nominations, confidential notes.
 */
export function maskConfidentialTalentData<T extends Partial<TalentAssessment>>(
  assessment: T,
  isPrivileged: boolean
): T {
  if (isPrivileged) return assessment;

  return {
    ...assessment,
    potentialRating: undefined,
    nineBoxCell: undefined,
    calibratedPotentialRating: undefined,
    calibratedNineBoxCell: undefined,
    calibrationNotes: undefined,
    retentionRiskReason: undefined,
    isConfidential: true,
  };
}

/**
 * Formats career readiness timeline into human readable Arabic & English.
 */
export function formatReadinessTimeline(timeline: SuccessionReadinessTimeline): {
  ar: string;
  en: string;
  badgeClass: string;
} {
  switch (timeline) {
    case "ready_now":
      return {
        ar: "جاهز فوراً",
        en: "Ready Now",
        badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
      };
    case "ready_1_year":
      return {
        ar: "جاهز خلال سنة",
        en: "Ready in 1 Year",
        badgeClass: "bg-teal-500/10 text-teal-600 border-teal-500/30",
      };
    case "ready_2_years":
      return {
        ar: "جاهز خلال سنتين",
        en: "Ready in 2 Years",
        badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      };
    case "ready_2_plus_years":
      return {
        ar: "جاهز بعد سنتين فأكثر",
        en: "Ready in 2+ Years",
        badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      };
    case "not_ready":
    default:
      return {
        ar: "غير جاهز حالياً",
        en: "Not Ready",
        badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/30",
      };
  }
}

/**
 * Evaluates succession plan depth and identifies roles at risk.
 */
export function evaluateSuccessionPlanHealth(params: {
  criticalRoles: CriticalRole[];
  successionPlans: SuccessionPlan[];
}): {
  coverageRate: number;
  benchStrengthRate: number;
  uncoveredRoles: CriticalRole[];
  rolesWithReadyNow: number;
} {
  const { criticalRoles, successionPlans } = params;
  if (criticalRoles.length === 0) {
    return {
      coverageRate: 100,
      benchStrengthRate: 100,
      uncoveredRoles: [],
      rolesWithReadyNow: 0,
    };
  }

  const plansByPosition = new Map<string, SuccessionPlan>();
  successionPlans.forEach((p) => plansByPosition.set(p.jobPositionId, p));

  let coveredCount = 0;
  let readyNowCount = 0;
  const uncovered: CriticalRole[] = [];

  for (const cr of criticalRoles) {
    const plan = plansByPosition.get(cr.jobPositionId);
    if (plan && plan.candidates && plan.candidates.length > 0) {
      coveredCount++;
      const hasReadyNow = plan.candidates.some(
        (c) => c.readinessTimeline === "ready_now" && c.status !== "withdrawn"
      );
      if (hasReadyNow) {
        readyNowCount++;
      }
    } else {
      uncovered.push(cr);
    }
  }

  const coverageRate = Math.round((coveredCount / criticalRoles.length) * 10000) / 100;
  const benchStrengthRate = Math.round((readyNowCount / criticalRoles.length) * 10000) / 100;

  return {
    coverageRate,
    benchStrengthRate,
    uncoveredRoles: uncovered,
    rolesWithReadyNow: readyNowCount,
  };
}

export function formatCareerPathType(type: PathType): { ar: string; en: string } {
  switch (type) {
    case "vertical":
      return { ar: "مسار رأسي (ترقية قياسية)", en: "Vertical (Standard Promotion)" };
    case "lateral":
      return { ar: "مسار أفقي (توسيع الخبرات)", en: "Lateral (Broadening)" };
    case "cross_functional":
      return { ar: "مسار متعدد التخصصات", en: "Cross-Functional" };
    case "leadership":
      return { ar: "مسار قيادي وتوجيهي", en: "Leadership Track" };
    case "specialist":
      return { ar: "مسار فني تخصصي (خبير)", en: "Specialist / Subject Matter Expert" };
    default:
      return { ar: type, en: type };
  }
}
