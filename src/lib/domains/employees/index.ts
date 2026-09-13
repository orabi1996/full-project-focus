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

export function useCreateEmployee() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const createEmployee = useCallback(
    async (empInput: Omit<Employee, "id" | "completionScore">): Promise<boolean> => {
      const newEmp: Employee = {
        ...empInput,
        id: `emp-${Date.now()}`,
        completionScore: 75,
      };

      if (!isLive) {
        demoStore.employees = [newEmp, ...demoStore.employees];
        demoStore.notify();
        toast.success("تم إضافة الموظف بنجاح (وضع العرض التجريبي)");
        return true;
      }

      try {
        await createEmployeeRecord(newEmp);
        await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.organization.all });
        toast.success("تم إضافة الموظف وتحديث السجلات بنجاح");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "تعذر إضافة الموظف";
        toast.error(message);
        throw err;
      }
    },
    [isLive, queryClient],
  );

  return { createEmployee };
}

export function useUpdateEmployee() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const updateEmployee = useCallback(
    async (id: string, updates: Partial<Employee>): Promise<boolean> => {
      if (!isLive) {
        demoStore.employees = demoStore.employees.map((e) =>
          e.id === id ? { ...e, ...updates } : e,
        );
        demoStore.notify();
        toast.success("تم تحديث بيانات الموظف بنجاح (وضع العرض التجريبي)");
        return true;
      }

      try {
        await updateEmployeeRecord(id, updates);
        await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(id) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم حفظ التغييرات وتحديث بيانات الموظف في النظام");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "تعذر تحديث بيانات الموظف";
        toast.error(message);
        throw err;
      }
    },
    [isLive, queryClient],
  );

  return { updateEmployee };
}
