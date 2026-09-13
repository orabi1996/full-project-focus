import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { DataScope, RoleDefinition } from "../../../types";
import {
  INITIAL_ENTERPRISE_GROUPS,
  type PermissionGroup,
  type ScreenActionPermissions,
} from "../../auth/rbac-definitions";
import { useAuth } from "../../auth/AuthContext";
import { createRoleDefinitionRecord } from "../../data/operational-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function useRbac() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoRoles = useDemoStore((s) => s.roles);

  const roles = isLive ? bootstrap.roles : demoRoles;

  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>(() => {
    try {
      const stored = localStorage.getItem("focus_hrms_permission_groups");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return INITIAL_ENTERPRISE_GROUPS;
  });

  const [userPermissionOverrides, setUserPermissionOverrides] = useState<
    Record<string, Record<string, ScreenActionPermissions>>
  >(() => {
    try {
      const stored = localStorage.getItem("focus_hrms_user_perm_overrides");
      if (stored) return JSON.parse(stored);
    } catch {
      // Ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem("focus_hrms_permission_groups", JSON.stringify(permissionGroups));
    } catch {
      // Ignore
    }
  }, [permissionGroups]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "focus_hrms_user_perm_overrides",
        JSON.stringify(userPermissionOverrides),
      );
    } catch {
      // Ignore
    }
  }, [userPermissionOverrides]);

  return {
    roles,
    permissionGroups,
    userPermissionOverrides,
    setPermissionGroups,
    setUserPermissionOverrides,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useRbacMutations(
  setPermissionGroups: React.Dispatch<React.SetStateAction<PermissionGroup[]>>,
  setUserPermissionOverrides: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, ScreenActionPermissions>>>
  >,
) {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const addRole = useCallback(
    async (
      roleInput: Omit<RoleDefinition, "id" | "userCount" | "permissions"> & {
        dataScope: DataScope;
      },
    ): Promise<RoleDefinition> => {
      const newRole: RoleDefinition = {
        ...roleInput,
        id: `role-${Date.now()}`,
        userCount: 0,
        permissions: [],
      };

      const result = await executeReliableMutation<RoleDefinition>({
        mode,
        mutationKey: `create-role-${roleInput.code}`,
        operation: async () => {
          await createRoleDefinitionRecord({
            code: newRole.code,
            nameAr: newRole.nameAr,
            nameEn: newRole.nameEn,
            descriptionAr: newRole.descriptionAr,
            descriptionEn: newRole.descriptionEn,
            isSystem: newRole.isSystem,
            dataScope: roleInput.dataScope,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return newRole;
        },
        demoOperation: () => {
          demoStore.roles = [...demoStore.roles, newRole];
          demoStore.notify();
          return newRole;
        },
        onCommitted: () => {
          toast.success("تم حفظ الدور الوظيفي بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ الدور الوظيفي");
        },
      });

      if (!result.ok || !result.data) {
        throw result.error || new Error("تعذر حفظ الدور الوظيفي");
      }
      return result.data;
    },
    [mode, queryClient],
  );

  const createPermissionGroup = useCallback(
    (group: Omit<PermissionGroup, "id">): PermissionGroup => {
      const newGroup: PermissionGroup = {
        ...group,
        id: `grp-${Date.now()}`,
      };
      setPermissionGroups((prev) => [...prev, newGroup]);
      toast.success("تم إنشاء مجموعة الصلاحيات بنجاح");
      return newGroup;
    },
    [setPermissionGroups],
  );

  const updatePermissionGroup = useCallback(
    (groupId: string, updates: Partial<PermissionGroup>) => {
      setPermissionGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
      );
      toast.success("تم تحديث إعدادات المجموعة");
    },
    [setPermissionGroups],
  );

  const deletePermissionGroup = useCallback(
    (groupId: string): boolean => {
      setPermissionGroups((prev) => prev.filter((g) => g.id !== groupId));
      toast.success("تم حذف مجموعة الصلاحيات");
      return true;
    },
    [setPermissionGroups],
  );

  const addUsersToGroup = useCallback(
    (groupId: string, userIds: string[]) => {
      setPermissionGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const merged = Array.from(new Set([...g.memberUserIds, ...userIds]));
          return { ...g, memberUserIds: merged };
        }),
      );
      toast.success("تم تعيين المستخدمين للمجموعة");
    },
    [setPermissionGroups],
  );

  const removeUserFromGroup = useCallback(
    (groupId: string, userId: string) => {
      setPermissionGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            memberUserIds: g.memberUserIds.filter((id: string) => id !== userId),
          };
        }),
      );
      toast.success("تم استبعاد المستخدم من المجموعة");
    },
    [setPermissionGroups],
  );

  const updateUserScreenPermissions = useCallback(
    (userId: string, screenId: string, actions: Partial<ScreenActionPermissions>) => {
      setUserPermissionOverrides((prev) => {
        const userScreens = prev[userId] || {};
        const currentActions: ScreenActionPermissions = userScreens[screenId] || {
          view: true,
          create: false,
          edit: false,
          delete: false,
          export: false,
          approve: false,
        };
        return {
          ...prev,
          [userId]: {
            ...userScreens,
            [screenId]: {
              ...currentActions,
              ...actions,
            },
          },
        };
      });
      toast.success("تم تخصيص صلاحيات المستخدم على هذه الشاشة");
    },
    [setUserPermissionOverrides],
  );

  const resetUserScreenPermissions = useCallback(
    (userId: string) => {
      setUserPermissionOverrides((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      toast.success("تمت استعادة الصلاحيات الافتراضية للمستخدم بنجاح");
    },
    [setUserPermissionOverrides],
  );

  return {
    addRole,
    createPermissionGroup,
    updatePermissionGroup,
    deletePermissionGroup,
    addUsersToGroup,
    removeUserFromGroup,
    updateUserScreenPermissions,
    resetUserScreenPermissions,
  };
}
