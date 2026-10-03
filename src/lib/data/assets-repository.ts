import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "../query/query-keys";
import { useAuth } from "../auth/AuthContext";

export interface AssetRow {
  id: string;
  companyId?: string;
  assetTag: string;
  nameAr: string;
  nameEn: string;
  category: "laptop" | "phone" | "vehicle" | "security_card" | "access_key" | "other";
  serialNumber: string;
  lifecycleState: "available" | "assigned" | "under_maintenance" | "retired" | "lost";
  status: string;
  assignedToEmployeeId?: string | null;
  assignedToEmployeeName?: string | null;
  assignedDate?: string | null;
  acquisitionDate?: string | null;
  purchaseValue?: number | null;
  condition: string;
  location?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface AssetCustodyHistoryRow {
  id: string;
  assetId: string;
  companyId?: string;
  employeeId?: string | null;
  action: string;
  actionDate: string;
  notes?: string | null;
  createdAt: string;
}

function mapAssetRow(row: Record<string, unknown>): AssetRow {
  return {
    id: row.id as string,
    companyId: row.company_id as string | undefined,
    assetTag: row.asset_tag as string,
    nameAr: row.name_ar as string,
    nameEn: row.name_en as string,
    category: (row.category as AssetRow["category"]) || "other",
    serialNumber: row.serial_number as string,
    lifecycleState: (row.lifecycle_state as AssetRow["lifecycleState"]) || "available",
    status: (row.status as string) || "available",
    assignedToEmployeeId: row.assigned_to_employee_id as string | null,
    assignedToEmployeeName: row.assigned_to_employee_name as string | null,
    assignedDate: row.assigned_date as string | null,
    acquisitionDate: row.acquisition_date as string | null,
    purchaseValue: row.purchase_value != null ? Number(row.purchase_value) : null,
    condition: (row.condition as string) || "good",
    location: row.location as string | null,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
  };
}

export function useAssets(companyId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.assets.all,
    queryFn: async (): Promise<AssetRow[]> => {
      if (!isLive) return [];
      const q = (supabase as any)
        .from("hardware_assets")
        .select("*")
        .order("created_at", { ascending: false });
      const { data, error } = companyId ? await q.eq("company_id", companyId) : await q;
      if (error) throw new Error(error.message);
      return (data || []).map(mapAssetRow);
    },
    enabled: isLive,
  });
}

export function useAssetCustodyHistory(assetId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: [...queryKeys.assets.all, "custody", assetId || "all"],
    queryFn: async (): Promise<AssetCustodyHistoryRow[]> => {
      if (!isLive || !assetId) return [];
      const { data, error } = await (supabase as any)
        .from("asset_custody_history")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        assetId: r.asset_id as string,
        companyId: r.company_id as string | undefined,
        employeeId: r.employee_id as string | null,
        action: r.action as string,
        actionDate: r.action_date as string,
        notes: r.notes as string | null,
        createdAt: r.created_at as string,
      }));
    },
    enabled: isLive && Boolean(assetId),
  });
}

export function useAssetMutationBundle() {
  const queryClient = useQueryClient();

  const createAssetAtomic = useMutation({
    mutationFn: async (params: {
      companyId: string;
      nameAr: string;
      nameEn?: string;
      category: string;
      serialNumber: string;
      assetTag: string;
      acquisitionDate?: string;
      purchaseValue?: number;
      condition?: string;
      location?: string;
      notes?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("create_asset_atomic", {
        p_company_id: params.companyId,
        p_name_ar: params.nameAr,
        p_name_en: params.nameEn || params.nameAr,
        p_category: params.category,
        p_serial_number: params.serialNumber,
        p_asset_tag: params.assetTag,
        p_acquisition_date: params.acquisitionDate ?? null,
        p_purchase_value: params.purchaseValue ?? null,
        p_condition: params.condition ?? "good",
        p_location: params.location ?? null,
        p_notes: params.notes ?? null,
      });
      if (error) throw new Error(error.message);
      const firstVal = data && typeof data === "object" ? Object.values(data as object)[0] : data;
      return typeof firstVal === "object" ? firstVal : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
    },
  });

  const assignAssetAtomic = useMutation({
    mutationFn: async (params: { assetId: string; employeeId: string; condition?: string }) => {
      const { data, error } = await (supabase as any).rpc("assign_asset_atomic", {
        p_asset_id: params.assetId,
        p_employee_id: params.employeeId,
        p_condition: params.condition ?? "good",
      });
      if (error) throw new Error(error.message);
      const firstVal = data && typeof data === "object" ? Object.values(data as object)[0] : data;
      return typeof firstVal === "object" ? firstVal : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
    },
  });

  const returnAssetAtomic = useMutation({
    mutationFn: async (params: { assetId: string; condition?: string }) => {
      const { data, error } = await (supabase as any).rpc("return_asset_atomic", {
        p_asset_id: params.assetId,
        p_condition: params.condition ?? "good",
      });
      if (error) throw new Error(error.message);
      const firstVal = data && typeof data === "object" ? Object.values(data as object)[0] : data;
      return typeof firstVal === "object" ? firstVal : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
    },
  });

  const checkAssetClearanceBlock = useMutation({
    mutationFn: async (params: { employeeId: string }) => {
      const { data, error } = await (supabase as any).rpc("check_asset_clearance_block", {
        p_employee_id: params.employeeId,
      });
      if (error) throw new Error(error.message);
      const firstVal = data && typeof data === "object" ? Object.values(data as object)[0] : data;
      return typeof firstVal === "object" ? firstVal : data;
    },
  });

  return { createAssetAtomic, assignAssetAtomic, returnAssetAtomic, checkAssetClearanceBlock };
}
