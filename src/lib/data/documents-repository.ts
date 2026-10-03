import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "../query/query-keys";
import { useAuth } from "../auth/AuthContext";

export interface CompanyDocRow {
  id: string;
  companyId?: string;
  titleAr: string;
  titleEn: string;
  category: string;
  version: string;
  docState: "draft" | "published" | "superseded" | "archived";
  fileUrl: string;
  fileId?: string | null;
  fileSize?: string | null;
  visibilityScope: string;
  requiresAcknowledgment: boolean;
  acknowledgedCount: number;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}

export interface EmployeeDocRow {
  id: string;
  employeeId: string;
  companyId?: string;
  type: string;
  titleAr: string;
  titleEn: string;
  documentNumber: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  fileUrl: string;
  fileId?: string | null;
  fileSize?: string | null;
  status: string;
  confidentiality: string;
  visibility: string;
  issuingAuthority?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface OfficialDocRefRow {
  id: string;
  companyId: string;
  docType: string;
  employeeId?: string | null;
  referenceNumber: string;
  issuedAt: string;
}

function mapCompanyDocRow(row: Record<string, unknown>): CompanyDocRow {
  return {
    id: row.id as string,
    companyId: row.company_id as string | undefined,
    titleAr: row.title_ar as string,
    titleEn: (row.title_en as string) || "",
    category: (row.category as string) || "policy",
    version: (row.version as string) || "v1.0",
    docState: (row.doc_state as CompanyDocRow["docState"]) || "draft",
    fileUrl: (row.file_url as string) || "",
    fileId: row.file_id as string | null,
    fileSize: row.file_size as string | null,
    visibilityScope: (row.visibility_scope as string) || "all",
    requiresAcknowledgment: Boolean(row.requires_acknowledgment),
    acknowledgedCount: Number(row.acknowledged_count || 0),
    effectiveDate: row.effective_date as string | null,
    expiryDate: row.expiry_date as string | null,
    approvedAt: row.approved_at as string | null,
    createdAt: row.created_at as string,
  };
}

function mapEmployeeDocRow(row: Record<string, unknown>): EmployeeDocRow {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    companyId: row.company_id as string | undefined,
    type: (row.document_type || row.doc_type || "other") as string,
    titleAr: row.title_ar as string,
    titleEn: (row.title_en as string) || "",
    documentNumber: (row.document_number || row.doc_number || "") as string,
    issueDate: (row.issue_date || row.issued_at) as string | null,
    expiryDate: (row.expiry_date || row.expires_at) as string | null,
    fileUrl: (row.file_url as string) || "",
    fileId: row.file_id as string | null,
    fileSize: row.file_size as string | null,
    status: (row.status as string) || "valid",
    confidentiality: (row.confidentiality as string) || "confidential",
    visibility: (row.visibility as string) || "employee_visible",
    issuingAuthority: row.issuing_authority as string | null,
    verifiedBy: row.verified_by as string | null,
    verifiedAt: row.verified_at as string | null,
    rejectionReason: row.rejection_reason as string | null,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
  };
}

export function useCompanyDocs(companyId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: queryKeys.documents.company(),
    queryFn: async (): Promise<CompanyDocRow[]> => {
      if (!isLive) return [];
      const q = (supabase as any)
        .from("company_documents")
        .select("*")
        .not("doc_state", "eq", "archived")
        .order("created_at", { ascending: false });
      const { data, error } = companyId ? await q.eq("company_id", companyId) : await q;
      if (error) throw new Error(error.message);
      return (data || []).map(mapCompanyDocRow);
    },
    enabled: isLive,
  });
}

export function useEmployeeDocs(employeeId?: string) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  return useQuery({
    queryKey: employeeId ? queryKeys.documents.employee(employeeId) : queryKeys.documents.employees(),
    queryFn: async (): Promise<EmployeeDocRow[]> => {
      if (!isLive) return [];
      const q = (supabase as any)
        .from("employee_documents")
        .select("*")
        .not("status", "eq", "archived")
        .order("created_at", { ascending: false });
      const { data, error } = employeeId ? await q.eq("employee_id", employeeId) : await q;
      if (error) throw new Error(error.message);
      return (data || []).map(mapEmployeeDocRow);
    },
    enabled: isLive,
  });
}

export function useDocumentMutationBundle() {
  const queryClient = useQueryClient();

  const publishCompanyDoc = useMutation({
    mutationFn: async (params: { docId: string }) => {
      const { data, error } = await (supabase as any).rpc("publish_company_document_atomic", {
        p_doc_id: params.docId,
      });
      if (error) throw new Error(error.message);
      const firstVal = data && typeof data === "object" ? Object.values(data as object)[0] : data;
      return typeof firstVal === "object" ? firstVal : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
    },
  });

  const generateOfficialRef = useMutation({
    mutationFn: async (params: { companyId: string; docType: string; employeeId?: string }) => {
      const { data, error } = await (supabase as any).rpc("generate_official_document_reference", {
        p_company_id: params.companyId,
        p_doc_type: params.docType,
        p_employee_id: params.employeeId ?? null,
      });
      if (error) throw new Error(error.message);
      const firstVal = data && typeof data === "object" ? Object.values(data as object)[0] : data;
      return typeof firstVal === "object" ? firstVal : data;
    },
  });

  const acknowledgeCompanyDoc = useMutation({
    mutationFn: async (params: { documentId: string; employeeId: string; version?: string }) => {
      const { error } = await (supabase as any).from("document_acknowledgements").upsert(
        {
          document_id: params.documentId,
          employee_id: params.employeeId,
          document_version: params.version ?? null,
          acknowledged_at: new Date().toISOString(),
        },
        { onConflict: "document_id,employee_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });

  return { publishCompanyDoc, generateOfficialRef, acknowledgeCompanyDoc };
}
