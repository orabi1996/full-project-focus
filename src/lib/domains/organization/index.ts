/** Canonical workforce employed definition: active, probation, on_leave (excludes terminated, suspended) */
export const isEmployedWorkforce = (status?: string | null): boolean => {
  return status === "active" || status === "probation" || status === "on_leave";
};

/** Demo/offline identity generator using crypto.randomUUID() */
export const generateEntityId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-000000000000";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type {
  CompanyProfile,
  CostCenter,
  JobPosition,
  OrgUnit,
  Subsidiary,
  WorkLocation,
} from "../../../types";
import {
  archiveCostCenterRecord,
  archiveJobPositionRecord,
  archiveOrganizationUnitRecord,
  archiveSubsidiaryRecord,
  archiveWorkLocationRecord,
  createCostCenterRecord,
  createJobPositionRecord,
  createOrganizationUnitRecord,
  createSubsidiaryRecord,
  createWorkLocationRecord,
  getMasterDataDependenciesRecord,
  updateCompanyRecord,
  updateCostCenterRecord,
  updateJobPositionRecord,
  updateOrganizationUnitRecord,
  updateSubsidiaryRecord,
  updateWorkLocationRecord,
} from "../../data/operational-repository";
import { executeReliableMutation } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";

import { toast } from "sonner";

export function useOrganization() {
  const bootstrap = useBootstrapData();

  return {
    company: bootstrap.company,
    subsidiaries: bootstrap.subsidiaries,
    orgUnits: bootstrap.orgUnits,
    workLocations: bootstrap.workLocations,
    costCenters: bootstrap.costCenters,
    jobPositions: bootstrap.jobPositions,
    isLoading: bootstrap.isLoading,
    isError: bootstrap.isError,
    error: bootstrap.error,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useOrganizationMutations() {
  const queryClient = useQueryClient();

  const updateCompany = useCallback(
    async (profile: CompanyProfile): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `update-company-${profile.id || "main"}`,
        operation: async () => {
          await updateCompanyRecord(profile);
          await queryClient.invalidateQueries({ queryKey: queryKeys.company.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم حفظ بيانات المنشأة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ بيانات المنشأة");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const addOrgUnit = useCallback(
    async (unit: Omit<OrgUnit, "id" | "employeeCount">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `create-org-unit-${unit.code || unit.nameAr}`,
        operation: async () => {
          await createOrganizationUnitRecord(unit);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.units() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم حفظ الوحدة التنظيمية بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة الوحدة التنظيمية");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const updateOrgUnit = useCallback(
    async (id: string, unit: Omit<OrgUnit, "id" | "employeeCount">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `update-org-unit-${id}`,
        operation: async () => {
          await updateOrganizationUnitRecord(id, unit);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.units() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث بيانات الوحدة التنظيمية");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث الوحدة التنظيمية");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const archiveOrgUnit = useCallback(
    async (
      id: string,
      reassignDeptId?: string,
      reparentChildrenTo?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `archive-org-unit-${id}`,
        operation: async () => {
          await archiveOrganizationUnitRecord(id, reassignDeptId, reparentChildrenTo);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.units() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم أرشفة الوحدة التنظيمية بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر أرشفة الوحدة التنظيمية");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const deleteOrgUnit = useCallback(
    async (id: string): Promise<boolean> => {
      return archiveOrgUnit(id);
    },
    [archiveOrgUnit],
  );

  const addSubsidiary = useCallback(
    async (subsidiary: Omit<Subsidiary, "id" | "employeeCount">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `create-subsidiary-${subsidiary.code || subsidiary.nameAr}`,
        operation: async () => {
          await createSubsidiaryRecord(subsidiary);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.subsidiaries() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم إضافة الشركة التابعة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة الشركة التابعة");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const updateSubsidiary = useCallback(
    async (id: string, subsidiary: Omit<Subsidiary, "id" | "employeeCount">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `update-subsidiary-${id}`,
        operation: async () => {
          await updateSubsidiaryRecord(id, subsidiary);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.subsidiaries() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث بيانات الشركة التابعة");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث الشركة التابعة");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const archiveSubsidiary = useCallback(
    async (id: string, reassignSubId?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `archive-subsidiary-${id}`,
        operation: async () => {
          await archiveSubsidiaryRecord(id, reassignSubId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.subsidiaries() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تمت أرشفة الشركة التابعة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر أرشفة الشركة التابعة");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const deleteSubsidiary = useCallback(
    async (id: string): Promise<boolean> => {
      return archiveSubsidiary(id);
    },
    [archiveSubsidiary],
  );

  const addWorkLocation = useCallback(
    async (location: Omit<WorkLocation, "id">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `create-location-${location.code || location.nameAr}`,
        operation: async () => {
          await createWorkLocationRecord(location);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.locations() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم إضافة موقع العمل بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة موقع العمل");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const updateWorkLocation = useCallback(
    async (id: string, location: Omit<WorkLocation, "id">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `update-location-${id}`,
        operation: async () => {
          await updateWorkLocationRecord(id, location);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.locations() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث موقع العمل بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث موقع العمل");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const archiveWorkLocation = useCallback(
    async (id: string, reassignLocId?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `archive-location-${id}`,
        operation: async () => {
          await archiveWorkLocationRecord(id, reassignLocId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.locations() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تمت أرشفة موقع العمل بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر أرشفة موقع العمل");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const deleteWorkLocation = useCallback(
    async (id: string): Promise<boolean> => {
      return archiveWorkLocation(id);
    },
    [archiveWorkLocation],
  );

  const addCostCenter = useCallback(
    async (center: Omit<CostCenter, "id" | "employeeCount" | "managerName">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `create-cost-center-${center.code || center.nameAr}`,
        operation: async () => {
          await createCostCenterRecord(center);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.costCenters() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم إضافة مركز التكلفة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة مركز التكلفة");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const updateCostCenter = useCallback(
    async (
      id: string,
      center: Omit<CostCenter, "id" | "employeeCount" | "managerName">,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `update-cost-center-${id}`,
        operation: async () => {
          await updateCostCenterRecord(id, center);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.costCenters() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث مركز التكلفة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث مركز التكلفة");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const archiveCostCenter = useCallback(
    async (id: string, reassignCcId?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `archive-cost-center-${id}`,
        operation: async () => {
          await archiveCostCenterRecord(id, reassignCcId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.costCenters() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تمت أرشفة مركز التكلفة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر أرشفة مركز التكلفة");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const deleteCostCenter = useCallback(
    async (id: string): Promise<boolean> => {
      return archiveCostCenter(id);
    },
    [archiveCostCenter],
  );

  const addJobPosition = useCallback(
    async (position: Omit<JobPosition, "id" | "filledHeadcount">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `create-job-pos-${position.code || position.titleAr}`,
        operation: async () => {
          await createJobPositionRecord(position);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.positions() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم إضافة المسمى الوظيفي بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة المسمى الوظيفي");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const updateJobPosition = useCallback(
    async (
      id: string,
      position: Omit<JobPosition, "id" | "filledHeadcount">,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `update-job-pos-${id}`,
        operation: async () => {
          await updateJobPositionRecord(id, position);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.positions() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث المسمى الوظيفي بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث المسمى الوظيفي");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const archiveJobPosition = useCallback(
    async (id: string, reassignPosId?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `archive-job-pos-${id}`,
        operation: async () => {
          await archiveJobPositionRecord(id, reassignPosId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.positions() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تمت أرشفة المسمى الوظيفي بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر أرشفة المسمى الوظيفي");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const deleteJobPosition = useCallback(
    async (id: string): Promise<boolean> => {
      return archiveJobPosition(id);
    },
    [archiveJobPosition],
  );

  return {
    updateCompany,
    addOrgUnit,
    updateOrgUnit,
    archiveOrgUnit,
    deleteOrgUnit,
    addSubsidiary,
    updateSubsidiary,
    archiveSubsidiary,
    deleteSubsidiary,
    addWorkLocation,
    updateWorkLocation,
    archiveWorkLocation,
    deleteWorkLocation,
    addCostCenter,
    updateCostCenter,
    archiveCostCenter,
    deleteCostCenter,
    addJobPosition,
    updateJobPosition,
    archiveJobPosition,
    deleteJobPosition,
    getMasterDataDependencies: getMasterDataDependenciesRecord,
  };
}
