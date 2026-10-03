import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { HardwareAsset } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  useAssets as useAssetsRepo,
  useAssetCustodyHistory,
  useAssetMutationBundle,
} from "../../data/assets-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export { useAssetsRepo, useAssetCustodyHistory };

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
  const repoMutations = useAssetMutationBundle();

  const addAsset = useCallback(
    async (
      asset: Omit<HardwareAsset, "id"> & {
        companyId?: string;
        acquisitionDate?: string;
        purchaseValue?: number;
        condition?: string;
        location?: string;
        notes?: string;
      },
    ): Promise<boolean> => {
      const serial = asset.serialNumber?.trim();
      const tag = asset.assetTag?.trim();

      if (!serial) {
        toast.error("الرقم التسلسلي مطلوب");
        return false;
      }
      if (!tag) {
        toast.error("رمز الأصل (Asset Tag) مطلوب");
        return false;
      }

      const newAsset: HardwareAsset = {
        ...asset,
        id: `ast-${Date.now()}`,
        serialNumber: serial,
        assetTag: tag,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-asset-${serial}-${tag}`,
        operation: async () => {
          const res = await repoMutations.createAssetAtomic.mutateAsync({
            companyId: asset.companyId || "00000000-0000-0000-0000-000000000000",
            nameAr: asset.nameAr,
            nameEn: asset.nameEn || asset.nameAr,
            category: asset.category,
            serialNumber: serial,
            assetTag: tag,
            acquisitionDate: asset.acquisitionDate,
            purchaseValue: asset.purchaseValue,
            condition: asset.condition || "good",
            location: asset.location,
            notes: asset.notes,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return res;
        },
        demoOperation: () => {
          demoStore.assets = [...demoStore.assets, newAsset];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم تسجيل الأصل بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسجيل الأصل");
        },
      });

      return result.ok;
    },
    [mode, queryClient, repoMutations],
  );

  const assignAsset = useCallback(
    async (assetId: string, employeeId: string, condition: string = "good"): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `assign-asset-${assetId}-${employeeId}`,
        operation: async () => {
          const res = await repoMutations.assignAssetAtomic.mutateAsync({
            assetId,
            employeeId,
            condition,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return res;
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
          return true;
        },
        onCommitted: () => {
          toast.success("تم تسليم الأصل للموظف بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسليم الأصل");
        },
      });

      return result.ok;
    },
    [mode, queryClient, repoMutations],
  );

  const returnAsset = useCallback(
    async (assetId: string, condition: string = "good"): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `return-asset-${assetId}`,
        operation: async () => {
          const res = await repoMutations.returnAssetAtomic.mutateAsync({
            assetId,
            condition,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return res;
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
          return true;
        },
        onCommitted: () => {
          toast.success("تم استرجاع الأصل بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر استرجاع الأصل");
        },
      });

      return result.ok;
    },
    [mode, queryClient, repoMutations],
  );

  const checkClearanceBlock = useCallback(
    async (employeeId: string): Promise<{ blocksCount: number; blocks: boolean }> => {
      if (mode !== "live") return { blocksCount: 0, blocks: false };
      try {
        const res = await repoMutations.checkAssetClearanceBlock.mutateAsync({ employeeId });
        const record = res as Record<string, unknown>;
        return {
          blocksCount: (record?.assigned_asset_count as number) ?? 0,
          blocks: Boolean(record?.blocks_clearance),
        };
      } catch {
        return { blocksCount: 0, blocks: false };
      }
    },
    [mode, repoMutations],
  );

  return { addAsset, assignAsset, returnAsset, checkClearanceBlock };
}
