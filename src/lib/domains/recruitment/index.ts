import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Candidate, CandidateStage, JobOffer, JobOpening, WorkforcePlan } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  createCandidateRecord,
  createJobOfferRecord,
  createJobOpeningRecord,
  updateCandidateRecord,
} from "../../data/operational-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";
import { uploadCandidateCvFile, uploadJobOfferFile, rollbackUploadedFile } from "../../storage";

export function useRecruitment() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoData = useDemoStore((s) => ({
    jobOpenings: s.jobOpenings,
    candidates: s.candidates,
    jobOffers: s.jobOffers,
    workforcePlans: s.workforcePlans,
  }));

  const jobOpenings = isLive ? bootstrap.jobOpenings : demoData.jobOpenings;
  const candidates = isLive ? bootstrap.candidates : demoData.candidates;
  const jobOffers = isLive ? bootstrap.jobOffers : demoData.jobOffers;
  const workforcePlans = isLive ? bootstrap.workforcePlans : demoData.workforcePlans;

  return {
    jobOpenings,
    candidates,
    jobOffers,
    workforcePlans,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useRecruitmentMutations() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const addJobOpening = useCallback(
    async (job: Omit<JobOpening, "id">): Promise<boolean> => {
      const newJob: JobOpening = {
        ...job,
        id: `job-${Date.now()}`,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-job-opening-${job.titleAr}`,
        operation: async () => {
          await createJobOpeningRecord(newJob);
          await queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.openings() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.jobOpenings = [...demoStore.jobOpenings, newJob];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم فتح وحفظ الوظيفة الشاغرة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ الوظيفة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const addCandidate = useCallback(
    async (candidate: Omit<Candidate, "id">, cvFile?: File): Promise<boolean> => {
      const candId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cand-${Date.now()}`;
      let cvFileId: string | undefined = candidate.cvFileId;
      let cvUrl: string | undefined = candidate.cvUrl;

      if (cvFile) {
        try {
          const uploaded = await uploadCandidateCvFile({
            candidateId: candId,
            file: cvFile,
          });
          cvFileId = uploaded.id;
          cvUrl = uploaded.object_path;
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "فشل رفع السيرة الذاتية";
          toast.error(msg);
          return false;
        }
      }

      const newCand: Candidate = {
        ...candidate,
        id: candId,
        cvFileId,
        cvUrl,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-candidate-${candidate.fullName || candidate.email}`,
        operation: async () => {
          try {
            await createCandidateRecord(newCand);
          } catch (insertErr) {
            if (cvFileId) {
              await rollbackUploadedFile({ fileId: cvFileId }).catch((rbErr) =>
                console.error("Rollback of uploaded candidate CV failed:", rbErr),
              );
            }
            throw insertErr;
          }
          await queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.candidates() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.candidates = [...demoStore.candidates, newCand];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إضافة المرشح بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة المرشح");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const updateCandidateScore = useCallback(
    async (candidateId: string, score: number): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-candidate-score-${candidateId}`,
        operation: async () => {
          await updateCandidateRecord(candidateId, { ratingScore: score });
          await queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.candidates() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.candidates = demoStore.candidates.map((c) =>
            c.id === candidateId ? { ...c, ratingScore: score } : c,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث تقييم المرشح بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث تقييم المرشح");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const moveCandidateStage = useCallback(
    async (candidateId: string, newStage: CandidateStage): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `move-candidate-stage-${candidateId}-${newStage}`,
        operation: async () => {
          await updateCandidateRecord(candidateId, { stage: newStage });
          await queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.candidates() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.candidates = demoStore.candidates.map((c) =>
            c.id === candidateId ? { ...c, stage: newStage } : c,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success(`تم نقل المرشح إلى مرحلة: ${newStage}`);
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث مرحلة المرشح");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const sendJobOffer = useCallback(
    async (offer: Omit<JobOffer, "id" | "status">, offerFile?: File): Promise<boolean> => {
      const offerId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `off-${Date.now()}`;
      let offerFileId: string | undefined;

      if (offerFile) {
        try {
          const uploaded = await uploadJobOfferFile({
            offerId,
            candidateId: offer.candidateId,
            file: offerFile,
          });
          offerFileId = uploaded.id;
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "فشل رفع وثيقة العرض الوظيفي";
          toast.error(msg);
          return false;
        }
      }

      const newOffer: JobOffer = {
        ...offer,
        id: offerId,
        status: "sent_to_candidate",
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `send-job-offer-${offer.candidateId}-${offer.jobTitle}-${offerId}`,
        operation: async () => {
          try {
            await createJobOfferRecord(newOffer);
          } catch (insertErr) {
            if (offerFileId) {
              await rollbackUploadedFile({ fileId: offerFileId }).catch((rbErr) =>
                console.error("Rollback of uploaded job offer failed:", rbErr),
              );
            }
            throw insertErr;
          }
          await queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.offers() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.jobOffers = [...demoStore.jobOffers, newOffer];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إرسال العرض الوظيفي للمرشح بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إرسال العرض الوظيفي");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return {
    addJobOpening,
    addCandidate,
    updateCandidateScore,
    moveCandidateStage,
    sendJobOffer,
  };
}
