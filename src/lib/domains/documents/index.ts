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

import { uploadCompanyDocumentFile } from "../../storage";

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
    async (
      document: Omit<CompanyDocument, "id" | "acknowledgedCount">,
      file?: File,
    ): Promise<boolean> => {
      const docId = `doc-${Date.now()}`;
      let fileId: string | undefined = document.fileId;
      let fileUrl: string = document.fileUrl;

      if (file) {
        try {
          const uploaded = await uploadCompanyDocumentFile({
            documentId: docId,
            file,
            category: document.category,
          });
          fileId = uploaded.id;
          fileUrl = uploaded.object_path;
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "فشل رفع الملف";
          toast.error(msg);
          return false;
        }
      }

      const newDoc: CompanyDocument = {
        ...document,
        id: docId,
        fileId,
        fileUrl,
        acknowledgedCount: 0,
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `create-doc-${document.titleAr}`,
        operation: async () => {
          await createCompanyDocumentRecord(newDoc);
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.companyDocs = [...demoStore.companyDocs, newDoc];
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم رفع المستند المؤسسي بنجاح");
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
          return true;
        },
        demoOperation: () => {
          demoStore.companyDocs = demoStore.companyDocs.map((d) =>
            d.id === docId ? { ...d, acknowledgedCount: d.acknowledgedCount + 1 } : d,
          );
          demoStore.notify();
          return true;
        },
        onCommitted: () => {
          toast.success("تم تأكيد الاطلاع والإقرار على المستند بنجاح");
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
