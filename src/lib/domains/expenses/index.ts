import { useCallback } from "react";
import type { ExpenseCategory, ExpenseClaim } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { useDemoStore } from "../demo/demo-store";
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
 * Enhanced mutation hook returning both repository and legacy compatible signatures.
 */
export function useExpenseMutations() {
  const repo = useRepoMutations();

  const addExpenseClaim = useCallback(
    async (
      claim: Omit<ExpenseClaim, "id" | "status" | "policyWarningTriggered">,
      receiptFile?: File,
    ): Promise<boolean> => {
      try {
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
        return true;
      } catch {
        return false;
      }
    },
    [repo],
  );

  const addExpenseCategory = useCallback(
    async (input: { nameAr: string; warningLimit: number; blockLimit: number }): Promise<boolean> => {
      try {
        await repo.addCategory({
          nameAr: input.nameAr,
          warningLimit: input.warningLimit,
          blockLimit: input.blockLimit,
        });
        return true;
      } catch {
        return false;
      }
    },
    [repo],
  );

  return {
    ...repo,
    addExpenseClaim,
    addExpenseCategory,
  };
}
