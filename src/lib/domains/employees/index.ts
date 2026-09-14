import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { Employee } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  createEmployeeRecord,
  updateEmployeeRecord,
  changeEmployeeStatusRecord,
  bulkChangeEmployeeStatusRecord,
  rehireEmployeeRecord,
  fetchSingleEmployee,
} from "../../data/hrms-repository";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { calculateProfileCompletion } from "./completion";

export function useEmployees() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoEmployees = useDemoStore((s) => s.employees);

  const employees = isLive ? bootstrap.employees : demoEmployees;

  return {
    employees,
    data: employees,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useEmployee(id?: string | null) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const { employees, isLoading: isListLoading } = useEmployees();

  const query = useQuery({
    queryKey: queryKeys.employees.detail(id || ""),
    queryFn: async () => {
      if (!id) return null;
      if (!isLive) {
        return employees.find((e) => e.id === id) ?? null;
      }
      return fetchSingleEmployee(id);
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const employee = useMemo(() => {
    if (!id) return null;
    if (query.data !== undefined && query.data !== null) return query.data;
    return employees.find((e) => e.id === id) ?? null;
  }, [id, query.data, employees]);

  return {
    employee,
    data: employee,
    isLoading: query.isLoading || (isLive && !employee && isListLoading),
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateEmployee() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const createEmployee = useCallback(
    async (empInput: Omit<Employee, "id" | "completionScore">): Promise<boolean> => {
      const calculatedScore = calculateProfileCompletion(empInput);

      // In Live mode, ID will be set by PostgreSQL UUID.
      // In Demo mode, we use crypto.randomUUID()
      const newEmp: Employee = {
        ...empInput,
        id: mode === "demo" ? crypto.randomUUID() : "",
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
        demoOperation: () => {
          demoStore.employees = [newEmp, ...demoStore.employees];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success(
            mode === "live"
              ? "تم إضافة الموظف وتحديث السجلات بنجاح"
              : "تم إضافة الموظف بنجاح (وضع العرض التجريبي)",
          );
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
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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
        demoOperation: () => {
          demoStore.employees = demoStore.employees.map((e) =>
            e.id === id ? { ...e, ...updates } : e,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success(
            mode === "live"
              ? "تم حفظ التغييرات وتحديث بيانات الموظف في النظام"
              : "تم تحديث بيانات الموظف بنجاح (وضع العرض التجريبي)",
          );
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
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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
        demoOperation: () => {
          demoStore.employees = demoStore.employees.map((e) =>
            e.id === employeeId
              ? {
                  ...e,
                  status: newStatus,
                  terminationDate:
                    newStatus === "terminated"
                      ? effectiveDate || new Date().toISOString().split("T")[0]
                      : e.terminationDate,
                  terminationReason: newStatus === "terminated" ? reason : e.terminationReason,
                  terminationType: newStatus === "terminated" ? terminationType : e.terminationType,
                }
              : e,
          );
          demoStore.notify();
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
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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
        demoOperation: () => {
          demoStore.employees = demoStore.employees.map((e) =>
            employeeIds.includes(e.id) ? { ...e, status: newStatus } : e,
          );
          demoStore.notify();
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
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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
        demoOperation: () => {
          demoStore.employees = demoStore.employees.map((e) =>
            e.id === employeeId
              ? {
                  ...e,
                  status: newStatus,
                  rehireDate: rehireDate || new Date().toISOString().split("T")[0],
                  departmentId: newDeptId || e.departmentId,
                  jobPositionId: newPositionId || e.jobPositionId,
                }
              : e,
          );
          demoStore.notify();
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
