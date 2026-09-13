import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { Employee } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { createEmployeeRecord, updateEmployeeRecord } from "../../data/hrms-repository";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

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
  const { employees, isLoading, isError, error, refetch } = useEmployees();

  const employee = useMemo(() => {
    if (!id) return null;
    return employees.find((e) => e.id === id) ?? null;
  }, [employees, id]);

  return {
    employee,
    data: employee,
    isLoading,
    isError,
    error,
    refetch,
  };
}

import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";

export function useCreateEmployee() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const createEmployee = useCallback(
    async (empInput: Omit<Employee, "id" | "completionScore">): Promise<boolean> => {
      const newEmp: Employee = {
        ...empInput,
        id: `emp-${Date.now()}`,
        completionScore: 75,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-employee-${newEmp.nationalIdOrIqama || newEmp.employeeNo || newEmp.email}`,
        operation: async () => {
          await createEmployeeRecord(newEmp);
          await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.organization.all });
          return true;
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
