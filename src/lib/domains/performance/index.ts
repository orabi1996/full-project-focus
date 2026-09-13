import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { EvaluationRecord, PerformanceCycle } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  createEvaluationRecord,
  createPerformanceCycleRecord,
} from "../../data/operational-repository";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function usePerformance() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoData = useDemoStore((s) => ({
    performanceCycles: s.performanceCycles,
    evaluations: s.evaluations,
  }));

  const performanceCycles = isLive ? bootstrap.performanceCycles : demoData.performanceCycles;
  const evaluations = isLive ? bootstrap.evaluations : demoData.evaluations;

  return {
    performanceCycles,
    evaluations,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function usePerformanceMutations() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const addPerformanceCycle = useCallback(
    async (cycle: Omit<PerformanceCycle, "id">): Promise<boolean> => {
      const newCycle: PerformanceCycle = {
        ...cycle,
        id: `cyc-${Date.now()}`,
      };

      if (!isLive) {
        demoStore.performanceCycles = [...demoStore.performanceCycles, newCycle];
        demoStore.notify();
        toast.success("تم إطلاق دورة التقييم بنجاح");
        return true;
      }

      try {
        await createPerformanceCycleRecord(newCycle);
        await queryClient.invalidateQueries({ queryKey: queryKeys.performance.cycles() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم إطلاق دورة التقييم بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر إطلاق دورة التقييم");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const addEvaluation = useCallback(
    async (evaluation: Omit<EvaluationRecord, "id">): Promise<boolean> => {
      const newEval: EvaluationRecord = {
        ...evaluation,
        id: `eval-${Date.now()}`,
      };

      if (!isLive) {
        demoStore.evaluations = [...demoStore.evaluations, newEval];
        demoStore.notify();
        toast.success("تم تسجيل تقييم الأداء بنجاح");
        return true;
      }

      try {
        await createEvaluationRecord(newEval);
        await queryClient.invalidateQueries({ queryKey: queryKeys.performance.evaluations() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم حفظ تقييم الأداء بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر حفظ تقييم الأداء");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  return { addPerformanceCycle, addEvaluation };
}
