import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ShiftDefinition } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { createShiftRecord } from "../../data/operational-repository";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function useShifts() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoShifts = useDemoStore((s) => s.shifts);

  const shifts = isLive ? bootstrap.shifts : demoShifts;

  return {
    shifts,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useShiftMutations() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const addShift = useCallback(
    async (shift: Omit<ShiftDefinition, "id">): Promise<boolean> => {
      const newShift: ShiftDefinition = {
        ...shift,
        id: `sh-${Date.now()}`,
      };

      if (!isLive) {
        demoStore.shifts = [...demoStore.shifts, newShift];
        demoStore.notify();
        toast.success("تم إضافة الوردية الجديدة بنجاح");
        return true;
      }

      try {
        await createShiftRecord(newShift);
        await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم حفظ الوردية بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر حفظ الوردية");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  return { addShift };
}
