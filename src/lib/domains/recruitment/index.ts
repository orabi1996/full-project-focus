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
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

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
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const addJobOpening = useCallback(
    async (job: Omit<JobOpening, "id">): Promise<boolean> => {
      const newJob: JobOpening = {
        ...job,
        id: `job-${Date.now()}`,
      };

      if (!isLive) {
        demoStore.jobOpenings = [...demoStore.jobOpenings, newJob];
        demoStore.notify();
        toast.success("تم فتح الوظيفة الشاغرة بنجاح");
        return true;
      }

      try {
        await createJobOpeningRecord(newJob);
        await queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.openings() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم حفظ الوظيفة الشاغرة بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر حفظ الوظيفة");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const addCandidate = useCallback(
    async (candidate: Omit<Candidate, "id">): Promise<boolean> => {
      const newCand: Candidate = {
        ...candidate,
        id: `cand-${Date.now()}`,
      };

      if (!isLive) {
        demoStore.candidates = [...demoStore.candidates, newCand];
        demoStore.notify();
        toast.success("تم إضافة المرشح الجديد بنجاح");
        return true;
      }

      try {
        await createCandidateRecord(newCand);
        await queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.candidates() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم إضافة المرشح بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر إضافة المرشح");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const updateCandidateScore = useCallback(
    async (candidateId: string, score: number): Promise<boolean> => {
      if (!isLive) {
        demoStore.candidates = demoStore.candidates.map((c) =>
          c.id === candidateId ? { ...c, ratingScore: score } : c,
        );
        demoStore.notify();
        toast.success("تم تحديث تقييم المرشح بنجاح");
        return true;
      }

      try {
        await updateCandidateRecord(candidateId, { ratingScore: score });
        await queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.candidates() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم تحديث تقييم المرشح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر تحديث تقييم المرشح");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const moveCandidateStage = useCallback(
    async (candidateId: string, newStage: CandidateStage): Promise<boolean> => {
      if (!isLive) {
        demoStore.candidates = demoStore.candidates.map((c) =>
          c.id === candidateId ? { ...c, stage: newStage } : c,
        );
        demoStore.notify();
        toast.success(`تم نقل المرشح إلى مرحلة: ${newStage}`);
        return true;
      }

      try {
        await updateCandidateRecord(candidateId, { stage: newStage });
        await queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.candidates() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success(`تم تحديث مرحلة المرشح بنجاح`);
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر تحديث مرحلة المرشح");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const sendJobOffer = useCallback(
    async (offer: Omit<JobOffer, "id" | "status">): Promise<boolean> => {
      const newOffer: JobOffer = {
        ...offer,
        id: `off-${Date.now()}`,
        status: "sent_to_candidate",
      };

      if (!isLive) {
        demoStore.jobOffers = [...demoStore.jobOffers, newOffer];
        demoStore.notify();
        toast.success("تم إرسال العرض الوظيفي للمرشح بنجاح");
        return true;
      }

      try {
        await createJobOfferRecord(newOffer);
        await queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.offers() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم إرسال العرض الوظيفي بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر إرسال العرض الوظيفي");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  return {
    addJobOpening,
    addCandidate,
    updateCandidateScore,
    moveCandidateStage,
    sendJobOffer,
  };
}
