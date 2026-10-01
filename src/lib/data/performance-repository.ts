import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "../query/query-keys";
import { useAuth } from "../auth/AuthContext";
import { AppMutationError } from "./reliable-mutation";

// Typecast client to access RPCs & custom tables safely
const db = supabase as any;

// ============================================================================
// 1. DOMAIN INTERFACES & TYPES
// ============================================================================

export type PerformanceCycleStatus =
  | "draft"
  | "planned"
  | "open"
  | "review_in_progress"
  | "calibration"
  | "finalized"
  | "archived";

export interface PerformanceCycle {
  id: string;
  companyId?: string;
  code: string;
  titleAr: string;
  titleEn: string;
  periodType: "annual" | "semi_annual" | "quarterly" | "probation";
  startDate: string;
  endDate: string;
  status: PerformanceCycleStatus;
  ratingScaleMin: number;
  ratingScaleMax: number;
  ratingScaleStep: number;
  goalsWeightPct: number;
  competenciesWeightPct: number;
  allowPeerReviews: boolean;
  peerReviewMinCount: number;
  peerReviewMaxCount: number;
  anonymousPeerReviews: boolean;
  selfReviewDeadline?: string;
  managerReviewDeadline?: string;
  calibrationDeadline?: string;
  isLocked: boolean;
  lockedAt?: string;
  participantsCount: number;
  completionRate: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CycleParticipant {
  id: string;
  companyId: string;
  cycleId: string;
  employeeId: string;
  employeeNo: string;
  employeeNameAr: string;
  employeeNameEn?: string;
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  managerEmployeeId?: string;
  managerName?: string;
  templateId?: string;
  status: "not_started" | "self_in_progress" | "self_submitted" | "manager_in_progress" | "manager_submitted" | "calibrated" | "finalized";
  finalGoalScore?: number;
  finalCompetencyScore?: number;
  finalOverallScore?: number;
  calibratedScore?: number;
  finalRatingLabel?: string;
  nineBoxPerformance?: "low" | "medium" | "high";
  nineBoxPotential?: "low" | "medium" | "high";
  nineBoxCell?: string;
  isLocked: boolean;
  lockedAt?: string;
}

export type PerformanceGoalCategory = "individual" | "departmental" | "strategic" | "operational";
export type PerformanceGoalLevel = "company" | "department" | "team" | "individual";
export type PerformanceGoalStatus = "draft" | "pending_approval" | "active" | "completed" | "cancelled";

export interface GoalProgressHistoryItem {
  id: string;
  goalId: string;
  previousValue: number;
  newValue: number;
  percentage: number;
  note?: string;
  recordedBy: string;
  recordedAt: string;
}

export interface PerformanceGoal {
  id: string;
  companyId: string;
  cycleId: string;
  employeeId: string;
  parentGoalId?: string;
  category: PerformanceGoalCategory;
  level: PerformanceGoalLevel;
  titleAr: string;
  titleEn?: string;
  description?: string;
  metricType: "percentage" | "numeric" | "milestone" | "currency";
  startValue: number;
  targetValue: number;
  currentValue: number;
  weight: number;
  progressPercentage: number;
  status: PerformanceGoalStatus;
  isLocked: boolean;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  progressHistory?: GoalProgressHistoryItem[];
}

export interface CompetencyFramework {
  id: string;
  companyId: string;
  code: string;
  titleAr: string;
  titleEn?: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

export interface Competency {
  id: string;
  companyId: string;
  frameworkId: string;
  category: "core" | "leadership" | "functional" | "behavioral";
  code: string;
  titleAr: string;
  titleEn?: string;
  descriptionAr: string;
  descriptionEn?: string;
  targetProficiencyLevel: number;
  weightPct: number;
  behavioralIndicators?: string[];
  isActive: boolean;
}

export interface ReviewTemplateItem {
  id: string;
  templateId: string;
  itemType: "competency" | "custom_question" | "kpi";
  competencyId?: string;
  customTitleAr?: string;
  customTitleEn?: string;
  weightPct: number;
  displayOrder: number;
}

export interface ReviewTemplate {
  id: string;
  companyId: string;
  frameworkId?: string;
  code: string;
  titleAr: string;
  titleEn?: string;
  targetDepartmentId?: string;
  targetJobTitle?: string;
  goalsWeightPct: number;
  competenciesWeightPct: number;
  include360PeerReview: boolean;
  isActive: boolean;
  items?: ReviewTemplateItem[];
}

export type ReviewType = "self" | "manager" | "peer" | "subordinate";
export type ReviewAssignmentStatus = "assigned" | "in_progress" | "submitted" | "returned" | "locked";

export interface ReviewAssignment {
  id: string;
  companyId: string;
  cycleId: string;
  participantId: string;
  employeeId: string;
  employeeName: string;
  reviewerEmployeeId: string;
  reviewerName: string;
  reviewType: ReviewType;
  isAnonymous: boolean;
  status: ReviewAssignmentStatus;
  dueDate?: string;
  submittedAt?: string;
  review?: PerformanceReview;
}

export interface PerformanceReviewScore {
  id: string;
  reviewId: string;
  itemType: "goal" | "competency" | "custom";
  itemId: string;
  score: number;
  weightPct: number;
  weightedScore: number;
  comment?: string;
}

export interface PerformanceReview {
  id: string;
  assignmentId: string;
  companyId: string;
  cycleId: string;
  employeeId: string;
  reviewerEmployeeId: string;
  reviewType: ReviewType;
  isAnonymous: boolean;
  goalScore?: number;
  competencyScore?: number;
  overallScore: number;
  strengthsSummary?: string;
  growthAreasSummary?: string;
  generalFeedback?: string;
  status: "draft" | "submitted" | "acknowledged";
  submittedAt?: string;
  isLocked: boolean;
  scores?: PerformanceReviewScore[];
}

export interface CalibrationSession {
  id: string;
  companyId: string;
  cycleId: string;
  departmentId?: string;
  departmentName?: string;
  titleAr: string;
  titleEn?: string;
  status: "scheduled" | "in_progress" | "completed" | "approved";
  sessionDate?: string;
  moderatorEmployeeId?: string;
  moderatorName?: string;
  targetDistribution?: Record<string, number>;
  actualDistribution?: Record<string, number>;
  notes?: string;
  adjustments?: CalibrationAdjustment[];
}

export interface CalibrationAdjustment {
  id: string;
  sessionId: string;
  participantId: string;
  employeeId: string;
  employeeName: string;
  originalScore: number;
  originalRatingLabel?: string;
  calibratedScore: number;
  calibratedRatingLabel?: string;
  calibrationReason: string;
  adjustedBy: string;
  adjustedByName?: string;
  adjustedAt: string;
}

export interface PotentialAssessment {
  id: string;
  companyId: string;
  cycleId: string;
  participantId: string;
  employeeId: string;
  employeeName: string;
  assessorEmployeeId: string;
  assessorName: string;
  assessorRole: "manager" | "hr" | "committee";
  potentialLevel: "low" | "medium" | "high";
  performanceLevel: "low" | "medium" | "high";
  nineBoxCell: string;
  learningAgilityScore: number;
  leadershipPotentialScore: number;
  criticalRoleReadiness: "ready_now" | "ready_1_year" | "ready_2_plus_years" | "lateral_only";
  flightRisk: "low" | "medium" | "high";
  retentionPriority: "normal" | "high" | "critical";
  rationale?: string;
}

export interface NineBoxCellInfo {
  cellCode: string; // '1A', '1B', etc.
  titleAr: string;
  titleEn: string;
  potentialLevel: "high" | "medium" | "low";
  performanceLevel: "high" | "medium" | "low";
  count: number;
  percentage: number;
  colorClass: string;
}

export interface DevelopmentPlanItem {
  id: string;
  planId: string;
  competencyId?: string;
  objectiveAr: string;
  actionType: "training" | "mentoring" | "project_assignment" | "self_study" | "certification";
  activityDescription: string;
  successMetric: string;
  targetDate: string;
  status: "planned" | "in_progress" | "completed" | "delayed";
  progressPct: number;
}

export interface DevelopmentPlan {
  id: string;
  companyId: string;
  cycleId?: string;
  employeeId: string;
  employeeName: string;
  titleAr: string;
  status: "draft" | "active" | "completed" | "archived";
  overallProgressPct: number;
  targetCompletionDate?: string;
  items?: DevelopmentPlanItem[];
}

export interface PIP {
  id: string;
  companyId: string;
  cycleId?: string;
  employeeId: string;
  employeeName: string;
  managerEmployeeId: string;
  managerName: string;
  status: "draft" | "active" | "extended" | "successful" | "unsuccessful" | "cancelled";
  startDate: string;
  endDate: string;
  reviewFrequencyDays: number;
  performanceDeficiencies: string;
  expectedOutcomes: string;
  consequencesOfFailure?: string;
  hrNotes?: string;
  outcome?: string;
}

export interface PerformanceKPIs {
  totalParticipants: number;
  activeCyclesCount: number;
  selfReviewCompletionRate: number;
  managerReviewCompletionRate: number;
  peerReviewCompletionRate: number;
  overallCompletionRate: number;
  nineBoxDistribution: Record<string, number>;
  ratingDistribution: Record<string, number>;
  topPerformersCount: number;
  pipCount: number;
  idpCount: number;
}

// ============================================================================
// 2. ERROR HELPER
// ============================================================================

function mapError(error: any, defaultMsg: string): AppMutationError {
  const code = (error as { code?: string })?.code ?? "";
  const msg = error?.message || defaultMsg;
  if (code === "23505" || code === "P0002") {
    return new AppMutationError(msg, "conflict", { details: error });
  }
  if (code === "42501") {
    return new AppMutationError("غير مصرح لك بتنفيذ هذه العملية في دورة التقييم", "authorization", { details: error });
  }
  if (code === "22023" || code === "23514") {
    return new AppMutationError(msg, "validation", { details: error });
  }
  return new AppMutationError(msg, "backend", { details: error });
}

// ============================================================================
// 3. AUTHORITATIVE DATA FETCHING
// ============================================================================

export async function fetchPerformanceCycles(filters?: { status?: string }): Promise<PerformanceCycle[]> {
  let query = db
    .from("performance_cycles")
    .select("*")
    .order("start_date", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.code || `CYC-${row.id.slice(0, 6)}`,
    titleAr: row.title_ar,
    titleEn: row.title_en || row.title_ar,
    periodType: row.period_type,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    ratingScaleMin: Number(row.rating_scale_min ?? 1.0),
    ratingScaleMax: Number(row.rating_scale_max ?? 5.0),
    ratingScaleStep: Number(row.rating_scale_step ?? 0.5),
    goalsWeightPct: Number(row.goals_weight_pct ?? 60),
    competenciesWeightPct: Number(row.competencies_weight_pct ?? 40),
    allowPeerReviews: Boolean(row.allow_peer_reviews ?? true),
    peerReviewMinCount: Number(row.peer_review_min_count ?? 1),
    peerReviewMaxCount: Number(row.peer_review_max_count ?? 3),
    anonymousPeerReviews: Boolean(row.anonymous_peer_reviews ?? true),
    selfReviewDeadline: row.self_review_deadline,
    managerReviewDeadline: row.manager_review_deadline,
    calibrationDeadline: row.calibration_deadline,
    isLocked: Boolean(row.is_locked),
    lockedAt: row.locked_at,
    participantsCount: Number(row.participants_count ?? 0),
    completionRate: Number(row.completion_rate ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function fetchPerformanceCycle(id: string): Promise<PerformanceCycle | null> {
  const { data, error } = await db
    .from("performance_cycles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    code: data.code || `CYC-${data.id.slice(0, 6)}`,
    titleAr: data.title_ar,
    titleEn: data.title_en || data.title_ar,
    periodType: data.period_type,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    ratingScaleMin: Number(data.rating_scale_min ?? 1.0),
    ratingScaleMax: Number(data.rating_scale_max ?? 5.0),
    ratingScaleStep: Number(data.rating_scale_step ?? 0.5),
    goalsWeightPct: Number(data.goals_weight_pct ?? 60),
    competenciesWeightPct: Number(data.competencies_weight_pct ?? 40),
    allowPeerReviews: Boolean(data.allow_peer_reviews ?? true),
    peerReviewMinCount: Number(data.peer_review_min_count ?? 1),
    peerReviewMaxCount: Number(data.peer_review_max_count ?? 3),
    anonymousPeerReviews: Boolean(data.anonymous_peer_reviews ?? true),
    selfReviewDeadline: data.self_review_deadline,
    managerReviewDeadline: data.manager_review_deadline,
    calibrationDeadline: data.calibration_deadline,
    isLocked: Boolean(data.is_locked),
    lockedAt: data.locked_at,
    participantsCount: Number(data.participants_count ?? 0),
    completionRate: Number(data.completion_rate ?? 0),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchCycleParticipants(
  cycleId: string,
  filters?: { departmentId?: string; search?: string }
): Promise<CycleParticipant[]> {
  let query = db
    .from("performance_cycle_participants")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("employee_name_ar", { ascending: true });

  if (filters?.departmentId && filters.departmentId !== "all") {
    query = query.eq("department_id", filters.departmentId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let results = (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    cycleId: row.cycle_id,
    employeeId: row.employee_id,
    employeeNo: row.employee_no || "",
    employeeNameAr: row.employee_name_ar || "موظف",
    employeeNameEn: row.employee_name_en,
    departmentId: row.department_id,
    departmentName: row.department_name,
    jobTitle: row.job_title,
    managerEmployeeId: row.manager_employee_id,
    managerName: row.manager_name,
    templateId: row.template_id,
    status: row.status,
    finalGoalScore: row.final_goal_score != null ? Number(row.final_goal_score) : undefined,
    finalCompetencyScore: row.final_competency_score != null ? Number(row.final_competency_score) : undefined,
    finalOverallScore: row.final_overall_score != null ? Number(row.final_overall_score) : undefined,
    calibratedScore: row.calibrated_score != null ? Number(row.calibrated_score) : undefined,
    finalRatingLabel: row.final_rating_label,
    nineBoxPerformance: row.nine_box_performance,
    nineBoxPotential: row.nine_box_potential,
    nineBoxCell: row.nine_box_cell,
    isLocked: Boolean(row.is_locked),
    lockedAt: row.locked_at,
  }));

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    results = results.filter((p: CycleParticipant) =>
      p.employeeNameAr.toLowerCase().includes(s) ||
      p.employeeNo.toLowerCase().includes(s) ||
      (p.departmentName && p.departmentName.toLowerCase().includes(s))
    );
  }

  return results;
}

export async function fetchPerformanceGoals(filters?: {
  cycleId?: string;
  employeeId?: string;
  category?: string;
}): Promise<PerformanceGoal[]> {
  let query = db
    .from("performance_goals")
    .select(`
      *,
      progress_history:goal_progress_history(*)
    `)
    .order("created_at", { ascending: false });

  if (filters?.cycleId) {
    query = query.eq("cycle_id", filters.cycleId);
  }
  if (filters?.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }
  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    cycleId: row.cycle_id,
    employeeId: row.employee_id,
    parentGoalId: row.parent_goal_id,
    category: row.category,
    level: row.level,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    description: row.description,
    metricType: row.metric_type,
    startValue: Number(row.start_value ?? 0),
    targetValue: Number(row.target_value ?? 100),
    currentValue: Number(row.current_value ?? 0),
    weight: Number(row.weight ?? 0),
    progressPercentage: Number(row.progress_percentage ?? 0),
    status: row.status,
    isLocked: Boolean(row.is_locked),
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    progressHistory: (row.progress_history || []).map((h: any) => ({
      id: h.id,
      goalId: h.goal_id,
      previousValue: Number(h.previous_value),
      newValue: Number(h.new_value),
      percentage: Number(h.percentage),
      note: h.note,
      recordedBy: h.recorded_by,
      recordedAt: h.recorded_at,
    })),
  }));
}

export async function fetchCompetencyFrameworks(): Promise<CompetencyFramework[]> {
  const { data, error } = await db
    .from("competency_frameworks")
    .select("*")
    .eq("is_active", true)
    .order("title_ar", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    version: row.version,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

export async function fetchCompetencies(frameworkId?: string): Promise<Competency[]> {
  let query = db
    .from("competencies")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true });

  if (frameworkId) {
    query = query.eq("framework_id", frameworkId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    frameworkId: row.framework_id,
    category: row.category,
    code: row.code,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    targetProficiencyLevel: Number(row.target_proficiency_level ?? 3),
    weightPct: Number(row.weight_pct ?? 20),
    behavioralIndicators: row.behavioral_indicators ?? [],
    isActive: row.is_active,
  }));
}

export async function fetchReviewTemplates(): Promise<ReviewTemplate[]> {
  const { data, error } = await db
    .from("review_templates")
    .select(`
      *,
      items:review_template_items(*)
    `)
    .eq("is_active", true)
    .order("title_ar", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    frameworkId: row.framework_id,
    code: row.code,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    targetDepartmentId: row.target_department_id,
    targetJobTitle: row.target_job_title,
    goalsWeightPct: Number(row.goals_weight_pct ?? 60),
    competenciesWeightPct: Number(row.competencies_weight_pct ?? 40),
    include360PeerReview: Boolean(row.include_360_peer_review),
    isActive: row.is_active,
    items: (row.items || []).map((item: any) => ({
      id: item.id,
      templateId: item.template_id,
      itemType: item.item_type,
      competencyId: item.competency_id,
      customTitleAr: item.custom_title_ar,
      customTitleEn: item.custom_title_en,
      weightPct: Number(item.weight_pct),
      displayOrder: Number(item.display_order),
    })),
  }));
}

export async function fetchReviewAssignments(filters?: {
  cycleId?: string;
  employeeId?: string;
  reviewerEmployeeId?: string;
  reviewType?: ReviewType;
  status?: string;
}): Promise<ReviewAssignment[]> {
  let query = db
    .from("performance_review_assignments")
    .select(`
      *,
      review:performance_reviews(
        id, assignment_id, overall_score, goal_score, competency_score,
        strengths_summary, growth_areas_summary, general_feedback, status, submitted_at, is_locked
      )
    `)
    .order("created_at", { ascending: false });

  if (filters?.cycleId) query = query.eq("cycle_id", filters.cycleId);
  if (filters?.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters?.reviewerEmployeeId) query = query.eq("reviewer_employee_id", filters.reviewerEmployeeId);
  if (filters?.reviewType) query = query.eq("review_type", filters.reviewType);
  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    cycleId: row.cycle_id,
    participantId: row.participant_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || "موظف",
    reviewerEmployeeId: row.reviewer_employee_id,
    reviewerName: row.is_anonymous ? "مقيّم مجهول الهوية" : (row.reviewer_name || "مقيّم"),
    reviewType: row.review_type,
    isAnonymous: Boolean(row.is_anonymous),
    status: row.status,
    dueDate: row.due_date,
    submittedAt: row.submitted_at,
    review: Array.isArray(row.review) && row.review[0] ? {
      id: row.review[0].id,
      assignmentId: row.review[0].assignment_id,
      companyId: row.company_id,
      cycleId: row.cycle_id,
      employeeId: row.employee_id,
      reviewerEmployeeId: row.reviewer_employee_id,
      reviewType: row.review_type,
      isAnonymous: Boolean(row.is_anonymous),
      goalScore: row.review[0].goal_score != null ? Number(row.review[0].goal_score) : undefined,
      competencyScore: row.review[0].competency_score != null ? Number(row.review[0].competency_score) : undefined,
      overallScore: Number(row.review[0].overall_score ?? 0),
      strengthsSummary: row.review[0].strengths_summary,
      growthAreasSummary: row.review[0].growth_areas_summary,
      generalFeedback: row.review[0].general_feedback,
      status: row.review[0].status,
      submittedAt: row.review[0].submitted_at,
      isLocked: Boolean(row.review[0].is_locked),
    } : undefined,
  }));
}

export async function fetchCalibrationSessions(cycleId?: string): Promise<CalibrationSession[]> {
  let query = db
    .from("calibration_sessions")
    .select(`
      *,
      adjustments:calibration_adjustments(*)
    `)
    .order("created_at", { ascending: false });

  if (cycleId) query = query.eq("cycle_id", cycleId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    cycleId: row.cycle_id,
    departmentId: row.department_id,
    departmentName: row.department_name,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    status: row.status,
    sessionDate: row.session_date,
    moderatorEmployeeId: row.moderator_employee_id,
    moderatorName: row.moderator_name,
    targetDistribution: row.target_distribution,
    actualDistribution: row.actual_distribution,
    notes: row.notes,
    adjustments: (row.adjustments || []).map((adj: any) => ({
      id: adj.id,
      sessionId: adj.session_id,
      participantId: adj.participant_id,
      employeeId: adj.employee_id,
      employeeName: adj.employee_name || "موظف",
      originalScore: Number(adj.original_score),
      originalRatingLabel: adj.original_rating_label,
      calibratedScore: Number(adj.calibrated_score),
      calibratedRatingLabel: adj.calibrated_rating_label,
      calibrationReason: adj.calibration_reason,
      adjustedBy: adj.adjusted_by,
      adjustedByName: adj.adjusted_by_name,
      adjustedAt: adj.adjusted_at,
    })),
  }));
}

export async function fetchPotentialAssessments(cycleId?: string, employeeId?: string): Promise<PotentialAssessment[]> {
  let query = db
    .from("potential_assessments")
    .select("*")
    .order("created_at", { ascending: false });

  if (cycleId) query = query.eq("cycle_id", cycleId);
  if (employeeId) query = query.eq("employee_id", employeeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    cycleId: row.cycle_id,
    participantId: row.participant_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || "موظف",
    assessorEmployeeId: row.assessor_employee_id,
    assessorName: row.assessor_name || "المقيّم",
    assessorRole: row.assessor_role,
    potentialLevel: row.potential_level,
    performanceLevel: row.performance_level,
    nineBoxCell: row.nine_box_cell,
    learningAgilityScore: Number(row.learning_agility_score ?? 3),
    leadershipPotentialScore: Number(row.leadership_potential_score ?? 3),
    criticalRoleReadiness: row.critical_role_readiness,
    flightRisk: row.flight_risk,
    retentionPriority: row.retention_priority,
    rationale: row.rationale,
  }));
}

export async function fetchNineBoxGrid(cycleId?: string, departmentId?: string): Promise<{
  cells: NineBoxCellInfo[];
  totalWorkforce: number;
}> {
  // Try calling server atomic KPI first
  const { data: kpiData, error: kpiError } = await db.rpc("get_performance_kpis_atomic", {
    p_cycle_id: cycleId || null,
  });

  const rawDist: Record<string, number> = (!kpiError && kpiData?.nine_box_distribution) ? kpiData.nine_box_distribution : {};
  const totalEmployees = (!kpiError && kpiData?.total_participants != null) ? Number(kpiData.total_participants) : 0;

  // 9-Box standard definitions with coordinates
  const standardCells: Array<{
    cellCode: string;
    titleAr: string;
    titleEn: string;
    potentialLevel: "high" | "medium" | "low";
    performanceLevel: "high" | "medium" | "low";
    colorClass: string;
  }> = [
    { cellCode: "1A", titleAr: "قادة المستقبل (Superstars)", titleEn: "Future Leaders", potentialLevel: "high", performanceLevel: "high", colorClass: "bg-emerald-500/10 border-emerald-300 text-emerald-800" },
    { cellCode: "1B", titleAr: "نجوم الأداء العالي (High Performers)", titleEn: "High Performers", potentialLevel: "medium", performanceLevel: "high", colorClass: "bg-teal-500/10 border-teal-300 text-teal-800" },
    { cellCode: "1C", titleAr: "خبراء التخصص (Solid Professionals)", titleEn: "Solid Experts", potentialLevel: "low", performanceLevel: "high", colorClass: "bg-blue-500/10 border-blue-300 text-blue-800" },
    { cellCode: "2A", titleAr: "كفاءات واعدة (High Potentials)", titleEn: "High Potential", potentialLevel: "high", performanceLevel: "medium", colorClass: "bg-indigo-500/10 border-indigo-300 text-indigo-800" },
    { cellCode: "2B", titleAr: "العمود الفقري الأساسي (Core Players)", titleEn: "Core Players", potentialLevel: "medium", performanceLevel: "medium", colorClass: "bg-primary/10 border-primary/30 text-primary" },
    { cellCode: "2C", titleAr: "أداء مستقر وفعال (Effective Staff)", titleEn: "Effective Staff", potentialLevel: "low", performanceLevel: "medium", colorClass: "bg-amber-500/10 border-amber-300 text-amber-800" },
    { cellCode: "3A", titleAr: "لغز محير يحتاج توجيه (Enigmas)", titleEn: "Enigmas", potentialLevel: "high", performanceLevel: "low", colorClass: "bg-purple-500/10 border-purple-300 text-purple-800" },
    { cellCode: "3B", titleAr: "يحتاج تدريب وتطوير (Dilemmas)", titleEn: "Dilemmas", potentialLevel: "medium", performanceLevel: "low", colorClass: "bg-orange-500/10 border-orange-300 text-orange-800" },
    { cellCode: "3C", titleAr: "خطة تصحيح الأداء (Action Plan / Risk)", titleEn: "Risk / Action Plan", potentialLevel: "low", performanceLevel: "low", colorClass: "bg-destructive/10 border-destructive/30 text-destructive" },
  ];

  const cells: NineBoxCellInfo[] = standardCells.map((sc) => {
    const count = Number(rawDist[sc.cellCode] || 0);
    const percentage = totalEmployees > 0 ? Number(((count / totalEmployees) * 100).toFixed(1)) : 0;
    return {
      ...sc,
      count,
      percentage,
    };
  });

  return { cells, totalWorkforce: totalEmployees };
}

export async function fetchDevelopmentPlans(filters?: {
  employeeId?: string;
  status?: string;
}): Promise<DevelopmentPlan[]> {
  let query = db
    .from("development_plans")
    .select(`
      *,
      items:development_plan_items(*)
    `)
    .order("created_at", { ascending: false });

  if (filters?.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    cycleId: row.cycle_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || "موظف",
    titleAr: row.title_ar,
    status: row.status,
    overallProgressPct: Number(row.overall_progress_pct ?? 0),
    targetCompletionDate: row.target_completion_date,
    items: (row.items || []).map((item: any) => ({
      id: item.id,
      planId: item.plan_id,
      competencyId: item.competency_id,
      objectiveAr: item.objective_ar,
      actionType: item.action_type,
      activityDescription: item.activity_description,
      successMetric: item.success_metric,
      targetDate: item.target_date,
      status: item.status,
      progressPct: Number(item.progress_pct ?? 0),
    })),
  }));
}

export async function fetchPIPs(filters?: {
  employeeId?: string;
  status?: string;
}): Promise<PIP[]> {
  let query = db
    .from("performance_improvement_plans")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    cycleId: row.cycle_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || "موظف",
    managerEmployeeId: row.manager_employee_id,
    managerName: row.manager_name || "المدير المباشر",
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    reviewFrequencyDays: Number(row.review_frequency_days ?? 14),
    performanceDeficiencies: row.performance_deficiencies,
    expectedOutcomes: row.expected_outcomes,
    consequencesOfFailure: row.consequences_of_failure,
    hrNotes: row.hr_notes,
    outcome: row.outcome,
  }));
}

export async function fetchPerformanceKPIs(cycleId?: string): Promise<PerformanceKPIs> {
  const { data, error } = await db.rpc("get_performance_kpis_atomic", {
    p_cycle_id: cycleId || null,
  });

  if (error) throw new Error(error.message);

  return {
    totalParticipants: Number(data?.total_participants ?? 0),
    activeCyclesCount: Number(data?.active_cycles_count ?? 0),
    selfReviewCompletionRate: Number(data?.self_review_completion_rate ?? 0),
    managerReviewCompletionRate: Number(data?.manager_review_completion_rate ?? 0),
    peerReviewCompletionRate: Number(data?.peer_review_completion_rate ?? 0),
    overallCompletionRate: Number(data?.overall_completion_rate ?? 0),
    nineBoxDistribution: data?.nine_box_distribution || {},
    ratingDistribution: data?.rating_distribution || {},
    topPerformersCount: Number(data?.top_performers_count ?? 0),
    pipCount: Number(data?.pip_count ?? 0),
    idpCount: Number(data?.idp_count ?? 0),
  };
}

// ============================================================================
// 4. ATOMIC MUTATION RPCS
// ============================================================================

export async function createPerformanceCycleRecord(payload: {
  titleAr: string;
  titleEn?: string;
  periodType: PerformanceCycle["periodType"];
  startDate: string;
  endDate: string;
  ratingScaleMin?: number;
  ratingScaleMax?: number;
  ratingScaleStep?: number;
  goalsWeightPct?: number;
  competenciesWeightPct?: number;
  allowPeerReviews?: boolean;
  peerReviewMinCount?: number;
  peerReviewMaxCount?: number;
  anonymousPeerReviews?: boolean;
}): Promise<string> {
  const { data, error } = await db
    .from("performance_cycles")
    .insert({
      title_ar: payload.titleAr,
      title_en: payload.titleEn || payload.titleAr,
      period_type: payload.periodType,
      start_date: payload.startDate,
      end_date: payload.endDate,
      status: "draft",
      rating_scale_min: payload.ratingScaleMin ?? 1.0,
      rating_scale_max: payload.ratingScaleMax ?? 5.0,
      rating_scale_step: payload.ratingScaleStep ?? 0.5,
      goals_weight_pct: payload.goalsWeightPct ?? 60,
      competencies_weight_pct: payload.competenciesWeightPct ?? 40,
      allow_peer_reviews: payload.allowPeerReviews ?? true,
      peer_review_min_count: payload.peerReviewMinCount ?? 1,
      peer_review_max_count: payload.peerReviewMaxCount ?? 3,
      anonymous_peer_reviews: payload.anonymousPeerReviews ?? true,
    })
    .select("id")
    .single();

  if (error) throw mapError(error, "تعذر إنشاء دورة التقييم");
  return data.id;
}

export async function launchPerformanceCycleAtomic(
  cycleId: string,
  targetDepartmentIds?: string[]
): Promise<{ success: boolean; participantsEnrolled: number; assignmentsGenerated: number }> {
  const { data, error } = await db.rpc("launch_performance_cycle_atomic", {
    p_cycle_id: cycleId,
    p_target_department_ids: targetDepartmentIds && targetDepartmentIds.length > 0 ? targetDepartmentIds : null,
  });

  if (error) throw mapError(error, "تعذر إطلاق دورة التقييم");
  if (!data?.success) throw new AppMutationError(data?.error || "فشل إطلاق دورة التقييم", "backend");

  return {
    success: true,
    participantsEnrolled: Number(data.participants_enrolled ?? 0),
    assignmentsGenerated: Number(data.assignments_generated ?? 0),
  };
}

export async function assignPeerReviewersAtomic(
  cycleId: string,
  targetEmployeeId: string,
  peerEmployeeIds: string[],
  isAnonymous = true
): Promise<{ success: boolean; assignmentsCount: number }> {
  const { data, error } = await db.rpc("assign_peer_reviewers_atomic", {
    p_cycle_id: cycleId,
    p_target_employee_id: targetEmployeeId,
    p_peer_employee_ids: peerEmployeeIds,
    p_is_anonymous: isAnonymous,
  });

  if (error) throw mapError(error, "تعذر تعيين مقيّمي الزملاء");
  if (!data?.success) throw new AppMutationError(data?.error || "تعذر تعيين مقيّمي الزملاء", "backend");

  return {
    success: true,
    assignmentsCount: Number(data.assignments_count ?? 0),
  };
}

export async function submitPerformanceGoalAtomic(goal: {
  cycleId: string;
  employeeId: string;
  parentGoalId?: string;
  category: PerformanceGoalCategory;
  level: PerformanceGoalLevel;
  titleAr: string;
  titleEn?: string;
  description?: string;
  metricType?: string;
  startValue?: number;
  targetValue?: number;
  weight: number;
}): Promise<string> {
  const { data, error } = await db.rpc("submit_performance_goal_atomic", {
    p_cycle_id: goal.cycleId,
    p_employee_id: goal.employeeId,
    p_parent_goal_id: goal.parentGoalId || null,
    p_category: goal.category,
    p_level: goal.level,
    p_title_ar: goal.titleAr,
    p_title_en: goal.titleEn || null,
    p_description: goal.description || null,
    p_metric_type: goal.metricType || "percentage",
    p_start_value: goal.startValue ?? 0,
    p_target_value: goal.targetValue ?? 100,
    p_weight: goal.weight,
  });

  if (error) throw mapError(error, "تعذر حفظ الهدف الذكي");
  if (!data?.success) throw new AppMutationError(data?.error || "فشل حفظ الهدف", "backend");

  return data.goal_id;
}

export async function updateGoalProgressAtomic(
  goalId: string,
  newValue: number,
  percentage: number,
  note?: string
): Promise<{ success: boolean; newPercentage: number }> {
  const { data, error } = await db.rpc("update_goal_progress_atomic", {
    p_goal_id: goalId,
    p_new_value: newValue,
    p_percentage: percentage,
    p_note: note || null,
  });

  if (error) throw mapError(error, "تعذر تحديث تقدم الهدف");
  if (!data?.success) throw new AppMutationError(data?.error || "تعذر تحديث تقدم الهدف", "backend");

  return {
    success: true,
    newPercentage: Number(data.new_percentage ?? 0),
  };
}

export async function submitPerformanceReviewAtomic(review: {
  assignmentId: string;
  scores: Array<{
    item_type: "goal" | "competency" | "custom";
    item_id: string;
    score: number;
    weight_pct: number;
    comment?: string;
  }>;
  strengthsSummary?: string;
  growthAreasSummary?: string;
  generalFeedback?: string;
}): Promise<{
  success: boolean;
  reviewId: string;
  overallScore: number;
  goalScore: number;
  competencyScore: number;
}> {
  const { data, error } = await db.rpc("submit_performance_review_atomic", {
    p_assignment_id: review.assignmentId,
    p_scores: review.scores,
    p_strengths_summary: review.strengthsSummary || null,
    p_growth_areas_summary: review.growthAreasSummary || null,
    p_general_feedback: review.generalFeedback || null,
  });

  if (error) throw mapError(error, "تعذر اعتماد تقييم الأداء");
  if (!data?.success) throw new AppMutationError(data?.error || "فشل اعتماد التقييم", "backend");

  return {
    success: true,
    reviewId: data.review_id,
    overallScore: Number(data.overall_score ?? 0),
    goalScore: Number(data.goal_score ?? 0),
    competencyScore: Number(data.competency_score ?? 0),
  };
}

export async function adjustCalibrationAtomic(adjustment: {
  sessionId: string;
  participantId: string;
  calibratedScore: number;
  calibratedRatingLabel: string;
  calibrationReason: string;
}): Promise<{ success: boolean; adjustmentId: string }> {
  const { data, error } = await db.rpc("adjust_calibration_atomic", {
    p_session_id: adjustment.sessionId,
    p_participant_id: adjustment.participantId,
    p_calibrated_score: adjustment.calibratedScore,
    p_calibrated_rating_label: adjustment.calibratedRatingLabel,
    p_calibration_reason: adjustment.calibrationReason,
  });

  if (error) throw mapError(error, "تعذر توثيق معايرة وموازنة النتيجة");
  if (!data?.success) throw new AppMutationError(data?.error || "فشل توثيق المعايرة", "backend");

  return {
    success: true,
    adjustmentId: data.adjustment_id,
  };
}

export async function assessPotentialAtomic(assessment: {
  cycleId: string;
  participantId: string;
  potentialLevel: "low" | "medium" | "high";
  learningAgilityScore?: number;
  leadershipPotentialScore?: number;
  criticalRoleReadiness?: string;
  flightRisk?: string;
  retentionPriority?: string;
  rationale?: string;
}): Promise<{ success: boolean; assessmentId: string; nineBoxCell: string }> {
  const { data, error } = await db.rpc("assess_potential_atomic", {
    p_cycle_id: assessment.cycleId,
    p_participant_id: assessment.participantId,
    p_potential_level: assessment.potentialLevel,
    p_learning_agility_score: assessment.learningAgilityScore ?? 3,
    p_leadership_potential_score: assessment.leadershipPotentialScore ?? 3,
    p_critical_role_readiness: assessment.criticalRoleReadiness || "ready_1_year",
    p_flight_risk: assessment.flightRisk || "low",
    p_retention_priority: assessment.retentionPriority || "normal",
    p_rationale: assessment.rationale || null,
  });

  if (error) throw mapError(error, "تعذر تقييم الإمكانات والمواهب");
  if (!data?.success) throw new AppMutationError(data?.error || "فشل تقييم الإمكانات", "backend");

  return {
    success: true,
    assessmentId: data.assessment_id,
    nineBoxCell: data.nine_box_cell,
  };
}

export async function finalizePerformanceCycleAtomic(
  cycleId: string
): Promise<{ success: boolean; finalizedCount: number; message: string }> {
  const { data, error } = await db.rpc("finalize_performance_cycle_atomic", {
    p_cycle_id: cycleId,
  });

  if (error) throw mapError(error, "تعذر إنهاء وإقفال دورة التقييم نهائياً");
  if (!data?.success) throw new AppMutationError(data?.error || "تعذر إقفال الدورة", "backend");

  return {
    success: true,
    finalizedCount: Number(data.finalized_count ?? 0),
    message: data.message || "تم اعتماد وإقفال دورة التقييم بنجاح",
  };
}

export async function saveDevelopmentPlanRecord(plan: {
  cycleId?: string;
  employeeId: string;
  titleAr: string;
  targetCompletionDate?: string;
  items: Array<{
    competencyId?: string;
    objectiveAr: string;
    actionType: "training" | "mentoring" | "project_assignment" | "self_study" | "certification";
    activityDescription: string;
    successMetric: string;
    targetDate: string;
  }>;
}): Promise<string> {
  const { data, error } = await db
    .from("development_plans")
    .insert({
      cycle_id: plan.cycleId || null,
      employee_id: plan.employeeId,
      title_ar: plan.titleAr,
      status: "active",
      overall_progress_pct: 0,
      target_completion_date: plan.targetCompletionDate || null,
    })
    .select("id")
    .single();

  if (error) throw mapError(error, "تعذر إنشاء خطة التطوير الفردية");
  const planId = data.id;

  if (plan.items && plan.items.length > 0) {
    const { error: itemsError } = await db.from("development_plan_items").insert(
      plan.items.map((item) => ({
        plan_id: planId,
        competency_id: item.competencyId || null,
        objective_ar: item.objectiveAr,
        action_type: item.actionType,
        activity_description: item.activityDescription,
        success_metric: item.successMetric,
        target_date: item.targetDate,
        status: "planned",
        progress_pct: 0,
      }))
    );
    if (itemsError) throw mapError(itemsError, "تعذر حفظ بنود خطة التطوير");
  }

  return planId;
}

export async function createPIPRecord(pip: {
  cycleId?: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reviewFrequencyDays?: number;
  performanceDeficiencies: string;
  expectedOutcomes: string;
  consequencesOfFailure?: string;
  hrNotes?: string;
}): Promise<string> {
  const { data, error } = await db
    .from("performance_improvement_plans")
    .insert({
      cycle_id: pip.cycleId || null,
      employee_id: pip.employeeId,
      start_date: pip.startDate,
      end_date: pip.endDate,
      review_frequency_days: pip.reviewFrequencyDays ?? 14,
      performance_deficiencies: pip.performanceDeficiencies,
      expected_outcomes: pip.expectedOutcomes,
      consequences_of_failure: pip.consequencesOfFailure || null,
      hr_notes: pip.hrNotes || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw mapError(error, "تعذر إنشاء خطة تحسين الأداء (PIP)");
  return data.id;
}

// ============================================================================
// 5. TANSTACK QUERY HOOKS
// ============================================================================

export function usePerformanceCycles(filters?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.performance.cycles(filters),
    queryFn: () => fetchPerformanceCycles(filters),
  });
}

export function usePerformanceCycle(id: string) {
  return useQuery({
    queryKey: queryKeys.performance.cycle(id),
    queryFn: () => fetchPerformanceCycle(id),
    enabled: Boolean(id),
  });
}

export function useCycleParticipants(cycleId: string, filters?: { departmentId?: string; search?: string }) {
  return useQuery({
    queryKey: queryKeys.performance.participants(cycleId, filters),
    queryFn: () => fetchCycleParticipants(cycleId, filters),
    enabled: Boolean(cycleId),
  });
}

export function usePerformanceGoals(filters?: { cycleId?: string; employeeId?: string; category?: string }) {
  return useQuery({
    queryKey: queryKeys.performance.goals(filters),
    queryFn: () => fetchPerformanceGoals(filters),
  });
}

export function useCompetencyFrameworks() {
  return useQuery({
    queryKey: queryKeys.performance.frameworks(),
    queryFn: () => fetchCompetencyFrameworks(),
  });
}

export function useCompetencies(frameworkId?: string) {
  return useQuery({
    queryKey: queryKeys.performance.competencies(frameworkId),
    queryFn: () => fetchCompetencies(frameworkId),
  });
}

export function useReviewTemplates() {
  return useQuery({
    queryKey: queryKeys.performance.templates(),
    queryFn: () => fetchReviewTemplates(),
  });
}

export function useReviewAssignments(filters?: {
  cycleId?: string;
  employeeId?: string;
  reviewerEmployeeId?: string;
  reviewType?: ReviewType;
  status?: string;
}) {
  return useQuery({
    queryKey: queryKeys.performance.assignments(filters),
    queryFn: () => fetchReviewAssignments(filters),
  });
}

export function useMyReviews(cycleId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.performance.myReviews(cycleId),
    queryFn: () => fetchReviewAssignments({ cycleId, reviewerEmployeeId: session?.user?.id }),
    enabled: Boolean(session?.user?.id),
  });
}

export function useTeamReviews(cycleId?: string) {
  return useQuery({
    queryKey: queryKeys.performance.teamReviews(cycleId),
    queryFn: () => fetchReviewAssignments({ cycleId, reviewType: "manager" }),
  });
}

export function useCalibrationSessions(cycleId?: string) {
  return useQuery({
    queryKey: queryKeys.performance.calibrationSessions(cycleId),
    queryFn: () => fetchCalibrationSessions(cycleId),
  });
}

export function useNineBoxData(cycleId?: string, departmentId?: string) {
  return useQuery({
    queryKey: queryKeys.performance.nineBox(cycleId || "current", departmentId),
    queryFn: () => fetchNineBoxGrid(cycleId, departmentId),
  });
}

export function usePotentialAssessments(cycleId?: string, employeeId?: string) {
  return useQuery({
    queryKey: queryKeys.performance.potential({ cycleId, employeeId }),
    queryFn: () => fetchPotentialAssessments(cycleId, employeeId),
  });
}

export function useDevelopmentPlans(filters?: { employeeId?: string; status?: string }) {
  return useQuery({
    queryKey: queryKeys.performance.developmentPlans(filters),
    queryFn: () => fetchDevelopmentPlans(filters),
  });
}

export function usePIPs(filters?: { employeeId?: string; status?: string }) {
  return useQuery({
    queryKey: queryKeys.performance.pip(filters),
    queryFn: () => fetchPIPs(filters),
  });
}

export function usePerformanceKPIs(cycleId?: string) {
  return useQuery({
    queryKey: queryKeys.performance.kpis(cycleId),
    queryFn: () => fetchPerformanceKPIs(cycleId),
  });
}

// ============================================================================
// 6. MUTATIONS HOOK
// ============================================================================

export function usePerformanceRepositoryMutations() {
  const queryClient = useQueryClient();

  const invalidatePerformance = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
  }, [queryClient]);

  const createCycle = useMutation({
    mutationFn: createPerformanceCycleRecord,
    onSuccess: invalidatePerformance,
  });

  const launchCycle = useMutation({
    mutationFn: ({ cycleId, targetDepartmentIds }: { cycleId: string; targetDepartmentIds?: string[] }) =>
      launchPerformanceCycleAtomic(cycleId, targetDepartmentIds),
    onSuccess: invalidatePerformance,
  });

  const assignPeerReviewers = useMutation({
    mutationFn: ({
      cycleId,
      targetEmployeeId,
      peerEmployeeIds,
      isAnonymous,
    }: {
      cycleId: string;
      targetEmployeeId: string;
      peerEmployeeIds: string[];
      isAnonymous?: boolean;
    }) => assignPeerReviewersAtomic(cycleId, targetEmployeeId, peerEmployeeIds, isAnonymous),
    onSuccess: invalidatePerformance,
  });

  const submitGoal = useMutation({
    mutationFn: submitPerformanceGoalAtomic,
    onSuccess: invalidatePerformance,
  });

  const updateGoalProgress = useMutation({
    mutationFn: ({
      goalId,
      newValue,
      percentage,
      note,
    }: {
      goalId: string;
      newValue: number;
      percentage: number;
      note?: string;
    }) => updateGoalProgressAtomic(goalId, newValue, percentage, note),
    onSuccess: invalidatePerformance,
  });

  const submitReview = useMutation({
    mutationFn: submitPerformanceReviewAtomic,
    onSuccess: invalidatePerformance,
  });

  const adjustCalibration = useMutation({
    mutationFn: adjustCalibrationAtomic,
    onSuccess: invalidatePerformance,
  });

  const assessPotential = useMutation({
    mutationFn: assessPotentialAtomic,
    onSuccess: invalidatePerformance,
  });

  const finalizeCycle = useMutation({
    mutationFn: finalizePerformanceCycleAtomic,
    onSuccess: invalidatePerformance,
  });

  const saveDevelopmentPlan = useMutation({
    mutationFn: saveDevelopmentPlanRecord,
    onSuccess: invalidatePerformance,
  });

  const createPIP = useMutation({
    mutationFn: createPIPRecord,
    onSuccess: invalidatePerformance,
  });

  return {
    createCycle,
    launchCycle,
    assignPeerReviewers,
    submitGoal,
    updateGoalProgress,
    submitReview,
    adjustCalibration,
    assessPotential,
    finalizeCycle,
    saveDevelopmentPlan,
    createPIP,
  };
}
