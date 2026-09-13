import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ExpenseCategory, ExpenseClaim } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  createExpenseCategoryRecord,
  createExpenseClaimRecord,
} from "../../data/operational-repository";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function useExpenses() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoData = useDemoStore((s) => ({
    expenseCategories: s.expenseCategories,
    expenseClaims: s.expenseClaims,
  }));

  const expenseCategories = isLive ? bootstrap.expenseCategories : demoData.expenseCategories;
  const expenseClaims = isLive ? bootstrap.expenseClaims : demoData.expenseClaims;

  return {
    expenseCategories,
    expenseClaims,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useExpenseMutations() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const addExpenseClaim = useCallback(
    async (
      claim: Omit<ExpenseClaim, "id" | "status" | "policyWarningTriggered">,
    ): Promise<boolean> => {
      const cat = demoStore.expenseCategories.find((c) => c.id === claim.categoryId);
      const isWarning = cat ? claim.amount > cat.maxLimitWarning : false;

      const newClaim: ExpenseClaim = {
        ...claim,
        id: `exp-${Date.now()}`,
        status: "submitted",
        policyWarningTriggered: isWarning,
      };

      if (!isLive) {
        demoStore.expenseClaims = [newClaim, ...demoStore.expenseClaims];
        demoStore.notify();
        toast.success("تم رفع مطالبة المصروفات بنجاح");
        return true;
      }

      try {
        await createExpenseClaimRecord(newClaim);
        await queryClient.invalidateQueries({ queryKey: queryKeys.expenses.claims() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم رفع مطالبة المصروفات بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر رفع مطالبة المصروفات");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const addExpenseCategory = useCallback(
    async (input: { nameAr: string; warningLimit: number; blockLimit: number }): Promise<boolean> => {
      const newCat: ExpenseCategory = {
        id: `cat-${Date.now()}`,
        nameAr: input.nameAr,
        nameEn: input.nameAr,
        icon: "Receipt",
        maxLimitWarning: input.warningLimit,
        maxLimitBlock: input.blockLimit,
        requiresReceipt: true,
      };

      if (!isLive) {
        demoStore.expenseCategories = [...demoStore.expenseCategories, newCat];
        demoStore.notify();
        toast.success("تم إضافة فئة المصروفات بنجاح");
        return true;
      }

      try {
        await createExpenseCategoryRecord({
          nameAr: input.nameAr,
          warningLimit: input.warningLimit,
          blockLimit: input.blockLimit,
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.expenses.categories() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم إضافة فئة المصروفات بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر إضافة فئة المصروفات");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  return { addExpenseClaim, addExpenseCategory };
}
