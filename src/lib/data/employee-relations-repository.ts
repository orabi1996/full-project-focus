// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: PRODUCTION EMPLOYEE RELATIONS, CASES & DISCIPLINARY REPOSITORY
// src/lib/data/employee-relations-repository.ts
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { employeeRelationsQueryKeys } from "../query/employee-relations-query-keys";
import type {
  ErCase,
  ErCaseParticipant,
  ErCaseAccessGrant,
  ErCaseNote,
  ErInvestigation,
  ErInvestigationStep,
  ErWitness,
  ErInterview,
  ErEvidence,
  ErFinding,
  ErDisciplinaryCatalogItem,
  ErDecision,
  ErDisciplinaryAction,
  ErEmployeeWarning,
  ErAppeal,
  ErCorrectiveActionPlan,
  ErDashboardKpis,
  ErCaseType,
  ErConfidentialityLevel,
  ErSeverity,
  ErCaseStatus,
  ErDecisionType,
  ErWarningLevel,
  ErAcknowledgementStatus,
  ErAppealGrounds,
  ErReviewFrequency,
  ErInterviewType,
  ErEvidenceType,
  ErEvidenceClassification,
} from "../domains/employee-relations";

const db = supabase as any;

// ============================================================================
// 1. KPIS & DASHBOARD OVERVIEW
// ============================================================================

export async function fetchErKpis(companyId: string): Promise<ErDashboardKpis> {
  const { data, error } = await db.rpc("get_er_dashboard_kpis_atomic", {
    p_company_id: companyId,
  });

  if (error) {
    console.warn("fetchErKpis error:", error.message);
    return {
      totalCases: 0,
      openCases: 0,
      activeInvestigations: 0,
      slaBreachedCount: 0,
      activeWarnings: 0,
      pendingAcknowledgements: 0,
      openAppeals: 0,
      activeCaps: 0,
      avgResolutionDays: 0,
      grievanceResolutionRate: 100,
      caseTypeCounts: {},
    };
  }

  return {
    totalCases: data?.total_cases ?? 0,
    openCases: data?.open_cases ?? 0,
    activeInvestigations: data?.active_investigations ?? 0,
    slaBreachedCount: data?.sla_breached_count ?? 0,
    activeWarnings: data?.active_warnings ?? 0,
    pendingAcknowledgements: data?.pending_acknowledgements ?? 0,
    openAppeals: data?.open_appeals ?? 0,
    activeCaps: data?.active_caps ?? 0,
    avgResolutionDays: Number(data?.avg_resolution_days ?? 0),
    grievanceResolutionRate: Number(data?.grievance_resolution_rate ?? 100),
    caseTypeCounts: data?.case_type_counts ?? {},
  };
}

// ============================================================================
// 2. ER CASES SERVER QUERIES
// ============================================================================

export async function fetchErCasesServer(
  companyId: string,
  filters?: { status?: string; caseType?: string; severity?: string; employeeId?: string }
): Promise<ErCase[]> {
  let query = db
    .from("er_cases")
    .select(`
      *,
      subject:employees!er_cases_subject_employee_id_fkey(id, employee_no, first_name_ar, last_name_ar, department_id, departments(name_ar)),
      complainant:employees!er_cases_complainant_employee_id_fkey(id, employee_no, first_name_ar, last_name_ar),
      investigator:employees!er_cases_assigned_investigator_id_fkey(id, employee_no, first_name_ar, last_name_ar)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.caseType && filters.caseType !== "all") {
    query = query.eq("case_type", filters.caseType);
  }
  if (filters?.severity && filters.severity !== "all") {
    query = query.eq("severity", filters.severity);
  }
  if (filters?.employeeId) {
    query = query.or(
      `subject_employee_id.eq.${filters.employeeId},complainant_employee_id.eq.${filters.employeeId}`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((c: any) => ({
    id: c.id,
    companyId: c.company_id,
    caseNumber: c.case_number,
    title: c.title,
    description: c.description,
    caseType: c.case_type as ErCaseType,
    confidentialityLevel: c.confidentiality_level as ErConfidentialityLevel,
    severity: c.severity as ErSeverity,
    status: c.status as ErCaseStatus,
    subjectEmployeeId: c.subject_employee_id,
    subjectEmployeeName: c.subject
      ? `${c.subject.first_name_ar} ${c.subject.last_name_ar}`
      : undefined,
    subjectDepartment: c.subject?.departments?.name_ar,
    complainantEmployeeId: c.complainant_employee_id,
    complainantEmployeeName: c.is_anonymous_complainant
      ? "مقدم البلاغ (محمي الهوية)"
      : c.complainant
      ? `${c.complainant.first_name_ar} ${c.complainant.last_name_ar}`
      : undefined,
    isAnonymousComplainant: Boolean(c.is_anonymous_complainant),
    assignedInvestigatorId: c.assigned_investigator_id,
    assignedInvestigatorName: c.investigator
      ? `${c.investigator.first_name_ar} ${c.investigator.last_name_ar}`
      : undefined,
    caseOwnerId: c.case_owner_id,
    incidentDate: c.incident_date,
    targetResolutionDays: c.target_resolution_days ?? 14,
    dueDate: c.due_date,
    isSlaBreached: Boolean(c.is_sla_breached),
    slaBreachedAt: c.sla_breached_at,
    resolvedAt: c.resolved_at,
    closedAt: c.closed_at,
    resolutionSummary: c.resolution_summary,
    closureReason: c.closure_reason,
    createdBy: c.created_by,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

export async function fetchErCaseByIdServer(caseId: string): Promise<ErCase | null> {
  const { data, error } = await db
    .from("er_cases")
    .select(`
      *,
      subject:employees!er_cases_subject_employee_id_fkey(id, employee_no, first_name_ar, last_name_ar, department_id, departments(name_ar)),
      complainant:employees!er_cases_complainant_employee_id_fkey(id, employee_no, first_name_ar, last_name_ar),
      investigator:employees!er_cases_assigned_investigator_id_fkey(id, employee_no, first_name_ar, last_name_ar)
    `)
    .eq("id", caseId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    caseNumber: data.case_number,
    title: data.title,
    description: data.description,
    caseType: data.case_type as ErCaseType,
    confidentialityLevel: data.confidentiality_level as ErConfidentialityLevel,
    severity: data.severity as ErSeverity,
    status: data.status as ErCaseStatus,
    subjectEmployeeId: data.subject_employee_id,
    subjectEmployeeName: data.subject
      ? `${data.subject.first_name_ar} ${data.subject.last_name_ar}`
      : undefined,
    subjectDepartment: data.subject?.departments?.name_ar,
    complainantEmployeeId: data.complainant_employee_id,
    complainantEmployeeName: data.is_anonymous_complainant
      ? "مقدم البلاغ (محمي الهوية)"
      : data.complainant
      ? `${data.complainant.first_name_ar} ${data.complainant.last_name_ar}`
      : undefined,
    isAnonymousComplainant: Boolean(data.is_anonymous_complainant),
    assignedInvestigatorId: data.assigned_investigator_id,
    assignedInvestigatorName: data.investigator
      ? `${data.investigator.first_name_ar} ${data.investigator.last_name_ar}`
      : undefined,
    caseOwnerId: data.case_owner_id,
    incidentDate: data.incident_date,
    targetResolutionDays: data.target_resolution_days ?? 14,
    dueDate: data.due_date,
    isSlaBreached: Boolean(data.is_sla_breached),
    slaBreachedAt: data.sla_breached_at,
    resolvedAt: data.resolved_at,
    closedAt: data.closed_at,
    resolutionSummary: data.resolution_summary,
    closureReason: data.closure_reason,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================================================
// 3. PARTICIPANTS & NOTES
// ============================================================================

export async function fetchErCaseParticipantsServer(caseId: string): Promise<ErCaseParticipant[]> {
  const { data, error } = await db
    .from("er_case_participants")
    .select(`
      *,
      employee:employees(id, employee_no, first_name_ar, last_name_ar)
    `)
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((p: any) => ({
    id: p.id,
    caseId: p.case_id,
    companyId: p.company_id,
    employeeId: p.employee_id,
    employeeName: p.employee
      ? `${p.employee.first_name_ar} ${p.employee.last_name_ar}`
      : undefined,
    employeeNumber: p.employee?.employee_no,
    participantRole: p.participant_role,
    accessPermission: p.access_permission,
    notifiedAt: p.notified_at,
    statementSubmitted: Boolean(p.statement_submitted),
    notes: p.notes,
    createdAt: p.created_at,
  }));
}

export async function fetchErCaseNotesServer(caseId: string): Promise<ErCaseNote[]> {
  const { data, error } = await db
    .from("er_case_notes")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((n: any) => ({
    id: n.id,
    caseId: n.case_id,
    companyId: n.company_id,
    authorId: n.author_id,
    authorName: n.author_name,
    authorRole: n.author_role,
    noteType: n.note_type,
    content: n.content,
    isConfidential: Boolean(n.is_confidential),
    isInternalOnly: Boolean(n.is_internal_only),
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));
}

// ============================================================================
// 4. INVESTIGATIONS, INTERVIEWS, EVIDENCE & FINDINGS
// ============================================================================

export async function fetchErCaseInvestigationsServer(caseId: string): Promise<ErInvestigation[]> {
  const { data, error } = await db
    .from("er_case_investigations")
    .select(`
      *,
      lead:employees!er_case_investigations_lead_investigator_id_fkey(first_name_ar, last_name_ar),
      steps:er_investigation_steps(*)
    `)
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((inv: any) => ({
    id: inv.id,
    caseId: inv.case_id,
    companyId: inv.company_id,
    investigationNumber: inv.investigation_number,
    leadInvestigatorId: inv.lead_investigator_id,
    leadInvestigatorName: inv.lead
      ? `${inv.lead.first_name_ar} ${inv.lead.last_name_ar}`
      : undefined,
    scopeOfInvestigation: inv.scope_of_investigation,
    methodology: inv.methodology,
    status: inv.status,
    startedAt: inv.started_at,
    targetCompletionDate: inv.target_completion_date,
    completedAt: inv.completed_at,
    summaryReport: inv.summary_report,
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
    steps: (inv.steps || []).map((s: any) => ({
      id: s.id,
      investigationId: s.investigation_id,
      companyId: s.company_id,
      stepOrder: s.step_order,
      title: s.title,
      description: s.description,
      assignedToId: s.assigned_to_id,
      status: s.status,
      dueDate: s.due_date,
      completedAt: s.completed_at,
      notes: s.notes,
      createdAt: s.created_at,
    })),
  }));
}

export async function fetchErInterviewsServer(caseId: string): Promise<ErInterview[]> {
  const { data, error } = await db
    .from("er_case_interviews")
    .select("*")
    .eq("case_id", caseId)
    .order("scheduled_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((i: any) => ({
    id: i.id,
    investigationId: i.investigation_id,
    caseId: i.case_id,
    companyId: i.company_id,
    interviewType: i.interview_type,
    intervieweeId: i.interviewee_id,
    intervieweeName: i.interviewee_name,
    scheduledAt: i.scheduled_at,
    conductedAt: i.conducted_at,
    location: i.location,
    meetingLink: i.meeting_link,
    status: i.status,
    minutesOfMeeting: i.minutes_of_meeting,
    interviewSummary: i.interview_summary,
    admissionsOrDenials: i.admissions_or_denials,
    acknowledgedByInterviewee: Boolean(i.acknowledged_by_interviewee),
    createdAt: i.created_at,
  }));
}

export async function fetchErEvidenceServer(caseId: string): Promise<ErEvidence[]> {
  const { data, error } = await db
    .from("er_case_evidence")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((e: any) => ({
    id: e.id,
    caseId: e.case_id,
    companyId: e.company_id,
    evidenceNumber: e.evidence_number,
    title: e.title,
    description: e.description,
    evidenceType: e.evidence_type,
    filePath: e.file_path,
    fileSizeBytes: e.file_size_bytes,
    mimeType: e.mime_type,
    classification: e.classification,
    chainOfCustodyLog: e.chain_of_custody_log || [],
    uploadedBy: e.uploaded_by,
    isVoided: Boolean(e.is_voided),
    voidedReason: e.voided_reason,
    voidedAt: e.voided_at,
    voidedBy: e.voided_by,
    createdAt: e.created_at,
  }));
}

export async function fetchErFindingsServer(caseId: string): Promise<ErFinding[]> {
  const { data, error } = await db
    .from("er_case_findings")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((f: any) => ({
    id: f.id,
    investigationId: f.investigation_id,
    caseId: f.case_id,
    companyId: f.company_id,
    allegationItem: f.allegation_item,
    finding: f.finding,
    factualBasis: f.factual_basis,
    policyReference: f.policy_reference,
    recommendedAction: f.recommended_action,
    createdAt: f.created_at,
  }));
}

// ============================================================================
// 5. ACTION CATALOG & DECISIONS
// ============================================================================

export async function fetchErDisciplinaryCatalogServer(companyId: string): Promise<ErDisciplinaryCatalogItem[]> {
  const { data, error } = await db
    .from("er_disciplinary_action_catalog")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("severity_level", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((cat: any) => ({
    id: cat.id,
    companyId: cat.company_id,
    code: cat.code,
    nameAr: cat.name_ar,
    nameEn: cat.name_en,
    actionType: cat.action_type,
    severityLevel: cat.severity_level,
    defaultValidityDays: cat.default_validity_days,
    requiresHrHeadApproval: Boolean(cat.requires_hr_head_approval),
    isActive: Boolean(cat.is_active),
    createdAt: cat.created_at,
  }));
}

export async function fetchErDecisionsServer(caseId: string): Promise<ErDecision[]> {
  const { data, error } = await db
    .from("er_case_decisions")
    .select(`
      *,
      maker:employees!er_case_decisions_decision_maker_id_fkey(first_name_ar, last_name_ar)
    `)
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((d: any) => ({
    id: d.id,
    caseId: d.case_id,
    companyId: d.company_id,
    decisionNumber: d.decision_number,
    decisionMakerId: d.decision_maker_id,
    decisionMakerName: d.maker
      ? `${d.maker.first_name_ar} ${d.maker.last_name_ar}`
      : undefined,
    decisionType: d.decision_type,
    decisionSummary: d.decision_summary,
    rationale: d.rationale,
    effectiveDate: d.effective_date,
    appealEligible: Boolean(d.appeal_eligible),
    appealDeadline: d.appeal_deadline,
    approvedBy: d.approved_by,
    createdAt: d.created_at,
  }));
}

// ============================================================================
// 6. DISCIPLINARY ACTIONS, WARNINGS & APPEALS
// ============================================================================

export async function fetchErDisciplinaryActionsServer(
  companyId: string,
  employeeId?: string
): Promise<ErDisciplinaryAction[]> {
  let query = db
    .from("er_employee_disciplinary_actions")
    .select(`
      *,
      employee:employees(first_name_ar, last_name_ar)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((a: any) => ({
    id: a.id,
    companyId: a.company_id,
    caseId: a.case_id,
    decisionId: a.decision_id,
    employeeId: a.employee_id,
    employeeName: a.employee
      ? `${a.employee.first_name_ar} ${a.employee.last_name_ar}`
      : undefined,
    actionCatalogId: a.action_catalog_id,
    actionType: a.action_type,
    title: a.title,
    details: a.details,
    issuedDate: a.issued_date,
    expiryDate: a.expiry_date,
    status: a.status,
    rescindedReason: a.rescinded_reason,
    rescindedAt: a.rescinded_at,
    createdAt: a.created_at,
  }));
}

export async function fetchErEmployeeWarningsServer(
  companyId: string,
  employeeId?: string
): Promise<ErEmployeeWarning[]> {
  let query = db
    .from("er_employee_warnings")
    .select(`
      *,
      employee:employees!er_employee_warnings_employee_id_fkey(employee_no, first_name_ar, last_name_ar),
      witness:employees!er_employee_warnings_refusal_witness_id_fkey(first_name_ar, last_name_ar),
      case:er_cases(case_number)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((w: any) => ({
    id: w.id,
    companyId: w.company_id,
    caseId: w.case_id,
    caseNumber: w.case?.case_number,
    employeeId: w.employee_id,
    employeeName: w.employee
      ? `${w.employee.first_name_ar} ${w.employee.last_name_ar}`
      : undefined,
    employeeNumber: w.employee?.employee_no,
    warningNumber: w.warning_number,
    warningLevel: w.warning_level,
    violationCategory: w.violation_category,
    summary: w.summary,
    requiredImprovements: w.required_improvements,
    consequencesOfRecurrence: w.consequences_of_recurrence,
    issuedDate: w.issued_date,
    validUntil: w.valid_until,
    isActive: Boolean(w.is_active),
    acknowledgementStatus: w.acknowledgement_status,
    acknowledgedAt: w.acknowledged_at,
    employeeComments: w.employee_comments,
    refusalWitnessId: w.refusal_witness_id,
    refusalWitnessName: w.witness
      ? `${w.witness.first_name_ar} ${w.witness.last_name_ar}`
      : undefined,
    refusalNotes: w.refusal_notes,
    createdAt: w.created_at,
  }));
}

export async function fetchErAppealsServer(companyId: string, caseId?: string): Promise<ErAppeal[]> {
  let query = db
    .from("er_case_appeals")
    .select(`
      *,
      appellant:employees!er_case_appeals_appellant_employee_id_fkey(first_name_ar, last_name_ar),
      officer:employees!er_case_appeals_appeals_officer_id_fkey(first_name_ar, last_name_ar),
      case:er_cases(case_number),
      decision:er_case_decisions(decision_number)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (caseId) {
    query = query.eq("case_id", caseId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((ap: any) => ({
    id: ap.id,
    companyId: ap.company_id,
    caseId: ap.case_id,
    caseNumber: ap.case?.case_number,
    decisionId: ap.decision_id,
    decisionNumber: ap.decision?.decision_number,
    appealNumber: ap.appeal_number,
    appellantEmployeeId: ap.appellant_employee_id,
    appellantName: ap.appellant
      ? `${ap.appellant.first_name_ar} ${ap.appellant.last_name_ar}`
      : undefined,
    groundsForAppeal: ap.grounds_for_appeal,
    statement: ap.statement,
    status: ap.status,
    appealsOfficerId: ap.appeals_officer_id,
    appealsOfficerName: ap.officer
      ? `${ap.officer.first_name_ar} ${ap.officer.last_name_ar}`
      : undefined,
    reviewNotes: ap.review_notes,
    resolutionSummary: ap.resolution_summary,
    resolvedAt: ap.resolved_at,
    createdAt: ap.created_at,
  }));
}

export async function fetchErCorrectivePlansServer(
  companyId: string,
  employeeId?: string
): Promise<ErCorrectiveActionPlan[]> {
  let query = db
    .from("er_corrective_action_plans")
    .select(`
      *,
      employee:employees!er_corrective_action_plans_employee_id_fkey(first_name_ar, last_name_ar),
      supervisor:employees!er_corrective_action_plans_supervisor_id_fkey(first_name_ar, last_name_ar),
      case:er_cases(case_number)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((cap: any) => ({
    id: cap.id,
    companyId: cap.company_id,
    caseId: cap.case_id,
    caseNumber: cap.case?.case_number,
    employeeId: cap.employee_id,
    employeeName: cap.employee
      ? `${cap.employee.first_name_ar} ${cap.employee.last_name_ar}`
      : undefined,
    supervisorId: cap.supervisor_id,
    supervisorName: cap.supervisor
      ? `${cap.supervisor.first_name_ar} ${cap.supervisor.last_name_ar}`
      : undefined,
    title: cap.title,
    objectives: cap.objectives,
    startDate: cap.start_date,
    targetEndDate: cap.target_end_date,
    reviewFrequency: cap.review_frequency,
    linkedCourseId: cap.linked_course_id,
    status: cap.status,
    progressPct: cap.progress_pct ?? 0,
    finalEvaluation: cap.final_evaluation,
    completedAt: cap.completed_at,
    createdAt: cap.created_at,
    updatedAt: cap.updated_at,
  }));
}

// ============================================================================
// 7. ATOMIC MUTATIONS
// ============================================================================

export async function createErCaseRecord(params: {
  companyId: string;
  title: string;
  description: string;
  caseType: ErCaseType;
  confidentialityLevel?: ErConfidentialityLevel;
  severity?: ErSeverity;
  subjectEmployeeId?: string;
  complainantEmployeeId?: string;
  isAnonymousComplainant?: boolean;
  incidentDate?: string;
  targetResolutionDays?: number;
  createdBy?: string;
}): Promise<{ success: boolean; case_id?: string; case_number?: string; error?: string }> {
  const { data, error } = await db.rpc("create_er_case_atomic", {
    p_company_id: params.companyId,
    p_title: params.title,
    p_description: params.description,
    p_case_type: params.caseType,
    p_confidentiality_level: params.confidentialityLevel || "standard_hr",
    p_severity: params.severity || "medium",
    p_subject_employee_id: params.subjectEmployeeId || null,
    p_complainant_employee_id: params.complainantEmployeeId || null,
    p_is_anonymous_complainant: params.isAnonymousComplainant || false,
    p_incident_date: params.incidentDate || null,
    p_target_resolution_days: params.targetResolutionDays || 14,
    p_created_by: params.createdBy || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function triageErCaseRecord(params: {
  caseId: string;
  status: ErCaseStatus;
  severity: ErSeverity;
  assignedInvestigatorId?: string;
  caseOwnerId?: string;
  triageNotes?: string;
  userId?: string;
}): Promise<{ success: boolean; case_id?: string; new_status?: string; error?: string }> {
  const { data, error } = await db.rpc("triage_er_case_atomic", {
    p_case_id: params.caseId,
    p_status: params.status,
    p_severity: params.severity,
    p_assigned_investigator_id: params.assignedInvestigatorId || null,
    p_case_owner_id: params.caseOwnerId || null,
    p_triage_notes: params.triageNotes || null,
    p_user_id: params.userId || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function startErInvestigationRecord(params: {
  caseId: string;
  scope: string;
  methodology?: string;
  leadInvestigatorId?: string;
  targetCompletionDate?: string;
  userId?: string;
}): Promise<{ success: boolean; investigation_id?: string; investigation_number?: string; error?: string }> {
  const { data, error } = await db.rpc("start_er_investigation_atomic", {
    p_case_id: params.caseId,
    p_scope: params.scope,
    p_methodology: params.methodology || null,
    p_lead_investigator_id: params.leadInvestigatorId || null,
    p_target_completion_date: params.targetCompletionDate || null,
    p_user_id: params.userId || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function addErCaseNoteRecord(params: {
  caseId: string;
  companyId: string;
  authorId?: string;
  authorName: string;
  authorRole: string;
  noteType: "general" | "investigation" | "hearing" | "deliberation" | "legal_counsel" | "system_event";
  content: string;
  isConfidential?: boolean;
}): Promise<void> {
  const { error } = await db.from("er_case_notes").insert({
    case_id: params.caseId,
    company_id: params.companyId,
    author_id: params.authorId || null,
    author_name: params.authorName,
    author_role: params.authorRole,
    note_type: params.noteType,
    content: params.content,
    is_confidential: params.isConfidential ?? false,
    is_internal_only: true,
  });

  if (error) throw new Error(error.message);
}

export async function recordErDecisionRecord(params: {
  caseId: string;
  decisionMakerId: string;
  decisionType: ErDecisionType;
  decisionSummary: string;
  rationale: string;
  effectiveDate?: string;
  appealEligible?: boolean;
  appealDeadlineDays?: number;
  userId?: string;
}): Promise<{ success: boolean; decision_id?: string; decision_number?: string; error?: string }> {
  const { data, error } = await db.rpc("record_er_decision_atomic", {
    p_case_id: params.caseId,
    p_decision_maker_id: params.decisionMakerId,
    p_decision_type: params.decisionType,
    p_decision_summary: params.decisionSummary,
    p_rationale: params.rationale,
    p_effective_date: params.effectiveDate || null,
    p_appeal_eligible: params.appealEligible ?? true,
    p_appeal_deadline_days: params.appealDeadlineDays ?? 15,
    p_user_id: params.userId || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function issueDisciplinaryActionRecord(params: {
  caseId: string;
  decisionId: string;
  employeeId: string;
  catalogId?: string;
  actionType: string;
  title: string;
  details: string;
  warningLevel?: ErWarningLevel;
  validityDays?: number;
  userId?: string;
}): Promise<{ success: boolean; action_id?: string; warning_id?: string; warning_number?: string; error?: string }> {
  const { data, error } = await db.rpc("issue_disciplinary_action_atomic", {
    p_case_id: params.caseId,
    p_decision_id: params.decisionId,
    p_employee_id: params.employeeId,
    p_catalog_id: params.catalogId || null,
    p_action_type: params.actionType,
    p_title: params.title,
    p_details: params.details,
    p_warning_level: params.warningLevel || "first_written",
    p_validity_days: params.validityDays || 180,
    p_user_id: params.userId || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function acknowledgeWarningRecord(params: {
  warningId: string;
  acknowledgementStatus: ErAcknowledgementStatus;
  employeeComments?: string;
  refusalWitnessId?: string;
  refusalNotes?: string;
  userId?: string;
}): Promise<{ success: boolean; warning_id?: string; status?: string; error?: string }> {
  const { data, error } = await db.rpc("acknowledge_warning_atomic", {
    p_warning_id: params.warningId,
    p_acknowledgement_status: params.acknowledgementStatus,
    p_employee_comments: params.employeeComments || null,
    p_refusal_witness_id: params.refusalWitnessId || null,
    p_refusal_notes: params.refusalNotes || null,
    p_user_id: params.userId || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function submitErAppealRecord(params: {
  caseId: string;
  decisionId: string;
  appellantEmployeeId: string;
  grounds: ErAppealGrounds;
  statement: string;
  userId?: string;
}): Promise<{ success: boolean; appeal_id?: string; appeal_number?: string; error?: string }> {
  const { data, error } = await db.rpc("submit_er_appeal_atomic", {
    p_case_id: params.caseId,
    p_decision_id: params.decisionId,
    p_appellant_employee_id: params.appellantEmployeeId,
    p_grounds: params.grounds,
    p_statement: params.statement,
    p_user_id: params.userId || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function scheduleErInterviewRecord(params: {
  investigationId: string;
  caseId: string;
  companyId: string;
  interviewType: ErInterviewType;
  intervieweeId?: string;
  intervieweeName: string;
  scheduledAt: string;
  location?: string;
  meetingLink?: string;
}): Promise<void> {
  const { error } = await db.from("er_case_interviews").insert({
    investigation_id: params.investigationId,
    case_id: params.caseId,
    company_id: params.companyId,
    interview_type: params.interviewType,
    interviewee_id: params.intervieweeId || null,
    interviewee_name: params.intervieweeName,
    scheduled_at: params.scheduledAt,
    location: params.location || null,
    meeting_link: params.meetingLink || null,
    status: "scheduled",
  });

  if (error) throw new Error(error.message);
}

export async function addErEvidenceRecord(params: {
  caseId: string;
  companyId: string;
  evidenceNumber: string;
  title: string;
  description?: string;
  evidenceType: ErEvidenceType;
  filePath?: string;
  classification?: ErEvidenceClassification;
  uploadedBy?: string;
}): Promise<void> {
  const { error } = await db.from("er_case_evidence").insert({
    case_id: params.caseId,
    company_id: params.companyId,
    evidence_number: params.evidenceNumber,
    title: params.title,
    description: params.description || null,
    evidence_type: params.evidenceType,
    file_path: params.filePath || null,
    classification: params.classification || "restricted",
    uploaded_by: params.uploadedBy || null,
    chain_of_custody_log: [
      {
        timestamp: new Date().toISOString(),
        action: "uploaded",
        actor: params.uploadedBy || "System User",
        note: "Initial evidence registration",
      },
    ],
  });

  if (error) throw new Error(error.message);
}

export async function createCorrectivePlanRecord(params: {
  companyId: string;
  caseId?: string;
  employeeId: string;
  supervisorId?: string;
  title: string;
  objectives: string;
  startDate?: string;
  targetEndDate: string;
  reviewFrequency?: ErReviewFrequency;
  linkedCourseId?: string;
}): Promise<void> {
  const { error } = await db.from("er_corrective_action_plans").insert({
    company_id: params.companyId,
    case_id: params.caseId || null,
    employee_id: params.employeeId,
    supervisor_id: params.supervisorId || null,
    title: params.title,
    objectives: params.objectives,
    start_date: params.startDate || new Date().toISOString().split("T")[0],
    target_end_date: params.targetEndDate,
    review_frequency: params.reviewFrequency || "biweekly",
    linked_course_id: params.linkedCourseId || null,
    status: "in_progress",
    progress_pct: 0,
  });

  if (error) throw new Error(error.message);
}

// ============================================================================
// 8. REACT QUERY HOOKS
// ============================================================================

export function useErKpis(companyId: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.kpis(companyId),
    queryFn: () => fetchErKpis(companyId),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
}

export function useErCases(
  companyId: string,
  filters?: { status?: string; caseType?: string; severity?: string; employeeId?: string }
) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.cases.list(companyId, filters),
    queryFn: () => fetchErCasesServer(companyId, filters),
    enabled: Boolean(companyId),
  });
}

export function useErCaseDetail(caseId: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.cases.detail(caseId),
    queryFn: () => fetchErCaseByIdServer(caseId),
    enabled: Boolean(caseId),
  });
}

export function useErParticipants(caseId: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.participants(caseId),
    queryFn: () => fetchErCaseParticipantsServer(caseId),
    enabled: Boolean(caseId),
  });
}

export function useErCaseNotes(caseId: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.notes(caseId),
    queryFn: () => fetchErCaseNotesServer(caseId),
    enabled: Boolean(caseId),
  });
}

export function useErInvestigations(caseId: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.investigations.byCase(caseId),
    queryFn: () => fetchErCaseInvestigationsServer(caseId),
    enabled: Boolean(caseId),
  });
}

export function useErInterviews(caseId: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.interviews(caseId),
    queryFn: () => fetchErInterviewsServer(caseId),
    enabled: Boolean(caseId),
  });
}

export function useErEvidence(caseId: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.evidence(caseId),
    queryFn: () => fetchErEvidenceServer(caseId),
    enabled: Boolean(caseId),
  });
}

export function useErFindings(caseId: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.findings(caseId),
    queryFn: () => fetchErFindingsServer(caseId),
    enabled: Boolean(caseId),
  });
}

export function useErCatalog(companyId: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.catalog(companyId),
    queryFn: () => fetchErDisciplinaryCatalogServer(companyId),
    enabled: Boolean(companyId),
  });
}

export function useErDecisions(caseId: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.decisions(caseId),
    queryFn: () => fetchErDecisionsServer(caseId),
    enabled: Boolean(caseId),
  });
}

export function useErDisciplinaryActions(companyId: string, employeeId?: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.disciplinaryActions.all(),
    queryFn: () => fetchErDisciplinaryActionsServer(companyId, employeeId),
    enabled: Boolean(companyId),
  });
}

export function useErWarnings(companyId: string, employeeId?: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.warnings.list(companyId, employeeId),
    queryFn: () => fetchErEmployeeWarningsServer(companyId, employeeId),
    enabled: Boolean(companyId),
  });
}

export function useErAppeals(companyId: string, caseId?: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.appeals.list(companyId),
    queryFn: () => fetchErAppealsServer(companyId, caseId),
    enabled: Boolean(companyId),
  });
}

export function useErCaps(companyId: string, employeeId?: string) {
  return useQuery({
    queryKey: employeeRelationsQueryKeys.caps.list(companyId, employeeId),
    queryFn: () => fetchErCorrectivePlansServer(companyId, employeeId),
    enabled: Boolean(companyId),
  });
}

// Mutation Hooks
export function useCreateErCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createErCaseRecord,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.all });
    },
  });
}

export function useTriageErCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triageErCaseRecord,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.cases.all() });
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.cases.detail(vars.caseId) });
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.all });
    },
  });
}

export function useStartErInvestigation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startErInvestigationRecord,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.investigations.byCase(vars.caseId) });
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.cases.detail(vars.caseId) });
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.all });
    },
  });
}

export function useAddErCaseNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addErCaseNoteRecord,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.notes(vars.caseId) });
    },
  });
}

export function useRecordErDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordErDecisionRecord,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.decisions(vars.caseId) });
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.cases.detail(vars.caseId) });
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.all });
    },
  });
}

export function useIssueDisciplinaryAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: issueDisciplinaryActionRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.all });
    },
  });
}

export function useAcknowledgeWarning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeWarningRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.warnings.all() });
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.all });
    },
  });
}

export function useSubmitErAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitErAppealRecord,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.appeals.all() });
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.cases.detail(vars.caseId) });
      queryClient.invalidateQueries({ queryKey: employeeRelationsQueryKeys.all });
    },
  });
}
