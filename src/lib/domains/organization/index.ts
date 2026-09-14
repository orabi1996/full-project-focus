
/** Canonical workforce employed definition: active, probation, on_leave (excludes terminated, suspended) */
export const isEmployedWorkforce = (status?: string | null): boolean => {
  return status === "active" || status === "probation" || status === "on_leave";
};
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
import { useAuth } from "../../auth/AuthContext";
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
  deleteCostCenterRecord,
  deleteJobPositionRecord,
  deleteOrganizationUnitRecord,
  deleteSubsidiaryRecord,
  deleteWorkLocationRecord,
  getMasterDataDependenciesRecord,
  updateCompanyRecord,
  updateCostCenterRecord,
  updateJobPositionRecord,
  updateOrganizationUnitRecord,
  updateSubsidiaryRecord,
  updateWorkLocationRecord,
} from "../../data/operational-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function useOrganization() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoData = useDemoStore((s) => ({
    company: s.company,
    subsidiaries: s.subsidiaries,
    orgUnits: s.orgUnits,
    workLocations: s.workLocations,
    costCenters: s.costCenters,
    jobPositions: s.jobPositions,
  }));

  const company = isLive ? bootstrap.company : demoData.company;
  const subsidiaries = isLive ? bootstrap.subsidiaries : demoData.subsidiaries;
  const orgUnits = isLive ? bootstrap.orgUnits : demoData.orgUnits;
  const workLocations = isLive ? bootstrap.workLocations : demoData.workLocations;
  const costCenters = isLive ? bootstrap.costCenters : demoData.costCenters;
  const jobPositions = isLive ? bootstrap.jobPositions : demoData.jobPositions;

  return {
    company,
    subsidiaries,
    orgUnits,
    workLocations,
    costCenters,
    jobPositions,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useOrganizationMutations() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const updateCompany = useCallback(
    async (profile: CompanyProfile): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-company-${profile.id || "main"}`,
        operation: async () => {
          await updateCompanyRecord(profile);
          await queryClient.invalidateQueries({ queryKey: queryKeys.company.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.company = { ...profile };
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success(
            mode === "live"
              ? "تم حفظ بيانات المنشأة بنجاح"
              : "تم تحديث بيانات المنشأة بنجاح (وضع العرض التجريبي)",
          );
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ بيانات المنشأة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const addOrgUnit = useCallback(
    async (unit: Omit<OrgUnit, "id" | "employeeCount">): Promise<boolean> => {
      let createdUnit: OrgUnit | null = null;
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-org-unit-${unit.code || unit.nameAr}`,
        operation: async () => {
          createdUnit = await createOrganizationUnitRecord(unit);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.units() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          createdUnit = {
            ...unit,
            id: crypto.randomUUID(),
            employeeCount: 0,
          };
          demoStore.orgUnits = [...demoStore.orgUnits, createdUnit];
          demoStore.notify();
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
    [mode, queryClient],
  );

  const updateOrgUnit = useCallback(
    async (id: string, unit: Omit<OrgUnit, "id" | "employeeCount">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-org-unit-${id}`,
        operation: async () => {
          await updateOrganizationUnitRecord(id, unit);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.units() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.orgUnits = demoStore.orgUnits.map((u) =>
            u.id === id ? { ...u, ...unit } : u,
          );
          demoStore.notify();
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
    [mode, queryClient],
  );

  const archiveOrgUnit = useCallback(
    async (
      id: string,
      reassignDeptId?: string,
      reparentChildrenTo?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `archive-org-unit-${id}`,
        operation: async () => {
          await archiveOrganizationUnitRecord(id, reassignDeptId, reparentChildrenTo);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.units() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.orgUnits = demoStore.orgUnits.filter((u) => u.id !== id);
          if (reassignDeptId) {
            demoStore.employees = demoStore.employees.map((e) =>
              e.departmentId === id ? { ...e, departmentId: reassignDeptId } : e,
            );
          }
          demoStore.notify();
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
    [mode, queryClient],
  );

  const deleteOrgUnit = useCallback(
    async (id: string): Promise<boolean> => {
      return archiveOrgUnit(id);
    },
    [archiveOrgUnit],
  );

  const addSubsidiary = useCallback(
    async (subsidiary: Omit<Subsidiary, "id" | "employeeCount">): Promise<boolean> => {
      let createdSub: Subsidiary | null = null;
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-subsidiary-${subsidiary.code || subsidiary.nameAr}`,
        operation: async () => {
          createdSub = await createSubsidiaryRecord(subsidiary);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.subsidiaries() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          createdSub = {
            ...subsidiary,
            id: crypto.randomUUID(),
            employeeCount: 0,
          };
          demoStore.subsidiaries = [...demoStore.subsidiaries, createdSub];
          demoStore.notify();
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
    [mode, queryClient],
  );

  const updateSubsidiary = useCallback(
    async (id: string, subsidiary: Omit<Subsidiary, "id" | "employeeCount">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-subsidiary-${id}`,
        operation: async () => {
          await updateSubsidiaryRecord(id, subsidiary);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.subsidiaries() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.subsidiaries = demoStore.subsidiaries.map((s) =>
            s.id === id ? { ...s, ...subsidiary } : s,
          );
          demoStore.notify();
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
    [mode, queryClient],
  );

  const archiveSubsidiary = useCallback(
    async (id: string, reassignSubId?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `archive-subsidiary-${id}`,
        operation: async () => {
          await archiveSubsidiaryRecord(id, reassignSubId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.subsidiaries() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.subsidiaries = demoStore.subsidiaries.filter((s) => s.id !== id);
          demoStore.notify();
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
    [mode, queryClient],
  );

  const deleteSubsidiary = useCallback(
    async (id: string): Promise<boolean> => {
      return archiveSubsidiary(id);
    },
    [archiveSubsidiary],
  );

  const addWorkLocation = useCallback(
    async (location: Omit<WorkLocation, "id">): Promise<boolean> => {
      let createdLoc: WorkLocation | null = null;
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-location-${location.code || location.nameAr}`,
        operation: async () => {
          createdLoc = await createWorkLocationRecord(location);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.locations() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          createdLoc = {
            ...location,
            id: crypto.randomUUID(),
          };
          demoStore.workLocations = [...demoStore.workLocations, createdLoc];
          demoStore.notify();
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
    [mode, queryClient],
  );

  const updateWorkLocation = useCallback(
    async (id: string, location: Omit<WorkLocation, "id">): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-location-${id}`,
        operation: async () => {
          await updateWorkLocationRecord(id, location);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.locations() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.workLocations = demoStore.workLocations.map((l) =>
            l.id === id ? { ...l, ...location } : l,
          );
          demoStore.notify();
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
    [mode, queryClient],
  );

  const archiveWorkLocation = useCallback(
    async (id: string, reassignLocId?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `archive-location-${id}`,
        operation: async () => {
          await archiveWorkLocationRecord(id, reassignLocId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.locations() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.workLocations = demoStore.workLocations.filter((l) => l.id !== id);
          demoStore.notify();
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
    [mode, queryClient],
  );

  const deleteWorkLocation = useCallback(
    async (id: string): Promise<boolean> => {
      return archiveWorkLocation(id);
    },
    [archiveWorkLocation],
  );

  const addCostCenter = useCallback(
    async (center: Omit<CostCenter, "id" | "employeeCount" | "managerName">): Promise<boolean> => {
      let createdCenter: CostCenter | null = null;
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-cost-center-${center.code || center.nameAr}`,
        operation: async () => {
          createdCenter = await createCostCenterRecord(center);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.costCenters() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          createdCenter = {
            ...center,
            id: crypto.randomUUID(),
            employeeCount: 0,
          };
          demoStore.costCenters = [...demoStore.costCenters, createdCenter];
          demoStore.notify();
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
    [mode, queryClient],
  );

  const updateCostCenter = useCallback(
    async (
      id: string,
      center: Omit<CostCenter, "id" | "employeeCount" | "managerName">,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-cost-center-${id}`,
        operation: async () => {
          await updateCostCenterRecord(id, center);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.costCenters() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.costCenters = demoStore.costCenters.map((c) =>
            c.id === id ? { ...c, ...center } : c,
          );
          demoStore.notify();
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
    [mode, queryClient],
  );

  const archiveCostCenter = useCallback(
    async (id: string, reassignCcId?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `archive-cost-center-${id}`,
        operation: async () => {
          await archiveCostCenterRecord(id, reassignCcId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.costCenters() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.costCenters = demoStore.costCenters.filter((c) => c.id !== id);
          demoStore.notify();
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
    [mode, queryClient],
  );

  const deleteCostCenter = useCallback(
    async (id: string): Promise<boolean> => {
      return archiveCostCenter(id);
    },
    [archiveCostCenter],
  );

  const addJobPosition = useCallback(
    async (position: Omit<JobPosition, "id" | "filledHeadcount">): Promise<boolean> => {
      let createdPos: JobPosition | null = null;
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-job-pos-${position.code || position.titleAr}`,
        operation: async () => {
          createdPos = await createJobPositionRecord(position);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.positions() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          createdPos = {
            ...position,
            id: crypto.randomUUID(),
            filledHeadcount: 0,
          };
          demoStore.jobPositions = [...demoStore.jobPositions, createdPos];
          demoStore.notify();
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
    [mode, queryClient],
  );

  const updateJobPosition = useCallback(
    async (
      id: string,
      position: Omit<JobPosition, "id" | "filledHeadcount">,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-job-pos-${id}`,
        operation: async () => {
          await updateJobPositionRecord(id, position);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.positions() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.jobPositions = demoStore.jobPositions.map((p) =>
            p.id === id ? { ...p, ...position } : p,
          );
          demoStore.notify();
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
    [mode, queryClient],
  );

  const archiveJobPosition = useCallback(
    async (id: string, reassignPosId?: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `archive-job-pos-${id}`,
        operation: async () => {
          await archiveJobPositionRecord(id, reassignPosId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.positions() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.jobPositions = demoStore.jobPositions.filter((p) => p.id !== id);
          demoStore.notify();
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
    [mode, queryClient],
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
