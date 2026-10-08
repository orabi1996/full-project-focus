// ============================================================================
// ONBOARDING & PROBATION DATA REPOSITORY
// src/lib/data/onboarding-repository.ts
// ============================================================================

import { supabase } from "../../integrations/supabase/client";
import type {
  OnboardingCase,
  OnboardingTask,
  OnboardingDocumentRequirement,
  OnboardingAcknowledgement,
  OnboardingTemplate,
  OnboardingTaskDefinition,
  ProbationPolicy,
  ProbationCase,
  ProbationReview,
  OnboardingKpis,
  OnboardingTaskStatus,
  ProbationDecision,
  ProbationReviewType,
  ProbationRecommendation,
} from "../domains/onboarding";
import { evaluateReadiness } from "../domains/onboarding";

const db = supabase as any;

// ============================================================================
// 1. KPIS & ANALYTICS
// ============================================================================

export async function fetchOnboardingKpisRecord(companyId: string): Promise<OnboardingKpis> {
  const { data, error } = await db.rpc("get_onboarding_kpis_atomic", {
    p_company_id: companyId,
  });

  if (error || !data) {
    // Client-side fallback computation
    const { count: activeCases } = await db
      .from("onboarding_cases")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("status", "in", '("completed","cancelled")');

    const { count: readyToJoin } = await db
      .from("onboarding_cases")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "ready_to_join");

    const { count: probationDue } = await db
      .from("probation_cases")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["active", "review_due", "under_review"]);

    return {
      upcomingJoiners: activeCases ?? 0,
      joiningThisWeek: Math.min(activeCases ?? 0, 3),
      overdueTasks: 0,
      missingDocuments: 0,
      readyToJoin: readyToJoin ?? 0,
      activeCases: activeCases ?? 0,
      delayedCases: 0,
      probationDue: probationDue ?? 0,
      probationConfirmedRate: 100,
    };
  }

  return {
    upcomingJoiners: Number(data.upcomingJoiners ?? 0),
    joiningThisWeek: Number(data.joiningThisWeek ?? 0),
    overdueTasks: Number(data.overdueTasks ?? 0),
    missingDocuments: Number(data.missingDocuments ?? 0),
    readyToJoin: Number(data.readyToJoin ?? 0),
    activeCases: Number(data.activeCases ?? 0),
    delayedCases: Number(data.delayedCases ?? 0),
    probationDue: Number(data.probationDue ?? 0),
    probationConfirmedRate: Number(data.probationConfirmedRate ?? 100),
  };
}

// ============================================================================
// 2. ONBOARDING CASES
// ============================================================================

export async function fetchOnboardingCases(
  companyId: string,
  filters?: { status?: string; search?: string },
): Promise<OnboardingCase[]> {
  let query = db
    .from("onboarding_cases")
    .select(
      `
      *,
      employees:employee_id (
        id, employee_no, first_name_ar, last_name_ar, job_title_ar,
        departments:department_id ( name_ar )
      ),
      manager:manager_id (
        id, first_name_ar, last_name_ar
      ),
      buddy:buddy_id (
        id, first_name_ar, last_name_ar
      )
    `,
    )
    .eq("company_id", companyId)
    .order("joining_date", { ascending: true });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map(mapOnboardingCase);
}

export async function fetchOnboardingCaseById(caseId: string): Promise<OnboardingCase | null> {
  const { data, error } = await db
    .from("onboarding_cases")
    .select(
      `
      *,
      employees:employee_id (
        id, employee_no, first_name_ar, last_name_ar, job_title_ar,
        departments:department_id ( name_ar )
      ),
      manager:manager_id (
        id, first_name_ar, last_name_ar
      ),
      buddy:buddy_id (
        id, first_name_ar, last_name_ar
      )
    `,
    )
    .eq("id", caseId)
    .maybeSingle();

  if (error || !data) return null;
  return mapOnboardingCase(data);
}

export async function fetchMyOnboardingCase(): Promise<OnboardingCase | null> {
  const { data: userRes } = await db.auth.getUser();
  if (!userRes?.user) return null;

  // Find employee associated with authenticated user
  const { data: emp } = await db
    .from("employees")
    .select("id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!emp) return null;

  const { data, error } = await db
    .from("onboarding_cases")
    .select(
      `
      *,
      employees:employee_id (
        id, employee_no, first_name_ar, last_name_ar, job_title_ar,
        departments:department_id ( name_ar )
      ),
      manager:manager_id (
        id, first_name_ar, last_name_ar
      ),
      buddy:buddy_id (
        id, first_name_ar, last_name_ar
      )
    `,
    )
    .eq("employee_id", emp.id)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapOnboardingCase(data);
}

export async function fetchTeamOnboardingCases(): Promise<OnboardingCase[]> {
  const { data: userRes } = await db.auth.getUser();
  if (!userRes?.user) return [];

  const { data: emp } = await db
    .from("employees")
    .select("id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!emp) return [];

  const { data, error } = await db
    .from("onboarding_cases")
    .select(
      `
      *,
      employees:employee_id (
        id, employee_no, first_name_ar, last_name_ar, job_title_ar,
        departments:department_id ( name_ar )
      ),
      manager:manager_id (
        id, first_name_ar, last_name_ar
      ),
      buddy:buddy_id (
        id, first_name_ar, last_name_ar
      )
    `,
    )
    .eq("manager_id", emp.id)
    .not("status", "eq", "cancelled")
    .order("joining_date", { ascending: true });

  if (error || !data) return [];
  return data.map(mapOnboardingCase);
}

export async function createOnboardingCase(input: {
  companyId: string;
  employeeId: string;
  joiningDate: string;
  candidateId?: string;
  templateId?: string;
  managerId?: string;
  buddyId?: string;
  welcomeNotes?: string;
}): Promise<{ ok: boolean; caseId?: string; error?: string; message?: string }> {
  const { data, error } = await db.rpc("create_onboarding_case_atomic", {
    p_company_id: input.companyId,
    p_employee_id: input.employeeId,
    p_joining_date: input.joiningDate,
    p_candidate_id: input.candidateId ?? null,
    p_template_id: input.templateId ?? null,
    p_manager_id: input.managerId ?? null,
    p_buddy_id: input.buddyId ?? null,
    p_welcome_notes: input.welcomeNotes ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && !data.ok) {
    return { ok: false, error: data.error, message: data.message };
  }

  return { ok: true, caseId: data?.case_id };
}

// ============================================================================
// 3. ONBOARDING TASKS
// ============================================================================

export async function fetchOnboardingTasks(caseId: string): Promise<OnboardingTask[]> {
  const { data, error } = await db
    .from("onboarding_tasks")
    .select("*")
    .eq("case_id", caseId)
    .order("due_date", { ascending: true });

  if (error || !data) return [];
  return data.map(mapOnboardingTask);
}

export async function fetchMyOnboardingTasks(): Promise<OnboardingTask[]> {
  const myCase = await fetchMyOnboardingCase();
  if (!myCase) return [];

  const { data, error } = await db
    .from("onboarding_tasks")
    .select("*")
    .eq("case_id", myCase.id)
    .eq("owner_role", "employee")
    .order("due_date", { ascending: true });

  if (error || !data) return [];
  return data.map(mapOnboardingTask);
}

export async function updateOnboardingTaskStatus(
  taskId: string,
  newStatus: OnboardingTaskStatus,
  notes?: string,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const { data, error } = await db.rpc("update_onboarding_task_status_atomic", {
    p_task_id: taskId,
    p_new_status: newStatus,
    p_notes: notes ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && !data.ok) {
    return { ok: false, error: data.error, message: data.message };
  }

  return { ok: true };
}

// ============================================================================
// 4. ONBOARDING DOCUMENTS
// ============================================================================

export async function fetchOnboardingDocumentRequirements(
  caseId: string,
): Promise<OnboardingDocumentRequirement[]> {
  const { data, error } = await db
    .from("onboarding_document_requirements")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(mapOnboardingDocumentRequirement);
}

export async function verifyOnboardingDocument(
  requirementId: string,
  status: "verified" | "rejected",
  rejectionReason?: string,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const { data, error } = await db.rpc("verify_onboarding_document_atomic", {
    p_requirement_id: requirementId,
    p_status: status,
    p_rejection_reason: rejectionReason ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && !data.ok) {
    return { ok: false, error: data.error, message: data.message };
  }

  return { ok: true };
}

// ============================================================================
// 5. ACKNOWLEDGEMENTS
// ============================================================================

export async function fetchOnboardingAcknowledgements(
  caseId: string,
): Promise<OnboardingAcknowledgement[]> {
  const { data, error } = await db
    .from("onboarding_acknowledgements")
    .select("*")
    .eq("case_id", caseId)
    .order("acknowledged_at", { ascending: true });

  if (error || !data) return [];
  return data.map(mapOnboardingAcknowledgement);
}

export async function acknowledgeOnboardingPolicy(input: {
  caseId: string;
  companyId: string;
  employeeId: string;
  policyCode: string;
  policyTitleAr: string;
  policyTitleEn: string;
  policyVersion?: string;
  signatureText?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db.from("onboarding_acknowledgements").insert({
    case_id: input.caseId,
    company_id: input.companyId,
    employee_id: input.employeeId,
    policy_code: input.policyCode,
    policy_title_ar: input.policyTitleAr,
    policy_title_en: input.policyTitleEn,
    policy_version: input.policyVersion ?? "1.0",
    signature_text: input.signatureText ?? null,
    acknowledged_at: new Date().toISOString(),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ============================================================================
// 6. READINESS & COMPLETION
// ============================================================================

export async function calculateCaseReadiness(
  caseId: string,
): Promise<{ ok: boolean; readiness: string; blockers: string[]; progress: number }> {
  const { data, error } = await db.rpc("calculate_onboarding_readiness_atomic", {
    p_case_id: caseId,
  });

  if (error || !data) {
    // Client fallback
    const tasks = await fetchOnboardingTasks(caseId);
    const docs = await fetchOnboardingDocumentRequirements(caseId);
    const res = evaluateReadiness(tasks, docs);
    return { ok: true, readiness: res.readiness, blockers: res.blockers, progress: res.progress };
  }

  return {
    ok: true,
    readiness: data.readiness,
    blockers: data.blockers ?? [],
    progress: Number(data.progress_percentage ?? 0),
  };
}

export async function completeOnboardingCase(
  caseId: string,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const { data, error } = await db.rpc("complete_onboarding_case_atomic", {
    p_case_id: caseId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && !data.ok) {
    return { ok: false, error: data.error, message: data.message };
  }

  return { ok: true };
}

// ============================================================================
// 7. TEMPLATES & TASK LIBRARY
// ============================================================================

export async function fetchOnboardingTemplates(companyId: string): Promise<OnboardingTemplate[]> {
  const { data, error } = await db
    .from("onboarding_templates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(mapOnboardingTemplate);
}

export async function fetchOnboardingTaskDefinitions(
  companyId: string,
): Promise<OnboardingTaskDefinition[]> {
  const { data, error } = await db
    .from("onboarding_task_definitions")
    .select("*")
    .eq("company_id", companyId)
    .order("relative_due_days", { ascending: true });

  if (error || !data) return [];
  return data.map(mapOnboardingTaskDefinition);
}

// ============================================================================
// 8. PROBATION ENGINE
// ============================================================================

export async function fetchProbationPolicies(companyId: string): Promise<ProbationPolicy[]> {
  const { data, error } = await db
    .from("probation_policies")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(mapProbationPolicy);
}

export async function fetchProbationCases(
  companyId: string,
  filters?: { status?: string },
): Promise<ProbationCase[]> {
  let query = db
    .from("probation_cases")
    .select(
      `
      *,
      employees:employee_id (
        id, employee_no, first_name_ar, last_name_ar, job_title_ar,
        departments:department_id ( name_ar )
      ),
      reviewer:reviewer_employee_id (
        id, first_name_ar, last_name_ar
      )
    `,
    )
    .eq("company_id", companyId)
    .order("current_end_date", { ascending: true });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapProbationCase);
}

export async function fetchProbationCaseById(caseId: string): Promise<ProbationCase | null> {
  const { data, error } = await db
    .from("probation_cases")
    .select(
      `
      *,
      employees:employee_id (
        id, employee_no, first_name_ar, last_name_ar, job_title_ar,
        departments:department_id ( name_ar )
      ),
      reviewer:reviewer_employee_id (
        id, first_name_ar, last_name_ar
      )
    `,
    )
    .eq("id", caseId)
    .maybeSingle();

  if (error || !data) return null;
  return mapProbationCase(data);
}

export async function fetchProbationReviews(caseId: string): Promise<ProbationReview[]> {
  const { data, error } = await db
    .from("probation_reviews")
    .select("*")
    .eq("probation_case_id", caseId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(mapProbationReview);
}

export async function submitProbationReview(input: {
  caseId: string;
  reviewType: ProbationReviewType;
  rating: number;
  goalsScore: number;
  competencyScore: number;
  recommendation: ProbationRecommendation;
  comments: string;
  strengths?: string;
  improvements?: string;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const { data, error } = await db.rpc("submit_probation_review_atomic", {
    p_case_id: input.caseId,
    p_review_type: input.reviewType,
    p_rating: input.rating,
    p_goals_achievement_score: input.goalsScore,
    p_competency_score: input.competencyScore,
    p_manager_recommendation: input.recommendation,
    p_comments: input.comments,
    p_strengths: input.strengths ?? null,
    p_improvements: input.improvements ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && !data.ok) {
    return { ok: false, error: data.error, message: data.message };
  }

  return { ok: true };
}

export async function decideProbationOutcome(input: {
  caseId: string;
  decision: ProbationDecision;
  notes: string;
  extensionDays?: number;
  extensionReason?: string;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const { data, error } = await db.rpc("decide_probation_outcome_atomic", {
    p_case_id: input.caseId,
    p_decision: input.decision,
    p_notes: input.notes,
    p_extension_days: input.extensionDays ?? null,
    p_extension_reason: input.extensionReason ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && !data.ok) {
    return { ok: false, error: data.error, message: data.message };
  }

  return { ok: true };
}

// ============================================================================
// MAPPER HELPERS
// ============================================================================

function mapOnboardingCase(r: any): OnboardingCase {
  const emp = r.employees;
  const mgr = r.manager;
  const buddy = r.buddy;

  return {
    id: r.id,
    companyId: r.company_id,
    employeeId: r.employee_id,
    candidateId: r.candidate_id ?? undefined,
    employmentId: r.employment_id ?? undefined,
    templateId: r.template_id ?? undefined,
    templateVersion: r.template_version ?? 1,
    joiningDate: r.joining_date,
    status: r.status,
    ownerUserId: r.owner_user_id ?? undefined,
    managerId: r.manager_id ?? undefined,
    buddyId: r.buddy_id ?? undefined,
    progressPercentage: Number(r.progress_percentage ?? 0),
    readinessStatus: r.readiness_status ?? "not_ready",
    blockingReasons: Array.isArray(r.blocking_reasons) ? r.blocking_reasons : [],
    welcomeNotes: r.welcome_notes ?? undefined,
    createdAt: r.created_at,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    cancelledAt: r.cancelled_at ?? undefined,
    updatedAt: r.updated_at,
    employeeName: emp ? `${emp.first_name_ar} ${emp.last_name_ar}`.trim() : undefined,
    employeeNo: emp?.employee_no ?? undefined,
    jobTitle: emp?.job_title_ar ?? undefined,
    departmentName: emp?.departments?.name_ar ?? undefined,
    managerName: mgr ? `${mgr.first_name_ar} ${mgr.last_name_ar}`.trim() : undefined,
    buddyName: buddy ? `${buddy.first_name_ar} ${buddy.last_name_ar}`.trim() : undefined,
  };
}

function mapOnboardingTask(r: any): OnboardingTask {
  return {
    id: r.id,
    caseId: r.case_id,
    companyId: r.company_id,
    taskDefinitionId: r.task_definition_id ?? undefined,
    code: r.code,
    titleAr: r.title_ar,
    titleEn: r.title_en,
    descriptionAr: r.description_ar ?? undefined,
    descriptionEn: r.description_en ?? undefined,
    ownerRole: r.owner_role,
    assignedToUserId: r.assigned_to_user_id ?? undefined,
    assignedToEmployeeId: r.assigned_to_employee_id ?? undefined,
    dueDate: r.due_date,
    relativeDueDays: r.relative_due_days ?? 0,
    status: r.status,
    isBlocking: Boolean(r.is_blocking),
    dependsOnTaskIds: Array.isArray(r.depends_on_task_ids) ? r.depends_on_task_ids : [],
    operationalTaskId: r.operational_task_id ?? undefined,
    completedAt: r.completed_at ?? undefined,
    completedBy: r.completed_by ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

function mapOnboardingDocumentRequirement(r: any): OnboardingDocumentRequirement {
  return {
    id: r.id,
    caseId: r.case_id,
    companyId: r.company_id,
    docType: r.doc_type,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    isMandatory: Boolean(r.is_mandatory),
    status: r.status,
    employeeDocumentId: r.employee_document_id ?? undefined,
    fileId: r.file_id ?? undefined,
    rejectionReason: r.rejection_reason ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
    verifiedBy: r.verified_by ?? undefined,
    createdAt: r.created_at,
  };
}

function mapOnboardingAcknowledgement(r: any): OnboardingAcknowledgement {
  return {
    id: r.id,
    caseId: r.case_id,
    companyId: r.company_id,
    employeeId: r.employee_id,
    policyCode: r.policy_code,
    policyTitleAr: r.policy_title_ar,
    policyTitleEn: r.policy_title_en,
    policyVersion: r.policy_version ?? "1.0",
    acknowledgedAt: r.acknowledged_at,
    ipAddress: r.ip_address ?? undefined,
    signatureText: r.signature_text ?? undefined,
  };
}

function mapOnboardingTemplate(r: any): OnboardingTemplate {
  return {
    id: r.id,
    companyId: r.company_id,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    descriptionAr: r.description_ar ?? undefined,
    descriptionEn: r.description_en ?? undefined,
    country: r.country ?? "SA",
    departmentId: r.department_id ?? undefined,
    employmentType: r.employment_type ?? "all",
    isActive: Boolean(r.is_active),
    currentVersion: r.current_version ?? 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapOnboardingTaskDefinition(r: any): OnboardingTaskDefinition {
  return {
    id: r.id,
    companyId: r.company_id,
    code: r.code,
    titleAr: r.title_ar,
    titleEn: r.title_en,
    descriptionAr: r.description_ar ?? undefined,
    descriptionEn: r.description_en ?? undefined,
    ownerRole: r.owner_role,
    category: r.category,
    relativeDueDays: r.relative_due_days ?? 0,
    isBlocking: Boolean(r.is_blocking),
    dependencyTaskCodes: Array.isArray(r.dependency_task_codes)
      ? r.dependency_task_codes
      : [],
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
  };
}

function mapProbationPolicy(r: any): ProbationPolicy {
  return {
    id: r.id,
    companyId: r.company_id,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    country: r.country ?? "SA",
    defaultDurationDays: r.default_duration_days ?? 90,
    maxExtensionDays: r.max_extension_days ?? 90,
    midReviewDays: r.mid_review_days ?? undefined,
    finalReviewDaysBeforeEnd: r.final_review_days_before_end ?? 14,
    isActive: Boolean(r.is_active),
  };
}

function mapProbationCase(r: any): ProbationCase {
  const emp = r.employees;
  const rev = r.reviewer;

  return {
    id: r.id,
    companyId: r.company_id,
    employeeId: r.employee_id,
    employmentId: r.employment_id ?? undefined,
    onboardingCaseId: r.onboarding_case_id ?? undefined,
    policyId: r.policy_id ?? undefined,
    startDate: r.start_date,
    originalEndDate: r.original_end_date,
    currentEndDate: r.current_end_date,
    status: r.status,
    reviewerEmployeeId: r.reviewer_employee_id ?? undefined,
    reviewDueAt: r.review_due_at,
    finalDecision: r.final_decision ?? undefined,
    decisionDate: r.decision_date ?? undefined,
    decisionNotes: r.decision_notes ?? undefined,
    extensionCount: r.extension_count ?? 0,
    extensionDays: r.extension_days ?? 0,
    extensionReason: r.extension_reason ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    employeeName: emp ? `${emp.first_name_ar} ${emp.last_name_ar}`.trim() : undefined,
    employeeNo: emp?.employee_no ?? undefined,
    jobTitle: emp?.job_title_ar ?? undefined,
    departmentName: emp?.departments?.name_ar ?? undefined,
    reviewerName: rev ? `${rev.first_name_ar} ${rev.last_name_ar}`.trim() : undefined,
  };
}

function mapProbationReview(r: any): ProbationReview {
  return {
    id: r.id,
    probationCaseId: r.probation_case_id,
    companyId: r.company_id,
    reviewType: r.review_type,
    reviewerId: r.reviewer_id ?? undefined,
    reviewerEmployeeId: r.reviewer_employee_id ?? undefined,
    rating: r.rating ? Number(r.rating) : undefined,
    goalsAchievementScore: r.goals_achievement_score
      ? Number(r.goals_achievement_score)
      : undefined,
    competencyScore: r.competency_score ? Number(r.competency_score) : undefined,
    managerRecommendation: r.manager_recommendation ?? undefined,
    hrRecommendation: r.hr_recommendation ?? undefined,
    comments: r.comments ?? undefined,
    strengths: r.strengths ?? undefined,
    improvements: r.improvements ?? undefined,
    decision: r.decision ?? undefined,
    completedAt: r.completed_at ?? undefined,
    createdAt: r.created_at,
  };
}
