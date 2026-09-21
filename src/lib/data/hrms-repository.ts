import { supabase } from "../../integrations/supabase/client";
import type { Database } from "../../integrations/supabase/types";
import {
  enterpriseSupabase,
  type DepartmentRow,
  type EmployeeExtendedRow,
  type RequestExtendedRow,
  type SubsidiaryRow,
  type WorkLocationRow,
} from "./enterprise-client";
import type {
  DailyAttendanceRecord,
  Employee,
  OrgUnit,
  RequestCategory,
  RequestStatus,
  ServiceRequest,
  Gender,
  MaritalStatus,
  ContractType,
  EmployeeStatus,
  EmployeeDirectoryItem,
  EmployeeDirectoryFilters,
  EmployeeDirectoryResponse,
  EmployeeDirectoryKpis,
} from "../../types";
import { calculateProfileCompletion } from "../domains/employees/completion";

type AttendanceRow = Database["public"]["Tables"]["attendance_records"]["Row"];
type RequestRow = RequestExtendedRow;

export interface CoreSnapshot {
  employees: Employee[];
  orgUnits: OrgUnit[];
  attendanceRecords: DailyAttendanceRecord[];
  requests: ServiceRequest[];
}

function splitName(fullName: string) {
  const cleaned = (fullName || "").replace(/\(مدير النظام\)/g, "").trim();
  if (cleaned.includes("@") || !cleaned) {
    return {
      firstName: "",
      lastName: "",
    };
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function mapEmployee(
  row: EmployeeExtendedRow,
  departments: Map<string, { name?: string | null; name_ar?: string | null }>,
  subsidiaries: Map<string, { name_ar?: string | null }>,
  locations: Map<string, { name_ar?: string | null }>,
): Employee {
  const firstNameAr =
    (row.first_name_ar && !row.first_name_ar.includes("@") ? row.first_name_ar : null) ||
    splitName(row.full_name || "").firstName ||
    "";

  const lastNameAr =
    (row.last_name_ar && row.last_name_ar !== "—" && !row.last_name_ar.includes("@")
      ? row.last_name_ar.replace(/\(مدير النظام\)/g, "").trim()
      : null) ||
    splitName(row.full_name || "").lastName ||
    "";

  const firstNameEn =
    row.first_name_en && !row.first_name_en.includes("@") ? row.first_name_en : "";
  const lastNameEn =
    row.last_name_en && row.last_name_en !== "—" ? row.last_name_en : "";

  const basicSalary = Number(row.basic_salary) || 0;
  const totalSalary = Number(row.total_salary) || basicSalary;
  const housingAllowance = Number(row.housing_allowance) || 0;
  const transportAllowance = Number(row.transport_allowance) || 0;
  const otherAllowances = Number(row.other_allowances) || 0;

  const department = row.department_id ? departments.get(row.department_id) : undefined;
  const subsidiary = row.subsidiary_id ? subsidiaries.get(row.subsidiary_id) : undefined;
  const location = row.work_location_id ? locations.get(row.work_location_id) : undefined;

  const empObj: Employee = {
    id: row.id,
    companyId: row.company_id || undefined,
    employeeNo: row.employee_no || "",
    firstNameAr,
    lastNameAr,
    firstNameEn,
    lastNameEn,
    email: row.email ?? "",
    personalEmail: row.personal_email ?? undefined,
    phone: row.phone || "",
    nationalIdOrIqama: row.national_id_or_iqama && row.national_id_or_iqama !== "غير مسجل" ? row.national_id_or_iqama : "",
    nationality: row.nationality && row.nationality !== "غير محدد" ? row.nationality : "",
    // Truthfulness: return null when gender is not recorded — do NOT fabricate 'male'
    gender: (row.gender as Gender | null) ?? null,
    birthDate: row.birth_date ?? "",
    // Truthfulness: return null when marital_status is not recorded — do NOT fabricate 'single'
    maritalStatus: (row.marital_status as MaritalStatus | null) ?? null,
    avatarUrl: row.avatar_url || undefined,
    subsidiaryId: row.subsidiary_id ?? "",
    subsidiaryName: subsidiary?.name_ar || undefined,
    departmentId: row.department_id ?? "unassigned",
    departmentName: department?.name || undefined,
    jobTitleAr: row.job_title && row.job_title !== "غير محدد" ? row.job_title : "",
    jobTitleEn: typeof (row.metadata as Record<string, unknown> | null)?.jobTitleEn === "string"
      ? ((row.metadata as Record<string, unknown>).jobTitleEn as string)
      : "",
    jobPositionId: row.job_position_id,
    costCenterId: row.cost_center_id,
    managerId: row.manager_id,
    workLocationId: row.work_location_id ?? "",
    workLocationName: location?.name_ar || undefined,
    hireDate: row.hire_date || "",
    // Truthfulness: return null when contract_type is not recorded — do NOT fabricate 'full_time'
    contractType: (row.contract_type as ContractType | null) ?? null,
    probationEndDate: row.probation_end_date ?? undefined,
    // Truthfulness: 'draft' is the authoritative DB-default initial state, not 'active'
    status: (row.status as Employee["status"]) ?? "draft",
    completionScore: 0, // Computed below
    terminationDate: row.termination_date || undefined,
    lastWorkingDate: row.last_working_date || undefined,
    terminationReason: row.termination_reason || undefined,
    terminationType: row.termination_type || undefined,
    rehireDate: row.rehire_date || undefined,
    nationalIdExpiry: row.national_id_expiry || undefined,
    passportNo: row.passport_no || undefined,
    passportExpiry: row.passport_expiry || undefined,
    bloodType: row.blood_type || undefined,
    dependentsCount: row.dependents_count || 0,
    jobGrade: row.job_grade || undefined,
    // Truthfulness: return null when work_type is not recorded — do NOT fabricate 'on_site'
    workType: (row.work_type as "on_site" | "hybrid" | "remote" | null) ?? null,
    // Truthfulness: contract_start_date is NOT the same as hire_date — do NOT fall back to hire_date
    contractStartDate: row.contract_start_date ?? undefined,
    contractEndDate: row.contract_end_date || undefined,
    qiwaContractNo: row.qiwa_contract_no || undefined,
    basicSalary,
    totalSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    bankName: row.bank_name || undefined,
    iban: row.iban || undefined,
    gosiNumber: row.gosi_number || undefined,
    customFields: {
      ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
      userId: row.user_id,
    },
  };

  empObj.completionScore = calculateProfileCompletion(empObj);
  return empObj;
}

function mapOrgUnit(row: DepartmentRow): OrgUnit {
  return {
    id: row.id,
    companyId: row.company_id ?? "",
    parentId: row.parent_id,
    subsidiaryId: row.subsidiary_id,
    costCenterId: row.cost_center_id,
    nameAr: row.name,
    nameEn: row.name_en ?? row.name,
    descriptionAr: row.description_ar ?? undefined,
    descriptionEn: row.description_en ?? undefined,
    code: row.code,
    type: row.unit_type as OrgUnit["type"],
    managerEmployeeId: row.manager_employee_id ?? undefined,
    status: row.status === "inactive" ? "inactive" : "active",
    employeeCount: 0,
  };
}

function mapAttendance(
  row: AttendanceRow,
  employees: Map<string, Employee>,
): DailyAttendanceRecord {
  const employee = employees.get(row.employee_id);
  const status =
    row.status === "leave" ? "on_leave" : row.status === "remote" ? "present" : row.status;

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeNo: employee?.employeeNo ?? "—",
    employeeName: employee ? `${employee.firstNameAr} ${employee.lastNameAr}` : "موظف",
    departmentName: employee?.departmentName ?? "غير محدد",
    workDate: row.work_date,
    actualIn: row.check_in ?? undefined,
    actualOut: row.check_out ?? undefined,
    status,
    lateMinutes: status === "late" ? 15 : 0,
    earlyDepartureMinutes: 0,
    workedHours: Number(row.worked_hours),
    overtimeHours: 0,
    punchSource: "manual_admin",
    geofenceValid: true,
    violationsCount: status === "late" || status === "absent" ? 1 : 0,
    reviewedByPayroll: false,
  };
}

function mapRequestType(type: RequestRow["type"]): RequestCategory {
  const types: Record<RequestRow["type"], RequestCategory> = {
    leave: "leave",
    attendance_fix: "attendance_correction",
    advance: "loan_advance",
    expense: "expense_claim",
  };
  return types[type];
}

function mapRequestStatus(status: RequestRow["status"]): RequestStatus {
  const statuses: Record<RequestRow["status"], RequestStatus> = {
    draft: "draft",
    pending: "pending_approval",
    pending_approval: "pending_approval",
    approved: "approved",
    rejected: "rejected",
    returned: "returned",
  };
  return statuses[status];
}

function mapRequest(
  row: RequestRow,
  employees: Map<string, Employee>,
  timelineRows: Array<{
    id: string;
    step_number: number;
    actor_id: string | null;
    actor_name: string | null;
    actor_role: string | null;
    action: string;
    note: string | null;
    created_at: string;
  }>,
): ServiceRequest {
  const employee = employees.get(row.employee_id);
  const type = mapRequestType(row.type);

  return {
    id: row.id,
    referenceNo: row.reference,
    type,
    requesterId: row.employee_id,
    requesterName: employee ? `${employee.firstNameAr} ${employee.lastNameAr}` : "موظف",
    requesterJobTitle: employee?.jobTitleAr,
    departmentName: employee?.departmentName,
    status: mapRequestStatus(row.status),
    currentStepIndex: row.current_step_index,
    totalSteps: row.total_steps,
    currentApproverRole:
      row.status === "pending" || row.status === "pending_approval" ? (row.current_approver_role ?? "مدير الموارد البشرية") : undefined,
    submittedAt: row.created_at,
    updatedAt: row.decided_at ?? row.created_at,
    payload: {
      reason: row.reason,
      startDate: row.start_date,
      endDate: row.end_date,
      totalDays: row.days,
      amount: row.amount,
    },
    timeline:
      timelineRows.length > 0
        ? timelineRows.map((event) => ({
            id: event.id,
            stepNumber: event.step_number,
            actorId: event.actor_id ?? row.employee_id,
            actorName: event.actor_name ?? "النظام",
            actorRole: event.actor_role ?? "النظام",
            action: event.action as ServiceRequest["timeline"][number]["action"],
            note: event.note ?? undefined,
            timestamp: event.created_at,
          }))
        : [
            {
              id: `${row.id}-submitted`,
              stepNumber: 1,
              actorId: row.created_by ?? row.employee_id,
              actorName: employee ? `${employee.firstNameAr} ${employee.lastNameAr}` : "موظف",
              actorRole: "مقدم الطلب",
              action: "submitted",
              timestamp: row.created_at,
            },
          ],
  };
}

export async function fetchCoreSnapshot(): Promise<CoreSnapshot> {
  const [
    departmentsResult,
    employeesResult,
    subsidiariesResult,
    locationsResult,
    attendanceResult,
    requestsResult,
    timelineResult,
  ] = await Promise.all([
    enterpriseSupabase.from("departments").select("*").order("name"),
    enterpriseSupabase.from("employees").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase.from("subsidiaries").select("id, name_ar"),
    enterpriseSupabase.from("work_locations").select("id, name_ar"),
    supabase.from("attendance_records").select("*").order("work_date", { ascending: false }),
    enterpriseSupabase.from("requests").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase.from("request_timeline").select("*").order("created_at"),
  ]);

  const firstError = [
    departmentsResult.error,
    employeesResult.error,
    subsidiariesResult.error,
    locationsResult.error,
    attendanceResult.error,
    requestsResult.error,
    timelineResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const departments = new Map((departmentsResult.data ?? []).map((row) => [row.id, row]));
  const subsidiaries = new Map((subsidiariesResult.data ?? []).map((row) => [row.id, row]));
  const locations = new Map((locationsResult.data ?? []).map((row) => [row.id, row]));
  const employees = (employeesResult.data ?? []).map((row) =>
    mapEmployee(row, departments, subsidiaries, locations),
  );
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  for (const employee of employees) {
    const manager = employee.managerId ? employeeMap.get(employee.managerId) : undefined;
    employee.managerName = manager ? `${manager.firstNameAr} ${manager.lastNameAr}` : undefined;
  }
  const orgUnits = (departmentsResult.data ?? []).map(mapOrgUnit);

  for (const unit of orgUnits) {
    unit.employeeCount = employees.filter((employee) => employee.departmentId === unit.id).length;
    const manager = unit.managerEmployeeId ? employeeMap.get(unit.managerEmployeeId) : undefined;
    unit.managerName = manager ? `${manager.firstNameAr} ${manager.lastNameAr}` : unit.managerName;
  }


  return {
    employees,
    orgUnits,
    attendanceRecords: (attendanceResult.data ?? []).map((row) => mapAttendance(row, employeeMap)),
    requests: (requestsResult.data ?? []).map((row) =>
      mapRequest(
        row,
        employeeMap,
        (timelineResult.data ?? []).filter((event) => event.request_id === row.id),
      ),
    ),
  };
}

export async function generateCompanyEmployeeNoRecord(companyId: string): Promise<string> {
  const { data, error } = await enterpriseSupabase.rpc("generate_company_employee_no", {
    p_company_id: companyId,
  });
  if (error || !data) {
    throw new Error(`فشل توليد الرقم الوظيفي للموظف: ${error?.message || "تعذر إكمال العملية"}`);
  }
  return data as string;
}

export async function createEmployeeRecord(employee: Employee): Promise<Employee> {
  const firstName = employee.firstNameAr?.trim();
  const lastName = employee.lastNameAr?.trim();
  if (!firstName || !lastName) {
    throw new Error("الاسم الأول واسم العائلة باللغة العربية إلزاميان للتوثيق المالي والقانوني ولإنشاء الموظف.");
  }

  // Authoritative company resolution via trusted RPC (browser metadata eliminated)
  const { data: createdRaw, error } = await enterpriseSupabase.rpc("create_employee", {
    p_first_name_ar: firstName,
    p_last_name_ar: lastName,
    p_first_name_en: employee.firstNameEn || null,
    p_last_name_en: employee.lastNameEn || null,
    p_email: employee.email || null,
    p_phone: employee.phone || null,
    p_national_id_or_iqama: employee.nationalIdOrIqama || null,
    p_nationality: employee.nationality || null,
    // Truthfulness: pass null when gender is not selected — do NOT fabricate 'male'
    p_gender: employee.gender || null,
    p_birth_date: employee.birthDate || null,
    // Truthfulness: pass null when maritalStatus is not selected — do NOT fabricate 'single'
    p_marital_status: employee.maritalStatus || null,
    // Truthfulness: pass null when hireDate is empty — server will reject (required field)
    p_hire_date: employee.hireDate || null,
    // Truthfulness: pass null when contractType is empty — server will reject (required field)
    p_contract_type: employee.contractType || null,
    p_job_title: employee.jobTitleAr || employee.jobTitleEn || null,
    p_department_id: employee.departmentId === "unassigned" || !employee.departmentId ? null : employee.departmentId,
    p_subsidiary_id: employee.subsidiaryId || null,
    p_work_location_id: employee.workLocationId || null,
    p_job_position_id: employee.jobPositionId ?? null,
    p_cost_center_id: employee.costCenterId ?? null,
    p_manager_id: employee.managerId ?? null,
    // Truthfulness: pass null when workType is empty — server will reject (required field)
    p_work_type: employee.workType || null,
    p_basic_salary: Number(employee.basicSalary || 0),
    p_housing_allowance: Number(employee.housingAllowance || 0),
    p_transport_allowance: Number(employee.transportAllowance || 0),
    p_other_allowances: Number(employee.otherAllowances || 0),
    p_bank_name: employee.bankName || null,
    p_iban: employee.iban || null,
    p_job_grade: employee.jobGrade || null,
    p_target_company_id: employee.companyId || null,
  });

  if (error) {
    if (error.message.includes("لا يوجد سياق منشأة معتمد") || error.message.includes("تعذر تحديد منشأة")) {
      throw new Error("تعذر تحديد منشأة الموظف المعتمدة بصورة آمنة وموثوقة. يرجى التأكد من تسجيل الدخول ضمن منشأة معتمدة.");
    }
    throw new Error(error.message);
  }

  const created = (createdRaw as Record<string, unknown>) || {};
  if (!created || !created.id) {
    throw new Error("تعذر إنشاء سجل الموظف في قاعدة البيانات عبر الإجراء المعتمد.");
  }

  return {
    ...employee,
    id: String(created.id),
    employeeNo: String(created.employee_no || employee.employeeNo),
    companyId: String(created.company_id || employee.companyId),
    // status: employee.status || "draft"
    status: (created.status as EmployeeStatus) || employee.status || "draft",
    completionScore: calculateProfileCompletion(employee),
  };
}

export async function updateEmployeeRecord(id: string, updates: Partial<Employee>) {
  // 1. Controlled HR Profile mutation
  const hasHrUpdates =
    updates.firstNameAr !== undefined ||
    updates.lastNameAr !== undefined ||
    updates.firstNameEn !== undefined ||
    updates.lastNameEn !== undefined ||
    updates.email !== undefined ||
    updates.phone !== undefined ||
    updates.nationalIdOrIqama !== undefined ||
    updates.nationality !== undefined ||
    updates.gender !== undefined ||
    updates.birthDate !== undefined ||
    updates.maritalStatus !== undefined ||
    updates.jobTitleAr !== undefined ||
    updates.nationalIdExpiry !== undefined ||
    updates.passportNo !== undefined ||
    updates.passportExpiry !== undefined ||
    updates.bloodType !== undefined ||
    updates.dependentsCount !== undefined ||
    updates.jobGrade !== undefined;

  if (hasHrUpdates) {
    let firstNameAr = updates.firstNameAr;
    let lastNameAr = updates.lastNameAr;
    if (!firstNameAr || !lastNameAr) {
      const existing = await fetchSingleEmployee(id);
      if (existing) {
        firstNameAr = firstNameAr || existing.firstNameAr;
        lastNameAr = lastNameAr || existing.lastNameAr;
      }
    }
    if (firstNameAr && lastNameAr) {
      await updateEmployeeHrProfileRecord({
        employeeId: id,
        firstNameAr,
        lastNameAr,
        firstNameEn: updates.firstNameEn,
        lastNameEn: updates.lastNameEn,
        email: updates.email,
        phone: updates.phone,
        nationalId: updates.nationalIdOrIqama,
        nationality: updates.nationality,
        gender: updates.gender,
        birthDate: updates.birthDate,
        maritalStatus: updates.maritalStatus,
        jobTitle: updates.jobTitleAr,
        nationalIdExpiry: updates.nationalIdExpiry,
        passportNo: updates.passportNo,
        passportExpiry: updates.passportExpiry,
        bloodType: updates.bloodType,
        dependentsCount: updates.dependentsCount,
        jobGrade: updates.jobGrade,
      });
    }
  }

  // 2. Controlled Assignment mutation
  const hasAssignmentUpdates =
    updates.departmentId !== undefined ||
    updates.subsidiaryId !== undefined ||
    updates.workLocationId !== undefined ||
    updates.jobPositionId !== undefined ||
    updates.costCenterId !== undefined ||
    updates.managerId !== undefined ||
    updates.workType !== undefined;

  if (hasAssignmentUpdates) {
    await updateEmployeeAssignmentRecord({
      employeeId: id,
      departmentId: updates.departmentId,
      subsidiaryId: updates.subsidiaryId,
      workLocationId: updates.workLocationId,
      jobPositionId: updates.jobPositionId ?? undefined,
      costCenterId: updates.costCenterId ?? undefined,
      managerId: updates.managerId ?? undefined,
      workType: updates.workType,
    });
  }

  // 3. Controlled Banking mutation
  if (updates.bankName !== undefined || updates.iban !== undefined) {
    await updateEmployeeBankDetailsRecord({
      employeeId: id,
      bankName: updates.bankName || "",
      iban: updates.iban || "",
    });
  }

  // 4. Controlled Compensation mutation
  if (
    updates.basicSalary !== undefined ||
    updates.housingAllowance !== undefined ||
    updates.transportAllowance !== undefined ||
    updates.otherAllowances !== undefined
  ) {
    await updateEmployeeCompensationRecord({
      employeeId: id,
      basicSalary: Number(updates.basicSalary || 0),
      housingAllowance: Number(updates.housingAllowance || 0),
      transportAllowance: Number(updates.transportAllowance || 0),
      otherAllowances: Number(updates.otherAllowances || 0),
    });
  }

  // 5. Whitelisted non-sensitive technical updates
  const dbUpdates: Partial<EmployeeExtendedRow> = {};
  if (updates.completionScore !== undefined)
    dbUpdates.completion_score = Number(updates.completionScore || 0);
  if (updates.avatarStoragePath !== undefined) dbUpdates.avatar_storage_path = updates.avatarStoragePath || null;
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl || null;
  if (updates.customFields !== undefined) dbUpdates.metadata = updates.customFields;

  // Strictly delete sensitive, financial, and compliance keys from direct table update
  delete (dbUpdates as Record<string, unknown>).status;
  delete (dbUpdates as Record<string, unknown>).basic_salary;
  delete (dbUpdates as Record<string, unknown>).total_salary;
  delete (dbUpdates as Record<string, unknown>).housing_allowance;
  delete (dbUpdates as Record<string, unknown>).transport_allowance;
  delete (dbUpdates as Record<string, unknown>).other_allowances;
  delete (dbUpdates as Record<string, unknown>).bank_name;
  delete (dbUpdates as Record<string, unknown>).iban;
  delete (dbUpdates as Record<string, unknown>).national_id_or_iqama;
  delete (dbUpdates as Record<string, unknown>).national_id_expiry;
  delete (dbUpdates as Record<string, unknown>).passport_no;
  delete (dbUpdates as Record<string, unknown>).passport_expiry;
  delete (dbUpdates as Record<string, unknown>).blood_type;
  delete (dbUpdates as Record<string, unknown>).dependents_count;
  delete (dbUpdates as Record<string, unknown>).job_grade;

  if (Object.keys(dbUpdates).length === 0) {
    return { id };
  }

  const { data, error } = await enterpriseSupabase
    .from("employees")
    .update(dbUpdates)
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("الرقم الوظيفي مستخدم بالفعل في هذه المنشأة.");
    }
    throw new Error(error.message);
  }
  return data ?? { id };
}

export async function changeEmployeeStatusRecord(
  employeeId: string,
  newStatus: string,
  effectiveDate?: string,
  reason?: string,
  terminationType?: string,
) {
  const { data, error } = await enterpriseSupabase.rpc("change_employee_status", {
    p_employee_id: employeeId,
    p_new_status: newStatus,
    p_effective_date: effectiveDate || null,
    p_reason: reason || null,
    p_termination_type: terminationType || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function bulkChangeEmployeeStatusRecord(
  employeeIds: string[],
  newStatus: string,
  effectiveDate?: string,
  reason?: string,
) {
  const { data, error } = await enterpriseSupabase.rpc("bulk_change_employee_status", {
    p_employee_ids: employeeIds,
    p_new_status: newStatus,
    p_effective_date: effectiveDate || null,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function rehireEmployeeRecord(
  employeeId: string,
  rehireDate?: string,
  newStatus = "probation",
  newDeptId?: string,
  newPositionId?: string,
  reason?: string,
) {
  const { data, error } = await enterpriseSupabase.rpc("rehire_employee", {
    p_employee_id: employeeId,
    p_rehire_date: rehireDate || null,
    p_new_status: newStatus,
    p_new_department_id: newDeptId || null,
    p_new_position_id: newPositionId || null,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchEmployeeDirectoryRecord(
  filters: EmployeeDirectoryFilters = {},
): Promise<EmployeeDirectoryResponse> {
  const { data, error } = await enterpriseSupabase.rpc("get_employee_directory", {
    p_search: filters.search?.trim() || null,
    p_status: filters.status || null,
    p_department_id: filters.departmentId || null,
    p_subsidiary_id: filters.subsidiaryId || null,
    p_location_id: filters.locationId || null,
    p_gender: filters.gender || null,
    p_page: filters.page ?? 1,
    p_page_size: filters.pageSize ?? 25,
    p_sort: filters.sort || "name_asc",
    p_contract_type: filters.contractType || null,
    p_nationality: filters.nationality || null,
    p_quick_preset: filters.quickPreset || null,
    p_min_salary: filters.minSalary !== undefined ? Number(filters.minSalary) : null,
    p_max_salary: filters.maxSalary !== undefined ? Number(filters.maxSalary) : null,
  });

  if (error) throw new Error(error.message);

  const raw = (data as Record<string, unknown>) || {};
  const rawItems = (raw.items as Record<string, unknown>[]) || [];

  const items: EmployeeDirectoryItem[] = rawItems.map((item) => ({
    id: String(item.id),
    employeeNo: String(item.employee_no || ""),
    firstNameAr: String(item.first_name_ar || ""),
    lastNameAr: String(item.last_name_ar || ""),
    firstNameEn: item.first_name_en ? String(item.first_name_en) : null,
    lastNameEn: item.last_name_en ? String(item.last_name_en) : null,
    fullName: String(item.full_name || ""),
    email: item.email ? String(item.email) : null,
    phone: item.phone ? String(item.phone) : null,
    jobTitle: String(item.job_title || ""),
    status: (item.status as EmployeeStatus) || "draft",
    hireDate: String(item.hire_date || ""),
    contractType: (item.contract_type as ContractType | null) ?? null,
    workType: item.work_type ? String(item.work_type) : null,
    departmentId: item.department_id ? String(item.department_id) : null,
    departmentName: item.department_name ? String(item.department_name) : null,
    subsidiaryId: item.subsidiary_id ? String(item.subsidiary_id) : null,
    subsidiaryName: item.subsidiary_name ? String(item.subsidiary_name) : null,
    workLocationId: item.work_location_id ? String(item.work_location_id) : null,
    workLocationName: item.work_location_name ? String(item.work_location_name) : null,
    avatarUrl: item.avatar_url ? String(item.avatar_url) : null,
    avatarStoragePath: item.avatar_storage_path ? String(item.avatar_storage_path) : null,
    completionScore: Number(item.completion_score ?? 0),
    nationality: item.nationality ? String(item.nationality) : null,
    qiwaContractNo: item.qiwa_contract_no ? String(item.qiwa_contract_no) : null,
    gender: (item.gender as Gender) || null,
    jobGrade: item.job_grade ? String(item.job_grade) : null,
  }));

  return {
    items,
    totalCount: Number(raw.total_count ?? items.length),
    page: Number(raw.page ?? (filters.page ?? 1)),
    pageSize: Number(raw.page_size ?? (filters.pageSize ?? 25)),
  };
}

export async function fetchEmployeeDirectoryKpisRecord(): Promise<EmployeeDirectoryKpis> {
  const { data, error } = await enterpriseSupabase.rpc("get_employee_directory_kpis");
  if (error) throw new Error(error.message);
  const raw = (data as Record<string, unknown>) || {};
  return {
    available: Boolean(raw.available),
    totalEmployees: Number(raw.total_employees || 0),
    totalEmployed: raw.total_employed !== undefined ? Number(raw.total_employed) : undefined,
    activeEmployees: Number(raw.active_employees || 0),
    saudiEmployees: Number(raw.saudi_employees || 0),
    expatEmployees: Number(raw.expat_employees || 0),
    nonSaudiEmployees: raw.non_saudi_employees !== undefined ? Number(raw.non_saudi_employees) : undefined,
    unknownNationalityCount: raw.unknown_nationality_count !== undefined ? Number(raw.unknown_nationality_count) : undefined,
    saudizationRate: Number(raw.saudization_rate || 0),
    probationCount: Number(raw.probation_count || 0),
    onLeaveCount: Number(raw.on_leave_count || 0),
    expiringDocsCount: Number(raw.expiring_docs_count || 0),
    hrRestricted: Boolean(raw.hr_restricted),
    reason: raw.reason ? String(raw.reason) : undefined,
  };
}

function mapEmployeeDetail(data: Record<string, unknown>): Employee {
  return {
    id: String(data.id),
    companyId: data.company_id ? String(data.company_id) : undefined,
    employeeNo: String(data.employee_no || ""),
    firstNameAr: String(data.first_name_ar || ""),
    lastNameAr: String(data.last_name_ar || ""),
    firstNameEn: String(data.first_name_en || ""),
    lastNameEn: String(data.last_name_en || ""),
    email: String(data.email || ""),
    personalEmail: data.personal_email ? String(data.personal_email) : undefined,
    phone: String(data.phone || ""),
    nationalIdOrIqama: String(data.national_id_or_iqama || ""),
    nationality: String(data.nationality || ""),
    gender: (data.gender as Gender | null) ?? null,
    birthDate: String(data.birth_date || ""),
    maritalStatus: (data.marital_status as MaritalStatus | null) ?? null,
    avatarUrl: data.avatar_url ? String(data.avatar_url) : undefined,
    avatarStoragePath: data.avatar_storage_path ? String(data.avatar_storage_path) : null,
    subsidiaryId: String(data.subsidiary_id || ""),
    subsidiaryName: data.subsidiary_name ? String(data.subsidiary_name) : undefined,
    departmentId: String(data.department_id || ""),
    departmentName: data.department_name ? String(data.department_name) : undefined,
    jobTitleAr: String(data.job_title || ""),
    jobTitleEn: String(data.job_title || ""),
    jobPositionId: data.job_position_id ? String(data.job_position_id) : null,
    managerId: data.manager_id ? String(data.manager_id) : null,
    managerName: data.manager_name ? String(data.manager_name) : undefined,
    workLocationId: String(data.work_location_id || ""),
    workLocationName: data.work_location_name ? String(data.work_location_name) : undefined,
    hireDate: String(data.hire_date || ""),
    contractType: (data.contract_type as ContractType | null) ?? null,
    status: (data.status as EmployeeStatus) || "draft",
    completionScore: Number(data.completion_score ?? 0),
    terminationDate: data.termination_date ? String(data.termination_date) : undefined,
    lastWorkingDate: data.last_working_date ? String(data.last_working_date) : undefined,
    terminationReason: data.termination_reason ? String(data.termination_reason) : undefined,
    terminationType: data.termination_type ? String(data.termination_type) : undefined,
    rehireDate: data.rehire_date ? String(data.rehire_date) : undefined,
    basicSalary: typeof data.basic_salary === "number" ? data.basic_salary : 0,
    totalSalary: typeof data.total_salary === "number" ? data.total_salary : 0,
    housingAllowance: typeof data.housing_allowance === "number" ? data.housing_allowance : 0,
    transportAllowance: typeof data.transport_allowance === "number" ? data.transport_allowance : 0,
    otherAllowances: typeof data.other_allowances === "number" ? data.other_allowances : 0,
    bankName: data.bank_name ? String(data.bank_name) : undefined,
    iban: data.iban ? String(data.iban) : undefined,
    gosiNumber: data.gosi_number ? String(data.gosi_number) : undefined,
    jobGrade: data.job_grade ? String(data.job_grade) : undefined,
    costCenterId: data.cost_center_id ? String(data.cost_center_id) : null,
    contractStartDate: data.contract_start_date ? String(data.contract_start_date) : undefined,
    contractEndDate: data.contract_end_date ? String(data.contract_end_date) : undefined,
    qiwaContractNo: data.qiwa_contract_no ? String(data.qiwa_contract_no) : undefined,
    workType: (data.work_type as Employee["workType"]) ?? null,
    bloodType: data.blood_type ? String(data.blood_type) : undefined,
    dependentsCount: typeof data.dependents_count === "number" ? data.dependents_count : 0,
    passportNo: data.passport_no ? String(data.passport_no) : undefined,
    passportExpiry: data.passport_expiry ? String(data.passport_expiry) : undefined,
    nationalIdExpiry: data.national_id_expiry ? String(data.national_id_expiry) : undefined,
  };
}

export async function fetchEmployeeDetailRecord(id: string): Promise<Employee | null> {
  const { data, error } = await enterpriseSupabase.rpc("get_employee_detail", {
    p_employee_id: id,
  });

  if (error) {
    if (error.message.includes("غير موجود") || error.code === "PGRST116") {
      return null;
    }
    return fetchSingleEmployee(id);
  }

  if (!data) return null;

  return mapEmployeeDetail(data as Record<string, unknown>);
}

export async function updateEmployeeHrProfileRecord(payload: {
  employeeId: string;
  firstNameAr: string;
  lastNameAr: string;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  email?: string | null;
  phone?: string | null;
  nationalId?: string | null;
  nationality?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  maritalStatus?: string | null;
  jobTitle?: string | null;
  nationalIdExpiry?: string | null;
  passportNo?: string | null;
  passportExpiry?: string | null;
  bloodType?: string | null;
  dependentsCount?: number | null;
  jobGrade?: string | null;
}) {
  const { data, error } = await enterpriseSupabase.rpc("update_employee_hr_profile", {
    p_employee_id: payload.employeeId,
    p_first_name_ar: payload.firstNameAr,
    p_last_name_ar: payload.lastNameAr,
    p_first_name_en: payload.firstNameEn || null,
    p_last_name_en: payload.lastNameEn || null,
    p_email: payload.email || null,
    p_phone: payload.phone || null,
    p_national_id: payload.nationalId || null,
    p_nationality: payload.nationality || null,
    p_gender: payload.gender || null,
    p_birth_date: payload.birthDate || null,
    p_marital_status: payload.maritalStatus || null,
    p_job_title: payload.jobTitle || null,
    p_national_id_expiry: payload.nationalIdExpiry || null,
    p_passport_no: payload.passportNo || null,
    p_passport_expiry: payload.passportExpiry || null,
    p_blood_type: payload.bloodType || null,
    p_dependents_count: payload.dependentsCount !== undefined ? Number(payload.dependentsCount) : null,
    p_job_grade: payload.jobGrade || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateEmployeeAssignmentRecord(payload: {
  employeeId: string;
  departmentId?: string | null;
  subsidiaryId?: string | null;
  workLocationId?: string | null;
  jobPositionId?: string | null;
  costCenterId?: string | null;
  managerId?: string | null;
  workType?: string | null;
}) {
  const { data, error } = await enterpriseSupabase.rpc("update_employee_assignment", {
    p_employee_id: payload.employeeId,
    p_department_id: payload.departmentId || null,
    p_subsidiary_id: payload.subsidiaryId || null,
    p_work_location_id: payload.workLocationId || null,
    p_job_position_id: payload.jobPositionId || null,
    p_cost_center_id: payload.costCenterId || null,
    p_manager_id: payload.managerId || null,
    p_work_type: payload.workType || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateEmployeeBankDetailsRecord(payload: {
  employeeId: string;
  bankName: string;
  iban: string;
}) {
  const { data, error } = await enterpriseSupabase.rpc("update_employee_bank_details", {
    p_employee_id: payload.employeeId,
    p_bank_name: payload.bankName,
    p_iban: payload.iban,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateEmployeeCompensationRecord(payload: {
  employeeId: string;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
}) {
  const { data, error } = await enterpriseSupabase.rpc("update_employee_compensation", {
    p_employee_id: payload.employeeId,
    p_basic_salary: payload.basicSalary,
    p_housing_allowance: payload.housingAllowance ?? 0,
    p_transport_allowance: payload.transportAllowance ?? 0,
    p_other_allowances: payload.otherAllowances ?? 0,
  });
  if (error) throw new Error(error.message);
  return data;
}


export async function fetchSingleEmployee(id: string): Promise<Employee | null> {
  const [empResult, deptsResult, subsResult, locsResult] = await Promise.all([
    enterpriseSupabase.from("employees").select("*").eq("id", id).single(),
    enterpriseSupabase.from("departments").select("*"),
    enterpriseSupabase.from("subsidiaries").select("id, name_ar"),
    enterpriseSupabase.from("work_locations").select("id, name_ar"),
  ]);

  if (empResult.error || !empResult.data) {
    return null;
  }

  const departments = new Map((deptsResult.data ?? []).map((row) => [row.id, row]));
  const subsidiaries = new Map((subsResult.data ?? []).map((row) => [row.id, row]));
  const locations = new Map((locsResult.data ?? []).map((row) => [row.id, row]));

  const mapped = mapEmployee(empResult.data, departments, subsidiaries, locations);

  if (mapped.managerId) {
    const { data: mgr } = await enterpriseSupabase
      .from("employees")
      .select("first_name_ar, last_name_ar")
      .eq("id", mapped.managerId)
      .single();
    if (mgr) {
      mapped.managerName = `${mgr.first_name_ar || ""} ${mgr.last_name_ar || ""}`.trim() || undefined;
    }
  }

  return mapped;
}

export async function updateRequestDecision(
  requestId: string,
  status: "approved" | "rejected" | "returned",
  note?: string,
  nextStep?: number,
  isFinalApproval = true,
) {
  const { data: userData } = await supabase.auth.getUser();
  const persistedStatus = status === "approved" && !isFinalApproval ? "pending_approval" : status;
  const { error } = await enterpriseSupabase
    .from("requests")
    .update({
      status: persistedStatus,
      decision_note: note ?? null,
      decided_by: userData.user?.id ?? null,
      decided_at: new Date().toISOString(),
      current_step_index: nextStep,
      current_approver_role: persistedStatus === "pending_approval" ? "المعتمد التالي" : null,
    })
    .eq("id", requestId);
  if (error) throw new Error(error.message);
  const { error: timelineError } = await enterpriseSupabase.from("request_timeline").insert({
    request_id: requestId,
    step_number: 1,
    actor_id: userData.user?.id ?? null,
    actor_name: String(userData.user?.user_metadata?.full_name ?? userData.user?.email ?? "مستخدم"),
    actor_role: "approver",
    action: status,
    note: note ?? null,
  });
  if (timelineError) throw new Error(timelineError.message);
}

export async function createRequestRecord(
  employeeId: string,
  type: RequestCategory,
  payload: Record<string, unknown>,
) {
  const dbType: Database["public"]["Enums"]["request_type"] =
    type === "attendance_correction"
      ? "attendance_fix"
      : type === "loan_advance"
        ? "advance"
        : type === "expense_claim"
          ? "expense"
          : "leave";
  const { data: userData } = await supabase.auth.getUser();
  const { data: request, error } = await enterpriseSupabase
    .from("requests")
    .insert({
      employee_id: employeeId,
      type: dbType,
      status: "pending_approval",
      start_date: typeof payload.startDate === "string" ? payload.startDate : null,
      end_date: typeof payload.endDate === "string" ? payload.endDate : null,
      days: typeof payload.totalDays === "number" ? payload.totalDays : null,
      amount: typeof payload.amount === "number" ? payload.amount : null,
      reason: typeof payload.reason === "string" ? payload.reason : null,
      created_by: userData.user?.id ?? null,
      current_step_index: 1,
      total_steps: 2,
      current_approver_role: "المدير المباشر",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: timelineError } = await enterpriseSupabase.from("request_timeline").insert({
    request_id: request.id,
    step_number: 1,
    actor_id: userData.user?.id ?? null,
    actor_name: String(userData.user?.user_metadata?.full_name ?? userData.user?.email ?? "موظف"),
    actor_role: "employee",
    action: "submitted",
    note: "تم إرسال الطلب لمسار الاعتماد",
  });
  if (timelineError) throw new Error(timelineError.message);
}

export async function recordAttendance(
  employeeId: string,
  type: "in" | "out",
  date: string,
  time: string,
) {
  const { data: existing, error: readError } = await supabase
    .from("attendance_records")
    .select("id, check_in, check_out")
    .eq("employee_id", employeeId)
    .eq("work_date", date)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  if (existing) {
    const { error } = await supabase
      .from("attendance_records")
      .update(
        type === "in"
          ? { check_in: time, status: "present" }
          : { check_out: time, status: "present" },
      )
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("attendance_records").insert({
    employee_id: employeeId,
    work_date: date,
    check_in: type === "in" ? time : null,
    check_out: type === "out" ? time : null,
    status: "present",
    worked_hours: 0,
  });
  if (error) throw new Error(error.message);
}
