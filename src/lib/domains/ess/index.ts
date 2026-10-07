/**
 * ESS & MSS Domain Definitions, Interfaces and Catalogs.
 * Provides unified types for Employee Self-Service and Manager Self-Service.
 */

export interface EmployeeSelfProfile {
  id: string;
  company_id: string;
  employee_no: string;
  first_name_ar: string;
  last_name_ar: string;
  first_name_en: string;
  last_name_en: string;
  full_name: string;
  email: string;
  phone: string;
  job_title_ar: string;
  job_title_en: string;
  department_id: string;
  department_name: string;
  manager_id: string | null;
  manager_name: string;
  status: string;
  hire_date: string;
  contract_type: string;
  national_id_or_iqama: string;
  nationality: string;
  gender: string;
  marital_status: string;
  avatar_url?: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  total_salary: number;
  bank_iban?: string;
  bank_name?: string;
  emergency_contact?: {
    name?: string;
    relation?: string;
    phone?: string;
  } | null;
}

export interface AuthenticatedEmployeeContext {
  found: boolean;
  employee: EmployeeSelfProfile | null;
  is_manager: boolean;
  direct_reports_count: number;
}

export type ProfileChangeFieldRisk = "low" | "high";

export interface ProfileChangeFieldDefinition {
  field_name: string;
  label_ar: string;
  label_en: string;
  risk_level: ProfileChangeFieldRisk;
  input_type: "text" | "tel" | "email" | "select" | "iban";
  options?: { value: string; label_ar: string; label_en: string }[];
  description_ar: string;
  description_en: string;
}

export const PROFILE_CHANGE_FIELDS_CATALOG: Record<string, ProfileChangeFieldDefinition> = {
  phone: {
    field_name: "phone",
    label_ar: "رقم الجوال",
    label_en: "Mobile Number",
    risk_level: "low",
    input_type: "tel",
    description_ar: "رقم الجوال الشخصي المعتمد للتواصل والرسائل النصية",
    description_en: "Primary personal mobile number for communications",
  },
  personal_email: {
    field_name: "personal_email",
    label_ar: "البريد الإلكتروني الشخصي",
    label_en: "Personal Email",
    risk_level: "low",
    input_type: "email",
    description_ar: "البريد البديل لاستلام الإشعارات وكشوف الحساب",
    description_en: "Alternative email for personal notifications",
  },
  bank_iban: {
    field_name: "bank_iban",
    label_ar: "رقم الحساب البنكي (IBAN)",
    label_en: "Bank IBAN",
    risk_level: "high",
    input_type: "iban",
    description_ar: "الآيبان البنكي المعتمد لصرف مسيّر الرواتب (يتطلب تدقيق وموافقة المالية)",
    description_en: "Bank IBAN for salary transfer (requires Finance approval)",
  },
  bank_name: {
    field_name: "bank_name",
    label_ar: "اسم البنك",
    label_en: "Bank Name",
    risk_level: "high",
    input_type: "select",
    options: [
      { value: "الراجحي", label_ar: "مصرف الراجحي", label_en: "Al Rajhi Bank" },
      { value: "الأهلي", label_ar: "البنك الأهلي السعودي (SNB)", label_en: "Saudi National Bank" },
      { value: "الإنماء", label_ar: "مصرف الإنماء", label_en: "Alinma Bank" },
      { value: "البلاد", label_ar: "بنك البلاد", label_en: "Bank Albilad" },
      { value: "الرياض", label_ar: "بنك الرياض", label_en: "Riyad Bank" },
      { value: "ساب", label_ar: "البنك السعودي الأول (SAB)", label_en: "Saudi Awwal Bank" },
      { value: "الجزيرة", label_ar: "بنك الجزيرة", label_en: "Bank AlJazira" },
      { value: "العربي", label_ar: "البنك العربي الوطني (ANB)", label_en: "Arab National Bank" },
      { value: "الاستثمار", label_ar: "البنك السعودي للاستثمار (SAIB)", label_en: "Saudi Investment Bank" },
    ],
    description_ar: "البنك الذي يتبعه حساب الآيبان المسجل",
    description_en: "The bank associated with your IBAN account",
  },
  marital_status: {
    field_name: "marital_status",
    label_ar: "الحالة الاجتماعية",
    label_en: "Marital Status",
    risk_level: "high",
    input_type: "select",
    options: [
      { value: "single", label_ar: "أعزب / عزباء", label_en: "Single" },
      { value: "married", label_ar: "متزوج / متزوجة", label_en: "Married" },
      { value: "divorced", label_ar: "مطلق / مطلقة", label_en: "Divorced" },
      { value: "widowed", label_ar: "أرمل / أرملة", label_en: "Widowed" },
    ],
    description_ar: "لتحديث استحقاقات التأمين الطبي وبدلات العائلة",
    description_en: "Updates medical insurance benefits and family allowances",
  },
  emergency_contact: {
    field_name: "emergency_contact",
    label_ar: "جهة الاتصال في حالات الطوارئ",
    label_en: "Emergency Contact",
    risk_level: "low",
    input_type: "text",
    description_ar: "اسم ورقم قريب للتواصل السريع في حالات الطوارئ",
    description_en: "Contact person and number in case of emergency",
  },
};

export interface ProfileChangeRequest {
  id: string;
  company_id: string;
  employee_id: string;
  request_number: string;
  field_name: string;
  field_label_ar: string;
  field_label_en: string;
  old_value: string | null;
  requested_value: string;
  reason: string;
  attachment_file_id?: string | null;
  attachment_name?: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManagerTeamSummary {
  is_manager: boolean;
  total_team_members: number;
  present_today: number;
  on_leave_today: number;
  absent_today: number;
  pending_leaves_count: number;
  pending_profile_changes_count: number;
}

export interface ManagerTeamMember {
  id: string;
  employee_no: string;
  full_name: string;
  first_name_ar: string;
  last_name_ar: string;
  email: string;
  phone: string;
  job_title_ar: string;
  department_name: string;
  status: string;
  avatar_url?: string;
  hire_date: string;
  attendance_today?: {
    status: string;
    check_in?: string;
    check_out?: string;
  } | null;
  on_leave: boolean;
}

export {
  fetchAuthenticatedEmployeeContextServer,
  fetchMyProfileChangeRequestsServer,
  fetchManagerTeamSummaryServer,
  fetchManagerTeamMembersServer,
  submitProfileChangeRequestRecord,
  updateMyDirectProfileFieldsRecord,
  reviewProfileChangeRequestRecord,
  useAuthenticatedEmployeeContext,
  useMyProfileChangeRequests,
  useManagerTeamSummary,
  useManagerTeamMembers,
  useSubmitProfileChangeRequest,
  useUpdateMyDirectProfileFields,
  useReviewProfileChangeRequest,
} from "../../data/ess-repository";
