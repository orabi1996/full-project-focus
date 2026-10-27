import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type {
  Employee,
  EmployeeDirectoryFilters,
  EmployeeDirectoryResponse,
  EmployeeDirectoryItem,
  EmployeeDirectoryKpis,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  createEmployeeRecord,
  updateEmployeeRecord,
  changeEmployeeStatusRecord,
  bulkChangeEmployeeStatusRecord,
  rehireEmployeeRecord,
  fetchSingleEmployee,
  fetchEmployeeDetailRecord,
  fetchEmployeeDirectoryRecord,
  fetchEmployeeDirectoryKpisRecord,
  updateEmployeeHrProfileRecord,
  updateEmployeeAssignmentRecord,
  updateEmployeeBankDetailsRecord,
  updateEmployeeCompensationRecord,
} from "../../data/hrms-repository";
import { queryKeys } from "../../query/query-keys";
import { createSignedDownloadUrl } from "../../storage/storage-service";
import { isStorageInDemoMode } from "../../storage/storage-service";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { toast } from "sonner";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { calculateProfileCompletion } from "./completion";

export const isEmployedStatus = (e: { status?: string | null }) =>
  Boolean(e.status && ["active", "probation", "on_leave"].includes(e.status));

export function useEmployees() {
  const bootstrap = useBootstrapData();

  return {
    employees: bootstrap.employees ?? [],
    data: bootstrap.employees ?? [],
    isLoading: bootstrap.isLoading,
    isError: bootstrap.isError,
    error: bootstrap.error,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useEmployee(id?: string | null) {
  const query = useQuery({
    queryKey: queryKeys.employees.detail(id || ""),
    queryFn: async () => {
      if (!id) return null;
      return fetchEmployeeDetailRecord(id);
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const employee = useMemo(() => {
    if (!id) return null;
    return query.data ?? null;
  }, [id, query.data]);

  return {
    employee,
    data: employee,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useEmployeeDirectory(
  filters: EmployeeDirectoryFilters = {},
  options?: { enabled?: boolean },
) {
  const query = useQuery({
    queryKey: queryKeys.employees.directory(filters as Record<string, unknown>),
    queryFn: () => fetchEmployeeDirectoryRecord(filters),
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });

  return {
    ...query,
    items: query.data?.items ?? [],
    totalCount: query.data?.totalCount ?? 0,
    page: query.data?.page ?? (filters.page ?? 1),
    pageSize: query.data?.pageSize ?? (filters.pageSize ?? 25),
  };
}

export function useEmployeeDirectoryKpis() {
  const query = useQuery({
    queryKey: queryKeys.employees.kpis(),
    queryFn: () => fetchEmployeeDirectoryKpisRecord(),
    staleTime: 60_000,
  });

  return {
    kpis: query.data ?? null,
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useEmployeeAvatar(avatarStoragePath?: string | null, fallbackAvatarUrl?: string | null) {
  const query = useQuery({
    queryKey: ["employee-avatar-url", avatarStoragePath || fallbackAvatarUrl || "none"],
    queryFn: async () => {
      if (!avatarStoragePath) {
        return fallbackAvatarUrl || "";
      }
      if (isStorageInDemoMode()) {
        return fallbackAvatarUrl || "";
      }
      try {
        const result = await createSignedDownloadUrl("employee-avatars", avatarStoragePath, {
          expiresInSeconds: 3600,
        });
        return result.signedUrl;
      } catch (err) {
        console.warn("Failed to generate signed avatar URL:", err);
        return fallbackAvatarUrl || "";
      }
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: Boolean(avatarStoragePath || fallbackAvatarUrl),
  });

  return query.data ?? fallbackAvatarUrl ?? "";
}

export function useCreateEmployee() {
  const mode: MutationDataMode = "live";
  const queryClient = useQueryClient();

  const createEmployee = useCallback(
    async (empInput: Omit<Employee, "id" | "completionScore">): Promise<boolean> => {
      const calculatedScore = calculateProfileCompletion(empInput);

      const newEmp: Employee = {
        ...empInput,
        id: "",
        completionScore: calculatedScore,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-employee-${newEmp.nationalIdOrIqama || newEmp.employeeNo || newEmp.email}`,
        operation: async () => {
          const created = await createEmployeeRecord(newEmp);
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.all });
          return Boolean(created);
        },
        onCommitted: () => {
          toast.success("تم إضافة الموظف وتحديث السجلات بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة الموظف");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return { createEmployee };
}

export function useUpdateEmployee() {
  const mode: MutationDataMode = "live";
  const queryClient = useQueryClient();

  const updateEmployee = useCallback(
    async (id: string, updates: Partial<Employee>): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-employee-${id}`,
        operation: async () => {
          await updateEmployeeRecord(id, updates);
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(id) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم حفظ التغييرات وتحديث بيانات الموظف في النظام");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث بيانات الموظف");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return { updateEmployee };
}

export function useChangeEmployeeStatus() {
  const mode: MutationDataMode = "live";
  const queryClient = useQueryClient();

  const changeStatus = useCallback(
    async (
      employeeId: string,
      newStatus: Employee["status"],
      effectiveDate?: string,
      reason?: string,
      terminationType?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `change-status-${employeeId}-${newStatus}`,
        operation: async () => {
          await changeEmployeeStatusRecord(
            employeeId,
            newStatus,
            effectiveDate,
            reason,
            terminationType,
          );
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(employeeId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث حالة الموظف بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث حالة الموظف");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return { changeStatus };
}

export function useBulkChangeStatus() {
  const mode: MutationDataMode = "live";
  const queryClient = useQueryClient();

  const bulkChangeStatus = useCallback(
    async (
      employeeIds: string[],
      newStatus: Employee["status"],
      effectiveDate?: string,
      reason?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `bulk-status-${newStatus}-${Date.now()}`,
        operation: async () => {
          await bulkChangeEmployeeStatusRecord(employeeIds, newStatus, effectiveDate, reason);
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.all });
          return true;
        },
        onCommitted: () => {
          toast.success(`تم تحديث حالة (${employeeIds.length}) موظفاً بنجاح`);
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث الحالة الجماعي للموظفين");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return { bulkChangeStatus };
}

export function useRehireEmployee() {
  const mode: MutationDataMode = "live";
  const queryClient = useQueryClient();

  const rehire = useCallback(
    async (
      employeeId: string,
      rehireDate?: string,
      newStatus: Employee["status"] = "probation",
      newDeptId?: string,
      newPositionId?: string,
      reason?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `rehire-employee-${employeeId}`,
        operation: async () => {
          await rehireEmployeeRecord(
            employeeId,
            rehireDate,
            newStatus,
            newDeptId,
            newPositionId,
            reason,
          );
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(employeeId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم إعادة تعيين الموظف بنجاح وتسجيل العملية في السجل التاريخي");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إعادة تعيين الموظف");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return { rehire };
}

export function useUpdateEmployeeHrProfile() {
  const mode: MutationDataMode = "live";
  const queryClient = useQueryClient();

  const updateHrProfile = useCallback(
    async (payload: Parameters<typeof updateEmployeeHrProfileRecord>[0]): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-hr-profile-${payload.employeeId}`,
        operation: async () => {
          await updateEmployeeHrProfileRecord(payload);
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(payload.employeeId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث البيانات الشخصية بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث البيانات الشخصية");
        },
      });
      return result.ok;
    },
    [mode, queryClient],
  );

  return { updateHrProfile };
}

export function useUpdateEmployeeAssignment() {
  const mode: MutationDataMode = "live";
  const queryClient = useQueryClient();

  const updateAssignment = useCallback(
    async (payload: Parameters<typeof updateEmployeeAssignmentRecord>[0]): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-assignment-${payload.employeeId}`,
        operation: async () => {
          await updateEmployeeAssignmentRecord(payload);
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(payload.employeeId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث التعيين الإداري بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث التعيين الإداري");
        },
      });
      return result.ok;
    },
    [mode, queryClient],
  );

  return { updateAssignment };
}

export function useUpdateEmployeeBankDetails() {
  const mode: MutationDataMode = "live";
  const queryClient = useQueryClient();

  const updateBankDetails = useCallback(
    async (payload: Parameters<typeof updateEmployeeBankDetailsRecord>[0]): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-bank-${payload.employeeId}`,
        operation: async () => {
          await updateEmployeeBankDetailsRecord(payload);
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(payload.employeeId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث الحساب البنكي بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث الحساب البنكي");
        },
      });
      return result.ok;
    },
    [mode, queryClient],
  );

  return { updateBankDetails };
}

export function useUpdateEmployeeCompensation() {
  const mode: MutationDataMode = "live";
  const queryClient = useQueryClient();

  const updateCompensation = useCallback(
    async (payload: Parameters<typeof updateEmployeeCompensationRecord>[0]): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `update-comp-${payload.employeeId}`,
        operation: async () => {
          await updateEmployeeCompensationRecord(payload);
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(payload.employeeId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        onCommitted: () => {
          toast.success("تم تحديث البيانات المالية بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث البيانات المالية");
        },
      });
      return result.ok;
    },
    [mode, queryClient],
  );

  return { updateCompensation };
}

