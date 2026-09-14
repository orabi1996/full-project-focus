import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ExpenseCategory, ExpenseClaim } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  createExpenseCategoryRecord,
  createExpenseClaimRecord,
} from "../../data/operational-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

import { uploadExpenseReceiptFile } from "../../storage";

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
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const addExpenseClaim = useCallback(
    async (
      claim: Omit<ExpenseClaim, "id" | "status" | "policyWarningTriggered">,
      receiptFile?: File,
    ): Promise<boolean> => {
      const cat = demoStore.expenseCategories.find((c) => c.id === claim.categoryId);
      const isWarning = cat ? claim.amount > cat.maxLimitWarning : false;
      const expenseId = `exp-${Date.now()}`;

      let receiptFileId: string | undefined = claim.receiptFileId;
      let receiptUrl: string | undefined = claim.receiptUrl;

      if (receiptFile) {
        try {
          const uploaded = await uploadExpenseReceiptFile({
            employeeId: claim.employeeId,
            expenseId,
            file: receiptFile,
          });
          receiptFileId = uploaded.id;
          receiptUrl = uploaded.object_path;
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "فشل رفع الإيصال";
          toast.error(msg);
          return false;
        }
      }

      const newClaim: ExpenseClaim = {
        ...claim,
        id: expenseId,
        receiptFileId,
        receiptUrl,
        status: "submitted",
        policyWarningTriggered: isWarning,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-expense-claim-${claim.employeeId}-${claim.categoryId}-${claim.amount}`,
        operation: async () => {
          await createExpenseClaimRecord(newClaim);
          await queryClient.invalidateQueries({ queryKey: queryKeys.expenses.claims() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.expenseClaims = [newClaim, ...demoStore.expenseClaims];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم رفع مطالبة المصروفات بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر رفع مطالبة المصروفات");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
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

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-expense-category-${input.nameAr}`,
        operation: async () => {
          await createExpenseCategoryRecord({
            nameAr: input.nameAr,
            warningLimit: input.warningLimit,
            blockLimit: input.blockLimit,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.expenses.categories() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.expenseCategories = [...demoStore.expenseCategories, newCat];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم إضافة فئة المصروفات بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إضافة فئة المصروفات");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return { addExpenseClaim, addExpenseCategory };
}
