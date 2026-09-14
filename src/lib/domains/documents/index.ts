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
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";
import {
  uploadCompanyDocumentFile,
  uploadEmployeeDocumentFile,
  rollbackUploadedFile,
} from "../../storage";

export function useDocuments() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoDocs = useDemoStore((s) => ({
    companyDocs: s.companyDocs,
    employeeDocs: s.employeeDocs,
  }));

  const companyDocs = isLive ? bootstrap.companyDocs : demoDocs.companyDocs;
  const employeeDocs = isLive ? bootstrap.employeeDocs : demoDocs.employeeDocs;

  return {
    companyDocs,
    employeeDocs,
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
        mode,
        mutationKey: `create-company-doc-${document.titleAr}-${docId}`,
        operation: async () => {
          try {
            await createCompanyDocumentRecord(newDoc);
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
          return true;
        },
        demoOperation: () => {
          demoStore.companyDocs = [...demoStore.companyDocs, newDoc];
          demoStore.notify();
          return true;
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
    [mode, queryClient],
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
        mode,
        mutationKey: `create-emp-doc-${document.employeeId}-${document.titleAr}-${docId}`,
        operation: async () => {
          try {
            await createEmployeeDocumentRecord(newDoc);
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
          return true;
        },
        demoOperation: () => {
          demoStore.employeeDocs = [...demoStore.employeeDocs, newDoc];
          demoStore.notify();
          return true;
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
    [mode, queryClient],
  );

  const archiveDocument = useCallback(
    async (
      docId: string,
      type: "company" | "employee",
      fileId?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `archive-doc-${docId}`,
        operation: async () => {
          await archiveDocumentRecord(docId, type, fileId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          if (type === "company") {
            demoStore.companyDocs = demoStore.companyDocs.filter((d) => d.id !== docId);
          } else {
            demoStore.employeeDocs = demoStore.employeeDocs.filter((d) => d.id !== docId);
          }
          demoStore.notify();
          return true;
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
    [mode, queryClient],
  );

  const verifyEmployeeDocument = useCallback(
    async (
      docId: string,
      status: "valid" | "expired" | "rejected",
      rejectionReason?: string,
    ): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `verify-emp-doc-${docId}-${status}`,
        operation: async () => {
          await verifyEmployeeDocumentRecord(
            docId,
            status,
            "مسؤول الموارد البشرية",
            rejectionReason,
          );
          await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return true;
        },
        demoOperation: () => {
          demoStore.employeeDocs = demoStore.employeeDocs.map((d) =>
            d.id === docId
              ? {
                  ...d,
                  status,
                  rejectionReason: status === "rejected" ? rejectionReason : undefined,
                  verifiedBy: "مسؤول الموارد البشرية",
                  verifiedAt: new Date().toISOString(),
                }
              : d,
          );
          demoStore.notify();
          return true;
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

  return {
    addCompanyDocument,
    addEmployeeDocument,
    archiveDocument,
    verifyEmployeeDocument,
    acknowledgeDocument,
  };
}
