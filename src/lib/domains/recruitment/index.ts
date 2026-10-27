/**
 * Recruitment, ATS, Offers & Hiring Engine Domain Facade
 * Delegates to recruitment-repository.ts via executeReliableMutation
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import type {
  Candidate,
  CandidateStage,
  JobOffer,
  JobOpening,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  useRecruitmentKpisQuery,
  useRecruitmentRequisitionsQuery,
  useJobOpeningsQuery,
  useCandidatesQuery,
  useCandidatePipelineQuery,
  useCandidateInterviewsQuery,
  useInterviewScorecardsQuery,
  useJobOffersQuery,
  useTalentPoolQuery,
  useRecruitmentRepositoryMutations,
  type RecruitmentRequisition,
  type JobOpeningRecord,
  type CandidateRecord,
  type CandidateInterview,
  type InterviewPanel,
  type InterviewScorecard,
  type CandidateAssessment,
  type JobOfferRecord,
  type TalentPoolEntry,
  type RecruitmentKpis,
  type RequisitionStatus,
  type JobOpeningStatus,
  type InterviewType,
  type InterviewStatus,
  type ScorecardRecommendation,
  type JobOfferStatus,
  type EmploymentType,
  type WorkType,
} from "../../data/recruitment-repository";
import { executeReliableMutation } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { uploadCandidateCvFile, uploadJobOfferFile, rollbackUploadedFile } from "../../storage";
import {
  convertDemoCandidate,
  validateCandidateConversion,
  type CandidateConversionInput,
} from "./candidate-conversion";

// Re-export repository hooks and types for direct use
export {
  useRecruitmentKpisQuery,
  useRecruitmentRequisitionsQuery,
  useJobOpeningsQuery,
  useCandidatesQuery,
  useCandidatePipelineQuery,
  useCandidateInterviewsQuery,
  useInterviewScorecardsQuery,
  useJobOffersQuery,
  useTalentPoolQuery,
  useRecruitmentRepositoryMutations,
};

export type {
  RecruitmentRequisition,
  JobOpeningRecord,
  CandidateRecord,
  CandidateInterview,
  InterviewPanel,
  InterviewScorecard,
  CandidateAssessment,
  JobOfferRecord,
  TalentPoolEntry,
  RecruitmentKpis,
  RequisitionStatus,
  JobOpeningStatus,
  InterviewType,
  InterviewStatus,
  ScorecardRecommendation,
  JobOfferStatus,
  EmploymentType,
  WorkType,
};

export {
  convertDemoCandidate,
  validateCandidateConversion,
  type CandidateConversionInput,
};

/**
 * Unified Recruitment Domain Hook
 * Provides reliable, server-authoritative mutations.
 */
export function useRecruitmentDomain(explicitCompanyId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const repoMutations = useRecruitmentRepositoryMutations();

  const activeCompanyId =
    explicitCompanyId ||
    session?.user?.user_metadata?.company_id ||
    "00000000-0000-0000-0000-000000000001";

  // Requisitions
  const createRequisition = useCallback(
    async (params: {
      titleAr: string;
      titleEn?: string;
      departmentId?: string;
      jobPositionId?: string;
      openingsCount: number;
      employmentType?: string;
      salaryMin?: number;
      salaryMax?: number;
      justification?: string;
      workforcePlanId?: string;
      headcountRequestId?: string;
    }) => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `create-requisition-${params.titleAr}-${Date.now()}`,
        operation: async () => {
          const res = await repoMutations.createRequisition.mutateAsync({
            companyId: activeCompanyId,
            ...params,
          });
          return res;
        },
        onCommitted: () => {
          toast.success("تم إنشاء طلب الاحتياج الوظيفي بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إنشاء طلب الاحتياج");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.createRequisition],
  );

  const approveRequisition = useCallback(
    async (params: { requisitionId: string; decision: "approve" | "reject"; reason?: string }) => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `approve-requisition-${params.requisitionId}-${params.decision}`,
        operation: async () => {
          const res = await repoMutations.approveRequisition.mutateAsync({
            companyId: activeCompanyId,
            requisitionId: params.requisitionId,
            action: params.decision,
            reason: params.reason,
          });
          return res;
        },
        onCommitted: () => {
          toast.success(
            params.decision === "approve"
              ? "تمت الموافقة على طلب الاحتياج الوظيفي بنجاح"
              : "تم رفض طلب الاحتياج الوظيفي",
          );
        },
        onRejected: (err) => {
          toast.error(err.message || "فشلت معالجة اعتماد طلب الاحتياج");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.approveRequisition],
  );

  // Job Openings
  const createJobOpening = useCallback(
    async (params: {
      titleAr: string;
      titleEn?: string;
      departmentId?: string;
      locationId?: string;
      requisitionId?: string;
      openingsCount: number;
      employmentType?: string;
      salaryMin?: number;
      salaryMax?: number;
      salaryCurrency?: string;
      salaryVisibility?: "exact" | "range" | "hidden";
      requirementsAr?: string;
      descriptionAr?: string;
      recruiterId?: string;
      hiringManagerId?: string;
    }) => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `create-job-opening-${params.titleAr}-${Date.now()}`,
        operation: async () => {
          const res = await repoMutations.createJobOpening.mutateAsync({
            companyId: activeCompanyId,
            ...params,
          });
          return res;
        },
        onCommitted: () => {
          toast.success("تم إنشاء الوظيفة الشاغرة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ الوظيفة");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.createJobOpening],
  );

  const publishJobOpening = useCallback(
    async (params: { jobId: string; action: "publish" | "pause" | "close" }) => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `publish-job-opening-${params.jobId}-${params.action}`,
        operation: async () => {
          const res = await repoMutations.publishJobOpening.mutateAsync({
            companyId: activeCompanyId,
            ...params,
          });
          return res;
        },
        onCommitted: () => {
          const labels: Record<string, string> = {
            publish: "تم نشر الوظيفة واستقبال المتقدمين بنجاح",
            pause: "تم إيقاف النشر مؤقتاً للوظيفة",
            close: "تم إغلاق الوظيفة الشاغرة",
          };
          toast.success(labels[params.action] || "تم تحديث حالة الوظيفة");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث حالة الوظيفة");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.publishJobOpening],
  );

  // Candidates & Applications
  const applyCandidate = useCallback(
    async (
      candidate: {
        jobId: string;
        fullName: string;
        email: string;
        phone?: string;
        nationalId?: string;
        source?: string;
        consentGiven?: boolean;
      },
      cvFile?: File,
    ) => {
      let cvFileId: string | undefined;
      let cvUrl: string | undefined;

      if (cvFile) {
        try {
          const uploaded = await uploadCandidateCvFile({
            candidateId: `cand-upload-${Date.now()}`,
            file: cvFile,
          });
          cvFileId = uploaded.id;
          cvUrl = uploaded.object_path;
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "فشل رفع السيرة الذاتية";
          toast.error(msg);
          return { ok: false, error: msg };
        }
      }

      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `apply-candidate-${candidate.email}-${candidate.jobId}`,
        operation: async () => {
          try {
            return await repoMutations.applyCandidate.mutateAsync({
              companyId: activeCompanyId,
              ...candidate,
              cvFileId,
              cvUrl,
            });
          } catch (insertErr) {
            if (cvFileId) {
              await rollbackUploadedFile({ fileId: cvFileId }).catch((rbErr) =>
                console.error("Rollback of uploaded candidate CV failed:", rbErr),
              );
            }
            throw insertErr;
          }
        },
        onCommitted: () => {
          toast.success("تم استلام طلب التقديم وإدراجه في مرحلة الفرز الأولي");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إرسال طلب التقديم");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.applyCandidate],
  );

  const moveCandidateStage = useCallback(
    async (params: { candidateId: string; newStage: CandidateStage; reason?: string }) => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `move-stage-${params.candidateId}-${params.newStage}`,
        operation: async () => {
          const res = await repoMutations.moveCandidateStage.mutateAsync({
            companyId: activeCompanyId,
            ...params,
          });
          return res;
        },
        onCommitted: () => {
          toast.success(`تم نقل المرشح بنجاح إلى مرحلة: ${params.newStage}`);
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر نقل مرحلة المرشح");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.moveCandidateStage],
  );

  // Interviews & Scorecards
  const scheduleInterview = useCallback(
    async (params: {
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
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `schedule-interview-${params.candidateId}-${params.scheduledAt}`,
        operation: async () => {
          const res = await repoMutations.scheduleInterview.mutateAsync({
            companyId: activeCompanyId,
            ...params,
          });
          return res;
        },
        onCommitted: () => {
          toast.success("تم جدولة المقابلة وإشعار لجنة المقابلات بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر جدولة المقابلة");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.scheduleInterview],
  );

  const submitScorecard = useCallback(
    async (params: {
      interviewId: string;
      candidateId: string;
      recommendation: ScorecardRecommendation;
      strengths?: string;
      weaknesses?: string;
      generalFeedback?: string;
      criteria?: Array<{ criterion_name: string; score: number; weight_pct?: number; comments?: string }>;
    }) => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `submit-scorecard-${params.interviewId}`,
        operation: async () => {
          const res = await repoMutations.submitScorecard.mutateAsync({
            companyId: activeCompanyId,
            ...params,
          });
          return res;
        },
        onCommitted: () => {
          toast.success("تم حفظ بطاقة تقييم المقابلة وتحديث سجل المرشح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر اعتماد بطاقة التقييم");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.submitScorecard],
  );

  // Offers
  const createJobOffer = useCallback(
    async (
      params: {
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
      },
      offerFile?: File,
    ) => {
      let offerFileId: string | undefined;

      if (offerFile) {
        try {
          const uploaded = await uploadJobOfferFile({
            offerId: `off-upload-${Date.now()}`,
            candidateId: params.candidateId,
            file: offerFile,
          });
          offerFileId = uploaded.id;
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "فشل رفع وثيقة العرض";
          toast.error(msg);
          return { ok: false, error: msg };
        }
      }

      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `create-offer-${params.candidateId}-${Date.now()}`,
        operation: async () => {
          try {
            return await repoMutations.createJobOffer.mutateAsync({
              companyId: activeCompanyId,
              ...params,
            });
          } catch (err) {
            if (offerFileId) {
              await rollbackUploadedFile({ fileId: offerFileId }).catch((rbErr) =>
                console.error("Rollback of uploaded job offer failed:", rbErr),
              );
            }
            throw err;
          }
        },
        onCommitted: () => {
          toast.success("تم إنشاء مسودة العرض الوظيفي بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إنشاء العرض الوظيفي");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.createJobOffer],
  );

  const updateOfferStatus = useCallback(
    async (params: {
      offerId: string;
      action: "approve" | "send" | "accept" | "decline" | "withdraw";
      reason?: string;
    }) => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `update-offer-${params.offerId}-${params.action}`,
        operation: async () => {
          const res = await repoMutations.updateOfferStatus.mutateAsync({
            companyId: activeCompanyId,
            ...params,
          });
          return res;
        },
        onCommitted: () => {
          const labels: Record<string, string> = {
            approve: "تم اعتماد العرض الوظيفي بنجاح",
            send: "تم إرسال العرض الوظيفي للمرشح",
            accept: "تم تسجيل قبول المرشح للعرض الوظيفي بنجاح",
            decline: "تم تسجيل اعتذار المرشح عن العرض",
            withdraw: "تم سحب العرض الوظيفي",
          };
          toast.success(labels[params.action] || "تم تحديث حالة العرض");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث حالة العرض الوظيفي");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.updateOfferStatus],
  );

  // Candidate -> Employee Conversion
  const convertCandidateToEmployee = useCallback(
    async (input: CandidateConversionInput): Promise<boolean> => {
      try {
        validateCandidateConversion(input);
        const result = await executeReliableMutation({
          mode: "live",
          mutationKey: `convert-candidate-${input.candidateId}`,
          operation: async () => {
            const res = await repoMutations.convertCandidateToEmployee.mutateAsync({
              companyId: activeCompanyId,
              candidateId: input.candidateId,
              firstNameAr: input.firstNameAr,
              lastNameAr: input.lastNameAr,
              departmentId: input.departmentId,
              workLocationId: input.workLocationId,
              hireDate: input.hireDate,
              contractType: input.contractType,
              workType: input.workType,
              basicSalary: input.basicSalary,
              housingAllowance: input.housingAllowance,
              transportAllowance: input.transportAllowance,
            });
            return res;
          },
          onRejected: (err) => {
            toast.error(err.message);
          },
        });
        if (!result.ok) return false;

        const refresh = await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all }),
        ]);
        toast.success("تم تحويل المرشح وإنشاء مسودة الموظف وتوليد الرقم الوظيفي بنجاح");
        if (refresh.some((r) => r.status === "rejected")) {
          toast.warning("تم الحفظ؛ يرجى تحديث الصفحة لعرض أحدث البيانات");
        }
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تحويل المرشح");
        return false;
      }
    },
    [activeCompanyId, queryClient, repoMutations.convertCandidateToEmployee],
  );

  // Talent Pool
  const addToTalentPool = useCallback(
    async (params: {
      candidateId: string;
      skills?: string[];
      notes?: string;
      retentionMonths?: number;
    }) => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `add-talent-pool-${params.candidateId}`,
        operation: async () => {
          const res = await repoMutations.addToTalentPool.mutateAsync({
            companyId: activeCompanyId,
            ...params,
          });
          return res;
        },
        onCommitted: () => {
          toast.success("تم إدراج المرشح في بنك المواهب وتوثيق مدة الاحتفاظ بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة المرشح لبنك المواهب");
        },
      });
      return result;
    },
    [activeCompanyId, repoMutations.addToTalentPool],
  );

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

/**
 * Backward compatibility hook for existing views and components
 */
export function useRecruitment() {
  const bootstrap = useBootstrapData();

  return {
    jobOpenings: bootstrap.jobOpenings,
    candidates: bootstrap.candidates,
    jobOffers: bootstrap.jobOffers,
    workforcePlans: bootstrap.workforcePlans,
    isLoading: bootstrap.isLoading,
    isError: bootstrap.isError,
    error: bootstrap.error,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useRecruitmentMutations() {
  const domain = useRecruitmentDomain();

  const addJobOpening = useCallback(
    async (job: Omit<JobOpening, "id">): Promise<boolean> => {
      const res = await domain.createJobOpening({
        titleAr: job.titleAr,
        titleEn: job.titleEn,
        departmentId: job.departmentId,
        locationId: job.locationId,
        openingsCount: job.openingsCount,
        employmentType: job.employmentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        requirementsAr: job.requirementsAr,
        descriptionAr: job.descriptionAr,
      });
      return res.ok;
    },
    [domain],
  );

  const addCandidate = useCallback(
    async (candidate: Omit<Candidate, "id">, cvFile?: File): Promise<boolean> => {
      const res = await domain.applyCandidate(
        {
          jobId: candidate.jobId,
          fullName: candidate.fullName,
          email: candidate.email,
          phone: candidate.phone,
          source: candidate.source,
        },
        cvFile,
      );
      return res.ok;
    },
    [domain],
  );

  const updateCandidateScore = useCallback(
    async (_candidateId: string, _score: number): Promise<boolean> => {
      return true;
    },
    [],
  );

  const moveCandidateStage = useCallback(
    async (candidateId: string, newStage: CandidateStage): Promise<boolean> => {
      const res = await domain.moveCandidateStage({ candidateId, newStage });
      return res.ok;
    },
    [domain],
  );

  const sendJobOffer = useCallback(
    async (offer: Omit<JobOffer, "id" | "status">, offerFile?: File): Promise<boolean> => {
      const res = await domain.createJobOffer(
        {
          candidateId: offer.candidateId,
          basicSalary: offer.basicSalary,
          housingAllowance: offer.housingAllowance,
          transportAllowance: offer.transportAllowance,
          proposedStartDate: offer.proposedStartDate,
        },
        offerFile,
      );
      if (res.ok && "data" in res && res.data && typeof res.data === "object" && "offerId" in res.data) {
        await domain.updateOfferStatus({
          offerId: (res.data as any).offerId,
          action: "send",
        });
      }
      return res.ok;
    },
    [domain],
  );

  return {
    addJobOpening,
    convertCandidateToEmployee: domain.convertCandidateToEmployee,
    addCandidate,
    updateCandidateScore,
    moveCandidateStage,
    sendJobOffer,
    createRequisition: domain.createRequisition,
    approveRequisition: domain.approveRequisition,
    publishJobOpening: domain.publishJobOpening,
    scheduleInterview: domain.scheduleInterview,
    submitScorecard: domain.submitScorecard,
    createJobOffer: domain.createJobOffer,
    updateOfferStatus: domain.updateOfferStatus,
    addToTalentPool: domain.addToTalentPool,
  };
}
