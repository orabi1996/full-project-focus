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
  const demoEmployees = useDemoStore((s) => s.employees);

  const query = useQuery({
    queryKey: queryKeys.employees.detail(id || ""),
    queryFn: async () => {
      if (!id) return null;
      if (!isLive) {
        return demoEmployees.find((e) => e.id === id) ?? null;
      }
      return fetchEmployeeDetailRecord(id);
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const employee = useMemo(() => {
    if (!id) return null;
    if (!isLive) {
      return demoEmployees.find((e) => e.id === id) ?? null;
    }
    return query.data ?? null;
  }, [id, isLive, query.data, demoEmployees]);

  return {
    employee,
    data: employee,
    isLoading: query.isLoading || (isLive && !employee && query.isFetching),
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useEmployeeDirectory(filters: EmployeeDirectoryFilters = {}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoEmployees = useDemoStore((s) => s.employees);

  const query = useQuery({
    queryKey: queryKeys.employees.directory(filters as Record<string, unknown>),
    queryFn: async (): Promise<EmployeeDirectoryResponse> => {
      if (!isLive) {
        let filtered = [...demoEmployees];
        if (filters.status && filters.status !== "all") {
          filtered = filtered.filter((e) => e.status === filters.status);
        }
        if (filters.departmentId && filters.departmentId !== "all") {
          filtered = filtered.filter((e) => e.departmentId === filters.departmentId);
        }
        if (filters.subsidiaryId && filters.subsidiaryId !== "all") {
          filtered = filtered.filter((e) => e.subsidiaryId === filters.subsidiaryId);
        }
        if (filters.locationId && filters.locationId !== "all") {
          filtered = filtered.filter((e) => e.workLocationId === filters.locationId);
        }
        if (filters.contractType && filters.contractType !== "all") {
          filtered = filtered.filter((e) => e.contractType === filters.contractType);
        }
        if (filters.nationality && filters.nationality !== "all") {
          filtered = filtered.filter((e) => e.nationality === filters.nationality);
        }
        if (filters.gender && filters.gender !== "all") {
          filtered = filtered.filter((e) => e.gender === filters.gender);
        }
        if (filters.quickPreset) {
          if (filters.quickPreset === "saudi") {
            filtered = filtered.filter((e) => e.nationality === "Saudi" || e.nationality === "سعودي" || e.nationality === "سعودية");
          } else if (filters.quickPreset === "expat") {
            filtered = filtered.filter((e) => e.nationality !== "Saudi" && e.nationality !== "سعودي" && e.nationality !== "سعودية");
          } else if (filters.quickPreset === "probation") {
            filtered = filtered.filter((e) => e.status === "probation");
          } else if (filters.quickPreset === "on_leave") {
            filtered = filtered.filter((e) => e.status === "on_leave");
          }
        }
        if (filters.minSalary !== undefined) {
          filtered = filtered.filter((e) => (e.basicSalary ?? 0) >= filters.minSalary!);
        }
        if (filters.maxSalary !== undefined) {
          filtered = filtered.filter((e) => (e.basicSalary ?? 0) <= filters.maxSalary!);
        }
        if (filters.search?.trim()) {
          const s = filters.search.trim().toLowerCase();
          filtered = filtered.filter(
            (e) =>
              e.employeeNo.toLowerCase().includes(s) ||
              e.firstNameAr.toLowerCase().includes(s) ||
              e.lastNameAr.toLowerCase().includes(s) ||
              (e.fullName ? e.fullName.toLowerCase().includes(s) : false) ||
              (e.email && e.email.toLowerCase().includes(s)),
          );
        }

        const sort = filters.sort || "name_asc";
        filtered.sort((a, b) => {
          if (sort === "name_asc") {
            const nameA = a.fullName || `${a.firstNameAr} ${a.lastNameAr}`;
            const nameB = b.fullName || `${b.firstNameAr} ${b.lastNameAr}`;
            return nameA.localeCompare(nameB, "ar");
          } else if (sort === "name_desc") {
            const nameA = a.fullName || `${a.firstNameAr} ${a.lastNameAr}`;
            const nameB = b.fullName || `${b.firstNameAr} ${b.lastNameAr}`;
            return nameB.localeCompare(nameA, "ar");
          } else if (sort === "hire_date_desc") {
            return (b.hireDate || "").localeCompare(a.hireDate || "");
          } else if (sort === "hire_date_asc") {
            return (a.hireDate || "").localeCompare(b.hireDate || "");
          } else if (sort === "employee_no_asc") {
            return (a.employeeNo || "").localeCompare(b.employeeNo || "");
          } else if (sort === "employee_no_desc") {
            return (b.employeeNo || "").localeCompare(a.employeeNo || "");
          }
          return 0;
        });

        const page = filters.page ?? 1;
        const pageSize = filters.pageSize ?? 25;
        const totalCount = filtered.length;
        const items: EmployeeDirectoryItem[] = filtered
          .slice((page - 1) * pageSize, page * pageSize)
          .map((e) => ({
            id: e.id,
            employeeNo: e.employeeNo,
            firstNameAr: e.firstNameAr,
            lastNameAr: e.lastNameAr,
            firstNameEn: e.firstNameEn,
            lastNameEn: e.lastNameEn,
            fullName: `${e.firstNameAr} ${e.lastNameAr}`.trim() || e.fullName || `${e.firstNameEn} ${e.lastNameEn}`.trim() || "موظف",
            email: e.email,
            phone: e.phone,
            jobTitle: e.jobTitleAr || e.jobTitleEn,
            status: e.status,
            hireDate: e.hireDate,
            contractType: e.contractType ?? null,
            workType: e.workType ?? null,
            departmentId: e.departmentId,
            departmentName: e.departmentName,
            subsidiaryId: e.subsidiaryId,
            subsidiaryName: e.subsidiaryName,
            workLocationId: e.workLocationId,
            workLocationName: e.workLocationName,
            avatarUrl: e.avatarUrl,
            avatarStoragePath: e.avatarStoragePath,
            completionScore: e.completionScore,
            nationality: e.nationality,
            qiwaContractNo: e.qiwaContractNo,
            gender: e.gender,
          }));
        return { items, totalCount, page, pageSize };
      }
      return fetchEmployeeDirectoryRecord(filters);
    },
    staleTime: 30_000,
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
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const demoEmployees = useDemoStore((s) => s.employees);

  const query = useQuery({
    queryKey: queryKeys.employees.kpis(),
    queryFn: async (): Promise<EmployeeDirectoryKpis> => {
      if (!isLive) {
        const totalEmployees = demoEmployees.length;
        const totalEmployed = demoEmployees.filter((e) => ["active", "probation", "on_leave"].includes(e.status)).length;
        const activeEmployees = demoEmployees.filter((e) => e.status === "active").length;
        const saudiEmployees = demoEmployees.filter(
          (e) => e.nationality === "Saudi" || e.nationality === "سعودي" || e.nationality === "سعودية",
        ).length;
        const expatEmployees = demoEmployees.filter(
          (e) => e.nationality && e.nationality !== "Saudi" && e.nationality !== "سعودي" && e.nationality !== "سعودية",
        ).length;
        const unknownNationalityCount = totalEmployees - saudiEmployees - expatEmployees;
        const denominator = saudiEmployees + expatEmployees;
        const saudizationRate = denominator > 0 ? Math.round((saudiEmployees / denominator) * 100) : 0;
        const probationCount = demoEmployees.filter((e) => e.status === "probation").length;
        const onLeaveCount = demoEmployees.filter((e) => e.status === "on_leave").length;
        return {
          available: true,
          totalEmployees,
          totalEmployed,
          activeEmployees,
          saudiEmployees,
          expatEmployees,
          nonSaudiEmployees: expatEmployees,
          unknownNationalityCount,
          saudizationRate,
          probationCount,
          onLeaveCount,
          expiringDocsCount: 0,
          hrRestricted: false,
        };
      }
      return fetchEmployeeDirectoryKpisRecord();
    },
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

export function useUpdateEmployeeHrProfile() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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
        demoOperation: () => {
          demoStore.employees = demoStore.employees.map((e) =>
            e.id === payload.employeeId
              ? {
                  ...e,
                  firstNameAr: payload.firstNameAr,
                  lastNameAr: payload.lastNameAr,
                  firstNameEn: payload.firstNameEn ?? e.firstNameEn,
                  lastNameEn: payload.lastNameEn ?? e.lastNameEn,
                  email: payload.email ?? e.email,
                  phone: payload.phone ?? e.phone,
                  nationalIdOrIqama: payload.nationalId ?? e.nationalIdOrIqama,
                  nationality: payload.nationality ?? e.nationality,
                  gender: (payload.gender as Employee["gender"]) ?? e.gender,
                  birthDate: payload.birthDate ?? e.birthDate,
                  maritalStatus: (payload.maritalStatus as Employee["maritalStatus"]) ?? e.maritalStatus,
                  jobTitleAr: payload.jobTitle ?? e.jobTitleAr,
                }
              : e,
          );
          demoStore.notify();
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
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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
        demoOperation: () => {
          demoStore.employees = demoStore.employees.map((e) =>
            e.id === payload.employeeId
              ? {
                  ...e,
                  departmentId: payload.departmentId ?? e.departmentId,
                  subsidiaryId: payload.subsidiaryId ?? e.subsidiaryId,
                  workLocationId: payload.workLocationId ?? e.workLocationId,
                  jobPositionId: payload.jobPositionId ?? e.jobPositionId,
                  costCenterId: payload.costCenterId ?? e.costCenterId,
                  managerId: payload.managerId ?? e.managerId,
                  workType: (payload.workType as Employee["workType"]) ?? e.workType,
                }
              : e,
          );
          demoStore.notify();
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
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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
        demoOperation: () => {
          demoStore.employees = demoStore.employees.map((e) =>
            e.id === payload.employeeId
              ? {
                  ...e,
                  bankName: payload.bankName,
                  iban: payload.iban,
                }
              : e,
          );
          demoStore.notify();
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
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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
        demoOperation: () => {
          demoStore.employees = demoStore.employees.map((e) =>
            e.id === payload.employeeId
              ? {
                  ...e,
                  basicSalary: payload.basicSalary,
                  housingAllowance: payload.housingAllowance ?? 0,
                  transportAllowance: payload.transportAllowance ?? 0,
                  otherAllowances: payload.otherAllowances ?? 0,
                  totalSalary:
                    payload.basicSalary +
                    (payload.housingAllowance ?? 0) +
                    (payload.transportAllowance ?? 0) +
                    (payload.otherAllowances ?? 0),
                }
              : e,
          );
          demoStore.notify();
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

