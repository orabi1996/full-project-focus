import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ShiftDefinition } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { createShiftRecord } from "../../data/operational-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
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
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const addShift = useCallback(
    async (shift: Omit<ShiftDefinition, "id">): Promise<boolean> => {
      const newShift: ShiftDefinition = {
        ...shift,
        id: `sh-${Date.now()}`,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-shift-${shift.nameAr}`,
        operation: async () => {
          await createShiftRecord(newShift);
          await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.shifts = [...demoStore.shifts, newShift];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إضافة وحفظ الوردية بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ الوردية");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return { addShift };
}
