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
          toast.success("تم حفظ بيانات المنشأة بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.company = { ...profile };
          demoStore.notify();
          toast.success("تم تحديث بيانات المنشأة بنجاح (وضع العرض التجريبي)");
          return true;
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
      const newUnit: OrgUnit = {
        ...unit,
        id: `org-${Date.now()}`,
        employeeCount: 0,
      };
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-org-unit-${unit.code || unit.nameAr}`,
        operation: async () => {
          await createOrganizationUnitRecord(newUnit);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.units() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم حفظ الوحدة التنظيمية بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.orgUnits = [...demoStore.orgUnits, newUnit];
          demoStore.notify();
          toast.success("تم إضافة الوحدة الإدارية بنجاح");
          return true;
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
          toast.success("تم تحديث بيانات الوحدة التنظيمية");
          return true;
        },
        demoOperation: () => {
          demoStore.orgUnits = demoStore.orgUnits.map((u) =>
            u.id === id ? { ...u, ...unit } : u,
          );
          demoStore.notify();
          toast.success("تم تحديث الوحدة الإدارية بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث الوحدة التنظيمية");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const deleteOrgUnit = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `delete-org-unit-${id}`,
        operation: async () => {
          await deleteOrganizationUnitRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.units() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم حذف الوحدة التنظيمية");
          return true;
        },
        demoOperation: () => {
          demoStore.orgUnits = demoStore.orgUnits.filter((u) => u.id !== id);
          demoStore.notify();
          toast.success("تم حذف الوحدة الإدارية بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حذف الوحدة التنظيمية");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const addSubsidiary = useCallback(
    async (subsidiary: Omit<Subsidiary, "id" | "employeeCount">): Promise<boolean> => {
      const newSub: Subsidiary = {
        ...subsidiary,
        id: `sub-${Date.now()}`,
        employeeCount: 0,
      };
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-subsidiary-${subsidiary.code || subsidiary.nameAr}`,
        operation: async () => {
          await createSubsidiaryRecord(newSub);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.subsidiaries() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم إضافة الشركة التابعة بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.subsidiaries = [...demoStore.subsidiaries, newSub];
          demoStore.notify();
          toast.success("تم إضافة الشركة التابعة بنجاح");
          return true;
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
          toast.success("تم تحديث بيانات الشركة التابعة");
          return true;
        },
        demoOperation: () => {
          demoStore.subsidiaries = demoStore.subsidiaries.map((s) =>
            s.id === id ? { ...s, ...subsidiary } : s,
          );
          demoStore.notify();
          toast.success("تم تحديث الشركة التابعة بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث الشركة التابعة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const deleteSubsidiary = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `delete-subsidiary-${id}`,
        operation: async () => {
          await deleteSubsidiaryRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.subsidiaries() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم حذف الشركة التابعة");
          return true;
        },
        demoOperation: () => {
          demoStore.subsidiaries = demoStore.subsidiaries.filter((s) => s.id !== id);
          demoStore.notify();
          toast.success("تم حذف الشركة التابعة بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حذف الشركة التابعة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const addWorkLocation = useCallback(
    async (location: Omit<WorkLocation, "id">): Promise<boolean> => {
      const newLoc: WorkLocation = {
        ...location,
        id: `loc-${Date.now()}`,
      };
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-location-${location.code || location.nameAr}`,
        operation: async () => {
          await createWorkLocationRecord(newLoc);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.locations() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم إضافة موقع العمل بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.workLocations = [...demoStore.workLocations, newLoc];
          demoStore.notify();
          toast.success("تم إضافة موقع العمل بنجاح");
          return true;
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
          toast.success("تم تحديث موقع العمل");
          return true;
        },
        demoOperation: () => {
          demoStore.workLocations = demoStore.workLocations.map((l) =>
            l.id === id ? { ...l, ...location } : l,
          );
          demoStore.notify();
          toast.success("تم تحديث موقع العمل بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث موقع العمل");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const deleteWorkLocation = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `delete-location-${id}`,
        operation: async () => {
          await deleteWorkLocationRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.locations() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم حذف موقع العمل");
          return true;
        },
        demoOperation: () => {
          demoStore.workLocations = demoStore.workLocations.filter((l) => l.id !== id);
          demoStore.notify();
          toast.success("تم حذف موقع العمل بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حذف موقع العمل");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const addCostCenter = useCallback(
    async (center: Omit<CostCenter, "id" | "employeeCount" | "managerName">): Promise<boolean> => {
      const newCenter: CostCenter = {
        ...center,
        id: `cc-${Date.now()}`,
        employeeCount: 0,
      };
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-cost-center-${center.code || center.nameAr}`,
        operation: async () => {
          await createCostCenterRecord(newCenter);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.costCenters() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم إضافة مركز التكلفة");
          return true;
        },
        demoOperation: () => {
          demoStore.costCenters = [...demoStore.costCenters, newCenter];
          demoStore.notify();
          toast.success("تم إضافة مركز التكلفة بنجاح");
          return true;
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
          toast.success("تم تحديث مركز التكلفة");
          return true;
        },
        demoOperation: () => {
          demoStore.costCenters = demoStore.costCenters.map((c) =>
            c.id === id ? { ...c, ...center } : c,
          );
          demoStore.notify();
          toast.success("تم تحديث مركز التكلفة بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث مركز التكلفة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const deleteCostCenter = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `delete-cost-center-${id}`,
        operation: async () => {
          await deleteCostCenterRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.costCenters() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم حذف مركز التكلفة");
          return true;
        },
        demoOperation: () => {
          demoStore.costCenters = demoStore.costCenters.filter((c) => c.id !== id);
          demoStore.notify();
          toast.success("تم حذف مركز التكلفة بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حذف مركز التكلفة");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const addJobPosition = useCallback(
    async (position: Omit<JobPosition, "id" | "filledHeadcount">): Promise<boolean> => {
      const newPos: JobPosition = {
        ...position,
        id: `pos-${Date.now()}`,
        filledHeadcount: 0,
      };
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-job-pos-${position.code || position.titleAr}`,
        operation: async () => {
          await createJobPositionRecord(newPos);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.positions() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم إضافة المسمى الوظيفي");
          return true;
        },
        demoOperation: () => {
          demoStore.jobPositions = [...demoStore.jobPositions, newPos];
          demoStore.notify();
          toast.success("تم إضافة المسمى الوظيفي بنجاح");
          return true;
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
          toast.success("تم تحديث المسمى الوظيفي");
          return true;
        },
        demoOperation: () => {
          demoStore.jobPositions = demoStore.jobPositions.map((p) =>
            p.id === id ? { ...p, ...position } : p,
          );
          demoStore.notify();
          toast.success("تم تحديث المسمى الوظيفي بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث المسمى الوظيفي");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const deleteJobPosition = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `delete-job-pos-${id}`,
        operation: async () => {
          await deleteJobPositionRecord(id);
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.positions() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم حذف المسمى الوظيفي");
          return true;
        },
        demoOperation: () => {
          demoStore.jobPositions = demoStore.jobPositions.filter((p) => p.id !== id);
          demoStore.notify();
          toast.success("تم حذف المسمى الوظيفي بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حذف المسمى الوظيفي");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return {
    updateCompany,
    addOrgUnit,
    updateOrgUnit,
    deleteOrgUnit,
    addSubsidiary,
    updateSubsidiary,
    deleteSubsidiary,
    addWorkLocation,
    updateWorkLocation,
    deleteWorkLocation,
    addCostCenter,
    updateCostCenter,
    deleteCostCenter,
    addJobPosition,
    updateJobPosition,
    deleteJobPosition,
  };
}
