// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 29: LEARNING & SKILLS DATA REPOSITORY
// src/lib/data/learning-repository.ts
// ============================================================================

import { supabase } from "../../integrations/supabase/client";
import type {
  SkillCategory,
  Skill,
  EmployeeSkill,
  SkillGapItem,
  TrainingProvider,
  LearningItem,
  LearningProgram,
  TrainingSession,
  TrainingEnrollment,
  TrainingNeed,
  LearningPlan,
  Certification,
  EmployeeCertification,
  MandatoryLearningRule,
  LearningKpis,
} from "../domains/learning";

const db = supabase as any;

// ============================================================================
// 1. KPIS & OVERVIEW
// ============================================================================

export async function fetchLearningKpis(companyId: string): Promise<LearningKpis> {
  const { data, error } = await db.rpc("get_learning_kpis_atomic", {
    p_company_id: companyId,
  });

  if (error || !data) {
    return {
      activeCourses: 0,
      upcomingSessions: 0,
      totalEnrollments: 0,
      completedEnrollments: 0,
      completionRate: 0.0,
      expiringCertifications: 0,
      totalTrainingCost: 0.0,
      activeSkillsCount: 0,
    };
  }

  return {
    activeCourses: data.active_courses || 0,
    upcomingSessions: data.upcoming_sessions || 0,
    totalEnrollments: data.total_enrollments || 0,
    completedEnrollments: data.completed_enrollments || 0,
    completionRate: Number(data.completion_rate) || 0.0,
    expiringCertifications: data.expiring_certifications || 0,
    totalTrainingCost: Number(data.total_training_cost) || 0.0,
    activeSkillsCount: data.active_skills_count || 0,
  };
}

// ============================================================================
// 2. SKILLS & CATEGORIES
// ============================================================================

export async function fetchSkillCategories(companyId: string): Promise<SkillCategory[]> {
  const { data, error } = await db
    .from("skill_categories")
    .select("*")
    .eq("company_id", companyId)
    .order("code", { ascending: true });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

export async function fetchSkills(companyId: string): Promise<Skill[]> {
  const { data, error } = await db
    .from("skills")
    .select(`
      *,
      skill_categories (name_ar, name_en)
    `)
    .eq("company_id", companyId)
    .order("name_ar", { ascending: true });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    categoryId: row.category_id,
    categoryNameAr: row.skill_categories?.name_ar,
    categoryNameEn: row.skill_categories?.name_en,
    code: row.code,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    category: row.category,
    proficiencyScaleType: row.proficiency_scale_type,
    ownerRole: row.owner_role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createSkill(payload: {
  companyId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  category: string;
  descriptionAr?: string;
  descriptionEn?: string;
  proficiencyScaleType?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("skills").insert({
    company_id: payload.companyId,
    code: payload.code,
    name_ar: payload.nameAr,
    name_en: payload.nameEn,
    category: payload.category,
    description_ar: payload.descriptionAr,
    description_en: payload.descriptionEn,
    proficiency_scale_type: payload.proficiencyScaleType || "1_to_5",
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function fetchEmployeeSkills(
  companyId: string,
  employeeId?: string
): Promise<EmployeeSkill[]> {
  let query = db
    .from("employee_skills")
    .select(`
      *,
      employees (first_name_ar, last_name_ar, employee_no),
      skills (code, name_ar, name_en, category)
    `)
    .eq("company_id", companyId);

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    employeeNo: row.employees?.employee_no,
    employeeName: row.employees ? `${row.employees.first_name_ar || ""} ${row.employees.last_name_ar || ""}`.trim() : undefined,
    skillId: row.skill_id,
    skillCode: row.skills?.code,
    skillNameAr: row.skills?.name_ar,
    skillNameEn: row.skills?.name_en,
    skillCategory: row.skills?.category,
    selfReportedLevel: row.self_reported_level,
    managerConfirmedLevel: row.manager_confirmed_level,
    formallyVerifiedLevel: row.formally_verified_level,
    currentProficiency: Number(row.current_proficiency) || 1.0,
    source: row.source,
    assessedBy: row.assessed_by,
    assessedAt: row.assessed_at,
    evidenceUrl: row.evidence_url,
    expiryDate: row.expiry_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function recordEmployeeSkill(payload: {
  companyId: string;
  employeeId: string;
  skillId: string;
  currentProficiency: number;
  selfReportedLevel?: number;
  managerConfirmedLevel?: number;
  formallyVerifiedLevel?: number;
  source: string;
  notes?: string;
  evidenceUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("employee_skills").upsert({
    company_id: payload.companyId,
    employee_id: payload.employeeId,
    skill_id: payload.skillId,
    current_proficiency: payload.currentProficiency,
    self_reported_level: payload.selfReportedLevel,
    manager_confirmed_level: payload.managerConfirmedLevel,
    formally_verified_level: payload.formallyVerifiedLevel,
    source: payload.source,
    notes: payload.notes,
    evidence_url: payload.evidenceUrl,
    assessed_at: new Date().toISOString(),
    status: "active",
  }, { onConflict: "company_id,employee_id,skill_id" });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function fetchEmployeeSkillGaps(
  companyId: string,
  employeeId: string
): Promise<SkillGapItem[]> {
  const { data, error } = await db.rpc("calculate_employee_skill_gaps", {
    p_company_id: companyId,
    p_employee_id: employeeId,
  });

  if (error || !data || !data.skill_gaps) return [];

  return data.skill_gaps.map((item: any) => ({
    skillId: item.skill_id,
    skillCode: item.skill_code,
    skillNameAr: item.skill_name_ar,
    skillNameEn: item.skill_name_en,
    skillCategory: item.skill_category,
    requiredProficiency: Number(item.required_proficiency) || 0,
    validatedProficiency: Number(item.validated_proficiency) || 0,
    gap: Number(item.gap) || 0,
    hasGap: Boolean(item.has_gap),
    isMandatory: Boolean(item.is_mandatory),
  }));
}

// ============================================================================
// 3. LEARNING ITEMS, PROGRAMS & PROVIDERS
// ============================================================================

export async function fetchTrainingProviders(companyId: string): Promise<TrainingProvider[]> {
  const { data, error } = await db
    .from("training_providers")
    .select("*")
    .eq("company_id", companyId)
    .order("name_ar", { ascending: true });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    providerType: row.provider_type,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    contactPerson: row.contact_person,
    email: row.email,
    phone: row.phone,
    website: row.website,
    country: row.country,
    rating: row.rating ? Number(row.rating) : null,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

export async function fetchLearningItems(companyId: string): Promise<LearningItem[]> {
  const { data, error } = await db
    .from("learning_items")
    .select(`
      *,
      training_providers (name_ar)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    itemType: row.item_type,
    code: row.code,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    category: row.category,
    deliveryMethod: row.delivery_method,
    durationHours: Number(row.duration_hours) || 1.0,
    providerId: row.provider_id,
    providerNameAr: row.training_providers?.name_ar,
    skillsDeveloped: row.skills_developed || [],
    targetAudience: row.target_audience,
    prerequisites: row.prerequisites,
    isMandatory: row.is_mandatory,
    validityMonths: row.validity_months,
    estimatedCost: Number(row.estimated_cost) || 0.0,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createLearningItem(payload: {
  companyId: string;
  itemType: string;
  code: string;
  titleAr: string;
  titleEn: string;
  category: string;
  deliveryMethod: string;
  durationHours: number;
  providerId?: string;
  estimatedCost?: number;
  isMandatory?: boolean;
  descriptionAr?: string;
  descriptionEn?: string;
  targetAudience?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("learning_items").insert({
    company_id: payload.companyId,
    item_type: payload.itemType,
    code: payload.code,
    title_ar: payload.titleAr,
    title_en: payload.titleEn,
    category: payload.category,
    delivery_method: payload.deliveryMethod,
    duration_hours: payload.durationHours,
    provider_id: payload.providerId || null,
    estimated_cost: payload.estimatedCost || 0.0,
    is_mandatory: payload.isMandatory || false,
    description_ar: payload.descriptionAr,
    description_en: payload.descriptionEn,
    target_audience: payload.targetAudience,
    status: "active",
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function fetchLearningPrograms(companyId: string): Promise<LearningProgram[]> {
  const { data, error } = await db
    .from("learning_programs")
    .select(`
      *,
      learning_program_items (
        id, sequence_order, is_required, learning_item_id,
        learning_items (title_ar, title_en, code, duration_hours)
      )
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    description: row.description,
    targetRole: row.target_role,
    status: row.status,
    itemsCount: row.learning_program_items?.length || 0,
    items: row.learning_program_items?.map((item: any) => ({
      id: item.id,
      programId: row.id,
      learningItemId: item.learning_item_id,
      learningItem: item.learning_items,
      sequenceOrder: item.sequence_order,
      isRequired: item.is_required,
      createdAt: item.created_at,
    })),
    createdAt: row.created_at,
  }));
}

// ============================================================================
// 4. TRAINING SESSIONS & ATOMIC ENROLLMENT
// ============================================================================

export async function fetchTrainingSessions(companyId: string): Promise<TrainingSession[]> {
  const { data, error } = await db
    .from("training_sessions")
    .select(`
      *,
      learning_items (title_ar, title_en),
      training_providers (name_ar)
    `)
    .eq("company_id", companyId)
    .order("start_date", { ascending: true });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    learningItemId: row.learning_item_id,
    courseTitleAr: row.learning_items?.title_ar,
    courseTitleEn: row.learning_items?.title_en,
    sessionCode: row.session_code,
    trainerName: row.trainer_name,
    providerId: row.provider_id,
    providerNameAr: row.training_providers?.name_ar,
    startDate: row.start_date,
    endDate: row.end_date,
    timezone: row.timezone,
    location: row.location,
    virtualUrl: row.virtual_url,
    capacity: row.capacity,
    enrolledCount: row.enrolled_count,
    registrationDeadline: row.registration_deadline,
    costPerSeat: Number(row.cost_per_seat) || 0.0,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createTrainingSession(payload: {
  companyId: string;
  learningItemId: string;
  sessionCode: string;
  trainerName?: string;
  startDate: string;
  endDate: string;
  location?: string;
  virtualUrl?: string;
  capacity: number;
  costPerSeat?: number;
  registrationDeadline?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("training_sessions").insert({
    company_id: payload.companyId,
    learning_item_id: payload.learningItemId,
    session_code: payload.sessionCode,
    trainer_name: payload.trainerName,
    start_date: payload.startDate,
    end_date: payload.endDate,
    location: payload.location,
    virtual_url: payload.virtualUrl,
    capacity: payload.capacity,
    cost_per_seat: payload.costPerSeat || 0.0,
    registration_deadline: payload.registrationDeadline || null,
    status: "open",
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function enrollInSession(payload: {
  companyId: string;
  sessionId: string;
  employeeId: string;
  source?: string;
  requestId?: string;
  notes?: string;
}): Promise<{ success: boolean; enrollmentId?: string; status?: string; error?: string }> {
  const { data, error } = await db.rpc("enroll_in_training_session_atomic", {
    p_company_id: payload.companyId,
    p_session_id: payload.sessionId,
    p_employee_id: payload.employeeId,
    p_source: payload.source || "employee_request",
    p_request_id: payload.requestId || null,
    p_notes: payload.notes || null,
  });

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to enroll" };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return {
    success: true,
    enrollmentId: data.enrollment_id,
    status: data.status,
  };
}

export async function fetchTrainingEnrollments(
  companyId: string,
  employeeId?: string
): Promise<TrainingEnrollment[]> {
  let query = db
    .from("training_enrollments")
    .select(`
      *,
      training_sessions (
        session_code,
        learning_items (title_ar, title_en)
      ),
      employees (first_name_ar, last_name_ar, employee_no, departments(name_ar))
    `)
    .eq("company_id", companyId);

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query.order("enrolled_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    sessionId: row.session_id,
    sessionCode: row.training_sessions?.session_code,
    courseTitleAr: row.training_sessions?.learning_items?.title_ar,
    courseTitleEn: row.training_sessions?.learning_items?.title_en,
    employeeId: row.employee_id,
    employeeNo: row.employees?.employee_no,
    employeeName: row.employees ? `${row.employees.first_name_ar || ""} ${row.employees.last_name_ar || ""}`.trim() : undefined,
    departmentName: row.employees?.departments?.name_ar,
    enrollmentSource: row.enrollment_source,
    status: row.status,
    attendanceStatus: row.attendance_status,
    completionStatus: row.completion_status,
    completionDate: row.completion_date,
    score: row.score ? Number(row.score) : null,
    passed: row.passed,
    requestId: row.request_id,
    cost: Number(row.cost) || 0.0,
    notes: row.notes,
    enrolledAt: row.enrolled_at,
    updatedAt: row.updated_at,
  }));
}

export async function recordAttendanceAndCompletion(payload: {
  companyId: string;
  enrollmentId: string;
  attendanceStatus: string;
  completionStatus: string;
  score?: number;
  passed?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await db.rpc("record_session_attendance_and_completion_atomic", {
    p_company_id: payload.companyId,
    p_enrollment_id: payload.enrollmentId,
    p_attendance_status: payload.attendanceStatus,
    p_completion_status: payload.completionStatus,
    p_score: payload.score ?? null,
    p_passed: payload.passed ?? null,
  });

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to update attendance" };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return { success: true };
}

// ============================================================================
// 5. CERTIFICATIONS & VERIFICATION
// ============================================================================

export async function fetchCertificationsCatalog(companyId: string): Promise<Certification[]> {
  const { data, error } = await db
    .from("certifications")
    .select("*")
    .eq("company_id", companyId)
    .order("name_ar", { ascending: true });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    issuer: row.issuer,
    category: row.category,
    validityMonths: row.validity_months,
    renewalRequired: row.renewal_required,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

export async function createCertificationCatalogItem(payload: {
  companyId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  issuer: string;
  category?: string;
  validityMonths?: number;
  renewalRequired?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("certifications").insert({
    company_id: payload.companyId,
    code: payload.code,
    name_ar: payload.nameAr,
    name_en: payload.nameEn,
    issuer: payload.issuer,
    category: payload.category || "professional",
    validity_months: payload.validityMonths || null,
    renewal_required: payload.renewalRequired ?? true,
    is_active: true,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function fetchEmployeeCertifications(
  companyId: string,
  employeeId?: string
): Promise<EmployeeCertification[]> {
  let query = db
    .from("employee_certifications")
    .select(`
      *,
      employees (first_name_ar, last_name_ar),
      certifications (code, name_ar, name_en)
    `)
    .eq("company_id", companyId);

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    employeeName: row.employees ? `${row.employees.first_name_ar || ""} ${row.employees.last_name_ar || ""}`.trim() : undefined,
    certificationId: row.certification_id,
    certificationCode: row.certifications?.code,
    certificationNameAr: row.certifications?.name_ar,
    certificationNameEn: row.certifications?.name_en,
    certificateNumber: row.certificate_number,
    issuer: row.issuer,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    documentId: row.document_id,
    verificationStatus: row.verification_status,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    verificationNotes: row.verification_notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createEmployeeCertification(payload: {
  companyId: string;
  employeeId: string;
  certificationId: string;
  certificateNumber: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  documentId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("employee_certifications").insert({
    company_id: payload.companyId,
    employee_id: payload.employeeId,
    certification_id: payload.certificationId,
    certificate_number: payload.certificateNumber,
    issuer: payload.issuer,
    issue_date: payload.issueDate,
    expiry_date: payload.expiryDate || null,
    document_id: payload.documentId || null,
    verification_status: "pending_verification",
    status: "pending_verification",
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function verifyEmployeeCertification(payload: {
  companyId: string;
  certificationId: string;
  verificationStatus: string;
  verifiedBy: string;
  notes?: string;
}): Promise<{ success: boolean; status?: string; error?: string }> {
  const { data, error } = await db.rpc("verify_employee_certification_atomic", {
    p_company_id: payload.companyId,
    p_employee_certification_id: payload.certificationId,
    p_verification_status: payload.verificationStatus,
    p_verified_by: payload.verifiedBy,
    p_notes: payload.notes || null,
  });

  if (error || !data) {
    return { success: false, error: error?.message || "Verification failed" };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return { success: true, status: data.status };
}

export async function triggerCertificationExpiryCheck(companyId: string): Promise<{ success: boolean; processedCount?: number }> {
  const { data, error } = await db.rpc("check_expiring_certifications_and_generate_tasks_atomic", {
    p_company_id: companyId,
  });

  if (error || !data) return { success: false };
  return { success: true, processedCount: data.processed_count };
}

// ============================================================================
// 6. MANDATORY LEARNING RULES
// ============================================================================

export async function fetchMandatoryRules(companyId: string): Promise<MandatoryLearningRule[]> {
  const { data, error } = await db
    .from("mandatory_learning_rules")
    .select(`
      *,
      learning_items (title_ar)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    ruleNameAr: row.rule_name_ar,
    ruleNameEn: row.rule_name_en,
    courseId: row.course_id,
    courseTitleAr: row.learning_items?.title_ar,
    targetType: row.target_type,
    targetId: row.target_id,
    targetValue: row.target_value,
    recurrenceMonths: row.recurrence_months,
    daysToComplete: row.days_to_complete,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

export async function createMandatoryRule(payload: {
  companyId: string;
  ruleNameAr: string;
  ruleNameEn: string;
  courseId: string;
  targetType: string;
  targetId?: string;
  targetValue?: string;
  daysToComplete?: number;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("mandatory_learning_rules").insert({
    company_id: payload.companyId,
    rule_name_ar: payload.ruleNameAr,
    rule_name_en: payload.ruleNameEn,
    course_id: payload.courseId,
    target_type: payload.targetType,
    target_id: payload.targetId || null,
    target_value: payload.targetValue || null,
    days_to_complete: payload.daysToComplete || 30,
    is_active: true,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function triggerMandatoryAssignment(companyId: string, ruleId: string): Promise<{ success: boolean; assignedCount?: number; error?: string }> {
  const { data, error } = await db.rpc("assign_mandatory_learning_atomic", {
    p_company_id: companyId,
    p_rule_id: ruleId,
  });

  if (error || !data) return { success: false, error: error?.message };
  return { success: true, assignedCount: data.assigned_count };
}

// ============================================================================
// 7. TRAINING NEEDS & LEARNING PLANS
// ============================================================================

export async function fetchTrainingNeeds(
  companyId: string,
  employeeId?: string
): Promise<TrainingNeed[]> {
  let query = db
    .from("training_needs")
    .select(`
      *,
      employees (first_name_ar, last_name_ar),
      skills (name_ar),
      learning_items (title_ar)
    `)
    .eq("company_id", companyId);

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    employeeName: row.employees ? `${row.employees.first_name_ar || ""} ${row.employees.last_name_ar || ""}`.trim() : undefined,
    source: row.source,
    skillId: row.skill_id,
    skillNameAr: row.skills?.name_ar,
    competencyId: row.competency_id,
    recommendedLearningItemId: row.recommended_learning_item_id,
    recommendedCourseTitle: row.learning_items?.title_ar,
    reason: row.reason,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
