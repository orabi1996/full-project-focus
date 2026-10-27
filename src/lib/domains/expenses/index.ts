import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ExpenseClaim } from "../../../types";
import { executeReliableMutation } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { toast } from "sonner";
import {
  useExpenseCategories as useRepoCategories,
  useExpenseClaims as useRepoClaims,
  useExpenseMutations as useRepoMutations,
} from "../../data/expenses-repository";

export * from "../../data/expenses-repository";

/**
 * Domain hook providing expenses data, delegating to the production repository.
 */
export function useExpenses() {
  const repoCategories = useRepoCategories();
  const repoClaims = useRepoClaims();

  const expenseCategories = (repoCategories.data || []).map((c) => ({
    id: c.id,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    icon: "Receipt",
    maxLimitWarning: c.maxLimitWarning,
    maxLimitBlock: c.maxLimitBlock,
    requiresReceipt: c.requiresReceipt,
  }));

  const expenseClaims = (repoClaims.data?.data || []).map((c) => ({
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
  }));

  return {
    expenseCategories,
    expenseClaims,
    isLoading: repoCategories.isLoading || repoClaims.isLoading,
    isError: repoCategories.isError || repoClaims.isError,
    error: repoCategories.error || repoClaims.error,
    refetch: async () => {
      await Promise.all([repoCategories.refetch(), repoClaims.refetch()]);
    },
  };
}

/**
 * Enhanced mutation hook returning both repository and legacy compatible signatures with reliable mutation wrapping.
 */
export function useExpenseMutations() {
  const queryClient = useQueryClient();
  const repo = useRepoMutations();

  const addExpenseClaim = useCallback(
    async (
      claim: Omit<ExpenseClaim, "id" | "status" | "policyWarningTriggered">,
      receiptFile?: File,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
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
        onCommitted: () => {
          toast.success("تم تقديم مطالبة المصروفات بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تقديم مطالبة المصروفات");
        },
      });
      return result.ok;
    },
    [queryClient, repo],
  );

  const addExpenseCategory = useCallback(
    async (input: { nameAr: string; warningLimit: number; blockLimit: number }): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
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
        onCommitted: () => {
          toast.success("تم إضافة فئة المصروف بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة فئة المصروف");
        },
      });
      return result.ok;
    },
    [queryClient, repo],
  );

  return {
    ...repo,
    addExpenseClaim,
    addExpenseCategory,
  };
}
