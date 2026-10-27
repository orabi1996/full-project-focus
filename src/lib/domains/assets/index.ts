import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { HardwareAsset } from "../../../types";
import {
  useAssets as useAssetsRepo,
  useAssetCustodyHistory,
  useAssetMutationBundle,
} from "../../data/assets-repository";
import { executeReliableMutation } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { toast } from "sonner";

export { useAssetsRepo, useAssetCustodyHistory };

export function useAssets() {
  const bootstrap = useBootstrapData();

  return {
    assets: bootstrap.assets,
    isLoading: bootstrap.isLoading,
    isError: bootstrap.isError,
    error: bootstrap.error,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useAssetMutations() {
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

      const result = await executeReliableMutation({
        mode: "live",
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
        onCommitted: () => {
          toast.success("تم تسجيل الأصل بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسجيل الأصل");
        },
      });

      return result.ok;
    },
    [queryClient, repoMutations],
  );

  const assignAsset = useCallback(
    async (assetId: string, employeeId: string, condition: string = "good"): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
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
        onCommitted: () => {
          toast.success("تم تسليم الأصل للموظف بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسليم الأصل");
        },
      });

      return result.ok;
    },
    [queryClient, repoMutations],
  );

  const returnAsset = useCallback(
    async (assetId: string, condition: string = "good"): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
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
        onCommitted: () => {
          toast.success("تم استرجاع الأصل بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر استرجاع الأصل");
        },
      });

      return result.ok;
    },
    [queryClient, repoMutations],
  );

  const checkClearanceBlock = useCallback(
    async (employeeId: string): Promise<{ blocksCount: number; blocks: boolean }> => {
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
    [repoMutations],
  );

  return { addAsset, assignAsset, returnAsset, checkClearanceBlock };
}
