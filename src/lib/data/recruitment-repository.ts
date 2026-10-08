/**
 * Recruitment, ATS, Offers & Hiring Engine Data Repository
 * Production-grade data access with server-authoritative RPCs and TanStack Query.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "../query/query-keys";
import { AppMutationError } from "./reliable-mutation";
import type { CandidateStage, ContractType } from "../../types";

export type EmploymentType = ContractType;
export type WorkType = "on_site" | "hybrid" | "remote";

export interface InterviewPanel {
  id: string;
  interviewId: string;
  interviewerId: string;
  interviewerName?: string;
  role?: string;
}

export interface CandidateAssessment {
  id: string;
  candidateId: string;
  scorecardId?: string;
  type: string;
  overallScore: number;
}

const db = supabase as any;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type RequisitionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "open"
  | "partially_filled"
  | "filled"
  | "cancelled"
  | "closed";

export type JobOpeningStatus = "draft" | "approved" | "published" | "paused" | "closed";

export type InterviewType = "screening" | "technical" | "hr" | "cultural" | "executive" | "final";
export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "rescheduled" | "no_show";

export type ScorecardRecommendation = "strong_hire" | "hire" | "neutral" | "reject" | "strong_reject";

export type JobOfferStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired"
  | "withdrawn";

export interface RecruitmentRequisition {
  id: string;
  companyId: string;
  requisitionNo: string;
  titleAr: string;
  titleEn?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  jobPositionId?: string | null;
  costCenterId?: string | null;
  workLocationId?: string | null;
  headcountRequestId?: string | null;
  workforcePlanId?: string | null;
  openingsCount: number;
  filledCount: number;
  employmentType: EmploymentType;
  salaryMin?: number | null;
  salaryMax?: number | null;
  justification?: string | null;
  status: RequisitionStatus;
  requestedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  workflowRequestId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobOpeningRecord {
  id: string;
  companyId: string;
  jobReference: string;
  titleAr: string;
  titleEn: string;
  departmentId?: string | null;
  departmentName?: string | null;
  jobPositionId?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  costCenterId?: string | null;
  requisitionId?: string | null;
  workforcePlanId?: string | null;
  headcountRequestId?: string | null;
  openingsCount: number;
  filledCount: number;
  employmentType: EmploymentType;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency: string;
  salaryVisibility: "exact" | "range" | "hidden";
  requirementsAr?: string | null;
  requirementsEn?: string | null;
  descriptionAr?: string | null;
  applicationStartDate?: string | null;
  applicationEndDate?: string | null;
  recruiterId?: string | null;
  recruiterName?: string | null;
  hiringManagerId?: string | null;
  status: JobOpeningStatus;
  publishedStatus: string;
  publishedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateRecord {
  id: string;
  companyId: string;
  candidateCode: string;
  jobId?: string | null;
  jobTitle?: string | null;
  requisitionId?: string | null;
  fullName: string;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  email: string;
  phone?: string | null;
  nationalId?: string | null;
  stage: CandidateStage;
  source: string;
  ratingScore: number;
  cvFileId?: string | null;
  cvUrl?: string | null;
  consentGiven: boolean;
  consentDate?: string | null;
  retentionUntil?: string | null;
  isInTalentPool: boolean;
  talentPoolNotes?: string | null;
  rejectionReason?: string | null;
  rejectionStage?: string | null;
  rejectedAt?: string | null;
  duplicateFlag: boolean;
  duplicateNotes?: string | null;
  convertedEmployeeId?: string | null;
  hiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateInterview {
  id: string;
  companyId: string;
  candidateId: string;
  candidateName?: string | null;
  jobId?: string | null;
  jobTitle?: string | null;
  interviewType: InterviewType;
  scheduledAt: string;
  durationMinutes: number;
  locationType: "in_person" | "video" | "phone";
  meetingLink?: string | null;
  status: InterviewStatus;
  notes?: string | null;
  panel: Array<{ id: string; employeeId: string; employeeName: string; role: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewScorecard {
  id: string;
  companyId: string;
  interviewId: string;
  interviewerEmployeeId: string;
  interviewerName?: string | null;
  candidateId: string;
  overallScore: number;
  recommendation: ScorecardRecommendation;
  strengths?: string | null;
  weaknesses?: string | null;
  generalFeedback?: string | null;
  submittedAt: string;
  items: Array<{
    id: string;
    criterionName: string;
    score: number;
    weightPct: number;
    comments?: string | null;
  }>;
}

export interface JobOfferRecord {
  id: string;
  companyId: string;
  offerNumber: string;
  offerCode?: string;
  offerReference?: string;
  candidateId: string;
  candidateName?: string | null;
  jobId?: string | null;
  jobTitle?: string | null;
  requisitionId?: string | null;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  totalSalary: number;
  proposedStartDate: string;
  expiryDate?: string | null;
  status: JobOfferStatus;
  offerFileId?: string | null;
  offerUrl?: string | null;
  notes?: string | null;
  preparedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  declineReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TalentPoolEntry {
  id: string;
  companyId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string | null;
  candidateCode: string;
  domainSkills: string[];
  skills?: string[];
  notes?: string | null;
  retentionConsentDate?: string | null;
  retentionExpiryDate?: string | null;
  retentionUntil?: string | null;
  addedBy?: string | null;
  createdAt: string;
}

export interface RecruitmentKpis {
  openJobs: number;
  activeRequisitions: number;
  totalCandidates: number;
  interviewsScheduled: number;
  offersPending: number;
  offersAccepted: number;
  totalHired: number;
  talentPoolCount: number;
  avgDaysToHire: number;
  totalRequisitions?: number;
  pendingRequisitions?: number;
  activeJobOpenings?: number;
  totalTargetOpenings?: number;
  pipelineCandidates?: number;
  scheduledInterviews?: number;
  completedInterviews?: number;
  totalOffers?: number;
  acceptedOffers?: number;
  hiredCount?: number;
  avgTimeToHireDays?: number;
  stageBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
}

// ============================================================================
// DATA MAPPERS
// ============================================================================

export function mapRequisition(row: Record<string, any>): RecruitmentRequisition {
  return {
    id: row.id,
    companyId: row.company_id,
    requisitionNo: row.requisition_no,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    departmentId: row.department_id,
    departmentName: row.department?.name_ar ?? row.department?.name_en,
    jobPositionId: row.job_position_id,
    costCenterId: row.cost_center_id,
    workLocationId: row.work_location_id,
    headcountRequestId: row.headcount_request_id,
    workforcePlanId: row.workforce_plan_id,
    openingsCount: Number(row.openings_count ?? 1),
    filledCount: Number(row.filled_count ?? 0),
    employmentType: (row.employment_type as EmploymentType) || "full_time",
    salaryMin: row.salary_min != null ? Number(row.salary_min) : null,
    salaryMax: row.salary_max != null ? Number(row.salary_max) : null,
    justification: row.justification,
    status: (row.status as RequisitionStatus) || "draft",
    requestedBy: row.requested_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    workflowRequestId: row.workflow_request_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapJobOpening(row: Record<string, any>): JobOpeningRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    jobReference: row.job_reference ?? `JOB-${row.id.slice(0, 8)}`,
    titleAr: row.title_ar,
    titleEn: row.title_en ?? row.title_ar,
    departmentId: row.department_id,
    departmentName: row.department?.name_ar ?? row.department?.name_en,
    jobPositionId: row.job_position_id,
    locationId: row.location_id,
    locationName: row.location?.name_ar ?? row.location?.name_en,
    costCenterId: row.cost_center_id,
    requisitionId: row.requisition_id,
    workforcePlanId: row.workforce_plan_id,
    headcountRequestId: row.headcount_request_id,
    openingsCount: Number(row.openings_count ?? 1),
    filledCount: Number(row.filled_count ?? 0),
    employmentType: (row.employment_type as EmploymentType) || "full_time",
    salaryMin: row.salary_min != null ? Number(row.salary_min) : null,
    salaryMax: row.salary_max != null ? Number(row.salary_max) : null,
    salaryCurrency: row.salary_currency ?? "SAR",
    salaryVisibility: row.salary_visibility ?? "range",
    requirementsAr: row.requirements_ar,
    requirementsEn: row.requirements_en,
    descriptionAr: row.description_ar,
    applicationStartDate: row.application_start_date,
    applicationEndDate: row.application_end_date,
    recruiterId: row.recruiter_id,
    recruiterName: row.recruiter ? `${row.recruiter.first_name_ar} ${row.recruiter.last_name_ar}` : null,
    hiringManagerId: row.hiring_manager_id,
    status: (row.status as JobOpeningStatus) || "draft",
    publishedStatus: row.published_status ?? "draft",
    publishedAt: row.published_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCandidate(row: Record<string, any>): CandidateRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    candidateCode: row.candidate_code ?? `CND-${row.id.slice(0, 8)}`,
    jobId: row.job_id,
    jobTitle: row.job?.title_ar ?? row.job?.title_en,
    requisitionId: row.requisition_id,
    fullName: row.full_name,
    firstNameAr: row.first_name_ar,
    lastNameAr: row.last_name_ar,
    email: row.email,
    phone: row.phone,
    nationalId: row.national_id,
    stage: (row.stage as CandidateStage) || "applied",
    source: row.source ?? "website",
    ratingScore: Number(row.rating_score ?? 0),
    cvFileId: row.cv_file_id,
    cvUrl: row.cv_url,
    consentGiven: Boolean(row.consent_given),
    consentDate: row.consent_date,
    retentionUntil: row.retention_until,
    isInTalentPool: Boolean(row.is_in_talent_pool),
    talentPoolNotes: row.talent_pool_notes,
    rejectionReason: row.rejection_reason,
    rejectionStage: row.rejection_stage,
    rejectedAt: row.rejected_at,
    duplicateFlag: Boolean(row.duplicate_flag),
    duplicateNotes: row.duplicate_notes,
    convertedEmployeeId: row.converted_employee_id,
    hiredAt: row.hired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapInterview(row: Record<string, any>): CandidateInterview {
  const panel = (row.interview_panels ?? []).map((p: any) => ({
    id: p.id,
    employeeId: p.interviewer_employee_id,
    employeeName: p.employee ? `${p.employee.first_name_ar} ${p.employee.last_name_ar}` : "محاور",
    role: p.role ?? "interviewer",
  }));

  return {
    id: row.id,
    companyId: row.company_id,
    candidateId: row.candidate_id,
    candidateName: row.candidate?.full_name,
    jobId: row.job_id,
    jobTitle: row.job?.title_ar ?? row.job?.title_en,
    interviewType: (row.interview_type as InterviewType) || "technical",
    scheduledAt: row.scheduled_at,
    durationMinutes: Number(row.duration_minutes ?? 45),
    locationType: row.location_type || "video",
    meetingLink: row.meeting_link,
    status: (row.status as InterviewStatus) || "scheduled",
    notes: row.notes,
    panel,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapJobOffer(row: Record<string, any>): JobOfferRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    offerNumber: row.offer_number ?? `OFF-${row.id.slice(0, 8)}`,
    offerCode: row.offer_code ?? row.offer_number ?? `OFF-${row.id.slice(0, 8)}`,
    offerReference: row.offer_code ?? row.offer_number ?? `OFF-${row.id.slice(0, 8)}`,
    candidateId: row.candidate_id,
    candidateName: row.candidate?.full_name,
    jobId: row.job_id,
    jobTitle: row.job?.title_ar ?? row.job?.title_en,
    requisitionId: row.requisition_id,
    basicSalary: Number(row.basic_salary ?? 0),
    housingAllowance: Number(row.housing_allowance ?? 0),
    transportAllowance: Number(row.transport_allowance ?? 0),
    otherAllowances: Number(row.other_allowances ?? 0),
    totalSalary: Number(row.total_salary ?? 0),
    proposedStartDate: row.proposed_start_date,
    expiryDate: row.expiry_date,
    status: (row.status as JobOfferStatus) || "draft",
    offerFileId: row.offer_file_id,
    offerUrl: row.offer_url,
    notes: row.notes,
    preparedBy: row.prepared_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    declineReason: row.decline_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTalentPool(row: Record<string, any>): TalentPoolEntry {
  const skillsList = Array.isArray(row.skills) ? row.skills : Array.isArray(row.domain_skills) ? row.domain_skills : [];
  return {
    id: row.id,
    companyId: row.company_id,
    candidateId: row.candidate_id,
    candidateName: row.candidate?.full_name ?? "مرشح",
    candidateEmail: row.candidate?.email ?? "",
    candidatePhone: row.candidate?.phone,
    candidateCode: row.candidate?.candidate_code ?? "",
    domainSkills: skillsList,
    skills: skillsList,
    notes: row.notes,
    retentionConsentDate: row.retention_consent_date,
    retentionExpiryDate: row.retention_expiry_date ?? row.retention_until,
    retentionUntil: row.retention_until ?? row.retention_expiry_date,
    addedBy: row.added_by,
    createdAt: row.created_at,
  };
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

export function useRecruitmentRequisitions(filters?: { status?: RequisitionStatus; departmentId?: string; companyId?: string }) {
  return useQuery({
    queryKey: queryKeys.recruitment.requisitions(filters),
    queryFn: async () => {
      let query = db
        .from("recruitment_requisitions")
        .select(`
          *,
          department:departments(name_ar, name_en)
        `)
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.departmentId) {
        query = query.eq("department_id", filters.departmentId);
      }
      if (filters?.companyId) {
        query = query.eq("company_id", filters.companyId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRequisition);
    },
  });
}

export function useJobOpenings(filters?: { status?: JobOpeningStatus; departmentId?: string; companyId?: string }) {
  return useQuery({
    queryKey: queryKeys.recruitment.openings(filters),
    queryFn: async () => {
      let query = db
        .from("job_openings")
        .select(`
          *,
          department:departments(name_ar, name_en),
          location:work_locations(name_ar, name_en),
          recruiter:employees!job_openings_recruiter_id_fkey(first_name_ar, last_name_ar)
        `)
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.departmentId) {
        query = query.eq("department_id", filters.departmentId);
      }
      if (filters?.companyId) {
        query = query.eq("company_id", filters.companyId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapJobOpening);
    },
  });
}

export function useJobOpening(id: string | null) {
  return useQuery({
    queryKey: queryKeys.recruitment.opening(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await db
        .from("job_openings")
        .select(`
          *,
          department:departments(name_ar, name_en),
          location:work_locations(name_ar, name_en),
          recruiter:employees!job_openings_recruiter_id_fkey(first_name_ar, last_name_ar)
        `)
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return mapJobOpening(data);
    },
  });
}

export interface CandidateFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  jobId?: string;
  stage?: CandidateStage | "all";
  source?: string;
}

export function useCandidates(filters?: CandidateFilters) {
  return useQuery({
    queryKey: queryKeys.recruitment.candidates(filters as Record<string, unknown>),
    queryFn: async () => {
      const page = filters?.page ?? 1;
      const pageSize = filters?.pageSize ?? 50;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = db
        .from("candidates")
        .select(`
          *,
          job:job_openings(title_ar, title_en)
        `, { count: "exact" })
        .range(from, to)
        .order("created_at", { ascending: false });

      if (filters?.jobId && filters.jobId !== "all") {
        query = query.eq("job_id", filters.jobId);
      }
      if (filters?.stage && filters.stage !== "all") {
        query = query.eq("stage", filters.stage);
      }
      if (filters?.source && filters.source !== "all") {
        query = query.eq("source", filters.source);
      }
      if (filters?.search?.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(`full_name.ilike.${term},email.ilike.${term},candidate_code.ilike.${term}`);
      }

      const { data, count, error } = await query;
      if (error) throw new Error(error.message);
      return {
        candidates: (data ?? []).map(mapCandidate),
        totalCount: count ?? 0,
        page,
        pageSize,
      };
    },
  });
}

export function useCandidate(id: string | null) {
  return useQuery({
    queryKey: queryKeys.recruitment.candidate(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await db
        .from("candidates")
        .select(`
          *,
          job:job_openings(title_ar, title_en)
        `)
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return mapCandidate(data);
    },
  });
}

export function useCandidatePipeline(params?: string | { jobId?: string; companyId?: string }) {
  const jobId = typeof params === "string" ? params : params?.jobId;
  const companyId = typeof params === "object" ? params?.companyId : undefined;
  return useQuery({
    queryKey: queryKeys.recruitment.pipeline({ jobId, companyId }),
    queryFn: async () => {
      let query = db
        .from("candidates")
        .select(`
          *,
          job:job_openings(title_ar, title_en)
        `)
        .order("created_at", { ascending: false });

      if (jobId && jobId !== "all") {
        query = query.eq("job_id", jobId);
      }
      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapCandidate);
    },
  });
}

export function useInterviews(filters?: { status?: InterviewStatus; candidateId?: string; companyId?: string }) {
  return useQuery({
    queryKey: queryKeys.recruitment.interviews(filters),
    queryFn: async () => {
      let query = db
        .from("candidate_interviews")
        .select(`
          *,
          candidate:candidates(full_name),
          job:job_openings(title_ar, title_en),
          interview_panels (
            id,
            interviewer_employee_id,
            role,
            employee:employees(first_name_ar, last_name_ar)
          )
        `)
        .order("scheduled_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.candidateId) {
        query = query.eq("candidate_id", filters.candidateId);
      }
      if (filters?.companyId) {
        query = query.eq("company_id", filters.companyId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapInterview);
    },
  });
}

export function useInterviewScorecards(filters?: { interviewId?: string; candidateId?: string; companyId?: string }) {
  return useQuery({
    queryKey: queryKeys.recruitment.scorecards(filters),
    queryFn: async () => {
      let query = db
        .from("interview_scorecards")
        .select(`
          *,
          interview_scorecard_items(*)
        `)
        .order("submitted_at", { ascending: false });

      if (filters?.interviewId) {
        query = query.eq("interview_id", filters.interviewId);
      }
      if (filters?.candidateId) {
        query = query.eq("candidate_id", filters.candidateId);
      }
      if (filters?.companyId) {
        query = query.eq("company_id", filters.companyId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useJobOffers(filters?: { status?: JobOfferStatus; candidateId?: string; companyId?: string }) {
  return useQuery({
    queryKey: queryKeys.recruitment.offers(filters),
    queryFn: async () => {
      let query = db
        .from("job_offers")
        .select(`
          *,
          candidate:candidates(full_name),
          job:job_openings(title_ar, title_en)
        `)
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.candidateId) {
        query = query.eq("candidate_id", filters.candidateId);
      }
      if (filters?.companyId) {
        query = query.eq("company_id", filters.companyId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapJobOffer);
    },
  });
}

export function useTalentPool(filters?: { search?: string; companyId?: string }) {
  return useQuery({
    queryKey: queryKeys.recruitment.talentPool(filters),
    queryFn: async () => {
      let query = db
        .from("talent_pool_entries")
        .select(`
          *,
          candidate:candidates(full_name, email, phone, candidate_code)
        `)
        .order("created_at", { ascending: false });

      if (filters?.companyId) {
        query = query.eq("company_id", filters.companyId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapTalentPool);
    },
  });
}

export function useRecruitmentKpis(companyId?: string | null) {
  return useQuery({
    queryKey: queryKeys.recruitment.kpis(companyId),
    enabled: Boolean(companyId),
    queryFn: async (): Promise<RecruitmentKpis> => {
      const { data, error } = await db.rpc("get_recruitment_kpis_atomic", {
        p_company_id: companyId,
      });
      if (error) throw new Error(error.message);
      const res = data as Record<string, any>;
      const openJobs = Number(res.open_jobs ?? 0);
      const activeRequisitions = Number(res.active_requisitions ?? 0);
      const totalCandidates = Number(res.total_candidates ?? 0);
      const interviewsScheduled = Number(res.interviews_scheduled ?? 0);
      const offersPending = Number(res.offers_pending ?? 0);
      const offersAccepted = Number(res.offers_accepted ?? 0);
      const totalHired = Number(res.total_hired ?? 0);
      const talentPoolCount = Number(res.talent_pool_count ?? 0);
      const avgDaysToHire = Number(res.avg_days_to_hire ?? 0);

      return {
        openJobs,
        activeRequisitions,
        totalCandidates,
        interviewsScheduled,
        offersPending,
        offersAccepted,
        totalHired,
        talentPoolCount,
        avgDaysToHire,
        totalRequisitions: activeRequisitions,
        pendingRequisitions: Number(res.pending_requisitions ?? 0),
        activeJobOpenings: openJobs,
        totalTargetOpenings: Number(res.total_target_openings ?? openJobs),
        pipelineCandidates: totalCandidates - totalHired,
        scheduledInterviews: interviewsScheduled,
        completedInterviews: Number(res.completed_interviews ?? 0),
        totalOffers: offersPending + offersAccepted,
        acceptedOffers: offersAccepted,
        hiredCount: totalHired,
        avgTimeToHireDays: avgDaysToHire,
        stageBreakdown: (res.stage_breakdown as Record<string, number>) ?? {},
        sourceBreakdown: (res.source_breakdown as Record<string, number>) ?? {},
      };
    },
  });
}

// Approved hiring requests from Workforce Planning engine
export function useHiringRequests() {
  return useQuery({
    queryKey: queryKeys.recruitment.hiringRequests(),
    queryFn: async () => {
      const { data, error } = await db
        .from("headcount_requests")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
// Query hook aliases
export const useRecruitmentRequisitionsQuery = useRecruitmentRequisitions;
export const useJobOpeningsQuery = useJobOpenings;
export const useCandidatesQuery = useCandidates;
export const useCandidatePipelineQuery = useCandidatePipeline;
export const useCandidateInterviews = useInterviews;
export const useCandidateInterviewsQuery = useCandidateInterviews;
export const useInterviewScorecardsQuery = useInterviewScorecards;
export const useJobOffersQuery = useJobOffers;
export const useTalentPoolQuery = useTalentPool;
export const useRecruitmentKpisQuery = useRecruitmentKpis;
export const useHiringRequestsQuery = useHiringRequests;

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export function useRecruitmentRepositoryMutations() {
  const queryClient = useQueryClient();

  const invalidateRecruitment = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.all });
  };

  const createRequisition = useMutation({
    mutationFn: async (params: {
      companyId: string;
      titleAr: string;
      titleEn?: string;
      departmentId?: string;
      jobPositionId?: string;
      costCenterId?: string;
      workLocationId?: string;
      headcountRequestId?: string;
      workforcePlanId?: string;
      openingsCount?: number;
      employmentType?: string;
      salaryMin?: number;
      salaryMax?: number;
      justification?: string;
    }) => {
      const { data, error } = await db.rpc("create_recruitment_requisition_atomic", {
        p_company_id: params.companyId,
        p_title_ar: params.titleAr,
        p_title_en: params.titleEn ?? null,
        p_department_id: params.departmentId ?? null,
        p_job_position_id: params.jobPositionId ?? null,
        p_cost_center_id: params.costCenterId ?? null,
        p_work_location_id: params.workLocationId ?? null,
        p_headcount_request_id: params.headcountRequestId ?? null,
        p_workforce_plan_id: params.workforcePlanId ?? null,
        p_openings_count: params.openingsCount ?? 1,
        p_employment_type: params.employmentType ?? "full_time",
        p_salary_min: params.salaryMin ?? null,
        p_salary_max: params.salaryMax ?? null,
        p_justification: params.justification ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "create_requisition_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  const approveRequisition = useMutation({
    mutationFn: async (params: {
      requisitionId: string;
      companyId: string;
      action: "approve" | "reject";
      reason?: string;
    }) => {
      const { data, error } = await db.rpc("approve_recruitment_requisition_atomic", {
        p_requisition_id: params.requisitionId,
        p_company_id: params.companyId,
        p_action: params.action,
        p_reason: params.reason ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "approve_requisition_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  const createJobOpening = useMutation({
    mutationFn: async (params: {
      companyId: string;
      titleAr: string;
      titleEn?: string;
      departmentId?: string;
      jobPositionId?: string;
      locationId?: string;
      costCenterId?: string;
      requisitionId?: string;
      workforcePlanId?: string;
      headcountRequestId?: string;
      openingsCount?: number;
      employmentType?: string;
      salaryMin?: number;
      salaryMax?: number;
      salaryVisibility?: string;
      descriptionAr?: string;
      requirementsAr?: string;
      applicationStartDate?: string;
      applicationEndDate?: string;
      recruiterId?: string;
      hiringManagerId?: string;
    }) => {
      const { data, error } = await db.rpc("create_job_opening_atomic", {
        p_company_id: params.companyId,
        p_title_ar: params.titleAr,
        p_title_en: params.titleEn ?? null,
        p_department_id: params.departmentId ?? null,
        p_job_position_id: params.jobPositionId ?? null,
        p_location_id: params.locationId ?? null,
        p_cost_center_id: params.costCenterId ?? null,
        p_requisition_id: params.requisitionId ?? null,
        p_workforce_plan_id: params.workforcePlanId ?? null,
        p_headcount_request_id: params.headcountRequestId ?? null,
        p_openings_count: params.openingsCount ?? 1,
        p_employment_type: params.employmentType ?? "full_time",
        p_salary_min: params.salaryMin ?? null,
        p_salary_max: params.salaryMax ?? null,
        p_salary_visibility: params.salaryVisibility ?? "range",
        p_description_ar: params.descriptionAr ?? null,
        p_requirements_ar: params.requirementsAr ?? null,
        p_application_start_date: params.applicationStartDate ?? null,
        p_application_end_date: params.applicationEndDate ?? null,
        p_recruiter_id: params.recruiterId ?? null,
        p_hiring_manager_id: params.hiringManagerId ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "create_job_opening_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  const publishJobOpening = useMutation({
    mutationFn: async (params: {
      jobId: string;
      companyId: string;
      action: "publish" | "pause" | "close";
    }) => {
      const { data, error } = await db.rpc("publish_job_opening_atomic", {
        p_job_id: params.jobId,
        p_company_id: params.companyId,
        p_action: params.action,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "publish_job_opening_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  const applyCandidate = useMutation({
    mutationFn: async (params: {
      companyId: string;
      jobId: string;
      fullName: string;
      email: string;
      phone?: string;
      nationalId?: string;
      source?: string;
      cvFileId?: string;
      cvUrl?: string;
      consentGiven?: boolean;
    }) => {
      const { data, error } = await db.rpc("apply_candidate_atomic", {
        p_company_id: params.companyId,
        p_job_id: params.jobId,
        p_full_name: params.fullName,
        p_email: params.email,
        p_phone: params.phone ?? null,
        p_national_id: params.nationalId ?? null,
        p_source: params.source ?? "website",
        p_cv_file_id: params.cvFileId ?? null,
        p_cv_url: params.cvUrl ?? null,
        p_consent_given: params.consentGiven ?? true,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "apply_candidate_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  const moveCandidateStage = useMutation({
    mutationFn: async (params: {
      candidateId: string;
      companyId: string;
      newStage: CandidateStage;
      reason?: string;
    }) => {
      const { data, error } = await db.rpc("move_candidate_stage_atomic", {
        p_candidate_id: params.candidateId,
        p_company_id: params.companyId,
        p_new_stage: params.newStage,
        p_reason: params.reason ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "move_stage_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  const scheduleInterview = useMutation({
    mutationFn: async (params: {
      companyId: string;
      candidateId: string;
      jobId: string;
      interviewType: string;
      scheduledAt: string;
      durationMinutes?: number;
      locationType?: string;
      meetingLink?: string;
      notes?: string;
      interviewerIds?: string[];
    }) => {
      const { data, error } = await db.rpc("schedule_interview_atomic", {
        p_company_id: params.companyId,
        p_candidate_id: params.candidateId,
        p_job_id: params.jobId,
        p_interview_type: params.interviewType,
        p_scheduled_at: params.scheduledAt,
        p_duration_minutes: params.durationMinutes ?? 45,
        p_location_type: params.locationType ?? "video",
        p_meeting_link: params.meetingLink ?? null,
        p_notes: params.notes ?? null,
        p_interviewer_ids: params.interviewerIds ?? [],
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "schedule_interview_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  const submitScorecard = useMutation({
    mutationFn: async (params: {
      companyId: string;
      interviewId: string;
      candidateId: string;
      recommendation: ScorecardRecommendation;
      strengths?: string;
      weaknesses?: string;
      generalFeedback?: string;
      criteria?: Array<{ criterion_name: string; score: number; weight_pct?: number; comments?: string }>;
    }) => {
      const { data, error } = await db.rpc("submit_scorecard_atomic", {
        p_company_id: params.companyId,
        p_interview_id: params.interviewId,
        p_candidate_id: params.candidateId,
        p_recommendation: params.recommendation,
        p_strengths: params.strengths ?? null,
        p_weaknesses: params.weaknesses ?? null,
        p_general_feedback: params.generalFeedback ?? null,
        p_criteria: JSON.stringify(params.criteria ?? []),
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "submit_scorecard_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  const createJobOffer = useMutation({
    mutationFn: async (params: {
      companyId: string;
      candidateId: string;
      basicSalary: number;
      housingAllowance?: number;
      transportAllowance?: number;
      otherAllowances?: number;
      proposedStartDate?: string;
      expiryDate?: string;
      jobId?: string;
      requisitionId?: string;
      notes?: string;
    }) => {
      const { data, error } = await db.rpc("create_job_offer_atomic", {
        p_company_id: params.companyId,
        p_candidate_id: params.candidateId,
        p_basic_salary: params.basicSalary,
        p_housing_allowance: params.housingAllowance ?? 0,
        p_transport_allowance: params.transportAllowance ?? 0,
        p_other_allowances: params.otherAllowances ?? 0,
        p_proposed_start_date: params.proposedStartDate ?? null,
        p_expiry_date: params.expiryDate ?? null,
        p_job_id: params.jobId ?? null,
        p_requisition_id: params.requisitionId ?? null,
        p_notes: params.notes ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "create_offer_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  const updateOfferStatus = useMutation({
    mutationFn: async (params: {
      offerId: string;
      companyId: string;
      action: "approve" | "send" | "accept" | "decline" | "withdraw";
      reason?: string;
    }) => {
      const { data, error } = await db.rpc("update_offer_status_atomic", {
        p_offer_id: params.offerId,
        p_company_id: params.companyId,
        p_action: params.action,
        p_reason: params.reason ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "update_offer_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  const convertCandidateToEmployee = useMutation({
    mutationFn: async (params: {
      candidateId: string;
      companyId: string;
      firstNameAr: string;
      lastNameAr: string;
      departmentId: string;
      workLocationId: string;
      hireDate: string;
      contractType?: ContractType;
      workType?: WorkType;
      basicSalary?: number;
      housingAllowance?: number;
      transportAllowance?: number;
      jobPositionId?: string;
    }) => {
      const { data, error } = await db.rpc("convert_candidate_to_employee_atomic", {
        p_candidate_id: params.candidateId,
        p_company_id: params.companyId,
        p_first_name_ar: params.firstNameAr,
        p_last_name_ar: params.lastNameAr,
        p_department_id: params.departmentId,
        p_work_location_id: params.workLocationId,
        p_hire_date: params.hireDate,
        p_contract_type: params.contractType ?? "full_time",
        p_work_type: params.workType ?? "on_site",
        p_basic_salary: params.basicSalary ?? null,
        p_housing_allowance: params.housingAllowance ?? null,
        p_transport_allowance: params.transportAllowance ?? null,
        p_job_position_id: params.jobPositionId ?? null,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "conversion_failed", "backend");
      return res;
    },
    onSuccess: () => {
      invalidateRecruitment();
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    },
  });

  const addToTalentPool = useMutation({
    mutationFn: async (params: {
      companyId: string;
      candidateId: string;
      skills?: string[];
      notes?: string;
      retentionMonths?: number;
    }) => {
      const { data, error } = await db.rpc("add_to_talent_pool_atomic", {
        p_company_id: params.companyId,
        p_candidate_id: params.candidateId,
        p_skills: params.skills ?? [],
        p_notes: params.notes ?? null,
        p_retention_months: params.retentionMonths ?? 12,
      });
      if (error) throw new AppMutationError(error.message, "backend", { code: error.code });
      const res = data as Record<string, any>;
      if (!res.ok) throw new AppMutationError(res.error ?? "talent_pool_failed", "backend");
      return res;
    },
    onSuccess: () => invalidateRecruitment(),
  });

  return {
    createRequisition,
    approveRequisition,
    createJobOpening,
    publishJobOpening,
    applyCandidate,
    moveCandidateStage,
    scheduleInterview,
    submitScorecard,
    createJobOffer,
    updateOfferStatus,
    convertCandidateToEmployee,
    addToTalentPool,
  };
}
