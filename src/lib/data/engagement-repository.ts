// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 31: PRODUCTION ENGAGEMENT, SURVEYS & RECOGNITION DATA REPOSITORY
// src/lib/data/engagement-repository.ts
// ============================================================================

import { supabase } from "../../integrations/supabase/client";
import type {
  SurveyTemplate,
  SurveyTemplateVersion,
  SurveyQuestion,
  SurveyQuestionSnapshot,
  SurveyInstance,
  SurveyParticipant,
  SurveyAnswer,
  SurveyResponse,
  SurveyResultSnapshot,
  EngagementActionPlan,
  EngagementActionItem,
  RecognitionCategory,
  RecognitionBadge,
  EmployeeRecognition,
  RecognitionCampaign,
  RecognitionNomination,
  EngagementKpis,
  SurveyType,
  AnonymityMode,
  AudienceTargetType,
  QuestionCategory,
  ActionPlanStatus,
} from "../domains/engagement";

const db = supabase as any;

// ============================================================================
// 1. KPIS & EXECUTIVE OVERVIEW
// ============================================================================

export async function fetchEngagementKpis(companyId: string): Promise<EngagementKpis> {
  const { data, error } = await db.rpc("get_engagement_kpis_atomic", {
    p_company_id: companyId,
  });

  if (error) {
    console.warn("fetchEngagementKpis error:", error.message);
    return {
      activeSurveys: 0,
      avgParticipation: 0,
      latestEnps: 0,
      openActions: 0,
      overdueActions: 0,
      recognitionsMonth: 0,
      recognizedEmployeesCount: 0,
    };
  }

  return {
    activeSurveys: data?.active_surveys ?? 0,
    avgParticipation: Number(data?.avg_participation ?? 0),
    latestEnps: Number(data?.latest_enps ?? 0),
    openActions: data?.open_actions ?? 0,
    overdueActions: data?.overdue_actions ?? 0,
    recognitionsMonth: data?.recognitions_month ?? 0,
    recognizedEmployeesCount: data?.recognized_employees_count ?? 0,
  };
}

// ============================================================================
// 2. SURVEY TEMPLATES & QUESTION BANK
// ============================================================================

export async function fetchSurveyTemplates(companyId: string): Promise<SurveyTemplate[]> {
  const { data, error } = await db
    .from("survey_templates")
    .select(`
      *,
      versions:survey_template_versions(*)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((t: any) => ({
    id: t.id,
    companyId: t.company_id,
    code: t.code,
    titleAr: t.title_ar,
    titleEn: t.title_en,
    descriptionAr: t.description_ar,
    descriptionEn: t.description_en,
    surveyType: t.survey_type,
    defaultAnonymityMode: t.default_anonymity_mode,
    estimatedCompletionMinutes: t.estimated_completion_minutes,
    isActive: t.is_active,
    currentVersionNumber: t.current_version_number,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    versions: (t.versions || []).map((v: any) => ({
      id: v.id,
      templateId: v.template_id,
      companyId: v.company_id,
      versionNumber: v.version_number,
      status: v.status,
      questionsJson: v.questions_json,
      createdAt: v.created_at,
    })),
  }));
}

export async function createSurveyTemplate(
  companyId: string,
  payload: {
    code: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string;
    descriptionEn?: string;
    surveyType: SurveyType;
    defaultAnonymityMode: AnonymityMode;
    estimatedCompletionMinutes?: number;
    questions: SurveyQuestionSnapshot[];
  }
): Promise<SurveyTemplate> {
  const { data: tpl, error: tplError } = await db
    .from("survey_templates")
    .insert({
      company_id: companyId,
      code: payload.code,
      title_ar: payload.titleAr,
      title_en: payload.titleEn,
      description_ar: payload.descriptionAr,
      description_en: payload.descriptionEn,
      survey_type: payload.surveyType,
      default_anonymity_mode: payload.defaultAnonymityMode,
      estimated_completion_minutes: payload.estimatedCompletionMinutes ?? 5,
      current_version_number: 1,
    })
    .select()
    .single();

  if (tplError) throw new Error(tplError.message);

  const { error: verError } = await db.from("survey_template_versions").insert({
    template_id: tpl.id,
    company_id: companyId,
    version_number: 1,
    status: "published",
    questions_json: payload.questions,
  });

  if (verError) throw new Error(verError.message);

  return {
    id: tpl.id,
    companyId: tpl.company_id,
    code: tpl.code,
    titleAr: tpl.title_ar,
    titleEn: tpl.title_en,
    descriptionAr: tpl.description_ar,
    descriptionEn: tpl.description_en,
    surveyType: tpl.survey_type,
    defaultAnonymityMode: tpl.default_anonymity_mode,
    estimatedCompletionMinutes: tpl.estimated_completion_minutes,
    isActive: tpl.is_active,
    currentVersionNumber: 1,
    createdAt: tpl.created_at,
    updatedAt: tpl.updated_at,
  };
}

export async function fetchSurveyQuestions(
  companyId: string,
  category?: string
): Promise<SurveyQuestion[]> {
  let query = db
    .from("survey_questions")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((q: any) => ({
    id: q.id,
    companyId: q.company_id,
    code: q.code,
    textAr: q.text_ar,
    textEn: q.text_en,
    category: q.category,
    questionType: q.question_type,
    scaleConfig: q.scale_config,
    isRequired: q.is_required,
    isActive: q.is_active,
    createdAt: q.created_at,
  }));
}

export async function createSurveyQuestion(
  companyId: string,
  payload: {
    code: string;
    textAr: string;
    textEn: string;
    category: QuestionCategory;
    questionType: string;
    scaleConfig?: any;
    isRequired?: boolean;
  }
): Promise<SurveyQuestion> {
  const { data, error } = await db
    .from("survey_questions")
    .insert({
      company_id: companyId,
      code: payload.code,
      text_ar: payload.textAr,
      text_en: payload.textEn,
      category: payload.category,
      question_type: payload.questionType,
      scale_config: payload.scaleConfig ?? { min: 1, max: 5 },
      is_required: payload.isRequired ?? true,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    companyId: data.company_id,
    code: data.code,
    textAr: data.text_ar,
    textEn: data.text_en,
    category: data.category,
    questionType: data.question_type,
    scaleConfig: data.scale_config,
    isRequired: data.is_required,
    isActive: data.is_active,
    createdAt: data.created_at,
  };
}

// ============================================================================
// 3. SURVEY INSTANCES & CAMPAIGN MANAGEMENT
// ============================================================================

export async function fetchSurveyInstances(
  companyId: string,
  status?: string
): Promise<SurveyInstance[]> {
  let query = db
    .from("survey_instances")
    .select(`
      *,
      snapshot:survey_result_snapshots(*),
      audiences:survey_audiences(*)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((s: any) => ({
    id: s.id,
    companyId: s.company_id,
    templateVersionId: s.template_version_id,
    code: s.code,
    titleAr: s.title_ar,
    titleEn: s.title_en,
    surveyType: s.survey_type,
    status: s.status,
    launchAt: s.launch_at,
    closeAt: s.close_at,
    anonymityMode: s.anonymity_mode,
    minimumReportingGroupSize: s.minimum_reporting_group_size,
    createdBy: s.created_by,
    publishedAt: s.published_at,
    closedAt: s.closed_at,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    snapshot: s.snapshot?.[0]
      ? {
          id: s.snapshot[0].id,
          surveyId: s.snapshot[0].survey_id,
          companyId: s.snapshot[0].company_id,
          eligibleCount: s.snapshot[0].eligible_count,
          completedCount: s.snapshot[0].completed_count,
          participationRate: Number(s.snapshot[0].participation_rate || 0),
          overallEngagementScore: Number(s.snapshot[0].overall_engagement_score || 0),
          enpsScore: Number(s.snapshot[0].enps_score || 0),
          promotersCount: s.snapshot[0].promoters_count,
          passivesCount: s.snapshot[0].passives_count,
          detractorsCount: s.snapshot[0].detractors_count,
          dimensionScores: s.snapshot[0].dimension_scores || {},
          departmentScores: s.snapshot[0].department_scores || [],
          calculatedAt: s.snapshot[0].calculated_at,
        }
      : null,
    audiences: (s.audiences || []).map((a: any) => ({
      id: a.id,
      surveyId: a.survey_id,
      companyId: a.company_id,
      targetType: a.target_type,
      targetEntityId: a.target_entity_id,
      createdAt: a.created_at,
    })),
  }));
}

export async function fetchSurveyInstanceDetail(surveyId: string): Promise<SurveyInstance | null> {
  const { data, error } = await db
    .from("survey_instances")
    .select(`
      *,
      snapshot:survey_result_snapshots(*),
      audiences:survey_audiences(*),
      template_version:survey_template_versions(*)
    `)
    .eq("id", surveyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    templateVersionId: data.template_version_id,
    code: data.code,
    titleAr: data.title_ar,
    titleEn: data.title_en,
    surveyType: data.survey_type,
    status: data.status,
    launchAt: data.launch_at,
    closeAt: data.close_at,
    anonymityMode: data.anonymity_mode,
    minimumReportingGroupSize: data.minimum_reporting_group_size,
    createdBy: data.created_by,
    publishedAt: data.published_at,
    closedAt: data.closed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    questions: data.template_version?.questions_json || [],
    snapshot: data.snapshot?.[0]
      ? {
          id: data.snapshot[0].id,
          surveyId: data.snapshot[0].survey_id,
          companyId: data.snapshot[0].company_id,
          eligibleCount: data.snapshot[0].eligible_count,
          completedCount: data.snapshot[0].completed_count,
          participationRate: Number(data.snapshot[0].participation_rate || 0),
          overallEngagementScore: Number(data.snapshot[0].overall_engagement_score || 0),
          enpsScore: Number(data.snapshot[0].enps_score || 0),
          promotersCount: data.snapshot[0].promoters_count,
          passivesCount: data.snapshot[0].passives_count,
          detractorsCount: data.snapshot[0].detractors_count,
          dimensionScores: data.snapshot[0].dimension_scores || {},
          departmentScores: data.snapshot[0].department_scores || [],
          calculatedAt: data.snapshot[0].calculated_at,
        }
      : null,
  };
}

export async function createSurveyInstance(
  companyId: string,
  payload: {
    code: string;
    titleAr: string;
    titleEn: string;
    surveyType: SurveyType;
    templateId?: string;
    templateVersionId?: string;
    anonymityMode: AnonymityMode;
    minimumReportingGroupSize?: number;
    targetType: AudienceTargetType;
    targetEntityId?: string;
  }
): Promise<SurveyInstance> {
  // If templateId provided without templateVersionId, resolve latest published version
  let versionId = payload.templateVersionId;
  if (!versionId && payload.templateId) {
    const { data: ver } = await db
      .from("survey_template_versions")
      .select("id")
      .eq("template_id", payload.templateId)
      .eq("status", "published")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    versionId = ver?.id;
  }

  const { data: inst, error: instError } = await db
    .from("survey_instances")
    .insert({
      company_id: companyId,
      template_version_id: versionId,
      code: payload.code,
      title_ar: payload.titleAr,
      title_en: payload.titleEn,
      survey_type: payload.surveyType,
      status: "draft",
      anonymity_mode: payload.anonymityMode,
      minimum_reporting_group_size: payload.minimumReportingGroupSize ?? 5,
    })
    .select()
    .single();

  if (instError) throw new Error(instError.message);

  // Audience
  await db.from("survey_audiences").insert({
    survey_id: inst.id,
    company_id: companyId,
    target_type: payload.targetType,
    target_entity_id: payload.targetEntityId || null,
  });

  return {
    id: inst.id,
    companyId: inst.company_id,
    templateVersionId: inst.template_version_id,
    code: inst.code,
    titleAr: inst.title_ar,
    titleEn: inst.title_en,
    surveyType: inst.survey_type,
    status: inst.status,
    anonymityMode: inst.anonymity_mode,
    minimumReportingGroupSize: inst.minimum_reporting_group_size,
    createdAt: inst.created_at,
    updatedAt: inst.updated_at,
  };
}

export async function launchSurveyInstance(
  companyId: string,
  surveyId: string,
  initiatorId?: string
): Promise<{ success: boolean; eligible_count?: number; error?: string }> {
  const { data, error } = await db.rpc("launch_survey_instance_atomic", {
    p_company_id: companyId,
    p_survey_id: surveyId,
    p_initiator_id: initiatorId || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function submitSurveyResponse(
  companyId: string,
  surveyId: string,
  tokenOrEmpId: string,
  answers: SurveyAnswer[],
  isDraft = false
): Promise<{ success: boolean; response_id?: string; error?: string }> {
  const { data, error } = await db.rpc("submit_survey_response_atomic", {
    p_company_id: companyId,
    p_survey_id: surveyId,
    p_token_or_emp_id: tokenOrEmpId,
    p_answers: answers,
    p_is_draft: isDraft,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function recalculateSurveyAnalytics(
  companyId: string,
  surveyId: string
): Promise<any> {
  const { data, error } = await db.rpc("calculate_survey_analytics_atomic", {
    p_company_id: companyId,
    p_survey_id: surveyId,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchSurveyParticipants(
  surveyId: string
): Promise<SurveyParticipant[]> {
  const { data, error } = await db
    .from("survey_participants")
    .select(`
      *,
      employee:employees(id, employee_no, first_name_ar, last_name_ar)
    `)
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((p: any) => ({
    id: p.id,
    surveyId: p.survey_id,
    companyId: p.company_id,
    employeeId: p.employee_id,
    participationStatus: p.participation_status,
    anonymityToken: p.anonymity_token,
    invitedAt: p.invited_at,
    startedAt: p.started_at,
    completedAt: p.completed_at,
    departmentSnapshotId: p.department_snapshot_id,
    createdAt: p.created_at,
    employeeNameAr: p.employee
      ? `${p.employee.first_name_ar} ${p.employee.last_name_ar}`
      : undefined,
    employeeNo: p.employee?.employee_no,
  }));
}

export async function fetchMyPendingSurveys(
  companyId: string,
  employeeId: string
): Promise<Array<{ survey: SurveyInstance; participant: SurveyParticipant }>> {
  const { data, error } = await db
    .from("survey_participants")
    .select(`
      *,
      survey:survey_instances(
        *,
        template_version:survey_template_versions(*)
      )
    `)
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .neq("participation_status", "completed");

  if (error) throw new Error(error.message);

  return (data || [])
    .filter((p: any) => p.survey && p.survey.status === "open")
    .map((p: any) => ({
      participant: {
        id: p.id,
        surveyId: p.survey_id,
        companyId: p.company_id,
        employeeId: p.employee_id,
        participationStatus: p.participation_status,
        anonymityToken: p.anonymity_token,
        invitedAt: p.invited_at,
        startedAt: p.started_at,
        completedAt: p.completed_at,
        departmentSnapshotId: p.department_snapshot_id,
        createdAt: p.created_at,
      },
      survey: {
        id: p.survey.id,
        companyId: p.survey.company_id,
        templateVersionId: p.survey.template_version_id,
        code: p.survey.code,
        titleAr: p.survey.title_ar,
        titleEn: p.survey.title_en,
        surveyType: p.survey.survey_type,
        status: p.survey.status,
        launchAt: p.survey.launch_at,
        closeAt: p.survey.close_at,
        anonymityMode: p.survey.anonymity_mode,
        minimumReportingGroupSize: p.survey.minimum_reporting_group_size,
        createdBy: p.survey.created_by,
        publishedAt: p.survey.published_at,
        closedAt: p.survey.closed_at,
        createdAt: p.survey.created_at,
        updatedAt: p.survey.updated_at,
        questions: p.survey.template_version?.questions_json || [],
      },
    }));
}

// ============================================================================
// 4. ACTION PLANS & POST-SURVEY INTERVENTIONS
// ============================================================================

export async function fetchEngagementActionPlans(
  companyId: string,
  surveyId?: string
): Promise<EngagementActionPlan[]> {
  let query = db
    .from("engagement_action_plans")
    .select(`
      *,
      survey:survey_instances(title_ar),
      department:departments(name_ar),
      owner:employees(first_name_ar, last_name_ar),
      items:engagement_action_items(*)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (surveyId) {
    query = query.eq("survey_id", surveyId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((p: any) => ({
    id: p.id,
    companyId: p.company_id,
    surveyId: p.survey_id,
    surveyTitleAr: p.survey?.title_ar,
    titleAr: p.title_ar,
    titleEn: p.title_en,
    dimension: p.dimension,
    departmentId: p.department_id,
    departmentNameAr: p.department?.name_ar,
    ownerEmployeeId: p.owner_employee_id,
    ownerNameAr: p.owner ? `${p.owner.first_name_ar} ${p.owner.last_name_ar}` : undefined,
    description: p.description,
    targetDate: p.target_date,
    status: p.status,
    successMeasure: p.success_measure,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    items: (p.items || []).map((i: any) => ({
      id: i.id,
      actionPlanId: i.action_plan_id,
      companyId: i.company_id,
      titleAr: i.title_ar,
      titleEn: i.title_en,
      assigneeId: i.assignee_id,
      dueDate: i.due_date,
      status: i.status,
      createdAt: i.created_at,
    })),
  }));
}

export async function createEngagementActionPlan(
  companyId: string,
  payload: {
    surveyId?: string;
    titleAr: string;
    titleEn: string;
    dimension: string;
    departmentId?: string;
    ownerEmployeeId?: string;
    description?: string;
    targetDate?: string;
    successMeasure?: string;
    items?: Array<{ titleAr: string; titleEn: string; dueDate?: string }>;
  }
): Promise<EngagementActionPlan> {
  const { data: plan, error: planError } = await db
    .from("engagement_action_plans")
    .insert({
      company_id: companyId,
      survey_id: payload.surveyId || null,
      title_ar: payload.titleAr,
      title_en: payload.titleEn,
      dimension: payload.dimension,
      department_id: payload.departmentId || null,
      owner_employee_id: payload.ownerEmployeeId || null,
      description: payload.description,
      target_date: payload.targetDate || null,
      status: "planned",
      success_measure: payload.successMeasure,
    })
    .select()
    .single();

  if (planError) throw new Error(planError.message);

  if (payload.items && payload.items.length > 0) {
    const itemRecords = payload.items.map((i) => ({
      action_plan_id: plan.id,
      company_id: companyId,
      title_ar: i.titleAr,
      title_en: i.titleEn,
      due_date: i.dueDate || null,
      status: "pending",
    }));
    await db.from("engagement_action_items").insert(itemRecords);
  }

  return {
    id: plan.id,
    companyId: plan.company_id,
    surveyId: plan.survey_id,
    titleAr: plan.title_ar,
    titleEn: plan.title_en,
    dimension: plan.dimension,
    departmentId: plan.department_id,
    ownerEmployeeId: plan.owner_employee_id,
    description: plan.description,
    targetDate: plan.target_date,
    status: plan.status,
    successMeasure: plan.success_measure,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  };
}

export async function updateEngagementActionPlan(
  planId: string,
  updates: Partial<{
    status: ActionPlanStatus;
    titleAr: string;
    titleEn: string;
    targetDate: string;
  }>
): Promise<void> {
  const { error } = await db
    .from("engagement_action_plans")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  if (error) throw new Error(error.message);
}

export async function toggleActionItemStatus(
  itemId: string,
  status: "pending" | "completed"
): Promise<void> {
  const { error } = await db
    .from("engagement_action_items")
    .update({ status })
    .eq("id", itemId);

  if (error) throw new Error(error.message);
}

// ============================================================================
// 5. RECOGNITION, BADGES & APPRECIATION FEED
// ============================================================================

export async function fetchRecognitionCategories(
  companyId: string
): Promise<RecognitionCategory[]> {
  const { data, error } = await db
    .from("recognition_categories")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((c: any) => ({
    id: c.id,
    companyId: c.company_id,
    code: c.code,
    nameAr: c.name_ar,
    nameEn: c.name_en,
    descriptionAr: c.description_ar,
    descriptionEn: c.description_en,
    iconName: c.icon_name || "star",
    color: c.color || "#F59E0B",
    isActive: c.is_active,
    createdAt: c.created_at,
  }));
}

export async function fetchRecognitionBadges(
  companyId: string
): Promise<RecognitionBadge[]> {
  const { data, error } = await db
    .from("recognition_badges")
    .select(`
      *,
      category:recognition_categories(name_ar)
    `)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((b: any) => ({
    id: b.id,
    companyId: b.company_id,
    code: b.code,
    nameAr: b.name_ar,
    nameEn: b.name_en,
    descriptionAr: b.description_ar,
    descriptionEn: b.description_en,
    iconName: b.icon_name || "award",
    categoryId: b.category_id,
    categoryNameAr: b.category?.name_ar,
    isActive: b.is_active,
    createdAt: b.created_at,
  }));
}

export async function fetchEmployeeRecognitions(
  companyId: string,
  recipientId?: string
): Promise<EmployeeRecognition[]> {
  let query = db
    .from("employee_recognitions")
    .select(`
      *,
      sender:employees!employee_recognitions_sender_employee_id_fkey(first_name_ar, last_name_ar, job_title_ar),
      recipient:employees!employee_recognitions_recipient_employee_id_fkey(first_name_ar, last_name_ar, job_title_ar),
      category:recognition_categories(name_ar, color),
      badge:recognition_badges(name_ar, icon_name)
    `)
    .eq("company_id", companyId)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (recipientId) {
    query = query.eq("recipient_employee_id", recipientId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((r: any) => ({
    id: r.id,
    companyId: r.company_id,
    senderEmployeeId: r.sender_employee_id,
    senderNameAr: r.sender ? `${r.sender.first_name_ar} ${r.sender.last_name_ar}` : undefined,
    senderJobTitleAr: r.sender?.job_title_ar,
    recipientEmployeeId: r.recipient_employee_id,
    recipientNameAr: r.recipient ? `${r.recipient.first_name_ar} ${r.recipient.last_name_ar}` : undefined,
    recipientJobTitleAr: r.recipient?.job_title_ar,
    categoryId: r.category_id,
    categoryNameAr: r.category?.name_ar,
    categoryColor: r.category?.color,
    badgeId: r.badge_id,
    badgeNameAr: r.badge?.name_ar,
    badgeIconName: r.badge?.icon_name,
    message: r.message,
    visibility: r.visibility,
    status: r.status,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    points: r.points ?? 0,
    createdAt: r.created_at,
  }));
}

export async function sendEmployeeRecognition(
  companyId: string,
  senderId: string,
  recipientId: string,
  categoryId: string | null,
  badgeId: string | null,
  message: string,
  visibility = "company"
): Promise<{ success: boolean; recognition_id?: string; error?: string }> {
  const { data, error } = await db.rpc("send_employee_recognition_atomic", {
    p_company_id: companyId,
    p_sender_id: senderId,
    p_recipient_id: recipientId,
    p_category_id: categoryId,
    p_badge_id: badgeId,
    p_message: message,
    p_visibility: visibility,
  });

  if (error) throw new Error(error.message);
  return data;
}

// ============================================================================
// 6. RECOGNITION CAMPAIGNS & NOMINATIONS
// ============================================================================

export async function fetchRecognitionCampaigns(
  companyId: string
): Promise<RecognitionCampaign[]> {
  const { data, error } = await db
    .from("recognition_campaigns")
    .select(`
      *,
      winner:employees(first_name_ar, last_name_ar),
      nominations:recognition_nominations(id)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((c: any) => ({
    id: c.id,
    companyId: c.company_id,
    code: c.code,
    titleAr: c.title_ar,
    titleEn: c.title_en,
    descriptionAr: c.description_ar,
    descriptionEn: c.description_en,
    campaignType: c.campaign_type,
    startDate: c.start_date,
    endDate: c.end_date,
    status: c.status,
    winnerEmployeeId: c.winner_employee_id,
    winnerNameAr: c.winner ? `${c.winner.first_name_ar} ${c.winner.last_name_ar}` : undefined,
    nominationsCount: c.nominations?.length || 0,
    createdAt: c.created_at,
  }));
}

export async function createRecognitionCampaign(
  companyId: string,
  payload: {
    code: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string;
    descriptionEn?: string;
    campaignType: string;
    startDate: string;
    endDate: string;
  }
): Promise<RecognitionCampaign> {
  const { data, error } = await db
    .from("recognition_campaigns")
    .insert({
      company_id: companyId,
      code: payload.code,
      title_ar: payload.titleAr,
      title_en: payload.titleEn,
      description_ar: payload.descriptionAr,
      description_en: payload.descriptionEn,
      campaign_type: payload.campaignType,
      start_date: payload.startDate,
      end_date: payload.endDate,
      status: "active",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    companyId: data.company_id,
    code: data.code,
    titleAr: data.title_ar,
    titleEn: data.title_en,
    campaignType: data.campaign_type,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    createdAt: data.created_at,
  };
}

export async function fetchCampaignNominations(
  campaignId: string
): Promise<RecognitionNomination[]> {
  const { data, error } = await db
    .from("recognition_nominations")
    .select(`
      *,
      nominee:employees!recognition_nominations_nominee_employee_id_fkey(first_name_ar, last_name_ar, job_title_ar),
      nominator:employees!recognition_nominations_nominator_employee_id_fkey(first_name_ar, last_name_ar)
    `)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((n: any) => ({
    id: n.id,
    campaignId: n.campaign_id,
    companyId: n.company_id,
    nomineeEmployeeId: n.nominee_employee_id,
    nomineeNameAr: n.nominee ? `${n.nominee.first_name_ar} ${n.nominee.last_name_ar}` : undefined,
    nomineeJobTitleAr: n.nominee?.job_title_ar,
    nominatorEmployeeId: n.nominator_employee_id,
    nominatorNameAr: n.nominator ? `${n.nominator.first_name_ar} ${n.nominator.last_name_ar}` : undefined,
    reason: n.reason,
    evidenceUrl: n.evidence_url,
    status: n.status,
    createdAt: n.created_at,
  }));
}

export async function nominateCampaignCandidate(
  companyId: string,
  campaignId: string,
  nomineeId: string,
  nominatorId: string,
  reason: string,
  evidenceUrl?: string
): Promise<{ success: boolean; nomination_id?: string; error?: string }> {
  const { data, error } = await db.rpc("nominate_campaign_candidate_atomic", {
    p_company_id: companyId,
    p_campaign_id: campaignId,
    p_nominee_id: nomineeId,
    p_nominator_id: nominatorId,
    p_reason: reason,
    p_evidence_url: evidenceUrl || null,
  });

  if (error) throw new Error(error.message);
  return data;
}
