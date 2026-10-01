import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { EvaluationRecord, PerformanceCycle } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";
import {
  usePerformanceCycles as useRepoCycles,
  usePerformanceKPIs as useRepoKPIs,
  useNineBoxData as useRepoNineBox,
  useReviewAssignments as useRepoAssignments,
  usePerformanceRepositoryMutations as useRepoMutations,
  type PerformanceGoalCategory,
  type PerformanceGoalLevel,
} from "../../data/performance-repository";

export * from "../../data/performance-repository";

/**
 * Enterprise Performance hook delegating to the production database repository.
 */
export function usePerformance() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const repoCycles = useRepoCycles();
  const repoKPIs = useRepoKPIs();
  const repoNineBox = useRepoNineBox();
  const repoAssignments = useRepoAssignments();

  const demoData = useDemoStore((s) => ({
    performanceCycles: s.performanceCycles,
    evaluations: s.evaluations,
  }));

  const performanceCycles = isLive
    ? (repoCycles.data || []).map((c) => ({
        id: c.id,
        titleAr: c.titleAr,
        titleEn: c.titleEn,
        periodType: c.periodType,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        participantsCount: c.participantsCount,
        completionRate: c.completionRate,
      }))
    : demoData.performanceCycles;

  const evaluations: EvaluationRecord[] = isLive
    ? (repoAssignments.data || []).map((a) => ({
        id: a.id,
        cycleId: a.cycleId,
        employeeId: a.employeeId,
        employeeName: a.employeeName,
        evaluatorId: a.reviewerEmployeeId,
        evaluatorName: a.reviewerName,
        evaluationType: a.reviewType,
        overallScore: a.review?.overallScore ?? 0,
        competencyScores: {},
        notes: a.review?.generalFeedback || a.review?.strengthsSummary || "",
        status: a.status === "submitted" || a.status === "locked" ? "submitted" : "pending",
        submittedAt: a.submittedAt || a.review?.submittedAt,
      }))
    : demoData.evaluations;

  return {
    performanceCycles,
    evaluations,
    kpis: repoKPIs.data,
    nineBox: repoNineBox.data,
    isLoading: isLive ? (repoCycles.isLoading || repoAssignments.isLoading) : false,
    isError: isLive ? (repoCycles.isError || repoAssignments.isError) : false,
    error: isLive ? (repoCycles.error || repoAssignments.error) : null,
    refetch: async () => {
      await Promise.all([
        repoCycles.refetch(),
        repoKPIs.refetch(),
        repoNineBox.refetch(),
        repoAssignments.refetch(),
      ]);
    },
  };
}

/**
 * Production-grade performance mutation hook wrapping operations in executeReliableMutation.
 */
export function usePerformanceMutations() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();
  const repo = useRepoMutations();

  const addPerformanceCycle = useCallback(
    async (cycle: Omit<PerformanceCycle, "id">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-cycle-${cycle.titleAr}-${cycle.startDate}`,
        operation: async () => {
          await repo.createCycle.mutateAsync({
            titleAr: cycle.titleAr,
            titleEn: cycle.titleEn,
            periodType: cycle.periodType,
            startDate: cycle.startDate,
            endDate: cycle.endDate,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          const newCycle: PerformanceCycle = {
            ...cycle,
            id: `cyc-${Date.now()}`,
          };
          demoStore.performanceCycles = [...demoStore.performanceCycles, newCycle];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إنشاء دورة التقييم بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إنشاء دورة التقييم");
        },
      });

      return result.ok;
    },
    [mode, queryClient, repo.createCycle],
  );

  const addEvaluation = useCallback(
    async (evaluation: Omit<EvaluationRecord, "id">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-eval-${evaluation.cycleId}-${evaluation.employeeId}`,
        operation: async () => {
          // If assignment id is passed, submit review
          await repo.submitReview.mutateAsync({
            assignmentId: evaluation.cycleId, // fallback or direct assignment ID
            scores: [
              {
                item_type: "competency",
                item_id: "core-perf",
                score: evaluation.overallScore,
                weight_pct: 100,
                comment: evaluation.notes,
              },
            ],
            generalFeedback: evaluation.notes,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          const newEval: EvaluationRecord = {
            ...evaluation,
            id: `eval-${Date.now()}`,
          };
          demoStore.evaluations = [...demoStore.evaluations, newEval];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم حفظ تقييم الأداء بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ تقييم الأداء");
        },
      });

      return result.ok;
    },
    [mode, queryClient, repo.submitReview],
  );

  const launchCycle = useCallback(
    async (cycleId: string, targetDepartmentIds?: string[]): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `launch-cycle-${cycleId}`,
        operation: async () => {
          await repo.launchCycle.mutateAsync({ cycleId, targetDepartmentIds });
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          const target = demoStore.performanceCycles.find((c) => c.id === cycleId);
          if (target) {
            target.status = "active";
            demoStore.notify();
          }
          return true;
        },
        onCommitted: () => {
          toast.success("تم إطلاق دورة التقييم وتجميد المشاركين وتوليد التكليفات بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إطلاق دورة التقييم");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo.launchCycle],
  );

  const assignPeerReviewers = useCallback(
    async (cycleId: string, targetEmployeeId: string, peerEmployeeIds: string[], isAnonymous = true): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `assign-peers-${cycleId}-${targetEmployeeId}`,
        operation: async () => {
          await repo.assignPeerReviewers.mutateAsync({
            cycleId,
            targetEmployeeId,
            peerEmployeeIds,
            isAnonymous,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم تعيين مقيمي الزملاء (360°) بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تعيين مقيمي الزملاء");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo.assignPeerReviewers],
  );

  const submitGoal = useCallback(
    async (goal: {
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
    }): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `submit-goal-${goal.cycleId}-${goal.employeeId}-${goal.titleAr}`,
        operation: async () => {
          await repo.submitGoal.mutateAsync(goal);
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم اعتماد وتوثيق الهدف بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ الهدف");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo.submitGoal],
  );

  const updateGoalProgress = useCallback(
    async (goalId: string, newValue: number, percentage: number, note?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-goal-progress-${goalId}`,
        operation: async () => {
          await repo.updateGoalProgress.mutateAsync({
            goalId,
            newValue,
            percentage,
            note,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث نسبة إنجاز الهدف وتوثيق السجل التاريخي");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث تقدم الهدف");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo.updateGoalProgress],
  );

  const submitReview = useCallback(
    async (review: {
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
    }): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `submit-review-${review.assignmentId}`,
        operation: async () => {
          await repo.submitReview.mutateAsync(review);
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم اعتماد تقييم الأداء بنجاح وحساب الدرجات الموزونة آلياً");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر اعتماد تقييم الأداء");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo.submitReview],
  );

  const adjustCalibration = useCallback(
    async (adjustment: {
      sessionId: string;
      participantId: string;
      calibratedScore: number;
      calibratedRatingLabel: string;
      calibrationReason: string;
    }): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `adjust-calibration-${adjustment.sessionId}-${adjustment.participantId}`,
        operation: async () => {
          await repo.adjustCalibration.mutateAsync(adjustment);
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم توثيق معايرة وموازنة النتيجة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر توثيق المعايرة");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo.adjustCalibration],
  );

  const assessPotential = useCallback(
    async (assessment: {
      cycleId: string;
      participantId: string;
      potentialLevel: "low" | "medium" | "high";
      learningAgilityScore?: number;
      leadershipPotentialScore?: number;
      criticalRoleReadiness?: string;
      flightRisk?: string;
      retentionPriority?: string;
      rationale?: string;
    }): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `assess-potential-${assessment.cycleId}-${assessment.participantId}`,
        operation: async () => {
          await repo.assessPotential.mutateAsync(assessment);
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم توثيق تقييم الإمكانات والمواهب وتحديث مصفوفة 9-Box");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تقييم الإمكانات");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo.assessPotential],
  );

  const finalizeCycle = useCallback(
    async (cycleId: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `finalize-cycle-${cycleId}`,
        operation: async () => {
          await repo.finalizeCycle.mutateAsync(cycleId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          const cyc = demoStore.performanceCycles.find((c) => c.id === cycleId);
          if (cyc) {
            cyc.status = "completed";
            demoStore.notify();
          }
          return true;
        },
        onCommitted: () => {
          toast.success("تم إقفال واعتماد دورة التقييم وقفل النتائج نهائياً");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إقفال دورة التقييم");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo.finalizeCycle],
  );

  const saveDevelopmentPlan = useCallback(
    async (plan: {
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
    }): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `save-idp-${plan.employeeId}-${plan.titleAr}`,
        operation: async () => {
          await repo.saveDevelopmentPlan.mutateAsync(plan);
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم حفظ خطة التطوير الفردية (IDP) بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ خطة التطوير");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo.saveDevelopmentPlan],
  );

  const createPIP = useCallback(
    async (pip: {
      cycleId?: string;
      employeeId: string;
      startDate: string;
      endDate: string;
      reviewFrequencyDays?: number;
      performanceDeficiencies: string;
      expectedOutcomes: string;
      consequencesOfFailure?: string;
      hrNotes?: string;
    }): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-pip-${pip.employeeId}-${pip.startDate}`,
        operation: async () => {
          await repo.createPIP.mutateAsync(pip);
          await queryClient.invalidateQueries({ queryKey: queryKeys.performance.all });
          return true;
        },
        demoOperation: () => {
          return true;
        },
        onCommitted: () => {
          toast.success("تم تفعيل خطة تحسين الأداء (PIP) بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إنشاء خطة تحسين الأداء");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo.createPIP],
  );

  return {
    ...repo,
    addPerformanceCycle,
    addEvaluation,
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
