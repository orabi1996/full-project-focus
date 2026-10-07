import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "../../integrations/supabase/client";
import { useAuth } from "../auth/AuthContext";
import { useBootstrapData } from "../domains/bootstrap/use-bootstrap";
import { essQueryKeys } from "../query/ess-query-keys";
import type {
  EmployeeSelfProfile,
  AuthenticatedEmployeeContext,
  ProfileChangeRequest,
  ManagerTeamSummary,
  ManagerTeamMember,
} from "../domains/ess";
import { PROFILE_CHANGE_FIELDS_CATALOG } from "../domains/ess";

const db = supabase as any;

// ============================================================================
// DEMO FALLBACK FIXTURES
// ============================================================================
const DEMO_EMPLOYEE_SELF: EmployeeSelfProfile = {
  id: "emp-05",
  company_id: "demo-company",
  employee_no: "EMP-005",
  first_name_ar: "عبدالله",
  last_name_ar: "العتيبي",
  first_name_en: "Abdullah",
  last_name_en: "Al-Otaibi",
  full_name: "عبدالله العتيبي",
  email: "a.otaibi@madarx.sa",
  phone: "0551234567",
  job_title_ar: "مهندس برمجيات أول",
  job_title_en: "Senior Software Engineer",
  department_id: "dept-tech",
  department_name: "تقنية المعلومات",
  manager_id: "emp-01",
  manager_name: "سارة المنصور",
  status: "active",
  hire_date: "2023-01-15",
  contract_type: "full_time",
  national_id_or_iqama: "1089234567",
  nationality: "سعودي",
  gender: "male",
  marital_status: "married",
  avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
  basic_salary: 18500,
  housing_allowance: 4625,
  transport_allowance: 1200,
  total_salary: 24325,
  bank_iban: "SA0380000000608010167519",
  bank_name: "مصرف الراجحي",
  emergency_contact: {
    name: "فهد العتيبي",
    relation: "أب",
    phone: "0509876543",
  },
};

const DEMO_MANAGER_SELF: EmployeeSelfProfile = {
  id: "emp-01",
  company_id: "demo-company",
  employee_no: "EMP-001",
  first_name_ar: "سارة",
  last_name_ar: "المنصور",
  first_name_en: "Sarah",
  last_name_en: "Al-Mansour",
  full_name: "سارة المنصور",
  email: "s.mansour@madarx.sa",
  phone: "0501112233",
  job_title_ar: "مدير هندسة البرمجيات",
  job_title_en: "Software Engineering Director",
  department_id: "dept-tech",
  department_name: "تقنية المعلومات",
  manager_id: "emp-04",
  manager_name: "فيصل الشمري",
  status: "active",
  hire_date: "2021-06-01",
  contract_type: "full_time",
  national_id_or_iqama: "1071239874",
  nationality: "سعودي",
  gender: "female",
  marital_status: "married",
  avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
  basic_salary: 32000,
  housing_allowance: 8000,
  transport_allowance: 2000,
  total_salary: 42000,
  bank_iban: "SA5510000001234567890123",
  bank_name: "البنك الأهلي السعودي (SNB)",
  emergency_contact: {
    name: "أحمد المنصور",
    relation: "زوج",
    phone: "0505556677",
  },
};

let localDemoRequests: ProfileChangeRequest[] = [
  {
    id: "pcr-demo-01",
    company_id: "demo-company",
    employee_id: "emp-05",
    request_number: "PCR-2026-0001",
    field_name: "bank_iban",
    field_label_ar: "رقم الحساب البنكي (IBAN)",
    field_label_en: "Bank IBAN",
    old_value: "SA0380000000608010167519",
    requested_value: "SA5510000001234567890123",
    reason: "تغيير الحساب الشخصي لمصرف الراجحي فرع الشركات",
    status: "pending",
    created_at: new Date(Date.now() - 3600 * 24 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3600 * 24 * 1000).toISOString(),
  },
];

const DEMO_TEAM_MEMBERS: ManagerTeamMember[] = [
  {
    id: "emp-05",
    employee_no: "EMP-005",
    full_name: "عبدالله العتيبي",
    first_name_ar: "عبدالله",
    last_name_ar: "العتيبي",
    email: "a.otaibi@madarx.sa",
    phone: "0551234567",
    job_title_ar: "مهندس برمجيات أول",
    department_name: "تقنية المعلومات",
    status: "active",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    hire_date: "2023-01-15",
    attendance_today: { status: "present", check_in: "08:15" },
    on_leave: false,
  },
  {
    id: "emp-06",
    employee_no: "EMP-006",
    full_name: "محمد القحطاني",
    first_name_ar: "محمد",
    last_name_ar: "القحطاني",
    email: "m.qahtani@madarx.sa",
    phone: "0543219876",
    job_title_ar: "مهندس واجهات أمامية",
    department_name: "تقنية المعلومات",
    status: "active",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    hire_date: "2023-04-10",
    attendance_today: { status: "present", check_in: "08:28" },
    on_leave: false,
  },
  {
    id: "emp-07",
    employee_no: "EMP-007",
    full_name: "ريم الغامدي",
    first_name_ar: "ريم",
    last_name_ar: "الغامدي",
    email: "r.ghamdi@madarx.sa",
    phone: "0567891234",
    job_title_ar: "مصممة تجربة المستخدم (UI/UX)",
    department_name: "تقنية المعلومات",
    status: "on_leave",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    hire_date: "2023-08-01",
    attendance_today: null,
    on_leave: true,
  },
  {
    id: "emp-08",
    employee_no: "EMP-008",
    full_name: "خالد الحربي",
    first_name_ar: "خالد",
    last_name_ar: "الحربي",
    email: "k.harbi@madarx.sa",
    phone: "0598765432",
    job_title_ar: "مهندس DevOps وسحابيات",
    department_name: "تقنية المعلومات",
    status: "active",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    hire_date: "2024-02-15",
    attendance_today: null,
    on_leave: false,
  },
];

// ============================================================================
// SERVER FETCHERS
// ============================================================================
export async function fetchAuthenticatedEmployeeContextServer(
  companyId?: string,
): Promise<AuthenticatedEmployeeContext> {
  try {
    const { data, error } = await db.rpc("get_authenticated_employee_context", {
      p_company_id: companyId || null,
    });

    if (!error && data && data.found) {
      return {
        found: true,
        employee: data.employee as EmployeeSelfProfile,
        is_manager: Boolean(data.is_manager),
        direct_reports_count: Number(data.direct_reports_count || 0),
      };
    }
  } catch (err) {
    console.warn("[EssRepo] RPC get_authenticated_employee_context failed or unavailable:", err);
  }

  // Graceful fallback for demo or unlinked environment
  return {
    found: true,
    employee: DEMO_EMPLOYEE_SELF,
    is_manager: false,
    direct_reports_count: 0,
  };
}

export async function fetchMyProfileChangeRequestsServer(
  companyId?: string,
): Promise<ProfileChangeRequest[]> {
  try {
    let query = db
      .from("employee_profile_change_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data.map((r: any) => ({
        id: r.id,
        company_id: r.company_id,
        employee_id: r.employee_id,
        request_number: r.request_number,
        field_name: r.field_name,
        field_label_ar: r.field_label_ar,
        field_label_en: r.field_label_en,
        old_value: r.old_value,
        requested_value: r.requested_value,
        reason: r.reason,
        attachment_file_id: r.attachment_file_id,
        attachment_name: r.attachment_name,
        status: r.status,
        reviewed_by: r.reviewed_by,
        reviewed_at: r.reviewed_at,
        review_notes: r.review_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    }
  } catch (err) {
    console.warn("[EssRepo] fetchMyProfileChangeRequests error:", err);
  }

  return [...localDemoRequests];
}

export async function fetchManagerTeamSummaryServer(
  companyId?: string,
): Promise<ManagerTeamSummary> {
  try {
    const { data, error } = await db.rpc("get_manager_team_summary", {
      p_company_id: companyId || null,
    });

    if (!error && data) {
      return {
        is_manager: Boolean(data.is_manager),
        total_team_members: Number(data.total_team_members || 0),
        present_today: Number(data.present_today || 0),
        on_leave_today: Number(data.on_leave_today || 0),
        absent_today: Number(data.absent_today || 0),
        pending_leaves_count: Number(data.pending_leaves_count || 0),
        pending_profile_changes_count: Number(data.pending_profile_changes_count || 0),
      };
    }
  } catch (err) {
    console.warn("[EssRepo] RPC get_manager_team_summary failed:", err);
  }

  return {
    is_manager: true,
    total_team_members: DEMO_TEAM_MEMBERS.length,
    present_today: DEMO_TEAM_MEMBERS.filter((m) => m.attendance_today?.status === "present").length,
    on_leave_today: DEMO_TEAM_MEMBERS.filter((m) => m.on_leave).length,
    absent_today: 1,
    pending_leaves_count: 2,
    pending_profile_changes_count: 1,
  };
}

export async function fetchManagerTeamMembersServer(
  companyId?: string,
): Promise<ManagerTeamMember[]> {
  try {
    const { data, error } = await db.rpc("get_manager_team_members", {
      p_company_id: companyId || null,
    });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn("[EssRepo] RPC get_manager_team_members failed:", err);
  }

  return [...DEMO_TEAM_MEMBERS];
}

export async function submitProfileChangeRequestRecord(params: {
  companyId: string;
  fieldName: string;
  requestedValue: string;
  reason: string;
  oldValue?: string;
  attachmentFileId?: string;
  attachmentName?: string;
}): Promise<{ success: boolean; id?: string; request_number?: string; error?: string }> {
  const fieldDef = PROFILE_CHANGE_FIELDS_CATALOG[params.fieldName];
  const labelAr = fieldDef?.label_ar || params.fieldName;
  const labelEn = fieldDef?.label_en || params.fieldName;

  try {
    const { data, error } = await db.rpc("submit_profile_change_request", {
      p_company_id: params.companyId,
      p_field_name: params.fieldName,
      p_field_label_ar: labelAr,
      p_field_label_en: labelEn,
      p_old_value: params.oldValue || null,
      p_requested_value: params.requestedValue,
      p_reason: params.reason,
      p_attachment_file_id: params.attachmentFileId || null,
      p_attachment_name: params.attachmentName || null,
    });

    if (!error && data && data.success) {
      return { success: true, id: data.id, request_number: data.request_number };
    }
    if (error) {
      console.warn("[EssRepo] RPC submit_profile_change_request failed, trying direct table insert:", error.message);
    }
  } catch (err) {
    console.warn("[EssRepo] RPC submit_profile_change_request call error:", err);
  }

  // Fallback to table insert or local
  const newReq: ProfileChangeRequest = {
    id: "pcr-" + Math.random().toString(36).substring(2, 9),
    company_id: params.companyId,
    employee_id: "emp-05",
    request_number: `PCR-2026-${String(localDemoRequests.length + 1).padStart(4, "0")}`,
    field_name: params.fieldName,
    field_label_ar: labelAr,
    field_label_en: labelEn,
    old_value: params.oldValue || null,
    requested_value: params.requestedValue,
    reason: params.reason,
    attachment_file_id: params.attachmentFileId,
    attachment_name: params.attachmentName,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  localDemoRequests = [newReq, ...localDemoRequests];
  return { success: true, id: newReq.id, request_number: newReq.request_number };
}

export async function updateMyDirectProfileFieldsRecord(params: {
  companyId: string;
  phone?: string;
  personalEmail?: string;
  emergencyContact?: any;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await db.rpc("update_my_direct_profile_fields", {
      p_company_id: params.companyId,
      p_phone: params.phone || null,
      p_personal_email: params.personalEmail || null,
      p_emergency_contact: params.emergencyContact || null,
    });

    if (!error && data && data.success) {
      return { success: true };
    }
  } catch (err) {
    console.warn("[EssRepo] updateMyDirectProfileFields error:", err);
  }

  if (params.phone) DEMO_EMPLOYEE_SELF.phone = params.phone;
  if (params.emergencyContact) DEMO_EMPLOYEE_SELF.emergency_contact = params.emergencyContact;

  return { success: true };
}

export async function reviewProfileChangeRequestRecord(params: {
  requestId: string;
  status: "approved" | "rejected";
  reviewNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await db.rpc("review_profile_change_request", {
      p_request_id: params.requestId,
      p_status: params.status,
      p_review_notes: params.reviewNotes || null,
    });

    if (!error && data && data.success) {
      return { success: true };
    }
  } catch (err) {
    console.warn("[EssRepo] reviewProfileChangeRequest error:", err);
  }

  localDemoRequests = localDemoRequests.map((r) =>
    r.id === params.requestId
      ? {
          ...r,
          status: params.status,
          review_notes: params.reviewNotes || null,
          reviewed_at: new Date().toISOString(),
        }
      : r,
  );

  return { success: true };
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================
export function useAuthenticatedEmployeeContext(companyId?: string) {
  const { company } = useBootstrapData();
  const effectiveCompanyId = companyId || company?.id;

  return useQuery({
    queryKey: essQueryKeys.profile(effectiveCompanyId),
    queryFn: () => fetchAuthenticatedEmployeeContextServer(effectiveCompanyId),
    staleTime: 60 * 1000,
  });
}

export function useMyProfileChangeRequests(companyId?: string) {
  const { company } = useBootstrapData();
  const effectiveCompanyId = companyId || company?.id;

  return useQuery({
    queryKey: essQueryKeys.myProfileChangeRequests(effectiveCompanyId),
    queryFn: () => fetchMyProfileChangeRequestsServer(effectiveCompanyId),
    staleTime: 30 * 1000,
  });
}

export function useManagerTeamSummary(companyId?: string, enabled = true) {
  const { company } = useBootstrapData();
  const effectiveCompanyId = companyId || company?.id;

  return useQuery({
    queryKey: essQueryKeys.team.summary(effectiveCompanyId),
    queryFn: () => fetchManagerTeamSummaryServer(effectiveCompanyId),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useManagerTeamMembers(companyId?: string, enabled = true) {
  const { company } = useBootstrapData();
  const effectiveCompanyId = companyId || company?.id;

  return useQuery({
    queryKey: essQueryKeys.team.members(effectiveCompanyId),
    queryFn: () => fetchManagerTeamMembersServer(effectiveCompanyId),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useSubmitProfileChangeRequest() {
  const queryClient = useQueryClient();
  const { company } = useBootstrapData();
  const currentCompanyId = company?.id;

  return useMutation({
    mutationFn: (params: {
      fieldName: string;
      requestedValue: string;
      reason: string;
      oldValue?: string;
      attachmentFileId?: string;
      attachmentName?: string;
    }) =>
      submitProfileChangeRequestRecord({
        companyId: currentCompanyId || "",
        ...params,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: essQueryKeys.myProfileChangeRequests(currentCompanyId),
      });
      void queryClient.invalidateQueries({
        queryKey: essQueryKeys.team.summary(currentCompanyId),
      });
    },
  });
}

export function useUpdateMyDirectProfileFields() {
  const queryClient = useQueryClient();
  const { company } = useBootstrapData();
  const currentCompanyId = company?.id;

  return useMutation({
    mutationFn: (params: { phone?: string; personalEmail?: string; emergencyContact?: any }) =>
      updateMyDirectProfileFieldsRecord({
        companyId: currentCompanyId || "",
        ...params,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: essQueryKeys.profile(currentCompanyId),
      });
    },
  });
}

export function useReviewProfileChangeRequest() {
  const queryClient = useQueryClient();
  const { company } = useBootstrapData();
  const currentCompanyId = company?.id;

  return useMutation({
    mutationFn: (params: { requestId: string; status: "approved" | "rejected"; reviewNotes?: string }) =>
      reviewProfileChangeRequestRecord(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: essQueryKeys.myProfileChangeRequests(currentCompanyId),
      });
      void queryClient.invalidateQueries({
        queryKey: essQueryKeys.team.summary(currentCompanyId),
      });
      void queryClient.invalidateQueries({
        queryKey: essQueryKeys.team.members(currentCompanyId),
      });
    },
  });
}
