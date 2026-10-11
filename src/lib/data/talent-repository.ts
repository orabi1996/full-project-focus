// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: PRODUCTION TALENT, CAREER & SUCCESSION DATA REPOSITORY
// src/lib/data/talent-repository.ts
// ============================================================================

import { supabase } from "../../integrations/supabase/client";
import type {
  CareerPath,
  CareerPathStep,
  EmployeeCareerPreference,
  CareerTargetRole,
  TalentReviewCycle,
  TalentAssessment,
  TalentPool,
  TalentPoolMember,
  CriticalRole,
  SuccessionPlan,
  SuccessionCandidate,
  TalentDevelopmentAction,
  InternalOpportunity,
  InternalApplication,
  MentoringRelationship,
  CareerConversation,
  TalentKpis,
  PathType,
  CareerPathStatus,
  CareerReadinessRating,
  TalentReviewCycleStatus,
  PerformanceRatingLevel,
  PotentialRatingLevel,
  NineBoxCellCode,
  RetentionRiskLevel,
  PromotionReadinessLevel,
  TalentPoolType,
  PoolNominationSource,
  PoolMemberStatus,
  CriticalityTier,
  VacancyRiskLevel,
  SuccessionPlanStatus,
  TargetFillUrgency,
  SuccessionReadinessTimeline,
  TalentDevelopmentActionType,
  TalentDevelopmentActionStatus,
  TalentDevelopmentActionSource,
  InternalOpportunityType,
  InternalOpportunityStatus,
  InternalApplicationStatus,
} from "../domains/talent";

const db = supabase as any;

// ============================================================================
// 1. KPIS & OVERVIEW
// ============================================================================

export async function fetchTalentKpis(companyId: string): Promise<TalentKpis> {
  const { data, error } = await db.rpc("get_talent_kpis_atomic", {
    p_company_id: companyId,
  });

  if (error || !data) {
    return {
      criticalRolesCount: 0,
      rolesWithoutSuccessor: 0,
      readyNowSuccessorsCount: 0,
      successionCoverageRate: 0.0,
      benchStrengthRate: 0.0,
      highPotentialCount: 0,
      activeInternalOpps: 0,
      internalApplicationsCount: 0,
      activeTalentPoolsCount: 0,
      overdueActionsCount: 0,
    };
  }

  return {
    criticalRolesCount: data.critical_roles_count || 0,
    rolesWithoutSuccessor: data.roles_without_successor || 0,
    readyNowSuccessorsCount: data.ready_now_successors_count || 0,
    successionCoverageRate: Number(data.succession_coverage_rate) || 0.0,
    benchStrengthRate: Number(data.bench_strength_rate) || 0.0,
    highPotentialCount: data.high_potential_count || 0,
    activeInternalOpps: data.active_internal_opps || 0,
    internalApplicationsCount: data.internal_applications_count || 0,
    activeTalentPoolsCount: data.active_talent_pools_count || 0,
    overdueActionsCount: data.overdue_actions_count || 0,
  };
}

// ============================================================================
// 2. CAREER PATHS & STEPS
// ============================================================================

export async function fetchCareerPaths(companyId: string): Promise<CareerPath[]> {
  const { data, error } = await db
    .from("career_paths")
    .select(`
      *,
      steps: career_path_steps (*)
    `)
    .eq("company_id", companyId)
    .order("code", { ascending: true });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    pathType: row.path_type as PathType,
    jobFamily: row.job_family,
    status: row.status as CareerPathStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps: Array.isArray(row.steps)
      ? row.steps
          .sort((a: any, b: any) => a.step_order - b.step_order)
          .map((s: any) => ({
            id: s.id,
            careerPathId: s.career_path_id,
            companyId: s.company_id,
            stepOrder: s.step_order,
            jobPositionId: s.job_position_id,
            jobTitleAr: s.job_title_ar,
            jobTitleEn: s.job_title_en,
            targetGrade: s.target_grade,
            minTenureMonths: s.min_tenure_months,
            requiredPerformanceRating: Number(s.required_performance_rating) || 3.0,
            skillsRequired: Array.isArray(s.skills_required) ? s.skills_required : [],
            certificationsRequired: Array.isArray(s.certifications_required) ? s.certifications_required : [],
            createdAt: s.created_at,
          }))
      : [],
  }));
}

export async function createCareerPath(payload: {
  companyId: string;
  code: string;
  titleAr: string;
  titleEn: string;
  pathType: PathType;
  jobFamily?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  steps?: Array<{
    stepOrder: number;
    jobTitleAr: string;
    jobTitleEn: string;
    jobPositionId?: string;
    targetGrade?: string;
    minTenureMonths?: number;
    requiredPerformanceRating?: number;
    skillsRequired?: any[];
  }>;
}): Promise<{ success: boolean; data?: CareerPath; error?: string }> {
  const { data: pathData, error: pathError } = await db
    .from("career_paths")
    .insert({
      company_id: payload.companyId,
      code: payload.code.trim().toUpperCase(),
      title_ar: payload.titleAr.trim(),
      title_en: payload.titleEn.trim(),
      path_type: payload.pathType,
      job_family: payload.jobFamily || null,
      description_ar: payload.descriptionAr || null,
      description_en: payload.descriptionEn || null,
      status: "active",
    })
    .select()
    .single();

  if (pathError || !pathData) {
    return { success: false, error: pathError?.message || "Failed to create career path" };
  }

  if (payload.steps && payload.steps.length > 0) {
    const stepInserts = payload.steps.map((st) => ({
      career_path_id: pathData.id,
      company_id: payload.companyId,
      step_order: st.stepOrder,
      job_title_ar: st.jobTitleAr,
      job_title_en: st.jobTitleEn,
      job_position_id: st.jobPositionId || null,
      target_grade: st.targetGrade || null,
      min_tenure_months: st.minTenureMonths || 12,
      required_performance_rating: st.requiredPerformanceRating || 3.0,
      skills_required: st.skillsRequired || [],
    }));

    await db.from("career_path_steps").insert(stepInserts);
  }

  return { success: true, data: pathData };
}

// ============================================================================
// 3. EMPLOYEE CAREER PREFERENCES & ASPIRATIONS
// ============================================================================

export async function fetchEmployeeCareerPreferences(
  companyId: string,
  employeeId: string
): Promise<EmployeeCareerPreference | null> {
  const { data, error } = await db
    .from("employee_career_preferences")
    .select(`
      *,
      job_positions (title_ar)
    `)
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    employeeId: data.employee_id,
    targetJobPositionId: data.target_job_position_id,
    targetPositionTitleAr: data.job_positions?.title_ar,
    targetJobFamily: data.target_job_family,
    targetJobTitleAr: data.target_job_title_ar,
    careerInterests: data.career_interests,
    developmentInterests: data.development_interests,
    preferredLocation: data.preferred_location,
    willingToRelocate: data.willing_to_relocate,
    internationalMobility: data.international_mobility,
    isConfidentialFromManager: data.is_confidential_from_manager,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function upsertEmployeeCareerPreferences(payload: {
  companyId: string;
  employeeId: string;
  targetJobPositionId?: string | null;
  targetJobFamily?: string | null;
  careerInterests?: string | null;
  developmentInterests?: string | null;
  preferredLocation?: string | null;
  willingToRelocate?: boolean;
  internationalMobility?: boolean;
  isConfidentialFromManager?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("employee_career_preferences").upsert(
    {
      company_id: payload.companyId,
      employee_id: payload.employeeId,
      target_job_position_id: payload.targetJobPositionId || null,
      target_job_family: payload.targetJobFamily || null,
      career_interests: payload.careerInterests || null,
      development_interests: payload.developmentInterests || null,
      preferred_location: payload.preferredLocation || null,
      willing_to_relocate: payload.willingToRelocate ?? false,
      international_mobility: payload.internationalMobility ?? false,
      is_confidential_from_manager: payload.isConfidentialFromManager ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,employee_id" }
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================================================
// 4. CAREER READINESS & SKILL GAPS (RPC CALL)
// ============================================================================

export async function calculateCareerReadinessAndGaps(
  companyId: string,
  employeeId: string,
  targetPositionId: string
): Promise<{
  success: boolean;
  readiness?: CareerReadinessRating;
  matchScore?: number;
  totalSkillsRequired?: number;
  matchedSkillsCount?: number;
  missingSkills?: any[];
  gaps?: any[];
  error?: string;
}> {
  const { data, error } = await db.rpc("calculate_career_readiness_and_gaps_atomic", {
    p_company_id: companyId,
    p_employee_id: employeeId,
    p_target_position_id: targetPositionId,
  });

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to calculate readiness" };
  }

  return {
    success: data.success,
    readiness: data.readiness,
    matchScore: Number(data.match_score) || 0,
    totalSkillsRequired: data.total_skills_required || 0,
    matchedSkillsCount: data.matched_skills_count || 0,
    missingSkills: data.missing_skills || [],
    gaps: data.gaps || [],
    error: data.error,
  };
}

// ============================================================================
// 5. TALENT REVIEW CYCLES & ASSESSMENTS (9-BOX GRID)
// ============================================================================

export async function fetchTalentReviewCycles(companyId: string): Promise<TalentReviewCycle[]> {
  const { data, error } = await db
    .from("talent_review_cycles")
    .select("*")
    .eq("company_id", companyId)
    .order("year", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    startDate: row.start_date,
    endDate: row.end_date,
    year: row.year,
    status: row.status as TalentReviewCycleStatus,
    guidelines: row.guidelines,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createTalentReviewCycle(payload: {
  companyId: string;
  code: string;
  titleAr: string;
  titleEn: string;
  startDate: string;
  endDate: string;
  year?: number;
  guidelines?: string;
}): Promise<{ success: boolean; data?: TalentReviewCycle; error?: string }> {
  const { data, error } = await db
    .from("talent_review_cycles")
    .insert({
      company_id: payload.companyId,
      code: payload.code.trim().toUpperCase(),
      title_ar: payload.titleAr.trim(),
      title_en: payload.titleEn.trim(),
      start_date: payload.startDate,
      end_date: payload.endDate,
      year: payload.year || new Date().getFullYear(),
      status: "open",
      guidelines: payload.guidelines || null,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message };
  return { success: true, data };
}

export async function fetchTalentAssessments(
  companyId: string,
  cycleId?: string
): Promise<TalentAssessment[]> {
  let query = db
    .from("talent_assessments")
    .select(`
      *,
      employees (first_name_ar, last_name_ar, employee_number),
      talent_review_cycles (title_ar)
    `)
    .eq("company_id", companyId);

  if (cycleId) {
    query = query.eq("cycle_id", cycleId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    cycleId: row.cycle_id,
    cycleTitleAr: row.talent_review_cycles?.title_ar,
    employeeId: row.employee_id,
    employeeNo: row.employees?.employee_number,
    employeeName: row.employees ? `${row.employees.first_name_ar} ${row.employees.last_name_ar}` : "",
    assessorId: row.assessor_id,
    performanceRating: row.performance_rating as PerformanceRatingLevel,
    potentialRating: row.potential_rating as PotentialRatingLevel,
    nineBoxCell: (row.calibrated_nine_box_cell || row.nine_box_cell) as NineBoxCellCode,
    calibratedPerformanceRating: row.calibrated_performance_rating,
    calibratedPotentialRating: row.calibrated_potential_rating,
    calibratedNineBoxCell: row.calibrated_nine_box_cell,
    calibrationNotes: row.calibration_notes,
    calibratedBy: row.calibrated_by,
    calibratedAt: row.calibrated_at,
    retentionRisk: row.retention_risk as RetentionRiskLevel,
    retentionRiskReason: row.retention_risk_reason,
    criticalTalentFlag: row.critical_talent_flag,
    readinessForPromotion: row.readiness_for_promotion as PromotionReadinessLevel,
    isConfidential: row.is_confidential,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function assessAndCalibrateTalent(payload: {
  companyId: string;
  cycleId: string;
  employeeId: string;
  performanceRating: PerformanceRatingLevel;
  potentialRating: PotentialRatingLevel;
  assessorId?: string;
  isCalibration?: boolean;
  notes?: string;
  retentionRisk?: RetentionRiskLevel;
  readiness?: PromotionReadinessLevel;
}): Promise<{ success: boolean; assessmentId?: string; nineBoxCell?: string; error?: string }> {
  const { data, error } = await db.rpc("assess_and_calibrate_talent_atomic", {
    p_company_id: payload.companyId,
    p_cycle_id: payload.cycleId,
    p_employee_id: payload.employeeId,
    p_performance_rating: payload.performanceRating,
    p_potential_rating: payload.potentialRating,
    p_assessor_id: payload.assessorId || null,
    p_is_calibration: payload.isCalibration ?? false,
    p_notes: payload.notes || null,
    p_retention_risk: payload.retentionRisk || "low",
    p_readiness: payload.readiness || "ready_1_year",
  });

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to assess talent" };
  }

  return {
    success: data.success,
    assessmentId: data.assessment_id,
    nineBoxCell: data.nine_box_cell,
  };
}

// ============================================================================
// 6. ENTERPRISE TALENT POOLS
// ============================================================================

export async function fetchTalentPools(companyId: string): Promise<TalentPool[]> {
  const { data, error } = await db
    .from("talent_pools")
    .select(`
      *,
      members: talent_pool_members (id)
    `)
    .eq("company_id", companyId)
    .order("code", { ascending: true });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    poolType: row.pool_type as TalentPoolType,
    ownerRole: row.owner_role,
    isConfidential: row.is_confidential,
    isActive: row.is_active,
    createdAt: row.created_at,
    memberCount: Array.isArray(row.members) ? row.members.length : 0,
  }));
}

export async function createTalentPool(payload: {
  companyId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  poolType: TalentPoolType;
  descriptionAr?: string;
  descriptionEn?: string;
  isConfidential?: boolean;
}): Promise<{ success: boolean; data?: TalentPool; error?: string }> {
  const { data, error } = await db
    .from("talent_pools")
    .insert({
      company_id: payload.companyId,
      code: payload.code.trim().toUpperCase(),
      name_ar: payload.nameAr.trim(),
      name_en: payload.nameEn.trim(),
      pool_type: payload.poolType,
      description_ar: payload.descriptionAr || null,
      description_en: payload.descriptionEn || null,
      is_confidential: payload.isConfidential ?? true,
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message };
  return { success: true, data };
}

export async function fetchTalentPoolMembers(
  companyId: string,
  poolId: string
): Promise<TalentPoolMember[]> {
  const { data, error } = await db
    .from("talent_pool_members")
    .select(`
      *,
      employees (first_name_ar, last_name_ar, employee_number),
      talent_pools (name_ar)
    `)
    .eq("company_id", companyId)
    .eq("talent_pool_id", poolId)
    .order("entry_date", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    talentPoolId: row.talent_pool_id,
    poolNameAr: row.talent_pools?.name_ar,
    companyId: row.company_id,
    employeeId: row.employee_id,
    employeeNo: row.employees?.employee_number,
    employeeName: row.employees ? `${row.employees.first_name_ar} ${row.employees.last_name_ar}` : "",
    entryDate: row.entry_date,
    exitDate: row.exit_date,
    nominationSource: row.nomination_source as PoolNominationSource,
    nominatedBy: row.nominated_by,
    status: row.status as PoolMemberStatus,
    reason: row.reason,
    developmentFocus: row.development_focus,
    createdAt: row.created_at,
  }));
}

export async function addTalentPoolMember(payload: {
  companyId: string;
  talentPoolId: string;
  employeeId: string;
  nominationSource?: PoolNominationSource;
  reason?: string;
  developmentFocus?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("talent_pool_members").insert({
    company_id: payload.companyId,
    talent_pool_id: payload.talentPoolId,
    employee_id: payload.employeeId,
    entry_date: new Date().toISOString().split("T")[0],
    nomination_source: payload.nominationSource || "manual_nomination",
    status: "active",
    reason: payload.reason || null,
    development_focus: payload.developmentFocus || null,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================================================
// 7. CRITICAL ROLES & SUCCESSION PLANS
// ============================================================================

export async function fetchCriticalRoles(companyId: string): Promise<CriticalRole[]> {
  const { data, error } = await db
    .from("critical_roles")
    .select(`
      *,
      job_positions (title_ar, title_en, departments (name_ar))
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    jobPositionId: row.job_position_id,
    positionTitleAr: row.job_positions?.title_ar,
    positionTitleEn: row.job_positions?.title_en,
    departmentNameAr: row.job_positions?.departments?.name_ar,
    criticalityTier: row.criticality_tier as CriticalityTier,
    vacancyRisk: row.vacancy_risk as VacancyRiskLevel,
    impactOfLoss: row.impact_of_loss,
    keyPersonDependencyNotes: row.key_person_dependency_notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createCriticalRole(payload: {
  companyId: string;
  jobPositionId: string;
  criticalityTier: CriticalityTier;
  vacancyRisk: VacancyRiskLevel;
  impactOfLoss?: string;
  keyPersonDependencyNotes?: string;
}): Promise<{ success: boolean; data?: CriticalRole; error?: string }> {
  const { data, error } = await db
    .from("critical_roles")
    .insert({
      company_id: payload.companyId,
      job_position_id: payload.jobPositionId,
      criticality_tier: payload.criticalityTier,
      vacancy_risk: payload.vacancyRisk,
      impact_of_loss: payload.impactOfLoss || null,
      key_person_dependency_notes: payload.keyPersonDependencyNotes || null,
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message };
  return { success: true, data };
}

export async function fetchSuccessionPlans(companyId: string): Promise<SuccessionPlan[]> {
  const { data, error } = await db
    .from("succession_plans")
    .select(`
      *,
      job_positions (title_ar),
      employees (first_name_ar, last_name_ar),
      candidates: succession_candidates (
        *,
        employees (first_name_ar, last_name_ar, employee_number)
      )
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => {
    const candidateList = Array.isArray(row.candidates)
      ? row.candidates
          .filter((c: any) => c.status !== "withdrawn")
          .sort((a: any, b: any) => a.ranking - b.ranking)
          .map((c: any) => ({
            id: c.id,
            successionPlanId: c.succession_plan_id,
            companyId: c.company_id,
            employeeId: c.employee_id,
            employeeNo: c.employees?.employee_number,
            employeeName: c.employees ? `${c.employees.first_name_ar} ${c.employees.last_name_ar}` : "",
            readinessTimeline: c.readiness_timeline as SuccessionReadinessTimeline,
            ranking: c.ranking,
            nominationReason: c.nomination_reason,
            retentionRisk: c.retention_risk,
            status: c.status,
            isEmergencySuccessor: c.is_emergency_successor,
            developmentGapSummary: c.development_gap_summary,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }))
      : [];

    return {
      id: row.id,
      companyId: row.company_id,
      criticalRoleId: row.critical_role_id,
      jobPositionId: row.job_position_id,
      positionTitleAr: row.job_positions?.title_ar,
      incumbentEmployeeId: row.incumbent_employee_id,
      incumbentName: row.employees ? `${row.employees.first_name_ar} ${row.employees.last_name_ar}` : "",
      status: row.status as SuccessionPlanStatus,
      targetFillUrgency: row.target_fill_urgency as TargetFillUrgency,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      candidates: candidateList,
      candidateCount: candidateList.length,
      readyNowCount: candidateList.filter((c: any) => c.readinessTimeline === "ready_now").length,
    };
  });
}

export async function createSuccessionPlan(payload: {
  companyId: string;
  jobPositionId: string;
  criticalRoleId?: string;
  incumbentEmployeeId?: string;
  targetFillUrgency?: TargetFillUrgency;
  notes?: string;
}): Promise<{ success: boolean; data?: SuccessionPlan; error?: string }> {
  const { data, error } = await db
    .from("succession_plans")
    .insert({
      company_id: payload.companyId,
      job_position_id: payload.jobPositionId,
      critical_role_id: payload.criticalRoleId || null,
      incumbent_employee_id: payload.incumbentEmployeeId || null,
      target_fill_urgency: payload.targetFillUrgency || "within_1_year",
      status: "active",
      notes: payload.notes || null,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message };
  return { success: true, data };
}

export async function nominateSuccessionCandidate(payload: {
  companyId: string;
  planId: string;
  employeeId: string;
  readiness?: SuccessionReadinessTimeline;
  ranking?: number;
  reason?: string;
  isEmergency?: boolean;
}): Promise<{ success: boolean; candidateId?: string; error?: string }> {
  const { data, error } = await db.rpc("nominate_succession_candidate_atomic", {
    p_company_id: payload.companyId,
    p_plan_id: payload.planId,
    p_employee_id: payload.employeeId,
    p_readiness: payload.readiness || "ready_1_year",
    p_ranking: payload.ranking || 1,
    p_nominator_id: null,
    p_reason: payload.reason || null,
    p_is_emergency: payload.isEmergency ?? false,
  });

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to nominate candidate" };
  }

  return {
    success: data.success,
    candidateId: data.candidate_id,
    error: data.error,
  };
}

// ============================================================================
// 8. TALENT DEVELOPMENT ACTIONS
// ============================================================================

export async function fetchTalentDevelopmentActions(
  companyId: string,
  employeeId?: string
): Promise<TalentDevelopmentAction[]> {
  let query = db
    .from("talent_development_actions")
    .select(`
      *,
      employees (first_name_ar, last_name_ar),
      learning_items (title_ar)
    `)
    .eq("company_id", companyId)
    .order("target_completion_date", { ascending: true });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    employeeName: row.employees ? `${row.employees.first_name_ar} ${row.employees.last_name_ar}` : "",
    actionType: row.action_type as TalentDevelopmentActionType,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    targetCompletionDate: row.target_completion_date,
    status: row.status as TalentDevelopmentActionStatus,
    sourceContext: row.source_context as TalentDevelopmentActionSource,
    sourceReferenceId: row.source_reference_id,
    learningItemId: row.learning_item_id,
    learningItemTitleAr: row.learning_items?.title_ar,
    temporaryAssignmentId: row.temporary_assignment_id,
    completionEvidence: row.completion_evidence,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createTalentDevelopmentAction(payload: {
  companyId: string;
  employeeId: string;
  actionType: TalentDevelopmentActionType;
  titleAr: string;
  titleEn: string;
  targetCompletionDate?: string;
  sourceContext?: TalentDevelopmentActionSource;
  learningItemId?: string;
}): Promise<{ success: boolean; data?: TalentDevelopmentAction; error?: string }> {
  const { data, error } = await db
    .from("talent_development_actions")
    .insert({
      company_id: payload.companyId,
      employee_id: payload.employeeId,
      action_type: payload.actionType,
      title_ar: payload.titleAr.trim(),
      title_en: payload.titleEn.trim(),
      target_completion_date: payload.targetCompletionDate || null,
      source_context: payload.sourceContext || "career_gap",
      learning_item_id: payload.learningItemId || null,
      status: "planned",
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message };
  return { success: true, data };
}

// ============================================================================
// 9. INTERNAL OPPORTUNITIES & MOBILITY MARKETPLACE
// ============================================================================

export async function fetchInternalOpportunities(
  companyId: string
): Promise<InternalOpportunity[]> {
  const { data, error } = await db
    .from("internal_opportunities")
    .select(`
      *,
      job_positions (title_ar),
      departments (name_ar),
      applications: internal_applications (id)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    opportunityType: row.opportunity_type as InternalOpportunityType,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    jobPositionId: row.job_position_id,
    positionTitleAr: row.job_positions?.title_ar,
    departmentId: row.department_id,
    departmentNameAr: row.departments?.name_ar,
    workLocationId: row.work_location_id,
    targetGrade: row.target_grade,
    durationMonths: row.duration_months,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    requiredSkills: Array.isArray(row.required_skills) ? row.required_skills : [],
    requiredExperienceYears: Number(row.required_experience_years) || 1.0,
    minTenureMonthsRequired: row.min_tenure_months_required || 6,
    applicationDeadline: row.application_deadline,
    status: row.status as InternalOpportunityStatus,
    requisitionId: row.requisition_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    applicationCount: Array.isArray(row.applications) ? row.applications.length : 0,
  }));
}

export async function createInternalOpportunity(payload: {
  companyId: string;
  opportunityType: InternalOpportunityType;
  titleAr: string;
  titleEn: string;
  jobPositionId?: string;
  departmentId?: string;
  targetGrade?: string;
  durationMonths?: number;
  descriptionAr?: string;
  descriptionEn?: string;
  requiredSkills?: any[];
  applicationDeadline?: string;
}): Promise<{ success: boolean; data?: InternalOpportunity; error?: string }> {
  const { data, error } = await db
    .from("internal_opportunities")
    .insert({
      company_id: payload.companyId,
      opportunity_type: payload.opportunityType,
      title_ar: payload.titleAr.trim(),
      title_en: payload.titleEn.trim(),
      job_position_id: payload.jobPositionId || null,
      department_id: payload.departmentId || null,
      target_grade: payload.targetGrade || null,
      duration_months: payload.durationMonths || null,
      description_ar: payload.descriptionAr || null,
      description_en: payload.descriptionEn || null,
      required_skills: payload.requiredSkills || [],
      application_deadline: payload.applicationDeadline || null,
      status: "open",
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message };
  return { success: true, data };
}

export async function fetchInternalApplications(
  companyId: string,
  opportunityId?: string
): Promise<InternalApplication[]> {
  let query = db
    .from("internal_applications")
    .select(`
      *,
      employees (first_name_ar, last_name_ar, employee_number),
      internal_opportunities (title_ar, opportunity_type),
      departments (name_ar),
      job_positions (title_ar)
    `)
    .eq("company_id", companyId)
    .order("applied_at", { ascending: false });

  if (opportunityId) {
    query = query.eq("opportunity_id", opportunityId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    opportunityId: row.opportunity_id,
    opportunityTitleAr: row.internal_opportunities?.title_ar,
    opportunityType: row.internal_opportunities?.opportunity_type,
    employeeId: row.employee_id,
    employeeNo: row.employees?.employee_number,
    employeeName: row.employees ? `${row.employees.first_name_ar} ${row.employees.last_name_ar}` : "",
    currentDepartmentId: row.current_department_id,
    currentDepartmentNameAr: row.departments?.name_ar,
    currentPositionId: row.current_position_id,
    currentPositionTitleAr: row.job_positions?.title_ar,
    status: row.status as InternalApplicationStatus,
    isManagerNotified: row.is_manager_notified,
    matchScore: Number(row.match_score) || 0,
    matchReasons: Array.isArray(row.match_reasons) ? row.match_reasons : [],
    appliedAt: row.applied_at,
    selectedAt: row.selected_at,
    movementId: row.movement_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function applyForInternalOpportunity(payload: {
  companyId: string;
  opportunityId: string;
  employeeId: string;
  notes?: string;
}): Promise<{ success: boolean; applicationId?: string; matchScore?: number; error?: string }> {
  const { data, error } = await db.rpc("apply_for_internal_opportunity_atomic", {
    p_company_id: payload.companyId,
    p_opportunity_id: payload.opportunityId,
    p_employee_id: payload.employeeId,
    p_notes: payload.notes || null,
  });

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to submit internal application" };
  }

  return {
    success: data.success,
    applicationId: data.application_id,
    matchScore: Number(data.match_score) || 0,
    error: data.error,
  };
}

export async function selectInternalCandidateAndInitiateMovement(payload: {
  companyId: string;
  applicationId: string;
  movementType: string; // 'promotion', 'transfer', 'job_change'
  effectiveDate: string;
  initiatorId: string;
}): Promise<{
  success: boolean;
  applicationId?: string;
  movementId?: string;
  movementNumber?: string;
  error?: string;
}> {
  const { data, error } = await db.rpc("select_internal_candidate_and_initiate_movement_atomic", {
    p_company_id: payload.companyId,
    p_application_id: payload.applicationId,
    p_movement_type: payload.movementType,
    p_effective_date: payload.effectiveDate,
    p_initiator_id: payload.initiatorId,
  });

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to select candidate and initiate movement" };
  }

  return {
    success: data.success,
    applicationId: data.application_id,
    movementId: data.movement_id,
    movementNumber: data.movement_number,
    error: data.error,
  };
}

// ============================================================================
// 10. MENTORING & CAREER CONVERSATIONS
// ============================================================================

export async function fetchMentoringRelationships(
  companyId: string
): Promise<MentoringRelationship[]> {
  const { data, error } = await db
    .from("mentoring_relationships")
    .select(`
      *,
      mentor: mentor_employee_id (first_name_ar, last_name_ar),
      mentee: mentee_employee_id (first_name_ar, last_name_ar)
    `)
    .eq("company_id", companyId)
    .order("start_date", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    mentorEmployeeId: row.mentor_employee_id,
    mentorName: row.mentor ? `${row.mentor.first_name_ar} ${row.mentor.last_name_ar}` : "",
    menteeEmployeeId: row.mentee_employee_id,
    menteeName: row.mentee ? `${row.mentee.first_name_ar} ${row.mentee.last_name_ar}` : "",
    objectiveAr: row.objective_ar,
    objectiveEn: row.objective_en,
    focusAreas: row.focus_areas,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    confidentialNotes: row.confidential_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createMentoringRelationship(payload: {
  companyId: string;
  mentorEmployeeId: string;
  menteeEmployeeId: string;
  objectiveAr: string;
  objectiveEn?: string;
  focusAreas?: string;
  startDate?: string;
}): Promise<{ success: boolean; data?: MentoringRelationship; error?: string }> {
  const { data, error } = await db
    .from("mentoring_relationships")
    .insert({
      company_id: payload.companyId,
      mentor_employee_id: payload.mentorEmployeeId,
      mentee_employee_id: payload.menteeEmployeeId,
      objective_ar: payload.objectiveAr.trim(),
      objective_en: payload.objectiveEn?.trim() || null,
      focus_areas: payload.focusAreas || null,
      start_date: payload.startDate || new Date().toISOString().split("T")[0],
      status: "active",
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message };
  return { success: true, data };
}

export async function fetchCareerConversations(
  companyId: string,
  employeeId?: string
): Promise<CareerConversation[]> {
  let query = db
    .from("career_conversations")
    .select(`
      *,
      employees (first_name_ar, last_name_ar),
      manager: manager_employee_id (first_name_ar, last_name_ar)
    `)
    .eq("company_id", companyId)
    .order("conversation_date", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    employeeName: row.employees ? `${row.employees.first_name_ar} ${row.employees.last_name_ar}` : "",
    managerEmployeeId: row.manager_employee_id,
    managerName: row.manager ? `${row.manager.first_name_ar} ${row.manager.last_name_ar}` : "",
    conversationDate: row.conversation_date,
    careerGoalsDiscussed: row.career_goals_discussed,
    developmentPrioritiesAgreed: row.development_priorities_agreed,
    targetRolesDiscussed: row.target_roles_discussed,
    agreedActions: row.agreed_actions,
    confidentialManagerNotes: row.confidential_manager_notes,
    createdAt: row.created_at,
  }));
}

export async function createCareerConversation(payload: {
  companyId: string;
  employeeId: string;
  managerEmployeeId: string;
  careerGoalsDiscussed?: string;
  developmentPrioritiesAgreed?: string;
  targetRolesDiscussed?: string;
  agreedActions?: string;
  confidentialManagerNotes?: string;
}): Promise<{ success: boolean; data?: CareerConversation; error?: string }> {
  const { data, error } = await db
    .from("career_conversations")
    .insert({
      company_id: payload.companyId,
      employee_id: payload.employeeId,
      manager_employee_id: payload.managerEmployeeId,
      conversation_date: new Date().toISOString().split("T")[0],
      career_goals_discussed: payload.careerGoalsDiscussed || null,
      development_priorities_agreed: payload.developmentPrioritiesAgreed || null,
      target_roles_discussed: payload.targetRolesDiscussed || null,
      agreed_actions: payload.agreedActions || null,
      confidential_manager_notes: payload.confidentialManagerNotes || null,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message };
  return { success: true, data };
}
