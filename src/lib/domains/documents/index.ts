import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { CompanyDocument } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  acknowledgeDocumentRecord,
  createCompanyDocumentRecord,
} from "../../data/operational-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function useDocuments() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoDocs = useDemoStore((s) => s.companyDocs);

  const companyDocs = isLive ? bootstrap.companyDocs : demoDocs;

  return {
    companyDocs,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useDocumentMutations() {
  const { session, isDemo } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();

  const addCompanyDocument = useCallback(
    async (document: Omit<CompanyDocument, "id" | "acknowledgedCount">): Promise<boolean> => {
      const newDoc: CompanyDocument = {
        ...document,
        id: `doc-${Date.now()}`,
        acknowledgedCount: 0,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-doc-${document.titleAr}`,
        operation: async () => {
          await createCompanyDocumentRecord(newDoc);
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم رفع المستند بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.companyDocs = [...demoStore.companyDocs, newDoc];
          demoStore.notify();
          toast.success("تم رفع المستند المؤسسي بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ المستند");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const acknowledgeDocument = useCallback(
    async (docId: string, employeeId?: string): Promise<boolean> => {
      const empId = employeeId || demoStore.employees[0]?.id || "usr-01";

      const result = await executeReliableMutation({
        mode,
        mutationKey: `ack-doc-${docId}-${empId}`,
        operation: async () => {
          await acknowledgeDocumentRecord(docId, empId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم تأكيد الإقرار على المستند بنجاح");
          return true;
        },
        demoOperation: () => {
          demoStore.companyDocs = demoStore.companyDocs.map((d) =>
            d.id === docId ? { ...d, acknowledgedCount: d.acknowledgedCount + 1 } : d,
          );
          demoStore.notify();
          toast.success("تم تأكيد الاطلاع والإقرار على المستند بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسجيل الإقرار");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  return { addCompanyDocument, acknowledgeDocument };
}
