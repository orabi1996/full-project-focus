import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { HardwareAsset } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  assignAssetRecord,
  createAssetRecord,
  returnAssetRecord,
} from "../../data/operational-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function useAssets() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoAssets = useDemoStore((s) => s.assets);

  const assets = isLive ? bootstrap.assets : demoAssets;

  return {
    assets,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useAssetMutations() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const addAsset = useCallback(
    async (asset: Omit<HardwareAsset, "id">): Promise<boolean> => {
      const newAsset: HardwareAsset = {
        ...asset,
        id: `ast-${Date.now()}`,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-asset-${asset.serialNumber || asset.nameAr}`,
        operation: async () => {
          await createAssetRecord(newAsset);
          await queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم تسجيل الأصل بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.assets = [...demoStore.assets, newAsset];
          demoStore.notify();
          toast.success("تم تسجيل الأصل في المنظومة بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسجيل الأصل");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const assignAsset = useCallback(
    async (assetId: string, employeeId: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `assign-asset-${assetId}-${employeeId}`,
        operation: async () => {
          await assignAssetRecord(assetId, employeeId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم تسليم الأصل للموظف بنجاح");
          return true;
        },
        demoOperation: () => {
          const emp = demoStore.employees.find((e) => e.id === employeeId);
          demoStore.assets = demoStore.assets.map((a) =>
            a.id === assetId
              ? {
                  ...a,
                  status: "assigned" as const,
                  assignedToEmployeeId: employeeId,
                  assignedToEmployeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "موظف",
                  assignedDate: new Date().toISOString().split("T")[0],
                }
              : a,
          );
          demoStore.notify();
          toast.success("تم تسليم الأصل للموظف بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسليم الأصل");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const returnAsset = useCallback(
    async (assetId: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `return-asset-${assetId}`,
        operation: async () => {
          await returnAssetRecord(assetId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم استرجاع الأصل بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.assets = demoStore.assets.map((a) =>
            a.id === assetId
              ? {
                  ...a,
                  status: "available" as const,
                  assignedToEmployeeId: undefined,
                  assignedToEmployeeName: undefined,
                  assignedDate: undefined,
                }
              : a,
          );
          demoStore.notify();
          toast.success("تم استرجاع الأصل إلى المستودع بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر استرجاع الأصل");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return { addAsset, assignAsset, returnAsset };
}
