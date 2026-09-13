import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { CompanyDocument } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  acknowledgeDocumentRecord,
  createCompanyDocumentRecord,
} from "../../data/operational-repository";
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
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const addCompanyDocument = useCallback(
    async (document: Omit<CompanyDocument, "id" | "acknowledgedCount">): Promise<boolean> => {
      const newDoc: CompanyDocument = {
        ...document,
        id: `doc-${Date.now()}`,
        acknowledgedCount: 0,
      };

      if (!isLive) {
        demoStore.companyDocs = [...demoStore.companyDocs, newDoc];
        demoStore.notify();
        toast.success("تم رفع المستند المؤسسي بنجاح");
        return true;
      }

      try {
        await createCompanyDocumentRecord(newDoc);
        await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم رفع المستند بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر حفظ المستند");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const acknowledgeDocument = useCallback(
    async (docId: string, employeeId?: string): Promise<boolean> => {
      const empId = employeeId || demoStore.employees[0]?.id || "usr-01";
      if (!isLive) {
        demoStore.companyDocs = demoStore.companyDocs.map((d) =>
          d.id === docId ? { ...d, acknowledgedCount: d.acknowledgedCount + 1 } : d,
        );
        demoStore.notify();
        toast.success("تم تأكيد الاطلاع والإقرار على المستند بنجاح");
        return true;
      }

      try {
        await acknowledgeDocumentRecord(docId, empId);
        await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم تأكيد الإقرار على المستند بنجاح");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر تسجيل الإقرار");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  return { addCompanyDocument, acknowledgeDocument };
}
