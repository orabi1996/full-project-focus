import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ExpenseCategory, ExpenseClaim } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";
import {
  useExpenseCategories as useRepoCategories,
  useExpenseClaims as useRepoClaims,
  useExpenseMutations as useRepoMutations,
} from "../../data/expenses-repository";

export * from "../../data/expenses-repository";

/**
 * Domain hook providing expenses data, delegating to the production repository in live mode.
 */
export function useExpenses() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  const repoCategories = useRepoCategories();
  const repoClaims = useRepoClaims();
  const demoData = useDemoStore((s) => ({
    expenseCategories: s.expenseCategories,
    expenseClaims: s.expenseClaims,
  }));

  const expenseCategories = isLive
    ? (repoCategories.data || []).map((c) => ({
        id: c.id,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        icon: "Receipt",
        maxLimitWarning: c.maxLimitWarning,
        maxLimitBlock: c.maxLimitBlock,
        requiresReceipt: c.requiresReceipt,
      }))
    : demoData.expenseCategories;

  const expenseClaims = isLive
    ? (repoClaims.data?.data || []).map((c) => ({
        id: c.id,
        employeeId: c.employeeId,
        categoryId: c.categoryId || "",
        categoryNameAr: c.categoryNameAr,
        categoryNameEn: c.categoryNameEn || c.categoryNameAr,
        amount: c.amount,
        currency: c.currency,
        spentAt: c.spentAt,
        merchantName: c.merchantName,
        receiptUrl: c.receiptUrl || undefined,
        receiptFileId: c.receiptFileId || undefined,
        description: c.description,
        status: c.status as ExpenseClaim["status"],
        policyWarningTriggered: c.policyWarningTriggered,
      }))
    : demoData.expenseClaims;

  return {
    expenseCategories,
    expenseClaims,
    isLoading: isLive ? (repoCategories.isLoading || repoClaims.isLoading) : false,
    isError: isLive ? (repoCategories.isError || repoClaims.isError) : false,
    error: isLive ? (repoCategories.error || repoClaims.error) : null,
    refetch: async () => {
      await Promise.all([repoCategories.refetch(), repoClaims.refetch()]);
    },
  };
}

/**
 * Enhanced mutation hook returning both repository and legacy compatible signatures with reliable mutation wrapping.
 */
export function useExpenseMutations() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();
  const repo = useRepoMutations();

  const addExpenseClaim = useCallback(
    async (
      claim: Omit<ExpenseClaim, "id" | "status" | "policyWarningTriggered">,
      receiptFile?: File,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-claim-${claim.merchantName}-${claim.spentAt}`,
        operation: async () => {
          await repo.submitClaim({
            title: `مطالبة ${claim.merchantName}`,
            justification: claim.description,
            paymentMethod: "employee_paid",
            items: [
              {
                categoryId: claim.categoryId,
                itemDate: claim.spentAt,
                merchantName: claim.merchantName,
                amount: claim.amount,
                currency: claim.currency,
                description: claim.description,
                receiptFile,
                receiptUrl: claim.receiptUrl,
                receiptFileId: claim.receiptFileId,
              },
            ],
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
          return true;
        },
        demoOperation: () => {
          const newClaim: ExpenseClaim = {
            ...claim,
            id: `exp-${Date.now()}`,
            status: "submitted",
            policyWarningTriggered: false,
          };
          demoStore.expenseClaims = [newClaim, ...demoStore.expenseClaims];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم تقديم مطالبة المصروفات بنجاح");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo],
  );

  const addExpenseCategory = useCallback(
    async (input: { nameAr: string; warningLimit: number; blockLimit: number }): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-category-${input.nameAr}`,
        operation: async () => {
          await repo.addCategory({
            nameAr: input.nameAr,
            warningLimit: input.warningLimit,
            blockLimit: input.blockLimit,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
          return true;
        },
        demoOperation: () => {
          const newCat: ExpenseCategory = {
            id: `cat-${Date.now()}`,
            nameAr: input.nameAr,
            nameEn: input.nameAr,
            icon: "Receipt",
            maxLimitWarning: input.warningLimit,
            maxLimitBlock: input.blockLimit,
            requiresReceipt: true,
          };
          demoStore.expenseCategories = [...demoStore.expenseCategories, newCat];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إضافة فئة المصروف بنجاح");
        },
      });
      return result.ok;
    },
    [mode, queryClient, repo],
  );

  return {
    ...repo,
    addExpenseClaim,
    addExpenseCategory,
  };
}
