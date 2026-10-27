import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { CompanyDocument, EmployeeDocument } from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import {
  acknowledgeDocumentRecord,
  archiveDocumentRecord,
  createCompanyDocumentRecord,
  createEmployeeDocumentRecord,
  verifyEmployeeDocumentRecord,
} from "../../data/operational-repository";
import { useDocumentMutationBundle } from "../../data/documents-repository";
import { executeReliableMutation } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { toast } from "sonner";
import {
  uploadCompanyDocumentFile,
  uploadEmployeeDocumentFile,
  rollbackUploadedFile,
} from "../../storage";

export function useDocuments() {
  const bootstrap = useBootstrapData();

  return {
    isLive: true,
    companyDocs: bootstrap.companyDocs,
    employeeDocs: bootstrap.employeeDocs,
    isLoading: bootstrap.isLoading,
    isError: bootstrap.isError,
    error: bootstrap.error,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useDocumentMutations() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const repoMutations = useDocumentMutationBundle();

  const addCompanyDocument = useCallback(
    async (
      document: Omit<CompanyDocument, "id" | "acknowledgedCount">,
      file?: File,
    ): Promise<boolean> => {
      const docId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}`;
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
        mode: "live",
        mutationKey: `create-company-doc-${document.titleAr}-${docId}`,
        operation: async () => {
          let res: unknown;
          try {
            res = await createCompanyDocumentRecord(newDoc);
          } catch (insertErr) {
            if (fileId) {
              await rollbackUploadedFile({ fileId }).catch((rbErr) =>
                console.error("Rollback of uploaded company document failed:", rbErr),
              );
            }
            throw insertErr;
          }
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.company() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return res;
        },
        onCommitted: () => {
          toast.success("تم حفظ وأرشفة المستند المؤسسي بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ المستند المؤسسي");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const addEmployeeDocument = useCallback(
    async (
      document: Omit<EmployeeDocument, "id">,
      file?: File,
    ): Promise<boolean> => {
      const docId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}`;
      let fileId: string | undefined = document.fileId;
      let fileUrl: string = document.fileUrl;

      if (file) {
        try {
          const uploaded = await uploadEmployeeDocumentFile({
            employeeId: document.employeeId,
            documentId: docId,
            file,
            docType: document.type,
          });
          fileId = uploaded.id;
          fileUrl = uploaded.object_path;
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "فشل رفع ملف وثيقة الموظف";
          toast.error(msg);
          return false;
        }
      }

      const newDoc: EmployeeDocument = {
        ...document,
        id: docId,
        fileId,
        fileUrl,
      };

      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `create-emp-doc-${document.employeeId}-${document.titleAr}-${docId}`,
        operation: async () => {
          let res: unknown;
          try {
            res = await createEmployeeDocumentRecord(newDoc);
          } catch (insertErr) {
            if (fileId) {
              await rollbackUploadedFile({ fileId }).catch((rbErr) =>
                console.error("Rollback of uploaded employee document failed:", rbErr),
              );
            }
            throw insertErr;
          }
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.employee(document.employeeId) });
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.employees() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return res;
        },
        onCommitted: () => {
          toast.success("تم حفظ وتوثيق وثيقة الموظف بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر حفظ وثيقة الموظف");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const archiveDocument = useCallback(
    async (
      docId: string,
      type: "company" | "employee",
      fileId?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `archive-doc-${docId}`,
        operation: async () => {
          const res = await archiveDocumentRecord(docId, type, fileId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return res;
        },
        onCommitted: () => {
          toast.success("تم أرشفة وحذف المستند بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر أرشفة المستند");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const verifyEmployeeDocument = useCallback(
    async (
      docId: string,
      status: "valid" | "expired" | "rejected",
      rejectionReason?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `verify-emp-doc-${docId}-${status}`,
        operation: async () => {
          const res = await verifyEmployeeDocumentRecord(
            docId,
            status,
            "مسؤول الموارد البشرية",
            rejectionReason,
          );
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return res;
        },
        onCommitted: () => {
          if (status === "valid") {
            toast.success("تم اعتماد وتوثيق الوثيقة بنجاح");
          } else if (status === "rejected") {
            toast.error(`تم رفض الوثيقة: ${rejectionReason || "غير مطابقة"}`);
          } else {
            toast.info("تم تحديث حالة الوثيقة");
          }
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تحديث حالة الوثيقة");
        },
      });

      return result.ok;
    },
    [queryClient],
  );

  const acknowledgeDocument = useCallback(
    async (docId: string, employeeId?: string): Promise<boolean> => {
      const empId = employeeId || session?.user?.id || "usr-01";

      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `ack-doc-${docId}-${empId}`,
        operation: async () => {
          const res = await acknowledgeDocumentRecord(docId, empId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return res;
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
    [session?.user?.id, queryClient],
  );

  const publishCompanyDoc = useCallback(
    async (docId: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: `publish-doc-${docId}`,
        operation: async () => {
          const res = await repoMutations.publishCompanyDoc.mutateAsync({ docId });
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return res;
        },
        onCommitted: () => {
          toast.success("تم نشر الوثيقة بنجاح");
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر نشر الوثيقة");
        },
      });
      return result.ok;
    },
    [queryClient, repoMutations],
  );

  const generateOfficialRef = useCallback(
    async (params: { companyId: string; docType: string; employeeId?: string }): Promise<string | null> => {
      try {
        const res = await repoMutations.generateOfficialRef.mutateAsync(params);
        return ((res as Record<string, unknown>)?.reference_number as string) ?? null;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر توليد رقم المرجع الرسمي");
        return null;
      }
    },
    [repoMutations],
  );

  return {
    addCompanyDocument,
    addEmployeeDocument,
    archiveDocument,
    verifyEmployeeDocument,
    acknowledgeDocument,
    publishCompanyDoc,
    generateOfficialRef,
  };
}
